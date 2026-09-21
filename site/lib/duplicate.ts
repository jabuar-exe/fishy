import * as T from "three";
import {boundsOf,tankBounds} from "./geometry.ts";
import {MAX_SCENE_OBJECTS,type SceneRecord,type SceneObject} from "./scene.ts";

export function duplicateObject(scene:SceneRecord,id:string,newId:string):SceneObject {
  if(scene.objects.length>=MAX_SCENE_OBJECTS)throw new Error(`This scene has reached its ${MAX_SCENE_OBJECTS}-object limit.`);
  if(!newId||newId.length>100||scene.objects.some(o=>o.id===newId))throw new Error("Duplicate needs a new object identity.");
  const source=scene.objects.find(o=>o.id===id);if(!source)throw new Error("The selected object no longer exists.");
  const clone={...structuredClone(source),id:newId,name:`${source.name.slice(0,150)} copy`,protected:true},box=boundsOf(source),size=box.getSize(new T.Vector3()),boundary=tankBounds(scene),obstacles=scene.objects.map(boundsOf);
  const dx=size.x+.008,dz=size.z+.008;
  for(const [x,z] of [[dx,0],[-dx,0],[0,dz],[0,-dz],[dx,dz],[-dx,dz],[dx,-dz],[-dx,-dz]]){const offset=new T.Vector3(x,0,z),candidate=box.clone().translate(offset);if(boundary.containsBox(candidate)&&obstacles.every(b=>!b.intersectsBox(candidate))){clone.position=[source.position[0]+x,source.position[1],source.position[2]+z];return clone;}}
  // Bounded ground-plane search: never shrink, overlap or relocate existing work.
  const y=source.position[1];for(let z=0;z<=16;z++)for(let x=0;x<=16;x++){const centerX=boundary.min.x+size.x/2+(boundary.max.x-boundary.min.x-size.x)*x/16,centerZ=boundary.min.z+size.z/2+(boundary.max.z-boundary.min.z-size.z)*z/16,center=box.getCenter(new T.Vector3()),offset=new T.Vector3(centerX-center.x,0,centerZ-center.z),candidate=box.clone().translate(offset);if(boundary.containsBox(candidate)&&obstacles.every(b=>!b.clone().expandByScalar(.002).intersectsBox(candidate))){clone.position=[source.position[0]+offset.x,y,source.position[2]+offset.z];return clone;}}
  throw new Error("No clear space for an identical copy. Move objects or enlarge the tank, then duplicate again.");
}
