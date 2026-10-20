"use client";
import { useEffect, useState } from "react";
import { shardFile, shardOf, type Shard } from "./history";
import type { PricePoint } from "./types";

// Each history file is downloaded at most once per visit and shared.
const shards = new Map<number, Promise<Shard>>();

function loadShard(n: number): Promise<Shard> {
  let pending = shards.get(n);
  if (!pending) {
    pending = fetch(shardFile(n)).then(r => {
      if (!r.ok) throw new Error(`Couldn't load price history (${r.status})`);
      return r.json() as Promise<Shard>;
    });
    pending.catch(() => shards.delete(n)); // allow a retry next time
    shards.set(n, pending);
  }
  return pending;
}

// The saved days for several products at once (used by the portfolio graph).
export async function loadHistory(ids: string[]): Promise<Map<string, PricePoint[]>> {
  const needed = [...new Set(ids.map(shardOf))];
  const loaded = await Promise.all(needed.map(loadShard));
  const byShard = new Map(needed.map((n, i) => [n, loaded[i]] as const));
  return new Map(ids.map(id => [
    id,
    (byShard.get(shardOf(id))?.[id] ?? []).map(([date, low, market]) => ({ date, low, market })),
  ]));
}

// One product's saved days, or null while loading.
export function useHistory(id: string | null): { points: PricePoint[] | null; error: string | null } {
  const [state, setState] = useState<{ id: string; points: PricePoint[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let live = true;
    setError(null);
    loadHistory([id]).then(
      m => live && setState({ id, points: m.get(id) ?? [] }),
      e => live && setError(String(e.message || e)),
    );
    return () => { live = false; };
  }, [id]);
  return { points: state && state.id === id ? state.points : null, error };
}
