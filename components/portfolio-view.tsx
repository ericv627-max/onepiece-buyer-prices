"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIndex } from "@/lib/use-index";
import { loadHistory } from "@/lib/use-history";
import { exportPortfolio, importPortfolio, localToday, usePortfolio } from "@/lib/portfolio-store";
import { breakdown, fromCents, groupHoldings, lotsAt, mostValuable, totals, valueHoldings, valueSeries, type Valued } from "@/lib/portfolio";
import { matches, words } from "@/lib/search";
import { shortDate } from "@/lib/format";
import type { PricePoint, Product } from "@/lib/types";
import { BRAND } from "@/lib/brand";
import { AddProductDialog, ManageHoldingDialog } from "./portfolio-dialogs";
import { Donut } from "./donut";
import { HoldingCard, HoldingList } from "./holding-views";
import { Heart } from "./heart";
import { ChangeTag, Money, useCurrency } from "./money";
import { ProductImage } from "./product-image";
import { productHref } from "./product-views";
import { SearchInput } from "./search-input";
import { ValueChart } from "./value-chart";

const TABS = [["products", "Products"], ["breakdown", "Holdings breakdown"], ["valuable", "Most valuable"], ["trending", "Trending today"]] as const;
type Tab = (typeof TABS)[number][0];

function Delta({ cents, pct }: { cents: number; pct: number | null }) {
  const { format } = useCurrency();
  const dir = cents > 0 ? "up" : cents < 0 ? "down" : "flat";
  return (
    <span className={`change ${dir}`}>
      <span aria-hidden="true">{cents > 0 ? "▲" : cents < 0 ? "▼" : "▬"}</span>
      <span className="sr-only">{cents > 0 ? "Up" : cents < 0 ? "Down" : "No change"}</span>{" "}
      {cents > 0 ? "+" : cents < 0 ? "−" : ""}{format(Math.abs(fromCents(cents)))}{pct !== null ? ` (${Math.abs(pct).toFixed(1)}%)` : ""}
    </span>
  );
}

export function PortfolioView() {
  const { data, error } = useIndex();
  const portfolio = usePortfolio();
  const params = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find(t => t[0] === params.get("tab"))?.[0] ?? "products") as Tab;

  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState<string | null>(null);

  const lots = useMemo(() => lotsAt(portfolio.events), [portfolio]);
  const byId = useMemo(() => new Map((data?.products ?? []).map(p => [p.id, p])), [data]);
  const valued = useMemo(() => valueHoldings(groupHoldings(lots), byId), [lots, byId]);
  const t = useMemo(() => totals(valued), [valued]);

  // History for every product that was ever held, so earlier days include things since sold.
  const everHeld = useMemo(
    () => [...new Set(portfolio.events.flatMap(e => (e.type === "remove" ? [] : [e.lot.productId])))].sort(),
    [portfolio],
  );
  const heldKey = everHeld.join(",");
  const [history, setHistory] = useState<{ key: string; map: Map<string, PricePoint[]> } | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  useEffect(() => {
    if (!heldKey) return;
    let live = true;
    setHistoryError(null);
    loadHistory(heldKey.split(",")).then(
      map => live && setHistory({ key: heldKey, map }),
      e => live && setHistoryError(String(e.message || e)),
    );
    return () => { live = false; };
  }, [heldKey]);
  const historyReady = history !== null && history.key === heldKey;
  const series = useMemo(() => (historyReady ? valueSeries(portfolio.events, history!.map) : []), [historyReady, history, portfolio]);
  const trackingSince = useMemo(() => portfolio.events.map(e => e.at).sort()[0]?.slice(0, 10) ?? null, [portfolio]);

  if (error) return <div className="state error" role="alert"><b>Prices couldn’t load.</b> {error}. Check your connection and refresh.</div>;
  if (!data) return <div className="state" aria-busy="true">Loading your portfolio…</div>;

  const setTab = (next: Tab) => router.replace(next === "products" ? "?" : `?tab=${next}`, { scroll: false });
  const empty = portfolio.events.length === 0;

  return (
    <>
      <header className="page-head portfolio-head">
        <div>
          <h1>Portfolio</h1>
          <p>The cards and sealed products you own, valued at TCGplayer market prices. Saved on this device; Google sign-in will sync it.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setAdding(true)}>+ Add product</button>
      </header>

      {empty ? (
        <section className="state panel coming">
          <b>Your portfolio is empty.</b>
          <p>Add the cards and sealed products you own to see what they’re worth, how that changes each day, and what you’ve gained or lost.</p>
          <div className="actions"><button type="button" className="btn primary" onClick={() => setAdding(true)}>Add your first product</button><Link href="/products" className="btn">Browse products</Link></div>
          <BackupControls hasData={false} />
        </section>
      ) : (
        <>
          <Summary t={t} />
          <ValueChart series={series} events={portfolio.events} loading={everHeld.length > 0 && !historyReady && !historyError} error={historyError} trackingSince={trackingSince} />

          <div className="tabs" role="tablist" aria-label="Portfolio sections">
            {TABS.map(([key, label]) => (
              <button key={key} type="button" role="tab" id={`tab-${key}`} aria-selected={tab === key} aria-controls={`panel-${key}`} tabIndex={tab === key ? 0 : -1}
                onClick={() => setTab(key)}
                onKeyDown={e => {
                  const i = TABS.findIndex(x => x[0] === tab);
                  if (e.key === "ArrowRight") { e.preventDefault(); setTab(TABS[(i + 1) % TABS.length][0]); }
                  if (e.key === "ArrowLeft") { e.preventDefault(); setTab(TABS[(i + TABS.length - 1) % TABS.length][0]); }
                }}>{label}</button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "products" && <ProductsTab valued={valued} onManage={setManaging} onAdd={() => setAdding(true)} />}
            {tab === "breakdown" && <BreakdownTab valued={valued} onManage={setManaging} />}
            {tab === "valuable" && <ValuableTab valued={valued} onManage={setManaging} />}
            {tab === "trending" && <TrendingTab products={data.products} owned={new Map(valued.map(v => [v.productId, v.qty]))} since={data.changeSince} />}
          </div>
        </>
      )}

      <AddProductDialog open={adding} onClose={() => setAdding(false)} products={data.products} />
      <ManageHoldingDialog productId={managing} product={managing ? byId.get(managing) ?? null : null} onClose={() => setManaging(null)} />
    </>
  );
}

// ---------- Totals ----------
function Summary({ t }: { t: ReturnType<typeof totals> }) {
  const partialDay = t.dayChangeCents !== null && t.dayChangeHoldings < t.pricedHoldings;
  return (
    <section className="summary panel" aria-label="Portfolio summary">
      <div className="sum-block">
        <span className="label">Total market value</span>
        <div className="big-price"><Money usd={fromCents(t.valueCents)} /></div>
        <span className="help">{t.holdings} {t.holdings === 1 ? "holding" : "holdings"} · {t.units} {t.units === 1 ? "copy" : "copies"}</span>
      </div>
      <div className="sum-block">
        <span className="label">Change today</span>
        <div className="sum-figure">
          {t.dayChangeCents === null ? <span className="flat">—</span> : <Delta cents={t.dayChangeCents} pct={t.dayChangePct} />}
        </div>
        <span className="help">
          {t.dayChangeCents === null
            ? "Appears after the next daily price update (it needs two saved days)."
            : partialDay ? `Based on ${t.dayChangeHoldings} of ${t.pricedHoldings} priced holdings that have a price change.` : "Compared with the previous saved day."}
        </span>
      </div>
      <div className="sum-block">
        <span className="label">{t.gainComplete ? "Gain or loss" : "Gain or loss (partial)"}</span>
        <div className="sum-figure">
          {t.gainCents === null ? <span className="flat">—</span> : <Delta cents={t.gainCents} pct={t.gainPct} />}
        </div>
        <span className="help">
          {t.gainCents === null
            ? "Add what you paid for a holding to see gain or loss."
            : t.gainComplete ? "Market value minus what you paid." : `Only ${t.gainHoldings} of ${t.pricedHoldings} priced holdings have a price paid for every copy.`}
        </span>
      </div>
      {t.unpricedHoldings > 0 && (
        <p className="sum-warn" role="note">
          {t.unpricedHoldings} {t.unpricedHoldings === 1 ? "holding" : "holdings"} ({t.unpricedUnits} {t.unpricedUnits === 1 ? "copy" : "copies"}) {t.unpricedHoldings === 1 ? "has" : "have"} no market price right now, so {t.unpricedHoldings === 1 ? "it isn’t" : "they aren’t"} in the totals. They are not counted as $0.
        </p>
      )}
    </section>
  );
}

// ---------- Products ----------
type SortKey = "value-desc" | "value-asc" | "name" | "qty" | "change";
function ProductsTab({ valued, onManage, onAdd }: { valued: Valued[]; onManage: (id: string) => void; onAdd: () => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("value-desc");
  const [kind, setKind] = useState<"all" | "card" | "sealed">("all");
  const [lang, setLang] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  const languages = [...new Set(valued.map(v => v.product?.language).filter((l): l is string => !!l))];
  const w = words(q);
  const shown = valued
    .filter(v => (kind === "all" || v.product?.kind === kind) && (lang === "all" || v.product?.language === lang) && (!w.length || (v.product && matches(v.product, w))))
    .sort((a, b) => {
      const priced = (v: Valued) => (v.status === "priced" ? 0 : 1); // unpriced always last
      if (priced(a) !== priced(b)) return priced(a) - priced(b);
      switch (sort) {
        case "value-asc": return (a.valueCents ?? 0) - (b.valueCents ?? 0);
        case "name": return (a.product?.name ?? "~").localeCompare(b.product?.name ?? "~");
        case "qty": return b.qty - a.qty;
        case "change": return (b.product?.change?.percent ?? -Infinity) - (a.product?.change?.percent ?? -Infinity);
        default: return (b.valueCents ?? 0) - (a.valueCents ?? 0);
      }
    });

  return (
    <>
      <div className="toolbar">
        <div className="grow"><SearchInput value={q} onChange={setQ} placeholder="Search your collection" label="Search your collection" /></div>
        <div className="quick" role="group" aria-label="Product category">
          {([["all", "All"], ["card", "Cards"], ["sealed", "Sealed"]] as const).map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
        </div>
        {languages.length > 1 && (
          <label className="sort">Language
            <select value={lang} onChange={e => setLang(e.target.value)}><option value="all">All</option>{languages.map(l => <option key={l}>{l}</option>)}</select>
          </label>
        )}
        <label className="sort">Sort by
          <select value={sort} onChange={e => setSort(e.target.value as SortKey)}>
            <option value="value-desc">Value: high to low</option>
            <option value="value-asc">Value: low to high</option>
            <option value="name">Name A–Z</option>
            <option value="qty">Most copies</option>
            <option value="change">Biggest price increase</option>
          </select>
        </label>
        <div className="view" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")}>Grid</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
        </div>
      </div>
      <p className="count"><b>{shown.length}</b> of {valued.length} {valued.length === 1 ? "holding" : "holdings"}</p>
      {shown.length === 0 ? (
        <div className="state empty">{valued.length === 0 ? <>No holdings left. <button type="button" className="link-btn" onClick={onAdd}>Add a product</button></> : "Nothing in your collection matches that."}</div>
      ) : view === "list" ? <HoldingList items={shown} onManage={onManage} /> : <div className="grid">{shown.map(v => <HoldingCard key={v.productId} v={v} onManage={onManage} />)}</div>}
      <BackupControls hasData />
    </>
  );
}

// ---------- Breakdown ----------
const GROUPINGS: [string, string, (v: Valued) => string][] = [
  ["kind", "Cards vs sealed", v => (v.product?.kind === "sealed" ? "Sealed products" : "Single cards")],
  ["set", "Set or release", v => v.product?.set ?? "Unknown set"],
  ["language", "Language", v => v.product?.language ?? "Unknown"],
  ["type", "Product type", v => v.product?.type ?? "Unknown"],
];

function BreakdownTab({ valued, onManage }: { valued: Valued[]; onManage: (id: string) => void }) {
  const { format } = useCurrency();
  const [by, setBy] = useState(GROUPINGS[0][0]);
  const [selected, setSelected] = useState<string | null>(null);
  const keyOf = GROUPINGS.find(g => g[0] === by)![2];
  const { groups, totalCents, excluded } = useMemo(() => breakdown(valued, keyOf), [valued, keyOf]);
  const active = groups.find(g => g.key === selected) ?? null;

  if (totalCents === 0) return <div className="state empty">None of your holdings has a market price yet, so there’s nothing to break down.</div>;

  return (
    <>
      <div className="quick" role="group" aria-label="Break down by">
        {GROUPINGS.map(([key, label]) => <button key={key} type="button" className="chip" aria-pressed={by === key} onClick={() => { setBy(key); setSelected(null); }}>{label}</button>)}
      </div>
      <div className="breakdown">
        <Donut groups={groups} selectedKey={selected} onSelect={setSelected}
          label={format(fromCents(active ? active.valueCents : totalCents))} sublabel={active ? `${active.pct.toFixed(1)}% of value` : "total value"} />
        <ul className="legend">
          {groups.map((g, i) => (
            <li key={g.key}>
              <button type="button" aria-pressed={selected === g.key} onClick={() => setSelected(selected === g.key ? null : g.key)}>
                <span className="swatch" style={{ background: g.key === "__other" ? "var(--seg-other)" : `var(--seg-${(i % 8) + 1})` }} aria-hidden="true" />
                <span className="legend-label">{g.label}<small>{g.holdings.length} {g.holdings.length === 1 ? "holding" : "holdings"}</small></span>
                <span className="legend-value">{format(fromCents(g.valueCents))}<small>{g.pct.toFixed(1)}%</small></span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {excluded.length > 0 && (
        <p className="help">{excluded.length} {excluded.length === 1 ? "holding has" : "holdings have"} no market price ({excluded.reduce((s, v) => s + v.qty, 0)} copies). {excluded.length === 1 ? "It’s" : "They’re"} left out of these values and shares rather than counted as $0.</p>
      )}
      {active ? (
        <section className="group-detail">
          <div className="group-head"><h2>{active.label}</h2><button type="button" className="btn small" onClick={() => setSelected(null)}>← All groups</button></div>
          <HoldingList items={[...active.holdings].sort((a, b) => b.valueCents! - a.valueCents!)} onManage={onManage} />
        </section>
      ) : <p className="help">Pick a group to see the holdings in it.</p>}
    </>
  );
}

// ---------- Most valuable ----------
function ValuableTab({ valued, onManage }: { valued: Valued[]; onManage: (id: string) => void }) {
  const top = mostValuable(valued, 10);
  if (!top.length) return <div className="state empty">None of your holdings has a market price yet.</div>;
  return (
    <>
      <p className="help">Ranked by total holding value (price × copies owned), not by price per copy. Cards and sealed products are ranked together.</p>
      <HoldingList items={top} onManage={onManage} ranked />
    </>
  );
}

// ---------- Trending ----------
function TrendingTab({ products, owned, since }: { products: Product[]; owned: Map<string, number>; since: string | null }) {
  const movers = products.filter(p => p.change && (p.market ?? 0) >= 1);
  const ups = movers.filter(p => p.change!.percent > 0).sort((a, b) => b.change!.percent - a.change!.percent).slice(0, 10);
  const downs = movers.filter(p => p.change!.percent < 0).sort((a, b) => a.change!.percent - b.change!.percent).slice(0, 10);
  return (
    <>
      <p className="help">These are market-wide moves for every product on {BRAND}, not your portfolio’s performance. A product you own is tagged, but it only counts toward your own change if you hold it.</p>
      {movers.length === 0 ? (
        <div className="state panel compact-state">Market movers need two saved days of prices. {BRAND} saves one a day, so they appear after the next update.</div>
      ) : (
        <div className="movers">
          {([["Biggest price increases", ups], ["Biggest price decreases", downs]] as const).map(([title, items]) => (
            <section key={title}>
              <h3>{title}{since ? <small> since {shortDate(since)}</small> : null}</h3>
              {items.length === 0 ? <p className="help">None.</p> : items.map(p => (
                <div key={p.id} className="trend">
                  <Link href={productHref(p)} className="trend-img"><ProductImage src={p.image} /></Link>
                  <div className="trend-name">
                    <Link href={productHref(p)} className="pname">{p.name}</Link>
                    <span className="pmeta">{p.set} · {p.language}{owned.has(p.id) ? ` · You own ×${owned.get(p.id)}` : ""}</span>
                  </div>
                  <span className="market"><Money usd={p.market} /></span>
                  <ChangeTag change={p.change} withAmount />
                  <Heart id={p.id} name={p.name} />
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
      <div className="unavailable-grid">
        <section className="panel"><h3>Highest recorded sales activity</h3><p className="help">Not available. {BRAND}’s price source (TCGplayer via tcgcsv) gives prices but not individual sales, and {BRAND} doesn’t estimate them.</p></section>
        <section className="panel"><h3>Popular cards and sealed products</h3><p className="help">This will use real wishlist counts from everyone using {BRAND}, which needs accounts. It turns on with Google sign-in.</p></section>
      </div>
    </>
  );
}

// ---------- Backup ----------
function BackupControls({ hasData }: { hasData: boolean }) {
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function download() {
    const url = URL.createObjectURL(new Blob([exportPortfolio()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${BRAND.toLowerCase()}-portfolio-${localToday()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ ok: true, text: "Backup downloaded." });
  }
  function apply(text: string) {
    const result = importPortfolio(text);
    setPending(null);
    setMessage(result.ok ? { ok: true, text: `Restored ${result.events} recorded changes.` } : { ok: false, text: result.error });
  }

  return (
    <div className="backup">
      <h3>Backup</h3>
      <p className="help">Your portfolio is saved in this browser. Download a backup file to keep it safe or move it to another device.</p>
      <div className="actions">
        {hasData && <button type="button" className="btn small" onClick={download}>Download backup</button>}
        <button type="button" className="btn small" onClick={() => file.current?.click()}>Restore from backup</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={async e => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const text = await f.text();
          if (hasData) setPending(text); else apply(text);
        }} />
      </div>
      {pending !== null && (
        <div className="confirm" role="group" aria-label="Confirm restore">
          <span>This replaces your current portfolio with the backup.</span>
          <button type="button" className="btn danger" onClick={() => apply(pending)}>Replace</button>
          <button type="button" className="btn" onClick={() => setPending(null)}>Cancel</button>
        </div>
      )}
      {message && <p className={message.ok ? "notice" : "form-error"} role={message.ok ? "status" : "alert"}>{message.text}</p>}
    </div>
  );
}
