// Nuvole oltre il bordo dei dati: dove la mappa finisce non resta il vuoto, ma un banco di
// nuvole che copre il margine. Posizioni decise da una griglia e da un seme: sempre uguali.

import { conAlfa } from './palette';
import { isoInMetri } from './proiezione';
import type { Rettangolo } from './proiezione';

export interface Nuvola {
  /** Centro sul piano isometrico. */
  sx: number;
  sy: number;
  /** Larghezza sul piano isometrico. */
  larghezza: number;
  /** Quanto è presente, tra 0 e 1. */
  alfa: number;
}

/** Quanti metri dentro il bordo arrivano le prime nuvole, e in quanti diventano piene. */
const DENTRO = 160;
const RAMPA = 520;
/** Lato della griglia a zoom 1, in unità isometriche. */
const PASSO = 150;

function caso(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f) ^ Math.imul(c + 1, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** Di quanti metri un punto è fuori dall'area (negativo se è dentro). */
export function fuoriDi(area: Rettangolo, x: number, y: number): number {
  return Math.max(area.minX - x, x - area.maxX, area.minY - y, y - area.maxY);
}

/**
 * Le nuvole da disegnare nel riquadro visibile (in unità isometriche). La griglia raddoppia
 * il passo quando ci si allontana, così il loro numero resta piccolo a ogni zoom.
 */
export function nuvoleInVista(area: Rettangolo, visibile: Rettangolo, zoom: number): Nuvola[] {
  // Il passo segue lo zoom a salti di un raddoppio: sullo schermo una nuvola resta tra circa
  // 250 e 600 pixel, a ogni distanza.
  const livello = Math.ceil(Math.log2(1 / Math.max(zoom, 1e-6)));
  const passo = PASSO * 2 ** livello;
  const esito: Nuvola[] = [];
  const i0 = Math.floor((visibile.minX - passo) / passo);
  const i1 = Math.ceil((visibile.maxX + passo) / passo);
  const j0 = Math.floor((visibile.minY - passo) / passo);
  const j1 = Math.ceil((visibile.maxY + passo) / passo);
  if ((i1 - i0) * (j1 - j0) > 6000) return esito;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const sx = (i + 0.15 + 0.7 * caso(i, j, livello)) * passo;
      const sy = (j + 0.15 + 0.7 * caso(j, i, livello + 7)) * passo;
      const m = isoInMetri(sx, sy);
      const fuori = fuoriDi(area, m.x, m.y);
      const larghezza = passo * (1.7 + 0.9 * caso(i + 31, j - 17, livello));
      // La nuvola può sporgere sulla mappa solo di poco: conta dove arriva il suo bordo,
      // non il suo centro (un'unità sul piano vale circa 1,27 metri verso il bordo).
      const sporge = fuori - 0.3 * larghezza * 1.27;
      if (sporge < -DENTRO) continue;
      const alfa = Math.min(1, (sporge + DENTRO) / RAMPA + 0.35);
      esito.push({ sx, sy, larghezza, alfa });
    }
  }
  return esito;
}

/** Disegna una nuvola morbida su una tela piccola, da riusare per tutte. */
export function creaNuvola(colore: string, ombra: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const tela = document.createElement('canvas');
  tela.width = 320;
  tela.height = 200;
  const ctx = tela.getContext('2d');
  if (!ctx) return null;
  // Sbuffi: [x, y, raggio]. Prima l'ombra, spostata in basso, poi il bianco.
  const sbuffi: [number, number, number][] = [
    [80, 118, 58],
    [128, 92, 70],
    [186, 96, 64],
    [236, 122, 52],
    [158, 128, 66],
    [108, 132, 50],
    [208, 134, 48],
  ];
  const stendi = (tinta: string, dy: number, forza: number): void => {
    for (const [x, y, r] of sbuffi) {
      const g = ctx.createRadialGradient(x, y + dy, r * 0.15, x, y + dy, r);
      g.addColorStop(0, tinta);
      g.addColorStop(0.55, tinta);
      g.addColorStop(1, conAlfa(tinta, 0));
      ctx.globalAlpha = forza;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  stendi(ombra, 14, 0.85);
  stendi(colore, 0, 1);
  // I bordi dei gradienti sommati restano un poco trasparenti: va bene, sono nuvole.
  return tela;
}
