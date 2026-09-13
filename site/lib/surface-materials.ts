import * as T from "three";

export type SurfaceKind = "wood" | "rock" | "plant" | "sand";

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
  material.customProgramCacheKey=()=>`fishy-surface-v1-${kind}`;
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vSurfacePoint;\nvarying vec2 vSurfaceUv;")
      .replace("#include <begin_vertex>","#include <begin_vertex>\nvSurfacePoint=position; vSurfaceUv=uv;");
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
