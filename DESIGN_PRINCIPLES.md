# Fishy design principles

Adopted 13 September 2026. **Aquascape design quality is Fishy's core consideration.** Reconstruction accuracy, editing mechanics, voice, and image proposals are in service of one question: does the tank the user ends up with read as a good design?

The principles below come from two sources. The first is a 25-minute tour of Aqua Show, an aquascaping gallery in Poland, with co-owner Mika explaining each display tank ([YouTube G5N_pe53ZJc](https://www.youtube.com/watch?v=G5N_pe53ZJc), watched with frames and transcript on 13 September 2026; timestamps below refer to it). The second is the published 100-point judging rubric of the International Aquatic Plants Layout Contest, recorded in [iaplc/README.md](iaplc/README.md). Where the two agree, the principle is treated as settled. Where only one speaks, that is noted.

## The eight principles

Each principle has a stable id. The same ids appear in `blender/design_review.py`, in the recipe schema's `design` block, and in `site/lib/design.ts`; a test fails if this document and the code drift apart.

| # | Id | Principle | Evidence | What Fishy does with it |
| --- | --- | --- | --- | --- |
| 1 | `hardscape-first` | **Hardscape carries the design.** Wood and stone are placed and sized first, at a weight that reads against the tank. Plants dress the structure. | About 400 kg of dragon stone in each 720-litre flagship tank (2:49). With no plants at all, the stone "must be special, must be effective" (21:20). Hardscape-only tanks are shown to clients as a valid product (21:32). | Astra is told to establish hardscape before planting. The review measures hardscape footprint and the width of the largest piece and warns when hardscape reads as decoration. |
| 2 | `sightline` | **One path for the eye.** An open channel or open foreground leads from the front glass into the layout. Tall objects stay out of the front band. | White sand channels between rock banks (3:41 to 5:37), the island layout's cave and stream (8:15), and "leave the foreground open" as the product's signature request. IAPLC: composition and planting balance. | The recipe declares `sightline` and `open_foreground_min`. The review detects an open channel from the front, measures open foreground, and flags tall objects in the front 30 percent of depth. |
| 3 | `contrast` | **Contrast in texture, colour and mass.** Fine against broad, low against tall, dark against light, and a focal point placed with intent. | Fine carpet against rough stone, moss against red stems, schooling red-nosed tetras as moving accents (4:23 to 6:00). Deep reds from iron and 10 hours of light (4:03). IAPLC: composition, originality and impression. | The review checks focal placement against thirds, counts distinct plant forms alongside hardscape, and calls out evenly spread mass as directionless. Declared composition is compared with the inferred mass scheme. |
| 4 | `mood` | **A deliberate mood.** Bright and open, lush, dark and mysterious, or minimal: decide, then let every object serve it. | The Oliveira tank uses giant Echinodorus leaves for "this mysterious feeling" (11:07 to 11:15). The Lord of the Rings sculpture and the Tanganyika tank aim for "dark, scary, mysterious" (19:39, 21:25). A mist maker adds atmosphere (11:29). IAPLC: natural atmosphere. | Mood is declared in the recipe and carried into image-proposal prompts and spoken explanations. It is not measured. |
| 5 | `proportion` | **Proportions that leave room to layer.** Depth of at least 40 percent of width allows front, middle and back planes. Fill roughly half to nine tenths of the height. | Contest sizes 120 by 60 by 50 and 90 by 60 by 45 cm; the 60 cm depth is "perfect for aquascaping" (12:32). Sculptural tanks fill the height; the terrarium and hardscape tanks step objects front to back. | Tank presets favour deep proportions. The review notes shallow depth ratios, hardscape confined to one depth band, and layouts that reach under 35 percent of the height. |
| 6 | `negative-space` | **A clean frame.** Open sand or water stays visible, nothing breaks the waterline, and equipment is out of the composition. | Rimless 19 mm Opti-white glass (2:31), drilled tanks with lily pipes (19:23), one hidden canister filter per tank (5:44), "simple is always better" (9:23), nerite snails keeping stone clean (22:06). IAPLC disqualifies plants above the waterline. | Fishy never adds equipment objects. The review warns when more than 85 percent of the floor is covered and when any object reaches the waterline. |
| 7 | `story` | **A story and a fish match.** Every good tank has a one-sentence story; livestock is chosen to fit it. | "There's always a story behind the tank" (2:10). Congo tetras and cichlids for the African-themed tank (7:11). Goldfish get their own tank for their personality (16:29). IAPLC: fish habitat, 50 points, which Fishy does not attempt. | The recipe declares `story`. Fishy uses it to keep later edits coherent and to frame explanations. Fishy makes no species, compatibility, or welfare claims. |
| 8 | `maintenance` | **Designed for the maintenance you will actually do.** Hardscape-only and moss or epiphyte layouts are low upkeep; stem-plant layouts need weekly trimming. | Moss and fern dioramas are near zero-trim (3:40). Stem-plant layouts are "high maintenance" (8:32). Hardscape-only tanks are "very easy to maintain" (21:37). Wood layouts get a two-week dark start before planting (13:43). IAPLC: long-term maintenance. | The recipe declares a `maintenance_tier`. The review infers a tier from planted footprint and stem-group count and warns on mismatch. Fishy does not predict growth or algae. |

## How the principles flow through the product

1. **Brief.** The user's words, the chosen inspiration reference, and the tank dimensions form the design brief. The brief is data for the model, never permission to change software.
2. **Generation.** Astra receives the principles verbatim in its prompt (`prompt_guidance()` in `blender/design_review.py`) and must fill a `design` block in every recipe: composition scheme, focal object, sightline, open-foreground target, mood, maintenance tier, and story. Recipes without it are rejected under schema version 2. Version 1 recipes from earlier runs still load.
3. **Review.** Trusted code runs `design_review.py` on every validated recipe and writes `design-review.json` beside it. Findings are ranked warnings first. A revision request receives the prior review as data so Astra can address warnings the reference supports and explain the ones it does not.
4. **Editor.** The browser editor computes the same review from live object footprints so a manual drag gets the same feedback as a generated layout. `site/lib/design.ts` is the mirror of the Python module for the site's coordinate system.
5. **Conversation.** When GPT-Live or the chat layer explains a proposal or an edit, it speaks in terms of these eight principles and names the specific finding, not a score.
6. **Image proposals.** GPT-Image prompts describe the target composition scheme and mood in words drawn from the design block rather than conditioning on copyrighted photographs.

## What the review measures

All measures are geometric proxies from axis-aligned object envelopes in a rectangular tank, rasterised on a 120 by 60 floor grid. They are honest about what they are: envelopes, not meshes; floor coverage, not foliage density.

| Measure | Principle | Threshold |
| --- | --- | --- |
| Hardscape footprint fraction; largest hardscape width fraction | `hardscape-first` | ok at footprint 12 percent or width 40 percent; warn below both |
| Open channel from the front (contiguous columns at least 6 percent wide with open depth at least 50 percent) | `sightline` | ok when found; note when front band is 50 percent open without a channel; warn otherwise |
| Tall object centred in the front band (over half the water column) | `sightline` | warn, names the object |
| Declared open-foreground target against measured open front band | `sightline` | warn when declared exceeds measured by more than 5 points |
| Focal object horizontal position | `contrast` | ok on a third (28 to 42 or 58 to 72 percent); note when centred unless convex; warn near the glass |
| Distinct plant forms alongside hardscape | `contrast` | ok at two or more; note at one; hardscape-only ok when declared |
| Mass in left, centre, right thirds | `contrast` | infers triangular, concave, convex, hardscape-only, or undetermined; warns when a declared scheme conflicts |
| Depth to width ratio | `proportion` | ok at 40 percent or more |
| Hardscape depth bands occupied | `proportion` | ok at two or more |
| Tallest object as fraction of height | `proportion`, `negative-space` | note under 35 percent; ok to 90 percent; warn over 97 percent |
| Covered floor fraction | `negative-space` | ok to 60 percent; note to 85 percent; warn above |
| Planted footprint and stem-group count | `maintenance` | high at 45 percent planted or six stem groups; low at 15 percent or less |

## What Fishy does not claim

- Composition inference cannot see a diorama or forced perspective. A declared diorama is accepted without a mass check.
- Mood and story are declared, not measured.
- No principle here is a biological, chemical, or welfare judgement. The IAPLC's 50-point fish-habitat criterion is deliberately outside scope, as recorded in [IAPLC_APPLICATION.md](IAPLC_APPLICATION.md).
- A layout that passes every check is not thereby beautiful. The review removes the common failures the video and the rubric agree on; taste remains the user's.

## Where it lives

| Concern | Location |
| --- | --- |
| Canonical principles, evidence, thresholds | this document |
| Machine-readable principles, prompt text, review engine, CLI | `blender/design_review.py` |
| Recipe contract with the required `design` block (schema v2) | `blender/scene_recipe.py`, `blender/scene_recipe.schema.json` |
| Generation prompt and per-run `design-review.json` | `blender/generate_scene.py` |
| Browser mirror for the deployed editor | `site/lib/design.ts` |
| Tests that keep ids, enumerations, and this document aligned | `blender/tests/test_design_review.py`, `blender/tests/test_scene_recipe.py` |

## Changing a principle

Edit `PRINCIPLES` in `blender/design_review.py`, the matching entry in `site/lib/design.ts`, and the table above in the same change. Keep the id stable unless the principle itself changes meaning; downstream run folders record findings by id. Run the offline tests before generating a new scene.
