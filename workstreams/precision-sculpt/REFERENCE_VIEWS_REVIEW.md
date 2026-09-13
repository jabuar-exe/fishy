# Precision sculpt: fixed reference views and honest exports

**Coordinator decision after this review:** this is advisory analysis. The selected release rig is **front / left / right / top orthographic plus perspective overview**, as specified in PLAN.md. The alternative five-perspective rig below is not the implementation requirement. Preserve full numeric scene/sculpt precision and hash the exact exported JSON bytes; do not introduce six-decimal rounding into accepted geometry. The proposed image-difference thresholds are unvalidated suggestions, not promised accuracy or release gates. One immutable captured revision may finish exporting while the editor advances, provided the packet clearly identifies that captured revision and no state is mixed. These decisions supersede conflicting recommendations below.

**Scope.** This is a design/review recommendation for the editable browser scene. It does not change the site, invoke Blender, or turn the procedural browser tank into a calibrated reconstruction. The current browser scene is in metres with `Y` up, `X` right, `Z` toward the front, and origin at the floor centre. Its default tank dimensions are explicitly `assumed`; there are no supplied physical measurements or calibrated source photos.

## Finding

Fishy already has a clear editable coordinate model, constrained object bounds, procedural material detail, and a capable interactive `PerspectiveCamera`. It is not yet suitable for shareable precision views:

- `FishyViewport` re-frames the camera from the current canvas aspect and content bounds. A browser resize changes the presentation.
- Its render pixel ratio follows the device (capped at 2), and the visible canvas has no scene-image export path.
- Water vertices animate from wall-clock time. Transform gizmos and selected-object boxes can be present in the render scene.
- The tank uses edges and a translucent back panel; it is not a measured glass/water/refraction model. Wood, stones, and plants are parameterized proxy geometry, despite the improved procedural grain and refined leaves.

Those are appropriate editing trade-offs. A separate, static export pass is the smallest change that creates internally consistent comparison images.

## The five fixed cameras

Use a fresh `PerspectiveCamera` for export; do not reuse or mutate the orbit camera. All views use a **1600 × 1200 PNG**, vertical FOV **32 degrees**, `near: 0.005 m`, `far: 30 m`, `up: [0, 1, 0]`, and target `T = [0, 0.46H, 0]`, where `W`, `H`, and `D` are the scene tank dimensions. Let:

```
r = 0.5 * sqrt(W² + H² + D²)
d = 3.4 * r
position = T + d * direction
```

The directions below are unit vectors in Fishy's declared world coordinates. They deliberately describe the camera **from the tank**, so positive `Z` is the front viewing side.

| ID | Direction | Purpose |
| --- | --- | --- |
| `front` | `[0, 0, 1]` | Primary, level full-tank comparison and progress image. |
| `front-left-35` | `[-0.561042, 0.207912, 0.801252]` | Left hardscape overlap, depth, and planting tiers; 35-degree yaw and 12-degree elevation. |
| `front-right-35` | `[0.561042, 0.207912, 0.801252]` | Right hardscape overlap, depth, and planting tiers; symmetric to the left view. |
| `left-profile-08` | `[-0.990268, 0.139173, 0]` | Depth profile, negative-space check, and hardscape lean; 8-degree elevation. |
| `top-front-right-30-58` | `[0.264960, 0.848048, 0.458892]` | Plan/footprint check for substrate, rear planting, and front-to-back object placement; 30-degree front-right yaw and 58-degree elevation. |

No crop, pan, room photograph, UI chrome, selection outline, transform helper, or arbitrary orbit state belongs in these exports. If the full tank does not leave a 3% image margin in a view, that is a camera-rig defect to fix globally, never a per-scene crop adjustment.

The five views are a compact *model documentation set*, not five source-photo requirements. Ask for real reference photos only when the user wants to compare this scene with a particular physical tank. In that case, capture the same five broad viewpoints where feasible, record the actual lens/crop/exposure, and state which viewpoints cannot be matched. A perspective match without tank dimensions, focal length, camera pose, and glass/water optics remains visual, not metric.

## Export contract and metadata

Create one manifest per five-image export, then give all five images the manifest's `exportId`. Canonical JSON and SHA-256 hashes must be produced from a documented stable serializer (sorted object keys, UTF-8, six decimal places for metres/radians); do not hash display labels or transient timestamps as part of the configuration hashes.

```json
{
  "schema": "fishy.reference-views.v1",
  "exportId": "uuid",
  "createdAt": "ISO-8601 UTC",
  "scene": {
    "id": "scene id",
    "revision": 19,
    "sha256": "canonical scene descriptor hash",
    "units": "metres",
    "coordinates": "Y-up; X right; Z toward front; origin floor centre",
    "tank": {"widthM": 0.6, "depthM": 0.3, "heightM": 0.36, "source": "assumed"},
    "substrateM": 0.03
  },
  "measurement": {
    "status": "model-coordinates-only",
    "physicalScale": "assumed or user-entered; not independently measured",
    "cameraCalibration": "none",
    "opticalCalibration": "none",
    "claim": "Image geometry is a rendering of the stored Fishy scene, not a measurement of a real aquarium."
  },
  "render": {
    "runtime": "browser",
    "builder": "fishy-browser-2",
    "appCommit": "git commit when available",
    "threeRevision": "THREE.REVISION",
    "output": {"format": "image/png", "widthPx": 1600, "heightPx": 1200, "pixelRatio": 1},
    "toneMapping": "ACESFilmicToneMapping",
    "toneMappingExposure": 0.95,
    "outputColorSpace": "renderer.outputColorSpace value",
    "shadow": {"enabled": true, "type": "PCFShadowMap", "mapSize": 1024, "normalBias": 0.002},
    "environment": "RoomEnvironment; scene.environmentIntensity=0.55",
    "background": "dark studio #111d21",
    "water": {"enabled": true, "timeSeconds": 0, "animation": "frozen"},
    "surfaceProgram": "fishy-surface-v1",
    "configSha256": "canonical render configuration hash"
  },
  "views": [
    {
      "id": "front",
      "camera": {"projection": "perspective", "verticalFovDegrees": 32, "nearM": 0.005, "farM": 30, "up": [0, 1, 0], "positionM": [0, 0, 0], "targetM": [0, 0, 0]},
      "cameraSha256": "canonical camera configuration hash",
      "file": "fishy-scene-19-front.png",
      "sha256": "exported file bytes hash"
    }
  ]
}
```

The manifest must retain the entire scene descriptor or a separately downloadable, content-addressed scene JSON. A scene hash alone is not enough for a recipient to inspect the claimed model. The capture should use an isolated export renderer/canvas at pixel ratio 1, set its size explicitly, render after its resources have settled, and export that canvas. A capture copied from the editor canvas would inherit user layout, selected state, and device density.

The current stack can support this without changing renderer families: the material thumbnails already demonstrate an isolated `WebGLRenderer` and PNG canvas capture. The official Three.js API documents the current `WebGLRenderer` and `PerspectiveCamera` primitives that this design keeps using; no renderer migration is needed for the first precision-export pass. [Three.js renderer documentation](https://threejs.org/docs/#api/en/renderers/WebGLRenderer) and [camera documentation](https://threejs.org/docs/#api/en/cameras/PerspectiveCamera).

## Scene-freeze rules and enforceable bounds

An export begins only after a successful scene validation and captures its scene revision. It must then:

1. reject export while a transform drag is active, and reject it if the scene revision changes before all five files and the manifest are written;
2. instantiate content from that captured descriptor, with no selection, `TransformControls`, `BoxHelper`, room photo, UI DOM, or editor orbit state;
3. set water to its time-zero vertex state and disable its animation for the capture; keep the same declared lights, shadows, environment, material program, tone mapping, exposure, and background for every view;
4. derive every camera only from the captured `W/H/D` and the formulas above; use no content-aware framing; and
5. record image hashes only after all files finish, then present the completed five-image set as one export unit.

Use these bounds in product language and tests:

| Bound | Enforcement | Permitted interpretation |
| --- | --- | --- |
| Model coordinate serialization | Camera position/target and transforms round-trip within `0.000001 m` and rotations within `0.000001 rad`; descriptor hash must match. | Numerical consistency of the saved *model*. |
| Camera/view identity | Exact camera-config SHA-256 and dimensions; target/position must recompute from the formulas within the same numeric tolerances. | Each named image has the declared viewpoint. |
| Intra-runtime image repeatability | On the same browser, GPU, and app build, static repeat capture has RGB mean absolute error ≤ `1/255` and 99th percentile absolute channel error ≤ `3/255`; otherwise mark the capture failed. | A practical render-regression check, not cross-device image proof. |
| Cross-runtime comparison | Require matching manifest/scene/camera/render configuration hashes. Do **not** promise byte-identical PNGs or a pixel-difference tolerance across browsers/GPUs. | Configuration matches even when rasterization differs. |
| Physical dimensions, pose, optics, colour | `unknown`; no numerical error bound. | No centimetre accuracy, volume, lens, refraction, species-size, or colour-fidelity claim. |

The last row is material. A user-entered tank dimension makes the stored model use that value; it does not establish the size of its wood, rocks, plants, substrate profile, glass, camera, or photographed reference. The UI/export copy should say **“model dimensions”** whenever `tank.source` is `assumed`, and **“user-entered model dimensions; not independently calibrated”** when it is `user-entered`.

## Minimum realism work now

Implement these now because they improve what Fishy can truthfully share without pretending to solve missing input:

1. Add the isolated static export pass, fixed rig, manifest, and freeze/revision checks above.
2. Add a compact export legend: scene revision, model dimensions and source, five view IDs, `model-coordinates-only`, and a link/download for the manifest plus descriptor.
3. Make the export lighting explicit and constant, including the existing hemisphere/sun/fill, RoomEnvironment intensity, ACES exposure, PCF shadows, and dark studio background. Keep water frozen at `t=0` in exports.
4. Include optional object bounding-box dimensions from the *rendered procedural mesh* only when labelled “proxy bounds”; preserve the existing geometry containment checks as placement safety, not a physical-fit certificate.

Do not spend this pass on arbitrary photoreal tweaks. The existing procedural grain, mineral variation, sand, and refined leaves already offer useful visual legibility. More shader complexity cannot establish the geometry or optical evidence that is absent.

## Work that requires assets or calibration first

The following should be held behind evidence inputs rather than approximated in the precision claim:

- real specimen/asset meshes for the selected driftwood, rocks, and plant species, including their dimensions and scale reference;
- a tank survey: interior `W/H/D`, substrate profile, glass thickness, water level, and a scale object/known measurement;
- one or more original photos with camera focal length/sensor data or a calibration target, un-cropped source images, camera pose, and image-to-tank alignment;
- an optical model validated for glass thickness, water refractive index, lens distortion, lighting spectrum, and white balance; and
- an evaluation protocol with a held-out calibrated view and a stated uncertainty model before reporting geometry or centimetre error.

Even then, report separate errors for model fit, camera calibration, and optical rendering. Do not combine them into a single “real tank accuracy” number.

## Acceptance tests for the implementation owner

- Export the same saved revision twice, after resizing the editor from desktop to mobile dimensions and changing the orbit camera. Each export has the five required view IDs, 1600 × 1200 PNG files, and identical scene/camera/render configuration hashes; no output shows UI, helper, outline, or room photo.
- For a known tank, recompute all five camera position/target vectors from the manifest and verify the `1e-6 m` / `1e-6 rad` bounds. Project all eight interior tank corners and verify the 3% safe margin.
- Toggle water on/off and verify that each set is internally consistent, reports its water state, and that a water-on repeat uses the time-zero surface rather than wall-clock deformation.
- Change any object, tank dimension, background, lighting field, material-program version, camera formula, or scene revision during export. The operation must fail or produce a new export ID and new relevant hash; it must never silently mix views.
- Test a selected object and an active/attempted transform drag. Selection is absent from completed images; active drag blocks export.
- Render static repeats on one supported browser/GPU and enforce the stated image-difference limit. Run another supported runtime only as a configuration-compatibility test, not a pixel-identical test.
- Inspect manifest copy for both `assumed` and `user-entered` tanks. It must state model-only measurement status and avoid “to scale,” “accurate,” “measured,” or centimetre-error language unless the required calibration fields exist.

## Smallest safe edit surface

Add a dedicated export module plus tests; leave the interactive camera, orbit constraints, and material/geometry descriptor semantics intact. The most relevant existing seams are `site/components/fishy-viewport.tsx` (current render state and animated water), `site/lib/scene.ts` (authoritative descriptor/revision/units), `site/lib/geometry.ts` (rebuildable proxy meshes and bounds), and `site/lib/surface-materials.ts` (versioned procedural surface program). The thumbnail renderer is a useful isolated-render/canvas-export pattern, but it should not be reused as the five-view scene implementation without its own freeze metadata.
