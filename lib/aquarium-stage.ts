import * as T from "three";
import {RoomEnvironment} from "three/examples/jsm/environments/RoomEnvironment.js";
import {makeObject} from "./geometry.ts";
import {surfaceMaterial} from "./surface-materials.ts";
import type {SceneRecord} from "./scene.ts";

export function createAquariumStage(renderer:T.WebGLRenderer) {
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  const scene=new T.Scene();scene.background=new T.Color("#111d21");scene.environmentIntensity=.55;
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight("#edf5ff","#182016",.85));
  const sun=new T.DirectionalLight("#fff4d7",3);sun.position.set(-.5,1,.25);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-1.8;sun.shadow.camera.right=1.8;sun.shadow.camera.top=1.8;sun.shadow.camera.bottom=-1.8;sun.shadow.normalBias=.002;scene.add(sun);
  const fill=new T.DirectionalLight("#a0c7d3",.5);fill.position.set(1,.5,-1);scene.add(fill);
  return {scene,dispose:()=>{env.dispose();sun.shadow.map?.dispose();}};
}
export function populateAquarium(content:T.Group,record:SceneRecord,showWater:boolean) {
  const {width:W,height:H,depth:D}=record.tank,meshes=new Map<string,T.Object3D>();let water:T.Mesh|null=null;
  const base=new T.Mesh(new T.BoxGeometry(W+.016,.02,D+.016),new T.MeshStandardMaterial({color:"#101817",roughness:.8}));base.position.y=-.012;base.receiveShadow=true;content.add(base);
  const edges=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(W,H,D)),new T.LineBasicMaterial({color:"#a8ccc0",transparent:true,opacity:.42}));edges.position.y=H/2;content.add(edges);
  const back=new T.Mesh(new T.PlaneGeometry(W,H),new T.MeshPhysicalMaterial({color:"#315347",roughness:.2,transparent:true,opacity:.28,side:T.DoubleSide}));back.position.set(0,H/2,-D/2);content.add(back);
  const sand=new T.Mesh(new T.BoxGeometry(W-.005,record.substrate,D-.005),surfaceMaterial("sand","#b8aa87"));sand.position.y=record.substrate/2;sand.receiveShadow=true;content.add(sand);
  const pebbleGeo=new T.IcosahedronGeometry(.0022,0),pebbleMat=new T.MeshStandardMaterial({color:"#91856d",roughness:1}),pebbles=new T.InstancedMesh(pebbleGeo,pebbleMat,280),matrix=new T.Matrix4();for(let i=0;i<280;i++){const x=(Math.sin(i*127.1)*43758.5453)%1,z=(Math.sin(i*269.5)*43758.5453)%1;matrix.makeTranslation(x*(W/2-.006),record.substrate,z*(D/2-.006));pebbles.setMatrixAt(i,matrix);}pebbles.receiveShadow=true;content.add(pebbles);
  for(const o of record.objects){const mesh=makeObject(o);content.add(mesh);meshes.set(o.id,mesh);}
  if(showWater){water=new T.Mesh(new T.PlaneGeometry(W-.008,D-.008,36,24),new T.MeshPhysicalMaterial({color:"#9dccbe",metalness:.05,roughness:.2,transparent:true,opacity:.11,side:T.DoubleSide,depthWrite:false}));water.rotation.x=-Math.PI/2;water.position.y=H-.015;water.renderOrder=2;content.add(water);}
  return {meshes,water};
}
