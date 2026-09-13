import * as T from "three";
import {RoomEnvironment} from "three/examples/jsm/environments/RoomEnvironment.js";
import {catalogEntryById,isSystemCatalogEntry} from "./catalog.ts";
import {activeLights,installedSystems} from "./equipment.ts";
import {buildEquipmentModel,lightFixtureGeometry} from "./equipment-models.ts";
import {makeObject} from "./geometry.ts";
import {surfaceMaterial} from "./surface-materials.ts";
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
  if(!installed.length)return {mode:"inspection",hemi:.85,sun:3,fill:.5,exposure:.95};
  const powered=activeLights(record);
  if(!powered.length)return {mode:"night",hemi:.12,sun:.05,fill:.03,exposure:.48};
  const total=powered.reduce((sum,system)=>sum+(system.entry.system?.type==="light"?system.entry.system.intensity:0),0);
  return {mode:"powered",hemi:.38,sun:.7,fill:.13,exposure:Math.min(1.3,.7+total*.18)};
}

export function aquariumSpotlightOrigins(record:SceneRecord) {
  return activeLights(record).slice(0,4).map(({instance,entry})=>lightFixtureGeometry(instance,record,entry).emitterWorldPosition);
}

export function createAquariumStage(renderer:T.WebGLRenderer) {
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  const scene=new T.Scene();scene.background=new T.Color("#111d21");scene.environmentIntensity=.55;
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  const hemi=new T.HemisphereLight("#edf5ff","#182016",.85);scene.add(hemi);
  const sun=new T.DirectionalLight("#fff4d7",3);sun.position.set(-.5,1,.25);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-1.8;sun.shadow.camera.right=1.8;sun.shadow.camera.top=1.8;sun.shadow.camera.bottom=-1.8;sun.shadow.normalBias=.002;scene.add(sun);
  const fill=new T.DirectionalLight("#a0c7d3",.5);fill.position.set(1,.5,-1);scene.add(fill);
  const installedLightRig=new T.Group();installedLightRig.name="Installed lighting";scene.add(installedLightRig);
  const applyLighting=(record:SceneRecord)=>{
    clearLights(installedLightRig);
    const installed=activeLights(record);
    const origins=aquariumSpotlightOrigins(record);
    const state=aquariumLightingState(record);
    hemi.intensity=state.hemi;sun.intensity=state.sun;fill.intensity=state.fill;renderer.toneMappingExposure=state.exposure;
    installed.slice(0,4).forEach(({entry},index)=>{
      if(entry.system?.type!=="light")return;
      const profile=entry.system,{width,depth}=record.tank,[x,y,z]=origins[index],color=kelvinColor(profile.kelvin);
      const fixtureLight=new T.SpotLight(color,1.5+profile.intensity*3.2,Math.max(width,depth)*2.5,Math.PI*(.19+profile.beam*.19),.45,1.2);
      fixtureLight.position.set(x,y,z);fixtureLight.target.position.set(x,record.substrate+.012,z);fixtureLight.castShadow=index<2;fixtureLight.shadow.mapSize.set(1024,1024);fixtureLight.shadow.bias=-.0002;installedLightRig.add(fixtureLight,fixtureLight.target);
    });
  };
  return {scene,applyLighting,dispose:()=>{clearLights(installedLightRig);env.dispose();sun.shadow.map?.dispose();}};
}

export function populateAquarium(content:T.Group,record:SceneRecord,showWater:boolean) {
  const {width:W,height:H,depth:D}=record.tank,meshes=new Map<string,T.Object3D>();let water:T.Mesh|null=null;
  const substrateEntry=record.substrateCatalogId?catalogEntryById(record.substrateCatalogId):undefined;
  const substrateProfile=substrateEntry&&isSystemCatalogEntry(substrateEntry)&&substrateEntry.system.type==="substrate"?substrateEntry.system:undefined;
  const substrateColor=substrateProfile?substrateEntry?.color??"#b8aa87":"#b8aa87",roughness=substrateProfile?.roughness??.9;
  const base=new T.Mesh(new T.BoxGeometry(W+.016,.02,D+.016),new T.MeshStandardMaterial({color:"#101817",roughness:.8}));base.position.y=-.012;base.receiveShadow=true;content.add(base);
  const edges=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(W,H,D)),new T.LineBasicMaterial({color:"#a8ccc0",transparent:true,opacity:.42}));edges.position.y=H/2;content.add(edges);
  const back=new T.Mesh(new T.PlaneGeometry(W,H),new T.MeshPhysicalMaterial({color:"#315347",roughness:.2,transparent:true,opacity:.28,side:T.DoubleSide}));back.position.set(0,H/2,-D/2);content.add(back);
  const sand=new T.Mesh(new T.BoxGeometry(W-.005,record.substrate,D-.005),surfaceMaterial("sand",substrateColor));sand.position.y=record.substrate/2;sand.receiveShadow=true;content.add(sand);
  const pebbleGeo=new T.IcosahedronGeometry(.0022,0),pebbleMat=new T.MeshStandardMaterial({color:new T.Color(substrateColor).multiplyScalar(.83),roughness}),pebbles=new T.InstancedMesh(pebbleGeo,pebbleMat,280),matrix=new T.Matrix4();for(let i=0;i<280;i++){const x=(Math.sin(i*127.1)*43758.5453)%1,z=(Math.sin(i*269.5)*43758.5453)%1;matrix.makeTranslation(x*(W/2-.006),record.substrate,z*(D/2-.006));pebbles.setMatrixAt(i,matrix);}pebbles.receiveShadow=true;content.add(pebbles);
  for(const object of record.objects){const mesh=makeObject(object);content.add(mesh);meshes.set(object.id,mesh);}
  for(const instance of record.equipment){const entry=catalogEntryById(instance.catalogId);if(!entry||!isSystemCatalogEntry(entry)||(entry.system.type!==instance.kind))continue;const mesh=buildEquipmentModel(instance,record,entry);content.add(mesh);meshes.set(instance.id,mesh);}
  if(showWater){water=new T.Mesh(new T.PlaneGeometry(W-.008,D-.008,36,24),new T.MeshPhysicalMaterial({color:"#9dccbe",metalness:.05,roughness:.2,transparent:true,opacity:.11,side:T.DoubleSide,depthWrite:false}));water.rotation.x=-Math.PI/2;water.position.y=H-.015;water.renderOrder=2;content.add(water);}
  return {meshes,water};
}
