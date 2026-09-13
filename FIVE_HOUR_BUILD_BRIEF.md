# Fishy: five-hour hackathon build brief

**Superseded:** This version prioritized a dependable planning product. The clarified objective is to push Astra's reconstruction and spatial reasoning. Use [ASTRA_CAPABILITY_DEMO.md](ASTRA_CAPABILITY_DEMO.md) as the current build scope.

Decision date: 13 September 2026.

This brief translates the TankTwin proposal and judge critique into a bounded prototype. The Fishy workspace had no application code at review time. Time allocations below are planning estimates for one primary builder, not measured implementation times. The original proposal remains the long-term vision.

## The submission

**Turn a photo of your existing aquarium into an approximate editable plan, then change the layout while checking space and additional cost.**

The achievement to demonstrate is a live instruction changing persistent scene state, preserving unrelated objects, and producing a checkable result. Photo interpretation proposes a starting layout; the user confirms dimensions and corrects placement.

## Ranked weakest links and decisions

| Priority | Weak link | Why it threatens five hours | Decision |
| --- | --- | --- | --- |
| 1 | Exact photo-to-3D reconstruction | Refraction, occlusion, unknown scale and irregular objects make fidelity uncertain and runtime unpredictable. | CUT splatting, photogrammetry, custom mesh recovery and render-compare loops. KEEP a single reference photo, confirmed tank dimensions and approximate catalog-object placement. |
| 2 | Unrestricted conversational editing | A full scene rewrite can delete inventory, change scale or silently ignore constraints. | KEEP a small command vocabulary: select, move, rotate, add and remove. Validate a proposed change before committing it; preserve other objects and support one-step undo. |
| 3 | Biological authority from incomplete evidence | A plausible image or deterministic rule cannot establish water chemistry, welfare or future growth. | CUT health scores, growth forecasts, chemistry simulation, species/count claims and general compatibility verdicts from this submission. |
| 4 | 3D without a spatial benefit | A chatbot plus inventory list could provide the same advice. | KEEP one measurable spatial interaction: rotate/reposition hardscape and check boundaries or a user-reserved clear area. Show front and top views. |
| 5 | Catalog and commerce dependencies | Large catalogs, live stock, prices, retailer automation and checkout add unrelated failure points. | CUT external commerce. KEEP approximately six normalized assets and a clearly labeled demo price list. Charge the budget only for additions. |
| 6 | Multiple audiences and speculative extensions | Consumer planning, aquarium monitoring and industrial perception require different proofs. | FOCUS on one aquarist redesigning an existing freshwater tank. Put monitoring, underwater research and robotics on one future-work slide. |

These rankings are engineering and judging judgments based on the prior review, not measured failure probabilities.

## What to build

One screen contains a reference photo, editable tank, short instruction field, and a compact change/cost summary.

1. **Establish the tank.** Enter measured width, depth and height. Use a rectangular tank and a flat substrate. Confirm the tank's front so “behind” remains consistent when the camera rotates.
2. **Propose a layout.** Photo analysis may suggest a few generic wood, rock and plant assets with approximate positions. Show that estimate alongside the photo. Let the user correct object size and placement. Do not infer exact species or hidden inventory.
3. **Make a real edit.** Language selects bounded operations against existing object IDs. Start with move, quarter-turn rotation, add and remove. Keep equivalent buttons available.
4. **Check the proposal.** Check tank boundaries, a user-defined clear region and the additions budget. Hardscape overlap checking is optional after the core works. Checks concern the current approximate layout; their accuracy depends on confirmed dimensions and object envelopes.
5. **Explain the change.** Highlight affected objects, list what moved or was added, and update additional cost. An invalid proposal stays visibly uncommitted. Offer correction or undo.

Use “approximate aquarium plan” in the demo. Reserve claims about a live, predictive twin for later evidence.

## Explicitly outside this build

- Video capture, moving-fish tracking and exact species identification.
- Gaussian splats, photorealistic meshes and open-ended reconstruction refinement.
- Growth animation, algae prediction, water chemistry and health/compatibility guarantees.
- Flow simulation, delivered PAR estimation and fish behavior simulation.
- Telemetry, hardware actuation, maintenance prediction and notifications.
- Research swarms, retailer browsing, checkout and live pricing.
- Industrial datasets, simulator APIs and robotics integrations.
- Accounts, payments, community sharing, multiple tanks and a native mobile app.

## Five-hour execution order

| Time | Deliverable | Evidence required before moving on |
| --- | --- | --- |
| 0–45 minutes | Tank renderer, three normalized assets, dimension inputs, front/top views. | Objects have stable units and can be selected and positioned. Use procedural shapes if imported assets slow progress. |
| 45–105 minutes | Deterministic move/rotate/add/remove, boundary and clear-area checks, additions total, one-step undo. | A valid edit works through buttons. An invalid one is caught. Unrelated objects remain unchanged. |
| 105–155 minutes | Language mapped to the same bounded commands. | Several differently worded requests execute correctly; failed requests preserve state. |
| 155–205 minutes | Single-photo layout proposal and correction. | The proposal uses supported assets and can be corrected quickly. A prepared scene is labeled as prepared. |
| 205–245 minutes | Unify the screen, highlight changes and explain constraints. | A viewer can identify what changed and why a request failed without reading implementation details. |
| 245–300 minutes | Freeze features, verify the complete flow and rehearse. | Successful edit, unexpected edit, invalid request, correction and undo all demonstrated. |

**Stop rules**

- If the deterministic edit/check loop is incomplete at 105 minutes, cut automatic photo interpretation and use guided placement against the reference photo.
- If photo interpretation cannot yield a correctable proposal within its allocated block, ship guided placement and describe it honestly. Keep the reference-photo workflow.
- If live language calls fail, expose the same operations through buttons. Disclose the fallback; never imply an operation ran through AI when it did not.
- After 245 minutes, add no features. Fix demo-breaking issues and rehearse.
- Do not add placement optimization, insertion-path simulation or arbitrary geometry generation to rescue a difficult edit. A clear rejection is an acceptable result.

## The demo

1. Show an aquarium reference and its confirmed dimensions.
2. Propose or manually establish a simple layout; correct one object visibly.
3. Request: “Rotate this wood lengthwise and move it toward the back. Keep the front eight centimeters clear.”
4. Show the changed scene from the top, the reserved area and the resulting boundary check. If the requested arrangement does not fit, show the specific conflict.
5. Add two plants using the small demo catalog. Show the additional cost while existing objects contribute zero new spend.
6. Let a judge request an unexpected move or addition. Demonstrate a budget or boundary violation, then correct or undo it.

The prototype evaluates the proposed final arrangement. It does not prove the object could physically be inserted along a collision-free path or that the layout is biologically suitable.

## Definition of done

- One end-to-end redesign can be completed without developer intervention.
- At least one unfamiliar language request updates actual scene state.
- Unrelated objects and confirmed tank dimensions survive edits.
- Boundary and budget violations are detected consistently.
- Estimated placements can be corrected, and the corrected state is used afterward.
- Prepared assets, estimated geometry and demo prices are represented accurately.

Suggested usability target, to test rather than advertise as achieved: a participant produces a usable approximate plan and completes one checked edit within three minutes.

## Evidence behind the cuts

- [BenchCAD](https://benchcad.com/) supports the promise of programmatic geometry but evaluates industrial parts from controlled views, not aquarium reconstruction.
- [Refraction-aware aquarium stereo](https://arxiv.org/html/2603.06421v1) demonstrates the need for explicit refractive geometry in aquarium measurement.
- [UF/IFAS on ammonia](https://ask.ifas.ufl.edu/publication/FA031) explains why appearance cannot establish water safety.
- [Scape It](https://scape-it.io/en) shows that visual planning and shopping lists already exist; the live spatial-edit workflow needs to earn differentiation.
- [MuS-Polar3D](https://arxiv.org/abs/2512.21513) supplies prior art for controlled underwater benchmarks. This prototype should make a narrow claim about its demonstrated behavior.

No product code has been implemented as part of this scope review.
