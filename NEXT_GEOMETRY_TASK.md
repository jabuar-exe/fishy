# Next task: Astra-authored aquarium geometry

Latest priority update, 13 September 2026: [WEB_FRONTIER_RISK_REVIEW.md](WEB_FRONTIER_RISK_REVIEW.md) reflects the user's deployed-site and picture-conversation-to-3D goal. Model-authored geometry is again central, with a browser-native builder and shared scene state. The Blender-specific ownership and execution details below are historical implementation guidance; preserve the existing prototype while adapting the contract to the deployed editor.

Continue the working photo-to-Blender prototype by letting Astra define the shapes of the hardscape. Keep Blender's native cursor orbit, object dragging, undo, bounds checking, and generation controls usable.

## Outcome

Produce one editable aquarium whose wood uses model-authored connected branch graphs and whose rocks use model-authored bounded silhouettes. Then give Astra the reference, recipe, and renders for one revision. Use the same frozen builder for both runs. Deliver both scenes, comparison renders, verification results, and a candid assessment of fidelity.

The existing reference is `facebook_fishtank_photos/final_candidates/07334576064f0460.jpg`. Tank dimensions remain assumed at 60 × 30 × 36 cm, with 3 cm substrate. The image is only 280 × 210 pixels; it cannot establish accurate real-world reconstruction. Do not invent measured dimensions or held-out views.

## Agent coordination

The user requested `max_threads = 50` and `max_depth = 3`. These values already exist under `[agents]` in the user's Codex config. The installed CLI accepted a strict-config app-server startup. This does not establish the capacity of a newly launched task: inspect its supplied runtime limits, respect any lower cap, and report the effective limit honestly. Treat the requested numbers as ceilings, not a requirement to create 50 agents. Keep delegation to at most three levels below the coordinator even if runtime configuration differs.

Use bounded agents with explicit ownership and warn every worker that others are editing the workspace. Settle the coordinate and geometry contract before dependent implementation begins. Suggested ownership:

1. Contract: `blender/scene_recipe.py`, schema, fixtures, and contract tests. Retain v1 loading. Bound graph nodes, edges, radii, and rock-profile complexity; reject nonfinite numbers, bad indices, disconnected graphs, degenerate geometry, and excessive complexity.
2. Geometry: new geometry helpers and `blender/build_recipe.py`. Build native meshes from validated data; preserve object IDs, coordinates, editing controls, and predictable bounds. Decide whether geometry coordinates are normalized before using `fit_asset()`, which currently rescales axes independently and could distort authored proportions.
3. Generation and integration: `blender/generate_scene.py`, any necessary native UI changes, documentation, and run orchestration. Request structured data, never execute model-authored code. Preserve a maximum of one logical model request per generation invocation and immutable provenance.
4. Verification: `blender/verify_recipe_scene.py` and geometry-specific tests. Verify intended graph/profile geometry independently of envelope checks; retain existing compatibility checks. Review integration after the workers finish.

## Validation and evidence


Add the three frontier workflows from [workstreams/frontier-workflows/FRONTIER_WORKFLOWS.md](workstreams/frontier-workflows/FRONTIER_WORKFLOWS.md): evidence request, held-out score, and protected edit. Their schema additions (observations, protected, revision) belong to the Contract owner; the builder-side protection override belongs to Geometry; the held-out loader allowlist and scores belong to Verification.
Read `blender/README.md` and `blender/ASTRA_RUN_RESULTS.md` before editing. Existing validation has 31 offline tests and six Blender runtime checks per generated scene. Add focused checks for the new behavior; run relevant offline and Blender checks before live model requests.

Request `gpt-6-astra` for the scene-generation calls through the existing signed-in Codex transport. Keep the task's configured agent model unless the user specifies otherwise. Plan at most two live generation invocations for this milestone: one initial scene and one revision. Preserve failures and raw responses without silent retries, substitutions, or manually edited model output. Record builder identity, inputs, recipes, renders, elapsed time, reported usage, and unavailable monetary cost honestly. Freeze the builder between the initial and revision runs.

## Preserve existing work

At handoff, the repository has an unborn `main`, no HEAD, and no tracked files. All current source, docs, starter scene, and photos are untracked; `blender/runs/` is ignored. A default Git worktree cannot reproduce this state. Resolve the task's workspace before starting edits; do not assume an empty checkout contains the prototype.

Preserve all existing run folders, raw recipes, renders, photos, and `fishy-studio.blend`. Write new artifacts to fresh paths. Do not replace an open Blender scene or save over user edits. Do not discard or revert others' changes. Voice, commerce, and biological validation are outside this geometry milestone.

The Blender executable is `/Users/joshuabanzon/Applications/Blender.app/Contents/MacOS/Blender`. Launch it directly with an argument list; prior macOS `open --args` attempts did not reliably load the intended scene.
