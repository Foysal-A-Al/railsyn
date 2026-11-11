import test from 'node:test';
import assert from 'node:assert/strict';

test('isolated study completes seven identical batches and applies target and power assumptions',async()=>{
  let reply;
  globalThis.self={postMessage:value=>{reply=value;}};
  try{
    await import('../public/study-worker.mjs');
    const run=data=>{self.onmessage({data});return reply;};
    const scenario={jobs:2,delay:4,target:30,idleWatts:100,motionWatts:300};
    const result=run(scenario);
    assert.equal(result.rows.length,7);
    for(const row of result.rows){
      assert.equal(row.parts,2);
      assert.ok(Math.abs(row.times.waiting-8)<.06);
      assert.ok(row.energy>0);
      assert.ok(Math.abs(Object.values(row.times).reduce((sum,n)=>sum+n,0)-row.seconds)<.001);
    }
    assert.ok(result.rows[6].rate>result.rows[0].rate);
    const feasible=result.rows.filter(row=>row.rate>=scenario.target);
    assert.ok(feasible.length>0);
    assert.equal(result.selected.energy,Math.min(...feasible.map(row=>row.energy)));
    assert.match(run({...scenario,motionWatts:null}).error,/both power/);
  }finally{delete globalThis.self;}
});
