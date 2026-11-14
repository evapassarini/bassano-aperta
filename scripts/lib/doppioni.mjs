// Edifici doppi in OpenStreetMap: lo stesso edificio disegnato due volte (di solito un
// contorno e una relazione, oppure due rilievi sovrapposti), con tipo e altezza diversi.
// Sulla mappa finirebbero uno dentro l'altro, con colori e altezze diverse.
//
// Si toglie solo il doppione vero: due impronte quasi della stessa area che si coprono a
// vicenda. Le parti più piccole dentro un edificio più grande (un campanile, un corpo più
// alto) restano: sono volumi veri.

/** Quanta parte di un'impronta deve stare nell'altra, in entrambi i versi. */
const COPERTURA_MINIMA = 0.8;
/** Di quanto possono differire le due aree. */
const SCARTO_AREA = 0.2;
const LATO_CELLA = 60; // metri

function limiti(p) {
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
  return { minX, minY, maxX, maxY };
}

function areaPiatta(p) {
  let a = 0;
  for (let i = 0; i + 1 < p.length; i += 2) {
    const j = (i + 2) % p.length;
    a += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return Math.abs(a / 2);
}

function dentro(x, y, p) {
  const n = p.length >> 1;
  let d = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2];
    const yi = p[i * 2 + 1];
    const xj = p[j * 2];
    const yj = p[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

/** Punti di una griglia 8 x 8 che cadono dentro l'impronta. */
function campioni(p, l) {
  const punti = [];
  const N = 8;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const x = l.minX + ((c + 0.5) / N) * (l.maxX - l.minX);
      const y = l.minY + ((r + 0.5) / N) * (l.maxY - l.minY);
      if (dentro(x, y, p)) punti.push(x, y);
    }
  }
  return punti;
}

/** Quota (0..1) dei campioni di un'impronta che cadono dentro l'altra. */
function quotaDentro(punti, altra) {
  if (punti.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < punti.length; i += 2) if (dentro(punti[i], punti[i + 1], altra)) n++;
  return n / (punti.length / 2);
}

/**
 * Toglie i doppioni da un elenco di edifici { p, h, t, n? } (p: array piatto in metri).
 * Tra due doppioni resta quello con il nome; a parità, quello per cui `preferito(indice)`
 * è vero (per esempio: altezza dichiarata in OSM); a parità ancora, il primo dell'elenco.
 * Restituisce { edifici, tolti }.
 */
export function togliDoppioni(edifici, preferito = () => false) {
  const dati = edifici.map((e) => {
    const l = limiti(e.p);
    return { l, area: areaPiatta(e.p), campioni: null };
  });
  const griglia = new Map();
  const celle = (l, f) => {
    for (let cx = Math.floor(l.minX / LATO_CELLA); cx <= Math.floor(l.maxX / LATO_CELLA); cx++) {
      for (let cy = Math.floor(l.minY / LATO_CELLA); cy <= Math.floor(l.maxY / LATO_CELLA); cy++) f(cx + ':' + cy);
    }
  };
  dati.forEach((d, i) =>
    celle(d.l, (k) => {
      const v = griglia.get(k);
      if (v) v.push(i);
      else griglia.set(k, [i]);
    }),
  );
  const campioniDi = (i) => (dati[i].campioni ??= campioni(edifici[i].p, dati[i].l));
  const voto = (i) => (edifici[i].n ? 2 : 0) + (preferito(i) ? 1 : 0);

  const via = new Set();
  for (let i = 0; i < edifici.length; i++) {
    if (via.has(i)) continue;
    const vicini = new Set();
    celle(dati[i].l, (k) => {
      for (const j of griglia.get(k) ?? []) if (j > i) vicini.add(j);
    });
    for (const j of vicini) {
      if (via.has(j) || via.has(i)) continue;
      const a = dati[i];
      const b = dati[j];
      if (a.l.minX > b.l.maxX || a.l.maxX < b.l.minX || a.l.minY > b.l.maxY || a.l.maxY < b.l.minY) continue;
      if (Math.abs(a.area - b.area) > SCARTO_AREA * Math.max(a.area, b.area)) continue;
      if (quotaDentro(campioniDi(i), edifici[j].p) < COPERTURA_MINIMA) continue;
      if (quotaDentro(campioniDi(j), edifici[i].p) < COPERTURA_MINIMA) continue;
      via.add(voto(j) > voto(i) ? i : j);
    }
  }
  return { edifici: edifici.filter((_, i) => !via.has(i)), tolti: via.size };
}
