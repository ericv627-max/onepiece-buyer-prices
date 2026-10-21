import Link from "next/link";
import { BUYER_MAX_PERCENT, BUYER_MIN_PERCENT, getProducts, getSets } from "@/lib/data";
import { BRAND } from "@/lib/brand";

// Home is laid out like a landing page: a line of news, the slogan, what the site does, two ways in, and
// three numbers. Searching lives on the Products page (and the search button in the top bar).
export default function Home() {
  const products = getProducts().length;
  const sets = getSets().length;
  const low = Math.round(BUYER_MIN_PERCENT * 100);
  const high = Math.round(BUYER_MAX_PERCENT * 100);
  return (
    <section className="hero" aria-labelledby="home-title">
      <Link href="/portfolio" className="hero-pill">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 2l1.9 5.6L17.5 9.5l-5.6 1.9L10 17l-1.9-5.6L2.5 9.5l5.6-1.9z" />
          <path d="M19 13l.9 2.6 2.6.9-2.6.9L19 20l-.9-2.6-2.6-.9 2.6-.9z" />
        </svg>
        <span>New:</span> Portfolio value graph
      </Link>
      <h1 id="home-title" className="hero-title">Price it. Stack it. <em>Flip it.</em></h1>
      <p className="hero-sub">
        {BRAND} shows what a buyer should offer for every One Piece card and sealed product, priced daily from TCGplayer.
      </p>
      <div className="hero-actions">
        <Link href="/products" className="btn primary lg">Browse products</Link>
        <Link href="/portfolio" className="btn white lg">Open my portfolio</Link>
      </div>
      <ul className="hero-stats" aria-label={`${BRAND} at a glance`}>
        <li><b>{products.toLocaleString("en-US")}</b><span>Products tracked</span></li>
        <li><b>{sets}</b><span>Sets and releases</span></li>
        <li><b>{low}–{high}%</b><span>Typical buyer offer</span></li>
      </ul>
    </section>
  );
}
