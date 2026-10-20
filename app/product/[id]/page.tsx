import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHistory, getMeta, getProduct, getProducts, getSets, getVariants } from "@/lib/data";
import { RARITY_NAMES, shortDate } from "@/lib/format";
import { ChangeTag, Money, Range } from "@/components/money";
import { Heart } from "@/components/heart";
import { PriceChart } from "@/components/price-chart";
import { ProductCard } from "@/components/product-views";
import { ProductImage } from "@/components/product-image";

// One page per product, built ahead of time. Unknown ids show the 404 page.
export const dynamicParams = false;
export function generateStaticParams() {
  return getProducts().map(p => ({ id: p.id }));
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getProduct(decodeURIComponent((await params).id));
  if (!p) return {};
  // Many card names already end with their number; don't repeat it.
  const title = p.number && !p.name.includes(p.number) ? `${p.name} (${p.number})` : p.name;
  return { title, description: `${p.name} from ${p.set}: market price and history.` };
}

export default async function ProductPage({ params }: Props) {
  const p = getProduct(decodeURIComponent((await params).id));
  if (!p) notFound();
  const meta = getMeta();
  const history = getHistory(p.id);
  const variants = getVariants(p);
  const set = getSets().find(s => s.name === p.set);
  const related = p.kind === "sealed"
    ? getProducts().filter(x => x.kind === "sealed" && x.set === p.set && x.id !== p.id)
    : [];

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
        <div className="product-img panel">
          <ProductImage src={p.image} alt={p.name} />
        </div>
        <div className="product-info">
          <h1>{p.name}</h1>
          <Link href={`/sets/${p.setSlug}`} className="set-link">{p.set}{set?.code ? ` · ${set.code}` : ""}</Link>
          <div className="price-block panel">
            <div>
              <span className="label">Market price</span>
              <div className="big-price"><Money usd={p.market} /></div>
              <ChangeTag change={p.change} withAmount since={meta.changeSince ? shortDate(meta.changeSince) : null} />
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
            <Link href="/portfolio" className="btn">Add to portfolio</Link>
            <a href={p.url} className="btn primary" target="_blank" rel="noopener">Latest sales on TCGplayer ↗</a>
          </div>
        </div>
      </div>

      <PriceChart points={history} firstDay={history[0]?.date ?? meta.updated} />

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
