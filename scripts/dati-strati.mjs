#!/usr/bin/env node
// Strati tematici della mappa: Cultura, Ambiente, Mobilità.
// Scarica i dati da OpenStreetMap (Overpass API) e da ARPAV e scrive
// public/data/strati.json (tipo DatiStrati in src/types.ts), con le coordinate
// già in metri locali arrotondate a 0,1 m.
//
// Uso:   node scripts/dati-strati.mjs
// Opzione per chi sviluppa: OSM_CACHE=<cartella> salva lì le risposte di
// Overpass e le riusa alla corsa successiva, senza riscaricare.
//
// Solo moduli interni di Node. Se qualcosa va storto lo script esce con codice
// diverso da zero e non tocca il file esistente: mai uno strati.json a metà.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const USCITA = join(RADICE, 'public', 'data', 'strati.json');
const CACHE = process.env.OSM_CACHE || null;

// ---------------------------------------------------------------------------
// Proiezione: stessi numeri di ORIGINE e RIQUADRO in src/types.ts e stessa
// formula di docs/SPEC.md ("Proiezione"). Tenuta qui dentro apposta, per non
// dipendere da altri file.
// ---------------------------------------------------------------------------

const ORIGINE = { lon: 11.7345, lat: 45.7665 };
const RIQUADRO = { ovest: 11.7, sud: 45.736, est: 11.768, nord: 45.792 };
const M_LON = 111320 * Math.cos((ORIGINE.lat * Math.PI) / 180);
const M_LAT = 110574;

const inMetri = (lon, lat) => [(lon - ORIGINE.lon) * M_LON, (lat - ORIGINE.lat) * M_LAT];
const tondo = (v) => {
  const r = Math.round(v * 10) / 10;
  return r === 0 ? 0 : r; // evita -0
};
const [MIN_X, MIN_Y] = inMetri(RIQUADRO.ovest, RIQUADRO.sud);
const [MAX_X, MAX_Y] = inMetri(RIQUADRO.est, RIQUADRO.nord);
const dentro = (x, y) => x >= MIN_X && x <= MAX_X && y >= MIN_Y && y <= MAX_Y;
const distanza = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------------------------------------------------------------------
// Fonti
// ---------------------------------------------------------------------------

const URL_ARIA_COORD = 'https://www2.arpa.veneto.it/aria-json/exported/aria/coords.json';
const STAZIONE_ARIA = '500000106';
const URL_PAGINA_ARIA =
  'https://www.arpa.veneto.it/dati-ambientali/dati-in-diretta/aria/qualita-aria-dati-in-diretta';
const URL_PAGINA_IDRO =
  'https://www.arpa.veneto.it/dati-ambientali/dati-in-diretta/meteo-idro-nivo/variabili_idro?codseqst=300001722&focus=LIVIDRO';

const FONTI = [
  {
    nome: 'OpenStreetMap (© OpenStreetMap contributors), scaricato con Overpass API',
    url: 'https://www.openstreetmap.org/copyright',
    licenza: 'ODbL 1.0',
  },
  {
    nome: "ARPAV, coordinate delle stazioni della qualità dell'aria",
    url: URL_ARIA_COORD,
    licenza: 'CC BY 4.0 (come indicato nella pagina open data di ARPAV)',
  },
  {
    nome: 'ARPAV, stazione idrometrica "Brenta a Barzizza" (coordinate dalla API dei dati in diretta)',
    url: 'https://api.arpa.veneto.it/REST/v1/meteo_meteogrammi?rete=MGRAMMI&coordcd=20005&orario=0',
    licenza: 'CC BY 4.0 (come indicato nella pagina open data di ARPAV)',
  },
  {
    nome: 'ARPAV, pagina open data con la licenza dei dati',
    url: 'https://www.arpa.veneto.it/dati-ambientali/open-data/dati-arpav-in-formato-xml',
    licenza: 'CC BY 4.0',
  },
  {
    nome: 'Windy Webcams (solo collegamenti esterni, nessuna immagine copiata)',
    url: 'https://www.windy.com/webcams',
    licenza: 'Solo link: le immagini restano sul sito esterno',
  },
];

// ---------------------------------------------------------------------------
// Luoghi con una storia (content/luoghi/<id>.json).
// "osm": elemento di OpenStreetMap da cui si prende la posizione a ogni corsa.
// "lat"/"lon": posizione di riserva. Dove "stima" è true la posizione NON
// viene da un elemento OSM del luogo: è una stima da controllare sul posto.
// "doppioni": nomi OSM che sono lo stesso luogo (entro "raggio" metri) e
// quindi non vanno ripetuti. "anche": elementi OSM che fanno parte della
// storia e restano sulla mappa come punti a sé, collegati alla storia.
// ---------------------------------------------------------------------------

const LUOGHI = [
  {
    storia: 'ponte-vecchio', nome: 'Ponte Vecchio', tipo: 'luogo-storico',
    osm: 'way/145926592', lat: 45.767514, lon: 11.7311146,
    doppioni: /ponte (vecchio|degli alpini)/, raggio: 80,
  },
  {
    // Non è un luogo puntuale: punto scelto sul fiume, subito a valle del ponte.
    storia: 'brenta', nome: 'Il Brenta', tipo: 'luogo-storico',
    lat: 45.7668, lon: 11.731, stima: true,
  },
  {
    storia: 'nardini-basso', nome: 'Grapperia Nardini al Ponte', tipo: 'luogo-storico',
    osm: 'node/1402624422', lat: 45.7674625, lon: 11.7317151,
    doppioni: /nardini/,
  },
  {
    // In OSM non c'è un elemento "Garage Nardini": sul piazzale c'è però il bar
    // "Distilleria Bortolo Nardini", cioè la vecchia sede (l'ex "Nardini Alto").
    // Usiamo quello; da confermare sul posto che sia lo stesso ingresso.
    storia: 'nardini-alto', nome: 'Garage Nardini', tipo: 'luogo-storico',
    osm: 'node/1402613183', lat: 45.7695215, lon: 11.7384921,
    doppioni: /nardini/,
  },
  {
    storia: 'bolle-nardini', nome: 'Bolle di Nardini', tipo: 'luogo-storico',
    osm: 'node/1436636260', lat: 45.7401046, lon: 11.754088,
    doppioni: /bolle|nardini/, raggio: 150,
  },
  {
    storia: 'museo-grappa-poli', nome: 'Poli Museo della Grappa', tipo: 'museo',
    osm: 'node/12415671062', lat: 45.767631, lon: 11.732206,
    doppioni: /museo della grappa|poli/,
  },
  {
    // Stessa posizione di Palazzo Sturm nella ricerca: qui è spostato di 14 m
    // verso il fiume (la terrazza), solo per non sovrapporre i due punti.
    storia: 'king-kong-rhino', nome: 'Il rinoceronte di Palazzo Sturm', tipo: 'monumento',
    lat: 45.76633, lon: 11.73167, stima: true, spostaDa: 'palazzo-sturm', spostaX: -14,
    doppioni: /rhino|rinoceronte/,
  },
  {
    storia: 'museo-civico', nome: 'Museo Civico', tipo: 'museo',
    osm: 'node/1421185933', lat: 45.7665406, lon: 11.7352516,
    doppioni: /museo civico|musei civici/, raggio: 80,
  },
  {
    storia: 'palazzo-sturm', nome: 'Palazzo Sturm', tipo: 'museo',
    osm: 'way/145931425', lat: 45.7662922, lon: 11.7315012,
    doppioni: /sturm|museo della ceramica|museo remondini|museo della stampa/, raggio: 60,
  },
  {
    storia: 'palazzo-bonaguro', nome: 'Palazzo Bonaguro', tipo: 'museo',
    osm: 'way/145928363', lat: 45.7674312, lon: 11.7283283,
    doppioni: /palazzo bonaguro/, raggio: 60,
  },
  {
    storia: 'castello-ezzelini', nome: 'Castello degli Ezzelini e Duomo', tipo: 'luogo-storico',
    osm: 'node/1402624424', lat: 45.7690102, lon: 11.7325263,
    doppioni: /castello/, raggio: 100,
    anche: /duomo|santa maria in colle/, raggioAnche: 120,
  },
  {
    storia: 'torre-civica-piazze', nome: 'Torre Civica, Piazza Garibaldi e Piazza Libertà', tipo: 'luogo-storico',
    osm: 'way/145928619', lat: 45.7671704, lon: 11.7351919,
    doppioni: /torre civica/, raggio: 60,
    anche: /^(chiesa di )?san giovanni battista$|loggia/, raggioAnche: 150,
  },
  {
    // Il punto è Porta Dieda; Porta delle Grazie resta come punto a sé, collegato.
    storia: 'mura-porte', nome: 'Mura e porte della città', tipo: 'luogo-storico',
    osm: 'way/781910187', lat: 45.764928, lon: 11.7359883,
    doppioni: /porta dieda/, raggio: 60,
    anche: /porta delle grazie|porta aureola/, raggioAnche: 700,
  },
  {
    // Punto a metà del viale (tratto centrale della strada in OSM).
    storia: 'viale-dei-martiri', nome: 'Viale dei Martiri', tipo: 'luogo-storico',
    osm: 'way/204276756', lat: 45.7690028, lon: 11.7365506,
    doppioni: /viale dei martiri/, raggio: 60,
  },
  {
    storia: 'tempio-ossario', nome: 'Tempio Ossario', tipo: 'chiesa',
    osm: 'node/310353714', lat: 45.7636398, lon: 11.7334538,
    doppioni: /tempio ossario|ossario/, raggio: 80,
  },
];

/** Cima del Monte Grappa (dalla ricerca): serve solo per calcolare la distanza. */
const MONTE_GRAPPA = { lat: 45.87056, lon: 11.79972 };
/** Di quanti metri il segnaposto del Monte Grappa sta dentro l'angolo nord-est. */
const RIENTRO_GRAPPA = 60;

const IDROMETRO = { lat: 45.77741451, lon: 11.73054326 }; // API ARPAV, codseqst 300001722

const WEBCAM = [
  {
    id: 'webcam-piazza-liberta', nome: 'Webcam di Piazza Libertà',
    url: 'https://www.windy.com/webcams/1304014898',
    osm: 'way/167645722', lat: 45.7667101, lon: 11.7339487,
  },
  {
    id: 'webcam-via-matteotti', nome: 'Webcam di Via Matteotti',
    url: 'https://www.windy.com/webcams/1225647707',
    osm: 'way/1427722978', lat: 45.767885, lon: 11.7339387,
  },
];
const NOTA_WEBCAM =
  'Non è un video in diretta: è un timelapse, circa un fotogramma ogni 50 minuti. ' +
  'Si apre su un sito esterno (Windy). Il punto indica il luogo inquadrato, non la posizione della telecamera.';

// ---------------------------------------------------------------------------
// Overpass
// ---------------------------------------------------------------------------

const SPECCHI = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const INTESTAZIONI = {
  'User-Agent': 'bassano-aperta/0.1 (progetto civico open source)',
  Accept: 'application/json',
};
const GIRI = 5; // quante volte si riprova l'intero elenco di specchi
const ATTESA_MS = 150_000; // tempo massimo per una risposta
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(nome, query) {
  const chiave = CACHE && join(CACHE, `strati-${nome}-${createHash('sha1').update(query).digest('hex').slice(0, 12)}.json`);
  if (chiave) {
    try {
      const dati = JSON.parse(await readFile(chiave, 'utf8'));
      console.error(`[overpass] ${nome}: dalla cache ${chiave}`);
      return dati;
    } catch {
      /* non in cache */
    }
  }
  const errori = [];
  for (let giro = 0; giro < GIRI; giro++) {
    if (giro > 0) {
      const attesa = 8000 * 2 ** (giro - 1);
      console.error(`[overpass] ${nome}: nuovo giro tra ${attesa / 1000} s`);
      await pausa(attesa);
    }
    for (const specchio of SPECCHI) {
      const host = new URL(specchio).host;
      try {
        console.error(`[overpass] ${nome}: chiedo a ${host}`);
        const risposta = await fetch(specchio, {
          method: 'POST',
          headers: { ...INTESTAZIONI, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          body: 'data=' + encodeURIComponent(query),
          signal: AbortSignal.timeout(ATTESA_MS),
        });
        if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`);
        const dati = JSON.parse(await risposta.text());
        if (!Array.isArray(dati.elements)) throw new Error('risposta senza "elements"');
        // Overpass risponde 200 anche quando la query va in timeout: lo dice in "remark".
        if (dati.remark && /error|timed out|out of memory/i.test(dati.remark)) throw new Error(`remark: ${dati.remark}`);
        if (dati.elements.length === 0) throw new Error('nessun elemento');
        console.error(`[overpass] ${nome}: ${dati.elements.length} elementi da ${host}`);
        if (chiave) {
          await mkdir(CACHE, { recursive: true });
          await writeFile(chiave, JSON.stringify(dati));
        }
        return dati;
      } catch (e) {
        errori.push(`${host}: ${e.message}`);
        console.error(`[overpass] ${nome}: ${host} non va (${e.message})`);
      }
    }
  }
  throw new Error(`Overpass non risponde per "${nome}" dopo ${GIRI} giri:\n  ${errori.join('\n  ')}`);
}

async function scaricaJson(url) {
  let ultimo;
  for (let i = 0; i < 3; i++) {
    if (i > 0) await pausa(3000 * i);
    try {
      const r = await fetch(url, { headers: INTESTAZIONI, signal: AbortSignal.timeout(60_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return JSON.parse(await r.text());
    } catch (e) {
      ultimo = e;
      console.error(`[scarica] ${url}: ${e.message}`);
    }
  }
  throw new Error(`Non riesco a scaricare ${url}: ${ultimo.message}`);
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

const BBOX = `${RIQUADRO.sud},${RIQUADRO.ovest},${RIQUADRO.nord},${RIQUADRO.est}`;
// Le linee si scaricano con un margine e si ritagliano qui, al metro.
const MARGINE = 0.004;
const BBOX_LARGO = `${RIQUADRO.sud - MARGINE},${RIQUADRO.ovest - MARGINE},${RIQUADRO.nord + MARGINE},${RIQUADRO.est + MARGINE}`;

const idPer = (tipo) =>
  [...LUOGHI, ...WEBCAM]
    .filter((l) => l.osm && l.osm.startsWith(tipo + '/'))
    .map((l) => l.osm.split('/')[1])
    .join(',');

const QUERY_PUNTI = `[out:json][timeout:120][bbox:${BBOX}];
(
  nwr[tourism=museum];
  nwr[amenity~"^(library|theatre|cinema|arts_centre)$"];
  nwr[historic];
  nwr[amenity=place_of_worship][name];
  node[highway=bus_stop];
  nwr[public_transport=platform][bus=yes];
  nwr[railway~"^(station|halt)$"];
  nwr[amenity~"^(bicycle_parking|bicycle_rental)$"];
  node(id:${idPer('node')});
  way(id:${idPer('way')});
);
out center tags;`;

const QUERY_LINEE = `[out:json][timeout:150][bbox:${BBOX}];
(
  relation[route=bicycle];
  way[highway=cycleway];
  way[railway=rail];
);
out geom(${BBOX_LARGO});`;

// ---------------------------------------------------------------------------
// Nomi e doppioni
// ---------------------------------------------------------------------------

const PAROLE_VUOTE = new Set(['di', 'del', 'della', 'dei', 'degli', 'delle', 'il', 'la', 'lo', 'le', 'i', 'gli', 'al', 'alla', 'ai', 'a', 'e', 'in', 'd', 'l']);
const normale = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const parole = (s) => new Set(normale(s).split(' ').filter((p) => p && !PAROLE_VUOTE.has(p)));

/** Due nomi sono "simili" se uno contiene le parole dell'altro, o ne condividono almeno metà. */
function nomiSimili(a, b) {
  const pa = parole(a);
  const pb = parole(b);
  if (pa.size === 0 || pb.size === 0) return false;
  let comuni = 0;
  for (const p of pa) if (pb.has(p)) comuni++;
  if (comuni === Math.min(pa.size, pb.size)) return true;
  return comuni / (pa.size + pb.size - comuni) >= 0.5;
}

const via = (t) => {
  const strada = t['addr:street'] || t['addr:place'];
  if (!strada) return null;
  return t['addr:housenumber'] ? `${strada} ${t['addr:housenumber']}` : strada;
};
const sito = (t) => {
  const u = t.website || t['contact:website'] || t.url;
  return u && /^https?:\/\/\S+$/.test(u) ? u : undefined;
};
const nota = (...pezzi) => pezzi.filter(Boolean).join(' · ');

function centro(e) {
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  const [x, y] = inMetri(lon, lat);
  return { x, y };
}

// ---------------------------------------------------------------------------
// Cultura
// ---------------------------------------------------------------------------

const ETICHETTE_STORICO = {
  memorial: 'Memoriale',
  monument: 'Monumento',
  castle: 'Castello',
  city_gate: 'Porta della città',
  citywalls: 'Mura della città',
  building: 'Edificio storico',
  church: 'Chiesa storica',
  chapel: 'Cappella storica',
  monastery: 'Monastero',
  tower: 'Torre storica',
  ruins: 'Rovine',
  archaeological_site: 'Sito archeologico',
  manor: 'Villa storica',
  palace: 'Palazzo storico',
  house: 'Casa storica',
  bridge: 'Ponte storico',
  fort: 'Forte',
  fountain: 'Fontana storica',
  tomb: 'Tomba',
  industrial: 'Sito industriale storico',
  mill: 'Mulino storico',
  aqueduct: 'Acquedotto storico',
  cannon: 'Cannone',
  aircraft: 'Aereo storico',
  locomotive: 'Locomotiva storica',
  tank: 'Carro armato',
  battlefield: 'Campo di battaglia',
  district: 'Quartiere storico',
  yes: 'Luogo storico',
};
// Oggetti minuti che affollerebbero la mappa senza dire molto.
const STORICO_ESCLUSO = new Set(['boundary_stone', 'milestone', 'stone', 'charcoal_pile', 'bomb_crater', 'razed:building', 'wayside_shrine', 'wayside_cross']);
const MEMORIALE_ESCLUSO = new Set(['stolperstein', 'plaque', 'bench', 'tree']);
const STORICO_MONUMENTO = new Set(['memorial', 'monument', 'cannon', 'aircraft', 'locomotive', 'tank', 'tomb', 'fountain']);
const STORICO_CHIESA = new Set(['church', 'chapel', 'monastery']);

const CULTO = {
  catholic: 'Chiesa cattolica',
  roman_catholic: 'Chiesa cattolica',
  orthodox: 'Chiesa ortodossa',
  protestant: 'Chiesa protestante',
  evangelical: 'Chiesa evangelica',
  jehovahs_witness: 'Sala del Regno dei Testimoni di Geova',
};

/** Classifica un elemento OSM come punto di Cultura; null se non lo è. */
function classificaCultura(t) {
  if (!t.name) return null;
  if (t.tourism === 'museum') return { tipo: 'museo', etichetta: 'Museo', peso: 0 };
  if (t.amenity === 'library') return { tipo: 'biblioteca', etichetta: 'Biblioteca', peso: 1 };
  if (t.amenity === 'theatre') return { tipo: 'teatro', etichetta: 'Teatro', peso: 2 };
  if (t.amenity === 'cinema') return { tipo: 'teatro', etichetta: 'Cinema', peso: 2 };
  if (t.amenity === 'arts_centre') return { tipo: 'teatro', etichetta: 'Centro culturale', peso: 2 };
  if (t.amenity === 'place_of_worship') {
    const etichetta =
      CULTO[t.denomination] ||
      (t.religion === 'christian' ? 'Chiesa' : t.religion === 'muslim' ? 'Moschea' : t.religion === 'jewish' ? 'Sinagoga' : 'Luogo di culto');
    return { tipo: 'chiesa', etichetta, peso: 3 };
  }
  if (t.historic) {
    const h = t.historic;
    if (STORICO_ESCLUSO.has(h)) return null;
    if (h === 'memorial' && MEMORIALE_ESCLUSO.has(t.memorial)) return null;
    const etichetta = ETICHETTE_STORICO[h] || 'Luogo storico';
    if (STORICO_CHIESA.has(h)) return { tipo: 'chiesa', etichetta, peso: 4 };
    if (STORICO_MONUMENTO.has(h)) return { tipo: 'monumento', etichetta, peso: 5 };
    return { tipo: 'luogo-storico', etichetta, peso: 6 };
  }
  return null;
}

function puntiCultura(elementi, perId) {
  const avvisi = [];
  const punti = [];

  // 1. Luoghi con una storia.
  const storie = [];
  for (const l of LUOGHI) {
    let pos;
    let origine;
    const e = l.osm && perId.get(l.osm);
    const c = e && centro(e);
    if (c) {
      pos = c;
      origine = `OSM ${l.osm}`;
    } else {
      const [x, y] = inMetri(l.lon, l.lat);
      pos = { x, y };
      origine = l.stima ? 'stima' : 'riserva';
      if (l.osm) avvisi.push(`${l.storia}: ${l.osm} non trovato in OpenStreetMap, uso la posizione di riserva`);
    }
    storie.push({ ...l, ...pos, origine });
  }
  for (const s of storie) {
    if (!s.spostaDa) continue;
    const base = storie.find((b) => b.storia === s.spostaDa);
    s.x = base.x + (s.spostaX || 0);
    s.y = base.y + (s.spostaY || 0);
  }
  for (const s of storie) {
    if (!dentro(s.x, s.y)) throw new Error(`Il luogo "${s.storia}" cade fuori dal riquadro della mappa`);
    punti.push({ id: `storia-${s.storia}`, strato: 'cultura', tipo: s.tipo, nome: s.nome, x: tondo(s.x), y: tondo(s.y), storia: s.storia });
  }

  // Monte Grappa: fuori mappa. Segnaposto nell'angolo nord-est del riquadro.
  {
    const [gx, gy] = inMetri(MONTE_GRAPPA.lon, MONTE_GRAPPA.lat);
    const km = Math.hypot(gx, gy) / 1000;
    punti.push({
      id: 'storia-monte-grappa',
      strato: 'cultura',
      tipo: 'luogo-storico',
      nome: 'Monte Grappa e Sacrario militare',
      x: tondo(MAX_X - RIENTRO_GRAPPA),
      y: tondo(MAX_Y - RIENTRO_GRAPPA),
      storia: 'monte-grappa',
      nota:
        `Il Monte Grappa è fuori dalla mappa: la cima è a circa ${km.toFixed(1).replace('.', ',')} km in linea d'aria da Piazza Libertà, ` +
        'oltre il bordo nord. Questo punto è solo un segnaposto sul margine.',
    });
  }

  // 2. Altri luoghi di cultura da OpenStreetMap, senza storia.
  const candidati = [];
  for (const e of elementi) {
    const t = e.tags || {};
    const classe = classificaCultura(t);
    if (!classe) continue;
    const c = centro(e);
    if (!c || !dentro(c.x, c.y)) continue;
    candidati.push({ e, t, c, classe, ricchezza: Object.keys(t).length });
  }
  // I più "forti" per primi: tipo più specifico, poi più etichette, poi id (ordine stabile).
  candidati.sort((a, b) => a.classe.peso - b.classe.peso || b.ricchezza - a.ricchezza || a.e.id - b.e.id);

  const tenuti = [];
  let scartatiStoria = 0;
  let scartatiDoppi = 0;
  for (const k of candidati) {
    const nome = k.t.name.trim();
    const n = normale(nome);
    let storia;
    let scarta = false;
    for (const s of storie) {
      const d = distanza(k.c, s);
      if (s.osm === `${k.e.type}/${k.e.id}`) scarta = true;
      else if (s.anche && s.anche.test(n) && d <= (s.raggioAnche ?? 150)) storia = s.storia;
      else if (d <= (s.raggio ?? 40) && ((s.doppioni && s.doppioni.test(n)) || nomiSimili(nome, s.nome))) scarta = true;
      if (scarta) break;
    }
    if (scarta) {
      scartatiStoria++;
      continue;
    }
    if (tenuti.some((o) => distanza(o.c, k.c) <= 40 && nomiSimili(o.nome, nome))) {
      scartatiDoppi++;
      continue;
    }
    tenuti.push({ ...k, nome, storia });
  }
  for (const k of tenuti) {
    const p = {
      id: `osm-${k.e.type}-${k.e.id}`,
      strato: 'cultura',
      tipo: k.classe.tipo,
      nome: k.nome,
      x: tondo(k.c.x),
      y: tondo(k.c.y),
    };
    if (k.storia) p.storia = k.storia;
    p.nota = nota(k.classe.etichetta, via(k.t));
    const u = sito(k.t);
    if (u) p.url = u;
    punti.push(p);
  }
  console.error(`[cultura] ${storie.length + 1} luoghi con storia, ${tenuti.length} da OSM (${scartatiStoria} doppioni di una storia, ${scartatiDoppi} doppioni tra loro)`);
  return { punti, avvisi, storie };
}

// ---------------------------------------------------------------------------
// Ambiente
// ---------------------------------------------------------------------------

async function puntiAmbiente(perId, avvisi) {
  const coord = await scaricaJson(URL_ARIA_COORD);
  const s = (coord.coordinate || []).find((c) => String(c.codseqst) === STAZIONE_ARIA);
  if (!s) throw new Error(`Stazione ${STAZIONE_ARIA} assente da ${URL_ARIA_COORD}`);
  const lat = Number(s.lat);
  const lon = Number(s.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Coordinate della stazione aria non leggibili');
  const [ax, ay] = inMetri(lon, lat);
  if (!dentro(ax, ay)) throw new Error('La stazione aria cade fuori dal riquadro');

  const [ix, iy] = inMetri(IDROMETRO.lon, IDROMETRO.lat);
  const ponte = LUOGHI.find((l) => l.storia === 'ponte-vecchio');
  const [px, py] = inMetri(ponte.lon, ponte.lat);
  const km = Math.hypot(ix - px, iy - py) / 1000;

  const punti = [
    {
      id: 'arpav-idrometro-barzizza',
      strato: 'ambiente',
      tipo: 'idrometro',
      nome: 'Idrometro ARPAV "Brenta a Barzizza"',
      x: tondo(ix),
      y: tondo(iy),
      storia: 'brenta',
      nota: `Misura livello e portata del Brenta. È circa ${km.toFixed(1).replace('.', ',')} km a monte del Ponte Vecchio. Fonte: ARPAV, dati non validati.`,
      url: URL_PAGINA_IDRO,
    },
    {
      id: 'arpav-aria-bassano',
      strato: 'ambiente',
      tipo: 'aria',
      nome: "Stazione ARPAV \"Bassano\" (qualità dell'aria)",
      x: tondo(ax),
      y: tondo(ay),
      nota: "Centralina ARPAV per la qualità dell'aria. Fonte: ARPAV, dati non validati.",
      url: URL_PAGINA_ARIA,
    },
  ];
  for (const w of WEBCAM) {
    const c = centro(perId.get(w.osm) || {});
    let x;
    let y;
    if (c) ({ x, y } = c);
    else {
      [x, y] = inMetri(w.lon, w.lat);
      avvisi.push(`${w.id}: ${w.osm} non trovato in OpenStreetMap, uso la posizione di riserva`);
    }
    punti.push({ id: w.id, strato: 'ambiente', tipo: 'webcam', nome: w.nome, x: tondo(x), y: tondo(y), nota: NOTA_WEBCAM, url: w.url });
  }
  return punti;
}

// ---------------------------------------------------------------------------
// Mobilità: punti
// ---------------------------------------------------------------------------

function puntiMobilita(elementi) {
  const punti = [];

  // Fermate: highway=bus_stop oppure public_transport=platform con bus=yes.
  const fermate = [];
  for (const e of elementi) {
    const t = e.tags || {};
    const fermata = (e.type === 'node' && t.highway === 'bus_stop') || (t.public_transport === 'platform' && t.bus === 'yes');
    if (!fermata) continue;
    const c = centro(e);
    if (!c || !dentro(c.x, c.y)) continue;
    fermate.push({ e, t, c, nome: (t.name || '').trim() });
  }
  // Prima i nodi bus_stop, poi le piattaforme; a parità, id crescente.
  fermate.sort((a, b) => (a.t.highway === 'bus_stop' ? 0 : 1) - (b.t.highway === 'bus_stop' ? 0 : 1) || a.e.id - b.e.id);
  const tenute = [];
  for (const f of fermate) {
    if (tenute.some((o) => distanza(o.c, f.c) <= 25 && normale(o.nome) === normale(f.nome))) continue;
    tenute.push(f);
  }
  for (const f of tenute) {
    punti.push({
      id: `osm-${f.e.type}-${f.e.id}`,
      strato: 'mobilita',
      tipo: 'fermata-bus',
      nome: f.nome || 'Fermata autobus',
      x: tondo(f.c.x),
      y: tondo(f.c.y),
      nota: nota('Fermata autobus', f.t.network || f.t.operator, f.t.shelter === 'yes' ? 'con pensilina' : null),
    });
  }

  // Stazioni ferroviarie.
  const stazioni = [];
  for (const e of elementi) {
    const t = e.tags || {};
    if (t.railway !== 'station' && t.railway !== 'halt') continue;
    const c = centro(e);
    if (!c || !dentro(c.x, c.y)) continue;
    const nome = (t.name || 'Stazione ferroviaria').trim();
    if (stazioni.some((o) => distanza(o.c, c) <= 150 && nomiSimili(o.nome, nome))) continue;
    stazioni.push({ c, nome });
    const p = {
      id: `osm-${e.type}-${e.id}`,
      strato: 'mobilita',
      tipo: 'stazione',
      nome,
      x: tondo(c.x),
      y: tondo(c.y),
      nota: nota(t.railway === 'halt' ? 'Fermata ferroviaria' : 'Stazione ferroviaria', t.operator),
    };
    const u = sito(t);
    if (u) p.url = u;
    punti.push(p);
  }

  // Bici: parcheggi e noleggi.
  const bici = [];
  for (const e of elementi) {
    const t = e.tags || {};
    if (t.amenity !== 'bicycle_parking' && t.amenity !== 'bicycle_rental') continue;
    if (t.access === 'private' || t.access === 'no') continue;
    const c = centro(e);
    if (!c || !dentro(c.x, c.y)) continue;
    const noleggio = t.amenity === 'bicycle_rental';
    if (bici.some((o) => o.noleggio === noleggio && distanza(o.c, c) <= 8)) continue;
    bici.push({ c, noleggio });
    const posti = /^\d+$/.test(t.capacity || '') && Number(t.capacity) > 0 ? `${Number(t.capacity)} posti` : null;
    punti.push({
      id: `osm-${e.type}-${e.id}`,
      strato: 'mobilita',
      tipo: 'bici',
      nome: (t.name || '').trim() || (noleggio ? 'Noleggio bici' : 'Parcheggio bici'),
      x: tondo(c.x),
      y: tondo(c.y),
      nota: nota(noleggio ? 'Noleggio bici' : 'Parcheggio bici', noleggio ? t.network || t.operator : null, posti, t.covered === 'yes' ? 'coperto' : null),
    });
  }
  console.error(`[mobilità] ${tenute.length} fermate (da ${fermate.length}), ${stazioni.length} stazioni, ${bici.length} punti bici`);
  return punti;
}

// ---------------------------------------------------------------------------
// Mobilità: linee
// ---------------------------------------------------------------------------

/** Ritaglia una spezzata [[x, y], ...] sul riquadro. Restituisce zero o più spezzate. */
function ritaglia(punti) {
  const pezzi = [];
  let corrente = [];
  const chiudi = () => {
    if (corrente.length >= 2) pezzi.push(corrente);
    corrente = [];
  };
  for (let i = 0; i + 1 < punti.length; i++) {
    const [x0, y0] = punti[i];
    const [x1, y1] = punti[i + 1];
    // Liang-Barsky
    const dx = x1 - x0;
    const dy = y1 - y0;
    let t0 = 0;
    let t1 = 1;
    let visibile = true;
    for (const [p, q] of [[-dx, x0 - MIN_X], [dx, MAX_X - x0], [-dy, y0 - MIN_Y], [dy, MAX_Y - y0]]) {
      if (p === 0) {
        if (q < 0) visibile = false;
      } else {
        const r = q / p;
        if (p < 0) {
          if (r > t1) visibile = false;
          else if (r > t0) t0 = r;
        } else if (r < t0) visibile = false;
        else if (r < t1) t1 = r;
      }
      if (!visibile) break;
    }
    if (!visibile) {
      chiudi();
      continue;
    }
    const a = [x0 + t0 * dx, y0 + t0 * dy];
    const b = [x0 + t1 * dx, y0 + t1 * dy];
    if (t0 > 0) chiudi(); // si rientra nel riquadro: comincia un pezzo nuovo
    if (corrente.length === 0) corrente.push(a);
    corrente.push(b);
    if (t1 < 1) chiudi(); // si esce dal riquadro
  }
  chiudi();
  return pezzi;
}

/** Douglas-Peucker, senza ricorsione. */
function semplifica(punti, tolleranza) {
  if (punti.length <= 2) return punti;
  const tieni = new Uint8Array(punti.length);
  tieni[0] = tieni[punti.length - 1] = 1;
  const pila = [[0, punti.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop();
    const [ax, ay] = punti[a];
    const [bx, by] = punti[b];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let massimo = -1;
    let dove = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = punti[i];
      let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > massimo) {
        massimo = d;
        dove = i;
      }
    }
    if (massimo > tolleranza) {
      tieni[dove] = 1;
      pila.push([a, dove], [dove, b]);
    }
  }
  return punti.filter((_, i) => tieni[i]);
}

/** Unisce le spezzate che si toccano in un estremo (solo dove il nodo ha esattamente due capi). */
function unisci(spezzate) {
  const chiave = ([x, y]) => `${Math.round(x * 100)},${Math.round(y * 100)}`;
  const vive = new Set(spezzate.map((s) => s.slice()));
  let cambiato = true;
  while (cambiato) {
    cambiato = false;
    const capi = new Map();
    for (const s of vive) {
      for (const k of [chiave(s[0]), chiave(s[s.length - 1])]) {
        if (!capi.has(k)) capi.set(k, []);
        capi.get(k).push(s);
      }
    }
    for (const [k, lista] of capi) {
      if (lista.length !== 2 || lista[0] === lista[1]) continue;
      const [a, b] = lista;
      if (!vive.has(a) || !vive.has(b)) continue;
      const aFine = chiave(a[a.length - 1]) === k;
      const bInizio = chiave(b[0]) === k;
      const prima = aFine ? a : a.slice().reverse();
      const dopo = bInizio ? b : b.slice().reverse();
      vive.delete(a);
      vive.delete(b);
      vive.add(prima.concat(dopo.slice(1)));
      cambiato = true;
      break; // i capi sono cambiati: si ricalcola
    }
  }
  return [...vive];
}

const lunghezza = (s) => {
  let l = 0;
  for (let i = 1; i < s.length; i++) l += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
  return l;
};

/** Geometria Overpass (con eventuali buchi null) → spezzate in metri. */
function inSpezzate(geometria) {
  const pezzi = [];
  let corrente = [];
  for (const g of geometria || []) {
    if (!g || typeof g.lat !== 'number') {
      if (corrente.length >= 2) pezzi.push(corrente);
      corrente = [];
    } else corrente.push(inMetri(g.lon, g.lat));
  }
  if (corrente.length >= 2) pezzi.push(corrente);
  return pezzi;
}

const TOLLERANZA = 2; // metri
const LUNGHEZZA_MINIMA = 15; // metri: sotto, il pezzo non si vede

/** Vie (liste di spezzate grezze) → spezzate ritagliate, unite, semplificate e appiattite. */
function lavora(spezzateGrezze) {
  const ritagliate = spezzateGrezze.flatMap(ritaglia);
  return unisci(ritagliate)
    .map((s) => semplifica(s, TOLLERANZA))
    .filter((s) => lunghezza(s) >= LUNGHEZZA_MINIMA)
    .map((s) => {
      const p = [];
      for (const [x, y] of s) {
        const rx = tondo(x);
        const ry = tondo(y);
        if (p.length >= 2 && p[p.length - 2] === rx && p[p.length - 1] === ry) continue;
        p.push(rx, ry);
      }
      return p;
    })
    .filter((p) => p.length >= 4)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a.length - b.length);
}

function linee(elementi) {
  const uscita = [];
  const vieInRelazione = new Set();
  const geometriaVia = new Map();
  for (const e of elementi) if (e.type === 'way' && e.geometry) geometriaVia.set(e.id, e.geometry);

  // Itinerari ciclabili (relazioni route=bicycle).
  const relazioni = elementi.filter((e) => e.type === 'relation' && e.tags?.route === 'bicycle').sort((a, b) => a.id - b.id);
  let itinerari = 0;
  const tratti = new Map();
  for (const r of relazioni) {
    const grezze = [];
    for (const m of r.members || []) {
      if (m.type !== 'way') continue;
      vieInRelazione.add(m.ref);
      grezze.push(...inSpezzate(m.geometry));
    }
    const pezzi = lavora(grezze);
    if (pezzi.length === 0) continue;
    itinerari++;
    const nome = (r.tags.name || '').trim() || (r.tags.ref ? `Itinerario ciclabile ${r.tags.ref}` : undefined);
    pezzi.forEach((p, i) => {
      // Due itinerari che passano sullo stesso identico tratto: una linea sola, con i due nomi.
      const chiave = p.join(',');
      const gia = tratti.get(chiave);
      if (gia) {
        if (nome && !(gia.nome || '').split(' · ').includes(nome)) gia.nome = gia.nome ? `${gia.nome} · ${nome}` : nome;
        return;
      }
      const l = { id: `ciclabile-r${r.id}-${i + 1}`, strato: 'mobilita', tipo: 'ciclabile' };
      if (nome) l.nome = nome;
      l.p = p;
      tratti.set(chiave, l);
      uscita.push(l);
    });
  }

  // Piste ciclabili (highway=cycleway) che non fanno già parte di un itinerario.
  // Si uniscono solo tra vie con lo stesso nome, così il nome resta giusto.
  const perNome = new Map();
  for (const e of elementi) {
    if (e.type !== 'way' || e.tags?.highway !== 'cycleway' || vieInRelazione.has(e.id)) continue;
    const nome = (e.tags.name || '').trim();
    if (!perNome.has(nome)) perNome.set(nome, []);
    perNome.get(nome).push(...inSpezzate(e.geometry));
  }
  let piste = 0;
  for (const nome of [...perNome.keys()].sort()) {
    for (const p of lavora(perNome.get(nome))) {
      piste++;
      const l = { id: `ciclabile-p${piste}`, strato: 'mobilita', tipo: 'ciclabile' };
      if (nome) l.nome = nome;
      l.p = p;
      uscita.push(l);
    }
  }

  // Ferrovia: binari di linea (railway=rail), senza scali e raccordi.
  const binari = new Map();
  for (const e of elementi) {
    if (e.type !== 'way' || e.tags?.railway !== 'rail') continue;
    if (['yard', 'siding', 'spur', 'crossover'].includes(e.tags.service)) continue;
    const nome = (e.tags.name || '').trim();
    if (!binari.has(nome)) binari.set(nome, []);
    binari.get(nome).push(...inSpezzate(e.geometry));
  }
  let ferro = 0;
  for (const nome of [...binari.keys()].sort()) {
    for (const p of lavora(binari.get(nome))) {
      ferro++;
      const l = { id: `ferrovia-${ferro}`, strato: 'mobilita', tipo: 'ferrovia' };
      if (nome) l.nome = nome;
      l.p = p;
      uscita.push(l);
    }
  }
  console.error(`[linee] ${itinerari} itinerari ciclabili, ${piste} tratti di pista fuori itinerario, ${ferro} tratti di ferrovia`);
  return uscita;
}

// ---------------------------------------------------------------------------
// Controlli finali: meglio fermarsi che scrivere un file sbagliato.
// ---------------------------------------------------------------------------

const TIPI_PUNTO = new Set(['museo', 'biblioteca', 'teatro', 'monumento', 'chiesa', 'luogo-storico', 'aria', 'idrometro', 'webcam', 'fermata-bus', 'stazione', 'bici']);
const STORIE_LUOGO = [...LUOGHI.map((l) => l.storia), 'monte-grappa'];

function controlla(dati) {
  const errori = [];
  const visti = new Set();
  const eps = 0.06;
  const ok = (x, y) => Number.isFinite(x) && Number.isFinite(y) && x >= MIN_X - eps && x <= MAX_X + eps && y >= MIN_Y - eps && y <= MAX_Y + eps;
  for (const p of dati.punti) {
    if (visti.has(p.id)) errori.push(`id ripetuto: ${p.id}`);
    visti.add(p.id);
    if (!TIPI_PUNTO.has(p.tipo)) errori.push(`${p.id}: tipo sconosciuto ${p.tipo}`);
    if (!p.nome) errori.push(`${p.id}: senza nome`);
    if (!ok(p.x, p.y)) errori.push(`${p.id}: fuori dal riquadro`);
    if (!p.storia && !p.nota) errori.push(`${p.id}: né storia né nota`);
  }
  for (const l of dati.linee) {
    if (visti.has(l.id)) errori.push(`id ripetuto: ${l.id}`);
    visti.add(l.id);
    if (l.p.length < 4 || l.p.length % 2) errori.push(`${l.id}: linea non valida`);
    for (let i = 0; i < l.p.length; i += 2) if (!ok(l.p[i], l.p[i + 1])) errori.push(`${l.id}: punto fuori dal riquadro`);
  }
  for (const s of STORIE_LUOGO) {
    const n = dati.punti.filter((p) => p.id === `storia-${s}`).length;
    if (n !== 1) errori.push(`storia ${s}: ${n} punti invece di 1`);
  }
  const conta = (f) => dati.punti.filter(f).length;
  if (conta((p) => p.strato === 'cultura' && !p.storia) === 0) errori.push('nessun luogo di cultura da OSM');
  if (conta((p) => p.tipo === 'fermata-bus') === 0) errori.push('nessuna fermata');
  if (conta((p) => p.tipo === 'stazione') === 0) errori.push('nessuna stazione');
  if (conta((p) => p.strato === 'ambiente') !== 4) errori.push('i punti di Ambiente non sono 4');
  if (!dati.linee.some((l) => l.tipo === 'ciclabile')) errori.push('nessuna ciclabile');
  if (!dati.linee.some((l) => l.tipo === 'ferrovia')) errori.push('nessuna ferrovia');
  if (errori.length) throw new Error(`Dati non validi:\n  ${errori.slice(0, 30).join('\n  ')}`);
}

// ---------------------------------------------------------------------------

async function main() {
  const datiPunti = await overpass('punti', QUERY_PUNTI);
  const datiLinee = await overpass('linee', QUERY_LINEE);
  const perId = new Map(datiPunti.elements.map((e) => [`${e.type}/${e.id}`, e]));

  const cultura = puntiCultura(datiPunti.elements, perId);
  const avvisi = cultura.avvisi;
  const ambiente = await puntiAmbiente(perId, avvisi);
  const mobilita = puntiMobilita(datiPunti.elements);

  const dati = {
    generato: new Date().toISOString(),
    fonti: FONTI,
    punti: [...cultura.punti, ...ambiente, ...mobilita],
    linee: linee(datiLinee.elements),
  };
  controlla(dati);

  await mkdir(dirname(USCITA), { recursive: true });
  const provvisorio = USCITA + '.tmp';
  await writeFile(provvisorio, JSON.stringify(dati) + '\n');
  await rename(provvisorio, USCITA);

  // Riepilogo.
  const conteggi = {};
  for (const p of dati.punti) conteggi[`${p.strato} / ${p.tipo}`] = (conteggi[`${p.strato} / ${p.tipo}`] || 0) + 1;
  for (const l of dati.linee) conteggi[`${l.strato} / linea ${l.tipo}`] = (conteggi[`${l.strato} / linea ${l.tipo}`] || 0) + 1;
  console.log(`Scritto ${USCITA}`);
  for (const k of Object.keys(conteggi).sort()) console.log(`  ${k}: ${conteggi[k]}`);
  const stime = cultura.storie.filter((s) => s.origine !== `OSM ${s.osm}`).map((s) => `${s.storia} (${s.origine})`);
  console.log(`Posizioni non prese da un elemento OSM: ${[...stime, 'monte-grappa (segnaposto sul margine)'].join(', ')}`);
  for (const a of avvisi) console.warn(`ATTENZIONE: ${a}`);
}

main().catch((e) => {
  console.error(`\nERRORE: ${e.message}`);
  process.exit(1);
});
