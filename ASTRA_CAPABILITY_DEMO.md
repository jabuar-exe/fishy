# Fishy: Astra reconstruction capability demo

Reconstruction subplan, 13 September 2026. The current hackathon direction is [THREE_TRACK_DEMO.md](THREE_TRACK_DEMO.md), following the user's choice of Visual Understanding, GPT-Live-1, and GPT-Image-2.5. This document preserves the Astra reconstruction experiment and supersedes FIVE_HOUR_BUILD_BRIEF.md for that workstream; its earlier exclusion of voice and image proposals no longer applies to the combined submission.

The execution surface is **Blender's desktop viewport**, as requested. [FIRST_105_MINUTES.md](FIRST_105_MINUTES.md) replaces the earlier browser plan. The native editor supports cursor orbit, dragging, Undo, rotation, explicit bounds checks, and JSON export. Astra has now generated a 12-object scene from a local photo and an 18-object revision after receiving its renders. See `blender/ASTRA_RUN_RESULTS.md` for evidence and limits; reconstruction accuracy remains unmeasured.

## Objective

**Can Astra build an editable spatial representation of a real aquarium from photos, improve it by inspecting its own renders, and support an unexpected spatial edit?**

Reconstruction is the central technical experiment. The five-hour limit should narrow the scene and surrounding features while preserving that experiment. A manually positioned aquarium planner would demonstrate a different capability.

## What Astra must do

1. Receive several photos of one sparse, mostly static aquarium and measured tank dimensions.
2. Author an editable scene program: object identity, geometry parameters, scale, position and orientation. Use a compact scene schema with supported primitives and a few normalized assets. Do not provide the target object placements in advance.
3. Inspect rendered views alongside the input photographs, identify discrepancies and revise the program. Budget two revision rounds initially; retain each version.
4. Respond to an unfamiliar spatial instruction by editing the existing scene while preserving unrelated objects and confirmed tank dimensions.

The scene schema is the program that the renderer executes. This gives Astra control over spatial reasoning without requiring it to generate an entire application or arbitrary runtime code per request.

## What the software must do

- Render scene programs in a stable coordinate system with consistent units, object IDs and camera conventions.
- Reject malformed programs and invalid numeric values; preserve the last valid scene.
- Keep original, revised and user-corrected states distinct.
- Show reference photos beside renders and make initial/final reconstruction differences visible.
- Provide explicit tank-boundary checks and native Blender Undo for the live edit. Checks report violations after an edit; they do not prevent native dragging.
- Record elapsed time, calls, available token/cost information and manual interventions. Report unavailable usage data as unavailable.

## Bound the environment

- One rectangular tank with confirmed dimensions.
- A small number of static objects, such as wood and rocks, with only simple plant groups if time allows.
- Approximately three to five views in total; reserve one for evaluation and never feed it into reconstruction or revision calls.
- Simple procedural geometry or a few normalized assets. Their choice and placement must still be inferred by Astra.
- An initial attempt plus two revisions, subject to a declared runtime budget.

If using a controlled capture setup, avoid moving objects between reference measurements and photographs. If independent geometry measurements are unavailable, evaluate visual consistency and state that geometric accuracy remains unmeasured.

## Cut from this submission

- Biology, compatibility verdicts, growth predictions and chemistry simulation.
- Fish counting, exact species identification and moving-subject reconstruction.
- Shopping lists, prices, budgets, retail integrations and checkout.
- Telemetry, hardware actuation, maintenance automation and notifications.
- Gaussian-splatting or photogrammetry integration as an additional reconstruction pipeline.
- Broad catalogs, comprehensive capture onboarding and photorealistic fish animation.
- Robotics, dataset commercialization and ocean-transfer claims as demonstrated results.
- General collision solving, physical insertion paths and autonomous experiment hardware.

## Five-hour implementation sequence

These are planning estimates, not promises. They assume model access and a suitable photo set. The procedural editing foundation exists; no measured Astra reconstruction capability is claimed yet.

| Time | Deliverable | Checkpoint |
| --- | --- | --- |
| 0–60 minutes | Blender starter, cursor controls, stable IDs, boundary feedback and native Undo. | Complete the desktop foundation checks in FIRST_105_MINUTES.md. The fixture remains scaffolding. |
| 60–105 minutes | Astra receives photos and dimensions and authors the first scene recipe; trusted Python builds it in Blender. | A real model-generated recipe creates a new editable `.blend`. Save the baseline and actual model output. |
| 105–160 minutes | Harden the photo-to-scene path and align comparison cameras. | Reproduce the generated scene and document inferred geometry and camera assumptions. |
| 160–215 minutes | Render–compare–revise loop. | Astra receives its renders and revises the scene; both attempts remain inspectable. |
| 215–255 minutes | Independent comparison and one live language edit through the existing executor. | Use withheld evidence and preserve unrelated objects during edits. Report initial/final results even if they worsen. |
| 255–300 minutes | Freeze features, verify and rehearse. | A complete demonstration separates supplied facts, inferred geometry, revisions and any human corrections. |

## Preserve the experiment when time runs short

- If scene generation fails, simplify the schema, reduce object count or use a clearer capture. Do not silently replace it with a hand-built reconstruction.
- If revisions do not improve the result, show the actual comparison. Render execution proves that the program runs; improvement needs separate evidence.
- If model calls are too slow, reduce the number of views or revision rounds. Clearly label a recorded reconstruction if used; keep the edit live where feasible.
- If time is tight, cut interface polish and the live-edit flourish before cutting the reconstruction experiment.
- Human correction remains a useful interaction, but show the pre-correction result when evaluating Astra's reconstruction capability.

## Evaluate what the demonstration actually establishes

Compare the first and final scenes using the same evaluation conditions:

- Held-out-view consistency, identifying camera-alignment limitations.
- Selected object-position or dimension errors against independently measured references, where available.
- Missing or invented objects and manual corrections required.
- Runtime and model cost where measurable.
- Preservation of unrelated objects during the live edit.

A held-out image is an additional test of consistency, not complete geometric ground truth. Image similarity alone cannot establish hidden geometry. A single aquarium is a case study and does not establish general reconstruction reliability or transfer to industrial underwater cameras.

## Demo narrative

“These are the photos and the tank dimensions Astra received. This is its first reconstruction. Here is what it changed after seeing its renders. This is the view we withheld, and these are the errors we can independently check. Now ask it to change the layout.”

Example live edit: “Rotate the wood lengthwise and place it behind the rock. Keep the other objects where they are.”

## Basis

[BenchCAD](https://benchcad.com/) motivates testing executable scene synthesis and iterative rendering. Its industrial-part results do not establish aquarium capability; this prototype investigates that gap.

[Refraction-aware aquarium stereo](https://arxiv.org/html/2603.06421v1) motivates keeping the camera/glass geometry limitation explicit when interpreting results.

The ambition remains photo-derived, editable spatial understanding. The measured result determines how strongly we can claim success.
