import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  colpisceMarcatore,
  dentroSprite,
  distanzaDaSegmento,
  marcatoriInVista,
  misureSegnaposto,
  puntoInPoligono,
  larghezzaSprite,
  puntoSuEdificio,
  rettangoloSprite,
  SPRITE_INGRANDIMENTO_MASSIMO,
  SPRITE_MINIMO,
  trovaBersaglio,
  ZOOM_SEGNAPOSTO,
} from '../src/map/bersagli';
import type { Marcatore, Sprite } from '../src/map/bersagli';
import { formattaHash, hashDellaMappa, leggiHash } from '../src/map/indirizzo';
import { ACQUA_NEI_DISEGNI, normalizzaSvg, separaAcqua } from '../src/map/immagini';
import { Disegnatore, aloniInVista, quotaAloni, ZOOM_ALONI } from '../src/map/disegno';
import type { Illustrazioni } from '../src/map/immagini';
import {
  inOmbra,
  luminanza,
  PALETTE,
  PALETTE_NOTTE,
  PALETTE_PER_LUCE,
  PALETTE_POMERIGGIO,
  sfuma,
} from '../src/map/palette';
import { isoInSchermo, metriInIso, riquadroVisibile } from '../src/map/proiezione';
import type { Camera, Vista } from '../src/map/proiezione';
import {
  antiorario,
  areaConSegno,
  classificaLati,
  costruisciScena,
  eConvesso,
  EL_ALBERO,
  EL_EDIFICIO,
  EL_LAMPIONE,
  EL_LANDMARK,
  Griglia,
  lampioniNellaZona,
  livelloDettaglio,
  MURO_DESTRO,
  MURO_DIETRO,
  MURO_SINISTRO,
  nelRomboDi,
  ordinaMuri,
  ordinePerProfondita,
  preparaEdificio,
  preparaLampioni,
  preparaLandmark,
  profonditaImpronta,
  raggruppaInTessere,
  semeDi,
  soglieDettaglio,
  sostituisce,
  staDavanti,
  ALTEZZA_DAVANTI,
} from '../src/map/scena';
import { creaCittaFinta } from './fixtures/citta-finta';
// @ts-expect-error modulo JavaScript degli script, senza tipi
import { togliDoppioni } from '../scripts/lib/doppioni.mjs';

const vista: Vista = { larghezza: 1000, altezza: 700 };
const tutti = { cultura: true, ambiente: true, mobilita: true };

describe('ordinamento per profondità', () => {
  it("usa l'angolo più vicino dell'impronta (x + y più piccolo)", () => {
    expect(profonditaImpronta([10, 10, 20, 10, 20, 20, 10, 20])).toBe(20);
    expect(profonditaImpronta([-5, 3, 4, -9, 6, 6])).toBe(-5);
  });

  it('mette prima i più lontani (chiave più grande) e rispetta le parità', () => {
    const ordine = ordinePerProfondita([5, 30, -2, 30, 12]);
    expect([...ordine]).toEqual([1, 3, 4, 0, 2]);
  });

  it('nella scena gli elementi in piedi sono in ordine dal più lontano', () => {
    const c = creaCittaFinta(300);
    const scena = costruisciScena(c.base, c.strati, c.landmark);
    const el = scena.elementi;
    expect(el.n).toBe(scena.edifici.length + scena.alberi.length / 2 + scena.landmark.length);
    for (let i = 1; i < el.n; i++) expect(el.chiave[i]).toBeLessThanOrEqual(el.chiave[i - 1]);
    const conta = [0, 0, 0];
    for (let i = 0; i < el.n; i++) conta[el.tipo[i]]++;
    expect(conta[EL_EDIFICIO]).toBe(scena.edifici.length);
    expect(conta[EL_ALBERO]).toBe(100);
    expect(conta[EL_LANDMARK]).toBe(2);
  });

  it('un edificio a nord-est viene disegnato prima di uno a sud-ovest', () => {
    const base = {
      fonte: '',
      strade: [],
      aree: [],
      alberi: [],
      edifici: [
        { p: [0, 0, 10, 0, 10, 10, 0, 10], h: 6, t: 'casa' as const },
        { p: [40, 40, 50, 40, 50, 50, 40, 50], h: 6, t: 'casa' as const },
        { p: [-40, -40, -30, -40, -30, -30, -40, -30], h: 6, t: 'casa' as const },
      ],
    };
    const scena = costruisciScena(base, { fonti: [], punti: [], linee: [] }, []);
    // rif = indice dell'edificio di partenza: 1 (nord-est), 0, 2 (sud-ovest).
    expect([...scena.elementi.rif]).toEqual([1, 0, 2]);
  });

  it('i punti degli strati sono ordinati dal più lontano', () => {
    const c = creaCittaFinta(100);
    const scena = costruisciScena(c.base, c.strati, c.landmark);
    for (let i = 1; i < scena.punti.length; i++) {
      const a = scena.punti[i - 1].dati;
      const b = scena.punti[i].dati;
      expect(a.x + a.y).toBeGreaterThanOrEqual(b.x + b.y);
    }
  });
});

describe('edifici', () => {
  it('riconosce il verso e lo raddrizza', () => {
    const orario = [0, 0, 0, 10, 10, 10, 10, 0];
    expect(areaConSegno(orario)).toBe(-100);
    expect(areaConSegno(antiorario(orario))).toBe(100);
    expect(antiorario([0, 0, 10, 0, 10, 10, 0, 10])).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
  });

  it('di un quadrato si vedono la parete sud (destra) e la parete ovest (sinistra)', () => {
    // Lati: sud, est, nord, ovest.
    const lati = classificaLati([0, 0, 10, 0, 10, 10, 0, 10]);
    expect([...lati]).toEqual([MURO_DESTRO, MURO_DIETRO, MURO_DIETRO, MURO_SINISTRO]);
  });

  it('la parete sud sta a destra sullo schermo, quella ovest a sinistra', () => {
    const angolo = metriInIso(0, 0);
    expect(metriInIso(10, 0).sx).toBeGreaterThan(angolo.sx);
    expect(metriInIso(0, 10).sx).toBeLessThan(angolo.sx);
  });

  it('prepara anello, altezza e seme in modo deterministico', () => {
    const e = { p: [0, 0, 0, 10, 10, 10, 10, 0], h: 10, t: 'casa' as const };
    const a = preparaEdificio(e);
    const b = preparaEdificio(e);
    // Il tetto a falde prende una parte dell'altezza: la gronda sta un poco sotto i 10 m,
    // il colmo un poco sopra. A metà del tetto l'altezza è quella del dato.
    expect(a.colmo).toBeGreaterThan(0);
    expect(a.alt).toBeLessThan(8.165);
    expect(a.alt + a.colmo / 2).toBeCloseTo(8.165, 4);
    expect(a.area).toBe(100);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.seme).toBe(b.seme);
    expect(a.seme).toBe(semeDi(e.p));
    expect(semeDi([1, 0, 0, 10, 10, 10, 10, 0])).not.toBe(a.seme);
    // Dato in senso orario, viene comunque classificato come antiorario.
    expect([...a.lati].filter((l) => l === MURO_SINISTRO)).toHaveLength(1);
    expect([...a.lati].filter((l) => l === MURO_DESTRO)).toHaveLength(1);
    expect(preparaEdificio({ ...e, t: 'torre' }).colmo).toBeGreaterThan(0);
  });

  it("salta gli edifici che stanno sotto un luogo simbolo", () => {
    const c = creaCittaFinta(300);
    const torre = preparaLandmark(c.landmark[1]); // nell'origine
    expect(torre.x).toBeCloseTo(0, 6);
    expect(nelRomboDi(torre, 0, 0)).toBe(true);
    expect(nelRomboDi(torre, torre.semiL * 0.9, 0)).toBe(true);
    expect(nelRomboDi(torre, torre.semiL * 0.9, torre.semiA * 0.9)).toBe(false);
    const base = {
      ...c.base,
      edifici: [
        { p: [-4, -4, 4, -4, 4, 4, -4, 4], h: 8, t: 'casa' as const },
        { p: [200, 200, 210, 200, 210, 210, 200, 210], h: 8, t: 'casa' as const },
      ],
    };
    const scena = costruisciScena(base, c.strati, c.landmark);
    expect(scena.edifici[0].sotto).toBe(1);
    expect(scena.edifici[1].sotto).toBe(-1);
  });

  it('nasconde anche l\'edificio con lo stesso nome del luogo e quelli entro il raggio «copre»', () => {
    const c = creaCittaFinta(300);
    const casa = (x: number, y: number, n?: string) => ({
      p: [x - 3, y - 3, x + 3, y - 3, x + 3, y + 3, x - 3, y + 3],
      h: 8,
      t: 'casa' as const,
      ...(n ? { n } : {}),
    });
    // La torre sta nell'origine; il suo rombo arriva a circa 27 unità.
    const edifici = [casa(40, 40, 'Torre civica'), casa(40, -40), casa(40, 50, 'Altra cosa'), casa(300, 300, 'Torre Civica')];
    const senza = costruisciScena({ ...c.base, edifici }, c.strati, c.landmark);
    // Stesso nome (maiuscole a parte) e vicino: è lo stesso luogo, non va disegnato due volte.
    expect(senza.edifici.map((e) => e.sotto)).toEqual([1, -1, -1, -1]);
    const conRaggio = c.landmark.map((l, i) => (i === 1 ? { ...l, copre: 70 } : l));
    const con = costruisciScena({ ...c.base, edifici }, c.strati, conRaggio);
    expect(con.edifici.map((e) => e.sotto)).toEqual([1, 1, 1, -1]);
    const torre = preparaLandmark(conRaggio[1]);
    expect(sostituisce(torre, 0, 69)).toBe(true);
    expect(sostituisce(torre, 0, 71)).toBe(false);
  });

  it('con «davanti» le case più vicine a chi guarda restano, ma basse', () => {
    const c = creaCittaFinta(300);
    const torre = preparaLandmark({ ...c.landmark[1], davanti: 40 });
    // A sud-ovest, cioè davanti: 35 m di profondità, oltre il rombo di terreno.
    expect(staDavanti(torre, -25, -25)).toBe(true);
    expect(sostituisce(torre, -25, -25)).toBe(false);
    // Stessa distanza ma dietro (nord-est), oltre la fascia, fuori dalla larghezza (60 m).
    expect(staDavanti(torre, 25, 25)).toBe(false);
    expect(staDavanti(torre, -35, -35)).toBe(false);
    expect(staDavanti(torre, -50, 0)).toBe(false);
    // Senza il campo non cambia nulla.
    expect(staDavanti(preparaLandmark(c.landmark[1]), -25, -25)).toBe(false);

    const casa = (x: number, y: number) => ({
      p: [x - 3, y - 3, x + 3, y - 3, x + 3, y + 3, x - 3, y + 3],
      h: 12,
      t: 'casa' as const,
    });
    const edifici = [casa(-25, -25), casa(25, 25)];
    const luoghi = c.landmark.map((l, i) => (i === 1 ? { ...l, davanti: 40 } : l));
    const alta = costruisciScena({ ...c.base, edifici }, c.strati, c.landmark);
    const bassa = costruisciScena({ ...c.base, edifici }, c.strati, luoghi);
    // Nessuna delle due sparisce; quella davanti occupa meno schermo in altezza.
    expect(bassa.edifici.map((e) => e.sotto)).toEqual([-1, -1]);
    expect(JSON.stringify(bassa.edifici[0])).not.toBe(JSON.stringify(alta.edifici[0]));
    expect(JSON.stringify(bassa.edifici[1])).toBe(JSON.stringify(alta.edifici[1]));
    expect(ALTEZZA_DAVANTI).toBeLessThan(12);
  });

  it('nasconde anche le parti disegnate dentro un edificio nascosto', () => {
    const c = creaCittaFinta(300);
    const edifici = [
      // Una chiesa grande con il centro nel rombo della torre (nell'origine).
      { p: [-20, -10, 40, -10, 40, 10, -20, 10], h: 12, t: 'chiesa' as const },
      // Il suo campanile: dentro l'impronta della chiesa ma fuori dal rombo.
      { p: [30, -4, 36, -4, 36, 4, 30, 4], h: 30, t: 'torre' as const },
      // Una casa accanto, fuori da tutto.
      { p: [80, -4, 90, -4, 90, 4, 80, 4], h: 8, t: 'casa' as const },
    ];
    const scena = costruisciScena({ ...c.base, edifici }, c.strati, c.landmark);
    expect(scena.edifici.map((e) => e.sotto)).toEqual([1, 1, -1]);
  });

  it('riconosce le impronte con rientranze e dà un tetto a tutte', () => {
    const quadrato = [0, 0, 10, 0, 10, 10, 0, 10];
    // Pianta a L: una rientranza.
    const aElle = [0, 0, 20, 0, 20, 8, 8, 8, 8, 20, 0, 20];
    // Un punto quasi allineato su un lato non è una rientranza.
    const quasi = [0, 0, 5, 0.05, 10, 0, 10, 10, 0, 10];
    expect(eConvesso(quadrato)).toBe(true);
    expect(eConvesso(aElle)).toBe(false);
    expect(eConvesso(quasi)).toBe(true);
    // Il tetto a falde regge anche sulle piante con rientranze (vedi tests/edifici.test.ts).
    expect(preparaEdificio({ p: quadrato, h: 15, t: 'chiesa' }).colmo).toBeGreaterThan(0);
    expect(preparaEdificio({ p: aElle, h: 15, t: 'chiesa' }).colmo).toBeGreaterThan(0);
    expect(preparaEdificio({ p: aElle, h: 15, t: 'torre' }).colmo).toBeGreaterThan(0);
    // La punta di una torre è più ripida del tetto di una casa sulla stessa pianta.
    expect(preparaEdificio({ p: quadrato, h: 15, t: 'torre' }).colmo).toBeGreaterThan(
      preparaEdificio({ p: quadrato, h: 15, t: 'casa' }).colmo,
    );
  });

  it('nelle impronte con rientranze i muri vanno dal più lontano al più vicino', () => {
    const quadrato = preparaEdificio({ p: [0, 0, 10, 0, 10, 10, 0, 10], h: 10, t: 'casa' });
    expect(quadrato.ordineMuri).toBeNull();
    // Pianta a L con la rientranza verso nord-est: lati sud (0), est basso (1), nord basso (2),
    // est alto (3), nord alto (4), ovest (5).
    const p = [0, 0, 20, 0, 20, 8, 8, 8, 8, 20, 0, 20];
    const e = preparaEdificio({ p, h: 10, t: 'casa' });
    expect(e.ordineMuri).not.toBeNull();
    const ordine = [...(e.ordineMuri as Uint16Array)];
    // Si vedono solo le pareti a sud e a ovest; nessuna parete che dà le spalle.
    expect(ordine.every((i) => e.lati[i] !== MURO_DIETRO)).toBe(true);
    expect(ordine.sort()).toEqual([0, 5]);
    // Pianta a C aperta verso sud-ovest: il muro interno, più lontano, viene prima.
    const aC = [0, 0, 30, 0, 30, 30, 0, 30, 0, 20, 20, 20, 20, 10, 0, 10];
    const lati = classificaLati(aC);
    const muri = [...ordinaMuri(aC, lati)];
    const media = (i: number): number => {
      const j = (i + 1) % (aC.length / 2);
      return (aC[i * 2] + aC[i * 2 + 1] + aC[j * 2] + aC[j * 2 + 1]) / 2;
    };
    for (let k = 1; k < muri.length; k++) expect(media(muri[k - 1])).toBeGreaterThanOrEqual(media(muri[k]));
    expect(muri.length).toBeGreaterThan(2);
  });
});

describe('griglia e selezione del visibile', () => {
  const c = creaCittaFinta(2000);
  const scena = costruisciScena(c.base, c.strati, c.landmark);
  const el = scena.elementi;

  const aForzaBruta = (z: { minX: number; minY: number; maxX: number; maxY: number }): number[] => {
    const u: number[] = [];
    for (let i = 0; i < el.n; i++) {
      const k = i * 4;
      const q = el.riquadri;
      if (q[k] <= z.maxX && q[k + 2] >= z.minX && q[k + 1] <= z.maxY && q[k + 3] >= z.minY) u.push(i);
    }
    return u;
  };

  it('trova esattamente ciò che tocca il riquadro, in ordine di disegno', () => {
    for (const camera of [
      { x: 0, y: 0, zoom: 2 },
      { x: -300, y: 250, zoom: 4 },
      { x: 400, y: -400, zoom: 1 },
      { x: 0, y: 0, zoom: 0.2 },
    ] as Camera[]) {
      const zona = riquadroVisibile(camera, vista);
      const trovati = [...el.griglia.interroga(zona)];
      expect(trovati).toEqual(aForzaBruta(zona));
      for (let i = 1; i < trovati.length; i++) expect(trovati[i]).toBeGreaterThan(trovati[i - 1]);
    }
  });

  it('a zoom alto scarta quasi tutto', () => {
    const zona = riquadroVisibile({ x: 0, y: 0, zoom: 6 }, vista);
    const trovati = el.griglia.interroga(zona);
    expect(trovati.length).toBeGreaterThan(0);
    expect(trovati.length).toBeLessThan(el.n / 10);
  });

  it('fuori dai dati non trova nulla', () => {
    expect(el.griglia.interroga({ minX: 9000, minY: 9000, maxX: 9100, maxY: 9100 })).toHaveLength(0);
    expect(new Griglia(new Float32Array(0), 0, 100).interroga({ minX: 0, minY: 0, maxX: 1, maxY: 1 })).toHaveLength(0);
  });

  it("il riquadro di un edificio comprende l'altezza del tetto", () => {
    const base = {
      fonte: '',
      strade: [],
      aree: [],
      alberi: [],
      edifici: [{ p: [0, 0, 10, 0, 10, 10, 0, 10], h: 50, t: 'casa' as const }],
    };
    const s = costruisciScena(base, { fonti: [], punti: [], linee: [] }, []);
    // L'impronta arriva fino a sy = -7.07; il tetto sta 40.8 unità più su.
    expect(s.elementi.riquadri[1]).toBeLessThan(-7.07 - 40);
    // Una fascia sopra l'impronta, dove si vede solo il tetto, trova l'edificio.
    expect(s.elementi.griglia.interroga({ minX: -5, minY: -45, maxX: 5, maxY: -30 })).toHaveLength(1);
  });

  it('le tessere coprono tutti gli elementi una volta sola e li contengono', () => {
    const indici = scena.edifici.map((_, i) => i);
    const tessere = raggruppaInTessere(scena.riquadriEdifici, indici, 300);
    expect(tessere.length).toBeGreaterThan(1);
    const visti = new Set<number>();
    for (const t of tessere) {
      for (const i of t.indici) {
        expect(visti.has(i)).toBe(false);
        visti.add(i);
        const k = i * 4;
        expect(scena.riquadriEdifici[k]).toBeGreaterThanOrEqual(t.minX);
        expect(scena.riquadriEdifici[k + 1]).toBeGreaterThanOrEqual(t.minY);
        expect(scena.riquadriEdifici[k + 2]).toBeLessThanOrEqual(t.maxX);
        expect(scena.riquadriEdifici[k + 3]).toBeLessThanOrEqual(t.maxY);
      }
    }
    expect(visti.size).toBe(scena.edifici.length);
  });

  it('il dettaglio scende con lo zoom', () => {
    const s = soglieDettaglio(vista);
    expect(s.piatto).toBeLessThan(s.muri);
    expect(livelloDettaglio(s.piatto * 0.9, vista)).toBe('piatto');
    expect(livelloDettaglio((s.piatto + s.muri) / 2, vista)).toBe('tetti');
    expect(livelloDettaglio(s.muri * 1.1, vista)).toBe('pieno');
    // Su uno schermo piccolo i muri compaiono prima.
    expect(soglieDettaglio({ larghezza: 390, altezza: 800 }).muri).toBeLessThan(
      soglieDettaglio({ larghezza: 1920, altezza: 1080 }).muri,
    );
  });

  it('regge ventimila edifici: scena in tempi ragionevoli e selezione veloce', () => {
    const grande = creaCittaFinta(20000, 2600);
    expect(grande.base.edifici.length).toBeGreaterThan(18000);
    const t0 = performance.now();
    const s = costruisciScena(grande.base, grande.strati, grande.landmark);
    const costruzione = performance.now() - t0;
    const zona = riquadroVisibile({ x: 0, y: 0, zoom: 1.5 }, { larghezza: 1440, altezza: 900 });
    const t1 = performance.now();
    let quanti = 0;
    for (let i = 0; i < 100; i++) quanti = s.elementi.griglia.interroga(zona).length;
    const perSelezione = (performance.now() - t1) / 100;
    expect(quanti).toBeGreaterThan(100);
    expect(quanti).toBeLessThan(s.elementi.n / 4);
    // Il tempo totale a orologio dipende da quanto è carica la macchina: il limite è largo.
    expect(costruzione).toBeLessThan(8000);
    // Il conto vero è sul singolo edificio (tetto compreso): il migliore di tre giri su un
    // campione, così un momento di carico non fa fallire la prova.
    const campione = grande.base.edifici.slice(0, 1500);
    let migliore = Infinity;
    for (let giro = 0; giro < 3; giro++) {
      const t2 = performance.now();
      for (const e of campione) preparaEdificio(e);
      migliore = Math.min(migliore, (performance.now() - t2) / campione.length);
    }
    expect(migliore).toBeLessThan(0.12);
    expect(perSelezione).toBeLessThan(4);
  });
});

describe('segnaposto e clic', () => {
  const c = creaCittaFinta(100);
  const scena = costruisciScena(c.base, c.strati, c.landmark);
  const camera: Camera = { x: 0, y: 0, zoom: 2.5 };

  it('si vedono solo i segnaposto degli strati accesi', () => {
    const cultura = marcatoriInVista(scena.punti, { cultura: true, ambiente: false, mobilita: false }, camera, vista);
    expect(cultura.map((m) => scena.punti[m.indice].dati.id).sort()).toEqual(['museo', 'teatro']);
    expect(marcatoriInVista(scena.punti, { cultura: false, ambiente: false, mobilita: false }, camera, vista)).toHaveLength(0);
    expect(marcatoriInVista(scena.punti, tutti, camera, vista).length).toBeGreaterThan(2);
  });

  it('quelli fuori dalla vista vengono scartati', () => {
    const lontano: Camera = { x: 2000, y: 2000, zoom: 3 };
    expect(marcatoriInVista(scena.punti, tutti, lontano, vista)).toHaveLength(0);
  });

  it('la punta poggia sul punto, la testa sta sopra', () => {
    const m = marcatoriInVista(scena.punti, tutti, camera, vista).find(
      (v) => scena.punti[v.indice].dati.id === 'museo',
    ) as Marcatore;
    const atteso = isoInSchermo(scena.punti[m.indice].sx, scena.punti[m.indice].sy, camera, vista);
    expect(m.px).toBeCloseTo(atteso.px, 9);
    expect(m.py).toBeCloseTo(atteso.py, 9);
    expect(m.ty).toBeLessThan(m.py);
    expect(m.pallino).toBe(false);
  });

  it('a zoom basso diventano pallini', () => {
    expect(misureSegnaposto(ZOOM_SEGNAPOSTO - 0.1, true)).toEqual({ raggio: 5, gambo: 0, pallino: true });
    expect(misureSegnaposto(3, true).raggio).toBeGreaterThan(misureSegnaposto(3, false).raggio);
  });

  it('colpire testa e gambo, mancare il resto', () => {
    const m: Marcatore = { indice: 0, px: 100, py: 100, tx: 100, ty: 80, raggio: 10, pallino: false };
    expect(colpisceMarcatore(100, 80, m, 0)).toBe(true);
    expect(colpisceMarcatore(109, 80, m, 0)).toBe(true);
    expect(colpisceMarcatore(113, 80, m, 0)).toBe(false);
    expect(colpisceMarcatore(113, 80, m, 4)).toBe(true);
    expect(colpisceMarcatore(101, 97, m, 0)).toBe(true); // sul gambo
    expect(colpisceMarcatore(112, 99, m, 0)).toBe(false);
    expect(distanzaDaSegmento(5, 5, 0, 0, 10, 0)).toBe(5);
    expect(distanzaDaSegmento(-3, 4, 0, 0, 10, 0)).toBe(5);
  });

  it('il rettangolo di un luogo simbolo rispetta scala e ancora', () => {
    const l = preparaLandmark(c.landmark[1]); // 60 m, ancora [0.5, 0.85], nell'origine
    const s = rettangoloSprite(l, 1, 1.5, camera, vista);
    expect(s.larghezza).toBeCloseTo(150, 9);
    expect(s.altezza).toBeCloseTo(225, 9);
    expect(s.x).toBeCloseTo(500 - 75, 6);
    expect(s.y).toBeCloseTo(350 - 0.85 * 225, 6);
    // L'ancora cade sul punto del terreno.
    const uv = dentroSprite(500, 350, s);
    expect(uv?.u).toBeCloseTo(0.5, 6);
    expect(uv?.v).toBeCloseTo(0.85, 6);
    expect(dentroSprite(s.x - 1, 350, s)).toBeNull();
  });

  it('un luogo piccolo si ingrandisce un poco, mai fino a perdere le proporzioni', () => {
    // Abbastanza grande: scala vera.
    expect(larghezzaSprite(60, 2.5)).toBe(150);
    // Appena sotto il minimo: si porta a SPRITE_MINIMO.
    expect(larghezzaSprite(60, 0.3)).toBeCloseTo(SPRITE_MINIMO, 9);
    // Molto piccolo: l'ingrandimento si ferma al massimo, non arriva a 20 pixel.
    expect(larghezzaSprite(13.8, 0.3)).toBeCloseTo(13.8 * 0.3 * SPRITE_INGRANDIMENTO_MASSIMO, 9);
    expect(larghezzaSprite(13.8, 0.3)).toBeLessThan(SPRITE_MINIMO);
    // Le proporzioni tra luoghi restano: il rinoceronte non diventa largo come il ponte.
    expect(larghezzaSprite(59.5, 0.3) / larghezzaSprite(13.8, 0.3)).toBeGreaterThan(2.5);
    const l = preparaLandmark(c.landmark[1]);
    expect(rettangoloSprite(l, 1, 1.5, { x: 0, y: 0, zoom: 0.05 }, vista).larghezza).toBeCloseTo(4.5, 9);
  });

  it('il segnaposto che sta sul disegno della sua storia si può saltare', () => {
    const conLuogo = costruisciScena(
      {
        ...c.base,
        edifici: [],
      },
      {
        ...c.strati,
        punti: [
          { id: 'sulla-torre', strato: 'cultura', tipo: 'monumento', nome: 'Torre', x: 5, y: -4, storia: 'torre-civica-piazze' },
          { id: 'lontano', strato: 'cultura', tipo: 'monumento', nome: 'Porta', x: 300, y: 300, storia: 'torre-civica-piazze' },
          { id: 'altra-storia', strato: 'cultura', tipo: 'museo', nome: 'Museo', x: 6, y: 2, storia: 'museo-civico' },
          { id: 'senza', strato: 'cultura', tipo: 'chiesa', nome: 'Chiesa', x: 2, y: 2 },
        ],
      },
      c.landmark,
    );
    const perId = new Map(conLuogo.punti.map((p) => [p.dati.id, p.landmark]));
    expect(perId.get('sulla-torre')).toBe(1);
    expect(perId.get('lontano')).toBe(-1);
    expect(perId.get('altra-storia')).toBe(-1);
    expect(perId.get('senza')).toBe(-1);
    const tutte = marcatoriInVista(conLuogo.punti, tutti, camera, vista);
    const senzaDoppi = marcatoriInVista(conLuogo.punti, tutti, camera, vista, (p) => p.landmark >= 0);
    expect(tutte.length - senzaDoppi.length).toBe(1);
    expect(senzaDoppi.some((m) => conLuogo.punti[m.indice].dati.id === 'sulla-torre')).toBe(false);
  });

  it("un edificio davanti copre il clic sull'illustrazione", () => {
    // Quadrato di 10 m alto 8 unità, sul piano isometrico.
    const p = [0, 0, 10, 0, 10, 10, 0, 10];
    const e = preparaEdificio({ p, h: 10, t: 'casa' });
    const centroTetto = metriInIso(5, 5);
    expect(puntoSuEdificio(centroTetto.sx, centroTetto.sy - e.alt, e.anello, e.alt, e.lati)).toBe(true);
    // A metà della parete sud (quella di destra), a mezza altezza.
    const piede = metriInIso(5, 0);
    expect(puntoSuEdificio(piede.sx, piede.sy - e.alt / 2, e.anello, e.alt, e.lati)).toBe(true);
    // Appena sotto il piede della parete: terreno.
    expect(puntoSuEdificio(piede.sx, piede.sy + 1, e.anello, e.alt, e.lati)).toBe(false);
    // Lontano.
    expect(puntoSuEdificio(piede.sx + 100, piede.sy, e.anello, e.alt, e.lati)).toBe(false);
    const sprite: Sprite[] = [{ indice: 0, x: 100, y: 100, larghezza: 200, altezza: 200 }];
    expect(trovaBersaglio(150, 150, [], sprite, 0, undefined, () => true)).toBeNull();
    expect(trovaBersaglio(150, 150, [], sprite, 0, undefined, () => false)).toEqual({ genere: 'landmark', indice: 0 });
  });

  it('priorità: prima i segnaposto, poi le illustrazioni, poi niente', () => {
    const marcatori: Marcatore[] = [
      { indice: 7, px: 200, py: 200, tx: 200, ty: 180, raggio: 10, pallino: false },
      { indice: 9, px: 205, py: 204, tx: 205, ty: 184, raggio: 10, pallino: false },
    ];
    const sprite: Sprite[] = [
      { indice: 0, x: 100, y: 100, larghezza: 200, altezza: 200 },
      { indice: 1, x: 250, y: 150, larghezza: 100, altezza: 100 },
    ];
    // Sopra due segnaposto sovrapposti vince l'ultimo disegnato (il più vicino).
    expect(trovaBersaglio(203, 182, marcatori, sprite, 0)).toEqual({ genere: 'punto', indice: 9 });
    // Il segnaposto vince sull'illustrazione che gli sta sotto.
    expect(trovaBersaglio(193, 178, marcatori, sprite, 0)).toEqual({ genere: 'punto', indice: 7 });
    // Dove le illustrazioni si sovrappongono vince quella davanti.
    expect(trovaBersaglio(280, 250, marcatori, sprite, 0)).toEqual({ genere: 'landmark', indice: 1 });
    expect(trovaBersaglio(120, 120, marcatori, sprite, 0)).toEqual({ genere: 'landmark', indice: 0 });
    expect(trovaBersaglio(600, 600, marcatori, sprite, 0)).toBeNull();
  });

  it("le parti trasparenti di un'illustrazione non contano", () => {
    const sprite: Sprite[] = [
      { indice: 0, x: 100, y: 100, larghezza: 200, altezza: 200 },
      { indice: 1, x: 250, y: 150, larghezza: 100, altezza: 100 },
    ];
    const soloMetaBassa = (_i: number, _u: number, v: number): boolean => v > 0.5;
    expect(trovaBersaglio(120, 120, [], sprite, 0, soloMetaBassa)).toBeNull();
    expect(trovaBersaglio(120, 280, [], sprite, 0, soloMetaBassa)).toEqual({ genere: 'landmark', indice: 0 });
    // Davanti è trasparente: il clic passa all'illustrazione dietro.
    expect(trovaBersaglio(280, 160, [], sprite, 0, (i) => i === 0)).toEqual({ genere: 'landmark', indice: 0 });
  });

  it('punto dentro e fuori da un poligono', () => {
    const elle = [0, 0, 10, 0, 10, 4, 4, 4, 4, 10, 0, 10];
    expect(puntoInPoligono(2, 2, elle)).toBe(true);
    expect(puntoInPoligono(2, 8, elle)).toBe(true);
    expect(puntoInPoligono(8, 8, elle)).toBe(false);
    expect(puntoInPoligono(-1, 5, elle)).toBe(false);
  });
});

describe("posizione nell'indirizzo", () => {
  it('scrive metri interi e zoom con due decimali', () => {
    expect(formattaHash({ x: 123.6, y: -45.4, zoom: 1.756 })).toBe('#@124,-45,1.76');
    expect(formattaHash({ x: -0.2, y: 0.3, zoom: 2 })).toBe('#@0,0,2.00');
  });

  it('legge quello che scrive', () => {
    const letto = leggiHash(formattaHash({ x: -1234, y: 987, zoom: 0.35 }));
    expect(letto).toEqual({ camera: { x: -1234, y: 987, zoom: 0.35 }, resto: '' });
    expect(leggiHash('@10,20,1.5')?.camera).toEqual({ x: 10, y: 20, zoom: 1.5 });
  });

  it('rifiuta gli hash che non sono una posizione', () => {
    for (const h of ['', '#', '#fonti', '#@', '#@1,2', '#@a,b,c', '#@1,2,0', '#@1,2,-3', '#@1,2,3abc', '#@1,,3']) {
      expect(leggiHash(h)).toBeNull();
    }
  });

  it('conserva ciò che segue la posizione', () => {
    const letto = leggiHash('#@10,-20,1.50/ponte-vecchio');
    expect(letto?.resto).toBe('/ponte-vecchio');
    expect(formattaHash({ x: 11, y: -20, zoom: 1.5 }, letto?.resto)).toBe('#@11,-20,1.50/ponte-vecchio');
  });

  it("non tocca un hash usato da un'altra parte del sito", () => {
    expect(hashDellaMappa('')).toBe(true);
    expect(hashDellaMappa('#@1,2,3.00')).toBe(true);
    expect(hashDellaMappa('#fonti')).toBe(false);
  });
});

describe('contorno', () => {
  it('la tavolozza ha un colore per ogni strato e per ogni tipo di area', () => {
    for (const s of ['cultura', 'ambiente', 'mobilita'] as const) expect(PALETTE.strati[s].fondo).toMatch(/^#[0-9a-f]{6}$/);
    for (const a of ['acqua', 'parco', 'bosco', 'prato', 'piazza', 'coltivo'] as const) expect(PALETTE.aree[a]).toMatch(/^#[0-9a-f]{6}$/);
    expect(sfuma('#808080', 0)).toBe('#808080');
    expect(sfuma('#808080', 1)).toBe('#ffffff');
    expect(sfuma('#808080', -1)).toBe('#000000');
  });

  it("dà una misura certa agli SVG e ne legge la proporzione", () => {
    const a = normalizzaSvg('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect/></svg>');
    expect(a?.proporzione).toBeCloseTo(0.75, 9);
    expect(a?.testo).toContain('width="1024" height="768"');
    expect(a?.testo).toContain('viewBox="0 0 400 300"');
    const b = normalizzaSvg('<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg"/>');
    expect(b?.proporzione).toBeCloseTo(0.5, 9);
    expect(b?.testo).toContain('viewBox="0 0 200 100"');
    expect(b?.testo).toContain('width="1024" height="512"');
    expect(b?.testo).not.toContain('width="200"');
    expect(normalizzaSvg('<div/>')).toBeNull();
  });
});

describe('luce: le tre tavolozze', () => {
  /** Tutte le chiavi di un oggetto, annidate, con il tipo del valore e la lunghezza degli elenchi. */
  const forma = (v: unknown, prefisso = ''): string[] => {
    if (Array.isArray(v)) return [`${prefisso}[${v.length}]`];
    if (v !== null && typeof v === 'object') {
      return Object.entries(v)
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([k, w]) => forma(w, prefisso + '.' + k));
    }
    // null (nessun velo sui disegni, di giorno) conta come oggetto mancante: si guarda solo il nome.
    return [prefisso + ':' + (v === null ? 'oggetto' : typeof v)];
  };
  const senzaVelo = (righe: string[]): string[] => righe.filter((r) => !r.startsWith('.illustrazioni'));

  it('hanno le stesse chiavi e gli elenchi della stessa lunghezza', () => {
    expect(Object.keys(PALETTE_PER_LUCE).sort()).toEqual(['giorno', 'notte', 'pomeriggio']);
    expect(Object.keys(PALETTE_POMERIGGIO).sort()).toEqual(Object.keys(PALETTE).sort());
    expect(Object.keys(PALETTE_NOTTE).sort()).toEqual(Object.keys(PALETTE).sort());
    expect(senzaVelo(forma(PALETTE_POMERIGGIO))).toEqual(senzaVelo(forma(PALETTE)));
    expect(senzaVelo(forma(PALETTE_NOTTE))).toEqual(senzaVelo(forma(PALETTE)));
  });

  it('ogni colore è scritto in un modo che il canvas capisce', () => {
    const colori = (v: unknown): string[] =>
      typeof v === 'string' ? [v] : v !== null && typeof v === 'object' ? Object.values(v).flatMap(colori) : [];
    for (const p of Object.values(PALETTE_PER_LUCE)) {
      for (const c of colori(p)) {
        if (c === '') continue;
        expect(c).toMatch(/^(#[0-9a-f]{6}|rgba\(\d+, \d+, \d+, [\d.]+\))$/);
      }
    }
  });

  it('il giorno è la cartolina dipinta: carta calda, cotto profondo, intonaci ocra', () => {
    expect(PALETTE_PER_LUCE.giorno).toBe(PALETTE);
    expect(PALETTE.carta).toBe('#f2e5c6');
    expect(PALETTE.seppia).toBe('#6b4f3a');
    expect(PALETTE.aree.acqua).toBe('#86b4a4');
    expect(PALETTE.acquaChiara).toBe('#a8cdbc');
    expect(PALETTE.strade.principale).toEqual({ riempimento: '#fff6e0', bordo: '#b3946a' });
    // Le strade staccano dal terreno: sono tutte più chiare della carta, anche fuori dal centro.
    for (const s of Object.values(PALETTE.strade)) {
      expect(luminanza(s.riempimento)).toBeGreaterThan(luminanza(PALETTE.carta) + 0.005);
      expect(luminanza(s.bordo)).toBeLessThan(luminanza(PALETTE.carta) - 0.15);
    }
    // Dieci toni di cotto, tutti più rossi che verdi e più verdi che blu: mai rosa, mai grigi.
    expect(PALETTE.tetti).toHaveLength(10);
    for (const t of PALETTE.tetti) {
      const n = parseInt(t.slice(1), 16);
      expect((n >> 16) & 255).toBeGreaterThan(((n >> 8) & 255) + 60);
      expect((n >> 8) & 255).toBeGreaterThan((n & 255) + 30);
    }
    // Intonaci ocra, gialli e crema: il blu resta ben sotto il rosso (niente bianco freddo).
    for (const c of [...PALETTE.intonaci, ...PALETTE.intonaciForti, ...PALETTE.intonaciChiari]) {
      const n = parseInt(c.slice(1), 16);
      expect((n >> 16) & 255).toBeGreaterThan((n & 255) + 20);
    }
    expect(PALETTE.intonaci[0]).toBe('#f0d9a4');
    expect(PALETTE.edificiLontani).toBe('#c98455');
    expect(PALETTE.ombra).toBe('rgba(84, 62, 42, 0.2)');
    expect(PALETTE.etichetta).toBe('#3d2c20');
    expect(PALETTE.etichettaAlone).toBe('#fbf4e3');
    // Di giorno ombre proprie decise ma calde: l'ombra di un giallo resta ocra, non oliva.
    expect(PALETTE.muri).toEqual({ chiaro: 0.08, scuro: -0.17 });
    expect(PALETTE.ombraCalda).toBe(1);
    expect(PALETTE_NOTTE.ombraCalda).toBe(0);
    {
      const canali = (c: string): number[] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
      const [r0, g0, b0] = canali('#e2ad52');
      const [r, g, b] = canali(inOmbra('#e2ad52', -0.2, 1));
      const [rs, gs, bs] = canali(sfuma('#e2ad52', -0.2));
      // Più scuro, ma il rosso scende meno e il blu di più che scurendo tutto insieme.
      expect(r).toBeLessThan(r0);
      expect(r).toBeGreaterThan(rs);
      expect(g).toBeLessThanOrEqual(gs);
      expect(b).toBeLessThan(bs);
      expect(g0 - g).toBeGreaterThan(0);
      expect(b0 - b).toBeGreaterThan(0);
      // Senza calore è proprio sfuma, e schiarendo pure.
      expect(inOmbra('#e2ad52', -0.2, 0)).toBe(sfuma('#e2ad52', -0.2));
      expect(inOmbra('#e2ad52', 0.1, 1)).toBe(sfuma('#e2ad52', 0.1));
    }
    expect(parseInt(PALETTE.ombraTinta.colore.slice(1, 3), 16)).toBeGreaterThan(parseInt(PALETTE.ombraTinta.colore.slice(5), 16));
    // La china dei contorni è più scura della seppia dei dettagli.
    expect(luminanza(PALETTE.china)).toBeLessThan(luminanza(PALETTE.seppia));
    expect(PALETTE.ombraLunga).toBe(1);
    expect(PALETTE.sfondo).toBe(PALETTE.carta);
    expect(PALETTE.lampioni.accesi).toBe(false);
    expect(PALETTE.finestra).toBe('');
    // I luoghi simbolo prendono un velo caldo leggero, senza luce dal basso.
    expect(PALETTE.illustrazioni?.luce).toBe('');
    expect(luminanza(PALETTE.illustrazioni?.velo ?? '#000000')).toBeGreaterThan(0.8);
  });

  const principali = (p: typeof PALETTE): string[] => [
    p.carta,
    p.sfondo,
    ...Object.values(p.aree),
    ...Object.values(p.strade).map((s) => s.riempimento),
    ...p.tetti,
    ...p.intonaci,
    p.edificiLontani,
    ...p.chiome,
  ];
  const media = (colori: string[]): number => colori.reduce((s, c) => s + luminanza(c), 0) / colori.length;

  it('la notte è molto più scura del giorno, il pomeriggio poco', () => {
    const giorno = media(principali(PALETTE));
    const pomeriggio = media(principali(PALETTE_POMERIGGIO));
    const notte = media(principali(PALETTE_NOTTE));
    expect(notte).toBeLessThan(giorno * 0.45);
    expect(pomeriggio).toBeLessThan(giorno);
    expect(pomeriggio).toBeGreaterThan(giorno * 0.8);
    // Ogni singolo colore della notte è più scuro del suo gemello di giorno.
    const g = principali(PALETTE);
    principali(PALETTE_NOTTE).forEach((c, i) => expect(luminanza(c)).toBeLessThan(luminanza(g[i])));
  });

  it('di notte la mappa resta leggibile', () => {
    const N = PALETTE_NOTTE;
    // Case più chiare della carta, strade più chiare della carta, Brenta più scuro.
    for (const c of N.intonaci) expect(luminanza(c)).toBeGreaterThan(luminanza(N.carta) + 0.1);
    for (const s of Object.values(N.strade)) {
      expect(luminanza(s.riempimento)).toBeGreaterThan(luminanza(N.carta) + 0.06);
    }
    expect(luminanza(N.aree.acqua)).toBeLessThan(luminanza(N.carta));
    // Scritte chiare su alone scuro, al contrario del giorno.
    expect(luminanza(N.etichetta) - luminanza(N.etichettaAlone)).toBeGreaterThan(0.7);
    expect(luminanza(PALETTE.etichettaAlone) - luminanza(PALETTE.etichetta)).toBeGreaterThan(0.7);
    // I segnaposto non cambiano: si riconoscono dal colore dello strato.
    expect(N.strati).toEqual(PALETTE.strati);
    expect(PALETTE_POMERIGGIO.strati).toEqual(PALETTE.strati);
    expect(N.lampioni.accesi).toBe(true);
    expect(N.finestra).not.toBe('');
  });

  it('il pomeriggio è più caldo: meno blu, pareti più contrastate, ombre più lunghe', () => {
    const blu = (c: string): number => parseInt(c.slice(5), 16);
    const rosso = (c: string): number => parseInt(c.slice(1, 3), 16);
    expect(blu(PALETTE_POMERIGGIO.carta)).toBeLessThan(blu(PALETTE.carta) - 20);
    expect(rosso(PALETTE_POMERIGGIO.carta)).toBeGreaterThan(rosso(PALETTE.carta) - 8);
    expect(blu(PALETTE_POMERIGGIO.aree.acqua)).toBeLessThan(blu(PALETTE.aree.acqua));
    expect(PALETTE_POMERIGGIO.muri.scuro).toBeLessThan(PALETTE.muri.scuro);
    expect(PALETTE_POMERIGGIO.ombraLunga).toBeGreaterThan(1.5);
  });
});

describe('lampioni', () => {
  const c = creaCittaFinta(300);
  // Tre lampioni lungo una via, uno lontano, e una coppia rovinata che va scartata.
  const metri = [0, 0, 30, 0, 60, 0, 400, -350, Number.NaN, 5];

  it('proietta le posizioni e scarta quelle non valide', () => {
    const p = preparaLampioni(metri);
    expect(p.length).toBe(8);
    for (let i = 0; i < 4; i++) {
      const iso = metriInIso(metri[i * 2], metri[i * 2 + 1]);
      expect(p[i * 2]).toBeCloseTo(iso.sx, 3);
      expect(p[i * 2 + 1]).toBeCloseTo(iso.sy, 3);
    }
    expect(preparaLampioni(undefined).length).toBe(0);
    expect(preparaLampioni([1, 2, 3]).length).toBe(2);
  });

  it('senza lampioni la scena è quella di prima', () => {
    const scena = costruisciScena(c.base, c.strati, c.landmark);
    expect(scena.lampioni.length).toBe(0);
    expect(scena.elementi.n).toBe(scena.edifici.length + scena.alberi.length / 2 + scena.landmark.length);
    expect(lampioniNellaZona(scena, { minX: -1e6, minY: -1e6, maxX: 1e6, maxY: 1e6 }).length).toBe(0);
  });

  it('con i lampioni: contati, in ordine di profondità tra le case, trovati per riquadro', () => {
    const senza = costruisciScena(c.base, c.strati, c.landmark);
    const scena = costruisciScena(c.base, c.strati, c.landmark, metri);
    expect(scena.lampioni.length / 2).toBe(4);
    const el = scena.elementi;
    expect(el.n).toBe(senza.elementi.n + 4);
    let contati = 0;
    for (let i = 0; i < el.n; i++) {
      if (el.tipo[i] === EL_LAMPIONE) contati++;
      if (i > 0) expect(el.chiave[i]).toBeLessThanOrEqual(el.chiave[i - 1]);
    }
    expect(contati).toBe(4);
    // La chiave di un lampione è x + y del suo piede.
    for (let i = 0; i < el.n; i++) {
      if (el.tipo[i] !== EL_LAMPIONE) continue;
      const k = el.rif[i];
      expect(el.chiave[i]).toBeCloseTo(metri[k * 2] + metri[k * 2 + 1], 2);
    }

    // Un riquadro stretto attorno ai primi due.
    const a = metriInIso(0, 0);
    const b = metriInIso(30, 0);
    const zona = {
      minX: Math.min(a.sx, b.sx) - 2,
      maxX: Math.max(a.sx, b.sx) + 2,
      minY: Math.min(a.sy, b.sy) - 2,
      maxY: Math.max(a.sy, b.sy) + 2,
    };
    expect([...lampioniNellaZona(scena, zona)]).toEqual([0, 1]);
    // La vista sul centro a zoom alto prende i tre della via e non quello lontano.
    const camera: Camera = { x: 30, y: 0, zoom: 4 };
    expect([...lampioniNellaZona(scena, riquadroVisibile(camera, vista))]).toEqual([0, 1, 2]);
    expect(lampioniNellaZona(scena, { minX: 9000, minY: 9000, maxX: 9100, maxY: 9100 }).length).toBe(0);
  });

  it('regge diecimila lampioni', () => {
    const tanti: number[] = [];
    for (let i = 0; i < 10000; i++) tanti.push(((i * 37) % 1200) - 600, ((i * 91) % 1200) - 600);
    const scena = costruisciScena(c.base, c.strati, c.landmark, tanti);
    const inizio = performance.now();
    let trovati = 0;
    for (let i = 0; i < 200; i++) {
      trovati += lampioniNellaZona(scena, riquadroVisibile({ x: (i % 20) * 20 - 200, y: 0, zoom: 3 }, vista)).length;
    }
    expect(trovati).toBeGreaterThan(0);
    expect(performance.now() - inizio).toBeLessThan(400);
  });
});

describe('aloni dei lampioni da lontano', () => {
  const c = creaCittaFinta(50);
  // Ottomila lampioni sparsi su circa 4 km, come nel file vero, in ordine di x come i primi del file.
  const tanti: number[] = [];
  for (let i = 0; i < 8000; i++) tanti.push((i / 8000) * 4000 - 2000, ((i * 7919) % 4000) - 2000);
  const scena = costruisciScena(c.base, c.strati, c.landmark, tanti);
  const accesi = (camera: Camera, v: Vista): Set<number> => {
    const a = aloniInVista(scena, camera, v);
    return new Set(a.indici.subarray(0, a.quanti));
  };

  it('la quota cresce con lo zoom senza scatti: metà da lontano, tutti da vicino', () => {
    expect(quotaAloni(0.05)).toBe(0.5);
    expect(quotaAloni(ZOOM_ALONI.pochi)).toBe(0.5);
    expect(quotaAloni(ZOOM_ALONI.tutti)).toBe(1);
    expect(quotaAloni(8)).toBe(1);
    for (let z = 0.05; z < 1; z += 0.01) {
      const salto = quotaAloni(z + 0.01) - quotaAloni(z);
      expect(salto).toBeGreaterThanOrEqual(0);
      expect(salto).toBeLessThan(0.03);
    }
  });

  it('il rango è sparso in modo uniforme, anche tra lampioni vicini nel file', () => {
    expect(scena.rangoLampioni.length).toBe(8000);
    for (const [da, a] of [[0, 600], [600, 1200], [7000, 8000]]) {
      let sotto = 0;
      for (let i = da; i < a; i++) if (scena.rangoLampioni[i] < 0.5) sotto++;
      expect(sotto / (a - da)).toBeGreaterThan(0.45);
      expect(sotto / (a - da)).toBeLessThan(0.55);
    }
  });

  it('trascinando la mappa restano accese le stesse luci', () => {
    for (const [v, zoom] of [[{ larghezza: 1440, altezza: 800 }, 0.18], [{ larghezza: 390, altezza: 760 }, 0.06]] as [Vista, number][]) {
      const prima = accesi({ x: 0, y: 0, zoom }, v);
      // 40 pixel di trascinamento, in metri sul piano della mappa.
      const dopo = accesi({ x: 40 / zoom, y: -40 / zoom, zoom }, v);
      expect(prima.size).toBeGreaterThan(1000);
      let comuni = 0;
      for (const i of prima) if (dopo.has(i)) comuni++;
      // Cambiano solo le luci che entrano o escono dal bordo.
      expect(comuni / prima.size).toBeGreaterThan(0.9);
      // E nessun lampione rimasto in vista si spegne o si accende.
      const quota = quotaAloni(zoom);
      for (const i of dopo) expect(scena.rangoLampioni[i]).toBeLessThan(quota);
    }
  });

  it('cambiando zoom di poco cambia di poco anche il numero di luci', () => {
    const v: Vista = { larghezza: 1440, altezza: 800 };
    let prima = accesi({ x: 0, y: 0, zoom: 0.1 }, v).size;
    for (let zoom = 0.11; zoom < 0.6; zoom += 0.01) {
      const ora = accesi({ x: 0, y: 0, zoom }, v).size;
      expect(Math.abs(ora - prima) / Math.max(prima, 1)).toBeLessThan(0.15);
      prima = ora;
    }
  });

  it('da vicino si accendono tutti quelli in vista', () => {
    const a = aloniInVista(scena, { x: 0, y: 0, zoom: 2 }, { larghezza: 1440, altezza: 800 });
    expect(a.quota).toBe(1);
    expect(a.quanti).toBe(a.indici.length);
    expect(a.quanti).toBeGreaterThan(0);
  });
});

describe('pezze d\'acqua nei disegni dei luoghi simbolo', () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g stroke="#000">' +
    '<path d="M0 0L5 0L5 5Z" fill="#7fb8ad" stroke="none"/>' +
    '<path d="M0 0L5 0L5 5Z" fill="#3d3a2c" fill-opacity="0.28"/>' +
    '<rect x="1" y="1" width="2" height="2" fill="#7FB8AD"/></g></svg>';

  it('separa gli elementi con il colore dell\'acqua di giorno dal resto', () => {
    const parti = separaAcqua(svg);
    expect(parti).not.toBeNull();
    if (!parti) return;
    expect(parti.senza).not.toMatch(/7fb8ad/i);
    expect(parti.senza).toContain('#3d3a2c');
    expect(parti.solo.match(/7fb8ad/gi)?.length).toBe(2);
    expect(parti.solo).not.toContain('#3d3a2c');
    expect(parti.solo.startsWith('<svg')).toBe(true);
    expect(parti.solo.endsWith('</svg>')).toBe(true);
    expect(parti.solo).toContain('viewBox="0 0 10 10"');
  });

  it('un disegno senza acqua resta intero', () => {
    expect(separaAcqua('<svg viewBox="0 0 1 1"><path d="M0 0" fill="#fff"/></svg>')).toBeNull();
    expect(separaAcqua('niente')).toBeNull();
  });

  it('il colore cercato è quello scritto nei file, e ogni luce dice il proprio', () => {
    expect(ACQUA_NEI_DISEGNI).toBe('#7fb8ad');
    expect(PALETTE.illustrazioni?.acqua).toBe(PALETTE.aree.acqua);
    expect(PALETTE_NOTTE.illustrazioni?.acqua).toBe(PALETTE_NOTTE.aree.acqua);
    expect(PALETTE_POMERIGGIO.illustrazioni?.acqua).toBe(PALETTE_POMERIGGIO.aree.acqua);
  });
});

describe('disegno nelle tre luci', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Un contesto finto: accetta ogni chiamata e ricorda i colori usati per riempire. */
  const contestoFinto = (): { ctx: CanvasRenderingContext2D; riempimenti: Set<string>; chiamate: () => number } => {
    const riempimenti = new Set<string>();
    let chiamate = 0;
    const stato: Record<string, unknown> = { canvas: { width: 1000, height: 700 } };
    const ctx = new Proxy(stato, {
      get(o, nome: string) {
        if (nome in o) return o[nome];
        if (nome === 'measureText') return () => ({ width: 40 });
        return () => {
          chiamate++;
        };
      },
      set(o, nome: string, valore) {
        o[nome] = valore;
        if (nome === 'fillStyle' && typeof valore === 'string') riempimenti.add(valore);
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, riempimenti, chiamate: () => chiamate };
  };

  const illustrazioniFinte = (quante: number): { finte: Illustrazioni; tinte: unknown[] } => {
    const tinte: unknown[] = [];
    const finte = {
      elenco: Array.from({ length: quante }, () => ({ pronta: false, proporzione: 1 })),
      impostaTinta: (t: unknown) => tinte.push(t),
      daDisegnare: () => null,
    } as unknown as Illustrazioni;
    return { finte, tinte };
  };

  it('impostaLuce cambia i colori, non rompe il disegno e con la stessa luce non fa nulla', () => {
    vi.stubGlobal(
      'Path2D',
      class {
        moveTo(): void {}
        lineTo(): void {}
        closePath(): void {}
      },
    );
    const c = creaCittaFinta(200);
    const lampioni: number[] = [];
    for (let x = -200; x <= 200; x += 25) lampioni.push(x, 0);
    const scena = costruisciScena(c.base, c.strati, c.landmark, lampioni);
    const copia = JSON.stringify([...scena.elementi.tipo.slice(0, 50)]);
    const { finte, tinte } = illustrazioniFinte(c.landmark.length);
    const d = new Disegnatore(scena, finte);
    expect(d.luce).toBe('giorno');
    expect(d.sfondo).toBe(PALETTE.sfondo);
    expect(d.impostaLuce('giorno')).toBe(false);
    // Alla nascita il disegnatore dice ai luoghi simbolo il velo del giorno, una volta sola.
    expect(tinte).toEqual([PALETTE.illustrazioni]);

    const stato = (zoom: number) => ({
      camera: { x: 0, y: 0, zoom },
      vista,
      densita: 1,
      visibili: tutti,
      evidenziata: null,
      puntoSopra: -1,
      landmarkSopra: -1,
      area: { minX: -600, minY: -600, maxX: 600, maxY: 600 },
    });
    const usati: Record<string, Set<string>> = {};
    for (const luce of ['giorno', 'notte', 'pomeriggio', 'giorno'] as const) {
      if (luce !== 'giorno' || usati.giorno) expect(d.impostaLuce(luce)).toBe(true);
      expect(d.impostaLuce(luce)).toBe(false);
      expect(d.luce).toBe(luce);
      expect(d.sfondo).toBe(PALETTE_PER_LUCE[luce].sfondo);
      // Tutti e tre i livelli di dettaglio: piatto, solo tetti, pieno; e da molto vicino.
      for (const zoom of [0.1, 0.5, 2.4, 6]) {
        const f = contestoFinto();
        expect(() => d.disegna(f.ctx, stato(zoom))).not.toThrow();
        expect(f.chiamate()).toBeGreaterThan(10);
        expect(f.riempimenti.has(PALETTE_PER_LUCE[luce].carta)).toBe(true);
        if (zoom === 2.4) usati[luce] = f.riempimenti;
      }
    }
    // Di notte nessun riempimento usa la carta chiara del giorno, e i tetti sono quelli della notte.
    expect(usati.notte.has(PALETTE.carta)).toBe(false);
    expect(PALETTE_NOTTE.tetti.some((t) => usati.notte.has(t))).toBe(true);
    expect(PALETTE.tetti.some((t) => usati.giorno.has(t))).toBe(true);
    expect(usati.notte.has(PALETTE_NOTTE.finestra)).toBe(true);
    expect(usati.giorno.has(PALETTE_NOTTE.finestra)).toBe(false);
    // I luoghi simbolo sono stati avvisati alla nascita e a ogni cambio.
    expect(tinte).toEqual([
      PALETTE.illustrazioni,
      PALETTE_NOTTE.illustrazioni,
      PALETTE_POMERIGGIO.illustrazioni,
      PALETTE.illustrazioni,
    ]);
    // La scena non è stata toccata.
    expect(JSON.stringify([...scena.elementi.tipo.slice(0, 50)])).toBe(copia);
  });

  it('la pittura a motivo: un velo solo per fotogramma, stato rimesso a posto, nessun lavoro in più per casa', () => {
    vi.stubGlobal(
      'Path2D',
      class {
        moveTo(): void {}
        lineTo(): void {}
        closePath(): void {}
      },
    );
    // Un contesto che ricorda ogni riempimento e ogni tratto con lo stato che aveva in quel momento.
    interface Passo {
      nome: string;
      stile: unknown;
      alfa: unknown;
      fusione: unknown;
      morbido: unknown;
    }
    const registratore = (): { ctx: CanvasRenderingContext2D; passi: Passo[]; stato: Record<string, unknown>; conta: Record<string, number> } => {
      const passi: Passo[] = [];
      const conta: Record<string, number> = {};
      const stato: Record<string, unknown> = { canvas: { width: 1000, height: 700 }, imageSmoothingEnabled: true };
      const ctx = new Proxy(stato, {
        get(o, nome: string) {
          if (nome in o) return o[nome];
          if (nome === 'measureText') return () => ({ width: 40 });
          return () => {
            conta[nome] = (conta[nome] ?? 0) + 1;
            if (nome === 'fill' || nome === 'stroke' || nome === 'fillRect' || nome === 'drawImage' || nome === 'fillText') {
              passi.push({
                nome,
                stile: nome === 'stroke' ? o.strokeStyle : o.fillStyle,
                alfa: o.globalAlpha,
                fusione: o.globalCompositeOperation,
                morbido: o.imageSmoothingEnabled,
              });
            }
          };
        },
        set(o, nome: string, valore) {
          o[nome] = valore;
          return true;
        },
      }) as unknown as CanvasRenderingContext2D;
      return { ctx, passi, stato, conta };
    };
    // Trame finte: oggetti qualunque al posto dei motivi, riconoscibili per identità.
    const veli = [{ v: 0 }, { v: 1 }, { v: 2 }, { v: 3 }];
    const selciato = { s: 1 };
    const increspature = { o: 1 };
    const conTrame = (quanteCase: number): Disegnatore => {
      const c = creaCittaFinta(200);
      const base = { ...c.base, edifici: c.base.edifici.slice(0, quanteCase) };
      const d = new Disegnatore(costruisciScena(base, c.strati, c.landmark, []), illustrazioniFinte(c.landmark.length).finte);
      const interno = d as unknown as { trameDiLuce: Map<string, unknown> };
      for (const luce of ['giorno', 'pomeriggio', 'notte']) {
        interno.trameDiLuce.set(luce, { macchie: veli, selciato, increspature });
      }
      return d;
    };
    const stato = (zoom: number) => ({
      camera: { x: 0, y: 0, zoom },
      vista,
      densita: 1,
      visibili: tutti,
      evidenziata: null,
      puntoSopra: -1,
      landmarkSopra: -1,
      area: { minX: -600, minY: -600, maxX: 600, maxY: 600 },
    });
    const aMotivo = (p: Passo): boolean => veli.includes(p.stile as { v: number }) || p.stile === selciato || p.stile === increspature;

    const d = conTrame(200);
    for (const luce of ['giorno', 'notte', 'pomeriggio'] as const) {
      d.impostaLuce(luce);
      for (const zoom of [3, 6]) {
        const r = registratore();
        d.disegna(r.ctx, stato(zoom));
        // Il velo d'acquerello: un solo riempimento a tutto schermo, con la fusione normale.
        const passate = r.passi.filter((p) => veli.includes(p.stile as { v: number }));
        expect(passate).toHaveLength(1);
        expect(passate[0].nome).toBe('fillRect');
        expect(passate[0].fusione).toBe('source-over');
        expect(passate[0].alfa as number).toBeGreaterThan(0);
        expect(passate[0].alfa as number).toBeLessThanOrEqual(1);
        // Dopo il velo (nuvole, nomi, segnaposto) lo stato è quello di sempre: niente resta fuso
        // o trasparente per sbaglio, e le immagini tornano ammorbidite.
        const dopo = r.passi.slice(r.passi.indexOf(passate[0]) + 1);
        for (const p of dopo) {
          expect(p.fusione).toBe('source-over');
          expect(p.morbido).toBe(true);
          expect(aMotivo(p)).toBe(false);
        }
        expect(r.stato.globalAlpha).toBe(1);
        expect(r.stato.globalCompositeOperation).toBe('source-over');
        expect(r.stato.imageSmoothingEnabled).toBe(true);
        expect(r.conta.save ?? 0).toBe(r.conta.restore ?? 0);
        // Selciato e increspature si vedono, sempre con la fusione normale.
        expect(r.passi.some((p) => p.stile === selciato)).toBe(true);
        expect(r.passi.some((p) => p.stile === increspature)).toBe(true);
        for (const p of r.passi.filter(aMotivo)) expect(p.fusione).toBe('source-over');
      }
    }
    d.impostaLuce('giorno');
    // Senza tempo l'acqua sta ferma; con il tempo le increspature scorrono (un rettangolo
    // spostato dentro il ritaglio dell'acqua) e il Disegnatore dice che c'è movimento.
    {
      const ferma = registratore();
      d.disegna(ferma.ctx, stato(3));
      expect(d.animato).toBe(false);
      const viva = registratore();
      d.disegna(viva.ctx, { ...stato(3), tempo: 5000 });
      expect(d.animato).toBe(true);
      expect(viva.passi.some((p) => p.stile === increspature && p.nome === 'fillRect')).toBe(true);
      expect(viva.conta.save ?? 0).toBe(viva.conta.restore ?? 0);
      // Anche da lontano l'acqua scorre: i filoni grandi della corrente si vedono e si muovono.
      const lontano = registratore();
      d.disegna(lontano.ctx, { ...stato(1.2), tempo: 5000 });
      expect(d.animato).toBe(true);
      expect(lontano.passi.some((p) => p.stile === increspature && p.nome === 'fillRect')).toBe(true);
      expect(lontano.conta.save ?? 0).toBe(lontano.conta.restore ?? 0);
      // Lontano dall'acqua (e senza treno né piazze in vista) non c'è nulla da animare.
      d.disegna(registratore().ctx, { ...stato(3), camera: { x: 2000, y: -2000, zoom: 3 }, tempo: 5000 });
      expect(d.animato).toBe(false);
    }
    // Da lontano niente velo e niente lastre.
    const lontano = registratore();
    d.disegna(lontano.ctx, stato(1.2));
    // Da lontano niente selciato né increspature fini: solo una passata dei filoni della corrente.
    expect(lontano.passi.filter((p) => aMotivo(p) && p.stile !== increspature)).toHaveLength(0);
    expect(lontano.passi.filter((p) => p.stile === increspature)).toHaveLength(2);
    // Avvicinandosi il velo usa una tela più fine: da lontano la più ridotta, da vicino la prima.
    const quale = (zoom: number): unknown => {
      const r = registratore();
      d.disegna(r.ctx, stato(zoom));
      return r.passi.find((p) => veli.includes(p.stile as { v: number }))?.stile;
    };
    expect(quale(1.5)).toBe(veli[3]);
    expect(quale(12)).toBe(veli[0]);
    // I riempimenti a motivo non crescono con le case: con metà degli edifici sono gli stessi.
    const quanti = (disegnatore: Disegnatore): number => {
      const r = registratore();
      disegnatore.disegna(r.ctx, stato(4));
      return r.passi.filter(aMotivo).length;
    };
    const pochi = conTrame(60);
    expect(quanti(d)).toBeGreaterThan(0);
    expect(quanti(pochi)).toBe(quanti(d));
  });
});

describe('doppioni tra gli edifici (scripts/lib/doppioni.mjs)', () => {
  const quadrato = (x: number, y: number, lato: number): number[] => [x, y, x + lato, y, x + lato, y + lato, x, y + lato];

  it('toglie lo stesso edificio rilevato due volte e tiene quello con il nome', () => {
    const edifici = [
      { p: quadrato(0, 0, 20), h: 8, t: 'casa' },
      { p: quadrato(0.5, 0.3, 20), h: 11, t: 'industria', n: 'Officina' },
      { p: quadrato(100, 100, 20), h: 8, t: 'casa' },
    ];
    const r = togliDoppioni(edifici);
    expect(r.tolti).toBe(1);
    expect(r.edifici.map((e: { n?: string }) => e.n)).toEqual(['Officina', undefined]);
  });

  it('a parità di nome tiene il preferito, altrimenti il primo', () => {
    const edifici = [
      { p: quadrato(0, 0, 20), h: 8, t: 'casa' },
      { p: quadrato(0.5, 0.3, 20), h: 11, t: 'casa' },
    ];
    expect(togliDoppioni(edifici).edifici[0].h).toBe(8);
    expect(togliDoppioni(edifici, (i: number) => i === 1).edifici[0].h).toBe(11);
  });

  it('non tocca i volumi più piccoli dentro un edificio più grande, né i vicini', () => {
    const edifici = [
      { p: quadrato(0, 0, 40), h: 12, t: 'chiesa' },
      { p: quadrato(5, 5, 6), h: 30, t: 'torre' }, // il campanile
      { p: quadrato(40, 0, 40), h: 9, t: 'casa' }, // muro in comune
    ];
    expect(togliDoppioni(edifici).tolti).toBe(0);
  });
});

import { Tasselli, creaTasselli, presenzaTassello, tasselliAccesi } from '../src/map/tasselli';

describe('tasselli dipinti', () => {
  it('entrano sfumando dallo zoom indicato', () => {
    expect(presenzaTassello(3, 3.2)).toBe(0);
    expect(presenzaTassello(3.2, 3.2)).toBe(0);
    expect(presenzaTassello(3.55, 3.2)).toBeCloseTo(0.5, 5);
    expect(presenzaTassello(6, 3.2)).toBe(1);
  });
});

describe('interruttore dei tasselli', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('è spento se nessuno lo accende, e si accende solo con VITE_TASSELLI=1', () => {
    expect(tasselliAccesi({})).toBe(false);
    expect(tasselliAccesi(undefined)).toBe(false);
    expect(tasselliAccesi({ VITE_TASSELLI: '0' })).toBe(false);
    expect(tasselliAccesi({ VITE_TASSELLI: 'true' })).toBe(false);
    expect(tasselliAccesi({ VITE_TASSELLI: '1' })).toBe(true);
    // Così come si costruisce il sito oggi: spento.
    expect(tasselliAccesi()).toBe(false);
  });

  it('da spento non crea nulla e non chiede nulla alla rete', async () => {
    const finto = vi.fn(async () => ({ ok: false, status: 404 }));
    vi.stubGlobal('fetch', finto);
    expect(creaTasselli('./tasselli/', () => {})).toBeNull();
    expect(creaTasselli('./tasselli/', () => {}, false)).toBeNull();
    await Promise.resolve();
    expect(finto).not.toHaveBeenCalled();
  });

  it("da acceso chiede l'indice e, se manca, la mappa resta quella disegnata dal codice", async () => {
    const finto = vi.fn(async () => ({ ok: false, status: 404 }));
    vi.stubGlobal('fetch', finto);
    const tasselli = creaTasselli('./tasselli/', () => {}, true);
    expect(tasselli).toBeInstanceOf(Tasselli);
    await Promise.resolve();
    expect(finto).toHaveBeenCalledTimes(1);
    expect(finto).toHaveBeenCalledWith('./tasselli/indice.json');
    tasselli?.distruggi();
  });
});

describe('segnalini vicino alle nuvole e cartelli degli avvisi', () => {
  it('nasconde i segnalini dove le nuvole coprono le case', async () => {
    const { segnalinoInVista, fuoriDi, MARGINE_SEGNALINI } = await import('../src/map/nuvole');
    const { riquadroInMetri } = await import('../src/map/proiezione');
    const area = riquadroInMetri();
    // Il centro di Bassano si vede; gli angoli del riquadro stanno sotto le nuvole.
    expect(segnalinoInVista(area, 0, 0)).toBe(true);
    expect(segnalinoInVista(area, area.maxX, area.maxY)).toBe(false);
    expect(segnalinoInVista(area, area.minX, area.minY)).toBe(false);
    // Il confine è MARGINE_SEGNALINI metri prima del contorno delle nuvole.
    expect(fuoriDi(area, 0, 0)).toBeLessThan(-MARGINE_SEGNALINI);
  });

  it('il segnaposto del Monte Grappa, sul margine, non è più in vista', async () => {
    const { segnalinoInVista } = await import('../src/map/nuvole');
    const { riquadroInMetri } = await import('../src/map/proiezione');
    const strati = JSON.parse(readFileSync(new URL('../public/data/strati.json', import.meta.url), 'utf8'));
    const grappa = strati.punti.find((p: { storia?: string }) => p.storia === 'monte-grappa');
    expect(grappa).toBeDefined();
    expect(segnalinoInVista(riquadroInMetri(), grappa.x, grappa.y)).toBe(false);
  });

  it('preparaPunti tiene tutti i punti, dal più lontano al più vicino', async () => {
    const { preparaPunti } = await import('../src/map/scena');
    const p = (id: string, x: number, y: number) => ({ id, strato: 'mobilita' as const, tipo: 'avviso' as const, nome: id, x, y });
    const pronti = preparaPunti([p('vicino', -50, -50), p('lontano', 50, 50)], []);
    expect(pronti.map((q) => q.dati.id)).toEqual(['lontano', 'vicino']);
    expect(pronti.every((q) => q.landmark === -1)).toBe(true);
  });
});

describe('animazioni decorative: treno e corrente', () => {
  // Una linea da sud a nord che passa per la stazione, con un binario laterale attaccato a T.
  const binari = [
    { t: 'ferrovia' as const, p: [500, -2000, 520, -800, 537.5, 5] },
    { t: 'ferrovia' as const, p: [537.5, 5, 540, 900, 560, 2200] },
    { t: 'ferrovia' as const, p: [700, -400, 525, -400] }, // tocca la linea a metà tratto
    { t: 'principale' as const, p: [0, 0, 100, 0] },
  ];

  it('ricostruisce la linea attraverso la stazione, da sud a nord, spezzando i tratti a T', async () => {
    const { percorsoTreno, puntoLungo, reteBinari } = await import('../src/map/animazioni');
    const rete = reteBinari(binari);
    // Il binario laterale si attacca in mezzo al primo tratto: il nodo di mezzo ha tre vicini.
    expect(rete.some((n) => n.vicini.size === 3)).toBe(true);
    const p = percorsoTreno(binari)!;
    expect(p).not.toBeNull();
    expect(p.punti.slice(0, 2)).toEqual([500, -2000]);
    expect(p.punti.slice(-2)).toEqual([560, 2200]);
    const staz = puntoLungo(p, p.stazione);
    expect(Math.hypot(staz.x - 537.5, staz.y - 5)).toBeLessThan(1);
    expect(percorsoTreno([{ t: 'principale', p: [0, 0, 10, 0] }])).toBeNull();
  });

  it('il treno arriva, si ferma in stazione, riparte, e tra due corse non c\'è', async () => {
    const { percorsoTreno, momentoTreno, carrozze, istanteInSosta, CARROZZE } = await import('../src/map/animazioni');
    const p = percorsoTreno(binari)!;
    const sosta = momentoTreno(p, istanteInSosta(p));
    expect(sosta.fermo && !sosta.assente).toBe(true);
    expect(sosta.prossimoCambio).toBeGreaterThan(0);
    expect(carrozze(p, sosta)).toHaveLength(CARROZZE);
    // Il treno in sosta sta lungo la stazione.
    const [prima] = carrozze(p, sosta);
    expect(Math.hypot(prima.testa.x - 537.5, prima.testa.y - 5)).toBeLessThan(120);
    // Si muove senza salti: in 40 ms la testa fa al più un paio di metri.
    let ultima = momentoTreno(p, 0);
    let assente = false;
    for (let t = 40; t < 2_000_000; t += 40) {
      const m = momentoTreno(p, t);
      if (m.assente) assente = true;
      else if (!ultima.assente && m.verso === ultima.verso) expect(Math.abs(m.testa - ultima.testa)).toBeLessThan(2);
      ultima = m;
    }
    expect(assente).toBe(true);
  });

  it('a mappa ferma il treno sta sul binario aperto, prima della stazione', async () => {
    const { percorsoTreno, momentoTreno, istanteFermo } = await import('../src/map/animazioni');
    const p = percorsoTreno(binari)!;
    const m = momentoTreno(p, istanteFermo(p));
    expect(m.assente).toBe(false);
    expect(m.verso).toBe(1);
    expect(m.testa).toBeLessThan(p.stazione);
  });

  it('la corrente si ripete senza stacchi e va verso valle', async () => {
    const { spostamentoCorrente, PERIODO_CORRENTE_MS } = await import('../src/map/animazioni');
    expect(spostamentoCorrente(0)).toEqual({ dx: 0, dy: 0 });
    const meta = spostamentoCorrente(PERIODO_CORRENTE_MS / 2);
    expect(meta.dx).toBeCloseTo(18, 5);
    expect(meta.dy).toBeCloseTo(9, 5);
    const giro = spostamentoCorrente(PERIODO_CORRENTE_MS * 3 + 1);
    expect(giro.dx).toBeLessThan(0.01);
  });
});

describe('altre animazioni: linee, macchine, vie, fontana', () => {
  it('trova le due linee a sud che si uniscono in stazione, e i treni sono sfasati', async () => {
    const { percorsiTreni, treni } = await import('../src/map/animazioni');
    const binari = [
      { t: 'ferrovia' as const, p: [500, -2000, 520, -800, 537.5, 5] },
      { t: 'ferrovia' as const, p: [2000, -1500, 800, -600, 520, -800] },
      { t: 'ferrovia' as const, p: [537.5, 5, 540, 900, 560, 2200] },
    ];
    const linee = percorsiTreni(binari);
    expect(linee).toHaveLength(2);
    // Prima la linea più lunga.
    expect(linee.map((p) => p.punti.slice(0, 2))).toEqual([[2000, -1500], [500, -2000]]);
    expect(linee[0].lunghezza).toBeGreaterThanOrEqual(linee[1].lunghezza);
    for (const p of linee) expect(p.punti.slice(-2)).toEqual([560, 2200]);
    const t = treni(binari);
    expect(t).toHaveLength(3);
    expect(new Set(t.map((x) => x.fase)).size).toBe(3);
    expect(new Set(t.map((x) => x.livrea)).size).toBe(3);
  });

  it('le macchine tengono la destra, restano sulla loro strada e fanno una pausa', async () => {
    const { corsie, macchine, macchinaDi, SCARTO_MACCHINA, LUNGHEZZA_MACCHINA } = await import('../src/map/animazioni');
    const strade = [
      { t: 'principale' as const, p: [0, 0, 300, 0] },
      { t: 'pedonale' as const, p: [0, 10, 300, 10] },
      { t: 'locale' as const, p: [0, 20, 50, 20] }, // troppo corta
    ];
    const c = corsie(strade);
    expect(c).toHaveLength(1);
    const m = macchine(c);
    expect(m.length).toBe(Math.round(300 / 90));
    let viste = 0;
    let pausa = false;
    for (let t = 0; t < 120_000; t += 250) {
      for (const x of m) {
        const q = macchinaDi(x, c[0], t);
        if (!q) {
          pausa = true;
          continue;
        }
        viste++;
        // Verso est la destra è a sud (y negativa), verso ovest a nord.
        const ovest = q.testa.x < q.coda.x;
        expect(q.coda.y).toBeCloseTo(ovest ? SCARTO_MACCHINA.principale : -SCARTO_MACCHINA.principale, 5);
        // Sempre intera, anche quando entra o esce oltre i capi del tratto.
        expect(Math.hypot(q.testa.x - q.coda.x, q.testa.y - q.coda.y)).toBeCloseTo(LUNGHEZZA_MACCHINA, 5);
        expect(Math.min(q.coda.x, q.testa.x)).toBeGreaterThanOrEqual(-LUNGHEZZA_MACCHINA - 0.01);
        expect(Math.max(q.coda.x, q.testa.x)).toBeLessThanOrEqual(300 + LUNGHEZZA_MACCHINA + 0.01);
      }
    }
    expect(viste).toBeGreaterThan(0);
    expect(pausa).toBe(true);
    // Nello stesso verso non si raggiungono mai.
    for (let t = 0; t < 120_000; t += 250) {
      const pos = m.map((x) => ({ v: x.verso, q: macchinaDi(x, c[0], t) })).filter((p) => p.q);
      for (let a = 0; a < pos.length; a++) {
        for (let b = a + 1; b < pos.length; b++) {
          if (pos[a].v !== pos[b].v) continue;
          expect(Math.hypot(pos[a].q!.testa.x - pos[b].q!.testa.x, pos[a].q!.testa.y - pos[b].q!.testa.y)).toBeGreaterThan(LUNGHEZZA_MACCHINA);
        }
      }
    }
  });

  it('niente macchine nelle vie dove finirebbero dentro una casa', async () => {
    const { corsie } = await import('../src/map/animazioni');
    const casa = { p: [100, -3, 120, -3, 120, -0.5, 100, -0.5], h: 8, t: 'residenziale' as never };
    expect(corsie([{ t: 'principale', p: [0, 0, 300, 0] }], [casa])).toHaveLength(0);
    expect(corsie([{ t: 'principale', p: [0, 0, 300, 0] }], [{ ...casa, p: [100, -30, 120, -30, 120, -20, 100, -20] }])).toHaveLength(1);
  });

  it('nelle vie pedonali del centro c\'è gente, fuori dal centro no', async () => {
    const { passeggiateNelleVie } = await import('../src/map/animazioni');
    const vie = passeggiateNelleVie([
      { t: 'pedonale', p: [0, 0, 60, 0] },
      { t: 'pedonale', p: [2000, 0, 2060, 0] },
      { t: 'principale', p: [0, 30, 60, 30] },
    ]);
    expect(vie.length).toBeGreaterThan(0);
    for (const v of vie) {
      expect(Math.abs(v.ay)).toBeLessThan(1.3);
      expect(v.ax).toBeGreaterThanOrEqual(5);
      expect(v.bx).toBeLessThanOrEqual(55);
    }
  });

  it('attorno alla fontana c\'è chi sta fermo sul bordo e chi le gira intorno', async () => {
    const { genteAllaFontana, allaFontanaDi } = await import('../src/map/animazioni');
    const f = { x: 64, y: 47, raggio: 8.5 };
    const gente = genteAllaFontana([f]);
    expect(gente.some((g) => g.giro === 0)).toBe(true);
    expect(gente.some((g) => g.giro !== 0)).toBe(true);
    for (const g of gente) {
      const a = allaFontanaDi(g, f, 0);
      const b = allaFontanaDi(g, f, 10_000);
      expect(Math.hypot(a.x - f.x, a.y - f.y)).toBeCloseTo(g.raggio, 5);
      if (g.giro === 0) expect(b).toEqual(a);
      else expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(0.1);
    }
  });
});
