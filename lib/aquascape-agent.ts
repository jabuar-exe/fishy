import {z} from "zod";
import {catalogDescriptor,catalogEntries,isOrganicCatalogEntry,type CatalogEntry} from "./catalog.ts";
import {fitObject,outsideObjects,separatePlacements} from "./geometry.ts";
import {sceneSchema,validateScene,type SceneRecord} from "./scene.ts";
import {COMPOSITIONS,MAINTENANCE,MOODS} from "./design.ts";

export const MAX_AGENT_IMAGES=4;
export const MAX_IMAGE_DATA_URL_BYTES=2_600_000;

// The composition agent only arranges organic materials. Floor profiles and
// mounted equipment remain explicitly user-installed tank systems.
const supportedCatalog=catalogEntries.filter(entry=>entry.status==="supported_procedural"&&isOrganicCatalogEntry(entry));
const supportedIds=new Set(supportedCatalog.map(entry=>entry.id));
const imageSchema=z.object({
  id:z.string().uuid(),
  name:z.string().trim().min(1).max(180),
  dataUrl:z.string().min(32).max(MAX_IMAGE_DATA_URL_BYTES).refine(value=>/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value),"Unsupported image data"),
}).strict();
const inspirationSchema=z.object({
  id:z.string().trim().min(1).max(120),
  title:z.string().trim().min(1).max(180),
  creator:z.string().trim().max(160).optional(),
  designLesson:z.string().trim().max(700).optional(),
  plantNames:z.array(z.string().trim().min(1).max(100)).max(16).default([]),
  imageUrl:z.string().url().max(1_500).optional(),
}).strict();
const historyItemSchema=z.object({role:z.enum(["user","assistant"]),content:z.string().trim().min(1).max(1200)}).strict();

export const aquascapeRequestSchema=z.object({
  requestId:z.string().uuid().optional(),
  message:z.string().trim().min(2).max(3000),
  scene:sceneSchema,
  history:z.array(historyItemSchema).max(12).default([]),
  images:z.array(imageSchema).max(MAX_AGENT_IMAGES).default([]),
  inspirations:z.array(inspirationSchema).max(5).default([]),
}).strict().superRefine((value,ctx)=>{
  const imageBytes=value.images.reduce((total,image)=>total+image.dataUrl.length,0);
  if(imageBytes>8_500_000)ctx.addIssue({code:"custom",message:"Reference photos are too large"});
});

const plannedComponentSchema=z.object({
  catalogId:z.string().refine(id=>supportedIds.has(id),"Unknown catalog component"),
  name:z.string().trim().min(1).max(100),
  x:z.number().min(-1).max(1),
  y:z.number().min(0).max(1).default(0),
  z:z.number().min(-1).max(1),
  scale:z.number().min(.2).max(2),
  pitchDegrees:z.number().min(-180).max(180).default(0),
  rotationDegrees:z.number().min(-180).max(180),
  rollDegrees:z.number().min(-180).max(180).default(0),
  stretchX:z.number().min(.25).max(4).default(1),
  stretchY:z.number().min(.25).max(4).default(1),
  stretchZ:z.number().min(.25).max(4).default(1),
  support:z.enum(["floor","elevated","attached"]).default("floor"),
  variantSeed:z.number().int().min(0).max(65535).default(0),
  confidence:z.number().min(0).max(1).default(.7),
  evidence:z.string().trim().min(1).max(240).default("Inferred from the user's request."),
}).strict();

/** Design intent per DESIGN_PRINCIPLES.md. Required by Blender recipe schema v2.
 *  The model names its focal object by index because generated ids do not exist yet. */
const plannedDesignSchema=z.object({
  composition:z.enum(COMPOSITIONS),
  focalIndex:z.number().int().min(0).max(23),
  sightline:z.string().trim().min(1).max(300),
  openForegroundMin:z.number().min(0).max(.95),
  mood:z.enum(MOODS),
  maintenanceTier:z.enum(MAINTENANCE),
  story:z.string().trim().min(1).max(300),
}).strict();

const influenceSchema=z.object({
  kind:z.enum(["inspiration","photo"]),
  id:z.string().trim().min(1).max(180),
  componentIndexes:z.array(z.number().int().min(0).max(23)).min(1).max(24),
  reason:z.string().trim().min(1).max(240),
}).strict();

export const aquascapePlanSchema=z.object({
  generationMode:z.enum(["compose","reconstruct"]).default("compose"),
  title:z.string().trim().min(1).max(120),
  summary:z.string().trim().min(1).max(700),
  design:plannedDesignSchema,
  components:z.array(plannedComponentSchema).min(1).max(24),
  influencesUsed:z.array(influenceSchema).max(MAX_AGENT_IMAGES+5),
}).strict();

export type AquascapeRequest=z.infer<typeof aquascapeRequestSchema>;
export type AquascapePlan=z.infer<typeof aquascapePlanSchema>;
export type InfluenceReceipt=z.infer<typeof influenceSchema>;

export class AquascapeAgentError extends Error {
  readonly code:"unavailable"|"upstream"|"invalid_plan";
  readonly retryable:boolean;
  constructor(code:"unavailable"|"upstream"|"invalid_plan",message:string,retryable=false){super(message);this.code=code;this.retryable=retryable;this.name="AquascapeAgentError";}
}

const outputSchema={
  type:"object",
  additionalProperties:false,
  properties:{
    generationMode:{type:"string",enum:["compose","reconstruct"],description:"Use reconstruct when a photo is intended as the primary aquarium to reproduce; otherwise compose."},
    title:{type:"string",minLength:1,maxLength:120},
    summary:{type:"string",minLength:1,maxLength:700},
    design:{
      type:"object",additionalProperties:false,
      properties:{
        composition:{type:"string",enum:[...COMPOSITIONS]},
        focalIndex:{type:"integer",minimum:0,maximum:23,description:"Index into components of the object the eye should land on first."},
        sightline:{type:"string",minLength:1,maxLength:300},
        openForegroundMin:{type:"number",minimum:0,maximum:.95,description:"Fraction of the front 30% of the floor intended to stay clear."},
        mood:{type:"string",enum:[...MOODS]},
        maintenanceTier:{type:"string",enum:[...MAINTENANCE]},
        story:{type:"string",minLength:1,maxLength:300,description:"One sentence: what this tank is."},
      },
      required:["composition","focalIndex","sightline","openForegroundMin","mood","maintenanceTier","story"],
    },
    components:{
      type:"array",minItems:1,maxItems:24,
      items:{
        type:"object",additionalProperties:false,
        properties:{
          catalogId:{type:"string",enum:supportedCatalog.map(entry=>entry.id)},
          name:{type:"string",minLength:1,maxLength:100},
          x:{type:"number",minimum:-1,maximum:1},
          y:{type:"number",minimum:0,maximum:1,description:"Vertical placement from substrate (0) to the waterline (1)."},
          z:{type:"number",minimum:-1,maximum:1},
          scale:{type:"number",minimum:.2,maximum:2},
          pitchDegrees:{type:"number",minimum:-180,maximum:180},
          rotationDegrees:{type:"number",minimum:-180,maximum:180},
          rollDegrees:{type:"number",minimum:-180,maximum:180},
          stretchX:{type:"number",minimum:.25,maximum:4},
          stretchY:{type:"number",minimum:.25,maximum:4},
          stretchZ:{type:"number",minimum:.25,maximum:4},
          support:{type:"string",enum:["floor","elevated","attached"]},
          variantSeed:{type:"integer",minimum:0,maximum:65535},
          confidence:{type:"number",minimum:0,maximum:1},
          evidence:{type:"string",minLength:1,maxLength:240},
        },
        required:["catalogId","name","x","y","z","scale","pitchDegrees","rotationDegrees","rollDegrees","stretchX","stretchY","stretchZ","support","variantSeed","confidence","evidence"],
      },
    },
    influencesUsed:{
      type:"array",maxItems:MAX_AGENT_IMAGES+5,
      items:{
        type:"object",additionalProperties:false,
        properties:{
          kind:{type:"string",enum:["inspiration","photo"]},
          id:{type:"string",minLength:1,maxLength:180,description:"Use the exact saved inspiration id or reference-photo filename supplied in the request."},
          componentIndexes:{type:"array",minItems:1,maxItems:24,items:{type:"integer",minimum:0,maximum:23},description:"Indexes of generated components directly shaped by this source."},
          reason:{type:"string",minLength:1,maxLength:240},
        },
        required:["kind","id","componentIndexes","reason"],
      },
    },
  },
  required:["generationMode","title","summary","design","components","influencesUsed"],
} as const;

function componentGuide(entry:CatalogEntry){return {id:entry.id,label:entry.displayLabel,kind:entry.kind,color:entry.color,shape:entry.rendererForm,role:entry.placementRole,nominalSizeCm:entry.organic?.nominalSizeCm,morphology:entry.organic?.morphology,renderingLimit:entry.renderingLimit};}

function compactScene(scene:SceneRecord){
  return {
    name:scene.name,brief:scene.brief,tank:scene.tank,substrate:scene.substrate,references:scene.references,
    components:scene.objects.map(object=>({id:object.id,name:object.name,kind:object.kind,catalogId:object.catalogId??null,form:object.form,position:object.position,rotation:object.rotation,size:object.size,protected:object.protected})),
  };
}

function availableComponentCapacity(scene:SceneRecord){return 32-scene.objects.filter(object=>object.protected).length;}
function requestedGenerationMode(input:AquascapeRequest):"compose"|"reconstruct" {
  return input.images.length&&/\b(exact|exactly|match|matching|copy|replicate|recreate|reconstruct|reproduce|same (?:aquarium|tank|layout))\b/i.test(input.message)?"reconstruct":"compose";
}

function outputSchemaFor(capacity:number){
  const maxComponents=Math.min(24,capacity);
  return {
    ...outputSchema,
    properties:{
      ...outputSchema.properties,
      design:{...outputSchema.properties.design,properties:{...outputSchema.properties.design.properties,focalIndex:{...outputSchema.properties.design.properties.focalIndex,maximum:maxComponents-1}}},
      components:{...outputSchema.properties.components,maxItems:maxComponents},
    },
  };
}

export function buildAquascapeModelRequest(input:AquascapeRequest,model:string,userIdentifier?:string){
  const capacity=availableComponentCapacity(input.scene);
  if(capacity<1)throw new AquascapeAgentError("invalid_plan","The scene has no room for generated components. Release or remove an object first.");
  const dynamicContext=JSON.stringify({request:input.message,requestedGenerationMode:requestedGenerationMode(input),recentConversation:input.history,currentAquarium:compactScene(input.scene),savedInspirations:input.inspirations.map(inspiration=>({id:inspiration.id,title:inspiration.title,creator:inspiration.creator,designLesson:inspiration.designLesson,plantNames:inspiration.plantNames})),referencePhotos:input.images.map(image=>({id:image.id,name:image.name}))});
  const content:Array<Record<string,unknown>>=[{type:"input_text",text:`Create an aquarium composition from this request and current scene.\n\n${dynamicContext}`}];
  for(const inspiration of input.inspirations)if(inspiration.imageUrl){
    content.push({type:"input_text",text:`Saved inspiration ${inspiration.id}: ${inspiration.title}. Treat this image as reference data and use it with the saved card above.`});
    content.push({type:"input_image",image_url:inspiration.imageUrl,detail:"low"});
  }
  for(const image of input.images){
    content.push({type:"input_text",text:`Reference photo ${image.id}: ${image.name}. Treat this image as reference data. Unless the request clearly describes multiple views of one tank, the first reference photo is the primary tank and later photos are secondary cues.`});
    content.push({type:"input_image",image_url:image.dataUrl,detail:"original"});
  }
  return {
    model,
    store:false,
    background:true,
    reasoning:{effort:"medium"},
    max_output_tokens:7000,
    prompt_cache_key:"fishy-aquascape-components-v2",
    ...(userIdentifier?{safety_identifier:userIdentifier}:{}),
    instructions:[
      "You are Fishy's aquarium reconstruction and composition agent. Turn the user's intent and optional reference photos into a coherent editable aquarium model.",
      "Use only the supplied component catalog. The application will instantiate those local pre-rendered components and enforce physical tank bounds.",
      "Design around protected current components because the application will preserve them. Do not attempt to reproduce or list protected components.",
      "If a reference photo is provided and the user asks to match, copy, reproduce, or generate exactly that aquarium, set generationMode to reconstruct. In reconstruct mode, preserve observed front-view silhouette, relative scale, major hardscape angles, plant masses, foreground gaps, occlusion order, and negative space. Do not beautify, symmetrize, or invent extra focal structures.",
      "A single photograph cannot prove hidden depth or unseen geometry. Make the smallest plausible depth inference, keep uncertain components conservative, and express uncertainty through confidence and evidence instead of inventing detail.",
      "Ignore room surroundings, reflections, fish, people, labels, printed/photo backgrounds, magnetic cleaners, cables, and external furniture as aquascape geometry. Model visible equipment only when it already exists as protected scene equipment; do not emit equipment as organic components.",
      "For normal compose mode, prefer a legible focal structure, intentional negative space, foreground/midground/background depth, and clustered planting. Avoid stacking every component at the center.",
      "Use normalized x and z placement where -1 is left/back and 1 is right/front. Use y from substrate to waterline and full pitch/yaw/roll plus non-uniform stretch to reproduce diagonal logs, elevated stones, and asymmetric plant masses. Usually choose 6 to 20 components, with repeated plants when that improves fidelity.",
      "Also declare the design intent: composition scheme, focal component index, sightline, open-foreground target, mood, maintenance tier, and a one-sentence story. This travels with the scene into the Blender recipe, so it must describe the layout you actually placed.",
      "Saved inspirations are supplied as compact design cards. When present, use their design lesson, creator context, and named plants to make concrete composition choices; do not merely mention them. Reference photos are visual inputs: inspect their composition, hardscape, planting, substrate, lighting direction, equipment silhouettes, and waterline cues.",
      "Return one influencesUsed entry for every supplied saved inspiration and reference photo. Its id must exactly match the supplied inspiration id or photo id, componentIndexes must name the generated components it directly shaped, and its reason must name the concrete layout choice it informed. Return an empty array only when neither type of context was supplied.",
      `Available components: ${JSON.stringify(supportedCatalog.map(componentGuide))}`,
    ].join("\n"),
    input:[{role:"user",content}],
    text:{format:{type:"json_schema",name:"fishy_aquascape_plan",strict:true,schema:outputSchemaFor(capacity)}},
  };
}

export function parseAquascapeModelResponse(payload:unknown):AquascapePlan {
  if(!payload||typeof payload!=="object")throw new AquascapeAgentError("invalid_plan","The model returned no aquarium plan.",true);
  const response=payload as {status?:unknown;error?:unknown;incomplete_details?:unknown;output_text?:unknown;output?:unknown};
  if(response.status&&response.status!=="completed"){
    const incomplete=response.status==="incomplete"||response.status==="queued"||response.status==="in_progress";
    throw new AquascapeAgentError("upstream",incomplete?"The aquarium agent response was incomplete.":"The aquarium agent response failed.",incomplete);
  }
  if(response.error)throw new AquascapeAgentError("upstream","The aquarium agent response failed.",true);
  let text=typeof response.output_text==="string"?response.output_text:"";
  if(!text&&Array.isArray(response.output))for(const item of response.output){
    if(!item||typeof item!=="object"||!Array.isArray((item as {content?:unknown}).content))continue;
    for(const part of (item as {content:Array<unknown>}).content)if(part&&typeof part==="object"&&(part as {type?:unknown}).type==="output_text"&&typeof (part as {text?:unknown}).text==="string")text+=(part as {text:string}).text;
  }
  if(!text)throw new AquascapeAgentError("invalid_plan","The model returned no aquarium plan.",true);
  try{return aquascapePlanSchema.parse(JSON.parse(text));}
  catch{throw new AquascapeAgentError("invalid_plan","The model returned an aquarium plan that could not be used safely.",true);}
}

export function materializeAquascapePlan(current:SceneRecord,plan:AquascapePlan,message:string,idFactory:()=>string=()=>crypto.randomUUID()){
  const scene=validateScene(current),validPlan=aquascapePlanSchema.parse(plan),protectedObjects=scene.objects.filter(object=>object.protected).map(object=>structuredClone(object));
  const capacity=32-protectedObjects.length;
  if(capacity<1)throw new AquascapeAgentError("invalid_plan","The scene has no room for generated components. Release or remove an object first.");
  if(validPlan.components.length>capacity)throw new AquascapeAgentError("invalid_plan","The model proposed more components than this tank can safely accept.",true);
  if(validPlan.design.focalIndex>=validPlan.components.length)throw new AquascapeAgentError("invalid_plan","The model selected a focal component that was not generated.",true);
  const entries=new Map(supportedCatalog.map(entry=>[entry.id,entry]));
  const generated=validPlan.components.map((component,index)=>{
    const entry=entries.get(component.catalogId);
    if(!entry)throw new AquascapeAgentError("invalid_plan","The model selected an unavailable component.");
    const token=idFactory().replace(/[^a-zA-Z0-9-]/g,"").slice(0,36)||"component";
    const object=catalogDescriptor(entry,`ai-${index+1}-${token}`);
    object.name=component.name;
    const waterHeight=Math.max(scene.substrate,scene.tank.height-.018),vertical=component.support==="floor"?scene.substrate:scene.substrate+component.y*(waterHeight-scene.substrate);
    object.position=[component.x*scene.tank.width*.42,vertical,component.z*scene.tank.depth*.4];
    object.rotation=[component.pitchDegrees*Math.PI/180,component.rotationDegrees*Math.PI/180,component.rollDegrees*Math.PI/180];
    object.size*=component.scale;
    object.stretch=[component.stretchX,component.stretchY,component.stretchZ];
    object.variantSeed=component.variantSeed;
    return fitObject(object,scene,true);
  });
  // Reconstruction preserves observed overlaps and support relationships; composition mode keeps the generic collision pass.
  const placed=validPlan.generationMode==="reconstruct"?generated:separatePlacements(generated,protectedObjects,scene);
  // The model names its focal object by component index; resolve it to the id we just minted.
  const focal=placed[validPlan.design.focalIndex];
  if(!focal)throw new AquascapeAgentError("invalid_plan","The generated focal component could not be placed.",true);
  const design={
    composition:validPlan.design.composition,focalObjectId:focal.id,sightline:validPlan.design.sightline,
    openForegroundMin:validPlan.design.openForegroundMin,mood:validPlan.design.mood,
    maintenanceTier:validPlan.design.maintenanceTier,story:validPlan.design.story,
  };
  const next=validateScene({...scene,name:validPlan.title,brief:message,design,objects:[...protectedObjects,...placed]});
  if(outsideObjects(next).length)throw new AquascapeAgentError("invalid_plan","Generated components did not fit safely inside the tank.");
  return {scene:next,componentCount:placed.length,preservedProtected:protectedObjects.length,summary:validPlan.summary,influencesUsed:validPlan.influencesUsed};
}

// Astra vision is started in durable background mode, so individual HTTP calls
// stay short while the model gets a realistic window to finish a dense photo.
const MAX_MODEL_ATTEMPTS=2;
const MODEL_TIMEOUT_MS=20_000;
const TOTAL_MODEL_BUDGET_MS=240_000;
const BACKGROUND_POLL_MS=2_000;

function isTransientStatus(status:number){return status===408||status===409||status===429||status>=500;}
function pause(milliseconds:number){return new Promise<void>(resolve=>setTimeout(resolve,milliseconds));}
function retryAfterMilliseconds(value:string|null){
  if(!value)return null;
  const seconds=Number(value);
  if(Number.isFinite(seconds)&&seconds>=0)return Math.min(10_000,Math.round(seconds*1_000));
  const when=Date.parse(value);return Number.isFinite(when)?Math.min(10_000,Math.max(0,when-Date.now())):null;
}
function retryDelay(attempt:number,retryAfter:number|null){return retryAfter??Math.min(3_000,350*2**attempt+Math.floor(Math.random()*220));}

async function waitForRetry(milliseconds:number,sleep:(milliseconds:number)=>Promise<void>,signal?:AbortSignal){
  if(!signal){await sleep(milliseconds);return;}
  if(signal.aborted)throw new AquascapeAgentError("unavailable","Aquarium generation was cancelled.");
  let abortListener:(()=>void)|undefined;
  const completed=await Promise.race([
    sleep(milliseconds).then(()=>true),
    new Promise<boolean>(resolve=>{abortListener=()=>resolve(false);signal.addEventListener("abort",abortListener,{once:true});}),
  ]);
  if(abortListener)signal.removeEventListener("abort",abortListener);
  if(!completed||signal.aborted)throw new AquascapeAgentError("unavailable","Aquarium generation was cancelled.");
}

function expectedInfluenceKeys(input:AquascapeRequest){return new Set([
  ...input.inspirations.map(item=>`inspiration:${item.id}`),
  ...input.images.map(item=>`photo:${item.id}`),
]);}

function verifyInfluenceReceipt(plan:AquascapePlan,input:AquascapeRequest){
  const expected=expectedInfluenceKeys(input),actual=new Set(plan.influencesUsed.map(item=>`${item.kind}:${item.id}`));
  if(expected.size!==actual.size||[...expected].some(key=>!actual.has(key)))throw new AquascapeAgentError("invalid_plan","The model did not return a complete reference receipt.",true);
  if(plan.influencesUsed.some(item=>item.componentIndexes.some(index=>index>=plan.components.length)))throw new AquascapeAgentError("invalid_plan","The model linked a reference to a component that was not generated.",true);
}

async function providerRequest(url:string,init:RequestInit,options:{fetcher:typeof fetch;signal?:AbortSignal;deadline:number}){
  const remaining=options.deadline-Date.now();
  if(remaining<=0)throw new AquascapeAgentError("upstream","The aquarium agent ran out of time.",true);
  if(options.signal?.aborted)throw new AquascapeAgentError("unavailable","Aquarium generation was cancelled.");
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),Math.min(MODEL_TIMEOUT_MS,remaining)),abortFromCaller=()=>controller.abort();
  options.signal?.addEventListener("abort",abortFromCaller,{once:true});
  try{
    const response=await options.fetcher(url,{...init,signal:controller.signal});
    if(!response.ok){
      const busy=response.status===429?"The aquarium agent is busy.":"The aquarium agent could not complete this design.";
      const error=new AquascapeAgentError("upstream",busy,isTransientStatus(response.status));
      Object.assign(error,{retryAfter:retryAfterMilliseconds(response.headers.get("retry-after"))});
      throw error;
    }
    return response;
  } catch(error) {
    if(error instanceof AquascapeAgentError)throw error;
    if(error instanceof DOMException&&error.name==="AbortError"){
      if(options.signal?.aborted)throw new AquascapeAgentError("unavailable","Aquarium generation was cancelled.");
      throw new AquascapeAgentError("upstream","The aquarium service connection timed out.",true);
    }
    throw new AquascapeAgentError("upstream","The aquarium agent could not be reached.",true);
  } finally {clearTimeout(timeout);options.signal?.removeEventListener("abort",abortFromCaller);}
}

async function cancelBackgroundResponse(responseId:string,options:{apiKey:string;fetcher:typeof fetch}){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5_000);
  try{await options.fetcher(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}/cancel`,{method:"POST",signal:controller.signal,headers:{authorization:`Bearer ${options.apiKey}`,"content-type":"application/json"}});}catch{}finally{clearTimeout(timeout);}
}

async function requestPlan(input:AquascapeRequest,options:{apiKey:string;model:string;fetcher:typeof fetch;userIdentifier?:string;signal?:AbortSignal;deadline:number;sleep:(milliseconds:number)=>Promise<void>}){
  const headers={authorization:`Bearer ${options.apiKey}`,"content-type":"application/json","x-client-request-id":input.requestId??crypto.randomUUID()};
  let responseId:string|undefined,terminal=false;
  try{
    const created=await providerRequest("https://api.openai.com/v1/responses",{method:"POST",headers,body:JSON.stringify(buildAquascapeModelRequest(input,options.model,options.userIdentifier))},options);
    let payload=await created.json() as Record<string,unknown>;
    responseId=typeof payload.id==="string"?payload.id:undefined;
    while(payload.status==="queued"||payload.status==="in_progress"){
      const remaining=options.deadline-Date.now();
      if(remaining<=0)throw new AquascapeAgentError("upstream","The aquarium agent ran out of time.",true);
      await waitForRetry(Math.min(BACKGROUND_POLL_MS,remaining),options.sleep,options.signal);
      try{
        const polled=await providerRequest(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId??"")}`,{method:"GET",headers},options);
        payload=await polled.json() as Record<string,unknown>;
      }catch(error){
        if(error instanceof AquascapeAgentError&&error.retryable){
          const retryAfter=(error as AquascapeAgentError&{retryAfter?:number|null}).retryAfter??null,remainingAfterError=options.deadline-Date.now();
          if(remainingAfterError<=0)throw error;
          await waitForRetry(Math.min(retryDelay(0,retryAfter),remainingAfterError),options.sleep,options.signal);
          continue;
        }
        throw error;
      }
    }
    terminal=true;
    const parsedPlan=parseAquascapeModelResponse(payload),plan=requestedGenerationMode(input)==="reconstruct"&&parsedPlan.generationMode!=="reconstruct"?{...parsedPlan,generationMode:"reconstruct" as const}:parsedPlan;
    verifyInfluenceReceipt(plan,input);
    return plan;
  } finally {
    if(responseId&&!terminal)await cancelBackgroundResponse(responseId,options);
  }
}

export async function generateAquascape(input:unknown,options:{apiKey:string;model?:string;fetcher?:typeof fetch;userIdentifier?:string;signal?:AbortSignal;sleep?:(milliseconds:number)=>Promise<void>}){
  const parsed=aquascapeRequestSchema.parse(input),fetcher=options.fetcher??fetch,model=options.model?.trim()||"gpt-6-astra",sleep=options.sleep??pause;
  const deadline=Date.now()+TOTAL_MODEL_BUDGET_MS;
  let failure:AquascapeAgentError|undefined,attempts=0;
  for(attempts=1;attempts<=MAX_MODEL_ATTEMPTS;attempts++){
    if(options.signal?.aborted)throw new AquascapeAgentError("unavailable","Aquarium generation was cancelled.");
    if(Date.now()>=deadline){failure=new AquascapeAgentError("upstream","The aquarium agent ran out of time.",true);break;}
    try{
      const plan=await requestPlan(parsed,{apiKey:options.apiKey,model,fetcher,userIdentifier:options.userIdentifier,signal:options.signal,deadline,sleep});
      if(options.signal?.aborted)throw new AquascapeAgentError("unavailable","Aquarium generation was cancelled.");
      return {...materializeAquascapePlan(parsed.scene,plan,parsed.message),model,attempts,fallback:false};
    }catch(error){
      failure=error instanceof AquascapeAgentError?error:new AquascapeAgentError("upstream","The aquarium agent could not be reached.",true);
      if(options.signal?.aborted)throw new AquascapeAgentError("unavailable","Aquarium generation was cancelled.");
      if(!failure.retryable||attempts===MAX_MODEL_ATTEMPTS)break;
      const retryAfter=(failure as AquascapeAgentError&{retryAfter?:number|null}).retryAfter??null;
      const remaining=Math.max(0,deadline-Date.now());
      if(!remaining)break;
      const delay=Math.min(retryDelay(attempts-1,retryAfter),remaining);
      await waitForRetry(delay,sleep,options.signal);
    }
  }
  throw new AquascapeAgentError(failure?.code??"unavailable",`${failure?.message??"The aquarium agent could not complete this design."} Your current aquarium was kept unchanged.`,failure?.retryable??false);
}
