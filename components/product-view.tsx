"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useIndex } from "@/lib/use-index";
import { useHistory } from "@/lib/use-history";
import { RARITY_NAMES, isUpcoming, shortDate } from "@/lib/format";
import { BRAND } from "@/lib/brand";
import { ChangeTag, Money, Range } from "./money";
import { Heart } from "./heart";
import { PriceChart } from "./price-chart";
import { ProductCard } from "./product-views";
import { ProductImage } from "./product-image";
import { AddToPortfolio } from "./add-to-portfolio";

// One page for every card and sealed product: /product?id=<product id>.
// It's drawn in the browser from the catalog that's already downloaded, so there
// are not thousands of separate files to build and host.
export function ProductView() {
  const id = useSearchParams().get("id");
  const { data, error } = useIndex();
  const product = useMemo(() => (data && id ? data.products.find(p => p.id === id) ?? null : null), [data, id]);
  const history = useHistory(product ? product.id : null);

  useEffect(() => {
    if (product) document.title = `${product.name}${product.number && !product.name.includes(product.number) ? ` (${product.number})` : ""} · ${BRAND}`;
  }, [product]);

  if (error) return <div className="state error" role="alert"><b>Prices couldn’t load.</b> {error}. Check your connection and refresh.</div>;
  if (!data) return <div className="state" aria-busy="true">Loading product…</div>;

  if (!id || !product) {
    return (
      <div className="state empty panel">
        <h1>Product not found</h1>
        <p>{id ? "That product isn’t in today’s TCGplayer listing. It may have been removed, or the link is out of date." : "No product was chosen."}</p>
        <div className="actions"><Link href="/products?focus=1" className="btn primary">Search products</Link><Link href="/products" className="btn">Browse products</Link></div>
      </div>
    );
  }

  const p = product;
  const set = data.sets.find(s => s.name === p.set);
  const since = data.changeSince ? shortDate(data.changeSince) : null;
  // Other printings of the same card number (alternate arts, foils, reprints). Matched only
  // on the exact card number, never on the character's name, and each keeps its own price.
  const variants = p.kind === "card" && p.number ? data.products.filter(x => x.kind === "card" && x.number === p.number && x.id !== p.id) : [];
  const related = p.kind === "sealed" ? data.products.filter(x => x.kind === "sealed" && x.set === p.set && x.id !== p.id) : [];

  const facts: [string, string][] = [
    ["Type", p.type],
    ["Language", p.language],
    ...(p.number ? [["Card number", p.number] as [string, string]] : []),
    ...(p.rarity ? [["Rarity", RARITY_NAMES[p.rarity] ?? p.rarity] as [string, string]] : []),
    ...(p.kind === "card" ? [["Printing", `${p.printing}${p.foil ? " · Foil" : ""}`] as [string, string]] : []),
    ["Released", shortDate(p.released)],
  ];

  return (
    <article className="product">
      <nav aria-label="Breadcrumb" className="crumbs">
        <Link href="/products">Products</Link> <span aria-hidden="true">/</span> <Link href={`/sets/${p.setSlug}`}>{p.set}</Link>
      </nav>
      <div className="product-top">
        <div className={`product-img panel${p.kind === "sealed" ? " sealed" : ""}`}>
          <ProductImage src={p.image} alt={p.name} drops={isUpcoming(p.released) ? p.released : null} />
        </div>
        <div className="product-info">
          <h1>{p.name}</h1>
          <Link href={`/sets/${p.setSlug}`} className="set-link">{p.set}{set?.code ? ` · ${set.code}` : ""}</Link>
          <div className="price-block panel">
            <div>
              <span className="label">Market price</span>
              <div className="big-price"><Money usd={p.market} /></div>
              <ChangeTag change={p.change} withAmount since={since} />
              {!p.change && <span className="help"> Price change appears after two saved days.</span>}
            </div>
            <div>
              <span className="label">Buyer pays</span>
              <div className="offer-price"><Range min={p.buyerMin} max={p.buyerMax} /></div>
              <span className="help">80–90% of the lowest listing (<Money usd={p.low} />). All conditions.</span>
            </div>
          </div>
          <dl className="facts">
            {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <div className="actions">
            <Heart id={p.id} name={p.name} size="lg" />
            <AddToPortfolio product={p} />
            <a href={p.url} className="btn primary" target="_blank" rel="noopener">Latest sales on TCGplayer ↗</a>
          </div>
        </div>
      </div>

      {history.error ? (
        <div className="state error panel" role="alert">{history.error}</div>
      ) : history.points === null ? (
        <div className="state panel" aria-busy="true">Loading price history…</div>
      ) : (
        <PriceChart points={history.points} firstDay={history.points[0]?.date ?? data.updated} />
      )}

      {variants.length > 0 && (
        <section className="related">
          <h2>Other printings of {p.number}</h2>
          <p className="help">Each printing has its own price and history.</p>
          <div className="grid">{variants.map(v => <ProductCard key={v.id} p={v} />)}</div>
        </section>
      )}
      {related.length > 0 && (
        <section className="related">
          <h2>More sealed products from {p.set}</h2>
          <div className="grid">{related.map(v => <ProductCard key={v.id} p={v} />)}</div>
        </section>
      )}
    </article>
  );
}
