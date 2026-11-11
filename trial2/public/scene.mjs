import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {
  RoomEnvironment
} from './vendor/RoomEnvironment.js';
import {
  HDRLoader
} from './vendor/HDRLoader.js';
import {
  ROBOTS,MAIN,BRANCH,DOCK,TRAY_SOURCE,TRAY_YAW,BODY_ON_TRAY,CAP_HEIGHT,TOP_HEIGHT,PALLET_SEAT,gripContacts,outputPoint,createInventory,forward,lerp,smooth
} from './model.mjs';
const V=p=>new THREE.Vector3(...p),M={
};
let scene,renderer,camera,container,state,carrier,tray,body,cap,top,inspectionLight,inspectionBeam,inspectionBounds,operator,rigAsset,ready=false;
let selectedPocket=null,selectedRobot='ur3e',pickHandler=()=>{
};
const robotModels={
},inventoryMeshes=new Map(),finishedMeshes=new Map(),worldLabels=[];
let focus=new THREE.Vector3(.4,1,.5),targetFocus=focus.clone(),distance=21,targetDistance=21,azimuth=.22,targetAz=.22,elevation=.78,targetEl=.78;
const thumbs={
};
function material(id,color,metal=.1,roughness=.45){
  return M[id]=new THREE.MeshStandardMaterial({
    color,metalness:metal,roughness
  });
}
function box(w,h,d,id,x=0,y=0,z=0,parent=scene){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M[id]||id);
  m.position.set(x,y,z);
  m.castShadow=m.receiveShadow=true;
  parent.add(m);
  return m;
}
function cyl(r,h,id,x=0,y=0,z=0,parent=scene,r2=r){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r2,r,h,32),M[id]||id);
  m.position.set(x,y,z);
  m.castShadow=m.receiveShadow=true;
  parent.add(m);
  return m;
}
function segment(a,b,r,id,parent=scene){
  const m=cyl(r,1,id,0,0,0,parent);
  setSegment(m,a,b);
  return m;
}
function setSegment(m,a,b){
  const av=V(a),bv=V(b),d=bv.clone().sub(av);
  m.position.copy(av.add(bv).multiplyScalar(.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());
  m.scale.y=d.length();
}
function label(text,p,size=1.5){
  const c=document.createElement('canvas');
  c.width=640;
  c.height=100;
  const x=c.getContext('2d');
  x.fillStyle='#ffffffed';
  x.beginPath();
  x.roundRect(1,1,638,98,20);
  x.fill();
  x.fillStyle='#203a52';
  x.font='600 34px Segoe UI,Arial';
  x.textAlign='center';
  x.textBaseline='middle';
  x.fillText(text,320,50);
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({
    map:t,depthTest:true,toneMapped:false
  }));
  s.position.copy(V(p));
  s.scale.set(size,size/6.4,1);
  scene.add(s);
  worldLabels.push(s);
  return s;
}
function bolt(x,y,z,parent=scene){
  const b=cyl(.014,.012,'dark',x,y,z,parent);
  return b;
}
function table(x,z,w,d,h=1.27){
  box(w,.09,d,'steel',x,h-.045,z);
  for(const a of [-1,1])for(const b of [-1,1]){
    box(.075,h-.08,.075,'steel',x+a*(w/2-.07),(h-.08)/2,z+b*(d/2-.07));
    box(.11,.03,.11,'dark',x+a*(w/2-.07),.02,z+b*(d/2-.07));
  }
  box(w,.06,.05,'slot',x,.24,z-d/2+.07);
}
function part(kind,color='#8c9aa4',parent=scene){
  const g=new THREE.Group();
  parent.add(g);
  const mat=new THREE.MeshPhysicalMaterial({
    color,metalness:color==='#263540'?.3:.78,roughness:.28,clearcoat:.15
  });
  if(kind==='body'){
    const points=[[.12,-.18],[.15,-.18],[.16,-.16],[.16,-.01],[.155,0],[.126,0],[.12,-.01],[.12,-.15],[0,-.15],[0,-.18]].map(p=>new THREE.Vector2(...p));
    const m=new THREE.Mesh(new THREE.LatheGeometry(points,48),mat);
    m.castShadow=m.receiveShadow=true;
    g.add(m);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2;
      bolt(Math.cos(a)*.14,.002,Math.sin(a)*.14,g);
    }
  }
  else {
    const h=kind==='top'?.055:.075;
    const points=[[0,-h],[.115,-h],[.135,-h+.01],[.135,-.008],[.126,0],[0,0]].map(p=>new THREE.Vector2(...p));
    const m=new THREE.Mesh(new THREE.LatheGeometry(points,48),mat);
    m.castShadow=m.receiveShadow=true;
    g.add(m);
    if(kind==='top')for(let i=0;i<4;i++){
      const a=i*Math.PI/2;
      bolt(Math.cos(a)*.09,.002,Math.sin(a)*.09,g);
    }
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.132,.003,6,48),M.dark);
    ring.rotation.x=Math.PI/2;
    ring.position.y=-h+.008;
    g.add(ring);
  }
  return g;
}
function trayModel(parent=scene){
  const g=new THREE.Group();
  parent.add(g);
  box(.68,.045,.53,'dark',0,0,0,g);
  box(.62,.025,.47,'ivory',0,.035,0,g);
  for(const x of [-.24,.24])for(const z of [-.17,.17])cyl(.025,.045,'dark',x,.066,z,g);
  const nest=new THREE.Mesh(new THREE.RingGeometry(.118,.15,48),M.steel);
  nest.rotation.x=-Math.PI/2;
  nest.position.y=.054;
  g.add(nest);
  return g;
}
function carrierModel(parent=scene){
  const g=new THREE.Group();
  parent.add(g);
  box(.69,.16,.46,'dark',0,-.02,0,g);
  box(.61,.025,.49,'steel',0,.073,0,g);
  box(.46,.052,.48,'steel',0,PALLET_SEAT-1.15-.026,0,g);
  for(const x of [-.23,.23])for(const z of [-.24,.24]){
    const w=cyl(.063,.04,'rubber',x,-.05,z,g);
    w.rotation.x=Math.PI/2;
  }
  box(.25,.045,.015,'led',0,.005,.238,g);
  return g;
}
function gripper(id,parent){
  const g=new THREE.Group();
  parent.add(g);
  const tray=id==='fanuc';
  const cup=id==='ur10';
  box(tray?.30:.245,.145,.19,tray?'steel':cup?'dark':'white',0,.257,0,g);
  cyl(.089,.036,'steel',0,.348,0,g);
  if(tray)box(.61,.048,.10,'dark',0,.191,0,g);
  g.userData.fingers=Array.from({length:cup?3:2},()=>{
    const jaw=new THREE.Group();
    g.add(jaw);
    const width=tray?.060:cup?.050:.035;
    const height=tray?.038:cup?.065:.039;
    box(.024,height,width,'rubber',0,0,0,jaw);
    box(.018,height+.02,width,'steel',.021,.012,0,jaw);
    const link=box(.030,1,width*.75,'dark',0,0,0,g);
    const pin=cyl(.016,width+.005,'steel',0,0,0,jaw);
    pin.rotation.x=Math.PI/2;
    pin.position.set(.021,.034,0);
    return {jaw,link};
  });
  g.userData.kind=id;
  poseGripper(g,id,'cap',0,1);
  return g;
}

function poseGripper(g,id,kind,closure,scale){
  const contacts=gripContacts(id,kind,closure);
  contacts.forEach(({angle,inner},i)=>{
    const {jaw,link}=g.userData.fingers[i];
    const x=Math.cos(angle),z=Math.sin(angle);
    const pad=inner.map(v=>v/scale);
    jaw.position.set(pad[0]+x*.012,pad[1],pad[2]+z*.012);
    jaw.rotation.y=-angle;
    const rail=id==='fanuc'?.268:.101;
    setSegment(link,[x*rail,.211,z*rail],
      [jaw.position.x+x*.021,jaw.position.y+.034,jaw.position.z+z*.021]);
  });
}

function graphic(width,height,paint){
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  paint(canvas.getContext('2d'));
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;
  map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  return new THREE.MeshBasicMaterial({map});
}

function armMark(link,name){
  const face=graphic(768,176,ctx=>{
    ctx.fillStyle='#f5f8fa';
    ctx.fillRect(0,0,768,176);
    ctx.fillStyle='#004d99';
    ctx.font='bold 112px Arial';
    ctx.fillText('unibz',32,127);
    ctx.fillRect(222,14,74,7);
    ctx.fillRect(222,149,74,7);
    ctx.fillStyle='#243346';
    ctx.font='bold 42px Arial';
    ctx.fillText('SMART MINI FACTORY',354,76,381);
    ctx.font='bold 38px Arial';
    ctx.fillText(name,354,133,381);
  });
  for(const side of [-1,1]){
    const badge=new THREE.Mesh(new THREE.PlaneGeometry(.75,.172),face);
    badge.position.set(.50,.014,side*.147);
    badge.rotation.y=side<0?Math.PI:0;
    link.add(badge);
  }
}

function buildBranding(){
  const sign=graphic(1000,405,ctx=>{
    ctx.fillStyle='#f7f9fa';
    ctx.fillRect(0,0,1000,405);
    ctx.fillStyle='#172b44';
    ctx.font='bold 75px Arial';
    ['SMART','MINI','FACTORY'].forEach((line,i)=>ctx.fillText(line,63,105+90*i));
    ctx.fillStyle='#b8c1c8';
    ctx.fillRect(525,65,3,260);
    ctx.fillStyle='#0054a4';
    ctx.font='bold 113px Arial';
    ctx.fillText('unibz',590,240);
    ctx.fillRect(820,80,101,11);
    ctx.fillRect(821,294,100,11);
  });
  box(3.3,1.34,.055,'white',2.03,2.72,-5.52);
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(3.26,1.32),sign);
  wall.position.set(2.03,2.72,-5.489);
  scene.add(wall);
  const floorSign=graphic(1200,300,ctx=>{
    ctx.fillStyle='#223448';
    ctx.fillRect(0,0,1200,300);
    ctx.fillStyle='#83ddc3';
    ctx.fillRect(49,44,18,212);
    ctx.fillStyle='#fff';
    ctx.font='bold 98px Arial';
    ctx.fillText('SMART MINI FACTORY',110,162,1035);
    ctx.fillStyle='#afddff';
    ctx.font='bold 59px Arial';
    ctx.fillText('unibz',115,238);
  });
  const floorMark=new THREE.Mesh(new THREE.PlaneGeometry(3.6,.9),floorSign);
  floorMark.rotation.x=-Math.PI/2;
  floorMark.position.set(-1.15,.012,5.95);
  scene.add(floorMark);
}

function buildRobot(r){
  const source=r.id==='fanuc'?'closer':'capper';
  const clonePart=part=>{
    const name=source+'_'+part;
    const original=rigAsset.getObjectByName(name);
    if(!original)throw Error('Missing Blender rig part '+name);
    const group=original.clone(true);
    group.name=r.id+'_'+part;
    group.scale.setScalar(r.scale);
    group.traverse(mesh=>{
      if(!mesh.isMesh)return;
      mesh.castShadow=mesh.receiveShadow=true;
    });
    scene.add(group);
    return group;
  };
  const base=clonePart('base');
  const upper=clonePart('upper');
  const fore=clonePart('fore');
  const wrist=clonePart('wrist');
  // The UR10 uses the larger version of the alloy rig and its own articulated gripper.
  if(r.id==='ur10'){
    upper.scale.set(r.scale,r.scale*1.10,r.scale*1.10);
  }
  armMark(fore,r.name);
  const tool=gripper(r.id,scene);
  tool.scale.setScalar(r.scale);
  robotModels[r.id]={base,upper,fore,wrist,tool};
  label(r.name,[r.base[0],3.8*r.scale,r.base[2]],1.6);
}
function setRotation(o,a){
  const m=new THREE.Matrix4();
  m.set(a[0],a[1],a[2],0,a[3],a[4],a[5],0,a[6],a[7],a[8],0,0,0,0,1);
  o.quaternion.setFromRotationMatrix(m);
}
function poseRobot(r){
  const n=robotModels[r.id],f=forward(r.q,r);
  n.base.position.copy(V(r.base));
  n.base.rotation.y=r.q[0];
  n.upper.position.copy(V(f.shoulder));
  setRotation(n.upper,f.upper);
  n.fore.position.copy(V(f.elbow));
  setRotation(n.fore,f.fore);
  n.wrist.position.copy(V(f.wrist));
  setRotation(n.wrist,f.fore);
  n.tool.position.copy(V(f.tcp));
  const a=f.tool,b=[0,-1,0,1,0,0,0,0,1],rot=Array.from({
    length:9
  },(_,i)=>[0,1,2].reduce((s,k)=>s+a[Math.floor(i/3)*3+k]*b[k*3+i%3],0));
  setRotation(n.tool,rot);
  const stage=state.program[state.phaseIndex];
  const own=stage?.owner===r.id;
  const closure=own&&state.phase.endsWith('_grip')?smooth(state.progress):
    own&&state.phase.endsWith('_release')?1-smooth(state.progress):Number(r.engaged);
  const kind=r.holding||(own&&state.phase.startsWith('top_')?'top':'cap');
  poseGripper(n.tool,r.id,kind,closure,r.scale);
  n.grip={kind,closure,holding:r.holding,tcp:f.tcp,
    pads:n.tool.userData.fingers.map(({jaw})=>jaw.localToWorld(V([-.012,0,0])).toArray())};

}
function railProfile(path,offset,w,h,dy,id){
  const vertices=[],indices=[];
  path.forEach((p,i)=>{
    const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],dx=b[0]-a[0],dz=b[2]-a[2],l=Math.hypot(dx,dz)||1,n=[-dz/l,0,dx/l];for(const [s,t] of [[-1,-1],[1,-1],[1,1],[-1,1]])vertices.push(p[0]+n[0]*(offset+s*w/2),p[1]+dy+t*h/2,p[2]+n[2]*(offset+s*w/2));if(i<path.length-1)for(let j=0;j<4;j++){
      const a=i*4+j,b=i*4+(j+1)%4;indices.push(a,b,a+4,b,b+4,a+4);
    }
  });
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setIndex(indices);
  g.computeVertexNormals();
  const m=new THREE.Mesh(g,M[id]);
  m.castShadow=m.receiveShadow=true;
  scene.add(m);
}
function buildRail(){
  for(const path of [MAIN,BRANCH])for(const sign of [-1,1]){
    railProfile(path,sign*.20,.065,.19,0,'steel');
    railProfile(path,sign*.20,.07,.018,-.025,'slot');
    railProfile(path,sign*.20,.08,.024,.108,'steel');
  }
  for(const x of [-4,-2,0,2,4])for(const z of [-2.8,2.8]){
    box(.08,1.03,.08,'steel',x,.515,z);
    box(.16,.035,.16,'dark',x,.02,z);
    box(.5,.06,.06,'steel',x,1.04,z);
  }
  for(const x of [.4,3])for(const z of [3.6,4.7])box(.075,1.05,.075,'steel',x,.525,z);
  for(const z of [-2.8,2.8])box(8,.05,.06,'slot',0,.3,z);
  for(let i=0;i<MAIN.length;i+=24){
    const p=MAIN[i];
    box(.055,.025,.06,'led',p[0],p[1]+.1,p[2]);
  }
  label('5 · Position / pass-through',[2.5,1.7,-2.8],2.2);
  label('7 · Pass-through',[-5,1.7,.5],1.7);
  label('10 · Branch rejoin',[3.2,1.7,3.6],1.8);
}
function sphere(radius,id,parent=scene){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,20,14),M[id]);
  mesh.castShadow=true;
  parent.add(mesh);
  return mesh;
}

function buildOperator(){
  const torso=box(.39,.49,.23,'workwear');
  const hips=box(.31,.18,.22,'trousers',1.79,.93,6.08);
  const head=sphere(.117,'skin');
  head.scale.set(.86,1.18,.92);
  const hair=sphere(.118,'hair');
  hair.scale.set(.88,.59,.95);
  const visor=box(.18,.036,.025,'lens');
  for(const x of [1.67,1.91]){
    segment([x,.89,6.08],[x,.47,6.10],.087,'trousers');
    segment([x,.47,6.10],[x,.11,6.11],.065,'trousers');
    box(.14,.10,.25,'rubber',x,.06,6.05);
  }
  const arm=()=>({
    sleeve:segment([0,0,0],[0,1,0],.060,'workwear'),
    forearm:segment([0,0,0],[0,1,0],.044,'skin'),
    glove:sphere(.059,'glove')
  });
  return {torso,hips,head,hair,visor,left:arm(),right:arm()};
}

function operatorPose(source,dock,progress){
  const move=(a,b,start,end)=>lerp(a,b,smooth(Math.max(0,Math.min(1,(progress-start)/(end-start)))));
  const lift=[source[0],source[1]+.25,source[2]];
  const over=[dock[0],dock[1]+.25,dock[2]];
  const part=progress<.24?source:progress<.42?move(source,lift,.24,.42):
    progress<.63?move(lift,over,.42,.63):move(over,dock,.63,.80);
  const grip=[part[0]+.165,part[1]-.055,part[2]];
  const rest=[2.02,1.12,5.99];
  const hand=progress<.24?move(rest,grip,0,.24):
    progress<.80?grip:move(grip,rest,.80,1);
  return {part,hand};
}

function poseOperator(hand){
  const lean=Math.max(0,Math.min(.46,(5.93-hand[2])*.52));
  const z=6.08-lean;
  // Lean around the hips so the torso stays attached while the arm reaches.
  setSegment(operator.torso,[1.79,.99,6.08],[1.79,1.49,z]);
  operator.torso.scale.y/=.49;
  operator.head.position.set(1.79,1.62,z-.075);
  operator.hair.position.set(1.79,1.70,z-.056);
  operator.visor.position.set(1.79,1.64,z-.178);
  const setArm=(arm,shoulder,wrist,side)=>{
    const elbow=[(shoulder[0]+wrist[0])*.5+side*.10,
      (shoulder[1]+wrist[1])*.5-.095,(shoulder[2]+wrist[2])*.5+.05];
    setSegment(arm.sleeve,shoulder,elbow);
    setSegment(arm.forearm,elbow,wrist);
    arm.glove.position.copy(V(wrist));
  };
  setArm(operator.right,[1.98,1.45,z],hand,1);
  setArm(operator.left,[1.60,1.45,z],[1.56,1.06,z-.09],-1);
}

function buildCell(){
  buildRail();
  // Distinct independent conveyor/tray cell outside the main loop.
  table(-2.8,-4.2,1.1,1.0,1.19);
  for(let z=-4.6;z<=-3.8;z+=.12){
    const ro=cyl(.045,1.02,'steel',-2.8,PALLET_SEAT-.045,z);
    ro.rotation.z=Math.PI/2;
  }
  label('FANUC · Conveyor / tray loading',[-1.9,3.7,-4.5],2.7);
  label('6 · Tray loading',[-1.5,1.8,-2.8],1.8);
  table(6.27,-1.28,1.09,1.05);
  table(6.27,1.22,1.09,1.05);
  box(1.06,.035,1.03,'dark',6.27,1.32,-1.28);
  box(1.06,.035,1.03,'dark',6.27,1.32,1.22);
  label('4 · UR3e assembly',[5.1,2.5,.5],2.1);
  for(const x of [4.62,5.38]){
    box(.035,.21,.07,'dark',x,1.3,0);
    cyl(.02,.04,'led',x,1.44,0);
  }
  box(.70,.08,.58,'dark',5,1.12,0);
  // Stock shelf and a fixed dock. The operator places the body into the shuttle nest.
  table(1.7,5.56,1.75,.28,1.3);
  table(1.7,4.8,1.05,.7,1.05);
  operator=buildOperator();
  label('9 · Manual shuttle loading',[1.7,1.9,5.1],2.3);
  // Side-mounted inspection head. Keep every solid part outside the shuttle envelope.
  const [dockX,,dockZ]=DOCK.vision;
  const cameraX=dockX+.54;
  const cameraZ=dockZ+.83;
  const mount=new THREE.Group();
  scene.add(mount);
  box(.26,.055,.24,'dark',cameraX,.035,cameraZ,mount);
  box(.060,1.80,.060,'steel',cameraX,.95,cameraZ,mount);
  box(.125,.055,.10,'steel',cameraX,1.87,cameraZ,mount);
  const head=new THREE.Group();
  mount.add(head);
  head.position.set(cameraX,1.98,cameraZ);
  const aim=new THREE.Vector3(dockX,BODY_ON_TRAY+CAP_HEIGHT+TOP_HEIGHT,dockZ);
  head.lookAt(aim);
  box(.18,.13,.18,'dark',0,0,0,head);
  const collar=cyl(.049,.025,'steel',0,0,.10,head);
  collar.rotation.x=Math.PI/2;
  inspectionLight=cyl(.037,.012,'lens',0,0,.119,head);
  inspectionLight.rotation.x=Math.PI/2;
  const lensPosition=inspectionLight.getWorldPosition(new THREE.Vector3());
  inspectionBounds=new THREE.Box3().setFromObject(mount);
  inspectionBeam=new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([lensPosition,aim]),
    new THREE.LineDashedMaterial({color:'#379ce0',dashSize:.05,gapSize:.025,transparent:true,opacity:.74})
  );
  inspectionBeam.computeLineDistances();
  inspectionBeam.visible=false;
  scene.add(inspectionBeam);
  label('8 · Side vision & UR10 dispatch',[-3.6,2.4,3.5],2.7);
  table(-3.55,3.75,2.1,.65,1.2);
  for(let i=0;i<4;i++){
    const p=outputPoint(i);
    box(.40,.03,.40,'dark',p[0],1.205,p[2]);
    cyl(.025,.12,'steel',p[0]-.17,1.28,p[2]+.17);
  }
  // Warehouse inside loop, with input/output shelves and fixtures.
  for(const x of [-4.5,-3.7])for(const z of [-1.7,.5])box(.06,2.3,.06,'steel',x,1.15,z);
  for(let i=0;i<4;i++){
    box(.86,.045,2.2,'dark',-4.1,.36+i*.48,-.6);
    for(let j=0;j<3;j++){
      const g=trayModel();
      g.scale.setScalar(.65);
      g.position.set(-4.1,.42+i*.48,-1.3+j*.7);
    }
  }
  label('Warehouse · trays & products',[-4.1,2.8,-.6],2.1);
  // Idle shuttles are parked off the live route, not ghosted through S1.
  table(1,-4.1,1.8,.7,1.1);
  for(let i=0;i<2;i++){
    const g=carrierModel();
    g.position.set(.5+i*.8,1.22,-4.1);
    label('S'+(i+2)+' · Parked',[.5+i*.8,1.6,-4.1],.9);
  }
  for(const r of ROBOTS)buildRobot(r);
  carrier=carrierModel();
  tray=trayModel();
  for(const p of createInventory()){
    const g=new THREE.Group();
    g.userData.pocket=p.id;
    scene.add(g);
    const models=[];
    for(let i=0;i<(p.kind==='top'?2:1);i++){
      const m=part(p.kind,p.color,g);
      m.position.set(p.position[0],p.position[1]+i*p.height,p.position[2]);
      models.push(m);
    }
    const ring=new THREE.Mesh(new THREE.TorusGeometry(p.kind==='body'?.21:.16,.008,6,40),new THREE.MeshBasicMaterial({
      color:'#1766ee'
    }));
    ring.rotation.x=Math.PI/2;
    ring.position.copy(V(p.position));
    ring.position.y-=.08;
    g.add(ring);
    inventoryMeshes.set(p.id,{
      g,models,ring
    });
  }
}
function productGroup(product){
  const g=new THREE.Group();
  scene.add(g);
  const b=state?.inventory.find(p=>p.id===product.sources.body),c=state?.inventory.find(p=>p.id===product.sources.cap),t=state?.inventory.find(p=>p.id===product.sources.top);
  part('body',b?.color,g);
  part('cap',c?.color,g).position.y=CAP_HEIGHT;
  part('top',t?.color,g).position.y=CAP_HEIGHT+TOP_HEIGHT;
  return g;
}
let partKey='';
function updateModels(){
  if(!ready||!state)return;
  for(const r of state.robots)poseRobot(r);
  carrier.position.copy(V(state.carrier.position));
  carrier.rotation.y=state.carrier.yaw;
  const dock=[state.carrier.position[0],BODY_ON_TRAY,state.carrier.position[2]];
  const source=state.inventory.find(p=>p.id===state.selection?.body)?.position;
  const transfer=state.loading&&source?operatorPose(source,dock,state.loading.progress):null;
  poseOperator(transfer?.hand||[2.02,1.12,5.99]);
  const fanuc=state.robots.find(r=>r.id==='fanuc'),ur3e=state.robots.find(r=>r.id==='ur3e'),ur10=state.robots.find(r=>r.id==='ur10');
  tray.position.copy(V(state.tray.location==='supply'?TRAY_SOURCE:state.tray.location==='tool'?fanuc.tcp:[state.carrier.position[0],1.31,state.carrier.position[2]]));
  tray.rotation.y=state.tray.location==='carrier'?state.carrier.yaw:TRAY_YAW;
  for(const p of state.inventory){
    const n=inventoryMeshes.get(p.id);
    n.models.forEach((m,i)=>m.visible=i<p.quantity);
    n.ring.visible=selectedPocket?.[p.kind]===p.id;
  }
  if(state.product){
    const key=JSON.stringify(state.product.sources);
    if(key!==partKey){
      partKey=key;
      for(const m of [body,cap,top])if(m)scene.remove(m);
      body=part('body',state.inventory.find(p=>p.id===state.product.sources.body).color);
      cap=part('cap',state.inventory.find(p=>p.id===state.product.sources.cap).color);
      top=part('top',state.inventory.find(p=>p.id===state.product.sources.top).color);
    }
    const product=state.product,bp=[state.carrier.position[0],BODY_ON_TRAY,state.carrier.position[2]];
    if(product.holder==='ur10')bp.splice(0,3,...ur10.tcp);
    body.visible=product.body.location!=='supply'&&product.holder!=='buffer';
    cap.visible=!['supply'].includes(product.cap.location)&&product.holder!=='buffer';
    top.visible=product.top.location!=='supply'&&product.holder!=='buffer';
    body.position.copy(V(product.body.location==='operator'&&transfer?transfer.part:bp));
    for(const [m,k,h]of [[cap,'cap',CAP_HEIGHT],[top,'top',CAP_HEIGHT+TOP_HEIGHT]])m.position.copy(V(product[k].location==='tool'?ur3e.tcp:[bp[0],bp[1]+h,bp[2]]));
  }
  else{
    for(const m of [body,cap,top])if(m)m.visible=false;
  }
  for(const product of state.finished){
    if(!finishedMeshes.has(product.id))finishedMeshes.set(product.id,productGroup(product));
    finishedMeshes.get(product.id).position.copy(V(product.position));
  }
  for(const [id,m]of finishedMeshes)if(!state.finished.some(p=>p.id===id)){
    scene.remove(m);
    finishedMeshes.delete(id);
  }
  const scanning=state.phase==='vision'&&state.running&&!state.stopped;
  inspectionLight.material=scanning?(state.faults.vision?M.red:M.led):M.lens;
  inspectionBeam.visible=scanning;
  if(scanning)inspectionBeam.material.color.set(state.faults.vision?'#db5148':'#379ce0');
  window.__trial2.scene={
    loaded:true,robotCount:3,robotAsset:"cell-models.glb",visionMountMinZ:inspectionBounds.min.z,grips:Object.fromEntries(Object.entries(robotModels).map(([id,model])=>[id,model.grip])),humans:1,operatorHand:transfer?.hand||null,loadingPart:transfer?.part||null,finishedIds:[...finishedMeshes.keys()],carrierPosition:[...state.carrier.position],branch:true,lighting:window.__trial2.lighting
  };
}
export function setState(s,draft){
  state=s;
  selectedPocket=draft;
}
export function focusStation(id){
  const map={
    all:[[.5,1,.6],21,.22,.78],plan:[[.5,0,.5],22,0,1.5],fanuc:[[-1.8,1.4,-3.7],6.5,.8,.55],setup:[[1.73,1.12,5.42],4.4,1.15,.58],ur3e:[[5.7,1.3,0],6.5,.75,.52],ur10:[[-3.3,1.4,1.6],8,.5,.60],dispatch:[[-3.1,1.4,3.1],6.5,.5,.62]
  };
  const p=map[id]||map.all;
  for(const marker of worldLabels)marker.visible=id!=='setup';
  targetFocus.copy(V(p[0]));
  targetDistance=p[1];
  targetAz=p[2];
  targetEl=p[3];
  selectedRobot=ROBOTS.some(r=>r.id===id)?id:selectedRobot;
}
function thumbnails(){
  const r=new THREE.WebGLRenderer({
    antialias:true,alpha:true,preserveDrawingBuffer:true
  });
  r.setSize(200,150,false);
  r.setClearColor('#ffffff',0);
  r.toneMapping=THREE.ACESFilmicToneMapping;
  const s=new THREE.Scene();
  s.add(new THREE.HemisphereLight('#ffffff','#b2bec9',3));
  const l=new THREE.DirectionalLight('#ffffff',4);
  l.position.set(-3,6,4);
  s.add(l);
  const c=new THREE.PerspectiveCamera(34,4/3,.01,20);
  for(const p of createInventory()){
    const g=part(p.kind,p.color,s);
    c.position.set(.43,.31,.55);
    c.lookAt(0,-.05,0);
    r.render(s,c);
    thumbs[p.id]=r.domElement.toDataURL('image/png');
    s.remove(g);
  }
  for(const id of ['fanuc','ur3e','ur10']){
    const g=gripper(id,s);
    c.position.set(.6,.4,.8);
    c.lookAt(0,.14,0);
    r.render(s,c);
    thumbs[id]=r.domElement.toDataURL('image/png');
    s.remove(g);
  }
  r.dispose();
}
export const thumbnail=id=>thumbs[id];
export function drawTool(canvas,id){
  const url=thumbs[id];
  if(!canvas||!url)return;
  const im=new Image();
  im.onload=()=>{
    const c=canvas.getContext('2d');
    c.clearRect(0,0,canvas.width,canvas.height);
    const scale=Math.min(canvas.width/im.width,canvas.height/im.height);
    c.drawImage(im,(canvas.width-im.width*scale)/2,(canvas.height-im.height*scale)/2,im.width*scale,im.height*scale);
  };
  im.src=url;
}
export async function initialize(target,onPick){
  container=target;
  pickHandler=onPick;
  window.__trial2??={
  };
  renderer=new THREE.WebGLRenderer({
    antialias:true
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.9;
  renderer.setClearColor('#dfe5e9');
  container.append(renderer.domElement);
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(38,1,.1,100);
  material('steel','#a4b2bb',.85,.28);
  material('white','#d4dce0',.35,.35);
  material('ivory','#e0d5b8',.1,.55);
  material('dark','#25313b',.25,.44);
  material('rubber','#141c24',.02,.8);
  material('blue','#a2c9da',.2,.38);
  material('yellow','#e8bb20',.24,.32);
  material('slot','#4c5d68',.6,.5);
  material('led','#4db7a7',.1,.3);
  M.led.emissive.set('#137064');
  material('lens','#193b4c',.6,.15);
  material('red','#bc5141');
  material('workwear','#223850',0,.85);
  material('trousers','#2e3540',0,.90);
  material('skin','#b68164',0,.76);
  material('hair','#332722',0,.92);
  material('glove','#457cab',0,.72);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({
    color:'#c8cfd3',roughness:.8
  }));
  floor.rotation.x=-Math.PI/2;
  floor.position.y=-.01;
  floor.receiveShadow=true;
  scene.add(floor);
  const grid=new THREE.GridHelper(40,40,'#acb8c0','#bdc7ce');
  grid.position.y=.001;
  grid.material.opacity=.18;
  grid.material.transparent=true;
  scene.add(grid);
  const pm=new THREE.PMREMGenerator(renderer);
  try{
    const hdr=await new HDRLoader().loadAsync('/assets/studio_small_09_1k.hdr');
    scene.environment=pm.fromEquirectangular(hdr).texture;
    hdr.dispose();
    window.__trial2.lighting='HDR';
  }
  catch{
    const env=new RoomEnvironment();
    scene.environment=pm.fromScene(env,.04).texture;
    env.dispose();
    window.__trial2.lighting='Studio fallback';
  }
  pm.dispose();
  scene.environmentIntensity=.8;
  scene.add(new THREE.HemisphereLight('#e8f3ff','#748797',1));
  const key=new THREE.DirectionalLight('#fff6e6',2.2);
  key.position.set(-5,13,5);
  key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera,{
    left:-10,right:10,top:10,bottom:-10,near:.1,far:35
  });
  key.shadow.normalBias=.03;
  scene.add(key);
  const fill=new THREE.DirectionalLight('#d9ebff',1);
  fill.position.set(7,6,-5);
  scene.add(fill);
  // An original modeled partition; no photographic backgrounds or slide elements.
  for(let x=-6;x<=7;x+=2.6){
    box(.045,3.5,.045,'steel',x,1.75,-5.6);
    if(x<7){
      const glass=new THREE.Mesh(new THREE.BoxGeometry(2.5,3.2,.012),new THREE.MeshStandardMaterial({
        color:'#c9e1ea',transparent:true,opacity:.10,roughness:.25,depthWrite:false
      }));
      glass.position.set(x+1.3,1.85,-5.6);
      scene.add(glass);
    }
  }
  box(13,.05,.05,'steel',.5,3.5,-5.6);
  rigAsset=(await new GLTFLoader().loadAsync('/assets/cell-models.glb')).scene;
  buildCell();
  buildBranding();
  thumbnails();
  ready=true;
  renderer.shadowMap.needsUpdate=true;
  document.getElementById('asset-state').textContent='BLENDER ROBOTS · PBR MATERIALS';
  let drag=false,x=0,y=0,sx=0,sy=0;
  renderer.domElement.addEventListener('pointerdown',e=>{
    drag=true;x=sx=e.clientX;y=sy=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove',e=>{
    if(!drag)return;targetAz-=(e.clientX-x)*.006;targetEl=Math.max(.18,Math.min(1.5,targetEl+(e.clientY-y)*.005));x=e.clientX;y=e.clientY;
  });
  renderer.domElement.addEventListener('pointerup',e=>{
    drag=false;if(Math.hypot(e.clientX-sx,e.clientY-sy)>5)return;const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObjects([...inventoryMeshes.values()].map(x=>x.g),true)[0];if(hit){
      let o=hit.object;while(o&&!o.userData.pocket)o=o.parent;if(o)pickHandler(o.userData.pocket);
    }
  });
  renderer.domElement.addEventListener('wheel',e=>{
    e.preventDefault();targetDistance=Math.max(3,Math.min(29,targetDistance+e.deltaY*.012));
  },{
    passive:false
  });
  new ResizeObserver(()=>{
    if(container.clientWidth&&container.clientHeight){
      renderer.setSize(container.clientWidth,container.clientHeight,false);camera.aspect=container.clientWidth/container.clientHeight;camera.updateProjectionMatrix();
    }
  }).observe(container);
  let last=0,lastState='';
  function frame(now){
    requestAnimationFrame(frame);
    if(now-last<33||!container.clientWidth)return;
    last=now;
    focus.lerp(targetFocus,.13);
    distance+=(targetDistance-distance)*.13;
    azimuth+=(targetAz-azimuth)*.13;
    elevation+=(targetEl-elevation)*.13;
    camera.position.set(focus.x+Math.sin(azimuth)*Math.cos(elevation)*distance,focus.y+Math.sin(elevation)*distance,focus.z+Math.cos(azimuth)*Math.cos(elevation)*distance);
    camera.lookAt(focus);
    updateModels();
    const sig=state?JSON.stringify([state.phase,state.progress,state.loading?.progress,state.robots.map(r=>r.q),state.inventory.map(p=>p.quantity)]):'';
    if(sig!==lastState){
      renderer.shadowMap.needsUpdate=true;
      lastState=sig;
    }
    renderer.render(scene,camera);
  }
  requestAnimationFrame(frame);
  return thumbs;
}
