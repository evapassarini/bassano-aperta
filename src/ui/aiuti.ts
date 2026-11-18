// Aiuti puri dell'interfaccia: ricerca, date e numeri in italiano, parole per la
// tendenza del fiume, indirizzi dei video, tabellone dei treni, scelta degli avvisi. Nessun DOM qui dentro: si provano con vitest.

import type { Avviso, DatiAria, DatiAvvisi, Fonte, IdStrato, LetturaTreni, Punto, Storia, TipoPunto, Treno } from '../types';

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

/** Il nome senza l'articolo davanti: "La Brenta" va sotto la B. */
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
/**
 * Parole in più con cui si trova un tipo di punto: quello che la sua scheda fa vedere, anche
 * se non sta nel nome. La stazione mostra i prossimi treni.
 */
const PAROLE_TIPO: Partial<Record<TipoPunto, string>> = {
  stazione: 'treni treno ritardi ritardo partenze arrivi orari ferrovia',
};
/** Quello che la scheda di un tipo di punto offre in più, da scrivere accanto al tipo nell'elenco. */
const OFFRE_TIPO: Partial<Record<TipoPunto, string>> = {
  stazione: 'prossimi treni',
};

/** Seconda riga di una voce dell'elenco «Luoghi»: "Stazione, prossimi treni · strato Mobilità". */
export function sottoPunto(punto: Pick<Punto, 'tipo' | 'strato'>): string {
  const offre = OFFRE_TIPO[punto.tipo];
  const tipo = etichettaTipo(punto.tipo);
  return `${offre ? `${tipo}, ${offre}` : tipo} · strato ${NOME_STRATO[punto.strato] ?? punto.strato}`;
}

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
    const testo = normalizza(`${p.nome} ${NOME_TIPO[p.tipo] ?? ''} ${PAROLE_TIPO[p.tipo] ?? ''}`);
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
 * "13 nov". Se la stringa non è una data, la restituisce com'è. Con `adesso`, una data di un
 * altro anno porta anche l'anno ("13 nov 2025"): senza, sembrerebbe di questi giorni.
 */
export function formattaDataBreve(iso: string, adesso?: Date): string {
  const d = leggiData(iso);
  if (!d) return iso;
  if (adesso) {
    const anno = (data: Date): string => new Intl.DateTimeFormat('it-IT', { year: 'numeric', timeZone: d.fuso }).format(data);
    if (anno(d.data) !== anno(adesso)) return parti(d, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return parti(d, { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// Aria: il dato principale, per il riquadro piccolo sulla mappa
// ---------------------------------------------------------------------------

/** Oltre questa età la fotografia dell'aria si dichiara, con la sua data. */
const FOTO_ARIA_VECCHIA_MS = 3 * 24 * 60 * 60 * 1000;

export interface AriaBreve {
  /** Nome corto della misura, es. "PM10". */
  nome: string;
  /** Valore già scritto all'italiana, es. "13,7". */
  valore: string;
  unita: string;
  /** Data breve della misura, es. "13 nov" oppure "14 nov, ore 22:00". Vuota se non si legge. */
  quando: string;
  /** "foto del 12 nov" se la fotografia ha più di tre giorni, altrimenti null. */
  fotoVecchia: string | null;
}

/**
 * Il dato da mostrare nel riquadro «Aria»: il PM10 se c'è, altrimenti la prima misura.
 * Solo il numero: il giudizio a parole sta in src/live/giudizioAria.ts. null se non ci sono misure.
 */
export function riassuntoAria(dati: Pick<DatiAria, 'generato' | 'misure'>, adesso: Date): AriaBreve | null {
  const valide = (Array.isArray(dati.misure) ? dati.misure : []).filter(
    (m) => m && typeof m.inquinante === 'string' && typeof m.valore === 'number' && Number.isFinite(m.valore),
  );
  const misura = valide.find((m) => /^pm\s?10\b/i.test(m.inquinante.trim())) ?? valide[0];
  if (!misura) return null;
  const nome = misura.inquinante.split('(')[0].trim() || misura.inquinante.trim();
  let quando = '';
  if (typeof misura.quando === 'string' && leggiData(misura.quando)) {
    const ora = formattaOra(misura.quando);
    const giorno = formattaDataBreve(misura.quando, adesso);
    quando = ora ? `${giorno}, ore ${ora}` : giorno;
  }
  const scattata = Date.parse(dati.generato);
  // La data della fotografia si dichiara se è vecchia, oppure se la misura non ha una data
  // propria: il numero non resta mai senza una data accanto.
  const vecchia = Number.isFinite(scattata) && (!quando || adesso.getTime() - scattata > FOTO_ARIA_VECCHIA_MS);
  return {
    nome,
    valore: formattaMisura(misura.valore),
    unita: typeof misura.unita === 'string' ? misura.unita : '',
    quando,
    fotoVecchia: vecchia ? `foto del ${formattaDataBreve(dati.generato, adesso)}` : null,
  };
}

/** Oltre questi giorni il giudizio sull'aria si presenta come riferito alla sua data, non come attuale. */
const GIUDIZIO_ARIA_VECCHIO_GIORNI = 3;

export interface TempoGiudizio {
  /** Giorni passati dal giorno del giudizio a oggi (giorno italiano): 1 vuol dire ieri. */
  giorniFa: number;
  /** true se il giorno del giudizio ha più di tre giorni. */
  vecchio: boolean;
  /** "sabato 14 novembre"; con l'anno se non è quello in corso. */
  giorno: string;
  /** "il 14 novembre"; con l'anno se non è quello in corso. */
  ilGiorno: string;
  /** "14 nov"; con l'anno se non è quello in corso. */
  breve: string;
}

/**
 * Quanto è vecchio il giorno a cui si riferisce il giudizio sull'aria ("2026-11-14") e come
 * scriverlo. null se il giorno non si legge.
 */
export function tempoGiudizio(giorno: string, adesso: Date): TempoGiudizio | null {
  const d = SOLO_DATA.test(giorno) ? leggiData(giorno) : null;
  if (!d) return null;
  const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(adesso);
  const giorniFa = Math.round((Date.parse(`${oggi}T00:00:00Z`) - d.data.getTime()) / 86_400_000);
  const altroAnno = giorno.slice(0, 4) !== oggi.slice(0, 4);
  const anno: Intl.DateTimeFormatOptions = altroAnno ? { year: 'numeric' } : {};
  return {
    giorniFa,
    vecchio: giorniFa > GIUDIZIO_ARIA_VECCHIO_GIORNI,
    giorno: parti(d, { weekday: 'long', day: 'numeric', month: 'long', ...anno }),
    // In italiano: "l'8 novembre", "l'11 novembre"; per gli altri giorni "il".
    ilGiorno: `${[8, 11].includes(d.data.getUTCDate()) ? "l'" : 'il '}${parti(d, { day: 'numeric', month: 'long', ...anno })}`,
    breve: formattaDataBreve(giorno, adesso),
  };
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

/**
 * Tutte le fonti del racconto, una volta sola ciascuna: prima quelle delle tappe, nell'ordine
 * in cui compaiono, poi quelle delle curiosità.
 */
export function fontiUniche(storia: Storia): Fonte[] {
  const viste = new Set<string>();
  const fonti: Fonte[] = [];
  const candidate = [...storia.tappe.map((t) => t.fonte), ...(storia.fontiCuriosita ?? [])];
  for (const f of candidate) {
    if (!f || !f.url || viste.has(f.url)) continue;
    viste.add(f.url);
    fonti.push(f);
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

/**
 * Quante cose ci sono nella sezione dei media, a parole: «13 immagini e 3 video».
 * Stringa vuota se non c'è niente da contare.
 */
export function contoMedia(immagini: number, video = 0, audio = 0): string {
  const voci: string[] = [];
  if (immagini > 0) voci.push(immagini === 1 ? '1 immagine' : `${immagini} immagini`);
  if (audio > 0) voci.push(audio === 1 ? '1 registrazione' : `${audio} registrazioni`);
  if (video > 0) voci.push(`${video} video`);
  if (voci.length <= 1) return voci.join('');
  return `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]}`;
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
  idrometro: 'livello della Brenta',
  webcam: 'webcam',
  'fermata-bus': "fermate dell'autobus",
  stazione: 'stazione',
  bici: 'bici',
  ciclabile: 'piste ciclabili',
  ferrovia: 'ferrovia',
};

const LEGENDA_BASE: Record<IdStrato, string> = {
  cultura: 'musei, monumenti, luoghi storici',
  ambiente: "qualità dell'aria, livello della Brenta",
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

// ---------------------------------------------------------------------------
// Treni alla stazione
// ---------------------------------------------------------------------------

/** Quante righe mostra al massimo il riquadro dei treni. */
export const MASSIMO_TRENI = 8;
/** Un treno resta in elenco ancora per qualche minuto dopo la sua ora. */
const TOLLERANZA_TRENO_MS = 3 * 60 * 1000;
/** Oltre questa età l'emissione dei dati non si considera più recente. */
const TRENI_VECCHI_MS = 15 * 60 * 1000;

const MINUTO_MS = 60 * 1000;

export interface RigaTreno {
  /**
   * Ora dell'orario ufficiale, in ora italiana ("07:35"): è quella dei tabelloni di stazione,
   * a cui il ritardo si somma. Si ricava da `Treno.quando` togliendo il ritardo.
   */
  ora: string;
  /** Con un ritardo o un anticipo, l'ora prevista: "previsto alle 07:42". Altrimenti vuoto. */
  previsto: string;
  /** "per Padova", "da Venezia S. Lucia", oppure la frase per quando il nome manca. */
  direzione: string;
  /** "treno 16313", oppure "numero non indicato" se il numero non si è potuto leggere. */
  treno: string;
  /** "in orario", "+7 min", "2 min in anticipo", "soppresso". */
  stato: string;
  /** La stessa cosa detta per intero, per chi ascolta: "7 minuti di ritardo, previsto alle 07:42". */
  statoPerEsteso: string;
  tono: 'orario' | 'ritardo' | 'anticipo' | 'soppresso';
}

/** Lo stato di un treno a parole: mai affidato solo al colore. */
export function statoTreno(treno: Pick<Treno, 'ritardoMinuti' | 'soppresso'>): Pick<RigaTreno, 'stato' | 'statoPerEsteso' | 'tono'> {
  if (treno.soppresso) return { stato: 'soppresso', statoPerEsteso: 'soppresso', tono: 'soppresso' };
  const minuti = Math.round(treno.ritardoMinuti);
  if (minuti >= 1) {
    return {
      stato: `+${minuti} min`,
      statoPerEsteso: minuti === 1 ? '1 minuto di ritardo' : `${minuti} minuti di ritardo`,
      tono: 'ritardo',
    };
  }
  if (minuti <= -1) {
    const n = -minuti;
    return {
      stato: `${n} min in anticipo`,
      statoPerEsteso: n === 1 ? '1 minuto di anticipo' : `${n} minuti di anticipo`,
      tono: 'anticipo',
    };
  }
  return { stato: 'in orario', statoPerEsteso: 'in orario', tono: 'orario' };
}

function rigaTreno(treno: Treno): RigaTreno {
  const direzione =
    treno.verso === 'arrivo'
      ? treno.da
        ? `da ${treno.da}`
        : 'provenienza non indicata'
      : treno.a
        ? `per ${treno.a}`
        : 'destinazione non indicata';
  const stato = statoTreno(treno);
  // `quando` ha già il ritardo dentro. Sui tabelloni di stazione si legge l'orario ufficiale
  // con il ritardo accanto: qui si fa lo stesso, e l'ora prevista si scrive a parte, così
  // nessuno somma il ritardo due volte.
  const minuti = Number.isFinite(treno.ritardoMinuti) ? Math.round(treno.ritardoMinuti) : 0;
  const prevista = Date.parse(treno.quando);
  const ufficiale = Number.isNaN(prevista)
    ? treno.quando
    : new Date(Math.round((prevista - minuti * MINUTO_MS) / MINUTO_MS) * MINUTO_MS).toISOString();
  const previsto = minuti !== 0 && !treno.soppresso ? `previsto alle ${formattaOra(treno.quando)}` : '';
  return {
    ora: formattaOra(ufficiale),
    previsto,
    direzione,
    treno: treno.numero ? `treno ${treno.numero}` : 'numero non indicato',
    stato: stato.stato,
    statoPerEsteso: previsto ? `${stato.statoPerEsteso}, ${previsto}` : stato.statoPerEsteso,
    tono: stato.tono,
  };
}

export interface TabelloneTreni {
  /** Treni che partono da Bassano o ci passano, in ordine di ora. */
  partenze: RigaTreno[];
  /** Treni che finiscono la corsa a Bassano. */
  arrivi: RigaTreno[];
  /** true se l'emissione dei dati è più vecchia di un quarto d'ora. */
  vecchio: boolean;
}

/**
 * I prossimi treni per il riquadro della stazione: al massimo `massimo` in tutto, i più
 * vicini nel tempo, divisi tra partenze (transiti compresi) e arrivi. I treni la cui ora è
 * passata da più di qualche minuto non si mostrano.
 */
export function tabelloneTreni(lettura: LetturaTreni, adesso: Date, massimo = MASSIMO_TRENI): TabelloneTreni {
  const ora = adesso.getTime();
  const prossimi = lettura.treni
    .filter((t) => {
      const ms = Date.parse(t.quando);
      return !Number.isNaN(ms) && ms >= ora - TOLLERANZA_TRENO_MS;
    })
    .sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando))
    .slice(0, Math.max(0, massimo));
  const emissione = Date.parse(lettura.quando);
  return {
    partenze: prossimi.filter((t) => t.verso !== 'arrivo').map(rigaTreno),
    arrivi: prossimi.filter((t) => t.verso === 'arrivo').map(rigaTreno),
    vecchio: Number.isNaN(emissione) || ora - emissione > TRENI_VECCHI_MS,
  };
}

// ---------------------------------------------------------------------------
// Avvisi sulla viabilità
// ---------------------------------------------------------------------------

export const NOME_AVVISI = 'Avvisi sulla viabilità';
export const SOTTO_AVVISI = 'Chiusure e lavori sulle strade attorno a Bassano · strato Mobilità';
const PAROLE_AVVISI = `${NOME_AVVISI} ${SOTTO_AVVISI} traffico adesso diretta tempo reale ordinanze ordinanza code coda incidenti incidente chiusure chiusura cantieri cantiere`;

/** true se la voce «Avvisi sulla viabilità» va mostrata nell'elenco per questa ricerca. */
export function trovaVoceAvvisi(domanda: string): boolean {
  const testo = normalizza(PAROLE_AVVISI);
  return normalizza(domanda)
    .split(' ')
    .filter(Boolean)
    .every((parola) => testo.includes(parola));
}

const DURATA_EVENTO_MS = 24 * 60 * 60 * 1000;

/**
 * Gli avvisi da mostrare. Gli eventi di traffico valgono se pubblicati nelle ultime 24 ore
 * rispetto ad `adesso`, oppure se la fonte li dava come validi (`attivo`, in corso o programmati) in una fotografia
 * (`generato`) di meno di 24 ore: più vecchi non dicono più nulla di certo e non si mostrano.
 * Le ordinanze restano tutte. In ogni gruppo, prima i più recenti.
 */
export function scegliAvvisi(avvisi: Avviso[], adesso: Date, generato?: string): { eventi: Avviso[]; ordinanze: Avviso[] } {
  const ora = adesso.getTime();
  const fatta = typeof generato === 'string' ? Date.parse(generato) : NaN;
  const fotografiaRecente = !Number.isNaN(fatta) && ora - fatta <= DURATA_EVENTO_MS && fatta <= ora + DURATA_EVENTO_MS;
  const validi = avvisi.filter(
    (a) => a !== null && typeof a === 'object' && typeof a.testo === 'string' && typeof a.quando === 'string',
  );
  const perData = (a: Avviso, b: Avviso): number => (Date.parse(b.quando) || 0) - (Date.parse(a.quando) || 0);
  const eventi = validi
    .filter((a) => {
      if (a.tipo !== 'evento') return false;
      const ms = Date.parse(a.quando);
      if (Number.isNaN(ms)) return false;
      if (a.attivo === true && fotografiaRecente) return true;
      return ms >= ora - DURATA_EVENTO_MS;
    })
    .sort(perData);
  const ordinanze = validi.filter((a) => a.tipo === 'ordinanza').sort(perData);
  return { eventi, ordinanze };
}

/** Oltre questa età la fotografia degli avvisi non si considera più recente. */
const AVVISI_VECCHI_MS = 24 * 60 * 60 * 1000;
/** Lo script tiene le ordinanze pubblicate negli ultimi 120 giorni (scripts/lib/avvisi.mjs). */
const GIORNI_ORDINANZE = 120;

/** Le due fonti degli avvisi, come le scrive lo script in DatiAvvisi.fonti. */
export const FONTI_AVVISI = [
  { tipo: 'evento', nome: 'CCISS Viaggiare Informati', breve: 'CCISS', url: 'https://www.cciss.it/', cosa: 'gli eventi di traffico' },
  { tipo: 'ordinanza', nome: 'Vi.abilità (Provincia di Vicenza)', breve: 'Vi.abilità', url: 'https://vi-abilita.it/', cosa: 'le ordinanze sulle strade provinciali' },
] as const;

export interface QuadroAvvisi {
  eventi: Avviso[];
  ordinanze: Avviso[];
  /** true se la fotografia ha più di 24 ore, o una data che non si legge. */
  vecchia: boolean;
  /**
   * Eventi che il CCISS dava come validi (`attivo`) e che non mostriamo perché la fotografia
   * ha più di 24 ore: non sappiamo se valgono ancora. Gli eventi dell'RSS più vecchi di 24 ore
   * non si contano: per regola non dicono più nulla.
   */
  eventiNascosti: number;
  /** Frase che spiega gli eventi nascosti, vuota se non ce ne sono. */
  nascosti: string;
  /** Fonti che lo script non è riuscito a leggere quando ha fatto la fotografia. */
  mancanti: (typeof FONTI_AVVISI)[number][];
  /** Frase breve per chi ascolta: "3 avvisi nella fotografia del 15 novembre 2026, ore 08:30." */
  riassunto: string;
  /** Frase da mostrare se non c'è nessun avviso: parla della fotografia, non di adesso. */
  vuoto: string;
}

/**
 * Tutto quello che la scheda degli avvisi deve dire, deciso senza DOM. La fotografia si
 * rigenera a mano: può essere vecchia, o fatta mentre una fonte non rispondeva. In quei casi
 * la scheda lo dice, e non afferma mai nulla su "questo momento". Le ordinanze pubblicate
 * da più di 120 giorni rispetto ad `adesso` non si mostrano.
 */
export function quadroAvvisi(dati: Pick<DatiAvvisi, 'generato' | 'fonti' | 'avvisi'>, adesso: Date): QuadroAvvisi {
  const scelti = scegliAvvisi(Array.isArray(dati.avvisi) ? dati.avvisi : [], adesso, dati.generato);
  const ora = adesso.getTime();
  const limite = ora - GIORNI_ORDINANZE * 24 * 60 * 60 * 1000;
  const ordinanze = scelti.ordinanze.filter((a) => {
    const ms = Date.parse(a.quando);
    return !Number.isNaN(ms) && ms >= limite;
  });
  const fatta = Date.parse(dati.generato);
  const nomi = new Set((Array.isArray(dati.fonti) ? dati.fonti : []).map((f) => f?.nome));
  const quanti = scelti.eventi.length + ordinanze.length;
  const data = formattaDataOraLunga(dati.generato);
  const tuttiGliEventi = (Array.isArray(dati.avvisi) ? dati.avvisi : []).filter(
    (a) =>
      a !== null && typeof a === 'object' && a.tipo === 'evento' && a.attivo === true && typeof a.testo === 'string' &&
      typeof a.quando === 'string' && !Number.isNaN(Date.parse(a.quando)),
  ).length;
  const eventiNascosti = Math.max(0, tuttiGliEventi - scelti.eventi.filter((a) => a.attivo === true).length);
  const nascosti =
    eventiNascosti === 0
      ? ''
      : eventiNascosti === 1
        ? "C'è 1 evento sulle strade che non mostriamo: la fotografia ha più di 24 ore e non sappiamo se vale ancora."
        : `Ci sono ${eventiNascosti} eventi sulle strade che non mostriamo: la fotografia ha più di 24 ore e non sappiamo se valgono ancora.`;
  // Se la fotografia contiene eventi che non mostriamo, non si può dire che non ci sono avvisi.
  const vuoto =
    eventiNascosti > 0
      ? `Nella fotografia del ${data} non ci sono avvisi che possiamo ancora mostrare.`
      : `Nella fotografia del ${data} non ci sono avvisi per la zona di Bassano.`;
  return {
    eventi: scelti.eventi,
    ordinanze,
    vecchia: Number.isNaN(fatta) || ora - fatta > AVVISI_VECCHI_MS,
    eventiNascosti,
    nascosti,
    mancanti: FONTI_AVVISI.filter((f) => !nomi.has(f.nome)),
    riassunto: [quanti === 0 ? vuoto : `${quanti === 1 ? '1 avviso' : `${quanti} avvisi`} nella fotografia del ${data}.`, nascosti]
      .filter(Boolean)
      .join(' '),
    vuoto,
  };
}

/**
 * Dove guardare il traffico di adesso. Bassano Aperta non lo mostra: per Bassano nessun ente
 * pubblica code e velocità in tempo reale con una licenza che ne permetta il riuso, e i
 * servizi commerciali chiedono una chiave a pagamento (verificato il 18/11/2026, vedi
 * docs/SPEC.md). Gli indirizzi sono fissi e centrati su Bassano: nessun dato di chi legge.
 */
// Controllati il 18/11/2026. Waze non apre la mappa centrata su un punto senza metterlo come
// destinazione: la pagina mostra le indicazioni, ma non parte nessuna navigazione. ANAS VAI dà
// le velocità tratta per tratta sulla SS47 e sulla SS248 (getlinearmap?strada=SS248 risponde con
// le tratte della Schiavonesca-Marosticana). La pagina della Pedemontana ha notizie e il numero
// per le segnalazioni, non un elenco di code.
export const LINK_TRAFFICO = [
  {
    nome: 'Waze, mappa con il traffico',
    url: 'https://www.waze.com/it/live-map/directions?to=ll.45.7665%2C11.7345',
    cosa: 'si apre con Bassano come destinazione, senza partire; mostra code e incidenti segnalati da chi guida',
  },
  {
    nome: 'Google Maps, livello Traffico',
    url: 'https://www.google.com/maps/@45.7665,11.7345,14z/data=!5m1!1e1',
    cosa: 'traffico stimato dai telefoni in movimento',
  },
  {
    nome: 'ANAS, VAI traffico in tempo reale',
    url: 'https://www.stradeanas.it/it/vai-traffico-in-tempo-reale',
    cosa: 'velocità medie sulle strade ANAS, tra cui SS47 e SS248',
  },
  {
    nome: 'Superstrada Pedemontana Veneta',
    url: 'https://superstradapedemontanaveneta.it/segnalazioni-viabilita-e-informazioni/',
    cosa: 'notizie sulla superstrada e numero per le segnalazioni',
  },
  {
    nome: 'CCISS Viaggiare Informati',
    url: 'https://www.cciss.it/web/cciss/situazione-della-viabilita',
    cosa: 'mappa di incidenti, code e lavori segnalati in tutta Italia',
  },
] as const;

export const TRAFFICO_ADESSO =
  'Qui non mostriamo code e velocità in tempo reale: per Bassano nessun ente le pubblica con una licenza che ci permetta di riusarle. Per il traffico di adesso guarda questi servizi:';
export const TRAFFICO_PRIVACY =
  'Sono siti esterni: aprendoli, la tua visita arriva a loro e vale la loro informativa sulla privacy.';

// ---------------------------------------------------------------------------
// Licenze dei media
// ---------------------------------------------------------------------------

/** Le versioni che Creative Commons ha pubblicato per le licenze BY e BY-SA. */
const VERSIONI_CC = new Set(['1.0', '2.0', '2.5', '3.0', '4.0']);

/**
 * Indirizzo della pagina ufficiale di una licenza Creative Commons, a partire dal nome scritto
 * nei contenuti («CC BY-SA 4.0», «CC BY 2.5», «CC0», «CC0 1.0»). Riconosce solo le licenze
 * generiche BY, BY-SA e CC0: per tutto il resto (pubblico dominio, licenze adattate a un
 * paese, altre varianti, testo libero) restituisce null e il nome resta senza link. Meglio
 * nessun link che un link alla licenza sbagliata.
 */
export function urlLicenza(licenza: string | null | undefined): string | null {
  if (typeof licenza !== 'string') return null;
  const nome = licenza.trim().replace(/\s+/g, ' ').toUpperCase();
  if (nome === 'CC0' || nome === 'CC0 1.0') return 'https://creativecommons.org/publicdomain/zero/1.0/';
  const trovata = /^CC BY(-SA)? (\d\.\d)$/.exec(nome);
  if (!trovata || !VERSIONI_CC.has(trovata[2])) return null;
  return `https://creativecommons.org/licenses/by${trovata[1] ? '-sa' : ''}/${trovata[2]}/`;
}
