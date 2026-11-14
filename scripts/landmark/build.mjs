// Genera public/landmarks/*.svg e indice.json a partire dalle impronte OpenStreetMap (osm.json).
import fs from 'fs';
import path from 'path';
import { obb, pts, toLL } from './geo.mjs';
import { Scene, S, P, SEP, box, wall, win, arch, ogiva, tondo, row, hline, vline, gable, hip, shed, merli, prism, cone, ngon, ellissoide, smooth, smoothOpen, fp } from './iso.mjs';

const OUT = process.argv[2];
const only = process.argv[3];
const rad = (a) => (a * Math.PI) / 180;

// tinte: [faccia in luce, faccia in ombra]
const OCRA = ['#f1dcae', '#d6bc88'], ROSA = ['#eec0a0', '#d19f82'], CREMA = ['#f5e9d2', '#dacbae'], GIALLO = ['#f0d08e', '#d3b06f'];
const PIETRA = ['#e8dcc2', '#c8b99b'], MATTONE = ['#d9a784', '#b88565'], MURA = ['#dcc4a0', '#bda37f'];
const COTTO = ['#c8643c', '#a84e30'], LEGNO = ['#a85f45', '#7d4433'], LEGNO_SCURO = ['#8a4a36', '#663629'];
const BUIO = '#4d3b2f', VETRO = '#6f5c4d', VERDE = '#5f7a5a';

const rel = (A) => (p) => [p[0] - A[0], p[1] - A[1]];
const models = {};

// ---------------------------------------------------------------- Ponte Vecchio
models['ponte-vecchio'] = () => {
  const o = obb(145926592); const A = o.c; const sc = new Scene();
  const L = 66, W = 8, zd = 4.2, zp = zd + 1.1, zb = zd + 3.5, ang = o.ang;
  const b = box(sc, { c: [0, 0], ang, L, W, z0: zd, h: zb - zd, draw: false, shadow: false });
  const at = (s, t) => [b.u[0] * s + b.v[0] * t, b.u[1] * s + b.v[1] * t];
  sc.shadow([at(-L / 2, -W / 2), at(L / 2, -W / 2), at(L / 2, W / 2), at(-L / 2, W / 2)], 10);
  const south = b.f.pv, north = b.f.mv, T = (s) => s + L / 2;
  sc.solid(0, () => {
    // spalle in pietra
    for (const s of [L / 2 - 2.5, -L / 2 + 2.5]) box(sc, { c: at(s, 0), ang, L: 5, W: W + 2.4, h: zd - 0.4, col: PIETRA, shadow: false });
    // quattro pile di legno con rostri, da est a ovest
    for (const s of [19.5, 6.5, -6.5, -19.5]) {
      const poly = [at(s - 1.2, 6.4), at(s, 9.2), at(s + 1.2, 6.4), at(s + 1.2, -6.4), at(s, -9.2), at(s - 1.2, -6.4)].reverse();
      const fs_ = prism(sc, poly, 0, zd - 0.5, LEGNO_SCURO, { shadow: false });
      for (const f of fs_) if (f.len > 4) for (const t of row(f, 5, 0.6)) vline(sc, f, t, 0, zd - 0.5, { sop: 0.5 });
    }
    // impalcato
    const d = box(sc, { c: [0, 0], ang, L, W, z0: zd - 0.6, h: 0.6, col: LEGNO_SCURO, shadow: false });
    // saette dalle pile all'impalcato (lato sud, visibile)
    for (const s of [19.5, 6.5, -6.5, -19.5]) for (const k of [-1, 1]) {
      sc.line([fp(south, T(s + k * 1.2), 1.0), fp(south, T(s + k * 5.2), zd - 0.6)], { sw: 1.1, stroke: LEGNO_SCURO[1] });
      sc.line([fp(south, T(s + k * 1.2), 2.4), fp(south, T(s + k * 3.2), zd - 0.6)], { sw: 0.9, stroke: LEGNO_SCURO[1] });
    }
    // parapetto e colonne del lato nord (in fondo)
    sc.path([fp(north, 0, zd), fp(north, L, zd), fp(north, L, zp), fp(north, 0, zp)], LEGNO[1]);
    sc.path(d.poly.map((p) => [p[0], p[1], zd]), '#b78a66');
    const cols = row(south, 19, 0.2);
    for (const t of cols) sc.line([fp(north, t, zp), fp(north, t, zb)], { sw: 1.2, stroke: LEGNO_SCURO[1], batch: true });
    // parapetto, colonne tuscaniche e architrave del lato sud
    sc.path([fp(south, 0, zd), fp(south, L, zd), fp(south, L, zp), fp(south, 0, zp)], LEGNO[0]);
    for (const t of row(south, 38, 0.2)) vline(sc, south, t, zd, zp, { sop: 0.45 });
    hline(sc, south, zp);
    sc.path([fp(south, 0, zp), fp(south, L, zp), fp(south, L, zb - 0.5), fp(south, 0, zb - 0.5)], BUIO, { op: 0.32, stroke: 'none' });
    for (const t of cols) {
      sc.path([fp(south, t - 0.28, zp), fp(south, t + 0.28, zp), fp(south, t + 0.22, zb - 0.5), fp(south, t - 0.22, zb - 0.5)], '#e9d6b4', { sw: 0.5, batch: true });
    }
    sc.path([fp(south, 0, zb - 0.5), fp(south, L, zb - 0.5), fp(south, L, zb), fp(south, 0, zb)], LEGNO[0]);
    // testata ovest: portale aperto
    const west = b.f.mu;
    for (const t of [0.3, W - 0.3]) sc.line([fp(west, t, zd), fp(west, t, zb)], { sw: 1.6, stroke: LEGNO_SCURO[1] });
    sc.path([fp(west, 0, zb - 0.5), fp(west, W, zb - 0.5), fp(west, W, zb), fp(west, 0, zb)], LEGNO[1]);
    b.col = LEGNO; b.z1 = zb;
    gable(sc, b, 2.3, COTTO, { ov: 0.8, timpano: LEGNO });
    // corsi di coppi
    const e = (s, t, z) => [...at(s, t), z];
    for (let s = -L / 2 + 3; s < L / 2; s += 3.3) sc.line([e(s, W / 2 + 0.8, zb), e(s, 0, zb + 2.3)], { sw: 0.4, sop: 0.4, batch: true });
  });
  return { sc, A, nome: 'Ponte Vecchio', storia: 'ponte-vecchio' };
};

// ---------------------------------------------------------------- Grapperia Nardini
models['nardini-basso'] = () => {
  const p = obb(145922166), g = obb(145933121); const A = g.c; const r = rel(A); const sc = new Scene();
  // corpo sulla testata del ponte, con il fornice
  const pc = r([p.c[0], p.c[1] + 1.9]);
  sc.at(pc, () => {
    const b = box(sc, { c: pc, ang: p.ang, L: 9, W: p.W, h: 11.5, col: OCRA });
    const w = b.left, s = b.right;
    arch(sc, w, w.len / 2, 0, 4.6, 5.6, BUIO);
    for (const z of [6.6, 9]) for (const t of row(w, 3, 0.6)) win(sc, w, t, z, 0.9, 1.5, VETRO);
    for (const z of [6.6, 9]) for (const t of row(s, 2, 0.8)) win(sc, s, t, z, 0.9, 1.5, VETRO);
    hip(sc, b, 2.4, COTTO, { ov: 0.6 });
  });
  // la grapperia: casa bassa e lunga accanto al ponte
  const gc = r(g.c);
  sc.at(gc, () => {
    const b = box(sc, { c: gc, ang: g.ang, L: g.L, W: g.W, h: 9.2, col: ROSA });
    const w = b.left, s = b.right;
    hline(sc, s, 3.6); hline(sc, w, 3.6);
    // bottega al piano terra
    arch(sc, w, w.len / 2, 0, 1.7, 3, BUIO);
    for (const t of [1.4, w.len - 1.4]) win(sc, w, t, 1, 1.2, 1.8, VETRO);
    const ts = row(s, 5, 0.7);
    ts.forEach((t, i) => (i === 2 ? arch(sc, s, t, 0, 1.6, 3, BUIO) : win(sc, s, t, 1, 1.3, 1.8, VETRO)));
    // finestre con scuri verdi
    for (const f of [w, s]) for (const z of [4.4, 6.8]) for (const t of row(f, f === w ? 3 : 5, 0.7)) {
      win(sc, f, t, z, 0.9, 1.5, VETRO); win(sc, f, t - 0.75, z, 0.45, 1.5, VERDE); win(sc, f, t + 0.75, z, 0.45, 1.5, VERDE);
    }
    hip(sc, b, 2.2, COTTO, { ov: 0.6 });
    // comignolo
    const cc = [gc[0] + 2, gc[1] + 0.3];
    box(sc, { c: cc, L: 0.8, W: 0.8, z0: 10.2, h: 2, col: ROSA, shadow: false, top: COTTO[1] });
  });
  return { sc, A, nome: 'Grapperia Nardini al Ponte', storia: 'nardini-basso' };
};

// ---------------------------------------------------------------- Torre Civica
models['torre-civica'] = () => {
  const o = obb(145928619); const A = o.c; const sc = new Scene(); const c = [0, 0];
  sc.at(c, () => {
    box(sc, { c, ang: o.ang, L: o.L + 1.2, W: o.W + 1.2, h: 5, col: PIETRA });
    const b = box(sc, { c, ang: o.ang, L: o.L, W: o.W, z0: 5, h: 29, col: MATTONE, shadow: false });
    for (const f of b.vis) {
      for (const z of [9, 16]) win(sc, f, f.len / 2, z, 0.7, 2.2, BUIO);
      hline(sc, f, 20.5, 0, f.len, { sop: 0.5 });
      // orologio
      tondo(sc, f, f.len / 2, 24.5, 2.3, '#f5ecd6', { sw: 0.7 });
      tondo(sc, f, f.len / 2, 24.5, 1.7, '#f5ecd6', { sw: 0.3 });
      sc.line([fp(f, f.len / 2, 24.5), fp(f, f.len / 2, 26)], { sw: 0.7 });
      sc.line([fp(f, f.len / 2, 24.5), fp(f, f.len / 2 + 1, 24.1)], { sw: 0.7 });
      // cella campanaria
      for (const t of row(f, 2, 1.6)) arch(sc, f, t, 29.2, 1.7, 3.4, BUIO);
    }
    // ballatoio a sbalzo con merli
    const g = box(sc, { c, ang: o.ang, L: o.L + 1.6, W: o.W + 1.6, z0: 34, h: 2.6, col: MATTONE, shadow: false });
    for (const f of g.vis) for (const t of row(f, 7, 0.2)) arch(sc, f, t, 34, 0.9, 1.3, MATTONE[1], { sw: 0.4 });
    merli(sc, g, 1.9, 1.1, MATTONE, '#c9a385');
    // torretta e asta
    const tt = box(sc, { c, ang: o.ang, L: 3.4, W: 3.4, z0: 36.6, h: 3.2, col: MATTONE, shadow: false });
    for (const f of tt.vis) arch(sc, f, f.len / 2, 37.2, 1.1, 2, BUIO);
    hip(sc, tt, 2.2, COTTO, { ov: 0.4 });
    sc.line([[0, 0, 42], [0, 0, 44.5]], { sw: 0.6 });
  });
  sc.shadow(ngon([0, 0], 5, 8), 40);
  return { sc, A, nome: 'Torre Civica', storia: 'torre-civica-piazze' };
};

// ---------------------------------------------------------------- Porta Dieda
models['porta-dieda'] = () => {
  const o = obb(781910187); const A = o.c; const r = rel(A); const sc = new Scene();
  const seg = (a, b, h = 7.5) => {
    const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ang = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
    sc.at(c, () => {
      const w = box(sc, { c, ang, L, W: 1.5, h, col: MURA });
      for (const f of w.vis) if (f.len > 3) { hline(sc, f, h * 0.45, 0, f.len, { sop: 0.3 }); hline(sc, f, h * 0.75, 0, f.len, { sop: 0.3 }); }
      merli(sc, w, 1.3, 1.1, MURA, '#cdb693');
    });
  };
  // tratti di mura reali ai due lati (way 812881197 e 812881196)
  const w1 = pts(812881197).map(r), w2 = pts(812881196).map(r);
  seg(w1[0], w1[3]);
  seg(w2[0], w2[1]); seg(w2[1], w2[2]);
  const c = [0, 0];
  sc.at(c, () => {
    const b = box(sc, { c, ang: o.ang, L: o.L, W: o.W, h: 15, col: MATTONE });
    const front = b.right, side = b.left;
    // fornice verso sud-est e cornice
    arch(sc, front, front.len / 2, 0, 4.6, 7, BUIO);
    arch(sc, front, front.len / 2, 0, 5.6, 7.6, 'none', { sw: 0.7 });
    tondo(sc, front, front.len / 2, 10, 1.1, PIETRA[0]);
    for (const t of row(front, 2, 1.2)) win(sc, front, t, 11.6, 0.9, 1.6, BUIO);
    hline(sc, front, 13.6); hline(sc, side, 13.6);
    win(sc, side, side.len / 2, 9.5, 0.8, 1.8, BUIO);
    win(sc, side, side.len / 2, 11.9, 0.8, 1.2, BUIO);
    hip(sc, b, 2.6, COTTO, { ov: 0.8 });
  }, 0.5);
  return { sc, A, nome: 'Porta Dieda', storia: 'mura-porte' };
};

// ---------------------------------------------------------------- Palazzo Sturm
models['palazzo-sturm'] = () => {
  const m = obb(145934084), n = obb(145931425), l = obb(145924343); const A = m.c; const r = rel(A); const sc = new Scene();
  const finestre = (f, zs, k, w = 1, h = 1.8) => { for (const z of zs) for (const t of row(f, k, 1)) win(sc, f, t, z, w, h, VETRO); };
  // ala nord (ingresso)
  const nc = r(n.c);
  sc.at(nc, () => {
    const b = box(sc, { c: nc, ang: n.ang, L: n.L, W: n.W, h: 12.5, col: GIALLO });
    finestre(b.left, [1.4, 5, 8.6], 2); hline(sc, b.left, 4);
    hip(sc, b, 2.4, COTTO, { ov: 0.6 });
  });
  // corpo principale
  const mc = r(m.c);
  sc.at(mc, () => {
    const b = box(sc, { c: mc, ang: m.ang, L: m.L, W: m.W, h: 17, col: GIALLO });
    for (const f of b.vis) {
      hline(sc, f, 4.2); hline(sc, f, 15.6);
      finestre(f, [1.2], 5, 1, 1.6);
      for (const t of row(f, 5, 1)) { arch(sc, f, t, 5.4, 1.2, 3, VETRO); win(sc, f, t, 5.1, 1.7, 0.3, PIETRA[0], { sw: 0.4 }); }
      finestre(f, [9.6], 5, 1, 2); finestre(f, [13], 5, 1, 1.3);
    }
    hip(sc, b, 3.6, COTTO, { ov: 0.7 });
    for (const dx of [-3, 3.5]) box(sc, { c: [mc[0] + dx, mc[1] + 1], L: 0.9, W: 0.9, z0: 19, h: 2.4, col: GIALLO, shadow: false, top: COTTO[1] });
  });
  // loggia-belvedere sul lato del fiume
  const lc = r(l.c);
  sc.at(lc, () => {
    const b = box(sc, { c: lc, ang: l.ang, L: l.L, W: l.W, h: 12.6, col: CREMA });
    for (const f of b.vis) {
      hline(sc, f, 7.6); hline(sc, f, 8.7);
      const k = f.len > 7 ? 3 : 3;
      for (const t of row(f, k, 0.5)) { arch(sc, f, t, 8.7, f.len / k - 0.9, 3.3, BUIO); }
      for (const t of row(f, 2 * k, 0.4)) vline(sc, f, t, 7.6, 8.7, { sop: 0.6 });
      for (const t of row(f, 2, 0.8)) win(sc, f, t, 2.2, 0.9, 1.6, VETRO);
      for (const t of row(f, 2, 0.8)) win(sc, f, t, 5, 0.9, 1.4, VETRO);
    }
    hip(sc, b, 1.8, COTTO, { ov: 0.6 });
  });
  return { sc, A, nome: 'Palazzo Sturm', storia: 'palazzo-sturm' };
};

// ---------------------------------------------------------------- King Kong Rhino
models['king-kong-rhino'] = () => {
  const A = [-244.5, -10.5]; const sc = new Scene();
  const ACC = ['#f2f6f7', '#c9d4d9', '#96a6ae', '#72838c'];
  const M = (p) => [p[0] * S, -p[1] * S];
  const q = (p) => p.map((v) => v.toFixed(1)).join(' ');
  // basamento di pietra, lungo l'orizzontale dello schermo
  sc.solid(1, () => { box(sc, { c: [0, 0], ang: 135, L: 11.5, W: 4.6, h: 0.5, col: PIETRA, top: '#f0e6cf' }); });
  sc.solid(0, () => {
    const dy = 0.15;
    const T = (arr, ox = 0, oy = 0) => arr.map((p) => M([p[0] + ox, p[1] + oy + dy]));
    // zampe del lato lontano
    sc.rawd(smooth(T([[-2.0, 1.8], [-2.1, 0.15], [-1.5, 0], [-0.9, 0.15], [-0.8, 1.8]], 0.9, 0.45), sc), ACC[3]);
    sc.rawd(smooth(T([[1.3, 1.9], [1.4, 0.15], [2.0, 0], [2.7, 0.15], [2.8, 1.9]], 0.9, 0.45), sc), ACC[3]);
    // corpo
    const corpo = [[4.4, 2.6], [4.2, 3.4], [3.3, 4.1], [1.5, 4.25], [-0.3, 4.35], [-1.6, 4.3], [-2.5, 3.9], [-3.1, 3.7], [-3.9, 3.35], [-4.6, 2.9], [-5.2, 2.3], [-5.3, 1.7], [-4.9, 1.3], [-4.1, 1.3], [-3.4, 1.6], [-2.9, 1.7], [-2.8, 1.0], [-2.9, 0.15], [-2.3, 0], [-1.6, 0.15], [-1.5, 1.2], [-0.5, 1.25], [1.2, 1.3], [2.1, 1.4], [2.2, 0.9], [2.2, 0.15], [2.9, 0], [3.6, 0.15], [3.7, 1.2], [4.1, 1.9]];
    sc.rawd(smooth(T(corpo), sc), ACC[1]);
    // riflessi dell'acciaio a specchio: cielo in alto, terra in basso
    sc.rawd(smooth(T([[3.7, 3.4], [2.8, 3.95], [1.0, 4.05], [-0.6, 4.15], [-1.8, 4.0], [-1.1, 3.4], [0.7, 3.2], [2.5, 3.15]])), ACC[0], { stroke: 'none' });
    sc.rawd(smooth(T([[3.9, 2.1], [2.7, 1.65], [0.9, 1.5], [-1.2, 1.5], [-2.4, 1.9], [-1.2, 2.1], [0.9, 1.95], [2.6, 2.2]])), ACC[2], { stroke: 'none' });
    sc.rawd(smooth(T([[-3.3, 3.45], [-4.0, 3.1], [-4.7, 2.6], [-4.3, 2.5], [-3.5, 2.9]])), ACC[0], { stroke: 'none' });
    // piastre della corazza, alla maniera di Durer
    const ln = (arr, o = {}) => sc.rawd(smoothOpen(T(arr)), 'none', { sw: 0.6, ...o });
    ln([[-1.6, 4.3], [-1.1, 3.1], [-1.3, 2.0], [-1.5, 1.25]]);
    ln([[1.9, 4.2], [2.5, 3.1], [2.4, 2.1], [2.15, 1.4]]);
    ln([[-1.1, 3.0], [0.6, 2.75], [2.5, 3.0]], { sop: 0.6 });
    ln([[-2.5, 3.9], [-2.4, 2.8], [-2.9, 1.7]]);
    ln([[-2.85, 0.8], [-1.55, 0.8]], { sop: 0.6 }); ln([[2.2, 0.8], [3.65, 0.8]], { sop: 0.6 });
    ln([[-5.25, 1.75], [-4.7, 1.8], [-4.3, 1.65]], { sop: 0.7 });
    // orecchio, corno piccolo, occhio
    sc.raw(T([[-2.9, 3.75], [-2.65, 4.85], [-2.25, 4.0]]), ACC[1]);
    sc.raw(T([[-3.85, 3.35], [-3.95, 4.3], [-3.35, 3.6]]), ACC[0]);
    sc.rawd(smooth(T([[-3.85, 2.75], [-3.7, 2.9], [-3.55, 2.75], [-3.7, 2.63]])), BUIO, { stroke: 'none' });
    // il grande corno, smisurato
    const [b0, c0, tip, c1, b1, c2] = T([[-5.25, 2.2], [-6.9, 4.2], [-6.1, 7.6], [-5.5, 5.0], [-4.35, 3.05], [-5.2, 5.2]]);
    [b0, c0, tip, c1, b1].forEach((p) => sc.reg(p));
    sc.rawd(`M${q(b0)}Q${q(c0)} ${q(tip)}Q${q(c1)} ${q(b1)}Z`, ACC[0]);
    sc.rawd(`M${q(T([[-4.9, 2.9]])[0])}Q${q(c2)} ${q(T([[-5.95, 7.0]])[0])}`, 'none', { sw: 0.6, stroke: ACC[2] });
    // coda
    ln([[4.35, 3.0], [4.8, 2.5], [4.7, 1.7]], { sw: 0.9 });
  });
  return { sc, A, nome: 'King Kong Rhino', storia: 'king-kong-rhino' };
};

// ---------------------------------------------------------------- Museo Civico e San Francesco
models['museo-civico'] = () => {
  const ch = obb(145923545), ct = obb(145935353), ro = obb(145923768); const sc = new Scene();
  const A = [74.5, -1.75]; const r = rel(A); const a = 75, u = [Math.sin(rad(a)), Math.cos(rad(a))], v = [Math.cos(rad(a)), -Math.sin(rad(a))];
  const at = (s, t) => [u[0] * s + v[0] * t, u[1] * s + v[1] * t];
  const VERDE_CH = '#c9d9a2';
  // prato del chiostro
  sc.floor([at(-10.8, -10), at(10.8, -10), at(10.8, 10), at(-10.8, 10)], VERDE_CH);
  sc.floor(ngon([0, 0], 1.6, 10), PIETRA[0], { sw: 0.5 });
  // chiesa di San Francesco: facciata a ovest con protiro, fianco sud
  const cc = r(ch.c);
  sc.solid(100, () => {
    // campanile dietro
    const tc = r(ct.c);
    const t = box(sc, { c: tc, ang: a, L: 4.4, W: 4.4, h: 27, col: MATTONE });
    for (const f of t.vis) { arch(sc, f, f.len / 2, 21.5, 1.6, 3.6, BUIO); hline(sc, f, 20.5); hline(sc, f, 26); win(sc, f, f.len / 2, 12, 0.5, 1.6, BUIO); }
    cone(sc, ngon(tc, 2.5, 8, 22.5), 27, [tc[0], tc[1], 35], COTTO);
  });
  sc.solid(90, () => {
    const b = box(sc, { c: cc, ang: a, L: ch.L - 2, W: 13.5, h: 14, col: MATTONE });
    const fac = b.f.mu, sud = b.f.pv;
    gable(sc, b, 4.2, COTTO, { ov: 0.6, timpano: MATTONE });
    // facciata: rosone e protiro
    tondo(sc, fac, fac.len / 2, 12.2, 1.7, PIETRA[0]); tondo(sc, fac, fac.len / 2, 12.2, 0.9, VETRO);
    for (const tt of [2.6, fac.len - 2.6]) ogiva(sc, fac, tt, 6, 1, 4, VETRO);
    for (const tt of row(sud, 6, 3)) ogiva(sc, sud, tt, 7.5, 1, 4.2, VETRO);
  });
  // protiro davanti alla facciata
  sc.solid(89, () => {
    const pc = [cc[0] - u[0] * (ch.L / 2 + 0.6), cc[1] - u[1] * (ch.L / 2 + 0.6)];
    const p = box(sc, { c: pc, ang: a, L: 3.2, W: 5.4, z0: 4.6, h: 1.2, col: PIETRA, shadow: false });
    const f = p.f.mu;
    for (const tt of [0.4, f.len - 0.4]) sc.line([fp(f, tt, 0), fp(f, tt, 4.6)], { sw: 1.3, stroke: PIETRA[1] });
    arch(sc, f, f.len / 2, 0, 2.2, 4, BUIO);
    gable(sc, p, 1.8, COTTO, { ov: 0.4, timpano: PIETRA });
    sc.shadow(p.poly, 6);
  });
  // ala nord del chiostro (contro la chiesa) con il portico
  const ala = (s0, s1, t0, t1, h, depth, fn, col = CREMA, tetto = 'hip') => {
    const c = at((s0 + s1) / 2, (t0 + t1) / 2); const Ls = s1 - s0, Lt = t1 - t0;
    sc.solid(depth, () => {
      const b = box(sc, { c, ang: Ls >= Lt ? a : a + 90, L: Math.max(Ls, Lt), W: Math.min(Ls, Lt), h, col });
      if (fn) fn(b);
      if (tetto === 'hip') hip(sc, b, 2, COTTO, { ov: 0.5 }); else if (tetto === 'gable') gable(sc, b, 2.2, COTTO, { ov: 0.5 }); else shed(sc, b, 2, COTTO, -1);
    });
  };
  const portico = (f, n) => { for (const t of row(f, n, 0.5)) arch(sc, f, t, 0, f.len / n - 0.9, 3.4, BUIO); hline(sc, f, 4.2); for (const t of row(f, n, 0.5)) win(sc, f, t, 5, 0.8, 1.2, VETRO); };
  ala(-10.8, 23, -14, -10, 7, 80, (b) => portico(b.f.pv, 9), CREMA, 'shed0');
  // ala est con portico verso il chiostro, e coda verso sud
  ala(10.8, 23, -10, 14, 7.5, 70, (b) => { const f = b.left; portico({ ...f, len: f.len }, 7); });
  ala(13, 22.5, 14, 38, 7.5, 60, (b) => { for (const z of [1.4, 4.6]) for (const t of row(b.left, 6, 1)) win(sc, b.left, t, z, 0.9, 1.5, VETRO); for (const z of [1.4, 4.6]) for (const t of row(b.right, 2, 1.4)) win(sc, b.right, t, z, 0.9, 1.5, VETRO); });
  // corpo rotondo
  const rc = r(ro.c);
  sc.solid(65, () => { const pg = ngon(rc, 5.2, 14); prism(sc, pg, 0, 6.5, CREMA); cone(sc, ngon(rc, 5.6, 14), 6.5, [rc[0], rc[1], 8.6], COTTO); });
  // ala sud (ingresso del museo) e ala ovest
  ala(-10.8, 12, 10, 24, 6.2, 40, (b) => {
    for (const f of b.vis) { hline(sc, f, 3.4); for (const t of row(f, f.len > 15 ? 6 : 3, 1.2)) { win(sc, f, t, 4, 0.9, 1.4, VETRO); win(sc, f, t, 0.9, 0.9, 1.6, VETRO); } }
    arch(sc, b.right, b.right.len / 2, 0, 2, 3.1, BUIO);
  });
  ala(-16, -10.8, -10.5, 24, 5.4, 30, (b) => { for (const t of row(b.left, 9, 1)) win(sc, b.left, t, 2.6, 0.9, 1.5, VETRO); for (const t of row(b.right, 1, 1)) win(sc, b.right, t, 2.6, 0.9, 1.5, VETRO); }, OCRA, 'gable');
  return { sc, A, nome: 'Museo Civico', storia: 'museo-civico' };
};

// ---------------------------------------------------------------- Castello degli Ezzelini e Duomo
models['castello-ezzelini'] = () => {
  const A = [-130, 285]; const r = rel(A); const sc = new Scene();
  const TORRE = ['#d8b08e', '#b88d6d'];
  // prato e sagrato dentro la cinta
  const ring = [...pts(781917425), ...pts(781923193), ...pts(781923194), ...pts(781923198), ...pts(781923196), ...pts(781917426)].map(r);
  sc.floor(ring, '#ecdcc0', { stroke: 'none' });
  // cinta muraria: i tratti reali di OpenStreetMap
  const muro = (id, h = 7, drop = 0) => {
    const dp = (q) => { if (q.length < 3) return q; const a = q[0], b = q[q.length - 1]; let k = 0, md = 0; for (let i = 1; i < q.length - 1; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - q[i][1]) - (a[0] - q[i][0]) * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1]); if (d > md) { md = d; k = i; } } return md > 1.3 ? dp(q.slice(0, k + 1)).slice(0, -1).concat(dp(q.slice(k))) : [a, b]; };
    const p = dp(pts(id).map(r));
    for (let i = 0; i < p.length - 1 - drop; i++) {
      const a = p[i], b = p[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 2.5) continue;
      const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ang = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI;
      sc.at(c, () => { const w = box(sc, { c, ang, L: L + 0.6, W: 1.6, h, col: MURA }); merli(sc, w, 1.2, 1.9, MURA, '#cdb693', false); });
    }
  };
  for (const id of [781917425, 781917426, 781923193, 781923194, 781923196, 781923198]) muro(id);
  const torre = (id, h, { tetto = false, col = TORRE, min = 0 } = {}) => {
    const o = obb(id); const c = r(o.c);
    sc.at(c, () => {
      const b = box(sc, { c, ang: o.ang, L: Math.max(o.L, min), W: Math.max(o.W, min), h, col });
      for (const f of b.vis) { win(sc, f, f.len / 2, h * 0.45, 0.6, 1.8, BUIO); win(sc, f, f.len / 2, h * 0.75, 0.6, 1.4, BUIO); }
      if (tetto) hip(sc, b, 2.4, COTTO, { ov: 0.5 }); else merli(sc, b, 1.5, 1.2, col, '#c9a385');
    }, 1);
  };
  torre(781917424, 22); // Torre dell'Ortazzo
  torre(781923195, 30, { min: 7 }); // Torre di Ser Ivano
  torre(145934783, 15, { tetto: true });
  torre(145929849, 13, { tetto: true });
  torre(145931608, 11, { min: 6 });
  // Duomo di Santa Maria in Colle con il campanile
  const d = obb(145922332), ab = obb(145936077), cp = obb(145933354);
  const cpc = r(cp.c);
  sc.at(cpc, () => {
    const b = box(sc, { c: cpc, ang: d.ang, L: 5.6, W: 5.6, h: 27, col: TORRE });
    for (const f of b.vis) { hline(sc, f, 20.5); arch(sc, f, f.len / 2, 21.5, 2, 4, BUIO); win(sc, f, f.len / 2, 10, 0.6, 1.8, BUIO); hline(sc, f, 26.2); }
    const t2 = box(sc, { c: cpc, ang: d.ang, L: 4, W: 4, z0: 27, h: 3, col: TORRE, shadow: false });
    for (const f of t2.vis) arch(sc, f, f.len / 2, 27.5, 1.2, 2, BUIO);
    cone(sc, ngon(cpc, 2.6, 8, 22.5), 30, [cpc[0], cpc[1], 36], COTTO);
  }, 2);
  const abc = r(ab.c);
  sc.at(abc, () => { const b = box(sc, { c: abc, ang: ab.ang, L: ab.L, W: ab.W, h: 11, col: OCRA }); hip(sc, b, 2.6, COTTO); }, 1);
  const dc = r(d.c);
  sc.at(dc, () => {
    const b = box(sc, { c: dc, ang: d.ang, L: d.L, W: d.W - 2, h: 13, col: OCRA });
    const fac = b.f.mu, sud = b.f.pv;
    gable(sc, b, 4, COTTO, { ov: 0.6, timpano: OCRA });
    arch(sc, fac, fac.len / 2, 0, 2.6, 5, BUIO); tondo(sc, fac, fac.len / 2, 9.5, 1.5, VETRO);
    hline(sc, fac, 13);
    for (const t of row(sud, 5, 2.5)) arch(sc, sud, t, 6.5, 1.5, 4, VETRO);
    arch(sc, sud, sud.len * 0.4, 0, 1.8, 3.6, BUIO);
  });
  // case dentro le mura
  const casa = (id, h, col, tetto = 'gable') => {
    const o = obb(id); const c = r(o.c);
    sc.at(c, () => {
      const b = box(sc, { c, ang: o.ang, L: o.L, W: o.W, h, col });
      for (const f of b.vis) for (const z of h > 7 ? [1.2, 4.4] : [1.4]) for (const t of row(f, Math.max(2, Math.round(f.len / 4)), 1)) win(sc, f, t, z, 0.9, 1.5, VETRO);
      (tetto === 'gable' ? gable : hip)(sc, b, 2.4, COTTO, { ov: 0.5, timpano: col });
    });
  };
  casa(145929266, 8, ROSA, 'hip'); casa(145928713, 7.5, CREMA); casa(145923009, 9, OCRA); casa(145932283, 8, CREMA);
  return { sc, A, nome: 'Castello degli Ezzelini e Duomo', storia: 'castello-ezzelini' };
};

// ---------------------------------------------------------------- Tempio Ossario
models['tempio-ossario'] = () => {
  const m = obb(145923980); const A = m.c; const r = rel(A); const sc = new Scene();
  const a = 171.5, U = [Math.sin(rad(a)), Math.cos(rad(a))], V = [Math.cos(rad(a)), -Math.sin(rad(a))];
  const at = (s, t) => [U[0] * s + V[0] * t, U[1] * s + V[1] * t];
  const TM = ['#dba785', '#b98463'], BIANCO = '#f3e7cf';
  const fasce = (f, zs) => { for (const z of zs) hline(sc, f, z, 0, f.len, { stroke: BIANCO, sw: 0.7 }); };
  const navata = (s0, s1, depth, fn) => sc.solid(depth, () => {
    const b = box(sc, { c: at((s0 + s1) / 2, 0), ang: a, L: s1 - s0, W: 12.2, h: 21, col: TM });
    if (fn) fn(b); gable(sc, b, 5.5, COTTO, { ov: 0.5, timpano: TM });
  });
  const laterale = (id, side, depth, n) => sc.solid(depth, () => {
    const o = obb(id); const b = box(sc, { c: r(o.c), ang: a, L: o.L, W: o.W, h: 11, col: TM });
    for (const f of b.vis) { fasce(f, [3, 9.6]); if (f.len > 12) for (const t of row(f, n, 1.5)) ogiva(sc, f, t, 3.6, 1.4, 5.4, VETRO); else ogiva(sc, f, f.len / 2, 3.6, 1.4, 5.4, VETRO); }
    shed(sc, b, 3.4, COTTO, side);
  });
  const torre = (id, depth) => sc.solid(depth, () => {
    const o = obb(id); const c = r(o.c);
    const b = box(sc, { c, ang: a, L: 5.6, W: 5.6, h: 34, col: TM });
    for (const f of b.vis) {
      fasce(f, [12, 22, 27, 33.2]);
      for (const z of [14, 23]) win(sc, f, f.len / 2, z, 0.6, 2.4, BUIO);
      for (const t of row(f, 2, 0.9)) ogiva(sc, f, t, 27.8, 1.2, 4.4, BUIO);
    }
    // quattro pinnacoli e la guglia
    for (const [i, j] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) { const pc = [c[0] + U[0] * i * 2.3 + V[0] * j * 2.3, c[1] + U[1] * i * 2.3 + V[1] * j * 2.3]; cone(sc, ngon(pc, 0.75, 4, a + 45), 34, [pc[0], pc[1], 38], [BIANCO, '#d9c9a8']); }
    cone(sc, ngon(c, 3.1, 8, 22.5 - a), 34, [c[0], c[1], 51], COTTO);
    sc.line([[c[0], c[1], 51], [c[0], c[1], 53]], { sw: 0.6 });
  });
  const cappella = (id, depth) => sc.solid(depth, () => { const o = obb(id); const b = box(sc, { c: r(o.c), ang: a, L: o.L, W: o.W, h: 8.5, col: TM }); for (const f of b.vis) { fasce(f, [3]); ogiva(sc, f, f.len / 2, 3, 1.1, 4, VETRO); } hip(sc, b, 2.2, COTTO, { ov: 0.3 }); });
  const cleristorio = (b, n) => { const f = b.f.pv; fasce(f, [15.2, 20.2]); for (const t of row(f, n, 2)) ogiva(sc, f, t, 15.6, 1.2, 4, VETRO); };

  laterale(145934840, 1, 100, 6);            // navatella est
  navata(-33, 2.2, 95, (b) => cleristorio(b, 6));
  laterale(145934753, -1, 90, 6);           // navatella ovest
  cappella(145929960, 85);
  sc.solid(80, () => {                         // transetto
    const b = box(sc, { c: at(8.45, 0), ang: a + 90, L: 34.6, W: 12.5, h: 21, col: TM });
    for (const f of b.vis) {
      fasce(f, [3, 15.2, 20.2]);
      if (f.len < 14) { tondo(sc, f, f.len / 2, 15.5, 2.6, BIANCO); tondo(sc, f, f.len / 2, 15.5, 1.8, VETRO); for (const t of row(f, 3, 1.6)) ogiva(sc, f, t, 4, 1.3, 6, VETRO); }
      else for (const t of [3.2, f.len - 3.2]) ogiva(sc, f, t, 6, 1.5, 9, VETRO);
    }
    gable(sc, b, 5.5, COTTO, { ov: 0.5, timpano: TM });
  });
  cappella(145929912, 75);
  torre(145929379, 70);                        // campanile est
  laterale(145934236, 1, 65, 3);
  navata(14.7, 33, 60, (b) => cleristorio(b, 3));
  sc.solid(55, () => {                         // abside poligonale
    const c = at(33, 0); const pg = ngon(c, 6.1, 5, (Math.atan2(U[1], U[0]) * 180) / Math.PI - 90, 0, 180);
    // semicerchio rivolto a sud
    const fs_ = prism(sc, pg, 0, 19, TM);
    for (const f of fs_) if (f.len > 3 && f.len < 10) { fasce(f, [3, 17.6]); ogiva(sc, f, f.len / 2, 5, 1.2, 9, VETRO); }
    cone(sc, pg, 19, [c[0], c[1], 25.5], COTTO);
  });
  laterale(145935044, -1, 50, 3);
  torre(145928878, 45);                        // campanile ovest
  return { sc, A, nome: 'Tempio Ossario', storia: 'tempio-ossario' };
};

// ---------------------------------------------------------------- Bolle di Nardini
models['bolle-nardini'] = () => {
  const b1 = obb(145944959), b2 = obb(145944973); const A = [(b1.c[0] + b2.c[0]) / 2, (b1.c[1] + b2.c[1]) / 2]; const r = rel(A); const sc = new Scene();
  const ACQUA = '#7fb8ad', ACQUA_SC = '#5f9d93', GLASS = '#d6ecec', ACCIAIO = '#8f9aa0';
  const a = b1.ang, u = [Math.sin(rad(a)), Math.cos(rad(a))], v = [Math.cos(rad(a)), -Math.sin(rad(a))];
  const at = (s, t) => [u[0] * s + v[0] * t, u[1] * s + v[1] * t];
  // vasca d'acqua con bordo in pietra
  const rr = (hs, ht, k) => { const o = []; for (const [cs, ct, a0] of [[hs - k, ht - k, 0], [-(hs - k), ht - k, 90], [-(hs - k), -(ht - k), 180], [hs - k, -(ht - k), 270]]) for (let i = 0; i <= 4; i++) { const an = rad(a0 + i * 22.5); o.push(at(cs + k * Math.cos(an), ct + k * Math.sin(an))); } return o; };
  sc.floor(rr(27, 16, 5), PIETRA[0]);
  sc.floor(rr(25.5, 14.5, 4), ACQUA, { stroke: '#4f8f86' });
  const bolla = (o, zc, cz, depth) => {
    const c = r(o.c); const A_ = o.L / 2, B_ = o.W / 2; const an = rad(o.ang), uu = [Math.sin(an), Math.cos(an)], vv = [Math.cos(an), -Math.sin(an)];
    const loc = (lu, lv, lz) => [c[0] + uu[0] * lu + vv[0] * lv, c[1] + uu[1] * lu + vv[1] * lv, zc + lz];
    // riflesso scuro sull'acqua
    sc.floor(ngon([0, 0], 1, 20).map((p) => { const q = loc(p[0] * A_ * 0.85, p[1] * B_ * 0.85, 0); return [q[0], q[1]]; }), ACQUA_SC, { stroke: 'none' });
    sc.solid(depth, () => {
      // gambe sottili e inclinate
      const gambe = [[-0.6, -0.5, -0.95, -1.1], [-0.55, 0.55, -0.9, 1.2], [0.1, -0.7, 0.2, -1.3], [0.15, 0.7, 0.3, 1.35], [0.65, -0.4, 1.0, -0.9], [0.6, 0.5, 1.0, 1.0]];
      for (const [pu, pv, gu, gv] of gambe) {
        const top = loc(pu * A_, pv * B_, -cz * Math.sqrt(Math.max(0, 1 - pu * pu - pv * pv)));
        const g = loc(gu * A_, gv * B_, 0);
        sc.line([[g[0], g[1], 0], top], { sw: 1, stroke: ACCIAIO });
      }
      // guscio di vetro
      sc.raw(ellissoide([c[0], c[1], zc], o.ang, A_, B_, cz), GLASS, { op: 0.5, sw: 0.8 });
      // solaio interno e costole
      const curva = (fn, n = 40, test = true) => {
        let cur = []; const out = [];
        for (let i = 0; i <= n; i++) { const [lu, lv, lz] = fn((i / n) * 2 * Math.PI); const nx = (uu[0] * lu) / A_ ** 2 + (vv[0] * lv) / B_ ** 2, ny = (uu[1] * lu) / A_ ** 2 + (vv[1] * lv) / B_ ** 2, nz = lz / cz ** 2; const vis = !test || -nx - ny + 0.866 * nz > 0; if (vis) cur.push(loc(lu, lv, lz)); else if (cur.length) { out.push(cur); cur = []; } }
        if (cur.length) out.push(cur); return out;
      };
      const k0 = -0.35, rr0 = Math.sqrt(1 - k0 * k0);
      const piano = []; for (let i = 0; i < 28; i++) { const t = (i / 28) * 2 * Math.PI; piano.push(loc(A_ * rr0 * Math.cos(t), B_ * rr0 * Math.sin(t), cz * k0)); }
      sc.path(piano, '#f4efe2', { op: 0.5, sw: 0.4, sop: 0.5 });
      for (const k of [-0.6, -0.2, 0.2, 0.6]) { const q = Math.sqrt(1 - k * k); for (const seg of curva((t) => [A_ * k, B_ * q * Math.cos(t), cz * q * Math.sin(t)])) if (seg.length > 2) sc.line(seg, { sw: 0.4, stroke: '#ffffff', sop: 0.9, batch: true }); }
      for (const seg of curva((t) => [A_ * Math.cos(t), 0, cz * Math.sin(t)])) if (seg.length > 2) sc.line(seg, { sw: 0.4, stroke: '#ffffff', sop: 0.9, batch: true });
      for (const seg of curva((t) => [A_ * Math.cos(t), B_ * Math.sin(t), 0])) if (seg.length > 2) sc.line(seg, { sw: 0.4, stroke: SEP, sop: 0.35 });
      // riflesso
      const hl = []; for (let i = 0; i <= 10; i++) { const t = rad(200 + i * 9); hl.push(loc(A_ * 0.8 * Math.cos(t) * 0.9, -B_ * 0.25 + B_ * 0.2 * Math.sin(t), cz * (0.72 + 0.1 * Math.sin(t)))); }
      sc.line(hl, { sw: 1.6, stroke: '#ffffff', sop: 0.85 });
    });
  };
  bolla(b1, 8.6, 3.7, b1.c[0] + b1.c[1]);
  bolla(b2, 8.0, 3.5, b2.c[0] + b2.c[1]);
  return { sc, A, nome: 'Bolle di Nardini', storia: 'bolle-nardini' };
};

// ---------------------------------------------------------------- scrittura
const ordine = ['ponte-vecchio', 'castello-ezzelini', 'torre-civica', 'museo-civico', 'palazzo-sturm', 'king-kong-rhino', 'nardini-basso', 'tempio-ossario', 'porta-dieda', 'bolle-nardini'];
const indice = [];
for (const id of ordine) {
  const { sc, A, nome, storia } = models[id]();
  const res = sc.svg(); const ll = toLL(A);
  indice.push({ id, file: `${id}.svg`, lat: ll.lat, lon: ll.lon, larghezzaMetri: res.larghezzaMetri, ancora: res.ancora, storia, nome });
  if (!only || only === id) fs.writeFileSync(path.join(OUT, `${id}.svg`), res.svg);
  console.log(id.padEnd(18), (res.svg.length / 1024).toFixed(1) + ' KB', `${res.w}x${res.h}`, 'larghezzaMetri', res.larghezzaMetri, 'ancora', res.ancora.join(','), ll.lat, ll.lon);
}
fs.writeFileSync(path.join(OUT, 'indice.json'), JSON.stringify(indice, null, 2) + '\n');
