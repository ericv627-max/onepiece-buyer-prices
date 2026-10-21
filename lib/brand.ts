// The site's name, in one place. Change it here and the page titles, footer, copy and the
// portfolio backup file all follow. The logo (components/logo.tsx) does not: it is drawn
// artwork with the name in it, so a rename means redrawing it.
//
// Saved data keeps the old "vendr." prefix on its browser storage keys (see lib/store.ts
// and lib/portfolio-store.ts) on purpose: renaming the keys would silently empty
// everyone's saved wishlist and portfolio.
export const BRAND = "HOLOMARK";
