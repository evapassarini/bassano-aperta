#!/usr/bin/env node
// Dati di base della mappa: scarica da OpenStreetMap (Overpass API) edifici,
// strade, acqua, verde e alberi del riquadro e scrive public/data/base.json
// (tipo DatiBase in src/types.ts), con le coordinate già in metri locali.
//
// Uso:   node scripts/dati-osm.mjs
// Opzione per chi sviluppa: OSM_CACHE=<cartella> salva lì le risposte di
// Overpass e le riusa alla corsa successiva, senza riscaricare.
//
// Se qualcosa va storto lo script esce con codice diverso da zero e non
// tocca il base.json esistente.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { passoAlberi, puntiDiGriglia, TETTO_ALBERI } from './lib/alberi.mjs';
import { togliDoppioni } from './lib/doppioni.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RIQUADRO, // stessi numeri di RIQUADRO in src/types.ts
  allargaLinea,
  antiorario,
  appiattisci,
  apriAnello,
  area,
  campionaLinea,
  casuale,
  centroide,
  daPiatto,
  distanzaDaAnello,
  inMetri,
  limiti,
  lunghezza,
  puntoInPoligono,
  riquadroInMetri,
  ritagliaLinea,
  ritagliaPoligono,
  semplificaAnello,
  semplificaLinea,
} from './lib/geo.mjs';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const USCITA = join(RADICE, 'public', 'data', 'base.json');
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
const GIRI = 3; // quante volte si riprova l'intero elenco di specchi
const ATTESA_MS = 300_000; // tempo massimo per una risposta

const TOLLERANZA_EDIFICI = 0.4; // metri, Douglas-Peucker
const TOLLERANZA_STRADE = 1.5;
const TOLLERANZA_AREE = 1.5;
const AREA_MINIMA_EDIFICIO = 12; // m²
const AREA_MINIMA = { acqua: 15, parco: 60, bosco: 150, prato: 120, piazza: 40, coltivo: 400 };
const RAGGIO_CENTRO = 400; // metri da Piazza Libertà: centro storico, edifici più alti
const RAGGIO_PEDONALE = 800; // i vialetti (footway) si tengono solo entro questo raggio
const QUOTA_ALBERI_VERI = 4500;

// Ponte Vecchio: serve per il controllo finale.
const PONTE_VECCHIO = inMetri(11.7311, 45.7675);

const R = riquadroInMetri();

// ---------------------------------------------------------------------------
// Overpass
// ---------------------------------------------------------------------------

const BBOX = `${RIQUADRO.sud},${RIQUADRO.ovest},${RIQUADRO.nord},${RIQUADRO.est}`;
const TESTA = `[out:json][timeout:180][maxsize:536870912][bbox:${BBOX}];`;

const INTERROGAZIONI = {
  edifici: `${TESTA}(way[building];relation[building][type=multipolygon];);out body geom qt;`,
  strade: `${TESTA}(way[highway];way[railway=rail];);out body geom qt;`,
  aree: `${TESTA}(
    way[natural~"^(water|wood|grassland|scrub|heath)$"];
    relation[type=multipolygon][natural~"^(water|wood|grassland|scrub|heath)$"];
    way[waterway~"^(river|canal|riverbank)$"];
    relation[type=multipolygon][waterway=riverbank];
    way[landuse~"^(reservoir|basin|forest|grass|meadow|village_green|recreation_ground|farmland|vineyard|orchard|plant_nursery|allotments|industrial)$"];
    relation[type=multipolygon][landuse~"^(reservoir|basin|forest|grass|meadow|village_green|recreation_ground|farmland|vineyard|orchard|plant_nursery|allotments|industrial)$"];
    way[leisure~"^(park|garden|playground|dog_park|pitch)$"];
    relation[type=multipolygon][leisure~"^(park|garden|playground|dog_park|pitch)$"];
    way[place=square];
    relation[type=multipolygon][place=square];
    way[highway=pedestrian][area=yes];
    relation[type=multipolygon][highway=pedestrian];
  );out body geom qt;`,
  alberi: `${TESTA}node[natural=tree];out skel qt;`,
};

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
        console.log(`  ${nome}: ${dati.elements.length} elementi da ${host} in ${secondi} s (${(testo.length / 1e6).toFixed(1)} MB)`);
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
    if (giro < GIRI) await pausa(10_000 * giro);
  }
  throw new Error(`Overpass non ha risposto per "${nome}" dopo ${errori.length} tentativi:\n    ${errori.join('\n    ')}`);
}

// ---------------------------------------------------------------------------
// Da elementi OSM a geometrie in metri
// ---------------------------------------------------------------------------

const metri = (geometria) => geometria.map((g) => inMetri(g.lon, g.lat));
const stessoPunto = (a, b) => a.lat === b.lat && a.lon === b.lon;

/** Anelli esterni di una relazione multipoligono, ricuciti dai pezzi. */
function anelliEsterni(relazione) {
  const pezzi = (relazione.members || [])
    .filter((m) => m.type === 'way' && m.role !== 'inner' && Array.isArray(m.geometry) && m.geometry.length >= 2)
    .map((m) => m.geometry.filter(Boolean));
  const anelli = [];
  while (pezzi.length) {
    let corrente = pezzi.pop().slice();
    for (;;) {
      if (corrente.length >= 4 && stessoPunto(corrente[0], corrente[corrente.length - 1])) {
        anelli.push(corrente);
        break;
      }
      const fine = corrente[corrente.length - 1];
      const i = pezzi.findIndex((p) => stessoPunto(p[0], fine) || stessoPunto(p[p.length - 1], fine));
      if (i === -1) break; // anello che non si chiude: si scarta
      const [pezzo] = pezzi.splice(i, 1);
      const daUnire = stessoPunto(pezzo[0], fine) ? pezzo : pezzo.slice().reverse();
      corrente = corrente.concat(daUnire.slice(1));
    }
  }
  return anelli;
}

/** Anelli (in metri, senza punto di chiusura) di una way chiusa o di una relazione. */
function anelliDi(elemento) {
  if (elemento.type === 'way') {
    const g = elemento.geometry;
    if (!g || g.length < 4 || !stessoPunto(g[0], g[g.length - 1])) return [];
    return [apriAnello(metri(g))];
  }
  if (elemento.type === 'relation') return anelliEsterni(elemento).map((a) => apriAnello(metri(a)));
  return [];
}

const dentroRiquadro = ([x, y]) => x >= R.minX && x <= R.maxX && y >= R.minY && y <= R.maxY;
const distanzaDalCentro = ([x, y]) => Math.hypot(x, y);

// ---------------------------------------------------------------------------
// Edifici
// ---------------------------------------------------------------------------

const CHIESE = new Set(['church', 'cathedral', 'chapel', 'basilica', 'temple', 'monastery', 'religious', 'convent', 'shrine']);
const TORRI = new Set(['tower', 'bell_tower', 'campanile', 'water_tower', 'chimney']);
const INDUSTRIE = new Set(['industrial', 'warehouse', 'manufacture', 'factory', 'hangar', 'storage_tank', 'silo']);
const PUBBLICI = new Set([
  'school', 'university', 'college', 'kindergarten', 'hospital', 'public', 'civic', 'government',
  'train_station', 'museum', 'library', 'townhall', 'fire_station', 'sports_hall', 'stadium', 'theatre',
  'castle', 'sport', 'grandstand', 'pavilion',
]);
const SERVIZI_PUBBLICI = new Set([
  'school', 'university', 'college', 'kindergarten', 'hospital', 'townhall', 'library', 'theatre',
  'courthouse', 'police', 'fire_station', 'community_centre', 'arts_centre', 'post_office',
]);
const CASE = new Set([
  'yes', 'house', 'residential', 'apartments', 'detached', 'semidetached_house', 'terrace', 'villa',
  'farm', 'farmhouse', 'bungalow', 'dormitory',
]);
const MINORI = new Set([
  'garage', 'garages', 'shed', 'hut', 'roof', 'carport', 'greenhouse', 'kiosk', 'service', 'cabin',
  'toilets', 'farm_auxiliary', 'barn', 'stable', 'sty', 'cowshed', 'container', 'transformer_tower', 'ruins',
]);

function tipoEdificio(tags, superficie, inZonaIndustriale) {
  const b = tags.building;
  if (TORRI.has(b) || tags.man_made === 'tower' || tags.man_made === 'campanile') return 'torre';
  if (CHIESE.has(b) || tags.amenity === 'place_of_worship') return 'chiesa';
  if (INDUSTRIE.has(b)) return 'industria';
  if (PUBBLICI.has(b) || SERVIZI_PUBBLICI.has(tags.amenity) || tags.tourism === 'museum') return 'pubblico';
  if (b === 'yes' && inZonaIndustriale && superficie >= 150) return 'industria';
  if (CASE.has(b)) return 'casa';
  return 'altro';
}

function numero(testo) {
  if (typeof testo !== 'string') return null;
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(m|metri|meters?)?\s*$/i.exec(testo);
  if (!m) return null;
  const v = Number(m[1].replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

/** Altezza: da OSM se c'è, altrimenti stima stabile (dipende solo da tipo, superficie, zona e id). */
function altezzaEdificio(tags, tipo, superficie, inCentro, id) {
  const dichiarata = numero(tags.height);
  if (dichiarata !== null && dichiarata >= 2 && dichiarata <= 150) return dichiarata;
  const piani = numero(tags['building:levels']);
  if (piani !== null && piani >= 1 && piani <= 40) return piani * 3.2;

  const r = casuale(id);
  const tra = (min, max) => min + r * (max - min);
  const b = tags.building;
  if (tipo === 'torre') return superficie < 20 ? tra(8, 14) : tra(20, 32);
  if (tipo === 'chiesa') return b === 'chapel' || b === 'shrine' || superficie < 120 ? tra(6, 9) : tra(14, 22);
  if (tipo === 'industria') return tra(7, 10);
  if (MINORI.has(b) || superficie < 25) return tra(2.6, 3.8);
  if (tipo === 'pubblico') return tra(9, 14);
  if (inCentro) return superficie < 50 ? tra(6, 9) : tra(10, 15);
  if (b === 'apartments') return tra(10, 16);
  if (tipo === 'casa') return superficie > 350 ? tra(8, 12) : tra(6, 11);
  return tra(6, 11); // commercio, uffici, alberghi e simili
}

function costruisciEdifici(elementi, zoneIndustriali) {
  const edifici = [];
  const scartati = { piccoli: 0, fuori: 0, degeneri: 0, sotterranei: 0, doppioni: 0 };
  const conAltezzaVera = { n: 0 };
  for (const e of elementi) {
    const tags = e.tags || {};
    if (!tags.building || tags.building === 'no') continue;
    if (tags.location === 'underground') {
      scartati.sotterranei++;
      continue;
    }
    for (const anello of anelliDi(e)) {
      if (anello.length < 3) continue;
      const superficie = area(anello);
      if (superficie < AREA_MINIMA_EDIFICIO) {
        scartati.piccoli++;
        continue;
      }
      const centro = centroide(anello);
      if (!dentroRiquadro(centro)) {
        scartati.fuori++;
        continue;
      }
      const ritagliato = ritagliaPoligono(anello, R);
      const semplice = antiorario(semplificaAnello(ritagliato, TOLLERANZA_EDIFICI));
      const p = appiattisci(semplice, true);
      if (p.length < 6 || area(daPiatto(p)) < AREA_MINIMA_EDIFICIO) {
        scartati.degeneri++;
        continue;
      }
      const inZona = zoneIndustriali.some((z) => dentroLimiti(centro, z.limiti) && puntoInPoligono(centro, z.anello));
      const t = tipoEdificio(tags, superficie, inZona);
      const inCentro = distanzaDalCentro(centro) <= RAGGIO_CENTRO;
      const h = Math.round(altezzaEdificio(tags, t, superficie, inCentro, e.id) * 10) / 10;
      if (numero(tags.height) !== null || numero(tags['building:levels']) !== null) conAltezzaVera.n++;
      const edificio = { p, h, t };
      if (tags.name) edificio.n = tags.name.trim();
      const altezzaVera = numero(tags.height) !== null || numero(tags['building:levels']) !== null;
      edifici.push({ id: e.id, edificio, altezzaVera });
    }
  }
  edifici.sort((a, b) => a.id - b.id);
  // Lo stesso edificio rilevato due volte: resta quello con il nome o con l'altezza vera.
  const senzaDoppi = togliDoppioni(
    edifici.map((x) => x.edificio),
    (i) => edifici[i].altezzaVera,
  );
  scartati.doppioni = senzaDoppi.tolti;
  return { edifici: senzaDoppi.edifici, scartati, conAltezzaVera: conAltezzaVera.n };
}

const dentroLimiti = ([x, y], l) => x >= l.minX && x <= l.maxX && y >= l.minY && y <= l.maxY;

// ---------------------------------------------------------------------------
// Strade
// ---------------------------------------------------------------------------

const TIPI_STRADA = {
  motorway: 'principale', trunk: 'principale', primary: 'principale', secondary: 'principale',
  tertiary: 'secondaria', unclassified: 'secondaria',
  residential: 'locale', living_street: 'locale', service: 'locale', track: 'locale', road: 'locale',
  pedestrian: 'pedonale', footway: 'pedonale', path: 'pedonale', cycleway: 'pedonale', steps: 'pedonale',
};
const SERVIZI_DA_SCARTARE = new Set(['driveway', 'parking_aisle', 'drive-through', 'emergency_access', 'slipway']);
const VIALETTI_DA_SCARTARE = new Set(['sidewalk', 'crossing', 'traffic_island', 'link']);

function costruisciStrade(elementi) {
  const strade = [];
  const scartate = { tipo: 0, frammenti: 0, gallerie: 0, fuori: 0 };
  for (const e of elementi) {
    const tags = e.tags || {};
    if (e.type !== 'way' || !e.geometry || e.geometry.length < 2) continue;
    const ponte = tags.bridge !== undefined && tags.bridge !== 'no';
    let t;
    let linea = metri(e.geometry);
    const lunga = lunghezza(linea);

    if (tags.railway === 'rail') {
      if (tags.tunnel && tags.tunnel !== 'no') {
        scartate.gallerie++;
        continue;
      }
      t = 'ferrovia';
    } else {
      const classe = (tags.highway || '').replace(/_link$/, '');
      t = TIPI_STRADA[classe];
      if (!t) {
        scartate.tipo++;
        continue;
      }
      // Le piazze pedonali disegnate come superfici vanno tra le aree, non tra le strade.
      if (classe === 'pedestrian' && tags.area === 'yes') continue;
      // I sottopassi stradali e pedonali restano: toglierli lascerebbe buchi nelle vie.
      if (!ponte) {
        const privata = tags.access === 'private' || tags.access === 'no';
        let frammento = false;
        if (classe === 'service') {
          frammento = SERVIZI_DA_SCARTARE.has(tags.service) || privata || (!tags.name && lunga < 40);
        } else if (classe === 'footway') {
          const vicina = distanzaDalCentro(centroide(linea)) <= RAGGIO_PEDONALE;
          frammento = VIALETTI_DA_SCARTARE.has(tags.footway) || !vicina || privata || lunga < 12;
        } else if (classe === 'path' || classe === 'cycleway' || classe === 'steps') {
          frammento = privata || lunga < 15;
        } else if (classe === 'track') {
          frammento = privata || lunga < 40;
        }
        if (frammento) {
          scartate.frammenti++;
          continue;
        }
      }
    }

    const pezzi = ritagliaLinea(linea, R);
    if (pezzi.length === 0) scartate.fuori++;
    for (const pezzo of pezzi) {
      const p = appiattisci(semplificaLinea(pezzo, TOLLERANZA_STRADE));
      if (p.length < 4) continue;
      const strada = { p, t };
      if (ponte) strada.ponte = true;
      strade.push({ id: e.id, strada });
    }
  }
  strade.sort((a, b) => a.id - b.id);
  return { strade: strade.map((x) => x.strada), scartate };
}

// ---------------------------------------------------------------------------
// Aree
// ---------------------------------------------------------------------------

const PRATI_SPORTIVI = new Set(['soccer', 'rugby', 'rugby_union', 'baseball', 'softball', 'american_football']);

function tipoArea(tags) {
  if (tags.natural === 'water' || tags.waterway === 'riverbank' || tags.landuse === 'reservoir' || tags.landuse === 'basin') {
    if (tags.tunnel || tags.covered === 'yes' || tags.location === 'underground') return null;
    return 'acqua';
  }
  if (tags.place === 'square' || tags.highway === 'pedestrian') return 'piazza';
  if (['park', 'garden', 'playground', 'dog_park'].includes(tags.leisure)) return 'parco';
  if (tags.landuse === 'recreation_ground' || tags.landuse === 'village_green') return 'parco';
  if (tags.natural === 'wood' || tags.landuse === 'forest') return 'bosco';
  if (['grass', 'meadow'].includes(tags.landuse) || ['grassland', 'scrub', 'heath'].includes(tags.natural)) return 'prato';
  if (tags.leisure === 'pitch') return PRATI_SPORTIVI.has(tags.sport) || tags.surface === 'grass' ? 'prato' : null;
  if (['farmland', 'vineyard', 'orchard', 'plant_nursery', 'allotments'].includes(tags.landuse)) return 'coltivo';
  return null;
}

/**
 * Corsi d'acqua disegnati in OSM solo come linea: dove la linea non cade già
 * dentro un poligono d'acqua la si allarga in un poligono. Così il fiume è
 * continuo anche se a qualcuno è sfuggito un tratto di sponda.
 */
function riempiCorsi(linee, acque, raggioDi, lunghezzaMinima) {
  const nuovi = [];
  let coperti = 0;
  let totali = 0;
  const PASSO = 8;
  for (const linea of linee) {
    for (const pezzo of ritagliaLinea(linea, R)) {
      const campioni = campionaLinea(pezzo, PASSO);
      const dentro = campioni.map((c) => acque.some((a) => dentroLimiti(c, a.limiti) && puntoInPoligono(c, a.anello)));
      totali += campioni.length;
      coperti += dentro.filter(Boolean).length;
      let i = 0;
      while (i < campioni.length) {
        if (dentro[i]) {
          i++;
          continue;
        }
        let j = i;
        while (j + 1 < campioni.length && !dentro[j + 1]) j++;
        // Un campione in più per parte: il tratto nuovo si sovrappone all'acqua che c'è già.
        const tratto = campioni.slice(Math.max(0, i - 1), Math.min(campioni.length, j + 2));
        if (lunghezza(tratto) >= lunghezzaMinima) {
          nuovi.push(allargaLinea(semplificaLinea(tratto, 2), raggioDi()));
        }
        i = j + 1;
      }
    }
  }
  return { nuovi, coperti, totali };
}

function costruisciAree(elementi) {
  const grezze = []; // { id, t, anello } non ancora ritagliate
  const zoneIndustriali = [];
  const fiumi = [];
  const canali = [];

  for (const e of elementi) {
    const tags = e.tags || {};
    if (tags.landuse === 'industrial') {
      for (const anello of anelliDi(e)) if (anello.length >= 3) zoneIndustriali.push({ anello, limiti: limiti(anello) });
      continue;
    }
    if (e.type === 'way' && (tags.waterway === 'river' || tags.waterway === 'canal') && e.geometry?.length >= 2) {
      const coperto = (tags.tunnel && tags.tunnel !== 'no') || tags.covered === 'yes';
      if (!coperto) (tags.waterway === 'river' ? fiumi : canali).push(metri(e.geometry));
      continue;
    }
    const t = tipoArea(tags);
    if (!t) continue;
    for (const anello of anelliDi(e)) if (anello.length >= 3) grezze.push({ id: e.id, t, anello });
  }

  // --- Il Brenta deve attraversare il riquadro come poligono continuo ---
  const acque = grezze.filter((a) => a.t === 'acqua').map((a) => ({ anello: a.anello, limiti: limiti(a.anello) }));
  const lunghezzaFiume = fiumi.flatMap((f) => ritagliaLinea(f, R)).reduce((s, p) => s + lunghezza(p), 0);
  if (lunghezzaFiume < 3000) {
    throw new Error(`Il Brenta non c'è: linea del fiume lunga solo ${lunghezzaFiume.toFixed(0)} m nel riquadro.`);
  }
  // Mezza larghezza del fiume misurata dove il poligono esiste: serve se va allargata la linea.
  const mezze = [];
  for (const f of fiumi) {
    for (const pezzo of ritagliaLinea(f, R)) {
      for (const c of campionaLinea(pezzo, 40)) {
        const a = acque.find((q) => dentroLimiti(c, q.limiti) && puntoInPoligono(c, q.anello));
        if (a) mezze.push(distanzaDaAnello(c, a.anello));
      }
    }
  }
  mezze.sort((a, b) => a - b);
  const mezzaLarghezza = mezze.length ? Math.max(15, Math.min(60, mezze[Math.floor(mezze.length / 2)])) : 30;
  const fiume = riempiCorsi(fiumi, acque, () => mezzaLarghezza, 16);
  const canale = riempiCorsi(canali, acque, () => 2.5, 20);
  fiume.nuovi.forEach((anello, i) => grezze.push({ id: -1 - i, t: 'acqua', anello }));
  canale.nuovi.forEach((anello, i) => grezze.push({ id: -100000 - i, t: 'acqua', anello }));

  // --- Ritaglio, semplificazione, verso antiorario ---
  const ORDINE = ['coltivo', 'prato', 'bosco', 'parco', 'acqua', 'piazza'];
  const aree = [];
  for (const g of grezze) {
    const ritagliata = ritagliaPoligono(g.anello, R);
    if (ritagliata.length < 3) continue;
    // I tratti di canale allargati sono già essenziali: semplificarli li farebbe sparire.
    const tolleranza = g.id <= -100000 ? 0.3 : TOLLERANZA_AREE;
    const p = appiattisci(antiorario(semplificaAnello(ritagliata, tolleranza)), true);
    if (p.length < 6) continue;
    const superficie = area(daPiatto(p));
    if (superficie < AREA_MINIMA[g.t]) continue;
    aree.push({ id: g.id, superficie, area: { p, t: g.t } });
  }
  // Ordine di disegno suggerito: prima i fondi grandi, poi acqua e piazze.
  aree.sort((a, b) => ORDINE.indexOf(a.area.t) - ORDINE.indexOf(b.area.t) || b.superficie - a.superficie || a.id - b.id);

  return {
    aree: aree.map((x) => x.area),
    zoneIndustriali,
    fiume: {
      lunghezza: lunghezzaFiume,
      mezzaLarghezza,
      copertura: fiume.totali ? fiume.coperti / fiume.totali : 0,
      trattiAllargati: fiume.nuovi.length,
    },
    canali: { copertura: canale.totali ? canale.coperti / canale.totali : 0, trattiAllargati: canale.nuovi.length },
  };
}

// ---------------------------------------------------------------------------
// Alberi
// ---------------------------------------------------------------------------

function costruisciAlberi(nodi, aree, edifici) {
  // Griglia per sapere in fretta se un punto cade su un edificio.
  const CELLA = 64;
  const griglia = new Map();
  const chiave = (i, j) => i * 100003 + j;
  const anelliEdifici = edifici.map((e) => daPiatto(e.p));
  anelliEdifici.forEach((anello, n) => {
    const l = limiti(anello);
    for (let i = Math.floor(l.minX / CELLA); i <= Math.floor(l.maxX / CELLA); i++) {
      for (let j = Math.floor(l.minY / CELLA); j <= Math.floor(l.maxY / CELLA); j++) {
        const k = chiave(i, j);
        if (!griglia.has(k)) griglia.set(k, []);
        griglia.get(k).push(n);
      }
    }
  });
  const suEdificio = (p) =>
    (griglia.get(chiave(Math.floor(p[0] / CELLA), Math.floor(p[1] / CELLA))) || []).some((n) => puntoInPoligono(p, anelliEdifici[n]));
  const acque = aree.filter((a) => a.t === 'acqua').map((a) => ({ anello: daPiatto(a.p) })).map((a) => ({ ...a, limiti: limiti(a.anello) }));
  const inAcqua = (p) => acque.some((a) => dentroLimiti(p, a.limiti) && puntoInPoligono(p, a.anello));

  // Alberi veri (natural=tree). Se sono troppi si sfoltiscono in modo stabile.
  let veri = nodi
    .filter((n) => n.type === 'node')
    .map((n) => ({ id: n.id, p: inMetri(n.lon, n.lat) }))
    .filter((a) => dentroRiquadro(a.p));
  const veriTotali = veri.length;
  if (veri.length > QUOTA_ALBERI_VERI) {
    veri = veri
      .map((a) => ({ ...a, r: casuale(a.id % 2147483647) }))
      .sort((a, b) => a.r - b.r || a.id - b.id)
      .slice(0, QUOTA_ALBERI_VERI);
  }
  veri.sort((a, b) => a.id - b.id);

  // Punti campionati in boschi e parchi: una griglia fissa con uno spostamento che dipende
  // solo dalla cella, così a ogni corsa gli alberi sono gli stessi. Parchi e giardini del
  // centro hanno la griglia più fitta (scripts/lib/alberi.mjs).
  const candidati = new Map();
  for (const a of aree) {
    const anello = daPiatto(a.p);
    const passo = passoAlberi(a.t, anello);
    if (!passo) continue;
    for (const c of puntiDiGriglia(anello, passo)) {
      if (candidati.has(c.k)) continue;
      if (!dentroRiquadro(c.p) || suEdificio(c.p) || inAcqua(c.p)) continue;
      candidati.set(c.k, c);
    }
  }
  const posto = Math.max(0, TETTO_ALBERI - veri.length);
  let campionati = [...candidati.values()];
  const campionatiTotali = campionati.length;
  if (campionati.length > posto) {
    campionati = campionati.sort((a, b) => a.r - b.r || (a.k < b.k ? -1 : 1)).slice(0, posto);
  }
  campionati.sort((a, b) => a.p[0] - b.p[0] || a.p[1] - b.p[1]);

  const alberi = appiattisciPunti([...veri.map((a) => a.p), ...campionati.map((c) => c.p)]);
  return { alberi, veri: veri.length, veriTotali, campionati: campionati.length, campionatiTotali };
}

function appiattisciPunti(punti) {
  const p = [];
  for (const [x, y] of punti) p.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  return p;
}

// ---------------------------------------------------------------------------
// Controlli finali prima di scrivere il file
// ---------------------------------------------------------------------------

function controlla(dati) {
  const problemi = [];
  if (dati.edifici.length < 2000) problemi.push(`solo ${dati.edifici.length} edifici (attesi a migliaia)`);
  if (dati.strade.length < 500) problemi.push(`solo ${dati.strade.length} strade`);
  if (!dati.strade.some((s) => s.t === 'ferrovia')) problemi.push('nessuna ferrovia');
  for (const t of ['acqua', 'parco', 'piazza']) {
    if (!dati.aree.some((a) => a.t === t)) problemi.push(`nessuna area di tipo ${t}`);
  }

  const fuori = (p) => {
    for (let i = 0; i < p.length; i += 2) {
      if (!Number.isFinite(p[i]) || !Number.isFinite(p[i + 1])) return true;
      if (p[i] < R.minX || p[i] > R.maxX || p[i + 1] < R.minY || p[i + 1] > R.maxY) return true;
    }
    return false;
  };
  const elenchi = [...dati.edifici, ...dati.strade, ...dati.aree].map((o) => o.p).concat([dati.alberi]);
  const nFuori = elenchi.filter(fuori).length;
  if (nFuori) problemi.push(`${nFuori} geometrie con coordinate fuori dal riquadro o non numeriche`);
  if (elenchi.some((p) => p.length % 2 !== 0)) problemi.push('array di coordinate di lunghezza dispari');

  const orari = [...dati.edifici, ...dati.aree].filter((o) => areaPiatta(o.p) <= 0).length;
  if (orari) problemi.push(`${orari} poligoni non antiorari o senza area`);
  const altezze = dati.edifici.filter((e) => !(e.h >= 2 && e.h <= 150)).length;
  if (altezze) problemi.push(`${altezze} edifici con altezza fuori da 2-150 m`);

  // Il Ponte Vecchio: una strada con ponte=true, vicina, che passa sopra l'acqua.
  const acque = dati.aree.filter((a) => a.t === 'acqua').map((a) => daPiatto(a.p));
  const ponti = dati.strade.filter((s) => {
    if (!s.ponte) return false;
    const campioni = campionaLinea(daPiatto(s.p), 3);
    const vicino = campioni.some((c) => Math.hypot(c[0] - PONTE_VECCHIO[0], c[1] - PONTE_VECCHIO[1]) < 80);
    return vicino && campioni.some((c) => acque.some((a) => puntoInPoligono(c, a)));
  });
  if (ponti.length === 0) problemi.push("il Ponte Vecchio non risulta come strada con ponte sopra un poligono d'acqua");

  if (problemi.length) throw new Error('Controlli falliti:\n    - ' + problemi.join('\n    - '));
  return { pontiVecchi: ponti };
}

function areaPiatta(p) {
  let s = 0;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    s += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return s / 2;
}

// ---------------------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------------------

function conta(elenco) {
  const c = {};
  for (const o of elenco) c[o.t] = (c[o.t] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ');
}

async function principale() {
  console.log(`Bassano Aperta, dati di base da OpenStreetMap`);
  console.log(`Riquadro: ${BBOX} (sud, ovest, nord, est)`);
  console.log(`In metri: x da ${R.minX} a ${R.maxX}, y da ${R.minY} a ${R.maxY}`);

  console.log('\n1. Scarico da Overpass');
  const grezzi = {};
  for (const [nome, interrogazione] of Object.entries(INTERROGAZIONI)) {
    grezzi[nome] = await chiediOverpass(nome, interrogazione);
  }

  console.log('\n2. Aree');
  const a = costruisciAree(grezzi.aree);
  console.log(`  ${a.aree.length} aree: ${conta(a.aree)}`);
  console.log(
    `  Brenta: ${(a.fiume.lunghezza / 1000).toFixed(2)} km di linea nel riquadro, ` +
      `${(a.fiume.copertura * 100).toFixed(1)}% già dentro un poligono d'acqua, ` +
      `${a.fiume.trattiAllargati} tratti allargati (mezza larghezza ${a.fiume.mezzaLarghezza.toFixed(0)} m)`,
  );
  console.log(`  Canali: ${(a.canali.copertura * 100).toFixed(1)}% già poligono, ${a.canali.trattiAllargati} tratti allargati a 5 m`);

  console.log('\n3. Edifici');
  const e = costruisciEdifici(grezzi.edifici, a.zoneIndustriali);
  console.log(`  ${e.edifici.length} edifici: ${conta(e.edifici)}`);
  console.log(`  altezza da OSM per ${e.conAltezzaVera}, stimata per ${e.edifici.length - e.conAltezzaVera}; con nome ${e.edifici.filter((x) => x.n).length}`);
  console.log(`  scartati: ${e.scartati.piccoli} sotto ${AREA_MINIMA_EDIFICIO} m², ${e.scartati.fuori} fuori riquadro, ${e.scartati.degeneri} degeneri, ${e.scartati.sotterranei} sotterranei, ${e.scartati.doppioni} doppioni`);

  console.log('\n4. Strade');
  const s = costruisciStrade(grezzi.strade);
  console.log(`  ${s.strade.length} strade: ${conta(s.strade)}; ponti ${s.strade.filter((x) => x.ponte).length}`);
  console.log(`  scartate: ${s.scartate.frammenti} frammenti (passi carrai, corsie di parcheggio, marciapiedi), ${s.scartate.tipo} di tipo non usato, ${s.scartate.gallerie} gallerie ferroviarie`);

  console.log('\n5. Alberi');
  const al = costruisciAlberi(grezzi.alberi, a.aree, e.edifici);
  console.log(`  ${al.alberi.length / 2} alberi: ${al.veri} veri (su ${al.veriTotali} in OSM), ${al.campionati} campionati in boschi e parchi (su ${al.campionatiTotali} possibili)`);

  const dati = {
    fonte: '© OpenStreetMap contributors, licenza ODbL 1.0',
    edifici: e.edifici,
    strade: s.strade,
    aree: a.aree,
    alberi: al.alberi,
    // Quanti dei punti in `alberi` vengono da OpenStreetMap (sono i primi dell'elenco).
    // Gli altri sono aggiunti in modo illustrativo dentro boschi e parchi.
    alberiVeri: al.veri,
  };

  console.log('\n6. Controlli');
  const esito = controlla(dati);
  console.log(`  coordinate tutte dentro il riquadro, poligoni antiorari, altezze plausibili`);
  console.log(`  Ponte Vecchio: ${esito.pontiVecchi.length} strade con ponte sopra il Brenta (${conta(esito.pontiVecchi)})`);

  const testo = JSON.stringify(dati);
  await mkdir(dirname(USCITA), { recursive: true });
  const provvisorio = USCITA + '.tmp';
  await writeFile(provvisorio, testo);
  await rename(provvisorio, USCITA);
  console.log(`\nScritto ${USCITA}: ${(Buffer.byteLength(testo) / 1e6).toFixed(2)} MB`);
}

principale().catch((errore) => {
  console.error(`\nERRORE: ${errore.message}`);
  console.error('base.json non è stato modificato.');
  process.exit(1);
});
