import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import campione from './fixtures/brenta-arpav.json';
import { etaInOre, interpretaBrenta, millisDi, tendenza } from '../src/live/brenta';
import { interpretaTreni, numeroTreno } from '../src/live/treni';

// Il campione è un pezzo vero della risposta ARPAV del 14 novembre 2026:
// le ultime otto ore di livello (49 letture) e di portata (48 letture).

describe('interpretaBrenta, sul campione vero', () => {
  const lettura = interpretaBrenta(campione);

  it("prende l'ultimo livello e la sua ora, così come la scrive ARPAV", () => {
    expect(lettura.livello).toBe(0.96);
    expect(lettura.quando).toBe('2026-11-14T23:40:00');
  });

  it('prende la portata più recente, anche se è di dieci minuti prima', () => {
    expect(lettura.portata).toBe(51.79);
    // ARPAV pubblica la portata un passo dopo il livello: l'ora della portata va detta.
    expect(lettura.quandoPortata).toBe('2026-11-14T23:30:00');
    expect(lettura.quandoPortata).not.toBe(lettura.quando);
  });

  it('costruisce la serie dei soli livelli, dal più vecchio al più recente', () => {
    expect(lettura.serie).toHaveLength(49);
    expect(lettura.serie[0]).toEqual({ quando: '2026-11-14T15:40:00', livello: 0.72 });
    expect(lettura.serie.at(-1)).toEqual({ quando: '2026-11-14T23:40:00', livello: 0.96 });
    const tempi = lettura.serie.map((p) => millisDi(p.quando));
    expect([...tempi].sort((a, b) => a - b)).toEqual(tempi);
    expect(Math.min(...lettura.serie.map((p) => p.livello))).toBe(0.71);
    expect(Math.max(...lettura.serie.map((p) => p.livello))).toBe(0.97);
    // Nessun valore di portata (decine di m³/s) finito tra i livelli.
    expect(lettura.serie.every((p) => p.livello < 5)).toBe(true);
  });

  it('dice che il fiume è stabile rispetto a tre ore prima (0,95 → 0,96 m)', () => {
    expect(tendenza(lettura.serie)).toEqual({ verso: 'stabile', differenza: 0.01, ore: 3 });
  });

  it('dice che è salito rispetto a otto ore prima (0,72 → 0,96 m)', () => {
    expect(tendenza(lettura.serie, 8)).toEqual({ verso: 'sale', differenza: 0.24, ore: 8 });
  });
});

describe('interpretaBrenta, casi limite', () => {
  const riga = (tipo: string, dataora: string, valore: unknown) => ({
    codice: 283,
    nome_stazione: 'Brenta a Barzizza',
    nome_sensore: tipo === 'PORT' ? 'Portata' : 'Livello idrometrico 1',
    dataora,
    valore,
    unitnm: tipo === 'PORT' ? 'm3/s' : 'm',
    tipo,
  });

  it('ordina le letture anche se arrivano mescolate', () => {
    const l = interpretaBrenta({
      success: true,
      data: [
        riga('LIDRO', '2026-11-14T10:20:00', '0.80'),
        riga('LIDRO', '2026-11-14T10:00:00', '0.70'),
        riga('LIDRO', '2026-11-14T10:10:00', '0.75'),
      ],
    });
    expect(l.livello).toBe(0.8);
    expect(l.serie.map((p) => p.livello)).toEqual([0.7, 0.75, 0.8]);
  });

  it('lascia la portata a null se manca o se è troppo vecchia', () => {
    const senza = interpretaBrenta({ success: true, data: [riga('LIDRO', '2026-11-14T10:00:00', '0.70')] });
    expect(senza.portata).toBeNull();
    expect(senza.quandoPortata).toBeNull();
    const vecchia = interpretaBrenta({
      success: true,
      data: [riga('LIDRO', '2026-11-14T10:00:00', '0.70'), riga('PORT', '2026-11-14T07:00:00', '40.1')],
    });
    expect(vecchia.portata).toBeNull();
  });

  it('salta i valori vuoti o non numerici invece di inventarli', () => {
    const l = interpretaBrenta({
      success: true,
      data: [
        riga('LIDRO', '2026-11-14T10:00:00', '0.70'),
        riga('LIDRO', '2026-11-14T10:10:00', null),
        riga('LIDRO', '2026-11-14T10:20:00', ''),
        riga('LIDRO', '2026-11-14T10:30:00', 'n.d.'),
      ],
    });
    expect(l.serie).toHaveLength(1);
    expect(l.quando).toBe('2026-11-14T10:00:00');
  });

  it('rifiuta le risposte senza livelli o con una forma diversa', () => {
    expect(() => interpretaBrenta(null)).toThrow();
    expect(() => interpretaBrenta({ success: false, data: [] })).toThrow();
    expect(() => interpretaBrenta({ success: true, data: [] })).toThrow();
    expect(() => interpretaBrenta({ success: true })).toThrow();
    expect(() => interpretaBrenta({ success: true, data: [riga('PORT', '2026-11-14T10:00:00', '40')] })).toThrow();
  });
});

describe('tendenza', () => {
  const serie = (coppie: [string, number][]) => coppie.map(([quando, livello]) => ({ quando, livello }));

  it('riconosce quando il fiume scende', () => {
    const t = tendenza(
      serie([
        ['2026-11-14T09:00:00', 1.2],
        ['2026-11-14T10:30:00', 1.15],
        ['2026-11-14T12:00:00', 1.08],
      ]),
    );
    expect(t).toEqual({ verso: 'scende', differenza: -0.12, ore: 3 });
  });

  it('sotto i 2 centimetri parla di fiume stabile', () => {
    const t = tendenza(
      serie([
        ['2026-11-14T09:00:00', 1.0],
        ['2026-11-14T12:00:00', 1.01],
      ]),
    );
    expect(t?.verso).toBe('stabile');
  });

  it('non fa confronti se la serie è troppo corta', () => {
    expect(tendenza([])).toBeNull();
    expect(tendenza(serie([['2026-11-14T12:00:00', 1]]))).toBeNull();
    expect(
      tendenza(
        serie([
          ['2026-11-14T11:40:00', 1],
          ['2026-11-14T12:00:00', 1.3],
        ]),
      ),
    ).toBeNull();
  });
});

describe('etaInOre', () => {
  it("conta le ore dall'ultima lettura, leggendo l'ora come ora solare italiana", () => {
    const adesso = new Date('2026-11-14T23:10:00Z'); // le 00:10 in Italia
    expect(etaInOre('2026-11-14T23:40:00', adesso)).toBeCloseTo(0.5, 5);
    expect(etaInOre('2026-11-14T12:10:00', adesso)).toBeCloseTo(12, 5);
  });
});

describe('leggiBrenta e leggiAria', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
  });

  const rispostaOk = (corpo: unknown) => ({ ok: true, status: 200, json: async () => corpo });

  it("chiama l'indirizzo di ARPAV e tiene il risultato in memoria per 5 minuti", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T23:00:00Z'));
    const finto = vi.fn(async () => rispostaOk(campione));
    vi.stubGlobal('fetch', finto);
    const { leggiBrenta } = await import('../src/live/index');

    const prima = await leggiBrenta();
    expect(prima.livello).toBe(0.96);
    expect(finto).toHaveBeenCalledTimes(1);
    expect(String(finto.mock.calls[0]![0 as never])).toBe(
      'https://api.arpa.veneto.it/REST/v1/meteo_meteogrammi_tabella?codseqst=300001722',
    );

    vi.setSystemTime(new Date('2026-11-14T23:04:59Z'));
    await leggiBrenta();
    expect(finto).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-11-14T23:05:01Z'));
    await leggiBrenta();
    expect(finto).toHaveBeenCalledTimes(2);
  });

  it('rifiuta se la rete fallisce e alla chiamata dopo riprova', async () => {
    const finto = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('rete assente'))
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce(rispostaOk(campione));
    vi.stubGlobal('fetch', finto);
    const { leggiBrenta } = await import('../src/live/index');

    await expect(leggiBrenta()).rejects.toThrow();
    await expect(leggiBrenta()).rejects.toThrow();
    await expect(leggiBrenta()).resolves.toMatchObject({ livello: 0.96 });
    expect(finto).toHaveBeenCalledTimes(3);
  });

  it('legge data/aria.json sotto BASE_URL e controlla la forma', async () => {
    const aria = {
      generato: '2026-11-14T05:00:00Z',
      stazione: 'Bassano del Grappa',
      fonte: { nome: 'ARPAV', url: 'https://www.arpa.veneto.it/', licenza: 'CC BY 4.0' },
      misure: [{ inquinante: 'PM10', valore: 23, unita: 'µg/m³', quando: '2026-11-13' }],
    };
    const finto = vi.fn().mockResolvedValueOnce(rispostaOk({ sbagliato: true })).mockResolvedValueOnce(rispostaOk(aria));
    vi.stubGlobal('fetch', finto);
    const { leggiAria } = await import('../src/live/index');

    await expect(leggiAria()).rejects.toThrow();
    await expect(leggiAria()).resolves.toEqual(aria);
    expect(String(finto.mock.calls[0]![0])).toBe(`${import.meta.env.BASE_URL}data/aria.json`);
  });
});

// ---------------------------------------------------------------------------
// Treni alla stazione di Bassano. Dati finti, con la forma del feed di BusOne.
// ---------------------------------------------------------------------------

const ADESSO = new Date('2026-11-15T08:00:00Z');
const sec = (iso: string): string => String(Date.parse(iso) / 1000);
const STAZIONI: Record<string, string> = {
  '02520': 'Bassano del Grappa',
  '02593': 'Venezia S. Lucia',
  '02581': 'Padova',
  '02044': 'Trento',
};

interface FermataFinta {
  codice: string;
  ora?: string;
  ritardo?: number;
  arrivo?: string | null;
  stato?: string;
}

function corsa(numero: string, fermate: FermataFinta[], stato = 'SCHEDULED'): unknown {
  return {
    id: `corsa-${numero}`,
    tripUpdate: {
      trip: {
        tripId: `0083_10083_0_v_1-${numero}-31B9-0083_v_1-${numero}-31B9-0083`,
        routeId: 'R',
        startDate: '20261115',
        scheduleRelationship: stato,
      },
      delay: 0,
      stopTimeUpdate: fermate.map((f, i) => ({
        stopSequence: i + 1,
        stopId: f.codice,
        ...(f.arrivo === null ? {} : { arrival: { delay: f.ritardo ?? 0, time: sec(f.arrivo ?? f.ora ?? '2026-11-15T08:30:00Z') } }),
        ...(f.ora ? { departure: { delay: f.ritardo ?? 0, time: sec(f.ora) } } : {}),
        scheduleRelationship: f.stato ?? 'SCHEDULED',
      })),
    },
  };
}

const feed = (...entity: unknown[]): unknown => ({ header: { timestamp: sec('2026-11-15T07:59:30Z') }, entity });

describe('interpretaTreni', () => {
  it('legge il numero del treno dal codice della corsa', () => {
    expect(numeroTreno('0083_10083_0_v_1-16313-31B9-0083_v_1-16313-31B9-0083')).toBe('16313');
    expect(numeroTreno('0083_10083_0_p_1-5712-31B9')).toBe('5712');
    expect(numeroTreno('senza-numero')).toBeNull();
    expect(numeroTreno(undefined)).toBeNull();
  });

  it('riconosce una partenza: Bassano è la prima fermata', () => {
    const lettura = interpretaTreni(
      feed(
        corsa('16313', [
          { codice: '02520', ora: '2026-11-15T08:20:00Z', ritardo: 0 },
          { codice: '02581', ora: '2026-11-15T09:10:00Z' },
          { codice: '02593', arrivo: '2026-11-15T09:40:00Z' },
        ]),
      ),
      STAZIONI,
      ADESSO,
    );
    expect(lettura.quando).toBe('2026-11-15T07:59:30.000Z');
    expect(lettura.treni).toEqual([
      {
        numero: '16313',
        verso: 'partenza',
        da: 'Bassano del Grappa',
        a: 'Venezia S. Lucia',
        quando: '2026-11-15T08:20:00.000Z',
        ritardoMinuti: 0,
        soppresso: false,
      },
    ]);
  });

  it("riconosce un arrivo e usa l'ora di arrivo, anche se c'è una partenza", () => {
    const [treno] = interpretaTreni(
      feed(
        corsa('16320', [
          { codice: '02593', ora: '2026-11-15T07:10:00Z' },
          { codice: '02520:platform:2', ora: '2026-11-15T08:31:00Z', arrivo: '2026-11-15T08:27:00Z', ritardo: 420 },
        ]),
      ),
      STAZIONI,
      ADESSO,
    ).treni;
    expect(treno).toMatchObject({
      verso: 'arrivo',
      da: 'Venezia S. Lucia',
      a: 'Bassano del Grappa',
      quando: '2026-11-15T08:27:00.000Z',
      ritardoMinuti: 7,
    });
  });

  it('riconosce un transito, con il binario nel codice della fermata', () => {
    const [treno] = interpretaTreni(
      feed(
        corsa('5712', [
          { codice: '02581', ora: '2026-11-15T07:30:00Z' },
          { codice: '02520:platform:1', ora: '2026-11-15T08:15:00Z', arrivo: '2026-11-15T08:12:00Z', ritardo: 150 },
          { codice: '02044', arrivo: '2026-11-15T10:00:00Z' },
        ]),
      ),
      STAZIONI,
      ADESSO,
    ).treni;
    expect(treno).toMatchObject({ verso: 'transito', da: 'Padova', a: 'Trento', quando: '2026-11-15T08:15:00.000Z' });
    // 150 secondi: si arrotonda al minuto.
    expect(treno.ritardoMinuti).toBe(3);
  });

  it("se manca l'ora di partenza usa quella di arrivo", () => {
    const [treno] = interpretaTreni(
      feed(
        corsa('5714', [
          { codice: '02581', ora: '2026-11-15T07:30:00Z' },
          { codice: '02520', arrivo: '2026-11-15T08:40:00Z', ritardo: -60 },
          { codice: '02044', arrivo: '2026-11-15T10:00:00Z' },
        ]),
      ),
      STAZIONI,
      ADESSO,
    ).treni;
    expect(treno).toMatchObject({ verso: 'transito', quando: '2026-11-15T08:40:00.000Z', ritardoMinuti: -1 });
  });

  it('accetta le chiavi in snake_case e i numeri al posto delle stringhe', () => {
    const lettura = interpretaTreni(
      {
        header: { timestamp: Date.parse('2026-11-15T07:58:00Z') / 1000 },
        entity: [
          {
            trip_update: {
              trip: { trip_id: '0083_1_0_p_1-2733-AA', schedule_relationship: 'SCHEDULED' },
              stop_time_update: [
                { stop_sequence: 1, stop_id: '02520', departure: { delay: 300, time: Date.parse('2026-11-15T08:05:00Z') / 1000 } },
                { stop_sequence: 2, stop_id: '02581', arrival: { delay: 300, time: sec('2026-11-15T09:00:00Z') } },
              ],
            },
          },
        ],
      },
      STAZIONI,
      ADESSO,
    );
    expect(lettura.quando).toBe('2026-11-15T07:58:00.000Z');
    expect(lettura.treni).toEqual([
      {
        numero: '2733',
        verso: 'partenza',
        da: 'Bassano del Grappa',
        a: 'Padova',
        quando: '2026-11-15T08:05:00.000Z',
        ritardoMinuti: 5,
        soppresso: false,
      },
    ]);
  });

  it('segna come soppressa una corsa cancellata o una fermata saltata', () => {
    const fermate: FermataFinta[] = [
      { codice: '02520', ora: '2026-11-15T08:20:00Z' },
      { codice: '02581', arrivo: '2026-11-15T09:10:00Z' },
    ];
    const lettura = interpretaTreni(
      feed(
        corsa('100', fermate, 'CANCELED'),
        corsa('200', [{ ...fermate[0], ora: '2026-11-15T08:30:00Z', stato: 'SKIPPED' }, fermate[1]]),
        corsa('300', [{ ...fermate[0], ora: '2026-11-15T08:40:00Z' }, { ...fermate[1], stato: 'SKIPPED' }]),
      ),
      STAZIONI,
      ADESSO,
    );
    expect(lettura.treni.map((t) => [t.numero, t.soppresso])).toEqual([
      ['100', true],
      ['200', true],
      // La fermata saltata non è Bassano: qui il treno passa.
      ['300', false],
    ]);
  });

  it('salta le voci malformate senza perdere le altre', () => {
    const buona = corsa('16313', [
      { codice: '02520', ora: '2026-11-15T08:20:00Z' },
      { codice: '02581', arrivo: '2026-11-15T09:10:00Z' },
    ]);
    const lettura = interpretaTreni(
      feed(
        null,
        'testo',
        42,
        {},
        { tripUpdate: null },
        { tripUpdate: { trip: { tripId: 'x_v_1-1-A' } } },
        { tripUpdate: { trip: { tripId: 'x_v_1-2-A' }, stopTimeUpdate: 'no' } },
        // Bassano senza orario.
        { tripUpdate: { trip: { tripId: 'x_v_1-3-A' }, stopTimeUpdate: [{ stopId: '02520' }, null, { stopId: '02581' }] } },
        // Orario che non è un numero.
        { tripUpdate: { trip: { tripId: 'x_v_1-4-A' }, stopTimeUpdate: [{ stopId: '02520', departure: { time: 'presto' } }] } },
        // Una corsa che non passa da Bassano.
        corsa('9999', [
          { codice: '02581', ora: '2026-11-15T08:20:00Z' },
          { codice: '02593', arrivo: '2026-11-15T08:50:00Z' },
        ]),
        // Un codice che comincia allo stesso modo ma è un'altra stazione.
        corsa('8888', [
          { codice: '025201', ora: '2026-11-15T08:20:00Z' },
          { codice: '02593', arrivo: '2026-11-15T08:50:00Z' },
        ]),
        buona,
        // La stessa corsa due volte: si tiene una volta sola.
        buona,
      ),
      STAZIONI,
      ADESSO,
    );
    expect(lettura.treni.map((t) => t.numero)).toEqual(['16313']);
  });

  it('legge il numero anche quando il prefisso non è "_v_1-" (forme vere: _v_5-, _v_62-, _v_68-)', () => {
    expect(numeroTreno('0083_50083_0_v_5-5506-31B9-0083_v_5-5506-31B9-0083')).toBe('5506');
    expect(numeroTreno('0083_620083_0_v_62-3632-31B9-0083_v_62-3632-31B9-0083')).toBe('3632');
    expect(numeroTreno('0083_680083_0_p_68-2251-31B9')).toBe('2251');
    const lettura = interpretaTreni(
      feed({
        tripUpdate: {
          trip: { tripId: '0083_50083_0_v_5-5506-31B9-0083_v_5-5506-31B9-0083', startDate: '20261115', scheduleRelationship: 'SCHEDULED' },
          stopTimeUpdate: [
            { stopSequence: 1, stopId: '02520', departure: { delay: 0, time: sec('2026-11-15T08:20:00Z') } },
            { stopSequence: 2, stopId: '02044', arrival: { delay: 0, time: sec('2026-11-15T10:20:00Z') } },
          ],
        },
      }),
      STAZIONI,
      ADESSO,
    );
    expect(lettura.treni).toHaveLength(1);
    expect(lettura.treni[0]).toMatchObject({ numero: '5506', verso: 'partenza', a: 'Trento' });
  });

  it('tiene un treno che ferma a Bassano anche se il numero non si riconosce, con il numero vuoto', () => {
    const senzaNumero = (codice: string, ora: string): unknown => ({
      tripUpdate: {
        trip: { tripId: codice },
        stopTimeUpdate: [
          { stopSequence: 1, stopId: '02520', departure: { time: sec(ora) } },
          { stopSequence: 2, stopId: '02581', arrival: { time: sec('2026-11-15T09:30:00Z') } },
        ],
      },
    });
    const lettura = interpretaTreni(
      // Due corse diverse alla stessa ora restano due; la stessa corsa ripetuta resta una.
      feed(senzaNumero('formato-nuovo-A', '2026-11-15T08:10:00Z'), senzaNumero('formato-nuovo-B', '2026-11-15T08:10:00Z'), senzaNumero('formato-nuovo-A', '2026-11-15T08:10:00Z')),
      STAZIONI,
      ADESSO,
    );
    expect(lettura.treni.map((t) => [t.numero, t.a])).toEqual([
      ['', 'Padova'],
      ['', 'Padova'],
    ]);
  });

  it('una corsa soppressa nella forma vera del feed (senza fermate) non si può attribuire a Bassano: non compare e non rompe nulla', () => {
    // Forma letta dal feed vero il 15 novembre 2026.
    const soppressa = {
      id: 'x',
      tripUpdate: {
        trip: {
          tripId: '0083_10083_0_v_1-16313-31B9-0083_v_1-16313-31B9-0083',
          routeId: '10083',
          startDate: '20261115',
          scheduleRelationship: 'CANCELED',
        },
      },
    };
    const lettura = interpretaTreni(
      feed(
        soppressa,
        // Fermata di Bassano saltata e senza orario: non si sa a che ora sarebbe passata.
        {
          tripUpdate: {
            trip: { tripId: 'x_v_1-200-A', scheduleRelationship: 'SCHEDULED' },
            stopTimeUpdate: [
              { stopSequence: 1, stopId: '02520', scheduleRelationship: 'SKIPPED' },
              { stopSequence: 2, stopId: '02581', arrival: { time: sec('2026-11-15T09:10:00Z') } },
            ],
          },
        },
        corsa('16315', [
          { codice: '02520', ora: '2026-11-15T08:20:00Z' },
          { codice: '02581', arrivo: '2026-11-15T09:10:00Z' },
        ]),
      ),
      STAZIONI,
      ADESSO,
    );
    expect(lettura.treni.map((t) => t.numero)).toEqual(['16315']);
  });

  it('rifiuta un feed che non ha la forma attesa', () => {
    expect(() => interpretaTreni(null, STAZIONI, ADESSO)).toThrow(/non valido/);
    expect(() => interpretaTreni('<html>', STAZIONI, ADESSO)).toThrow();
    expect(() => interpretaTreni([], STAZIONI, ADESSO)).toThrow();
    expect(() => interpretaTreni({ header: { timestamp: '1' } }, STAZIONI, ADESSO)).toThrow(/corse/);
    expect(() => interpretaTreni({ entity: [] }, STAZIONI, ADESSO)).toThrow(/emissione/);
    expect(() => interpretaTreni({ header: { timestamp: 'boh' }, entity: [] }, STAZIONI, ADESSO)).toThrow(/emissione/);
    // Un feed valido ma vuoto non è un errore: non ci sono treni.
    expect(interpretaTreni(feed(), STAZIONI, ADESSO).treni).toEqual([]);
  });

  it("tiene i treni da un'ora fa a sei ore avanti, in ordine di ora", () => {
    const parte = (numero: string, ora: string): unknown =>
      corsa(numero, [{ codice: '02520', ora }, { codice: '02581', arrivo: '2026-11-15T23:00:00Z' }]);
    const lettura = interpretaTreni(
      feed(
        parte('6', '2026-11-15T14:00:01Z'),
        parte('5', '2026-11-15T14:00:00Z'),
        parte('3', '2026-11-15T08:00:00Z'),
        parte('1', '2026-11-15T06:59:59Z'),
        parte('4', '2026-11-15T11:30:00Z'),
        parte('2', '2026-11-15T07:00:00Z'),
      ),
      STAZIONI,
      ADESSO,
    );
    expect(lettura.treni.map((t) => t.numero)).toEqual(['2', '3', '4', '5']);
  });

  it('lascia null i nomi che non conosce, mai il codice grezzo', () => {
    const fermate: FermataFinta[] = [
      { codice: '09999', ora: '2026-11-15T07:30:00Z' },
      { codice: '02520', ora: '2026-11-15T08:15:00Z' },
      { codice: '07777:platform:3', arrivo: '2026-11-15T10:00:00Z' },
    ];
    const [treno] = interpretaTreni(feed(corsa('5712', fermate)), STAZIONI, ADESSO).treni;
    expect(treno.da).toBeNull();
    expect(treno.a).toBeNull();
    // Senza tabella i treni ci sono lo stesso.
    const [senza] = interpretaTreni(feed(corsa('5712', fermate)), {}, ADESSO).treni;
    expect(senza).toMatchObject({ numero: '5712', verso: 'transito', da: null, a: null });
    expect(JSON.stringify([treno, senza])).not.toMatch(/09999|07777/);
  });

  it("non inventa l'origine se il feed ha già tolto le fermate fatte", () => {
    const [treno] = interpretaTreni(
      {
        header: { timestamp: sec('2026-11-15T07:59:30Z') },
        entity: [
          {
            tripUpdate: {
              trip: { tripId: 'x_v_1-5712-A' },
              stopTimeUpdate: [
                { stopSequence: 4, stopId: '02520', departure: { delay: 0, time: sec('2026-11-15T08:15:00Z') } },
                { stopSequence: 5, stopId: '02044', arrival: { delay: 0, time: sec('2026-11-15T10:00:00Z') } },
              ],
            },
          },
        ],
      },
      STAZIONI,
      ADESSO,
    ).treni;
    expect(treno).toMatchObject({ verso: 'transito', da: null, a: 'Trento' });
  });
});

describe('leggiTreni e leggiAvvisi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
  });

  const rispostaOk = (corpo: unknown) => ({ ok: true, status: 200, json: async () => corpo });
  const feedVero = (): unknown =>
    feed(
      corsa('16313', [
        { codice: '02520', ora: '2026-11-15T08:20:00Z' },
        { codice: '02593', arrivo: '2026-11-15T09:40:00Z' },
      ]),
    );
  const tabella = { generato: '2026-11-15T06:00:00Z', fonte: { nome: 'BusOne', url: 'https://busone.app', licenza: '' }, stazioni: STAZIONI };

  it('chiama BusOne con le intestazioni richieste e tiene il risultato in memoria per 2 minuti', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(ADESSO);
    const finto = vi.fn(async (url: unknown, _opzioni?: unknown) =>
      rispostaOk(String(url).includes('stazioni-treni') ? tabella : feedVero()),
    );
    vi.stubGlobal('fetch', finto);
    const { leggiTreni } = await import('../src/live/index');

    const lettura = await leggiTreni();
    expect(lettura.treni).toHaveLength(1);
    expect(lettura.treni[0]).toMatchObject({ numero: '16313', a: 'Venezia S. Lucia' });

    const chiamate = finto.mock.calls.map((c) => ({ url: String(c[0]), opzioni: c[1] as { headers: Record<string, string> } }));
    const busone = chiamate.find((c) => c.url === 'https://proxy.busone.app/trenitalia/gtfs-rt/trip-updates.json');
    expect(busone).toBeDefined();
    // Il contatto del progetto è l'indirizzo del repository: nessuna email.
    expect(busone!.opzioni.headers['X-BusOne-Client']).toBe('bassano-aperta (progetto civico open source; https://github.com/evapassarini/bassano-aperta)');
    expect(busone!.opzioni.headers['X-BusOne-Client']).not.toContain('@');
    // Lo script che rigenera la tabella delle stazioni si presenta allo stesso modo.
    const script = readFileSync(new URL('../scripts/dati-stazioni.mjs', import.meta.url), 'utf8');
    expect(script).toContain(`'X-BusOne-Client': '${busone!.opzioni.headers['X-BusOne-Client']}'`);
    expect(script).toContain("'X-BusOne-Use': 'personal'");
    expect(busone!.opzioni.headers['X-BusOne-Use']).toBe('personal');
    const stazioni = chiamate.find((c) => c.url === `${import.meta.env.BASE_URL}data/stazioni-treni.json`);
    expect(stazioni).toBeDefined();
    // Le intestazioni di BusOne vanno solo a BusOne.
    expect(stazioni!.opzioni.headers['X-BusOne-Client']).toBeUndefined();
    expect(finto).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date(ADESSO.getTime() + 119_000));
    await leggiTreni();
    expect(finto).toHaveBeenCalledTimes(2);

    // Dopo due minuti si rilegge il feed, ma la tabella delle stazioni no.
    vi.setSystemTime(new Date(ADESSO.getTime() + 121_000));
    await leggiTreni();
    expect(finto).toHaveBeenCalledTimes(3);
  });

  it('dice quando è stata generata la tabella delle stazioni, senza scaricarla due volte', async () => {
    const finto = vi.fn(async (_url: unknown) => rispostaOk(tabella));
    vi.stubGlobal('fetch', finto);
    const { leggiDataStazioni } = await import('../src/live/index');
    expect(await leggiDataStazioni()).toBe('2026-11-15T06:00:00Z');
    expect(await leggiDataStazioni()).toBe('2026-11-15T06:00:00Z');
    expect(finto).toHaveBeenCalledTimes(1);
  });

  it('rifiuta la data della tabella se il file manca o non la dichiara, e poi riprova', async () => {
    const risposte: unknown[] = [{ ok: false, status: 404, json: async () => ({}) }, rispostaOk({ stazioni: STAZIONI }), rispostaOk(tabella)];
    const finto = vi.fn(async (_url: unknown) => risposte.shift());
    vi.stubGlobal('fetch', finto);
    const { leggiDataStazioni } = await import('../src/live/index');
    await expect(leggiDataStazioni()).rejects.toThrow(/404/);
    await expect(leggiDataStazioni()).rejects.toThrow(/non dichiara/);
    expect(finto).toHaveBeenCalledTimes(2);
  });

  it('se la tabella delle stazioni non si carica mostra i treni lo stesso, senza nomi', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(ADESSO);
    const finto = vi.fn(async (url: unknown) =>
      String(url).includes('stazioni-treni') ? { ok: false, status: 404, json: async () => ({}) } : rispostaOk(feedVero()),
    );
    vi.stubGlobal('fetch', finto);
    const { leggiTreni } = await import('../src/live/index');

    const lettura = await leggiTreni();
    expect(lettura.treni).toHaveLength(1);
    expect(lettura.treni[0]).toMatchObject({ numero: '16313', da: null, a: null });
  });

  it('rifiuta se BusOne non risponde o risponde male, e alla chiamata dopo riprova', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(ADESSO);
    let giro = 0;
    const finto = vi.fn(async (url: unknown) => {
      if (String(url).includes('stazioni-treni')) return rispostaOk(tabella);
      giro += 1;
      if (giro === 1) throw new TypeError('rete assente');
      if (giro === 2) return rispostaOk({ errore: 'servizio sospeso' });
      return rispostaOk(feedVero());
    });
    vi.stubGlobal('fetch', finto);
    const { leggiTreni } = await import('../src/live/index');

    await expect(leggiTreni()).rejects.toThrow();
    await expect(leggiTreni()).rejects.toThrow();
    await expect(leggiTreni()).resolves.toMatchObject({ treni: [{ numero: '16313' }] });
  });

  it('legge data/avvisi.json sotto BASE_URL e controlla la forma', async () => {
    const avvisi = {
      generato: '2026-11-15T07:00:00Z',
      fonti: [{ nome: 'CCISS Viaggiare Informati', url: 'https://www.cciss.it/', licenza: 'Non dichiarata: citazione breve con link alla fonte' }],
      avvisi: [
        { tipo: 'evento', strada: 'SS47 della Valsugana', testo: 'Testo finto di prova', quando: '2026-11-15T06:00:00Z', fonte: 'CCISS Viaggiare Informati', url: 'https://www.cciss.it/' },
      ],
    };
    const finto = vi.fn().mockResolvedValueOnce(rispostaOk({ sbagliato: true })).mockResolvedValueOnce(rispostaOk(avvisi));
    vi.stubGlobal('fetch', finto);
    const { leggiAvvisi } = await import('../src/live/index');

    await expect(leggiAvvisi()).rejects.toThrow();
    await expect(leggiAvvisi()).resolves.toEqual(avvisi);
    expect(String(finto.mock.calls[0]![0])).toBe(`${import.meta.env.BASE_URL}data/avvisi.json`);
    // La seconda lettura buona resta in memoria.
    await leggiAvvisi();
    expect(finto).toHaveBeenCalledTimes(2);
  });
});
