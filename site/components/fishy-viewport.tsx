"use client";

import {useCallback,useEffect,useLayoutEffect,useRef,useState} from "react";
import * as T from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import {TransformControls} from "three/examples/jsm/controls/TransformControls.js";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {disposeObject} from "@/lib/geometry";
import {createAquariumStage,populateAquarium} from "@/lib/aquarium-stage";
import {filterFlowSources} from "@/lib/equipment";
import {BACKGROUNDS,configureTankOrbit,keepCameraAboveTank,type ViewSettings} from "@/lib/view-settings";
import {waterFlowForSurface,WaterFlow} from "@/lib/water-flow";
import {resolveVisualProfile} from "@/lib/render-profile";
import {resolveRenderQuality,type RenderQuality} from "@/lib/render-quality";
import {createOrganismSystem,type OrganismSystem} from "@/lib/organism-system";
import {enhanceAquariumAssets,releaseFidelityAssetCache} from "@/lib/render-assets";
import {syncSceneObjects} from "@/lib/scene-object-sync";
import {estimatedTextureMiB} from "@/lib/render-metrics";
import {AquariumClock,frameStatistics} from "@/lib/animation-clock";
import {CAMERA_VIEWS,tankCameraPose,presentationCameraPose,type CameraView} from "@/lib/camera-views";
import type {SceneRecord,SceneObject,Vec3} from "@/lib/scene";

type Props={motionPreference?:"system"|"reduced";diagnosticsLab?:boolean;active?:boolean;background?:ViewSettings;scene:SceneRecord;selected:string|null;mode:"translate"|"rotate";showcase?:string;water:boolean;cancel:number;frame:number;onSelect:(id:string|null)=>void;onTransforming?:(active:boolean)=>void;onTransform:(id:string,p:Vec3,r:Vec3,base:number)=>void;onError:(message:string)=>void;onMotionChange?:(motion:boolean)=>void};
type Metrics={textureMiB:number;fps:number;p95:number;calls:number;triangles:number;textures:number;geometries:number;tier:string;fish:number;requested:number;phase:number;state:string};
type Runtime={renderer:T.WebGLRenderer;stage:ReturnType<typeof createAquariumStage>;camera:T.PerspectiveCamera;orbit:OrbitControls;transform:TransformControls;content:T.Group;built:ReturnType<typeof populateAquarium>|null;school:OrganismSystem|null;outline:T.BoxHelper|null;drag:{id:string;base:number}|null;flow:WaterFlow|null;clock:AquariumClock;quality:RenderQuality;objects:SceneObject[];contentKey:string;organismKey:string;lightingKey:string;assetAbort:AbortController|null;invalidate:()=>void;setView:(view:CameraView)=>void;zoom:(scale:number)=>void;present:()=>void;takeControl:()=>void;select:()=>void};
const initialMetrics:Metrics={textureMiB:0,fps:0,p95:0,calls:0,triangles:0,textures:0,geometries:0,tier:"high",fish:0,requested:0,phase:0,state:"Preparing"};

export function FishyViewport(props:Props) {
  const host=useRef<HTMLDivElement>(null),runtime=useRef<Runtime|null>(null),latest=useRef(props);
  const [message,setMessage]=useState("Preparing 3D view…"),[assetStatus,setAssetStatus]=useState(""),[assetLoadMs,setAssetLoadMs]=useState<number|null>(null);
  const [paused,setPaused]=useState(false),[reduced,setReduced]=useState(false),[view,setCameraView]=useState<CameraView>("perspective"),[presenting,setPresenting]=useState(false),[metrics,setMetrics]=useState(initialMetrics),[contextVersion,setContextVersion]=useState(0),[contextLost,setContextLost]=useState(false),[qualityRevision,setQualityRevision]=useState(0),[performanceSample,setPerformanceSample]=useState<number|undefined>();
  const controls=useRef({paused,reduced});
  useLayoutEffect(()=>{latest.current=props;controls.current={paused,reduced};});
  const announce=useCallback((text:string)=>queueMicrotask(()=>setMessage(text)),[]);

  useEffect(()=>{
    const element=host.current;if(!element)return;const container=element;
    let renderer:T.WebGLRenderer;
    try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});}
    catch{announce("3D is unavailable. Enable hardware acceleration or try another browser.");return;}
    const quality=resolveRenderQuality({preference:resolveVisualProfile(latest.current.scene.visual).quality,viewport:{width:container.clientWidth,height:container.clientHeight,devicePixelRatio:window.devicePixelRatio}});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,quality.pixelRatioCap));
    const canvas=renderer.domElement;canvas.className="aquarium-canvas";canvas.tabIndex=0;canvas.setAttribute("role","group");canvas.setAttribute("aria-roledescription","3D aquarium");canvas.setAttribute("aria-label","Aquarium view. Arrow keys rotate. Plus and minus zoom. Zero frames the tank. Select objects in Arrange.");container.appendChild(canvas);
    const stage=createAquariumStage(renderer,{quality});
    const camera=new T.PerspectiveCamera(36,1,.001,100),orbit=new OrbitControls(camera,canvas);
    orbit.enableDamping=true;orbit.dampingFactor=.09;orbit.minDistance=.06;orbit.maxDistance=12;configureTankOrbit(orbit);
    const transform=new TransformControls(camera,canvas);transform.setSize(.75);stage.scene.add(transform.getHelper());
    const content=new T.Group();stage.scene.add(content);
    const clock=new AquariumClock();let frameId=0,disposed=false,lostContext=false,visible=true,dirty=true,settleFrames=0,lastDraw:number|null=null,introStart:number|null=null,statsAt=0,lastQualityChange=-15000;const samples:number[]=[];let framedView:CameraView="perspective";
    const motionQuery=window.matchMedia("(prefers-reduced-motion: reduce)");controls.current.reduced=motionQuery.matches||latest.current.motionPreference==="reduced";queueMicrotask(()=>setReduced(controls.current.reduced));
    const awake=()=>!disposed&&!lostContext&&visible&&!document.hidden&&latest.current.active!==false&&container.clientWidth>0&&container.clientHeight>0;
    const invalidate=()=>{dirty=true;if(!frameId&&awake())frameId=requestAnimationFrame(draw);};
    const takeControl=()=>{if(introStart!==null){introStart=null;queueMicrotask(()=>setPresenting(false));}orbit.enabled=!transform.dragging;invalidate();};
    const pose=(value:{position:T.Vector3;target:T.Vector3;fov?:number})=>{camera.fov=value.fov??36;camera.updateProjectionMatrix();camera.position.copy(value.position);orbit.target.copy(value.target);camera.lookAt(value.target);orbit.update();};
    const setView=(next:CameraView)=>{framedView=next;takeControl();if(latest.current.showcase){const box=new T.Box3().setFromObject(content);if(!box.isEmpty()){const target=box.getCenter(new T.Vector3()),radius=box.getSize(new T.Vector3()).length();pose({target,position:target.clone().add(new T.Vector3(.65,.4,1).normalize().multiplyScalar(radius*1.55))});}}else pose(tankCameraPose(latest.current.scene,camera.aspect,next));setViewState(next);settleFrames=3;invalidate();};
    const setViewState=(next:CameraView)=>queueMicrotask(()=>setCameraView(next));
    const zoom=(scale:number)=>{takeControl();const offset=camera.position.clone().sub(orbit.target);offset.setLength(T.MathUtils.clamp(offset.length()*scale,orbit.minDistance,orbit.maxDistance));camera.position.copy(orbit.target).add(offset);orbit.update();invalidate();};
    const select=()=>{
      if(w.outline){stage.scene.remove(w.outline);w.outline.geometry.dispose();(w.outline.material as T.Material).dispose();w.outline=null;}
      const object=w.built?.meshes.get(latest.current.selected??"");
      if(object&&!latest.current.showcase){if(!object.userData.fixedMount)transform.attach(object);else transform.detach();w.outline=new T.BoxHelper(object,"#a1ebce");stage.scene.add(w.outline);}else transform.detach();invalidate();
    };
    const w:Runtime={renderer,stage,camera,orbit,transform,content,built:null,school:null,outline:null,drag:null,flow:null,clock,quality,objects:[],contentKey:"",organismKey:"",lightingKey:"",assetAbort:null,invalidate,setView,zoom,takeControl,select,present:()=>{if(controls.current.reduced){setView("perspective");return;}introStart=clock.time;setPresenting(true);setPaused(false);orbit.enabled=false;clock.suspend();invalidate();}};runtime.current=w;
    function draw(timestamp:number){
      frameId=0;if(!awake()){clock.suspend();lastDraw=null;return;}
      const visual=resolveVisualProfile(latest.current.scene.visual),playing=visual.motion&&!controls.current.paused&&!controls.current.reduced&&!latest.current.showcase;
      const touring=introStart!==null&&!controls.current.paused&&!controls.current.reduced;
      const dt=clock.tick(timestamp,playing||touring);
      const orbitChanged=orbit.update();keepCameraAboveTank(camera,orbit);
      if(touring&&introStart!==null){const progress=(clock.time-introStart)/8;pose(presentationCameraPose(latest.current.scene,camera.aspect,progress));if(progress>=1)takeControl();}
      if(w.flow&&w.built?.water&&dt>0&&playing&&w.flow.advance(dt))w.built.effects.syncWaterFlow(w.flow);
      w.built?.effects.setTime(clock.time);w.school?.update(clock.time);w.outline?.update();
      if(dirty||playing||orbitChanged||settleFrames>0||touring){
        const continuous=playing||touring||orbitChanged;if(lastDraw!==null&&continuous){const ms=timestamp-lastDraw;if(ms>0&&ms<250)samples.push(ms);if(samples.length>180)samples.shift();}lastDraw=continuous?timestamp:null;
        renderer.render(stage.scene,camera);dirty=false;settleFrames=Math.max(0,settleFrames-1);
        if(timestamp-statsAt>1000||!continuous){statsAt=timestamp;const stats=frameStatistics(samples);if(samples.length>=120&&visual.quality==="auto"&&timestamp-lastQualityChange>15000){const next=resolveRenderQuality({preference:"auto",previous:w.quality.tier,p95FrameMs:stats.p95,viewport:{width:container.clientWidth,height:container.clientHeight,devicePixelRatio:window.devicePixelRatio}});if(next.tier!==w.quality.tier){lastQualityChange=timestamp;samples.length=0;setPerformanceSample(stats.p95);}}setMetrics({...stats,textureMiB:estimatedTextureMiB(stage.scene),p95:stats.p95,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,tier:w.quality.tier,fish:w.school?.diagnostic.visible??0,requested:w.school?.diagnostic.requested??0,phase:clock.time,state:playing?"Playing":controls.current.reduced?"Reduced motion":"Still"});}
      }
      if(playing||touring||orbitChanged||settleFrames>0)invalidate();else clock.suspend();
    }
    const changed=()=>{settleFrames=3;invalidate();};orbit.addEventListener("change",changed);orbit.addEventListener("start",takeControl);
    transform.addEventListener("change",changed);
    transform.addEventListener("dragging-changed",event=>{orbit.enabled=!event.value;latest.current.onTransforming?.(!!event.value);changed();});
    transform.addEventListener("mouseDown",()=>{const object=transform.object;if(object)w.drag={id:object.userData.objectId,base:latest.current.scene.revision};});
    transform.addEventListener("mouseUp",()=>{const drag=w.drag;w.drag=null;orbit.enabled=true;const object=transform.object;if(drag&&object)latest.current.onTransform(drag.id,object.position.toArray(),[object.rotation.x,object.rotation.y,object.rotation.z],drag.base);});
    const ray=new T.Raycaster(),pointer=new T.Vector2();let down=[0,0],gizmoDown=false;
    const pointerDown=(event:PointerEvent)=>{takeControl();down=[event.clientX,event.clientY];gizmoDown=!!transform.axis;};
    const pointerUp=(event:PointerEvent)=>{if(gizmoDown||Math.hypot(event.clientX-down[0],event.clientY-down[1])>5||latest.current.showcase)return;const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects([...(w.built?.meshes.values()??[])],true)[0];let object:T.Object3D|null=hit?.object??null;while(object&&!object.userData.objectId)object=object.parent;latest.current.onSelect(object?.userData.objectId??null);};
    const keyboard=(event:KeyboardEvent)=>{if(event.altKey||event.ctrlKey||event.metaKey)return;if(["+","="].includes(event.key))zoom(.86);else if(["-","_"].includes(event.key))zoom(1.16);else if(["0","Home"].includes(event.key))setView("perspective");else if(event.key.startsWith("Arrow")){takeControl();const spherical=new T.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));if(event.key==="ArrowLeft")spherical.theta-=.12;if(event.key==="ArrowRight")spherical.theta+=.12;if(event.key==="ArrowUp")spherical.phi-=.09;if(event.key==="ArrowDown")spherical.phi+=.09;spherical.phi=T.MathUtils.clamp(spherical.phi,orbit.minPolarAngle,orbit.maxPolarAngle);camera.position.copy(orbit.target).add(new T.Vector3().setFromSpherical(spherical));orbit.update();invalidate();}else return;event.preventDefault();event.stopPropagation();};
    canvas.addEventListener("pointerdown",pointerDown);canvas.addEventListener("pointerup",pointerUp);canvas.addEventListener("keydown",keyboard);
    const resize=()=>{const width=container.clientWidth,height=container.clientHeight;if(width&&height){camera.aspect=width/height;camera.updateProjectionMatrix();if(!latest.current.showcase)pose(tankCameraPose(latest.current.scene,camera.aspect,framedView));renderer.setSize(width,height,false);setQualityRevision(n=>n+1);invalidate();}};
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;clock.suspend();if(visible)invalidate();else if(frameId){cancelAnimationFrame(frameId);frameId=0;}},{threshold:0});intersection.observe(container);
    const visibility=()=>{clock.suspend();lastDraw=null;if(document.hidden&&frameId){cancelAnimationFrame(frameId);frameId=0;}else invalidate();};document.addEventListener("visibilitychange",visibility);
    const reducedChange=()=>{const reduce=motionQuery.matches||latest.current.motionPreference==="reduced";controls.current.reduced=reduce;setReduced(reduce);if(reduce){takeControl();setView("perspective");}clock.suspend();invalidate();};motionQuery.addEventListener("change",reducedChange);
    const lost=(event:Event)=>{event.preventDefault();lostContext=true;setContextLost(true);announce("Graphics paused. Your edits are safe; restore the 3D view to continue.");if(frameId)cancelAnimationFrame(frameId);frameId=0;};
    canvas.addEventListener("webglcontextlost",lost);renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{console.error("Fishy shader compilation",gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment));announce("A visual effect could not compile. Choose Lightweight rendering or restore the view.");};
    queueMicrotask(()=>{if(!disposed){setContextLost(false);setView("perspective");setMessage("");}});
    return()=>{disposed=true;w.assetAbort?.abort();cancelAnimationFrame(frameId);observer.disconnect();intersection.disconnect();document.removeEventListener("visibilitychange",visibility);motionQuery.removeEventListener("change",reducedChange);canvas.removeEventListener("pointerdown",pointerDown);canvas.removeEventListener("pointerup",pointerUp);canvas.removeEventListener("keydown",keyboard);canvas.removeEventListener("webglcontextlost",lost);orbit.removeEventListener("change",changed);orbit.removeEventListener("start",takeControl);orbit.dispose();transform.dispose();w.built?.effects.dispose();w.school?.dispose();if(w.outline){w.outline.geometry.dispose();(w.outline.material as T.Material).dispose();}disposeObject(content);void releaseFidelityAssetCache();stage.dispose();renderer.dispose();renderer.forceContextLoss();container.replaceChildren();runtime.current=null;};
  },[announce,contextVersion]);

  useEffect(()=>{
    const w=runtime.current;if(!w)return;const visual=resolveVisualProfile(props.scene.visual),nextQuality=resolveRenderQuality({preference:visual.quality,previous:w.quality.tier,p95FrameMs:performanceSample,viewport:{width:host.current?.clientWidth??1024,height:host.current?.clientHeight??768,devicePixelRatio:window.devicePixelRatio}});
    if(w.quality.tier!==nextQuality.tier)w.stage.setRenderQuality(nextQuality);w.quality=nextQuality;w.renderer.setPixelRatio(Math.min(window.devicePixelRatio,nextQuality.pixelRatioCap));
    const key=JSON.stringify([props.scene.tank,props.scene.substrate,props.scene.substrateCatalogId,props.scene.equipment,props.water,props.showcase,nextQuality.tier,visual.waterLevel,visual.cascade,visual.cascade?props.scene.objects.filter(object=>object.kind==="rock"):null]);
    const organismKey=JSON.stringify([props.scene.tank,props.scene.substrate,props.scene.objects,visual.organisms,props.showcase,visual.waterLevel]);
    const lightingKey=JSON.stringify([props.scene.tank,props.scene.equipment,nextQuality.tier]);
    if(w.lightingKey!==lightingKey){w.stage.applyLighting(props.scene);w.lightingKey=lightingKey;}
    if(w.contentKey!==key){
      w.objects=props.scene.objects;w.contentKey=key;w.assetAbort?.abort();const controller=new AbortController(),previousFlow=w.flow;w.assetAbort=controller;w.transform.detach();w.drag=null;w.orbit.enabled=true;w.built?.effects.dispose();disposeObject(w.content);w.content.clear();w.built=null;w.flow=null;
      if(props.showcase){announce("Loading original aquarium…");new GLTFLoader().load(`/showcase/${props.showcase}.glb`,g=>{if(controller.signal.aborted){disposeObject(g.scene);return;}g.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});w.content.add(g.scene);w.setView("perspective");announce("");w.invalidate();},undefined,()=>{if(!controller.signal.aborted)announce("The original could not load. Choose another view or check your connection.");});}
      else{
        const built=populateAquarium(w.content,props.scene,props.water,{quality:nextQuality});w.built=built;
        if(built.water){const geometry=built.water.geometry as T.PlaneGeometry,p=geometry.parameters;w.flow=waterFlowForSurface(previousFlow,{columns:p.widthSegments+1,rows:p.heightSegments+1,width:p.width,depth:p.height},filterFlowSources(props.scene));built.effects.syncWaterFlow(w.flow);}
        queueMicrotask(()=>setAssetStatus(""));
        const assetStarted=performance.now();void enhanceAquariumAssets(w.content,props.scene,built.meshes,controller.signal).then(()=>{if(controller.signal.aborted)return;setAssetLoadMs(performance.now()-assetStarted);built.effects.refreshPlants();built.effects.setTime(w.clock.time);w.select();w.invalidate();}).catch(()=>{if(!controller.signal.aborted){setAssetStatus("Detailed assets unavailable · editable models retained");w.invalidate();}});
        announce("");
      }
      w.select();
    }else if(!props.showcase&&w.built&&JSON.stringify(w.objects)!==JSON.stringify(props.scene.objects)){
      w.assetAbort?.abort();const controller=new AbortController();w.assetAbort=controller;w.transform.detach();
      const pending=syncSceneObjects(w.content,w.built.meshes,w.objects,props.scene.objects);w.objects=props.scene.objects;
      const built=w.built;built.effects.refreshPlants();w.select();
      void enhanceAquariumAssets(w.content,{...props.scene,objects:pending},built.meshes,controller.signal).then(()=>{if(controller.signal.aborted)return;built.effects.refreshPlants();built.effects.setTime(w.clock.time);w.select();setAssetStatus("");w.invalidate();}).catch(()=>{if(!controller.signal.aborted)setAssetStatus("Detailed assets unavailable · editable models retained");});
    }
    w.built?.effects.setProfile(visual);w.built?.effects.setTime(w.clock.time);
    if(w.organismKey!==organismKey){w.school?.group.removeFromParent();w.school?.dispose();w.school=props.showcase?null:createOrganismSystem(props.scene);if(w.school){const school=w.school;w.stage.scene.add(school.group);school.update(w.clock.time);void school.ready.then(()=>{if(runtime.current===w&&w.school===school)w.invalidate();});}w.organismKey=organismKey;}
    w.clock.suspend();w.invalidate();
  },[props.scene,props.water,props.showcase,announce,contextVersion,qualityRevision,performanceSample]);
  useEffect(()=>{runtime.current?.select();},[props.selected,props.showcase]);
  useEffect(()=>{runtime.current?.transform.setMode(props.mode);},[props.mode]);
  useEffect(()=>{const w=runtime.current;if(!w)return;w.drag=null;w.transform.reset();w.transform.dragging=false;w.transform.axis=null;const object=w.transform.object,canonical=latest.current.scene.objects.find(o=>o.id===object?.userData.objectId);if(object&&canonical){object.position.fromArray(canonical.position);object.rotation.set(...canonical.rotation);object.scale.set(...(canonical.stretch??[1,1,1])).multiplyScalar(canonical.size);}w.orbit.enabled=true;w.invalidate();},[props.cancel]);
  useEffect(()=>{runtime.current?.setView("perspective");},[props.frame,props.scene.tank.width,props.scene.tank.depth,props.scene.tank.height]);
  useEffect(()=>{const w=runtime.current;if(w){w.clock.suspend();w.invalidate();}},[paused,reduced,props.active,props.scene.visual?.motion]);
  useEffect(()=>{const reduce=props.motionPreference==="reduced"||window.matchMedia("(prefers-reduced-motion: reduce)").matches;controls.current.reduced=reduce;queueMicrotask(()=>setReduced(reduce));if(reduce){runtime.current?.takeControl();runtime.current?.setView("perspective");}runtime.current?.clock.suspend();runtime.current?.invalidate();},[props.motionPreference]);
  const roomPhoto=props.background?.mode==="room"?props.background.photo:null;
  useEffect(()=>{const w=runtime.current;if(w){w.stage.scene.background=roomPhoto?null:new T.Color(BACKGROUNDS.find(b=>b.id===props.background?.mode)?.color??"#111d21");w.invalidate();}},[props.background?.mode,roomPhoto,contextVersion]);
  const motion=resolveVisualProfile(props.scene.visual).motion,still=paused||reduced||!motion;
  return <div className="stage" aria-label={props.showcase?"Original aquarium showcase":"Editable aquarium"}>
    {roomPhoto&&<img className="room-backdrop" src={roomPhoto.url} alt="" aria-hidden="true" style={{objectPosition:`${props.background!.x}% ${props.background!.y}%`,transform:`scale(${props.background!.zoom/100})`,transformOrigin:`${props.background!.x}% ${props.background!.y}%`}}/>}
    <div ref={host} className="canvas-host"/>
    {message&&<div className="viewport-status" role="status">{message}{contextLost&&<button onClick={()=>setContextVersion(n=>n+1)}>Restore 3D view</button>}</div>}
    {assetStatus&&<span className="sr-only" role="status">{assetStatus}</span>}
    {presenting&&<div className="presentation-controls"><span>A closer look · 8 seconds</span><button onClick={()=>setPaused(value=>!value)}>{paused?"Resume":"Pause"}</button><button onClick={()=>runtime.current?.takeControl()}>Take control</button></div>}
    <div className="viewport-controls">
      <div className="camera-controls" role="group" aria-label="Camera and motion controls">
        <select aria-label="Camera view" value={view} onChange={event=>runtime.current?.setView(event.target.value as CameraView)}>{CAMERA_VIEWS.map(name=><option key={name} value={name}>{name[0].toUpperCase()+name.slice(1)}</option>)}</select>
        <button aria-label="Zoom out" onClick={()=>runtime.current?.zoom(1.16)}>−</button><button aria-label="Zoom in" onClick={()=>runtime.current?.zoom(.86)}>+</button>
        {!props.showcase&&<button aria-label={still?"Play aquarium motion":"Pause aquarium motion"} disabled={reduced} title={reduced?"Reduced motion is enabled in your device settings":undefined} onClick={()=>{if(!motion&&props.onMotionChange)props.onMotionChange(true);setPaused(!still);}}>{reduced?"Still":still?"Play":"Pause"}</button>}
        {!props.showcase&&<button aria-label="Play camera presentation" disabled={reduced} onClick={()=>runtime.current?.present()}>Tour</button>}
      </div>
      <details className="render-diagnostics"><summary>{metrics.tier==="low"?"Lightweight":"Detailed"} · {still?"Still":metrics.fps?`${Math.round(metrics.fps)} fps`:"Live"}</summary>
        <dl><dt>Frame p95</dt><dd data-metric="frame-p95">{metrics.p95.toFixed(1)} ms</dd><dt>Draw calls</dt><dd data-metric="draw-calls">{metrics.calls}</dd><dt>Triangles</dt><dd>{metrics.triangles.toLocaleString()}</dd><dt>Textures / geometry</dt><dd>{metrics.textures} / {metrics.geometries}</dd><dt>Texture estimate</dt><dd>{metrics.textureMiB.toFixed(1)} MiB</dd><dt>Asset hydration</dt><dd>{assetLoadMs===null?"—":`${Math.round(assetLoadMs)} ms`}</dd><dt>Fish visible</dt><dd>{metrics.fish} / {metrics.requested}</dd><dt>Animation phase</dt><dd data-metric="phase">{metrics.phase.toFixed(2)} s</dd></dl>
        {props.diagnosticsLab&&<button onClick={()=>runtime.current?.renderer.forceContextLoss()}>Test graphics recovery</button>}
      </details>
    </div>
  </div>;
}
