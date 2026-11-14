// Piccolo motore per disegnare solidi in isometria 2:1 (stessa proiezione di docs/SPEC.md)
// e scriverli come SVG. Coordinate: metri locali rispetto all'ancora, x est, y nord, z su.
import { hull } from './geo.mjs';

export const S = 4; // unita' SVG per metro isometrico
export const SEP = '#5b4636';
export const P = (x, y, z = 0) => [(x - y) * 0.7071 * S, (-(x + y) * 0.35355 - z * 0.8165) * S];
const D = [-1, -1, 0.866]; // verso l'osservatore
const f1 = (n) => { let s = n.toFixed(1); if (s.endsWith('.0')) s = s.slice(0, -2); return s === '-0' ? '0' : s; };
const rad = (a) => (a * Math.PI) / 180;

export class Scene {
  constructor() { this.g = []; this.cur = null; this.sh = []; this.mn = [1e9, 1e9]; this.mx = [-1e9, -1e9]; this.ground = []; }
  solid(depth, fn) { const prev = this.cur; this.cur = { depth, s: [] }; fn(); this.g.push(this.cur); this.cur = prev; }
  at(c, fn, bias = 0) { this.solid(c[0] + c[1] + bias, fn); }
  emit(d, a, batch) { if (!this.cur) throw new Error('emit fuori da solid'); const s = this.cur.s, l = s[s.length - 1]; if (batch && l && l.batch && l.a === a) l.d += d; else s.push({ d, a, batch }); }
  reg(q) { for (let i = 0; i < 2; i++) { if (q[i] < this.mn[i]) this.mn[i] = q[i]; if (q[i] > this.mx[i]) this.mx[i] = q[i]; } }
  d2(pts2, open) { let d = ''; pts2.forEach((q, i) => { this.reg(q); d += (i ? 'L' : 'M') + f1(q[0]) + ' ' + f1(q[1]); }); return d + (open ? '' : 'Z'); }
  attrs(fill, o = {}) {
    let a = ` fill="${fill}"`;
    if (o.stroke) a += ` stroke="${o.stroke}"`;
    if (o.sw != null) a += ` stroke-width="${o.sw}"`;
    if (o.op != null) a += ` fill-opacity="${o.op}"`;
    if (o.sop != null) a += ` stroke-opacity="${o.sop}"`;
    return a;
  }
  raw(pts2, fill, o = {}) { this.emit(this.d2(pts2, o.open), this.attrs(fill, o), o.batch); }
  rawd(d, fill, o = {}) { this.emit(d, this.attrs(fill, o), o.batch); }
  path(pts3, fill, o = {}) { this.raw(pts3.map((p) => P(p[0], p[1], p[2] || 0)), fill, o); }
  line(pts3, o = {}) { this.path(pts3, 'none', { open: true, ...o }); }
  shadow(poly, h) {
    const k = Math.min(h, 26) * 0.42; const off = [-0.8 * k, 0.38 * k];
    this.sh.push(hull(poly.concat(poly.map((p) => [p[0] + off[0], p[1] + off[1]]))));
  }
  floor(poly, fill, o = {}) { this.ground.push(`<path d="${this.d2(poly.map((p) => P(p[0], p[1], 0)))}"${this.attrs(fill, o)}/>`); }
  svg() {
    let sh = '';
    for (const h of this.sh) sh += this.d2(h.map((p) => P(p[0], p[1], 0)));
    const pad = 2;
    const x0 = Math.floor(this.mn[0] - pad), y0 = Math.floor(this.mn[1] - pad);
    const w = Math.ceil(this.mx[0] + pad) - x0, h = Math.ceil(this.mx[1] + pad) - y0;
    const body = this.g.sort((a, b) => b.depth - a.depth).map((g) => g.s.map((e) => `<path d="${e.d}"${e.a}/>`).join('')).join('\n');
    const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" width="${w}" height="${h}">\n` +
      `<g stroke="${SEP}" stroke-width=".8" stroke-linejoin="round" stroke-linecap="round">\n` +
      (sh ? `<path d="${sh}" fill="#543e2a" fill-opacity=".2" stroke="none"/>\n` : '') +
      this.ground.join('') + '\n' + body + '\n</g>\n</svg>\n';
    return { svg: out, w, h, ancora: [+((0 - x0) / w).toFixed(4), +((0 - y0) / h).toFixed(4)], larghezzaMetri: +(w / S).toFixed(1) };
  }
}

const lit = (n) => -n[1] >= -n[0]; // piu' rivolta a sud che a ovest
const vis2 = (n) => -n[0] - n[1] > 1e-6;

function mkFace(a, b, n, z0, z1) {
  if (a[0] - a[1] > b[0] - b[1]) [a, b] = [b, a];
  return { a, b, n, z0, z1, len: Math.hypot(b[0] - a[0], b[1] - a[1]), vis: vis2(n), lit: lit(n) };
}
export const fp = (f, t, z) => [f.a[0] + ((f.b[0] - f.a[0]) * t) / f.len, f.a[1] + ((f.b[1] - f.a[1]) * t) / f.len, z];

/** Parallelepipedo orientato. ang = direzione dell'asse lungo, gradi da nord in senso orario. */
export function box(sc, { c, ang = 0, L, W, z0 = 0, h, col, draw = true, shadow = true, top = null }) {
  const a = rad(ang); const u = [Math.sin(a), Math.cos(a)], v = [Math.cos(a), -Math.sin(a)];
  const q = (su, sv) => [c[0] + (u[0] * su * L) / 2 + (v[0] * sv * W) / 2, c[1] + (u[1] * su * L) / 2 + (v[1] * sv * W) / 2];
  const z1 = z0 + h;
  const b = { c, ang, u, v, L, W, z0, z1, col, q, poly: [q(-1, -1), q(1, -1), q(1, 1), q(-1, 1)] };
  b.f = {
    pu: mkFace(q(1, -1), q(1, 1), u, z0, z1), mu: mkFace(q(-1, -1), q(-1, 1), [-u[0], -u[1]], z0, z1),
    pv: mkFace(q(-1, 1), q(1, 1), v, z0, z1), mv: mkFace(q(-1, -1), q(1, -1), [-v[0], -v[1]], z0, z1),
  };
  b.vis = Object.values(b.f).filter((f) => f.vis);
  b.hid = Object.values(b.f).filter((f) => !f.vis);
  /** faccia visibile a sinistra (ombra) e a destra (luce) sullo schermo */
  b.left = b.vis.slice().sort((p, r) => (p.a[0] - p.a[1] + p.b[0] - p.b[1]) - (r.a[0] - r.a[1] + r.b[0] - r.b[1]))[0];
  b.right = b.vis.find((f) => f !== b.left) || b.left;
  if (shadow && z0 < 0.5) sc.shadow(b.poly, z1);
  if (draw) {
    for (const f of b.vis) wall(sc, f, col);
    if (top) sc.path(b.poly.map((p) => [p[0], p[1], z1]), top);
  }
  return b;
}
export function wall(sc, f, col, o) { sc.path([fp(f, 0, f.z0), fp(f, f.len, f.z0), fp(f, f.len, f.z1), fp(f, 0, f.z1)], f.lit ? col[0] : col[1], o); }

// ---- dettagli sulle facce -------------------------------------------------
export function win(sc, f, t, z, w, h, fill = '#6a5545', o = {}) {
  sc.path([fp(f, t - w / 2, z), fp(f, t + w / 2, z), fp(f, t + w / 2, z + h), fp(f, t - w / 2, z + h)], fill, { sw: 0.5, batch: true, ...o });
}
export function arch(sc, f, t, z, w, h, fill = '#5b4636', o = {}) {
  const r = w / 2, pts = [fp(f, t - r, z), fp(f, t - r, z + h - r)];
  for (let i = 1; i < 6; i++) { const an = Math.PI - (i * Math.PI) / 6; pts.push(fp(f, t + r * Math.cos(an), z + h - r + r * Math.sin(an))); }
  pts.push(fp(f, t + r, z + h - r), fp(f, t + r, z));
  sc.path(pts, fill, { sw: 0.5, batch: true, ...o });
}
export function ogiva(sc, f, t, z, w, h, fill = '#5b4636', o = {}) {
  const r = w / 2;
  sc.path([fp(f, t - r, z), fp(f, t - r, z + h - w * 0.9), fp(f, t - r * 0.55, z + h - w * 0.35), fp(f, t, z + h), fp(f, t + r * 0.55, z + h - w * 0.35), fp(f, t + r, z + h - w * 0.9), fp(f, t + r, z)], fill, { sw: 0.5, batch: true, ...o });
}
export function tondo(sc, f, t, z, r, fill, o = {}) {
  const pts = []; for (let i = 0; i < 14; i++) { const an = (i * Math.PI) / 7; pts.push(fp(f, t + r * Math.cos(an), z + r * Math.sin(an))); }
  sc.path(pts, fill, { sw: 0.5, batch: true, ...o });
}
export function row(f, n, m0 = 1, m1 = m0) { const out = []; for (let i = 0; i < n; i++) out.push(m0 + ((f.len - m0 - m1) * (i + 0.5)) / n); return out; }
export function hline(sc, f, z, t0 = 0, t1 = f.len, o = {}) { sc.line([fp(f, t0, z), fp(f, t1, z)], { sw: 0.5, batch: true, ...o }); }
export function vline(sc, f, t, z0 = f.z0, z1 = f.z1, o = {}) { sc.line([fp(f, t, z0), fp(f, t, z1)], { sw: 0.5, batch: true, ...o }); }

// ---- tetti ---------------------------------------------------------------
const R3 = (p, z) => [p[0], p[1], z];
function plane(sc, pts3, nh, nz, col, o) {
  const n = [nh[0], nh[1], nz];
  if (n[0] * D[0] + n[1] * D[1] + n[2] * D[2] <= 0) return;
  const flat = Math.hypot(nh[0], nh[1]) < 1e-6;
  sc.path(pts3, flat || lit(nh) ? col[0] : col[1], o);
}
const ext = (b, su, sv, ou, ov) => [b.c[0] + b.u[0] * su * (b.L / 2 + ou) + b.v[0] * sv * (b.W / 2 + ov), b.c[1] + b.u[1] * su * (b.L / 2 + ou) + b.v[1] * sv * (b.W / 2 + ov)];

/** Due falde, colmo lungo l'asse lungo. */
export function gable(sc, b, rh, col, { ov = 0.5, timpano = b.col } = {}) {
  const z = b.z1, zr = z + rh;
  for (const [key, su] of [['pu', 1], ['mu', -1]]) {
    const f = b.f[key]; if (!f.vis) continue;
    sc.path([fp(f, 0, z), fp(f, f.len, z), fp(f, f.len / 2, zr)], f.lit ? timpano[0] : timpano[1]);
  }
  const r0 = ext(b, -1, 0, ov, 0), r1 = ext(b, 1, 0, ov, 0);
  const sides = [1, -1].sort((p, q) => (-(p * b.v[0]) - p * b.v[1]) - (-(q * b.v[0]) - q * b.v[1]));
  for (const s of sides) {
    plane(sc, [R3(ext(b, -1, s, ov, ov), z), R3(ext(b, 1, s, ov, ov), z), R3(r1, zr), R3(r0, zr)], [s * b.v[0] * rh, s * b.v[1] * rh], b.W / 2 + ov, col);
  }
}
/** Quattro falde (padiglione); se L = W diventa una piramide. */
export function hip(sc, b, rh, col, { ov = 0.5, k = 1 } = {}) {
  const z = b.z1, zr = z + rh; const half = Math.max(0, b.L / 2 - (b.W / 2) * k);
  const r0 = [b.c[0] - b.u[0] * half, b.c[1] - b.u[1] * half], r1 = [b.c[0] + b.u[0] * half, b.c[1] + b.u[1] * half];
  const run = b.W / 2 + ov, runU = b.L / 2 + ov - half;
  const pl = [];
  for (const s of [1, -1]) pl.push({ n: [s * b.v[0], s * b.v[1]], run, pts: [R3(ext(b, -1, s, ov, ov), z), R3(ext(b, 1, s, ov, ov), z), R3(r1, zr), R3(r0, zr)] });
  for (const s of [1, -1]) pl.push({ n: [s * b.u[0], s * b.u[1]], run: runU, pts: [R3(ext(b, s, -1, ov, ov), z), R3(ext(b, s, 1, ov, ov), z), R3(s > 0 ? r1 : r0, zr)] });
  pl.sort((p, q) => (-p.n[0] - p.n[1]) - (-q.n[0] - q.n[1]));
  for (const p of pl) plane(sc, p.pts, [p.n[0] * rh, p.n[1] * rh], p.run, col);
}
/** Una falda: il lato alto e' quello verso s*v. */
export function shed(sc, b, rh, col, s = 1, { ov = 0.3 } = {}) {
  const z = b.z1;
  for (const key of ['pu', 'mu']) {
    const f = b.f[key]; if (!f.vis) continue;
    const su = key === 'pu' ? 1 : -1; const hi = ext(b, su, s, 0, 0), lo = ext(b, su, -s, 0, 0);
    sc.path([R3(lo, z), R3(hi, z), R3(hi, z + rh)], f.lit ? b.col[0] : b.col[1]);
  }
  const fhi = s > 0 ? b.f.pv : b.f.mv;
  if (fhi.vis) sc.path([fp(fhi, 0, z), fp(fhi, fhi.len, z), fp(fhi, fhi.len, z + rh), fp(fhi, 0, z + rh)], fhi.lit ? b.col[0] : b.col[1]);
  plane(sc, [R3(ext(b, -1, -s, ov, ov), z), R3(ext(b, 1, -s, ov, ov), z), R3(ext(b, 1, s, ov, 0), z + rh), R3(ext(b, -1, s, ov, 0), z + rh)], [-s * b.v[0] * rh, -s * b.v[1] * rh], b.W + ov, col);
}
/** Merli sul bordo di una scatola, con il piano di calpestio. */
export function merli(sc, b, mh, mw, col, floorCol, back = true) {
  const z = b.z1;
  sc.path(b.poly.map((p) => R3(p, z)), floorCol || col[1]);
  const one = (f, tone) => {
    const n = Math.max(2, Math.round((f.len / mw + 1) / 2)); const w = f.len / (2 * n - 1);
    for (let i = 0; i < n; i++) sc.path([fp(f, 2 * i * w, z), fp(f, (2 * i + 1) * w, z), fp(f, (2 * i + 1) * w, z + mh), fp(f, 2 * i * w, z + mh)], tone, { sw: 0.6, batch: true });
  };
  if (back) for (const f of b.hid) one(f, col[1]);
  for (const f of b.vis) one(f, f.lit ? col[0] : col[1]);
}
/** Prisma su poligono qualsiasi (antiorario). */
const ccw = (poly) => { let A = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; A += a[0] * b[1] - b[0] * a[1]; } return A < 0 ? poly.slice().reverse() : poly; };
export function prism(sc, poly, z0, h, col, { top = null, shadow = true } = {}) {
  poly = ccw(poly);
  if (shadow && z0 < 0.5) sc.shadow(poly, z0 + h);
  const fs = [];
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const n = [b[1] - a[1], -(b[0] - a[0])]; const f = mkFace(a, b, n, z0, z0 + h); if (f.vis) fs.push(f); }
  fs.sort((p, q) => (q.a[0] + q.a[1] + q.b[0] + q.b[1]) - (p.a[0] + p.a[1] + p.b[0] + p.b[1]));
  for (const f of fs) wall(sc, f, col);
  if (top) sc.path(poly.map((p) => R3(p, z0 + h)), top);
  return fs;
}
export function cone(sc, poly, zb, apex, col) {
  poly = ccw(poly);
  const tri = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const e1 = [b[0] - a[0], b[1] - a[1], 0], e2 = [apex[0] - a[0], apex[1] - a[1], apex[2] - zb];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (n[0] * D[0] + n[1] * D[1] + n[2] * D[2] > 0) tri.push({ a, b, n });
  }
  for (const t of tri) sc.path([R3(t.a, zb), R3(t.b, zb), apex], lit(t.n) ? col[0] : col[1]);
}
export function ngon(c, r, n, rot = 0, a0 = 0, a1 = 360) {
  const out = []; for (let i = 0; i <= n; i++) { if (a1 - a0 >= 360 && i === n) break; const an = rad(rot + a0 + ((a1 - a0) * i) / n); out.push([c[0] + r * Math.cos(an), c[1] + r * Math.sin(an)]); } return out;
}
/** Sagoma sullo schermo di un ellissoide (assi a lungo ang, b di traverso, cz in alto). */
export function ellissoide(c3, ang, a, b, cz) {
  const an = rad(ang), u = [Math.sin(an), Math.cos(an)], v = [Math.cos(an), -Math.sin(an)]; const pts = [];
  for (let i = 0; i <= 16; i++) for (let j = 0; j < 40; j++) {
    const th = (i / 16) * Math.PI - Math.PI / 2, ph = (j / 40) * 2 * Math.PI;
    const lu = a * Math.cos(th) * Math.cos(ph), lv = b * Math.cos(th) * Math.sin(ph), lz = cz * Math.sin(th);
    pts.push(P(c3[0] + u[0] * lu + v[0] * lv, c3[1] + u[1] * lu + v[1] * lv, c3[2] + lz));
  }
  return hull(pts);
}
/** Curva liscia chiusa (Catmull-Rom) da punti 2D. */
export function smooth(pts, sc) {
  const n = pts.length; let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`;
    if (sc) { sc.reg(p1); sc.reg(c1); sc.reg(c2); }
  }
  return d + 'Z';
}
export function smoothOpen(pts, sc) {
  const n = pts.length; let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`;
    if (sc) { sc.reg(p1); sc.reg(p2); }
  }
  return d;
}
