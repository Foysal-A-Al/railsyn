// Shared centre-line geometry for both the controller and the rendered rail.
const r=.6,straight=10.8,side=3.2,arc=Math.PI*r/2;
export const RAIL={radius:r,length:2*straight+2*side+4*arc,load:.9,cap:5.4,top:9.9,output:10.7,rightReturn:straight+side+2*arc,backReturn:2*straight+side+2*arc};
export function railPoint(distance,lift=0){
 let s=((distance%RAIL.length)+RAIL.length)%RAIL.length,x,z;
 if(s<straight){x=-5.4+s;z=2.2;}
 else if((s-=straight)<arc){const a=Math.PI/2-s/r;x=5.4+r*Math.cos(a);z=1.6+r*Math.sin(a);}
 else if((s-=arc)<side){x=6;z=1.6-s;}
 else if((s-=side)<arc){const a=-s/r;x=5.4+r*Math.cos(a);z=-1.6+r*Math.sin(a);}
 else if((s-=arc)<straight){x=5.4-s;z=-2.2;}
 else if((s-=straight)<arc){const a=-Math.PI/2-s/r;x=-5.4+r*Math.cos(a);z=-1.6+r*Math.sin(a);}
 else if((s-=arc)<side){x=-6;z=-1.6+s;}
 else {s-=side;const a=Math.PI-s/r;x=-5.4+r*Math.cos(a);z=1.6+r*Math.sin(a);}
 return [x,1.24+lift,z];
}
export function railYaw(distance){const a=railPoint(distance-.001),b=railPoint(distance+.001);return -Math.atan2(b[2]-a[2],b[0]-a[0]);}
