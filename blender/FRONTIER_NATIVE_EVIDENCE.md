# Native frontier evidence — 13 September 2026

## Implemented behavior

The native runner accepts named-object photo answers, keeps immutable observation IDs and citations, distinguishes changed/confirmed/unresolved outcomes, and exports strict view-only native review artifacts for the browser. Uncited inference is explicit. A changed answer requires a real same-object geometry change; a label edit alone cannot satisfy it.

Current unsaved Blender translation, yaw and positive scale are captured before a revision. Manual transforms protect their objects; protected native mesh and world matrix are preserved exactly in the separate result. Unsupported topology, tilt, shear and other unrepresentable edits reject before inference. Raw attempted changes remain available separately from effective accepted geometry.

Both model transports validate final image bytes, paths, roles and hashes. Evaluation-gated Codex runs receive private checked copies and a macOS OS sandbox denying project-directory reads. The separate API path exposes no filesystem tools.

## Actual model runs

- `runs/20260913T042211Z-f9853fc4`: one completed Astra request from the Commons front image, 16 editable objects. Its requested right-center stone close-up is still pending because the available close-up depicts a different stone. No false answer was registered.
- `runs/20260913T042710Z-2522618f`: renderer-only derivative of that run, zero model calls, imported-run provenance, needed to add a later native snapshot baseline.
- `runs/20260913T043221Z-1b5ea408`: one completed Astra initial reconstruction from the three permitted Green Aqua frames, native revision 1.
- `runs/20260913T043532Z-af1a9947`: the one preplanned render-guided Astra revision, native revision 2. Both accepted recipe hashes were frozen before the separate evaluator rendered or revealed results. Neither model received the heldout frame, mask, camera settings or scores.

The native owner remained blind to all heldout contents and scores. The evaluator owns the separate review-with-evaluation export and its limitations. The real source scale remains an assumed 60 × 30 × 36 cm design canvas, not a recovered measurement.

## Runtime verification

`frontier-fixtures/native-runtime-final/unsaved-snapshot-02/snapshot.json` records an explicitly scripted protocol edit in actual Blender. Nine assertions passed for unsaved capture, automatic protection, source-file preservation, stale state, unsupported edits and protected effective merge.

A separate Blender process opened `frontier-fixtures/native-runtime-final/unsaved-effective-final.blend` and passed four more assertions: exact protected mesh hash, exact protected world matrix, stable identities, and the accepted unprotected rock move. These scripted fixture edits are not presented as human cursor actions or model performance.

Three protocol review artifacts under `frontier-fixtures/20260913-protocol-v1/` exercise changed, confirmed and unresolved answers, including blocked protected attempts. They were cross-parsed by the actual Site parser. Independent security checks covered renamed heldout bytes, role changes, symlink escape, path confinement and hash mismatches.

The complete stdlib test suite ran 110 tests after the label-only resolution, snapshot provenance and rejected-output regressions: 109 passed and one separate opt-in native renderer test was skipped by default. The frontier subset passed 18/18. Actual native rendering was exercised separately as described above.

## Separate branch and rejected model proposal

`frontier-branches/green-aqua-answer-115s-20260913/` contains a prepared, separate, unscored input gate for a truthful additional 01:55 close-up of the left foundation. The original two-state strict evaluation remains immutable. Preparing the gate made no model call. Safe cursor targeting was unavailable, so a separate actual Blender process applied an explicitly scripted +1cm X / +0.035rad yaw edit to r3 and captured native revision3. The snapshot and downstream manifest carry scripted_transform_fixture provenance; no cursor-authored native edit is claimed.

One approved actual model call, runs/20260913T044524Z-04a1e470, returned a proposal but failed strict validation before build. It preserved protected r3 exactly and proposed confirming r1 without geometry movement, but incorrectly cited the r1-only answer for neighboring plants p4 and p9. It also emitted a resolution for unanswered r4. The raw proposal and failed manifest remain immutable. These proposed outcomes are not accepted results. Prompt guidance was clarified afterward; no automatic retry occurred.

The exact observed violations and raw proposal SHA256 are retained in the separate branch rejected-run-analysis.json. proposed-followup.json preserves the reviewed follow-up proposal. Root then explicitly approved that one fresh call; followup-execution.json records its execution. The failed run counts as one actual model call.

## Accepted real photo-answer and protected branch

The explicitly approved fresh follow-up, `runs/20260913T045133Z-f468b506`, completed with one actual model call and no automatic retry. Across this branch there were **two model calls: one rejected, one accepted**. Same snapshot SHA, same four permitted image bytes, same gate and same brief; only the prompt clarification changed.

The accepted native revision is base3 → revision4. The real 01:55 answer resolved request-r2-1 as changed: r1's height changed from 0.19m to 0.15m with the exact answer citation. This remains approximate geometry from an uncalibrated photograph, not a measured dimension. The other r4 photo request remains pending.

An independent Blender process verified the protected r3 mesh, world matrix and accepted recipe against the captured scripted snapshot exactly. The model did not attempt to override r3, so the real run's blockedAttempts array is honestly empty; deliberate blocked-override evidence remains in the protocol fixtures. The snapshot and manifest explicitly record scripted_transform_fixture. No cursor-authored native edit is claimed.

Accepted native review: `runs/20260913T045133Z-f468b506/frontier-review.json`. Verification is under `frontier-branches/green-aqua-answer-115s-20260913/accepted-native-verification-with-target-geometry.json`; it also confirms that the actual native r1 geometry matches the accepted 0.15m height. The original strict W2 two-state series remains immutable; no heldout score is attached to this separate branch.
