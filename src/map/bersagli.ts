// Geometria dei clic: dove stanno sullo schermo segnaposto e illustrazioni,
// e che cosa c'è sotto un punto. Funzioni pure, provate con vitest.

import { isoInSchermo } from './proiezione';
import type { Camera, Vista } from './proiezione';
import type { LandmarkPronto, PuntoPronto, StratiVisibili } from './scena';

// --- segnaposto ------------------------------------------------------------------

/** Sotto questo zoom i segnaposto diventano semplici pallini. */
export const ZOOM_SEGNAPOSTO = 0.9;
/** Da questo zoom in su si leggono i nomi di tutti i segnaposto. */
export const ZOOM_NOMI = 2.2;

export interface Marcatore {
  /** Indice dentro Scena.punti. */
  indice: number;
  /** Punta sul terreno, in pixel. */
  px: number;
  py: number;
  /** Centro della testa. */
  tx: number;
  ty: number;
  raggio: number;
  /** true se è disegnato come pallino (zoom basso). */
  pallino: boolean;
}

export function misureSegnaposto(
  zoom: number,
  conStoria: boolean,
): { raggio: number; gambo: number; pallino: boolean } {
  if (zoom < ZOOM_SEGNAPOSTO) return { raggio: conStoria ? 5 : 3.5, gambo: 0, pallino: true };
  const crescita = Math.min(1, (zoom - ZOOM_SEGNAPOSTO) / 2);
  const raggio = (conStoria ? 9 : 7.5) + crescita * 2.5;
  return { raggio, gambo: raggio * 1.75, pallino: false };
}

/** I segnaposto degli strati accesi che cadono nella vista, dal più lontano al più vicino. */
export function marcatoriInVista(
  punti: PuntoPronto[],
  visibili: StratiVisibili,
  camera: Camera,
  vista: Vista,
): Marcatore[] {
  const u: Marcatore[] = [];
  const margine = 40;
  for (let i = 0; i < punti.length; i++) {
    const p = punti[i];
    if (!visibili[p.dati.strato]) continue;
    const s = isoInSchermo(p.sx, p.sy, camera, vista);
    if (
      s.px < -margine ||
      s.py < -margine ||
      s.px > vista.larghezza + margine ||
      s.py > vista.altezza + margine * 2
    ) {
      continue;
    }
    const m = misureSegnaposto(camera.zoom, p.dati.storia !== undefined);
    u.push({
      indice: i,
      px: s.px,
      py: s.py,
      tx: s.px,
      ty: s.py - m.gambo,
      raggio: m.raggio,
      pallino: m.pallino,
    });
  }
  return u;
}

/** Distanza di un punto da un segmento. */
export function distanzaDaSegmento(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/** true se il punto tocca la testa o il gambo del segnaposto. */
export function colpisceMarcatore(x: number, y: number, m: Marcatore, tolleranza: number): boolean {
  if (Math.hypot(x - m.tx, y - m.ty) <= m.raggio + tolleranza) return true;
  if (m.pallino) return false;
  return distanzaDaSegmento(x, y, m.px, m.py, m.tx, m.ty) <= m.raggio * 0.45 + tolleranza;
}

// --- illustrazioni ---------------------------------------------------------------

/** Larghezza minima sullo schermo di un luogo simbolo, in pixel. */
export const SPRITE_MINIMO = 20;

export interface Sprite {
  /** Indice dentro Scena.landmark. */
  indice: number;
  x: number;
  y: number;
  larghezza: number;
  altezza: number;
}

/**
 * Rettangolo occupato sullo schermo da un'illustrazione. `proporzione` è
 * altezza / larghezza del disegno.
 */
export function rettangoloSprite(
  l: LandmarkPronto,
  indice: number,
  proporzione: number,
  camera: Camera,
  vista: Vista,
): Sprite {
  const s = isoInSchermo(l.sx, l.sy, camera, vista);
  const larghezza = Math.max(l.larghezza * camera.zoom, SPRITE_MINIMO);
  const altezza = larghezza * proporzione;
  return {
    indice,
    x: s.px - l.dati.ancora[0] * larghezza,
    y: s.py - l.dati.ancora[1] * altezza,
    larghezza,
    altezza,
  };
}

/** Coordinate 0..1 del punto dentro lo sprite, oppure null se è fuori. */
export function dentroSprite(x: number, y: number, s: Sprite): { u: number; v: number } | null {
  if (s.larghezza <= 0 || s.altezza <= 0) return null;
  const u = (x - s.x) / s.larghezza;
  const v = (y - s.y) / s.altezza;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return { u, v };
}

// --- poligoni --------------------------------------------------------------------

/** Punto dentro un anello dato come array piatto [x0, y0, x1, y1, ...]. */
export function puntoInPoligono(x: number, y: number, anello: ArrayLike<number>): boolean {
  const n = anello.length >> 1;
  let dentro = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = anello[i * 2];
    const yi = anello[i * 2 + 1];
    const xj = anello[j * 2];
    const yj = anello[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

// --- che cosa c'è sotto il dito ------------------------------------------------------

export type Colpito = { genere: 'punto'; indice: number } | { genere: 'landmark'; indice: number };

/**
 * Cerca che cosa c'è sotto (x, y). Prima i segnaposto (vince il più vicino a chi
 * guarda, cioè l'ultimo disegnato), poi le illustrazioni. `marcatori` e `sprite`
 * sono in ordine di disegno. `opaco` dice se in quel punto l'illustrazione è
 * davvero disegnata; se manca, vale tutto il rettangolo.
 */
export function trovaBersaglio(
  x: number,
  y: number,
  marcatori: Marcatore[],
  sprite: Sprite[],
  tolleranza: number,
  opaco?: (indice: number, u: number, v: number) => boolean,
): Colpito | null {
  for (let i = marcatori.length - 1; i >= 0; i--) {
    if (colpisceMarcatore(x, y, marcatori[i], tolleranza)) {
      return { genere: 'punto', indice: marcatori[i].indice };
    }
  }
  for (let i = sprite.length - 1; i >= 0; i--) {
    const uv = dentroSprite(x, y, sprite[i]);
    if (uv && (!opaco || opaco(sprite[i].indice, uv.u, uv.v))) {
      return { genere: 'landmark', indice: sprite[i].indice };
    }
  }
  return null;
}
