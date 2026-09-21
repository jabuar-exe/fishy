import * as T from "three";
import {makeObject,disposeObject} from "./geometry.ts";
import type {SceneObject} from "./scene.ts";

const shapeKey=(o:SceneObject)=>JSON.stringify([o.kind,o.form,o.catalogId,o.color,o.sculpt]);
/** Keep hydrated geometry when a user moves, names, locks, or scales an object. */
export function syncSceneObjects(content:T.Group,meshes:Map<string,T.Object3D>,previous:SceneObject[],next:SceneObject[]) {
  const old=new Map(previous.map(o=>[o.id,o])),ids=new Set(next.map(o=>o.id));
  for(const object of previous)if(!ids.has(object.id)){const root=meshes.get(object.id);if(root){root.removeFromParent();disposeObject(root);}meshes.delete(object.id);}
  for(const object of next){
    let root=meshes.get(object.id);
    if(!root||!old.has(object.id)||shapeKey(old.get(object.id)!)!==shapeKey(object)){
      if(root){root.removeFromParent();disposeObject(root);}
      root=makeObject(object);content.add(root);meshes.set(object.id,root);
    }
    root.name=object.name;root.position.fromArray(object.position);root.rotation.set(...object.rotation);root.scale.set(...(object.stretch??[1,1,1])).multiplyScalar(object.size);root.updateMatrixWorld(true);
  }
  return next.filter(o=>!meshes.get(o.id)?.userData.fidelityAsset);
}
