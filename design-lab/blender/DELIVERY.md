# Fishy / Living arc delivery

Final assets: `runs/20260913-110819/`. Use `delivery-index.json` for exact absolute paths. Older runs remain preserved as visual iterations and are not the final delivery.

Three independently built procedural styles: 60×30×36 cm arch, 90×30×30 cm angular panorama, 45×45×45 cm radial stump. All have true leaf meshes and per-asset centered pivots. Native Blender scenes begin in material preview with the wood selected. The panorama uses `beauty-fixed.png` and `aquarium-camera-fixed.blend`: its original near camera clipped the studio floor below the tank, corrected by moving the orthographic camera farther away without changing composition. This fix is included in the builder for new runs. GLBs contain no camera and were unaffected.

| Scene | Objects | Triangles | Full GLB | Decor GLB |
|---|---:|---:|---:|---:|
| hero-60-arch | 73 | 161,256 | 3.594 MB | 3.481 MB |
| panorama-90-angular | 73 | 160,136 | 3.573 MB | 3.460 MB |
| cube-45-stump | 73 | 161,196 | 3.592 MB | 3.480 MB |

All three interior containment audits passed with zero overflow. Independent GLB checks passed: unique IDs, triangle counts, and exported world bounds agree with native audits within 1.5e-8 metres. `glb-verification.json` records the checks. Panorama wood was uniformly fitted to 0.929 of source size to respect available height; hero and cube retain requested scale 1.0. No per-axis wood distortion.

The labeled comparison is `comparison.png`. Use `hardscape.glb` if the web editor supplies its own tank shader; use `aquarium.glb` for a complete alpha-blended tank. The standard glTF export is Y-up metres; audits use Blender Z-up metres. Transform pivots are local per object, and IDs/categories are exported in glTF extras.

This is a polished **stylized original procedural concept**, not a scanned or photoreal aquarium. Native materials include procedural soil/sand/wood microtexture, while GLBs use portable constant PBR. Water and panes are lightly tinted translucent surfaces with subtle highlights: no filled volume, realistic caustics, hydrodynamics or biological simulation. The wood uses fine isotropic bump rather than directional bark. Leaf patches are real geometry; mobile LOD/instancing is future work. Rebuilding changes physical layout; stretching a loaded tank model is not equivalent to rebuilding dimensions.
