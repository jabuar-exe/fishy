import * as T from "three";
import type {SceneRecord} from "./scene.ts";

export const CAMERA_VIEWS=["perspective","front","left","right","top"] as const;
export type CameraView=typeof CAMERA_VIEWS[number];

/** Perspective inspection presets fit the tank, including fixtures, at any viewport aspect. */
export function tankCameraPose(record:SceneRecord,aspect:number,view:CameraView="perspective") {
  const {width,height,depth}=record.tank,overhead=record.equipment.some(item=>item.kind==="light")?.18:0;
  const target=new T.Vector3(0,(height+overhead)/2-.01,0);
  const directions:Record<CameraView,T.Vector3>={perspective:new T.Vector3(.65,.4,1).normalize(),front:new T.Vector3(0,.03,1).normalize(),left:new T.Vector3(-1,.03,0).normalize(),right:new T.Vector3(1,.03,0).normalize(),top:new T.Vector3(0,1,.025).normalize()};
  const direction=directions[view];
  // A longer lens on the cardinal inspection views keeps the front glass from
  // dwarfing the rear planting, while retaining orbit and wheel-zoom behavior.
  const fov=view==="perspective"?30:18;
  const camera=new T.PerspectiveCamera(fov,Math.max(.1,aspect),.001,100);
  camera.position.copy(target).add(direction);camera.lookAt(target);camera.updateMatrixWorld(true);
  const inverse=camera.quaternion.clone().invert(),halfFov=Math.tan(T.MathUtils.degToRad(fov/2));
  let distance=.1;
  for(const x of [-width/2,width/2])for(const y of [-.025,height+overhead])for(const z of [-depth/2,depth/2]){
    const point=new T.Vector3(x,y,z).sub(target).applyQuaternion(inverse);
    distance=Math.max(distance,point.z+Math.abs(point.x)/(halfFov*camera.aspect),point.z+Math.abs(point.y)/halfFov);
  }
  return {target,position:target.clone().addScaledVector(direction,distance*1.14),fov};
}

/** Optional eight-second presentation moves the camera only; solid geometry stays still. */
export function presentationCameraPose(record:SceneRecord,aspect:number,progress:number) {
  const p=T.MathUtils.clamp(progress,0,1),ease=p*p*(3-2*p),base=tankCameraPose(record,aspect);
  const offset=base.position.clone().sub(base.target),spherical=new T.Spherical().setFromVector3(offset);
  spherical.theta+=.45*(1-ease);spherical.phi-=.12*(1-ease);spherical.radius*=1-.12*Math.sin(p*Math.PI);
  return {target:base.target,position:base.target.clone().add(new T.Vector3().setFromSpherical(spherical)),fov:base.fov};
}
