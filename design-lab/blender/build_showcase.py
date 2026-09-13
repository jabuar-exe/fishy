"""Fishy / Living arc. Original deterministic procedural aquarium, Blender 5.x.
Run: Blender --background --factory-startup --python build_showcase.py -- --suite
All measurements metres. Never overwrites a run directory.
"""
import bpy, math, random, json, argparse, sys, datetime
from pathlib import Path
from mathutils import Vector

P=argparse.ArgumentParser()
P.add_argument('--suite',action='store_true'); P.add_argument('--width',type=float,default=.60); P.add_argument('--depth',type=float,default=.30); P.add_argument('--height',type=float,default=.36)
P.add_argument('--wood-style',choices=['arch','stump','angular'],default='arch'); P.add_argument('--wood-scale',type=float,default=1)
P.add_argument('--plant-category',choices=['mixed','grass','fern','stem'],default='mixed'); P.add_argument('--plant-height',type=float,default=.14); P.add_argument('--plant-density',type=float,default=1.4)
P.add_argument('--water-quality',choices=['off','simple','rippled'],default='rippled'); P.add_argument('--samples',type=int,default=24); P.add_argument('--resolution',type=int,default=1100)
P.add_argument('--output',type=Path); P.add_argument('--seed',type=int,default=41)
A=P.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if min(A.width,A.depth,A.height)<.15: raise ValueError('Tank dimensions must be >= 0.15 metres')
if not (0<A.wood_scale<=3 and 0<A.plant_height<=1 and 0<=A.plant_density<=3): raise ValueError('Scales: wood (0,3], plant height (0,1], density [0,3]')
RUN=A.output or Path(__file__).parent/'runs'/datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
RUN.mkdir(parents=True,exist_ok=False)
R=random.Random(A.seed); assets=[]; notes=[]

def mat(name,color,rough=.6,noise=0,metal=0,trans=0,alpha=1):
 m=bpy.data.materials.new(name); m.use_nodes=True; m.diffuse_color=(*color,alpha)
 bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal; bs.inputs['Transmission Weight'].default_value=trans; bs.inputs['Alpha'].default_value=alpha
 if trans: bs.inputs['IOR'].default_value=1.333 if 'Water' in name else 1.45
 if noise:
  n=m.node_tree.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value=noise; n.inputs['Detail'].default_value=3
  ramp=m.node_tree.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color=(*(c*.55 for c in color),1); ramp.color_ramp.elements[1].color=(*(min(c*1.4,1) for c in color),1)
  m.node_tree.links.new(n.outputs['Fac'],ramp.inputs[0]); m.node_tree.links.new(ramp.outputs[0],bs.inputs['Base Color'])
  bump=m.node_tree.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.25; bump.inputs['Distance'].default_value=.0015; m.node_tree.links.new(n.outputs['Fac'],bump.inputs['Height']); m.node_tree.links.new(bump.outputs[0],bs.inputs['Normal'])
 return m

def obj(name,verts,faces,mats,kind,inds=None,loc=(0,0,0)):
 mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update(); o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); o.location=loc
 for m in mats: mesh.materials.append(m)
 for i,p in enumerate(mesh.polygons): p.use_smooth=kind not in ['substrate','sand']; p.material_index=inds[i] if inds else 0
 o['fishy_id']=name; o['fishy_kind']=kind; o['source']='original procedural geometry'; o['units']='metres'; assets.append(o); return o

def cube(name,loc,dim,m,kind,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name; o.dimensions=dim; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(m)
 o['fishy_id']=name; o['fishy_kind']=kind; assets.append(o)
 if bevel: mod=o.modifiers.new('Polished edges','BEVEL'); mod.width=bevel; mod.segments=2; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def tube(v,f,points,radii,sides=10):
 # Catmull-Rom sweep: organic curvature without axis scaling.
 pts=[Vector(p) for p in points]; fine=[]; rs=[]
 for j in range(len(pts)-1):
  p0=pts[max(j-1,0)]; p1=pts[j]; p2=pts[j+1]; p3=pts[min(j+2,len(pts)-1)]
  for q in range(5):
   t=q/5; fine.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)); rs.append(radii[j]*(1-t)+radii[j+1]*t)
 fine.append(pts[-1]); rs.append(radii[-1]); base=len(v)
 for j,p in enumerate(fine):
  tangent=(fine[min(j+1,len(fine)-1)]-fine[max(j-1,0)]).normalized(); u=tangent.cross(Vector((0,1,0))).normalized(); w=tangent.cross(u).normalized()
  for k in range(sides):
   a=2*math.pi*k/sides; rr=rs[j]*(1+.13*math.sin(k*3+j*.6)); v.append(tuple(p+rr*(u*math.cos(a)+w*math.sin(a))))
 for j in range(len(fine)-1):
  for k in range(sides): a=base+j*sides+k; b=base+j*sides+(k+1)%sides; f.append((a,b,b+sides,a+sides))
 f.append(tuple(base+k for k in reversed(range(sides)))); f.append(tuple(base+(len(fine)-1)*sides+k for k in range(sides)))

def leaf(v,f,base,direction,length,width,bend=.3):
 b=Vector(base); d=Vector(direction).normalized(); side=d.cross(Vector((0,0,1)))
 if side.length<.01: side=Vector((1,0,0))
 side.normalize(); start=len(v)
 for j in range(7):
  t=j/6; center=b+d*(length*t)+Vector((0,0,length*bend*math.sin(math.pi*t))); breadth=width*(math.sin(math.pi*t)**.85+.015)
  for k in [-1,0,1]: v.append(tuple(center+side*breadth*k+Vector((0,0,-abs(k)*breadth*.2))))
 for j in range(6):
  for k in range(2): a=start+j*3+k; f.append((a,a+1,a+4,a+3))

def terrain_z(x,y,W,D): return .020+.022*((y/D)+.5)+.011*math.cos(x/W*8)**2

def path_x(y,W,D): return W*(.06+.18*math.sin((y/D+.5)*3.8))

def build(name,W,D,H,style):
 global assets,notes,R
 bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False); assets=[]; notes=[]; R=random.Random(A.seed)
 scene=bpy.context.scene; scene.unit_settings.system='METRIC'; scene['tank_dimensions_m']=[W,D,H]; scene['wood_style']=style; scene['seed']=A.seed
 wood=mat('Wood / warm bogwood',(.09,.032,.012),.82,95); stone=mat('Stone / layered charcoal',(.13,.16,.145),.9,130)
 soil=mat('Soil / dark aquasoil',(.045,.032,.018),.94,420); sand=mat('Sand / pale river quartz',(.68,.61,.43),.92,750)
 greens=[mat('Leaf / forest',(.035,.18,.023),.52),mat('Leaf / lime',(.18,.38,.045),.5),mat('Leaf / olive',(.10,.25,.02),.56),mat('Leaf / copper',(.32,.10,.037),.58)]
 glass=mat('Glass / optical',(.72,.91,.84),.12,alpha=.035); water=mat('Water / clear optical approximation',(.42,.73,.69),.13,alpha=.045)
 # Soil bank grid and curving open sand channel.
 for part in ['left','path','right']:
  v=[]; f=[]; nx=14; ny=36
  for j in range(ny+1):
   y=-D*.48+D*.96*j/ny; c=path_x(y,W,D); half=W*(.13-.055*j/ny)
   lo,hi= {'left':(-W*.485,c-half),'path':(c-half,c+half),'right':(c+half,W*.485)}[part]
   for k in range(nx+1):
    x=lo+(hi-lo)*k/nx; z=terrain_z(x,y,W,D)
    if part=='path': z-=.007
    v.append((x,y,z))
  for j in range(ny):
   for k in range(nx): a=j*(nx+1)+k; f.append((a,a+1,a+nx+2,a+nx+1))
  perimeter=list(range(nx+1))+[j*(nx+1)+nx for j in range(1,ny+1)]+[ny*(nx+1)+k for k in range(nx-1,-1,-1)]+[j*(nx+1) for j in range(ny-1,0,-1)]
  bottom=len(v)
  for q in perimeter: v.append((v[q][0],v[q][1],.010))
  for q in range(len(perimeter)): f.append((perimeter[q],bottom+q,bottom+(q+1)%len(perimeter),perimeter[(q+1)%len(perimeter)]))
  obj('bed.'+part,v,f,[sand if part=='path' else soil],'sand' if part=='path' else 'substrate')
 cube('bed.foundation',(0,0,.005),(W*.98,D*.98,.010),soil,'substrate')
 # Whole wood is one selectable asset. Source geometry in physical metres.
 v=[]; f=[]
 if style=='arch':
  branches=[([(-.18,.018,.038),(-.145,.02,.12),(-.08,.035,.20),(.005,.03,.245),(.08,.027,.22),(.15,.04,.15)],[.039,.029,.022,.015,.009,.0018]),
   ([(-.135,.02,.13),(-.17,.035,.21),(-.145,.04,.28),(-.11,.045,.30)],[.019,.011,.005,.001]),
   ([(-.065,.032,.205),(-.07,.065,.26),(-.015,.065,.30),(.025,.06,.29)],[.014,.009,.004,.001]),
   ([(.025,.03,.24),(.065,-.015,.27),(.12,-.03,.26),(.145,-.02,.28)],[.01,.007,.003,.0007]),
   ([(-.15,.02,.1),(-.10,-.035,.08),(-.025,-.07,.075),(.035,-.075,.043)],[.018,.012,.006,.001]),
   ([(.105,.03,.20),(.12,.055,.135),(.10,.08,.06),(.145,.085,.043)],[.007,.005,.003,.001])]
 elif style=='stump':
  branches=[([(0,.02,.03),(-.018,.025,.12),(.007,.026,.20),(-.003,.03,.25)],[.06,.047,.032,.015])]
  for k in range(9):
   a=k*2.4; x=math.cos(a); y=math.sin(a); branches.append(([(0,.025,.09),(.06*x,.025+.055*y,.05),(.13*x,.025+.09*y,.036)],[.025,.015,.0015]))
  for k in range(6):
   a=k*2.4; branches.append(([(-.01,.025,.14),(.05*math.cos(a),.025+.035*math.sin(a),.22),(.105*math.cos(a),.025+.06*math.sin(a),.285)],[.016,.009,.001]))
 else:
  branches=[([(-.22,.025,.04),(-.13,.025,.12),(-.05,.025,.14),(.015,.025,.23),(.10,.025,.28)],[.025,.021,.014,.006,.001]),([(-.06,.025,.14),(.02,.035,.145),(.105,.03,.205),(.19,.025,.23)],[.01,.009,.004,.001]),([(-.12,.025,.12),(-.12,.065,.205),(-.19,.07,.265)],[.01,.006,.001]),([(.10,.03,.205),(.15,-.025,.265),(.22,-.03,.27)],[.004,.002,.0007])]
 if style!='stump':
  for k in range(7):
   a=k*1.1; branches.append(([(-.18,.02,.065),(-.18+.045*math.cos(a),.02+.045*math.sin(a),.045),(-.18+.08*math.cos(a),.02+.065*math.sin(a),.033)],[.018,.010,.001]))
 for points,radii in branches: tube(v,f,points,radii,12)
 mins=[min(p[i] for p in v) for i in range(3)]; maxs=[max(p[i] for p in v) for i in range(3)]; size=[maxs[i]-mins[i] for i in range(3)]
 fit=min(W*.86/size[0],D*.82/size[1],(H-.06)/size[2],A.wood_scale)
 if fit<A.wood_scale: notes.append(f'Wood requested scale {A.wood_scale:.3f} fit uniformly to {fit:.3f} to stay within tank.')
 center=[(maxs[i]+mins[i])/2 for i in range(3)]; vv=[((p[0]-center[0])*fit-.025*W,(p[1]-center[1])*fit+.04*D,(p[2]-mins[2])*fit+.032) for p in v]
 o=obj('hardscape.wood.'+style,vv,f,[wood],'wood'); o['requested_uniform_scale']=A.wood_scale; o['fitted_uniform_scale']=fit; o['wood_style']=style
 # Stone clusters around the wood footing; retain nominal physical sizes and fit.
 for k,(u,t,s) in enumerate([(-.31,-.10,.073),(-.22,.20,.059),(-.40,.22,.043),(-.10,.35,.035),(.34,.17,.06),(.39,-.14,.046),(.26,.36,.04),(-.35,-.30,.029),(.27,-.30,.025)]):
  x=u*W; y=t*D; s=min(s,W*.15,D*.25,H*.24,(W*.49-abs(x))/1.2,(D*.49-abs(y))/.8)
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,terrain_z(x,y,W,D)+s*.28)); o=bpy.context.object; o.name=f'hardscape.stone.{k:02d}'
  for q in o.data.vertices: q.co*=R.uniform(.80,1.14)
  o.scale=(s,s*.65,s*.70); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(stone); o['fishy_id']=o.name; o['fishy_kind']='stone'; assets.append(o)
 # Plants have distinct botanical silhouettes: ribbon grass, paired stem leaves, divided fern fronds.
 for k in range(round(37*A.plant_density)):
  u=R.uniform(-.43,.43); t=R.uniform(-.36,.42); y=t*D; x=u*W; c=path_x(y,W,D)
  if abs(x-c)<W*.145: x=c+(-1 if x<c else 1)*W*.16
  x=max(-W*.42,min(W*.42,x)); base=(x,y,terrain_z(x,y,W,D)+.001)
  cat=A.plant_category if A.plant_category!='mixed' else ('stem' if t>.19 else ('grass' if t<-.12 else 'fern'))
  h=A.plant_height*(1.15 if cat=='stem' else (.6 if cat=='fern' else .45))*R.uniform(.75,1.2); h=min(h,H-base[2]-.035)
  margin=min(W*.485-abs(x),D*.485-abs(y)); spread=min(.036,margin*.85)
  v=[]; f=[]; inds=[]
  def colorfill(n,mi): inds.extend([mi]*(len(f)-n))
  if cat=='grass':
   for j in range(30):
    a=R.uniform(0,math.tau); b=Vector(base)+Vector((R.uniform(-spread/2,spread/2),R.uniform(-spread/2,spread/2),0)); n=len(f)
    leaf(v,f,b,(math.cos(a)*.35,math.sin(a)*.35,1),h*R.uniform(.55,1),.0017,.0); colorfill(n,j%3)
  elif cat=='stem':
   for j in range(10):
    sx=x+R.uniform(-spread/2,spread/2); sy=y+R.uniform(-spread/2,spread/2); sh=h*R.uniform(.65,1); n=len(f)
    tube(v,f,[(sx,sy,base[2]),(sx+.004,sy,base[2]+sh)], [.0007,.0003],5); colorfill(n,2)
    for level in range(1,7):
     a=j*2.4+level*1.6
     for flip in [0,math.pi]:
      n=len(f); leaf(v,f,(sx+.004*level/7,sy,base[2]+sh*level/7),(math.cos(a+flip),math.sin(a+flip),.4),min(.023,spread)*(.7+.3*level/7),.0045,.15); colorfill(n,3 if (k%5==0) else j%3)
  else:
   for j in range(10):
    a=j*2.4; d=Vector((math.cos(a)*.6,math.sin(a)*.6,.8)); ln=min(h,spread*2); n=len(f)
    tube(v,f,[base,Vector(base)+d*ln],[.0007,.0002],5); colorfill(n,0)
    side=Vector((-math.sin(a),math.cos(a),.15))
    for level in range(1,8):
     for sign in [-1,1]:
      n=len(f); leaf(v,f,Vector(base)+d*ln*level/9,side*sign+d*.3,ln*.3*(1-level/11),.0035,.1); colorfill(n,j%3)
  ob=obj(f'plants.{cat}.{k:03d}',v,f,greens,'plant',inds); ob['plant_category']=cat; ob['height_m']=h; ob['normalized_anchor']=[x/W,y/D]; ob['density']=A.plant_density
 # Fine gravel is one bounded mesh, no thousands of scene nodes.
 v=[]; f=[]
 for k in range(420):
  y=R.uniform(-D*.46,D*.46); x=R.uniform(-W*.47,W*.47)
  if abs(x-path_x(y,W,D))<W*.10: continue
  r=R.uniform(.0008,.0025); z=terrain_z(x,y,W,D); n=len(v); v.extend([(x+r,y,z),(x-r,y,z),(x,y+r,z),(x,y-r,z),(x,y,z+r)]); f.extend([(n,n+2,n+4),(n+2,n+1,n+4),(n+1,n+3,n+4),(n+3,n,n+4)])
 obj('bed.gravel',v,f,[sand],'gravel')
 # Thin separate glass panes, unobstructed rimless silhouette.
 thick=.003
 for ident,loc,dim in [('base',(0,0,-.0015),(W,D,.003)),('front',(0,-D/2,H/2),(W,thick,H)),('back',(0,D/2,H/2),(W,thick,H)),('left',(-W/2,0,H/2),(thick,D,H)),('right',(W/2,0,H/2),(thick,D,H))]: cube('tank.glass.'+ident,loc,dim,glass,'glass',.0006)
 if A.water_quality!='off':
  v=[]; f=[]; nx=60 if A.water_quality=='rippled' else 1; ny=32 if nx>1 else 1
  for j in range(ny+1):
   for i in range(nx+1):
    x=-W*.493+W*.986*i/nx; y=-D*.49+D*.98*j/ny; z=H-.017
    if nx>1: z+=.00065*math.sin(x*95+y*62)+.00035*math.sin(y*137-x*44)
    v.append((x,y,z))
  for j in range(ny):
   for i in range(nx): q=j*(nx+1)+i; f.append((q,q+1,q+nx+2,q+nx+1))
  obj('water.surface',v,f,[water],'water')['optical_model']='surface only; no hydrodynamics, no filled volume'
 # Studio assets deliberately excluded from GLB.
 pedestal=mat('Studio / charcoal',(.026,.036,.032),.65); floor=mat('Studio / warm grey',(.12,.15,.14),.78)
 cube('studio.plinth',(0,0,-.016),(W+.02,D+.02,.025),pedestal,'studio',.005)
 cube('studio.floor',(0,0,-.038),(200,200,.02),floor,'studio')
 def area(name,loc,power,size,color,target=(0,0,.10)):
  data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size; data.color=color; o=bpy.data.objects.new(name,data); scene.collection.objects.link(o); o.visible_glossy=False; o.location=loc; o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
 area('Key softbox',(-.25,-.10,.95),55,.65,(1,.91,.76)); area('Rim softbox',(.2,.40,.65),75,.45,(.78,.90,1)); area('Fill',(-.5,-.6,.30),18,.5,(.9,1,.91))
 world=scene.world or bpy.data.worlds.new('Studio'); scene.world=world; world.use_nodes=True; world.node_tree.nodes.get('Background').inputs[0].default_value=(.17,.20,.18,1); world.node_tree.nodes.get('Background').inputs[1].default_value=.3
 bpy.ops.object.camera_add(location=(W*.94,-max(W*.95,D*1.8),H*.92)); camera=bpy.context.object; camera.name='Studio hero camera'; target=Vector((0,0,H*.44)); camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=max(W*1.47,D*1.9,H*1.7); camera.data.lens=45; camera.location=target+(camera.location-target)*3; scene.camera=camera
 scene.render.engine='CYCLES'; scene.cycles.samples=A.samples; scene.cycles.use_denoising=True; scene.cycles.max_bounces=8; scene.cycles.transmission_bounces=6; scene.cycles.transparent_max_bounces=16
 scene.render.resolution_x=A.resolution; scene.render.resolution_y=round(A.resolution*.78); scene.render.resolution_percentage=100; scene.render.image_settings.file_format='PNG'; scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
 # Per-asset pivots for browser and native transforms.
 bpy.ops.object.select_all(action='DESELECT')
 for o in assets:
  if o.get('fishy_kind')!='studio': o.select_set(True)
 bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY',center='BOUNDS')
 for screen in bpy.data.screens:
  for ar in screen.areas:
   if ar.type=='VIEW_3D':
    ar.spaces.active.shading.type='MATERIAL'; ar.spaces.active.region_3d.view_perspective='CAMERA'
 bpy.ops.object.select_all(action='DESELECT')
 selected=bpy.data.objects.get('hardscape.wood.'+style); selected.select_set(True); bpy.context.view_layer.objects.active=selected
 # Strict pre-export containment audit for interior decor.
 bpy.context.view_layer.update(); bounds=[]; overflow=[]
 for o in assets:
  if o.get('fishy_kind') in ['studio','glass']: continue
  coords=[o.matrix_world@Vector(p) for p in o.bound_box]; mn=[min(p[i] for p in coords) for i in range(3)]; mx=[max(p[i] for p in coords) for i in range(3)]
  if mn[0]<-W/2 or mx[0]>W/2 or mn[1]<-D/2 or mx[1]>D/2 or mn[2]<-.001 or mx[2]>H: overflow.append(o.name)
  bounds.append({'id':o.name,'min':mn,'max':mx})
 if overflow: raise RuntimeError('Interior overflow: '+str(overflow))
 dest=RUN/name; dest.mkdir(); scene.render.filepath=str(dest/'beauty.png'); bpy.ops.wm.save_as_mainfile(filepath=str(dest/'aquarium.blend')); bpy.ops.render.render(write_still=True)
 # Export portable constant PBR. The native beauty retains procedural microtextures.
 saved=[]
 for m in bpy.data.materials:
  if not m.use_nodes: continue
  bs=m.node_tree.nodes.get('Principled BSDF')
  for socket in ['Base Color','Normal']:
   for l in list(bs.inputs[socket].links): saved.append((m,l.from_socket,l.to_socket)); m.node_tree.links.remove(l)
 bpy.ops.object.select_all(action='DESELECT')
 for o in assets:
  if o.get('fishy_kind')!='studio': o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(dest/'aquarium.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
 # Viewer-safe option: no glass/water when runtime supplies tank shader.
 for o in assets:
  if o.get('fishy_kind') in ['glass','water']: o.select_set(False)
 bpy.ops.export_scene.gltf(filepath=str(dest/'hardscape.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
 for m,src,dst in saved: m.node_tree.links.new(src,dst)
 chosen=[o for o in assets if o.get('fishy_kind')!='studio']; triangles=0
 for o in chosen: o.data.calc_loop_triangles(); triangles+=len(o.data.loop_triangles)
 report={'name':name,'dimensions_m':[W,D,H],'style':style,'objects':len(chosen),'triangles':triangles,'glb_bytes':(dest/'aquarium.glb').stat().st_size,'hardscape_glb_bytes':(dest/'hardscape.glb').stat().st_size,'overflow':overflow,'notes':notes,'bounds':bounds,'config':{k:str(v) if isinstance(v,Path) else v for k,v in vars(A).items()}}
 (dest/'audit.json').write_text(json.dumps(report,indent=2)); print('FISHY_COMPLETE '+json.dumps({k:v for k,v in report.items() if k not in ['bounds','config']}),flush=True)
 return report
reports=[]
if A.suite:
 for cfg in [('hero-60-arch',.60,.30,.36,'arch'),('panorama-90-angular',.90,.30,.30,'angular'),('cube-45-stump',.45,.45,.45,'stump')]: reports.append(build(*cfg))
else: reports.append(build('custom',A.width,A.depth,A.height,A.wood_style))
(RUN/'manifest.json').write_text(json.dumps(reports,indent=2)); print('RUN_DIRECTORY '+str(RUN),flush=True)
