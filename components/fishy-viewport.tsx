"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import * as T from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import {TransformControls} from "three/examples/jsm/controls/TransformControls.js";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {disposeObject} from "@/lib/geometry";
import {createAquariumStage,populateAquarium,updateWaterSurface} from "@/lib/aquarium-stage";
import {filterFlowSources} from "@/lib/equipment";
import {BACKGROUNDS,configureTankOrbit,keepCameraAboveTank,type ViewSettings} from "@/lib/view-settings";
import {WaterFlow} from "@/lib/water-flow";
import type {SceneRecord,Vec3} from "@/lib/scene";

type Props={background?:ViewSettings;scene:SceneRecord;selected:string|null;mode:"translate"|"rotate";showcase?:string;water:boolean;cancel:number;frame:number;onSelect:(id:string|null)=>void;onTransforming?:(active:boolean)=>void;onTransform:(id:string,p:Vec3,r:Vec3,base:number)=>void;onError:(message:string)=>void};
export function FishyViewport(props:Props) {
  const host=useRef<HTMLDivElement>(null),latest=useRef(props);
  const [message,setMessage]=useState("Preparing 3D view…");
  const deferMessage=useCallback((value:string)=>queueMicrotask(()=>setMessage(value)),[]);
  const runtime=useRef<{scene:T.Scene;renderer:T.WebGLRenderer;camera:T.PerspectiveCamera;orbit:OrbitControls;transform:TransformControls;content:T.Group;meshes:Map<string,T.Object3D>;outline:T.BoxHelper|null;drag:{id:string;base:number}|null;water:T.Mesh|null;waterFlow:WaterFlow|null;applyLighting:(record:SceneRecord)=>void;frame:()=>void}|null>(null);
  useEffect(()=>{latest.current=props;},[props]);
  useEffect(()=>{
    const container=host.current;if(!container)return;
    let renderer:T.WebGLRenderer;
    try{renderer=new T.WebGLRenderer({antialias:true,alpha:true});}catch{deferMessage("WebGL is unavailable. Try a browser with hardware acceleration.");return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
    renderer.domElement.setAttribute("aria-label","Aquarium 3D canvas");renderer.domElement.setAttribute("role","img");
    container.appendChild(renderer.domElement);
    const stageSetup=createAquariumStage(renderer),scene=stageSetup.scene;
    const camera=new T.PerspectiveCamera(36,1,.005,30);camera.position.set(.73,.48,.94);
    const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,.14,0);orbit.enableDamping=true;orbit.minDistance=.18;orbit.maxDistance=8;configureTankOrbit(orbit);const constrain=()=>keepCameraAboveTank(camera,orbit);orbit.addEventListener("change",constrain);
    const transform=new TransformControls(camera,renderer.domElement);transform.setSize(.75);scene.add(transform.getHelper());
    const content=new T.Group();scene.add(content);
    const frame=()=>{const {tank,equipment}=latest.current.scene;const overhead=equipment.some(item=>item.kind==="light")?.18:0;const box=latest.current.showcase?new T.Box3().setFromObject(content):new T.Box3(new T.Vector3(-tank.width/2,0,-tank.depth/2),new T.Vector3(tank.width/2,tank.height+overhead,tank.depth/2));if(box.isEmpty())return;const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());const distance=Math.max(size.y,size.x/camera.aspect,size.z)*2.5;camera.position.copy(center).add(new T.Vector3(.65,.4,1).multiplyScalar(distance));orbit.target.copy(center);orbit.update();};
    const state={scene,renderer,camera,orbit,transform,content,meshes:new Map<string,T.Object3D>(),outline:null as T.BoxHelper|null,drag:null as {id:string;base:number}|null,water:null as T.Mesh|null,waterFlow:null as WaterFlow|null,applyLighting:stageSetup.applyLighting,frame};runtime.current=state;
    transform.addEventListener("dragging-changed",event=>{orbit.enabled=!event.value;latest.current.onTransforming?.(!!event.value);});
    transform.addEventListener("mouseDown",()=>{const object=transform.object;if(object)state.drag={id:object.userData.objectId,base:latest.current.scene.revision};});
    transform.addEventListener("mouseUp",()=>{const drag=state.drag;state.drag=null;orbit.enabled=true;const object=transform.object;if(!drag||!object)return;latest.current.onTransform(drag.id,object.position.toArray(),[object.rotation.x,object.rotation.y,object.rotation.z],drag.base);});
    const ray=new T.Raycaster(),pointer=new T.Vector2();let down=[0,0],gizmoDown=false;
    const pointerDown=(e:PointerEvent)=>{down=[e.clientX,e.clientY];gizmoDown=!!transform.axis;};
    const pointerUp=(e:PointerEvent)=>{if(gizmoDown||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5||latest.current.showcase)return;const bounds=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects([...state.meshes.values()],true)[0];if(hit){let object:T.Object3D|null=hit.object;while(object&&!object.userData.objectId)object=object.parent;if(object)latest.current.onSelect(object.userData.objectId);}else latest.current.onSelect(null);};
    renderer.domElement.addEventListener("pointerdown",pointerDown);renderer.domElement.addEventListener("pointerup",pointerUp);
    const resize=()=>{const w=container.clientWidth,h=container.clientHeight;if(w&&h){camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}};const observer=new ResizeObserver(resize);observer.observe(container);resize();const initialFrame=requestAnimationFrame(()=>{resize();frame();});
    const motionPreference=window.matchMedia("(prefers-reduced-motion: reduce)");let reduced=motionPreference.matches;const updateMotion=()=>{reduced=motionPreference.matches;lastTime=null;};motionPreference.addEventListener("change",updateMotion);let animation=0,lastTime:number|null=null;
    const draw=(time:number)=>{animation=requestAnimationFrame(draw);orbit.update();constrain();state.outline?.update();if(state.water&&state.waterFlow&&!reduced){const elapsed=lastTime===null?0:(time-lastTime)/1000;lastTime=time;if(state.waterFlow.advance(elapsed))updateWaterSurface(state.water,state.waterFlow.heights,state.waterFlow.timeSeconds);}else lastTime=time;renderer.render(scene,camera);};animation=requestAnimationFrame(draw);deferMessage("");
    return()=>{cancelAnimationFrame(animation);cancelAnimationFrame(initialFrame);motionPreference.removeEventListener("change",updateMotion);observer.disconnect();renderer.domElement.removeEventListener("pointerdown",pointerDown);renderer.domElement.removeEventListener("pointerup",pointerUp);orbit.removeEventListener("change",constrain);orbit.dispose();transform.dispose();disposeObject(content);state.outline?.geometry.dispose();stageSetup.dispose();renderer.dispose();container.replaceChildren();runtime.current=null;};
  },[deferMessage]);
  useEffect(()=>{
    const w=runtime.current;if(!w)return;let abandoned=false;
    w.transform.detach();w.drag=null;w.orbit.enabled=true;
    if(w.outline){w.scene.remove(w.outline);w.outline.geometry.dispose();(w.outline.material as T.Material).dispose();w.outline=null;}
    const previousFlow=w.waterFlow;disposeObject(w.content);w.content.clear();w.meshes.clear();w.water=null;w.waterFlow=null;
    if(props.showcase){deferMessage("Loading original aquarium…");new GLTFLoader().load(`/showcase/${props.showcase}.glb`,g=>{if(abandoned){disposeObject(g.scene);return;}g.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});w.content.add(g.scene);w.frame();deferMessage("");},undefined,()=>{if(!abandoned){deferMessage("Showcase could not load. Check connection and try another view.");latest.current.onError("The showcase asset failed to load.");}});return()=>{abandoned=true;};}
    const built=populateAquarium(w.content,props.scene,props.water);w.meshes=built.meshes;w.water=built.water;w.applyLighting(props.scene);
    if(w.water){const geometry=w.water.geometry as T.PlaneGeometry,parameters=geometry.parameters,sources=filterFlowSources(props.scene),sameSurface=previousFlow&&previousFlow.columns===parameters.widthSegments+1&&previousFlow.rows===parameters.heightSegments+1&&Math.abs(previousFlow.surfaceWidth-parameters.width)<1e-9&&Math.abs(previousFlow.surfaceDepth-parameters.height)<1e-9;w.waterFlow=sameSurface?previousFlow:new WaterFlow(parameters.widthSegments+1,parameters.heightSegments+1,parameters.width,parameters.height,{sources});w.waterFlow.setSources(sources);updateWaterSurface(w.water,w.waterFlow.heights,w.waterFlow.timeSeconds);}
    const object=w.meshes.get(latest.current.selected??"");if(object){if(!object.userData.fixedMount)w.transform.attach(object);const helper=new T.BoxHelper(object,"#8bdace");w.outline=helper;w.scene.add(helper);}
    deferMessage("");
    return()=>{abandoned=true;};
  },[props.scene,props.showcase,props.water,deferMessage]);
  useEffect(()=>{const w=runtime.current;if(!w||props.showcase)return;if(w.outline){w.scene.remove(w.outline);w.outline.geometry.dispose();(w.outline.material as T.Material).dispose();w.outline=null;}const object=w.meshes.get(props.selected??"");if(object){if(!object.userData.fixedMount)w.transform.attach(object);else w.transform.detach();w.outline=new T.BoxHelper(object,"#8bdace");w.scene.add(w.outline);}else w.transform.detach();},[props.selected,props.showcase]);
  useEffect(()=>{runtime.current?.transform.setMode(props.mode);},[props.mode]);
  useEffect(()=>{const w=runtime.current;if(!w)return;w.drag=null;w.transform.reset();w.transform.dragging=false;w.transform.axis=null;const object=w.transform.object,canonical=latest.current.scene.objects.find(o=>o.id===object?.userData.objectId);if(object&&canonical){object.position.fromArray(canonical.position);object.rotation.set(...canonical.rotation);object.scale.set(...(canonical.stretch??[1,1,1])).multiplyScalar(canonical.size);}w.orbit.enabled=true;},[props.cancel]);
  useEffect(()=>{runtime.current?.frame();},[props.frame,props.scene.tank.width,props.scene.tank.depth,props.scene.tank.height]);
  const roomPhoto=props.background?.mode==="room"?props.background.photo:null;
  useEffect(()=>{const w=runtime.current;if(w)w.scene.background=roomPhoto?null:new T.Color(BACKGROUNDS.find(b=>b.id===props.background?.mode)?.color??"#111d21");},[props.background?.mode,roomPhoto]);
  return <div className="stage" aria-label={props.showcase?"Original aquarium showcase":"Editable aquarium"}>{roomPhoto&&<img className="room-backdrop" src={roomPhoto.url} alt="" aria-hidden="true" style={{objectPosition:`${props.background!.x}% ${props.background!.y}%`,transform:`scale(${props.background!.zoom/100})`,transformOrigin:`${props.background!.x}% ${props.background!.y}%`}}/>}<div ref={host} className="canvas-host"/>{message&&<div className="viewport-status" role="status">{message}</div>}</div>;
}
