import * as T from "three";

export type SurfaceKind = "wood" | "rock" | "plant" | "sand";

export type PlantMotionState={time:{value:number};strength:{value:number};phase:{value:number};stiffness:{value:number};rootY:{value:number};height:{value:number};flow:{value:T.Vector2}};
type SurfaceMaterialData={fishyPlantMotion?:PlantMotionState};
type ShaderLike={uniforms:Record<string,unknown>;vertexShader:string};

function materialData(material:T.Material) { return material.userData as SurfaceMaterialData; }

/** Shared uniform objects let the visible and depth passes consume identical plant motion. */
export function plantMotionState(material:T.Material):PlantMotionState|undefined { return materialData(material).fishyPlantMotion; }

function plantVertexMotion(shader:ShaderLike,state:PlantMotionState) {
  shader.uniforms.uFishyPlantTime=state.time;shader.uniforms.uFishyPlantMotion=state.strength;shader.uniforms.uFishyPlantPhase=state.phase;shader.uniforms.uFishyPlantStiffness=state.stiffness;shader.uniforms.uFishyPlantRootY=state.rootY;shader.uniforms.uFishyPlantHeight=state.height;shader.uniforms.uFishyPlantFlow=state.flow;
  shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nuniform float uFishyPlantTime; uniform float uFishyPlantMotion; uniform float uFishyPlantPhase; uniform float uFishyPlantStiffness; uniform float uFishyPlantRootY; uniform float uFishyPlantHeight; uniform vec2 uFishyPlantFlow;")
    .replace("#include <begin_vertex>","#include <begin_vertex>\nfloat fishyPlantRootWeight=clamp(((modelMatrix*vec4(transformed,1.0)).y-uFishyPlantRootY)/max(uFishyPlantHeight,.01),0.0,1.0);\nfloat fishyPlantBend=sin(uFishyPlantTime*(1.15+uFishyPlantStiffness*.65)+uFishyPlantPhase+position.y*23.0);\nvec2 fishyPlantFlow=normalize(uFishyPlantFlow+vec2(.0001));\nvec3 fishyPlantWorldOffset=vec3(fishyPlantFlow.x*fishyPlantBend,0.0,fishyPlantFlow.y*cos(uFishyPlantTime*.83+uFishyPlantPhase+position.y*17.0))*fishyPlantRootWeight*uFishyPlantMotion*.0028;\ntransformed+=(inverse(modelMatrix)*vec4(fishyPlantWorldOffset,0.0)).xyz;");
}

export function setPlantMotion(material:T.Material,values:{time?:number;strength?:number;phase?:number;stiffness?:number;rootY?:number;height?:number;flow?:readonly[number,number]}) {
  const state=plantMotionState(material);if(!state)return false;
  if(values.time!==undefined)state.time.value=values.time;
  if(values.strength!==undefined)state.strength.value=Math.max(0,Math.min(1,values.strength));
  if(values.phase!==undefined)state.phase.value=values.phase;
  if(values.stiffness!==undefined)state.stiffness.value=Math.max(.15,Math.min(2,values.stiffness));
  if(values.rootY!==undefined)state.rootY.value=values.rootY;
  if(values.height!==undefined)state.height.value=Math.max(.01,values.height);
  if(values.flow!==undefined)state.flow.value.set(values.flow[0],values.flow[1]);
  return true;
}

/** Add Fishy's bounded sway contract to an authored PBR plant material without replacing its maps. */
export function wrapPlantMaterial(material:T.Material) {
  const existing=plantMotionState(material);if(existing)return existing;
  if(!(material instanceof T.MeshStandardMaterial||material instanceof T.MeshPhysicalMaterial))return undefined;
  const state:PlantMotionState={time:{value:0},strength:{value:0},phase:{value:0},stiffness:{value:1},rootY:{value:0},height:{value:.16},flow:{value:new T.Vector2(.55,.4)}};
  materialData(material).fishyPlantMotion=state;
  const original=material.onBeforeCompile,originalKey=material.customProgramCacheKey;
  material.onBeforeCompile=(shader,renderer)=>{original(shader,renderer);plantVertexMotion(shader,state);};
  material.customProgramCacheKey=()=>originalKey.call(material)+"-fishy-plant-sway-v1";
  material.needsUpdate=true;
  return state;
}

export function plantDepthMaterial(source:T.Material,state:PlantMotionState) {
  const visible=source as T.MeshStandardMaterial;
  // Alpha-tested scanned fronds must cast the leaf silhouette, including holes.
  // Maps are borrowed from the visible material and remain owned by that asset.
  const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,alphaTest:visible.alphaTest,map:visible.map,alphaMap:visible.alphaMap,side:visible.side});
  depth.userData.fishyPlantMotion=state;
  depth.customProgramCacheKey=()=>"fishy-plant-depth-sway-v1";
  depth.onBeforeCompile=shader=>{
    plantVertexMotion(shader,state);
  };
  return depth;
}

export function plantDistanceMaterial(state:PlantMotionState,source?:T.Material) {
  const visible=source as T.MeshStandardMaterial|undefined;
  const distance=new T.MeshDistanceMaterial({alphaTest:visible?.alphaTest??0,map:visible?.map??null,alphaMap:visible?.alphaMap??null,side:visible?.side??T.DoubleSide});
  distance.userData.fishyPlantMotion=state;
  distance.customProgramCacheKey=()=>"fishy-plant-distance-sway-v1";
  distance.onBeforeCompile=shader=>{
    plantVertexMotion(shader,state);
  };
  return distance;
}

// Detail is evaluated in object coordinates, so it follows edits without changing
// geometry, bounds, saved colours or protected-object state. No texture downloads.
const noise = /* glsl */`
varying vec3 vSurfacePoint;
varying vec2 vSurfaceUv;
float surfaceHash(vec3 p) {
  p=fract(p*0.1031); p+=dot(p,p.yzx+33.33);
  return fract((p.x+p.y)*p.z);
}
float surfaceNoise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(surfaceHash(i),surfaceHash(i+vec3(1,0,0)),f.x),
    mix(surfaceHash(i+vec3(0,1,0)),surfaceHash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(surfaceHash(i+vec3(0,0,1)),surfaceHash(i+vec3(1,0,1)),f.x),
    mix(surfaceHash(i+vec3(0,1,1)),surfaceHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float surfaceFbm(vec3 p) {
  return .57*surfaceNoise(p)+.28*surfaceNoise(p*2.03)+.15*surfaceNoise(p*4.11);
}
`;

const surfaces:Record<SurfaceKind,string> = {
  wood: /* glsl */`
    vec2 p=vSurfaceUv;
    float warp=surfaceFbm(vec3(p.x*7.0,p.y*11.0,2.0));
    float grain=surfaceFbm(vec3(p.x*17.0,(p.y+warp*.055)*170.0,3.0));
    float ridge=pow(.5+.5*sin(p.y*390.0+warp*17.0),10.0);
    float weather=surfaceFbm(vSurfacePoint*90.0);
    float pores=surfaceNoise(vec3(p.x*180.0,p.y*320.0,5.0));
    vec3 tint=mix(vec3(.37,.30,.24),vec3(1.28,1.13,.87),grain);
    tint=mix(tint,vec3(.73,.77,.74),smoothstep(.57,.84,weather)*.38);
    tint*=1.0-ridge*.36;
    return vec4(tint,grain*.55-ridge*.26+pores*.12);
  `,
  rock: /* glsl */`
    vec3 p=vSurfacePoint;
    float cloud=surfaceFbm(p*95.0);
    float strata=sin(p.y*850.0+p.x*280.0+surfaceFbm(p*140.0)*8.0);
    float vein=smoothstep(.84,.98,strata)*smoothstep(.32,.7,cloud);
    float pores=mix(surfaceNoise(p*1900.0),.5,smoothstep(.5,1.5,length(fwidth(p*1900.0))));
    vec3 tint=mix(vec3(.32,.37,.40),vec3(1.24,1.18,1.05),cloud);
    tint=mix(tint,vec3(1.42,1.34,1.12),vein*.55);
    tint*=mix(.73,1.14,pores);
    return vec4(tint,cloud*.52+vein*.12+pores*.3);
  `,
  plant: /* glsl */`
    vec2 p=vSurfaceUv;
    float mottling=surfaceFbm(vec3(p*24.0,4.0));
    float central=exp(-abs(p.x-.5)*110.0);
    float veins=pow(.5+.5*cos((p.y+abs(p.x-.5)*.68)*100.0),18.0);
    float edge=sin(p.y*3.14159265);
    vec3 tint=mix(vec3(.38,.60,.35),vec3(1.12,1.24,.75),mottling);
    tint*=mix(.68,1.05,edge);
    tint=mix(tint,vec3(1.22,1.32,.78),(central*.32+veins*.12)*edge);
    return vec4(tint,mottling*.12+central*.15+veins*.06);
  `,
  sand: /* glsl */`
    vec3 p=vSurfacePoint;
    float fine=mix(surfaceNoise(p*2400.0),.5,smoothstep(.8,2.5,length(fwidth(p*2400.0))));
    float grains=mix(surfaceNoise(p*700.0),fine,.65);
    float patches=surfaceFbm(p*65.0);
    vec3 tint=mix(vec3(.34,.32,.28),vec3(1.18,1.11,.91),grains);
    tint*=mix(.8,1.1,patches);
    return vec4(tint,grains*.8+patches*.1);
  `,
};

export function surfaceMaterial(kind:SurfaceKind,color:string) {
  const material=new T.MeshStandardMaterial({color,roughness:kind==="plant"?.7:.88,side:T.DoubleSide,vertexColors:kind==="plant"});
  if(kind==="plant")materialData(material).fishyPlantMotion={time:{value:0},strength:{value:0},phase:{value:0},stiffness:{value:1},rootY:{value:0},height:{value:.16},flow:{value:new T.Vector2(.55,.4)}};
  material.customProgramCacheKey=()=>`fishy-surface-v1-${kind}`;
  material.onBeforeCompile=shader=>{
    const motion=plantMotionState(material);
    if(motion){shader.uniforms.uFishyPlantTime=motion.time;shader.uniforms.uFishyPlantMotion=motion.strength;shader.uniforms.uFishyPlantPhase=motion.phase;shader.uniforms.uFishyPlantStiffness=motion.stiffness;shader.uniforms.uFishyPlantRootY=motion.rootY;shader.uniforms.uFishyPlantHeight=motion.height;shader.uniforms.uFishyPlantFlow=motion.flow;}
    shader.vertexShader=shader.vertexShader.replace("#include <common>",`#include <common>\nvarying vec3 vSurfacePoint;\nvarying vec2 vSurfaceUv;${motion?"\nuniform float uFishyPlantTime; uniform float uFishyPlantMotion; uniform float uFishyPlantPhase; uniform float uFishyPlantStiffness; uniform float uFishyPlantRootY; uniform float uFishyPlantHeight; uniform vec2 uFishyPlantFlow;":""}`)
      .replace("#include <begin_vertex>",`#include <begin_vertex>\nvSurfacePoint=position; vSurfaceUv=uv;${motion?"\nfloat fishyPlantRootWeight=clamp(((modelMatrix*vec4(transformed,1.0)).y-uFishyPlantRootY)/max(uFishyPlantHeight,.01),0.0,1.0);\nfloat fishyPlantBend=sin(uFishyPlantTime*(1.15+uFishyPlantStiffness*.65)+uFishyPlantPhase+position.y*23.0);\nvec2 fishyPlantFlow=normalize(uFishyPlantFlow+vec2(.0001));\nvec3 fishyPlantWorldOffset=vec3(fishyPlantFlow.x*fishyPlantBend,0.0,fishyPlantFlow.y*cos(uFishyPlantTime*.83+uFishyPlantPhase+position.y*17.0))*fishyPlantRootWeight*uFishyPlantMotion*.0028;\ntransformed+=(inverse(modelMatrix)*vec4(fishyPlantWorldOffset,0.0)).xyz;":""}`);
    shader.fragmentShader=shader.fragmentShader.replace("#include <common>",`#include <common>\n${noise}\nvec4 surfaceSample(){${surfaces[kind]}}`)
      .replace("#include <color_fragment>","#include <color_fragment>\nvec4 surfaceDetail=surfaceSample();\ndiffuseColor.rgb*=surfaceDetail.rgb;")
      .replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(surfaceDetail.a-.5)*.22,.3,1.0);")
      .replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
        vec3 sx=dFdx(-vViewPosition), sy=dFdy(-vViewPosition);
        vec3 rx=cross(sy,normal), ry=cross(normal,sx);
        float det=dot(sx,rx);
        vec2 slope=vec2(dFdx(surfaceDetail.a),dFdy(surfaceDetail.a));
        float bumpSize=${kind==="plant"?"0.000012":kind==="sand"?"0.00026":"0.00032"};
        vec3 grad=sign(det)*(slope.x*rx+slope.y*ry)*bumpSize;
        normal=normalize(abs(det)*normal-grad+normal*1e-12);
      `);
  };
  return material;
}
