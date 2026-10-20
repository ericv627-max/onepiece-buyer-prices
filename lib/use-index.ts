"use client";
import { useEffect, useState } from "react";
import type { IndexData } from "./types";

// The whole catalog, downloaded once per visit and shared by every component.
let pending: Promise<IndexData> | null = null;
let loaded: IndexData | null = null;

function load(): Promise<IndexData> {
  if (!pending) {
    pending = fetch("/data/index.json")
      .then(r => {
        if (!r.ok) throw new Error(`Couldn't load prices (${r.status})`);
        return r.json() as Promise<IndexData>;
      })
      .then(d => (loaded = d))
      .catch(err => { pending = null; throw err; });
  }
  return pending;
}

export function useIndex(): { data: IndexData | null; error: string | null } {
  const [data, setData] = useState<IndexData | null>(loaded);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (loaded) return;
    let live = true;
    load().then(d => live && setData(d), e => live && setError(String(e.message || e)));
    return () => { live = false; };
  }, []);
  return { data, error };
}
