// Disposizione dei lampioni illustrativi lungo le strade.
// Logica pura, senza rete e senza file: la usa scripts/dati-lampioni.mjs e la
// provano i test in tests/dati-lampioni.test.ts.
//
// Niente Math.random: a parità di strade, lampioni veri e opzioni il risultato
// è sempre lo stesso, punto per punto e nello stesso ordine.

import { arrotonda, daPiatto, distanzaDaSegmento, limiti, puntoInPoligono } from './geo.mjs';

/** Tipi di strada che ricevono lampioni, nell'ordine in cui vengono serviti. */
export const ORDINE_TIPI = ['principale', 'secondaria', 'locale', 'pedonale'];

/** Valori predefiniti: lo script li usa così come sono. */
export const PREDEFINITE = {
  /** Metri tra un lampione e il successivo lungo la stessa strada. */
  passo: { principale: 35, secondaria: 35, locale: 45, pedonale: 45 },
  /** Metri di lato rispetto all'asse della strada. */
  scarto: { principale: 4, secondaria: 3.5, locale: 3, pedonale: 2 },
  /** Dove il lato si alterna a ogni lampione; altrove resta sempre a sinistra. */
  alterna: { principale: true, secondaria: true, locale: false, pedonale: false },
  /** Nessun lampione nuovo a meno di questi metri da uno già presente. */
  distanzaMinima: 24,
  /** Le strade più corte di così non ricevono lampioni propri. */
  lunghezzaMinima: 8,
  /** Piazze: metri tra un lampione e il successivo lungo il bordo. */
  passoPiazza: 30,
  /** Piazze: di quanti metri il lampione rientra dal bordo. */
  rientroPiazza: 2.5,
  /** Le piazze con un bordo più corto di così non ricevono lampioni propri. */
  bordoMinimoPiazza: 60,
};

// ---------------------------------------------------------------------------
// Griglia spaziale di punti: "c'è già un lampione qui vicino?"
// ---------------------------------------------------------------------------

/**
 * Griglia a celle quadrate. Con la cella grande quanto il raggio di ricerca
 * basta guardare la cella del punto e le otto intorno.
 */
export function creaGriglia(cella) {
  if (!(cella > 0)) throw new Error('creaGriglia: la cella deve essere maggiore di zero');
  const celle = new Map();
  const indice = (v) => Math.floor(v / cella);
  const chiave = (i, j) => `${i}:${j}`;
  let quanti = 0;
  return {
    get quanti() {
      return quanti;
    },
    aggiungi(x, y) {
      const k = chiave(indice(x), indice(y));
      const elenco = celle.get(k);
      if (elenco) elenco.push(x, y);
      else celle.set(k, [x, y]);
      quanti++;
    },
    /** true se esiste un punto a meno di `raggio` metri (distanza stretta). */
    haVicino(x, y, raggio) {
      const giro = Math.ceil(raggio / cella);
      const i0 = indice(x);
      const j0 = indice(y);
      const r2 = raggio * raggio;
      for (let i = i0 - giro; i <= i0 + giro; i++) {
        for (let j = j0 - giro; j <= j0 + giro; j++) {
          const elenco = celle.get(chiave(i, j));
          if (!elenco) continue;
          for (let n = 0; n < elenco.length; n += 2) {
            const dx = elenco[n] - x;
            const dy = elenco[n + 1] - y;
            if (dx * dx + dy * dy < r2) return true;
          }
        }
      }
      return false;
    },
  };
}

// ---------------------------------------------------------------------------
// Indice di poligoni: "questo punto cade nell'acqua, su un edificio?"
// ---------------------------------------------------------------------------

/**
 * Indice di anelli (array piatti [x0, y0, ...]) su una griglia.
 * Restituisce una funzione (x, y) → true se il punto cade dentro un anello.
 */
export function creaIndicePoligoni(anelliPiatti, cella = 64) {
  const celle = new Map();
  const anelli = [];
  for (const piatto of anelliPiatti) {
    if (!piatto || piatto.length < 6) continue;
    const anello = daPiatto(piatto);
    const l = limiti(anello);
    const n = anelli.push({ anello, l }) - 1;
    for (let i = Math.floor(l.minX / cella); i <= Math.floor(l.maxX / cella); i++) {
      for (let j = Math.floor(l.minY / cella); j <= Math.floor(l.maxY / cella); j++) {
        const k = `${i}:${j}`;
        const elenco = celle.get(k);
        if (elenco) elenco.push(n);
        else celle.set(k, [n]);
      }
    }
  }
  return (x, y) => {
    const elenco = celle.get(`${Math.floor(x / cella)}:${Math.floor(y / cella)}`);
    if (!elenco) return false;
    for (const n of elenco) {
      const { anello, l } = anelli[n];
      if (x < l.minX || x > l.maxX || y < l.minY || y > l.maxY) continue;
      if (puntoInPoligono([x, y], anello)) return true;
    }
    return false;
  };
}

// ---------------------------------------------------------------------------
// Lampioni veri
// ---------------------------------------------------------------------------

/**
 * Punti veri [[x, y], ...] → elenco arrotondato a 0.1 m, dentro il riquadro,
 * senza punti ripetuti, in ordine stabile (x, poi y).
 */
export function preparaVeri(punti, riquadro = null) {
  const visti = new Set();
  const veri = [];
  for (const [px, py] of punti) {
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    const x = arrotonda(px);
    const y = arrotonda(py);
    if (riquadro && (x < riquadro.minX || x > riquadro.maxX || y < riquadro.minY || y > riquadro.maxY)) continue;
    const k = `${x}:${y}`;
    if (visti.has(k)) continue;
    visti.add(k);
    veri.push([x, y]);
  }
  veri.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return veri;
}

// ---------------------------------------------------------------------------
// Lampioni illustrativi
// ---------------------------------------------------------------------------

/** Lunghezze progressive di una linea piatta: [0, l1, l1+l2, ...]. */
function progressive(p) {
  const somme = [0];
  for (let i = 2; i < p.length; i += 2) {
    somme.push(somme[somme.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]));
  }
  return somme;
}

/** Punto a `s` metri dall'inizio della linea, con la direzione del tratto. */
function puntoLungo(p, somme, s) {
  let i = 1;
  while (i < somme.length - 1 && somme[i] < s) i++;
  const l = somme[i] - somme[i - 1];
  const ax = p[(i - 1) * 2];
  const ay = p[(i - 1) * 2 + 1];
  const bx = p[i * 2];
  const by = p[i * 2 + 1];
  const t = l === 0 ? 0 : (s - somme[i - 1]) / l;
  return { x: ax + t * (bx - ax), y: ay + t * (by - ay), dx: l === 0 ? 1 : (bx - ax) / l, dy: l === 0 ? 0 : (by - ay) / l };
}

/**
 * Dispone i lampioni illustrativi lungo le strade.
 *
 * strade: [{ p: [x0, y0, ...], t, ponte? }] come in base.json.
 * opzioni:
 *   veri            punti già presenti [[x, y], ...]: attorno a loro non se ne mettono
 *   inAcqua(x, y)   true se il punto è in acqua: vietato, tranne sui ponti
 *   suEdificio(x,y) true se il punto cade su un edificio: vietato
 *   alBuio(x, y)    true dove strade locali e pedonali restano senza luce (campi, boschi)
 *   riquadro        { minX, minY, maxX, maxY }: fuori non si mette niente
 *   piazze          anelli piatti [[x0, y0, ...], ...] delle piazze: ricevono lampioni lungo
 *                   il bordo, un poco rientrati, dopo le strade principali e secondarie
 *   passo, scarto, alterna, distanzaMinima, lunghezzaMinima,
 *   passoPiazza, rientroPiazza, bordoMinimoPiazza: vedi PREDEFINITE
 *
 * Restituisce { punti: [[x, y], ...], perTipo, scartati }: perTipo conta anche `piazza`; punti arrotondati a
 * 0.1 m, nell'ordine in cui sono stati messi. Due punti restituiti, o un punto
 * restituito e uno vero, non stanno mai a meno di distanzaMinima.
 */
export function disponiLampioni(strade, opzioni = {}) {
  const passo = { ...PREDEFINITE.passo, ...opzioni.passo };
  const scarto = { ...PREDEFINITE.scarto, ...opzioni.scarto };
  const alterna = { ...PREDEFINITE.alterna, ...opzioni.alterna };
  const distanzaMinima = opzioni.distanzaMinima ?? PREDEFINITE.distanzaMinima;
  const lunghezzaMinima = opzioni.lunghezzaMinima ?? PREDEFINITE.lunghezzaMinima;
  const inAcqua = opzioni.inAcqua || (() => false);
  const suEdificio = opzioni.suEdificio || (() => false);
  const alBuio = opzioni.alBuio || (() => false);
  const R = opzioni.riquadro || null;

  const griglia = creaGriglia(Math.max(1, distanzaMinima));
  for (const [x, y] of opzioni.veri || []) griglia.aggiungi(arrotonda(x), arrotonda(y));

  const punti = [];
  const perTipo = {};
  const scartati = { vicini: 0, acqua: 0, edifici: 0, buio: 0, fuori: 0, corte: 0 };

  // Prima le strade importanti: tengono il loro ritmo regolare, le altre si adattano.
  // A parità di tipo vale l'ordine di arrivo, che in base.json è stabile.
  perTipo.piazza = 0;
  const passoPiazza = opzioni.passoPiazza ?? PREDEFINITE.passoPiazza;
  const rientro = opzioni.rientroPiazza ?? PREDEFINITE.rientroPiazza;
  const bordoMinimo = opzioni.bordoMinimoPiazza ?? PREDEFINITE.bordoMinimoPiazza;
  /** Lampioni lungo il bordo delle piazze: senza, di notte restano i punti più bui del centro. */
  const servePiazze = () => {
    for (const grezzo of opzioni.piazze || []) {
      if (!grezzo || grezzo.length < 6) continue;
      // Anello chiuso: se l'ultimo punto non ripete il primo lo si aggiunge.
      const n = grezzo.length;
      const chiuso = grezzo[0] === grezzo[n - 2] && grezzo[1] === grezzo[n - 1];
      const p = chiuso ? grezzo : [...grezzo, grezzo[0], grezzo[1]];
      const anello = daPiatto(p);
      const somme = progressive(p);
      const lunga = somme[somme.length - 1];
      if (!(lunga >= bordoMinimo)) {
        scartati.corte++;
        continue;
      }
      const quanti = Math.max(1, Math.round(lunga / passoPiazza));
      const tratto = lunga / quanti;
      for (let k = 0; k < quanti; k++) {
        // Il verso dell'anello non è noto: si prova un lato, poi l'altro, e vale quello dentro.
        // Vicino a un angolo il punto rientrato può toccare il lato accanto: allora ci si
        // sposta di qualche metro lungo il bordo.
        let posto = null;
        for (const avanti of [0, -4, 4]) {
          const q = puntoLungo(p, somme, Math.min(lunga, Math.max(0, (k + 0.5) * tratto + avanti)));
          for (const s of [rientro, -rientro]) {
            const x = arrotonda(q.x - q.dy * s);
            const y = arrotonda(q.y + q.dx * s);
            if (!puntoInPoligono([x, y], anello)) continue;
            let bordo = Infinity;
            for (let i = 1; i < anello.length; i++) {
              bordo = Math.min(bordo, distanzaDaSegmento([x, y], anello[i - 1], anello[i]));
            }
            if (bordo >= rientro - 0.3) posto = [x, y];
            break;
          }
          if (posto) break;
        }
        if (!posto) continue;
        const [x, y] = posto;
        let motivo = null;
        let messo = false;
        if (R && (x < R.minX || x > R.maxX || y < R.minY || y > R.maxY)) motivo = 'fuori';
        else if (inAcqua(x, y)) motivo = 'acqua';
        else if (suEdificio(x, y)) motivo = 'edifici';
        else if (griglia.haVicino(x, y, distanzaMinima)) motivo = 'vicini';
        else {
          griglia.aggiungi(x, y);
          punti.push([x, y]);
          perTipo.piazza++;
          messo = true;
        }
        if (!messo && motivo) scartati[motivo]++;
      }
    }
  };

  for (const tipo of ORDINE_TIPI) {
    perTipo[tipo] = 0;
    // Le piazze vengono dopo le strade importanti e prima di vie e vicoli.
    if (tipo === 'locale') servePiazze();
    for (const strada of strade) {
      if (strada.t !== tipo) continue;
      const p = strada.p;
      if (!p || p.length < 4) continue;
      const somme = progressive(p);
      const lunga = somme[somme.length - 1];
      if (!(lunga >= lunghezzaMinima)) {
        scartati.corte++;
        continue;
      }
      // Posti centrati sulla strada, lontani dagli estremi: così agli incroci,
      // dove più strade si toccano, non si ammucchiano lampioni.
      const quanti = Math.max(1, Math.round(lunga / passo[tipo]));
      const tratto = lunga / quanti;
      const leggera = tipo === 'locale' || tipo === 'pedonale';

      for (let k = 0; k < quanti; k++) {
        const q = puntoLungo(p, somme, (k + 0.5) * tratto);
        const lato = alterna[tipo] && k % 2 === 1 ? -1 : 1;
        // Si prova il lato previsto, poi l'altro, poi l'asse della strada.
        const prove = [lato * scarto[tipo], -lato * scarto[tipo], 0];
        let motivo = null;
        let messo = false;
        for (const s of prove) {
          // Sinistra rispetto al verso della strada: (-dy, dx).
          const x = arrotonda(q.x - q.dy * s);
          const y = arrotonda(q.y + q.dx * s);
          if (R && (x < R.minX || x > R.maxX || y < R.minY || y > R.maxY)) {
            motivo ??= 'fuori';
            continue;
          }
          if (!strada.ponte && inAcqua(x, y)) {
            motivo ??= 'acqua';
            continue;
          }
          if (suEdificio(x, y)) {
            motivo ??= 'edifici';
            continue;
          }
          if (leggera && !strada.ponte && alBuio(x, y)) {
            motivo ??= 'buio';
            continue;
          }
          if (griglia.haVicino(x, y, distanzaMinima)) {
            motivo ??= 'vicini';
            continue;
          }
          griglia.aggiungi(x, y);
          punti.push([x, y]);
          perTipo[tipo]++;
          messo = true;
          break;
        }
        if (!messo && motivo) scartati[motivo]++;
      }
    }
  }
  return { punti, perTipo, scartati };
}

/** [[x, y], ...] → [x0, y0, x1, y1, ...]. I punti sono già arrotondati. */
export function piatto(punti) {
  const p = [];
  for (const [x, y] of punti) p.push(x, y);
  return p;
}

/** Distanza più piccola tra due punti qualsiasi di un elenco (Infinity se meno di due). */
export function distanzaPiuPiccola(punti, altri = null) {
  // Usata dai controlli e dai test: con la griglia resta veloce anche su migliaia di punti.
  let minima = Infinity;
  const cella = 50;
  const celle = new Map();
  const metti = (x, y) => {
    const k = `${Math.floor(x / cella)}:${Math.floor(y / cella)}`;
    const e = celle.get(k);
    if (e) e.push(x, y);
    else celle.set(k, [x, y]);
  };
  const guarda = (x, y) => {
    const i0 = Math.floor(x / cella);
    const j0 = Math.floor(y / cella);
    for (let i = i0 - 1; i <= i0 + 1; i++) {
      for (let j = j0 - 1; j <= j0 + 1; j++) {
        const e = celle.get(`${i}:${j}`);
        if (!e) continue;
        for (let n = 0; n < e.length; n += 2) {
          const d = Math.hypot(e[n] - x, e[n + 1] - y);
          if (d < minima) minima = d;
        }
      }
    }
  };
  if (altri) {
    for (const [x, y] of altri) metti(x, y);
    for (const [x, y] of punti) guarda(x, y);
  } else {
    for (const [x, y] of punti) {
      guarda(x, y);
      metti(x, y);
    }
  }
  return minima;
}

/**
 * I lampioni veri di un lampioni.json già scritto: i primi `veri` punti di `p`, come
 * [[x, y], ...]. Serve quando Overpass non risponde, per non perdere quelli rilevati.
 * Restituisce [] se il file non c'è, non è leggibile o non ne ha.
 */
export function veriDelFile(dati) {
  if (!dati || typeof dati !== 'object' || !Array.isArray(dati.p)) return [];
  if (!Number.isInteger(dati.veri) || dati.veri <= 0 || dati.veri * 2 > dati.p.length) return [];
  const veri = [];
  for (let i = 0; i < dati.veri * 2; i += 2) {
    const x = dati.p[i];
    const y = dati.p[i + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    veri.push([x, y]);
  }
  return veri;
}
