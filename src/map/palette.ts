// Tutti i colori della mappa stanno qui: una cartolina illustrata, carta crema,
// tetti in cotto, intonaci veneziani, Brenta verde-azzurro, contorni seppia.

import type { IdStrato, Luce, TipoArea, TipoStrada } from '../types';

export interface ColoreStrada {
  riempimento: string;
  bordo: string;
}

export interface Palette {
  /** Carta della mappa. */
  carta: string;
  /** Contorni sottili. */
  seppia: string;
  /** Contorno più leggero, per i dettagli. */
  seppiaChiaro: string;
  aree: Record<TipoArea, string>;
  /** Fascia più chiara lungo le rive. */
  acquaChiara: string;
  acquaBordo: string;
  strade: Record<Exclude<TipoStrada, 'ferrovia'>, ColoreStrada>;
  ponteBordo: string;
  ferrovia: string;
  ferroviaTratto: string;
  /** Varianti di cotto per i tetti. */
  tetti: string[];
  /** Tetto dei capannoni. */
  tettoIndustria: string[];
  /** Intonaci: ocra, rosa, crema. */
  intonaci: string[];
  intonacoIndustria: string[];
  pietra: string[];
  mattone: string[];
  /** Tinta unita degli edifici quando la città è vista da molto lontano. */
  edificiLontani: string;
  chiome: string[];
  tronco: string;
  ombra: string;
  strati: Record<IdStrato, { fondo: string; segno: string }>;
  ciclabile: string;
  ferroviaTematica: string;
  evidenza: string;
  etichetta: string;
  etichettaAlone: string;
  /** Colore steso sotto la mappa, fin dove la carta sfuma. */
  sfondo: string;
  /** Di quanto si schiarisce la parete in luce e si scurisce quella in ombra (vedi sfuma). */
  muri: { chiaro: number; scuro: number };
  /** Quanto si allunga l'ombra a terra degli alberi: 1 a mezzogiorno, di più col sole basso. */
  ombraLunga: number;
  lampioni: {
    /** true di notte: lampade e aloni si accendono. */
    accesi: boolean;
    palo: string;
    /** La lampada in cima al palo. */
    lampada: string;
    /** Colore della luce che cade a terra e sulle facciate. */
    alone: string;
  };
  /** Finestre illuminate sulle facciate; stringa vuota quando non se ne disegnano. */
  finestra: string;
  /** Intonaci carichi del centro storico: rosso veneziano, giallo, ocra, rosa. */
  intonaciForti: string[];
  /** Intonaci chiari e moderni, per la periferia. */
  intonaciChiari: string[];
  /** Tetti piani dei condomini moderni. */
  tettoPiano: string[];
  /** Di quanto si schiarisce la falda in luce e si scurisce quella in ombra (vedi sfuma). */
  falde: { luce: number; ombra: number };
  /** L'ombra delle falde come velo, per la vista da lontano dove i tetti si stendono a tessere. */
  faldaVeloOmbra: string;
  /** Righe dei coppi lungo la pendenza. */
  coppi: string;
  /** Vetro delle finestre spente. */
  vetro: string;
  /** Cornice chiara attorno a finestre e porte. */
  cornice: string;
  /** Persiane alla veneta: verdi e marroni. */
  persiane: string[];
  /** Porte e portoni. */
  porte: string[];
  /** Velo scuro per zoccolo, marcapiano e ombra sotto la gronda. */
  facciataOmbra: string;
  /** L'ombra dentro gli archi dei portici (di notte, la loro luce). */
  portico: string;
  /** Telaio delle finestre, da molto vicino. */
  telaio: string;
  /**
   * Il colore verso cui virano le parti in ombra (muri e falde) e di quanto, tra 0 e 1:
   * con il sole basso l'ombra si fa fredda e violacea.
   */
  ombraTinta: { colore: string; quanto: number };
  /** Ombra che le case stendono a terra, come rgba(); stringa vuota per non disegnarla. */
  ombraCase: string;
  /** Come si intonano i disegni dei luoghi simbolo; null per lasciarli come sono. */
  illustrazioni: TintaIllustrazioni | null;
}

export interface TintaIllustrazioni {
  /** Colore per cui il disegno viene moltiplicato (bianco = nessun cambiamento). */
  velo: string;
  /** Luce calda dal basso, come rgba(); stringa vuota per non metterla. */
  luce: string;
  /** Colore dell'acqua della mappa in questa luce: lo prendono le pezze d'acqua dei disegni. */
  acqua: string;
}

export const PALETTE: Palette = {
  carta: '#f6ecd6',
  seppia: '#6b4f3a',
  seppiaChiaro: '#a88e72',
  aree: {
    acqua: '#7fb8ad',
    coltivo: '#ece2bd',
    prato: '#dfe3b4',
    parco: '#c9d9a2',
    bosco: '#a9c48e',
    piazza: '#ecdcc0',
  },
  acquaChiara: '#a5d2c6',
  acquaBordo: '#4f8f86',
  strade: {
    principale: { riempimento: '#fff6e0', bordo: '#bfa27c' },
    secondaria: { riempimento: '#fdf3df', bordo: '#c9b08c' },
    locale: { riempimento: '#faf1de', bordo: '#d3bf9f' },
    pedonale: { riempimento: '#f1e2c2', bordo: '#d8c4a0' },
  },
  ponteBordo: '#8a6c50',
  ferrovia: '#7a6657',
  ferroviaTratto: '#f6ecd6',
  tetti: ['#c8643c', '#bd5a35', '#d17447', '#c46a48', '#b9553a', '#cf7f55', '#c26040'],
  tettoIndustria: ['#b7b0a3', '#a9a79d', '#c2b8a6'],
  intonaci: ['#f1dcae', '#e8c98c', '#eec0a0', '#f3e4c4', '#e7b592', '#f0d49a', '#f5e9d2', '#e4c8a0'],
  intonacoIndustria: ['#e3dccb', '#d9d3c4'],
  pietra: ['#f3e3c0', '#ecd9b4'],
  mattone: ['#cf9c78', '#c48f6c'],
  edificiLontani: '#cf8a66',
  chiome: ['#8fb074', '#7fa56c', '#9dba7a', '#86aa62'],
  tronco: '#7b5b41',
  ombra: 'rgba(84, 62, 42, 0.18)',
  strati: {
    cultura: { fondo: '#a8392b', segno: '#fff6e0' },
    ambiente: { fondo: '#3f7d4e', segno: '#fff6e0' },
    mobilita: { fondo: '#2f5f7e', segno: '#fff6e0' },
  },
  ciclabile: '#3f7d4e',
  ferroviaTematica: '#2f5f7e',
  evidenza: '#f0a92e',
  etichetta: '#3d2c20',
  etichettaAlone: '#fbf4e3',
  sfondo: '#f6ecd6',
  muri: { chiaro: 0.1, scuro: -0.17 },
  ombraLunga: 1,
  lampioni: { accesi: false, palo: '#6b5a4c', lampada: '#f3e7c8', alone: '#ffc67a' },
  finestra: '',
  intonaciForti: ['#d9825f', '#e3b25c', '#d99a5b', '#e09a8a', '#c9694e', '#ebc674'],
  intonaciChiari: ['#f7f0df', '#f3ead0', '#efe9dc', '#f6e7cf', '#e9e6dc', '#f4edc9'],
  tettoPiano: ['#dcd2bd', '#d3c9b6', '#e0d5bb'],
  falde: { luce: 0.13, ombra: -0.13 },
  faldaVeloOmbra: 'rgba(92, 40, 24, 0.2)',
  coppi: 'rgba(110, 48, 28, 0.34)',
  vetro: '#6a5d54',
  cornice: '#fbf3df',
  persiane: ['#55705a', '#7a5a40', '#3f5e4b', '#8a6748', '#6b7f5c', '#6e4a36', '#4f6b6a', '#93714e'],
  porte: ['#6f4a32', '#4d5f47', '#7d3f2f', '#5b4636'],
  facciataOmbra: 'rgba(84, 56, 36, 0.2)',
  portico: '#5a4638',
  telaio: '#e9dfc8',
  ombraTinta: { colore: '#7c6470', quanto: 0.07 },
  ombraCase: 'rgba(96, 70, 48, 0.17)',
  illustrazioni: null,
};

/** Applica `f` a tutti i colori esadecimali di una tavolozza; il resto resta com'è. */
function trasforma<T>(valore: T, f: (esadecimale: string) => string): T {
  if (typeof valore === 'string') return (valore.startsWith('#') ? f(valore) : valore) as T;
  if (Array.isArray(valore)) return valore.map((v) => trasforma(v, f)) as T;
  if (valore !== null && typeof valore === 'object') {
    const u: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valore)) u[k] = trasforma(v, f);
    return u as T;
  }
  return valore;
}

/** Ogni canale diventa v * per + piu: serve a spostare una tinta verso una luce. */
function ritinta(
  per: [number, number, number],
  piu: [number, number, number],
): (esadecimale: string) => string {
  return (esadecimale) => {
    const n = parseInt(esadecimale.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) =>
      Math.max(0, Math.min(255, Math.round(v * per[i] + piu[i]))),
    );
    return '#' + ((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1);
  };
}

// Pomeriggio: la stessa cartolina con il sole basso. Tutto vira verso l'oro, le pareti in
// ombra si fanno più scure e le ombre a terra più lunghe.
const dorato = ritinta([0.99, 0.91, 0.76], [2, 2, 0]);

export const PALETTE_POMERIGGIO: Palette = {
  ...trasforma(PALETTE, dorato),
  aree: {
    ...trasforma(PALETTE.aree, dorato),
    acqua: '#86b09a',
  },
  acquaChiara: '#b9d2b4',
  acquaBordo: '#5f8672',
  ombra: 'rgba(96, 52, 24, 0.3)',
  strati: PALETTE.strati,
  ciclabile: PALETTE.ciclabile,
  ferroviaTematica: PALETTE.ferroviaTematica,
  evidenza: PALETTE.evidenza,
  etichetta: PALETTE.etichetta,
  etichettaAlone: '#fdf3dc',
  muri: { chiaro: 0.16, scuro: -0.3 },
  ombraLunga: 2.1,
  lampioni: { accesi: false, palo: '#66503f', lampada: '#f6e2b4', alone: '#ffc67a' },
  finestra: '',
  falde: { luce: 0.19, ombra: -0.21 },
  faldaVeloOmbra: 'rgba(96, 36, 20, 0.3)',
  coppi: 'rgba(104, 40, 22, 0.38)',
  facciataOmbra: 'rgba(96, 52, 24, 0.26)',
  ombraTinta: { colore: '#5b3f66', quanto: 0.24 },
  ombraCase: 'rgba(98, 50, 40, 0.24)',
  illustrazioni: { velo: '#ffe9c4', luce: '', acqua: '#86b09a' },
};

// Notte: carta blu scuro, case un poco più chiare del terreno perché si distinguano,
// strade leggibili, Brenta scuro. La luce calda la portano lampioni e finestre.
const tettoDiNotte = ritinta([0.31, 0.32, 0.4], [16, 16, 34]);
const muroDiNotte = ritinta([0.33, 0.36, 0.5], [8, 10, 24]);

export const PALETTE_NOTTE: Palette = {
  carta: '#232b45',
  seppia: '#0f1426',
  seppiaChiaro: '#4d5678',
  aree: {
    acqua: '#15223f',
    coltivo: '#27304a',
    prato: '#243446',
    parco: '#213a40',
    bosco: '#1b343a',
    piazza: '#343b5a',
  },
  acquaChiara: '#22375c',
  acquaBordo: '#0d162e',
  strade: {
    principale: { riempimento: '#4a5378', bordo: '#171d34' },
    secondaria: { riempimento: '#434b6e', bordo: '#181e36' },
    locale: { riempimento: '#3b4364', bordo: '#1a2039' },
    pedonale: { riempimento: '#3a405c', bordo: '#1c223a' },
  },
  ponteBordo: '#0f1426',
  ferrovia: '#11162a',
  ferroviaTratto: '#4a5378',
  tetti: PALETTE.tetti.map(tettoDiNotte),
  tettoIndustria: PALETTE.tettoIndustria.map(muroDiNotte),
  intonaci: PALETTE.intonaci.map(muroDiNotte),
  intonacoIndustria: PALETTE.intonacoIndustria.map(muroDiNotte),
  pietra: PALETTE.pietra.map(muroDiNotte),
  mattone: PALETTE.mattone.map(muroDiNotte),
  edificiLontani: '#54435a',
  chiome: ['#2f4b47', '#2a4541', '#34504a', '#2c483f'],
  tronco: '#1c1a22',
  ombra: 'rgba(5, 8, 20, 0.32)',
  strati: PALETTE.strati,
  ciclabile: '#74c389',
  ferroviaTematica: '#7db4dc',
  evidenza: PALETTE.evidenza,
  etichetta: '#fbf4e3',
  etichettaAlone: '#141a30',
  sfondo: '#1b2238',
  muri: { chiaro: 0.08, scuro: -0.22 },
  ombraLunga: 1,
  lampioni: { accesi: true, palo: '#0f1426', lampada: '#fff1c9', alone: '#ffc67a' },
  finestra: '#ffd58a',
  intonaciForti: PALETTE.intonaciForti.map(muroDiNotte),
  intonaciChiari: PALETTE.intonaciChiari.map(muroDiNotte),
  tettoPiano: PALETTE.tettoPiano.map(muroDiNotte),
  falde: { luce: 0.1, ombra: -0.2 },
  faldaVeloOmbra: 'rgba(6, 9, 24, 0.26)',
  coppi: 'rgba(8, 10, 26, 0.36)',
  vetro: '#151b33',
  cornice: '#5d6689',
  persiane: PALETTE.persiane.map(muroDiNotte),
  porte: PALETTE.porte.map(muroDiNotte),
  facciataOmbra: 'rgba(6, 9, 22, 0.3)',
  portico: '#8f6a3c',
  telaio: '#3a4263',
  ombraTinta: { colore: '#0e1430', quanto: 0.08 },
  ombraCase: '',
  illustrazioni: { velo: '#5d6698', luce: 'rgba(255, 190, 112, 0.3)', acqua: '#15223f' },
};

export const PALETTE_PER_LUCE: Record<Luce, Palette> = {
  giorno: PALETTE,
  pomeriggio: PALETTE_POMERIGGIO,
  notte: PALETTE_NOTTE,
};

/** Luminanza percepita di un colore esadecimale, tra 0 (nero) e 1 (bianco). */
export function luminanza(esadecimale: string): number {
  const n = parseInt(esadecimale.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

/** Schiarisce (f > 0) o scurisce (f < 0) un colore esadecimale; f tra -1 e 1. */
export function sfuma(esadecimale: string, f: number): string {
  const n = parseInt(esadecimale.slice(1), 16);
  const canale = (v: number): number => {
    const r = f >= 0 ? v + (255 - v) * f : v * (1 + f);
    return Math.max(0, Math.min(255, Math.round(r)));
  };
  const r = canale((n >> 16) & 255);
  const g = canale((n >> 8) & 255);
  const b = canale(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

/** Il colore a `t` della strada tra `a` e `b` (esadecimali): 0 dà `a`, 1 dà `b`. */
export function mescolaColori(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const canale = (sposta: number): number => {
    const u = (x >> sposta) & 255;
    const w = (y >> sposta) & 255;
    return Math.max(0, Math.min(255, Math.round(u + (w - u) * t)));
  };
  return '#' + ((1 << 24) | (canale(16) << 16) | (canale(8) << 8) | canale(0)).toString(16).slice(1);
}

/** Un colore esadecimale con trasparenza, come rgba(). */
export function conAlfa(esadecimale: string, alfa: number): string {
  const n = parseInt(esadecimale.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}
