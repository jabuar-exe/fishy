# Fishy parallel production pass

User request: parallel workstreams, production readiness, and a unified Figma-like workspace that accommodates the project's features.

## Ownership

The existing task **Build Fishy with Terra and Astra** owns and integrates `site/`, its private deployment and browser handoff. Other agents produce isolated design assets, registries, audits and tests in this directory. No competing Site initialization or overlapping checkout edits.

| Workstream | Output | Acceptance |
| --- | --- | --- |
| Workspace design | `workspace-design/` specification, tokens and wireframe | Dominant canvas; layers/assets/inspiration; contextual properties/conversation; accessible responsive controls. |
| Catalog and gallery | `catalog-integration/` registry and workflow | All 20 source entries represented honestly; supported mesh families explicit; source references searchable and retained with a design. |
| Security and state | `release-security/` audit and reproductions | Safe saved-state parsing, revisions, protection, recovery and source URLs; no silent loss of drafts or prior saves. |
| Verification | `release-verification/` test candidates and acceptance matrix | Important failure paths and user interactions tested, beyond compilation. |
| Frontier workflows | `frontier-workflows/` evidence request, held-out score, protected edit | Each workflow has a fixture test and one recorded live run with its artifact; held-out photos never enter a prompt. |
| Integration and rendering | Existing Site-owning task | Preserve working scene APIs, direct editing, dimensions, history, save/reload and final Blender showcases while applying the design. |

## Current release scope

The release target is a usable aquarium design editor with sourced reference/catalog browsing and original Blender showcases. Device-local saved projects must be clearly described as device-local. GPT-Live, Astra and image-generation model services have not been configured with the user's planned API access; unavailable connections must be explicit and cannot produce fake successful actions.

Full cloud project persistence, authenticated model jobs, payments/commerce, ecological simulation and metric photo reconstruction are not established by this editor release. A production claim must name its actual scope and evidence.

## Critical acceptance loop

Open the workspace → choose an object → move/rotate/resize it → undo/redo → change tank width/depth/height → preserve protected objects → add/apply a sourced material → save while a field has focus → reload → find and save a reference → orbit all three imported showcases. Include corrupt/missing data and loading failures, keyboard interaction, reduced motion and narrow layouts. Preserve the user's existing stored designs during testing.

The final report must identify which checks actually ran, which blockers were fixed, and any remaining limitations. Successful compilation alone is insufficient evidence of the user workflow.

## Integrated review — 2026-09-13

All four parallel workstreams delivered their bounded outputs and the Site owner integrated the workspace. Root independently reviewed the revised local application at 1280 × 720: the canvas remains dominant, selecting a layer opens the corresponding properties, catalog Apply actions require a compatible selection, inspiration search filters 615 records to the three Tropica studies, unavailable model connections are explicit, and the original Blender aquarium responds to cursor orbiting. The inspected browser console contained no errors.

The implementation owner reports browser verification of object movement and undo, independent depth changes, protected resize rejection, source material Add/Apply, focused brief and numeric-field save/reload, all three original GLBs, photo attach/remove, and the 390 × 844 modal sheet with Escape/focus restoration and no horizontal document overflow. These are attributed owner checks; they are not all independent root reruns.

The security workstream independently executed 11 boundary reproductions successfully and found no unresolved blocker within the device-local editor scope. See `release-security/AUDIT.md`. The integrated suite passed 19/19, TypeScript passed, and the production build passed. The Site owner published commit `3f0ac38948e4bf238151666f538230531f101285`; root independently confirmed the new private deployment's complete editor canvas and shell, clean default scene, and empty error console at `https://fishy-3d-studio.banz-joshua.chatgpt.site/`.

The final dependency audit then found that a production-declared-only audit was insufficient: React server decoding code was bundled from a development-declared dependency. The owner applied the compatible React/DOM/RSC 19.2.8 security patch in commit `cecc72c07232d947ddbbddb93833273e515179c6`; all 19 tests, TypeScript and the production build passed again. Image-size was traced to local build-time metadata extraction, absent from the emitted server. Final private deployment `appgdep_6aa61b9adfa88191bbec174cf50f9d40` succeeded. Root reloaded the published URL, independently verified the rendered editor and layer/property/gizmo selection, and observed no browser console errors. The owner also checked Editor → Originals → Editor and the hero GLB after this final publication. This does not label all development tooling hardened. See `release-verification/DEPENDENCIES.md`, `site/tests/DEPENDENCY_REACHABILITY.md` and `site/tests/RELEASE_CHECKS.md` for details.

Remaining product boundaries: catalog meshes are generic procedural proxies; originals are view-only compositions in the web workspace; inspiration photographs remain at their attributed sources; photos are session-only; saved scenes/history are browser-local. Hosted model services, cloud persistence and ecological/water simulation are outside this release's readiness verdict.
