import { describe, expect, it } from 'vitest';
import { ORIGINE, RIQUADRO } from '../src/types';
import {
  angoliInIso,
  isoInMetri,
  isoInSchermo,
  limitaCamera,
  lonLatInMetri,
  metriInIso,
  metriInLonLat,
  metriInSchermo,
  profondita,
  riquadroInMetri,
  riquadroVisibile,
  schermoInMetri,
  spostamentoInMetri,
  zoomAttorno,
  zoomPerContenere,
} from '../src/map/proiezione';
import type { Camera, Vista } from '../src/map/proiezione';

const vista: Vista = { larghezza: 1200, altezza: 800 };

describe('gradi e metri locali', () => {
  it("l'origine cade in (0, 0)", () => {
    const m = lonLatInMetri(ORIGINE);
    expect(m.x).toBeCloseTo(0, 9);
    expect(m.y).toBeCloseTo(0, 9);
  });

  it('segue le formule della specifica', () => {
    const p = { lon: 11.7445, lat: 45.7765 };
    const m = lonLatInMetri(p);
    expect(m.x).toBeCloseTo(0.01 * 111320 * Math.cos((45.7665 * Math.PI) / 180), 6);
    expect(m.y).toBeCloseTo(0.01 * 110574, 6);
    // Un centesimo di grado: circa 777 m verso est e 1106 m verso nord.
    expect(m.x).toBeGreaterThan(770);
    expect(m.x).toBeLessThan(785);
    expect(m.y).toBeCloseTo(1105.74, 2);
  });

  it('est è x positivo, nord è y positivo', () => {
    expect(lonLatInMetri({ lon: ORIGINE.lon + 0.001, lat: ORIGINE.lat }).x).toBeGreaterThan(0);
    expect(lonLatInMetri({ lon: ORIGINE.lon, lat: ORIGINE.lat + 0.001 }).y).toBeGreaterThan(0);
    expect(lonLatInMetri({ lon: ORIGINE.lon - 0.001, lat: ORIGINE.lat - 0.001 }).x).toBeLessThan(0);
  });

  it('andata e ritorno gradi → metri → gradi', () => {
    for (const p of [
      { lon: RIQUADRO.ovest, lat: RIQUADRO.sud },
      { lon: RIQUADRO.est, lat: RIQUADRO.nord },
      { lon: 11.7313, lat: 45.7675 },
    ]) {
      const r = metriInLonLat(lonLatInMetri(p));
      expect(r.lon).toBeCloseTo(p.lon, 10);
      expect(r.lat).toBeCloseTo(p.lat, 10);
    }
  });

  it('il riquadro dei dati misura circa 5,3 per 6,2 chilometri', () => {
    const r = riquadroInMetri();
    expect(r.maxX - r.minX).toBeGreaterThan(5200);
    expect(r.maxX - r.minX).toBeLessThan(5400);
    expect(r.maxY - r.minY).toBeCloseTo(0.056 * 110574, 3);
    expect(r.minX).toBeLessThan(0);
    expect(r.maxY).toBeGreaterThan(0);
  });
});

describe('isometria', () => {
  it('punti noti', () => {
    expect(metriInIso(0, 0).sx).toBeCloseTo(0, 12);
    expect(metriInIso(0, 0).sy).toBeCloseTo(0, 12);
    // 100 m a est: in alto a destra.
    const est = metriInIso(100, 0);
    expect(est.sx).toBeCloseTo(70.71, 6);
    expect(est.sy).toBeCloseTo(-35.355, 6);
    // 100 m a nord: in alto a sinistra.
    const nord = metriInIso(0, 100);
    expect(nord.sx).toBeCloseTo(-70.71, 6);
    expect(nord.sy).toBeCloseTo(-35.355, 6);
    // 10 m di altezza: dritto verso l'alto.
    const alto = metriInIso(0, 0, 10);
    expect(alto.sx).toBeCloseTo(0, 9);
    expect(alto.sy).toBeCloseTo(-8.165, 6);
  });

  it('è una isometria 2:1: i lati del terreno hanno pendenza 1:2', () => {
    const a = metriInIso(0, 0);
    const b = metriInIso(50, 0);
    expect(Math.abs((b.sy - a.sy) / (b.sx - a.sx))).toBeCloseTo(0.5, 4);
  });

  it('un metro lungo la diagonale nord-ovest/sud-est vale una unità in orizzontale', () => {
    const d = Math.SQRT1_2;
    const p = metriInIso(d, -d);
    expect(p.sx).toBeCloseTo(1, 4);
    expect(p.sy).toBeCloseTo(0, 9);
  });

  it('andata e ritorno sul terreno', () => {
    for (const [x, y] of [
      [0, 0],
      [123.4, -567.8],
      [-2700, 3100],
      [2600, -3400],
    ]) {
      const s = metriInIso(x, y);
      const m = isoInMetri(s.sx, s.sy);
      expect(m.x).toBeCloseTo(x, 8);
      expect(m.y).toBeCloseTo(y, 8);
    }
  });

  it('ciò che è più a nord-est è più lontano e più in alto sullo schermo', () => {
    expect(profondita(100, 100)).toBeGreaterThan(profondita(0, 0));
    expect(metriInIso(100, 100).sy).toBeLessThan(metriInIso(0, 0).sy);
    expect(profondita(-50, 50)).toBe(profondita(0, 0));
  });
});

describe('camera', () => {
  const camera: Camera = { x: 150, y: -80, zoom: 1.75 };

  it('il centro della camera cade al centro della vista', () => {
    const p = metriInSchermo(camera.x, camera.y, 0, camera, vista);
    expect(p.px).toBeCloseTo(600, 9);
    expect(p.py).toBeCloseTo(400, 9);
  });

  it('lo zoom è in pixel per unità isometrica', () => {
    const a = isoInSchermo(0, 0, camera, vista);
    const b = isoInSchermo(10, 0, camera, vista);
    expect(b.px - a.px).toBeCloseTo(17.5, 9);
    expect(b.py - a.py).toBeCloseTo(0, 9);
  });

  it("l'altezza sposta solo in verticale", () => {
    const terra = metriInSchermo(200, 100, 0, camera, vista);
    const tetto = metriInSchermo(200, 100, 12, camera, vista);
    expect(tetto.px).toBeCloseTo(terra.px, 9);
    expect(terra.py - tetto.py).toBeCloseTo(12 * 0.8165 * 1.75, 9);
  });

  it('andata e ritorno schermo → terreno → schermo', () => {
    for (const [px, py] of [
      [0, 0],
      [1200, 800],
      [333, 777],
      [-50, 900],
    ]) {
      const m = schermoInMetri(px, py, camera, vista);
      const s = metriInSchermo(m.x, m.y, 0, camera, vista);
      expect(s.px).toBeCloseTo(px, 8);
      expect(s.py).toBeCloseTo(py, 8);
    }
  });

  it('andata e ritorno terreno → schermo → terreno', () => {
    const s = metriInSchermo(-420.5, 913.2, 0, camera, vista);
    const m = schermoInMetri(s.px, s.py, camera, vista);
    expect(m.x).toBeCloseTo(-420.5, 8);
    expect(m.y).toBeCloseTo(913.2, 8);
  });

  it('uno spostamento in pixel diventa uno spostamento in metri', () => {
    const a = schermoInMetri(100, 100, camera, vista);
    const b = schermoInMetri(160, 130, camera, vista);
    const d = spostamentoInMetri(60, 30, camera.zoom);
    expect(d.x).toBeCloseTo(b.x - a.x, 8);
    expect(d.y).toBeCloseTo(b.y - a.y, 8);
  });

  it('lo zoom attorno a un pixel lascia fermo il punto che gli sta sotto', () => {
    const prima = schermoInMetri(900, 250, camera, vista);
    const nuova = zoomAttorno(camera, vista, 900, 250, 4.2);
    expect(nuova.zoom).toBe(4.2);
    const dopo = schermoInMetri(900, 250, nuova, vista);
    expect(dopo.x).toBeCloseTo(prima.x, 8);
    expect(dopo.y).toBeCloseTo(prima.y, 8);
    // Attorno al centro la camera non si sposta.
    const ferma = zoomAttorno(camera, vista, 600, 400, 0.5);
    expect(ferma.x).toBeCloseTo(camera.x, 8);
    expect(ferma.y).toBeCloseTo(camera.y, 8);
  });

  it('il riquadro visibile corrisponde agli angoli della vista', () => {
    const r = riquadroVisibile(camera, vista);
    expect(r.maxX - r.minX).toBeCloseTo(1200 / 1.75, 8);
    expect(r.maxY - r.minY).toBeCloseTo(800 / 1.75, 8);
    const angolo = schermoInMetri(0, 0, camera, vista);
    const iso = metriInIso(angolo.x, angolo.y);
    expect(iso.sx).toBeCloseTo(r.minX, 8);
    expect(iso.sy).toBeCloseTo(r.minY, 8);
  });

  it('la camera resta dentro i dati e lo zoom tra i limiti', () => {
    const area = riquadroInMetri();
    const c = limitaCamera({ x: 99999, y: -99999, zoom: 50 }, area, 0.2, 8);
    expect(c.x).toBe(area.maxX);
    expect(c.y).toBe(area.minY);
    expect(c.zoom).toBe(8);
    expect(limitaCamera({ x: 0, y: 0, zoom: 0.01 }, area, 0.2, 8).zoom).toBe(0.2);
    expect(limitaCamera({ x: 10, y: 20, zoom: 1 }, area, 0.2, 8)).toEqual({ x: 10, y: 20, zoom: 1 });
  });

  it("allo zoom che contiene tutto, gli angoli dell'area stanno nella vista", () => {
    const area = riquadroInMetri();
    const zoom = zoomPerContenere(area, vista);
    const centro: Camera = {
      x: (area.minX + area.maxX) / 2,
      y: (area.minY + area.maxY) / 2,
      zoom,
    };
    for (const a of angoliInIso(area)) {
      const p = isoInSchermo(a.sx, a.sy, centro, vista);
      expect(p.px).toBeGreaterThanOrEqual(-1e-6);
      expect(p.px).toBeLessThanOrEqual(1200 + 1e-6);
      expect(p.py).toBeGreaterThanOrEqual(-1e-6);
      expect(p.py).toBeLessThanOrEqual(800 + 1e-6);
    }
  });
});

import { margineCamera } from '../src/map/proiezione';
import { fuoriDi, nuvoleInVista } from '../src/map/nuvole';

describe('bordo della mappa', () => {
  const area = { minX: -2000, minY: -3000, maxX: 2000, maxY: 3000 };
  const vista = { larghezza: 1200, altezza: 800 };

  it('con la vista il centro della camera resta dentro il contorno delle nuvole', () => {
    const m = margineCamera(area, 2, vista);
    expect(m).toBeGreaterThan(240);
    // Lungo un lato il limite è dritto.
    const lato = limitaCamera({ x: 99999, y: 0, zoom: 2 }, area, 0.2, 8, vista);
    expect(lato.x).toBeCloseTo(area.maxX - m, 6);
    expect(lato.y).toBe(0);
    // Nell'angolo è un arco: il centro resta più dentro che lungo i lati, e fuori dalle nuvole.
    const angolo = limitaCamera({ x: 99999, y: -99999, zoom: 2 }, area, 0.2, 8, vista);
    expect(angolo.x).toBeLessThan(area.maxX - m);
    expect(angolo.y).toBeGreaterThan(area.minY + m);
    expect(fuoriDi(area, angolo.x, angolo.y)).toBeLessThan(0);
    // Da vicino il margine si stringe; da lontano non supera il 45% del lato corto.
    expect(margineCamera(area, 8, vista)).toBeLessThan(m);
    expect(margineCamera(area, 0.01, vista)).toBeCloseTo(0.45 * 4000, 6);
    // Un punto ben dentro non viene toccato.
    expect(limitaCamera({ x: 10, y: 20, zoom: 2 }, area, 0.2, 8, vista)).toEqual({ x: 10, y: 20, zoom: 2 });
  });

  it('le nuvole stanno attorno alla città e oltre, sempre le stesse', () => {
    // Il centro è dentro, un punto ben oltre il riquadro è fuori, gli angoli sono arrotondati.
    expect(fuoriDi(area, 0, 0)).toBeLessThan(-1000);
    expect(fuoriDi(area, 3500, 0)).toBeGreaterThan(500);
    expect(fuoriDi(area, 1950, 2950)).toBeGreaterThan(fuoriDi(area, 1950, 0));
    const centro = { minX: -300, minY: -300, maxX: 300, maxY: 300 };
    expect(nuvoleInVista(area, centro, 2)).toEqual([]);
    const largo = { minX: -9000, minY: -6000, maxX: 9000, maxY: 6000 };
    const a = nuvoleInVista(area, largo, 0.1);
    expect(a.length).toBeGreaterThan(10);
    expect(a.length).toBeLessThan(4000);
    expect(nuvoleInVista(area, largo, 0.1)).toEqual(a);
    for (const n of a) expect(n.alfa > 0 && n.alfa <= 1).toBe(true);
  });
});
