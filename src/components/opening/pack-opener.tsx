"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, FastForward, Gift, Info, LoaderCircle, Sparkles, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RC } from "@/components/common/coin-icon";
import { OddsTable } from "@/components/packs/odds-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useShowNotices } from "@/hooks/use-notices";
import { useSetBalance, useWallet } from "@/hooks/use-wallet";
import { api, ApiError, newIdempotencyKey } from "@/lib/api-client";
import { fireConfetti } from "@/lib/confetti";
import { rarityRank, type RarityKey } from "@/lib/rarity";
import { playSound, soundForRarity } from "@/lib/sound";
import { cn, sleep } from "@/lib/utils";
import type { OpenResult, PulledCard } from "@/server/services/packs";
import { usePreferences } from "@/stores/preferences";
import { ChaseCelebration } from "./chase-celebration";
import { FlipCard } from "./flip-card";
import { PackStage } from "./pack-stage";
import { RipSummary } from "./rip-summary";

type Phase = "ready" | "charging" | "tearing" | "reveal" | "summary";
type Qty = 1 | 5 | 10;

export interface OpenerPack {
  id: string;
  slug: string;
  name: string;
  price: number;
  cardsPerPack: number;
  theme: string;
  isActive: boolean;
  odds: { rarity: RarityKey; weightPpm: number; cards: number }[];
}

const keyOf = (openingId: string, slot: number) => `${openingId}:${slot}`;

/** Presentation order: best card last in each pack. Purely cosmetic. */
function revealOrder(result: OpenResult) {
  return result.packs.map((p) => ({
    ...p,
    cards: [...p.cards].sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || a.value - b.value),
  }));
}

export function PackOpener({ pack, initialQty, instantSellBps }: { pack: OpenerPack; initialQty: Qty; instantSellBps: number }) {
  const { data: wallet } = useWallet();
  const setBalance = useSetBalance();
  const showNotices = useShowNotices();
  const queryClient = useQueryClient();
  const { muted, toggleMuted, skipAnimations, setSkipAnimations } = usePreferences();

  const [phase, setPhase] = useState<Phase>("ready");
  const [qty, setQty] = useState<Qty>(initialQty);
  const [voucherSelected, setUseVoucher] = useState(false);
  const [result, setResult] = useState<OpenResult | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [celebrating, setCelebrating] = useState<PulledCard | null>(null);
  const [sold, setSold] = useState<Set<string>>(new Set());
  const [selling, setSelling] = useState(false);
  const [revealingAll, setRevealingAll] = useState(false);
  const pendingKey = useRef<string | null>(null);
  const celebrationDone = useRef<(() => void) | null>(null);
  const cancelReveal = useRef(false);

  const balance = wallet?.balance ?? 0;
  const vouchers = wallet?.vouchers[pack.id] ?? 0;
  const useVoucher = voucherSelected && vouchers > 0;
  const effectiveQty: Qty = useVoucher ? 1 : qty;
  const cost = useVoucher ? 0 : pack.price * qty;
  const canAfford = useCallback((q: number) => balance >= pack.price * q, [balance, pack.price]);
  const ordered = useMemo(() => (result ? revealOrder(result) : []), [result]);
  const allPulls = useMemo(() => ordered.flatMap((p) => p.cards.map((c) => ({ pull: c, key: keyOf(p.openingId, c.slot) }))), [ordered]);
  const allRevealed = allPulls.length > 0 && allPulls.every((p) => revealed.has(p.key));
  const multi = (result?.packs.length ?? 0) > 1;

  const finishRip = useCallback(
    (res: OpenResult) => {
      showNotices(res.notices);
      queryClient.invalidateQueries({ queryKey: ["collection"] });
      queryClient.invalidateQueries({ queryKey: ["missions"] });
    },
    [queryClient, showNotices],
  );

  async function tear(nextQty: Qty = effectiveQty, voucher = useVoucher) {
    if (phase === "charging" || phase === "tearing") return;
    if (!pack.isActive) return toast.error("This pack is not currently available.");
    if (!voucher && !canAfford(nextQty)) {
      playSound("error");
      return toast.error("Not enough Rip Coins", { description: "Claim your daily reward or complete missions to earn more — it's free." });
    }
    setResult(null);
    setRevealed(new Set());
    setSold(new Set());
    setPhase("charging");
    playSound("whoosh");
    // Reuse the key after a network failure so a retry can never double-charge.
    const idempotencyKey = pendingKey.current ?? newIdempotencyKey();
    pendingKey.current = idempotencyKey;
    try {
      const [res] = await Promise.all([
        api<OpenResult>(`/api/packs/${pack.slug}/open`, { body: { quantity: voucher ? 1 : nextQty, idempotencyKey, useVoucher: voucher } }),
        sleep(skipAnimations ? 0 : 900),
      ]);
      pendingKey.current = null;
      setBalance(res.balance);
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      setResult(res);
      if (skipAnimations) {
        const keys = res.packs.flatMap((p) => p.cards.map((c) => keyOf(p.openingId, c.slot)));
        setRevealed(new Set(keys));
        setPhase("summary");
        const top = res.packs.flatMap((p) => p.cards).sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity))[0];
        if (top) playSound(soundForRarity(top.rarity));
        if (top?.rarity === "CHASE") fireConfetti("chase");
        else if (top?.rarity === "SECRET_RARE") fireConfetti("secret", 0.7);
        finishRip(res);
      } else {
        playSound("tear");
        setPhase("tearing");
        await sleep(950);
        setPhase("reveal");
      }
    } catch (error) {
      if (error instanceof ApiError) pendingKey.current = null; // Definitive server answer.
      playSound("error");
      toast.error(error instanceof Error ? error.message : "Could not open the pack.");
      setPhase("ready");
    }
  }

  const reveal = useCallback(
    (pull: PulledCard, key: string) => {
      setRevealed((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      playSound(soundForRarity(pull.rarity));
      if (pull.rarity === "CHASE") {
        setTimeout(() => setCelebrating(pull), 500);
      } else if (pull.rarity === "SECRET_RARE") {
        fireConfetti("secret", multi ? 0.5 : 0.8);
      } else if (pull.rarity === "ULTRA_RARE" && !multi) {
        fireConfetti("gold", 0.35);
      }
    },
    [multi],
  );

  async function revealAll() {
    if (revealingAll) return;
    setRevealingAll(true);
    cancelReveal.current = false;
    for (const { pull, key } of allPulls) {
      if (cancelReveal.current) break;
      if (revealed.has(key)) continue;
      reveal(pull, key);
      if (pull.rarity === "CHASE") {
        await new Promise<void>((resolve) => (celebrationDone.current = resolve));
      } else {
        await sleep(multi ? (rarityRank(pull.rarity) >= 3 ? 420 : 110) : rarityRank(pull.rarity) >= 3 ? 850 : 380);
      }
    }
    setRevealingAll(false);
  }

  function closeCelebration() {
    setCelebrating(null);
    celebrationDone.current?.();
    celebrationDone.current = null;
  }

  // When everything has been revealed, surface progress notifications.
  const noticesShown = useRef<string | null>(null);
  useEffect(() => {
    if (phase === "reveal" && allRevealed && result && noticesShown.current !== result.batchId) {
      noticesShown.current = result.batchId;
      finishRip(result);
    }
  }, [phase, allRevealed, result, finishRip]);

  // Keyboard: space reveals the next card / opens the pack.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (celebrating || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (phase === "ready") void tear();
        else if (phase === "reveal") {
          const next = allPulls.find((p) => !revealed.has(p.key));
          if (next) reveal(next.pull, next.key);
          else setPhase("summary");
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const quickSellable = useMemo(
    () =>
      result
        ? result.packs.flatMap((p) => p.cards).filter((c) => !c.isNew && c.userCardId && !sold.has(c.userCardId) && (c.rarity === "COMMON" || c.rarity === "UNCOMMON"))
        : [],
    [result, sold],
  );
  const quickSellTotal = quickSellable.reduce((s, c) => s + Math.max(1, Math.floor((c.card.currentValue * instantSellBps) / 10_000)), 0);

  async function quickSell() {
    if (!quickSellable.length) return;
    setSelling(true);
    try {
      const res = await api<{ sold: number; total: number; balance: number; notices: OpenResult["notices"] }>("/api/collection/sell", {
        body: { userCardIds: quickSellable.map((c) => c.userCardId) },
      });
      setBalance(res.balance);
      setSold((prev) => new Set([...prev, ...quickSellable.map((c) => c.userCardId!)]));
      playSound("coin");
      toast.success(`Sold ${res.sold} cards for ${res.total.toLocaleString()} RC`);
      showNotices(res.notices);
      queryClient.invalidateQueries({ queryKey: ["collection"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sale failed");
    } finally {
      setSelling(false);
    }
  }

  function openAgain(q: Qty) {
    setQty(q);
    setUseVoucher(false);
    setPhase("ready");
    void tear(q, false);
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,.18),transparent_70%)]" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="flex items-center justify-between gap-3 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/packs/${pack.slug}`}>
              <ArrowLeft /> {pack.name}
            </Link>
          </Button>
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Info /> Odds
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(92vw,420px)]" align="end">
                <p className="mb-2 text-sm font-semibold">Published odds — {pack.name}</p>
                <OddsTable odds={pack.odds} cardsPerPack={pack.cardsPerPack} compact />
                <p className="mt-2 text-xs text-muted-foreground">Results are decided on the server before any animation plays.</p>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon-sm" onClick={toggleMuted} aria-label={muted ? "Unmute sounds" : "Mute sounds"} aria-pressed={muted}>
              {muted ? <VolumeX /> : <Volume2 />}
            </Button>
            <div className="ml-1 flex items-center gap-2 rounded-lg border px-2 py-1">
              <Switch id="skip" checked={skipAnimations} onCheckedChange={setSkipAnimations} />
              <Label htmlFor="skip" className="text-xs">
                <FastForward className="size-3.5" /> Skip
              </Label>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {(phase === "ready" || phase === "charging" || phase === "tearing") && (
            <motion.div key="stage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
              <PackStage theme={pack.theme} name={pack.name} cards={pack.cardsPerPack} phase={phase} onTear={() => void tear()} disabled={!pack.isActive} />
              <div className="mt-2 flex w-full max-w-md flex-col items-center gap-4">
                {phase === "ready" ? (
                  <>
                    <div className="grid w-full grid-cols-3 gap-2" role="radiogroup" aria-label="Number of packs">
                      {([1, 5, 10] as const).map((q) => (
                        <button
                          key={q}
                          role="radio"
                          aria-checked={!useVoucher && qty === q}
                          onClick={() => {
                            setUseVoucher(false);
                            setQty(q);
                            playSound("click");
                          }}
                          className={cn(
                            "rounded-xl border px-3 py-2.5 text-center transition-colors",
                            !useVoucher && qty === q ? "border-violet-400/60 bg-violet-500/15" : "hover:bg-white/[0.04]",
                          )}
                        >
                          <span className="block font-display text-lg font-bold">{q}×</span>
                          <RC amount={pack.price * q} compact className="text-xs text-amber-200/90" />
                        </button>
                      ))}
                    </div>
                    {vouchers > 0 && (
                      <button
                        onClick={() => setUseVoucher((v) => !v)}
                        aria-pressed={useVoucher}
                        className={cn(
                          "flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                          useVoucher ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100" : "border-dashed text-emerald-200 hover:bg-emerald-500/10",
                        )}
                      >
                        <Gift className="size-4" /> {useVoucher ? "Using a free voucher" : `Use a free voucher (${vouchers} available)`}
                      </button>
                    )}
                    <Button size="xl" className="w-full" onClick={() => void tear()} disabled={!pack.isActive || (!useVoucher && !canAfford(qty))}>
                      <Sparkles /> {useVoucher ? "Tear open for free" : `Tear open · ${cost.toLocaleString()} RC`}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      {!useVoucher && !canAfford(qty) ? (
                        <>
                          Not enough Rip Coins.{" "}
                          <Link href="/rewards" className="text-violet-300 underline-offset-2 hover:underline">
                            Earn more for free
                          </Link>
                          .
                        </>
                      ) : (
                        <>Tap the pack, swipe across the tear line, or press Space.</>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                    <LoaderCircle className="size-4 animate-spin" /> {phase === "charging" ? "Drawing your cards securely…" : "Ripping!"}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {phase === "reveal" && result && (
            <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8 pb-24">
              <div className="flex flex-col items-center gap-1 text-center">
                <p className="font-display text-2xl font-bold">{allRevealed ? "All cards revealed!" : "Tap each card to reveal"}</p>
                <p className="text-sm text-muted-foreground">
                  {revealed.size}/{allPulls.length} revealed
                </p>
              </div>
              <div className={cn(multi && "grid gap-x-8 gap-y-6 lg:grid-cols-2")}>
                {ordered.map((p, i) => (
                  <div key={p.openingId} className={cn("space-y-2", multi && "rounded-2xl border bg-white/[0.02] p-3")}>
                    {multi && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pack {i + 1}</p>}
                    <div
                      className={cn(
                        "mx-auto grid",
                        multi ? "gap-2 sm:gap-3" : "gap-4",
                        multi ? "grid-cols-5" : p.cards.length <= 3 ? "max-w-3xl grid-cols-3" : "max-w-5xl grid-cols-3 md:grid-cols-5",
                      )}
                    >
                      {p.cards.map((c, j) => {
                        const key = keyOf(p.openingId, c.slot);
                        return <FlipCard key={key} pull={c} index={j} total={p.cards.length} revealed={revealed.has(key)} onReveal={() => reveal(c, key)} compact={multi} />;
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="fixed inset-x-0 bottom-16 z-30 flex justify-center px-4 md:bottom-6">
                <div className="glass flex items-center gap-2 rounded-2xl border p-2 shadow-2xl">
                  {!allRevealed && (
                    <Button onClick={() => void revealAll()} disabled={revealingAll}>
                      <Sparkles /> Reveal all
                    </Button>
                  )}
                  <Button
                    variant={allRevealed ? "default" : "outline"}
                    onClick={() => {
                      cancelReveal.current = true;
                      if (!allRevealed) {
                        setRevealed(new Set(allPulls.map((p) => p.key)));
                        if (noticesShown.current !== result.batchId) {
                          noticesShown.current = result.batchId;
                          finishRip(result);
                        }
                      }
                      setPhase("summary");
                    }}
                  >
                    {allRevealed ? "View summary" : "Skip to summary"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {phase === "summary" && result && (
            <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RipSummary
                result={result}
                sold={sold}
                quickSellable={quickSellable}
                quickSellTotal={quickSellTotal}
                onQuickSell={() => void quickSell()}
                selling={selling}
                onOpenAgain={openAgain}
                opening={false}
                canAfford={canAfford}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>{celebrating && <ChaseCelebration key="chase" pull={celebrating} onClose={closeCelebration} />}</AnimatePresence>
    </div>
  );
}
