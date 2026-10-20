import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { RatesProvider } from "@/components/money";
import { getMeta } from "@/lib/data";

export const metadata: Metadata = {
  title: { default: "VENDR · Price it. Stack it. Flip it.", template: "%s · VENDR" },
  description: "One Piece Card Game prices, sets and sealed products, updated daily from TCGplayer.",
  openGraph: { title: "VENDR · Price it. Stack it. Flip it.", description: "One Piece Card Game prices, sets and sealed products, updated daily." },
};

export const viewport: Viewport = { themeColor: "#06060c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const meta = getMeta();
  return (
    // suppressHydrationWarning: browser extensions sometimes add attributes to <html> before React loads.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbitron:wght@900&family=Chakra+Petch:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" />
      </head>
      <body>
        <div className="aurora" aria-hidden="true"><span /><span /><span /></div>
        <RatesProvider value={{ date: meta.rates?.date ?? null, rates: meta.rates?.rates ?? {} }}>
          <a href="#main" className="skip">Skip to content</a>
          <Nav />
          <main id="main" className="wrap">{children}</main>
          <footer className="wrap footer">
            VENDR · Prices from TCGplayer via tcgcsv.com, updated daily
            {meta.updatedAt ? ` (last ${meta.updatedAt.replace("T", " ").slice(0, 16)} UTC)` : ""}. Mostly English-language products. Not affiliated with TCGplayer or Bandai.
          </footer>
        </RatesProvider>
      </body>
    </html>
  );
}
