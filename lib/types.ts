// Shapes shared by the server (build time) and the browser.

export type Kind = "card" | "sealed";

export type Change = { amount: number; percent: number } | null;

export type Product = {
  id: string;            // TCGplayer product + Normal/Foil, e.g. "512345-Foil"
  kind: Kind;
  type: string;          // "Single Card", "Booster Box", "Starter Deck", ...
  name: string;
  set: string;
  setSlug: string;
  number: string;        // card number, "" for sealed
  rarity: string | null;
  printing: string;      // "Regular", "Alternate Art", "Sealed", ...
  foil: boolean;
  language: string;      // "English" for everything tcgcsv carries
  image: string;
  url: string;           // TCGplayer page
  low: number | null;    // lowest listing, USD
  market: number | null; // market price (recent sales), USD
  buyerMin: number | null;
  buyerMax: number | null;
  released: string | null; // the set's release date
  change: Change;          // market price move since the previous saved day
};

export type SetInfo = {
  id: number;
  name: string;
  slug: string;
  code: string;
  released: string | null;
  cards: number;
  sealed: number;
  image: string | null;  // most valuable product's picture
};

export type PricePoint = { date: string; low: number | null; market: number | null };

export type Meta = {
  updated: string;
  updatedAt: string | null;
  changeSince: string | null;
  buyerMinPercent: number;
  buyerMaxPercent: number;
  rates: { date: string; rates: Record<string, number> } | null;
};

// The compact search index the browser downloads once (/data/index.json).
export type IndexData = Meta & { products: Product[]; sets: SetInfo[] };
