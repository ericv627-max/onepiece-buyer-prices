import Link from "next/link";
import { BUYER_MAX_PERCENT, BUYER_MIN_PERCENT, getMeta, getProducts } from "@/lib/data";
import { BRAND, SHOW_SEALED } from "@/lib/brand";
import { shortDate } from "@/lib/format";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n >= 100 ? 0 : 2 });

// Home is laid out like a landing page, but it has to say at first glance what the site is (One Piece card prices),
// show one real price, and let a returning visitor search straight away.
export default function Home() {
  const products = getProducts().filter(p => SHOW_SEALED || p.kind !== "sealed");
  const meta = getMeta();
  const updatedDay = meta.updated ? new Date(meta.updated + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "daily";
  const low = Math.round(BUYER_MIN_PERCENT * 100);
  const high = Math.round(BUYER_MAX_PERCENT * 100);
  // One real example that teaches the idea at a glance: a well-known card whose buyer offer sits under its
  // market price, as it usually does. (Rare cards with a thin listing can have a lowest listing far above
  // market, which would make the offer look larger than the price.)
  const example = products
    .filter(p => p.kind === "card" && p.market != null && p.market < 500 && p.buyerMin != null && p.buyerMax != null && p.buyerMax <= p.market)
    .sort((a, b) => (b.market ?? 0) - (a.market ?? 0))[0];
  return (
    <section className="hero" aria-labelledby="home-title">
      <Link href="/products" className="hero-pill">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 2l1.9 5.6L17.5 9.5l-5.6 1.9L10 17l-1.9-5.6L2.5 9.5l5.6-1.9z" />
          <path d="M19 13l.9 2.6 2.6.9-2.6.9L19 20l-.9-2.6-2.6-.9 2.6-.9z" />
        </svg>
        <span>One Piece TCG</span> Prices updated {updatedDay}
      </Link>
      <h1 id="home-title" className="hero-title">Price it. Stack it. <em>Flip it.</em></h1>
      <p className="hero-sub">
        What a buyer should offer for every One Piece card{SHOW_SEALED ? " and sealed product" : ""}, priced daily from TCGplayer.
      </p>
      <div className="hero-actions">
        <form action="/products" method="get" className="hero-search" role="search">
          <label htmlFor="hero-q" className="sr-only">Search cards</label>
          <input id="hero-q" name="q" type="search" placeholder="Search a card, like Luffy OP05" autoComplete="off" />
          <button type="submit" className="btn primary lg">Search prices</button>
        </form>
        <Link href="/portfolio" className="btn white lg">Open my portfolio</Link>
      </div>
      {example && (
        <Link href={`/product?id=${encodeURIComponent(example.id)}`} className="hero-example">
          <span>For example</span> {example.name}{example.number && !example.name.includes(example.number) ? ` ${example.number}` : ""}
          {" · "}market {usd(example.market!)}{" · "}<b>buyer offers {usd(example.buyerMin!)}–{usd(example.buyerMax!)}</b>
        </Link>
      )}
      <ul className="hero-stats" aria-label={`${BRAND} at a glance`}>
        <li><b>{products.length.toLocaleString("en-US")}</b><span>{SHOW_SEALED ? "Cards and sealed products" : "Cards tracked"}</span></li>
        <li><b>Daily</b><span>Last update {shortDate(meta.updated)}</span></li>
        <li><b>{low}–{high}%</b><span>of the lowest TCGplayer listing</span></li>
      </ul>
    </section>
  );
}
