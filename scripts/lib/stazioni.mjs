// Tabella dei nomi delle stazioni: dal testo di stops.txt (GTFS) a una mappa
// codice → nome leggibile. Solo funzioni pure, senza rete: le usa
// scripts/dati-stazioni.mjs e le prova tests/dati-mobilita.test.ts.
//
// stops.txt: stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station,...
// Teniamo solo le righe con un codice fatto di sole cifre (le righe con ":" sono i
// binari, figli della stazione) e solo il Nord-Est, per tenere piccola la tabella.

/** Riquadro del Nord-Est: basta per le corse che passano da Bassano. */
export const RIQUADRO = { latMin: 44.8, latMax: 46.8, lonMin: 10.4, lonMax: 13.9 };

/** Parole che restano minuscole dentro un nome ("Bassano del Grappa"). */
const MINUSCOLE = new Set([
  'di', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'da', 'dal', 'de',
  'in', 'sul', 'sulla', 'sui', 'al', 'alla', 'ai', 'a', 'e', 'per', 'con', 'nel', 'nella', 'nelle', 'nei',
]);

/** Davanti all'apostrofo: "d'Ezzelino", "dell'Emilia", ma "Sant'Anna". */
const ELISE_MINUSCOLE = new Set(['d', 'l', 'dell', 'all', 'sull', 'nell']);

const GRAVI = { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù' };

function iniziale(parola) {
  return parola ? parola[0].toLocaleUpperCase('it') + parola.slice(1) : parola;
}

/** Una parola senza spazi né trattini, già minuscola. `prima` = è la prima del nome. */
function sistemaParola(parola, prima) {
  if (!parola) return parola;
  // Sigle con i punti ("F.S.", "S.") restano maiuscole.
  if (/^(?:\p{L}\.)+$/u.test(parola)) return parola.toLocaleUpperCase('it');
  const apostrofo = parola.indexOf("'");
  if (apostrofo > 0 && apostrofo < parola.length - 1) {
    const davanti = parola.slice(0, apostrofo);
    const dietro = parola.slice(apostrofo + 1);
    const d = !prima && ELISE_MINUSCOLE.has(davanti) ? davanti : iniziale(davanti);
    return `${d}'${sistemaParola(dietro, true)}`;
  }
  if (!prima && MINUSCOLE.has(parola)) return parola;
  return iniziale(parola);
}

/**
 * "VENEZIA S.LUCIA" → "Venezia S. Lucia", "BASSANO DEL GRAPPA" → "Bassano del Grappa",
 * "S.DONA' DI PIAVE" → "S. Donà di Piave".
 */
export function nomeLeggibile(grezzo) {
  let t = String(grezzo ?? '').replace(/[`´’]/g, "'").replace(/\s+/g, ' ').trim();
  if (!t) return '';
  t = t.toLocaleLowerCase('it');
  // Spazio dopo il punto di un'abbreviazione attaccata alla parola seguente ("s.lucia"),
  // ma non dentro le sigle ("f.s.").
  t = t.replace(/(\p{L})\.(?=\p{L}{2})/gu, '$1. ');
  // L'accento scritto come apostrofo in fondo alla parola ("dona'", "rosa'").
  t = t.replace(/(\p{L})([aeiou])'(?=$|[\s\-/)])/gu, (_, prima, vocale) => prima + GRAVI[vocale]);
  let primaParola = true;
  return t
    .split(' ')
    .map((pezzo) => {
      const fatto = pezzo
        .split(/([-/()])/)
        .map((p, i) => {
          if (/^[-/()]?$/.test(p)) return p;
          return sistemaParola(p, primaParola || i > 0);
        })
        .join('');
      primaParola = false;
      return fatto;
    })
    .join(' ');
}

/** Una riga CSV → campi, con le virgolette doppie come da regola ("" = virgoletta). */
export function campiCsv(riga) {
  const campi = [];
  let campo = '';
  let dentro = false;
  for (let i = 0; i < riga.length; i++) {
    const c = riga[i];
    if (dentro) {
      if (c === '"') {
        if (riga[i + 1] === '"') {
          campo += '"';
          i++;
        } else dentro = false;
      } else campo += c;
    } else if (c === '"') dentro = true;
    else if (c === ',') {
      campi.push(campo);
      campo = '';
    } else campo += c;
  }
  campi.push(campo);
  return campi;
}

/**
 * Testo di stops.txt → { "02520": "Bassano del Grappa", ... }, in ordine di codice.
 * Lancia un errore se mancano le colonne che servono.
 */
export function stazioniDaStops(testo, riquadro = RIQUADRO) {
  const righe = String(testo ?? '').replace(/^﻿/, '').split(/\r?\n/);
  const intestazione = campiCsv(righe[0] ?? '').map((c) => c.trim());
  const col = (nome) => intestazione.indexOf(nome);
  const iId = col('stop_id');
  const iNome = col('stop_name');
  const iLat = col('stop_lat');
  const iLon = col('stop_lon');
  if (iId < 0 || iNome < 0 || iLat < 0 || iLon < 0) {
    throw new Error('stops.txt non ha le colonne stop_id, stop_name, stop_lat, stop_lon: struttura cambiata?');
  }
  const trovate = new Map();
  for (let i = 1; i < righe.length; i++) {
    if (!righe[i].trim()) continue;
    const campi = campiCsv(righe[i]);
    const id = (campi[iId] ?? '').trim();
    if (!/^\d+$/.test(id)) continue;
    const lat = Number(campi[iLat]);
    const lon = Number(campi[iLon]);
    if (!(campi[iLat] ?? '').trim() || !(campi[iLon] ?? '').trim()) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < riquadro.latMin || lat > riquadro.latMax || lon < riquadro.lonMin || lon > riquadro.lonMax) continue;
    const nome = nomeLeggibile(campi[iNome]);
    if (!nome) continue;
    trovate.set(id, nome);
  }
  const ordinate = {};
  for (const id of [...trovate.keys()].sort()) ordinate[id] = trovate.get(id);
  return ordinate;
}
