"""Build a fresh, editable Blender aquarium from a validated Fishy recipe.

Run in an isolated process, never inside an existing user session::

    blender --background --factory-startup --python-exit-code 1 \
      --python build_recipe.py -- --recipe recipe.json --output aquarium.blend \
      --render-dir previews

Recipes describe approximate asset envelopes, not exact natural-object meshes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import build_scene as helpers
import fishy_controls as controls
from scene_recipe import load_recipe, recipe_bounds
import native_snapshot


SOURCE_LABEL = "Recipe-generated editable approximation"
RECIPE_TEXT = "FISHY_RECIPE.json"
PROVENANCE_TEXT = "FISHY_PROVENANCE.json"
EDITABLE_COLLECTION = "02 · Recipe aquascape"
TOLERANCE_M = 1e-6
ASSET_KINDS = {"rock": "rock", "branchwood": "wood", "grass": "plant", "bush": "plant"}


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recipe", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--render-dir", type=Path)
    parser.add_argument("--provenance", type=Path, help="Optional trusted local run manifest to preserve verbatim as JSON.")
    parser.add_argument("--native-snapshot", type=Path, help="Validated current-scene copy supplying protected native objects")
    tail = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(tail)


def checked_paths(options):
    output = options.output.expanduser().resolve()
    if output.suffix.lower() != ".blend":
        raise ValueError("--output must end in .blend")
    render_dir = options.render_dir.expanduser().resolve() if options.render_dir else None
    report = render_dir / "build-report.json" if render_dir else output.with_name(output.stem + ".build-report.json")
    targets = [output, report]
    if render_dir:
        targets += [render_dir / "front.png", render_dir / "overview.png"]
    for target in targets:
        if target.exists():
            raise FileExistsError(f"Refusing to overwrite an existing output: {target}")
    return output, render_dir, report


def fit_asset(obj, item):
    """Fit real base mesh vertices, then apply yaw about the base-center origin."""
    vertices = obj.data.vertices
    lower = [min(vertex.co[axis] for vertex in vertices) for axis in range(3)]
    upper = [max(vertex.co[axis] for vertex in vertices) for axis in range(3)]
    extent = [upper[axis] - lower[axis] for axis in range(3)]
    if any(value <= 0 for value in extent):
        raise ValueError(f"Generated asset {item['id']} has a degenerate geometry envelope.")
    for vertex in vertices:
        for axis in range(3):
            offset = item["size_m"][axis] / 2 if axis < 2 else 0.0
            vertex.co[axis] = (vertex.co[axis] - lower[axis]) / extent[axis] * item["size_m"][axis] - offset
    obj.data.update()
    obj.location = item["position_m"]
    obj.rotation_mode = "XYZ"
    obj.rotation_euler = (0.0, 0.0, math.radians(item["yaw_deg"]))
    obj.scale = (1.0, 1.0, 1.0)
    obj.name = item["label"]
    obj["tank_id"] = item["id"]
    obj["fishy_kind"] = ASSET_KINDS[item["asset"]]
    obj["geometry_source"] = "Procedural asset fitted to recipe envelope"
    obj["fishy_recipe_asset"] = item["asset"]
    obj["fishy_recipe_seed"] = item["seed"]
    obj["fishy_recipe_item_json"] = json.dumps(item, ensure_ascii=False, sort_keys=True)
    obj.lock_location = (False, False, True)
    obj.lock_rotation = (True, True, False)
    return obj


def create_rock(item, collection, materials):
    rng = random.Random(item["seed"])
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
    obj = bpy.context.object
    obj.name = item["label"]
    for vertex in obj.data.vertices:
        vertex.co *= rng.uniform(0.82, 1.12)
    for material in materials:
        obj.data.materials.append(material)
    for face in obj.data.polygons:
        face.material_index = rng.randrange(len(materials)) if rng.random() < 0.3 else 0
    helpers.move_to_collection(obj, collection)
    return obj


def create_branchwood(item, collection, material):
    rng = random.Random(item["seed"])
    segments = [
        ((-0.42, 0.00, 0.03), (-0.12, 0.02, 0.28), 0.095, 0.072),
        ((-0.12, 0.02, 0.28), (0.16, 0.04, 0.62), 0.072, 0.045),
        ((0.16, 0.04, 0.62), (0.45, 0.01, 1.00), 0.045, 0.008),
        ((-0.14, 0.02, 0.27), (-0.30, 0.25, 0.65), 0.055, 0.021),
        ((-0.30, 0.25, 0.65), (-0.42, 0.32, 0.88), 0.021, 0.005),
        ((0.10, 0.03, 0.56), (0.27, -0.28, 0.81), 0.035, 0.005),
        ((-0.40, 0.00, 0.05), (-0.53, -0.30, 0.00), 0.055, 0.010),
        ((-0.36, 0.01, 0.08), (-0.12, 0.25, 0.01), 0.055, 0.010),
    ]
    parts = []
    anchors = {}
    for start, end, _, _ in segments:
        for anchor in (start, end):
            if anchor not in anchors:
                anchors[anchor] = tuple(value + rng.uniform(-0.025, 0.025) for value in anchor)
    for index, (start, end, radius_start, radius_end) in enumerate(segments):
        parts.append(helpers.segment(f"Branch {index}", anchors[start], anchors[end], radius_start, radius_end, material, collection, 12))
    return helpers.join_parts(parts, item["label"], item["id"], "wood")


def create_bush(item, collection, materials):
    rng = random.Random(item["seed"])
    vertices, faces = [], []
    stems = []
    for index in range(18):
        angle = rng.uniform(0, math.tau)
        radial = Vector((math.cos(angle), math.sin(angle), 0))
        side = Vector((-math.sin(angle), math.cos(angle), 0))
        height = rng.uniform(0.32, 0.9)
        start = radial * rng.uniform(0.10, 0.34) + Vector((0, 0, height * 0.6))
        direction = (radial * rng.uniform(0.45, 0.9) + Vector((0, 0, rng.uniform(0.3, 0.8)))).normalized()
        length = rng.uniform(0.27, 0.48)
        width = rng.uniform(0.065, 0.12)
        first = len(vertices)
        for row in range(7):
            t = row / 6
            center = start + direction * length * t + Vector((0, 0, math.sin(math.pi * t) * 0.025))
            halfwidth = math.sin(math.pi * t) * width + 0.0002
            vertices.extend([tuple(center - side * halfwidth), tuple(center + side * halfwidth)])
        for row in range(6):
            base = first + row * 2
            faces.append((base, base + 1, base + 3, base + 2))
        stems.append(helpers.segment(f"Stem {index}", (0, 0, 0), start, 0.009, 0.004, materials[0], collection, 7))
    mesh = bpy.data.meshes.new(item["label"] + " broad leaves")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    leaves = bpy.data.objects.new(item["label"] + " leaves", mesh)
    collection.objects.link(leaves)
    for material in materials:
        mesh.materials.append(material)
    for index, face in enumerate(mesh.polygons):
        face.material_index = (index // 6) % len(materials)
        face.use_smooth = True
    return helpers.join_parts([leaves, *stems], item["label"], item["id"], "plant")


def create_asset(item, collection, materials):
    if item["asset"] == "rock":
        obj = create_rock(item, collection, materials["stone"])
    elif item["asset"] == "branchwood":
        obj = create_branchwood(item, collection, materials["wood"])
    elif item["asset"] == "grass":
        obj = helpers.plant(item["label"], (0, 0, 0), item["seed"], 25, 1.0, collection, materials["leaves"], item["id"])
    elif item["asset"] == "bush":
        obj = create_bush(item, collection, materials["leaves"])
    else:
        raise ValueError(f"Unsupported asset: {item['asset']}")
    return fit_asset(obj, item)


def create_tank(tank, fixed, studio, materials):
    w, d, h = tank["width_m"], tank["depth_m"], tank["height_m"]
    substrate = tank["substrate_depth_m"]
    edge_radius = min(w, d, h) * 0.003
    if substrate > 0:
        helpers.cube("Recipe substrate", (w / 2, d / 2, substrate / 2), (w, d, substrate), materials["sand"], fixed)
    helpers.cube("Tank pedestal", (w / 2, d / 2, -h * 0.024), (w * 1.035, d * 1.045, h * 0.045), materials["base"], fixed)
    thickness = max(edge_radius, 0.0004)
    for name, position, size in (
        ("Front glass", (w / 2, -thickness / 2, h / 2), (w, thickness, h)),
        ("Back glass", (w / 2, d + thickness / 2, h / 2), (w, thickness, h)),
        ("Left glass", (-thickness / 2, d / 2, h / 2), (thickness, d, h)),
        ("Right glass", (w + thickness / 2, d / 2, h / 2), (thickness, d, h)),
    ):
        glass = helpers.cube(name, position, size, materials["rim"], fixed)
        glass.display_type = "WIRE"
        glass.hide_render = True
    for x in (0, w):
        for y in (0, d):
            helpers.segment("Tank corner", (x, y, 0), (x, y, h), edge_radius, edge_radius, materials["rim"], fixed, 8)
    for z in (0, h):
        for y in (0, d):
            helpers.segment("Tank width rim", (0, y, z), (w, y, z), edge_radius, edge_radius, materials["rim"], fixed, 8)
        for x in (0, w):
            helpers.segment("Tank depth rim", (x, 0, z), (x, d, z), edge_radius, edge_radius, materials["rim"], fixed, 8)
    max_dimension = max(w, d, h)
    floor = helpers.cube("Studio floor", (w / 2, d / 2, -h * 0.055), (max_dimension * 200, max_dimension * 200, h * 0.01), materials["floor"], studio)
    floor.hide_set(True)


def fit_camera(camera, tank, direction, aspect):
    w, d, h = tank["width_m"], tank["depth_m"], tank["height_m"]
    focus = Vector((w / 2, d / 2, h * 0.48))
    camera.location = focus + Vector(direction).normalized() * max(w, d, h) * 4
    camera.rotation_euler = (focus - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.clip_start, camera.data.clip_end = 0.001, max(w, d, h) * 100
    rotation = camera.rotation_euler.to_matrix().transposed()
    corners = [rotation @ (Vector((x, y, z)) - focus) for x in (0, w) for y in (0, d) for z in (-h * 0.05, h)]
    horizontal = max(corner.x for corner in corners) - min(corner.x for corner in corners)
    vertical = max(corner.y for corner in corners) - min(corner.y for corner in corners)
    camera.data.ortho_scale = max(horizontal, vertical * aspect) * 1.17
    return focus


def configure_viewport(camera, focus, tank):
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type != "VIEW_3D":
                continue
            space = area.spaces.active
            space.show_region_ui = True
            space.show_region_toolbar = True
            space.show_gizmo = True
            space.show_gizmo_object_translate = True
            space.overlay.show_floor = False
            space.overlay.show_axis_x = False
            space.overlay.show_axis_y = False
            space.clip_start, space.clip_end = 0.001, max(tank.values()) * 100
            space.shading.type = "SOLID"
            space.shading.color_type = "MATERIAL"
            space.shading.light = "STUDIO"
            space.shading.show_shadows = False
            space.shading.show_cavity = True
            space.shading.cavity_type = "BOTH"
            space.shading.background_type = "WORLD"
            region = space.region_3d
            region.view_location = focus
            region.view_distance = max(tank["width_m"], tank["depth_m"], tank["height_m"]) * 1.95
            region.view_rotation = (camera.location - focus).to_track_quat("Z", "Y")
            region.view_perspective = "PERSP"
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == "VIEW_3D":
                with bpy.context.temp_override(window=window, area=area):
                    bpy.ops.wm.tool_set_by_id(name="builtin.move")


def check_built_geometry(recipe):
    snapshot = controls.scene_snapshot(bpy.context)
    expected_ids = {item["id"] for item in recipe["objects"]}
    if {item["id"] for item in snapshot["objects"]} != expected_ids:
        raise RuntimeError("Built object IDs do not match the recipe.")
    reports = []
    for item in recipe["objects"]:
        actual = next(record for record in snapshot["objects"] if record["id"] == item["id"])
        expected = recipe_bounds(item)
        error = max(abs(actual["bounds"][edge][axis] - expected[edge][axis]) for edge in ("min_m", "max_m") for axis in range(3))
        if error > TOLERANCE_M:
            raise RuntimeError(f"{item['id']}: built envelope differs from the recipe by {error:g} m.")
        if actual["crossed_boundaries"]:
            raise RuntimeError(f"{item['id']}: built bounds cross tank walls: {actual['crossed_boundaries']}")
        reports.append({
            "id": item["id"],
            "asset": item["asset"],
            "actual_world_bounds_m": actual["bounds"],
            "recipe_world_envelope_m": expected,
            "maximum_envelope_error_m": error,
        })
    return reports


def preserve_native_objects(snapshot_path, editable, built):
    from frontier_contract import load_json
    snapshot = native_snapshot.validate_snapshot(load_json(snapshot_path))
    root = snapshot_path.resolve().parent
    relative = snapshot["blendPath"]
    source = (root / relative).resolve()
    if Path(relative).is_absolute() or not source.is_relative_to(root):
        raise ValueError("Native snapshot blend path escapes its directory")
    if hashlib.sha256(source.read_bytes()).hexdigest() != snapshot["blendHash"]:
        raise ValueError("Native snapshot Blender file hash mismatch")
    records = [item for item in snapshot["objects"] if item["id"] in snapshot["protectedIds"]]
    names = [item["name"] for item in records]
    with bpy.data.libraries.load(str(source), link=False) as (available, loaded):
        if any(name not in available.objects for name in names):
            raise ValueError("Protected native objects are absent from the saved copy")
        loaded.objects = names
    protected_report = []
    for record, obj in zip(records, loaded.objects):
        if obj is None or obj.get("tank_id") != record["id"] or native_snapshot.mesh_digest(obj) != record["meshHash"]:
            raise ValueError("Protected native mesh identity/digest mismatch")
        original = next(candidate for candidate in built if candidate["tank_id"] == record["id"])
        index = built.index(original)
        bpy.data.objects.remove(original, do_unlink=True)
        editable.objects.link(obj)
        # The saved native object already carries its exact TRS properties.
        # Reassigning matrix_world would decompose/recompose them and introduce
        # float32 drift after reload, even for this supported yaw-only adapter.
        bpy.context.view_layer.update()
        obj[native_snapshot.PROTECTED] = True
        obj[native_snapshot.BASELINE] = native_snapshot.object_state_hash(obj)
        built[index] = obj
        error = max(abs(obj.matrix_world[row][col] - record["matrix"][row][col]) for row in range(4) for col in range(4))
        if error > 1e-7:
            raise ValueError("Protected native matrix was not preserved")
        protected_report.append({"id": record["id"], "meshHash": native_snapshot.mesh_digest(obj), "matrixMaxError": error, "preservedFromCurrentUnsavedScene": True})
    return protected_report


def main():
    options = arguments()
    recipe_path = options.recipe.expanduser().resolve()
    recipe = load_recipe(recipe_path)
    output, render_dir, report_path = checked_paths(options)
    provenance = None
    if options.provenance:
        provenance_path = options.provenance.expanduser().resolve()
        provenance = json.loads(provenance_path.read_text(encoding="utf-8"))
        if not isinstance(provenance, dict):
            raise ValueError("The supplied provenance manifest must be a JSON object.")
    # The fresh factory scene is used only inside this separate Blender process.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = recipe["title"]
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "CENTIMETERS"
    for dimension in ("width", "depth", "height"):
        scene[f"fishy_{dimension}_m"] = recipe["tank"][f"{dimension}_m"]
    scene["fishy_substrate_depth_m"] = recipe["tank"]["substrate_depth_m"]
    scene["fishy_scene_source"] = SOURCE_LABEL
    scene["fishy_recipe_schema"] = recipe["schema_version"]
    scene["fishy_recipe_path"] = str(recipe_path)
    scene["fishy_recipe_sha256"] = hashlib.sha256(recipe_path.read_bytes()).hexdigest()
    scene["fishy_interpretation"] = recipe["interpretation"]
    scene["fishy_assumptions_json"] = json.dumps(recipe["assumptions"], ensure_ascii=False)
    bpy.data.texts.new(RECIPE_TEXT).write(json.dumps(recipe, ensure_ascii=False, indent=2) + "\n")
    if provenance is not None:
        bpy.data.texts.new(PROVENANCE_TEXT).write(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n")
        scene["fishy_provenance_path"] = str(provenance_path)
        scene["fishy_provenance_sha256"] = hashlib.sha256(provenance_path.read_bytes()).hexdigest()
    fixed = bpy.data.collections.new("01 · Recipe tank")
    editable = bpy.data.collections.new(EDITABLE_COLLECTION)
    studio = bpy.data.collections.new("03 · Recipe studio")
    for collection in (fixed, editable, studio):
        scene.collection.children.link(collection)
    materials = {
        "sand": helpers.material("Warm sand", (0.53, 0.43, 0.28)),
        "wood": helpers.material("Brown driftwood", (0.20, 0.095, 0.038)),
        "stone": [helpers.material("Grey stone", (0.25, 0.29, 0.27)), helpers.material("Stone light facets", (0.32, 0.35, 0.32)), helpers.material("Stone dark facets", (0.20, 0.23, 0.21))],
        "leaves": [helpers.material("Forest leaves", (0.055, 0.23, 0.075)), helpers.material("Fresh leaves", (0.15, 0.37, 0.075)), helpers.material("Olive leaves", (0.20, 0.31, 0.075))],
        "rim": helpers.material("Aquarium rim", (0.25, 0.42, 0.37)),
        "base": helpers.material("Charcoal base", (0.045, 0.065, 0.055)),
        "floor": helpers.material("Neutral studio floor", (0.61, 0.65, 0.62)),
    }
    create_tank(recipe["tank"], fixed, studio, materials)
    built = [create_asset(item, editable, materials) for item in recipe["objects"]]
    bpy.context.view_layer.update()
    for obj in built:
        native_snapshot.initialize_object(obj)
    protected_report = preserve_native_objects(options.native_snapshot, editable, built) if options.native_snapshot else []
    frontier = (provenance or {}).get("frontier")
    if frontier:
        scene["fishy_scene_id"] = frontier["sceneId"]
        scene["fishy_revision"] = frontier["revision"]
        scene["fishy_frontier_json"] = json.dumps(frontier, ensure_ascii=False)
        for obj in built:
            obj[native_snapshot.PROTECTED] = obj["tank_id"] in frontier["protection"]["protectedIds"]
    world = bpy.data.worlds.new("Fishy studio world")
    world.color = (0.10, 0.13, 0.115)
    scene.world = world
    camera_data = bpy.data.cameras.new("Recipe overview camera")
    camera = bpy.data.objects.new("Recipe overview camera", camera_data)
    studio.objects.link(camera)
    scene.camera = camera
    light_data = bpy.data.lights.new("Recipe softbox", "AREA")
    light = bpy.data.objects.new("Recipe softbox", light_data)
    studio.objects.link(light)
    w, d, h = (recipe["tank"][key] for key in ("width_m", "depth_m", "height_m"))
    light.location = (w / 2, -d, h * 3)
    light_data.energy, light_data.size = 100, max(w, d)
    light.rotation_euler = (Vector((w / 2, d / 2, h / 2)) - light.location).to_track_quat("-Z", "Y").to_euler()
    for obj in fixed.objects:
        obj.hide_select = True
    for obj in studio.objects:
        obj.hide_select = True
        obj.hide_set(True)
    bpy.ops.object.select_all(action="DESELECT")
    built[0].select_set(True)
    bpy.context.view_layer.objects.active = built[0]
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x, scene.render.resolution_y = 1280, 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    # Workbench shadow volumes from open leaf meshes create distracting ghost
    # outlines on the studio floor. Studio shading and cavity remain enabled.
    shading.show_shadows = False
    shading.show_cavity = True
    shading.cavity_type = "BOTH"
    shading.background_type = "WORLD"
    scene.view_settings.view_transform = "Standard"
    aspect = scene.render.resolution_x / scene.render.resolution_y
    focus = fit_camera(camera, recipe["tank"], (1.1, -1.9, 1.15), aspect)
    configure_viewport(camera, focus, recipe["tank"])
    controls.register()
    bpy.context.view_layer.update()
    scene["fishy_fixed_mesh_baselines_json"] = json.dumps({obj.name: native_snapshot.object_state_hash(obj) for obj in scene.objects if obj.type == "MESH" and "tank_id" not in obj}, sort_keys=True)
    geometry_report = check_built_geometry(recipe)
    scene["fishy_committed_state_hash"] = native_snapshot.adapt_scene(bpy.context)["stateHash"]
    instructions = bpy.data.texts.new("START HERE · Fishy recipe")
    instructions.write(
        f"{recipe['title']}\n{SOURCE_LABEL}\n\n"
        "This scene contains procedural assets fitted to a supplied scene recipe.\n"
        "It is an editable approximation, not validated photographic geometry.\n"
        "The full input is preserved in FISHY_RECIPE.json.\n"
        "A supplied local generation manifest, if any, is preserved separately.\n\n"
        "Select an item and drag the native Move arrows. Z movement is locked.\n"
        "Orbit using the top-right navigation gizmo or middle-mouse drag.\n"
        "Pan: Shift + middle mouse. Zoom: scroll / trackpad gesture.\n"
        "Rotate: R, Z; undo: Edit > Undo. Fishy controls load through the launcher.\n"
        "Run Check Bounds after edits. Checks never clamp or undo a drag.\n"
        "No biological compatibility, maintenance, or livestock claims are tested.\n"
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    rendered_paths = {}
    if render_dir:
        render_dir.mkdir(parents=True, exist_ok=True)
        for name, direction in (("front", (0, -1, 0)), ("overview", (1.1, -1.9, 1.15))):
            fit_camera(camera, recipe["tank"], direction, aspect)
            bpy.context.view_layer.update()
            path = render_dir / f"{name}.png"
            scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            rendered_paths[name] = str(path)
    # Save the overview camera state and viewport after any preview rendering.
    focus = fit_camera(camera, recipe["tank"], (1.1, -1.9, 1.15), aspect)
    configure_viewport(camera, focus, recipe["tank"])
    bpy.ops.wm.save_as_mainfile(filepath=str(output), check_existing=True)
    report = {
        "schema": "fishy.recipe-build-report.v1",
        "status": "built",
        "scene_source": SOURCE_LABEL,
        "recipe_path": str(recipe_path),
        "recipe_sha256": scene["fishy_recipe_sha256"],
        "blend_path": str(output),
        "tank": recipe["tank"],
        "object_count": len(built),
        "objects": geometry_report,
        "protected_native_objects": protected_report,
        "renders": rendered_paths,
        "bounds_tolerance_m": TOLERANCE_M,
        "provenance_path": str(provenance_path) if provenance is not None else None,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open("x", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2, allow_nan=False)
        handle.write("\n")
    print(f"FISHY_BLEND={output}")
    print(f"FISHY_BUILD_REPORT={report_path}")
    print(f"FISHY_RECIPE_OBJECTS={len(built)}")


if __name__ == "__main__":
    main()
