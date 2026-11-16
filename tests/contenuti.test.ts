// Controlla dati e contenuti veri contro i contratti di src/types.ts:
// storie, strati, luoghi simbolo, mappa di base, lampioni, aria, avvisi sulla viabilità, stazioni dei treni.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RIQUADRO } from '../src/types';
import type { DatiAria, DatiAvvisi, DatiBase, DatiLampioni, DatiStrati, Landmark, Storia } from '../src/types';
import { lonLatInMetri } from '../src/map/proiezione';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const leggi = <T>(percorso: string): T => JSON.parse(readFileSync(join(RADICE, percorso), 'utf8')) as T;

const CARTELLA_STORIE = 'content/luoghi';
const fileStorie = readdirSync(join(RADICE, CARTELLA_STORIE)).filter((f) => f.endsWith('.json')).sort();
const storie = fileStorie.map((f) => ({ file: f, storia: leggi<Storia>(`${CARTELLA_STORIE}/${f}`) }));
const idStorie = new Set(storie.map((s) => s.storia.id));
const strati = leggi<DatiStrati>('public/data/strati.json');
const base = leggi<DatiBase>('public/data/base.json');
const lampioni = leggi<DatiLampioni>('public/data/lampioni.json');
const aria = leggi<DatiAria>('public/data/aria.json');
const avvisi = leggi<DatiAvvisi>('public/data/avvisi.json');
const stazioniTreni = leggi<{
  generato: string;
  fonte: { nome: string; url: string; licenza: string };
  stazioni: Record<string, string>;
}>('public/data/stazioni-treni.json');
const landmark = leggi<Landmark[]>('public/landmarks/indice.json');

/**
 * Eccezioni documentate al riquadro: il Monte Grappa è circa 12 km a nord-est della mappa.
 * La storia tiene le coordinate vere della cima; sulla mappa c'è un segnaposto sul margine.
 */
const FUORI_RIQUADRO = new Set(['monte-grappa']);

const I18 = [
  'bassano-2029', 'bolle-nardini', 'brenta', 'castello-ezzelini', 'grappa', 'king-kong-rhino',
  'monte-grappa', 'mura-porte', 'museo-civico', 'museo-grappa-poli', 'nardini-alto', 'nardini-basso',
  'palazzo-bonaguro', 'palazzo-sturm', 'ponte-vecchio', 'tempio-ossario', 'torre-civica-piazze',
  'viale-dei-martiri',
];

const TIPI_PUNTO = new Set([
  'museo', 'biblioteca', 'teatro', 'monumento', 'chiesa', 'luogo-storico', 'aria', 'idrometro',
  'webcam', 'fermata-bus', 'stazione', 'bici',
]);
const ID_STRATI = new Set(['cultura', 'ambiente', 'mobilita']);

const stringa = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const https = (v: unknown): boolean => stringa(v) && v.startsWith('https://');
const nelRiquadro = (lat: number, lon: number): boolean =>
  lon >= RIQUADRO.ovest && lon <= RIQUADRO.est && lat >= RIQUADRO.sud && lat <= RIQUADRO.nord;

const so = lonLatInMetri({ lon: RIQUADRO.ovest, lat: RIQUADRO.sud });
const ne = lonLatInMetri({ lon: RIQUADRO.est, lat: RIQUADRO.nord });
const nelRiquadroMetri = (x: number, y: number): boolean =>
  x >= so.x - 0.2 && x <= ne.x + 0.2 && y >= so.y - 0.2 && y <= ne.y + 0.2;
const piattoNelRiquadro = (p: number[]): boolean => {
  if (p.length % 2 !== 0) return false;
  for (let i = 0; i < p.length; i += 2) if (!nelRiquadroMetri(p[i], p[i + 1])) return false;
  return true;
};

const CHIAVI_STORIA = new Set([
  'id', 'nome', 'sottotitolo', 'genere', 'lat', 'lon', 'intro', 'tappe', 'media', 'live', 'incertezze', 'landmark',
]);

describe('storie (content/luoghi)', () => {
  it('ci sono tutte e 18 le storie previste', () => {
    expect(fileStorie.map((f) => f.replace(/\.json$/, ''))).toEqual(I18);
  });

  describe.each(storie)('$file', ({ file, storia: s }) => {
    it("ha l'id uguale al nome del file e i campi del tipo Storia", () => {
      expect(s.id).toBe(file.replace(/\.json$/, ''));
      for (const k of Object.keys(s)) expect(CHIAVI_STORIA.has(k), `campo sconosciuto: ${k}`).toBe(true);
      expect(stringa(s.nome)).toBe(true);
      expect(typeof s.sottotitolo).toBe('string');
      expect(['luogo', 'tema']).toContain(s.genere);
      expect(stringa(s.intro)).toBe(true);
      expect(Array.isArray(s.tappe) && Array.isArray(s.media) && Array.isArray(s.live)).toBe(true);
      expect(Array.isArray(s.incertezze) && s.incertezze.every(stringa)).toBe(true);
    });

    it('ha le coordinate giuste per il suo genere', () => {
      if (s.genere === 'tema') {
        expect(s.lat).toBeUndefined();
        expect(s.lon).toBeUndefined();
        return;
      }
      expect(numero(s.lat) && numero(s.lon), 'un luogo deve avere lat e lon').toBe(true);
      if (!FUORI_RIQUADRO.has(s.id)) expect(nelRiquadro(s.lat!, s.lon!), 'fuori dal riquadro').toBe(true);
    });

    it('ha da 6 a 10 tappe complete, ognuna con la sua fonte', () => {
      expect(s.tappe.length).toBeGreaterThanOrEqual(6);
      expect(s.tappe.length).toBeLessThanOrEqual(10);
      for (const t of s.tappe) {
        expect(stringa(t.anno) && stringa(t.titolo) && stringa(t.testo), `tappa incompleta: ${t.titolo}`).toBe(true);
        expect(stringa(t.fonte?.titolo) && https(t.fonte?.url), `fonte della tappa: ${t.titolo}`).toBe(true);
      }
    });

    it('ha i media completi e gli indici tappa.media validi', () => {
      for (const m of s.media) {
        expect(['immagine', 'video', 'audio']).toContain(m.tipo);
        expect(stringa(m.titolo) && stringa(m.autore) && stringa(m.licenza), `media incompleto: ${m.titolo}`).toBe(true);
        expect(https(m.url) && https(m.pagina), `indirizzi del media: ${m.titolo}`).toBe(true);
        if (m.tipo === 'video') {
          expect(m.url).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}$/);
        } else {
          expect(m.url.startsWith('https://commons.wikimedia.org/wiki/Special:FilePath/'), m.url).toBe(true);
          expect(m.licenza.toLowerCase()).not.toContain('unknown');
        }
        if (m.tipo === 'immagine') expect(stringa(m.alt), `manca alt: ${m.titolo}`).toBe(true);
      }
      for (const t of s.tappe) {
        if (t.media === undefined) continue;
        expect(Number.isInteger(t.media) && t.media >= 0 && t.media < s.media.length, `indice media: ${t.titolo}`).toBe(true);
        expect(s.media[t.media].tipo).toBe('immagine');
      }
      // Nessun file due volte nello stesso racconto, e nessuna immagine legata a due tappe.
      const pagine = s.media.map((m) => m.pagina);
      expect(new Set(pagine).size, 'file ripetuto nei media').toBe(pagine.length);
      const legate = s.tappe.map((t) => t.media).filter((i) => i !== undefined);
      expect(new Set(legate).size, 'immagine legata a due tappe').toBe(legate.length);
    });

    it('ha i riquadri "Adesso" ben formati', () => {
      for (const l of s.live) {
        expect(['brenta', 'aria', 'link']).toContain(l.tipo);
        expect(stringa(l.nota)).toBe(true);
        if (l.tipo === 'link') expect(stringa(l.etichetta) && https(l.url)).toBe(true);
      }
    });

    it('se indica un luogo simbolo, il disegno esiste', () => {
      if (s.landmark === undefined) return;
      expect(existsSync(join(RADICE, 'public/landmarks', `${s.landmark}.svg`)), s.landmark).toBe(true);
    });
  });

  it('rispetta la regola sul King Kong Rhino: nessuna fotografia della scultura', () => {
    const rino = storie.find((s) => s.storia.id === 'king-kong-rhino')!.storia;
    const immagini = rino.media.filter((x) => x.tipo === 'immagine');
    // Le immagini ammesse: stampe e disegni del Cinquecento (autori morti da secoli) e le
    // sale di Palazzo Sturm fotografate senza la scultura. Chi ne aggiunge una la mette qui
    // dopo averla guardata.
    const ammessi = /dürer|durer|burgkmair|enea vico|peccadille/;
    for (const m of immagini) {
      expect(m.autore.toLowerCase(), `autore non previsto: ${m.titolo}`).toMatch(ammessi);
      // Nessuna didascalia e nessun file parla della scultura o del suo autore.
      expect(`${m.titolo} ${m.alt ?? ''} ${decodeURIComponent(m.pagina)}`.toLowerCase(), m.titolo).not.toMatch(
        /king.?kong|li-?jen|shih|scultura/,
      );
    }
    expect(immagini.some((m) => /dürer|durer/i.test(m.autore))).toBe(true);
  });
});

describe('luoghi simbolo (public/landmarks)', () => {
  it('ha id unici', () => {
    expect(new Set(landmark.map((l) => l.id)).size).toBe(landmark.length);
  });

  it.each(landmark)('$id', (l) => {
    expect(stringa(l.id) && stringa(l.nome) && stringa(l.file)).toBe(true);
    const percorso = join(RADICE, 'public/landmarks', l.file);
    expect(existsSync(percorso), `manca ${l.file}`).toBe(true);
    const svg = readFileSync(percorso, 'utf8');
    expect(svg).toMatch(/<svg[^>]*viewBox=/);
    expect(svg).not.toMatch(/<script|<image|href=/i);
    expect(idStorie.has(l.storia), `storia inesistente: ${l.storia}`).toBe(true);
    expect(nelRiquadro(l.lat, l.lon)).toBe(true);
    expect(numero(l.larghezzaMetri) && l.larghezzaMetri > 0).toBe(true);
    expect(l.ancora).toHaveLength(2);
    for (const a of l.ancora) expect(a >= 0 && a <= 1).toBe(true);
    // La storia collegata rimanda a questo disegno (serve all'intestazione della finestra).
    expect(storie.find((s) => s.storia.id === l.storia)!.storia.landmark).toBe(l.id);
  });
});

describe('strati (public/data/strati.json)', () => {
  it('ha data, fonti e id unici', () => {
    expect(Number.isNaN(Date.parse(strati.generato))).toBe(false);
    expect(strati.fonti.length).toBeGreaterThan(0);
    for (const f of strati.fonti) expect(stringa(f.nome) && https(f.url) && stringa(f.licenza)).toBe(true);
    const id = [...strati.punti.map((p) => p.id), ...strati.linee.map((l) => l.id)];
    expect(new Set(id).size).toBe(id.length);
  });

  it('ha punti validi, dentro il riquadro, con storie esistenti', () => {
    for (const p of strati.punti) {
      expect(stringa(p.id) && stringa(p.nome), p.id).toBe(true);
      expect(ID_STRATI.has(p.strato) && TIPI_PUNTO.has(p.tipo), p.id).toBe(true);
      expect(numero(p.x) && numero(p.y) && nelRiquadroMetri(p.x, p.y), `fuori riquadro: ${p.id}`).toBe(true);
      if (p.storia !== undefined) expect(idStorie.has(p.storia), `storia inesistente: ${p.storia}`).toBe(true);
      else expect(stringa(p.nota), `punto senza storia e senza nota: ${p.id}`).toBe(true);
      if (p.url !== undefined) expect(/^https?:\/\//.test(p.url), p.url).toBe(true);
    }
  });

  it('ha un punto sulla mappa per ogni storia di luogo', () => {
    const conPunto = new Set(strati.punti.map((p) => p.storia));
    for (const { storia } of storie) {
      if (storia.genere === 'luogo') expect(conPunto.has(storia.id), storia.id).toBe(true);
    }
  });

  it('ha linee valide dentro il riquadro', () => {
    for (const l of strati.linee) {
      expect(ID_STRATI.has(l.strato) && ['ciclabile', 'ferrovia'].includes(l.tipo), l.id).toBe(true);
      expect(l.p.length >= 4 && piattoNelRiquadro(l.p), `linea fuori riquadro: ${l.id}`).toBe(true);
    }
  });
});

describe('mappa di base (public/data/base.json)', () => {
  it('ha data, attribuzione OpenStreetMap e contenuto', () => {
    expect(Number.isNaN(Date.parse(base.generato))).toBe(false);
    expect(base.fonte).toContain('OpenStreetMap');
    expect(base.edifici.length).toBeGreaterThan(2000);
    expect(base.strade.length).toBeGreaterThan(500);
    expect(base.aree.some((a) => a.t === 'acqua')).toBe(true);
    expect(base.alberi.length % 2).toBe(0);
  });

  it('ha edifici, strade, aree e alberi dei tipi previsti e dentro il riquadro', () => {
    const tipiE = new Set(['casa', 'chiesa', 'industria', 'pubblico', 'torre', 'altro']);
    const tipiS = new Set(['principale', 'secondaria', 'locale', 'pedonale', 'ferrovia']);
    const tipiA = new Set(['acqua', 'parco', 'bosco', 'prato', 'piazza', 'coltivo']);
    let errati = 0;
    for (const e of base.edifici) {
      if (!tipiE.has(e.t) || !numero(e.h) || e.h <= 0 || e.p.length < 6 || !piattoNelRiquadro(e.p)) errati++;
    }
    for (const s of base.strade) if (!tipiS.has(s.t) || s.p.length < 4 || !piattoNelRiquadro(s.p)) errati++;
    for (const a of base.aree) if (!tipiA.has(a.t) || a.p.length < 6 || !piattoNelRiquadro(a.p)) errati++;
    if (!piattoNelRiquadro(base.alberi)) errati++;
    expect(errati).toBe(0);
  });
});

describe('lampioni (public/data/lampioni.json)', () => {
  it('ha data, fonte che dichiara i lampioni illustrativi e solo le chiavi previste', () => {
    expect(Object.keys(lampioni).sort()).toEqual(['fonte', 'generato', 'p', 'veri']);
    expect(Number.isNaN(Date.parse(lampioni.generato))).toBe(false);
    expect(stringa(lampioni.fonte)).toBe(true);
    expect(lampioni.fonte).toContain('illustrativ');
    if (lampioni.veri > 0) expect(lampioni.fonte).toContain('OpenStreetMap');
    // Regole editoriali: niente trattini lunghi.
    expect(/[\u2013\u2014]/.test(lampioni.fonte)).toBe(false);
  });

  it('ha coppie di numeri in metri dentro il riquadro, con i veri per primi e in minoranza', () => {
    expect(Array.isArray(lampioni.p)).toBe(true);
    expect(lampioni.p.length % 2).toBe(0);
    expect(lampioni.p.length).toBeGreaterThan(0);
    expect(lampioni.p.every((n) => numero(n))).toBe(true);
    expect(piattoNelRiquadro(lampioni.p)).toBe(true);
    expect(Number.isInteger(lampioni.veri) && lampioni.veri >= 0).toBe(true);
    expect(lampioni.veri).toBeLessThanOrEqual(lampioni.p.length / 2);
    // La mappa regge qualche migliaio di lampioni: oltre va diradato lo script.
    expect(lampioni.p.length / 2).toBeLessThanOrEqual(10000);
  });
});

describe("aria (public/data/aria.json)", () => {
  it('ha stazione, fonte e misure con data', () => {
    expect(Number.isNaN(Date.parse(aria.generato))).toBe(false);
    expect(stringa(aria.stazione) && stringa(aria.fonte.nome) && https(aria.fonte.url)).toBe(true);
    expect(aria.misure.length).toBeGreaterThan(0);
    for (const m of aria.misure) {
      expect(stringa(m.inquinante) && numero(m.valore) && stringa(m.unita)).toBe(true);
      expect(Number.isNaN(Date.parse(m.quando)), m.quando).toBe(false);
    }
  });

  it('se ha le serie per il giudizio, sono in ordine, senza doppioni e con numeri veri', () => {
    const forme: [keyof NonNullable<DatiAria['serie']>, RegExp][] = [
      ['ozonoOrario', /^\d{4}-\d{2}-\d{2}T\d{2}:00:00$/],
      ['pm10Giornaliero', /^\d{4}-\d{2}-\d{2}$/],
    ];
    for (const [nome, forma] of forme) {
      const punti = aria.serie?.[nome];
      if (!punti) continue;
      expect(punti.length, nome).toBeGreaterThan(0);
      for (const [i, p] of punti.entries()) {
        expect(forma.test(p.quando), `${nome}: ${p.quando}`).toBe(true);
        expect(numero(p.valore) && p.valore >= 0, `${nome}: ${p.quando}`).toBe(true);
        if (i > 0) expect(p.quando > punti[i - 1].quando, `${nome}: ${p.quando}`).toBe(true);
      }
    }
  });
});

describe('avvisi sulla viabilità (public/data/avvisi.json)', () => {
  it('ha data e fonti con nome, indirizzo e licenza', () => {
    expect(Number.isNaN(Date.parse(avvisi.generato))).toBe(false);
    expect(Array.isArray(avvisi.fonti) && Array.isArray(avvisi.avvisi)).toBe(true);
    const nomi = avvisi.fonti.map((f) => f.nome);
    expect(new Set(nomi).size, 'fonti doppie').toBe(nomi.length);
    for (const f of avvisi.fonti) {
      expect(stringa(f.nome) && https(f.url) && stringa(f.licenza), f.nome).toBe(true);
    }
    // Un avviso senza fonte letta non può esistere.
    if (avvisi.avvisi.length > 0) expect(avvisi.fonti.length).toBeGreaterThan(0);
  });

  it('ha avvisi brevi, senza HTML, con data, fonte dichiarata e link https', () => {
    const fonti = new Set(avvisi.fonti.map((f) => f.nome));
    const generato = Date.parse(avvisi.generato);
    for (const a of avvisi.avvisi) {
      const chi = `${a.strada} (${a.quando})`;
      expect(['evento', 'ordinanza'].includes(a.tipo), chi).toBe(true);
      expect(stringa(a.strada) && stringa(a.testo), chi).toBe(true);
      expect(a.testo.length, `testo lungo: ${chi}`).toBeLessThanOrEqual(280);
      expect(/<[a-z/!][^>]*>|&[a-z]+;|&#\d+;|&#x[0-9a-f]+;/i.test(a.testo), `HTML o entità nel testo: ${chi}`).toBe(false);
      expect(/[\u2013\u2014]/.test(a.testo + a.strada), `trattino lungo: ${chi}`).toBe(false);
      expect(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(a.testo), `indirizzo email nel testo: ${chi}`).toBe(false);
      const quando = Date.parse(a.quando);
      expect(Number.isNaN(quando), chi).toBe(false);
      // Un avviso non può essere stato pubblicato dopo la fotografia (un'ora di margine).
      expect(quando, chi).toBeLessThanOrEqual(generato + 3_600_000);
      expect(fonti.has(a.fonte), `fonte non elencata: ${a.fonte}`).toBe(true);
      expect(https(a.url), chi).toBe(true);
    }
  });

  it('tiene al massimo dieci ordinanze, degli ultimi 120 giorni', () => {
    const ordinanze = avvisi.avvisi.filter((a) => a.tipo === 'ordinanza');
    expect(ordinanze.length).toBeLessThanOrEqual(10);
    const limite = Date.parse(avvisi.generato) - 120 * 86_400_000;
    for (const a of ordinanze) expect(Date.parse(a.quando), a.strada).toBeGreaterThanOrEqual(limite);
  });
});

describe('stazioni dei treni (public/data/stazioni-treni.json)', () => {
  it('ha data e fonte con attribuzione a BusOne', () => {
    expect(Number.isNaN(Date.parse(stazioniTreni.generato))).toBe(false);
    const f = stazioniTreni.fonte;
    expect(stringa(f.nome) && https(f.url) && stringa(f.licenza)).toBe(true);
    expect(f.nome).toContain('BusOne');
  });

  it('ha Bassano del Grappa e solo codici di cifre con nomi leggibili', () => {
    const s = stazioniTreni.stazioni;
    expect(s !== null && typeof s === 'object' && !Array.isArray(s)).toBe(true);
    expect(s['02520']).toBe('Bassano del Grappa');
    const voci = Object.entries(s);
    expect(voci.length).toBeGreaterThanOrEqual(50);
    for (const [codice, nome] of voci) {
      expect(/^\d+$/.test(codice), `codice non valido: ${codice}`).toBe(true);
      expect(stringa(nome) && nome === nome.trim(), `nome vuoto: ${codice}`).toBe(true);
      // Un nome di più lettere tutto in maiuscolo non è stato reso leggibile.
      expect(nome.length > 3 && nome === nome.toUpperCase(), `nome in maiuscolo: ${nome}`).toBe(false);
    }
  });
});
