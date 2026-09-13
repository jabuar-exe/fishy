# Aquarium water research — browser editor options

Research date: 2026-09-13. This is a source-level review of the linked primary GitHub repositories and their current README/source files, not a benchmark.

## Decision first

For Fishy, make the *water surface, gentle movement, tint, lighting, and an inexpensive projected/animated caustic texture* the first release. That is the best visual return for an aquarium editor and avoids turning the editor into a multi-pass fluid renderer.

Use the official Three.js code as the compatibility baseline. If interactions need to create real ripples, borrow the **heightfield approach** from Evan Wallace's demo or implement a small, modern Three.js version; do not begin with volumetric fluid simulation. A fish tank does not need CFD to read as convincing water.

### What these terms mean

| Term | What it actually simulates | What it does *not* simulate |
| --- | --- | --- |
| Surface shader / normal-map flow | Moving highlights, Fresnel, apparent ripples and sometimes reflection/refraction | Water volume, displacement, fish wake physics |
| Heightfield ripple solver | One scalar surface height over a rectangle; disturbances spread across the top | Arbitrary 3D flow, splashes, bubbles, currents around coral |
| Caustics | Focused-light appearance projected/shaded onto sand, rocks and plants | Physical light transport through a moving water volume |
| Volumetric underwater rendering | Fog/absorption/light shafts along the camera ray | Fluid dynamics |
| 2D stable-fluid/dye solver | A 2D velocity/density field, often screen-space | 3D aquarium water or a free water surface |

In particular, [`artcodev/three-fluid-fx`](https://github.com/artcodev/three-fluid-fx) is explicitly a 2D Stable Fluids effect and its own README says it is not free-surface water or 3D volumetric fluid. It may be useful for a separate visual effect, but it is **not** a candidate for aquarium water.

## Ranked, source-verified shortlist

| Rank | Repository and license | Verified capabilities | Browser/editor constraints | Aquarium fit and estimated integration |
| --- | --- | --- | --- | --- |
| 1 | [`mrdoob/three.js`](https://github.com/mrdoob/three.js) — [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE) | The official repo provides [`Water.js`](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Water.js), [`Water2.js`](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Water2.js), and [`webgl_gpgpu_water.html`](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_gpgpu_water.html). `Water2` is an advanced planar effect with reflection, refraction and flow maps; the GPGPU demo is a GPU heightfield with mouse disturbances. The repo also contains current [`webgpu_water.html`](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_water.html) and [`webgpu_compute_water.html`](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_water.html). | `Water2` source explicitly says it requires `WebGLRenderer`; its `Reflector` and `Refractor` create extra render work. The WebGPU examples require WebGPU and the current TSL/WebGPU renderer, so they are not the broad browser fallback. The GPGPU demo is a surface-only heightfield, currently sized at 128². | **Best base.** Begin with a small plane/material or `Water2` only if the tank needs its planar reflection/refraction. Add a bounded heightfield later for click/fish surface impacts. **S (basic shader) / M (Water2) / M–L (interactive heightfield).** |
| 2 | [`evanw/webgl-water`](https://github.com/evanw/webgl-water) — **MIT stated in the source header; repository metadata has no LICENSE file** | The primary [`index.html`](https://github.com/evanw/webgl-water/blob/master/index.html) names ray-traced reflection/refraction, analytic ambient occlusion, a heightfield simulation, soft shadows, and caustics. It supports drawing ripples and moving a sphere through the surface. This is the classic all-in-one shallow-tank reference. | It is an older standalone LightGL/WebGL demo, not a Three.js package. The source requires `OES_texture_float` for the simulation and `OES_standard_derivatives` for caustics, and describes needing a decent GPU/up-to-date drivers. Port individual algorithms; do not embed the demo wholesale. The MIT statement is in the HTML comment, but absence of a top-level license file is a provenance wrinkle worth preserving in attribution records. | **Best visual/algorithm reference for a future interactive tank.** Its rectangular shallow-water model matches an aquarium better than ocean code. **L** to port cleanly into Fishy; **not** the release-one dependency. |
| 3 | [`martinRenou/threejs-caustics`](https://github.com/martinRenou/threejs-caustics) — [BSD-3-Clause](https://github.com/martinRenou/threejs-caustics/blob/master/LICENSE.txt) | A focused Three.js implementation of water-caustic computation. The repository has a [live demo](https://martinrenou.github.io/threejs-caustics/) plus GLSL shaders and explicitly describes itself as “Caustics computation using ThreeJS.” | This is a shader/demo rather than a maintained drop-in package. Caustics depend on the scene’s water geometry, light direction, receiver surfaces and render ordering; test it with Fishy’s glass, sand, plants, and transparency sorting. It adds appearance, not water mechanics. | **Best optional realism upgrade.** Use after the basic tank looks good, and keep a cheap animated projected caustic fallback for lower-end devices. **M.** |
| 4 | [`SeanWong17/RippleAquarium`](https://github.com/SeanWong17/RippleAquarium) — [AGPL-3.0](https://github.com/SeanWong17/RippleAquarium/blob/main/LICENSE) | A real browser Three.js aquarium: boid fish, interactive surface ripples, coral and a static deployment. Its [`water-surface.ts`](https://github.com/SeanWong17/RippleAquarium/blob/main/src/water-surface.ts) verifies a 384² ping-pong half-float heightfield with 24 batched impacts, displacement, normals, Fresnel/specular shading and fish-triggered disturbances. | Native ESM/static deployment, so the technology fit is excellent. However, AGPL-3.0 is a strong copyleft license: copying or modifying this code for a network-deployed editor requires releasing corresponding source under AGPL-compatible terms. Inspect upstream asset licences too; its README calls this out. | **Best direct aquarium architecture reference; do not copy into a non-AGPL Fishy build.** Reimplement the generic heightfield idea independently if needed. **M** for a clean-room feature. |
| 5 | [`achrefelouafi/WaterThreeJS`](https://github.com/achrefelouafi/WaterThreeJS) — [MIT](https://github.com/achrefelouafi/WaterThreeJS/blob/main/LICENSE) | A recent WebGL2/GLSL Three.js ocean with analytic Gerstner waves, screen-space reflection, depth-based refraction/absorption, underwater fog, caustics, volumetric light rays, floating objects and a documented multi-pass HDR pipeline. Its README specifically says it uses no WebGPU or compute shaders. | Its default surface is a 600×600 grid and the renderer runs HDR refraction, scene, cloud and post passes. Those choices target an explorable ocean, not a small editable tank; use components as visual references and scale down sharply. Screen-space effects also fail gracefully only for visible scene data. | **Strong reference for underwater look, weak first dependency.** Mine the color/absorption and caustic ideas later, not its entire pipeline. **L.** |
| 6 | [`norio/three-stylized-water`](https://github.com/norio/three-stylized-water) — [MIT](https://github.com/norio/three-stylized-water/blob/main/LICENSE) | A current Three.js r185 WebGPU + TSL port with depth color, Gerstner waves, normal-map blending, screen-space refraction, pseudo-projected caustics, foam and planar/environment reflections. The README documents a live demo and 30 fps idle / 60 fps interaction behavior. | It targets a current browser with WebGPU support and requires secure HTTPS; it also tracks a specific recent Three.js/TSL generation. That makes it an enhancement path, not the compatibility floor for a deployed editor. It is stylized and shore-oriented, so some features are not tank-relevant. | **Promising WebGPU enhancement path.** Revisit only once Fishy has WebGPU capability detection and a WebGL fallback. **L.** |

### Modern port to treat cautiously

[`BitOpenCode/webgl-water`](https://github.com/BitOpenCode/webgl-water) is an MIT-licensed, current-looking Vercel/Vite presentation of heightfield water, reflection, refraction and caustics. It could be a useful runnable comparison, but it presents essentially the Evan Wallace feature set. Prefer Evan’s original repository as the algorithm source unless a code audit establishes the fork’s provenance and added value.

### Intentionally not recommended as source code

[`Romaixn/threejs-tsl-water-shader`](https://github.com/Romaixn/threejs-tsl-water-shader) advertises procedural waves, Fresnel/environment reflection and a caustic effect, but GitHub currently reports no declared license. It is useful as a visual demo only until licensing is clarified.

## Recommended implementation tiers

### Basic — ship with the editor

1. Use one shallow rectangular water plane positioned just below the rim. Give it a transparent physical/custom material with slow dual-normal movement, depth/tint gradient, Fresnel edge highlight, and restrained specular highlight.
2. Add a subtle animated caustic cookie/material on the substrate and lower decor. It should be driven by light direction and water time, and disabled/reduced by the editor’s quality setting.
3. Preserve one source of truth for water level so fish placement, plants, tank bounds and optional interaction effects agree.

This is **appearance-only** water, but it is what makes a small aquarium read instantly. It is cheap, compatible with ordinary Three.js WebGL deployments, and should remain the fallback even if richer modes land later. Base the renderer on the official Three.js material/Water concepts, rather than importing a heavy demo.

### Ambitious — opt-in interactive surface

Add a 128–256² GPU heightfield ping-pong render target over the tank rectangle. Feed disturbances from editor clicks, net/hand tools, and only the few fish that approach the waterline; use its gradients for vertex displacement and normals. Evan Wallace, the official `webgl_gpgpu_water` demo, and RippleAquarium all demonstrate this exact *surface* model.

Pair it with either a lightweight projected caustic texture or Martin Renou’s caustic approach after profiling. Keep the simulation resolution bounded by the tank’s on-screen area and pause/throttle it while the editor is idle. This creates real spreading ripples, but still does not model 3D flow around rocks or fish.

### Later — high-end WebGPU/underwater mode

Add a WebGPU-only quality tier that borrows from Three.js `WaterMesh`/compute-water and the Norio TSL port: screen/depth-aware refraction, better reflections, pseudo-projected caustics, fog/absorption and perhaps a local compute surface. Gate it by runtime support, HTTPS, device performance, and quality settings; retain the Basic WebGL plane as fallback.

Do not schedule full 3D FLIP/SPH/volumetric fluid dynamics for the aquarium editor. It is expensive, hard to make editable and stable, and little of its cost improves the user’s ordinary tank composition view.

## Actual 3D fluid dynamics — verified, but not a Fishy runtime dependency

These are genuine physical fluid simulators rather than water shaders or 2D dye effects. They are relevant if Fishy later needs **offline-baked** splash, pour, or current reference data. They are not browser-ready Three.js water renderers, and neither validates biological behaviour such as fish locomotion, stress, or aquarium ecology.

| Repository and licence | Actual simulation capability | Deployment fit and recommendation |
| --- | --- | --- |
| [`InteractiveComputerGraphics/SPlisHSPlasH`](https://github.com/InteractiveComputerGraphics/SPlisHSPlasH) — [MIT](https://github.com/InteractiveComputerGraphics/SPlisHSPlasH/blob/master/LICENSE) | A C++/Python **2D and 3D Smoothed Particle Hydrodynamics (SPH)** library. Its primary README verifies multiple incompressible pressure solvers (including WCSPH, PCISPH, PBF, IISPH and DFSPH), viscosity, surface tension, vorticity, multiphase simulation, rigid/deformable-fluid coupling, and particle/VTK export. It can generate foam/bubble/spray particles as a post-process. | This is an offline/native research and asset pipeline, built with CMake and optional Python bindings, not a WebGL/WebGPU editor dependency. Its particle output could inform a rendered sequence or a one-off art reference, but would still need meshing, material/optics and a browser playback strategy. **Do not add it to Fishy; optics-first remains the right runtime choice.** |
| [`thunil/mantaflow`](https://github.com/thunil/mantaflow) — [Apache-2.0](https://github.com/thunil/mantaflow/blob/master/LICENSE) | A parallel C++ fluid-simulation research framework with Python scene definitions and plugins. It is the appropriate family of **grid-based Eulerian/FLIP-style** tooling for volumetric liquid/smoke research; its primary README positions it as a framework for prototyping computer-graphics fluid algorithms. | This is likewise offline/native research software, not a Three.js package or browser optics solution. It can be a reference for a future baked liquid sequence, but it does not give Fishy a deployable tank surface, caustics, refraction, or biologically credible fish-water interaction. **Do not integrate it into the editor.** |

The practical boundary is: SPH/FLIP can compute matter motion; surface shaders, refraction and caustics make a browser aquarium look like water. For Fishy’s editor, the latter should ship first, with a small heightfield only when interactive ripples justify it.

## Optional Blender reference, not a browser dependency

Use Blender’s [official source](https://github.com/blender/blender) and its ocean/fluid systems only to author still reference frames, normal/caustic textures, or visual direction. Blender is GPL (the repository’s [`COPYING`](https://github.com/blender/blender/blob/main/COPYING) says it is not available under another licence), and its modifiers/simulation do not run in Three.js. Export baked assets with clearly documented asset licences; do not try to embed Blender’s simulator in Fishy.

## Primary sources checked

- [`mrdoob/three.js` repository](https://github.com/mrdoob/three.js), [`Water2.js` source](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Water2.js), [`webgl_gpgpu_water.html` source](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_gpgpu_water.html), and [`webgpu_water.html` source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_water.html)
- [`evanw/webgl-water` repository](https://github.com/evanw/webgl-water) and [its primary demo source](https://github.com/evanw/webgl-water/blob/master/index.html)
- [`martinRenou/threejs-caustics` repository](https://github.com/martinRenou/threejs-caustics)
- [`SeanWong17/RippleAquarium` repository](https://github.com/SeanWong17/RippleAquarium) and [`water-surface.ts`](https://github.com/SeanWong17/RippleAquarium/blob/main/src/water-surface.ts)
- [`achrefelouafi/WaterThreeJS` repository](https://github.com/achrefelouafi/WaterThreeJS)
- [`norio/three-stylized-water` repository](https://github.com/norio/three-stylized-water)
- [`artcodev/three-fluid-fx` repository](https://github.com/artcodev/three-fluid-fx) (reviewed to exclude it as a 2D-only fluid effect)
- [`InteractiveComputerGraphics/SPlisHSPlasH` repository](https://github.com/InteractiveComputerGraphics/SPlisHSPlasH) and [MIT licence](https://github.com/InteractiveComputerGraphics/SPlisHSPlasH/blob/master/LICENSE)
- [`thunil/mantaflow` repository](https://github.com/thunil/mantaflow) and [Apache-2.0 licence](https://github.com/thunil/mantaflow/blob/master/LICENSE)
