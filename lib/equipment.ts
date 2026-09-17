import {catalogEntryById,isSystemCatalogEntry,type CatalogEntry} from "./catalog.ts";
import type {EquipmentInstance,SceneRecord,Vec3} from "./scene.ts";
import type {FlowSource} from "./water-flow.ts";

export type InstalledSystem={instance:EquipmentInstance;entry:CatalogEntry};

export const maxByKind:Record<EquipmentInstance["kind"],number>={filter:6,light:4};
const MOUNT_CLEARANCE_METRES=.01;
const OFFSET_CANDIDATES=[0,-.8,.8,-.4,.4,-.6,.6,-.2,.2] as const;

export function equipmentCompatibilityMessage(entry:CatalogEntry,tank:SceneRecord["tank"]):string|null {
  if(!isSystemCatalogEntry(entry)||entry.system.type==="substrate")return null;
  if(entry.system.type==="filter"){
    const litres=tank.width*tank.depth*tank.height*1000,[minimum,maximum]=entry.system.compatibleVolumeLitres;
    if(litres<minimum||litres>maximum)return `${entry.displayLabel} is rated for ${minimum||"up to"}${minimum?"–":" "}${maximum} L aquariums; this tank holds ${Math.round(litres)} L.`;
    if(entry.system.mount==="internal"){
      const [,depthCm,heightCm]=entry.system.nominalDimensionsCm,tankDepthCm=tank.depth*100,tankHeightCm=tank.height*100;
      if(depthCm>tankDepthCm||heightCm>tankHeightCm)return `${entry.displayLabel} needs at least ${depthCm} cm tank depth and ${heightCm} cm tank height; this tank is ${Math.round(tankDepthCm)} cm deep and ${Math.round(tankHeightCm)} cm high.`;
    }
    return null;
  }
  const width=tank.width*100,[minimum,maximum]=entry.system.compatibleTankWidthCm;
  if(width<minimum||width>maximum)return `${entry.displayLabel} fits ${minimum}–${maximum} cm-wide tanks; this tank is ${Math.round(width)} cm wide.`;
  return null;
}

export function assertEquipmentCompatibility(entry:CatalogEntry,tank:SceneRecord["tank"]) {
  const message=equipmentCompatibilityMessage(entry,tank);if(message)throw new Error(message);
}

export function mountForCatalog(entry:CatalogEntry):EquipmentInstance["mount"] {
  if(!isSystemCatalogEntry(entry)||entry.system.type==="substrate")throw new Error(`${entry.displayLabel} is not mountable equipment.`);
  if(entry.system.type==="filter")return entry.system.mount==="rim"?"rear-rim":entry.system.mount==="internal"?"rear-internal":"rear-glass";
  return entry.system.mount==="suspended"?"pendant":"rim-bar";
}

export function installedSystems(scene:SceneRecord):InstalledSystem[] {
  return scene.equipment.flatMap(instance=>{
    const entry=catalogEntryById(instance.catalogId);
    return entry&&isSystemCatalogEntry(entry)&&entry.system.type===instance.kind?[{instance,entry}]:[];
  });
}

function mountSpanMetres(entry:CatalogEntry) {
  if(!isSystemCatalogEntry(entry)||(entry.system.type!=="filter"&&entry.system.type!=="light"))return 0;
  return entry.system.nominalDimensionsCm[0]/100;
}

function offsetClearanceMetres(a:EquipmentInstance,b:EquipmentInstance,scene:Pick<SceneRecord,"tank">) {
  return Math.abs(a.offset-b.offset)*scene.tank.width*.42;
}

function fitsMountingSpan(entry:CatalogEntry,offset:number,scene:Pick<SceneRecord,"tank">) {
  const x=Math.abs(offset*scene.tank.width*.42);
  return x+mountSpanMetres(entry)/2<=scene.tank.width/2+1e-6;
}

/** Returns a human-readable collision error for fixed equipment sharing a mounting rail. */
export function equipmentClearanceMessage(scene:SceneRecord):string|null {
  const systems=installedSystems(scene);
  for(const system of systems)if(!fitsMountingSpan(system.entry,system.instance.offset,scene))return `${system.entry.displayLabel} extends beyond its ${system.instance.mount.replace("-"," ")} mounting span.`;
  for(let index=0;index<systems.length;index++)for(let other=index+1;other<systems.length;other++){
    const left=systems[index],right=systems[other];
    if(left.instance.mount!==right.instance.mount)continue;
    const needed=(mountSpanMetres(left.entry)+mountSpanMetres(right.entry))/2+MOUNT_CLEARANCE_METRES;
    if(offsetClearanceMetres(left.instance,right.instance,scene)<needed)return `${left.entry.displayLabel} and ${right.entry.displayLabel} overlap on the ${left.instance.mount.replace("-"," ")} mounting rail.`;
  }
  return null;
}

function availableMountOffset(scene:SceneRecord,entry:CatalogEntry,mount:EquipmentInstance["mount"]) {
  const span=mountSpanMetres(entry),sameRail=installedSystems(scene).filter(system=>system.instance.mount===mount);
  return OFFSET_CANDIDATES.find(offset=>fitsMountingSpan(entry,offset,scene)&&sameRail.every(system=>{
    const needed=(span+mountSpanMetres(system.entry))/2+MOUNT_CLEARANCE_METRES;
    return Math.abs(offset-system.instance.offset)*scene.tank.width*.42>=needed;
  }));
}

export function createEquipment(entry:CatalogEntry,id:string):EquipmentInstance {
  if(!isSystemCatalogEntry(entry)||(entry.system.type!=="filter"&&entry.system.type!=="light"))throw new Error(`${entry.displayLabel} is not an installable filter or light.`);
  return {id,kind:entry.system.type,catalogId:entry.id,mount:mountForCatalog(entry),offset:0,enabled:true};
}

export function installEquipment(scene:SceneRecord,entry:CatalogEntry,id:string):SceneRecord {
  assertEquipmentCompatibility(entry,scene.tank);
  const mount=mountForCatalog(entry),offset=availableMountOffset(scene,entry,mount);
  if(offset===undefined)throw new Error(`No collision-free space remains on the ${mount.replace("-"," ")} mounting rail for ${entry.displayLabel}.`);
  const instance={...createEquipment(entry,id),offset};
  if(scene.equipment.some(item=>item.id===id)||scene.objects.some(item=>item.id===id))throw new Error("That installed system ID already exists.");
  if(scene.equipment.filter(item=>item.kind===instance.kind).length>=maxByKind[instance.kind])throw new Error(`This aquarium supports up to ${maxByKind[instance.kind]} installed ${instance.kind}s.`);
  const next={...scene,equipment:[...scene.equipment,instance]},clearance=equipmentClearanceMessage(next);
  if(clearance)throw new Error(clearance);
  return next;
}

export function systemTransform(instance:EquipmentInstance,scene:Pick<SceneRecord,"tank">):{position:Vec3;rotation:Vec3} {
  const {width,height,depth}=scene.tank;
  const x=instance.offset*width*.42;
  if(instance.mount==="rear-glass")return {position:[x,height*.66,-depth/2-.01],rotation:[0,0,0]};
  if(instance.mount==="rear-rim")return {position:[x,height+.006,-depth/2-.006],rotation:[0,0,0]};
  if(instance.mount==="rear-internal")return {position:[x,0,-depth/2],rotation:[0,0,0]};
  if(instance.mount==="rim-bar")return {position:[x,height+.038,0],rotation:[0,0,0]};
  return {position:[x,height+.19,0],rotation:[0,0,0]};
}

/** Filter profiles drive both surface waves and the horizontal current field. */
export function filterFlowSources(scene:SceneRecord):FlowSource[] {
  const {width,depth,height}=scene.tank,volumeLitres=Math.max(1,width*depth*height*1000);
  return installedSystems(scene).flatMap(({instance,entry})=>{
    if(!instance.enabled||entry.system?.type!=="filter")return [];
    const transform=systemTransform(instance,scene);
    const profile=entry.system;
    const x=Math.max(0,Math.min(1,(transform.position[0]+width/2)/width));
    const z=Math.max(0,Math.min(1,(transform.position[2]+depth/2)/depth));
    const spread=profile.outlet==="sheet"?.24:profile.outlet==="line"?.3:.16;
    const sourceStrength=Math.max(profile.flowStrength*.65,Math.min(.82,profile.ratedFlowLph/volumeLitres*.035));
    return [{position:[x,z],direction:[0,1],radius:spread,strength:sourceStrength,frequency:.72+sourceStrength*.8,turbulence:profile.outlet==="jet"?.8:.45}];
  });
}

export function activeLights(scene:SceneRecord):InstalledSystem[] {
  return installedSystems(scene).filter(({instance,entry})=>instance.enabled&&entry.system?.type==="light");
}

export function systemLabel(instance:EquipmentInstance,scene:SceneRecord) {
  const found=installedSystems(scene).find(system=>system.instance.id===instance.id);
  if(!found)return instance.kind;
  if(found.entry.system?.type==="filter")return `${found.entry.system.flowClass} flow · ${found.entry.system.outlet} outlet`;
  if(found.entry.system?.type==="light")return `${found.entry.system.kelvin} K · ${Math.round(found.entry.system.intensity*100)}% visual output`;
  return found.entry.placementRole;
}
