# Camera and room-background follow-up

User request: prevent views underneath the tank and preview an aquarium against a specific room background.

Implemented upper-hemisphere OrbitControls (maximum polar angle 90 degrees) plus a floor guard for both camera and pan target. The guard runs on controls changes and before rendering, so downward panning cannot bypass the orbit limit. Shared viewport behavior covers editor, Gallery creation and Originals. Material-object sample orbit is unaffected.

Tank → Render background offers Dark studio, Light studio and Room photo. A user-selected JPEG/PNG/WebP is decoded locally, bounded to 10 MB and 24 megapixels, and displayed behind the transparent WebGL canvas. Photo zoom, horizontal/vertical crop positioning, reset and remove controls are provided. Existing tank orbit/zoom/pan can compose the tank against the backdrop.

The photo is session-only, excluded from scene Save/export and read_fishy_scene. There is no upload, external image URL fetch, camera calibration, room measurement or automatic lighting match. Existing studio environment lighting remains unchanged; UI explicitly calls this a visual backdrop. Old valid photo is retained on a failed replacement; stale async loads cannot replace newer/removed photos. Blob URLs and decoded bitmaps are disposed.

Verification: 37 selected tests passed, including actual OrbitControls update/damping and below-floor target/camera cases, allowed/disallowed formats, file/dimension bounds and default view state. Existing scene/frontier regression tests passed. TypeScript no-emit and full production build passed. `git diff --check` passed. No browser interaction or visual QA claimed for this follow-up; none was explicitly requested in this turn.

Exact built/pushed source: `813eb3a5eacb066627669d12f5510e4a7571302e`.

Version 9: `appgprj_6aa60f318aec8191903686f10de4e48e~appgver_467fae35c6a48191b8016cb4d06ec2bc`.

Deployment: `appgdep_6aa629cd1cec81918e9748866a0396bb`, terminal `succeeded` at 04:43:07 UTC, no failure. URL: https://fishy-3d-studio.banz-joshua.chatgpt.site

Private access verified before deployment: owner role, custom access, one allowed account user, zero external visitors and no workspace/tenant groups. No sharing changes. User-owned untracked design.ts and tsconfig.tsbuildinfo preserved. No scene storage writes or production-tab reloads.

## Version 10 control styling correction

Production browser QA subsequently found oversized background radio buttons and faint photo slider tracks. The correction reuses the existing `shape-choice` selected-label styling and `scene-slider` styling; no camera, photo, scene, storage, or vendored component logic changed.

The coordinator independently verified the actual localhost UI: compact radios with a clear selected row, visible tracks/thumbs on all three photo sliders, keyboard-operated Photo zoom, fixture load/remove and Dark studio restoration. Saved scene revision 23 remained unchanged; no Save or storage writes. The owner also confirmed a clean local tab exposes the new controls, then closed that temporary tab. The 37 regression tests, TypeScript check, production build and diff whitespace check passed again.

Exact pushed source: `8e1d6bd131927a40a6f90059d26d3ad58dd34fd6`.

Version 10: `appgprj_6aa60f318aec8191903686f10de4e48e~appgver_23c0b04af2808191b39ca6ceacc08209`.

Archive: `/tmp/fishy-room-controls.OESBxf/site.tar.gz`, SHA-256 `00e260482425191229649edaf7e24ba21ba0e5a3e9c6595ad342bb549c9f742c`.

Deployment: `appgdep_6aa62bec50e0819182c30a644c5db165`, terminal `succeeded` at 04:52:11 UTC, no failure. URL: https://fishy-3d-studio.banz-joshua.chatgpt.site. Private audience reverified unchanged before publication.
