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
  inletFrequency:number;
  initialDisturbance:number;
  maxDisplacement:number;
  sources?:readonly FlowSource[];
};

export const DEFAULT_WATER_FLOW:WaterFlowParameters={
  fixedTimeStep:1/120,
  maxFrameTime:1/15,
  maxSubSteps:8,
  gravity:9.81,
  effectiveDepth:.0025,
  damping:1.35,
  inletStrength:.0035,
  inletFrequency:1.1,
  initialDisturbance:.00035,
  maxDisplacement:.0025,
};

/** A small, deterministic shallow-water height field for the aquarium surface. */
export class WaterFlow {
  readonly columns:number;
  readonly rows:number;
  readonly surfaceWidth:number;
  readonly surfaceDepth:number;
  readonly heights:Float32Array;
  readonly velocities:Float32Array;
  readonly parameters:WaterFlowParameters;
  private nextHeights:Float32Array;
  private nextVelocities:Float32Array;
  private accumulator=0;
  private elapsed=0;
  private readonly dx:number;
  private readonly dz:number;
  private sources:FlowSource[];
  private useLegacyDefaultInlet:boolean;

  constructor(columns:number,rows:number,width:number,depth:number,parameters:Partial<WaterFlowParameters>={}){
    if(!Number.isInteger(columns)||!Number.isInteger(rows)||columns<2||rows<2||!Number.isFinite(width)||!Number.isFinite(depth)||width<=0||depth<=0)throw new Error("Water flow requires a positive surface with at least two rows and columns.");
    this.columns=columns;this.rows=rows;this.surfaceWidth=width;this.surfaceDepth=depth;this.parameters={...DEFAULT_WATER_FLOW,...parameters};this.useLegacyDefaultInlet=parameters.sources===undefined;this.sources=this.normaliseSources(parameters.sources??[]);
    const finiteParameters=[this.parameters.fixedTimeStep,this.parameters.maxFrameTime,this.parameters.maxSubSteps,this.parameters.gravity,this.parameters.effectiveDepth,this.parameters.damping,this.parameters.inletStrength,this.parameters.inletFrequency,this.parameters.initialDisturbance,this.parameters.maxDisplacement];
    if(finiteParameters.some(value=>!Number.isFinite(value))||this.parameters.fixedTimeStep<=0||this.parameters.maxFrameTime<=0||!Number.isInteger(this.parameters.maxSubSteps)||this.parameters.maxSubSteps<1||this.parameters.gravity<0||this.parameters.effectiveDepth<0||this.parameters.damping<0||this.parameters.maxDisplacement<=0)throw new Error("Water flow parameters must describe a stable positive time and surface scale.");
    const size=columns*rows;
    this.heights=new Float32Array(size);this.velocities=new Float32Array(size);
    this.nextHeights=new Float32Array(size);this.nextVelocities=new Float32Array(size);
    this.dx=width/(columns-1);this.dz=depth/(rows-1);
    const amplitude=this.parameters.initialDisturbance;
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
      const x=column/(columns-1),z=row/(rows-1);
      this.heights[row*columns+column]=amplitude*Math.sin(x*Math.PI*3+z*1.7)*Math.exp(-x*2.2);
    }
    this.removeMean(this.heights);
  }

  setSources(sources:readonly FlowSource[]) { this.useLegacyDefaultInlet=false;this.sources=this.normaliseSources(sources); }

  /** Render effects share simulation time, including pauses and bounded catch-up. */
  get timeSeconds(){return this.elapsed;}

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
    const {columns,rows,heights,velocities,nextHeights,nextVelocities,dx,dz}=this;
    const {gravity,effectiveDepth,damping,inletStrength,inletFrequency,maxDisplacement}=this.parameters;
    const waveSpeedSquared=gravity*effectiveDepth,invDx2=1/(dx*dx),invDz2=1/(dz*dz);
    this.elapsed+=dt;
    for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
      const index=row*columns+column,center=heights[index];
      // Repeating the edge sample imposes a no-flux boundary: waves reflect instead of leaking volume.
      const left=column?heights[index-1]:center,right=column+1<columns?heights[index+1]:center;
      const back=row?heights[index-columns]:center,front=row+1<rows?heights[index+columns]:center;
      const laplacian=(left-2*center+right)*invDx2+(back-2*center+front)*invDz2;
      const inlet=this.useLegacyDefaultInlet?this.defaultInlet(column/(columns-1),row/(rows-1),inletStrength,inletFrequency):this.sourceForcing(column/(columns-1),row/(rows-1));
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

  private sourceForcing(x:number,z:number) {
    let forcing=0;
    for(const source of this.sources){
      const radius=Math.max(.001,source.radius),dx=x-source.position[0],dz=z-source.position[1];
      const distance=Math.exp(-(dx*dx+dz*dz)/(2*radius*radius));
      const directionLength=Math.hypot(source.direction[0],source.direction[1])||1;
      const along=(dx*source.direction[0]+dz*source.direction[1])/directionLength/radius;
      const across=(dx*-source.direction[1]+dz*source.direction[0])/directionLength/radius;
      const frequency=source.frequency??1,turbulence=source.turbulence??.5;
      forcing+=this.parameters.inletStrength*source.strength*2.2*distance*Math.sin(this.elapsed*Math.PI*2*frequency-along*4+across*turbulence*5);
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
