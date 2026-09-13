import { z } from "zod";
import {sculptSchema} from "./sculpt.ts";

export const BUILDER = "fishy-browser-3";
export const SAVE_KEY = "fishy.studio.scene.v5";
const position = z.tuple([z.number().min(-10).max(10),z.number().min(-10).max(10),z.number().min(-10).max(10)]);
const rotation = z.tuple([z.number().min(-Math.PI*100).max(Math.PI*100),z.number().min(-Math.PI*100).max(Math.PI*100),z.number().min(-Math.PI*100).max(Math.PI*100)]);
export const MAX_REVISION = Number.MAX_SAFE_INTEGER - 1;
export const objectSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().min(1).max(160),
  kind: z.enum(["wood", "rock", "plant"]),
  position, rotation, size: z.number().min(0.05).max(4),
  form: z.string().max(60), color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  protected: z.boolean(), catalogId: z.string().max(100).optional(),
  stretch: z.tuple([z.number().min(.01).max(20),z.number().min(.01).max(20),z.number().min(.01).max(20)]).optional(),
  sculpt: sculptSchema.optional(),
}).strict().refine(o=>!o.sculpt||(o.sculpt.basis.kind===o.kind&&o.sculpt.basis.form===o.form),"Reset sculpt before changing the base form").transform(o=>{if(!o.sculpt?.nodes.length)delete o.sculpt;return o;});
export const sceneSchema = z.object({
  schema: z.literal(5), builder: z.literal(BUILDER), id: z.string().min(1).max(100),
  revision: z.number().int().min(0).max(MAX_REVISION), units: z.literal("metres"),
  coordinates: z.literal("Y-up; X right; Z toward front; origin floor centre"),
  tank: z.object({ width: z.number().min(.1).max(3), depth: z.number().min(.1).max(3), height: z.number().min(.1).max(3), source: z.enum(["assumed", "user-entered"]) }),
  substrate: z.number().min(0).max(.05), objects: z.array(objectSchema).max(32),
  references: z.array(z.string().max(120)).max(50), brief: z.string().max(3000),
}).strict().superRefine((s, ctx) => { if(new Set(s.objects.map(o=>o.id)).size!==s.objects.length)ctx.addIssue({code:"custom",message:"Duplicate object IDs"});if(s.objects.reduce((n,o)=>n+(o.sculpt?.nodes.length??0),0)>8192)ctx.addIssue({code:"custom",message:"Scene sculpt detail limit reached. Reset an unused sculpt before adding more."}); });
export type SceneObject = z.infer<typeof objectSchema>;
export type SceneRecord = z.infer<typeof sceneSchema>;
export type Vec3 = [number, number, number];
export function initialScene(): SceneRecord {
  const item=(id:string,name:string,kind:SceneObject["kind"],p:Vec3,form:string,color:string,size=1):SceneObject=>({id,name,kind,position:p,rotation:[0,0,0],form,color,size,protected:false});
  return {schema:5,builder:BUILDER,id:"riverbend",revision:1,units:"metres",coordinates:"Y-up; X right; Z toward front; origin floor centre",tank:{width:.6,depth:.3,height:.36,source:"assumed"},substrate:.03,references:[],brief:"",objects:[
    {...item("wood-arch","River wood","wood",[-.01,.035,-.01],"arch","#805636"),protected:true},
    item("rock-left","Left stone","rock",[-.16,.03,.055],"faceted","#777969",1),
    item("rock-right","Right stone","rock",[.17,.03,-.015],"faceted","#62675c",.85),
    item("plant-left","Fern grove","plant",[-.2,.03,-.09],"fern","#406e36",1),
    item("plant-back","Stem grove","plant",[.115,.03,-.092],"stem","#5e8440",1),
    item("plant-front","Foreground grass","plant",[.03,.03,.08],"grass","#718b43",.8),
  ]};
}
export function validateScene(s:unknown) { return sceneSchema.parse(s); }
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
  const raw=storage.getItem(SAVE_KEY);
  if(raw){const parsed=JSON.parse(raw);return {scene:validateScene(parsed.scene??parsed),note:"Loaded saved scene",raw,past:Array.isArray(parsed.past)?parsed.past.slice(-40).map(validateScene):[],future:Array.isArray(parsed.future)?parsed.future.slice(-40).map(validateScene):[]};}
  const previous=storage.getItem("fishy.studio.scene.v4");
  if(previous){const parsed=JSON.parse(previous),migrate=(old:unknown)=>{if(!old||typeof old!=="object"||(old as Record<string,unknown>).schema!==4||(old as Record<string,unknown>).builder!=="fishy-browser-2")throw new Error("Unrecognized previous scene format");return validateScene({...old,schema:5,builder:BUILDER});};return {scene:migrate(parsed.scene??parsed),note:"Recovered previous save; save to keep sculpt-compatible history. Original retained.",raw:null,past:Array.isArray(parsed.past)?parsed.past.slice(-40).map(migrate):[],future:Array.isArray(parsed.future)?parsed.future.slice(-40).map(migrate):[],manualEdits:parsed.manualEdits};}
  const candidates=["fishy.v3","fishy.v2","fishy.scene","fishy-scene-v1","fishy.controls"].map(key=>({key,raw:storage.getItem(key)})).filter(c=>c.raw).map(c=>({...c,data:JSON.parse(c.raw!)}));
  // Prefer a real object record over an incomplete later controls-only prototype save.
  candidates.sort((a,b)=>Number(Array.isArray((b.data.model??b.data).items??(b.data.model??b.data).objects))-Number(Array.isArray((a.data.model??a.data).items??(a.data.model??a.data).objects)));
  for(const {key,data} of candidates) {
    const s=initialScene(),m=data.model??data,list=m.items??m.objects;
    if(!Array.isArray(list)&&!Array.isArray(data.tank)&&!['wood','woodStyle','plant','plantType','size','scale'].some(k=>Object.hasOwn(data,k)))throw new Error(`Unrecognized saved format in ${key}; original retained for recovery.`);
    if(Array.isArray(list)) s.objects=list.map((o:any,i:number)=>({id:o.id??`legacy-${i}`,name:o.name??o.id??"Imported object",kind:o.kind,position:o.position??o.p??[0,.03,0],rotation:o.rotation??o.r??[0,0,0],size:o.size??(typeof o.scale==="number"?o.scale:1),...(Array.isArray(o.scale)?{stretch:o.scale}:o.stretch?{stretch:o.stretch}:{}),form:o.form??(o.kind==="wood"?"arch":o.kind==="plant"?"stem":"faceted"),color:o.color??(o.kind==="wood"?"#805636":o.kind==="plant"?"#5e8440":"#777969"),protected:!!(o.protected??o.locked),...(o.catalogId?{catalogId:o.catalogId}:{})}));
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
