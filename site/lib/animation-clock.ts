/** One bounded clock for every visual subsystem. Pauses never create catch-up jumps. */
export class AquariumClock {
  time=0;
  private previous:number|null=null;
  tick(timestampMs:number,playing:boolean) {
    const delta=this.previous===null?0:Math.max(0,Math.min(.05,(timestampMs-this.previous)/1000));
    this.previous=timestampMs;
    if(playing)this.time+=delta;
    return playing?delta:0;
  }
  suspend(){this.previous=null;}
  seek(seconds:number){this.time=Math.max(0,Number.isFinite(seconds)?seconds:0);this.previous=null;}
}

export function frameStatistics(samples:number[]) {
  const sorted=samples.filter(n=>Number.isFinite(n)&&n>0).sort((a,b)=>a-b);
  if(!sorted.length)return {median:0,p95:0,fps:0};
  const median=sorted[Math.floor((sorted.length-1)/2)],p95=sorted[Math.ceil(sorted.length*.95)-1];
  return {median,p95,fps:1000/median};
}
