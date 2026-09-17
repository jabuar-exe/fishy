import * as T from "three";
import {isSystemCatalogEntry,type CatalogEntry} from "./catalog.ts";
import {systemTransform} from "./equipment.ts";
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

function canister(instance:EquipmentInstance,scene:Pick<SceneRecord,"tank">,entry:CatalogEntry) {
  const group=new T.Group(),profile=entry.system;
  if(!profile||profile.type!=="filter")return group;
  const {height,depth}=scene.tank,[lengthCm,depthCm,heightCm]=profile.nominalDimensionsCm,bodyLength=lengthCm/100,bodyDepth=depthCm/100,bodyHeight=heightCm/100,bodyZ=-bodyDepth/2,bodyMat=new T.MeshStandardMaterial({color:entry.color??"#293230",roughness:.36,metalness:.38}),pipeMat=new T.MeshStandardMaterial({color:"#20292a",roughness:.2,metalness:.48}),waterMat=poweredMaterial("#9ec9c3",instance.enabled,.62);
  // The external canister rests on the floor behind the rear pane at its source-listed size.
  const bodyY=bodyHeight/2-height*.66,body=new T.Mesh(new T.BoxGeometry(bodyLength,bodyHeight,bodyDepth),bodyMat);body.name="Equipment body";body.userData.nominalEnvelopeMetres=[bodyLength,bodyHeight,bodyDepth];body.position.set(0,bodyY,bodyZ);group.add(body);
  const capHeight=Math.min(.009,bodyHeight*.08),capY=bodyY+bodyHeight/2-capHeight/2,cap=new T.Mesh(new T.BoxGeometry(bodyLength*.94,capHeight,bodyDepth*.94),pipeMat);cap.position.set(0,capY,bodyZ);group.add(cap);
  for(const ringY of [-.22,.22]){const ring=new T.Mesh(new T.BoxGeometry(bodyLength*.99,.003,bodyDepth*.99),pipeMat);ring.position.set(0,bodyY+bodyHeight*ringY,bodyZ);group.add(ring);}
  for(const x of [-1,1] as const)for(const y of [-1,1] as const){const clasp=new T.Mesh(new T.BoxGeometry(.006,.013,.007),pipeMat);clasp.position.set(x*(bodyLength/2-.003),capY+y*.004,bodyZ);group.add(clasp);}
  for(const side of [-1,1] as const){
    const x=side*bodyLength*.24,top:Vec3=[x,capY+.004,bodyZ],returnY=height*.2;
    group.add(tube([top,[x,-height*.08,bodyZ],[x,returnY,-depth*.025],[x,returnY,.028]],.0032,pipeMat));
    const nozzle=new T.Mesh(new T.CylinderGeometry(.0045,.0035,.026,9),waterMat);nozzle.name="Filter powered flow";nozzle.userData.powered=instance.enabled;nozzle.rotation.x=Math.PI/2;nozzle.position.set(x,returnY,.039);group.add(nozzle);
  }
  return fixed(group,instance);
}

function hangOnBack(instance:EquipmentInstance,scene:Pick<SceneRecord,"tank">,entry:CatalogEntry) {
  const group=new T.Group(),profile=entry.system;
  if(!profile||profile.type!=="filter")return group;
  const {height}=scene.tank,[lengthCm,depthCm,heightCm]=profile.nominalDimensionsCm,bodyWidth=lengthCm/100,bodyDepth=depthCm/100,bodyHeight=heightCm/100,bodyMat=new T.MeshStandardMaterial({color:entry.color??"#263035",roughness:.33,metalness:.44}),waterMat=poweredMaterial("#a8d8d2",instance.enabled,.6);
  const body=new T.Mesh(new T.BoxGeometry(bodyWidth,bodyHeight,bodyDepth),bodyMat);body.position.set(0,bodyHeight/2-.02,-bodyDepth/2);group.add(body);
  const hook=new T.Mesh(new T.BoxGeometry(bodyWidth*.74,.015,bodyDepth+.02),bodyMat);hook.position.set(0,bodyHeight-.025,-bodyDepth/2+.02);group.add(hook);
  const intake=tube([[bodyWidth*.24,-.012,.016],[bodyWidth*.24,-height*.28,.022],[bodyWidth*.24,-height*.5,.025]],.0034,bodyMat);group.add(intake);
  const strainer=new T.Mesh(new T.CylinderGeometry(.008,.008,.021,10),bodyMat);strainer.position.set(bodyWidth*.24,-height*.51,.025);group.add(strainer);
  const waterfall=new T.Mesh(new T.PlaneGeometry(bodyWidth*.64,.025),waterMat);waterfall.name="Filter powered flow";waterfall.userData.powered=instance.enabled;waterfall.position.set(0,-.006,.031);waterfall.rotation.x=-.32;group.add(waterfall);
  for(let tooth=0;tooth<7;tooth++){const weir=new T.Mesh(new T.BoxGeometry(bodyWidth*.055,.006,.007),bodyMat);weir.position.set((tooth-3)*bodyWidth*.085,.002,.024);group.add(weir);}
  // The mounted body is deliberately fixed at the rear rim: it cannot be translated or rotated like hardscape.
  return fixed(group,instance);
}

function internalFilter(instance:EquipmentInstance,scene:Pick<SceneRecord,"tank">,entry:CatalogEntry) {
  const group=new T.Group(),profile=entry.system;
  if(!profile||profile.type!=="filter")return group;
  const [lengthCm,depthCm,heightCm]=profile.nominalDimensionsCm,width=lengthCm/100,depth=depthCm/100,height=heightCm/100;
  const shell=new T.MeshStandardMaterial({color:entry.color??"#263330",roughness:.35,metalness:.22}),foam=new T.MeshStandardMaterial({color:"#365e69",roughness:.88}),heater=new T.MeshStandardMaterial({color:"#202526",roughness:.25,metalness:.55}),water=poweredMaterial("#a9dbd5",instance.enabled,.7);
  const body=new T.Mesh(new T.BoxGeometry(width,height,depth),shell);body.name="Equipment body";body.userData.nominalEnvelopeMetres=[width,height,depth];body.position.set(0,height/2,depth/2);group.add(body);
  // Three removable sponge bays and intake slots make the filter read as a real internal corner unit.
  for(let bay=0;bay<3;bay++){
    const y=height*(.2+bay*.27),pad=new T.Mesh(new T.BoxGeometry(width*.8,height*.2,.003),foam);pad.position.set(0,y,depth-.002);group.add(pad);
    for(let slot=0;slot<7;slot++){const vent=new T.Mesh(new T.BoxGeometry(width*.055,.003,.002),heater);vent.position.set((slot-3)*width*.095,y+height*.075,depth-.001);group.add(vent);}
  }
  const heaterTube=new T.Mesh(new T.CylinderGeometry(.008,.008,height*.72,12),heater);heaterTube.position.set(width*.31,height*.48,depth*.68);group.add(heaterTube);
  for(const side of [-1,1] as const){const cup=new T.Mesh(new T.CylinderGeometry(.013,.017,.006,14),shell);cup.rotation.x=Math.PI/2;cup.position.set(side*width*.28,height*.7,.003);group.add(cup);}
  const spray=new T.Mesh(new T.CylinderGeometry(.004,.004,width*.72,10),shell);spray.rotation.z=Math.PI/2;spray.position.set(0,height-.025,depth-.012);group.add(spray);
  for(let outlet=0;outlet<6;outlet++){const jet=new T.Mesh(new T.CylinderGeometry(.0027,.0022,.018,8),water);jet.name="Filter powered flow";jet.userData.powered=instance.enabled;jet.rotation.x=Math.PI/2;jet.position.set((outlet-2.5)*width*.105,height-.025,depth-.012);group.add(jet);}
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

export function buildEquipmentModel(instance:EquipmentInstance,scene:Pick<SceneRecord,"tank">,entry:CatalogEntry) {
  if(!isSystemCatalogEntry(entry)||(entry.system.type!=="filter"&&entry.system.type!=="light"))throw new Error(`${entry.displayLabel} cannot be built as equipment.`);
  const group=entry.system.type==="filter"?(entry.system.silhouette==="hob"?hangOnBack(instance,scene,entry):entry.system.silhouette==="internal"?internalFilter(instance,scene,entry):canister(instance,scene,entry)):lightFixture(instance,scene,entry);
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
    const instance:EquipmentInstance={id:"preview-system",kind:entry.system.type,catalogId:entry.id,mount:entry.system.type==="filter"?(entry.system.mount==="rim"?"rear-rim":entry.system.mount==="internal"?"rear-internal":"rear-glass"):(entry.system.mount==="rim"?"rim-bar":"pendant"),offset:0,enabled:true};
    const model=buildEquipmentModel(instance,sampleScene,entry);model.position.set(0,0,0);group.add(model);
  }
  group.updateMatrixWorld(true);return group;
}
