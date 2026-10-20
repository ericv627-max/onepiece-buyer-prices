"use client";
import type { Group } from "@/lib/portfolio";

const R = 70;
const C = 2 * Math.PI * R;

// A ring split by each group's share of the value. The legend beside it (built by
// the page) is the main way to pick a group; clicking a segment does the same.
export function Donut({ groups, selectedKey, onSelect, label, sublabel }: {
  groups: Group[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  label: string;     // the big text in the middle
  sublabel: string;  // the small text under it
}) {
  let offset = 0;
  return (
    <svg viewBox="0 0 200 200" className="donut" role="group" aria-label="Holdings breakdown">
      <circle cx="100" cy="100" r={R} className="donut-track" />
      {groups.map((g, i) => {
        const length = Math.max((g.pct / 100) * C, 0);
        const seg = (
          <circle
            key={g.key}
            cx="100" cy="100" r={R}
            className={`donut-seg${selectedKey === g.key ? " on" : ""}${selectedKey && selectedKey !== g.key ? " dim" : ""}`}
            style={{ stroke: g.key === "__other" ? "var(--seg-other)" : `var(--seg-${(i % 8) + 1})` }}
            strokeDasharray={`${length} ${C - length}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 100 100)"
            tabIndex={0}
            role="button"
            aria-pressed={selectedKey === g.key}
            aria-label={`${g.label}: ${g.pct.toFixed(1)}%`}
            onClick={() => onSelect(selectedKey === g.key ? null : g.key)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(selectedKey === g.key ? null : g.key); } }}
          />
        );
        offset += length;
        return seg;
      })}
      <text x="100" y="98" textAnchor="middle" className="donut-main">{label}</text>
      <text x="100" y="116" textAnchor="middle" className="donut-sub">{sublabel}</text>
    </svg>
  );
}
