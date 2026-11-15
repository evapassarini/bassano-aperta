// Proiezione: gradi <-> metri locali <-> piano isometrico <-> pixel dello schermo.
// Solo funzioni pure, nessun accesso al DOM. Le formule sono quelle di docs/SPEC.md.

import { ORIGINE, RIQUADRO } from '../types';
import type { LonLat, Metri } from '../types';

/** Metri per grado di longitudine all'equatore e per grado di latitudine. */
export const METRI_PER_GRADO_LON = 111320;
export const METRI_PER_GRADO_LAT = 110574;

/** Coefficienti dell'isometria 2:1. */
export const ISO_X = 0.7071;
export const ISO_Y = 0.35355;
export const ISO_Z = 0.8165;

const RAD = Math.PI / 180;

/** Un punto sul piano isometrico (unità: metri "schiacciati", non pixel). */
export interface Iso {
  sx: number;
  sy: number;
}

/** Un punto sullo schermo, in pixel CSS dall'angolo in alto a sinistra del canvas. */
export interface Pixel {
  px: number;
  py: number;
}

/** Camera: centro sul terreno in metri locali, zoom in pixel per unità isometrica. */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Dimensioni del canvas in pixel CSS. */
export interface Vista {
  larghezza: number;
  altezza: number;
}

export interface Rettangolo {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// --- gradi <-> metri locali -------------------------------------------------

export function lonLatInMetri(p: LonLat, origine: LonLat = ORIGINE): Metri {
  return {
    x: (p.lon - origine.lon) * METRI_PER_GRADO_LON * Math.cos(origine.lat * RAD),
    y: (p.lat - origine.lat) * METRI_PER_GRADO_LAT,
  };
}

export function metriInLonLat(m: Metri, origine: LonLat = ORIGINE): LonLat {
  return {
    lon: origine.lon + m.x / (METRI_PER_GRADO_LON * Math.cos(origine.lat * RAD)),
    lat: origine.lat + m.y / METRI_PER_GRADO_LAT,
  };
}

// --- metri locali <-> piano isometrico --------------------------------------

/** Nord in alto a sinistra, est in alto a destra; z è l'altezza dal suolo. */
export function metriInIso(x: number, y: number, z = 0): Iso {
  return { sx: (x - y) * ISO_X, sy: -(x + y) * ISO_Y - z * ISO_Z };
}

/** Inverso sul piano del terreno (z = 0). */
export function isoInMetri(sx: number, sy: number): Metri {
  const a = sx / ISO_X; // x - y
  const b = -sy / ISO_Y; // x + y
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Di quante unità isometriche sale sullo schermo un'altezza in metri. */
export function altezzaInIso(z: number): number {
  return z * ISO_Z;
}

/**
 * Chiave di profondità di un punto sul terreno: più è grande, più il punto è
 * lontano (a nord-est) e prima va disegnato.
 */
export function profondita(x: number, y: number): number {
  return x + y;
}

// --- piano isometrico <-> schermo -------------------------------------------

export function isoInSchermo(sx: number, sy: number, camera: Camera, vista: Vista): Pixel {
  const c = metriInIso(camera.x, camera.y);
  return {
    px: vista.larghezza / 2 + (sx - c.sx) * camera.zoom,
    py: vista.altezza / 2 + (sy - c.sy) * camera.zoom,
  };
}

export function metriInSchermo(
  x: number,
  y: number,
  z: number,
  camera: Camera,
  vista: Vista,
): Pixel {
  const p = metriInIso(x, y, z);
  return isoInSchermo(p.sx, p.sy, camera, vista);
}

/** Dal pixel al punto del terreno (z = 0) che gli sta sotto. */
export function schermoInMetri(px: number, py: number, camera: Camera, vista: Vista): Metri {
  const c = metriInIso(camera.x, camera.y);
  return isoInMetri(
    c.sx + (px - vista.larghezza / 2) / camera.zoom,
    c.sy + (py - vista.altezza / 2) / camera.zoom,
  );
}

/** Uno spostamento in pixel tradotto in spostamento sul terreno, in metri. */
export function spostamentoInMetri(dpx: number, dpy: number, zoom: number): Metri {
  return isoInMetri(dpx / zoom, dpy / zoom);
}

/** Il rettangolo del piano isometrico che la camera inquadra. */
export function riquadroVisibile(camera: Camera, vista: Vista, margine = 0): Rettangolo {
  const c = metriInIso(camera.x, camera.y);
  const mezzaL = vista.larghezza / 2 / camera.zoom + margine;
  const mezzaA = vista.altezza / 2 / camera.zoom + margine;
  return { minX: c.sx - mezzaL, minY: c.sy - mezzaA, maxX: c.sx + mezzaL, maxY: c.sy + mezzaA };
}

/**
 * Nuova camera con lo zoom cambiato tenendo fermo il punto del terreno che sta
 * sotto il pixel indicato (il cursore, o il centro di un pizzico).
 */
export function zoomAttorno(
  camera: Camera,
  vista: Vista,
  px: number,
  py: number,
  nuovoZoom: number,
): Camera {
  const fermo = schermoInMetri(px, py, camera, vista);
  const d = spostamentoInMetri(px - vista.larghezza / 2, py - vista.altezza / 2, nuovoZoom);
  return { x: fermo.x - d.x, y: fermo.y - d.y, zoom: nuovoZoom };
}

// --- area dei dati -----------------------------------------------------------

/** Il riquadro dei dati in metri locali. */
export function riquadroInMetri(
  r: { ovest: number; sud: number; est: number; nord: number } = RIQUADRO,
): Rettangolo {
  const so = lonLatInMetri({ lon: r.ovest, lat: r.sud });
  const ne = lonLatInMetri({ lon: r.est, lat: r.nord });
  return { minX: so.x, minY: so.y, maxX: ne.x, maxY: ne.y };
}

/** I quattro angoli di un rettangolo in metri, proiettati: SO, SE, NE, NO. */
export function angoliInIso(r: Rettangolo): Iso[] {
  return [
    metriInIso(r.minX, r.minY),
    metriInIso(r.maxX, r.minY),
    metriInIso(r.maxX, r.maxY),
    metriInIso(r.minX, r.maxY),
  ];
}

/**
 * Di quanti metri il centro della camera deve restare dentro il bordo dei dati, perché
 * oltre il bordo non c'è nulla da vedere: il bordo può arrivare quasi al margine più
 * vicino dello schermo, non oltre. Mai più del 45%
 * del lato corto dell'area, così a zoom basso ci si può ancora muovere.
 */
export function margineCamera(area: Rettangolo, zoom: number, vista: Vista): number {
  const mezzo = Math.min(vista.larghezza, vista.altezza) / 2;
  // Un metro verso est o verso nord sono circa 0,79 unità sullo schermo a zoom 1.
  const metri = (0.9 * mezzo) / (Math.hypot(ISO_X, ISO_Y) * Math.max(zoom, 1e-6));
  const tetto = 0.45 * Math.min(area.maxX - area.minX, area.maxY - area.minY);
  return Math.max(0, Math.min(tetto, metri));
}

/**
 * Tiene il centro della camera dentro l'area dei dati e lo zoom tra i limiti. Con `vista`
 * il centro resta anche lontano dal bordo quanto basta a non riempire lo schermo di vuoto.
 */
export function limitaCamera(
  camera: Camera,
  area: Rettangolo,
  zoomMin: number,
  zoomMax: number,
  vista?: Vista,
): Camera {
  const zoom = Math.min(zoomMax, Math.max(zoomMin, camera.zoom));
  const m = vista ? margineCamera(area, zoom, vista) : 0;
  return {
    x: Math.min(area.maxX - m, Math.max(area.minX + m, camera.x)),
    y: Math.min(area.maxY - m, Math.max(area.minY + m, camera.y)),
    zoom,
  };
}

/** Lo zoom a cui l'intera area dei dati entra nella vista. */
export function zoomPerContenere(area: Rettangolo, vista: Vista): number {
  const a = angoliInIso(area);
  const larghezza = a[1].sx - a[3].sx; // da NO a SE
  const altezza = a[0].sy - a[2].sy; // da NE a SO
  return Math.min(vista.larghezza / larghezza, vista.altezza / altezza);
}
