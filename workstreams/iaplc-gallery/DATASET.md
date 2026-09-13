# IAPLC gallery dataset

Snapshot: 2026-09-13T03:53:46.790459+00:00

The gallery contains **2,422 references**: 2,402 accepted ranked entries from the current per-year files, 17 additional historical Grand Prize winners, and 3 existing curated Tropica references. The 25 Grand Prize records provide 8 title merges plus 17 additional entries; they are not appended as 25 duplicates.

The **2,402** number in `IAPLC_APPLICATION.md` describes raw ranked entries for 2018–2025. `iaplc/entries.json` has exact full-record parity with the eight per-year files: **True**. It is used for cross-checking, not ingested a second time. Current exclusions: 0 ranked rows and 0 winner rows.

## Coverage

| Year | Raw | Accepted ranked | Recorded rank range | Rank gaps |
| --- | ---: | ---: | --- | ---: |
| 2018 | 295 | 295 | 1–327 | 32 |
| 2019 | 312 | 312 | 1–327 | 15 |
| 2020 | 324 | 324 | 1–327 | 3 |
| 2021 | 299 | 299 | 1–300 | 1 |
| 2022 | 287 | 287 | 1–300 | 13 |
| 2023 | 294 | 294 | 1–300 | 6 |
| 2024 | 296 | 296 | 1–300 | 4 |
| 2025 | 295 | 295 | 1–300 | 5 |

2001–2017 have Grand Prize winners only. 2018–2025 have ranked records and corroborated winner titles. The rank ranges describe the local source files, not proof that the archive is complete. 2018–2020 include 79 records above rank 300. All recorded ranks are retained; gap causes are unknown from these inputs.

## Previous quarantine and stable IDs

The older frozen gallery had 615 references and 529 excluded scrape rows. Comparing by declared year/rank: 519 old excluded slots now have both a corrected year prefix and a different application identity. These current rows pass URL-identity and combined-file agreement checks. 10 old slots are absent from current sources and are not re-created from stale data. Every old exclusion is retained with its disposition in `quarantine.json`.

The absent historical slots are 2022 ranks 60, 67, 151, 197, 231, 237, 246, 276 and 293, plus 2024 rank 190. These are absence observations, not findings of withdrawal or disqualification.

615 previously displayed IDs are retained. IAPLC IDs remain `iaplc-YYYY-RRRR`; Tropica IDs remain unchanged. Existing IAPLC creator/country wording is preserved. Grand Prize titles merge only when normalized entrant names agree; country wording differences are recorded below. A conflict never silently overwrites a winner or a ranked entry.

## What can be displayed

`references.json` keeps factual entrant, native-script name where supplied, country, year, rank and source navigation; 25 corroborated winner titles are included. IAPLC images remain null. No source image URLs, thumbnails or image bytes are exported. Dimensions remain null; IAPLC plant, wood and composition arrays remain empty. Tropica descriptions and selected materials are copied unchanged from the earlier curated snapshot, not invented by this import.

The rights constraint in `IAPLC_APPLICATION.md` remains: ADA consent is required for internet reuse of entry images. A factual metadata gallery does not supply in-app reference photographs or image reuse permission. Any photo comparison needs user-owned/permitted images or an external source view.

Source links for ranks 1–300 select the official gallery year and a 60-rank bucket using `db_year` and `rankNo`. These are range links, not per-entry permalinks. Ranks above 300 use a year-only link because a further rank bucket has not been verified. Grand Prize entries link to the official Grand Prize page. The build checks URL shape and allowed origins offline; it does not claim a live availability check on each record.

## Validation and reproduction

Run from the repository root:

```sh
python3 workstreams/iaplc-gallery/build_dataset.py --self-test
python3 workstreams/iaplc-gallery/build_dataset.py --check
python3 workstreams/iaplc-gallery/build_dataset.py
```

The last command explicitly refreshes this directory's `references.json`, `quarantine.json` and `DATASET.md`; it never edits original scrapes or site files. `--check` rebuilds in memory at the saved timestamp and fails if inputs or generated artifacts differ. Tests cover duplicate rank/application identity, prefix/URL conflicts, combined-file disagreements, careful winner merging, stable IDs and metadata-only output. Validation is local consistency checking, not independent verification of every entrant against the website.

## Warnings

- iaplc-2023-0001: gallery country 'People’s Republic of China' differs from grand-prize country 'China'; gallery wording retained.
- 79 local records have ranks above 300 (2018–2020, up to 327). They are retained as recorded; this snapshot is not described as an exhaustive top-300 archive. These links select the year only.
- 8 records have blank entrant names in both name fields; creator remains an empty string. These metadata gaps do not create an identity conflict and the otherwise consistent ranked records remain available: iaplc-2020-0181, iaplc-2020-0213, iaplc-2020-0226, iaplc-2020-0238, iaplc-2020-0244, iaplc-2020-0270, iaplc-2020-0283, iaplc-2020-0307.
- Rank gaps are retained. The local metadata alone does not establish why an entry is absent or prove archive completeness.
- The award field in ranked scrapes is empty; only corroborated grand-prize records receive an award. No per-entry dimensions, species, scores or composition labels are inferred.

## Input hashes

| Input | Records | SHA-256 |
| --- | ---: | --- |
| `iaplc/entries_2018.json` | 295 | `47eacc330ea4d38a3921337f7a74d63d8ed93767e07571cca70b62f9a19d562a` |
| `iaplc/entries_2019.json` | 312 | `1a8456c1f5c91ea6a43a93ea4e71ee6060eca7095f140238fc9561cfa97495fb` |
| `iaplc/entries_2020.json` | 324 | `fb5130e8d840fe73bd86a72789cec682279544e6a62e6ea95d10a27ab90049a0` |
| `iaplc/entries_2021.json` | 299 | `b645410ba44d9a59124a114cdbe96b0697c7987de6723ada9285b9267087915b` |
| `iaplc/entries_2022.json` | 287 | `0abb601ba2f5336a8fc2a7d9984bd334a10932201e1c37b1e49d87031105166d` |
| `iaplc/entries_2023.json` | 294 | `144d54331b2e04fcc4d61da95dc706404d739d9e9084d05b12be0a49ed159e5c` |
| `iaplc/entries_2024.json` | 296 | `fb809d8b09e8c8e31f2e3637e587d21bb7462484eb315c5112ab8377741e65fe` |
| `iaplc/entries_2025.json` | 295 | `f515a8a95082dcd30c7874b2a7540906ccd59d3f7388bda871fe45c44c07ff34` |
| `iaplc/entries.json` | 2402 | `7018643e8409025b1137f1a4e31c4b9f9d20b3e732ccef8c80737dddf633c6d3` |
| `iaplc/grand_prize_works.json` | 25 | `2875ae80cea132d50cda44c24321e2b90b34e29825c3eecce6e02580058df519` |
| `design-lab/gallery/references.json` | 615 | `f746a263585fccb816cc1690fd33c6dfb77e85a4654be48b611012680f504ec8` |
| `design-lab/gallery/quarantine.json` | 529 | `f4bd0f2add0307a31d93ca5b8778e94638d4fd25cfbc61d027d99dfa3680be8c` |
