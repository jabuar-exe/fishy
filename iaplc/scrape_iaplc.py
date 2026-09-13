#!/usr/bin/env python3
"""Scrape the IAPLC past-works gallery (https://iaplc.com/gallery/en/).

Collects rank, entrant name, native-script name, country, application ID,
award tier and preview-image URL for every ranked entry, 2018-2025.
Optionally downloads the 1920x1080 preview JPEGs for the top N per year.

Copyright of every entry image belongs to Aqua Design Amano Co., Ltd.
Downloaded images are for local research/reference only; do not republish.
"""
import argparse, csv, html, json, re, sys, time
from pathlib import Path
import urllib.request, urllib.parse, http.cookiejar

BASE = "https://iaplc.com"
UA = "Mozilla/5.0 (research scraper; contact via GitHub jabuar-exe)"
AWARDS = {1: "Grand Prize", 2: "Gold Prize", 3: "Silver Prize", 4: "Bronze Prize",
          5: "Honor Prize", 6: "Winning Work", 7: "Fine Works"}
ENTRY_RE = re.compile(
    r'<div class="modal-content">.*?src="([^"]+)".*?RANKING<span>(\d+)</span>.*?'
    r'<div class="modal-name">(.*?)</div>\s*<div class="modal-country"><span>([^<]*)</span>',
    re.S)
DELAY = 0.6


def make_opener():
    cj = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    op.addheaders = [("User-Agent", UA)]
    return op


def get(op, url, data=None):
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    for attempt in range(3):
        try:
            with op.open(url, body, timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    return b""


def parse_entries(page_html):
    out = []
    for src, rank, name_html, country in ENTRY_RE.findall(page_html):
        spans = [html.unescape(s).strip() for s in re.findall(r'<span>([^<]*)</span>', name_html)]
        spans = [s for s in spans if s]
        q = urllib.parse.parse_qs(urllib.parse.urlparse(src).query)
        app_id = q.get("app_id", [""])[0]
        prefix = q.get("prefix", [""])[0]
        # Latin name spans come first, native-script span (if any) last.
        latin = [s for s in spans if re.fullmatch(r"[\x00-ɏḀ-ỿ\s'’.\-]+", s)]
        native = [s for s in spans if s not in latin]
        out.append({
            "rank": int(rank),
            "name": " ".join(latin) if latin else " ".join(spans),
            "native_name": " ".join(native),
            "country": html.unescape(country).strip(),
            "app_id": app_id,
            "prefix": prefix,
            "image_url": BASE + src.split("&1")[0] if src.startswith("/") else src.split("&1")[0],
        })
    return out


def select_year(op, year, award=""):
    """The gallery stores the active filter in a PHP session; POST then paginate."""
    return get(op, f"{BASE}/gallery/en/", {"db_year": str(year), "country": "", "award": str(award), "rank": ""}).decode("utf-8", "replace")


def scrape_year(op, year, award=""):
    op = make_opener()  # fresh PHP session per year; a reused session leaked filters between years
    first = select_year(op, year, award)
    m = re.search(r"CONTEST (\d{4})", first)
    if not m or int(m.group(1)) != year:
        raise RuntimeError(f"gallery did not switch to {year}: got {m.group(1) if m else 'no year'}")
    entries = parse_entries(first)
    seen = {e["rank"] for e in entries}
    page = 2
    while True:
        time.sleep(DELAY)
        h = get(op, f"{BASE}/gallery/en/index?page={page}").decode("utf-8", "replace")
        new = [e for e in parse_entries(h) if e["rank"] not in seen]
        if not new:
            break
        entries += new
        seen |= {e["rank"] for e in new}
        page += 1
    return entries


def write_aggregate(out, all_entries):
    (out / "entries.json").write_text(json.dumps(all_entries, ensure_ascii=False, indent=1))
    with open(out / "entries.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["year", "rank", "award", "name", "native_name", "country", "app_id", "prefix", "image_url"])
        w.writeheader(); w.writerows(all_entries)
    print(f"total {len(all_entries)} entries -> {out/'entries.csv'}", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", default="2025,2024,2023,2022,2021,2020,2019,2018")
    ap.add_argument("--out", default=Path(__file__).parent)
    ap.add_argument("--images-top", type=int, default=0, help="download preview JPEGs for ranks <= N per year")
    ap.add_argument("--awards", action="store_true", help="EXPERIMENTAL: try award-filter passes (the site ignores the filter on paginated pages, so results were unusable)")
    ap.add_argument("--merge-only", action="store_true", help="only rebuild entries.json/csv from entries_<year>.json files")
    a = ap.parse_args()
    out = Path(a.out); (out).mkdir(parents=True, exist_ok=True)
    if a.merge_only:
        merged = []
        for f in sorted(out.glob("entries_*.json"), reverse=True):
            merged += json.loads(f.read_text())
        write_aggregate(out, merged)
        return
    op = make_opener()
    all_entries = []
    for year in [int(y) for y in a.years.split(",")]:
        t0 = time.time()
        entries = scrape_year(op, year)
        tier = {}
        if a.awards:
            for code, label in AWARDS.items():
                time.sleep(DELAY)
                for e in scrape_year(op, year, code):
                    tier[e["rank"]] = label
        for e in entries:
            e["year"] = year
            e["award"] = tier.get(e["rank"], "")
        entries.sort(key=lambda e: e["rank"])
        all_entries += entries
        print(f"{year}: {len(entries)} entries, {len(tier)} with award tier, {time.time()-t0:.0f}s", file=sys.stderr)
        (out / f"entries_{year}.json").write_text(json.dumps(entries, ensure_ascii=False, indent=1))

    write_aggregate(out, all_entries)

    if a.images_top:
        for e in all_entries:
            if e["rank"] > a.images_top:
                continue
            d = out / "images" / str(e["year"]); d.mkdir(parents=True, exist_ok=True)
            p = d / f"{e['rank']:04d}_{e['app_id']}.jpg"
            if p.exists():
                continue
            time.sleep(DELAY)
            p.write_bytes(get(op, e["image_url"]))
        print("images done", file=sys.stderr)


if __name__ == "__main__":
    main()
