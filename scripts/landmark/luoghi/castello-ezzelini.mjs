// Castello degli Ezzelini (Castello Superiore) con il Duomo di Santa Maria in Colle.
// Genera public/landmarks/castello-ezzelini.svg nella proiezione di docs/SPEC.md.
//
//   node scripts/landmark/luoghi/castello-ezzelini.mjs [file-di-uscita.svg]
//
// Le impronte di torri, Duomo e delle poche case disegnate vengono da public/data/base.json
// (le stesse che usa la mappa); i tratti di mura, che in base.json non ci
// sono, sono ripresi da scripts/landmark/plan/castello.svg (OpenStreetMap, barrier=*).
// Le funzioni di disegno ricalcano scripts/landmark/iso.mjs; sono copiate qui perche'
// iso.mjs importa geo.mjs, che all'avvio legge un osm.json non presente nel repository.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '../../..');
const USCITA = process.argv[2] || path.join(RADICE, 'public/landmarks/castello-ezzelini.svg');

// ---------------------------------------------------------------- proiezione e scena
const S = 4; // unita' SVG per metro isometrico
const SEP = '#5b4636';
const P = (x, y, z = 0) => [(x - y) * 0.7071 * S, (-(x + y) * 0.35355 - z * 0.8165) * S];
const D = [-1, -1, 0.866]; // verso l'osservatore
const f1 = (n) => { let s = n.toFixed(1); if (s.endsWith('.0')) s = s.slice(0, -2); return s === '-0' ? '0' : s; };
const rad = (a) => (a * Math.PI) / 180;
const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function hull(pp) {
  const p = [...pp].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}
/** Rettangolo orientato di area minima: centro, angolo dell'asse lungo (gradi da nord), L, W. */
function obb(poly) {
  const h = hull(poly); let best = null;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.5) continue;
    const ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l; let mnu = 1e9, mxu = -1e9, mnv = 1e9, mxv = -1e9;
    for (const q of h) { const pu = q[0] * ux + q[1] * uy, pv = q[0] * uy - q[1] * ux; mnu = Math.min(mnu, pu); mxu = Math.max(mxu, pu); mnv = Math.min(mnv, pv); mxv = Math.max(mxv, pv); }
    const A = (mxu - mnu) * (mxv - mnv);
    if (!best || A < best.A) {
      let L = mxu - mnu, W = mxv - mnv; const cu = (mnu + mxu) / 2, cv = (mnv + mxv) / 2;
      let ang = (Math.atan2(ux, uy) * 180) / Math.PI; if (W > L) { [L, W] = [W, L]; ang += 90; }
      best = { A, c: [cu * ux + cv * uy, cu * uy - cv * ux], ang: ((ang % 180) + 180) % 180, L, W };
    }
  }
  return best;
}

class Scene {
  constructor() { this.g = []; this.cur = null; this.sh = []; this.mn = [1e9, 1e9]; this.mx = [-1e9, -1e9]; this.ground = []; }
  solid(depth, fn) { const prev = this.cur; this.cur = { depth, s: [] }; fn(); this.g.push(this.cur); this.cur = prev; }
  at(c, fn, bias = 0) { this.solid(c[0] + c[1] + bias, fn); }
  emit(d, a, batch) { const s = this.cur.s, l = s[s.length - 1]; if (batch && l && l.batch && l.a === a) l.d += d; else s.push({ d, a, batch }); }
  reg(q) { for (let i = 0; i < 2; i++) { if (q[i] < this.mn[i]) this.mn[i] = q[i]; if (q[i] > this.mx[i]) this.mx[i] = q[i]; } }
  d2(pts2, open) {
    // Le facce grandi si arrotondano all'unita', i dettagli al decimo; dopo il primo punto
    // si scrivono gli scarti tra punti gia' arrotondati (meno byte, nessun errore accumulato).
    let a = 1e9, b = -1e9, c = 1e9, e = -1e9; for (const q of pts2) { this.reg(q); a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); e = Math.max(e, q[1]); }
    const k = b - a > 10 || e - c > 10 ? 1 : 10, n = (v) => { const t = String(v / k); return t.startsWith('0.') ? t.slice(1) : t.startsWith('-0.') ? '-' + t.slice(2) : t; };
    const sp = (v) => (v < 0 ? '' : ' ') + n(v);
    const r = pts2.map((q) => [Math.round(q[0] * k), Math.round(q[1] * k)]);
    let d = 'M' + n(r[0][0]) + sp(r[0][1]);
    for (let i = 1; i < r.length; i++) {
      const dx = r[i][0] - r[i - 1][0], dy = r[i][1] - r[i - 1][1];
      d += dx === 0 ? (dy === 0 ? '' : 'v' + n(dy)) : dy === 0 ? 'h' + n(dx) : 'l' + n(dx) + sp(dy);
    }
    return d + (open ? '' : 'z');
  }
  attrs(fill, o = {}) {
    let a = ` fill="${fill}"`;
    if (o.stroke) a += ` stroke="${o.stroke}"`;
    if (o.sw != null) a += ` stroke-width="${o.sw}"`;
    if (o.op != null) a += ` fill-opacity="${o.op}"`;
    if (o.sop != null) a += ` stroke-opacity="${o.sop}"`;
    return a;
  }
  raw(pts2, fill, o = {}) { this.emit(this.d2(pts2, o.open), this.attrs(fill, o), o.batch); }
  path(pts3, fill, o = {}) { this.raw(pts3.map((p) => P(p[0], p[1], p[2] || 0)), fill, o); }
  line(pts3, o = {}) { this.path(pts3, 'none', { open: true, ...o }); }
  shadow(poly, h) { const k = Math.min(h, 26) * 0.42; this.sh.push(hull(poly.concat(poly.map((p) => [p[0] - 0.8 * k, p[1] + 0.38 * k])))); }
  floor(poly, fill, o = {}) { this.ground.push(`<path d="${this.d2(poly.map((p) => P(p[0], p[1], 0)), o.open)}"${this.attrs(fill, o)}/>`); }
  svg() {
    let sh = ''; for (const h of this.sh) sh += this.d2(h.map((p) => P(p[0], p[1], 0)));
    const pad = 12, x0 = Math.floor(this.mn[0] - pad), y0 = Math.floor(this.mn[1] - pad);
    const w = Math.ceil(this.mx[0] + pad) - x0, h = Math.ceil(this.mx[1] + pad) - y0;
    const body = this.g.sort((a, b) => b.depth - a.depth).map((g) => g.s.map((e) => `<path d="${e.d}"${e.a}/>`).join('')).join('\n');
    const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" width="${w}" height="${h}">\n` +
      `<g stroke="${SEP}" stroke-width=".8" stroke-linejoin="round" stroke-linecap="round">\n` +
      this.ground.join('') + '\n' +
      (sh ? `<path d="${sh}" fill="#543e2a" fill-opacity=".2" stroke="none"/>\n` : '') + body + '\n</g>\n</svg>\n';
    return { svg: out, w, h, x0, y0 };
  }
}

const lit = (n) => -n[1] >= -n[0]; // piu' rivolta a sud che a ovest: in luce
const vis2 = (n) => -n[0] - n[1] > 1e-6;
function mkFace(a, b, n, z0, z1) {
  if (a[0] - a[1] > b[0] - b[1]) [a, b] = [b, a];
  return { a, b, n, z0, z1, len: Math.hypot(b[0] - a[0], b[1] - a[1]), vis: vis2(n), lit: lit(n) };
}
const fp = (f, t, z) => [f.a[0] + ((f.b[0] - f.a[0]) * t) / f.len, f.a[1] + ((f.b[1] - f.a[1]) * t) / f.len, z];
const tone = (f, col) => (f.lit ? col[0] : col[1]);
function wall(sc, f, col, o) { sc.path([fp(f, 0, f.z0), fp(f, f.len, f.z0), fp(f, f.len, f.z1), fp(f, 0, f.z1)], tone(f, col), o); }
function rect(sc, f, t0, t1, z0, z1, fill, o = {}) { sc.path([fp(f, t0, z0), fp(f, t1, z0), fp(f, t1, z1), fp(f, t0, z1)], fill, o); }

/** Parallelepipedo orientato. ang = direzione dell'asse lungo, gradi da nord in senso orario. */
function box(sc, { c, ang = 0, L, W, z0 = 0, h, col, draw = true, shadow = true, sw }) {
  const a = rad(ang), u = [Math.sin(a), Math.cos(a)], v = [Math.cos(a), -Math.sin(a)];
  const q = (su, sv) => [c[0] + (u[0] * su * L) / 2 + (v[0] * sv * W) / 2, c[1] + (u[1] * su * L) / 2 + (v[1] * sv * W) / 2];
  const z1 = z0 + h, b = { c, ang, u, v, L, W, z0, z1, col, poly: [q(-1, -1), q(1, -1), q(1, 1), q(-1, 1)] };
  b.f = {
    pu: mkFace(q(1, -1), q(1, 1), u, z0, z1), mu: mkFace(q(-1, -1), q(-1, 1), [-u[0], -u[1]], z0, z1),
    pv: mkFace(q(-1, 1), q(1, 1), v, z0, z1), mv: mkFace(q(-1, -1), q(1, -1), [-v[0], -v[1]], z0, z1),
  };
  b.vis = Object.values(b.f).filter((f) => f.vis);
  b.left = b.vis.slice().sort((p, r) => (p.a[0] - p.a[1] + p.b[0] - p.b[1]) - (r.a[0] - r.a[1] + r.b[0] - r.b[1]))[0];
  b.right = b.vis.find((f) => f !== b.left) || b.left;
  if (shadow && z0 < 0.5) sc.shadow(b.poly, z1);
  if (draw) for (const f of b.vis) wall(sc, f, col, sw ? { sw } : undefined);
  return b;
}
const DET = { sw: 0.5, batch: true };
function win(sc, f, t, z, w, h, fill = VETRO, o = {}) { rect(sc, f, t - w / 2, t + w / 2, z, z + h, fill, { ...DET, ...o }); }
function arch(sc, f, t, z, w, h, fill = BUIO, o = {}) {
  const r = w / 2, pts = [fp(f, t - r, z), fp(f, t - r, z + h - r)];
  for (let i = 1; i < 4; i++) { const an = Math.PI - (i * Math.PI) / 4; pts.push(fp(f, t + r * Math.cos(an), z + h - r + r * Math.sin(an))); }
  pts.push(fp(f, t + r, z + h - r), fp(f, t + r, z));
  sc.path(pts, fill, { ...DET, ...o });
}
/** Finestra a lunetta (semicerchio con la corda in basso). */
function lunetta(sc, f, t, z, r, fill = VETRO, o = {}) {
  const pts = []; for (let i = 0; i <= 6; i++) { const an = Math.PI - (i * Math.PI) / 6; pts.push(fp(f, t + r * Math.cos(an), z + r * Math.sin(an))); }
  sc.path(pts, fill, { ...DET, ...o });
}
const row = (f, n, m0 = 1, m1 = m0) => { const out = []; for (let i = 0; i < n; i++) out.push(m0 + ((f.len - m0 - m1) * (i + 0.5)) / n); return out; };
function hline(sc, f, z, t0 = 0, t1 = f.len, o = {}) { sc.line([fp(f, t0, z), fp(f, t1, z)], { ...DET, ...o }); }

const R3 = (p, z) => [p[0], p[1], z];
function plane(sc, pts3, nh, nz, col, o) {
  if (nh[0] * D[0] + nh[1] * D[1] + nz * D[2] <= 0) return;
  sc.path(pts3, Math.hypot(nh[0], nh[1]) < 1e-6 || lit(nh) ? col[0] : col[1], o);
}
const ext = (b, su, sv, ou, ov) => [b.c[0] + b.u[0] * su * (b.L / 2 + ou) + b.v[0] * sv * (b.W / 2 + ov), b.c[1] + b.u[1] * su * (b.L / 2 + ou) + b.v[1] * sv * (b.W / 2 + ov)];
/** Due falde, colmo lungo l'asse lungo. */
function gable(sc, b, rh, col, { ov = 0.5, timpano = b.col } = {}) {
  const z = b.z1, zr = z + rh;
  for (const key of ['pu', 'mu']) { const f = b.f[key]; if (f.vis) sc.path([fp(f, 0, z), fp(f, f.len, z), fp(f, f.len / 2, zr)], tone(f, timpano)); }
  const r0 = ext(b, -1, 0, ov, 0), r1 = ext(b, 1, 0, ov, 0);
  const sides = [1, -1].sort((p, q) => (-(p * b.v[0]) - p * b.v[1]) - (-(q * b.v[0]) - q * b.v[1]));
  for (const s of sides) plane(sc, [R3(ext(b, -1, s, ov, ov), z), R3(ext(b, 1, s, ov, ov), z), R3(r1, zr), R3(r0, zr)], [s * b.v[0] * rh, s * b.v[1] * rh], b.W / 2 + ov, col);
}
/** Quattro falde; se L = W diventa una piramide. */
function hip(sc, b, rh, col, { ov = 0.5 } = {}) {
  const z = b.z1, zr = z + rh, half = Math.max(0, b.L / 2 - b.W / 2);
  const r0 = [b.c[0] - b.u[0] * half, b.c[1] - b.u[1] * half], r1 = [b.c[0] + b.u[0] * half, b.c[1] + b.u[1] * half];
  const pl = [];
  for (const s of [1, -1]) pl.push({ n: [s * b.v[0], s * b.v[1]], run: b.W / 2 + ov, pts: [R3(ext(b, -1, s, ov, ov), z), R3(ext(b, 1, s, ov, ov), z), R3(r1, zr), R3(r0, zr)] });
  for (const s of [1, -1]) pl.push({ n: [s * b.u[0], s * b.u[1]], run: b.L / 2 + ov - half, pts: [R3(ext(b, s, -1, ov, ov), z), R3(ext(b, s, 1, ov, ov), z), R3(s > 0 ? r1 : r0, zr)] });
  pl.sort((p, q) => (-p.n[0] - p.n[1]) - (-q.n[0] - q.n[1]));
  for (const p of pl) plane(sc, p.pts, [p.n[0] * rh, p.n[1] * rh], p.run, col);
}
/** Merli sulle facce in vista di una scatola, con il piano di calpestio. */
function merli(sc, b, mh, mw, col, floorCol) {
  const z = b.z1; sc.path(b.poly.map((p) => R3(p, z)), floorCol);
  for (const f of b.vis) {
    const n = Math.max(2, Math.round((f.len / mw + 1) / 2)), w = f.len / (2 * n - 1);
    for (let i = 0; i < n; i++) rect(sc, f, 2 * i * w, (2 * i + 1) * w, z, z + mh, tone(f, col), { sw: 0.6, batch: true });
  }
}
const ccw = (poly) => { let A = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; A += a[0] * b[1] - b[0] * a[1]; } return A < 0 ? poly.slice().reverse() : poly; };
const lontano = (p, q) => (q.a[0] + q.a[1] + q.b[0] + q.b[1]) - (p.a[0] + p.a[1] + p.b[0] + p.b[1]);
/** Finestra scritta con comandi relativi (meno byte): serve alle tante finestre delle case. */
function finestra(sc, f, t, z, w, h, fill) {
  const a = P(...fp(f, t - w / 2, z)), b = P(...fp(f, t + w / 2, z)), dz = h * 0.8165 * S;
  sc.reg(a); sc.reg([b[0], b[1] - dz]);
  sc.emit(`M${f1(a[0])} ${f1(a[1])}l${f1(b[0] - a[0])} ${f1(b[1] - a[1])}v${f1(-dz)}l${f1(a[0] - b[0])} ${f1(a[1] - b[1])}z`, sc.attrs(fill, { sw: 0.4 }), true);
}
/** Due gruppi (ombra, luce) in ordine: prima quello che in media sta piu' lontano. */
function perTono(fl, disegna) {
  const g = [fl.filter((f) => !f.lit), fl.filter((f) => f.lit)].filter((q) => q.length);
  const media = (q) => q.reduce((t, f) => t + f.a[0] + f.a[1] + f.b[0] + f.b[1], 0) / q.length;
  g.sort((p, q) => media(q) - media(p));
  for (const q of g) for (const f of q) disegna(f);
}
/** Prisma su poligono qualsiasi: pareti raggruppate per tono, poi i dettagli di `su(faccia)`. */
function prism(sc, poly, z0, h, col, su, ombra = true) {
  poly = ccw(poly); if (ombra) sc.shadow(poly, z0 + h);
  const fs_ = [];
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const f = mkFace(a, b, [b[1] - a[1], -(b[0] - a[0])], z0, z0 + h); if (f.vis && f.len > 0.3) fs_.push(f); }
  fs_.sort(lontano);
  perTono(fs_, (f) => wall(sc, f, col, { batch: true }));
  if (su) for (const f of fs_) su(f);
}
/** Tetto a falde su un poligono qualsiasi: ogni lato sale verso il colmo del rettangolo orientato. */
function tettoPoli(sc, poly, z, rh, col) {
  poly = ccw(poly); const o = obb(poly), a = rad(o.ang), u = [Math.sin(a), Math.cos(a)], half = Math.max(0, o.L / 2 - o.W / 2);
  const pr = (p) => { const t = Math.max(-half, Math.min(half, (p[0] - o.c[0]) * u[0] + (p[1] - o.c[1]) * u[1])); return [o.c[0] + u[0] * t, o.c[1] + u[1] * t]; };
  const fl = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], pp = pr(p), qq = pr(q);
    const e1 = [q[0] - p[0], q[1] - p[1], 0], e2 = [pp[0] - p[0], pp[1] - p[1], rh];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (n[0] * D[0] + n[1] * D[1] + n[2] * D[2] > 0) fl.push({ a: p, b: q, n, pts: [R3(p, z), R3(q, z), R3(qq, z + rh), R3(pp, z + rh)] });
  }
  fl.sort(lontano); for (const f of fl) f.lit = lit(f.n);
  perTono(fl, (f) => sc.path(f.pts, f.lit ? col[0] : col[1], { batch: true }));
}

// ---------------------------------------------------------------- tinte: [in luce, in ombra]
const SASSO = ['#e0d2b0', '#b9a783']; // ciottoli del Brenta
const MATTONE = ['#c98f6e', '#a8704f']; // riservato alle torri
const COTTO = ['#c8623a', '#a84e2f'];
const CREMA = ['#f3e6cc', '#dccbaa'], ROSA = ['#e8b494', '#cf9a7b'], PAGLIA = ['#f0d9a0', '#d8bf87'];
const BUIO = '#4a382c', VETRO = '#6f5c4d', CIPRESSO = ['#6f8a5b', '#56704c'];
const PRATO = ['#c9d6a0', '#a9b982'], CORTE = '#f0e3c6', VIA = '#e2d3b0';

// ---------------------------------------------------------------- dati
const base = JSON.parse(fs.readFileSync(path.join(RADICE, 'public/data/base.json'), 'utf8'));
/** Punto d'appoggio (metri locali) e raggio entro cui la mappa nasconde gli edifici generici. */
const A = [-140, 284];
const COPRE = 66;
const rel = (p) => [p[0] - A[0], p[1] - A[1]];
const edifici = [];
for (const e of base.edifici) {
  const n = e.p.length >> 1; let mx = 0, my = 0; const poly = [];
  for (let i = 0; i < n; i++) { mx += e.p[2 * i]; my += e.p[2 * i + 1]; poly.push([e.p[2 * i], e.p[2 * i + 1]]); }
  mx /= n; my /= n; // centro come lo calcola la mappa (src/map/scena.ts)
  if (Math.hypot(mx - A[0], my - A[1]) > COPRE) continue;
  const l = poly.length - 1; if (poly[0][0] === poly[l][0] && poly[0][1] === poly[l][1]) poly.pop();
  edifici.push({ c: [mx, my], poly: poly.map(rel), h: e.h, t: e.t, n: e.n });
}
/** L'edificio di base.json il cui centro e' piu' vicino al punto dato. */
function prendi(x, y) {
  let k = -1, d = 6;
  edifici.forEach((e, i) => { const q = Math.hypot(e.c[0] - x, e.c[1] - y); if (!e.preso && q < d) { d = q; k = i; } });
  if (k < 0) throw new Error(`nessun edificio vicino a ${x},${y}`);
  edifici[k].preso = true; return edifici[k];
}
// Mura: vertici in pixel di plan/castello.svg (centro 450,450 = -123.48,289.70 m; 3.125 px/m).
const pm = (q) => rel([-123.48 + (q[0] - 450) / 3.125, 289.7 - (q[1] - 450) / 3.125]);
const MURA = {
  ovestSud: [[287.8, 622.4], [312.1, 502.9], [317.6, 470.4], [321.4, 447.2]],
  ovestNord: [[328.2, 420.6], [339.2, 383.2], [347.6, 354.7], [383.9, 305.8], [407.9, 282.4]],
  nordEst: [[429.5, 271], [454.2, 297.2], [518.4, 374.3]],
  bastione: [[518.4, 374.3], [509.1, 380.9], [522.4, 399.3], [537.9, 387.9], [524.8, 369.7], [518.4, 374.3]],
  est: [[529.6, 393.8], [551.3, 446], [563.8, 467.9], [567.7, 474.8], [597.4, 484.9], [587.5, 504.8]],
  sudEst: [[462.9, 594.5], [472.4, 588.8], [543.9, 541.7], [563.7, 529.1]],
  porta: [[563.7, 529.1], [582.2, 520]],
  sud: [[305.5, 634.1], [396.8, 611.2], [414.9, 606], [438, 599]],
};
for (const k in MURA) MURA[k] = MURA[k].map(pm);

const sc = new Scene();
const peso = () => sc.g.reduce((t, g) => t + g.s.reduce((u, e) => u + e.d.length + e.a.length + 11, 0), 0);
let prima = 0; const tappa = (n) => { const p = peso(); if (process.env.PESO) console.error(n, p - prima); prima = p; };

// ---------------------------------------------------------------- terreno
const ovest = [...MURA.ovestSud, ...MURA.ovestNord];
const cinta = [...ovest, ...MURA.nordEst, ...MURA.bastione.slice(3, 5).reverse(), ...MURA.est, ...MURA.porta.slice().reverse(), ...MURA.sudEst.slice().reverse(), ...MURA.sud.slice().reverse()];
const poggio = [...cinta]; // punti che il colle deve contenere: mura e torri
sc.floor(cinta, CORTE, { stroke: '#cdbb96', sw: 0.6 });
// La via dalla porta al portale del Duomo, e la rampa che esce dalla porta e scende dal colle.
const VIALE = [rel([-82.5, 254.5]), rel([-84, 260]), rel([-84, 266.5]), rel([-102, 274]), rel([-122, 290]), rel([-128.6, 299.6])];
sc.floor(VIALE, 'none', { open: true, stroke: '#c9b68f', sw: 8.4 });
sc.floor(VIALE, 'none', { open: true, stroke: VIA, sw: 7 });
// ---------------------------------------------------------------- mura merlate
const H_MURA = 9;
function tratto(pl, { h = H_MURA, w = 1.6 } = {}) {
  for (let i = 0; i < pl.length - 1; i++) {
    const a = pl[i], b = pl[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1.5) continue;
    const ang = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI, k = Math.max(1, Math.round(L / 15)), l = L / k;
    sc.shadow([a, b], h); // un'ombra sola per tratto
    for (let j = 0; j < k; j++) {
      const t = (j + 0.5) / k, c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      sc.at(c, () => {
        const bx = box(sc, { c, ang, L: l, W: w, h, col: SASSO, draw: false, shadow: false });
        const f = [bx.f.pv, bx.f.mv].find((q) => q.vis); if (!f) return;
        for (const e of [bx.f.pu, bx.f.mu]) if (e.vis && (j === 0 || j === k - 1)) wall(sc, e, SASSO, { sw: 0.6 });
        // parete e merli in un solo profilo a pettine: pochi merli larghi, leggibili da lontano
        const m = Math.max(1, Math.round(f.len / 4.6)), p = f.len / m, pett = [fp(f, 0, 0), fp(f, f.len, 0), fp(f, f.len, h)];
        const scorcio = Math.abs((f.b[0] - f.a[0]) - (f.b[1] - f.a[1])) / f.len < 0.45; // quasi di taglio: niente merli ad ago
        if (scorcio) pett[2] = fp(f, f.len, h + 1.9), pett.push(fp(f, 0, h + 1.9));
        else for (let q = m - 1; q >= 0; q--) pett.push(fp(f, (q + 0.8) * p, h), fp(f, (q + 0.8) * p, h + 1.9), fp(f, (q + 0.2) * p, h + 1.9), fp(f, (q + 0.2) * p, h));
        if (!scorcio) pett.push(fp(f, 0, h));
        sc.path(pett, tone(f, SASSO), { sw: 0.9 });
        hline(sc, f, h - 1.2, 0, f.len, { sop: 0.45 });
      });
    }
  }
}
for (const k of ['ovestSud', 'ovestNord', 'nordEst', 'bastione', 'est', 'sudEst', 'sud']) tratto(MURA[k]);
tappa('mura');

// La porta accanto alla Torre di Ser Ivano: corpo piu' alto delle mura con il fornice ad arco.
// Licenza: il varco vero guarda a sud-sud-est (azimut 154) e da sud-ovest si vedrebbe di
// taglio; qui il corpo e' girato di 26 gradi, con la fronte a sud, perche' l'arco si legga.
{
  const [a, b] = MURA.porta, c = [(a[0] + b[0]) / 2 - 0.4, (a[1] + b[1]) / 2 - 0.6];
  sc.at(c, () => {
    const bx = box(sc, { c, ang: 90, L: 8, W: 3.4, h: 12.5, col: SASSO, sw: 0.9 });
    const f = bx.f.mv.n[1] < 0 ? bx.f.mv : bx.f.pv;
    arch(sc, f, f.len / 2, 0, 5.4, 7.8, '#f6ecd6', { sw: 0.6 }); arch(sc, f, f.len / 2, 0, 4, 7, BUIO, { sw: 0.6 }); hline(sc, f, 10.8);
    merli(sc, bx, 1.9, 1.5, SASSO, '#cbbb98');
  }, -1);
}

// ---------------------------------------------------------------- torri
function torre(e, { h, lato = 0, quadra = 0, ang, tetto = 0, sasso = 0, archi = [], feritoie = [], bias = 0, sw = 0.9, mw = 1.5, dopo }) {
  const o = obb(e.poly);
  sc.at(o.c, () => {
    const b = box(sc, { c: o.c, ang: ang ?? o.ang, L: quadra || Math.max(o.L, lato), W: quadra || Math.max(o.W, lato), h, col: MATTONE, sw });
    poggio.push(...b.poly);
    for (const f of b.vis) {
      if (sasso) rect(sc, f, 0, f.len, 0, sasso, tone(f, SASSO), { sw: 0.4, sop: 0.6 });
      for (const z of archi) arch(sc, f, f.len / 2, z, 1.5, 3, BUIO);
      for (const z of feritoie) win(sc, f, f.len / 2, z, 0.6, 1.9, BUIO);
    }
    if (tetto) { for (const f of b.vis) hline(sc, f, h - 0.9); hip(sc, b, tetto, COTTO, { ov: 0.5 }); } else { for (const f of b.vis) hline(sc, f, h - 1.6); merli(sc, b, 2, mw, MATTONE, '#b98464'); }
    if (dopo) dopo(b);
  }, bias);
}
// Torre di Ser Ivano: la protagonista. La piu' alta e sottile, in mattoni, merlata, con la bandiera.
const H_IVANO = 38;
torre(prendi(-78, 269), {
  h: H_IVANO, quadra: 6.6, sasso: 7, feritoie: [12, 19, 26], archi: [31], bias: -3, sw: 1.1, mw: 1.3,
  dopo: (b) => {
    const p0 = P(b.c[0], b.c[1], H_IVANO), p1 = P(b.c[0], b.c[1], H_IVANO + 9);
    sc.raw([p0, p1], 'none', { open: true, sw: 0.8 });
    sc.raw([p1, [p1[0] + 15, p1[1] + 3], [p1[0] + 11, p1[1] + 5.5], [p1[0] + 15, p1[1] + 9], [p1[0], p1[1] + 8.5]], '#b5382a', { sw: 0.6 });
  },
});
// Torre dell'Ortazzo (spigolo sud-ovest): bassa e massiccia, con il tetto a padiglione.
torre(prendi(-174, 230), { h: 15.5, tetto: 2.4, sasso: 6, feritoie: [9.5] });
torre(prendi(-123, 244), { h: 12.5, quadra: 7, sasso: 5, feritoie: [7.5], mw: 1.6 }); // torretta sul lato sud
torre(prendi(-134, 348), { h: 12.5, quadra: 8, ang: 0, tetto: 2.4, sasso: 5, feritoie: [8] }); // torre della punta nord
torre(prendi(-163, 297), { h: 11.5, quadra: 5.5, sasso: 5, feritoie: [7], mw: 1.4 }); // torretta sulle mura a ovest
tappa('torri');

// ---------------------------------------------------------------- Duomo di Santa Maria in Colle
/** Croce in cima a un punto (coordinate di schermo). */
const croce = (p, a = 6) => { sc.raw([p, [p[0], p[1] - a]], 'none', { open: true, sw: 0.9 }); sc.raw([[p[0] - a * 0.3, p[1] - a * 0.62], [p[0] + a * 0.3, p[1] - a * 0.62]], 'none', { open: true, sw: 0.9 }); };
{
  const navata = prendi(-132, 309), abside = prendi(-117, 310), camp = prendi(-117, 306);
  const o = obb(navata.poly), H_NAV = 13.5, COLMO = 6.2, H_CAMP = 31;
  // campanile sopra una torre del castello: base in sasso, canna in mattoni, cella con bifore, cuspide
  const cc = obb(camp.poly).c;
  sc.at(cc, () => {
    const b = box(sc, { c: cc, ang: o.ang, L: 5.8, W: 5.8, h: H_CAMP, col: MATTONE, sw: 1 });
    for (const f of b.vis) {
      rect(sc, f, 0, f.len, 0, 10, tone(f, SASSO), { sw: 0.4, sop: 0.6 });
      hline(sc, f, 23.4); hline(sc, f, 24); hline(sc, f, H_CAMP - 1);
      for (const t of [f.len / 2 - 1.15, f.len / 2 + 1.15]) arch(sc, f, t, 24.8, 1.5, 4.4, BUIO);
      win(sc, f, f.len / 2, 16, 0.6, 1.9, BUIO);
    }
    hip(sc, b, 5, COTTO, { ov: 0.6 });
    croce(P(cc[0], cc[1], H_CAMP + 5));
  }, 3);
  // presbiterio a est della navata
  const oa = obb(abside.poly);
  sc.at(oa.c, () => {
    const b = box(sc, { c: oa.c, ang: oa.ang, L: oa.L, W: oa.W, h: 12, col: CREMA });
    for (const f of b.vis) arch(sc, f, f.len / 2, 5.4, 1.5, 4.4, VETRO);
    hip(sc, b, 4, COTTO);
  }, 2);
  // navata unica: tetto ripido, fianco sud scandito da lesene con lunette e portale a timpano
  sc.at(o.c, () => {
    const b = box(sc, { c: o.c, ang: o.ang, L: o.L, W: o.W, h: H_NAV, col: CREMA, sw: 1 });
    gable(sc, b, COLMO, COTTO, { ov: 0.8, timpano: CREMA });
    const sud = [b.f.pv, b.f.mv].find((f) => f.n[1] < 0), testa = [b.f.pu, b.f.mu].find((f) => f.vis);
    const est = sud.a[0] > sud.b[0] ? 0 : sud.len, da = (m) => Math.abs(est - m); // metri dallo spigolo est
    hline(sc, sud, 1.2, 0, sud.len, { sop: 0.5 }); hline(sc, sud, H_NAV - 1);
    for (const m of [2, 10, 18, 26, 33]) sc.line([fp(sud, da(m), 1.2), fp(sud, da(m), H_NAV - 1)], { ...DET, sop: 0.5 });
    for (const m of [6, 14, 22, 29.5]) lunetta(sc, sud, da(m), 8.6, 2.1);
    rect(sc, sud, da(11.6), da(16.4), 0, 6, '#e9dfc9', { sw: 0.6 }); // cornice di pietra del portale
    sc.path([fp(sud, da(11), 6), fp(sud, da(17), 6), fp(sud, da(14), 7.9)], '#e9dfc9', { sw: 0.6 });
    arch(sc, sud, da(14), 0, 2.8, 5, '#7a4e36');
    if (testa) {
      const pts = []; for (let i = 0; i < 12; i++) pts.push(fp(testa, testa.len / 2 + 1.6 * Math.cos((i * Math.PI) / 6), 13.4 + 1.6 * Math.sin((i * Math.PI) / 6)));
      sc.path(pts, VETRO, DET); // rosone sulla testata
      const s = testa === b.f.pu ? 1 : -1, q = ext(b, s, 0, 0.8, 0); croce(P(q[0], q[1], H_NAV + COLMO), 5);
    }
  });
}
tappa('duomo');

// ---------------------------------------------------------------- le poche case dentro le mura
// Scatole orientate sull'impronta reale (rettangolo di area minima), tetto a due falde.
function casa(x, y, { h, col, rh = 2.2, piani = 1 }) {
  const e = prendi(x, y), o = obb(e.poly);
  sc.at(o.c, () => {
    const b = box(sc, { c: o.c, ang: o.ang, L: o.L, W: o.W, h, col });
    for (const f of b.vis) { if (f.len < 5) continue; for (let p = 0; p < piani; p++) for (const t of row(f, Math.max(1, Math.round(f.len / 6)), 1)) finestra(sc, f, t, 1.3 + p * 2.7, 1, 1.4, VETRO); }
    gable(sc, b, rh, COTTO, { ov: 0.6, timpano: col });
  });
}
if (process.env.LISTA) {
  const dentro = (p) => { let c = false; for (let i = 0, j = cinta.length - 1; i < cinta.length; j = i++) { const a = cinta[i], b = cinta[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  for (const e of edifici) if (!e.preso) { const o = obb(e.poly); console.error(e.c.map(Math.round).join(','), dentro(rel(e.c)) ? 'DENTRO' : 'fuori', o.L.toFixed(0) + 'x' + o.W.toFixed(0), 'ang', o.ang.toFixed(0), 'h', e.h, e.t || ''); }
}
casa(-139, 276, { h: 7.4, col: PAGLIA, piani: 2 }); // canonica, lungo il piazzale
casa(-154, 276, { h: 6.6, col: ROSA, piani: 2 }); // casa a ridosso delle mura a ovest
casa(-148, 263, { h: 6.2, col: CREMA, piani: 2 });
casa(-113, 300, { h: 7, col: CREMA, rh: 2 }); // sacrestia
tappa('case');

// ---------------------------------------------------------------- cipressi del piazzale
function cipresso(x, y, h, r = 1.7) {
  sc.at([x, y], () => {
    const pts = [];
    for (let i = 0; i <= 12; i++) for (let j = 0; j < 16; j++) { const th = (i / 12) * Math.PI - Math.PI / 2, ph = (j / 16) * 2 * Math.PI; pts.push(P(x + r * Math.cos(th) * Math.cos(ph), y + r * Math.cos(th) * Math.sin(ph), h / 2 + 0.6 + (h / 2) * Math.sin(th))); }
    const g = hull(pts); sc.raw(g, CIPRESSO[1], { sw: 0.6 });
    const cx = P(x, y, 0)[0]; sc.raw(g.filter((p) => p[0] >= cx - 0.5).map((p) => [cx + (p[0] - cx) * 0.8 + 0.6, p[1] + (p[1] < P(x, y, h / 2)[1] ? 3 : -2)]), CIPRESSO[0], { stroke: 'none' });
    sc.shadow([[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]], h * 0.6);
  }, -2);
}
cipresso(-135.5 - A[0], 296 - A[1], 13); cipresso(-121.5 - A[0], 296.6 - A[1], 12);

// ---------------------------------------------------------------- il colle
// Un poggio erboso piu' largo di mura e torri tutt'attorno, con la scarpata in ombra sotto
// (lo stesso profilo spostato in basso). Il bordo arrotondato e' un tratto spesso.
{
  const R = 26, SCARPA = 9, g = hull(poggio).map((p) => P(p[0], p[1], 0)), d = sc.d2(g);
  for (const q of g) { sc.reg([q[0] - R - 1, q[1] - R - 1]); sc.reg([q[0] + R + 1, q[1] + R + SCARPA + 1]); }
  const giro = (col, w, giu) => `<path d="${d}"${giu ? ` transform="translate(0 ${giu})"` : ''} fill="${col}" stroke="${col}" stroke-width="${w}"/>`;
  // tratteggi sulla scarpata (lati rivolti in basso) e cespugli sul prato
  let tr = '', ce = '';
  g.forEach((p, i) => {
    const q = g[(i + 1) % g.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); let n = [(q[1] - p[1]) / l, -(q[0] - p[0]) / l];
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], cx = g.reduce((t, v) => t + v[0], 0) / g.length, cy = g.reduce((t, v) => t + v[1], 0) / g.length;
    if (n[0] * (m[0] - cx) + n[1] * (m[1] - cy) < 0) n = [-n[0], -n[1]];
    if (l < 40) return;
    if (n[1] > 0.3) for (const t of [0.3, 0.36, 0.7]) tr += `M${f1(p[0] + (q[0] - p[0]) * t + n[0] * R)} ${f1(p[1] + (q[1] - p[1]) * t + n[1] * R + 2.5)}v${t === 0.36 ? 3.5 : 5}`;
    for (const [t, r] of [[0.22, 3.4], [0.27, 2.4], [0.8, 3]]) { const x = p[0] + (q[0] - p[0]) * t + n[0] * (R - 9), y = p[1] + (q[1] - p[1]) * t + n[1] * (R - 9); ce += `M${f1(x - r)} ${f1(y)}a${r} ${f1(r * 0.8)} 0 1 0 ${2 * r} 0a${r} ${f1(r * 0.8)} 0 1 0 ${-2 * r} 0z`; }
  });
  sc.ground.unshift(giro('#7f8a5c', 2 * R + 1.8, SCARPA), giro(PRATO[1], 2 * R, SCARPA), giro('#93a06c', 2 * R + 1.2, 0), giro(PRATO[0], 2 * R, 0),
    `<path d="${tr}" fill="none" stroke-width=".7" stroke-opacity=".6"/>`, `<path d="${ce}" fill="#8fa66f" stroke-width=".6"/>`);
}

// ---------------------------------------------------------------- uscita
const r = sc.svg();
fs.writeFileSync(USCITA, r.svg);
const ancora = [+(-r.x0 / r.w).toFixed(4), +(-r.y0 / r.h).toFixed(4)];
console.log(JSON.stringify({
  file: USCITA, byte: r.svg.length, viewBox: [r.x0, r.y0, r.w, r.h],
  lat: +(45.7665 + A[1] / 110574).toFixed(6), lon: +(11.7345 + A[0] / (111320 * Math.cos(rad(45.7665)))).toFixed(6),
  larghezzaMetri: +(r.w / S).toFixed(1), ancora, copre: COPRE, edifici: edifici.length,
}));
