import * as T from "three";
import type {SceneObject,Vec3} from "./scene";
import {surfaceMaterial} from "./surface-materials.ts";
import {buildCatalogModel} from "./catalog-models.ts";

// Persisted sculpt fields declare fishy-object-v11. Keep this geometry immutable;
// future base geometry needs a new generator identifier and explicit migration.
function tube(points:Vec3[],radius:number,material:T.Material) {
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  const geometry=new T.TubeGeometry(curve,28,radius,8,false);
  return new T.Mesh(geometry,material);
}
function detailedLeaf(leaf:T.Mesh,index:number) {
  // Fit the new curved blade to this leaf's former parent-space envelope. This
  // improves surface resolution without expanding a plant's editable bounds.
  leaf.updateMatrix();const old=leaf.geometry.clone().applyMatrix4(leaf.matrix);old.computeBoundingBox();
  const envelope=old.boundingBox!.clone();old.dispose();leaf.geometry.dispose();
  const positions:number[]=[],uv:number[]=[],indices:number[]=[],colors:number[]=[];
  const length=16,width=6,tint=.5+.5*Math.sin(index*2.399);
  for(let row=0;row<=length;row++)for(let col=0;col<=width;col++) {
    const t=row/length,s=col/width*2-1,span=Math.pow(Math.sin(Math.PI*t),.72);
    positions.push(s*span,.32*(1-s*s)*Math.sin(Math.PI*t)+.16*Math.sin(t*Math.PI*2),t*2-1);
    uv.push(col/width,t);colors.push(1-tint*.26,1-tint*.12,1-tint*.32);
  }
  for(let row=0;row<length;row++)for(let col=0;col<width;col++) {const a=row*(width+1)+col,b=a+width+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const geo=new T.BufferGeometry();geo.setAttribute("position",new T.Float32BufferAttribute(positions,3));geo.setAttribute("uv",new T.Float32BufferAttribute(uv,2));geo.setAttribute("color",new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.applyMatrix4(leaf.matrix);geo.computeBoundingBox();
  const box=geo.boundingBox!,size=box.getSize(new T.Vector3()),target=envelope.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),destination=envelope.getCenter(new T.Vector3());
  geo.translate(-center.x,-center.y,-center.z);geo.scale(target.x/Math.max(size.x,1e-9),target.y/Math.max(size.y,1e-9),target.z/Math.max(size.z,1e-9));geo.translate(destination.x,destination.y,destination.z);geo.computeVertexNormals();
  leaf.geometry=geo;leaf.position.set(0,0,0);leaf.rotation.set(0,0,0);leaf.scale.set(1,1,1);
}
export function buildObjectBaseV11(o:Pick<SceneObject,"kind"|"form"|"color"|"catalogId">):T.Group {
  const g=new T.Group(), mat=surfaceMaterial(o.kind,o.color);
  if(buildCatalogModel(o,g,mat)) {
    // Catalog objects use identity-bearing geometry; legacy scene objects retain
    // the frozen v11 generic generator below for save/sculpt compatibility.
  } else if(o.kind==="wood") {
    const form=o.form;
    if(form==="stump") {
      g.add(tube([[0,.014,0],[.025,.07,0],[.012,.14,-.02]],.024,mat));
      for(let i=0;i<5;i++){const a=i*1.27;g.add(tube([[0,.025,0],[Math.cos(a)*.05,.015,Math.sin(a)*.04],[Math.cos(a)*.11,.014,Math.sin(a)*.07]],.009,mat));}
    } else if(form==="root"||form==="spider") {
      g.add(tube([[-.08,.014,0],[-.045,.07,-.01],[.01,.14,-.01],[.055,.19,.008]],.012,mat));
      for(let i=0;i<(form==="spider"?7:4);i++){const a=i*1.05;g.add(tube([[-.045,.07,-.01],[Math.cos(a)*.08,.11,Math.sin(a)*.04],[Math.cos(a)*.16,.016+i*.02,Math.sin(a)*.07]],.005,mat));}
    } else {
      g.add(tube([[-.205,.016,0],[-.12,.075,-.02],[-.025,.13,-.005],[.08,.18,0],[.185,.12,.015]],.016,mat));
      g.add(tube([[-.015,.135,0],[.005,.2,-.025],[.065,.235,-.018]],.008,mat));
      g.add(tube([[.07,.176,0],[.115,.075,.035],[.145,.011,.04]],.008,mat));
      if(form==="angular")g.add(tube([[-.12,.075,0],[-.16,.12,.035],[-.23,.155,.035]],.006,mat));
    }
  } else if(o.kind==="rock") {
    const geo=new T.IcosahedronGeometry(.052,1),pos=geo.getAttribute("position");
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const n=1+.12*Math.sin(x*87+z*46+y*21);pos.setXYZ(i,x*1.2*n,y*.67*n+.037,z*.83*n);}
    geo.computeVertexNormals();g.add(new T.Mesh(geo,mat));
  } else {
    const form=o.form;
    if(form==="grass") {
      for(let i=0;i<38;i++) {const x=Math.sin(i*7.1)*.043,z=Math.cos(i*4.2)*.029,h=.038+(i%5)*.008;g.add(tube([[x,0,z],[x+.008,h*.65,z],[x+.014,h,z+.006]],.0009,mat));}
    } else if(form==="moss"||form==="carpet") {
      for(let i=0;i<32;i++){const leaf=new T.Mesh(new T.IcosahedronGeometry(.009,0),mat);leaf.scale.set(1,.6,1);leaf.position.set(Math.sin(i*3.8)*.045,.006+(i%3)*.004,Math.cos(i*7.3)*.03);g.add(leaf);}
    } else {
      for(let i=0;i<14;i++) {const a=i*2.39, x=Math.sin(a)*.038,z=Math.cos(a)*.028,h=(form==="broadleaf"?.035:.055)+(i%4)*.018;
        g.add(tube([[x,0,z],[x*.9,h*.6,z],[x*1.2,h,z*.9]],.001,mat));
        for(let j=0;j<(form==="fern"?5:3);j++){const leaf=new T.Mesh(new T.SphereGeometry(1,6,4),mat);leaf.scale.set(form==="broadleaf"?.014:.007,.0017,form==="fern"?.019:.014);leaf.position.set(x+(j%2===0?.01:-.01),h*.4+j*.012,z);leaf.rotation.set(.3,j*1.8,a*.1);detailedLeaf(leaf,i*5+j);g.add(leaf);}
      }
    }
  }
  g.traverse(x=>{if(x instanceof T.Mesh){if(o.kind==="plant"&&!x.geometry.hasAttribute("color")){const colors=new Float32Array(x.geometry.getAttribute("position").count*3);colors.fill(1);x.geometry.setAttribute("color",new T.BufferAttribute(colors,3));}x.castShadow=true;x.receiveShadow=true;}});g.updateMatrixWorld(true);return g;
}

