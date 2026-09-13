"""Build a reproducible, metadata-only IAPLC gallery snapshot without networking.

Only the three generated sibling files are written. Original scrapes and the
previous gallery snapshot are read-only evidence, including old quarantines.
Run: python3 workstreams/iaplc-gallery/build_dataset.py [--check | --self-test]
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import unicodedata
import unittest
from urllib.parse import parse_qs, urlencode, urlsplit

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
GALLERY = "https://iaplc.com/gallery/en/"
GRAND = "https://iaplc.com/e/grand_prize_works/"
TROPICA_IDS = {"tropica-layout-113", "tropica-layout-26", "tropica-layout-95"}
POLICY = (
    "Metadata and source links only. No remote images, scraped photo URLs, "
    "inferred species, or invented dimensions are exported."
)


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def display_id(year, rank):
    return f"iaplc-{year}-{rank:04}"


def normalized_name(value):
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def source_for_rank(year, rank):
    # The year/rank controls select a range, not an individual entry. Ranks
    # above 300 are retained from the local archive; link to their year only.
    query = {"db_year": year}
    if rank <= 300:
        bucket = (rank - 1) // 60 + 1
        query["rankNo"] = bucket
        location = f"{year} · ranks {(bucket - 1) * 60 + 1}–{bucket * 60}; find world rank {rank:04}"
    else:
        location = f"Choose year {year}; find world rank {rank:04} in the source gallery"
    return GALLERY + "?" + urlencode(query), location


def row_problems(record, file_year):
    if not isinstance(record, dict):
        return ["Record must be an object"]
    reasons = []
    year, rank = record.get("year"), record.get("rank")
    if type(year) is not int or year != file_year or year < 2001:
        reasons.append("Declared year disagrees with filename or is invalid")
    if type(rank) is not int or not 1 <= rank <= 9999:
        reasons.append("World rank is not an integer between 1 and 9999")
    prefix = record.get("prefix")
    if not isinstance(prefix, str) or not re.fullmatch(r"\d{4,8}", prefix) or prefix[:4] != str(year):
        reasons.append("Image identifier year disagrees with declared year")
    app_id = record.get("app_id")
    if not isinstance(app_id, str) or not re.fullmatch(r"[A-Za-z0-9-]{1,100}", app_id):
        reasons.append("Missing or invalid application identity")
    for field in ("name", "country"):
        if not isinstance(record.get(field), str):
            reasons.append(f"Invalid {field} field")
    # Inspect the raw image URL as identity evidence only; never export it.
    try:
        url = urlsplit(record.get("image_url", ""))
        if (url.scheme, url.netloc, url.path) != ("https", "iaplc.com", "/gallery/en/image/preview"):
            reasons.append("Unexpected source image origin or path")
        elif parse_qs(url.query) != {"prefix": [prefix], "app_id": [app_id]} or url.fragment:
            reasons.append("Image URL identifiers disagree with the record")
    except (TypeError, ValueError):
        reasons.append("Invalid source image URL")
    return reasons


def select_rows(sources, combined):
    """Exclude every side of conflicts; never choose whichever row was last."""
    candidates = []
    by_rank, by_application = defaultdict(list), defaultdict(list)
    for filename, year, rows in sources:
        for record in rows:
            candidate = {"file": filename, "record": record, "reasons": row_problems(record, year)}
            candidates.append(candidate)
            if not candidate["reasons"]:
                by_rank[(record["year"], record["rank"])].append(candidate)
                by_application[(record["year"], record["app_id"])].append(candidate)
    for groups, reason in ((by_rank, "Duplicate year/rank identity"), (by_application, "Duplicate application identity within year")):
        for group in groups.values():
            if len(group) > 1:
                for candidate in group:
                    candidate["reasons"].append(reason)
    combined_by_key = defaultdict(list)
    for record in combined:
        if isinstance(record, dict):
            combined_by_key[(record.get("year"), record.get("rank"))].append(record)
    for candidate in candidates:
        record = candidate["record"]
        if not candidate["reasons"]:
            other = combined_by_key.get((record["year"], record["rank"]), [])
            if len(other) != 1 or canonical(other[0]) != canonical(record):
                candidate["reasons"].append("Per-year record does not match exactly one combined-file record")
    selected, excluded = [], []
    for candidate in candidates:
        record = candidate["record"]
        if candidate["reasons"]:
            excluded.append({
                "file": candidate["file"], "declaredYear": record.get("year") if isinstance(record, dict) else None,
                "rank": record.get("rank") if isinstance(record, dict) else None,
                "prefix": record.get("prefix") if isinstance(record, dict) else None,
                "appId": record.get("app_id") if isinstance(record, dict) else None,
                "reasons": candidate["reasons"],
            })
        else:
            selected.append((candidate["file"], record))
    return selected, excluded


def empty_reference(year, rank, creator, country):
    source, location = source_for_rank(year, rank)
    return {
        "id": display_id(year, rank), "provider": "IAPLC", "year": year, "rank": rank,
        "title": f"IAPLC {year} · Rank {rank}", "creator": creator, "country": country,
        "sourceUrl": source, "sourceLocation": location,
        "evidence": "Imported local scrape; identifiers and source-file agreement checked; individual records not independently audited",
        "image": None, "imageRights": "ADA consent required; no permission record supplied",
        "dimensionsCm": None, "plantNames": [], "woodNames": [],
        "compositionTags": [], "tagsEvidence": None,
        "referenceUse": "Source reference only; no geometry or material identifications supplied",
    }


def merge_grand_prizes(entries, records, warnings):
    excluded, added, merged = [], 0, 0
    seen = Counter(r.get("year") for r in records if isinstance(r, dict))
    for record in records:
        year = record.get("year") if isinstance(record, dict) else None
        if (type(year) is not int or year < 2001 or seen[year] != 1
                or any(not isinstance(record.get(k), str) or not record[k].strip() for k in ("entrant", "title", "country"))):
            excluded.append({"file": "grand_prize_works.json", "declaredYear": year, "rank": 1,
                             "reasons": ["Invalid or duplicate grand-prize metadata"]})
            continue
        key = display_id(year, 1)
        if key in entries:
            if entries[key]["creator"] and normalized_name(entries[key]["creator"]) != normalized_name(record["entrant"]):
                excluded.append({"file": "grand_prize_works.json", "declaredYear": year, "rank": 1,
                                 "reasons": ["Grand-prize entrant conflicts with accepted gallery entrant; title not merged"]})
                continue
            if entries[key]["country"] and normalized_name(entries[key]["country"]) != normalized_name(record["country"]):
                warnings.append(f"{key}: gallery country {entries[key]['country']!r} differs from grand-prize country {record['country']!r}; gallery wording retained.")
            if not entries[key]["creator"]:
                entries[key]["creator"] = record["entrant"]
            if not entries[key]["country"]:
                entries[key]["country"] = record["country"]
            merged += 1
        else:
            entries[key] = empty_reference(year, 1, record["entrant"], record["country"])
            entries[key]["evidence"] = "Imported local grand-prize metadata; individual records not independently audited"
            entries[key]["provenance"] = []
            added += 1
        entries[key].update({"title": record["title"], "sourceUrl": GRAND,
                             "sourceLocation": f"Grand prize {year}", "award": "Grand prize"})
        entries[key].setdefault("provenance", []).append({"path": "iaplc/grand_prize_works.json", "year": year})
    return excluded, added, merged


def validate_output(cards):
    assert len({card["id"] for card in cards}) == len(cards), "Output ID collision"
    for card in cards:
        assert card["image"] is None, "Image data must not be exported"
        assert not any(key in card for key in ("image_url", "imageUrl", "thumbnail", "prefix")), "Raw photo fields leaked"
        url = urlsplit(card["sourceUrl"])
        assert url.scheme == "https" and not url.username and not url.password and not url.fragment
        if card["provider"] == "IAPLC":
            assert card["id"] == display_id(card["year"], card["rank"])
            assert url.netloc == "iaplc.com" and url.path in ("/gallery/en/", "/e/grand_prize_works/")
            assert not card["plantNames"] and not card["woodNames"] and not card["compositionTags"]
            assert card["dimensionsCm"] is None
            if url.path == "/gallery/en/":
                expected_url, _ = source_for_rank(card["year"], card["rank"])
                assert card["sourceUrl"] == expected_url
            else:
                assert not url.query and card["rank"] == 1 and card.get("award") == "Grand prize"
        else:
            assert card["provider"] == "Tropica" and card["id"] in TROPICA_IDS
            assert url.netloc == "tropica.com" and url.path.startswith("/en/inspiration/layout/")


def build(snapshot_at=None):
    inputs = []

    def read(relative, role):
        raw = (ROOT / relative).read_bytes()
        value = json.loads(raw)
        inputs.append({"path": relative, "sha256": hashlib.sha256(raw).hexdigest(),
                       "records": len(value if isinstance(value, list) else value.get("entries", value.get("records", []))),
                       "role": role})
        return value

    sources = []
    for path in sorted((ROOT / "iaplc").glob("entries_*.json")):
        match = re.fullmatch(r"entries_(\d{4})\.json", path.name)
        if match:
            data = read(str(path.relative_to(ROOT)), "ranked source")
            if not isinstance(data, list):
                raise ValueError(f"Expected a list in {path.name}")
            sources.append((path.name, int(match[1]), data))
    if not sources:
        raise ValueError("No per-year source files")
    combined = read("iaplc/entries.json", "combined cross-check; not appended")
    grand = read("iaplc/grand_prize_works.json", "winner titles and historical winners")
    previous = read("design-lab/gallery/references.json", "previous display IDs and curated Tropica metadata")
    old_quarantine = read("design-lab/gallery/quarantine.json", "historical exclusion audit")
    if not isinstance(combined, list) or not isinstance(grand, list):
        raise ValueError("Combined and grand-prize inputs must be lists")
    raw_rows = [record for _, _, rows in sources for record in rows]
    exact_match = Counter(map(canonical, raw_rows)) == Counter(map(canonical, combined))
    selected, excluded = select_rows(sources, combined)
    warnings = []
    if not exact_match:
        warnings.append("Combined entries.json does not exactly match the per-year files. Divergent per-year records are excluded; combined-only rows are not imported.")
    entries, selected_rows = {}, {}
    for filename, record in selected:
        key = display_id(record["year"], record["rank"])
        card = empty_reference(record["year"], record["rank"], record["name"], record["country"])
        if record.get("native_name"):
            card["nativeName"] = record["native_name"]
        card["provenance"] = [{"path": f"iaplc/{filename}", "year": record["year"], "rank": record["rank"], "applicationId": record["app_id"]}]
        entries[key], selected_rows[key] = card, record
    grand_excluded, grand_added, grand_merged = merge_grand_prizes(entries, grand, warnings)
    for card in previous["entries"]:
        if card["id"] in TROPICA_IDS:
            entries[card["id"]] = deepcopy(card)
    if {key for key in entries if key.startswith("tropica-")} != TROPICA_IDS:
        raise ValueError("The prior snapshot does not contain all three expected Tropica IDs")

    history = []
    for old in old_quarantine["records"]:
        key = display_id(old["declaredYear"], old["rank"])
        current = selected_rows.get(key)
        if current:
            changed = current["prefix"] != old["prefix"] and current["app_id"] != old.get("appId")
            disposition = "replaced_by_consistent_current_record" if changed else "current_record_requires_identity_review"
            if not changed:
                # A prefix-only edit is insufficient evidence to rehabilitate a
                # known contaminated row without reviewing its entrant identity.
                entries.pop(key, None)
                selected_rows.pop(key, None)
                excluded.append({**old, "reasons": ["Historical conflict lacks both a corrected prefix and replacement application identity"]})
            history.append({"id": key, "previousPrefix": old["prefix"], "previousAppId": old.get("appId"),
                            "currentPrefix": current["prefix"], "currentAppId": current["app_id"], "disposition": disposition})
        else:
            present = any(r.get("year") == old["declaredYear"] and r.get("rank") == old["rank"] for r in raw_rows)
            history.append({"id": key, "previousPrefix": old["prefix"], "previousAppId": old.get("appId"),
                            "disposition": "still_excluded" if present else "absent_from_current_source"})
    history_counts = dict(Counter(record["disposition"] for record in history))
    coverage = []
    for _, year, rows in sources:
        ranks = {record["rank"] for record in rows if type(record.get("rank")) is int}
        max_rank = max(ranks, default=0)
        coverage.append({"year": year, "rawEntries": len(rows),
                         "acceptedRankedEntries": sum(r["year"] == year for r in selected_rows.values()),
                         "minRank": min(ranks, default=0), "maxRank": max_rank,
                         "ranksAbove300": sum(rank > 300 for rank in ranks),
                         "missingRanksUpToMaximum": [rank for rank in range(1, max_rank + 1) if rank not in ranks]})
    above_300 = sum(year["ranksAbove300"] for year in coverage)
    if above_300:
        warnings.append(f"{above_300} local records have ranks above 300 (2018–2020, up to 327). They are retained as recorded; this snapshot is not described as an exhaustive top-300 archive. These links select the year only.")
    missing_creators = [card["id"] for card in entries.values() if card["provider"] == "IAPLC" and not card.get("creator")]
    if missing_creators:
        warnings.append(f"{len(missing_creators)} records have blank entrant names in both name fields; creator remains an empty string. These metadata gaps do not create an identity conflict and the otherwise consistent ranked records remain available: {', '.join(missing_creators)}.")
    warnings.append("Rank gaps are retained. The local metadata alone does not establish why an entry is absent or prove archive completeness.")
    warnings.append("The award field in ranked scrapes is empty; only corroborated grand-prize records receive an award. No per-entry dimensions, species, scores or composition labels are inferred.")
    cards = sorted(entries.values(), key=lambda card: (card["provider"] != "Tropica", -(card.get("year") or 0), card.get("rank") or 0))
    validate_output(cards)
    prior_ids, current_ids = {card["id"] for card in previous["entries"]}, set(entries)
    missing_prior = sorted(prior_ids - current_ids)
    if missing_prior:
        warnings.append(f"{len(missing_prior)} previous display IDs are absent from the fresh snapshot; old metadata was not used to fill missing/conflicting records.")
    timestamp = snapshot_at or datetime.now(timezone.utc).isoformat()
    result = {
        "schemaVersion": "fishy.inspiration.v1", "snapshotAt": timestamp, "policy": POLICY,
        "counts": {"total": len(cards), "iaplc": sum(card["provider"] == "IAPLC" for card in cards),
                   "tropica": len(TROPICA_IDS), "rawRankedEntries": len(raw_rows),
                   "acceptedRankedEntries": len(selected_rows), "grandPrizeRecords": len(grand),
                   "grandPrizeTitlesMerged": grand_merged, "additionalGrandPrizeEntries": grand_added,
                   "missingEntrantNames": len(missing_creators),
                   "hostedReferenceImages": 0, "quarantinedScrapeRows": len(excluded),
                   "quarantinedGrandPrizeRows": len(grand_excluded)},
        "coverage": coverage, "inputs": inputs,
        "rawAudit": {"combinedRecords": len(combined), "perYearRecords": len(raw_rows), "exactRecordParity": exact_match},
        "historicalQuarantine": {"previousRows": len(history), **history_counts},
        "continuity": {"previousDisplayEntries": len(prior_ids), "preservedIds": len(prior_ids & current_ids), "missingPreviousIds": missing_prior},
        "warnings": warnings, "entries": cards,
    }
    quarantine = {"snapshotAt": timestamp, "records": excluded + grand_excluded,
                  "historicalAudit": {"previousSnapshotAt": old_quarantine["snapshotAt"],
                                      "counts": result["historicalQuarantine"], "records": history}}
    return result, quarantine


def documentation(result):
    counts, history = result["counts"], result["historicalQuarantine"]
    lines = [
        "# IAPLC gallery dataset", "", f"Snapshot: {result['snapshotAt']}", "",
        f"The gallery contains **{counts['total']:,} references**: {counts['acceptedRankedEntries']:,} accepted ranked entries from the current per-year files, {counts['additionalGrandPrizeEntries']} additional historical Grand Prize winners, and {counts['tropica']} existing curated Tropica references. The {counts['grandPrizeRecords']} Grand Prize records provide {counts['grandPrizeTitlesMerged']} title merges plus {counts['additionalGrandPrizeEntries']} additional entries; they are not appended as 25 duplicates.", "",
        f"The **{counts['rawRankedEntries']:,}** number in `IAPLC_APPLICATION.md` describes raw ranked entries for 2018–2025. `iaplc/entries.json` has exact full-record parity with the eight per-year files: **{result['rawAudit']['exactRecordParity']}**. It is used for cross-checking, not ingested a second time. Current exclusions: {counts['quarantinedScrapeRows']} ranked rows and {counts['quarantinedGrandPrizeRows']} winner rows.", "",
        "## Coverage", "", "| Year | Raw | Accepted ranked | Recorded rank range | Rank gaps |", "| --- | ---: | ---: | --- | ---: |",
    ]
    for year in result["coverage"]:
        lines.append(f"| {year['year']} | {year['rawEntries']} | {year['acceptedRankedEntries']} | {year['minRank']}–{year['maxRank']} | {len(year['missingRanksUpToMaximum'])} |")
    lines.extend([
        "", "2001–2017 have Grand Prize winners only. 2018–2025 have ranked records and corroborated winner titles. The rank ranges describe the local source files, not proof that the archive is complete. 2018–2020 include 79 records above rank 300. All recorded ranks are retained; gap causes are unknown from these inputs.", "",
        "## Previous quarantine and stable IDs", "",
        f"The older frozen gallery had {result['continuity']['previousDisplayEntries']} references and {history['previousRows']} excluded scrape rows. Comparing by declared year/rank: {history.get('replaced_by_consistent_current_record', 0)} old excluded slots now have both a corrected year prefix and a different application identity. These current rows pass URL-identity and combined-file agreement checks. {history.get('absent_from_current_source', 0)} old slots are absent from current sources and are not re-created from stale data. Every old exclusion is retained with its disposition in `quarantine.json`.", "",
        "The absent historical slots are 2022 ranks 60, 67, 151, 197, 231, 237, 246, 276 and 293, plus 2024 rank 190. These are absence observations, not findings of withdrawal or disqualification.", "",
        f"{result['continuity']['preservedIds']} previously displayed IDs are retained. IAPLC IDs remain `iaplc-YYYY-RRRR`; Tropica IDs remain unchanged. Existing IAPLC creator/country wording is preserved. Grand Prize titles merge only when normalized entrant names agree; country wording differences are recorded below. A conflict never silently overwrites a winner or a ranked entry.", "",
        "## What can be displayed", "",
        "`references.json` keeps factual entrant, native-script name where supplied, country, year, rank and source navigation; 25 corroborated winner titles are included. IAPLC images remain null. No source image URLs, thumbnails or image bytes are exported. Dimensions remain null; IAPLC plant, wood and composition arrays remain empty. Tropica descriptions and selected materials are copied unchanged from the earlier curated snapshot, not invented by this import.", "",
        "The rights constraint in `IAPLC_APPLICATION.md` remains: ADA consent is required for internet reuse of entry images. A factual metadata gallery does not supply in-app reference photographs or image reuse permission. Any photo comparison needs user-owned/permitted images or an external source view.", "",
        "Source links for ranks 1–300 select the official gallery year and a 60-rank bucket using `db_year` and `rankNo`. These are range links, not per-entry permalinks. Ranks above 300 use a year-only link because a further rank bucket has not been verified. Grand Prize entries link to the official Grand Prize page. The build checks URL shape and allowed origins offline; it does not claim a live availability check on each record.", "",
        "## Validation and reproduction", "",
        "Run from the repository root:", "", "```sh", "python3 workstreams/iaplc-gallery/build_dataset.py --self-test", "python3 workstreams/iaplc-gallery/build_dataset.py --check", "python3 workstreams/iaplc-gallery/build_dataset.py", "```", "",
        "The last command explicitly refreshes this directory's `references.json`, `quarantine.json` and `DATASET.md`; it never edits original scrapes or site files. `--check` rebuilds in memory at the saved timestamp and fails if inputs or generated artifacts differ. Tests cover duplicate rank/application identity, prefix/URL conflicts, combined-file disagreements, careful winner merging, stable IDs and metadata-only output. Validation is local consistency checking, not independent verification of every entrant against the website.", "",
        "## Warnings", "",
    ])
    lines.extend(f"- {warning}" for warning in result["warnings"])
    lines.extend(["", "## Input hashes", "", "| Input | Records | SHA-256 |", "| --- | ---: | --- |"])
    lines.extend(f"| `{item['path']}` | {item['records']} | `{item['sha256']}` |" for item in result["inputs"])
    return "\n".join(lines) + "\n"


class ImportChecks(unittest.TestCase):
    def row(self, rank=2):
        return {"year": 2024, "rank": rank, "name": "Example Entrant", "country": "Example Country",
                "prefix": "20242", "app_id": "W100-0001", "image_url": "https://iaplc.com/gallery/en/image/preview?prefix=20242&app_id=W100-0001"}

    def test_valid_identity_and_stable_id(self):
        row = self.row()
        selected, excluded = select_rows([("entries_2024.json", 2024, [row])], [row])
        self.assertEqual(len(selected), 1)
        self.assertEqual(excluded, [])
        self.assertEqual(display_id(2024, 2), "iaplc-2024-0002")

    def test_old_year_conflict_is_excluded(self):
        row = self.row()
        row["prefix"] = "20232"
        row["image_url"] = row["image_url"].replace("20242", "20232")
        selected, excluded = select_rows([("entries_2024.json", 2024, [row])], [row])
        self.assertFalse(selected)
        self.assertIn("Image identifier year disagrees", str(excluded))

    def test_blank_entrant_is_a_field_gap_not_an_identity_conflict(self):
        row = {**self.row(), "name": "", "native_name": ""}
        selected, excluded = select_rows([("entries_2024.json", 2024, [row])], [row])
        self.assertEqual(len(selected), 1)
        self.assertFalse(excluded)
        card = empty_reference(row["year"], row["rank"], row["name"], row["country"])
        validate_output([card])
        self.assertEqual(card["creator"], "")

    def test_duplicate_rank_and_application_exclude_all_sides(self):
        row = self.row()
        for second in (deepcopy(row), {**row, "rank": 3}):
            selected, excluded = select_rows([("entries_2024.json", 2024, [row, second])], [row, second])
            self.assertFalse(selected)
            self.assertEqual(len(excluded), 2)

    def test_url_conflicts_and_unsafe_origins(self):
        for source in ("https://example.com/photo.jpg", self.row()["image_url"].replace("W100", "W999")):
            row = {**self.row(), "image_url": source}
            self.assertTrue(row_problems(row, 2024))

    def test_combined_mismatch_is_excluded(self):
        row = self.row()
        selected, excluded = select_rows([("entries_2024.json", 2024, [row])], [{**row, "name": "Different Entrant"}])
        self.assertFalse(selected)
        self.assertIn("combined-file", str(excluded))

    def test_grand_prize_never_overwrites_conflicting_entrant(self):
        original = empty_reference(2024, 1, "Existing Entrant", "Country")
        entries = {original["id"]: original}
        excluded, added, merged = merge_grand_prizes(entries, [{"year": 2024, "entrant": "Other Entrant", "country": "Country", "title": "Wrong title"}], [])
        self.assertEqual(len(excluded), 1)
        self.assertEqual((added, merged), (0, 0))
        self.assertEqual(original["title"], "IAPLC 2024 · Rank 1")

    def test_grand_prize_normalization_preserves_gallery_wording(self):
        original = empty_reference(2024, 1, "Existing Entrant", "Gallery Country")
        entries, warnings = {original["id"]: original}, []
        excluded, added, merged = merge_grand_prizes(entries, [{"year": 2024, "entrant": " EXISTING  ENTRANT ", "country": "Alternate Country", "title": "Known title"}], warnings)
        self.assertFalse(excluded)
        self.assertEqual((added, merged), (0, 1))
        self.assertEqual(original["country"], "Gallery Country")
        self.assertEqual(original["title"], "Known title")
        self.assertEqual(len(warnings), 1)

    def test_source_ranges_and_no_image_exports(self):
        for rank, bucket in ((1, 1), (60, 1), (61, 2), (300, 5), (327, None)):
            card = empty_reference(2024, rank, "Entrant", "Country")
            validate_output([card])
            self.assertEqual(parse_qs(urlsplit(card["sourceUrl"]).query).get("rankNo"), [str(bucket)] if bucket else None)
        card["image_url"] = "https://example.com/photo.jpg"
        with self.assertRaises(AssertionError):
            validate_output([card])

    def test_output_id_collision_rejected(self):
        card = empty_reference(2024, 2, "Entrant", "Country")
        with self.assertRaises(AssertionError):
            validate_output([card, deepcopy(card)])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--check", action="store_true", help="Verify generated files and source hashes without writing")
    modes.add_argument("--self-test", action="store_true", help="Run importer regression checks without writing")
    args = parser.parse_args()
    if args.self_test:
        suite = unittest.defaultTestLoader.loadTestsFromTestCase(ImportChecks)
        if not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful():
            raise SystemExit(1)
        return
    timestamp = json.loads((OUT / "references.json").read_text())["snapshotAt"] if args.check else None
    result, quarantine = build(timestamp)
    outputs = {"references.json": json.dumps(result, indent=2, ensure_ascii=False) + "\n",
               "quarantine.json": json.dumps(quarantine, indent=2, ensure_ascii=False) + "\n",
               "DATASET.md": documentation(result)}
    for filename, content in outputs.items():
        path = OUT / filename
        if args.check:
            if path.read_text() != content:
                raise SystemExit(f"Generated file is stale or modified: {path}")
        else:
            path.write_text(content)
    print(json.dumps({"mode": "checked" if args.check else "built", "counts": result["counts"],
                      "rawAudit": result["rawAudit"], "historicalQuarantine": result["historicalQuarantine"],
                      "continuity": result["continuity"]}, indent=2))


if __name__ == "__main__":
    main()
