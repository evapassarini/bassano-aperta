// King Kong Rhino (Li-Jen Shih) sulla terrazza di Palazzo Sturm.
// Rigenera public/landmarks/king-kong-rhino.svg:  node scripts/landmark/luoghi/king-kong-rhino.mjs
// (un argomento facoltativo = percorso di uscita alternativo, per le prove)
//
// Il rinoceronte guarda a ovest, verso il Brenta: l'asse lungo segue l'asse est-ovest della
// mappa (pendenza 1:2), il muso scende in basso a sinistra, si vede il fianco sud (in luce).
// Corpo e testa sono un profilo (u = avanti, z = su) ripetuto a fette lungo la larghezza
// (v = verso sud): le fette lontane spuntano sopra le vicine e fanno la schiena che riflette
// il cielo. Misure reali in metri, poi ingrandite di K perche' si legga come luogo simbolo.
import fs from 'fs';
// Stesse costanti di ../iso.mjs, ricopiate: iso.mjs importa geo.mjs, che all'avvio legge
// scripts/landmark/osm.json (non versionato), e senza quel file non si carica.
const S = 4; // unita' SVG per metro isometrico
const SEP = '#5b4636';
const P = (x, y, z = 0) => [(x - y) * 0.7071 * S, (-(x + y) * 0.35355 - z * 0.8165) * S];

const K = 1.5;            // ingrandimento rispetto al vero
const U0 = -0.55;         // il centro del basamento sta sull'ancora
// u avanti = ovest, v = sud
const W = (u, v, z) => P(-K * (u - U0), -K * v, K * z);

// acciaio a specchio: cielo in alto, linea scura d'orizzonte, terrazza calda riflessa in basso
const C = {
  glint: '#ffffff', sky: '#f4f9fc', hi: '#dbe8f1', mid: '#bcd0df', far: '#8fa6b8', shade: '#7f96a8',
  hor: '#55697a', warm: '#b9a98e', warm2: '#8e8474', deep: '#4a5b69',
};
const PIETRA = { top: '#efe6d2', lit: '#dccfb4', sh: '#c2b193' };
const OUT = 0.5, IN = 0.28; // contorno esterno e giunture interne

const f1 = (n) => { let s = n.toFixed(1); if (s.endsWith('.0')) s = s.slice(0, -2); return s === '-0' ? '0' : s; };
let mn = [1e9, 1e9], mx = [-1e9, -1e9];
const out = [];
const reg = (q) => { for (let i = 0; i < 2; i++) { mn[i] = Math.min(mn[i], q[i]); mx[i] = Math.max(mx[i], q[i]); } };
const dOf = (pts, open) => pts.map((q, i) => { reg(q); return (i ? 'L' : 'M') + f1(q[0]) + ' ' + f1(q[1]); }).join('') + (open ? '' : 'Z');
function put(d, fill, o = {}) {
  let s = `<path d="${d}" fill="${fill}"`;
  if (o.stroke) s += ` stroke="${o.stroke}"`;
  if (o.sw != null) s += ` stroke-width="${o.sw}"`;
  if (o.op != null) s += ` fill-opacity="${o.op}"`;
  out.push(s + '/>');
}
const NS = { stroke: 'none' };
/** Poligono (u,z) disegnato sul piano verticale a distanza v dall'asse. */
let DZ = 0; // alzata della parte che si sta disegnando (corpo e testa stanno piu' su delle misure di base)
const flat = (uz, v, fill, o = {}) => put(dOf(uz.map((p) => W(p[0], v, p[1] + DZ)), o.open), fill, o);
const poly3 = (pts, fill, o = {}) => put(dOf(pts.map((p) => W(p[0], p[1], p[2])), o.open), fill, o);

/** Curva chiusa o aperta di Catmull-Rom campionata a segmenti. */
function cr(pts, closed = true, n = 5) {
  const N = pts.length, res = [];
  const g = (i) => (closed ? pts[(i + N) % N] : pts[Math.max(0, Math.min(N - 1, i))]);
  for (let i = 0; i < (closed ? N : N - 1); i++) {
    const [a, b, c, d] = [g(i - 1), g(i), g(i + 1), g(i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      res.push([0, 1].map((j) => 0.5 * (2 * b[j] + (c[j] - a[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (3 * b[j] - a[j] - 3 * c[j] + d[j]) * t3)));
    }
  }
  if (!closed) res.push(pts[N - 1]);
  return res;
}
/** Parte del poligono (u,z) sotto la retta z = z0 + m * u. */
function sotto(pg, z0, m = 0) {
  const f = (p) => z0 + m * p[0] - p[1], res = [];
  for (let i = 0; i < pg.length; i++) {
    const a = pg[i], b = pg[(i + 1) % pg.length], fa = f(a), fb = f(b);
    if (fa >= 0) res.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); res.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return res;
}
/** Fasce cromate dentro un profilo: orizzonte scuro, riflesso caldo, fondo scuro. */
function fasce(pg, v, zh, m = 0, zb = null) {
  flat(sotto(pg, zh + 0.2, m), v, C.hor, NS);
  flat(sotto(pg, zh, m), v, C.warm, NS);
  flat(sotto(pg, zh - 0.42, m), v, C.warm2, NS);
  if (zb != null) flat(sotto(pg, zb, m), v, C.deep, NS);
}

// ------------------------------------------------------------------ misure (metri veri)
const BW = 0.75;
const LZ = 0.4;   // quanto il corpo sta sollevato sulle zampe
const HZ = 0.6;   // la testa e' portata alta, il muso quasi orizzontale  // mezza larghezza del corpo
const TW = 0.5;   // mezza larghezza della testa
// profilo del corpo, in senso orario dalla groppa: groppa pesante, sella, gobba della spalla, pancia bassa
const corpoPts = [[-3.1, 1.5], [-3.38, 2.05], [-3.05, 2.72], [-2.2, 3.0], [-0.8, 2.66], [0.6, 3.3], [1.65, 3.05], [2.15, 2.55], [2.15, 1.85], [1.7, 1.4], [0, 1.18], [-2.0, 1.3]];
const corpo = cr(corpoPts, true, 4);
const testaPts = [[2.0, 3.2], [2.5, 3.24], [3.05, 2.9], [3.6, 2.52], [3.9, 2.16], [3.82, 1.76], [3.2, 1.55], [2.5, 1.6], [1.95, 1.95], [1.85, 2.6]];
const testa = cr(testaPts, true, 4);
// fetta a distanza t (-1 lato nord .. 1 lato sud): il profilo si stringe verso i fianchi
const fetta = (prof, t, c, kz = 0.42, ku = 0.07) => prof.map(([u, z]) => [c[0] + (u - c[0]) * (1 - ku * t * t), c[1] + (z - c[1]) * Math.sqrt(1 - kz * t * t)]);
const CC = [-0.6, 2.1], CT = [2.9, 2.4];

/** Corpo a fette: contorno sotto, poi le fette dalla piu' lontana; il "petto" e' la superficie davanti. */
function volume(prof, c, hw, ts, cols, fronte, kz) {
  const sl = ts.map((t) => fetta(prof, t, c, kz).map(([u, z]) => W(u, t * hw, z + DZ)));
  put(sl.map((s) => dOf(s)).join(''), 'none', { sw: OUT * 2 });
  sl.forEach((s, i) => { if (i < sl.length - 1) put(dOf(s), cols[i], NS); });
  // superficie rivolta a ovest (in ombra), tra la fetta lontana e la vicina
  const [i0, i1] = fronte;
  const fr = (t) => fetta(prof, t, c, kz).slice(i0, i1 + 1).map(([u, z]) => W(u, t * hw, z + DZ));
  put(dOf(fr(-1).concat(fr(1).reverse())), C.shade, NS);
  put(dOf(sl[sl.length - 1]), cols[cols.length - 1], NS);
  return fetta(prof, 1, c, kz);
}

// ------------------------------------------------------------------ basamento e ombre
const PU = [-3.45, 2.9], PV = 1.3, PH = 0.4;
{
  // ombra a terra: piccola, verso nord-ovest (la luce viene da sud-est)
  const o = [0.4, -0.4], e = 0.1;
  const g = [[PU[0] - e, PV], [PU[1], PV + e], [PU[1] + e + o[0], PV + o[1]], [PU[1] + e + o[0], -PV + o[1]], [PU[1] + o[0], -PV - e + o[1]], [PU[0] + o[0], -PV - e + o[1]], [PU[0] - e, -PV + o[1] * 0.4]];
  poly3(g.map(([u, v]) => [u, v, 0]), '#543e2a', { op: 0.19, stroke: 'none' });
}
poly3([[PU[0], -PV, PH], [PU[1], -PV, PH], [PU[1], PV, PH], [PU[0], PV, PH]], PIETRA.top, { sw: OUT });
poly3([[PU[0], PV, PH], [PU[1], PV, PH], [PU[1], PV, 0], [PU[0], PV, 0]], PIETRA.lit, { sw: OUT });
poly3([[PU[1], -PV, PH], [PU[1], PV, PH], [PU[1], PV, 0], [PU[1], -PV, 0]], PIETRA.sh, { sw: OUT });
// ombra del corpo sul piano del basamento
{
  const g = cr([[-3.1, 0.2], [-1.5, 0.75], [1.4, 0.75], [2.2, 0.2], [2.3, -0.7], [0.5, -1.1], [-2.5, -1.1], [-3.3, -0.5]], true, 3);
  poly3(g.map(([u, v]) => [Math.max(PU[0], Math.min(PU[1], u)), v, PH]), '#543e2a', { op: 0.2, stroke: 'none' });
}

// ------------------------------------------------------------------ zampe
const ZA = 1.1, ZP = -2.3; // centro delle zampe davanti e dietro
const colonna = (c, zt) => [[c - 0.56, zt], [c + 0.6, zt], [c + 0.5, 0.85], [c + 0.56, 0.4], [c + 0.72, 0.12], [c + 0.72, PH - 0.4 + 0.0], [c - 0.64, 0], [c - 0.64, 0.14], [c - 0.52, 0.45], [c - 0.5, 0.85]].map(([u, z]) => [u, z + PH]);
/** Zampa come colonna: faccia a ovest in ombra, faccia a sud con le fasce cromate. */
function zampa(prof, v0, v1, base, lontana) {
  const fr = [[prof[2][0] + 0.04, PH + 1.3]].concat(prof.slice(2, 6)); // spigolo davanti, dall'alto al piede
  put(dOf(fr.map(([u, z]) => W(u, v0, z)).concat(fr.map(([u, z]) => W(u, v1, z)).reverse())), lontana ? C.hor : C.shade, { sw: OUT });
  flat(prof, v1, base, { sw: OUT });
  fasce(prof, v1, PH + 0.62, 0, PH + 0.13);
  flat(prof, v1, 'none', { sw: OUT });
}
// lato lontano (nord): un tono piu' scuro, ben visibili dietro
zampa(colonna(ZP, 1.9), -0.72, -0.1, C.far, true);
zampa(colonna(ZA, 1.9), -0.72, -0.1, C.far, true);

// ------------------------------------------------------------------ corpo
DZ = LZ;
const fianco = volume(corpo, CC, BW, [-1, -0.5, 0, 0.33, 0.66, 1], [C.hi, C.sky, C.sky, C.glint, C.hi, C.mid], [27, 37], 0.3);
fasce(fianco, BW, 1.72, 0.03, 1.42);
// codino sottile, appoggiato alla groppa
flat([[-3.14, 2.5], [-3.0, 2.54], [-3.04, 1.8], [-3.14, 1.7]], BW, C.far, { sw: IN });
// giunture della corazza che scavalcano la schiena
{
  const top = (u) => { for (let i = 0; i < corpo.length; i++) { const a = corpo[i], b = corpo[(i + 1) % corpo.length]; if (a[0] <= u && b[0] > u) return a[1] + ((b[1] - a[1]) * (u - a[0])) / (b[0] - a[0]); } };
  for (const u of [-1.35, -0.05]) {
    const z = top(u);
    const g = [0, 0.33, 0.66, 1].map((t) => { const [q] = fetta([[u, z]], t, CC, 0.3); return W(q[0], t * BW, q[1] + DZ); });
    const [q] = fetta([[u + 0.1, 1.45]], 1, CC, 0.3); g.push(W(q[0], BW, q[1] + DZ));
    put(dOf(g, true), 'none', { sw: IN });
  }
}
flat(fianco, BW, 'none', { sw: IN });

// ------------------------------------------------------------------ zampe vicine con lo scudo di spalla e di coscia
function scudo(c, dome) {
  DZ = 0;
  const v = BW + 0.05;
  const col = colonna(c, 1.75);
  const prof = cr(dome.map(([u, z]) => [u, z + LZ]), false, 4).concat(col.slice(2, 10));
  const fr = [[col[2][0] + 0.04, PH + 1.25]].concat(col.slice(2, 6));
  put(dOf(fr.map(([u, z]) => W(u, v - 0.55, z)).concat(fr.map(([u, z]) => W(u, v, z)).reverse())), C.shade, { sw: OUT });
  flat(prof, v, C.mid, { sw: OUT });
    fasce(prof, v, PH + 0.62, 0, PH + 0.13);
  flat(prof, v, 'none', { sw: OUT });
  return v;
}
{
  const v = scudo(ZP, [[ZP - 0.5, 1.3], [ZP - 0.7, 1.8], [ZP - 0.5, 2.25], [ZP + 0.05, 2.45], [ZP + 0.6, 2.25], [ZP + 0.75, 1.8], [ZP + 0.5, 1.3]]);
  DZ = LZ;
  flat([[ZP - 0.42, 2.12], [ZP + 0.02, 2.33], [ZP + 0.4, 2.22], [ZP - 0.05, 2.08]], v, C.glint, NS);
}
{
  const v = scudo(ZA, [[ZA - 0.5, 1.3], [ZA - 0.72, 1.85], [ZA - 0.52, 2.35], [ZA + 0.05, 2.6], [ZA + 0.6, 2.35], [ZA + 0.75, 1.85], [ZA + 0.5, 1.3]]);
  DZ = LZ;
  flat([[ZA - 0.42, 2.2], [ZA + 0.02, 2.46], [ZA + 0.42, 2.3], [ZA - 0.05, 2.18]], v, C.glint, NS);
}

// ------------------------------------------------------------------ testa
// orecchio lontano, dietro il cranio
DZ = HZ;
const orecchio = (v, c1) => flat(cr([[2.05, 3.1], [2.0, 3.55], [2.22, 3.95], [2.5, 3.5], [2.55, 3.1]], false, 3), v, c1, { sw: OUT });
orecchio(-0.42, C.shade);
const guancia = volume(testa, CT, TW, [-1, -0.5, 0, 0.5, 1], [C.hi, C.sky, C.sky, C.hi, C.mid], [11, 21], 0.4);
flat(sotto(guancia, 2.1, 0.02), TW, C.hor, NS);
flat(sotto(guancia, 1.93, 0.02), TW, C.warm, NS);
flat([[2.85, 2.7], [3.3, 2.46], [3.34, 2.34], [2.9, 2.56]], TW, C.glint, NS);              // lampo sulla guancia
flat(cr([[2.42, 2.78], [2.56, 2.88], [2.68, 2.78], [2.54, 2.68]], true, 3), TW, SEP, NS);    // occhio
flat([[2.52, 2.84], [2.6, 2.84], [2.6, 2.78], [2.52, 2.78]], TW, C.glint, NS);
flat([[3.82, 1.95], [3.4, 1.9], [3.05, 1.98]], TW, 'none', { sw: IN, open: true });         // bocca
flat(guancia, TW, 'none', { sw: IN });
orecchio(0.42, C.mid);
// corno piccolo, sul dorso del naso, subito dietro il grande
flat([[2.56, 3.14], [2.78, 3.66], [3.02, 2.92]], 0, C.hi, { sw: OUT });
flat([[2.78, 3.66], [3.02, 2.92], [2.88, 3.0]], 0, C.shade, NS);
flat([[2.56, 3.14], [2.78, 3.66], [3.02, 2.92]], 0, 'none', { sw: OUT });

// ------------------------------------------------------------------ il grande corno d'acciaio
{
  const bez = (a, b, c, d, n = 12) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, s = 1 - t; return [0, 1].map((j) => s * s * s * a[j] + 3 * s * s * t * b[j] + 3 * s * t * t * c[j] + t * t * t * d[j]); });
  const b0 = [3.1, 2.8], b1 = [3.92, 2.2], tip = [3.5, 5.9];
  const av = bez(b1, [4.65, 3.0], [4.75, 4.6], tip);         // filo davanti (convesso)
  const di = bez(tip, [4.1, 4.7], [4.0, 3.6], b0);           // filo dietro (concavo)
  const mz = bez(tip, [4.3, 4.65], [4.25, 3.4], [3.52, 2.5]); // spigolo di mezzo
  const lu = bez(tip, [4.52, 4.65], [4.48, 3.25], [3.75, 2.32]);
  flat(av.concat(di), 0, C.hi, { sw: OUT });
  flat(di.slice().reverse().concat(mz.slice(1)), 0, C.shade, NS);                  // lato concavo in ombra
  flat(av.slice(2, 11).concat(lu.slice(2, 11)), 0, C.glint, NS);                   // lama di luce
  flat(av.concat(di), 0, 'none', { sw: OUT });
}

// ------------------------------------------------------------------ scrittura
const pad = 2;
const x0 = Math.floor(mn[0] - pad), y0 = Math.floor(mn[1] - pad);
const w = Math.ceil(mx[0] + pad) - x0, h = Math.ceil(mx[1] + pad) - y0;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" width="${w}" height="${h}">\n` +
  `<g stroke="${SEP}" stroke-width="${OUT}" stroke-linejoin="round" stroke-linecap="round">\n${out.join('\n')}\n</g>\n</svg>\n`;
const dest = process.argv[2] || new URL('../../../public/landmarks/king-kong-rhino.svg', import.meta.url).pathname;
fs.writeFileSync(dest, svg);
console.log(JSON.stringify({ dest, bytes: svg.length, viewBox: [x0, y0, w, h], larghezzaMetri: +(w / S).toFixed(1), ancora: [+(-x0 / w).toFixed(4), +(-y0 / h).toFixed(4)] }));
