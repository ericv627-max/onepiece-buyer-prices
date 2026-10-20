"use client";
// The portfolio, saved in this browser until accounts exist. Every change is
// appended to a log (see lib/portfolio.ts), nothing is ever overwritten, so the
// value graph can replay the holdings of any past day.
import { EMPTY_PORTFOLIO, validateLot, type Lot, type PortfolioData, type PortfolioEvent } from "./portfolio";
import { readStored, useStored, write } from "./store";

export const PORTFOLIO_KEY = "vendr.portfolio.v1";
const MAX_EVENTS = 20000;

export function usePortfolio(): PortfolioData {
  return useStored<PortfolioData>(PORTFOLIO_KEY, EMPTY_PORTFOLIO);
}

function load(): PortfolioData {
  const data = readStored<PortfolioData>(PORTFOLIO_KEY, EMPTY_PORTFOLIO);
  return data && data.version === 1 && Array.isArray(data.events) ? data : EMPTY_PORTFOLIO;
}

function append(event: PortfolioEvent) {
  write(PORTFOLIO_KEY, { version: 1, events: [...load().events, event] } satisfies PortfolioData);
}

const nowIso = () => new Date().toISOString();
// The date on the owner's own calendar (not UTC), for the "date you got it" box.
export function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export function addLot(input: { productId: string; qty: number; unitCost: number | null; acquired: string }): Lot {
  const lot: Lot = { id: newId(), ...input };
  append({ at: nowIso(), type: "add", lot });
  return lot;
}
export const editLot = (lot: Lot) => append({ at: nowIso(), type: "edit", lot });
export const removeLot = (lotId: string) => append({ at: nowIso(), type: "remove", lotId });

// ---------- Backup and restore ----------
export function exportPortfolio(): string {
  return JSON.stringify({ app: "VENDR", exported: nowIso(), ...load() }, null, 2);
}

// Checks every part of a file before replacing anything.
export function importPortfolio(text: string): { ok: true; events: number } | { ok: false; error: string } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: "That file isn't a VENDR backup (it isn't valid JSON)." }; }
  const data = raw as Partial<PortfolioData> | null;
  if (!data || data.version !== 1 || !Array.isArray(data.events)) return { ok: false, error: "That file isn't a VENDR portfolio backup." };
  if (data.events.length > MAX_EVENTS) return { ok: false, error: "That backup is too large." };

  const events: PortfolioEvent[] = [];
  for (const [i, e] of (data.events as PortfolioEvent[]).entries()) {
    const where = `Event ${i + 1}`;
    if (!e || typeof e.at !== "string" || Number.isNaN(Date.parse(e.at))) return { ok: false, error: `${where} has no valid time.` };
    if (e.type === "remove") {
      if (typeof e.lotId !== "string" || !e.lotId) return { ok: false, error: `${where} is missing the lot to remove.` };
      events.push({ at: e.at, type: "remove", lotId: e.lotId });
    } else if (e.type === "add" || e.type === "edit") {
      const l = e.lot;
      if (!l || typeof l.id !== "string" || !l.id || typeof l.productId !== "string" || !l.productId) return { ok: false, error: `${where} has an incomplete holding.` };
      // Backups may hold dates up to the day they were made, so only check the shape here.
      const checked = validateLot({ qty: l.qty, unitCost: l.unitCost, acquired: l.acquired }, "9999-12-31");
      if (!checked.ok) return { ok: false, error: `${where}: ${checked.error}` };
      events.push({ at: e.at, type: e.type, lot: { id: l.id, productId: l.productId, qty: checked.qty, unitCost: checked.unitCost, acquired: checked.acquired } });
    } else {
      return { ok: false, error: `${where} has an unknown type.` };
    }
  }
  write(PORTFOLIO_KEY, { version: 1, events } satisfies PortfolioData);
  return { ok: true, events: events.length };
}
