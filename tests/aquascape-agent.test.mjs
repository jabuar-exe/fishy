import test from "node:test";
import assert from "node:assert/strict";
import {aquascapeRequestSchema,buildAquascapeModelRequest,generateAquascape,materializeAquascapePlan,parseAquascapeModelResponse} from "../lib/aquascape-agent.ts";
import {outsideObjects} from "../lib/geometry.ts";
import {initialScene} from "../lib/scene.ts";
import {POST,enforceSharedQuota,handleAquascapePost} from "../app/api/aquascape/generate/route.ts";

const design={composition:"triangular",focalIndex:0,sightline:"Open from the front right toward the branch.",openForegroundMin:.4,mood:"lush",maintenanceTier:"medium",story:"A shaded riverbank under an overhanging branch."};
const plan={title:"Shaded riverbank",summary:"A shaded wood composition with low foreground planting.",design,components:[
  {catalogId:"wood-talawa",name:"Directional branch",x:.25,z:-.35,scale:.82,rotationDegrees:18},
  {catalogId:"plant-eleocharis-pusilla-mini",name:"Front grass",x:-.55,z:.72,scale:.9,rotationDegrees:-8},
],influencesUsed:[]};

test("materializer uses catalog components, preserves protected objects, and fits the tank",()=>{
  const current=initialScene(),protectedBefore=structuredClone(current.objects.filter(object=>object.protected));
  const result=materializeAquascapePlan(current,plan,"Build a shaded riverbank",()=>"stable");
  assert.deepEqual(result.scene.objects.filter(object=>object.protected),protectedBefore);
  assert.equal(result.componentCount,2);
  assert.deepEqual(result.scene.objects.filter(object=>!object.protected).map(object=>object.catalogId),["wood-talawa","plant-eleocharis-pusilla-mini"]);
  assert.equal(new Set(result.scene.objects.map(object=>object.id)).size,result.scene.objects.length);
  assert.deepEqual(outsideObjects(result.scene),[]);
  assert.equal(result.scene.brief,"Build a shaded riverbank");
  // The design block travels with the scene; the Blender recipe schema requires it.
  assert.equal(result.scene.design.composition,"triangular");
  assert.equal(result.scene.design.story,design.story);
  assert.equal(result.scene.design.focalObjectId,result.scene.objects.filter(object=>!object.protected)[0].id);
});

test("a plan without a design block is rejected before any scene change",()=>{
  const withoutDesign=structuredClone(plan);
  delete withoutDesign.design;
  assert.throws(()=>materializeAquascapePlan(initialScene(),withoutDesign,"Build a shaded riverbank",()=>"stable"),/design/i);
});

test("model request is structured, stateless, and includes photos plus a saved IAPLC visual reference",()=>{
  const scene={...initialScene(),brief:"A quiet forest creek"};
  const input=aquascapeRequestSchema.parse({message:"Build a forest edge",scene,history:[],images:[{id:"174e1027-6d9e-4f95-88d4-9ca610824004",name:"tank.jpg",dataUrl:"data:image/jpeg;base64,AAAAAAAAAAAAAAAA"}],inspirations:[{id:"iaplc-2025-0001",title:"Forest creek",creator:"Aqua Studio",designLesson:"Keep a clear central path.",plantNames:["Bucephalandra"],imageUrl:"https://iaplc.com/e/wp-content/uploads/sites/2/2026/01/001_015_10486.jpg"}]});
  const request=buildAquascapeModelRequest(input,"gpt-test","safe-user");
  assert.equal(request.store,false);
  assert.equal(request.background,true);
  assert.equal(request.model,"gpt-test");
  assert.equal(request.safety_identifier,"safe-user");
  assert.equal(request.text.format.type,"json_schema");
  const imageInputs=request.input[0].content.filter(part=>part.type==="input_image");
  assert.equal(imageInputs.length,2);
  assert.equal(imageInputs[0].image_url,"https://iaplc.com/e/wp-content/uploads/sites/2/2026/01/001_015_10486.jpg");
  assert.equal(imageInputs[0].detail,"low");
  assert.equal(imageInputs[1].detail,"original");
  assert.equal(request.reasoning.effort,"medium");
  assert.equal(request.prompt_cache_key,"fishy-aquascape-components-v2");
  assert(request.text.format.schema.required.includes("generationMode"));
  const context=request.input[0].content[0].text;
  assert.match(context,/A quiet forest creek/);
  assert.match(context,/Keep a clear central path/);
});

test("response parser rejects unavailable catalog components",()=>{
  const invalid={...plan,components:[{...plan.components[0],catalogId:"invented-mesh"}]};
  assert.throws(()=>parseAquascapeModelResponse({output:[{content:[{type:"output_text",text:JSON.stringify(invalid)}]}]}),/could not be used safely/);
  assert.throws(()=>parseAquascapeModelResponse({status:"incomplete",incomplete_details:{reason:"max_output_tokens"}}),/incomplete/);
});

test("photo reconstruction preserves explicit elevation, three-axis rotation, stretch, and specimen variation",()=>{
  const reconstruction={...plan,generationMode:"reconstruct",components:[
    {catalogId:"wood-talawa",name:"Observed diagonal trunk",x:.18,y:.42,z:-.2,scale:1.1,pitchDegrees:12,rotationDegrees:-28,rollDegrees:37,stretchX:1.8,stretchY:.74,stretchZ:.92,support:"elevated",variantSeed:417,confidence:.91,evidence:"Dominant trunk crosses the photographed tank from lower right to upper left."},
  ],design:{...design,focalIndex:0}};
  const result=materializeAquascapePlan(initialScene(),reconstruction,"Generate exactly this aquarium",()=>"stable"),object=result.scene.objects.find(item=>item.catalogId==="wood-talawa");
  assert.ok(object);assert(object.position[1]>result.scene.substrate);assert.deepEqual(object.stretch,[1.8,.74,.92]);assert.equal(object.variantSeed,417);
  assert.notEqual(object.rotation[0],0);assert.notEqual(object.rotation[2],0);
});

test("Astra is the default aquascape model when no deployment override is provided",async()=>{
  const result=await generateAquascape({message:"Build a shaded riverbank",scene:initialScene(),history:[],images:[]},{apiKey:"server-only-test-key",fetcher:async()=>new Response(JSON.stringify({output:[{content:[{type:"output_text",text:JSON.stringify(plan)}]}]}),{status:200})});
  assert.equal(result.model,"gpt-6-astra");
});

test("agent sends the secret only as an authorization header and returns a validated scene",async()=>{
  let captured;
  const result=await generateAquascape({message:"Build a shaded riverbank",scene:initialScene(),history:[],images:[]},{apiKey:"server-only-test-key",model:"gpt-test",userIdentifier:"safe-user",fetcher:async(url,init)=>{
    captured={url,init};
    return new Response(JSON.stringify({output:[{content:[{type:"output_text",text:JSON.stringify(plan)}]}]}),{status:200,headers:{"content-type":"application/json"}});
  }});
  assert.equal(captured.url,"https://api.openai.com/v1/responses");
  assert.equal(captured.init.headers.authorization,"Bearer server-only-test-key");
  assert.equal(captured.init.body.includes("server-only-test-key"),false);
  assert.equal(result.componentCount,2);
  assert.deepEqual(outsideObjects(result.scene),[]);
});

test("agent retries a transient provider error with the same request id before succeeding",async()=>{
  let calls=0,requestIds=[];
  const result=await generateAquascape({requestId:"8d4d3bd6-4edf-4cbe-84fc-93ac9090b1c4",message:"Build a shaded riverbank",scene:initialScene(),history:[],images:[]},{apiKey:"server-only-test-key",model:"gpt-test",sleep:async()=>{},fetcher:async(url,init)=>{
    calls++;requestIds.push(init.headers["x-client-request-id"]);
    if(calls===1)return new Response("busy",{status:429,headers:{"retry-after":"0"}});
    return new Response(JSON.stringify({output:[{content:[{type:"output_text",text:JSON.stringify(plan)}]}]}),{status:200,headers:{"content-type":"application/json"}});
  }});
  assert.equal(calls,2);
  assert.deepEqual(requestIds,["8d4d3bd6-4edf-4cbe-84fc-93ac9090b1c4","8d4d3bd6-4edf-4cbe-84fc-93ac9090b1c4"]);
  assert.equal(result.attempts,2);
});

test("agent retries one malformed model plan before accepting a valid structured plan",async()=>{
  let calls=0;
  const result=await generateAquascape({message:"Build a shaded riverbank",scene:initialScene(),history:[],images:[]},{apiKey:"server-only-test-key",model:"gpt-test",sleep:async()=>{},fetcher:async()=>{
    calls++;
    const text=calls===1?"{not-json":JSON.stringify(plan);
    return new Response(JSON.stringify({output:[{content:[{type:"output_text",text}]}]}),{status:200,headers:{"content-type":"application/json"}});
  }});
  assert.equal(calls,2);
  assert.equal(result.attempts,2);
  assert.equal(result.componentCount,2);
});

test("agent polls one durable Astra background response instead of restarting the model",async()=>{
  const calls=[];let polls=0;
  const result=await generateAquascape({requestId:"c9435b54-2ae4-4c1d-ae20-81dab0acc023",message:"Build a shaded riverbank",scene:initialScene(),history:[],images:[]},{apiKey:"server-only-test-key",model:"gpt-test",sleep:async()=>{},fetcher:async(url,init)=>{
    calls.push([url,init.method]);
    if(init.method==="POST")return new Response(JSON.stringify({id:"resp_test",status:"queued"}),{status:200});
    polls++;
    return new Response(JSON.stringify(polls===1?{id:"resp_test",status:"in_progress"}:{id:"resp_test",status:"completed",output:[{content:[{type:"output_text",text:JSON.stringify(plan)}]}]}),{status:200});
  }});
  assert.equal(result.attempts,1);assert.equal(polls,2);assert.equal(calls.filter(([,method])=>method==="POST").length,1);assert.deepEqual(calls.slice(1).map(([url])=>url),["https://api.openai.com/v1/responses/resp_test","https://api.openai.com/v1/responses/resp_test"]);
});

test("agent does not turn auth or malformed plans into a fake successful layout",async()=>{
  await assert.rejects(()=>generateAquascape({message:"Build a shaded riverbank",scene:initialScene(),history:[],images:[]},{apiKey:"server-only-test-key",model:"gpt-test",sleep:async()=>{},fetcher:async()=>new Response("unauthorized",{status:401})}),/could not complete/);
  const malformed={...plan,influencesUsed:[{kind:"inspiration",id:"missing",componentIndexes:[0],reason:"Not supplied"}]};
  await assert.rejects(()=>generateAquascape({message:"Build a shaded riverbank",scene:initialScene(),history:[],images:[]},{apiKey:"server-only-test-key",model:"gpt-test",sleep:async()=>{},fetcher:async()=>new Response(JSON.stringify({output:[{content:[{type:"output_text",text:JSON.stringify(malformed)}]}]}),{status:200})}),/reference receipt/);
});

test("API route denies cross-site and non-JSON requests before provider access",async()=>{
  const crossSite=await POST(new Request("https://fishy.example/api/aquascape/generate",{method:"POST",headers:{"content-type":"application/json",origin:"https://attacker.example","sec-fetch-site":"cross-site"},body:"{}"}));
  assert.equal(crossSite.status,403);
  assert.match((await crossSite.json()).error,/Cross-site/);
  const wrongType=await POST(new Request("https://fishy.example/api/aquascape/generate",{method:"POST",headers:{"content-type":"text/plain"},body:"{}"}));
  assert.equal(wrongType.status,415);
});

test("malformed provider-bound requests do not consume the shared production quota",async()=>{
  let quotaCalls=0,generationCalls=0;
  const response=await handleAquascapePost(new Request("https://fishy.example/api/aquascape/generate",{method:"POST",headers:{"content-type":"application/json"},body:"{"}),{
    apiKey:"server-only-test-key",
    quota:async()=>{quotaCalls++;},
    generate:async()=>{generationCalls++;throw new Error("unreachable");},
  });
  assert.equal(response.status,400);assert.equal(quotaCalls,0);assert.equal(generationCalls,0);
});

test("global quota rejection happens before an identity row is inserted",async()=>{
  const increments=[];let cleanupCalls=0;
  await assert.rejects(()=>enforceSharedQuota("person-hash",{increment:async key=>{increments.push(key);return 99;},deleteExpired:async()=>{cleanupCalls++;}}),/Too many aquarium requests/);
  assert.deepEqual(increments,["fishy-global-generation-v1"]);assert.equal(cleanupCalls,0);
});

test("materializer rejects over-capacity and missing focal components without silently changing the design",()=>{
  const protectedScene=initialScene();
  protectedScene.objects=Array.from({length:31},(_,index)=>({...protectedScene.objects[0],id:`protected-${index}`,protected:true}));
  const overCapacity={...plan,design:{...design,focalIndex:1}};
  assert.throws(()=>materializeAquascapePlan(protectedScene,overCapacity,"Keep the focal branch",()=>"stable"),/more components/i);
  const missingFocal={...plan,components:[plan.components[0]],design:{...design,focalIndex:1}};
  assert.throws(()=>materializeAquascapePlan(initialScene(),missingFocal,"Keep the focal branch",()=>"stable"),/focal/i);
});

test("cancelling during retry backoff prevents a later provider call",async()=>{
  const controller=new AbortController();let calls=0,release;
  const pending=new Promise(resolve=>{release=resolve;});
  const run=generateAquascape({message:"Build a shaded riverbank",scene:initialScene(),history:[],images:[]},{apiKey:"server-only-test-key",signal:controller.signal,sleep:()=>pending,fetcher:async()=>{calls++;return new Response("busy",{status:429,headers:{"retry-after":"1"}});}});
  await new Promise(resolve=>setTimeout(resolve,0));
  controller.abort();
  await assert.rejects(run,/cancelled/);
  assert.equal(calls,1);
  release();
});

test("cancelling a queued background reconstruction also cancels the provider job",async()=>{
  const controller=new AbortController(),calls=[];let release;
  const pending=new Promise(resolve=>{release=resolve;});
  const run=generateAquascape({message:"Build a shaded riverbank",scene:initialScene(),history:[],images:[]},{apiKey:"server-only-test-key",signal:controller.signal,sleep:()=>pending,fetcher:async(url,init)=>{
    calls.push([url,init.method]);
    if(url.endsWith("/cancel"))return new Response(JSON.stringify({id:"resp_cancel",status:"cancelled"}),{status:200});
    return new Response(JSON.stringify({id:"resp_cancel",status:"queued"}),{status:200});
  }});
  await new Promise(resolve=>setTimeout(resolve,0));controller.abort();
  await assert.rejects(run,/cancelled/);release();
  assert(calls.some(([url,method])=>url.endsWith("/responses/resp_cancel/cancel")&&method==="POST"));
});
