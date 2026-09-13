import assert from "node:assert/strict";
import test from "node:test";
import {catalogEntries} from "../lib/catalog.ts";
import {equipmentClearanceMessage,installEquipment} from "../lib/equipment.ts";
import {initialScene,validateScene} from "../lib/scene.ts";

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
