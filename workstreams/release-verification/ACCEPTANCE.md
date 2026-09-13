# Fishy acceptance verification

## Automated candidate

Run from the repository root:

```sh
cd site && node --import tsx --test ../workstreams/release-verification/scene-edge-cases.test.mjs
```

It supplements `site/tests/scene.test.mjs` with observable contract checks for schema boundaries, rotated rendered bounds, resize identity preservation, partial AI edits around a protected object, corrupt persisted JSON, immutable revision snapshots, revision exhaustion, duplicate-name resize targeting, legacy object fidelity, and saved undo/redo envelopes.

**Current result (2026-09-13): 10/10 pass.** The prior protected-object partial-AI-edit failure is resolved: protected records are canonicalized through `objectSchema` before comparison. The suite also confirms that the final safe revision is reachable exactly once, resize targeting is ID-based even when names collide, explicit legacy object fields survive migration, and persisted undo/redo snapshots restore with a 40-entry history cap.

## Browser checklist

Use a disposable browser profile or export the current scene first. This checklist deliberately avoids the already-covered basic select/drag/undo, dimension depth, protected-resize, wood styling, catalog add, save/reload, gallery save/search, and hero-GLB checks.

1. In Design, set width to **10 cm**, depth to **300 cm**, and height to **10 cm** one at a time. Invalid values below 10 or above 300 must revert on blur; valid asymmetric values must preserve the other two displayed axes and label the source as user-entered.
2. Select an unlocked rock. Rotate it to about **45°**, set X and Z close to the same tank corner, then commit each field. The object must remain entirely inside the tank, the red outside banner must stay absent, and its ID in the right panel must not change.
3. Make two distinct edits, then alternate Undo and Redo at least five times. Each action must change exactly one state, revisions must keep increasing, and an edit after Undo must disable Redo and never restore the abandoned branch.
4. Start a transform drag. While holding the gizmo, change a field or invoke another edit in a second tab/session if available; release the drag. Expect “Scene changed during this drag; drag cancelled,” no stale transform commit, and a returned object position. Repeat with Escape and the Cancel drag button.
5. Toggle AI protection on one object. Confirm manual position, size, rotation, and form edits still work. Then exercise the available `read_fishy_scene` model-context tool only if the host exposes it: it may read the object but must not offer a write route; any future AI commit must reject any changed or removed protected record.
6. In a disposable profile, put malformed JSON (for example `{bad`) at `fishy.studio.scene.v4`, reload, and verify the error says the earlier save could not be read safely. The save control must refuse overwrite; export must still work. Restore/remove the test key manually afterward.
7. Load each Originals item with DevTools Network set to Offline once. Each failed GLB must show “Showcase could not load…” plus the error banner, remain usable, and not leave a spinner or crash. Return online and confirm switching originals replaces the prior model cleanly.
8. Resize the window from desktop width to a narrow phone-like width, then use browser zoom at **200%**. Tab through workspace, toolbar, fields, catalog, gallery, controls, error dismiss, and footer. Focus must remain visible; controls must stay reachable without horizontal trapping; Enter commits number fields, Escape restores the input draft or cancels a transform, and Ctrl/Cmd+S and Ctrl/Cmd+Z behave as labelled.
9. Switch Design ↔ Inspiration ↔ Originals at least ten times, resize the window between switches, then leave the page. Watch the console for uncaught errors and confirm each view has one responsive canvas only. This is the practical regression check for `ResizeObserver`, request-animation-frame, canvas listener, and GPU-resource cleanup.

## Release boundaries

The current code gives a credible local, procedural editor with browser-local save, bounds checks, and graceful WebGL/GLB failure messaging. It does not establish production service guarantees: saves are local only, gallery/source URLs and GLB delivery need hosted-network verification, model/photo/voice actions explicitly have no configured service, and manual browser checks cannot prove absence of GPU memory leaks or accessibility compliance across browsers. Do not represent it as a hosted collaborative editor, AI editing service, or durable cloud storage until those services and their integration tests exist.
