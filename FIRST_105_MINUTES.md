# Fishy: first 105 minutes in Blender

Updated 13 September 2026 following the decision to use Blender's desktop viewport. This replaces the earlier browser editor plan. See `blender/README.md` for the working starter and controls.

## What this block should prove

The foundation is an editable aquarium in Blender: orbit with the cursor, move individual objects, rotate, check tank boundaries, and undo. That is an interaction proof of concept.

The stronger target is to bring one actual Astra scene generation into this block. That requires model access and suitable reference photos with tank dimensions. A procedural starter alone does not prove photo reconstruction, biological reasoning, or Astra's spatial capability.

## Current implementation

- Blender 5.2.0 LTS is installed locally.
- `blender/fishy-studio.blend` contains a 60 × 30 × 36 cm aquarium with one wood object, two rocks, and three plant groups.
- Native cursor orbit, object dragging, and Undo work in the desktop viewport.
- The Fishy sidebar provides front/top views, quarter-turn rotation, explicit boundary checks, and scene JSON export.
- Six automated Blender checks cover geometry bounds, stable IDs, rotation isolation, stale validation state, and export. Desktop checks cover cursor orbit, dragging, rotation, boundary feedback, and Undo.
- Astra generation is connected: a real photo produced a 12-object scene, followed by an 18-object revision after Astra received its renders. See `blender/ASTRA_RUN_RESULTS.md`. Reconstruction accuracy remains unmeasured.

## Revised 105-minute target

These are planning estimates, not measured completion times. Installation and model access can affect them.

| Time | Work | Pass condition |
| --- | --- | --- |
| 0–15 min | Confirm Blender, scene coordinates, one tank size, and photo/model availability. | A local `.blend` opens; input facts and missing inputs are explicit. |
| 15–40 min | Create sparse procedural scene and native move controls. | Cursor orbit, item dragging, and native Undo work. |
| 40–60 min | Add rotation, bounds feedback, view presets, and stable scene export. | A crossed wall is named; Undo restores the object; unrelated items stay unchanged. |
| 60–85 min | Connect one Astra call to a small validated scene recipe and Blender builder. | Save actual model output and render an editable `.blend` derived from it. |
| 85–105 min | Compare the initial output with references, verify one manual edit, and rehearse. | Clearly distinguish supplied dimensions, inferred placements, and human corrections. |

The editing foundation, first Astra generation, and one render–compare–revise pass now work. The next useful experiment is richer model-authored geometry evaluated against measured, multi-view input.

## Contract and editing behavior

Blender coordinates are **metres**, with the UI displaying centimetres. The tank origin is front-left-bottom: **X right, Y toward the back, Z up**. This supersedes the old browser plan's coordinate convention.

Editable mesh objects carry unique `tank_id` values and a `fishy_kind`. Native movement is along the substrate plane; vertical translation and X/Y tilt are locked on starter objects. The `.blend` file preserves meshes and manual edits. JSON export records current transforms and bounds, but does not serialize mesh topology or recreate a whole scene on its own.

Boundary validation is an explicit check after editing. It reports which tank wall an object's evaluated world bounding box crosses. It does not prevent dragging, clamp positions, or roll back edits. Use native Undo to reverse a change. A check becomes stale when the checked scene changes. This follows the native Blender workflow and replaces the earlier browser plan's automatic edit rejection.

## Next implementation: Astra to Blender

1. Select one sparse aquarium with measured dimensions and several consistent photographs. Reserve one view for later evaluation.
2. Define a generation recipe that contains supported asset IDs or primitive parameters, stable object IDs, metre-based transforms, and camera assumptions. Keep this separate from the richer export snapshot.
3. Have Astra generate that recipe from photos and the brief. Validate schema, finite numbers, dimensions, and IDs before building anything.
4. Use trusted local Python to build the recipe into a **new** `.blend`. Do not execute arbitrary model-written Python or overwrite a user's edited file.
5. Save input, raw model response, validated recipe, `.blend`, and renders under one run ID. Label failures and human interventions.
6. Add render–compare–revise only after one actual generated scene opens and remains editable.

## Acceptance and cutoffs

- The same object is editable from front, top, and orbit views.
- Moving or rotating one object preserves other objects.
- Exact wall contact passes; crossing a wall is reported.
- Native Undo reverses move and rotation even after a boundary check.
- Export reflects current edited transforms and the metre/Z-up convention.
- A hand-built fixture is always labeled procedural.
- If Astra access or inputs are unavailable, deliver the editor foundation and state that reconstruction remains unproven. Do not replace a failed generation with a manual reconstruction and call it AI output.
- Cut water polish, detailed assets, voice, inspiration search, biology, and commerce before cutting the actual Astra experiment.
