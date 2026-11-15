// Luce della mappa in base all'ora vera di Bassano. Funzioni pure: nessuna rete.
// Chi cambia le soglie aggiorna anche docs/SPEC.md e tests/luce.test.ts.

import type { Luce } from './types';
import { ORIGINE } from './types';

const RAD = Math.PI / 180;

/** Altezza del sole sull'orizzonte a Bassano, in gradi (formula approssimata, errore sotto 1 grado). */
export function altezzaSole(quando: Date): number {
  const giorni = quando.getTime() / 86_400_000 - 10957.5; // giorni da J2000
  const anomalia = (357.529 + 0.98560028 * giorni) * RAD;
  const longitudine = (280.459 + 0.98564736 * giorni) * RAD + (1.915 * Math.sin(anomalia) + 0.02 * Math.sin(2 * anomalia)) * RAD;
  const obliquita = (23.439 - 0.00000036 * giorni) * RAD;
  const declinazione = Math.asin(Math.sin(obliquita) * Math.sin(longitudine));
  const ascensione = Math.atan2(Math.cos(obliquita) * Math.sin(longitudine), Math.cos(longitudine));
  const tempoSiderale = (280.46061837 + 360.98564736629 * giorni + ORIGINE.lon) * RAD;
  const angoloOrario = tempoSiderale - ascensione;
  const lat = ORIGINE.lat * RAD;
  return Math.asin(Math.sin(lat) * Math.sin(declinazione) + Math.cos(lat) * Math.cos(declinazione) * Math.cos(angoloOrario)) / RAD;
}

/** true se a Bassano il sole ha già passato il punto più alto della giornata. */
export function dopoMezzogiornoSolare(quando: Date): boolean {
  return altezzaSole(new Date(quando.getTime() + 10 * 60_000)) < altezzaSole(quando);
}

/**
 * Luce di questo momento: 'notte' con il sole più di 4 gradi sotto l'orizzonte; 'pomeriggio'
 * quando il sole scende ed è sotto i 25 gradi; altrimenti 'giorno'.
 */
export function luceAdesso(quando: Date): Luce {
  const altezza = altezzaSole(quando);
  if (altezza < -4) return 'notte';
  if (dopoMezzogiornoSolare(quando) && altezza < 25) return 'pomeriggio';
  return 'giorno';
}
