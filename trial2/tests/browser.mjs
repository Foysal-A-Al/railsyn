// Optional browser smoke check. Uses an existing Chromium binary; installs nothing.
// Run in a network-disabled, read-only container with /tmp as bounded scratch.
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const chromePath=process.env.RAILSYN_TEST_CHROME||'/a0/tmp/playwright/chromium-1228/chrome-linux64/chrome';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const origin='http://127.0.0.1:8641',profile='/tmp/railsyn-browser';
await mkdir(profile,{recursive:true});
const fixture=spawn(process.execPath,['--input-type=module','-e',"import {createApp} from './trial2/server.mjs';import {PROGRAM} from './trial2/cell.mjs';const {server,cell}=createApp();server.listen(8641,'127.0.0.1');setInterval(()=>cell.tick(cell.loading ? .005 : PROGRAM[cell.index].id.endsWith('_lift') ? .008 : .1),5);"],{cwd:'/case',stdio:'ignore',env:{PATH:'/usr/bin:/bin',HOME:'/tmp',TMPDIR:'/tmp'}});
const chrome=spawn(chromePath,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-extensions','--no-first-run','--renderer-process-limit=1','--num-raster-threads=1','--disk-cache-size=1048576','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe'],env:{PATH:'/usr/bin:/bin',HOME:'/tmp',TMPDIR:'/tmp'}});
let stderrBytes=0;chrome.stderr.on('data',b=>{stderrBytes+=b.length;if(stderrBytes<8000)process.stderr.write(b);});
let ws,next=0;const pending=new Map(),errors=[],checks=[],images={};let heldHDR;
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},12000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});}
async function ev(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression,ms=20000){const end=Date.now()+ms;while(Date.now()<end){if(await ev(expression))return;await wait(100);}throw Error('Timeout: '+expression);}
async function click(selector){await ev(`document.querySelector(${JSON.stringify(selector)}).click()`);await wait(200);}
async function screenshot(name){const r=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});images[name]=r.data;console.log(JSON.stringify({checkpoint:name,images:{[name]:r.data}}));}
try{
 let port;for(let i=0;i<120;i++){try{port=Number((await readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0]);break;}catch{}await wait(100);}if(!port)throw Error('Chromium did not start.');
 const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(m.method==='Fetch.requestPaused')heldHDR=m.params.requestId;};
 await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1700,height:1150,deviceScaleFactor:1,mobile:false});
 await call('Fetch.enable',{patterns:[{urlPattern:'*/assets/*.hdr',requestStage:'Request'}]});
 await call('Page.navigate',{url:origin});await until('!!window.__trial2?.state');
 await click('[data-page=guide]');await click('[data-guide=hardware]');
 await until('document.querySelectorAll(".hardware-grid canvas").length===3');
 for(let i=0;i<100&&!heldHDR;i++)await wait(50);assert.ok(heldHDR);await call('Fetch.continueRequest',{requestId:heldHDR});await call('Fetch.disable');
 await until('Array.from(document.querySelectorAll(".hardware-grid canvas")).every(c=>c.getContext("2d").getImageData(0,0,c.width,c.height).data.some(x=>x>0))',10000);
 checks.push('tool canvases refresh when opened before assets finish');
 await click('[data-page=workbench]');await until('window.__trial2?.scene?.loaded',40000);
 assert.equal(await ev('document.querySelectorAll("#run").length'),1);assert.equal(await ev('document.getElementById("run").disabled'),true);
 assert.equal(await ev('window.__trial2.scene.robotAsset'),'cell-models.glb');
 assert.ok(await ev('window.__trial2.scene.visionMountMinZ')>2.8+.34,'Camera hardware must clear the shuttle width');
 const recipes=[
   {body:'B2',cap:'C1',top:'T3',destination:'dispatch'},
   {body:'B1',cap:'C2',top:'T1',destination:'dispatch'},
   {body:'B3',cap:'C3',top:'T2',destination:'dispatch'},
   {body:'B4',cap:'C4',top:'T4',destination:'dispatch'}
 ];
 for(const recipe of recipes){
   for(const id of [recipe.body,recipe.cap,recipe.top])await click('[data-pocket='+id+']');
   await click('#apply');
 }
 assert.equal(await ev('document.querySelectorAll("#recipe-queue li").length'),4);
 assert.equal(await ev('document.getElementById("run").disabled'),false);
 assert.equal(await ev('window.__trial2.state.running'),false);
 checks.push('explicit recipe queue without motion');await screenshot('trial2-workbench.png');
 await click('[data-page=guide]');await click('[data-guide=flow]');await click('#guide-preview');await wait(300);assert.equal(await ev('window.__trial2.state.running'),false);await screenshot('trial2-guide.png');await click('[data-guide=hardware]');assert.equal(await ev('document.querySelectorAll(".hardware-grid canvas").length'),3);await click('[data-guide=research]');assert.match(await ev('document.getElementById("guide-content").textContent'),/does not run an NSGA-II/);await click('[data-guide=controls]');
 assert.equal(await ev('document.querySelectorAll("#guide-content tbody tr").length'),8);
 await click('[data-guide=responses]');
 assert.match(await ev('document.getElementById("system-finished").textContent'),/0 \/ 4/);
 await click('[data-guide=research]');
 await click('#study-form button');
 await until('document.querySelectorAll("#study-results tbody tr").length===7');
 assert.equal(await ev('document.querySelectorAll(".study-chart circle").length'),7);
 assert.equal(await ev('window.__trial2.state.finished.length'),0);
 checks.push('guide, live responses and isolated seven-candidate study');
 await ev(`window.gripSamples={};setInterval(()=>{
   for(const grip of Object.values(window.__trial2.scene?.grips||{})){
     if(grip.holding&&grip.closure===1)window.gripSamples[grip.holding]=grip;
   }
 },35)`);
 await click('[data-page=workbench]');await click('#run');await until('window.__trial2.state.awaitingLoad');await click('#load-workpiece');
 await until('window.__trial2.state.loading?.progress > .49 && !!window.__trial2.scene.operatorHand');
 await click('#pause');
 await until('window.__trial2.state.loading?.paused');
 const carrying=await ev('window.__trial2.scene.loadingPart');
 assert.ok(carrying[1]>1.49);
 await wait(900);
 await screenshot('trial2-operator-loading.png');
 await click('#load-workpiece');
 await until('!window.__trial2.state.awaitingLoad');
 checks.push('operator carries the selected workpiece while the shuttle is docked');
 await click('#run');
 for(const recipe of recipes.slice(1)){
   await until('window.__trial2.state.awaitingLoad && window.__trial2.state.selection.body === '+JSON.stringify(recipe.body));
   await click('#load-workpiece');
   await until('!window.__trial2.state.awaitingLoad');
   await click('#run');
 }
 await until('window.__trial2.state.complete',25000);
 const s=await ev('window.__trial2.state');
 assert.deepEqual(s.finished.map(part=>part.sources),recipes);
 assert.equal(s.running,false);
 await until('window.__trial2.scene.finishedIds.length===4');
 assert.equal(await ev('document.getElementById("run").disabled'),true);
 const grips=await ev('window.gripSamples');
 for(const [kind,radius,depth,count] of [
   ['tray',.265,0,2],['cap',.135,-.0375,2],['top',.135,-.0275,2],['product',.16,-.092,3]
 ]){
   assert.ok(grips[kind],'Missing rendered closed grip for '+kind);
   assert.equal(grips[kind].pads.length,count);
   for(const [x,y,z] of grips[kind].pads){
     const [cx,cy,cz]=grips[kind].tcp;
     assert.ok(Math.abs(Math.hypot(x-cx,z-cz)-radius)<.001,kind+' pad radius');
     assert.ok(Math.abs(y-cy-depth)<.001,kind+' pad height');
   }
 }
 checks.push('rendered jaw faces contact tray, cap, cover and assembled cup');
 checks.push('all four recipes loaded separately and dispatched in order');
 await click('#manual');await until('window.__trial2.state.controlMode==="manual"');await click('[data-jog]');await until('window.__trial2.state.manualDirty');await click('#recover');await until('!window.__trial2.state.recovering&&!window.__trial2.state.manualDirty');await click('#stop');await until('window.__trial2.state.stopped');await click('#ack');await until('!window.__trial2.state.stopped');assert.equal(await ev('window.__trial2.state.running'),false);checks.push('manual recovery and latched stop acknowledgement');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await wait(400);assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth+1'),true);checks.push('mobile without horizontal overflow');assert.equal(await ev('window.__trial2.scene.robotCount'),3);assert.equal(await ev('window.__trial2.scene.humans'),1);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,checks,errors}));
}catch(e){console.log(JSON.stringify({passed:false,error:e.message,errors}));process.exitCode=1;}
finally{if(ws?.readyState===1){await call('Browser.close').catch(()=>{});ws.close();}chrome.kill();fixture.kill();}
