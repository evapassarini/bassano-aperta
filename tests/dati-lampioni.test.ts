import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-ignore: moduli .mjs degli script, senza tipi
import * as lampioni from '../scripts/lib/lampioni.mjs';
// @ts-ignore: moduli .mjs degli script, senza tipi
import * as geo from '../scripts/lib/geo.mjs';
import type { DatiBase, DatiLampioni, Strada } from '../src/types';

const { PREDEFINITE, creaGriglia, creaIndicePoligoni, disponiLampioni, distanzaPiuPiccola, piatto, preparaVeri, veriDelFile } = lampioni;

type Punto = [number, number];
const strada = (p: number[], t: Strada['t'] = 'locale', ponte = false): Strada => (ponte ? { p, t, ponte } : { p, t });

/** Distanza di un punto da una linea piatta. */
function distanzaDaLinea([x, y]: Punto, p: number[]): number {
  let d = Infinity;
  for (let i = 2; i < p.length; i += 2) {
    d = Math.min(d, geo.distanzaDaSegmento([x, y], [p[i - 2], p[i - 1]], [p[i], p[i + 1]]));
  }
  return d;
}

/** Un piccolo quartiere finto: un viale, traverse che lo incrociano, un vicolo, la ferrovia. */
function quartiere(): Strada[] {
  const strade: Strada[] = [strada([0, 0, 400, 0, 800, 60], 'principale')];
  for (let i = 0; i < 8; i++) strade.push(strada([50 + i * 90, -200, 50 + i * 90, 0, 60 + i * 90, 220], 'locale'));
  strade.push(strada([0, 120, 300, 130, 780, 150], 'secondaria'));
  strade.push(strada([120, 40, 150, 70, 200, 75], 'pedonale'));
  strade.push(strada([-50, -100, 900, -90], 'ferrovia'));
  return strade;
}

describe('griglia spaziale', () => {
  it('trova i punti vicini anche oltre il bordo della cella e con coordinate negative', () => {
    const g = creaGriglia(24);
    g.aggiungi(23.9, 0);
    g.aggiungi(-100.5, -47.9);
    expect(g.quanti).toBe(2);
    expect(g.haVicino(24.1, 0, 24)).toBe(true); // cella accanto
    expect(g.haVicino(-96, -48.1, 24)).toBe(true);
    expect(g.haVicino(60, 0, 24)).toBe(false);
  });

  it('la distanza è stretta: un punto esattamente al raggio non conta come vicino', () => {
    const g = creaGriglia(10);
    g.aggiungi(0, 0);
    expect(g.haVicino(10, 0, 10)).toBe(false);
    expect(g.haVicino(9.9, 0, 10)).toBe(true);
  });

  it('funziona anche con un raggio più grande della cella', () => {
    const g = creaGriglia(10);
    g.aggiungi(0, 0);
    expect(g.haVicino(34, 0, 35)).toBe(true);
    expect(g.haVicino(36, 0, 35)).toBe(false);
  });
});

describe('indice di poligoni', () => {
  it('dice se un punto cade dentro uno degli anelli', () => {
    const dentro = creaIndicePoligoni([
      [0, 0, 100, 0, 100, 100, 0, 100],
      [-300, -300, -200, -300, -250, -200],
    ]);
    expect(dentro(50, 50)).toBe(true);
    expect(dentro(-250, -280)).toBe(true);
    expect(dentro(150, 50)).toBe(false);
    expect(dentro(-210, -210)).toBe(false);
  });
});

describe('lampioni veri', () => {
  it('arrotonda a 0.1 m, toglie i ripetuti e quelli fuori dal riquadro, ordina in modo stabile', () => {
    const R = { minX: -100, minY: -100, maxX: 100, maxY: 100 };
    const veri = preparaVeri([[10.04, 5.96], [10.01, 6.02], [500, 0], [-20.26, 3], [Number.NaN, 1]], R);
    expect(veri).toEqual([[-20.3, 3], [10, 6]]);
    const alContrario = preparaVeri([[-20.26, 3], [10.01, 6.02], [10.04, 5.96]], R);
    expect(alContrario).toEqual(veri);
  });
});

describe('disposizione lungo le strade', () => {
  it('è deterministica: stesso input, stesso risultato byte per byte', () => {
    const a = disponiLampioni(quartiere(), { veri: [[200, 3]] });
    const b = disponiLampioni(quartiere(), { veri: [[200, 3]] });
    expect(a.punti.length).toBeGreaterThan(40);
    expect(JSON.stringify(piatto(b.punti))).toBe(JSON.stringify(piatto(a.punti)));
    expect(b.perTipo).toEqual(a.perTipo);
  });

  it('restituisce coordinate arrotondate a 0.1 m', () => {
    const { punti } = disponiLampioni(quartiere());
    for (const [x, y] of punti as Punto[]) {
      expect(Math.round(x * 10) / 10).toBe(x);
      expect(Math.round(y * 10) / 10).toBe(y);
      expect(Object.is(x, -0) || Object.is(y, -0)).toBe(false);
    }
  });

  it('rispetta la distanza minima tra i lampioni messi, anche agli incroci', () => {
    const { punti } = disponiLampioni(quartiere());
    expect(distanzaPiuPiccola(punti)).toBeGreaterThanOrEqual(PREDEFINITE.distanzaMinima);
  });

  it('non mette doppioni dove più strade si incontrano', () => {
    // Sei strade che partono a raggiera dallo stesso punto.
    const raggiera: Strada[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      raggiera.push(strada([0, 0, Math.round(Math.cos(a) * 120), Math.round(Math.sin(a) * 120)]));
    }
    const { punti } = disponiLampioni(raggiera);
    expect(punti.length).toBeGreaterThanOrEqual(6);
    expect(distanzaPiuPiccola(punti)).toBeGreaterThanOrEqual(PREDEFINITE.distanzaMinima);
    // La stessa strada rilevata due volte non raddoppia i lampioni.
    const una = disponiLampioni([strada([0, 0, 300, 0])]).punti;
    const due = disponiLampioni([strada([0, 0, 300, 0]), strada([0, 0, 300, 0])]).punti;
    expect(due).toEqual(una);
  });

  it('non mette lampioni vicino a quelli veri', () => {
    const veri: Punto[] = [];
    for (let x = 10; x <= 800; x += 20) veri.push([x, x <= 400 ? 2 : 2 + ((x - 400) * 60) / 400]);
    const { punti } = disponiLampioni([strada([0, 0, 400, 0, 800, 60], 'principale')], { veri });
    expect(punti).toEqual([]);
    const misti = disponiLampioni(quartiere(), { veri: [[200, 3], [410, -2]] }).punti;
    expect(distanzaPiuPiccola(misti, [[200, 3], [410, -2]])).toBeGreaterThanOrEqual(PREDEFINITE.distanzaMinima);
  });

  it('non mette lampioni lungo la ferrovia', () => {
    const soloBinari = disponiLampioni([strada([0, 0, 1000, 0], 'ferrovia'), strada([0, 50, 1000, 80], 'ferrovia')]);
    expect(soloBinari.punti).toEqual([]);
    // Nel quartiere la ferrovia corre a y circa -100: nessun lampione le sta addosso,
    // tranne quelli delle traverse che la incrociano.
    const binario = [-50, -100, 900, -90];
    const traverse = quartiere().filter((s) => s.t === 'locale');
    for (const punto of disponiLampioni(quartiere()).punti as Punto[]) {
      if (distanzaDaLinea(punto, binario) > 6) continue;
      expect(traverse.some((s) => distanzaDaLinea(punto, s.p) <= 4)).toBe(true);
    }
  });

  it('tiene il passo: circa 35 m sulle strade principali, 45 m sulle locali', () => {
    const viale = disponiLampioni([strada([0, 0, 700, 0], 'principale')]).punti;
    const via = disponiLampioni([strada([0, 0, 900, 0], 'locale')]).punti;
    expect(viale).toHaveLength(20);
    expect(via).toHaveLength(20);
    expect((viale[1][0] - viale[0][0])).toBeCloseTo(35, 5);
    expect((via[1][0] - via[0][0])).toBeCloseTo(45, 5);
  });

  it('sposta i lampioni di lato: alternato sulle principali, fisso a sinistra sulle locali', () => {
    // Strada verso est: la sinistra è il nord (y positiva).
    const viale = disponiLampioni([strada([0, 0, 700, 0], 'principale')]).punti as Punto[];
    viale.forEach(([, y], k) => expect(y).toBe(k % 2 === 0 ? PREDEFINITE.scarto.principale : -PREDEFINITE.scarto.principale));
    const via = disponiLampioni([strada([0, 0, 900, 0], 'locale')]).punti as Punto[];
    for (const [, y] of via) expect(y).toBe(PREDEFINITE.scarto.locale);
    // Strada verso nord: la sinistra è l'ovest (x negativa).
    const salita = disponiLampioni([strada([0, 0, 0, 450], 'locale')]).punti as Punto[];
    for (const [x] of salita) expect(x).toBe(-PREDEFINITE.scarto.locale);
    // Lo scarto resta tra 2 e 4 metri per ogni tipo.
    for (const s of Object.values(PREDEFINITE.scarto) as number[]) {
      expect(s).toBeGreaterThanOrEqual(2);
      expect(s).toBeLessThanOrEqual(4);
    }
  });

  it('strade corte: una sola luce a metà, nessuna sotto la lunghezza minima', () => {
    const corta = disponiLampioni([strada([0, 0, 20, 0])]).punti;
    expect(corta).toEqual([[10, PREDEFINITE.scarto.locale]]);
    const cortissima = disponiLampioni([strada([0, 0, 5, 0])]);
    expect(cortissima.punti).toEqual([]);
    expect(cortissima.scartati.corte).toBe(1);
    // Tanti spezzoni corti in fila non si riempiono di lampioni.
    const spezzoni: Strada[] = [];
    for (let i = 0; i < 20; i++) spezzoni.push(strada([i * 10, 0, i * 10 + 10, 0]));
    const fila = disponiLampioni(spezzoni).punti;
    expect(fila.length).toBeLessThanOrEqual(9);
    expect(distanzaPiuPiccola(fila)).toBeGreaterThanOrEqual(PREDEFINITE.distanzaMinima);
    // Geometrie rotte non fanno danni.
    expect(disponiLampioni([strada([]), strada([3, 3]), strada([7, 7, 7, 7])]).punti).toEqual([]);
  });

  it('niente lampioni in acqua, tranne sui ponti', () => {
    const fiume = creaIndicePoligoni([[200, -500, 300, -500, 300, 500, 200, 500]]);
    const guado = disponiLampioni([strada([0, 0, 500, 0], 'locale')], { inAcqua: fiume }).punti as Punto[];
    expect(guado.length).toBeGreaterThan(0);
    for (const [x, y] of guado) expect(fiume(x, y)).toBe(false);
    const ponte = disponiLampioni([strada([0, 0, 500, 0], 'locale', true)], { inAcqua: fiume }).punti as Punto[];
    expect(ponte.some(([x, y]) => fiume(x, y))).toBe(true);
  });

  it('lungo la riva passa sul lato asciutto invece di rinunciare', () => {
    // L'acqua comincia un metro a nord dell'asse: il lato sinistro è bagnato.
    const riva = creaIndicePoligoni([[-10, 1, 500, 1, 500, 200, -10, 200]]);
    const { punti } = disponiLampioni([strada([0, 0, 450, 0], 'locale')], { inAcqua: riva });
    expect(punti).toHaveLength(10);
    for (const [, y] of punti as Punto[]) expect(y).toBe(-PREDEFINITE.scarto.locale);
  });

  it('non mette lampioni sugli edifici e resta dentro il riquadro', () => {
    const casa = creaIndicePoligoni([[0, 1, 90, 1, 90, 30, 0, 30]]);
    const R = { minX: 0, minY: -1, maxX: 90, maxY: 50 };
    const { punti } = disponiLampioni([strada([0, 0, 90, 0], 'locale')], { suEdificio: casa, riquadro: R });
    // A sinistra c'è la casa, a destra il bordo del riquadro: resta l'asse della strada.
    expect(punti).toEqual([[22.5, 0], [67.5, 0]]);
  });

  it('lascia al buio strade locali e sentieri tra campi e boschi, non le strade principali', () => {
    const campo = creaIndicePoligoni([[-50, -50, 1000, -50, 1000, 50, -50, 50]]);
    expect(disponiLampioni([strada([0, 0, 900, 0], 'locale')], { alBuio: campo }).punti).toEqual([]);
    expect(disponiLampioni([strada([0, 0, 900, 0], 'pedonale')], { alBuio: campo }).punti).toEqual([]);
    expect(disponiLampioni([strada([0, 0, 700, 0], 'principale')], { alBuio: campo }).punti).toHaveLength(20);
  });

  it('serve prima le strade importanti, qualunque sia l\'ordine in cui arrivano', () => {
    const viale = strada([0, 0, 700, 0], 'principale');
    const parallela = strada([0, 10, 700, 10], 'locale');
    const soloViale = disponiLampioni([viale]).punti;
    const insieme = disponiLampioni([parallela, viale]).punti;
    expect(insieme.slice(0, soloViale.length)).toEqual(soloViale);
  });
});

describe('lampioni nelle piazze', () => {
  // Una piazza di 60 x 40 m, lontana da ogni strada.
  const piazza = [0, 0, 60, 0, 60, 40, 0, 40];

  it('ne mette lungo il bordo, rientrati verso l\'interno, qualunque sia il verso dell\'anello', () => {
    for (const anello of [piazza, [0, 40, 60, 40, 60, 0, 0, 0]]) {
      const esito = disponiLampioni([], { piazze: [anello] });
      expect(esito.perTipo.piazza).toBeGreaterThanOrEqual(4);
      expect(esito.punti.length).toBe(esito.perTipo.piazza);
      for (const [x, y] of esito.punti as Punto[]) {
        expect(geo.puntoInPoligono([x, y], geo.daPiatto(piazza))).toBe(true);
        // Rientro di 2.5 m dal bordo.
        expect(Math.min(x, 60 - x, y, 40 - y)).toBeCloseTo(PREDEFINITE.rientroPiazza, 1);
      }
      expect(distanzaPiuPiccola(esito.punti)).toBeGreaterThanOrEqual(PREDEFINITE.distanzaMinima);
    }
  });

  it('è deterministica e accetta anelli chiusi e aperti', () => {
    const aperto = disponiLampioni([], { piazze: [piazza] });
    const chiuso = disponiLampioni([], { piazze: [[...piazza, 0, 0]] });
    expect(JSON.stringify(chiuso.punti)).toBe(JSON.stringify(aperto.punti));
  });

  it('salta le piazze piccole, gli edifici, l\'acqua e i posti già illuminati', () => {
    expect(disponiLampioni([], { piazze: [[0, 0, 10, 0, 10, 10, 0, 10]] }).punti.length).toBe(0);
    expect(disponiLampioni([], { piazze: [piazza], suEdificio: () => true }).punti.length).toBe(0);
    expect(disponiLampioni([], { piazze: [piazza], inAcqua: () => true }).punti.length).toBe(0);
    const liberi = disponiLampioni([], { piazze: [piazza] }).punti as Punto[];
    const conVero = disponiLampioni([], { piazze: [piazza], veri: [liberi[0]] }).punti as Punto[];
    expect(conVero.length).toBeLessThan(liberi.length);
    expect(distanzaPiuPiccola(conVero, [liberi[0]])).toBeGreaterThanOrEqual(PREDEFINITE.distanzaMinima);
  });

  it('le strade principali vengono prima delle piazze, le vie dopo', () => {
    const viale = strada([-100, 3, 200, 3], 'principale');
    const via = strada([-100, 37, 200, 37], 'locale');
    const soloStrade = disponiLampioni([viale, via]);
    const conPiazza = disponiLampioni([viale, via], { piazze: [piazza] });
    // Il viale tiene tutti i suoi lampioni, negli stessi posti.
    expect(conPiazza.perTipo.principale).toBe(soloStrade.perTipo.principale);
    expect(JSON.stringify(conPiazza.punti.slice(0, conPiazza.perTipo.principale))).toBe(
      JSON.stringify(soloStrade.punti.slice(0, soloStrade.perTipo.principale)),
    );
    expect(conPiazza.perTipo.piazza).toBeGreaterThan(0);
    expect(distanzaPiuPiccola(conPiazza.punti)).toBeGreaterThanOrEqual(PREDEFINITE.distanzaMinima);
  });
});

describe('quando Overpass non risponde', () => {
  it('i lampioni veri si riprendono dal file che c\'è già', () => {
    expect(veriDelFile({ generato: '', fonte: '', veri: 2, p: [1, 2, 3, 4, 50, 60] })).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('un file senza veri, assente o rovinato non dà nulla', () => {
    expect(veriDelFile({ veri: 0, p: [1, 2] })).toEqual([]);
    expect(veriDelFile(null)).toEqual([]);
    expect(veriDelFile('testo')).toEqual([]);
    expect(veriDelFile({ veri: 3, p: [1, 2] })).toEqual([]);
    expect(veriDelFile({ veri: 1.5, p: [1, 2, 3, 4] })).toEqual([]);
    expect(veriDelFile({ veri: 1, p: [null, 2] })).toEqual([]);
    expect(veriDelFile({ veri: 1 })).toEqual([]);
  });

  it('i veri ripresi dal file di oggi sono gli stessi punti, nello stesso ordine', () => {
    const percorso = new URL('../public/data/lampioni.json', import.meta.url);
    if (!existsSync(percorso)) return;
    const dati: DatiLampioni = JSON.parse(readFileSync(percorso, 'utf8'));
    const ripresi = preparaVeri(veriDelFile(dati), geo.riquadroInMetri());
    expect(piatto(ripresi)).toEqual(dati.p.slice(0, dati.veri * 2));
  });
});

describe('public/data/lampioni.json', () => {
  const percorso = new URL('../public/data/lampioni.json', import.meta.url);
  const dati: DatiLampioni | null = existsSync(percorso) ? JSON.parse(readFileSync(percorso, 'utf8')) : null;
  const R = geo.riquadroInMetri();

  it('esiste ed è nella forma di DatiLampioni', () => {
    expect(dati).not.toBeNull();
    if (!dati) return;
    expect(Number.isNaN(Date.parse(dati.generato))).toBe(false);
    expect(dati.fonte).toMatch(/OpenStreetMap/);
    expect(dati.fonte).toMatch(/illustrativo/);
    expect(dati.fonte).not.toMatch(/[—–]/);
    expect(Number.isInteger(dati.veri)).toBe(true);
    expect(dati.veri).toBeGreaterThanOrEqual(0);
    expect(dati.p.length % 2).toBe(0);
    expect(dati.veri * 2).toBeLessThanOrEqual(dati.p.length);
  });

  it('ha tra 4.000 e 9.000 lampioni, tutti nel riquadro e arrotondati a 0.1 m', () => {
    if (!dati) return;
    const quanti = dati.p.length / 2;
    expect(quanti).toBeGreaterThanOrEqual(4000);
    expect(quanti).toBeLessThanOrEqual(9000);
    let fuori = 0;
    let nonDecimi = 0;
    for (let i = 0; i < dati.p.length; i += 2) {
      const x = dati.p[i];
      const y = dati.p[i + 1];
      if (!(x >= R.minX && x <= R.maxX && y >= R.minY && y <= R.maxY)) fuori++;
      if (Math.round(x * 10) / 10 !== x || Math.round(y * 10) / 10 !== y) nonDecimi++;
    }
    expect(fuori).toBe(0);
    expect(nonDecimi).toBe(0);
  });

  it('gli illustrativi stanno a distanza tra loro e dai veri, e non ripetono un punto', () => {
    if (!dati) return;
    const punti = geo.daPiatto(dati.p) as Punto[];
    const veri = punti.slice(0, dati.veri);
    const illustrativi = punti.slice(dati.veri);
    expect(distanzaPiuPiccola(illustrativi)).toBeGreaterThanOrEqual(PREDEFINITE.distanzaMinima);
    if (veri.length) expect(distanzaPiuPiccola(illustrativi, veri)).toBeGreaterThanOrEqual(PREDEFINITE.distanzaMinima);
    expect(new Set(punti.map(([x, y]) => `${x}:${y}`)).size).toBe(punti.length);
  });

  it('gli illustrativi stanno lungo una strada che non è ferrovia o dentro una piazza, e fuori dagli edifici', () => {
    if (!dati) return;
    const base: DatiBase = JSON.parse(readFileSync(new URL('../public/data/base.json', import.meta.url), 'utf8'));
    const illustrativi = (geo.daPiatto(dati.p) as Punto[]).slice(dati.veri);
    // Griglia dei segmenti di strada (non ferrovia) per cercare in fretta.
    const CELLA = 50;
    const celle = new Map<string, number[][]>();
    for (const s of base.strade) {
      if (s.t === 'ferrovia') continue;
      for (let i = 2; i < s.p.length; i += 2) {
        const seg = [s.p[i - 2], s.p[i - 1], s.p[i], s.p[i + 1]];
        const i0 = Math.floor((Math.min(seg[0], seg[2]) - 5) / CELLA);
        const i1 = Math.floor((Math.max(seg[0], seg[2]) + 5) / CELLA);
        const j0 = Math.floor((Math.min(seg[1], seg[3]) - 5) / CELLA);
        const j1 = Math.floor((Math.max(seg[1], seg[3]) + 5) / CELLA);
        for (let a = i0; a <= i1; a++) {
          for (let b = j0; b <= j1; b++) {
            const k = `${a}:${b}`;
            if (!celle.has(k)) celle.set(k, []);
            celle.get(k)!.push(seg);
          }
        }
      }
    }
    const suEdificio = creaIndicePoligoni(base.edifici.map((e) => e.p));
    const inPiazza = creaIndicePoligoni(base.aree.filter((a) => a.t === 'piazza').map((a) => a.p));
    let inPiazze = 0;
    let lontani = 0;
    let suCase = 0;
    for (const [x, y] of illustrativi) {
      const vicini = celle.get(`${Math.floor(x / CELLA)}:${Math.floor(y / CELLA)}`) || [];
      // Scarto massimo 4 m, più l'arrotondamento.
      if (!vicini.some((s) => geo.distanzaDaSegmento([x, y], [s[0], s[1]], [s[2], s[3]]) <= 4.2)) {
        if (inPiazza(x, y)) inPiazze++;
        else lontani++;
      }
      if (suEdificio(x, y)) suCase++;
    }
    expect(lontani).toBe(0);
    expect(suCase).toBe(0);
    // Le piazze del centro non restano al buio.
    expect(inPiazze).toBeGreaterThan(0);
    expect(dati.fonte).toMatch(/piazze/);
  });
});
