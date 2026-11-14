// Controlla dati e contenuti veri contro i contratti di src/types.ts:
// storie, strati, luoghi simbolo, mappa di base, aria.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RIQUADRO } from '../src/types';
import type { DatiAria, DatiBase, DatiStrati, Landmark, Storia } from '../src/types';
import { lonLatInMetri } from '../src/map/proiezione';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const leggi = <T>(percorso: string): T => JSON.parse(readFileSync(join(RADICE, percorso), 'utf8')) as T;

const CARTELLA_STORIE = 'content/luoghi';
const fileStorie = readdirSync(join(RADICE, CARTELLA_STORIE)).filter((f) => f.endsWith('.json')).sort();
const storie = fileStorie.map((f) => ({ file: f, storia: leggi<Storia>(`${CARTELLA_STORIE}/${f}`) }));
const idStorie = new Set(storie.map((s) => s.storia.id));
const strati = leggi<DatiStrati>('public/data/strati.json');
const base = leggi<DatiBase>('public/data/base.json');
const aria = leggi<DatiAria>('public/data/aria.json');
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
    for (const m of rino.media.filter((x) => x.tipo === 'immagine')) {
      expect(`${m.titolo} ${m.autore}`.toLowerCase()).toMatch(/dürer|durer/);
    }
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
});
