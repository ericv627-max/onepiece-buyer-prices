"use client";
import { useMemo, useState } from "react";
import type { PricePoint } from "@/lib/types";
import { shortDate } from "@/lib/format";
import { useCurrency } from "./money";

const RANGES = [["7D", 7], ["1M", 31], ["3M", 92], ["6M", 183], ["MAX", Infinity]] as const;

// Market price over the saved days. Only real saved days are drawn; days with
// no price are gaps, never filled in.
export function PriceChart({ points, firstDay }: { points: PricePoint[]; firstDay: string | null }) {
  const { format } = useCurrency();
  const [range, setRange] = useState<(typeof RANGES)[number][0]>("MAX");
  const [hover, setHover] = useState<number | null>(null);

  const shown = useMemo(() => {
    const days = RANGES.find(r => r[0] === range)![1];
    const last = points.length ? Date.parse(points[points.length - 1].date) : 0;
    return points.filter(p => p.market !== null && (days === Infinity || last - Date.parse(p.date) <= days * 86400000));
  }, [points, range]);

  const W = 640, H = 220, PAD = 28;
  const values = shown.map(p => p.market!);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || Math.max(max * 0.1, 1);
  const x = (i: number) => (shown.length === 1 ? W / 2 : PAD + (i / (shown.length - 1)) * (W - PAD * 2));
  const y = (v: number) => H - PAD - ((v - (min - span * 0.1)) / (span * 1.2)) * (H - PAD * 2);

  const active = hover ?? shown.length - 1;
  const first = shown[0], cur = shown[active];
  const delta = first && cur ? cur.market! - first.market! : 0;
  const pct = first && first.market ? (delta / first.market) * 100 : 0;

  return (
    <div className="chart panel">
      <div className="chart-head">
        <div>
          <span className="label">Market price</span>
          <div className="chart-value">{cur ? format(cur.market) : "—"}</div>
          <span className="chart-sub">
            {cur ? shortDate(cur.date) : ""}
            {shown.length > 1 ? <> · <span className={delta > 0 ? "up" : delta < 0 ? "down" : "flat"}>{delta >= 0 ? "▲" : "▼"} {format(Math.abs(delta))} ({Math.abs(pct).toFixed(1)}%)</span> over this range</> : null}
          </span>
        </div>
        {points.length >= 2 && (
          <div className="ranges" role="group" aria-label="Time range">
            {RANGES.map(([key]) => (
              <button key={key} type="button" aria-pressed={range === key} onClick={() => { setRange(key); setHover(null); }}>{key}</button>
            ))}
          </div>
        )}
      </div>
      {shown.length < 2 ? (
        <p className="state compact">
          {shown.length === 0 ? "No saved market price for this product yet." : "One saved day so far. A line is drawn once there are two."}
        </p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img"
          aria-label={`Market price from ${shortDate(shown[0].date)} to ${shortDate(shown[shown.length - 1].date)}: ${format(values[0])} to ${format(values[values.length - 1])}`}
          onPointerMove={e => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            const i = shown.length === 1 ? 0 : Math.round(((px - PAD) / (W - PAD * 2)) * (shown.length - 1));
            setHover(Math.max(0, Math.min(shown.length - 1, i)));
          }}
          onPointerLeave={() => setHover(null)}>
          <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className="axis" />
          {shown.length > 1 && <polyline className="line" points={shown.map((p, i) => `${x(i)},${y(p.market!)}`).join(" ")} />}
          {shown.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.market!)} r={i === active ? 5 : 2.5} className={i === active ? "dot on" : "dot"} />)}
          <text x={PAD} y={H - 8} className="tick">{shortDate(shown[0].date)}</text>
          <text x={W - PAD} y={H - 8} className="tick" textAnchor="end">{shortDate(shown[shown.length - 1].date)}</text>
        </svg>
      )}
      <p className="chart-note">
        {points.length < 2
          ? `VENDR started saving daily prices on ${shortDate(firstDay)}. The line fills in one point per day from there; older history isn't available.`
          : `${points.length} saved days. Prices are saved once a day, after TCGplayer's daily update.`}
      </p>
    </div>
  );
}
