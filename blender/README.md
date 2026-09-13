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
