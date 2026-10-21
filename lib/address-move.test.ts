// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMove, collect, moveUrl, readMove, SITE_HOST } from "./address-move.ts";

function memory(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    map: m,
  };
}

test("saved data survives the trip to the new address", () => {
  const old = memory({
    "vendr.wishlist": JSON.stringify(["1-Normal", "2-Foil"]),
    "vendr.portfolio.v1": JSON.stringify({ version: 1, events: [{ note: "Luffy’s alt art ✓" }] }),
    "vendr.name": "Kevin",
    "other.key": "not ours",
  });
  const url = moveUrl("/portfolio?view=list", collect(old));
  assert.ok(url.startsWith(`https://${SITE_HOST}/portfolio?view=list#move=`));
  const moved = readMove(url.slice(url.indexOf("#")));
  assert.ok(moved);
  const fresh = memory();
  assert.equal(applyMove(fresh, moved), 3);
  assert.equal(fresh.map.get("vendr.name"), "Kevin");
  assert.equal(fresh.map.get("vendr.portfolio.v1"), old.getItem("vendr.portfolio.v1"));
  assert.equal(fresh.map.has("other.key"), false);
});

test("nothing saved means a plain forward", () => {
  assert.equal(moveUrl("/", collect(memory())), `https://${SITE_HOST}/`);
});

test("data already on the new address is never overwritten", () => {
  const fresh = memory({ "vendr.name": "New" });
  assert.equal(applyMove(fresh, { "vendr.name": "Old", "vendr.currency": "\"EUR\"" }), 1);
  assert.equal(fresh.map.get("vendr.name"), "New");
});

test("broken or foreign hashes are ignored", () => {
  assert.equal(readMove("#top"), null);
  assert.equal(readMove("#move=%%%"), null);
  assert.equal(readMove("#move=" + btoa("[1,2]")), null);
});
