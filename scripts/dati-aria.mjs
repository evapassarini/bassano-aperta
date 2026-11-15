#!/usr/bin/env node
// Fotografia della qualità dell'aria: scarica i dati in diretta di ARPAV,
// prende la stazione "Bassano" (codseqst 500000106) e scrive
// public/data/aria.json (tipo DatiAria in src/types.ts) con l'ultimo valore
// disponibile per ogni inquinante misurato e, per ozono e PM10, le serie brevi
// che ARPAV pubblica (circa 48 ore di medie orarie, circa 7 medie giornaliere).
// Le serie servono al giudizio a parole, che si calcola nel sito
// (src/live/giudizioAria.ts): qui non si giudica niente, si copiano i numeri.
//
// Uso:   node scripts/dati-aria.mjs
//
// Com'è fatto il file di ARPAV (controllato il 14/11/2026):
//   { "stazioni": [ { "codseqst": "500000106",
//       "misurazioni": [ { "ozono": [ { "data": "2026-11-14 22:42:01", "mis": "36.4" }, ... ] },
//                        { "pm10":  [ { "data": "2026-11-13 23:42:01", "mis": "13.700001" }, ... ] } ] } ] }
// Il file non contiene l'unità di misura: µg/m³ viene dalla pagina ARPAV dei
// dati in diretta (ozono: media oraria; PM10: media giornaliera).
// Le date non hanno fuso orario e ARPAV non dice quale sia: le salviamo senza
// fuso, così l'interfaccia le mostra tali e quali (come fa per il Brenta) e non
// le converte. Minuti e secondi non sono l'ora della misura (cambiano da
// un'esportazione all'altra per lo stesso valore): per le medie orarie teniamo
// solo l'ora, per le medie giornaliere (PM10) solo il giorno.
//
// Il giorno del PM10 NON è una data di misura scritta da ARPAV: tutte le voci
// hanno l'ora dell'esportazione (il 15/11/2026 alle 11:40 erano
// "2026-11-08 11:40:01" ... "2026-11-14 11:40:01"). Che quel giorno sia il
// giorno misurato è verificato su un caso solo, a metà giornata (12/11: in
// diretta 13,399997, validato 13). Non sappiamo cosa succede subito dopo
// mezzanotte. Per questo lo script si difende in due modi:
// - scarta ogni media giornaliera con un giorno che non sia già finito
//   (giorno italiano di quando gira lo script);
// - legge la tabella dei dati validati di ARPAV per la stazione e, se il suo
//   giorno è nella nostra serie, controlla che il PM10 in diretta arrotondato
//   all'intero sia uguale a quello validato. Se non lo è i giorni non sono
//   affidabili: le serie non si salvano e il sito non scrive nessun giudizio,
//   solo i numeri. Se la tabella non risponde o il suo giorno non è nella
//   serie il controllo non si può fare: lo script lo scrive e va avanti.
// La tabella validata serve solo a questo controllo: non se ne copia nessun numero.
//
// Solo moduli interni di Node. Se qualcosa va storto lo script esce con codice
// diverso da zero e non tocca il file esistente.

import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const USCITA = join(RADICE, 'public', 'data', 'aria.json');

const URL_DATI = 'https://www2.arpa.veneto.it/aria-json/exported/aria/data.json';
const URL_STAZIONI = 'https://www2.arpa.veneto.it/aria-json/exported/aria/stats.json';
const STAZIONE = '500000106';
/** Dati validati della stazione (PM10, ozono, biossido di azoto, indice ufficiale): solo per il controllo dei giorni. */
const URL_VALIDATI = `https://api.arpa.veneto.it/REST/v1/aria_tabella_cop?codseqst=${STAZIONE}`;
const INTESTAZIONI = {
  'User-Agent': 'bassano-aperta/0.1 (progetto civico open source)',
  Accept: 'application/json',
};

/** Inquinanti che sappiamo leggere: chiave nel file ARPAV → nome, unità, tipo di media. */
const INQUINANTI = {
  ozono: { nome: 'Ozono (media oraria)', unita: 'µg/m³', giornaliero: false, serie: 'ozonoOrario' },
  pm10: { nome: 'PM10 (media giornaliera)', unita: 'µg/m³', giornaliero: true, serie: 'pm10Giornaliero' },
  pm25: { nome: 'PM2.5 (media giornaliera)', unita: 'µg/m³', giornaliero: true },
};

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function scaricaJson(url) {
  let ultimo;
  for (let i = 0; i < 4; i++) {
    if (i > 0) await pausa(4000 * i);
    try {
      const r = await fetch(url, { headers: INTESTAZIONI, signal: AbortSignal.timeout(60_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return JSON.parse(await r.text());
    } catch (e) {
      ultimo = e;
      console.error(`[aria] ${url}: ${e.message}`);
    }
  }
  throw new Error(`Non riesco a scaricare ${url}: ${ultimo.message}`);
}

/**
 * "2026-11-14 22:42:01" → { giorno: "2026-11-14", ora: "2026-11-14T22:00:00",
 * ordine: "2026-11-14T22:42:01" }, oppure null. Nessun fuso: vedi sopra.
 */
function leggiData(testo) {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}:\d{2})$/.exec(String(testo ?? '').trim());
  if (!m) return null;
  const ordine = `${m[1]}T${m[2]}:${m[3]}`;
  if (Number.isNaN(Date.parse(ordine + 'Z'))) return null;
  return { giorno: m[1], ora: `${m[1]}T${m[2]}:00:00`, ordine };
}

/** Il giorno di oggi in Italia, "2026-11-15". */
function oggiInItalia(adesso = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(adesso);
}

/**
 * Confronta il PM10 in diretta con quello validato da ARPAV per lo stesso giorno.
 * Restituisce { esito: 'uguale' | 'diverso' | 'non fatto', testo }.
 */
async function controllaGiorniPm10(seriePm10) {
  let righe;
  try {
    const risposta = await scaricaJson(URL_VALIDATI);
    righe = Array.isArray(risposta?.data) ? risposta.data : [];
  } catch (e) {
    return { esito: 'non fatto', testo: `tabella dei dati validati non disponibile (${e.message})` };
  }
  const confronti = [];
  for (const riga of righe) {
    if (String(riga?.CODSEQST) !== STAZIONE) continue;
    const giorno = /^(\d{4}-\d{2}-\d{2})/.exec(String(riga?.DATA_RIF ?? ''))?.[1];
    const validato = riga?.CONC_PM10;
    if (!giorno || typeof validato !== 'number' || !Number.isFinite(validato)) continue;
    const nostro = seriePm10.find((p) => p.quando === giorno);
    if (nostro) confronti.push({ giorno, validato, inDiretta: nostro.valore });
  }
  if (confronti.length === 0) return { esito: 'non fatto', testo: 'nessun giorno validato cade nella serie del PM10' };
  const diversi = confronti.filter((c) => Math.round(c.inDiretta) !== c.validato);
  const elenco = (lista) => lista.map((c) => `${c.giorno}: in diretta ${c.inDiretta}, validato ${c.validato}`).join('; ');
  return diversi.length > 0 ? { esito: 'diverso', testo: elenco(diversi) } : { esito: 'uguale', testo: elenco(confronti) };
}

async function main() {
  const oggi = oggiInItalia();
  const dati = await scaricaJson(URL_DATI);
  if (!Array.isArray(dati.stazioni)) throw new Error('Il file ARPAV non ha più il campo "stazioni": struttura cambiata?');
  const stazione = dati.stazioni.find((s) => String(s.codseqst) === STAZIONE);
  if (!stazione) throw new Error(`Stazione ${STAZIONE} assente dal file ARPAV`);
  if (!Array.isArray(stazione.misurazioni)) throw new Error('La stazione non ha il campo "misurazioni": struttura cambiata?');

  const misure = [];
  const serieSalvate = {};
  for (const gruppo of stazione.misurazioni) {
    for (const [chiave, serie] of Object.entries(gruppo || {})) {
      const info = INQUINANTI[chiave];
      if (!info) {
        console.warn(`[aria] inquinante "${chiave}" non previsto: lo salto (unità non verificata)`);
        continue;
      }
      if (!Array.isArray(serie)) continue;
      // Ultimo valore valido: la data più recente con un numero leggibile.
      let ultimo = null;
      // Un valore per ora (o per giorno): se ARPAV ne dà due per lo stesso momento vale il più recente.
      const perMomento = new Map();
      for (const voce of serie) {
        const quando = leggiData(voce?.data);
        const testo = String(voce?.mis ?? '').trim();
        const valore = testo === '' ? NaN : Number(testo);
        if (!quando || !Number.isFinite(valore) || valore < 0) continue;
        // Una media giornaliera vale solo per un giorno già finito: mai oggi, mai domani.
        if (info.giornaliero && quando.giorno >= oggi) {
          console.warn(`[aria] "${chiave}" del ${quando.giorno}: il giorno non è finito, lo scarto`);
          continue;
        }
        if (!ultimo || quando.ordine > ultimo.quando.ordine) ultimo = { quando, valore };
        const momento = info.giornaliero ? quando.giorno : quando.ora;
        const gia = perMomento.get(momento);
        if (!gia || quando.ordine > gia.ordine) perMomento.set(momento, { ordine: quando.ordine, valore });
      }
      if (info.serie && perMomento.size > 0) {
        // Valori come li scrive ARPAV, senza arrotondare: l'arrotondamento lo fa chi giudica.
        serieSalvate[info.serie] = [...perMomento.entries()]
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([quando, v]) => ({ quando, valore: v.valore }));
      }
      if (!ultimo) {
        console.warn(`[aria] nessun valore valido per "${chiave}": lo ometto`);
        continue;
      }
      misure.push({
        inquinante: info.nome,
        valore: Math.round(ultimo.valore * 10) / 10,
        unita: info.unita,
        quando: info.giornaliero ? ultimo.quando.giorno : ultimo.quando.ora,
      });
    }
  }
  if (misure.length === 0) throw new Error('Nessuna misura valida per la stazione: non scrivo un file vuoto');

  // I giorni del PM10 sono ricavati dall'ora dell'esportazione: si controllano sui dati validati.
  if (serieSalvate.pm10Giornaliero) {
    const controllo = await controllaGiorniPm10(serieSalvate.pm10Giornaliero);
    if (controllo.esito === 'diverso') {
      console.warn(`[aria] ATTENZIONE: il PM10 in diretta non coincide con quello validato (${controllo.testo}).`);
      console.warn('[aria] I giorni della serie non sono affidabili: non salvo le serie, il sito non scriverà nessun giudizio.');
      for (const chiave of Object.keys(serieSalvate)) delete serieSalvate[chiave];
    } else if (controllo.esito === 'uguale') {
      console.log(`[aria] giorni del PM10 controllati sui dati validati: ${controllo.testo}`);
    } else {
      console.warn(`[aria] controllo dei giorni del PM10 non fatto: ${controllo.testo}`);
    }
  }

  // Nome della stazione dall'elenco ufficiale; se l'elenco non risponde resta quello noto.
  let nome = 'Bassano';
  try {
    const elenco = await scaricaJson(URL_STAZIONI);
    const voce = (elenco.stazioni || []).find((s) => String(s.codseqst) === STAZIONE);
    if (voce?.nome) nome = String(voce.nome).trim();
  } catch (e) {
    console.warn(`[aria] elenco stazioni non disponibile (${e.message}): uso il nome "${nome}"`);
  }

  const uscita = {
    generato: new Date().toISOString(),
    stazione: `${nome} (ARPAV, codice ${STAZIONE})`,
    fonte: {
      nome: "ARPAV, qualità dell'aria: dati in diretta, non validati",
      url: URL_DATI,
      licenza: "CC BY 4.0 dichiarata da ARPAV per i file XML; i file JSON dell'aria sono elencati nella stessa pagina open data",
    },
    misure,
    ...(Object.keys(serieSalvate).length > 0 ? { serie: serieSalvate } : {}),
  };

  await mkdir(dirname(USCITA), { recursive: true });
  const provvisorio = USCITA + '.tmp';
  await writeFile(provvisorio, JSON.stringify(uscita, null, 2) + '\n');
  await rename(provvisorio, USCITA);

  console.log(`Scritto ${USCITA}`);
  for (const m of misure) console.log(`  ${m.inquinante}: ${m.valore} ${m.unita} (${m.quando})`);
  for (const [nome, punti] of Object.entries(serieSalvate)) {
    console.log(`  serie ${nome}: ${punti.length} valori, da ${punti[0].quando} a ${punti.at(-1).quando}`);
  }
}

main().catch((e) => {
  console.error(`\nERRORE: ${e.message}`);
  process.exit(1);
});
