// Build-time data: reads the files update_prices.py saves in data/.
// Only server code imports this (it uses the file system).
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
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

const historyFiles = cache((): string[] =>
  fs.existsSync(HISTORY) ? fs.readdirSync(HISTORY).filter(f => f.endsWith(".json")).sort() : []);

const loadAll = cache(() => {
  const catalog = readJson<{ updated: string; updated_at?: string; cards: CatalogRow[] }>(
    path.join(DATA, "catalog.json"), { updated: "", cards: [] });
  const setsFile = readJson<{ sets: { id: number; name: string; code: string; released: string | null }[] }>(
    path.join(DATA, "sets.json"), { sets: [] });
  const ratesFile = readJson<{ date: string; rates: Record<string, number> } | null>(
    path.join(DATA, "rates.json"), null);

  // The arrows compare with the latest saved day before the catalog's day.
  const earlier = historyFiles().filter(f => f.replace(".json", "") < catalog.updated);
  const previous = earlier.length
    ? readJson<{ date: string; prices: Record<string, [number | null, number | null]> }>(
        path.join(HISTORY, earlier[earlier.length - 1]), { date: "", prices: {} })
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

  // Every set tcgcsv lists gets a page, even before its products appear,
  // so notifications about upcoming sets always have somewhere to go.
  const sets: SetInfo[] = setsFile.sets.map(s => {
    const items = products.filter(p => p.set === s.name);
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

  return { products, sets, meta, byId: new Map(products.map(p => [p.id, p])) };
});

export const getProducts = () => loadAll().products;
export const getSets = () => loadAll().sets;
export const getMeta = () => loadAll().meta;
export const getProduct = (id: string) => loadAll().byId.get(id) ?? null;
export const getSet = (slug: string) => loadAll().sets.find(s => s.slug === slug) ?? null;

// Every saved day's price for one product, oldest first. Days where the
// product wasn't listed are left out rather than filled in.
export const getHistory = cache((id: string): PricePoint[] => {
  const points: PricePoint[] = [];
  for (const file of historyFiles()) {
    const snap = readJson<{ date: string; prices: Record<string, [number | null, number | null]> }>(
      path.join(HISTORY, file), { date: "", prices: {} });
    const price = snap.prices[id];
    if (price) points.push({ date: snap.date, low: price[0], market: price[1] });
  }
  return points;
});

// Other printings of the same card number (alternate arts, foils, reprints).
// Matched only on the exact card number, never on the character's name.
export function getVariants(product: Product): Product[] {
  if (product.kind !== "card" || !product.number) return [];
  return getProducts().filter(p => p.number === product.number && p.id !== product.id);
}
