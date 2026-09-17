import * as T from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type {SceneObject,Vec3} from "./scene";

type CatalogObject=Pick<SceneObject,"kind"|"catalogId"|"variantSeed">;

function seedFor(value:string) {
  let seed=2166136261;
  for(let i=0;i<value.length;i++){seed^=value.charCodeAt(i);seed=Math.imul(seed,16777619);}
  return ()=>{seed+=0x6d2b79f5;let n=seed;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
}

function branch(points:Vec3[],start:number,end:number,material:T.Material,seed=0,segments=30,sides=10) {
  const curve=new T.CatmullRomCurve3(points.map(point=>new T.Vector3(...point)),false,"centripetal");
  const frames=curve.computeFrenetFrames(segments,false),positions:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let ring=0;ring<=segments;ring++){
    const t=ring/segments,center=curve.getPointAt(t),radius=T.MathUtils.lerp(start,end,t)*(1+.055*Math.sin(t*31+seed)+.025*Math.sin(t*83+seed*.7));
    for(let side=0;side<sides;side++){
      const a=side/sides*Math.PI*2,radial=frames.normals[ring].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[ring],Math.sin(a));
      const bark=1+.035*Math.sin(a*3+seed)+.02*Math.sin(a*7+t*37);
      positions.push(center.x+radial.x*radius*bark,center.y+radial.y*radius*bark,center.z+radial.z*radius*bark);uv.push(side/sides,t);
    }
  }
  for(let ring=0;ring<segments;ring++)for(let side=0;side<sides;side++){
    const a=ring*sides+side,b=ring*sides+(side+1)%sides,c=(ring+1)*sides+side,d=(ring+1)*sides+(side+1)%sides;indices.push(a,c,b,b,c,d);
  }
  for(const [ring,flip] of [[0,true],[segments,false]] as const){const center=positions.length/3,p=curve.getPointAt(ring/segments);positions.push(p.x,p.y,p.z);uv.push(.5,ring/segments);for(let side=0;side<sides;side++){const a=ring*sides+side,b=ring*sides+(side+1)%sides;indices.push(...(flip?[center,b,a]:[center,a,b]));}}
  const geometry=new T.BufferGeometry();geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));geometry.setAttribute("uv",new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  return new T.Mesh(geometry,material);
}

function leaf(origin:Vec3,direction:Vec3,length:number,width:number,material:T.Material,options:{wave?:number;lobes?:number;round?:number;curl?:number;seed?:number;color?:[number,number,number]}={}) {
  const rows=14,columns=6,positions:number[]=[],uv:number[]=[],indices:number[]=[],colors:number[]=[];
  const wave=options.wave??0,lobes=options.lobes??0,round=options.round??.72,curl=options.curl??.1,seed=options.seed??0;
  for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
    const t=row/rows,s=column/columns*2-1;
    const taper=Math.pow(Math.max(0,Math.sin(Math.PI*Math.pow(t,round))),.64)*(1+lobes*.16*Math.sin(t*Math.PI*6));
    const x=s*width*taper*(1+wave*.18*Math.sin(t*Math.PI*7+seed)),y=t*length,z=curl*length*Math.sin(t*Math.PI)*(.22+.78*s*s)+wave*width*Math.sin(t*Math.PI*5+seed)*s;
    positions.push(x,y,z);uv.push((s+1)/2,t);const tone=.82+.16*Math.sin(seed+t*3.1+s*.8),color=options.color??[tone,.9+.08*tone,.76+.18*tone];colors.push(...color);
  }
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){const a=row*(columns+1)+column,b=a+columns+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const geometry=new T.BufferGeometry();geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));geometry.setAttribute("uv",new T.Float32BufferAttribute(uv,2));geometry.setAttribute("color",new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,material),dir=new T.Vector3(...direction).normalize();mesh.position.fromArray(origin);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir);return mesh;
}

function stem(points:Vec3[],radius:number,material:T.Material,seed=0) {return branch(points,radius,radius*.72,material,seed,18,6);}
function mergedMesh(parts:T.Mesh[],material:T.Material) {
  const geometries=parts.map(part=>{
    part.updateMatrix();
    const geometry=part.geometry.clone();
    geometry.applyMatrix4(part.matrix);
    return geometry;
  });
  const merged=mergeGeometries(geometries,false);
  geometries.forEach(geometry=>geometry.dispose());
  parts.forEach(part=>part.geometry.dispose());
  if(!merged)throw new Error("Catalog geometry could not be merged");
  return new T.Mesh(merged,material);
}
function addRootlets(group:T.Group,origin:Vec3,count:number,spread:number,length:number,material:T.Material,rand:()=>number) {
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2+rand()*.4,x=Math.cos(a),z=Math.sin(a);group.add(branch([origin,[origin[0]+x*spread*.45,Math.max(.002,origin[1]-length*.18),origin[2]+z*spread*.45],[origin[0]+x*spread,.003,origin[2]+z*spread]],.0024,.0006,material,i,12,6));}
}

function spiderWood(group:T.Group,material:T.Material,rand:()=>number,redMoor=false) {
  const crown:Vec3=[-.04,.045,0];group.add(branch([[-.1,.012,.025],[-.075,.035,.01],crown,[.005,.095,-.008]],.023,.014,material,1,34,12));
  const count=redMoor?13:10;
  for(let i=0;i<count;i++){const a=-1.35+i/(count-1)*2.7+(rand()-.5)*.16,side=i%2?1:-1,start:[number,number,number]=[crown[0]+(rand()-.5)*.018,crown[1]+rand()*.025,crown[2]+(rand()-.5)*.018],reach=.11+rand()*.085;
    group.add(branch([start,[start[0]+Math.cos(a)*reach*.32,start[1]+.045+rand()*.035,start[2]+side*reach*.2],[start[0]+Math.cos(a)*reach*.72,start[1]+.07+rand()*.07,start[2]+side*reach*.5],[start[0]+Math.cos(a)*reach,start[1]+.055+rand()*.12,start[2]+side*reach*.72]],.007+(i%3)*.0013,.0015,material,i+4,26,8));
    if(i%2===0){const tip:Vec3=[start[0]+Math.cos(a)*reach*.72,start[1]+.07+rand()*.07,start[2]+side*reach*.5];group.add(branch([tip,[tip[0]+side*.035,tip[1]+.045,tip[2]+Math.cos(a)*.035],[tip[0]+side*.065,tip[1]+.07,tip[2]+Math.cos(a)*.06]],.0032,.0008,material,20+i,15,7));}
  }
  addRootlets(group,[-.075,.03,.01],7,.13,.03,material,rand);
}

function manzanita(group:T.Group,material:T.Material,rand:()=>number) {
  group.add(branch([[-.15,.012,.015],[-.09,.045,.006],[-.025,.075,-.004],[.045,.125,0],[.12,.18,.012]],.014,.004,material,3,42,11));
  for(let i=0;i<7;i++){const t=.22+i*.095,base:Vec3=[-.15+.27*t,.012+.17*t,.015-.01*t],side=i%2?1:-1;group.add(branch([base,[base[0]+.025,base[1]+.035,base[2]+side*.025],[base[0]+.055,base[1]+.075+(rand()-.5)*.025,base[2]+side*(.055+rand()*.035)]],.0045,.001,material,10+i,20,7));}
}

function mopani(group:T.Group,material:T.Material,rand:()=>number,malaysian=false) {
  group.add(branch([[-.12,.015,.025],[-.065,.04,.006],[0,.065,0],[.07,.075,-.012],[.13,.04,.018]],malaysian?.03:.034,.018,material,6,38,14));
  group.add(branch([[-.07,.035,.008],[-.035,.09,-.015],[-.01,.155,-.005]],.022,.006,material,9,28,11));
  if(malaysian)group.add(branch([[.035,.065,0],[.075,.12,.018],[.11,.18,.035]],.016,.003,material,13,26,10));
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2+(rand()-.5)*.3;group.add(branch([[-.045,.028,0],[Math.cos(a)*.065,.012,Math.sin(a)*.04],[Math.cos(a)*(.13+rand()*.035),.004,Math.sin(a)*(.075+rand()*.025)]],.009,.002,material,20+i,18,8));}
}

function cholla(group:T.Group,material:T.Material) {
  const radius=.033,height=.18,ribs=11,rings=10;
  for(let i=0;i<ribs;i++){const a=i/ribs*Math.PI*2;group.add(branch([[Math.cos(a)*radius,.006,Math.sin(a)*radius],[Math.cos(a+.05)*radius*.95,height*.5,Math.sin(a+.05)*radius*.95],[Math.cos(a+.1)*radius*.83,height,Math.sin(a+.1)*radius*.83]],.0026,.0018,material,i,26,6));}
  for(let ring=1;ring<rings;ring++)for(let i=0;i<ribs;i+=2){const a=(i+(ring%2)*.7)/ribs*Math.PI*2,b=(i+2.2+(ring%2)*.7)/ribs*Math.PI*2,y=ring/rings*height;group.add(branch([[Math.cos(a)*radius,y-.008,Math.sin(a)*radius],[Math.cos((a+b)/2)*radius*1.02,y,Math.sin((a+b)/2)*radius*1.02],[Math.cos(b)*radius,y+.008,Math.sin(b)*radius]],.0018,.0014,material,ring*13+i,8,5));}
  const rim=(y:number,r:number)=>{for(let i=0;i<ribs;i++){const a=i/ribs*Math.PI*2,b=(i+1)/ribs*Math.PI*2;group.add(branch([[Math.cos(a)*r,y,Math.sin(a)*r],[Math.cos((a+b)/2)*r,y+.001,Math.sin((a+b)/2)*r],[Math.cos(b)*r,y,Math.sin(b)*r]],.0027,.0027,material,60+i,4,6));}};rim(.006,radius);rim(height,radius*.83);
}

function directionalWood(group:T.Group,material:T.Material,rand:()=>number,ghost=false) {
  group.add(branch([[-.19,.014,.025],[-.12,.04,.005],[-.035,.075,-.012],[.065,.12,-.005],[.19,.15,.018]],ghost?.012:.019,.003,material,4,45,ghost?9:12));
  for(let i=0;i<(ghost?8:6);i++){const t=.16+i*.12,base:Vec3=[-.19+.38*t,.014+.136*t,.025-.007*t],side=i%2?1:-1;group.add(branch([base,[base[0]+.02,base[1]+.045,base[2]+side*(.025+rand()*.025)],[base[0]+.055,base[1]+.075+rand()*.04,base[2]+side*(.065+rand()*.04)]],ghost?.004:.0055,.0008,material,12+i,22,7));}
  addRootlets(group,[-.13,.03,.012],ghost?6:4,.1,.025,material,rand);
}

/** A low, weathered conifer-root silhouette for the documented layout material. */
function ancientJuniper(group:T.Group,material:T.Material,rand:()=>number) {
  const trunk:Vec3[]=[[-.18,.011,.024],[-.125,.03,.008],[-.055,.068,-.012],[.025,.118,-.006],[.115,.146,.02],[.19,.132,.046]];
  group.add(branch(trunk,.025,.006,material,29,48,13));
  const forks:[number,Vec3[]][]=[
    [43,[[-.065,.063,-.01],[-.09,.115,-.024],[-.122,.162,-.04],[-.158,.192,-.052]]],
    [47,[[.012,.11,-.006],[.052,.172,-.035],[.096,.22,-.046],[.143,.245,-.04]]],
    [53,[[.09,.14,.016],[.128,.183,.045],[.173,.198,.075],[.22,.188,.098]]]
  ];
  for(const [seed,points] of forks)group.add(branch(points,.011,.0022,material,seed,31,9));
  for(let i=0;i<10;i++){
    const t=.12+i*.075,base:Vec3=[-.18+.37*t,.011+.137*t,.024+.022*t],side=i%2?1:-1,reach=.06+rand()*.055;
    group.add(branch([base,[base[0]+.018,base[1]+.025+rand()*.017,base[2]+side*.018],[base[0]+reach,base[1]+.042+rand()*.045,base[2]+side*(.036+rand()*.035)]],.0044,.00075,material,61+i,17,7));
  }
  for(let i=0;i<6;i++){const a=-2.55+i*.82+(rand()-.5)*.18;group.add(branch([[-.12,.025,.014],[-.12+Math.cos(a)*.055,.008,-.002+Math.sin(a)*.035],[-.12+Math.cos(a)*(.1+rand()*.04),.003,-.002+Math.sin(a)*(.065+rand()*.025)]],.006,.0011,material,84+i,17,7));}
}

function dragonWood(group:T.Group,material:T.Material,rand:()=>number) {
  group.add(branch([[-.13,.014,.02],[-.075,.035,-.012],[-.02,.065,.01],[.045,.07,-.006],[.115,.025,.018]],.03,.016,material,8,40,14));
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2,base:Vec3=[-.035+(rand()-.5)*.04,.04+(i%3)*.012,(rand()-.5)*.025];group.add(branch([base,[base[0]+Math.cos(a)*.045,base[1]+.035+rand()*.04,base[2]+Math.sin(a)*.04],[base[0]+Math.cos(a)*(.095+rand()*.045),base[1]+.055+rand()*.085,base[2]+Math.sin(a)*(.075+rand()*.04)]],.008,.0017,material,30+i,23,8));}
  // Raised, irregular rims make Dragon wood's eroded cavities legible without CSG.
  for(let i=0;i<5;i++){const ring=new T.Mesh(new T.TorusGeometry(.007+i*.0007,.0016,6,12),material);ring.position.set(-.08+i*.035,.035+(i%2)*.018,.027);ring.rotation.x=Math.PI/2+(i%2)*.35;ring.scale.set(1,1.4,1);group.add(ring);}
}

function knotClusters(group:T.Group,material:T.Material,count:number,spread:number,seed:number) {
  for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2+seed*.13,knot=new T.Mesh(new T.DodecahedronGeometry(.012+(i%3)*.003,2),material);
    knot.position.set(-.03+Math.cos(a)*spread,.026+(i%4)*.012,Math.sin(a)*spread*.55);knot.scale.set(1.35,.8,1);knot.rotation.set(a*.3,a,a*.2);group.add(knot);
  }
}

function bogwood(group:T.Group,material:T.Material,rand:()=>number) {
  mopani(group,material,rand);group.scale.set(1.08,.82,1.04);knotClusters(group,material,5,.038,3);
}

function sinkingWood(group:T.Group,material:T.Material,rand:()=>number) {
  mopani(group,material,rand,true);group.scale.set(.78,.7,.92);knotClusters(group,material,7,.032,8);
}

function stoneWood(group:T.Group,material:T.Material,rand:()=>number) {
  mopani(group,material,rand);group.scale.set(.82,.74,1.04);knotClusters(group,material,11,.045,13);
}

function mangroveRoot(group:T.Group,material:T.Material,rand:()=>number) {
  directionalWood(group,material,rand);group.scale.set(.83,1.08,1.1);
  for(let i=0;i<9;i++){const a=-1.2+i*.3,root:Vec3=[-.1+(i%3)*.028,.035,(i-4)*.009];group.add(branch([root,[root[0]+Math.cos(a)*.045,.014,root[2]+Math.sin(a)*.04],[root[0]+Math.cos(a)*.105,.002,root[2]+Math.sin(a)*.085]],.006,.0012,material,110+i,18,7));}
}

function elderRoot(group:T.Group,material:T.Material,rand:()=>number) {
  directionalWood(group,material,rand,true);group.scale.set(.95,.85,1.2);
  for(let i=0;i<8;i++){const side=i%2?1:-1,x=-.14+i*.035;group.add(branch([[x,.035,(rand()-.5)*.02],[x+.025,.07+rand()*.025,side*.04],[x+.07,.09+rand()*.045,side*(.075+rand()*.035)]],.0032,.00055,material,130+i,23,6));}
}

function petiteWood(group:T.Group,material:T.Material,rand:()=>number) {
  spiderWood(group,material,rand);group.scale.set(.62,.58,.62);
}

function desertRoots(group:T.Group,material:T.Material,rand:()=>number) {
  spiderWood(group,material,rand,true);group.scale.set(1.08,.82,1.18);
}

function stripedWood(group:T.Group,material:T.Material,rand:()=>number) {
  ancientJuniper(group,material,rand);group.scale.set(1,.82,.86);
  for(let i=0;i<7;i++){const ridge=new T.Mesh(new T.TorusGeometry(.018+i*.004,.0011,5,18,.9),material);ridge.position.set(-.13+i*.045,.035+i*.014,.025);ridge.rotation.set(Math.PI/2,.3,.55);group.add(ridge);}
}

function runners(group:T.Group,count:number,spreadX:number,spreadZ:number,material:T.Material,rand:()=>number) {
  for(let i=0;i<count;i++){const x=(rand()-.5)*spreadX,z=(rand()-.5)*spreadZ;group.add(stem([[x-.02,.002,z],[x,.003,z+(rand()-.5)*.015],[x+.025,.002,z+(rand()-.5)*.02]],.0007,material,i));}
}

function monteCarlo(group:T.Group,material:T.Material,rand:()=>number,glosso=false) {
  runners(group,12,.095,.065,material,rand);const count=glosso?34:48;
  for(let i=0;i<count;i++){const x=(rand()-.5)*.105,z=(rand()-.5)*.072,y=.003+rand()*.005,h=glosso?.012:.008,a=rand()*Math.PI*2;
    group.add(stem([[x,y,z],[x+Math.cos(a)*.003,y+h,z+Math.sin(a)*.003]],.00065,material,i));
    const len=glosso?.013:.009,w=glosso?.005:.0055;group.add(leaf([x,y+h,z],[Math.cos(a),.2,Math.sin(a)],len,w,material,{round:glosso?.86:.56,curl:.03,seed:i}));group.add(leaf([x,y+h,z],[-Math.cos(a),.2,-Math.sin(a)],len,w,material,{round:glosso?.86:.56,curl:.03,seed:i+1}));
  }
}

function rhizomePlant(group:T.Group,material:T.Material,rand:()=>number,buce=false) {
  group.add(branch([[-.048,.008,0],[-.015,.011,.004],[.02,.009,-.003],[.05,.013,.005]],buce?.0032:.0047,.003,material,2,24,7));addRootlets(group,[0,.009,0],9,.045,.015,material,rand);
  const count=buce?20:16;
  for(let i=0;i<count;i++){const x=-.043+i/(count-1)*.086+(rand()-.5)*.006,z=(rand()-.5)*.016,h=(buce?.026:.032)+rand()*(buce?.025:.035),a=(rand()-.5)*1.9;
    group.add(stem([[x,.011,z],[x+Math.sin(a)*.006,h*.62,z+Math.cos(a)*.006]],.0011,material,i));
    group.add(leaf([x+Math.sin(a)*.006,h*.62,z+Math.cos(a)*.006],[Math.sin(a)*.45,.8,Math.cos(a)*.45],buce?.027:.032,buce?.0075:.0115,material,{wave:buce?.8:.08,round:buce?.72:.52,curl:buce?.12:.16,seed:i}));
  }
}

function alternanthera(group:T.Group,material:T.Material,rand:()=>number) {
  const crimson:[number,number,number]=[1.08,.54,.72],plum:[number,number,number]=[.92,.43,.66],young:[number,number,number]=[1.1,.67,.76];
  for(let i=0;i<25;i++){
    const baseAngle=rand()*Math.PI*2,radius=Math.sqrt(rand())*.052,x=Math.cos(baseAngle)*radius,z=Math.sin(baseAngle)*radius,h=.048+rand()*.035,bend=(rand()-.5)*.018,drift=(rand()-.5)*.014;
    group.add(stem([[x,.002,z],[x+bend*.18,h*.34,z+drift*.14],[x+bend*.58,h*.7,z+drift*.58],[x+bend,h,z+drift]],.00082,material,i));
    for(let node=1;node<=4;node++){
      const t=node/5,y=h*t,a=baseAngle+node*Math.PI/2+(rand()-.5)*.34,origin:Vec3=[x+bend*t,y,z+drift*t],tone=node===4?young:(i+node)%3?crimson:plum,leafLength=.013+rand()*.004;
      for(const side of [-1,1])group.add(leaf(origin,[Math.cos(a)*side,.26+rand()*.14,Math.sin(a)*side],leafLength,.0027+rand()*.0008,material,{round:.48,curl:.025,wave:.07,seed:i*11+node*3+side,color:tone}));
    }
  }
}

function cryptocoryne(group:T.Group,material:T.Material,rand:()=>number) {
  addRootlets(group,[0,.004,0],12,.055,.02,material,rand);
  for(let i=0;i<28;i++){const a=i/28*Math.PI*2+(rand()-.5)*.15,length=.055+rand()*.07,width=.008+rand()*.004;group.add(leaf([(rand()-.5)*.012,.004,(rand()-.5)*.012],[Math.cos(a)*.62,.75,Math.sin(a)*.62],length,width,material,{wave:.7,round:.76,curl:.22,seed:i}));}
}

function eleocharis(group:T.Group,material:T.Material,rand:()=>number) {
  runners(group,10,.085,.055,material,rand);
  for(let i=0;i<82;i++){const x=(rand()-.5)*.09,z=(rand()-.5)*.06,h=.032+rand()*.055,bx=(rand()-.5)*.018,bz=(rand()-.5)*.018;group.add(branch([[x,0,z],[x+bx*.25,h*.38,z+bz*.2],[x+bx*.7,h*.76,z+bz*.62],[x+bx,h,z+bz]],.00055,.00022,material,i,12,5));}
}

function weepingMoss(group:T.Group,material:T.Material,rand:()=>number) {
  runners(group,10,.095,.05,material,rand);
  for(let i=0;i<30;i++){const x=(rand()-.5)*.09,z=(rand()-.5)*.045,drop=.025+rand()*.045;const points:Vec3[]=[[x,.018+rand()*.02,z],[x+(rand()-.5)*.009,.006,z+(rand()-.5)*.008],[x+(rand()-.5)*.014,-drop*.55,z+(rand()-.5)*.012]];group.add(stem(points,.00065,material,i));for(let j=0;j<5;j++){const t=(j+1)/6,origin:Vec3=[T.MathUtils.lerp(points[0][0],points[2][0],t),T.MathUtils.lerp(points[0][1],points[2][1],t),T.MathUtils.lerp(points[0][2],points[2][2],t)],side=j%2?1:-1;group.add(leaf(origin,[side*.8,-.3,.2],.006,.0022,material,{round:.82,curl:.03,seed:i+j}));}}
}

function fissidens(group:T.Group,material:T.Material,rand:()=>number) {
  for(let i=0;i<22;i++){const a=i/22*Math.PI*2,h=.022+rand()*.025,base:Vec3=[(rand()-.5)*.06,.002,(rand()-.5)*.04],tip:Vec3=[base[0]+Math.cos(a)*.018,h,base[2]+Math.sin(a)*.018];group.add(stem([base,tip],.00055,material,i));for(let j=1;j<=7;j++){const t=j/8,origin:Vec3=[T.MathUtils.lerp(base[0],tip[0],t),T.MathUtils.lerp(base[1],tip[1],t),T.MathUtils.lerp(base[2],tip[2],t)],side=j%2?1:-1;group.add(leaf(origin,[Math.cos(a+Math.PI/2)*side,.22,Math.sin(a+Math.PI/2)*side],.007*(1-t*.45),.0021,material,{round:.82,curl:.03,seed:i*9+j}));}}
}

function bolbitis(group:T.Group,material:T.Material,rand:()=>number) {
  group.add(branch([[-.05,.007,0],[0,.009,.003],[.055,.008,-.004]],.0038,.0028,material,1,24,7));addRootlets(group,[0,.008,0],10,.05,.018,material,rand);
  for(let i=0;i<13;i++){const a=i/13*Math.PI*2,h=.085+rand()*.075,base:Vec3=[(rand()-.5)*.05,.01,(rand()-.5)*.025],tip:Vec3=[base[0]+Math.cos(a)*.045,h,base[2]+Math.sin(a)*.045];group.add(stem([base,[base[0]+Math.cos(a)*.015,h*.5,base[2]+Math.sin(a)*.015],tip],.001,material,i));for(let j=1;j<=7;j++){const t=j/8,origin:Vec3=[T.MathUtils.lerp(base[0],tip[0],t),T.MathUtils.lerp(base[1],tip[1],t),T.MathUtils.lerp(base[2],tip[2],t)],side=j%2?1:-1,scale=Math.sin(Math.PI*t);group.add(leaf(origin,[Math.cos(a+Math.PI/2)*side,.1,Math.sin(a+Math.PI/2)*side],.029*scale,.0065*scale,material,{lobes:.8,wave:.28,round:.8,curl:.06,seed:i*11+j}));}}
}

function layeredRock(group:T.Group,material:T.Material,rand:()=>number,profile:"porous"|"crag"|"weathered"|"faceted"|"fractured"|"mountain"|"rounded"|"basalt"|"stratified"|"vesicular") {
  const geometry=new T.IcosahedronGeometry(.058,7),positions=geometry.getAttribute("position");
  const scale={porous:[1.12,.66,.84],crag:[.86,1.32,.68],weathered:[1.2,.62,.92],faceted:[1.04,.8,.8],fractured:[1.18,.68,.78],mountain:[1.28,.92,.72],rounded:[1.18,.72,.96],basalt:[1.1,.76,.9],stratified:[1.3,.75,.72],vesicular:[1.05,.78,.88]}[profile];
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),angle=Math.atan2(z,x);
    const grain=1+(rand()-.5)*.17+.08*Math.sin(angle*5+y*51);
    const layers=profile==="stratified"||profile==="mountain"?1+.1*Math.sin(y*92+x*34):1;
    positions.setXYZ(i,x*scale[0]*grain,y*scale[1]*grain*layers+.04,z*scale[2]*grain);
  }
  geometry.computeVertexNormals();group.add(new T.Mesh(geometry,material));
  const shoulder=new T.Mesh(geometry.clone(),material);shoulder.position.set(profile==="crag"?.022:-.026,.008,profile==="stratified"?.02:-.014);shoulder.scale.set(.62,.58,.66);shoulder.rotation.y=.48+rand()*.7;group.add(shoulder);
  const chips=profile==="porous"||profile==="vesicular"?12:profile==="crag"?7:6;
  for(let i=0;i<chips;i++){
    const a=rand()*Math.PI*2,r=.026+rand()*.047,chip=new T.Mesh(new T.DodecahedronGeometry(.006+rand()*.009,0),material);
    chip.position.set(Math.cos(a)*r,.017+rand()*.055,Math.sin(a)*r*.72);chip.rotation.set(rand()*2,rand()*2,rand()*2);chip.scale.setScalar(.65+rand()*.65);group.add(chip);
  }
}

function stemCanopy(group:T.Group,material:T.Material,rand:()=>number,profile:"rotala-round"|"rotala-hra"|"ludwigia"|"limnophila") {
  const count=profile==="limnophila"?27:profile==="ludwigia"?22:23;
  for(let i=0;i<count;i++){
    const a=rand()*Math.PI*2,r=Math.sqrt(rand())*.06,x=Math.cos(a)*r,z=Math.sin(a)*r,h=(profile==="limnophila"?.07:.075)+rand()*.08,bend=(rand()-.5)*.026;
    group.add(stem([[x,.003,z],[x+bend*.2,h*.4,z+(rand()-.5)*.012],[x+bend,h,z+(rand()-.5)*.02]],.00085,material,i));
    const nodes=profile==="limnophila"?7:profile==="rotala-hra"?6:5;
    for(let node=1;node<=nodes;node++){
      const t=node/(nodes+1),origin:Vec3=[x+bend*t,h*t,z],leafCount=profile==="limnophila"?5:2;
      for(let side=0;side<leafCount;side++){
        const angle=(profile==="limnophila"?side/leafCount*Math.PI*2:Math.PI/2+side*Math.PI)+(rand()-.5)*.22;
        const length=profile==="limnophila"?.015:profile==="rotala-hra"?.022:.017+rand()*.005;
        const width=profile==="limnophila"?.0015:profile==="rotala-hra"?.0022:profile==="ludwigia"?.0046:.0035;
        const round=profile==="limnophila"?.9:profile==="rotala-round"?.82:profile==="ludwigia"?.68:.42;
        group.add(leaf(origin,[Math.cos(angle),.18+rand()*.18,Math.sin(angle)],length,width,material,{round,curl:profile==="rotala-hra"?.1:.03,wave:.12,seed:i*11+node*3+side}));
      }
    }
  }
}

function pinnatifida(group:T.Group,material:T.Material,rand:()=>number) {
  const shoots=15;addRootlets(group,[0,.006,0],8,.052,.014,material,rand);
  for(let i=0;i<shoots;i++){
    const a=i/shoots*Math.PI*2,h=.045+rand()*.075,base:Vec3=[(rand()-.5)*.07,.006,(rand()-.5)*.04];
    group.add(stem([base,[base[0]+Math.cos(a)*.018,h*.5,base[2]+Math.sin(a)*.018],[base[0]+Math.cos(a)*.034,h,base[2]+Math.sin(a)*.034]],.0009,material,i));
    for(let node=1;node<=4;node++){const t=node/5,origin:Vec3=[base[0]+Math.cos(a)*.034*t,h*t,base[2]+Math.sin(a)*.034*t];for(const side of [-1,1])group.add(leaf(origin,[Math.cos(a+Math.PI/2)*side,.22,Math.sin(a+Math.PI/2)*side],.028,.0065,material,{lobes:1,wave:.34,round:.72,curl:.1,seed:i*9+node+side}));}
  }
}

function staurogyne(group:T.Group,material:T.Material,rand:()=>number) {
  runners(group,8,.085,.055,material,rand);
  for(let i=0;i<22;i++){const x=(rand()-.5)*.085,z=(rand()-.5)*.055,h=.025+rand()*.045,b=(rand()-.5)*.018;group.add(stem([[x,.002,z],[x+b,h,z]],.0009,material,i));for(let node=1;node<=3;node++){const t=node/4,origin:Vec3=[x+b*t,h*t,z];for(const side of [-1,1])group.add(leaf(origin,[side,.3,(node%2?1:-1)*.18],.016,.0048,material,{round:.7,curl:.04,seed:i*7+node+side}));}}
}

function pogostemonHelferi(group:T.Group,material:T.Material,rand:()=>number) {
  runners(group,5,.055,.04,material,rand);
  for(let crown=0;crown<7;crown++){const cx=(rand()-.5)*.065,cz=(rand()-.5)*.045;for(let i=0;i<10;i++){const a=i/10*Math.PI*2+(crown%2)*.22,length=.025+rand()*.018;group.add(leaf([cx,.003,cz],[Math.cos(a)*.82,.5,Math.sin(a)*.82],length,.0042,material,{wave:1.25,lobes:.28,round:.68,curl:.3,seed:crown*13+i}));}}
}

function helanthium(group:T.Group,material:T.Material,rand:()=>number) {
  runners(group,14,.11,.07,material,rand);
  for(let i=0;i<48;i++){const x=(rand()-.5)*.11,z=(rand()-.5)*.07,h=.03+rand()*.06,lean=(rand()-.5)*.025;group.add(leaf([x,.002,z],[lean,.98,(rand()-.5)*.14],h,.0018,material,{round:.92,curl:.08,wave:.16,seed:i}));}
}

function javaMoss(group:T.Group,material:T.Material,rand:()=>number) {
  runners(group,12,.105,.065,material,rand);
  for(let i=0;i<34;i++){const base:Vec3=[(rand()-.5)*.095,.003,(rand()-.5)*.06],a=rand()*Math.PI*2,h=.018+rand()*.04,tip:Vec3=[base[0]+Math.cos(a)*.03,h,base[2]+Math.sin(a)*.03];group.add(stem([base,[base[0]+Math.cos(a)*.012,h*.48,base[2]+Math.sin(a)*.012],tip],.00055,material,i));for(let node=1;node<=5;node++){const t=node/6,origin:Vec3=[T.MathUtils.lerp(base[0],tip[0],t),T.MathUtils.lerp(base[1],tip[1],t),T.MathUtils.lerp(base[2],tip[2],t)];for(const side of [-1,1])group.add(leaf(origin,[Math.cos(a+Math.PI/2)*side,.25,Math.sin(a+Math.PI/2)*side],.0065,.002,material,{round:.82,curl:.03,seed:i*7+node+side}));}}
}

function vallisneria(group:T.Group,material:T.Material,rand:()=>number) {
  runners(group,10,.09,.06,material,rand);
  for(let i=0;i<36;i++){
    const x=(rand()-.5)*.09,z=(rand()-.5)*.06,h=.11+rand()*.12,lean=(rand()-.5)*.07;
    group.add(branch([[x,.002,z],[x+lean*.15,h*.32,z+(rand()-.5)*.014],[x+lean*.7,h*.72,z+(rand()-.5)*.02],[x+lean,h,z+(rand()-.5)*.027]],.001,.00025,material,i,18,5));
  }
}

function swordRosette(group:T.Group,material:T.Material,rand:()=>number) {
  addRootlets(group,[0,.004,0],14,.065,.024,material,rand);
  for(let i=0;i<22;i++){
    const angle=i/22*Math.PI*2+(rand()-.5)*.16,length=.095+rand()*.105,width=.011+rand()*.007,lean=.38+rand()*.28;
    group.add(leaf([(rand()-.5)*.012,.003,(rand()-.5)*.012],[Math.cos(angle)*lean,.88,Math.sin(angle)*lean],length,width,material,{wave:.24,round:.5,curl:.16,seed:i,color:[.72,.98,.65]}));
    const rib=stem([[0,.004,0],[Math.cos(angle)*length*.18,length*.47,Math.sin(angle)*length*.18],[Math.cos(angle)*length*.42,length*.87,Math.sin(angle)*length*.42]],.00055,material,210+i);group.add(rib);
  }
}

function javaFern(group:T.Group,material:T.Material,rand:()=>number) {
  group.add(branch([[-.055,.008,.005],[-.018,.012,0],[.02,.01,-.004],[.06,.013,.003]],.0045,.003,material,230,28,8));
  addRootlets(group,[0,.009,0],12,.06,.024,material,rand);
  for(let i=0;i<18;i++){
    const angle=i/18*Math.PI*2+(rand()-.5)*.22,length=.095+rand()*.1,width=.009+rand()*.006;
    group.add(stem([[(rand()-.5)*.06,.012,(rand()-.5)*.014],[Math.cos(angle)*.016,length*.3,Math.sin(angle)*.016]],.0008,material,240+i));
    group.add(leaf([Math.cos(angle)*.016,length*.3,Math.sin(angle)*.016],[Math.cos(angle)*.44,.9,Math.sin(angle)*.44],length*.72,width,material,{wave:.72,lobes:.14,round:.66,curl:.2,seed:i,color:[.62,.9,.58]}));
  }
}

function cabomba(group:T.Group,material:T.Material,rand:()=>number) {
  const stems:T.Mesh[]=[],leaves:T.Mesh[]=[];
  for(let i=0;i<18;i++){
    const a=rand()*Math.PI*2,r=Math.sqrt(rand())*.065,x=Math.cos(a)*r,z=Math.sin(a)*r,h=.09+rand()*.105,bend=(rand()-.5)*.026;
    stems.push(stem([[x,.003,z],[x+bend*.3,h*.45,z],[x+bend,h,z+(rand()-.5)*.018]],.00072,material,270+i));
    for(let node=1;node<=6;node++){
      const t=node/7,origin:Vec3=[x+bend*t,h*t,z];
      for(let ray=0;ray<6;ray++){
        const angle=ray/6*Math.PI*2+node*.4,length=.011+rand()*.005;
        leaves.push(leaf(origin,[Math.cos(angle),.08,Math.sin(angle)],length,.00125,material,{round:.94,curl:.02,wave:.08,seed:i*43+node*6+ray,color:[.7,1,.62]}));
      }
    }
  }
  group.add(mergedMesh(stems,material),mergedMesh(leaves,material));
}

function sagittaria(group:T.Group,material:T.Material,rand:()=>number) {
  runners(group,16,.12,.08,material,rand);
  for(let i=0;i<56;i++){
    const x=(rand()-.5)*.12,z=(rand()-.5)*.08,h=.055+rand()*.1,lean=(rand()-.5)*.04;
    group.add(leaf([x,.002,z],[lean,.99,(rand()-.5)*.16],h,.0025+rand()*.0012,material,{round:.88,curl:.12,wave:.24,seed:i,color:[.68,.94,.58]}));
  }
}

function expandedCatalogModel(id:string,group:T.Group,material:T.Material,rand:()=>number) {
  const modeled=(morphology:string,build:()=>void)=>{build();group.userData.morphology=morphology;return true;};
  switch(id){
    case "wood-bogwood": return modeled("stout-broken-bogwood",()=>bogwood(group,material,rand));
    case "wood-mangrove-root": return modeled("buttressed-mangrove-root-fan",()=>mangroveRoot(group,material,rand));
    case "wood-desert-roots": return modeled("pale-open-fine-root-fan",()=>desertRoots(group,material,rand));
    case "wood-wio-sinking": return modeled("compact-gnarled-sinking-core",()=>sinkingWood(group,material,rand));
    case "wood-wio-neptune": return modeled("smooth-pale-directional-branches",()=>directionalWood(group,material,rand,true));
    case "wood-wio-dragonscale": return modeled("cavity-ridged-thick-core",()=>dragonWood(group,material,rand));
    case "wood-wio-petite": return modeled("nano-fine-open-forks",()=>petiteWood(group,material,rand));
    case "wood-wio-stone": return modeled("dense-knotted-short-root-core",()=>stoneWood(group,material,rand));
    case "wood-wio-elder": return modeled("dark-slender-root-whips",()=>elderRoot(group,material,rand));
    case "wood-wio-striped": return modeled("longitudinal-ridged-flowing-trunk",()=>stripedWood(group,material,rand));
    case "rock-dragon-stone": return modeled("pitted-layered-fissures",()=>layeredRock(group,material,rand,"porous"));
    case "rock-dragon-peaks": return modeled("tall-craggy-narrow-peak",()=>layeredRock(group,material,rand,"crag"));
    case "rock-elephant-skin": return modeled("folded-rounded-weathered-surface",()=>layeredRock(group,material,rand,"weathered"));
    case "rock-fire-stone": return modeled("angular-warm-facets",()=>layeredRock(group,material,rand,"faceted"));
    case "rock-mermaid-rose": return modeled("low-rose-fracture-planes",()=>layeredRock(group,material,rand,"fractured"));
    case "rock-mountain-stone": return modeled("wide-angular-mountain-strata",()=>layeredRock(group,material,rand,"mountain"));
    case "rock-black-river": return modeled("smooth-water-rounded-oval",()=>layeredRock(group,material,rand,"rounded"));
    case "rock-black-abyss": return modeled("near-black-irregular-mass",()=>layeredRock(group,material,rand,"basalt"));
    case "rock-blue-mountain": return modeled("blue-grey-horizontal-ridge",()=>layeredRock(group,material,rand,"stratified"));
    case "rock-wio-midnight": return modeled("near-black-vesicular-lava",()=>layeredRock(group,material,rand,"vesicular"));
    case "rock-ryuoh-stone": return modeled("blue-grey-calcareous-ridged-seams",()=>layeredRock(group,material,rand,"stratified"));
    case "plant-rotala-rotundifolia": return modeled("upright-opposite-rounded-leaf-stems",()=>stemCanopy(group,material,rand,"rotala-round"));
    case "plant-rotala-hra": return modeled("arching-narrow-leaf-stems",()=>stemCanopy(group,material,rand,"rotala-hra"));
    case "plant-ludwigia-super-red": return modeled("dense-broad-opposite-leaf-stems",()=>stemCanopy(group,material,rand,"ludwigia"));
    case "plant-hygrophila-pinnatifida": return modeled("creeping-deeply-lobed-shoots",()=>pinnatifida(group,material,rand));
    case "plant-staurogyne-repens": return modeled("compact-creeping-opposite-leaf-bush",()=>staurogyne(group,material,rand));
    case "plant-limnophila-sessiliflora": return modeled("upright-feathery-leaf-whorls",()=>stemCanopy(group,material,rand,"limnophila"));
    case "plant-pogostemon-helferi": return modeled("compact-waved-star-rosettes",()=>pogostemonHelferi(group,material,rand));
    case "plant-helanthium-tenellum": return modeled("short-ribbon-runner-lawn",()=>helanthium(group,material,rand));
    case "plant-vallisneria-nana": return modeled("long-narrow-basal-ribbons",()=>vallisneria(group,material,rand));
    case "plant-taxiphyllum-barbieri": return modeled("irregular-small-leaved-branching-mat",()=>javaMoss(group,material,rand));
    case "plant-echinodorus-bleherae": return modeled("broad-ribbed-lanceolate-sword-rosette",()=>swordRosette(group,material,rand));
    case "plant-microsorum-pteropus": return modeled("rhizome-mounted-wavy-java-fern-fronds",()=>javaFern(group,material,rand));
    case "plant-cabomba-caroliniana": return modeled("rounded-fanlike-feathery-stem-whorls",()=>cabomba(group,material,rand));
    case "plant-sagittaria-subulata": return modeled("runner-spreading-tapered-ribbon-rosettes",()=>sagittaria(group,material,rand));
    default:return false;
  }
}

/** Adds a deterministic catalog-specific model. Generic scene objects return false. */
export function buildCatalogModel(o:CatalogObject,group:T.Group,material:T.Material) {
  const id=o.catalogId;if(!id)return false;const rand=seedFor(o.variantSeed===undefined?id:`${id}:${o.variantSeed}`);
  if(expandedCatalogModel(id,group,material,rand)){
    group.userData.catalogModel=id;group.userData.modelDetail="species-specific-procedural-v2";return true;
  }
  switch(id){
    case "wood-spider": spiderWood(group,material,rand);break;
    case "wood-red-moor": spiderWood(group,material,rand,true);break;
    case "wood-manzanita": manzanita(group,material,rand);break;
    case "wood-mopani": mopani(group,material,rand);break;
    case "wood-malaysian-driftwood": mopani(group,material,rand,true);break;
    case "wood-cholla": cholla(group,material);break;
    case "wood-talawa": directionalWood(group,material,rand);break;
    case "wood-ghost": directionalWood(group,material,rand,true);break;
    case "wood-dragon": dragonWood(group,material,rand);break;
    case "wood-ancient-juniper": ancientJuniper(group,material,rand);break;
    case "plant-micranthemum-monte-carlo": monteCarlo(group,material,rand);break;
    case "plant-glossostigma-elatinoides": monteCarlo(group,material,rand,true);break;
    case "plant-anubias-petite": rhizomePlant(group,material,rand);break;
    case "plant-bucephalandra-bukit-kelam": rhizomePlant(group,material,rand,true);break;
    case "plant-alternanthera-mini": alternanthera(group,material,rand);break;
    case "plant-cryptocoryne-wendtii-green": cryptocoryne(group,material,rand);break;
    case "plant-eleocharis-pusilla-mini": eleocharis(group,material,rand);break;
    case "plant-vesicularia-weeping": weepingMoss(group,material,rand);break;
    case "plant-fissidens-fontanus": fissidens(group,material,rand);break;
    case "plant-bolbitis-heudelotii": bolbitis(group,material,rand);break;
    default:return false;
  }
  group.userData.catalogModel=id;group.userData.modelDetail="species-specific-procedural-v1";return true;
}
