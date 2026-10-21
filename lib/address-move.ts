// Moving people from the old address to the new one without losing what they saved.
// Browser storage belongs to one address, so the old site packs its saved keys into the
// link it forwards to (after the #, which never reaches a server) and the new site unpacks them.
export const OLD_HOST = "onepiece-buyer-prices.vercel.app";
export const SITE_HOST = "holomark.vercel.app";
export const MOVE_PREFIX = "#move=";
const KEY_PREFIX = "vendr."; // every saved key; see lib/brand.ts for why it keeps the old name

type Saved = Record<string, string>;

// Everything this browser saved for the site, as raw stored strings.
export function collect(storage: Pick<Storage, "length" | "key" | "getItem">): Saved {
  const saved: Saved = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !key.startsWith(KEY_PREFIX)) continue;
    const value = storage.getItem(key);
    if (value !== null) saved[key] = value;
  }
  return saved;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

// The address on the new site for the same page, carrying the saved data if there is any.
export function moveUrl(path: string, saved: Saved): string {
  const hasData = Object.keys(saved).length > 0;
  return `https://${SITE_HOST}${path}${hasData ? MOVE_PREFIX + toBase64Url(JSON.stringify(saved)) : ""}`;
}

// Reads the data back out of a #move= hash. Returns null for anything that isn't a valid move.
export function readMove(hash: string): Saved | null {
  if (!hash.startsWith(MOVE_PREFIX)) return null;
  try {
    const data = JSON.parse(fromBase64Url(hash.slice(MOVE_PREFIX.length)));
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const saved: Saved = {};
    for (const [k, v] of Object.entries(data)) if (k.startsWith(KEY_PREFIX) && typeof v === "string") saved[k] = v;
    return saved;
  } catch {
    return null;
  }
}

// Writes moved data without overwriting anything already saved on the new address.
// Returns how many keys were written.
export function applyMove(storage: Pick<Storage, "getItem" | "setItem">, saved: Saved): number {
  let written = 0;
  for (const [k, v] of Object.entries(saved)) {
    if (storage.getItem(k) !== null) continue;
    storage.setItem(k, v);
    written++;
  }
  return written;
}
