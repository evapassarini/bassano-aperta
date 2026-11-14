// Tutti i colori della mappa stanno qui: una cartolina illustrata, carta crema,
// tetti in cotto, intonaci veneziani, Brenta verde-azzurro, contorni seppia.

import type { IdStrato, TipoArea, TipoStrada } from '../types';

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
  pietra: ['#efe3c8', '#e8dcc2'],
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
};

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

/** Un colore esadecimale con trasparenza, come rgba(). */
export function conAlfa(esadecimale: string, alfa: number): string {
  const n = parseInt(esadecimale.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}
