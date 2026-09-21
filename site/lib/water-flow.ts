export type FlowSource={
  /** Normalized water-surface location, from the back-left corner. */
  position:[number,number];
  /** Direction in the horizontal x/z plane. */
  direction:[number,number];
  radius:number;
  strength:number;
  frequency?:number;
  turbulence?:number;
};

export type WaterFlowParameters={
  fixedTimeStep:number;
  maxFrameTime:number;
  maxSubSteps:number;
  gravity:number;
  effectiveDepth:number;
  damping:number;
  inletStrength:number;
  /** Coupling from an installed outlet's circulation profile to surface acceleration. */
  outletForcing:number;
  inletFrequency:number;
  initialDisturbance:number;
  maxDisplacement:number;
  sources?:readonly FlowSource[];
};

export type WaterSurfaceGrid={
  columns:number;
  rows:number;
  width:number;
  depth:number;
};

export const DEFAULT_WATER_FLOW:WaterFlowParameters={
  fixedTimeStep:1/120,
  maxFrameTime:1/15,
  maxSubSteps:8,
  gravity:9.81,
  effectiveDepth:.0025,
  damping:1.35,
  inletStrength:.0035,
  // A small aquarium surface needs sub-millimetre motion to read in reflections.
  // This stays well below the 2.5 mm physical displacement guard below.
  outletForcing:20,
  inletFrequency:1.1,
  initialDisturbance:.00035,
  maxDisplacement:.0025,
};

/** A small, deterministic shallow-water height field for the aquarium surface. */
export class WaterFlow {
  readonly columns:number;
  readonly rows:number;
  readonly width:number;
  readonly depth:number;
  readonly heights:Float32Array;
  readonly velocities:Float32Array;
  readonly parameters:WaterFlowParameters;
  private nextHeights:Float32Array;
  private nextVelocities:Float32Array;
  private accumulator=0;
  private elapsed=0;
  private readonly dx:number;
  private readonly dz:number;
  private readonly maximumStableStep:number;
  private sources:FlowSource[];
  private useLegacyDefaultInlet:boolean;

  constructor(columns:number,rows:number,width:number,depth:number,parameters:Partial<WaterFlowParameters>={}){
    if(columns<2||rows<2||width<=0||depth<=0)throw new Error("Water flow requires a positive surface with at least two rows and columns.");
    this.columns=columns;this.rows=rows;this.width=width;this.depth=depth;this.parameters={...DEFAULT_WATER_FLOW,...parameters};this.useLegacyDefaultInlet=parameters.sources===undefined;this.sources=this.normaliseSources(parameters.sources??[]);
    if(this.parameters.fixedTimeStep<=0||this.parameters.maxFrameTime<=0||!Number.isInteger(this.parameters.maxSubSteps)||this.parameters.maxSubSteps<1||this.parameters.gravity<0||this.parameters.effectiveDepth<0||this.parameters.damping<0||this.parameters.inletStrength<0||this.parameters.outletForcing<0||this.parameters.maxDisplacement<=0)throw new Error("Water flow parameters must describe a stable positive time and surface scale.");
    const size=columns*rows;
    this.heights=new Float32Array(size);this.velocities=new Float32Array(size);
    this.nextHeights=new Float32Array(size);this.nextVelocities=new Float32Array(size);
    this.dx=width/(columns-1);this.dz=depth/(rows-1);
    const waveSpeed=Math.sqrt(this.parameters.gravity*this.parameters.effectiveDepth);
    // Explicit finite differences are stable while c dt sqrt(dx^-2 + dz^-2) <= 1.
    // Keep margin for outlet forcing and make this invariant independent of grid quality.
    this.maximumStableStep=waveSpeed>0?.82/(waveSpeed*Math.hypot(1/this.dx,1/this.dz)):Infinity;
    const amplitude=this.parameters.initialDisturbance;
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
      const x=column/(columns-1),z=row/(rows-1);
      this.heights[row*columns+column]=amplitude*Math.sin(x*Math.PI*3+z*1.7)*Math.exp(-x*2.2);
    }
    this.removeMean(this.heights);
  }

  setSources(sources:readonly FlowSource[]) { this.useLegacyDefaultInlet=false;this.sources=this.normaliseSources(sources); }

  /** Sample the directional current field used by planted/equipment-aware consumers. */
  sampleCurrent(x:number,z:number):[number,number] {
    let currentX=0,currentZ=0;
    for(const source of this.sources){
      const dx=x-source.position[0],dz=z-source.position[1],radius=Math.max(.001,source.radius);
      const falloff=Math.exp(-(dx*dx+dz*dz)/(2*radius*radius));
      currentX+=source.direction[0]*source.strength*falloff;
      currentZ+=source.direction[1]*source.strength*falloff;
    }
    return [currentX,currentZ];
  }

  advance(frameSeconds:number){
    if(!Number.isFinite(frameSeconds)||frameSeconds<=0)return 0;
    const {fixedTimeStep,maxFrameTime,maxSubSteps}=this.parameters;
    this.accumulator=Math.min(this.accumulator+Math.min(frameSeconds,maxFrameTime),fixedTimeStep*maxSubSteps);
    const steps=Math.min(Math.floor((this.accumulator+fixedTimeStep*1e-9)/fixedTimeStep),maxSubSteps);
    for(let i=0;i<steps;i++)this.step(fixedTimeStep);
    this.accumulator-=steps*fixedTimeStep;
    return steps;
  }

  private step(dt:number){
    const substeps=Math.max(1,Math.ceil(dt/this.maximumStableStep));
    const stableDt=dt/substeps;
    for(let step=0;step<substeps;step++)this.integrate(stableDt);
  }

  private integrate(dt:number){
    const {columns,rows,heights,velocities,nextHeights,nextVelocities,dx,dz}=this;
    const {gravity,effectiveDepth,damping,inletStrength,inletFrequency,outletForcing,maxDisplacement}=this.parameters;
    const waveSpeedSquared=gravity*effectiveDepth,invDx2=1/(dx*dx),invDz2=1/(dz*dz);
    this.elapsed+=dt;
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
      const index=row*columns+column,center=heights[index];
      // Repeating the edge sample imposes a no-flux boundary: waves reflect instead of leaking volume.
      const left=column?heights[index-1]:center,right=column+1<columns?heights[index+1]:center;
      const back=row?heights[index-columns]:center,front=row+1<rows?heights[index+columns]:center;
      const laplacian=(left-2*center+right)*invDx2+(back-2*center+front)*invDz2;
      const inlet=this.useLegacyDefaultInlet?this.defaultInlet(column/(columns-1),row/(rows-1),inletStrength,inletFrequency):this.sourceForcing(column/(columns-1),row/(rows-1),outletForcing);
      const velocity=velocities[index]+(waveSpeedSquared*laplacian+inlet-damping*velocities[index])*dt;
      nextVelocities[index]=velocity;nextHeights[index]=center+velocity*dt;
    }
    this.removeMean(nextHeights);
    let peak=0;for(const height of nextHeights)peak=Math.max(peak,Math.abs(height));
    if(peak>maxDisplacement){const scale=maxDisplacement/peak;for(let i=0;i<nextHeights.length;i++){nextHeights[i]*=scale;nextVelocities[i]*=scale;}}
    heights.set(nextHeights);velocities.set(nextVelocities);
  }

  private removeMean(values:Float32Array){
    let sum=0;for(const value of values)sum+=value;
    const mean=sum/values.length;
    for(let i=0;i<values.length;i++)values[i]-=mean;
  }

  private defaultInlet(along:number,row:number,strength:number,frequency:number) {
    const across=row-.5;
    return strength*Math.exp(-along*5)*Math.sin(this.elapsed*Math.PI*2*frequency+across*4.2);
  }

  private sourceForcing(x:number,z:number,outletForcing:number) {
    let forcing=0;
    for(const source of this.sources){
      const radius=Math.max(.001,source.radius),dx=x-source.position[0],dz=z-source.position[1];
      const distance=Math.exp(-(dx*dx+dz*dz)/(2*radius*radius));
      const directionLength=Math.hypot(source.direction[0],source.direction[1])||1;
      const along=(dx*source.direction[0]+dz*source.direction[1])/directionLength/radius;
      const across=(dx*-source.direction[1]+dz*source.direction[0])/directionLength/radius;
      const frequency=source.frequency??1,turbulence=source.turbulence??.5;
      // The outlet is a localized oscillatory pressure impulse. Its directional
      // phase creates a short wake; the height field then propagates it, reflects
      // it from the walls, and damps it without inventing water volume.
      forcing+=this.parameters.inletStrength*source.strength*outletForcing*distance*Math.sin(this.elapsed*Math.PI*2*frequency-along*4+across*turbulence*5);
    }
    return forcing;
  }

  private normaliseSources(sources:readonly FlowSource[]) {
    return sources.flatMap(source=>{
      const values=[...source.position,...source.direction,source.radius,source.strength,source.frequency??1,source.turbulence??.5];
      if(values.some(value=>!Number.isFinite(value))||source.radius<=0||source.strength<0)return [];
      const length=Math.hypot(source.direction[0],source.direction[1]);
      if(length<1e-6)return [];
      return [{position:[Math.max(0,Math.min(1,source.position[0])),Math.max(0,Math.min(1,source.position[1]))] as [number,number],direction:[source.direction[0]/length,source.direction[1]/length] as [number,number],radius:Math.max(.02,Math.min(.7,source.radius)),strength:Math.min(1,source.strength),frequency:Math.max(.1,Math.min(4,source.frequency??1)),turbulence:Math.max(0,Math.min(2,source.turbulence??.5))}];
    });
  }
}

/**
 * Keep a live wake across equipment-only scene rebuilds. Tank or quality changes
 * use a fresh field so its cells always match the rendered geometry exactly.
 */
export function waterFlowForSurface(previous:WaterFlow|null,grid:WaterSurfaceGrid,sources:readonly FlowSource[]) {
  if(previous&&previous.columns===grid.columns&&previous.rows===grid.rows&&Math.abs(previous.width-grid.width)<1e-9&&Math.abs(previous.depth-grid.depth)<1e-9){
    previous.setSources(sources);
    return previous;
  }
  // The renderer's export/start frame is calm and reproducible. Active outlets
  // begin adding energy on the shared animation clock rather than at construction.
  return new WaterFlow(grid.columns,grid.rows,grid.width,grid.depth,{sources,initialDisturbance:0});
}
