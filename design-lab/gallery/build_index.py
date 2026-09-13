"""Build a source-linked metadata snapshot from existing local research.

No network requests or image copying. Existing scrape files remain untouched.
Run again explicitly to include newly completed scrape files.
"""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
GALLERY = "https://iaplc.com/gallery/en/"
GRAND = "https://iaplc.com/e/grand_prize_works/"


def main():
    entries = {}
    inputs = []
    warnings = []
    quarantined = []
    for path in sorted((ROOT / "iaplc").glob("entries_*.json")):
        raw = path.read_bytes()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            warnings.append(f"Skipped incomplete JSON: {path.name}")
            continue
        inputs.append({"path": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(raw).hexdigest(), "records": len(data)})
        for record in data:
            year, rank = int(record["year"]), int(record["rank"])
            if str(year) not in path.stem or year < 2001 or rank < 1:
                raise ValueError(f"Invalid year/rank in {path.name}")
            prefix = str(record.get("prefix", ""))
            if len(prefix) < 4 or prefix[:4] != str(year):
                quarantined.append({"file": path.name, "declaredYear": year, "rank": rank,
                                    "prefix": prefix, "appId": record.get("app_id"),
                                    "reason": "Image identifier year disagrees with declared year; source session/pagination must be rechecked"})
                continue
            key = f"iaplc-{year}-{rank:04}"
            if key in entries:
                raise ValueError(f"Duplicate ranking: {key}")
            entries[key] = {
                "id": key, "provider": "IAPLC", "year": year, "rank": rank,
                "title": f"IAPLC {year} · Rank {rank}", "creator": record["name"],
                "country": record.get("country"), "sourceUrl": GALLERY,
                "sourceLocation": f"Choose year {year}; world ranking {rank:04}",
                "evidence": "Imported local scrape; individual records not independently audited",
                "image": None, "imageRights": "ADA consent required; no permission record supplied",
                "dimensionsCm": None, "plantNames": [], "woodNames": [],
                "compositionTags": [], "tagsEvidence": None,
                "referenceUse": "Source reference only; no geometry or material identifications supplied"
            }
    path = ROOT / "iaplc" / "grand_prize_works.json"
    if path.exists():
        raw = path.read_bytes()
        data = json.loads(raw)
        inputs.append({"path": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(raw).hexdigest(), "records": len(data)})
        for record in data:
            year = int(record["year"])
            key = f"iaplc-{year}-0001"
            if key not in entries:
                entries[key] = {
                    "id": key, "provider": "IAPLC", "year": year, "rank": 1,
                    "creator": record["entrant"], "country": record.get("country"),
                    "image": None, "imageRights": "ADA consent required; no permission record supplied",
                    "dimensionsCm": None, "plantNames": [], "woodNames": [],
                    "compositionTags": [], "tagsEvidence": None,
                    "evidence": "Imported local grand-prize metadata; individual records not independently audited",
                    "referenceUse": "Source reference only; no geometry or material identifications supplied"
                }
            elif entries[key]["creator"].casefold() != record["entrant"].casefold():
                warnings.append(f"Creator spelling differs between inputs: {key}")
            entries[key].update({"title": record["title"], "sourceUrl": GRAND,
                                 "sourceLocation": f"Grand prize {year}", "award": "Grand prize"})

    curated = [
        {
            "id": "tropica-layout-113", "title": "Layout 113", "creator": "George Farmer and Jurijs Jutjajevs",
            "sourceUrl": "https://tropica.com/en/inspiration/layout/Layout113/21277",
            "reportedVolumeL": 75, "woodNames": ["Ancient juniper wood"],
            "plantNames": ["Cyperus helferi", "Eriocaulon cinereum", "Micranthemum tweediei 'Monte Carlo'"],
            "compositionTags": ["upright hardscape", "grassy planting", "tall tank"],
            "designLesson": "Use height deliberately: vertical wood and slender foliage."
        },
        {
            "id": "tropica-layout-26", "title": "Layout 26", "creator": "Mark Evans",
            "sourceUrl": "https://tropica.com/en/inspiration/layout/Layout26/4958",
            "reportedVolumeL": 60, "woodNames": [],
            "plantNames": ["Eleocharis parvula", "Rotala rotundifolia", "Ranunculus inundatus", "Micranthemum callitrichoides 'Cuba'"],
            "compositionTags": ["Iwagumi", "foreground carpet", "rock composition"],
            "designLesson": "A restrained plant palette can make the rock composition easier to read."
        },
        {
            "id": "tropica-layout-95", "title": "Layout 95", "creator": "Grégoire Wolinski",
            "sourceUrl": "https://tropica.com/en/inspiration/layout/Layout95/5299",
            "reportedVolumeL": 300, "woodNames": ["Mangrove wood", "Sumatra driftwood"],
            "plantNames": ["Ludwigia palustris 'Super Red'", "Microsorum pteropus 'Narrow'", "Anubias barteri 'Petite'"],
            "compositionTags": ["layered roots", "ferns and mosses", "lush planting"],
            "designLesson": "Separate slow and fast planting groups so the composition can be maintained."
        }
    ]
    for card in curated:
        card.update({"provider": "Tropica", "year": None, "rank": None,
                     "image": None, "imageRights": "Reuse permission not verified; source link only",
                     "dimensionsCm": None,
                     "evidence": "Primary layout page reviewed on 2026-09-13; selected materials only",
                     "tagsEvidence": "Paraphrase of source layout description; design lesson is Fishy interpretation",
                     "referenceUse": "Composition inspiration; source-listed materials do not establish suitability for another tank"})
        entries[card["id"]] = card
    cards = sorted(entries.values(), key=lambda v: (v["provider"] != "Tropica", -(v.get("year") or 0), v.get("rank") or 0))
    result = {
        "schemaVersion": "fishy.inspiration.v1", "snapshotAt": datetime.now(timezone.utc).isoformat(),
        "policy": "Metadata and source links only. No remote images, scraped photo URLs, inferred species, or invented dimensions are exported.",
        "counts": {"total": len(cards), "iaplc": sum(c["provider"] == "IAPLC" for c in cards), "tropica": len(curated), "hostedReferenceImages": 0, "quarantinedScrapeRows": len(quarantined)},
        "inputs": inputs, "warnings": warnings, "entries": cards
    }
    assert len({c["id"] for c in cards}) == len(cards)
    assert all(c["image"] is None for c in cards)
    (OUT / "quarantine.json").write_text(json.dumps({"snapshotAt": result["snapshotAt"], "records": quarantined}, indent=2) + "\n")
    (OUT / "references.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"counts": result["counts"], "inputs": inputs, "warnings": warnings}, indent=2))


if __name__ == "__main__":
    main()
