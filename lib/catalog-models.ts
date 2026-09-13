import * as T from "three";
import type {SceneObject,Vec3} from "./scene";

type CatalogObject=Pick<SceneObject,"kind"|"catalogId">;

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

/** Adds a deterministic catalog-specific model. Generic scene objects return false. */
export function buildCatalogModel(o:CatalogObject,group:T.Group,material:T.Material) {
  const id=o.catalogId;if(!id)return false;const rand=seedFor(id);
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
