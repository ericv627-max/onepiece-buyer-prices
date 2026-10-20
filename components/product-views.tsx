"use client";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { RARITY_NAMES } from "@/lib/format";
import { ChangeTag, Money, Range } from "./money";
import { Heart } from "./heart";
import { ProductImage } from "./product-image";

export function productHref(p: Product) {
  return `/product?id=${encodeURIComponent(p.id)}`;
}

function details(p: Product) {
  return p.kind === "sealed"
    ? [p.type]
    : [p.rarity ? RARITY_NAMES[p.rarity] ?? p.rarity : null, p.number, p.printing !== "Regular" ? p.printing : null, p.foil ? "Foil" : null];
}

// Grid view: picture first.
export function ProductCard({ p }: { p: Product }) {
  return (
    <article className="pcard">
      <Link href={productHref(p)} className="pcard-link">
        <div className="pcard-img">
          <ProductImage src={p.image} />
          <span className="lang" title={p.language}>{p.language === "English" ? "EN" : p.language.slice(0, 2).toUpperCase()}</span>
        </div>
        <span className="pname">{p.name}</span>
      </Link>
      <Link href={`/sets/${p.setSlug}`} className="pset">{p.set}</Link>
      <span className="pmeta">{details(p).filter(Boolean).join(" · ")}</span>
      <div className="pprice">
        <span className="market"><Money usd={p.market} /></span>
        <ChangeTag change={p.change} />
      </div>
      <div className="pfoot">
        <span className="offer" title="What a buyer pays: 80–90% of the lowest listing">Buyer <Range min={p.buyerMin} max={p.buyerMax} /></span>
        <Heart id={p.id} name={p.name} />
      </div>
    </article>
  );
}

// List view: compact rows.
export function ProductRow({ p }: { p: Product }) {
  return (
    <div className="prow" role="row">
      <Link href={productHref(p)} className="prow-img" role="cell" tabIndex={-1} aria-hidden="true">
        <ProductImage src={p.image} />
      </Link>
      <div className="prow-name" role="cell">
        <Link href={productHref(p)} className="pname">{p.name}</Link>
        <span className="pmeta">{details(p).filter(Boolean).join(" · ")}</span>
      </div>
      <Link href={`/sets/${p.setSlug}`} className="pset" role="cell">{p.set}</Link>
      <span className="cell-muted" role="cell">{p.language}</span>
      <span className="cell-muted" role="cell">{p.type}</span>
      <span className="market" role="cell"><Money usd={p.market} /></span>
      <span role="cell"><ChangeTag change={p.change} /></span>
      <span role="cell"><Heart id={p.id} name={p.name} /></span>
    </div>
  );
}

export function ProductList({ items }: { items: Product[] }) {
  return (
    <div className="plist" role="table" aria-label="Products">
      <div className="prow head" role="row">
        <span role="columnheader" aria-label="Picture" />
        <span role="columnheader">Product</span>
        <span role="columnheader">Set</span>
        <span role="columnheader">Language</span>
        <span role="columnheader">Type</span>
        <span role="columnheader">Market</span>
        <span role="columnheader">Change</span>
        <span role="columnheader" aria-label="Wishlist" />
      </div>
      {items.map(p => <ProductRow key={p.id} p={p} />)}
    </div>
  );
}
