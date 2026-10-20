// Price history is saved in 64 small files (/data/h/00.json ... 63.json) so a
// page only downloads the slice of history it needs, however many days pile up.
export const SHARDS = 64;

// "668528-Foil" -> 668528 % 64
export function shardOf(id: string): number {
  const n = parseInt(id, 10);
  return Number.isFinite(n) ? n % SHARDS : 0;
}

export const shardName = (n: number) => `${String(n).padStart(2, "0")}.json`;
export const shardFile = (n: number) => `/data/h/${shardName(n)}`;

// { productId: [[date, lowest listing, market price], ...] }
export type Shard = Record<string, [string, number | null, number | null][]>;
