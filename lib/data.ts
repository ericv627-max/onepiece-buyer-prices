// Build-time data: reads the files update_prices.py saves in data/.
// Only server code imports this (it uses the file system).
//
// Everything here is computed ONCE per build process and shared by all ~8,000
// pages. (React's cache() only lasts for a single page render, which meant the
// whole catalog was re-read and re-processed for every page.)
import fs from "node:fs";
import path from "node:path";
import { shardOf, type Shard } from "./history";
import type { Meta, PricePoint, Product, SetInfo } from "./types";

const DATA = path.join(process.cwd(), "data");
const HISTORY = path.join(DATA, "history");

// The buyer pricing rule (same as build_site.py).
export const BUYER_MIN_PERCENT = 0.8;
export const BUYER_MAX_PERCENT = 0.9;

type CatalogRow = {
  id: string;
  product_id: number;
  sub_type: string;
  kind?: "card" | "sealed";
  product_type?: string;
  language?: string;
  name: string;
  set_name: string;
  card_number: string;
  rarity: string | null;
  printing: string;
  image_url: string;
  tcgplayer_url: string;
  low_price: number | null;
  market_price: number | null;
};

type Snapshot = { date: string; prices: Record<string, [number | null, number | null]> };

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function slugify(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const round = (n: number) => Math.round(n * 100) / 100;

let memoFiles: string[] | null = null;
function historyFiles(): string[] {
  return (memoFiles ??= fs.existsSync(HISTORY) ? fs.readdirSync(HISTORY).filter(f => f.endsWith(".json")).sort() : []);
}

function buildAll() {
  const catalog = readJson<{ updated: string; updated_at?: string; cards: CatalogRow[] }>(
    path.join(DATA, "catalog.json"), { updated: "", cards: [] });
  const setsFile = readJson<{ sets: { id: number; name: string; code: string; released: string | null }[] }>(
    path.join(DATA, "sets.json"), { sets: [] });
  const ratesFile = readJson<{ date: string; rates: Record<string, number> } | null>(
    path.join(DATA, "rates.json"), null);

  // The arrows compare with the latest saved day before the catalog's day.
  const earlier = historyFiles().filter(f => f.replace(".json", "") < catalog.updated);
  const previous = earlier.length
    ? readJson<Snapshot>(path.join(HISTORY, earlier[earlier.length - 1]), { date: "", prices: {} })
    : null;

  const released = new Map(setsFile.sets.map(s => [s.name, s.released]));

  const products: Product[] = catalog.cards.map(row => {
    const before = previous?.prices[row.id]?.[1] ?? null;
    const now = row.market_price;
    const change = now !== null && before ? { amount: round(now - before), percent: Math.round(((now - before) / before) * 1000) / 10 } : null;
    const kind = row.kind ?? "card";
    return {
      id: row.id,
      kind,
      type: row.product_type ?? (kind === "card" ? "Single Card" : "Other Sealed"),
      name: row.name,
      set: row.set_name,
      setSlug: slugify(row.set_name),
      number: row.card_number,
      rarity: row.rarity,
      printing: row.printing,
      foil: row.sub_type === "Foil",
      language: row.language ?? "English",
      image: row.image_url,
      url: row.tcgplayer_url,
      low: row.low_price,
      market: now,
      buyerMin: row.low_price === null ? null : round(row.low_price * BUYER_MIN_PERCENT),
      buyerMax: row.low_price === null ? null : round(row.low_price * BUYER_MAX_PERCENT),
      released: released.get(row.set_name) ?? null,
      change,
    };
  });

  // Group once, so building each set (and each product page) doesn't scan every product.
  const bySet = new Map<string, Product[]>();
  const byNumber = new Map<string, Product[]>();
  for (const p of products) {
    (bySet.get(p.set) ?? bySet.set(p.set, []).get(p.set)!).push(p);
    if (p.kind === "card" && p.number) (byNumber.get(p.number) ?? byNumber.set(p.number, []).get(p.number)!).push(p);
  }

  // Every set tcgcsv lists gets a page, even before its products appear,
  // so notifications about upcoming sets always have somewhere to go.
  const sets: SetInfo[] = setsFile.sets.map(s => {
    const items = bySet.get(s.name) ?? [];
    const top = items.filter(p => p.image).sort((a, b) => (b.market ?? 0) - (a.market ?? 0))[0];
    return {
      id: s.id,
      name: s.name,
      slug: slugify(s.name),
      code: s.code,
      released: s.released,
      cards: items.filter(p => p.kind === "card").length,
      sealed: items.filter(p => p.kind === "sealed").length,
      image: top?.image ?? null,
    };
  });

  const meta: Meta = {
    updated: catalog.updated,
    updatedAt: catalog.updated_at ?? null,
    changeSince: previous?.date ?? null,
    buyerMinPercent: BUYER_MIN_PERCENT,
    buyerMaxPercent: BUYER_MAX_PERCENT,
    rates: ratesFile,
  };

  return { products, sets, meta, bySet, byNumber, byId: new Map(products.map(p => [p.id, p])), setBySlug: new Map(sets.map(s => [s.slug, s])) };
}

let memoAll: ReturnType<typeof buildAll> | null = null;
const loadAll = () => (memoAll ??= buildAll());

export const getProducts = () => loadAll().products;
export const getSets = () => loadAll().sets;
export const getMeta = () => loadAll().meta;
export const getProduct = (id: string) => loadAll().byId.get(id) ?? null;
export const getSet = (slug: string) => loadAll().setBySlug.get(slug) ?? null;
export const getSetProducts = (setName: string) => loadAll().bySet.get(setName) ?? [];

// Every saved day's price for every product, read once. Days where a product
// wasn't listed are left out rather than filled in.
let memoHistory: Map<string, PricePoint[]> | null = null;
function loadHistory() {
  if (memoHistory) return memoHistory;
  const map = new Map<string, PricePoint[]>();
  for (const file of historyFiles()) {
    const snap = readJson<Snapshot>(path.join(HISTORY, file), { date: "", prices: {} });
    for (const [id, [low, market]] of Object.entries(snap.prices)) {
      let points = map.get(id);
      if (!points) map.set(id, (points = []));
      points.push({ date: snap.date, low, market });
    }
  }
  return (memoHistory = map);
}

// The saved days of every product in one history file (see lib/history.ts).
export function getHistoryShard(shard: number): Shard {
  const out: Shard = {};
  for (const [id, points] of loadHistory()) {
    if (shardOf(id) === shard) out[id] = points.map(p => [p.date, p.low, p.market]);
  }
  return out;
}
