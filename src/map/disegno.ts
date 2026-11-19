// Disegno della mappa su canvas 2D. Ordine: carta, aree, strade, linee tematiche,
// poi tutto ciò che sta in piedi dal più lontano al più vicino, infine i segnaposto.

import {
  carrozze,
  colonnePonte,
  VELOCITA_TRENO,
  istanteFermo,
  allaFontanaDi,
  macchinaDi,
  momentoTreno,
  PASSANTI_PONTE,
  passanteSulPonte,
  passoDi,
  PONTE,
  FILONI,
  spostamentoCorrente,
  spostamentoFiloni,
  suPonte,
} from './animazioni';
import type { Fontana } from './animazioni';
import { creaNuvola, nuvoleInVista } from './nuvole';
import type { Tasselli } from './tasselli';
import type { IdStrato, Luce, TipoArea, TipoStrada } from '../types';
import {
  marcatoriInVista,
  puntoInPoligono,
  puntoSuEdificio,
  rettangoloSprite,
  SPRITE_SOGLIA,
  ZOOM_NOMI,
} from './bersagli';
import type { Marcatore, Sprite } from './bersagli';
import type { Illustrazioni } from './immagini';
import { conAlfa, inOmbra, luminanza, mescolaColori, PALETTE, PALETTE_PER_LUCE, sfuma } from './palette';
import type { Palette } from './palette';
import { angoliInIso, ISO_X, ISO_Y, ISO_Z, isoInSchermo, metriInIso, riquadroVisibile } from './proiezione';
import type { Camera, Rettangolo, Vista } from './proiezione';
import {
  ALTEZZA_LAMPIONE,
  EL_ALBERO,
  EL_EDIFICIO,
  EL_LAMPIONE,
  EL_LANDMARK,
  LATO_TESSERA,
  livelloDettaglio,
  soglieDettaglio,
  MURO_DESTRO,
  MURO_DIETRO,
  MURO_SINISTRO,
  raggruppaInTessere,
  siToccano,
} from './scena';
import type { EdificioPronto, LandmarkPronto, PuntoPronto, Scena, StratiVisibili } from './scena';
import {
  CAPPELLO,
  COLMO_FINTO,
  FALDA_LUCE,
  FALDA_MEDIA,
  FALDA_OMBRA,
  FASCIA,
  GRADONE,
  INTERNO,
  MASCHERA_CLASSE,
  TETTO_CAPANNONE,
  TETTO_FALDE,
  TETTO_PIANO,
  TETTO_TERRAZZA,
  TIMPANO_DESTRO,
  TIMPANO_SINISTRO,
} from './tetti';
import { campi, creaIncrespature, creaMacchie, creaSelciato, livelloTrama, METRI_TRAMA, motivo } from './trame';

export interface StatoDisegno {
  camera: Camera;
  vista: Vista;
  /** Pixel reali per pixel CSS. */
  densita: number;
  visibili: StratiVisibili;
  /** Storia da evidenziare, oppure null. */
  evidenziata: string | null;
  /** Indice (in Scena.punti) del segnaposto sotto il cursore, oppure -1. */
  puntoSopra: number;
  /** Indice (in Scena.landmark) dell'illustrazione sotto il cursore, oppure -1. */
  landmarkSopra: number;
  /** Area dei dati in metri locali: fuori da qui la carta sfuma. */
  area: Rettangolo;
  /**
   * Tempo delle animazioni decorative, in millisecondi (acqua che scorre, treno). Senza, la
   * mappa è ferma: acqua immobile, treno fermo sul binario poco prima della stazione.
   */
  tempo?: number;
}

interface Pezzo extends Rettangolo {
  percorso: Path2D;
}

/**
 * Quanto si vedono macchine e fontana: sfumano a partire da dove comincia il dettaglio pieno
 * (che sui computer arriva fino a zoom 1,25), non prima, perché prima non si disegnano.
 */
function presenzaMobili(s: StatoDisegno): number {
  const da = Math.max(MACCHINE.da, soglieDettaglio(s.vista).muri);
  return presenza(s.camera.zoom, { da, a: da + (MACCHINE.a - MACCHINE.da) });
}

/** Una scatola pronta da disegnare (carrozza o macchina): base in metri [x0, y0, ... x3, y3]. */
interface Vagone {
  base: number[];
  chiave: number;
  altezza: number;
  colori: { luce: string; ombra: string; tetto: string; finestrini: string };
  /** Quote in metri della fascia dei finestrini, e quanto resta di parete ai due capi. */
  fascia: { da: number; a: number; capi: number };
  riquadro: Rettangolo;
}

/**
 * Una scatola lungo il segmento da `coda` a `testa`, larga 2 x `mezza`, alta `altezza`: base,
 * chiave di profondità (l'angolo più vicino a chi guarda, come per le case) e riquadro sul piano.
 */
function scatola(
  coda: { x: number; y: number },
  testa: { x: number; y: number },
  mezza: number,
  altezza: number,
  colori: Vagone['colori'],
  fascia: Vagone['fascia'],
): Vagone {
  const dx = testa.x - coda.x;
  const dy = testa.y - coda.y;
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * mezza;
  const ny = (dx / l) * mezza;
  const base = [coda.x + nx, coda.y + ny, testa.x + nx, testa.y + ny, testa.x - nx, testa.y - ny, coda.x - nx, coda.y - ny];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let chiave = Infinity;
  for (let k = 0; k < 8; k += 2) {
    const q = metriInIso(base[k], base[k + 1]);
    minX = Math.min(minX, q.sx);
    maxX = Math.max(maxX, q.sx);
    minY = Math.min(minY, q.sy - altezza * ISO_Z);
    maxY = Math.max(maxY, q.sy);
    chiave = Math.min(chiave, base[k] + base[k + 1]);
  }
  return { base, chiave, altezza, colori, fascia, riquadro: { minX, minY, maxX, maxY } };
}

/** Misure delle carrozze, in metri: un poco più grandi del vero, perché si riconoscano. */
const ALTEZZA_VAGONE = 4.4;
const FASCIA_VAGONE = { da: 1.9, a: 2.7, capi: 1.5 };
/** Macchine: un poco più grandi del vero, come carrozze e figurine. */
const ALTEZZA_MACCHINA = 1.9;
const MEZZA_LARGHEZZA_MACCHINA = 1.15;
const FASCIA_MACCHINA = { da: 1.05, a: 1.6, capi: 0.9 };
const MACCHINE = { da: 1.0, a: 1.4 };
const MEZZA_LARGHEZZA_VAGONE = 1.75;
/** Ogni quanto si ricontrolla un treno che corre fuori vista. */
const CONTROLLO_TRENO_MS = 1000;
/** Fotogrammi delle animazioni: acqua e figurine 10 al secondo, il treno in corsa 25. */
const INTERVALLO_ACQUA_MS = 100;
/** Le figurine compaiono sfumando da vicino; sono un poco più grandi del vero, perché si vedano. */
const FIGURINE = { da: 2.4, a: 3 };
const ALTEZZA_FIGURINA = 3.4;
const INTERVALLO_TRENO_MS = 40;

const AREE_SOTTO: TipoArea[] = ['coltivo', 'prato', 'parco', 'bosco'];
const ORDINE_STRADE: Exclude<TipoStrada, 'ferrovia'>[] = [
  'pedonale',
  'locale',
  'secondaria',
  'principale',
];
/** Larghezza in metri e larghezza minima in pixel per tipo di strada. */
const LARGHEZZE: Record<Exclude<TipoStrada, 'ferrovia'>, { metri: number; minimo: number; da: number }> = {
  principale: { metri: 8, minimo: 1.5, da: 0 },
  secondaria: { metri: 6, minimo: 1.1, da: 0 },
  locale: { metri: 4.2, minimo: 0.7, da: 0.22 },
  pedonale: { metri: 2.2, minimo: 0.6, da: 0.55 },
};

/** Raggio in metri della luce che un lampione stende a terra. */
const RAGGIO_ALONE = 16;
/** Da questo zoom in su i lampioni si disegnano con il palo; sotto, di notte, restano gli aloni. */
export const ZOOM_PALI = { giorno: 3, notte: 1.7 };
/**
 * Di notte le finestre accese compaiono sfumando tra questi due zoom. Più da lontano sarebbero
 * puntini, e per averle bisognerebbe preparare la facciata di migliaia di case.
 */
export const ZOOM_FINESTRE = { da: 1.2, a: 1.6 };

/**
 * Livelli di dettaglio degli edifici. Ogni strato di pittura compare sfumando tra `da` e `a`:
 * mai uno scatto. Allo zoom con cui si apre la mappa sul computer (circa 1,9) le case sono già
 * dipinte con finestre, coppi, persiane e cornici; da molto lontano restano volumi e tinte.
 */
export const DETTAGLI = {
  /** Ombre delle case a terra: più da lontano sarebbero un filo, e costano. */
  ombre: { da: 1.0, a: 1.5 },
  /** Terzo tono dei tetti: le falde in piena luce. Prima ci sono solo base e ombra. */
  luce: { da: 0.9, a: 1.4 },
  /** Colmi e displuvi tracciati a penna sopra le tinte delle falde. */
  spigoli: { da: 1.0, a: 1.6 },
  /** Fasce tenui al posto delle file di finestre, quando le finestre sarebbero puntini. */
  fasce: { da: 1.0, a: 1.4 },
  /** Le fasce se ne vanno mentre entrano le finestre vere. */
  fasceVia: { da: 1.4, a: 1.8 },
  /** Finestre, porte e archi dei portici: sagome scure. */
  finestre: { da: 1.3, a: 1.8 },
  /** Righe dei coppi sulle falde: prima una riga sì e una no. */
  coppi: { da: 1.5, a: 2.0 },
  /** Le righe dei coppi che mancavano. */
  coppiPieni: { da: 1.8, a: 2.4 },
  /** Comignoli, abbaini e torrini. */
  comignoli: { da: 1.7, a: 2.3 },
  /** Persiane, zoccolo, marcapiano, ombra della gronda. */
  facciata: { da: 1.6, a: 2.1 },
  /** Cornici chiare attorno a finestre e porte. */
  cornici: { da: 1.8, a: 2.3 },
  /** Seconda serie di righe dei coppi, in mezzo alle prime; telai a croce delle finestre. */
  coppiFitti: { da: 5.5, a: 7.5 },
  /** Lastre del selciato su piazze e strade del centro. */
  selciato: { da: 1.5, a: 2.2 },
  /** Increspature fini dell'acqua: entrano prima del selciato, perché scorrono con la corrente. */
  acqua: { da: 1.4, a: 2.6 },
  /** Filoni grandi della corrente: si vedono già da lontano, perché la Brenta scorra a ogni zoom. */
  filoni: { da: 0.45, a: 0.8 },
  /** La mano d'acquerello stesa su tutto il foglio: macchie di colore e grana della carta. */
  macchie: { da: 1.3, a: 3.4 },
};

/** Quanto è presente uno strato a un certo zoom: 0 sotto `da`, 1 sopra `a`. */
export function presenza(zoom: number, soglia: { da: number; a: number }): number {
  const t = (zoom - soglia.da) / (soglia.a - soglia.da);
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

/** Entro questa distanza dal centro (metri) la città è il centro storico: tinte calde, portici. */
const RAGGIO_CENTRO = 480;
/**
 * Il centro storico ha due fuochi (metri locali): le piazze e, oltre il Ponte Vecchio, il borgo
 * di Angarano sulla riva ovest. Chi sta dentro uno dei due cerchi è «in centro».
 */
export const FUOCHI_CENTRO = [
  { x: 0, y: 0, raggio: RAGGIO_CENTRO },
  { x: -335, y: 110, raggio: 310 },
];

/**
 * Quanto un punto (metri locali) è lontano dal centro storico, contando i due fuochi: sotto
 * RAGGIO_CENTRO è dentro. Attorno al primo fuoco è la distanza dal centro della città.
 */
export function lontananzaDalCentro(x: number, y: number): number {
  let minima = Infinity;
  for (const f of FUOCHI_CENTRO) {
    const d = Math.hypot(x - f.x, y - f.y) - f.raggio + RAGGIO_CENTRO;
    if (d < minima) minima = d;
  }
  return minima;
}
/** Fino a qui la prima cintura: ancora intonaci caldi, qualche tinta chiara. */
const RAGGIO_CINTURA = 950;
/** Oltre questo numero di dettagli pronti (facciate e tetti), quelli fuori vista si dimenticano. */
export const DETTAGLI_IN_MEMORIA = 9000;
/** Ombra a terra delle case: metri di spostamento per metro di altezza, e il massimo. */
const OMBRA_PER_METRO = 0.24;
const OMBRA_MASSIMA = 8;
/** Quanto pesano al massimo le fasce che stanno al posto delle finestre. */
const ALFA_FASCE = 0.26;
/**
 * Scorcio di un muro: quanto è largo sullo schermo un metro della sua lunghezza (da 0, visto
 * di taglio, a 1,41). Sotto SCORCIO_MINIMO il muro è di scorcio: finestre più rade, senza
 * persiane né porte. Sotto SCORCIO_LISCIO resta liscio.
 */
const SCORCIO_MINIMO = 0.5;
const SCORCIO_LISCIO = 0.26;
/** Passo delle finestre sui muri di scorcio, rispetto a quello della casa. */
const PASSO_DI_SCORCIO = 1.5;
/** Oltre questo numero di volumi pronti (muri e tetto), quelli fuori vista si dimenticano. */
export const VOLUMI_IN_MEMORIA = 9000;

/** La pittura di base di un edificio: muri e tetto. Solo forme, senza colori. */
interface Volume {
  /** Muri in vista, a gruppi dello stesso lato, dal più lontano al più vicino. */
  muri: Path2D[];
  latoMuri: number[];
  /** true se ogni gruppo di muri va contornato subito: i muri si coprono tra loro. */
  muriATratti: boolean;

  /** Contorni dei muri da tracciare prima del tetto (impronte con rientranze), oppure null. */
  lineeMuri: Path2D | null;
  /** Tutto il tetto, da riempire con la tinta di base. */
  fondo: Path2D;
  /** I tratti a penna da fare dopo il tetto, in un colpo solo: gronda, timpano, muri se si può. */
  linee: Path2D;
  /** Gli stessi tratti con dentro anche colmi e displuvi. */
  lineePiene: Path2D;
  /** Colmi e displuvi, ognuno una volta sola. Compaiono avvicinandosi. */
  spigoli: Path2D | null;
  luce: Path2D | null;
  ombra: Path2D | null;
  /** Triangolo di muro sotto le due falde, se è in vista. */
  timpano: Path2D | null;
  latoTimpano: number;
}

/** La pittura delle facciate: finestre, persiane, porte, portici. */
interface Facciata {
  ombre: Path2D | null;
  /** Una fascia per piano al posto delle finestre, per la vista di mezzo. */
  fasce: Path2D | null;
  archi: Path2D | null;
  cornici: Path2D | null;
  vetri: Path2D | null;
  /** Telai a croce delle finestre, solo da molto vicino. */
  telai: Path2D | null;
  /** Le finestre che di notte sono accese: stanno anche tra i vetri, e la luce si stende sopra. */
  accese: Path2D | null;
  persiane: Path2D | null;
  porte: Path2D | null;
  iPersiana: number;
  iPorta: number;
}

/** La pittura fine del tetto: coppi, comignoli, abbaini. */
interface TettoFine {
  /** Righe dei coppi: metà (una sì e una no), l'altra metà, e quelle fitte in mezzo. */
  coppi: Path2D | null;
  pieni: Path2D | null;
  fitti: Path2D | null;
  /** Comignoli, abbaini e torrini: faccia in luce, faccia in ombra, coperchio. */
  camSx: Path2D | null;
  camDx: Path2D | null;
  camSopra: Path2D | null;
  /** La finestrella degli abbaini. */
  camVetri: Path2D | null;
  /** Il contorno a penna di tutte le scatole, in un solo tratto. */
  camBordo: Path2D | null;
}

/** Le trame di una luce, pronte da usare come riempimento. */
interface Trame {
  /**
   * La mano d'acquerello: veli trasparenti da stendere su tutto il foglio, dal più fine al più
   * ridotto (vedi livelloTrama). Elenco vuoto se non si possono creare.
   */
  macchie: CanvasPattern[];
  /** Fughe del selciato e increspature dell'acqua, su fondo trasparente. */
  selciato: CanvasPattern | null;
  increspature: CanvasPattern | null;
}

interface PezzoTetti {
  tinte: Map<number, Path2D>;
  /** Le falde in ombra di tutta la tessera: un velo scuro sopra le tinte. */
  ombra: Path2D;
}

const SENZA_FACCIATA: Facciata = {
  ombre: null,
  fasce: null,
  archi: null,
  cornici: null,
  vetri: null,
  telai: null,
  accese: null,
  persiane: null,
  porte: null,
  iPersiana: 0,
  iPorta: 0,
};
const SENZA_TETTO_FINE: TettoFine = {
  coppi: null,
  pieni: null,
  fitti: null,
  camSx: null,
  camDx: null,
  camSopra: null,
  camVetri: null,
  camBordo: null,
};

/** Numero stabile a 32 bit da tre numeri: decide un dettaglio (una finestra accesa, una porta). */
function mescola(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ Math.imul(b + 1, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ Math.imul(c + 1, 0xc2b2ae35), 0x27d4eb2f);
  return (h ^ (h >>> 15)) >>> 0;
}

function tracciaFaccia(percorso: Path2D, v: Float32Array, da: number, vertici: number): void {
  percorso.moveTo(v[da], v[da + 1]);
  for (let i = 1; i < vertici; i++) percorso.lineTo(v[da + i * 2], v[da + i * 2 + 1]);
  percorso.closePath();
}

/** Memoria riusata per i tagli delle righe dentro una faccia. */
const tagli: number[] = [];

/**
 * Aggiunge al percorso i tratti della retta (ox, oy) + t * (dx, dy) che cadono dentro il
 * poligono `v` (da `da`, `vertici` vertici). Regge anche i poligoni con rientranze.
 */
function rigaNelPoligono(
  percorso: Path2D,
  v: ArrayLike<number>,
  da: number,
  vertici: number,
  su: number,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
): void {
  tagli.length = 0;
  for (let i = 0; i < vertici; i++) {
    const j = (i + 1) % vertici;
    const px = v[da + i * 2];
    const py = v[da + i * 2 + 1] - su;
    const ex = v[da + j * 2] - px;
    const ey = v[da + j * 2 + 1] - su - py;
    const det = dx * ey - dy * ex;
    if (Math.abs(det) < 1e-9) continue;
    const m = ((px - ox) * dy - (py - oy) * dx) / det;
    if (m < 0 || m >= 1) continue;
    tagli.push(((px - ox) * ey - (py - oy) * ex) / det);
  }
  if (tagli.length < 2) return;
  tagli.sort((a, b) => a - b);
  for (let k = 0; k + 1 < tagli.length; k += 2) {
    if (tagli[k + 1] - tagli[k] < 0.25) continue;
    percorso.moveTo(ox + dx * tagli[k], oy + dy * tagli[k]);
    percorso.lineTo(ox + dx * tagli[k + 1], oy + dy * tagli[k + 1]);
  }
}

/**
 * Righe leggere su una faccia piana (tetto piano in cotto), tutte da ovest a est della pianta,
 * una ogni `passo` metri. `v` è il poligono sul piano isometrico, alzato di `su`.
 */
function righePiane(
  percorso: Path2D,
  v: ArrayLike<number>,
  da: number,
  vertici: number,
  su: number,
  passo: number,
): void {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < vertici; i++) {
    // Coordinata lungo l'asse nord-sud della pianta, in metri (a meno della quota, che è fissa).
    const t = (-v[da + i * 2] / ISO_X - (v[da + i * 2 + 1] - su) / ISO_Y) / 2;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  for (let t = Math.ceil(min / passo) * passo + 0.4; t < max; t += passo) {
    rigaNelPoligono(percorso, v, da, vertici, su, -t * ISO_X, -t * ISO_Y, ISO_X, -ISO_Y);
  }
}

/**
 * Da lontano non si accendono tutti i lampioni: sotto ZOOM_ALONI.pochi la metà, da
 * ZOOM_ALONI.tutti in su tutti, in mezzo la quota cresce un poco alla volta. Dipende solo
 * dallo zoom: trascinando la mappa restano accese le stesse luci.
 */
export const ZOOM_ALONI = { pochi: 0.2, tutti: 0.5 };
/** Tetto di sicurezza agli aloni disegnati in un fotogramma (schermi molto grandi). */
const ALONI_MASSIMI = 7000;

/** Quota di lampioni accesi a terra a un certo zoom, tra 0.5 e 1. */
export function quotaAloni(zoom: number): number {
  const t = (zoom - ZOOM_ALONI.pochi) / (ZOOM_ALONI.tutti - ZOOM_ALONI.pochi);
  return 0.5 + 0.5 * Math.max(0, Math.min(1, t));
}

/**
 * I lampioni che stendono luce a terra in questa vista. Restituisce i loro numeri (validi fino
 * alla prossima ricerca nella griglia dei lampioni), quanti sono e la quota usata. Un lampione
 * è acceso se il suo rango sta sotto la quota: la scelta è la stessa per ogni vista.
 */
export function aloniInVista(
  scena: Scena,
  camera: Camera,
  vista: Vista,
): { indici: Int32Array; quanti: number; quota: number; raggio: number } {
  const z = camera.zoom;
  // Da lontano l'alone non scende sotto qualche pixel: la città resta punteggiata di luci.
  const raggio = Math.max(RAGGIO_ALONE, 2.6 / z);
  const zona = riquadroVisibile(camera, vista, raggio + 4 / z);
  const trovati = scena.grigliaLampioni.interroga(zona);
  let quota = quotaAloni(z);
  if (trovati.length * quota > ALONI_MASSIMI) quota = ALONI_MASSIMI / trovati.length;
  if (quota >= 1) return { indici: trovati, quanti: trovati.length, quota: 1, raggio };
  const rango = scena.rangoLampioni;
  let quanti = 0;
  for (let j = 0; j < trovati.length; j++) {
    const i = trovati[j];
    if (rango[i] < quota) trovati[quanti++] = i;
  }
  return { indici: trovati, quanti, quota, raggio };
}
const LATO_SPRITE = 96;

/**
 * L'alone di una luce disegnato una volta sola: un disco che sfuma verso il bordo.
 * null dove non c'è un documento (nelle prove) o il canvas non è disponibile.
 */
function creaAlone(colore: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  try {
    const tela = document.createElement('canvas');
    tela.width = LATO_SPRITE;
    tela.height = LATO_SPRITE;
    const ctx = tela.getContext('2d');
    if (!ctx) return null;
    const m = LATO_SPRITE / 2;
    const g = ctx.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, conAlfa(colore, 1));
    g.addColorStop(0.18, conAlfa(colore, 0.72));
    g.addColorStop(0.45, conAlfa(colore, 0.3));
    g.addColorStop(0.75, conAlfa(colore, 0.08));
    g.addColorStop(1, conAlfa(colore, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LATO_SPRITE, LATO_SPRITE);
    return tela;
  } catch {
    return null;
  }
}

const CARATTERE = '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif';

function tracciaAnello(percorso: Path2D | CanvasRenderingContext2D, a: Float32Array, su = 0): void {
  if (a.length < 4) return;
  percorso.moveTo(a[0], a[1] - su);
  for (let i = 2; i < a.length; i += 2) percorso.lineTo(a[i], a[i + 1] - su);
  percorso.closePath();
}

function tracciaLinea(percorso: Path2D, a: Float32Array): void {
  if (a.length < 4) return;
  percorso.moveTo(a[0], a[1]);
  for (let i = 2; i < a.length; i += 2) percorso.lineTo(a[i], a[i + 1]);
}

export class Disegnatore {
  private readonly scena: Scena;
  private readonly illustrazioni: Illustrazioni;

  private readonly acqua: Pezzo | null;
  /** I riquadri delle singole aree d'acqua: dicono se c'è davvero acqua in vista. */
  private readonly riquadriAcqua: Rettangolo[] = [];
  private readonly aree = new Map<TipoArea, Pezzo[]>();
  private readonly strade = new Map<string, Pezzo[]>();
  private readonly linee: { strato: IdStrato; tipo: 'ciclabile' | 'ferrovia'; percorso: Path2D }[] = [];

  /** Tessere di edifici per la vista da lontano. */
  private readonly tessereEdifici: (Rettangolo & { indici: number[] })[];
  private pezziPiatti: (Path2D | null)[] = [];
  private pezziTetti: (PezzoTetti | null)[] = [];
  /** Tessere più piccole per le ombre a terra delle case, e le ombre già pronte. */
  private readonly tessereOmbre: (Rettangolo & { indici: number[] })[];
  private pezziOmbre: (Path2D | null)[] = [];
  /** Con quale lunghezza d'ombra sono stati fatti i pezzi pronti. */
  private lungaNeiPezzi = 0;
  /** Pittura degli edifici, preparata la prima volta che servono e poi riusata. */
  private volumi: (Volume | undefined)[] = [];
  private facciate: (Facciata | undefined)[] = [];
  private tettiFini: (TettoFine | undefined)[] = [];
  private dettagliPronti = 0;
  private volumiPronti = 0;
  /** Quanti edifici sono stati dipinti nel fotogramma in corso e in quello prima. */
  private dipinti = 0;
  private dipintiPrima = 0;
  /** Per ogni edificio, l'ultimo fotogramma in cui i suoi dettagli sono serviti. */
  private readonly ultimoUso: Int32Array;
  private numeroFotogramma = 0;
  /** Quanti dettagli sono serviti nel fotogramma in corso e in quello prima. */
  private usati = 0;
  private usatiPrima = 0;
  /**
   * Quanto tempo si può spendere in un fotogramma per preparare forme nuove (millisecondi), e
   * quante se ne preparano comunque, anche a tempo finito: così il disegno arriva sempre in fondo.
   * `inMemoria`: oltre quanti dettagli pronti si dimenticano quelli fuori vista.
   */
  bilancio = { millisecondi: 5, minimo: 48, inMemoria: DETTAGLI_IN_MEMORIA };
  /** L'orologio con cui si misura il bilancio: le prove ne mettono uno finto. */
  orologio: () => number = () => performance.now();
  private scadenza = 0;
  private preparati = 0;
  private tempoFinito = false;
  /**
   * true se nell'ultimo fotogramma qualche edificio è rimasto senza i suoi dettagli perché
   * non c'era tempo di prepararli: chi disegna chiede un altro fotogramma.
   */
  incompleto = false;
  /** Quanto si vedono le figurine in questo fotogramma (0 da lontano, 1 da vicino). */
  private pFigurine = 0;
  /** Le tinte delle macchine, ombra e tetto compresi, preparate una volta per colore. */
  private readonly coloriMacchine = new Map<string, Vagone['colori']>();
  /** I riquadri delle strade con le macchine sul piano isometrico, calcolati alla prima richiesta. */
  private riquadriCorsie: Rettangolo[] | null = null;
  /** true se nell'ultimo fotogramma si è disegnato qualcosa che si muove (acqua, treno in corsa). */
  animato = false;
  /**
   * Fra quanti millisecondi, al più, conviene ridisegnare anche se nulla si muove ora: la fine
   * della sosta del treno, la prossima corsa, o un controllo se il treno corre fuori vista.
   */
  prossimoMovimento = Infinity;
  /**
   * Ogni quanti millisecondi conviene ridisegnare ciò che si muove: l'acqua scorre piano e
   * basta poco; il treno in corsa ha bisogno di più fotogrammi.
   */
  intervalloAnimazione = Infinity;
  private spriteNuvola: HTMLCanvasElement | null = null;
  private chiaveNuvola = '';
  /** Tasselli dipinti facoltativi, stesi sopra gli edifici di giorno. */
  tasselli: Tasselli | null = null;
  /** Presenza degli strati di dettaglio nel fotogramma in corso (vedi DETTAGLI). */
  private pLuce = 0;
  private pSpigoli = 0;
  private pCornici = 0;
  private pCoppi = 0;
  private pPieni = 0;
  private pFitti = 0;
  private pFinestre = 0;
  private pFasce = 0;
  private pFacciata = 0;
  private pComignoli = 0;
  private finestreAccese = false;
  /** Quanto si vedono le finestre accese a questo zoom, tra 0 e 1. */
  private pAccese = 0;
  private serveFacciata = false;
  private serveTettoFine = false;
  private tratto = '';
  private spessoreTratto = 1;
  private spessoreCoppi = 1;
  /** Quante illustrazioni erano pronte quando sono stati costruiti i pezzi. */
  private pronteNeiPezzi = -1;

  /** Colori per edificio, decisi una volta. */
  private tinteTetto: string[] = [];
  private tinteTettoLuce: string[] = [];
  /** Le falde in luce al punto giusto della loro comparsa: tra la tinta di base e quella piena. */
  private tinteLuceOra: string[] = [];
  private quantoLuce = -1;
  private tinteTettoOmbra: string[] = [];
  private tinteMuro: { chiaro: string; scuro: string }[] = [];
  /** Le trame dipinte di ogni luce già usata; null dove non si possono creare (nelle prove). */
  private readonly trameDiLuce = new Map<Luce, Trame | null>();
  /** Il terreno del centro storico: la sagoma dei due fuochi, larga e stretta, e il suo riquadro. */
  private readonly centroLargo: Path2D;
  private readonly centroStretto: Path2D;
  private readonly riquadroCentro: Rettangolo;
  /** Per ogni edificio, quanto è lontano dal centro storico contando i due fuochi (metri). */
  private readonly lontano: Float32Array;
  /** Quanto pesano le fasce dei piani su ogni intonaco: meno su quelli scuri, dove rigano. */
  private pesoFasce: number[] = [];
  private readonly iTetto: Uint8Array;
  private readonly iMuro: Uint8Array;
  private chiome: { base: string; luce: string; ombra: string }[] = [];

  /** Tavolozza della luce attiva. */
  private P: Palette = PALETTE;
  private luceAttiva: Luce = 'giorno';
  /** Alone dei lampioni già disegnato, e il colore con cui è stato fatto. */
  private sprite: HTMLCanvasElement | null = null;
  private coloreSprite = '';

  private readonly larghezzeTesto = new Map<string, number>();
  /** Indici dei luoghi simbolo nell'ordine di disegno (dal più lontano). */
  private readonly ordineLandmark: number[] = [];
  /** Per ogni luogo simbolo, la sua posizione tra gli elementi in piedi. */
  private readonly postoLandmark: number[] = [];

  constructor(scena: Scena, illustrazioni: Illustrazioni) {
    this.scena = scena;
    this.illustrazioni = illustrazioni;
    // Anche di giorno i disegni dei luoghi simbolo prendono il loro velo, fin dal primo fotogramma.
    illustrazioni.impostaTinta(this.P.illustrazioni);
    const el = scena.elementi;
    for (let i = 0; i < el.n; i++) {
      if (el.tipo[i] === EL_LANDMARK) {
        this.ordineLandmark.push(el.rif[i]);
        this.postoLandmark[el.rif[i]] = i;
      }
    }

    // --- aree
    const acqua = new Path2D();
    let rAcqua: Rettangolo | null = null;
    const perTipo = new Map<TipoArea, number[]>();
    scena.aree.forEach((a, i) => {
      if (a.tipo === 'acqua') {
        tracciaAnello(acqua, a.anello);
        const k = i * 4;
        const q = scena.riquadriAree;
        this.riquadriAcqua.push({ minX: q[k], minY: q[k + 1], maxX: q[k + 2], maxY: q[k + 3] });
        rAcqua = rAcqua
          ? {
              minX: Math.min(rAcqua.minX, q[k]),
              minY: Math.min(rAcqua.minY, q[k + 1]),
              maxX: Math.max(rAcqua.maxX, q[k + 2]),
              maxY: Math.max(rAcqua.maxY, q[k + 3]),
            }
          : { minX: q[k], minY: q[k + 1], maxX: q[k + 2], maxY: q[k + 3] };
        return;
      }
      const elenco = perTipo.get(a.tipo) ?? [];
      elenco.push(i);
      perTipo.set(a.tipo, elenco);
    });
    this.acqua = rAcqua ? { ...(rAcqua as Rettangolo), percorso: acqua } : null;
    for (const [tipo, indici] of perTipo) {
      const pezzi: Pezzo[] = [];
      for (const t of raggruppaInTessere(scena.riquadriAree, indici, LATO_TESSERA * 2)) {
        const percorso = new Path2D();
        for (const i of t.indici) tracciaAnello(percorso, scena.aree[i].anello);
        pezzi.push({ minX: t.minX, minY: t.minY, maxX: t.maxX, maxY: t.maxY, percorso });
      }
      this.aree.set(tipo, pezzi);
    }

    // --- strade
    const perStrada = new Map<string, number[]>();
    scena.strade.forEach((s, i) => {
      const chiave = s.tipo + (s.ponte ? '+ponte' : '');
      const elenco = perStrada.get(chiave) ?? [];
      elenco.push(i);
      perStrada.set(chiave, elenco);
    });
    for (const [chiave, indici] of perStrada) {
      const pezzi: Pezzo[] = [];
      for (const t of raggruppaInTessere(scena.riquadriStrade, indici, LATO_TESSERA * 2)) {
        const percorso = new Path2D();
        for (const i of t.indici) tracciaLinea(percorso, scena.strade[i].linea);
        pezzi.push({ minX: t.minX, minY: t.minY, maxX: t.maxX, maxY: t.maxY, percorso });
      }
      this.strade.set(chiave, pezzi);
    }

    // --- linee tematiche
    const perLinea = new Map<string, Path2D>();
    for (const l of scena.linee) {
      const chiave = l.dati.strato + '|' + l.dati.tipo;
      let percorso = perLinea.get(chiave);
      if (!percorso) {
        percorso = new Path2D();
        perLinea.set(chiave, percorso);
        this.linee.push({ strato: l.dati.strato, tipo: l.dati.tipo, percorso });
      }
      tracciaLinea(percorso, l.linea);
    }

    // --- colori degli edifici: gli indici si decidono una volta, le tinte a ogni cambio di luce
    const P = PALETTE;
    const tCotto = 0;
    const tIndustria = P.tetti.length;
    const tPiano = tIndustria + P.tettoIndustria.length;
    const mIntonaci = 0;
    const mIndustria = mIntonaci + P.intonaci.length;
    const mPietra = mIndustria + P.intonacoIndustria.length;
    const mMattone = mPietra + P.pietra.length;
    const mForti = mMattone + P.mattone.length;
    const mChiari = mForti + P.intonaciForti.length;
    this.ultimoUso = new Int32Array(scena.edifici.length).fill(-1);
    this.iTetto = new Uint8Array(scena.edifici.length);
    this.iMuro = new Uint8Array(scena.edifici.length);
    this.lontano = new Float32Array(scena.edifici.length);
    // Sagoma del centro storico sul piano isometrico: un cerchio in pianta è un'ellisse 2:1.
    const sagoma = (margine: number): Path2D => {
      const p = new Path2D();
      for (const f of FUOCHI_CENTRO) {
        const c = metriInIso(f.x, f.y);
        const r = f.raggio + margine;
        for (let k = 0; k < 40; k++) {
          const angolo = (Math.PI * 2 * k) / 40;
          const x = c.sx + r * Math.cos(angolo);
          const y = c.sy + (r / 2) * Math.sin(angolo);
          if (k === 0) p.moveTo(x, y);
          else p.lineTo(x, y);
        }
        p.closePath();
      }
      return p;
    };
    this.centroLargo = sagoma(70);
    this.centroStretto = sagoma(0);
    const rc: Rettangolo = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const f of FUOCHI_CENTRO) {
      const c = metriInIso(f.x, f.y);
      const r = f.raggio + 70;
      rc.minX = Math.min(rc.minX, c.sx - r);
      rc.maxX = Math.max(rc.maxX, c.sx + r);
      rc.minY = Math.min(rc.minY, c.sy - r / 2);
      rc.maxY = Math.max(rc.maxY, c.sy + r / 2);
    }
    this.riquadroCentro = rc;
    scena.edifici.forEach((e, i) => {
      // Dal centro dell'impronta sul piano isometrico si torna ai metri locali.
      const piu = -e.cy / ISO_Y;
      const meno = e.cx / ISO_X;
      const lontano = Math.min(e.dist, lontananzaDalCentro((piu + meno) / 2, (piu - meno) / 2));
      this.lontano[i] = lontano;
      const a = e.seme & 0xffff;
      const b = e.seme >>> 16;
      if (e.tipo === 'industria' || e.forma === TETTO_CAPANNONE) {
        this.iTetto[i] = tIndustria + (a % P.tettoIndustria.length);
      } else if (e.forma === TETTO_TERRAZZA) {
        this.iTetto[i] = tPiano + (a % P.tettoPiano.length);
      } else {
        this.iTetto[i] = tCotto + (a % P.tetti.length);
      }
      if (e.tipo === 'industria' || e.forma === TETTO_CAPANNONE) {
        this.iMuro[i] = mIndustria + (b % P.intonacoIndustria.length);
      } else if (e.tipo === 'chiesa') {
        this.iMuro[i] = mPietra + (b % P.pietra.length);
      } else if (e.tipo === 'torre') {
        this.iMuro[i] = mMattone + (b % P.mattone.length);
      } else {
        // Intonaci con criterio: caldi e carichi in centro, più chiari e moderni verso fuori.
        const caso = b % 100;
        const altro = b >>> 7;
        const intonaco = mIntonaci + (altro % P.intonaci.length);
        const forte = mForti + (altro % P.intonaciForti.length);
        const chiaro = mChiari + (altro % P.intonaciChiari.length);
        if (lontano < RAGGIO_CENTRO) {
          this.iMuro[i] = caso < 36 ? forte : caso < 93 ? intonaco : mPietra + (altro % P.pietra.length);
        } else if (lontano < RAGGIO_CINTURA) {
          this.iMuro[i] = caso < 16 ? forte : caso < 74 ? intonaco : chiaro;
        } else {
          this.iMuro[i] = caso < 46 ? chiaro : caso < 92 ? intonaco : forte;
        }
      }
    });
    this.calcolaTinte();

    // --- tessere per la vista da lontano
    const tutti = scena.edifici.map((_, i) => i);
    this.tessereEdifici = raggruppaInTessere(scena.riquadriEdifici, tutti, LATO_TESSERA);
    // Il riquadro delle tessere deve comprendere l'altezza dei tetti.
    for (const t of this.tessereEdifici) {
      let su = 0;
      for (const i of t.indici) su = Math.max(su, scena.edifici[i].alt + scena.edifici[i].colmo);
      t.minY -= su;
    }
    this.tessereOmbre = raggruppaInTessere(scena.riquadriEdifici, tutti, LATO_TESSERA / 2);
    for (const t of this.tessereOmbre) t.maxX += 2 * ISO_X * OMBRA_MASSIMA;
    this.azzeraPezzi();
  }

  /** Le tinte di tetti, muri e chiome nella luce attiva, nello stesso ordine in ogni luce. */
  private calcolaTinte(): void {
    const P = this.P;
    this.tinteTetto = [...P.tetti, ...P.tettoIndustria, ...P.tettoPiano];
    this.tinteTettoLuce = this.tinteTetto.map((c) => sfuma(c, P.falde.luce));
    const fredda = P.ombraTinta;
    this.tinteTettoOmbra = this.tinteTetto.map((c) =>
      mescolaColori(inOmbra(c, P.falde.ombra, P.ombraCalda), fredda.colore, fredda.quanto),
    );
    this.quantoLuce = -1;
    this.tinteMuro = [
      ...P.intonaci,
      ...P.intonacoIndustria,
      ...P.pietra,
      ...P.mattone,
      ...P.intonaciForti,
      ...P.intonaciChiari,
    ].map((c) => ({
      chiaro: sfuma(c, P.muri.chiaro),
      scuro: mescolaColori(inOmbra(c, P.muri.scuro, P.ombraCalda), fredda.colore, fredda.quanto),
    }));
    this.pesoFasce = this.tinteMuro.map((m) => {
      const l = (luminanza(m.chiaro) - 0.45) / 0.35;
      return 0.4 + 0.6 * Math.max(0, Math.min(1, l));
    });
    this.chiome = P.chiome.map((c) => ({ base: c, luce: sfuma(c, 0.16), ombra: inOmbra(c, -0.2, P.ombraCalda * 0.5) }));
  }

  /**
   * Le trame dipinte della luce attiva: si creano la prima volta che servono (qualche decina di
   * tele piccole, pochi millisecondi) e poi restano. null dove non c'è un documento.
   */
  private trame(): Trame | null {
    let t = this.trameDiLuce.get(this.luceAttiva);
    if (t === undefined) {
      t = this.creaTrame();
      this.trameDiLuce.set(this.luceAttiva, t);
    }
    return t;
  }

  private creaTrame(): Trame | null {
    if (typeof document === 'undefined') return null;
    const P = this.P;
    const C = campi();
    const selciato = creaSelciato(P.selciato);
    const onde = creaIncrespature(P.acquaChiara, P.acquaBordo);
    const macchie: CanvasPattern[] = [];
    for (const campo of C.macchie) {
      const lato = Math.round(Math.sqrt(campo.length));
      const m = motivo(creaMacchie(campo, P.macchie, P.macchieTinta.scuro, P.macchieTinta.chiaro), METRI_TRAMA / lato);
      // O tutti i livelli o nessuno: l'indice del livello deve valere sempre.
      if (!m) {
        macchie.length = 0;
        break;
      }
      macchie.push(m);
    }
    return {
      macchie,
      selciato: selciato ? motivo(selciato.tela, selciato.scala) : null,
      increspature: onde ? motivo(onde.tela, onde.scala) : null,
    };
  }

  /** Luce con cui si sta disegnando. */
  get luce(): Luce {
    return this.luceAttiva;
  }

  /** Colore steso sotto la mappa nella luce attiva: chi vuole può intonarci la pagina. */
  get sfondo(): string {
    return this.P.sfondo;
  }

  /**
   * Cambia la luce: tavolozza, tinte degli edifici e velo sui luoghi simbolo. Restituisce
   * false se era già quella. Le tessere (pezziPiatti, pezziTetti) e la pittura degli edifici
   * (volumi, facciate, tetti) sono solo forme, senza colori: restano valide in ogni luce e non
   * vanno rifatte. Le sole immagini in memoria
   * sono le copie dei luoghi simbolo, rifatte sulla stessa tela, e lo sprite dell'alone.
   */
  impostaLuce(luce: Luce): boolean {
    if (luce === this.luceAttiva || !(luce in PALETTE_PER_LUCE)) return false;
    this.luceAttiva = luce;
    this.P = PALETTE_PER_LUCE[luce];
    this.calcolaTinte();
    this.illustrazioni.impostaTinta(this.P.illustrazioni);
    return true;
  }

  private alone(): HTMLCanvasElement | null {
    const colore = this.P.lampioni.alone;
    if (this.coloreSprite !== colore) {
      this.coloreSprite = colore;
      this.sprite = creaAlone(colore);
    }
    return this.sprite;
  }

  private azzeraPezzi(): void {
    this.pezziPiatti = this.tessereEdifici.map(() => null);
    this.pezziTetti = this.tessereEdifici.map(() => null);
    this.pezziOmbre = this.tessereOmbre.map(() => null);
  }

  private coperto(e: EdificioPronto): boolean {
    return e.sotto >= 0 && this.illustrazioni.elenco[e.sotto].pronta;
  }

  /**
   * true se l'illustrazione del luogo si disegna a questo zoom: deve essere pronta e,
   * nella vista da lontano, non ridotta a pochi pixel (lì resta il segnaposto).
   */
  illustrazioneMostrata(indice: number, camera: Camera, vista: Vista): boolean {
    const ill = this.illustrazioni.elenco[indice];
    if (!ill || !ill.pronta) return false;
    if (livelloDettaglio(camera.zoom, vista) !== 'piatto') return true;
    return this.scena.landmark[indice].larghezza * camera.zoom >= SPRITE_SOGLIA;
  }

  /**
   * I segnaposto da disegnare e da cliccare: quelli degli strati accesi, meno quelli che
   * stanno su un'illustrazione in vista (lì c'è già il disegno, con il suo nome).
   */
  marcatori(visibili: StratiVisibili, camera: Camera, vista: Vista): Marcatore[] {
    const salta = (p: PuntoPronto): boolean =>
      p.landmark >= 0 && this.illustrazioneMostrata(p.landmark, camera, vista);
    return marcatoriInVista(this.scena.punti, visibili, camera, vista, salta);
  }

  /**
   * true se nel punto (px, py) dello schermo l'illustrazione è coperta da un edificio
   * disegnato dopo di lei, cioè più vicino a chi guarda. Da lontano le illustrazioni
   * stanno sopra a tutto e non sono mai coperte.
   */
  copertaDaEdifici(indice: number, px: number, py: number, camera: Camera, vista: Vista): boolean {
    if (livelloDettaglio(camera.zoom, vista) !== 'pieno') return false;
    const posto = this.postoLandmark[indice];
    if (posto === undefined) return false;
    const centro = metriInIso(camera.x, camera.y);
    const x = (px - vista.larghezza / 2) / camera.zoom + centro.sx;
    const y = (py - vista.altezza / 2) / camera.zoom + centro.sy;
    const el = this.scena.elementi;
    const vicini = el.griglia.interroga({ minX: x - 1, minY: y - 1, maxX: x + 1, maxY: y + 1 });
    for (let j = vicini.length - 1; j >= 0; j--) {
      const i = vicini[j];
      if (i <= posto) break;
      if (el.tipo[i] !== EL_EDIFICIO) continue;
      const e = this.scena.edifici[el.rif[i]];
      if (this.coperto(e)) continue;
      if (puntoSuEdificio(x, y, e.anello, e.alt, e.lati, e.facce, e.facceInfo)) return true;
    }
    return false;
  }

  /** I rettangoli sullo schermo delle illustrazioni in vista, in ordine di disegno. */
  spriteInVista(camera: Camera, vista: Vista): Sprite[] {
    const u: Sprite[] = [];
    for (const indice of this.ordineLandmark) {
      const ill = this.illustrazioni.elenco[indice];
      if (!this.illustrazioneMostrata(indice, camera, vista)) continue;
      const s = rettangoloSprite(this.scena.landmark[indice], indice, ill.proporzione, camera, vista);
      if (s.x > vista.larghezza || s.y > vista.altezza || s.x + s.larghezza < 0 || s.y + s.altezza < 0) {
        continue;
      }
      u.push(s);
    }
    return u;
  }

  disegna(ctx: CanvasRenderingContext2D, s: StatoDisegno): void {
    const { camera, vista, densita } = s;
    const z = camera.zoom;
    const centro = metriInIso(camera.x, camera.y);
    const k = z * densita;
    const tx = (vista.larghezza / 2) * densita - centro.sx * k;
    const ty = (vista.altezza / 2) * densita - centro.sy * k;
    const inIso = (): void => ctx.setTransform(k, 0, 0, k, tx, ty);
    const inPixel = (): void => ctx.setTransform(densita, 0, 0, densita, 0, 0);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // Il fondo è quello della pagina di giorno (stesso colore della carta), più scuro di notte.
    ctx.fillStyle = this.P.sfondo;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);

    const visibile = riquadroVisibile(camera, vista, 4 / z);
    const dettaglio = livelloDettaglio(z, vista);
    this.incompleto = false;
    this.animato = false;
    this.prossimoMovimento = Infinity;
    this.intervalloAnimazione = Infinity;

    const pronte = this.illustrazioni.elenco.reduce((n, v) => n + (v.pronta ? 1 : 0), 0);
    if (pronte !== this.pronteNeiPezzi) {
      this.pronteNeiPezzi = pronte;
      this.azzeraPezzi();
    }

    inIso();
    const trame = this.trame();
    // Quanto si vedono le lastre del selciato e le increspature dell'acqua a questo zoom.
    const pSelciato = trame ? presenza(z, DETTAGLI.selciato) : 0;
    this.carta(ctx, s, z);
    this.terreno(ctx, visibile, z, trame, pSelciato, s.tempo);
    this.rete(ctx, visibile, z, trame, pSelciato);
    if (dettaglio === 'pieno' && this.P.ombraCase !== '' && z > DETTAGLI.ombre.da) {
      this.ombreATerra(ctx, visibile, presenza(z, DETTAGLI.ombre));
    }
    if (this.P.lampioni.accesi) this.aloniATerra(ctx, camera, vista);
    this.tematiche(ctx, s, z);

    inPixel();
    this.evidenza(ctx, s);

    inIso();
    const sprite = this.spriteInVista(camera, vista);
    if (dettaglio === 'pieno') {
      this.inPiedi(ctx, s, visibile, z, inIso, inPixel);
    } else {
      this.daLontano(ctx, visibile, z, dettaglio === 'piatto');
      inPixel();
      for (const sp of sprite) this.illustrazione(ctx, sp, densita);
    }

    // La mano d'acquerello: una passata sola su tutto il foglio, case, strade, acqua e luoghi
    // simbolo insieme, così tutto sembra dipinto dalla stessa mano. Sta attaccata alla mappa.
    // Un riempimento per fotogramma, qualunque sia il numero di case in vista, con la fusione
    // normale (veli trasparenti): è leggera, il colore vero lo danno le tinte di tetti e muri.
    // Da lontano si usa una tela ridotta, perché la grana non frigga muovendo la mappa.
    const veli = trame ? trame.macchie : [];
    const pMacchie = veli.length > 0 ? presenza(z, DETTAGLI.macchie) : 0;
    if (pMacchie > 0) {
      inIso();
      ctx.globalAlpha = pMacchie;
      ctx.fillStyle = veli[Math.min(veli.length - 1, livelloTrama(k))];
      // Senza ammorbidire: i pixel della tela scelta sono già grandi quasi come quelli dello
      // schermo, e così il riempimento costa meno.
      ctx.imageSmoothingEnabled = false;
      ctx.fillRect(visibile.minX, visibile.minY, visibile.maxX - visibile.minX, visibile.maxY - visibile.minY);
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 1;
    }

    // Oltre il bordo dei dati non c'è il vuoto: un banco di nuvole copre il margine.
    inIso();
    this.nuvole(ctx, s, visibile, z);

    // I tasselli dipinti coprono la loro zona, sotto etichette e segnaposto. Solo di giorno.
    if (this.tasselli && this.luceAttiva === 'giorno') {
      inIso();
      this.tasselli.disegna(ctx, z);
    }

    inPixel();
    this.segnaposto(ctx, s, sprite);
  }

  // --- nuvole --------------------------------------------------------------------

  private nuvole(ctx: CanvasRenderingContext2D, s: StatoDisegno, visibile: Rettangolo, z: number): void {
    const N = this.P.nuvole;
    const chiave = N.colore + N.ombra;
    if (chiave !== this.chiaveNuvola) {
      this.chiaveNuvola = chiave;
      this.spriteNuvola = creaNuvola(N.colore, N.ombra);
    }
    const sprite = this.spriteNuvola;
    if (!sprite) return;
    const elenco = nuvoleInVista(s.area, visibile, z);
    if (elenco.length === 0) return;
    // Un velo del colore delle nuvole dove sono fitte, così tra una e l'altra non si vede il fondo.
    const proporzione = sprite.height / sprite.width;
    for (const n of elenco) {
      const l = n.larghezza;
      ctx.globalAlpha = n.alfa * N.alfa;
      ctx.drawImage(sprite, n.sx - l / 2, n.sy - (l * proporzione) / 2, l, l * proporzione);
    }
    ctx.globalAlpha = 1;
  }

  // --- carta ---------------------------------------------------------------------

  private carta(ctx: CanvasRenderingContext2D, s: StatoDisegno, z: number): void {
    const a = angoliInIso(s.area);
    const rombo = new Path2D();
    rombo.moveTo(a[0].sx, a[0].sy);
    for (let i = 1; i < 4; i++) rombo.lineTo(a[i].sx, a[i].sy);
    rombo.closePath();
    // Oltre il bordo dei dati la carta sfuma: tanti contorni larghi e leggeri.
    const sfumatura = Math.max(140, 90 / z);
    const passi = 12;
    ctx.strokeStyle = this.P.carta;
    ctx.globalAlpha = 0.2;
    for (let i = passi; i >= 1; i--) {
      ctx.lineWidth = (2 * sfumatura * i) / passi;
      ctx.stroke(rombo);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.P.carta;
    ctx.fill(rombo);
    // Il terreno del centro storico: una mano di sabbia calda, in due passate perché il bordo
    // non sia netto.
    const C = this.P.centro;
    if (C.alfa > 0 && siToccano(this.riquadroCentro, riquadroVisibile(s.camera, s.vista, 4 / z))) {
      ctx.fillStyle = conAlfa(C.colore, C.alfa * 0.5);
      ctx.fill(this.centroLargo);
      ctx.fill(this.centroStretto);
    }
  }

  // --- aree ----------------------------------------------------------------------

  private terreno(
    ctx: CanvasRenderingContext2D,
    visibile: Rettangolo,
    z: number,
    trame: Trame | null,
    pSelciato: number,
    tempo?: number,
  ): void {
    const P = this.P;
    const lastre = pSelciato > 0 && trame ? trame.selciato : null;
    // Prima campi e verde, poi l'acqua, poi le piazze: nei dati veri prati e parchi
    // di riva si sovrappongono al fiume e lo nasconderebbero.
    const stendi = (tipo: TipoArea): void => {
      const pezzi = this.aree.get(tipo);
      if (!pezzi) return;
      ctx.fillStyle = P.aree[tipo];
      for (const p of pezzi) {
        if (!siToccano(p, visibile)) continue;
        ctx.fill(p.percorso);
        if (z > 1.2 && (tipo === 'piazza' || tipo === 'parco')) {
          ctx.strokeStyle = conAlfa(P.seppiaChiaro, 0.45);
          ctx.lineWidth = 0.6 / z;
          ctx.stroke(p.percorso);
        }
        if (tipo === 'piazza' && lastre) {
          ctx.globalAlpha = pSelciato * P.trame.selciato;
          ctx.fillStyle = lastre;
          ctx.fill(p.percorso);
          ctx.globalAlpha = 1;
          ctx.fillStyle = P.aree[tipo];
        }
      }
    };
    for (const tipo of AREE_SOTTO) stendi(tipo);
    if (this.acqua && siToccano(this.acqua, visibile)) {
      const acqua = this.acqua.percorso;
      const pArgine = presenza(z, { da: 1.2, a: 2 });
      if (pArgine > 0) {
        // L'argine: un bordo di pietra chiara lungo la riva. Si traccia prima dell'acqua, che ne
        // copre la metà interna: così resta fuori, e un canale stretto non si svuota.
        ctx.strokeStyle = conAlfa(P.argine, pArgine);
        ctx.lineWidth = 2.8;
        ctx.stroke(acqua);
      }
      ctx.fillStyle = P.aree.acqua;
      ctx.fill(acqua);
      // Fascia più chiara parallela alla riva lontana, come un filo di corrente.
      ctx.save();
      ctx.clip(acqua);
      ctx.translate(0, 9);
      ctx.fillStyle = P.acquaChiara;
      ctx.globalAlpha = P.corrente;
      ctx.fill(acqua);
      ctx.translate(0, 13);
      ctx.globalAlpha = 1;
      ctx.fillStyle = P.aree.acqua;
      ctx.fill(acqua);
      ctx.translate(0, -22);
      if (z > 1.2) {
        // Sotto le rive l'acqua è più scura: due passate larghe lungo il bordo, tagliate dall'acqua.
        ctx.strokeStyle = conAlfa(P.acquaBordo, 0.13 * pArgine);
        ctx.lineWidth = 14;
        ctx.stroke(acqua);
        ctx.lineWidth = 5;
        ctx.stroke(acqua);
      }
      const acquaInVista = this.riquadriAcqua.some((r) => siToccano(r, visibile));
      const pFiloni = trame?.increspature && acquaInVista ? presenza(z, DETTAGLI.filoni) : 0;
      if (pFiloni > 0 && trame?.increspature) {
        // I filoni: la tessera delle increspature ingrandita, chiara e veloce. Da vicino sfuma un
        // poco, perché lì le increspature fini bastano a far vedere il movimento.
        const vicino = presenza(z, { da: 3, a: 5 });
        ctx.fillStyle = trame.increspature;
        const minX = Math.max(this.acqua.minX, visibile.minX);
        const minY = Math.max(this.acqua.minY, visibile.minY);
        const maxX = Math.min(this.acqua.maxX, visibile.maxX);
        const maxY = Math.min(this.acqua.maxY, visibile.maxY);
        for (const f of FILONI) {
          const k = f.scala;
          const { dx, dy } = tempo === undefined ? { dx: 0, dy: 0 } : spostamentoFiloni(tempo, f.scala, f.periodo);
          ctx.globalAlpha = Math.min(1, pFiloni * P.trame.corrente * f.alfa * (1 - 0.45 * vicino));
          ctx.save();
          ctx.translate(dx, dy);
          ctx.scale(k, k);
          ctx.fillRect((minX - dx) / k - 36, (minY - dy) / k - 18, (maxX - minX) / k + 72, (maxY - minY) / k + 36);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
        if (tempo !== undefined) this.inMovimentoLento();
      }
      const pAcqua = trame?.increspature ? presenza(z, DETTAGLI.acqua) : 0;
      if (pAcqua > 0 && trame?.increspature) {
        ctx.globalAlpha = pAcqua * P.trame.acqua;
        ctx.fillStyle = trame.increspature;
        if (tempo === undefined) {
          ctx.fill(acqua);
        } else {
          // La corrente: si sposta il disegno delle increspature, non l'acqua. La tessera si
          // ripete ogni (36, 18) unità, quindi lo spostamento torna su sé stesso senza stacchi.
          // Il ritaglio sull'acqua è già in vigore: basta coprire la parte d'acqua in vista.
          const { dx, dy } = spostamentoCorrente(tempo);
          const minX = Math.max(this.acqua.minX, visibile.minX);
          const minY = Math.max(this.acqua.minY, visibile.minY);
          const maxX = Math.min(this.acqua.maxX, visibile.maxX);
          const maxY = Math.min(this.acqua.maxY, visibile.maxY);
          ctx.translate(dx, dy);
          ctx.fillRect(minX - dx - 36, minY - dy - 18, maxX - minX + 72, maxY - minY + 36);
          ctx.translate(-dx, -dy);
          // Il riquadro di tutta l'acqua copre quasi la città: si anima solo se un'area d'acqua è in vista.
          if (acquaInVista) this.inMovimentoLento();
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      if (z > 0.5) {
        // Il filo scuro dell'acqua lungo la riva.
        ctx.strokeStyle = conAlfa(P.acquaBordo, 0.55 + 0.25 * pArgine);
        ctx.lineWidth = Math.max(0.5, 0.8 / z);
        ctx.stroke(acqua);
      }
    }
    stendi('piazza');
  }

  // --- strade --------------------------------------------------------------------

  private rete(
    ctx: CanvasRenderingContext2D,
    visibile: Rettangolo,
    z: number,
    trame: Trame | null,
    pSelciato: number,
  ): void {
    const P = this.P;
    const conBordo = z >= 0.7;
    const bordo = Math.max(0.45, 0.8 / z);
    const larghezza = (t: Exclude<TipoStrada, 'ferrovia'>): number =>
      Math.max(LARGHEZZE[t].metri * 0.8, LARGHEZZE[t].minimo / z);
    const passa = (chiave: string, f: (p: Pezzo) => void): void => {
      const pezzi = this.strade.get(chiave);
      if (!pezzi) return;
      for (const p of pezzi) if (siToccano(p, visibile)) f(p);
    };

    for (const ponte of [false, true]) {
      const coda = ponte ? '+ponte' : '';
      if (conBordo) {
        for (const t of ORDINE_STRADE) {
          if (z < LARGHEZZE[t].da) continue;
          ctx.strokeStyle = ponte ? P.ponteBordo : P.strade[t].bordo;
          ctx.lineWidth = larghezza(t) + 2 * (ponte ? bordo * 1.6 : bordo);
          // I ponti finiscono netti, le strade si arrotondano negli incroci.
          ctx.lineCap = ponte ? 'butt' : 'round';
          passa(t + coda, (p) => ctx.stroke(p.percorso));
        }
      }
      ctx.lineCap = 'round';
      for (const t of ORDINE_STRADE) {
        if (z < LARGHEZZE[t].da) continue;
        // Da lontano, senza bordo, la strada è un filo del colore del bordo.
        ctx.strokeStyle = conBordo ? P.strade[t].riempimento : P.strade[t].bordo;
        ctx.lineWidth = conBordo ? larghezza(t) : Math.max(larghezza(t) * 0.7, 0.8 / z);
        passa(t + coda, (p) => ctx.stroke(p.percorso));
      }
      // Nel centro storico le strade sono lastricate: le stesse lastre delle piazze, stese
      // sopra la tinta della strada e tagliate sulla sagoma del centro.
      if (!ponte && pSelciato > 0 && trame?.selciato && siToccano(this.riquadroCentro, visibile)) {
        ctx.save();
        ctx.clip(this.centroStretto);
        ctx.globalAlpha = pSelciato * P.trame.selciato;
        ctx.strokeStyle = trame.selciato;
        for (const t of ORDINE_STRADE) {
          if (z < LARGHEZZE[t].da) continue;
          ctx.lineWidth = larghezza(t);
          passa(t, (p) => ctx.stroke(p.percorso));
        }
        ctx.restore();
      }
      // La ferrovia di base: una riga scura con i tratti chiari delle traversine.
      const chiave = 'ferrovia' + coda;
      if (this.strade.has(chiave)) {
        ctx.lineCap = 'butt';
        ctx.strokeStyle = P.ferrovia;
        ctx.lineWidth = Math.max(2.4, 1.3 / z);
        passa(chiave, (p) => ctx.stroke(p.percorso));
        if (z > 0.8) {
          ctx.strokeStyle = P.ferroviaTratto;
          ctx.lineWidth = Math.max(1.1, 0.6 / z);
          ctx.setLineDash([5, 5]);
          passa(chiave, (p) => ctx.stroke(p.percorso));
          ctx.setLineDash([]);
        }
        ctx.lineCap = 'round';
      }
    }
  }

  // --- lampioni ------------------------------------------------------------------

  /**
   * La luce dei lampioni sul terreno e sulle strade, prima di tutto ciò che sta in piedi:
   * le case la coprono come farebbero davvero. Uno sprite solo, schiacciato come un cerchio
   * visto in isometria; con 'screen' le luci vicine si sommano senza bruciare.
   */
  private aloniATerra(ctx: CanvasRenderingContext2D, camera: Camera, vista: Vista): void {
    const sprite = this.alone();
    const lampioni = this.scena.lampioni;
    if (!sprite || lampioni.length === 0) return;
    const { indici, quanti, quota, raggio } = aloniInVista(this.scena, camera, vista);
    if (quanti === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Con meno luci accese ognuna è un poco più forte: la luce in tutto cambia senza scatti.
    ctx.globalAlpha = Math.min(1, 0.72 / Math.sqrt(quota));
    for (let j = 0; j < quanti; j++) {
      const i = indici[j];
      ctx.drawImage(sprite, lampioni[i * 2] - raggio, lampioni[i * 2 + 1] - raggio / 2, raggio * 2, raggio);
    }
    ctx.restore();
  }

  /** Un lampione tra le case: palo sottile da vicino; di notte lampada accesa e piccolo alone. */
  private lampione(ctx: CanvasRenderingContext2D, indice: number, z: number): void {
    const L = this.P.lampioni;
    const conPalo = z >= (L.accesi ? ZOOM_PALI.notte : ZOOM_PALI.giorno);
    if (!conPalo && !L.accesi) return;
    const sx = this.scena.lampioni[indice * 2];
    const sy = this.scena.lampioni[indice * 2 + 1];
    const cima = sy - ALTEZZA_LAMPIONE;
    if (L.accesi) {
      // Alone attorno alla lampada: schiarisce le facciate dietro, e le case davanti lo coprono.
      const sprite = this.alone();
      if (sprite) {
        const r = 5.5;
        ctx.globalAlpha = 0.5;
        ctx.drawImage(sprite, sx - r, cima - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
    }
    if (!conPalo) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = L.palo;
    ctx.lineWidth = Math.max(0.32, 0.9 / z);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, cima + 0.4);
    ctx.stroke();
    ctx.fillStyle = L.lampada;
    ctx.beginPath();
    ctx.arc(sx, cima, L.accesi ? 0.62 : 0.5, 0, Math.PI * 2);
    ctx.fill();
    if (!L.accesi) {
      ctx.lineWidth = Math.max(0.18, 0.6 / z);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- linee tematiche -------------------------------------------------------------

  private tematiche(ctx: CanvasRenderingContext2D, s: StatoDisegno, z: number): void {
    const P = this.P;
    for (const l of this.linee) {
      if (!s.visibili[l.strato]) continue;
      const spessore = Math.max(2.2, 2.6 / z);
      ctx.lineCap = 'round';
      ctx.strokeStyle = conAlfa(P.carta, 0.85);
      ctx.lineWidth = spessore + 2.4 / z;
      ctx.stroke(l.percorso);
      if (l.tipo === 'ciclabile') {
        ctx.strokeStyle = P.ciclabile;
        ctx.lineWidth = spessore;
        ctx.lineCap = 'butt';
        ctx.setLineDash([7 / z, 4 / z]);
        ctx.stroke(l.percorso);
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = P.ferroviaTematica;
        ctx.lineWidth = spessore;
        ctx.stroke(l.percorso);
        ctx.strokeStyle = P.carta;
        ctx.lineWidth = spessore * 0.4;
        ctx.lineCap = 'butt';
        ctx.setLineDash([6 / z, 6 / z]);
        ctx.stroke(l.percorso);
        ctx.setLineDash([]);
      }
      ctx.lineCap = 'round';
    }
  }

  // --- evidenza ------------------------------------------------------------------

  private evidenza(ctx: CanvasRenderingContext2D, s: StatoDisegno): void {
    if (!s.evidenziata) return;
    const { camera, vista } = s;
    this.scena.landmark.forEach((l, i) => {
      if (l.dati.storia !== s.evidenziata) return;
      const c = isoInSchermo(l.sx, l.sy, camera, vista);
      if (!this.illustrazioni.elenco[i].pronta) return;
      const raggio = Math.max(l.semiL * 1.25 * camera.zoom, 30);
      this.aloneEvidenza(ctx, c.px, c.py, raggio);
    });
  }

  /** true se la storia evidenziata ha un'illustrazione: allora l'alone sta sotto quella. */
  private evidenzaSuLandmark(storia: string | null): boolean {
    return (
      storia !== null &&
      this.scena.landmark.some(
        (l, i) => l.dati.storia === storia && this.illustrazioni.elenco[i].pronta,
      )
    );
  }

  /** Alone morbido e anello dorato appoggiati sul terreno. */
  private aloneEvidenza(ctx: CanvasRenderingContext2D, x: number, y: number, raggio: number): void {
    ctx.fillStyle = this.P.evidenza;
    for (let i = 5; i >= 0; i--) {
      const r = raggio * (1 + i * 0.13);
      ctx.globalAlpha = 0.09;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = this.P.evidenza;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, raggio, raggio / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // --- ombre delle case --------------------------------------------------------------

  /**
   * L'ombra che ogni casa stende a terra, verso sud-est (sullo schermo: a destra), lunga in
   * proporzione all'altezza. Si stende prima di tutto ciò che sta in piedi, una forma sola per
   * tessera: le strade prendono un lato in ombra e le case poggiano sul terreno.
   */
  private ombreATerra(ctx: CanvasRenderingContext2D, visibile: Rettangolo, quanto: number): void {
    const lunga = this.P.ombraLunga;
    if (lunga !== this.lungaNeiPezzi) {
      this.lungaNeiPezzi = lunga;
      this.pezziOmbre.fill(null);
    }
    const edifici = this.scena.edifici;
    ctx.fillStyle = this.P.ombraCase;
    ctx.globalAlpha = quanto;
    for (let t = 0; t < this.tessereOmbre.length; t++) {
      const tessera = this.tessereOmbre[t];
      if (!siToccano(tessera, visibile)) continue;
      let pezzo = this.pezziOmbre[t];
      if (!pezzo) {
        pezzo = new Path2D();
        for (const i of tessera.indici) {
          const e = edifici[i];
          if (this.coperto(e)) continue;
          const alta = (e.alt + e.colmo * 0.5) / ISO_Z;
          if (alta < 1.5) continue;
          // Spostamento in pianta (d, -d): sullo schermo è un passo in orizzontale.
          const s = 2 * ISO_X * Math.min(OMBRA_MASSIMA, alta * OMBRA_PER_METRO * lunga);
          const a = e.anello;
          const n = a.length >> 1;
          let giro = 0;
          for (let k = 0; k < n; k++) {
            const j = (k + 1) % n;
            giro += a[k * 2] * a[j * 2 + 1] - a[j * 2] * a[k * 2 + 1];
          }
          pezzo.moveTo(a[0] + s, a[1]);
          for (let k = 1; k < n; k++) pezzo.lineTo(a[k * 2] + s, a[k * 2 + 1]);
          pezzo.closePath();
          // La striscia che ogni lato spazza: tutte nello stesso verso dell'impronta, così
          // riempite insieme non si cancellano.
          for (let k = 0; k < n; k++) {
            const j = (k + 1) % n;
            const dy = a[j * 2 + 1] - a[k * 2 + 1];
            if (Math.abs(dy) < 0.05) continue;
            const dritto = -dy * giro > 0;
            const k0 = dritto ? k : j;
            const k1 = dritto ? j : k;
            pezzo.moveTo(a[k0 * 2], a[k0 * 2 + 1]);
            pezzo.lineTo(a[k1 * 2], a[k1 * 2 + 1]);
            pezzo.lineTo(a[k1 * 2] + s, a[k1 * 2 + 1]);
            pezzo.lineTo(a[k0 * 2] + s, a[k0 * 2 + 1]);
            pezzo.closePath();
          }
        }
        this.pezziOmbre[t] = pezzo;
      }
      ctx.fill(pezzo);
    }
    ctx.globalAlpha = 1;
  }

  // --- edifici da lontano ------------------------------------------------------------

  private daLontano(
    ctx: CanvasRenderingContext2D,
    visibile: Rettangolo,
    z: number,
    piatto: boolean,
  ): void {
    const edifici = this.scena.edifici;
    for (let t = 0; t < this.tessereEdifici.length; t++) {
      const tessera = this.tessereEdifici[t];
      if (!siToccano(tessera, visibile)) continue;
      if (piatto) {
        let pezzo = this.pezziPiatti[t];
        if (!pezzo) {
          pezzo = new Path2D();
          // Qui le impronte sono a terra e le illustrazioni vengono disegnate sopra:
          // non serve togliere quelle coperte (e sotto un luogo non disegnato non resta un buco).
          for (const i of tessera.indici) tracciaAnello(pezzo, edifici[i].anello);
          this.pezziPiatti[t] = pezzo;
        }
        ctx.fillStyle = this.P.edificiLontani;
        ctx.fill(pezzo);
        continue;
      }
      let pezzo = this.pezziTetti[t];
      if (!pezzo) {
        pezzo = { tinte: new Map<number, Path2D>(), ombra: new Path2D() };
        for (const i of tessera.indici) {
          const e = edifici[i];
          if (this.coperto(e)) continue;
          let p = pezzo.tinte.get(this.iTetto[i]);
          if (!p) {
            p = new Path2D();
            pezzo.tinte.set(this.iTetto[i], p);
          }
          tracciaAnello(p, e.anello, e.alt);
          if (!e.facce || !e.facceInfo) continue;
          // Le falde in ombra: un velo scuro sopra la tinta di base. Da qui le falde stanno
          // dentro la sagoma dell'impronta alzata: non serve altro.
          let k = 0;
          for (let f = 0; f < e.facceInfo.length; f += 2) {
            const vertici = e.facceInfo[f];
            const classe = e.facceInfo[f + 1] & MASCHERA_CLASSE;
            if (classe === FALDA_OMBRA || classe === INTERNO) {
              tracciaFaccia(pezzo.ombra, e.facce, k, vertici);
            }
            k += vertici * 2;
          }
        }
        this.pezziTetti[t] = pezzo;
      }
      const contorno = z > 0.6;
      if (contorno) {
        ctx.strokeStyle = conAlfa(this.P.seppia, 0.5);
        ctx.lineWidth = 0.6 / z;
      }
      for (const [tinta, p] of pezzo.tinte) {
        ctx.fillStyle = this.tinteTetto[tinta];
        ctx.fill(p);
        if (contorno) ctx.stroke(p);
      }
      ctx.fillStyle = this.P.faldaVeloOmbra;
      ctx.fill(pezzo.ombra);
    }
  }

  // --- tutto ciò che sta in piedi, da vicino -----------------------------------------

  private inPiedi(
    ctx: CanvasRenderingContext2D,
    s: StatoDisegno,
    visibile: Rettangolo,
    z: number,
    inIso: () => void,
    inPixel: () => void,
  ): void {
    const el = this.scena.elementi;
    const trovati = el.griglia.interroga(visibile);
    const fine = z >= 2;
    // Quanto è presente ogni strato di dettaglio a questo zoom: vale per tutto il fotogramma.
    this.pLuce = presenza(z, DETTAGLI.luce);
    this.pSpigoli = presenza(z, DETTAGLI.spigoli);
    this.pCornici = presenza(z, DETTAGLI.cornici);
    this.pCoppi = presenza(z, DETTAGLI.coppi);
    this.pPieni = presenza(z, DETTAGLI.coppiPieni);
    this.pFitti = presenza(z, DETTAGLI.coppiFitti);
    this.pFinestre = presenza(z, DETTAGLI.finestre);
    this.pFasce = presenza(z, DETTAGLI.fasce) * (1 - presenza(z, DETTAGLI.fasceVia)) * ALFA_FASCE;
    this.pFacciata = presenza(z, DETTAGLI.facciata);
    this.pComignoli = presenza(z, DETTAGLI.comignoli);
    this.pAccese = this.P.finestra !== '' ? presenza(z, ZOOM_FINESTRE) : 0;
    this.finestreAccese = this.pAccese > 0;
    // I dettagli si preparano un poco prima che si vedano, così compaiono già pronti.
    this.serveFacciata = z >= Math.min(DETTAGLI.fasce.da, ZOOM_FINESTRE.da) - 0.15;
    this.serveTettoFine = z >= DETTAGLI.coppi.da - 0.25;
    this.incompleto = false;
    // Il terzo tono delle falde entra mescolando i colori, senza trasparenze: costa meno.
    const quanto = Math.round(this.pLuce * 16);
    if (quanto !== this.quantoLuce) {
      this.quantoLuce = quanto;
      this.tinteLuceOra =
        quanto >= 16
          ? this.tinteTettoLuce
          : this.tinteTetto.map((c, k) => mescolaColori(c, this.tinteTettoLuce[k], quanto / 16));
    }
    // Forme nuove: finché c'è tempo in questo fotogramma. Il resto al prossimo.
    this.numeroFotogramma++;
    this.usatiPrima = this.usati;
    this.usati = 0;
    this.dipintiPrima = this.dipinti;
    this.dipinti = 0;
    this.preparati = 0;
    this.tempoFinito = false;
    this.scadenza = this.orologio() + this.bilancio.millisecondi;
    if (
      (this.dettagliPronti > this.bilancio.inMemoria && this.dettagliPronti > this.usatiPrima * 1.5) ||
      (this.volumiPronti > VOLUMI_IN_MEMORIA && this.volumiPronti > this.dipintiPrima * 1.5)
    ) {
      this.dimenticaFuoriVista();
    }
    // Da vicino il tratto è pieno; a metà strada resta più leggero, perché i volumi sono piccoli.
    // La china: più scura della seppia e un poco più grossa avvicinandosi, come un pennino.
    // Spessore e peso crescono piano con lo zoom, senza scatti: a metà strada, dove gli isolati
    // sono fitti, un tratto pieno farebbe una ragnatela scura.
    const vicino = presenza(z, { da: 1.8, a: 5 });
    this.spessoreTratto = (0.6 + 0.45 * vicino) / z;
    this.tratto = conAlfa(this.P.china, 0.5 + 0.36 * vicino);
    this.spessoreCoppi = Math.max(0.1, 0.55 / z);
    ctx.lineWidth = this.spessoreTratto;
    ctx.strokeStyle = this.tratto;
    // Tratti sottili e tantissimi: capi e giunti semplici costano molto meno di quelli tondi,
    // e a questo spessore non si distinguono.
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'bevel';
    // Carrozze e figurine entrano nell'ordine di profondità insieme a case e alberi: una si
    // dipinge prima del primo elemento più vicino di lei.
    this.pFigurine = presenza(z, FIGURINE);
    const mobili = this.mobiliInVista(s, visibile);
    let v = 0;
    for (let j = 0; j < trovati.length; j++) {
      const i = trovati[j];
      while (v < mobili.length && mobili[v].chiave > el.chiave[i]) mobili[v++].disegna(ctx);
      const tipo = el.tipo[i];
      if (tipo === EL_EDIFICIO) {
        this.edificio(ctx, el.rif[i]);
      } else if (tipo === EL_ALBERO) {
        this.albero(ctx, el.rif[i], fine);
      } else if (tipo === EL_LAMPIONE) {
        this.lampione(ctx, el.rif[i], z);
      } else {
        const indice = el.rif[i];
        const ill = this.illustrazioni.elenco[indice];
        if (!ill.pronta) continue;
        const sp = rettangoloSprite(
          this.scena.landmark[indice],
          indice,
          ill.proporzione,
          s.camera,
          s.vista,
        );
        inPixel();
        this.illustrazione(ctx, sp, s.densita);
        inIso();
        if (this.scena.landmark[indice].dati.id === 'ponte-vecchio') this.passantiPonte(ctx, s, this.scena.landmark[indice]);
        ctx.lineWidth = this.spessoreTratto;
        ctx.strokeStyle = this.tratto;
      }
    }
    while (v < mobili.length) mobili[v++].disegna(ctx);
  }

  /** Treno e figurine delle piazze in vista, dal più lontano al più vicino. */
  private mobiliInVista(s: StatoDisegno, visibile: Rettangolo): { chiave: number; disegna: (ctx: CanvasRenderingContext2D) => void }[] {
    const mobili: { chiave: number; disegna: (ctx: CanvasRenderingContext2D) => void }[] = this.vagoniInVista(s, visibile).map(
      (w) => ({ chiave: w.chiave, disegna: (ctx: CanvasRenderingContext2D) => this.vagone(ctx, w) }),
    );
    this.macchineInVista(s, visibile, mobili);
    this.fontaneInVista(s, visibile, mobili);
    if (this.pFigurine > 0) {
      const tempo = s.tempo ?? 0;
      let qualcuna = false;
      for (const p of this.scena.passeggiate) {
        const q = passoDi(p, tempo);
        const iso = metriInIso(q.x, q.y);
        if (iso.sx < visibile.minX - 2 || iso.sx > visibile.maxX + 2 || iso.sy < visibile.minY - 4 || iso.sy > visibile.maxY + 2) continue;
        qualcuna = true;
        const colore = p.colore;
        const passo = q.cammina ? tempo / 1000 + p.fase : 0;
        mobili.push({ chiave: q.x + q.y, disegna: (ctx) => this.figurina(ctx, q.x, q.y, 0, colore, passo, q.cammina) });
      }
      if (qualcuna && s.tempo !== undefined) this.inMovimentoLento();
    }
    return mobili.sort((a, b) => b.chiave - a.chiave);
  }

  /**
   * Le macchine in vista, aggiunte ai mobili: scatole basse lungo la destra della strada. Da
   * lontano non ci sono; compaiono sfumando come le figurine.
   */
  private macchineInVista(s: StatoDisegno, visibile: Rettangolo, mobili: { chiave: number; disegna: (ctx: CanvasRenderingContext2D) => void }[]): void {
    const presente = presenzaMobili(s);
    if (presente <= 0 || this.scena.macchine.length === 0) return;
    const tempo = s.tempo ?? 0;
    const M = this.P.macchine;
    let qualcuna = false;
    for (const m of this.scena.macchine) {
      const c = this.scena.corsie[m.corsia];
      const q = macchinaDi(m, c, tempo);
      if (!q) continue;
      const tinta = M.tinte[m.colore % M.tinte.length];
      const chiaveColori = tinta + M.vetri;
      let colori = this.coloriMacchine.get(chiaveColori);
      if (!colori) {
        colori = { luce: tinta, ombra: mescolaColori(tinta, '#1e1a18', 0.3), tetto: mescolaColori(tinta, '#ffffff', 0.22), finestrini: M.vetri };
        this.coloriMacchine.set(chiaveColori, colori);
      }
      const v = scatola(q.coda, q.testa, MEZZA_LARGHEZZA_MACCHINA, ALTEZZA_MACCHINA, colori, FASCIA_MACCHINA);
      if (!siToccano(v.riquadro, visibile)) continue;
      qualcuna = true;
      mobili.push({
        chiave: v.chiave,
        disegna: (ctx) => {
          ctx.globalAlpha = presente;
          this.vagone(ctx, v);
          ctx.globalAlpha = 1;
        },
      });
    }
    if (s.tempo === undefined) return;
    if (qualcuna) this.inMovimentoLento();
    // Nessuna in vista adesso: se una strada con le macchine è vicina, ne arriverà qualcuna e si
    // ricontrolla ogni secondo; lontano dalle strade no.
    else if (this.corsieVicine(visibile)) this.prossimoMovimento = Math.min(this.prossimoMovimento, CONTROLLO_TRENO_MS);
  }

  /** true se qualche strada con le macchine tocca la vista, allargata di quanto si fa in un secondo. */
  private corsieVicine(visibile: Rettangolo): boolean {
    if (!this.riquadriCorsie) {
      this.riquadriCorsie = this.scena.corsie.map((c) => {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < c.punti.length; i += 2) {
          const q = metriInIso(c.punti[i], c.punti[i + 1]);
          minX = Math.min(minX, q.sx);
          maxX = Math.max(maxX, q.sx);
          minY = Math.min(minY, q.sy);
          maxY = Math.max(maxY, q.sy);
        }
        return { minX: minX - 20, minY: minY - 20, maxX: maxX + 20, maxY: maxY + 20 };
      });
    }
    return this.riquadriCorsie.some((r) => siToccano(r, visibile));
  }

  /** Le fontane in vista e chi ci sta attorno, aggiunti ai mobili. */
  private fontaneInVista(s: StatoDisegno, visibile: Rettangolo, mobili: { chiave: number; disegna: (ctx: CanvasRenderingContext2D) => void }[]): void {
    if (this.scena.fontane.length === 0) return;
    const presente = presenzaMobili(s);
    if (presente <= 0) return;
    const tempo = s.tempo ?? 0;
    let qualcuna = false;
    this.scena.fontane.forEach((f, n) => {
      const c = metriInIso(f.x, f.y);
      if (c.sx + f.raggio < visibile.minX || c.sx - f.raggio > visibile.maxX || c.sy - 8 > visibile.maxY || c.sy + f.raggio < visibile.minY) return;
      qualcuna = true;
      mobili.push({ chiave: f.x + f.y - f.raggio * 0.5, disegna: (ctx) => this.fontana(ctx, f, tempo, presente) });
      if (this.pFigurine <= 0) return;
      for (const p of this.scena.allaFontana) {
        if (p.fontana !== n) continue;
        const q = allaFontanaDi(p, f, tempo);
        const colore = p.colore;
        mobili.push({ chiave: q.x + q.y, disegna: (ctx) => this.figurina(ctx, q.x, q.y, 0, colore, tempo / 1000 + p.angolo * 10, q.cammina) });
      }
    });
    if (qualcuna && s.tempo !== undefined) this.inMovimentoLento();
  }

  /**
   * Una fontana a più vasche su una gradinata rotonda: due gradini, la vasca grande con l'acqua,
   * una colonna con la vasca piccola e gli zampilli che ricadono. Un cerchio in metri sul piano
   * diventa un'ellisse larga r e alta r / 2.
   */
  private fontana(ctx: CanvasRenderingContext2D, f: Fontana, tempo: number, alfa: number): void {
    const F = this.P.fontana;
    ctx.globalAlpha = alfa;
    const cilindro = (r: number, z0: number, z1: number, lato: string, sopra: string): void => {
      const a = metriInIso(f.x, f.y, z0);
      const b = metriInIso(f.x, f.y, z1);
      ctx.fillStyle = lato;
      ctx.beginPath();
      ctx.ellipse(a.sx, a.sy, r, r / 2, 0, 0, Math.PI);
      ctx.lineTo(b.sx - r, b.sy);
      ctx.ellipse(b.sx, b.sy, r, r / 2, 0, Math.PI, 0, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = sopra;
      ctx.beginPath();
      ctx.ellipse(b.sx, b.sy, r, r / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    // Gli zampilli: dalla cima ricadono nella vasca piccola, dal bordo della vasca piccola nella
    // grande. Tratti spezzati che scorrono verso il basso, così l'acqua si vede cadere. Quelli
    // dietro (verso nord-est) si dipingono prima di colonna e vasca piccola, quelli davanti dopo.
    const zampilli = (dietro: boolean): void => {
      const cima = metriInIso(f.x, f.y, 4.7);
      const bordo = metriInIso(f.x, f.y, 3.6);
      const fondo = metriInIso(f.x, f.y, 1.35);
      ctx.strokeStyle = F.zampilli;
      ctx.lineCap = 'round';
      ctx.lineWidth = 0.22;
      ctx.setLineDash([0.5, 0.45]);
      // In modulo, prima di passarlo al browser: un numero enorme perderebbe i decimali e il
      // tratteggio resterebbe fermo.
      ctx.lineDashOffset = -(((tempo / 1000) * 2.2) % 0.95);
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        if (Math.sin(a) < 0 !== dietro) continue;
        const cx = Math.cos(a);
        const cy = Math.sin(a) / 2;
        ctx.moveTo(cima.sx, cima.sy);
        ctx.quadraticCurveTo(cima.sx + cx * 1.4, cima.sy - 1.2 + cy * 1.4, bordo.sx + cx * 1.5, bordo.sy + cy * 1.5);
        ctx.moveTo(bordo.sx + cx * 1.85, bordo.sy + cy * 1.85);
        ctx.quadraticCurveTo(bordo.sx + cx * 2.9, bordo.sy + cy * 2.9 - 0.4, fondo.sx + cx * 3.1, fondo.sy + cy * 3.1);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.lineCap = 'butt';
      ctx.lineWidth = this.spessoreTratto;
      ctx.strokeStyle = this.tratto;
    };
    const R = f.raggio;
    cilindro(R, 0, 0.35, F.ombra, F.pietra);
    cilindro(R * 0.86, 0.35, 0.7, F.ombra, F.pietra);
    cilindro(R * 0.7, 0.7, 1.45, F.ombra, F.pietra);
    // L'acqua della vasca grande, un poco sotto il bordo.
    const acqua = metriInIso(f.x, f.y, 1.35);
    ctx.fillStyle = F.acqua;
    ctx.beginPath();
    ctx.ellipse(acqua.sx, acqua.sy, R * 0.62, R * 0.31, 0, 0, Math.PI * 2);
    ctx.fill();
    zampilli(true);
    cilindro(0.55, 1.35, 3.3, F.ombra, F.pietra);
    cilindro(1.9, 3.3, 3.65, F.ombra, F.pietra);
    const alta = metriInIso(f.x, f.y, 3.6);
    ctx.fillStyle = F.acqua;
    ctx.beginPath();
    ctx.ellipse(alta.sx, alta.sy, 1.6, 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    cilindro(0.25, 3.6, 4.6, F.ombra, F.pietra);
    zampilli(false);
    ctx.globalAlpha = 1;
    ctx.lineWidth = this.spessoreTratto;
    ctx.strokeStyle = this.tratto;
  }

  /** Qualcosa si muove piano (acqua, figurine): bastano dieci fotogrammi al secondo. */
  private inMovimentoLento(): void {
    this.animato = true;
    this.intervalloAnimazione = Math.min(this.intervalloAnimazione, INTERVALLO_ACQUA_MS);
  }

  /**
   * Una figurina in piedi in (x, y, z), metri locali: ombra, gambe che si alternano, vestito,
   * testa. `passo` fa muovere le gambe; ferma, le gambe restano unite.
   */
  private figurina(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, colore: number, passo: number, cammina: boolean): void {
    const G = this.P.gente;
    const piede = metriInIso(x, y, z);
    const h = ALTEZZA_FIGURINA * ISO_Z;
    const alfa = this.pFigurine;
    ctx.globalAlpha = alfa;
    if (z === 0) {
      ctx.fillStyle = this.P.ombra;
      ctx.beginPath();
      ctx.ellipse(piede.sx + 0.4, piede.sy, 0.9, 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const falcata = cammina ? Math.sin(passo * Math.PI * 3.6) * 0.28 : 0;
    const anca = piede.sy - h * 0.47;
    ctx.strokeStyle = G.gambe;
    ctx.lineWidth = 0.26;
    ctx.beginPath();
    ctx.moveTo(piede.sx - 0.15, anca);
    ctx.lineTo(piede.sx - 0.15 + falcata, piede.sy);
    ctx.moveTo(piede.sx + 0.15, anca);
    ctx.lineTo(piede.sx + 0.15 - falcata, piede.sy);
    ctx.stroke();
    ctx.fillStyle = G.vesti[colore % G.vesti.length];
    ctx.beginPath();
    ctx.rect(piede.sx - 0.34, piede.sy - h * 0.8, 0.68, h * 0.36);
    ctx.fill();
    ctx.fillStyle = G.pelle;
    ctx.beginPath();
    ctx.arc(piede.sx, piede.sy - h * 0.88, h * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = G.capelli;
    ctx.beginPath();
    ctx.arc(piede.sx, piede.sy - h * 0.9, h * 0.08, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = this.spessoreTratto;
    ctx.strokeStyle = this.tratto;
  }

  /**
   * Chi attraversa il Ponte Vecchio: si dipinge subito dopo l'illustrazione, ritagliato sulle
   * aperture tra le colonne della facciata sud, così sembra camminare dentro il ponte coperto.
   */
  private passantiPonte(ctx: CanvasRenderingContext2D, s: StatoDisegno, ponte: LandmarkPronto): void {
    if (this.pFigurine <= 0) return;
    const tempo = s.tempo ?? 0;
    const col = colonnePonte();
    const H = PONTE.mezzaLarghezza;
    const angolo = (sPonte: number, tPonte: number, zz: number): { sx: number; sy: number } => {
      const m = suPonte(ponte, sPonte, tPonte);
      return metriInIso(m.x, m.y, zz);
    };
    ctx.save();
    ctx.beginPath();
    for (let c = 0; c + 1 < col.length; c++) {
      const a = col[c] + 0.23;
      const b = col[c + 1] - 0.23;
      const p0 = angolo(a, H, PONTE.vuoto.da);
      const p1 = angolo(b, H, PONTE.vuoto.da);
      const p2 = angolo(b, H, PONTE.vuoto.a);
      const p3 = angolo(a, H, PONTE.vuoto.a);
      ctx.moveTo(p0.sx, p0.sy);
      ctx.lineTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.lineTo(p3.sx, p3.sy);
      ctx.closePath();
    }
    ctx.clip();
    // Da nord a sud: chi sta più a nord è più lontano e va dipinto prima.
    for (const p of [...PASSANTI_PONTE].sort((u, w) => u.t - w.t)) {
      const q = passanteSulPonte(p, tempo);
      const m = suPonte(ponte, q.s, p.t);
      this.figurina(ctx, m.x, m.y, PONTE.piano, p.colore, tempo / 1000 + p.fase, true);
    }
    ctx.restore();
    if (s.tempo !== undefined) this.inMovimentoLento();
  }

  // --- treno decorativo ------------------------------------------------------------

  /**
   * Le carrozze del treno decorativo che toccano la vista, dalla più lontana alla più vicina.
   * Dice anche se c'è movimento (`animato`) o quando ricontrollare (`prossimoMovimento`).
   */
  private vagoniInVista(s: StatoDisegno, visibile: Rettangolo): Vagone[] {
    const elenco = this.scena.treni;
    if (elenco.length === 0) return [];
    const animabile = s.tempo !== undefined;
    // A mappa ferma ogni treno sta dove sarebbe nell'istante di posa del primo.
    const fermo = istanteFermo(elenco[0].percorso);
    const vagoni: Vagone[] = [];
    // Un treno che corre fuori vista si ricontrolla ogni secondo; se in quel secondo può entrare
    // nella vista, si guarda a ritmo pieno, così non compare già dentro il bordo.
    const r = (VELOCITA_TRENO * CONTROLLO_TRENO_MS) / 1000 + MEZZA_LARGHEZZA_VAGONE * 2;
    const vicino = { minX: visibile.minX - r, minY: visibile.minY - r, maxX: visibile.maxX + r, maxY: visibile.maxY + r };
    for (const treno of elenco) {
      const m = momentoTreno(treno.percorso, (s.tempo ?? fermo) + treno.fase, treno.ciclo);
      const colori = this.P.treni[treno.livrea % this.P.treni.length];
      let inVista = 0;
      let inArrivo = false;
      for (const c of carrozze(treno.percorso, m)) {
        const v = scatola(c.coda, c.testa, MEZZA_LARGHEZZA_VAGONE, ALTEZZA_VAGONE, colori, FASCIA_VAGONE);
        if (!siToccano(v.riquadro, visibile)) {
          if (siToccano(v.riquadro, vicino)) inArrivo = true;
          continue;
        }
        vagoni.push(v);
        inVista++;
      }
      if (!animabile) continue;
      if (inVista > 0 && !m.fermo) {
        this.animato = true;
        this.intervalloAnimazione = Math.min(this.intervalloAnimazione, INTERVALLO_TRENO_MS);
      } else if (m.fermo) this.prossimoMovimento = Math.min(this.prossimoMovimento, m.prossimoCambio);
      // In corsa ma fuori vista: si ricontrolla ogni tanto, con un fotogramma solo.
      else this.prossimoMovimento = Math.min(this.prossimoMovimento, inArrivo ? INTERVALLO_TRENO_MS : CONTROLLO_TRENO_MS);
    }
    return vagoni;
  }

  /** Una scatola (carrozza o macchina): le pareti che guardano verso chi osserva, una fascia di finestrini, il tetto. */
  private vagone(ctx: CanvasRenderingContext2D, v: Vagone): void {
    const T = v.colori;
    const b = v.base;
    const cx = (b[0] + b[2] + b[4] + b[6]) / 4;
    const cy = (b[1] + b[3] + b[5] + b[7]) / 4;
    const punto = (x: number, y: number, z: number): void => {
      const q = metriInIso(x, y, z);
      ctx.lineTo(q.sx, q.sy);
    };
    for (let k = 0; k < 4; k++) {
      const ax = b[k * 2];
      const ay = b[k * 2 + 1];
      const bx = b[((k + 1) % 4) * 2];
      const by = b[((k + 1) % 4) * 2 + 1];
      // Normale verso l'esterno della parete.
      let nx = by - ay;
      let ny = -(bx - ax);
      if (nx * ((ax + bx) / 2 - cx) + ny * ((ay + by) / 2 - cy) < 0) {
        nx = -nx;
        ny = -ny;
      }
      // Si vedono solo le pareti rivolte verso chi guarda (x + y che cala).
      if (nx + ny >= 0) continue;
      ctx.beginPath();
      const inizio = metriInIso(ax, ay);
      ctx.moveTo(inizio.sx, inizio.sy);
      punto(bx, by, 0);
      punto(bx, by, v.altezza);
      punto(ax, ay, v.altezza);
      ctx.closePath();
      // Come per le case: la parete che guarda più a ovest prende la luce, quella a sud l'ombra.
      ctx.fillStyle = nx < ny ? T.luce : T.ombra;
      ctx.fill();
      ctx.stroke();
      const lato = Math.hypot(bx - ax, by - ay);
      if (lato > v.fascia.capi * 2 + 1) {
        // La fascia dei finestrini, un metro e mezzo più corta della parete a ogni capo.
        const t0 = v.fascia.capi / lato;
        const t1 = 1 - t0;
        const x0 = ax + (bx - ax) * t0;
        const y0 = ay + (by - ay) * t0;
        const x1 = ax + (bx - ax) * t1;
        const y1 = ay + (by - ay) * t1;
        ctx.beginPath();
        const f = metriInIso(x0, y0, v.fascia.da);
        ctx.moveTo(f.sx, f.sy);
        punto(x1, y1, v.fascia.da);
        punto(x1, y1, v.fascia.a);
        punto(x0, y0, v.fascia.a);
        ctx.closePath();
        ctx.fillStyle = T.finestrini;
        ctx.fill();
      }
    }
    ctx.beginPath();
    const t = metriInIso(b[0], b[1], v.altezza);
    ctx.moveTo(t.sx, t.sy);
    for (let k = 2; k < 8; k += 2) punto(b[k], b[k + 1], v.altezza);
    ctx.closePath();
    ctx.fillStyle = T.tetto;
    ctx.fill();
    ctx.stroke();
  }

  /** true se in questo fotogramma c'è ancora tempo per preparare una forma nuova. */
  private puoPreparare(): boolean {
    if (this.preparati >= this.bilancio.minimo) {
      if (this.tempoFinito) return false;
      // L'orologio si guarda ogni otto forme: leggerlo ha un costo.
      if ((this.preparati & 7) === 0 && this.orologio() > this.scadenza) {
        this.tempoFinito = true;
        return false;
      }
    }
    this.preparati++;
    return true;
  }

  /**
   * Libera le forme (volumi, facciate e tetti fini) degli edifici che non sono stati dipinti
   * nell'ultimo fotogramma. Quelli in vista restano: la mappa non perde nulla mentre la si guarda.
   */
  private dimenticaFuoriVista(): void {
    const recente = this.numeroFotogramma - 1;
    const uso = this.ultimoUso;
    let restano = 0;
    let volumi = 0;
    for (let i = 0; i < uso.length; i++) {
      if (uso[i] < 0) continue;
      if (uso[i] >= recente) {
        if (this.facciate[i]) restano++;
        if (this.tettiFini[i]) restano++;
        if (this.volumi[i]) volumi++;
        continue;
      }
      uso[i] = -1;
      this.volumi[i] = undefined;
      this.facciate[i] = undefined;
      this.tettiFini[i] = undefined;
    }
    this.dettagliPronti = restano;
    this.volumiPronti = volumi;
  }

  /** Quanti dettagli di edifici sono in memoria in questo momento (per le prove). */
  get dettagliInMemoria(): number {
    return this.dettagliPronti;
  }

  /** Quanti volumi di edifici sono in memoria in questo momento (per le prove). */
  get volumiInMemoria(): number {
    return this.volumiPronti;
  }

  /**
   * Un edificio da vicino: muri, dettagli della facciata, tetto, dettagli del tetto. Le forme
   * sono preparate una volta e riusate; qui si scelgono solo i colori e quanto si vede di
   * ogni strato. Stesso edificio, stesso aspetto: tutto dipende dal suo seme.
   */
  private edificio(ctx: CanvasRenderingContext2D, indice: number): void {
    const e = this.scena.edifici[indice];
    if (this.coperto(e)) return;
    const P = this.P;
    const tinta = this.iTetto[indice];
    let v = this.volumi[indice];
    if (!v) {
      if (!this.puoPreparare()) {
        // Non c'è tempo per le sue forme: per ora il volume semplice, muri piatti e tetto piano
        // alla gronda. Niente forme da tenere: si traccia direttamente.
        this.incompleto = true;
        const a = e.anello;
        const n = a.length >> 1;
        const piatto = this.tinteMuro[this.iMuro[indice]];
        if (e.alt > 0.2) {
          for (let lato = MURO_SINISTRO; lato <= MURO_DESTRO; lato++) {
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
              if (e.lati[i] !== lato) continue;
              const j = (i + 1) % n;
              ctx.moveTo(a[i * 2], a[i * 2 + 1]);
              ctx.lineTo(a[j * 2], a[j * 2 + 1]);
              ctx.lineTo(a[j * 2], a[j * 2 + 1] - e.alt);
              ctx.lineTo(a[i * 2], a[i * 2 + 1] - e.alt);
              ctx.closePath();
            }
            ctx.fillStyle = lato === MURO_SINISTRO ? piatto.chiaro : piatto.scuro;
            ctx.fill();
          }
        }
        ctx.beginPath();
        tracciaAnello(ctx, a, e.alt);
        ctx.fillStyle = this.tinteTetto[tinta];
        ctx.fill();
        ctx.stroke();
        return;
      }
      v = this.preparaVolume(indice);
      this.volumiPronti++;
    }
    this.dipinti++;
    this.ultimoUso[indice] = this.numeroFotogramma;
    const muro = this.tinteMuro[this.iMuro[indice]];
    const muri = v.muri;
    for (let k = 0; k < muri.length; k++) {
      ctx.fillStyle = v.latoMuri[k] === MURO_SINISTRO ? muro.chiaro : muro.scuro;
      ctx.fill(muri[k]);
      if (v.muriATratti) ctx.stroke(muri[k]);
    }
    if (v.lineeMuri) ctx.stroke(v.lineeMuri);

    if (this.serveFacciata && muri.length > 0) {
      let f = this.facciate[indice];
      if (!f) {
        if (this.puoPreparare()) {
          this.dettagliPronti++;
          f = this.facciate[indice] = this.preparaFacciata(e, this.lontano[indice]);
        } else {
          this.incompleto = true;
        }
      }
      if (f) this.usati++;
      if (f && f !== SENZA_FACCIATA) {
        const pF = this.pFinestre;
        const pD = this.pFacciata;
        if (this.pFasce > 0 && f.fasce) {
          ctx.globalAlpha = this.pFasce * this.pesoFasce[this.iMuro[indice]];
          ctx.fillStyle = P.vetro;
          ctx.fill(f.fasce);
        }
        if (pD > 0 && f.ombre) {
          ctx.globalAlpha = pD;
          ctx.fillStyle = P.facciataOmbra;
          ctx.fill(f.ombre);
        }
        if (pF > 0) {
          ctx.globalAlpha = pF;
          if (f.archi) {
            ctx.fillStyle = P.portico;
            ctx.fill(f.archi);
          }
          if (this.pCornici > 0 && f.cornici) {
            ctx.globalAlpha = this.pCornici;
            ctx.fillStyle = P.cornice;
            ctx.fill(f.cornici);
            ctx.globalAlpha = pF;
          }
          if (f.vetri) {
            ctx.fillStyle = P.vetro;
            ctx.fill(f.vetri);
          }
          if (this.pFitti > 0 && f.telai) {
            ctx.globalAlpha = this.pFitti;
            ctx.fillStyle = P.telaio;
            ctx.fill(f.telai);
            ctx.globalAlpha = pF;
          }
          if (f.porte) {
            ctx.fillStyle = P.porte[f.iPorta % P.porte.length];
            ctx.fill(f.porte);
          }
          if (pD > 0 && f.persiane) {
            ctx.globalAlpha = pD;
            ctx.fillStyle = P.persiane[f.iPersiana % P.persiane.length];
            ctx.fill(f.persiane);
          }
        }
        ctx.globalAlpha = 1;
        if (this.finestreAccese && f.accese) {
          ctx.globalAlpha = this.pAccese;
          ctx.fillStyle = P.finestra;
          ctx.fill(f.accese);
          ctx.globalAlpha = 1;
        }
      }
    }

    ctx.fillStyle = this.tinteTetto[tinta];
    ctx.fill(v.fondo);
    if (v.luce && this.pLuce > 0) {
      ctx.fillStyle = this.tinteLuceOra[tinta];
      ctx.fill(v.luce);
    }
    if (v.ombra) {
      ctx.fillStyle = this.tinteTettoOmbra[tinta];
      ctx.fill(v.ombra);
    }


    let t: TettoFine | undefined;
    if (this.serveTettoFine) {
      t = this.tettiFini[indice];
      if (!t) {
        if (this.puoPreparare()) {
          this.dettagliPronti++;
          t = this.tettiFini[indice] = this.preparaTettoFine(e, this.lontano[indice]);
        } else {
          this.incompleto = true;
        }
      }
      if (t) this.usati++;
      if (t && t.coppi && this.pCoppi > 0) {
        ctx.strokeStyle = P.coppi;
        ctx.lineWidth = this.spessoreCoppi;
        ctx.globalAlpha = this.pCoppi;
        ctx.stroke(t.coppi);
        if (t.pieni && this.pPieni > 0) {
          ctx.globalAlpha = this.pPieni;
          ctx.stroke(t.pieni);
        }
        if (t.fitti && this.pFitti > 0) {
          ctx.globalAlpha = this.pFitti;
          ctx.stroke(t.fitti);
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = this.tratto;
        ctx.lineWidth = this.spessoreTratto;
      }
    }

    if (v.timpano) {
      ctx.fillStyle = v.latoTimpano === TIMPANO_SINISTRO ? muro.chiaro : muro.scuro;
      ctx.fill(v.timpano);
    }
    // Tutti i tratti a penna in un colpo solo.
    if (this.pSpigoli >= 1) {
      ctx.stroke(v.lineePiene);
    } else {
      if (v.spigoli && this.pSpigoli > 0) {
        ctx.globalAlpha = this.pSpigoli;
        ctx.stroke(v.spigoli);
        ctx.globalAlpha = 1;
      }
      ctx.stroke(v.linee);
    }

    if (t && t.camSopra && this.pComignoli > 0) {
      ctx.globalAlpha = this.pComignoli;
      if (t.camSx) {
        ctx.fillStyle = muro.chiaro;
        ctx.fill(t.camSx);
      }
      if (t.camDx) {
        ctx.fillStyle = muro.scuro;
        ctx.fill(t.camDx);
      }
      if (t.camVetri) {
        // Di notte metà degli abbaini ha la luce accesa: lo decide il seme.
        ctx.fillStyle = this.finestreAccese && (e.seme & 1) === 0 ? P.finestra : P.vetro;
        ctx.fill(t.camVetri);
      }
      ctx.fillStyle = this.tinteTettoOmbra[tinta];
      ctx.fill(t.camSopra);
      if (t.camBordo) ctx.stroke(t.camBordo);
      ctx.globalAlpha = 1;
    }
  }

  /**
   * true se due muri in vista di un'impronta con rientranze si sovrappongono sullo schermo:
   * allora vanno dipinti uno alla volta, dal più lontano. Se no l'ordine non conta.
   */
  private muriSiCoprono(e: EdificioPronto): boolean {
    const a = e.anello;
    const o = e.ordineMuri;
    if (!o) return false;
    const n = a.length >> 1;
    for (let p = 0; p < o.length; p++) {
      const i = o[p];
      const i2 = (i + 1) % n;
      const x0 = a[i * 2];
      const x1 = a[i2 * 2];
      if (x1 - x0 < 1e-3) continue;
      const pend = (a[i2 * 2 + 1] - a[i * 2 + 1]) / (x1 - x0);
      for (let q = p + 1; q < o.length; q++) {
        const m = o[q];
        const m2 = (m + 1) % n;
        const largo = a[m2 * 2] - a[m * 2];
        const c0 = Math.max(x0, a[m * 2]);
        const c1 = Math.min(x1, a[m2 * 2]);
        if (c1 - c0 < 0.05 || largo < 1e-3) continue;
        // Distanza in verticale tra i piedi dei due muri ai capi del tratto comune.
        const pendM = (a[m2 * 2 + 1] - a[m * 2 + 1]) / largo;
        const d0 = a[i * 2 + 1] + pend * (c0 - x0) - (a[m * 2 + 1] + pendM * (c0 - a[m * 2]));
        const d1 = a[i * 2 + 1] + pend * (c1 - x0) - (a[m * 2 + 1] + pendM * (c1 - a[m * 2]));
        if (d0 * d1 > 0 && Math.min(Math.abs(d0), Math.abs(d1)) >= e.alt - 0.02) continue;
        return true;
      }
    }
    return false;
  }

  /**
   * true se il lato `i` e quello prima sono in vista dalla stessa parte e quasi allineati in
   * pianta (meno di 18 gradi): insieme fanno una facciata sola.
   */
  private allineati(e: EdificioPronto, i: number): boolean {
    const a = e.anello;
    const n = a.length >> 1;
    const h = (i + n - 1) % n;
    if (e.lati[i] === MURO_DIETRO || e.lati[h] !== e.lati[i]) return false;
    const j = (i + 1) % n;
    const du0 = (a[i * 2] - a[h * 2]) / ISO_X;
    const dv0 = (a[i * 2 + 1] - a[h * 2 + 1]) / ISO_Y;
    const du1 = (a[j * 2] - a[i * 2]) / ISO_X;
    const dv1 = (a[j * 2 + 1] - a[i * 2 + 1]) / ISO_Y;
    // In pianta il lato è (du - dv, -(du + dv)) / 2: il prodotto scalare si riduce a questo.
    const scalare = du0 * du1 + dv0 * dv1;
    return scalare >= 0.95 * Math.sqrt((du0 * du0 + dv0 * dv0) * (du1 * du1 + dv1 * dv1));
  }

  /** Muri e tetto di un edificio come forme pronte da riempire. */
  private preparaVolume(indice: number): Volume {
    const e = this.scena.edifici[indice];
    const a = e.anello;
    const n = a.length >> 1;
    const h = e.alt;
    const muri: Path2D[] = [];
    const latoMuri: number[] = [];
    const linee = new Path2D();
    const lineePiene = new Path2D();
    let lineeMuri: Path2D | null = null;
    let muriATratti = false;
    const quadro = (p: Path2D, i: number): void => {
      const j = (i + 1) % n;
      p.moveTo(a[i * 2], a[i * 2 + 1]);
      p.lineTo(a[j * 2], a[j * 2 + 1]);
      p.lineTo(a[j * 2], a[j * 2 + 1] - h);
      p.lineTo(a[i * 2], a[i * 2 + 1] - h);
      p.closePath();
    };
    // Il contorno di un muro senza il lato di gronda, che è già nel contorno del tetto.
    // Dove due lati sono quasi allineati (un muro curvo, o spezzato in più tratti) lo spigolo
    // in verticale non si traccia: tanti spigoli vicini rigano la facciata.
    const piedi = (p: Path2D, i: number): void => {
      const j = (i + 1) % n;
      if (this.allineati(e, i)) p.moveTo(a[i * 2], a[i * 2 + 1]);
      else {
        p.moveTo(a[i * 2], a[i * 2 + 1] - h);
        p.lineTo(a[i * 2], a[i * 2 + 1]);
      }
      p.lineTo(a[j * 2], a[j * 2 + 1]);
      if (!this.allineati(e, j)) p.lineTo(a[j * 2], a[j * 2 + 1] - h);
    };
    if (h > 0.2) {
      if (e.ordineMuri && this.muriSiCoprono(e)) {
        // Impronta con rientranze i cui muri si coprono: un muro alla volta, dal più lontano.
        muriATratti = true;
        let corrente: Path2D | null = null;
        let latoCorrente = -1;
        for (let k = 0; k < e.ordineMuri.length; k++) {
          const i = e.ordineMuri[k];
          const lato = e.lati[i];
          if (lato === MURO_DIETRO) continue;
          if (!corrente || lato !== latoCorrente) {
            corrente = new Path2D();
            latoCorrente = lato;
            muri.push(corrente);
            latoMuri.push(lato);
          }
          quadro(corrente, i);
        }
      } else {
        // Nessun muro ne copre un altro: due riempimenti, uno per lato, e i contorni in un tratto.
        // Nelle impronte con rientranze il tetto può coprire il piede di un muro: lì i contorni
        // dei muri si tracciano prima del tetto, altrimenti insieme a tutto il resto.
        if (e.ordineMuri) lineeMuri = new Path2D();
        for (let lato = MURO_SINISTRO; lato <= MURO_DESTRO; lato++) {
          let gruppo: Path2D | null = null;
          for (let i = 0; i < n; i++) {
            if (e.lati[i] !== lato) continue;
            if (!gruppo) {
              gruppo = new Path2D();
              muri.push(gruppo);
              latoMuri.push(lato);
            }
            quadro(gruppo, i);
            if (lineeMuri) piedi(lineeMuri, i);
            else {
              piedi(linee, i);
              piedi(lineePiene, i);
            }
          }
        }
      }
    }

    // Sotto a tutto l'impronta alzata alla gronda: qualunque cosa facciano le falde, il tetto
    // non ha buchi. Le falde normali stanno tutte dentro questa sagoma; quelle che ne escono
    // (due falde con il timpano dietro, punte ripide delle torri) si aggiungono al fondo.
    const contorno = new Path2D();
    tracciaAnello(contorno, a, h);
    tracciaAnello(linee, a, h);
    tracciaAnello(lineePiene, a, h);
    let fondo = contorno;
    let spigoli: Path2D | null = null;
    let luce: Path2D | null = null;
    let ombra: Path2D | null = null;
    let timpano: Path2D | null = null;
    let latoTimpano = 0;
    if (e.facce && e.facceInfo) {
      const v = e.facce;
      let falde = 0;
      for (let f = 1; f < e.facceInfo.length; f += 2) {
        const classe = e.facceInfo[f] & MASCHERA_CLASSE;
        if (classe !== TIMPANO_SINISTRO && classe !== TIMPANO_DESTRO) falde++;
      }
      const sporge = e.forma === TETTO_FALDE && (falde <= 2 || e.tipo === 'torre');
      if (sporge) {
        fondo = new Path2D();
        tracciaAnello(fondo, a, h);
      }
      // Ogni spigolo sta su due falde: si ricorda quali sono già stati tracciati.
      const fatti = new Set<string>();
      const spigolo = (x0: number, y0: number, x1: number, y1: number): void => {
        const p = Math.round(x0 * 16) + ':' + Math.round(y0 * 16);
        const q = Math.round(x1 * 16) + ':' + Math.round(y1 * 16);
        if (p === q) return;
        const chiave = p < q ? p + '|' + q : q + '|' + p;
        if (fatti.has(chiave)) return;
        fatti.add(chiave);
        spigoli ??= new Path2D();
        spigoli.moveTo(x0, y0);
        spigoli.lineTo(x1, y1);
        lineePiene.moveTo(x0, y0);
        lineePiene.lineTo(x1, y1);
      };
      let k = 0;
      for (let f = 0; f < e.facceInfo.length; f += 2) {
        const vertici = e.facceInfo[f];
        const info = e.facceInfo[f + 1];
        const classe = info & MASCHERA_CLASSE;
        const gradone = (info & GRADONE) !== 0;
        if (classe === TIMPANO_SINISTRO || classe === TIMPANO_DESTRO) {
          timpano ??= new Path2D();
          latoTimpano = classe;
          tracciaFaccia(timpano, v, k, vertici);
          tracciaFaccia(linee, v, k, vertici);
          tracciaFaccia(lineePiene, v, k, vertici);
        } else {
          if (sporge) tracciaFaccia(fondo, v, k, vertici);
          // Una falda vera comincia dal lato di gronda; nelle metà di un colmo finto il primo
          // lato è il colmo, e va tracciato.
          const falda =
            (info & COLMO_FINTO) === 0 &&
            e.pendenze !== null &&
            (e.pendenze[f] !== 0 || e.pendenze[f + 1] !== 0);
          for (let r = 0; r < vertici; r++) {
            // Il lato di gronda lo fa già il contorno; il lato interno di un gradone non è uno spigolo.
            if (falda && (r === 0 || (gradone && r === 2))) continue;
            const r2 = (r + 1) % vertici;
            spigolo(v[k + r * 2], v[k + r * 2 + 1], v[k + r2 * 2], v[k + r2 * 2 + 1]);
          }
          // Il tono cambia anche da falda a falda, come in un tetto dipinto a mano: una falda
          // in luce su quattro resta a mezza tinta, una a mezza tinta su quattro prende la luce.
          // Lo decide il seme; costa zero, sono gli stessi riempimenti. Le falde in ombra non si
          // toccano: da lontano sono stese a tessere e cambierebbero di colpo.
          const sorte = mescola(e.seme, f, 977) % 100;
          const inLuce = classe === FALDA_LUCE ? sorte >= 24 : classe === FASCIA || (classe === FALDA_MEDIA && falda && sorte < 24);
          if (inLuce) {
            luce ??= new Path2D();
            tracciaFaccia(luce, v, k, vertici);
          } else if (classe === FALDA_OMBRA || classe === INTERNO) {
            ombra ??= new Path2D();
            tracciaFaccia(ombra, v, k, vertici);
          }
        }
        k += vertici * 2;
      }
    }
    const v: Volume = {
      muri,
      latoMuri,
      muriATratti,
      lineeMuri,
      fondo,
      linee,
      lineePiene,
      spigoli,
      luce,
      ombra,
      timpano,
      latoTimpano,
    };
    this.volumi[indice] = v;
    return v;
  }

  /**
   * La facciata di un edificio: finestre allineate per piano, persiane, porta, portico, zoccolo.
   * Tutto in metri veri lungo il muro e in altezza; le scelte vengono dal seme.
   */
  private preparaFacciata(e: EdificioPronto, lontano: number): Facciata {
    const a = e.anello;
    const n = a.length >> 1;
    const altezza = e.alt / ISO_Z;
    if (altezza < 2.2) return SENZA_FACCIATA;
    const seme = e.seme;
    const inCentro = lontano < RAGGIO_CENTRO;
    const casa = e.tipo === 'casa' || e.tipo === 'altro' || e.tipo === 'pubblico';
    // I corpi molto grandi fuori dal centro hanno tetto e muri da capannone, qualunque sia il tipo.
    const capannone = e.tipo === 'industria' || e.forma === TETTO_CAPANNONE;

    // Lunghezza in metri dei muri in vista. Nelle impronte con rientranze un muro può essere
    // coperto in parte da un altro muro dello stesso edificio, più vicino a chi guarda: di ogni
    // muro si tiene il tratto libero (da `liberoDa` a `liberoA` metri) e si dipinge solo lì.
    const lunghi = new Float32Array(n);
    const liberoDa = new Float32Array(n);
    const liberoA = new Float32Array(n);
    // Quanto è largo sullo schermo un metro di questo muro: i muri visti di taglio restano lisci.
    const scorcio = new Float32Array(n);
    // Fino a che altezza (metri) il piede del muro è nascosto da un'altra ala dello stesso edificio.
    const nascosto = new Float32Array(n);
    let piuLungo = -1;
    let piuCorto = -1;
    for (let i = 0; i < n; i++) {
      if (e.lati[i] === MURO_DIETRO) continue;
      const j = (i + 1) % n;
      const du = (a[j * 2] - a[i * 2]) / ISO_X;
      const dv = (a[j * 2 + 1] - a[i * 2 + 1]) / ISO_Y;
      const lungo = Math.sqrt((du * du + dv * dv) / 2);
      // Sullo schermo un muro in vista va sempre da sinistra a destra.
      const x0 = a[i * 2];
      const x1 = a[j * 2];
      let f0 = x0;
      let f1 = x1;
      let sotto = 0;
      if (e.ordineMuri && x1 - x0 > 1e-3) {
        const y0 = a[i * 2 + 1];
        const pend = (a[j * 2 + 1] - y0) / (x1 - x0);
        // Tutti gli altri lati dell'impronta, anche quelli di spalle: sopra ognuno c'è il corpo
        // dell'edificio, alto quanto questo muro.
        for (let m = 0; m < n; m++) {
          if (m === i) continue;
          const m2 = (m + 1) % n;
          let xa = a[m * 2];
          let ya = a[m * 2 + 1];
          let xb = a[m2 * 2];
          let yb = a[m2 * 2 + 1];
          if (xa > xb) {
            const tx = xa;
            const ty = ya;
            xa = xb;
            ya = yb;
            xb = tx;
            yb = ty;
          }
          if (xb - xa < 1e-3) continue;
          const c0 = Math.max(x0, xa);
          const c1 = Math.min(x1, xb);
          if (c1 - c0 < 0.3) continue;
          // Di quanto l'altro lato sta più in basso sullo schermo, cioè più vicino a chi guarda,
          // ai due capi del tratto comune.
          const pendM = (yb - ya) / (xb - xa);
          const d0 = ya + pendM * (c0 - xa) - (y0 + pend * (c0 - x0));
          const d1 = ya + pendM * (c1 - xa) - (y0 + pend * (c1 - x0));
          if (d0 + d1 <= 0.1) continue;
          const vicino = Math.max(0, Math.min(d0, d1));
          // Quanta altezza del muro resta nascosta, dal piede in su.
          const copre = e.alt - vicino;
          if (copre <= 0.3) continue;
          if (copre < e.alt * 0.62) {
            // Coperto solo in basso (un cortile visto da sopra l'ala davanti): i piani alti si vedono.
            if (copre > sotto) sotto = copre;
            continue;
          }
          if (c0 <= f0 + 0.3) f0 = Math.max(f0, c1);
          else if (c1 >= f1 - 0.3) f1 = Math.min(f1, c0);
          else if (c0 - f0 >= f1 - c1) f1 = c0;
          else f0 = c1;
          if (f1 <= f0) break;
        }
      }
      nascosto[i] = sotto / ISO_Z;
      lunghi[i] = lungo;
      if (lungo > 1e-3) {
        scorcio[i] = (x1 - x0) / (lungo * ISO_X);
      }
      if (f1 > f0 && x1 - x0 > 1e-3) {
        liberoDa[i] = ((f0 - x0) / (x1 - x0)) * lungo;
        liberoA[i] = ((f1 - x0) / (x1 - x0)) * lungo;
      } else if (f1 > f0) {
        liberoA[i] = lungo;
      }
      if (scorcio[i] < SCORCIO_MINIMO || sotto > 0) continue;
      const libero = liberoA[i] - liberoDa[i];
      if (libero >= 3 && (piuLungo < 0 || libero > liberoA[piuLungo] - liberoDa[piuLungo])) piuLungo = i;
      if (libero >= 5.5 && libero > lungo - 0.5 && (piuCorto < 0 || lungo < lunghi[piuCorto])) piuCorto = i;
    }

    // Tratti di facciata: lati in vista consecutivi, dalla stessa parte e quasi allineati (meno
    // di 18 gradi), contano come una facciata sola. Le finestre si distribuiscono sulla
    // lunghezza di tutto il tratto con un passo solo: un muro curvo, fatto di tanti lati corti,
    // non si riempie di finestre strette.
    const inizioTratto = new Float32Array(n);
    const lungoTratto = new Float32Array(n);
    const unito = (i: number): boolean => this.allineati(e, i);
    for (let i = 0; i < n; i++) {
      if (e.lati[i] === MURO_DIETRO || unito(i)) continue;
      let somma = 0;
      let ultimo = i;
      for (let k = i, passi = 0; passi < n; passi++) {
        inizioTratto[k] = somma;
        somma += lunghi[k];
        ultimo = k;
        const dopo = (k + 1) % n;
        if (dopo === i || !unito(dopo)) break;
        k = dopo;
      }
      for (let k = i; ; k = (k + 1) % n) {
        lungoTratto[k] = somma;
        if (k === ultimo) break;
      }
    }

    let ombre: Path2D | null = null;
    let fasce: Path2D | null = null;
    let archi: Path2D | null = null;
    let cornici: Path2D | null = null;
    let vetri: Path2D | null = null;
    let telai: Path2D | null = null;
    let accese: Path2D | null = null;
    let persiane: Path2D | null = null;
    let porte: Path2D | null = null;

    // Misure della casa, uguali su tutti i suoi muri.
    const piani = altezza < 4.6 ? 1 : Math.max(1, Math.round(altezza / 3.05));
    const interpiano = altezza / piani;
    // In centro le finestre sono piccole, scure e fitte, come nelle case antiche.
    const passoCasa = (e.tipo === 'pubblico' ? 3.2 : inCentro ? 2.3 : 2.7) + ((seme >>> 3) % 5) * (inCentro ? 0.2 : 0.24);
    const larga = e.tipo === 'pubblico' ? 1.15 : (inCentro ? 0.8 : 0.92) + ((seme >>> 6) & 1) * 0.14;
    const alta = inCentro ? 1.5 : 1.42;
    const anta = larga * 0.44;
    const conPersiane = casa && e.tipo !== 'pubblico' && (seme >>> 11) % 100 < (inCentro ? 78 : 42);
    const conMarcapiano = casa && piani >= 2 && (seme >>> 9) % 100 < (inCentro ? 55 : 25);
    const conPortico =
      casa && inCentro && piani >= 2 && interpiano >= 2.8 && piuLungo >= 0 && lunghi[piuLungo] >= 8 &&
      liberoA[piuLungo] - liberoDa[piuLungo] > lunghi[piuLungo] - 0.5 && (seme >>> 13) % 100 < 55;
    // Variazioni tra un piano e l'altro: finestrelle di sottotetto all'ultimo piano, finestre
    // più alte al piano nobile, vetrine con la tenda al piano terra nelle vie del centro.
    const sottotetto = casa && piani >= 3 && (seme >>> 19) % 100 < 55;
    const nobile = casa && inCentro && piani >= 3 && (seme >>> 23) % 100 < 50;
    const conVetrine =
      casa && e.tipo !== 'pubblico' && piani >= 2 && interpiano >= 2.8 && lontano < RAGGIO_CINTURA &&
      (seme >>> 25) % 100 < (inCentro ? 36 : 9);
    const muroPorta = e.tipo === 'chiesa' && piuCorto >= 0 ? piuCorto : piuLungo;

    for (let i = 0; i < n; i++) {
      const lungo = lunghi[i];
      const da = liberoDa[i];
      const fino = liberoA[i];
      if (fino - da < 1.2) continue;
      const j = (i + 1) % n;
      const ax = a[i * 2];
      const ay = a[i * 2 + 1];
      const ux = (a[j * 2] - ax) / lungo;
      const uy = (a[j * 2 + 1] - ay) / lungo;
      // Un rettangolo sul muro: da t0 a t1 metri lungo il muro, da z0 a z1 metri di altezza.
      const pezza = (p: Path2D, t0: number, t1: number, z0: number, z1: number): void => {
        p.moveTo(ax + ux * t0, ay + uy * t0 - z0 * ISO_Z);
        p.lineTo(ax + ux * t1, ay + uy * t1 - z0 * ISO_Z);
        p.lineTo(ax + ux * t1, ay + uy * t1 - z1 * ISO_Z);
        p.lineTo(ax + ux * t0, ay + uy * t0 - z1 * ISO_Z);
        p.closePath();
      };

      const coperto = nascosto[i];
      ombre ??= new Path2D();
      if (coperto === 0) pezza(ombre, da, fino, 0, Math.min(0.55, altezza * 0.2));
      if (altezza >= 3) pezza(ombre, da, fino, altezza - 0.28, altezza);
      if (conMarcapiano) {
        for (let k = 1; k < piani; k++) {
          if (k * interpiano > coperto + 0.2) pezza(ombre, da, fino, k * interpiano - 0.07, k * interpiano + 0.07);
        }
      }
      // Un muro visto quasi di taglio resta liscio: lì finestre e porte sarebbero lamelle.
      if (scorcio[i] < SCORCIO_LISCIO) continue;
      // Di scorcio: finestre più rade, niente persiane, porte e vetrine. Nel centro storico una
      // strada su due è vista così, e senza finestre quei fianchi sarebbero lastre spoglie.
      const diScorcio = scorcio[i] < SCORCIO_MINIMO;
      // Dove il muro è coperto in parte, finestre e porte solo nel tratto libero. Dove invece
      // continua nel lato accanto (stessa facciata), una finestra può stare a cavallo del giunto.
      const margineDa = da < 0.01 && unito(i) ? -9 : 0.25;
      const margineA = fino > lungo - 0.01 && unito(j) ? -9 : 0.25;
      const dentro = (centro: number, mezza: number): boolean =>
        centro - mezza >= da + margineDa && centro + mezza <= fino - margineA;

      if (capannone) {
        if (diScorcio) continue;
        // Capannone: una fascia di vetri in alto e un portone sul muro più lungo.
        if (altezza >= 4 && fino - da >= 6 && altezza - 2 > coperto) {
          vetri ??= new Path2D();
          pezza(vetri, da + 1.2, fino - 1.2, altezza - 2, altezza - 1.1);
        }
        if (i === piuLungo && lungo >= 10 && altezza >= 4.5 && coperto === 0) {
          const c = lungo * (0.3 + ((seme >>> 4) % 5) * 0.1);
          if (dentro(c, 1.8)) {
            porte ??= new Path2D();
            pezza(porte, c - 1.8, c + 1.8, 0, Math.min(3.6, altezza - 1.4));
          }
        }
        continue;
      }

      if (e.tipo === 'chiesa') {
        if (lungo < 2.6 || diScorcio) continue;
        // Il portale ad arco sul lato corto, con il rosone sopra se la facciata è alta.
        const c0 = lungo / 2;
        const portale = i === muroPorta && altezza >= 4.5 && coperto === 0 && dentro(c0, 1.3);
        if (portale) {
          cornici ??= new Path2D();
          porte ??= new Path2D();
          this.arco(cornici, ax, ay, ux, uy, c0, 1.25, 2.3, 3.55, 0);
          this.arco(porte, ax, ay, ux, uy, c0, 1, 2.2, 3.2, 0);
          const r = Math.min(1.15, altezza * 0.1);
          const zc = Math.min(altezza - r - 0.8, 3.55 + r + 1.1);
          if (altezza >= 7.5 && zc - r > 3.75) {
            vetri ??= new Path2D();
            this.tondo(cornici, ax, ay, ux, uy, c0, zc, r + 0.17);
            this.tondo(vetri, ax, ay, ux, uy, c0, zc, r);
            if ((seme & 2) === 0) this.tondo((accese ??= new Path2D()), ax, ay, ux, uy, c0, zc, r);
          }
        }
        // Monofore ad arco nella parte alta del muro, grandi in proporzione alla chiesa, e
        // lesene che scandiscono le campate.
        const mezza = Math.max(0.55, Math.min(0.95, altezza * 0.05));
        const z0 = Math.max(2.3, altezza * 0.4);
        const z1 = Math.min(altezza - 1, z0 + Math.min(6, Math.max(2, altezza * 0.36)));
        if (z1 - z0 < 1.5) continue;
        const tra = 4.2 + mezza * 1.6;
        const quante = Math.max(1, Math.floor((lungo - 2.4) / tra) + 1);
        const primo = (lungo - (quante - 1) * tra) / 2;
        if (coperto === 0 && altezza >= 6) {
          for (let b = 0; b <= quante; b++) {
            const c = primo + (b - 0.5) * tra;
            if (dentro(c, 0.3) && !(portale && Math.abs(c - c0) < 1.6)) {
              pezza(ombre, c - 0.2, c + 0.2, Math.min(0.55, altezza * 0.2), altezza - 0.28);
            }
          }
        }
        if (altezza >= 6) pezza(ombre, da, fino, altezza - 1.05, altezza - 0.85);
        if (z0 < coperto + 0.3) continue;
        for (let b = 0; b < quante; b++) {
          const c = primo + b * tra;
          if ((portale && Math.abs(c - c0) < 2.2) || !dentro(c, mezza + 0.15)) continue;
          cornici ??= new Path2D();
          vetri ??= new Path2D();
          this.arco(cornici, ax, ay, ux, uy, c, mezza + 0.14, z1 - mezza, z1 + 0.14, z0 - 0.14);
          this.arco(vetri, ax, ay, ux, uy, c, mezza, z1 - mezza, z1, z0);
          if (mescola(seme, i, b) % 100 < 22) {
            this.arco((accese ??= new Path2D()), ax, ay, ux, uy, c, mezza, z1 - mezza, z1, z0);
          }
        }
        continue;
      }

      // Le campate si contano sul tratto intero; questo lato ne prende quelle che gli cadono sopra.
      const tratto = lungoTratto[i];
      const inizio = inizioTratto[i];
      if (tratto < 2.6) continue;
      const passo = diScorcio ? passoCasa * PASSO_DI_SCORCIO : passoCasa;
      const campate = Math.max(1, Math.floor((tratto - 1.5) / passo) + 1);
      const primo = (tratto - (campate - 1) * passo) / 2 - inizio;
      const bMin = Math.max(0, Math.ceil(-primo / passo - 1e-6));
      const bMax = Math.min(campate - 1, Math.floor((lungo - primo) / passo + 1e-6));
      if (bMax < bMin) continue;
      const strette = campate === 1 && tratto < larga + 2 * anta + 0.5;
      const portico = conPortico && i === piuLungo && coperto === 0;
      // Una porta sul muro principale, e una per ogni altra facciata lunga su strada.
      const conPorta =
        !portico && !diScorcio && coperto === 0 && (i === muroPorta || fino - da >= (inCentro ? 6.5 : 10));
      const campataPorta = conPorta ? bMin + (mescola(seme, i, 77) % (bMax - bMin + 1)) : -1;
      const vetrine = conVetrine && !portico && !diScorcio && coperto === 0 && fino - da >= 5;

      if (portico) {
        // Portico: archi a tutto sesto al piano terra, uno accanto all'altro.
        archi ??= new Path2D();
        const quanti = Math.max(2, Math.floor((lungo - 0.5) / 3.1));
        const largo = lungo / quanti;
        const mezzo = largo / 2 - 0.4;
        const imposta = Math.max(1.2, Math.min(1.9, interpiano - 0.45 - mezzo));
        for (let b = 0; b < quanti; b++) {
          this.arco(archi, ax, ay, ux, uy, (b + 0.5) * largo, mezzo, imposta, imposta + mezzo, 0);
        }
      }

      for (let k = 0; k < piani; k++) {
        if (k === 0 && portico) continue;
        const ultimo = sottotetto && k === piani - 1;
        const z0 = k * interpiano + (piani === 1 ? Math.min(0.95, altezza * 0.3) : ultimo ? 1.15 : 0.95);
        const altaQui = ultimo ? 0.78 : nobile && k === 1 ? alta + 0.3 : alta;
        const z1 = Math.min(z0 + altaQui, (k + 1) * interpiano - 0.38);
        // Niente finestre schiacciate: se non c'è l'altezza per una finestra vera, il piano resta liscio.
        const finestra = z1 - z0 >= (ultimo ? 0.6 : 0.85) && z0 > coperto + 0.3;
        let prima = Infinity;
        let dopo = -Infinity;
        let fz0 = z0;
        let fz1 = z1;
        for (let b = bMin; b <= bMax; b++) {
          const c = primo + b * passo;
          if (k === 0 && b === campataPorta) {
            // La porta: più larga e con l'arco nei palazzi del centro e negli edifici pubblici.
            const portone = (e.tipo === 'pubblico' || (inCentro && tratto >= 9)) && interpiano >= 3;
            if (!dentro(c, portone ? 0.95 : 0.62)) continue;
            porte ??= new Path2D();
            cornici ??= new Path2D();
            if (portone) {
              pezza(cornici, c - 0.95, c + 0.95, 0, 2.75);
              this.arco(porte, ax, ay, ux, uy, c, 0.8, 1.8, 2.6, 0);
            } else {
              const su = Math.min(2.15, altezza - 0.5);
              pezza(cornici, c - 0.62, c + 0.62, 0, su + 0.12);
              pezza(porte, c - 0.5, c + 0.5, 0, su);
            }
            continue;
          }
          if (k === 0 && vetrine) {
            // Vetrina: un'apertura larga al piano terra, con la tenda sopra.
            const mezza = Math.min(passo / 2 - 0.45, 1.05);
            const su = Math.min(2.4, interpiano - 0.6);
            if (su < 1.6 || !dentro(c, mezza + 0.2)) continue;
            cornici ??= new Path2D();
            vetri ??= new Path2D();
            porte ??= new Path2D();
            pezza(cornici, c - mezza - 0.1, c + mezza + 0.1, 0.3, su + 0.1);
            pezza(vetri, c - mezza, c + mezza, 0.4, su);
            pezza(porte, c - mezza - 0.2, c + mezza + 0.2, su + 0.12, su + 0.42);
            if (mescola(seme, i * 64, b + 300) % 100 < 38) {
              pezza((accese ??= new Path2D()), c - mezza, c + mezza, 0.4, su);
            }
            prima = Math.min(prima, c - mezza);
            dopo = Math.max(dopo, c + mezza);
            fz0 = 0.4;
            fz1 = su;
            continue;
          }
          if (!finestra || !dentro(c, larga / 2)) continue;
          cornici ??= new Path2D();
          // Nelle case del centro niente cornice chiara tutt'attorno (sugli intonaci crema
          // faceva tante caselle): solo il davanzale, e la finestra resta un segno scuro.
          if (inCentro && casa && e.tipo !== 'pubblico') pezza(cornici, c - larga / 2 - 0.1, c + larga / 2 + 0.1, z0 - 0.13, z0);
          else pezza(cornici, c - larga / 2 - 0.1, c + larga / 2 + 0.1, z0 - 0.13, z1 + 0.1);
          // Tutte le finestre stanno tra i vetri; quelle che di notte si accendono anche a parte.
          pezza((vetri ??= new Path2D()), c - larga / 2, c + larga / 2, z0, z1);
          prima = Math.min(prima, c - larga / 2);
          dopo = Math.max(dopo, c + larga / 2);
          const persiana = conPersiane && !strette && !diScorcio;
          // Qualche finestra ha le persiane chiuse: resta scura anche di notte.
          const chiusa = persiana && mescola(seme, i * 64 + k, b + 900) % 100 < 11;
          if (!chiusa && mescola(seme, i * 64 + k, b) % 100 < 13) {
            pezza((accese ??= new Path2D()), c - larga / 2, c + larga / 2, z0, z1);
          }
          // Telaio: un montante al centro e, se la finestra è alta, una traversa.
          telai ??= new Path2D();
          if (!diScorcio) pezza(telai, c - 0.04, c + 0.04, z0, z1);
          if (z1 - z0 >= 1.2) {
            const zt = z0 + (z1 - z0) * 0.64;
            pezza(telai, c - larga / 2, c + larga / 2, zt - 0.035, zt + 0.035);
          }
          if (chiusa) {
            persiane ??= new Path2D();
            pezza(persiane, c - larga / 2, c + larga / 2, z0, z1);
          } else if (persiana && dentro(c, larga / 2 + anta)) {
            persiane ??= new Path2D();
            pezza(persiane, c - larga / 2 - anta, c - larga / 2 - 0.03, z0, z1);
            pezza(persiane, c + larga / 2 + 0.03, c + larga / 2 + anta, z0, z1);
          }
        }
        // La fascia che sta al posto di questa fila di finestre nella vista di mezzo.
        if (dopo > prima) pezza((fasce ??= new Path2D()), prima, dopo, fz0, fz1);
      }
    }
    if (!ombre && !vetri && !accese && !porte) return SENZA_FACCIATA;
    return {
      ombre,
      fasce,
      archi,
      cornici,
      vetri,
      telai,
      accese,
      persiane,
      porte,
      iPersiana: seme >>> 17,
      iPorta: seme >>> 21,
    };
  }

  /**
   * Un'apertura ad arco su un muro: centro `c` metri lungo il muro, mezza larghezza `mezzo`,
   * piedritti da `base` fino a `imposta`, colmo dell'arco a `cima`.
   */
  private arco(
    p: Path2D,
    ax: number,
    ay: number,
    ux: number,
    uy: number,
    c: number,
    mezzo: number,
    imposta: number,
    cima: number,
    base: number,
  ): void {
    p.moveTo(ax + ux * (c - mezzo), ay + uy * (c - mezzo) - base * ISO_Z);
    p.lineTo(ax + ux * (c + mezzo), ay + uy * (c + mezzo) - base * ISO_Z);
    const freccia = cima - imposta;
    for (let k = 0; k <= 6; k++) {
      const angolo = (Math.PI * k) / 6;
      const t = c + mezzo * Math.cos(angolo);
      const zeta = imposta + freccia * Math.sin(angolo);
      p.lineTo(ax + ux * t, ay + uy * t - zeta * ISO_Z);
    }
    p.closePath();
  }

  /** Un'apertura tonda su un muro (il rosone): centro a `c` metri lungo il muro e `zc` di altezza. */
  private tondo(
    p: Path2D,
    ax: number,
    ay: number,
    ux: number,
    uy: number,
    c: number,
    zc: number,
    r: number,
  ): void {
    for (let k = 0; k < 14; k++) {
      const angolo = (Math.PI * 2 * k) / 14;
      const t = c + r * Math.cos(angolo);
      const zeta = zc + r * Math.sin(angolo);
      if (k === 0) p.moveTo(ax + ux * t, ay + uy * t - zeta * ISO_Z);
      else p.lineTo(ax + ux * t, ay + uy * t - zeta * ISO_Z);
    }
    p.closePath();
  }

  /** Righe dei coppi lungo la pendenza di ogni falda, comignoli sulle case, torrino sulle terrazze. */
  private preparaTettoFine(e: EdificioPronto, lontano: number): TettoFine {
    let coppi: Path2D | null = null;
    let pieni: Path2D | null = null;
    let fitti: Path2D | null = null;
    let camSx: Path2D | null = null;
    let camDx: Path2D | null = null;
    let camSopra: Path2D | null = null;
    let camVetri: Path2D | null = null;
    let camBordo: Path2D | null = null;
    const passo = 2.1;

    // Una scatola sul tetto: comignolo o torrino. (x, y) è il piede sul piano isometrico.
    const scatola = (x: number, y: number, mezza: number, alta: number, sotto: number): void => {
      camSx ??= new Path2D();
      camDx ??= new Path2D();
      camSopra ??= new Path2D();
      const ex = mezza * ISO_X;
      const ey = mezza * ISO_Y;
      const giu = y + sotto * ISO_Z;
      const su = y - alta * ISO_Z;
      // Angoli in pianta: ovest (x - 2ex), sud (y + 2ey), est (x + 2ex), nord (y - 2ey).
      camSx.moveTo(x - 2 * ex, giu);
      camSx.lineTo(x, giu + 2 * ey);
      camSx.lineTo(x, su + 2 * ey);
      camSx.lineTo(x - 2 * ex, su);
      camSx.closePath();
      camDx.moveTo(x, giu + 2 * ey);
      camDx.lineTo(x + 2 * ex, giu);
      camDx.lineTo(x + 2 * ex, su);
      camDx.lineTo(x, su + 2 * ey);
      camDx.closePath();
      const bordo = 1.25;
      camSopra.moveTo(x - 2 * ex * bordo, su);
      camSopra.lineTo(x, su + 2 * ey * bordo);
      camSopra.lineTo(x + 2 * ex * bordo, su);
      camSopra.lineTo(x, su - 2 * ey * bordo);
      camSopra.closePath();
      // Contorno: i due fianchi in vista, lo spigolo tra loro e il coperchio.
      camBordo ??= new Path2D();
      camBordo.moveTo(x - 2 * ex, su);
      camBordo.lineTo(x - 2 * ex, giu);
      camBordo.lineTo(x, giu + 2 * ey);
      camBordo.lineTo(x + 2 * ex, giu);
      camBordo.lineTo(x + 2 * ex, su);
      camBordo.moveTo(x, giu + 2 * ey);
      camBordo.lineTo(x, su + 2 * ey * bordo);
      camBordo.moveTo(x - 2 * ex * bordo, su);
      camBordo.lineTo(x, su + 2 * ey * bordo);
      camBordo.lineTo(x + 2 * ex * bordo, su);
      camBordo.lineTo(x, su - 2 * ey * bordo);
      camBordo.closePath();
    };

    if (e.forma === TETTO_FALDE && e.facce && e.facceInfo && e.pendenze) {
      const v = e.facce;
      let k = 0;
      let falde = 0;
      for (let f = 0; f < e.facceInfo.length; f += 2) {
        const vertici = e.facceInfo[f];
        const sx = e.pendenze[f];
        const sy = e.pendenze[f + 1];
        if ((e.facceInfo[f + 1] & MASCHERA_CLASSE) === CAPPELLO) {
          // Un piano rimasto in cima: la stessa tessitura dei tetti piani in cotto.
          coppi ??= new Path2D();
          righePiane(coppi, v, k, vertici, 0, passo);
        }
        if ((sx !== 0 || sy !== 0) && vertici >= 3) {
          falde++;
          // Lato di gronda: i primi due vertici. Passo in metri veri lungo la gronda.
          const ax = v[k];
          const ay = v[k + 1];
          const du = (v[k + 2] - ax) / ISO_X;
          const dv = (v[k + 3] - ay) / ISO_Y;
          const lungo = Math.sqrt((du * du + dv * dv) / 2);
          if (lungo > 0.3) {
            const gx = (v[k + 2] - ax) / lungo;
            const gy = (v[k + 3] - ay) / lungo;
            const croce = gx * sy - gy * sx;
            if (Math.abs(croce) > 1e-6) {
              // Di quanto la faccia si allarga oltre i capi della gronda, misurato lungo la gronda.
              let min = 0;
              let max = lungo;
              for (let i = 2; i < vertici; i++) {
                const t = ((v[k + i * 2] - ax) * sy - (v[k + i * 2 + 1] - ay) * sx) / croce;
                if (t < min) min = t;
                if (t > max) max = t;
              }
              const primo = Math.ceil(min / passo - 0.25);
              for (let r = primo; (r + 0.25) * passo < max; r++) {
                coppi ??= new Path2D();
                pieni ??= new Path2D();
                fitti ??= new Path2D();
                // Le file non sono tirate con la riga: ognuna scarta un poco, sempre allo stesso modo.
                const scarto = ((mescola(e.seme, f, r + 64) % 1000) / 1000 - 0.5) * 0.3;
                const t = (r + 0.25 + scarto) * passo;
                rigaNelPoligono((r & 1) === 0 ? coppi : pieni, v, k, vertici, 0, ax + gx * t, ay + gy * t, sx, sy);
                const t2 = (r + 0.75 - scarto * 0.6) * passo;
                rigaNelPoligono(fitti, v, k, vertici, 0, ax + gx * t2, ay + gy * t2, sx, sy);
              }
            }
          }
        }
        k += vertici * 2;
      }
      const casa = e.tipo === 'casa' || e.tipo === 'altro' || e.tipo === 'pubblico';
      // Qualche abbaino sulle case grandi: una scatoletta con la finestra, sulla falda più
      // larga tra quelle che guardano chi osserva (a sud o a ovest), a metà strada dalla gronda.
      if (casa && e.area > 110 && (e.seme >>> 15) % 100 < (lontano < RAGGIO_CENTRO ? 34 : 14)) {
        let scelta = -1;
        let inizioScelta = 0;
        let largaScelta = 5;
        k = 0;
        for (let f = 0; f < e.facceInfo.length; f += 2) {
          const vertici = e.facceInfo[f];
          if (e.pendenze[f + 1] < -0.45 && vertici >= 4) {
            const larga = Math.hypot(v[k + 2] - v[k], (v[k + 3] - v[k + 1]) * 2);
            if (larga > largaScelta) {
              largaScelta = larga;
              scelta = f;
              inizioScelta = k;
            }
          }
          k += vertici * 2;
        }
        if (scelta >= 0) {
          const vertici = e.facceInfo[scelta];
          let x = 0;
          let y = 0;
          for (let i = 0; i < vertici; i++) {
            x += v[inizioScelta + i * 2];
            y += v[inizioScelta + i * 2 + 1];
          }
          // A metà tra il centro della falda e il centro della gronda.
          x = (x / vertici + (v[inizioScelta] + v[inizioScelta + 2]) / 2) / 2;
          y = (y / vertici + (v[inizioScelta + 1] + v[inizioScelta + 3]) / 2) / 2;
          const mezza = 0.55;
          const alta = 1;
          scatola(x, y, mezza, alta, 0.35);
          camVetri = new Path2D();
          const ex = mezza * ISO_X;
          const ey = mezza * ISO_Y;
          // La finestra sta sulla faccia che guarda come la falda: a sud (destra) o a ovest (sinistra).
          const aSud = e.pendenze[scelta] < 0;
          const x0 = aSud ? x + 2 * ex * 0.2 : x - 2 * ex * 0.8;
          const x1 = aSud ? x + 2 * ex * 0.8 : x - 2 * ex * 0.2;
          const y0 = aSud ? y + 2 * ey * 0.8 : y + 2 * ey * 0.2;
          const y1 = aSud ? y + 2 * ey * 0.2 : y + 2 * ey * 0.8;
          camVetri.moveTo(x0, y0 - 0.2 * alta * ISO_Z);
          camVetri.lineTo(x1, y1 - 0.2 * alta * ISO_Z);
          camVetri.lineTo(x1, y1 - 0.8 * alta * ISO_Z);
          camVetri.lineTo(x0, y0 - 0.8 * alta * ISO_Z);
          camVetri.closePath();
        }
      }
      // Comignoli: uno o due, su falde scelte dal seme, a metà falda.
      if (casa && falde > 0 && e.area > 34 && (e.seme >>> 12) % 100 < 82) {
        const quanti = e.area > 150 && (e.seme >>> 4) % 3 > 0 ? 2 : 1;
        for (let c = 0; c < quanti; c++) {
          let voluta = mescola(e.seme, c, 5) % falde;
          k = 0;
          for (let f = 0; f < e.facceInfo.length; f += 2) {
            const vertici = e.facceInfo[f];
            if ((e.pendenze[f] !== 0 || e.pendenze[f + 1] !== 0) && vertici >= 3 && voluta-- === 0) {
              let x = 0;
              let y = 0;
              for (let i = 0; i < vertici; i++) {
                x += v[k + i * 2];
                y += v[k + i * 2 + 1];
              }
              scatola(x / vertici, y / vertici, 0.32, 1.15, 0.5);
              break;
            }
            k += vertici * 2;
          }
        }
      }
    } else if (e.forma === TETTO_PIANO && e.tipo !== 'industria' && e.area >= 9) {
      // Tetto piano in cotto: una tessitura leggera di righe, tutte nello stesso verso.
      coppi = new Path2D();
      righePiane(coppi, e.anello, 0, e.anello.length >> 1, e.alt, passo);
    } else if (e.forma === TETTO_TERRAZZA && e.area > 180 && (e.seme >>> 12) % 100 < 70) {
      // Torrino delle scale, se il centro cade davvero sul tetto.
      if (puntoInPoligono(e.cx, e.cy, e.anello)) scatola(e.cx, e.cy - e.alt, 1.3, 2.3, 0);
    }
    if (!coppi && !camSopra) return SENZA_TETTO_FINE;
    return { coppi, pieni, fitti, camSx, camDx, camSopra, camVetri, camBordo };
  }

  private albero(ctx: CanvasRenderingContext2D, indice: number, fine: boolean): void {
    const sx = this.scena.alberi[indice * 2];
    const sy = this.scena.alberi[indice * 2 + 1];
    const seme = Math.imul(indice + 1, 2654435761) >>> 0;
    const r = 2.3 + ((seme >>> 8) % 9) * 0.17;
    const chioma = this.chiome[(seme >>> 3) % this.chiome.length];
    const cy = sy - r * 1.35;
    // Ombra a terra, verso destra.
    ctx.fillStyle = this.P.ombra;
    ctx.beginPath();
    const lunga = this.P.ombraLunga;
    ctx.ellipse(sx + r * 0.55 * lunga, sy + r * 0.1, r * 1.05 * (0.5 + lunga / 2), r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (fine) {
      ctx.save();
      ctx.strokeStyle = this.P.tronco;
      ctx.lineWidth = Math.max(0.5, r * 0.22);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, cy);
      ctx.stroke();
      ctx.restore();
    }
    if (!fine) {
      ctx.fillStyle = chioma.base;
      ctx.beginPath();
      ctx.arc(sx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    // Da vicino la chioma ha tre toni, come una macchia d'acquerello: tutta in ombra, poi la
    // parte in luce verso l'alto a sinistra (l'ombra resta come una falce in basso a destra) e
    // un tocco chiaro. Le due luci sono un riempimento solo ciascuna; il contorno una volta.
    ctx.fillStyle = chioma.ombra;
    ctx.beginPath();
    ctx.arc(sx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = chioma.base;
    ctx.beginPath();
    ctx.arc(sx - r * 0.16, cy - r * 0.18, r * 0.76, 0, Math.PI * 2);
    ctx.arc(sx - r * 0.3, cy + r * 0.28, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = chioma.luce;
    ctx.beginPath();
    ctx.arc(sx - r * 0.3, cy - r * 0.34, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  private illustrazione(ctx: CanvasRenderingContext2D, sp: Sprite, densita: number): void {
    const sorgente = this.illustrazioni.daDisegnare(sp.indice, sp.larghezza * densita);
    if (!sorgente) return;
    ctx.drawImage(sorgente, sp.x, sp.y, sp.larghezza, sp.altezza);
  }

  // --- segnaposto ------------------------------------------------------------------

  private segnaposto(ctx: CanvasRenderingContext2D, s: StatoDisegno, sprite: Sprite[]): void {
    const P = this.P;
    const marcatori = this.marcatori(s.visibili, s.camera, s.vista);
    // Un luogo senza illustrazione si evidenzia sul suo segnaposto, anche a strato spento:
    // l'alone va sopra gli edifici, altrimenti resterebbe nascosto.
    const evidenziati: { nome: string; px: number; py: number }[] = [];
    if (s.evidenziata && !this.evidenzaSuLandmark(s.evidenziata)) {
      for (const p of this.scena.punti) {
        if (p.dati.storia !== s.evidenziata) continue;
        const c = isoInSchermo(p.sx, p.sy, s.camera, s.vista);
        this.aloneEvidenza(ctx, c.px, c.py, 22);
        evidenziati.push({ nome: p.dati.nome, px: c.px, py: c.py });
      }
    }
    for (const m of marcatori) {
      const p = this.scena.punti[m.indice].dati;
      const avviso = p.tipo === 'avviso';
      const colori = avviso ? P.avviso : P.strati[p.strato];
      const sopra = m.indice === s.puntoSopra;
      this.spillo(ctx, m, avviso ? 'avviso' : p.strato, colori.fondo, colori.segno, p.storia !== undefined, sopra);
    }

    // Nomi: prima quello sotto il cursore, poi i luoghi con una storia, poi gli altri.
    const occupati: Rettangolo[] = [];
    const scrivi = (testo: string, x: number, y: number, forte: boolean, obbligato: boolean): void => {
      ctx.font = `${forte ? 600 : 500} ${forte ? 13 : 12}px ${CARATTERE}`;
      const chiave = ctx.font + testo;
      let larghezza = this.larghezzeTesto.get(chiave);
      if (larghezza === undefined) {
        larghezza = ctx.measureText(testo).width;
        this.larghezzeTesto.set(chiave, larghezza);
      }
      const cx = Math.min(s.vista.larghezza - larghezza / 2 - 6, Math.max(larghezza / 2 + 6, x));
      const r: Rettangolo = {
        minX: cx - larghezza / 2 - 4,
        maxX: cx + larghezza / 2 + 4,
        minY: y - 16,
        maxY: y + 3,
      };
      if (!obbligato && occupati.some((o) => siToccano(o, r))) return;
      occupati.push(r);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = P.etichettaAlone;
      ctx.strokeText(testo, cx, y);
      ctx.fillStyle = P.etichetta;
      ctx.fillText(testo, cx, y);
    };

    const sopraMarcatore = marcatori.find((m) => m.indice === s.puntoSopra);
    if (sopraMarcatore) {
      const p = this.scena.punti[sopraMarcatore.indice].dati;
      scrivi(p.nome, sopraMarcatore.tx, sopraMarcatore.ty - sopraMarcatore.raggio - 7, true, true);
    } else if (s.landmarkSopra >= 0) {
      const sp = sprite.find((v) => v.indice === s.landmarkSopra);
      if (sp) {
        const nome = this.scena.landmark[sp.indice].dati.nome;
        scrivi(nome, sp.x + sp.larghezza / 2, Math.max(18, sp.y - 6), true, true);
      }
    }
    // Il luogo evidenziato dice sempre il suo nome, anche da lontano e a strato spento.
    for (const e of evidenziati) {
      const m = marcatori.find((v) => v.px === e.px && v.py === e.py);
      if (m && m.indice === s.puntoSopra) continue;
      scrivi(e.nome, e.px, (m ? m.ty - m.raggio : e.py - 14) - 7, true, false);
    }
    // I luoghi simbolo hanno sempre il nome scritto sopra il disegno, a ogni zoom: è lui
    // a dire che cosa si sta guardando, al posto del segnaposto. Prima quello evidenziato.
    const conNome = sprite
      .filter((sp) => sp.indice !== s.landmarkSopra || sopraMarcatore !== undefined)
      .sort((a, b) => {
        const ea = this.scena.landmark[a.indice].dati.storia === s.evidenziata ? 0 : 1;
        const eb = this.scena.landmark[b.indice].dati.storia === s.evidenziata ? 0 : 1;
        return ea - eb || a.indice - b.indice;
      });
    for (const sp of conNome) {
      if (sp.x + sp.larghezza < 0 || sp.x > s.vista.larghezza || sp.y > s.vista.altezza) continue;
      const nome = this.scena.landmark[sp.indice].dati.nome;
      scrivi(nome, sp.x + sp.larghezza / 2, Math.max(18, sp.y - 6), true, false);
    }
    if (s.camera.zoom >= ZOOM_NOMI) {
      const resto = marcatori.filter((m) => m.indice !== s.puntoSopra);
      resto.sort((a, b) => {
        const sa = this.scena.punti[a.indice].dati.storia ? 0 : 1;
        const sb = this.scena.punti[b.indice].dati.storia ? 0 : 1;
        return sa - sb || b.py - a.py;
      });
      for (const m of resto) {
        const p = this.scena.punti[m.indice].dati;
        scrivi(p.nome, m.tx, m.ty - m.raggio - 6, false, false);
      }
    }
  }

  /** Un segnaposto: forma diversa per strato (triangolo per gli avvisi), sempre rivolto a chi guarda. */
  private spillo(
    ctx: CanvasRenderingContext2D,
    m: Marcatore,
    strato: IdStrato | 'avviso',
    fondo: string,
    segno: string,
    conStoria: boolean,
    sopra: boolean,
  ): void {
    const r = m.raggio * (sopra ? 1.12 : 1);
    ctx.lineJoin = 'round';
    if (m.pallino) {
      ctx.beginPath();
      if (strato === 'cultura') ctx.arc(m.px, m.py, r, 0, Math.PI * 2);
      else if (strato === 'avviso') {
        ctx.moveTo(m.px, m.py - r * 1.3);
        ctx.lineTo(m.px + r * 1.3, m.py + r);
        ctx.lineTo(m.px - r * 1.3, m.py + r);
        ctx.closePath();
      } else if (strato === 'ambiente') {
        ctx.moveTo(m.px, m.py - r * 1.25);
        ctx.lineTo(m.px + r * 1.25, m.py);
        ctx.lineTo(m.px, m.py + r * 1.25);
        ctx.lineTo(m.px - r * 1.25, m.py);
        ctx.closePath();
      } else ctx.rect(m.px - r * 0.9, m.py - r * 0.9, r * 1.8, r * 1.8);
      ctx.fillStyle = fondo;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = segno;
      ctx.stroke();
      return;
    }
    const x = m.tx;
    const y = m.ty;
    // Ombra a terra sotto la punta.
    ctx.fillStyle = this.P.ombra;
    ctx.beginPath();
    ctx.ellipse(m.px, m.py, r * 0.55, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    if (strato === 'cultura') {
      // Goccia.
      ctx.moveTo(m.px, m.py);
      ctx.lineTo(x - r * 0.8, y + r * 0.6);
      ctx.arc(x, y, r, Math.PI - 0.6435, 0.6435, false);
      ctx.closePath();
    } else if (strato === 'avviso') {
      // Cartello di pericolo: un triangolo con la punta in alto, su un paletto fino a terra.
      const l = r * 1.25;
      ctx.moveTo(x, y - l);
      ctx.lineTo(x + l, y + l * 0.75);
      ctx.lineTo(x + r * 0.18, y + l * 0.75);
      ctx.lineTo(m.px, m.py);
      ctx.lineTo(x - r * 0.18, y + l * 0.75);
      ctx.lineTo(x - l, y + l * 0.75);
      ctx.closePath();
    } else if (strato === 'ambiente') {
      // Aquilone: un rombo con la punta in basso allungata fino a terra.
      ctx.moveTo(x, y - r * 1.15);
      ctx.lineTo(x + r * 1.15, y);
      ctx.lineTo(m.px, m.py);
      ctx.lineTo(x - r * 1.15, y);
      ctx.closePath();
    } else {
      // Targa quadrata con gli angoli tondi e un piccolo piede.
      const l = r * 0.95;
      const c = r * 0.32;
      ctx.moveTo(x - l + c, y - l);
      ctx.arcTo(x + l, y - l, x + l, y + l, c);
      ctx.arcTo(x + l, y + l, x - l, y + l, c);
      ctx.lineTo(x + r * 0.4, y + l);
      ctx.lineTo(m.px, m.py);
      ctx.lineTo(x - r * 0.4, y + l);
      ctx.arcTo(x - l, y + l, x - l, y - l, c);
      ctx.arcTo(x - l, y - l, x + l, y - l, c);
      ctx.closePath();
    }
    ctx.fillStyle = fondo;
    ctx.fill();
    ctx.lineWidth = sopra ? 2 : 1.4;
    ctx.strokeStyle = sopra ? segno : conAlfa(this.P.seppia, 0.9);
    ctx.stroke();

    if (strato === 'avviso') {
      // Un punto esclamativo al posto dell'anello.
      ctx.fillStyle = segno;
      ctx.beginPath();
      ctx.rect(x - r * 0.11, y - r * 0.55, r * 0.22, r * 0.7);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y + r * 0.42, r * 0.13, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    // Segno interno: pieno per i luoghi con una storia, un anello per gli altri.
    ctx.beginPath();
    ctx.arc(x, y, r * (conStoria ? 0.42 : 0.34), 0, Math.PI * 2);
    if (conStoria) {
      ctx.fillStyle = segno;
      ctx.fill();
    } else {
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = segno;
      ctx.stroke();
    }
  }
}
