# Frontier delivery documentation audit

Audited 13 September 2026 against `EXECUTION_PLAN.md`, `FRONTIER_WORKFLOWS.md`, `SITE_RELEASE_EVIDENCE.md`, `DELIVERY.md`, and `evaluation/green-aqua-real/{README.md,result-summary.json,verification.json}`. This is a documentation-scope audit, not a deployment or browser retest.

## Superseding checkpoint — accepted W1/W3 native branch

`accepted-native-verification-with-target-geometry.json` and the accepted review record a separate, unscored native branch run, `20260913T045133Z-f468b506`, at 04:51:33 UTC. This supersedes the prior statement that no accepted W1 answer-to-revision result existed:

- One bounded model call accepted native base revision 3 as revision 4. It resolved `request-r2-1` for `r1`, changing its height from **19 cm to 15 cm**, with the registered answer `obs-a0331ad408f771fa0c40a4d1` cited in the accepted change. The recorded native size is `[0.137, 0.128, 0.15]` m and matches the accepted recipe.
- `request-r2-2` for `r4` remains `requested`; the accepted branch did not fabricate a resolution.
- The scripted-fixture protected `r3` retained its exact mesh, world matrix, and accepted recipe. The raw proposal made no protection override attempt, so its empty `blockedAttempts` record is correct. This demonstrates preservation for this accepted branch, not hostile-override blocking.
- Native-edit provenance remains `scripted_transform_fixture`, expressly not a cursor-authored human Blender edit. The branch was not evaluated and is separate from the sealed W2 series.
- The earlier branch call `20260913T044524Z-04a1e470` remains rejected for citation scope and attempting to resolve an unanswered request. It produced no accepted result and is retained as rejection evidence; the later accepted call does not erase that outcome.

## Safe final-handoff claims

- The browser release delivers procedural material previews for 19 addable entries using the same descriptor/factory path as Add; Juniper is source-only. It delivers bounded exact/slider controls, local save/history, auto-protection of accepted manual browser edits, explicit release, strict review import, proposal staging/atomic Apply/Undo, and native artifacts as view-only imports.
- The evidence UI is a recorded-artifact and local-photo response handoff. It can register bounded local evidence and export a response manifest; hosted model, voice, image, and reconstruction inference are not connected.
- A real-source native W2 sequence exists for Green Aqua with three reconstruction frames and a reserved held-out frame. Two completed actual Astra reconstruction runs were scored after the two-recipe sequence was sealed. The evaluator made zero model calls.
- W2 hardscape silhouette IoU changed from **0.3441166635 (34.4117%)** at native revision 1 to **0.3443307149 (34.4331%)** at revision 2: **+0.0002140514 / +0.0214 percentage points**. The evidence explicitly calls this essentially unchanged and does not establish meaningful improvement. SSIM is unavailable; union centroid error is supporting, not a geometry-accuracy measure.
- The W2 series is exploratory under assumed 60 × 30 × 36 cm geometry and a manually aligned, uncalibrated camera. The four-corner front-rim RMS discrepancy is **40.683692 px**. Unknown dimensions, intrinsics, distortion, refraction, annotation uncertainty, and statistical significance remain unresolved. `strict_test` refers only to input isolation and frozen two-revision policy.
- Original video frames, held-out imagery, masks, grids, overlays, and source video remain private analysis material and are not rehosted by the site. The review artifact carries identities/scores, not local paths or source images.

## Delivered scope versus deferred scope

| Area | Delivered | Must remain deferred/qualified |
| --- | --- | --- |
| W1 evidence request | Request/observation/response schema, citations, immutable imported review, local response export, native-pending status, plus a separate accepted recorded W1 branch resolution for r1 with exact answer citation. | No connected live browser-to-model workflow or independent visual-accuracy proof. The accepted branch is unscored and limited to its supplied answer; r4 remains requested. |
| W2 evaluation | Frozen real-source two-revision native evaluation, isolation artifacts, fixed camera/mask identity, score hashes, honest near-zero delta. | No calibrated photography, metric reconstruction accuracy, representative benchmark, or evidence that score improved meaningfully. Native score is never a browser-scene score. |
| W3 protection | Browser manual edits auto-protect, can be explicitly released, and survive hostile browser proposals; fixture/native protocol checks exist. The accepted branch exactly preserves scripted-fixture r3 through a model revision. | Do not claim a cursor-human native Blender edit or a hostile native raw override block from the accepted branch: no raw override was attempted there. |
| Model service | Recorded native runs are importable and visibly declared; browser proposes/merges only strict browser artifacts. | No hosted Site model adapter or live browser inference. A parsed/imported record does not authenticate a model run. |
| Materials | Generic procedural previews and Add parity. | No scanned/species-accurate assets, commercial asset reuse, or Behind Glass-level textured/organic rendering claim. Richer textured-material work is separately authorized after the V10 core release and is outside these native metrics. |

## Delivery-record check

`DELIVERY.md` is consistent with the accepted branch record: it retains the rejected first call, states the accepted run's r1 19 cm → 15 cm change and r4 pending status, identifies the fixture provenance, and does not convert W2's near-zero delta into an improvement claim. Its Version 10 publication entry identifies commit `8e1d6bd131927a40a6f90059d26d3ad58dd34fd6` and success at 04:52:11 UTC. No unsupported delivery claim was found in that record during this bounded check.

`SITE_RELEASE_EVIDENCE.md` remains a Version 8 / 04:35:34 UTC checkpoint and should remain cited only as its historical checkpoint; `DELIVERY.md` is the current V10 release record.

## Statements requiring careful attribution

1. `FRONTIER_WORKFLOWS.md` is an intended-workflow document. Its W1/W2/W3 demo moments and target recorded-live-run language are not completion evidence. The execution plan already says reference workflow text is not proof.
2. Do not turn W2's +0.0214 pp into “improved,” “more accurate,” or a centimetre claim. Use the exact near-unchanged result and its calibration limits.
3. Do not describe W3 as a live native human-drag success. Separate browser manual-edit evidence, fixture/hostile tests, and the accepted scripted-fixture preservation result.
4. Do not say that the rejected first branch call answered a request, changed an object from evidence, or produced an accepted run. Its citation-scope/unanswered-request rejection is the correct outcome.
5. Test counts in historical evidence notes are time-specific. Do not combine them with later totals. State the exact command, source revision, and resulting count for the release being described.

## Recommended final wording

“Fishy now provides a local procedural editor with shared-factory material previews, transactional controls, browser-side manual protection and reviewable imported artifacts. It includes a private, exploratory native Green Aqua evaluation: hardscape IoU was 34.4117% then 34.4331% (+0.0214 pp), an effectively unchanged result under assumed dimensions and an uncalibrated manually aligned camera (40.68 px front-rim RMS discrepancy). Native scores are not browser-scene accuracy. A separate unscored recorded branch accepted an answer-cited r1 height change from 19 cm to 15 cm while retaining r4 as requested and preserving scripted-fixture protected r3 exactly; it is not live browser inference or a cursor-authored native edit. Hosted reconstruction inference is not connected.”
