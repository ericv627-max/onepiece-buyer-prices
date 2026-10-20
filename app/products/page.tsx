import type { Metadata } from "next";
import { Suspense } from "react";
import { Browser } from "@/components/browser";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <>
      <header className="page-head">
        <h1>Products</h1>
        <p>Single cards and sealed products. Prices are TCGplayer market prices in your chosen currency.</p>
      </header>
      <Suspense fallback={<div className="state">Loading products…</div>}>
        <Browser mode="products" />
      </Suspense>
    </>
  );
}
