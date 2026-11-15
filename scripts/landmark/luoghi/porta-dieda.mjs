// Porta Dieda (Via Roma): genera public/landmarks/porta-dieda.svg.
// Uso: node scripts/landmark/luoghi/porta-dieda.mjs [file di uscita]
//
// Impronta reale (OpenStreetMap, way 781910187, metri locali): rettangolo di 10,0 x 8,7 m,
// centro (115.6, -173.85). Nella realta' la faccia affrescata con il fornice guarda a
// sud-sud-est (lato a 60 gradi da nord): disegnata cosi' si vedrebbe quasi di taglio (10 m
// diventano 2,6 m sullo schermo) e la porta sembrerebbe un campanile.
// LICENZA DICHIARATA: la torre e' girata di 30 gradi, con la faccia della porta lungo l'asse
// est della mappa (rivolta a sud), cosi' il fornice e l'affresco stanno sulla faccia grande in
// luce. Centro, misure in pianta e mura restano quelli veri; cambia solo l'orientamento.
// Altezza: la gronda vera e' a circa 21,6 m (stima dalle foto); qui 19 m, un po' piu' tozza.
// Mura: i due tratti reali (way 812881197 a ovest, 812881196 a est) partono dai fianchi della
// torre lungo la direzione della faccia; qui due ali merlate di 7 m, arretrate di 1,5 m.
//
// Nota: ../iso.mjs non si puo' importare da solo, perche' carica geo.mjs che legge osm.json
// (non presente nel repository). Qui sotto c'e' la parte minima dello stesso motore (stessa
// proiezione, stessa ombra, stesso formato SVG), come in torre-civica.mjs.
import fs from 'fs';

const S = 4; // unita' SVG per metro isometrico
const SEP = '#5b4636';
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
  shadow(poly, h, f = 0.42) {
    const k = Math.min(h, 26) * f, off = [-0.8 * k, 0.38 * k];
    this.sh.push(hull(poly.concat(poly.map((p) => [p[0] + off[0], p[1] + off[1]]))));
  }
  svg() {
    let sh = ''; for (const h of this.sh) sh += this.d2(h.map((p) => P(p[0], p[1], 0)));
    const pad = 3, x0 = Math.floor(this.mn[0] - pad), y0 = Math.floor(this.mn[1] - pad);
    const w = Math.ceil(this.mx[0] + pad) - x0, h = Math.ceil(this.mx[1] + pad) - y0;
    const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" width="${w}" height="${h}">\n` +
      `<g stroke="${SEP}" stroke-width=".8" stroke-linejoin="round" stroke-linecap="round">\n` +
      `<path d="${sh}" fill="#543e2a" fill-opacity=".2" stroke="none"/>\n` +
      this.s.map((e) => `<path d="${e.d}"${e.a}/>`).join('\n') + '\n</g>\n</svg>\n';
    return { svg: out, w, h, ancora: [+((0 - x0) / w).toFixed(4), +((0 - y0) / h).toFixed(4)], larghezzaMetri: +(w / S).toFixed(1) };
  }
}

const OUT = process.argv[2] || new URL('../../../public/landmarks/porta-dieda.svg', import.meta.url).pathname;

// ---- tinte: [in luce, in ombra]
const INTONACO = ['#f0d9b0', '#c9a680'], BASE = ['#e2c79c', '#b9966f'], PIETRA = ['#f6ecd6', '#d6c7a8'];
const MURA = ['#cf906c', '#a06f52'], CAMMINO = '#dcc09a';
const COTTO = { s: '#c8643c', o: '#a84e30', n: '#b65835', e: '#d0704a' }, GRONDA = ['#8a5a40', '#6e4634'];
const BUIO = '#4a382d', ANDITO = '#77604c', STRADA = '#ecdfc2', LUCE = '#f4e9cf';
const ROSSO = '#b4553c', ORO = '#d48f35', CHIARO = '#f6ecd4', AQUILA = '#6a625c';

// ---- misure (metri). Faccia della porta lungo l'asse est, rivolta a sud.
const HA = 5.0, HB = 4.35; // mezzi lati: 10 m lungo est, 8,7 m lungo nord
const ZG = 19, ZC = 21.3, SPORTO = 0.9; // gronda, colmo, sporto del tetto
const p3 = (a, b, z = 0) => [a, b, z];
// facce visibili: d = metri dal centro della faccia, da sinistra a destra sullo schermo
const Sd = (d, z) => [d, -HB, z];
const Ov = (d, z) => [-HA, -d, z];

const sc = new Scene();
const quad = (F, d0, d1, z0, z1, fill, o) => sc.path([F(d0, z0), F(d1, z0), F(d1, z1), F(d0, z1)], fill, o);
const poli = (F, pts, fill, o) => sc.path(pts.map(([d, z]) => F(d, z)), fill, o);
const arcoPts = (d, z, w, h) => {
  const r = w / 2, pts = [[d - r, z], [d - r, z + h - r]];
  for (let i = 1; i < 6; i++) { const an = Math.PI - (i * Math.PI) / 6; pts.push([d + r * Math.cos(an), z + h - r + r * Math.sin(an)]); }
  pts.push([d + r, z + h - r], [d + r, z]); return pts;
};
const arco = (F, d, z, w, h, fill, o = {}) => poli(F, arcoPts(d, z, w, h), fill, { sw: 0.4, ...o });
const sestoPts = (d, z, w, h) => { // arco appena acuto, come il fornice
  const r = w / 2, k = h - w * 0.62;
  return [[d - r, z], [d - r, z + k], [d - r * 0.86, z + k + w * 0.27], [d - r * 0.5, z + k + w * 0.5], [d, z + h], [d + r * 0.5, z + k + w * 0.5], [d + r * 0.86, z + k + w * 0.27], [d + r, z + k], [d + r, z]];
};
const sesto = (F, d, z, w, h, fill, o = {}) => poli(F, sestoPts(d, z, w, h), fill, { sw: 0.5, ...o });
/** Scatola allineata agli assi: faccia ovest (ombra), faccia sud (luce), piano. */
const scatola = (a0, a1, b0, b1, z0, z1, col, top, sw = 0.6) => {
  sc.path([p3(a0, b1, z0), p3(a0, b0, z0), p3(a0, b0, z1), p3(a0, b1, z1)], col[1], { sw });
  sc.path([p3(a0, b0, z0), p3(a1, b0, z0), p3(a1, b0, z1), p3(a0, b0, z1)], col[0], { sw });
  if (top) sc.path([p3(a0, b0, z1), p3(a1, b0, z1), p3(a1, b1, z1), p3(a0, b1, z1)], top, { sw });
};

// ---- mura: due ali nel piano della porta, arretrate rispetto alla faccia
const LM = 7, B0 = -HB + 1.5, B1 = B0 + 1.4, ZM = 5, HMERLO = 1.2, LMERLO = 1.0, NM = 4;
const LF = 2.3; // mezza larghezza del fornice
const ala = (a0, a1) => {
  scatola(a0, a1, B0, B1, 0, ZM, MURA, CAMMINO);
  for (const z of [1.25, 2.5, 3.75]) sc.line([p3(a0, B0, z), p3(a1, B0, z)], { sw: 0.3, sop: 0.4, batch: true });
  const L = a1 - a0;
  for (const [z0, t] of [[0, 0.3], [1.25, 0.6], [2.5, 0.2], [2.5, 0.8], [3.75, 0.45], [0, 0.75], [1.25, 0.15]])
    sc.line([p3(a0 + L * t, B0, z0), p3(a0 + L * t, B0, z0 + 1.25)], { sw: 0.3, sop: 0.3, batch: true });
  const passo = (L - LMERLO) / (NM - 1);
  for (let i = NM - 1; i >= 0; i--) { const m = a0 + i * passo; scatola(m, m + LMERLO, B0, B0 + 0.5, ZM, ZM + HMERLO, MURA, CAMMINO, 0.5); }
};

// ---- ombra a terra: un'unica sagoma, torre e ali insieme
sc.shadow([[-HA, -HB], [HA, -HB], [HA, HB], [-HA, HB]], ZG, 0.6);
sc.shadow([[-HA - LM, B0], [-HA, B0], [-HA, B1], [-HA - LM, B1]], ZM + HMERLO, 0.6);
sc.shadow([[HA, B0], [HA + LM, B0], [HA + LM, B1], [HA, B1]], ZM + HMERLO, 0.6);

// ---- via Roma: una striscia chiara che entra nel fornice e riappare dietro la torre
const stradaO = { sw: 0.4, sop: 0.5 };
sc.path([p3(-LF - 0.1, HB), p3(LF + 0.1, HB), p3(LF + 0.1, HB + 9.5), p3(-LF - 0.1, HB + 9.5)], STRADA, stradaO);
sc.path([p3(-LF - 0.1, -HB), p3(LF + 0.1, -HB), p3(LF + 0.3, -HB - 6.5), p3(-LF - 0.3, -HB - 6.5)], STRADA, stradaO);

// ---- ala est (sta dietro lo spigolo della torre)
ala(HA, HA + LM);

// ---- torre: muri
quad(Ov, -HB, HB, 0, ZG, INTONACO[1]);
quad(Sd, -HA, HA, 0, ZG, INTONACO[0]);
// parte bassa in pietra e intonaco grezzo
const ZB = 7.2;
quad(Ov, -HB, HB, 0, ZB, BASE[1], { stroke: 'none' });
quad(Sd, -HA, HA, 0, ZB, BASE[0], { stroke: 'none' });
sc.line([Ov(-HB, ZB), Ov(HB, ZB)], { sw: 0.3, sop: 0.4 });
// corsi di pietra accennati sulla parte bassa
for (const [z, d0, d1] of [[1.5, -4.8, -3.3], [3, 3.2, 4.8], [4.5, -4.8, -3.5], [6, 3.4, 4.8], [6.3, -4.6, -2.6]])
  sc.line([Sd(d0, z), Sd(d1, z)], { sw: 0.3, sop: 0.35, batch: true });
for (const [z, d0, d1] of [[1.8, -1, 3.6], [3.6, -3.8, -0.5], [5.4, 0.2, 3.9]])
  sc.line([Ov(d0, z), Ov(d1, z)], { sw: 0.3, sop: 0.35, batch: true });

// ---- faccia ovest (in ombra): quattro buche pontaie in fila, una feritoia, loggia
for (const d of [-3, -1, 1, 3]) quad(Ov, d - 0.15, d + 0.15, 9.2, 9.55, BUIO, { stroke: 'none', op: 0.6, batch: true });
quad(Ov, -0.25, 0.25, 11.6, 13.6, BUIO, { sw: 0.4 });
sc.line([Ov(-HB, 15.95), Ov(HB, 15.95)], { sw: 0.5, stroke: ROSSO, sop: 0.7 });
for (const d of [-2.6, 0, 2.6]) arco(Ov, d, 16.4, 1.15, 1.8, BUIO);

// ---- faccia sud (in luce): fornice
const WF = 2 * LF, HF = 6.1;
sesto(Sd, 0, 0, WF + 1.3, HF + 0.75, PIETRA[0]);
sesto(Sd, 0, 0, WF, HF, BUIO);
// dentro: il selciato dell'andito visto dall'alto e la luce che entra dall'altra parte
const zs = 3.2, ds = LF - zs / 0.866;
poli(Sd, [[-LF, 0], [LF, 0], [ds, zs], [-LF, zs]], ANDITO, { stroke: 'none' });
poli(Sd, [[-LF, 0], [LF, 0], [LF - 1.5, 1.3], [-LF, 1.3]], STRADA, { stroke: 'none' });
sesto(Sd, -0.55, 1.3, 2.1, 3.3, LUCE, { sw: 0.3, sop: 0.5 });
sesto(Sd, 0, 0, WF, HF, 'none', { sw: 0.6 });
// conci della ghiera
for (const [d, z, d2, z2] of [[-LF - 0.65, 2, -LF, 2], [LF, 2, LF + 0.65, 2], [-LF - 0.65, 3.8, -LF, 3.8], [LF, 3.8, LF + 0.65, 3.8], [-1.9, 5.25, -2.4, 5.75], [1.9, 5.25, 2.4, 5.75], [0, HF, 0, HF + 0.75]])
  sc.line([Sd(d, z), Sd(d2, z2)], { sw: 0.3, sop: 0.5, batch: true });

// ---- affresco sopra il fornice: riquadro chiaro bordato di rosso, leone di San Marco, stemmi
const F0 = 7.9, F1 = 15.6;
quad(Sd, -4.4, 4.4, F0, F1, CHIARO, { stroke: ROSSO, sw: 0.7 });
quad(Sd, -4.1, -1.2, 12.9, 15.3, '#ecca84', { stroke: 'none' });
// aquila imperiale, scura, in alto a sinistra
poli(Sd, [[-4, 15.1], [-3.1, 14.7], [-2.8, 15.3], [-2.5, 15.3], [-2.2, 14.7], [-1.3, 15.1], [-1.5, 13.7], [-2.3, 13.9], [-2.65, 13.2], [-3, 13.9], [-3.8, 13.7]], AQUILA, { stroke: 'none' });
// leone alato, passante verso sinistra: ala, corpo, coda
poli(Sd, [[-1.3, 13.1], [-0.6, 14.4], [3.3, 14.7], [1.7, 14], [2.7, 13.6], [0.6, 13]], '#e6ad52', { sw: 0.3, sop: 0.55 });
poli(Sd, [[-3.5, 12.3], [-3.5, 12.8], [-3, 13.5], [-2.2, 13.7], [-1.5, 13.3], [2.6, 12.9], [3.2, 12.3], [3.2, 11.5], [3.6, 10.7], [2.8, 10.7], [2.5, 11.5], [0, 11.7], [-0.9, 11.6], [-1, 10.7], [-1.8, 10.7], [-1.9, 11.6], [-2.6, 11.5], [-2.9, 12.2]], ORO, { sw: 0.3, sop: 0.55 });
sc.line([Sd(3.1, 12.5), Sd(3.8, 13.1), Sd(4.1, 12.6), Sd(3.8, 12.2)], { sw: 0.8, stroke: ORO });
// stemmi in fila
sc.line([Sd(-4.4, 10.4), Sd(4.4, 10.4)], { sw: 0.3, stroke: ROSSO, sop: 0.8 });
const stemma = (d, fill) => poli(Sd, [[d - 0.75, 10], [d + 0.75, 10], [d + 0.75, 9], [d, 8.2], [d - 0.75, 9]], fill, { sw: 0.3, sop: 0.6 });
stemma(-3.2, ORO); stemma(-1.6, ROSSO); stemma(1.6, ROSSO); stemma(3.2, ROSSO);
// finestrelle dentro l'affresco
quad(Sd, -0.5, 0.5, 8.6, 9.9, BUIO, { sw: 0.4 });
quad(Sd, 0.3, 1.3, 14.2, 15.3, BUIO, { sw: 0.4 });
// fascia e loggia sotto gronda: quattro archetti
sc.line([Sd(-HA, 15.95), Sd(HA, 15.95)], { sw: 0.5, stroke: ROSSO, sop: 0.7 });
for (const d of [-3.3, -1.1, 1.1, 3.3]) arco(Sd, d, 16.4, 1.15, 1.8, BUIO);
// ombra della gronda sui muri
quad(Ov, -HB, HB, ZG - 0.7, ZG, BUIO, { stroke: 'none', op: 0.22 });
quad(Sd, -HA, HA, ZG - 0.7, ZG, BUIO, { stroke: 'none', op: 0.16 });
// spigolo tra le due facce
sc.line([Sd(-HA, 0), Sd(-HA, ZG)], { sw: 0.8 });

// ---- tetto a padiglione, basso e sporgente
const E = (sa, sb, z = ZG) => p3(sa * (HA + SPORTO), sb * (HB + SPORTO), z);
const R = (s) => p3(s * (HA - HB), 0, ZC);
const FZ = ZG - 0.35;
sc.path([E(-1, 1, FZ), E(-1, -1, FZ), E(-1, -1), E(-1, 1)], GRONDA[1], { sw: 0.5 });
sc.path([E(-1, -1, FZ), E(1, -1, FZ), E(1, -1), E(-1, -1)], GRONDA[0], { sw: 0.5 });
sc.path([E(-1, 1), E(1, 1), R(1), R(-1)], COTTO.n, { sw: 0.6 });
sc.path([E(1, -1), E(1, 1), R(1)], COTTO.e, { sw: 0.6 });
sc.path([E(-1, 1), E(-1, -1), R(-1)], COTTO.o, { sw: 0.6 });
sc.path([E(-1, -1), E(1, -1), R(1), R(-1)], COTTO.s, { sw: 0.6 });
// file di coppi appena accennate
const mix = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
for (const t of [0.33, 0.66]) {
  sc.line([mix(E(-1, -1), R(-1), t), mix(E(1, -1), R(1), t)], { sw: 0.3, sop: 0.35, batch: true });
  sc.line([mix(E(-1, 1), R(-1), t), mix(E(-1, -1), R(-1), t)], { sw: 0.3, sop: 0.35, batch: true });
}

// ---- ala ovest, davanti alla faccia in ombra
ala(-HA - LM, -HA);

const res = sc.svg();
fs.writeFileSync(OUT, res.svg);
console.log('porta-dieda', (res.svg.length / 1024).toFixed(1) + ' KB', `${res.w}x${res.h}`, 'larghezzaMetri', res.larghezzaMetri, 'ancora', res.ancora.join(','));
