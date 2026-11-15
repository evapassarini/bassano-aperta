#!/usr/bin/env node
// Fotografia degli avvisi sulla viabilità attorno a Bassano: scarica due feed RSS,
// tiene solo le voci che riguardano Bassano e i comuni vicini e scrive
// public/data/avvisi.json (tipo DatiAvvisi in src/types.ts), dal più recente.
//
// Uso:   node scripts/dati-avvisi.mjs
//
// Le due fonti non permettono la lettura dal browser (niente CORS): per questo
// serve lo script. Nessuna delle due dichiara una licenza: riportiamo solo un
// testo breve (280 caratteri al massimo) e sempre il link alla fonte.
//
//   CCISS Viaggiare Informati, https://www.cciss.it/rss
//     100 eventi di traffico in corso in tutta Italia. Teniamo: SS47 o Valsugana
//     insieme a Bassano, Pove, Romano, Cassola, Rosà, Marostica, Solagna,
//     Cartigliano o Nove; la SS248; la Pedemontana Veneta (SPV) con gli stessi
//     comuni; qualunque evento che nomina Bassano. Tipo 'evento'.
//   Vi.abilità (Provincia di Vicenza), https://vi-abilita.it/feed/
//     160 voci: ordinanze sulle strade provinciali e notizie d'ufficio. Teniamo le
//     ordinanze che toccano Bassano del Grappa, Romano d'Ezzelino, Cassola, Rosà,
//     Pove del Grappa, Marostica, Nove, Cartigliano, Solagna, Mussolente, degli
//     ultimi 120 giorni, al massimo 10, senza quelle con il periodo dei lavori già
//     finito. Tipo 'ordinanza'.
//
// Le regole stanno in scripts/lib/avvisi.mjs (funzioni pure, con test).
//
// Se una fonte non risponde:
//   - Vi.abilità: restano le ordinanze della fotografia precedente che valgono ancora
//     (ultimi 120 giorni), così non spariscono dal sito ordinanze in vigore;
//   - CCISS: gli eventi vecchi non si conservano (non direbbero più nulla di certo) e
//     CCISS esce dall'elenco "fonti", così la scheda può dire che mancano.
// In tutti e due i casi il file viene scritto ma lo script esce con codice 2, perché
// chi lo lancia (anche in automatico) se ne accorga. Se non rispondono tutte e due lo
// script esce con codice 1 e non tocca il file esistente.
// Solo moduli interni di Node.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FONTE_CCISS,
  FONTE_VIABILITA,
  controllaVoci,
  filtraCciss,
  filtraViabilita,
  leggiRss,
  ordinanzePrecedenti,
  unisciAvvisi,
} from './lib/avvisi.mjs';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const USCITA = join(RADICE, 'public', 'data', 'avvisi.json');

const URL_CCISS = 'https://www.cciss.it/rss';
const URL_VIABILITA = 'https://vi-abilita.it/feed/';
const INTESTAZIONI = {
  'User-Agent': 'bassano-aperta/0.1 (progetto civico open source)',
  Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
};

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

/** Scarica un feed: un tentativo, più uno solo di riserva dopo qualche secondo. */
async function scaricaFeed(url) {
  let ultimo;
  for (let i = 0; i < 2; i++) {
    if (i > 0) await pausa(5000);
    try {
      const r = await fetch(url, { headers: INTESTAZIONI, signal: AbortSignal.timeout(45_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const testo = await r.text();
      if (!/<rss[\s>]/i.test(testo) && !/<channel[\s>]/i.test(testo)) throw new Error('la risposta non è un feed RSS');
      return testo;
    } catch (e) {
      ultimo = e;
      console.error(`[avvisi] ${url}: ${e.message}`);
    }
  }
  throw new Error(`non riesco a scaricare ${url}: ${ultimo.message}`);
}

/** Scarica e filtra una fonte. Restituisce null se la fonte non risponde. */
async function leggiFonte(fonte, url, filtra) {
  try {
    const voci = controllaVoci(leggiRss(await scaricaFeed(url)));
    const avvisi = filtra(voci);
    console.log(`[avvisi] ${fonte.nome}: ${voci.length} voci lette, ${avvisi.length} tenute`);
    return avvisi;
  } catch (e) {
    console.error(`[avvisi] ${fonte.nome} non disponibile: ${e.message}`);
    return null;
  }
}

/** La fotografia precedente, se c'è e si legge. */
async function fotografiaPrecedente() {
  try {
    return JSON.parse(await readFile(USCITA, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const adesso = new Date();
  const [cciss, lette] = await Promise.all([
    leggiFonte(FONTE_CCISS, URL_CCISS, filtraCciss),
    leggiFonte(FONTE_VIABILITA, URL_VIABILITA, (voci) => filtraViabilita(voci, adesso)),
  ]);

  if (cciss === null && lette === null) {
    throw new Error('Nessuna delle due fonti ha risposto: lascio il file esistente com\'è');
  }

  const problemi = [];
  let viabilita = lette;
  if (lette === null) {
    const vecchia = await fotografiaPrecedente();
    const eraLetta = Array.isArray(vecchia?.fonti) && vecchia.fonti.some((f) => f?.nome === FONTE_VIABILITA.nome);
    if (eraLetta) {
      viabilita = ordinanzePrecedenti(vecchia, adesso);
      problemi.push(
        `Vi.abilità non ha risposto: tengo le ${viabilita.length} ordinanze della fotografia del ${String(vecchia.generato).slice(0, 10)} che valgono ancora. Potrebbero mancare ordinanze nuove.`,
      );
    } else {
      problemi.push('Vi.abilità non ha risposto e non c\'è una fotografia precedente da cui tenere le ordinanze: il file esce senza ordinanze.');
    }
  }
  if (cciss === null) problemi.push('CCISS non ha risposto: il file esce senza eventi di traffico.');

  // In "fonti" finiscono solo le fonti di cui la fotografia contiene davvero i dati.
  const fonti = [];
  if (cciss !== null) fonti.push(FONTE_CCISS);
  if (viabilita !== null) fonti.push(FONTE_VIABILITA);

  const uscita = {
    generato: adesso.toISOString(),
    fonti,
    avvisi: unisciAvvisi(cciss ?? [], viabilita ?? []),
  };

  await mkdir(dirname(USCITA), { recursive: true });
  const provvisorio = USCITA + '.tmp';
  await writeFile(provvisorio, JSON.stringify(uscita, null, 2) + '\n');
  await rename(provvisorio, USCITA);

  console.log(`Scritto ${USCITA}: ${uscita.avvisi.length} avvisi`);
  for (const a of uscita.avvisi) console.log(`  ${a.quando.slice(0, 10)} [${a.tipo}] ${a.strada}`);

  if (problemi.length > 0) {
    for (const p of problemi) console.error(`\nATTENZIONE: ${p}`);
    console.error('\nLa fotografia è incompleta: rilancia lo script più tardi.');
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(`\nERRORE: ${e.message}`);
  process.exit(1);
});
