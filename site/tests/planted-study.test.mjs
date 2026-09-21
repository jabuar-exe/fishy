import {test} from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {organismPaths} from "../lib/organism-system.ts";
import {boundsOf,tankBounds,outsideObjects} from "../lib/geometry.ts";
import {commitScene,initialScene} from "../lib/scene.ts";
import {applyPlantedStudyTo,createFidelityStressStudy,createPlantedStudy} from "../lib/planted-study.ts";

test("planted study is editable, bounded and uses the supported fidelity asset families",()=>{
  const study=createPlantedStudy(),catalogIds=new Set(study.objects.map(object=>object.catalogId));
  assert.equal(study.objects.length,56);assert.equal(study.visual.organisms.enabled,true);assert.equal(study.visual.organisms.count,9);assert.deepEqual(outsideObjects(study),[]);
  for(const id of ["wood-ancient-juniper","rock-black-river","plant-bolbitis-heudelotii","plant-anubias-petite","plant-eleocharis-pusilla-mini"])assert(catalogIds.has(id));
  const protectedObject=study.objects.find(object=>object.protected);assert(protectedObject);
  assert.deepEqual(study.tank,{width:.9,depth:.45,height:.45,source:"user-entered"});
  const lane=new T.Box3(new T.Vector3(-.10,study.substrate+.002,.16),new T.Vector3(.10,study.tank.height-.015,.21));
  assert(tankBounds(study).containsBox(lane));
  for(const object of study.objects)assert(!boundsOf(object).intersectsBox(lane),"foreground viewing lane must remain open");
  assert(organismPaths(study,study.visual.organisms).length>0);
});

test("loading the optional planted study preserves current identity and supports normal undo commits",()=>{
  const current=initialScene(),next=applyPlantedStudyTo(current),committed=commitScene(current,next,current.revision);
  assert.equal(next.id,current.id);assert.equal(next.name,current.name);assert.equal(next.revision,current.revision);assert.equal(committed.revision,current.revision+1);assert.equal(current.objects.length,6);
});

test("32-object fidelity stress study remains finite and contained",()=>{
  const stress=createFidelityStressStudy();assert.equal(stress.objects.length,32);assert.deepEqual(outsideObjects(stress),[]);
  for(const object of stress.objects){const bounds=boundsOf(object);assert([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite));}
});
