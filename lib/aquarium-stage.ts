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
    installed.slice(0,4).forEach(({instance,entry},index)=>{
      if(entry.system?.type!=="light")return;
      const profile=entry.system,{width,depth}=record.tank,[x,y,z]=origins[index],color=kelvinColor(profile.kelvin);
      const fixture=lightFixtureGeometry(instance,record,entry),sampleCount=Math.max(1,Math.min(3,Math.ceil(fixture.bodySize[0]/Math.max(.28,width*.42))));
      for(let sample=0;sample<sampleCount;sample++){
        const offset=sampleCount===1?0:(sample/(sampleCount-1)-.5)*fixture.bodySize[0]*.72;
        const fixtureLight=new T.SpotLight(color,(1.5+profile.intensity*3.2)/sampleCount,Math.max(width,depth)*2.5,Math.PI*(.19+profile.beam*.19),.45,1.2);
        fixtureLight.position.set(x+offset,y,z);fixtureLight.target.position.set(x+offset*.42,record.substrate+.012,z);fixtureLight.castShadow=index<2&&sample===Math.floor(sampleCount/2);fixtureLight.shadow.mapSize.set(1024,1024);fixtureLight.shadow.bias=-.0002;
        fixtureLight.shadow.camera.near=.02;fixtureLight.shadow.camera.far=Math.max(.5,y+record.tank.height);fixtureLight.shadow.camera.fov=T.MathUtils.radToDeg(fixtureLight.angle*2);
        installedLightRig.add(fixtureLight,fixtureLight.target);
      }
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
  const bedMaterial=surfaceMaterial("sand",substrateColor);bedMaterial.roughness=roughness;const sand=new T.Mesh(new T.BoxGeometry(W-.005,record.substrate,D-.005),bedMaterial);sand.position.y=record.substrate/2;sand.receiveShadow=true;content.add(sand);
  const grainName=substrateProfile?.grain??"mixed natural sand",fine=/fine|sand|powder/i.test(grainName),river=/river|gravel/i.test(grainName),grainRadius=fine?.00135:river?.0031:.00215,grainCount=Math.round(Math.max(360,Math.min(2400,520+W*D*(fine?6200:4400))));
  const pebbleGeo=river?new T.DodecahedronGeometry(grainRadius,1):new T.IcosahedronGeometry(grainRadius,fine?0:1),pebbleMat=new T.MeshStandardMaterial({color:"#ffffff",roughness,vertexColors:true}),pebbles=new T.InstancedMesh(pebbleGeo,pebbleMat,grainCount),matrix=new T.Matrix4(),position=new T.Vector3(),quaternion=new T.Quaternion(),scale=new T.Vector3(),euler=new T.Euler();
  const fraction=(value:number)=>value-Math.floor(value);for(let i=0;i<grainCount;i++){const x=fraction(Math.sin((i+1)*127.1)*43758.5453)-.5,z=fraction(Math.sin((i+1)*269.5)*24634.6345)-.5,jitter=.68+fraction(Math.sin((i+1)*93.7)*19341.7)*.72;position.set(x*(W-.014),record.substrate+grainRadius*(.55+jitter*.24),z*(D-.014));euler.set(i*.37,i*.91,i*.23);quaternion.setFromEuler(euler);scale.set(jitter*(river?1.32:1),jitter*(river?.68:.84),jitter*(river?1.08:1));matrix.compose(position,quaternion,scale);pebbles.setMatrixAt(i,matrix);const shade=.72+fraction(Math.sin((i+1)*51.3)*18317.1)*.55;pebbles.setColorAt(i,new T.Color(substrateColor).multiplyScalar(shade));}pebbles.instanceMatrix.needsUpdate=true;if(pebbles.instanceColor)pebbles.instanceColor.needsUpdate=true;pebbles.receiveShadow=true;content.add(pebbles);
  for(const object of record.objects){const mesh=makeObject(object);content.add(mesh);meshes.set(object.id,mesh);}
  for(const instance of record.equipment){const entry=catalogEntryById(instance.catalogId);if(!entry||!isSystemCatalogEntry(entry)||(entry.system.type!==instance.kind))continue;const mesh=buildEquipmentModel(instance,record,entry);content.add(mesh);meshes.set(instance.id,mesh);}
  if(showWater){water=new T.Mesh(new T.PlaneGeometry(W-.008,D-.008,36,24),new T.MeshPhysicalMaterial({color:"#9dccbe",metalness:0,roughness:.065,transmission:.34,thickness:.045,ior:1.333,transparent:true,opacity:.2,side:T.DoubleSide,depthWrite:false,envMapIntensity:1.2}));water.rotation.x=-Math.PI/2;water.position.y=H-.015;water.renderOrder=2;content.add(water);const lineGeometry=new T.BufferGeometry().setFromPoints([new T.Vector3(-W/2+.003,H-.014,-D/2+.003),new T.Vector3(W/2-.003,H-.014,-D/2+.003),new T.Vector3(W/2-.003,H-.014,D/2-.003),new T.Vector3(-W/2+.003,H-.014,D/2-.003)]),waterline=new T.LineLoop(lineGeometry,new T.LineBasicMaterial({color:"#c5eee8",transparent:true,opacity:.32}));waterline.renderOrder=3;content.add(waterline);}
  return {meshes,water};
}
