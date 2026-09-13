# Frontier workflows inside Fishy v2

Plan only, 13 September 2026. Reviewed FRONTIER_WORKFLOWS.md plus current page.tsx, scene-controls.tsx, gallery-workspace.tsx, scene.ts and geometry.ts. No implementation, site edits or model calls were performed. Retain Tank / Materials / Arrange / Ideas and existing Gallery. Add no top-level workflow tabs.

## One integrated loop

**Ideas** collects reconstruction photos and asks for missing evidence → **Arrange** reviews a proposed scene change while respecting human edits → **Gallery** compares accepted revisions against reserved evaluation evidence. A compact run-status item in the existing project/status area links to whichever task requires action. The canvas, active selection and project remain continuous across the loop.

Use one shared frontend run reference (run ID, current scene revision, proposal revision, status, links to artifacts). Panels render slices of that state. Scene selection, temporary slider draft and candidate material remain UI state; photo roles, observations, protection and accepted edits must be persisted in the versioned backend contract. A browser object URL is not a durable observation.

## W1 · Evidence request

**Home: Ideas**, directly above Reference photos when an actionable request exists. Show one request card at a time, highest priority first: object name chip, exact missing observation, requested view and why. Example: “River wood · Right-side photo needed. Show where the branch ends behind the rock.” Primary action **Add right-side photo** invokes upload with the request ID and requested view preselected. Secondary **Show object** selects that stable object in Arrange/canvas. A second request can sit behind “1 more request”; do not stack permanent alerts.

Photo card contains filename/thumbnail, immutable photo ID in details, role (**Reconstruction** or **Held out**), enumerated view and linked observation count. View is a categorical selector: Front / Left / Right / Top / Close-up [object]. Selecting a view alone is not uploading or sending. Upload succeeds before **Revise with this photo** becomes available; that action sends reconstruction-role photos only. State is explicit:

`requested → uploading → ready_to_revise → revising → proposal_ready → resolved | confirmed | unresolved | failed`.

Resolved means the proposal changed a named object and cites the new observation. Confirmed means the photo corroborated the prior interpretation and no change was needed. Unresolved means the requested uncertainty remains; show that result without a fabricated movement. FRONTIER_WORKFLOWS currently calls all unchanged cases unresolved while its fixture expects a confirming photo to cause no move: the contract should distinguish confirmation from failure before implementation.

**Object citations: Arrange**, within an “Evidence” disclosure under the selected object's controls. Show compact “Right photo · observation 3” buttons and a short observation. Clicking opens the actual photo with normalized region rectangle, preserving current selection. Region is an outline, not an opaque cover. Keyboard users can select the citation and read its note without cropping interactively. Uncited objects display **Inferred** with explanation in review, never a made-up confidence percentage. The same citation appears on that object's change row in the proposal review.

Uploaded supplementary evidence answering W1 is always reconstruction evidence and cannot become held-out evidence later in the same run. Library inspiration photos and URLs do not automatically become reconstruction observations.

## W2 · Evaluation

**Home: Gallery's existing comparison area**, reached through **View evaluation** on the run status. This is a specific comparison mode within Gallery, not a new main tab. Keep current aesthetic/reference browsing separate in language and state: “Study a reference” is not “Evaluate reconstruction.” Gallery uploads currently used for visual inspiration must not silently enter an evaluation run.

Setup before the first generation: in Ideas' photo collection mark exactly one reserved photo when the run has the required 3–5 photos; show **Held out · never sent to Astra** only after server role/allowlist verification. Setup opens a Gallery overlay to align tank corners and define the hardscape mask. Save named camera + mask + metric configuration with the run, then display **Evaluation setup locked**. Editing any of these later requires a new evaluation series; do not recompute only the latest score against a changed baseline.

Evaluation layout: top strip run/revision selection; **held-out photo | fixed-camera render** side by side; controls for Before / Latest and optional Mask overlay. Show primary **Hardscape overlap (IoU)**, baseline, latest and signed change in percentage points. Supporting numbers retain their exact meanings and units: SSIM or LPIPS (which one is fixed at run start), centroid error in pixels with evidence coverage count. Do not call this overall aquarium realism or centimetre accuracy. Show “Not scored” rather than zero when missing; show regression in the same weight as improvement.

State: `needs_photo → needs_alignment → needs_mask → ready → rendering → scoring → scored | failed`. Every accepted revision gets its own immutable score entry, keyed to camera/mask/metric version. A pending render leaves the last completed result visible with its actual revision badge. A failed score does not overwrite the preceding value or invent a delta.

**Camera/mask interactions:** fixed evaluation camera is distinct from the editable orbit camera. Orbit, zoom and Frame in Editor cannot alter it. Evaluation image ratio follows the source photo. Alignment uses corner handles with keyboard nudging and reset before locking, not vague camera sliders. Mask overlay opacity can use a 0–100% view-only slider; it never changes mask membership or scoring. Mask correction uses draw/erase categorical tools and an appropriate brush-size slider before locking. A split-image divider is an accessible view-only slider; it does not change scores. The held-out original, crop, segmentation, masks and comparison render must stay outside model context, not merely outside the visible prompt text.

## W3 · Human edits, protection and proposal review

**Home: Arrange.** After a completed human shape/transform edit, automatically protect the object for subsequent AI revisions once the backend supports that policy. Show a small row icon and plain status “River wood protected after your edit.” Protection is a boolean switch in the object's existing details, labeled **Protect from AI changes**, with explicit **Release protection** interaction. Keep manual adjustments enabled. Do not announce an auto-protection guarantee until the accepted scene and builder enforce it.

Proposal review reuses Gallery's spacious comparison layout or an in-canvas review overlay reached through **Review 3 changes**; it is not another permanent dock. Show current and proposed scene from the same review camera (separate from held-out evaluation camera). List only meaningful changes: object name, before→after transform/shape summary, human/model source, observation citation, and protected status. Selecting a row highlights that object. A protected-object attempt appears as **Blocked · your position retained** even when the model attempted to delete/resize/change its form.

Controls: **Accept revision** and **Keep current** (or Dismiss proposal). Don't expose per-object accept unless contract supports independently valid subset application. Acceptance is one atomic validated scene edit/history step against the proposal's base revision. A human edit while a proposal is pending makes it stale: preserve human work, disable Accept, explain **Scene changed. Request an updated proposal.** A protected-object violation cannot be accepted through an override checkbox. Release protection first, then request a new proposal if the user intends that change.

W3 validation reports exact retained values and the builder check. The frontier acceptance mentions 1mm/1° tolerance; UI should say “Unchanged” only when canonical protected values were retained, or explicitly show the measured tolerance otherwise. Do not round a real difference to zero. No-op proposals report no change and add no misleading successful-edit message. For native Blender edits, backend import/export must map the same stable IDs before claiming continuity with browser Arrange.

## Appropriate control types

| Existing/task value | Planned control | Semantics |
| --- | --- | --- |
| Tank width, depth, height | Slider + exact cm field per dimension, with preset choices retained | 10–300cm schema bounds; sensible 1cm slider step, exact field preserves precision; one resize/fitting transaction per gesture |
| Object size | Existing Adjustment slider + exact percent | Full 5–400%; one commit, same geometry bounds and revision check |
| Turn around Y | Existing Adjustment slider + exact degrees | Existing −360–360° presentation; preserve canonical rotation |
| X/Y/Z placement | Slider + exact cm inside Precise position | Feasible limits derived from transformed object bounds and tank, with precision entry; never raw arbitrary −999..999 UI range |
| Substrate depth, if editing exposed | Slider + exact cm | Existing 0–5cm schema limit plus actual tank fit constraints; do not expose without resize/geometry validation |
| Material, shape, photo view, tank preset | Categorical cards/radio/segmented choices | Never map category order onto a slider |
| Water surface, protection | Boolean switch | Protection is not a strength/percentage; water remains visual effect |
| Photo evidence region / alignment corners | Spatial handles + keyboard controls | Actual normalized crop/corner coordinates, no free slider proxy |
| Mask overlay opacity / comparison wipe | View-only slider | Never mutates evidence or scores |
| Mask brush size | Slider before setup lock | Clear px units; distinct draw/erase buttons |
| Score, uncertainty status, evidence role lock | Read-only result / explicit role choice at setup | No adjustable score, confidence slider, or live held-out reassignment |
| Revision selection | Labeled select or Previous/Next | Discrete named revisions, not an ambiguous continuous range |

All scene sliders retain Adjustment's existing draft, Escape cancellation, stale-revision and one-history-step behavior. Exact field remains usable without dragging. Keyboard arrows use a stated step and Home/End valid bounds. Show the pending draft value without persisting it as an accepted revision. Live preview, if added, needs a separate transient scene preview path and cannot call the committed scene reducer on each tick. Sliders are not blanket replacements for every number.

## Actual geometry previews · every addable asset

Materials currently renders GitBranch/Leaf icons; shape choices are text radios. These do **not** satisfy the user's 3D sample-preview requirement. Each addable registry item must get a preview rendered from the **same geometry factory and material/default object descriptor that Add uses**, especially every plant form. Share the descriptor function rather than duplicating kind/form/color/size logic between thumbnails and insertion.

Grid tiles show static 3D thumbnails of that real generated geometry on a consistent neutral backdrop, three-quarter camera, soft shadow and generous bounds. The selected candidate's detail area shows a larger real 3D preview with orbit and Reset view. Changing candidate or form updates the actual mesh. Don't rotate every tile forever or create one WebGL context per tile: use pre-rendered cached geometry thumbnails (build-time or shared offscreen rendering) and one active preview renderer. Cache key includes catalog ID, rendererForm, geometry/material version and relevant descriptor values. Every addable asset must resolve to a thumbnail + matching selected preview before release.

Plant thumbnails must reveal distinctions between stem, grass, moss, carpet, fern and broadleaf, including actual color/shape used on insertion; reuse of an identical shared mesh must be disclosed as a procedural form rather than disguised as species accuracy. Include a small **Procedural 3D form** caption and retain source caveats in Details. A preview is not evidence the model is botanically exact.

Reference-only items are explicitly **No editable model**, show source content only when available, and offer Save reference. Never enable Add with a fake image placeholder. Preview failure is explicit with Retry; do not fall back to an icon and claim coverage. Preview interaction neither changes selected scene object nor consumes an undo entry. It must not issue a model request. Keyboard label names the asset and form; users can Add without operating orbit. On narrow screens the selected preview sits above Add inside the Materials sheet.

## Current disconnections / dependencies

- **W1 disconnected:** Ideas photos exist only as session object URLs with name/size; no durable photo ID, request ID, view tag, role, region observation or citation links. Current scene schema has no observations/evidence fields. Assistant is explicitly unavailable; only a read-only scene tool is registered.
- **W2 disconnected:** Gallery offers reference/current-creation comparison and independent session photo uploads, not a held-out run, persisted camera/mask, immutable scores or before/after evaluation series. Current Editor orbit render is not a fixed evaluation artifact.
- **W3 partial:** SceneObject has protected and commitScene has an AI actor guard. Current browser transformations commit manually and do not automatically protect/log before-and-after source-tagged edits. No live AI proposal/review acceptance path is connected, and browser IDs are not shown bridged to native Blender records.
- **Preview disconnected:** Materials uses icons rather than actual generated samples. Geometry factory exists and should be reused. Current object Size/Turn sliders already work; tank dimensions and precise positions are numeric-only.
- **Schema distinction:** FRONTIER_WORKFLOWS addresses Blender recipe/run schema; website uses strict scene v4. A versioned bridge must align IDs, units, coordinates, revision and protection semantics. UI cannot simply append backend fields to the strict current scene and assume migration works.

## Plan exit / integration acceptance

Before implementation, agree run/photo/proposal/evaluation contracts and the browser↔Blender mapping. Then implement W3 protection/review, W2 setup/artifacts, W1 request/citations, and material-preview coverage alongside their existing task homes. Completion evidence: every addable asset has matching generated preview; one slider gesture undoes once; a manual protected edit survives a hostile proposal; a requested photo is linked to a cited changed/confirmed object; held-out evidence is demonstrably excluded from model input; Gallery displays real comparable baseline/latest scores including honest failure or regression. Keep the existing shell; the new behavior should feel like the next action in a single aquarium project.
