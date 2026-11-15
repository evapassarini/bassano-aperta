// Disegno della mappa su canvas 2D. Ordine: carta, aree, strade, linee tematiche,
// poi tutto ciò che sta in piedi dal più lontano al più vicino, infine i segnaposto.

import type { IdStrato, Luce, TipoArea, TipoStrada } from '../types';
import {
  marcatoriInVista,
  puntoSuEdificio,
  rettangoloSprite,
  SPRITE_SOGLIA,
  ZOOM_NOMI,
} from './bersagli';
import type { Marcatore, Sprite } from './bersagli';
import type { Illustrazioni } from './immagini';
import { conAlfa, PALETTE, PALETTE_PER_LUCE, sfuma } from './palette';
import type { Palette } from './palette';
import { angoliInIso, isoInSchermo, metriInIso, riquadroVisibile } from './proiezione';
import type { Camera, Rettangolo, Vista } from './proiezione';
import {
  ALTEZZA_LAMPIONE,
  EL_ALBERO,
  EL_EDIFICIO,
  EL_LAMPIONE,
  EL_LANDMARK,
  LATO_TESSERA,
  livelloDettaglio,
  MURO_DESTRO,
  MURO_DIETRO,
  MURO_SINISTRO,
  raggruppaInTessere,
  siToccano,
} from './scena';
import type { EdificioPronto, PuntoPronto, Scena, StratiVisibili } from './scena';

export interface StatoDisegno {
  camera: Camera;
  vista: Vista;
  /** Pixel reali per pixel CSS. */
  densita: number;
  visibili: StratiVisibili;
  /** Storia da evidenziare, oppure null. */
  evidenziata: string | null;
  /** Indice (in Scena.punti) del segnaposto sotto il cursore, oppure -1. */
  puntoSopra: number;
  /** Indice (in Scena.landmark) dell'illustrazione sotto il cursore, oppure -1. */
  landmarkSopra: number;
  /** Area dei dati in metri locali: fuori da qui la carta sfuma. */
  area: Rettangolo;
}

interface Pezzo extends Rettangolo {
  percorso: Path2D;
}

const AREE_SOTTO: TipoArea[] = ['coltivo', 'prato', 'parco', 'bosco'];
const ORDINE_STRADE: Exclude<TipoStrada, 'ferrovia'>[] = [
  'pedonale',
  'locale',
  'secondaria',
  'principale',
];
/** Larghezza in metri e larghezza minima in pixel per tipo di strada. */
const LARGHEZZE: Record<Exclude<TipoStrada, 'ferrovia'>, { metri: number; minimo: number; da: number }> = {
  principale: { metri: 8, minimo: 1.5, da: 0 },
  secondaria: { metri: 6, minimo: 1.1, da: 0 },
  locale: { metri: 4.2, minimo: 0.7, da: 0.22 },
  pedonale: { metri: 2.2, minimo: 0.6, da: 0.55 },
};

/** Raggio in metri della luce che un lampione stende a terra. */
const RAGGIO_ALONE = 16;
/** Da questo zoom in su i lampioni si disegnano con il palo; sotto, di notte, restano gli aloni. */
export const ZOOM_PALI = { giorno: 3, notte: 1.7 };
/** Da questo zoom in su, di notte, si vedono le finestre accese. */
const ZOOM_FINESTRE = 1.5;
/**
 * Da lontano non si accendono tutti i lampioni: sotto ZOOM_ALONI.pochi la metà, da
 * ZOOM_ALONI.tutti in su tutti, in mezzo la quota cresce un poco alla volta. Dipende solo
 * dallo zoom: trascinando la mappa restano accese le stesse luci.
 */
export const ZOOM_ALONI = { pochi: 0.2, tutti: 0.5 };
/** Tetto di sicurezza agli aloni disegnati in un fotogramma (schermi molto grandi). */
const ALONI_MASSIMI = 7000;

/** Quota di lampioni accesi a terra a un certo zoom, tra 0.5 e 1. */
export function quotaAloni(zoom: number): number {
  const t = (zoom - ZOOM_ALONI.pochi) / (ZOOM_ALONI.tutti - ZOOM_ALONI.pochi);
  return 0.5 + 0.5 * Math.max(0, Math.min(1, t));
}

/**
 * I lampioni che stendono luce a terra in questa vista. Restituisce i loro numeri (validi fino
 * alla prossima ricerca nella griglia dei lampioni), quanti sono e la quota usata. Un lampione
 * è acceso se il suo rango sta sotto la quota: la scelta è la stessa per ogni vista.
 */
export function aloniInVista(
  scena: Scena,
  camera: Camera,
  vista: Vista,
): { indici: Int32Array; quanti: number; quota: number; raggio: number } {
  const z = camera.zoom;
  // Da lontano l'alone non scende sotto qualche pixel: la città resta punteggiata di luci.
  const raggio = Math.max(RAGGIO_ALONE, 2.6 / z);
  const zona = riquadroVisibile(camera, vista, raggio + 4 / z);
  const trovati = scena.grigliaLampioni.interroga(zona);
  let quota = quotaAloni(z);
  if (trovati.length * quota > ALONI_MASSIMI) quota = ALONI_MASSIMI / trovati.length;
  if (quota >= 1) return { indici: trovati, quanti: trovati.length, quota: 1, raggio };
  const rango = scena.rangoLampioni;
  let quanti = 0;
  for (let j = 0; j < trovati.length; j++) {
    const i = trovati[j];
    if (rango[i] < quota) trovati[quanti++] = i;
  }
  return { indici: trovati, quanti, quota, raggio };
}
const LATO_SPRITE = 96;

/**
 * L'alone di una luce disegnato una volta sola: un disco che sfuma verso il bordo.
 * null dove non c'è un documento (nelle prove) o il canvas non è disponibile.
 */
function creaAlone(colore: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  try {
    const tela = document.createElement('canvas');
    tela.width = LATO_SPRITE;
    tela.height = LATO_SPRITE;
    const ctx = tela.getContext('2d');
    if (!ctx) return null;
    const m = LATO_SPRITE / 2;
    const g = ctx.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, conAlfa(colore, 1));
    g.addColorStop(0.18, conAlfa(colore, 0.72));
    g.addColorStop(0.45, conAlfa(colore, 0.3));
    g.addColorStop(0.75, conAlfa(colore, 0.08));
    g.addColorStop(1, conAlfa(colore, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LATO_SPRITE, LATO_SPRITE);
    return tela;
  } catch {
    return null;
  }
}

const CARATTERE = '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif';

function tracciaAnello(percorso: Path2D | CanvasRenderingContext2D, a: Float32Array, su = 0): void {
  if (a.length < 4) return;
  percorso.moveTo(a[0], a[1] - su);
  for (let i = 2; i < a.length; i += 2) percorso.lineTo(a[i], a[i + 1] - su);
  percorso.closePath();
}

function tracciaLinea(percorso: Path2D, a: Float32Array): void {
  if (a.length < 4) return;
  percorso.moveTo(a[0], a[1]);
  for (let i = 2; i < a.length; i += 2) percorso.lineTo(a[i], a[i + 1]);
}

export class Disegnatore {
  private readonly scena: Scena;
  private readonly illustrazioni: Illustrazioni;

  private readonly acqua: Pezzo | null;
  private readonly aree = new Map<TipoArea, Pezzo[]>();
  private readonly strade = new Map<string, Pezzo[]>();
  private readonly linee: { strato: IdStrato; tipo: 'ciclabile' | 'ferrovia'; percorso: Path2D }[] = [];

  /** Tessere di edifici per la vista da lontano. */
  private readonly tessereEdifici: (Rettangolo & { indici: number[] })[];
  private pezziPiatti: (Path2D | null)[] = [];
  private pezziTetti: (Map<number, Path2D> | null)[] = [];
  /** Quante illustrazioni erano pronte quando sono stati costruiti i pezzi. */
  private pronteNeiPezzi = -1;

  /** Colori per edificio, decisi una volta. */
  private tinteTetto: string[] = [];
  private tinteMuro: { chiaro: string; scuro: string }[] = [];
  private readonly iTetto: Uint8Array;
  private readonly iMuro: Uint8Array;
  private chiome: { base: string; luce: string }[] = [];

  /** Tavolozza della luce attiva. */
  private P: Palette = PALETTE;
  private luceAttiva: Luce = 'giorno';
  /** Alone dei lampioni già disegnato, e il colore con cui è stato fatto. */
  private sprite: HTMLCanvasElement | null = null;
  private coloreSprite = '';

  private readonly larghezzeTesto = new Map<string, number>();
  /** Indici dei luoghi simbolo nell'ordine di disegno (dal più lontano). */
  private readonly ordineLandmark: number[] = [];
  /** Per ogni luogo simbolo, la sua posizione tra gli elementi in piedi. */
  private readonly postoLandmark: number[] = [];

  constructor(scena: Scena, illustrazioni: Illustrazioni) {
    this.scena = scena;
    this.illustrazioni = illustrazioni;
    const el = scena.elementi;
    for (let i = 0; i < el.n; i++) {
      if (el.tipo[i] === EL_LANDMARK) {
        this.ordineLandmark.push(el.rif[i]);
        this.postoLandmark[el.rif[i]] = i;
      }
    }

    // --- aree
    const acqua = new Path2D();
    let rAcqua: Rettangolo | null = null;
    const perTipo = new Map<TipoArea, number[]>();
    scena.aree.forEach((a, i) => {
      if (a.tipo === 'acqua') {
        tracciaAnello(acqua, a.anello);
        const k = i * 4;
        const q = scena.riquadriAree;
        rAcqua = rAcqua
          ? {
              minX: Math.min(rAcqua.minX, q[k]),
              minY: Math.min(rAcqua.minY, q[k + 1]),
              maxX: Math.max(rAcqua.maxX, q[k + 2]),
              maxY: Math.max(rAcqua.maxY, q[k + 3]),
            }
          : { minX: q[k], minY: q[k + 1], maxX: q[k + 2], maxY: q[k + 3] };
        return;
      }
      const elenco = perTipo.get(a.tipo) ?? [];
      elenco.push(i);
      perTipo.set(a.tipo, elenco);
    });
    this.acqua = rAcqua ? { ...(rAcqua as Rettangolo), percorso: acqua } : null;
    for (const [tipo, indici] of perTipo) {
      const pezzi: Pezzo[] = [];
      for (const t of raggruppaInTessere(scena.riquadriAree, indici, LATO_TESSERA * 2)) {
        const percorso = new Path2D();
        for (const i of t.indici) tracciaAnello(percorso, scena.aree[i].anello);
        pezzi.push({ minX: t.minX, minY: t.minY, maxX: t.maxX, maxY: t.maxY, percorso });
      }
      this.aree.set(tipo, pezzi);
    }

    // --- strade
    const perStrada = new Map<string, number[]>();
    scena.strade.forEach((s, i) => {
      const chiave = s.tipo + (s.ponte ? '+ponte' : '');
      const elenco = perStrada.get(chiave) ?? [];
      elenco.push(i);
      perStrada.set(chiave, elenco);
    });
    for (const [chiave, indici] of perStrada) {
      const pezzi: Pezzo[] = [];
      for (const t of raggruppaInTessere(scena.riquadriStrade, indici, LATO_TESSERA * 2)) {
        const percorso = new Path2D();
        for (const i of t.indici) tracciaLinea(percorso, scena.strade[i].linea);
        pezzi.push({ minX: t.minX, minY: t.minY, maxX: t.maxX, maxY: t.maxY, percorso });
      }
      this.strade.set(chiave, pezzi);
    }

    // --- linee tematiche
    const perLinea = new Map<string, Path2D>();
    for (const l of scena.linee) {
      const chiave = l.dati.strato + '|' + l.dati.tipo;
      let percorso = perLinea.get(chiave);
      if (!percorso) {
        percorso = new Path2D();
        perLinea.set(chiave, percorso);
        this.linee.push({ strato: l.dati.strato, tipo: l.dati.tipo, percorso });
      }
      tracciaLinea(percorso, l.linea);
    }

    // --- colori degli edifici: gli indici si decidono una volta, le tinte a ogni cambio di luce
    const P = PALETTE;
    const tCotto = 0;
    const tIndustria = P.tetti.length;
    const mIntonaci = 0;
    const mIndustria = mIntonaci + P.intonaci.length;
    const mPietra = mIndustria + P.intonacoIndustria.length;
    const mMattone = mPietra + P.pietra.length;
    this.iTetto = new Uint8Array(scena.edifici.length);
    this.iMuro = new Uint8Array(scena.edifici.length);
    scena.edifici.forEach((e, i) => {
      const a = e.seme & 0xffff;
      const b = e.seme >>> 16;
      if (e.tipo === 'industria') {
        this.iTetto[i] = tIndustria + (a % P.tettoIndustria.length);
        this.iMuro[i] = mIndustria + (b % P.intonacoIndustria.length);
      } else if (e.tipo === 'chiesa') {
        this.iTetto[i] = tCotto + (a % P.tetti.length);
        this.iMuro[i] = mPietra + (b % P.pietra.length);
      } else if (e.tipo === 'torre') {
        this.iTetto[i] = tCotto + (a % P.tetti.length);
        this.iMuro[i] = mMattone + (b % P.mattone.length);
      } else {
        this.iTetto[i] = tCotto + (a % P.tetti.length);
        this.iMuro[i] = mIntonaci + (b % P.intonaci.length);
      }
    });
    this.calcolaTinte();

    // --- tessere per la vista da lontano
    const tutti = scena.edifici.map((_, i) => i);
    this.tessereEdifici = raggruppaInTessere(scena.riquadriEdifici, tutti, LATO_TESSERA);
    // Il riquadro delle tessere deve comprendere l'altezza dei tetti.
    for (const t of this.tessereEdifici) {
      let su = 0;
      for (const i of t.indici) su = Math.max(su, scena.edifici[i].alt);
      t.minY -= su;
    }
    this.azzeraPezzi();
  }

  /** Le tinte di tetti, muri e chiome nella luce attiva, nello stesso ordine in ogni luce. */
  private calcolaTinte(): void {
    const P = this.P;
    this.tinteTetto = [...P.tetti, ...P.tettoIndustria];
    this.tinteMuro = [...P.intonaci, ...P.intonacoIndustria, ...P.pietra, ...P.mattone].map((c) => ({
      chiaro: sfuma(c, P.muri.chiaro),
      scuro: sfuma(c, P.muri.scuro),
    }));
    this.chiome = P.chiome.map((c) => ({ base: c, luce: sfuma(c, 0.18) }));
  }

  /** Luce con cui si sta disegnando. */
  get luce(): Luce {
    return this.luceAttiva;
  }

  /** Colore steso sotto la mappa nella luce attiva: chi vuole può intonarci la pagina. */
  get sfondo(): string {
    return this.P.sfondo;
  }

  /**
   * Cambia la luce: tavolozza, tinte degli edifici e velo sui luoghi simbolo. Restituisce
   * false se era già quella. Le tessere (pezziPiatti, pezziTetti) sono solo forme, senza
   * colori: restano valide in ogni luce e non vanno rifatte. Le sole immagini in memoria
   * sono le copie dei luoghi simbolo, rifatte sulla stessa tela, e lo sprite dell'alone.
   */
  impostaLuce(luce: Luce): boolean {
    if (luce === this.luceAttiva || !(luce in PALETTE_PER_LUCE)) return false;
    this.luceAttiva = luce;
    this.P = PALETTE_PER_LUCE[luce];
    this.calcolaTinte();
    this.illustrazioni.impostaTinta(this.P.illustrazioni);
    return true;
  }

  private alone(): HTMLCanvasElement | null {
    const colore = this.P.lampioni.alone;
    if (this.coloreSprite !== colore) {
      this.coloreSprite = colore;
      this.sprite = creaAlone(colore);
    }
    return this.sprite;
  }

  private azzeraPezzi(): void {
    this.pezziPiatti = this.tessereEdifici.map(() => null);
    this.pezziTetti = this.tessereEdifici.map(() => null);
  }

  private coperto(e: EdificioPronto): boolean {
    return e.sotto >= 0 && this.illustrazioni.elenco[e.sotto].pronta;
  }

  /**
   * true se l'illustrazione del luogo si disegna a questo zoom: deve essere pronta e,
   * nella vista da lontano, non ridotta a pochi pixel (lì resta il segnaposto).
   */
  illustrazioneMostrata(indice: number, camera: Camera, vista: Vista): boolean {
    const ill = this.illustrazioni.elenco[indice];
    if (!ill || !ill.pronta) return false;
    if (livelloDettaglio(camera.zoom, vista) !== 'piatto') return true;
    return this.scena.landmark[indice].larghezza * camera.zoom >= SPRITE_SOGLIA;
  }

  /**
   * I segnaposto da disegnare e da cliccare: quelli degli strati accesi, meno quelli che
   * stanno su un'illustrazione in vista (lì c'è già il disegno, con il suo nome).
   */
  marcatori(visibili: StratiVisibili, camera: Camera, vista: Vista): Marcatore[] {
    const salta = (p: PuntoPronto): boolean =>
      p.landmark >= 0 && this.illustrazioneMostrata(p.landmark, camera, vista);
    return marcatoriInVista(this.scena.punti, visibili, camera, vista, salta);
  }

  /**
   * true se nel punto (px, py) dello schermo l'illustrazione è coperta da un edificio
   * disegnato dopo di lei, cioè più vicino a chi guarda. Da lontano le illustrazioni
   * stanno sopra a tutto e non sono mai coperte.
   */
  copertaDaEdifici(indice: number, px: number, py: number, camera: Camera, vista: Vista): boolean {
    if (livelloDettaglio(camera.zoom, vista) !== 'pieno') return false;
    const posto = this.postoLandmark[indice];
    if (posto === undefined) return false;
    const centro = metriInIso(camera.x, camera.y);
    const x = (px - vista.larghezza / 2) / camera.zoom + centro.sx;
    const y = (py - vista.altezza / 2) / camera.zoom + centro.sy;
    const el = this.scena.elementi;
    const vicini = el.griglia.interroga({ minX: x - 1, minY: y - 1, maxX: x + 1, maxY: y + 1 });
    for (let j = vicini.length - 1; j >= 0; j--) {
      const i = vicini[j];
      if (i <= posto) break;
      if (el.tipo[i] !== EL_EDIFICIO) continue;
      const e = this.scena.edifici[el.rif[i]];
      if (this.coperto(e)) continue;
      if (puntoSuEdificio(x, y, e.anello, e.alt, e.lati)) return true;
    }
    return false;
  }

  /** I rettangoli sullo schermo delle illustrazioni in vista, in ordine di disegno. */
  spriteInVista(camera: Camera, vista: Vista): Sprite[] {
    const u: Sprite[] = [];
    for (const indice of this.ordineLandmark) {
      const ill = this.illustrazioni.elenco[indice];
      if (!this.illustrazioneMostrata(indice, camera, vista)) continue;
      const s = rettangoloSprite(this.scena.landmark[indice], indice, ill.proporzione, camera, vista);
      if (s.x > vista.larghezza || s.y > vista.altezza || s.x + s.larghezza < 0 || s.y + s.altezza < 0) {
        continue;
      }
      u.push(s);
    }
    return u;
  }

  disegna(ctx: CanvasRenderingContext2D, s: StatoDisegno): void {
    const { camera, vista, densita } = s;
    const z = camera.zoom;
    const centro = metriInIso(camera.x, camera.y);
    const k = z * densita;
    const tx = (vista.larghezza / 2) * densita - centro.sx * k;
    const ty = (vista.altezza / 2) * densita - centro.sy * k;
    const inIso = (): void => ctx.setTransform(k, 0, 0, k, tx, ty);
    const inPixel = (): void => ctx.setTransform(densita, 0, 0, densita, 0, 0);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // Il fondo è quello della pagina di giorno (stesso colore della carta), più scuro di notte.
    ctx.fillStyle = this.P.sfondo;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);

    const visibile = riquadroVisibile(camera, vista, 4 / z);
    const dettaglio = livelloDettaglio(z, vista);

    const pronte = this.illustrazioni.elenco.reduce((n, v) => n + (v.pronta ? 1 : 0), 0);
    if (pronte !== this.pronteNeiPezzi) {
      this.pronteNeiPezzi = pronte;
      this.azzeraPezzi();
    }

    inIso();
    this.carta(ctx, s, z);
    this.terreno(ctx, visibile, z);
    this.rete(ctx, visibile, z);
    if (this.P.lampioni.accesi) this.aloniATerra(ctx, camera, vista);
    this.tematiche(ctx, s, z);

    inPixel();
    this.evidenza(ctx, s);

    inIso();
    const sprite = this.spriteInVista(camera, vista);
    if (dettaglio === 'pieno') {
      this.inPiedi(ctx, s, visibile, z, inIso, inPixel);
    } else {
      this.daLontano(ctx, visibile, z, dettaglio === 'piatto');
      inPixel();
      for (const sp of sprite) this.illustrazione(ctx, sp, densita);
    }

    inPixel();
    this.segnaposto(ctx, s, sprite);
  }

  // --- carta ---------------------------------------------------------------------

  private carta(ctx: CanvasRenderingContext2D, s: StatoDisegno, z: number): void {
    const a = angoliInIso(s.area);
    const rombo = new Path2D();
    rombo.moveTo(a[0].sx, a[0].sy);
    for (let i = 1; i < 4; i++) rombo.lineTo(a[i].sx, a[i].sy);
    rombo.closePath();
    // Oltre il bordo dei dati la carta sfuma: tanti contorni larghi e leggeri.
    const sfumatura = Math.max(140, 90 / z);
    const passi = 12;
    ctx.strokeStyle = this.P.carta;
    ctx.globalAlpha = 0.2;
    for (let i = passi; i >= 1; i--) {
      ctx.lineWidth = (2 * sfumatura * i) / passi;
      ctx.stroke(rombo);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.P.carta;
    ctx.fill(rombo);
  }

  // --- aree ----------------------------------------------------------------------

  private terreno(ctx: CanvasRenderingContext2D, visibile: Rettangolo, z: number): void {
    const P = this.P;
    // Prima campi e verde, poi l'acqua, poi le piazze: nei dati veri prati e parchi
    // di riva si sovrappongono al fiume e lo nasconderebbero.
    const stendi = (tipo: TipoArea): void => {
      const pezzi = this.aree.get(tipo);
      if (!pezzi) return;
      ctx.fillStyle = P.aree[tipo];
      for (const p of pezzi) {
        if (!siToccano(p, visibile)) continue;
        ctx.fill(p.percorso);
        if (z > 1.2 && (tipo === 'piazza' || tipo === 'parco')) {
          ctx.strokeStyle = conAlfa(P.seppiaChiaro, 0.45);
          ctx.lineWidth = 0.6 / z;
          ctx.stroke(p.percorso);
        }
      }
    };
    for (const tipo of AREE_SOTTO) stendi(tipo);
    if (this.acqua && siToccano(this.acqua, visibile)) {
      const acqua = this.acqua.percorso;
      ctx.fillStyle = P.aree.acqua;
      ctx.fill(acqua);
      // Fascia più chiara parallela alla riva lontana, come un filo di corrente.
      ctx.save();
      ctx.clip(acqua);
      ctx.translate(0, 9);
      ctx.fillStyle = P.acquaChiara;
      ctx.globalAlpha = 0.75;
      ctx.fill(acqua);
      ctx.translate(0, 13);
      ctx.globalAlpha = 1;
      ctx.fillStyle = P.aree.acqua;
      ctx.fill(acqua);
      ctx.restore();
      if (z > 0.5) {
        ctx.strokeStyle = conAlfa(P.acquaBordo, 0.55);
        ctx.lineWidth = Math.max(0.5, 0.8 / z);
        ctx.stroke(acqua);
      }
    }
    stendi('piazza');
  }

  // --- strade --------------------------------------------------------------------

  private rete(ctx: CanvasRenderingContext2D, visibile: Rettangolo, z: number): void {
    const P = this.P;
    const conBordo = z >= 0.7;
    const bordo = Math.max(0.45, 0.8 / z);
    const larghezza = (t: Exclude<TipoStrada, 'ferrovia'>): number =>
      Math.max(LARGHEZZE[t].metri * 0.8, LARGHEZZE[t].minimo / z);
    const passa = (chiave: string, f: (p: Pezzo) => void): void => {
      const pezzi = this.strade.get(chiave);
      if (!pezzi) return;
      for (const p of pezzi) if (siToccano(p, visibile)) f(p);
    };

    for (const ponte of [false, true]) {
      const coda = ponte ? '+ponte' : '';
      if (conBordo) {
        for (const t of ORDINE_STRADE) {
          if (z < LARGHEZZE[t].da) continue;
          ctx.strokeStyle = ponte ? P.ponteBordo : P.strade[t].bordo;
          ctx.lineWidth = larghezza(t) + 2 * (ponte ? bordo * 1.6 : bordo);
          // I ponti finiscono netti, le strade si arrotondano negli incroci.
          ctx.lineCap = ponte ? 'butt' : 'round';
          passa(t + coda, (p) => ctx.stroke(p.percorso));
        }
      }
      ctx.lineCap = 'round';
      for (const t of ORDINE_STRADE) {
        if (z < LARGHEZZE[t].da) continue;
        // Da lontano, senza bordo, la strada è un filo del colore del bordo.
        ctx.strokeStyle = conBordo ? P.strade[t].riempimento : P.strade[t].bordo;
        ctx.lineWidth = conBordo ? larghezza(t) : Math.max(larghezza(t) * 0.7, 0.8 / z);
        passa(t + coda, (p) => ctx.stroke(p.percorso));
      }
      // La ferrovia di base: una riga scura con i tratti chiari delle traversine.
      const chiave = 'ferrovia' + coda;
      if (this.strade.has(chiave)) {
        ctx.lineCap = 'butt';
        ctx.strokeStyle = P.ferrovia;
        ctx.lineWidth = Math.max(2.4, 1.3 / z);
        passa(chiave, (p) => ctx.stroke(p.percorso));
        if (z > 0.8) {
          ctx.strokeStyle = P.ferroviaTratto;
          ctx.lineWidth = Math.max(1.1, 0.6 / z);
          ctx.setLineDash([5, 5]);
          passa(chiave, (p) => ctx.stroke(p.percorso));
          ctx.setLineDash([]);
        }
        ctx.lineCap = 'round';
      }
    }
  }

  // --- lampioni ------------------------------------------------------------------

  /**
   * La luce dei lampioni sul terreno e sulle strade, prima di tutto ciò che sta in piedi:
   * le case la coprono come farebbero davvero. Uno sprite solo, schiacciato come un cerchio
   * visto in isometria; con 'screen' le luci vicine si sommano senza bruciare.
   */
  private aloniATerra(ctx: CanvasRenderingContext2D, camera: Camera, vista: Vista): void {
    const sprite = this.alone();
    const lampioni = this.scena.lampioni;
    if (!sprite || lampioni.length === 0) return;
    const { indici, quanti, quota, raggio } = aloniInVista(this.scena, camera, vista);
    if (quanti === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Con meno luci accese ognuna è un poco più forte: la luce in tutto cambia senza scatti.
    ctx.globalAlpha = Math.min(1, 0.72 / Math.sqrt(quota));
    for (let j = 0; j < quanti; j++) {
      const i = indici[j];
      ctx.drawImage(sprite, lampioni[i * 2] - raggio, lampioni[i * 2 + 1] - raggio / 2, raggio * 2, raggio);
    }
    ctx.restore();
  }

  /** Un lampione tra le case: palo sottile da vicino; di notte lampada accesa e piccolo alone. */
  private lampione(ctx: CanvasRenderingContext2D, indice: number, z: number): void {
    const L = this.P.lampioni;
    const conPalo = z >= (L.accesi ? ZOOM_PALI.notte : ZOOM_PALI.giorno);
    if (!conPalo && !L.accesi) return;
    const sx = this.scena.lampioni[indice * 2];
    const sy = this.scena.lampioni[indice * 2 + 1];
    const cima = sy - ALTEZZA_LAMPIONE;
    if (L.accesi) {
      // Alone attorno alla lampada: schiarisce le facciate dietro, e le case davanti lo coprono.
      const sprite = this.alone();
      if (sprite) {
        const r = 5.5;
        ctx.globalAlpha = 0.5;
        ctx.drawImage(sprite, sx - r, cima - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
    }
    if (!conPalo) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = L.palo;
    ctx.lineWidth = Math.max(0.32, 0.9 / z);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, cima + 0.4);
    ctx.stroke();
    ctx.fillStyle = L.lampada;
    ctx.beginPath();
    ctx.arc(sx, cima, L.accesi ? 0.62 : 0.5, 0, Math.PI * 2);
    ctx.fill();
    if (!L.accesi) {
      ctx.lineWidth = Math.max(0.18, 0.6 / z);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- linee tematiche -------------------------------------------------------------

  private tematiche(ctx: CanvasRenderingContext2D, s: StatoDisegno, z: number): void {
    const P = this.P;
    for (const l of this.linee) {
      if (!s.visibili[l.strato]) continue;
      const spessore = Math.max(2.2, 2.6 / z);
      ctx.lineCap = 'round';
      ctx.strokeStyle = conAlfa(P.carta, 0.85);
      ctx.lineWidth = spessore + 2.4 / z;
      ctx.stroke(l.percorso);
      if (l.tipo === 'ciclabile') {
        ctx.strokeStyle = P.ciclabile;
        ctx.lineWidth = spessore;
        ctx.lineCap = 'butt';
        ctx.setLineDash([7 / z, 4 / z]);
        ctx.stroke(l.percorso);
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = P.ferroviaTematica;
        ctx.lineWidth = spessore;
        ctx.stroke(l.percorso);
        ctx.strokeStyle = P.carta;
        ctx.lineWidth = spessore * 0.4;
        ctx.lineCap = 'butt';
        ctx.setLineDash([6 / z, 6 / z]);
        ctx.stroke(l.percorso);
        ctx.setLineDash([]);
      }
      ctx.lineCap = 'round';
    }
  }

  // --- evidenza ------------------------------------------------------------------

  private evidenza(ctx: CanvasRenderingContext2D, s: StatoDisegno): void {
    if (!s.evidenziata) return;
    const { camera, vista } = s;
    this.scena.landmark.forEach((l, i) => {
      if (l.dati.storia !== s.evidenziata) return;
      const c = isoInSchermo(l.sx, l.sy, camera, vista);
      if (!this.illustrazioni.elenco[i].pronta) return;
      const raggio = Math.max(l.semiL * 1.25 * camera.zoom, 30);
      this.aloneEvidenza(ctx, c.px, c.py, raggio);
    });
  }

  /** true se la storia evidenziata ha un'illustrazione: allora l'alone sta sotto quella. */
  private evidenzaSuLandmark(storia: string | null): boolean {
    return (
      storia !== null &&
      this.scena.landmark.some(
        (l, i) => l.dati.storia === storia && this.illustrazioni.elenco[i].pronta,
      )
    );
  }

  /** Alone morbido e anello dorato appoggiati sul terreno. */
  private aloneEvidenza(ctx: CanvasRenderingContext2D, x: number, y: number, raggio: number): void {
    ctx.fillStyle = this.P.evidenza;
    for (let i = 5; i >= 0; i--) {
      const r = raggio * (1 + i * 0.13);
      ctx.globalAlpha = 0.09;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = this.P.evidenza;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, raggio, raggio / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // --- edifici da lontano ------------------------------------------------------------

  private daLontano(
    ctx: CanvasRenderingContext2D,
    visibile: Rettangolo,
    z: number,
    piatto: boolean,
  ): void {
    const edifici = this.scena.edifici;
    for (let t = 0; t < this.tessereEdifici.length; t++) {
      const tessera = this.tessereEdifici[t];
      if (!siToccano(tessera, visibile)) continue;
      if (piatto) {
        let pezzo = this.pezziPiatti[t];
        if (!pezzo) {
          pezzo = new Path2D();
          // Qui le impronte sono a terra e le illustrazioni vengono disegnate sopra:
          // non serve togliere quelle coperte (e sotto un luogo non disegnato non resta un buco).
          for (const i of tessera.indici) tracciaAnello(pezzo, edifici[i].anello);
          this.pezziPiatti[t] = pezzo;
        }
        ctx.fillStyle = this.P.edificiLontani;
        ctx.fill(pezzo);
        continue;
      }
      let pezzi = this.pezziTetti[t];
      if (!pezzi) {
        pezzi = new Map<number, Path2D>();
        for (const i of tessera.indici) {
          const e = edifici[i];
          if (this.coperto(e)) continue;
          let p = pezzi.get(this.iTetto[i]);
          if (!p) {
            p = new Path2D();
            pezzi.set(this.iTetto[i], p);
          }
          tracciaAnello(p, e.anello, e.alt);
        }
        this.pezziTetti[t] = pezzi;
      }
      const contorno = z > 0.6;
      if (contorno) {
        ctx.strokeStyle = conAlfa(this.P.seppia, 0.5);
        ctx.lineWidth = 0.6 / z;
      }
      for (const [tinta, p] of pezzi) {
        ctx.fillStyle = this.tinteTetto[tinta];
        ctx.fill(p);
        if (contorno) ctx.stroke(p);
      }
    }
  }

  // --- tutto ciò che sta in piedi, da vicino -----------------------------------------

  private inPiedi(
    ctx: CanvasRenderingContext2D,
    s: StatoDisegno,
    visibile: Rettangolo,
    z: number,
    inIso: () => void,
    inPixel: () => void,
  ): void {
    const el = this.scena.elementi;
    const trovati = el.griglia.interroga(visibile);
    const fine = z >= 2;
    const finestre = this.P.finestra !== '' && z >= ZOOM_FINESTRE;
    ctx.lineWidth = (fine ? 0.8 : 0.6) / z;
    ctx.strokeStyle = conAlfa(this.P.seppia, fine ? 0.8 : 0.55);
    for (let j = 0; j < trovati.length; j++) {
      const i = trovati[j];
      const tipo = el.tipo[i];
      if (tipo === EL_EDIFICIO) {
        this.edificio(ctx, el.rif[i], finestre);
      } else if (tipo === EL_ALBERO) {
        this.albero(ctx, el.rif[i], fine);
      } else if (tipo === EL_LAMPIONE) {
        this.lampione(ctx, el.rif[i], z);
      } else {
        const indice = el.rif[i];
        const ill = this.illustrazioni.elenco[indice];
        if (!ill.pronta) continue;
        const sp = rettangoloSprite(
          this.scena.landmark[indice],
          indice,
          ill.proporzione,
          s.camera,
          s.vista,
        );
        inPixel();
        this.illustrazione(ctx, sp, s.densita);
        inIso();
        ctx.lineWidth = (fine ? 0.8 : 0.6) / z;
        ctx.strokeStyle = conAlfa(this.P.seppia, fine ? 0.8 : 0.55);
      }
    }
  }

  private edificio(ctx: CanvasRenderingContext2D, indice: number, finestre = false): void {
    const e = this.scena.edifici[indice];
    if (this.coperto(e)) return;
    const a = e.anello;
    const n = a.length >> 1;
    const h = e.alt;
    const muro = this.tinteMuro[this.iMuro[indice]];
    const tetto = this.tinteTetto[this.iTetto[indice]];

    if (h > 0.2 && e.ordineMuri) {
      // Impronta con rientranze: un muro alla volta, dal più lontano al più vicino.
      for (let k = 0; k < e.ordineMuri.length; k++) {
        const i = e.ordineMuri[k];
        const j = (i + 1) % n;
        ctx.beginPath();
        ctx.moveTo(a[i * 2], a[i * 2 + 1]);
        ctx.lineTo(a[j * 2], a[j * 2 + 1]);
        ctx.lineTo(a[j * 2], a[j * 2 + 1] - h);
        ctx.lineTo(a[i * 2], a[i * 2 + 1] - h);
        ctx.closePath();
        ctx.fillStyle = e.lati[i] === MURO_SINISTRO ? muro.chiaro : muro.scuro;
        ctx.fill();
        ctx.stroke();
        if (finestre) {
          ctx.beginPath();
          if (this.finestra(ctx, e, i)) {
            ctx.fillStyle = this.P.finestra;
            ctx.fill();
          }
        }
      }
    } else if (h > 0.2) {
      for (let classe = MURO_SINISTRO; classe <= MURO_DESTRO; classe++) {
        let qualcosa = false;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          if (e.lati[i] !== classe) continue;
          const j = (i + 1) % n;
          const ax = a[i * 2];
          const ay = a[i * 2 + 1];
          const bx = a[j * 2];
          const by = a[j * 2 + 1];
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.lineTo(bx, by - h);
          ctx.lineTo(ax, ay - h);
          ctx.closePath();
          qualcosa = true;
        }
        if (!qualcosa) continue;
        ctx.fillStyle = classe === MURO_SINISTRO ? muro.chiaro : muro.scuro;
        ctx.fill();
        ctx.stroke();
        if (finestre) {
          let accese = false;
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            if (e.lati[i] === classe && this.finestra(ctx, e, i)) accese = true;
          }
          if (accese) {
            ctx.fillStyle = this.P.finestra;
            ctx.fill();
          }
        }
      }
    }

    if (e.colmo > 0) {
      // Tetto a punta: prima le falde che danno le spalle, poi quelle in vista.
      const px = e.cx;
      const py = e.cy - h - e.colmo;
      for (let classe = MURO_DIETRO; classe <= MURO_DESTRO; classe++) {
        let qualcosa = false;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          if (e.lati[i] !== classe) continue;
          const j = (i + 1) % n;
          ctx.moveTo(a[i * 2], a[i * 2 + 1] - h);
          ctx.lineTo(a[j * 2], a[j * 2 + 1] - h);
          ctx.lineTo(px, py);
          ctx.closePath();
          qualcosa = true;
        }
        if (!qualcosa) continue;
        ctx.fillStyle =
          classe === MURO_SINISTRO ? sfumaCache(tetto, 0.12) : classe === MURO_DESTRO ? sfumaCache(tetto, -0.14) : tetto;
        ctx.fill();
        ctx.stroke();
      }
      return;
    }

    ctx.beginPath();
    tracciaAnello(ctx, a, h);
    ctx.fillStyle = tetto;
    ctx.fill();
    ctx.stroke();
  }

  /**
   * Aggiunge al percorso aperto una finestra accesa sul lato `i`, se quel muro ne ha una:
   * lo decide il seme dell'edificio, così le stesse finestre restano accese a ogni fotogramma.
   */
  private finestra(ctx: CanvasRenderingContext2D, e: EdificioPronto, i: number): boolean {
    if (e.alt < 3.2 || e.tipo === 'industria') return false;
    const caso = Math.imul(e.seme ^ Math.imul(i + 1, 0x9e3779b1), 0x85ebca6b) >>> 0;
    if ((caso >>> 9) % 5 !== 0) return false;
    const a = e.anello;
    const j = (i + 1) % (a.length >> 1);
    const ax = a[i * 2];
    const ay = a[i * 2 + 1];
    const dx = a[j * 2] - ax;
    const dy = a[j * 2 + 1] - ay;
    const lungo = Math.hypot(dx, dy);
    if (lungo < 4.5) return false;
    // Posizione lungo il muro e mezza larghezza, come frazioni della sua lunghezza.
    const t = 0.28 + ((caso >>> 3) % 5) * 0.11;
    const w = 0.75 / lungo;
    const piani = e.alt > 8.5 && (caso & 4) !== 0 ? 2 : 1;
    for (let p = 0; p < piani; p++) {
      const sotto = Math.min(e.alt - 2.4, 1.6 + p * 3.4);
      const sopra = sotto + 1.5;
      ctx.moveTo(ax + dx * (t - w), ay + dy * (t - w) - sotto);
      ctx.lineTo(ax + dx * (t + w), ay + dy * (t + w) - sotto);
      ctx.lineTo(ax + dx * (t + w), ay + dy * (t + w) - sopra);
      ctx.lineTo(ax + dx * (t - w), ay + dy * (t - w) - sopra);
      ctx.closePath();
    }
    return true;
  }

  private albero(ctx: CanvasRenderingContext2D, indice: number, fine: boolean): void {
    const sx = this.scena.alberi[indice * 2];
    const sy = this.scena.alberi[indice * 2 + 1];
    const seme = Math.imul(indice + 1, 2654435761) >>> 0;
    const r = 2.3 + ((seme >>> 8) % 9) * 0.17;
    const chioma = this.chiome[(seme >>> 3) % this.chiome.length];
    const cy = sy - r * 1.35;
    // Ombra a terra, verso destra.
    ctx.fillStyle = this.P.ombra;
    ctx.beginPath();
    const lunga = this.P.ombraLunga;
    ctx.ellipse(sx + r * 0.55 * lunga, sy + r * 0.1, r * 1.05 * (0.5 + lunga / 2), r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (fine) {
      ctx.save();
      ctx.strokeStyle = this.P.tronco;
      ctx.lineWidth = Math.max(0.5, r * 0.22);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, cy);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = chioma.base;
    ctx.beginPath();
    ctx.arc(sx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (fine) {
      ctx.stroke();
      ctx.fillStyle = chioma.luce;
      ctx.beginPath();
      ctx.arc(sx - r * 0.28, cy - r * 0.3, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private illustrazione(ctx: CanvasRenderingContext2D, sp: Sprite, densita: number): void {
    const sorgente = this.illustrazioni.daDisegnare(sp.indice, sp.larghezza * densita);
    if (!sorgente) return;
    ctx.drawImage(sorgente, sp.x, sp.y, sp.larghezza, sp.altezza);
  }

  // --- segnaposto ------------------------------------------------------------------

  private segnaposto(ctx: CanvasRenderingContext2D, s: StatoDisegno, sprite: Sprite[]): void {
    const P = this.P;
    const marcatori = this.marcatori(s.visibili, s.camera, s.vista);
    // Un luogo senza illustrazione si evidenzia sul suo segnaposto, anche a strato spento:
    // l'alone va sopra gli edifici, altrimenti resterebbe nascosto.
    const evidenziati: { nome: string; px: number; py: number }[] = [];
    if (s.evidenziata && !this.evidenzaSuLandmark(s.evidenziata)) {
      for (const p of this.scena.punti) {
        if (p.dati.storia !== s.evidenziata) continue;
        const c = isoInSchermo(p.sx, p.sy, s.camera, s.vista);
        this.aloneEvidenza(ctx, c.px, c.py, 22);
        evidenziati.push({ nome: p.dati.nome, px: c.px, py: c.py });
      }
    }
    for (const m of marcatori) {
      const p = this.scena.punti[m.indice].dati;
      const colori = P.strati[p.strato];
      const sopra = m.indice === s.puntoSopra;
      this.spillo(ctx, m, p.strato, colori.fondo, colori.segno, p.storia !== undefined, sopra);
    }

    // Nomi: prima quello sotto il cursore, poi i luoghi con una storia, poi gli altri.
    const occupati: Rettangolo[] = [];
    const scrivi = (testo: string, x: number, y: number, forte: boolean, obbligato: boolean): void => {
      ctx.font = `${forte ? 600 : 500} ${forte ? 13 : 12}px ${CARATTERE}`;
      const chiave = ctx.font + testo;
      let larghezza = this.larghezzeTesto.get(chiave);
      if (larghezza === undefined) {
        larghezza = ctx.measureText(testo).width;
        this.larghezzeTesto.set(chiave, larghezza);
      }
      const cx = Math.min(s.vista.larghezza - larghezza / 2 - 6, Math.max(larghezza / 2 + 6, x));
      const r: Rettangolo = {
        minX: cx - larghezza / 2 - 4,
        maxX: cx + larghezza / 2 + 4,
        minY: y - 16,
        maxY: y + 3,
      };
      if (!obbligato && occupati.some((o) => siToccano(o, r))) return;
      occupati.push(r);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = P.etichettaAlone;
      ctx.strokeText(testo, cx, y);
      ctx.fillStyle = P.etichetta;
      ctx.fillText(testo, cx, y);
    };

    const sopraMarcatore = marcatori.find((m) => m.indice === s.puntoSopra);
    if (sopraMarcatore) {
      const p = this.scena.punti[sopraMarcatore.indice].dati;
      scrivi(p.nome, sopraMarcatore.tx, sopraMarcatore.ty - sopraMarcatore.raggio - 7, true, true);
    } else if (s.landmarkSopra >= 0) {
      const sp = sprite.find((v) => v.indice === s.landmarkSopra);
      if (sp) {
        const nome = this.scena.landmark[sp.indice].dati.nome;
        scrivi(nome, sp.x + sp.larghezza / 2, Math.max(18, sp.y - 6), true, true);
      }
    }
    // Il luogo evidenziato dice sempre il suo nome, anche da lontano e a strato spento.
    for (const e of evidenziati) {
      const m = marcatori.find((v) => v.px === e.px && v.py === e.py);
      if (m && m.indice === s.puntoSopra) continue;
      scrivi(e.nome, e.px, (m ? m.ty - m.raggio : e.py - 14) - 7, true, false);
    }
    // I luoghi simbolo hanno sempre il nome scritto sopra il disegno, a ogni zoom: è lui
    // a dire che cosa si sta guardando, al posto del segnaposto. Prima quello evidenziato.
    const conNome = sprite
      .filter((sp) => sp.indice !== s.landmarkSopra || sopraMarcatore !== undefined)
      .sort((a, b) => {
        const ea = this.scena.landmark[a.indice].dati.storia === s.evidenziata ? 0 : 1;
        const eb = this.scena.landmark[b.indice].dati.storia === s.evidenziata ? 0 : 1;
        return ea - eb || a.indice - b.indice;
      });
    for (const sp of conNome) {
      if (sp.x + sp.larghezza < 0 || sp.x > s.vista.larghezza || sp.y > s.vista.altezza) continue;
      const nome = this.scena.landmark[sp.indice].dati.nome;
      scrivi(nome, sp.x + sp.larghezza / 2, Math.max(18, sp.y - 6), true, false);
    }
    if (s.camera.zoom >= ZOOM_NOMI) {
      const resto = marcatori.filter((m) => m.indice !== s.puntoSopra);
      resto.sort((a, b) => {
        const sa = this.scena.punti[a.indice].dati.storia ? 0 : 1;
        const sb = this.scena.punti[b.indice].dati.storia ? 0 : 1;
        return sa - sb || b.py - a.py;
      });
      for (const m of resto) {
        const p = this.scena.punti[m.indice].dati;
        scrivi(p.nome, m.tx, m.ty - m.raggio - 6, false, false);
      }
    }
  }

  /** Un segnaposto: forma diversa per strato, sempre rivolto a chi guarda. */
  private spillo(
    ctx: CanvasRenderingContext2D,
    m: Marcatore,
    strato: IdStrato,
    fondo: string,
    segno: string,
    conStoria: boolean,
    sopra: boolean,
  ): void {
    const r = m.raggio * (sopra ? 1.12 : 1);
    ctx.lineJoin = 'round';
    if (m.pallino) {
      ctx.beginPath();
      if (strato === 'cultura') ctx.arc(m.px, m.py, r, 0, Math.PI * 2);
      else if (strato === 'ambiente') {
        ctx.moveTo(m.px, m.py - r * 1.25);
        ctx.lineTo(m.px + r * 1.25, m.py);
        ctx.lineTo(m.px, m.py + r * 1.25);
        ctx.lineTo(m.px - r * 1.25, m.py);
        ctx.closePath();
      } else ctx.rect(m.px - r * 0.9, m.py - r * 0.9, r * 1.8, r * 1.8);
      ctx.fillStyle = fondo;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = segno;
      ctx.stroke();
      return;
    }
    const x = m.tx;
    const y = m.ty;
    // Ombra a terra sotto la punta.
    ctx.fillStyle = this.P.ombra;
    ctx.beginPath();
    ctx.ellipse(m.px, m.py, r * 0.55, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    if (strato === 'cultura') {
      // Goccia.
      ctx.moveTo(m.px, m.py);
      ctx.lineTo(x - r * 0.8, y + r * 0.6);
      ctx.arc(x, y, r, Math.PI - 0.6435, 0.6435, false);
      ctx.closePath();
    } else if (strato === 'ambiente') {
      // Aquilone: un rombo con la punta in basso allungata fino a terra.
      ctx.moveTo(x, y - r * 1.15);
      ctx.lineTo(x + r * 1.15, y);
      ctx.lineTo(m.px, m.py);
      ctx.lineTo(x - r * 1.15, y);
      ctx.closePath();
    } else {
      // Targa quadrata con gli angoli tondi e un piccolo piede.
      const l = r * 0.95;
      const c = r * 0.32;
      ctx.moveTo(x - l + c, y - l);
      ctx.arcTo(x + l, y - l, x + l, y + l, c);
      ctx.arcTo(x + l, y + l, x - l, y + l, c);
      ctx.lineTo(x + r * 0.4, y + l);
      ctx.lineTo(m.px, m.py);
      ctx.lineTo(x - r * 0.4, y + l);
      ctx.arcTo(x - l, y + l, x - l, y - l, c);
      ctx.arcTo(x - l, y - l, x + l, y - l, c);
      ctx.closePath();
    }
    ctx.fillStyle = fondo;
    ctx.fill();
    ctx.lineWidth = sopra ? 2 : 1.4;
    ctx.strokeStyle = sopra ? segno : conAlfa(this.P.seppia, 0.9);
    ctx.stroke();

    // Segno interno: pieno per i luoghi con una storia, un anello per gli altri.
    ctx.beginPath();
    ctx.arc(x, y, r * (conStoria ? 0.42 : 0.34), 0, Math.PI * 2);
    if (conStoria) {
      ctx.fillStyle = segno;
      ctx.fill();
    } else {
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = segno;
      ctx.stroke();
    }
  }
}

const sfumature = new Map<string, string>();
function sfumaCache(colore: string, f: number): string {
  const chiave = colore + f;
  let v = sfumature.get(chiave);
  if (!v) {
    v = sfuma(colore, f);
    sfumature.set(chiave, v);
  }
  return v;
}
