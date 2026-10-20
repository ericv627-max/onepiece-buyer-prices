"""
build_site.py
-------------
Turns the saved price data into the website Vercel publishes.

Run it after update_prices.py:

    python update_prices.py
    python build_site.py

It reads:
    data/catalog.json      - every card with today's prices (from update_prices.py)
    data/history/*.json    - one file of prices per day, for the up/down arrows

and creates a "site" folder with two files:
    site/index.html  - the search page (copied from static/index.html)
    site/cards.json  - every card with its buyer prices and price change worked out

The search page downloads cards.json once and searches it right in the
browser, so the website doesn't need a Python server running.

To preview the site on your own computer:

    python -m http.server --directory site 8000

then open http://localhost:8000
"""

import json
import shutil
from pathlib import Path

HERE = Path(__file__).parent
DATA_DIR = HERE / "data"
CATALOG_PATH = DATA_DIR / "catalog.json"
HISTORY_DIR = DATA_DIR / "history"
SETS_PATH = DATA_DIR / "sets.json"
RATES_PATH = DATA_DIR / "rates.json"
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


def load_optional(path, default):
    """Read a JSON file if it's there, otherwise use the default."""
    return json.loads(path.read_text()) if path.exists() else default


def load_previous_prices(today):
    """
    Find the most recent history file from BEFORE today and return
    (its date, {card id: [low, market]}). Returns (None, {}) when there isn't one yet.
    """
    earlier = sorted(p for p in HISTORY_DIR.glob("*.json") if p.stem < today)
    if not earlier:
        return None, {}
    snapshot = json.loads(earlier[-1].read_text())
    return snapshot["date"], snapshot["prices"]


def price_change(now, before):
    """
    How much the market price moved since the previous day.
    The market price (recent sales) is steadier than the lowest listing,
    which can jump around when one cheap copy is listed or sold.
    """
    if now is None or not before:
        return None
    if before <= 0:
        return None
    return {"amount": round(now - before, 2), "percent": round((now - before) / before * 100, 1)}


def main():
    if not CATALOG_PATH.exists():
        # First run on a new computer: there's no saved data yet, so download it once.
        print("data/catalog.json not found, so downloading prices first ...")
        import update_prices
        update_prices.main()

    catalog = json.loads(CATALOG_PATH.read_text())
    previous_date, previous = load_previous_prices(catalog["updated"])
    # Optional extras: set release dates and exchange rates. The site works without them.
    sets = load_optional(SETS_PATH, {"sets": []})["sets"]
    released = {s["name"]: s["released"] for s in sets}
    rates = load_optional(RATES_PATH, None)

    cards = []
    for row in sorted(catalog["cards"], key=lambda r: (r["name"], r["card_number"], r["printing"])):
        buyer_min, buyer_max = buyer_prices(row["low_price"])
        before = previous.get(row["id"])
        cards.append({
            "id": row["id"],
            "name": row["name"],
            "set": row["set_name"],
            "number": row["card_number"],
            "rarity": row["rarity"],
            "released": released.get(row["set_name"]),  # the set's release date, for "Newest first"
            "printing": row["printing"],
            "foil": row["sub_type"] == "Foil",
            "image": row["image_url"],
            "url": row["tcgplayer_url"],
            "low": row["low_price"],
            "market": row["market_price"],
            "buyer_min": buyer_min,
            "buyer_max": buyer_max,
            "change": price_change(row["market_price"], before[1] if before else None),
        })

    # Start with an empty "site" folder each time.
    shutil.rmtree(SITE_DIR, ignore_errors=True)
    SITE_DIR.mkdir()

    data = {
        "updated": catalog["updated"],
        "updated_at": catalog["updated_at"],    # UTC, e.g. "2026-10-19T21:31:05+00:00"
        "change_since": previous_date,          # the day the arrows compare against
        "buyer_min_percent": BUYER_MIN_PERCENT,
        "buyer_max_percent": BUYER_MAX_PERCENT,
        "rates": rates,                         # {"base": "USD", "date": ..., "rates": {"EUR": 0.89, ...}}
        "sets": sets,                           # every set with code and release date, newest first
        "cards": cards,
    }
    # separators=(",", ":") leaves out spaces so the file downloads faster.
    (SITE_DIR / "cards.json").write_text(json.dumps(data, separators=(",", ":")))
    shutil.copy(HERE / "static" / "index.html", SITE_DIR / "index.html")

    compared = f", price changes compared with {previous_date}" if previous_date else ", no earlier day to compare with yet"
    print(f"Built the site with {len(cards)} cards in the '{SITE_DIR.name}' folder{compared}.")


if __name__ == "__main__":
    main()
