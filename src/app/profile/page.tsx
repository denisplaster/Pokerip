import type { Metadata } from "next";
import { Container, SectionHeading } from "@/components/common/page-header";
import { FictionalNote } from "@/components/common/fictional-note";
import { ProfileView } from "@/components/profile/profile-view";
import { WalletLedger } from "@/components/profile/wallet-ledger";
import { getProfile } from "@/server/services/profiles";
import { getWalletSummary } from "@/server/services/wallet";
import { requireUser } from "@/server/session";
import { RC } from "@/components/common/coin-icon";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const [profile, wallet] = await Promise.all([getProfile(user.username, user.id), getWalletSummary(user.id)]);
  return (
    <Container>
      <ProfileView profile={profile} />
      <section id="wallet" className="mt-10 scroll-mt-24">
        <SectionHeading title="Wallet" description="Your Rip Coin ledger. Every change is recorded with the balance before and after." />
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Balance</p>
            <RC amount={wallet.balance} className="mt-1 text-xl text-amber-100" />
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Lifetime earned</p>
            <RC amount={wallet.lifetimeEarned} className="mt-1 text-xl text-emerald-200" />
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Lifetime spent</p>
            <RC amount={wallet.lifetimeSpent} className="mt-1 text-xl text-rose-200" />
          </div>
        </div>
        <WalletLedger />
        <FictionalNote className="mt-3" />
      </section>
    </Container>
  );
}
