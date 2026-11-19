// Animazioni decorative della mappa: la Brenta che scorre e un treno che entra in stazione.
// Tutto è una funzione del tempo, senza stato: dopo una pausa (pagina nascosta) le cose sono
// semplicemente andate avanti. Il treno è un'illustrazione, non un treno vero: non segue gli
// orari e non dice nulla sulla posizione dei treni di Trenitalia.

import type { Area, Edificio, Strada } from '../types';

/** Un percorso lungo i binari, in metri locali. */
export interface Percorso {
  /** Punti [x0, y0, x1, y1, ...]. */
  punti: number[];
  /** Distanza dall'inizio di ogni punto, in metri. */
  cumulate: number[];
  lunghezza: number;
  /** Dove sta il nodo della stazione, in metri dall'inizio. */
  stazione: number;
}

/** Fermata della stazione di Bassano, sul binario lungo il fabbricato (metri locali). */
export const STAZIONE = { x: 537.5, y: 5 } as const;
/** Due estremi che distano meno di così sono lo stesso nodo; un estremo così vicino a un tratto lo spezza. */
const TOLLERANZA_NODI_M = 4;

interface Nodo {
  x: number;
  y: number;
  vicini: Map<number, number>;
}

function distanzaDaSegmento(px: number, py: number, ax: number, ay: number, bx: number, by: number): { d: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return { d: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t };
}

/**
 * La rete dei binari come grafo. Nei dati di OpenStreetMap i binari si incrociano a T in mezzo
 * ai tratti: ogni tratto si spezza dove cade l'estremo di un altro, entro pochi metri.
 */
export function reteBinari(strade: Strada[]): Nodo[] {
  const linee = strade.filter((s) => s.t === 'ferrovia' && Array.isArray(s.p) && s.p.length >= 4).map((s) => s.p);
  const estremi: { x: number; y: number }[] = [];
  for (const p of linee) {
    estremi.push({ x: p[0], y: p[1] }, { x: p[p.length - 2], y: p[p.length - 1] });
  }
  const nodi: Nodo[] = [];
  const nodo = (x: number, y: number): number => {
    for (let i = 0; i < nodi.length; i++) {
      if (Math.hypot(nodi[i].x - x, nodi[i].y - y) <= TOLLERANZA_NODI_M) return i;
    }
    nodi.push({ x, y, vicini: new Map() });
    return nodi.length - 1;
  };
  const collega = (a: number, b: number): void => {
    if (a === b) return;
    const d = Math.hypot(nodi[a].x - nodi[b].x, nodi[a].y - nodi[b].y);
    const prima = nodi[a].vicini.get(b);
    if (prima === undefined || d < prima) {
      nodi[a].vicini.set(b, d);
      nodi[b].vicini.set(a, d);
    }
  };
  for (const p of linee) {
    for (let k = 0; k + 3 < p.length; k += 2) {
      const ax = p[k];
      const ay = p[k + 1];
      const bx = p[k + 2];
      const by = p[k + 3];
      // I punti del tratto, compresi gli estremi di altre linee che ci cadono sopra.
      const tappe: { t: number; x: number; y: number }[] = [
        { t: 0, x: ax, y: ay },
        { t: 1, x: bx, y: by },
      ];
      for (const e of estremi) {
        const { d, t } = distanzaDaSegmento(e.x, e.y, ax, ay, bx, by);
        if (d <= TOLLERANZA_NODI_M && t > 0.001 && t < 0.999) tappe.push({ t, x: e.x, y: e.y });
      }
      tappe.sort((u, v) => u.t - v.t);
      for (let i = 0; i + 1 < tappe.length; i++) collega(nodo(tappe[i].x, tappe[i].y), nodo(tappe[i + 1].x, tappe[i + 1].y));
    }
  }
  return nodi;
}

/** Distanze e predecessori dal nodo `da` (Dijkstra semplice: i nodi sono poche centinaia). */
function cammini(nodi: Nodo[], da: number): { dist: number[]; prima: number[] } {
  const dist = nodi.map(() => Infinity);
  const prima = nodi.map(() => -1);
  const fatto = nodi.map(() => false);
  dist[da] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < nodi.length; i++) if (!fatto[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) break;
    fatto[u] = true;
    for (const [v, d] of nodi[u].vicini) {
      if (dist[u] + d < dist[v]) {
        dist[v] = dist[u] + d;
        prima[v] = u;
      }
    }
  }
  return { dist, prima };
}

/**
 * Il percorso del treno: dall'estremo più lontano a sud della stazione, attraverso la stazione,
 * fino all'estremo più lontano a nord. Gli estremi stanno sotto le nuvole del bordo, così il
 * treno esce dalle nuvole e ci rientra. null se nei dati i binari non bastano.
 */
export function percorsoTreno(strade: Strada[], stazione: { x: number; y: number } = STAZIONE): Percorso | null {
  return percorsiTreni(strade, stazione)[0] ?? null;
}

/**
 * Tutte le linee che passano per la stazione: da ognuno dei due estremi più lontani a sud
 * (le linee per Padova e per Castelfranco, nei dati di oggi) fino all'estremo più lontano a
 * nord (la Valsugana). Il primo percorso è quello della linea più lunga.
 */
export function percorsiTreni(strade: Strada[], stazione: { x: number; y: number } = STAZIONE): Percorso[] {
  const nodi = reteBinari(strade);
  if (nodi.length < 3) return [];
  let s = 0;
  for (let i = 1; i < nodi.length; i++) {
    if (Math.hypot(nodi[i].x - stazione.x, nodi[i].y - stazione.y) < Math.hypot(nodi[s].x - stazione.x, nodi[s].y - stazione.y)) s = i;
  }
  if (Math.hypot(nodi[s].x - stazione.x, nodi[s].y - stazione.y) > 150) return [];
  const { dist, prima } = cammini(nodi, s);
  const foglie = nodi.map((n, i) => i).filter((i) => nodi[i].vicini.size === 1 && dist[i] < Infinity);
  const perDistanza = (lato: (n: Nodo) => boolean): number[] =>
    foglie.filter((i) => lato(nodi[i]) && dist[i] > 800).sort((a, b) => dist[b] - dist[a]);
  const nord = perDistanza((n) => n.y > nodi[s].y + 300)[0];
  if (nord === undefined) return [];
  const verso = (da: number): number[] => {
    const elenco: number[] = [];
    for (let i = da; i >= 0; i = prima[i]) elenco.push(i);
    return elenco; // da `da` alla stazione
  };
  // Due estremi a sud contano come linee diverse solo se corrono separati per almeno 300 m
  // prima di unirsi (binari di scalo e tronchini corti non contano).
  const separata = (f: number, g: number): boolean => {
    const altra = new Set(verso(g));
    return !altra.has(f) && dist[f] - (verso(f).map((i) => dist[i]).find((d, k) => altra.has(verso(f)[k])) ?? 0) >= 300;
  };
  const sud: number[] = [];
  for (const f of perDistanza((n) => n.y < nodi[s].y - 300)) {
    if (sud.every((g) => separata(f, g))) sud.push(f);
    if (sud.length === 2) break;
  }
  return sud.map((da) => {
    const indici = [...verso(da), ...verso(nord).reverse().slice(1)];
    const punti: number[] = [];
    const cumulate: number[] = [];
    let somma = 0;
    for (let k = 0; k < indici.length; k++) {
      const n = nodi[indici[k]];
      if (k > 0) somma += Math.hypot(n.x - punti[punti.length - 2], n.y - punti[punti.length - 1]);
      punti.push(n.x, n.y);
      cumulate.push(somma);
    }
    return { punti, cumulate, lunghezza: somma, stazione: dist[da] };
  });
}

/** Un treno decorativo: la sua linea, quando parte nel ciclo e con che colori. */
export interface Treno {
  percorso: Percorso;
  /** Millisecondi aggiunti al tempo: treni diversi sono in punti diversi del loro ciclo. */
  fase: number;
  /** Durata del ciclo, uguale per tutti i treni (vedi `momentoTreno`). */
  ciclo: number;
  /** Indice della livrea nella tavolozza. */
  livrea: number;
}

/**
 * I treni della mappa: due sulla linea principale e uno sull'altra. Hanno tutti lo stesso ciclo
 * e sono sfasati di un terzo, così non sostano mai insieme sullo stesso binario; chi va in
 * versi opposti corre su un binario suo (`carrozze`), quindi non si attraversano.
 */
export function treni(strade: Strada[]): Treno[] {
  const linee = percorsiTreni(strade);
  if (linee.length === 0) return [];
  const [prima, seconda] = linee;
  const ciclo = Math.max(...linee.map(cicloTreno));
  return [
    { percorso: prima, fase: 0, ciclo, livrea: 0 },
    { percorso: seconda ?? prima, fase: ciclo / 3, ciclo, livrea: 1 },
    { percorso: prima, fase: (2 * ciclo) / 3, ciclo, livrea: 2 },
  ];
}

/** Ogni verso di marcia ha il suo binario: le carrozze stanno così di lato rispetto all'asse. */
export const SCARTO_BINARIO = 1.8;

/** Il punto a `metri` dall'inizio del percorso (limitato agli estremi). */
export function puntoLungo(p: Percorso, metri: number): { x: number; y: number } {
  const m = Math.max(0, Math.min(p.lunghezza, metri));
  let lo = 0;
  let hi = p.cumulate.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (p.cumulate[mid] <= m) lo = mid;
    else hi = mid;
  }
  const tratto = p.cumulate[hi] - p.cumulate[lo];
  const t = tratto > 0 ? (m - p.cumulate[lo]) / tratto : 0;
  return {
    x: p.punti[lo * 2] + (p.punti[hi * 2] - p.punti[lo * 2]) * t,
    y: p.punti[lo * 2 + 1] + (p.punti[hi * 2 + 1] - p.punti[lo * 2 + 1]) * t,
  };
}

// --- il treno nel tempo ------------------------------------------------------------

export const CARROZZE = 4;
/** Lunghezza di una carrozza e passo tra due carrozze, in metri. */
export const LUNGHEZZA_CARROZZA = 24;
export const PASSO_CARROZZA = 25;
/** Velocità del treno in corsa, in metri al secondo (circa 80 km/h). */
export const VELOCITA_TRENO = 22;
const VELOCITA = VELOCITA_TRENO;
const FRENATA = 350; // metri per fermarsi o ripartire
const SOSTA_MS = 20_000;
const PAUSA_MS = 25_000;

export interface MomentoTreno {
  /** Posizione della testa in metri, lungo il percorso nel verso della corsa. */
  testa: number;
  /** 1: da sud a nord; -1: da nord a sud (il percorso si legge al contrario). */
  verso: 1 | -1;
  /** true se in questo momento il treno non si muove (sosta o pausa tra due corse). */
  fermo: boolean;
  /** true se nessun treno è sulla linea (pausa tra due corse). */
  assente: boolean;
  /** Millisecondi al prossimo cambio di stato (fine sosta, inizio corsa). */
  prossimoCambio: number;
}

/**
 * Dove si ferma la testa nel verso della corsa: un poco oltre il nodo della stazione, così il
 * treno sta lungo il fabbricato.
 */
function fermataDi(p: Percorso, verso: 1 | -1): number {
  const nodo = verso === 1 ? p.stazione : p.lunghezza - p.stazione;
  return Math.min(p.lunghezza, nodo + CARROZZE * PASSO_CARROZZA * 0.5);
}

/** Durate in millisecondi delle fasi di una corsa, per un percorso dato. */
function fasi(p: Percorso, verso: 1 | -1): { arriva: number; frena: number; sosta: number; parte: number; via: number } {
  const fermata = fermataDi(p, verso);
  const fino = Math.max(0, fermata - FRENATA);
  const dopo = Math.max(0, p.lunghezza - fermata - Math.min(FRENATA, p.lunghezza - fermata));
  return {
    arriva: (fino / VELOCITA) * 1000,
    frena: ((2 * Math.min(FRENATA, fermata)) / VELOCITA) * 1000,
    sosta: SOSTA_MS,
    parte: ((2 * Math.min(FRENATA, p.lunghezza - fermata)) / VELOCITA) * 1000,
    via: (dopo / VELOCITA) * 1000 + ((CARROZZE * PASSO_CARROZZA) / VELOCITA) * 1000,
  };
}

/**
 * Dove sta il treno al tempo `ms`. Un ciclo: corsa da sud a nord con sosta in stazione, pausa,
 * corsa da nord a sud con sosta, pausa. Frenata e ripartenza sono a velocità uniformemente
 * variata, così il treno rallenta e riparte senza scatti.
 */
/** Durata in millisecondi di un ciclo intero (andata, pausa, ritorno, pausa) su un percorso. */
export function cicloTreno(p: Percorso): number {
  const corsa = (verso: 1 | -1): number => {
    const f = fasi(p, verso);
    return f.arriva + f.frena + f.sosta + f.parte + f.via;
  };
  return corsa(1) + corsa(-1) + 2 * PAUSA_MS;
}

/**
 * `ciclo`, se c'è, allunga le due pause perché il ciclo duri esattamente quanto chiesto: così
 * treni su linee lunghe diverse restano sfasati sempre allo stesso modo.
 */
export function momentoTreno(p: Percorso, ms: number, ciclo?: number): MomentoTreno {
  const corsa = (verso: 1 | -1): number => {
    const f = fasi(p, verso);
    return f.arriva + f.frena + f.sosta + f.parte + f.via;
  };
  const pausa = PAUSA_MS + Math.max(0, ((ciclo ?? 0) - cicloTreno(p)) / 2);
  const durate = [corsa(1), pausa, corsa(-1), pausa];
  const totale = durate.reduce((a, b) => a + b, 0);
  let t = ((ms % totale) + totale) % totale;
  let fase = 0;
  while (t >= durate[fase]) {
    t -= durate[fase];
    fase++;
  }
  if (fase === 1 || fase === 3) {
    return { testa: 0, verso: 1, fermo: true, assente: true, prossimoCambio: durate[fase] - t };
  }
  const verso: 1 | -1 = fase === 0 ? 1 : -1;
  const f = fasi(p, verso);
  const fermata = fermataDi(p, verso);
  const v = VELOCITA / 1000; // metri al millisecondo
  const inizioFrenata = Math.max(0, fermata - FRENATA);
  const lunghezzaFrenata = fermata - inizioFrenata;
  const lunghezzaPartenza = Math.min(FRENATA, p.lunghezza - fermata);
  let testa: number;
  let fermo = false;
  let prossimoCambio = 0;
  if (t < f.arriva) {
    testa = v * t;
  } else if ((t -= f.arriva) < f.frena) {
    // Da velocità v a zero sulla lunghezza di frenata.
    const u = f.frena > 0 ? t / f.frena : 1;
    testa = inizioFrenata + lunghezzaFrenata * (1 - (1 - u) * (1 - u));
  } else if ((t -= f.frena) < f.sosta) {
    testa = fermata;
    fermo = true;
    prossimoCambio = f.sosta - t;
  } else if ((t -= f.sosta) < f.parte) {
    const u = f.parte > 0 ? t / f.parte : 1;
    testa = fermata + lunghezzaPartenza * u * u;
  } else {
    t -= f.parte;
    testa = fermata + lunghezzaPartenza + v * t;
  }
  return { testa, verso, fermo, assente: false, prossimoCambio };
}

/** Un istante a metà della prima sosta in stazione. */
export function istanteInSosta(p: Percorso): number {
  const f = fasi(p, 1);
  return f.arriva + f.frena + f.sosta / 2;
}

/**
 * La posa del treno quando la mappa è ferma: in arrivo, sul binario aperto a sud della
 * stazione, dove nessuna pensilina lo copre.
 */
export function istanteFermo(p: Percorso): number {
  const f = fasi(p, 1);
  return Math.max(0, f.arriva - 8000);
}

/** Una carrozza: testa e coda in metri locali, sul binario. */
export interface Carrozza {
  testa: { x: number; y: number };
  coda: { x: number; y: number };
}

/** Le carrozze del treno in questo momento (quelle già entrate sulla linea e non ancora uscite). */
export function carrozze(p: Percorso, m: MomentoTreno): Carrozza[] {
  if (m.assente) return [];
  const elenco: Carrozza[] = [];
  const lungo = (metri: number): { x: number; y: number } => puntoLungo(p, m.verso === 1 ? metri : p.lunghezza - metri);
  for (let k = 0; k < CARROZZE; k++) {
    const davanti = m.testa - k * PASSO_CARROZZA;
    const dietro = davanti - LUNGHEZZA_CARROZZA;
    if (dietro < 0 || davanti > p.lunghezza) continue;
    const testa = lungo(davanti);
    const coda = lungo(dietro);
    // In Italia i treni tengono la sinistra: il binario di ogni verso sta alla sua sinistra.
    const dx = testa.x - coda.x;
    const dy = testa.y - coda.y;
    const l = Math.hypot(dx, dy) || 1;
    const ox = (-dy / l) * SCARTO_BINARIO;
    const oy = (dx / l) * SCARTO_BINARIO;
    elenco.push({ testa: { x: testa.x + ox, y: testa.y + oy }, coda: { x: coda.x + ox, y: coda.y + oy } });
  }
  return elenco;
}

// --- la Brenta ---------------------------------------------------------------------

/**
 * Quanto si spostano le increspature lungo la corrente, in unità isometriche, al tempo `ms`.
 * La tessera delle increspature copre 36 x 18 unità e si ripete: spostarla di una frazione
 * k di (36, 18) torna su sé stessa senza stacchi. (36, 18) sul piano sono circa 51 m verso
 * sud, cioè il verso della corrente davanti al Ponte Vecchio.
 */
export const PERIODO_CORRENTE_MS = 24_000;
export function spostamentoCorrente(ms: number): { dx: number; dy: number } {
  const k = (((ms / PERIODO_CORRENTE_MS) % 1) + 1) % 1;
  return { dx: 36 * k, dy: 18 * k };
}

/**
 * I filoni della corrente: la stessa tessera delle increspature ingrandita, in due strati a
 * grandezza e velocità diverse, perché la Brenta si veda scorrere anche da lontano. Lo
 * spostamento di ogni strato si ripete ogni (36, 18) x scala unità isometriche.
 */
export const FILONI = [
  { scala: 3.2, periodo: 7_000, alfa: 1 },
  { scala: 1.9, periodo: 4_500, alfa: 0.75 },
] as const;
export function spostamentoFiloni(ms: number, scala: number, periodo: number): { dx: number; dy: number } {
  const k = (((ms / periodo) % 1) + 1) % 1;
  return { dx: 36 * scala * k, dy: 18 * scala * k };
}

// --- figurine nelle piazze ---------------------------------------------------------

/** Un numero tra 0 e 1 che dipende solo dai due interi: sempre lo stesso a ogni avvio. */
function caso(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

function dentro(x: number, y: number, p: ArrayLike<number>): boolean {
  let d = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i];
    const yi = p[i + 1];
    const xj = p[j];
    const yj = p[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

function distanzaDalBordo(x: number, y: number, p: ArrayLike<number>): number {
  let m = Infinity;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    m = Math.min(m, distanzaDaSegmento(x, y, p[j], p[j + 1], p[i], p[i + 1]).d);
  }
  return m;
}

/** Una persona che va avanti e indietro tra due punti di una piazza, con una sosta ai capi. */
export interface Passeggiata {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Metri al secondo. */
  velocita: number;
  /** Sfasamento in millisecondi, perché non partano tutte insieme. */
  fase: number;
  /** Quale colore di vestito (indice nella tavolozza). */
  colore: number;
}

/** Entro questa distanza dal centro le piazze hanno gente (metri). */
const RAGGIO_PIAZZE = 700;
const SOSTA_PASSEGGIATA_MS = 4000;

/**
 * Le passeggiate nelle piazze del centro, calcolate una volta sola e sempre uguali. Ogni
 * tragitto sta dentro la piazza, ad almeno un metro e mezzo dal bordo, e non attraversa case.
 */
export function passeggiate(aree: Area[], edifici: Edificio[]): Passeggiata[] {
  const elenco: Passeggiata[] = [];
  aree.forEach((a, n) => {
    if (a.t !== 'piazza' || !Array.isArray(a.p) || a.p.length < 6) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let doppia = 0;
    for (let i = 0, j = a.p.length - 2; i < a.p.length; j = i, i += 2) {
      minX = Math.min(minX, a.p[i]);
      maxX = Math.max(maxX, a.p[i]);
      minY = Math.min(minY, a.p[i + 1]);
      maxY = Math.max(maxY, a.p[i + 1]);
      doppia += a.p[j] * a.p[i + 1] - a.p[i] * a.p[j + 1];
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    if (Math.hypot(cx, cy) > RAGGIO_PIAZZE) return;
    const superficie = Math.abs(doppia) / 2;
    const quante = Math.max(2, Math.min(28, Math.round(superficie / 110)));
    const case_ = edifici.filter((e) => {
      for (let i = 0; i < e.p.length; i += 2) {
        if (e.p[i] >= minX - 2 && e.p[i] <= maxX + 2 && e.p[i + 1] >= minY - 2 && e.p[i + 1] <= maxY + 2) return true;
      }
      return false;
    });
    // Né appena davanti a una facciata (una casa entro 4 m alle spalle, verso nord-est): lì la
    // pittura per profondità, che guarda l'angolo più vicino della casa, la dipingerebbe sopra.
    const libero = (x: number, y: number): boolean =>
      dentro(x, y, a.p) &&
      distanzaDalBordo(x, y, a.p) >= 1.5 &&
      case_.every(
        (e) =>
          !dentro(x, y, e.p) &&
          distanzaDalBordo(x, y, e.p) >= 1 &&
          [1, 2, 3, 4].every((d) => !dentro(x + d * 0.7071, y + d * 0.7071, e.p)),
      );
    let tentativo = 0;
    let fatte = 0;
    while (fatte < quante && tentativo < quante * 40) {
      tentativo++;
      const ax = minX + caso(n, tentativo * 4) * (maxX - minX);
      const ay = minY + caso(n, tentativo * 4 + 1) * (maxY - minY);
      const bx = minX + caso(n, tentativo * 4 + 2) * (maxX - minX);
      const by = minY + caso(n, tentativo * 4 + 3) * (maxY - minY);
      const l = Math.hypot(bx - ax, by - ay);
      if (l < 8 || l > 45) continue;
      let buono = true;
      for (let k = 0; k <= Math.ceil(l); k++) {
        const t = k / Math.ceil(l);
        if (!libero(ax + (bx - ax) * t, ay + (by - ay) * t)) {
          buono = false;
          break;
        }
      }
      if (!buono) continue;
      elenco.push({
        ax, ay, bx, by,
        velocita: 1.0 + 0.4 * caso(n + 101, tentativo),
        fase: caso(n + 202, tentativo) * 60_000,
        colore: Math.floor(caso(n + 303, tentativo) * 1000),
      });
      fatte++;
    }
  });
  return elenco;
}

/** Dove sta una persona al tempo `ms`, verso dove guarda e se sta camminando. */
export function passoDi(p: Passeggiata, ms: number): { x: number; y: number; cammina: boolean; verso: number } {
  const l = Math.hypot(p.bx - p.ax, p.by - p.ay);
  const andata = (l / p.velocita) * 1000;
  const ciclo = 2 * andata + 2 * SOSTA_PASSEGGIATA_MS;
  let t = (((ms + p.fase) % ciclo) + ciclo) % ciclo;
  let u: number;
  let cammina = true;
  let verso = 1;
  if (t < andata) u = t / andata;
  else if ((t -= andata) < SOSTA_PASSEGGIATA_MS) {
    u = 1;
    cammina = false;
  } else if ((t -= SOSTA_PASSEGGIATA_MS) < andata) {
    u = 1 - t / andata;
    verso = -1;
  } else {
    u = 0;
    cammina = false;
    verso = -1;
  }
  return { x: p.ax + (p.bx - p.ax) * u, y: p.ay + (p.by - p.ay) * u, cammina, verso };
}

// --- figurine sul Ponte Vecchio ----------------------------------------------------

/**
 * Le misure del ponte come le usa il suo generatore (scripts/landmark/luoghi/ponte-vecchio.mjs):
 * asse a 91,8 gradi da nord, lungo 74 m, mezza larghezza 4,3 m, impalcato a 5,2 m. `s` corre
 * lungo l'asse verso est, `t` di traverso verso sud, a partire dal punto d'appoggio.
 */
export const PONTE = {
  angolo: 91.8,
  lunghezza: 74,
  mezzaLarghezza: 4.3,
  piano: 5.2,
  /** Fra queste quote, sulla facciata sud, tra una colonna e l'altra si vede dentro il ponte. */
  vuoto: { da: 6.54, a: 9.46 },
};

/** Le colonne della facciata sud del ponte, lungo l'asse (metri), come nel generatore. */
export function colonnePonte(): number[] {
  const campata = (34.5 - -27.5) / 5;
  const col: number[] = [];
  for (let k = -3; k <= 20; k++) col.push(-27.5 + (k * campata) / 4);
  col[0] = -PONTE.lunghezza / 2 + 0.32;
  col.push(PONTE.lunghezza / 2 - 0.32);
  return col;
}

/** Da coordinate del ponte (s lungo l'asse, t di traverso) a metri locali. */
export function suPonte(appoggio: { x: number; y: number }, s: number, t: number): { x: number; y: number } {
  const a = (PONTE.angolo * Math.PI) / 180;
  return {
    x: appoggio.x + Math.sin(a) * s + Math.cos(a) * t,
    y: appoggio.y + Math.cos(a) * s - Math.sin(a) * t,
  };
}

/** Chi attraversa il ponte: `t` è la corsia, `fase` e `velocita` come nelle piazze. */
export const PASSANTI_PONTE: { t: number; velocita: number; fase: number; colore: number }[] = [
  // Corsie vicine alla facciata sud: nelle aperture tra le colonne si vede la persona intera.
  { t: 3.5, velocita: 1.2, fase: 0, colore: 1 },
  { t: 3.3, velocita: 1.05, fase: 17_000, colore: 4 },
  { t: 3.65, velocita: 1.35, fase: 41_000, colore: 2 },
  { t: 3.8, velocita: 1.15, fase: 63_000, colore: 6 },
  { t: 3.2, velocita: 1.25, fase: 88_000, colore: 3 },
];

/** Dove sta sul ponte un passante al tempo `ms`: va da un capo all'altro e torna. */
export function passanteSulPonte(p: { t: number; velocita: number; fase: number }, ms: number): { s: number; cammina: boolean } {
  const l = PONTE.lunghezza - 6;
  const andata = (l / p.velocita) * 1000;
  const ciclo = 2 * andata;
  const t = (((ms + p.fase) % ciclo) + ciclo) % ciclo;
  const u = t < andata ? t / andata : 1 - (t - andata) / andata;
  return { s: -l / 2 + l * u, cammina: true };
}

// --- macchine sulle strade ---------------------------------------------------------

/** Un tratto di strada percorso dalle macchine: punti in metri e distanze cumulate. */
export interface Corsia {
  punti: number[];
  cumulate: number[];
  lunghezza: number;
  /** Di quanto la macchina sta a destra dell'asse della strada (metri): meno nelle vie strette. */
  scarto: number;
}

/** Una macchina: su quale corsia, in che verso, quanto veloce, quando, di che colore. */
export interface Macchina {
  corsia: number;
  verso: 1 | -1;
  velocita: number;
  fase: number;
  /** Sosta dopo la corsa, prima di ricomparire (millisecondi). */
  pausa: number;
  colore: number;
}

/** Lunghezza di una macchina, in metri. */
export const LUNGHEZZA_MACCHINA = 5.4;
/** Distanza dall'asse della strada (si tiene la destra), per tipo di strada. */
export const SCARTO_MACCHINA = { principale: 1.9, secondaria: 1.4, locale: 0.9 } as const;

/**
 * Le strade con le macchine: principali e secondarie entro 1,5 km dal centro (almeno 80 m),
 * strade locali entro 700 m (almeno 100 m). Le pedonali e la ferrovia no. Si scartano i tratti
 * dove una macchina finirebbe dentro una casa (vie strette, passaggi coperti) o troppo vicino a
 * una fontana disegnata.
 */
export function corsie(strade: Strada[], edifici: Edificio[] = [], fontane: Fontana[] = []): Corsia[] {
  const elenco: Corsia[] = [];
  // Le case per celle di 50 m, per controllare in fretta i punti lungo le strade.
  const CELLA = 50;
  const celle = new Map<number, Edificio[]>();
  const chiave = (i: number, j: number): number => i * 100003 + j;
  for (const e of edifici) {
    if (!Array.isArray(e.p) || e.p.length < 6) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let k = 0; k < e.p.length; k += 2) {
      minX = Math.min(minX, e.p[k]);
      maxX = Math.max(maxX, e.p[k]);
      minY = Math.min(minY, e.p[k + 1]);
      maxY = Math.max(maxY, e.p[k + 1]);
    }
    for (let i = Math.floor(minX / CELLA); i <= Math.floor(maxX / CELLA); i++) {
      for (let j = Math.floor(minY / CELLA); j <= Math.floor(maxY / CELLA); j++) {
        const k = chiave(i, j);
        const lista = celle.get(k);
        if (lista) lista.push(e);
        else celle.set(k, [e]);
      }
    }
  }
  const inCasa = (x: number, y: number): boolean =>
    (celle.get(chiave(Math.floor(x / CELLA), Math.floor(y / CELLA))) ?? []).some((e) => dentro(x, y, e.p));
  for (const s of strade) {
    if (!Array.isArray(s.p) || s.p.length < 4) continue;
    const grande = s.t === 'principale' || s.t === 'secondaria';
    if (!grande && s.t !== 'locale') continue;
    const raggio = grande ? 1500 : 700;
    const minimo = grande ? 80 : 100;
    let vicina = false;
    for (let i = 0; i < s.p.length; i += 2) if (Math.hypot(s.p[i], s.p[i + 1]) < raggio) vicina = true;
    if (!vicina) continue;
    const cumulate = [0];
    for (let i = 2; i < s.p.length; i += 2) cumulate.push(cumulate[cumulate.length - 1] + Math.hypot(s.p[i] - s.p[i - 2], s.p[i + 1] - s.p[i - 1]));
    const lunghezza = cumulate[cumulate.length - 1];
    if (lunghezza < minimo) continue;
    const scarto = SCARTO_MACCHINA[s.t as keyof typeof SCARTO_MACCHINA];
    // La macchina, nei due versi, con il suo fianco esterno: nessun punto dentro una casa.
    const esterno = scarto + 1.15;
    let libera = true;
    for (let i = 2; i < s.p.length && libera; i += 2) {
      const ax = s.p[i - 2];
      const ay = s.p[i - 1];
      const dx = s.p[i] - ax;
      const dy = s.p[i + 1] - ay;
      const l = Math.hypot(dx, dy) || 1;
      const nx = dy / l;
      const ny = -dx / l;
      for (let d = 0; d <= l && libera; d += 1.5) {
        const x = ax + (dx / l) * d;
        const y = ay + (dy / l) * d;
        if (fontane.some((f) => Math.hypot(x - f.x, y - f.y) < f.raggio + 6)) libera = false;
        for (const lato of [scarto, -scarto, esterno, -esterno]) if (inCasa(x + nx * lato, y + ny * lato)) libera = false;
      }
    }
    if (!libera) continue;
    elenco.push({ punti: s.p, cumulate, lunghezza, scarto });
  }
  return elenco;
}

/**
 * Le macchine: circa una ogni 90 m di strada, in tutti e due i versi, sempre le stesse. Sulla
 * stessa corsia e nello stesso verso vanno tutte alla stessa velocità, a distanza regolare:
 * così non si raggiungono.
 */
export function macchine(elenco: Corsia[]): Macchina[] {
  const tutte: Macchina[] = [];
  elenco.forEach((c, n) => {
    const quante = Math.max(1, Math.round(c.lunghezza / 90));
    for (const verso of [1, -1] as const) {
      const v = verso === 1 ? 0 : 1;
      const qui = Math.ceil(quante / 2) - (verso === -1 && quante % 2 === 1 ? 1 : 0);
      if (qui <= 0) continue;
      const velocita = 8 + 5 * caso(n + 7001, v);
      const pausa = 1500 + 6000 * caso(n + 7003, v);
      const ciclo = ((c.lunghezza + LUNGHEZZA_MACCHINA) / velocita) * 1000 + pausa;
      const inizio = caso(n + 7002, v) * ciclo;
      for (let k = 0; k < qui; k++) {
        tutte.push({
          corsia: n,
          verso,
          velocita,
          fase: inizio + (k / qui) * ciclo,
          pausa,
          colore: Math.floor(caso(n + 7004, k * 2 + v) * 1000),
        });
      }
    }
  });
  return tutte;
}

/** Un punto della corsia a `metri` dall'inizio; oltre i capi si prolunga il primo o l'ultimo tratto. */
function lungoCorsia(c: Corsia, metri: number): { x: number; y: number } {
  const n = c.cumulate.length - 1;
  let lo = 0;
  let hi = n;
  if (metri <= 0) hi = 1;
  else if (metri >= c.lunghezza) lo = n - 1;
  else {
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (c.cumulate[mid] <= metri) lo = mid;
      else hi = mid;
    }
  }
  const ax = c.punti[lo * 2];
  const ay = c.punti[lo * 2 + 1];
  const bx = c.punti[hi * 2];
  const by = c.punti[hi * 2 + 1];
  const tratto = c.cumulate[hi] - c.cumulate[lo];
  const t = tratto > 0 ? (metri - c.cumulate[lo]) / tratto : 0;
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
}

/**
 * Dove sta una macchina al tempo `ms`: coda e testa in metri, già spostate sulla destra della
 * strada nel suo verso. Entra ed esce intera, oltre i capi del tratto. null durante la pausa.
 */
export function macchinaDi(
  m: Macchina,
  c: Corsia,
  ms: number,
): { coda: { x: number; y: number }; testa: { x: number; y: number } } | null {
  const corsa = ((c.lunghezza + LUNGHEZZA_MACCHINA) / m.velocita) * 1000;
  const ciclo = corsa + m.pausa;
  const t = (((ms + m.fase) % ciclo) + ciclo) % ciclo;
  if (t >= corsa) return null;
  const davanti = (t / 1000) * m.velocita;
  const dietro = davanti - LUNGHEZZA_MACCHINA;
  const su = (metri: number) => lungoCorsia(c, m.verso === 1 ? metri : c.lunghezza - metri);
  const a = su(dietro);
  const b = su(davanti);
  // La destra del verso di marcia: (dy, -dx).
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  const ox = (dy / l) * c.scarto;
  const oy = (-dx / l) * c.scarto;
  return { coda: { x: a.x + ox, y: a.y + oy }, testa: { x: b.x + ox, y: b.y + oy } };
}

// --- gente nelle vie pedonali del centro storico -------------------------------------

/** Entro questa distanza dal centro le vie pedonali hanno gente (metri). */
const RAGGIO_VIE = 500;

/**
 * Passeggiate lungo le vie pedonali del centro storico: su ogni tratto dritto lungo almeno
 * 12 m, una persona ogni 22 m circa (al più tre), un poco di lato rispetto al centro della via.
 */
export function passeggiateNelleVie(strade: Strada[], edifici: Edificio[] = []): Passeggiata[] {
  const elenco: Passeggiata[] = [];
  const vicine = edifici.filter((e) => {
    for (let i = 0; i < e.p.length; i += 2) if (Math.hypot(e.p[i], e.p[i + 1]) < RAGGIO_VIE + 60) return true;
    return false;
  });
  strade.forEach((s, n) => {
    if (s.t !== 'pedonale' || s.ponte || !Array.isArray(s.p) || s.p.length < 4) return;
    for (let i = 2; i < s.p.length; i += 2) {
      const ax = s.p[i - 2];
      const ay = s.p[i - 1];
      const bx = s.p[i];
      const by = s.p[i + 1];
      if (Math.hypot((ax + bx) / 2, (ay + by) / 2) > RAGGIO_VIE) continue;
      const l = Math.hypot(bx - ax, by - ay);
      if (l < 12) continue;
      const quante = Math.min(3, Math.max(1, Math.round(l / 22)));
      const ux = (bx - ax) / l;
      const uy = (by - ay) / l;
      // Le case che toccano il riquadro di questo tratto, per non far entrare la gente nei muri.
      const minX = Math.min(ax, bx) - 3;
      const maxX = Math.max(ax, bx) + 3;
      const minY = Math.min(ay, by) - 3;
      const maxY = Math.max(ay, by) + 3;
      const qui = vicine.filter((e) => {
        for (let q = 0; q < e.p.length; q += 2) if (e.p[q] >= minX && e.p[q] <= maxX && e.p[q + 1] >= minY && e.p[q + 1] <= maxY) return true;
        return false;
      });
      for (let k = 0; k < quante; k++) {
        const lato = (caso(n * 31 + i, k) - 0.5) * 1.6;
        const tappa = {
          ax: ax + ux * l * 0.1 - uy * lato,
          ay: ay + uy * l * 0.1 + ux * lato,
          bx: ax + ux * l * 0.9 - uy * lato,
          by: ay + uy * l * 0.9 + ux * lato,
        };
        let libera = true;
        for (let d = 0; d <= 1.0001 && libera; d += 1 / Math.ceil(l)) {
          const x = tappa.ax + (tappa.bx - tappa.ax) * d;
          const y = tappa.ay + (tappa.by - tappa.ay) * d;
          if (qui.some((e) => dentro(x, y, e.p))) libera = false;
        }
        if (!libera) continue;
        elenco.push({
          ...tappa,
          velocita: 0.9 + 0.5 * caso(n * 31 + i + 1, k),
          fase: caso(n * 31 + i + 2, k) * 60_000,
          colore: Math.floor(caso(n * 31 + i + 3, k) * 1000),
        });
      }
    }
  });
  return elenco;
}

// --- fontane -----------------------------------------------------------------------

/**
 * Una fontana disegnata: gradinata rotonda, vasca grande, colonna con una vasca piccola e
 * zampilli, come la Fontana Bonaguro di Piazza Garibaldi nella xilografia del 1901.
 */
export interface Fontana {
  x: number;
  y: number;
  /** Raggio del gradino più basso, in metri. */
  raggio: number;
}

/** Chi sta attorno a una fontana: chi gira piano attorno alla vasca e chi è fermo sul bordo. */
export interface AllaFontana {
  fontana: number;
  raggio: number;
  /** Radianti al secondo: 0 per chi sta fermo. */
  giro: number;
  angolo: number;
  colore: number;
}

export function genteAllaFontana(fontane: Fontana[], edifici: Edificio[] = []): AllaFontana[] {
  const elenco: AllaFontana[] = [];
  fontane.forEach((f, n) => {
    const vicine = edifici.filter((e) => {
      for (let i = 0; i < e.p.length; i += 2) if (Math.hypot(e.p[i] - f.x, e.p[i + 1] - f.y) < f.raggio + 30) return true;
      return false;
    });
    // Un giro attorno alla fontana va bene solo se nessun suo punto (né un metro più in là) cade in una casa.
    const giroLibero = (r: number): boolean => {
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        for (const d of [0, 1]) {
          const x = f.x + Math.cos(a) * (r + d);
          const y = f.y + Math.sin(a) * (r + d);
          if (vicine.some((e) => dentro(x, y, e.p))) return false;
        }
      }
      return true;
    };
    for (let k = 0; k < 12; k++) {
      const fermo = k < 5;
      let raggio = fermo ? f.raggio - 0.3 : f.raggio + 1.2 + 2.5 * caso(n + 9001, k);
      if (!fermo && !giroLibero(raggio)) raggio = f.raggio + 1.2;
      if (!fermo && !giroLibero(raggio)) continue;
      elenco.push({
        fontana: n,
        raggio,
        giro: fermo ? 0 : (caso(n + 9002, k) < 0.5 ? -1 : 1) * (0.05 + 0.06 * caso(n + 9003, k)),
        angolo: caso(n + 9004, k) * Math.PI * 2,
        colore: Math.floor(caso(n + 9005, k) * 1000),
      });
    }
  });
  return elenco;
}

/** Dove sta al tempo `ms` chi è attorno alla fontana. */
export function allaFontanaDi(p: AllaFontana, f: Fontana, ms: number): { x: number; y: number; cammina: boolean } {
  const a = p.angolo + p.giro * (ms / 1000);
  return { x: f.x + Math.cos(a) * p.raggio, y: f.y + Math.sin(a) * p.raggio, cammina: p.giro !== 0 };
}
