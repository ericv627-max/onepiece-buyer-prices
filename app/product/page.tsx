import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductView } from "@/components/product-view";

export const metadata: Metadata = { title: "Product" };

// Every card and sealed product opens here: /product?id=<product id>.
export default function ProductPage() {
  return (
    <Suspense fallback={<div className="state" aria-busy="true">Loading product…</div>}>
      <ProductView />
    </Suspense>
  );
}
