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
  const session=await(await fetch(origin+'/api/session')).json();const cmd=async(action,value)=>{const r=await fetch(origin+'/api/command',{method:'POST',headers:{'Content-Type':'application/json','X-RailSyn-Token':session.token},body:JSON.stringify({action,value})});assert.equal(r.status,200,await r.text());};const snapshot=async()=>await(await fetch(origin+'/api/state')).json();
  await cmd('recipe',{body:'B1',cap:'C9',top:'T5',count:1,destination:'collect'});await cmd('mode','manual');await cmd('stop');await call('Page.navigate',{url:origin+'/?v=0.4.1'});for(let i=0;i<160;i++){if(await evaluate('!!window.__railSyn3D?.loaded'))break;await wait(250);}await wait(350);assert.equal(await evaluate('document.getElementById("clear-stop").hidden'),false);assert.match(await evaluate('document.getElementById("recipe-message").textContent'),/stop is latched/i);await screenshot('v041-stop-explained.png');
  await evaluate('document.getElementById("clear-stop").click()');await wait(350);let s=await snapshot();assert.equal(s.stopped,false);assert.equal(s.running,false);assert.equal(s.servo,false);assert.equal(s.recipe.cap,'C9');assert.equal(await evaluate('document.getElementById("start").disabled'),false);
  await evaluate('document.getElementById("start").click()');await wait(700);s=await snapshot();assert.equal(s.running,true);assert.equal(s.servo,true);assert.equal(s.controlMode,'auto');assert.equal(s.recipe.top,'T5');await screenshot('v041-selected-recipe-running.png');assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:['visible latched-stop explanation','explicit stop acknowledgement','recipe preserved','acknowledgement does not start motion','right Run starts selected recipe from Manual/drives off','Auto and drives enabled','no page exceptions'],recipe:s.recipe}));
}finally{
  if(ws?.readyState===1){await call('Browser.close').catch(()=>{});ws.close();}
  chrome.kill();await wait(500);await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
