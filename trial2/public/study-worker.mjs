import {Cell, PROGRAM} from './cell-core.mjs';

const STEP = .05;
const RECIPES = [
  {body:'B1',cap:'C1',top:'T1',destination:'dispatch'},
  {body:'B2',cap:'C2',top:'T2',destination:'dispatch'},
  {body:'B3',cap:'C3',top:'T3',destination:'dispatch'},
  {body:'B4',cap:'C4',top:'T4',destination:'dispatch'}
];
const SPEEDS = [.5,.75,1,1.25,1.5,1.75,2];

function evaluate(speed, input) {
  const cell = new Cell();
  cell.command('speed',speed);
  cell.command('run',RECIPES.slice(0,input.jobs));
  const times = {rail:0,fanuc:0,ur3e:0,ur10:0,vision:0,operator:0,waiting:0,other:0};
  let readyAt = null;
  for (let i=0; !cell.complete && i<30000; i++) {
    if (cell.awaitingLoad() && !cell.loading) {
      readyAt ??= cell.time;
      if (cell.time-readyAt+1e-7>=input.delay) cell.command('load_workpiece',cell.selection.body);
    }
    if (PROGRAM[cell.index].id==='fixture' && !cell.awaitingLoad() && !cell.running) {
      cell.command('resume');
      readyAt=null;
    }
    const stage=PROGRAM[cell.index];
    const owner=cell.loading?'operator':!cell.running?'waiting':stage.owner;
    times[Object.hasOwn(times,owner)?owner:'other']+=STEP;
    cell.tick(STEP);
  }
  if(!cell.complete||cell.finished.length!==input.jobs) throw Error('Candidate failed to complete the batch.');
  const motion=times.rail+times.fanuc+times.ur3e+times.ur10;
  const energy=input.idleWatts===null?null:
    (input.idleWatts*cell.time+input.motionWatts*speed**2*motion)/3600;
  return {speed,seconds:cell.time,parts:cell.finished.length,rate:3600*cell.finished.length/cell.time,energy,times};
}

self.onmessage=({data})=>{
  try{
    const {jobs,delay,target,idleWatts,motionWatts}=data;
    if(!Number.isInteger(jobs)||jobs<1||jobs>4||!Number.isFinite(delay)||delay<0||delay>60||
       !Number.isFinite(target)||target<0||target>10000)throw Error('Check the batch, delay and target inputs.');
    const hasEnergy=idleWatts!==null||motionWatts!==null;
    if(hasEnergy&&![idleWatts,motionWatts].every(n=>Number.isFinite(n)&&n>=0&&n<=10000)){
      throw Error('Enter both power assumptions, or leave both blank.');
    }
    const rows=SPEEDS.map(speed=>evaluate(speed,{jobs,delay,idleWatts,motionWatts}));
    const cost=row=>hasEnergy?row.energy:row.speed;
    for(const row of rows){
      row.pareto=!rows.some(other=>other.rate>=row.rate&&cost(other)<=cost(row)&&
        (other.rate>row.rate||cost(other)<cost(row)));
    }
    const selected=rows.filter(row=>row.rate>=target)
      .sort((a,b)=>cost(a)-cost(b)||b.rate-a.rate)[0]??null;
    self.postMessage({rows,selected,hasEnergy});
  }catch(error){self.postMessage({error:error.message});}
};
