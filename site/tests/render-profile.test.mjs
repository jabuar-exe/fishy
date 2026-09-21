import {test} from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_VISUAL_PROFILE,resolveVisualProfile,visualProfileSchema} from "../lib/render-profile.ts";
import {commitScene,initialScene,validateScene} from "../lib/scene.ts";
import {addCatalogFish,catalogEntryById} from "../lib/catalog.ts";

test("legacy v6 scene records receive the complete conservative visual profile",()=>{
  const legacy=initialScene();delete legacy.visual;
  const restored=validateScene(legacy);
  assert.deepEqual(restored.visual,DEFAULT_VISUAL_PROFILE);
  assert.notEqual(restored.visual,DEFAULT_VISUAL_PROFILE);
  assert.deepEqual(resolveVisualProfile(restored.visual),DEFAULT_VISUAL_PROFILE);
});

test("earlier saved visual profiles retain their choices while defaulting new water controls",()=>{
  const legacy=initialScene();legacy.visual={
    quality:"low",motion:false,clarity:.41,plantMotion:.23,
    organisms:{enabled:true,species:"neon-tetra",count:3,size:.021,seed:81},
  };
  const restored=validateScene(legacy);
  assert.equal(restored.visual.quality,"low");
  assert.equal(restored.visual.motion,false);
  assert.equal(restored.visual.waterLevel,1);
  assert.equal(restored.visual.cascade,false);
  assert.deepEqual(restored.visual.organisms,legacy.visual.organisms);
});

test("visual and organism settings reject unsafe values before persistence",()=>{
  assert.throws(()=>visualProfileSchema.parse({...DEFAULT_VISUAL_PROFILE,quality:"cinematic"}),/Invalid enum value/);
  assert.throws(()=>visualProfileSchema.parse({...DEFAULT_VISUAL_PROFILE,organisms:{...DEFAULT_VISUAL_PROFILE.organisms,count:13}}),/less than or equal to 12/);
  assert.throws(()=>visualProfileSchema.parse({...DEFAULT_VISUAL_PROFILE,organisms:{...DEFAULT_VISUAL_PROFILE.organisms,size:.005}}),/greater than or equal to 0.008/);
});

test("visual profile commits with scene history without mutating the prior snapshot",()=>{
  const current=initialScene(),next={...current,visual:{...current.visual,organisms:{...current.visual.organisms,enabled:true,count:8,seed:44}}};
  const committed=commitScene(current,next,current.revision);
  assert.equal(committed.visual.organisms.enabled,true);assert.equal(committed.visual.organisms.count,8);assert.equal(current.visual.organisms.enabled,false);assert.equal(committed.revision,current.revision+1);
});

test("fish catalog additions persist independent named schools without changing the legacy profile",()=>{
  const source=initialScene(),ember=catalogEntryById("fish-ember-tetra"),endler=catalogEntryById("fish-endler-livebearer");
  assert(ember&&endler);
  const mixed=addCatalogFish(addCatalogFish(source,ember,"ember-one"),endler,"endler-one"),restored=validateScene(mixed);
  assert.deepEqual(restored.visual.organisms.schools?.map(s=>s.species),["ember-tetra","endler-livebearer"]);
  assert.deepEqual(restored.visual.organisms.schools?.map(s=>s.count),[8,6]);
  assert.equal(source.visual.organisms.schools,undefined);
  assert.equal(restored.visual.organisms.species,"neon-tetra","legacy school fields remain readable for older controls");
});
