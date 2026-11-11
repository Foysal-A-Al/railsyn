import {
  ROBOTS,DOCK,TRAY_SOURCE,BODY_ON_TRAY,CAP_ON_TRAY,TOP_ON_TRAY,outputPoint,createInventory,pickupPoint,inverse,forward,LIMITS,lerp,smooth,ROUTES,atDistance
} from './model.mjs';
const clone=x=>structuredClone(x),up=(p,h=.5)=>[p[0],p[1]+h,p[2]];
export const PROGRAM=[
['tray_approach','FANUC approaches empty tray','fanuc',1.2],
  ['tray_contact','FANUC contacts tray','fanuc',.7],
  ['tray_grip','Confirm tray grip','fanuc',.4],
  ['tray_lift','Lift tray clear','fanuc',.8],
  ['tray_move','Transfer tray to S1','fanuc',1.5],
  ['tray_seat','Seat tray on shuttle','fanuc',.7],
  ['tray_release','Release supported tray','fanuc',.3],
  ['tray_retract','Clear shuttle zone','fanuc',1],
['travel_setup','Route S1 through setup branch','rail',0],
  ['fixture','Waiting for operator to load workpiece','operator',0],
  ['travel_assembly','Rejoin main line and dock at assembly','rail',0],
  ['settle_assembly','Wait for positioned and settled shuttle','line',.7],
['cap_approach','UR3e approaches selected first cap','ur3e',1],
  ['cap_contact','Contact first cap','ur3e',.6],
  ['cap_grip','Confirm first-cap grip','ur3e',.35],
  ['cap_lift','Lift selected first cap','ur3e',.6],
  ['cap_move','Transfer first cap','ur3e',1.1],
  ['cap_seat','Place first cap','ur3e',.7],
  ['cap_release','Release seated cap','ur3e',.3],
  ['cap_retract','Clear first cap','ur3e',.65],
['top_approach','UR3e approaches selected top cover','ur3e',1],
  ['top_contact','Contact exposed cover','ur3e',.6],
  ['top_grip','Confirm cover grip','ur3e',.35],
  ['top_lift','Lift top cover','ur3e',.6],
  ['top_move','Transfer top cover','ur3e',1.1],
  ['top_seat','Place top cover','ur3e',.7],
  ['top_release','Release supported cover','ur3e',.3],
  ['assembly_clear','Retract UR3e clear of rail','ur3e',1],
['travel_vision','Pass 5, 6, 7 toward station 8','rail',0],
  ['vision','Modeled vision inspection','vision',1],
  ['dispatch_approach','UR10 approaches finished assembly','ur10',1],
  ['dispatch_contact','Contact complete assembly','ur10',.6],
  ['dispatch_grip','Reserve output and confirm grip','ur10',.4],
  ['dispatch_lift','Lift complete assembly','ur10',.8],
  ['dispatch_move','Transfer product to dispatch rack','ur10',1.3],
  ['dispatch_seat','Seat product at reserved output','ur10',.7],
  ['dispatch_release','Release completed product','ur10',.3],
  ['dispatch_clear','Clear UR10 from shuttle','ur10',1],
['travel_return','Return empty tray to loading','rail',0],
  ['return_approach','FANUC approaches empty tray','fanuc',1],
  ['return_contact','Contact empty tray','fanuc',.6],
  ['return_grip','Grip empty tray','fanuc',.35],
  ['return_lift','Lift tray from shuttle','fanuc',.7],
  ['return_move','Return tray to conveyor','fanuc',1.3],
  ['return_seat','Lower empty tray to supply','fanuc',.6],
  ['return_release','Release tray on support','fanuc',.3],
  ['return_clear','Home FANUC and wait for next job','fanuc',1]
].map(([id,label,owner,duration])=>({
  id,label,owner,duration
}));
export class Cell {
  constructor(){
    this.reset();
  }
  reset(){
    this.inventory=createInventory();
    this.robots=ROBOTS.map(r=>({
      ...clone(r),q:inverse(r.home,r),engaged:false,holding:null
    }));
    this.carrier=atDistance(ROUTES.setup,0);
    this.tray={
      location:'supply'
    };
    this.product=null;
    this.finished=[];
    this.selection=null;
    this.queue=[];
    this.queueTotal=0;
    this.loading=null;
    this.running=false;
    this.stopped=false;
    this.drives=false;
    this.mode='program';
    this.manualDirty=false;
    this.recovering=false;
    this.complete=false;
    this.index=0;
    this.elapsed=0;
    this.time=0;
    this.speed=1;
    this.faults={
      grip:false,vision:false,output:false,vibration:false,heartbeat:false
    };
    this.reason='Select three parts and press Run in the controller.';
    this.history=[];
    this.events=[];
    this.generation=(this.generation||0)+1;
    this.from=null;
    this.hold='';
    this.pickContact={
    };
    this.stepOnly=false;
    this.manualReturn=null;
  }
  event(message){
    this.events.unshift({
      time:this.time,message
    });
    this.events.length=Math.min(45,this.events.length);
  }
  robot(id){
    return this.robots.find(r=>r.id===id);
  }
  validate(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['body','cap','top','destination'].includes(k)))throw Error('Choose a workpiece, first cap and cover.');
    for(const key of ['body','cap','top']){
      const p=this.inventory.find(p=>p.id===value[key]&&p.kind===key);
      if(!p||p.quantity<1)throw Error('Choose an available '+key+' pocket.');
    }
    if(value.destination!=='dispatch')throw Error('Choose the dispatch rack destination.');
    if(this.finished.length>=4)throw Error('Dispatch rack is full. Reset the trial to replenish the demonstration.');
  }
  command(action,value){
    if(action==='reset'){
      this.reset();
      return;
    }
    if(action==='stop'){
      this.running=false;
      this.stopped=true;
      if(this.loading)this.loading.paused=true;
      this.drives=false;
      this.recovering=false;
      this.reason='Simulation stop latched.';
      return;
    }
    if(action==='ack_stop'){
      this.stopped=false;
      this.reason='Stop acknowledged. Press Resume or Run separately.';
      return;
    }
    if(action==='fault'){
      if(!value||!Object.hasOwn(this.faults,value.name)||typeof value.enabled!=='boolean')throw Error('Invalid fault.');
      this.faults[value.name]=value.enabled;
      return;
    }
    if(action==='speed'){
      if(!Number.isFinite(value)||value<.25||value>2)throw Error('Speed must be 0.25–2.');
      this.speed=value;
      return;
    }
    if(action==='pause'){
      this.running=false;
      if(this.loading)this.loading.paused=true;
      if(this.recovering){
        this.recovering=false;
        this.manualDirty=true;
      }
      return;
    }
    if(action==='drives'){
      if(typeof value!=='boolean'||value&&this.stopped)throw Error('Clear simulation stop before enabling drives.');
      this.drives=value;
      if(!value){
        this.running=false;
        if(this.loading)this.loading.paused=true;
        if(this.recovering){
          this.recovering=false;
          this.manualDirty=true;
        }
      }
      return;
    }
    if(action==='mode'){
      if(!['program','manual'].includes(value)||this.running||this.recovering||this.loading)throw Error('Finish operator loading or pause before changing mode.');
      this.mode=value;
      return;
    }
    if(action==='apply'){
      if(this.running||this.manualDirty||this.recovering||this.product&&!this.complete)throw Error('Finish or recover the current job before applying a recipe.');
      this.validate(value);
      this.selection=clone(value);
      this.reason='Selection applied. Press Run to begin.';
      return;
    }
    if(action==='run'){
      if(this.stopped||this.manualDirty||this.recovering||this.running||this.product&&!this.complete)throw Error('Clear stop, finish the current job or recover home first.');
      const recipes=Array.isArray(value)?value:[value];
      if(recipes.length<1||recipes.length>4)throw Error('Queue must contain one to four recipes.');
      if(recipes.length+this.finished.length>4)throw Error('Not enough free dispatch pockets.');
      const available=new Map(this.inventory.map(p=>[p.id,p.quantity]));
      for(const recipe of recipes){
        this.validate(recipe);
        for(const kind of ['body','cap','top']){
          const id=recipe[kind];
          const quantity=available.get(id)-1;
          if(quantity<0)throw Error(id+' has insufficient stock for this queue.');
          available.set(id,quantity);
        }
      }
      this.queue=clone(recipes.slice(1));
      this.queueTotal=recipes.length;
      this.beginJob(recipes[0]);
      return;
    }
    if(action==='load_workpiece'){
      if(this.stopped||this.manualDirty||this.recovering||!this.awaitingLoad())throw Error('Manual loading requires a docked shuttle and a clear stop.');
      if(value!==this.selection.body)throw Error('Load the workpiece selected for this job.');
      if(this.loading){
        if(!this.loading.paused)throw Error('The operator is already loading.');
        this.loading.paused=false;
      }else{
        const source=this.inventory.find(p=>p.id===value);
        if(!source||source.quantity<1)throw Error('Selected workpiece is unavailable.');
        this.loading={progress:0,paused:false};
      }
      this.reason='Operator loading '+value+'.';
      this.event(this.reason);
      return;
    }
    if(action==='resume'||action==='step'){
      if(this.awaitingLoad())throw Error('Load the selected workpiece before moving the shuttle.');
      if(this.stopped||this.manualDirty||this.recovering||!this.product||this.complete)throw Error('An unfinished selected job is required.');
      this.drives=true;
      this.mode='program';
      this.running=true;
      this.stepOnly=action==='step';
      return;
    }
    if(action==='jog'||action==='tool'){
      if(this.loading||this.mode!=='manual'||!this.drives||this.running||this.stopped||this.recovering||this.robots.some(r=>r.holding))throw Error('Manual mode, enabled drives and empty tools are required.');
      const r=this.robot(value?.robot);
      if(!r)throw Error('Select a robot.');
      if(!this.manualDirty)this.manualReturn=this.robots.map(r=>[...r.q]);
      if(action==='jog'){
        if(!Number.isInteger(value.joint)||value.joint<0||value.joint>5||!Number.isFinite(value.delta)||Math.abs(value.delta)>5)throw Error('Invalid jog increment.');
        const q=r.q[value.joint]+value.delta*Math.PI/180,[lo,hi]=LIMITS[value.joint];
        if(q<lo*Math.PI/180||q>hi*Math.PI/180)throw Error('Concept joint limit.');
        r.q[value.joint]=q;
      }
      else {
        if(typeof value.engaged!=='boolean')throw Error('Invalid tool state.');
        r.engaged=value.engaged;
      }
      this.manualDirty=true;
      return;
    }
    if(action==='recover'){
      if(this.running||!this.drives||this.mode!=='manual'||this.stopped||this.robots.some(r=>r.holding))throw Error('Recovery needs enabled Manual mode and empty tools.');
      this.recovering=true;
      this.recoverTime=0;
      this.recoverFrom=this.robots.map(r=>[...r.q]);
      this.recoverTo=this.manualReturn||this.robots.map(r=>[...r.q]);
      return;
    }
    throw Error('Unknown simulation command.');
  }
  enter(){
    this.elapsed=0;
    this.from=null;
    const stage=PROGRAM[this.index];
    this.history.push({
      phase:stage.id,owner:stage.owner
    });
    this.event(stage.label);
    this.reason=stage.label;
    this.hold='';
    this.phaseFrom=Object.fromEntries(this.robots.map(r=>[r.id,[...r.q]]));
    if(stage.id.startsWith('travel_')){
      this.route=ROUTES[stage.id.slice(7)];
      this.duration=this.route.length/1.25;
    }
    else this.duration=stage.duration;
    const r=this.robot(stage.owner);
    if(r){
      this.from=[...forward(r.q,r).tcp];
      this.target=this.targetFor(stage.id);
      if(!this.target)this.target=[...this.from];
      inverse(this.target,r,r.q[0]);
    }
    if(stage.id==='fixture'){
      this.running=false;
      this.reason='Place '+this.selection.body+' into the docked shuttle.';
    }
  }
  awaitingLoad(){
    return PROGRAM[this.index].id==='fixture'&&(!!this.loading||this.product?.body.location==='supply');
  }
  beginJob(value){
    this.stepOnly=false;
    this.selection=clone(value);
    this.product={
      id:'T2-'+String(this.finished.length+1).padStart(3,'0'),sources:clone(value),body:{
        location:'supply'
      },cap:{
        location:'supply'
      },top:{
        location:'supply'
      },holder:'carrier',checked:false
    };
    this.output=outputPoint(this.finished.length);
    this.drives=true;
    this.mode='program';
    this.running=true;
    this.complete=false;
    this.index=0;
    this.elapsed=0;
    this.history=[];
    this.enter();
  }
  targetFor(id){
    const body=[...DOCK.assembly];
    body[1]=BODY_ON_TRAY;
    const cap=[body[0],CAP_ON_TRAY,body[2]],top=[body[0],TOP_ON_TRAY,body[2]],tray=[...DOCK.load];
    tray[1]=1.31;
    const picked=kind=>this.inventory.find(p=>p.id===this.selection[kind]);
    if(id==='tray_approach'||id==='tray_lift'||id==='return_move')return up(TRAY_SOURCE);
    if(id==='tray_contact'||id==='tray_grip'||id==='return_seat'||id==='return_release')return TRAY_SOURCE;
    if(id==='tray_move'||id==='tray_retract'||id==='return_approach'||id==='return_lift')return up(tray);
    if(id==='tray_seat'||id==='tray_release'||id==='return_contact'||id==='return_grip')return tray;
    if(id==='return_clear')return this.robot('fanuc').home;
    if(id.startsWith('cap_')||id.startsWith('top_')){
      const kind=id.startsWith('cap_')?'cap':'top',suffix=id.split('_')[1],p=pickupPoint(picked(kind)),dest=kind==='cap'?cap:top;
      if(suffix==='approach')return up(p);
      if(suffix==='contact'||suffix==='grip')return p;
      if(suffix==='lift')return up(this.pickContact[kind]);
      if(suffix==='move'||suffix==='retract')return up(dest);
      if(suffix==='seat'||suffix==='release')return dest;
    }
    if(id==='assembly_clear')return this.robot('ur3e').home;
    const productPoint=[DOCK.vision[0],BODY_ON_TRAY,DOCK.vision[2]];
    if(id==='dispatch_approach'||id==='dispatch_lift')return up(productPoint);
    if(id==='dispatch_contact'||id==='dispatch_grip')return productPoint;
    if(id==='dispatch_move')return up(this.output);
    if(id==='dispatch_seat'||id==='dispatch_release')return this.output;
    if(id==='dispatch_clear')return this.robot('ur10').home;
  }
  gate(id){
    if(this.faults.heartbeat)return 'Simulated heartbeat absent.';
    if(id.endsWith('_grip')&&this.faults.grip)return 'Grip confirmation absent.';
    if(id==='dispatch_grip'&&this.faults.output)return 'Dispatch output blocked.';
    if(id==='vision'&&this.faults.vision)return 'Modeled vision check failed.';
    if(id==='settle_assembly'&&this.faults.vibration)return 'Waiting for modeled vibration settling.';
    return '';
  }
  finish(id){
    const r=this.robot(PROGRAM[this.index].owner);
    if(id==='tray_grip'||id==='return_grip'){
      r.engaged=true;
      r.holding='tray';
      this.tray.location='tool';
    }
    if(id==='tray_release'){
      r.engaged=false;
      r.holding=null;
      this.tray.location='carrier';
    }
    if(id==='return_release'){
      r.engaged=false;
      r.holding=null;
      this.tray.location='supply';
    }
    if(id==='fixture'){
      this.product.body.location='carrier';
    }
    for(const kind of ['cap','top']){
      if(id===kind+'_grip'){
        const p=this.inventory.find(p=>p.id===this.selection[kind]);
        this.pickContact??={
        };
        this.pickContact[kind]=pickupPoint(p);
        p.quantity--;
        this.product[kind].location='tool';
        r.engaged=true;
        r.holding=kind;
      }
      if(id===kind+'_release'){
        this.product[kind].location='assembled';
        r.holding=null;
        r.engaged=false;
      }
    }
    if(id==='vision')this.product.checked=true;
    if(id==='dispatch_grip'){
      if(!this.product.checked||this.product.cap.location!=='assembled'||this.product.top.location!=='assembled')throw Error('Assembly and vision gates required.');
      r.engaged=true;
      r.holding='product';
      this.product.holder='ur10';
    }
    if(id==='dispatch_release'){
      this.product.holder='buffer';
      r.engaged=false;
      r.holding=null;
      this.finished.push({
        ...clone(this.product),position:[...this.output]
      });
    }
  }
  tick(dt=.05){
    if(!Number.isFinite(dt)||dt<=0||dt>.1)throw Error('Invalid tick.');
    this.time+=dt;
    if(this.recovering){
      this.recoverTime+=dt;
      const t=smooth(this.recoverTime/1.5);
      this.robots.forEach((r,i)=>{
        r.q=lerp(this.recoverFrom[i],this.recoverTo[i],t);r.engaged=false;
      });
      if(t>=1){
        this.recovering=false;
        this.manualDirty=false;
        this.manualReturn=null;
      }
      return;
    }
    if(this.loading){
      if(this.stopped||this.loading.paused||this.recovering||this.manualDirty)return;
      this.loading.progress=Math.min(1,this.loading.progress+dt/3.4);
      if(this.loading.progress>=.24&&this.product.body.location==='supply'){
        this.inventory.find(p=>p.id===this.selection.body).quantity--;
        this.product.body.location='operator';
      }
      if(this.loading.progress>=1){
        this.product.body.location='carrier';
        this.loading=null;
        this.reason='Workpiece '+this.selection.body+' seated. Press Resume to continue.';
        this.event(this.reason);
      }
      return;
    }
    if(!this.running||!this.drives||this.stopped)return;
    const stage=PROGRAM[this.index],id=stage.id;
    this.hold=this.gate(id);
    if(this.hold){
      this.reason=this.hold;
      return;
    }
    this.reason=stage.label;
    this.elapsed=Math.min(this.duration,this.elapsed+dt*this.speed);
    const t=this.duration?this.elapsed/this.duration:1;
    if(id.startsWith('travel_')){
      if(this.robots.some(r=>r.holding))throw Error('Carrier motion forbidden while a tool holds a payload.');
      this.carrier=atDistance(this.route,t*this.route.length);
    }
    else if(this.from){
      const r=this.robot(stage.owner);
      r.q=inverse(lerp(this.from,this.target,smooth(t)),r,r.q[0]);
    }
    if(t>=1){
      this.finish(id);
      if(this.index===PROGRAM.length-1){
        if(this.queue.length){
          const pauseAfterStep=this.stepOnly;
          this.beginJob(this.queue.shift());
          if(pauseAfterStep)this.running=false;
          return;
        }
        this.running=false;
        this.complete=true;
        this.stepOnly=false;
        this.selection=null;
        this.reason='Queue complete. All selected jobs dispatched.';
        return;
      }
      this.index++;
      this.enter();
      if(this.stepOnly){
        this.running=false;
        this.stepOnly=false;
      }
    }
  }
  snapshot(){
    const stage=PROGRAM[this.index];
    const robots=this.robots.map(r=>({
      ...clone(r),joints:r.q.map(v=>v*180/Math.PI),tcp:forward(r.q,r).tcp
    }));
    return {
      trial:2,version:'0.6.7',mode:'simulation',hardwareOutput:false,generation:this.generation,running:this.running,stopped:this.stopped,drives:this.drives,controlMode:this.mode,manualDirty:this.manualDirty,recovering:this.recovering,complete:this.complete,phase:stage.id,phaseLabel:stage.label,phaseIndex:this.index,progress:this.duration?this.elapsed/this.duration:0,activeRobot:stage.owner,reason:this.reason,hold:this.hold,time:this.time,speed:this.speed,faults:clone(this.faults),inventory:clone(this.inventory),selection:clone(this.selection),awaitingLoad:!!this.awaitingLoad(),loading:clone(this.loading),queue:clone(this.queue),queueTotal:this.queueTotal,carrier:clone(this.carrier),tray:clone(this.tray),product:clone(this.product),finished:clone(this.finished),history:clone(this.history),events:clone(this.events),robots,program:PROGRAM,outputCapacity:4,shuttles:[{
        id:'S1',status:this.running?'Active':'Docked'
      },{
        id:'S2',status:'Parked'
      },{
        id:'S3',status:'Parked'
      }
      ]
    };
  }
}
