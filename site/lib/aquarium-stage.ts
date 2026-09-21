import * as T from "three";
import {RoomEnvironment} from "three/examples/jsm/environments/RoomEnvironment.js";
import {catalogEntryById,isSystemCatalogEntry} from "./catalog.ts";
import {activeLights,installedSystems} from "./equipment.ts";
import {buildEquipmentModel,lightFixtureGeometry} from "./equipment-models.ts";
import {makeObject} from "./geometry.ts";
import {surfaceMaterial} from "./surface-materials.ts";
import {aquariumGlass,createAquariumEffects,reflectiveWater} from "./aquarium-effects.ts";
import {aquariumWaterHeight} from "./render-profile.ts";
import {createCascade} from "./cascade.ts";
import {resolveRenderQuality,type RenderQuality} from "./render-quality.ts";
import type {SceneRecord} from "./scene.ts";

function kelvinColor(kelvin:number) {
  if(kelvin<5800)return new T.Color("#ffe2a8");
  if(kelvin>7200)return new T.Color("#c8e3ff");
  return new T.Color("#fff5dc");
}

function clearLights(group:T.Group) {
  for(const child of [...group.children]){
    child.removeFromParent();
    if(child instanceof T.SpotLight||child instanceof T.DirectionalLight)child.shadow.map?.dispose();
  }
}

export type AquariumLightingState={mode:"inspection"|"night"|"powered";hemi:number;sun:number;fill:number;exposure:number};

/** Resolve fixture power separately from fixture presence so switching every installed light off is visibly meaningful. */
export function aquariumLightingState(record:SceneRecord):AquariumLightingState {
  const installed=installedSystems(record).filter(system=>system.entry.system?.type==="light");
  if(!installed.length)return {mode:"inspection",hemi:.55,sun:3,fill:.4,exposure:.95};
  const powered=activeLights(record);
  if(!powered.length)return {mode:"night",hemi:.12,sun:.05,fill:.03,exposure:.48};
  const total=powered.reduce((sum,system)=>sum+(system.entry.system?.type==="light"?system.entry.system.intensity:0),0);
  return {mode:"powered",hemi:.38,sun:.7,fill:.13,exposure:Math.min(1.3,.7+total*.18)};
}

export function aquariumSpotlightOrigins(record:SceneRecord) {
  return activeLights(record).slice(0,4).map(({instance,entry})=>lightFixtureGeometry(instance,record,entry).emitterWorldPosition);
}

export function tankShadowBounds(record:{tank:Pick<SceneRecord["tank"],"width"|"height"|"depth">},quality:RenderQuality) {
  const {width,height,depth}=record.tank,margin=Math.max(.05,Math.max(width,depth)*.35),halfX=width/2+margin,halfY=height+margin;
  return {left:-halfX,right:halfX,top:halfY,bottom:-margin,near:.02,far:Math.max(2,Math.hypot(width,depth,height)*4),mapSize:quality.shadowMapSize};
}

function fitTankShadow(sun:T.DirectionalLight,record:{tank:Pick<SceneRecord["tank"],"width"|"height"|"depth">},quality:RenderQuality) {
  const bounds=tankShadowBounds(record,quality);
  sun.shadow.mapSize.set(quality.shadowMapSize,quality.shadowMapSize);
  sun.shadow.camera.left=bounds.left;sun.shadow.camera.right=bounds.right;sun.shadow.camera.top=bounds.top;sun.shadow.camera.bottom=bounds.bottom;
  sun.shadow.camera.near=bounds.near;sun.shadow.camera.far=bounds.far;
  sun.shadow.camera.updateProjectionMatrix();
}

export function createAquariumStage(renderer:T.WebGLRenderer,options:RenderQuality|{quality?:RenderQuality}=resolveRenderQuality()) {
  const initialQuality:RenderQuality="tier" in options?options:options.quality??resolveRenderQuality();
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  const scene=new T.Scene();scene.background=new T.Color("#111d21");scene.environmentIntensity=.32;
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  const hemi=new T.HemisphereLight("#edf5ff","#182016",.85);scene.add(hemi);
  const sun=new T.DirectionalLight("#fff4d7",3);sun.position.set(-.5,1,.25);sun.castShadow=true;sun.shadow.normalBias=.0015;sun.shadow.bias=-.00015;scene.add(sun,sun.target);
  const fill=new T.DirectionalLight("#a0c7d3",.5);fill.position.set(1,.5,-1);scene.add(fill);
  const installedLightRig=new T.Group();installedLightRig.name="Installed lighting";scene.add(installedLightRig);
  let quality=initialQuality;
  const setRenderQuality=(next:RenderQuality)=>{
    const resized=sun.shadow.mapSize.x!==next.shadowMapSize||sun.shadow.mapSize.y!==next.shadowMapSize;
    if(resized&&sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}
    quality=next;renderer.shadowMap.enabled=true;renderer.shadowMap.needsUpdate=true;fitTankShadow(sun,{tank:{width:.6,height:.36,depth:.3}},quality);
  };
  setRenderQuality(quality);
  const applyLighting=(record:SceneRecord)=>{
    clearLights(installedLightRig);
    const installed=activeLights(record);
    const origins=aquariumSpotlightOrigins(record);
    const state=aquariumLightingState(record);
    hemi.intensity=state.hemi;sun.intensity=state.sun;fill.intensity=state.fill;renderer.toneMappingExposure=state.exposure;sun.target.position.set(0,record.tank.height*.28,0);fitTankShadow(sun,record,quality);renderer.shadowMap.needsUpdate=true;
    installed.slice(0,4).forEach(({entry},index)=>{
      if(entry.system?.type!=="light")return;
      const profile=entry.system,{width,depth}=record.tank,[x,y,z]=origins[index],color=kelvinColor(profile.kelvin);
      const fixtureLight=new T.SpotLight(color,1.5+profile.intensity*3.2,Math.max(width,depth)*2.5,Math.PI*(.19+profile.beam*.19),.45,1.2);
      fixtureLight.position.set(x,y,z);fixtureLight.target.position.set(x,record.substrate+.012,z);fixtureLight.castShadow=index<2&&quality.tier==="high";fixtureLight.shadow.mapSize.set(quality.shadowMapSize,quality.shadowMapSize);fixtureLight.shadow.bias=-.0002;installedLightRig.add(fixtureLight,fixtureLight.target);
    });
  };
  return {scene,applyLighting,setRenderQuality,dispose:()=>{clearLights(installedLightRig);env.dispose();sun.shadow.map?.dispose();}};
}

export function populateAquarium(content:T.Group,record:SceneRecord,showWater:boolean,options?:{quality?:RenderQuality}) {
  const {width:W,height:H,depth:D}=record.tank,meshes=new Map<string,T.Object3D>(),waterHeight=aquariumWaterHeight(record);let water:T.Mesh|null=null;
  const visual=(record as SceneRecord&{visual?:{quality?:"auto"|"high"|"low"}}).visual;
  const quality=options?.quality??resolveRenderQuality({preference:visual?.quality});
  const substrateEntry=record.substrateCatalogId?catalogEntryById(record.substrateCatalogId):undefined;
  const substrateProfile=substrateEntry&&isSystemCatalogEntry(substrateEntry)&&substrateEntry.system.type==="substrate"?substrateEntry.system:undefined;
  const substrateColor=substrateProfile?substrateEntry?.color??"#b8aa87":"#b8aa87",roughness=substrateProfile?.roughness??.9;
  const base=new T.Mesh(new T.BoxGeometry(W+.016,.02,D+.016),new T.MeshStandardMaterial({color:"#101817",roughness:.8}));base.position.y=-.012;base.receiveShadow=true;content.add(base);
  const edges=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(W,H,D)),new T.LineBasicMaterial({color:"#a8ccc0",transparent:true,opacity:.42}));edges.position.y=H/2;edges.userData.excludeFromWaterReflection=true;content.add(edges);
  const back=new T.Mesh(new T.PlaneGeometry(W,H),new T.MeshStandardMaterial({color:"#18372a",roughness:.9,side:T.DoubleSide}));back.position.set(0,H/2,-D/2);back.receiveShadow=true;content.add(back,aquariumGlass(W,H,D,waterHeight,quality));
  const sand=new T.Mesh(new T.BoxGeometry(W-.005,record.substrate,D-.005),surfaceMaterial("sand",substrateColor));sand.position.y=record.substrate/2;sand.receiveShadow=true;content.add(sand);
  const pebbleGeo=new T.IcosahedronGeometry(1,2),pebbleMat=new T.MeshStandardMaterial({color:"#78847b",roughness:Math.min(.72,roughness)}),pebbles=new T.InstancedMesh(pebbleGeo,pebbleMat,420),dummy=new T.Object3D();
  const random=(i:number)=>{const value=Math.sin(i*127.1+37.7)*43758.5453;return value-Math.floor(value);};
  for(let i=0;i<420;i++){
    const x=(random(i*7)-.5)*(W-.016),z=(random(i*7+1)-.5)*(D-.016),inLane=Math.abs(x)<W*.16&&z>-.04;
    const radius=(.0014+Math.pow(random(i*7+2),3)*(i%11===0?.012:.005))*(inLane?.55:1);
    dummy.position.set(x,record.substrate+radius*.32,z);dummy.scale.set(radius*(.8+random(i*7+3)*.6),radius*(.35+random(i*7+4)*.4),radius*(.65+random(i*7+5)*.5));dummy.rotation.set(.2,random(i*7+6)*Math.PI,.14);dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);
    pebbles.setColorAt(i,new T.Color().setHSL(.13+random(i+71)*.09,.06+random(i+8)*.12,.27+random(i+102)*.20));
  }
  pebbles.castShadow=true;pebbles.receiveShadow=true;content.add(pebbles);
  for(const object of record.objects){const mesh=makeObject(object);content.add(mesh);meshes.set(object.id,mesh);}
  for(const instance of record.equipment){const entry=catalogEntryById(instance.catalogId);if(!entry||!isSystemCatalogEntry(entry)||(entry.system.type!==instance.kind))continue;const mesh=buildEquipmentModel(instance,record,entry);content.add(mesh);meshes.set(instance.id,mesh);}
  if(showWater){
    const depth=waterHeight-record.substrate;
    if(depth>0){
      const waterBody=new T.Mesh(new T.BoxGeometry(W-.008,depth,D-.008),new T.MeshBasicMaterial({color:"#316c5c",transparent:true,opacity:.045+(1-record.visual.clarity)*.065,depthWrite:false,side:T.FrontSide}));
      waterBody.material.userData.fishyWaterVolume=true;
      waterBody.name="Submerged water tint";waterBody.position.y=record.substrate+depth/2;waterBody.renderOrder=1;content.add(waterBody);
    }
    water=reflectiveWater(new T.PlaneGeometry(W-.008,D-.008,quality.waterSegments.width,quality.waterSegments.height),quality,record.visual?.clarity??.72);water.rotation.x=-Math.PI/2;water.position.y=waterHeight;water.renderOrder=2;content.add(water);if(record.visual?.cascade)content.add(createCascade(record));
  }
  return {meshes,water,quality,effects:createAquariumEffects(content,water,record,quality)};
}
