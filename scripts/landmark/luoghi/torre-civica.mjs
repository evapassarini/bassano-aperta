// Torre Civica (Piazza Garibaldi): genera public/landmarks/torre-civica.svg.
// Uso: node scripts/landmark/luoghi/torre-civica.mjs [file di uscita]
// Impronta reale (OpenStreetMap, way 145928619, metri locali): quadrato di circa 9,2 m,
// ruotato di 15,7 gradi; centro (53.95, 73.4). Altezza 43 m alla cima dei merli.
// Le facce che si vedono da sud-ovest sono la sud (in luce, con l'orologio verso la piazza)
// e la ovest (in ombra).
import fs from 'fs';
// Nota: ../iso.mjs non si puo' importare da solo, perche' carica geo.mjs che a sua volta
// legge osm.json (non presente nel repository). Qui sotto c'e' quindi la parte minima dello
// stesso motore (stessa proiezione, stessi toni di luce, stessa ombra, stesso formato SVG).
const S = 4; // unita' SVG per metro isometrico
const SEP = '#5b4636', CONTORNO = '#4a3828';
const P = (x, y, z = 0) => [(x - y) * 0.7071 * S, (-(x + y) * 0.35355 - z * 0.8165) * S];
const f1 = (n) => { let s = n.toFixed(1); if (s.endsWith('.0')) s = s.slice(0, -2); return s === '-0' ? '0' : s; };
function hull(pp) {
  const p = [...pp].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (const q of p.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}
class Scene {
  constructor() { this.s = []; this.sh = []; this.c = []; this.mn = [1e9, 1e9]; this.mx = [-1e9, -1e9]; }
  solid(_, fn) { fn(); }
  reg(q) { for (let i = 0; i < 2; i++) { if (q[i] < this.mn[i]) this.mn[i] = q[i]; if (q[i] > this.mx[i]) this.mx[i] = q[i]; } }
  d2(pts2, open) { let d = ''; pts2.forEach((q, i) => { this.reg(q); d += (i ? 'L' : 'M') + f1(q[0]) + ' ' + f1(q[1]); }); return d + (open ? '' : 'Z'); }
  path(pts3, fill, o = {}) {
    let a = ` fill="${fill}"`;
    if (o.stroke) a += ` stroke="${o.stroke}"`;
    if (o.sw != null) a += ` stroke-width="${o.sw}"`;
    if (o.op != null) a += ` fill-opacity="${o.op}"`;
    if (o.sop != null) a += ` stroke-opacity="${o.sop}"`;
    const d = this.d2(pts3.map((p) => P(p[0], p[1], p[2] || 0)), o.open), l = this.s[this.s.length - 1];
    if (o.batch && l && l.batch && l.a === a) l.d += d; else this.s.push({ d, a, batch: o.batch });
  }
  line(pts3, o = {}) { this.path(pts3, 'none', { open: true, ...o }); }
  /** Ombra a terra: k = metri di scostamento verso ovest-nord-ovest, op = opacita'. */
  shadow(poly, k, op) {
    const off = [-0.8 * k, 0.38 * k];
    this.sh.push({ h: hull(poly.concat(poly.map((p) => [p[0] + off[0], p[1] + off[1]]))), op });
  }
  /** Contorno esterno: l'inviluppo dei punti, disegnato sotto a tutto con un tratto spesso. */
  contour(pts3, sw = 1.7) { this.c.push({ h: hull(pts3.map((p) => P(p[0], p[1], p[2] || 0))), sw }); }
  svg() {
    const sh = this.sh.map((e) => `<path d="${this.d2(e.h.map((p) => P(p[0], p[1], 0)))}" fill="#543e2a" fill-opacity="${e.op}" stroke="none"/>`).join('\n');
    const co = this.c.map((e) => `<path d="${this.d2(e.h)}" fill="${CONTORNO}" stroke="${CONTORNO}" stroke-width="${e.sw}"/>`).join('\n');
    const pad = 5, x0 = Math.floor(this.mn[0] - pad), y0 = Math.floor(this.mn[1] - pad);
    const w = Math.ceil(this.mx[0] + pad) - x0, h = Math.ceil(this.mx[1] + pad) - y0;
    const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" width="${w}" height="${h}">\n` +
      `<g stroke="${SEP}" stroke-width=".8" stroke-linejoin="round" stroke-linecap="round">\n` +
      sh + '\n' + co + '\n' +
      this.s.map((e) => `<path d="${e.d}"${e.a}/>`).join('\n') + '\n</g>\n</svg>\n';
    return { svg: out, w, h, viewBox: [x0, y0, w, h], ancora: [+((0 - x0) / w).toFixed(4), +((0 - y0) / h).toFixed(4)], larghezzaMetri: +(w / S).toFixed(2) };
  }
}
/** Parallelepipedo orientato (ang = asse lungo, gradi da nord in senso orario): muri visibili e tetto piano. */
function box(sc, { c, ang, L, W, z0, h, col, top = null, sw }) {
  const o = sw == null ? {} : { sw };
  const a = (ang * Math.PI) / 180, u = [Math.sin(a), Math.cos(a)], v = [Math.cos(a), -Math.sin(a)];
  const q = (su, sv) => [c[0] + (u[0] * su * L) / 2 + (v[0] * sv * W) / 2, c[1] + (u[1] * su * L) / 2 + (v[1] * sv * W) / 2];
  const z1 = z0 + h;
  for (const [A, B, n] of [[q(1, -1), q(1, 1), u], [q(-1, -1), q(-1, 1), [-u[0], -u[1]]], [q(-1, 1), q(1, 1), v], [q(-1, -1), q(1, -1), [-v[0], -v[1]]]]) {
    if (-n[0] - n[1] <= 1e-6) continue; // non rivolta a chi guarda
    sc.path([[...A, z0], [...B, z0], [...B, z1], [...A, z1]], -n[1] >= -n[0] ? col[0] : col[1], o); // piu' a sud che a ovest = in luce
  }
  if (top) sc.path([q(-1, -1), q(1, -1), q(1, 1), q(-1, 1)].map((p) => [...p, z1]), top, o);
}

const OUT = process.argv[2] || new URL('../../../public/landmarks/torre-civica.svg', import.meta.url).pathname;

// [in luce, in ombra]: fusto, coronamento (un tono piu' chiaro), cornici degli archi
const MATTONE = ['#cf8a63', '#a9694a'], CORONA = ['#dba079', '#b87656'], SCURO = ['#b06f4e', '#8c563d'];
const PIETRA = ['#e3d3b0', '#c9b892'], BIANCO = ['#f1e7cf', '#d6c8a8'], BUIO = '#3f2f26', QUADRANTE = '#f3e9d2';
const CAPPA = '#e9bd9c', PIANO = '#9a6a50', PIANO_OMBRA = '#7d5540', BUCA = '#6e4634';

// assi dell'impronta: U lungo il lato sud (verso est-nord-est), V verso nord-nord-ovest
const U = [0.9628, 0.2703], V = [-0.2703, 0.9628];
const ANG = (Math.atan2(U[0], U[1]) * 180) / Math.PI;
const p2 = (a, b) => [a * U[0] + b * V[0], a * U[1] + b * V[1]];
const p3 = (a, b, z) => [...p2(a, b), z];

// fusto leggermente rastremato: 9,2 m alla base, 8,3 m sotto il ballatoio
const Z_F = 38.9, HW0 = 4.6, HW1 = 4.15;
const hwF = (z) => HW0 + ((HW1 - HW0) * Math.min(z, Z_F)) / Z_F;
// ballatoio a sbalzo e merli
const HWG = 4.8, Z_G0 = 38.6, Z_G1 = 41, Z_M = 43.1, TH = 0.75, Z_PIANO = 39.9;

// facce visibili: d = metri dal centro della faccia, da sinistra a destra sullo schermo
const sud = (hw) => (d, z) => p3(d, -hw(z), z);
const ovest = (hw) => (d, z) => p3(-hw(z), -d, z);
// riv = da che parte si vede la spalla dei vani (-1 a sinistra, +1 a destra) e quanto e' larga
const FACCE = [
  { nome: 'ovest', f: ovest, tono: 1, riv: -1, spalla: 0.34 },
  { nome: 'sud', f: sud, tono: 0, riv: 1, spalla: 0.5 },
];

const sc = new Scene();
const quad = (F, d0, d1, z0, z1, fill, o) => sc.path([F(d0, z0), F(d1, z0), F(d1, z1), F(d0, z1)], fill, o);
const ogiva = (F, d, z, w, h, fill, o = {}) => {
  const r = w / 2;
  sc.path([F(d - r, z), F(d - r, z + h - w * 0.95), F(d - r * 0.6, z + h - w * 0.4), F(d, z + h), F(d + r * 0.6, z + h - w * 0.4), F(d + r, z + h - w * 0.95), F(d + r, z)], fill, { sw: 0.5, ...o });
};
const cerchio = (F, d, z, r, fill, o = {}) => {
  const pts = []; for (let i = 0; i < 24; i++) { const a = (i * Math.PI) / 12; pts.push(F(d + r * Math.cos(a), z + r * Math.sin(a))); }
  sc.path(pts, fill, o);
};
const blocco = (a, b, la, lb, z0, h, col, top, sw) => box(sc, { c: p2(a, b), ang: ANG, L: la, W: lb, z0, h, col, top, sw });
const angoli = (hw, z) => [p3(-hw, -hw, z), p3(hw, -hw, z), p3(hw, hw, z), p3(-hw, hw, z)];

// ombra lunga (la torre e' la cosa piu' alta della mappa) piu' un'ombra di contatto alla base
const BASE = angoli(HW0, 0).map((p) => [p[0], p[1]]);
sc.shadow(BASE, 17, 0.18);
sc.shadow(BASE, 5.5, 0.12);

// contorno esterno marcato: fusto, ballatoio, mensole d'angolo
sc.contour([...angoli(HW0, 0), ...angoli(HW1, Z_F)]);
sc.contour([...angoli(HWG, Z_G0), ...angoli(HWG, Z_G1)]);

sc.solid(0, () => {
  // ---- fusto
  const ZO = 22.5, RO = 3.0; // orologio (faccia sud)
  for (const { f, tono } of FACCE) {
    const F = f(hwF), hw = hwF;
    sc.path([F(-hw(0), 0), F(hw(0), 0), F(hw(Z_F), Z_F), F(-hw(Z_F), Z_F)], MATTONE[tono]);
    // basamento basso in pietra
    sc.path([F(-hw(0), 0), F(hw(0), 0), F(hw(1.3), 1.3), F(-hw(1.3), 1.3)], PIETRA[tono], { sw: 0.5 });
    // corsi regolari appena accennati, paralleli alla base, e buche pontaie su due colonne allineate
    for (let z = 6.5; z < 31; z += 3.4) {
      sc.line([F(-hw(z), z), F(hw(z), z)], { sw: 0.4, stroke: '#8f5a40', sop: tono ? 0.45 : 0.5, batch: true });
    }
    for (let z = 8.2; z < 31; z += 3.4) {
      if (tono === 0 && (Math.abs(z - ZO) < RO + 0.5 || (z > 10.5 && z < 16))) continue; // non sull'orologio ne' sul riquadro
      for (const d of [-2.9, 2.9]) quad(F, d - 0.17, d + 0.17, z, z + 0.36, BUCA, { stroke: 'none', batch: true });
    }
  }
  const W = ovest(hwF), Sd = sud(hwF);
  // faccia ovest: feritoie
  for (const z of [11.5, 20.5, 28.3]) quad(W, -0.22, 0.22, z, z + 1.8, BUIO, { sw: 0.4 });
  // faccia sud: riquadro d'intonaco con finestrella, appena sopra i tetti della piazza
  quad(Sd, -1.9, 1.5, 11.4, 15.4, '#ead9b9', { sw: 0.4, sop: 0.55 });
  quad(Sd, -0.8, -0.1, 12.2, 13.8, BUIO, { sw: 0.4 });
  // orologio: grande quadrante chiaro verso la piazza, a meta' fusto
  cerchio(Sd, 0, ZO, RO, QUADRANTE, { sw: 1.2, stroke: CONTORNO });
  cerchio(Sd, 0, ZO, RO * 0.5, '#e2cda2', { stroke: 'none' });
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6, c = Math.cos(a), s = Math.sin(a), r0 = i % 3 ? 0.74 : 0.62;
    sc.line([Sd(c * RO * r0, ZO + s * RO * r0), Sd(c * RO * 0.88, ZO + s * RO * 0.88)], { sw: i % 3 ? 0.4 : 0.9, stroke: BUIO, batch: true });
  }
  sc.line([Sd(1.25, ZO + 0.75), Sd(0, ZO), Sd(-0.25, ZO + 2.0)], { sw: 0.9, stroke: BUIO });
  cerchio(Sd, 0, ZO, 0.28, BUIO, { stroke: 'none' });
  // cella campanaria: tre archi acuti per lato, con la spalla interna e il davanzale chiaro
  for (const { f, tono, riv, spalla } of FACCE) {
    const F = f(hwF), Z0 = 32.3;
    sc.line([F(-hwF(Z0), Z0), F(hwF(Z0), Z0)], { sw: 0.4, sop: 0.45 });
    for (const d of [-2.6, 0, 2.6]) {
      ogiva(F, d, Z0, 2.25, 4.7, SCURO[tono], { sw: 0.4, sop: 0.6 });
      ogiva(F, d, Z0, 1.75, 4.3, tono ? MATTONE[0] : '#8a5a44', { sw: 0.4 }); // spalla: in luce a ovest, in ombra a sud
      ogiva(F, d - (riv * spalla) / 2, Z0 + 0.3, 1.75 - spalla, 4.3 - 0.3 - spalla * 0.5, BUIO, { stroke: 'none' });
      quad(F, d - 0.875, d + 0.875, Z0, Z0 + 0.3, BIANCO[tono], { sw: 0.3 });
    }
  }

  // ---- terrazza: piano (scuro, con l'ombra dei parapetti vicini), parapetto e merli dei lati lontani
  const hi = HWG - TH, e = HWG - TH / 2;
  sc.path(angoli(hi, Z_PIANO), PIANO, { sw: 0.4 });
  sc.path([p3(-hi, -hi, Z_PIANO), p3(hi, -hi, Z_PIANO), p3(hi, -hi + 1.3, Z_PIANO), p3(-hi + 1.3, -hi + 1.3, Z_PIANO), p3(-hi + 1.3, hi, Z_PIANO), p3(-hi, hi, Z_PIANO)], PIANO_OMBRA, { stroke: 'none' });
  sc.path([p3(-hi, hi, Z_PIANO), p3(hi, hi, Z_PIANO), p3(hi, hi, Z_G1), p3(-hi, hi, Z_G1)], MATTONE[0], { sw: 0.4 });
  sc.path([p3(hi, -hi, Z_PIANO), p3(hi, hi, Z_PIANO), p3(hi, hi, Z_G1), p3(hi, -hi, Z_G1)], MATTONE[1], { sw: 0.4 });
  sc.path([p3(-HWG, HWG, Z_G1), p3(HWG, HWG, Z_G1), p3(hi, hi, Z_G1), p3(-hi, hi, Z_G1)], CAPPA, { sw: 0.4 });
  sc.path([p3(HWG, -HWG, Z_G1), p3(HWG, HWG, Z_G1), p3(hi, hi, Z_G1), p3(hi, -hi, Z_G1)], CAPPA, { sw: 0.4 });
  // sei merli per lato: quattro lungo il lato piu' un solo merlo quadrato in comune a ogni angolo
  const N = 6, MW = 0.95, passo = (2 * HWG - MW) / (N - 1);
  const pos = Array.from({ length: N - 2 }, (_, i) => -HWG + MW / 2 + (i + 1) * passo);
  const ec = HWG - MW / 2;
  const merli = (lista) => lista.map((m) => ({ ...m, k: p2(m.a, m.b) })).sort((m, n) => (n.k[0] + n.k[1]) - (m.k[0] + m.k[1]))
    .forEach((m) => blocco(m.a, m.b, m.la, m.lb, Z_G1, Z_M - Z_G1, CORONA, CAPPA, 0.6));
  const lato = (l) => pos.map((d) => l === 'n' ? { a: d, b: e, la: MW, lb: TH } : l === 's' ? { a: d, b: -e, la: MW, lb: TH } : l === 'e' ? { a: e, b: d, la: TH, lb: MW } : { a: -e, b: d, la: TH, lb: MW });
  const angolo = (sa, sb) => ({ a: sa * ec, b: sb * ec, la: MW, lb: MW });
  merli([...lato('n'), ...lato('e'), angolo(1, 1)]);
  // asta al centro della terrazza e bandiera rossa e gialla, stesa verso destra
  sc.line([[0, 0, Z_PIANO], [0, 0, 50.4]], { sw: 1, stroke: SEP });
  const fl = (t, z) => [t * 0.7071, -t * 0.7071, z];
  // due bande orizzontali, rossa sopra e gialla sotto, con una lieve onda
  const onda = [[0, 0], [1.3, 0.22], [2.6, -0.2], [3.9, 0.08]];
  const banda = (z1, z0, fill) => sc.path([...onda.map(([t, w]) => fl(t, z1 + w)), ...[...onda].reverse().map(([t, w]) => fl(t, z0 + w))], fill, { sw: 0.6 });
  banda(50.1, 48.75, '#d23c2a'); banda(48.75, 47.4, '#f0b83a');

  // ---- ballatoio a sbalzo (lati vicini): archetti pensili fra le mensole d'angolo in pietra bianca
  blocco(0, 0, 2 * HWG, 2 * HWG, Z_G0, Z_G1 - Z_G0, CORONA);
  for (const { f, tono } of FACCE) {
    const F = f(() => HWG), Fs = f(hwF), CM = 0.9, luce = 2 * (HWG - CM);
    for (let i = 0; i < 5; i++) ogiva(F, -HWG + CM + (i + 0.5) * (luce / 5), Z_G0, 1.2, 1.55, SCURO[tono], { sw: 0.4, sop: 0.7 });
    sc.line([F(-HWG, Z_G0 + 1.75), F(HWG, Z_G0 + 1.75)], { sw: 0.4, sop: 0.5 });
    for (const sg of [-1, 1]) {
      const zc = 37.4, m = [F(sg * HWG, Z_G0 + 0.45), F(sg * (HWG - CM), Z_G0 + 0.45), F(sg * (HWG - CM), Z_G0), Fs(sg * (hwF(zc) - 0.15), zc), Fs(sg * hwF(zc), zc), F(sg * HWG, Z_G0)];
      sc.path(m, PIETRA[tono], { sw: 0.5 });
    }
  }
  // testa del parapetto, poi i merli dei lati vicini
  sc.path([p3(-HWG, -HWG, Z_G1), p3(HWG, -HWG, Z_G1), p3(hi, -hi, Z_G1), p3(-hi, -hi, Z_G1)], CAPPA, { sw: 0.4 });
  sc.path([p3(-HWG, -HWG, Z_G1), p3(-HWG, HWG, Z_G1), p3(-hi, hi, Z_G1), p3(-hi, -hi, Z_G1)], CAPPA, { sw: 0.4 });
  merli([...lato('o'), ...lato('s'), angolo(-1, 1), angolo(1, -1), angolo(-1, -1)]);
});

const r = sc.svg();
fs.writeFileSync(OUT, r.svg);
console.log(JSON.stringify({ file: OUT, bytes: r.svg.length, viewBox: r.viewBox, ancora: r.ancora, larghezzaMetri: r.larghezzaMetri, S }));
