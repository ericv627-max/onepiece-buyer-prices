"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { PricePoint } from "@/lib/types";
import { shortDate } from "@/lib/format";
import { BRAND } from "@/lib/brand";
import { useCurrency } from "./money";

const RANGES = [["7D", 7], ["1M", 30], ["3M", 91], ["6M", 182], ["MAX", 0]] as const;
type RangeKey = (typeof RANGES)[number][0];

const DAY = 86400000;
const dayNum = (iso: string) => Math.round(Date.parse(iso + "T00:00:00Z") / DAY);
const isoOf = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);

// Smooth line through the points that never overshoots them (monotone cubic, Fritsch–Carlson), so a curve never
// suggests a price that wasn't there.
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}`;
  const n = pts.length, dx: number[] = [], m: number[] = [], t: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

// The price chart. It draws three things for the saved days: the market price, the lowest listing, and between
// them the "buyer zone", the band a buyer should offer (a share of the lowest listing), which is what this site is
// for. A beam follows the pointer (or arrow keys) and the readout above shows that day. Days before saving began
// are shown as a hatched "not recorded yet" stretch, never filled in.
export function PriceChart({ points, firstDay, buyer }: { points: PricePoint[]; firstDay: string | null; buyer: [number, number] }) {
  const { format } = useCurrency();
  const uid = useId().replace(/:/g, "");
  // Open on the smallest range that holds every saved day, so a few days fill the chart instead of a sliver.
  const [range, setRange] = useState<RangeKey>(() => {
    const saved = points.filter(p => p.market !== null || p.low !== null);
    if (saved.length < 2) return "7D";
    const span = dayNum(saved[saved.length - 1].date) - dayNum(saved[0].date) + 1;
    return (RANGES.find(([, d]) => d >= span)?.[0] ?? "MAX") as RangeKey;
  });
  const [active, setActive] = useState<number | null>(null);

  const recorded = useMemo(() => points.filter(p => p.market !== null || p.low !== null), [points]);
  const view = useMemo(() => {
    const endIso = recorded.length ? recorded[recorded.length - 1].date : firstDay ?? new Date().toISOString().slice(0, 10);
    const end = dayNum(endIso);
    const firstRec = recorded.length ? dayNum(recorded[0].date) : end;
    const days = RANGES.find(r => r[0] === range)![1] || Math.max(7, end - firstRec + 1);
    const start = end - (days - 1);
    return { start, end, days, firstRec, inRange: recorded.filter(p => dayNum(p.date) >= start) };
  }, [recorded, range, firstDay]);

  const { start, end, days, firstRec, inRange } = view;
  // Drawn at its real pixel width (not scaled), so text and strokes stay the same size on every screen.
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = Math.max(300, width), H = W < 560 ? 240 : 300, L = 4, R = W < 560 ? 72 : 84, T = 30, B = 34;
  const pw = W - L - R, ph = H - T - B;
  const x = (iso: string) => L + ((dayNum(iso) - start) / Math.max(1, days - 1)) * pw;

  const band = (p: PricePoint) => (p.low === null ? null : [p.low * buyer[0], p.low * buyer[1]] as const);
  const values = inRange.flatMap(p => [p.market, p.low, band(p)?.[0] ?? null]).filter((v): v is number => v !== null);
  let lo = values.length ? Math.min(...values) : 0, hi = values.length ? Math.max(...values) : 1;
  if (hi - lo < hi * 0.06) { const mid = (hi + lo) / 2 || 1; lo = mid * 0.94; hi = mid * 1.06; }
  const pad = (hi - lo) * 0.14;
  lo = Math.max(0, lo - pad); hi += pad;
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * ph;

  const pick = active ?? inRange.length - 1;
  const cur = inRange[pick];
  const prev = pick > 0 ? inRange[pick - 1] : null;
  const change = cur?.market != null && prev?.market != null ? cur.market - prev.market : null;
  const curBand = cur ? band(cur) : null;

  const marketPts = inRange.filter(p => p.market !== null).map(p => [x(p.date), y(p.market!)] as [number, number]);
  const lowPts = inRange.filter(p => p.low !== null).map(p => [x(p.date), y(p.low!)] as [number, number]);
  const withBand = inRange.filter(p => p.low !== null);
  const bandPath = withBand.length >= 2
    ? `${smoothPath(withBand.map(p => [x(p.date), y(band(p)![1])]))}L${[...withBand].reverse().map(p => `${x(p.date)},${y(band(p)![0])}`).join("L")}Z`
    : "";
  const marketLine = smoothPath(marketPts);
  const marketArea = marketPts.length >= 2 ? `${marketLine}L${marketPts[marketPts.length - 1][0]},${T + ph}L${marketPts[0][0]},${T + ph}Z` : "";

  const unrecordedTo = firstRec > start ? Math.min(end, firstRec) : null; // hatched stretch from start up to the first saved day
  const ticks = [lo + (hi - lo) * 0.2, lo + (hi - lo) * 0.55, lo + (hi - lo) * 0.9];

  function nearest(clientX: number, rect: DOMRect) {
    if (!inRange.length) return;
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0, dist = Infinity;
    inRange.forEach((p, i) => { const d = Math.abs(x(p.date) - px); if (d < dist) { dist = d; best = i; } });
    setActive(best);
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => nearest(e.clientX, e.currentTarget.getBoundingClientRect());
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!inRange.length) return;
    const i = pick;
    const next = e.key === "ArrowLeft" ? i - 1 : e.key === "ArrowRight" ? i + 1 : e.key === "Home" ? 0 : e.key === "End" ? inRange.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setActive(Math.max(0, Math.min(inRange.length - 1, next)));
  };
  const rangeIndex = RANGES.findIndex(r => r[0] === range);

  return (
    <section className="pchart" aria-label="Price history">
      <div className="pchart-head">
        <div className="pchart-readout" aria-live="polite">
          <span className="pchart-date">{cur ? shortDate(cur.date) : "No saved days yet"}{active === null && cur ? " · latest" : ""}</span>
          <div className="pchart-figures">
            <div className="fig market"><span>Market</span><b>{cur ? format(cur.market) : "—"}</b>
              {change !== null && <i className={change > 0 ? "up" : change < 0 ? "down" : "flat"}>{change > 0 ? "▲" : change < 0 ? "▼" : "■"} {format(Math.abs(change))} vs day before</i>}
            </div>
            <div className="fig low"><span>Lowest listing</span><b>{cur ? format(cur.low) : "—"}</b></div>
            <div className="fig zone"><span>Buyer zone</span><b>{curBand ? `${format(curBand[0])} – ${format(curBand[1])}` : "—"}</b></div>
          </div>
        </div>
        <div className="pchart-ranges" role="group" aria-label="Time range" style={{ ["--i" as string]: rangeIndex }}>
          <span className="pchart-thumb" aria-hidden="true" />
          {RANGES.map(([key]) => (
            <button key={key} type="button" aria-pressed={range === key} onClick={() => { setRange(key); setActive(null); }}>{key}</button>
          ))}
        </div>
      </div>

      <div ref={box} className="pchart-box">
      <svg key={range} viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="pchart-svg" tabIndex={0} role="img"
        aria-label={cur ? `Price history, ${range}. ${shortDate(cur.date)}: market ${format(cur.market)}, lowest listing ${format(cur.low)}. Use the arrow keys to move between days.` : "No price history saved yet."}
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={e => { if (e.pointerType === "mouse") setActive(null); }} onKeyDown={onKey}>
        <defs>
          <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "rgb(var(--accent-rgb))", stopOpacity: 0.32 }} />
            <stop offset="1" style={{ stopColor: "rgb(var(--accent-rgb))", stopOpacity: 0 }} />
          </linearGradient>
          <linearGradient id={`zone-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: "var(--accent-text)", stopOpacity: 0.10 }} />
            <stop offset="0.5" style={{ stopColor: "var(--accent-text)", stopOpacity: 0.30 }} />
            <stop offset="1" style={{ stopColor: "var(--accent-text)", stopOpacity: 0.16 }} />
          </linearGradient>
          <pattern id={`hatch-${uid}`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="9" className="hatch-line" />
          </pattern>
        </defs>

        {ticks.map(v => (
          <g key={v} className="grid">
            <line x1={L} x2={L + pw} y1={y(v)} y2={y(v)} />
            <text x={L + pw + 10} y={y(v) + 4}>{format(v)}</text>
          </g>
        ))}

        {unrecordedTo !== null && (
          <g className="unrecorded">
            <rect x={L} y={T} width={Math.max(0, x(isoOf(unrecordedTo)) - L)} height={ph} fill={`url(#hatch-${uid})`} />
            {x(isoOf(unrecordedTo)) - L > 120 && (
              <text x={L + (x(isoOf(unrecordedTo)) - L) / 2} y={T + ph / 2} textAnchor="middle">Not recorded yet</text>
            )}
            <line x1={x(isoOf(unrecordedTo))} x2={x(isoOf(unrecordedTo))} y1={T} y2={T + ph} className="since" />
            {(() => {
              const sx = x(isoOf(unrecordedTo)), right = sx > L + pw - 230; // near the right edge: put the label on the line's left
              return <text x={right ? sx - 8 : sx + 8} y={T - 10} textAnchor={right ? "end" : "start"} className="since-label">{BRAND} recording since {shortDate(isoOf(firstRec))}</text>;
            })()}
          </g>
        )}

        {bandPath && <path d={bandPath} className="zone" fill={`url(#zone-${uid})`} />}
        {marketArea && <path d={marketArea} fill={`url(#area-${uid})`} className="area" />}
        {lowPts.length >= 2 && <path d={smoothPath(lowPts)} className="low-line" />}
        {marketLine && <path d={marketLine} className="market-line" pathLength={1} />}

        {inRange.map((p, i) => p.market !== null && (
          <circle key={p.date} cx={x(p.date)} cy={y(p.market)} r={i === pick ? 0 : 3} className="node" />
        ))}

        {cur && (
          <g className="beam" transform={`translate(${x(cur.date)} 0)`}>
            <rect x={-14} y={T} width={28} height={ph} className="beam-glow" />
            <line x1={0} x2={0} y1={T} y2={T + ph} className="beam-line" />
            {curBand && <line x1={0} x2={0} y1={y(curBand[1])} y2={y(curBand[0])} className="beam-zone" />}
            {cur.low !== null && <circle cy={y(cur.low)} r={4.5} className="beam-low" />}
            {cur.market !== null && <><circle cy={y(cur.market)} r={11} className="beam-halo" /><circle cy={y(cur.market)} r={5.5} className="beam-dot" /></>}
            <text y={H - 12} textAnchor={x(cur.date) > W - R - 40 ? "end" : x(cur.date) < L + 40 ? "start" : "middle"} className="beam-date">{shortDate(cur.date)}</text>
          </g>
        )}

        {inRange.length === 1 && cur?.market != null && (
          <text x={x(cur.date) - 14} y={y(cur.market) - 16} textAnchor="end" className="one-day">One saved day so far</text>
        )}
        <text x={L} y={H - 12} className="edge-date">{shortDate(isoOf(start))}</text>
      </svg>
      </div>

      <p className="pchart-note">
        <span className="key market" /> Market price <span className="key low" /> Lowest listing <span className="key zone" /> Buyer zone ({Math.round(buyer[0] * 100)}–{Math.round(buyer[1] * 100)}% of the lowest listing)
        <span className="pchart-days"> · {recorded.length} saved {recorded.length === 1 ? "day" : "days"}, one more after each daily update</span>
      </p>
    </section>
  );
}
