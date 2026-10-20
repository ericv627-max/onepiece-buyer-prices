import { Suspense } from "react";
import { Browser } from "@/components/browser";

// Home: the logo, a big search, and categories. Results appear as you type.
export default function Home() {
  return (
    <section className="home" aria-labelledby="home-title">
      <h1 id="home-title" className="hero-logo">VENDR<span>Price it. Stack it. Flip it.</span></h1>
      <p className="hero-sub">Every One Piece card and sealed product, priced daily from TCGplayer.</p>
      <Suspense fallback={<div className="state">Loading search…</div>}>
        <Browser mode="home" />
      </Suspense>
    </section>
  );
}
