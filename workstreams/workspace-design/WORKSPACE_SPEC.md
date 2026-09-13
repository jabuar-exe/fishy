# Fishy workspace specification

Implementation brief based on the current `site/app/page.tsx`, `app/globals.css`, `components/fishy-viewport.tsx`, and `lib/scene.ts`. This workstream changes no site files. The accompanying SVG is a functional layout diagram; it is not proposed aquarium artwork.

## Product structure

A persistent editor shell surrounds a dominant, luminous 3D canvas. Neutral charcoal chrome recedes; use aquatic teal only for selected controls, focus and the object outline. The aquarium supplies the color and atmosphere. Avoid editorial headings, serif display type, decorative gradients, oversized cards, and an extra marketing screen.

Top-level views: **Editor** and **Originals**. Inspiration is a tool inside the editor, not a competing project view. Originals are explicitly **View only · imported composition**. Switching views preserves the editor's camera, selection, brief, changes, and undo history. Do not imply the imported GLB is editable or provide an “Edit this” action until an actual import-to-scene path exists.

## Desktop geometry and hierarchy

Use `height:100dvh; min-height:0`, with 52px project bar, flexible workspace and 24px status row. At 1440×900, left dock = 240px, right dock = 280px, canvas = 920px wide (64% of width). At 1280px, left = 224px, right = 256px, canvas = 800px. Canvas never gets an extra marketing title or persistent instructions block. Overlay its 40px tools at the top and a small camera pill at bottom left; these overlays do not shrink the WebGL host.

Project bar order: small Fishy mark; project title and current tank size; Editor/Originals switch; undo/redo; browser save status; Save; project menu (Export scene, Restore starter). Keep undo/redo available and disabled according to actual history. Don't show a project-name input until renaming persists. Local persistence is labeled “Saved in this browser,” never cloud-saved. Dirty status reads “Unsaved changes.”

Resizable left/right docks use installed resizable primitives, thin separators with an 8px hit area and visible focus. Bounds: left 216–320px; right 256–360px. Apply a 560px canvas minimum before allowing both docks. Persist dock width independently of scene data. Each dock's content scrolls independently; dock tabs and heading remain fixed. A collapse button must reopen the same tab and preserve scroll position.

### Left dock: Layers / Assets / Ideas

Three text tabs, icons optional at 16px: Layers, Assets, Ideas. Their panels share the same width and scroll slot.

**Layers**: Tank root row followed by the six existing object rows. Tank selection opens dimensions and appearance in Properties. Use lucide icons for wood, rock and plant instead of Unicode glyphs. Rows are 36px high minimum, 8px inset, one-line name with full accessible name; the selected row has teal-tinted fill and 2px leading stroke. Optional protection icon means “Protected from AI edits,” not a manual movement lock. Don't invent groups, visibility, reorder handles, or delete actions without implementing them. Add material is a single footer action opening Assets. Put object count in heading, not every row.

**Assets**: sticky Search materials input, All/Wood/Plants filters with actual counts. Rows show material name, category, two-line visual description, source link, and explicit Add button. Do not use fabricated thumbnails. A single “Procedural materials” help disclosure explains approximation; retain per-item source attribution. Adding inserts/fits/selects the object and reveals Properties without jumping out of Assets, so repeated placement is easy. Show object-limit failure inline by Add, preserve query and scroll.

**Ideas**: Search references and compact attributed reference rows. Each has title, creator/source, short composition lesson, View source, Save idea. No source photograph means no fake image placeholder. A Saved filter reads scene.references; “Save idea” becomes “Saved” and is disabled when already saved. For deeper browsing, an explicit Expand library button opens a dialog or full canvas overlay, never silently changes the project mode. Closing restores the exact editing context.

### Right dock: Properties / Conversation

**Properties** is selected initially. No object selected shows Tank: width/depth/height in cm, substrate if editable, and Water surface appearance. Object selected shows name, type, Transform, Material/form, and AI protection. Move existing tank dimensions out of the Layers panel to eliminate duplication. The selected object ID belongs in optional details, not the prominent heading.

Transform has X/Y/Z cm fields in one row; Rotation Y in degrees; Size in percent. Keep current constraints and fit/error semantics. A field has an explicit label, unit, tabular number and 32px minimum height. Do not add pitch/roll or nonuniform scale controls unless the editing model supports their behavior. Show procedural approximation/source in a compact provenance disclosure. AI protection uses a real switch or toggle named “Protect from AI edits,” with a one-line clarification only when enabled: “You can still edit this object.”

**Conversation** contains editable Design brief, saved ideas, and Add photo with local attachment previews/remove actions. When model services are unavailable, show one compact state: “AI services aren't connected. You can save a brief and attach reference photos.” Voice/photo-to-geometry/image concept appear as capability rows marked Unavailable, not clickable buttons that only produce apologetic notices. A configuration action appears only if there is a real configuration route. Photo attachment remains enabled because it works; disclose “Photos stay in this session” adjacent to upload. Conversation does not imply that uploading a photo sends it anywhere. On future availability, place real composer/microphone actions in the same panel and preserve this state model.

## Canvas behavior and selection

Tools: Move (V), Rotate (R), Frame tank (F). Tool buttons use 36px targets and aria-pressed. Only show Cancel while a transform is active. Preserve pointer orbit in empty space and wheel zoom. Add a Help affordance with actual gestures and keyboard shortcuts; don't occupy the canvas bottom edge with a sentence all day. Selected object gets a restrained teal bounding box, existing axis-colored transform handles, and matching layer highlight. Hover can subtly highlight only if actual hit testing is implemented. Selection is distinct from keyboard focus.

Escape first cancels an active transform; otherwise clears selection. Empty-space click clears selection while a drag or pan does not. `onSelect` must accept null to support this. When nothing is selected, the toolbar can retain the last move/rotate choice, but there is no gizmo. Changes commit once per completed drag; Escape cannot commit a partial drag. Stale revision errors retain the scene and announce cancellation. Keep existing protected-object and validation invariants.

WebGL loading/error status sits centrally only during loading or failure. Remove the permanent “6 editable objects” overlay after load; object count already exists in Layers. On WebGL failure, keep editable properties/layers accessible and show a concise diagnostic in the canvas. Reduced-motion preference suppresses water animation. ResizeObserver must continue to handle dock resize and sheet closing. Preserve renderer/camera instance while switching editor tabs and dock panels; don't recreate it on every panel interaction.

## Narrow screens

**960–1199px**: left defaults to 216px; right is initially closed, opens as 280px anchored overlay. Selecting an object does not force the overlay open; Properties toolbar affordance shows selection name. Keep at least 560px unobscured canvas when no overlay is open. Left dock can collapse. On each side, reopening restores prior panel. Escape closes an overlay after cancelling a drag.

**Below 960px**: canvas is full width. Project bar = 52px and bottom tool navigation = 48px (plus safe-area inset). Bottom navigation offers Layers, Assets, Ideas, Properties, Conversation, each with visible text and 44px minimum tap target. One panel opens at a time as a bottom sheet with a 44px heading/close row; sheet height = min(440px, 60dvh), internally scrollable. The canvas remains visible above it. Use a proper modal dialog on touch sheets: trap keyboard focus, mark the background inert while open, return focus to trigger on close. Do not let touches behind a sheet orbit the tank. Numeric fields remain three columns where each can be at least 72px; otherwise stack labels/fields in rows. Avoid the existing two-column panels below a 500px-tall canvas and the resulting whole-page scroll.

At <480px, hide the dimensions subtitle and local save text, retaining the Save button and an accessible save status in project menu. Project menu holds Export/Reset and history if space requires. Do not reduce labels below 12px to fit. At 200% zoom, these same breakpoints provide the narrow layout. In short-height landscape, sheet fills available height below project bar, with a clear Close control; don't force 640px minimum app height.

## Accessible interaction

Use installed Base UI tabs/menu/dialog/tooltip primitives where available and native inputs/buttons for controls. Tabs follow roving tab index and arrow-key behavior. Ordinary layer rows are buttons with aria-pressed; use a tree only when genuine hierarchy and tree keyboard behavior exist. Every icon-only control has an accessible name and tooltip. Use visible 2px focus ring with 2px offset, minimum text contrast 4.5:1, 3:1 for relevant UI boundaries. Focus must not be clipped by dock overflow. Avoid broadcasting selection or every animation frame in a live region; announce completed edits, saves, additions and errors. Apply shortcuts only outside input/textarea/select/contenteditable; implement Ctrl/Cmd+Shift+Z redo and prevent browser conflicts. Manual fields are a complete keyboard editing path.

## Lightweight registry contract

Use two small local arrays, not a plugin runtime. Dock entries need stable ID, side, label, icon, render function, and optional availability predicate. Tool entries need ID, label, icon, optional shortcut, isEnabled(context), isActive(context), run(context). Context contains current view, selection, transform-in-progress and actual capabilities. Registry stores no scene data, reducer, arbitrary string events or transport. Scene remains the single authoritative document.

Example shape:

```ts
type WorkspaceContext = {
  view: 'editor' | 'originals'; selectedId: string | null;
  transforming: boolean; capabilities: { photoGeometry: boolean; voice: boolean; imageConcept: boolean };
};
type PanelDefinition = {
  id: 'layers' | 'assets' | 'ideas' | 'properties' | 'conversation';
  side: 'left' | 'right'; label: string; icon: LucideIcon;
  render: () => React.ReactNode;
};
type ToolDefinition = {
  id: string; label: string; icon: LucideIcon; shortcut?: string;
  enabled: (ctx: WorkspaceContext) => boolean;
  active?: (ctx: WorkspaceContext) => boolean;
  run: () => void;
};
```

Use the same panel definitions to render desktop tabs and mobile navigation. New future capability plugs into an existing panel first; add a dock tab only when its workflow justifies one. Availability is based on verified configuration, never model-name text.

## Current-file integration and priority

P0, implement now in page.tsx: rename Design→Editor and Originals→Originals (view only badge in canvas); migrate Inspiration into left Ideas; split right dock into Properties/Conversation; move dimensions and appearance to unselected/Tank Properties; replace nonfunctional model buttons with unavailable capability state; group Save/history/project actions in topbar. Preserve apply, undo, redo, save, revision and storage recovery guards. Replace panel string values with stable typed IDs.

P0 in globals.css: replace green-tinted chrome with neutral tokens; shrink topbar to 52px/statusbar to 24px; set real fixed viewport shell; dock sizing per breakpoints; use 13px default controls, 12px supporting text; remove serif showcase/gallery headlines and oversized cards. `tokens.css` is a proposed drop-in variable source, not automatically applied.

P1 in fishy-viewport.tsx: expose transform activity and nullable selection; consume accent for outline; only announce load state transiently; support clear-selection and Frame shortcut; preserve renderer across view switching if practical. A view-only Originals panel should show composition selector and original dimensions, never editable scene transforms. Remove the hard-coded “73 named objects” success label or derive count from the loaded asset.

P1 in page.tsx: return focus after closing dialogs; proper redo shortcut; attachment remove/revoke behavior; actual async loading/capability state. Use local UI state for panel placement, not scene.ts. Keep scene.ts schema/storage migrations unchanged for this interface revision.

P2: dock resizing with persisted sizes; expanded reference browser; optional hover feedback. No additional registry infrastructure, model purchase prompts, asset marketplaces, layer grouping or unsupported controls in this pass.

Acceptance: at 1440×900 the canvas is the dominant region; at 390×844 no horizontal page scroll; every existing edit/save/export/undo still works; object selection updates Properties; unavailable services never suggest a request was sent; source/reference links remain intact; keyboard-only users can edit dimensions and transforms, save, undo and close panels; 200% zoom retains all controls.
