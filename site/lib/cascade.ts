import * as T from "three";
import {boundsOf,makeObject,disposeObject} from "./geometry.ts";
import {aquariumWaterHeight} from "./render-profile.ts";
import {localBounds,fidelityAssetFor,fitAssetToLocalBounds} from "./render-assets.ts";
import {rockContactSurface} from "./rock-contact-surface.ts";
import type {SceneObject,SceneRecord} from "./scene.ts";

const contactGeometry=new T.BufferGeometry();
contactGeometry.setAttribute("position",new T.Float32BufferAttribute(rockContactSurface.positions,3));
contactGeometry.setIndex(rockContactSurface.indices);
// Preserve original bounds for the same uniform fit as the detailed GLB.
contactGeometry.boundingBox=new T.Box3(new T.Vector3(...rockContactSurface.min),new T.Vector3(...rockContactSurface.max));
const contactMaterial=new T.MeshBasicMaterial({side:T.DoubleSide});

function stoneSpillway(object:SceneObject,water:number) {
  const box=boundsOf(object);
  if(!["rock-rounded","rock-strata"].includes(fidelityAssetFor(object)??""))return new T.Vector3(box.getCenter(new T.Vector3()).x,box.max.y-.004,box.max.z-.004);
  const authored=new T.Mesh(contactGeometry,contactMaterial),proxy=makeObject(object);
  fitAssetToLocalBounds(authored,localBounds(proxy));
  authored.updateMatrix();authored.matrix.premultiply(proxy.matrixWorld);authored.matrixAutoUpdate=false;authored.updateMatrixWorld(true);disposeObject(proxy);
  const bounds=new T.Box3().setFromObject(authored),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
  const ray=new T.Raycaster(),samples:T.Vector3[]=[];
  for(let i=0;i<=64;i++){
    ray.set(new T.Vector3(center.x,bounds.max.y+.01,T.MathUtils.lerp(bounds.min.z,bounds.max.z,i/64)),new T.Vector3(0,-1,0));
    const hit=ray.intersectObject(authored,false)[0];if(hit&&hit.point.y>water+.012)samples.push(hit.point);
  }
  if(!samples.length)return null;
  const top=Math.max(...samples.map(point=>point.y));
  const crest=samples.filter(point=>point.y>=top-Math.max(.004,size.y*.13)).at(-1)!;
  return crest.clone().add(new T.Vector3(0,.0015,.002));
}

/** Follow visible stone crests, with independent free-falling drops between shelves. */
export function cascadeRoute(record:SceneRecord):T.Vector3[] {
  const water=aquariumWaterHeight(record);
  const eligible=record.objects.filter(o=>o.kind==="rock").map(object=>({object,box:boundsOf(object)})).filter(({box})=>box.max.y>water+.015);
  const left=eligible.filter(({box})=>box.getCenter(new T.Vector3()).x<-record.tank.width*.20);
  const candidates=(left.length?left:eligible).sort((a,b)=>b.box.max.y-a.box.max.y);
  if(!candidates.length)return [];
  const sourceX=candidates[0].box.getCenter(new T.Vector3()).x;
  const banks=candidates.filter(({box})=>Math.abs(box.getCenter(new T.Vector3()).x-sourceX)<record.tank.width*.11).slice(0,4);
  const points=banks.map(({object})=>stoneSpillway(object,water)).filter((point):point is T.Vector3=>!!point).sort((a,b)=>b.y-a.y);
  for(let i=points.length-1;i>0;i--)if(points[i-1].y-points[i].y<.015)points.splice(i,1);
  if(!points.length)return [];
  const end=points.at(-1)!;points.push(new T.Vector3(end.x+.003,water+.001,end.z+.012));
  for(const point of points){point.x=T.MathUtils.clamp(point.x,-record.tank.width/2+.012,record.tank.width/2-.012);point.z=T.MathUtils.clamp(point.z,-record.tank.depth/2+.012,record.tank.depth/2-.012);}
  return points;
}

/** Water falls almost vertically, then travels over the intervening wet ledge. */
export function cascadeDrops(route:readonly T.Vector3[]) {
  return route.slice(0,-1).map((start,index)=>{
    const next=route[index+1],end=next.clone();
    if(index<route.length-2)end.z=Math.min(next.z,start.z+.008);
    const control=start.clone().lerp(end,.42);control.y=start.y-(start.y-end.y)*.20;
    return new T.QuadraticBezierCurve3(start,control,end);
  });
}

export function createCascade(record:SceneRecord) {
  const group=new T.Group();group.name="Rock-bank cascade";
  const route=cascadeRoute(record);if(route.length<2)return group;
  const time={value:0};
  const geometry=new T.BufferGeometry(),positions:number[]=[],uv:number[]=[],indices:number[]=[];
  const rows=64;
  for(const [dropIndex,curve] of cascadeDrops(route).entries()){
    const offset=positions.length/3,length=curve.getLength();
    for(let i=0;i<=rows;i++){
      const t=i/rows,p=curve.getPoint(t),width=.0065+(1-t)*.002+Math.sin(t*19+dropIndex)*.0007;
      for(const side of [-1,1]){positions.push(p.x+side*width,p.y,p.z);uv.push((side+1)/2,t*length*17+dropIndex*1.71);}
      if(i<rows){const a=offset+i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
  }
  geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));geometry.setAttribute("uv",new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float time;varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      void main(){float edge=smoothstep(0.,.18,vUv.x)*smoothstep(0.,.18,1.-vUv.x);float threads=smoothstep(.47,.90,noise2(vec2(vUv.x*79.,vUv.y*.8-time*.32)));float flow=noise2(vec2(vUv.x*13.,vUv.y*41.-time*8.));float alpha=edge*threads*(.07+flow*.25);gl_FragColor=vec4(vec3(.63,.80,.76),alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  material.forceSinglePass=true;material.userData.fishyCascadeTime=time;
  const sheet=new T.Mesh(geometry,material);sheet.renderOrder=3;group.add(sheet);
  const end=route.at(-1)!;
  const rings=new T.Mesh(new T.PlaneGeometry(.12,.12),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float time;varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;float ring=pow(max(0.,sin(r*48.-time*4.5)),18.)*(1.-smoothstep(.15,1.,r));gl_FragColor=vec4(.75,.90,.83,ring*.085);}`
  }));rings.rotation.x=-Math.PI/2;rings.position.copy(end);rings.position.y+=.001;rings.renderOrder=3;(rings.material as T.ShaderMaterial).userData.fishyCascadeTime=time;group.add(rings);
  const mistPositions:number[]=[];
  for(let i=0;i<14;i++)mistPositions.push(end.x+.018+i*.010,end.y+.008+(i%3)*.004,end.z-.014+Math.sin(i*2.4)*.018);
  const mistGeometry=new T.BufferGeometry();mistGeometry.setAttribute("position",new T.Float32BufferAttribute(mistPositions,3));
  const mistMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time},
    vertexShader:`uniform float time;void main(){vec3 p=position;p.x+=sin(time*.22+position.x*43.)*.008;p.y+=sin(time*.31+position.z*57.)*.003;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(38./-mv.z,8.,110.);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`void main(){float r=length(gl_PointCoord-.5)*2.;float alpha=exp(-r*r*4.)*(1.-smoothstep(.7,1.,r))*.035;gl_FragColor=vec4(.68,.78,.73,alpha);}`
  });mistMaterial.userData.fishyCascadeTime=time;const mist=new T.Points(mistGeometry,mistMaterial);mist.renderOrder=4;group.add(mist);
  return group;
}
