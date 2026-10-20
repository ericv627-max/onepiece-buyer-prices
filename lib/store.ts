"use client";
// Small saved-in-this-browser stores (wishlist, currency, recent searches, name).
// Storage can be blocked (private windows), so every read and write is wrapped,
// and the page still works with nothing saved.
import { useSyncExternalStore } from "react";

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

function read<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { return fallback; }
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // The earlier one-page VENDR saved plain text (a name, a currency code).
    // Keep those instead of silently resetting them.
    return typeof fallback === "string" ? (raw as unknown as T) : fallback;
  }
}

// useSyncExternalStore needs the same object back until the value changes.
const snapshots = new Map<string, { raw: string | null; value: unknown }>();
function snapshot<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { /* blocked */ }
  const cached = snapshots.get(key);
  if (cached && cached.raw === raw) return cached.value as T;
  const value = raw === null ? fallback : read(key, fallback);
  snapshots.set(key, { raw, value });
  return value;
}

export function write<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not saved */ }
  listeners.get(key)?.forEach(l => l());
}

function subscribe(key: string, listener: Listener) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(listener);
  // Keep other tabs in step too.
  const onStorage = (e: StorageEvent) => { if (e.key === key) listener(); };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.get(key)!.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useStored<T>(key: string, fallback: T): T {
  return useSyncExternalStore(
    l => subscribe(key, l),
    () => snapshot(key, fallback),
    () => fallback, // while prerendering: nothing saved yet
  );
}

// ---------- Wishlist ----------
export const WISHLIST_KEY = "vendr.wishlist";
const EMPTY: string[] = [];

export function useWishlist(): string[] {
  return useStored<string[]>(WISHLIST_KEY, EMPTY);
}

export function toggleWishlist(id: string) {
  const list = read<string[]>(WISHLIST_KEY, []);
  // A Set keeps one entry per product variant, however often it's tapped.
  const next = new Set(list);
  if (next.has(id)) next.delete(id); else next.add(id);
  write(WISHLIST_KEY, [...next]);
}

// ---------- Recent searches ----------
export const RECENT_KEY = "vendr.recentSearches";
export function rememberSearch(query: string) {
  query = query.trim();
  if (query.length < 2) return;
  const list = read<string[]>(RECENT_KEY, []).filter(q => q.toLowerCase() !== query.toLowerCase());
  write(RECENT_KEY, [query, ...list].slice(0, 8));
}

// ---------- Currency and name ----------
export const CURRENCY_KEY = "vendr.currency";
export const NAME_KEY = "vendr.name";

// Read a saved value right now (for actions that change it).
export const readStored = read;
