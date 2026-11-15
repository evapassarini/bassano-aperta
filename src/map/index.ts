// Motore della mappa isometrica: camera, interazione, indirizzo, disegno.
// L'interfaccia pubblica è quella di docs/SPEC.md.

import { ORIGINE } from '../types';
import type { DatiBase, DatiStrati, IdStrato, Landmark, LonLat, Luce, Punto } from '../types';
import { trovaBersaglio, ZOOM_NOMI } from './bersagli';
import type { Colpito } from './bersagli';
import { Disegnatore } from './disegno';
import { Illustrazioni } from './immagini';
import { formattaHash, hashDellaMappa, leggiHash } from './indirizzo';
import {
  limitaCamera,
  lonLatInMetri,
  riquadroInMetri,
  spostamentoInMetri,
  zoomAttorno,
  zoomPerContenere,
} from './proiezione';
import type { Camera, Vista } from './proiezione';
import { costruisciScena } from './scena';
import type { StratiVisibili } from './scena';

export interface OpzioniMappa {
  canvas: HTMLCanvasElement;
  base: DatiBase;
  strati: DatiStrati;
  landmark: Landmark[];
  alClic: (bersaglio: { storia?: string; punto?: Punto } | null) => void;
  /** Lampioni in metri locali [x0, y0, ...] (DatiLampioni.p). Senza, la notte è buia ma funziona. */
  lampioni?: number[];
}

export interface Mappa {
  mostraStrato(id: IdStrato, visibile: boolean): void;
  vaiA(lonlat: LonLat, zoom?: number): void;
  /** Avvicina (fattore > 1) o allontana (fattore < 1) attorno al centro della vista. */
  zooma(fattore: number): void;
  evidenzia(storia: string | null): void;
  /**
   * Cambia la luce della mappa. All'avvio vale 'giorno'; con la luce già attiva non fa nulla.
   * Sul canvas resta scritto l'attributo data-luce, per chi vuole intonare la pagina.
   */
  impostaLuce(luce: Luce): void;
  distruggi(): void;
}

/** Ponte Vecchio: serve solo per la vista iniziale, se manca tra i luoghi simbolo. */
const PONTE_VECCHIO: LonLat = { lon: 11.7313, lat: 45.7675 };
const ZOOM_MASSIMO = 8;
const DENSITA_MASSIMA = 2;
/** Quanto si può muovere il puntatore perché sia ancora un clic, in pixel. */
const SOGLIA_CLIC = { mouse: 4, tocco: 10 };
const DURATA_VOLO = 750;
const DURATA_ZOOM = 260;
/** Due clic o due tocchi nello stesso punto entro questo tempo avvicinano la mappa. */
const DOPPIO_CLIC = { millisecondi: 350, pixel: 30, fattore: 1.8 };
/** Passo dei tasti + e - e dei bottoni «Avvicina» e «Allontana». */
export const PASSO_ZOOM = 1.5;
/** Zoom a cui si arriva scegliendo un luogo dall'elenco: i nomi dei segnaposto si leggono. */
const ZOOM_ARRIVO = Math.max(2.4, ZOOM_NOMI + 0.2);
const ATTESA_HASH = 300;
/** Durata della dissolvenza tra una luce e l'altra, in millisecondi. */
const DURATA_DISSOLVENZA = 420;
const LUCI: Luce[] = ['giorno', 'pomeriggio', 'notte'];

/**
 * Solo in sviluppo: ?luce=notte (o pomeriggio, giorno) nell'indirizzo blocca la mappa su
 * quella luce, qualunque cosa chieda l'interfaccia. Serve per le prove e le schermate.
 */
function luceDiProva(): Luce | null {
  if (!import.meta.env?.DEV) return null;
  try {
    const voluta = new URLSearchParams(window.location.search).get('luce');
    return LUCI.find((l) => l === voluta) ?? null;
  } catch {
    return null;
  }
}

export function creaMappa(opzioni: OpzioniMappa): Mappa {
  const { canvas, alClic } = opzioni;
  const contesto = canvas.getContext('2d');
  if (!contesto) throw new Error('Il browser non permette di disegnare la mappa (canvas 2D assente).');
  const ctx: CanvasRenderingContext2D = contesto;

  const scena = costruisciScena(opzioni.base, opzioni.strati, opzioni.landmark, opzioni.lampioni);
  const area = riquadroInMetri();
  const cartella = (import.meta.env?.BASE_URL ?? '/') + 'landmarks/';
  let vivo = true;
  let daDisegnare = false;
  let fotogramma = 0;

  const richiedi = (): void => {
    daDisegnare = true;
    if (!fotogramma && vivo) fotogramma = requestAnimationFrame(passo);
  };

  const illustrazioni = new Illustrazioni(opzioni.landmark, cartella, richiedi);
  const disegnatore = new Disegnatore(scena, illustrazioni);

  const vista: Vista = { larghezza: 1, altezza: 1 };
  let densita = 1;
  let zoomMinimo = 0.1;
  let camera: Camera = { x: 0, y: 0, zoom: 1 };
  const visibili: StratiVisibili = { cultura: true, ambiente: false, mobilita: false };
  let evidenziata: string | null = null;
  let puntoSopra = -1;
  let landmarkSopra = -1;

  // --- accessibilità di base del canvas ---------------------------------------
  if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
  if (!canvas.hasAttribute('role')) canvas.setAttribute('role', 'application');
  if (!canvas.hasAttribute('aria-label')) {
    canvas.setAttribute(
      'aria-label',
      'Mappa isometrica di Bassano del Grappa. Trascina per spostarti; con la tastiera usa le frecce per muoverti, più e meno per lo zoom. I luoghi e i punti della mappa si aprono anche dal bottone Luoghi.',
    );
  }
  const azionePrecedente = canvas.style.touchAction;
  canvas.style.touchAction = 'none';

  // --- vista e camera ---------------------------------------------------------

  const zoomIniziale = (): number =>
    Math.min(2.4, Math.max(0.9, Math.min(vista.larghezza, vista.altezza * 1.6) / 750));

  const cameraIniziale = (): Camera => {
    const ponte = opzioni.landmark.find((l) => l.id === 'ponte-vecchio');
    const a = lonLatInMetri(ponte ? { lon: ponte.lon, lat: ponte.lat } : PONTE_VECCHIO);
    const b = lonLatInMetri(ORIGINE);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, zoom: zoomIniziale() };
  };

  const imposta = (nuova: Camera, scriviHash = true): void => {
    const c = limitaCamera(nuova, area, zoomMinimo, ZOOM_MASSIMO);
    if (c.x === camera.x && c.y === camera.y && c.zoom === camera.zoom) return;
    camera = c;
    // La vecchia immagine non combacia più con la mappa spostata: la dissolvenza finisce qui.
    chiudiDissolvenza();
    richiedi();
    if (scriviHash) pianificaHash();
  };

  const misura = (): boolean => {
    const r = canvas.getBoundingClientRect();
    const larghezza = Math.max(1, Math.round(r.width));
    const altezza = Math.max(1, Math.round(r.height));
    const d = Math.min(DENSITA_MASSIMA, Math.max(1, window.devicePixelRatio || 1));
    const cambiato =
      larghezza !== vista.larghezza || altezza !== vista.altezza || d !== densita;
    vista.larghezza = larghezza;
    vista.altezza = altezza;
    densita = d;
    const l = Math.round(larghezza * d);
    const a = Math.round(altezza * d);
    if (canvas.width !== l) canvas.width = l;
    if (canvas.height !== a) canvas.height = a;
    zoomMinimo = Math.min(1, Math.max(0.04, zoomPerContenere(area, vista) * 0.85));
    return cambiato;
  };

  // --- ciclo di disegno -------------------------------------------------------

  interface Volo {
    da: Camera;
    a: Camera;
    inizio: number;
    durata: number;
  }
  let volo: Volo | null = null;

  // Passaggio tra due luci: la vecchia immagine resta sopra la nuova e svanisce.
  let telaDissolvenza: HTMLCanvasElement | null = null;
  let dissolvenza: { inizio: number } | null = null;
  let disegnata = false;

  function chiudiDissolvenza(): void {
    if (!dissolvenza) return;
    dissolvenza = null;
    // Si libera la memoria dell'immagine, la tela si riusa al prossimo cambio.
    if (telaDissolvenza) telaDissolvenza.width = telaDissolvenza.height = 0;
  }

  function avviaDissolvenza(): void {
    chiudiDissolvenza();
    if (!disegnata || volo || menoMovimento?.matches || canvas.width <= 1) return;
    try {
      const tela = telaDissolvenza ?? document.createElement('canvas');
      tela.width = canvas.width;
      tela.height = canvas.height;
      const c = tela.getContext('2d');
      if (!c) return;
      c.drawImage(canvas, 0, 0);
      telaDissolvenza = tela;
      dissolvenza = { inizio: performance.now() };
    } catch {
      dissolvenza = null;
    }
  }

  function passo(ora: number): void {
    fotogramma = 0;
    if (!vivo) return;
    if (volo) {
      const t = Math.min(1, (ora - volo.inizio) / volo.durata);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      // Lo zoom si interpola in scala logaritmica: il movimento sembra uniforme.
      const zoom = Math.exp(
        Math.log(volo.da.zoom) + (Math.log(volo.a.zoom) - Math.log(volo.da.zoom)) * e,
      );
      camera = limitaCamera(
        {
          x: volo.da.x + (volo.a.x - volo.da.x) * e,
          y: volo.da.y + (volo.a.y - volo.da.y) * e,
          zoom,
        },
        area,
        zoomMinimo,
        ZOOM_MASSIMO,
      );
      daDisegnare = true;
      if (t >= 1) {
        volo = null;
        pianificaHash();
      } else {
        fotogramma = requestAnimationFrame(passo);
      }
    }
    if (dissolvenza && volo) chiudiDissolvenza();
    if (dissolvenza) daDisegnare = true;
    if (!daDisegnare) return;
    daDisegnare = false;
    disegnata = true;
    disegnatore.disegna(ctx, {
      camera,
      vista,
      densita,
      visibili,
      evidenziata,
      puntoSopra,
      landmarkSopra,
      area,
    });
    if (dissolvenza && telaDissolvenza) {
      const t = (ora - dissolvenza.inizio) / DURATA_DISSOLVENZA;
      if (t >= 1 || telaDissolvenza.width !== canvas.width || telaDissolvenza.height !== canvas.height) {
        chiudiDissolvenza();
      } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1 - Math.max(0, t);
        ctx.drawImage(telaDissolvenza, 0, 0);
        ctx.globalAlpha = 1;
        if (!fotogramma) fotogramma = requestAnimationFrame(passo);
      }
    }
  }

  // --- indirizzo --------------------------------------------------------------

  let timerHash = 0;

  function pianificaHash(): void {
    window.clearTimeout(timerHash);
    timerHash = window.setTimeout(scriviHash, ATTESA_HASH);
  }

  function scriviHash(): void {
    if (!vivo || volo || puntatori.size > 0) {
      if (vivo && (volo || puntatori.size > 0)) pianificaHash();
      return;
    }
    const attuale = window.location.hash;
    // Se l'hash è usato da un'altra parte del sito, non lo si tocca.
    if (!hashDellaMappa(attuale)) return;
    const resto = leggiHash(attuale)?.resto ?? '';
    const nuovo = formattaHash(camera, resto);
    if (nuovo === attuale) return;
    try {
      history.replaceState(history.state, '', nuovo);
    } catch {
      // In alcune cornici (per esempio un'anteprima isolata) non è permesso: pazienza.
    }
  }

  const alCambioHash = (): void => {
    // Si confronta con la camera, non con l'ultimo hash scritto: tornando indietro nella
    // cronologia l'indirizzo può essere quello di prima mentre la mappa è altrove.
    const attuale = window.location.hash;
    const letto = leggiHash(attuale);
    if (!letto || formattaHash(camera, letto.resto) === attuale) return;
    volo = null;
    imposta(letto.camera, false);
  };

  // --- che cosa c'è sotto il puntatore ----------------------------------------

  const sotto = (x: number, y: number, tolleranza: number): Colpito | null => {
    // Con il dito si concede una casella di tolleranza, con il mouse vale il punto esatto.
    const intorno = tolleranza > 5 ? 1 : 0;
    return trovaBersaglio(
      x,
      y,
      disegnatore.marcatori(visibili, camera, vista),
      disegnatore.spriteInVista(camera, vista),
      tolleranza,
      (indice, u, v) => illustrazioni.opaco(indice, u, v, intorno),
      (indice) => disegnatore.copertaDaEdifici(indice, x, y, camera, vista),
    );
  };

  const posizione = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const aggiornaSopra = (colpito: Colpito | null): void => {
    const p = colpito?.genere === 'punto' ? colpito.indice : -1;
    const l = colpito?.genere === 'landmark' ? colpito.indice : -1;
    if (p !== puntoSopra || l !== landmarkSopra) {
      puntoSopra = p;
      landmarkSopra = l;
      richiedi();
    }
    canvas.style.cursor = colpito ? 'pointer' : trascinando ? 'grabbing' : 'grab';
  };

  // --- puntatori: trascinare, pizzicare, cliccare -----------------------------

  const puntatori = new Map<number, { x: number; y: number }>();
  let trascinando = false;
  /** Gesto in corso: da dove è partito e se è ancora un possibile clic. */
  let gesto: { x: number; y: number; clic: boolean; tocco: boolean } | null = null;
  let pizzico: { distanza: number; cx: number; cy: number } | null = null;
  /** Ultimo clic caduto nel vuoto: serve a riconoscere il doppio clic e il doppio tocco. */
  let clicNelVuoto: { x: number; y: number; quando: number } | null = null;

  const misuraPizzico = (): { distanza: number; cx: number; cy: number } => {
    const [a, b] = [...puntatori.values()];
    return {
      distanza: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
    };
  };

  const giu = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = posizione(e);
    puntatori.set(e.pointerId, p);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Non tutti i puntatori si possono catturare.
    }
    volo = null;
    if (puntatori.size === 1) {
      gesto = { x: p.x, y: p.y, clic: true, tocco: e.pointerType !== 'mouse' };
      pizzico = null;
    } else {
      if (gesto) gesto.clic = false;
      pizzico = puntatori.size === 2 ? misuraPizzico() : null;
    }
  };

  const muovi = (e: PointerEvent): void => {
    const p = posizione(e);
    const prima = puntatori.get(e.pointerId);
    if (!prima) {
      // Nessun tasto premuto: si guarda solo che cosa c'è sotto il cursore.
      if (e.pointerType === 'mouse') aggiornaSopra(sotto(p.x, p.y, 2));
      return;
    }
    puntatori.set(e.pointerId, p);
    if (puntatori.size === 1 && gesto) {
      if (gesto.clic) {
        const soglia = gesto.tocco ? SOGLIA_CLIC.tocco : SOGLIA_CLIC.mouse;
        if (Math.hypot(p.x - gesto.x, p.y - gesto.y) <= soglia) return;
        gesto.clic = false;
        trascinando = true;
        canvas.style.cursor = 'grabbing';
        if (puntoSopra !== -1 || landmarkSopra !== -1) {
          puntoSopra = -1;
          landmarkSopra = -1;
        }
      }
      const d = spostamentoInMetri(p.x - prima.x, p.y - prima.y, camera.zoom);
      imposta({ x: camera.x - d.x, y: camera.y - d.y, zoom: camera.zoom });
    } else if (puntatori.size === 2 && pizzico) {
      const ora = misuraPizzico();
      // Prima si sposta seguendo il centro delle dita, poi si scala attorno a esso.
      const d = spostamentoInMetri(ora.cx - pizzico.cx, ora.cy - pizzico.cy, camera.zoom);
      const spostata = { x: camera.x - d.x, y: camera.y - d.y, zoom: camera.zoom };
      const zoom = Math.min(
        ZOOM_MASSIMO,
        Math.max(zoomMinimo, camera.zoom * (ora.distanza / pizzico.distanza)),
      );
      imposta(zoomAttorno(spostata, vista, ora.cx, ora.cy, zoom));
      pizzico = ora;
    }
  };

  const su = (e: PointerEvent): void => {
    if (!puntatori.has(e.pointerId)) return;
    const p = posizione(e);
    puntatori.delete(e.pointerId);
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // Già rilasciato.
    }
    if (puntatori.size === 1) {
      // Finito il pizzico: il dito rimasto riprende a trascinare, senza diventare un clic.
      pizzico = null;
      return;
    }
    if (puntatori.size > 1) {
      pizzico = puntatori.size === 2 ? misuraPizzico() : null;
      return;
    }
    const eraClic = gesto?.clic === true && e.type === 'pointerup';
    const tocco = gesto?.tocco === true;
    gesto = null;
    pizzico = null;
    trascinando = false;
    if (eraClic) {
      const colpito = sotto(p.x, p.y, tocco ? 10 : 3);
      if (!colpito) {
        const adesso = performance.now();
        const prima = clicNelVuoto;
        if (
          prima &&
          adesso - prima.quando <= DOPPIO_CLIC.millisecondi &&
          Math.hypot(p.x - prima.x, p.y - prima.y) <= DOPPIO_CLIC.pixel
        ) {
          // Doppio clic o doppio tocco: ci si avvicina a quel punto, con un dito solo.
          clicNelVuoto = null;
          const zoom = Math.min(ZOOM_MASSIMO, camera.zoom * DOPPIO_CLIC.fattore);
          vola(zoomAttorno(camera, vista, p.x, p.y, zoom), DURATA_ZOOM);
        } else {
          clicNelVuoto = { x: p.x, y: p.y, quando: adesso };
          alClic(null);
        }
      } else if (colpito.genere === 'landmark') {
        alClic({ storia: scena.landmark[colpito.indice].dati.storia });
      } else {
        const punto = scena.punti[colpito.indice].dati;
        alClic(punto.storia !== undefined ? { storia: punto.storia } : { punto });
      }
    }
    if (e.pointerType === 'mouse') aggiornaSopra(sotto(p.x, p.y, 2));
    else canvas.style.cursor = 'grab';
    pianificaHash();
  };

  const esce = (): void => {
    if (puntatori.size === 0) aggiornaSopra(null);
  };

  // --- rotella ----------------------------------------------------------------

  const rotella = (e: WheelEvent): void => {
    e.preventDefault();
    volo = null;
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 32;
    else if (e.deltaMode === 2) delta *= vista.altezza;
    // Con ctrl premuto è il pizzico del trackpad: passi piccoli, più sensibili.
    const forza = e.ctrlKey ? 0.012 : 0.0016;
    const fattore = Math.exp(-Math.max(-240, Math.min(240, delta)) * forza);
    const p = posizione(e);
    const zoom = Math.min(ZOOM_MASSIMO, Math.max(zoomMinimo, camera.zoom * fattore));
    imposta(zoomAttorno(camera, vista, p.x, p.y, zoom));
  };

  // --- tastiera ---------------------------------------------------------------

  const menoMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;

  function vola(a: Camera, durata = DURATA_VOLO): void {
    const meta = limitaCamera(a, area, zoomMinimo, ZOOM_MASSIMO);
    if (menoMovimento?.matches) {
      volo = null;
      imposta(meta);
      return;
    }
    volo = { da: camera, a: meta, inizio: performance.now(), durata };
    richiedi();
  }

  /** Zoom attorno al centro della vista; se è già in corso un volo, parte dalla sua meta. */
  const zooma = (fattore: number): void => {
    if (!(fattore > 0) || !Number.isFinite(fattore)) return;
    const da = volo ? volo.a : camera;
    const zoom = Math.min(ZOOM_MASSIMO, Math.max(zoomMinimo, da.zoom * fattore));
    vola(zoomAttorno(da, vista, vista.larghezza / 2, vista.altezza / 2, zoom), DURATA_ZOOM);
  };

  const tasto = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const passoPx = e.shiftKey ? 240 : 80;
    let dx = 0;
    let dy = 0;
    switch (e.key) {
      case 'ArrowLeft':
        dx = -passoPx;
        break;
      case 'ArrowRight':
        dx = passoPx;
        break;
      case 'ArrowUp':
        dy = -passoPx;
        break;
      case 'ArrowDown':
        dy = passoPx;
        break;
      case '+':
      case '=':
        e.preventDefault();
        zooma(PASSO_ZOOM);
        return;
      case '-':
      case '_':
        e.preventDefault();
        zooma(1 / PASSO_ZOOM);
        return;
      case 'Home':
        e.preventDefault();
        vola(cameraIniziale());
        return;
      default:
        return;
    }
    e.preventDefault();
    volo = null;
    const d = spostamentoInMetri(dx, dy, camera.zoom);
    imposta({ x: camera.x + d.x, y: camera.y + d.y, zoom: camera.zoom });
  };

  // --- avvio ------------------------------------------------------------------

  const bloccata = luceDiProva();
  if (bloccata) disegnatore.impostaLuce(bloccata);
  canvas.dataset.luce = disegnatore.luce;

  misura();
  const daHash = leggiHash(window.location.hash);
  camera = limitaCamera(daHash ? daHash.camera : cameraIniziale(), area, zoomMinimo, ZOOM_MASSIMO);
  /** Finché il canvas non ha una misura vera, la vista iniziale va ricalcolata. */
  let inAttesaDiMisura = !daHash && (vista.larghezza <= 1 || vista.altezza <= 1);

  const alRidimensionamento = (): void => {
    if (!vivo) return;
    const cambiato = misura();
    if (inAttesaDiMisura && vista.larghezza > 1 && vista.altezza > 1) {
      inAttesaDiMisura = false;
      camera = limitaCamera(cameraIniziale(), area, zoomMinimo, ZOOM_MASSIMO);
    } else {
      camera = limitaCamera(camera, area, zoomMinimo, ZOOM_MASSIMO);
    }
    if (cambiato) richiedi();
  };
  const osservatore =
    typeof ResizeObserver !== 'undefined' ? new ResizeObserver(alRidimensionamento) : null;
  osservatore?.observe(canvas);
  window.addEventListener('resize', alRidimensionamento);

  // Quando i caratteri sono pronti le etichette vanno ridisegnate con quelli giusti.
  void document.fonts?.ready.then(() => richiedi());

  canvas.addEventListener('pointerdown', giu);
  canvas.addEventListener('pointermove', muovi);
  canvas.addEventListener('pointerup', su);
  canvas.addEventListener('pointercancel', su);
  canvas.addEventListener('pointerleave', esce);
  canvas.addEventListener('wheel', rotella, { passive: false });
  canvas.addEventListener('keydown', tasto);
  window.addEventListener('hashchange', alCambioHash);
  canvas.style.cursor = 'grab';
  richiedi();

  return {
    mostraStrato(id, visibile) {
      if (!(id in visibili) || visibili[id] === visibile) return;
      visibili[id] = visibile;
      puntoSopra = -1;
      richiedi();
    },
    vaiA(lonlat, zoom) {
      const m = lonLatInMetri(lonlat);
      // Senza zoom indicato ci si avvicina almeno quanto basta per riconoscere il luogo.
      // (e per leggere i nomi dei segnaposto, che compaiono da ZOOM_NOMI in su).
      vola({ x: m.x, y: m.y, zoom: zoom ?? Math.max(camera.zoom, ZOOM_ARRIVO) });
    },
    zooma,
    evidenzia(storia) {
      if (storia === evidenziata) return;
      evidenziata = storia;
      richiedi();
    },
    impostaLuce(luce) {
      if (!vivo || bloccata || luce === disegnatore.luce || !LUCI.includes(luce)) return;
      avviaDissolvenza();
      if (!disegnatore.impostaLuce(luce)) {
        chiudiDissolvenza();
        return;
      }
      canvas.dataset.luce = luce;
      richiedi();
    },
    distruggi() {
      if (!vivo) return;
      vivo = false;
      chiudiDissolvenza();
      telaDissolvenza = null;
      delete canvas.dataset.luce;
      if (fotogramma) cancelAnimationFrame(fotogramma);
      fotogramma = 0;
      window.clearTimeout(timerHash);
      osservatore?.disconnect();
      window.removeEventListener('resize', alRidimensionamento);
      window.removeEventListener('hashchange', alCambioHash);
      canvas.removeEventListener('pointerdown', giu);
      canvas.removeEventListener('pointermove', muovi);
      canvas.removeEventListener('pointerup', su);
      canvas.removeEventListener('pointercancel', su);
      canvas.removeEventListener('pointerleave', esce);
      canvas.removeEventListener('wheel', rotella);
      canvas.removeEventListener('keydown', tasto);
      canvas.style.touchAction = azionePrecedente;
      canvas.style.cursor = '';
      puntatori.clear();
      illustrazioni.distruggi();
    },
  };
}
