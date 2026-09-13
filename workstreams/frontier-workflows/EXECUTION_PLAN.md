# Fishy: integrated frontier release

Plan finalized 13 September 2026, 04:10 UTC. Deadline: **06:02 UTC / 14:02 Singapore**.

This plan supersedes conflicting proposals in the individual planning notes. Planning is complete; implementation is authorized by the user's request. The reference workflow document describes intended behavior, not proof that it already exists.

## Product decision

Keep one directly editable aquarium and the current compact editor. Materials shows genuine renders of the geometry that Add creates. Tank and Arrange use sliders plus precise fields for continuous changes. Ideas holds requests for additional photographic evidence. Arrange exposes human protection and proposed changes. Gallery contains recorded evaluation comparisons alongside its existing inspiration workflow.

The browser scene is authoritative for the site. Native Blender runs remain a separate, explicitly identified renderer. A native score is never a score for the browser's different geometry. A recorded artifact viewer does not imply deployed model inference. No fake Live, Image, reconstruction, or accuracy button will ship.

## Scope and acceptance

1. **Real material previews.** All 19 addable catalog entries get a rendered sample using the exact same descriptor and `makeObject` factory as Add. Use one shared thumbnail renderer/cache and at most one selected interactive preview. Preserve all caveats that these are generic procedural approximations. Juniper remains reference-only. A category icon, supplier photograph, or unrelated Blender showcase is not a preview. Do not undertake 19 new species generators or the 100+ proposed shape parameters in this release.
2. **Useful controls.** Tank width/depth/height, object size and turn, and bounded position where reliable use labelled sliders with exact values. One completed gesture is one history entry; Escape rolls back; stale commits fail; invalid changes are atomic. Categorical shapes stay categorical. Add stretch or substrate controls only if the actual containment/support rules can be verified in time.
3. **Human ownership.** Successful manual transform/shape edits automatically protect the affected object. Protection is visible and can be released explicitly. A proposal uses the current scene/revision, preserves trusted protected fields even when its author tries to change/delete them, and records blocked attempts. Review precedes Apply. Stale results cannot apply; Undo restores the prior state in one step. Imported native geometry cannot bypass an explicit adapter.
4. **Evidence workflow.** Implement bounded named-object photo requests, immutable reconstruction observation IDs, source/view/citations, and truthful `resolved_changed`, `resolved_confirmed`, or `request_unresolved` outcomes. A confirming photo may correctly cause no movement. Native request/answer generation and exported artifacts should support the site's recorded-run review. Hosted inference remains unavailable until an authenticated API adapter is actually connected.
5. **Evaluation.** Implement a frozen-camera native render/mask/score workflow with hardscape silhouette IoU as the primary metric, explicit missing-data states, per-revision identity and no requirement that results improve. Keep camera, mask, renderer and metric fixed for a series. Exclude photos, masks, scores and score-informed hints from generation. Reveal strict test results only after the revision sequence is frozen; otherwise label the split validation.
6. **Real inputs.** Find at least three confirmed views of the same physical aquarium, with source/license provenance. Do not substitute generated views, unrelated tanks or changing build stages. Source dimensions/calibration honestly; do not infer metric accuracy from assumed dimensions. If usable evidence cannot be obtained, deliver tested evaluation tooling and mark real-photo results pending.

## Shared artifact boundary

See `REVIEW_CONTRACT.md`. Browser and native state schemas remain distinct. The website owner owns the TypeScript parser; the native owner implements the exporter against the same version. Local paths are never fetched by the site. Imported records are labelled imported, with their declared provenance, and do not establish authenticity merely because JSON validates.

## Parallel ownership

- **Site owner, existing task “Build Fishy with Terra and Astra”:** sole owner of `site/`, Sites operations and private deployment. Previews, controls, current-scene protections, artifact review and integration tests. Preserve pre-existing `lib/design.ts`, user saves and unrelated work.
- **Native workflow Astra worker:** `blender/generate_scene.py`, native snapshot/control integration, new frontier contract/export module and their tests. May edit recipe/builder code only as needed for truthful preservation. Preserve all existing runs and raw model output. No Site edits/tools.
- **Evaluation Astra worker:** new `blender/heldout_evaluation.py`, `blender/render_heldout.py`, their tests and evaluation notes. Coordinate manifest fields with native owner; no overlapping generator/control edits.
- **Terra research:** `research-inputs/`, source verification and capture manifest only. No model calls or site writes.
- **Terra release QA and Astra contract/security QA:** independent read-only review and isolated tests after integration; report concrete blockers early.
- **Root:** coordination, integrated documentation, actual browser acceptance and final delivery evidence. No competing Site lifecycle.

## Schedule

| UTC | Deliverable |
| --- | --- |
| 04:10–04:20 | Freeze interfaces, source status, preview/control implementation begins |
| 04:20–05:05 | Parallel website and native implementation; fixtures and early checks |
| 05:05–05:25 | Integrate artifacts; bounded genuine Astra run if valid inputs and access permit |
| 05:25–05:42 | Independent correctness, protection, leakage, responsive/browser checks |
| 05:42–05:55 | Fix release blockers; build and private deployment |
| 05:55–06:02 | Verify deployed core flow; report actual evidence and remaining limits |

Checkpoint at 05:05: stop adding optional controls or new geometry. Checkpoint at 05:25: freeze feature scope. Do not use the deadline to skip checks or claim incomplete work is complete.

## Corrections to FRONTIER_WORKFLOWS.md

- Four coplanar corners alone do not calibrate arbitrary unknown cameras; record camera assumptions and alignment residual. Existing aesthetic framing is not camera calibration.
- Accepted revision numbers are incremented by trusted application code, not assigned by model output.
- Holdout leakage includes mask/crop/score feedback, not only the original image path.
- Human edits must be captured from the current unsaved native scene; unsupported topology/tilt/shear must be preserved faithfully or rejected explicitly, never silently approximated.
- A recorded fixture proves protocol behavior. Only an actual model run supports a claim about Astra. Source photo citations do not independently prove causal use of evidence.
- Show unchanged or worse scores honestly. Do not promise invented example percentages.

## Release evidence

Record changed files, tests, browser paths checked, source provenance, actual run IDs/model attempts, evaluation status and deployment version in `DELIVERY.md`. Preserve account privacy and existing project registration. The final handoff links the working private site and calls out any unconnected model services or unproven reconstruction claims.
