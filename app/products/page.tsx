import type { Metadata } from "next";
import { Suspense } from "react";
import { Browser } from "@/components/browser";
import { SHOW_SEALED } from "@/lib/brand";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <>
      <header className="page-head">
        <h1>Products</h1>
        <p>{SHOW_SEALED ? "Single cards and sealed products." : "Every single card."} Prices are TCGplayer market prices in your chosen currency.</p>
      </header>
      <Suspense fallback={<div className="state">Loading products…</div>}>
        <Browser mode="products" />
      </Suspense>
    </>
  );
}
