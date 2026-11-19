// Aggiunge alla mappa che c'è già (public/data/base.json) gli alberi illustrativi dei parchi e
// dei giardini del centro, con la griglia fitta di scripts/lib/alberi.mjs, senza scaricare di
// nuovo i dati da OpenStreetMap. La griglia è la stessa di scripts/dati-osm.mjs, ma il risultato
// non coincide del tutto: rifacendo la mappa da capo quello script prende tutti i punti della
// griglia fitta nei parchi del centro (senza la distanza minima di 6 m da qui sotto) e, se i
// punti sono più del tetto, ne scarta alcuni su tutta la città. Gli alberi del centro restano
// fitti, ma non sono proprio gli stessi.
//
// Uso: node scripts/dati-alberi.mjs  (oppure npm run dati:alberi)
//
// Gli alberi già presenti restano dove sono e nello stesso ordine; quelli nuovi si aggiungono in
// fondo, saltando i punti su una casa, in acqua o a meno di 6 m da un albero che c'è già.

import { readFile, rename, writeFile } from 'node:fs/promises';
import { passoAlberi, puntiDiGriglia, RAGGIO_GIARDINI, TETTO_ALBERI } from './lib/alberi.mjs';
import { daPiatto, limiti, puntoInPoligono, riquadroInMetri } from './lib/geo.mjs';

const FILE = new URL('../public/data/base.json', import.meta.url);
const DISTANZA_MINIMA = 6; // metri da un albero che c'è già
const CELLA = 64;

const testo = await readFile(FILE, 'utf8');
const base = JSON.parse(testo);
const R = riquadroInMetri();
const dentroRiquadro = ([x, y]) => x >= R.minX && x <= R.maxX && y >= R.minY && y <= R.maxY;

// Case e acqua, per scartare in fretta i punti che ci cadono sopra.
const chiave = (i, j) => i * 100003 + j;
const griglia = new Map();
const anelliCase = base.edifici.map((e) => daPiatto(e.p));
anelliCase.forEach((anello, n) => {
  const l = limiti(anello);
  for (let i = Math.floor(l.minX / CELLA); i <= Math.floor(l.maxX / CELLA); i++) {
    for (let j = Math.floor(l.minY / CELLA); j <= Math.floor(l.maxY / CELLA); j++) {
      const k = chiave(i, j);
      if (!griglia.has(k)) griglia.set(k, []);
      griglia.get(k).push(n);
    }
  }
});
const suCasa = (p) => (griglia.get(chiave(Math.floor(p[0] / CELLA), Math.floor(p[1] / CELLA))) || []).some((n) => puntoInPoligono(p, anelliCase[n]));
const acque = base.aree.filter((a) => a.t === 'acqua').map((a) => ({ anello: daPiatto(a.p) })).map((a) => ({ ...a, l: limiti(a.anello) }));
const inAcqua = (p) => acque.some((a) => p[0] >= a.l.minX && p[0] <= a.l.maxX && p[1] >= a.l.minY && p[1] <= a.l.maxY && puntoInPoligono(p, a.anello));

// Gli alberi che ci sono già, in una griglia per la distanza minima.
const vicini = new Map();
const aggiungiVicino = (x, y) => {
  const k = chiave(Math.floor(x / DISTANZA_MINIMA), Math.floor(y / DISTANZA_MINIMA));
  if (!vicini.has(k)) vicini.set(k, []);
  vicini.get(k).push([x, y]);
};
for (let i = 0; i + 1 < base.alberi.length; i += 2) aggiungiVicino(base.alberi[i], base.alberi[i + 1]);
const troppoVicino = ([x, y]) => {
  const i0 = Math.floor(x / DISTANZA_MINIMA);
  const j0 = Math.floor(y / DISTANZA_MINIMA);
  for (let i = i0 - 1; i <= i0 + 1; i++) {
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      for (const [ax, ay] of vicini.get(chiave(i, j)) || []) if (Math.hypot(ax - x, ay - y) < DISTANZA_MINIMA) return true;
    }
  }
  return false;
};

const nuovi = [];
let parchi = 0;
for (const a of base.aree) {
  if (a.t !== 'parco') continue;
  const anello = daPiatto(a.p);
  const passo = passoAlberi(a.t, anello);
  if (passo === 0) continue;
  const [cx, cy] = anello.reduce(([sx, sy], [x, y]) => [sx + x / anello.length, sy + y / anello.length], [0, 0]);
  if (Math.hypot(cx, cy) > RAGGIO_GIARDINI) continue;
  parchi++;
  for (const c of puntiDiGriglia(anello, passo)) {
    if (!dentroRiquadro(c.p) || suCasa(c.p) || inAcqua(c.p) || troppoVicino(c.p)) continue;
    nuovi.push(c.p);
    aggiungiVicino(c.p[0], c.p[1]);
  }
}

const posto = Math.max(0, TETTO_ALBERI - base.alberi.length / 2);
const presi = nuovi.slice(0, posto);
for (const [x, y] of presi) base.alberi.push(Math.round(x * 10) / 10, Math.round(y * 10) / 10);

// Stessa forma del file di prima: compatto, senza a capo in fondo se non c'era.
const uscita = JSON.stringify(base) + (testo.endsWith('\n') ? '\n' : '');
const temporaneo = new URL('../public/data/base.json.tmp', import.meta.url);
await writeFile(temporaneo, uscita);
await rename(temporaneo, FILE);
console.log(
  `Parchi e giardini del centro: ${parchi}. Alberi aggiunti: ${presi.length}` +
    (presi.length < nuovi.length ? ` (${nuovi.length - presi.length} lasciati fuori dal tetto di ${TETTO_ALBERI})` : '') +
    `. Alberi in tutto: ${base.alberi.length / 2}.`,
);
