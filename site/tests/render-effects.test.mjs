import {test} from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {aquariumLightingState,tankShadowBounds} from "../lib/aquarium-stage.ts";
import {createAquariumEffects,waterSurfaceMaterial} from "../lib/aquarium-effects.ts";
import {resolveRenderQuality} from "../lib/render-quality.ts";
import {WaterFlow} from "../lib/water-flow.ts";
import {plantDepthMaterial,plantDistanceMaterial,plantMotionState,setPlantMotion,surfaceMaterial,wrapPlantMaterial} from "../lib/surface-materials.ts";
import {initialScene} from "../lib/scene.ts";
import {referenceCameraBounds} from "../lib/reference-packet.ts";

test("quality policy has an explicit low fallback and hysteresis for recovered frame time",()=>{
  assert.equal(resolveRenderQuality({preference:"high"}).tier,"high");
  assert.equal(resolveRenderQuality({preference:"low"}).tier,"low");
  assert.equal(resolveRenderQuality({viewport:{width:390,height:844,devicePixelRatio:3}}).tier,"low");
  assert.equal(resolveRenderQuality({previous:"high",p95FrameMs:35}).tier,"low");
  assert.equal(resolveRenderQuality({previous:"low",p95FrameMs:27}).tier,"low");
  assert.equal(resolveRenderQuality({previous:"low",p95FrameMs:23}).tier,"high");
});

test("water material stays transparent while declaring the intended optical contracts",()=>{
  const material=waterSurfaceMaterial(resolveRenderQuality({preference:"high"}),.4);
  assert.equal(material.transparent,true);
  assert.equal(material.depthWrite,false);
  assert(material.opacity<.3,"water must not become an opaque viewport cover");
  assert.deepEqual(material.userData.fishyWaterContract,{flowNormals:true,fresnel:true,depthTint:true,reflections:"environment",opaque:false});
  material.dispose();
});

test("the solved water field updates surface positions and normals used by reflection",()=>{
  const content=new T.Group(),water=new T.Mesh(new T.PlaneGeometry(.6,.3,8,6),waterSurfaceMaterial(resolveRenderQuality({preference:"low"}),.72));
  content.add(water);
  const effects=createAquariumEffects(content,water,initialScene(),resolveRenderQuality({preference:"low"}));
  const flow=new WaterFlow(9,7,.6,.3,{initialDisturbance:0,sources:[{position:[.1,.1],direction:[0,1],radius:.24,strength:.8}]});
  for(let i=0;i<120;i++)flow.advance(1/120);
  const normal=water.geometry.getAttribute("normal"),before=Array.from(normal.array);
  assert.equal(effects.syncWaterFlow(flow),true);
  const positions=water.geometry.getAttribute("position");
  assert.deepEqual(Array.from({length:positions.count},(_,index)=>positions.getZ(index)),Array.from(flow.heights));
  assert.notDeepEqual(Array.from(normal.array),before,'height changes must refresh reflected surface normals');
  effects.dispose();water.geometry.dispose();water.material.dispose();
});

test("powered filter cues share the water clock and disabled outlets remain transparent",()=>{
  const content=new T.Group(),on=new T.Mesh(new T.PlaneGeometry(.04,.08),new T.MeshStandardMaterial({color:"#b9ded7",transparent:true,opacity:.3})),off=new T.Mesh(new T.PlaneGeometry(.04,.08),new T.MeshStandardMaterial({color:"#b9ded7",transparent:true,opacity:.3}));
  on.name=off.name="Filter powered flow";on.userData.powered=true;off.userData.powered=false;content.add(on,off);
  const effects=createAquariumEffects(content,null,initialScene(),resolveRenderQuality({preference:"high"}));
  const onState=on.material.userData.fishyFilterFlowState,offState=off.material.userData.fishyFilterFlowState;
  assert.equal(onState.powered.value,1);assert.equal(offState.powered.value,0);
  effects.setTime(2.4);assert.equal(onState.time.value,2.4);assert.equal(offState.time.value,2.4);
  effects.setPaused(true);effects.update(.1);assert.equal(onState.time.value,2.4,'paused outlet material must not advance');
  effects.dispose();for(const mesh of [on,off]){mesh.geometry.dispose();mesh.material.dispose();}
});

test("plant visible and shadow materials share one bounded motion state",()=>{
  const material=surfaceMaterial("plant","#4f7f43"),state=plantMotionState(material);
  assert(state);
  const depth=plantDepthMaterial(material,state),distance=plantDistanceMaterial(state);
  assert.equal(depth.userData.fishyPlantMotion,state);
  assert.equal(distance.userData.fishyPlantMotion,state);
  setPlantMotion(material,{time:4.5,strength:2,phase:1.2,stiffness:9,rootY:.03,height:.21,flow:[0,1]});
  assert.equal(state.time.value,4.5);
  assert.equal(state.strength.value,1);
  assert.equal(state.stiffness.value,2);
  assert.equal(state.rootY.value,.03);
  assert.equal(state.height.value,.21);
  assert.deepEqual(state.flow.value.toArray(),[0,1]);
  assert(depth instanceof T.MeshDepthMaterial);
  assert(distance instanceof T.MeshDistanceMaterial);
  material.dispose();depth.dispose();distance.dispose();
});

test("authored PBR plant materials retain their maps while gaining the same motion contract",()=>{
  const texture=new T.Texture(),material=new T.MeshPhysicalMaterial({map:texture,roughness:.44,transmission:.08}),state=wrapPlantMaterial(material);
  assert(state);
  assert.equal(material.map,texture);
  assert.equal(plantMotionState(material),state);
  assert.match(material.customProgramCacheKey(),/fishy-plant-sway/);
  material.dispose();texture.dispose();
});

test("lighting state resolves the same inspection, night, and powered modes for any renderer",()=>{
  const record=initialScene();
  assert.deepEqual(aquariumLightingState(record),{mode:"inspection",hemi:.55,sun:3,fill:.4,exposure:.95});
  record.equipment=[{id:"light-off",kind:"light",catalogId:"light-ada-aquasky-rgb-ii-60",mount:"rim-bar",offset:0,enabled:false}];
  assert.equal(aquariumLightingState(record).mode,"night");
  record.equipment[0].enabled=true;
  assert.equal(aquariumLightingState(record).mode,"powered");
});

test("shadow bounds follow the tank and recover high-detail maps after a low-quality fallback",()=>{
  const tank={tank:{width:.6,height:.36,depth:.3}},high=resolveRenderQuality({preference:"high"}),low=resolveRenderQuality({preference:"low"});
  const highBounds=tankShadowBounds(tank,high),lowBounds=tankShadowBounds(tank,low),recovered=tankShadowBounds(tank,resolveRenderQuality({preference:"high"}));
  assert(highBounds.right-highBounds.left<1.1,"shadow camera should fit the aquarium instead of a broad studio frustum");
  assert.equal(highBounds.mapSize,1536);
  assert.equal(lowBounds.mapSize,768);
  assert.deepEqual(recovered,highBounds,"quality recovery should restore the original detailed shadow budget");
});

test("reference-camera bounds include mounted lights instead of clipping to tank height",()=>{
  const record=initialScene();record.equipment=[{id:"export-light",kind:"light",catalogId:"light-ada-aquasky-rgb-ii-60",mount:"rim-bar",offset:0,enabled:true}];
  assert(referenceCameraBounds(record).max.y>record.tank.height+.03);
});

// A leaf/stem seam must remain attached when their glTF materials differ.
test("multi-material foliage and shadow geometry advance together and respect pause",()=>{
  const content=new T.Group(),materials=[new T.MeshStandardMaterial(),new T.MeshStandardMaterial()];
  const plant=new T.Mesh(new T.BoxGeometry(.02,.1,.02),materials);plant.userData.fishyPlant=true;content.add(plant);
  const effects=createAquariumEffects(content,null,initialScene(),resolveRenderQuality({preference:"high"}));
  effects.setTime(3);effects.update(.05);
  for(const material of materials)assert.equal(plantMotionState(material).time.value,3.05);
  const shadowState=plant.customDepthMaterial.userData.fishyPlantMotion;
  assert.equal(shadowState.time.value,3.05);
  effects.setPaused(true);effects.update(.1);
  for(const material of materials)assert.equal(plantMotionState(material).time.value,3.05);
  effects.refreshPlants();
  for(const material of materials)assert.equal(plantMotionState(material).time.value,3.05);
  effects.dispose();plant.geometry.dispose();materials.forEach(m=>m.dispose());
});

test("scanned fern cutouts retain their opacity maps in both shadow passes",()=>{
  const map=new T.Texture(),alphaMap=new T.Texture(),material=new T.MeshStandardMaterial({map,alphaMap,alphaTest:.5,side:T.DoubleSide});
  const state=wrapPlantMaterial(material),depth=plantDepthMaterial(material,state),distance=plantDistanceMaterial(state,material);
  for(const shadow of [depth,distance]){assert.equal(shadow.map,map);assert.equal(shadow.alphaMap,alphaMap);assert.equal(shadow.alphaTest,.5);assert.equal(shadow.side,T.DoubleSide);shadow.dispose();}
  material.dispose();map.dispose();alphaMap.dispose();
});

test("separate glTF leaf and stem primitives keep the same plant phase",()=>{
  const content=new T.Group(),root=new T.Group();content.add(root);
  for(let i=0;i<2;i++){const mesh=new T.Mesh(new T.BoxGeometry(.02,.1,.02),new T.MeshStandardMaterial());mesh.userData.fishyPlant=true;root.add(mesh);}
  const effects=createAquariumEffects(content,null,initialScene(),resolveRenderQuality({preference:"high"}));effects.setTime(9.7);
  const [leaf,stem]=root.children.map(mesh=>plantMotionState(mesh.material));
  assert.equal(leaf.phase.value,stem.phase.value);assert.equal(leaf.stiffness.value,stem.stiffness.value);assert.equal(leaf.time.value,stem.time.value);
  effects.dispose();for(const mesh of root.children){mesh.geometry.dispose();mesh.material.dispose();}
});
