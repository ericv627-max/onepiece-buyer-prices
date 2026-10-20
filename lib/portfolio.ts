// Portfolio maths. Pure functions with no runtime imports, so they can be tested
// with plain Node (lib/portfolio.test.ts) and used by the app unchanged.
//
// Money is added up in whole cents, so the rows you see always add up to the total.
import type { PricePoint, Product } from "./types";

// ---------- What's stored ----------
// One purchase = one lot. A holding is every lot of the same product.
export type Lot = {
  id: string;
  productId: string;       // Product.id, e.g. "668528-Foil" (each printing/language is its own product)
  qty: number;             // whole copies, at least 1
  unitCost: number | null; // US dollars paid per copy; null when unknown
  acquired: string;        // YYYY-MM-DD, as the owner says
};

// The portfolio is a log of changes, each stamped with when it was recorded in
// VENDR. Replaying the log up to a moment gives the holdings at that moment, which
// is what makes the value graph honest when quantities change.
export type PortfolioEvent =
  | { at: string; type: "add"; lot: Lot }
  | { at: string; type: "edit"; lot: Lot }
  | { at: string; type: "remove"; lotId: string };

export type PortfolioData = { version: 1; events: PortfolioEvent[] };
export const EMPTY_PORTFOLIO: PortfolioData = { version: 1, events: [] };

// Round half up to whole cents. Trimming to 15 significant digits first removes
// binary floating-point noise (1079.995 * 100 is 107999.49999999999 on its own).
export const toCents = (usd: number) => Math.round(Number((usd * 100).toPrecision(15)));
export const fromCents = (cents: number) => cents / 100;

// ---------- Replaying the log ----------
function sorted(events: PortfolioEvent[]): PortfolioEvent[] {
  // Stable, so two changes recorded in the same instant keep the order they were made.
  return [...events].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

// The lots owned at a moment (ISO time), or now when no moment is given.
export function lotsAt(events: PortfolioEvent[], at?: string): Lot[] {
  const lots = new Map<string, Lot>();
  for (const e of sorted(events)) {
    if (at !== undefined && e.at > at) break;
    if (e.type === "remove") lots.delete(e.lotId);
    else lots.set(e.lot.id, e.lot);
  }
  return [...lots.values()];
}

// ---------- Holdings ----------
export type Holding = {
  productId: string;
  qty: number;
  lots: Lot[];
  costKnownUnits: number;  // copies whose price paid is known
  costKnownCents: number;  // what those copies cost in total
  costComplete: boolean;   // every copy has a known price paid
};

export function groupHoldings(lots: Lot[]): Holding[] {
  const byProduct = new Map<string, Holding>();
  for (const lot of lots) {
    let h = byProduct.get(lot.productId);
    if (!h) byProduct.set(lot.productId, (h = { productId: lot.productId, qty: 0, lots: [], costKnownUnits: 0, costKnownCents: 0, costComplete: true }));
    h.qty += lot.qty;
    h.lots.push(lot);
    if (lot.unitCost === null) h.costComplete = false;
    else {
      h.costKnownUnits += lot.qty;
      h.costKnownCents += toCents(lot.unitCost) * lot.qty;
    }
  }
  return [...byProduct.values()];
}

export type Valued = Holding & {
  product: Product | null;        // null: TCGplayer no longer lists it
  status: "priced" | "unpriced" | "missing";
  unitCents: number | null;       // market price per copy
  valueCents: number | null;      // qty x market price
  dayChangeCents: number | null;  // what the day's move did to this holding's value
  gainCents: number | null;       // value - cost, only when the cost of every copy is known
};

// Total holding value = current market price x quantity owned.
export function valueHoldings(holdings: Holding[], byId: Map<string, Product>): Valued[] {
  return holdings.map(h => {
    const product = byId.get(h.productId) ?? null;
    if (!product) return { ...h, product: null, status: "missing", unitCents: null, valueCents: null, dayChangeCents: null, gainCents: null };
    if (product.market === null) return { ...h, product, status: "unpriced", unitCents: null, valueCents: null, dayChangeCents: null, gainCents: null };
    const unitCents = toCents(product.market);
    const valueCents = unitCents * h.qty;
    return {
      ...h,
      product,
      status: "priced",
      unitCents,
      valueCents,
      dayChangeCents: product.change ? toCents(product.change.amount) * h.qty : null,
      gainCents: h.costComplete ? valueCents - h.costKnownCents : null,
    };
  });
}

// ---------- Totals ----------
export type Totals = {
  holdings: number;
  units: number;
  valueCents: number;              // priced holdings only
  pricedHoldings: number;
  unpricedHoldings: number;        // no market price, or no longer listed: not counted in the value
  unpricedUnits: number;
  // Today's move, only over holdings that have a price change to compare.
  dayChangeCents: number | null;
  dayChangePct: number | null;
  dayChangeHoldings: number;       // how many holdings the figure is based on
  // Gain or loss, only over holdings where the price paid for every copy is known.
  gainCents: number | null;
  gainPct: number | null;
  gainHoldings: number;            // how many holdings the figure is based on
  gainComplete: boolean;           // true when that is every priced holding
};

export function totals(valued: Valued[]): Totals {
  const priced = valued.filter(v => v.status === "priced");
  const withChange = priced.filter(v => v.dayChangeCents !== null);
  const withGain = priced.filter(v => v.gainCents !== null);

  const valueCents = priced.reduce((s, v) => s + v.valueCents!, 0);
  const changeCents = withChange.reduce((s, v) => s + v.dayChangeCents!, 0);
  const changeBase = withChange.reduce((s, v) => s + v.valueCents! - v.dayChangeCents!, 0); // their value before today's move
  const gainCents = withGain.reduce((s, v) => s + v.gainCents!, 0);
  const costBase = withGain.reduce((s, v) => s + v.costKnownCents, 0);

  return {
    holdings: valued.length,
    units: valued.reduce((s, v) => s + v.qty, 0),
    valueCents,
    pricedHoldings: priced.length,
    unpricedHoldings: valued.length - priced.length,
    unpricedUnits: valued.filter(v => v.status !== "priced").reduce((s, v) => s + v.qty, 0),
    dayChangeCents: withChange.length ? changeCents : null,
    dayChangePct: withChange.length && changeBase > 0 ? (changeCents / changeBase) * 100 : null,
    dayChangeHoldings: withChange.length,
    gainCents: withGain.length ? gainCents : null,
    gainPct: withGain.length && costBase > 0 ? (gainCents / costBase) * 100 : null,
    gainHoldings: withGain.length,
    gainComplete: priced.length > 0 && withGain.length === priced.length,
  };
}

// ---------- Breakdown ----------
export type Group = { key: string; label: string; valueCents: number; pct: number; holdings: Valued[] };

// Splits the priced holdings by one category each (so nothing is counted twice).
// The biggest groups are kept and the small tail is combined into "Other".
// Holdings without a price are left out and handed back, never counted as $0.
export function breakdown(valued: Valued[], keyOf: (v: Valued) => string, maxGroups = 8) {
  const priced = valued.filter(v => v.status === "priced");
  const excluded = valued.filter(v => v.status !== "priced");
  const totalCents = priced.reduce((s, v) => s + v.valueCents!, 0);

  const byKey = new Map<string, Valued[]>();
  for (const v of priced) {
    const k = keyOf(v);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(v);
  }
  let groups: Group[] = [...byKey.entries()]
    .map(([key, holdings]) => ({ key, label: key, holdings, valueCents: holdings.reduce((s, v) => s + v.valueCents!, 0), pct: 0 }))
    .sort((a, b) => b.valueCents - a.valueCents || a.label.localeCompare(b.label));

  if (groups.length > maxGroups) {
    const head = groups.slice(0, maxGroups - 1);
    const tail = groups.slice(maxGroups - 1);
    const holdings = tail.flatMap(g => g.holdings);
    groups = [...head, { key: "__other", label: "Other", holdings, valueCents: tail.reduce((s, g) => s + g.valueCents, 0), pct: 0 }];
  }
  for (const g of groups) g.pct = totalCents > 0 ? (g.valueCents / totalCents) * 100 : 0;
  return { groups, totalCents, excluded };
}

// ---------- Most valuable ----------
// Ranked by total holding value (price x quantity), not by price per copy.
export function mostValuable(valued: Valued[], n = 10): Valued[] {
  return valued
    .filter(v => v.status === "priced")
    .sort((a, b) => b.valueCents! - a.valueCents! || (a.product!.name < b.product!.name ? -1 : 1))
    .slice(0, n);
}

// ---------- Value over time ----------
export type SeriesPoint = {
  date: string;        // YYYY-MM-DD (UTC, the day of the saved prices)
  valueCents: number;  // priced holdings only
  counted: number;     // holdings that had a saved price that day
  missing: number;     // holdings with no saved price that day, left out of the value
};

// The portfolio's value on each day there are saved prices, from the day holdings
// were first recorded. For each day it uses the holdings recorded AS OF THAT DAY
// (not today's) and that day's saved prices. Days a holding had no saved price are
// flagged (missing > 0) instead of being filled in.
export function valueSeries(events: PortfolioEvent[], history: Map<string, PricePoint[]>): SeriesPoint[] {
  const log = sorted(events);
  if (!log.length) return [];
  const start = log[0].at.slice(0, 10);

  const marketOn = new Map<string, Map<string, number | null>>();
  const dates = new Set<string>();
  for (const [id, points] of history) {
    const byDate = new Map<string, number | null>();
    for (const p of points) { byDate.set(p.date, p.market); if (p.date >= start) dates.add(p.date); }
    marketOn.set(id, byDate);
  }

  return [...dates].sort().map(date => {
    const holdings = groupHoldings(lotsAt(log, `${date}T23:59:59.999Z`));
    let valueCents = 0, counted = 0, missing = 0;
    for (const h of holdings) {
      const market = marketOn.get(h.productId)?.get(date) ?? null;
      if (market === null) missing++;
      else { valueCents += toCents(market) * h.qty; counted++; }
    }
    return { date, valueCents, counted, missing };
  });
}

export const RANGES = ["1D", "7D", "1M", "3M", "6M", "MAX"] as const;
export type Range = (typeof RANGES)[number];
const RANGE_DAYS: Record<Exclude<Range, "1D" | "MAX">, number> = { "7D": 7, "1M": 31, "3M": 92, "6M": 183 };

// Daily prices only, so "1D" means the last two saved days.
export function rangeSeries(series: SeriesPoint[], range: Range): SeriesPoint[] {
  if (range === "MAX" || series.length === 0) return series;
  if (range === "1D") return series.slice(-2);
  const last = Date.parse(series[series.length - 1].date);
  return series.filter(p => last - Date.parse(p.date) <= RANGE_DAYS[range] * 86400000);
}

// Did the owner add, change or remove anything between the first and last day shown?
// If so, the change in value includes that, not just market moves.
export function holdingsChangedBetween(events: PortfolioEvent[], firstDate: string, lastDate: string): boolean {
  return events.some(e => e.at.slice(0, 10) > firstDate && e.at.slice(0, 10) <= lastDate);
}

// ---------- Checking what a person types ----------
export type LotInput = { qty: unknown; unitCost: unknown; acquired: unknown };

export function validateLot(input: LotInput, today: string): { ok: true; qty: number; unitCost: number | null; acquired: string } | { ok: false; error: string } {
  const qty = Number(input.qty);
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, error: "Quantity must be a whole number, 1 or more." };
  if (qty > 100000) return { ok: false, error: "That quantity looks too large. Check it." };

  let unitCost: number | null = null;
  if (input.unitCost !== "" && input.unitCost !== null && input.unitCost !== undefined) {
    unitCost = Number(input.unitCost);
    if (!Number.isFinite(unitCost) || unitCost < 0) return { ok: false, error: "Price paid must be a number, 0 or more." };
    if (unitCost > 10000000) return { ok: false, error: "That price looks too large. Check it." };
    unitCost = fromCents(toCents(unitCost));
  }

  const acquired = String(input.acquired ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(acquired) || Number.isNaN(Date.parse(acquired))) return { ok: false, error: "Enter the date you got it." };
  if (acquired > today) return { ok: false, error: "The date you got it can't be in the future." };
  return { ok: true, qty, unitCost, acquired };
}
