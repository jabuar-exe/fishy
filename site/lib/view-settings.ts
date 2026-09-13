import type {PerspectiveCamera} from "three";
import type {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";

export const BACKGROUNDS=[{id:"dark",name:"Dark studio",color:"#111d21"},{id:"light",name:"Light studio",color:"#e9ece8"},{id:"room",name:"Room photo",color:"#111d21"}] as const;
export type BackgroundMode=typeof BACKGROUNDS[number]["id"];
export type RoomPhoto={url:string;name:string};
export type ViewSettings={mode:BackgroundMode;photo:RoomPhoto|null;zoom:number;x:number;y:number};
export const initialViewSettings=():ViewSettings=>({mode:"dark",photo:null,zoom:100,x:50,y:50});
export function configureTankOrbit(orbit:OrbitControls){orbit.minPolarAngle=.025;orbit.maxPolarAngle=Math.PI/2;}
/** Pan must not circumvent the upper-hemisphere orbit limit. */
export function keepCameraAboveTank(camera:PerspectiveCamera,orbit:OrbitControls){
  const lift=Math.max(0,.001-orbit.target.y,.001-camera.position.y);
  if(lift){orbit.target.y+=lift;camera.position.y+=lift;}
}
export function validateRoomFile(file:{type:string;size:number}){
  if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Choose a JPEG, PNG or WebP room photo.");
  if(file.size<=0||file.size>10*1024*1024)throw new Error("Choose a room photo under 10 MB.");
}
export function validateRoomDimensions(width:number,height:number){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width*height>24_000_000)throw new Error("Choose a room photo under 24 megapixels.");
}
