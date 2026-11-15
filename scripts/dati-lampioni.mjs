#!/usr/bin/env node
// Lampioni della mappa di notte: scrive public/data/lampioni.json
// (tipo DatiLampioni in src/types.ts), con le coordinate in metri locali.
//
// 1. Scarica da OpenStreetMap (Overpass API) i lampioni rilevati davvero nel
//    riquadro (highway=street_lamp): sono i "veri".
// 2. Legge public/data/base.json e, dove OpenStreetMap non ha lampioni, ne
//    dispone altri lungo le strade: sono illustrativi, servono a far leggere
//    la città dalle sue strade e il file lo dichiara in `fonte`.
//
// Uso:   node scripts/dati-lampioni.mjs      (dopo scripts/dati-osm.mjs)
// Opzione per chi sviluppa: OSM_CACHE=<cartella> salva lì la risposta di
// Overpass e la riusa alla corsa successiva, senza riscaricare.
//
// Se Overpass non risponde lo script tiene i lampioni veri del lampioni.json
// che c'è già (i primi `veri` punti) e lo dice chiaro. Solo se un file
// precedente con lampioni veri non esiste prosegue con zero veri: non ne
// inventa. Se invece manca base.json, o i controlli falliscono, esce con
// codice diverso da zero e non tocca il file esistente.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RIQUADRO, inMetri, riquadroInMetri } from './lib/geo.mjs';
import {
  ORDINE_TIPI,
  PREDEFINITE,
  creaIndicePoligoni,
  disponiLampioni,
  distanzaPiuPiccola,
  piatto,
  preparaVeri,
  veriDelFile,
} from './lib/lampioni.mjs';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(RADICE, 'public', 'data', 'base.json');
const USCITA = join(RADICE, 'public', 'data', 'lampioni.json');
const CACHE = process.env.OSM_CACHE || null;

const SPECCHI = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const INTESTAZIONI = {
  'User-Agent': 'bassano-aperta/0.1 (progetto civico open source)',
  Accept: 'application/json',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
};
const GIRI = 2; // quante volte si riprova l'intero elenco di specchi
const ATTESA_MS = 90_000; // l'interrogazione è piccola: se non arriva in fretta non arriva

// Quanti lampioni in tutto ci si aspetta: abbastanza per leggere le strade,
// non così tanti da appesantire la mappa.
const MINIMO = 4000;
const MASSIMO = 9000;

const R = riquadroInMetri();
const BBOX = `${RIQUADRO.sud},${RIQUADRO.ovest},${RIQUADRO.nord},${RIQUADRO.est}`;
const INTERROGAZIONE = `[out:json][timeout:60][bbox:${BBOX}];node[highway=street_lamp];out skel qt;`;

const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function chiediOverpass(nome, interrogazione) {
  if (CACHE) {
    try {
      const dati = JSON.parse(await readFile(join(CACHE, `${nome}.json`), 'utf8'));
      console.log(`  ${nome}: ${dati.elements.length} elementi (dalla cache ${CACHE})`);
      return dati.elements;
    } catch {
      // niente cache: si scarica
    }
  }
  const errori = [];
  for (let giro = 1; giro <= GIRI; giro++) {
    for (const specchio of SPECCHI) {
      const host = new URL(specchio).host;
      const inizio = Date.now();
      try {
        const risposta = await fetch(specchio, {
          method: 'POST',
          headers: INTESTAZIONI,
          body: 'data=' + encodeURIComponent(interrogazione),
          signal: AbortSignal.timeout(ATTESA_MS),
        });
        if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`);
        const testo = await risposta.text();
        let dati;
        try {
          dati = JSON.parse(testo);
        } catch {
          throw new Error(`risposta non JSON: ${testo.slice(0, 120).replace(/\s+/g, ' ')}`);
        }
        if (!Array.isArray(dati.elements)) throw new Error('risposta senza "elements"');
        // Overpass segnala timeout e memoria esaurita con un "remark" e dati parziali.
        if (dati.remark) throw new Error(`risposta incompleta: ${dati.remark}`);
        const secondi = ((Date.now() - inizio) / 1000).toFixed(1);
        console.log(`  ${nome}: ${dati.elements.length} elementi da ${host} in ${secondi} s`);
        if (CACHE) {
          await mkdir(CACHE, { recursive: true });
          await writeFile(join(CACHE, `${nome}.json`), testo);
        }
        return dati.elements;
      } catch (errore) {
        const messaggio = `${host}: ${errore.message}`;
        errori.push(messaggio);
        console.warn(`  ${nome}: tentativo fallito (${messaggio})`);
        await pausa(2000 * giro);
      }
    }
    if (giro < GIRI) await pausa(8000 * giro);
  }
  throw new Error(`Overpass non ha risposto per "${nome}" dopo ${errori.length} tentativi`);
}

function controlla(dati, illustrativi) {
  const problemi = [];
  const p = dati.p;
  if (p.length % 2 !== 0) problemi.push('array di coordinate di lunghezza dispari');
  if (!Number.isInteger(dati.veri) || dati.veri < 0 || dati.veri * 2 > p.length) problemi.push(`"veri" non torna: ${dati.veri}`);
  let fuori = 0;
  let nonDecimi = 0;
  for (let i = 0; i < p.length; i += 2) {
    const x = p[i];
    const y = p[i + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < R.minX || x > R.maxX || y < R.minY || y > R.maxY) fuori++;
    if (Math.round(x * 10) / 10 !== x || Math.round(y * 10) / 10 !== y) nonDecimi++;
  }
  if (fuori) problemi.push(`${fuori} lampioni fuori dal riquadro o non numerici`);
  if (nonDecimi) problemi.push(`${nonDecimi} coordinate non arrotondate a 0.1 m`);
  const totale = p.length / 2;
  if (totale < MINIMO || totale > MASSIMO) problemi.push(`${totale} lampioni in tutto: attesi tra ${MINIMO} e ${MASSIMO}`);
  const vicini = distanzaPiuPiccola(illustrativi);
  if (vicini < PREDEFINITE.distanzaMinima) problemi.push(`due lampioni illustrativi a soli ${vicini.toFixed(1)} m`);
  if (problemi.length) throw new Error('Controlli falliti:\n    - ' + problemi.join('\n    - '));
}

async function principale() {
  console.log('Bassano Aperta, lampioni');
  console.log(`Riquadro: ${BBOX} (sud, ovest, nord, est)`);

  console.log('\n1. Lampioni veri da OpenStreetMap');
  let veri = [];
  let overpassRiuscito = true;
  let riusati = false;
  try {
    const nodi = await chiediOverpass('lampioni', INTERROGAZIONE);
    const grezzi = nodi
      .filter((n) => n.type === 'node' && Number.isFinite(n.lon) && Number.isFinite(n.lat))
      .map((n) => inMetri(n.lon, n.lat));
    veri = preparaVeri(grezzi, R);
    console.log(`  veri: ${veri.length} (highway=street_lamp nel riquadro, su ${grezzi.length} nodi ricevuti)`);
  } catch (errore) {
    overpassRiuscito = false;
    console.warn(`  ATTENZIONE: ${errore.message}`);
    let precedenti = [];
    try {
      precedenti = veriDelFile(JSON.parse(await readFile(USCITA, 'utf8')));
    } catch {
      // nessun file precedente, o non leggibile
    }
    veri = preparaVeri(precedenti, R);
    if (veri.length > 0) {
      riusati = true;
      console.warn(`  Tengo i ${veri.length} lampioni veri del file che c'è già: non vanno persi.`);
    } else {
      console.warn('  Non c\'è un file precedente con lampioni veri: nel file ci saranno solo quelli illustrativi.');
    }
    console.log(`  veri: ${veri.length}`);
  }

  console.log('\n2. Strade, acqua ed edifici da base.json');
  let base;
  try {
    base = JSON.parse(await readFile(BASE, 'utf8'));
  } catch (errore) {
    throw new Error(`non riesco a leggere ${BASE} (${errore.message}). Prima va eseguito: node scripts/dati-osm.mjs`);
  }
  const strade = base.strade.filter((s) => ORDINE_TIPI.includes(s.t));
  const acque = base.aree.filter((a) => a.t === 'acqua').map((a) => a.p);
  const buie = base.aree.filter((a) => a.t === 'coltivo' || a.t === 'bosco').map((a) => a.p);
  const piazze = base.aree.filter((a) => a.t === 'piazza').map((a) => a.p);
  console.log(
    `  ${strade.length} strade (senza le ${base.strade.length - strade.length} di ferrovia), ` +
      `${acque.length} specchi d'acqua, ${base.edifici.length} edifici, ${buie.length} campi e boschi, ${piazze.length} piazze`,
  );

  console.log('\n3. Lampioni illustrativi lungo le strade');
  const esito = disponiLampioni(strade, {
    veri,
    riquadro: R,
    piazze,
    inAcqua: creaIndicePoligoni(acque),
    suEdificio: creaIndicePoligoni(base.edifici.map((e) => e.p)),
    alBuio: creaIndicePoligoni(buie),
  });
  const illustrativi = esito.punti;
  console.log(
    `  illustrativi: ${illustrativi.length} (${ORDINE_TIPI.map((t) => `${t} ${esito.perTipo[t]}`).join(', ')}, piazze ${esito.perTipo.piazza})`,
  );
  const s = esito.scartati;
  console.log(
    `  posti lasciati vuoti: ${s.vicini} con un lampione già entro ${PREDEFINITE.distanzaMinima} m, ` +
      `${s.buio} tra campi e boschi, ${s.edifici} su edifici, ${s.acqua} in acqua, ${s.fuori} fuori riquadro; ` +
      `${s.corte} strade troppo corte`,
  );

  const dati = {
    generato: new Date().toISOString(),
    fonte:
      veri.length > 0
        ? `I primi ${veri.length} lampioni sono rilevati: © OpenStreetMap contributors, licenza ODbL 1.0. ` +
          'Gli altri sono disposti lungo le strade e sul bordo delle piazze a scopo illustrativo, non rilevati uno per uno.'
        : 'Lampioni disposti lungo le strade e sul bordo delle piazze a scopo illustrativo, non rilevati uno per uno. ' +
          'Strade: © OpenStreetMap contributors, licenza ODbL 1.0.',
    veri: veri.length,
    p: piatto([...veri, ...illustrativi]),
  };

  console.log('\n4. Controlli');
  controlla(dati, illustrativi);
  console.log(`  ${dati.p.length / 2} lampioni in tutto, tutti nel riquadro, illustrativi mai a meno di ${PREDEFINITE.distanzaMinima} m tra loro`);

  const testo = JSON.stringify(dati);
  await mkdir(dirname(USCITA), { recursive: true });
  const provvisorio = USCITA + '.tmp';
  await writeFile(provvisorio, testo);
  await rename(provvisorio, USCITA);
  console.log(`\nScritto ${USCITA}: ${(Buffer.byteLength(testo) / 1000).toFixed(1)} kB`);
  console.log(`veri: ${dati.veri}, illustrativi: ${illustrativi.length}, totale: ${dati.p.length / 2}`);
  if (riusati) console.log('Nota: Overpass non ha risposto. I lampioni veri sono quelli del file precedente; riprovare più tardi per aggiornarli.');
  else if (!overpassRiuscito) console.log('Nota: Overpass non ha risposto e non c\'era un file precedente con lampioni veri, quindi veri: 0. Riprovare più tardi.');
}

principale().catch((errore) => {
  console.error(`\nERRORE: ${errore.message}`);
  console.error('lampioni.json non è stato modificato.');
  process.exit(1);
});
