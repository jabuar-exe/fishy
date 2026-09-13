# Fishy: deployed picture-and-conversation-to-3D risk review

13 September 2026. This review incorporates the user's decision that the deployed ChatGPT Site itself must be the interactive, mutable 3D editor. It replaces the desktop-companion architecture and restores model-authored geometry as a central technical objective. Scope: source audit and primary-documentation review, not a deployed-site penetration test or a new model benchmark.

## Decision

Proceed with an experimental workflow in which Astra authors new editable geometry from pictures and conversation, inspects renders, asks for useful additional evidence, and revises the model. A browser-native editor is feasible. Accurate automatic reconstruction of arbitrary aquariums from one photograph remains unproven.

OpenAI demonstrates Astra authoring actual editable Blender geometry, inspecting renders, repairing details, and transferring scenes into an interactive application. That supports the mechanism for authored 3D and iteration; it does not establish aquarium reconstruction accuracy. [Astra architectural visualization](https://developers.openai.com/blog/architectural-visualization-with-astra)

Astra accepts image input and supports structured output. In this design, its output describes geometry for a trusted renderer to build. Selected video frames can be supplied as images; a direct native video-to-mesh endpoint is not the documented interface. Official vision guidance cautions about precise spatial localization and incorrect visual interpretations. [Astra model](https://developers.openai.com/api/docs/models/gpt-6-astra), [vision limitations](https://developers.openai.com/api/docs/guides/images-vision#limitations)

## What the deployed site should do

The main screen contains a real 3D canvas, photo evidence, and conversation. Users can immediately orbit, zoom, select, drag, rotate, and undo. Astra changes the same scene through validated operations. Neither cursor interaction nor page rendering depends on the user's Mac or an open Blender process.

Use a browser renderer such as Three.js. Its orbit and object-transform controls provide established interaction building blocks; Fishy still needs selection, history, persistence, and synchronization. Keep the existing metre/Z-up convention or convert it explicitly at the renderer boundary. [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [TransformControls](https://threejs.org/docs/pages/TransformControls.html)

Blender can remain an offline asset authoring, comparison, or export tool. It is no longer the user-facing runtime. If future geometry truly requires Blender execution, that needs a separate hosted job service and an importable output such as GLB, with independent editable objects and scene metadata preserved.

## Verified project findings


The findings on evidence linking, photographic accuracy, manual-edit loss, and prompt-only protection are addressed by the three workflows in [workstreams/frontier-workflows/FRONTIER_WORKFLOWS.md](workstreams/frontier-workflows/FRONTIER_WORKFLOWS.md).
| Priority | Finding | Evidence | Required response |
| --- | --- | --- | --- |
| Critical | No deployable browser editor exists in this checkout. | No web package manifest, JS/TS/HTML source, or GLB export found. Current output is `.blend`. | Implement the Site's browser runtime and API boundary; treat this as migration work. |
| Critical | Current generation depends on local desktop execution. | `blender/generate_scene.py` invokes the signed-in Codex CLI and the local Blender executable. The API adapter has only offline tests. | Replace the deployed path with server-side API calls and browser-compatible geometry. A Cloudflare Worker cannot spawn the existing Blender binary: `node:child_process` is a nonfunctional stub. [Runtime documentation](https://developers.cloudflare.com/workers/runtime-apis/nodejs/#non-functional-stub-modules) |
| High | Manual scene edits are omitted from later AI revisions. | `blender/generate_scene.py:258` reads the prior generated recipe and stored renders, not the current manually edited scene. | Send the current committed scene revision and current visual evidence to every edit request. Existing artifacts remain intact, but new revisions otherwise omit manual changes. |
| High | Export does not round-trip shape edits. | `blender/fishy_controls.py:182` exports transforms and bounds in a separate schema; it omits mesh topology. | Serialize deterministic shape parameters or actual mesh assets. Bounds are insufficient to reconstruct a branch. |
| High | Protecting an object is only a prompt instruction. | `blender/generate_scene.py:103` asks for ID preservation; `scene_recipe.py` accepts full replacements without revision or protected-object invariants. | Use typed patches against a base revision, protected-object checks, atomic application, and undo records. |
| High | Current wood shape is mostly predetermined by the builder. | `blender/build_recipe.py:112` contains a fixed branch-segment template. Astra chooses dimensions, placement, yaw, and seed. | Let Astra author bounded curves, branch connectivity, radii, and rock profiles. Demonstrate actual topology or shape changes, not only scaling a stock asset. |
| High | Real-photo references are not linked to scene IDs. | The schema has no observation IDs, photo regions, camera state, or grounding tests. | Store timestamped visual evidence and candidate object links. Resolve ambiguous descriptions using the current view and additional evidence. |
| High | Current checks do not establish photographic accuracy. | Runtime checks verify that the built geometry matches a valid recipe and stays in the tank. | Independently compare real held-out photographs or measurements with matched renders. Track wrong, missing, and invented geometry separately. |

The earlier successful runs took about 58–78 seconds for full generation/build/render. Those are local historical results, not deployed latency predictions. Existing evidence is retained in `blender/ASTRA_RUN_RESULTS.md`.

## Deployment and product risks to test

These are anticipated risks in the proposed implementation, not observed vulnerabilities in a deployed Fishy site.

| Risk | Failure example | Control and acceptance test |
| --- | --- | --- |
| Missing depth or refractive distortion | A branch behind another is placed in front; tank dimensions are mistaken for proof of object depth. | Ask for another angle, label inferred surfaces, and evaluate against real held-out views. Glass/water refraction is a documented reconstruction complication. [Original refractive reconstruction study](https://pmc.ncbi.nlm.nih.gov/articles/PMC7738342/) |
| Delayed AI results overwrite user actions | User drags a rock while Astra reasons; the old proposal moves it back. | Every committed edit advances a revision. Reject or recompute stale proposals; cancellation marks an operation superseded. Test drag-during-inference and voice correction. |
| Voice interruption does not stop the operation | The agent stops speaking, but a cancelled scene change still arrives. | Implement application cancellation separately from speech interruption. Announce completion only after a confirmed scene commit. [Live delegation](https://developers.openai.com/api/docs/guides/live-delegation) |
| API key exposure or unrestricted spend | A public client bundle contains the project key, or an unauthenticated visitor repeatedly generates images. | Keep keys in hosted server secrets; authenticate session and mutation routes, enforce ownership and per-user request budgets, and inspect client bundles and errors for secrets. |
| Unsafe generated geometry or code | Model output creates huge meshes, references arbitrary remote assets, or executes script. | Accept bounded data, not executable JS/Python/HTML. Enforce finite values, valid indices, graph/vertex limits, known material and asset references, and upload size/type limits. |
| Cross-user data exposure | Someone requests another user's photo or scene ID. | Authorize every scene, operation, and asset fetch server-side. Store scene metadata separately from private image bytes; test another user's IDs. |
| Camera/audio privacy and access failures | Capture runs unexpectedly or fails inside an embedded page. | User-controlled capture with visible state; stop media tracks when disabled. Verify HTTPS, browser permissions, direct deployed origin, and any embedding restrictions on the actual host. Do not promise camera access before that test. |
| Expensive or sluggish interaction | Every orbit frame or spoken fragment triggers a full model request. | Keep direct manipulation local. Send selected fresh observations on meaningful changes, limit concurrent inference, and retain a usable scene while jobs run. Measure model work and UI rendering separately. |
| Browser rendering limits | Dense foliage and glass effects exhaust mobile GPU memory or make objects hard to select. | Bound geometry, dispose replaced GPU resources, use instancing where appropriate, and test the actual demo device. Add richer optics only after interaction is stable. |
| Image concept diverges from the mesh | GPT-Image invents details that the geometry system never implements. | Label generated concepts, convert selected differences into explicit shape edits, and display the actual mesh render beside the proposal. Generated views are not independent reconstruction evidence. |

## How the user's Live integration fits

The user will supply GPT-Live API integration/access. The application still needs a trusted session endpoint, visual backend, scene operation executor, persistence, and failure handling. One project key may have access to multiple models; verify access for GPT-Live, Astra, and the chosen GPT-Image model rather than assuming that Live access proves all three.

The official browser Live flow exchanges an SDP offer through an application server using a project API key. Keep the key and session configuration on the trusted server; use HTTPS and microphone permission. Do not paste a long-lived API key into browser JavaScript or browser storage. [Live WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live)

Live handles audio/text. The backend receives photographs or selected camera frames and returns visual findings and verified operation results to the conversation. Use frame timestamps and scene versions, so the agent does not discuss a screenshot as if it were the current scene. [Live visual context](https://developers.openai.com/api/docs/guides/live-delegation#add-images-and-visual-context)

Sites can host interactive web apps. The local Sites guidance provides a Worker backend with D1 for structured state and R2 for files. The specific Fishy production configuration, model access, media permissions, connection duration, and SDK compatibility still need an actual hosted test. A Node.js sample is not proof that every dependency runs unchanged in Workers. [Sites overview](https://learn.chatgpt.com/docs/sites)

## Scene contract

One canonical scene record contains scene ID, owner, revision, units, coordinate convention, tank dimensions and their source, object IDs, deterministic geometry descriptions, transforms, protected-object state, evidence references, and a design-intent block (composition scheme, focal object, sightline, open-foreground target, mood, maintenance tier, story) per [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md). The trusted server reviews every committed revision against those principles and stores the findings with the revision.

An observation records its image asset, capture time, source type, optional known camera state, and scene revision for rendered observations. Unknown camera parameters remain unknown until estimated or provided.

An edit proposal references its base revision and observations, identifies target objects or ambiguity, and supplies typed shape/transform operations. The server validates ownership, complexity, tank bounds, protected objects, and revision before committing. Store the prior state or inverse operation for undo. Manual manipulation uses the same commit path, with immediate local preview while dragging.

Geometry should allow meaningful new forms: bounded tube/curve networks for wood and bounded profiles or meshes for rocks. The trusted builder converts them into browser meshes. Astra must be able to change branch count, connections, curvature, and shape, not only placement. The prior general geometry plan therefore returns as a core workstream, implemented for the browser first.

## The frontier experiment

“Astra reconstructs an unfamiliar aquarium through pictures and conversation, asks for the view that resolves its uncertainty, and produces new geometry that the user can inspect and edit on the deployed site.”

1. Begin with an unfamiliar sparse tank, a real front image, and measured tank dimensions if available. Preserve the current assumed-size case as a labeled fixture.
2. Astra authors the initial wood and rock shapes without being supplied their target placements or topology. Display the native meshes and uncertainty.
3. Astra identifies an unresolved feature and asks for another angle. The user supplies a real oblique photo or camera snapshot.
4. Astra revises the actual geometry and renders it again. Freeze the builder during the comparison.
5. Reveal an independent held-out view and report silhouette/keypoint disagreement with documented camera-alignment limits. Have someone other than Astra judge correspondence.
6. Give an unprepared shape edit, such as “make that branch fork earlier,” then a correction and undo. Verify protected geometry is unchanged and the latest state survives reload.

Adaptive capture is a proposed research feature, not an established capability result. To test its value, compare a fixed extra view with the requested view on the same task, while keeping the reconstruction process otherwise constant.

## Delivery gates

1. Browser editor: works on the deployed origin with the development Mac and Blender closed; orbit, select, drag, undo, save, reload.
2. Astra geometry: a fresh photo produces new shape parameters and editable meshes, followed by one render-based revision with recorded raw outputs.
3. Shared state: manual edits survive later AI edits; stale and cancelled operations cannot commit; protected objects remain unchanged.
4. Multimodal integration: Live conversation routes images to Astra and reports applied results; GPT-Image proposals have a visible implemented counterpart.
5. Evidence: report latency, failures, manual interventions, wrong target selections, and held-out comparison. Keep inferred hidden geometry and assumed dimensions explicit.

The previous five-hour estimates assumed the desktop editor remained the product surface. They are no longer reliable for this renderer/backend migration plus new model integrations. Timebox the first browser deployment and one photo-to-shape run before expanding the demo. No new Site, deployment, or model generation was created during this risk review.
