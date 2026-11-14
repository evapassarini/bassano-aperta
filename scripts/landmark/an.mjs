import fs from 'fs';
const j=JSON.parse(fs.readFileSync('osm.json','utf8'));
const lon0=11.7345,lat0=45.7665,K=111320*Math.cos(lat0*Math.PI/180);
const m=(p)=>[(p.lon-lon0)*K,(p.lat-lat0)*110574];
for(const e of j.elements){
  const t=e.tags||{};
  const named = t.name||t.historic||t.bridge||t.man_made||t.amenity==='place_of_worship'||t.tourism||t.barrier;
  if(!named) continue;
  let g = e.geometry || (e.members? e.members.filter(x=>x.role==='outer').flatMap(x=>x.geometry||[]):null);
  if(e.type==='node'){ const p=m(e); console.log('N',e.id,p.map(v=>v.toFixed(1)).join(','),JSON.stringify(t).slice(0,160)); continue;}
  if(!g||!g.length) continue;
  const pts=g.map(m); const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  const cx=(Math.min(...xs)+Math.max(...xs))/2, cy=(Math.min(...ys)+Math.max(...ys))/2;
  // longest edge bearing
  let best=0,bb=0,len=0; for(let i=0;i<pts.length-1;i++){const dx=pts[i+1][0]-pts[i][0],dy=pts[i+1][1]-pts[i][1],l=Math.hypot(dx,dy); len+=l; if(l>best){best=l;bb=(Math.atan2(dx,dy)*180/Math.PI+360)%180;}}
  const tt={...t}; for(const k of Object.keys(tt)) if(/^(wikidata|wikipedia|addr|source|website|phone|opening|contact|email|name:|check_date|image|wikimedia)/.test(k)) delete tt[k];
  console.log(e.type[0],e.id,'c=',cx.toFixed(0)+','+cy.toFixed(0),'bbox',(Math.max(...xs)-Math.min(...xs)).toFixed(0)+'x'+(Math.max(...ys)-Math.min(...ys)).toFixed(0),'n',pts.length,'longEdge',best.toFixed(0)+'m@'+bb.toFixed(0)+'°','len',len.toFixed(0),JSON.stringify(tt).slice(0,230));
}
