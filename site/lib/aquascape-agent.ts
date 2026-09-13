import {z} from "zod";
import {catalogDescriptor,catalogEntries,type CatalogEntry} from "./catalog.ts";
import {fitObject,outsideObjects} from "./geometry.ts";
import {sceneSchema,validateScene,type SceneRecord} from "./scene.ts";
import {COMPOSITIONS,MAINTENANCE,MOODS} from "./design.ts";

export const MAX_AGENT_IMAGES=4;
export const MAX_IMAGE_DATA_URL_BYTES=2_600_000;

const supportedCatalog=catalogEntries.filter(entry=>entry.status==="supported_procedural");
const supportedIds=new Set(supportedCatalog.map(entry=>entry.id));
const imageSchema=z.object({
  name:z.string().trim().min(1).max(180),
  dataUrl:z.string().min(32).max(MAX_IMAGE_DATA_URL_BYTES).refine(value=>/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value),"Unsupported image data"),
}).strict();
const historyItemSchema=z.object({role:z.enum(["user","assistant"]),content:z.string().trim().min(1).max(1200)}).strict();

export const aquascapeRequestSchema=z.object({
  message:z.string().trim().min(2).max(3000),
  scene:sceneSchema,
  history:z.array(historyItemSchema).max(12).default([]),
  images:z.array(imageSchema).max(MAX_AGENT_IMAGES).default([]),
}).strict().superRefine((value,ctx)=>{
  const imageBytes=value.images.reduce((total,image)=>total+image.dataUrl.length,0);
  if(imageBytes>8_500_000)ctx.addIssue({code:"custom",message:"Reference photos are too large"});
});

const plannedComponentSchema=z.object({
  catalogId:z.string().refine(id=>supportedIds.has(id),"Unknown catalog component"),
  name:z.string().trim().min(1).max(100),
  x:z.number().min(-1).max(1),
  z:z.number().min(-1).max(1),
  scale:z.number().min(.2).max(2),
  rotationDegrees:z.number().min(-180).max(180),
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

export const aquascapePlanSchema=z.object({
  title:z.string().trim().min(1).max(120),
  summary:z.string().trim().min(1).max(700),
  design:plannedDesignSchema,
  components:z.array(plannedComponentSchema).min(1).max(24),
}).strict();

export type AquascapeRequest=z.infer<typeof aquascapeRequestSchema>;
export type AquascapePlan=z.infer<typeof aquascapePlanSchema>;

export class AquascapeAgentError extends Error {
  readonly code:"unavailable"|"upstream"|"invalid_plan";
  constructor(code:"unavailable"|"upstream"|"invalid_plan",message:string){super(message);this.code=code;this.name="AquascapeAgentError";}
}

const outputSchema={
  type:"object",
  additionalProperties:false,
  properties:{
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
          z:{type:"number",minimum:-1,maximum:1},
          scale:{type:"number",minimum:.2,maximum:2},
          rotationDegrees:{type:"number",minimum:-180,maximum:180},
        },
        required:["catalogId","name","x","z","scale","rotationDegrees"],
      },
    },
  },
  required:["title","summary","design","components"],
} as const;

function componentGuide(entry:CatalogEntry){return {id:entry.id,label:entry.displayLabel,kind:entry.kind,shape:entry.rendererForm,role:entry.placementRole};}

function compactScene(scene:SceneRecord){
  return {
    name:scene.name,tank:scene.tank,substrate:scene.substrate,references:scene.references,
    components:scene.objects.map(object=>({id:object.id,name:object.name,kind:object.kind,catalogId:object.catalogId??null,form:object.form,position:object.position,rotation:object.rotation,size:object.size,protected:object.protected})),
  };
}

export function buildAquascapeModelRequest(input:AquascapeRequest,model:string,userIdentifier?:string){
  const dynamicContext=JSON.stringify({request:input.message,recentConversation:input.history,currentAquarium:compactScene(input.scene)});
  const content:Array<Record<string,unknown>>=[{type:"input_text",text:`Create an aquarium composition from this request and current scene.\n\n${dynamicContext}`}];
  for(const image of input.images)content.push({type:"input_image",image_url:image.dataUrl,detail:"low"});
  return {
    model,
    store:false,
    reasoning:{effort:"low"},
    max_output_tokens:4000,
    prompt_cache_key:"fishy-aquascape-components-v1",
    ...(userIdentifier?{safety_identifier:userIdentifier}:{}),
    instructions:[
      "You are Fishy's aquascape composition agent. Turn the user's intent and optional reference photos into a coherent editable aquarium model.",
      "Use only the supplied component catalog. The application will instantiate those local pre-rendered components and enforce physical tank bounds.",
      "Design around protected current components because the application will preserve them. Do not attempt to reproduce or list protected components.",
      "Prefer a legible focal structure, intentional negative space, foreground/midground/background depth, and clustered planting. Avoid stacking every component at the center.",
      "Use normalized x and z placement where -1 is left/back and 1 is right/front. Usually choose 6 to 16 components, with repeated plants when that improves massing.",
      "Also declare the design intent: composition scheme, focal component index, sightline, open-foreground target, mood, maintenance tier, and a one-sentence story. This travels with the scene into the Blender recipe, so it must describe the layout you actually placed.",
      `Available components: ${JSON.stringify(supportedCatalog.map(componentGuide))}`,
    ].join("\n"),
    input:[{role:"user",content}],
    text:{format:{type:"json_schema",name:"fishy_aquascape_plan",strict:true,schema:outputSchema}},
  };
}

export function parseAquascapeModelResponse(payload:unknown):AquascapePlan {
  if(!payload||typeof payload!=="object")throw new AquascapeAgentError("invalid_plan","The model returned no aquarium plan.");
  const response=payload as {output_text?:unknown;output?:unknown};
  let text=typeof response.output_text==="string"?response.output_text:"";
  if(!text&&Array.isArray(response.output))for(const item of response.output){
    if(!item||typeof item!=="object"||!Array.isArray((item as {content?:unknown}).content))continue;
    for(const part of (item as {content:Array<unknown>}).content)if(part&&typeof part==="object"&&(part as {type?:unknown}).type==="output_text"&&typeof (part as {text?:unknown}).text==="string")text+=(part as {text:string}).text;
  }
  if(!text)throw new AquascapeAgentError("invalid_plan","The model returned no aquarium plan.");
  try{return aquascapePlanSchema.parse(JSON.parse(text));}
  catch{throw new AquascapeAgentError("invalid_plan","The model returned an aquarium plan that could not be used safely.");}
}

export function materializeAquascapePlan(current:SceneRecord,plan:AquascapePlan,message:string,idFactory:()=>string=()=>crypto.randomUUID()){
  const scene=validateScene(current),validPlan=aquascapePlanSchema.parse(plan),protectedObjects=scene.objects.filter(object=>object.protected).map(object=>structuredClone(object));
  const capacity=32-protectedObjects.length;
  if(capacity<1)throw new AquascapeAgentError("invalid_plan","The scene has no room for generated components. Release or remove an object first.");
  const entries=new Map(supportedCatalog.map(entry=>[entry.id,entry]));
  const generated=validPlan.components.slice(0,capacity).map((component,index)=>{
    const entry=entries.get(component.catalogId);
    if(!entry)throw new AquascapeAgentError("invalid_plan","The model selected an unavailable component.");
    const token=idFactory().replace(/[^a-zA-Z0-9-]/g,"").slice(0,36)||"component";
    const object=catalogDescriptor(entry,`ai-${index+1}-${token}`);
    object.name=component.name;
    object.position=[component.x*scene.tank.width*.42,scene.substrate,component.z*scene.tank.depth*.4];
    object.rotation=[0,component.rotationDegrees*Math.PI/180,0];
    object.size*=component.scale;
    return fitObject(object,scene,true);
  });
  // The model names its focal object by component index; resolve it to the id we just minted.
  const focal=generated[validPlan.design.focalIndex]??generated[0];
  const design={
    composition:validPlan.design.composition,focalObjectId:focal.id,sightline:validPlan.design.sightline,
    openForegroundMin:validPlan.design.openForegroundMin,mood:validPlan.design.mood,
    maintenanceTier:validPlan.design.maintenanceTier,story:validPlan.design.story,
  };
  const next=validateScene({...scene,name:validPlan.title,brief:message,design,objects:[...protectedObjects,...generated]});
  if(outsideObjects(next).length)throw new AquascapeAgentError("invalid_plan","Generated components did not fit safely inside the tank.");
  return {scene:next,componentCount:generated.length,preservedProtected:protectedObjects.length,summary:validPlan.summary};
}

export async function generateAquascape(input:unknown,options:{apiKey:string;model?:string;fetcher?:typeof fetch;userIdentifier?:string}){
  const parsed=aquascapeRequestSchema.parse(input),fetcher=options.fetcher??fetch,model=options.model?.trim()||"gpt-5.5";
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),55_000);
  try{
    const response=await fetcher("https://api.openai.com/v1/responses",{
      method:"POST",signal:controller.signal,
      headers:{authorization:`Bearer ${options.apiKey}`,"content-type":"application/json"},
      body:JSON.stringify(buildAquascapeModelRequest(parsed,model,options.userIdentifier)),
    });
    if(!response.ok)throw new AquascapeAgentError("upstream",response.status===429?"The aquarium agent is busy. Please wait a moment and try again.":"The aquarium agent could not complete this design.");
    const plan=parseAquascapeModelResponse(await response.json());
    return {...materializeAquascapePlan(parsed.scene,plan,parsed.message),model};
  } catch(error) {
    if(error instanceof AquascapeAgentError)throw error;
    if(error instanceof DOMException&&error.name==="AbortError")throw new AquascapeAgentError("upstream","The aquarium agent took too long. Please try again.");
    throw new AquascapeAgentError("upstream","The aquarium agent could not be reached.");
  } finally {clearTimeout(timeout);}
}
