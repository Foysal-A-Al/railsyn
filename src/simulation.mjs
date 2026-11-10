import {inverse,forward,degrees,LIMITS} from '../public/kinematics.mjs';
import {RAIL,railPoint,railYaw} from '../public/rail.mjs';
import {createInventory,pickupPoint,initialRecipe,validateRecipe} from '../public/catalog.mjs';
export const CONFIG=[
 {id:'loader',name:'R1 · Workpiece transfer',job:'Load body into carrier',tool:'Four-cup vacuum plate',base:[-4.5,0,.85],supply:[-5.35,1.4,.05],station:[-4.5,1.4,2.2],color:'#ef7e2f'},
 {id:'capper',name:'R2 · First cap placement',job:'Insert lower cap',tool:'Parallel jaw cap gripper',base:[0,0,3.55],supply:[-.8,1.4,4.25],station:[0,1.475,2.2],color:'#75a6c4'},
 {id:'closer',name:'R3 · Upper cap fitting',job:'Fit upper cap',tool:'Three-finger cap collet',base:[4.5,0,.85],supply:[5.3,1.4,.05],station:[4.5,1.525,2.2],color:'#edc52d'}
];
const high=p=>[p[0],p[1]+.55,p[2]];
CONFIG.forEach(r=>r.home=[r.base[0],2.6,r.base[2]+(r.station[2]-r.base[2])*.5]);
export const PROGRAM=[];
for(const [i,r] of CONFIG.entries()){
 const letter='abc'[i],part=['body','cap','top'][i];
 if(i>0){PROGRAM.push({id:'index_'+letter,label:'Index carrier to station '+(i+1),duration:3.2,distance:[RAIL.load,RAIL.cap,RAIL.top][i],robot:r.id},{id:'settle_'+letter,label:'Dock and verify carrier settling',duration:.8,robot:r.id});}
 for(const [suffix,label,duration,point] of [['approach','Approach parts tray',1.4,high(r.supply)],['lower','Seat tool on '+part,1,r.supply],['grip','Confirm '+r.tool, .65,r.supply],['lift','Lift '+part,1,high(r.supply)],['transfer','Transfer '+part+' to carrier',2,high(r.station)],['place','Seat '+part+' in nest',1.2,r.station],['release','Release supported '+part,.65,r.station],['retract','Clear rail work envelope',1.2,r.home]])PROGRAM.push({id:letter+'_'+suffix,label,duration,point,robot:r.id,part});
}
PROGRAM.push(
 {id:'dispatch',label:'Index assembled product to outfeed',duration:1.6,distance:RAIL.output,robot:'line'},
 {id:'settle_output',label:'Dock carrier at unloading lift',duration:.8,robot:'line'},
 {id:'inspect',label:'Record assembly presence (fit not evaluated)',duration:1.6,robot:'line'},
 {id:'output_lift',label:'Raise carrier above rail side guides',duration:1.1,lift:.13,robot:'line'},
 {id:'unload_push',label:'Push supported assembly onto outfeed',duration:1.8,robot:'line'},
 {id:'unload_retract',label:'Retract unloading pusher',duration:1.2,robot:'line'},
 {id:'outfeed_index',label:'Index collection conveyor one pocket',duration:1.4,robot:'line'},
 {id:'output_lower',label:'Lower empty carrier onto rail',duration:1.1,lift:0,robot:'line'},
 {id:'return_right',label:'Empty carrier: right corner return',duration:4,distance:RAIL.rightReturn,robot:'line'},
 {id:'return_back',label:'Empty carrier: return transport lane',duration:8,distance:RAIL.backReturn,robot:'line'},
 {id:'return_left',label:'Empty carrier: left corner return',duration:4,distance:RAIL.length,robot:'line'},
 {id:'dock_loader',label:'Dock empty carrier for next workpiece',duration:1.2,distance:RAIL.length+RAIL.load,robot:'line'}
);
export const PHASES=PROGRAM.map(x=>x.id);
const smooth=t=>t*t*t*(10+t*(-15+6*t));
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
export class Cell{
 constructor(){this.reset();}
 reset(){
  this.resetGeneration=(this.resetGeneration||0)+1;this.time=0;this.phaseTime=0;this.index=0;this.phase=PHASES[0];this.running=false;this.servo=false;this.stopped=false;this.mode='auto';this.manualDirty=false;this.stepOnly=false;
  this.completed=0;this.target=1;this.speed=1;this.source='synthetic';this.hold=null;this.reason='Enable simulated drives, then run the three-station program.';
  this.program=structuredClone(PROGRAM);this.inventory=createInventory();this.recipe={...initialRecipe(this.inventory),count:1};this.selectionConfirmed=false;this.manualMotion=null;this.pauseAtLoader=false;this.batchDestination='collect';
  this.robots=CONFIG.map(r=>({...r,q:inverse(r.home,r.base),from:[...r.home],gripper:{engaged:false,attached:false,pressure:0,width:r.id==='loader'?0:.32}}));
  this.faults={vibration:false,dropout:false,grip:false,robotA:false,inspection:false,outfeed:false};this.railDistance=RAIL.load;this.railFromDistance=RAIL.load;this.lift=0;this.liftFrom=0;this.pusher=0;this.outfeedShift=0;this.outfeedPosition=[5.3,1.53,2.2];this.batchDone=false;this.makeProduct();this.finished=[];
  this.events=[];this.seq=0;this.samples=[];this.wave=[];this.rms=0;this.stableTime=0;this.external=null;this.externalSequence=-1;this.externalReceived=null;this.lastExternalSample=undefined;this.lastCycle=null;this.cycleStart=0;this.savedPoints=[];
  this.event('Three dedicated workcells: load body, fit first cap, fit upper cap. Geometry and recipe are estimates.');
 }
 makeProduct(){
  this.product={id:'ASSY-'+String(this.completed+1).padStart(3,'0'),inspected:false};
  for(const [i,kind] of ['body','cap','top'].entries()){const pocket=this.inventory.find(p=>p.id===this.recipe[kind]),robot=this.robots[i];if(!pocket||pocket.quantity<1)throw Error('Selected source is empty.');this.product[kind]={location:'supply',source:pocket.id,family:pocket.family,color:pocket.color,name:pocket.name};robot.supply=pickupPoint(pocket);for(const stage of this.program.filter(p=>p.robot===robot.id)){const suffix=stage.id.split('_')[1];if(['approach','lower','grip','lift'].includes(suffix)){stage.point=['approach','lift'].includes(suffix)?high(robot.supply):[...robot.supply];stage.label=({approach:'Approach',lower:'Seat tool on',grip:'Confirm grip at',lift:'Lift from'})[suffix]+' '+pocket.id;}}}
 }
 event(message){this.events.unshift({id:++this.seq,time:+this.time.toFixed(2),message});this.events.length=Math.min(100,this.events.length);}
 setHold(reason){if(this.hold!==reason)this.event(reason?'HOLD: '+reason:'Interlock cleared.');this.hold=reason;this.reason=reason||this.program[this.index].label;}
 command(action,value){
  if(action==='reset'){this.reset();return;}
  if(action==='recipe'||action==='run_recipe'){
   if(this.running||this.manualMotion||this.manualDirty||!this.batchDone&&(this.phase!=='a_approach'||this.phaseTime!==0))throw Error('Finish the current cycle and recover home before editing the job.');
   validateRecipe(this.inventory,value);if(this.completed+value.count>4)throw Error('Not enough empty collection pockets.');if(action==='run_recipe'&&this.stopped)throw Error('Reset the latched stop first.');
   this.selectionConfirmed=true;this.recipe=structuredClone(value);this.batchDestination=value.destination;this.target=this.completed+value.count;this.batchDone=false;this.index=0;this.phase=PHASES[0];this.phaseTime=0;this.makeProduct();this.reason='Selected recipe ready.';this.event('Recipe selected: '+value.body+' + '+value.cap+' + '+value.top+'.');if(action==='run_recipe'){this.mode='auto';this.servo=true;this.running=true;}return;
  }
    if(action==='release_output'){if(this.running||this.phase!=='output_lift'||!this.product.inspected)throw Error('Pause at the verified output station first.');this.recipe.destination='collect';this.reason='Inspection hold released for collection.';return;}
  if(action==='recover'){
   if(this.running||this.mode!=='manual'||!this.servo||this.stopped||this.robots.some(r=>r.gripper.attached))throw Error('Home recovery needs paused manual mode, enabled drives and empty tools.');
   this.manualDirty=true;this.manualMotion={time:0,duration:2,from:this.robots.map(r=>[...r.q]),to:this.robots.map(r=>inverse(r.home,r.base,r.q[0]))};return;
  }

  if(action==='ack_stop'){if(this.running)throw Error('Pause before acknowledging a simulation stop.');this.stopped=false;this.reason='Simulation stop cleared. Run the selected recipe when ready.';this.event('Simulation stop acknowledged; selection and positions preserved.');return;}
  if(action==='stop'){this.manualMotion=null;this.running=false;this.servo=false;this.stopped=true;this.event('Simulation stop latched. No physical equipment command sent.');return;}
  if(action==='pause'){this.manualMotion=null;this.running=false;this.event('Program paused.');return;}
  if(action==='servo'){if(typeof value!=='boolean'||value&&this.stopped)throw Error('Reset stop before enabling simulated drives.');this.servo=value;if(!value){this.running=false;this.manualMotion=null;}this.event('Simulated drives '+(value?'enabled.':'disabled.'));return;}
  if(action==='mode'){if(this.running||this.manualMotion||!['auto','manual'].includes(value))throw Error('Pause to change control mode.');if(value==='auto'&&this.manualDirty)throw Error('Manual pose changed: use Recover home before automatic motion.');this.mode=value;return;}
  if(action==='start'||action==='step'){if(!this.selectionConfirmed)throw Error('Select and apply all three parts before Run.');if(!this.servo||this.stopped)throw Error('Enable simulated drives; reset any latched stop.');if(this.mode!=='auto')throw Error('Select automatic mode.');if(this.manualMotion)throw Error('Wait for home recovery.');if(this.batchDone)throw Error('Batch finished. Reset to run another.');this.running=true;this.stepOnly=action==='step';this.event(this.stepOnly?'Executing one program stage.':'Three-station program running.');return;}
  if(action==='jog'){
   if(this.running||this.manualMotion||this.robots.some(r=>r.gripper.attached)||!this.servo||this.stopped||this.mode!=='manual')throw Error('Jog requires manual mode, enabled drives and a paused program.');
   const robot=this.robots.find(r=>r.id===value?.robot);if(!robot||!Number.isInteger(value.joint)||value.joint<0||value.joint>5||!Number.isFinite(value.delta)||value.delta===0||Math.abs(value.delta)>5)throw Error('Select a valid robot/joint; jog is limited to 5 degrees.');
   const q=[...robot.q];q[value.joint]+=value.delta*Math.PI/180;const a=degrees(q)[value.joint];if(a<LIMITS[value.joint][0]||a>LIMITS[value.joint][1])throw Error('Concept joint limit reached.');if(forward(q,robot.base).tcp[1]<1.22)throw Error('Jog rejected below demonstration workspace floor.');robot.q=q;this.manualDirty=true;this.event(robot.id+' J'+(value.joint+1)+' jog '+value.delta+' degrees.');return;
  }
  if(action==='teach'){const robot=this.robots.find(r=>r.id===value);if(!robot||this.mode!=='manual'||this.running||this.savedPoints.length>=12)throw Error('Teach requires paused manual mode; maximum 12 points.');this.savedPoints.push({robot:value,joints:degrees(robot.q),tcp:forward(robot.q,robot.base).tcp});this.event('Pose recorded in the run export.');return;}
  if(action==='tool'){
   const robot=this.robots.find(r=>r.id===value?.robot);if(!robot||typeof value.engaged!=='boolean'||this.running||this.mode!=='manual'||!this.servo||this.stopped)throw Error('Tool control requires enabled drives and paused manual mode.');
   if(robot.gripper.attached)throw Error('Use reset recovery: releasing an attached part manually is blocked.');robot.gripper.engaged=value.engaged;robot.gripper.width=value.engaged?(robot.id==='capper'?2*(this.product.cap.family==='B'?.10:.09)+.035:2*(this.product.top.family==='B'?.115:.105)+.03):.32;robot.gripper.pressure=value.engaged?-60:0;this.manualDirty=true;this.event(robot.id+' empty tool '+(value.engaged?'closed/on.':'open/off.'));return;
  }
  if(action==='speed'){if(!Number.isFinite(value)||value<.25||value>1.5)throw Error('Speed must be 0.25–1.5.');this.speed=value;return;}
  if(action==='fault'){if(!Object.hasOwn(this.faults,value))throw Error('Unknown fault.');this.faults[value]=!this.faults[value];this.event(value+' fault '+(this.faults[value]?'injected.':'cleared.'));return;}
  if(action==='source'){if(this.running||!['synthetic','external'].includes(value))throw Error('Pause to select a valid source.');this.source=value;this.samples=[];this.wave=[];this.stableTime=0;return;}
  throw Error('Unknown simulation command.');
 }
 ingest(packet,now=Date.now()){
  const keys=['device','sequence','timestamp','acceleration','partPresent','gripConfirmed'];
  if(!packet||typeof packet!=='object'||Array.isArray(packet)||Object.keys(packet).some(k=>!keys.includes(k)))throw Error('Unexpected packet fields.');
  if(packet.device!=='external-sensor-1')throw Error('Device is not registered.');if(!Number.isSafeInteger(packet.sequence)||packet.sequence<=this.externalSequence)throw Error('Sequence must increase.');if(!Number.isSafeInteger(packet.timestamp)||Math.abs(now-packet.timestamp)>1000)throw Error('Timestamp must be within one second.');
  if(!Array.isArray(packet.acceleration)||packet.acceleration.length!==3||packet.acceleration.some(x=>!Number.isFinite(x)||Math.abs(x)>100))throw Error('Invalid acceleration.');if(typeof packet.partPresent!=='boolean'||typeof packet.gripConfirmed!=='boolean')throw Error('Confirmation flags must be booleans.');
  this.external=structuredClone(packet);this.externalSequence=packet.sequence;this.externalReceived=now;
 }
 tick(dt=.05,now=Date.now()){
  if(this.manualMotion){const m=this.manualMotion;m.time+=dt;const t=smooth(Math.min(1,m.time/m.duration));this.robots.forEach((r,i)=>r.q=m.from[i].map((q,j)=>q+(m.to[i][j]-q)*t));if(m.time>=m.duration){this.robots.forEach(r=>{r.from=forward(r.q,r.base).tcp;r.gripper={engaged:false,attached:false,pressure:0,width:r.id==='loader'?0:.32};});this.phaseTime=0;this.manualDirty=false;this.manualMotion=null;this.event('Home recovery complete; recipe and inventory preserved.');}return;}if(!this.running)return;this.time+=dt;const stage=this.program[this.index],robot=this.robots.find(r=>r.id===stage.robot),isIndex=Object.hasOwn(stage,'distance'),settle=stage.id.startsWith('settle_');
  const fresh=!this.faults.dropout&&(this.source==='synthetic'||(this.externalReceived!==null&&now-this.externalReceived<=500&&Math.abs(now-this.external.timestamp)<=1000));
  for(let i=0;i<10;i++){
   const t=this.time-dt+(i+1)*dt/10,amp=this.faults.vibration?2.6:settle?1.5*Math.exp(-this.phaseTime*2.5):isIndex?.45:.04;
   const a=this.source==='external'?this.external?.acceleration||[0,0,0]:[amp*Math.sin(2*Math.PI*23*t),amp*.6*Math.sin(2*Math.PI*31*t),amp*.35*Math.cos(2*Math.PI*17*t)];
   if(fresh&&(this.source==='synthetic'||i===9)){if(this.source==='external'&&this.external.sequence===this.lastExternalSample)continue;this.lastExternalSample=this.external?.sequence;this.samples.push([...a]);if(this.samples.length>100)this.samples.shift();this.wave.push(a[0]);if(this.wave.length>200)this.wave.shift();}
  }
  this.rms=this.samples.length?Math.max(...[0,1,2].map(axis=>Math.sqrt(this.samples.reduce((s,a)=>s+a[axis]**2,0)/this.samples.length))):0;
  if(!fresh){this.stableTime=0;this.setHold('Sensor heartbeat missing or stale. Joints and carrier held.');return;}
  if(this.faults.robotA){this.setHold('Loader unavailable: line handoff held; parts remain tracked.');return;}
  if(!isIndex&&!settle&&this.rms>.3){this.setHold('Vibration exceeds illustrative 0.30 m/s² gate.');return;}
  if(settle){this.phaseTime+=dt*this.speed;this.stableTime=this.rms<=.3?this.stableTime+dt:0;if(this.stableTime<.6){this.setHold('Docked carrier must remain settled for 600 ms.');return;}if(this.source==='external'&&!this.external.partPresent){this.setHold('Carrier presence is not confirmed.');return;}}
  if(stage.id.endsWith('_grip')){
   robot.gripper.engaged=true;robot.gripper.width+=((robot.id==='capper'?2*(this.product.cap.family==='B'?.10:.09)+.035:2*(this.product.top.family==='B'?.115:.105)+.03)-robot.gripper.width)*Math.min(1,dt*8);const target=this.faults.grip?-8:-62;robot.gripper.pressure+=(target-robot.gripper.pressure)*Math.min(1,dt*6);
   if(this.faults.grip||robot.gripper.pressure> -40||(this.source==='external'&&!this.external.gripConfirmed)){this.setHold(robot.id+' grip not confirmed. Part stays on tray; lift blocked.');return;}
  }
  if(this.robots.some(r=>r.gripper.attached)&&this.faults.grip){this.setHold('Grip loss while carrying. Motion held; retained payload is a simulation assumption.');return;}
  if(stage.id==='inspect'&&this.faults.inspection){this.setHold('Assembly verification failed. Unloading blocked.');return;}
  if(stage.id==='output_lift'&&this.recipe.destination==='hold'){this.running=false;this.reason='Selected inspection hold. Release to collection when ready.';return;}
  if(['output_lift','unload_push','outfeed_index'].includes(stage.id)&&(this.faults.outfeed||this.finished.length>=4)){this.setHold('Outfeed blocked or output buffer full. Assembly retained on its current support.');return;}
  if(isIndex&&this.robots.some(r=>r.gripper.attached)){this.setHold('Rail cannot index while a robot carries a part.');return;}
  this.setHold(null);if(!settle)this.phaseTime+=dt*this.speed;const p=Math.min(this.phaseTime/stage.duration,1),t=smooth(p);
  if(stage.point){const point=robot.from.map((x,i)=>x+(stage.point[i]-x)*t);robot.q=inverse(point,robot.base,robot.q[0]);}
  if(isIndex)this.railDistance=this.railFromDistance+(stage.distance-this.railFromDistance)*t;
  if(Object.hasOwn(stage,'lift'))this.lift=this.liftFrom+(stage.lift-this.liftFrom)*t;
  if(stage.id==='unload_push'){
   if(!this.product.inspected||this.product.body.location!=='carrier'&&this.product.body.location!=='outfeed'||this.lift<.129)throw Error('Unloading support invariant failed.');
   this.pusher=t;this.product.body.location='outfeed';this.outfeedPosition=[5.3,1.53,2.2+.95*t];
  }
  if(stage.id==='unload_retract')this.pusher=1-t;
  if(stage.id==='outfeed_index'){this.outfeedShift=.6*t;this.outfeedPosition=[5.3,1.53,3.15+.6*t];}
  if(stage.id.endsWith('_release')){robot.gripper.engaged=false;robot.gripper.pressure*=Math.max(0,1-dt*9);robot.gripper.width+=(.32-robot.gripper.width)*Math.min(1,dt*8);}
  if(this.phaseTime<stage.duration)return;
  if(stage.id.endsWith('_grip')){
   if(distance(forward(robot.q,robot.base).tcp,robot.supply)>.002)throw Error('Tool contact invariant failed.');const source=this.inventory.find(p=>p.id===this.product[stage.part].source);if(source.quantity<1)throw Error('Source pocket became empty.');source.quantity--;robot.gripper.attached=true;this.product[stage.part].location='tool-'+robot.id;this.event(robot.id+' confirmed '+stage.part+' grip.');
  }
  if(stage.id.endsWith('_release')){
   if(distance(forward(robot.q,robot.base).tcp,robot.station)>.002)throw Error('Supported release invariant failed.');
   if(stage.part!=='body'&&this.product.body.location!=='carrier')throw Error('Carrier body missing.');if(stage.part==='top'&&this.product.cap.location!=='assembled')throw Error('Lower cap missing.');
   robot.gripper.attached=false;robot.gripper.pressure=0;this.product[stage.part].location=stage.part==='body'?'carrier':'assembled';this.event(stage.part+' seated and released at '+robot.id+' station.');
  }
  if(stage.id==='inspect'){this.product.inspected=true;this.event('Simulated assembly presence recorded. Fit and physical compatibility are not evaluated.');}
  if(stage.id==='unload_push')this.event(this.product.id+' transferred onto the supported outfeed conveyor.');
  if(stage.id==='outfeed_index'){
   this.product.body.location='buffer';this.completed++;this.finished.push(structuredClone(this.product));this.outfeedShift=0;this.event(this.product.id+' stored in output buffer; carrier is empty.');
  }
  if(stage.id==='dock_loader'){
   this.lastCycle=+(this.time-this.cycleStart).toFixed(2);this.cycleStart=this.time;this.event('Empty carrier completed the return rail and docked at loader.');
   if(this.completed>=this.target){this.running=false;this.batchDone=true;this.selectionConfirmed=false;this.reason='Selected assembly collected; carrier returned. Choose the next three parts and press Run.';this.phaseTime=stage.duration;return;}
   throw Error('One-job completion invariant failed.');
  }
  if(stage.point)robot.from=[...stage.point];this.railFromDistance=this.railDistance;this.liftFrom=this.lift;this.index=(this.index+1)%PROGRAM.length;this.phase=PHASES[this.index];this.phaseTime=0;this.stableTime=0;
  if(this.stepOnly){this.running=false;this.stepOnly=false;this.reason='One program stage complete.';}
 }
 snapshot(now=Date.now()){
  const stage=this.program[this.index],fresh=!this.faults.dropout&&(this.source==='synthetic'||this.externalReceived!==null&&now-this.externalReceived<=500);
  const robots=this.robots.map(r=>({...r,q:undefined,from:undefined,joints:degrees(r.q),radians:[...r.q],tcp:forward(r.q,r.base).tcp,gripper:{...r.gripper},limits:LIMITS,status:this.running&&stage.robot===r.id?'executing':'ready'}));
  const railMoving=this.running&&Object.hasOwn(stage,'distance');
  const io=[['DI00','Carrier docked',!railMoving],['DI01','Body on carrier',this.product.body.location==='carrier'],['DI02','First cap seated',this.product.cap.location==='assembled'],['DI03','Upper cap seated',this.product.top.location==='assembled'],['DI04','Assembly check passed',this.product.inspected],['DI05','Heartbeat',fresh],...robots.map((r,i)=>['DI'+(6+i).toString().padStart(2,'0'),r.id+' grip confirmed',r.gripper.attached&&!this.faults.grip]),...robots.map((r,i)=>['DO0'+i,r.id+' tool command',r.gripper.engaged]),['DI09','Outfeed clear',!this.faults.outfeed&&this.finished.length<4],['DI10','Lift raised',this.lift>.129],['DI11','Pusher retracted',this.pusher<.001]];
  const buffer=this.finished.map((p,i)=>({id:p.id,position:[5.3,1.53,3.75+(this.completed-1-i)*.6+this.outfeedShift]}));
  return {version:'0.5.1',selectionConfirmed:this.selectionConfirmed,resetGeneration:this.resetGeneration,recipe:structuredClone(this.recipe),inventory:structuredClone(this.inventory),manualMotion:!!this.manualMotion,pauseAtLoader:this.pauseAtLoader,mode:'simulation',hardwareOutput:false,controlMode:this.mode,servo:this.servo,manualDirty:this.manualDirty,robots,activeRobot:stage.robot,program:this.program,programIndex:this.index,phase:this.phase,progress:Math.min(this.phaseTime/stage.duration,1),running:this.running,stopped:this.stopped,time:this.time,completed:this.completed,target:this.target,batchDone:this.batchDone,speed:this.speed,hold:this.hold,reason:this.reason,faults:{...this.faults},rms:this.rms,source:this.source,wave:[...this.wave],events:this.events,product:structuredClone(this.product),finished:structuredClone(this.finished),rail:{position:railPoint(this.railDistance,this.lift),yaw:railYaw(this.railDistance),distance:this.railDistance,moving:railMoving,loaded:this.product.body.location==='carrier'},outfeed:{capacity:4,buffer,currentPosition:[...this.outfeedPosition],pusher:this.pusher,lift:this.lift,blocked:this.faults.outfeed},io,lastCycle:this.lastCycle,savedPoints:this.savedPoints,external:{connected:this.externalReceived!==null&&now-this.externalReceived<=500,lastSequence:this.externalSequence},devices:robots.map(r=>({id:r.id,type:'robot',status:r.status}))};
 }
}
