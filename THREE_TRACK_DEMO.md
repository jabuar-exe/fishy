# Fishy: one aquarium, three multimodal tracks

Updated 13 September 2026 for the user's selected tracks: Best example of Visual Understanding, Best use of GPT-Live-1, and Best use of GPT-Image-2.5. This is the current hackathon direction. The event's full rules, eligible model variants, and judging rubric still need verification against the event page; the track names and entry allowance come from the user's excerpt.

**Latest user direction:** the deployed ChatGPT Site must itself contain the interactive 3D editor, and picture-plus-conversation must drive newly authored geometry. [WEB_FRONTIER_RISK_REVIEW.md](WEB_FRONTIER_RISK_REVIEW.md) is the current architecture, risk register, and acceptance plan. It supersedes the desktop-companion implementation and the geometry deferral recorded below. The three selected tracks remain unchanged; the remainder of this document preserves the earlier demo outline for reference.

## Product promise

Show Fishy your aquarium, talk through a redesign, compare visual possibilities, and make the chosen changes in an editable 3D tank.

The memorable interaction is: “Make this corner lush, keep my wood arch, and leave the foreground open.” Fishy clarifies the target, shows two proposals, builds the selected change, and responds correctly when the user says, “Actually, leave that rock where it was.”

## What each component does

| Component | Documented capability | Proposed Fishy responsibility |
| --- | --- | --- |
| GPT-Live-1 (`gpt-live-1`) | Full-duplex audio/text conversation, with reasoning and tools delegated to a backend. | Hear the user, ask useful clarifications, handle interruptions, and explain verified application outcomes. |
| GPT-6 Astra (`gpt-6-astra`) | Image input, reasoning, function calling, and structured output. | Interpret photos and current renders, associate visible objects with scene IDs, infer scene recipes, and propose bounded edits. |
| GPT-Image-2.5 Sunburst (`gpt-image-2.5-sunburst`) | Generate and edit images from text and image inputs; positioned for editing precision. | Produce two constrained design proposals from the current tank render, a selected-region mask, and the user's brief. |
| Blender | Existing native editable geometry and rendering in this prototype. | Store the actual geometry, show cursor orbit and object edits, execute validated changes, and render the implemented result. |

Sources: [GPT-Live](https://developers.openai.com/api/docs/models/gpt-live-1), [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra), [Sunburst](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst).

GPT-Live's frontend does not accept aquarium images directly. Route photos, screenshots, or selected camera frames to a vision-capable backend and return its findings to the conversation. Continuous capture, selecting useful frames, timestamps, and stale-frame handling are application responsibilities. The proposed Fishy experience can feel visually aware through that integration. [Live visual context and delegation](https://developers.openai.com/api/docs/guides/live-delegation#add-images-and-visual-context)

Image outputs remain design proposals. They do not supply native Blender meshes or independently measured aquarium geometry. Masking guides an edit but does not guarantee exact preservation; compare protected objects before accepting a proposal. Sunburst is the proposed choice for this use; Flare is an alternative if measured latency requires it and the event permits it. [Image generation guide](https://developers.openai.com/api/docs/guides/image-generation), [Image prompting guide](https://developers.openai.com/api/docs/guides/image-prompting)

## One shared loop

1. Capture a real aquarium photo and obtain dimensions. For the existing demo, clearly retain the user's approved assumption of 60 × 30 × 36 cm. The current source image is only 280 × 210 pixels.
2. Astra produces or loads the editable scene and identifies relevant objects. Show the source photo beside the scene. Surface uncertain interpretation instead of inventing hidden detail.
3. GPT-Live gathers the user's intent. The backend receives the current scene revision, selected object, camera/view context, and relevant photo or render along with the spoken request.
4. Render the current scene and selected-region mask. Ask GPT-Image-2.5 for two visibly different changes within the same narrow brief. Preserve the wood, rocks, tank outline, and camera viewpoint as explicit goals. Keep proposals inside the geometry vocabulary the prototype can implement.
5. The user selects a proposal by voice or click. Astra interprets the selected visual difference and returns a validated scene patch. This conversion is a feature we must build and evaluate; it is not automatic output from the image model.
6. Apply the patch to Blender, render the actual result, and report the applied changes. Keep the generated concept and implemented render separately labeled.
7. Accept an unfamiliar spatial edit and a correction. Highlight the target, preserve protected objects, and make undo restore the prior state.

The product has three distinct visual outputs: the real reference, the editable 3D model, and the generated concept. Display them together so judges can inspect their relationship. Generated alternative views must never be used as independent reconstruction evidence.

## Smallest useful architecture

Keep the Blender desktop viewport. Add a small localhost companion page for microphone/speaker audio, photo capture or upload, the conversation, and proposal thumbnails. The page is a companion to Blender, not a replacement editor.

Use Live WebRTC and a trusted local backend. Project API credentials stay server-side. Client delegation is a candidate because Fishy needs to combine visual inputs, the existing Astra runner, image generation, and validated scene operations. Verify access and the current API contract before implementation; existing Codex authentication does not establish Live or Image API access. [Live WebRTC quickstart](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live)

Define a small application bridge: read scene state; capture a render; highlight an object; preview a patch; apply a patch; undo the last application edit. Execute Blender work on its supported main-thread path. Store operation IDs and the scene revision a proposal was based on. Reject or recompute an outdated proposal after a manual drag or another accepted change.

Speech interruption alone does not cancel backend work. “Actually, keep that rock” must supersede the pending application operation, and a late result must not overwrite the correction. Speak “done” only after Blender confirms the change. This is part of the product's behavior and must be tested. [Live prompting and interruptions](https://developers.openai.com/api/docs/guides/live-prompting)

## Track-specific proof


The Visual Understanding proof is specified as three recorded workflows in [workstreams/frontier-workflows/FRONTIER_WORKFLOWS.md](workstreams/frontier-workflows/FRONTIER_WORKFLOWS.md): Astra requests a specific extra photo and uses it, a held-out view scores each revision, and a human edit to the driftwood survives the next revision. These three moments are required in the demo.
| Track | Show the judges | Weakness to prevent |
| --- | --- | --- |
| Visual Understanding | Resolve an unprepared reference such as “the smaller rock in front of the arch,” highlight it, then change the correct object while preserving the arch. If no selection is supplied, state how photo/view evidence resolves the reference. | Relying entirely on click-provided object IDs or a memorized layout and claiming visual reasoning. |
| GPT-Live-1 | Natural dialogue during backend work, one useful clarification, a spoken correction that changes the pending action, and spoken undo tied to the actual scene. | Voice narration that has no effect on the application, or a substitute voice model presented as GPT-Live. |
| GPT-Image-2.5 | Two constrained image edits of the current aquarium, a real user choice, and an implemented 3D revision reflecting that choice. | A beauty image unrelated to what exists in the editable tank. |

These are recommended evidence standards, not the event's verified judging rubric.

## Three-minute demonstration

| Time | Beat |
| --- | --- |
| 0:00–0:25 | Show reference and Blender scene, identify visible landmarks, and label assumed dimensions. |
| 0:25–0:55 | “Make the back-left corner lush, keep the arch, leave the foreground open.” Live clarifies one consequential ambiguity. |
| 0:55–1:25 | Show two generated proposals and choose one aloud. |
| 1:25–2:10 | Apply the proposal as a scene patch, show the actual render, and orbit the geometry. |
| 2:10–2:40 | Let a judge choose an unexpected edit; then correct the target or undo it by voice. |
| 2:40–3:00 | Drag an object manually, show that the assistant reads the updated state, and explain the current fidelity limit. |

These are presentation targets, not measured model latency. Complex image requests can take up to two minutes, so measure early. If using pre-generated proposals, label them transparently and keep the selection-to-scene edit live. Partial-image streaming is optional: the current guide demonstrates it while model cards label streaming unsupported, so establish actual behavior in an access check before relying on it. [Image generation guide](https://developers.openai.com/api/docs/guides/image-generation)

## Build priorities

The previous general branch-graph and rock-silhouette expansion becomes a follow-on task. Keep at most one focused wood-shape improvement if the existing approximation distracts from the demo. The immediate priority is the coherent voice → visual proposal → editable change → correction loop.

If a five-hour implementation window still applies, use this estimate from the working prototype:

| Window | Deliverable |
| --- | --- |
| 0–20 min | Verify eligible model IDs and account access; settle the scene patch and revision contract. |
| 20–110 min | Parallel work: Live companion and delegation; image proposal workflow; Blender command bridge and visual grounding. |
| 110–180 min | Integrate proposal selection, validated application, correction handling, and undo. |
| 180–235 min | Test unprepared references, preservation of objects, outdated operations, and image-to-scene correspondence. Fix the largest visible mismatch. |
| 235–300 min | Freeze, rehearse, capture evidence, and verify the presentation on the actual machine. |

Use four bounded workstreams with clear ownership, not 50 active agents by default. Respect the effective runtime cap and the user's requested maximum delegation depth of three. The user-selected 50-thread ceiling is capacity, not a project staffing target.

Defer the full IAPLC archive, checkout, retailer integrations, species identification, biological simulation, plant-growth forecasting, and underwater robotics claims. ElevenLabs is unnecessary for the core voice path of this entry because GPT-Live itself must provide the demonstrated conversation.

## Existing evidence and acceptance boundary

The current prototype already demonstrates photo-to-recipe generation, Blender rendering, render–compare–revise, and native cursor editing. Three Astra runs completed and their saved scenes passed geometry checks. See `blender/ASTRA_RUN_RESULTS.md`.

GPT-Live and GPT-Image-2.5 are researched and planned here; neither was called or integrated during this planning pass. Model access, end-to-end latency, visual reference resolution, concept-to-mesh correspondence, and spoken correction are still to be demonstrated. Preserve the existing source photos, run artifacts, and user edits while implementing.
