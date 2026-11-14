import fs from 'fs'; import path from 'path';
const OUT=process.argv[2]; const idx=JSON.parse(fs.readFileSync(path.join(OUT,'indice.json'),'utf8'));
const lon0=11.7345,lat0=45.7665,K=111320*Math.cos(lat0*Math.PI/180);
const storie=fs.readdirSync(path.join(OUT,'../../content/luoghi')).map(f=>f.replace('.json',''));
const fixed='ponte-vecchio, brenta, nardini-basso, nardini-alto, bolle-nardini, museo-grappa-poli, grappa, king-kong-rhino, museo-civico, palazzo-sturm, palazzo-bonaguro, castello-ezzelini, torre-civica-piazze, mura-porte, viale-dei-martiri, tempio-ossario, monte-grappa, bassano-2029'.split(', ');
let ok=true; const items=[];
for(const l of idx){
  const keys=Object.keys(l).sort().join(); if(keys!=='ancora,file,id,larghezzaMetri,lat,lon,nome,storia'){ok=false;console.log('KEYS',l.id,keys);}
  const svg=fs.readFileSync(path.join(OUT,l.file),'utf8');
  const bad=/<text|<script|href|<image|<style|Gradient|url\(/.test(svg); const vb=svg.match(/viewBox="([-\d. ]+)"/)[1].split(' ').map(Number);
  const inRiq=l.lon>11.7&&l.lon<11.768&&l.lat>45.736&&l.lat<45.792;
  if(bad||!fixed.includes(l.storia)||!inRiq||svg.length>25600||l.ancora.some(v=>v<0||v>1)) {ok=false;console.log('PROBLEM',l.id,{bad,storia:l.storia,inRiq,size:svg.length});}
  const x=(l.lon-lon0)*K,y=(l.lat-lat0)*110574; const sx=(x-y)*0.7071, sy=-(x+y)*0.35355; const w=l.larghezzaMetri, h=w*vb[3]/vb[2];
  items.push({l,svg,x:sx-l.ancora[0]*w,y:sy-l.ancora[1]*h,w,h,d:x+y,sx,sy});
  console.log(l.id.padEnd(18),svg.length,'B  metri',x.toFixed(1),y.toFixed(1),'storia',l.storia, storie.includes(l.storia)?'(file storia presente)':'(file storia non ancora presente)');
}
console.log(ok?'INDICE OK':'INDICE CON PROBLEMI');
// composizione di prova della zona del ponte
const grp=items.filter(i=>['ponte-vecchio','nardini-basso','palazzo-sturm','king-kong-rhino'].includes(i.l.id)).sort((a,b)=>b.d-a.d);
const x0=Math.min(...grp.map(g=>g.x))-5,y0=Math.min(...grp.map(g=>g.y))-5,x1=Math.max(...grp.map(g=>g.x+g.w))+5,y1=Math.max(...grp.map(g=>g.y+g.h))+5;
let s=`<svg xmlns="http://www.w3.org/2000/svg" width="1000" viewBox="${x0} ${y0} ${x1-x0} ${y1-y0}"><rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="#f6ecd6"/>`;
for(const g of grp){ s+=g.svg.replace('<svg ',`<svg x="${g.x}" y="${g.y}" `).replace(/width="\d+" height="\d+"/,`width="${g.w}" height="${g.h}"`); s+=`<circle cx="${g.sx}" cy="${g.sy}" r=".6" fill="red"/>`; }
fs.writeFileSync('compo.svg',s+'</svg>');
