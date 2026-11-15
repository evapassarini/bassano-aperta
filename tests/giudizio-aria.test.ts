// Giudizio a parole sulla qualità dell'aria: confini delle classi, media mobile dell'ozono,
// dati mancanti. Le soglie sono quelle scritte in src/live/giudizioAria.ts, con le fonti.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DatiAria, PuntoSerieAria } from '../src/types';
import { classeDaRapporto, giudizioAria, massimaMedia8Ore, RIFERIMENTI_ARIA, SCALA_ARIA } from '../src/live/giudizioAria';

const GIORNO = '2026-11-14';
const PRIMA = '2026-11-13';
const DOPO = '2026-11-15';

const due = (n: number): string => String(n).padStart(2, '0');

/**
 * Ore scritte di un giorno (da 00 a 23) con lo stesso valore: `ore` sono quelle da tenere
 * (predefinito: tutte e 24). L'ora scritta è la fine dell'ora di misura: "00" è l'ultima ora del
 * giorno prima, e l'ultima ora di questo giorno è la "00" del giorno dopo.
 */
function oreDi(giorno: string, valore: number, ore: number[] = [...Array(24).keys()]): PuntoSerieAria[] {
  return ore.map((h) => ({ quando: `${giorno}T${due(h)}:00:00`, valore }));
}

/** Fotografia con PM10 del giorno e ozono costante per il giorno prima e per il giorno. */
function foto(pm10: number, ozono: number): Pick<DatiAria, 'serie'> {
  return {
    serie: {
      pm10Giornaliero: [{ quando: PRIMA, valore: 99 }, { quando: GIORNO, valore: pm10 }],
      ozonoOrario: [...oreDi(PRIMA, ozono), ...oreDi(GIORNO, ozono)],
    },
  };
}

describe('scala del giudizio', () => {
  it('ha cinque classi, dalla migliore alla peggiore', () => {
    expect(SCALA_ARIA.map((f) => f.classe)).toEqual(['buona', 'accettabile', 'mediocre', 'scadente', 'pessima']);
    expect(SCALA_ARIA.map((f) => f.finoA)).toEqual([50, 100, 150, 200, Infinity]);
    for (const f of SCALA_ARIA) expect(f.etichetta.length > 0 && f.significato.length > 0).toBe(true);
  });

  it('usa come soglie 50 per il PM10 e 120 per l’ozono', () => {
    expect(RIFERIMENTI_ARIA.pm10.soglia).toBe(50);
    expect(RIFERIMENTI_ARIA.ozono.soglia).toBe(120);
  });

  it('mette il confine nella classe migliore: 50 è ancora buona, 100 ancora accettabile', () => {
    const casi: [number, string][] = [
      [0, 'buona'], [50, 'buona'], [50.1, 'accettabile'], [100, 'accettabile'], [100.1, 'mediocre'],
      [150, 'mediocre'], [150.1, 'scadente'], [200, 'scadente'], [200.1, 'pessima'], [900, 'pessima'],
    ];
    for (const [rapporto, classe] of casi) expect(classeDaRapporto(rapporto)?.classe, String(rapporto)).toBe(classe);
  });

  it('per un rapporto che non è un numero vero non dà nessuna classe, tanto meno la peggiore', () => {
    for (const rotto of [Number.NaN, -1, -Infinity, Infinity, undefined as unknown as number, '80' as unknown as number]) {
      expect(classeDaRapporto(rotto), String(rotto)).toBeNull();
    }
  });

  it('chiama il 50 e il 120 con una parola sola, e non parla di legge o di limiti superati', () => {
    expect(RIFERIMENTI_ARIA.pm10.cosa).toBe('valore di riferimento');
    expect(RIFERIMENTI_ARIA.ozono.cosa).toBe('valore di riferimento');
    const testi = [
      ...SCALA_ARIA.map((f) => f.significato),
      ...[[10, 10], [40, 10], [60, 10], [90, 10], [130, 10], [5, 130], [5, 200], [5, 300]].map(([p, o]) => giudizioAria(foto(p, o))!.spiegazione),
    ];
    for (const t of testi) {
      expect(t, t).toMatch(/riferimento/);
      expect(t, t).not.toMatch(/soglia|limite|legge|superat/i);
      expect(t, t).not.toContain('’');
    }
  });
});

describe('giudizioAria: confini di ogni classe', () => {
  it('PM10 (ozono basso): 25, 50, 75 e 100 µg/m³ chiudono le classi', () => {
    const casi: [number, string][] = [
      [0, 'buona'], [25, 'buona'], [26, 'accettabile'], [50, 'accettabile'], [51, 'mediocre'],
      [75, 'mediocre'], [76, 'scadente'], [100, 'scadente'], [101, 'pessima'],
    ];
    for (const [pm10, classe] of casi) {
      const g = giudizioAria(foto(pm10, 10));
      expect(g?.classe, `PM10 ${pm10}`).toBe(classe);
      expect(g?.decide).toBe(pm10 === 0 ? 'ozono' : 'pm10');
      expect(g?.etichetta).toBe(classe);
    }
  });

  it('ozono (PM10 basso): 60, 120, 180 e 240 µg/m³ chiudono le classi', () => {
    const casi: [number, string][] = [
      [60, 'buona'], [61, 'accettabile'], [120, 'accettabile'], [121, 'mediocre'],
      [180, 'mediocre'], [181, 'scadente'], [240, 'scadente'], [241, 'pessima'],
    ];
    for (const [ozono, classe] of casi) {
      const g = giudizioAria(foto(5, ozono));
      expect(g?.classe, `ozono ${ozono}`).toBe(classe);
      expect(g?.decide).toBe('ozono');
      expect(g?.valore).toBe(ozono);
    }
  });

  it('arrotonda la concentrazione all’intero prima di giudicare', () => {
    // 25,4 diventa 25 (buona); 25,5 diventa 26 (accettabile).
    expect(giudizioAria(foto(25.4, 10))?.classe).toBe('buona');
    expect(giudizioAria(foto(25.4, 10))?.pm10).toEqual({ valore: 25, misurato: 25.4, rapporto: 50, classe: 'buona' });
    expect(giudizioAria(foto(25.5, 10))?.classe).toBe('accettabile');
    // Il caso letto da ARPAV per Bassano, 12/11/2026: 13,399997 diventa 13, rapporto 26.
    expect(giudizioAria(foto(13.399997, 10))?.pm10.rapporto).toBe(26);
  });

  it('vale il peggiore dei due e dice chi decide', () => {
    const g = giudizioAria(foto(60, 100));
    expect(g).toMatchObject({ classe: 'mediocre', decide: 'pm10', valore: 60, unita: 'µg/m³', giorno: GIORNO });
    expect(g?.ozono.classe).toBe('accettabile');
    expect(g?.spiegazione).toContain('polveri PM10');
    const h = giudizioAria(foto(10, 200));
    expect(h).toMatchObject({ classe: 'scadente', decide: 'ozono', valore: 200 });
    expect(h?.spiegazione).toContain('ozono');
    // A parità di rapporto con la soglia decide il PM10.
    expect(giudizioAria(foto(25, 60))?.decide).toBe('pm10');
  });

  it('non dà consigli sanitari', () => {
    for (const pm10 of [10, 40, 60, 90, 130]) {
      expect(giudizioAria(foto(pm10, 10))?.spiegazione).not.toMatch(/salute|evita|consigli|rischi|sport|finestre/i);
    }
  });
});

describe('giudizioAria: giorno e dati mancanti', () => {
  it('si riferisce al giorno dell’ultimo PM10, anche se la serie non è in ordine', () => {
    const f = foto(20, 30);
    f.serie!.pm10Giornaliero!.reverse();
    expect(giudizioAria(f)?.giorno).toBe(GIORNO);
    expect(giudizioAria(f)?.pm10.valore).toBe(20);
  });

  it('con un solo inquinante non dà nessuna parola', () => {
    expect(giudizioAria({ serie: { pm10Giornaliero: [{ quando: GIORNO, valore: 20 }] } })).toBeNull();
    expect(giudizioAria({ serie: { pm10Giornaliero: [{ quando: GIORNO, valore: 20 }], ozonoOrario: [] } })).toBeNull();
    expect(giudizioAria({ serie: { ozonoOrario: oreDi(GIORNO, 30) } })).toBeNull();
    expect(giudizioAria({ serie: { pm10Giornaliero: [], ozonoOrario: oreDi(GIORNO, 30) } })).toBeNull();
  });

  it('senza serie, o con dati rotti, restituisce null', () => {
    expect(giudizioAria({})).toBeNull();
    expect(giudizioAria(null)).toBeNull();
    expect(giudizioAria(undefined)).toBeNull();
    expect(giudizioAria({ serie: {} })).toBeNull();
    const rotta = { serie: { pm10Giornaliero: 'x', ozonoOrario: 7 } } as unknown as Pick<DatiAria, 'serie'>;
    expect(giudizioAria(rotta)).toBeNull();
    const numeriRotti = foto(20, 30);
    numeriRotti.serie!.pm10Giornaliero = [
      { quando: GIORNO, valore: Number.NaN },
      { quando: GIORNO, valore: -3 },
      { quando: 'ieri', valore: 20 },
      { quando: '2026-13-40', valore: 20 },
    ];
    expect(giudizioAria(numeriRotti)).toBeNull();
  });

  it('se l’ozono del giorno del PM10 non è completo non giudica', () => {
    // L'ozono c'è solo per il giorno dopo: nessuna media per il giorno del PM10.
    expect(giudizioAria({ serie: { pm10Giornaliero: [{ quando: PRIMA, valore: 20 }], ozonoOrario: oreDi(GIORNO, 30) } })).toBeNull();
    // Solo le prime 12 ore del giorno: valgono le medie dalle 05 alle 13. Sono 9, non bastano.
    const mezza = { serie: { pm10Giornaliero: [{ quando: GIORNO, valore: 20 }], ozonoOrario: oreDi(GIORNO, 30, [...Array(12).keys()]) } };
    expect(giudizioAria(mezza)).toBeNull();
  });
});

describe('massimaMedia8Ore', () => {
  it('prende la media più alta, non l’ora più alta', () => {
    // Un'ora sola a 200 in mezzo a ore a 40: la media su 8 ore più alta è (7 x 40 + 200) / 8 = 60.
    const serie = [...oreDi(PRIMA, 40), ...oreDi(GIORNO, 40)].map((p) => (p.quando === `${GIORNO}T15:00:00` ? { ...p, valore: 200 } : p));
    expect(massimaMedia8Ore(serie, GIORNO)).toBeCloseTo(60, 10);
  });

  /** Due giorni e mezzo a 20, con le ore scritte in `alte` a 200. */
  const conPicco = (alte: string[]): PuntoSerieAria[] =>
    [...oreDi(PRIMA, 20), ...oreDi(GIORNO, 20), ...oreDi(DOPO, 20, [...Array(12).keys()])].map((p) =>
      alte.includes(p.quando) ? { ...p, valore: 200 } : p,
    );
  const sera = (giorno: string, dopo: string): string[] => [
    ...[17, 18, 19, 20, 21, 22, 23].map((h) => `${giorno}T${due(h)}:00:00`),
    `${dopo}T00:00:00`,
  ];

  it('la sera del giorno prima non entra nel giorno: la finestra dalle 16 alle 24 di ieri è di ieri', () => {
    // Ozono a 200 nelle ultime 8 ore del giorno prima (ore scritte dalle 17 alle 00). La media
    // di quelle 8 ore, 200, è del giorno prima. Per il giorno la prima finestra va dalle 17 di
    // ieri all'una: 7 ore a 200 e una a 20.
    const serie = conPicco(sera(PRIMA, GIORNO));
    expect(massimaMedia8Ore(serie, GIORNO)).toBeCloseTo((7 * 200 + 20) / 8, 10);
    expect(massimaMedia8Ore(serie, GIORNO)).toBeLessThan(200);
  });

  it('l’ultima finestra del giorno, dalle 16 alle 24, finisce all’ora scritta 00 del giorno dopo', () => {
    // Ozono a 200 nelle ultime 8 ore del giorno: la media piena, 200, è di questo giorno.
    const serie = conPicco(sera(GIORNO, DOPO));
    expect(massimaMedia8Ore(serie, GIORNO)).toBeCloseTo(200, 10);
    // E al giorno dopo ne arriva solo una parte.
    expect(giudizioAria({ serie: { pm10Giornaliero: [{ quando: GIORNO, valore: 5 }], ozonoOrario: serie } })?.ozono.valore).toBe(200);
  });

  it('le prime finestre del giorno entrano nel giorno prima', () => {
    // Giorno prima a 100, poi 20 dall'ora scritta 00: la finestra che finisce all'una ha 6 ore a 100.
    const serie = [...oreDi(PRIMA, 100), ...oreDi(GIORNO, 20)];
    expect(massimaMedia8Ore(serie, GIORNO)).toBeCloseTo((6 * 100 + 2 * 20) / 8, 10);
  });

  it('vuole almeno 6 ore su 8 per ogni media e almeno 18 medie nel giorno', () => {
    // Solo le ore scritte dalle 00 alle 23: le medie valide vanno dalle 05 alla 00 del giorno dopo. Sono 20.
    expect(massimaMedia8Ore(oreDi(GIORNO, 30), GIORNO)).toBeCloseTo(30, 10);
    // Dalle 00 alle 20: valgono le medie dalle 05 alle 22 (quella delle 22 ha 6 ore). Sono 18, il minimo.
    expect(massimaMedia8Ore(oreDi(GIORNO, 30, [...Array(21).keys()]), GIORNO)).toBeCloseTo(30, 10);
    // Dalle 00 alle 19: valgono le medie dalle 05 alle 21. Sono 17, non bastano.
    expect(massimaMedia8Ore(oreDi(GIORNO, 30, [...Array(20).keys()]), GIORNO)).toBeNull();
    // Due ore mancanti in ogni finestra vanno bene, tre no.
    const conBuchi = (ogni: number): PuntoSerieAria[] =>
      [...oreDi(PRIMA, 30), ...oreDi(GIORNO, 30)].filter((_, i) => i % ogni !== 0);
    expect(massimaMedia8Ore(conBuchi(4), GIORNO)).toBeCloseTo(30, 10);
    expect(massimaMedia8Ore(conBuchi(2), GIORNO)).toBeNull();
  });

  it('scarta ore illeggibili e giorni scritti male', () => {
    expect(massimaMedia8Ore([{ quando: 'boh', valore: 30 }], GIORNO)).toBeNull();
    expect(massimaMedia8Ore(oreDi(GIORNO, 30), '14/11/2026')).toBeNull();
    expect(massimaMedia8Ore(null, GIORNO)).toBeNull();
  });
});

describe('giudizio sulla fotografia vera (public/data/aria.json)', () => {
  const aria = JSON.parse(readFileSync(new URL('../public/data/aria.json', import.meta.url), 'utf8')) as DatiAria;

  it('se la fotografia ha le serie, il giudizio è coerente con i suoi numeri', () => {
    const g = giudizioAria(aria);
    if (!aria.serie?.pm10Giornaliero?.length || !aria.serie.ozonoOrario?.length) {
      expect(g).toBeNull();
      return;
    }
    if (!g) return; // giorno dell'ozono incompleto: nessuna parola, ed è giusto così
    expect(aria.serie.pm10Giornaliero.some((p) => p.quando === g.giorno && Math.round(p.valore) === g.pm10.valore)).toBe(true);
    // Mai il giorno della fotografia: il giorno del giudizio deve essere già finito (giorno italiano).
    const giornoFoto = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(aria.generato));
    expect(g.giorno < giornoFoto).toBe(true);
    expect(classeDaRapporto(Math.max(g.pm10.rapporto, g.ozono.rapporto))?.classe).toBe(g.classe);
    expect(Math.round(g.ozono.misurato)).toBe(g.ozono.valore);
  });
});
