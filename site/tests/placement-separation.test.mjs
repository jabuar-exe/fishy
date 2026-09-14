import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {materializeAquascapePlan} from "../lib/aquascape-agent.ts";
import {boundsOf,footprintRadius,outsideObjects,separatePlacements} from "../lib/geometry.ts";
import {initialScene} from "../lib/scene.ts";

const design={composition:"triangular",focalIndex:0,sightline:"Open from the front right toward the branch.",openForegroundMin:.4,mood:"lush",maintenanceTier:"medium",story:"A shaded riverbank under an overhanging branch."};
const planWith=components=>({title:"Separation study",summary:"A layout used to exercise placement separation.",design,components,influencesUsed:[]});
const component=(catalogId,name,x,z)=>({catalogId,name,x,z,scale:1,rotationDegrees:0});
const generatedOf=result=>result.scene.objects.filter(object=>!object.protected);
const gap=(a,b)=>Math.hypot(a.position[0]-b.position[0],a.position[2]-b.position[2]);

test("components planned on the same spot are pushed apart by their thin footprints",()=>{
  const plan=planWith([
    component("plant-eleocharis-pusilla-mini","Grass A",.1,-.1),
    component("plant-eleocharis-pusilla-mini","Grass B",.1,-.1),
    component("wood-talawa","Branch",.1,-.1),
  ]);
  let token=0;
  const result=materializeAquascapePlan(initialScene(),plan,"Stack everything on one spot",()=>`fixed-${++token}`);
  const generated=generatedOf(result);
  assert.equal(generated.length,3);
  for(let i=0;i<generated.length;i++)for(let j=i+1;j<generated.length;j++){
    const required=footprintRadius(generated[i])+footprintRadius(generated[j]);
    assert(gap(generated[i],generated[j])>=required-1e-9,`${generated[i].name} and ${generated[j].name} are still ${gap(generated[i],generated[j])} apart, needed ${required}`);
  }
  assert.deepEqual(outsideObjects(result.scene),[]);
});

test("footprints stay thin enough that neighbouring plants may still interleave",()=>{
  const scene=initialScene();
  for(const object of scene.objects){
    const size=boundsOf(object).getSize(new T.Vector3());
    assert(footprintRadius(object)<=Math.max(.01,Math.max(size.x,size.z)*.5*.31),`${object.name} keeps too much of its real footprint`);
  }
  const plant=scene.objects.find(object=>object.kind==="plant");
  const pair=[{...plant,id:"a",position:[-.025,plant.position[1],0]},{...plant,id:"b",position:[.025,plant.position[1],0]}];
  // Their real volumes overlap at 5 cm apart; only the thin bases are kept clear, so neither moves.
  assert(boundsOf(pair[0]).intersectsBox(boundsOf(pair[1])));
  assert.deepEqual(separatePlacements(pair,[],{...scene,objects:[]}),pair);
});

test("a well-spread layout is left untouched by the separation pass",()=>{
  const scene=initialScene();
  const movable=scene.objects.filter(object=>!object.protected);
  assert.deepEqual(separatePlacements(movable,scene.objects.filter(object=>object.protected),scene),movable);
  assert.deepEqual(separatePlacements(scene.objects,[],scene),scene.objects);
});

test("separation never throws and preserves order when a scene is too dense to resolve",()=>{
  const scene={...initialScene(),tank:{width:.12,depth:.12,height:.2,source:"user-entered"}};
  const crowd=Array.from({length:8},(_,index)=>({...scene.objects[3],id:`crowd-${index}`,name:`Crowd ${index}`,position:[0,scene.substrate,0],size:.4}));
  const result=separatePlacements(crowd,[],{...scene,objects:[]});
  assert.equal(result.length,crowd.length);
  assert.deepEqual(result.map(object=>object.id),crowd.map(object=>object.id));
  assert(result.every(object=>object.position.every(Number.isFinite)));
});

test("protected objects anchor the relaxation and are never moved themselves",()=>{
  const scene=initialScene();
  const anchor=scene.objects.find(object=>object.protected);
  const before=structuredClone(anchor);
  const intruder={...scene.objects[1],id:"intruder",name:"Intruder",position:[...anchor.position]};
  const [moved]=separatePlacements([intruder],[anchor],scene);
  assert.deepEqual(anchor,before);
  assert(gap(moved,anchor)>=footprintRadius(moved)+footprintRadius(anchor)-1e-9);
});
