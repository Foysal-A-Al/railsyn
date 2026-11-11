import http from 'node:http';
import {
  pathToFileURL
} from 'node:url';
import {
  resolve
} from 'node:path';
import {
  readFile
} from 'node:fs/promises';
import {
  randomBytes,timingSafeEqual
} from 'node:crypto';
import {
  Cell
} from './cell.mjs';
export function createApp({
  port=8641
}
={
}
){
  const cell=new Cell(),token=randomBytes(32).toString('hex'),authority=`127.0.0.1:${port}`;
  const routes=new Map([['/','index.html'],...['index.html','style.css','app.js','scene.mjs','guide.mjs','model.mjs','kinematics.mjs','cell-core.mjs','engineering.mjs','study-worker.mjs'].map(x=>['/'+x,x])]);
  const types={
    html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',hdr:'image/vnd.radiance'
  };
  function send(res,status,data,type='application/json'){
    res.writeHead(status,{
      'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    });
    res.end(Buffer.isBuffer(data)||typeof data==='string'?data:JSON.stringify(data));
  }
  const server=http.createServer(async(req,res)=>{
    if(req.headers.host!==authority||req.headers.origin&&req.headers.origin!==`http://${authority}`||['cross-site','same-site'].includes(req.headers['sec-fetch-site']))return send(res,403,{
      error:'Origin or host denied.'
    });
    const path=req.url?.split('?')[0];
    try{
      if(req.method==='GET'&&path==='/api/session')return send(res,200,{
        token
      });
      if(req.method==='GET'&&['/api/state','/api/export','/api/health'].includes(path))return send(res,200,cell.snapshot());
      if(req.method==='POST'&&path==='/api/command'){
        const given=Buffer.from(req.headers['x-railsyn-token']||''),expected=Buffer.from(token);if(given.length!==expected.length||!timingSafeEqual(given,expected))return send(res,401,{
          error:'Session token required.'
        });
        if(req.headers['content-type']!=='application/json')return send(res,415,{
          error:'JSON required.'
        }
        );let body='',bytes=0;for await(const chunk of req){
          bytes+=chunk.length;if(bytes>4096){
            send(res,413,{
              error:'Packet exceeds 4096 bytes.'
            }
            );req.destroy();return;
          }
          body+=chunk;
        }
        const d=JSON.parse(body);if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(k=>!['action','value'].includes(k)))throw Error('Invalid command fields.');cell.command(d.action,d.value);return send(res,200,{
          ok:true
        });
      }
      if(req.method==='POST'&&path==='/api/hardware-command')return send(res,403,{
        error:'Physical output disabled.'
      });
      if(req.method==='GET'&&routes.has(path)){
        const file=routes.get(path);return send(res,200,await readFile(new URL('./public/'+file,import.meta.url)),types[file.split('.').pop()]);
      }
      const shared=['three.module.js','three.core.js','RoomEnvironment.js','HDRLoader.js','GLTFLoader.js','BufferGeometryUtils.js'];if(req.method==='GET'&&shared.some(n=>path==='/vendor/'+n))return send(res,200,await readFile(new URL('../public'+path,import.meta.url)),types.js);
      if(req.method==='GET'&&path==='/assets/cell-models.glb')return send(res,200,await readFile(new URL('../public'+path,import.meta.url)),'model/gltf-binary');
      if(req.method==='GET'&&path==='/assets/studio_small_09_1k.hdr')return send(res,200,await readFile(new URL('../public'+path,import.meta.url)),types.hdr);
      send(res,404,{
        error:'Not found.'
      });
    }
    catch(e){
      send(res,400,{
        error:e.message
      });
    }
  });
  return {
    server,cell
  };
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const {
    server,cell
  }
  =createApp();
  const timer=setInterval(()=>cell.tick(.05),50);
  server.listen(8641,process.env.RAILSYN_BIND_HOST==='0.0.0.0'?'0.0.0.0':'127.0.0.1',()=>console.log('RailSyn Trial 2: http://127.0.0.1:8641 · Simulation only'));
  server.on('error',e=>{
    clearInterval(timer);console.error(e.message);process.exitCode=1;
  });
  for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{
    clearInterval(timer);server.close();
  });
}
