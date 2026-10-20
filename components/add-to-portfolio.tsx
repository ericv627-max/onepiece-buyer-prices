"use client";
import type { Product } from "@/lib/types";

// Placeholder until the portfolio is built.
export function AddToPortfolio({ product }: { product: Product }) {
  return <button type="button" className="btn" disabled title={`Portfolio is coming soon (${product.name})`}>Add to portfolio · soon</button>;
}
