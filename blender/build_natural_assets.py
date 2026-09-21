"""Astra-authored natural geometry. Blender Z-up; glTF export handles Y-up.

Editable geometry and deterministic botanical texture construction are original.
Stone/bark scans are CC0; see material-sources/materials-provenance.json.
Run: Blender --background --python blender/build_natural_assets.py
"""
import bpy
import math
import os
import random
import json
import glob
import numpy as np
from mathutils import Vector, noise

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "site/public/render-assets")
MODELS = os.path.join(OUT, "models")
TEXTURES = os.path.join(OUT, "textures")
SOURCES = os.path.join(ROOT, "blender/material-sources")
TAU = math.tau
for p in (MODELS, TEXTURES): os.makedirs(p, exist_ok=True)

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def root(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj

def basic_material(name, color, roughness=.5, metallic=0):
    mat = bpy.data.materials.get(name)
    if mat: return mat
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metallic
    return mat

def texture_node(mat, path, channel, noncolor=False):
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = bpy.data.images.load(path, check_existing=True)
    if noncolor: node.image.colorspace_settings.name = 'Non-Color'
    if channel == 'Normal':
        normal = mat.node_tree.nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value = .65
        mat.node_tree.links.new(node.outputs['Color'], normal.inputs['Color'])
        mat.node_tree.links.new(normal.outputs['Normal'], mat.node_tree.nodes.get('Principled BSDF').inputs[channel])
    else:
        mat.node_tree.links.new(node.outputs['Color'], mat.node_tree.nodes.get('Principled BSDF').inputs[channel])

def scan_material(name, kind, asset_override=None):
    existing = bpy.data.materials.get(name)
    if existing: return existing
    mat = basic_material(name, (.28, .27, .23) if kind == 'rock' else (.12, .065, .029), .63)
    candidates = sorted(glob.glob(os.path.join(SOURCES, '**', '*'), recursive=True))
    # The scan fetcher records a preferred asset for each category.
    selection_path = os.path.join(SOURCES, 'selection.json')
    selection = json.load(open(selection_path)) if os.path.exists(selection_path) else {}
    asset = asset_override or selection.get(kind, '')
    paths = [p for p in candidates if os.path.isfile(p) and (asset in p if asset else (('rock' in p or 'stone' in p) if kind == 'rock' else ('bark' in p or 'wood' in p)))]
    for channel, keys, noncolor in [('Base Color', ['diff', 'albedo', 'color'], False), ('Roughness', ['rough'], True), ('Normal', ['nor_gl', 'normal_gl', 'normal'], True)]:
        matches = [p for p in paths if p.lower().endswith(('.jpg', '.png')) and any(k in os.path.basename(p).lower() for k in keys)]
        if matches: texture_node(mat, matches[0], channel, noncolor)
        else: print('MISSING_SCAN', kind, channel)
    return mat

def save_image(name, rgb, noncolor=False):
    h,w,_ = rgb.shape
    im = bpy.data.images.get(name) or bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.ones((h,w,4),dtype=np.float32); rgba[:,:,:3] = np.clip(rgb,0,1)
    im.pixels.foreach_set(rgba.ravel())
    im.file_format='PNG'; im.filepath_raw=os.path.join(TEXTURES,name+'.png'); im.save()
    if noncolor: im.colorspace_settings.name='Non-Color'
    return im.filepath_raw

def leaf_material():
    name='Living foliage · wax cuticle and branching veins'
    if bpy.data.materials.get(name): return bpy.data.materials[name]
    n=512; v,u=np.mgrid[0:1:complex(n),-1:1:complex(n)]
    rng=np.random.default_rng(2903)
    grain=rng.normal(0,.008,(n,n))
    midrib=np.exp(-(u/.025)**2)
    branch_distance=np.abs(np.sin((v-np.abs(u)*.19)*math.pi*11))
    veins=np.exp(-(branch_distance/.095)**2)*(1-np.exp(-(u/.07)**2))
    secondary=np.exp(-(np.abs(np.sin((v+np.abs(u)*.16)*math.pi*39))/.09)**2)*.20
    mottling=np.sin(v*28+np.sin(u*13))*np.sin(u*25+v*8)*.012
    lum=.030*veins+.036*midrib+.009*secondary+mottling+grain
    rgb=np.stack([.105+lum*.9+.025*(1-v), .255+lum*1.8+.045*(1-v), .043+lum*.48],axis=2)
    mat=basic_material(name,(1,1,1),.43)
    texture_node(mat,save_image('botanical-leaf-albedo',rgb),'Base Color')
    rough=np.repeat((.54+grain*.9-.04*midrib+.055*np.sin(v*11))[...,None],3,axis=2)
    texture_node(mat,save_image('botanical-leaf-roughness',rough,True),'Roughness',True)
    h=.22*midrib+.07*veins+secondary*.025+grain*.06
    dy,dx=np.gradient(h); norm=np.stack([-dx*9,-dy*9,np.ones_like(h)],axis=2)
    norm/=np.linalg.norm(norm,axis=2)[...,None]
    texture_node(mat,save_image('botanical-leaf-normal',norm*.5+.5,True),'Normal',True)
    p=mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Coat Weight'].default_value=.035; p.inputs['Coat Roughness'].default_value=.52
    # glTF exports double-sided leaves without requiring thick plastic geometry.
    mat.use_backface_culling=False
    return mat

class MeshBuilder:
    def __init__(self): self.vertices=[]; self.faces=[]; self.uv=[]
    def grid(self, points, uvs, rows, cols):
        start=len(self.vertices); self.vertices.extend(points); self.uv.extend(uvs)
        for r in range(rows):
            for c in range(cols):
                a=start+r*(cols+1)+c
                self.faces.append((a,a+1,a+cols+2,a+cols+1))
    def object(self,name,material,parent,smooth=True):
        mesh=bpy.data.meshes.new(name); mesh.from_pydata(self.vertices,[],self.faces); mesh.update()
        layer=mesh.uv_layers.new(name='Surface UV')
        for poly in mesh.polygons:
            poly.use_smooth=smooth
            for idx in poly.loop_indices: layer.data[idx].uv=self.uv[mesh.loops[idx].vertex_index]
        mesh.materials.append(material)
        obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj); obj.parent=parent
        return obj

def catmull(points,t):
    pts=[Vector(p) for p in points]; x=min(t,.999999)*(len(pts)-1); i=int(x); f=x-i
    a=pts[max(0,i-1)]; b=pts[i]; c=pts[min(i+1,len(pts)-1)]; d=pts[min(i+2,len(pts)-1)]
    return ((b*2)+(c-a)*f+(a*2-b*5+c*4-d)*f*f+(-a+b*3-c*3+d)*f*f*f)*.5

def tube(builder,points,radii,rows=40,sides=12,grooves=0,phase=0):
    pts=[]; uv=[]
    for i in range(rows+1):
        t=i/rows; p=catmull(points,t)
        tangent=(catmull(points,min(1,t+.001))-catmull(points,max(0,t-.001))).normalized()
        side=tangent.cross(Vector((0,1,0)))
        if side.length<.1: side=tangent.cross(Vector((1,0,0)))
        side.normalize(); up=tangent.cross(side).normalized()
        f=min(t,.999999)*(len(radii)-1); j=int(f); radius=radii[j]*(1-(f-j))+radii[min(j+1,len(radii)-1)]*(f-j)
        for k in range(sides+1):
            a=k/sides*TAU
            ridge=1+grooves*(.45*math.cos(a*7+phase+t*2)+.30*math.cos(a*11-t*4)+.20*math.sin(a*3+t*9))
            pts.append(p+(side*math.cos(a)+up*math.sin(a))*radius*ridge)
            uv.append((k/sides,t*2.2))
    builder.grid(pts,uv,rows,sides)
    # Closed ends; branch root caps are buried inside parent wood.
    start=len(builder.vertices)-(rows+1)*(sides+1)
    builder.faces.append(tuple(start+k for k in reversed(range(sides))))
    builder.faces.append(tuple(start+rows*(sides+1)+k for k in range(sides)))

def blade(builder,origin,direction,length,width,arching=.1,cup=.12,phase=0,serration=0,rows=18,cols=6):
    d=Vector(direction).normalized(); side=Vector((-d.y,d.x,0))
    if side.length<.01: side=Vector((1,0,0))
    side.normalize(); normal=side.cross(d).normalized()
    if normal.z<0: normal=-normal
    points=[]; uvs=[]; origin=Vector(origin)
    for i in range(rows+1):
        t=i/rows
        center=origin+d*(length*t)+Vector((0,0,length*arching*math.sin(math.pi*t)-length*.07*t*t))
        profile=(math.sin(math.pi*t)**.72)*(1-.27*t)
        profile*=1+serration*math.cos(t*math.pi*(rows-1))
        for j in range(cols+1):
            s=j/cols*2-1
            twist=.12*math.sin(t*4+phase)*s
            fold=(abs(s)**1.45)*width*cup*profile
            midrib=width*.038*math.exp(-(s/.14)**2)*math.sin(t*math.pi)
            ribs=width*.018*math.sin((t-abs(s)*.19)*math.pi*22)*abs(s)*profile
            point=center+side*(s*width*profile)+normal*(fold+twist*width*profile+midrib+ribs)
            points.append(point);uvs.append((j/cols,t))
    builder.grid(points,uvs,rows,cols)

def make_procedural_fern():
    r=root('Bolbitis · arching pinnate fronds'); leaves=MeshBuilder(); stems=MeshBuilder(); rng=random.Random(7403)
    for f in range(28):
        angle=f*2.399963+rng.uniform(-.28,.28)
        height=rng.uniform(.063,.156); spread=rng.uniform(.035,.072)
        radial=Vector((math.cos(angle),math.sin(angle),0)); lateral=Vector((-math.sin(angle),math.cos(angle),0))
        points=[radial*.004+Vector((0,0,.001)),radial*(spread*.12)+Vector((0,0,height*.44)),radial*(spread*.48)+Vector((0,0,height*.89)),radial*spread+Vector((0,0,height*.84))]
        tube(stems,points,[.0007,.00065,.00038,.00006],30,6)
        pairs=16+f%3
        for pair in range(pairs):
            t=.12+pair/pairs*.85
            pos=catmull(points,t)
            pinna_length=(.029*math.sin((t-.04)*math.pi)**.68+.002)*(height/.132)
            for sign in (-1,1):
                jitter=rng.uniform(.89,1.1)
                direction=lateral*sign*.92+radial*.42+Vector((0,0,.12-.28*t+rng.uniform(-.13,.13)))
                # Pinnae attach directly to the curved rachis, offset alternately.
                origin=catmull(points,min(.99,t+(.014 if sign>0 else 0)))
                blade(leaves,origin,direction,pinna_length*jitter,pinna_length*.15,.08,.17,f+pair*.7,.09,20,4)
        blade(leaves,catmull(points,.92),radial+Vector((0,0,-.15)),.018,.003,.02,.13,f,0,12,4)
    leaves.object('Individually curved fern pinnae',leaf_material(),r)
    stems.object('Continuous attached rachises',basic_material('Fern rachis',(.075,.125,.028),.65),r)
    return r

def make_fern():
    """Adapt the CC0 scanned fern, preserving its irregular leaf silhouettes.
    The original four-clump source is retained untouched in material-sources.
    """
    before=set(bpy.context.scene.objects)
    folder=os.path.join(SOURCES,'fern_02')
    bpy.ops.import_scene.gltf(disable_bone_shape=True,filepath=os.path.join(folder,'fern_02_2k.gltf'))
    imported=[o for o in bpy.context.scene.objects if o not in before]
    chosen=next(o for o in imported if o.name.startswith('fern_02_b'))
    for obj in imported:
        if obj!=chosen:bpy.data.objects.remove(obj,do_unlink=True)
    r=root('Scanned fern · Poly Haven / Rico Cilliers and Rob Tuytel · CC0')
    chosen.parent=r;chosen.location=(0,0,0)
    # The glTF diffusion JPEG omits alpha. Restore its official separate mask
    # before export so actual frond holes survive both visible and shadow passes.
    mat=chosen.data.materials[0];mat=mat.copy();chosen.data.materials[0]=mat;mat.name='Scanned fern cutout · CC0'
    p=mat.node_tree.nodes.get('Principled BSDF')
    alpha=mat.node_tree.nodes.new('ShaderNodeTexImage');alpha.image=bpy.data.images.load(os.path.join(folder,'textures/fern_02_alpha_2k.png'),check_existing=True);alpha.image.colorspace_settings.name='Non-Color'
    mat.node_tree.links.new(alpha.outputs['Color'],p.inputs['Alpha']);mat.use_backface_culling=False
    p.inputs['Coat Weight'].default_value=.08;p.inputs['Coat Roughness'].default_value=.40
    # Metre scale appropriate to a miniature planted tank; shape is not stretched.
    bpy.context.view_layer.update();lo=min(v.co.z for v in chosen.data.vertices);factor=.145/max(v.co.z-lo for v in chosen.data.vertices)
    for v in chosen.data.vertices:v.co=Vector((v.co.x*factor,v.co.y*factor,(v.co.z-lo)*factor))
    chosen.name='Curved scanned fern fronds with real serrations'
    # A planting patch has overlapping crowns rather than one isolated rosette.
    # Offset sizes and headings retain the scan's irregularity at tank scale.
    for index,(angle,scale,offset) in enumerate(((2.1,.79,(.018,.011,.016)),(-1.4,.64,(-.027,-.018,.004)))):
        crown=chosen.copy();crown.data=chosen.data.copy();bpy.context.collection.objects.link(crown)
        crown.parent=r;crown.rotation_euler.z=angle;crown.scale=(scale,)*3;crown.location=offset
        crown.name='Overlapping fern crown '+str(index+2)
    return r

def make_broadleaf():
    r=root('Anubias · cupped venated leaves'); leaves=MeshBuilder(); stems=MeshBuilder(); rng=random.Random(2321)
    tube(stems,[(-.02,0,.004),(0,.004,.009),(.018,-.002,.006)],[.004,.006,.002],20,10)
    for i in range(11):
        a=i*2.399963+rng.uniform(-.3,.3); radius=rng.uniform(.018,.031); height=rng.uniform(.025,.067)
        end=Vector((math.cos(a)*radius,math.sin(a)*radius,height)); base=Vector(((i%4-1.5)*.009,0,.006))
        tube(stems,[base,base*.4+end*.6+Vector((0,0,.003)),end],[.001,.0007,.00032],14,6)
        length=rng.uniform(.040,.066)
        blade(leaves,end,(math.cos(a),math.sin(a),rng.uniform(-.28,.35)),length,length*rng.uniform(.34,.43),.13,.30,a,.025,26,10)
    leaves.object('Cupped broadleaf blades',leaf_material(),r)
    stems.object('Rhizome and petioles',basic_material('Leaf petiole',(.055,.095,.022),.65),r)
    return r

def make_grass():
    r=root('Vallisneria · flowing rooted clump'); mesh=MeshBuilder(); rng=random.Random(67)
    for i in range(58):
        a=rng.random()*TAU; radius=.034*math.sqrt(rng.random()); origin=Vector((math.cos(a)*radius,math.sin(a)*radius,.001))
        height=rng.uniform(.037,.125); lean=rng.uniform(.008,.05); direction=Vector((math.cos(a),math.sin(a),0))
        points=[];uvs=[]
        width=rng.uniform(.0006,.0019)
        side=Vector((-math.sin(a),math.cos(a),0))
        for row in range(21):
            t=row/20; center=origin+direction*(lean*t*t)+Vector((0,0,height*(t-.16*t**4)))
            half=width*(1-t**1.65)*(1+.12*math.sin(t*7+i))
            for col in range(3):
                s=col-1; points.append(center+side*s*half+Vector((0,0,-abs(s)*half*.3)));uvs.append((col/2,t))
        mesh.grid(points,uvs,20,2)
    mesh.object('Tapered ribbon blades',leaf_material(),r)
    return r

def make_wood():
    r=root('Weathered root arch with buttresses'); mesh=MeshBuilder(); mat=scan_material('Scanned weathered bark','bark')
    trunk=[(-.173,.015,.009),(-.152,.008,.106),(-.092,.001,.166),(-.019,.023,.183),(.068,.026,.159),(.133,.027,.015)]
    tube(mesh,trunk,[.010,.010,.012,.012,.015,.032],100,32,.28,1)
    # An irregular upright stump gives the silhouette mass and a focal summit.
    tube(mesh,[(.123,.03,.017),(.113,.032,.074),(.14,.04,.145),(.13,.044,.212),(.108,.046,.241)],[.035,.03,.025,.015,.007],70,24,.32,3)
    branches=[([catmull(trunk,.28),(-.148,.037,.145),(-.195,.06,.169)],[.007,.004,.0005]),
              ([catmull(trunk,.47),(-.076,-.034,.204),(-.106,-.056,.227)],[.007,.004,.0005]),
              ([catmull(trunk,.64),(.023,.059,.208),(.067,.08,.216)],[.008,.004,.0005]),
              ([(.127,.03,.092),(.17,-.015,.07),(.185,-.06,.007)],[.019,.011,.002]),
              ([(.135,.036,.15),(.18,.055,.176),(.191,.067,.202)],[.013,.007,.0015])]
    for i,(points,radii) in enumerate(branches): tube(mesh,points,radii,38,16,.29,i)
    rng=random.Random(441)
    for side in (-1,1):
        start=Vector((-.168,.015,.045)) if side<0 else Vector((.127,.027,.065))
        for i in range(7):
            a=(i/7*TAU)+.19; reach=rng.uniform(.046,.094)
            end=start+Vector((math.cos(a)*reach,math.sin(a)*reach,-start.z+.001))
            mid=start.lerp(end,.55)+Vector((.009*math.sin(i*4),-.013*math.cos(i*3),-.022))
            tube(mesh,[start,mid,end],[rng.uniform(.009,.016),.005,.0006],25,12,.28,i)
    mesh.object('Integrated tapered trunk, branches and spreading roots',mat,r)
    return r

def make_rock(mineral=False):
    r=root('Fractured river stone · layered mineral faces'); mat=scan_material('Scanned mineral stone' if mineral else 'Scanned stratified stone','rock','lichen_rock' if mineral else None)
    rng=random.Random(671)
    # Connected interlocking blocks create actual ledges and occluded fissures.
    blocks=[((0,0,.04),(.089,.067,.042),11),((-.009,.002,.077),(.073,.062,.022),27),((.01,-.003,.103),(.066,.053,.016),43),((.066,.008,.022),(.025,.047,.025),73)]
    for index,(offset,scale,seed) in enumerate(blocks):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5,radius=1)
        obj=bpy.context.object;obj.name=f'Fractured stratum {index+1}';obj.parent=r
        for v in obj.data.vertices:
            p=v.co.copy(); warped=p+noise.noise_vector(p*2.4+Vector((seed,0,0)))*.18
            # Squared superellipsoid, then directional fracture planes.
            q=Vector((math.copysign(abs(warped.x)**.65,warped.x),math.copysign(abs(warped.y)**.74,warped.y),math.copysign(abs(warped.z)**.62,warped.z)))
            q.x=min(q.x,.81+q.z*.21);q.y=max(q.y,-.88+q.x*.10)
            n=noise.noise(p*7.3+Vector((seed,3,7)))*.045+noise.noise(p*24+Vector((seed,1,3)))*.018
            q*=1+n
            # Two narrow mineral fracture bands are geometry, not painted lines.
            cut=.036*math.exp(-((q.z+.12+q.x*.17)/.04)**2)
            q.x*=1-cut;q.y*=1-cut
            v.co=Vector((q.x*scale[0]+offset[0],q.y*scale[1]+offset[1],q.z*scale[2]+offset[2]))
        for p in obj.data.polygons:p.use_smooth=True
        obj.data.materials.append(mat)
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(70),island_margin=.006);bpy.ops.object.mode_set(mode='OBJECT')
        # Export a sufficiently detailed mesh for silhouette and close-up fissures.
        dec=obj.modifiers.new('Retain sculpted fracture silhouette','DECIMATE');dec.ratio=.45
        bpy.ops.object.modifier_apply(modifier=dec.name)
    return r

def make_rootwood(stump=False):
    r=root('Weathered upright stump' if stump else 'Branching spider root');mesh=MeshBuilder();mat=scan_material('Scanned weathered bark','bark');rng=random.Random(184 if stump else 913)
    if stump:
        tube(mesh,[(0,0,.009),(-.012,.003,.054),(.013,-.006,.119),(.004,.008,.18)],[.039,.033,.026,.017],60,28,.36,3)
    else:
        tube(mesh,[(-.10,0,.008),(-.058,.01,.06),(.008,.012,.105),(.075,.027,.134),(.119,.017,.16)],[.023,.026,.022,.013,.002],65,24,.32,2)
    for i in range(10):
        a=i*2.399963;reach=rng.uniform(.068,.135);height=rng.uniform(.046,.105)
        base=Vector((0,0,.060 if stump else .086))
        end=Vector((math.cos(a)*reach,math.sin(a)*reach*(.55 if stump else .75),rng.uniform(.002,.022)))
        mid=base.lerp(end,.5)+Vector((.012*math.sin(i),.008*math.cos(i),height*.25))
        tube(mesh,[base,mid,end],[rng.uniform(.009,.017),.006,.0006],36,14,.3,i)
        if not stump and i%2==0:
            fork=mid.lerp(end,.30); tip=end+Vector((math.cos(a+.7)*.035,math.sin(a+.7)*.024,.045))
            tube(mesh,[fork,fork.lerp(tip,.65),tip],[.005,.003,.0004],24,10,.25,i)
    if stump:
        mesh.vertices=[Vector((p[0],p[1],p[2]+(.004*math.sin(p[0]*600+p[1]*311) if p[2]>.168 else 0))) for p in mesh.vertices]
    mesh.object('Connected ridged wood with tapered rootlets',mat,r)
    return r

def make_stem():
    r=root('Rotala · branching stem cluster');leaves=MeshBuilder();stems=MeshBuilder();rng=random.Random(231)
    for i in range(20):
        a=i*2.399963;start=Vector((math.cos(a)*.015,math.sin(a)*.015,.001));height=rng.uniform(.065,.155)
        end=start+Vector((rng.uniform(-.025,.025),rng.uniform(-.025,.025),height))
        points=[start,start.lerp(end,.48)+Vector((-.01,.003,0)),end]
        tube(stems,points,[.0009,.0006,.0001],30,6)
        for pair in range(14):
            t=.12+pair*.060;pos=catmull(points,t);angle=a+pair*1.37
            for sign in [-1,1]:
                d=Vector((math.cos(angle)*sign,math.sin(angle)*sign,.2))
                blade(leaves,pos,d,.018*(1-t*.35),.0038,.11,.17,a,0,12,4)
        for side in [-1,1]:blade(leaves,catmull(points,.94),(math.cos(a)*side*.35,math.sin(a)*side*.35,1),.011,.0022,.16,.22,a,0,10,4)
    leaves.object('Opposite whorled leaves',leaf_material(),r)
    stems.object('Fine branching stems',basic_material('Stem vascular tissue',(.12,.09,.038),.65),r)
    return r

def make_moss():
    r=root('Aquatic moss · irregular branching mat');leaves=MeshBuilder();stems=MeshBuilder();rng=random.Random(194)
    # Offset lobes and independent branch headings prevent the circular comb
    # pattern of a radial cushion. Small branchlets intermingle across patches.
    centers=[(-.026,-.012),(.004,-.019),(.025,.007),(-.014,.018),(.002,.003)]
    for i in range(360):
        cx,cy=centers[i%len(centers)];a=rng.random()*TAU;rad=.020*math.sqrt(rng.random())
        x=cx+math.cos(a)*rad;y=cy+math.sin(a)*rad*.79
        mound=.003+.003*math.sin(x*117+y*85)**2
        start=Vector((x,y,mound));angle=rng.random()*TAU
        h=rng.uniform(.006,.018);reach=rng.uniform(.005,.014)
        end=start+Vector((math.cos(angle)*reach,math.sin(angle)*reach,h))
        mid=start.lerp(end,.5)+Vector((rng.uniform(-.003,.003),rng.uniform(-.003,.003),h*.17))
        points=[start,mid,end]
        tube(stems,points,[.00021,.00012,.000025],8,4)
        for j in range(7):
            t=.12+j*.12;pos=catmull(points,t);heading=angle+j*.74+rng.uniform(-.38,.38)
            for side in [-1,1]:
                direction=(math.cos(heading+side*1.2),math.sin(heading+side*1.2),rng.uniform(.18,.65))
                blade(leaves,pos,direction,rng.uniform(.0021,.0036)*(1-t*.3),rng.uniform(.00048,.00078),.10,.15,heading,0,5,2)
        if i%3==0:
            fork=catmull(points,.46);direction=angle+rng.uniform(.9,1.5)
            tip=fork+Vector((math.cos(direction)*.006,math.sin(direction)*.006,.004))
            tube(stems,[fork,fork.lerp(tip,.55),tip],[.0001,.00006,.00002],5,4)
            for j in range(4):
                pos=fork.lerp(tip,.15+j*.22)
                for side in [-1,1]:blade(leaves,pos,(math.cos(direction+side),math.sin(direction+side),.45),.0023,.0005,.1,.15,j,0,4,2)
    leaves.object('Interwoven fine moss leaflets',leaf_material(),r);stems.object('Moss branchlets',basic_material('Moss stem',(.08,.12,.02),.8),r)
    return r

def merge(root_obj):
    meshes=[o for o in root_obj.children_recursive if o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join()
    joined=bpy.context.object;joined.name=root_obj.name+' · export mesh'
    return joined

BUILDERS=[('rock-rounded',make_rock),('rock-strata',lambda:make_rock(True)),('wood-arch',make_wood),('plant-fern',make_fern),('plant-broadleaf',make_broadleaf),('plant-grass',make_grass),('wood-root',make_rootwood),('wood-stump',lambda:make_rootwood(True)),('plant-stem',make_stem),('plant-moss',make_moss)]

def main():
    only=os.environ.get('FISHY_BUILD_ONLY','')
    for name,builder in BUILDERS:
        if only and name not in only.split(','):continue
        clear();r=builder();merge(r)
        bpy.ops.object.select_all(action='SELECT')
        path=os.path.join(MODELS,name+'.glb')
        bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_apply=True,export_cameras=False,export_lights=False,export_image_format='AUTO' if name=='plant-fern' else 'JPEG',export_jpeg_quality=92)
        if name=='plant-fern':
            import struct
            data=open(path,'rb').read();length=struct.unpack_from('<I',data,12)[0];doc=json.loads(data[20:20+length])
            for material in doc.get('materials',[]):material['alphaMode']='MASK';material['alphaCutoff']=.5;material['doubleSided']=True
            encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);rest=data[20+length:]
            with open(path,'wb') as output:output.write(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(rest))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+rest)
        print('FISHY_NATURAL_ASSET',path,flush=True)
    clear()
    for i,(name,builder) in enumerate(BUILDERS):
        r=builder();r.name='SOURCE '+name;r.location.x=(i-2)*.44
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'blender/fishy-fidelity-assets.blend'))
    print('FISHY_NATURAL_BUILD_COMPLETE',flush=True)

if __name__=='__main__':main()
