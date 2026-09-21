import * as T from "three";
import {plantDepthMaterial,plantDistanceMaterial,plantMotionState,setPlantMotion,wrapPlantMaterial,type PlantMotionState} from "./surface-materials.ts";
import type {RenderQuality} from "./render-quality.ts";
import {filterFlowSources} from "./equipment.ts";
import type {SceneRecord} from "./scene.ts";
import type {WaterFlow} from "./water-flow.ts";
import {Reflector} from "three/examples/jsm/objects/Reflector.js";

type VisualSettings={motion?:boolean;clarity?:number;plantMotion?:number;quality?:string};
type VisualRecord=Pick<SceneRecord,"visual"|"revision"|"equipment"|"tank">;
type WaterState={time:{value:number};clarity:{value:number};shimmer:{value:number}};
type PoweredFlowState={time:{value:number};powered:{value:number}};

export type AquariumEffects={
  setTime:(time:number)=>void;
  update:(delta:number)=>void;
  setPaused:(paused:boolean)=>void;
  setProfile:(settings:Partial<VisualSettings>)=>void;
  /** Copies the solved height field into the rendered surface and its normals. */
  syncWaterFlow:(flow:WaterFlow)=>boolean;
  refreshPlants:()=>void;
  dispose:()=>void;
};

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const visualOf=(record:VisualRecord):VisualSettings=>record.visual??{};

function waterState(material:T.Material):WaterState|undefined {
  return (material.userData as {fishyWaterState?:WaterState}).fishyWaterState;
}

function filterFlowMaterial(source:T.Material,powered:boolean) {
  const state:PoweredFlowState={time:{value:0},powered:{value:powered?1:0}};
  const color=(source as T.MeshStandardMaterial).color?.clone()??new T.Color("#b9ded7");
  const baseOpacity=Math.max(.01,(source as T.MeshStandardMaterial).opacity??.2);
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:state.time,powered:state.powered,color:{value:color},baseOpacity:{value:baseOpacity}},
    vertexShader:`varying vec2 vFlowUv;void main(){vFlowUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float time;uniform float powered;uniform vec3 color;uniform float baseOpacity;varying vec2 vFlowUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
      void main(){float edge=smoothstep(0.,.13,vFlowUv.x)*smoothstep(0.,.13,1.-vFlowUv.x);float streak=noise2(vec2(vFlowUv.x*19.,vFlowUv.y*31.-time*7.));float thread=smoothstep(.40,.76,streak);float alpha=powered*baseOpacity*edge*(.20+.80*thread);gl_FragColor=vec4(color+vec3(.10,.16,.15)*thread,alpha);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`
  });
  material.forceSinglePass=true;material.userData.fishyFilterFlowState=state;
  return material;
}

function filterFlowState(material:T.Material):PoweredFlowState|undefined {
  return (material.userData as {fishyFilterFlowState?:PoweredFlowState}).fishyFilterFlowState;
}

/** One bounded planar reflection pass; all ripples use the aquarium's clock. */
export function reflectiveWater(geometry:T.PlaneGeometry,quality:RenderQuality,clarity=.72):T.Mesh {
  if(quality.tier==="low")return new T.Mesh(geometry,waterSurfaceMaterial(quality,clarity));
  const state:WaterState={time:{value:0},clarity:{value:clarity},shimmer:{value:1}};
  const water=new Reflector(geometry,{textureWidth:quality.reflectionResolution,textureHeight:quality.reflectionResolution,multisample:4,clipBias:.0003,shader:{
    name:"Fishy planar water",uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},time:state.time,clarity:state.clarity,shimmer:state.shimmer},
    vertexShader:`uniform mat4 textureMatrix;varying vec4 vProject;varying vec2 vLocal;varying vec3 vWorldNormal;varying vec3 vWorldPosition;void main(){vec4 world=modelMatrix*vec4(position,1.);vWorldPosition=world.xyz;vWorldNormal=normalize(mat3(modelMatrix)*normal);vProject=textureMatrix*vec4(position,1.);vLocal=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D tDiffuse;uniform float time;uniform float clarity;uniform float shimmer;varying vec4 vProject;varying vec2 vLocal;varying vec3 vWorldNormal;varying vec3 vWorldPosition;void main(){vec3 normal=normalize(vWorldNormal);vec3 view=normalize(cameraPosition-vWorldPosition);float fresnel=pow(1.-abs(dot(view,normal)),4.);vec4 p=vProject;vec2 surfaceSlope=vec2(normal.x,normal.z);vec2 micro=vec2(sin(vLocal.y*95.+time*1.3)+sin(vLocal.x*147.-time),cos(vLocal.x*103.+time*.9))*0.00012*shimmer;p.xy+=(surfaceSlope*.022+micro)*p.w;vec3 reflection=texture2DProj(tDiffuse,p).rgb;vec3 tint=mix(vec3(.05,.16,.12),vec3(.17,.31,.24),clarity);vec3 reflected=reflect(-view,normal);float softbox=exp(-pow((reflected.z+.70)/.10,2.))*smoothstep(.1,.6,reflected.y)*(1.-smoothstep(.7,.95,abs(reflected.x)));float edgeDistance=min(min(vLocal.x,1.-vLocal.x),min(vLocal.y,1.-vLocal.y));float edgeFade=smoothstep(0.,.055,edgeDistance);gl_FragColor=vec4(mix(reflection,tint,.11)+vec3(.75,.85,.83)*softbox*.45,(.10+fresnel*.70+softbox*.12)*edgeFade);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`
  }});
  const mat=water.material as T.ShaderMaterial;
  // Reflector clones uniforms; bind our shared clock after its construction.
  mat.uniforms.time=state.time;mat.uniforms.clarity=state.clarity;mat.uniforms.shimmer=state.shimmer;
  mat.transparent=true;mat.depthWrite=false;mat.side=T.DoubleSide;mat.forceSinglePass=true;
  mat.userData.fishyWaterState=state;mat.userData.fishyWaterContract={flowNormals:true,fresnel:true,depthTint:true,reflections:"planar",opaque:false};
  // Exclude the coincident water-volume lid and waterline from the mirror
  // pass. Reflecting these transparent surfaces creates a repeating clip-edge
  // pattern even when the solved height field is perfectly calm.
  const renderReflection=water.onBeforeRender;
  water.onBeforeRender=function(renderer,scene,camera,geometry,material,group){
    const hidden:T.Object3D[]=[];
    scene.traverse(object=>{
      if(object.visible&&(object.userData.excludeFromWaterReflection||object.name==="Aquarium glass and waterline"||(object instanceof T.Mesh&&!Array.isArray(object.material)&&object.material.userData.fishyWaterVolume))){hidden.push(object);object.visible=false;}
    });
    try{renderReflection.call(this,renderer,scene,camera,geometry,material,group);}
    finally{for(const object of hidden)object.visible=true;}
  };
  water.userData.fishyDispose=()=>water.dispose();
  return water;
}

/**
 * The CPU flow owns displacement and normals. This material adds restrained
 * view-angle reflection, depth tint, and moving highlights without opaque water.
 */
export function waterSurfaceMaterial(quality:RenderQuality,clarity=.72) {
  const state:WaterState={time:{value:0},clarity:{value:clamp(clarity,0,1)},shimmer:{value:quality.waterShimmer?1:0}};
  const material=new T.MeshPhysicalMaterial({
    color:"#75b9ad",roughness:.1,metalness:0,transparent:true,opacity:.13,
    transmission:quality.tier==="high"?.035:0,thickness:.006,ior:1.333,clearcoat:.42,clearcoatRoughness:.11,
    side:T.DoubleSide,depthWrite:false,envMapIntensity:.55,
  });
  material.forceSinglePass=true;
  (material.userData as {fishyWaterState:WaterState;fishyWaterContract:unknown}).fishyWaterState=state;
  material.userData.fishyWaterContract={flowNormals:true,fresnel:true,depthTint:true,reflections:"environment",opaque:false};
  material.customProgramCacheKey=()=>"fishy-water-v3-"+quality.tier;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uFishyWaterTime=state.time;shader.uniforms.uFishyWaterClarity=state.clarity;shader.uniforms.uFishyWaterShimmer=state.shimmer;
    shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nvarying vec2 vFishyWaterUv;")
      .replace("#include <begin_vertex>","#include <begin_vertex>\nvFishyWaterUv=uv;");
    shader.fragmentShader=shader.fragmentShader.replace("#include <common>","#include <common>\nvarying vec2 vFishyWaterUv;\nuniform float uFishyWaterTime; uniform float uFishyWaterClarity; uniform float uFishyWaterShimmer;")
      .replace("#include <normal_fragment_maps>","#include <normal_fragment_maps>\nfloat fishyMicroA=sin(vFishyWaterUv.x*112.0+uFishyWaterTime*2.1)*.5+sin(vFishyWaterUv.y*79.0-uFishyWaterTime*1.4)*.5;\nfloat fishyMicroB=cos(vFishyWaterUv.y*97.0+uFishyWaterTime*1.7)*.5;\nvec3 fishyTangent=normalize(dFdx(vViewPosition)); vec3 fishyBitangent=normalize(dFdy(vViewPosition));\nnormal=normalize(normal+(fishyTangent*fishyMicroA+fishyBitangent*fishyMicroB)*.035*uFishyWaterShimmer);\nfloat fishyFresnel=pow(1.0-clamp(abs(dot(normalize(vViewPosition),normal)),0.0,1.0),3.0);\nfloat fishyDepth=clamp(vFishyWaterUv.y*.78+.12,0.0,1.0);\nfloat fishyGlint=(sin(vFishyWaterUv.x*86.0+uFishyWaterTime*2.1)*sin(vFishyWaterUv.y*71.0-uFishyWaterTime*1.4)*.5+.5)*uFishyWaterShimmer;\nvec3 fishyDeep=mix(vec3(.055,.22,.22),vec3(.16,.46,.40),uFishyWaterClarity);\ndiffuseColor.rgb=mix(diffuseColor.rgb,fishyDeep,fishyDepth*.36);\ndiffuseColor.rgb+=vec3(.10,.18,.17)*(fishyFresnel*.45+fishyGlint*.035);");
  };
  return material;
}

/** Thin glass planes and a bright waterline establish the tank boundary without a foggy box. */
export function aquariumGlass(width:number,height:number,depth:number,waterHeight:number,quality:RenderQuality) {
  const group=new T.Group();group.name="Aquarium glass and waterline";
  const glass=new T.MeshPhysicalMaterial({color:"#b6e1db",roughness:.06,metalness:0,transparent:true,opacity:.055,transmission:quality.tier==="high"?.045:0,thickness:.003,ior:1.45,side:T.DoubleSide,depthWrite:false,envMapIntensity:.45});
  glass.forceSinglePass=true;
  const panes=[
    [width,height,0,0,height/2,depth/2],
    [depth,height,Math.PI/2,width/2,height/2,0],
    [depth,height,Math.PI/2,-width/2,height/2,0],
  ] as const;
  for(const [paneWidth,paneHeight,rotation,x,y,z] of panes){const pane=new T.Mesh(new T.PlaneGeometry(paneWidth,paneHeight),glass);pane.rotation.y=rotation;pane.position.set(x,y,z);pane.renderOrder=5;group.add(pane);}
  const points=[[-width/2,waterHeight,-depth/2],[width/2,waterHeight,-depth/2],[width/2,waterHeight,depth/2],[-width/2,waterHeight,depth/2]].map(point=>new T.Vector3(...point));
  const line=new T.LineLoop(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:"#c5f4df",transparent:true,opacity:.48,depthWrite:false}));line.renderOrder=6;group.add(line);
  return group;
}

function seedPhase(seed:number,index:number) {
  const value=Math.sin((seed+index*17.13)*12.9898)*43758.5453;
  return (value-Math.floor(value))*Math.PI*2;
}

function flowDirection(record:VisualRecord):[number,number] {
  // The effect only needs the tank/equipment subset, while the shared utility
  // intentionally validates a complete persisted record.
  const sources=filterFlowSources(record as SceneRecord);let x=0,z=0,total=0;
  for(const source of sources){x+=source.direction[0]*source.strength;z+=source.direction[1]*source.strength;total+=source.strength;}
  return total>.0001?[x/total,z/total]:[.55,.4];
}

function plantRoot(mesh:T.Mesh,content:T.Object3D) {
  let root:T.Object3D=mesh;
  while(root.parent&&root.parent!==content)root=root.parent;
  return root;
}

function attachPlantMotion(content:T.Object3D,strength:number,seed:number,budget:number,flow:[number,number]) {
  content.updateWorldMatrix(true,true);
  const states:PlantMotionState[]=[],depthMaterials:T.Material[]=[],meshes:T.Mesh[]=[];let index=0;
  const boundsByRoot=new Map<T.Object3D,T.Box3>();
  const motionByRoot=new Map<T.Object3D,{phase:number;stiffness:number}>();
  content.traverse(object=>{
    if(!(object instanceof T.Mesh)||meshes.length>=budget)return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    if(object.userData.fishyPlant)for(const material of materials)wrapPlantMaterial(material);
    const state=materials.map(plantMotionState).find((candidate):candidate is PlantMotionState=>!!candidate);
    if(!state)return;
    const root=plantRoot(object,content),bounds=boundsByRoot.get(root)??new T.Box3().setFromObject(root);
    let motion=motionByRoot.get(root);
    if(!motion){motion={phase:seedPhase(seed,index++),stiffness:.72+(index%5)*.13};motionByRoot.set(root,motion);}
    const {phase,stiffness}=motion;
    boundsByRoot.set(root,bounds);
    for(const material of materials)setPlantMotion(material,{strength,phase,stiffness,flow,rootY:bounds.min.y,height:bounds.max.y-bounds.min.y});
    // Authored leaves and their attached stems can use different materials.
    // Each shader owns uniforms, so advance every one on the same clock.
    for(const material of materials){const materialState=plantMotionState(material);if(materialState&&!states.includes(materialState))states.push(materialState);}
    const source=materials[0];
    if(!object.customDepthMaterial){const depth=plantDepthMaterial(source,state);object.customDepthMaterial=depth;depthMaterials.push(depth);}
    if(!object.customDistanceMaterial){const distance=plantDistanceMaterial(state,source);object.customDistanceMaterial=distance;depthMaterials.push(distance);}
    meshes.push(object);
  });
  return {states,depthMaterials,meshes};
}

export function createAquariumEffects(content:T.Object3D,water:T.Mesh|null,record:VisualRecord,quality:RenderQuality):AquariumEffects {
  let time=0,paused=false,settings=visualOf(record),plantStrength=clamp(settings.motion===false?0:settings.plantMotion??.5,0,1);
  const waterMaterial=water?(Array.isArray(water.material)?water.material[0]:water.material):null;
  const waterUniforms=waterMaterial?waterState(waterMaterial):undefined;
  const cascadeClocks=new Set<T.IUniform<number>>();
  const filterFlowClocks=new Set<T.IUniform<number>>();
  const waterVolumes:T.Material[]=[];
  content.traverse(node=>{if(node instanceof T.Mesh)for(const material of Array.isArray(node.material)?node.material:[node.material])if(material.userData.fishyWaterVolume)waterVolumes.push(material);});
  content.traverse(node=>{if(node instanceof T.Mesh||node instanceof T.Points)for(const material of Array.isArray(node.material)?node.material:[node.material])if(material.userData.fishyCascadeTime)cascadeClocks.add(material.userData.fishyCascadeTime);});
  content.traverse(node=>{
    if(!(node instanceof T.Mesh)||node.name!=="Filter powered flow")return;
    const powered=node.userData.powered===true,materials=Array.isArray(node.material)?node.material:[node.material];
    const animated=materials.map(material=>{const replacement=filterFlowMaterial(material,powered);material.dispose();return replacement;});
    node.material=Array.isArray(node.material)?animated:animated[0];
    for(const material of animated){const state=filterFlowState(material);if(state)filterFlowClocks.add(state.time);}
  });
  const plantFlow=flowDirection(record);
  let plants=attachPlantMotion(content,plantStrength,record.revision??1,quality.plantSwayBudget,plantFlow);
  const setTime=(next:number)=>{
    time=Math.max(0,Number.isFinite(next)?next:time);
    if(waterUniforms)waterUniforms.time.value=time;
    for(const clock of cascadeClocks)clock.value=time;
    for(const clock of filterFlowClocks)clock.value=time;
    for(const state of plants.states)state.time.value=time;
  };
  const setProfile=(next:Partial<VisualSettings>)=>{
    settings={...settings,...next};
    plantStrength=clamp(settings.motion===false?0:settings.plantMotion??.5,0,1);
    if(waterUniforms){waterUniforms.clarity.value=clamp(settings.clarity??.72,0,1);waterUniforms.shimmer.value=quality.waterShimmer&&settings.motion!==false?1:0;}
    for(const material of waterVolumes)material.opacity=.045+(1-clamp(settings.clarity??.72,0,1))*.065;
    for(const state of plants.states)state.strength.value=plantStrength;
  };
  const refreshPlants=()=>{
    for(const mesh of plants.meshes){
      if(mesh.customDepthMaterial&&plants.depthMaterials.includes(mesh.customDepthMaterial))mesh.customDepthMaterial=undefined;
      if(mesh.customDistanceMaterial&&plants.depthMaterials.includes(mesh.customDistanceMaterial))mesh.customDistanceMaterial=undefined;
    }
    for(const material of plants.depthMaterials)material.dispose();
    plants=attachPlantMotion(content,plantStrength,record.revision??1,quality.plantSwayBudget,plantFlow);
    setTime(time);
  };
  const syncWaterFlow=(flow:WaterFlow)=>{
    if(!water)return false;
    const positions=water.geometry.getAttribute("position") as T.BufferAttribute|undefined;
    if(!positions||positions.count!==flow.heights.length)return false;
    for(let index=0;index<positions.count;index++)positions.setZ(index,flow.heights[index]);
    positions.needsUpdate=true;
    water.geometry.computeVertexNormals();
    const normals=water.geometry.getAttribute("normal");
    if(normals)normals.needsUpdate=true;
    return true;
  };
  setProfile({});
  return {
    setTime,
    update:delta=>{if(!paused)setTime(time+Math.max(0,Math.min(delta,.1)));},
    setPaused:value=>{paused=value;},
    setProfile,
    syncWaterFlow,
    refreshPlants,
    dispose:()=>{for(const material of plants.depthMaterials)material.dispose();water?.userData.fishyDispose?.();},
  };
}
