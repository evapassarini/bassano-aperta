// Caricamento delle illustrazioni dei luoghi simbolo (SVG in public/landmarks/).
// Ogni disegno viene letto come testo, gli si dà una dimensione certa (così tutti
// i browser lo disegnano uguale) e poi lo si tiene pronto come immagine.

import type { Landmark } from '../types';

/** Lato della maschera di opacità usata per i clic. */
const MASCHERA = 48;
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
        if (m[k] > 24) pieni++;
      }
      // Una maschera vuota vuol dire che il browser non ha disegnato: meglio non usarla.
      return pieni > 0 ? m : null;
    } catch {
      return null;
    }
  }

  /** true se nel punto (u, v) del disegno c'è qualcosa (con un po' di tolleranza). */
  opaco(indice: number, u: number, v: number): boolean {
    const voce = this.elenco[indice];
    if (!voce || !voce.pronta) return false;
    const m = voce.maschera;
    if (!m) return true;
    const cx = Math.min(MASCHERA - 1, Math.max(0, Math.floor(u * MASCHERA)));
    const cy = Math.min(MASCHERA - 1, Math.max(0, Math.floor(v * MASCHERA)));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= MASCHERA || y >= MASCHERA) continue;
        if (m[y * MASCHERA + x] > 24) return true;
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
        ctx.drawImage(voce.immagine, 0, 0, larghezza, altezza);
        voce.copia = tela;
        voce.larghezzaCopia = larghezza;
      } catch {
        return voce.immagine;
      }
    }
    return voce.copia;
  }

  distruggi(): void {
    this.vivo = false;
    for (const u of this.indirizzi) URL.revokeObjectURL(u);
    this.indirizzi.length = 0;
    for (const voce of this.elenco) {
      voce.immagine = null;
      voce.copia = null;
      voce.pronta = false;
    }
  }
}
