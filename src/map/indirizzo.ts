// Posizione della mappa nell'indirizzo: #@<x>,<y>,<zoom>
// x e y in metri locali arrotondati, zoom con due decimali. Funzioni pure.

import type { Camera } from './proiezione';

export interface PosizioneHash {
  camera: Camera;
  /** Quello che segue la posizione nell'hash (per esempio "/fonti"): va conservato. */
  resto: string;
}

const FORMA = /^#?@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)(.*)$/;

/** Legge la posizione dall'hash; null se l'hash non è una posizione valida. */
export function leggiHash(hash: string): PosizioneHash | null {
  const m = FORMA.exec(hash.trim());
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  const zoom = Number(m[3]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom) || zoom <= 0) {
    return null;
  }
  const resto = m[4];
  // Dopo lo zoom è ammesso solo un separatore: "1.50abc" non è una posizione.
  if (resto !== '' && !/^[/&?;]/.test(resto)) return null;
  return { camera: { x, y, zoom }, resto };
}

/** Scrive la posizione come hash, conservando l'eventuale resto. */
export function formattaHash(camera: Camera, resto = ''): string {
  const intero = (v: number): string => String(Math.round(v) + 0); // evita "-0"
  return `#@${intero(camera.x)},${intero(camera.y)},${camera.zoom.toFixed(2)}${resto}`;
}

/** true se l'hash è vuoto o è una posizione: allora la mappa può riscriverlo. */
export function hashDellaMappa(hash: string): boolean {
  return hash === '' || hash === '#' || leggiHash(hash) !== null;
}
