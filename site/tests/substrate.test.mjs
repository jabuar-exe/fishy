import assert from "node:assert/strict";
import test from "node:test";
import {boundsOf} from "../lib/geometry.ts";
import {initialScene} from "../lib/scene.ts";
import {replaceSubstrate} from "../lib/substrate.ts";

const close=(actual,expected)=>assert(Math.abs(actual-expected)<.00001,`${actual} should equal ${expected}`);

function restingOn(scene,object) {
  const bottom=boundsOf(object).min.y;
  return {...object,position:[object.position[0],object.position[1]+scene.substrate-bottom,object.position[2]]};
}

test("replacing substrate keeps floor-supported material on the bed in both directions",()=>{
  const base=initialScene(),target=base.objects.find(object=>object.kind==="rock");assert.ok(target);
  const supported=restingOn(base,target),scene={...base,objects:[supported]};
  const deeper=replaceSubstrate(scene,.06,"substrate-ada-amazonia-v2");
  close(boundsOf(deeper.objects[0]).min.y,deeper.substrate);
  close(deeper.objects[0].position[1]-scene.objects[0].position[1],.06-scene.substrate);
  const shallower=replaceSubstrate(deeper,.02,"substrate-fluval-stratum");
  close(boundsOf(shallower.objects[0]).min.y,shallower.substrate);
  close(shallower.objects[0].position[1]-deeper.objects[0].position[1],.02-deeper.substrate);
});

test("replacing substrate leaves elevated objects alone and refuses protected overflow",()=>{
  const base=initialScene(),target=base.objects.find(object=>object.kind==="rock");assert.ok(target);
  const elevated={...target,position:[target.position[0],.16,target.position[2]],protected:false};
  const unchanged=replaceSubstrate({...base,objects:[elevated]},.04,"substrate-fluval-stratum");
  assert.deepEqual(unchanged.objects[0].position,elevated.position);
  const protectedTall=restingOn(base,{...target,size:.8,protected:true});
  assert.throws(()=>replaceSubstrate({...base,objects:[protectedTall]},.31,"substrate-ada-amazonia-v2"),/protected and cannot remain supported/);
});
