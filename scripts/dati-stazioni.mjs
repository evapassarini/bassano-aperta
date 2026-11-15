#!/usr/bin/env node
// Tabella dei nomi delle stazioni dei treni: serve a dire da dove viene e dove va
// un treno che passa da Bassano (il feed in diretta dà solo i codici delle fermate).
// Scrive public/data/stazioni-treni.json:
//   { "generato": ISO, "fonte": { nome, url, licenza }, "stazioni": { "02520": "Bassano del Grappa", ... } }
//
// Uso:   node scripts/dati-stazioni.mjs
//
// Si lancia di rado (quando cambiano gli orari): scarica l'intero archivio GTFS
// di BusOne (circa 25 MB) in una cartella provvisoria, ne legge solo stops.txt
// con il comando di sistema "unzip -p" e poi cancella tutto. Non fa parte di
// "npm run dati".
//
// Termini di BusOne: gratuito per usi non commerciali di privati ed enti non
// profit, con attribuzione "BusOne (busone.app) e fonte originale"; il servizio
// può essere revocato. Ogni richiesta dichiara chi siamo con le intestazioni
// X-BusOne-Client e X-BusOne-Use.
//
// Le regole (quali righe tenere, come scrivere i nomi) stanno in
// scripts/lib/stazioni.mjs. Solo moduli interni di Node. Se qualcosa va storto lo
// script esce con errore e non tocca il file esistente.

import { execFile } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { stazioniDaStops } from './lib/stazioni.mjs';

const esegui = promisify(execFile);

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const USCITA = join(RADICE, 'public', 'data', 'stazioni-treni.json');

const URL_GTFS = 'https://proxy.busone.app/trenitalia/gtfs.zip';
const INTESTAZIONI = {
  'User-Agent': 'bassano-aperta/0.1 (progetto civico open source)',
  // Il contatto del progetto è l'indirizzo del repository. Stesso valore in src/live/index.ts.
  'X-BusOne-Client': 'bassano-aperta (progetto civico open source; https://github.com/evapassarini/bassano-aperta)',
  'X-BusOne-Use': 'personal',
};

/** Stazioni che devono esserci per forza: se mancano, il file di origine è cambiato. */
const DI_CONTROLLO = ['02520', '02593'];

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function scaricaSuFile(url, destinazione) {
  let ultimo;
  for (let i = 0; i < 2; i++) {
    if (i > 0) await pausa(5000);
    try {
      const r = await fetch(url, { headers: INTESTAZIONI, signal: AbortSignal.timeout(300_000) });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      await pipeline(Readable.fromWeb(r.body), createWriteStream(destinazione));
      const { size } = await stat(destinazione);
      if (size < 100_000) throw new Error(`archivio troppo piccolo (${size} byte)`);
      return size;
    } catch (e) {
      ultimo = e;
      console.error(`[stazioni] ${url}: ${e.message}`);
    }
  }
  throw new Error(`Non riesco a scaricare ${url}: ${ultimo.message}`);
}

async function main() {
  const cartella = await mkdtemp(join(tmpdir(), 'bassano-aperta-gtfs-'));
  let stazioni;
  try {
    const archivio = join(cartella, 'gtfs.zip');
    console.log(`[stazioni] scarico ${URL_GTFS} ...`);
    const byte = await scaricaSuFile(URL_GTFS, archivio);
    console.log(`[stazioni] scaricati ${(byte / 1e6).toFixed(1)} MB, leggo stops.txt`);
    let testo;
    try {
      // Senza shell: il percorso passa come argomento, non viene interpretato.
      ({ stdout: testo } = await esegui('unzip', ['-p', archivio, 'stops.txt'], {
        maxBuffer: 256 * 1024 * 1024,
        encoding: 'utf8',
      }));
    } catch (e) {
      throw new Error(`Non riesco a estrarre stops.txt con "unzip -p": ${e.message}`);
    }
    stazioni = stazioniDaStops(testo);
  } finally {
    await rm(cartella, { recursive: true, force: true });
  }

  const quante = Object.keys(stazioni).length;
  if (quante < 50) throw new Error(`Solo ${quante} stazioni nel riquadro: non scrivo una tabella monca`);
  for (const codice of DI_CONTROLLO) {
    if (!stazioni[codice]) throw new Error(`Manca la stazione ${codice}: i codici sono cambiati?`);
  }

  const uscita = {
    generato: new Date().toISOString(),
    fonte: {
      nome: 'BusOne (busone.app), dagli orari pubblicati da Trenitalia',
      url: URL_GTFS,
      licenza: 'Uso gratuito non commerciale secondo i termini di BusOne, con attribuzione a BusOne (busone.app) e alla fonte originale',
    },
    stazioni,
  };

  await mkdir(dirname(USCITA), { recursive: true });
  const provvisorio = USCITA + '.tmp';
  await writeFile(provvisorio, JSON.stringify(uscita, null, 1) + '\n');
  await rename(provvisorio, USCITA);

  console.log(`Scritto ${USCITA}: ${quante} stazioni`);
  for (const codice of DI_CONTROLLO) console.log(`  ${codice}: ${stazioni[codice]}`);
}

main().catch((e) => {
  console.error(`\nERRORE: ${e.message}`);
  process.exit(1);
});
