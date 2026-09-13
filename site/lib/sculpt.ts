import * as T from "three";
import {z} from "zod";

export const LATTICE_SIDE=9, LATTICE_COUNT=LATTICE_SIDE**3;
const coordinate=z.tuple([z.number().finite().min(-5).max(5),z.number().finite().min(-5).max(5),z.number().finite().min(-5).max(5)]);
const offset=z.tuple([z.number().finite().min(-.25).max(.25),z.number().finite().min(-.25).max(.25),z.number().finite().min(-.25).max(.25)]);
export const sculptSchema=z.object({version:z.literal(1),generator:z.literal("fishy-object-v11"),basis:z.object({kind:z.enum(["wood","rock","plant"]),form:z.string().max(60)}).strict(),min:coordinate,max:coordinate,nodes:z.array(z.object({index:z.number().int().min(0).max(LATTICE_COUNT-1),offset}).strict()).max(LATTICE_COUNT).refine(nodes=>new Set(nodes.map(n=>n.index)).size===nodes.length,"Duplicate sculpt nodes")}).strict().refine(s=>s.min.every((v,i)=>s.max[i]-v>1e-6),"Sculpt bounds must have positive dimensions").transform(s=>({...s,nodes:s.nodes.filter(n=>n.offset.some(v=>v!==0)).sort((a,b)=>a.index-b.index)}));
export type Sculpt=z.infer<typeof sculptSchema>;
export type BrushMode="pull"|"push"|"smooth";
const index=(x:number,y:number,z:number)=>x+LATTICE_SIDE*(y+LATTICE_SIDE*z);
export function createSculpt(group:T.Group,basis:Sculpt["basis"]):Sculpt {
  group.updateMatrixWorld(true);const box=new T.Box3().setFromObject(group);
  return sculptSchema.parse({version:1,generator:"fishy-object-v11",basis,min:box.min.toArray(),max:box.max.toArray(),nodes:[]});
}
const dense=(s:Sculpt)=>{const values:Array<[number,number,number]>=Array.from({length:LATTICE_COUNT},()=>[0,0,0]);for(const node of s.nodes)values[node.index]=[...node.offset];return values;};
export function latticeOffset(s:Sculpt,point:T.Vector3,target=new T.Vector3(),values=dense(s)) {
  const p=point.toArray().map((v,i)=>T.MathUtils.clamp((v-s.min[i])/(s.max[i]-s.min[i]),0,1)*8),lo=p.map(v=>Math.min(7,Math.floor(v))),f=p.map((v,i)=>v-lo[i]);target.set(0,0,0);
  for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){const a=values[index(lo[0]+x,lo[1]+y,lo[2]+z)],weight=(x?f[0]:1-f[0])*(y?f[1]:1-f[1])*(z?f[2]:1-f[2]);target.x+=a[0]*weight;target.y+=a[1]*weight;target.z+=a[2]*weight;}
  return target;
}
/** The group must still have its identity root transform. Child transforms stay intact. */
export function applySculpt(group:T.Group,s:Sculpt) {
  group.updateMatrixWorld(true);const point=new T.Vector3(),delta=new T.Vector3(),values=dense(s);
  group.traverse(node=>{if(!(node instanceof T.Mesh))return;const inverse=node.matrixWorld.clone().invert(),pos=node.geometry.getAttribute("position");for(let i=0;i<pos.count;i++){point.fromBufferAttribute(pos,i).applyMatrix4(node.matrixWorld);latticeOffset(s,point,delta,values);point.add(delta).applyMatrix4(inverse);pos.setXYZ(i,point.x,point.y,point.z);}pos.needsUpdate=true;node.geometry.computeVertexNormals();node.geometry.computeBoundingBox();node.geometry.computeBoundingSphere();});
}
export function brushSculpt(s:Sculpt,world:T.Matrix4,center:T.Vector3,normal:T.Vector3,radius:number,amount:number,mode:BrushMode):{sculpt:Sculpt;changed:boolean} {
  if(!Number.isFinite(radius)||radius<.002||radius>2||!Number.isFinite(amount)||amount<=0||amount>.005||![...center.toArray(),...normal.toArray()].every(Number.isFinite))throw new Error("Invalid brush settings");
  const values=dense(s),nextValues=values.map(v=>[...v] as [number,number,number]),inverse=world.clone().invert(),localCenter=center.clone().applyMatrix4(inverse),movement=center.clone().addScaledVector(normal,amount*(mode==="push"?-1:1)).applyMatrix4(inverse).sub(localCenter);
  // A long, thin object such as driftwood can have a grid cell much wider than
  // the intended brush. A radius-only lookup would then touch no lattice node
  // at all. When that happens, use the control point with the strongest
  // interpolation influence at the hit location; it always affects that point.
  const controlPoint=(x:number,y:number,z:number,offset:[number,number,number])=>new T.Vector3(s.min[0]+x/8*(s.max[0]-s.min[0])+offset[0],s.min[1]+y/8*(s.max[1]-s.min[1])+offset[1],s.min[2]+z/8*(s.max[2]-s.min[2])+offset[2]).applyMatrix4(world);
  let strongestBrushWeight=0;
  for(let z=0;z<9;z++)for(let y=0;y<9;y++)for(let x=0;x<9;x++){const distance=controlPoint(x,y,z,values[index(x,y,z)]).distanceTo(center);if(distance<radius)strongestBrushWeight=Math.max(strongestBrushWeight,(1-distance/radius)**2);}
  let fallback=-1;
  // Sparse persisted offsets round to 1e-7 metres. A control point that only
  // grazes the brush has too little falloff weight to survive that rounding.
  if(strongestBrushWeight<.0001){
    const normalised=localCenter.toArray().map((value,axis)=>T.MathUtils.clamp((value-s.min[axis])/(s.max[axis]-s.min[axis]),0,1)*8),lower=normalised.map(value=>Math.min(7,Math.floor(value))),fraction=normalised.map((value,axis)=>value-lower[axis]);
    let strongest=-1;
    for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){const weight=(x?fraction[0]:1-fraction[0])*(y?fraction[1]:1-fraction[1])*(z?fraction[2]:1-fraction[2]);if(weight>strongest){strongest=weight;fallback=index(lower[0]+x,lower[1]+y,lower[2]+z);}}
  }
  let changed=false;
  for(let z=0;z<9;z++)for(let y=0;y<9;y++)for(let x=0;x<9;x++) {
    const i=index(x,y,z),old=values[i],distance=controlPoint(x,y,z,old).distanceTo(center);if(distance>=radius&&i!==fallback)continue;
    const weight=i===fallback?1:(1-distance/radius)**2;
    for(let axis=0;axis<3;axis++) {
      let delta=movement.getComponent(axis)*weight;
      if(mode==="smooth"){let sum=0,count=0;for(const [dx,dy,dz] of [[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]]){const a=x+dx,b=y+dy,c=z+dz;if(a>=0&&a<9&&b>=0&&b<9&&c>=0&&c<9){sum+=values[index(a,b,c)][axis];count++;}}delta=(sum/count-old[axis])*weight*Math.min(.5,amount/.005);}
      nextValues[i][axis]=Math.round(T.MathUtils.clamp(old[axis]+delta,-.25,.25)*1e7)/1e7;if(nextValues[i][axis]!==old[axis])changed=true;
    }
  }
  return {sculpt:{...s,nodes:nextValues.flatMap((offset,index)=>offset.some(n=>n!==0)?[{index,offset}]:[])},changed};
}
export function sculptChanged(s:Sculpt){return s.nodes.some(v=>v.offset.some(n=>n!==0));}
export function minimumBrushRadius(s:Sculpt,world:T.Matrix4) {
  // brushSculpt falls back to the hit cell's strongest control point, so this
  // is a true interaction limit rather than the diagonal of the coarsest cell.
  void s;void world;return .002;
}
