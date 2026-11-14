// Aiuti puri dell'interfaccia: ricerca, date e numeri in italiano, parole per la
// tendenza del fiume, indirizzi dei video. Nessun DOM qui dentro: si provano con vitest.

import type { Fonte, IdStrato, Punto, Storia, TipoPunto } from '../types';

// ---------------------------------------------------------------------------
// Ricerca nei luoghi
// ---------------------------------------------------------------------------

/** Minuscole, senza accenti e senza punteggiatura: "Calà del Sasso" → "cala del sasso". */
export function normalizza(testo: string): string {
  return testo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Il nome senza l'articolo davanti: "Il Brenta" va sotto la B. */
export function chiaveOrdine(nome: string): string {
  return normalizza(nome).replace(/^(il|lo|la|i|gli|le|l|un|una) (?=.)/, '');
}

/**
 * Storie che contengono tutte le parole cercate nel nome o nel sottotitolo.
 * Prima quelle che le hanno nel nome. La ricerca vuota restituisce tutto, in ordine alfabetico (senza contare gli articoli).
 */
export function filtraStorie(storie: Storia[], domanda: string): Storia[] {
  const parole = normalizza(domanda).split(' ').filter(Boolean);
  const ordinate = [...storie].sort((a, b) => chiaveOrdine(a.nome).localeCompare(chiaveOrdine(b.nome), 'it'));
  if (parole.length === 0) return ordinate;
  const nelNome: Storia[] = [];
  const altrove: Storia[] = [];
  for (const s of ordinate) {
    const nome = normalizza(s.nome);
    const tutto = nome + ' ' + normalizza(s.sottotitolo);
    if (parole.every((p) => nome.includes(p))) nelNome.push(s);
    else if (parole.every((p) => tutto.includes(p))) altrove.push(s);
  }
  return [...nelNome, ...altrove];
}

/** Tipi di punto che danno un dato o un servizio: stanno sempre nell'elenco «Luoghi». */
const TIPI_SERVIZIO: TipoPunto[] = ['aria', 'idrometro', 'webcam', 'stazione'];
/** Quanti altri punti della mappa mostrare al massimo tra i risultati di una ricerca. */
export const MASSIMO_ALTRI_PUNTI = 40;

/**
 * I punti della mappa per l'elenco «Luoghi», così le loro schede si aprono anche senza
 * toccare la mappa (tastiera, lettore di schermo). `servizi`: aria, idrometro, webcam e
 * stazione, sempre presenti (filtrati se si cerca). `altri`: tutti gli altri punti senza
 * racconto (monumenti, chiese, fermate, bici), solo quando si cerca qualcosa; `altriInTutto`
 * dice quanti sarebbero senza il limite.
 */
export function filtraPunti(
  punti: Punto[],
  domanda: string,
): { servizi: Punto[]; altri: Punto[]; altriInTutto: number } {
  const parole = normalizza(domanda).split(' ').filter(Boolean);
  const perNome = (a: Punto, b: Punto): number =>
    chiaveOrdine(a.nome).localeCompare(chiaveOrdine(b.nome), 'it') || a.id.localeCompare(b.id);
  const contiene = (p: Punto): boolean => {
    const testo = normalizza(`${p.nome} ${NOME_TIPO[p.tipo] ?? ''}`);
    return parole.every((parola) => testo.includes(parola));
  };
  const servizi = punti.filter((p) => TIPI_SERVIZIO.includes(p.tipo) && contiene(p)).sort(perNome);
  if (parole.length === 0) return { servizi, altri: [], altriInTutto: 0 };
  const tutti = punti
    .filter((p) => !TIPI_SERVIZIO.includes(p.tipo) && p.storia === undefined && contiene(p))
    .sort(perNome);
  return { servizi, altri: tutti.slice(0, MASSIMO_ALTRI_PUNTI), altriInTutto: tutti.length };
}

/** Separa i luoghi dai temi. */
export function dividiStorie(storie: Storia[]): { luoghi: Storia[]; temi: Storia[] } {
  return {
    luoghi: storie.filter((s) => s.genere !== 'tema'),
    temi: storie.filter((s) => s.genere === 'tema'),
  };
}

/** "1 risultato", "3 risultati", "Nessun risultato". */
export function contaRisultati(n: number): string {
  if (n === 0) return 'Nessun risultato';
  return n === 1 ? '1 risultato' : `${n} risultati`;
}

// ---------------------------------------------------------------------------
// Numeri
// ---------------------------------------------------------------------------

/** Numero all'italiana, con la virgola: formattaNumero(0.96, 2) → "0,96". */
export function formattaNumero(n: number, decimali = 0): string {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  }).format(n);
}

/** Livello del fiume: "0,96 m". */
export function formattaLivello(metri: number): string {
  return `${formattaNumero(metri, 2)} m`;
}

/** Portata: "51,8 m³/s". */
export function formattaPortata(m3s: number): string {
  return `${formattaNumero(m3s, m3s >= 100 ? 0 : 1)} m³/s`;
}

/** Differenza di livello in centimetri, con il segno: "+13 cm", "−4 cm", "0 cm". */
export function formattaDifferenza(metri: number): string {
  const cm = Math.round(metri * 100);
  if (cm === 0) return '0 cm';
  return `${cm > 0 ? '+' : '−'}${Math.abs(cm)} cm`;
}

/** Valore di una misura dell'aria: fino a una cifra decimale, senza zeri inutili. */
export function formattaMisura(valore: number): string {
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(valore);
}

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

const SOLO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const CON_FUSO = /(?:Z|[+-]\d{2}:?\d{2})$/;

interface DataLetta {
  data: Date;
  /** Fuso in cui mostrarla. */
  fuso: string;
  soloData: boolean;
}

/**
 * Le date senza fuso ("2026-11-14T23:40:00", come quelle di ARPAV) si mostrano tali e
 * quali. Quelle con il fuso ("...Z") si mostrano nell'ora italiana.
 */
function leggiData(iso: string): DataLetta | null {
  const testo = iso.trim();
  if (SOLO_DATA.test(testo)) {
    const data = new Date(testo + 'T00:00:00Z');
    return Number.isNaN(data.getTime()) ? null : { data, fuso: 'UTC', soloData: true };
  }
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(testo)) return null;
  const conT = testo.replace(' ', 'T');
  if (CON_FUSO.test(conT)) {
    const data = new Date(conT);
    return Number.isNaN(data.getTime()) ? null : { data, fuso: 'Europe/Rome', soloData: false };
  }
  const data = new Date(conT + 'Z');
  return Number.isNaN(data.getTime()) ? null : { data, fuso: 'UTC', soloData: false };
}

function parti(d: DataLetta, opzioni: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('it-IT', { ...opzioni, timeZone: d.fuso }).format(d.data);
}

/** "14 novembre 2026". Se la stringa non è una data, la restituisce com'è. */
export function formattaData(iso: string): string {
  const d = leggiData(iso);
  if (!d) return iso;
  return parti(d, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "23:40". Stringa vuota se manca l'ora. */
export function formattaOra(iso: string): string {
  const d = leggiData(iso);
  if (!d || d.soloData) return '';
  return parti(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

/** "sabato 14 novembre, ore 23:40" oppure, senza ora, "sabato 14 novembre". */
export function formattaDataOra(iso: string): string {
  const d = leggiData(iso);
  if (!d) return iso;
  const giorno = parti(d, { weekday: 'long', day: 'numeric', month: 'long' });
  if (d.soloData) return giorno;
  return `${giorno}, ore ${formattaOra(iso)}`;
}

/** "14 novembre 2026, ore 06:00": per le date di generazione dei dati. */
export function formattaDataOraLunga(iso: string): string {
  const d = leggiData(iso);
  if (!d) return iso;
  if (d.soloData) return formattaData(iso);
  return `${formattaData(iso)}, ore ${formattaOra(iso)}`;
}

/**
 * "portata 51,8 m³/s", con l'ora se la portata non è della stessa lettura del livello
 * (ARPAV la pubblica spesso con un passo di ritardo).
 */
export function testoPortata(portata: number, quandoPortata: string | null, quandoLivello: string): string {
  const base = `portata ${formattaPortata(portata)}`;
  if (!quandoPortata || quandoPortata === quandoLivello) return base;
  const ora = formattaOra(quandoPortata);
  return ora ? `${base} (alle ${ora})` : base;
}

/** Durata coperta da una serie: "Ultimi 3 giorni", "Ultime 8 ore", "Ultimo giorno". */
export function descriviDurata(ore: number): string {
  if (ore < 1) return 'Ultima ora';
  if (ore < 36) {
    const n = Math.round(ore);
    return n === 1 ? 'Ultima ora' : `Ultime ${n} ore`;
  }
  const giorni = Math.round(ore / 24);
  return giorni === 1 ? 'Ultimo giorno' : `Ultimi ${giorni} giorni`;
}

// ---------------------------------------------------------------------------
// Tendenza del fiume
// ---------------------------------------------------------------------------

export interface TendenzaLetta {
  verso: 'sale' | 'scende' | 'stabile';
  differenza: number;
  ore: number;
}

function descriviOre(ore: number): string {
  const n = Math.round(ore);
  if (n <= 1) return "un'ora prima";
  return `${n} ore prima`;
}

/** "In salita: +13 cm rispetto a 3 ore prima". Stringa vuota se non c'è confronto. */
export function parolaTendenza(t: TendenzaLetta | null): string {
  if (!t) return '';
  const prima = descriviOre(t.ore);
  if (t.verso === 'sale') return `In salita: ${formattaDifferenza(t.differenza)} rispetto a ${prima}`;
  if (t.verso === 'scende') return `In calo: ${formattaDifferenza(t.differenza)} rispetto a ${prima}`;
  return `Stabile rispetto a ${prima}`;
}

// ---------------------------------------------------------------------------
// Grafico piccolo del livello
// ---------------------------------------------------------------------------

export interface Tracciato {
  /** Attributo d della linea. */
  linea: string;
  /** Attributo d dell'area sotto la linea. */
  area: string;
  minimo: number;
  massimo: number;
  /** Posizione dell'ultimo punto. */
  ultimo: { x: number; y: number };
}

/** Disegna una serie dentro un rettangolo. Restituisce null con meno di due punti. */
export function tracciaSerie(
  valori: number[],
  larghezza: number,
  altezza: number,
  margine = 4,
  massimoPunti = 160,
): Tracciato | null {
  if (valori.length < 2) return null;
  const passo = Math.max(1, Math.ceil(valori.length / massimoPunti));
  const scelti: number[] = [];
  for (let i = 0; i < valori.length; i += passo) scelti.push(valori[i]);
  const ultimoValore = valori[valori.length - 1];
  if ((valori.length - 1) % passo !== 0) scelti.push(ultimoValore);

  const minimo = Math.min(...valori);
  const massimo = Math.max(...valori);
  // Un fiume fermo non deve sembrare in tempesta: scala minima di 10 cm.
  const ampiezza = Math.max(massimo - minimo, 0.1);
  const centro = (massimo + minimo) / 2;
  const basso = centro - ampiezza / 2;
  const utileX = larghezza - margine * 2;
  const utileY = altezza - margine * 2;
  const r = (n: number): number => Math.round(n * 10) / 10;

  const punti = scelti.map((v, i) => ({
    x: r(margine + (i / (scelti.length - 1)) * utileX),
    y: r(margine + (1 - (v - basso) / ampiezza) * utileY),
  }));
  const linea = punti.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const fine = punti[punti.length - 1];
  const area = `${linea} L${fine.x} ${altezza} L${punti[0].x} ${altezza} Z`;
  return { linea, area, minimo, massimo, ultimo: fine };
}

// ---------------------------------------------------------------------------
// Indirizzi
// ---------------------------------------------------------------------------

/** Solo indirizzi http e https: tutto il resto diventa null. */
export function urlSicuro(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;

/** Estrae l'identificativo da un indirizzo di YouTube (watch, youtu.be, embed, shorts). */
export function idYouTube(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = u.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const pezzi = u.pathname.split('/').filter(Boolean);
    if (pezzi[0] === 'watch') id = u.searchParams.get('v');
    else if (pezzi[0] === 'embed' || pezzi[0] === 'shorts' || pezzi[0] === 'live') id = pezzi[1] ?? null;
  }
  return id && ID_YOUTUBE.test(id) ? id : null;
}

/**
 * Indirizzo da mettere nell'iframe: sempre youtube-nocookie, mai altro.
 * Restituisce null se l'indirizzo non è di YouTube: in quel caso non si incorpora nulla.
 */
export function urlIncorporamento(url: string, avvia = false): string | null {
  const id = idYouTube(url);
  if (!id) return null;
  const base = `https://www.youtube-nocookie.com/embed/${id}`;
  const parametri = new URLSearchParams();
  try {
    const inizio = new URL(url).searchParams.get('start');
    if (inizio && /^\d+$/.test(inizio)) parametri.set('start', inizio);
  } catch {
    // indirizzo già controllato da idYouTube
  }
  if (avvia) parametri.set('autoplay', '1');
  parametri.set('rel', '0');
  return `${base}?${parametri.toString()}`;
}

/** Pagina del video su YouTube, per chi preferisce aprirlo là. */
export function urlPaginaYouTube(url: string): string | null {
  const id = idYouTube(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

/**
 * Versione piccola di un'immagine di Wikimedia Commons (Special:FilePath?width=...).
 * Gli altri indirizzi restano come sono.
 */
export function urlMiniatura(url: string, larghezza = 500): string {
  if (!/commons\.wikimedia\.org\/wiki\/Special:FilePath\//.test(url)) return url;
  if (/[?&]width=\d+/.test(url)) return url.replace(/([?&]width=)\d+/, `$1${larghezza}`);
  return url + (url.includes('?') ? '&' : '?') + `width=${larghezza}`;
}

// ---------------------------------------------------------------------------
// Storie
// ---------------------------------------------------------------------------

/** Tutte le fonti delle tappe, una volta sola ciascuna, nell'ordine in cui compaiono. */
export function fontiUniche(storia: Storia): Fonte[] {
  const viste = new Set<string>();
  const fonti: Fonte[] = [];
  for (const t of storia.tappe) {
    if (!t.fonte || !t.fonte.url || viste.has(t.fonte.url)) continue;
    viste.add(t.fonte.url);
    fonti.push(t.fonte);
  }
  return fonti;
}

/** Indice dell'immagine legata a una tappa, se esiste davvero ed è un'immagine. */
export function immagineDellaTappa(storia: Storia, indiceTappa: number): number | null {
  const i = storia.tappe[indiceTappa]?.media;
  if (typeof i !== 'number') return null;
  return storia.media[i]?.tipo === 'immagine' ? i : null;
}

/** Indici dei media di un certo tipo; per le immagini, solo quelle non usate dalle tappe. */
export function mediaResidui(storia: Storia, tipo: 'immagine' | 'video' | 'audio'): number[] {
  const usate = new Set<number>();
  if (tipo === 'immagine') {
    storia.tappe.forEach((_, i) => {
      const m = immagineDellaTappa(storia, i);
      if (m !== null) usate.add(m);
    });
  }
  const indici: number[] = [];
  storia.media.forEach((m, i) => {
    if (m.tipo === tipo && !usate.has(i)) indici.push(i);
  });
  return indici;
}

/** Una voce dell'osservatore delle tappe, ridotta a ciò che serve per decidere. */
export interface VoceTappa<T extends object> {
  bersaglio: T;
  visibile: boolean;
  /** true se la tappa sta ancora sotto il bordo inferiore dell'area che scorre. */
  sottoIlBordo: boolean;
}

/**
 * Decide che cosa fare delle tappe di un lotto dell'osservatore. Una tappa si nasconde
 * («in arrivo») solo se sta sotto il bordo e non è mai stata mostrata; appena è visibile, o
 * è già passata sopra, si mostra e non si osserva più. Una tappa mostrata una volta resta
 * mostrata, qualunque cosa dicano le voci successive (anche nello stesso lotto).
 * `rivelate` ricorda le tappe già mostrate e viene aggiornato qui.
 */
export function decidiTappe<T extends object>(
  voci: VoceTappa<T>[],
  rivelate: WeakSet<T>,
): { bersaglio: T; azione: 'mostra' | 'nascondi' }[] {
  const azioni: { bersaglio: T; azione: 'mostra' | 'nascondi' }[] = [];
  for (const v of voci) {
    if (rivelate.has(v.bersaglio)) continue;
    if (!v.visibile && v.sottoIlBordo) {
      azioni.push({ bersaglio: v.bersaglio, azione: 'nascondi' });
    } else {
      rivelate.add(v.bersaglio);
      azioni.push({ bersaglio: v.bersaglio, azione: 'mostra' });
    }
  }
  return azioni;
}

// ---------------------------------------------------------------------------
// Etichette
// ---------------------------------------------------------------------------

export const NOME_STRATO: Record<IdStrato, string> = {
  cultura: 'Cultura',
  ambiente: 'Ambiente',
  mobilita: 'Mobilità',
};

const NOME_TIPO: Record<TipoPunto, string> = {
  museo: 'Museo',
  biblioteca: 'Biblioteca',
  teatro: 'Teatro',
  monumento: 'Monumento',
  chiesa: 'Chiesa',
  'luogo-storico': 'Luogo storico',
  aria: "Stazione della qualità dell'aria",
  idrometro: 'Idrometro',
  webcam: 'Webcam',
  'fermata-bus': "Fermata dell'autobus",
  stazione: 'Stazione',
  bici: 'Bici',
};

/** Nome leggibile di un tipo di punto. */
export function etichettaTipo(tipo: TipoPunto): string {
  return NOME_TIPO[tipo] ?? tipo;
}

const PLURALE_TIPO: Record<string, string> = {
  museo: 'musei',
  biblioteca: 'biblioteche',
  teatro: 'teatri',
  monumento: 'monumenti',
  chiesa: 'chiese',
  'luogo-storico': 'luoghi storici',
  aria: "qualità dell'aria",
  idrometro: 'livello del Brenta',
  webcam: 'webcam',
  'fermata-bus': "fermate dell'autobus",
  stazione: 'stazione',
  bici: 'bici',
  ciclabile: 'piste ciclabili',
  ferrovia: 'ferrovia',
};

const LEGENDA_BASE: Record<IdStrato, string> = {
  cultura: 'musei, monumenti, luoghi storici',
  ambiente: "qualità dell'aria, livello del Brenta",
  mobilita: 'fermate, stazione, piste ciclabili',
};

/** Che cosa mostra uno strato, a parole, a partire dai tipi presenti nei dati. */
export function descriviStrato(
  id: IdStrato,
  elementi: { strato: IdStrato; tipo: string }[],
): string {
  const visti: string[] = [];
  for (const e of elementi) {
    if (e.strato !== id) continue;
    const nome = PLURALE_TIPO[e.tipo];
    if (nome && !visti.includes(nome)) visti.push(nome);
  }
  return visti.length > 0 ? visti.join(', ') : LEGENDA_BASE[id];
}
