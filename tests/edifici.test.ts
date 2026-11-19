// Edifici dipinti: geometria dei tetti (src/map/tetti.ts), come entra nella scena e come
// la usa il disegno. Tutto deciso dal seme: stessa impronta, stesso edificio.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { puntoSuEdificio } from '../src/map/bersagli';
import { DETTAGLI, Disegnatore, FUOCHI_CENTRO, lontananzaDalCentro, presenza } from '../src/map/disegno';
import { campi, creaMacchie, creaSelciato, dimezza, LIVELLI_TRAMA, livelloTrama, rumore } from '../src/map/trame';
import type { Illustrazioni } from '../src/map/immagini';
import { PALETTE, PALETTE_NOTTE, PALETTE_PER_LUCE, PALETTE_POMERIGGIO } from '../src/map/palette';
import { ISO_Z, metriInIso } from '../src/map/proiezione';
import { ALTEZZA_DAVANTI, antiorario, costruisciScena, preparaEdificio, semeDi } from '../src/map/scena';
import {
  CAPPELLO,
  COLMO_FINTO,
  COPERTURA_MINIMA,
  dentroOSulBordo,
  FALDA_LUCE,
  FALDA_OMBRA,
  FASCIA,
  GRADONE,
  INTERNO,
  MASCHERA_CLASSE,
  rientra,
  rientroMassimo,
  semplificaAnello,
  spezza,
  TETTO_CAPANNONE,
  TETTO_FALDE,
  TETTO_PIANO,
  TETTO_TERRAZZA,
  tettoInMetri,
  TIMPANO,
  TIMPANO_DESTRO,
  TIMPANO_SINISTRO,
} from '../src/map/tetti';
import type { OpzioniTetto, TettoInMetri } from '../src/map/tetti';
import type { TipoEdificio } from '../src/types';
import { creaCittaFinta } from './fixtures/citta-finta';

const casa = (seme = 7): OpzioniTetto => ({ tipo: 'casa', seme, altezza: 9, distanza: 100 });

/** Area di un anello piatto [x0, y0, ...]. */
function area(p: ArrayLike<number>): number {
  let a = 0;
  for (let i = 0; i < p.length; i += 2) {
    const j = (i + 2) % p.length;
    a += p[i] * p[j + 1] - p[j] * p[i + 1];
  }
  return Math.abs(a / 2);
}

/** Area in pianta di una faccia [x, y, z, ...]. */
function areaFaccia(f: number[]): number {
  const xy: number[] = [];
  for (let i = 0; i < f.length; i += 3) xy.push(f[i], f[i + 1]);
  return area(xy);
}

/** Tutti i vertici del tetto stanno nell'impronta (entro `tolleranza` metri) e non scendono sotto la gronda. */
function controlla(t: TettoInMetri, impronta: number[], tolleranza = 0.25): void {
  expect(t.facce.length).toBe(t.classi.length);
  expect(t.salite.length).toBe(t.facce.length * 3);
  for (const f of t.facce) {
    expect(f.length % 3).toBe(0);
    expect(f.length).toBeGreaterThanOrEqual(9);
    for (let i = 0; i < f.length; i += 3) {
      expect(Number.isFinite(f[i]) && Number.isFinite(f[i + 1]) && Number.isFinite(f[i + 2])).toBe(true);
      expect(dentroOSulBordo(f[i], f[i + 1], impronta, tolleranza)).toBe(true);
      expect(f[i + 2]).toBeGreaterThanOrEqual(-1e-9);
      expect(f[i + 2]).toBeLessThanOrEqual(t.rialzo + 1e-6);
    }
  }
}

/** Quanta parte dell'impronta è coperta dalle falde (i timpani sono verticali, in pianta non contano). */
function copertura(t: TettoInMetri, impronta: number[]): number {
  let somma = 0;
  t.facce.forEach((f, i) => {
    if (t.classi[i] !== TIMPANO) somma += areaFaccia(f);
  });
  return somma / area(impronta);
}

const rettangolo = [0, 0, 20, 0, 20, 8, 0, 8];
const aElle = [0, 0, 20, 0, 20, 8, 8, 8, 8, 20, 0, 20];
const aC = [0, 0, 30, 0, 30, 30, 0, 30, 0, 20, 20, 20, 20, 10, 0, 10];
const aT = [0, 0, 30, 0, 30, 8, 19, 8, 19, 26, 11, 26, 11, 8, 0, 8];
// Due corpi uniti da un passaggio stretto.
const conStrozzatura = [0, 0, 12, 0, 12, 5, 16, 5, 16, 0, 30, 0, 30, 12, 16, 12, 16, 7, 12, 7, 12, 12, 0, 12];

describe('tetti: rettangoli', () => {
  it('due falde: il colmo corre lungo il lato lungo, a metà larghezza, con i timpani sui lati corti', () => {
    // Si cerca un seme che scelga le due falde: ne basta uno, la scelta è stabile.
    let t: TettoInMetri | null = null;
    for (let seme = 0; seme < 25600 && !t; seme += 256) {
      const prova = tettoInMetri(rettangolo, casa(seme));
      if (prova.classi.includes(TIMPANO)) t = prova;
    }
    expect(t).not.toBeNull();
    const tetto = t as TettoInMetri;
    expect(tetto.forma).toBe(TETTO_FALDE);
    controlla(tetto, rettangolo);
    expect(tetto.classi.filter((c) => c === TIMPANO)).toHaveLength(2);
    expect(tetto.classi.filter((c) => c !== TIMPANO)).toHaveLength(2);
    // I punti più alti stanno tutti sulla retta y = 4 e vanno da un capo all'altro.
    const alti: number[][] = [];
    for (const f of tetto.facce) {
      for (let i = 0; i < f.length; i += 3) if (f[i + 2] > tetto.rialzo - 1e-6) alti.push([f[i], f[i + 1]]);
    }
    expect(alti.length).toBeGreaterThanOrEqual(4);
    for (const [, y] of alti) expect(y).toBeCloseTo(4, 6);
    expect(Math.min(...alti.map((v) => v[0]))).toBeCloseTo(0, 6);
    expect(Math.max(...alti.map((v) => v[0]))).toBeCloseTo(20, 6);
    // Altezza del colmo: metà larghezza per la pendenza, tra 0,40 e 0,51.
    expect(tetto.rialzo).toBeGreaterThan(4 * 0.39);
    expect(tetto.rialzo).toBeLessThan(4 * 0.52);
    expect(copertura(tetto, rettangolo)).toBeCloseTo(1, 6);
  });

  it('padiglione: quattro falde, il colmo sul lato lungo ma più corto dei muri', () => {
    let t: TettoInMetri | null = null;
    for (let seme = 0; seme < 25600 && !t; seme += 256) {
      const prova = tettoInMetri(rettangolo, casa(seme));
      if (!prova.classi.includes(TIMPANO)) t = prova;
    }
    expect(t).not.toBeNull();
    const tetto = t as TettoInMetri;
    controlla(tetto, rettangolo);
    expect(tetto.facce).toHaveLength(4);
    const alti: number[][] = [];
    for (const f of tetto.facce) {
      for (let i = 0; i < f.length; i += 3) if (f[i + 2] > tetto.rialzo - 1e-6) alti.push([f[i], f[i + 1]]);
    }
    for (const [, y] of alti) expect(y).toBeCloseTo(4, 6);
    // Il colmo va da x = 4 a x = 16: rientra di metà larghezza a ogni capo.
    expect(Math.min(...alti.map((v) => v[0]))).toBeCloseTo(4, 6);
    expect(Math.max(...alti.map((v) => v[0]))).toBeCloseTo(16, 6);
    expect(copertura(tetto, rettangolo)).toBeCloseTo(1, 6);
    // Ogni falda comincia dal suo lato di gronda (quota zero) e sale verso l'interno.
    tetto.facce.forEach((f, i) => {
      expect(f[2]).toBe(0);
      expect(f[5]).toBe(0);
      const nx = tetto.salite[i * 3];
      const ny = tetto.salite[i * 3 + 1];
      expect(Math.hypot(nx, ny)).toBeCloseTo(1, 6);
      // La direzione di salita è perpendicolare alla gronda e punta dentro.
      expect(nx * (f[3] - f[0]) + ny * (f[4] - f[1])).toBeCloseTo(0, 6);
      expect(nx * (10 - (f[0] + f[3]) / 2) + ny * (4 - (f[1] + f[4]) / 2)).toBeGreaterThan(0);
    });
  });

  it('le falde a ovest sono in luce, quelle a sud in ombra, come i muri', () => {
    const quadrato = [0, 0, 10, 0, 10, 10, 0, 10];
    const t = tettoInMetri(quadrato, { tipo: 'torre', seme: 1, altezza: 20, distanza: 0 });
    expect(t.facce).toHaveLength(4);
    const classeDelLato = (x: number, y: number): number => {
      const i = t.facce.findIndex((f) => Math.abs((f[0] + f[3]) / 2 - x) < 1e-6 && Math.abs((f[1] + f[4]) / 2 - y) < 1e-6);
      return t.classi[i];
    };
    expect(classeDelLato(0, 5)).toBe(FALDA_LUCE); // ovest
    expect(classeDelLato(5, 0)).toBe(FALDA_OMBRA); // sud
    expect(classeDelLato(10, 5)).toBe(FALDA_OMBRA); // est
    expect(classeDelLato(5, 10)).not.toBe(FALDA_OMBRA); // nord, mezza tinta
    // La punta della torre è ripida, ma non oltre il suo limite.
    expect(t.rialzo).toBeCloseTo(5 * 1.15, 6);
  });
});

describe('tetti: impronte con rientranze', () => {
  for (const [nome, impronta] of [
    ['a L', aElle],
    ['a C', aC],
    ['a T', aT],
    ['con una strozzatura', conStrozzatura],
  ] as const) {
    it(`pianta ${nome}: falde dentro i muri, tetto quasi tutto coperto`, () => {
      const t = tettoInMetri(impronta, casa());
      expect(t.forma).toBe(TETTO_FALDE);
      expect(t.rialzo).toBeGreaterThan(0.8);
      controlla(t, [...impronta]);
      // Niente buchi: le falde (e il piano in cima, se c'è) coprono l'impronta.
      const coperta = copertura(t, [...impronta]);
      expect(coperta).toBeGreaterThan(0.97);
      expect(coperta).toBeLessThan(1.03);
      // Il piano in cima, se resta, è una striscia: non un tetto piano travestito.
      let piano = 0;
      t.facce.forEach((f, i) => {
        if (t.classi[i] === CAPPELLO) piano += areaFaccia(f);
      });
      expect(piano / area(impronta)).toBeLessThan(0.12);
    });
  }

  it('le fasce dei gradoni sono segnate, e la classe resta leggibile sotto il segno', () => {
    const t = tettoInMetri(aElle, casa());
    const gradoni = t.classi.filter((c) => (c & GRADONE) !== 0);
    expect(gradoni.length).toBeGreaterThanOrEqual(6);
    for (const c of t.classi) expect((c & MASCHERA_CLASSE) <= CAPPELLO).toBe(true);
  });

  it('dove le falde non reggono resta un piano dipinto come due falde basse, con il colmo in mezzo', () => {
    // Una stella irregolare su cui i gradoni coprono troppo poco: prima restava un tetto liscio.
    const stella = [1.7, 0.6, 2.3, 1.6, 1.2, 1.7, -0.2, 2.8, -1, 3.1, -2.2, 1.9, -1.8, 0.6, -2.3, -0.6, -1.5, -1.1, -2.2, -3.1, 0.1, -1.6, 1.1, -3.7, 1.8, -1.3, 1.5, -0.4];
    const t = tettoInMetri(stella, casa());
    expect(t.forma).toBe(TETTO_FALDE);
    expect(t.rialzo).toBe(0);
    expect(t.facce).toHaveLength(2);
    for (const c of t.classi) expect(c & COLMO_FINTO).toBe(COLMO_FINTO);
    controlla(t, stella);
    // Le due metà coprono tutta l'impronta, senza sovrapporsi.
    expect(copertura(t, stella)).toBeGreaterThan(0.97);
    expect(copertura(t, stella)).toBeLessThan(1.03);
    // Il primo lato di ogni metà è il colmo: lo stesso segmento, percorso nei due versi.
    const [a, b] = t.facce;
    expect(Math.hypot(a[0] - b[3], a[1] - b[4])).toBeLessThan(1e-6);
    expect(Math.hypot(a[3] - b[0], a[4] - b[1])).toBeLessThan(1e-6);
    // Le due metà guardano da parti opposte: i coppi scendono dal colmo verso i muri.
    expect(t.salite[0]).toBeCloseTo(-t.salite[3], 9);
    expect(t.salite[1]).toBeCloseTo(-t.salite[4], 9);
    expect(t.salite[2]).toBe(0);
  });

  it('il piano in cima a un tetto a gradoni è diviso dal colmo finto, non resta una lastra', () => {
    for (const impronta of [aC, aT, conStrozzatura, aElle]) {
      const t = tettoInMetri(impronta, casa());
      t.classi.forEach((c, i) => {
        if ((c & COLMO_FINTO) === 0) return;
        // Una metà di piano: tutta alla stessa quota, sopra la gronda.
        const f = t.facce[i];
        for (let k = 5; k < f.length; k += 3) expect(f[k]).toBeCloseTo(f[2], 9);
        expect(f[2]).toBeGreaterThan(0);
      });
    }
  });

  it('rientrare un anello: regge finché le parti non si toccano', () => {
    const q = [...aElle];
    const poco = rientra(q, 1);
    expect(poco).not.toBeNull();
    expect(area(poco as number[])).toBeLessThan(area(q));
    for (let i = 0; i < (poco as number[]).length; i += 2) {
      expect(dentroOSulBordo((poco as number[])[i], (poco as number[])[i + 1], q, 0)).toBe(true);
    }
    // I bracci sono larghi 8 m: oltre i 4 m non resta niente.
    expect(rientra(q, 4.5)).toBeNull();
    const massimo = rientroMassimo(q);
    expect(massimo).toBeGreaterThan(3.8);
    expect(massimo).toBeLessThanOrEqual(4.01);
    expect(rientra(q, massimo * 0.97)).not.toBeNull();
  });

  it('una strozzatura si taglia in due parti vere', () => {
    // Clessidra: due quadrati che si toccano quasi in un punto.
    const clessidra = [0, 0, 10, 0, 10, 10, 5.2, 10.2, 10, 10.4, 10, 20, 0, 20, 0, 10.4, 4.8, 10.2, 0, 10];
    const parti = spezza(clessidra);
    expect(parti).not.toBeNull();
    const [uno, due] = parti as [number[], number[]];
    expect(area(uno) + area(due)).toBeCloseTo(area(clessidra), 3);
    expect(Math.min(area(uno), area(due))).toBeGreaterThan(90);
    // Un rettangolo non ha strozzature.
    expect(spezza([...rettangolo])).toBeNull();
  });
});

describe('tetti: impronte degeneri e casi limite', () => {
  it('poligoni che non sono poligoni: tetto piano, senza facce e senza errori', () => {
    const degeneri: number[][] = [
      [],
      [0, 0],
      [0, 0, 5, 5],
      [0, 0, 5, 0, 10, 0], // tre punti allineati
      [0, 0, 0, 0, 0, 0, 0, 0], // tutti nello stesso punto
      [0, 0, 10, 0, 10, 0.05, 0, 0.05], // una lama larga cinque centimetri
      [0, 0, 1, 0, 1, 1, 0, 1], // un metro quadrato
      [0, 0, 10, 0, Number.NaN, 5, 0, 10].filter((v) => true),
    ];
    for (const p of degeneri) {
      const t = tettoInMetri(p, casa());
      expect(t.rialzo).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(t.rialzo)).toBe(true);
      for (const f of t.facce) for (const v of f) expect(Number.isFinite(v)).toBe(true);
    }
    expect(tettoInMetri([0, 0, 5, 0, 10, 0], casa()).forma).toBe(TETTO_PIANO);
    expect(tettoInMetri([0, 0, 1, 0, 1, 1, 0, 1], casa()).facce).toHaveLength(0);
  });

  it('punti doppi e punti allineati non cambiano il tetto', () => {
    const pulito = tettoInMetri(rettangolo, casa(3));
    const sporco = tettoInMetri([0, 0, 10, 0, 10, 0, 20, 0, 20, 8, 20, 8.01, 10, 8.02, 0, 8], casa(3));
    expect(sporco.forma).toBe(pulito.forma);
    expect(sporco.facce.length).toBe(pulito.facce.length);
    expect(sporco.rialzo).toBeCloseTo(pulito.rialzo, 1);
    expect(semplificaAnello([0, 0, 5, 0, 10, 0, 10, 10, 0, 10])).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
    // Una punta ripiegata senza spessore sparisce.
    expect(semplificaAnello([0, 0, 10, 0, 10, 10, 20, 10.02, 10, 10.04, 0, 10]).length).toBeLessThanOrEqual(10);
  });

  it('un triangolo, un cerchio a molti lati e un poligono storto hanno falde che reggono', () => {
    const triangolo = [0, 0, 14, 0, 6, 11];
    const tondo: number[] = [];
    for (let i = 0; i < 28; i++) tondo.push(10 * Math.cos((i / 28) * 2 * Math.PI), 10 * Math.sin((i / 28) * 2 * Math.PI));
    const storto = [0, 0, 13, 1.5, 15, 9, 9, 14, 1, 10, -2, 4];
    for (const p of [triangolo, tondo, storto]) {
      const t = tettoInMetri(p, casa());
      expect(t.forma).toBe(TETTO_FALDE);
      controlla(t, p);
      expect(copertura(t, p)).toBeGreaterThan(0.99);
      expect(copertura(t, p)).toBeLessThan(1.01);
    }
  });

  it('mille impronte a caso: mai un vertice fuori dai muri, mai un numero rotto', () => {
    // Generatore con seme, così la prova è sempre la stessa.
    let s = 12345;
    const caso = (): number => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const tipi: TipoEdificio[] = ['casa', 'altro', 'pubblico', 'chiesa', 'torre', 'industria'];
    let aFalde = 0;
    for (let k = 0; k < 1000; k++) {
      // Un poligono a stella irregolare: spesso con rientranze, mai intrecciato.
      const n = 3 + Math.floor(caso() * 12);
      const raggio = 3 + caso() * 20;
      const p: number[] = [];
      for (let i = 0; i < n; i++) {
        const angolo = ((i + caso() * 0.8) / n) * 2 * Math.PI;
        const r = raggio * (0.35 + caso() * 0.65);
        p.push(Math.round(r * Math.cos(angolo) * 10) / 10, Math.round(r * Math.sin(angolo) * 10) / 10);
      }
      const giro = antiorario(p);
      const t = tettoInMetri(giro, {
        tipo: tipi[k % tipi.length],
        seme: k * 2654435761,
        altezza: 3 + caso() * 15,
        distanza: caso() * 2000,
      });
      // Un solo controllo per tetto (mille tetti, decine di migliaia di vertici).
      let buono = t.facce.length === t.classi.length && Number.isFinite(t.rialzo) && t.rialzo <= 7 + 1e-6;
      for (const f of t.facce) {
        for (let i = 0; i < f.length && buono; i += 3) {
          buono =
            Number.isFinite(f[i]) && Number.isFinite(f[i + 1]) && f[i + 2] >= -1e-9 &&
            f[i + 2] <= t.rialzo + 1e-6 && dentroOSulBordo(f[i], f[i + 1], giro, 0.3);
        }
      }
      if (t.forma === TETTO_FALDE) {
        aFalde++;
        // Le falde coprono l'impronta; dove non reggono resta un piano con il colmo finto (rialzo 0).
        const coperta = copertura(t, giro);
        buono = buono && t.rialzo >= 0 && coperta < 1.06 && coperta > COPERTURA_MINIMA - 0.01;
      }
      if (!buono) throw new Error(`tetto sbagliato per l'impronta ${k}: ${JSON.stringify(giro)}`);
    }
    expect(aFalde).toBeGreaterThan(550);
  });
});

describe('tetti: la forma segue il tipo di edificio', () => {
  const grande = [0, 0, 40, 0, 40, 25, 0, 25];
  it('capannone: piano, con le fasce dei lucernari di traverso al lato lungo', () => {
    const t = tettoInMetri(grande, { tipo: 'industria', seme: 5, altezza: 8, distanza: 1500 });
    expect(t.forma).toBe(TETTO_CAPANNONE);
    expect(t.rialzo).toBe(0);
    expect(t.facce.length).toBeGreaterThanOrEqual(4);
    expect(t.classi.every((c) => c === FASCIA)).toBe(true);
    controlla(t, grande);
    // Ogni fascia attraversa tutto il capannone nel verso corto.
    for (const f of t.facce) {
      const ys = f.filter((_, i) => i % 3 === 1);
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(25, 6);
    }
    // Un capannone piccolo resta piano e basta.
    expect(tettoInMetri([0, 0, 12, 0, 12, 10, 0, 10], { tipo: 'industria', seme: 5, altezza: 6, distanza: 1500 }).forma).toBe(TETTO_PIANO);
  });

  it('condominio grande e alto fuori dal centro: terrazza con il parapetto; in centro resta il cotto', () => {
    const fuori = tettoInMetri(grande, { tipo: 'casa', seme: 5, altezza: 16, distanza: 900 });
    expect(fuori.forma).toBe(TETTO_TERRAZZA);
    expect(fuori.rialzo).toBe(0);
    expect(fuori.classi).toEqual([INTERNO]);
    controlla(fuori, grande, 0);
    expect(areaFaccia(fuori.facce[0])).toBeLessThan(area(grande));
    const inCentro = tettoInMetri(grande, { tipo: 'casa', seme: 5, altezza: 16, distanza: 200 });
    expect(inCentro.forma).toBe(TETTO_FALDE);
    // Stessa pianta ma bassa: una casa, a falde.
    expect(tettoInMetri(grande, { tipo: 'casa', seme: 5, altezza: 7, distanza: 900 }).forma).toBe(TETTO_FALDE);
  });

  it('un tetto largo non diventa una montagna: il colmo ha un limite e la pendenza si adegua', () => {
    const largo = [0, 0, 60, 0, 60, 40, 0, 40];
    const t = tettoInMetri(largo, { tipo: 'casa', seme: 9, altezza: 8, distanza: 100 });
    expect(t.forma).toBe(TETTO_FALDE);
    expect(t.rialzo).toBeLessThanOrEqual(3.6 + 1e-9);
    const basso = tettoInMetri(rettangolo, { ...casa(), rialzoMassimo: 0.9 });
    expect(basso.rialzo).toBeLessThanOrEqual(0.9 + 1e-9);
    expect(basso.rialzo).toBeGreaterThan(0.5);
  });
});

describe('tetti: determinismo', () => {
  it('stessa impronta e stesso seme, stesso tetto; il seme cambia solo le scelte', () => {
    for (const p of [rettangolo, aElle, aC, conStrozzatura]) {
      const a = tettoInMetri(p, casa(42));
      const b = tettoInMetri([...p], casa(42));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
    // L'impronta data non viene toccata.
    const copia = [...aElle];
    tettoInMetri(copia, casa());
    expect(copia).toEqual(aElle);
    // Con semi diversi cambiano pendenza o forma, mai la regola dei muri.
    const forme = new Set<string>();
    for (let seme = 0; seme < 40; seme++) {
      const t = tettoInMetri(rettangolo, casa(seme * 7919));
      controlla(t, rettangolo);
      forme.add(t.facce.length + ':' + t.rialzo.toFixed(3));
    }
    expect(forme.size).toBeGreaterThan(4);
  });
});

describe('edifici nella scena', () => {
  it('le facce arrivano già proiettate, dalla più lontana alla più vicina, con il timpano in vista soltanto', () => {
    let e = preparaEdificio({ p: rettangolo, h: 9, t: 'chiesa' });
    expect(e.forma).toBe(TETTO_FALDE);
    expect(e.facce).not.toBeNull();
    const info = e.facceInfo as Uint16Array;
    const facce = e.facce as Float32Array;
    // Chiesa su un rettangolo: due falde e un solo timpano, quello del lato ovest (a sinistra).
    const classi = [...info].filter((_, i) => i % 2 === 1).map((c) => c & MASCHERA_CLASSE);
    expect(classi.filter((c) => c === TIMPANO_SINISTRO)).toHaveLength(1);
    expect(classi.filter((c) => c === TIMPANO_DESTRO)).toHaveLength(0);
    expect(classi).toHaveLength(3);
    expect(facce.length).toBe([...info].filter((_, i) => i % 2 === 0).reduce((s, n) => s + n * 2, 0));
    expect((e.pendenze as Float32Array).length).toBe(info.length);
    // Il punto più alto del disegno è il colmo: gronda più rialzo.
    let cima = Infinity;
    for (let i = 1; i < facce.length; i += 2) cima = Math.min(cima, facce[i]);
    let fondoImpronta = Infinity;
    for (let i = 1; i < e.anello.length; i += 2) fondoImpronta = Math.min(fondoImpronta, e.anello[i]);
    expect(cima).toBeLessThan(fondoImpronta - e.alt);
    expect(e.alt + e.colmo).toBeGreaterThan(9 * ISO_Z);
    // Girata di 90 gradi, il timpano in vista è quello a sud (a destra).
    e = preparaEdificio({ p: [0, 0, 8, 0, 8, 20, 0, 20], h: 9, t: 'chiesa' });
    const girate = [...(e.facceInfo as Uint16Array)].filter((_, i) => i % 2 === 1);
    expect(girate.filter((c) => c === TIMPANO_DESTRO)).toHaveLength(1);
    expect(girate.filter((c) => c === TIMPANO_SINISTRO)).toHaveLength(0);
  });

  it('tutte le facce girano nello stesso verso dell\'impronta, anche sulla punta ripida di una torre', () => {
    const verso = (p: ArrayLike<number>): boolean => {
      let a = 0;
      for (let i = 0; i < p.length; i += 2) {
        const j = (i + 2) % p.length;
        a += p[i] * p[j + 1] - p[j] * p[i + 1];
      }
      return a >= 0;
    };
    for (const t of ['casa', 'torre', 'chiesa'] as const) {
      for (const p of [rettangolo, [0, 0, 6, 0, 6, 6, 0, 6], aElle]) {
        const e = preparaEdificio({ p, h: 14, t });
        const info = e.facceInfo as Uint16Array;
        const facce = e.facce as Float32Array;
        let k = 0;
        for (let f = 0; f < info.length; f += 2) {
          const sua = facce.subarray(k, k + info[f] * 2);
          expect(verso(sua)).toBe(verso(e.anello));
          k += info[f] * 2;
        }
      }
    }
  });

  it('il riquadro di un edificio arriva fino al colmo, e un clic sul tetto a falde lo trova', () => {
    const c = creaCittaFinta(10);
    const p = [0, 0, 20, 0, 20, 8, 0, 8];
    const s = costruisciScena({ ...c.base, edifici: [{ p, h: 9, t: 'chiesa' }], alberi: [] }, c.strati, []);
    const e = s.edifici[0];
    expect(e.colmo).toBeGreaterThan(1);
    // Il punto più alto del colmo: sopra la gronda del muro più lontano.
    const colmo = metriInIso(10, 4);
    const y = colmo.sy - e.alt - e.colmo;
    expect(s.elementi.riquadri[1]).toBeLessThanOrEqual(y);
    // Appena sotto il colmo, sopra la sagoma dell'impronta alzata: è tetto solo contando le falde.
    const x = metriInIso(19.5, 4).sx;
    const yVicinoAlColmo = metriInIso(19.5, 4).sy - e.alt - e.colmo + 0.2;
    expect(puntoSuEdificio(x, yVicinoAlColmo, e.anello, e.alt, e.lati)).toBe(false);
    expect(puntoSuEdificio(x, yVicinoAlColmo, e.anello, e.alt, e.lati, e.facce, e.facceInfo)).toBe(true);
    // Ben sopra il colmo non c'è niente.
    expect(puntoSuEdificio(colmo.sx, y - 3, e.anello, e.alt, e.lati, e.facce, e.facceInfo)).toBe(false);
  });

  it('davanti a un luogo simbolo gli edifici restano bassi: il colmo non supera i 3,5 m', () => {
    const c = creaCittaFinta(300);
    const casaIn = (x: number, y: number) => ({
      p: [x - 5, y - 4, x + 5, y - 4, x + 5, y + 4, x - 5, y + 4],
      h: 12,
      t: 'casa' as const,
    });
    const luoghi = c.landmark.map((l, i) => (i === 1 ? { ...l, davanti: 40 } : l));
    const s = costruisciScena({ ...c.base, edifici: [casaIn(-25, -25), casaIn(25, 25)] }, c.strati, luoghi);
    const [davanti, dietro] = s.edifici;
    expect(davanti.alt + davanti.colmo).toBeLessThanOrEqual(ALTEZZA_DAVANTI * ISO_Z + 1e-6);
    expect(davanti.colmo).toBeGreaterThan(0);
    expect(dietro.alt + dietro.colmo).toBeGreaterThan(12 * ISO_Z);
  });

  it('davanti a un luogo simbolo anche una casa già bassa resta sotto i 3,5 m, colmo compreso', () => {
    const c = creaCittaFinta(300);
    const luoghi = c.landmark.map((l, i) => (i === 1 ? { ...l, davanti: 40 } : l));
    for (const h of [1, 2.5, 3, 3.4, 3.5, 3.6, 9]) {
      const bassa = { p: [-33, -31, -17, -31, -17, -19, -33, -19], h, t: 'casa' as const };
      const s = costruisciScena({ ...c.base, edifici: [bassa] }, c.strati, luoghi);
      const e = s.edifici[0];
      expect(e.alt + e.colmo).toBeLessThanOrEqual(Math.min(h, ALTEZZA_DAVANTI) * ISO_Z + 1e-6);
    }
  });

  it('una tettoia bassa non porta un tetto più alto dei suoi muri', () => {
    for (const h of [1, 1.8, 2.6]) {
      const e = preparaEdificio({ p: [0, 0, 16, 0, 16, 12, 0, 12], h, t: 'altro' });
      expect(e.colmo).toBeLessThanOrEqual(Math.max(0.5, h * 0.6) * ISO_Z + 1e-6);
      expect(e.alt + e.colmo).toBeLessThanOrEqual((h + Math.max(0.5, h * 0.6)) * ISO_Z + 1e-6);
    }
    // Una casa normale invece tiene il suo tetto.
    expect(preparaEdificio({ p: [0, 0, 16, 0, 16, 12, 0, 12], h: 9, t: 'casa' }).colmo).toBeGreaterThan(1.5 * ISO_Z);
  });

  it('stesso edificio, stessa pittura: la scena è identica a ogni avvio', () => {
    const c = creaCittaFinta(150);
    const una = costruisciScena(c.base, c.strati, c.landmark);
    const due = costruisciScena(creaCittaFinta(150).base, c.strati, c.landmark);
    expect(una.edifici.length).toBe(due.edifici.length);
    for (let i = 0; i < una.edifici.length; i++) {
      const a = una.edifici[i];
      const b = due.edifici[i];
      expect(a.seme).toBe(b.seme);
      expect(a.seme).toBe(semeDi(c.base.edifici[i].p));
      expect(a.forma).toBe(b.forma);
      expect(a.facce ? [...a.facce] : null).toEqual(b.facce ? [...b.facce] : null);
      expect(a.facceInfo ? [...a.facceInfo] : null).toEqual(b.facceInfo ? [...b.facceInfo] : null);
    }
    // Nella città finta ci sono tetti di più forme.
    const forme = new Set(una.edifici.map((e) => e.forma));
    expect(forme.has(TETTO_FALDE)).toBe(true);
  });
});

describe('tavolozze: le chiavi nuove nelle tre luci', () => {
  it('ogni luce ha intonaci, persiane, porte e toni delle falde, con elenchi lunghi uguali', () => {
    for (const p of Object.values(PALETTE_PER_LUCE)) {
      expect(p.intonaciForti.length).toBe(PALETTE.intonaciForti.length);
      expect(p.intonaciChiari.length).toBe(PALETTE.intonaciChiari.length);
      expect(p.tettoPiano.length).toBe(PALETTE.tettoPiano.length);
      expect(p.persiane.length).toBe(PALETTE.persiane.length);
      expect(p.porte.length).toBe(PALETTE.porte.length);
      expect(p.falde.luce).toBeGreaterThan(0);
      expect(p.falde.ombra).toBeLessThan(0);
      for (const c of [p.vetro, p.cornice, p.portico, p.telaio, p.ombraTinta.colore]) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/);
      }
      expect(p.ombraTinta.quanto).toBeGreaterThanOrEqual(0);
      expect(p.ombraTinta.quanto).toBeLessThan(0.5);
      expect(p.ombraCase === '' || p.ombraCase.startsWith('rgba(')).toBe(true);
      for (const c of [p.coppi, p.facciataOmbra, p.faldaVeloOmbra]) expect(c).toMatch(/^rgba\(/);
    }
    // Il pomeriggio ha falde più contrastate del giorno.
    expect(PALETTE_POMERIGGIO.falde.luce - PALETTE_POMERIGGIO.falde.ombra).toBeGreaterThan(
      PALETTE.falde.luce - PALETTE.falde.ombra,
    );
    // Con il sole basso l'ombra vira di più al freddo; di notte le case non stendono ombre.
    expect(PALETTE_POMERIGGIO.ombraTinta.quanto).toBeGreaterThan(PALETTE.ombraTinta.quanto);
    expect(PALETTE_NOTTE.ombraCase).toBe('');
    // Di notte il vetro spento è scuro, la finestra accesa è la luce calda di prima.
    expect(PALETTE_NOTTE.vetro).not.toBe(PALETTE.vetro);
    expect(PALETTE_NOTTE.finestra).toBe('#ffd58a');
  });

  it('la pittura ha le sue chiavi in ogni luce: china, macchie, selciato, centro, argine', () => {
    for (const p of Object.values(PALETTE_PER_LUCE)) {
      for (const c of [p.china, p.selciato, p.argine, p.centro.colore, p.macchieTinta.scuro, p.macchieTinta.chiaro]) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/);
      }
      for (const v of [p.ombraCalda, p.corrente]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      // Il velo è leggero: il colore lo danno le tinte, non le macchie.
      expect(p.macchie).toBeLessThanOrEqual(0.3);
      expect(p.macchie).toBeGreaterThan(0);
      expect(p.macchie).toBeLessThan(0.7);
      for (const v of [p.trame.selciato, p.trame.acqua, p.centro.alfa]) {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    // Di notte la mano d'acquerello pesa meno e il terreno del centro resta scuro.
    expect(PALETTE_NOTTE.macchie).toBeLessThanOrEqual(PALETTE.macchie / 2);
    // Di notte i veli sono blu, non bruni: il blu supera il rosso in tutti e due.
    for (const c of Object.values(PALETTE_NOTTE.macchieTinta)) {
      expect(parseInt(c.slice(5), 16)).toBeGreaterThan(parseInt(c.slice(1, 3), 16));
    }
    expect(PALETTE_NOTTE.centro.colore).not.toBe(PALETTE.centro.colore);
  });
});

describe('trame dipinte', () => {
  it('il rumore viene dal seme, ha media zero, sta tra -1 e 1 e si ripete ai bordi', () => {
    const ottave = [
      [3, 3, 0.5],
      [8, 8, 0.4],
    ] as const;
    const a = rumore(32, 7, ottave);
    const b = rumore(32, 7, ottave);
    expect([...a]).toEqual([...b]);
    expect([...rumore(32, 8, ottave)]).not.toEqual([...a]);
    let somma = 0;
    let massimo = 0;
    for (const v of a) {
      somma += v;
      massimo = Math.max(massimo, Math.abs(v));
    }
    expect(Math.abs(somma / a.length)).toBeLessThan(1e-4);
    expect(massimo).toBeCloseTo(1, 5);
    // Affiancata a se stessa la tessera non ha giunti: l'ultima colonna continua nella prima
    // con lo stesso passo che c'è tra due colonne vicine.
    let salto = 0;
    let dentro = 0;
    for (let y = 0; y < 32; y++) {
      salto = Math.max(salto, Math.abs(a[y * 32 + 31] - a[y * 32]));
      for (let x = 0; x < 31; x++) dentro = Math.max(dentro, Math.abs(a[y * 32 + x + 1] - a[y * 32 + x]));
    }
    expect(salto).toBeLessThanOrEqual(dentro + 1e-6);
  });

  it('i campi del velo: dal più fine al più ridotto, ognuno la media del precedente', () => {
    const c = campi().macchie;
    expect(c).toHaveLength(LIVELLI_TRAMA);
    for (let l = 1; l < c.length; l++) expect(c[l].length).toBe(c[l - 1].length / 4);
    const piccolo = dimezza(new Float32Array([1, 3, 0, 0, 5, 7, 0, 0, 0, 0, 2, 2, 0, 0, 2, 2]));
    expect([...piccolo]).toEqual([4, 0, 0, 2]);
    // La media smorza la grana: il campo ridotto non è mai più mosso di quello fine.
    const ampiezza = (v: Float32Array): number => v.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    expect(ampiezza(c[c.length - 1])).toBeLessThan(ampiezza(c[0]));
    // Da lontano la tela ridotta, da vicino quella fine; mai fuori dall'elenco.
    expect(livelloTrama(1.3)).toBe(LIVELLI_TRAMA - 1);
    expect(livelloTrama(4.8)).toBe(1);
    expect(livelloTrama(12)).toBe(0);
    expect(livelloTrama(400)).toBe(0);
    expect(livelloTrama(0)).toBe(LIVELLI_TRAMA - 1);
    let prima = LIVELLI_TRAMA;
    for (let z = 0.5; z < 40; z *= 1.3) {
      const l = livelloTrama(z);
      expect(l).toBeLessThanOrEqual(prima);
      prima = l;
    }
  });

  it('senza un documento non crea tele: la mappa resta a tinte piatte', () => {
    expect(creaMacchie(rumore(8, 1, [[2, 2, 1]]), 0.4)).toBeNull();
    expect(creaSelciato('#a98c62')).toBeNull();
  });

  it('il centro storico ha due fuochi: le piazze e la riva oltre il Ponte Vecchio', () => {
    expect(FUOCHI_CENTRO).toHaveLength(2);
    const raggio = FUOCHI_CENTRO[0].raggio;
    // Attorno al primo fuoco è la distanza dal centro della città.
    expect(lontananzaDalCentro(100, 0)).toBeCloseTo(100, 6);
    // Il Ponte Vecchio e il borgo di Angarano, subito oltre il ponte, sono dentro.
    expect(lontananzaDalCentro(-222, 104)).toBeLessThan(raggio);
    expect(lontananzaDalCentro(-560, 110)).toBeLessThan(raggio);
    // La periferia resta fuori.
    expect(lontananzaDalCentro(900, -1500)).toBeGreaterThan(raggio * 2);
  });
});

describe('livelli di dettaglio', () => {
  it('ogni strato compare sfumando: mai uno scatto', () => {
    for (const soglia of Object.values(DETTAGLI)) {
      expect(soglia.a).toBeGreaterThan(soglia.da);
      expect(presenza(soglia.da - 0.01, soglia)).toBe(0);
      expect(presenza(soglia.a + 0.01, soglia)).toBe(1);
      let prima = 0;
      for (let z = soglia.da; z <= soglia.a; z += (soglia.a - soglia.da) / 20) {
        const ora = presenza(z, soglia);
        expect(ora).toBeGreaterThanOrEqual(prima);
        expect(ora - prima).toBeLessThan(0.08);
        prima = ora;
      }
    }
    // Prima i volumi e i toni, poi i coppi e le finestre, poi persiane e cornici.
    expect(DETTAGLI.luce.da).toBeLessThan(DETTAGLI.coppi.da);
    expect(DETTAGLI.finestre.da).toBeLessThan(DETTAGLI.facciata.da);
    expect(DETTAGLI.facciata.da).toBeLessThan(DETTAGLI.cornici.da);
    expect(DETTAGLI.coppi.da).toBeLessThan(DETTAGLI.coppiFitti.da);
  });
});

describe('disegno degli edifici dipinti', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Path2D finto che conta le forme, per vedere che cosa viene preparato. */
  const stubPercorsi = (): { creati: () => number } => {
    let creati = 0;
    vi.stubGlobal(
      'Path2D',
      class {
        punti = 0;
        constructor() {
          creati++;
        }
        moveTo(): void {
          this.punti++;
        }
        lineTo(): void {
          this.punti++;
        }
        closePath(): void {}
      },
    );
    return { creati: () => creati };
  };

  /** Contesto finto: ricorda i colori di riempimento, le trasparenze usate e quante chiamate riceve. */
  const contestoFinto = () => {
    const riempimenti = new Set<string>();
    const alfe = new Set<number>();
    let riempiti = 0;
    let tracciati = 0;
    const stato: Record<string, unknown> = { canvas: { width: 1000, height: 700 }, globalAlpha: 1 };
    const ctx = new Proxy(stato, {
      get(o, nome: string) {
        if (nome === 'fill') {
          return () => {
            riempiti++;
            riempimenti.add(String(o.fillStyle));
            alfe.add(Number(o.globalAlpha));
          };
        }
        if (nome === 'stroke') return () => void tracciati++;
        if (nome in o) return o[nome];
        if (nome === 'measureText') return () => ({ width: 40 });
        return () => undefined;
      },
      set(o, nome: string, valore) {
        o[nome] = valore;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, riempimenti, alfe, riempiti: () => riempiti, tracciati: () => tracciati, stato };
  };

  const illustrazioniFinte = (quante: number): Illustrazioni =>
    ({
      elenco: Array.from({ length: quante }, () => ({ pronta: false, proporzione: 1 })),
      impostaTinta: () => undefined,
      daDisegnare: () => null,
    }) as unknown as Illustrazioni;

  const statoA = (zoom: number) => ({
    camera: { x: 0, y: 0, zoom },
    vista: { larghezza: 1000, altezza: 700 },
    densita: 1,
    visibili: { cultura: false, ambiente: false, mobilita: false },
    evidenziata: null,
    puntoSopra: -1,
    landmarkSopra: -1,
    area: { minX: -600, minY: -600, maxX: 600, maxY: 600 },
  });

  it('da lontano solo volumi e tinte; avvicinandosi finestre, persiane e porte', () => {
    stubPercorsi();
    const c = creaCittaFinta(200);
    const scena = costruisciScena(c.base, c.strati, c.landmark);
    const d = new Disegnatore(scena, illustrazioniFinte(c.landmark.length));
    const lontano = contestoFinto();
    // Appena sotto la soglia delle fasce e delle finestre (che entrano già prima dello zoom di apertura).
    d.disegna(lontano.ctx, statoA(Math.min(DETTAGLI.fasce.da, DETTAGLI.finestre.da) - 0.1));
    const vicino = contestoFinto();
    d.disegna(vicino.ctx, statoA(8));
    // Da lontano niente vetri, persiane o porte; da vicino sì.
    expect(lontano.riempimenti.has(PALETTE.vetro)).toBe(false);
    expect(PALETTE.persiane.some((p) => lontano.riempimenti.has(p))).toBe(false);
    expect(vicino.riempimenti.has(PALETTE.vetro)).toBe(true);
    expect(vicino.riempimenti.has(PALETTE.cornice)).toBe(true);
    expect(PALETTE.persiane.some((p) => vicino.riempimenti.has(p))).toBe(true);
    expect(PALETTE.porte.some((p) => vicino.riempimenti.has(p))).toBe(true);
    // I tetti sono in cotto a ogni distanza.
    expect(PALETTE.tetti.some((t) => lontano.riempimenti.has(t))).toBe(true);
    expect(PALETTE.tetti.some((t) => vicino.riempimenti.has(t))).toBe(true);
    // A metà di una soglia lo strato è steso in trasparenza, non di colpo.
    const meta = contestoFinto();
    d.disegna(meta.ctx, statoA((DETTAGLI.finestre.da + DETTAGLI.finestre.a) / 2));
    expect([...meta.alfe].some((a) => a > 0.3 && a < 0.7)).toBe(true);
    // Alla fine di ogni fotogramma la trasparenza torna piena.
    expect(meta.stato.globalAlpha).toBe(1);
    expect(vicino.stato.globalAlpha).toBe(1);
  });

  it('le forme si preparano una volta: il secondo fotogramma non ne crea di nuove', () => {
    const percorsi = stubPercorsi();
    const c = creaCittaFinta(200);
    const scena = costruisciScena(c.base, c.strati, c.landmark);
    const d = new Disegnatore(scena, illustrazioniFinte(c.landmark.length));
    // Più fotogrammi finché tutti i dettagli sono pronti (se ne prepara un numero limitato alla volta).
    for (let i = 0; i < 20; i++) {
      d.disegna(contestoFinto().ctx, statoA(6));
      if (!d.incompleto) break;
    }
    expect(d.incompleto).toBe(false);
    const dopo = percorsi.creati();
    const uno = contestoFinto();
    d.disegna(uno.ctx, statoA(6));
    const due = contestoFinto();
    d.disegna(due.ctx, statoA(6));
    // Resta solo il percorso della carta, rifatto a ogni fotogramma.
    expect(percorsi.creati() - dopo).toBeLessThanOrEqual(2);
    // Stesso fotogramma, stesse chiamate: nessuna scelta a caso.
    expect(uno.riempiti()).toBe(due.riempiti());
    expect(uno.tracciati()).toBe(due.tracciati());
    expect([...uno.riempimenti].sort()).toEqual([...due.riempimenti].sort());
  });

  it('se i dettagli da preparare sono troppi per un fotogramma, lo dice e finisce nei successivi', () => {
    stubPercorsi();
    const c = creaCittaFinta(4000, 500);
    const scena = costruisciScena(c.base, c.strati, c.landmark);
    const d = new Disegnatore(scena, illustrazioniFinte(c.landmark.length));
    // Orologio finto: ogni lettura fa passare un quarto di millisecondo. Così la prova non
    // dipende da quanto è veloce la macchina.
    let ora = 0;
    d.orologio = () => (ora += 0.25);
    const primo = contestoFinto();
    d.disegna(primo.ctx, statoA(2.7));
    expect(d.incompleto).toBe(true);
    let giri = 0;
    while (d.incompleto && giri++ < 200) d.disegna(contestoFinto().ctx, statoA(2.7));
    expect(d.incompleto).toBe(false);
    expect(giri).toBeGreaterThan(2);
    // A tempo finito gli edifici senza forme si vedono lo stesso, come impronta alzata:
    // il primo fotogramma ha già un riempimento per ognuno, poi ne ha di più.
    const pieno = contestoFinto();
    d.disegna(pieno.ctx, statoA(2.7));
    expect(primo.riempiti()).toBeGreaterThan(100);
    expect(pieno.riempiti()).toBeGreaterThan(primo.riempiti());
  });

  it('con tutto il tempo che serve le forme si preparano in un fotogramma solo', () => {
    stubPercorsi();
    const c = creaCittaFinta(400);
    const scena = costruisciScena(c.base, c.strati, c.landmark);
    const d = new Disegnatore(scena, illustrazioniFinte(c.landmark.length));
    d.orologio = () => 0;
    d.disegna(contestoFinto().ctx, statoA(4));
    expect(d.incompleto).toBe(false);
  });

  it('quando la memoria dei dettagli è piena si dimenticano solo quelli fuori vista', () => {
    stubPercorsi();
    const c = creaCittaFinta(4000, 500);
    const scena = costruisciScena(c.base, c.strati, c.landmark);
    const d = new Disegnatore(scena, illustrazioniFinte(c.landmark.length));
    d.orologio = () => 0;
    const a = (x: number, y: number) => ({ ...statoA(5), camera: { x, y, zoom: 5 } });
    // Si gira per la città: i dettagli si accumulano.
    for (const [x, y] of [[-300, -300], [-150, 200], [200, -100], [300, 300], [0, 0]]) {
      d.disegna(contestoFinto().ctx, a(x, y));
      expect(d.incompleto).toBe(false);
    }
    const accumulati = d.dettagliInMemoria;
    // Ora la memoria è troppo piena: al prossimo fotogramma si fa pulizia.
    d.bilancio.inMemoria = 250;
    const fermo = contestoFinto();
    d.disegna(fermo.ctx, a(0, 0));
    expect(d.incompleto).toBe(false);
    const inVista = d.dettagliInMemoria;
    expect(inVista).toBeLessThan(accumulati * 0.5);
    expect(inVista).toBeGreaterThan(20);
    // Il fotogramma dello spurgo e quelli dopo sono identici: finestre e coppi in vista restano.
    for (let i = 0; i < 3; i++) {
      const dopo = contestoFinto();
      d.disegna(dopo.ctx, a(0, 0));
      expect(d.incompleto).toBe(false);
      expect(dopo.riempiti()).toBe(fermo.riempiti());
      expect(dopo.tracciati()).toBe(fermo.tracciati());
      expect(d.dettagliInMemoria).toBe(inVista);
    }
  });

  it('un corpo enorme fuori dal centro ha il tetto da capannone, in centro resta in cotto', () => {
    const grande = [0, 0, 80, 0, 80, 30, 0, 30];
    const fuori = tettoInMetri(grande, { tipo: 'casa', seme: 50, altezza: 9, distanza: 1800 });
    expect(fuori.forma).toBe(TETTO_CAPANNONE);
    expect(fuori.rialzo).toBe(0);
    const inCentro = tettoInMetri(grande, { tipo: 'casa', seme: 50, altezza: 9, distanza: 300 });
    expect(inCentro.forma).toBe(TETTO_FALDE);
    // Chiese ed edifici pubblici restano in cotto anche se grandi.
    expect(tettoInMetri(grande, { tipo: 'chiesa', seme: 7, altezza: 9, distanza: 1800 }).forma).toBe(TETTO_FALDE);
  });

  it('una faccia di tetto con più di 255 vertici non si perde', () => {
    // Condominio grande e alto fuori dal centro: terrazza con la faccia interna, tanti vertici.
    const p: number[] = [];
    const lati = 300;
    for (let i = 0; i < lati; i++) {
      const angolo = (Math.PI * 2 * i) / lati;
      // Bordo a denti, perché i vertici non si semplifichino.
      const r = i % 2 === 0 ? 30 : 27.5;
      p.push(1000 + r * Math.cos(angolo), r * Math.sin(angolo));
    }
    const e = preparaEdificio({ p, h: 15, t: 'casa' });
    expect(e.forma).toBe(TETTO_TERRAZZA);
    expect(e.facceInfo).not.toBeNull();
    const info = e.facceInfo as Uint16Array;
    let massimo = 0;
    let vertici = 0;
    for (let f = 0; f < info.length; f += 2) {
      massimo = Math.max(massimo, info[f]);
      vertici += info[f];
    }
    expect(massimo).toBeGreaterThan(255);
    expect((e.facce as Float32Array).length).toBe(vertici * 2);
  });

  it('un muro curvo fatto di lati corti non si riempie di finestre strette', () => {
    const conteggi: { chiusi: number }[] = [];
    vi.stubGlobal(
      'Path2D',
      class {
        chiusi = 0;
        constructor() {
          conteggi.push(this);
        }
        moveTo(): void {}
        lineTo(): void {}
        closePath(): void {
          this.chiusi++;
        }
      },
    );
    const c = creaCittaFinta(50);
    // Stessa facciata a sud lunga 24 m: una volta dritta, una volta spezzata in dodici lati quasi allineati.
    const dritta = [0, 0, 24, 0, 24, 10, 0, 10];
    const curva: number[] = [];
    for (let i = 0; i <= 12; i++) curva.push(i * 2, -0.9 * Math.sin((Math.PI * i) / 12));
    curva.push(24, 10, 0, 10);
    const finestre = (p: number[]): number => {
      const scena = costruisciScena(
        { ...c.base, edifici: [{ p, h: 9, t: 'casa' as const }], alberi: [] },
        c.strati,
        [],
      );
      const d = new Disegnatore(scena, illustrazioniFinte(0));
      d.orologio = () => 0;
      const prima = conteggi.length;
      d.disegna(contestoFinto().ctx, { ...statoA(8), camera: { x: 12, y: 5, zoom: 8 } });
      // Il percorso con più forme chiuse tra quelli nuovi è quello delle cornici: una per apertura.
      return Math.max(...conteggi.slice(prima).map((p2) => p2.chiusi));
    };
    const suDritta = finestre(dritta);
    const suCurva = finestre(curva);
    expect(suDritta).toBeGreaterThan(10);
    // Sul muro curvo le finestre sono quante sul muro dritto, non una colonna per lato. Le due
    // impronte hanno semi diversi, quindi passi diversi (da 2,7 a 3,66 m): si lascia quel margine.
    expect(suCurva).toBeLessThanOrEqual(suDritta * 1.4);
    expect(suCurva).toBeGreaterThan(suDritta * 0.5);
  });

  it('di notte alcune finestre sono accese e le altre spente, le stesse a ogni fotogramma', () => {
    stubPercorsi();
    const c = creaCittaFinta(200);
    const scena = costruisciScena(c.base, c.strati, c.landmark);
    const d = new Disegnatore(scena, illustrazioniFinte(c.landmark.length));
    d.impostaLuce('notte');
    const a = contestoFinto();
    d.disegna(a.ctx, statoA(6));
    expect(a.riempimenti.has(PALETTE_NOTTE.finestra)).toBe(true);
    expect(a.riempimenti.has(PALETTE_NOTTE.vetro)).toBe(true);
    expect(PALETTE_NOTTE.tetti.some((t) => a.riempimenti.has(t))).toBe(true);
    const b = contestoFinto();
    d.disegna(b.ctx, statoA(6));
    expect(b.riempiti()).toBe(a.riempiti());
    // Di giorno le stesse finestre ci sono, ma sono vetri come le altre.
    d.impostaLuce('giorno');
    const giorno = contestoFinto();
    d.disegna(giorno.ctx, statoA(6));
    expect(giorno.riempimenti.has(PALETTE_NOTTE.finestra)).toBe(false);
    expect(giorno.riempimenti.has(PALETTE.vetro)).toBe(true);
  });
});
