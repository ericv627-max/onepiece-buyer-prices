"use client";
import { useState } from "react";
import type { SetInfo } from "@/lib/types";
import { SetGrid } from "./browser";
import { SearchInput } from "./search-input";

export function SetsList({ sets }: { sets: SetInfo[] }) {
  const [q, setQ] = useState("");
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const w = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = sets
    .filter(s => w.every(word => `${s.name} ${s.code}`.toLowerCase().includes(word)))
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
      <p className="count"><b>{shown.length}</b> sets</p>
      <SetGrid sets={shown} />
    </>
  );
}
