// Museo Civico (ex convento di San Francesco) e chiesa di San Francesco, Bassano del Grappa.
// Rigenera public/landmarks/museo-civico.svg:   node scripts/landmark/luoghi/museo-civico.mjs
// (con un percorso come primo argomento scrive lì invece che nel progetto).
//
// Autonomo di proposito: ../iso.mjs importa geo.mjs, che all'avvio legge osm.json, e quel file
// non è nel repository. La proiezione è la stessa di docs/SPEC.md.
//
// Impronte prese da public/data/base.json (OpenStreetMap), metri locali. Tutto il complesso è
// ortogonale e ruotato di 74,3° da nord, quindi si disegna in un riferimento locale:
//   s = lungo la navata verso est (abside),  t = verso nord,  z = in alto,
//   origine = angolo nord-ovest del chiostro, contro il muro sud della chiesa.
// Da sud-ovest si vedono le facce rivolte a ovest (in ombra) e a sud (in luce).
import fs from 'fs';

const S = 4; // unità SVG per metro isometrico
const SEP = '#5b4636';
const O = [60.4, 8.2];
const ANG = (74.3 * Math.PI) / 180;
const U = [Math.sin(ANG), Math.cos(ANG)], N = [-Math.cos(ANG), Math.sin(ANG)];
/**
 * Punto d'appoggio (metri locali della mappa): sul prato del chiostro, verso il portico nord.
 * La mappa nasconde gli edifici generici il cui centro cade in un quadrato di semilato
 * SEMILATO attorno a questo punto: scelto così, il quadrato prende chiesa, protiro, campanile,
 * convento, torrione e tettoia, e lascia stare le case vicine.
 */
export const ANCORA_M = [74.6, 4];
const SEMILATO = 24.5;

const mondo = (s, t) => [O[0] + s * U[0] + t * N[0], O[1] + s * U[1] + t * N[1]];
const iso = (x, y, z = 0) => [(x - y) * 0.7071 * S, (-(x + y) * 0.35355 - z * 0.8165) * S];
const pr = (s, t, z = 0) => { const [x, y] = mondo(s, t); return iso(x, y, z); };

// ---- tinte: [in luce, in ombra] ---------------------------------------------------------
const CHIESA = ['#e6c4a2', '#d2ac8a'], LESENA = ['#d3a37c', '#c2946f'], COTTO_MURO = ['#cd8a64', '#b97c58'];
const TORRE = ['#cf8c66', '#ae6f4f'], TORRE_INT = ['#ebc6ab', '#cfa78b'];
const PIETRA = ['#f3ead6', '#d8ccb1'], OCRA = ['#f2dcaa', '#d7bd88'], CREMA = ['#f6ead3', '#dccdb0'];
const GIALLO = ['#f1d294', '#d5b474'], ROSSO = ['#e7a888', '#cb8c6e'];
// tetti: falda in luce (sud ed est), falda a ovest, falda a nord; la navata ha il rosso più caldo
const TETTO = ['#cf6a40', '#bb5c3a', '#a44d31'], TETTO_CH = ['#d8703f', '#b65a39', '#a94f31'];
const BUIO = '#4d3b2f', VETRO = '#6b5648', PRATO = '#c9d9a2', PRATO_OMBRA = '#b0c389';

// ---- scrittura ---------------------------------------------------------------------------
const out = []; const ombre = [];
let mn = [1e9, 1e9], mx = [-1e9, -1e9];
const f1 = (n) => { let s = n.toFixed(1); if (s.endsWith('.0')) s = s.slice(0, -2); return s === '-0' ? '0' : s; };
const reg = (q) => { for (let i = 0; i < 2; i++) { if (q[i] < mn[i]) mn[i] = q[i]; if (q[i] > mx[i]) mx[i] = q[i]; } };
const d2 = (pts, open) => pts.map((q, i) => { reg(q); return (i ? 'L' : 'M') + f1(q[0]) + ' ' + f1(q[1]); }).join('') + (open ? '' : 'Z');
const attr = (fill, o = {}) => ` fill="${fill}"` + (o.stroke ? ` stroke="${o.stroke}"` : '') + (o.sw != null ? ` stroke-width="${o.sw}"` : '') +
  (o.op != null ? ` fill-opacity="${o.op}"` : '') + (o.sop != null ? ` stroke-opacity="${o.sop}"` : '') + (o.dash ? ` stroke-dasharray="${o.dash}"` : '') +
  (o.cap ? ` stroke-linecap="${o.cap}"` : '');
/** Un poligono nello spazio locale [s, t, z]. */
const poly = (p3, fill, o = {}) => out.push(`<path d="${d2(p3.map((p) => pr(...p)), o.open)}"${attr(fill, o)}/>`);
/** Più poligoni dello stesso colore in un solo <path>. */
const multi = (list, fill, o = {}) => { if (list.length) out.push(`<path d="${list.map((p3) => d2(p3.map((p) => pr(...p)), o.open)).join('')}"${attr(fill, o)}/>`); };
const lines = (list, o = {}) => multi(list, 'none', { open: true, sw: 0.5, ...o });
const raw = (p2, fill, o = {}) => out.push(`<path d="${d2(p2, o.open)}"${attr(fill, o)}/>`);

function hull(P) {
  const p = [...P].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (const q of p.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}
/** Ombra morbida a terra di un rettangolo locale alto h. */
function ombra(s0, s1, t0, t1, h) {
  const k = Math.min(h, 26) * 0.42, off = [-0.8 * k, 0.38 * k];
  const c = [mondo(s0, t0), mondo(s1, t0), mondo(s1, t1), mondo(s0, t1)];
  ombre.push(hull(c.concat(c.map((p) => [p[0] + off[0], p[1] + off[1]])).map((p) => iso(p[0], p[1], 0))));
}

// ---- facce: a = ascissa lungo il muro, z = quota ---------------------------------------
const sud = (t) => ({ p: (a, z) => [a, t, z], k: 0 });   // muro rivolto a sud, a = s
const ovest = (s) => ({ p: (a, z) => [s, a, z], k: 1 });  // muro rivolto a ovest, a = t
const rett = (F, a0, a1, z0, z1) => [F.p(a0, z0), F.p(a1, z0), F.p(a1, z1), F.p(a0, z1)];
const muro = (F, a0, a1, z0, z1, col, o) => poly(rett(F, a0, a1, z0, z1), col[F.k], o);
function arco(F, a, z, w, h, n = 6) {
  const r = w / 2, p = [F.p(a - r, z), F.p(a - r, z + h - r)];
  for (let i = 1; i < n; i++) { const an = Math.PI - (i * Math.PI) / n; p.push(F.p(a + r * Math.cos(an), z + h - r + r * Math.sin(an))); }
  p.push(F.p(a + r, z + h - r), F.p(a + r, z)); return p;
}
const tondo = (F, a, z, r, n = 12) => Array.from({ length: n }, (_, i) => F.p(a + r * Math.cos((i * 2 * Math.PI) / n), z + r * Math.sin((i * 2 * Math.PI) / n)));
const file = (a0, a1, n) => Array.from({ length: n }, (_, i) => a0 + ((a1 - a0) * (i + 0.5)) / n);
const riga = (F, a0, a1, z) => [F.p(a0, z), F.p(a1, z)];
/** Apertura a sesto acuto: piedritti alti hs, poi due archi fino al vertice (ha sopra l'imposta). */
function ogiva(F, a, z, w, hs, ha, n = 4) {
  const r = w / 2, p = [F.p(a - r, z)];
  for (let i = 0; i <= n; i++) { const f = (i * Math.PI) / (3 * n); p.push(F.p(a + r - w * Math.cos(f), z + hs + (ha * Math.sin(f)) / 0.866)); }
  for (let i = n - 1; i >= 0; i--) { const f = (i * Math.PI) / (3 * n); p.push(F.p(a - r + w * Math.cos(f), z + hs + (ha * Math.sin(f)) / 0.866)); }
  p.push(F.p(a + r, z)); return p;
}
/** File di coppi: n linee tenui parallele alla gronda, tra gronda (p0-p1) e colmo (q0-q1). */
const coppi = (p0, p1, q0, q1, n = 2) => lines(Array.from({ length: n }, (_, i) => { const f = (i + 1) / (n + 1); const m = (a, b) => a.map((v, k) => v + (b[k] - v) * f); return [m(p0, q0), m(p1, q1)]; }), { sop: 0.28, sw: 0.4 });
/** Ombra portata su una superficie (poligono locale), stesso seppia dell'ombra a terra. */
const velo = (p3) => poly(p3, '#543e2a', { op: 0.2, stroke: 'none' });

// ---- solidi tondi ----------------------------------------------------------------------
const dirMondo = (f) => [Math.cos(f) * U[0] + Math.sin(f) * N[0], Math.cos(f) * U[1] + Math.sin(f) * N[1]];
/** Cilindro: sagoma in luce, spicchio in ombra, bordo. */
function cilindro(c, r, z0, z1, col, n = 32) {
  const pt = (i, z) => pr(c[0] + r * Math.cos((i * 2 * Math.PI) / n), c[1] + r * Math.sin((i * 2 * Math.PI) / n), z);
  const all = []; for (let i = 0; i < n; i++) all.push(pt(i, z0), pt(i, z1));
  raw(hull(all), col[0]);
  const idx = []; for (let i = 0; i < n; i++) { const d = dirMondo(((i + 0.5) * 2 * Math.PI) / n); if (-d[0] - d[1] > 0 && !(-d[1] >= -d[0])) idx.push(i); }
  if (idx.length) {
    let st = idx.find((i) => !idx.includes((i - 1 + n) % n)); const seq = []; for (let k = 0; k < idx.length; k++) seq.push((st + k) % n);
    const lo = seq.map((i) => pt(i, z0)).concat([pt((seq[seq.length - 1] + 1) % n, z0)]), hi = seq.map((i) => pt(i, z1)).concat([pt((seq[seq.length - 1] + 1) % n, z1)]);
    raw(lo.concat(hi.reverse()), col[1], { stroke: 'none' });
  }
  raw(hull(all), 'none');
}
/** Cono: sagoma in luce, falde in ombra, bordo. */
function cono(c, r, z0, z1, col, n = 32) {
  const pt = (i) => pr(c[0] + r * Math.cos((i * 2 * Math.PI) / n), c[1] + r * Math.sin((i * 2 * Math.PI) / n), z0), ap = pr(c[0], c[1], z1);
  const all = [ap]; for (let i = 0; i < n; i++) all.push(pt(i));
  raw(hull(all), col[0]);
  const idx = []; for (let i = 0; i < n; i++) { const d = dirMondo(((i + 0.5) * 2 * Math.PI) / n); if (-(z1 - z0) * (d[0] + d[1]) + 0.866 * r > 0 && !(-d[1] >= -d[0])) idx.push(i); }
  if (idx.length) {
    let st = idx.find((i) => !idx.includes((i - 1 + n) % n)); const seq = []; for (let k = 0; k <= idx.length; k++) seq.push((st + k) % n);
    raw([ap].concat(seq.map((i) => pt(i))), col[1], { stroke: 'none' });
  }
  raw(hull(all), 'none');
}

// ---- misure ----------------------------------------------------------------------------
const CH = { s0: -5.2, s1: 37.1, t1: 16, ze: 15.5, zr: 19.6 };        // chiesa: gronda e colmo
const CO = { s0: 0.5, s1: 21.5, t0: -23.5, t1: -3.5, zp: 7.1 };       // chiostro: prato e gronda dei lati
// Convento: un solo sistema di falde con la stessa pendenza, che parte dalla gronda del chiostro
// (7,1 m) e sale ai colmi dell'ala est (s = SR) e dell'ala sud (t = TR). Le ali sono tenute un
// po' più basse del vero (gronda esterna 8,3 m invece di 10) e l'ala ovest a un piano solo,
// perché da sud-ovest il chiostro resti leggibile.
const SR = 29.9, TR = -31.75, ZR = 10.32, ZG = 8.25, ZM = 8.4;        // colmi, gronda esterna, cima dei muri esterni
const WS = -4.5, AE = 24.8, AX = 35, TS = -61, BS = -36.5, E = 0.5;   // fronte ovest, ala est (da AE ad AX), fondo sud, muro sud, sporto
const falda = (t) => CH.ze + (CH.zr - CH.ze) * (1 - Math.abs(t - 8) / 8);

// ======================================================================================
// terreno
ombra(CH.s0, CH.s1, 0, CH.t1, 17); ombra(34.5, 38.1, -3.8, -0.2, 32); ombra(AE, AX, TS, 0, ZM); ombra(WS, AE, BS, -27, ZM);
ombra(WS, 0.5, -27, 0, 5.2); ombra(16.3, 25, -45, BS, 10.6); ombra(-10.4, -5.2, 5.2, 10.8, 8);
// chiostro: ghiaia, prato, ombra dell'ala est sul prato
poly([[CO.s0, CO.t0, 0], [CO.s1, CO.t0, 0], [CO.s1, CO.t1, 0], [CO.s0, CO.t1, 0]], '#eee3c9', { stroke: 'none' });
poly([[2.5, -21.5, 0], [19.5, -21.5, 0], [19.5, -5.5, 0], [2.5, -5.5, 0]], PRATO, { sw: 0.5 });
poly([[18, -21.5, 0], [19.5, -21.5, 0], [19.5, -5.5, 0], [18, -7, 0]], PRATO_OMBRA, { stroke: 'none' });
lines([[[2.5, -13.5, 0], [19.5, -13.5, 0]], [[11, -21.5, 0], [11, -5.5, 0]]], { stroke: '#eee3c9', sw: 1.6, cap: 'butt' });

// ======================================================================================
// chiesa di San Francesco
{
  const { s0, s1, t1, ze, zr } = CH; const F = ovest(s0), L = sud(0);
  // falda nord, che si vede oltre il colmo
  poly([[s0 - 0.5, 8, zr], [s1 + 0.5, 8, zr], [s1 + 0.5, t1 + 0.6, ze - 0.3], [s0 - 0.5, t1 + 0.6, ze - 0.3]], TETTO_CH[2]);
  // fianco sud: lesene sottili, cornice, sei monofore ogivali
  muro(L, s0, s1, 0, ze, CHIESA);
  const campate = 6, passo = (s1 - s0) / campate;
  multi(Array.from({ length: campate + 1 }, (_, i) => { const a = Math.min(s1 - 0.6, s0 + i * passo); return rett(L, a, a + 0.6, 0, ze); }), LESENA[0], { sw: 0.3, sop: 0.6 });
  poly(rett(L, s0, s1, ze - 1, ze), LESENA[0], { sw: 0.3, sop: 0.6 });
  lines([riga(L, s0 + 0.6, s1 - 0.4, ze - 0.6)], { stroke: '#f0dfc4', sw: 1.5, dash: '1.5 1.5', cap: 'butt' });
  const fin = file(s0 + 0.3, s1 + 0.3, campate);
  multi(fin.map((a) => ogiva(L, a, 8.9, 1.9, 3.9, 1.7)), PIETRA[0], { sw: 0.4 });
  multi(fin.map((a) => ogiva(L, a, 9.3, 1, 3.6, 1.1, 3)), VETRO, { stroke: 'none' });
  // ombra del campanile sul fianco
  velo(rett(L, 32.6, 34.5, 8, ze - 0.3));
  // falda sud
  poly([[s0 - 0.5, -0.6, ze - 0.3], [s1 + 0.5, -0.6, ze - 0.3], [s1 + 0.5, 8, zr], [s0 - 0.5, 8, zr]], TETTO_CH[0]);
  coppi([s0 - 0.5, -0.6, ze - 0.3], [s1 + 0.5, -0.6, ze - 0.3], [s0 - 0.5, 8, zr], [s1 + 0.5, 8, zr], 3);
  // facciata a capanna (rivolta a ovest: in ombra)
  poly([[s0, 0, 0], [s0, t1, 0], [s0, t1, ze], [s0, 8, zr], [s0, 0, ze]], CHIESA[1]);
  // quattro lesene sottili
  multi([[0, 0.6], [5.1, 5.7], [10.3, 10.9], [15.4, 16]].map(([a, b]) => [F.p(a, 0), F.p(b, 0), F.p(b, falda(b)), F.p(a, falda(a))]), LESENA[1], { sw: 0.3, sop: 0.6 });
  // cornice ad archetti sotto gli spioventi
  poly([F.p(0, ze), F.p(8, zr), F.p(t1, ze), F.p(t1, ze - 1.3), F.p(8, zr - 1.3), F.p(0, ze - 1.3)], COTTO_MURO[1], { sw: 0.4 });
  multi([...file(0.6, 7.6, 9), ...file(8.4, 15.4, 9)].map((a) => arco(F, a, falda(a) - 1.12, 0.52, 0.72, 3)), '#f0dfc4', { stroke: 'none' });
  // oculo e due monofore
  poly(tondo(F, 8, 12.4, 1.6, 14), PIETRA[1], { sw: 0.5 });
  poly(tondo(F, 8, 12.4, 1, 12), VETRO, { sw: 0.4 });
  multi([3.1, 12.9].map((a) => ogiva(F, a, 7.6, 1.5, 3.3, 1.4)), PIETRA[1], { sw: 0.4 });
  multi([3.1, 12.9].map((a) => ogiva(F, a, 8, 0.8, 3, 0.9, 3)), VETRO, { stroke: 'none' });
  // croce sul colmo
  lines([[[s0, 8, zr], [s0, 8, zr + 1.7]], [[s0, 7.5, zr + 1.15], [s0, 8.5, zr + 1.15]]], { sw: 0.7 });
}
// protiro gotico: tetto a due falde con il colmo perpendicolare alla facciata, timpano in cotto,
// arco acuto sul fronte, colonnine di pietra, due gradini
{
  const a0 = -10.4, a1 = -5.2, b0 = 5.2, b1 = 10.8, m = 8, ze = 6.4, zr = 8.9, z0 = 0.5, zi = 3.4, F = ovest(a0), L = sud(b0);
  const gr = (d, z, zb) => { // gradino: lastra con il fronte ovest e il fianco sud
    const x0 = a0 - d, y0 = b0 - d, y1 = b1 + d;
    poly(rett(ovest(x0), y0, y1, zb, z), PIETRA[1], { sw: 0.4 }); poly(rett(sud(y0), x0, a1, zb, z), PIETRA[0], { sw: 0.4 });
    poly([[x0, y0, z], [a1, y0, z], [a1, y1, z], [x0, y1, z]], '#f6eedc', { sw: 0.4 });
  };
  gr(1.5, 0.25, 0); gr(0.7, z0, 0.25);
  // falda nord (uno spicchio oltre il colmo)
  poly([[a0 - 0.4, m, zr], [a1, m, zr], [a1, b1 + 0.4, ze - 0.2], [a0 - 0.4, b1 + 0.4, ze - 0.2]], TETTO[2]);
  // interno in ombra: il fondo è la facciata, con il portale
  poly([[a0, b0, z0], [a1, b0, z0], [a1, b1, z0], [a0, b1, z0]], '#cbb99b', { stroke: 'none' });
  poly(rett(ovest(a1), b0, b1, z0, ze), '#a98466', { stroke: 'none' });
  multi([ogiva(ovest(a1), m, z0, 2.6, 2.6, 1.6)], PIETRA[1], { sw: 0.4 });
  multi([ogiva(ovest(a1), m, z0, 1.7, 2.5, 1.1)], '#6f4630', { stroke: 'none' });
  // fianco sud: fascia in cotto su arco, colonnina d'angolo
  const lato = [L.p(a0, zi), L.p(a0, ze), L.p(a1, ze), L.p(a1, z0)].concat(ogiva(L, (a0 + 0.45 + a1) / 2, z0, a1 - a0 - 0.45, zi - z0, 2.2).reverse().slice(0, -1));
  raw(lato.map((p) => pr(...p)), COTTO_MURO[0], { sw: 0.5 });
  // fronte: timpano in cotto con arco acuto
  const fronte = [F.p(b0, zi), F.p(b0, ze), F.p(m, zr), F.p(b1, ze), F.p(b1, zi)].concat(ogiva(F, m, zi, b1 - b0 - 0.9, 0, 3.5).slice(1, -1).reverse());
  raw(fronte.map((p) => pr(...p)), COTTO_MURO[1], { sw: 0.5 });
  // colonnine e capitelli
  multi([rett(F, b0, b0 + 0.45, z0, zi), rett(F, b1 - 0.45, b1, z0, zi)], PIETRA[1], { sw: 0.4 });
  multi([rett(L, a0, a0 + 0.45, z0, zi)], PIETRA[0], { sw: 0.4 });
  multi([rett(F, b0 - 0.15, b0 + 0.6, zi - 0.45, zi), rett(F, b1 - 0.6, b1 + 0.15, zi - 0.45, zi), rett(L, a0 - 0.15, a0 + 0.6, zi - 0.45, zi)], '#f6eedc', { sw: 0.4 });
  // falda sud
  poly([[a0 - 0.4, b0 - 0.4, ze - 0.2], [a1, b0 - 0.4, ze - 0.2], [a1, m, zr], [a0 - 0.4, m, zr]], TETTO[0]);
}
// campanile: canna sottile in cotto con marcapiano, cella a bifore, cornice e cuspide conica
{
  const a0 = 34.5, a1 = 38.1, b0 = -3.8, b1 = -0.2, zi = 25.5, zk = 32, F = ovest(a0), L = sud(b0), c = [36.3, -2];
  muro(L, a0, a1, 0, zi, TORRE); muro(F, b0, b1, 0, zi, TORRE);
  muro(L, a0, a1, zi, zk, TORRE_INT); muro(F, b0, b1, zi, zk, TORRE_INT);
  lines([riga(L, a0, a1, 17), riga(F, b0, b1, 17), riga(L, a0, a1, zi - 0.8), riga(F, b0, b1, zi - 0.8)], { sop: 0.7 });
  for (const [G, m] of [[L, c[0]], [F, c[1]]]) {
    multi([arco(G, m, zi + 1.3, 2.4, 3.7)], G.k ? '#b98f76' : TORRE_INT[1], { sw: 0.4 });
    multi([arco(G, m - 0.56, zi + 1.5, 0.82, 3, 4), arco(G, m + 0.56, zi + 1.5, 0.82, 3, 4)], BUIO, { sw: 0.4 });
    multi([rett(G, m - 0.2, m + 0.2, 13.2, 14.6), rett(G, m - 0.2, m + 0.2, 19.6, 21)], BUIO, { stroke: 'none' });
  }
  const e = 0.4, Fc = ovest(a0 - e), Lc = sud(b0 - e);
  muro(Lc, a0 - e, a1 + e, zk, zk + 1, TORRE); muro(Fc, b0 - e, b1 + e, zk, zk + 1, TORRE);
  poly([[a0 - e, b0 - e, zk + 1], [a1 + e, b0 - e, zk + 1], [a1 + e, b1 + e, zk + 1], [a0 - e, b1 + e, zk + 1]], TETTO[0]);
  cono(c, 1.8, zk + 1, zk + 9.4, [TETTO[0], TETTO[2]], 20);
  lines([[[...c, zk + 9.4], [...c, zk + 11.4]], [[c[0], c[1] - 0.4, zk + 10.8], [c[0], c[1] + 0.4, zk + 10.8]]], { sw: 0.6 });
}

// ======================================================================================
// convento
/** Lato del chiostro: sei arcate su colonnine, marcapiano, finestre del piano sopra. */
function portico(F, a0, a1, col) {
  muro(F, a0, a1, 0, CO.zp, col);
  const c = file(a0, a1, 6), passo = (a1 - a0) / 6;
  multi(c.map((a) => arco(F, a, 0, passo - 0.6, 3.9, 6)), BUIO, { sw: 0.5 });
  multi(Array.from({ length: 5 }, (_, i) => rett(F, a0 + (i + 1) * passo - 0.22, a0 + (i + 1) * passo + 0.22, 0, 2.5)), PIETRA[0], { sw: 0.4 });
  lines([riga(F, a0, a1, 4.5)], { sop: 0.6 });
  multi(c.map((a) => rett(F, a - 0.4, a + 0.4, 5.15, 6.25)), VETRO, { stroke: 'none' });
}
// falda est dell'ala est, oltre il colmo
poly([[SR, TS + 5.1, ZR], [SR, 0, ZR], [AX + E, 0, ZG], [AX + E, TS - E, ZG]], TETTO[0]);
// lato est del chiostro e falda ovest dell'ala est: un solo piano dalla gronda del chiostro al colmo
portico(ovest(CO.s1), CO.t0, CO.t1, OCRA);
const NE = [CO.s1 - 0.3, CO.t1 + 0.3, CO.zp], SE = [CO.s1 - 0.3, CO.t0 + 0.3, CO.zp], ZN = CO.zp + ((ZR - CO.zp) * (0 - NE[1])) / (SR - NE[0]);
poly([NE, [NE[0] - NE[1], 0, ZN], [SR, 0, ZR], [SR, TR, ZR], SE], TETTO[1]);
coppi(NE, SE, [SR, 0, ZR], [SR, TR, ZR]);
// lato nord, addossato alla chiesa: una sola falda contro il fianco
portico(sud(CO.t1), CO.s0, CO.s1, OCRA);
poly([[CO.s0, CO.t1, 4.5], [CO.s0, 0, 4.5], [CO.s0, 0, ZN], [CO.s0, CO.t1, CO.zp]], OCRA[1]);
poly([[CO.s0 - 0.3, NE[1], CO.zp], NE, [NE[0] - NE[1], 0, ZN], [CO.s0 - 0.3, 0, ZN]], TETTO[0]);
coppi([CO.s0 - 0.3, NE[1], CO.zp], NE, [CO.s0 - 0.3, 0, ZN], [NE[0] - NE[1], 0, ZN], 1);
// vera da pozzo al centro del prato
cilindro([11, -13.5], 1, 0, 1.1, PIETRA, 14);
raw(hull(Array.from({ length: 12 }, (_, i) => pr(11 + 0.6 * Math.cos((i * Math.PI) / 6), -13.5 + 0.6 * Math.sin((i * Math.PI) / 6), 1.1))), BUIO, { sw: 0.4 });
// ala ovest, a un piano, verso piazza Garibaldi (ingresso del museo)
{
  const F = ovest(WS), zw = 5.2, zc = 5.9, ze = 4.6, tn = CO.t0;
  poly([[-2, tn, zc], [-2, 0, zc], [0.8, 0, ze], [0.8, tn, ze]], TETTO[0]);
  muro(F, tn, 0, 0, zw, ROSSO);
  multi([arco(F, -7, 0, 2.6, 3.7)], PIETRA[1], { sw: 0.4 });
  multi([arco(F, -7, 0, 1.8, 3.3)], BUIO, { stroke: 'none' });
  multi([-20.5, -17, -13.5, -3].map((a) => rett(F, a - 0.5, a + 0.5, 1.6, 3.5)), VETRO, { sw: 0.4 });
  poly([[WS - E, tn, zw - 0.15], [WS - E, 0, zw - 0.15], [-2, 0, zc], [-2, tn, zc]], TETTO[1]);
}
// ala sud: falda nord sul chiostro, testata ovest, fronte sud, falda sud
{
  const F = ovest(WS), L = sud(BS), tg = CO.t0 + 0.3, zN = CO.zp + ((ZR - CO.zp) * (tg - CO.t0)) / (tg - TR), zS = ZG + ((ZR - ZG) * E) / (TR - BS + E);
  poly([[WS - E, tg, CO.zp], SE, [SR, TR, ZR], [WS - E, TR, ZR]], TETTO[2]);
  coppi([WS - E, tg, CO.zp], SE, [WS - E, TR, ZR], [SR, TR, ZR]);
  poly([F.p(BS, 0), F.p(CO.t0, 0), F.p(CO.t0, zN), F.p(TR, ZR), F.p(BS, zS)], GIALLO[1]);
  muro(L, WS, AE, 0, ZM, GIALLO);
  lines([riga(F, BS, CO.t0, 4.2), riga(L, WS, AE, 4.2)], { sop: 0.6 });
  const fl = file(WS + 0.7, 16.3, 7), ff = file(BS + 0.8, CO.t0 - 0.8, 4);
  multi(fl.flatMap((a) => [rett(L, a - 0.5, a + 0.5, 1.3, 3.1), rett(L, a - 0.5, a + 0.5, 5.2, 7)])
    .concat(ff.flatMap((a) => [rett(F, a - 0.5, a + 0.5, 1.3, 3.1), rett(F, a - 0.5, a + 0.5, 5.2, 6.7)])), VETRO, { sw: 0.4 });
  poly([[WS - E, BS - E, ZG], [AE - E, BS - E, ZG], [SR, TR, ZR], [WS - E, TR, ZR]], TETTO[0]);
  coppi([WS - E, BS - E, ZG], [AE - E, BS - E, ZG], [WS - E, TR, ZR], [SR, TR, ZR]);
}
// braccio sud dell'ala est: muri tranquilli, stessa falda dell'ala
{
  const Fw = ovest(AE), Ls = sud(TS);
  muro(Fw, TS, BS, 0, ZM, OCRA); muro(Ls, AE, AX, 0, ZM, OCRA);
  lines([riga(Fw, TS, BS, 4.2), riga(Ls, AE, AX, 4.2)], { sop: 0.5 });
  const fw = file(TS + 0.8, -45.4, 4), fs_ = file(AE + 0.6, AX - 0.6, 3);
  multi(fw.flatMap((a) => [rett(Fw, a - 0.45, a + 0.45, 1.4, 3), rett(Fw, a - 0.45, a + 0.45, 5.2, 6.8)])
    .concat(fs_.flatMap((a) => [rett(Ls, a - 0.45, a + 0.45, 1.4, 3), rett(Ls, a - 0.45, a + 0.45, 5.2, 6.8)])), VETRO, { sw: 0.4, op: 0.8 });
  poly([[AE - E, TS - E, ZG], [AE - E, BS - E, ZG], [SR, TR, ZR], [SR, TS + 5.1, ZR]], TETTO[1]);
  coppi([AE - E, TS - E, ZG], [AE - E, BS - E, ZG], [SR, TS + 5.1, ZR], [SR, TR, ZR]);
  poly([[AE - E, TS - E, ZG], [AX + E, TS - E, ZG], [SR, TS + 5.1, ZR]], TETTO[0]);
}
// torrione cilindrico all'incrocio dei colmi (angolo sud-est del chiostro)
{
  const c = [SR, TR], r = 4.9, zt = 15.4;
  cilindro(c, r, 9, zt, CREMA, 36);
  const arcoT = (z) => Array.from({ length: 13 }, (_, i) => { const g = 2.75 + (i * 2.75) / 12; return pr(c[0] + r * Math.cos(g), c[1] + r * Math.sin(g), z); });
  raw(arcoT(zt - 1), 'none', { open: true, sw: 0.5, sop: 0.6 });
  const fin = (f, z0, z1) => { const q = (g) => [c[0] + r * Math.cos(g), c[1] + r * Math.sin(g)]; return [[...q(f - 0.09), z0], [...q(f + 0.09), z0], [...q(f + 0.09), z1], [...q(f - 0.09), z1]]; };
  multi([fin(3.5, 11.9, 13.5), fin(4.2, 11.9, 13.5), fin(4.9, 11.9, 13.5)], VETRO, { sw: 0.4 });
  cono(c, r + 0.5, zt, zt + 1.9, [TETTO[0], TETTO[1]], 36);
}
// casa vicina nell'angolo tra l'ala sud e il braccio sud: sta davanti al convento ma la mappa la
// disegna prima dell'illustrazione, quindi va ridisegnata qui sopra. Volutamente anonima: colori
// e tetto piano delle case generiche della mappa, e un po' più bassa del vero (14,9 m).
{
  const a0 = 16.3, a1 = 25, b0 = -45, b1 = BS, zh = 10.6, F = ovest(a0), L = sud(b0), C = ['#f3e4c4', '#dccba8'];
  muro(F, b0, b1, 0, zh, C); muro(L, a0, a1, 0, zh, C);
  const fl = file(a0 + 0.5, a1 - 0.5, 3), ff = file(b0 + 0.5, b1 - 0.5, 3);
  multi([1.4, 4.6, 7.8].flatMap((z) => fl.map((a) => rett(L, a - 0.42, a + 0.42, z, z + 1.7)).concat(ff.map((a) => rett(F, a - 0.42, a + 0.42, z, z + 1.7)))), VETRO, { sw: 0.4, op: 0.75 });
  // tetto piano, come le case generiche della mappa
  poly([[a0, b0, zh], [a1, b0, zh], [a1, b1, zh], [a0, b1, zh]], '#c8643c');
}

// ======================================================================================
const PAD = 5;
// le ombre entrano nel riquadro solo passando da d2: vanno scritte prima di calcolarlo
const sh = ombre.map((p) => d2(p)).join('');
const a = iso(ANCORA_M[0], ANCORA_M[1], 0);
// margine a sinistra: la mappa ricava il quadrato da min(u, 1-u) * larghezza * 0.92
const X0 = Math.min(Math.floor(mn[0] - PAD), Math.floor(a[0] - (SEMILATO * Math.SQRT2 * S) / 0.92)), Y0 = Math.floor(mn[1] - PAD);
const Wd = Math.ceil(mx[0] + PAD) - X0, Ht = Math.ceil(mx[1] + PAD) - Y0;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${X0} ${Y0} ${Wd} ${Ht}" width="${Wd}" height="${Ht}">\n` +
  `<g stroke="${SEP}" stroke-width=".8" stroke-linejoin="round" stroke-linecap="round">\n` +
  `<path d="${sh}" fill="#543e2a" fill-opacity=".2" stroke="none"/>\n` + out.join('\n') + '\n</g>\n</svg>\n';

const dest = process.argv[2] || new URL('../../../public/landmarks/museo-civico.svg', import.meta.url).pathname;
fs.writeFileSync(decodeURIComponent(dest), svg);
console.log(JSON.stringify({
  file: dest, byte: svg.length, viewBox: [X0, Y0, Wd, Ht],
  ancoraMetri: ANCORA_M.map((v) => +v.toFixed(2)),
  lat: +(45.7665 + ANCORA_M[1] / 110574).toFixed(6),
  lon: +(11.7345 + ANCORA_M[0] / (111320 * Math.cos((45.7665 * Math.PI) / 180))).toFixed(6),
  larghezzaMetri: +(Wd / S).toFixed(1),
  ancora: [+((a[0] - X0) / Wd).toFixed(4), +((a[1] - Y0) / Ht).toFixed(4)],
}));
