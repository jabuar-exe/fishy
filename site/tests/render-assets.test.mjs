import {test} from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {initialScene} from "../lib/scene.ts";
import {boundsOf,makeObject,disposeObject} from "../lib/geometry.ts";
import {enhanceAquariumAssets,releaseFidelityAssetCache,cloneFidelityAsset,fidelityAssetFor,localBounds,replaceInteriorWithAsset} from "../lib/render-assets.ts";

test("fidelity assets map only supported forms and never replace sculpted objects",()=>{
  assert.equal(fidelityAssetFor({kind:"wood",form:"arch"}),"wood-arch");
  assert.equal(fidelityAssetFor({kind:"rock",form:"faceted"}),"rock-strata");
  assert.equal(fidelityAssetFor({kind:"rock",form:"rounded"}),"rock-rounded");
  assert.equal(fidelityAssetFor({kind:"plant",form:"fern"}),"plant-fern");
  assert.equal(fidelityAssetFor({kind:"plant",form:"stem"}),"plant-stem");
  assert.equal(fidelityAssetFor({kind:"plant",form:"grass",sculpt:{nodes:[{}]}}),null);
});

test("asset fit uses local bounds and preserves the selectable root",()=>{
  const root=new T.Group();root.userData.objectId="wood-arch";root.rotation.y=.8;
  const procedural=new T.Mesh(new T.BoxGeometry(4,2,1));root.add(procedural);
  const target=localBounds(root),asset=new T.Group();asset.add(new T.Mesh(new T.BoxGeometry(2,1,1)));
  replaceInteriorWithAsset(root,asset,"wood-arch");
  const fitted=localBounds(root),expected=target.getSize(new T.Vector3()),actual=fitted.getSize(new T.Vector3());
  assert(actual.x<=expected.x&&actual.y<=expected.y&&actual.z<=expected.z);
  assert(Math.abs(actual.x/actual.y-2)<1e-6);
  assert(Math.abs(actual.y/actual.z-1)<1e-6);
  assert(Math.abs(actual.z-expected.z*.985)<1e-6);
  assert(Math.abs(fitted.min.y-target.min.y)<1e-6);
  assert.equal(root.userData.objectId,"wood-arch");
  assert.equal(root.children.length,1);
  assert.equal(root.userData.fidelityAsset,"wood-arch");
});

test("scene bounds rotate the canonical local union instead of sparse child AABBs",()=>{
  const base=initialScene().objects.find(object=>object.kind==="plant"),object={...base,position:[.1,.05,.06],rotation:[0,.73,0],size:1.2};
  const root=makeObject(object),world=root.matrixWorld.clone(),childBounds=new T.Box3().setFromObject(root);
  root.matrixAutoUpdate=false;root.matrix.identity();root.matrixWorld.identity();root.updateMatrixWorld(true);
  const canonical=new T.Box3().setFromObject(root).applyMatrix4(world);disposeObject(root);
  const measured=boundsOf(object);
  assert(canonical.min.x<childBounds.min.x-.01&&canonical.max.z>childBounds.max.z+.01);
  assert(measured.min.distanceTo(canonical.min)<1e-9&&measured.max.distanceTo(canonical.max)<1e-9);
});

test("cached-source clones own their material textures for safe per-root disposal",()=>{
  const texture=new T.Texture(),material=new T.MeshStandardMaterial({map:texture}),source=new T.Group();
  source.add(new T.Mesh(new T.BoxGeometry(1,1,1),material));
  const clone=cloneFidelityAsset(source),cloneMesh=clone.children[0];
  assert(cloneMesh instanceof T.Mesh);
  const cloneMaterial=cloneMesh.material;
  assert(cloneMaterial instanceof T.MeshStandardMaterial);
  assert.notEqual(cloneMesh.geometry,source.children[0].geometry);
  assert.notEqual(cloneMaterial,material);
  assert.notEqual(cloneMaterial.map,texture);
  let sourceDisposed=0;texture.dispose=()=>{sourceDisposed++;};
  cloneMaterial.map?.dispose();
  assert.equal(sourceDisposed,0);
});

test("failed assets retain the editable procedural scene and a later attempt can recover",async t=>{
  await releaseFidelityAssetCache();
  const record=initialScene();record.objects=record.objects.slice(0,1);
  const content=new T.Group(),root=makeObject(record.objects[0]),meshes=new Map([[record.objects[0].id,root]]);content.add(root);
  const before=root.children.slice();
  const stub=t.mock.method(GLTFLoader.prototype,"loadAsync",async()=>{throw new Error("offline");});
  assert.deepEqual(await enhanceAquariumAssets(content,record,meshes),{loaded:0,fallback:1});
  assert.deepEqual(root.children,before);assert.equal(root.userData.objectId,record.objects[0].id);
  stub.mock.mockImplementation(async()=>{const scene=new T.Group();scene.add(new T.Mesh(new T.BoxGeometry(.2,.1,.1),new T.MeshStandardMaterial()));return {scene};});
  assert.equal((await enhanceAquariumAssets(content,record,meshes)).loaded,1);
  assert.equal(root.userData.fidelityAsset,"wood-arch");disposeObject(content);await releaseFidelityAssetCache();
});

test("independent asset hydrations start together and retain only a failed root",async t=>{
  await releaseFidelityAssetCache();const record=initialScene();record.objects=[record.objects[0],record.objects[1]];
  const content=new T.Group(),roots=record.objects.map(object=>makeObject(object)),meshes=new Map(record.objects.map((object,index)=>[object.id,roots[index]]));roots.forEach(root=>content.add(root));
  const before=roots.map(root=>root.children.slice()),started=[],deferred=new Map();
  t.mock.method(GLTFLoader.prototype,"loadAsync",url=>new Promise((resolve,reject)=>{started.push(url);deferred.set(url,{resolve,reject});}));
  const pending=enhanceAquariumAssets(content,record,meshes);
  assert.deepEqual([...started].sort(),["/render-assets/models/rock-strata.glb","/render-assets/models/wood-arch.glb"]);
  const scene=new T.Group();scene.add(new T.Mesh(new T.BoxGeometry(.2,.1,.1),new T.MeshStandardMaterial()));
  deferred.get("/render-assets/models/wood-arch.glb").resolve({scene});deferred.get("/render-assets/models/rock-strata.glb").reject(new Error("offline"));
  assert.deepEqual(await pending,{loaded:1,fallback:1});assert.equal(roots[0].userData.fidelityAsset,"wood-arch");assert.deepEqual(roots[1].children,before[1]);
  disposeObject(content);await releaseFidelityAssetCache();
});

test("an aborted hydration cannot replace the scene after its loader settles",async t=>{
  await releaseFidelityAssetCache();const record=initialScene();record.objects=[record.objects[0],record.objects[1]];
  const content=new T.Group(),roots=record.objects.map(object=>makeObject(object)),meshes=new Map(record.objects.map((object,index)=>[object.id,roots[index]]));roots.forEach(root=>content.add(root));
  const before=roots.map(root=>root.children.slice()),deferred=new Map(),controller=new AbortController();
  t.mock.method(GLTFLoader.prototype,"loadAsync",url=>new Promise(done=>{deferred.set(url,done);}));
  const pending=enhanceAquariumAssets(content,record,meshes,controller.signal);controller.abort();
  for(const resolve of deferred.values()){const scene=new T.Group();scene.add(new T.Mesh(new T.BoxGeometry(1,1,1)));resolve({scene});}await pending;
  for(const [index,root] of roots.entries()){assert.deepEqual(root.children,before[index]);assert.equal(root.userData.fidelityAsset,undefined);}
  disposeObject(content);await releaseFidelityAssetCache();
});
