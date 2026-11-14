// La scena: tutto ciò che non dipende dalla camera, calcolato una volta sola.
// Anelli già proiettati, riquadri, chiavi di profondità, ordine di disegno e
// griglia per trovare in fretta ciò che cade nel riquadro visibile.
// Nessun accesso al DOM: questo file si prova con vitest.

import type {
  DatiBase,
  DatiStrati,
  Edificio,
  IdStrato,
  Landmark,
  Linea,
  Punto,
  TipoArea,
  TipoEdificio,
  TipoStrada,
} from '../types';
import { ISO_X, ISO_Y, ISO_Z, lonLatInMetri, profondita } from './proiezione';
import type { Rettangolo, Vista } from './proiezione';

// --- geometria di base --------------------------------------------------------

/** Proietta un array piatto di metri [x0, y0, ...] sul piano isometrico (z = 0). */
export function proiettaPiatto(p: ArrayLike<number>): Float32Array {
  const n = p.length & ~1;
  const u = new Float32Array(n);
  for (let i = 0; i < n; i += 2) {
    u[i] = (p[i] - p[i + 1]) * ISO_X;
    u[i + 1] = -(p[i] + p[i + 1]) * ISO_Y;
  }
  return u;
}

/** Area con segno di un anello: positiva se antiorario (x a est, y a nord). */
export function areaConSegno(p: ArrayLike<number>): number {
  const n = p.length & ~1;
  let a = 0;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    a += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return a / 2;
}

/** Copia dell'anello in senso antiorario. */
export function antiorario(p: ArrayLike<number>): number[] {
  const n = p.length & ~1;
  const u: number[] = new Array(n);
  if (areaConSegno(p) >= 0) {
    for (let i = 0; i < n; i++) u[i] = p[i];
  } else {
    for (let i = 0; i < n; i += 2) {
      u[i] = p[n - 2 - i];
      u[i + 1] = p[n - 1 - i];
    }
  }
  return u;
}

/** Riquadro di un array piatto di punti, scritto in `uscita` a partire da `da`. */
export function scriviRiquadro(p: ArrayLike<number>, uscita: Float32Array, da: number): void {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < p.length; i += 2) {
    if (p[i] < minX) minX = p[i];
    if (p[i] > maxX) maxX = p[i];
    if (p[i + 1] < minY) minY = p[i + 1];
    if (p[i + 1] > maxY) maxY = p[i + 1];
  }
  uscita[da] = minX;
  uscita[da + 1] = minY;
  uscita[da + 2] = maxX;
  uscita[da + 3] = maxY;
}

export function siToccano(a: Rettangolo, b: Rettangolo): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

// --- profondità ----------------------------------------------------------------

/**
 * Chiave di profondità di un'impronta: x + y dell'angolo più vicino a chi guarda
 * (il più a sud-ovest). Più è grande, più l'oggetto è lontano.
 */
export function profonditaImpronta(p: ArrayLike<number>): number {
  let min = Infinity;
  for (let i = 0; i + 1 < p.length; i += 2) {
    const d = profondita(p[i], p[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Ordine di disegno: indici ordinati dal più lontano (chiave più grande) al più
 * vicino. A parità di chiave resta l'ordine di partenza.
 */
export function ordinePerProfondita(chiavi: ArrayLike<number>): Uint32Array {
  const ordine = new Uint32Array(chiavi.length);
  for (let i = 0; i < ordine.length; i++) ordine[i] = i;
  ordine.sort((a, b) => chiavi[b] - chiavi[a] || a - b);
  return ordine;
}

// --- griglia spaziale ----------------------------------------------------------

/**
 * Griglia regolare sul piano isometrico. Ogni elemento sta in tutte le celle
 * che il suo riquadro tocca. L'interrogazione restituisce gli indici in ordine
 * crescente: se gli elementi sono già in ordine di disegno, lo è anche il risultato.
 */
export class Griglia {
  readonly lato: number;
  private readonly riquadri: Float32Array;
  private readonly n: number;
  private readonly x0: number;
  private readonly y0: number;
  private readonly colonne: number;
  private readonly righe: number;
  private readonly inizio: Int32Array;
  private readonly voci: Int32Array;
  private readonly visto: Uint32Array;
  private readonly uscita: Int32Array;
  private giro = 0;

  constructor(riquadri: Float32Array, n: number, lato: number) {
    this.riquadri = riquadri;
    this.n = n;
    this.lato = lato;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      if (riquadri[k] < minX) minX = riquadri[k];
      if (riquadri[k + 1] < minY) minY = riquadri[k + 1];
      if (riquadri[k + 2] > maxX) maxX = riquadri[k + 2];
      if (riquadri[k + 3] > maxY) maxY = riquadri[k + 3];
    }
    if (n === 0) {
      minX = minY = 0;
      maxX = maxY = 1;
    }
    this.x0 = minX;
    this.y0 = minY;
    this.colonne = Math.max(1, Math.ceil((maxX - minX) / lato) || 1);
    this.righe = Math.max(1, Math.ceil((maxY - minY) / lato) || 1);
    const celle = this.colonne * this.righe;
    const conta = new Int32Array(celle + 1);
    for (let i = 0; i < n; i++) {
      this.perOgniCella(i, (c) => {
        conta[c + 1]++;
      });
    }
    for (let c = 0; c < celle; c++) conta[c + 1] += conta[c];
    this.inizio = conta;
    this.voci = new Int32Array(conta[celle]);
    const cursore = conta.slice(0, celle);
    for (let i = 0; i < n; i++) {
      this.perOgniCella(i, (c) => {
        this.voci[cursore[c]++] = i;
      });
    }
    this.visto = new Uint32Array(n);
    this.uscita = new Int32Array(n);
  }

  private colonnaDi(x: number): number {
    const c = Math.floor((x - this.x0) / this.lato);
    return c < 0 ? 0 : c >= this.colonne ? this.colonne - 1 : c;
  }

  private rigaDi(y: number): number {
    const r = Math.floor((y - this.y0) / this.lato);
    return r < 0 ? 0 : r >= this.righe ? this.righe - 1 : r;
  }

  private perOgniCella(i: number, f: (cella: number) => void): void {
    const k = i * 4;
    const c0 = this.colonnaDi(this.riquadri[k]);
    const c1 = this.colonnaDi(this.riquadri[k + 2]);
    const r0 = this.rigaDi(this.riquadri[k + 1]);
    const r1 = this.rigaDi(this.riquadri[k + 3]);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) f(r * this.colonne + c);
  }

  /**
   * Indici degli elementi il cui riquadro tocca `zona`, in ordine crescente.
   * Il risultato è una vista su una memoria riusata: vale fino alla chiamata dopo.
   */
  interroga(zona: Rettangolo): Int32Array {
    if (this.n === 0) return this.uscita.subarray(0, 0);
    if (
      zona.maxX < this.x0 ||
      zona.maxY < this.y0 ||
      zona.minX > this.x0 + this.colonne * this.lato ||
      zona.minY > this.y0 + this.righe * this.lato
    ) {
      return this.uscita.subarray(0, 0);
    }
    this.giro++;
    if (this.giro === 0xffffffff) {
      this.visto.fill(0);
      this.giro = 1;
    }
    const giro = this.giro;
    const q = this.riquadri;
    const c0 = this.colonnaDi(zona.minX);
    const c1 = this.colonnaDi(zona.maxX);
    const r0 = this.rigaDi(zona.minY);
    const r1 = this.rigaDi(zona.maxY);
    let quanti = 0;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cella = r * this.colonne + c;
        for (let v = this.inizio[cella]; v < this.inizio[cella + 1]; v++) {
          const i = this.voci[v];
          if (this.visto[i] === giro) continue;
          this.visto[i] = giro;
          const k = i * 4;
          if (
            q[k] <= zona.maxX &&
            q[k + 2] >= zona.minX &&
            q[k + 1] <= zona.maxY &&
            q[k + 3] >= zona.minY
          ) {
            this.uscita[quanti++] = i;
          }
        }
      }
    }
    const risultato = this.uscita.subarray(0, quanti);
    risultato.sort();
    return risultato;
  }
}

// --- tessere ---------------------------------------------------------------------

/** Un gruppo di elementi vicini, con il riquadro che li contiene tutti. */
export interface Tessera extends Rettangolo {
  indici: number[];
}

/**
 * Raggruppa gli elementi per cella (quella del centro del loro riquadro). Ogni
 * tessera ricorda il riquadro complessivo, così si può scartare per intero
 * quando è fuori dallo schermo, qualunque sia la dimensione degli elementi.
 */
export function raggruppaInTessere(
  riquadri: Float32Array,
  indici: ArrayLike<number>,
  lato: number,
): Tessera[] {
  const mappa = new Map<string, Tessera>();
  for (let j = 0; j < indici.length; j++) {
    const i = indici[j];
    const k = i * 4;
    const cx = Math.floor((riquadri[k] + riquadri[k + 2]) / 2 / lato);
    const cy = Math.floor((riquadri[k + 1] + riquadri[k + 3]) / 2 / lato);
    const chiave = cx + ':' + cy;
    let t = mappa.get(chiave);
    if (!t) {
      t = { indici: [], minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      mappa.set(chiave, t);
    }
    t.indici.push(i);
    if (riquadri[k] < t.minX) t.minX = riquadri[k];
    if (riquadri[k + 1] < t.minY) t.minY = riquadri[k + 1];
    if (riquadri[k + 2] > t.maxX) t.maxX = riquadri[k + 2];
    if (riquadri[k + 3] > t.maxY) t.maxY = riquadri[k + 3];
  }
  return [...mappa.values()];
}

// --- livello di dettaglio ------------------------------------------------------

export type Dettaglio = 'piatto' | 'tetti' | 'pieno';

/** Soglie di zoom: sotto `piatto` sagome unite, sotto `muri` solo tetti. */
export function soglieDettaglio(vista: Vista): { piatto: number; muri: number } {
  // Più lo schermo è grande, più edifici entrano a parità di zoom: la soglia sale.
  const lato = Math.sqrt(Math.max(1, vista.larghezza * vista.altezza));
  const muri = Math.min(1.25, Math.max(0.7, lato / 1000));
  return { piatto: muri * 0.38, muri };
}

export function livelloDettaglio(zoom: number, vista: Vista): Dettaglio {
  const s = soglieDettaglio(vista);
  if (zoom < s.piatto) return 'piatto';
  if (zoom < s.muri) return 'tetti';
  return 'pieno';
}

// --- edifici ---------------------------------------------------------------------

export const MURO_DIETRO = 0;
/** Parete che guarda a ovest: sullo schermo è la faccia di sinistra, in luce. */
export const MURO_SINISTRO = 1;
/** Parete che guarda a sud: sullo schermo è la faccia di destra, in ombra. */
export const MURO_DESTRO = 2;

export interface EdificioPronto {
  /** Impronta sul piano isometrico, senso antiorario, z = 0. */
  anello: Float32Array;
  /** Di quanto il tetto sta sopra l'impronta, in unità isometriche. */
  alt: number;
  /** Altezza in più del colmo (tetto a punta); 0 per i tetti piani. */
  colmo: number;
  /** Per ogni lato dell'anello: MURO_DIETRO, MURO_SINISTRO o MURO_DESTRO. */
  lati: Uint8Array;
  /**
   * Solo per le impronte con rientranze: i lati in vista, dal più lontano al più vicino.
   * Disegnati in quest'ordine, i muri dentro una rientranza non coprono la facciata davanti.
   * null per le impronte convesse, dove l'ordine non conta.
   */
  ordineMuri: Uint16Array | null;
  tipo: TipoEdificio;
  /** Numero stabile ricavato dalla geometria: decide le piccole variazioni di colore. */
  seme: number;
  /** Centro dell'impronta sul piano isometrico. */
  cx: number;
  cy: number;
  /** Area dell'impronta in metri quadrati. */
  area: number;
  /** Indice del luogo simbolo che lo copre, oppure -1. */
  sotto: number;
}

/** Classifica i lati di un anello antiorario (in metri) rispetto a chi guarda da sud-ovest. */
export function classificaLati(p: ArrayLike<number>): Uint8Array {
  const n = p.length >> 1;
  const lati = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = p[j * 2] - p[i * 2];
    const dy = p[j * 2 + 1] - p[i * 2 + 1];
    // Normale esterna (dy, -dx); la parete si vede se guarda verso sud-ovest.
    if (dx - dy <= 1e-9) lati[i] = MURO_DIETRO;
    else lati[i] = -dy > dx ? MURO_SINISTRO : MURO_DESTRO;
  }
  return lati;
}

/**
 * true se l'anello (antiorario, in metri) è convesso. I punti quasi allineati, frequenti
 * nei dati veri, non contano come rientranze.
 */
export function eConvesso(p: ArrayLike<number>): boolean {
  const n = p.length >> 1;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const k = (i + 2) % n;
    const ax = p[j * 2] - p[i * 2];
    const ay = p[j * 2 + 1] - p[i * 2 + 1];
    const bx = p[k * 2] - p[j * 2];
    const by = p[k * 2 + 1] - p[j * 2 + 1];
    const giro = ax * by - ay * bx;
    // Una svolta a destra più marcata di qualche grado è una rientranza.
    if (giro < -0.05 * Math.hypot(ax, ay) * Math.hypot(bx, by)) return false;
  }
  return true;
}

/**
 * I lati in vista di un anello (in metri), dal più lontano al più vicino a chi guarda:
 * conta la profondità (x + y) del punto medio del lato.
 */
export function ordinaMuri(p: ArrayLike<number>, lati: Uint8Array): Uint16Array {
  const n = lati.length;
  const visibili: number[] = [];
  const chiave = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (lati[i] === MURO_DIETRO) continue;
    const j = (i + 1) % n;
    chiave[i] = (profondita(p[i * 2], p[i * 2 + 1]) + profondita(p[j * 2], p[j * 2 + 1])) / 2;
    visibili.push(i);
  }
  visibili.sort((a, b) => chiave[b] - chiave[a] || a - b);
  return Uint16Array.from(visibili);
}

/** Numero stabile a 32 bit ricavato dall'impronta. */
export function semeDi(p: ArrayLike<number>): number {
  let h = 2166136261 ^ p.length;
  const quanti = Math.min(p.length, 8);
  for (let i = 0; i < quanti; i++) {
    h ^= Math.round(p[i] * 10) | 0;
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return h >>> 0;
}

export function preparaEdificio(e: Edificio): EdificioPronto {
  const p = antiorario(e.p);
  const anello = proiettaPiatto(p);
  const n = p.length >> 1;
  let sx = 0;
  let sy = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    sx += anello[i * 2];
    sy += anello[i * 2 + 1];
    if (p[i * 2] < minX) minX = p[i * 2];
    if (p[i * 2] > maxX) maxX = p[i * 2];
    if (p[i * 2 + 1] < minY) minY = p[i * 2 + 1];
    if (p[i * 2 + 1] > maxY) maxY = p[i * 2 + 1];
  }
  const corto = n > 0 ? Math.min(maxX - minX, maxY - minY) : 0;
  const convesso = eConvesso(p);
  const lati = classificaLati(p);
  // Il tetto a punta è un ventaglio di falde dal centro: regge solo sulle impronte
  // convesse. Su una pianta con rientranze (quasi tutte le chiese vere) le falde
  // uscirebbero dai muri, quindi lì il tetto resta piano.
  let colmo = 0;
  if (convesso) {
    if (e.t === 'torre') colmo = Math.min(7, Math.max(2, corto * 0.7)) * ISO_Z;
    else if (e.t === 'chiesa') colmo = Math.min(5, Math.max(1.5, corto * 0.3)) * ISO_Z;
  }
  return {
    anello,
    alt: Math.max(0, e.h) * ISO_Z,
    colmo,
    lati,
    ordineMuri: convesso || n > 65535 ? null : ordinaMuri(p, lati),
    tipo: e.t,
    seme: semeDi(e.p),
    cx: n > 0 ? sx / n : 0,
    cy: n > 0 ? sy / n : 0,
    area: Math.abs(areaConSegno(p)),
    sotto: -1,
  };
}

// --- luoghi simbolo --------------------------------------------------------------

export interface LandmarkPronto {
  dati: Landmark;
  /** Punto d'appoggio in metri locali e sul piano isometrico. */
  x: number;
  y: number;
  sx: number;
  sy: number;
  /** Larghezza dell'illustrazione in unità isometriche (1 metro in orizzontale = 1 unità). */
  larghezza: number;
  /** Semiassi del rombo di terreno che l'illustrazione occupa. */
  semiL: number;
  semiA: number;
  /** Raggio in metri entro cui nasconde gli edifici generici (0 se non indicato). */
  copre: number;
}

export function preparaLandmark(l: Landmark): LandmarkPronto {
  const m = lonLatInMetri({ lon: l.lon, lat: l.lat });
  const u = Math.min(1, Math.max(0, l.ancora[0]));
  // Il rombo è centrato sull'ancora e non esce dai bordi dell'illustrazione.
  const semiL = Math.max(0.25, Math.min(u, 1 - u)) * l.larghezzaMetri * 0.92;
  return {
    dati: l,
    x: m.x,
    y: m.y,
    sx: (m.x - m.y) * ISO_X,
    sy: -(m.x + m.y) * ISO_Y,
    larghezza: l.larghezzaMetri,
    semiL,
    semiA: semiL / 2,
    copre: typeof l.copre === 'number' && l.copre > 0 ? l.copre : 0,
  };
}

/** true se il punto (sul piano isometrico) cade nel rombo di terreno del luogo simbolo. */
export function nelRomboDi(l: LandmarkPronto, sx: number, sy: number): boolean {
  return Math.abs(sx - l.sx) / l.semiL + Math.abs(sy - l.sy) / l.semiA <= 1;
}

/** Punto dentro un anello dato come array piatto [x0, y0, x1, y1, ...], in metri. */
function dentroAnello(x: number, y: number, anello: ArrayLike<number>): boolean {
  const n = anello.length >> 1;
  let dentro = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = anello[i * 2];
    const yi = anello[i * 2 + 1];
    const xj = anello[j * 2];
    const yj = anello[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Entro quanti metri un edificio con lo stesso nome è lo stesso luogo del disegno. */
const RAGGIO_OMONIMI = 60;

function nomeSemplice(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * true se il luogo simbolo prende il posto dell'edificio, che quindi non va disegnato:
 * il centro dell'impronta cade nel rombo di terreno del disegno, oppure entro il raggio
 * `copre`, oppure l'edificio ha in OpenStreetMap lo stesso nome del luogo e gli sta
 * accanto (altrimenti il luogo comparirebbe due volte: disegnato e come casa generica).
 * `cx`, `cy` sono il centro dell'impronta in metri.
 */
export function sostituisce(l: LandmarkPronto, cx: number, cy: number, nome?: string): boolean {
  if (nelRomboDi(l, (cx - cy) * ISO_X, -(cx + cy) * ISO_Y)) return true;
  const distanza = Math.hypot(cx - l.x, cy - l.y);
  if (l.copre > 0 && distanza <= l.copre) return true;
  return (
    nome !== undefined &&
    distanza <= RAGGIO_OMONIMI &&
    nomeSemplice(nome) !== '' &&
    nomeSemplice(nome) === nomeSemplice(l.dati.nome)
  );
}

/**
 * Di quanto un segnaposto può distare dal punto d'appoggio di un luogo simbolo (in metri)
 * per essere considerato il segnaposto di quel disegno.
 */
export function raggioSegnaposto(l: LandmarkPronto): number {
  return Math.max(30, l.semiL * 1.3);
}

// --- elementi in piedi -------------------------------------------------------------

export const EL_EDIFICIO = 0;
export const EL_ALBERO = 1;
export const EL_LANDMARK = 2;

/** Tutto ciò che sta in piedi, già in ordine di disegno (dal più lontano). */
export interface Elementi {
  n: number;
  tipo: Uint8Array;
  /** Indice dentro edifici, alberi (numero dell'albero) o landmark. */
  rif: Int32Array;
  /** Chiave di profondità, decrescente. */
  chiave: Float64Array;
  /** Riquadri sul piano isometrico, altezza compresa: [minX, minY, maxX, maxY] per elemento. */
  riquadri: Float32Array;
  griglia: Griglia;
}

export interface AreaPronta {
  anello: Float32Array;
  tipo: TipoArea;
}

export interface StradaPronta {
  linea: Float32Array;
  tipo: TipoStrada;
  ponte: boolean;
}

export interface LineaPronta {
  dati: Linea;
  linea: Float32Array;
}

export interface PuntoPronto {
  dati: Punto;
  sx: number;
  sy: number;
  /**
   * Indice del luogo simbolo che racconta la stessa storia e sta nello stesso posto,
   * oppure -1. Quando quel disegno è in vista, il segnaposto non serve: c'è il nome.
   */
  landmark: number;
}

export interface Scena {
  edifici: EdificioPronto[];
  /** Riquadri delle impronte degli edifici (senza altezza), per le tessere. */
  riquadriEdifici: Float32Array;
  /** Alberi sul piano isometrico: [sx0, sy0, sx1, sy1, ...]. */
  alberi: Float32Array;
  landmark: LandmarkPronto[];
  elementi: Elementi;
  aree: AreaPronta[];
  riquadriAree: Float32Array;
  strade: StradaPronta[];
  riquadriStrade: Float32Array;
  linee: LineaPronta[];
  /** Punti degli strati, dal più lontano al più vicino. */
  punti: PuntoPronto[];
}

/** Lato delle celle della griglia e delle tessere, in unità isometriche. */
export const LATO_GRIGLIA = 160;
export const LATO_TESSERA = 420;

export function costruisciScena(base: DatiBase, strati: DatiStrati, landmark: Landmark[]): Scena {
  const luoghi = landmark.map(preparaLandmark);

  const edifici: EdificioPronto[] = [];
  const impronte: number[][] = [];
  /** Centri delle impronte in metri: [x0, y0, x1, y1, ...]. */
  const centri: number[] = [];
  for (const e of base.edifici) {
    if (!e.p || e.p.length < 6) continue;
    const pronto = preparaEdificio(e);
    // Centro dell'impronta in metri (la media dei vertici, come cx e cy sul piano).
    let mx = 0;
    let my = 0;
    const vertici = e.p.length >> 1;
    for (let i = 0; i < vertici; i++) {
      mx += e.p[i * 2];
      my += e.p[i * 2 + 1];
    }
    mx /= vertici;
    my /= vertici;
    for (let l = 0; l < luoghi.length; l++) {
      if (sostituisce(luoghi[l], mx, my, e.n)) {
        pronto.sotto = l;
        break;
      }
    }
    edifici.push(pronto);
    impronte.push(e.p);
    centri.push(mx, my);
  }
  // In OpenStreetMap un edificio può avere parti disegnate dentro la sua impronta (torri,
  // corpi più alti). Se il luogo simbolo prende il posto dell'edificio, prende anche il
  // posto delle parti il cui centro cade dentro di lui: altrimenti spunterebbero dal disegno.
  const nascosti: number[] = [];
  for (let i = 0; i < edifici.length; i++) if (edifici[i].sotto >= 0) nascosti.push(i);
  if (nascosti.length > 0) {
    const limiti = new Float32Array(nascosti.length * 4);
    nascosti.forEach((i, k) => scriviRiquadro(impronte[i], limiti, k * 4));
    for (let i = 0; i < edifici.length; i++) {
      if (edifici[i].sotto >= 0) continue;
      const x = centri[i * 2];
      const y = centri[i * 2 + 1];
      for (let k = 0; k < nascosti.length; k++) {
        if (x < limiti[k * 4] || y < limiti[k * 4 + 1] || x > limiti[k * 4 + 2] || y > limiti[k * 4 + 3]) continue;
        if (dentroAnello(x, y, impronte[nascosti[k]])) {
          edifici[i].sotto = edifici[nascosti[k]].sotto;
          break;
        }
      }
    }
  }
  const riquadriEdifici = new Float32Array(edifici.length * 4);
  for (let i = 0; i < edifici.length; i++) scriviRiquadro(edifici[i].anello, riquadriEdifici, i * 4);

  const alberi = proiettaPiatto(base.alberi ?? []);
  const nAlberi = alberi.length >> 1;

  // Chiavi di profondità di tutto ciò che sta in piedi, poi un solo ordinamento.
  const n = edifici.length + nAlberi + luoghi.length;
  const tipoGrezzo = new Uint8Array(n);
  const rifGrezzo = new Int32Array(n);
  const chiaveGrezza = new Float64Array(n);
  const riquadriGrezzi = new Float32Array(n * 4);
  let k = 0;
  for (let i = 0; i < edifici.length; i++, k++) {
    const e = edifici[i];
    tipoGrezzo[k] = EL_EDIFICIO;
    rifGrezzo[k] = i;
    chiaveGrezza[k] = profonditaImpronta(impronte[i]);
    riquadriGrezzi[k * 4] = riquadriEdifici[i * 4] - 1;
    riquadriGrezzi[k * 4 + 1] = riquadriEdifici[i * 4 + 1] - e.alt - e.colmo - 1;
    riquadriGrezzi[k * 4 + 2] = riquadriEdifici[i * 4 + 2] + 1;
    riquadriGrezzi[k * 4 + 3] = riquadriEdifici[i * 4 + 3] + 1;
  }
  for (let i = 0; i < nAlberi; i++, k++) {
    const sx = alberi[i * 2];
    const sy = alberi[i * 2 + 1];
    tipoGrezzo[k] = EL_ALBERO;
    rifGrezzo[k] = i;
    chiaveGrezza[k] = -sy / ISO_Y; // x + y
    riquadriGrezzi[k * 4] = sx - 5;
    riquadriGrezzi[k * 4 + 1] = sy - 11;
    riquadriGrezzi[k * 4 + 2] = sx + 8;
    riquadriGrezzi[k * 4 + 3] = sy + 3;
  }
  for (let i = 0; i < luoghi.length; i++, k++) {
    const l = luoghi[i];
    tipoGrezzo[k] = EL_LANDMARK;
    rifGrezzo[k] = i;
    // L'angolo più vicino del rombo di terreno.
    chiaveGrezza[k] = profondita(l.x, l.y) - l.semiA / ISO_Y;
    // Non si conosce ancora la proporzione del disegno: riquadro abbondante.
    riquadriGrezzi[k * 4] = l.sx - l.larghezza;
    riquadriGrezzi[k * 4 + 1] = l.sy - l.larghezza * 3;
    riquadriGrezzi[k * 4 + 2] = l.sx + l.larghezza;
    riquadriGrezzi[k * 4 + 3] = l.sy + l.larghezza * 3;
  }
  const ordine = ordinePerProfondita(chiaveGrezza);
  const tipo = new Uint8Array(n);
  const rif = new Int32Array(n);
  const chiave = new Float64Array(n);
  const riquadri = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const o = ordine[i];
    tipo[i] = tipoGrezzo[o];
    rif[i] = rifGrezzo[o];
    chiave[i] = chiaveGrezza[o];
    riquadri.set(riquadriGrezzi.subarray(o * 4, o * 4 + 4), i * 4);
  }
  const elementi: Elementi = {
    n,
    tipo,
    rif,
    chiave,
    riquadri,
    griglia: new Griglia(riquadri, n, LATO_GRIGLIA),
  };

  const aree: AreaPronta[] = [];
  for (const a of base.aree) {
    if (!a.p || a.p.length < 6) continue;
    // Tutte nello stesso verso: così poligoni accostati si fondono senza buchi.
    aree.push({ anello: proiettaPiatto(antiorario(a.p)), tipo: a.t });
  }
  const riquadriAree = new Float32Array(aree.length * 4);
  for (let i = 0; i < aree.length; i++) scriviRiquadro(aree[i].anello, riquadriAree, i * 4);

  const strade: StradaPronta[] = [];
  for (const s of base.strade) {
    if (!s.p || s.p.length < 4) continue;
    strade.push({ linea: proiettaPiatto(s.p), tipo: s.t, ponte: s.ponte === true });
  }
  const riquadriStrade = new Float32Array(strade.length * 4);
  for (let i = 0; i < strade.length; i++) scriviRiquadro(strade[i].linea, riquadriStrade, i * 4);

  const linee: LineaPronta[] = [];
  for (const l of strati.linee) {
    if (!l.p || l.p.length < 4) continue;
    linee.push({ dati: l, linea: proiettaPiatto(l.p) });
  }

  const chiaviPunti = strati.punti.map((p) => profondita(p.x, p.y));
  const punti: PuntoPronto[] = [];
  for (const i of ordinePerProfondita(chiaviPunti)) {
    const p = strati.punti[i];
    let sulLuogo = -1;
    if (p.storia !== undefined) {
      for (let l = 0; l < luoghi.length; l++) {
        const luogo = luoghi[l];
        if (luogo.dati.storia !== p.storia) continue;
        if (Math.hypot(p.x - luogo.x, p.y - luogo.y) <= raggioSegnaposto(luogo)) {
          sulLuogo = l;
          break;
        }
      }
    }
    punti.push({ dati: p, sx: (p.x - p.y) * ISO_X, sy: -(p.x + p.y) * ISO_Y, landmark: sulLuogo });
  }

  return {
    edifici,
    riquadriEdifici,
    alberi,
    landmark: luoghi,
    elementi,
    aree,
    riquadriAree,
    strade,
    riquadriStrade,
    linee,
    punti,
  };
}

/** Stato di visibilità degli strati. */
export type StratiVisibili = Record<IdStrato, boolean>;
