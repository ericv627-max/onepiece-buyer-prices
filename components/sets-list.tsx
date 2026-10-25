"use client";
import { useState } from "react";
import type { SetInfo } from "@/lib/types";
import { isDeckSet, isUpcoming } from "@/lib/format";
import { SetGrid } from "./browser";
import { SearchInput } from "./search-input";

export function SetsList({ sets }: { sets: SetInfo[] }) {
  const [q, setQ] = useState("");
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const w = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = sets.filter(s => !isDeckSet(s)).filter(s => w.every(word => `${s.name} ${s.code}`.toLowerCase().includes(word)));
  // Sets that haven't dropped get their own row at the top, soonest first.
  const soon = matching.filter(s => isUpcoming(s.released)).sort((a, b) => a.released!.localeCompare(b.released!));
  const shown = matching
    .filter(s => !isUpcoming(s.released))
    .sort((a, b) => (order === "newest" ? -1 : 1) * (a.released ?? "").localeCompare(b.released ?? ""));
  return (
    <>
      <div className="toolbar">
        <div className="grow"><SearchInput value={q} onChange={setQ} placeholder="Search sets by name or code (OP05, EB02…)" label="Search sets" /></div>
        <label className="sort">Order
          <select value={order} onChange={e => setOrder(e.target.value as "newest" | "oldest")}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>
      {soon.length > 0 && (
        <section id="coming-soon" className="coming-soon" aria-labelledby="coming-soon-title">
          <h2 id="coming-soon-title">Coming soon <span>{soon.length} {soon.length === 1 ? "set" : "sets"} awaiting drop</span></h2>
          <SetGrid sets={soon} />
        </section>
      )}
      <p className="count"><b>{shown.length}</b> released sets</p>
      <SetGrid sets={shown} />
    </>
  );
}
