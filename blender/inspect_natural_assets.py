"""Fixed-camera Cycles inspection of the exported assets, including reverse views.
This deliberately imports the deliverable GLBs, not just authoring geometry.
"""
import bpy, os, math, json
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'workstreams/fidelity-reference-20260921/astra-refinement/renders')
os.makedirs(OUT,exist_ok=True)

def clear():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def bounds(objects):
    bpy.context.view_layer.update()
    points=[o.matrix_world@Vector(c) for o in objects if o.type=='MESH' for c in o.bound_box]
    lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)])
    return lo,hi

def light(name,location,target,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=location
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()

def setup(target,extent,reverse=False):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=40;scene.cycles.use_denoising=True
    scene.cycles.max_bounces=8
    scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(.15,.18,.17,1);bg.inputs['Strength'].default_value=.35
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.0003));floor=bpy.context.object
    mat=bpy.data.materials.new('Neutral charcoal plinth');mat.use_nodes=True
    mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.048,.061,.055,1)
    mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.8;floor.data.materials.append(mat)
    e=extent; t=Vector(target)
    # Powers scale with scene area, so micro-assets do not bleach under studio lights.
    light('Broad upper-left key',t+Vector((-1.5,-1.8,2.8))*e,t,110*e*e,e*1.6,(1,.94,.82))
    light('Soft cool fill',t+Vector((1.8,-.7,1.1))*e,t,35*e*e,e*1.8,(.76,.85,1))
    light('Rim',t+Vector((.2,1.4,2.2))*e,t,80*e*e,e,(.82,1,.88))
    data=bpy.data.cameras.new('Fixed inspection camera');camera=bpy.data.objects.new('Fixed inspection camera',data);bpy.context.collection.objects.link(camera)
    camera.location=t+Vector((1.05,2.9,1.9) if reverse else (1.05,-2.9,1.8))*e
    camera.rotation_euler=(t-camera.location).to_track_quat('-Z','Y').to_euler();data.lens=56;scene.camera=camera
    return scene

names=['rock-strata','rock-rounded','wood-arch','plant-fern','plant-broadleaf','plant-grass','neon-tetra','wood-root','wood-stump','plant-stem','plant-moss']
only=os.environ.get('FISHY_INSPECT_ONLY','')
for name in names:
    if only and name not in only.split(','):continue
    for reverse in (False,True):
        clear();bpy.ops.import_scene.gltf(disable_bone_shape=True,filepath=os.path.join(ROOT,'site/public/render-assets/models',name+'.glb'))
        objects=list(bpy.context.scene.objects);lo,hi=bounds(objects)
        # Ground the complete import without changing proportions.
        for o in objects:
            if o.parent is None:o.location.z-=lo.z
        lo,hi=bounds(objects);extent=max(hi-lo);target=(lo+hi)/2
        scene=setup(target,extent,reverse)
        if name=='neon-tetra':
            scene.camera.location=target+Vector((-2.9,.4,.50) if reverse else (2.9,-.4,.50))*extent
            scene.camera.rotation_euler=(target-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=os.path.join(OUT,name+('-reverse' if reverse else '-front')+'.png')
        bpy.ops.render.render(write_still=True)
        if not reverse:bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,name+'-inspection.blend'))
        print('FISHY_INSPECTED',scene.render.filepath,flush=True)
print('FISHY_INSPECTION_COMPLETE',flush=True)
