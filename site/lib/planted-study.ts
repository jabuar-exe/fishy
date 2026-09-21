import {studyPlantContacts} from "./study-plant-contacts.ts";
import {fitObject} from "./geometry.ts";
import {initialScene,validateScene,type SceneObject,type SceneRecord, type Vec3} from "./scene.ts";

type ObjectSeed={id:string;name:string;kind:SceneObject["kind"];catalogId:string;form:string;position:Vec3;size:number;color:string;rotation?:Vec3;stretch?:Vec3;protected?:boolean};

// An open sand corridor between planted, layered rock banks. All components
// remain editable scene objects; no baked scenery replaces the editor model.
const plantedSeeds:ObjectSeed[]=[
  {id:"study-wood-arch",name:"Weathered river root",kind:"wood",catalogId:"wood-ancient-juniper",form:"arch",position:[-.015,.050,-.060],rotation:[0,-.05,0],size:1.40,color:"#75634c",protected:true},
  ...([
    [-.325,.045,.025,1.13,.18,1.2],[-.315,.145,-.080,1.00,-.16,1.1],[-.320,.230,-.130,.74,.32,1.1],
    [.305,.045,.008,1.22,-.25,1.32],[.310,.160,-.070,1.08,.38,1.35],[.310,.263,-.135,.70,-.15,1.16],
    [-.155,.040,-.158,1.35,.08,2.2],[.040,.040,-.166,1.30,-.25,2.5],[.205,.040,-.171,1.15,.22,2.1],
  ] as number[][]).map(([x,y,z,size,yaw,height],i)=>({id:`study-rock-${i}`,name:`Layered river stone ${i+1}`,kind:"rock" as const,catalogId:"rock-black-river",form:[2,5].includes(i)?"faceted":"rounded",position:[x,y,z] as Vec3,rotation:[0,yaw,i>=6?0:.06*Math.sin(i)] as Vec3,stretch:[1,height,.8] as Vec3,size,color:[2,5].includes(i)?"#827358":i%3===0?"#6c7064":"#545d52"})),
  ...([
    [-.360,.295,-.150,1.60,.2],[-.235,.255,-.169,1.43,-.3],[-.105,.180,-.170,1.58,.6],
    [.045,.295,-.170,1.30,1.2],[.178,.229,-.163,1.37,-.6],[.330,.298,-.145,1.60,.3],
    [-.375,.145,-.020,1.18,-.7],[-.230,.148,-.061,1.36,.8],[.238,.170,-.007,1.25,-.4],
    [.365,.155,.056,1.18,.5],[-.130,.060,-.125,1.06,.2],[.143,.195,-.091,1.22,-.2],
  ] as number[][]).map(([x,y,z,size,yaw],i)=>({id:`study-fern-${i}`,name:`${[2,4,10].includes(i)?"Stem grove":"Bolbitis bank"} ${i+1}`,kind:"plant" as const,catalogId:[2,4,10].includes(i)?"plant-rotala-rotundifolia":"plant-bolbitis-heudelotii",form:[2,4,10].includes(i)?"stem":"fern",position:[x,y,z] as Vec3,rotation:[0,yaw,.07*Math.sin(i*3)] as Vec3,...([2,4].includes(i)?{stretch:[.9,1.12,.42] as Vec3}:{}),size:size*([2,4,10].includes(i)?.88:1.28),color:i%3===0?"#789454":"#567e3c"})),
  ...([
    [-.375,.125,.028,1.38,.2],[-.225,.054,.041,1.22,-.6],[-.140,.098,-.004,1.30,1.1],
    [.168,.069,.081,1.30,-1.1],[.300,.139,.043,1.46,.9],[.382,.050,.110,1.02,-.3],
  ] as number[][]).map(([x,y,z,size,yaw],i)=>({id:`study-anubias-${i}`,name:`Anubias on riverbank ${i+1}`,kind:"plant" as const,catalogId:"plant-anubias-petite",form:"broadleaf",position:[x,y,z] as Vec3,rotation:[0,yaw,0] as Vec3,size,color:i%2?"#597c3f":"#6e8b49"})),
  ...([
    [-.357,.041,.142,.90,.4],[-.281,.166,.015,1.02,-.7],[.258,.041,.140,.74,.1],[.279,.172,.020,.95,.8],
  ] as number[][]).map(([x,y,z,size,yaw],i)=>({id:`study-grass-${i}`,name:`${i%2?"Moss on stone":"Fine foreground grass"} ${i+1}`,kind:"plant" as const,catalogId:i%2?"plant-taxiphyllum-barbieri":"plant-eleocharis-pusilla-mini",form:i%2?"moss":"grass",position:[x,y,z] as Vec3,rotation:[0,yaw,0] as Vec3,size,color:"#7b9349"})),
  ...([
    [-.275,.322,-.126,1.28,1.1],[-.168,.304,-.139,1.45,-.9],[-.055,.317,-.143,1.34,.5],
    [.088,.326,-.146,1.36,2.1],[.252,.324,-.139,1.32,-1.5],
    [-.350,.229,-.047,1.24,-1.8],[-.220,.214,-.054,1.08,.4],[.335,.233,-.042,1.25,2.5],
    [-.172,.265,-.030,.98,.8],[-.069,.298,-.024,.90,-.6],[.054,.285,-.014,1.02,1.7],
    [.208,.223,.036,1.08,-1.3],[-.258,.112,.047,.94,2.2],[.303,.114,.075,1.00,-.8],
  ] as number[][]).map(([x,y,z,size,yaw],i)=>({id:`study-epiphyte-${i}`,name:`Attached fern patch ${i+1}`,kind:"plant" as const,catalogId:"plant-bolbitis-heudelotii",form:"fern",position:[x,y,z] as Vec3,rotation:[.08*Math.sin(i),yaw,.07*Math.cos(i)] as Vec3,size,color:i%3===0?"#758c4e":"#51783e"})),
  ...([
    [-.390,.203,-.041,1.08,.9],[-.213,.225,-.079,1.10,-1.2],[-.030,.287,-.123,1.03,.4],
    [.240,.230,-.028,1.17,-.6],[.351,.216,-.074,1.04,1.8],[.136,.119,-.047,.97,2.4],
  ] as number[][]).map(([x,y,z,size,yaw],i)=>({id:`study-canopy-leaf-${i}`,name:`Broadleaf canopy ${i+1}`,kind:"plant" as const,catalogId:"plant-anubias-petite",form:"broadleaf",position:[x,y,z] as Vec3,rotation:[0,yaw,i>=6?0:.06*Math.sin(i)] as Vec3,size,color:i%2?"#547e3d":"#75984c"})),
  ...([
    [-.141,.051,.075,1.35,.4],[.189,.052,.070,1.45,-.8],[-.291,.249,-.016,1.00,.2],[.299,.267,-.062,1.16,-1.2],
  ] as number[][]).map(([x,y,z,size,yaw],i)=>({id:`study-attached-moss-${i}`,name:`Root and stone moss ${i+1}`,kind:"plant" as const,catalogId:"plant-taxiphyllum-barbieri",form:"moss",position:[x,y,z] as Vec3,rotation:[0,yaw,0] as Vec3,size,color:"#61833f"})),
];

function sceneFromSeeds(seeds:readonly ObjectSeed[],name:string,tank:SceneRecord["tank"]={width:.6,depth:.36,height:.36,source:"user-entered"}) {
  const base=initialScene();
  const draft={...base,name,tank,substrate:.04,objects:[] as SceneObject[]};
  draft.objects=seeds.map(seed=>fitObject({...seed,rotation:seed.rotation??[0,0,0] as Vec3,protected:seed.protected??false},draft,true));
  return validateScene(draft);
}

/** A voluntary, saved editable composition; callers apply it through the normal undo transaction. */
export function createPlantedStudy():SceneRecord {
  const study=sceneFromSeeds(plantedSeeds.map(seed=>({...seed,position:studyPlantContacts[seed.id]??seed.position,...(seed.form==="moss"?{stretch:[1,.62,1] as Vec3}:{})})),"Ravine riverbank study",{width:.9,depth:.45,height:.45,source:"user-entered"});
  return validateScene({...study,visual:{...study.visual,waterLevel:.32,cascade:true,organisms:{...study.visual.organisms,enabled:true,count:9,size:.020,seed:6021}}});
}

/** Preserve the current save identity and revision when loading the optional study. */
export function applyPlantedStudyTo(current:SceneRecord):SceneRecord {
  const study=createPlantedStudy();
  return {...study,id:current.id,name:current.name,revision:current.revision,references:current.references,brief:current.brief};
}

/** Deterministic 32-object fixture for renderer budgets, using the same supported asset families. */
export function createFidelityStressStudy():SceneRecord {
  const seeds:ObjectSeed[]=[];
  for(let index=0;index<32;index++){
    const column=index%8,row=Math.floor(index/8),x=-.36+column*.103,z=-.15+row*.1,kind=index%8===0?"rock":"plant";
    seeds.push(kind==="rock"?{id:`stress-rock-${index}`,name:`Stress river stone ${index+1}`,kind,catalogId:"rock-black-river",form:"rounded",position:[x,.04,z],size:.42,color:"#303838"}:{id:`stress-plant-${index}`,name:`Stress planting ${index+1}`,kind,catalogId:index%3===0?"plant-bolbitis-heudelotii":index%3===1?"plant-anubias-petite":"plant-eleocharis-pusilla-mini",form:index%3===0?"fern":index%3===1?"broadleaf":"grass",position:[x,.04,z],size:.5,color:index%3===2?"#6f9c4a":"#487f47"});
  }
  return sceneFromSeeds(seeds,"Fidelity stress study",{width:.9,depth:.45,height:.45,source:"user-entered"});
}
