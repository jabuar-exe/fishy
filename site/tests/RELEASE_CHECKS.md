# Fishy local editor release checks — 2026-09-13

Scope: device-local procedural editor, attributed catalog/references, and three view-only original GLB compositions. No cloud persistence, model generation, voice capture, or photo-to-geometry integration is configured.

## Automated

`npx tsc --noEmit` and `node --experimental-strip-types --test tests/*.test.mjs`: 19 tests passed. `npm run build`: passed. Tests cover finite geometry bounds, asymmetric dimensions, protected objects, stable identity, duplicate display names, stale/cancelled commits, revision exhaustion, retained legacy fields/source, nested legacy metadata, and saved history.

## Browser checks

Performed through the actual local editor at localhost:5176, separate from the production storage origin.

- Selected a stone on canvas and dragged its move gizmo; X changed from -16 to -9.74 cm. Undo restored the exact original X.
- Changed wood form and size; actual rendered geometry changed.
- Focused brief + Cmd+S + reload retained exact text: `Keep the open foreground — focused save regression.`
- Focused Depth 30→40 + Cmd+S saved revision 7, retaining width 60 and height 36.
- Focused Height 10 + Cmd+S rejected protected-wood overflow. Height remained 36, revision remained 7, unsaved state and error remained visible; no misleading follow-on save occurred.
- Added a catalog plant with a new stable UUID. Apply fern→broadleaf retained UUID, position, rotation, size, protection and color. Add kept Assets open. Undo/redo advanced revisions.
- Ancient Juniper exposes source/Save reference only, no Add. No selected plant makes Apply to selected plant disabled.
- Searched 615 references for Tropica, opened credited results, and saved a reference to the canonical scene. Source photographs are not hosted.
- All three original GLBs loaded; orbit changed the view. Originals are explicitly view-only.
- At 1440×900, Layers/Assets/Ideas and Properties/Conversation flank the dominant canvas.
- At 390×844, document scrollWidth was exactly 390. The Conversation dialog measured 390×440. Escape closed it and returned focus to its trigger.
- Attached and removed an original Fishy PNG in the local-only photo panel. Source validation caps count, per-file/total bytes and decoded pixels; URLs are revoked on removal/unmount.
- The read-only WebMCP scene tool returned the canonical scene; extra input properties were rejected. No mutation/model endpoint exists.

## Limitations

The procedural assets do not match the realism benchmark supplied via Behind Glass: Aquarium Simulator (https://store.steampowered.com/app/1611580/Behind_Glass_Aquarium_Simulator/). The reference informs aquarium-led composition and restrained editing chrome; none of its proprietary art is reused. No simulated fish, water chemistry, or species-accurate materials are claimed. Model services are visibly unavailable. Docks are collapsible, not yet resizable. Local storage is not atomic cross-tab cloud synchronization. Imported legacy formats outside recognized fields remain preserved at their original keys and require review.

The development session logged transient React duplicate-runtime errors while introducing new Radix imports during HMR; a full reload recovered, and subsequent completed browser flows were functional. Production smoke must verify the published build independently.
