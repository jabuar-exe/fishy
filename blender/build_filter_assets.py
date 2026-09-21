"""Original filter housings, exact catalog envelopes, separate non-coplanar seams.
No vendor CAD/textures copied. Runtime hoses attach to the shared outlet datum.
"""
import bpy,json,os,math,sys
from mathutils import Vector, Matrix
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'workstreams/filters-fish-ui-20260921')
MODELS=os.path.join(ROOT,'site/public/render-assets/filters')
THUMBS=os.path.join(ROOT,'site/public/render-assets/filter-thumbnails')
for p in [MODELS,THUMBS,OUT+'/filter-renders']:os.makedirs(p,exist_ok=True)
entries=json.load(open(OUT+'/filters.json'))

def clear():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def material(name,color,rough=.45,metal=.08):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m

def box(name,pos,size,mat,r=.003):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 if r:
  mod=o.modifiers.new('Moulded edge radius','BEVEL');mod.width=min(r,min(size)*.22);mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('Weighted manufactured normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def cylinder(name,pos,radius,height,mat):
 bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=radius,depth=height,location=pos);o=bpy.context.object;o.name=name;o.data.materials.append(mat)
 mod=o.modifiers.new('Turned edge radius','BEVEL');mod.width=min(.001,height*.12);mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
 for p in o.data.polygons:p.use_smooth=True
 mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def housing(e):
 before=set(bpy.context.scene.objects)
 w,d,h=[x/100 for x in e['system']['nominalDimensionsCm']];family='eheim' if 'eheim' in e['id'] else 'fluval' if 'fluval' in e['id'] else 'hob' if e['system']['silhouette']=='hob' else 'oase'
 colors={'oase':(.063,.087,.075),'fluval':(.065,.072,.078),'eheim':(.07,.19,.096),'hob':(.055,.071,.078)}
 plastic=material('Satin moulded polymer '+family,colors[family],.46,.04);dark=material('Graphite motor head',(.018,.025,.026),.32,.12);rubber=material('Rubber seals and feet',(.009,.013,.012),.79,0);accent=material('Locking controls '+family,(.26,.025,.020) if family=='fluval' else (.10,.13,.115),.42,.09);metal=material('Brushed screw heads',(.29,.33,.32),.29,.8)
 if family=='eheim':
  cylinder('Round canister vessel',(0,0,h*.392),w*.50,h*.764,plastic)
  cylinder('Bottom bumper',(0,0,h*.02),w*.49,h*.04,rubber)
  cylinder('Motor head',(0,0,h*.858),w*.49,h*.144,dark)
  cylinder('Separate lid sealing band',(0,0,h*.78),w*.492,h*.013,rubber)
  for i in range(4):
   a=i*math.pi/2;x=math.cos(a)*w*.466;y=math.sin(a)*d*.466
   o=box('Metal spring clip',(x,y,h*.795),(w*.037,d*.065,h*.11),metal,.001);o.rotation_euler.z=a
 else:
  box('Vessel with rounded shoulders',(0,0,h*.405),(w,h*.0+d,h*.76),plastic,min(w,d)*.07)
  box('Separate lid seal',(0,0,h*.794),(w*.975,d*.975,h*.012),rubber,.001)
  box('Motor head with broad bevel',(0,0,h*.869),(w*.99,d*.99,h*.132),dark,min(w,d)*.10)
  for side in [-1,1]:
   box('Latch rocker',(side*w*.459,-d*.23,h*.798),(w*.07,d*.22,h*.132),accent,.003)
   for end in [-1,1]:box('Anti-vibration foot',(side*w*.33,end*d*.32,h*.011),(w*.19,d*.20,h*.022),rubber,.002)
  # Shallow ribs stand clear of the wall: no coincident exterior faces.
  for side in [-1,1]:
   for i in range(5):box('Raised side reinforcement',(side*w*.487,(i-2)*d*.12,h*.37),(w*.030,d*.023,h*.48),plastic,.001)
 if family=='oase':
  cylinder('Pre-filter extraction cap',(-w*.23,d*.20,h*.942),w*.12,h*.035,accent)
  for i in range(10):
   a=i*math.tau/10;box('Cap grip',(-w*.23+math.cos(a)*w*.111,d*.20+math.sin(a)*w*.111,h*.946),(w*.023,w*.023,h*.028),accent,.001)
 if family=='hob':
  box('Removable media access panel',(0,-d*.07,h*.943),(w*.68,d*.64,h*.023),plastic,.004)
  cylinder('Flow adjustment dial',(w*.27,d*.22,h*.952),w*.075,h*.035,accent)
 else:
  for side in [-1,1]:
   cylinder('Hose socket',(side*w*.24,0,h*.961),w*.045,h*.064,accent)
   cylinder('Recessed socket opening',(side*w*.24,0,h*.994),w*.029,h*.002,rubber)
  box('Carry handle bridge',(0,d*.21,h*.954),(w*.39,d*.066,h*.041),dark,.003)
  for side in [-1,1]:box('Carry handle stanchion',(side*w*.176,d*.21,h*.936),(w*.041,d*.066,h*.051),dark,.002)
 for side in [-1,1]:
  for end in [-1,1]:cylinder('Recessed lid screw',(side*w*.38,end*d*.32,h*.938),.0019,.0014,metal)
 # Exactly preserve the catalog outer envelope and put the ground datum at Z=0.
 bpy.context.view_layer.update()
 objects=[o for o in bpy.context.scene.objects if o not in before and o.type=='MESH'];points=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
 lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);factor=Vector((w/(hi.x-lo.x),d/(hi.y-lo.y),h/(hi.z-lo.z)))
 for o in objects:
  for v in o.data.vertices:
   p=o.matrix_world@v.co;v.co=((p.x-(lo.x+hi.x)/2)*factor.x,(p.y-(lo.y+hi.y)/2)*factor.y,(p.z-lo.z)*factor.z)
  o.matrix_world=Matrix.Identity(4)
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();model=bpy.context.object;model.name=e['displayLabel']+' · original housing'
 # Manufactured solid colours need no photo-texture UVs; explicit normals retained.
 return model,(w,d,h)

def setup(size):
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
 try:
  prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
  for device in prefs.devices:device.use=device.type=='METAL'
  scene.cycles.device='GPU'
 except:pass
 scene.world.color=(.17,.17,.17);scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
 w,d,h=size
 floor=material('Inspection floor',(.16,.20,.18),.83)
 box('Inspection floor',(0,0,-.014),(5,5,.022),floor,0)
 for name,pos,power,scale in [('Softbox',(-1,-1.2,1.5),70,1.3),('Rim',(.6,.8,1.2),60,.8),('Fill',(1,-.7,.6),35,.9)]:
  data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=scale;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,h*.5))-o.location).to_track_quat('-Z','Y').to_euler()
 data=bpy.data.cameras.new('Inspection camera');camera=bpy.data.objects.new('Inspection camera',data);scene.collection.objects.link(camera);scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=max(h*1.45,w*1.9,d*1.9)
 return camera

source_paths=[]
for e in entries:
 if os.environ.get("FILTER_MASTER_ONLY"):break
 clear();model,size=housing(e);bpy.ops.object.select_all(action='DESELECT');model.select_set(True);bpy.context.view_layer.objects.active=model
 path=MODELS+'/'+e['id']+'.glb';bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_apply=True)
 # Inspect an actual exported/reimported asset, not only authoring geometry.
 clear();bpy.ops.import_scene.gltf(filepath=path);camera=setup(size);h=size[2]
 for label,pos in [('front',(.65,-1,.65)),('reverse',(-.65,1,.55))]:
  camera.location=Vector(pos)*max(h,.30)*2.4;target=Vector((0,0,h*.47));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
  bpy.context.scene.render.filepath=OUT+'/filter-renders/'+e['id']+'-'+label+'.png';bpy.ops.render.render(write_still=True)
  if label=='front':
   bpy.context.scene.render.resolution_x=320;bpy.context.scene.render.resolution_y=320;bpy.context.scene.render.filepath=THUMBS+'/'+e['id']+'.png';bpy.ops.render.render(write_still=True);bpy.context.scene.render.resolution_x=1000;bpy.context.scene.render.resolution_y=1000
 bpy.ops.wm.save_as_mainfile(filepath=OUT+'/filter-renders/'+e['id']+'.blend');source_paths.append(path)
 print('FILTER_INSPECTED',e['id'],flush=True)
clear()
for i,e in enumerate(entries):
 model,size=housing(e);model.location.x=(i%5)*.38;model.location.y=(i//5)*.43
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blender/fishy-filter-assets.blend')
print('FILTER_BUILD_COMPLETE',len(entries),flush=True)
