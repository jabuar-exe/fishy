import assert from "node:assert/strict";
import test from "node:test";
import {catalogEntries} from "../lib/catalog.ts";
import {equipmentClearanceMessage,installEquipment} from "../lib/equipment.ts";
import {initialScene,validateScene,readSavedScene,SAVE_KEY} from "../lib/scene.ts";

const filter=catalogEntries.find(entry=>entry.id==="filter-fluval-207");
const light=catalogEntries.find(entry=>entry.id==="light-ada-aquasky-rgb-ii-60");

test("mounted equipment is allocated to collision-free rail offsets",()=>{
  assert.ok(filter);
  let scene=initialScene();
  scene=installEquipment(scene,filter,"filter-one");
  scene=installEquipment(scene,filter,"filter-two");
  scene=installEquipment(scene,filter,"filter-three");
  assert.equal(equipmentClearanceMessage(scene),null);
  assert.equal(new Set(scene.equipment.map(item=>item.offset)).size,3);
  assert.throws(()=>installEquipment(scene,filter,"filter-four"),/No collision-free space/);
});

test("same-rail imported hardware that overlaps is identified before rendering",()=>{
  assert.ok(filter);
  const scene=installEquipment(initialScene(),filter,"filter-one");
  const overlapping={...scene,equipment:[...scene.equipment,{...scene.equipment[0],id:"filter-two",offset:0}]};
  assert.match(equipmentClearanceMessage(overlapping),/overlap on the rear glass mounting rail/);
});

test("fixed equipment cannot extend beyond its source-sized mounting span",()=>{
  assert.ok(light);
  const mounted=installEquipment(initialScene(),light,"rim-light");
  assert.throws(()=>validateScene({...mounted,equipment:[{...mounted.equipment[0],offset:.8}]}),/outside its fixed mounting span/);
  assert.throws(()=>installEquipment(mounted,light,"second-rim-light"),/No collision-free space/);
});

test("saved v6 rim offsets recover current and undo/redo history without mutating original storage",()=>{
  const product=catalogEntries.find(entry=>entry.id==="light-fluval-plant-22");
  const centered=installEquipment(initialScene(),product,"legacy-light");
  const snapshot=offset=>({...centered,equipment:centered.equipment.map(item=>({...item,offset}))});
  const envelope={scene:snapshot(.2),past:[snapshot(-.2)],future:[snapshot(.4)],manualEdits:7};
  const raw=JSON.stringify(envelope),storage={getItem:key=>key===SAVE_KEY?raw:null};
  const recovered=readSavedScene(storage);
  for(const scene of [recovered.scene,...recovered.past,...recovered.future]){
    assert.deepEqual(scene,centered);assert.deepEqual(validateScene(scene),centered);
  }
  assert.equal(recovered.manualEdits,7);assert.equal(recovered.raw,raw);assert.equal(storage.getItem(SAVE_KEY),raw);
  const savedAgain=JSON.stringify({scene:recovered.scene,past:recovered.past,future:recovered.future});
  const roundtrip=readSavedScene({getItem:key=>key===SAVE_KEY?savedAgain:null});
  assert.deepEqual(roundtrip.scene,recovered.scene);assert.deepEqual(roundtrip.past,recovered.past);assert.deepEqual(roundtrip.future,recovered.future);
  assert.throws(()=>validateScene(snapshot(.2)),/outside its fixed mounting span/,"new edits remain strict");
  for(const bad of [snapshot(.8),{...snapshot(.2),tank:{...centered.tank,width:.3}},{...snapshot(.2),equipment:[...snapshot(.2).equipment,{...snapshot(-.2).equipment[0],id:"duplicate-rim"}]}]){
    assert.throws(()=>readSavedScene({getItem:key=>key===SAVE_KEY?JSON.stringify(bad):null}));
  }
});
