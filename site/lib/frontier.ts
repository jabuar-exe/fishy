import {z} from "zod";
import {BUILDER,MAX_REVISION,sceneSchema,objectSchema,validateScene,commitScene,type SceneRecord,type SceneObject} from "./scene.ts";
import {outsideObjects} from "./geometry.ts";

export const MAX_REVIEW_BYTES=1024*1024;
const id=z.string().min(1).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/),prose=z.string().max(2000),hash=z.string().regex(/^[a-f0-9]{64}$/),revision=z.number().int().min(0).max(MAX_REVISION);
const ids=z.array(id).max(32).refine(v=>new Set(v).size===v.length,"Duplicate IDs");
const observation=z.object({id,view:z.enum(["front","left","right","top","overview","close_up"]),role:z.literal("reconstruction"),sha256:hash,note:prose,objectIds:ids,region:z.tuple([z.number().finite().min(0).max(1),z.number().finite().min(0).max(1),z.number().finite().min(0).max(1),z.number().finite().min(0).max(1)]).refine(v=>v[0]<v[2]&&v[1]<v[3],"Region must have positive area").optional()}).strict();
const request=z.object({id,objectId:id,question:prose.min(1),requestedView:z.enum(["front","left","right","top","close_up"]),why:prose.min(1),status:z.enum(["requested","answered","resolved_changed","resolved_confirmed","request_unresolved"]),answerObservationId:id.optional()}).strict();
const change=z.object({objectId:id,summary:prose.min(1),inferred:z.boolean().optional(),observationIds:z.array(id).max(20).refine(v=>new Set(v).size===v.length,"Duplicate citations")}).strict().refine(v=>v.inferred===true||v.observationIds.length>0,"At least one reconstruction citation is required unless explicitly inferred");
const blocked=z.object({objectId:id,fields:z.array(z.string().min(1).max(100)).min(1).max(20),reason:prose.min(1)}).strict();
const score=z.object({revision,recipeHash:hash,renderHash:hash.optional(),iou:z.number().finite().min(0).max(1),ssim:z.number().finite().min(-1).max(1).nullable(),centroidErrorPx:z.number().finite().min(0).max(1e9).nullable()}).strict();
const evaluation=z.object({seriesId:id,runtime:z.enum(["browser","blender"]),builder:id,builderHash:hash,cameraHash:hash,photoHash:hash,maskHash:hash,policy:z.enum(["strict_test","validation","fixture"]),status:z.enum(["complete","pending"]),note:prose,scores:z.array(score).max(40)}).strict();

export const reviewSchema=z.object({
  schemaVersion:z.literal("fishy.frontier.review.v1"),provenance:z.enum(["protocol_fixture","recorded_model_run","imported_run"]),
  run:z.object({id,runtime:z.enum(["browser","blender"]),builder:id,sceneId:id,baseRevision:revision,revision,createdAt:z.string().datetime({offset:true})}).strict(),
  observations:z.array(observation).max(20),requests:z.array(request).max(2),changes:z.array(change).max(32),
  protection:z.object({protectedIds:ids,blockedAttempts:z.array(blocked).max(64)}).strict(),evaluation:evaluation.nullable(),browserProposal:sceneSchema.nullable(),
}).strict().superRefine((record,ctx)=>{
  const issue=(message:string)=>ctx.addIssue({code:"custom",message});
  if(new Set(record.observations.map(o=>o.id)).size!==record.observations.length)issue("Duplicate observation IDs");
  if(new Set(record.requests.map(r=>r.id)).size!==record.requests.length)issue("Duplicate request IDs");
  if(new Set(record.changes.map(c=>c.objectId)).size!==record.changes.length)issue("Duplicate changed object IDs");
  const observations=new Map(record.observations.map(o=>[o.id,o]));
  for(const c of record.changes)for(const citation of c.observationIds){const o=observations.get(citation);if(!o)issue("Change cites an unknown observation");else if(o.objectIds.length&&!o.objectIds.includes(c.objectId))issue("Change citation does not name the changed object");}
  for(const r of record.requests){
    const answer=r.answerObservationId?observations.get(r.answerObservationId):null;
    if(r.answerObservationId&&(!answer||answer.view!==r.requestedView||!answer.objectIds.includes(r.objectId)))issue("Request answer must name the requested object and matching reconstruction view");
    if(["answered","resolved_changed","resolved_confirmed"].includes(r.status)&&!answer)issue("Answered request is missing its observation");
    if(r.status==="requested"&&r.answerObservationId)issue("Unanswered request cannot contain an answer");
    if(r.status==="resolved_changed"&&!record.changes.some(c=>c.objectId===r.objectId&&c.observationIds.includes(r.answerObservationId!)))issue("Resolved change must cite its exact answer observation");
    if(r.status==="resolved_confirmed"&&record.changes.some(c=>c.objectId===r.objectId))issue("Confirmed request cannot also claim object movement");
  }
  if(record.run.revision<record.run.baseRevision)issue("Run revision precedes its base");
  if(record.browserProposal){
    if(record.run.runtime!=="browser"||record.run.builder!==BUILDER)issue("Native artifacts are view-only; a browser proposal requires the browser builder");
    if(record.browserProposal.id!==record.run.sceneId)issue("Proposal scene identity does not match run");
    if(record.browserProposal.revision!==record.run.baseRevision)issue("Proposal revision must echo its base revision");
  }
  if(record.evaluation){const e=record.evaluation;
    if(e.runtime!==record.run.runtime||e.builder!==record.run.builder)issue("Evaluation renderer does not match its run");
    if(new Set(e.scores.map(s=>s.revision)).size!==e.scores.length)issue("Duplicate score revisions");
    if(e.scores.some(s=>s.revision>record.run.revision))issue("Score revision is newer than the recorded run");
    if(e.status==="complete"&&!e.scores.length)issue("Complete evaluation requires scores");
    if(e.scores.some((s,i)=>i>0&&s.revision<=e.scores[i-1].revision))issue("Score revisions must be increasing");
    if(record.provenance==="protocol_fixture"&&e.policy!=="fixture")issue("Protocol fixtures must label evaluation as fixture");
  }
});
export type FrontierReview=z.infer<typeof reviewSchema>;
export type BlockedAttempt=z.infer<typeof blocked>;
export type Observation=z.infer<typeof observation>;
export function parseReview(text:string):FrontierReview {
  if(new TextEncoder().encode(text).byteLength>MAX_REVIEW_BYTES)throw new Error("Review JSON must be no larger than 1 MiB.");
  return reviewSchema.parse(JSON.parse(text));
}
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical((value as Record<string,unknown>)[key])])):value;
const equal=(a:unknown,b:unknown)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function diffScene(before:SceneRecord,after:SceneRecord) {
  const changes:{objectId:string;name:string;fields:string[];kind:"added"|"removed"|"changed"}[]=[];
  for(const old of before.objects){const next=after.objects.find(o=>o.id===old.id);if(!next)changes.push({objectId:old.id,name:old.name,fields:["object"],kind:"removed"});else{const fields=Object.keys(old).filter(key=>!equal(old[key as keyof SceneObject],next[key as keyof SceneObject]));for(const key of Object.keys(next))if(!(key in old))fields.push(key);if(fields.length)changes.push({objectId:old.id,name:old.name,fields,kind:"changed"});}}
  for(const o of after.objects)if(!before.objects.some(old=>old.id===o.id))changes.push({objectId:o.id,name:o.name,fields:["object"],kind:"added"});
  return changes;
}
/** Called for review AND Apply; no imported protection list is trusted. */
export function stageBrowserProposal(current:SceneRecord,artifact:FrontierReview) {
  const review=reviewSchema.parse(artifact),proposal=review.browserProposal;
  if(!proposal||review.run.runtime!=="browser"||review.run.builder!==BUILDER)throw new Error("This recorded native run is view-only, not a browser proposal.");
  if(review.run.sceneId!==current.id||proposal.id!==current.id)throw new Error("This proposal belongs to a different scene.");
  if(review.run.baseRevision!==current.revision||proposal.revision!==current.revision)throw new Error("This proposal is stale. Export the current scene and request a new proposal.");
  if(proposal.substrate!==current.substrate||proposal.substrateCatalogId!==current.substrateCatalogId)throw new Error("Substrate changes are not supported by browser proposals in this release. Nothing was applied.");
  if(!equal(proposal.equipment,current.equipment))throw new Error("Installed filter and light changes are not supported by browser proposals in this release. Nothing was applied.");
  const attempts:BlockedAttempt[]=[],protectedObjects=current.objects.filter(o=>o.protected);
  for(const old of protectedObjects){const candidate=proposal.objects.find(o=>o.id===old.id);if(!candidate||!equal(old,candidate))attempts.push({objectId:old.id,fields:candidate?Object.keys({...old,...candidate}).filter(k=>!equal(old[k as keyof SceneObject],candidate[k as keyof SceneObject])):["deletion"],reason:"Current human-protected object retained by the browser."});}
  const protectedIds=new Set(protectedObjects.map(o=>o.id));
  const objects=proposal.objects.map(o=>protectedIds.has(o.id)?structuredClone(current.objects.find(old=>old.id===o.id)!):structuredClone(o));
  for(const old of protectedObjects)if(!objects.some(o=>o.id===old.id))objects.push(structuredClone(old));
  const effective=validateScene({...proposal,objects,revision:current.revision});
  const outside=outsideObjects(effective);if(outside.length)throw new Error(`Proposal does not fit the tank: ${outside.join(", ")}. Nothing was applied.`);
  // Assert the existing strict AI gate as a second boundary, without accepting its new revision yet.
  commitScene(current,effective,current.revision,"ai");
  return {effective,attempts,changes:diffScene(current,effective),tankChanged:!equal(current.tank,effective.tank),briefChanged:current.brief!==effective.brief,referencesChanged:!equal(current.references,effective.references)};
}

export type ManualEdit={objectId:string;revision:number;timestamp:string;source:"human";fields:string[];before:SceneObject;after:SceneObject};
export function readManualEdits(input:unknown):ManualEdit[] {
  if(input===undefined)return [];
  return z.array(z.object({objectId:z.string().min(1).max(100),revision,timestamp:z.string().datetime({offset:true}),source:z.literal("human"),fields:z.array(z.string().min(1).max(100)).max(20),before:objectSchema,after:objectSchema}).strict().refine(e=>e.before.id===e.objectId&&e.after.id===e.objectId,"Edit identity mismatch")).max(100).parse(input);
}
/** Only accepted manual geometry/material changes auto-protect; release remains explicit. */
export function protectManualChanges(before:SceneRecord,next:SceneRecord):SceneRecord {
  const geometryKeys=["position","rotation","size","stretch","form","catalogId","color","sculpt"] as const;
  return {...next,objects:next.objects.map(o=>{const old=before.objects.find(x=>x.id===o.id);return old&&geometryKeys.some(k=>!equal(old[k],o[k]))?{...o,protected:true}:o;})};
}
export function manualEditRecords(before:SceneRecord,after:SceneRecord,timestamp:string):ManualEdit[] {
  return diffScene(before,after).filter(c=>c.kind==="changed"&&c.fields.some(k=>["position","rotation","size","stretch","form","catalogId","color","sculpt"].includes(k))).map(c=>({objectId:c.objectId,revision:after.revision,timestamp,source:"human",fields:c.fields,before:structuredClone(before.objects.find(o=>o.id===c.objectId)!),after:structuredClone(after.objects.find(o=>o.id===c.objectId)!)}));
}
