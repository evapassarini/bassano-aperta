#!/usr/bin/env node
// Fotografia della qualità dell'aria: scarica i dati in diretta di ARPAV,
// prende la stazione "Bassano" (codseqst 500000106) e scrive
// public/data/aria.json (tipo DatiAria in src/types.ts) con l'ultimo valore
// disponibile per ogni inquinante misurato.
//
// Uso:   node scripts/dati-aria.mjs
//
// Com'è fatto il file di ARPAV (controllato il 14/11/2026):
//   { "stazioni": [ { "codseqst": "500000106",
//       "misurazioni": [ { "ozono": [ { "data": "2026-11-14 22:42:01", "mis": "36.4" }, ... ] },
//                        { "pm10":  [ { "data": "2026-11-13 23:42:01", "mis": "13.700001" }, ... ] } ] } ] }
// Il file non contiene l'unità di misura: µg/m³ viene dalla pagina ARPAV dei
// dati in diretta (ozono: media oraria; PM10: media giornaliera).
// Le date non hanno fuso orario. L'ultima coincide, al secondo, con l'orario
// GMT in cui il file è stato generato (intestazione Last-Modified): le
// trattiamo quindi come UTC. Per il PM10, che è una media giornaliera,
// teniamo solo il giorno.
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
const INTESTAZIONI = {
  'User-Agent': 'bassano-aperta/0.1 (progetto civico open source)',
  Accept: 'application/json',
};

/** Inquinanti che sappiamo leggere: chiave nel file ARPAV → nome, unità, tipo di media. */
const INQUINANTI = {
  ozono: { nome: 'Ozono (media oraria)', unita: 'µg/m³', giornaliero: false },
  pm10: { nome: 'PM10 (media giornaliera)', unita: 'µg/m³', giornaliero: true },
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

/** "2026-11-14 22:42:01" → { giorno: "2026-11-14", iso: "2026-11-14T22:42:01Z" }, oppure null. */
function leggiData(testo) {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(String(testo ?? '').trim());
  if (!m) return null;
  const iso = `${m[1]}T${m[2]}Z`;
  return Number.isNaN(Date.parse(iso)) ? null : { giorno: m[1], iso };
}

async function main() {
  const dati = await scaricaJson(URL_DATI);
  if (!Array.isArray(dati.stazioni)) throw new Error('Il file ARPAV non ha più il campo "stazioni": struttura cambiata?');
  const stazione = dati.stazioni.find((s) => String(s.codseqst) === STAZIONE);
  if (!stazione) throw new Error(`Stazione ${STAZIONE} assente dal file ARPAV`);
  if (!Array.isArray(stazione.misurazioni)) throw new Error('La stazione non ha il campo "misurazioni": struttura cambiata?');

  const misure = [];
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
      for (const voce of serie) {
        const quando = leggiData(voce?.data);
        const testo = String(voce?.mis ?? '').trim();
        const valore = testo === '' ? NaN : Number(testo);
        if (!quando || !Number.isFinite(valore) || valore < 0) continue;
        if (!ultimo || quando.iso > ultimo.quando.iso) ultimo = { quando, valore };
      }
      if (!ultimo) {
        console.warn(`[aria] nessun valore valido per "${chiave}": lo ometto`);
        continue;
      }
      misure.push({
        inquinante: info.nome,
        valore: Math.round(ultimo.valore * 10) / 10,
        unita: info.unita,
        quando: info.giornaliero ? ultimo.quando.giorno : ultimo.quando.iso,
      });
    }
  }
  if (misure.length === 0) throw new Error('Nessuna misura valida per la stazione: non scrivo un file vuoto');

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
      licenza: 'CC BY 4.0 (come indicato nella pagina open data di ARPAV)',
    },
    misure,
  };

  await mkdir(dirname(USCITA), { recursive: true });
  const provvisorio = USCITA + '.tmp';
  await writeFile(provvisorio, JSON.stringify(uscita, null, 2) + '\n');
  await rename(provvisorio, USCITA);

  console.log(`Scritto ${USCITA}`);
  for (const m of misure) console.log(`  ${m.inquinante}: ${m.valore} ${m.unita} (${m.quando})`);
}

main().catch((e) => {
  console.error(`\nERRORE: ${e.message}`);
  process.exit(1);
});
