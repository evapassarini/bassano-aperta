// Grapperia Nardini al Ponte ("Nardini basso", Ponte Vecchio 2): genera
// public/landmarks/nardini-basso.svg.
// Uso: node scripts/landmark/luoghi/nardini-basso.mjs [file di uscita]
//
// Che cosa c'e' sul terreno (OpenStreetMap, metri locali rispetto a ORIGINE):
//  - way 145922166, la casa-porta in testa al ponte: il Ponte Vecchio (way 145926592,
//    estremo est a x = -225.9, largo 10.1 m attorno a y = 111) ci entra dal lato ovest.
//  - way 145933121, la grapperia: un cuneo lungo 12 m e profondo da 2.8 m (sul fiume) a 5.7 m
//    (verso la piazzetta), appoggiato al fianco sud della casa-porta. Il punto OSM
//    "Nardini basso" (45.7674625, 11.7317151 = x -216.3, y 106.4) cade qui dentro.
// Da sud-ovest si vedono i lati ovest (sul Brenta, in ombra) e sud (in luce).
//
// Scelte di disegno (seconda stesura, dopo la critica):
//  - La protagonista e' la casa ocra: cinque assi di finestre con gli scuri color antracite,
//    portone ad arco quasi nero con la lunetta chiara, vetrina con la fascia scura.
//  - La casa-porta e' tenuta bassa (12.8 m; base.json dice 14.8) e chiara, cosi' non ruba la
//    scena. Il fornice e' piccolo, in pietra bianca, con il tavolato del ponte sulla soglia.
//  - La mappa e' piatta: l'impalcato del ponte arriva a 5.2 m, e fin li' sale il muro di
//    sponda in pietra grigio-bruna, alla stessa quota sui due volumi.
//  - Tetti: una falda per lato in vista, le falde rivolte a nord-est non si disegnano.
// Licenza dichiarata: portone, vetrina e scuri sono quelli della facciata vera, che guarda la
// piazzetta a nord-est e da sud-ovest non si vede; qui stanno sul lato sud, quello in luce.
// L'ordine da sinistra (vetrina, portone, finestrelle) e' quello della foto visto allo specchio,
// perche' la casa-porta resta dalla stessa parte della vetrina.
//
// Nota: ../iso.mjs non si puo' importare da solo (carica geo.mjs, che legge osm.json, non
// presente nel repository). Qui sotto c'e' la parte minima dello stesso motore: stessa
// proiezione e stessa scala.
import fs from 'fs';

const S = 4; // unita' SVG per metro isometrico
const SEP = '#5b4636';
const P = (x, y, z = 0) => [(x - y) * 0.7071 * S, (-(x + y) * 0.35355 - z * 0.8165) * S];
const D = [-1, -1, 0.866]; // verso chi guarda
const f1 = (n) => { let s = n.toFixed(1); if (s.endsWith('.0')) s = s.slice(0, -2); return s === '-0' ? '0' : s; };
function hull(pp) {
  const p = [...pp].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (const q of p.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop(); return lo.concat(up);
}
class Scene {
  constructor() { this.s = []; this.sh = []; this.mn = [1e9, 1e9]; this.mx = [-1e9, -1e9]; }
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
  /** Un'ombra sola: l'inviluppo dell'impronta e della stessa spostata verso nord-ovest. */
  shadow(poly, off) { this.sh.push(hull(poly.concat(poly.map((p) => [p[0] + off[0], p[1] + off[1]])))); }
  svg() {
    let sh = ''; for (const h of this.sh) sh += this.d2(h.map((p) => P(p[0], p[1], 0)));
    const pad = 3, x0 = Math.floor(this.mn[0] - pad), y0 = Math.floor(this.mn[1] - pad);
    const w = Math.ceil(this.mx[0] + pad) - x0, h = Math.ceil(this.mx[1] + pad) - y0;
    const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" width="${w}" height="${h}">\n` +
      `<g stroke="${SEP}" stroke-width=".8" stroke-linejoin="round" stroke-linecap="round">\n` +
      `<path d="${sh}" fill="#5b4636" fill-opacity=".15" stroke="none"/>\n` +
      this.s.map((e) => `<path d="${e.d}"${e.a}/>`).join('\n') + '\n</g>\n</svg>\n';
    return { svg: out, w, h, ancora: [+((0 - x0) / w).toFixed(4), +((0 - y0) / h).toFixed(4)], larghezzaMetri: +(w / S).toFixed(1) };
  }
}

// ---- facce e tetti ----------------------------------------------------------------
const lit = (n) => -n[1] >= -n[0]; // piu' rivolta a sud che a ovest = in luce
/** Facce in vista di un'impronta antioraria, dalla piu' lontana; a = estremo sinistro sullo schermo. */
function facce(poly) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    let a = poly[i], b = poly[(i + 1) % poly.length];
    const n = [b[1] - a[1], -(b[0] - a[0])];
    if (-n[0] - n[1] <= 1e-6) continue;
    if (a[0] - a[1] > b[0] - b[1]) [a, b] = [b, a];
    out.push({ a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]), lit: lit(n) });
  }
  return out.sort((p, q) => (q.a[0] + q.a[1] + q.b[0] + q.b[1]) - (p.a[0] + p.a[1] + p.b[0] + p.b[1]));
}
const fp = (f, t, z) => [f.a[0] + ((f.b[0] - f.a[0]) * t) / f.len, f.a[1] + ((f.b[1] - f.a[1]) * t) / f.len, z];
const rect = (sc, f, t0, t1, z0, z1, fill, o = {}) => sc.path([fp(f, t0, z0), fp(f, t1, z0), fp(f, t1, z1), fp(f, t0, z1)], fill, { sw: 0.5, batch: true, ...o });
const tone = (f, col) => (f.lit ? col[0] : col[1]);
/** Sagoma ad arco a tutto sesto sulla faccia: piedritti da z a z+h-r, poi il semicerchio. */
function arcoPts(f, t, z, w, h) {
  const r = w / 2, pts = [fp(f, t - r, z), fp(f, t - r, z + h - r)];
  for (let i = 1; i < 10; i++) { const an = Math.PI - (i * Math.PI) / 10; pts.push(fp(f, t + r * Math.cos(an), z + h - r + r * Math.sin(an))); }
  pts.push(fp(f, t + r, z + h - r), fp(f, t + r, z));
  return pts;
}
const arco = (sc, f, t, z, w, h, fill, o = {}) => sc.path(arcoPts(f, t, z, w, h), fill, { sw: 0.5, ...o });
/** Finestra con gli scuri chiusi: due ante piene e il davanzale in pietra. */
function scuriChiusi(sc, f, t, z, w, h, col) {
  rect(sc, f, t - w / 2 - 0.12, t + w / 2 + 0.12, z - 0.18, z, tone(f, PIETRA), { sw: 0.3 });
  rect(sc, f, t - w / 2, t + w / 2, z, z + h, tone(f, col), { sw: 0.45 });
  sc.line([fp(f, t, z), fp(f, t, z + h)], { sw: 0.3, sop: 0.6, batch: true });
}
/** Finestra con gli scuri aperti ai lati e il davanzale. */
function scuriAperti(sc, f, t, z, w, h, col, sw = 0.45) {
  rect(sc, f, t - w / 2 - 0.12, t + w / 2 + 0.12, z - 0.18, z, tone(f, PIETRA), { sw: 0.3 });
  rect(sc, f, t - w / 2, t + w / 2, z, z + h, VETRO, { sw: 0.4 });
  for (const s of [-1, 1]) rect(sc, f, t + s * (w / 2 + sw), t + s * (w / 2), z, z + h, tone(f, col), { sw: 0.4 });
}
/** Impronta allargata di ov (sporto di gronda). */
function sporto(poly, ov) {
  const n = poly.length, nor = poly.map((a, i) => { const b = poly[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l]; });
  return poly.map((p, i) => { const n1 = nor[(i + n - 1) % n], n2 = nor[i], k = ov / Math.max(0.4, 1 + n1[0] * n2[0] + n1[1] * n2[1]); return [p[0] + (n1[0] + n2[0]) * k, p[1] + (n1[1] + n2[1]) * k]; });
}
/**
 * Tetto a padiglione su un'impronta antioraria, colmo da r0 a r1. Si disegnano solo le falde
 * rivolte a chi guarda (sud e ovest); i coppi sono righe parallele che scendono lungo la falda.
 */
function tetto(sc, eave, r0, r1, zb, zr, passo = 0.75) {
  const near = (p) => (Math.hypot(p[0] - r0[0], p[1] - r0[1]) <= Math.hypot(p[0] - r1[0], p[1] - r1[1]) ? r0 : r1);
  const fs_ = [];
  for (let i = 0; i < eave.length; i++) {
    const a = eave[i], b = eave[(i + 1) % eave.length], n = [b[1] - a[1], -(b[0] - a[0])];
    if (-n[0] - n[1] <= 1e-6) continue;
    fs_.push({ a, b, ra: near(a), rb: near(b), n, d: a[0] + a[1] + b[0] + b[1] });
  }
  fs_.sort((p, q) => q.d - p.d);
  for (const f of fs_) {
    const pts = [[...f.a, zb], [...f.b, zb], [...f.rb, zr]]; if (f.ra !== f.rb) pts.push([...f.ra, zr]);
    sc.path(pts, lit(f.n) ? COTTO[0] : COTTO[1]);
    const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]), e = [(f.b[0] - f.a[0]) / len, (f.b[1] - f.a[1]) / len], p = [-e[1], e[0]];
    const lati = []; for (let k = 1; k < pts.length; k++) lati.push([pts[k], pts[(k + 1) % pts.length]]);
    const m = Math.floor(len / passo), s0 = (len - m * passo) / 2;
    for (let k = 0; k <= m; k++) {
      const s = s0 + k * passo; if (s < 0.25 || s > len - 0.25) continue;
      const q = [f.a[0] + e[0] * s, f.a[1] + e[1] * s];
      let best = null;
      for (const [u, v] of lati) {
        const dx = v[0] - u[0], dy = v[1] - u[1], den = p[0] * dy - p[1] * dx; if (Math.abs(den) < 1e-9) continue;
        const la = ((u[0] - q[0]) * dy - (u[1] - q[1]) * dx) / den, mu = ((u[0] - q[0]) * p[1] - (u[1] - q[1]) * p[0]) / den;
        if (la > 1e-6 && mu >= -1e-6 && mu <= 1 + 1e-6 && (!best || la < best.la)) best = { la, z: u[2] + (v[2] - u[2]) * mu };
      }
      if (best) sc.line([[...q, zb], [q[0] + p[0] * best.la, q[1] + p[1] * best.la, best.z]], { sw: 0.4, sop: 0.35, batch: true });
    }
  }
  sc.line([[...r0, zr], [...r1, zr]], { sw: 0.9 });
}
/** Scatola: le due pareti in vista e il coperchio. */
function scatola(sc, c, h, z0, z1, col, top) {
  const q = [[c[0] - h, c[1] - h], [c[0] + h, c[1] - h], [c[0] + h, c[1] + h], [c[0] - h, c[1] + h]];
  for (const f of facce(q)) rect(sc, f, 0, f.len, z0, z1, tone(f, col), { sw: 0.4, batch: false });
  sc.path(q.map((p) => [...p, z1]), top, { sw: 0.4 });
}
/** Comignolo piccolo in mattoni con il cappello in cotto. */
function comignolo(sc, c, z0) {
  scatola(sc, c, 0.28, z0, z0 + 1.15, MATTONE, MATTONE[0]);
  scatola(sc, c, 0.42, z0 + 1.15, z0 + 1.4, COTTO, COTTO[0]);
}

// ---- colori ------------------------------------------------------------------------
const OCRA = ['#d9a94e', '#b98a3c'];      // la grapperia: ocra caldo, vissuto
const ROSA = ['#e6a07c', '#cf8862'];      // la casa-porta: intonaco rosato chiaro
const PIETRA = ['#ede3cf', '#d2c5a8'];    // pietra bianca di cornici e davanzali
const RIVA = ['#b9a98c', '#9c8c72'];      // pietra grigio-bruna del muro di sponda
const COTTO = ['#d2683f', '#b0502f'];
const MATTONE = ['#b0603f', '#8f4a30'];
const SCURI = ['#4a4f48', '#3d423c'], BRUNO = ['#7d5238', '#6a432c'];
const VETRO = '#6f5c4d', BUIO = '#43342a', PORTONE = '#3a2d24', FASCIA = '#3f3a34', LUNETTA = '#d9c9a3';
const TAVOLATO = '#b98a62', AMBRA = '#d9a45a', FIORI = '#7d8f5c';
const gronda = (sc, f, H, col) => rect(sc, f, 0, f.len, H - 0.3, H, col, { sw: 0.3, batch: false });

// ---- impronte (metri locali) e ancora -----------------------------------------------
const A = [-219.5, 100.7]; // punto d'appoggio: il piede della facciata, a destra del portone
const rel = (p) => [p[0] - A[0], p[1] - A[1]];
// casa-porta: rettangolo (lo smusso a sud-est dell'impronta vera non e' in vista)
const PORTA = [[-218.9, 116.2], [-225.9, 116.3], [-226.3, 103.7], [-218.9, 103.9]].map(rel);
// grapperia: il cuneo vero, senza la rientranza contro la casa-porta
const CASA = [[-226.3, 103.7], [-225.7, 101], [-213.7, 100.3], [-213.8, 106]].map(rel);
const H_PORTA = 12.8, H_CASA = 10.6, IMPALCATO = 5.2;

const sc = new Scene();
sc.shadow(PORTA.concat(CASA), [-2.4, 0.9]);

/** Muro di sponda: pietra fino all'impalcato, due corsi e la copertina chiara in cima. */
function sponda(f, t0 = 0, t1 = f.len) {
  rect(sc, f, t0, t1, 0, IMPALCATO, tone(f, RIVA), { sw: 0.6, batch: false });
  for (const z of [1.6, 3.2]) sc.line([fp(f, t0, z), fp(f, t1, z)], { sw: 0.35, sop: 0.4, batch: true });
  rect(sc, f, t0, t1, IMPALCATO - 0.4, IMPALCATO, f.lit ? '#cdbfa3' : '#b3a488', { sw: 0.35, batch: false });
}
/** Botte in piedi: doghe, due cerchi, coperchio. */
function botte(c, r, h) {
  const pt = (an, k, z) => [c[0] + r * k * Math.cos(an), c[1] + r * k * Math.sin(an), z];
  const arc = (k, z) => { const o = []; for (let i = 0; i <= 8; i++) o.push(pt(Math.PI * (0.75 + i / 8), k, z)); return o; };
  sc.path([...arc(0.85, 0), pt(Math.PI * 1.75, 1.08, h / 2), ...arc(0.85, h).reverse(), pt(Math.PI * 0.75, 1.08, h / 2)], '#9a6a44', { sw: 0.4 });
  for (const z of [h * 0.25, h * 0.75]) sc.line(arc(1, z), { sw: 0.45, stroke: PORTONE });
  const top = []; for (let i = 0; i < 16; i++) top.push(pt((Math.PI * i) / 8, 0.85, h));
  sc.path(top, '#b98a62', { sw: 0.35 });
}

// ---- casa-porta in testa al ponte -----------------------------------------------------
{
  const [o, s] = facce(PORTA); // ovest (sul fiume, 12.6 m, in ombra) e sud (7.4 m)
  for (const f of [o, s]) rect(sc, f, 0, f.len, 0, H_PORTA, tone(f, ROSA), { sw: 0.8, batch: false });
  sponda(o);
  // il fornice da cui esce il ponte: cornice in pietra bianca, soglia con il tavolato
  const T = 5.1, W = 3.6, HA = 4.3, r = W / 2;
  arco(sc, o, T, IMPALCATO, W + 0.9, HA + 0.45, PIETRA[0], { sw: 0.5 });
  arco(sc, o, T, IMPALCATO, W, HA, BUIO);
  sc.path([fp(o, T - r, IMPALCATO), fp(o, T + r, IMPALCATO), fp(o, T + r, IMPALCATO + 1.04), fp(o, T - r + 1.2, IMPALCATO + 1.04)], TAVOLATO, { sw: 0.4 });
  // labbro dell'impalcato che sporge sul fiume
  const lab = (t, z, d) => { const q = fp(o, t, z); return [q[0] - d, q[1], z]; };
  sc.path([fp(o, T - r - 0.45, IMPALCATO), fp(o, T + r + 0.45, IMPALCATO), lab(T + r + 0.45, IMPALCATO, 0.7), lab(T - r - 0.45, IMPALCATO, 0.7)], TAVOLATO, { sw: 0.4 });
  sc.path([lab(T - r - 0.45, IMPALCATO, 0.7), lab(T + r + 0.45, IMPALCATO, 0.7), lab(T + r + 0.45, IMPALCATO - 0.4, 0.7), lab(T - r - 0.45, IMPALCATO - 0.4, 0.7)], BRUNO[1], { sw: 0.4 });
  // finestre con scuri bruni: tre sotto la gronda, una a destra del ponte
  for (const t of [2.1, 5.1, 8.1, 11.1]) scuriAperti(sc, o, t, 10.25, 0.85, 1.45, BRUNO, 0.42);
  scuriAperti(sc, o, 11.1, 6.6, 0.85, 1.45, BRUNO, 0.42);
  for (const f of [o, s]) gronda(sc, f, H_PORTA, f.lit ? '#c98a66' : '#a96c4c');
  tetto(sc, sporto(PORTA, 0.6), rel([-222.5, 107.6]), rel([-222.4, 112.5]), H_PORTA, H_PORTA + 2.1);
  comignolo(sc, rel([-223.6, 110.6]), H_PORTA + 1.3);
}

// ---- la grapperia ---------------------------------------------------------------------
{
  const [o, s] = facce(CASA).sort((p, q) => p.len - q.len); // ovest (sul fiume, 2.8 m) e sud (12 m)
  for (const f of [o, s]) rect(sc, f, 0, f.len, 0, H_CASA, tone(f, OCRA), { sw: 0.8, batch: false });
  // lato fiume: lo stesso muro di sponda, e una finestra chiusa sopra
  sponda(o);
  scuriChiusi(sc, o, o.len / 2, 6.3, 1, 1.7, SCURI);
  // facciata: zoccolo, cantonale in pietra all'altezza della sponda, marcapiano
  rect(sc, s, 0, s.len, 0, 0.55, RIVA[0], { sw: 0.4, batch: false });
  sponda(s, 0, 0.75); // la testa del muro di sponda, vista di taglio
  sc.line([fp(s, 0.75, 4.1), fp(s, s.len, 4.1)], { sw: 0.4, sop: 0.55 });
  // vetrina: stipiti in pietra, vetro ambrato, fascia scura dell'insegna
  const V = 2.75;
  rect(sc, s, V - 1.4, V + 1.4, 0, 2.75, PIETRA[0], { sw: 0.4, batch: false });
  rect(sc, s, V - 1.2, V + 1.2, 0, 2.75, FASCIA, { sw: 0.4, batch: false });
  rect(sc, s, V - 1.2, V - 0.2, 0.9, 2.75, AMBRA, { sw: 0.35, batch: false });
  rect(sc, s, V + 0.2, V + 1.2, 0, 2.75, AMBRA, { sw: 0.35, batch: false });
  rect(sc, s, V - 1.5, V + 1.5, 2.75, 3.55, FASCIA, { sw: 0.45, batch: false });
  // portone ad arco: cornice in pietra, battenti quasi neri a spina di pesce, lunetta chiara
  const D = 6.05, DW = 2.6, DH = 3.6, dr = DW / 2, imp = DH - dr;
  arco(sc, s, D, 0, DW + 0.6, DH + 0.3, PIETRA[0], { sw: 0.5 });
  arco(sc, s, D, 0, DW, DH, PORTONE);
  sc.path(arcoPts(s, D, imp - 0.01, DW - 0.5, dr - 0.24).slice(1, -1), LUNETTA, { sw: 0.35 });
  for (const dz of [0.4, 0.75]) sc.line([fp(s, D - 0.55, imp + dz - 0.1), fp(s, D, imp + dz + 0.06), fp(s, D + 0.55, imp + dz - 0.1)], { sw: 0.3, sop: 0.75 });
  sc.line([fp(s, D, 0), fp(s, D, imp)], { sw: 0.35, stroke: '#75604d' });
  for (const z of [0.3, 1.0, 1.7]) sc.line([fp(s, D - dr + 0.15, z + 0.5), fp(s, D, z), fp(s, D + dr - 0.15, z + 0.5)], { sw: 0.3, stroke: '#75604d', sop: 0.9 });
  // due finestrelle quadrate con l'inferriata
  for (const t of [9.15, 10.9]) {
    rect(sc, s, t - 0.68, t + 0.68, 1.35, 2.7, PIETRA[0], { sw: 0.35, batch: false });
    rect(sc, s, t - 0.5, t + 0.5, 1.53, 2.52, VETRO, { sw: 0.35, batch: false });
    sc.line([fp(s, t, 1.53), fp(s, t, 2.52)], { sw: 0.3, stroke: PIETRA[0], sop: 0.8 });
    sc.line([fp(s, t - 0.5, 2.02), fp(s, t + 0.5, 2.02)], { sw: 0.3, stroke: PIETRA[0], sop: 0.8 });
  }
  // primo piano: cinque finestre con gli scuri antracite chiusi; sottotetto: cinque piccole
  const B = [1.75, 3.9, 6.05, 8.2, 10.35];
  rect(sc, s, B[3] - 0.7, B[3] + 0.7, 4.72, 5.12, FIORI, { sw: 0.3, batch: false });
  for (const t of B) scuriChiusi(sc, s, t, 5.1, 1.25, 2.05, SCURI);
  for (const t of B) rect(sc, s, t - 0.45, t + 0.45, 8.35, 9.3, SCURI[0], { sw: 0.4 });
  for (const f of [o, s]) gronda(sc, f, H_CASA, f.lit ? '#a87a36' : '#8f6a2e');
  // tetto: la falda sud e la testata sul fiume; verso nord muore contro la casa-porta
  tetto(sc, sporto(CASA, 0.55), rel([-224.6, 102.45]), rel([-215.6, 103.1]), H_CASA, H_CASA + 1.7);
  comignolo(sc, rel([-218.2, 102.2]), H_CASA + 1.0);
  // insegna a bandiera tra il portone e le finestrelle, e due botti davanti alla bottega
  const ins = (z, d) => { const q = fp(s, 7.7, z); return [q[0], q[1] - d, z]; };
  sc.line([ins(3.8, 0), ins(3.8, 0.8)], { sw: 0.4 });
  sc.path([ins(3.65, 0.12), ins(3.65, 0.75), ins(3, 0.75), ins(3, 0.12)], FASCIA, { sw: 0.4 });
  sc.path([ins(3.48, 0.28), ins(3.48, 0.6), ins(3.17, 0.6), ins(3.17, 0.28)], AMBRA, { sw: 0.25 });
  for (const t of [4.35, 7.75]) { const q = fp(s, t, 0); botte([q[0], q[1] - 0.6], 0.36, 0.9); }
}

const OUT = process.argv[2] || new URL('../../../public/landmarks/nardini-basso.svg', import.meta.url).pathname;
const res = sc.svg();
fs.writeFileSync(OUT, res.svg);
const K = 111320 * Math.cos((45.7665 * Math.PI) / 180);
console.log(OUT, (res.svg.length / 1024).toFixed(1) + ' KB', `${res.w}x${res.h}`);
console.log('lat', +(45.7665 + A[1] / 110574).toFixed(6), 'lon', +(11.7345 + A[0] / K).toFixed(6), 'larghezzaMetri', res.larghezzaMetri, 'ancora', res.ancora.join(', '));
