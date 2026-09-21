"""Measure authored plant contacts on the generated Blender study; writes candidate positions for Astra review."""
import bpy,json,math,os
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
record=json.load(open(ROOT+'/workstreams/fidelity-reference-20260921/astra-refinement/scene.json'))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/blender/fishy-riverbank-study.blend')
bpy.context.view_layer.update()
verts=[];faces=[]
for item in record['objects']:
 if item['kind'] not in ('wood','rock'): continue
 root=bpy.data.objects.get(item['name'])
 if root is None:raise ValueError(item['name'])
 for o in root.children_recursive:
  if o.type!='MESH':continue
  start=len(verts);verts.extend([o.matrix_world@v.co for v in o.data.vertices]);faces.extend([[start+i for i in p.vertices] for p in o.data.polygons])
bvh=BVHTree.FromPolygons(verts,faces)
results={}
for item in record['objects']:
 if item['kind']!='plant':continue
 root=bpy.data.objects.get(item['name']);mi=item['localMin'];ma=item['localMax']
 anchor=root.matrix_world@Vector(((mi[0]+ma[0])/2,-(mi[2]+ma[2])/2,mi[1]))
 candidates=[]
 for r in (0,.008,.016,.025,.038,.052):
  for a in range(1 if r==0 else 16):
   theta=a*math.tau/16;x=anchor.x+r*math.cos(theta);y=anchor.y+r*math.sin(theta)
   if abs(x)>.435 or abs(y)>.212:continue
   start=Vector((x,y,.50))
   for _ in range(10):
    loc,norm,idx,dist=bvh.ray_cast(start,Vector((0,0,-1)),.55)
    if loc is None:break
    if norm.z>.12 and loc.z<.39 and loc.z>record['substrate']:
     dz=loc.z-anchor.z
     # Preserve the authored height/composition where a nearby shelf exists.
     penalty=r*2.1+abs(dz)*(.8 if dz<0 else 1.5)
     candidates.append((penalty,loc.copy()))
    start=loc-Vector((0,0,.0001))
   if anchor.z<.10:candidates.append((r*2.1+abs(record['substrate']-anchor.z)*.8,Vector((x,y,record['substrate']))))
 best=min(candidates,key=lambda c:c[0])[1];offset=best-anchor;offset.z-=.0035 if item['form']=='moss' else .004
 pos=item['position'];new=[round(pos[0]+offset.x,5),round(pos[1]+offset.z,5),round(pos[2]-offset.y,5)]
 results[item['id']]=new
 print(item['id'], 'from',pos,'anchor',list(round(v,4) for v in anchor),'to',new,'delta',list(round(v,4) for v in offset))
json.dump(results,open(ROOT+'/workstreams/fidelity-reference-20260921/astra-refinement/plant-contact-anchors.json','w'),indent=2)
