import type { Metadata } from "next";
import { PackOpener } from "@/components/opening/pack-opener";
import { orNotFound } from "@/server/page-helpers";
import { getPackDetail } from "@/server/services/packs";
import { getSettings } from "@/server/services/settings";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const { pack } = await getPackDetail(id);
    return { title: `Open ${pack.name}` };
  } catch {
    return { title: "Open pack" };
  }
}

export default async function OpenPackPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ qty?: string }> }) {
  const [{ id }, { qty }] = await Promise.all([params, searchParams]);
  await requireUser(`/open/${id}`);
  const detail = await orNotFound(getPackDetail(id));
  const { economy } = await getSettings();
  const initialQty = qty === "10" ? 10 : qty === "5" ? 5 : 1;
  const p = detail.pack;
  return (
    <PackOpener
      pack={{ id: p.id, slug: p.slug, name: p.name, price: p.price, cardsPerPack: p.cardsPerPack, theme: p.theme, isActive: p.isActive, odds: p.odds }}
      initialQty={initialQty}
      instantSellBps={economy.instantSellBps}
    />
  );
}
