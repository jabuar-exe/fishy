"""Reproduce the editable app study in Blender, using exported render assets.
Requires the scene.json generated from createPlantedStudy and its exact bounds.
"""
import bpy,os,sys,json,math,random
from mathutils import Vector, Matrix
sys.path.insert(0,os.path.dirname(__file__))
from build_natural_assets import clear,root,basic_material,ROOT,MeshBuilder,tube,catmull

OUT=os.path.join(ROOT,'workstreams/fidelity-reference-20260921/astra-refinement')
record=json.load(open(os.path.join(OUT,'scene.json')))
clear();scene=bpy.context.scene

def boxbounds(objects):
    bpy.context.view_layer.update()
    pts=[o.matrix_world@Vector(c) for o in objects if o.type=='MESH' for c in o.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]),Vector([max(p[i] for p in pts) for i in range(3)])

for item in record['objects']:
    if not item['asset']:continue
    before=set(scene.objects);bpy.ops.import_scene.gltf(disable_bone_shape=True,filepath=os.path.join(ROOT,'site/public/render-assets/models',item['asset']+'.glb'))
    imported=[o for o in scene.objects if o not in before];lo,hi=boxbounds(imported)
    group=root(item['name']);align=root('Authored asset fit');align.parent=group
    for o in imported:
        if o.parent is None:o.parent=align
    mi=item['localMin'];ma=item['localMax']
    targetlo=Vector((mi[0],-ma[2],mi[1]));targethi=Vector((ma[0],-mi[2],ma[1]))
    factor=min((targethi[i]-targetlo[i])/max(hi[i]-lo[i],1e-8) for i in range(3))*.985
    align.scale=(factor,)*3
    sc=(lo+hi)/2;tc=(targetlo+targethi)/2
    align.location=(tc.x-sc.x*factor,tc.y-sc.y*factor,targetlo.z-lo.z*factor)
    # Input uses Three column-major arrays; Blender Matrix rows are explicit.
    v=item['blenderMatrix'];group.matrix_world=Matrix([[v[col*4+row] for col in range(4)] for row in range(4)])

W=record['tank']['width'];D=record['tank']['depth'];H=record['tank']['height'];S=record['substrate']

def cube(name,position,dimensions,material,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=position);o=bpy.context.object;o.name=name;o.dimensions=dimensions
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
    if bevel:
        mod=o.modifiers.new('Soft dressed edge','BEVEL');mod.width=bevel;mod.segments=3
    return o

base=basic_material('Charcoal aquarium plinth',(.012,.021,.019),.44)
cube('Aquarium base',(0,0,-.010),(W+.018,D+.018,.020),base,.004)
sand=basic_material('Natural graded sand',(.48,.40,.26),.92)
nodes=sand.node_tree.nodes;links=sand.node_tree.links;p=nodes.get('Principled BSDF')
tex=nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=950;tex.inputs['Detail'].default_value=3
bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.30;bump.inputs['Distance'].default_value=.0009
links.new(tex.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],p.inputs['Normal'])
ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(.29,.235,.142,1);ramp.color_ramp.elements[1].color=(.67,.575,.395,1)
links.new(tex.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs[0],p.inputs['Base Color'])
cube('Fine sand bed',(0,0,S/2),(W-.008,D-.008,S),sand,.002)

# Deterministic graded river gravel, concentrated at bank margins, not a grid.
rng=random.Random(9701);pebble=basic_material('Wet river pebbles',(.11,.145,.12),.47)
for i in range(300):
    x=rng.uniform(-W*.485,W*.485);y=rng.uniform(-D*.475,D*.475)
    corridor=.085+.10*(.5-y/D)
    if abs(x)<corridor and rng.random()>.14:continue
    radius=.0018+(.009 if i%13==0 else .0035)*rng.random()
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=radius,location=(x,y,S+radius*.42));o=bpy.context.object;o.name='River gravel';o.scale=(rng.uniform(.8,1.4),rng.uniform(.6,1.1),rng.uniform(.4,.8));o.data.materials.append(pebble)
    for face in o.data.polygons:face.use_smooth=True

# A clean dark rear gives the miniature the depth and silhouettes of the brief.
back=basic_material('Deep planted backdrop',(.012,.037,.028),.92)
cube('Rear backing',(0,D/2+.001,H/2),(W,.003,H),back)

# Thin edge rails communicate glass without putting a bright sheet over the art.
edge=basic_material('Glass edge glint',(.20,.34,.29),.2,.3)
for x in (-W/2,W/2):
    for y in (-D/2,D/2):cube('Vertical glass edge',(x,y,H/2),(.0008,.0008,H),edge)
for y in (-D/2,D/2):cube('Rim edge',(0,y,H),(W,.0008,.0008),edge)

water=basic_material('Clear water surface',(.19,.34,.27),.085)
wp=water.node_tree.nodes.get('Principled BSDF');wp.inputs['Transmission Weight'].default_value=.93;wp.inputs['IOR'].default_value=1.333
wp.inputs['Alpha'].default_value=.12
noise=water.node_tree.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=33;noise.inputs['Detail'].default_value=2
bump=water.node_tree.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.11;bump.inputs['Distance'].default_value=.0006
water.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height']);water.node_tree.links.new(bump.outputs['Normal'],wp.inputs['Normal'])
water.surface_render_method='DITHERED'
water_height=record.get('waterHeight',H-.015)
cube('Water surface',(0,0,water_height),(W-.006,D-.006,.0004),water)
volume=bpy.data.materials.new('Water depth absorption');volume.use_nodes=True
n=volume.node_tree.nodes;l=volume.node_tree.links;n.clear();output=n.new('ShaderNodeOutputMaterial');transparent=n.new('ShaderNodeBsdfTransparent');absorption=n.new('ShaderNodeVolumeAbsorption')
absorption.inputs['Color'].default_value=(.20,.47,.33,1);absorption.inputs['Density'].default_value=1.1;l.new(transparent.outputs[0],output.inputs['Surface']);l.new(absorption.outputs[0],output.inputs['Volume'])
cube('Water body',(0,0,(water_height+S)/2),(W-.008,D-.008,water_height-S),volume)

if record['visual'].get('cascade') and len(record.get('cascadeRoute',[]))>1:
    route=[Vector((p[0],-p[2],p[1])) for p in record['cascadeRoute']]
    # A thin broken sheet with irregular rivulets, rather than identical wires.
    streammat=basic_material('Broken translucent cascade',(.47,.65,.59),.15)
    n=streammat.node_tree.nodes;l=streammat.node_tree.links;sp=n.get('Principled BSDF')
    sp.inputs['Transmission Weight'].default_value=.62;sp.inputs['IOR'].default_value=1.333
    uv=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(72,.7,1);l.new(uv.outputs['UV'],mapping.inputs[0])
    noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=1;noise.inputs['Detail'].default_value=2;l.new(mapping.outputs[0],noise.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.51;ramp.color_ramp.elements[0].color=(0,0,0,1);ramp.color_ramp.elements[1].position=.79;ramp.color_ramp.elements[1].color=(.30,.30,.30,1)
    l.new(noise.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs['Color'],sp.inputs['Alpha'])
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.12;bump.inputs['Distance'].default_value=.001;l.new(noise.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],sp.inputs['Normal'])
    streammat.surface_render_method='DITHERED';stream=root('Independent free-falling rivulets')
    for index,start in enumerate(route[:-1]):
        end=route[index+1].copy()
        if index<len(route)-2:end.y=max(end.y,start.y-.008)
        control=start.lerp(end,.42);control.z=start.z-(start.z-end.z)*.20
        mesh=MeshBuilder();points=[];uvs=[];length=(end-start).length
        for row in range(81):
            t=row/80;p=start*(1-t)**2+control*2*(1-t)*t+end*t*t;width=.0065+(1-t)*.002+math.sin(t*19+index)*.0007
            for col in range(9):
                u=col/8;points.append(p+Vector(((u*2-1)*width,math.sin(u*27+t*19)*.00025,0)));uvs.append((u,t*length*17+index*1.71))
        mesh.grid(points,uvs,80,8);mesh.object('Free-falling drop '+str(index+1),streammat,stream)
    ripple=basic_material('Quiet impact rings',(.40,.57,.50),.15);rp=ripple.node_tree.nodes.get('Principled BSDF');rp.inputs['Alpha'].default_value=.055;rp.inputs['Transmission Weight'].default_value=.8
    for i in range(3):
        bpy.ops.mesh.primitive_torus_add(major_radius=.011+i*.010,minor_radius=.00014,major_segments=72,minor_segments=5,location=route[-1]+Vector((0,0,.0003)))
        bpy.context.object.data.materials.append(ripple)
    # Low local mist is spatial volume and leaves the rest of the pool clear.
    mist=bpy.data.materials.new('Low cascade mist');mist.use_nodes=True;n=mist.node_tree.nodes;l=mist.node_tree.links;n.clear()
    output=n.new('ShaderNodeOutputMaterial');volume=n.new('ShaderNodeVolumePrincipled');volume.inputs['Color'].default_value=(.72,.82,.76,1);volume.inputs['Density'].default_value=.8;l.new(volume.outputs[0],output.inputs['Volume'])
    tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=4;mathnode=n.new('ShaderNodeMath');mathnode.operation='MULTIPLY';mathnode.inputs[1].default_value=1.4;l.new(tex.outputs['Fac'],mathnode.inputs[0]);l.new(mathnode.outputs[0],volume.inputs['Density'])
    for i in range(4):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=1,location=route[-1]+Vector((.02+i*.031,.009,0)))
        o=bpy.context.object;o.name='Low pooling mist';o.scale=(.047,.024,.008);o.data.materials.append(mist)

for i,fish in enumerate(record.get('fish',[])):
    before=set(scene.objects);bpy.ops.import_scene.gltf(disable_bone_shape=True,filepath=os.path.join(ROOT,'site/public/render-assets/models/neon-tetra.glb'))
    imported=[o for o in scene.objects if o not in before];group=root('Neon tetra '+str(i+1));group.scale=(fish['size']/.956,)*3
    for o in imported:
        if o.parent is None:o.parent=group
    x,y,z=fish['position'];group.location=(x,-z,y);group.rotation_euler.z=fish['yaw']

scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True;scene.cycles.max_bounces=10
# Prefer the available local GPU for inspection without saving user preferences.
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
    if any(device.type=='METAL' for device in prefs.devices):
        for device in prefs.devices:device.use=device.type=='METAL'
        scene.cycles.device='GPU'
except (TypeError,RuntimeError):pass

scene.render.resolution_x=1800;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.world.use_nodes=True
bg=scene.world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(.14,.18,.16,1);bg.inputs['Strength'].default_value=.42
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
floor=basic_material('Studio surround',(.018,.043,.034),.75)
cube('Studio surface',(0,0,-.032),(200,200,.024),floor)

def area(name,location,target,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='RECTANGLE';data.size=size;data.size_y=size*.5;data.color=color
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=location;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Aquarium overhead softbox',(-.12,-.02,.76),(0,0,.1),10,.75,(1,.97,.86))
area('Cool front fill',(.35,-.70,.45),(0,0,.17),5,.70,(.78,.87,1))
area('Back canopy separation',(-.35,.35,.63),(0,0,.23),5,.45,(.80,1,.86))
data=bpy.data.cameras.new('Aquascape inspection camera');camera=bpy.data.objects.new('Aquascape inspection camera',data);bpy.context.collection.objects.link(camera);scene.camera=camera;data.lens=52
cameras=[('scape-front',(0,-1.58,.57),(0,0,.205),52),('scape-perspective',(.83,-1.46,.80),(0,0,.21),53),('scape-rock-close',(-.45,-.62,.39),(-.265,-.005,.17),63),('scape-root-close',(.17,-.66,.35),(.075,0,.20),56)]
only=os.environ.get('FISHY_SCAPE_VIEW','')
for name,location,target,lens in cameras:
    if only and name not in only.split(','):continue
    camera.location=location;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=lens
    scene.render.filepath=os.path.join(OUT,'renders',name+'.png');bpy.ops.render.render(write_still=True)
    if name=='scape-front':
        bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'blender/fishy-riverbank-study.blend'))
    print('FISHY_SCAPE_RENDER',scene.render.filepath,flush=True)
