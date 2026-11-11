import test from 'node:test';
import assert from 'node:assert/strict';
const mod=await import('../cell.mjs').catch(()=>({
}));
const create=()=>{
  assert.equal(typeof mod.Cell,'function','Trial 2 Cell implementation required');
  return new mod.Cell();
};
const recipe={
  body:'B2',cap:'C1',top:'T3',destination:'dispatch'
};
function loadIfWaiting(c,s){
  if(!s.awaitingLoad)return;
  if(!s.loading)c.command('load_workpiece',s.selection.body);
  while(c.snapshot().loading)c.tick(.1);
  c.command('resume');
}
function until(c,p,max=40000){
  for(let i=0;i<max;i++){
    c.tick(.05);
    const s=c.snapshot();
    if(p(s))return;
    loadIfWaiting(c,s);
  }
  assert.fail('Condition not reached: '+JSON.stringify(c.snapshot().phase));
}
test('Trial 2 starts idle and requires three explicit sources',()=>{
  const c=create();assert.equal(c.snapshot().trial,2);assert.equal(c.snapshot().running,false);assert.throws(()=>c.command('run',{
  }));
});
test('mixed recipe follows tray, setup, assembly, vision, dispatch and return once',()=>{
  const c=create();c.command('run',recipe);until(c,s=>s.complete);const s=c.snapshot();assert.equal(s.finished.length,1);assert.deepEqual(s.finished[0].sources,recipe);assert.equal(s.running,false);assert.equal(s.selection,null);assert.deepEqual(s.robots.map(r=>r.id).sort(),['fanuc','ur10','ur3e']);assert.ok(s.history.some(x=>x.phase==='fixture'));assert.ok(s.history.some(x=>x.phase==='vision'));const before=s.inventory;for(let i=0;i<200;i++)c.tick(.05);assert.deepEqual(c.snapshot().inventory,before);assert.equal(c.snapshot().finished.length,1);
});
test('every job phase assigns the correct distinct robot',()=>{
  const c=create();c.command('run',recipe);until(c,s=>s.phase==='tray_grip');assert.equal(c.snapshot().activeRobot,'fanuc');until(c,s=>s.phase==='cap_grip');assert.equal(c.snapshot().activeRobot,'ur3e');until(c,s=>s.phase==='dispatch_grip');assert.equal(c.snapshot().activeRobot,'ur10');
});
test('grip fault keeps stock supported, then consumes only on confirmed grip',()=>{
  const c=create();c.command('fault',{
    name:'grip',enabled:true
  }
  );c.command('run',recipe);until(c,s=>s.phase==='tray_grip');for(let i=0;i<80;i++)c.tick(.05);assert.equal(c.snapshot().tray.location,'supply');c.command('fault',{
    name:'grip',enabled:false
  }
  );until(c,s=>s.phase==='cap_grip');c.command('fault',{
    name:'grip',enabled:true
  }
  );const stock=c.snapshot().inventory.find(p=>p.id==='C1').quantity;for(let i=0;i<80;i++)c.tick(.05);assert.equal(c.snapshot().inventory.find(p=>p.id==='C1').quantity,stock);c.command('fault',{
    name:'grip',enabled:false
  }
  );until(c,s=>s.phase==='cap_lift');assert.equal(c.snapshot().inventory.find(p=>p.id==='C1').quantity,stock-1);
});
test('latched stop freezes carrier and joints; acknowledgement does not move',()=>{
  const c=create();c.command('run',recipe);until(c,s=>s.phase==='travel_setup');c.command('stop');const a=c.snapshot();for(let i=0;i<100;i++)c.tick(.05);assert.deepEqual(c.snapshot().carrier,a.carrier);assert.deepEqual(c.snapshot().robots.map(r=>r.joints),a.robots.map(r=>r.joints));assert.throws(()=>c.command('run',recipe));c.command('ack_stop');assert.equal(c.snapshot().running,false);assert.deepEqual(c.snapshot().carrier,a.carrier);c.command('resume');until(c,s=>s.complete);
});
test('carrier travels continuously including the setup branch and return',()=>{
  const c=create();c.command('run',recipe);let before=c.snapshot().carrier.position;let branch=false;for(let i=0;i<40000&&!c.snapshot().complete;i++){
    c.tick(.02);const s=c.snapshot(),p=s.carrier.position;assert.ok(Math.hypot(...p.map((x,j)=>x-before[j]))<.12,'carrier jump in '+s.phase);if(p[2]>3.7)branch=true;before=p;loadIfWaiting(c,s);
  }
  assert.equal(c.snapshot().complete,true);assert.equal(branch,true);
});
test('output, vision and settling faults hold the relevant operation',()=>{
  for(const [fault,phase] of [['output','dispatch_grip'],['vision','vision'],['vibration','settle_assembly']]){
    const c=create();c.command('fault',{
      name:fault,enabled:true
    }
    );c.command('run',recipe);until(c,s=>s.phase===phase);for(let i=0;i<80;i++)c.tick(.05);assert.equal(c.snapshot().phase,phase);c.command('fault',{
      name:fault,enabled:false
    }
    );until(c,s=>s.complete);
  }
});
test('separate jobs retain products and reject depleted source IDs atomically',()=>{
  const c=create();c.command('run',recipe);until(c,s=>s.complete);assert.throws(()=>c.command('run',recipe));assert.equal(c.snapshot().finished.length,1);c.command('run',{
    body:'B1',cap:'C2',top:'T3',destination:'dispatch'
  }
  );until(c,s=>s.complete);assert.equal(c.snapshot().finished.length,2);assert.equal(c.snapshot().inventory.find(p=>p.id==='T3').quantity,0);
});
test('manual joints are selected, bounded and require recovery before Run',()=>{
  const c=create();assert.throws(()=>c.command('jog',{
    robot:'ur10',joint:0,delta:1
  }));c.command('mode','manual');c.command('drives',true);c.command('jog',{
    robot:'ur10',joint:0,delta:1
  }
  );assert.equal(c.snapshot().manualDirty,true);assert.throws(()=>c.command('run',recipe));assert.throws(()=>c.command('jog',{
    robot:'ur10',joint:0,delta:99
  }));c.command('recover');until(c,s=>!s.recovering);assert.equal(c.snapshot().manualDirty,false);c.command('run',recipe);assert.equal(c.snapshot().running,true);
});
test('Apply stores explicit selection without enabling drives or running',()=>{
  const c=create();c.command('apply',recipe);assert.deepEqual(c.snapshot().selection,recipe);assert.equal(c.snapshot().running,false);assert.equal(c.snapshot().drives,false);c.command('run',recipe);assert.throws(()=>c.command('apply',recipe));
});
test('manual recovery restores the exact paused automatic pose',()=>{
  const c=create();c.command('run',recipe);for(let i=0;i<8;i++)c.tick(.05);c.command('pause');const pose=c.snapshot().robots.map(r=>r.joints);c.command('mode','manual');c.command('jog',{
    robot:'fanuc',joint:0,delta:1
  }
  );c.command('recover');until(c,s=>!s.recovering);assert.deepEqual(c.snapshot().robots.map(r=>r.joints),pose);c.command('resume');until(c,s=>s.complete);
});
test('recovery without a new manual change never restores a stale pose',()=>{const c=create();c.command('run',recipe);for(let i=0;i<8;i++)c.tick(.05);c.command('pause');c.command('mode','manual');c.command('jog',{robot:'fanuc',joint:0,delta:1});c.command('recover');until(c,s=>!s.recovering);c.command('resume');for(let i=0;i<8;i++)c.tick(.05);c.command('pause');const pose=c.snapshot().robots.map(r=>r.joints);c.command('mode','manual');c.command('recover');until(c,s=>!s.recovering);assert.deepEqual(c.snapshot().robots.map(r=>r.joints),pose);});
test('stepping the final stage does not leak Step into the next Run',()=>{const c=create();c.command('run',recipe);until(c,s=>s.phase==='return_clear');c.command('pause');c.command('step');until(c,s=>s.complete);c.command('run',{...recipe,body:'B1',cap:'C2'});until(c,s=>s.phase==='tray_contact');assert.equal(c.snapshot().running,true);});
test('manual loading holds the shuttle and accepts only the selected workpiece once',()=>{
  const c=create();
  c.command('run',recipe);
  assert.throws(()=>c.command('load_workpiece','B2'));
  until(c,s=>s.awaitingLoad);
  const docked=c.snapshot();
  for(let i=0;i<120;i++)c.tick(.05);
  assert.deepEqual(c.snapshot().carrier,docked.carrier);
  assert.deepEqual(c.snapshot().inventory,docked.inventory);
  assert.throws(()=>c.command('resume'));
  assert.throws(()=>c.command('step'));
  assert.throws(()=>c.command('load_workpiece','B1'));
  c.command('stop');
  assert.throws(()=>c.command('load_workpiece','B2'));
  c.command('ack_stop');
  c.command('load_workpiece','B2');
  assert.equal(c.snapshot().product.body.location,'supply');
  for(let i=0;i<20;i++)c.tick(.05);
  const carrying=c.snapshot();
  assert.equal(carrying.product.body.location,'operator');
  assert.deepEqual(carrying.carrier,docked.carrier);
  c.command('stop');
  c.command('ack_stop');
  for(let i=0;i<20;i++)c.tick(.05);
  assert.equal(c.snapshot().loading.progress,carrying.loading.progress);
  assert.throws(()=>c.command('resume'));
  c.command('load_workpiece','B2');
  while(c.snapshot().loading)c.tick(.1);
  assert.equal(c.snapshot().product.body.location,'carrier');
  assert.equal(c.snapshot().running,false);
  assert.throws(()=>c.command('load_workpiece','B2'));
  c.command('resume');
  until(c,s=>s.complete);
  assert.equal(c.snapshot().inventory.find(p=>p.id==='B2').quantity,0);
});
test('four ordered recipes validate aggregate stock and each wait for manual loading',()=>{
  const c=create();
  const batch=Array.from({length:4},(_,i)=>({
    body:'B'+(i+1),cap:'C'+(i+1),top:'T'+(i+1),destination:'dispatch'
  }));
  assert.throws(()=>c.command('run',[batch[0],batch[0]]),/insufficient stock/);
  assert.equal(c.snapshot().product,null);
  c.command('run',batch);
  for(const recipe of batch){
    until(c,s=>s.awaitingLoad);
    assert.deepEqual(c.snapshot().selection,recipe);
    loadIfWaiting(c,c.snapshot());
  }
  until(c,s=>s.complete);
  assert.deepEqual(c.snapshot().finished.map(p=>p.sources),batch);
  assert.equal(c.snapshot().queue.length,0);
  assert.equal(c.snapshot().running,false);
});

test('docks align with transfer targets and jaw faces close on payload surfaces',async()=>{
  const {DOCK,ROUTES,atDistance,gripContacts}=await import('../public/model.mjs');
  const docks=[['setup','setup'],['assembly','assembly'],['vision','vision'],['return','load']];
  for(const [route,dock] of docks){
    const point=atDistance(ROUTES[route],ROUTES[route].length).position;
    assert.ok(Math.hypot(point[0]-DOCK[dock][0],point[2]-DOCK[dock][2])<1e-8);
  }
  for(const [id,kind,radius,depth] of [
    ['fanuc','tray',.265,0],['ur3e','cap',.135,-.0375],
    ['ur3e','top',.135,-.0275],['ur10','product',.16,-.092]
  ]){
    const open=gripContacts(id,kind,0),closed=gripContacts(id,kind,1);
    for(let i=0;i<closed.length;i++){
      const [x,y,z]=closed[i].inner;
      assert.ok(Math.abs(Math.hypot(x,z)-radius)<1e-8);
      assert.ok(Math.abs(y-depth)<1e-8);
      assert.ok(Math.hypot(open[i].inner[0],open[i].inner[2])>radius);
    }
  }
});
