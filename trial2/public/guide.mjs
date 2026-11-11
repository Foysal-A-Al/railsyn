import {
  ROBOTS,MAIN,BRANCH,ROUTES,atDistance
} from './model.mjs';
import {drawTool,thumbnail} from './scene.mjs';
import {controls,responses,research,bindStudy,updateResponses} from './engineering.mjs';
const $=id=>document.getElementById(id);
const steps=[
{
  name:'Load tray',phase:'tray',station:6,owner:'FANUC ER-4iA',text:'The FANUC conveyor cell loads an empty tray blister onto positioned shuttle S1. Its two-jaw tool retracts before transport is permitted.',conditions:['Tray supported before grip','S1 docked at station 6','Grip confirmation received','FANUC clear before travel'],route:'setup'
},
{
  name:'Manual loading',phase:'fixture',station:9,owner:'Operator',text:'S1 enters the lower branch. The operator places the selected workpiece directly in the docked shuttle nest using the controller. Resume releases the shuttle for assembly.',conditions:['S1 positioned on branch','Chosen B pocket available','Operator placed the selected workpiece','Workpiece presence modeled'],route:'setup'
},
{
  name:'Assembly',phase:'assembly',station:4,owner:'UR3e',text:'The UR3e picks the selected first cap and then the selected top cover, using the two-finger adaptive tool. Each part is released only at the supported assembly position.',conditions:['Station reserved for S1','Shuttle docked and settled','Grip confirmation received','Tool clear before transport'],route:'assembly'
},
{
  name:'Vision & dispatch',phase:'vision',station:8,owner:'Vision model + UR10',text:'The shuttle follows the main loop past 5, 6 and 7. A camera mounted beside the rail looks at the stopped assembly. The modeled vision gate checks presence, then UR10 lifts the assembly into the reserved output pocket.',conditions:['Assembly sequence completed','Modeled vision gate passed','Output location available','Grip confirmed before lift'],route:'vision'
},
{
  name:'Return & wait',phase:'return',station:6,owner:'Montrac + FANUC',text:'S1 returns with its empty tray. FANUC returns that tray to the conveyor. The product remains in the dispatch rack, and the next queued job starts with its own operator loading stop.',conditions:['Product retained at output','No robot holding a payload during travel','Tray returned to support','Queue advances in order'],route:'return'
}
];
const point=p=>[42+(p[0]+5.4)*51,38+(p[2]+5)*43];
const d=points=>points.map((p,i)=>{
  const [x,y]=point(p);return (i?'L':'M')+x.toFixed(1)+','+y.toFixed(1);
}).join(' ');
let current=2,preview=false,start=0,lastState=null;
function map(){
  return `<svg class="route-map" viewBox="0 0 760 560" role="img" aria-label="Original Trial 2 route diagram with main loop and manual loading branch"><defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="#1b6be9"/></marker></defs><rect x="0" y="0" width="760" height="560" rx="12" fill="#f6f9fc"/><path d="${d(MAIN)}" fill="none" stroke="#b0c0ce" stroke-width="14" stroke-linejoin="round"/><path d="${d(BRANCH)}" fill="none" stroke="#b0c0ce" stroke-width="14"/><path d="${d(MAIN)}" fill="none" stroke="#fff" stroke-width="2"/><path d="${d(BRANCH)}" fill="none" stroke="#fff" stroke-width="2"/><path id="guide-route" fill="none" stroke="#2374e8" stroke-width="5" stroke-linecap="round" stroke-dasharray="7 5"/><rect x="94" y="209" width="80" height="130" rx="5" fill="#e0e8ef" stroke="#a0b3c4"/><text x="134" y="269" text-anchor="middle" fill="#38566e" font-size="12">Warehouse</text><text x="134" y="289" text-anchor="middle" fill="#38566e" font-size="10">Trays / products</text><rect x="177" y="43" width="152" height="69" rx="6" fill="#fff5d6" stroke="#cfb85c"/><text x="253" y="69" text-anchor="middle" fill="#785f16" font-size="13">FANUC cell</text><text x="253" y="90" text-anchor="middle" fill="#785f16" font-size="10">Conveyor / tray handling</text><circle cx="218" cy="317" r="23" fill="#d8ebf4" stroke="#6b9fba"/><text x="218" y="322" text-anchor="middle" fill="#254f67" font-size="11">UR10</text><circle cx="653" cy="254" r="22" fill="#d8ebf4" stroke="#6b9fba"/><text x="653" y="258" text-anchor="middle" fill="#254f67" font-size="11">UR3e</text>${[[6,[-1.5,0,-2.8],'Tray loading'],[4,[5,0,0],'Assembly'],[8,[-2.4,0,2.8],'Vision / dispatch'],[9,[1.7,0,4.8],'Manual loading'],[5,[2.7,0,-2.8],'Position / pass'],[7,[-5,0,.4],'Pass-through'],[10,[3,0,3.6],'Rejoin']].map(([n,p,label])=>{const [x,y]=point(p);return `<g><circle id="station-${n}" cx="${x}" cy="${y}" r="16" fill="#fff" stroke="#669ab7" stroke-width="2"/><text x="${x}" y="${y+5}" fill="#1d4a64" font-size="13" text-anchor="middle">${n}</text><text x="${x}" y="${y+36}" fill="#46627a" font-size="10" text-anchor="middle">${label}</text></g>`;}).join('')}<circle id="live-shuttle" r="8" fill="#008d7b" stroke="white" stroke-width="3"/><circle id="preview-shuttle" r="9" fill="#135ee1" stroke="white" stroke-width="3" visibility="hidden"/><text x="35" y="530" fill="#72879a" font-size="11">Green: live S1 position. Blue: independent explanation preview.</text></svg>`;
}
function renderStage(){
  const s=steps[current];
  document.querySelectorAll('[data-story]').forEach(b=>b.classList.toggle('selected',+b.dataset.story===current));
  $('guide-route')?.setAttribute('d',d(ROUTES[s.route].points));
  for(const n of [4,5,6,7,8,9,10]){
    const c=$('station-'+n);
    if(c){
      c.setAttribute('fill',s.station===n?'#155fe3':'#fff');
      c.nextElementSibling?.setAttribute('fill',s.station===n?'white':'#1d4a64');
    }
  }
  $('guide-info').replaceChildren();
  const h=document.createElement('h2');
  h.textContent=`Station ${s.station} · ${s.name}`;
  const owner=document.createElement('strong');
  owner.textContent=s.owner;
  const p=document.createElement('p');
  p.textContent=s.text;
  const ul=document.createElement('ul');
  for(const t of s.conditions){
    const li=document.createElement('li');
    li.textContent='✓ '+t;
    ul.append(li);
  }
  const next=document.createElement('button');
  next.id='guide-preview';
  next.textContent='▶ Preview route';
  next.onclick=()=>{
    preview=!preview;
    start=performance.now();
    next.textContent=preview?'Ⅱ Stop preview':'▶ Preview route';
  };
  const note=document.createElement('p');
  note.className='source-boundary';
  note.textContent='Tutorial preview only. It sends no controller commands and does not move the production cell.';
  $('guide-info').append(h,owner,p,ul,next,note);
}
export function initializeGuide(){
  document.querySelectorAll('[data-guide]').forEach(b=>b.onclick=()=>show(b.dataset.guide));
  show('flow');
  let last=0;
  function animate(now){
    requestAnimationFrame(animate);
    if(now-last<45)return;
    last=now;
    const dot=$('preview-shuttle');
    if(preview&&dot){
      const route=ROUTES[steps[current].route],t=((now-start)/8000)%1,p=point(atDistance(route,t*route.length).position);
      dot.setAttribute('cx',p[0]);
      dot.setAttribute('cy',p[1]);
      dot.setAttribute('visibility','visible');
    }
    else dot?.setAttribute('visibility','hidden');
  }
  requestAnimationFrame(animate);
}
function show(id){
  preview=false;
  document.querySelectorAll('[data-guide]').forEach(b=>b.classList.toggle('selected',b.dataset.guide===id));
  if(id==='flow'){
    $('guide-content').innerHTML=`<div class="guide-layout"><aside class="guide-nav">${steps.map((s,i)=>`<button data-story="${i}">${i+1} · ${s.name}</button>`).join('')}<p class="muted small">A passing shuttle does not repeat every station operation. State and destination govern the selected job.</p></aside><section class="guide-main"><h1>How the automated line works</h1><p>A main loop, manual loading branch, distinct cells and a retained dispatch rack.</p>${map()}<div class="flow-strip"><span>Setup 9</span><span>Assembly 4</span><span>Vision / dispatch 8</span><span>Return & wait</span></div><p class="source-boundary">Original native diagram generated from the Trial 2 route coordinates. No source slides or photos are embedded.</p></section><aside id="guide-info" class="guide-info"></aside></div>`;
    document.querySelectorAll('[data-story]').forEach(b=>b.onclick=()=>{
      current=+b.dataset.story;preview=false;renderStage();
    });
    renderStage();
    if(lastState)updateGuide(lastState);
  }
  else if(id==='hardware'){
    $('guide-content').innerHTML=`<div class="guide-card"><h1>Three robots. Distinct tools and responsibilities.</h1><p>Original concept models informed by the supplied equipment references. These meshes, joint limits and frames are not calibrated manufacturer CAD.</p></div><div class="hardware-grid">${ROBOTS.map(r=>`<article class="guide-card"><h2>${r.name}</h2><canvas width="600" height="400" id="guide-tool-${r.id}"></canvas><h3>${r.tool}</h3><p>${r.job}</p><p>${r.id==='fanuc'?'Rectangular jaw actuator and long gripping fingers. Loads and returns the modeled carrier tray.':r.id==='ur3e'?'Compact adaptive two-finger mechanism. Performs sequential selected first-cap and cover placement.':'Three articulated gripping fingers. Moves the complete assembly to the reserved dispatch location.'}</p></article>`).join('')}</div><div class="guide-card"><h2>Cell controls and robot controls</h2><p>The selected recipe belongs to the cell. Selecting another robot changes the displayed joints and tool, not the recipe. The Workbench controller starts the recipe queue and handles each loading stop. Manual jogging requires enabled drives and empty tools; recover the saved program pose before resuming.</p><p>Simulation Stop latches and drives go off. Acknowledgement never restarts motion. Reset explicitly replenishes stock and clears products. No button commands physical equipment.</p></div>`;
    ROBOTS.forEach(r=>drawTool($('guide-tool-'+r.id),r.id));
  }
  else if(id==='controls')$('guide-content').innerHTML=controls();
  else if(id==='responses'){
    $('guide-content').innerHTML=responses();
    if(lastState)updateResponses(lastState);
  }
  else{
    $('guide-content').innerHTML=research();
    bindStudy();
  }
  window.__trial2.guide=id;
}
export function updateGuide(s){
  // A user may open this tab while the asynchronous 3D asset load is pending.
  for(const r of ROBOTS){
    const canvas=$('guide-tool-'+r.id);
    if(canvas&&!canvas.dataset.ready&&thumbnail(r.id)){
      drawTool(canvas,r.id);
      canvas.dataset.ready='true';
    }
  }
  lastState=s;
  updateResponses(s);
  const dot=$('live-shuttle');
  if(dot){
    const p=point(s.carrier.position);
    dot.setAttribute('cx',p[0]);
    dot.setAttribute('cy',p[1]);
  }
  window.__trial2.guideStage=current;
}
