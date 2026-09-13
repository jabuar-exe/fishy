"""Create Fishy's native Blender starter scene. Run in a fresh Blender process.

This creates procedural demonstration geometry, not an AI reconstruction.
Example: blender --background --factory-startup --python build_scene.py -- --output fishy.blend
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector


def args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "fishy-studio.blend")
    parser.add_argument("--render", type=Path)
    tail = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(tail)


def material(name, color, roughness=0.65, alpha=1.0, noise=False):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, alpha)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Alpha"].default_value = alpha
    if alpha < 1 and hasattr(mat, "surface_render_method"):
        mat.surface_render_method = "DITHERED"
    if noise:
        tex = nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = 42
        tex.inputs["Detail"].default_value = 3
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.22
        bump.inputs["Distance"].default_value = 0.008
        mat.node_tree.links.new(tex.outputs["Fac"], bump.inputs["Height"])
        mat.node_tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def move_to_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def cube(name, location, size, mat, collection, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    if bevel:
        mod = obj.modifiers.new("Soft edges", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def segment(name, start, end, radius_start, radius_end, mat, collection, vertices=14):
    delta = Vector(end) - Vector(start)
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius_start,
                                  radius2=radius_end, depth=delta.length,
                                  location=(Vector(start) + Vector(end)) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def join_parts(parts, name, identifier, kind):
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    obj["tank_id"] = identifier
    obj["fishy_kind"] = kind
    obj["geometry_source"] = "procedural demonstration asset"
    obj.lock_location[2] = True
    obj.lock_rotation[0] = True
    obj.lock_rotation[1] = True
    return obj


def rock(name, pos, size, seed, collection, mat, identifier):
    rng = random.Random(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=pos)
    obj = bpy.context.object
    for vert in obj.data.vertices:
        vert.co *= rng.uniform(0.83, 1.08)
    obj.dimensions = size
    obj.rotation_euler = (0, 0, rng.uniform(-0.35, 0.35))
    obj.data.materials.append(mat)
    move_to_collection(obj, collection)
    return join_parts([obj], name, identifier, "rock")


def plant(name, origin, seed, count, height, collection, mats, identifier):
    rng = random.Random(seed)
    ox, oy, oz = origin
    vertices, faces = [], []
    for _ in range(count):
        angle = rng.uniform(0, math.tau)
        length = rng.uniform(height * 0.55, height)
        spread = rng.uniform(0.014, 0.045)
        base = Vector((ox + rng.uniform(-0.012, 0.012), oy + rng.uniform(-0.012, 0.012), oz))
        side = Vector((-math.sin(angle), math.cos(angle), 0))
        direction = Vector((math.cos(angle), math.sin(angle), 0))
        first = len(vertices)
        for row in range(8):
            t = row / 7
            center = base + direction * (spread * t * t) + Vector((0, 0, length * t))
            halfwidth = 0.0006 + math.sin(math.pi * t) * rng.uniform(0.003, 0.006)
            vertices.extend([tuple(center - side * halfwidth), tuple(center + side * halfwidth)])
        for row in range(7):
            j = first + row * 2
            faces.append((j, j + 1, j + 3, j + 2))
    mesh = bpy.data.meshes.new(name + " leaves")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    for mat in mats:
        mesh.materials.append(mat)
    for idx, face in enumerate(mesh.polygons):
        face.material_index = (idx // 7) % len(mats)
        face.use_smooth = True
    return join_parts([obj], name, identifier, "plant")


def main():
    options = args()
    output = options.output.expanduser().resolve()
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite an existing scene: {output}. Choose a fresh output path.")
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = "Fishy · Aquarium Studio"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "CENTIMETERS"
    for key, value in {"fishy_width_m": 0.6, "fishy_depth_m": 0.3, "fishy_height_m": 0.36}.items():
        scene[key] = value
    scene["fishy_scene_source"] = "Procedural starter scene; not an Astra generation or photo reconstruction."

    fixed = bpy.data.collections.new("01 · Tank & substrate")
    editable = bpy.data.collections.new("02 · Editable aquascape")
    studio = bpy.data.collections.new("03 · Studio")
    for collection in (fixed, editable, studio):
        scene.collection.children.link(collection)

    sand = material("Warm river sand", (0.54, 0.43, 0.27), noise=True)
    bark = material("Driftwood", (0.17, 0.075, 0.026), noise=True)
    stone = material("Grey river stone", (0.23, 0.27, 0.24), noise=True)
    greens = [material("Leaves · forest", (0.045, 0.22, 0.06)),
              material("Leaves · new growth", (0.12, 0.36, 0.065)),
              material("Leaves · olive", (0.18, 0.29, 0.045))]
    glass = material("Glass · viewport tint", (0.60, 0.80, 0.76), roughness=0.08, alpha=0.075)
    trim = material("Glass edge", (0.23, 0.43, 0.39), roughness=0.28)
    base_mat = material("Studio base", (0.045, 0.065, 0.058))
    ground_mat = material("Studio floor", (0.64, 0.67, 0.64))

    cube("Substrate · 3 cm", (0.3, 0.15, 0.015), (0.598, 0.298, 0.03), sand, fixed, 0.004)
    cube("Tank pedestal", (0.3, 0.15, -0.012), (0.63, 0.33, 0.022), base_mat, fixed, 0.005)
    for name, pos, size in [
        ("Front glass", (0.3, -0.002, 0.18), (0.604, 0.004, 0.36)),
        ("Back glass", (0.3, 0.302, 0.18), (0.604, 0.004, 0.36)),
        ("Left glass", (-0.002, 0.15, 0.18), (0.004, 0.3, 0.36)),
        ("Right glass", (0.602, 0.15, 0.18), (0.004, 0.3, 0.36)),
    ]:
        obj = cube(name, pos, size, glass, fixed)
        # Wire panes preserve easy object selection and a clear solid viewport.
        obj.display_type = "WIRE"
    for x in (0, 0.6):
        for y in (0, 0.3):
            segment("Tank corner", (x, y, 0), (x, y, 0.36), 0.0012, 0.0012, trim, fixed, 8)
    for y in (0, 0.3):
        segment("Top rim", (0, y, 0.36), (0.6, y, 0.36), 0.001, 0.001, trim, fixed, 8)
    for x in (0, 0.6):
        segment("Top rim", (x, 0, 0.36), (x, 0.3, 0.36), 0.001, 0.001, trim, fixed, 8)

    branches = [
        ((0.14, 0.16, 0.045), (0.26, 0.18, 0.13), 0.025, 0.018),
        ((0.26, 0.18, 0.13), (0.35, 0.18, 0.21), 0.018, 0.010),
        ((0.35, 0.18, 0.21), (0.42, 0.17, 0.27), 0.010, 0.0025),
        ((0.25, 0.18, 0.12), (0.22, 0.23, 0.22), 0.014, 0.006),
        ((0.22, 0.23, 0.22), (0.18, 0.25, 0.27), 0.006, 0.0015),
        ((0.31, 0.18, 0.18), (0.34, 0.10, 0.24), 0.008, 0.002),
        ((0.16, 0.16, 0.05), (0.11, 0.08, 0.035), 0.014, 0.004),
    ]
    wood = join_parts([segment("Wood branch", *branch, bark, editable) for branch in branches],
                      "Driftwood · drag me", "wood-01", "wood")
    rock("Main stone", (0.405, 0.215, 0.073), (0.13, 0.10, 0.086), 9, editable, stone, "rock-01")
    rock("Companion stone", (0.14, 0.115, 0.056), (0.075, 0.063, 0.052), 11, editable, stone, "rock-02")
    plant("Background plants · left", (0.095, 0.225, 0.032), 7, 22, 0.24, editable, greens, "plant-01")
    plant("Background plants · right", (0.515, 0.235, 0.032), 15, 24, 0.27, editable, greens, "plant-02")
    plant("Foreground plants", (0.485, 0.095, 0.032), 13, 30, 0.065, editable, greens, "plant-03")

    cube("Studio floor", (0.3, 0.15, -0.038), (200, 200, 0.025), ground_mat, studio)
    world = bpy.data.worlds.new("Soft studio world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.72, 0.79, 0.75, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.45
    scene.world = world
    for name, position, energy, size in [
        ("Large softbox", (0.15, -0.35, 1.1), 110, 0.85),
        ("Side fill", (0.9, 0.1, 0.65), 55, 0.65),
    ]:
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.shape, data.size = energy, "DISK", size
        light = bpy.data.objects.new(name, data)
        studio.objects.link(light)
        light.location = position
        light.rotation_euler = (Vector((0.3, 0.15, 0.1)) - light.location).to_track_quat("-Z", "Y").to_euler()
    data = bpy.data.cameras.new("Fishy overview camera")
    camera = bpy.data.objects.new("Fishy overview camera", data)
    studio.objects.link(camera)
    camera.location = (0.98, -1.12, 0.72)
    focus = Vector((0.3, 0.15, 0.15))
    camera.rotation_euler = (focus - camera.location).to_track_quat("-Z", "Y").to_euler()
    data.type, data.ortho_scale, data.lens = "ORTHO", 0.99, 45
    scene.camera = camera
    for obj in list(fixed.objects) + list(studio.objects):
        obj.hide_select = True
    # Keep studio lights and huge floor out of the modeling viewport only.
    for obj in studio.objects:
        obj.hide_set(True)

    bpy.ops.object.select_all(action="DESELECT")
    wood.select_set(True)
    bpy.context.view_layer.objects.active = wood
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                space = area.spaces.active
                space.show_region_ui = True
                space.show_region_toolbar = True
                space.show_gizmo = True
                space.show_gizmo_object_translate = True
                space.overlay.show_floor = False
                space.overlay.show_axis_x = False
                space.overlay.show_axis_y = False
                space.clip_start, space.clip_end = 0.001, 100
                space.shading.type = "SOLID"
                space.shading.color_type = "MATERIAL"
                space.shading.light = "STUDIO"
                space.shading.show_shadows = True
                space.shading.show_cavity = True
                space.shading.cavity_type = "BOTH"
                space.shading.background_type = "WORLD"
                region = space.region_3d
                region.view_location = focus
                region.view_distance = 1.12
                region.view_rotation = (camera.location - focus).to_track_quat("Z", "Y")
                region.view_perspective = "PERSP"
    # A context override makes the native move tool active in the saved workspace.
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type == "VIEW_3D":
                with bpy.context.temp_override(window=window, area=area):
                    bpy.ops.wm.tool_set_by_id(name="builtin.move")
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1440, 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    instructions = bpy.data.texts.new("START HERE · Fishy")
    instructions.write(
        "Fishy — native Blender starter scene\n\n"
        "Procedural demo geometry. Not yet generated by Astra.\n"
        "Orbit: middle mouse drag, or drag the navigation gizmo at top-right.\n"
        "Pan: Shift + middle mouse. Zoom: mouse wheel / trackpad gesture.\n"
        "Select wood, stone or plants; drag the colored Move gizmo to reposition.\n"
        "Undo: Cmd+Z on macOS. Rotate: R, Z, 90, Enter; or Fishy sidebar.\n"
        "Use the Fishy launcher to load the optional controls panel.\n"
        "Bounds are checked explicitly after a drag; drag is not automatically clamped.\n"
        "Save edits with Cmd+S. The build script refuses to overwrite existing files.\n"
        "Units: meters internally, centimeters in the UI. Origin front-left-bottom.\n"
    )
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    print(f"FISHY_BLEND={output}")
    if options.render:
        options.render.parent.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(options.render.resolve())
        bpy.ops.render.render(write_still=True)
        print(f"FISHY_RENDER={scene.render.filepath}")


if __name__ == "__main__":
    main()
