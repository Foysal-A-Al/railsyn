import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes, timingSafeEqual} from 'node:crypto';
import {execFile} from 'node:child_process';
import {Cell} from './simulation.mjs';
const port=8630, host='127.0.0.1', origin=`http://${host}:${port}`;
const root=new URL('../public/',import.meta.url);
const token=randomBytes(32).toString('hex');
const cell=new Cell();
const files=new Map([['/','index.html'],['/style.css','style.css'],['/app.js','app.js'],['/vendor/three.module.js','vendor/three.module.js'],['/vendor/three.core.js','vendor/three.core.js']]);
for(const name of ['kinematics.mjs','rail.mjs','catalog.mjs','assets/studio_small_09_1k.hdr','vendor/HDRLoader.js','assets/cell-models.glb','vendor/GLTFLoader.js','vendor/BufferGeometryUtils.js','vendor/RoomEnvironment.js'])files.set('/'+name,name);
const mime={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',glb:'model/gltf-binary',hdr:'image/vnd.radiance'};
function send(res,status,data,type='application/json') {
  res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"});
  res.end(typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data));
}
function authorized(req) {
  const provided=Buffer.from(req.headers['x-railsyn-token']||'');const expected=Buffer.from(token);
  return provided.length===expected.length&&timingSafeEqual(provided,expected);
}
const server=http.createServer(async(req,res)=>{
  if(req.headers.host!==`${host}:${port}`)return send(res,403,{error:'Unexpected host.'});
  if((req.headers.origin&&req.headers.origin!==origin)||['cross-site','same-site'].includes(req.headers['sec-fetch-site']))return send(res,403,{error:'Origin denied.'});
  const path=req.url?.split('?')[0];
  try {
    if(req.method==='GET'&&path==='/api/session')return send(res,200,{token});
    if(req.method==='GET'&&path==='/api/state')return send(res,200,cell.snapshot());
    if(req.method==='GET'&&path==='/api/export')return send(res,200,{provenance:'estimated three-station process; signals synthetic unless source is external',...cell.snapshot()});
    if(req.method==='POST'&&['/api/command','/api/ingest','/api/hardware-command'].includes(path)){
      if(!authorized(req))return send(res,401,{error:'Session token required.'});
      if(path==='/api/hardware-command')return send(res,403,{error:'Hardware output is not implemented. No physical robot can be moved by this prototype.'});
      if(req.headers['content-type']!=='application/json')return send(res,415,{error:'JSON required.'});
      let body='';
      for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096){send(res,413,{error:'Packet too large.'});req.destroy();return;}}
      const data=JSON.parse(body);
      if(path==='/api/ingest')cell.ingest(data);
      else {
        if(!data||typeof data!=='object'||Object.keys(data).some(k=>!['action','value'].includes(k)))throw Error('Unexpected command fields.');
        cell.command(data.action,data.value);
      }
      return send(res,200,{ok:true});
    }
    if(req.method==='GET'&&files.has(path)){
      const file=files.get(path);return send(res,200,await readFile(new URL(file,root)),mime[file.split('.').pop()]);
    }
    send(res,404,{error:'Not found.'});
  }catch(error){send(res,400,{error:error.message});}
});
// Fixed ticks keep the synthetic accelerometer at 200 Hz. UI speed changes stage timing only.
const timer=setInterval(()=>cell.tick(.05),50);
server.listen(port,host,()=>{
  console.log(`RailSyn ready: ${origin}\nMode: simulation. Physical command output disabled.`);
  if(process.argv.includes('--open')&&process.platform==='win32')execFile('explorer.exe',[origin],()=>{});
});
server.on('error',error=>{clearInterval(timer);console.error(error.message);process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(timer);server.close();});
