import { describe, expect, it } from 'vitest';
import {
  colpisceMarcatore,
  dentroSprite,
  distanzaDaSegmento,
  marcatoriInVista,
  misureSegnaposto,
  puntoInPoligono,
  rettangoloSprite,
  trovaBersaglio,
  ZOOM_SEGNAPOSTO,
} from '../src/map/bersagli';
import type { Marcatore, Sprite } from '../src/map/bersagli';
import { formattaHash, hashDellaMappa, leggiHash } from '../src/map/indirizzo';
import { normalizzaSvg } from '../src/map/immagini';
import { PALETTE, sfuma } from '../src/map/palette';
import { isoInSchermo, metriInIso, riquadroVisibile } from '../src/map/proiezione';
import type { Camera, Vista } from '../src/map/proiezione';
import {
  antiorario,
  areaConSegno,
  classificaLati,
  costruisciScena,
  EL_ALBERO,
  EL_EDIFICIO,
  EL_LANDMARK,
  Griglia,
  livelloDettaglio,
  MURO_DESTRO,
  MURO_DIETRO,
  MURO_SINISTRO,
  nelRomboDi,
  ordinePerProfondita,
  preparaEdificio,
  preparaLandmark,
  profonditaImpronta,
  raggruppaInTessere,
  semeDi,
  soglieDettaglio,
} from '../src/map/scena';
import { creaCittaFinta } from './fixtures/citta-finta';

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
      generato: '',
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
    const scena = costruisciScena(base, { generato: '', fonti: [], punti: [], linee: [] }, []);
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
    expect(a.alt).toBeCloseTo(8.165, 6);
    expect(a.area).toBe(100);
    expect(a.colmo).toBe(0);
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
      generato: '',
      fonte: '',
      strade: [],
      aree: [],
      alberi: [],
      edifici: [{ p: [0, 0, 10, 0, 10, 10, 0, 10], h: 50, t: 'casa' as const }],
    };
    const s = costruisciScena(base, { generato: '', fonti: [], punti: [], linee: [] }, []);
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
    expect(costruzione).toBeLessThan(3000);
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
    // Da lontanissimo non scende sotto la larghezza minima.
    expect(rettangoloSprite(l, 1, 1.5, { x: 0, y: 0, zoom: 0.05 }, vista).larghezza).toBe(20);
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
