# Green Aqua real-source exploratory evaluation

**Completed after the two-recipe sequence was frozen.** This is a real multi-angle source, with a deliberately limited interpretation: **exploratory silhouette overlap under assumed tank geometry and a manually aligned camera**. `strict_test` describes input isolation and a frozen two-revision policy. It does not mean calibrated camera accuracy, measured geometry, validated segmentation, or a representative test dataset.

| Actual native revision | Actual Astra run | Hardscape IoU | Union centroid error |
| --- | --- | --- | --- |
| 1 | `20260913T043221Z-1b5ea408` | 0.34411666351648035 | 36.33835946270602 px |
| 2 | `20260913T043532Z-af1a9947` | 0.3443307149091486 | 27.265521045463885 px |

Overlap is **essentially unchanged**: the arithmetic increase is 0.0002140514 IoU, or about **0.0214 percentage points**. It is too small to establish meaningful improvement given the manual annotation and alignment limitations. No empirical annotation uncertainty interval or statistical significance is claimed. Each source run contains one completed actual Astra call; the evaluator made zero model calls. `review-with-evaluation.json` is the validated complete review artifact derived from the actual revision 2 manifest, with both scored recipe and render hashes. Original generator manifests were not modified or sent scores.

The original held-out photo and private comparison stay under `heldout/`. Only generated native imagery appears in `native-render-comparison.png` and `revision-1/render.png` / `revision-2/render.png`; these are the images intended for result presentation. The private combined panel was inspected after both scores were produced, and no camera, mask or recipe changes followed it.

## Source and permitted inputs

Research verified three viewpoints and a fourth withheld frame of one unchanged completed aquarium in Green Aqua's first-party public video, “BEAUTIFUL AQUASCAPE with 360 view” (YouTube `yuoS1RNBY7Y`). Reconstruction receives only A80 (front), B105 (left) and C125 (top), copied into `reconstruction/`. D145 is isolated under `heldout/`; the reconstruction worker must not inspect that folder, `series.json`, annotation notes, masks, camera renders, scores or evaluation-informed advice. The source provenance is in the research worker's `research-inputs/SOURCES.md`, which is not a generation prompt.

The source and extracted frames have no verified redistribution license. They are **private analysis material only**. Do not copy original frames, the video, annotation grids or overlays into the deployed site. The review export contains identities and scores, not source images or local paths. A hash establishes correspondence to an imported record, not the record's authenticity.

`generator-gate.json` is the only evaluator-produced file supplied to generation. It contains exactly the three registered reconstruction records and forbidden hashes for D145, the mask, private annotation images, the source video and the contact sheet. It contains no held-out path, camera parameters, annotations or score. The native worker additionally reported an OS sandbox that denies the model process file reads across the Fishy workspace while allowing only selected inputs copied into a private temporary directory.

## Frozen assumptions and annotation

The user-authorized **60 × 30 × 36 cm** tank and **3 cm** substrate remain assumptions. They were not corrected using D145. Actual dimensions, camera intrinsics, lens distortion and refraction are unknown.

The evaluator manually selected an orthographic horizontal span of 0.634 m, camera position `[0.3, -3.0, 0.49]` and target `[0.3, 0.15, 0.15]`, with a 640 × 360 raster. This approximately aligns the front width and lower front edge. The assumed top rim cannot simultaneously align: the RMS displacement of four manually marked front-plane corners is **40.683692 px**, dominated by the top-rim mismatch. That is a measured discrepancy under this assumed frame, not a camera calibration error bar. Four coplanar corners cannot solve a general unknown camera. `heldout/camera-annotation.json` records all marked and projected points; the independent Blender projection check uses no reconstruction recipe or hardscape score.

The fixed mask contains **41,248 foreground pixels**. The evaluator authored integer-pixel polygons around exposed mineral faces and subtracted explicit foreground leaf/grass polygons, then inspected the overlay before reconstruction began. No beauty-color segmentation or generated geometry was used. Distinct plants, fish, sand and glass are excluded; diffuse mineral staining is retained. Shaded rock, moss/biofilm, fine foliage and video compression remain ambiguous. The conservative polygon approximation can omit difficult shaded faces or approximate intricate leaf edges. This is an exploratory annotation, not a validated segmentation ground truth or per-object correspondence set. The exact polygons, ambiguities and acceptance record are in `heldout/mask-annotation.json`.

`series.json` and `freeze-record.json` preserve the camera, photo, mask, renderer, metric, builder and input-gate hashes. `builder-snapshot/` additionally archives all eight exact source files, each verified against the pre-generation frozen SHA; working application sources were not reverted. A historical replay can use the archived `render_heldout.py` and `heldout_evaluation.py` with the original Blender runtime and a fresh output directory, even after the application builder changes. The fixed native evaluator counts rocks and wood as foreground, with plants and substrate retained as depth occluders and glass/rims/studio excluded. SSIM remains null. The supporting centroid is for the visible foreground union and can conceal compensating errors.

## Sequence and reporting

The preregistered sequence is one initial reconstruction followed by exactly one revision using A/B/C and ordinary renders of its own scene. The evaluator sends no object-placement feedback. Both accepted recipe byte hashes must be finalized and sealed before any held-out recipe rendering or score calculation. Camera, mask, dimensions, renderer and metric are not optimized after seeing a score. Worse or unchanged overlap is retained.

The two accepted native recipe hashes (revisions **1 and 2**, preserving their actual native labels) were sealed before either evaluation render. `status.json` now records `complete_exploratory`. Each score identifies its actual recipe and native render hash, and the complete review artifact uses the specific scored revision 2 state. Do not attach this series to browser geometry, an unrelated native protection fixture, or a later unscored branch. Builder changes were released only after both renders and scores completed; subsequent reruns need their own valid series identity.
