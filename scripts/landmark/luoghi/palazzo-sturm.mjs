// Palazzo Sturm (via Schiavonetti, sponda sinistra del Brenta): genera
// public/landmarks/palazzo-sturm.svg.
// Uso: node scripts/landmark/luoghi/palazzo-sturm.mjs [file di uscita]
//
// Impronte da OpenStreetMap (way 145934084 corpo principale, 145931425 padiglione rosa,
// 145924343 corpo basso verso il fiume, 217193836 pronao), in metri locali (x est, y nord),
// ma raddrizzate sulla griglia della mappa: due parallelepipedi e un basamento.
//
// LICENZE DICHIARATE (la veduta da sud-ovest nasconderebbe proprio cio' che fa riconoscere
// il palazzo, quindi il disegno e' un ritratto, non un rilievo):
//  1. Il pronao tetrastilo sta in realta' sulla faccia NORD del padiglione rosa; qui e'
//     girato di 90 gradi sulla testata OVEST, verso il fiume, per essere visibile.
//  2. Il corpo alto verso il fiume (way 145924343) non e' disegnato: al suo posto continua
//     la terrazza, altrimenti coprirebbe padiglione, pronao e terrazza.
//  3. Il corpo principale, che in OSM e' un esagono ruotato, e' un rettangolo sugli assi.
// La terrazza-belvedere e' retta verso il Brenta da un muro ad arcate cieche con balaustra;
// finisce a y = -16: piu' a nord sta il rinoceronte, luogo simbolo a parte dipinto prima.
// Quota 0 = terrazza e strada; verso il fiume la sponda scende a -6 e -8 m.
//
// Nota: ../iso.mjs non si puo' importare da solo, perche' carica geo.mjs che all'avvio legge
// osm.json (non presente nel repository). Qui sotto c'e' la parte minima dello stesso motore:
// stessa proiezione, stessi toni di luce (a sud in luce, a ovest in ombra), stesso formato.
import fs from 'fs';

const S = 4; // unita' SVG per metro isometrico
const SEP = '#5b4636';
const A = [-239, -29]; // ancora: a terra, al centro dell'insieme
const lon0 = 11.7345, lat0 = 45.7665, K = 111320 * Math.cos((lat0 * Math.PI) / 180);
const P = (x, y, z = 0) => [(x - A[0] - (y - A[1])) * 0.7071 * S, (-(x - A[0] + y - A[1]) * 0.35355 - z * 0.8165) * S];
const D = [-1, -1, 0.866]; // verso l'osservatore
const f1 = (n) => { let s = n.toFixed(1); if (s.endsWith('.0')) s = s.slice(0, -2); return s === '-0' ? '0' : s; };

// ---- tavolozza ------------------------------------------------------------
const CREMA = ['#f6ecd6', '#dccdae'];   // corpo principale
const ROSA = ['#ecb9a3', '#d69d88'];    // padiglione
const PIETRA = ['#ede3cb', '#dccdaa'];  // muro della terrazza
const COTTO = ['#cc6238', '#a84a2c'];
const CORNICE = '#f8f0dc', NICCHIA = '#a48c66', VETRO = '#6a5545', BUIO = '#4d3b2f', SCURO = '#8a4f3c';
const SELCIATO = '#f3e9cf', PRATO = '#b5c08a', VERDE = ['#8fa56c', '#6f8a57'], CIPRESSO = ['#5f7a5a', '#4a6349'];

// ---- motore minimo --------------------------------------------------------
const out = []; let mn = [1e9, 1e9], mx = [-1e9, -1e9];
const reg = (q) => { for (let i = 0; i < 2; i++) { if (q[i] < mn[i]) mn[i] = q[i]; if (q[i] > mx[i]) mx[i] = q[i]; } };
const attrs = (fill, o = {}) => {
  let a = ` fill="${fill}"`;
  if (o.stroke) a += ` stroke="${o.stroke}"`;
  if (o.sw != null) a += ` stroke-width="${o.sw}"`;
  if (o.op != null) a += ` fill-opacity="${o.op}"`;
  if (o.sop != null) a += ` stroke-opacity="${o.sop}"`;
  return a;
};
const emit = (d, a) => { const l = out[out.length - 1]; if (l && l.a === a && l.batch) l.d += d; else out.push({ d, a, batch: true }); };
const cut = () => { if (out.length) out[out.length - 1].batch = false; };
const d2 = (q, open) => { let d = ''; q.forEach((p, i) => { reg(p); d += (i ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1]); }); return d + (open ? '' : 'Z'); };
const poly = (p3, fill, o = {}) => emit(d2(p3.map((p) => P(p[0], p[1], p[2] || 0)), o.open), attrs(fill, o));
const line = (p3, o = {}) => poly(p3, 'none', { open: true, sw: 0.5, ...o });
const dot = (p3, r, fill, o = {}) => { // cerchio sullo schermo, r in metri
  const c = P(p3[0], p3[1], p3[2]), R = r * S; reg([c[0] - R, c[1] - R]); reg([c[0] + R, c[1] + R]);
  emit(`M${f1(c[0] - R)} ${f1(c[1])}a${f1(R)} ${f1(R)} 0 1 0 ${f1(2 * R)} 0a${f1(R)} ${f1(R)} 0 1 0 ${f1(-2 * R)} 0Z`, attrs(fill, o));
};

/** Faccia verticale da a a b (a = estremo sinistro sullo schermo), tra le quote z0 e z1. */
function face(a, b, z0, z1, tone) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const f = { a, b, z0, z1, len, tone, fp: (t, z) => [a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len, z] };
  return f;
}
const wall = (f, col, o) => poly([f.fp(0, f.z0), f.fp(f.len, f.z0), f.fp(f.len, f.z1), f.fp(0, f.z1)], col[f.tone], o);
const rect = (f, t, z, w, h, fill, o = {}) => poly([f.fp(t - w / 2, z), f.fp(t + w / 2, z), f.fp(t + w / 2, z + h), f.fp(t - w / 2, z + h)], fill, { sw: 0.5, ...o });
const arch = (f, t, z, w, h, fill, o = {}) => {
  const r = w / 2, pts = [f.fp(t - r, z), f.fp(t - r, z + h - r)];
  for (let i = 1; i < 12; i++) { const an = Math.PI - (i * Math.PI) / 12; pts.push(f.fp(t + r * Math.cos(an), z + h - r + r * Math.sin(an))); }
  pts.push(f.fp(t + r, z + h - r), f.fp(t + r, z));
  poly(pts, fill, { sw: 0.5, ...o });
};
const hl = (f, z, t0 = 0, t1 = f.len, o = {}) => line([f.fp(t0, z), f.fp(t1, z)], o);
const vl = (f, t, z0, z1, o = {}) => line([f.fp(t, z0), f.fp(t, z1)], o);
const row = (f, n, m = 0.6) => { const r = []; for (let i = 0; i < n; i++) r.push(m + ((f.len - 2 * m) * (i + 0.5)) / n); return r; };
/** Fascia orizzontale piena (marcapiano, cornice). */
const band = (f, z, h, fill) => poly([f.fp(0, z), f.fp(f.len, z), f.fp(f.len, z + h), f.fp(0, z + h)], fill, { sw: 0.4 });
/** Finestra con le imposte aperte ai lati. */
const imposte = (f, t, z, w, h) => { rect(f, t - w * 0.78, z, w * 0.5, h, SCURO, { sw: 0.3 }); rect(f, t + w * 0.78, z, w * 0.5, h, SCURO, { sw: 0.3 }); rect(f, t, z, w, h, VETRO); };

/** Tetto a falde su un poligono qualsiasi: ogni lato di gronda sale verso il capo di colmo piu' vicino. */
function roof(pl, zE, r0, r1, zR, ov = 0.6) {
  const c = pl.reduce((s, p) => [s[0] + p[0] / pl.length, s[1] + p[1] / pl.length], [0, 0]);
  const e = pl.map((p) => { const d = Math.hypot(p[0] - c[0], p[1] - c[1]); return [p[0] + ((p[0] - c[0]) * ov * 1.3) / d, p[1] + ((p[1] - c[1]) * ov * 1.3) / d]; });
  const near = (p) => (Math.hypot(p[0] - r0[0], p[1] - r0[1]) <= Math.hypot(p[0] - r1[0], p[1] - r1[1]) ? r0 : r1);
  const fs_ = [];
  for (let i = 0; i < e.length; i++) {
    const a = e[i], b = e[(i + 1) % e.length], ra = near(pl[i]), rb = near(pl[(i + 1) % e.length]);
    const pts = [[a[0], a[1], zE], [b[0], b[1], zE], [rb[0], rb[1], zR]]; if (ra !== rb) pts.push([ra[0], ra[1], zR]);
    const u = [b[0] - a[0], b[1] - a[1], 0], m = [(ra[0] + rb[0]) / 2 - a[0], (ra[1] + rb[1]) / 2 - a[1], zR - zE];
    let n = [u[1] * m[2] - u[2] * m[1], u[2] * m[0] - u[0] * m[2], u[0] * m[1] - u[1] * m[0]]; if (n[2] < 0) n = n.map((v) => -v);
    if (n[0] * D[0] + n[1] * D[1] + n[2] * D[2] <= 0) continue;
    fs_.push({ pts, lit: -n[1] >= -n[0], k: (a[0] + a[1] + b[0] + b[1]) / 2 });
  }
  fs_.sort((p, q) => q.k - p.k);
  for (const f of fs_) { cut(); poly(f.pts, f.lit ? COTTO[0] : COTTO[1]); }
  cut();
}
/** File di coppi accennate: tratti dalla gronda verso il colmo. */
function coppi(a, b, r, zE, zR, n) {
  for (let i = 1; i < n; i++) { const t = i / n; const g = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; line([[g[0], g[1], zE], [g[0] + (r[0] - g[0]) * 0.55, g[1] + (r[1] - g[1]) * 0.55, zE + (zR - zE) * 0.55]], { sw: 0.3, sop: 0.35 }); }
}
function camino(x, y, z0, h) {
  const w = 0.45; cut();
  poly([[x - w, y - w, z0], [x + w, y - w, z0], [x + w, y - w, z0 + h], [x - w, y - w, z0 + h]], CREMA[0], { sw: 0.5 });
  poly([[x - w, y + w, z0], [x - w, y - w, z0], [x - w, y - w, z0 + h], [x - w, y + w, z0 + h]], CREMA[1], { sw: 0.5 });
  poly([[x - w - 0.2, y - w - 0.2, z0 + h], [x + w + 0.2, y - w - 0.2, z0 + h], [x + w + 0.2, y + w + 0.2, z0 + h], [x - w - 0.2, y + w + 0.2, z0 + h]], COTTO[1], { sw: 0.5 }); cut();
}
function cespuglio(x, y, z, r, col = VERDE) { cut(); dot([x, y, z + r * 0.9], r, col[1], { sw: 0.6 }); dot([x + r * 0.25, y + r * 0.25, z + r * 1.25], r * 0.62, col[0], { stroke: 'none' }); cut(); }
function cipresso(x, y, z, h) {
  const c = P(x, y, z), w = 0.75 * S, H = h * 0.8165 * S; reg([c[0] - w, c[1] - H]); reg([c[0] + w, c[1]]); cut();
  emit(`M${f1(c[0])} ${f1(c[1])}C${f1(c[0] - w * 1.5)} ${f1(c[1] - H * 0.25)} ${f1(c[0] - w * 0.7)} ${f1(c[1] - H * 0.8)} ${f1(c[0])} ${f1(c[1] - H)}C${f1(c[0] + w * 0.7)} ${f1(c[1] - H * 0.8)} ${f1(c[0] + w * 1.5)} ${f1(c[1] - H * 0.25)} ${f1(c[0])} ${f1(c[1])}Z`, attrs(CIPRESSO[1], { sw: 0.6 }));
  emit(`M${f1(c[0] + w * 0.15)} ${f1(c[1] - H * 0.12)}C${f1(c[0] + w * 0.95)} ${f1(c[1] - H * 0.3)} ${f1(c[0] + w * 0.5)} ${f1(c[1] - H * 0.75)} ${f1(c[0] + w * 0.05)} ${f1(c[1] - H * 0.9)}Z`, attrs(CIPRESSO[0], { stroke: 'none' })); cut();
}

// ---- misure ---------------------------------------------------------------
const XW = -250.5, XP = -241, XM = -239.5, XE = -226.3; // filo ovest: terrazza, padiglione, corpo principale; filo est
const YT = -16, YP = -18.5, YM = -28, YS = -39;             // nord terrazza, nord padiglione, giunto, filo sud
const GA = 8.5, GR = 11.5;                                // gronde: padiglione, corpo principale
const ZG = -6, ZF = -8, XG = XW - 2.8;                    // ripiano del giardino, piede del muro basso
const OMBRA = '#543e2a', BIANCO = ['#f8f1df', '#e7dcc2'], ZOCCOLO = '#cbb994';
const box = (x0, x1, y0, y1, z0, z1, col, o = {}) => { // facce ovest (ombra), sud (luce) e sopra
  poly([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], col[1], { sw: 0.4, ...o });
  poly([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], col[0], { sw: 0.4, ...o });
  poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], col[0], { sw: 0.4, ...o });
};
/** Balaustra tra t0 e t1: fondo scuro, colonnine chiare, corrimano. */
const balaustra = (f, t0, t1) => {
  cut(); poly([f.fp(t0, 0.1), f.fp(t1, 0.1), f.fp(t1, 0.85), f.fp(t0, 0.85)], NICCHIA, { sw: 0.3 });
  for (let t = t0 + 0.3; t < t1 - 0.1; t += 0.55) vl(f, t, 0.14, 0.82, { sw: 0.8, stroke: BIANCO[0] });
  cut();
};
/** File di coppi sulla falda sud (in luce) di un tetto a padiglione, lungo la linea di massima pendenza. */
function coppiSud(x0, x1, y0, r0, r1, zE, zR, n) {
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, k = 0.93 * Math.min(1, (x - x0) / (r0[0] - x0), (x1 - x) / (x1 - r1[0]));
    line([[x, y0, zE], [x, y0 + (r0[1] - y0) * k, zE + (zR - zE) * k]], { sw: 0.3, sop: 0.4 });
  }
  cut();
}

// ---- 0. ombra a terra, verso il fiume -------------------------------------------
const shadow = [[XG, YT + 0.3], [XG - 2.4, YT - 1.4], [XG - 2.4, YS - 1.2], [XG - 0.6, YS - 3], [XW, YS - 4.6], [XW, YS], [XG, YS]].map((p) => [p[0], p[1], ZF]);

// ---- 1. terrazza-belvedere: lasciata libera -----------------------------------------
poly([[XW, YT], [XP + 3.5, YT], [XP + 3.5, YP], [XP, YP], [XP, YM], [XM, YM], [XM, YS], [XW, YS]], SELCIATO, { sw: 0.5 });
for (const x of [XW + 2.9, XW + 5.4, XW + 7.9]) line([[x, YT - 0.4], [x, YS + 0.9]], { sw: 0.3, sop: 0.22 });
cut();
// ombra dei due corpi sul selciato
poly([[XM, YS], [XM - 2.6, YS + 1.6], [XM - 2.6, YM], [XP - 2.6, YM], [XP - 2.6, YP + 1.6], [XP, YP], [XP, YM], [XM, YM]], OMBRA, { stroke: 'none', op: 0.13 });
cut();

// ---- 2. padiglione rosa -------------------------------------------------------------
{
  const f = face([XP, YP], [XP, YM], 0, GA, 1), fs_ = face([XP, YM], [XM, YM], 0, GA, 0);
  wall(f, ROSA); wall(fs_, ROSA);
  band(f, 0, 0.45, '#c08f7c');
  // cantonali di pietra chiara
  for (const t of [0.4, f.len - 0.4]) { rect(f, t, 0, 0.8, GA - 0.6, BIANCO[0], { sw: 0.4 }); for (let z = 1.1; z < GA - 1; z += 1.1) hl(f, z, t - 0.4, t + 0.4, { sw: 0.3, sop: 0.45 }); }
  cut(); band(f, GA - 0.65, 0.65, BIANCO[0]); band(fs_, GA - 0.65, 0.65, BIANCO[0]);
  // ai lati del pronao: finestra e, sopra, riquadro incorniciato
  for (const t of [1.55, f.len - 1.55]) {
    rect(f, t, 1.3, 0.95, 2.3, BIANCO[0], { sw: 0.4 }); rect(f, t, 1.5, 0.6, 1.9, VETRO, { sw: 0.3 });
    rect(f, t, 5.6, 1.05, 1.7, BIANCO[0], { sw: 0.4 }); rect(f, t, 5.85, 0.65, 1.2, ROSA[1], { sw: 0.3 });
  }
  // riquadro sopra il timpano
  rect(f, f.len / 2, 7.35, 1.9, 0.45, BIANCO[0], { sw: 0.4 });
  cut();
  roof([[XP, YM], [XE, YM], [XE, YP], [XP, YP]], GA, [-236.5, (YP + YM) / 2], [-230.8, (YP + YM) / 2], GA + 2.4, 0.6);
}

// ---- 3. pronao: quattro colonne, timpano, tettuccio in coppi ---------------------------
{
  const yc = (YP + YM) / 2, hw = 2.25, xf = XP - 2.9, y0 = yc - hw, y1 = yc + hw, zc = 4.75, zt = 5.4, za = 7;
  box(xf - 0.25, XP, y0 - 0.25, y1 + 0.25, 0, 0.35, BIANCO);
  // parete in ombra sotto il portico, portale
  const f = face([XP, YP], [XP, YM], 0, GA, 1), tc = f.len / 2;
  cut(); rect(f, tc, 0.35, 2 * hw, zc - 0.35, '#b98572', { sw: 0.3 });
  rect(f, tc, 0.35, 1.3, 3.1, BUIO, { sw: 0.4 }); for (const k of [-1.35, 1.35]) rect(f, tc + k, 1.2, 0.6, 2, VETRO, { sw: 0.3 });
  cut();
  // falda nord del tettuccio (appena visibile)
  poly([[xf - 0.4, y1 + 0.3, zt], [XP, y1 + 0.3, zt], [XP, yc, za], [xf - 0.4, yc, za]], COTTO[1], { sw: 0.5 });
  // lesene contro il muro, poi le quattro colonne
  const fl = face([xf, y0], [XP, y0], 0.35, zc, 0), fc = face([xf + 0.25, y1], [xf + 0.25, y0], 0.35, zc, 1);
  rect(fl, fl.len - 0.22, 0.35, 0.44, zc - 0.35, BIANCO[0], { sw: 0.4 });
  for (const t of [0.27, 0.27 + (2 * hw - 0.54) / 3, 0.27 + (2 * (2 * hw - 0.54)) / 3, 2 * hw - 0.27]) rect(fc, t, 0.35, 0.5, zc - 0.35, BIANCO[0], { sw: 0.45 });
  rect(fl, 0.25, 0.35, 0.5, zc - 0.35, BIANCO[0], { sw: 0.45 });
  cut();
  // trabeazione, timpano, falda sud
  box(xf - 0.1, XP, y0 - 0.1, y1 + 0.1, zc, zt, BIANCO, { sw: 0.5 });
  cut(); poly([[xf - 0.1, y1 + 0.25, zt], [xf - 0.1, y0 - 0.25, zt], [xf - 0.1, yc, za]], BIANCO[0], { sw: 0.6 });
  poly([[xf - 0.1, y1 - 0.8, zt + 0.25], [xf - 0.1, y0 + 0.8, zt + 0.25], [xf - 0.1, yc, za - 0.5]], BIANCO[0], { sw: 0.3, sop: 0.6 });
  cut(); poly([[xf - 0.4, y0 - 0.3, zt], [XP, y0 - 0.3, zt], [XP, yc, za], [xf - 0.4, yc, za]], COTTO[0], { sw: 0.5 });
  cut();
  // due vasi di agrumi accanto alle colonne
  for (const p of [[xf - 0.5, y1 + 1.1], [xf - 0.5, y0 - 1.1]]) {
    const c = P(p[0], p[1], 0), u = 0.32 * S; cut();
    emit(d2([[c[0] - u, c[1]], [c[0] + u, c[1]], [c[0] + u * 1.35, c[1] - u * 2], [c[0] - u * 1.35, c[1] - u * 2]]), attrs(COTTO[0], { sw: 0.4 }));
    dot([p[0], p[1], 1.3], 0.6, VERDE[1], { sw: 0.4 });
  }
  cut();
}

// ---- 4. corpo principale: tre piani, intonaco chiaro -----------------------------------
{
  const fw = face([XM, YM], [XM, YS], 0, GR, 1), fs_ = face([XM, YS], [XE, YS], 0, GR, 0);
  // marciapiede a sud
  poly([[XM, YS], [XE, YS], [XE, YS - 1.5], [XM, YS - 1.9]], '#eadfc4', { sw: 0.4 }); cut();
  wall(fw, CREMA); wall(fs_, CREMA);
  for (const f of [fw, fs_]) { band(f, 0, 0.5, ZOCCOLO); band(f, 3.95, 0.25, CORNICE); band(f, GR - 0.65, 0.65, CORNICE); }
  const tw = row(fw, 3, 1.3), tsud = row(fs_, 4, 0.9);
  for (const t of tw) { imposte(fw, t, 1.1, 0.9, 1.9); imposte(fw, t, 8.5, 0.9, 1.35); }
  for (const t of tw) { arch(fw, t, 4.9, 1.15, 2.6, VETRO); }
  cut(); rect(fw, tw[1], 4.45, 2.6, 0.95, CORNICE, { sw: 0.4 }); for (let k = -1.05; k <= 1.06; k += 0.42) vl(fw, tw[1] + k, 4.5, 5.35, { sw: 0.3, sop: 0.6 });
  cut();
  for (const t of tsud) { imposte(fs_, t, 1.1, 0.9, 1.9); imposte(fs_, t, 4.9, 0.9, 2.3); imposte(fs_, t, 8.5, 0.9, 1.35); }
  cut();
  const r0 = [-234.6, (YM + YS) / 2], r1 = [-231.2, (YM + YS) / 2], zR = GR + 3.3;
  roof([[XM, YS], [XE, YS], [XE, YM], [XM, YM]], GR, r0, r1, zR, 0.7);
  coppiSud(XM - 0.5, XE + 0.5, YS - 0.9, r0, r1, GR, zR, 12);
  camino(-229.4, -32.2, GR + 2.1, 1.7);
}

// ---- 5. basamento della terrazza: arcate cieche, balaustra ---------------------------------
{
  const f = face([XW, YT], [XW, YS], ZG, 0, 1), g = face([XW, YS], [XM, YS], ZG, 0, 0);
  wall(f, PIETRA);
  // fianco sud, in luce: la sponda sale fino alla strada
  poly([g.fp(0, ZG), g.fp(g.len, 0), g.fp(0, 0)], PIETRA[0], { sw: 0.5 });
  cut();
  const n = 3, bay = f.len / n, ts = [0, 1, 2].map((i) => bay * (i + 0.5));
  for (const t of ts) arch(f, t, ZG + 0.05, 5.2, 4.9, NICCHIA, { sw: 0.5 });
  cut(); for (const t of ts) rect(f, t, ZG + 1.2, 1.3, 1.6, BUIO, { sw: 0.4 });
  cut(); rect(g, 1.7, ZG + 1.1, 1.1, 2.1, BUIO, { sw: 0.4 });
  cut(); band(f, -0.3, 0.4, BIANCO[0]); band(g, -0.3, 0.4, BIANCO[0]);
  // parapetto: pilastrini sui piedritti, balaustra tra l'uno e l'altro
  const pil = 0.8;
  for (let i = 0; i < n; i++) balaustra(f, i * bay + pil / 2, (i + 1) * bay - pil / 2);
  balaustra(g, pil / 2, g.len - 0.2);
  for (let i = 0; i <= n; i++) rect(f, Math.min(f.len - pil / 2, Math.max(pil / 2, i * bay)), 0.1, pil, 1.05, BIANCO[1], { sw: 0.4 });
  rect(g, pil / 2, 0.1, pil, 1.05, BIANCO[0], { sw: 0.4 });
  cut(); band(f, 0.85, 0.15, BIANCO[1]); band(g, 0.85, 0.15, BIANCO[0]);
  poly([[XW, YT, 1], [XW, YS, 1], [XM, YS, 1], [XM, YS + 0.45, 1], [XW + 0.45, YS + 0.45, 1], [XW + 0.45, YT, 1]], BIANCO[0], { sw: 0.4 });
  cut();
  // pilastro che chiude la balaustra a nord
  box(XW, XW + 0.9, YT - 0.9, YT, 0.1, 2.1, BIANCO, { sw: 0.4 });
  cut();
}

// ---- 6. ripiano del giardino, muro basso e sponda ---------------------------------------
poly([[XG, YT, ZG], [XW, YT, ZG], [XW, YS, ZG], [XG, YS, ZG]], PRATO, { sw: 0.5 });
// a sud: scarpata erbosa e scala di pietra che dalla strada scende al giardino
poly([[XW, YS - 1.7, ZG], [XM, YS - 1.7, 0], [XM + 1.2, YS - 4.2, 0], [XW, YS - 4.4, ZF]], PRATO, { sw: 0.5 });
cut(); poly([[XW, YS, ZG], [XM, YS, 0], [XM, YS - 1.7, 0], [XW, YS - 1.7, ZG]], '#e9dec3', { sw: 0.5 });
for (let i = 1; i < 14; i++) { const x = XW + ((XM - XW) * i) / 14, z = ZG - (ZG * i) / 14; line([[x, YS, z], [x, YS - 1.7, z]], { sw: 0.35, sop: 0.55 }); }
cut();
{
  const bay = (YT - YS) / 3;
  for (const i of [1, 2]) cipresso(XW - 1.4, YT - i * bay - 1.4, ZG, 6.3);
  const f = face([XG, YT], [XG, YS], ZF, ZG, 1), s = face([XG, YS], [XW, YS], ZF, ZG, 0);
  wall(f, [PIETRA[0], '#cdbd98']); wall(s, PIETRA);
  hl(f, ZF + 1, 0, f.len, { sw: 0.3, sop: 0.35 });
  cut();
}
for (const [x, y, z, r] of [[XG - 0.9, YT - 2.2, ZF, 1.1], [XG - 1.2, YT - 10.5, ZF, 0.8], [XG - 0.9, YT - 12, ZF, 1.15], [XG - 1, YS + 3, ZF, 0.9],
  [XW + 0.4, YS - 3.9, ZF + 0.6, 1.3], [XW + 3.2, YS - 3.6, ZG + 0.9, 1], [XW + 5.2, YS - 3.9, ZG + 2, 0.7], [XW + 8.6, YS - 3.4, ZG + 4.2, 0.95]]) cespuglio(x, y, z, r);

// ---- uscita ---------------------------------------------------------------------------------
const sh = d2(shadow.map((p) => P(p[0], p[1], p[2])));
const pad = 4;
const x0 = Math.floor(mn[0] - pad), y0 = Math.floor(mn[1] - pad);
const w = Math.ceil(mx[0] + pad) - x0, h = Math.ceil(mx[1] + pad) - y0;
const body = out.map((e) => `<path d="${e.d}"${e.a}/>`).join('\n');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" width="${w}" height="${h}">\n` +
  `<g stroke="${SEP}" stroke-width=".8" stroke-linejoin="round" stroke-linecap="round">\n` +
  `<path d="${sh}" fill="#543e2a" fill-opacity=".18" stroke="none"/>\n${body}\n</g>\n</svg>\n`;
const dest = process.argv[2] || new URL('../../../public/landmarks/palazzo-sturm.svg', import.meta.url);
fs.writeFileSync(dest, svg);
const ancora = [+((0 - x0) / w).toFixed(4), +((0 - y0) / h).toFixed(4)];
console.log(JSON.stringify({
  id: 'palazzo-sturm', kB: +(svg.length / 1024).toFixed(1), viewBox: [x0, y0, w, h],
  lat: +(lat0 + A[1] / 110574).toFixed(6), lon: +(lon0 + A[0] / K).toFixed(6),
  larghezzaMetri: +(w / S).toFixed(1), ancora,
}));
