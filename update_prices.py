"""
update_prices.py
----------------
Downloads One Piece TCG card data + prices from tcgcsv.com and saves them
into a local SQLite database file (prices.db).

Run it once a day (see README.md for how to schedule it):

    python update_prices.py

Where the data comes from
-------------------------
tcgcsv.com is a free nightly mirror of TCGplayer's catalog and prices.
No API key is needed. One Piece is "category 68". The data is organized like this:

    category 68 (One Piece)
      └── groups   = the sets (e.g. "Romance Dawn", "Paramount War")
            ├── products = the cards in that set (name, number, image, ...)
            └── prices   = the prices for those cards, linked by productId

We do NOT scrape tcgplayer.com directly (that's against their terms).
Only Python's built-in libraries are used, so there is nothing to install.
"""

import json
import re
import sqlite3
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

CATEGORY_ID = 68  # One Piece Card Game on TCGplayer / tcgcsv
BASE_URL = f"https://tcgcsv.com/tcgplayer/{CATEGORY_ID}"

# The database file lives next to this script.
DB_PATH = Path(__file__).parent / "prices.db"

# The files the website is built from. The nightly GitHub job saves these into
# the repo, so the site can be rebuilt any time without downloading again.
#   data/catalog.json            - every card with today's prices
#   data/history/YYYY-MM-DD.json - just that day's prices, kept forever for
#                                  the up/down arrows and price charts
DATA_DIR = Path(__file__).parent / "data"
HISTORY_DIR = DATA_DIR / "history"

# Be polite to the free service: wait a little between requests.
SECONDS_BETWEEN_REQUESTS = 0.2


# ---------------------------------------------------------------------------
# Step 1: downloading
# ---------------------------------------------------------------------------

def fetch_json(url):
    """Download a URL and return the "results" list from tcgcsv's JSON reply."""
    request = urllib.request.Request(
        url, headers={"User-Agent": "OnePieceBuyerPriceLookup/1.0"}
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        data = json.loads(response.read().decode("utf-8"))
    time.sleep(SECONDS_BETWEEN_REQUESTS)
    # Every tcgcsv reply looks like {"success": true, "results": [...]}
    return data.get("results", [])


# ---------------------------------------------------------------------------
# Step 2: small helpers to clean up the data
# ---------------------------------------------------------------------------

# tcgcsv publishes the moment it last refreshed its prices in this tiny file.
LAST_UPDATED_URL = "https://tcgcsv.com/last-updated.txt"


def parse_source_time(text):
    """
    The file holds a time like "2026-10-20T20:05:18+0000". Returns it as a UTC
    datetime, or None when the text isn't in that form.
    """
    try:
        moment = datetime.strptime(text.strip(), "%Y-%m-%dT%H:%M:%S%z")
    except ValueError:
        return None
    return moment.astimezone(timezone.utc)


def fetch_source_time():
    """When tcgcsv last refreshed its prices (UTC), or None if it can't be read."""
    try:
        request = urllib.request.Request(
            LAST_UPDATED_URL, headers={"User-Agent": "OnePieceBuyerPriceLookup/1.0"}
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            return parse_source_time(response.read().decode("utf-8"))
    except Exception as error:  # a missing time must not stop the update
        print(f"Couldn't read tcgcsv's last-updated time ({error}).")
        return None


def get_extended_value(product, field_name):
    """
    Products have an "extendedData" list with extra details, like:
        [{"name": "Number", "value": "OP01-001"}, {"name": "Rarity", "value": "L"}]
    This pulls out one value by name, or returns None if it isn't there.
    """
    for item in product.get("extendedData", []):
        if item.get("name") == field_name:
            return item.get("value")
    return None


# Some cards have a nickname in parentheses that is part of the character's
# name, not a special printing, e.g. "Mr.3 (Galdino)". If you spot a new one
# showing up as a printing on the website, add it to this list.
NAME_LABELS = {
    "Babe", "Bentham", "Brownbeard", "Daz.Bonez", "Drophy", "Galdino", "Gem",
    "Grandma Nyon", "Marianne", "Mikita", "Navy", "Zala",
}

# Matches a card number like "OP01-016", "ST17-004", "EB03-001" or "P-084".
CARD_NUMBER_PATTERN = re.compile(r"^[A-Z]*\d*-\d+$")


def describe_printing(card_name):
    """
    Work out a friendly "printing" label for a card.

    TCGplayer puts the version in (parentheses) or [brackets] in the name:
        "Monkey.D.Luffy (003) (Parallel)"       -> "Alternate Art"
        "Roronoa Zoro (Manga)"                  -> "Manga"
        "Nami (Judge Pack Vol. 2)"              -> "Judge Pack Vol. 2"
        "Mr.3 (Galdino)"                        -> "Regular"
    """
    # Grab the text inside every (...) or [...] in the name.
    labels = re.findall(r"[(\[]([^)\]]*)[)\]]", card_name)

    printing = []
    for label in labels:
        label = label.strip()
        # Skip things that aren't printings:
        #   "(003)"       -> just tells two cards with the same name apart
        #   "(OP01-016)"  -> a card number
        #   "(Galdino)"   -> a nickname that's part of the card's name
        if label.isdigit() or CARD_NUMBER_PATTERN.match(label) or label in NAME_LABELS:
            continue
        # Older sets call alternate art "Parallel". Use one name for both,
        # so searching "alternate art" finds them all.
        if label == "Parallel":
            label = "Alternate Art"
        if label not in printing:
            printing.append(label)

    return ", ".join(printing) if printing else "Regular"


# Sealed product types. Patterns are checked first, then phrases in order: the
# first one found in the product name wins, so "Booster Box Case" is a Case, not
# a Booster Box. Anything with "pack" left over is a promotional or event pack.
SEALED_PATTERNS = [
    (r"^extra booster\b.*\bbox$", "Booster Box"),
    (r"^extra booster\b.*\bpack$", "Booster Pack"),
]
SEALED_TYPES = [
    ("case", "Case"),
    ("booster box", "Booster Box"),
    ("sleeved booster", "Booster Pack"),
    ("booster pack", "Booster Pack"),
    ("double pack", "Double Pack"),
    ("starter deck", "Starter Deck"),
    ("ultra deck", "Starter Deck"),
    ("deck set", "Deck Set"),
    ("illustration box", "Illustration Box"),
    ("premium", "Premium Collection"),
    ("gift", "Gift Collection"),
    ("collection", "Collection"),
    ("tin", "Tin"),
    ("bundle", "Bundle"),
    ("battle kit", "Battle Kit"),
    ("set", "Set"),
    ("pack", "Promo Pack"),
]


def sealed_type(name):
    """Name a sealed product's type from its TCGplayer name, e.g. "Booster Box"."""
    lowered = name.lower().strip()
    for pattern, label in SEALED_PATTERNS:
        if re.search(pattern, lowered):
            return label
    for phrase, label in SEALED_TYPES:
        if re.search(rf"\b{re.escape(phrase)}\b", lowered):
            return label
    return "Other Sealed"


def round_money(value):
    """Round to cents, but keep None as None (None = no price)."""
    return round(value, 2) if value is not None else None


# ---------------------------------------------------------------------------
# Step 3: the database
# ---------------------------------------------------------------------------

def create_tables(db):
    """Create the tables the first time. Safe to run every time."""
    db.executescript(
        """
        -- One row per card printing, with today's prices.
        -- (A card can have more than one price row, e.g. Normal and Foil.)
        CREATE TABLE IF NOT EXISTS cards (
            product_id    INTEGER,
            sub_type      TEXT,     -- "Normal", "Foil", ...
            name          TEXT,
            set_name      TEXT,
            card_number   TEXT,     -- e.g. "OP01-001"
            rarity        TEXT,
            printing      TEXT,     -- e.g. "Regular", "Alternate Art", "Manga"
            image_url     TEXT,
            tcgplayer_url TEXT,
            low_price     REAL,     -- lowest current listing (any condition)
            market_price  REAL,     -- TCGplayer's market price (recent sales)
            PRIMARY KEY (product_id, sub_type)
        );

        -- Every day's prices are also saved here. We don't use this yet,
        -- but it lets us add a "30-day median" feature later.
        CREATE TABLE IF NOT EXISTS price_history (
            snapshot_date TEXT,     -- "YYYY-MM-DD"
            product_id    INTEGER,
            sub_type      TEXT,
            low_price     REAL,
            market_price  REAL,
            PRIMARY KEY (snapshot_date, product_id, sub_type)
        );

        -- Remembers when we last updated, so the web page can show it.
        CREATE TABLE IF NOT EXISTS info (
            key   TEXT PRIMARY KEY,
            value TEXT
        );
        """
    )


# ---------------------------------------------------------------------------
# Step 4: put it all together
# ---------------------------------------------------------------------------

def build_rows(groups):
    """Download every set and return a list of card rows ready to save."""
    rows = []
    print(f"Found {len(groups)} One Piece sets.")

    for group in groups:
        group_id = group["groupId"]
        set_name = group["name"]
        print(f"  Downloading {set_name} ...")

        products = fetch_json(f"{BASE_URL}/{group_id}/products")
        prices = fetch_json(f"{BASE_URL}/{group_id}/prices")

        # Turn the products list into a dictionary so we can look up
        # a product quickly by its productId.
        products_by_id = {p["productId"]: p for p in products}

        # Remember which products got at least one price row.
        priced_ids = set()

        for price in prices:
            product = products_by_id.get(price["productId"])
            if product is None:
                continue
            priced_ids.add(product["productId"])
            row = make_row(product, set_name, price)
            if row:
                rows.append(row)

        # Some cards have no price row at all. Keep them anyway so they can
        # still be searched; the page will show "No current listing".
        for product_id, product in products_by_id.items():
            if product_id not in priced_ids:
                row = make_row(product, set_name, price=None)
                if row:
                    rows.append(row)

    return rows


def product_language(name):
    """
    tcgcsv's One Piece category is the English game, but it also lists a few
    Japanese-version items (like the anniversary sets) and says so in the name.
    Label those honestly; everything else in the category is English.
    """
    return "Japanese" if re.search(r"\bjapanese\b", name, re.IGNORECASE) else "English"


def make_row(product, set_name, price):
    """Combine one product and (optionally) one price row into a card row."""
    card_number = get_extended_value(product, "Number")
    rarity = get_extended_value(product, "Rarity")

    # Sealed items (booster boxes, packs, decks) have no card number AND no
    # rarity. (DON!! cards have a rarity but no number, so they count as cards.)
    sealed = not card_number and not rarity

    sub_type = price["subTypeName"] if price else "Normal"
    product_id = product["productId"]

    # Ask the image server for a slightly bigger picture than the default.
    image_url = (product.get("imageUrl") or "").replace("_200w", "_400w")

    return {
        "product_id": product_id,
        "sub_type": sub_type,
        "kind": "sealed" if sealed else "card",
        "product_type": sealed_type(product["name"]) if sealed else "Single Card",
        "language": product_language(product["name"]),
        "name": product["name"],
        "set_name": set_name,
        "card_number": card_number or "",
        "rarity": rarity,
        "printing": "Sealed" if sealed else describe_printing(product["name"]),
        "image_url": image_url,
        "tcgplayer_url": product.get("url")
        or f"https://www.tcgplayer.com/product/{product_id}",
        "low_price": round_money(price.get("lowPrice")) if price else None,
        "market_price": round_money(price.get("marketPrice")) if price else None,
    }


def save_rows(rows, snapshot_time):
    """Replace the card list in the database and add a history snapshot."""
    today = snapshot_time.date().isoformat()
    db = sqlite3.connect(DB_PATH)
    create_tables(db)

    # "with db" = do everything below as one transaction. If something fails
    # halfway, nothing is saved and yesterday's data stays untouched.
    with db:
        db.execute("DELETE FROM cards")
        db.executemany(
            """
            INSERT OR REPLACE INTO cards VALUES (
                :product_id, :sub_type, :name, :set_name, :card_number,
                :rarity, :printing, :image_url, :tcgplayer_url,
                :low_price, :market_price
            )
            """,
            rows,
        )
        db.executemany(
            """
            INSERT OR REPLACE INTO price_history VALUES (
                :snapshot_date, :product_id, :sub_type, :low_price, :market_price
            )
            """,
            [{**row, "snapshot_date": today} for row in rows],
        )
        db.execute(
            "INSERT OR REPLACE INTO info VALUES ('last_updated', ?)", (today,)
        )
        # The exact moment, in UTC. The web page turns it into the visitor's
        # own time zone, so it never shows "tomorrow's" date in the evening.
        db.execute(
            "INSERT OR REPLACE INTO info VALUES ('last_updated_at', ?)",
            (snapshot_time.isoformat(timespec="seconds"),),
        )
    db.close()


def card_id(row):
    """One id per price row: the TCGplayer product plus Normal/Foil, e.g. "512345-Foil"."""
    return f"{row['product_id']}-{row['sub_type']}"


def save_data_files(rows, snapshot_time):
    """
    Write data/catalog.json and that day's data/history file (see DATA_DIR above).
    The day is the UTC date of the moment tcgcsv published these prices, not the
    moment this job happened to run, so a late run can't mislabel or skip a day,
    and running twice on the same prices rewrites the same files (no new commit).
    """
    today = snapshot_time.date().isoformat()
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)

    catalog = {
        "updated": today,
        "updated_at": snapshot_time.isoformat(timespec="seconds"),
        "cards": [{"id": card_id(row), **row} for row in rows],
    }
    # One card per line: keeps the file readable and makes git's daily diff small.
    lines = ",\n".join(json.dumps(card, separators=(",", ":")) for card in catalog["cards"])
    header = json.dumps({k: v for k, v in catalog.items() if k != "cards"})[:-1]
    (DATA_DIR / "catalog.json").write_text(f'{header}, "cards": [\n{lines}\n]}}\n')

    # History only keeps the two numbers per card: [lowest listing, market price].
    snapshot = {
        "date": today,
        "prices": {card_id(row): [row["low_price"], row["market_price"]] for row in rows},
    }
    (HISTORY_DIR / f"{today}.json").write_text(json.dumps(snapshot, separators=(",", ":")))


def save_sets(groups):
    """
    data/sets.json: every set with its code and release date, newest first.
    The site uses it for "Newest first" sorting and upcoming-set alerts.
    """
    sets = [
        {
            "id": group["groupId"],
            "name": group["name"],
            "code": group.get("abbreviation") or "",
            "released": (group.get("publishedOn") or "")[:10] or None,
        }
        for group in groups
    ]
    sets.sort(key=lambda s: s["released"] or "", reverse=True)
    (DATA_DIR / "sets.json").write_text(json.dumps({"sets": sets}, indent=1) + "\n")


# Free daily exchange rates (European Central Bank), for the currency picker.
RATES_URL = "https://api.frankfurter.dev/v1/latest?from=USD"


def save_exchange_rates():
    """
    data/rates.json: how many of each currency one US dollar buys today.
    If the rates service is down, keep yesterday's file; prices still work in USD.
    """
    try:
        request = urllib.request.Request(RATES_URL, headers={"User-Agent": "VENDR/1.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))
        rates = {"base": "USD", "date": data["date"], "rates": data["rates"]}
        (DATA_DIR / "rates.json").write_text(json.dumps(rates, indent=1) + "\n")
    except Exception as error:  # any failure here must not stop the price update
        print(f"Couldn't update exchange rates ({error}); keeping the last saved ones.")


def download_prices():
    """
    Download everything and return (groups, rows, snapshot_time).

    tcgcsv refreshes once a day, around 20:00 UTC. If it refreshed while we were
    downloading, the sets we got could be a mix of two days, so we check its
    last-updated time before and after, and start over if it changed.
    """
    for attempt in range(1, 4):
        before = fetch_source_time()
        groups = fetch_json(f"{BASE_URL}/groups")
        rows = build_rows(groups)
        after = fetch_source_time()
        if before == after:
            # If the time can't be read at all, fall back to the clock.
            return groups, rows, after or datetime.now(timezone.utc)
        print(f"tcgcsv refreshed its prices during the download (attempt {attempt} of 3).")
        if attempt < 3:
            print("Starting over in 3 minutes.")
            time.sleep(180)
    raise SystemExit("tcgcsv kept refreshing while we downloaded. Nothing was saved; run it again later.")


def main():
    print("Downloading One Piece prices from tcgcsv.com ...")
    groups, rows, snapshot_time = download_prices()
    print(f"These prices were published by tcgcsv at {snapshot_time.isoformat(timespec='seconds')}.")
    save_rows(rows, snapshot_time)
    save_data_files(rows, snapshot_time)
    save_sets(groups)
    save_exchange_rates()
    print(f"Done! Saved {len(rows)} card printings to {DB_PATH.name} and the data folder.")


# This line means: only run main() when you start this file directly
# (not when another file imports it).
if __name__ == "__main__":
    main()
