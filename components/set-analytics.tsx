"use client";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { ChangeTag, Money, useCurrency } from "./money";
import { productHref } from "./product-views";

const TABS = [["movers", "Market movers"], ["dist", "Price distribution"], ["sales", "Sales volume"], ["wish", "Most wishlisted"]] as const;

// Price bands in US dollars (labels follow the chosen currency).
const BANDS: [number, number][] = [[0, 1], [1, 5], [5, 20], [20, 100], [100, 500], [500, Infinity]];

export function SetAnalytics({ products, since }: { products: Product[]; since: string | null }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("movers");
  const { format } = useCurrency();
  const moved = products.filter(p => p.change && (p.market ?? 0) >= 1);
  const ups = [...moved].filter(p => p.change!.percent > 0).sort((a, b) => b.change!.percent - a.change!.percent).slice(0, 5);
  const downs = [...moved].filter(p => p.change!.percent < 0).sort((a, b) => a.change!.percent - b.change!.percent).slice(0, 5);
  const priced = products.filter(p => p.market !== null);
  const bands = BANDS.map(([lo, hi]) => ({ lo, hi, n: priced.filter(p => p.market! >= lo && p.market! < hi).length }));
  const most = Math.max(1, ...bands.map(b => b.n));

  return (
    <section className="analytics panel" aria-labelledby="an-title">
      <h2 id="an-title">Set analytics</h2>
      <div className="tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === "movers" && (moved.length === 0 ? (
        <p className="state">Market movers need two saved days of prices. VENDR saves one per day, so they appear after the next update.</p>
      ) : (
        <div className="movers">
          {[["Biggest increases", ups], ["Biggest decreases", downs]].map(([title, items]) => (
            <div key={title as string}>
              <h3>{title as string} {since ? <small>since {since}</small> : null}</h3>
              {(items as Product[]).length === 0 ? <p className="help">None.</p> : (items as Product[]).map(p => (
                <Link key={p.id} href={productHref(p)} className="mover">
                  <span className="mover-name">{p.name}</span>
                  <span><Money usd={p.market} /></span>
                  <ChangeTag change={p.change} withAmount />
                </Link>
              ))}
            </div>
          ))}
        </div>
      ))}

      {tab === "dist" && (
        <div className="dist">
          <p className="help">How many of this set’s {priced.length} priced products fall in each market-price band.</p>
          {bands.map(b => (
            <div key={b.lo} className="bar-row">
              <span className="bar-label">{b.hi === Infinity ? `${format(b.lo)}+` : `${format(b.lo)} – ${format(b.hi)}`}</span>
              <span className="bar"><span style={{ width: `${(b.n / most) * 100}%` }} /></span>
              <span className="bar-n">{b.n}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "sales" && (
        <p className="state">Sales volume isn’t available. The price source (TCGplayer via tcgcsv) gives prices but not individual sales, and VENDR won’t estimate them.</p>
      )}

      {tab === "wish" && (
        <p className="state">Most wishlisted needs real wishlist counts across everyone using VENDR. It turns on with Google sign-in, which is the next step.</p>
      )}
    </section>
  );
}
