// Treni alla stazione di Bassano: interpreta il feed GTFS-Realtime di BusOne (in JSON).
// Funzione pura, con test.
//
// Forma della risposta (verificata il 15 novembre 2026):
//   { header: { timestamp: "1794732470" },
//     entity: [ { tripUpdate: {
//         trip: { tripId: "0083_10083_0_v_1-16313-31B9-0083_v_1-16313-31B9-0083",
//                 startDate: "20261115", scheduleRelationship: "SCHEDULED" },
//         delay: 0,
//         stopTimeUpdate: [ { stopSequence: 1, stopId: "02520",
//                             arrival: { delay: 0, time: "1794734400" },
//                             departure: { delay: 0, time: "1794734400" },
//                             scheduleRelationship: "SCHEDULED" }, ... ] } } ] }
// Le chiavi possono arrivare anche in snake_case (trip_update, stop_time_update, stop_id).
// "time" è l'ora prevista con il ritardo già dentro, in secondi Unix; "delay" è in secondi.
// Il feed contiene anche posizioni stimate dei treni: qui non si leggono.
//
// Limiti del feed, verificati sui dati veri:
//   - contiene solo le corse che hanno dati in diretta, non l'orario completo;
//   - una corsa soppressa arriva di solito senza fermate:
//       { tripUpdate: { trip: { tripId, startDate, scheduleRelationship: "CANCELED" } } }
//     quindi non si può sapere se passava da Bassano e non compare in elenco. Si riconosce
//     come soppressa solo la corsa che porta ancora con sé la fermata di Bassano e il suo orario.
//   Per questo l'interfaccia dice che l'elenco può non essere completo.

import type { LetturaTreni, Treno } from '../types';

/** Codice della stazione di Bassano del Grappa nel feed. I binari sono "02520:platform:N". */
export const CODICE_BASSANO = '02520';

const INDIETRO_MS = 60 * 60 * 1000;
const AVANTI_MS = 6 * 60 * 60 * 1000;

type Oggetto = Record<string, unknown>;

function comeOggetto(valore: unknown): Oggetto | null {
  return typeof valore === 'object' && valore !== null && !Array.isArray(valore) ? (valore as Oggetto) : null;
}

/** Legge una chiave scritta in camelCase oppure in snake_case. */
function campo(oggetto: Oggetto, nome: string): unknown {
  if (nome in oggetto) return oggetto[nome];
  const serpente = nome.replace(/[A-Z]/g, (lettera) => `_${lettera.toLowerCase()}`);
  return oggetto[serpente];
}

function comeNumero(valore: unknown): number | null {
  if (typeof valore === 'number') return Number.isFinite(valore) ? valore : null;
  if (typeof valore !== 'string' || valore.trim() === '') return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
}

/** Codice della stazione senza la parte del binario: "02520:platform:2" → "02520". */
function codiceStazione(valore: unknown): string | null {
  if (typeof valore !== 'string' && typeof valore !== 'number') return null;
  const codice = String(valore).split(':')[0].trim();
  return codice === '' ? null : codice;
}

/**
 * Numero del treno: le cifre dopo "_v_1-" o "_p_1-" nel codice della corsa. Il numero dopo
 * "_v_" segue la linea e non è sempre 1 (nel feed vero: _v_5-, _v_62-, _v_68- ...).
 */
export function numeroTreno(codiceCorsa: unknown): string | null {
  if (typeof codiceCorsa !== 'string') return null;
  const trovato = /_[vp]_\d+-(\d+)/.exec(codiceCorsa);
  return trovato ? trovato[1] : null;
}

function nomeStazione(stazioni: Record<string, string>, codice: string | null): string | null {
  if (codice === null || !Object.prototype.hasOwnProperty.call(stazioni, codice)) return null;
  const nome = stazioni[codice];
  return typeof nome === 'string' && nome.trim() !== '' ? nome.trim() : null;
}

interface Fermata {
  codice: string | null;
  sequenza: number | null;
  voce: Oggetto;
}

interface Orario {
  /** Secondi Unix. */
  ora: number;
  /** Ritardo in secondi, se dichiarato. */
  ritardo: number | null;
}

function orarioDi(valore: unknown): Orario | null {
  const o = comeOggetto(valore);
  if (!o) return null;
  const ora = comeNumero(o.time);
  if (ora === null || ora <= 0) return null;
  return { ora, ritardo: comeNumero(o.delay) };
}

interface TrenoLetto {
  treno: Treno;
  /** Codice della corsa: distingue due corse quando il numero del treno non si riconosce. */
  corsa: string;
}

function trenoDi(voce: unknown, stazioni: Record<string, string>): TrenoLetto | null {
  const entita = comeOggetto(voce);
  if (!entita || campo(entita, 'isDeleted') === true) return null;
  const corsa = comeOggetto(campo(entita, 'tripUpdate'));
  if (!corsa) return null;
  const viaggio = comeOggetto(corsa.trip);
  const grezze = campo(corsa, 'stopTimeUpdate');
  if (!viaggio || !Array.isArray(grezze)) return null;

  // Se il numero non si riconosce il treno resta in elenco, con il numero vuoto.
  const codiceCorsa = campo(viaggio, 'tripId');
  const numero = numeroTreno(codiceCorsa) ?? '';

  const fermate: Fermata[] = [];
  for (const g of grezze) {
    const f = comeOggetto(g);
    if (!f) continue;
    fermate.push({ codice: codiceStazione(campo(f, 'stopId')), sequenza: comeNumero(campo(f, 'stopSequence')), voce: f });
  }
  // Se ogni fermata ha il suo numero d'ordine, vale quello e non l'ordine di arrivo.
  if (fermate.every((f) => f.sequenza !== null)) {
    fermate.sort((a, b) => (a.sequenza as number) - (b.sequenza as number));
  }
  const indice = fermate.findIndex((f) => f.codice === CODICE_BASSANO);
  if (indice < 0) return null;
  const qui = fermate[indice];
  const prima = fermate[0];
  const ultima = fermate[fermate.length - 1];

  // Un feed in diretta può non elencare più le fermate già fatte. Se Bassano è la prima
  // dell'elenco ma il suo numero d'ordine dice che non è la prima della corsa, l'origine
  // non si conosce e il treno conta come transito.
  const inizioNoto = prima.sequenza === null || prima.sequenza <= 1;
  let verso: Treno['verso'];
  if (indice === 0 && inizioNoto) verso = 'partenza';
  else if (indice === fermate.length - 1) verso = 'arrivo';
  else verso = 'transito';

  const partenza = orarioDi(qui.voce.departure);
  const arrivo = orarioDi(qui.voce.arrival);
  const orario = verso === 'arrivo' ? (arrivo ?? partenza) : (partenza ?? arrivo);
  if (!orario) return null;
  const ritardo = orario.ritardo ?? partenza?.ritardo ?? arrivo?.ritardo ?? comeNumero(corsa.delay) ?? 0;

  const statoCorsa = String(campo(viaggio, 'scheduleRelationship') ?? '').toUpperCase();
  const statoFermata = String(campo(qui.voce, 'scheduleRelationship') ?? '').toUpperCase();
  const soppresso = statoCorsa === 'CANCELED' || statoCorsa === 'CANCELLED' || statoFermata === 'SKIPPED';

  return {
    corsa: typeof codiceCorsa === 'string' ? codiceCorsa : '',
    treno: {
      numero,
      verso,
      da: inizioNoto ? nomeStazione(stazioni, prima.codice) : null,
      a: nomeStazione(stazioni, ultima.codice),
      quando: new Date(orario.ora * 1000).toISOString(),
      ritardoMinuti: Math.round(ritardo / 60) || 0,
      soppresso,
    },
  };
}

/**
 * Trasforma il feed nei treni che passano da Bassano, da un'ora prima di `adesso` a sei ore
 * dopo, ordinati per ora. `stazioni` traduce i codici in nomi: un codice sconosciuto dà null
 * invece del codice grezzo. Lancia un errore se il feed non ha la forma attesa; le singole voci
 * malformate vengono saltate. Un treno di cui non si riconosce il numero resta, con
 * `numero` vuoto. Le corse soppresse che arrivano senza fermate non si possono attribuire
 * a Bassano e non compaiono.
 */
export function interpretaTreni(feed: unknown, stazioni: Record<string, string>, adesso: Date): LetturaTreni {
  const f = comeOggetto(feed);
  if (!f) throw new Error('Feed dei treni non valido');
  if (!Array.isArray(f.entity)) throw new Error('Feed dei treni senza elenco delle corse');
  const emissione = comeNumero(comeOggetto(f.header)?.timestamp);
  if (emissione === null || emissione <= 0) throw new Error('Feed dei treni senza ora di emissione');
  const nomi = comeOggetto(stazioni) ? stazioni : {};

  const ora = adesso.getTime();
  const visti = new Set<string>();
  const treni: Treno[] = [];
  for (const voce of f.entity) {
    let letto: TrenoLetto | null = null;
    try {
      letto = trenoDi(voce, nomi);
    } catch {
      letto = null;
    }
    if (!letto) continue;
    const treno = letto.treno;
    const ms = Date.parse(treno.quando);
    if (Number.isNaN(ms) || ms < ora - INDIETRO_MS || ms > ora + AVANTI_MS) continue;
    const chiave = `${treno.numero || letto.corsa}|${treno.quando}`;
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    treni.push(treno);
  }
  treni.sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando) || a.numero.localeCompare(b.numero));

  return { quando: new Date(emissione * 1000).toISOString(), treni };
}
