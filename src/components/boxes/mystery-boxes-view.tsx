"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Coins, Gift, Info, Layers, LoaderCircle, PackageOpen, Sparkles, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AnimatedNumber } from "@/components/common/animated-number";
import { CoinIcon, RC } from "@/components/common/coin-icon";
import { PokeCard } from "@/components/cards/poke-card";
import { RarityBadge } from "@/components/cards/rarity-badge";
import { TiltCard } from "@/components/cards/tilt-card";
import { Burst } from "@/components/opening/burst";
import { PackArt } from "@/components/packs/pack-art";
import { useUser } from "@/components/providers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useShowNotices } from "@/hooks/use-notices";
import { useSetBalance, useWallet } from "@/hooks/use-wallet";
import { api, ApiError, newIdempotencyKey } from "@/lib/api-client";
import { fireConfetti } from "@/lib/confetti";
import { formatOneIn, formatProbability } from "@/lib/format";
import { rarityRank } from "@/lib/rarity";
import { playSound, soundForRarity } from "@/lib/sound";
import { cn, sleep } from "@/lib/utils";
import type { BoxOpenResult, BoxRewardView, BoxView } from "@/server/services/mystery-boxes";
import { BoxArt } from "./box-art";
import { CollectibleBadge } from "./collectible-badge";

const TYPE_ICON = { COINS: Coins, CARD: Layers, CARD_BUNDLE: Layers, PACK_VOUCHER: Gift, COLLECTIBLE: Trophy } as const;

export function MysteryBoxesView({ boxes }: { boxes: BoxView[] }) {
  const user = useUser();
  const { data: wallet } = useWallet(Boolean(user));
  const setBalance = useSetBalance();
  const showNotices = useShowNotices();
  const qc = useQueryClient();
  const [oddsFor, setOddsFor] = useState<BoxView | null>(null);
  const [session, setSession] = useState<{ box: BoxView; phase: "shaking" | "revealed"; result?: BoxOpenResult } | null>(null);
  const pendingKey = useRef<string | null>(null);

  async function open(box: BoxView) {
    if (!user) return;
    if ((wallet?.balance ?? 0) < box.price) {
      playSound("error");
      return toast.error("Not enough Rip Coins", { description: "Claim daily rewards and missions to earn more for free." });
    }
    setSession({ box, phase: "shaking" });
    playSound("whoosh");
    const idempotencyKey = pendingKey.current ?? newIdempotencyKey();
    pendingKey.current = idempotencyKey;
    try {
      const [result] = await Promise.all([api<BoxOpenResult>(`/api/mystery-boxes/${box.slug}/open`, { body: { idempotencyKey } }), sleep(1300)]);
      pendingKey.current = null;
      setBalance(result.balance);
      setSession({ box, phase: "revealed", result });
      playSound(soundForRarity(result.reward.rarity));
      if (result.reward.rarity === "CHASE") fireConfetti("chase");
      else if (result.reward.rarity === "SECRET_RARE" || result.value >= box.price * 3) fireConfetti("secret", 0.8);
      else if (result.value >= box.price) fireConfetti("gold", 0.5);
      showNotices(result.notices);
      for (const k of ["wallet", "collection", "missions"]) qc.invalidateQueries({ queryKey: [k] });
    } catch (e) {
      if (e instanceof ApiError) pendingKey.current = null;
      playSound("error");
      toast.error(e instanceof Error ? e.message : "Could not open the box");
      setSession(null);
    }
  }

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {boxes.map((box) => {
          const top = [...box.rewards].sort((a, b) => b.value - a.value)[0];
          return (
            <motion.article key={box.id} whileHover={{ y: -6 }} className="group surface flex flex-col overflow-hidden rounded-2xl border bg-card">
              <div className="relative px-10 pt-6">
                {box.featured && <Badge variant="gold" className="absolute left-4 top-4">Featured</Badge>}
                <div className="transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-2">
                  <BoxArt theme={box.theme} />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-lg font-bold">{box.name}</h2>
                    <RC amount={box.price} className="text-lg text-amber-200" />
                  </div>
                  <p className="text-sm text-muted-foreground">{box.tagline}</p>
                </div>
                <p className="text-xs text-muted-foreground">{box.description}</p>
                {top && (
                  <div className="rounded-xl bg-white/[0.04] p-3 text-xs">
                    <p className="text-muted-foreground">Top reward</p>
                    <p className="flex items-center justify-between gap-2 font-semibold">
                      <span className="truncate">{top.label}</span>
                      <span className="shrink-0 tabular text-cyan-200">{formatProbability(top.probability)}</span>
                    </p>
                  </div>
                )}
                <div className="mt-auto flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setOddsFor(box)}>
                    <Info /> Odds
                  </Button>
                  {user ? (
                    <Button className="flex-[1.4]" onClick={() => void open(box)} disabled={!box.isActive || session !== null}>
                      <Gift /> Open
                    </Button>
                  ) : (
                    <Button className="flex-[1.4]" asChild>
                      <Link href="/login?callbackUrl=/mystery-boxes">Sign in to open</Link>
                    </Button>
                  )}
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>

      <Dialog open={Boolean(oddsFor)} onOpenChange={(o) => !o && setOddsFor(null)}>
        <DialogContent className="sm:max-w-2xl">
          {oddsFor && (
            <>
              <DialogHeader>
                <DialogTitle>{oddsFor.name} — published odds</DialogTitle>
                <DialogDescription>
                  Exact probabilities (odds v{oddsFor.oddsVersion}). Expected value ≈ {oddsFor.expectedValue.toLocaleString()} RC at current fictional values.
                </DialogDescription>
              </DialogHeader>
              <OddsList rewards={oddsFor.rewards} />
            </>
          )}
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {session && (
          <motion.div
            key="box-overlay"
            className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Opening ${session.box.name}`}
          >
            <div className="relative flex w-full max-w-2xl flex-col items-center gap-6 py-8">
              {session.phase === "revealed" && (
                <Button variant="ghost" size="icon" className="absolute right-0 top-0" onClick={() => setSession(null)} aria-label="Close">
                  <X />
                </Button>
              )}
              <div className="relative w-48 sm:w-56">
                <div className={cn(session.phase === "shaking" && "animate-shake")}>
                  <BoxArt theme={session.box.theme} open={session.phase === "revealed"} />
                </div>
                {session.phase === "revealed" && <Burst colors={["#fde68a", "#a78bfa", "#22d3ee", "#ffffff"]} count={36} distance={200} />}
              </div>
              {session.phase === "shaking" ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                  <LoaderCircle className="size-4 animate-spin" /> Unlocking your {session.box.name}…
                </p>
              ) : (
                session.result && <Reveal result={session.result} onAgain={() => void open(session.box)} onClose={() => setSession(null)} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function OddsList({ rewards }: { rewards: BoxRewardView[] }) {
  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-xl border">
      <ul className="divide-y">
        {rewards.map((r) => {
          const Icon = TYPE_ICON[r.type];
          return (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.type === "COLLECTIBLE" && r.collectible
                    ? r.collectible.remaining === null
                      ? "Unlimited supply"
                      : `${r.collectible.remaining.toLocaleString()} of ${r.collectible.maxSupply?.toLocaleString()} left · if sold out you receive ${r.fallbackCoins?.toLocaleString()} RC`
                    : r.cards.length
                      ? r.cards.map((c) => `${c.card.name}${c.quantity > 1 ? ` ×${c.quantity}` : ""}`).join(", ")
                      : r.type === "PACK_VOUCHER"
                        ? "One free pack voucher"
                        : "Rip Coins"}
                </p>
              </div>
              <RarityBadge rarity={r.rarity} short />
              <div className="w-24 text-right">
                <p className="font-semibold tabular">{formatProbability(r.probability)}</p>
                <p className="text-[10px] text-muted-foreground tabular">{formatOneIn(r.probability)}</p>
              </div>
              <div className="hidden w-24 text-right sm:block">
                <RC amount={r.value} compact className="text-xs text-amber-200" />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Reveal({ result, onAgain, onClose }: { result: BoxOpenResult; onAgain: () => void; onClose: () => void }) {
  const { awarded, reward } = result;
  const cards = [...awarded.cards].sort((a, b) => rarityRank(a.card.rarity) - rarityRank(b.card.rarity));
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="flex w-full flex-col items-center gap-5 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">You won</p>
        <h2 className="font-display text-3xl font-bold">{reward.label}</h2>
        <div className="mt-2 flex items-center justify-center gap-2">
          <RarityBadge rarity={reward.rarity} />
          <span className="text-sm text-muted-foreground">Value</span>
          <RC amount={result.value} className="text-amber-200" />
        </div>
      </div>

      {cards.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3">
          {cards.map((c, i) => (
            <motion.div key={c.userCardId} initial={{ opacity: 0, y: 40, rotate: -8 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.3 + i * 0.12 }} className="relative w-32 sm:w-40">
              <TiltCard>
                <PokeCard card={c.card} sizes="160px" />
              </TiltCard>
              {c.isNew && <span className="absolute -left-1 -top-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-black uppercase text-emerald-950">New</span>}
            </motion.div>
          ))}
        </div>
      )}
      {awarded.collectible && (
        <div className="w-40 sm:w-48">
          <CollectibleBadge icon={awarded.collectible.icon} rarity={awarded.collectible.rarity as never} serial={awarded.collectible.serialNumber} maxSupply={awarded.collectible.maxSupply} />
          <p className="mt-2 text-sm font-semibold">{awarded.collectible.name}</p>
          <p className="text-xs text-muted-foreground">Serial #{awarded.collectible.serialNumber}{awarded.collectible.maxSupply ? ` of ${awarded.collectible.maxSupply}` : ""} — shown on your profile</p>
        </div>
      )}
      {awarded.voucherPack && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-32">
            <PackArt theme={reward.pack?.theme ?? "trainer"} name={awarded.voucherPack.name} />
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/open/${awarded.voucherPack.slug}`}>
              <PackageOpen /> Open your free {awarded.voucherPack.name}
            </Link>
          </Button>
        </div>
      )}
      {awarded.coins > 0 && (
        <p className="flex items-center gap-2 font-display text-4xl font-bold text-amber-200">
          <CoinIcon className="size-9" /> +<AnimatedNumber value={awarded.coins} duration={1.2} />
        </p>
      )}
      {awarded.usedFallback && <p className="max-w-sm text-xs text-muted-foreground">That limited collectible is sold out, so you received its published coin fallback instead.</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onAgain}>
          <Sparkles /> Open another
        </Button>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </motion.div>
  );
}
