import * as T from "three";

/** Estimate accessible material/environment/shadow textures, not driver VRAM. */
export function estimatedTextureMiB(scene:T.Scene) {
  const seen=new Set<string>();let bytes=0;
  const count=(texture:T.Texture|null|undefined)=>{
    if(!texture)return;
    const key=texture.source.uuid+":"+texture.type;
    if(seen.has(key))return;seen.add(key);
    const image=texture.image as {width?:number;height?:number}|undefined;
    const channelBytes=texture.type===T.FloatType?4:texture.type===T.HalfFloatType?2:1;
    bytes+=(image?.width??0)*(image?.height??0)*4*channelBytes*(texture.generateMipmaps?4/3:1);
  };
  count(scene.environment);if(scene.background instanceof T.Texture)count(scene.background);
  scene.traverse(node=>{
    if(node instanceof T.Mesh)for(const material of Array.isArray(node.material)?node.material:[node.material])for(const value of Object.values(material))if(value instanceof T.Texture)count(value);
    if(node instanceof T.DirectionalLight||node instanceof T.SpotLight){count(node.shadow.map?.texture);count(node.shadow.map?.depthTexture);}
  });
  return bytes/1048576;
}
