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
  readonly heights:Float32Array;
  readonly velocities:Float32Array;
  readonly parameters:WaterFlowParameters;
  private nextHeights:Float32Array;
  private nextVelocities:Float32Array;
  private accumulator=0;
  private elapsed=0;
  private readonly dx:number;
  private readonly dz:number;

  constructor(columns:number,rows:number,width:number,depth:number,parameters:Partial<WaterFlowParameters>={}){
    if(columns<2||rows<2||width<=0||depth<=0)throw new Error("Water flow requires a positive surface with at least two rows and columns.");
    this.columns=columns;this.rows=rows;this.parameters={...DEFAULT_WATER_FLOW,...parameters};
    if(this.parameters.fixedTimeStep<=0||this.parameters.maxFrameTime<=0||!Number.isInteger(this.parameters.maxSubSteps)||this.parameters.maxSubSteps<1||this.parameters.gravity<0||this.parameters.effectiveDepth<0||this.parameters.damping<0||this.parameters.maxDisplacement<=0)throw new Error("Water flow parameters must describe a stable positive time and surface scale.");
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
      const along=column/(columns-1),across=row/(rows-1)-.5;
      const inlet=inletStrength*Math.exp(-along*5)*Math.sin(this.elapsed*Math.PI*2*inletFrequency+across*4.2);
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
}
