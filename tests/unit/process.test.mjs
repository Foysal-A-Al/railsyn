import test from 'node:test';
import assert from 'node:assert/strict';
import {Cell} from '../../src/simulation.mjs';
import {chosenCell} from '../helpers.mjs';
function run(c=chosenCell()){if(!c.snapshot().selectionConfirmed)c.command('recipe',{body:'B1',cap:'C1',top:'T1',count:1,destination:'collect'});c.command('servo',true);c.command('start');return c;}
function until(c,p,limit=30000){for(let i=0;i<limit;i++){c.tick(.05);if(p(c.snapshot()))return;}throw Error('Condition not reached '+c.phase);}
test('three different robots complete body transfer, lower cap and upper cap jobs in order',()=>{
 const c=run(),seen=new Set();until(c,s=>{assert.equal(s.robots.length,3);assert.equal(new Set(s.robots.map(r=>r.job)).size,3);if(['loader','capper','closer'].includes(s.activeRobot))seen.add(s.activeRobot);if(s.product.top.location==='assembled')assert.equal(s.product.cap.location,'assembled');if(s.product.cap.location==='assembled')assert.ok(['carrier','outfeed','buffer'].includes(s.product.body.location));return s.completed===s.target;});
 assert.deepEqual([...seen].sort(),['capper','closer','loader']);assert.equal(c.snapshot().product.top.location,'assembled');assert.equal(c.snapshot().hardwareOutput,false);
});
test('grip fault keeps the workpiece on its support and blocks lifting',()=>{
 const c=new Cell();c.command('fault','grip');run(c);until(c,s=>s.phase==='a_grip');for(let i=0;i<100;i++)c.tick();assert.equal(c.phase,'a_grip');assert.equal(c.snapshot().product.body.location,'supply');
 c.command('fault','grip');until(c,s=>s.phase==='a_lift');assert.equal(c.snapshot().product.body.location,'tool-loader');
});
test('carrier indexes between physically separated stations, with no robot gripping during transport',()=>{
 const c=run();until(c,s=>s.phase==='index_b');const x=c.snapshot().rail.position[0];for(let i=0;i<20;i++)c.tick();assert.ok(c.snapshot().rail.position[0]>x);assert.ok(c.snapshot().robots.every(r=>!r.gripper.attached));
 until(c,s=>s.phase==='b_approach');assert.ok(Math.abs(c.snapshot().rail.position[0])<.001);
});
test('capper and closer tools confirm grip and attach separate tracked parts',()=>{
 const c=run();until(c,s=>s.phase==='b_lift');assert.equal(c.snapshot().product.cap.location,'tool-capper');assert.equal(c.snapshot().robots[1].gripper.attached,true);
 until(c,s=>s.phase==='c_lift');assert.equal(c.snapshot().product.top.location,'tool-closer');assert.equal(c.snapshot().product.cap.location,'assembled');
});
test('manual jog selects one robot and requires enabled drives and manual mode',()=>{
 const c=new Cell();assert.throws(()=>c.command('jog',{robot:'capper',joint:0,delta:5}));c.command('mode','manual');c.command('servo',true);const q=c.snapshot().robots.map(r=>r.joints[0]);c.command('jog',{robot:'capper',joint:0,delta:5});const after=c.snapshot().robots.map(r=>r.joints[0]);assert.equal(after[0],q[0]);assert.ok(Math.abs(after[1]-q[1]-5)<1e-6);assert.equal(after[2],q[2]);assert.throws(()=>c.command('mode','auto'),/reset|recover/i);
});
test('single stage stepping and latched simulation stop work',()=>{
 const c=chosenCell();c.command('servo',true);c.command('step');const first=c.phase;until(c,s=>!s.running);assert.notEqual(c.phase,first);c.command('stop');assert.throws(()=>c.command('servo',true));c.command('reset');assert.equal(c.snapshot().stopped,false);
});
test('heartbeat dropout freezes all joints and carrier position',()=>{
 const c=run();until(c,s=>s.phase==='b_transfer');c.command('fault','dropout');const before=c.snapshot();for(let i=0;i<100;i++)c.tick();const after=c.snapshot();assert.deepEqual(after.robots.map(r=>r.joints),before.robots.map(r=>r.joints));assert.deepEqual(after.rail.position,before.rail.position);
});
test('inspection failure blocks unloading and preserves the completed assembly',()=>{
 const c=new Cell();c.command('fault','inspection');run(c);until(c,s=>s.phase==='inspect');for(let i=0;i<100;i++)c.tick();assert.equal(c.phase,'inspect');assert.equal(c.completed,0);assert.equal(c.snapshot().product.top.location,'assembled');c.command('fault','inspection');until(c,s=>s.completed===1);
});
test('read-only bridge rejects replay, stale timestamps and command injection',()=>{
 const c=new Cell(),now=Date.now(),p={device:'external-sensor-1',sequence:1,timestamp:now,acceleration:[0,0,0],partPresent:true,gripConfirmed:true};c.ingest(p,now);assert.throws(()=>c.ingest(p,now));assert.throws(()=>c.ingest({...p,sequence:2,timestamp:now-2000},now));assert.throws(()=>c.ingest({...p,sequence:2,command:'move'},now));
});
