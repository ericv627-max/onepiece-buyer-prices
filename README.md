# One Piece TCG Buyer Price Lookup

Search any One Piece card and see what a buyer should offer for it.

- **Buyer's minimum** = TCGplayer lowest listing price × 0.80
- **Buyer's maximum** = TCGplayer lowest listing price × 0.90
- The market price is shown for reference.
- Prices reflect **all conditions** (not just Near Mint).

Data comes from [tcgcsv.com](https://tcgcsv.com), a free nightly copy of
TCGplayer's prices (One Piece is category 68 there). We never scrape
tcgplayer.com directly.

## What's in here

| File | What it does |
|---|---|
| `update_prices.py` | Downloads every One Piece set, card, and price into `prices.db` |
| `build_site.py` | Does the buyer math and builds the website into the `site` folder |
| `static/index.html` | The search page you see in the browser |
| `vercel.json` | Tells Vercel how to build the site |
| `.github/workflows/nightly-update.yml` | Asks Vercel to rebuild every night so prices stay fresh |

`prices.db` and `site/` get created when you run the scripts. They are not
saved in git.

You only need Python 3.9 or newer. No `pip install` needed.

## How the website works

1. `update_prices.py` downloads the prices into a SQLite database.
2. `build_site.py` reads the database, works out the buyer offers, and writes
   `site/cards.json` plus the search page.
3. The search page downloads `cards.json` once and searches it in your
   browser. No server code runs; the site is just two files.

On Vercel, steps 1 and 2 run every night (see "Hosting on Vercel" below).

## Trying it on your own computer

```bash
python update_prices.py      # about 1-2 minutes, there are 80+ sets
python build_site.py
python -m http.server --directory site 8000
```

Then open http://localhost:8000. (On a Mac, type `python3` instead of `python`.)

Search tips:
- Every word must match, so `luffy op05` finds Luffy cards from OP05, and
  `zoro manga` finds Zoro manga arts.
- `alt art` finds alternate arts, including older sets where TCGplayer
  calls them "Parallel".
- You can type a card number like `OP01-001`.
- The address bar keeps your search, so you can bookmark or share it.

The search includes every single card, DON!! cards and promos. Sealed
products like booster boxes are left out.

## Hosting on Vercel

One-time setup:

1. **Import the repo.** On vercel.com: Add New → Project → pick this GitHub
   repo → Deploy. `vercel.json` already has the build settings, so leave
   everything else as it is.
2. **Make a deploy hook.** In the Vercel project: Settings → Git → Deploy
   Hooks. Name it `nightly`, branch `main`, and click Create. Copy the link.
3. **Give the hook to GitHub.** In the GitHub repo: Settings → Secrets and
   variables → Actions → New repository secret. Name: `VERCEL_DEPLOY_HOOK`,
   value: the link you copied. Keep this link private; anyone who has it
   can trigger rebuilds.
4. **Test it.** In the GitHub repo: Actions → Nightly price update → Run
   workflow. A new deployment should show up on Vercel within a minute.

After that, the site rebuilds every night at 21:30 UTC, after tcgcsv
updates. Pushing new code to `main` also rebuilds it.

## What the "printing" label means

The label comes from the parts of the TCGplayer card name in (parentheses)
or [brackets], like `(Alternate Art)`, `(Manga)`, `(SP)` or
`(Judge Pack Vol. 2)`. A card with none of these shows **Regular**. A
**Foil** tag shows when TCGplayer lists that card as foil.

Some parentheses are part of the character's name, like `Mr.3 (Galdino)`.
These are listed in `NAME_LABELS` in `update_prices.py`. If a nickname shows
up as a printing on the website, add it to that list and push the change.

## How the database is laid out

- `cards`: one row per card printing with today's prices. A card can have more
  than one row if TCGplayer prices Normal and Foil separately.
- `price_history`: a copy of each day's prices, for the 30-day median upgrade.
- `info`: remembers the last update date for the page.

Want to look inside? Install [DB Browser for SQLite](https://sqlitebrowser.org)
and open `prices.db`.

## Changing the buyer percentages

Open `build_site.py` and change these two lines near the top, then push:

```python
BUYER_MIN_PERCENT = 0.80
BUYER_MAX_PERCENT = 0.90
```

The note on the page updates by itself.

## Future upgrades (not built yet)

1. **30-day median.** Each Vercel build starts fresh, so `price_history`
   only ever holds one day there. To build up 30 days, the nightly job needs
   somewhere to keep each day's prices, for example by saving a small daily
   file into the repo. Then `build_site.py` can work out the median.
2. **TCG API Pro plan.** Gives Near Mint–only prices and real sales data,
   so offers wouldn't have to mix all conditions together.
