import {test} from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {initialScene} from "../lib/scene.ts";
import {syncSceneObjects} from "../lib/scene-object-sync.ts";
import {disposeObject} from "../lib/geometry.ts";

test("transform and protection edits retain detailed geometry while shape edits replace only the changed root",()=>{
  const objects=initialScene().objects,group=new T.Group(),meshes=new Map();
  syncSceneObjects(group,meshes,[],objects);
  const first=meshes.get(objects[0].id),other=meshes.get(objects[1].id);
  first.userData.fidelityAsset="wood-arch";
  const moved=objects.map((o,i)=>i?o:{...o,position:[.02,.04,0],protected:!o.protected,size:1.2});
  syncSceneObjects(group,meshes,objects,moved);
  assert.equal(meshes.get(objects[0].id),first);assert.equal(first.userData.fidelityAsset,"wood-arch");assert.deepEqual(first.position.toArray(),[.02,.04,0]);
  const shaped=moved.map((o,i)=>i?o:{...o,color:"#ccaa88"});
  syncSceneObjects(group,meshes,moved,shaped);
  assert.notEqual(meshes.get(objects[0].id),first);assert.equal(meshes.get(objects[1].id),other);assert.equal(first.parent,null);
  syncSceneObjects(group,meshes,shaped,[]);assert.equal(meshes.size,0);assert.equal(group.children.length,0);disposeObject(group);
});
