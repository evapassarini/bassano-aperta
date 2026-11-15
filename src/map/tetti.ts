// Geometria dei tetti: dall'impronta di un edificio (in metri) alle facce del suo tetto.
// Funzioni pure, senza DOM e senza caso: stessa impronta e stesso seme, stesso tetto.
// Regola che vale per tutte le forme: nessuna faccia esce dall'impronta. Se un metodo non
// regge su una pianta difficile si passa a quello più semplice, fino al tetto piano.

import type { TipoEdificio } from '../types';

/** Forma del tetto. */
export const TETTO_PIANO = 0;
/** A falde: due falde con i timpani, padiglione, oppure a gradoni rientrati. */
export const TETTO_FALDE = 1;
/** Capannone: piano, con le fasce chiare dei lucernari. */
export const TETTO_CAPANNONE = 2;
/** Condominio moderno: piano, con il parapetto tutto attorno. */
export const TETTO_TERRAZZA = 3;

/** Classe di una faccia: decide il tono con cui si dipinge. */
export const FALDA_MEDIA = 0;
export const FALDA_LUCE = 1;
export const FALDA_OMBRA = 2;
/** Triangolo di muro sotto le due falde, sul lato corto. In scena diventa sinistro o destro. */
export const TIMPANO = 3;
export const TIMPANO_SINISTRO = 3;
export const TIMPANO_DESTRO = 4;
/** Fascia chiara su un tetto piano (lucernario di un capannone). */
export const FASCIA = 5;
/** Il piano di una terrazza, dentro il parapetto. */
export const INTERNO = 6;
/** Il piano in cima a un tetto a gradoni, dove le falde non possono più salire. */
export const CAPPELLO = 7;
/**
 * Segno in più sulla classe di una falda (classe | GRADONE): è una fascia di un tetto a gradoni.
 * Il suo lato interno non è uno spigolo vero, la falda continua nel gradone sopra: non si traccia.
 */
export const GRADONE = 16;
/**
 * Segno in più (classe | COLMO_FINTO): metà di un piano dipinto come un tetto a due falde molto
 * basso. La faccia è piana; il suo primo lato è il colmo, che si traccia come uno spigolo.
 */
export const COLMO_FINTO = 32;
/** Toglie i segni in più e lascia la classe. */
export const MASCHERA_CLASSE = 15;

export interface TettoInMetri {
  forma: number;
  /** Una faccia per voce: [x0, y0, z0, x1, y1, z1, ...]; z è il rialzo sopra la gronda. */
  facce: number[][];
  /** Classe di ogni faccia (FALDA_*, TIMPANO, FASCIA, INTERNO, CAPPELLO), con GRADONE se serve. */
  classi: number[];
  /**
   * Per ogni faccia tre numeri: direzione in cui la falda sale, in pianta (lunga 1), e
   * pendenza. Tre zeri per le facce che non sono falde. Le falde cominciano dal lato di gronda.
   */
  salite: number[];
  /** Altezza del punto più alto sopra la gronda, in metri. */
  rialzo: number;
}

export interface OpzioniTetto {
  tipo: TipoEdificio;
  /** Numero stabile dell'edificio: sceglie tra due falde e padiglione, e la pendenza. */
  seme: number;
  /** Altezza dell'edificio in metri. */
  altezza: number;
  /** Distanza dal centro della città in metri: in periferia ci sono più tetti piani. */
  distanza: number;
  /** Se indicato, il tetto non sale più di così (edifici tenuti bassi). */
  rialzoMassimo?: number;
}

const EPS = 1e-7;

function areaAnello(q: ArrayLike<number>): number {
  const n = q.length & ~1;
  let a = 0;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    a += q[i] * q[j + 1] - q[j] * q[i + 1];
  }
  return a / 2;
}

/**
 * Toglie da un anello i vertici che non cambiano la forma: doppioni, lati cortissimi, punti
 * allineati (entro `tolleranza` metri) e punte ripiegate più sottili di `punta`. Restituisce []
 * se non resta un poligono.
 */
export function semplificaAnello(
  p: ArrayLike<number>,
  tolleranza = 0.1,
  corto = 0.12,
  punta = corto,
): number[] {
  const q: number[] = [];
  const n = p.length & ~1;
  for (let i = 0; i < n; i += 2) {
    if (Number.isFinite(p[i]) && Number.isFinite(p[i + 1])) q.push(p[i], p[i + 1]);
  }
  let cambiato = true;
  let giri = 0;
  while (cambiato && q.length >= 6 && giri++ < 40) {
    cambiato = false;
    for (let i = 0; i < q.length >> 1 && q.length >= 6; ) {
      const m = q.length >> 1;
      const a = ((i + m - 1) % m) * 2;
      const b = i * 2;
      const c = ((i + 1) % m) * 2;
      const abx = q[b] - q[a];
      const aby = q[b + 1] - q[a + 1];
      const acx = q[c] - q[a];
      const acy = q[c + 1] - q[a + 1];
      const lac = Math.hypot(acx, acy);
      const lab = Math.hypot(abx, aby);
      let via = lab < corto || lac < corto;
      if (!via) {
        const t = Math.max(0, Math.min(1, (abx * acx + aby * acy) / (lac * lac)));
        via = Math.hypot(abx - t * acx, aby - t * acy) < tolleranza;
      }
      if (!via) {
        // Punta ripiegata: i due lati tornano indietro quasi sovrapposti. Conta lo spessore
        // all'altezza del lato più corto.
        const bcx = q[c] - q[b];
        const bcy = q[c + 1] - q[b + 1];
        const lbc = Math.hypot(bcx, bcy);
        if (-(abx * bcx + aby * bcy) > 0.97 * lab * lbc) {
          const spessore = Math.abs(abx * bcy - aby * bcx) / Math.max(lab, lbc);
          via = spessore < punta;
        }
      }
      if (via) {
        q.splice(b, 2);
        cambiato = true;
      } else i++;
    }
  }
  return q.length >= 6 ? q : [];
}

/** true se l'anello (antiorario) non ha rientranze. */
function senzaRientranze(q: number[]): boolean {
  const n = q.length >> 1;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const k = (i + 2) % n;
    const giro =
      (q[j * 2] - q[i * 2]) * (q[k * 2 + 1] - q[j * 2 + 1]) -
      (q[j * 2 + 1] - q[i * 2 + 1]) * (q[k * 2] - q[j * 2]);
    if (giro < -1e-6) return false;
  }
  return true;
}

/** Tiene la parte del poligono dove a*x + b*y + c >= 0. */
function taglia(poli: number[], a: number, b: number, c: number): number[] {
  const n = poli.length >> 1;
  const u: number[] = [];
  if (n === 0) return u;
  let px = poli[(n - 1) * 2];
  let py = poli[(n - 1) * 2 + 1];
  let pv = a * px + b * py + c;
  for (let i = 0; i < n; i++) {
    const x = poli[i * 2];
    const y = poli[i * 2 + 1];
    const v = a * x + b * y + c;
    if (v >= -EPS) {
      if (pv < -EPS) {
        const t = pv / (pv - v);
        u.push(px + (x - px) * t, py + (y - py) * t);
      }
      u.push(x, y);
    } else if (pv >= -EPS) {
      const t = pv / (pv - v);
      u.push(px + (x - px) * t, py + (y - py) * t);
    }
    px = x;
    py = y;
    pv = v;
  }
  return u;
}

/** Toglie i punti consecutivi che coincidono. */
function senzaDoppi(q: number[]): number[] {
  const u: number[] = [];
  const n = q.length >> 1;
  for (let i = 0; i < n; i++) {
    const j = (i + n - 1) % n;
    if (Math.abs(q[i * 2] - q[j * 2]) + Math.abs(q[i * 2 + 1] - q[j * 2 + 1]) > 1e-4) {
      u.push(q[i * 2], q[i * 2 + 1]);
    }
  }
  return u;
}

function dentro(x: number, y: number, q: ArrayLike<number>): boolean {
  const n = q.length >> 1;
  let si = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = q[i * 2];
    const yi = q[i * 2 + 1];
    const xj = q[j * 2];
    const yj = q[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) si = !si;
  }
  return si;
}

function distanzaDalSegmento(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/** Distanza di un punto dal bordo di un anello. */
export function distanzaDalBordo(x: number, y: number, q: ArrayLike<number>): number {
  const n = q.length >> 1;
  let min = Infinity;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const d = distanzaDalSegmento(x, y, q[i * 2], q[i * 2 + 1], q[j * 2], q[j * 2 + 1]);
    if (d < min) min = d;
  }
  return min;
}

/** true se il punto sta nell'anello o a meno di `tolleranza` metri dal suo bordo. */
export function dentroOSulBordo(x: number, y: number, q: ArrayLike<number>, tolleranza: number): boolean {
  return dentro(x, y, q) || distanzaDalBordo(x, y, q) <= tolleranza;
}

function siIncrociano(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * Sposta ogni lato dell'anello verso l'interno di `d` metri. Restituisce null se il risultato
 * non è più un poligono buono: un lato si è rovesciato, due parti si toccano, un vertice è
 * uscito o sta troppo vicino al bordo di partenza. Con `giaMisurato` salta il controllo delle
 * distanze dal bordo: lo usa chi ha già calcolato che a quel rientro nessun vertice lo tocca.
 */
export function rientra(q: number[], d: number, giaMisurato = false): number[] | null {
  const n = q.length >> 1;
  if (n < 3 || !(d > 0)) return null;
  const nx = new Array<number>(n);
  const ny = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ex = q[j * 2] - q[i * 2];
    const ey = q[j * 2 + 1] - q[i * 2 + 1];
    const l = Math.hypot(ex, ey);
    if (l < 1e-6) return null;
    // Anello antiorario: la normale verso l'interno sta a sinistra del lato.
    nx[i] = -ey / l;
    ny[i] = ex / l;
  }
  const u = new Array<number>(n * 2);
  for (let i = 0; i < n; i++) {
    const h = (i + n - 1) % n;
    const giunto = 1 + nx[h] * nx[i] + ny[h] * ny[i];
    if (giunto < 0.06) return null;
    u[i * 2] = q[i * 2] + (d * (nx[h] + nx[i])) / giunto;
    u[i * 2 + 1] = q[i * 2 + 1] + (d * (ny[h] + ny[i])) / giunto;
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Il lato rientrato deve andare nello stesso verso di quello di partenza (ny, -nx).
    const lungo = (u[j * 2] - u[i * 2]) * ny[i] - (u[j * 2 + 1] - u[i * 2 + 1]) * nx[i];
    if (lungo < 0.02) return null;
  }
  // I controlli più cari solo se nessun lato si è rovesciato, e solo se le distanze non sono
  // già state misurate da chi chiama (rientroMassimo le conosce per costruzione).
  for (let i = 0; i < n && !giaMisurato; i++) {
    if (!dentro(u[i * 2], u[i * 2 + 1], q)) return null;
    if (distanzaDalBordo(u[i * 2], u[i * 2 + 1], q) < d * 0.985 - 1e-6) return null;
  }
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;
    for (let j = i + 2; j < n; j++) {
      const j2 = (j + 1) % n;
      if (j2 === i) continue;
      if (
        siIncrociano(
          u[i * 2], u[i * 2 + 1], u[i2 * 2], u[i2 * 2 + 1],
          u[j * 2], u[j * 2 + 1], u[j2 * 2], u[j2 * 2 + 1],
        )
      ) {
        return null;
      }
    }
  }
  return areaAnello(u) > 0 ? u : null;
}

/** Distanza dal segmento meno d, per il punto (x + d*mx, y + d*my). */
function scarto(
  x: number, y: number, mx: number, my: number, d: number,
  ax: number, ay: number, bx: number, by: number,
): number {
  return distanzaDalSegmento(x + d * mx, y + d * my, ax, ay, bx, by) - d;
}

/**
 * Il rientro più grande che l'anello regge, in metri (0 se non ne regge nessuno). Si ferma al
 * primo fatto: un lato che si accorcia fino a sparire, oppure un vertice che arriva a toccare
 * un lato lontano. Il conto è diretto; se il risultato non regge alla verifica si cerca per
 * tentativi.
 */
export function rientroMassimo(q: number[]): number {
  const n = q.length >> 1;
  // Nessun poligono regge un rientro più grande del raggio del cerchio con la stessa area.
  let alto = Math.min(12, Math.sqrt(Math.abs(areaAnello(q)) / Math.PI) * 1.02);
  if (!(alto > 0) || n < 3) return 0;
  const nx = new Array<number>(n);
  const ny = new Array<number>(n);
  const lato = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ex = q[j * 2] - q[i * 2];
    const ey = q[j * 2 + 1] - q[i * 2 + 1];
    const l = Math.hypot(ex, ey);
    if (l < 1e-6) return 0;
    nx[i] = -ey / l;
    ny[i] = ex / l;
    lato[i] = l;
  }
  // Di quanto si sposta ogni vertice per un metro di rientro.
  const mx = new Array<number>(n);
  const my = new Array<number>(n);
  const passoVertice = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const h = (i + n - 1) % n;
    const giunto = 1 + nx[h] * nx[i] + ny[h] * ny[i];
    if (giunto < 0.06) return 0;
    mx[i] = (nx[h] + nx[i]) / giunto;
    my[i] = (ny[h] + ny[i]) / giunto;
    passoVertice[i] = Math.hypot(mx[i], my[i]);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Lunghezza del lato rientrato: lato + d * accorcia.
    const accorcia = (mx[j] - mx[i]) * ny[i] - (my[j] - my[i]) * nx[i];
    if (accorcia < -1e-9) alto = Math.min(alto, lato[i] / -accorcia);
  }
  for (let i = 0; i < n; i++) {
    const x = q[i * 2];
    const y = q[i * 2 + 1];
    const h = (i + n - 1) % n;
    for (let k = 0; k < n; k++) {
      if (k === i || k === h) continue;
      const k2 = (k + 1) % n;
      const ax = q[k * 2];
      const ay = q[k * 2 + 1];
      const bx = q[k2 * 2];
      const by = q[k2 * 2 + 1];
      // Scarto subito se il lato è troppo lontano per contare.
      const portata = alto * (1 + passoVertice[i]);
      if (
        (x < ax - portata && x < bx - portata) || (x > ax + portata && x > bx + portata) ||
        (y < ay - portata && y < by - portata) || (y > ay + portata && y > by + portata)
      ) {
        continue;
      }
      // Candidati: il vertice tocca la retta del lato, oppure uno dei suoi due capi.
      const s = (x - ax) * nx[k] + (y - ay) * ny[k];
      const verso = 1 - (mx[i] * nx[k] + my[i] * ny[k]);
      if (verso > 1e-9) {
        for (const d of [s / verso, -s / (2 - verso)]) {
          if (d > 1e-6 && d < alto && Math.abs(scarto(x, y, mx[i], my[i], d, ax, ay, bx, by)) < 1e-6) alto = d;
        }
      }
      for (let capo = 0; capo < 2; capo++) {
        const wx = x - (capo === 0 ? ax : bx);
        const wy = y - (capo === 0 ? ay : by);
        const a2 = mx[i] * mx[i] + my[i] * my[i] - 1;
        const b2 = 2 * (wx * mx[i] + wy * my[i]);
        const c2 = wx * wx + wy * wy;
        if (Math.abs(a2) < 1e-9) {
          if (b2 < -1e-12) {
            const d = -c2 / b2;
            if (d > 1e-6 && d < alto && Math.abs(scarto(x, y, mx[i], my[i], d, ax, ay, bx, by)) < 1e-6) alto = d;
          }
          continue;
        }
        const delta = b2 * b2 - 4 * a2 * c2;
        if (delta < 0) continue;
        const r = Math.sqrt(delta);
        for (const d of [(-b2 - r) / (2 * a2), (-b2 + r) / (2 * a2)]) {
          if (d > 1e-6 && d < alto && Math.abs(scarto(x, y, mx[i], my[i], d, ax, ay, bx, by)) < 1e-6) alto = d;
        }
      }
    }
  }
  if (rientra(q, alto * 0.97, true)) return alto;
  let basso = 0;
  for (let i = 0; i < 7; i++) {
    const meta = (basso + alto) / 2;
    if (rientra(q, meta)) basso = meta;
    else alto = meta;
  }
  return basso;
}

/** Tono di una falda che guarda verso (mx, my), normale esterna in pianta. */
function classeFalda(mx: number, my: number): number {
  // La luce viene da ovest, come sui muri: chiare le falde a ovest, scure quelle a sud e a est,
  // a mezza tinta quelle a nord.
  const gradi = (Math.atan2(my, mx) * 180) / Math.PI;
  const g = gradi < 0 ? gradi + 360 : gradi;
  if (g >= 122 && g < 225) return FALDA_LUCE;
  if (g >= 32 && g < 122) return FALDA_MEDIA;
  return FALDA_OMBRA;
}

interface Cantiere {
  facce: number[][];
  classi: number[];
  salite: number[];
}

/**
 * Tetto a padiglione esatto per un anello senza rientranze: ogni lato ha la sua falda, fatta
 * dei punti più vicini a quel lato che a tutti gli altri. Le quote sono distanze dal lato
 * (pendenza 1), a partire da `z0`. Restituisce la distanza più grande raggiunta.
 */
function faldeConvesse(q: number[], z0: number, u: Cantiere): number {
  const n = q.length >> 1;
  const nx = new Array<number>(n);
  const ny = new Array<number>(n);
  const c = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ex = q[j * 2] - q[i * 2];
    const ey = q[j * 2 + 1] - q[i * 2 + 1];
    const l = Math.hypot(ex, ey) || 1;
    nx[i] = -ey / l;
    ny[i] = ex / l;
    c[i] = -(q[i * 2] * nx[i] + q[i * 2 + 1] * ny[i]);
  }
  let massimo = 0;
  for (let i = 0; i < n; i++) {
    let f = q.slice();
    for (let j = 0; j < n && f.length >= 6; j++) {
      if (j === i) continue;
      const a = nx[j] - nx[i];
      const b = ny[j] - ny[i];
      const cc = c[j] - c[i];
      if (Math.abs(a) + Math.abs(b) < 1e-9) {
        if (cc < -EPS) f = [];
        continue;
      }
      f = taglia(f, a, b, cc);
    }
    f = senzaDoppi(f);
    const m = f.length >> 1;
    if (m < 3) continue;
    // La faccia comincia dal lato di gronda: il vertice più vicino all'inizio del lato.
    let primo = 0;
    let vicino = Infinity;
    for (let k = 0; k < m; k++) {
      const d = Math.abs(f[k * 2] - q[i * 2]) + Math.abs(f[k * 2 + 1] - q[i * 2 + 1]);
      if (d < vicino) {
        vicino = d;
        primo = k;
      }
    }
    const faccia: number[] = [];
    for (let k = 0; k < m; k++) {
      const v = ((primo + k) % m) * 2;
      const d = Math.max(0, f[v] * nx[i] + f[v + 1] * ny[i] + c[i]);
      if (d > massimo) massimo = d;
      faccia.push(f[v], f[v + 1], z0 + d);
    }
    u.facce.push(faccia);
    u.classi.push(classeFalda(-nx[i], -ny[i]));
    u.salite.push(nx[i], ny[i], 1);
  }
  return massimo;
}

/** true se l'anello ha quattro vertici e angoli vicini al retto. */
function rettangolare(q: number[]): boolean {
  if (q.length !== 8) return false;
  for (let i = 0; i < 4; i++) {
    const h = (i + 3) % 4;
    const j = (i + 1) % 4;
    const ax = q[h * 2] - q[i * 2];
    const ay = q[h * 2 + 1] - q[i * 2 + 1];
    const bx = q[j * 2] - q[i * 2];
    const by = q[j * 2 + 1] - q[i * 2 + 1];
    const coseno = (ax * bx + ay * by) / ((Math.hypot(ax, ay) || 1) * (Math.hypot(bx, by) || 1));
    if (Math.abs(coseno) > 0.3) return false;
  }
  return true;
}

/**
 * Due falde su un quadrilatero: il colmo unisce i punti medi dei due lati corti, che
 * diventano timpani. Restituisce l'altezza del colmo a pendenza 1.
 */
function dueFalde(q: number[], u: Cantiere): number {
  const mx = (i: number): number => (q[(i % 4) * 2] + q[((i + 1) % 4) * 2]) / 2;
  const my = (i: number): number => (q[(i % 4) * 2 + 1] + q[((i + 1) % 4) * 2 + 1]) / 2;
  const l02 = Math.hypot(mx(0) - mx(2), my(0) - my(2));
  const l13 = Math.hypot(mx(1) - mx(3), my(1) - my(3));
  const a = l02 >= l13 ? 0 : 1;
  const x = (i: number): number => q[(i % 4) * 2];
  const y = (i: number): number => q[(i % 4) * 2 + 1];
  // Metà larghezza: distanza media dei capi del colmo dai due lati lunghi.
  let somma = 0;
  for (const lato of [a + 1, a + 3]) {
    for (const capo of [a, a + 2]) {
      somma += distanzaDalSegmento(mx(capo), my(capo), x(lato), y(lato), x(lato + 1), y(lato + 1));
    }
  }
  const w = somma / 4;
  if (!(w > 0.05)) return 0;
  const falda = (lato: number, da: number, verso: number): void => {
    const ex = x(lato + 1) - x(lato);
    const ey = y(lato + 1) - y(lato);
    const l = Math.hypot(ex, ey) || 1;
    u.facce.push([x(lato), y(lato), 0, x(lato + 1), y(lato + 1), 0, mx(verso), my(verso), w, mx(da), my(da), w]);
    u.classi.push(classeFalda(ey / l, -ex / l));
    u.salite.push(-ey / l, ex / l, 1);
  };
  falda(a + 1, a, a + 2);
  falda(a + 3, a + 2, a);
  for (const capo of [a, a + 2]) {
    u.facce.push([x(capo), y(capo), 0, x(capo + 1), y(capo + 1), 0, mx(capo), my(capo), w]);
    u.classi.push(TIMPANO);
    u.salite.push(0, 0, 0);
  }
  return w;
}

/**
 * Chiude un anello piano, alla quota `z`, come un tetto a due falde quasi piatto: lo divide in
 * due lungo il suo asse più lungo e dà alle due metà il tono e il verso dei coppi di due falde.
 * Le facce restano piane e dentro l'anello: niente esce dai muri. false se non ci riesce.
 */
function colmoFinto(giro: number[], z: number, u: Cantiere): boolean {
  const n = giro.length >> 1;
  if (n < 3) return false;
  // Centro e asse principale, pesati con la lunghezza dei lati.
  let peso = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const l = Math.hypot(giro[j * 2] - giro[i * 2], giro[j * 2 + 1] - giro[i * 2 + 1]);
    peso += l;
    cx += ((giro[i * 2] + giro[j * 2]) / 2) * l;
    cy += ((giro[i * 2 + 1] + giro[j * 2 + 1]) / 2) * l;
  }
  if (!(peso > 0)) return false;
  cx /= peso;
  cy /= peso;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ex = giro[j * 2] - giro[i * 2];
    const ey = giro[j * 2 + 1] - giro[i * 2 + 1];
    const l = Math.hypot(ex, ey);
    const mx = (giro[i * 2] + giro[j * 2]) / 2 - cx;
    const my = (giro[i * 2 + 1] + giro[j * 2 + 1]) / 2 - cy;
    // Momento di un segmento: il suo punto medio più la sua lunghezza.
    sxx += l * (mx * mx + (ex * ex) / 12);
    syy += l * (my * my + (ey * ey) / 12);
    sxy += l * (mx * my + (ex * ey) / 12);
  }
  const angolo = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const nx = -Math.sin(angolo);
  const ny = Math.cos(angolo);
  const c = -(nx * cx + ny * cy);
  const meta: number[][] = [];
  for (const verso of [1, -1]) {
    const f = senzaDoppi(taglia(giro, nx * verso, ny * verso, c * verso));
    const m = f.length >> 1;
    if (m < 3 || !(Math.abs(areaAnello(f)) > 0.4)) return false;
    // Il primo lato è il colmo: il lato più lungo tra quelli che stanno sul taglio.
    let primo = -1;
    let lungo = 0;
    for (let i = 0; i < m; i++) {
      const j = (i + 1) % m;
      if (Math.abs(nx * f[i * 2] + ny * f[i * 2 + 1] + c) > 1e-4) continue;
      if (Math.abs(nx * f[j * 2] + ny * f[j * 2 + 1] + c) > 1e-4) continue;
      const l = Math.hypot(f[j * 2] - f[i * 2], f[j * 2 + 1] - f[i * 2 + 1]);
      if (l > lungo) {
        lungo = l;
        primo = i;
      }
    }
    if (primo < 0 || lungo < 0.3) return false;
    const faccia: number[] = [];
    for (let k = 0; k < m; k++) {
      const v = ((primo + k) % m) * 2;
      faccia.push(f[v], f[v + 1], z);
    }
    meta.push(faccia);
  }
  for (let k = 0; k < 2; k++) {
    const verso = k === 0 ? 1 : -1;
    u.facce.push(meta[k]);
    u.classi.push(classeFalda(nx * verso, ny * verso) | COLMO_FINTO);
    u.salite.push(-nx * verso, -ny * verso, 0);
  }
  return true;
}

/** Un piano in cima: con il colmo finto se si può, altrimenti liscio. */
function chiudiInPiano(giro: number[], z: number, u: Cantiere): void {
  if (colmoFinto(giro, z, u)) return;
  const cappello: number[] = [];
  for (let i = 0; i < giro.length; i += 2) cappello.push(giro[i], giro[i + 1], z);
  u.facce.push(cappello);
  u.classi.push(CAPPELLO);
  u.salite.push(0, 0, 0);
}

/**
 * Falde su qualunque anello. Senza rientranze: padiglione esatto (o due falde sui rettangoli,
 * se `aCapanna`). Con rientranze: a gradoni, rientrando l'anello finché regge; quando ciò che
 * resta non ha più rientranze si chiude a padiglione, altrimenti con un piano in cima.
 * Restituisce l'altezza massima a pendenza 1, oppure 0 se non c'è riuscito.
 */
function aFalde(q: number[], u: Cantiere, aCapanna: boolean): number {
  if (senzaRientranze(q)) {
    if (aCapanna && rettangolare(q)) {
      const w = dueFalde(q, u);
      if (w > 0) return w;
    }
    return faldeConvesse(q, 0, u);
  }
  // Coda di lavoro: ogni voce è un anello ancora da coprire e la quota da cui parte.
  const coda: { giro: number[]; z: number }[] = [{ giro: q, z: 0 }];
  let cima = 0;
  let fatte = 0;
  for (let passo = 0; passo < coda.length && passo < 14; passo++) {
    const { giro, z } = coda[passo];
    if (senzaRientranze(giro)) {
      cima = Math.max(cima, z + faldeConvesse(giro, z, u));
      fatte++;
      continue;
    }
    const d = rientroMassimo(giro) * 0.97;
    const interno = d >= 0.3 ? rientra(giro, d, true) : null;
    if (!interno) {
      // Non si può più rientrare: una strozzatura tiene unite due parti. Si taglia lì.
      const parti = passo < 13 ? spezza(giro) : null;
      if (parti) {
        for (const parte of parti) {
          const pulita = semplificaAnello(parte, 0.1, 0.3, 0.7);
          if (pulita.length >= 6 && areaAnello(pulita) >= 1.2) coda.push({ giro: pulita, z });
        }
        continue;
      }
      // Oppure un dettaglio minuto blocca il rientro: si prova con un anello più semplice.
      // Alla quota di gronda si semplifica poco, per non uscire dai muri.
      const semplice =
        z > 0 ? semplificaAnello(giro, 0.3, 0.8, 1) : semplificaAnello(giro, 0.2, 0.45, 0.45);
      if (passo < 13 && semplice.length >= 6 && semplice.length < giro.length && areaAnello(semplice) >= 1.2) {
        coda.push({ giro: semplice, z });
        continue;
      }
      if (z > 0) chiudiInPiano(giro, z, u);
      continue;
    }
    const n = giro.length >> 1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ex = giro[j * 2] - giro[i * 2];
      const ey = giro[j * 2 + 1] - giro[i * 2 + 1];
      const l = Math.hypot(ex, ey) || 1;
      u.facce.push([
        giro[i * 2], giro[i * 2 + 1], z,
        giro[j * 2], giro[j * 2 + 1], z,
        interno[j * 2], interno[j * 2 + 1], z + d,
        interno[i * 2], interno[i * 2 + 1], z + d,
      ]);
      u.classi.push(classeFalda(ey / l, -ex / l) | GRADONE);
      u.salite.push(-ey / l, ex / l, 1);
    }
    fatte++;
    cima = Math.max(cima, z + d);
    const resto = semplificaAnello(interno, 0.1, 0.3, 0.7);
    if (resto.length >= 6 && areaAnello(resto) >= 1.2) coda.push({ giro: resto, z: z + d });
  }
  // Ciò che resta in coda oltre il limite dei passi si chiude con un piano.
  for (let passo = 14; passo < coda.length; passo++) {
    const { giro, z } = coda[passo];
    if (z > 0) chiudiInPiano(giro, z, u);
  }
  return fatte > 0 ? cima : 0;
}

/**
 * Taglia in due un anello nel punto più stretto: dove un vertice sta a meno di mezzo metro da
 * un lato che non lo tocca. Restituisce le due parti, oppure null se non c'è una strozzatura.
 */
export function spezza(q: number[]): [number[], number[]] | null {
  const n = q.length >> 1;
  if (n < 5) return null;
  let migliore = 0.5;
  let vi = -1;
  let lj = -1;
  let px = 0;
  let py = 0;
  for (let i = 0; i < n; i++) {
    const x = q[i * 2];
    const y = q[i * 2 + 1];
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      // Solo i lati che non toccano il vertice né i suoi due lati.
      if (j === i || k === i || j === (i + 1) % n || k === (i + n - 1) % n) continue;
      const ax = q[j * 2];
      const ay = q[j * 2 + 1];
      const dx = q[k * 2] - ax;
      const dy = q[k * 2 + 1] - ay;
      const l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
      const tx = ax + dx * t;
      const ty = ay + dy * t;
      const d = Math.hypot(x - tx, y - ty);
      if (d >= migliore) continue;
      // Il taglio deve passare dentro l'anello: tra due muri che si guardano attraverso un
      // rientro c'è il vuoto, non una strozzatura.
      if (d > 1e-3 && !dentro((x + tx) / 2, (y + ty) / 2, q)) continue;
      migliore = d;
      vi = i;
      lj = j;
      px = tx;
      py = ty;
    }
  }
  if (vi < 0) return null;
  const k = (lj + 1) % n;
  // Prima parte: dal vertice fino all'inizio del lato, poi il punto sul lato.
  const uno: number[] = [];
  for (let i = vi; ; i = (i + 1) % n) {
    uno.push(q[i * 2], q[i * 2 + 1]);
    if (i === lj) break;
  }
  uno.push(px, py);
  // Seconda parte: dal punto sul lato, la fine del lato, fino al vertice.
  const due: number[] = [px, py];
  for (let i = k; ; i = (i + 1) % n) {
    due.push(q[i * 2], q[i * 2 + 1]);
    if (i === vi) break;
  }
  if (!(areaAnello(uno) > 0) || !(areaAnello(due) > 0)) return null;
  return [uno, due];
}

/** Da quest'area (metri quadrati) e oltre questa distanza dal centro, una casa si dipinge da capannone. */
export const AREA_CAPANNONE = 1500;
export const DISTANZA_CAPANNONE = 700;

/** Sotto questa quota di impronta coperta, le falde si buttano e il tetto resta piano. */
export const COPERTURA_MINIMA = 0.9;

/** Area in pianta di una faccia [x, y, z, ...]. */
function areaInPianta(f: number[]): number {
  let a = 0;
  for (let i = 0; i < f.length; i += 3) {
    const j = (i + 3) % f.length;
    a += f[i] * f[j + 1] - f[j] * f[i + 1];
  }
  return Math.abs(a) / 2;
}

/** Le fasce chiare dei lucernari, di traverso al lato più lungo. */
function fasceCapannone(q: number[], u: Cantiere): void {
  const n = q.length >> 1;
  let ux = 1;
  let uy = 0;
  let lungo = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ex = q[j * 2] - q[i * 2];
    const ey = q[j * 2 + 1] - q[i * 2 + 1];
    const l = Math.hypot(ex, ey);
    if (l > lungo) {
      lungo = l;
      ux = ex / l;
      uy = ey / l;
    }
  }
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const t = q[i * 2] * ux + q[i * 2 + 1] * uy;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  const quante = Math.max(2, Math.min(40, Math.round((max - min) / 6.5)));
  const passo = (max - min) / quante;
  for (let k = 0; k < quante; k++) {
    const centro = min + (k + 0.5) * passo;
    // Tra centro - 0.9 e centro + 0.9 lungo l'asse.
    let f = taglia(q, ux, uy, -(centro - 0.9));
    if (f.length >= 6) f = taglia(f, -ux, -uy, centro + 0.9);
    f = senzaDoppi(f);
    if (f.length < 6) continue;
    const faccia: number[] = [];
    for (let i = 0; i < f.length; i += 2) faccia.push(f[i], f[i + 1], 0);
    u.facce.push(faccia);
    u.classi.push(FASCIA);
    u.salite.push(0, 0, 0);
  }
}

/**
 * Il tetto di un edificio. `p` è l'impronta in metri, in senso antiorario. Il tipo e il seme
 * scelgono la forma: capannoni piani con i lucernari, condomini grandi e alti con la terrazza,
 * torri a punta, tutto il resto a falde (due falde o padiglione).
 */
export function tettoInMetri(p: ArrayLike<number>, o: OpzioniTetto): TettoInMetri {
  const piano: TettoInMetri = { forma: TETTO_PIANO, facce: [], classi: [], salite: [], rialzo: 0 };
  const q = semplificaAnello(p);
  if (q.length < 6) return piano;
  const area = areaAnello(q);
  if (!(area > 4)) return piano;
  const u: Cantiere = { facce: [], classi: [], salite: [] };

  if (o.tipo === 'industria') {
    if (area < 350) return piano;
    fasceCapannone(q, u);
    return { forma: TETTO_CAPANNONE, facce: u.facce, classi: u.classi, salite: u.salite, rialzo: 0 };
  }

  const caso = o.seme >>> 0;
  if (o.tipo !== 'torre' && o.tipo !== 'chiesa') {
    if (area < 9) return piano;
    // Nel centro storico anche i palazzi grandi hanno il tetto in cotto.
    const grandeEAlto = area >= 280 && o.altezza >= 12.5 && o.distanza > 430;
    const moderno = o.distanza > 650 && area >= 110 && o.altezza >= 9 && caso % 100 < 14;
    if (grandeEAlto || moderno) {
      const interno = rientra(q, 0.55);
      if (interno) {
        const faccia: number[] = [];
        for (let i = 0; i < interno.length; i += 2) faccia.push(interno[i], interno[i + 1], 0);
        u.facce.push(faccia);
        u.classi.push(INTERNO);
        u.salite.push(0, 0, 0);
      }
      return { forma: TETTO_TERRAZZA, facce: u.facce, classi: u.classi, salite: u.salite, rialzo: 0 };
    }
    // Un corpo enorme fuori dal centro (supermercato, magazzino, fabbrica senza etichetta) non è
    // una casa: tetto da capannone, grigio e piano, non un padiglione di cotto lungo cento metri.
    if (area >= AREA_CAPANNONE && o.distanza > DISTANZA_CAPANNONE) {
      fasceCapannone(q, u);
      return { forma: TETTO_CAPANNONE, facce: u.facce, classi: u.classi, salite: u.salite, rialzo: 0 };
    }
  }

  let pendenza = 0.4 + ((caso >>> 5) & 7) * 0.015;
  let tetto = o.tipo === 'pubblico' ? 4.4 : 3.6;
  let aCapanna = (caso >>> 8) % 100 < 62;
  if (o.tipo === 'torre') {
    pendenza = 1.15;
    tetto = 7;
    aCapanna = false;
  } else if (o.tipo === 'chiesa') {
    pendenza = 0.6;
    tetto = 5.5;
    aCapanna = true;
  }
  if (o.rialzoMassimo !== undefined) tetto = Math.min(tetto, Math.max(0, o.rialzoMassimo));

  let cima = aFalde(q, u, aCapanna);
  // Quanta parte dell'impronta coprono le falde (i timpani sono muro, non contano).
  let coperta = 0;
  for (let f = 0; f < u.facce.length; f++) {
    if (u.classi[f] !== TIMPANO) coperta += areaInPianta(u.facce[f]);
  }
  if (!(cima > 0) || u.facce.length === 0 || coperta < area * COPERTURA_MINIMA) {
    // Nessun metodo regge su questa pianta: tetto piano in cotto, dipinto come due falde basse.
    u.facce.length = u.classi.length = u.salite.length = 0;
    if (!colmoFinto(q, 0, u)) return piano;
    return { forma: TETTO_FALDE, facce: u.facce, classi: u.classi, salite: u.salite, rialzo: 0 };
  }
  cima = Math.max(cima, 1e-6);
  const scala = Math.min(pendenza, tetto / cima);
  for (const f of u.facce) for (let i = 2; i < f.length; i += 3) f[i] *= scala;
  for (let i = 2; i < u.salite.length; i += 3) u.salite[i] *= scala;
  return { forma: TETTO_FALDE, facce: u.facce, classi: u.classi, salite: u.salite, rialzo: cima * scala };
}
