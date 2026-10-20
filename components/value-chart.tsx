"use client";
import { useMemo, useState } from "react";
import { fromCents, holdingsChangedBetween, rangeSeries, RANGES, type PortfolioEvent, type Range, type SeriesPoint } from "@/lib/portfolio";
import { shortDate } from "@/lib/format";
import { useCurrency } from "./money";

// The portfolio's value on each day there are saved prices. Only real days are
// drawn; a day where a holding had no saved price is marked and explained.
export function ValueChart({ series, events, loading, error, trackingSince }: {
  series: SeriesPoint[];
  events: PortfolioEvent[];
  loading: boolean;
  error: string | null;
  trackingSince: string | null;
}) {
  const { format } = useCurrency();
  const [range, setRange] = useState<Range>("MAX");
  const [hover, setHover] = useState<number | null>(null);

  const shown = useMemo(() => rangeSeries(series, range), [series, range]);
  const W = 640, H = 220, PAD = 28;
  const usd = shown.map(p => fromCents(p.valueCents));
  const min = Math.min(...usd), max = Math.max(...usd);
  const span = max - min || Math.max(max * 0.1, 1);
  const x = (i: number) => (shown.length === 1 ? W / 2 : PAD + (i / (shown.length - 1)) * (W - PAD * 2));
  const y = (v: number) => H - PAD - ((v - (min - span * 0.1)) / (span * 1.2)) * (H - PAD * 2);

  const active = hover ?? shown.length - 1;
  const first = shown[0], cur = shown[active], last = shown[shown.length - 1];
  const deltaCents = first && cur ? cur.valueCents - first.valueCents : 0;
  const pct = first && first.valueCents > 0 ? (deltaCents / first.valueCents) * 100 : null;
  const changedInside = first && last ? holdingsChangedBetween(events, first.date, last.date) : false;
  const partialInside = shown.some(p => p.missing > 0);

  const setByX = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    const i = shown.length === 1 ? 0 : Math.round(((px - PAD) / (W - PAD * 2)) * (shown.length - 1));
    setHover(Math.max(0, Math.min(shown.length - 1, i)));
  };

  if (error) return <div className="state error panel" role="alert">{error}</div>;
  if (loading) return <div className="state panel" aria-busy="true">Loading price history…</div>;
  if (series.length === 0) {
    return (
      <div className="state panel compact-state">
        <b>The value graph starts with the next daily price update.</b>
        <p className="help">VENDR records your holdings from {trackingSince ? shortDate(trackingSince) : "today"} and values them with each day’s saved prices. Earlier days can’t be rebuilt, so none are drawn.</p>
      </div>
    );
  }

  return (
    <section className="chart panel" aria-label="Portfolio value over time">
      <div className="chart-head">
        <div>
          <span className="label">Portfolio value</span>
          <div className="chart-value">{cur ? format(fromCents(cur.valueCents)) : "—"}</div>
          <span className="chart-sub">
            {cur ? shortDate(cur.date) : ""}
            {shown.length > 1 ? (
              <> · <span className={deltaCents > 0 ? "up" : deltaCents < 0 ? "down" : "flat"}>
                <span aria-hidden="true">{deltaCents >= 0 ? "▲" : "▼"}</span><span className="sr-only">{deltaCents >= 0 ? "Up" : "Down"}</span> {format(Math.abs(fromCents(deltaCents)))}{pct !== null ? ` (${Math.abs(pct).toFixed(1)}%)` : ""}
              </span> over this range</>
            ) : null}
          </span>
        </div>
        <div className="ranges" role="group" aria-label="Time range">
          {RANGES.map(key => <button key={key} type="button" aria-pressed={range === key} onClick={() => { setRange(key); setHover(null); }}>{key}</button>)}
        </div>
      </div>

      {shown.length < 2 ? (
        <p className="state compact">One day recorded so far. A line is drawn once there are two. Prices are saved once a day, so there is no intraday view.</p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="chart-svg"
          role="img"
          tabIndex={0}
          aria-label={`Portfolio value from ${shortDate(first.date)} to ${shortDate(last.date)}: ${format(fromCents(first.valueCents))} to ${format(fromCents(last.valueCents))}. Use the arrow keys to move between days.`}
          onPointerMove={e => setByX(e.clientX, e.currentTarget)}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={e => {
            if (e.key === "ArrowLeft") { e.preventDefault(); setHover(Math.max(0, active - 1)); }
            else if (e.key === "ArrowRight") { e.preventDefault(); setHover(Math.min(shown.length - 1, active + 1)); }
            else if (e.key === "Home") { e.preventDefault(); setHover(0); }
            else if (e.key === "End") { e.preventDefault(); setHover(shown.length - 1); }
            else if (e.key === "Escape") setHover(null);
          }}
        >
          <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className="axis" />
          <polyline className="line" points={shown.map((p, i) => `${x(i)},${y(usd[i])}`).join(" ")} />
          {shown.map((p, i) => (
            <circle key={p.date} cx={x(i)} cy={y(usd[i])} r={i === active ? 5 : 2.5} className={`dot${i === active ? " on" : ""}${p.missing > 0 ? " partial" : ""}`} />
          ))}
          <text x={PAD} y={H - 8} className="tick">{shortDate(first.date)}</text>
          <text x={W - PAD} y={H - 8} className="tick" textAnchor="end">{shortDate(last.date)}</text>
        </svg>
      )}

      {cur && cur.missing > 0 && (
        <p className="chart-note warn">{shortDate(cur.date)}: {cur.missing} {cur.missing === 1 ? "holding" : "holdings"} had no saved price that day, so {cur.missing === 1 ? "it isn’t" : "they aren’t"} in this value.</p>
      )}
      {changedInside && <p className="chart-note">You added, changed or removed holdings in this range, so the change includes that, not just price moves.</p>}
      {partialInside && !(cur && cur.missing > 0) && <p className="chart-note">Hollow dots mark days where some holdings had no saved price.</p>}
      <p className="chart-note">
        Built from the holdings you’d recorded on each day and that day’s saved prices{trackingSince ? `, starting ${shortDate(trackingSince)}` : ""}. Days before that aren’t shown.
      </p>

      <details className="chart-data">
        <summary>View the numbers</summary>
        <table>
          <caption className="sr-only">Portfolio value by day</caption>
          <thead><tr><th scope="col">Day</th><th scope="col">Value</th><th scope="col">Holdings priced</th></tr></thead>
          <tbody>
            {[...shown].reverse().map(p => (
              <tr key={p.date}><th scope="row">{shortDate(p.date)}</th><td>{format(fromCents(p.valueCents))}</td><td>{p.counted}{p.missing ? ` (+${p.missing} unpriced)` : ""}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
