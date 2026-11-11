import {
  forward as fk,inverse as ik,LIMITS
} from './kinematics.mjs';
export {
  LIMITS
};
export const ROBOTS=[
{
  id:'fanuc',name:'FANUC ER-4iA',job:'Conveyor / tray loading',tool:'SCHUNK-style two-jaw',base:[-1.5,0,-4.2],scale:1,color:'#edc328',home:[-1.5,2.1,-3.15]
},
{
  id:'ur3e',name:'UR3e',job:'First cap + top cover assembly',tool:'OnRobot-style two-finger',base:[6.3,0,0],scale:.8,color:'#9abfcf',home:[5.9,2.1,0]
},
{
  id:'ur10',name:'UR10',job:'Finished product dispatch',tool:'Robotiq-style three-finger',base:[-3,0,1.65],scale:1.1,color:'#9abfcf',home:[-2.2,2.4,1.25]
}
];
export const DOCK={
  load:[-1.5,1.31,-2.8],setup:[1.7,1.31,4.8],assembly:[5,1.31,0],vision:[-2.4,1.31,2.8]
};
export const TRAY_SOURCE=[-2.9,1.31,-4.2];
export const TRAY_Y=DOCK.load[1];
export const TRAY_YAW=-Math.PI/2;
export const BODY_HEIGHT=.18;
export const CAP_HEIGHT=.075;
export const TOP_HEIGHT=.055;
export const BODY_ON_TRAY=TRAY_Y+.054+BODY_HEIGHT;
export const CAP_ON_TRAY=BODY_ON_TRAY+CAP_HEIGHT;
export const TOP_ON_TRAY=CAP_ON_TRAY+TOP_HEIGHT;
export const PALLET_SEAT=TRAY_Y-.045/2;

export function gripContacts(id,kind,closure){
  const tray=id==='fanuc';
  const cup=id==='ur10';
  const radius=tray ? .265 : cup ? .16 : .135;
  const clearance=(tray ? .050 : .033)*(1-closure);
  const depth=tray ? 0 : cup ? -.092 : -(kind==='top' ? TOP_HEIGHT : CAP_HEIGHT)/2;
  const angles=cup?[-.47,.47,Math.PI]:[0,Math.PI];
  return angles.map(angle=>({
    angle,
    inner:[(radius+clearance)*Math.cos(angle),depth,(radius+clearance)*Math.sin(angle)]
  }));
}

export const outputPoint=i=>[-4.3+i*.5,1.4,3.75];
export function forward(q,r){
  const f=fk(q);
  const at=p=>p.map((v,i)=>r.base[i]+v*r.scale);
  return {
    ...f,shoulder:at(f.shoulder),elbow:at(f.elbow),wrist:at(f.wrist),tcp:at(f.tcp)
  };
}
export function inverse(p,r,reference=0){
  return ik(p.map((v,i)=>(v-r.base[i])/r.scale),[0,0,0],reference);
}
export const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export const smooth=t=>{
  t=Math.max(0,Math.min(1,t));
  return t*t*t*(10+t*(-15+t*6));
};
export function createInventory(){
  const list=[];
  for(let i=0;i<4;i++)list.push({
    id:'B'+(i+1),kind:'body',color:['#7d8d99','#c4cbd0','#303e48','#94a5af'][i],quantity:1,height:.18,position:[1.1+i*.35,1.48,5.6]
  });
  for(const kind of ['cap','top'])for(let i=0;i<9;i++)list.push({
    id:(kind==='cap'?'C':'T')+(i+1),kind,color:['#263540','#c3cdd0','#e4e3da'][i%3],quantity:kind==='top'?2:1,height:kind==='top'?.055:.075,position:[5.93+(i%3)*.34,1.3375+(kind==='cap'?CAP_HEIGHT:TOP_HEIGHT),(kind==='cap'?-1.62:.88)+Math.floor(i/3)*.34]
  });
  return list;
}
export const pickupPoint=p=>[p.position[0],p.position[1]+(p.quantity-1)*p.height,p.position[2]];
function line(a,b,out){
  const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.06);
  for(let i=1;i<=n;i++)out.push([a[0]+(b[0]-a[0])*i/n,1.15,a[1]+(b[1]-a[1])*i/n]);
}
function arc(cx,cz,r,a,b,out){
  for(let i=1;i<=24;i++){
    const t=a+(b-a)*i/24;
    out.push([cx+Math.cos(t)*r,1.15,cz+Math.sin(t)*r]);
  }
}
const main=[[4.15,1.15,-2.8]];
line([4.15,-2.8],[-1.5,-2.8],main);
line([-1.5,-2.8],[-4.15,-2.8],main);
arc(-4.15,-1.95,.85,-Math.PI/2,-Math.PI,main);
line([-5,-1.95],[-5,1.95],main);
arc(-4.15,1.95,.85,Math.PI,Math.PI/2,main);
line([-4.15,2.8],[-2.4,2.8],main);
line([-2.4,2.8],[.4,2.8],main);
line([.4,2.8],[3,2.8],main);
line([3,2.8],[4.15,2.8],main);
arc(4.15,1.95,.85,Math.PI/2,0,main);
line([5,1.95],[5,0],main);
line([5,0],[5,-1.95],main);
arc(4.15,-1.95,.85,0,-Math.PI/2,main);
export const MAIN=main;
const branch=[[.4,1.15,2.8]];
line([.4,2.8],[.4,4.25],branch);
arc(.95,4.25,.55,Math.PI,Math.PI/2,branch);
line([.95,4.8],[1.7,4.8],branch);
line([1.7,4.8],[2.45,4.8],branch);
arc(2.45,4.25,.55,Math.PI/2,0,branch);
line([3,4.25],[3,2.8],branch);
export const BRANCH=branch;
const nearest=(path,p)=>path.reduce((best,x,i)=>Math.hypot(x[0]-p[0],x[2]-p[2])<Math.hypot(path[best][0]-p[0],path[best][2]-p[2])?i:best,0);
function slice(path,a,b,wrap=false){
  const ai=nearest(path,a),bi=nearest(path,b);
  return wrap&&bi<ai?[...path.slice(ai),...path.slice(1,bi+1)]:path.slice(ai,bi+1);
}
export function makeRoute(name){
  const entry=BRANCH[0],exit=BRANCH.at(-1);
  let points;
  if(name==='setup')points=[...slice(MAIN,DOCK.load,entry,true),...slice(BRANCH,entry,DOCK.setup).slice(1)];
  else if(name==='assembly')points=[...slice(BRANCH,DOCK.setup,exit),...slice(MAIN,exit,DOCK.assembly,true).slice(1)];
  else points=slice(MAIN,name==='vision'?DOCK.assembly:DOCK.vision,name==='vision'?DOCK.vision:DOCK.load,true);
  return pathData(points);
}
export function pathData(points){
  const lengths=[0];
  for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(...points[i].map((x,j)=>x-points[i-1][j])));
  return {
    points,lengths,length:lengths.at(-1)
  };
}
export function atDistance(path,d){
  d=Math.max(0,Math.min(path.length,d));
  let i=1;
  while(i<path.lengths.length-1&&path.lengths[i]<d)i++;
  const den=path.lengths[i]-path.lengths[i-1];
  const p=lerp(path.points[i-1],path.points[i],den?(d-path.lengths[i-1])/den:0);
  const a=path.points[i-1],b=path.points[i];
  return {
    position:p,yaw:Math.atan2(b[0]-a[0],b[2]-a[2])
  };
}
export const ROUTES=Object.fromEntries(['setup','assembly','vision','return'].map(n=>[n,makeRoute(n)]));
