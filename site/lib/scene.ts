import { z } from "zod";
import {sculptSchema} from "./sculpt.ts";
import {designSchema} from "./design.ts";
import {catalogExpansion} from "./catalog-expansion.ts";
import {DEFAULT_VISUAL_PROFILE,visualProfileSchema} from "./render-profile.ts";
import type {FilterProfile,LightProfile} from "./catalog-types.ts";

export const BUILDER = "fishy-browser-4";
export const SAVE_KEY = "fishy.studio.scene.v6";
const PREVIOUS_SAVE_KEY = "fishy.studio.scene.v5";
const position = z.tuple([z.number().min(-10).max(10),z.number().min(-10).max(10),z.number().min(-10).max(10)]);
const rotation = z.tuple([z.number().min(-Math.PI*100).max(Math.PI*100),z.number().min(-Math.PI*100).max(Math.PI*100),z.number().min(-Math.PI*100).max(Math.PI*100)]);
export const MAX_REVISION = Number.MAX_SAFE_INTEGER - 1;
/** Maximum number of editable hardscape and plant objects in a browser scene. */
export const MAX_SCENE_OBJECTS = 64;
export const objectSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().min(1).max(160),
  kind: z.enum(["wood", "rock", "plant"]),
  position, rotation, size: z.number().min(0.05).max(4),
  form: z.string().max(60), color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  protected: z.boolean(), catalogId: z.string().max(100).optional(),
  stretch: z.tuple([z.number().min(.01).max(20),z.number().min(.01).max(20),z.number().min(.01).max(20)]).optional(),
  sculpt: sculptSchema.optional(),
}).strict().refine(o=>!o.sculpt||(o.sculpt.basis.kind===o.kind&&o.sculpt.basis.form===o.form),"Reset sculpt before changing the base form").transform(o=>{if(!o.sculpt?.nodes.length)delete o.sculpt;return o;});
type EquipmentProduct={kind:"filter";mount:"rear-glass"|"rear-rim";profile:FilterProfile}|{kind:"light";mount:"rim-bar"|"pendant";profile:LightProfile};
const equipmentCatalog=new Map<string,EquipmentProduct>();
const substrateCatalogIds=new Set<string>();
for(const entry of catalogExpansion) {
  if(entry.system?.type==="substrate")substrateCatalogIds.add(entry.id);
  if(entry.system?.type==="filter")equipmentCatalog.set(entry.id,{kind:"filter",mount:entry.system.mount==="rim"?"rear-rim":"rear-glass",profile:entry.system});
  if(entry.system?.type==="light")equipmentCatalog.set(entry.id,{kind:"light",mount:entry.system.mount==="suspended"?"pendant":"rim-bar",profile:entry.system});
}
export const MAX_EQUIPMENT_BY_KIND={filter:6,light:4} as const;
const MOUNT_CLEARANCE_METRES=.01;
export const equipmentSchema=z.object({
  id:z.string().min(1).max(100),
  kind:z.enum(["filter","light"]),
  catalogId:z.string().min(1).max(100),
  /** Fixed semantic mounts prevent an external filter or fixture from becoming loose décor. */
  mount:z.enum(["rear-glass","rear-rim","rim-bar","pendant"]),
  offset:z.number().min(-.8).max(.8),
  enabled:z.boolean(),
}).strict().superRefine((item,ctx)=>{
  const product=equipmentCatalog.get(item.catalogId);
  if(!product){ctx.addIssue({code:"custom",path:["catalogId"],message:"Unknown installable equipment catalog ID."});return;}
  if(item.kind!==product.kind)ctx.addIssue({code:"custom",path:["kind"],message:"Installed equipment kind must match its catalog product."});
  if(item.mount!==product.mount)ctx.addIssue({code:"custom",path:["mount"],message:"Installed equipment must use the physically compatible required mount from its catalog product."});
});
export const sceneSchema = z.object({
  schema: z.literal(6), builder: z.literal(BUILDER), id: z.string().min(1).max(100), name: z.string().trim().min(1).max(120).default("Riverbend study"),
  revision: z.number().int().min(0).max(MAX_REVISION), units: z.literal("metres"),
  coordinates: z.literal("Y-up; X right; Z toward front; origin floor centre"),
  tank: z.object({ width: z.number().min(.1).max(3), depth: z.number().min(.1).max(3), height: z.number().min(.1).max(3), source: z.enum(["assumed", "user-entered"]) }),
  substrate: z.number().min(0).max(.05), substrateCatalogId:z.string().min(1).max(100).optional(), objects: z.array(objectSchema).max(MAX_SCENE_OBJECTS),
  equipment:z.array(equipmentSchema).max(10).default([]),
  /** Browser visual settings are persisted independently of editable aquascape geometry. */
  visual:visualProfileSchema.default(DEFAULT_VISUAL_PROFILE),
  references: z.array(z.string().max(120)).max(50), brief: z.string().max(3000),
  /** Declared design intent. Optional so existing saves load; required by the Blender recipe. */
  design: designSchema.optional(),
}).strict().superRefine((s, ctx) => {
  if(new Set(s.objects.map(o=>o.id)).size!==s.objects.length)ctx.addIssue({code:"custom",message:"Duplicate object IDs"});
  if(new Set(s.equipment.map(o=>o.id)).size!==s.equipment.length||s.equipment.some(o=>s.objects.some(object=>object.id===o.id)))ctx.addIssue({code:"custom",message:"Duplicate installed system IDs"});
  if(s.substrateCatalogId&&!substrateCatalogIds.has(s.substrateCatalogId))ctx.addIssue({code:"custom",path:["substrateCatalogId"],message:"Substrate selection must reference a known substrate product."});
  for(const kind of ["filter","light"] as const)if(s.equipment.filter(item=>item.kind===kind).length>MAX_EQUIPMENT_BY_KIND[kind])ctx.addIssue({code:"custom",path:["equipment"],message:`A scene supports at most ${MAX_EQUIPMENT_BY_KIND[kind]} installed ${kind}s.`});
  if(s.objects.reduce((n,o)=>n+(o.sculpt?.nodes.length??0),0)>8192)ctx.addIssue({code:"custom",message:"Scene sculpt detail limit reached. Reset an unused sculpt before adding more."});
  const litres=s.tank.width*s.tank.depth*s.tank.height*1000,widthCm=s.tank.width*100;
  for(const [index,item] of s.equipment.entries()){
    const product=equipmentCatalog.get(item.catalogId);if(!product||item.kind!==product.kind)continue;
    if(product.kind==="filter"){const [minimum,maximum]=product.profile.compatibleVolumeLitres;if(litres<minimum||litres>maximum)ctx.addIssue({code:"custom",path:["equipment",index,"catalogId"],message:`This filter is rated for ${minimum||"up to"}${minimum?"–":" "}${maximum} L aquariums; this tank holds ${Math.round(litres)} L.`});}
    else{const [minimum,maximum]=product.profile.compatibleTankWidthCm;if(widthCm<minimum||widthCm>maximum)ctx.addIssue({code:"custom",path:["equipment",index,"catalogId"],message:`This light fits ${minimum}–${maximum} cm-wide tanks; this tank is ${Math.round(widthCm)} cm wide.`});}
    const horizontalExtent=Math.abs(item.offset*s.tank.width*.42)+product.profile.nominalDimensionsCm[0]/200;
    if(horizontalExtent>s.tank.width/2+1e-6)ctx.addIssue({code:"custom",path:["equipment",index,"offset"],message:`${item.kind[0].toUpperCase()+item.kind.slice(1)} extends outside its fixed mounting span.`});
    for(let priorIndex=0;priorIndex<index;priorIndex++){
      const prior=s.equipment[priorIndex];if(prior.mount!==item.mount)continue;
      const priorProduct=equipmentCatalog.get(prior.catalogId);if(!priorProduct||prior.kind!==priorProduct.kind)continue;
      const separation=Math.abs(item.offset-prior.offset)*s.tank.width*.42;
      const required=(product.profile.nominalDimensionsCm[0]+priorProduct.profile.nominalDimensionsCm[0])/200+MOUNT_CLEARANCE_METRES;
      if(separation<required)ctx.addIssue({code:"custom",path:["equipment",index,"offset"],message:`Installed ${item.kind}s overlap on the ${item.mount.replace("-"," ")} mounting rail.`});
    }
  }
});
const legacyV5SceneSchema=z.object({
  schema:z.literal(5),builder:z.literal("fishy-browser-3"),id:z.string().min(1).max(100),name:z.string().trim().min(1).max(120).default("Riverbend study"),
  revision:z.number().int().min(0).max(MAX_REVISION),units:z.literal("metres"),coordinates:z.literal("Y-up; X right; Z toward front; origin floor centre"),
  tank:z.object({width:z.number().min(.1).max(3),depth:z.number().min(.1).max(3),height:z.number().min(.1).max(3),source:z.enum(["assumed","user-entered"])}),
  substrate:z.number().min(0).max(.05),objects:z.array(objectSchema).max(MAX_SCENE_OBJECTS),references:z.array(z.string().max(120)).max(50),brief:z.string().max(3000),design:designSchema.optional(),
}).strict();
export type SceneObject = z.infer<typeof objectSchema>;
export type EquipmentInstance=z.infer<typeof equipmentSchema>;
export type SceneRecord = z.infer<typeof sceneSchema>;
export type Vec3 = [number, number, number];
export function initialScene(): SceneRecord {
  const item=(id:string,name:string,kind:SceneObject["kind"],p:Vec3,form:string,color:string,size=1):SceneObject=>({id,name,kind,position:p,rotation:[0,0,0],form,color,size,protected:false});
  return {schema:6,builder:BUILDER,id:"riverbend",name:"Riverbend study",revision:1,units:"metres",coordinates:"Y-up; X right; Z toward front; origin floor centre",tank:{width:.6,depth:.3,height:.36,source:"assumed"},substrate:.03,references:[],brief:"",equipment:[],visual:structuredClone(DEFAULT_VISUAL_PROFILE),objects:[
    {...item("wood-arch","River wood","wood",[-.01,.035,-.01],"arch","#805636"),protected:true},
    item("rock-left","Left stone","rock",[-.16,.03,.055],"faceted","#777969",1),
    item("rock-right","Right stone","rock",[.17,.03,-.015],"faceted","#62675c",.85),
    item("plant-left","Fern grove","plant",[-.2,.03,-.09],"fern","#406e36",1),
    item("plant-back","Stem grove","plant",[.115,.03,-.092],"stem","#5e8440",1),
    item("plant-front","Foreground grass","plant",[.03,.03,.08],"grass","#718b43",.8),
  ]};
}
/** Upgrade known browser scenes before the strict v6 contract is applied. */
export function migrateScene(s:unknown):unknown {
  if(!s||typeof s!=="object")return s;
  const record=s as Record<string,unknown>;
  if(record.schema===5&&record.builder==="fishy-browser-3") {
    // A caller may derive a v5 fixture from a current scene. Visual profiles did
    // not exist in v5, so never preserve one through the legacy parser.
    const {visual,...legacyRecord}=record;
    void visual;
    const legacy=legacyV5SceneSchema.parse(legacyRecord);
    const {schema,builder,...rest}=legacy;
    void schema;void builder;
    return {...rest,schema:6,builder:BUILDER,equipment:[]};
  }
  return s;
}
export function validateScene(s:unknown) { return sceneSchema.parse(migrateScene(s)); }
export function commitScene(current:SceneRecord,next:SceneRecord,base:number,actor:"manual"|"ai"="manual",cancelled=false) {
  if(cancelled)throw new Error("Cancelled operation cannot commit.");
  if(!Number.isSafeInteger(current.revision)||current.revision>=MAX_REVISION)throw new Error("Revision limit reached. Export this scene before starting a new project.");
  if(base!==current.revision)throw new Error("This edit is outdated. Reload the latest scene before trying again.");
  const valid=validateScene(next);
  if(valid.id!==current.id)throw new Error("Cannot apply an edit from a different scene.");
  if(actor==="ai") for(const o of current.objects.filter(o=>o.protected)) {
    if(JSON.stringify(objectSchema.parse(o))!==JSON.stringify(valid.objects.find(x=>x.id===o.id)))throw new Error("AI cannot alter protected objects.");
  }
  return {...valid,revision:current.revision+1};
}
// Original storage is never changed. Migration retains every known stable ID/transform.
export function readSavedScene(storage:Storage):{scene:SceneRecord;note:string;raw:string|null;past?:SceneRecord[];future?:SceneRecord[];manualEdits?:unknown} {
  const raw=storage.getItem(SAVE_KEY),previousV5=raw?null:storage.getItem(PREVIOUS_SAVE_KEY);
  if(raw||previousV5){const saved=raw??previousV5!,parsed=JSON.parse(saved);return {scene:validateScene(parsed.scene??parsed),note:raw?"Loaded saved scene":"Recovered previous save; save to upgrade its installed-system data. Original retained.",raw:raw??null,past:Array.isArray(parsed.past)?parsed.past.slice(-40).map(validateScene):[],future:Array.isArray(parsed.future)?parsed.future.slice(-40).map(validateScene):[],manualEdits:parsed.manualEdits};}
  const previous=storage.getItem("fishy.studio.scene.v4");
  if(previous){const parsed=JSON.parse(previous),migrate=(old:unknown)=>{if(!old||typeof old!=="object"||(old as Record<string,unknown>).schema!==4||(old as Record<string,unknown>).builder!=="fishy-browser-2")throw new Error("Unrecognized previous scene format");return validateScene({...old,schema:6,builder:BUILDER,equipment:[]});};return {scene:migrate(parsed.scene??parsed),note:"Recovered previous save; save to keep sculpt-compatible history. Original retained.",raw:null,past:Array.isArray(parsed.past)?parsed.past.slice(-40).map(migrate):[],future:Array.isArray(parsed.future)?parsed.future.slice(-40).map(migrate):[],manualEdits:parsed.manualEdits};}
  const candidates=["fishy.v3","fishy.v2","fishy.scene","fishy-scene-v1","fishy.controls"].map(key=>({key,raw:storage.getItem(key)})).filter(c=>c.raw).map(c=>({...c,data:JSON.parse(c.raw!)}));
  // Prefer a real object record over an incomplete later controls-only prototype save.
  candidates.sort((a,b)=>Number(Array.isArray((b.data.model??b.data).items??(b.data.model??b.data).objects))-Number(Array.isArray((a.data.model??a.data).items??(a.data.model??a.data).objects)));
  for(const {key,data} of candidates) {
    const s=initialScene(),m=data.model??data,list=m.items??m.objects;
    if(!Array.isArray(list)&&!Array.isArray(data.tank)&&!['wood','woodStyle','plant','plantType','size','scale'].some(k=>Object.hasOwn(data,k)))throw new Error(`Unrecognized saved format in ${key}; original retained for recovery.`);
    if(Array.isArray(list)) s.objects=list.map((raw,i)=>{const o=raw&&typeof raw==="object"?raw as Record<string,unknown>:{};return {id:o.id??`legacy-${i}`,name:o.name??o.id??"Imported object",kind:o.kind,position:o.position??o.p??[0,.03,0],rotation:o.rotation??o.r??[0,0,0],size:o.size??(typeof o.scale==="number"?o.scale:1),...(Array.isArray(o.scale)?{stretch:o.scale}:o.stretch?{stretch:o.stretch}:{}),form:o.form??(o.kind==="wood"?"arch":o.kind==="plant"?"stem":"faceted"),color:o.color??(o.kind==="wood"?"#805636":o.kind==="plant"?"#5e8440":"#777969"),protected:!!(o.protected??o.locked),...(o.catalogId?{catalogId:o.catalogId}:{})} as SceneObject;});
    const t=data.tank??m.tank;
    if(Array.isArray(t)&&t.length===3)s.tank=key==="fishy-scene-v1"?{width:t[0],height:t[1],depth:t[2],source:"assumed"}:{width:t[0]/100,depth:t[1]/100,height:t[2]/100,source:"user-entered"};
    else if(t&&typeof t==="object")s.tank={width:t.width,depth:t.depth,height:t.height,source:t.source??"user-entered"};
    s.revision=m.revision??1;
    if(!Array.isArray(list)){const w=s.objects.find(o=>o.kind==="wood");if(w){w.form=data.woodStyle??data.wood??w.form;w.size=(data.woodSize??data.size??data.scale??100)/100;}const form=String(data.plantType??data.plant??"stem").toLowerCase();s.objects=s.objects.map(o=>o.kind==="plant"?{...o,form}:o);}
    s.id=m.id??data.id??s.id;s.brief=m.brief??data.brief??s.brief;s.references=m.references??data.references??s.references;s.substrate=m.substrate??data.substrate??s.substrate;
    return {scene:validateScene(s),note:`Recovered supported ${Array.isArray(list)?"object edits":"controls"} from ${key}; review before saving. Original records retained.`,raw:null};
  }
  return {scene:initialScene(),note:"New scene · save on this browser when ready",raw:null};
}
