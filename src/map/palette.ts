// Tutti i colori della mappa stanno qui: una cartolina illustrata, carta crema,
// tetti in cotto, intonaci veneziani, Brenta verde-azzurra, contorni seppia.

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
  /** Il cartello degli avvisi sulla viabilità (strato Mobilità). */
  avviso: { fondo: string; segno: string };
  /** Il treno decorativo: fianchi in luce e in ombra, tetto, finestrini. */
  /** I treni decorativi, una livrea per treno: fianchi in luce e in ombra, tetto, finestrini. */
  treni: { luce: string; ombra: string; tetto: string; finestrini: string }[];
  /** Le macchine decorative: tinte della carrozzeria, vetri, tetto più chiaro. */
  macchine: { tinte: string[]; vetri: string };
  /** Le figurine decorative: pelle, capelli e otto colori di vestiti. */
  gente: { pelle: string; capelli: string; gambe: string; vesti: string[] };
  ciclabile: string;
  ferroviaTematica: string;
  evidenza: string;
  etichetta: string;
  etichettaAlone: string;
  /** Colore steso sotto la mappa, fin dove la carta sfuma. */
  sfondo: string;
  /** Nuvole oltre il bordo dei dati: colore e quanto coprono (0..1). */
  nuvole: { colore: string; ombra: string; alfa: number };
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
  /** China dei contorni di case e tetti: più scura e più viva della seppia dei dettagli. */
  china: string;
  /** Quanto pesa, tra 0 e 1, la mano d'acquerello stesa su tutto il foglio (vedi trame.ts). */
  macchie: number;
  /** I due veli della mano d'acquerello: il pigmento che si carica e quello che si slava. */
  macchieTinta: { scuro: string; chiaro: string };
  /**
   * Quanto, tra 0 e 1, la parte in ombra di muri e falde gira al caldo invece di ingrigire:
   * 1 di giorno (il giallo in ombra è ocra bruciata, non oliva), 0 di notte.
   */
  ombraCalda: number;
  /** Quanto si vede, tra 0 e 1, la fascia chiara di corrente in mezzo al fiume. */
  corrente: number;
  /** Quanto pesano, tra 0 e 1, le lastre del selciato e le increspature dell'acqua. */
  /** Quanto coprono le trame; `corrente` sono i filoni grandi che fanno vedere l'acqua scorrere. */
  trame: { selciato: number; acqua: number; corrente: number };
  /** Fughe tra le lastre del selciato di piazze e strade del centro. */
  selciato: string;
  /** Terra battuta e selciato del centro storico: la tinta e quanto copre la carta. */
  centro: { colore: string; alfa: number };
  /** Bordo di pietra lungo le rive: gli argini. */
  argine: string;
  /** Le fontane disegnate: pietra in luce e in ombra, acqua, zampilli. */
  fontana: { pietra: string; ombra: string; acqua: string; zampilli: string };
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
  carta: '#f2e5c6',
  seppia: '#6b4f3a',
  seppiaChiaro: '#a88e72',
  aree: {
    acqua: '#86b4a4',
    coltivo: '#ebe0b8',
    prato: '#dfe3b4',
    parco: '#c9d9a2',
    bosco: '#a9c48e',
    piazza: '#ecd9b0',
  },
  acquaChiara: '#a8cdbc',
  acquaBordo: '#4f8a7e',
  strade: {
    principale: { riempimento: '#fff6e0', bordo: '#b3946a' },
    secondaria: { riempimento: '#fdf3dc', bordo: '#bb9e76' },
    locale: { riempimento: '#fbf0d8', bordo: '#c4aa82' },
    pedonale: { riempimento: '#f8ebcc', bordo: '#ccb48a' },
  },
  ponteBordo: '#8a6c50',
  ferrovia: '#7a6657',
  ferroviaTratto: '#f2e5c6',
  tetti: ['#c6642e', '#b45326', '#d0733a', '#bf6530', '#a94e26', '#d27f42', '#b95a2a', '#cb6c34', '#b05c34', '#d8843e'],
  tettoIndustria: ['#b7b0a3', '#a9a79d', '#c2b8a6'],
  intonaci: ['#f0d9a4', '#e7c47e', '#edc890', '#f2e2bc', '#e4b877', '#efce86', '#f3e6c6', '#e3c590'],
  intonacoIndustria: ['#e3dccb', '#d9d3c4'],
  pietra: ['#f3e3c0', '#ecd9b4'],
  mattone: ['#cf9c78', '#c48f6c'],
  edificiLontani: '#c98455',
  chiome: ['#84a363', '#75985c', '#90ab68', '#7c9e56'],
  tronco: '#7b5b41',
  ombra: 'rgba(84, 62, 42, 0.2)',
  strati: {
    cultura: { fondo: '#a8392b', segno: '#fff6e0' },
    ambiente: { fondo: '#3f7d4e', segno: '#fff6e0' },
    mobilita: { fondo: '#2f5f7e', segno: '#fff6e0' },
  },
  avviso: { fondo: '#e8a23a', segno: '#3d2c20' },
  treni: [
    { luce: '#b9493a', ombra: '#8c3429', tetto: '#ddd4c2', finestrini: '#3f4b52' },
    { luce: '#e8e2d2', ombra: '#bdb5a2', tetto: '#5d7f9c', finestrini: '#2f4a63' },
    { luce: '#5a8a72', ombra: '#3f6654', tetto: '#ddd4c2', finestrini: '#2e3b40' },
  ],
  macchine: { tinte: ['#a8392b', '#2f5f7e', '#e8e2d2', '#3d3a36', '#c9a24a', '#6f7d86', '#4f7f5c', '#8a5a7a'], vetri: '#34454f' },
  gente: { pelle: '#e3b48f', capelli: '#4a3324', gambe: '#4b4a58', vesti: ['#2f5f7e', '#a8392b', '#3f7d4e', '#e8a23a', '#7b5aa0', '#d9cfb8', '#8a6c50', '#c45f7a'] },
  ciclabile: '#3f7d4e',
  ferroviaTematica: '#2f5f7e',
  evidenza: '#f0a92e',
  etichetta: '#3d2c20',
  etichettaAlone: '#fbf4e3',
  sfondo: '#f2e5c6',
  nuvole: { colore: '#fffdf8', ombra: '#d3c4a8', alfa: 0.97 },
  muri: { chiaro: 0.08, scuro: -0.17 },
  ombraLunga: 1,
  lampioni: { accesi: false, palo: '#6b5a4c', lampada: '#f3e7c8', alone: '#ffc67a' },
  finestra: '',
  intonaciForti: ['#d88a58', '#e2ad52', '#d99a50', '#dfa37c', '#c8703f', '#e9c066'],
  intonaciChiari: ['#f6eeda', '#f2e7c9', '#efe6d2', '#f5e5c8', '#ebe3cf', '#f3eac2'],
  tettoPiano: ['#dcd2bd', '#d3c9b6', '#e0d5bb'],
  falde: { luce: 0.13, ombra: -0.17 },
  faldaVeloOmbra: 'rgba(84, 34, 16, 0.26)',
  coppi: 'rgba(92, 36, 16, 0.4)',
  vetro: '#4c3d34',
  cornice: '#f8eed6',
  persiane: ['#55705a', '#7a5a40', '#3f5e4b', '#8a6748', '#6b7f5c', '#6e4a36', '#4f6b6a', '#93714e'],
  porte: ['#6f4a32', '#4d5f47', '#7d3f2f', '#5b4636'],
  facciataOmbra: 'rgba(84, 52, 30, 0.22)',
  portico: '#49362a',
  telaio: '#e9dfc8',
  ombraTinta: { colore: '#a8603a', quanto: 0.08 },
  ombraCase: 'rgba(92, 58, 34, 0.27)',
  china: '#573a26',
  macchie: 0.25,
  macchieTinta: { scuro: '#7a4a26', chiaro: '#fff3d6' },
  ombraCalda: 1,
  corrente: 0.5,
  trame: { selciato: 0.62, acqua: 0.5, corrente: 1 },
  selciato: '#a98c62',
  centro: { colore: '#ecd7a8', alfa: 0.62 },
  argine: '#dcc8a0',
  fontana: { pietra: '#e4d6b8', ombra: '#b8a382', acqua: '#86b4a4', zampilli: '#f4fbf8' },
  // Di giorno un velo caldo leggero: i disegni dei luoghi simbolo sono più lisci e più accesi
  // delle case dipinte accanto.
  illustrazioni: { velo: '#f6e3c8', luce: '', acqua: '#86b4a4' },
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
  avviso: PALETTE.avviso,
  treni: [
    { luce: '#bf5a40', ombra: '#8f3c2c', tetto: '#e6cfae', finestrini: '#4a4a4c' },
    { luce: '#ecdcc0', ombra: '#c0ab8c', tetto: '#667e92', finestrini: '#3a4a5a' },
    { luce: '#66886a', ombra: '#48644e', tetto: '#e6cfae', finestrini: '#38403e' },
  ],
  macchine: { tinte: ['#b44a32', '#3a6a80', '#ecdcc0', '#45403a', '#d0a44c', '#7a8084', '#5a8058', '#94607a'], vetri: '#3e4a52' },
  gente: { pelle: '#e0a882', capelli: '#4a3324', gambe: '#4f4a52', vesti: ['#3a6a80', '#b44a32', '#4f8150', '#e5a03f', '#80609c', '#e2d2b4', '#94704f', '#c86a74'] },
  ciclabile: PALETTE.ciclabile,
  ferroviaTematica: PALETTE.ferroviaTematica,
  evidenza: PALETTE.evidenza,
  etichetta: PALETTE.etichetta,
  etichettaAlone: '#fdf3dc',
  muri: { chiaro: 0.16, scuro: -0.25 },
  ombraLunga: 2.1,
  lampioni: { accesi: false, palo: '#66503f', lampada: '#f6e2b4', alone: '#ffc67a' },
  finestra: '',
  falde: { luce: 0.19, ombra: -0.21 },
  faldaVeloOmbra: 'rgba(96, 36, 20, 0.3)',
  coppi: 'rgba(104, 40, 22, 0.38)',
  facciataOmbra: 'rgba(96, 52, 24, 0.26)',
  ombraTinta: { colore: '#6a4460', quanto: 0.15 },
  ombraCase: 'rgba(98, 50, 40, 0.3)',
  macchie: 0.2,
  corrente: 0.28,
  trame: { selciato: 0.62, acqua: 0.45, corrente: 0.95 },
  illustrazioni: { velo: '#fbe2bc', luce: '', acqua: '#86b09a' },
};

// Notte: carta blu scuro, case un poco più chiare del terreno perché si distinguano,
// strade leggibili, Brenta scura. La luce calda la portano lampioni e finestre.
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
  avviso: PALETTE.avviso,
  treni: [
    { luce: '#5b3036', ombra: '#3a2026', tetto: '#4b4858', finestrini: '#ffd58a' },
    { luce: '#6e6f80', ombra: '#4a4b5c', tetto: '#2e3a52', finestrini: '#ffd58a' },
    { luce: '#34504a', ombra: '#243832', tetto: '#4b4858', finestrini: '#ffd58a' },
  ],
  macchine: { tinte: ['#5c2c36', '#2c3e60', '#6e6a78', '#22222c', '#7a6040', '#4a5060', '#2e4a40', '#56405a'], vetri: '#ffd58a' },
  gente: { pelle: '#8a6d68', capelli: '#2a2028', gambe: '#262838', vesti: ['#2c3e60', '#5c2c36', '#2e4a48', '#7a6040', '#463c64', '#6e6a78', '#4e4038', '#64404e'] },
  ciclabile: '#74c389',
  ferroviaTematica: '#7db4dc',
  evidenza: PALETTE.evidenza,
  etichetta: '#fbf4e3',
  etichettaAlone: '#141a30',
  sfondo: '#1b2238',
  nuvole: { colore: '#56608f', ombra: '#2a3358', alfa: 0.9 },
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
  china: '#0b1022',
  macchie: 0.1,
  macchieTinta: { scuro: '#0a0f26', chiaro: '#6570a8' },
  ombraCalda: 0,
  corrente: 0.75,
  trame: { selciato: 0.5, acqua: 0.3, corrente: 0.75 },
  selciato: '#1d2440',
  centro: { colore: '#2f3654', alfa: 0.62 },
  argine: '#3a4263',
  fontana: { pietra: '#5a5f78', ombra: '#3c4058', acqua: '#22375c', zampilli: '#9fb8d8' },
  illustrazioni: { velo: '#58618f', luce: 'rgba(255, 190, 112, 0.22)', acqua: '#15223f' },
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

/**
 * La parte in ombra di un colore: f negativo, come in `sfuma`. Con `caldo` a 0 è proprio
 * `sfuma` (tutti i canali scendono insieme, e il giallo diventa oliva); con `caldo` a 1 il
 * rosso scende meno e il blu di più: l'ombra resta lo stesso intonaco, più carico e più caldo.
 */
export function inOmbra(esadecimale: string, f: number, caldo: number): string {
  if (f >= 0 || caldo <= 0) return sfuma(esadecimale, f);
  const n = parseInt(esadecimale.slice(1), 16);
  const canale = (v: number, peso: number): number =>
    Math.max(0, Math.min(255, Math.round(v * (1 + f * (1 + (peso - 1) * caldo)))));
  const r = canale((n >> 16) & 255, 0.62);
  const g = canale((n >> 8) & 255, 1.02);
  const b = canale(n & 255, 1.5);
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
