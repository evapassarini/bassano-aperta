import { afterEach, describe, expect, it, vi } from 'vitest';
import campione from './fixtures/brenta-arpav.json';
import { etaInOre, interpretaBrenta, millisDi, tendenza } from '../src/live/brenta';

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
