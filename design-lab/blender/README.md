# Living arc — original Fishy procedural aquarium

`build_showcase.py` creates editable native Blender scenes, standard GLBs, a render, and a machine-readable physical audit. The geometry is authored procedurally here; no reference photographs, scans, external models or textures are included.

## Reproduce

```sh
/Users/joshuabanzon/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python design-lab/blender/build_showcase.py -- \
  --suite --samples 20 --resolution 1200
```

A new timestamped `runs/` directory is created. An existing output directory is rejected so previous deliveries are preserved. `--output /absolute/new/run-directory` chooses a fresh destination.

Custom tank:

```sh
/Users/joshuabanzon/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python design-lab/blender/build_showcase.py -- \
  --width .75 --depth .35 --height .40 \
  --wood-style arch --wood-scale 1.1 \
  --plant-category mixed --plant-height .16 --plant-density 1.2 \
  --water-quality rippled --samples 24 --resolution 1100
```

Dimensions and plant height are metres. Wood styles: `arch`, `stump`, `angular`. Plant categories: `mixed`, `grass`, `fern`, `stem`; density 0–3; wood scale >0–3. Water modes: `off`, `simple`, `rippled`. `--seed` controls reproducible variation. Config is recorded in every audit. Very small tanks (<15cm on any axis) are rejected.

## Asset contract

- `aquarium.blend`: editable mesh objects, original procedural material nodes, separate glass panels and water surface, studio lights and camera. Rebuild parameters with the Python CLI; the saved mesh scene does not have live Geometry Nodes controls.
- `aquarium.glb`: complete portable tank, including thin translucent PBR glass and water. The final delivery deliberately avoids a filled refractive volume so decor remains legible. A viewer must support glTF alpha blending.
- `hardscape.glb`: decor/substrate/plants only; use when the website renders its own glass/water. This also avoids multiple transparency layers in basic viewers.
- `beauty.png`: Cycles studio preview. This is not a screenshot of WebGL rendering.
- `audit.json`: dimensions, triangle/object counts, byte sizes, physical bounds per interior object, and fitting notes.
- `manifest.json`: the suite's combined audits.

Each exported object has a stable readable name, `fishy_id` and `fishy_kind` in glTF extras. Every decor asset has its own centered transform pivot for rotation/scaling and movement. The native file starts in material preview with the wood selected. Wood has requested and fitted uniform scale; plant patches have category/height/normalized anchor metadata. IDs are stable for a fixed seed/config and predictable across aspect-ratio changes; changing density/category can change the set of plant IDs. Patches are single selectable objects; leaves remain individually editable mesh islands inside the patch. Materials export as simple constant PBR; procedural microtexture is retained in native Blender, not baked into the web asset.

Blender uses **Z up and metres**. Blender's official glTF exporter is called with `export_yup=True`, so exported glTF uses standard **Y up** and metres. Do not apply an additional ad hoc axis rotation or centimetre scale when loading in Three.js.

## Resize behavior

Tank panes and substrate regenerate for the requested dimensions. Plant anchors and stone cluster centers re-layout in normalized tank coordinates. Nominal plant/rock sizes are physical and capped to available space. Wood is generated in source metres, then **uniformly** scaled only when needed to fit 86% width / 82% depth / available height; no per-axis wood stretching is used. A requested scale that does not fit is explicitly reduced and reported. Every interior object's actual world bounding box is checked against the tank before any render or export; overflow fails the run. Changing only dimensions in an already exported GLB is not equivalent to rebuilding the layout: use the builder or replicate its layout rules in the website.

## Honest limits

These are original procedural style variations, not botanical scans or exact species models. The arch is a swept tapering branch mesh with overlapping joints; the stump and angular branch are deliberately different silhouettes. The water is a thin rippled optical surface with subtle specular highlights, **not hydrodynamics, biology, or simulated volume**. No physically validated caustic solver is supplied. Cycles alpha transparency, denoising and studio lighting will differ from a browser render. Dense leaf geometry is appropriate for a showcase, but a production mobile experience should use instancing or LODs. Bounds validation is containment, not a full inter-object collision or biological growth analysis.

## Comparison and independent export checks

After the suite finishes, run:

```sh
python3 design-lab/blender/make_comparison.py /absolute/run-directory
python3 design-lab/blender/verify_glb.py /absolute/run-directory
```

The comparison assembler requires Pillow and uses the macOS Helvetica font. The validator uses only the Python standard library and checks GLB headers, unique IDs, triangle counts and actual glTF world-space position-accessor bounds against the Blender audit, converting Y-up back to Z-up. The target numerical tolerance is 0.00001 m.
