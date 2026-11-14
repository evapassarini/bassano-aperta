// Funzioni geometriche condivise dagli script dei dati.
// Solo moduli interni di Node, nessuna dipendenza.
//
// I punti sono coppie [x, y] in metri locali (x verso est, y verso nord).
// La conversione è la stessa di docs/SPEC.md, sezione "Proiezione":
//   x = (lon - lon0) * 111320 * cos(lat0)
//   y = (lat - lat0) * 110574

/** Centro della proiezione locale. Stessi numeri di ORIGINE in src/types.ts. */
export const ORIGINE = { lon: 11.7345, lat: 45.7665 };

/** Riquadro della mappa. Stessi numeri di RIQUADRO in src/types.ts. */
export const RIQUADRO = { ovest: 11.7, sud: 45.736, est: 11.768, nord: 45.792 };

const METRI_PER_GRADO_LON = 111320 * Math.cos((ORIGINE.lat * Math.PI) / 180);
const METRI_PER_GRADO_LAT = 110574;

/** Gradi → metri locali, senza arrotondare. */
export function inMetri(lon, lat) {
  return [(lon - ORIGINE.lon) * METRI_PER_GRADO_LON, (lat - ORIGINE.lat) * METRI_PER_GRADO_LAT];
}

/** Metri locali → gradi. */
export function inGradi(x, y) {
  return { lon: ORIGINE.lon + x / METRI_PER_GRADO_LON, lat: ORIGINE.lat + y / METRI_PER_GRADO_LAT };
}

/** Arrotonda a 0.1 m. */
export function arrotonda(v) {
  const r = Math.round(v * 10) / 10;
  return r === 0 ? 0 : r; // evita -0
}

/**
 * Riquadro in metri locali, ristretto al decimetro verso l'interno:
 * così un punto ritagliato e poi arrotondato resta sempre dentro.
 */
export function riquadroInMetri() {
  const [x0, y0] = inMetri(RIQUADRO.ovest, RIQUADRO.sud);
  const [x1, y1] = inMetri(RIQUADRO.est, RIQUADRO.nord);
  return {
    minX: Math.ceil(x0 * 10) / 10,
    minY: Math.ceil(y0 * 10) / 10,
    maxX: Math.floor(x1 * 10) / 10,
    maxY: Math.floor(y1 * 10) / 10,
  };
}

/** Punti [[x, y], ...] → array piatto arrotondato, senza punti consecutivi uguali. */
export function appiattisci(punti, chiuso = false) {
  const p = [];
  for (const [x, y] of punti) {
    const rx = arrotonda(x);
    const ry = arrotonda(y);
    const n = p.length;
    if (n >= 2 && p[n - 2] === rx && p[n - 1] === ry) continue;
    p.push(rx, ry);
  }
  if (chiuso) {
    while (p.length >= 4 && p[0] === p[p.length - 2] && p[1] === p[p.length - 1]) p.length -= 2;
  }
  return p;
}

/** Array piatto → punti. */
export function daPiatto(p) {
  const punti = [];
  for (let i = 0; i < p.length; i += 2) punti.push([p[i], p[i + 1]]);
  return punti;
}

/** Toglie il punto di chiusura se l'anello ripete il primo punto in fondo. */
export function apriAnello(punti) {
  const n = punti.length;
  if (n > 1 && punti[0][0] === punti[n - 1][0] && punti[0][1] === punti[n - 1][1]) return punti.slice(0, -1);
  return punti;
}

/** Area con segno (formula di Gauss): positiva se l'anello è antiorario. */
export function areaConSegno(punti) {
  let s = 0;
  for (let i = 0, n = punti.length; i < n; i++) {
    const a = punti[i];
    const b = punti[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

export function area(punti) {
  return Math.abs(areaConSegno(punti));
}

/** Restituisce l'anello in senso antiorario (con y verso nord). */
export function antiorario(punti) {
  return areaConSegno(punti) < 0 ? punti.slice().reverse() : punti;
}

export function centroide(punti) {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of punti) {
    sx += x;
    sy += y;
  }
  return [sx / punti.length, sy / punti.length];
}

export function lunghezza(punti) {
  let l = 0;
  for (let i = 1; i < punti.length; i++) l += Math.hypot(punti[i][0] - punti[i - 1][0], punti[i][1] - punti[i - 1][1]);
  return l;
}

export function limiti(punti) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of punti) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Distanza di un punto dal segmento a-b. */
export function distanzaDaSegmento(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Distanza di un punto dal bordo di un anello. */
export function distanzaDaAnello(p, anello) {
  let d = Infinity;
  for (let i = 0, n = anello.length; i < n; i++) {
    const v = distanzaDaSegmento(p, anello[i], anello[(i + 1) % n]);
    if (v < d) d = v;
  }
  return d;
}

/** Punto dentro un anello (regola pari-dispari). */
export function puntoInPoligono(p, anello) {
  let dentro = false;
  const [x, y] = p;
  for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
    const [xi, yi] = anello[i];
    const [xj, yj] = anello[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Douglas-Peucker su una linea aperta. */
export function semplificaLinea(punti, tolleranza) {
  const n = punti.length;
  if (n <= 2) return punti.slice();
  const tieni = new Uint8Array(n);
  tieni[0] = 1;
  tieni[n - 1] = 1;
  const pila = [[0, n - 1]];
  while (pila.length) {
    const [a, b] = pila.pop();
    let max = 0;
    let indice = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distanzaDaSegmento(punti[i], punti[a], punti[b]);
      if (d > max) {
        max = d;
        indice = i;
      }
    }
    if (indice !== -1 && max > tolleranza) {
      tieni[indice] = 1;
      pila.push([a, indice], [indice, b]);
    }
  }
  return punti.filter((_, i) => tieni[i]);
}

/**
 * Douglas-Peucker su un anello (senza punto di chiusura): si taglia nel punto
 * più lontano dal primo e si semplificano le due metà.
 */
export function semplificaAnello(punti, tolleranza) {
  const n = punti.length;
  if (n <= 4) return punti.slice();
  let lontano = 0;
  let max = -1;
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(punti[i][0] - punti[0][0], punti[i][1] - punti[0][1]);
    if (d > max) {
      max = d;
      lontano = i;
    }
  }
  const prima = semplificaLinea(punti.slice(0, lontano + 1), tolleranza);
  const seconda = semplificaLinea([...punti.slice(lontano), punti[0]], tolleranza);
  return [...prima.slice(0, -1), ...seconda.slice(0, -1)];
}

/** Ritaglia un anello sul rettangolo (Sutherland-Hodgman). Può restituire []. */
export function ritagliaPoligono(punti, r) {
  const bordi = [
    [(p) => p[0] >= r.minX, (a, b) => incrociaX(a, b, r.minX)],
    [(p) => p[0] <= r.maxX, (a, b) => incrociaX(a, b, r.maxX)],
    [(p) => p[1] >= r.minY, (a, b) => incrociaY(a, b, r.minY)],
    [(p) => p[1] <= r.maxY, (a, b) => incrociaY(a, b, r.maxY)],
  ];
  let uscita = punti;
  for (const [dentro, incrocia] of bordi) {
    const ingresso = uscita;
    uscita = [];
    for (let i = 0, n = ingresso.length; i < n; i++) {
      const a = ingresso[i];
      const b = ingresso[(i + 1) % n];
      const aDentro = dentro(a);
      const bDentro = dentro(b);
      if (aDentro && bDentro) uscita.push(b);
      else if (aDentro && !bDentro) uscita.push(incrocia(a, b));
      else if (!aDentro && bDentro) uscita.push(incrocia(a, b), b);
    }
    if (uscita.length === 0) return [];
  }
  return uscita;
}

function incrociaX(a, b, x) {
  const t = (x - a[0]) / (b[0] - a[0]);
  return [x, a[1] + t * (b[1] - a[1])];
}

function incrociaY(a, b, y) {
  const t = (y - a[1]) / (b[1] - a[1]);
  return [a[0] + t * (b[0] - a[0]), y];
}

/** Ritaglia una linea sul rettangolo: restituisce i pezzi che restano dentro. */
export function ritagliaLinea(punti, r) {
  const pezzi = [];
  let corrente = null;
  for (let i = 1; i < punti.length; i++) {
    const s = ritagliaSegmento(punti[i - 1], punti[i], r);
    if (!s) {
      corrente = null;
      continue;
    }
    const [a, b, esceAllaFine] = s;
    if (!corrente) {
      corrente = [a];
      pezzi.push(corrente);
    }
    corrente.push(b);
    if (esceAllaFine) corrente = null;
  }
  return pezzi.filter((p) => p.length >= 2);
}

// Liang-Barsky.
function ritagliaSegmento(a, b, r) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const prove = [
    [-dx, a[0] - r.minX],
    [dx, r.maxX - a[0]],
    [-dy, a[1] - r.minY],
    [dy, r.maxY - a[1]],
  ];
  for (const [p, q] of prove) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }
  const stringi = (v, min, max) => Math.max(min, Math.min(max, v));
  const punto = (t) => [stringi(a[0] + t * dx, r.minX, r.maxX), stringi(a[1] + t * dy, r.minY, r.maxY)];
  return [t0 === 0 ? a : punto(t0), t1 === 1 ? b : punto(t1), t1 < 1];
}

/** Punti lungo una linea, uno ogni `passo` metri (estremi compresi). */
export function campionaLinea(punti, passo) {
  const out = [punti[0]];
  let resto = passo;
  for (let i = 1; i < punti.length; i++) {
    const a = punti[i - 1];
    const b = punti[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let pos = resto;
    while (pos <= l) {
      const t = pos / l;
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      pos += passo;
    }
    resto = pos - l;
  }
  out.push(punti[punti.length - 1]);
  return out;
}

/** Trasforma una linea in un poligono largo 2 * raggio (estremità piatte). */
export function allargaLinea(punti, raggio) {
  const n = punti.length;
  const sinistra = [];
  const destra = [];
  for (let i = 0; i < n; i++) {
    const prima = punti[Math.max(0, i - 1)];
    const dopo = punti[Math.min(n - 1, i + 1)];
    let dx = dopo[0] - prima[0];
    let dy = dopo[1] - prima[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    sinistra.push([punti[i][0] - dy * raggio, punti[i][1] + dx * raggio]);
    destra.push([punti[i][0] + dy * raggio, punti[i][1] - dx * raggio]);
  }
  return [...sinistra, ...destra.reverse()];
}

/** Numero pseudo-casuale in [0, 1) che dipende solo dal seme intero (mulberry32). */
export function casuale(seme, giro = 0) {
  let t = (Math.imul(seme | 0, 0x9e3779b1) + Math.imul(giro + 1, 0x85ebca6b)) | 0;
  t = (t + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
}
