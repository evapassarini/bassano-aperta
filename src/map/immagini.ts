// Caricamento delle illustrazioni dei luoghi simbolo (SVG in public/landmarks/).
// Ogni disegno viene letto come testo, gli si dà una dimensione certa (così tutti
// i browser lo disegnano uguale) e poi lo si tiene pronto come immagine.

import type { Landmark } from '../types';
import type { TintaIllustrazioni } from './palette';

/**
 * Il colore con cui i file SVG dei luoghi simbolo disegnano le pezze d'acqua. Sta scritto nei
 * file: non segue la tavolozza, che può cambiare la tinta del fiume senza toccarli.
 */
export const ACQUA_NEI_DISEGNI = '#7fb8ad';

/** Lato della maschera di opacità usata per i clic. */
const MASCHERA = 48;
/**
 * Opacità (0-255) sopra la quale un punto del disegno conta come «pieno». Sta sopra
 * quella dell'ombra a terra degli SVG (opacità 0.2, cioè 51): l'ombra non si clicca.
 */
export const SOGLIA_OPACO = 96;
/** Larghezza massima, in pixel reali, della copia già disegnata. */
const COPIA_MASSIMA = 2048;

export interface Illustrazione {
  pronta: boolean;
  fallita: boolean;
  /** Altezza / larghezza del disegno. */
  proporzione: number;
  immagine: HTMLImageElement | null;
  /** Copia già disegnata alla dimensione che serve, per non ridisegnare l'SVG a ogni fotogramma. */
  copia: HTMLCanvasElement | null;
  larghezzaCopia: number;
  /** Opacità campionata su una griglia MASCHERA x MASCHERA; null se non disponibile. */
  maschera: Uint8Array | null;
  /**
   * Solo per i disegni che contengono una pezza d'acqua (il Brenta sotto il Ponte Vecchio): il
   * disegno senza la pezza e la pezza da sola. Servono quando la luce cambia, perché la pezza
   * deve prendere il colore dell'acqua della mappa e non quello del giorno scurito dal velo.
   */
  senzaAcqua: HTMLImageElement | null;
  soloAcqua: HTMLImageElement | null;
}

/**
 * Separa da un SVG le pezze d'acqua: gli elementi chiusi in se stessi con `fill` uguale al
 * colore dell'acqua nei disegni (ACQUA_NEI_DISEGNI). Restituisce null se non ce ne sono. Le pezze devono stare fuori
 * da gruppi con trasformazioni (negli SVG di oggi è così).
 */
export function separaAcqua(testo: string): { senza: string; solo: string } | null {
  const apertura = /<svg\b[^>]*>/i.exec(testo);
  if (!apertura) return null;
  const colore = ACQUA_NEI_DISEGNI.replace('#', '\\#');
  const pezza = new RegExp(`<(?:path|polygon|rect|ellipse|circle)\\b[^>]*\\sfill="${colore}"[^>]*/>`, 'gi');
  const pezze = testo.match(pezza);
  if (!pezze) return null;
  return {
    senza: testo.replace(pezza, ''),
    solo: apertura[0] + pezze.join('') + '</svg>',
  };
}

/** Legge larghezza e altezza del disegno e gli impone una dimensione esplicita. */
export function normalizzaSvg(testo: string): { testo: string; proporzione: number } | null {
  const apertura = /<svg\b[^>]*>/i.exec(testo);
  if (!apertura) return null;
  const tag = apertura[0];
  const attributo = (nome: string): string | null => {
    const m = new RegExp(`\\s${nome}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag);
    return m ? m[1] : null;
  };
  let larghezza = 0;
  let altezza = 0;
  const riquadro = attributo('viewBox');
  if (riquadro) {
    const v = riquadro.trim().split(/[\s,]+/).map(Number);
    if (v.length === 4 && v[2] > 0 && v[3] > 0) {
      larghezza = v[2];
      altezza = v[3];
    }
  }
  if (!larghezza || !altezza) {
    larghezza = parseFloat(attributo('width') ?? '');
    altezza = parseFloat(attributo('height') ?? '');
  }
  if (!(larghezza > 0) || !(altezza > 0)) return null;
  const proporzione = altezza / larghezza;
  let nuovo = tag.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '');
  const aggiunte =
    ` width="1024" height="${Math.round(1024 * proporzione)}"` +
    (riquadro ? '' : ` viewBox="0 0 ${larghezza} ${altezza}"`);
  nuovo = nuovo.replace(/\/?>$/, (fine) => aggiunte + fine);
  return { testo: testo.replace(tag, nuovo), proporzione };
}

export class Illustrazioni {
  readonly elenco: Illustrazione[];
  private readonly indirizzi: string[] = [];
  private vivo = true;
  private tinta: TintaIllustrazioni | null = null;
  /** Tela d'appoggio per la luce calda e per l'acqua, riusata. */
  private telaLuce: HTMLCanvasElement | null = null;

  constructor(
    landmark: Landmark[],
    cartella: string,
    private readonly alCarico: () => void,
  ) {
    this.elenco = landmark.map(() => ({
      pronta: false,
      fallita: false,
      proporzione: 1,
      immagine: null,
      copia: null,
      larghezzaCopia: 0,
      maschera: null,
      senzaAcqua: null,
      soloAcqua: null,
    }));
    landmark.forEach((l, i) => {
      void this.carica(i, cartella + l.file);
    });
  }

  private async carica(i: number, indirizzo: string): Promise<void> {
    const voce = this.elenco[i];
    let sorgente = indirizzo;
    let proporzione = 0;
    try {
      const risposta = await fetch(indirizzo);
      if (!risposta.ok) throw new Error(String(risposta.status));
      const pulito = normalizzaSvg(await risposta.text());
      if (pulito) {
        proporzione = pulito.proporzione;
        sorgente = URL.createObjectURL(new Blob([pulito.testo], { type: 'image/svg+xml' }));
        this.indirizzi.push(sorgente);
        const parti = separaAcqua(pulito.testo);
        if (parti && this.vivo) {
          this.caricaParte(voce, 'senzaAcqua', parti.senza);
          this.caricaParte(voce, 'soloAcqua', parti.solo);
        }
      }
    } catch {
      // Se la lettura come testo non riesce si prova comunque a caricarlo come immagine.
    }
    if (!this.vivo) return;
    const immagine = new Image();
    immagine.decoding = 'async';
    immagine.onload = () => {
      if (!this.vivo) return;
      if (!proporzione && immagine.naturalWidth > 0) {
        proporzione = immagine.naturalHeight / immagine.naturalWidth;
      }
      if (!(proporzione > 0)) {
        voce.fallita = true;
        return;
      }
      voce.immagine = immagine;
      voce.proporzione = proporzione;
      voce.maschera = this.campiona(immagine);
      voce.pronta = true;
      this.alCarico();
    };
    immagine.onerror = () => {
      voce.fallita = true;
    };
    immagine.src = sorgente;
  }

  /** Carica una delle due parti di un disegno con l'acqua; quando arriva, la copia si rifà. */
  private caricaParte(voce: Illustrazione, quale: 'senzaAcqua' | 'soloAcqua', testo: string): void {
    const indirizzo = URL.createObjectURL(new Blob([testo], { type: 'image/svg+xml' }));
    this.indirizzi.push(indirizzo);
    const immagine = new Image();
    immagine.decoding = 'async';
    immagine.onload = () => {
      if (!this.vivo) return;
      voce[quale] = immagine;
      voce.larghezzaCopia = 0;
      if (voce.pronta && this.tinta) this.alCarico();
    };
    immagine.src = indirizzo;
  }

  private campiona(immagine: HTMLImageElement): Uint8Array | null {
    try {
      const tela = document.createElement('canvas');
      tela.width = MASCHERA;
      tela.height = MASCHERA;
      const ctx = tela.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(immagine, 0, 0, MASCHERA, MASCHERA);
      const dati = ctx.getImageData(0, 0, MASCHERA, MASCHERA).data;
      const m = new Uint8Array(MASCHERA * MASCHERA);
      let pieni = 0;
      for (let k = 0; k < m.length; k++) {
        m[k] = dati[k * 4 + 3];
        if (m[k] > SOGLIA_OPACO) pieni++;
      }
      // Una maschera vuota vuol dire che il browser non ha disegnato: meglio non usarla.
      return pieni > 0 ? m : null;
    } catch {
      return null;
    }
  }

  /**
   * true se nel punto (u, v) del disegno c'è qualcosa. `intorno` è la tolleranza in
   * caselle della maschera: 0 per il mouse (il punto esatto), 1 per il dito.
   */
  opaco(indice: number, u: number, v: number, intorno = 0): boolean {
    const voce = this.elenco[indice];
    if (!voce || !voce.pronta) return false;
    const m = voce.maschera;
    if (!m) return true;
    const cx = Math.min(MASCHERA - 1, Math.max(0, Math.floor(u * MASCHERA)));
    const cy = Math.min(MASCHERA - 1, Math.max(0, Math.floor(v * MASCHERA)));
    for (let dy = -intorno; dy <= intorno; dy++) {
      for (let dx = -intorno; dx <= intorno; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= MASCHERA || y >= MASCHERA) continue;
        if (m[y * MASCHERA + x] > SOGLIA_OPACO) return true;
      }
    }
    return false;
  }

  /**
   * Restituisce ciò che va passato a drawImage per disegnare l'illustrazione
   * larga `pixelReali` pixel: una copia già pronta, rifatta solo quando la
   * dimensione cambia di molto.
   */
  daDisegnare(indice: number, pixelReali: number): CanvasImageSource | null {
    const voce = this.elenco[indice];
    if (!voce.pronta || !voce.immagine) return null;
    const serve = Math.min(COPIA_MASSIMA, Math.max(32, pixelReali));
    if (!voce.copia || voce.larghezzaCopia < serve * 0.95 || voce.larghezzaCopia > serve * 3) {
      const larghezza = Math.min(COPIA_MASSIMA, Math.ceil(serve * 1.4));
      const altezza = Math.max(1, Math.ceil(larghezza * voce.proporzione));
      try {
        const tela = voce.copia ?? document.createElement('canvas');
        tela.width = larghezza;
        tela.height = altezza;
        const ctx = tela.getContext('2d');
        if (!ctx) return voce.immagine;
        ctx.clearRect(0, 0, larghezza, altezza);
        if (this.tinta) {
          const diviso = voce.senzaAcqua && voce.soloAcqua;
          this.intona(ctx, diviso ? voce.senzaAcqua! : voce.immagine, larghezza, altezza, this.tinta);
          if (diviso) this.stendiAcqua(ctx, voce.soloAcqua!, larghezza, altezza, this.tinta.acqua);
        }
        else ctx.drawImage(voce.immagine, 0, 0, larghezza, altezza);
        voce.copia = tela;
        voce.larghezzaCopia = larghezza;
      } catch {
        return voce.immagine;
      }
    }
    return voce.copia;
  }

  /**
   * Cambia il modo in cui i disegni si intonano alla luce della mappa (null: come sono).
   * Le copie già pronte vengono rifatte alla prossima richiesta, una volta sola, sulla
   * stessa tela: non si accumula memoria.
   */
  impostaTinta(tinta: TintaIllustrazioni | null): void {
    const a = this.tinta;
    if (tinta?.velo === a?.velo && tinta?.luce === a?.luce && tinta?.acqua === a?.acqua) return;
    this.tinta = tinta;
    for (const voce of this.elenco) voce.larghezzaCopia = 0;
  }

  /**
   * Disegna l'illustrazione intonata: velo su tutto il disegno e, se serve, una luce calda dal
   * basso sulle sole parti piene.
   *
   * Il velo si moltiplica su fondo nero pieno, non sul disegno trasparente: su un fondo
   * trasparente la moltiplicazione lascia ai punti semitrasparenti (le ombre a terra degli SVG)
   * quasi il colore del velo, e di notte l'ombra del ponte sull'acqua diventava una fascia
   * chiara. Così invece le ombre restano ombre, anzi un poco più scure.
   */
  private intona(
    ctx: CanvasRenderingContext2D,
    immagine: HTMLImageElement,
    larghezza: number,
    altezza: number,
    tinta: TintaIllustrazioni,
  ): void {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, larghezza, altezza);
    ctx.drawImage(immagine, 0, 0, larghezza, altezza);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tinta.velo;
    ctx.fillRect(0, 0, larghezza, altezza);
    // Si ritaglia sulla sagoma del disegno: il fondo nero sparisce.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(immagine, 0, 0, larghezza, altezza);
    ctx.globalCompositeOperation = 'source-over';
    if (!tinta.luce) return;
    // La luce si prepara a parte e si ritaglia tre volte sul disegno: resta piena dove il
    // disegno è pieno e quasi sparisce sulle ombre a terra, che non devono schiarirsi.
    const tela = this.appoggio(larghezza, altezza);
    const c = tela.getContext('2d');
    if (!c) return;
    const cy = altezza * 0.72;
    const raggio = Math.max(larghezza * 0.42, altezza * 0.5);
    const luce = c.createRadialGradient(larghezza / 2, cy, 0, larghezza / 2, cy, raggio);
    luce.addColorStop(0, tinta.luce);
    luce.addColorStop(0.55, tinta.luce.replace(/[\d.]+\)$/, '0.1)'));
    luce.addColorStop(1, tinta.luce.replace(/[\d.]+\)$/, '0)'));
    c.fillStyle = luce;
    c.fillRect(0, 0, larghezza, altezza);
    c.globalCompositeOperation = 'destination-in';
    for (let k = 0; k < 3; k++) c.drawImage(immagine, 0, 0, larghezza, altezza);
    c.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'source-atop';
    ctx.drawImage(tela, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    // La tela d'appoggio non tiene memoria tra un disegno e l'altro.
    tela.width = 1;
    tela.height = 1;
  }

  /** Mette sotto il disegno la pezza d'acqua, nel colore dell'acqua della mappa. */
  private stendiAcqua(
    ctx: CanvasRenderingContext2D,
    pezza: HTMLImageElement,
    larghezza: number,
    altezza: number,
    colore: string,
  ): void {
    const tela = this.appoggio(larghezza, altezza);
    const c = tela.getContext('2d');
    if (!c) return;
    c.drawImage(pezza, 0, 0, larghezza, altezza);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = colore;
    c.fillRect(0, 0, larghezza, altezza);
    c.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'destination-over';
    ctx.drawImage(tela, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    tela.width = 1;
    tela.height = 1;
  }

  /** La tela d'appoggio, vuota e della misura chiesta. */
  private appoggio(larghezza: number, altezza: number): HTMLCanvasElement {
    const tela = this.telaLuce ?? document.createElement('canvas');
    this.telaLuce = tela;
    tela.width = larghezza;
    tela.height = altezza;
    return tela;
  }

  distruggi(): void {
    this.vivo = false;
    for (const u of this.indirizzi) URL.revokeObjectURL(u);
    this.indirizzi.length = 0;
    for (const voce of this.elenco) {
      voce.immagine = null;
      voce.copia = null;
      voce.senzaAcqua = null;
      voce.soloAcqua = null;
      voce.pronta = false;
    }
    this.telaLuce = null;
  }
}
