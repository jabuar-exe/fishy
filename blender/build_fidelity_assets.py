"""Build Fishy's original, editable fidelity assets.

Run with Blender in background mode. All geometry and 128px PBR maps here are
authored procedurally by this file; no reference-template assets are imported.
"""
import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "site", "public", "render-assets")
MODELS = os.path.join(OUT, "models")
TEXTURES = os.path.join(OUT, "textures")
os.makedirs(MODELS, exist_ok=True)
os.makedirs(TEXTURES, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
        for block in collection:
            if block.users == 0:
                collection.remove(block)


def generated_image(name, mode):
    image = bpy.data.images.get(name) or bpy.data.images.new(name, 128, 128, alpha=False)
    pixels = []
    for y in range(128):
        for x in range(128):
            grain = math.sin(x * .29 + y * .11) * .5 + math.sin(y * .43 - x * .08) * .5
            small = math.sin(x * 1.83 + y * .71) * .5 + .5
            if mode == "bark":
                base = .19 + grain * .045 + small * .018
                color = (base * .7, base * .48, base * .27, 1)
            elif mode == "rock":
                base = .31 + grain * .045 + small * .025
                color = (base * .83, base * .91, base * .82, 1)
            elif mode == "leaf":
                vein = .14 * (1 - abs((x / 127) * 2 - 1))
                color = (.06 + vein + small * .012, .24 + vein * 1.3 + grain * .025, .075 + vein * .45, 1)
            elif mode == "normal":
                dx = math.sin(x * .29 + y * .11) * .09
                dy = math.cos(y * .43 - x * .08) * .09
                color = (.5 + dx, .5 + dy, 1, 1)
            else:
                rough = .48 + grain * .1 + small * .05
                color = (rough, rough, rough, 1)
            pixels.extend(color)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = os.path.join(TEXTURES, name + ".png")
    image.file_format = "PNG"
    image.save()
    image.colorspace_settings.name = "Non-Color" if mode in {"normal", "roughness"} else "sRGB"
    return image


def pbr_material(name, kind):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    for node in list(nodes):
        nodes.remove(node)
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = .68
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    color = nodes.new("ShaderNodeTexImage")
    color.image = generated_image(f"fishy-{kind}-albedo", kind)
    links.new(color.outputs["Color"], bsdf.inputs["Base Color"])
    rough = nodes.new("ShaderNodeTexImage")
    rough.image = generated_image("fishy-roughness", "roughness")
    rough.image.colorspace_settings.name = "Non-Color"
    links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
    normal = nodes.new("ShaderNodeTexImage")
    normal.image = generated_image("fishy-normal", "normal")
    normal.image.colorspace_settings.name = "Non-Color"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = .36 if kind == "leaf" else .72
    links.new(normal.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def curve_branch(name, points, radius, material, parent):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 6
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for index, (point, co) in enumerate(zip(spline.bezier_points, points)):
        point.co = co
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
        # A living branch carries its mass at the base and narrows at each tip.
        point.radius = 1 - .58 * index / max(1, len(points) - 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.parent = parent
    return obj


def leaf_mesh(name, origin, direction, length, width, material, parent, lobed=False):
    direction = Vector(direction).normalized()
    # Source geometry is authored Y-up. The leaf width stays perpendicular to
    # that botanical up axis, then a surface normal provides an intentional curl.
    side = Vector((0, 1, 0)).cross(direction)
    if side.length < .01:
        side = Vector((1, 0, 0))
    side.normalize()
    surface_normal = direction.cross(side).normalized()
    rows, cols = 8, 4
    vertices, faces = [], []
    for row in range(rows + 1):
        t = row / rows
        center = Vector(origin) + direction * (length * t) + Vector((0, 0, math.sin(t * math.pi) * length * .08))
        for col in range(cols + 1):
            s = col / cols * 2 - 1
            taper = math.sin(math.pi * t) ** .58
            serration = 1 + (.13 * math.sin(t * math.pi * 7) if lobed else 0)
            curl = math.cos(s * math.pi) * length * .028 * taper
            point = center + side * (s * width * taper * serration) + surface_normal * curl
            vertices.append(point)
    for row in range(rows):
        for col in range(cols):
            a = row * (cols + 1) + col
            faces.append((a, a + 1, a + cols + 2, a + cols + 1))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    uv_layer = mesh.uv_layers.new(name="Authored leaf UV")
    for polygon in mesh.polygons:
        polygon.use_smooth = True
        for loop_index in polygon.loop_indices:
            vertex = mesh.loops[loop_index].vertex_index
            row, col = divmod(vertex, cols + 1)
            uv_layer.data[loop_index].uv = (col / cols, row / rows)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    bevel = obj.modifiers.new("Leaf edge softness", "BEVEL")
    bevel.width, bevel.segments = .00035, 1
    return obj


def root_empty(name):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    # The source builders are intentionally Y-up to match the browser scene.
    # Blender is Z-up, so rotate the authored root before GLB export; Blender's
    # glTF conversion then restores Y-up in the runtime asset.
    root.rotation_euler.x = math.pi / 2
    return root


def make_rock():
    root = root_empty("Fishy weathered stratified rock")
    material = pbr_material("Fishy original rock PBR", "rock")
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=.075)
    rock = bpy.context.object
    rock.name = "Angular weathered rock"
    rock.scale = (1.25, .72, .88)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for vertex in rock.data.vertices:
        x, y, z = vertex.co
        ring = 1 + math.sin(y * 88 + x * 39) * .085 + math.sin(z * 51) * .035
        vertex.co.x *= ring
        vertex.co.z *= ring
        vertex.co.y += math.sin(x * 53) * .004
    rock.data.materials.append(material)
    rock.parent = root
    for index, offset in enumerate(((-.048, .01, .028), (.038, .018, -.024), (.008, .042, .016))):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=.026)
        chip = bpy.context.object
        chip.name = f"Strata chip {index + 1}"
        chip.location = offset
        chip.scale = (1.35, .28, .72)
        chip.data.materials.append(material)
        chip.parent = root
    return root


def make_wood():
    root = root_empty("Fishy branching river arch")
    material = pbr_material("Fishy original bark PBR", "bark")
    trunk = [(-.16, .006, .01), (-.105, .031, -.008), (-.035, .072, .002), (.055, .124, -.018), (.145, .105, .016)]
    curve_branch("River arch trunk", trunk, .014, material, root)
    for index, (start, end) in enumerate(((trunk[1], (-.14, .115, -.045)), (trunk[2], (-.02, .155, .045)), (trunk[3], (.075, .19, -.054)), (trunk[3], (.16, .15, .06)), (trunk[0], (-.19, .045, .05)))):
        mid = ((start[0] + end[0]) * .5, max(start[1], end[1]) + .025, (start[2] + end[2]) * .5)
        curve_branch(f"Branch {index + 1}", [start, mid, end], .006 - index * .00055, material, root)
    for index in range(9):
        t = .1 + index * .095
        point = Vector(trunk[0]).lerp(Vector(trunk[-1]), t)
        a = index * 2.4
        curve_branch(f"Bark ridge {index + 1}", [point + Vector((0, -.004, 0)), point + Vector((math.cos(a) * .009, .006, math.sin(a) * .009))], .0017, material, root)
    return root


def make_fern():
    root = root_empty("Fishy fern")
    material = pbr_material("Fishy original leaf PBR", "leaf")
    for frond in range(7):
        angle = frond / 7 * math.tau
        stem = [(0, .003, 0), (math.cos(angle) * .013, .055, math.sin(angle) * .013), (math.cos(angle) * .048, .145, math.sin(angle) * .048)]
        curve_branch(f"Fern rachis {frond + 1}", stem, .0014, material, root)
        for pair in range(6):
            t = .22 + pair * .115
            base = Vector(stem[1]).lerp(Vector(stem[2]), t)
            length = .032 * math.sin(t * math.pi) + .006
            for sign in (-1, 1):
                tangent = Vector((math.cos(angle + sign * math.pi / 2), .14, math.sin(angle + sign * math.pi / 2)))
                leaf_mesh(f"Fern pinna {frond}-{pair}-{sign}", base, tangent, length, .006, material, root, True)
    return root


def make_broadleaf():
    root = root_empty("Fishy broadleaf")
    material = pbr_material("Fishy original broadleaf PBR", "leaf")
    for index in range(13):
        angle = index / 13 * math.tau + .13 * math.sin(index)
        height = .055 + (index % 4) * .011
        stem_end = (math.cos(angle) * .028, height, math.sin(angle) * .028)
        curve_branch(f"Broadleaf stem {index + 1}", [(0, .003, 0), (stem_end[0] * .45, height * .5, stem_end[2] * .45), stem_end], .00145, material, root)
        leaf_mesh(f"Broadleaf blade {index + 1}", stem_end, (math.cos(angle), .33, math.sin(angle)), .055 + (index % 3) * .008, .015, material, root)
    return root


def make_grass():
    root = root_empty("Fishy grass")
    material = pbr_material("Fishy original grass PBR", "leaf")
    for index in range(42):
        angle = index * 2.39996
        radius = .008 + (index % 8) * .007
        start = (math.cos(angle) * radius, .002, math.sin(angle) * radius)
        direction = Vector((math.cos(angle) * .38, .9, math.sin(angle) * .38)).normalized()
        leaf_mesh(f"Grass blade {index + 1}", start, direction, .065 + (index % 5) * .009, .0021, material, root)
    return root


def merge_for_export(root):
    """Bake static source parts into one mesh while retaining the editable master.

    Curves and leaf modifiers are converted only in the disposable export scene.
    Every form currently has one PBR material, so the join produces one GLB mesh
    and one material draw rather than a draw for every individual blade/pinna.
    """
    sources = [obj for obj in root.children_recursive if obj.type in {"MESH", "CURVE"}]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in sources:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = sources[0]
    bpy.ops.object.convert(target="MESH")
    meshes = [obj for obj in root.children_recursive if obj.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = root.name + " — runtime mesh"
    joined.parent = root
    return joined


def export_asset(filename, builder):
    clear_scene()
    root = builder()
    merge_for_export(root)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    path = os.path.join(MODELS, filename)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_materials="EXPORT", export_apply=True, export_cameras=False, export_lights=False)
    return path


ASSETS = (("rock-rounded.glb", make_rock), ("wood-arch.glb", make_wood), ("plant-fern.glb", make_fern), ("plant-broadleaf.glb", make_broadleaf), ("plant-grass.glb", make_grass))
for filename, builder in ASSETS:
    print("FISHY_ASSET", export_asset(filename, builder))

clear_scene()
# Keep an editable master scene: each authored source asset remains a separately
# named root instead of saving only the temporary export result.
for index, (filename, builder) in enumerate(ASSETS):
    asset = builder()
    asset.name = "SOURCE " + filename
    asset.location.x = (index - 2) * .38
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "blender", "fishy-fidelity-assets.blend"))
print("FISHY_BUILD_COMPLETE")
