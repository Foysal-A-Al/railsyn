import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createApp
} from '../server.mjs';
import http from 'node:http';
test('HTTP commands require local origin, token and strict JSON; static files are allowlisted',async()=>{
  const {
    server
  }
  =createApp();await new Promise(r=>server.listen(8641,'127.0.0.1',r));
  const request=(path,options={
  }
  )=>new Promise((resolve,reject)=>{
    const req=http.request({
      host:'127.0.0.1',port:8641,path,...options
    },res=>{
      let body='';res.on('data',x=>body+=x);res.on('end',()=>resolve({
        status:res.statusCode,headers:res.headers,body
      }));
    }
    );req.on('error',reject);req.end(options.body);
  });
  try{
    const rig=await request('/assets/cell-models.glb');
    assert.equal(rig.status,200);
    assert.equal(rig.headers['content-type'],'model/gltf-binary');
    assert.equal(rig.body.slice(0,4),'glTF');
    assert.equal((await request('/vendor/GLTFLoader.js')).status,200);
    const session=JSON.parse((await request('/api/session')).body),headers={
      'content-type':'application/json','x-railsyn-token':session.token
    };
    assert.equal((await request('/api/command',{
      method:'POST',body:'{}'
    }
    )).status,401);
    assert.equal((await request('/api/command',{
      method:'POST',headers:{
        ...headers,origin:'https://outside.example'
      },body:'{}'
    }
    )).status,403);
    assert.equal((await request('/api/command',{
      method:'POST',headers,body:'{'
    }
    )).status,400);
    assert.equal((await request('/api/command',{
      method:'POST',headers,body:JSON.stringify({
        action:'run',value:{
        }
      })
    }
    )).status,400);
    assert.equal((await request('/api/hardware-command',{
      method:'POST'
    }
    )).status,403);
    for(const path of ['/server.mjs','/cell.mjs','/.env','/../package.json'])assert.equal((await request(path)).status,404);
    for(const path of ['/','/style.css','/app.js','/scene.mjs','/guide.mjs','/model.mjs','/kinematics.mjs','/vendor/three.module.js','/vendor/three.core.js','/vendor/RoomEnvironment.js','/vendor/HDRLoader.js','/assets/studio_small_09_1k.hdr']){
      const r=await request(path);assert.equal(r.status,200,path);assert.ok(r.body.length>0,path);assert.equal(r.headers['x-content-type-options'],'nosniff');
    }
    const health=JSON.parse((await request('/api/health')).body);assert.equal(health.trial,2);assert.equal(health.running,false);assert.equal(health.hardwareOutput,false);
    assert.equal((await request('/api/command',{
      method:'POST',headers,body:JSON.stringify({
        action:'apply',value:{
          body:'B1',cap:'C2',top:'T3',destination:'dispatch'
        }
      })
    }
    )).status,200);
    assert.equal(JSON.parse((await request('/api/state')).body).running,false);
  }
  finally{
    await new Promise(r=>server.close(r));
  }
});
