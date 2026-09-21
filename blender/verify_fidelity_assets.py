"""Blender-side smoke verification for Fishy's generated fidelity assets."""
import bpy
import os
import tempfile
import math,json
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODELS = os.path.join(ROOT, "site", "public", "render-assets", "models")
BLEND = os.path.join(ROOT, "blender", "fishy-fidelity-assets.blend")


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


# Confirm Blender can create, save, reopen, export, and re-import a minimal GLB.
with tempfile.TemporaryDirectory(prefix="fishy-blender-verify-") as directory:
    blend_path = os.path.join(directory, "roundtrip.blend")
    glb_path = os.path.join(directory, "roundtrip.glb")
    clear()
    bpy.ops.mesh.primitive_cube_add(size=1)
    bpy.context.object.name = "Fishy verification cube"
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    bpy.ops.wm.open_mainfile(filepath=blend_path)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", use_selection=True)
    clear()
    bpy.ops.import_scene.gltf(disable_bone_shape=True,filepath=glb_path)
    assert any(obj.type == "MESH" for obj in bpy.context.scene.objects), "Cube GLB roundtrip did not produce a mesh"

# Confirm the authored master reopens, and every generated GLB has compact mesh
# geometry, normals, and authored UVs for its PBR maps.
bpy.ops.wm.open_mainfile(filepath=BLEND)
assert bpy.data.filepath == BLEND, "Master .blend did not reopen"
for name in ("rock-rounded.glb", "rock-strata.glb", "wood-arch.glb", "plant-fern.glb", "plant-broadleaf.glb", "plant-grass.glb", "wood-root.glb", "wood-stump.glb", "plant-stem.glb", "plant-moss.glb"):
    clear()
    bpy.ops.import_scene.gltf(disable_bone_shape=True,filepath=os.path.join(MODELS, name))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    assert meshes, f"{name} contains no mesh"
    assert len(meshes) <= 3, f"{name} exceeds the runtime mesh/draw budget"
    assert all(len(mesh.data.vertices) and mesh.data.polygons for mesh in meshes), f"{name} has empty mesh data"
    assert all(all(math.isfinite(c) for c in v.co) and v.normal.length > .5 for mesh in meshes for v in mesh.data.vertices), f"{name} has invalid coordinates/normals"
    assert all(len(mesh.data.uv_layers) for mesh in meshes), f"{name} has no UVs for PBR texture sampling"
    print("FISHY_VERIFIED", name, len(meshes), sum(len(mesh.data.vertices) for mesh in meshes), "UV")
# Sample actual deformed delivered geometry across a full clip, not bind-pose
# bounds. These match the browser swept-envelope safety margins (metre units).
clear();bpy.ops.import_scene.gltf(disable_bone_shape=True,filepath=os.path.join(MODELS,"neon-tetra.glb"))
rigs=[o for o in bpy.context.scene.objects if o.type=="ARMATURE"]
assert rigs and rigs[0].animation_data and rigs[0].animation_data.action,"Tetra clip/skin missing"
action=rigs[0].animation_data.action;start,end=action.frame_range
assert end>start,"Tetra animation has no duration"
minimum=Vector((math.inf,)*3);maximum=Vector((-math.inf,)*3);frames=[]
for i in range(65):
    frame=start+(end-start)*i/64;bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame))
    deps=bpy.context.evaluated_depsgraph_get();count=0
    for obj in bpy.context.scene.objects:
        if obj.type!="MESH":continue
        evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh()
        for vertex in mesh.vertices:
            p=evaluated.matrix_world@vertex.co
            for axis in range(3):minimum[axis]=min(minimum[axis],p[axis]);maximum[axis]=max(maximum[axis],p[axis])
            count+=1
        evaluated.to_mesh_clear()
    frames.append(count)
assert min(frames)>0
normalized_min=[v/.956 for v in minimum];normalized_max=[v/.956 for v in maximum]
# Native Z-up: X lateral, Y longitudinal, Z vertical.
for axis,limit in enumerate((.42,.58,.28)):
    assert -limit<=normalized_min[axis] and normalized_max[axis]<=limit,(axis,normalized_min,normalized_max)
report={"naturalAssets":10,"uvNormalsFinite":True,"tetraPoseSamples":65,"tetraNormalizedMinXYZ":normalized_min,"tetraNormalizedMaxXYZ":normalized_max,"conservativeNativeEnvelope":[.42,.58,.28],"tetraVerticesPerPose":frames[0]}
path=os.path.join(ROOT,"workstreams/fidelity-reference-20260921/astra-refinement/blender-verification.json")
with open(path,"w") as output:json.dump(report,output,indent=2)
print("FISHY_BLENDER_VERIFY_COMPLETE",json.dumps(report))
