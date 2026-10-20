import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMeta, getSet, getSetProducts, getSets } from "@/lib/data";
import { shortDate } from "@/lib/format";
import { Browser } from "@/components/browser";
import { SetAnalytics } from "@/components/set-analytics";
import { ProductImage } from "@/components/product-image";

export const dynamicParams = false;
export function generateStaticParams() {
  return getSets().map(s => ({ slug: s.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = getSet((await params).slug);
  return s ? { title: s.name, description: `${s.name}: cards, sealed products and prices.` } : {};
}

export default async function SetPage({ params }: Props) {
  const set = getSet((await params).slug);
  if (!set) notFound();
  const meta = getMeta();
  const products = getSetProducts(set.name);
  const today = new Date().toISOString().slice(0, 10);
  const status = !set.released ? "Release date unknown" : set.released > today ? `Upcoming · releases ${shortDate(set.released)}` : `Released ${shortDate(set.released)}`;

  return (
    <>
      <nav aria-label="Breadcrumb" className="crumbs"><Link href="/sets">Sets</Link> <span aria-hidden="true">/</span> {set.name}</nav>
      <header className="set-head panel">
        {set.image ? <ProductImage src={set.image} /> : null}
        <div>
          <h1>{set.name}</h1>
          <p>{set.code ? <b>{set.code}</b> : null}{set.code ? " · " : ""}{status}</p>
          <p className="help">{set.cards.toLocaleString()} cards · {set.sealed} sealed products</p>
        </div>
      </header>
      {products.length === 0 ? (
        <div className="state empty">
          TCGplayer hasn’t listed any products for {set.name} yet. They’ll appear here after a nightly update once they’re listed.
        </div>
      ) : (
        <>
          <SetAnalytics products={products} since={meta.changeSince ? shortDate(meta.changeSince) : null} />
          <Suspense fallback={<div className="state">Loading products…</div>}>
            <Browser mode="set" scope={set} />
          </Suspense>
        </>
      )}
    </>
  );
}
