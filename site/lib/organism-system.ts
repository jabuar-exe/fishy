import * as T from "three";
import {boundsOf,disposeObject,tankBounds} from "./geometry.ts";
import {aquariumWaterHeight,resolveVisualProfile,type OrganismProfile,type OrganismSchool,type OrganismSpecies,type VisualProfile} from "./render-profile.ts";
import type {SceneRecord,Vec3} from "./scene.ts";
import {fishProfileById,fishVisual} from "./fish-species.ts";
import {loadAuthoredFish,type AuthoredOrganism} from "./authored-organisms.ts";

const TAU=Math.PI*2,CLEARANCE=.006;

export type OrganismPose={position:Vec3;yaw:number;tailAngle:number;finAngle:number;speed:number};
export type OrganismPath={center:[number,number,number];radiusX:number;radiusZ:number;phase:number;speed:number;size:number;species:OrganismSpecies;schoolId?:string};
export type OrganismDiagnostic={requested:number;visible:number;reason?:"disabled"|"no-open-water"};
export type OrganismSystem={group:T.Group;diagnostic:OrganismDiagnostic;ready:Promise<void>;update:(timeSeconds:number)=>void;dispose:()=>void};

function random(seed:number) {
  let value=seed>>>0;
  return ()=>{value+=0x6d2b79f5;let n=value;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
}

function bodyHalfExtents(size:number,yaw:number,species:OrganismSpecies="neon-tetra") {
  // The rig is normalized to a nose-to-tail length of `size`. Width also includes
  // the fully swept tail and pectoral fins, so this AABB remains conservative.
  const envelope=fishProfileById.get(species)?.envelope??fishProfileById.get("neon-tetra")!.envelope;
  const halfLength=size*envelope.length,halfWidth=size*envelope.width;
  return {x:Math.abs(Math.sin(yaw))*halfLength+Math.abs(Math.cos(yaw))*halfWidth,y:size*envelope.height,z:Math.abs(Math.cos(yaw))*halfLength+Math.abs(Math.sin(yaw))*halfWidth};
}

/** Conservative AABB for the complete animated fish, including its tail and fins. */
export function organismEnvelope(pose:Pick<OrganismPose,"position"|"yaw">,size:number,species:OrganismSpecies="neon-tetra") {
  const half=bodyHalfExtents(size,pose.yaw,species),[x,y,z]=pose.position;
  return new T.Box3(new T.Vector3(x-half.x,y-half.y,z-half.z),new T.Vector3(x+half.x,y+half.y,z+half.z));
}

/** Pure seeded path pose. Local +Z is the fish's visible head direction. */
export function organismPose(path:OrganismPath,timeSeconds:number):OrganismPose {
  const angle=path.phase+timeSeconds*path.speed;
  const x=path.center[0]+Math.cos(angle)*path.radiusX,z=path.center[2]+Math.sin(angle)*path.radiusZ;
  const dx=-Math.sin(angle)*path.radiusX*path.speed,dz=Math.cos(angle)*path.radiusZ*path.speed;
  const yaw=Math.atan2(dx,dz),tailAngle=Math.sin(timeSeconds*path.speed*7+path.phase)*.42,finAngle=Math.sin(timeSeconds*path.speed*4.3+path.phase)*.24;
  const tempo=fishProfileById.get(path.species)?.swimTempo??1;
  return {position:[x,path.center[1],z],yaw,tailAngle:Math.sin(timeSeconds*path.speed*7*tempo+path.phase)*.42,finAngle:Math.sin(timeSeconds*path.speed*4.3*tempo+path.phase)*.24,speed:Math.hypot(dx,dz)};
}

function wetBounds(record:SceneRecord,size:number,species:OrganismSpecies) {
  const bounds=tankBounds(record),radius=size*(fishProfileById.get(species)?.envelope.height??.28);
  bounds.min.y=Math.max(bounds.min.y+radius+CLEARANCE,record.substrate+radius+CLEARANCE);
  bounds.max.y=Math.min(bounds.max.y-radius-CLEARANCE,aquariumWaterHeight(record)-radius-CLEARANCE);
  bounds.min.x+=CLEARANCE;bounds.max.x-=CLEARANCE;bounds.min.z+=CLEARANCE;bounds.max.z-=CLEARANCE;
  return bounds;
}

function pathIsClear(path:OrganismPath,bounds:T.Box3,obstacles:T.Box3[]) {
  // Samples are not a continuous-collision proof. Expand each swept pose by its
  // maximum between-sample travel plus tail/body rotation allowance.
  const halfStep=TAU/128,travel=Math.max(path.radiusX,path.radiusZ)*halfStep;
  const yawRate=Math.max(path.radiusX/path.radiusZ,path.radiusZ/path.radiusX);
  const turn=path.size*(.58+.42)*yawRate*halfStep,sweepMargin=travel+turn;
  for(let sample=0;sample<64;sample++){
    const pose=organismPose(path,sample/64*TAU/path.speed),envelope=organismEnvelope(pose,path.size,path.species).expandByScalar(sweepMargin);
    if(!bounds.containsBox(envelope)||obstacles.some(obstacle=>obstacle.intersectsBox(envelope)))return false;
  }
  return true;
}

/** Find a looping open-water path without rejecting a whole school merely because plants overlap. */
function flattenedSchools(profile:OrganismProfile):(OrganismSchool|{id?:undefined;enabled:boolean;species:OrganismSpecies;count:number;size:number;seed:number})[] {
  // Presence of `schools` marks the multi-species representation. This avoids
  // silently adding a legacy neon group when a new scene starts with one species.
  return profile.schools?[...profile.schools]:[profile];
}

/** One deterministic route list across legacy and independently saved species schools. */
export function organismPaths(record:SceneRecord,profile:OrganismProfile):OrganismPath[] {
  const schools=flattenedSchools(profile),paths:OrganismPath[]=[];
  for(const school of schools){
  if(!school.enabled||school.count===0)continue;
  const wet=wetBounds(record,school.size,school.species);if(wet.isEmpty())continue;
  // Plants are intentionally porous. Wood and stone have conservative rendered bounds and are treated as solid.
  const obstacles=record.objects.filter(object=>object.kind!=="plant").map(boundsOf).map(bounds=>bounds.expandByScalar(CLEARANCE));
  for(let index=0;index<school.count;index++){
    const rng=random((school.seed+index*0x9e3779b9)>>>0),rangeX=wet.max.x-wet.min.x,rangeZ=wet.max.z-wet.min.z;
    let selected:OrganismPath|undefined;
    for(let attempt=0;attempt<144;attempt++){
      const foreground=attempt<48;
      const radiusX=Math.max(school.size*.72,Math.min(rangeX*.32,school.size*(foreground?2.2+rng()*2.4:1.15+rng()*1.35)));
      const radiusZ=Math.max(school.size*.72,Math.min(rangeZ*.38,school.size*(foreground?.8+rng()*.5:1.15+rng()*1.35)));
      if(radiusX*2>rangeX||radiusZ*2>rangeZ)continue;
      const path:OrganismPath={center:[T.MathUtils.lerp(wet.min.x+radiusX,wet.max.x-radiusX,foreground?.36+rng()*.28:rng()),T.MathUtils.lerp(wet.min.y,wet.max.y,rng()),T.MathUtils.lerp(wet.min.z+radiusZ,wet.max.z-radiusZ,foreground?.84+rng()*.12:rng())],radiusX,radiusZ,phase:rng()*TAU,speed:.28+rng()*.30,size:school.size,species:school.species,...(school.id?{schoolId:school.id}:{})};
      if(pathIsClear(path,wet,obstacles)){selected=path;break;}
    }
    if(selected)paths.push(selected);
  }
  }
  return paths;
}

function spindleGeometry(size:number) {
  const rings=[[-.5,.025],[-.37,.13],[-.12,.205],[.16,.19],[.39,.115],[.5,.018]] as const,sides=18,positions:number[]=[],indices:number[]=[];
  for(let ring=0;ring<rings.length;ring++)for(let side=0;side<sides;side++){const angle=side/sides*TAU,radius=rings[ring][1]*size;positions.push(Math.cos(angle)*radius,Math.sin(angle)*radius,rings[ring][0]*size);}
  for(let ring=0;ring<rings.length-1;ring++)for(let side=0;side<sides;side++){const a=ring*sides+side,b=ring*sides+(side+1)%sides,c=a+sides,d=ring*sides+(side+1)%sides+sides;indices.push(a,b,c,b,d,c);}
  const geometry=new T.BufferGeometry();geometry.setAttribute("position",new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function finGeometry(points:number[]) {const geometry=new T.BufferGeometry();geometry.setAttribute("position",new T.Float32BufferAttribute(points,3));geometry.setIndex([0,1,2]);geometry.computeVertexNormals();return geometry;}

/** Synchronous procedural fallback for catalog cards and unavailable GLBs. */
export function createFishPreviewRig(species:OrganismSpecies,size=.035,index=0) {
  const visual=fishVisual(species),root=new T.Group(),bodyMat=new T.MeshStandardMaterial({color:index%3?visual.colors[0]:visual.colors[2],roughness:.3,metalness:.12}),blueMat=new T.MeshStandardMaterial({color:visual.colors[1],emissive:visual.colors[1],emissiveIntensity:.12,roughness:.24}),redMat=new T.MeshStandardMaterial({color:visual.colors[2],roughness:.36}),finMat=new T.MeshStandardMaterial({color:visual.colors[0],transparent:true,opacity:.68,side:T.DoubleSide,depthWrite:false,roughness:.22,forceSinglePass:true}),darkMat=new T.MeshStandardMaterial({color:"#0a1728",roughness:.18});
  const body=new T.Mesh(spindleGeometry(size),bodyMat);body.name=species==="neon-tetra"?"Neon tetra spindle body":`${visual.label} articulated body`;if(visual.body==="deep")body.scale.set(1.18,1.3,1);else if(visual.body==="livebearer")body.scale.set(1.28,.9,1.05);else if(visual.body==="micro")body.scale.set(.84,.8,.84);root.add(body);
  for(const side of [-1,1]){const stripe=new T.Mesh(new T.BoxGeometry(size*.012,size*.048,size*.54),blueMat);stripe.position.set(side*size*.19,size*.035,size*.06);root.add(stripe);}
  const red=new T.Mesh(new T.BoxGeometry(size*.16,size*.045,size*.34),redMat);red.position.set(0,-size*.125,-size*.17);root.add(red);
  for(const side of [-1,1]){const eye=new T.Mesh(new T.SphereGeometry(size*.027,10,8),darkMat);eye.position.set(side*size*.125,size*.048,size*.395);root.add(eye);}
  const mouth=new T.Mesh(new T.TorusGeometry(size*.034,size*.0035,6,10,Math.PI),darkMat);mouth.name="Forward mouth";mouth.rotation.x=Math.PI/2;mouth.position.set(0,-size*.012,size*.493);root.add(mouth);
  const dorsal=new T.Mesh(finGeometry([0,size*.12,-size*.08,0,size*.27,-size*.1,0,size*.1,-size*.24]),finMat);dorsal.name="Dorsal fin";root.add(dorsal);
  const tailPivot=new T.Group();tailPivot.name="Tail joint";tailPivot.position.z=-size*.3;const tailGeometry=finGeometry([0,0,0,0,size*.2,-size*.14,0,0,-size*.2,0,0,0,0,-size*.2,-size*.14,0,0,-size*.2]);tailGeometry.setIndex([0,1,2,3,4,5]);const tail=new T.Mesh(tailGeometry,finMat);tail.name="Symmetric caudal fin";tailPivot.add(tail);root.add(tailPivot);
  const fins:T.Group[]=[];
  for(const side of [-1,1]){const finPivot=new T.Group();finPivot.name="Pectoral fin joint";finPivot.position.set(side*size*.17,-size*.01,size*.07);const fin=new T.Mesh(finGeometry([0,0,0,side*size*.13,-size*.07,-size*.08,side*size*.06,-size*.02,-size*.2]),finMat);finPivot.add(fin);root.add(finPivot);fins.push(finPivot);}
  root.userData={tailPivot,fins};root.traverse(node=>{if(node instanceof T.Mesh){node.castShadow=true;node.receiveShadow=true;}});
  root.name=`Procedural ${visual.label}`;return root;
}

export function createOrganismSystem(record:SceneRecord,resolved:VisualProfile=resolveVisualProfile(record.visual)) :OrganismSystem {
  const profile=resolved.organisms,group=new T.Group();group.name="Presentation organisms";const requested=flattenedSchools(profile).filter(s=>s.enabled).reduce((count,school)=>count+school.count,0),paths=organismPaths(record,profile),fish=paths.map((path,index)=>{const rig=createFishPreviewRig(path.species,path.size,index);group.add(rig);return {path,rig,authored:undefined as AuthoredOrganism|undefined};});
  const diagnostic:OrganismDiagnostic=!requested?{requested,visible:0,reason:"disabled"}:fish.length?{requested,visible:fish.length}:{requested,visible:0,reason:"no-open-water"};
  let disposed=false,lastTime=0;
  const update=(timeSeconds:number)=>{const time=Number.isFinite(timeSeconds)?Math.max(0,timeSeconds):0;lastTime=time;for(const {path,rig,authored} of fish){const pose=organismPose(path,time);rig.position.fromArray(pose.position);rig.rotation.y=pose.yaw;if(authored)authored.setTime(time);else{(rig.userData.tailPivot as T.Group).rotation.y=pose.tailAngle;for(const fin of rig.userData.fins as T.Group[])fin.rotation.z=pose.finAngle;}}};
  const ready=typeof window==="undefined"?Promise.resolve():Promise.all(fish.map(async swimmer=>{
    try{
      const authored=await loadAuthoredFish(swimmer.path.species,swimmer.path.size,swimmer.path.phase);
      if(disposed){authored.dispose();return;}
      group.remove(swimmer.rig);disposeObject(swimmer.rig);swimmer.rig=authored.root;swimmer.authored=authored;group.add(authored.root);update(lastTime);
    }catch{/* The existing procedural swimmer remains available when loading fails. */}
  })).then(()=>{});
  update(0);
  return {group,diagnostic,ready,update,dispose:()=>{disposed=true;for(const swimmer of fish){if(swimmer.authored)swimmer.authored.dispose();else disposeObject(swimmer.rig);}group.clear();}};
}
