import fs from 'fs';
const j=JSON.parse(fs.readFileSync(new URL('./osm.json',import.meta.url),'utf8'));
export const lon0=11.7345,lat0=45.7665,K=111320*Math.cos(lat0*Math.PI/180);
export const toM=(p)=>[(p.lon-lon0)*K,(p.lat-lat0)*110574];
export const toLL=([x,y])=>({lat:+(lat0+y/110574).toFixed(6),lon:+(lon0+x/K).toFixed(6)});
const byId=new Map(j.elements.filter(e=>e.type==='way').map(e=>[e.id,e]));
export function pts(id){const e=byId.get(id); if(!e) throw new Error('no way '+id); return e.geometry.map(toM);}
export function hull(P){const p=[...P].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const lo=[];for(const q of p){while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);}const up=[];for(const q of p.reverse()){while(up.length>1&&cr(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q);}lo.pop();up.pop();return lo.concat(up);}
export function obb(id){const h=hull(pts(id));let best=null;for(let i=0;i<h.length;i++){const a=h[i],b=h[(i+1)%h.length];const l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<0.5)continue;const ux=(b[0]-a[0])/l,uy=(b[1]-a[1])/l;let mnu=1e9,mxu=-1e9,mnv=1e9,mxv=-1e9;for(const q of h){const pu=q[0]*ux+q[1]*uy,pv=q[0]*uy-q[1]*ux;mnu=Math.min(mnu,pu);mxu=Math.max(mxu,pu);mnv=Math.min(mnv,pv);mxv=Math.max(mxv,pv);}const A=(mxu-mnu)*(mxv-mnv);if(!best||A<best.A){let L=mxu-mnu,W=mxv-mnv,cu=(mnu+mxu)/2,cv=(mnv+mxv)/2;let c=[cu*ux+cv*uy,cu*uy-cv*ux];let ang=Math.atan2(ux,uy)*180/Math.PI;if(W>L){[L,W]=[W,L];ang+=90;}ang=((ang%180)+180)%180;best={A,c,ang,L,W};}}return best;}
if((process.argv[1]||"").endsWith('geo.mjs')){for(const id of process.argv.slice(2).map(Number)){const o=obb(id);console.log(id,'c',o.c.map(v=>v.toFixed(1)).join(','),'ang',o.ang.toFixed(0),'L',o.L.toFixed(1),'W',o.W.toFixed(1),'n',pts(id).length);}}
