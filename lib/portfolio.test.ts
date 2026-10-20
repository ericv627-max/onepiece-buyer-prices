// Run with: npm test   (Node's built-in test runner, no extra packages)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  breakdown, groupHoldings, holdingsChangedBetween, lotsAt, mostValuable, rangeSeries, toCents,
  totals, validateLot, valueHoldings, valueSeries,
  type Lot, type PortfolioEvent,
} from "./portfolio.ts";
import type { Product } from "./types.ts";

// A minimal product: only the fields the maths reads.
function product(id: string, market: number | null, extra: Partial<Product> = {}): Product {
  return {
    id, kind: "card", type: "Single Card", name: `Card ${id}`, set: "Set A", setSlug: "set-a", number: "OP01-001", rarity: "R",
    printing: "Regular", foil: false, language: "English", image: "", url: "", low: market, market, buyerMin: null, buyerMax: null,
    released: "2026-01-01", change: null, ...extra,
  };
}
const catalog = (...items: Product[]) => new Map(items.map(p => [p.id, p]));
const lot = (id: string, productId: string, qty: number, unitCost: number | null = null): Lot => ({ id, productId, qty, unitCost, acquired: "2026-10-01" });
const add = (at: string, l: Lot): PortfolioEvent => ({ at, type: "add", lot: l });

test("replaying the log gives the lots owned at any moment", () => {
  const events: PortfolioEvent[] = [
    add("2026-10-01T10:00:00Z", lot("a", "p1", 2)),
    add("2026-10-02T10:00:00Z", lot("b", "p2", 1)),
    { at: "2026-10-03T10:00:00Z", type: "edit", lot: lot("a", "p1", 5) },
    { at: "2026-10-04T10:00:00Z", type: "remove", lotId: "b" },
  ];
  const qty = (at?: string) => Object.fromEntries(lotsAt(events, at).map(l => [l.id, l.qty]));
  assert.deepEqual(qty("2026-10-01T23:59:59Z"), { a: 2 });
  assert.deepEqual(qty("2026-10-02T23:59:59Z"), { a: 2, b: 1 });
  assert.deepEqual(qty("2026-10-03T23:59:59Z"), { a: 5, b: 1 });
  assert.deepEqual(qty(), { a: 5 }); // now
});

test("log order doesn't depend on the order events were stored", () => {
  const later: PortfolioEvent = { at: "2026-10-03T00:00:00Z", type: "edit", lot: lot("a", "p1", 9) };
  const first: PortfolioEvent = add("2026-10-01T00:00:00Z", lot("a", "p1", 1));
  assert.equal(lotsAt([later, first])[0].qty, 9);
});

test("holding value is market price x quantity, in whole cents", () => {
  const h = groupHoldings([lot("a", "p1", 2)]);
  const [v] = valueHoldings(h, catalog(product("p1", 50)));
  assert.equal(v.valueCents, 10000); // $100.00
  assert.equal(v.unitCents, 5000);
});

test("copies bought in separate lots are one holding with their costs kept apart", () => {
  const [h] = groupHoldings([lot("a", "p1", 2, 10), lot("b", "p1", 3, 20)]);
  assert.equal(h.qty, 5);
  assert.equal(h.lots.length, 2);
  assert.equal(h.costKnownCents, 2 * 1000 + 3 * 2000);
  assert.equal(h.costComplete, true);
  const [partial] = groupHoldings([lot("a", "p1", 2, 10), lot("b", "p1", 3, null)]);
  assert.equal(partial.costComplete, false);
  assert.equal(partial.costKnownUnits, 2);
});

test("the portfolio total equals the sum of the valued holdings", () => {
  const items = [product("p1", 12.34), product("p2", 0.07), product("p3", 999.99)];
  const valued = valueHoldings(groupHoldings([lot("a", "p1", 3), lot("b", "p2", 41), lot("c", "p3", 2)]), catalog(...items));
  const t = totals(valued);
  assert.equal(t.valueCents, valued.reduce((s, v) => s + v.valueCents!, 0));
  assert.equal(t.valueCents, 3 * 1234 + 41 * 7 + 2 * 99999);
  assert.equal(t.units, 46);
});

test("unpriced and delisted holdings are reported, never counted as $0", () => {
  const valued = valueHoldings(
    groupHoldings([lot("a", "p1", 2), lot("b", "p2", 4), lot("c", "gone", 1)]),
    catalog(product("p1", 10), product("p2", null)),
  );
  assert.deepEqual(valued.map(v => v.status), ["priced", "unpriced", "missing"]);
  const t = totals(valued);
  assert.equal(t.valueCents, 2000);
  assert.equal(t.pricedHoldings, 1);
  assert.equal(t.unpricedHoldings, 2);
  assert.equal(t.unpricedUnits, 5);
});

test("today's change only counts holdings that have a price change", () => {
  const valued = valueHoldings(
    groupHoldings([lot("a", "p1", 2), lot("b", "p2", 1), lot("c", "p3", 1)]),
    catalog(
      product("p1", 11, { change: { amount: 1, percent: 10 } }),   // was $10
      product("p2", 90, { change: { amount: -10, percent: -10 } }), // was $100
      product("p3", 500),                                           // no change data
    ),
  );
  const t = totals(valued);
  assert.equal(t.dayChangeCents, 2 * 100 - 1000); // +$2 - $10
  assert.equal(t.dayChangeHoldings, 2);
  // Before the move those two holdings were worth 2x$10 + $100 = $120; -$8 is -6.67%.
  assert.ok(Math.abs(t.dayChangePct! - (-800 / 12000) * 100) < 1e-9);
  const none = totals(valueHoldings(groupHoldings([lot("a", "p3", 1)]), catalog(product("p3", 5))));
  assert.equal(none.dayChangeCents, null);
  assert.equal(none.dayChangePct, null);
});

test("gain or loss needs the price paid for every copy, and says how many holdings it covers", () => {
  const items = catalog(product("p1", 30), product("p2", 50));
  // Complete: bought 2 x $20 and 1 x $60.
  const full = totals(valueHoldings(groupHoldings([lot("a", "p1", 2, 20), lot("b", "p2", 1, 60)]), items));
  assert.equal(full.gainComplete, true);
  assert.equal(full.gainCents, (2 * 3000 + 5000) - (2 * 2000 + 6000)); // 11000 - 10000 = +$10
  assert.ok(Math.abs(full.gainPct! - 10) < 1e-9);
  // Partial: p2's cost is unknown, so it's left out of the gain and the figure says so.
  const partial = totals(valueHoldings(groupHoldings([lot("a", "p1", 2, 20), lot("b", "p2", 1, null)]), items));
  assert.equal(partial.gainComplete, false);
  assert.equal(partial.gainHoldings, 1);
  assert.equal(partial.gainCents, 2 * 3000 - 2 * 2000);
  // A holding where only some copies have a cost is not counted at all.
  const mixed = totals(valueHoldings(groupHoldings([lot("a", "p1", 2, 20), lot("b", "p1", 1, null)]), items));
  assert.equal(mixed.gainCents, null);
  // No costs at all: no gain claimed.
  const none = totals(valueHoldings(groupHoldings([lot("a", "p1", 2)]), items));
  assert.equal(none.gainCents, null);
  assert.equal(none.gainComplete, false);
});

test("breakdown never double counts and its shares add up", () => {
  const items = [
    product("p1", 100, { set: "Set A", language: "English" }),
    product("p2", 50, { set: "Set B", language: "English" }),
    product("p3", 25, { set: "Set B", language: "Japanese" }),
    product("p4", null, { set: "Set C" }),
  ];
  const valued = valueHoldings(groupHoldings([lot("a", "p1", 1), lot("b", "p2", 2), lot("c", "p3", 4), lot("d", "p4", 3)]), catalog(...items));
  const bySet = breakdown(valued, v => v.product!.set);
  assert.equal(bySet.totalCents, 10000 + 10000 + 10000);
  assert.equal(bySet.groups.reduce((s, g) => s + g.valueCents, 0), bySet.totalCents);
  assert.ok(Math.abs(bySet.groups.reduce((s, g) => s + g.pct, 0) - 100) < 1e-9);
  assert.equal(bySet.excluded.length, 1); // the unpriced Set C holding is reported, not valued at $0
  assert.equal(bySet.groups.find(g => g.label === "Set B")!.holdings.length, 2);
  // Every holding is in exactly one group.
  const ids = bySet.groups.flatMap(g => g.holdings.map(h => h.productId));
  assert.equal(new Set(ids).size, ids.length);
});

test("small groups are combined into Other without losing value", () => {
  const items = Array.from({ length: 12 }, (_, i) => product(`p${i}`, 100 - i, { set: `Set ${i}` }));
  const valued = valueHoldings(groupHoldings(items.map((p, i) => lot(`l${i}`, p.id, 1))), catalog(...items));
  const result = breakdown(valued, v => v.product!.set, 5);
  assert.equal(result.groups.length, 5);
  assert.equal(result.groups[4].key, "__other");
  assert.equal(result.groups[4].holdings.length, 8);
  assert.equal(result.groups.reduce((s, g) => s + g.valueCents, 0), result.totalCents);
});

test("most valuable ranks by total holding value, not price per copy", () => {
  const valued = valueHoldings(
    groupHoldings([lot("a", "cheap", 5), lot("b", "pricey", 1), lot("c", "unpriced", 9)]),
    catalog(product("cheap", 30), product("pricey", 100), product("unpriced", null)),
  );
  const top = mostValuable(valued);
  assert.deepEqual(top.map(v => v.productId), ["cheap", "pricey"]); // 5 x $30 = $150 beats 1 x $100
  assert.equal(top[0].valueCents, 15000);
  assert.equal(mostValuable(valued, 1).length, 1);
});

const history = (id: string, market: Record<string, number | null>) =>
  [id, Object.entries(market).map(([date, m]) => ({ date, low: m, market: m }))] as const;

test("the value graph uses the holdings of each day, not today's", () => {
  const events: PortfolioEvent[] = [
    add("2026-10-02T09:00:00Z", lot("a", "p1", 1)),
    add("2026-10-04T09:00:00Z", lot("b", "p1", 1)), // a second copy arrives on the 4th
  ];
  const prices = new Map([history("p1", { "2026-10-01": 100, "2026-10-02": 110, "2026-10-03": 120, "2026-10-04": 130 })]);
  const series = valueSeries(events, prices);
  assert.deepEqual(series.map(p => p.date), ["2026-10-02", "2026-10-03", "2026-10-04"]); // starts when holdings were first recorded
  assert.deepEqual(series.map(p => p.valueCents), [11000, 12000, 26000]); // 1 copy, 1 copy, then 2 copies
  assert.ok(series.every(p => p.missing === 0));
});

test("removing a holding drops it from later days only", () => {
  const events: PortfolioEvent[] = [
    add("2026-10-01T09:00:00Z", lot("a", "p1", 3)),
    { at: "2026-10-03T09:00:00Z", type: "remove", lotId: "a" },
  ];
  const prices = new Map([history("p1", { "2026-10-01": 10, "2026-10-02": 10, "2026-10-03": 10 })]);
  assert.deepEqual(valueSeries(events, prices).map(p => p.valueCents), [3000, 3000, 0]);
});

test("a day with no saved price is flagged, not filled in", () => {
  const events: PortfolioEvent[] = [add("2026-10-01T09:00:00Z", lot("a", "p1", 1)), add("2026-10-01T09:05:00Z", lot("b", "p2", 2))];
  const prices = new Map([
    history("p1", { "2026-10-01": 10, "2026-10-02": 12 }),
    history("p2", { "2026-10-01": 5 }), // not listed on the 2nd
  ]);
  const [d1, d2] = valueSeries(events, prices);
  assert.deepEqual([d1.valueCents, d1.counted, d1.missing], [2000, 2, 0]);
  assert.deepEqual([d2.valueCents, d2.counted, d2.missing], [1200, 1, 1]);
});

test("no events means no graph", () => {
  assert.deepEqual(valueSeries([], new Map()), []);
});

test("ranges pick days from the end of the series", () => {
  const dates = ["2026-08-01", "2026-09-01", "2026-09-25", "2026-10-01", "2026-10-10", "2026-10-15"];
  const series = dates.map((date, i) => ({ date, valueCents: i * 100, counted: 1, missing: 0 }));
  assert.deepEqual(rangeSeries(series, "1D").map(p => p.date), ["2026-10-10", "2026-10-15"]);
  assert.deepEqual(rangeSeries(series, "7D").map(p => p.date), ["2026-10-10", "2026-10-15"]);
  assert.deepEqual(rangeSeries(series, "1M").map(p => p.date), ["2026-09-25", "2026-10-01", "2026-10-10", "2026-10-15"]);
  assert.equal(rangeSeries(series, "MAX").length, dates.length);
  assert.deepEqual(rangeSeries([], "7D"), []);
});

test("changes inside a range are detected so the graph can say so", () => {
  const events: PortfolioEvent[] = [add("2026-10-02T09:00:00Z", lot("a", "p1", 1)), add("2026-10-05T09:00:00Z", lot("b", "p1", 1))];
  assert.equal(holdingsChangedBetween(events, "2026-10-02", "2026-10-04"), false);
  assert.equal(holdingsChangedBetween(events, "2026-10-02", "2026-10-05"), true);
});

test("what a person types is checked", () => {
  const ok = validateLot({ qty: "3", unitCost: "12.345", acquired: "2026-10-01" }, "2026-10-20");
  assert.deepEqual(ok, { ok: true, qty: 3, unitCost: 12.35, acquired: "2026-10-01" }); // rounded to cents
  const unknownCost = validateLot({ qty: 1, unitCost: "", acquired: "2026-10-20" }, "2026-10-20");
  assert.deepEqual(unknownCost, { ok: true, qty: 1, unitCost: null, acquired: "2026-10-20" });
  for (const bad of [
    { qty: 0, unitCost: "", acquired: "2026-10-01" },
    { qty: 1.5, unitCost: "", acquired: "2026-10-01" },
    { qty: "abc", unitCost: "", acquired: "2026-10-01" },
    { qty: 1, unitCost: "-5", acquired: "2026-10-01" },
    { qty: 1, unitCost: "abc", acquired: "2026-10-01" },
    { qty: 1, unitCost: "", acquired: "not a date" },
    { qty: 1, unitCost: "", acquired: "2026-11-01" }, // future
    { qty: 999999, unitCost: "", acquired: "2026-10-01" },
  ]) {
    assert.equal(validateLot(bad, "2026-10-20").ok, false, JSON.stringify(bad));
  }
});

test("cents conversion rounds sensibly", () => {
  assert.equal(toCents(0.07), 7);
  assert.equal(toCents(1079.995), 108000);
  assert.equal(toCents(19.99), 1999);
});
