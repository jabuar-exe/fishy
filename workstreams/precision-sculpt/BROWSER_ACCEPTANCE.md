# Direct sculpt browser acceptance

Testing by coordinator through actual browser UI, with read-only `read_fishy_scene` to compare canonical data. Isolated origin: http://127.0.0.1:5176/. Existing localhost and production saves were not used for mutation testing.

## Interim observations — 2026-09-13, before the history fix

- Object editor opens selected Left stone with actual mesh, brush overlay, centimetre dimensions, radius slider/number and millimetres-per-stamp strength slider. Initial dimensions 12.62 × 8.63 × 7.17 cm.
- Actual cursor drag (Pull) visibly deforms rock, updates dimensions, enables Apply and local Undo. Canonical scene stayed byte-equivalent while draft was open.
- Local Undo restored original dimensions and disabled no-op Apply.
- Fresh editor Apply advanced revision 1→2, persisted 176 nonzero lattice nodes, automatically protected rock-left, kept its position [-0.16,0.03,0.055] exactly, and kept all five other objects byte-equivalent.
- A stale draft spanning a development hot refresh safely rejected Apply. Cancel and reopen restored normal editing.
- Duplicate created separate UUID, valid nearby position and protected copy; source unchanged. One Undo removed only the copy in an earlier check.
- Blocker found: scene Undo restored original correctly, but Redo returned original again (no sculpt, protection false). Site owner and independent reviewer identified deferred state updater reading mutated current.current. Awaiting fix/retest before release.

## Previously found and fixed during this pass

- Dialog portal canvas initially did not mount; owner changed to mount-aware host lifecycle. Real mesh now appears and real brush stroke works.
- Brush minimum radius initially allowed dead zones; minimum now derives from actual world lattice spacing. Bounds labels update after deformation.
- Orphan selection after undoing duplicate now cleared by owner; final verification pending.

## Remaining acceptance

Redo retest, sculpted duplicate independence, save/reload, wood and plant interaction, small-screen access, actual downloaded five-view packet, final private deployment smoke.

## Fixed build verification — 2026-09-13, after the history fix

- Fresh actual Pull Apply stored 175 sculpt nodes and protection. Toolbar Undo restored exact original objects; Redo restored exact sculpted objects. History fix passes actual UI.
- Duplicate sculpted rock issued ID `8a7f099d-7730-4394-8076-706166c205c5`, cloned exact sculpt and kept source byte-equivalent. Actual Push stroke on copy changed only copy (180 nodes); source unchanged.
- Save revision 6 then reload isolated tab restored the entire canonical record byte-equivalent (7 objects, 2 independent sculpts).
- Persisted history after reload: Undo copy edit matched pre-edit copy exactly; Undo copy creation removed only the copy; two Redos restored all seven exact objects. Saved revision 10 differs from packet revision 6 only by revision bookkeeping.
- Wood: actual Pull and Smooth strokes enabled Apply; Orbit drag changed viewing angle. Cancel restored entire revision-6 record exactly.
- Plant: actual Pull changed dimensions 12.52 × 8.80 × 10.93 cm → 12.54 × 8.80 × 11.10 cm. Command-S during draft left canonical scene unchanged. Cancel restored whole record exactly.
- 390×844: shape canvas and brush controls usable, Apply/Cancel visible. 390×360: dialog scroll reaches dimensions, reset, Apply and Cancel. Viewport override restored.
- Five reference previews generated from frozen revision 6; actual Download action produced `/Users/joshuabanzon/Downloads/fishy-revision-6-five-views.zip`. Separate file-level verification is recorded in PACKET_ACCEPTANCE.md.
- Dialog close returned focus to Shape opener, or Open configuration when responsive layout unmounted the original opener.
- Browser developer log: zero captured warning/error entries during these checks.

## Coverage boundary

Interrupted pointer rollback, unsupported payload rejection, world-space nonuniform transform math, no-fit duplication and storage limits have code/unit-review evidence; physical multi-touch interruption and artificially exhausted storage were not reproduced through the browser UI. Exact digital geometry does not prove real-world dimensions or photorealism.

## Production v12 smoke — 2026-09-13

A fresh coordinator tab loaded the published private Site and recovered the existing v4 scene as schema 5/browser-3 in memory: revision 19, six objects, user-entered tank 90 × 100 × 56 cm. No Save or canonical Apply was performed on production.

- Shape and Duplicate actions visible. Actual rock Pull stroke changed draft height 7.17→7.22 cm. Cancel restored the full production record byte-equivalent.
- Five reference images and download link rendered from production revision 19. Canonical scene remained byte-equivalent after export and close. Browser warning/error logs empty.
- Found cosmetic floating-point output `56.00000000000001 cm` in the readable export label. Owner is applying a display-only formatting correction to UI/HTML; numeric scene/camera/manifest values stay untouched. Final deployment label verification pending.

## Final production v13 verification

- Final live label is `90 × 100 × 56 cm`; the migrated production scene remains byte-equivalent to the v12 baseline.
- Five final images rendered and actual UI download produced `/Users/joshuabanzon/Downloads/fishy-revision-19-five-views.zip`.
- Downloaded ZIP CRC, five 2048 × 1536 PNG identities and scene hash passed. HTML captions contain the clean dimension label; numeric manifest height remains the original unrounded `56.00000000000001`, confirming display formatting did not alter data.
- Extracted current-tank packet and report: `qa/production-reference-packet/`.
- Zero captured warning/error browser entries. Final reference-preview tab retained as a deliverable. No production Save or canonical Apply was performed.
