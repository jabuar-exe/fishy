"""Original, editable neon tetra with a cyclic body/caudal/pectoral bone rig."""
import bpy, math, os, sys
import numpy as np
from mathutils import Vector
sys.path.insert(0,os.path.dirname(__file__))
from build_natural_assets import MeshBuilder, root, clear, basic_material, texture_node, save_image, tube, ROOT, MODELS

def body_material():
    n=1024;m=512; angle,t=np.mgrid[0:math.tau:complex(m),0:1:complex(n)]
    height=np.sin(angle); side=np.abs(np.cos(angle))
    rng=np.random.default_rng(222)
    fleck=rng.uniform(-.013,.013,(m,n))
    dorsal=np.maximum(height,0)
    rgb=np.stack([.53-.43*dorsal,.58-.46*dorsal,.53-.42*dorsal],axis=2)
    blue=(height>.08)&(height<.39)&(t>.10)&(t<.98)&(side>.5)
    red=(height<.055)&(height>-.85)&(t>.48)&(side>.3)
    smooth=lambda v:np.clip(v,0,1)**2*(3-2*np.clip(v,0,1))
    redfade=smooth((t-.45)/.065)*smooth((.065-height)/.12)*smooth((height+.89)/.12)*smooth((side-.28)/.14)
    bluefade=smooth((height-.065)/.035)*smooth((.405-height)/.055)*smooth((t-.085)/.04)*smooth((.99-t)/.04)*smooth((side-.48)/.1)
    rgb=rgb*(1-redfade[...,None])+np.array([.63,.024,.033])*redfade[...,None]
    rgb=rgb*(1-bluefade[...,None])+np.array([.018,.47,.78])*bluefade[...,None]
    # Fine scales are coherent staggered arcs, restrained enough to read as skin.
    scale=np.cos(t*math.tau*55+np.floor(angle/math.tau*29)%2*math.pi)*np.sin(angle*29)**8
    rgb+=fleck[...,None]+scale[...,None]*.018
    mat=basic_material('Tetra iridescent lateral band / red caudal belly',(1,1,1),.29,.30)
    texture_node(mat,save_image('tetra-skin-albedo',rgb),'Base Color')
    heightmap=scale*.025;dy,dx=np.gradient(heightmap)
    norm=np.stack([-dx,-dy,np.ones_like(t)],axis=2);norm/=np.linalg.norm(norm,axis=2)[...,None]
    texture_node(mat,save_image('tetra-skin-normal',norm*.5+.5,True),'Normal',True)
    return mat

def body(species="neon-tetra", label="Neon tetra", width_scale=1.0, height_scale=1.0):
    r=root(label+' · metre-normalized rig');
    if species=='neon-tetra': mat=body_material()
    else:
        from fish_skin import skin_material
        mat=skin_material(species,label)
    mesh=MeshBuilder();points=[];uv=[]
    rows=64;sides=40
    for i in range(rows+1):
        t=i/rows
        width=(math.sin(math.pi*t)**.71)*.069*(1-.38*t)+.002
        height=(math.sin(math.pi*t)**.79)*.129*(1-.27*t)+.004
        y=-.465+t*.775
        for j in range(sides+1):
            a=j/sides*math.tau
            points.append((math.cos(a)*width,y,math.sin(a)*height+.015*math.sin(t*math.pi)))
            uv.append((t,j/sides))
    mesh.grid(points,uv,rows,sides)
    obj=mesh.object('Silver body with continuous blue/red skin',mat,r)
    parts=[(obj,'body')]
    dark=basic_material('Jet pupil',(.004,.006,.008),.14)
    iris=basic_material('Copper iris' if species=='black-neon-tetra' else 'Silver gold iris',(.68,.12,.026) if species=='black-neon-tetra' else (.50,.48,.29),.25,.5)
    for sign in (-1,1):
        for name,radius,material,x in [('Iris',.020,iris,.040),('Pupil',.012,dark,.050)]:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=radius,location=(sign*x,-.344,.030))
            eye=bpy.context.object;eye.name=name;eye.scale=(.34,1,1);eye.data.materials.append(material);eye.parent=r
            for p in eye.data.polygons:p.use_smooth=True
            parts.append((eye,'torso'))
        gill=MeshBuilder()
        tube(gill,[(sign*.051,-.267,.067),(sign*.063,-.247,.029),(sign*.055,-.25,-.028)],[.0012,.0016,.0005],18,5)
        parts.append((gill.object('Curved operculum seam',basic_material('Gill seam',(.085,.11,.105),.6),r),'torso'))
    # Transparent membranes and fine rays, shaped as forks rather than solid triangles.
    finmat=basic_material('Translucent fin membranes',(.45,.61,.56),.37)
    p=finmat.node_tree.nodes.get('Principled BSDF');p.inputs['Alpha'].default_value=.32
    finmat.surface_render_method='DITHERED';finmat.use_backface_culling=False
    raymat=basic_material('Pale fin rays',(.29,.43,.38),.44)
    fins=[('Caudal fin','tail',[(0,.27,0),(0,.491,.136),(0,.454,.06),(0,.40,0),(0,.454,-.06),(0,.491,-.136)]),
          ('Dorsal fin','mid',[(0,-.08,.115),(0,.035,.229),(0,.153,.139),(0,.142,.09)]),
          ('Anal fin','mid',[(0,.015,-.084),(0,.114,-.155),(0,.252,-.071),(0,.25,-.029)]),
          ('Pectoral left','pectoral.L',[(.052,-.185,-.018),(.146,-.071,-.053),(.102,.021,-.046),(.049,-.12,-.025)]),
          ('Pectoral right','pectoral.R',[(-.052,-.185,-.018),(-.146,-.071,-.053),(-.102,.021,-.046),(-.049,-.12,-.025)])]
    if species=='endler-livebearer':
        fins[0]=('Caudal fin','tail',[(0,.27,0),(0,.435,.167),(0,.491,.135),(0,.485,0),(0,.491,-.135),(0,.435,-.167)])
    if species!='neon-tetra':
        from fish_skin import fin_material
        finmat=fin_material(species,label)
    for name,bone,coords in fins:
        builder=MeshBuilder();builder.vertices=coords;builder.uv=[((v[1]+.465)/.956,(v[2]+.24)/.48) for v in coords]
        builder.faces=[(0,i,i+1) for i in range(1,len(coords)-1)]
        parts.append((builder.object(name,finmat,r),bone))
        rays=MeshBuilder();base=Vector(coords[0])
        for i in range(1,len(coords)-1):
            a=Vector(coords[i]);b=Vector(coords[i+1])
            for j in range(4):
                end=a.lerp(b,j/4)
                tube(rays,[base,base.lerp(end,.5),end],[.00055,.00043,.0001],7,4)
        parts.append((rays.object(name+' · attached rays',raymat,r),bone))
    data=bpy.data.armatures.new('Tetra swim skeleton');rig=bpy.data.objects.new('Tetra cyclic swimming rig',data);bpy.context.collection.objects.link(rig);rig.parent=r
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    skeleton=[('torso',(0,-.465,0),(0,-.09,0),None),('mid',(0,-.09,0),(0,.275,0),'torso'),('tail',(0,.275,0),(0,.50,0),'mid'),('pectoral.L',(.052,-.185,-.018),(.13,-.07,-.053),'torso'),('pectoral.R',(-.052,-.185,-.018),(-.13,-.07,-.053),'torso')]
    for name,head,tail,parent in skeleton:
        b=data.edit_bones.new(name);b.head=(head[0]*width_scale,head[1],head[2]*height_scale);b.tail=(tail[0]*width_scale,tail[1],tail[2]*height_scale)
        if parent:b.parent=data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for obj,assignment in parts:
        if obj.type!='MESH':continue
        # Apply object transforms before weighting to the metre-space skeleton.
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        for vert in obj.data.vertices:
            vert.co.x*=width_scale;vert.co.z*=height_scale
        groups={name:obj.vertex_groups.new(name=name) for name,_,_,_ in skeleton}
        for vert in obj.data.vertices:
            if assignment=='body':
                y=vert.co.y
                if y<-.18:groups['torso'].add([vert.index],1,'REPLACE')
                elif y<.11:
                    weight=(y+.18)/.29;weight=weight*weight*(3-2*weight)
                    groups['torso'].add([vert.index],1-weight,'REPLACE');groups['mid'].add([vert.index],weight,'REPLACE')
                else:
                    weight=max(0,min(1,(y-.19)/.12))
                    groups['mid'].add([vert.index],1-weight,'REPLACE');groups['tail'].add([vert.index],weight,'REPLACE')
            else:groups[assignment].add([vert.index],1,'REPLACE')
        mod=obj.modifiers.new('Swimming deformation','ARMATURE');mod.object=rig
    scene=bpy.context.scene;scene.render.fps=32;scene.frame_start=1;scene.frame_end=33
    for frame in range(1,34,4):
        phase=(frame-1)/32*math.tau
        for name,amp,lag in [('torso',.013,0),('mid',.065,-.7),('tail',.29,-1.5),('pectoral.L',.22,1),('pectoral.R',-.22,1)]:
            bone=rig.pose.bones[name];bone.rotation_mode='XYZ';bone.rotation_euler.z=amp*math.sin(phase+lag);bone.keyframe_insert('rotation_euler',frame=frame,group=name)
    if rig.animation_data and rig.animation_data.action:rig.animation_data.action.name='Swim · body follow-through and fin strokes'
    scene.frame_set(1)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'blender/fishy-'+species+'.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    for obj,_ in parts:obj.select_set(True)
    bpy.context.view_layer.objects.active=parts[0][0];bpy.ops.object.join()
    bpy.context.object.name='Tetra skinned body, attached eyes, gills and fins'
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(MODELS,species+'.glb'),export_format='GLB',use_selection=True,export_animations=True,export_skins=True,export_cameras=False,export_lights=False,export_image_format='JPEG',export_jpeg_quality=92)
    print('FISHY_TETRA_COMPLETE',flush=True)

if __name__=='__main__':
    clear();body()
