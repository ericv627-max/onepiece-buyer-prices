import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Portfolio" };

// The portfolio needs accounts so holdings, purchase prices and daily
// snapshots are kept safely. Until sign-in exists, say so plainly.
export default function PortfolioPage() {
  return (
    <>
      <header className="page-head">
        <h1>Portfolio</h1>
        <p>Track the cards and sealed products you own, what you paid, and what they’re worth.</p>
      </header>
      <div className="state panel coming">
        <b>Coming with Google sign-in.</b>
        <p>Your holdings, purchase prices and a daily record of your portfolio’s value will be saved to your account, so they’re never lost when a browser is cleared. That’s the next step being built.</p>
        <p>Planned: Products, Holdings breakdown, Most valuable and Trending today tabs, plus a value graph that only shows days that were really recorded.</p>
        <div className="actions"><Link href="/wishlist" className="btn">Go to your wishlist</Link><Link href="/products" className="btn primary">Browse products</Link></div>
      </div>
    </>
  );
}
