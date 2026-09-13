import {AquascapeAgentError,aquascapeRequestSchema,generateAquascape} from "../../../../lib/aquascape-agent.ts";

export const dynamic="force-dynamic";
const MAX_BODY_BYTES=9_000_000;
const WINDOW_MS=60_000;
const MAX_REQUESTS=6;
const buckets=new Map<string,{started:number;count:number}>();

class RequestError extends Error {readonly status:number;constructor(status:number,message:string){super(message);this.status=status;}}

function json(body:unknown,status=200){return Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});}

async function readJson(request:Request){
  const declared=Number(request.headers.get("content-length")??0);
  if(Number.isFinite(declared)&&declared>MAX_BODY_BYTES)throw new RequestError(413,"The aquarium request is too large.");
  if(!request.body)throw new RequestError(400,"The aquarium request is empty.");
  const reader=request.body.getReader(),chunks:Uint8Array[]=[];let total=0;
  for(;;){const {done,value}=await reader.read();if(done)break;if(!value)continue;total+=value.byteLength;if(total>MAX_BODY_BYTES){await reader.cancel();throw new RequestError(413,"The aquarium request is too large.");}chunks.push(value);}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new RequestError(400,"The aquarium request is not valid JSON.");}
}

function checkRequestBoundary(request:Request){
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))throw new RequestError(415,"Send the aquarium request as JSON.");
  const url=new URL(request.url),origin=request.headers.get("origin"),fetchSite=request.headers.get("sec-fetch-site");
  if(origin&&origin!==url.origin)throw new RequestError(403,"Cross-site aquarium requests are not allowed.");
  if(fetchSite&&!(["same-origin","none"] as string[]).includes(fetchSite))throw new RequestError(403,"Cross-site aquarium requests are not allowed.");
}

function requestIdentity(request:Request){
  const userId=request.headers.get("oai-authenticated-user-id");
  const production=process.env.NODE_ENV==="production";
  if(production&&process.env.FISHY_ALLOW_ANONYMOUS_GENERATION!=="true"&&!userId)throw new RequestError(401,"Sign in to generate an aquarium model.");
  const allowlist=process.env.FISHY_ALLOWED_USER_IDS?.split(",").map(id=>id.trim()).filter(Boolean);
  if(allowlist?.length&&(!userId||!allowlist.includes(userId)))throw new RequestError(403,"This account cannot use aquarium generation.");
  return userId??request.headers.get("cf-connecting-ip")??"local-anonymous";
}

function rateLimit(identity:string){
  const now=Date.now(),bucket=buckets.get(identity);
  if(!bucket||now-bucket.started>=WINDOW_MS){buckets.set(identity,{started:now,count:1});return;}
  if(bucket.count>=MAX_REQUESTS)throw new RequestError(429,"Too many aquarium requests. Please wait a minute and try again.");
  bucket.count++;
  if(buckets.size>1000)for(const [key,value] of buckets)if(now-value.started>=WINDOW_MS)buckets.delete(key);
}

async function safetyIdentifier(value:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

export async function POST(request:Request){
  try{
    checkRequestBoundary(request);
    const identity=requestIdentity(request);rateLimit(identity);
    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey)throw new RequestError(503,"Aquarium generation is not configured yet.");
    const body=aquascapeRequestSchema.parse(await readJson(request));
    const result=await generateAquascape(body,{apiKey,model:process.env.OPENAI_MODEL,userIdentifier:await safetyIdentifier(identity)});
    return json({ok:true,baseRevision:body.scene.revision,...result});
  } catch(error) {
    if(error instanceof RequestError)return json({ok:false,error:error.message},error.status);
    if(error instanceof AquascapeAgentError)return json({ok:false,error:error.message},error.code==="invalid_plan"?422:502);
    if(error instanceof Error&&error.name==="ZodError")return json({ok:false,error:"The aquarium request contains invalid or unsupported data."},400);
    return json({ok:false,error:"Aquarium generation failed safely. Please try again."},500);
  }
}
