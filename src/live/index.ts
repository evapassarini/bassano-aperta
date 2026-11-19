// Dati live: il livello della Brenta (API ARPAV, dal browser), i treni alla stazione (feed
// BusOne, dal browser), la fotografia dell'aria e quella degli avvisi sulla viabilità
// (file preparati dagli script: la copia più recente sta nel repository pubblico su GitHub,
// una copia di ripiego è pubblicata con il sito).

import type { DatiAria, DatiAvvisi, LetturaTreni } from '../types';
import { interpretaBrenta } from './brenta';
import type { LetturaBrenta } from './brenta';
import { interpretaTreni } from './treni';

export type { LetturaBrenta };

const URL_BRENTA = 'https://api.arpa.veneto.it/REST/v1/meteo_meteogrammi_tabella?codseqst=300001722';
const DURATA_MEMORIA_MS = 5 * 60 * 1000;
const ATTESA_MASSIMA_MS = 15_000;

async function scarica(
  url: string,
  intestazioni: Record<string, string> = {},
  attesaMassimaMs = ATTESA_MASSIMA_MS,
): Promise<unknown> {
  const controllo = new AbortController();
  const timer = setTimeout(() => controllo.abort(), attesaMassimaMs);
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

// ---------------------------------------------------------------------------
// Fotografie di aria e avvisi: copia remota aggiornata, con ripiego sulla copia locale
// ---------------------------------------------------------------------------

/**
 * Cartella da cui leggere le fotografie aggiornate. Il workflow .github/workflows/dati.yml le
 * salva sul ramo main del repository pubblico (programmato ogni 6 ore, ma GitHub ritarda e salta
 * dei giri); il sito pubblicato su Vercel invece contiene i file del giorno in cui è stato
 * pubblicato. Se cambia la forma dei due file, il sito va ripubblicato nello stesso giro del
 * push: i controlli qui sotto guardano solo `generato` e l'elenco principale. raw.githubusercontent.com risponde con
 * `access-control-allow-origin: *` e tiene i file in memoria 5 minuti.
 */
export const URL_FOTOGRAFIE_REMOTE = 'https://raw.githubusercontent.com/evapassarini/bassano-aperta/main/public/data/';
/** Oltre questo tempo la copia remota si lascia perdere e si usa quella locale. */
export const ATTESA_REMOTO_MS = 4_000;

/** Momento di generazione in millisecondi, o NaN se la data non si legge. */
function momento(dati: { generato: string }): number {
  return Date.parse(dati.generato);
}

/**
 * Legge una fotografia (`nome` è il file in public/data/) dalla copia remota e da quella
 * pubblicata con il sito, insieme. Tiene quella valida con `generato` più recente: a parità, o
 * se la data remota non si legge, vince la locale. Se una delle due non arriva, non supera
 * `controlla` o (la remota) va oltre ATTESA_REMOTO_MS, si usa l'altra. Rifiuta solo se
 * mancano tutte e due. In sviluppo (`npm run dev`) legge solo la copia locale.
 */
async function leggiFotografia<T extends { generato: string }>(
  nome: string,
  controlla: (dati: unknown) => T,
): Promise<T> {
  const locale = scarica(`${import.meta.env.BASE_URL}data/${nome}`).then(controlla);
  if (import.meta.env.DEV) return locale;
  const remota = scarica(`${URL_FOTOGRAFIE_REMOTE}${nome}`, {}, ATTESA_REMOTO_MS).then(controlla);
  const [l, r] = await Promise.allSettled([locale, remota]);
  if (l.status === 'fulfilled' && r.status === 'fulfilled') {
    const tl = momento(l.value);
    const tr = momento(r.value);
    return !Number.isNaN(tr) && (Number.isNaN(tl) || tr > tl) ? r.value : l.value;
  }
  if (l.status === 'fulfilled') return l.value;
  if (r.status === 'fulfilled') return r.value;
  throw l.reason;
}

function controllaAria(dati: unknown): DatiAria {
  const d = dati as Partial<DatiAria> | null;
  if (!d || typeof d !== 'object' || typeof d.generato !== 'string' || !Array.isArray(d.misure)) {
    throw new Error('aria.json non ha la forma attesa');
  }
  return d as DatiAria;
}

let ariaInMemoria: Promise<DatiAria> | null = null;

/**
 * Fotografia della qualità dell'aria (aria.json): la più recente tra la copia su GitHub e
 * quella pubblicata con il sito (vedi leggiFotografia). Resta in memoria finché la pagina è aperta.
 */
export function leggiAria(): Promise<DatiAria> {
  if (ariaInMemoria) return ariaInMemoria;
  const promessa = leggiFotografia('aria.json', controllaAria);
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
  stazioni: Record<string, string>;
}

function controllaStazioni(dati: unknown): TabellaStazioni {
  const d = dati as { stazioni?: unknown } | null;
  if (!d || typeof d !== 'object' || !d.stazioni || typeof d.stazioni !== 'object' || Array.isArray(d.stazioni)) {
    throw new Error('stazioni-treni.json non ha la forma attesa');
  }
  return { stazioni: d.stazioni as Record<string, string> };
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

/**
 * Fotografia degli avvisi sulla viabilità (avvisi.json): la più recente tra la copia su GitHub
 * e quella pubblicata con il sito (vedi leggiFotografia). Resta in memoria finché la pagina è aperta.
 */
export function leggiAvvisi(): Promise<DatiAvvisi> {
  if (avvisiInMemoria) return avvisiInMemoria;
  const promessa = leggiFotografia('avvisi.json', controllaAvvisi);
  avvisiInMemoria = promessa;
  promessa.catch(() => {
    if (avvisiInMemoria === promessa) avvisiInMemoria = null;
  });
  return promessa;
}
