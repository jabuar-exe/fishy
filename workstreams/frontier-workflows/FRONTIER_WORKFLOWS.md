# Fishy frontier workflows: evidence request, held-out score, protected edit

13 September 2026. These three workflows define the intended visual-understanding evidence for the demo. They are requirements, not a claim that the evidence already exists. They sit on top of the shared loop in [THREE_TRACK_DEMO.md](../../THREE_TRACK_DEMO.md) and address findings from [WEB_FRONTIER_RISK_REVIEW.md](../../WEB_FRONTIER_RISK_REVIEW.md).

**Current implementation direction:** [EXECUTION_PLAN.md](EXECUTION_PLAN.md) and [REVIEW_CONTRACT.md](REVIEW_CONTRACT.md) govern this release. The deployed browser editor and native Blender renderer have different geometry and coordinate contracts. Review artifacts connect their workflows without equating their scenes or accuracy scores. The individual plans are supporting analysis, not additional mandatory scope for the two-hour release.

| Workflow | Demo moment | Finding it closes | Artifact produced |
| --- | --- | --- | --- |
| W1 Evidence request | Astra asks for one specific extra photo, then records a cited change, confirmation, or unresolved uncertainty. | Real-photo references are not linked to scene IDs. | Recorded request, answer observation, and truthful revision outcome. |
| W2 Held-out score | A before-and-after render pair against a photo Astra never saw, with its actual score and any regression visible. | Current checks do not establish photographic accuracy; `generate_scene.py` reports "No held-out view was evaluated." | `heldout_score.json`, side-by-side image. |
| W3 Protected edit | A human drags the driftwood; the next revision leaves it exactly where it was and fixes something else. | Manual scene edits are omitted from later revisions; protection is only a prompt instruction. | `edit_log.json`, protected-object transform equality check. |

All three run inside the existing generate, build, verify sequence in `blender/`. None of them requires a new model capability. They require the software to record, pass, and check things it currently discards.

## Shared contract additions

Add to `scene_recipe.schema.json`, versioned so v1 recipes still load:

- `observations[]`: `{id, photo, region: [x0,y0,x1,y1] normalized, note}`. Every object may carry `evidence: [observation ids]`. An object with no evidence is marked `inferred: true` and rendered with a visible marker in the review sheet.
- `protected[]`: object IDs the model may not move, rotate, resize, or delete. The builder, not the prompt, enforces this.
- `revision`: integer, incremented on every accepted recipe. Every model call receives the current revision and must echo it. A returned recipe echoing a stale revision is rejected.

Add to the run folder layout: `photos/reconstruction/`, `photos/heldout/`, `requests/`, `edits/`, `scores/`. The held-out folder is never listed in any prompt payload. Enforce this in code with an allowlist on the image loader, not by convention.

## W1: Astra asks for a specific extra photo

**Trigger.** After the initial recipe, or after any revision, Astra returns `uncertainties[]` alongside the recipe. Each item is `{object_id, question, requested_view, why}`. `requested_view` is one of a small enumerated set: `front`, `left`, `right`, `top`, `close_up:<object_id>`. Free-text camera requests are rejected so the request is actionable and checkable.

**Steps.**

1. Generation prompt asks for at most two uncertainties, ranked. Require that each names an object ID and a view from the enumeration. Reject items that do not.
2. The app shows the top request as a plain sentence: "I cannot tell how far the driftwood extends behind the rock. A photo from the right side would settle it." Store it in `requests/<revision>.json`.
3. The human supplies the photo. It is registered as a new observation with the requested view tag and is added to `photos/reconstruction/`. It is never eligible for the held-out set.
4. The next revision call includes the new photo, the request it answers, and the instruction to revise only objects the request named unless another discrepancy is visible. The response must list which observation IDs justified each change.
5. Verification diffs the two recipes. `resolved_changed` requires a change to the requested object citing the answer observation. A confirming answer may legitimately produce no change; record `resolved_confirmed` with that observation and an explanation. Missing or inconclusive evidence remains `request_unresolved`.

**Acceptance.** One recorded run where the request names an object, the supplied photo has that view tag, and the outcome cites the exact answer observation. `resolved_changed` additionally requires a real change to that object; `resolved_confirmed` requires no change to it. An inconclusive answer remains unresolved. Fixtures exercise changed, confirmed and unresolved cases without claiming model performance.

**Demo line.** Show the request text, the phone photo being taken, and the object moving. Say the number of centimetres it moved.

**Failure to prevent.** Astra asking a vague question, or asking a question and ignoring the answer. Both are caught by the enumeration and the citation requirement.

## W2: Before-and-after score against a held-out view

**Trigger.** Every accepted recipe, automatically.

**Steps.**

1. At run start, split photos. With three to five verified views of the same unchanged physical tank, hold out exactly one. Record the choice in the existing `manifest.json` authority. The final model transport allowlist excludes held-out photos and derivatives by confined path, role and content hash, including duplicate aliases.
2. For the held-out photo, establish camera pose once and record intrinsics, alignment assumptions and residual. Store it as a named camera in the scene. Four coplanar corners alone do not solve arbitrary unknown cameras or refractive depth; aesthetic framing is not calibration. Without adequate alignment, keep results exploratory and state the limitation.
3. After every build, render from the held-out camera at the photo's resolution. Save `scores/<revision>_render.png`.
4. Compute one primary number and two supporting numbers. Primary: silhouette IoU of the hardscape mask between render and photo. Supporting: LPIPS or SSIM on the masked region, and per-object centroid error in pixels for objects with evidence. Masks for the photo come from a one-time manual or segmentation pass and are stored, not recomputed per revision.
5. Write `scores/<revision>.json` and a side-by-side image: photo, render, mask overlay, with the primary number printed on it.
6. The review sheet shows revision 0 and the latest revision next to each other, with the delta.

**Acceptance.** A score exists for each revision in the frozen evaluation sequence. Report the observed delta, including unchanged or worse results. Improvement is a research hypothesis, not a condition that justifies selecting a more flattering run.

**Demo line.** Use the actual recorded pair and explain its camera assumptions. The completed Green Aqua experiment measured approximately 34.4% silhouette overlap for both revisions; it did not establish meaningful improvement. See `evaluation/green-aqua-real/result-summary.json`. The later requested-photo branch is separate and unscored.

**Failure to prevent.** Leaking the held-out view, its masks/crops/overlays, scores, or score-informed revision hints into generation. Freeze the sequence before revealing strict test results; an iteratively consulted split is validation. Fix metric, camera and mask before comparing revisions, and retain the exact renderer/recipe hashes.

## W3: Human moves the driftwood, the model leaves it alone

**Trigger.** Any native Blender transform on an object between revisions.

**Steps.**

1. `fishy_controls.py` records every transform edit as `{object_id, before, after, timestamp, source: human}` in `edits/<revision>.jsonl`. This already exports transforms; add the log and the source tag.
2. On the next generation call, `generate_scene.py` reads the current scene, not the prior recipe file. Objects with a human edit since the last revision are added to `protected[]` automatically. The prompt states which objects are protected and why, in one sentence each.
3. The model returns a full recipe as before. The builder applies it with a rule: for every protected ID, take transform and shape parameters from the current scene, never from the recipe. Log any attempted change as `protection_override_blocked`.
4. Verification asserts transform equality for protected objects to within one millimetre and one degree, and asserts that at least one non-protected object changed if the model reported a fix.
5. The user can release protection explicitly through a control. A protected object remains protected across revisions until released.

**Acceptance.** Fixture test: recipe attempts to move a protected object; built scene shows the human position; log shows the block. Live test: drag the wood, run a revision that also has a visible rock discrepancy, confirm the wood is unchanged and the rock moved.

**Demo line.** Drag the driftwood a few centimetres left. Ask for a revision. Wood stays. Rock moves. Say "it is fixing the rock and it knows the wood is mine."

**Failure to prevent.** Protection that works only because the model happened to comply. The builder override is the guarantee. Show the blocked log line if it fires.

## Order of implementation

1. Contract: schema additions, run folder layout, held-out allowlist on the loader. Tests first.
2. W3, because it is builder-side and needs no model change. It also makes the demo safe to touch.
3. W2, because it needs the held-out camera fit and masks, which are manual and should start early.
4. W1, because it needs prompt work and one live model round.

The target is a fixture test and one recorded live run for each workflow in `blender/runs/`. Report completion separately: fixtures prove protocol behavior; only completed model runs support model-performance claims. Update `ASTRA_RUN_RESULTS.md` with actual run IDs and numbers, and explicitly mark unavailable real-photo evidence or unconnected services.

## What these workflows do not establish

They do not establish metric accuracy in centimetres without independent measurements of the real tank contents. They provide mechanisms to test evidence use, unseen-view performance and edit preservation. Passing protocol tests alone establishes none of those model-performance claims. The delivered browser uses local artifact handoff; hosted model inference remains unconnected. See [DELIVERY.md](DELIVERY.md) for actual runs, rejected attempts and tested limits.
