"use client";
import Link from "next/link";
import { fromCents, type Valued } from "@/lib/portfolio";
import { ChangeTag, Money } from "./money";
import { ProductImage } from "./product-image";
import { productHref } from "./product-views";

function statusText(v: Valued) {
  return v.status === "missing" ? "No longer listed by TCGplayer" : "No market price yet";
}

// What the owner needs to see per product: how many, price each, total.
export function HoldingCard({ v, onManage }: { v: Valued; onManage: (productId: string) => void }) {
  const p = v.product;
  return (
    <article className="pcard holding">
      {p ? (
        <Link href={productHref(p)} className="pcard-link">
          <div className="pcard-img"><ProductImage src={p.image} /><span className="qty-badge" aria-label={`${v.qty} owned`}>×{v.qty}</span></div>
          <span className="pname">{p.name}</span>
        </Link>
      ) : (
        <div className="pcard-link"><div className="pcard-img"><span className="noimg">No image</span><span className="qty-badge">×{v.qty}</span></div><span className="pname">Product {v.productId}</span></div>
      )}
      {p && <Link href={`/sets/${p.setSlug}`} className="pset">{p.set}</Link>}
      <span className="pmeta">{p ? `${p.language} · ${p.type}` : "Not in today’s listing"}</span>
      {v.status === "priced" ? (
        <>
          <div className="pprice">
            <span className="market"><Money usd={fromCents(v.valueCents!)} /></span>
            {p && <ChangeTag change={p.change} />}
          </div>
          <span className="pmeta">{v.qty} × <Money usd={fromCents(v.unitCents!)} /> each</span>
        </>
      ) : (
        <p className="unpriced">{statusText(v)}. Not counted in your total.</p>
      )}
      <button type="button" className="btn small" onClick={() => onManage(v.productId)}>Edit or remove</button>
    </article>
  );
}

export function HoldingList({ items, onManage, ranked }: { items: Valued[]; onManage?: (productId: string) => void; ranked?: boolean }) {
  return (
    <div className="plist hlist" role="table" aria-label="Holdings">
      <div className="prow head" role="row">
        {ranked ? <span role="columnheader">Rank</span> : <span role="columnheader" aria-label="Picture" />}
        <span role="columnheader">Product</span>
        <span role="columnheader">Language</span>
        <span role="columnheader">Owned</span>
        <span role="columnheader">Each</span>
        <span role="columnheader">Total value</span>
        <span role="columnheader">Change</span>
        <span role="columnheader" aria-label="Actions" />
      </div>
      {items.map((v, i) => {
        const p = v.product;
        return (
          <div className="prow" role="row" key={v.productId}>
            {ranked ? <span className="rank" role="cell">{i + 1}</span> : (
              <span className="prow-img" role="cell" aria-hidden="true">{p && <ProductImage src={p.image} />}</span>
            )}
            <div className="prow-name" role="cell">
              {p ? <Link href={productHref(p)} className="pname">{p.name}</Link> : <span className="pname">Product {v.productId}</span>}
              <span className="pmeta">{p ? <><Link href={`/sets/${p.setSlug}`} className="inline-link">{p.set}</Link> · {p.type}</> : "Not in today’s listing"}</span>
            </div>
            <span className="cell-muted" role="cell">{p?.language ?? "—"}</span>
            <span role="cell">×{v.qty}</span>
            <span role="cell">{v.status === "priced" ? <Money usd={fromCents(v.unitCents!)} /> : "—"}</span>
            <span className="market" role="cell">{v.status === "priced" ? <Money usd={fromCents(v.valueCents!)} /> : <span className="unpriced">{statusText(v)}</span>}</span>
            <span role="cell">{p && v.status === "priced" ? <ChangeTag change={p.change} /> : null}</span>
            <span role="cell">{onManage && <button type="button" className="btn small" onClick={() => onManage(v.productId)}>Edit</button>}</span>
          </div>
        );
      })}
    </div>
  );
}
