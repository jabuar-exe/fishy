import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {catalogEntries,catalogDescriptor,catalogObject,isOrganicCatalogEntry} from "../lib/catalog.ts";
import {makeObject,disposeObject,boundsOf,outsideObjects} from "../lib/geometry.ts";
import {initialScene} from "../lib/scene.ts";
import {expandedOrganicProfiles} from "../lib/catalog-expansion.ts";
import * as T from "three";

const metrics=object=>{
  const group=makeObject(object),hash=createHash("sha256");let meshes=0,vertices=0,triangles=0;
  try{
    group.traverse(node=>{if(!node.isMesh)return;meshes++;const position=node.geometry.getAttribute("position");vertices+=position.count;triangles+=(node.geometry.index?.count??position.count)/3;hash.update(Buffer.from(position.array.buffer,position.array.byteOffset,position.array.byteLength));});
    const size=new T.Vector3();new T.Box3().setFromObject(group).getSize(size);
    return {meshes,vertices,triangles,hash:hash.digest("hex"),catalogModel:group.userData.catalogModel,detail:group.userData.modelDetail,morphology:group.userData.morphology,size:size.toArray()};
  }finally{disposeObject(group);}
};

test("every addable material has deterministic identity-bearing detailed geometry",()=>{
  const entries=catalogEntries.filter(entry=>entry.status==="supported_procedural"&&isOrganicCatalogEntry(entry)),hashes=new Set(),scene=initialScene();
  assert.equal(entries.length,55);
  for(const entry of entries){
    const object=catalogDescriptor(entry,"sample"),first=metrics(object),second=metrics(structuredClone(object));
    assert.deepEqual(first,second,`${entry.id} must rebuild deterministically`);
    assert.equal(first.catalogModel,entry.id);
    assert.match(first.detail,/^species-specific-procedural-v[12]$/);
    assert(first.meshes>=(entry.id==="plant-cabomba-caroliniana"?2:8),`${entry.id} lacks modeled parts`);
    assert(first.vertices>=1400,`${entry.id} lacks surface detail`);
    assert(first.triangles>=2500,`${entry.id} lacks intricate topology`);
    assert(!hashes.has(first.hash),`${entry.id} reused another material's geometry`);hashes.add(first.hash);
    const bounds=boundsOf(object);assert([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite),`${entry.id} has invalid bounds`);
    const added=catalogObject(entry,scene,`added-${entry.id}`);assert.deepEqual(outsideObjects({...scene,objects:[added]}),[],`${entry.id} must fit the current tank`);
  }
});

test("the 35 expanded organic materials carry representative source-linked scale and morphology profiles",()=>{
  const entries=catalogEntries.filter(entry=>entry.organic);
  assert.equal(entries.length,35);assert.equal(Object.keys(expandedOrganicProfiles).length,35);
  for(const entry of entries){
    assert.equal(entry.organic,expandedOrganicProfiles[entry.id]);
    assert(entry.source.url.startsWith("https://"),`${entry.id} needs a primary reference link`);
    assert(entry.organic.nominalSizeCm[0]>0&&entry.organic.nominalSizeCm[1]>entry.organic.nominalSizeCm[0],`${entry.id} needs a valid representative range`);
    assert.equal(entry.organic.morphology.length,3,`${entry.id} needs concise identity traits`);
    assert.match(entry.renderingLimit,/procedural counterpart/i);
  }
});

test("variant seeds rebuild deterministically while producing distinct natural specimens",()=>{
  const entry=catalogEntries.find(candidate=>candidate.id==="wood-talawa");assert(entry);
  const base=catalogDescriptor(entry,"variant"),first=metrics({...base,variantSeed:91}),repeat=metrics({...base,variantSeed:91}),other=metrics({...base,variantSeed:92});
  assert.equal(first.hash,repeat.hash);assert.notEqual(first.hash,other.hash);
});

test("Cabomba preserves feathery detail within a bounded draw-call budget",()=>{
  const entry=catalogEntries.find(candidate=>candidate.id==="plant-cabomba-caroliniana");assert(entry);
  const model=metrics(catalogDescriptor(entry,"cabomba-budget"));
  assert(model.meshes<=4,`Cabomba uses ${model.meshes} meshes`);
  assert(model.vertices>=40_000,"Cabomba should retain dense divided foliage");
});

test("expanded proxies expose distinct morphology and family-appropriate proportions",()=>{
  const expanded=catalogEntries.filter(entry=>entry.organic),morphologies=new Set();
  const model=id=>{const entry=expanded.find(candidate=>candidate.id===id);assert(entry);return metrics(catalogDescriptor(entry,"profile"));};
  for(const entry of expanded){const result=model(entry.id);assert.equal(typeof result.morphology,"string");assert(!morphologies.has(result.morphology),`${entry.id} reused a morphology identity`);morphologies.add(result.morphology);}
  const petite=model("wood-wio-petite"),desert=model("wood-desert-roots");assert(Math.max(...petite.size)<Math.max(...desert.size),"petite wood should remain visibly nano-scaled");
  const peak=model("rock-dragon-peaks"),river=model("rock-black-river");assert(peak.size[1]/peak.size[0]>river.size[1]/river.size[0],"Dragon Peaks should read taller than rounded river rock");
  const vallisneria=model("plant-vallisneria-nana"),staurogyne=model("plant-staurogyne-repens");assert(vallisneria.size[1]>staurogyne.size[1]*2,"Vallisneria ribbons should be materially taller than Staurogyne");
  assert.notEqual(model("plant-hygrophila-pinnatifida").hash,model("plant-taxiphyllum-barbieri").hash,"lobed pinnatifida cannot reuse a moss proxy");
  assert.notEqual(model("plant-pogostemon-helferi").hash,model("plant-staurogyne-repens").hash,"Pogostemon rosettes cannot reuse a generic broadleaf clump");
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
