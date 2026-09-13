import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {catalogEntries,catalogDescriptor,catalogObject} from "../lib/catalog.ts";
import {makeObject,disposeObject,boundsOf,outsideObjects} from "../lib/geometry.ts";
import {initialScene} from "../lib/scene.ts";

const metrics=object=>{
  const group=makeObject(object),hash=createHash("sha256");let meshes=0,vertices=0,triangles=0;
  try{
    group.traverse(node=>{if(!node.isMesh)return;meshes++;const position=node.geometry.getAttribute("position");vertices+=position.count;triangles+=(node.geometry.index?.count??position.count)/3;hash.update(Buffer.from(position.array.buffer,position.array.byteOffset,position.array.byteLength));});
    return {meshes,vertices,triangles,hash:hash.digest("hex"),catalogModel:group.userData.catalogModel,detail:group.userData.modelDetail};
  }finally{disposeObject(group);}
};

test("every addable material has deterministic identity-bearing detailed geometry",()=>{
  const entries=catalogEntries.filter(entry=>entry.status==="supported_procedural"),hashes=new Set(),scene=initialScene();
  assert.equal(entries.length,20);
  for(const entry of entries){
    const object=catalogDescriptor(entry,"sample"),first=metrics(object),second=metrics(structuredClone(object));
    assert.deepEqual(first,second,`${entry.id} must rebuild deterministically`);
    assert.equal(first.catalogModel,entry.id);
    assert.equal(first.detail,"species-specific-procedural-v1");
    assert(first.meshes>=8,`${entry.id} lacks modeled parts`);
    assert(first.vertices>=1400,`${entry.id} lacks surface detail`);
    assert(first.triangles>=2500,`${entry.id} lacks intricate topology`);
    assert(!hashes.has(first.hash),`${entry.id} reused another material's geometry`);hashes.add(first.hash);
    const bounds=boundsOf(object);assert([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite),`${entry.id} has invalid bounds`);
    const added=catalogObject(entry,scene,`added-${entry.id}`);assert.deepEqual(outsideObjects({...scene,objects:[added]}),[],`${entry.id} must fit the current tank`);
  }
});

test("catalog identity changes geometry even when legacy renderer forms match",()=>{
  for(const ids of [["wood-spider","wood-red-moor"],["wood-mopani","wood-malaysian-driftwood"],["plant-micranthemum-monte-carlo","plant-glossostigma-elatinoides"],["plant-anubias-petite","plant-bucephalandra-bukit-kelam"]]){
    const entries=ids.map(id=>catalogEntries.find(entry=>entry.id===id));assert(entries.every(Boolean));assert.equal(entries[0].rendererForm,entries[1].rendererForm);assert.notEqual(metrics(catalogDescriptor(entries[0],"a")).hash,metrics(catalogDescriptor(entries[1],"b")).hash);
  }
});

test("the unlabelled River wood stays on the legacy generator for saved sculpt compatibility",()=>{
  const riverWood=initialScene().objects.find(object=>object.id==="wood-arch");assert(riverWood);assert.equal(riverWood.catalogId,undefined);
  const model=metrics(riverWood),reloaded=metrics(JSON.parse(JSON.stringify(riverWood)));assert.equal(model.catalogModel,undefined);assert.equal(model.detail,undefined);assert.deepEqual(model,reloaded);
});
