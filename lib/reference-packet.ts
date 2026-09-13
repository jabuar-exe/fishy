import * as T from "three";
import {createAquariumStage,populateAquarium} from "./aquarium-stage.ts";
import {disposeObject} from "./geometry.ts";
import {validateScene,type SceneRecord} from "./scene.ts";

export const VIEW_NAMES=["front","left","right","top","perspective"] as const;
export const OUTPUT_WIDTH=2048,OUTPUT_HEIGHT=1536;
/** Human-readable centimetres only; never use this formatter for persisted data or hashes. */
export function referenceDimensionsLabel(tank:SceneRecord["tank"]) {
  return [tank.width,tank.depth,tank.height].map(value=>Number((value*100).toFixed(2)).toString()).join(" × ")+" cm";
}
export function referenceCameras(record:SceneRecord) {
  const {width:w,height:h,depth:d}=record.tank,center=new T.Vector3(0,h/2-.012,0),box=new T.Box3(new T.Vector3(-w/2-.012,-.025,-d/2-.012),new T.Vector3(w/2+.012,h+.004,d/2+.012)),radius=box.getSize(new T.Vector3()).length()/2,aspect=OUTPUT_WIDTH/OUTPUT_HEIGHT;
  const directions=[new T.Vector3(0,0,1),new T.Vector3(-1,0,0),new T.Vector3(1,0,0),new T.Vector3(0,1,0),new T.Vector3(.8,.52,1).normalize()];
  const views=VIEW_NAMES.map((name,i)=>{const camera=i===4?new T.PerspectiveCamera(36,aspect,.001,100):new T.OrthographicCamera(-1,1,1,-1,.001,100),distance=i===4?radius/Math.sin(18*Math.PI/180)*1.16:radius*3+1;camera.position.copy(center).addScaledVector(directions[i],distance);if(name==="top")camera.up.set(0,0,-1);camera.lookAt(center);camera.updateMatrixWorld(true);
    if(camera instanceof T.OrthographicCamera){let extentX=0,extentY=0;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);extentX=Math.max(extentX,Math.abs(p.x));extentY=Math.max(extentY,Math.abs(p.y));}const half=Math.max(extentY,extentX/aspect)*1.12;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;}
    camera.updateProjectionMatrix();return {name,camera,target:center.clone()};});
  const half=Math.max(...views.slice(0,4).map(v=>(v.camera as T.OrthographicCamera).top));for(const {camera} of views){if(camera instanceof T.OrthographicCamera){camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();}}return views;
}
const encoder=new TextEncoder();
export function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
/** A standards-compatible stored ZIP; filenames are generated locally, never user paths. */
export function zipPacket(files:{name:string;bytes:Uint8Array}[]) {
  const parts:BlobPart[]=[],directory:Uint8Array<ArrayBuffer>[]=[];let offset=0;
  for(const file of files){if(!/^[a-zA-Z0-9_.-]+$/.test(file.name))throw new Error("Invalid packet filename");const name=encoder.encode(file.name),size=file.bytes.length,crc=crc32(file.bytes),local=new Uint8Array(30+name.length),l=new DataView(local.buffer);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint32(14,crc,true);l.setUint32(18,size,true);l.setUint32(22,size,true);l.setUint16(26,name.length,true);local.set(name,30);parts.push(local,new Uint8Array(file.bytes).buffer);
    const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint32(16,crc,true);c.setUint32(20,size,true);c.setUint32(24,size,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);directory.push(central);offset+=local.length+size;}
  const length=directory.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,length,true);e.setUint32(16,offset,true);return new Blob([...parts,...directory,end],{type:"application/zip"});
}
const sha=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new Uint8Array(bytes).buffer))).map(b=>b.toString(16).padStart(2,"0")).join("");
export type ReferencePacket={zip:Blob;images:{name:string;blob:Blob}[];revision:number};
export async function renderReferencePacket(input:SceneRecord,water:boolean,signal:AbortSignal,onProgress:(n:number)=>void):Promise<ReferencePacket> {
  const record=validateScene(structuredClone(input)),sceneBytes=encoder.encode(JSON.stringify(record,null,2)),sceneHash=await sha(sceneBytes);signal.throwIfAborted();const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}),images:ReferencePacket["images"]=[],files:{name:string;bytes:Uint8Array}[]=[{name:"scene.json",bytes:sceneBytes}],content=new T.Group();let stage:ReturnType<typeof createAquariumStage>|undefined;
  try{
    let shaderFailed=false;renderer.debug.onShaderError=()=>{shaderFailed=true;};
    stage=createAquariumStage(renderer);stage.scene.add(content);
    renderer.setPixelRatio(1);renderer.setSize(OUTPUT_WIDTH,OUTPUT_HEIGHT,false);populateAquarium(content,record,water);const cameras=referenceCameras(record),manifestViews=[];
    for(const {name,camera,target} of cameras){signal.throwIfAborted();await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));signal.throwIfAborted();renderer.render(stage.scene,camera);if(shaderFailed||renderer.getContext().isContextLost())throw new Error("The graphics device could not render this packet. Close it and try again.");
      const blob=await new Promise<Blob>((resolve,reject)=>renderer.domElement.toBlob(b=>b?resolve(b):reject(new Error("Image encoding failed")),"image/png")),bytes=new Uint8Array(await blob.arrayBuffer()),cameraRecord={projection:camera.type,metresPerPixel:camera instanceof T.OrthographicCamera?(camera.right-camera.left)/OUTPUT_WIDTH:null,position:camera.position.toArray(),up:camera.up.toArray(),target:target.toArray(),matrixWorld:camera.matrixWorld.toArray(),projectionMatrix:camera.projectionMatrix.toArray()};images.push({name,blob});files.push({name:`${name}.png`,bytes});manifestViews.push({name,file:`${name}.png`,width:OUTPUT_WIDTH,height:OUTPUT_HEIGHT,sha256:await sha(bytes),cameraSha256:await sha(encoder.encode(JSON.stringify(cameraRecord))),...cameraRecord});signal.throwIfAborted();onProgress(images.length);
    }
    const manifest={format:"fishy.reference-packet.v1",sceneId:record.id,revision:record.revision,builder:record.builder,geometryGenerator:"fishy-object-v11",sceneFile:"scene.json",sceneSha256:sceneHash,units:"metres",dimensionsCm:{width:record.tank.width*100,depth:record.tank.depth*100,height:record.tank.height*100},dimensionSource:record.tank.source,water,orthographicScale:"Identical metres per pixel across front, left, right and top",waterPhase:"flat static surface",background:"dark studio; room photo excluded",lighting:"same studio rig as editor",views:manifestViews,limitations:["These are rendered views of one frozen scene, not photographs or alternative designs.","Scene dimensions are user-entered or assumed, not independently measured.","Orthographic front/left/right/top preserve relative model scale; perspective overview is not a measurement view.","Materials are procedural approximations. Browser/GPU differences may affect pixels.","scene.json is the full data record including sculpt fields; this release does not provide a general scene-file import UI."]};
    files.push({name:"manifest.json",bytes:encoder.encode(JSON.stringify(manifest,null,2))});
    const caption=`Revision ${record.revision} · ${referenceDimensionsLabel(record.tank)} (W × D × H) · ${record.tank.source==="assumed"?"assumed dimensions":"user-entered dimensions"}`;
    files.push({name:"index.html",bytes:encoder.encode(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Fishy — five reference views</title><style>body{font:16px system-ui;max-width:1100px;margin:32px auto;padding:0 20px;background:#f7f8f7;color:#16312c}img{width:100%;height:auto}figure{margin:28px 0}p{line-height:1.5}</style><h1>Fishy · five reference views</h1><p>${caption}</p><p>One frozen scene. Rendered references—not photographs or measured physical fit. Room photo excluded. Front, left, right and top are orthographic at identical scale; overview is perspective.</p>${VIEW_NAMES.map(name=>`<figure><h2>${name}</h2><img src="${name}.png" alt="${name} view of aquarium revision ${record.revision}"><figcaption>${caption}</figcaption></figure>`).join("")}<p>See manifest.json for exact cameras, dimensions and SHA-256 image/data identities. scene.json includes sculpt data; no general re-import UI is provided in this release.</p>`)});
    signal.throwIfAborted();return {zip:zipPacket(files),images,revision:record.revision};
  }finally{disposeObject(content);stage?.dispose();renderer.dispose();renderer.forceContextLoss();}
}
