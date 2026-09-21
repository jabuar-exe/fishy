# Fishy in Blender

A native desktop aquarium prototype with a working Astra photo-to-scene connection. `fishy-studio.blend` remains the procedural starter. Actual Astra-generated designs are saved separately under `runs/`. See **ASTRA_RUN_RESULTS.md** for the first generation and render–compare–revise evidence.

## Open

Double-click **Open Fishy.command** in this folder. It opens `fishy-studio.blend` and registers the Fishy sidebar. Opening the `.blend` directly gives native editing, but the custom sidebar requires the launcher.

Double-click **Open Latest Design.command** to open the latest completed Astra design in another Blender instance. It makes no model request and preserves an existing Blender session.

Blender is installed at `/Users/joshuabanzon/Applications/Blender.app`. The launcher uses that local path. Editing saved scenes works offline. Generating a new scene uses the signed-in Codex CLI and account capacity; CLI 0.154.0 was verified with Astra.

## Generate from a photo

Click **Astra Design** in the viewport tool header to enter a reference image, a short design brief, and tank dimensions. Generate starts a background process so Blender remains usable. When complete, Open Result opens a separate Blender instance. Dimensions are labeled assumed in this prototype UI. **Tank Tools** in the same header provides rotation, bounds checking, and view presets.

Both panels also live in the Fishy sidebar. Blender's sidebar category strip sometimes failed to refresh during testing; the header buttons provide direct access. The complete Generate → progress → Open Result path was verified in the desktop app, including cursor orbit while generation ran.

The command-line runner also supports multiple references, measured-dimension labeling, and a revision call using a prior run's renders. See ASTRA_RUN_RESULTS.md for examples. The optional `--backend api` uses `OPENAI_API_KEY` from the local environment; the demonstrated runs used `--backend codex`.

## Build a browser design in Blender

The browser editor exports a recipe this folder builds directly, so an aquarium
composed in the web app becomes a native, editable Blender tank. No model call
is involved: the conversion is pure geometry, which is why it stays off the web
request path (see `../design-lab/PRODUCT_DIRECTION.md`).

1. In the editor, open the project menu (`...`) and choose **Export Blender
   recipe**. That writes `fishy-recipe-revision-<n>.json`. **Export scene data**
   still writes the browser scene itself, which `scene-to-recipe.mjs` also accepts.
2. Build it:

```sh
/Users/joshuabanzon/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --python-exit-code 1 \
  --python blender/build_recipe.py -- \
  --recipe ~/Downloads/fishy-recipe-revision-7.json \
  --output /tmp/aquarium.blend --render-dir /tmp/previews
```

To convert an exported *scene* rather than a recipe, run the converter first:

```sh
node --experimental-strip-types site/scripts/scene-to-recipe.mjs \
  ~/Downloads/fishy-revision-7.json -o /tmp/recipe.json
```

`site/lib/recipe.ts` owns the conversion and mirrors `scene_recipe.py`:
the browser is Y-up with the origin at the floor centre, a recipe is Z-up with
the origin at the front-left-bottom corner, so `x = site_x + width/2`,
`y = depth/2 - site_z`, `z = site_y`. Recipe schema v2 requires a `design`
block; the web agent now returns one with every generated aquarium, and a scene
that carries none gets one derived from its own geometry and declared as an
assumption.

**What does not cross over.** A recipe carries approximate asset envelopes, a
yaw and a seed, not the browser's mesh. Blender regenerates `rock`,
`branchwood`, `grass` and `bush` procedurally inside each envelope, so the built
tank matches the composition, footprint and scale rather than the exact
silhouette. Sculpt edits transfer as bounds only, and per-object colour does not
transfer. The exporter refuses rather than repairs: because a recipe rotates the
whole pre-yaw box while the browser fits the actual rotated mesh, a steeply
yawed long branch can need more depth than the tank has, and that export fails
naming the object instead of silently shrinking it.

## Design principles and review

Design quality is the core consideration (see `../DESIGN_PRINCIPLES.md`). The generation prompt carries the eight principles, and recipe schema version 2 requires a `design` block: composition scheme, focal object, sightline, open-foreground target, mood, maintenance tier, and story. Version 1 recipes from earlier runs still load and build.

After validation, every run writes `design-review.json`: geometric proxies from object envelopes (hardscape footprint, open channel from the front, mass distribution across thirds, focal placement, covered floor, waterline, depth bands) with findings ranked warnings first. A revision call receives the prior run's review as data. Review any recipe without a model call:

```sh
python3 blender/design_review.py blender/runs/<run>/recipe.json
```

The review says nothing about biology, water, growth, or how real materials look; it removes the common compositional failures the source material agrees on.

## Cursor controls

| Action | Control |
| --- | --- |
| Orbit around the aquarium | Drag the axis gizmo at the top right of the viewport, or hold the middle mouse button and drag. |
| Zoom | Scroll, or use a trackpad pinch. |
| Pan | Shift + middle-mouse drag. |
| Select an item | Click the wood, rock, or plant mesh. Fixed tank parts cannot be selected. |
| Move an item | Drag its red or green arrows. The planar handle moves it along both tank-floor axes. |
| Rotate | Fishy sidebar → Rotate 90°. |
| Undo | ⌘Z on this Mac, or Edit → Undo. |
| Front / top view | Fishy sidebar → Front / Top. |
| Check fit | Fishy sidebar → Check Bounds. Run again after editing. |
| Save mesh edits | ⌘S; use Save As for a separate design. |
| Export current placements | Fishy sidebar → Export Scene JSON. |

If the sidebar is hidden, press **N** over the viewport and click its **Fishy** tab. The viewport is a live 3D scene. A final rendered image is a separate output and cannot itself be orbited.

## What works

The 60 × 30 × 36 cm tank contains six editable objects: one wood, two rocks, and three plant groups. Starter objects have vertical movement and X/Y tilt locked. Geometry is intentionally simple.

Bounds checking reports crossed walls using evaluated object bounding boxes. It does not block movement or check object-to-object collisions. No biological rules are implemented. Its report is marked stale after a scene change. Return to Object Mode before checking or exporting after mesh edits.

Scene units are metres with centimetre display. Origin is front-left-bottom; X right, Y back, Z up. Each editable mesh has a stable `tank_id`. The `.blend` is the authoritative file after manual mesh edits. Exported JSON contains transforms, dimensions, and bounds; it does not include mesh topology or an import/reconstruction pipeline.

## Files and reproduction

- `build_scene.py`: builds the procedural starter in a fresh Blender process; refuses to overwrite an existing output.
- `fishy_controls.py`: registers the native Fishy panel and operators.
- `verify_scene.py`: runs focused checks in a separate background process without saving test mutations.
- `fishy-studio.blend`: generated, editable starter scene.
- `Open Fishy.command`: desktop launcher.

Run from this workspace root:

```sh
"$HOME/Applications/Blender.app/Contents/MacOS/Blender" --background --python blender/build_scene.py -- --output /tmp/fishy-new.blend
"$HOME/Applications/Blender.app/Contents/MacOS/Blender" --background blender/fishy-studio.blend --python blender/verify_scene.py
```

Choose a fresh output filename when rebuilding. Rebuilding creates a new fixture; it does not preserve edits from a prior file. To request a still during generation, add `--render /tmp/fishy-preview.png` after the output argument. The optional final-render path was not part of the interactive acceptance test.

## Verification on 13 September 2026

Verified with Blender 5.2.0 LTS on Apple Silicon macOS. Six background checks passed, covering initial IDs/bounds, rotation isolation, moved-object violations and stale reports, non-mutating checks, exact wall contact, and JSON export. Additional review verified base-mesh versus modifier-evaluated export bounds and Edit Mode guards.

Desktop verification confirmed the file opens, the panel draws, dragging the navigation gizmo orbits the scene, dragging the selected wood changes its position, and ⌘Z restores it. Rotating the wood crossed the back wall; Check Bounds named that violation, and Undo restored the original rotation. A subsequent check confirmed all six objects were within tank bounds.

The Astra generation and render–compare–revise milestone now has three successful model runs, including the native-button test. Generated geometry still uses a limited procedural asset library and has not been measured against an actual aquarium. Voice, video ingestion, inspiration retrieval, biological validation, and shopping remain future work.

## Browser render assets

The canonical browser asset pipeline is `build_natural_assets.py` plus
`build_tetra.py`. It exports nine original natural asset variants across eight
unique geometric families, one scan-derived fern, and one animated, skinned
neon tetra to
`site/public/render-assets/models/`:

- `rock-rounded` and `rock-strata` (one original fractured-rock geometry with
  dark-rock and lichen-mineral PBR variants)
- `wood-arch`, `wood-root`, and `wood-stump`
- `plant-broadleaf`, `plant-grass`, `plant-stem`, and `plant-moss`
- `plant-fern` from the adapted Poly Haven Fern 02 clump b source
- `neon-tetra`

This is an **11-asset delivery**: nine original natural exports across eight
unique geometric families, the adapted CC0 fern, and the original tetra. The
native source deliverables are `fishy-fidelity-assets.blend` (the ten natural
exports) and
`fishy-neon-tetra.blend` (tetra geometry, skin, armature, and action). The
current `astra-refinement/scene.json` is a separate 56-object browser study.
The editor accepts up to 64 editable objects; the older browser-to-recipe
bridge intentionally remains capped at 24 approximate procedural envelopes, so
it cannot reproduce that study as a full native recipe.

Astra completed native and browser visual review of this delivery. The renders and source files below document the pipeline; the [quality report](../workstreams/fidelity-reference-20260921/astra-refinement/QUALITY_REPORT.md) records findings and remaining reference differences. Exact parity is not claimed.
The evidence boundary and recorded method are in
[`astra-refinement/METHOD.md`](../workstreams/fidelity-reference-20260921/astra-refinement/METHOD.md).

The eight unique original natural geometric families, their botanical maps,
tetra geometry, tetra skin, and tetra rig are authored in these generators.
Rock and bark PBR inputs are selected Poly Haven CC0 scans. `rock-strata` is a
mineral material variant of the same fractured original geometry as
`rock-rounded`, using the documented `lichen_rock` scan. Asset pages, source
file URLs, hashes, map dimensions, and license are recorded in
[`material-sources/materials-provenance.json`](material-sources/materials-provenance.json);
the active `rock` and `bark` choices are in
[`material-sources/selection.json`](material-sources/selection.json).

`plant-fern` is delivered from the adapted Fern 02 clump b source rather than
the older custom fern. Fern 02 is CC0 work credited by Poly Haven to Rico
Cilliers (modeling) and Rob Tuytel (scanning); its separate model package,
relative texture references, source URLs, hashes, and license are in
[`material-sources/fern_02/provenance.json`](material-sources/fern_02/provenance.json).
`make_procedural_fern()` remains an authoring fallback/reference only and is
not the delivered fern geometry.

Build the natural models first, then the tetra. Both generators export JPEG
textures into the GLBs and save editable Blender source files:

```sh
BLENDER_BIN="${BLENDER_BIN:-/Users/bedelau/Applications/Blender 5.2.2 LTS.app/Contents/MacOS/Blender}"
"$BLENDER_BIN" --background --python blender/build_natural_assets.py
"$BLENDER_BIN" --background --python blender/build_tetra.py
```

`build_natural_assets.py` saves `fishy-fidelity-assets.blend`, which contains
the nine original natural exports (eight unique geometries) and the adapted
Fern 02 delivery family.
`build_tetra.py` saves
`fishy-neon-tetra.blend`, which contains the tetra mesh, skin, armature, and
cyclic action. Rebuilding replaces generated render assets; keep separately
named copies of any manual source-scene edits.

Inspect the delivery GLBs, rather than the authoring geometry, with fixed front
and reverse Cycles views:

```sh
"$BLENDER_BIN" --background --python blender/inspect_natural_assets.py
```

Inspection renders and per-asset inspection `.blend` files are written to
`workstreams/fidelity-reference-20260921/astra-refinement/renders/`. Set
`FISHY_INSPECT_ONLY=rock-rounded,wood-root` to restrict the inspection set.
`build_aquascape_study.py` is a separate study assembler: it imports these GLBs
against an existing study `scene.json` and writes an editable riverbank study.

### Full study reproduction

After generating the natural assets and tetra, refresh the browser-derived
study data, assemble the native study, then check every authored world-space
vertex against the glass envelope:

```sh
node --experimental-strip-types site/scripts/export-fidelity-study.mjs
"$BLENDER_BIN" --background --python blender/build_aquascape_study.py
"$BLENDER_BIN" --background --python blender/verify_study_bounds.py
```

The final command writes `astra-refinement/world-bounds.json` and fails when
any authored vertex crosses glass. It is a geometric containment check, not a
substitute for final visual QA.

### Study contact reproduction

The regenerated riverbank scene uses the Astra-reviewed placements in
[`site/lib/study-plant-contacts.ts`](../site/lib/study-plant-contacts.ts).
`export_contact_surface.py` reduces the delivered `rock-rounded.glb` to the
geometric proxy used for browser cascade contact; it writes
`site/lib/rock-contact-surface.ts` and does not replace the visible GLB.

```sh
"$BLENDER_BIN" --background --python blender/export_contact_surface.py
"$BLENDER_BIN" --background --python blender/seat_study_plants.py
```

`seat_study_plants.py` opens `fishy-riverbank-study.blend`, measures hardscape
surfaces, and writes candidate anchors to
`astra-refinement/plant-contact-anchors.json`. It does not edit
`scene.json` or `study-plant-contacts.ts`; review candidate placements before
accepting any update. These geometric checks support review and do not complete
final visual QA.

`verify_fidelity_assets.py` verifies the current 11 GLBs: it reopens the
current master, checks mesh/UV/normal constraints, and roundtrips tetra's
skinned clip across 65 sampled poses. Run it after rebuilding assets:

```sh
"$BLENDER_BIN" --background --python blender/verify_fidelity_assets.py
```

`build_fidelity_assets.py` and `render_fidelity_contact_sheet.py` belong to the
older procedural export set. They are retained for historical compatibility and
are not the canonical source or inspection workflow for the current render
assets.
