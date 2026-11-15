// Ponte Vecchio (Ponte degli Alpini): genera public/landmarks/ponte-vecchio.svg.
// Uso: node scripts/landmark/luoghi/ponte-vecchio.mjs [file di uscita]
//
// Misure. Impronta OSM (way 145926592, building=roof): 74 x 10.1 m, asse a 91.8 gradi da nord,
// centro in metri locali (-262.9, 112.4) = lat 45.767517, lon 11.731115 (ancora del disegno).
// Il Brenta in public/data/base.json va, lungo l'asse, da 27.5 m a ovest a 34.5 m a est del
// centro: le cinque campate (12.4 m) e le quattro stilate stanno li' dentro; il resto della
// copertura poggia sulle spalle in pietra. Impalcato largo 8.6 m, gronde a 0.7 m (tetto 10 m).
// Altezze: la mappa e' piatta (fiume e strade a quota 0), l'impalcato sta a 5.2 m sull'acqua;
// colonne fino a 4.5 m sul piano (un po' piu' del vero, per far leggere i lati aperti).
//
// Licenza dichiarata: da sud-ovest, attraverso il colonnato sud, si vedrebbe solo il piano di
// calpestio. Qui invece ogni campata del colonnato mostra, dal basso: una lama di selciato, il
// parapetto nord, le colonne nord con dei VUOTI trasparenti tra una e l'altra (sulla mappa ci
// passa il verde del Brenta), l'intradosso scuro del tetto. Per questo sotto l'impalcato si
// disegna solo cio' che l'impalcato non nasconderebbe: niente deve finire dietro i vuoti.
import fs from 'fs';

// Il motore qui sotto ricalca Scene di ../iso.mjs (stessa proiezione, stessa scala, stesso
// involucro SVG). E' copiato e non importato perche' iso.mjs carica geo.mjs, che all'avvio
// legge scripts/landmark/osm.json: senza quel file l'import fallisce.
const S = 4, SEP = '#5b4636';
const P = (x, y, z = 0) => [(x - y) * 0.7071 * S, (-(x + y) * 0.35355 - z * 0.8165) * S];
const f1 = (n) => { let s = n.toFixed(1); if (s.endsWith('.0')) s = s.slice(0, -2); return s === '-0' ? '0' : s; };
function hull(pp) {
  const p = [...pp].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const k of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], k) <= 0) lo.pop(); lo.push(k); }
  const up = []; for (const k of p.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], k) <= 0) up.pop(); up.push(k); }
  lo.pop(); up.pop(); return lo.concat(up);
}
class Scene {
  constructor() { this.s = []; this.sh = []; this.mn = [1e9, 1e9]; this.mx = [-1e9, -1e9]; }
  solid(_, fn) { fn(); }
  reg(k) { for (let i = 0; i < 2; i++) { if (k[i] < this.mn[i]) this.mn[i] = k[i]; if (k[i] > this.mx[i]) this.mx[i] = k[i]; } }
  d2(pts2, open) { let d = ''; pts2.forEach((k, i) => { this.reg(k); d += (i ? 'L' : 'M') + f1(k[0]) + ' ' + f1(k[1]); }); return d + (open ? '' : 'Z'); }
  path(pts3, fill, o = {}) {
    let at = ` fill="${fill}"`;
    if (o.stroke) at += ` stroke="${o.stroke}"`;
    if (o.sw != null) at += ` stroke-width="${o.sw}"`;
    if (o.op != null) at += ` fill-opacity="${o.op}"`;
    if (o.sop != null) at += ` stroke-opacity="${o.sop}"`;
    const d = this.d2(pts3.map((p) => P(p[0], p[1], p[2] || 0)), o.open), l = this.s[this.s.length - 1];
    if (o.batch && l && l.batch && l.a === at) l.d += d; else this.s.push({ d, a: at, batch: o.batch });
  }
  line(pts3, o = {}) { this.path(pts3, 'none', { open: true, ...o }); }
  shadow(poly, h) { const k = Math.min(h, 26) * 0.42, off = [-0.8 * k, 0.38 * k]; this.sh.push(hull(poly.concat(poly.map((p) => [p[0] + off[0], p[1] + off[1]])))); }
  svg() {
    const pad = 4, x0 = Math.floor(this.mn[0] - pad), y0 = Math.floor(this.mn[1] - pad);
    const w = Math.ceil(this.mx[0] + pad) - x0, h = Math.ceil(this.mx[1] + pad) - y0;
    const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" width="${w}" height="${h}">\n` +
      `<g stroke="${SEP}" stroke-width=".8" stroke-linejoin="round" stroke-linecap="round">\n` +
      this.s.map((e) => `<path d="${e.d}"${e.a}/>`).join('\n') + '\n</g>\n</svg>\n';
    return { svg: out, w, h, ancora: [+((0 - x0) / w).toFixed(4), +((0 - y0) / h).toFixed(4)], larghezzaMetri: +(w / S).toFixed(1) };
  }
}

const OUT = process.argv[2] || new URL('../../../public/landmarks/ponte-vecchio.svg', import.meta.url).pathname;

const ANG = 91.8, L = 74, W = 8.6, GRONDA = 0.7, H = W / 2;
const ACQUA_O = -27.5, ACQUA_E = 34.5, N_CAMPATE = 5;
const Z_TRAVE = 4.3, Z_PIANO = 5.2, Z_PARAPETTO = 6.3, Z_ARCHITRAVE = 9.7, Z_GRONDA = 10.05, Z_COLMO = 11.95;
const K = 0.866; // un metro verso nord copre, sullo schermo, 0.866 m di quota

const LEGNO = ['#8f4330', '#5e2a20'], MEZZO = '#763625', NERO = '#45221a', LUCE = '#b5604a';
const COTTO = ['#d0704a', '#c4623c'], COTTO_OMBRA = '#a44e33', COLMO = '#de8358', RIGA = '#a8502f';
const PIETRA = ['#d8c7a3', '#bba680'], SELCIATO = '#b89270', LONTANO = '#a9826a', PARAPETTO_N = '#8a5a45';
const ACQUA = '#7fb8ad', ACQUA_CHIARA = '#c4e3da', OMBRA = '#3d3a2c';

const a = (ANG * Math.PI) / 180, U = [Math.sin(a), Math.cos(a)], V = [Math.cos(a), -Math.sin(a)];
/** s lungo l'asse verso est, t di traverso verso sud (valle), z quota. */
const q = (s, t, z = 0) => [U[0] * s + V[0] * t, U[1] * s + V[1] * t, z];
const sc = new Scene();
const sud = (s0, s1, z0, z1, t = H) => [q(s0, t, z0), q(s1, t, z0), q(s1, t, z1), q(s0, t, z1)];
const ovest = (s, t0, t1, z0, z1) => [q(s, t0, z0), q(s, t1, z0), q(s, t1, z1), q(s, t0, z1)];
const fine = { sw: 0.4, sop: 0.6, batch: true };
const piatto = { stroke: 'none', batch: true };

const campata = (ACQUA_E - ACQUA_O) / N_CAMPATE;
const pile = [1, 2, 3, 4].map((i) => ACQUA_O + i * campata).reverse(); // da est (lontano) a ovest

// ---- acqua: lo stesso verde del Brenta della mappa (li' non si vede, da solo fa capire il fiume)
sc.path([q(ACQUA_O, -7), q(ACQUA_E, -7), q(ACQUA_E, 11.5), q(ACQUA_O, 11.5)], ACQUA, { stroke: 'none' });
// ---- ombra sotto l'impalcato, una sola, solo sull'acqua
sc.path([q(ACQUA_O, -3), q(ACQUA_E, -3), q(ACQUA_E, H + 1.6), q(ACQUA_O, H + 1.6)], OMBRA, { stroke: 'none', op: 0.28 });

// faccia ovest di un corpo sotto l'impalcato: solo il triangolo che l'impalcato non copre
const sottoOvest = (s, t1, fill, o, tavole) => {
  sc.path([q(s, t1, 0), q(s, t1, Z_TRAVE), q(s, t1 - Z_TRAVE / K, 0)], fill, o);
  if (tavole) for (const z of [0.85, 1.7, 2.55, 3.4]) sc.line([q(s, t1, z), q(s, t1 - (Z_TRAVE - z) / K, z)], { ...fine, stroke: NERO, sop: 0.8 });
};

// ---- spalle in pietra, a conci sfalsati
const spalla = (s0, s1, testata) => {
  const t1 = H + 0.4;
  if (testata) sc.path(ovest(s0, -t1, t1, 0, Z_TRAVE), PIETRA[1]); else sottoOvest(s0, t1, '#9c8a6a');
  sc.path(sud(s0, s1, 0, Z_TRAVE, t1), PIETRA[0]);
  const corsi = [1.05, 2.1, 3.15];
  for (const z of corsi) sc.line(testata ? [q(s0, -t1, z), q(s0, t1, z), q(s1, t1, z)] : [q(s0, t1, z), q(s1, t1, z)], { ...fine, sop: 0.4 });
  [0, ...corsi].forEach((z, i) => {
    for (let s = s0 + (i % 2 ? 1.3 : 2.5); s < s1 - 0.5; s += 2.6) sc.line([q(s, t1, z), q(s, t1, z + 1.05)], { ...fine, sop: 0.4 });
    if (testata) for (let t = -t1 + (i % 2 ? 1.6 : 3); t < t1 - 0.5; t += 2.8) sc.line([q(s0, t, z), q(s0, t, z + 1.05)], { ...fine, sop: 0.4 });
  });
};
spalla(ACQUA_E, L / 2, false);

// ---- stilate: corpo di pali fino alle travi, saette a ventaglio dai due lati, rostro a valle
const saetta = (s, k, d, z0) => sc.path([q(s + k * 0.3, H, z0 - 0.2), q(s + k * 0.3, H, z0 + 0.3), q(s + k * (d - 0.35), H, Z_TRAVE), q(s + k * (d + 0.35), H, Z_TRAVE)], MEZZO, { sw: 0.45 });
for (const s of pile) {
  const hb = 1.5, ht = 0.55, c = 4.9, zc = 3.3; // semilarghezze alla base e in testa, sporto e quota del rostro
  sottoOvest(s - ht, H, '#4d2219', { sw: 0.5 });
  // corpo: faccia sud sopra il rostro, con i pali
  sc.path(sud(s - ht, s + ht, 0, Z_TRAVE), LEGNO[0], { sw: 0.5 });
  sc.line([q(s, H, zc), q(s, H, Z_TRAVE)], { ...fine, stroke: NERO });
  for (const k of [-1, 1]) { saetta(s, k, 3.9, 0.9); saetta(s, k, 2.1, 2.5); }
  // rostro a valle: fianco ovest inclinato a tavole, dorso in luce
  const A = q(s - hb, H, 0), B = q(s, H + c, 0), T0 = q(s - ht, H, zc), T1 = q(s + ht, H, zc);
  const m = (p0, p1, k) => [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k, p0[2] + (p1[2] - p0[2]) * k];
  sc.path([A, B, T0], MEZZO, { sw: 0.6 });
  for (const k of [0.2, 0.4, 0.6, 0.8]) sc.line([m(A, T0, k), m(B, T0, k)], { ...fine, stroke: NERO, sop: 0.75 });
  sc.path([T0, B, T1], LUCE, { sw: 0.6 });
  // increspature a valle della punta
  for (const [ds, dt, len] of [[-1.5, 0.9, 1.6], [0.3, 1.7, 2.2], [1.6, 0.6, 1.3]]) sc.line([q(s + ds, H + c + dt), q(s + ds + len, H + c + dt)], { stroke: ACQUA_CHIARA, sw: 0.7, batch: true });
}
spalla(-L / 2, ACQUA_O, true);

// ---- impalcato: fascia delle travi
sc.path(ovest(-L / 2, -H, H, Z_TRAVE, Z_PIANO), LEGNO[1]);
sc.path(sud(-L / 2, L / 2, Z_TRAVE, Z_PIANO), MEZZO);
for (let s = -L / 2 + 0.9; s < L / 2; s += 1.55) sc.path(sud(s - 0.2, s + 0.2, Z_TRAVE + 0.12, Z_TRAVE + 0.5), NERO, piatto);

// ---- testata ovest: dal portale si vedono il selciato e, in fondo, il parapetto e le colonne a nord
const dv = (Z_ARCHITRAVE - Z_PIANO) / K;
sc.path([q(-L / 2, -H, Z_PIANO), q(-L / 2, H, Z_PIANO), q(-L / 2 + dv, H - dv, Z_PIANO), q(-L / 2 + dv, -H, Z_PIANO)], '#8f6f58', { stroke: 'none' });
sc.path(sud(-L / 2, -L / 2 + 5, Z_PIANO, Z_PARAPETTO, -H), PARAPETTO_N, { sw: 0.4 });
for (const s of [-L / 2 + 0.3, -L / 2 + 3.3]) sc.path(sud(s - 0.2, s + 0.2, Z_PARAPETTO, Z_ARCHITRAVE, -H), LEGNO[1], { sw: 0.3 });

// ---- lato sud: cio' che si vede tra le colonne (vedi la licenza in testa al file)
const colS = []; for (let k = -3; k <= 20; k++) colS.push(ACQUA_O + (k * campata) / 4);
colS[0] = -L / 2 + 0.32; colS.push(L / 2 - 0.32);
const Z_VUOTO0 = 7.1, Z_VUOTO1 = 8.6;
sc.path(sud(-L / 2, L / 2, Z_PARAPETTO, Z_PARAPETTO + 0.22), SELCIATO, { stroke: 'none' });
sc.path(sud(-L / 2, L / 2, Z_PARAPETTO + 0.22, Z_VUOTO0), PARAPETTO_N, { stroke: 'none' });
sc.line([q(-L / 2, H, Z_VUOTO0), q(L / 2, H, Z_VUOTO0)], { sw: 0.35, stroke: NERO, sop: 0.7 });
sc.path(sud(-L / 2, L / 2, Z_VUOTO1, Z_ARCHITRAVE), LEGNO[1], { stroke: 'none' });
for (let i = 0; i < colS.length - 1; i++) { const s = colS[i] + (colS[i + 1] - colS[i]) * 0.42; sc.path(sud(s - 0.17, s + 0.17, Z_VUOTO0, Z_VUOTO1), LONTANO, piatto); }

// ---- parapetto a balaustri, dritto da un capo all'altro
sc.path(sud(-L / 2, L / 2, Z_PIANO, Z_PARAPETTO), LEGNO[1], { sw: 0.5 });
for (let s = -L / 2 + 0.45; s < L / 2 - 0.3; s += 0.62) sc.path(sud(s - 0.14, s + 0.14, Z_PIANO + 0.2, Z_PARAPETTO - 0.22), LEGNO[0], piatto);
sc.path(sud(-L / 2, L / 2, Z_PARAPETTO - 0.22, Z_PARAPETTO), LUCE, { sw: 0.4 });

// ---- colonne: fusto dritto, base e capitello; una sopra ogni stilata, quattro interassi per campata
for (const s of colS) {
  sc.path(sud(s - 0.34, s + 0.34, Z_PIANO, Z_PARAPETTO + 0.24), LEGNO[0], { sw: 0.4 }); // piedistallo nel parapetto
  sc.path(sud(s - 0.23, s + 0.23, Z_PARAPETTO + 0.24, Z_ARCHITRAVE - 0.24), LEGNO[1], { sw: 0.4, batch: true });
}
for (const s of colS) sc.path(sud(s + 0.05, s + 0.23, Z_PARAPETTO + 0.24, Z_ARCHITRAVE - 0.24), LEGNO[0], piatto);
for (const s of colS) sc.path(sud(s - 0.36, s + 0.36, Z_ARCHITRAVE - 0.24, Z_ARCHITRAVE), LEGNO[0], { sw: 0.4, batch: true });

// ---- testata ovest: stipiti del portale
sc.path(ovest(-L / 2, -H, -H + 0.55, Z_PIANO, Z_ARCHITRAVE), LEGNO[1], { sw: 0.5 });
sc.path(ovest(-L / 2, H - 0.55, H, Z_PIANO, Z_ARCHITRAVE), LEGNO[1], { sw: 0.5 });

// ---- architrave
sc.path(ovest(-L / 2, -H, H, Z_ARCHITRAVE, Z_GRONDA), LEGNO[1]);
sc.path(sud(-L / 2, L / 2, Z_ARCHITRAVE, Z_GRONDA), MEZZO);

// ---- tetto a due falde in coppi
const g = GRONDA, r0 = -L / 2 - g, r1 = L / 2 + g, te = H + g, zg = Z_GRONDA - 0.1;
const falda = (k) => [te * (1 - k), zg + (Z_COLMO - zg) * k]; // k = 0 gronda sud, 1 colmo
// timpano ovest con la capriata
sc.path([q(-L / 2, -H, Z_GRONDA), q(-L / 2, H, Z_GRONDA), q(-L / 2, 0, Z_COLMO - 0.3)], MEZZO);
sc.line([q(-L / 2, 0, Z_GRONDA), q(-L / 2, 0, Z_COLMO - 0.4)], { sw: 0.7, stroke: NERO });
for (const k of [-1, 1]) sc.line([q(-L / 2, 0, Z_GRONDA), q(-L / 2, k * 2.2, Z_GRONDA + 0.95)], { sw: 0.6, stroke: NERO });
// falda nord (se ne vede un filo oltre il colmo)
sc.path([q(r0, -te, zg), q(r1, -te, zg), q(r1, 0, Z_COLMO), q(r0, 0, Z_COLMO)], COTTO_OMBRA);
// spessore della gronda sud e bordo ovest
sc.path([q(r0, te, zg - 0.32), q(r1, te, zg - 0.32), q(r1, te, zg), q(r0, te, zg)], LEGNO[1], { sw: 0.5 });
sc.path([q(r0, te, zg - 0.32), q(r0, te, zg), q(r0, 0, Z_COLMO), q(r0, -te, zg), q(r0, -te, zg - 0.32), q(r0, 0, Z_COLMO - 0.32)], LEGNO[1], { sw: 0.5 });
// falda sud in due toni
sc.path([q(r0, te, zg), q(r1, te, zg), q(r1, 0, Z_COLMO), q(r0, 0, Z_COLMO)], COTTO[1]);
{ const [t5, z5] = falda(0.5); sc.path([q(r0, t5, z5), q(r1, t5, z5), q(r1, 0, Z_COLMO), q(r0, 0, Z_COLMO)], COTTO[0], { stroke: 'none' }); }
// corsi di coppi paralleli al colmo
for (const k of [0.14, 0.28, 0.42, 0.56, 0.7, 0.84]) { const [t, z] = falda(k); sc.line([q(r0, t, z), q(r1, t, z)], { sw: 0.35, stroke: RIGA, sop: 0.75, batch: true }); }
sc.line([q(r0, te, zg), q(r1, te, zg), q(r1, 0, Z_COLMO), q(r0, 0, Z_COLMO), q(r0, te, zg)], {});
// colmo: una sola linea chiara
sc.line([q(r0 + 0.2, 0.12, Z_COLMO - 0.02), q(r1 - 0.2, 0.12, Z_COLMO - 0.02)], { sw: 0.9, stroke: COLMO });

const r = sc.svg();
fs.writeFileSync(OUT, r.svg);
console.log(JSON.stringify({ file: OUT, bytes: r.svg.length, w: r.w, h: r.h, ancora: r.ancora, larghezzaMetri: r.larghezzaMetri }));
