import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Providers } from "@/components/providers";
import { getWalletState } from "@/server/services/session-state";
import { getSettings } from "@/server/services/settings";
import { getSessionUser } from "@/server/session";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "RipVault — Virtual Pokémon Card Rips", template: "%s · RipVault" },
  description:
    "Open virtual Pokémon card packs, build your collection and trade on a fictional-currency marketplace. Rip Coins have no real-world value.",
  applicationName: "RipVault",
};

export const viewport: Viewport = {
  themeColor: "#121218",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const [wallet, { economy }] = await Promise.all([user ? getWalletState(user.id) : null, getSettings()]);
  return (
    <html lang="en" className={`dark ${inter.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <Providers user={user} initialWallet={wallet} config={{ instantSellBps: economy.instantSellBps, marketplaceFeeBps: economy.marketplaceFeeBps }}>
          <div className="pointer-events-none fixed inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
          <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_at_top,oklch(0.62_0.24_293/18%),transparent_65%)]" />
          <SiteHeader />
          <main id="main" className="min-h-[60vh]">
            {children}
          </main>
          <SiteFooter />
          <MobileTabBar />
        </Providers>
      </body>
    </html>
  );
}
