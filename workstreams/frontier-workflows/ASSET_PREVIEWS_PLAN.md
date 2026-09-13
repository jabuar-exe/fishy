# Asset previews and material controls — implementation plan

## Decision

Implement original, procedural 3D previews for the 19 `supported_procedural` catalog materials with a **single client-side preview-atlas renderer**. It serially renders thumbnails from the same asset-aware geometry/material factory used by the editable aquarium, then cards display the resulting images. This supplies real 3D samples without creating one WebGL context per card. A selected material gets a live thumbnail from that same renderer whenever one of its shape-producing controls changes.

Do not use supplier photographs, Blender Originals, category icons, or generic-form images as material previews. Keep `wood-ancient-juniper` out of the atlas and out of Add/Apply; it remains a clearly marked “Reference only” card with its source link and Save reference action.

This is feasible in the present stack: the app already has Three.js, a single interactive `FishyViewport`, bounded scene objects, build-time catalog imports, `makeObject`/`boundsOf`/`fitObject`, and a transactional slider primitive. No dependency or network request is needed.

## Evidence and scope

| Fact | Current source | Consequence |
| --- | --- | --- |
| The registry has 20 IDs; exactly 19 are `supported_procedural`, and all 20 join 1:1 to `catalog.json`. | `site/public/data/catalog-registry.json`, `site/public/data/catalog.json` | Render the 19 supported IDs only; fail validation on a broken join. |
| `makeObject` is the canonical source for the viewport, `boundsOf`, tank fitting, and resize behavior. | `site/lib/geometry.ts` | Preview and editor must call the same asset factory. A preview-specific mesh implementation would drift. |
| Today, catalog entries collapse into 5 wood and 6 plant forms. Some registry limits explicitly say that this is not faithful (Cholla lattice, Dragon cavities, Crypt rosette, species leaf forms). | `site/lib/geometry.ts`, registry `renderingLimit` | Replace the catalog-ID branch with dedicated but still labelled procedural asset builders; retain generic forms only for un-catalogued legacy objects. |
| Catalog controls are normalized local art direction, not real-world dimensions or a physical generation contract. | `workstreams/catalog-integration/GALLERY_UX.md` | Call the displayed values “Procedural form controls” and “canonical bounds,” never centimetres, care values, exact scans, or purchase compatibility. |
| The current grid uses a Lucide icon and generic form name. | `site/app/page.tsx` | Replace only the preview area with generated preview images plus a text fallback; retain label, role, source, caveat, and Add/Apply behavior. |
| `FishyViewport` correctly disposes renderer resources, but a renderer is tied to every viewport instance. | `site/components/fishy-viewport.tsx` | The grid must not mount 19 miniature `FishyViewport`s. |

## Data and model contract

Create `site/lib/materials.ts` as the single typed catalog facade. It imports both public JSON files, validates their one-to-one ID join at module initialization, and exports:

- `MaterialDefinition`: registry metadata plus `sourceForm` (`visualForm`), canonical numeric control ranges, categorical controls, renderer profile, source/publisher, and the existing provenance/limitation copy.
- `SUPPORTED_MATERIALS`, `REFERENCE_MATERIALS`, `getMaterial(id)`, `materialDefaults(id)`, and a stable `materialPreviewKey(...)` helper.
- A `MATERIAL_FACTORY_VERSION` constant. Increment it when geometry, material, framing, lighting, or canonical defaults change so stale in-memory preview images cannot be reused.

Use `catalog.json` as the source of canonical form/control bounds and the registry as the authority for addability and presentation. No data is fetched at runtime. Preserve the current `Catalog` metadata in the user interface by deriving it from this facade instead of duplicating a second page-local type.

Extend `SceneObject` in `site/lib/scene.ts` with an optional, bounded material state:

```ts
material?: {
  id: string;                         // must match catalogId when both exist
  parameters: Record<string, number>; // only declared numeric controls, max 6
  variants?: Record<string, string>;  // only declared categorical controls, max 1
};
```

Keep scene schema 4 and `SAVE_KEY` unchanged: the field is optional, so existing local saves and JSON exports remain readable. In `readSavedScene`, canonicalize a legacy object with a supported `catalogId` to its material ID and defaults only in memory before validation; do not write storage until the normal user Save action. Preserve a legacy object with an unknown catalog ID as a generic-form object and surface its existing “Original procedural object” behavior. Enforce ID agreement when both `catalogId` and `material.id` exist. Reject parameter or variant keys not declared by that material, non-finite values, and values outside their declared range; this prevents a malformed imported scene from selecting an unbounded geometry path.

For all new Add and Apply operations, store `catalogId`, `material.id`, canonical parameter defaults, applicable variants, and a deterministic default color. A material control commit patches only that material state (and any color derived by the factory), retains ID/position/rotation/size/stretch/protection, then runs the existing `fitObject` check because a changed silhouette may change bounds.

## Shared factory and truthful geometry

Refactor `site/lib/geometry.ts` into three public layers while preserving `makeObject`, `boundsOf`, `fitObject`, and `disposeObject` as the call sites:

1. `resolveRenderableObject(sceneObject)` resolves supported material state/defaults or the legacy generic form fallback. It returns canonical parameters, variants, color, and a deterministic seed derived from material ID + object ID. No `Math.random` is allowed; a control change must be reproducible in the viewport, bounds calculation, and thumbnail renderer.
2. `buildMaterialGeometry(resolved)` dispatches by supported material ID. It creates the exact group/mesh topology and visual material used for both thumbnail and aquarium. Dedicated profiles cover each promised silhouette: branching spider/root woods; porous hollow Cholla; knuckled/two-tone Mopani; eroded/cavity Dragon; directional Talawa; separate Monte Carlo/Glossostigma carpets; Anubias/Buce rhizome clumps; draping Weeping moss; red trimmed Alternanthera; Crypt rosette; Eleocharis grass; structured Fissidens; and lobed Bolbitis.
3. `makeObject` applies position, rotation, `stretch`, and `size` only after the factory produces its canonical local geometry. The same function continues to set object ID, shadows, and matrix state. `boundsOf` remains a real `Box3().setFromObject(makeObject(...))` calculation.

Every visible slider must affect that asset’s group or material in this factory. Use the catalog’s stated numeric ranges with sensible steps: integer steps for count-like values (`branchCount`, `leafCount`, `cavityCount`, `lobeCount`, etc.), `1` for degree values, and decimal steps no coarser than 1% of the range otherwise. Show categorical controls as radio/segmented choices, not fabricated sliders. Do not expose catalog entries that have no implementation effect.

Recommended exact control groups, which implement every numeric source range and the two categorical source ranges:

| Asset IDs | Form controls that must drive geometry/material |
| --- | --- |
| Spider | trunk radius, branch count, taper, twist, tip density, root spread |
| Manzanita | silhouette (stump/branch), main-stem lean, fork depth, roughness, grain, asymmetry |
| Mopani | massiveness, fork count, grooves, two-tone contrast, cavities, footprint |
| Cholla | tube length/radius, wall thickness, perforation density, ovalness, breakage |
| Red Moor | module/limb counts, curvature, radial spread, tangle, fine-tip length |
| Malaysian | trunk thickness, branches, ruggedness, voids, darkness, base weight |
| Talawa | straightness, grain, bark coverage, branches, taper, lean |
| Ghost | branch radius/count, fork angle, crown width, lightness, assembly complexity |
| Dragon | trunk mass, cavity count/radius, knob density, branches, erosion |
| Monte Carlo | patch radius, carpet height, leaf scale, coverage, edge irregularity |
| Anubias | rhizome length, leaf count/length, clump density, attachment spread |
| Weeping moss | mat width, drape length, frond density, droop, attachment patches |
| Bucephalandra | rhizome spread, leaf length, wave, nodes, dots |
| Alternanthera | stem density, canopy height, leaf aspect, red-violet mix, trim plane |
| Cryptocoryne | rosette radius, leaf count/length, arch, ripple |
| Eleocharis | patch radius, blade height/density, lean, clump spacing |
| Fissidens | attachment orientation (vertical/horizontal), tuft radius, frond length/pair density, mat thickness |
| Glossostigma | carpet height, leaf scale, runner density, coverage, uprightness |
| Bolbitis | rhizome length, frond count/length, lobes, translucency, current lean |

The material definition must also export a canonical local `Box3` generated from its defaults via the shared factory. Show the rounded X × Y × Z local bounds in the detail/inspector as “Canonical procedural bounds,” with no real-world unit claim. Recompute it whenever a current object’s form parameter or size changes; it is derived from the actual object factory, never hand-maintained registry text.

## Rendering and cache design

Add `site/components/material-preview-atlas.tsx` plus its small CSS additions. It owns one invisible `HTMLCanvasElement`/`WebGLRenderer`, one reusable scene/camera/light rig, and one FIFO render queue. It never mounts a renderer per material card.

For each queued material state:

1. Construct the canonical preview object with `makeObject` at position/rotation zero, size 1, no scene transform.
2. Measure the actual `Box3`, translate its temporary preview parent so it rests on the preview floor and is centered horizontally, then calculate an orthographic/perspective camera fit from that same bounds box.
3. Render with a neutral original studio background, shared directional/hemisphere lights, and no water/tank. Convert the bounded 192 × 128 canvas to WebP (PNG fallback) and store its URL in the atlas state.
4. Immediately remove and `disposeObject` the temporary group. The only retained render resource is the final image URL and the one renderer.

The cache key is a deterministic string:

```
preview-v1 | MATERIAL_FACTORY_VERSION | material.id | sorted(parameters) |
sorted(variants) | resolvedColor | previewSize | lightingProfile
```

The first material-panel open queues all visible supported cards at low priority (one job per animation frame or `requestIdleCallback`, with a timeout fallback). The selected/detail material queues first. An inspector style change invalidates only that material’s key and places the replacement job first; the thumbnail and canonical bounds update only after the changed parameter commits successfully. Search/filter cancellation removes no-longer-visible low-priority jobs.

Bound memory to 24 cached images, which covers the 19 addable catalog materials plus a few active variants. On LRU eviction, revoke the object URL. On atlas unmount, cancellation, WebGL context loss, or page navigation: cancel idle/animation handles, clear queued jobs, revoke all cache URLs, dispose any current mesh/geometry/material, dispose the renderer, and remove the hidden canvas. If WebGL initialization, render, or `toBlob` fails, render a semantic text fallback: material name, “Procedural form preview unavailable,” source form, and the existing limitation copy. The Add/Apply controls stay available; failure never changes the scene.

Use one atlas renderer in the Materials panel and the existing editable `FishyViewport` renderer for the aquarium. This bounds the material surface to one additional WebGL context rather than 19. The atlas deliberately does not use the GLTF/Blender Originals route.

## UI behavior

In `site/app/page.tsx`:

- Replace each `form-preview` icon with `MaterialPreview` output from the atlas. Its accessible name is “Procedural 3D preview of [material], [source form].” The image alt and nearby text say “Procedural preview,” never “photo,” “scan,” or “specimen.”
- Each candidate detail starts with its larger preview, source form (`catalog.json.visualForm`), canonical bounds, “Procedural approximation,” and the existing limitation/caveat/source publisher. This gives every asset its own stated form and current real bounds.
- Keep selecting a tile non-mutating. Add creates/fits/selects the new material with defaults. Apply remains unavailable for reference-only or incompatible kinds; when eligible it replaces the compatible asset state atomically and preserves identity/transform/size/protection.
- For an object with supported material state, replace the generic Shape radio list with a Material form section (source form, preview, Replace material) and a collapsible “Procedural form controls” group. Render `Adjustment` for every numeric defined control and semantic radio controls for variants. For a legacy generic object, retain the current generic Shape controls unchanged.
- Extend `changeObject` so `material` and color patches are bounds-affecting; reject atomically and reset the active slider on failure. A material control remains one undo step per completed `Adjustment` gesture, uses the existing Escape rollback path, and does not dirty the scene while its preview tile is merely selected.
- Keep Juniper visible as “Reference only.” It has no generated preview, no Add, no Apply, and no material sliders. Its existing save-reference/source behavior remains.

## Exact edit boundaries

| File | Change |
| --- | --- |
| `site/lib/materials.ts` **new** | Typed, validated join of existing catalog data; material defaults, ranges, variants, source form, cache key/factory version. |
| `site/lib/scene.ts` | Optional bounded material state and legacy normalization/validation only; no schema-version or storage-key break. |
| `site/lib/geometry.ts` | Deterministic resolver and the shared 19-profile material geometry/color factory; legacy form fallback; bounds stay derived from `makeObject`. |
| `site/components/material-preview-atlas.tsx` **new** | One-Renderer atlas provider, queue, LRU, framing, fallback, and cleanup. |
| `site/components/scene-controls.tsx` | Reuse `Adjustment`; only add an optional precision/step prop if required to honor integer/count and degree controls without duplicated transaction logic. |
| `site/app/page.tsx` | Replace icon previews, use materials facade, initialize/apply material state, asset inspector controls, and bounds-aware material commits. |
| `site/app/globals.css` | Preview frame, fallback, larger detail sample, disclosure/control layout, and reduced-motion-safe loading state. |
| `workstreams/release-verification/scene-edge-cases.test.mjs` | Add schema, default/legacy, deterministic-bounds, parameter-bounds, atomic fitting, and Add/Apply identity coverage. |
| `workstreams/interface-v2/INTERACTION_CHECKS.md` | Add manual atlas/context, no-fake-preview, control/undo, Juniper, and fallback checks. |

No edits are planned to `site/public/data/catalog*.json`, the Blender Originals, gallery data, source links, or third-party assets. Do not introduce an image-generation service, external assets, a canvas per tile, a server API, or a new package.

## Verification plan

1. **Data and model unit tests:** assert the 20-ID join, 19 supported/1 reference-only partition, defaults within every source range, unknown/invalid parameter rejection, legacy `catalogId` normalization, and a matched material/catalog ID. Confirm Juniper cannot produce addable state.
2. **Geometry unit tests:** for every addable definition, construct defaults through `makeObject`, assert finite/non-empty bounds, dispose it, and check deterministic bounds for identical state. For each numeric control, test min versus max produces a geometry/material signature or bounds change promised by that control. Verify a resize and a material-form adjustment use the same bounds path.
3. **Transaction tests:** Add receives a new ID and defaults; Apply retains ID/position/rotation/size/protection; a material slider makes exactly one revision and Undo/Redo restores both parameters and geometry; a rejected out-of-bounds control leaves metadata, bounds, history, and preview key unchanged.
4. **Atlas/component tests:** one atlas renderer is constructed for 19 cards; the queue has a maximum active job of one; default image keys are unique; changing a real parameter produces a new key and image; LRU eviction/unmount revokes URLs and disposes the renderer; forced WebGL/toBlob failure shows the textual fallback without blocking Add.
5. **Browser acceptance:** open Materials and verify a real generated sample for all 19 supported cards; compare each selected card, inspector preview, and placed object; adjust a parameter and confirm bounds plus preview change after the commit; test narrow/200% layout and keyboard slider/Escape behavior. Verify no browser console error, no more than one atlas canvas/context, no asset network requests, and that Juniper remains source-only.
6. Run `npm run lint`, `npm run build`, and `node --test workstreams/release-verification/scene-edge-cases.test.mjs`; then run the material-specific tests added by this workstream.

## Delivery sequence and risks

1. Land the data facade and schema validation with its tests before changing rendering.
2. Land the shared deterministic factory, legacy fallback, and bounds tests before the UI consumes material state.
3. Land the one-context atlas and its cleanup/fallback tests.
4. Wire card/detail/inspector controls and transaction behavior, then complete browser acceptance.

The main risk is semantic overclaim: a more detailed procedural mesh can still be mistaken for a supplier specimen. The persistent “Procedural approximation,” source form, canonical-bound wording, per-entry limitation, and Juniper exclusion are acceptance conditions. The main technical risk is density-driven geometry cost. Each builder must cap count-derived tessellation at its stated maximum, use instancing where repeated leaves/pebbles/fronds are appropriate, and leave the atlas queue serial so preview generation never stalls the main interactive viewport.
