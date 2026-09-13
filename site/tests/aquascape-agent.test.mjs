import test from "node:test";
import assert from "node:assert/strict";
import {aquascapeRequestSchema,buildAquascapeModelRequest,generateAquascape,materializeAquascapePlan,parseAquascapeModelResponse} from "../lib/aquascape-agent.ts";
import {outsideObjects} from "../lib/geometry.ts";
import {initialScene} from "../lib/scene.ts";
import {POST} from "../app/api/aquascape/generate/route.ts";

const design={composition:"triangular",focalIndex:0,sightline:"Open from the front right toward the branch.",openForegroundMin:.4,mood:"lush",maintenanceTier:"medium",story:"A shaded riverbank under an overhanging branch."};
const plan={title:"Shaded riverbank",summary:"A shaded wood composition with low foreground planting.",design,components:[
  {catalogId:"wood-talawa",name:"Directional branch",x:.25,z:-.35,scale:.82,rotationDegrees:18},
  {catalogId:"plant-eleocharis-pusilla-mini",name:"Front grass",x:-.55,z:.72,scale:.9,rotationDegrees:-8},
]};

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

test("model request is structured, stateless, and includes low-detail images",()=>{
  const input=aquascapeRequestSchema.parse({message:"Build a forest edge",scene:initialScene(),history:[],images:[{name:"tank.jpg",dataUrl:"data:image/jpeg;base64,AAAAAAAAAAAAAAAA"}]});
  const request=buildAquascapeModelRequest(input,"gpt-test","safe-user");
  assert.equal(request.store,false);
  assert.equal(request.model,"gpt-test");
  assert.equal(request.safety_identifier,"safe-user");
  assert.equal(request.text.format.type,"json_schema");
  assert.equal(request.input[0].content[1].detail,"low");
});

test("response parser rejects unavailable catalog components",()=>{
  const invalid={...plan,components:[{...plan.components[0],catalogId:"invented-mesh"}]};
  assert.throws(()=>parseAquascapeModelResponse({output:[{content:[{type:"output_text",text:JSON.stringify(invalid)}]}]}),/could not be used safely/);
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

test("API route denies cross-site and non-JSON requests before provider access",async()=>{
  const crossSite=await POST(new Request("https://fishy.example/api/aquascape/generate",{method:"POST",headers:{"content-type":"application/json",origin:"https://attacker.example","sec-fetch-site":"cross-site"},body:"{}"}));
  assert.equal(crossSite.status,403);
  assert.match((await crossSite.json()).error,/Cross-site/);
  const wrongType=await POST(new Request("https://fishy.example/api/aquascape/generate",{method:"POST",headers:{"content-type":"text/plain"},body:"{}"}));
  assert.equal(wrongType.status,415);
});
