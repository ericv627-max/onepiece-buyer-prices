"use client";
import { createContext, useContext } from "react";
import { CURRENCY_KEY, useStored } from "@/lib/store";
import { describeChange, formatMoney } from "@/lib/format";
import type { Change } from "@/lib/types";

// The day's exchange rates (from data/rates.json), handed down from the layout.
const RatesContext = createContext<{ date: string | null; rates: Record<string, number> }>({ date: null, rates: {} });

export function RatesProvider({ value, children }: { value: { date: string | null; rates: Record<string, number> }; children: React.ReactNode }) {
  return <RatesContext.Provider value={value}>{children}</RatesContext.Provider>;
}

export function useCurrency() {
  const { date, rates } = useContext(RatesContext);
  const chosen = useStored<string>(CURRENCY_KEY, "USD");
  const code = chosen === "USD" || rates[chosen] ? chosen : "USD";
  const rate = code === "USD" ? 1 : rates[code];
  return { code, rate, ratesDate: date, rates, format: (usd: number | null | undefined) => formatMoney(usd, code, rate) };
}

// A price in the visitor's chosen currency.
export function Money({ usd }: { usd: number | null | undefined }) {
  const { format } = useCurrency();
  return <>{format(usd)}</>;
}

export function Range({ min, max }: { min: number | null; max: number | null }) {
  const { format } = useCurrency();
  if (min === null || max === null) return <>No listing</>;
  return <>{format(min)} – {format(max)}</>;
}

// "▲ $1.20 (3.4%)": arrow and text, not colour alone.
export function ChangeTag({ change, withAmount = false, since }: { change: Change; withAmount?: boolean; since?: string | null }) {
  const { format } = useCurrency();
  const d = describeChange(change);
  if (!d || !change) return <span className="change none" title="Needs two days of saved prices">—</span>;
  const pct = `${Math.abs(change.percent).toFixed(1)}%`;
  const amt = `${change.amount > 0 ? "+" : "−"}${format(Math.abs(change.amount))}`;
  return (
    <span className={`change ${d.dir}`} title={`${d.label} ${since ? `since ${since}` : "since the previous day"}`}>
      <span aria-hidden="true">{d.arrow}</span>
      <span className="sr-only">{d.label}</span> {withAmount && d.dir !== "flat" ? `${amt} (${pct})` : d.dir === "flat" ? "0%" : pct}
    </span>
  );
}
