// Bolle di Nardini (Massimiliano e Doriana Fuksas, 2004): genera public/landmarks/bolle-nardini.svg.
// Uso: node scripts/landmark/luoghi/bolle-nardini.mjs [file di uscita]
//
// Due ellissoidi di vetro sollevati su gambe d'acciaio inclinate sopra uno specchio d'acqua,
// la rampa che scende sotto la vasca verso l'auditorium e la scala vetrata inclinata.
//
// Dati rilevati: le impronte delle due bolle (OpenStreetMap, way 145944959 la grande a est e
// way 145944973 la piccola a ovest), qui in metri locali come in public/data/base.json.
// Da esse vengono centro, orientamento e assi orizzontali di ciascun ellissoide.
// Dati stimati: le quote (pancia a circa 5 m dall'acqua, colmo a 12-13 m), la forma della
// vasca, la posizione di rampa, scala e gambe. In OpenStreetMap non ci sono.
//
// Nota: ../iso.mjs non si puo' importare da qui, perche' carica geo.mjs che legge osm.json
// (non presente nel repository). Sotto c'e' il minimo indispensabile dello stesso motore:
// stessa proiezione (docs/SPEC.md), stessa scala S, stesso contorno seppia.
import fs from 'fs';

const S = 4; // unita' SVG per metro isometrico, come in iso.mjs
const SEP = '#5b4636';
const P = (x, y, z = 0) => [(x - y) * 0.7071 * S, (-(x + y) * 0.35355 - z * 0.8165) * S];
const D = [-1, -1, 0.866]; // verso l'osservatore
const f1 = (n) => { let s = n.toFixed(1); if (s.endsWith('.0')) s = s.slice(0, -2); return s === '-0' ? '0' : s; };
const rad = (a) => (a * Math.PI) / 180;
const pairs = (a) => { const o = []; for (let i = 0; i < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };

function hull(pp) {
  const p = [...pp].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (const q of p.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}
/** Rettangolo orientato di area minima attorno a un'impronta: centro, angolo dell'asse lungo, lati. */
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

// ---- dati reali ---------------------------------------------------------------------------
const C0 = [1518, -2917];      // origine del disegno: il punto tra le due bolle (metri locali)
const ANCORA = [1518, -2924];  // punto d'appoggio dato alla mappa: il bordo sud della vasca
const IMPRONTA_EST = pairs([1529.4, -2923.8, 1533.9, -2920.9, 1537.5, -2915.8, 1537.6, -2912.6, 1534.2, -2910.7, 1526.6, -2910.8, 1520.2, -2913.2, 1516.5, -2916, 1514.5, -2920, 1514.6, -2923.7, 1517.8, -2925.5, 1523, -2925.3]);
const IMPRONTA_OVEST = pairs([1507.7, -2924.1, 1510.5, -2924, 1513.4, -2921.4, 1518.9, -2910.7, 1518.4, -2907.2, 1514.3, -2905.5, 1510.4, -2905.5, 1507.2, -2908.3, 1505, -2911.7, 1503.3, -2917.9, 1505.2, -2922.4]);
const rel = (o) => ({ ...o, c: [o.c[0] - C0[0], o.c[1] - C0[1]] });
const EST = rel(obb(IMPRONTA_EST)), OVEST = rel(obb(IMPRONTA_OVEST));

// ---- colori -------------------------------------------------------------------------------
// Luce da sinistra in alto, come nella mappa (pareti a ovest in luce, ombre a terra verso destra).
const PIETRA = '#eadfc6', PIETRA_CH = '#f4ecd8', MURO = '#d9c8a6', MURO_SC = '#8f7a5c', BUIO = '#4a382b';
const ACQUA = '#7fbdb4', ACQUA_CH = '#a6d4cc', ACQUA_BORDO = '#4f8f86', ACQUA_SC = '#4f958d', RIFLESSO = '#d7efe9';
const VETRO = '#a4d9d1', VETRO_SC = '#5fa9a1', CIELO = '#eefaf7';
const SOLAIO = '#e9dcc0', SOLAIO_SC = '#a8946c';
const TELAIO = '#4f7672', TELAIO_DIETRO = '#6fa29d', ACCIAIO = '#e6ecea', ACCIAIO_SC = '#5f7775';

// ---- uscita SVG ---------------------------------------------------------------------------
const out = []; const defs = []; const mn = [1e9, 1e9], mx = [-1e9, -1e9];
const reg = (q) => { for (let i = 0; i < 2; i++) { mn[i] = Math.min(mn[i], q[i]); mx[i] = Math.max(mx[i], q[i]); } };
const d2 = (pts, open, noreg) => pts.map((q, i) => { if (!noreg) reg(q); return (i ? 'L' : 'M') + f1(q[0]) + ' ' + f1(q[1]); }).join('') + (open ? '' : 'Z');
function put(d, fill, o = {}) {
  let s = `<path d="${d}" fill="${fill}"`;
  if (o.stroke) s += ` stroke="${o.stroke}"`;
  if (o.sw != null) s += ` stroke-width="${o.sw}"`;
  if (o.op != null) s += ` fill-opacity="${o.op}"`;
  if (o.sop != null) s += ` stroke-opacity="${o.sop}"`;
  if (o.clip) s += ` clip-path="url(#${o.clip})"`;
  out.push(s + '/>');
}
const pr = (p) => P(p[0], p[1], p[2] || 0);
const poly3 = (pts, fill, o = {}) => put(d2(pts.map(pr), o.open, o.noreg), fill, o);
/** piu' spezzate in un solo <path> */
const lines3 = (segs, o = {}) => { const d = segs.filter((s) => s.length > 1).map((s) => d2(s.map(pr), true, o.noreg)).join(''); if (d) put(d, 'none', o); };
const lines2 = (segs, o = {}) => { const d = segs.filter((s) => s.length > 1).map((s) => d2(s, true, true)).join(''); if (d) put(d, 'none', o); };
/** Curva liscia (Catmull-Rom) da punti sullo schermo, chiusa o aperta. */
function smooth(pts, aperta) {
  const n = pts.length; let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  const at = (i) => (aperta ? pts[Math.max(0, Math.min(n - 1, i))] : pts[((i % n) + n) % n]);
  for (let i = 0; i < (aperta ? n - 1 : n); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
    reg(p1);
  }
  return d + (aperta ? '' : 'Z');
}

// ---- il terreno: lastricato, vasca, rampa ---------------------------------------------------
// Il cortile e' allineato ai capannoni della distilleria (rilevamento 83 gradi in base.json,
// non ai punti cardinali): u = lungo, v = verso nord.
const BU = [Math.sin(rad(83)), Math.cos(rad(83))], BV = [-BU[1], BU[0]];
const G = (u, v, z = 0) => [BU[0] * u + BV[0] * v, BU[1] * u + BV[1] * v, z];
const inG = (p) => [p[0] * BU[0] + p[1] * BU[1], p[0] * BV[0] + p[1] * BV[1]];
const arco = (cu, cv, k, a0) => { const o = []; for (let i = 0; i <= 5; i++) { const an = rad(a0 + i * 18); o.push(G(cu + k * Math.cos(an), cv + k * Math.sin(an))); } return o; };
const rr = (u0, u1, v0, v1, k) => [...arco(u1 - k, v1 - k, k, 0), ...arco(u0 + k, v1 - k, k, 90), ...arco(u0 + k, v0 + k, k, 180), ...arco(u1 - k, v0 + k, k, 270)];

const LASTRA = { u0: -22, u1: 26, v0: -14.6, v1: 17, k: 3.5 };
const VASCA = { u0: -17.5, u1: 23.5, v0: -11.2, v1: 15, k: 5 };
const RAMPA = { u0: -31, u1: -18.3, v0: -6, v1: 0.2, prof: 3 };
// il lastricato con la lingua che accoglie la rampa: un solo contorno, una sola ombra
const lastra = (() => {
  const { u0, u1, v0, v1, k } = LASTRA, t0 = RAMPA.u0 - 2.6, a = RAMPA.v1 + 2.2, b = RAMPA.v0 - 2.2, q = 1.2;
  return [...arco(u1 - k, v1 - k, k, 0), ...arco(u0 + k, v1 - k, k, 90),
    G(u0, a), ...arco(t0 + q, a - q, q, 90), ...arco(t0 + q, b + q, q, 180), G(u0, b),
    ...arco(u0 + k, v0 + k, k, 180), ...arco(u1 - k, v0 + k, k, 270)];
})();
poly3(lastra.map((p) => [p[0] - 0.3, p[1] - 1.3, 0]), '#543e2a', { op: 0.18, stroke: 'none' }); // ombra a terra, a destra e in basso
poly3(lastra, PIETRA);
// la vasca: bordo chiaro di acqua bassa, poi lo specchio
poly3(rr(VASCA.u0, VASCA.u1, VASCA.v0, VASCA.v1, VASCA.k), ACQUA_CH, { stroke: ACQUA_BORDO, sw: 0.7 });
poly3(rr(VASCA.u0 + 0.55, VASCA.u1 - 0.55, VASCA.v0 + 0.55, VASCA.v1 - 0.55, VASCA.k - 0.55), ACQUA, { stroke: 'none' });

// la rampa: una trincea tagliata nel lastricato, che scende verso est e passa sotto la vasca
{
  const { u0, u1, v0, v1, prof } = RAMPA;
  const bocca = [G(u0, v0), G(u1, v0), G(u1, v1), G(u0, v1)];
  defs.push(`<clipPath id="r"><path d="${d2(bocca.map(pr), false, true)}"/></clipPath>`);
  const o = { clip: 'r', noreg: true, stroke: 'none' };
  // il piano inclinato, a fasce sempre piu' scure verso il portale
  const N = 6, toni = ['#c4b28e', '#bba985', '#b19f7c', '#a69472', '#9a8868', '#8d7b5d'];
  for (let i = 0; i < N; i++) {
    const ua = u0 + ((u1 - u0) * i) / N, ub = u0 + ((u1 - u0) * (i + 1)) / N, za = (-prof * i) / N, zb = (-prof * (i + 1)) / N;
    poly3([G(ua, v0, za), G(ua, v1, za), G(ub, v1, zb), G(ub, v0, zb)], toni[i], o);
  }
  const tac = []; for (let i = 1; i < N; i++) { const k = i / N, u = u0 + (u1 - u0) * k; tac.push([G(u, v0, -prof * k), G(u, v1, -prof * k)]); }
  lines3(tac, { clip: 'r', noreg: true, sw: 0.35, sop: 0.55 });
  poly3([G(u0, v1), G(u1, v1), G(u1, v1, -prof)], MURO, { ...o, stroke: SEP, sw: 0.5 });                      // muro di sostegno nord, in luce
  poly3([G(u1, v0), G(u1, v1), G(u1, v1, -prof), G(u1, v0, -prof)], MURO_SC, { ...o, stroke: SEP, sw: 0.5 }); // testata, in ombra
  poly3([G(u1, v0 + 1.5), G(u1, v1 - 0.8), G(u1, v1 - 0.8, -prof), G(u1, v0 + 1.5, -prof)], BUIO, o);        // il portale
  poly3(bocca, 'none', { sw: 0.8 });
}

// ---- una bolla ------------------------------------------------------------------------------
function Bolla(o, zc, cz) {
  const a = o.L / 2, b = o.W / 2, c = [o.c[0], o.c[1], zc];
  const an = rad(o.ang), u = [Math.sin(an), Math.cos(an)], v = [Math.cos(an), -Math.sin(an)];
  const loc = (lu, lv, lz) => [c[0] + u[0] * lu + v[0] * lv, c[1] + u[1] * lu + v[1] * lv, zc + lz];
  const sfe = (q) => loc(a * q[0], b * q[1], cz * q[2]); // dalla sfera unitaria alla bolla
  const c2 = pr(c);
  // direzione di vista nel sistema della sfera unitaria
  const m = [(u[0] * D[0] + u[1] * D[1]) / a, (v[0] * D[0] + v[1] * D[1]) / b, D[2] / cz];
  const ml = Math.hypot(...m), w = m.map((k) => k / ml);
  let e1 = [w[1], -w[0], 0]; const l1 = Math.hypot(...e1); e1 = e1.map((k) => k / l1);
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const e2 = cross(w, e1);
  const mix = (...t) => [0, 1, 2].map((k) => t.reduce((s, [f, vec]) => s + f * vec[k], 0));
  /** sagoma esatta: il cerchio massimo della sfera unitaria perpendicolare alla vista */
  const sagoma = (n = 28) => { const pts = []; for (let i = 0; i < n; i++) { const t = (i / n) * 2 * Math.PI; pts.push(pr(sfe(mix([Math.cos(t), e1], [Math.sin(t), e2])))); } return pts; };
  // I poli del telaio stanno alle due punte della sagoma (l'asse lungo cosi' come lo si vede),
  // non sull'asse lungo in pianta: altrimenti un polo finisce in faccia a chi guarda e la
  // griglia sembra una pigna. Ogni linea del telaio finisce esattamente sul contorno.
  let p = e1, best = 0;
  for (let i = 0; i < 180; i++) { const t = rad(i), q = mix([Math.cos(t), e1], [Math.sin(t), e2]), s = pr(sfe(q)), dd = Math.hypot(s[0] - c2[0], s[1] - c2[1]); if (dd > best) { best = dd; p = q; } }
  const e = cross(w, p);
  /** corrente da punta a punta: fi tra 0 e 180 davanti, tra 180 e 360 dietro */
  const corrente = (fi, t0, n = 14) => { const o2 = []; for (let i = 0; i <= n; i++) { const t = t0 + ((Math.PI - 2 * t0) * i) / n; o2.push(sfe(mix([Math.cos(t), p], [Math.sin(t) * Math.cos(rad(fi)), e], [Math.sin(t) * Math.sin(rad(fi)), w]))); } return o2; };
  /** mezzo anello trasversale: davanti oppure dietro */
  const anello = (k, davanti, n = 10) => { const o2 = [], q = Math.sqrt(1 - k * k); for (let i = 0; i <= n; i++) { const s = (davanti ? 0 : Math.PI) + (Math.PI * i) / n; o2.push(sfe(mix([k, p], [q * Math.cos(s), e], [q * Math.sin(s), w]))); } return o2; };
  const piano = (k, f = 1, n = 18, dz = 0) => { const q = Math.sqrt(1 - k * k) * f, o2 = []; for (let i = 0; i < n; i++) { const t = (i / n) * 2 * Math.PI; o2.push(pr(loc(a * q * Math.cos(t), b * q * Math.sin(t), cz * k + dz))); } return o2; };
  /** falce lungo il contorno, tra due angoli sullo schermo (0 = destra, 90 = basso), spessa al centro */
  const falce = (g0, g1, sp, n = 12) => {
    const S2 = sagoma(72).map((s) => [s, ((Math.atan2(s[1] - c2[1], s[0] - c2[0]) * 180) / Math.PI + 360) % 360]);
    const pick = (g) => { g = ((g % 360) + 360) % 360; let bs = S2[0], bd = 999; for (const s of S2) { const dd = Math.min(Math.abs(s[1] - g), 360 - Math.abs(s[1] - g)); if (dd < bd) { bd = dd; bs = s; } } return bs[0]; };
    const est = [], int = [];
    for (let i = 0; i <= n; i++) { const s = pick(g0 + ((g1 - g0) * i) / n), k = sp * Math.sin((Math.PI * i) / n); est.push(s); int.push([s[0] + (c2[0] - s[0]) * k, s[1] + (c2[1] - s[1]) * k]); }
    return { est, int };
  };
  /** tratto parallelo al contorno, rientrato di una frazione costante verso il centro */
  const parallela = (g0, g1, k, n) => falce(g0, g1, 0, n).est.map((s) => [s[0] + (c2[0] - s[0]) * k, s[1] + (c2[1] - s[1]) * k]);
  /** punto sulla pancia sotto (pu, pv), coordinate nel disco unitario */
  const sotto = (pu, pv) => loc(pu * a, pv * b, -cz * Math.sqrt(Math.max(0, 1 - pu * pu - pv * pv)) + 0.3);
  return { a, b, c, c2, cz, zc, loc, sagoma, corrente, anello, piano, falce, parallela, sotto };
}

/** ellisse sull'acqua sotto la bolla: f = quanto dell'impronta, (dx, dy) = spostamento in metri */
const sullAcqua = (B, f, dx, dy, n = 14) => { const pts = []; for (let i = 0; i < n; i++) { const t = (i / n) * 2 * Math.PI; const q = B.loc(B.a * f * Math.cos(t), B.b * f * Math.sin(t), 0); pts.push(P(q[0] + dx, q[1] + dy, 0)); } return pts; };
function acquaSotto(B) {
  const k = B.zc * 0.36;
  put(smooth(sullAcqua(B, 0.66, k, -k)), ACQUA_SC, { op: 0.4, stroke: 'none' });   // ombra, verso destra
  put(smooth(sullAcqua(B, 0.5, 0, 0)), RIFLESSO, { op: 0.26, stroke: 'none' });    // il riflesso della bolla
}

function gambe(B, lista) {
  const segs = lista.map(([pu, pv, gu, gv]) => {
    const g = B.loc(gu * B.a, gv * B.b, 0), [qu, qv] = inG(g), mrg = 1.4;
    if (qu < VASCA.u0 + mrg || qu > VASCA.u1 - mrg || qv < VASCA.v0 + mrg || qv > VASCA.v1 - mrg) throw new Error(`piede fuori dalla vasca: ${qu.toFixed(1)}, ${qv.toFixed(1)}`);
    return [[g[0], g[1], 0], B.sotto(pu, pv)];
  });
  for (const s of segs) poly3([0, 1, 2, 3, 4, 5].map((i) => [s[0][0] + 0.55 * Math.cos(i * 1.047), s[0][1] + 0.55 * Math.sin(i * 1.047), 0]), '#c9d3d0', { sw: 0.4, stroke: ACCIAIO_SC }); // i piedi nell'acqua
  lines3(segs, { stroke: ACCIAIO_SC, sw: 2.3 });
  lines3(segs, { stroke: ACCIAIO, sw: 1.3 });
}

function guscio(B, anelli, correnti, luce) {
  const kS = -0.5; // quota del solaio
  const sil = smooth(B.sagoma());
  const tMax = Math.acos(Math.max(...anelli)); // le correnti si fermano sull'ultimo anello
  put(sil, VETRO, { op: 0.5, stroke: 'none' });
  // il telaio del lato lontano, visto attraverso il vetro
  lines3([...anelli.map((k) => B.anello(k, false)), ...correnti.map((fi) => B.corrente(-fi, tMax))], { stroke: TELAIO_DIETRO, sw: 0.35, sop: 0.55 });
  // il solaio, con il suo spessore
  put(smooth(B.piano(kS, 0.9, 18, -0.45)), SOLAIO_SC, { op: 0.7, stroke: 'none' });
  put(smooth(B.piano(kS, 0.9)), SOLAIO, { op: 0.6, stroke: TELAIO_DIETRO, sw: 0.35 });
  // il vetro davanti: un velo, la pancia in ombra in basso a destra, il cielo riflesso in alto a sinistra
  put(sil, VETRO, { op: 0.3, stroke: 'none' });
  { const { est, int } = B.falce(-25, 125, 0.42); put(smooth([...est, ...int.reverse().slice(1, -1)]), VETRO_SC, { op: 0.42, stroke: 'none' }); }
  { const { est, int } = B.falce(170, 300, 0.36); put(smooth([...est, ...int.reverse().slice(1, -1)]), CIELO, { op: 0.55, stroke: 'none' }); }
  // il telaio d'acciaio in vista
  lines3([...anelli.map((k) => B.anello(k, true)), ...correnti.map((fi) => B.corrente(fi, tMax))], { stroke: TELAIO, sw: 0.5 });
  // i riflessi del sole, in alto a sinistra
  put(smooth(B.parallela(...luce, 0.17, 8), true), 'none', { stroke: '#ffffff', sw: 1.7 });
  put(smooth(B.parallela(luce[0] + 8, luce[0] + 8 + (luce[1] - luce[0]) * 0.4, 0.33, 5), true), 'none', { stroke: '#ffffff', sw: 1 });
  put(sil, 'none', { stroke: TELAIO, sw: 0.6 });
}

const B1 = Bolla(EST, 10.0, 3.9);   // la grande
const B2 = Bolla(OVEST, 9.3, 3.5);  // la piccola

// ---- ombre, riflessi e increspature sull'acqua ---------------------------------------------------
acquaSotto(B1); acquaSotto(B2);
lines3([[G(-13.5, -7.2), G(-9.5, -7.2)], [G(11, -8.8), G(15.5, -8.8)], [G(-13, 11.5), G(-9.5, 11.5)], [G(10, 12.4), G(14, 12.4)], [G(16.5, 5), G(19.5, 5)], [G(-4, -8.4), G(-1.5, -8.4)]], { stroke: '#ffffff', sw: 0.45, sop: 0.75 });

// ---- la bolla grande (piu' lontana) --------------------------------------------------------------
// gambe: [attacco sulla pancia (u, v), piede (u, v)] in frazioni dei semiassi; poche e tutte diverse
gambe(B1, [[-0.5, -0.3, -0.45, -1.05], [0.3, -0.4, 0.55, -1.2], [0.72, -0.05, 0.95, -0.2], [0.5, 0.25, 0.58, 0.85], [-0.6, 0.25, -0.22, 1.0], [0.0, 0.4, -0.2, 1.0]]);

// la scala vetrata inclinata, dal pianerottolo sul bordo alla pancia della bolla grande
{
  const pad = [G(1.1, -13.5), G(5.3, -13.5), G(5.3, -11.6), G(1.1, -11.6)];
  poly3(pad, PIETRA_CH, { sw: 0.6 });
  const g = G(2.5, -12.6), t0 = B1.sotto(-0.2, 0.36), t = [t0[0], t0[1], t0[2] - 1.6], h = 2.1, la = 1.2;
  const up = (q, dz) => [q[0], q[1], (q[2] || 0) + dz], est = (q) => [q[0] + la, q[1], q[2] || 0];
  poly3([est(g), [g[0] + la + 1.6, g[1] - 1.6, 0], [g[0] + 1.6, g[1] - 1.6, 0], g], '#543e2a', { op: 0.18, stroke: 'none', noreg: true }); // ombra ai piedi
  poly3([g, est(g), est(up(g, h)), up(g, h)], '#a9cfc9', { sw: 0.45, stroke: TELAIO, op: 0.9 });                 // testata sud, in ombra
  poly3([up(g, h), up(t, h), est(up(t, h)), est(up(g, h))], '#e4f4f0', { sw: 0.45, stroke: TELAIO, op: 0.85 }); // copertura
  poly3([g, t, up(t, h), up(g, h)], '#cfe8e2', { sw: 0.45, stroke: TELAIO, op: 0.75 });                          // fianco ovest, in luce
  const gr = []; for (let i = 1; i < 5; i++) { const k = i / 5, q = [g[0] + (t[0] - g[0]) * k, g[1] + (t[1] - g[1]) * k, t[2] * k]; gr.push([q, up(q, h)]); }
  lines3(gr, { stroke: TELAIO, sw: 0.4, sop: 0.8 });
}
guscio(B1, [-0.8, -0.48, -0.16, 0.16, 0.48, 0.8], [30, 70, 110, 150], [205, 285]);

// ---- la bolla piccola (piu' vicina) ----------------------------------------------------------------
gambe(B2, [[0.45, 0.25, 0.55, 0.65], [-0.1, -0.45, -0.4, -1.2], [-0.1, 0.45, -0.25, 1.2], [-0.5, 0.0, -1.0, 0.2]]);
guscio(B2, [-0.72, -0.36, 0, 0.36, 0.72], [30, 70, 110, 150], [190, 262]);

// ---- scrittura ------------------------------------------------------------------------------------
const pad = 6;
const x0 = Math.floor(mn[0] - pad), y0 = Math.floor(mn[1] - pad);
const W = Math.ceil(mx[0] + pad) - x0, H = Math.ceil(mx[1] + pad) - y0;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${W} ${H}" width="${W}" height="${H}">\n` +
  (defs.length ? `<defs>${defs.join('')}</defs>\n` : '') +
  `<g stroke="${SEP}" stroke-width=".8" stroke-linejoin="round" stroke-linecap="round">\n${out.join('\n')}\n</g>\n</svg>\n`;
const file = process.argv[2] || new URL('../../../public/landmarks/bolle-nardini.svg', import.meta.url).pathname;
fs.writeFileSync(file, svg);

// la voce per indice.json: l'ancora e' il punto ANCORA, che nel disegno sta in P(ANCORA - C0)
const lon0 = 11.7345, lat0 = 45.7665, K = 111320 * Math.cos(rad(lat0));
const A = P(ANCORA[0] - C0[0], ANCORA[1] - C0[1], 0);
console.log(JSON.stringify({
  file, bytes: svg.length, viewBox: [x0, y0, W, H],
  lat: +(lat0 + ANCORA[1] / 110574).toFixed(6), lon: +(lon0 + ANCORA[0] / K).toFixed(6),
  larghezzaMetri: +(W / S).toFixed(1), ancora: [+((A[0] - x0) / W).toFixed(4), +((A[1] - y0) / H).toFixed(4)],
  est: { c: EST.c.map((k) => +k.toFixed(1)), ang: +EST.ang.toFixed(0), L: +EST.L.toFixed(1), W: +EST.W.toFixed(1) },
  ovest: { c: OVEST.c.map((k) => +k.toFixed(1)), ang: +OVEST.ang.toFixed(0), L: +OVEST.L.toFixed(1), W: +OVEST.W.toFixed(1) },
}));
