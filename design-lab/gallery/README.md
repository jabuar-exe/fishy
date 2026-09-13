# Fishy inspiration library

This is a metadata snapshot built from the user's existing local IAPLC scrape and three individually reviewed Tropica layouts. `references.json` records exact inputs, their hashes, collection time, source URLs, missing information, and counts. Run `python3 design-lab/gallery/build_index.py` from Fishy to explicitly refresh it as additional scrape files finish. The importer does not scrape or modify the research files.

## The useful product distinction

A reference is an idea; an asset is an editable geometric object; an offer is a particular purchasable item. Keep separate identifiers for all three. A photograph of a twisted root does not identify its wood species or guarantee that a retailer has an identical piece.

Browsing should support **Save reference → Choose what I like → Adapt to my tank → Edit the result**. Let a person borrow the arch, the open foreground, or the planting palette independently. Record those choices in the design brief. An inspiration selection must not silently replace an existing aquarium.

## What this snapshot can support

- Search by source, creator, year, country and ranking where supplied.
- Open the credited source. IAPLC uses a year filter, so cards also record the year/rank to locate there; the link does not pretend to select that year automatically.
- Three Tropica cards have source-listed volumes and selected materials, with clearly attributed composition notes.
- Missing dimensions, species, wood type, cost and care requirements remain unknown. Competition ranking is not a beginner-suitability score.
- The local scrape may be incomplete. It does not establish a complete top 500 for every year. Duplicate grand-prize/rank-one records are merged by year and rank.
- Some supplied files have declared years that disagree with the year in their image identifiers. These rows are excluded into `quarantine.json`, without altering the originals. For example, initial 2022 rows used `20232` and initial 2024 rows used `20252`. Recheck year-filter session state and pagination before importing them; do not infer a corrected year and merge automatically.

The first audited snapshot contains **615 source cards: 612 IAPLC records plus 3 Tropica layouts**, with **529 inconsistent scraped rows excluded**. Every excluded 2022 application ID also appeared in the supplied 2023 data, and every excluded 2024 ID appeared in 2025. The scraper assigns its requested year without checking the response's identifier year. That explains how invalid attribution reaches its output; the underlying filter/session failure has not been reproduced. Future ingestion should validate the returned year on every page and use independent sessions for concurrent years. This snapshot is frozen; `references.json` remains authoritative after later explicit rebuilds.

## Photographic gallery path

The [IAPLC gallery](https://iaplc.com/gallery/en/) explicitly requires ADA consent for online use of entry works. No permission record was supplied here. This export deliberately contains no entry photo URL. [Tropica's inspiration library](https://tropica.com/en/inspiration/) offers layout filters and technique/plant information, but viewing a public page does not establish reuse rights for its pictures.

Use original Fishy Blender thumbnails for Fishy templates, visibly described as original designs. Do not pair a generic rendering with a named competition entry as though it depicts that work. The reference-photo grid can be populated with user-owned submissions or licensed partner images when each image has a rights record. Fields should include `rightsHolder`, `permissionEvidence`, `allowedUses`, `attribution`, `expiresAt`, and a durable source identifier.

## Next enrichment with permissioned images

Store visual observations separately from published facts: source image ID, model version, region/mask, confidence, and review status. Observe composition (focal point, negative space, wood direction, foreground/backdrop layers), then match to available procedural assets. Exact plant identification from distant photographs should remain uncertain until supported by creator lists or a reviewed close-up.

The highest-value partner material is a photo **plus** tank dimensions, plant list, hardscape measurements, equipment, and time since planting. A smaller catalog of these is more useful for successful customization than thousands of unannotated competition photos.
