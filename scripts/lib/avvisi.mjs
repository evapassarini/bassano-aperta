// Avvisi sulla viabilità: lettura dei due feed RSS e scelta delle voci che riguardano
// Bassano e dintorni. Solo funzioni pure, senza rete: le usa scripts/dati-avvisi.mjs e
// le prova tests/dati-mobilita.test.ts.
//
// Fonti (controllate il 15/11/2026):
//   CCISS Viaggiare Informati, https://www.cciss.it/rss
//     <title> = strada ("SS47 Della Valsugana"), <description> = strada, a capo, testo,
//     "&lt;br/&gt; (Fonte: www.cciss.it)". Nessun link per voce.
//   Vi.abilità (Provincia di Vicenza), https://vi-abilita.it/feed/
//     RSS di WordPress: <title> con entità (&#8217;), <description> in CDATA con HTML.
//     <content:encoded> ha il testo intero, <description> un riassunto che spesso si
//     ferma prima della data di fine lavori: per questo si legge il testo intero.
//     Il testo comincia con protocollo, sigle di chi ha scritto l'atto e numero di
//     pratica: li togliamo, non servono a chi legge e le sigle sono dati di persone.
//     Togliamo anche i riferimenti d'ufficio dentro il testo (concessione prot., OM,
//     AREA EST, CUP, CIG) e mettiamo il periodo dei lavori subito dopo il luogo, così
//     il taglio a 280 caratteri non lo porta mai via.

export const FONTE_CCISS = {
  nome: 'CCISS Viaggiare Informati',
  url: 'https://www.cciss.it/',
  licenza: 'Non dichiarata: citazione breve con link alla fonte',
};

export const FONTE_VIABILITA = {
  nome: 'Vi.abilità (Provincia di Vicenza)',
  url: 'https://vi-abilita.it/',
  licenza: 'Non dichiarata: citazione breve con link alla fonte',
};

export const LUNGHEZZA_MASSIMA = 280;
export const GIORNI_ORDINANZE = 120;
export const MASSIMO_ORDINANZE = 10;

// ---------------------------------------------------------------------------
// Pulizia del testo
// ---------------------------------------------------------------------------

const ENTITA = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  agrave: 'à', egrave: 'è', eacute: 'é', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
  Agrave: 'À', Egrave: 'È', Eacute: 'É', Igrave: 'Ì', Ograve: 'Ò', Ugrave: 'Ù',
  laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', deg: '°', euro: '€',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
};

/** Trasforma le entità (&amp; &#8217; &#x2019; &egrave; ...) nei caratteri veri. Una sola passata. */
export function decodificaEntita(testo) {
  return String(testo ?? '').replace(/&(#[xX][0-9a-fA-F]{1,6}|#\d{1,7}|[a-zA-Z][a-zA-Z0-9]{1,9});/g, (tutto, corpo) => {
    if (corpo[0] !== '#') return Object.hasOwn(ENTITA, corpo) ? ENTITA[corpo] : tutto;
    const codice = /^#[xX]/.test(corpo) ? parseInt(corpo.slice(2), 16) : parseInt(corpo.slice(1), 10);
    if (!Number.isFinite(codice) || codice <= 0 || codice > 0x10ffff || (codice >= 0xd800 && codice <= 0xdfff)) return tutto;
    return String.fromCodePoint(codice);
  });
}

/**
 * Toglie i tag. Quelli che stanno dentro una riga (grassetto, span, link) spariscono senza
 * lasciare uno spazio, perché capita che spezzino una parola: "<span>P</span><span>er</span>".
 * Tutti gli altri (paragrafi, a capo, elenchi) diventano uno spazio.
 */
function viaITag(t) {
  return t
    .replace(/<\/?(?:a|abbr|b|em|font|i|mark|small|span|strong|sub|sup|u)(?:\s[^>]*)?\/?>/gi, '')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ');
}

/**
 * Da HTML (o testo con entità) a testo semplice su una riga: via i tag, entità decodificate,
 * spazi compattati. Non taglia. I trattini lunghi diventano trattini normali (regola
 * editoriale del sito), i trattini di sillabazione invisibili spariscono.
 */
export function testoSemplice(html) {
  let t = String(html ?? '');
  t = t.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  t = t.replace(/<!--[\s\S]*?-->/g, ' ');
  t = t.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  t = viaITag(t);
  // Due passate: nei feed capita il testo codificato due volte (&amp;#8217;). Dopo la prima
  // possono comparire tag che prima erano scritti come &lt;br/&gt;.
  t = decodificaEntita(t);
  t = viaITag(t);
  t = decodificaEntita(t);
  t = t.replace(/­|[​-‍﻿]/g, '');
  t = t.replace(/[–—−]/g, '-');
  t = t.replace(/[\s ]+/g, ' ').trim();
  return t;
}

/** Taglia a `massimo` caratteri (compreso il segno "…") su un confine di parola. */
export function tronca(testo, massimo = LUNGHEZZA_MASSIMA) {
  const t = String(testo ?? '');
  if (t.length <= massimo) return t;
  let pezzo = t.slice(0, massimo - 1);
  // Se il taglio cade dentro una parola, si torna all'ultimo spazio.
  if (/\S/.test(t[massimo - 1])) {
    const spazio = pezzo.lastIndexOf(' ');
    if (spazio > massimo * 0.5) pezzo = pezzo.slice(0, spazio);
  }
  pezzo = pezzo.replace(/[\s,;:.\-([«"“…]+$/u, '');
  return pezzo + '…';
}

/** Pulizia completa: testo semplice, al massimo `massimo` caratteri. */
export function pulisciTesto(html, massimo = LUNGHEZZA_MASSIMA) {
  return tronca(testoSemplice(html), massimo);
}

// ---------------------------------------------------------------------------
// Lettura dell'RSS
// ---------------------------------------------------------------------------

/** Contenuto del primo elemento `<nome>` dentro `xml`: CDATA aperto, altrimenti entità decodificate una volta. */
function campo(xml, nome) {
  const n = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}\\s*>`, 'i').exec(xml);
  if (!m) return '';
  const grezzo = m[1];
  if (/<!\[CDATA\[/.test(grezzo)) {
    return grezzo.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
  }
  return decodificaEntita(grezzo).trim();
}

/**
 * Da un documento RSS alle sue voci.
 * `titolo` è testo semplice; `descrizione` e `contenuto` (il testo intero di WordPress,
 * <content:encoded>, vuoto se manca) possono contenere HTML (vanno puliti con testoSemplice);
 * `quando` è la data di pubblicazione in ISO 8601, o null se manca o non si legge.
 */
export function leggiRss(xml) {
  const voci = [];
  const testo = String(xml ?? '');
  const cerca = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item\s*>/gi;
  let m;
  while ((m = cerca.exec(testo))) {
    const corpo = m[1];
    const titolo = testoSemplice(campo(corpo, 'title'));
    if (!titolo) continue;
    const millis = Date.parse(campo(corpo, 'pubDate') || campo(corpo, 'dc:date'));
    voci.push({
      titolo,
      descrizione: campo(corpo, 'description'),
      contenuto: campo(corpo, 'content:encoded'),
      link: campo(corpo, 'link'),
      quando: Number.isNaN(millis) ? null : new Date(millis).toISOString(),
    });
  }
  return voci;
}

// ---------------------------------------------------------------------------
// Scelta delle voci
// ---------------------------------------------------------------------------

// Confini di parola che funzionano anche con le lettere accentate ("Rosà").
const PRIMA = '(?<![\\p{L}\\p{N}])';
const DOPO = '(?![\\p{L}\\p{N}])';
const AP = "['’‘`]";

// "Bassano" da solo vale, ma non gli altri Bassano d'Italia.
const BASSANO = `${PRIMA}Bassano${DOPO}(?!\\s+(?:Romano|Bresciano|in\\s+Teverina))`;

/** Comuni vicini a Bassano nei testi del CCISS (dove "Romano" e "Pove" compaiono senza il resto del nome). */
const COMUNI_CCISS = new RegExp(
  `${BASSANO}|${PRIMA}(?:Pove|Romano|Cassola|Ros(?:à|a${AP}?)|Marostica|Solagna|Cartigliano)${DOPO}`,
  'iu',
);
/** "Nove" è anche un numero: vale solo con l'iniziale maiuscola e non davanti a una cifra. */
const NOVE = new RegExp(`${PRIMA}Nove${DOPO}(?!\\s*\\d)`, 'u');

const SS47 = new RegExp(`${PRIMA}S\\.?\\s?S\\.?\\s?47${DOPO}|${PRIMA}Valsugana${DOPO}`, 'iu');
const SS248 = new RegExp(`${PRIMA}S\\.?\\s?S\\.?\\s?248${DOPO}`, 'iu');
const SPV = new RegExp(`Pedemontana\\s+Veneta|${PRIMA}SPV${DOPO}`, 'iu');
const SOLO_BASSANO = new RegExp(BASSANO, 'iu');

/** Comuni del bassanese nelle ordinanze di Vi.abilità (nomi completi). */
const COMUNI_VIABILITA = new RegExp(
  `${BASSANO}|${PRIMA}(?:Romano\\s+d\\s*${AP}\\s*Ezzelino|Cassola|Ros(?:à|a${AP})|Pove\\s+del\\s+Grappa|Marostica|Cartigliano|Solagna|Mussolente)${DOPO}`,
  'iu',
);

/** Notizie d'ufficio, non di strada: determine, avvisi di selezione, chiusure degli uffici. */
const UFFICIO = /^\s*(?:DETERMINA|DETERMINAZIONE|AVVISO\b|SI\s+INFORMA|A\s+SEGUITO\s+DI\s+GUASTO)|\bUFFICI\b|SELEZIONE\s+PUBBLICA|LINEE\s+TELEFONICHE/i;

function toccaComuneCciss(t) {
  return COMUNI_CCISS.test(t) || NOVE.test(t);
}

/** true se un evento del CCISS riguarda Bassano (regole in testa a scripts/dati-avvisi.mjs). */
export function riguardaBassanoCciss(titolo, testo) {
  const t = `${titolo} ${testo}`;
  if (SOLO_BASSANO.test(t)) return true;
  if (SS248.test(t)) return true;
  if (SS47.test(t) && toccaComuneCciss(t)) return true;
  if (SPV.test(t) && toccaComuneCciss(t)) return true;
  return false;
}

/**
 * true se un'ordinanza di Vi.abilità tocca un comune del bassanese. Si guarda solo il
 * titolo, che dice dove sono i lavori: nel testo Bassano compare anche solo come direzione
 * ("veicoli provenienti da Bassano") per lavori che stanno altrove.
 */
export function riguardaBassaneseViabilita(titolo) {
  const t = String(titolo ?? '');
  return COMUNI_VIABILITA.test(t) || NOVE.test(t);
}

const maiuscolaIniziale = (t) => (t ? t[0].toLocaleUpperCase('it') + t.slice(1) : t);

/** "SS47 Della Valsugana" → "SS47 della Valsugana"; "SP73(VI)" → "SP73 (VI)". */
function stradaCciss(titolo) {
  return titolo.replace(/(\d)\((\p{Lu}{2})\)/u, '$1 ($2)').replace(/(?<=\S\s)(Della|Dello|Delle|Degli|Del|Dei|Di|Da|Dal)(?=\s)/g, (p) => p.toLowerCase());
}

function chiaveDoppione(t) {
  return t.toLocaleLowerCase('it').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function perDataDecrescente(a, b) {
  return a.quando < b.quando ? 1 : a.quando > b.quando ? -1 : 0;
}

/** Voci del feed CCISS → avvisi di tipo 'evento' che riguardano Bassano, dal più recente. */
export function filtraCciss(voci) {
  const avvisi = [];
  const visti = new Set();
  for (const voce of voci || []) {
    if (!voce?.titolo || !voce.quando) continue;
    const titolo = testoSemplice(voce.titolo);
    let corpo = testoSemplice(voce.descrizione);
    corpo = corpo.replace(/\(\s*Fonte:[^)]*\)/gi, ' ');
    if (corpo.toLowerCase().startsWith(titolo.toLowerCase())) corpo = corpo.slice(titolo.length);
    corpo = corpo.replace(/\s+/g, ' ').trim();
    if (!riguardaBassanoCciss(titolo, corpo)) continue;
    const strada = stradaCciss(titolo);
    const testo = tronca(maiuscolaIniziale(corpo || titolo));
    const chiave = chiaveDoppione(`${strada} ${testo}`);
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    avvisi.push({
      tipo: 'evento',
      strada,
      testo,
      quando: voce.quando,
      fonte: FONTE_CCISS.nome,
      url: FONTE_CCISS.url,
    });
  }
  return avvisi.sort(perDataDecrescente);
}

// ---------------------------------------------------------------------------
// CCISS per zona: gli eventi validi (in corso o programmati) in un riquadro attorno a Bassano
// ---------------------------------------------------------------------------
//
// La mappa di https://www.cciss.it/web/cciss/situazione-della-viabilita chiede gli eventi
// di un riquadro (angolo sud-ovest `so` e nord-est `ne`, in ordine lat,lon) a un indirizzo
// della pagina stessa. Risponde JSON (anche se dichiara text/html):
//   { "eventiTrafficoList": [ { titolo, evento, trattoEvento, dettaglio, stato,
//       dataPubblicazione: "12/10/2026 10:41" (ora italiana), fonte, priorita,
//       percorsoTO: { coordinateMappaInizioTO: { coordinateMappaCX: lon, coordinateMappaCY: lat },
//                     coordinateMappaFineTO: { ... } } }, ... ], "html": "..." }
// Controllato il 18/11/2026. Non è un servizio documentato: se cambia, lo script torna
// all'RSS nazionale (filtraCciss), che però tiene solo 100 eventi in tutta Italia.
// Rispetto all'RSS dà anche gli eventi lunghi (un tratto chiuso per lavori per settimane)
// e quelli sulle strade provinciali. Lo stato ACTIVE vuol dire avviso valido: l'evento può
// essere in corso o programmato (una chiusura che comincia domani), il testo dice quando.
// Attenzione allo zoom (`_z`): fa da filtro sulla priorità. Fino a 14 il CCISS manda solo gli
// eventi di priorità Alta e Molto Alta; da 16 arrivano anche Normale e Bassa, come i lavori
// sulla SS47 a Bassano (provato il 18/11/2026: 2 eventi a z=11 e z=14, 12 a z=16 e z=18).

/** Centro di Bassano (Ponte Vecchio, circa) e raggio entro cui un evento ci riguarda. */
export const CENTRO_BASSANO = { lat: 45.7665, lon: 11.7345 };
export const RAGGIO_EVENTI_KM = 12;
export const MASSIMO_EVENTI = 15;
/** Zoom chiesto al CCISS: almeno 16, altrimenti arrivano solo gli eventi più gravi. */
export const ZOOM_CCISS = 16;
/** Il riquadro chiesto al CCISS: poco più largo del raggio, in ordine lat,lon. */
export const RIQUADRO_CCISS = { so: '45.65,11.58', ne: '45.88,11.89' };
export const PAGINA_CCISS = 'https://www.cciss.it/web/cciss/situazione-della-viabilita';

/** Indirizzo da cui si scaricano gli eventi del riquadro attorno a Bassano. */
export function urlCcissZona() {
  const p = '_2_WAR_ccissservizimapsportlet_';
  const q = new URLSearchParams({
    p_p_id: '2_WAR_ccissservizimapsportlet',
    p_p_lifecycle: '2',
    [`${p}so`]: RIQUADRO_CCISS.so,
    [`${p}ne`]: RIQUADRO_CCISS.ne,
    [`${p}z`]: String(ZOOM_CCISS),
  });
  return `${PAGINA_CCISS}?${q}`;
}

/** Scarto in millisecondi tra l'ora italiana e UTC in un certo istante (1 o 2 ore). */
function scartoRoma(ms) {
  const parti = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  const comeUtc = Date.UTC(+parti.year, +parti.month - 1, +parti.day, +parti.hour, +parti.minute, +parti.second);
  return comeUtc - Math.floor(ms / 1000) * 1000;
}

/** "12/10/2026 10:41" in ora italiana → ISO 8601 in UTC, o null se non si legge. */
export function oraItaliana(testo) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})[:.](\d{2})$/.exec(String(testo ?? '').trim());
  if (!m) return null;
  const [g, me, a, h, mi] = m.slice(1).map(Number);
  if (me < 1 || me > 12 || g < 1 || g > 31 || h > 23 || mi > 59) return null;
  const locale = Date.UTC(a, me - 1, g, h, mi);
  const controllo = new Date(locale);
  if (controllo.getUTCDate() !== g || controllo.getUTCMonth() !== me - 1) return null; // 31/11 e simili
  // Due passate: la prima stima lo scarto, la seconda lo corregge vicino al cambio dell'ora.
  let utc = locale - scartoRoma(locale);
  utc = locale - scartoRoma(utc);
  return new Date(utc).toISOString();
}

/** Distanza in km tra due punti (formula dell'emisenoverso). */
export function distanzaKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function puntoCciss(c) {
  const lat = Number(c?.coordinateMappaCY);
  const lon = Number(c?.coordinateMappaCX);
  if (c?.coordinateMappaCY == null || c?.coordinateMappaCX == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/** I punti di un evento: inizio, fine e il punto di mezzo, quelli che ci sono. */
function puntiEvento(e) {
  const inizio = puntoCciss(e?.percorsoTO?.coordinateMappaInizioTO);
  const fine = puntoCciss(e?.percorsoTO?.coordinateMappaFineTO);
  const punti = [inizio, fine].filter(Boolean);
  if (inizio && fine) punti.push({ lat: (inizio.lat + fine.lat) / 2, lon: (inizio.lon + fine.lon) / 2 });
  return punti;
}

/**
 * Dal testo scaricato alla lista degli eventi. Lancia un errore se la risposta non è il
 * JSON atteso (struttura cambiata, pagina d'errore): in quel caso lo script torna all'RSS.
 * Una lista vuota è una risposta valida: vuol dire che nella zona non c'è nessun evento.
 */
export function leggiCcissZona(testo) {
  let dati;
  try {
    dati = JSON.parse(String(testo ?? ''));
  } catch {
    throw new Error('la risposta del CCISS per zona non è JSON: struttura cambiata?');
  }
  const lista = dati?.eventiTrafficoList;
  if (!Array.isArray(lista)) throw new Error('nella risposta del CCISS per zona manca eventiTrafficoList: struttura cambiata?');
  if (lista.length > 0 && !lista.some((e) => e && typeof e.titolo === 'string' && oraItaliana(e.dataPubblicazione))) {
    throw new Error(`${lista.length} eventi del CCISS per zona ma nessuno con titolo e data leggibili: formato cambiato?`);
  }
  return lista;
}

/**
 * Eventi del CCISS per zona → avvisi di tipo 'evento' con `attivo: true` (la fonte li dava
 * come validi, in corso o programmati, quando è stata fatta la fotografia). Teniamo gli
 * eventi ACTIVE con almeno un punto entro 12 km dal centro di Bassano, oppure che nominano
 * Bassano o le sue strade con i comuni vicini (stesse regole dell'RSS). Se sono più di 15
 * restano i 15 più vicini al centro; poi si ordinano dal più recente.
 */
export function filtraCcissZona(eventi) {
  const avvisi = [];
  const visti = new Set();
  for (const e of eventi || []) {
    if (!e || typeof e.titolo !== 'string') continue;
    if (e.stato != null && e.stato !== 'ACTIVE') continue;
    const quando = oraItaliana(e.dataPubblicazione);
    if (!quando) continue;
    const titolo = testoSemplice(e.titolo);
    if (!titolo) continue;
    let corpo = testoSemplice(e.dettaglio);
    if (corpo.toLowerCase().startsWith(titolo.toLowerCase())) corpo = corpo.slice(titolo.length).trim();
    if (!corpo) corpo = testoSemplice(`${e.evento ?? ''} ${e.trattoEvento ?? ''}`);
    const distanze = puntiEvento(e).map((p) => distanzaKm(p, CENTRO_BASSANO));
    const distanza = distanze.length > 0 ? Math.min(...distanze) : Infinity;
    if (distanza > RAGGIO_EVENTI_KM && !riguardaBassanoCciss(titolo, corpo)) continue;
    const strada = stradaCciss(titolo);
    const testo = tronca(maiuscolaIniziale(corpo || titolo));
    const chiave = chiaveDoppione(`${strada} ${testo}`);
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    avvisi.push({
      distanza,
      avviso: {
        tipo: 'evento',
        strada,
        testo,
        quando,
        fonte: FONTE_CCISS.nome,
        url: PAGINA_CCISS,
        attivo: true,
      },
    });
  }
  return avvisi
    // A pari distanza, i più recenti.
    .sort((a, b) => a.distanza - b.distanza || perDataDecrescente(a.avviso, b.avviso))
    .slice(0, MASSIMO_EVENTI)
    .map((x) => x.avviso)
    .sort(perDataDecrescente);
}

/** Dove finisce il nome della strada nel titolo di un'ordinanza. */
const FINE_STRADA = new RegExp(
  `\\s*(?:[,;(]|\\s-\\d|\\s(?:dal\\s+km|al\\s+km|km\\s|nei?\\s+comun|in\\s+comun|del\\s+comun|nel\\s+tratto|nei\\s+tratti|nei\\s+seguenti|tratti\\s|vari\\s+tratti|da\\s|fra\\s|tra\\s|all${AP}|dentro\\s|fuori\\s|in\\s+corrispondenza|e\\s+la\\s+S|per\\s))`,
  'iu',
);

/**
 * La parte "S.P. NN Nome" del titolo di un'ordinanza, es. "S.P. 74 Pedemontana del Grappa".
 * Per più strade insieme ("SS.PP. 69, 94 e 52 nei comuni di ...") resta l'elenco dei numeri.
 */
export function stradaViabilita(titolo) {
  let t = testoSemplice(titolo);
  t = t.replace(/^\d+\.\s+/, '');
  t = t.replace(/^S\.+\s*P\.+\s*(?:S\.+\s*P\.+\s*)+/i, 'S.P. ');
  const piu = /^SS\.?\s*PP\.?\s*(.+)$/i.exec(t);
  if (piu) {
    const resto = piu[1].split(/,?\s+(?:nei?\s+comun|in\s+comun|del\s+comun|per\s)/i)[0].replace(/[\s,;.]+$/, '');
    return resto ? `SS.PP. ${resto}` : 'Strade provinciali';
  }
  const una = /^S\.*\s*P\.*\s*(\d.*)$/i.exec(t);
  if (!una) return 'Strade provinciali';
  let resto = una[1];
  const fine = FINE_STRADA.exec(resto);
  if (fine) resto = resto.slice(0, fine.index);
  resto = resto.replace(/["“”«»]/g, '').replace(/\s+/g, ' ').replace(/[\s.]+$/, '').trim();
  return `S.P. ${resto}`;
}

/** Toglie dal testo di un'ordinanza l'intestazione d'ufficio, la coda di WordPress e i nomi di file. */
function corpoOrdinanza(descrizione) {
  // La coda "L'articolo <a>titolo</a> proviene da <a>Vi.abilità srl</a>." è l'ultimo paragrafo.
  const html = String(descrizione ?? '').replace(/<p>\s*L(?:['’‘`]|&#0?39;|&#8217;|&apos;|&rsquo;)articolo\s[\s\S]*?proviene\s+da[\s\S]*?<\/p>/giu, ' ');
  let t = testoSemplice(html);
  t = t.replace(new RegExp(`L${AP}articolo\\s.*?proviene\\s+da\\s+Vi\\.abilità\\s+srl\\.?`, 'giu'), ' ');
  // Intestazione: "Prot. 22956 AM/bs Vicenza, 09/11/2026 Pratica C2844-2026 - rep. ord. 410/2026 Rif. fascicolo 2026-III/2.001"
  if (/^\s*Prot\b/i.test(t)) {
    const conFascicolo = t.replace(/^\s*Prot\b.*?Rif\.?\s*fascicolo\s+\S+\s*/i, '');
    const conOrdinanza = t.replace(/^\s*Prot\b.*?rep\.?\s*ord\.?\s*\d+\s*\/\s*\d{4}\s*/i, '');
    const conData = t.replace(/^\s*Prot\b.*?Vicenza,?\s*\d{1,2}\/\d{1,2}\/\d{4}\s*/i, '');
    t = [conFascicolo, conOrdinanza, conData].find((x) => x !== t) ?? '';
  }
  // Sigle di chi ha scritto l'atto ("AM/bs"), se sono rimaste.
  t = t.replace(/(?<![\p{L}\p{N}/])[A-Z]{2,3}\/[a-z]{2,3}(?![\p{L}\p{N}/])/gu, ' ');
  // Nomi di file allegati.
  t = t.replace(/\S+\.(?:pdf|docx?|p7m)\b/gi, ' ');
  // WordPress chiude i riassunti con "[…]".
  t = t.replace(/\s*\[\s*(?:…|\.\.\.)\s*\]\s*$/, '…');
  t = t.replace(/^Ordinanza\s+ordinanza\b/i, 'Ordinanza');
  // Riferimenti d'ufficio dentro il testo: non servono a chi legge.
  t = t.replace(/\s*-?\s*concessione\s+prot\.?\s*(?:n\.?\s*)?\d+(?:\s+del\s+\d{1,2}\/\d{1,2}\/\d{4})?/gi, '');
  t = t.replace(/\s*-?\s*\bC(?:UP|IG)\b\s*:?\s*[A-Z0-9]{6,}/g, '');
  t = t.replace(/\s*-?\s*\bOM\s+\d+\s*\/\s*\d{4}\b/g, '');
  t = t.replace(/\s*-?\s*\bAREA\s+(?:NORD|SUD|EST|OVEST)(?:[\s-]+(?:NORD|SUD|EST|OVEST))?\b/g, '');
  t = t.replace(/\s*-?\s*\bSS\.?\s*PP\.?\s+Varie\b/gi, '');
  t = t.replace(/\s+([,.;:])/g, '$1').replace(/,\s*(?=[,.])/g, '');
  return t.replace(/\s+/g, ' ').trim();
}

const DATA = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
const ORARIO = '\\d{1,2}(?:[.:]\\d{2})?';
const PERIODO_DAL_AL = new RegExp(
  `^dal\\s+(\\d{1,2}\\/\\d{1,2}\\/\\d{4})\\s+al\\s+(\\d{1,2}\\/\\d{1,2}\\/\\d{4})(?:,?\\s+dalle\\s+ore\\s+(${ORARIO})\\s+alle\\s+ore\\s+(${ORARIO}))?`,
  'i',
);

/**
 * Divide il testo pulito di un'ordinanza in "cosa" (tutto quello che viene prima di
 * "Periodo:") e periodo dei lavori. `periodo` è una frase breve, per esempio
 * "dal 16/11/2026 al 18/12/2026, dalle ore 8:30 alle ore 16:30", o null se il testo non lo
 * dichiara. `fine` è la mezzanotte (UTC) dopo l'ultimo giorno nominato nel periodo, in
 * millisecondi, o null se non si legge nessuna data: serve a scartare i lavori già finiti.
 */
export function periodoOrdinanza(testo) {
  const t = String(testo ?? '');
  const m = /(?:^|[\s,.;])Periodo\s*:\s*/i.exec(t);
  if (!m) return { cosa: t.trim(), periodo: null, fine: null };
  const cosa = t.slice(0, m.index).replace(/[\s,;:]+$/, '').trim();
  let frase = t.slice(m.index + m[0].length).trim();
  // La frase del periodo finisce al primo punto fermo ("8.30" non è un punto fermo).
  const stop = /\.(?=\s|$)|\s*…\s*$/.exec(frase);
  const intera = stop ? frase.slice(0, stop.index) : frase;
  const tagliata = /…\s*$/.test(frase) && (!stop || stop[0].includes('…'));
  let fine = null;
  for (const d of intera.matchAll(DATA)) {
    const giorno = Date.UTC(Number(d[3]), Number(d[2]) - 1, Number(d[1]) + 1);
    if (Number.isFinite(giorno) && (fine === null || giorno > fine)) fine = giorno;
  }
  const preciso = PERIODO_DAL_AL.exec(intera);
  let periodo;
  if (preciso) {
    periodo = `dal ${preciso[1]} al ${preciso[2]}`;
    if (preciso[3]) periodo += `, dalle ore ${preciso[3]} alle ore ${preciso[4]}`;
  } else {
    periodo = tronca(intera.replace(/[\s,;:]+$/, ''), 120);
    // Un riassunto tagliato a metà del periodo non dice quando finiscono i lavori.
    if (tagliata) periodo = null;
  }
  return { cosa, periodo: periodo || null, fine: preciso || !tagliata ? fine : null };
}

/** Accorcia la formula fissa delle ordinanze: resta "Senso unico alternato". */
function cosaInBreve(cosa) {
  let t = String(cosa ?? '');
  t = t.replace(
    new RegExp(`^(?:Ordinanza\\s+)?(?:per\\s+|di\\s+)?(?:l${AP}\\s*)?istituzione\\s+di\\s+(?:un\\s+)?senso\\s+unico\\s+alternato(?:\\s+della\\s+circolazione\\s+stradale)?`, 'iu'),
    'Senso unico alternato',
  );
  // Nel feed la formula a volte non ha il punto: "…stradale Interventi di consolidamento…".
  t = t.replace(/^Senso unico alternato\s+(?=\p{Lu})/u, 'Senso unico alternato. ');
  t = t.replace(/\s+([,.;:])/g, '$1').replace(/[\s,;:\-]+$/, '').trim();
  return t;
}

/**
 * Voci del feed di Vi.abilità → avvisi di tipo 'ordinanza' sulle strade del bassanese:
 * solo gli ultimi 120 giorni rispetto ad `adesso`, al massimo 10, dal più recente. Le
 * ordinanze che dichiarano un periodo già finito il giorno prima di `adesso` si scartano.
 * Il testo è "dove. Periodo: dal ... al ... . cosa", così il taglio non toglie mai il periodo.
 */
export function filtraViabilita(voci, adesso = new Date()) {
  const ora = adesso instanceof Date ? adesso.getTime() : new Date(adesso).getTime();
  const limite = ora - GIORNI_ORDINANZE * 24 * 3600 * 1000;
  const avvisi = [];
  const visti = new Set();
  const ordinate = [...(voci || [])].filter((v) => v?.titolo && v.quando).sort(perDataDecrescente);
  for (const voce of ordinate) {
    const millis = Date.parse(voce.quando);
    if (Number.isNaN(millis) || millis < limite || millis > ora + 24 * 3600 * 1000) continue;
    const titolo = testoSemplice(voce.titolo);
    if (UFFICIO.test(titolo)) continue;
    if (!riguardaBassaneseViabilita(titolo)) continue;
    // Il testo intero, se c'è: il riassunto si ferma spesso prima della data di fine lavori.
    const { cosa, periodo, fine } = periodoOrdinanza(corpoOrdinanza(voce.contenuto || voce.descrizione));
    if (fine !== null && fine <= ora) continue;
    // Due ordinanze con lo stesso titolo ma periodi diversi sono due avvisi diversi.
    const chiave = chiaveDoppione(`${titolo} ${periodo ?? ''}`);
    if (visti.has(chiave)) continue;
    visti.add(chiave);

    const tratto = trattoDelBassanese(titolo);
    const strada = stradaViabilita(tratto);
    // Il titolo dice dove (chilometri e comune), il testo dice cosa e quando.
    let dove = tratto.replace(/^\d+\.\s+/, '').replace(/[\s.,;]+$/, '');
    const senzaStrada = strada !== 'Strade provinciali' ? dopoLaStrada(dove, strada) : null;
    if (senzaStrada) dove = maiuscolaIniziale(senzaStrada);
    const pezzi = [dove, periodo ? `Periodo: ${periodo}` : '', cosaInBreve(cosa)].filter(Boolean);
    const testo = tronca(pezzi.length > 1 ? pezzi.map((p) => p.replace(/[.\s]+$/, '')).join('. ') + '.' : dove);
    const link = /^https:\/\/vi-abilita\.it\//.test(voce.link || '') ? voce.link : FONTE_VIABILITA.url;
    avvisi.push({
      tipo: 'ordinanza',
      strada,
      testo,
      quando: voce.quando,
      fonte: FONTE_VIABILITA.nome,
      url: link,
    });
    if (avvisi.length >= MASSIMO_ORDINANZE) break;
  }
  return avvisi;
}

/**
 * Alcune ordinanze elencano nel titolo molte strade, ognuna con il suo comune
 * ("S.P. 52 ... nei comuni di Pozzoleone e Sandrigo, S.P. 248 ... in comune di Marostica, ...").
 * In quel caso serve il pezzo che tocca il bassanese, non il primo. Se il comune è detto
 * una volta sola per tutte le strade, il titolo resta intero.
 */
export function trattoDelBassanese(titolo) {
  const t = String(titolo ?? '');
  const pezzi = t.split(/(?<=\s)(?=S\.+\s*P\.+\s*\d)/i);
  if (pezzi.length < 2) return t;
  const quale = pezzi.findIndex((p) => riguardaBassaneseViabilita(p));
  if (quale <= 0) return t;
  if (!pezzi.slice(0, quale).some((p) => /\bcomun/i.test(p))) return t;
  return pezzi[quale].replace(/(?:[\s,;.]|\se(?:\s+la)?)+$/i, '').trim();
}

/** Il titolo senza il nome della strada davanti: "dal km 2+454 al km 2+567 in comune di ...". */
function dopoLaStrada(titolo, strada) {
  if (strada.startsWith('SS.PP.')) {
    // Più strade insieme: il titolo comincia con l'elenco dei numeri, già messo in `strada`.
    const dopo = /^SS\.?\s*PP\.?\s*/i.exec(titolo);
    const elenco = strada.slice('SS.PP. '.length);
    if (!dopo || !titolo.slice(dopo[0].length).startsWith(elenco)) return null;
    const resto = titolo.slice(dopo[0].length + elenco.length).replace(/^[\s,]+/, '');
    return resto.length >= 8 ? resto : null;
  }
  const nome = strada.replace(/^S\.P\.\s*/, '');
  const parti = nome.split(/\s+/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const m = new RegExp(`^(?:S\\.*\\s*P\\.*\\s*)+["“”«»]?${parti.join('["“”«»]?\\s+["“”«»]?')}["“”«»]?[\\s,]*`, 'iu').exec(titolo);
  if (!m) return null;
  const resto = titolo.slice(m[0].length).trim();
  return resto.length >= 8 ? resto : null;
}

/**
 * Le ordinanze di una fotografia precedente che valgono ancora: servono quando Vi.abilità
 * non risponde, per non far sparire dal sito ordinanze in vigore. Si riapplicano il limite
 * dei 120 giorni e quello delle 10 voci. Gli eventi del CCISS non si conservano mai: un
 * evento di traffico vecchio non dice più nulla di certo.
 */
export function ordinanzePrecedenti(datiVecchi, adesso = new Date()) {
  const ora = adesso instanceof Date ? adesso.getTime() : new Date(adesso).getTime();
  const limite = ora - GIORNI_ORDINANZE * 24 * 3600 * 1000;
  const avvisi = Array.isArray(datiVecchi?.avvisi) ? datiVecchi.avvisi : [];
  return avvisi
    .filter((a) => {
      if (!a || a.tipo !== 'ordinanza' || a.fonte !== FONTE_VIABILITA.nome) return false;
      if (typeof a.testo !== 'string' || typeof a.strada !== 'string' || typeof a.url !== 'string') return false;
      const millis = Date.parse(a.quando);
      return !Number.isNaN(millis) && millis >= limite && millis <= ora + 24 * 3600 * 1000;
    })
    .sort(perDataDecrescente)
    .slice(0, MASSIMO_ORDINANZE);
}

/**
 * Controlla che le voci lette da un feed si possano usare: lancia un errore se non ce ne
 * sono, o se nessuna ha una data leggibile (segno che il feed ha cambiato formato: senza
 * questo controllo le voci verrebbero scartate tutte in silenzio).
 */
export function controllaVoci(voci) {
  if (!Array.isArray(voci) || voci.length === 0) throw new Error('il feed non contiene voci: struttura cambiata?');
  if (!voci.some((v) => v?.quando)) throw new Error(`${voci.length} voci lette ma nessuna con una data leggibile: formato delle date cambiato?`);
  return voci;
}

/** Mette insieme le due liste, dalla più recente. */
export function unisciAvvisi(...liste) {
  return liste.flat().sort(perDataDecrescente);
}
