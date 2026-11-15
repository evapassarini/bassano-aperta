// Tasselli dipinti: immagini che coprono una zona della mappa con una versione dipinta a mano
// (o da un generatore di immagini) dello stesso identico scorcio. Sono facoltativi e spenti
// se non li si accende apposta (vedi tasselliAccesi): da spenti non si chiede nulla alla rete
// e la mappa resta quella disegnata dal codice. Da accesi si legge public/tasselli/indice.json.
// Per ora si mostrano solo con la luce di giorno.

import { metriInIso } from './proiezione';

export interface VoceTassello {
  /** File dentro public/tasselli/. */
  file: string;
  /** Centro del tassello in metri locali. */
  x: number;
  y: number;
  /** Lati del tassello sul piano isometrico (1 unità = 1 pixel a zoom 1). */
  larghezza: number;
  altezza: number;
  /** Zoom da cui il tassello comincia a comparire. */
  zoomDa: number;
}

interface Tassello extends VoceTassello {
  sx: number;
  sy: number;
  /** Immagine con i bordi sfumati, pronta da stendere; null finché non è caricata. */
  tela: HTMLCanvasElement | null;
}

/** Larghezza della sfumatura ai bordi, come frazione del lato. */
const SFUMATURA = 0.06;
/** In quanti livelli di zoom il tassello passa da invisibile a pieno. */
const ENTRATA = 0.7;

function valida(v: unknown): v is VoceTassello {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Record<string, unknown>;
  const numero = (n: unknown): boolean => typeof n === 'number' && Number.isFinite(n);
  return (
    typeof t.file === 'string' &&
    /^[\w.-]+$/.test(t.file) &&
    numero(t.x) &&
    numero(t.y) &&
    numero(t.larghezza) &&
    numero(t.altezza) &&
    numero(t.zoomDa) &&
    (t.larghezza as number) > 0 &&
    (t.altezza as number) > 0
  );
}

/**
 * L'interruttore dei tasselli. È spento se non lo si accende apposta: oggi i tasselli non
 * esistono, e senza interruttore ogni visita chiederebbe un indice.json che non c'è (errore 404).
 * Si accende con la variabile d'ambiente VITE_TASSELLI=1, al momento di costruire o di avviare
 * il sito in sviluppo.
 */
export function tasselliAccesi(ambiente: Record<string, unknown> | undefined = import.meta.env): boolean {
  return ambiente?.VITE_TASSELLI === '1';
}

/**
 * Crea i tasselli solo se l'interruttore è acceso. Da spento restituisce null e non parte
 * nessuna richiesta di rete.
 */
export function creaTasselli(cartella: string, alCarico: () => void, accesi: boolean = tasselliAccesi()): Tasselli | null {
  return accesi ? new Tasselli(cartella, alCarico) : null;
}

/** Quanto è presente un tassello a questo zoom, tra 0 e 1. */
export function presenzaTassello(zoom: number, zoomDa: number): number {
  return Math.min(1, Math.max(0, (zoom - zoomDa) / ENTRATA));
}

export class Tasselli {
  private elenco: Tassello[] = [];
  private vivo = true;

  constructor(
    private readonly cartella: string,
    private readonly alCarico: () => void,
  ) {
    void this.carica();
  }

  private async carica(): Promise<void> {
    try {
      const risposta = await fetch(this.cartella + 'indice.json');
      if (!risposta.ok) return;
      const voci: unknown = await risposta.json();
      if (!Array.isArray(voci) || !this.vivo) return;
      for (const v of voci) {
        if (!valida(v)) continue;
        const centro = metriInIso(v.x, v.y);
        const t: Tassello = { ...v, sx: centro.sx, sy: centro.sy, tela: null };
        this.elenco.push(t);
        const immagine = new Image();
        immagine.decoding = 'async';
        immagine.onload = () => {
          if (!this.vivo) return;
          t.tela = sfumaBordi(immagine);
          this.alCarico();
        };
        immagine.src = this.cartella + v.file;
      }
    } catch {
      // Senza tasselli la mappa funziona lo stesso.
    }
  }

  /** Stende i tasselli in vista. Il contesto deve essere nel piano isometrico. */
  disegna(ctx: CanvasRenderingContext2D, zoom: number): void {
    for (const t of this.elenco) {
      if (!t.tela) continue;
      const presenza = presenzaTassello(zoom, t.zoomDa);
      if (presenza <= 0) continue;
      ctx.globalAlpha = presenza;
      ctx.drawImage(t.tela, t.sx - t.larghezza / 2, t.sy - t.altezza / 2, t.larghezza, t.altezza);
    }
    ctx.globalAlpha = 1;
  }

  distruggi(): void {
    this.vivo = false;
    this.elenco = [];
  }
}

/** Copia dell'immagine con i quattro bordi che sfumano nel trasparente. */
function sfumaBordi(immagine: HTMLImageElement): HTMLCanvasElement | null {
  const tela = document.createElement('canvas');
  tela.width = immagine.naturalWidth;
  tela.height = immagine.naturalHeight;
  const ctx = tela.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(immagine, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  const w = tela.width;
  const h = tela.height;
  for (const orizzontale of [true, false]) {
    const g = orizzontale ? ctx.createLinearGradient(0, 0, w, 0) : ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(SFUMATURA, 'rgba(0,0,0,1)');
    g.addColorStop(1 - SFUMATURA, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  return tela;
}
