import * as T from "three";
import type {SceneObject, SceneRecord, Vec3} from "./scene";
import {buildObjectBaseV11} from "./object-base-v11.ts";
import {applySculpt} from "./sculpt.ts";

export function makeObject(o:SceneObject):T.Group {
  const g=buildObjectBaseV11(o);if(o.sculpt?.nodes.length)applySculpt(g,o.sculpt);
  g.name=o.name;g.userData.objectId=o.id;g.position.fromArray(o.position);g.rotation.set(...o.rotation);g.scale.set(...(o.stretch??[1,1,1]));g.scale.multiplyScalar(o.size);g.updateMatrixWorld(true);return g;
}
export function disposeObject(object:T.Object3D) {
  object.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments){o.geometry?.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>{for(const value of Object.values(m))if(value instanceof T.Texture)value.dispose();m.dispose();});}});
}
export function boundsOf(o:SceneObject) {const g=makeObject(o);const b=new T.Box3().setFromObject(g);disposeObject(g);return b;}
export function tankBounds(s:SceneRecord){return new T.Box3(new T.Vector3(-s.tank.width/2+.004,s.substrate-.001,-s.tank.depth/2+.004),new T.Vector3(s.tank.width/2-.004,s.tank.height-.008,s.tank.depth/2-.004));}
export function outsideObjects(s:SceneRecord) {const b=tankBounds(s);return s.objects.filter(o=>!b.containsBox(boundsOf(o))).map(o=>o.name);}
export function positionRange(o:SceneObject,s:SceneRecord,axis:0|1|2) {
  const object=boundsOf(o),tank=tankBounds(s),min=o.position[axis]+tank.min.getComponent(axis)-object.min.getComponent(axis)+.000001,max=o.position[axis]+tank.max.getComponent(axis)-object.max.getComponent(axis)-.000001;
  return {min:Math.ceil(min*10000)/100,max:Math.floor(max*10000)/100};
}
export function fitObject(o:SceneObject,s:SceneRecord,allowScale:boolean):SceneObject {
  let n=structuredClone(o),b=boundsOf(n);const tank=tankBounds(s).expandByScalar(-.00001),size=b.getSize(new T.Vector3()),available=tank.getSize(new T.Vector3());
  const factor=Math.min(1,available.x/size.x,available.y/size.y,available.z/size.z);
  if(factor<1){if(!allowScale)throw new Error(`${o.name} is too large for this tank. Reduce its size first.`);n.size*=factor*.985;if(n.size<.05)throw new Error(`${o.name} cannot fit at the minimum size.`);b=boundsOf(n);}
  const delta=new T.Vector3();for(const axis of ["x","y","z"] as const){if(b.min[axis]<tank.min[axis])delta[axis]=tank.min[axis]-b.min[axis];else if(b.max[axis]>tank.max[axis])delta[axis]=tank.max[axis]-b.max[axis];}
  n.position=n.position.map((p,i)=>p+delta.getComponent(i)) as Vec3;return n;
}
/** Footprints are deliberately thin: foliage and branches are expected to interleave, so only
 *  the base of each component is kept clear of its neighbours. */
const FOOTPRINT_THINNESS=.3,MIN_FOOTPRINT_RADIUS=.01,SEPARATION_PASSES=24;
export function footprintRadius(o:SceneObject) {const s=boundsOf(o).getSize(new T.Vector3());return Math.max(MIN_FOOTPRINT_RADIUS,Math.max(s.x,s.z)*.5*FOOTPRINT_THINNESS);}
/** Best-effort XZ relaxation so generated components do not materialize inside one another.
 *  Never throws: a scene too dense to fully resolve simply ends up as spread as the budget allows. */
export function separatePlacements(movable:SceneObject[],fixed:SceneObject[],scene:SceneRecord):SceneObject[] {
  const moving=movable.map(o=>({x:o.position[0],z:o.position[2],radius:footprintRadius(o)}));
  const anchored=fixed.map(o=>({x:o.position[0],z:o.position[2],radius:footprintRadius(o)}));
  const nudge=(a:{x:number;z:number;radius:number},b:{x:number;z:number;radius:number},share:number,seed:number)=>{
    const gap=a.radius+b.radius;let dx=a.x-b.x,dz=a.z-b.z,distance=Math.hypot(dx,dz);
    if(!(distance<gap))return false;
    // Exactly coincident centres carry no direction; fan them out on the golden angle instead.
    if(distance<1e-6){dx=Math.cos(seed*2.399963);dz=Math.sin(seed*2.399963);distance=0;}
    else{dx/=distance;dz/=distance;}
    const shortfall=gap-distance;a.x+=dx*shortfall*share;a.z+=dz*shortfall*share;
    if(share<1){b.x-=dx*shortfall*share;b.z-=dz*shortfall*share;}
    return true;
  };
  for(let pass=0;pass<SEPARATION_PASSES;pass++) {
    let settled=true;
    for(let i=0;i<moving.length;i++) {
      for(let j=i+1;j<moving.length;j++)if(nudge(moving[i],moving[j],.5,i*moving.length+j))settled=false;
      for(const other of anchored)if(nudge(moving[i],other,1,i))settled=false;
    }
    if(settled)break;
  }
  return movable.map((o,index)=>{
    const {x,z}=moving[index];
    if(!Number.isFinite(x)||!Number.isFinite(z)||(x===o.position[0]&&z===o.position[2]))return o;
    try{return fitObject({...o,position:[x,o.position[1],z] as Vec3},scene,true);}catch{return o;}
  });
}
export function resizeTank(scene:SceneRecord,tank:SceneRecord["tank"]) {
  const next={...scene,tank};const boundary=tankBounds(next),outside=new Set(scene.objects.filter(o=>!boundary.containsBox(boundsOf(o))).map(o=>o.id)),changed:string[]=[];
  next.objects=scene.objects.map(o=>{
    if(!outside.has(o.id))return o;
    if(o.protected)throw new Error(`${o.name} is protected and would leave the tank. Enlarge the tank or unlock it first.`);
    changed.push(o.name);return fitObject(o,next,true);
  });
  return {scene:next,changed};
}
export function catalogForm(id:string,kind:string) {
  if(kind==="wood")return /mopani|dragon|malaysian/.test(id)?"stump":/spider|red-moor/.test(id)?"spider":/talawa|juniper/.test(id)?"angular":"root";
  return /eleocharis/.test(id)?"grass":/vesicularia|fissidens/.test(id)?"moss":/monte-carlo|glossostigma/.test(id)?"carpet":/bolbitis/.test(id)?"fern":/anubias|bucephalandra|cryptocoryne/.test(id)?"broadleaf":"stem";
}
