// Nuvole attorno alla città: la mappa non finisce con un bordo dritto, ma sfuma in un banco
// di nuvole dal contorno irregolare, che copre le ultime case e tutto ciò che sta oltre.
// Posizioni e contorno vengono da una griglia e da un seme: sempre uguali.

import { conAlfa } from './palette';
import { BORDO_NUVOLE, isoInMetri } from './proiezione';
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

/** Lato della griglia a zoom 1, in unità isometriche. */
const PASSO = 105;
const ONDA = BORDO_NUVOLE.onda;
const RIENTRO = BORDO_NUVOLE.rientro;
const RAGGIO_ANGOLI = BORDO_NUVOLE.raggio;
/** Lato delle celle dell'onda, in metri. */
const CELLA_ONDA = 850;

function caso(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f) ^ Math.imul(c + 1, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** Rumore morbido tra -1 e 1: fa ondeggiare il contorno delle nuvole. */
function onda(x: number, y: number): number {
  const u = x / CELLA_ONDA;
  const v = y / CELLA_ONDA;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fu = u - i;
  const fv = v - j;
  const a = fu * fu * (3 - 2 * fu);
  const b = fv * fv * (3 - 2 * fv);
  const alto = caso(i, j, 91) * (1 - a) + caso(i + 1, j, 91) * a;
  const basso = caso(i, j + 1, 91) * (1 - a) + caso(i + 1, j + 1, 91) * a;
  return (alto * (1 - b) + basso * b) * 2 - 1;
}

/**
 * Di quanti metri un punto è oltre il contorno delle nuvole (negativo se è dentro la città).
 * Il contorno non è il rettangolo dei dati: ha gli angoli arrotondati, sta un poco più dentro
 * e ondeggia, così da lontano non si legge la forma del riquadro.
 */
export function fuoriDi(area: Rettangolo, x: number, y: number): number {
  const mx = (area.maxX - area.minX) / 2;
  const my = (area.maxY - area.minY) / 2;
  const raggio = Math.min(RAGGIO_ANGOLI, mx, my);
  // Distanza da un rettangolo con gli angoli tondi.
  const qx = Math.abs(x - (area.minX + area.maxX) / 2) - mx + raggio;
  const qy = Math.abs(y - (area.minY + area.maxY) / 2) - my + raggio;
  const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - raggio;
  return d + RIENTRO + onda(x, y) * ONDA;
}

/**
 * Quanti metri prima del contorno delle nuvole smettono i segnalini: lì il velo copre già
 * quasi tutte le case, e un segnalino sembrerebbe sospeso sulle nuvole.
 */
export const MARGINE_SEGNALINI = 100;

/** true se un segnalino in (x, y), metri locali, cade dove la città si vede ancora. */
export function segnalinoInVista(area: Rettangolo, x: number, y: number): boolean {
  return fuoriDi(area, x, y) <= -MARGINE_SEGNALINI;
}

/**
 * Le nuvole da disegnare nel riquadro visibile (in unità isometriche): prima un velo di
 * sbuffi piccoli a cavallo del contorno, che fa sfumare le ultime case, poi le nuvole grandi
 * che coprono tutto ciò che sta oltre. La griglia raddoppia il passo quando ci si allontana.
 */
export function nuvoleInVista(area: Rettangolo, visibile: Rettangolo, zoom: number): Nuvola[] {
  const livello = Math.ceil(Math.log2(1 / Math.max(zoom, 1e-6)));
  const esito: Nuvola[] = [];
  const strato = (passo: number, seme: number, grande: boolean): void => {
    const i0 = Math.floor((visibile.minX - 2 * passo) / passo);
    const i1 = Math.ceil((visibile.maxX + 2 * passo) / passo);
    const j0 = Math.floor((visibile.minY - 2 * passo) / passo);
    const j1 = Math.ceil((visibile.maxY + 2 * passo) / passo);
    if ((i1 - i0) * (j1 - j0) > 9000) return;
    // Un'unità sul piano vale circa 1,27 metri: serve a ragionare in metri sul contorno.
    const metri = passo * 1.27;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const sx = (i + 0.1 + 0.8 * caso(i, j, seme)) * passo;
        const sy = (j + 0.1 + 0.8 * caso(j, i, seme + 7)) * passo;
        const m = isoInMetri(sx, sy);
        const fuori = fuoriDi(area, m.x, m.y);
        if (grande) {
          // Le nuvole piene cominciano poco oltre il contorno e poi coprono tutto.
          const anticipo = Math.min(0.2 * metri, 110);
          if (fuori < -anticipo) continue;
          const alfa = Math.min(1, 0.45 + (fuori + anticipo) / (1.6 * metri));
          esito.push({ sx, sy, larghezza: passo * (2.3 + 0.9 * caso(i + 31, j - 17, seme)), alfa });
        } else {
          // Il velo sta in una fascia a cavallo del contorno, più fitto verso l'esterno.
          const dentro = Math.min(2.4 * metri, 420);
          if (fuori < -dentro || fuori > 1.2 * metri) continue;
          const alfa = 0.16 + 0.5 * Math.min(1, (fuori + dentro) / dentro);
          esito.push({ sx, sy, larghezza: passo * (1.9 + 0.8 * caso(i - 5, j + 11, seme)), alfa });
        }
      }
    }
  };
  const passo = PASSO * 2 ** livello;
  strato(passo * 0.6, livello * 13 + 3, false);
  strato(passo, livello * 13 + 5, true);
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
      g.addColorStop(0.5, tinta);
      g.addColorStop(1, conAlfa(tinta, 0));
      ctx.globalAlpha = forza;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  stendi(ombra, 14, 0.8);
  stendi(colore, 0, 1);
  return tela;
}
