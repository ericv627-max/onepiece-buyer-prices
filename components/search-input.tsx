"use client";
import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/types";

// The search box: when empty, a grey hint types out a real product every few
// seconds; Tab (or →) searches it. People who prefer less motion get it swapped
// in without the typing.
export function SearchInput({
  value, onChange, onSubmit, placeholder, pool, autoFocus, big, label = "Search products",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: (v: string) => void;
  placeholder: string;
  pool?: Product[];
  autoFocus?: boolean;
  big?: boolean;
  label?: string;
}) {
  const [hint, setHint] = useState("");
  const suggestion = useRef("");

  useEffect(() => {
    const items = (pool ?? []).filter(p => p.number && (p.market ?? 0) >= 5);
    if (!items.length) return;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pick = () => {
      const p = items[Math.floor(Math.random() * items.length)];
      return `${p.name.replace(/\s*[(\[].*$/, "").replace(/\s+-\s+.*$/, "")} ${p.number}`;
    };
    let text = pick(), typed = 0, holdUntil = 0;
    if (calm) {
      const swap = () => { text = pick(); suggestion.current = text; setHint(text); };
      swap();
      const t = setInterval(swap, 4000);
      return () => clearInterval(t);
    }
    const t = setInterval(() => {
      const now = Date.now();
      if (typed < text.length) {
        typed++;
        setHint(text.slice(0, typed) + (typed < text.length ? "▌" : ""));
        if (typed === text.length) { suggestion.current = text; holdUntil = now + 2600; }
      } else if (now > holdUntil) {
        text = pick(); typed = 0;
      }
    }, 55);
    return () => clearInterval(t);
  }, [pool]);

  const showHint = !value && hint;
  return (
    <form
      className={`search${big ? " big" : ""}`}
      role="search"
      onSubmit={e => {
        e.preventDefault();
        const v = value || suggestion.current;
        if (!value && v) onChange(v);
        onSubmit?.(v);
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        aria-label={label}
        placeholder={showHint ? hint : placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if ((e.key === "Tab" || e.key === "ArrowRight") && !value && suggestion.current) {
            e.preventDefault();
            onChange(suggestion.current);
            onSubmit?.(suggestion.current);
          }
        }}
      />
      {showHint && suggestion.current ? <span className="search-tip" aria-hidden="true"><kbd>Tab</kbd> to search this</span> : null}
      {value ? <button type="button" className="search-clear" aria-label="Clear search" onClick={() => onChange("")}>×</button> : null}
    </form>
  );
}
