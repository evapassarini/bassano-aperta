// Regole comuni per gli alberi illustrativi, usate da scripts/dati-osm.mjs (quando si rifà la
// mappa) e da scripts/dati-alberi.mjs (che li aggiunge alla mappa che c'è già, senza Overpass).
// Gli alberi campionati sono un'illustrazione: stanno nelle aree verdi, non sono un rilievo.

import { casuale, centroide, limiti, puntoInPoligono } from './geo.mjs';

/** Parchi e giardini entro questa distanza da Piazza Libertà hanno alberi più fitti (metri). */
export const RAGGIO_GIARDINI = 1200;
export const PASSO_FITTO = 13;
export const PASSO_RADO = 24;
/** Numero massimo di alberi nella mappa, veri e campionati insieme. */
export const TETTO_ALBERI = 8000;

/** Il passo della griglia degli alberi per un'area (metri), oppure 0 se l'area non ne ha. */
export function passoAlberi(tipo, anello) {
  if (tipo === 'bosco') return PASSO_FITTO;
  if (tipo !== 'parco') return 0;
  const [cx, cy] = centroide(anello);
  return Math.hypot(cx, cy) <= RAGGIO_GIARDINI ? PASSO_FITTO : PASSO_RADO;
}

/**
 * I punti di una griglia fissa dentro un anello: uno per cella, spostato in modo che dipende
 * solo dalla cella. A ogni corsa escono gli stessi punti, con la stessa chiave `k`.
 */
export function puntiDiGriglia(anello, passo) {
  const l = limiti(anello);
  const punti = [];
  for (let i = Math.floor(l.minX / passo); i <= Math.floor(l.maxX / passo); i++) {
    for (let j = Math.floor(l.minY / passo); j <= Math.floor(l.maxY / passo); j++) {
      const seme = (Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ passo) | 0;
      const p = [(i + 0.15 + 0.7 * casuale(seme, 1)) * passo, (j + 0.15 + 0.7 * casuale(seme, 2)) * passo];
      if (!puntoInPoligono(p, anello)) continue;
      punti.push({ p, r: casuale(seme, 3), k: `${passo}:${i}:${j}` });
    }
  }
  return punti;
}
