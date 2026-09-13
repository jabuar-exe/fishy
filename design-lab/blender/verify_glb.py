"""Independent GLB structure / metadata / exported world-bounds verification."""
import json,struct,itertools,argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('run',type=Path);a=p.parse_args()
def transform(n,p):
 if 'matrix' in n:
  m=n['matrix'];return tuple(sum(m[k*4+i]*p[k] for k in range(3))+m[12+i] for i in range(3))
 p=[v*s for v,s in zip(p,n.get('scale',[1,1,1]))];qx,qy,qz,qw=n.get('rotation',[0,0,0,1]);x,y,z=p
 t=(2*(qy*z-qz*y),2*(qz*x-qx*z),2*(qx*y-qy*x))
 rotated=(x+qw*t[0]+qy*t[2]-qz*t[1],y+qw*t[1]+qz*t[0]-qx*t[2],z+qw*t[2]+qx*t[1]-qy*t[0])
 return tuple(v+d for v,d in zip(rotated,n.get('translation',[0,0,0])))
reports=[]
for sub in a.run.iterdir():
 if not (sub/'audit.json').exists():continue
 audit=json.loads((sub/'audit.json').read_text());raw=(sub/'aquarium.glb').read_bytes();magic,version,length=struct.unpack_from('<III',raw);assert magic==0x46546c67 and version==2 and length==len(raw)
 size,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a;g=json.loads(raw[20:20+size]);parents={c:i for i,n in enumerate(g['nodes']) for c in n.get('children',[])}
 def world(i,p):
  p=transform(g['nodes'][i],p)
  return world(parents[i],p) if i in parents else p
 ids=[];triangles=0;max_error=0;expected={b['id']:b for b in audit['bounds']}
 for i,n in enumerate(g['nodes']):
  if 'mesh' not in n:continue
  ident=n.get('extras',{}).get('fishy_id');assert ident and ident==n['name'];ids.append(ident);corners=[]
  for primitive in g['meshes'][n['mesh']]['primitives']:
   assert primitive.get('mode',4)==4;triangles+=g['accessors'][primitive['indices']]['count']//3
   accessor=g['accessors'][primitive['attributes']['POSITION']]
   corners.extend(world(i,pt) for pt in itertools.product(*zip(accessor['min'],accessor['max'])))
  if ident in expected:
   zup=[(x,-z,y) for x,y,z in corners];mn=[min(p[k] for p in zup) for k in range(3)];mx=[max(p[k] for p in zup) for k in range(3)]
   err=max(abs(v-e) for v,e in zip(mn+mx,expected[ident]['min']+expected[ident]['max']));max_error=max(max_error,err)
 assert len(ids)==len(set(ids))==audit['objects'];assert triangles==audit['triangles'];assert max_error<1e-5,(sub,max_error)
 reports.append({'scene':sub.name,'unique_mesh_objects':len(ids),'triangles':triangles,'maximum_export_bounds_error_m':max_error,'status':'PASS'})
assert reports, 'No completed scene audits found'
if (a.run/'manifest.json').exists(): assert len(reports)==len(json.loads((a.run/'manifest.json').read_text()))
(a.run/'glb-verification.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports,indent=2))
