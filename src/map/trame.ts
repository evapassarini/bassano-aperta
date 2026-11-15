// Trame dipinte: piccole tele preparate una volta sola e poi riusate come motivo di
// riempimento. Danno al disegno la mano dell'acquerello: macchie e grana su tutto il foglio,
// lastre del selciato, increspature dell'acqua.
// Tutto viene da un seme fisso: stesse macchie a ogni avvio. Dove non c'è un documento
// (nelle prove) le funzioni che creano tele restituiscono null e la mappa resta a tinte piatte.

import { ISO_X, ISO_Y } from './proiezione';

/** Lato in pixel della tessera della mano d'acquerello, e quanti metri copre sulla mappa. */
export const LATO_TRAMA = 256;
export const METRI_TRAMA = 21;
/** Lato in metri di una lastra del selciato. */
export const LATO_LASTRA = 1.7;
/** Quante lastre per lato contiene la tessera del selciato. */
const LASTRE = 7;

/** Numeri tra 0 e 1 sempre uguali, dato il seme. */
export function sequenza(seme: number): () => number {
  let s = seme >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rumore morbido che si ripete ai bordi (così la tessera si affianca senza giunti), somma di
 * più ottave. Ogni ottava: quante celle in larghezza, quante in altezza, quanto pesa. Con
 * poche celle in altezza e molte in larghezza vengono righe verticali: le colature.
 * Il risultato ha media zero e sta tra -1 e 1.
 */
export function rumore(lato: number, seme: number, ottave: readonly (readonly [number, number, number])[]): Float32Array {
  const campo = new Float32Array(lato * lato);
  const caso = sequenza(seme);
  for (const [cx, cy, peso] of ottave) {
    const nodi = new Float32Array(cx * cy);
    for (let i = 0; i < nodi.length; i++) nodi[i] = caso() * 2 - 1;
    for (let y = 0; y < lato; y++) {
      const fy = (y * cy) / lato;
      const iy = Math.floor(fy);
      const ty = fy - iy;
      const b = ty * ty * (3 - 2 * ty);
      const r0 = (iy % cy) * cx;
      const r1 = ((iy + 1) % cy) * cx;
      for (let x = 0; x < lato; x++) {
        const fx = (x * cx) / lato;
        const ix = Math.floor(fx);
        const tx = fx - ix;
        const a = tx * tx * (3 - 2 * tx);
        const c0 = ix % cx;
        const c1 = (ix + 1) % cx;
        const alto = nodi[r0 + c0] * (1 - a) + nodi[r0 + c1] * a;
        const basso = nodi[r1 + c0] * (1 - a) + nodi[r1 + c1] * a;
        campo[y * lato + x] += (alto * (1 - b) + basso * b) * peso;
      }
    }
  }
  let somma = 0;
  for (let i = 0; i < campo.length; i++) somma += campo[i];
  const media = somma / campo.length;
  let massimo = 1e-6;
  for (let i = 0; i < campo.length; i++) {
    campo[i] -= media;
    const v = Math.abs(campo[i]);
    if (v > massimo) massimo = v;
  }
  for (let i = 0; i < campo.length; i++) campo[i] /= massimo;
  return campo;
}

/**
 * I campi di rumore della mano d'acquerello: si calcolano una volta e valgono per ogni luce.
 * Il primo è il più fine (LATO_TRAMA pixel di lato); ogni successivo ha metà dei pixel ed è la
 * media a quattro a quattro del precedente. Da lontano si usa un campo ridotto: la grana fine
 * lì sarebbe più piccola di un pixel dello schermo e friggerebbe muovendo la mappa.
 */
export interface Campi {
  macchie: Float32Array[];
}

/** Dimezza un campo quadrato facendo la media a quattro a quattro: resta ripetibile ai bordi. */
export function dimezza(campo: Float32Array): Float32Array {
  const lato = Math.round(Math.sqrt(campo.length));
  const meta = lato >> 1;
  const u = new Float32Array(meta * meta);
  for (let y = 0; y < meta; y++) {
    for (let x = 0; x < meta; x++) {
      const i = y * 2 * lato + x * 2;
      u[y * meta + x] = (campo[i] + campo[i + 1] + campo[i + lato] + campo[i + lato + 1]) / 4;
    }
  }
  return u;
}

/** Quanti campi, dal più fine al più ridotto. */
export const LIVELLI_TRAMA = 4;

let campiPronti: Campi | null = null;

export function campi(): Campi {
  if (!campiPronti) {
    // Macchie larghe appena accennate, macchie medie, e la grana fine della carta.
    const macchie = [
      rumore(LATO_TRAMA, 1877, [
        [3, 3, 0.2],
        [7, 7, 0.34],
        [16, 16, 0.42],
        [43, 43, 0.36],
        [110, 110, 0.3],
      ]),
    ];
    while (macchie.length < LIVELLI_TRAMA) macchie.push(dimezza(macchie[macchie.length - 1]));
    campiPronti = { macchie };
  }
  return campiPronti;
}

/**
 * Quale campo usare a un certo ingrandimento (pixel dello schermo per metro): il più fine i
 * cui pixel non scendano sotto i tre quarti di un pixel dello schermo.
 */
export function livelloTrama(pixelPerMetro: number): number {
  const unPixel = (METRI_TRAMA / LATO_TRAMA) * pixelPerMetro;
  if (!(unPixel > 0)) return LIVELLI_TRAMA - 1;
  const l = Math.ceil(Math.log2(0.75 / unPixel));
  return Math.max(0, Math.min(LIVELLI_TRAMA - 1, l));
}

function nuovaTela(larghezza: number, altezza: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  try {
    const tela = document.createElement('canvas');
    tela.width = larghezza;
    tela.height = altezza;
    return tela.getContext('2d') ? tela : null;
  } catch {
    return null;
  }
}

let ctxComune: CanvasRenderingContext2D | null | undefined;

/**
 * Fa di una tela un motivo che si ripete. `scala`: quante unità della mappa vale un pixel
 * della tela (1 se la tela è già in pixel dello schermo).
 */
export function motivo(tela: HTMLCanvasElement | null, scala: number): CanvasPattern | null {
  if (!tela) return null;
  if (ctxComune === undefined) ctxComune = nuovaTela(1, 1)?.getContext('2d') ?? null;
  if (!ctxComune) return null;
  try {
    const m = ctxComune.createPattern(tela, 'repeat');
    if (m && scala !== 1 && typeof DOMMatrix !== 'undefined') m.setTransform(new DOMMatrix([scala, 0, 0, scala, 0, 0]));
    return m;
  } catch {
    return null;
  }
}

/**
 * Le lastre del selciato viste in isometria: solo le fughe e qualche lastra appena più scura o
 * più chiara, su fondo trasparente. Si stende sopra la tinta della piazza o della strada.
 * Restituisce la tela e quante unità della mappa vale un suo pixel.
 */
export function creaSelciato(fuga: string, seme = 97): { tela: HTMLCanvasElement; scala: number } | null {
  // La tessera contiene LASTRE x LASTRE rombi: larga 2 * ISO_X * lato * LASTRE, alta la metà.
  const largaMetri = 2 * ISO_X * LATO_LASTRA * LASTRE;
  const larga = 56 * LASTRE;
  const alta = Math.round((larga * ISO_Y) / ISO_X);
  const tela = nuovaTela(larga, alta);
  const ctx = tela?.getContext('2d');
  if (!tela || !ctx) return null;
  const px = larga / largaMetri;
  const ex = ISO_X * LATO_LASTRA * px;
  const ey = ISO_Y * LATO_LASTRA * px;
  // Rombo (i, j): l'angolo a nord sta in (i - j) * ex, (i + j) * ey.
  for (let i = -LASTRE; i < 2 * LASTRE; i++) {
    for (let j = -LASTRE; j < 2 * LASTRE; j++) {
      // Lo stesso numero per le lastre che coincidono affiancando la tessera.
      const a = ((i % LASTRE) + LASTRE) % LASTRE;
      const b = ((j % LASTRE) + LASTRE) % LASTRE;
      const tono = sequenza(seme + a * 31 + b * 57)();
      const x = (i - j) * ex + larga / 2;
      const y = (i + j) * ey;
      if (x < -2 * ex || x > larga + 2 * ex || y < -2 * ey || y > alta + 2 * ey) continue;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + ex, y + ey);
      ctx.lineTo(x, y + 2 * ey);
      ctx.lineTo(x - ex, y + ey);
      ctx.closePath();
      // Una lastra su quattro è appena più scura, una su sei più chiara: le altre restano lisce.
      if (tono < 0.26) {
        ctx.fillStyle = fuga;
        ctx.globalAlpha = 0.06 + tono * 0.5;
        ctx.fill();
      } else if (tono > 0.84) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = (tono - 0.84) * 1.4;
        ctx.fill();
      }
    }
  }
  // Le fughe: tratti a mano, ognuno un poco più o meno carico.
  ctx.strokeStyle = fuga;
  ctx.lineCap = 'round';
  for (let i = -LASTRE; i <= 2 * LASTRE; i++) {
    for (let j = -LASTRE; j <= 2 * LASTRE; j++) {
      const x = (i - j) * ex + larga / 2;
      const y = (i + j) * ey;
      if (x < -2 * ex || x > larga + 2 * ex || y < -2 * ey || y > alta + 2 * ey) continue;
      const a = ((i % LASTRE) + LASTRE) % LASTRE;
      const b = ((j % LASTRE) + LASTRE) % LASTRE;
      const k = sequenza(seme * 3 + a * 13 + b * 7);
      // Non una griglia tirata con la riga: un giunto su quattro manca (due lastre fanno un
      // lastrone), gli altri sono più o meno carichi e qualcuno si ferma prima dell'angolo.
      for (const verso of [1, -1]) {
        const peso = k();
        const lungo = k();
        const largo = k();
        if (peso < 0.26) continue;
        ctx.lineWidth = 0.8 + largo * 0.5;
        ctx.globalAlpha = 0.25 + peso * 0.5;
        const fin = lungo < 0.3 ? 0.55 + lungo : 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + verso * ex * fin, y + ey * fin);
        ctx.stroke();
      }
    }
  }
  return { tela, scala: largaMetri / larga };
}

/**
 * Increspature dell'acqua: piccoli tratti chiari e scuri lungo la corrente, su fondo
 * trasparente. La tela copre 36 x 18 unità della mappa.
 */
export function creaIncrespature(chiaro: string, scuro: string, seme = 311): { tela: HTMLCanvasElement; scala: number } | null {
  const larga = 192;
  const alta = 96;
  const tela = nuovaTela(larga, alta);
  const ctx = tela?.getContext('2d');
  if (!tela || !ctx) return null;
  const caso = sequenza(seme);
  ctx.lineCap = 'round';
  for (let k = 0; k < 26; k++) {
    const x = caso() * larga;
    const y = caso() * alta;
    const lunga = 7 + caso() * 16;
    const chiara = caso() < 0.62;
    ctx.strokeStyle = chiara ? chiaro : scuro;
    ctx.globalAlpha = chiara ? 0.5 + caso() * 0.4 : 0.22 + caso() * 0.2;
    ctx.lineWidth = 1 + caso() * 0.9;
    // Il tratto segue la corrente (da nord a sud: sullo schermo scende verso destra) con una
    // piccola pancia; si ridisegna spostato di una tessera perché ai bordi continui.
    for (const ox of [-larga, 0, larga]) {
      for (const oy of [-alta, 0, alta]) {
        ctx.beginPath();
        ctx.moveTo(x + ox - lunga / 2, y + oy - lunga / 4);
        ctx.quadraticCurveTo(x + ox - 1.2, y + oy + 1.6, x + ox + lunga / 2, y + oy + lunga / 4);
        ctx.stroke();
      }
    }
  }
  return { tela, scala: 36 / larga };
}

/**
 * La mano d'acquerello: una tela trasparente mossa dal campo di rumore, da stendere sul disegno
 * finito con la fusione normale (un riempimento solo, veloce anche senza scheda grafica). Dove
 * il campo scende c'è un velo del colore `scuro` (il pigmento che si carica), dove sale un velo
 * del colore `chiaro` (il pigmento slavato); in mezzo niente. `forza` tra 0 e 1: quanto copre
 * al massimo.
 */
export function creaMacchie(campo: Float32Array, forza: number, scuro = '#7a4a26', chiaro = '#fff3d6'): HTMLCanvasElement | null {
  const lato = Math.round(Math.sqrt(campo.length));
  const tela = nuovaTela(lato, lato);
  const ctx = tela?.getContext('2d');
  if (!tela || !ctx) return null;
  const s = parseInt(scuro.slice(1), 16);
  const c = parseInt(chiaro.slice(1), 16);
  const immagine = ctx.createImageData(lato, lato);
  const d = immagine.data;
  for (let i = 0; i < campo.length; i++) {
    const v = campo[i];
    const n = v < 0 ? s : c;
    d[i * 4] = (n >> 16) & 255;
    d[i * 4 + 1] = (n >> 8) & 255;
    d[i * 4 + 2] = n & 255;
    // Le macchie chiare coprono un poco meno delle scure: la carta resta carta.
    d[i * 4 + 3] = Math.min(255, Math.abs(v) * forza * (v < 0 ? 255 : 200));
  }
  ctx.putImageData(immagine, 0, 0);
  return tela;
}
