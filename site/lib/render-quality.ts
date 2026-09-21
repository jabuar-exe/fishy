export type RenderQualityPreference="auto"|"high"|"low";
export type RenderQualityTier="high"|"low";

export type RenderQualityInput={
  preference?:RenderQualityPreference;
  viewport?:{width:number;height:number;devicePixelRatio?:number};
  /** Recent p95 frame duration, supplied by the renderer diagnostic loop when available. */
  p95FrameMs?:number;
  previous?:RenderQualityTier;
};

export type RenderQuality={
  tier:RenderQualityTier;
  pixelRatioCap:number;
  shadowMapSize:number;
  waterSegments:{width:number;height:number};
  reflectionResolution:number;
  plantSwayBudget:number;
  waterShimmer:boolean;
};

const HIGH:RenderQuality={tier:"high",pixelRatioCap:1.8,shadowMapSize:1536,waterSegments:{width:44,height:30},reflectionResolution:512,plantSwayBudget:128,waterShimmer:true};
const LOW:RenderQuality={tier:"low",pixelRatioCap:1.25,shadowMapSize:768,waterSegments:{width:24,height:16},reflectionResolution:0,plantSwayBudget:14,waterShimmer:false};

/**
 * Select an effect budget without reading browser globals. The separate downgrade and
 * upgrade thresholds keep an auto-quality scene from oscillating around one frame time.
 */
export function resolveRenderQuality(input:RenderQualityInput={}):RenderQuality {
  const preference=input.preference??"auto";
  if(preference==="high")return {...HIGH,waterSegments:{...HIGH.waterSegments}};
  if(preference==="low")return {...LOW,waterSegments:{...LOW.waterSegments}};
  const width=input.viewport?.width??1024,height=input.viewport?.height??768,dpr=input.viewport?.devicePixelRatio??1;
  const compact=Math.min(width,height)<520||width<680||dpr>2.25;
  const p95=input.p95FrameMs;
  // Hysteresis: high falls back only above 34ms; low returns only below 24ms.
  const tier=input.previous==="low"?(p95!==undefined&&p95<24&&!compact?"high":"low"):(p95!==undefined&&p95>34?"low":compact?"low":"high");
  return tier==="high"?{...HIGH,waterSegments:{...HIGH.waterSegments}}:{...LOW,waterSegments:{...LOW.waterSegments}};
}
