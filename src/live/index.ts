// Dati live: il livello del Brenta (API ARPAV, dal browser) e la fotografia dell'aria
// (file statico preparato da scripts/dati-aria.mjs).

import type { DatiAria } from '../types';
import { interpretaBrenta } from './brenta';
import type { LetturaBrenta } from './brenta';

export type { LetturaBrenta };

const URL_BRENTA = 'https://api.arpa.veneto.it/REST/v1/meteo_meteogrammi_tabella?codseqst=300001722';
const DURATA_MEMORIA_MS = 5 * 60 * 1000;
const ATTESA_MASSIMA_MS = 15_000;

async function scarica(url: string): Promise<unknown> {
  const controllo = new AbortController();
  const timer = setTimeout(() => controllo.abort(), ATTESA_MASSIMA_MS);
  try {
    const risposta = await fetch(url, { signal: controllo.signal, headers: { Accept: 'application/json' } });
    if (!risposta.ok) throw new Error(`Risposta ${risposta.status} da ${url}`);
    return (await risposta.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

let brentaInMemoria: { quando: number; promessa: Promise<LetturaBrenta> } | null = null;

/** Livello del Brenta a Barzizza. Tiene il risultato in memoria per 5 minuti. Rifiuta se la rete fallisce. */
export function leggiBrenta(): Promise<LetturaBrenta> {
  const adesso = Date.now();
  if (brentaInMemoria && adesso - brentaInMemoria.quando < DURATA_MEMORIA_MS) {
    return brentaInMemoria.promessa;
  }
  const promessa = scarica(URL_BRENTA).then(interpretaBrenta);
  const voce = { quando: adesso, promessa };
  brentaInMemoria = voce;
  // Un errore non resta in memoria: la prossima chiamata riprova.
  promessa.catch(() => {
    if (brentaInMemoria === voce) brentaInMemoria = null;
  });
  return promessa;
}

function controllaAria(dati: unknown): DatiAria {
  const d = dati as Partial<DatiAria> | null;
  if (!d || typeof d !== 'object' || typeof d.generato !== 'string' || !Array.isArray(d.misure)) {
    throw new Error('aria.json non ha la forma attesa');
  }
  return d as DatiAria;
}

let ariaInMemoria: Promise<DatiAria> | null = null;

/** Fotografia della qualità dell'aria: legge public/data/aria.json. */
export function leggiAria(): Promise<DatiAria> {
  if (ariaInMemoria) return ariaInMemoria;
  const promessa = scarica(`${import.meta.env.BASE_URL}data/aria.json`).then(controllaAria);
  ariaInMemoria = promessa;
  promessa.catch(() => {
    if (ariaInMemoria === promessa) ariaInMemoria = null;
  });
  return promessa;
}
