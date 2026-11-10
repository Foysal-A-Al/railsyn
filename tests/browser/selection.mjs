// Optional Windows UI check using a separate headless Chrome profile.
// Run with the RailSyn server already listening. No npm install required.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:8630';
const temp=resolve('.qa');await mkdir(temp,{recursive:true});
const profile=resolve(temp,'chrome-'+Date.now());
const chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--use-angle=swiftshader','--enable-unsafe-swiftshader',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let ws;let next=0;const pending=new Map();const errors=[];
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function screenshot(name){const r=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(temp,name),Buffer.from(r.data,'base64'));}
try{
  let port;
  for(let i=0;i<80;i++){try{port=Number((await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{}await wait(250);}
  if(!port)throw Error('Headless Chrome did not initialize.');
  const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const task=pending.get(m.id);pending.delete(m.id);m.error?task.reject(Error(m.error.message)):task.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);};
  await call('Runtime.enable');await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1600,height:1150,deviceScaleFactor:1,mobile:false});
  const session=await(await fetch(origin+'/api/session')).json();const cmd=async(action,value)=>{const r=await fetch(origin+'/api/command',{method:'POST',headers:{'Content-Type':'application/json','X-RailSyn-Token':session.token},body:JSON.stringify({action,value})});assert.equal(r.status,200,await r.text());};const snapshot=async()=>await(await fetch(origin+'/api/state')).json();const until=async(fn,timeout=60000)=>{const end=Date.now()+timeout;while(Date.now()<end){const s=await snapshot();if(fn(s))return s;await wait(100);}throw Error('Timeout '+JSON.stringify(await snapshot()));};
  await cmd('reset');await call('Page.navigate',{url:origin+'/?v=0.5.0'});for(let i=0;i<160;i++){if(await evaluate('!!window.__railSyn3D?.loaded'))break;await wait(250);}await wait(400);assert.equal(await evaluate('document.getElementById("run-recipe").disabled'),true);assert.equal(await evaluate('document.querySelectorAll("#auto-match,#recipe-count,#pause-loader").length'),0);assert.equal((await snapshot()).running,false);
  for(const id of ['B2','C1','T3']){await evaluate('document.querySelector("[data-pocket='+id+']").click()');await wait(100);}await wait(300);assert.equal(await evaluate('document.getElementById("run-recipe").disabled'),false);assert.doesNotMatch(await evaluate('document.getElementById("recipe-message").textContent'),/incompatible|must match/i);await screenshot('v05-mixed-selection.png');
  await evaluate('document.getElementById("apply-recipe").click()');await wait(300);assert.equal((await snapshot()).running,false);await evaluate('document.getElementById("start").click()');await cmd('speed',1.5);await until(s=>s.batchDone);await wait(500);const before=await snapshot();assert.equal(before.completed,1);assert.equal(before.finished[0].body.source,'B2');assert.equal(before.finished[0].cap.source,'C1');assert.equal(before.finished[0].top.source,'T3');assert.equal(before.selectionConfirmed,false);await wait(2500);const after=await snapshot();assert.equal(after.running,false);assert.equal(after.completed,1);assert.deepEqual(after.inventory,before.inventory);assert.equal(await evaluate('document.getElementById("run-recipe").disabled'),true);assert.equal(await evaluate('window.__railSyn3D.selectedRecipe.body'),'');await evaluate('document.querySelector("[data-view=outfeed]").click()');await wait(900);await screenshot('v05-waiting-next-selection.png');assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:['all three parts must be explicitly selected','no auto-match or batch controls','mixed-family selection accepted','apply does not start','Run starts one selected assembly','chosen sources retained','one job completes','no next part chosen','no automatic second job','next Run waits for new selection','no page exceptions'],finished:after.finished.map(p=>({id:p.id,body:p.body.source,cap:p.cap.source,top:p.top.source}))}));
}finally{
  if(ws?.readyState===1){await call('Browser.close').catch(()=>{});ws.close();}
  chrome.kill();await wait(500);await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
