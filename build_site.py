"""
build_site.py
-------------
Turns prices.db into a website that can be hosted for free (GitHub Pages).

Run it after update_prices.py:

    python update_prices.py
    python build_site.py

It creates a "site" folder with two files:
    site/index.html  - the search page (copied from static/index.html)
    site/cards.json  - every card with its buyer prices already worked out

The search page downloads cards.json once and searches it right in the
browser, so the website doesn't need a Python server running.

To preview the site on your own computer:

    python -m http.server --directory site 8000

then open http://localhost:8000
"""

import json
import shutil
import sqlite3
from pathlib import Path

HERE = Path(__file__).parent
DB_PATH = HERE / "prices.db"
SITE_DIR = HERE / "site"

# ---------------------------------------------------------------------------
# The buyer pricing rule. Change these numbers to change the whole site.
# ---------------------------------------------------------------------------
BUYER_MIN_PERCENT = 0.80  # buyer's minimum offer = 80% of the listing price
BUYER_MAX_PERCENT = 0.90  # buyer's maximum offer = 90% of the listing price


def buyer_prices(listing_price):
    """
    Work out the buyer's offer range from the TCGplayer listing price.
    If there is no listing price, there is nothing to calculate.
    """
    if listing_price is None:
        return None, None
    return (
        round(listing_price * BUYER_MIN_PERCENT, 2),
        round(listing_price * BUYER_MAX_PERCENT, 2),
    )


def main():
    if not DB_PATH.exists():
        print("prices.db not found. Run 'python update_prices.py' first.")
        raise SystemExit(1)

    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row  # lets us use row["name"] instead of row[2]

    cards = []
    for row in db.execute("SELECT * FROM cards ORDER BY name, card_number, printing"):
        buyer_min, buyer_max = buyer_prices(row["low_price"])
        cards.append({
            "name": row["name"],
            "set": row["set_name"],
            "number": row["card_number"],
            "printing": row["printing"],
            "foil": row["sub_type"] == "Foil",
            "image": row["image_url"],
            "url": row["tcgplayer_url"],
            "low": row["low_price"],
            "market": row["market_price"],
            "buyer_min": buyer_min,
            "buyer_max": buyer_max,
        })

    updated = db.execute("SELECT value FROM info WHERE key = 'last_updated'").fetchone()
    updated_at = db.execute("SELECT value FROM info WHERE key = 'last_updated_at'").fetchone()
    db.close()

    # Start with an empty "site" folder each time.
    shutil.rmtree(SITE_DIR, ignore_errors=True)
    SITE_DIR.mkdir()

    data = {
        "updated": updated[0] if updated else None,
        "updated_at": updated_at[0] if updated_at else None,  # UTC, e.g. "2026-10-19T21:31:05+00:00"
        "buyer_min_percent": BUYER_MIN_PERCENT,
        "buyer_max_percent": BUYER_MAX_PERCENT,
        "cards": cards,
    }
    # separators=(",", ":") leaves out spaces so the file downloads faster.
    (SITE_DIR / "cards.json").write_text(json.dumps(data, separators=(",", ":")))
    shutil.copy(HERE / "static" / "index.html", SITE_DIR / "index.html")

    print(f"Built the site with {len(cards)} cards in the '{SITE_DIR.name}' folder.")


if __name__ == "__main__":
    main()
