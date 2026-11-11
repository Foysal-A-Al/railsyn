import {
  initialize,setState,focusStation,thumbnail,drawTool
} from './scene.mjs';
import {
  initializeGuide,updateGuide
} from './guide.mjs';
const $=id=>document.getElementById(id);
let state,token='',selected='ur3e',generation=-1,lastComplete=false,recipeKey='',lastTool='';
let draft={
  body:'',cap:'',top:'',destination:'dispatch'
};
window.__trial2={
  loaded:false
};
let recipes=[],queueKey='',loadingJob='';
const partKeys=['body','cap','top'];
async function command(action,value){
  $('error').textContent='';
  try{
    const r=await fetch('/api/command',{
      method:'POST',headers:{
        'Content-Type':'application/json','X-RailSyn-Token':token
      },body:JSON.stringify({
        action,value
      })
    });
    const d=await r.json();
    if(!r.ok)throw Error(d.error);
    await refresh();
    return true;
  }
  catch(e){
    $('error').textContent=e.message;
    return false;
  }
}
function safe(){
  return !state.running&&!state.recovering&&!state.manualDirty&&(!state.product||state.complete);
}
function issue(){
  if(partKeys.some(k=>!draft[k]))return 'Choose a workpiece, first cap and top cover.';
  for(const k of partKeys){
    if(!state.inventory.some(p=>p.id===draft[k]&&p.kind===k&&p.quantity>0))return 'One selected pocket is empty.';
  }
  const reserved=[...recipes,draft];
  for(const pocket of state.inventory){
    if(reserved.filter(recipe=>recipe[pocket.kind]===pocket.id).length>pocket.quantity)return pocket.id+' has insufficient stock for the queue.';
  }
  if(reserved.length>Math.min(4,state.outputCapacity-state.finished.length))return 'No free queue or dispatch slots.';
  if(state.finished.length>=4)return 'Dispatch rack is full. Reset to replenish the demonstration.';
  return '';
}
function choose(id){
  if(!safe()){
    $('error').textContent='Finish the current job and recover manual changes before changing sources.';
    return;
  }
  const p=state.inventory.find(p=>p.id===id&&p.quantity>0);
  if(!p)return;
  draft[p.kind]=id;
  recipeKey='';
  update();
}
function summary(recipe=draft){
  return recipe&&partKeys.every(k=>recipe[k])?[recipe.body,recipe.cap,recipe.top].join(' + '):'Choose three parts';
}
function renderInventory(){
  const key=JSON.stringify([state.inventory.map(p=>p.quantity),draft,safe(),!!thumbnail('B1')]);
  if(key===recipeKey)return;
  recipeKey=key;
  $('inventory').replaceChildren();
  for(const [index,kind]of partKeys.entries()){
    const section=document.createElement('section');
    section.className='tray';
    const h=document.createElement('h3'),n=document.createElement('span');
    n.textContent=index+1;
    h.append(n,document.createTextNode(['Workpiece / cup','First cap','Top cover / stack'][index]));
    const grid=document.createElement('div');
    grid.className='pockets '+(kind==='body'?'body':'');
    for(const p of state.inventory.filter(p=>p.kind===kind)){
      const b=document.createElement('button');
      b.className='pocket'+(draft[kind]===p.id?' picked':'');
      b.dataset.pocket=p.id;
      b.disabled=!p.quantity||!safe();
      b.title=p.id+' · '+p.quantity+' remaining';
      const url=thumbnail(p.id);
      if(url){
        const im=document.createElement('img');
        im.className='thumb';
        im.src=url;
        im.alt=kind+' '+p.id;
        b.append(im);
      }
      const name=document.createElement('b');
      name.textContent=p.id;
      const qty=document.createElement('small');
      qty.textContent='× '+p.quantity;
      b.append(name,qty);
      b.onclick=()=>choose(p.id);
      grid.append(b);
    }
    section.append(h,grid);
    $('inventory').append(section);
  }
}
function robotControls(){
  const r=state.robots.find(r=>r.id===selected);
  $('robot-tabs').replaceChildren(...state.robots.map(r=>{
    const b=document.createElement('button');b.textContent=r.id==='fanuc'?'FANUC':r.name;b.className=selected===r.id?'selected':'';b.dataset.robot=r.id;b.onclick=()=>{
      selected=r.id;update();
    };return b;
  }));
  $('robot-name').textContent=r.name;
  $('robot-job').textContent=r.job;
  $('tool-name').textContent=r.tool;
  $('tool-state').textContent=r.holding?'HOLDING '+r.holding.toUpperCase():r.engaged?'CLOSED / COMMANDED':'OPEN';
  if(lastTool!==selected&&thumbnail(selected)){
    drawTool($('tool-preview'),selected);
    lastTool=selected;
  }
  const manual=state.controlMode==='manual'&&!state.loading&&state.drives&&!state.running&&!state.stopped&&!state.recovering&&!state.robots.some(r=>r.holding);
  r.joints.forEach((q,i)=>$('j'+i).textContent=q.toFixed(1)+'°');
  document.querySelectorAll('[data-jog]').forEach(b=>b.disabled=!manual);
  $('open').disabled=$('close').disabled=!manual;
  $('recover').disabled=state.controlMode!=='manual'||!state.drives||state.running||state.recovering||state.stopped||state.robots.some(r=>r.holding);
  $('manual').disabled=$('program').disabled=state.running||state.recovering;
  $('manual').classList.toggle('selected',state.controlMode==='manual');
  $('program').classList.toggle('selected',state.controlMode==='program');
  $('tcp').replaceChildren(...r.tcp.map((p,i)=>{
    const s=document.createElement('span');s.textContent='XYZ'[i];const b=document.createElement('b');b.textContent=(p*1000).toFixed(0);s.append(b);return s;
  }));
  $('drives').textContent='● Drives '+(state.drives?'ON':'OFF');
  $('controller-notice').textContent=state.manualDirty?'Manual pose changed. Recover before Run.':state.robots.some(r=>r.holding)?'Payload held. Complete transfer before manual jogging.':'Jogging and tool controls require Manual mode and enabled drives.';
}
function update(){
  if(!state)return;
  if(generation!==state.generation||!lastComplete&&state.complete){
    draft=state.selection?{
      ...state.selection
    }
    :{
      body:'',cap:'',top:'',destination:'dispatch'
    };
    recipes=[];
    generation=state.generation;
    recipeKey='';
  }
  lastComplete=state.complete;
  renderInventory();
  const active=!!state.product&&!state.complete,problem=issue();
  $('selection-left').textContent=summary();
  $('selection-controller').textContent=summary(active?state.selection:draft);
  $('recipe-message').textContent=state.stopped?'Simulation stop latched. Clear it before resuming.':active?state.reason:recipes.length?'Queue ready. Add another recipe or start.':problem||'Add the selected recipe to the queue.';
  $('run').textContent=active?'▶ Resume queue':'▶ Start queue';
  $('run').hidden=state.awaitingLoad;
  $('run').disabled=state.running||state.stopped||state.manualDirty||state.recovering||(active?state.awaitingLoad:!recipes.length);
  $('load-workpiece').hidden=!state.awaitingLoad;
  $('load-workpiece').disabled=state.stopped||state.manualDirty||state.recovering||!!state.loading&&!state.loading.paused;
  $('load-workpiece').textContent=state.loading?(state.loading.paused?'Resume loading':'Operator loading…'):'Place '+(state.selection?.body||'workpiece')+' in shuttle';
  if(state.awaitingLoad&&loadingJob!==state.product.id){
    loadingJob=state.product.id;
    focusStation('setup');
    document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('selected',button.dataset.view==='setup'));
  }
  if(!state.product)loadingJob='';
  $('apply').disabled=!safe()||!!problem;
  renderQueue(active);
  $('pause').disabled=!state.running&&!state.recovering&&(!state.loading||state.loading.paused);
  $('step').disabled=state.running||state.stopped||state.recovering||state.manualDirty||state.awaitingLoad||!active;
  $('ack').hidden=!state.stopped;
  $('stop').textContent=state.stopped?'■ STOP LATCHED':'■ SIM STOP';
  $('status').textContent=state.stopped?'STOPPED':state.awaitingLoad?(state.loading?'OPERATOR LOADING':'WAITING FOR LOAD'):state.running?state.hold?'HOLD':'RUNNING':state.recovering?'RECOVERING':state.complete?'COMPLETE':'AWAITING OPERATOR';
  $('job-id').textContent=state.product?.id||'NO ACTIVE JOB';
  $('job-stage').textContent=state.reason;
  $('collected').textContent=state.finished.length+' / '+state.outputCapacity;
  $('s1').textContent='S1 · '+(state.running?'Active':'Docked');
  $('speed').value=state.speed;
  $('speed-value').textContent=state.speed.toFixed(2)+'×';
  $('output').replaceChildren(...Array.from({
    length:4
  },(_,i)=>{
    const p=state.finished[i],el=document.createElement('div');el.className='output-slot'+(p?' full':'');el.textContent=p?p.id:'POCKET '+(i+1);if(p){
      const s=document.createElement('small');s.textContent=p.sources.body+' + '+p.sources.cap+' + '+p.sources.top;el.append(s);
    }
    return el;
  }));
  const phases=['tray','setup','assembly','vision','return'];
  let now=state.phase.startsWith('tray_')?0:state.phase==='travel_setup'||state.phase==='fixture'?1:state.phase.startsWith('cap_')||state.phase.startsWith('top_')||state.phase==='travel_assembly'||state.phase==='settle_assembly'||state.phase==='assembly_clear'?2:state.phase==='travel_vision'||state.phase==='vision'||state.phase.startsWith('dispatch_')?3:4;
  if(!state.product)now=-1;
  $('stage-progress').replaceChildren(...['Tray load','Setup','Assembly','Dispatch','Return'].map((t,i)=>{
    const s=document.createElement('span');s.textContent=t;s.className='stage-chip'+(i===now?' active':i<now?' done':'');return s;
  }));
  $('events').replaceChildren(...state.events.slice(0,20).map(e=>{
    const p=document.createElement('p');p.textContent=e.time.toFixed(1)+'s · '+e.message;return p;
  }));
  document.querySelectorAll('[data-fault]').forEach(b=>b.classList.toggle('fault-active',state.faults[b.dataset.fault]));
  robotControls();
  setState(state,active?state.selection:draft);
  updateGuide(state);
  window.__trial2.state=state;
  window.__trial2.draft={
    ...draft
  };
  window.__trial2.loaded=!!window.__trial2.scene?.loaded;
}
async function refresh(){
  const r=await fetch('/api/state');
  if(!r.ok)throw Error('Controller unavailable.');
  state=await r.json();
  update();
}
for(let i=0;i<6;i++){
  const row=document.createElement('div');
  row.className='joint';
  const label=document.createElement('b');
  label.textContent='J'+(i+1);
  const angle=document.createElement('strong');
  angle.id='j'+i;
  angle.textContent='0°';
  const controls=document.createElement('div');
  controls.className='jog-buttons';
  for(const sign of [-1,1]){
    const b=document.createElement('button');
    b.textContent=sign===1?'+':'−';
    b.dataset.jog='true';
    b.setAttribute('aria-label',`Jog J${i+1} ${sign<0?'negative':'positive'}`);
    b.onclick=()=>command('jog',{
      robot:selected,joint:i,delta:sign*Number($('jog-step').value)
    });
    controls.append(b);
  }
  row.append(label,angle,controls);
  $('joints').append(row);
}
$('run').onclick=()=>{
  const active=state.product&&!state.complete;
  command(active?'resume':'run',active?undefined:recipes);
};
$('load-workpiece').onclick=()=>command('load_workpiece',state.selection?.body);
$('apply').onclick=()=>{
  if(!safe()||issue())return;
  recipes.push({...draft});
  draft={body:'',cap:'',top:'',destination:'dispatch'};
  update();
};
function renderQueue(active){
  const list=active?[state.selection,...state.queue]:recipes;
  const key=JSON.stringify([active,list,state.queueTotal]);
  if(key===queueKey)return;
  queueKey=key;
  $('recipe-queue').replaceChildren(...list.map((recipe,index)=>{
    const row=document.createElement('li');
    const number=active?state.queueTotal-list.length+index+1:index+1;
    const title=document.createElement('span');
    title.textContent=number+'. '+[recipe.body,recipe.cap,recipe.top].join(' · ');
    row.append(title);
    if(active&&index===0)row.classList.add('current');
    if(!active){
      const up=document.createElement('button');
      up.textContent='↑';
      up.disabled=index===0;
      up.setAttribute('aria-label','Move recipe '+number+' up');
      up.onclick=()=>{
        [recipes[index-1],recipes[index]]=[recipes[index],recipes[index-1]];
        update();
      };
      const remove=document.createElement('button');
      remove.textContent='×';
      remove.setAttribute('aria-label','Remove recipe '+number);
      remove.onclick=()=>{recipes.splice(index,1);update();};
      row.append(up,remove);
    }
    return row;
  }));
}
for(const action of ['pause','step','stop','reset','recover'])$(action).onclick=()=>command(action);
$('ack').onclick=()=>command('ack_stop');
$('program').onclick=()=>command('mode','program');
$('manual').onclick=()=>command('mode','manual');
$('drives').onclick=()=>command('drives',!state.drives);
$('speed').onchange=e=>command('speed',Number(e.target.value));
$('speed').oninput=e=>$('speed-value').textContent=Number(e.target.value).toFixed(2)+'×';
$('open').onclick=()=>command('tool',{
  robot:selected,engaged:false
});
$('close').onclick=()=>command('tool',{
  robot:selected,engaged:true
});
for(const name of ['grip','vision','output','vibration','heartbeat']){
  const b=document.createElement('button');
  b.dataset.fault=name;
  b.textContent=name;
  b.onclick=()=>command('fault',{
    name,enabled:!state.faults[name]
  });
  $('faults').append(b);
}
$('export').onclick=async()=>{
  const r=await fetch('/api/export');
  const u=URL.createObjectURL(new Blob([JSON.stringify(await r.json(),null,2)],{
    type:'application/json'
  }));
  const a=document.createElement('a');
  a.href=u;
  a.download='railsyn-trial2-run.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
};
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==b.dataset.page);document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('selected',x===b));window.__trial2.page=b.dataset.page;
});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{
  focusStation(b.dataset.view);document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('selected',x===b));
});
initializeGuide();
try{
  token=(await(await fetch('/api/session')).json()).token;
  await refresh();
  setInterval(()=>refresh().catch(e=>$('error').textContent=e.message),160);
}
catch(e){
  $('error').textContent=e.message;
}
initialize($('scene'),choose).then(()=>{
  recipeKey='';lastTool='';update();
}).catch(e=>{
  $('scene-error').hidden=false;$('scene-error').textContent='3D initialization failed: '+e.message;$('asset-state').textContent='3D UNAVAILABLE';console.error(e);
});
