# Native held-out evaluation

Implemented 13 September 2026. This directory contains local evaluation artifacts, not reconstruction inputs. Never pass its photos, masks, camera renders, overlays, scores, or score-informed hints into a generator.

## Actual release evidence

`native-fixture-final-20260913/` contains an actual Blender 5.2.0 LTS rendering experiment, without model calls or real aquarium photographs. The reference is an earlier native render of the hand-authored recipe. Its two scored revisions use the same frozen camera, renderer, metric, photo, mask and builder hashes.

| Revision | Change | Hardscape IoU | Union centroid error |
| --- | --- | --- | --- |
| 0 | Identical hand-authored recipe | 1.0 | 0 px |
| 1 | Intentionally move `rock-01` from `[0.19, 0.13, 0.03]` to `[0.10, 0.10, 0.03]` metres | 0.5030822835700884 | 14.423946511102926 px |

This is a deliberate regression fixture. It tests the score/render/export mechanics, not Astra performance, reconstruction accuracy, or improvement. `review-evaluation.json` is the exact review-contract evaluation object; the native workflow exporter may embed it only with clear fixture provenance. `fixture-comparison.png` is a visually checked reference/render/mask panel. `series.json`, per-revision `render-report.json`, `score.json`, the recipes, logs and saved `.blend` scenes retain the input and implementation identities. Local file paths are not included in the review-contract export.

The earlier `native-fixture-20260913/` folder preserves bootstrap and initial renders. Its first scoring attempt correctly failed when another worker changed a shared builder source after series freeze. A brief coordinated builder freeze then produced the final fixture above. Any subsequent builder change requires a new evaluation series; old recorded results remain historical records and must not be recomputed under a changed builder.

## Real-photo status

**Completed exploratory real-source comparison.** Research subsequently verified three reconstruction viewpoints plus one withheld view from the same Green Aqua aquarium video. `green-aqua-real/` contains the frozen inputs and sealed two-recipe evaluation: actual native revisions 1 → 2 scored IoU **0.3441166635 → 0.3443307149**, essentially unchanged (+0.0214 percentage points). Both source runs are actual Astra calls; the evaluator made none. The unchanged assumed 60 × 30 × 36 cm tank geometry produces a substantial documented tank-rim discrepancy, so the result is exploratory silhouette overlap, not calibrated accuracy or meaningful proven improvement. Original source frames/video are private analysis only and must not be rehosted. See `green-aqua-real/review-with-evaluation.json`, `status.json` and `README.md` for actual identities, sequence evidence and limitations.

## Fixed metric and visibility

The primary metric is pixel intersection divided by union for the visible hardscape foreground. Native objects tagged as rock or wood are white in a separate object-identity pass. Plants and substrate remain black depth occluders. Tank glass, rims, pedestal, studio and annotations are excluded from both the native color render and mask render. No beauty material colors are segmented. Workbench uses one sample (antialiasing off), fixed Standard color transform, flat mask lighting, opaque grayscale PNG and threshold `>127`. Photo and render masks must have exactly the frozen camera's pixel dimensions; no resizing, crop fitting or per-revision alignment is performed.

A nonempty reference mask is required. An empty prediction receives IoU zero and `missing_hardscape`; its centroid is null. Both empty does not become a perfect score. The supporting centroid is for the entire visible foreground union, in pixel centres. It is not a per-object correspondence metric, and symmetric errors can cancel. SSIM is explicitly null because the native procedural materials are not photometrically calibrated; no LPIPS is claimed.

## Camera and identity contract

`blender/heldout_evaluation.py` freezes the series and scores files using Pillow; its pure metrics/contract tests need only Python's standard library. `blender/render_heldout.py` runs in an isolated background Blender process and rebuilds the native recipe, then replaces the aesthetic preview camera with the frozen camera. It never opens a supplied `.blend` or calls a model.

Camera configuration explicitly declares projection, position/target in metres, lens and horizontal sensor width, orthographic scale, shifts, resolution and accepted quality assumptions. World Z is up, pixel aspect is 1, the sensor fit is horizontal, and distortion is unsupported. Manual cameras require an accepted explanation; alignment residual may be null when unmeasured and must not be presented as calibrated. Four coplanar corners constrain a planar homography and do not solve an arbitrary camera. Existing `fit_camera()` framing is not used for evaluation.

The frozen series includes SHA256 of camera JSON, source photo, accepted reference mask, metric configuration, renderer version and all native builder dependencies. Each score additionally identifies the recipe, native render, render mask and finalized sequence. Configuration changes create a new series. File paths must be relative to an explicit local root; traversal, external symlinks, missing files, overwritten outputs, changed input bytes, unsupported keys and non-finite values are rejected. Hashes identify bytes; local manifests and imported review JSON are not authentication against someone editing host files.

## Split and sequence rules

- `fixture` describes synthetic protocol checks and may use a synthetic camera/mask.
- `validation` describes results that may inform later revisions, including human selection after seeing scores.
- `strict_test` stays sealed until the full revision sequence and recipe hashes are finalized. `freeze_sequence()` writes one exclusive `sequence-seals/<seriesHash>.json`. Rendering, scoring and nonempty review export require that exact local seal. Adding a later score-informed revision to the same strict-test series is refused. A partial score export is marked pending.

The generator uses a separate `fishy.evaluation.split.v1` gate owned by the native workflow module. It receives reconstruction IDs/paths/hashes/views and forbidden hashes, never evaluation paths, camera, masks or scores. Forbidden hashes must cover the held-out photo and mask; registered reconstruction roles and hash allowlists must also prevent evaluation-derived images reaching either final model transport. Tooling cannot make human use of previously viewed results into a strict test; label such work validation.

## Commands and interfaces

Use the bundled Python for file scoring (`Pillow` is available there):

```sh
PYTHON=/Users/joshuabanzon/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
BLENDER=/Users/joshuabanzon/Applications/Blender.app/Contents/MacOS/Blender
"$PYTHON" blender/heldout_evaluation.py --root /absolute/evaluation/root freeze --config config.json --output series.json
"$PYTHON" blender/heldout_evaluation.py --root /absolute/evaluation/root seal-sequence --series series.json --revisions revisions.json
"$BLENDER" --background --factory-startup --python-exit-code 1 --python blender/render_heldout.py -- --root /absolute/evaluation/root --series series.json --recipe recipe.json --revision 0 --output-dir revision-0 --sequence sequence-seals/SERIES_HASH.json
"$PYTHON" blender/heldout_evaluation.py --root /absolute/evaluation/root score --series series.json --report revision-0/render-report.json --sequence sequence-seals/SERIES_HASH.json --output revision-0/score.json
```

`config.json` has the shape shown in the recorded fixture's `config.json`. Replace synthetic assumptions and references with actual reviewed inputs before selecting a real-photo policy. `revisions.json` is an array of `{revision, path}` recipe records. Sequence flags are optional for fixture/validation.

Python exports: `freeze_series(root, config, output)`, `load_series(root, relative_path)`, `freeze_sequence(root, series, revisions)`, `score_revision(root, series, render_report, sequence=None)`, and `review_evaluation(series, scores, sequence=None, root=None)`. Nonempty strict-test export requires the actual root and seal. Native review results describe native recipes and must not be attached to browser geometry or browser revision numbers.

Verification: 36 focused tests pass in the bundled Python. They cover perfect/disjoint/partial/empty masks; non-finite and mismatched inputs; real PNG parsing and fixed threshold; missing paths and symlink escape; changed camera/builder/photo/mask/recipe identities; strict sequence seal creation, refusal to extend/overwrite and export protection; and exact review-contract fields. The opt-in `test_render_heldout_native.py` also passed (three actual background Blender builds/renders in 8.5 seconds), verifying deterministic raster pixels, stable hardscape identities and plants' depth occlusion. PNG metadata can differ between processes, so each file retains its own SHA while pixel equality establishes raster determinism. Existing Blender runs were preserved.
