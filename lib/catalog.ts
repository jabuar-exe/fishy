import registry from "../public/data/catalog-registry.json" with {type:"json"};
import type {SceneObject,SceneRecord} from "./scene";
import {fitObject} from "./geometry.ts";

export type CatalogReferenceImage={src:string;alt:string;scope:string;sourceUrl:string;author:string;license:string;licenseUrl:string};
export type CatalogEntry={id:string;displayLabel:string;kind:"wood"|"plant";browseTags:string[];placementRole:string;rendererForm:string;status:string;source:{url:string;publisher:string};identityCaveat:string;renderingLimit:string;referenceImage:CatalogReferenceImage};
export const catalogEntries=registry.entries as CatalogEntry[];

/** One descriptor for thumbnails, interactive samples and the Add transaction. */
export function catalogDescriptor(entry:CatalogEntry,id:string):SceneObject {
  if(entry.status!=="supported_procedural")throw new Error("This material is source-only; no 3D sample or addable model is available.");
  return {id,name:entry.displayLabel,kind:entry.kind,position:[0,0,0],rotation:[0,0,0],size:entry.kind==="wood"?.65:1,form:entry.rendererForm,color:entry.kind==="wood"?"#9d7751":/alternanthera/.test(entry.id)?"#924750":"#477d3c",protected:false,catalogId:entry.id};
}
export function catalogObject(entry:CatalogEntry,scene:SceneRecord,id:string):SceneObject {
  const object=catalogDescriptor(entry,id);object.position[1]=scene.substrate;return fitObject(object,scene,true);
}
