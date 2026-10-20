// Searching, filtering and sorting the catalog (runs in the browser).
import type { Product, SetInfo } from "./types";
import { RARITY_NAMES } from "./format";

const textCache = new WeakMap<Product, string>();
function text(p: Product) {
  let t = textCache.get(p);
  if (!t) {
    t = [p.name, p.number, p.set, p.printing, p.type, p.language, p.rarity ? RARITY_NAMES[p.rarity] ?? p.rarity : "", p.foil ? "foil" : "",
      p.kind === "sealed" ? "sealed" : "card"].join(" ").toLowerCase();
    textCache.set(p, t);
  }
  return t;
}

export function words(query: string): string[] {
  const q = query.trim().toLowerCase();
  return q.length >= 2 ? q.split(/\s+/) : [];
}

// Every word must appear somewhere, so "luffy op05" finds Luffy cards from OP05.
export const matches = (p: Product, w: string[]) => w.every(word => text(p).includes(word));

export function matchSets(sets: SetInfo[], w: string[]) {
  return sets.filter(s => w.every(word => `${s.name} ${s.code}`.toLowerCase().includes(word)));
}

// When nothing matches, name the word that's the problem.
export function noMatchHelp(products: Product[], w: string[]): string {
  const missing = w.filter(word => !products.some(p => text(p).includes(word)));
  if (missing.length) return `Nothing matches “${missing.join("”, “")}”. Check the spelling, or try a card number like OP01-001.`;
  if (w.length > 1) return "Each word matches something, but no single product has all of them. Try fewer words.";
  return "No products match these filters. Try clearing some.";
}

export type Filters = {
  kind: "all" | "card" | "sealed";
  set: string;
  types: string[];
  rarities: string[];
  languages: string[];
  min: number | null; // USD
  max: number | null; // USD
};

export function applyFilters(list: Product[], f: Filters) {
  return list.filter(p =>
    (f.kind === "all" || p.kind === f.kind) &&
    (!f.set || p.set === f.set) &&
    (!f.types.length || f.types.includes(p.type)) &&
    (!f.rarities.length || (p.rarity !== null && f.rarities.includes(p.rarity))) &&
    (!f.languages.length || f.languages.includes(p.language)) &&
    (f.min === null || (p.market !== null && p.market >= f.min)) &&
    (f.max === null || (p.market !== null && p.market <= f.max)));
}

export const SORTS = [
  ["best", "Best match"],
  ["price-desc", "Price: high to low"],
  ["price-asc", "Price: low to high"],
  ["newest", "Newest release"],
  ["oldest", "Oldest release"],
  ["up", "Biggest price increase"],
  ["down", "Biggest price decrease"],
  ["wishlisted", "Most wishlisted"],
] as const;
export type SortKey = (typeof SORTS)[number][0];

const byNumber = (a: Product, b: Product) => (a.number || "~").localeCompare(b.number || "~", undefined, { numeric: true });

// Products with no value for the sort key always go last, in either direction.
export function sortProducts(list: Product[], sort: SortKey, searching: boolean): Product[] {
  const out = [...list];
  const last = (v: number | null | undefined, dir: 1 | -1) => (v === null || v === undefined ? Infinity : dir * v);
  switch (sort) {
    // With no search, "best match" means the most valuable first.
    case "best": return searching ? out : sortProducts(list, "price-desc", false);
    case "price-desc": out.sort((a, b) => last(a.market, -1) - last(b.market, -1)); break;
    case "price-asc": out.sort((a, b) => last(a.market, 1) - last(b.market, 1)); break;
    case "newest": out.sort((a, b) => (b.released ?? "").localeCompare(a.released ?? "") || byNumber(a, b)); break;
    case "oldest": out.sort((a, b) => (a.released ?? "9999").localeCompare(b.released ?? "9999") || byNumber(a, b)); break;
    case "up": out.sort((a, b) => last(a.change?.percent, -1) - last(b.change?.percent, -1)); break;
    case "down": out.sort((a, b) => last(a.change?.percent, 1) - last(b.change?.percent, 1)); break;
  }
  return out;
}
