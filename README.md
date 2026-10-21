# HOLOMARK

**Price it. Stack it. Flip it.**

One Piece Card Game prices, sets and sealed products, updated daily from TCGplayer.
Search any card or sealed product, see what a buyer should offer, track price history,
keep a wishlist, and run a portfolio of what you own.

- **Buyer pays** = 80% to 90% of TCGplayer's lowest listing. The market price (recent sales) is shown for reference.
- Prices reflect all conditions, not just Near Mint.
- Prices are in US dollars, with a currency picker that converts using the day's exchange rates.

## What's in the app

| Page | What it does |
|---|---|
| Home | Landing page: the slogan, what the site does, two ways in (Products and Portfolio) and three headline numbers. Search is the button in the top bar |
| Products | Grid or list, sort, filters (set, language, product type, rarity, price). Everything stays in the address bar |
| Product (`/product?id=...`) | One page for every card and sealed product: prices, price history chart, other printings, wishlist, add to portfolio |
| Sets and set pages | Every release, newest first, with scoped search and set analytics |
| Wishlist | Saved on this device, one entry per product variant |
| Portfolio | Holdings with quantities and what you paid, total value, daily change, gain or loss, a value graph, breakdown, most valuable, market trends, backup and restore |

Wishlist and portfolio are saved in the browser until accounts exist (Google sign-in is the next step).

## Where the data comes from

[tcgcsv.com](https://tcgcsv.com) is a free daily copy of TCGplayer's catalog and prices
(One Piece is category 68). It updates once a day, around 20:00 UTC. We never scrape tcgplayer.com.

Limits worth knowing:

- **English only, mostly.** The category is the English game. It also lists a few Japanese-version items (the anniversary sets), which HOLOMARK labels as Japanese. Full Japanese card prices need another source.
- **No sales data.** tcgcsv gives prices, not individual sales, so there is no sales volume and HOLOMARK doesn't estimate any.
- **History starts on Oct 20, 2026.** tcgcsv withdrew its price archive, so earlier days can't be rebuilt. Charts fill in one point per day.

## How it works

1. A GitHub job (`.github/workflows/nightly-update.yml`) runs every day at 21:30 UTC. It runs `update_prices.py`, which downloads everything and saves:
   - `data/catalog.json`: every product with today's prices
   - `data/history/<date>.json`: that day's prices, kept forever
   - `data/sets.json`: every set with its release date
   - `data/rates.json`: exchange rates
2. It checks the download is complete, commits those files, and Vercel rebuilds the site from the commit. Vercel never downloads prices itself.
3. The site is a static Next.js export (`next build` writes `out/`). Pages read the saved files at build time:
   - `/data/index.json`: the catalog the browser downloads once and searches locally
   - `/data/h/00.json ... 63.json`: price history in 64 small files, so a page loads only the slice it needs
4. Everything else (search, filters, wishlist, portfolio) runs in the browser.

## Working on it

```
npm install
npm run dev          # http://localhost:3000
npm test             # portfolio maths (Node's built-in test runner)
npx tsc --noEmit     # type check
npm run build        # writes out/
```

Pushing to any branch runs the **Check** workflow (Python checks, tests, type check, build).
You can run **Nightly price update** by hand from the Actions tab on any branch.

### Files

- `update_prices.py`: downloads prices; names sealed product types and languages
- `lib/portfolio.ts` + `lib/portfolio.test.ts`: portfolio maths, tested
- `lib/data.ts`: build-time data layer (computed once per build)
- `lib/brand.ts`: the site's name, in one place. Saved data keeps the old `vendr.` key prefix in the browser on purpose, so a rename never empties anyone's wishlist or portfolio
- `components/logo.tsx`: the logo, drawn as vector paths (Outfit Bold letters, with the M as a rising price line). It is artwork, so a rename means redrawing it. `app/icon.svg` is the matching tab icon
- `components/`, `app/`: the pages
- `app/globals.css`, `app/portfolio.css`: the design system (tokens at the top: colours, the one accent, corner radius, glass)
- `components/flow.tsx`: the arch of light behind the whole site, drawn with WebGL. It barely moves, takes its colours from the tokens, stops for reduced motion, and falls back to a still glow where WebGL isn't available

### Changing the buyer percentages

Edit `BUYER_MIN_PERCENT` and `BUYER_MAX_PERCENT` in `lib/data.ts`, then push.

### If a name shows up as a printing

Some parentheses in TCGplayer names are part of a character's name, like `Mr.3 (Galdino)`.
These are listed in `NAME_LABELS` in `update_prices.py`. Add new ones there.
