import assert from "node:assert/strict";
import test from "node:test";
import * as T from "three";
import {catalogEntries} from "../lib/catalog.ts";
import {activeLights,equipmentCompatibilityMessage,filterFlowSources,installEquipment,systemTransform} from "../lib/equipment.ts";
import {buildEquipmentModel,buildSystemPreview,lightFixtureGeometry} from "../lib/equipment-models.ts";
import {aquariumLightingState,aquariumSpotlightOrigins,populateAquarium} from "../lib/aquarium-stage.ts";
import {initialScene,validateScene} from "../lib/scene.ts";
import {WaterFlow} from "../lib/water-flow.ts";

const entry=id=>{
  const found=catalogEntries.find(item=>item.id===id);
  assert.ok(found,`missing catalog entry ${id}`);
  return found;
};

const sizeOf=object=>new T.Box3().setFromObject(object).getSize(new T.Vector3());
const boundsOf=object=>new T.Box3().setFromObject(object);
const near=(actual,expected,tolerance=1e-6)=>assert(Math.abs(actual-expected)<=tolerance,`${actual} should be within ${tolerance} of ${expected}`);
const dispose=model=>model.traverse(node=>{if(node.isMesh){node.geometry.dispose();const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(material=>material.dispose());}});

test("substrate, filters, and lights use dedicated system state instead of scene objects",()=>{
  const soil=entry("substrate-ada-amazonia-v2"),filter=entry("filter-fluval-207"),light=entry("light-ada-aquasky-rgb-ii-60");
  const base=initialScene(),withSubstrate={...base,substrate:soil.system.depth,substrateCatalogId:soil.id};
  const withFilter=installEquipment(withSubstrate,filter,"installed-filter");
  const complete=installEquipment(withFilter,light,"installed-light");
  const valid=validateScene(complete);
  assert.equal(valid.objects.length,base.objects.length);
  assert.deepEqual(valid.equipment.map(item=>item.kind),["filter","light"]);
  assert.equal(valid.equipment[0].mount,"rear-glass");
  assert.equal(valid.equipment[1].mount,"rim-bar");
  assert.throws(()=>validateScene({...valid,equipment:[{...valid.equipment[0],mount:"rim-bar"}]}),/(physically compatible|required mount)/);
});

test("installed filters seed directional flow and installed lights retain fixed tank transforms",()=>{
  const filter=entry("filter-seachem-tidal-55"),light=entry("light-ada-solar-rgb-ii");
  let scene=installEquipment(initialScene(),filter,"hob-filter");scene=installEquipment(scene,light,"pendant-light");
  const sources=filterFlowSources(scene);assert.equal(sources.length,1);assert.deepEqual(sources[0].direction,[0,1]);
  const water=new WaterFlow(19,13,scene.tank.width,scene.tank.depth,{initialDisturbance:0,sources});
  const [flowX,flowZ]=water.sampleCurrent(...sources[0].position);assert(Math.hypot(flowX,flowZ)>.2);assert(Math.hypot(...water.sampleCurrent(0,0))<Math.hypot(flowX,flowZ));
  const [installedLight]=activeLights(scene);assert.ok(installedLight);
  const filterPlacement=systemTransform(scene.equipment[0],scene),lightPlacement=systemTransform(installedLight.instance,scene);
  assert(filterPlacement.position[2]<-scene.tank.depth/2+.01,"filter stays at the rear tank boundary");
  assert(lightPlacement.position[1]>scene.tank.height,"light stays above the waterline");
});

test("the Oase internal filter mounts inside the rear pane with a source-grounded envelope",()=>{
  const product=entry("filter-oase-bioplus-thermo-100"),scene=installEquipment(initialScene(),product,"internal-filter"),instance=scene.equipment[0];
  assert.equal(instance.mount,"rear-internal");assert.deepEqual(product.system.nominalDimensionsCm,[12,11,27]);assert.equal(product.system.ratedFlowLph,500);
  const model=buildEquipmentModel(instance,scene,product),body=model.getObjectByName("Equipment body"),bounds=boundsOf(body);
  try{assert.ok(body);near(sizeOf(body).x,.12);near(sizeOf(body).y,.27);near(sizeOf(body).z,.11);assert(bounds.min.z>=-scene.tank.depth/2-1e-6);assert(bounds.max.z<=scene.tank.depth/2+1e-6);const fullBounds=boundsOf(model);assert(fullBounds.min.y>=-1e-6);assert(fullBounds.max.y<=scene.tank.height+1e-6);assert(fullBounds.min.z>=-scene.tank.depth/2-1e-6);assert(fullBounds.max.z<=scene.tank.depth/2+1e-6);assert.equal(filterFlowSources(scene).length,1);}
  finally{dispose(model);}
});

test("an internal filter is rejected when its complete rigid envelope cannot fit the tank",()=>{
  const product=entry("filter-oase-bioplus-thermo-100"),installed=installEquipment(initialScene(),product,"internal-filter"),smallTank={...installed.tank,depth:.1,height:.15};
  assert.match(equipmentCompatibilityMessage(product,smallTank),/at least 11 cm tank depth and 27 cm tank height/);
  assert.throws(()=>installEquipment({...initialScene(),tank:smallTank},product,"too-large"),/at least 11 cm tank depth and 27 cm tank height/);
  assert.throws(()=>validateScene({...installed,tank:smallTank}),/at least 11 cm tank depth and 27 cm tank height/);
});

test("substrate grains apply their selected color exactly once",()=>{
  const product=entry("substrate-ada-la-plata-sand"),scene={...initialScene(),substrate:product.system.depth,substrateCatalogId:product.id},content=new T.Group();
  populateAquarium(content,scene,false);
  const grains=content.children.find(child=>child.isInstancedMesh);assert.ok(grains);assert.equal(grains.material.color.getHexString(),"ffffff");
  const actual=new T.Color(),base=new T.Color(product.color);grains.getColorAt(0,actual);
  const ratios=[actual.r/base.r,actual.g/base.g,actual.b/base.b];near(ratios[0],ratios[1]);near(ratios[1],ratios[2]);
  content.traverse(node=>{if(node.isMesh){node.geometry.dispose();const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(material=>material.dispose());}});
});

test("every system product has a procedural rigid or granular preview",()=>{
  for(const product of catalogEntries.filter(entry=>["substrate","filter","light"].includes(entry.kind))){
    const preview=buildSystemPreview(product);
    try{assert(preview.children.length>0,`${product.id} needs a visible counterpart`);}
    finally{preview.traverse(node=>{if(node.isMesh){node.geometry.dispose();const material=Array.isArray(node.material)?node.material:[node.material];material.forEach(item=>item.dispose());}});}
  }
});

test("hardware keeps source-backed dimensions and rejects incompatible tank sizes",()=>{
  const base=initialScene(),largeLight=entry("light-fluval-plant-46"),largeFilter=entry("filter-fluval-407"),compatibleLight=entry("light-ada-aquasky-rgb-ii-60"),compatibleFilter=entry("filter-fluval-207");
  assert.deepEqual(largeLight.system.nominalDimensionsCm,[91.5,6.4,2]);
  assert.deepEqual(largeFilter.system.nominalDimensionsCm,[24,18,49]);
  assert.match(equipmentCompatibilityMessage(largeLight,base.tank),/91–115 cm-wide/);
  assert.match(equipmentCompatibilityMessage(largeFilter,base.tank),/150–500 L/);
  assert.throws(()=>installEquipment(base,largeLight,"too-wide"),/91–115 cm-wide/);
  assert.throws(()=>installEquipment(base,largeFilter,"too-strong"),/150–500 L/);
  assert.equal(equipmentCompatibilityMessage(compatibleLight,base.tank),null);
  assert.equal(equipmentCompatibilityMessage(compatibleFilter,base.tank),null);
  const mounted=installEquipment(base,compatibleFilter,"dimensioned-filter");
  const model=buildEquipmentModel(mounted.equipment[0],mounted,compatibleFilter);
  try{assert.deepEqual(model.userData.nominalDimensionsCm,[19,18,42]);}
  finally{model.traverse(node=>{if(node.isMesh){node.geometry.dispose();const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(material=>material.dispose());}});}
});

test("canister bodies preserve each source length, depth, and height axis",()=>{
  const scene=initialScene(),canisters=catalogEntries.filter(product=>product.system?.type==="filter"&&product.system.silhouette==="canister");
  assert(canisters.length>0);
  for(const product of canisters){
    const instance={id:`bounds-${product.id}`,kind:"filter",catalogId:product.id,mount:"rear-glass",offset:0,enabled:true},model=buildEquipmentModel(instance,scene,product),body=model.getObjectByName("Equipment body");
    try{
      assert.ok(body,`${product.id} must expose its rigid body envelope`);
      const size=sizeOf(body),[lengthCm,depthCm,heightCm]=product.system.nominalDimensionsCm;
      near(size.x,lengthCm/100);near(size.z,depthCm/100);near(size.y,heightCm/100);
      near(boundsOf(body).max.y,-.06,1e-6);
      assert(boundsOf(body).max.z<-scene.tank.depth/2,"cabinet body stays outside the rear glass");
      assert.equal(body.material.transparent,false,"canister housing is opaque");
      const hoses=model.children.filter(child=>child.name==="Over-rim filter hose");assert.equal(hoses.length,2);
      for(const hose of hoses)assert(boundsOf(hose).max.y>scene.tank.height+.01,"hoses bridge over the glass rim");
      if(lengthCm!==depthCm)assert.notEqual(size.x,size.z,`${product.id} must not collapse a rectangular footprint into a cylinder`);
    } finally {dispose(model);}
  }
});

test("every rim light keeps its nominal body envelope and all hardware at or above the waterline",()=>{
  const scene=initialScene(),rimLights=catalogEntries.filter(product=>product.system?.type==="light"&&product.system.mount==="rim");
  assert.equal(rimLights.length,9);
  for(const product of rimLights){
    const instance={id:`bounds-${product.id}`,kind:"light",catalogId:product.id,mount:"rim-bar",offset:0,enabled:true},model=buildEquipmentModel(instance,scene,product),body=model.getObjectByName("Equipment body"),supports=model.children.filter(child=>child.name==="Rim support");
    try{
      assert.ok(body,`${product.id} must expose its rigid body envelope`);assert.equal(supports.length,2,`${product.id} needs two rim supports`);
      const size=sizeOf(body),[lengthCm,depthCm,heightCm]=product.system.nominalDimensionsCm,bodyBounds=boundsOf(body),modelBounds=boundsOf(model);
      near(size.x,lengthCm/100);near(size.z,depthCm/100);
      assert(bodyBounds.min.y>scene.tank.height,`${product.id} body must clear the tank rim`);
      assert(modelBounds.min.y>=scene.tank.height-1e-6,`${product.id} hardware must not enter the water`);
      near(modelBounds.max.y-modelBounds.min.y,heightCm/100,1e-6);
      for(const support of supports){const supportBounds=boundsOf(support);near(supportBounds.min.y,scene.tank.height,1e-6);near(supportBounds.max.y,bodyBounds.min.y,1e-6);}
      if(product.id==="light-ada-aquasky-rgb-ii-60")near(modelBounds.max.y,scene.tank.height+.13,1e-6);
    } finally {dispose(model);}
  }
});

test("rim light feet touch both side panes throughout each compatible width range",()=>{
  for(const product of catalogEntries.filter(item=>item.system?.type==="light"&&item.system.mount==="rim")){
    const [minimum,maximum]=product.system.compatibleTankWidthCm;
    for(const widthCm of [minimum,(minimum+maximum)/2,maximum])for(const height of [.25,.55]){
      const scene={...initialScene(),objects:[],tank:{...initialScene().tank,width:widthCm/100,height}},installed=validateScene(installEquipment(scene,product,"rim-fit")),model=buildEquipmentModel(installed.equipment[0],installed,product);
      try{
        const seats=[];model.traverse(node=>{if(node.name==="Glass rim seat")seats.push(node);});assert.equal(seats.length,2);
        for(let index=0;index<seats.length;index++){
          const bounds=boundsOf(seats[index]),paneX=(index===0?-1:1)*scene.tank.width/2;
          near((bounds.min.x+bounds.max.x)/2,paneX);near(bounds.min.y,height);
          assert(bounds.min.x<paneX&&bounds.max.x>paneX,"seat straddles the glass pane");
        }
        assert.throws(()=>installEquipment(installed,product,"second"),/No collision-free space/);
        const body=boundsOf(model.getObjectByName("Equipment body"));
        for(const support of model.children.filter(node=>node.name==="Rim support")){
          const arm=boundsOf(support.getObjectByName("Adjustable support arm"));near(arm.max.y,body.min.y);
          assert(arm.min.x<=body.max.x&&arm.max.x>=body.min.x,"arm joins the nominal fixture body");
        }
      }finally{dispose(model);}
    }
  }
});

test("modeled emitters and stage spotlights share exact world origins",()=>{
  const base=initialScene(),rim=entry("light-ada-aquasky-rgb-ii-60"),pendant=entry("light-ada-solar-rgb-ii");
  let scene=installEquipment(base,rim,"aligned-rim");scene=installEquipment(scene,pendant,"aligned-pendant");
  const origins=aquariumSpotlightOrigins(scene);assert.equal(origins.length,2);
  for(let index=0;index<scene.equipment.length;index++){
    const instance=scene.equipment[index],product=entry(instance.catalogId),datum=lightFixtureGeometry(instance,scene,product),model=buildEquipmentModel(instance,scene,product),emitter=model.getObjectByName("Light powered emitter"),world=new T.Vector3();
    try{assert.ok(emitter);emitter.getWorldPosition(world);near(world.x,datum.emitterWorldPosition[0]);near(world.y,datum.emitterWorldPosition[1]);near(world.z,datum.emitterWorldPosition[2]);assert.deepEqual(origins[index],datum.emitterWorldPosition);}
    finally{dispose(model);}
  }
});

test("installed-but-disabled lights use a night baseline and power down their emitters",()=>{
  const light=entry("light-ada-aquasky-rgb-ii-60"),base=initialScene(),installed=installEquipment(base,light,"test-light"),disabled={...installed,equipment:installed.equipment.map(item=>({...item,enabled:false}))};
  assert.equal(aquariumLightingState(base).mode,"inspection");
  assert.equal(aquariumLightingState(installed).mode,"powered");
  const night=aquariumLightingState(disabled);assert.equal(night.mode,"night");assert(night.exposure<aquariumLightingState(base).exposure);
  const powered=buildEquipmentModel(installed.equipment[0],installed,light),off=buildEquipmentModel(disabled.equipment[0],disabled,light);
  const emitter=model=>model.getObjectByName("Light powered emitter");
  assert.equal(emitter(powered).material.emissiveIntensity,1.7);assert.equal(emitter(off).material.emissiveIntensity,0);assert.equal(emitter(off).userData.powered,false);
});

test("disabled filters provide neither flow sources nor a powered water cue",()=>{
  const filter=entry("filter-seachem-tidal-55"),installed=installEquipment(initialScene(),filter,"test-filter"),disabled={...installed,equipment:installed.equipment.map(item=>({...item,enabled:false}))};
  assert.equal(filterFlowSources(initialScene()).length,0);
  assert.equal(filterFlowSources(disabled).length,0);
  const calm=new WaterFlow(15,9,disabled.tank.width,disabled.tank.depth,{initialDisturbance:0,sources:filterFlowSources(disabled)});for(let i=0;i<120;i++)calm.advance(1/120);assert(calm.heights.every(height=>height===0));
  const powered=buildEquipmentModel(installed.equipment[0],installed,filter),off=buildEquipmentModel(disabled.equipment[0],disabled,filter);
  const cue=model=>model.getObjectByName("Filter powered flow");
  assert.equal(cue(powered).userData.powered,true);assert.equal(cue(off).userData.powered,false);assert(cue(off).material.opacity<cue(powered).material.opacity);
});
