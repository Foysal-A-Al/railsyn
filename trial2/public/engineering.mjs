const $=id=>document.getElementById(id);

function sequence(steps,label) {
  return `<ol class="engineering-sequence" aria-label="${label}">${steps.map(([title,detail])=>
    `<li><strong>${title}</strong><span>${detail}</span></li>`).join('')}</ol>`;
}

const controlLayers=[
  ['Operator & recipes','Select exact B, C and T pockets. Queue up to four jobs.'],
  ['Local command API','Checks origin, command token and payload before changing cell state.'],
  ['Cell state machine','Validates stock and output space, owns each stage and evaluates holds.'],
  ['Model & renderer','Steps rail and robot poses, then renders the latest state in 3D.']
];
const handoff=[
  ['Approach','Tool moves above the source or placement point.'],
  ['Contact & confirm','Close on the selected geometry. A grip fault holds the stage.'],
  ['Lift & transfer','The carried mesh follows its assigned tool through the move.'],
  ['Seat & release','Release onto its support, then retract before rail travel.']
];
const checks=[
  ['Start queue','Validate all recipes together against available pockets and rack capacity.','Reject before starting if stock or output space is insufficient.'],
  ['Station 9 · load','Shuttle docks on the branch and waits for the selected B workpiece.','Place workpiece animates the transfer. Resume releases the stopped shuttle after seating.'],
  ['Station 4 · settle','The vibration fault is evaluated at the assembly settling stage.','Hold until the modeled fault clears. This trial uses a flag and a programmed dwell.'],
  ['Grip confirmation','Check the grip fault at every grip stage. Selected cap and cover stock are consumed on confirmed pickup.','Hold the transfer at the grip stage while the fault is active.'],
  ['Station 8 · vision','Side-mounted camera visualizes inspection. A synthetic vision flag controls the gate.','Keep the assembly at inspection while the flag indicates failure.'],
  ['Dispatch pocket','Reserve a rack position when the job starts. Check output availability before UR10 grips.','Hold dispatch on an output fault. The finished record is added on release.'],
  ['Heartbeat','The automatic cycle checks the synthetic heartbeat gate every tick.','Hold the current stage while the fault is active.'],
  ['Pause / SIM STOP','Pause stops progression. SIM STOP latches, disables drives and freezes the transfer.','Acknowledgement clears the stop latch. Use the appropriate Resume action to move again.']
];

export function controls(){
  return `<section class="guide-card engineering-hero"><p class="engineering-kicker">CONTROL & HANDOFFS</p>
    <h1>From recipe to motion</h1><p>The browser sends an operator command. The local Node.js controller owns the simulation and publishes the resulting state. The 3D view displays that state.</p>
    ${sequence(controlLayers,'Control architecture')}</section>
    <section class="guide-card"><h2>How a part changes hands</h2>
    ${sequence(handoff,'Pick and place sequence')}
    <p>The FANUC moves the tray, the operator loads the body, the UR3e places both covers, and the UR10 transfers the finished assembly. Shuttles S2 and S3 are parked. S1 handles the active sequence.</p></section>
    <section class="guide-card"><h2>What the system checks</h2><div class="engineering-table"><table><thead><tr><th>Decision</th><th>Input and rule</th><th>Response</th></tr></thead><tbody>
    ${checks.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>
    <p class="guide-note">These are simulation gates. Physical safety, grip forces, collision validation and camera measurements require separate hardware validation.</p></section>`;
}

export function responses(){
  return `<section class="guide-card engineering-hero"><p class="engineering-kicker">LIVE CONTROLLER</p>
    <h1>System responses</h1><p>Follow the actual simulator state while a job runs, pauses or waits for an operator.</p>
    <dl class="engineering-metrics">
      <div><dt>Current stage</dt><dd id="system-stage">—</dd></div>
      <div><dt>Controller status</dt><dd id="system-mode">—</dd></div>
      <div><dt>Finished / rack capacity</dt><dd id="system-finished">—</dd></div>
      <div><dt>Queued after current</dt><dd id="system-queue">—</dd></div>
    </dl>
    <p id="system-reason" class="guide-note" aria-live="polite"></p></section>
    <div class="engineering-columns">
      <section class="guide-card"><h2>Payload and resource ownership</h2><dl id="system-payloads" class="engineering-list"></dl></section>
      <section class="guide-card"><h2>Recent events</h2><p>Times use the simulator clock. The list shows the most recent stage changes and operator actions.</p><ol id="system-events" class="engineering-events"></ol></section>
    </div>
    <section class="guide-card"><h2>Response definitions</h2><div class="engineering-table"><table>
      <thead><tr><th>Response</th><th>How to interpret it</th></tr></thead>
      <tbody>
      <tr><td>Completed parts</td><td>Count of assemblies UR10 released into the dispatch rack. The empty shuttle can still be returning after this count increases.</td></tr>
      <tr><td>Queue makespan</td><td>Time from accepting the first recipe until the final tray returns. The isolated study measures this directly from the model.</td></tr>
      <tr><td>Throughput</td><td>Completed parts × 3,600 ÷ queue makespan in seconds. This is a simulated batch rate.</td></tr>
      <tr><td>Waiting and busy time</td><td>The study separates operator response delay, loading animation, rail movement, robot stages and inspection. Robot stage time includes programmed grip and release dwell.</td></tr>
      <tr><td>Energy</td><td>The live controller has no wattmeter. The study can calculate a proxy from power assumptions you enter.</td></tr>
      </tbody>
    </table></div></section>`;
}

function write(id,text){
  const node=$(id);
  if(node&&node.textContent!==text)node.textContent=text;
}

export function updateResponses(s){
  if(!$('system-stage'))return;
  write('system-stage',s.product?s.phaseLabel:'Idle');
  write('system-mode',s.stopped?'Stop latched':s.hold?'Held at gate':s.loading?'Operator loading':
    s.awaitingLoad?'Waiting for operator':s.running?'Running':s.complete?'Complete':s.product?'Paused':'Idle');
  write('system-finished',s.finished.length+' / '+s.outputCapacity);
  write('system-queue',String(s.queue.length));
  write('system-reason',s.reason);
  const payloads=[['Current job',s.product?.id||'—'],['Tray',s.tray.location],
    ['Body',s.product?.body.location||'—'],['First cap',s.product?.cap.location||'—'],
    ['Top cover',s.product?.top.location||'—'],['Assembly holder',s.product?.holder||'—'],
    ...s.robots.map(r=>[r.name,r.holding||'Empty tool'])];
  const list=$('system-payloads');
  const key=JSON.stringify(payloads);
  if(list.dataset.key!==key){
    list.dataset.key=key;
    list.replaceChildren(...payloads.flatMap(([title,value])=>{
      const dt=document.createElement('dt'),dd=document.createElement('dd');
      dt.textContent=title;
      dd.textContent=value;
      return [dt,dd];
    }));
  }
  const events=$('system-events');
  const recent=s.events.slice(0,12),eventKey=JSON.stringify(recent);
  if(events.dataset.key!==eventKey){
    events.dataset.key=eventKey;
    events.replaceChildren(...recent.map(entry=>{
      const li=document.createElement('li');
      li.textContent=entry.time.toFixed(2)+' s · '+entry.message;
      return li;
    }));
  }
}

const domains=[
  ['D1 · Rail transport','Shared station coordinates and arc-length routes.','Travel time, distance and dock state.'],
  ['D2 · Robot operations','Forward/inverse kinematics and programmed approach, grip, lift and release.','Robot stage time and modeled tool ownership.'],
  ['D3 · Assembly state','Body, first cap and top cover each retain source identity.','Stage completion and valid dispatch sequence.'],
  ['D4 · Resources','Reserve queue stock and output positions before starting.','Inventory changes, output occupancy and rejected queues.'],
  ['D5 · Quality and dispatch','Synthetic inspection gate, supported release and tray return.','Finished count, holds and output identities.'],
  ['D6 · Energy accounting','Optional power assumptions for the isolated study.','Estimated Wh per batch. Physical readings would be needed to calibrate it.']
];

export function research(){
  return `<section class="guide-card engineering-hero"><p class="engineering-kicker">ENGINEERING STUDY</p>
  <h1>Compare operating settings</h1>
  <p>The study runs seven speed settings in separate copies of the same cell model. Each copy starts with fresh stock, an empty rack and the same selected batch size. The Workbench keeps its own state.</p>
  ${sequence([['Choose a scenario','Batch size, operator delay and target throughput.'],['Run the cell model','Each candidate completes the same recipes with the same loading rule.'],['Calculate responses','Compare cycle time, throughput, operator wait and optional energy.'],['Select a candidate','Pick the lowest speed or energy among settings that meet the target.']],'Optimization and evaluation loop')}</section>
  <section class="guide-card"><h2>Run a speed sweep</h2>
  <form id="study-form" class="engineering-form">
    <label>Batch size <select name="jobs"><option>1</option><option>2</option><option selected>4</option></select></label>
    <label>Operator response delay (s/job) <input name="delay" type="number" min="0" max="60" step="0.5" value="5" required></label>
    <label>Target throughput (parts/h) <input name="target" type="number" min="0" max="10000" step="1" value="30" required></label>
    <label>Baseline power (W, optional) <input name="idleWatts" type="number" min="0" max="10000" step="any" placeholder="Enter a value"></label>
    <label>Extra motion power at 1× (W, optional) <input name="motionWatts" type="number" min="0" max="10000" step="any" placeholder="Enter a value"></label>
    <button class="primary" type="submit">Compare settings</button>
  </form>
  <p>Seven settings from 0.50× to 2.00×, one active shuttle, nominal operation with fault flags clear. The study triggers Place workpiece after the delay and resumes when the loading animation completes.</p>
  <p id="study-status" class="guide-note" role="status">Enter both power assumptions to compare estimated energy. Leave both blank to compare speed against throughput.</p>
  <div id="study-results"></div></section>
  <section class="guide-card"><h2>Coupled model and responses</h2><div class="engineering-table"><table>
  <thead><tr><th>Module</th><th>Model rule</th><th>Observable response</th></tr></thead>
  <tbody>${domains.map(row=>`<tr>${row.map(text=>`<td>${text}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
  <section class="guide-card"><h2>Objectives, constraints and validation</h2>
  <div class="engineering-columns">
    <div><h3>Implemented search</h3><p>Enumerate the speed grid and keep candidates that meet the target. A candidate is Pareto efficient if no other setting has at least its throughput and at most its cost, with a strict improvement in one. The cost is speed or optional estimated energy. Batch size is limited by the four output pockets.</p></div>
    <div><h3>Energy assumption</h3><p>Estimated Wh = (baseline W × batch seconds + extra motion W × speed² × motion-stage seconds) ÷ 3,600. Motion-stage time includes rail and robot stages. The squared term is a screening assumption. Use synchronized power readings to fit a credible model.</p></div>
    <div><h3>Proposed research extension</h3><p>Trial 2 does not run an NSGA-II search. A larger study could vary station dwell, buffers, routing policy and the number of active carriers after implementing occupancy arbitration. NSGA-II is a candidate method for a larger mixed-variable design space.</p></div>
    <div><h3>How to validate</h3><p>Capture station timestamps, recipe IDs, shuttle position, holds and power with a common clock. Compare predicted cycle and waiting times against held-out runs. For stochastic experiments, report repeated-run variation and document seeds and fault assumptions.</p></div>
  </div>
  <p>Method reference: <a href="https://doi.org/10.1109/4235.996017" target="_blank" rel="noopener noreferrer">Deb et al., NSGA-II (2002)</a>.</p></section>`;
}

function plotStudy(reply){
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 720 300');
  svg.setAttribute('class','study-chart');
  svg.setAttribute('role','img');
  svg.setAttribute('aria-label','Candidate throughput against '+(reply.hasEnergy?'estimated energy':'program speed'));
  const cost=row=>reply.hasEnergy?row.energy:row.speed;
  const min=Math.min(...reply.rows.map(cost)),max=Math.max(...reply.rows.map(cost));
  const ceiling=Math.max(...reply.rows.map(row=>row.rate))*1.12;
  const x=v=>72+(max===min?.5:(v-min)/(max-min))*590;
  const y=v=>238-v/ceiling*200;
  function element(tag,attrs,text){
    const node=document.createElementNS(ns,tag);
    for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
    if(text)node.textContent=text;
    svg.append(node);
    return node;
  }
  for(let i=0;i<=4;i++){
    const rate=ceiling*i/4,rowY=y(rate);
    element('line',{x1:72,y1:rowY,x2:662,y2:rowY,stroke:'#dce5ee'});
    element('text',{x:60,y:rowY+4,'text-anchor':'end'},rate.toFixed(0));
    const value=min+(max-min)*i/4,colX=72+590*i/4;
    element('text',{x:colX,y:258,'text-anchor':'middle'},value.toFixed(2));
  }
  element('text',{x:72,y:20},'Throughput (parts/h)');
  element('text',{x:365,y:285,'text-anchor':'middle'},reply.hasEnergy?'Estimated energy (Wh per batch)':'Program speed (×)');
  for(const row of reply.rows){
    const chosen=row.speed===reply.selected?.speed;
    const dot=element('circle',{cx:x(cost(row)),cy:y(row.rate),r:chosen?9:6,
      fill:chosen?'#008a70':row.pareto?'#155fe3':'#8195a9'});
    const title=document.createElementNS(ns,'title');
    title.textContent=row.speed.toFixed(2)+'× · '+row.rate.toFixed(1)+' parts/h'+(chosen?' · Selected':'');
    dot.append(title);
  }
  return svg;
}

export function bindStudy(){
  const form=$('study-form');
  if(!form)return;
  form.onsubmit=event=>{
    event.preventDefault();
    const data=new FormData(form);
    const value=name=>Number(data.get(name));
    const optional=name=>data.get(name)===''?null:value(name);
    const status=$('study-status'),result=$('study-results'),button=form.querySelector('button');
    let worker;
    try{worker=new Worker(new URL('./study-worker.mjs',import.meta.url),{type:'module'});}
    catch{status.textContent='The study worker could not start.';return;}
    button.disabled=true;
    result.replaceChildren();
    status.textContent='Running seven isolated scenarios…';
    const done=()=>{worker.terminate();button.disabled=false;};
    worker.onerror=()=>{done();status.textContent='The study worker could not load.';};
    worker.onmessage=({data:reply})=>{
      done();
      if(reply.error){status.textContent=reply.error;return;}
      status.textContent=reply.selected?
        `At ${reply.selected.speed.toFixed(2)}× the model reaches ${reply.selected.rate.toFixed(1)} parts/h. This is the lowest ${reply.hasEnergy?'estimated energy':'speed'} among settings that meet the target.`:
        'None of these seven settings reaches the requested throughput.';
      const table=document.createElement('table'),head=table.createTHead().insertRow(),body=table.createTBody();
      for(const name of ['Speed','Batch (s)','Parts/h','Operator wait (s)','Rail (s)','Robot stages (s)','Energy (Wh)','Trade-off']){
        const th=document.createElement('th');th.textContent=name;head.append(th);
      }
      for(const row of reply.rows){
        const tr=body.insertRow(),number=n=>n.toFixed(2);
        if(row.speed===reply.selected?.speed)tr.className='study-selected';
        for(const text of [number(row.speed)+'×',number(row.seconds),number(row.rate),number(row.times.waiting),
          number(row.times.rail),number(row.times.fanuc+row.times.ur3e+row.times.ur10),
          row.energy===null?'—':number(row.energy),row.pareto?'Pareto efficient':'Dominated']){
          tr.insertCell().textContent=text;
        }
      }
      result.className='engineering-table';
      const legend=document.createElement('p');
      legend.className='small muted';
      legend.textContent='Green: selected setting. Blue: Pareto efficient. Gray: dominated.';
      result.append(plotStudy(reply),legend,table);
    };
    worker.postMessage({jobs:value('jobs'),delay:value('delay'),target:value('target'),
      idleWatts:optional('idleWatts'),motionWatts:optional('motionWatts')});
  };
}
