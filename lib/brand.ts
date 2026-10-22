// The site's name, in one place. Change it here and the page titles, footer, copy and the
// portfolio backup file all follow. The logo (components/logo.tsx) does not: it is drawn
// artwork with the name in it, so a rename means redrawing it.
//
// Saved data keeps the old "vendr." prefix on its browser storage keys (see lib/store.ts
// and lib/portfolio-store.ts) on purpose: renaming the keys would silently empty
// everyone's saved wishlist and portfolio.
export const BRAND = "HOLOMARK";

// Sealed products (boxes, packs, decks) are hidden from browsing for now, to be reworked later: Products, search,
// set pages and the home numbers show cards only. They stay in the data, so their product pages, and any already
// in a wishlist or portfolio, keep working. Set this to true to bring them back everywhere.
export const SHOW_SEALED = false;
