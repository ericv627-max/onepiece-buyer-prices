import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./portfolio.css";
import { AddressMove } from "@/components/address-move";
import { Flow } from "@/components/flow";
import { Nav } from "@/components/nav";
import { RatesProvider } from "@/components/money";
import { getMeta } from "@/lib/data";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: `${BRAND} · One Piece card prices`, template: `%s · ${BRAND}` },
  description: "One Piece Card Game prices, sets and sealed products, updated daily from TCGplayer.",
  openGraph: { title: `${BRAND} · Price it. Stack it. Flip it.`, description: "One Piece Card Game prices, sets and sealed products, updated daily." },
};

export const viewport: Viewport = { themeColor: "#030a14", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const meta = getMeta();
  return (
    // suppressHydrationWarning: browser extensions sometimes add attributes to <html> before React loads.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@1&display=swap" />
      </head>
      <body>
        <AddressMove />
        <Flow />
        <RatesProvider value={{ date: meta.rates?.date ?? null, rates: meta.rates?.rates ?? {} }}>
          <a href="#main" className="skip">Skip to content</a>
          <Nav />
          <main id="main" className="wrap">{children}</main>
          <footer className="wrap footer">
            {BRAND} · Prices from TCGplayer via tcgcsv.com, updated daily
            {meta.updatedAt ? ` (last ${meta.updatedAt.replace("T", " ").slice(0, 16)} UTC)` : ""}. Mostly English-language products. Not affiliated with TCGplayer or Bandai.
          </footer>
        </RatesProvider>
      </body>
    </html>
  );
}
