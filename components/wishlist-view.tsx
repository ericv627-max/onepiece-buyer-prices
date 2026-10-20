"use client";
import Link from "next/link";
import { useState } from "react";
import { useIndex } from "@/lib/use-index";
import { useWishlist } from "@/lib/store";
import { matches, sortProducts, words, type SortKey } from "@/lib/search";
import { ProductCard, ProductList } from "./product-views";
import { SearchInput } from "./search-input";
import { Money } from "./money";
import type { Product } from "@/lib/types";

export function WishlistView() {
  const { data, error } = useIndex();
  const ids = useWishlist();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("price-desc");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [kind, setKind] = useState<"all" | "card" | "sealed">("all");

  if (error) return <div className="state error" role="alert">Prices couldn’t load: {error}</div>;
  if (!data) return <div className="state" aria-busy="true">Loading your wishlist…</div>;

  const byId = new Map(data.products.map(p => [p.id, p]));
  const saved = ids.map(id => byId.get(id)).filter((p): p is Product => p !== undefined);
  const gone = ids.length - saved.length; // saved items no longer in the catalog
  const w = words(q);
  const shown = sortProducts(saved.filter(p => (kind === "all" || p.kind === kind) && (!w.length || matches(p, w))), sort, false);
  const total = saved.reduce((sum, p) => sum + (p.market ?? 0), 0);
  const unpriced = saved.filter(p => p.market === null).length;

  if (!ids.length) {
    return (
      <div className="state empty">
        Nothing saved yet. Tap the ♡ on any card or sealed product to keep it here.
        <div><Link className="btn primary" href="/products">Browse products</Link></div>
      </div>
    );
  }

  return (
    <>
      <p className="count">
        <b>{saved.length}</b> saved · one of each worth <b><Money usd={total} /></b> at market price
        {unpriced ? ` (${unpriced} without a price, not counted)` : ""}
        {gone ? ` · ${gone} no longer listed by TCGplayer` : ""}
      </p>
      <div className="toolbar">
        <div className="grow"><SearchInput value={q} onChange={setQ} placeholder="Search your wishlist" label="Search your wishlist" /></div>
        <div className="quick" role="group" aria-label="Product category">
          {([["all", "All"], ["card", "Cards"], ["sealed", "Sealed"]] as const).map(([k, l]) => (
            <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>
          ))}
        </div>
        <label className="sort">Sort by
          <select value={sort} onChange={e => setSort(e.target.value as SortKey)}>
            <option value="price-desc">Price: high to low</option>
            <option value="price-asc">Price: low to high</option>
            <option value="newest">Newest release</option>
            <option value="oldest">Oldest release</option>
          </select>
        </label>
        <div className="view" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")}>Grid</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
        </div>
      </div>
      {shown.length === 0 ? <div className="state empty">Nothing in your wishlist matches that.</div>
        : view === "list" ? <ProductList items={shown} /> : <div className="grid">{shown.map(p => <ProductCard key={p.id} p={p} />)}</div>}
    </>
  );
}
