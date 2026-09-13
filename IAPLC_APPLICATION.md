# Applying IAPLC to Fishy

Written 13 September 2026 after scraping https://iaplc.com/e/. Data and scraper live in [iaplc/](iaplc/README.md). [THREE_TRACK_DEMO.md](THREE_TRACK_DEMO.md) defers "the full IAPLC archive" and [PRODUCT_DESIGN_DIAGRAM.md](PRODUCT_DESIGN_DIAGRAM.md) lists "curated IAPLC inspiration" as a later layer. The items below are the parts that help the current build now, plus what to hold for later.

**Gallery update:** The source metadata is now integrated into Fishy's Gallery workspace. This document supplies the comparison study prompts and photo guidance; the ranked records come from `iaplc/`. The validated snapshot contains 2,419 IAPLC references (2,402 ranked entries plus 17 earlier Grand Prize winners), alongside three Tropica studies and three original Fishy renders. See [dataset provenance](workstreams/iaplc-gallery/DATASET.md) and [gallery verification](workstreams/iaplc-gallery/VERIFICATION.md).

## What the site actually gives us

- 2,402 ranked entries (2018–2025) with rank, entrant, country and a 1920×1080 front-on photo each. Twenty-five Grand Prize works back to 2001 with titles.
- A published 100-point judging rubric and a documented screening process.
- Entry photo rules that define a canonical aquarium photograph: whole tank, straight from the front, uncropped, unretouched, at least 1500 px wide.
- Nothing else. No tank dimensions, plant lists, fish lists, equipment or scores per entry. Anything Fishy says about an entry's contents is inference from the image.

**Constraint that shapes everything:** The [IAPLC gallery](https://iaplc.com/gallery/en/) requires ADA consent for republishing entry works on the internet. The [current application rules](https://iaplc.com/e/application/) distinguish entrants' copyright from 2024 onward from ADA's usage and publication rights; it is inaccurate to say ADA owns every original entry image. The deployed Fishy site must not host, embed or hot-link these photographs without permission. Local analysis and links to official source pages remain the current project approach.

## Use now (fits the current build)

1. **Reconstruction test set.** The 280×210 Facebook reference photo is the weakest input in the pipeline. IAPLC photos are 1920×1080, front-on, whole-tank, standardized framing, mostly hardscape-dominant in the top ranks. Pick three to five sparse, wood-and-rock-heavy entries from `iaplc/images/` as Astra reconstruction inputs. Tank dimensions stay unknown, so keep them as assumptions, exactly as the 60×30×36 cm case already does. Do not show these images in the demo; render the reconstructed scene instead.

2. **Capture guidance for users.** Reuse the IAPLC photo rules as Fishy's own photo checklist: shoot the whole tank from the front, level, no crop, at least 1500 px wide, plants below the waterline. This is the same framing Astra reconstructs best from, and it is a defensible product rule with a real-world source.

3. **A design-review rubric the assistant can speak.** Four of the six IAPLC criteria are spatial or compositional and match the scope in [ASTRA_CAPABILITY_DEMO.md](ASTRA_CAPABILITY_DEMO.md):
   - Overall composition and planting balance (10)
   - Presentation of natural atmosphere (10)
   - Originality and impression (10)
   - Long-term maintenance (10), read narrowly as "is this layout stable and reachable, or staged for a photo"
   The other two, fish habitat (50) and creator's technical skills (10), depend on biology and husbandry that the build explicitly cuts. When GPT-Live explains a proposal, it can frame the explanation with the four spatial criteria and cite IAPLC as the source, without scoring or claiming biological verdicts.

   This rubric is now folded into [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md), which merges the four spatial IAPLC criteria with the practitioner rules from the Aqua Show gallery tour into eight principles that the recipe schema, the geometric review, and the assistant's explanations all use.

4. **Composition vocabulary for GPT-Image-2.5 prompts.** Top entries cluster into a few recognizable schemes: triangular (mass on one side sloping down), concave or U-shaped (open center, mass at both sides), convex or island (mass in the center), and diorama or forced-perspective (paths, cliffs, tree forms). Describing the target scheme in words is safer than conditioning on an ADA image, and it keeps proposals inside geometry the recipe schema can express.

5. **Gallery and comparison workspace.** Search the validated references by entrant, country, title or year; filter by source, year, rank and saved ideas. Save an entry to the current design without changing the aquarium. Compare the current 3D scene or a supplied tank photo with an original Fishy render or a supplied reference photo. IAPLC selections show attributed metadata and an official source link beside the creation; the competition photograph opens externally. Supplied photos stay in the browser session and are not uploaded or included in saved scenes. Full IAPLC photo comparison inside Fishy remains dependent on reuse permission.

## Hold for later (matches the deferred "inspiration" layer)

- **Permissioned photographic archive.** The metadata browser is implemented. A grid of actual competition photographs, including embedded or hot-linked photos, still requires a documented reuse permission. Ordinary browsing access is not such permission. Ranked source data does not reliably supply award tiers beyond corroborated Grand Prize records.
- **Style tagging.** Run Astra once over the top 60 per year locally to tag composition scheme, dominant hardscape type and approximate open-foreground ratio. Store only the tags, not the images. That becomes a searchable design catalog without redistributing copyrighted pixels.
- **Judge-style critique mode.** Full six-criterion scoring only becomes honest once the product handles biology, which is out of scope today.

## Suggested next step

Choose the reconstruction test entries. Concrete filter: year 2025 or 2024, rank under 60, visibly sparse hardscape with limited planting. Copy three into a `blender/examples/iaplc/` folder locally, keep them git-ignored, and run the existing Astra recipe generation against one of them with the tank dimensions declared as assumed.
