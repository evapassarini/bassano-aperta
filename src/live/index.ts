// Dati live: il livello della Brenta (API ARPAV, dal browser), i treni alla stazione (feed
// BusOne, dal browser), la fotografia dell'aria e quella degli avvisi sulla viabilità
// (file statici preparati dagli script).

import type { DatiAria, DatiAvvisi, LetturaTreni } from '../types';
import { interpretaBrenta } from './brenta';
import type { LetturaBrenta } from './brenta';
import { interpretaTreni } from './treni';

export type { LetturaBrenta };

const URL_BRENTA = 'https://api.arpa.veneto.it/REST/v1/meteo_meteogrammi_tabella?codseqst=300001722';
const DURATA_MEMORIA_MS = 5 * 60 * 1000;
const ATTESA_MASSIMA_MS = 15_000;

async function scarica(url: string, intestazioni: Record<string, string> = {}): Promise<unknown> {
  const controllo = new AbortController();
  const timer = setTimeout(() => controllo.abort(), ATTESA_MASSIMA_MS);
  try {
    const risposta = await fetch(url, {
      signal: controllo.signal,
      headers: { Accept: 'application/json', ...intestazioni },
    });
    if (!risposta.ok) throw new Error(`Risposta ${risposta.status} da ${url}`);
    return (await risposta.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

let brentaInMemoria: { quando: number; promessa: Promise<LetturaBrenta> } | null = null;

/** Livello della Brenta a Barzizza. Tiene il risultato in memoria per 5 minuti. Rifiuta se la rete fallisce. */
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

// ---------------------------------------------------------------------------
// Treni alla stazione di Bassano
// ---------------------------------------------------------------------------

const URL_TRENI = 'https://proxy.busone.app/trenitalia/gtfs-rt/trip-updates.json';
/**
 * BusOne chiede a chi usa il servizio di presentarsi a ogni richiesta. Il contatto è
 * l'indirizzo del repository (nessuna email). Lo stesso valore sta in scripts/dati-stazioni.mjs:
 * un test controlla che restino uguali.
 */
export const INTESTAZIONI_BUSONE = {
  'X-BusOne-Client': 'bassano-aperta (progetto civico open source; https://github.com/evapassarini/bassano-aperta)',
  'X-BusOne-Use': 'personal',
};
const DURATA_MEMORIA_TRENI_MS = 2 * 60 * 1000;

interface TabellaStazioni {
  /** Quando lo script ha generato la tabella (ISO 8601). */
  generato: string;
  stazioni: Record<string, string>;
}

function controllaStazioni(dati: unknown): TabellaStazioni {
  const d = dati as { generato?: unknown; stazioni?: unknown } | null;
  if (!d || typeof d !== 'object' || !d.stazioni || typeof d.stazioni !== 'object' || Array.isArray(d.stazioni)) {
    throw new Error('stazioni-treni.json non ha la forma attesa');
  }
  return { generato: typeof d.generato === 'string' ? d.generato : '', stazioni: d.stazioni as Record<string, string> };
}

let stazioniInMemoria: Promise<TabellaStazioni> | null = null;

/** La tabella dei nomi delle stazioni, caricata una volta sola. Un errore non resta in memoria. */
function leggiTabellaStazioni(): Promise<TabellaStazioni> {
  if (stazioniInMemoria) return stazioniInMemoria;
  const promessa = scarica(`${import.meta.env.BASE_URL}data/stazioni-treni.json`).then(controllaStazioni);
  stazioniInMemoria = promessa;
  promessa.catch(() => {
    if (stazioniInMemoria === promessa) stazioniInMemoria = null;
  });
  return promessa;
}

/**
 * Nomi delle stazioni (public/data/stazioni-treni.json). Se la tabella non arriva i treni si
 * mostrano lo stesso, senza nomi, e alla lettura dopo si riprova.
 */
function leggiStazioni(): Promise<Record<string, string>> {
  return leggiTabellaStazioni().then(
    (tabella) => tabella.stazioni,
    (): Record<string, string> => ({}),
  );
}

/**
 * Data in cui è stata generata la tabella dei nomi delle stazioni, per «Fonti e licenze».
 * Rifiuta se il file non arriva o non dichiara una data.
 */
export function leggiDataStazioni(): Promise<string> {
  return leggiTabellaStazioni().then((tabella) => {
    if (!tabella.generato || Number.isNaN(Date.parse(tabella.generato))) {
      throw new Error('stazioni-treni.json non dichiara quando è stato generato');
    }
    return tabella.generato;
  });
}

let treniInMemoria: { quando: number; promessa: Promise<LetturaTreni> } | null = null;

/**
 * Treni che passano dalla stazione di Bassano, con i ritardi dichiarati dall'operatore e
 * rielaborati da BusOne. Tiene il risultato in memoria per 2 minuti. Rifiuta se la rete fallisce.
 */
export function leggiTreni(): Promise<LetturaTreni> {
  const adesso = Date.now();
  if (treniInMemoria && adesso - treniInMemoria.quando < DURATA_MEMORIA_TRENI_MS) {
    return treniInMemoria.promessa;
  }
  const promessa = Promise.all([scarica(URL_TRENI, INTESTAZIONI_BUSONE), leggiStazioni()]).then(
    ([feed, stazioni]) => interpretaTreni(feed, stazioni, new Date()),
  );
  const voce = { quando: adesso, promessa };
  treniInMemoria = voce;
  promessa.catch(() => {
    if (treniInMemoria === voce) treniInMemoria = null;
  });
  return promessa;
}

// ---------------------------------------------------------------------------
// Avvisi sulla viabilità
// ---------------------------------------------------------------------------

function controllaAvvisi(dati: unknown): DatiAvvisi {
  const d = dati as Partial<DatiAvvisi> | null;
  if (!d || typeof d !== 'object' || typeof d.generato !== 'string' || !Array.isArray(d.avvisi)) {
    throw new Error('avvisi.json non ha la forma attesa');
  }
  return { ...d, fonti: Array.isArray(d.fonti) ? d.fonti : [] } as DatiAvvisi;
}

let avvisiInMemoria: Promise<DatiAvvisi> | null = null;

/** Fotografia degli avvisi sulla viabilità: legge public/data/avvisi.json. */
export function leggiAvvisi(): Promise<DatiAvvisi> {
  if (avvisiInMemoria) return avvisiInMemoria;
  const promessa = scarica(`${import.meta.env.BASE_URL}data/avvisi.json`).then(controllaAvvisi);
  avvisiInMemoria = promessa;
  promessa.catch(() => {
    if (avvisiInMemoria === promessa) avvisiInMemoria = null;
  });
  return promessa;
}
