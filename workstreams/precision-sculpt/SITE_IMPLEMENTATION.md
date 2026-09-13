# Site implementation — direct shape, duplicate, reference views

Implementation and isolated browser acceptance complete; publication evidence follows below.

## Persisted geometry

- Scene v5 / `fishy-browser-3`, saved separately under `fishy.studio.scene.v5`.
- Original v4 saved bytes remain untouched. Supported scenes, history and human journal migrate in memory. Journal IDs follow the scene ID validator, including valid legacy IDs with spaces.
- Optional sculpt records specify evaluator version 1, immutable `fishy-object-v11` base generator, kind/form basis, fixed original bounds and sparse sorted nonzero nodes from a 9×9×9 control grid. The original base builder is isolated in `lib/object-base-v11.ts`.
- Bounded finite offsets, unique indices, supported versions, nondegenerate bounds and matching form are validated. 729 nodes/object, 8,192 nodes/scene. Empty sculpt metadata normalizes away.
- Deformation starts from the original mesh on every rebuild. Child vertices move into object-local space, receive the trilinear field, then move back before object rotation/position/nonuniform stretch/size. Normals, boxes and spheres recompute. Shared factory feeds editor, bounds, duplicates and exports.
- This is broad soft-shape deformation, not fine voxel remeshing. Minimum brush radius is derived conservatively from deformed control-cell spacing in world metres and shown to the user. Radius cannot misleadingly advertise tiny ineffective brushes. Strength uses world millimetres per stamp; inverse affine conversion preserves magnitude under nonuniform stretch.

## Transactions

- Focused object dialog uses real raycast surface hits, Pull, Push, Smooth and a separate Orbit mode. Radius preview and actual W×D×H are displayed.
- Strokes edit a draft. Pointer cancellation/lost capture restores the stroke-start draft; normal pointerup finalizes local stroke history. Local Undo can undo or cancel an active stroke. Cancel/escape closes without a canonical commit.
- Apply checks the same base revision and exact deformed bounds, rejects outside-tank geometry without fitting/moving the object, auto-protects the human edit and records one scene Undo entry. Base-form replacement requires an explicit sculpt reset.
- Modal tools block global Save/Undo shortcuts and register pending shaping state. Existing proposal/draft guards remain in force.
- Duplicate deep-copies shape data to a new UUID, preserves size/material and original bytes, searches bounded non-overlapping positions, and commits once. No space or 32-object limit is an atomic error; no silent shrink.

## Storage

- Serialized save envelope is bounded to 1.5 MB UTF-8, allowing room for UTF-16 accounting and the retained recovery save. Old persisted journal/history is trimmed with explicit status; current scene and in-memory history are preserved. Browser quota failures still leave the prior save and dirty state intact.
- Size accounting is linear in retained records; an initial repeated-serialization approach was replaced after the worst-case diagnostic took 9.4 seconds. The revised test takes roughly 140–170 ms.
- Accepted non-blocking limitation: an older tab can update the v4 save after another tab has migrated it in memory. The first v5 save checks the v5 destination, not the migration-source bytes, and may therefore save the earlier snapshot. The v4 bytes remain untouched and recoverable; close old-version tabs before migrating. A migration-source comparison is deferred follow-up work.

## Reference packet

- Separate renderer uses the editor's shared aquarium scene factory, materials and studio lighting. One frozen scene revision, static water, no selection helpers, no room/reference photos.
- Five 2048×1536 PNGs: front/left/right/top orthographic at identical metres per pixel, plus perspective overview. Thin side views intentionally retain more empty space rather than silently changing scale.
- One downloadable ZIP contains images, HTML contact sheet, full scene data, dimensions/source assumptions, exact camera matrices and SHA-256 identities for scene, cameras and images.
- Scene JSON is a data record, not a promise of a currently provided general re-import UI. These are renders, not photographs, certified measurements or photorealistic reconstructions.

## Verification so far

- 37 existing regression tests passed.
- 12 new tests passed: actual wood/rock/plant vertex replay after JSON serialization; rotated/nonuniform world strength; effective minimum brush coverage; schema guards; sculpt protection/hostile proposal; duplicate independence/no-fit; v4 migration/history/journal IDs; bounded storage; extreme-dimension camera fit; ZIP/CRC structure; identical orthographic scale; and sculpt Undo/Redo snapshot preservation.
- TypeScript no-emit and whitespace checks passed.
- Actual UI checking found and fixed a portal-mount canvas lifecycle bug. It also exposed a pre-existing mutable-ref closure bug in Undo/Redo: deferred history callbacks captured the new state rather than the outgoing one. `stepHistory` now captures and returns snapshots synchronously; the actual UI recheck passed.
- Actual sculpt Apply advanced one revision, persisted 176 nodes, protected only the edited object and left its position and all five other objects unchanged. Duplication and one-step Undo were observed. UI acceptance ran in the root-owned isolated `127.0.0.1:5176` origin, separate from existing localhost and production saves.

## Final acceptance — 2026-09-13

- Final combined regression run: all 49 tests passed, followed by successful TypeScript no-emit and whitespace checks. Production build passed on the unchanged source candidate; existing large-chunk warning remains.
- Root-owned isolated browser QA passed real sculpt Apply, exact Undo/Redo, duplicate independence, Save/reload, persisted history traversal, wood Pull/Smooth/Orbit and plant Pull. Cancel preserved the entire canonical scene; Cmd-S in the modal did not save an underlying draft.
- Mobile 390×844 shows Apply/Cancel; 390×360 scrolling reaches both. No browser warnings or errors were observed.
- Downloaded `fishy-revision-6-five-views.zip` independently verified: eight flat entries, all CRCs valid, five 2048×1536 PNGs, exact image/scene/camera SHA-256 identities, four orthographic views at 0.00034125 metres/pixel, and no clipping in any view. Packet scene preserved the source and independently edited copy plus five other objects.
- Release verdict: ship with the documented cross-version tab limitation and broad-soft-sculpt precision limits. No remaining blocking acceptance finding.

## Publication

- Existing owner-private Site reused; audience unchanged. Native deployment succeeded at 2026-09-13 05:31:30 UTC.
- URL: https://fishy-3d-studio.banz-joshua.chatgpt.site
- Source: `abd8ff7ec64fe2106947c3933c0f0c01f2cce131`.
- Saved version 12: `appgprj_6aa60f318aec8191903686f10de4e48e~appgver_c313e311292c81919698e8c2c02fe60e`.
- Deployment: `appgdep_6aa63524bcc48191bc5253ddc4e56121`.
- Archive SHA-256: `5573887ad956a71e5d7c2acbbc321ba60fcb1a2c21c914b486c2c1975164f78a` (75 files).
- Prior live v11 remains a rollback candidate; original v4 browser saves are retained. Isolated QA dev server stopped cleanly after acceptance. User-owned untracked files were not committed.
- Root owns the final read-only production smoke and delivery record.

## Display-only follow-up

- Production v12 smoke passed actual shaping, Cancel without scene changes, all five export previews and download link, with no browser warnings or errors. It identified floating-point display noise in the export dimensions (`56.00000000000001 cm`).
- Dialog and HTML contact sheet now share a display-only formatter with at most two fractional centimetre digits and no unnecessary trailing zeroes. Scene data, numeric manifest dimensions, camera values and identity calculations are unchanged.
- Added regression checks for the exact `90 × 100 × 56 cm` label, fractional values and byte-identical formatter inputs. All 50 tests, TypeScript, diff checks and fresh production build passed.
- Same owner-private Site deployment succeeded at 2026-09-13 05:35:45 UTC; URL unchanged.
- Source: `d608e0fd8d09d8d66fb79566e5507f419eb8e84f`; saved version 13: `appgprj_6aa60f318aec8191903686f10de4e48e~appgver_31eadf8270188191ace8422f85273b64`; deployment: `appgdep_6aa63621f11c8191a29b2c1955acbc2e`.
- Archive SHA-256: `cec123bfec047139b42df609839a784bea574f9cf56105748d61195253bd89fa` (75 files).
- Final v13 production acceptance passed: live label and downloaded HTML both read `90 × 100 × 56 cm`; all five views rendered and downloaded PNGs passed dimensions, CRC and image/scene hash checks. Numeric manifest height retained `56.00000000000001`, confirming full precision was not rounded. Existing revision-19 canonical scene stayed byte-equivalent after reload and checks; no Save/Apply was performed and no browser warnings or errors were observed.
