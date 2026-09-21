import bpy,json,os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/blender/fishy-riverbank-study.blend')
record=json.load(open(ROOT+'/workstreams/fidelity-reference-20260921/astra-refinement/scene.json'))
bpy.context.view_layer.update()
report=[]
for item in record['objects']:
 root=bpy.data.objects.get(item['name']);points=[o.matrix_world@v.co for o in root.children_recursive if o.type=='MESH' for v in o.data.vertices]
 lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
 outside=lo[0]<-.4501 or hi[0]>.4501 or lo[1]<-.2251 or hi[1]>.2251 or lo[2]<-.0001 or hi[2]>.4501
 if outside:print('OUTSIDE',item['id'],lo,hi)
 report.append({'id':item['id'],'minXYZ':lo,'maxXYZ':hi,'outsideGlass':outside})
json.dump(report,open(ROOT+'/workstreams/fidelity-reference-20260921/astra-refinement/world-bounds.json','w'),indent=2)
print('BOUNDS',len(report),'outside',sum(o['outsideGlass'] for o in report))

assert not any(o["outsideGlass"] for o in report), "Authored study geometry crosses aquarium glass"
