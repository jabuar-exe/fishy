"""Render a neutral-light visual QA sheet for Fishy's authored GLB assets."""
import bpy
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODELS = os.path.join(ROOT, "site", "public", "render-assets", "models")
OUTPUT = os.environ.get("FISHY_ASSET_CONTACT_SHEET", "/tmp/fishy-fidelity-assets.png")

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1280, 720, 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = OUTPUT
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.018, .024, .022, 1)
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .18

positions = [-.68, -.34, 0, .34, .68]
names = ["wood-arch.glb", "rock-rounded.glb", "plant-fern.glb", "plant-broadleaf.glb", "plant-grass.glb"]
for filename, x in zip(names, positions):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, filename))
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    root = bpy.data.objects.new(filename, None)
    bpy.context.collection.objects.link(root)
    for obj in imported:
        if obj.parent is None:
            obj.parent = root
    # GLBs deliberately have different native proportions. Normalize them only
    # for this QA sheet so a wood arch cannot push the remaining forms off-frame.
    bpy.context.view_layer.update()
    bounds = [root.matrix_world @ Vector(corner) for obj in imported if obj.type == "MESH" for corner in obj.bound_box]
    minimum = Vector((min(v.x for v in bounds), min(v.y for v in bounds), min(v.z for v in bounds)))
    maximum = Vector((max(v.x for v in bounds), max(v.y for v in bounds), max(v.z for v in bounds)))
    root.scale *= .31 / max(maximum.x-minimum.x, maximum.y-minimum.y, maximum.z-minimum.z)
    bpy.context.view_layer.update()
    bounds = [root.matrix_world @ Vector(corner) for obj in imported if obj.type == "MESH" for corner in obj.bound_box]
    minimum = Vector((min(v.x for v in bounds), min(v.y for v in bounds), min(v.z for v in bounds)))
    root.location = (x, 0, -minimum.z)

bpy.ops.mesh.primitive_plane_add(size=3, location=(0, 0, -.006))
floor = bpy.context.object
floor_mat = bpy.data.materials.new("Neutral floor")
floor_mat.diffuse_color = (.018, .03, .026, 1)
floor.data.materials.append(floor_mat)

for location, energy, size, color in [((-.55, -.4, .75), 110, .45, (.72, .89, .8)), ((.65, -.2, .45), 75, .3, (.65, .78, 1)), ((0, .5, .4), 30, .5, (.55, .62, .5))]:
    data = bpy.data.lights.new("QA area", "AREA")
    data.energy, data.shape, data.size, data.color = energy, "DISK", size, color
    light = bpy.data.objects.new("QA area", data)
    bpy.context.collection.objects.link(light)
    light.location = location
    direction = Vector((0, .08, 0)) - light.location
    light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

camera_data = bpy.data.cameras.new("QA camera")
camera = bpy.data.objects.new("QA camera", camera_data)
bpy.context.collection.objects.link(camera)
camera.location = (0, -1.8, .85)
camera.rotation_euler = (Vector((0, 0, .14)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera_data.type, camera_data.lens = "PERSP", 30
scene.camera = camera

bpy.ops.render.render(write_still=True)
print("FISHY_CONTACT_SHEET", OUTPUT)
