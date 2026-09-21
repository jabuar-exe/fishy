"""Astra fish regeneration: shared detailed skeletal anatomy, species UV skins,
GLB re-import, 65 animated-pose checks, and calibrated front/reverse renders.
The approved neon tetra is inspected without regeneration.
"""
import bpy, os, sys, json, math
from mathutils import Vector
sys.path.insert(0,os.path.dirname(__file__))
from build_tetra import body
from build_natural_assets import ROOT,MODELS,clear
OUT=os.path.join(ROOT,'workstreams/filters-fish-ui-20260921/fish-renders')
THUMBS=os.path.join(ROOT,'site/public/render-assets/fish-thumbnails')
os.makedirs(OUT,exist_ok=True);os.makedirs(THUMBS,exist_ok=True)
SPECIES=[('neon-tetra','Neon tetra',1,1),('ember-tetra','Ember tetra',.92,.92),('cardinal-tetra','Cardinal tetra',1,1),('green-neon-tetra','Green neon tetra',.86,.9),('black-neon-tetra','Black neon tetra',1.04,1.08),('glowlight-tetra','Glowlight tetra',.96,.96),('rummy-nose-tetra','Rummy-nose tetra',.87,.92),('harlequin-rasbora','Harlequin rasbora',1.12,1.24),('chili-rasbora','Chili rasbora',.75,.79),('celestial-pearl-danio','Celestial pearl danio',.91,.92),('endler-livebearer',"Endler's livebearer",.88,.95)]

def area(name,loc,power,size,color):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()

def inspect(identifier):
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS,identifier+'.glb'),disable_bone_shape=True)
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];scene=bpy.context.scene
    rig=next(o for o in scene.objects if o.type=='ARMATURE');assert rig.animation_data and rig.animation_data.action
    start,end=rig.animation_data.action.frame_range;assert end>start
    minimum=Vector((1e4,)*3);maximum=Vector((-1e4,)*3);tail_poses=[]
    for i in range(65):
        frame=start+(end-start)*i/64;scene.frame_set(int(frame),subframe=frame-int(frame));deps=bpy.context.evaluated_depsgraph_get();tail_poses.append(tuple(rig.pose.bones['tail'].matrix.to_quaternion()))
        for o in meshes:
            evaluated=o.evaluated_get(deps);mesh=evaluated.to_mesh()
            for vertex in mesh.vertices:
                v=evaluated.matrix_world@vertex.co
                for axis in range(3):minimum[axis]=min(minimum[axis],v[axis]);maximum[axis]=max(maximum[axis],v[axis])
            evaluated.to_mesh_clear()
    assert len(set(tail_poses))>8,'The exported tail must actually move across sampled poses'
    scene.frame_set(int(start+(end-start)/4))
    scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.cycles.device='GPU'
    preferences=bpy.context.preferences.addons['cycles'].preferences
    try:
        preferences.compute_device_type='METAL';preferences.get_devices()
        for d in preferences.devices:d.use=d.type=='METAL'
    except:scene.cycles.device='CPU'
    scene.render.resolution_x=1000;scene.render.resolution_y=650;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
    scene.world=bpy.data.worlds.new('Neutral inspection world');scene.world.use_nodes=True;bg=scene.world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(.12,.16,.15,1);bg.inputs['Strength'].default_value=.6
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    area('Broad warm softbox',(1.3,-.8,2.2),180,2,(1,.95,.87));area('Cool fill',(-1.4,-.2,1.3),95,2,(.78,.88,1));area('Top fin rim',(.1,1.6,1.8),125,1.8,(.83,1,.94))
    d=bpy.data.cameras.new('Species side inspection');c=bpy.data.objects.new('Species side inspection',d);bpy.context.collection.objects.link(c);scene.camera=c;d.type='ORTHO';d.ortho_scale=1.18
    for reverse in (False,True):
        c.location=Vector((-2.8,.35,.35) if reverse else (2.8,-.35,.35));c.rotation_euler=(-c.location).to_track_quat('-Z','Y').to_euler()
        scene.render.film_transparent=False;scene.render.resolution_percentage=100
        scene.render.filepath=os.path.join(OUT,identifier+('-reverse' if reverse else '-front')+'.png');bpy.ops.render.render(write_still=True)
        if not reverse:
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,identifier+'-inspection.blend'))
            scene.render.film_transparent=True;scene.render.resolution_percentage=40;scene.render.filepath=os.path.join(THUMBS,identifier+'.png');bpy.ops.render.render(write_still=True)
    print('FISHY_FISH_VERIFIED',identifier,flush=True)
    return {'species':identifier,'vertices':sum(len(o.data.vertices) for o in meshes),'poses':65,'distinctTailPoses':len(set(tail_poses)),'nativeMin':list(minimum),'nativeMax':list(maximum),'bytes':os.path.getsize(os.path.join(MODELS,identifier+'.glb'))}

records=[]
for identifier,label,width,height in SPECIES:
    if os.environ.get('FISHY_FISH_ONLY') and identifier not in os.environ['FISHY_FISH_ONLY'].split(','):continue
    if identifier!='neon-tetra' and not os.environ.get('FISHY_INSPECT_ONLY'):
        bpy.ops.wm.read_factory_settings(use_empty=True);body(identifier,label,width,height)
    records.append(inspect(identifier))
report_path=os.path.join(OUT,'deformed-bounds.json')
if os.environ.get('FISHY_FISH_ONLY') and os.path.exists(report_path):
    updated={r['species']:r for r in json.load(open(report_path))};updated.update({r['species']:r for r in records});records=list(updated.values())
json.dump(records,open(report_path,'w'),indent=2)
print('FISHY_SPECIES_BUILD_COMPLETE',flush=True)
