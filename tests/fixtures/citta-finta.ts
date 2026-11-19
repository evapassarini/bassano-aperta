// Città finta e deterministica per provare la mappa senza i dati veri.
// Non è Bassano: è una griglia di isolati con un fiume, qualche prato e dei viali.

import type {
  Area,
  DatiBase,
  DatiStrati,
  Edificio,
  Landmark,
  Linea,
  Punto,
  Strada,
  TipoEdificio,
} from '../../src/types';

/** Generatore pseudo-casuale con seme (mulberry32). */
function casuale(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const arrotonda = (v: number): number => Math.round(v * 10) / 10;

export interface CittaFinta {
  base: DatiBase;
  strati: DatiStrati;
  landmark: Landmark[];
}

/**
 * @param edificiVoluti quanti edifici generare, circa
 * @param mezzoLato mezza larghezza della città in metri
 */
export function creaCittaFinta(edificiVoluti = 400, mezzoLato = 600): CittaFinta {
  const r = casuale(2029);
  const edifici: Edificio[] = [];
  const strade: Strada[] = [];
  const aree: Area[] = [];
  const alberi: number[] = [];

  // Il fiume scorre da nord a sud, a ovest del centro, largo 80 metri.
  const fiumeX = -260;
  aree.push({
    t: 'acqua',
    p: [fiumeX - 40, -mezzoLato, fiumeX + 40, -mezzoLato, fiumeX + 40, mezzoLato, fiumeX - 40, mezzoLato],
  });
  aree.push({ t: 'parco', p: [100, 100, 220, 100, 220, 200, 100, 200] });
  aree.push({ t: 'piazza', p: [-40, -30, 40, -30, 40, 30, -40, 30] });
  aree.push({ t: 'coltivo', p: [300, -500, 560, -500, 560, -300, 300, -300] });
  aree.push({ t: 'bosco', p: [-560, 300, -340, 300, -340, 560, -560, 560] });
  aree.push({ t: 'prato', p: [-200, -200, -120, -200, -120, -120, -200, -120] });

  const passo = Math.max(14, (2 * mezzoLato) / Math.ceil(Math.sqrt(edificiVoluti)));
  const tipi: TipoEdificio[] = ['casa', 'casa', 'casa', 'casa', 'pubblico', 'altro', 'industria'];
  for (let y = -mezzoLato + passo / 2; y < mezzoLato; y += passo) {
    for (let x = -mezzoLato + passo / 2; x < mezzoLato; x += passo) {
      if (Math.abs(x - fiumeX) < 55) continue; // niente case nel fiume
      if (Math.abs(x) < 45 && Math.abs(y) < 35) continue; // né in piazza
      const l = passo * (0.3 + r() * 0.12);
      const a = passo * (0.25 + r() * 0.15);
      let t = tipi[Math.floor(r() * tipi.length)];
      let h = 5 + Math.floor(r() * 10);
      if (r() < 0.01) {
        t = 'torre';
        h = 28;
      } else if (r() < 0.015) {
        t = 'chiesa';
        h = 16;
      }
      const p = [x - l, y - a, x + l, y - a, x + l, y + a, x - l, y + a].map(arrotonda);
      edifici.push({ p, h, t });
    }
  }

  // Viali a croce, un ponte sul fiume e una ferrovia in diagonale.
  strade.push({ t: 'principale', p: [-mezzoLato, 0, fiumeX - 45, 0] });
  strade.push({ t: 'principale', ponte: true, p: [fiumeX - 45, 0, fiumeX + 45, 0] });
  strade.push({ t: 'principale', p: [fiumeX + 45, 0, mezzoLato, 0] });
  strade.push({ t: 'secondaria', p: [0, -mezzoLato, 0, mezzoLato] });
  strade.push({ t: 'locale', p: [-100, -mezzoLato, -100, mezzoLato] });
  strade.push({ t: 'pedonale', p: [-40, 30, 40, 30, 40, -30] });
  strade.push({ t: 'ferrovia', p: [-mezzoLato, -mezzoLato, mezzoLato, mezzoLato * 0.6] });

  for (let i = 0; i < 60; i++) {
    alberi.push(arrotonda(100 + r() * 120), arrotonda(100 + r() * 100));
  }
  for (let i = 0; i < 40; i++) {
    alberi.push(arrotonda(fiumeX + 48 + r() * 6), arrotonda(-mezzoLato + r() * 2 * mezzoLato));
  }

  const punti: Punto[] = [
    { id: 'museo', strato: 'cultura', tipo: 'museo', nome: 'Museo Civico', x: 60, y: 80, storia: 'museo-civico' },
    { id: 'teatro', strato: 'cultura', tipo: 'teatro', nome: 'Teatro di prova', x: -60, y: -90, nota: 'Solo per i test.' },
    { id: 'aria', strato: 'ambiente', tipo: 'aria', nome: 'Centralina aria', x: 150, y: -40, nota: 'Solo per i test.' },
    { id: 'idro', strato: 'ambiente', tipo: 'idrometro', nome: 'Idrometro', x: fiumeX + 40, y: 120, storia: 'brenta' },
    { id: 'staz', strato: 'mobilita', tipo: 'stazione', nome: 'Stazione', x: 200, y: 260 },
    { id: 'bus', strato: 'mobilita', tipo: 'fermata-bus', nome: 'Fermata', x: -20, y: 140 },
  ];
  const linee: Linea[] = [
    { id: 'cicl', strato: 'mobilita', tipo: 'ciclabile', nome: 'Ciclabile di prova', p: [fiumeX + 50, -400, fiumeX + 50, 400] },
    { id: 'ferr', strato: 'mobilita', tipo: 'ferrovia', p: [-mezzoLato, -mezzoLato, mezzoLato, mezzoLato * 0.6] },
  ];

  const landmark: Landmark[] = [
    {
      id: 'ponte-vecchio',
      file: 'ponte-vecchio.svg',
      // Circa 260 metri a ovest dell'origine: sul fiume finto.
      lat: 45.7665,
      lon: 11.73115,
      larghezzaMetri: 120,
      ancora: [0.5, 0.7],
      storia: 'ponte-vecchio',
      nome: 'Ponte Vecchio',
    },
    {
      id: 'torre-civica-piazze',
      file: 'torre-civica-piazze.svg',
      lat: 45.7665,
      lon: 11.7345,
      larghezzaMetri: 60,
      ancora: [0.5, 0.85],
      storia: 'torre-civica-piazze',
      nome: 'Torre Civica',
    },
  ];

  return {
    base: { fonte: 'Dati finti per i test', edifici, strade, aree, alberi },
    strati: { fonti: [], punti, linee },
    landmark,
  };
}
