"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { PricePoint } from "@/lib/types";
import { shortDate } from "@/lib/format";
import { BRAND } from "@/lib/brand";
import { useCurrency } from "./money";

const RANGES = [["7D", 7], ["1M", 30], ["3M", 91], ["6M", 182], ["MAX", 0]] as const;
type RangeKey = (typeof RANGES)[number][0];

const DAY = 86400000;
const dayNum = (iso: string) => Math.round(Date.parse(iso + "T00:00:00Z") / DAY);
const isoOf = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Smooth line through the points that never overshoots them (monotone cubic, Fritsch–Carlson), so a curve never
// suggests a price that wasn't there. Besides the path it gives `at(x)`, the curve's height at any x, which is what
// lets the beam's dot ride the line between days instead of jumping from day to day.
function monotone(pts: [number, number][]) {
  const n = pts.length, dx: number[] = [], m: number[] = [], t: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0] || 1e-6; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  if (n >= 2) {
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
  }
  let d = n >= 2 ? `M${pts[0][0]},${pts[0][1]}` : "";
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  // The control points sit a third of the way along each gap, so x moves evenly with the curve parameter and
  // finding the height at an x needs no searching along the curve.
  const at = (px: number): number | null => {
    if (!n) return null;
    if (n === 1 || px <= pts[0][0]) return pts[0][1];
    if (px >= pts[n - 1][0]) return pts[n - 1][1];
    let lo = 0, hi = n - 2;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (pts[mid][0] <= px) lo = mid; else hi = mid - 1; }
    const i = lo, u = (px - pts[i][0]) / dx[i], h = dx[i] / 3, v = 1 - u;
    const c1 = pts[i][1] + t[i] * h, c2 = pts[i + 1][1] - t[i + 1] * h;
    return v * v * v * pts[i][1] + 3 * v * v * u * c1 + 3 * v * u * u * c2 + u * u * u * pts[i + 1][1];
  };
  return { d, at };
}

// A figure that counts to its new value instead of flicking to it.
function Num({ value, format }: { value: number | null; format: (v: number | null) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (value === null || from.current === null || reducedMotion()) { from.current = value; setShown(value); return; }
    const a = from.current, b = value, t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 320), e = 1 - Math.pow(1 - k, 3);
      from.current = a + (b - a) * e;
      setShown(from.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}

type View = { start: number; days: number; lo: number; hi: number };

// The price chart. It draws three things for the saved days: the market price, the lowest listing, and between
// them the "buyer zone", the band a buyer should offer (a share of the lowest listing), which is what this site is
// for. A beam glides after the pointer (or arrow keys), its dot riding the line, and the readout above counts to
// the nearest saved day. Changing the range zooms the same drawing rather than redrawing it. Days before saving
// began are shown as a hatched "not recorded yet" stretch, never filled in.
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
  const band = useCallback((low: number | null) => (low === null ? null : [low * buyer[0], low * buyer[1]] as const), [buyer]);

  // Where the chart is heading: the chosen range's days and a price scale that fits them.
  const target = useMemo(() => {
    const endIso = recorded.length ? recorded[recorded.length - 1].date : firstDay ?? new Date().toISOString().slice(0, 10);
    const end = dayNum(endIso);
    const firstRec = recorded.length ? dayNum(recorded[0].date) : end;
    const days = RANGES.find(r => r[0] === range)![1] || Math.max(7, end - firstRec + 1);
    const start = end - (days - 1);
    const inRange = recorded.filter(p => dayNum(p.date) >= start);
    const values = inRange.flatMap(p => [p.market, p.low, band(p.low)?.[0] ?? null]).filter((v): v is number => v !== null);
    let lo = values.length ? Math.min(...values) : 0, hi = values.length ? Math.max(...values) : 1;
    if (hi - lo < hi * 0.06) { const mid = (hi + lo) / 2 || 1; lo = mid * 0.94; hi = mid * 1.06; }
    const pad = (hi - lo) * 0.14;
    lo = Math.max(0, lo - pad); hi += pad;
    return { end, firstRec, inRange, view: { start, days, lo, hi } as View };
  }, [recorded, range, firstDay, band]);
  const { end, firstRec, inRange } = target;

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

  // Motion. The view (days and price scale) and the beam (a fractional day) ease toward their targets each frame,
  // and come to rest; nothing animates while nothing changes.
  const lastDay = inRange.length ? dayNum(inRange[inRange.length - 1].date) : end;
  const [anim, setAnim] = useState(() => ({ ...target.view, beam: lastDay }));
  const now = useRef(anim); // the eased values, read and written by the frame loop
  const goal = useRef({ ...target.view, beam: lastDay });
  const raf = useRef(0);
  const kick = useCallback(() => {
    if (reducedMotion()) { now.current = { ...goal.current }; setAnim(now.current); return; }
    if (raf.current) return;
    let prev = performance.now();
    const step = (t: number) => {
      const dt = Math.min(64, t - prev); prev = t;
      const kv = 1 - Math.exp(-dt / 120), kb = 1 - Math.exp(-dt / 55);
      const a = now.current, g = goal.current, n = { ...a };
      let moving = false;
      for (const k of ["start", "days", "lo", "hi"] as const) {
        n[k] = a[k] + (g[k] - a[k]) * kv;
        if (Math.abs(g[k] - n[k]) > Math.abs(g[k]) * 1e-4 + 1e-3) moving = true; else n[k] = g[k];
      }
      n.beam = a.beam + (g.beam - a.beam) * kb;
      if (Math.abs(g.beam - n.beam) > 0.002) moving = true; else n.beam = g.beam;
      now.current = n;
      setAnim(n);
      raf.current = moving ? requestAnimationFrame(step) : 0;
    };
    raf.current = requestAnimationFrame(step);
  }, []);
  useEffect(() => () => { cancelAnimationFrame(raf.current); raf.current = 0; }, []);
  useEffect(() => { goal.current = { ...target.view, beam: lastDay }; kick(); }, [target, lastDay, kick]);

  const { lo, hi } = anim;
  const x = (dn: number) => L + ((dn - anim.start) / Math.max(1, anim.days - 1)) * pw;
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * ph;
  const value = (py: number) => lo + (1 - (py - T) / ph) * (hi - lo);

  const pick = active ?? inRange.length - 1;
  const cur = inRange[pick];
  const prev = pick > 0 ? inRange[pick - 1] : null;
  const change = cur?.market != null && prev?.market != null ? cur.market - prev.market : null;
  const curBand = cur ? band(cur.low) : null;

  // Every saved day is drawn, not only the range's, and clipped to the plot, so changing range zooms the line.
  const market = monotone(recorded.filter(p => p.market !== null).map(p => [x(dayNum(p.date)), y(p.market!)]));
  const low = monotone(recorded.filter(p => p.low !== null).map(p => [x(dayNum(p.date)), y(p.low!)]));
  const withLow = recorded.filter(p => p.low !== null);
  const zoneTop = monotone(withLow.map(p => [x(dayNum(p.date)), y(band(p.low)![1])]));
  const zonePath = withLow.length >= 2 ? `${zoneTop.d}L${[...withLow].reverse().map(p => `${x(dayNum(p.date))},${y(band(p.low)![0])}`).join("L")}Z` : "";
  const mPts = recorded.filter(p => p.market !== null);
  const marketArea = mPts.length >= 2 ? `${market.d}L${x(dayNum(mPts[mPts.length - 1].date))},${T + ph}L${x(dayNum(mPts[0].date))},${T + ph}Z` : "";

  // The beam: its x follows the eased fractional day, its dots sit on the curves at that x.
  const bx = x(anim.beam);
  const bMarket = market.at(bx);
  const bLowY = low.at(bx);
  const bBand = bLowY === null ? null : band(value(bLowY));
  const idle = active === null;
  const liveM = mPts.length ? mPts[mPts.length - 1] : null;

  const sinceX = firstRec > anim.start ? x(Math.min(end, firstRec)) : null; // hatched stretch up to the first saved day
  const tv = target.view, ticks = [tv.lo + (tv.hi - tv.lo) * 0.2, tv.lo + (tv.hi - tv.lo) * 0.55, tv.lo + (tv.hi - tv.lo) * 0.9];

  function aim(clientX: number, rect: DOMRect) {
    if (!inRange.length) return;
    const px = ((clientX - rect.left) / rect.width) * W;
    const first = dayNum(inRange[0].date);
    const day = Math.max(first, Math.min(lastDay, tv.start + ((px - L) / pw) * (tv.days - 1)));
    let best = 0, dist = Infinity;
    inRange.forEach((p, i) => { const d = Math.abs(dayNum(p.date) - day); if (d < dist) { dist = d; best = i; } });
    setActive(best);
    goal.current.beam = day;
    kick();
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => aim(e.clientX, e.currentTarget.getBoundingClientRect());
  const rest = () => { setActive(null); goal.current.beam = lastDay; kick(); };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!inRange.length) return;
    const next = e.key === "ArrowLeft" ? pick - 1 : e.key === "ArrowRight" ? pick + 1 : e.key === "Home" ? 0 : e.key === "End" ? inRange.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const i = Math.max(0, Math.min(inRange.length - 1, next));
    setActive(i);
    goal.current.beam = dayNum(inRange[i].date);
    kick();
  };
  const rangeIndex = RANGES.findIndex(r => r[0] === range);
  const dateAnchor = bx > W - R - 40 ? "end" : bx < L + 40 ? "start" : "middle";

  return (
    <section className="pchart" aria-label="Price history">
      <div className="pchart-head">
        <div className="pchart-readout" aria-live="polite">
          <span className="pchart-date">{cur ? shortDate(cur.date) : "No saved days yet"}{idle && cur ? " · latest" : ""}</span>
          <div className="pchart-figures">
            <div className="fig market"><span>Market</span><b><Num value={cur?.market ?? null} format={format} /></b>
              {change !== null && <i className={change > 0 ? "up" : change < 0 ? "down" : "flat"}>{change > 0 ? "▲" : change < 0 ? "▼" : "■"} {format(Math.abs(change))} vs day before</i>}
            </div>
            <div className="fig low"><span>Lowest listing</span><b><Num value={cur?.low ?? null} format={format} /></b></div>
            <div className="fig zone"><span>Buyer zone</span><b>{curBand ? <><Num value={curBand[0]} format={format} /> – <Num value={curBand[1]} format={format} /></> : "—"}</b></div>
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
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className={`pchart-svg${idle ? " idle" : ""}`} tabIndex={0} role="img"
        aria-label={cur ? `Price history, ${range}. ${shortDate(cur.date)}: market ${format(cur.market)}, lowest listing ${format(cur.low)}. Use the arrow keys to move between days.` : "No price history saved yet."}
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={e => { if (e.pointerType === "mouse") rest(); }} onKeyDown={onKey}>
        <defs>
          <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "rgb(var(--accent-rgb))", stopOpacity: 0.34 }} />
            <stop offset="0.7" style={{ stopColor: "rgb(var(--accent-rgb))", stopOpacity: 0.06 }} />
            <stop offset="1" style={{ stopColor: "rgb(var(--accent-rgb))", stopOpacity: 0 }} />
          </linearGradient>
          <linearGradient id={`line-${uid}`} gradientUnits="userSpaceOnUse" x1={L} y1="0" x2={L + pw} y2="0">
            <stop offset="0" style={{ stopColor: "var(--link)" }} />
            <stop offset="1" style={{ stopColor: "var(--accent-text)" }} />
          </linearGradient>
          <linearGradient id={`zone-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: "var(--accent-text)", stopOpacity: 0.08 }} />
            <stop offset="0.5" style={{ stopColor: "var(--accent-text)", stopOpacity: 0.26 }} />
            <stop offset="1" style={{ stopColor: "var(--accent-text)", stopOpacity: 0.14 }} />
          </linearGradient>
          <linearGradient id={`beam-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--accent-text)", stopOpacity: 0 }} />
            <stop offset="0.45" style={{ stopColor: "var(--accent-text)", stopOpacity: 0.9 }} />
            <stop offset="1" style={{ stopColor: "var(--accent-text)", stopOpacity: 0 }} />
          </linearGradient>
          <radialGradient id={`glow-${uid}`}>
            <stop offset="0" style={{ stopColor: "rgb(var(--accent-rgb))", stopOpacity: 0.35 }} />
            <stop offset="1" style={{ stopColor: "rgb(var(--accent-rgb))", stopOpacity: 0 }} />
          </radialGradient>
          <pattern id={`hatch-${uid}`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="9" className="hatch-line" />
          </pattern>
          <clipPath id={`plot-${uid}`}><rect x={L} y={0} width={pw} height={H} /></clipPath>
          <clipPath id={`lit-${uid}`}><rect x={0} y={0} width={Math.max(0, bx + 1)} height={H} /></clipPath>
        </defs>

        {ticks.map((v, i) => {
          const ty = y(v);
          return ty >= T - 4 && ty <= T + ph + 4 && (
            <g key={i} className="grid">
              <line x1={L} x2={L + pw} y1={ty} y2={ty} />
              <text x={L + pw + 10} y={ty + 4}>{format(v)}</text>
            </g>
          );
        })}

        {sinceX !== null && (
          <g className="unrecorded">
            <rect x={L} y={T} width={Math.max(0, sinceX - L)} height={ph} fill={`url(#hatch-${uid})`} />
            {sinceX - L > 120 && <text x={L + (sinceX - L) / 2} y={T + ph / 2} textAnchor="middle">Not recorded yet</text>}
            <line x1={sinceX} x2={sinceX} y1={T} y2={T + ph} className="since" />
            {(() => {
              // Right of the line if it fits, else left of it, else a shorter wording on whichever side has more room.
              const long = `${BRAND} recording since ${shortDate(isoOf(firstRec))}`, short = `Since ${shortDate(isoOf(firstRec))}`;
              const fits = (s: string) => s.length * 6.6 + 8;
              const [text, right] = sinceX + fits(long) <= W ? [long, false] : sinceX - fits(long) >= 0 ? [long, true] : [short, W - sinceX < sinceX];
              return <text x={right ? sinceX - 8 : sinceX + 8} y={T - 10} textAnchor={right ? "end" : "start"} className="since-label">{text}</text>;
            })()}
          </g>
        )}

        <g clipPath={`url(#plot-${uid})`}>
          {zonePath && <path d={zonePath} className="zone" fill={`url(#zone-${uid})`} />}
          {marketArea && <path d={marketArea} fill={`url(#area-${uid})`} className="area" />}
          {low.d && <path d={low.d} className="low-line" />}
          {/* The line is lit up to the beam and dimmed after it, so scrubbing reads as "up to this day". */}
          {market.d && <path d={market.d} className="market-line dim" pathLength={1} />}
          {market.d && <path d={market.d} className="market-line lit" pathLength={1} stroke={`url(#line-${uid})`} clipPath={`url(#lit-${uid})`} />}
          {mPts.length <= 60 && mPts.map(p => {
            const nx = x(dayNum(p.date));
            return <circle key={p.date} cx={nx} cy={y(p.market!)} r={2.5} className={`node${nx > bx + 1 ? " after" : ""}`} />;
          })}
          {liveM && <circle cx={x(dayNum(liveM.date))} cy={y(liveM.market!)} r={6} className="live-ring" />}
        </g>

        {cur && (
          <g className="beam">
            <ellipse cx={bx} cy={bMarket ?? T + ph / 2} rx={46} ry={ph * 0.55} fill={`url(#glow-${uid})`} className="beam-glow" />
            <rect x={bx - 0.75} y={T} width={1.5} height={ph} fill={`url(#beam-${uid})`} className="beam-line" />
            {bBand && <line x1={bx} x2={bx} y1={y(bBand[1])} y2={y(bBand[0])} className="beam-zone" />}
            {bLowY !== null && <circle cx={bx} cy={bLowY} r={4} className="beam-low" />}
            {bMarket !== null && <><circle cx={bx} cy={bMarket} r={12} className="beam-halo" /><circle cx={bx} cy={bMarket} r={5.5} className="beam-dot" /></>}
            <text x={bx} y={H - 12} textAnchor={dateAnchor} className="beam-date">{shortDate(cur.date)}</text>
          </g>
        )}

        {inRange.length === 1 && cur?.market != null && bMarket !== null && (
          <text x={bx - 14} y={bMarket - 16} textAnchor="end" className="one-day">One saved day so far</text>
        )}
        {bx - L > 90 && <text x={L} y={H - 12} className="edge-date">{shortDate(isoOf(tv.start))}</text>}
      </svg>
      </div>

      <p className="pchart-note">
        <span className="key market" /> Market price <span className="key low" /> Lowest listing <span className="key zone" /> Buyer zone ({Math.round(buyer[0] * 100)}–{Math.round(buyer[1] * 100)}% of the lowest listing)
        <span className="pchart-days"> · {recorded.length} saved {recorded.length === 1 ? "day" : "days"}, one more after each daily update</span>
      </p>
    </section>
  );
}
