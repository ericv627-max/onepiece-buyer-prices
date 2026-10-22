"use client";
import { useRef, type ReactNode } from "react";

// A card picture that leans toward the cursor, with a light sheen that follows it, like tilting a holo card
// under a lamp. It only reacts to a real mouse or pen (not touch), and does nothing for people who ask their
// system for reduced motion. The movement is written straight into CSS variables, so React never re-renders.
const MAX_TILT = 11; // degrees

export function Tilt({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; // 0..1
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.classList.add("tilting");
      el.style.setProperty("--ry", `${((x - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${((0.5 - y) * 2 * MAX_TILT).toFixed(2)}deg`);
      el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    });
  }

  function leave() {
    cancelAnimationFrame(frame.current);
    const el = ref.current;
    if (!el) return;
    el.classList.remove("tilting");
    for (const v of ["--rx", "--ry", "--mx", "--my"]) el.style.removeProperty(v);
  }

  return (
    <div ref={ref} className={`${className} tilt`} onPointerMove={move} onPointerLeave={leave}>
      {children}
      <span className="sheen" aria-hidden="true" />
    </div>
  );
}
