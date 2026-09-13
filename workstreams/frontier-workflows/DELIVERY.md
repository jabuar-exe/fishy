# Fishy frontier release — delivery record

13 September 2026. Deadline: 06:02 UTC / 14:02 Singapore. The integrated plan was finalized before implementation at 04:10 UTC. The frontier release, real-source experiment, final bounded model branch and production import checks are complete. This record reports the shipped product separately from experimental model results.

## Product and workflow

The existing editor now connects the requested features through its four configuration tasks and Gallery:

| Where | Delivered behavior |
| --- | --- |
| Tank | Width/depth/height sliders with exact values; visual water toggle; studio or local room-photo backdrop with zoom/position sliders; tank orbit constrained above its floor. |
| Materials | All 19 addable catalog entries have genuine rendered previews from the same descriptor and geometry factory as Add. One selected sample can be orbited/reset; failed previews have Retry. Juniper stays reference-only. |
| Arrange | Bounded position, size and turn controls; successful manual changes protect affected objects; explicit Release; review of effective proposed changes and blocked protected-object attempts; atomic Apply and one Undo. |
| Ideas → Evidence | Import a recorded run, inspect specific photo requests and object citations, register a local answer photo, export its response manifest. It explicitly waits for a native revision rather than pretending to run a hosted model. |
| Gallery → Recorded evaluation | Separate, renderer-identified revision comparisons with actual scores, missing-metric states, and hash-checked reference/render attachments. Existing inspiration Gallery remains available. |

The browser's current scene/revision is authoritative. Imported native Blender geometry remains view-only because it differs from the browser geometry. Native scores are never presented as accuracy scores for the current browser tank. All source declarations are visibly imported/declared, not authenticated by JSON parsing.

The 2,425 Gallery entries consist of 2,422 source entries and three Fishy originals; this is not a claim of 2,425 hosted photographs. No restricted source photographs or commercial game assets were copied into the site.

## Real evidence found without user-supplied photos

Research inspected actual frames of [Green Aqua's moving-camera aquarium video](https://www.youtube.com/watch?v=yuoS1RNBY7Y), verified the same unchanged hardscape across three reconstruction views, and reserved a fourth physical view for evaluation. An additional distinct close-up frame was obtained for a later requested-photo branch. These are real video frames, not generated views or independent calibrated photographs. Actual tank dimensions and camera calibration are unknown.

Source metadata, hashes, selected viewpoints and rejected candidates are in [SOURCES.md](research-inputs/SOURCES.md). Original frames/video remain private analysis material; redistribution rights were not established. Only generated native renders and metadata are used for result presentation.

## Actual native W2 result

The sequence contained exactly two actual Astra model calls, followed by evaluation after both accepted recipe hashes were frozen:

| Run | Native revision | Hardscape silhouette IoU | Union centroid error |
| --- | --- | --- | --- |
| `20260913T043221Z-1b5ea408` | 1 | 34.4117% | 36.34 px |
| `20260913T043532Z-af1a9947` | 2 | 34.4331% | 27.27 px |

The overlap change is **+0.0214 percentage points, essentially unchanged**. It does not demonstrate meaningful improvement. SSIM was not measured. This is exploratory overlap under the assumed 60 × 30 × 36 cm tank, a fixed manually aligned camera and a conservative manual mask. The front-rim alignment discrepancy was **40.68 px RMS**. Unknown dimensions, refraction, calibration and annotation uncertainty materially limit interpretation. No centimetre-accuracy, statistical significance or representative benchmark claim is made.

The held-out photo, masks, camera details, scores and score-informed advice were excluded from generation; the revision sequence was frozen before scoring. Here `strict_test` identifies that isolation policy, not calibrated measurement. Exact native builder files, camera/mask/recipe/render hashes and immutable original manifests are retained.

- [Complete review artifact](evaluation/green-aqua-real/review-with-evaluation.json)
- [Result and limitations](evaluation/green-aqua-real/README.md)
- [Machine-readable results](evaluation/green-aqua-real/result-summary.json)
- [Native renders only](evaluation/green-aqua-real/native-render-comparison.png)

## W1 evidence response and W3 protection

The first real Commons reconstruction, `20260913T042211Z-f9853fc4`, asked for the right-center main stone. The available second photo showed the left boulder, so it was not falsely supplied as that answer. That request remains pending. A later renderer-only derivative made no model call.

Protocol fixtures exercise changed, confirmed and unresolved outcomes. Actual native Blender runtime checks exercise captured transforms and exact protected mesh/world-matrix preservation, including a hostile proposal. Actual browser controls and a hostile browser proposal were separately tested through the UI.

A separate unscored Green Aqua branch combines the additional 115-second close-up with a **scripted native transform fixture**, not a human cursor edit. The protected `r3` stone moved +1 cm in X and +0.035 radians yaw in an isolated Blender copy. The user's existing unsaved native scene was left untouched.

The branch's first actual call, `20260913T044524Z-04a1e470`, was rejected before build: it cited the r1-only answer for neighboring plants, and also proposed a resolution for an unanswered request. It preserved r3 in its raw proposal, but produced no accepted result. The raw response and both violations were retained. A clarified prompt added exact citation-scope and answered-only guidance; focused regressions passed.

The second bounded call, **`20260913T045133Z-f468b506`, was accepted**. It recorded `resolved_changed` for r1: height **19 cm → 15 cm**, citing the exact new answer observation `obs-a0331ad408f771fa0c40a4d1`. The unanswered r4 request remained requested. The captured r3 mesh, world matrix and accepted recipe were all preserved exactly at native base revision 3 → revision 4. The raw proposal made no protected override attempt, so `blockedAttempts` is correctly empty; hostile-attempt enforcement is evidenced by the separate fixtures. Manifest provenance explicitly says `scripted_transform_fixture`.

Total branch model calls: **two—one rejected, one accepted**; no automatic retries. Neither call is part of the scored W2 sequence. Root imported the accepted artifact into the deployed site and observed the real changed request, exact citation, pending r4 request, r3 protection and native view-only boundary, with browser revision 19 unchanged.

- [Accepted native review](../../blender/runs/20260913T045133Z-f468b506/frontier-review.json)
- [Actual Blender preservation and target-geometry verification](../../blender/frontier-branches/green-aqua-answer-115s-20260913/accepted-native-verification-with-target-geometry.json)
- [Preserved rejected-attempt analysis](../../blender/frontier-branches/green-aqua-answer-115s-20260913/rejected-run-analysis.json)

Across these frontier experiments there were five actual model calls: one Commons initial run, two W2 runs, and the two separate branch attempts. Renderer-only derivatives and evaluation renders made no model calls. This count does not include unrelated earlier Fishy work.

## Verification and publication

The Site owner is the sole editor/deployer of `site/`. Root and independent agents provided separate source, contract, native-runtime and actual-browser checks. Checkpoint test totals are not added together.

- Site release: 37 selected tests, TypeScript no-emit, full production build and diff checks passed. The final styling change reuses existing control classes and passed a fresh production build plus independent visual inspection.
- Native after citation-prompt hardening: 110 tests run, 109 passed, one opt-in test skipped. Separate actual Blender checks recorded nine capture checks and four protected mesh/world-matrix checks.
- Evaluation: focused mask/series tests and an opt-in native render integration passed. Exact actual render hashes are attached to the real pair.
- Independent transport checks rejected forbidden-image aliases, changed bytes, unregistered evidence and path escapes. This is bounded local validation, not a claim of a connected production model service.
- Actual browser checks covered all 19 loaded thumbnails; sample orbit/reset; 390 × 360 and 390 × 844 layouts; local table scrolling; fixture import; wrong render-hash rejection/correct attachment; native view-only behavior; slider commit/Undo; protected proposal review; stale rejection; Save/reload; and camera/background behavior. Attribution and limits are in [BROWSER_ACCEPTANCE.md](BROWSER_ACCEPTANCE.md) and [SITE_RELEASE_EVIDENCE.md](SITE_RELEASE_EVIDENCE.md).

Private site: [Fishy Aquascape Studio](https://fishy-3d-studio.banz-joshua.chatgpt.site/). **Version 10 succeeded at 04:52:11 UTC / 12:52:11 Singapore**, before the deadline. Root's final production smoke passed: correctly styled photo controls, real W2 review import, both exact native render attachments, unchanged browser scene, and no captured error/warning log entries.

- Commit: `8e1d6bd131927a40a6f90059d26d3ad58dd34fd6`
- Version: `appgprj_6aa60f318aec8191903686f10de4e48e~appgver_23c0b04af2808191b39ca6ceacc08209`
- Deployment: `appgdep_6aa62bec50e0819182c30a644c5db165`, terminal `succeeded`, no failure
- Audience readback: owner/custom access, one allowed account user, zero external visitors, no workspace/tenant groups; no sharing changes

Existing source registration, user saves, unsaved native work and unrelated untracked files were preserved. Version 10 above records the core workflow checkpoint; the final material-detail release is Version 11 below.

### Subsequent material detail pass

The user separately requested finer texture and colour in the existing build task after the core release. The Site owner implemented shared procedural wood grain, mineral variation, foliage detail, less washed-out lighting and antialiased granular sand. Leaf meshes changed to smooth curved blades fitted into their prior parent-space envelopes; saved descriptors, transforms, wood/rock mesh vertices and schema stayed unchanged. These remain procedural approximations.

Root's final clean local reload showed 19/19 loaded thumbnails, smooth coloured leaf samples, richer wood/rock surfaces and restrained sand grain, with no captured shader errors/warnings and no saved-scene mutation. The owner reports 37 regression tests plus a separate 90-case foliage geometry diagnostic across plants/rotations/sizes, checking six position boundaries, containment, finite geometry, descriptor preservation and complete vertex colours; TypeScript and final production build passed. This browser rendering pass does not change the frozen native W2 builder or scores.

**Version 11 succeeded at 05:01:27 UTC / 13:01:27 Singapore**, approximately one hour before the deadline. Root then verified the actual production deployment: all 19 thumbnail images loaded at 240px, the live red-plant preview showed the refined leaves, scene surface updates were visible, and captured warning/error logs were empty. The saved browser scene remained revision 19; no root scene edits or Save occurred.

- Final commit: `4d217ddf1041a06fef4f64f5c6ddb84b7ed4f1f3`
- Final version: `appgprj_6aa60f318aec8191903686f10de4e48e~appgver_f0036c89a00481918d876c4a3a3fc1f0`
- Final deployment: `appgdep_6aa62e17a4088191bfb7e770270f357e`, terminal `succeeded`, no failure
- Same private URL and audience; no new deployment project, public sharing or source-photo hosting
- [Material release evidence](SURFACE_DETAIL_RELEASE.md)

Root closed its temporary local preview and retained the verified production Materials view. Recorded review imports are session-only; durable native review and evaluation files are linked above for reimport.

## Remaining product limits and next research

Hosted GPT Live, image generation and reconstruction inference remain unconnected. The native workflow uses recorded local runs and explicit import/export. No browser-to-Blender geometry adapter, source-linked region overlay, photogrammetric reconstruction guarantee, simulated water physics, biological guarantee or automatic commerce checkout is claimed.

Asset previews honestly depict the existing generic procedural geometry; they are not scanned or species-accurate models. Room backgrounds are visual mockups, not measured fit or matched lighting.

The next research investment should be a controlled capture of one measured physical tank with reliable camera alignment, then better rock/wood geometry and segmentation. That would distinguish reconstruction error from camera/mask error. Prove a repeatable improvement on several held-out tanks before adding more ambitious automation. Connecting authenticated model APIs and demonstrating one actual cursor-authored native edit through a completed model revision are distinct next integration steps.
