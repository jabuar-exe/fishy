# Direct object sculpting and reference views

2026-09-13. Published and verified on the existing private Fishy Site.

## What was implemented

In Arrange, select a wood, rock or plant and use **Shape**. Pull, Push and Smooth alter the actual mesh through a versioned deformation lattice; Orbit changes the view. Brush radius uses centimetres, strength uses millimetres per stamp, and dimensions update as the draft changes. Apply commits one change and protects the object; Cancel leaves the scene intact. Undo and Redo preserve the shape.

**Duplicate** creates a separate, protected object with the same sculpted surface and a valid nearby placement. Editing the copy leaves the source intact. The system returns an error when no valid placement is available instead of silently resizing objects.

**Export five reference views** produces front, left, right, top and perspective PNGs at 2048 × 1536, plus an HTML contact sheet, exact scene data and camera/dimension metadata. Four orthographic views share the same metres-per-pixel scale. All five use the same frozen scene, geometry and studio lighting. SHA-256 identities tie images, scene and camera records together. Room/source photographs are excluded from this packet.

## Evidence

- [Actual browser acceptance](BROWSER_ACCEPTANCE.md): cursor strokes, local undo, Apply, exact scene Undo/Redo, copy independence, exact save/reload, persisted history, wood/plant interactions, responsive controls and zero captured console warnings/errors.
- [Downloaded packet acceptance](qa/reference-packet/PACKET_ACCEPTANCE.md): actual ZIP CRCs, five images, all hashes, exact sculpt data, consistent orthographic scale and no clipping.
- [Save/security review](qa/SAVE_SECURITY_REVIEW.md): four focused adversarial/migration/storage tests passed.
- Independent geometry review confirmed world-unit behavior under rotation/nonuniform scale, strict malformed-data rejection, regenerated vertex identity, protection handling and corrected minimum brush radii.

The Redo bug discovered in actual browser testing was fixed by capturing departing history snapshots before updates, then retested through actual buttons and saved history. The initially empty dialog canvas and undersized brush dead zones were also fixed before release.

## Precision and realism limits

This is broad, soft surface shaping of existing geometry, not clay remeshing, cutting, merging or fine engraving. Minimum brush size follows the object's finite lattice resolution (starter arch about 6.2 cm, stones about 2 cm). Versioned generator and saved deformation preserve digital surfaces; they do not certify real-world dimensions.

Materials and water remain procedural approximations. Five reference angles preserve design identity but are rendered illustrations, not photographs of a verified physical tank. The starter 60 × 30 × 36 cm dimensions remain marked assumed. Exported JSON includes full sculpt data; this release has no general scene-file re-import UI.

Existing v4 saves migrate with original bytes retained. A concurrently open old-version tab could write a newer v4 record after migration but before first v5 save; the original record remains available, but the new v5 branch may be stale. This does not overwrite the old record and is a documented follow-up.

The prior Blender reconstruction evaluation and model runs remain separate and unchanged. No new image-generation or reconstruction model calls were needed for this sculpt/export release. GPT Live and hosted reconstruction integrations retain their existing connection status.

## Sample packet

- [Open the five-view contact sheet](qa/reference-packet/index.html)
- [Download the tested ZIP](/Users/joshuabanzon/Downloads/fishy-revision-6-five-views.zip)
- [Perspective render](qa/reference-packet/perspective.png)

This sample is the isolated QA scene at revision 6, with two independently sculpted rocks. It does not replace the user's production save.

## Publication

Final release v13 succeeded 2026-09-13 05:35:45 UTC (13:35:45 Singapore), ahead of the earlier 14:02 Singapore deadline.

- URL: https://fishy-3d-studio.banz-joshua.chatgpt.site/
- Site: `appgprj_6aa60f318aec8191903686f10de4e48e`; same owner-private audience.
- Commit: `d608e0fd8d09d8d66fb79566e5507f419eb8e84f`.
- Version: `appgprj_6aa60f318aec8191903686f10de4e48e~appgver_31eadf8270188191ace8422f85273b64`.
- Deployment: `appgdep_6aa63621f11c8191a29b2c1955acbc2e`.
- All 50 tests, TypeScript, diff checks and fresh production build passed per sole Site owner.
- Coordinator production smoke verified actual cursor stroke/Cancel, migrated existing save, five rendered views, and clean browser logs. A floating-point display artifact discovered in v12 was corrected in v13 with display-only formatting; final live label reads 90 × 100 × 56 cm and exact canonical scene remained byte-equivalent.
- Original user production scene was never saved or canonically modified during QA. Isolated local QA tab closed; owner stopped its development server. Unrelated user untracked files were retained.

## Current user tank packet

After final publication, the coordinator exported the existing production revision 19 (six objects, user-entered 90 × 100 × 56 cm). [Download its five-view ZIP](/Users/joshuabanzon/Downloads/fishy-revision-19-five-views.zip) or [open its contact sheet](qa/production-reference-packet/index.html). This is separate from the sculpted QA sample. The final ZIP passed CRC, image dimension/hash and scene hash checks; clean readable captions preserve unrounded numeric metadata.
