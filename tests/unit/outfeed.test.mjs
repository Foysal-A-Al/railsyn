import test from 'node:test';import assert from 'node:assert/strict';import {Cell} from '../../src/simulation.mjs';import {chosenCell} from '../helpers.mjs';
function run(){const c=chosenCell();c.command('servo',true);c.command('start');return c;}
function until(c,p,limit=30000){for(let i=0;i<limit;i++){c.tick(.05);if(p(c.snapshot()))return;}throw Error('Not reached: '+c.phase);}
test('finished assemblies are unloaded into a persistent buffer before the empty carrier returns',()=>{
 const c=run();until(c,s=>s.phase==='unload_push');const start=c.snapshot();assert.ok(start.rail.position[1]>1.3);for(let i=0;i<15;i++)c.tick();const mid=c.snapshot();assert.equal(mid.product.body.location,'outfeed');assert.ok(mid.outfeed.currentPosition[2]>2.2);assert.equal(mid.completed,0);
 until(c,s=>s.phase==='return_right');const s=c.snapshot();assert.equal(s.rail.loaded,false);assert.equal(s.finished.length,1);assert.equal(s.finished[0].body.location,'buffer');assert.ok(s.outfeed.buffer[0].position[2]>3);
 until(c,s=>s.batchDone);assert.ok(Math.abs(c.snapshot().rail.position[0]+4.5)<.001);assert.ok(Math.abs(c.snapshot().rail.position[2]-2.2)<.001);assert.equal(c.snapshot().finished.length,1);
});
test('carrier follows a continuous rectangular return path instead of teleporting',()=>{
 const c=run();let previous=c.snapshot().rail.position,visitedBack=false,visitedRight=false,returned=false;
 for(let i=0;i<10000&&!returned;i++){c.tick(.05);const s=c.snapshot(),p=s.rail.position;assert.ok(Math.hypot(...p.map((v,k)=>v-previous[k]))<.25,'carrier jumped');if(p[2]<-2.1)visitedBack=true;if(p[0]>5.8)visitedRight=true;if(s.batchDone&&s.completed===1)returned=true;previous=p;}
 assert.ok(visitedBack&&visitedRight&&returned);
});
test('output blockage prevents unloading and keeps the assembly on its carrier',()=>{
 const c=run();c.command('fault','outfeed');until(c,s=>s.phase==='output_lift');for(let i=0;i<100;i++)c.tick();const held=c.snapshot();assert.equal(held.product.body.location,'carrier');assert.equal(held.completed,0);assert.match(held.reason,/outfeed|output/i);c.command('fault','outfeed');until(c,s=>s.completed===1);
});
test('four separately selected jobs remain in distinct collection positions',()=>{
 const c=run();for(let i=0;i<4;i++){if(i){c.command('recipe',{body:'B'+(i+1),cap:'C'+(i+1),top:'T'+(i+1),count:1,destination:'collect'});c.command('start');}until(c,s=>s.batchDone===true);}const s=c.snapshot();assert.equal(s.completed,4);assert.equal(s.outfeed.buffer.length,4);assert.equal(new Set(s.outfeed.buffer.map(p=>p.id)).size,4);assert.equal(new Set(s.outfeed.buffer.map(p=>p.position[2])).size,4);assert.ok(s.finished.every(p=>p.inspected&&p.body.location==='buffer'));assert.equal(s.rail.loaded,false);assert.ok(Math.abs(s.rail.position[0]+4.5)<.001);assert.equal(s.running,false);
});
test('pause on final return is resumable even after the target count is reached',()=>{
 const c=run();until(c,s=>s.completed===1&&s.phase==='return_right');c.command('pause');assert.doesNotThrow(()=>c.command('start'));until(c,s=>s.batchDone===true);
});
