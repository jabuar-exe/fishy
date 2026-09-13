"""Render one recipe using a frozen, isolated native evaluation series.

Run only in a fresh background Blender process. No model call is made here::

    blender --background --factory-startup --python-exit-code 1 \
      --python blender/render_heldout.py -- --root /absolute/evaluation/root \
      --series series.json --recipe recipes/rev0.json --revision 0 --output-dir rev0

strict_test additionally requires --sequence finalized-sequence.json. Camera
placement is explicit, never fitted to the recipe or adjusted after a score.
"""
from __future__ import annotations

import argparse
from pathlib import Path
import sys

import bpy
from mathutils import Vector

SOURCE_ROOT = Path(__file__).resolve().parent
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

import build_recipe
from heldout_evaluation import (EvaluationError, confined_path, file_hash, load_series,
                                read_json, require_sequence_seal, validate_sequence, write_new_json)


def configure_camera(scene, camera):
    data = bpy.data.cameras.new("Frozen evaluation camera")
    obj = bpy.data.objects.new("Frozen evaluation camera", data)
    scene.collection.objects.link(obj)
    obj.location = camera["positionM"]
    obj.rotation_euler = (Vector(camera["targetM"]) - obj.location).to_track_quat("-Z", "Y").to_euler()
    data.type = "PERSP" if camera["projection"] == "perspective" else "ORTHO"
    data.lens = camera["lensMm"]
    data.sensor_width = camera["sensorWidthMm"]
    data.sensor_fit = "HORIZONTAL"
    data.ortho_scale = camera["orthoScaleM"]
    data.shift_x, data.shift_y = camera["shiftX"], camera["shiftY"]
    data.clip_start, data.clip_end = .0001, 10000
    scene.camera = obj
    scene.render.resolution_x, scene.render.resolution_y = camera["resolution"]
    scene.render.resolution_percentage = 100
    scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1
    return obj


def configure_renderer(scene):
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.render.dither_intensity = 0
    scene.display.render_aa = "OFF"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    shading = scene.display.shading
    shading.show_shadows = False
    shading.show_cavity = False
    shading.show_object_outline = False
    shading.show_xray = False
    shading.show_specular_highlight = False
    shading.background_type = "WORLD"


def configure_visibility(scene):
    """Keep plants/substrate as occluders; exclude glass/rims/studio entirely."""
    hardscape = []
    ids = set()
    for obj in scene.objects:
        if obj.type != "MESH":
            continue
        object_id = obj.get("tank_id")
        is_recipe = bool(object_id and obj.get("fishy_recipe_asset"))
        is_substrate = obj.name == "Recipe substrate"
        obj.hide_render = not (is_recipe or is_substrate)
        if is_recipe:
            if object_id in ids:
                raise EvaluationError("Duplicate native object identity")
            ids.add(object_id)
        if is_recipe and obj.get("fishy_kind") in ("rock", "wood"):
            hardscape.append(obj)
    return sorted(hardscape, key=lambda item: item["tank_id"])


def render(scene, path):
    if path.exists():
        raise FileExistsError("Refusing to overwrite render")
    scene.render.filepath = str(path)
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)


def run(root, series_path, recipe_path, revision, output_dir, sequence_path=None):
    root = Path(root).resolve(strict=True)
    series = load_series(root, series_path)
    recipe = confined_path(root, recipe_path)
    recipe_hash = file_hash(recipe)
    if type(revision) is not int or not 0 <= revision <= 1_000_000:
        raise EvaluationError("Invalid revision")
    sequence = read_json(confined_path(root, sequence_path)) if sequence_path else None
    require_sequence_seal(root, series, sequence)
    sequence_hash = validate_sequence(series, sequence, revision, recipe_hash)
    if series["renderer"]["version"] != bpy.app.version_string:
        raise EvaluationError("Blender version differs from the frozen renderer")
    output = confined_path(root, output_dir, must_exist=False)
    if output.exists():
        raise FileExistsError("Use a fresh output directory; existing runs are immutable")
    output.mkdir(parents=True, exist_ok=False)
    # Build the same native procedural geometry as ordinary runs. Its aesthetic
    # preview camera is replaced below, never used for evaluation.
    original_argv = sys.argv
    try:
        sys.argv = [str(SOURCE_ROOT / "build_recipe.py"), "--", "--recipe", str(recipe),
                    "--output", str(output / "scene.blend")]
        build_recipe.main()
    finally:
        sys.argv = original_argv
    scene = bpy.context.scene
    if file_hash(recipe) != recipe_hash or scene.get("fishy_recipe_sha256") != recipe_hash:
        raise EvaluationError("Recipe changed while the native scene was being built")
    configure_camera(scene, series["camera"])
    configure_renderer(scene)
    hardscape = configure_visibility(scene)
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.light = "STUDIO"
    scene.world.color = (.1, .1, .1)
    render_path = output / "render.png"
    render(scene, render_path)
    # This pass assigns colors from native stable object IDs, never thresholds
    # natural material colors. Black plants/substrate retain depth occlusion.
    scene.display.shading.color_type = "OBJECT"
    scene.display.shading.light = "FLAT"
    scene.world.color = (0, 0, 0)
    foreground = {obj.name for obj in hardscape}
    for obj in scene.objects:
        obj.color = (1, 1, 1, 1) if obj.name in foreground else (0, 0, 0, 1)
    mask_path = output / "hardscape-mask.png"
    render(scene, mask_path)
    # Retain the actual evaluation camera and ID pass for independent inspection.
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "evaluation.blend"), check_existing=True)
    # Fail closed if another process changed any frozen input or builder source
    # during rendering. Partial outputs remain diagnostic, without a valid report.
    load_series(root, series_path)
    if file_hash(recipe) != recipe_hash:
        raise EvaluationError("Recipe changed during evaluation rendering")
    def record(path):
        return {"path": str(path.relative_to(root)), "sha256": file_hash(path)}
    report = {"schemaVersion": "fishy.heldout.render.v1", "seriesHash": series["seriesHash"],
              "revision": revision, "recipe": record(recipe), "builderHash": series["builderHash"],
              "cameraHash": series["cameraHash"], "renderer": series["renderer"],
              "render": record(render_path), "mask": record(mask_path),
              "hardscapeIds": [obj["tank_id"] for obj in hardscape], "sequenceHash": sequence_hash}
    write_new_json(output / "render-report.json", report)
    print("FISHY_HELDOUT_RENDER_REPORT=" + str(output / "render-report.json"))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--series", required=True)
    parser.add_argument("--recipe", required=True)
    parser.add_argument("--revision", type=int, required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--sequence")
    tail = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    options = parser.parse_args(tail)
    run(options.root, options.series, options.recipe, options.revision, options.output_dir, options.sequence)


if __name__ == "__main__":
    main()
