// Concept geometry, not a calibrated manufacturer model. metres / radians.
export const SHOULDER=[0,1.8,0], L1=1.2, L2=1.15, TOOL=.32;
export const LIMITS=[[-360,360],[-20,160],[-155,155],[-180,180],[-180,180],[-360,360]];
export const mul=(a,b)=>Array.from({length:9},(_,i)=>[0,1,2].reduce((s,k)=>s+a[Math.floor(i/3)*3+k]*b[k*3+i%3],0));
export const transform=(r,p)=>[0,1,2].map(i=>r[i*3]*p[0]+r[i*3+1]*p[1]+r[i*3+2]*p[2]);
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const rx=a=>[1,0,0,0,Math.cos(a),-Math.sin(a),0,Math.sin(a),Math.cos(a)];
const ry=a=>[Math.cos(a),0,Math.sin(a),0,1,0,-Math.sin(a),0,Math.cos(a)];
const rz=a=>[Math.cos(a),-Math.sin(a),0,Math.sin(a),Math.cos(a),0,0,0,1];
export function forward(q,base=[0,0,0]){
 const shoulder=add(SHOULDER,base),upper=mul(ry(q[0]),rz(q[1])),fore=mul(mul(ry(q[0]),rz(q[1]+q[2])),rx(q[3])),tool=mul(mul(fore,rz(q[4])),rx(q[5]));
 const elbow=add(shoulder,transform(upper,[L1,0,0])),wrist=add(elbow,transform(fore,[L2,0,0]));
 return {shoulder,elbow,wrist,tcp:add(wrist,transform(tool,[TOOL,0,0])),upper,fore,tool};
}
export function inverse(point,base=[0,0,0],reference=0){
 const [x,y,z]=point.map((v,i)=>v-base[i]),r=Math.hypot(x,z),dy=y+TOOL-SHOULDER[1],c=(r*r+dy*dy-L1*L1-L2*L2)/(2*L1*L2);
 if(c>1||c< -1||r<.05)throw Error('Target outside the concept arm workspace.');
 const elbow=-Math.acos(c),shoulder=Math.atan2(dy,r)-Math.atan2(L2*Math.sin(elbow),L1+L2*Math.cos(elbow));
 let yaw=Math.atan2(-z,x);while(yaw-reference>Math.PI)yaw-=2*Math.PI;while(yaw-reference< -Math.PI)yaw+=2*Math.PI;if(Math.abs(yaw)>2*Math.PI)yaw=Math.atan2(-z,x);
 return [yaw,shoulder,elbow,0,-Math.PI/2-shoulder-elbow,yaw];
}
export const degrees=q=>q.map(x=>x*180/Math.PI);
