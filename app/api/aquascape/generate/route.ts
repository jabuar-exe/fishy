import {AquascapeAgentError,aquascapeRequestSchema,generateAquascape} from "../../../../lib/aquascape-agent.ts";
import {and,lt,ne,sql} from "drizzle-orm";
import {generationRateLimits} from "../../../../db/schema.ts";

export const dynamic="force-dynamic";
const MAX_BODY_BYTES=9_000_000;
const WINDOW_MS=60_000;
const MAX_REQUESTS=6;
const MAX_GLOBAL_REQUESTS=12;
const GLOBAL_QUOTA_KEY="fishy-global-generation-v1";
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

function localRateLimit(identity:string){
  const now=Date.now(),bucket=buckets.get(identity);
  if(!bucket||now-bucket.started>=WINDOW_MS){buckets.set(identity,{started:now,count:1});return;}
  if(bucket.count>=MAX_REQUESTS)throw new RequestError(429,"Too many aquarium requests. Please wait a minute and try again.");
  bucket.count++;
  if(buckets.size>1000)for(const [key,value] of buckets)if(now-value.started>=WINDOW_MS)buckets.delete(key);
}

type QuotaStore={increment:(key:string)=>Promise<number>;deleteExpired:(before:number)=>Promise<void>};

export async function enforceSharedQuota(identityHash:string,store:QuotaStore,now=Date.now()){
  const globalCount=await store.increment(GLOBAL_QUOTA_KEY);
  if(globalCount>MAX_GLOBAL_REQUESTS)throw new RequestError(429,"Too many aquarium requests. Please wait a minute and try again.");
  const identityCount=await store.increment(identityHash);
  if(identityCount>MAX_REQUESTS)throw new RequestError(429,"Too many aquarium requests. Please wait a minute and try again.");
  await store.deleteExpired(now-WINDOW_MS);
}

async function rateLimit(identityHash:string){
  if(process.env.NODE_ENV!=="production"){localRateLimit(identityHash);return;}
  const now=Date.now(),expiredBefore=now-WINDOW_MS;
  try{
    const {getDb}=await import("../../../../db/index.ts");
    const db=getDb();
    const store:QuotaStore={
      increment:async(key:string)=>{
      const [bucket]=await db.insert(generationRateLimits).values({identityHash:key,windowStarted:now,count:1}).onConflictDoUpdate({
        target:generationRateLimits.identityHash,
        set:{
          windowStarted:sql`CASE WHEN ${generationRateLimits.windowStarted} <= ${expiredBefore} THEN ${now} ELSE ${generationRateLimits.windowStarted} END`,
          count:sql`CASE WHEN ${generationRateLimits.windowStarted} <= ${expiredBefore} THEN 1 ELSE ${generationRateLimits.count} + 1 END`,
        },
      }).returning({count:generationRateLimits.count});
      if(!bucket)throw new Error("Quota update returned no row");
        return bucket.count;
      },
      deleteExpired:async(before:number)=>{await db.delete(generationRateLimits).where(and(ne(generationRateLimits.identityHash,GLOBAL_QUOTA_KEY),lt(generationRateLimits.windowStarted,before)));},
    };
    await enforceSharedQuota(identityHash,store,now);
  } catch(error) {
    if(error instanceof RequestError)throw error;
    throw new RequestError(503,"Aquarium generation is temporarily unavailable while its shared quota guard recovers.");
  }
}

async function safetyIdentifier(value:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

type RouteDependencies={apiKey?:string;model?:string;quota?:(identityHash:string)=>Promise<void>;generate?:typeof generateAquascape};

export async function handleAquascapePost(request:Request,dependencies:RouteDependencies={}){
  try{
    checkRequestBoundary(request);
    const identity=requestIdentity(request),apiKey=dependencies.apiKey??process.env.OPENAI_API_KEY;
    if(!apiKey)throw new RequestError(503,"Aquarium generation is not configured yet.");
    const body=aquascapeRequestSchema.parse(await readJson(request));
    const identityHash=await safetyIdentifier(identity);await (dependencies.quota??rateLimit)(identityHash);
    const result=await (dependencies.generate??generateAquascape)(body,{apiKey,model:dependencies.model??(process.env.OPENAI_AQUASCAPE_MODEL?.trim()||"gpt-6-astra"),userIdentifier:identityHash,signal:request.signal});
    return json({ok:true,baseRevision:body.scene.revision,...result});
  } catch(error) {
    if(error instanceof RequestError)return json({ok:false,error:error.message},error.status);
    if(error instanceof AquascapeAgentError)return json({ok:false,error:error.message,retryable:error.retryable},error.code==="invalid_plan"?422:error.code==="unavailable"?499:502);
    if(error instanceof Error&&error.name==="ZodError")return json({ok:false,error:"The aquarium request contains invalid or unsupported data."},400);
    return json({ok:false,error:"Aquarium generation failed safely. Please try again."},500);
  }
}

export async function POST(request:Request){return handleAquascapePost(request);}
