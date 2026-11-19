// Tempio Ossario: genera public/landmarks/tempio-ossario.svg.
// Uso: node scripts/landmark/luoghi/tempio-ossario.mjs [file di uscita]
//
// Com'e' fatto (OpenStreetMap + fotografie di Wikimedia Commons):
// - croce latina lunga circa 74 m, asse a 171,5 gradi da nord: la facciata col rosone guarda
//   a nord (piazzale Cadorna) e dalla vista della mappa, che guarda da sud-ovest, non si vede;
// - si vedono il fianco ovest (in ombra) e la testata sud (in luce): abside poligonale,
//   coro, e ai lati del coro i due campanili quadrati di mattoni;
// - i campanili non hanno guglie: cella campanaria con un grande arco acuto per lato,
//   orologio, tettuccio basso a piramide e croce;
// - sopra la crociera c'e' un tiburio ottagonale con tetto basso di coppi;
// - navata alta con oculi rotondi, navatelle con finestre ogivali incorniciate di bianco,
//   testate del transetto a capanna con un rosone.
// Misure in pianta da OSM (way 145923980 e parti), in metri locali; nel modello s corre
// lungo l'asse (da nord a sud) e t di traverso (positivo a ovest), con origine nell'ancora
// A = (-75, -350), al centro della crociera.
// Altezze: gronda della navata 21 m, colmo 25,5 (facciata 26,9 m al vertice); i campanili sono
// disegnati alti 53,4 m alla punta del tetto (le fonti dicono «60 metri»; sulle fotografie
// svettano di circa un'altezza di navata sopra il colmo).
//
// Il motore di disegno e' quello condiviso di ../iso.mjs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Scene, box, ogiva, win, row, hline, vline, gable, hip, shed, prism, cone, ngon, fp, hull } from '../iso.mjs';

const qui = path.dirname(fileURLToPath(import.meta.url));

const A = [-75, -350]; // ancora in metri locali: centro della crociera
const lon0 = 11.7345, lat0 = 45.7665, K = 111320 * Math.cos((lat0 * Math.PI) / 180);
const rad = (g) => (g * Math.PI) / 180;
const a = 171.5, U = [Math.sin(rad(a)), Math.cos(rad(a))], V = [Math.cos(rad(a)), -Math.sin(rad(a))];
const at = (s, t) => [U[0] * s + V[0] * t, U[1] * s + V[1] * t];

// tinte: [in luce, in ombra]
const TM = ['#d99473', '#b67257']; // mattone rosso
const TM2 = ['#cf8a6a', '#ab694f']; // lesene e cornici, appena piu' scure
const COTTO = ['#c8643c', '#a84e30'];
const BIANCO = '#f3e7cf', BIANCO_OMBRA = '#dccdb0', VETRO = '#6a5547', BUIO = '#4d3b2f';

const sc = new Scene();
let ordine = 1000; // i solidi si disegnano nell'ordine in cui sono scritti, da dietro in avanti
const solido = (fn) => sc.solid(ordine--, fn);
const bianco = (f) => (f.lit ? BIANCO : BIANCO_OMBRA);
const Pm = (p) => [(p[0] - p[1]) * 0.7071 * 4, (-(p[0] + p[1]) * 0.35355 - (p[2] || 0) * 0.8165) * 4];
const n1 = (v) => String(+v.toFixed(1));
/** Quanto una faccia e' di scorcio: 1 = larga, 0 = di taglio. Sotto 0,3 niente dettagli. */
const scorcio = (f) => Math.abs((f.b[0] - f.b[1]) - (f.a[0] - f.a[1])) * 0.7071 / f.len;
const larga = (f) => scorcio(f) > 0.3;
/** Cerchio vero sul piano della faccia (ellisse a schermo), con quattro curve di Bezier. */
const cerchio = (f, t, z, r, fill, o = {}) => {
  const C = Pm(fp(f, t, z)), X = Pm(fp(f, t + r, z)), Z = Pm(fp(f, t, z + r));
  const ex = [X[0] - C[0], X[1] - C[1]], ez = [Z[0] - C[0], Z[1] - C[1]], k = 0.5523;
  const q = (i, j) => n1(C[0] + ex[0] * i + ez[0] * j) + ' ' + n1(C[1] + ex[1] * i + ez[1] * j);
  sc.rawd(`M${q(1, 0)}C${q(1, k)} ${q(k, 1)} ${q(0, 1)}C${q(-k, 1)} ${q(-1, k)} ${q(-1, 0)}C${q(-1, -k)} ${q(-k, -1)} ${q(0, -1)}C${q(k, -1)} ${q(1, -k)} ${q(1, 0)}Z`, fill, { sw: 0.5, batch: true, ...o });
};
/** Archetti pensili sotto la gronda: una riga di puntini chiari. */
const DENT = ` fill="none" stroke="${BIANCO}" stroke-width=".6" stroke-dasharray=".5 1.7"`;
const archetti = (f, z, t0 = 0.4, t1 = f.len - 0.4) => { if (larga(f)) sc.emit(sc.d2([Pm(fp(f, t0, z)), Pm(fp(f, t1, z))], true), DENT, true); };
/** Cornice di pietra: fascia chiara alta h su tutta la faccia. */
const cornice = (f, z, h = 0.6) => win(sc, f, f.len / 2, z, f.len, h, bianco(f), { sw: 0.3 });
const fascia = (f, z, t0 = 0, t1 = f.len) => hline(sc, f, z, t0, t1, { stroke: BIANCO, sw: 0.7 });
/** Finestra ogivale con la cornice di pietra bianca. */
const finestra = (f, t, z, w, h, vetro = VETRO) => { ogiva(sc, f, t, z - 0.25, w + 0.9, h + 0.75, bianco(f), { sw: 0.4 }); ogiva(sc, f, t, z, w, h, vetro, { sw: 0.4 }); };
const oculo = (f, t, z, r) => { cerchio(f, t, z, r + 0.55, bianco(f), { sw: 0.4 }); cerchio(f, t, z, r, VETRO, { sw: 0.4 }); };
const lesene = (f, ts, z0, z1) => { for (const t of ts) vline(sc, f, t, z0, z1, { sop: 0.45 }); };
const bordi = (f, n) => { const o = []; for (let i = 1; i < n; i++) o.push((f.len * i) / n); return o; };
/** Croce in cima: asta verticale e braccio di traverso all'asse della chiesa. */
const croce = (c, z, h = 2.2, W_ = V) => {
  const b = h * 0.28;
  sc.line([[c[0], c[1], z], [c[0], c[1], z + h]], { sw: 0.8 });
  sc.line([[c[0] - W_[0] * b, c[1] - W_[1] * b, z + h * 0.68], [c[0] + W_[0] * b, c[1] + W_[1] * b, z + h * 0.68]], { sw: 0.8 });
};
/** Contrafforte o pinnacolo: pilastrino con il cappello di pietra. */
const pilastrino = (c, l, z0, h) => { const b = box(sc, { c, ang: a, L: l, W: l, z0, h, col: TM, shadow: false, top: BIANCO }); for (const f of b.vis) cornice(f, z0 + h - 0.5, 0.5); };

const navatella = (lato, s0, s1, n) => solido(() => {
  const b = box(sc, { c: at((s0 + s1) / 2, lato * 11), ang: a, L: s1 - s0, W: 10, h: 10.5, col: TM });
  for (const f of b.vis) {
    if (f.len < 12 || lato < 0) continue; // la navatella est e' nascosta dalla navata
    fascia(f, 1.2); fascia(f, 9.9); archetti(f, 9.2);
    lesene(f, bordi(f, n), 1.2, 9.9);
    row(f, n, 0).forEach((t, i) => {
      if (lato > 0 && i === 4) finestra(f, t, 0.4, 1.7, 4.2, BUIO); // porta laterale
      else if (lato < 0 || i < 6) finestra(f, t, 3.4, 1.5, 4.6); // l'ultima campata sta dietro al contrafforte
    });
  }
  shed(sc, b, 3.4, COTTO, -lato);
});
const corpoAlto = (s0, s1, fn, ov = 0.5) => solido(() => {
  const b = box(sc, { c: at((s0 + s1) / 2, 0), ang: a, L: s1 - s0, W: 12.5, h: 21, col: TM });
  if (fn) fn(b);
  gable(sc, b, 4.5, COTTO, { ov, timpano: TM });
});
const cappella = (lato) => solido(() => {
  const c = at(2.3, lato * 17);
  const pg = ngon(c, 4.6, 5, (Math.atan2(V[1], V[0]) * 180) / Math.PI - 90 + (lato < 0 ? 180 : 0), 0, 180);
  const fs_ = prism(sc, pg, 0, 8, TM);
  for (const f of fs_) if (f.len > 2 && f.len < 8 && larga(f)) { fascia(f, 7.4); finestra(f, f.len / 2, 2.6, 0.9, 3.4); }
  cone(sc, pg, 8, [c[0], c[1], 11], COTTO);
});
const fianco = (lato) => solido(() => { // corpo basso tra transetto e campanile
  const b = box(sc, { c: at(14, lato * 10.6), ang: a, L: 11, W: 9.4, h: 13, col: TM });
  for (const f of b.vis) { fascia(f, 1.2); fascia(f, 12.4); archetti(f, 11.7); for (const t of row(f, 2, 0.6)) finestra(f, t, 4.2, 1.3, 5); }
  shed(sc, b, 3, COTTO, -lato);
});
const HF = 41, HC = 9.6; // fusto e cella campanaria
const campanile = (lato) => solido(() => {
  const c = at(22.15, lato * 14.6);
  const fusto = box(sc, { c, ang: a, L: 5.2, W: 5.2, h: HF, col: TM });
  if (lato > 0) { // ombra lunga, in proporzione all'altezza vera (il motore la tronca a 26 m)
    const k = (HF + HC + 2.8) * 0.42;
    sc.sh.push(hull(fusto.poly.concat(fusto.poly.map((p) => [p[0] - 0.8 * k, p[1] + 0.38 * k]))));
  }
  for (const f of fusto.vis) {
    fascia(f, 1.2); fascia(f, HF - 8.6);
    for (const z of lato > 0 ? [8, 15.5, 23] : [29.2]) win(sc, f, f.len / 2, z, 0.55, 2.2, BUIO, { sw: 0.4 });
    // orologio
    cerchio(f, f.len / 2, HF - 4.3, 1.5, bianco(f), { sw: 0.5 });
    sc.line([fp(f, f.len / 2, HF - 3.4), fp(f, f.len / 2, HF - 4.3), fp(f, f.len / 2 + 0.6, HF - 4.3)], { sw: 0.5 });
    archetti(f, HF - 1.3, 0.3, f.len - 0.3);
  }
  // cella campanaria, appena sporgente, tra due cornici di pietra
  const cella = box(sc, { c, ang: a, L: 6, W: 6, z0: HF, h: HC, col: TM, shadow: false });
  for (const f of cella.vis) {
    cornice(f, HF, 0.7); cornice(f, HF + HC - 0.7, 0.7); archetti(f, HF + HC - 1.4, 0.3, f.len - 0.3);
    ogiva(sc, f, f.len / 2, HF + 1.6, 3.5, 6.4, bianco(f), { sw: 0.4 });
    ogiva(sc, f, f.len / 2, HF + 1.6, 2.5, 5.8, BUIO, { sw: 0.4 });
    hline(sc, f, HF + 3, f.len / 2 - 1.25, f.len / 2 + 1.25, { stroke: BIANCO, sw: 0.7 }); // parapetto
  }
  hip(sc, cella, 2.8, COTTO, { ov: 0.45 });
  croce(c, HF + HC + 2.8, 2.6);
});

// ---- da dietro (nord-est) in avanti (sud-ovest) ---------------------------
navatella(-1, -40.8, -4, 7); // navatella est: dalla vista ne spunta solo il tetto
// La facciata guarda a nord e non si vede: se ne vede il rovescio, che sale a capanna sopra il
// tetto, con i due pinnacoli ai lati e la croce di pietra in cima.
const SF = -39.95, facc = (t, z) => { const q = at(SF, t); return [q[0], q[1], z]; };
solido(() => {
  sc.path([facc(-6.9, 12), facc(6.9, 12), facc(6.9, 22.3), facc(0, 26.9), facc(-6.9, 22.3)], TM[0]);
  pilastrino(at(SF, -6.9), 1.4, 21, 3.4);
  croce(at(SF, 0), 26.9, 3.6);
});
corpoAlto(-39.2, -3, (b) => { // navata, con gli oculi sopra il tetto della navatella
  const f = b.f.pv; fascia(f, 20.3); archetti(f, 19.6); lesene(f, bordi(f, 7), 14, 20.3);
  for (const t of row(f, 7, 0).slice(0, 6)) oculo(f, t, 17.4, 1.25); // il settimo sta dietro al transetto
});
solido(() => pilastrino(at(SF, 6.9), 1.4, 12, 12.4)); // il piede resta dietro al tetto della navatella
navatella(1, -40.8, -4, 7); // navatella ovest
cappella(-1);
solido(() => { // transetto, con le testate a capanna e il rosone
  const b = box(sc, { c: at(2.2, 0), ang: a + 90, L: 34.2, W: 12.8, h: 21, col: TM });
  let testata = null;
  for (const f of b.vis) {
    fascia(f, 1.2); fascia(f, 20.3);
    if (f.len < 14) { // testata ovest
      testata = f; const m = f.len / 2, zr = 15.2, R = 2.6;
      cerchio(f, m, zr, R + 0.75, bianco(f)); cerchio(f, m, zr, R, VETRO, { sw: 0.4 });
      for (let i = 0; i < 4; i++) { const an = (i * Math.PI) / 4 + Math.PI / 8; sc.line([fp(f, m - R * Math.cos(an), zr - R * Math.sin(an)), fp(f, m + R * Math.cos(an), zr + R * Math.sin(an))], { stroke: BIANCO, sw: 0.5, batch: true }); }
      cerchio(f, m, zr, 0.7, BIANCO, { sw: 0.3 });
    } else { archetti(f, 19.6, 0.4, 6); oculo(f, 3.2, 17.4, 1.25); } // lato sud: il resto sta dietro al coro
  }
  gable(sc, b, 4.5, COTTO, { ov: 0.5, timpano: TM });
  if (testata) { // la capanna: copertina di pietra lungo gli spioventi e croce al vertice
    const f = testata; sc.line([fp(f, 0.2, 20.6), fp(f, f.len / 2, 24.8), fp(f, f.len - 0.2, 20.6)], { stroke: BIANCO, sw: 0.9 });
    croce(at(2.2, 17.6), 25.5, 2.4, U);
  }
});
solido(() => { // tiburio ottagonale sopra la crociera
  const c = at(2.2, 0); const pg = ngon(c, 6.3, 8, (Math.atan2(U[1], U[0]) * 180) / Math.PI + 22.5);
  const fs_ = prism(sc, pg, 22.5, 9.5, TM, { shadow: false });
  for (const f of fs_) if (larga(f)) { fascia(f, 26.2); fascia(f, 31.3); finestra(f, f.len / 2, 26.9, 1.2, 3.3); }
  cone(sc, ngon(c, 6.8, 8, (Math.atan2(U[1], U[0]) * 180) / Math.PI + 22.5), 32, [c[0], c[1], 35.2], COTTO);
  croce(c, 35.2, 2);
});
for (const ds of [-6.3, 6.3]) solido(() => pilastrino(at(2.2 + ds, 17.2), 1.5, 0, 22.4)); // contrafforti della testata
cappella(1);
fianco(-1);
campanile(-1); // campanile est
corpoAlto(8.6, 26.7, (b) => { // coro
  const f = b.f.pv; fascia(f, 20.3); archetti(f, 19.6); oculo(f, f.len / 2, 17.4, 1.25);
}, 0.2);
fianco(1);
solido(() => { // abside poligonale
  const c = at(26.7, 0); const pg = ngon(c, 6.25, 5, (Math.atan2(U[1], U[0]) * 180) / Math.PI - 90, 0, 180);
  const fs_ = prism(sc, pg, 0, 18, TM);
  for (const f of fs_) if (f.len > 3 && f.len < 10 && larga(f)) { fascia(f, 1.2); fascia(f, 17.3); archetti(f, 16.6); finestra(f, f.len / 2, 5, 1.3, 8.6); }
  cone(sc, pg, 18, [c[0], c[1], 23.2], COTTO);
});
campanile(1); // campanile ovest

// margine: 6 unita' per lato (il motore ne lascia 2), ombre comprese
for (const h of sc.sh) for (const p of h) sc.reg(Pm(p));
sc.reg([sc.mn[0] - 4, sc.mn[1] - 4]); sc.reg([sc.mx[0] + 4, sc.mx[1] + 4]);
const res = sc.svg();
const OUT = process.argv[2] || path.join(qui, '..', '..', '..', 'public', 'landmarks', 'tempio-ossario.svg');
fs.writeFileSync(OUT, res.svg);
console.log('tempio-ossario', (res.svg.length / 1024).toFixed(1) + ' KB', `${res.w}x${res.h}`,
  'larghezzaMetri', res.larghezzaMetri, 'ancora', res.ancora.join(','),
  'lat', +(lat0 + A[1] / 110574).toFixed(6), 'lon', +(lon0 + A[0] / K).toFixed(6));
