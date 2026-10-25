// Formatting shared by server and browser.
import type { Change } from "./types";

export const CURRENCIES: [string, string][] = [
  ["USD", "US dollar"], ["CAD", "Canadian dollar"], ["EUR", "Euro"], ["GBP", "British pound"],
  ["AUD", "Australian dollar"], ["JPY", "Japanese yen"], ["CNY", "Chinese yuan"], ["KRW", "South Korean won"],
  ["NZD", "New Zealand dollar"], ["MXN", "Mexican peso"], ["BRL", "Brazilian real"], ["CHF", "Swiss franc"],
  ["SGD", "Singapore dollar"], ["HKD", "Hong Kong dollar"], ["PHP", "Philippine peso"], ["INR", "Indian rupee"],
  ["SEK", "Swedish krona"], ["NOK", "Norwegian krone"], ["DKK", "Danish krone"], ["PLN", "Polish złoty"],
];

// Turn 1079.5 USD into "$1,079.50" or, with a rate, "€961.70". A dash when there's no price.
export function formatMoney(usd: number | null | undefined, currency = "USD", rate = 1): string {
  if (usd === null || usd === undefined) return "—";
  return (usd * rate).toLocaleString("en-US", { style: "currency", currency });
}

export function coinFor(code: string): string {
  const parts = new Intl.NumberFormat("en-US", { style: "currency", currency: code }).formatToParts(0);
  const mark = (parts.find(p => p.type === "currency")?.value ?? code).replace(/^[A-Z]{2,}/, "");
  return mark || code.slice(-1);
}

// Starter decks, ultra decks and the other deck sets (ST-xx, SD01, LT-01, demo decks). There's no market for the decks
// themselves, so they're left off the set listings; their single cards stay in Products and on their set pages.
export function isDeckSet(s: { name: string; code?: string | null }): boolean {
  return /\bdeck\b/i.test(s.name) || /^(ST|SD|LT)-?\d/i.test(s.code ?? "");
}

// Sets that haven't released yet. Compared as YYYY-MM-DD strings against today's date in UTC, which matches how
// release dates are stored; a set flips to released on its release day.
export function isUpcoming(released: string | null | undefined): boolean {
  return !!released && released > new Date().toISOString().slice(0, 10);
}

// "Nov 20": for drop dates, where the year is obvious.
export function monthDay(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function shortDate(iso: string | null): string {
  if (!iso) return "Unknown";
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Arrow + words, so the change never relies on colour alone.
export function describeChange(change: Change) {
  if (!change) return null;
  if (Math.abs(change.percent) < 0.1) return { dir: "flat" as const, arrow: "▬", label: "No change" };
  const up = change.amount > 0;
  return { dir: up ? ("up" as const) : ("down" as const), arrow: up ? "▲" : "▼", label: up ? "Up" : "Down" };
}

export const RARITY_NAMES: Record<string, string> = {
  L: "Leader", C: "Common", UC: "Uncommon", R: "Rare", SR: "Super Rare",
  SEC: "Secret Rare", TR: "Treasure Rare", PR: "Promo", "DON!!": "DON!!",
};
