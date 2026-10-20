"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIndex } from "@/lib/use-index";
import { applyFilters, matches, matchSets, noMatchHelp, sortProducts, SORTS, words, type Filters, type SortKey } from "@/lib/search";
import { RARITY_NAMES, coinFor, shortDate } from "@/lib/format";
import { rememberSearch, RECENT_KEY, useStored, write } from "@/lib/store";
import type { Product, SetInfo } from "@/lib/types";
import { useCurrency } from "./money";
import { ProductCard, ProductList } from "./product-views";
import { SearchInput } from "./search-input";
import { ProductImage } from "./product-image";

const PAGE = 60;
const NO_RECENT: string[] = [];

type Mode = "home" | "products" | "set";
type Category = "all" | "card" | "sealed" | "sets";

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

// Search + quick categories + filters + sort + grid/list, all kept in the address
// bar so a search can be shared, and so switching views never loses it.
export function Browser({ mode, scope }: { mode: Mode; scope?: SetInfo }) {
  const { data, error } = useIndex();
  const params = useSearchParams();
  const router = useRouter();
  const { code, rate, rates } = useCurrency();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [shown, setShown] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const recent = useStored<string[]>(RECENT_KEY, NO_RECENT);

  const category = (params.get("cat") as Category) || "all";
  const sort = (params.get("sort") as SortKey) || "best";
  const view = params.get("view") === "list" ? "list" : "grid";
  const wholeSite = mode === "set" && params.get("scope") === "all";
  const scoped = mode === "set" && scope && !wholeSite;

  // Update the address without adding a history step for every keystroke.
  function setParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k); else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
    setShown(PAGE);
  }

  // Typing updates results at once; the address catches up a moment later.
  const typing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function onSearch(v: string) {
    setQ(v);
    setShown(PAGE);
    clearTimeout(typing.current);
    typing.current = setTimeout(() => {
      setParams({ q: v.trim() || null });
      if (v.trim().length >= 2) rememberSearch(v);
    }, 600);
  }
  useEffect(() => () => clearTimeout(typing.current), []);

  const filters: Filters = {
    kind: category === "card" || category === "sealed" ? category : "all",
    set: scoped ? scope!.name : params.get("set") ?? "",
    types: list(params.get("type")),
    rarities: list(params.get("rarity")),
    languages: list(params.get("lang")),
    // The price boxes are in the chosen currency; the data is in US dollars.
    min: params.get("min") ? Number(params.get("min")) / rate : null,
    max: params.get("max") ? Number(params.get("max")) / rate : null,
  };

  const w = words(q);
  const products = data?.products ?? [];
  const hasChanges = useMemo(() => products.some(p => p.change), [products]);

  // Everything the typed search matches, before any filter.
  const base = useMemo(() => (!data ? [] : w.length ? products.filter(p => matches(p, w)) : products), [data, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(
    () => sortProducts(applyFilters(base, filters), sort, w.length > 0),
    [base, params, rate], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setResults = useMemo(() => (data && w.length ? matchSets(data.sets, w) : []), [data, q]); // eslint-disable-line react-hooks/exhaustive-deps

  // Checkbox counts: each group counts what's left after the OTHER filters (and
  // the search) but not its own, so ticking one box shows what the others would add.
  const facets = useMemo(() => {
    const count = (items: Product[], key: (p: Product) => string | null) => {
      const m = new Map<string, number>();
      for (const p of items) { const k = key(p); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return {
      languages: count(applyFilters(base, { ...filters, languages: [] }), p => p.language),
      types: count(applyFilters(base, { ...filters, types: [] }), p => p.type),
      rarities: count(applyFilters(base, { ...filters, rarities: [] }), p => (p.rarity && RARITY_NAMES[p.rarity] ? p.rarity : null)),
    };
  }, [base, params, rate]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: string, value: string) => {
    const cur = list(params.get(key));
    setParams({ [key]: (cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value]).join(",") || null });
  };
  const activeFilters = [filters.types.length, filters.rarities.length, filters.languages.length,
    !scoped && filters.set ? 1 : 0, params.get("min") ? 1 : 0, params.get("max") ? 1 : 0].reduce((a, b) => a + b, 0);
  const clearFilters = () => setParams({ type: null, rarity: null, lang: null, set: null, min: null, max: null });

  const placeholder = scoped ? `Find a product in ${scope!.name}` : "Search cards, sets, booster boxes, decks…";
  const showResults = mode !== "home" || w.length > 0 || category !== "all" || activeFilters > 0;
  const homeCap = mode === "home" ? 24 : shown;

  if (error) {
    return <div className="state error" role="alert"><b>Prices couldn’t load.</b> {error}. Check your connection and refresh.</div>;
  }

  const categories: [Category, string][] = mode === "set"
    ? [["all", "All"], ["card", "Cards"], ["sealed", "Sealed"]]
    : [["all", "All"], ["card", "Cards"], ["sets", "Sets"], ["sealed", "Sealed products"]];

  return (
    <div className={`browser ${mode}`}>
      <div className="finder">
        <SearchInput value={q} onChange={onSearch} onSubmit={v => rememberSearch(v)} placeholder={placeholder}
          pool={scoped ? undefined : products} big={mode === "home"} autoFocus={mode === "home"} />
        <div className="quick" role="group" aria-label="Product category">
          {categories.map(([key, label]) => (
            <button key={key} type="button" className="chip" aria-pressed={category === key}
              onClick={() => setParams({ cat: key === "all" ? null : key })}>{label}</button>
          ))}
          {mode === "set" && (
            <button type="button" className="chip scope" aria-pressed={wholeSite}
              onClick={() => setParams({ scope: wholeSite ? null : "all" })}>
              {wholeSite ? `Back to ${scope!.name} only` : "Search all of VENDR instead"}
            </button>
          )}
        </div>
        {mode === "set" && wholeSite && <p className="scope-note">Searching the whole marketplace, not just {scope!.name}.</p>}
        {mode === "home" && !w.length && recent.length > 0 && (
          <div className="recent">
            <span className="label">Recent</span>
            {recent.map(r => <button key={r} type="button" className="chip small" onClick={() => onSearch(r)}>{r}</button>)}
            <button type="button" className="link-btn" onClick={() => write(RECENT_KEY, [])}>Clear</button>
          </div>
        )}
      </div>

      {!data ? <div className="state" aria-busy="true">Loading today’s prices…</div> : !showResults ? null : category === "sets" ? (
        <SetGrid sets={w.length ? setResults : data.sets} />
      ) : (
        <>
          <div className="toolbar">
            <p className="count"><b>{results.length.toLocaleString()}</b> {results.length === 1 ? "product" : "products"}
              {w.length ? <> for “{q.trim()}”</> : scoped ? <> in {scope!.name}</> : null}
              {activeFilters ? <> · {activeFilters} filter{activeFilters > 1 ? "s" : ""} <button type="button" className="link-btn" onClick={clearFilters}>Clear</button></> : null}
            </p>
            {mode !== "home" && (
              <button type="button" className="btn filters-toggle" aria-expanded={filtersOpen} aria-controls="filters"
                onClick={() => setFiltersOpen(o => !o)}>Filters{activeFilters ? ` (${activeFilters})` : ""}</button>
            )}
            <label className="sort">Sort by
              <select value={sort} onChange={e => setParams({ sort: e.target.value === "best" ? null : e.target.value })}>
                {SORTS.map(([key, label]) => {
                  const off = ((key === "up" || key === "down") && !hasChanges) || key === "wishlisted";
                  return <option key={key} value={key} disabled={off}>{label}{off ? " (soon)" : ""}</option>;
                })}
              </select>
            </label>
            <div className="view" role="group" aria-label="View">
              <button type="button" aria-pressed={view === "grid"} onClick={() => setParams({ view: null })} title="Grid view">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg><span className="sr-only">Grid</span>
              </button>
              <button type="button" aria-pressed={view === "list"} onClick={() => setParams({ view: "list" })} title="List view">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg><span className="sr-only">List</span>
              </button>
            </div>
          </div>

          {w.length > 0 && setResults.length > 0 && category === "all" && mode !== "set" && (
            <div className="set-hits">
              <span className="label">Sets</span>
              {setResults.slice(0, 6).map(s => <Link key={s.slug} className="chip small" href={`/sets/${s.slug}`}>{s.name}</Link>)}
            </div>
          )}

          <div className={`results-layout${mode === "home" ? " no-filters" : ""}`}>
            {mode !== "home" && (
              <aside id="filters" className={`filters panel${filtersOpen ? " open" : ""}`} aria-label="Filters">
                <div className="filters-head"><h2>Filters</h2>{activeFilters > 0 && <button type="button" className="link-btn" onClick={clearFilters}>Clear all</button>}</div>
                {!scoped && (
                  <label className="field">Set or release
                    <select value={filters.set} onChange={e => setParams({ set: e.target.value || null })}>
                      <option value="">All sets</option>
                      {data.sets.filter(s => s.cards + s.sealed > 0).map(s => <option key={s.slug} value={s.name}>{s.name}</option>)}
                    </select>
                  </label>
                )}
                <fieldset>
                  <legend>Language</legend>
                  {facets.languages.map(([v, n]) => (
                    <label key={v} className="check"><input type="checkbox" checked={filters.languages.includes(v)} onChange={() => toggle("lang", v)} /> {v}<span className="n">{n.toLocaleString()}</span></label>
                  ))}
                  <p className="help">Only a few Japanese-version items are on TCGplayer’s English listing. Full Japanese card prices need another source.</p>
                </fieldset>
                <fieldset>
                  <legend>Product type</legend>
                  {facets.types.map(([v, n]) => (
                    <label key={v} className="check"><input type="checkbox" checked={filters.types.includes(v)} onChange={() => toggle("type", v)} /> {v}<span className="n">{n.toLocaleString()}</span></label>
                  ))}
                </fieldset>
                {filters.kind !== "sealed" && (
                  <fieldset>
                    <legend>Rarity</legend>
                    {facets.rarities.map(([v, n]) => (
                      <label key={v} className="check"><input type="checkbox" checked={filters.rarities.includes(v)} onChange={() => toggle("rarity", v)} /> {RARITY_NAMES[v]}<span className="n">{n.toLocaleString()}</span></label>
                    ))}
                  </fieldset>
                )}
                <fieldset>
                  <legend>Market price ({code})</legend>
                  <div className="range">
                    <input type="number" min={0} inputMode="decimal" placeholder={`${coinFor(code)} Min`} aria-label="Minimum price"
                      defaultValue={params.get("min") ?? ""} onChange={e => setParams({ min: e.target.value || null })} />
                    <span>to</span>
                    <input type="number" min={0} inputMode="decimal" placeholder={`${coinFor(code)} Max`} aria-label="Maximum price"
                      defaultValue={params.get("max") ?? ""} onChange={e => setParams({ max: e.target.value || null })} />
                  </div>
                  {code !== "USD" && rates[code] ? <p className="help">Converted from US dollars at today’s rate.</p> : null}
                </fieldset>
              </aside>
            )}

            <section aria-live="polite" aria-label="Results">
              {results.length === 0 ? (
                <div className="state empty">{noMatchHelp(applyFilters(products, { ...filters, types: [], rarities: [], languages: [], min: null, max: null }), w)}</div>
              ) : view === "list" ? (
                <ProductList items={results.slice(0, homeCap)} />
              ) : (
                <div className="grid">{results.slice(0, homeCap).map(p => <ProductCard key={p.id} p={p} />)}</div>
              )}
              {mode === "home" && results.length > homeCap && (
                <Link className="btn more" href={`/products?${params.toString() || (q ? `q=${encodeURIComponent(q)}` : "")}`}>
                  See all {results.length.toLocaleString()} in Products →
                </Link>
              )}
              {mode !== "home" && results.length > shown && (
                <button type="button" className="btn more" onClick={() => setShown(s => s + PAGE)}>
                  Show more ({(results.length - shown).toLocaleString()} left)
                </button>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

export function SetGrid({ sets }: { sets: SetInfo[] }) {
  if (!sets.length) return <div className="state empty">No sets match that search.</div>;
  return (
    <div className="set-grid">
      {sets.map(s => (
        <Link key={s.slug} href={`/sets/${s.slug}`} className="set-tile">
          {s.image ? <ProductImage src={s.image} /> : <span className="noimg">No art yet</span>}
          <span>
            <b>{s.name}</b>
            <small>{s.code ? `${s.code} · ` : ""}{s.released ? shortDate(s.released) : "Date unknown"}</small>
            <small>{s.cards + s.sealed ? `${s.cards.toLocaleString()} cards · ${s.sealed} sealed` : "No products listed yet"}</small>
          </span>
        </Link>
      ))}
    </div>
  );
}
