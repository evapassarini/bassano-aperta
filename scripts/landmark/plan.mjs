import fs from 'fs';
const j=JSON.parse(fs.readFileSync('osm.json','utf8'));
const lon0=11.7345,lat0=45.7665,K=111320*Math.cos(lat0*Math.PI/180);
const m=(p)=>[(p.lon-lon0)*K,(p.lat-lat0)*110574];
const T={ponte:[45.76751,11.73111,70],nardini:[45.76746,11.73172,45],castello:[45.76912,11.73291,120],torre:[45.76702,11.73436,70],museo:[45.76642,11.7352,70],sturm:[45.76633,11.73167,60],tempio:[45.763668,11.733443,80],dieda:[45.764928,11.736005,60],bolle:[45.7401,11.75409,200]};
fs.mkdirSync('plan',{recursive:true});
for(const [k,[la,lo,r]] of Object.entries(T)){
  const c=m({lat:la,lon:lo}); const sc=900/(2.4*r); let s=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900"><rect width="900" height="900" fill="#fff"/>`;
  const P=(p)=>[(450+(p[0]-c[0])*sc).toFixed(1),(450-(p[1]-c[1])*sc).toFixed(1)];
  const out=[];
  for(const e of j.elements){ if(e.type==='node')continue; const t=e.tags||{};
    const rings = e.geometry?[e.geometry]:(e.members||[]).filter(x=>x.geometry).map(x=>x.geometry);
    for(const g of rings){ const pts=g.map(m); const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]); const cx=xs.reduce((a,b)=>a+b)/xs.length, cy=ys.reduce((a,b)=>a+b)/ys.length;
      if(Math.hypot(cx-c[0],cy-c[1])>r*1.3) continue;
      const col=t.barrier?'#c00':t.bridge?'#06c':t.natural?'#8cf':'#ddd';
      s+=`<polygon points="${pts.map(p=>P(p).join(',')).join(' ')}" fill="${t.barrier||t.bridge&&!t.building?'none':col}" stroke="${t.barrier?'#c00':'#333'}" stroke-width="1"/>`;
      const q=P([cx,cy]); s+=`<text x="${q[0]}" y="${q[1]}" font-size="9" text-anchor="middle" fill="#00a">${String(e.id).slice(-4)}</text>`;
      out.push(`${e.type[0]}${e.id} c=${cx.toFixed(0)},${cy.toFixed(0)} ${(Math.max(...xs)-Math.min(...xs)).toFixed(0)}x${(Math.max(...ys)-Math.min(...ys)).toFixed(0)} ${t.name||''} ${t.building||''} ${t.amenity||''} h=${t.height||''} lv=${t['building:levels']||''}`);
    }}
  const q=P(c); s+=`<circle cx="${q[0]}" cy="${q[1]}" r="5" fill="red"/><line x1="20" y1="880" x2="${20+20*sc}" y2="880" stroke="#000" stroke-width="3"/><text x="20" y="870" font-size="12">20 m</text></svg>`;
  fs.writeFileSync(`plan/${k}.svg`,s); fs.writeFileSync(`plan/${k}.txt`,out.join('\n'));
}
