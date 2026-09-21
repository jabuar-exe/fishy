import * as T from "three";
import {isSystemCatalogEntry,type CatalogEntry} from "./catalog.ts";
import {systemTransform,filterOutletDatum,type FilterTankScene} from "./equipment.ts";
import {RoundedBoxGeometry} from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type {EquipmentInstance,SceneRecord,Vec3} from "./scene.ts";

function tube(points:Vec3[],radius:number,material:T.Material) {
  return new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(point=>new T.Vector3(...point))),20,radius,7,false),material);
}

function fixed(group:T.Group,instance:EquipmentInstance) {
  group.userData.objectId=instance.id;
  group.userData.fixedMount=true;
  group.userData.installedSystem=instance.kind;
  group.traverse(object=>{if(object instanceof T.Mesh){object.castShadow=true;object.receiveShadow=true;}});
  return group;
}

function poweredMaterial(color:string,enabled:boolean,opacity:number) {
  return new T.MeshStandardMaterial({color:enabled?color:"#344241",roughness:.18,transparent:true,opacity:enabled?opacity:.06,emissive:enabled?color:"#000000",emissiveIntensity:enabled?.12:0});
}

export type LightFixtureGeometry={bodySize:Vec3;bodyCenterY:number;emitterLocalPosition:Vec3;emitterWorldPosition:Vec3;supportBottomY:number|null;supportTopY:number|null};

/** Shared physical datum for the rendered fixture and its real light origin. */
export function lightFixtureGeometry(instance:EquipmentInstance,scene:Pick<SceneRecord,"tank">,entry:CatalogEntry):LightFixtureGeometry {
  const profile=entry.system;
  if(!profile||profile.type!=="light")throw new Error(`${entry.displayLabel} is not a light fixture.`);
  const [lengthCm,depthCm,heightCm]=profile.nominalDimensionsCm,nominalHeight=heightCm/100,root=systemTransform(instance,scene);
  if(profile.silhouette==="bar"){
    const rimY=scene.tank.height-root.position[1],fixtureTopY=rimY+nominalHeight,bodyHeight=Math.min(.024,nominalHeight*.6),bodyBottomY=fixtureTopY-bodyHeight,emitterY=bodyBottomY+.0015;
    const emitterLocalPosition:Vec3=[0,emitterY,0];
    return {bodySize:[lengthCm/100,bodyHeight,depthCm/100],bodyCenterY:bodyBottomY+bodyHeight/2,emitterLocalPosition,emitterWorldPosition:[root.position[0],root.position[1]+emitterY,root.position[2]],supportBottomY:rimY,supportTopY:bodyBottomY};
  }
  const bodyHeight=nominalHeight,bodyBottomY=-bodyHeight/2,emitterY=bodyBottomY-.002,emitterLocalPosition:Vec3=[0,emitterY,0];
  return {bodySize:[lengthCm/100,bodyHeight,depthCm/100],bodyCenterY:0,emitterLocalPosition,emitterWorldPosition:[root.position[0],root.position[1]+emitterY,root.position[2]],supportBottomY:null,supportTopY:null};
}

function housing(entry:CatalogEntry) {
  const profile=entry.system;if(profile?.type!=="filter")throw new Error("Filter housing requires a filter.");
  const [w,d,h]=profile.nominalDimensionsCm.map(cm=>cm/100),group=new T.Group();group.name="Equipment body";
  group.userData.filterBodyAsset=entry.id;group.userData.nominalEnvelopeMetres=[w,h,d];
  const plastic=new T.MeshStandardMaterial({color:entry.color??"#313b38",roughness:.48,metalness:.08}),lid=new T.MeshStandardMaterial({color:"#171f22",roughness:.36,metalness:.14}),accent=new T.MeshStandardMaterial({color:entry.id.includes("fluval")?"#8e2525":"#586963",roughness:.42,metalness:.15});
  const box=(name:string,size:Vec3,pos:Vec3,mat:T.Material)=>{const mesh=new T.Mesh(new RoundedBoxGeometry(...size,3,Math.min(...size)*.14),mat);mesh.name=name;mesh.position.fromArray(pos);group.add(mesh);return mesh;};
  if(entry.id.includes("eheim")){
    const body=new T.Mesh(new T.CylinderGeometry(w/2,w/2,h*.78,40),plastic);body.position.y=h*.39;group.add(body);
    const motor=new T.Mesh(new T.CylinderGeometry(w*.47,w*.5,h*.15,40),lid);motor.position.y=h*.88;group.add(motor);
  }else{
    box("Moulded filter vessel",[w,h*.77,d],[0,h*.405,0],plastic);
    box("Separated motor lid",[w*.99,h*.14,d*.98],[0,h*.872,0],lid);
    for(const side of [-1,1])box("Quick-release latch",[w*.075,h*.14,d*.19],[side*w*.457,h*.797,d*.25],accent);
    for(const side of [-1,1])box("Non-slip foot",[w*.18,h*.026,d*.64],[side*w*.34,h*.013,0],lid);
  }
  for(const side of [-1,1]){const port=new T.Mesh(new T.CylinderGeometry(w*.037,w*.045,h*.056,18),accent);port.position.set(side*w*.24,h*.972,0);group.add(port);}
  box("Handle bridge",[w*.42,h*.035,d*.075],[0,h*.95,-d*.18],lid);
  return group;
}

function canister(instance:EquipmentInstance,scene:FilterTankScene,entry:CatalogEntry) {
  const group=new T.Group(),profile=entry.system;if(profile?.type!=="filter")return group;
  const [w,d,h]=profile.nominalDimensionsCm.map(cm=>cm/100),root=systemTransform(instance,scene),datum=filterOutletDatum(instance,scene,entry);
  const pipeMat=new T.MeshStandardMaterial({color:entry.id.includes("eheim")?"#326b4c":"#222d2c",roughness:.29,metalness:.08}),waterMat=poweredMaterial("#a9d5ce",instance.enabled,.22);
  const body=housing(entry);body.position.set(0,datum.bodyBaseY,-d/2-.005);group.add(body);
  const crest=Math.max(scene.tank.height+.018,h+.018)-root.position[1],intakeY=(scene.substrate??.04)+.05-root.position[1];
  for(const side of [-1,1] as const){
    const x=side*w*.24,z=-d/2-.005,portY=datum.bodyBaseY+h*.996,endY=side<0?intakeY:datum.localPosition[1];
    group.add(tube([[x,portY,z],[x,Math.max(portY+.015,crest-.03),z],[x,crest,-.014],[x,crest,.025],[x,endY+.018,.040],[x,endY,.040]],.0034,pipeMat));
    if(side<0){const strainer=new T.Mesh(new T.CylinderGeometry(.007,.007,.032,16),pipeMat);strainer.position.set(x,endY-.016,.040);group.add(strainer);for(let n=0;n<6;n++){const band=new T.Mesh(new T.TorusGeometry(.0074,.0007,5,18),pipeMat);band.rotation.x=Math.PI/2;band.position.set(x,endY-.003-n*.005,.040);group.add(band);}}
  }
  const [ox,oy,oz]=datum.localPosition;
  if(profile.outlet==="line"){
    group.add(tube([[-w*.30,oy,oz],[0,oy,oz],[w*.30,oy,oz]],.004,pipeMat));
    for(let i=0;i<7;i++){const nozzle=new T.Mesh(new T.CylinderGeometry(.0014,.0014,.004,8),pipeMat);nozzle.rotation.x=Math.PI/2;nozzle.position.set((i-3)*w*.09,oy,oz+.004);group.add(nozzle);}
  }else{const nozzle=new T.Mesh(new T.CylinderGeometry(.005,.004,.017,20,1,true),pipeMat);nozzle.rotation.x=Math.PI/2;nozzle.position.set(ox,oy,oz+.005);group.add(nozzle);}
  const cue=new T.Mesh(new T.CylinderGeometry(.002,.006,.018,12,1,true),waterMat);cue.name="Filter powered flow";cue.userData.powered=instance.enabled;cue.rotation.x=Math.PI/2;cue.position.set(ox,oy,oz+.022);group.add(cue);
  return fixed(group,instance);
}

function hangOnBack(instance:EquipmentInstance,scene:FilterTankScene,entry:CatalogEntry) {
  const group=new T.Group(),profile=entry.system;if(profile?.type!=="filter")return group;
  const [w,d,h]=profile.nominalDimensionsCm.map(cm=>cm/100),datum=filterOutletDatum(instance,scene,entry),root=systemTransform(instance,scene),body=housing(entry);body.position.set(0,datum.bodyBaseY,-d/2-.005);group.add(body);
  const plastic=new T.MeshStandardMaterial({color:entry.color??"#243235",roughness:.43,metalness:.06}),waterMat=poweredMaterial("#bfded8",instance.enabled,.30);
  const lip=new T.Mesh(new RoundedBoxGeometry(w*.64,.005,.052,3,.0015),plastic);lip.position.set(0,datum.localPosition[1]+.003,.032);group.add(lip);
  const intakeY=(scene.substrate??.04)+.055-root.position[1];group.add(tube([[w*.28,.02,-.01],[w*.28,.021,.03],[w*.28,intakeY,.033]],.0035,plastic));
  const strainer=new T.Mesh(new T.CylinderGeometry(.008,.008,.025,16),plastic);strainer.position.set(w*.28,intakeY-.012,.033);group.add(strainer);
  const fall=Math.max(.005,datum.worldPosition[1]-datum.waterHeight),waterfall=new T.Mesh(new T.PlaneGeometry(w*.59,fall,12,16),waterMat);waterfall.name="Filter powered flow";waterfall.userData.powered=instance.enabled;waterfall.position.set(0,datum.localPosition[1]-fall/2,datum.localPosition[2]+.004);group.add(waterfall);
  for(let tooth=0;tooth<9;tooth++){const weir=new T.Mesh(new T.BoxGeometry(w*.032,.007,.005),plastic);weir.position.set((tooth-4)*w*.06,datum.localPosition[1]+.004,.054);group.add(weir);}
  return fixed(group,instance);
}

function lightFixture(instance:EquipmentInstance,scene:Pick<SceneRecord,"tank">,entry:CatalogEntry) {
  const group=new T.Group(),profile=entry.system;
  if(!profile||profile.type!=="light")return group;
  const {height}=scene.tank,datum=lightFixtureGeometry(instance,scene,entry),[barWidth,barHeight,barDepth]=datum.bodySize,bodyMat=new T.MeshStandardMaterial({color:entry.color??"#282d31",roughness:.25,metalness:.62}),emitterMat=new T.MeshStandardMaterial({color:instance.enabled?"#fff5cf":"#3a3c3b",emissive:instance.enabled?"#fff1bd":"#000000",emissiveIntensity:instance.enabled?1.7:0,roughness:.15});
  const bar=new T.Mesh(new T.BoxGeometry(barWidth,barHeight,barDepth),bodyMat);bar.name="Equipment body";bar.userData.nominalEnvelopeMetres=datum.bodySize;bar.position.y=datum.bodyCenterY;group.add(bar);
  const emitter=new T.Mesh(new T.BoxGeometry(barWidth*.91,.003,barDepth*.48),emitterMat);emitter.name="Light powered emitter";emitter.userData.powered=instance.enabled;emitter.position.fromArray(datum.emitterLocalPosition);group.add(emitter);
  const diodes=Math.min(32,Math.max(8,Math.round(profile.ratedWatts*.45)));for(let index=0;index<diodes;index++){const diode=new T.Mesh(new T.SphereGeometry(.0022,8,6),emitterMat);diode.position.set(T.MathUtils.lerp(-barWidth*.39,barWidth*.39,index/Math.max(1,diodes-1)),datum.emitterLocalPosition[1],0);group.add(diode);}
  if(profile.silhouette==="pendant"){
    for(const x of [-barWidth*.32,barWidth*.32])group.add(tube([[x,.005,0],[x,height*.28,0]],.0012,bodyMat));
    const canopy=new T.Mesh(new T.CylinderGeometry(.043,.035,.012,18),bodyMat);canopy.position.y=height*.29;group.add(canopy);
  } else {
    const rimY=datum.supportBottomY??0,bodyBottom=datum.supportTopY??0,legHeight=bodyBottom-rimY;
    for(const x of [-barWidth*.42,barWidth*.42]){
      const leg=new T.Mesh(new T.BoxGeometry(.008,legHeight,.012),bodyMat);leg.name="Rim support";leg.position.set(x,(bodyBottom+rimY)/2,0);group.add(leg);
    }
  }
  return fixed(group,instance);
}

export function buildEquipmentModel(instance:EquipmentInstance,scene:FilterTankScene,entry:CatalogEntry) {
  if(!isSystemCatalogEntry(entry)||(entry.system.type!=="filter"&&entry.system.type!=="light"))throw new Error(`${entry.displayLabel} cannot be built as equipment.`);
  const group=entry.system.type==="filter"?(entry.system.silhouette==="hob"?hangOnBack(instance,scene,entry):canister(instance,scene,entry)):lightFixture(instance,scene,entry);
  const transform=systemTransform(instance,scene);group.position.fromArray(transform.position);group.rotation.set(...transform.rotation);group.name=entry.displayLabel;group.userData.nominalDimensionsCm=entry.system.nominalDimensionsCm;group.updateMatrixWorld(true);return group;
}

export function buildSystemPreview(entry:CatalogEntry) {
  if(!isSystemCatalogEntry(entry))throw new Error(`${entry.displayLabel} is not a system preview.`);
  const group=new T.Group();
  if(entry.system.type==="substrate"){
    const floor=new T.Mesh(new T.BoxGeometry(.28,.036,.19),new T.MeshStandardMaterial({color:entry.color??"#51463a",roughness:1}));floor.position.y=.018;floor.castShadow=true;floor.receiveShadow=true;group.add(floor);
    const grainGeometry=new T.DodecahedronGeometry(.004,0),grainMaterial=new T.MeshStandardMaterial({color:new T.Color(entry.color??"#8b7a60").multiplyScalar(1.28),roughness:1});
    for(let i=0;i<86;i++){const x=((i*37.13)%1-.5)*.25,z=((i*73.71)%1-.5)*.16,grain=new T.Mesh(grainGeometry,grainMaterial);grain.position.set(x,.039+(i%3)*.001,z);grain.scale.setScalar(.55+(i%5)*.11);grain.rotation.set(i*.7,i*1.2,i*.3);group.add(grain);}
  } else {
    const sampleScene={tank:{width:.42,depth:.24,height:.26,source:"assumed" as const}};
    const instance:EquipmentInstance={id:"preview-system",kind:entry.system.type,catalogId:entry.id,mount:entry.system.type==="filter"?(entry.system.mount==="rim"?"rear-rim":"rear-glass"):(entry.system.mount==="rim"?"rim-bar":"pendant"),offset:0,enabled:true};
    const model=buildEquipmentModel(instance,sampleScene,entry);model.position.set(0,0,0);group.add(model);
  }
  group.updateMatrixWorld(true);return group;
}
