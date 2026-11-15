// Contratti condivisi tra dati, mappa, contenuti e interfaccia.
// Chi cambia questo file deve aggiornare anche docs/SPEC.md.

/** Coordinate geografiche WGS84. */
export interface LonLat {
  lon: number;
  lat: number;
}

/** Metri locali rispetto a ORIGINE: x verso est, y verso nord. */
export interface Metri {
  x: number;
  y: number;
}

/** Centro della proiezione locale: Piazza Libertà. */
export const ORIGINE: LonLat = { lon: 11.7345, lat: 45.7665 };

/** Riquadro coperto dalla mappa (ovest, sud, est, nord). */
export const RIQUADRO = { ovest: 11.7, sud: 45.736, est: 11.768, nord: 45.792 } as const;

// ---------------------------------------------------------------------------
// Dati di base della mappa: public/data/base.json
// Tutte le coordinate sono già in metri locali, arrotondate a 0.1 m, come
// array piatti [x0, y0, x1, y1, ...]. I poligoni sono chiusi implicitamente.
// ---------------------------------------------------------------------------

export type TipoEdificio = 'casa' | 'chiesa' | 'industria' | 'pubblico' | 'torre' | 'altro';

export interface Edificio {
  /** Anello esterno, senso antiorario. */
  p: number[];
  /** Altezza in metri (da OSM, oppure stimata in modo deterministico). */
  h: number;
  t: TipoEdificio;
  /** Nome, solo se presente in OSM. */
  n?: string;
}

export type TipoStrada = 'principale' | 'secondaria' | 'locale' | 'pedonale' | 'ferrovia';

export interface Strada {
  p: number[];
  t: TipoStrada;
  /** true se la strada passa su un ponte. */
  ponte?: boolean;
}

export type TipoArea = 'acqua' | 'parco' | 'bosco' | 'prato' | 'piazza' | 'coltivo';

export interface Area {
  p: number[];
  t: TipoArea;
}

export interface DatiBase {
  generato: string; // ISO 8601
  fonte: string; // attribuzione da mostrare
  edifici: Edificio[];
  strade: Strada[];
  aree: Area[];
  /** Alberi singoli o punti campionati nelle aree verdi: [x0, y0, x1, y1, ...]. */
  alberi: number[];
}

// ---------------------------------------------------------------------------
// Strati tematici: public/data/strati.json
// ---------------------------------------------------------------------------

export type IdStrato = 'cultura' | 'ambiente' | 'mobilita';

export type TipoPunto =
  | 'museo'
  | 'biblioteca'
  | 'teatro'
  | 'monumento'
  | 'chiesa'
  | 'luogo-storico'
  | 'aria'
  | 'idrometro'
  | 'webcam'
  | 'fermata-bus'
  | 'stazione'
  | 'bici';

export interface Punto {
  id: string;
  strato: IdStrato;
  tipo: TipoPunto;
  nome: string;
  x: number;
  y: number;
  /** Se presente, il clic apre la storia content/luoghi/<storia>.json. */
  storia?: string;
  /** Breve testo per i punti senza storia. */
  nota?: string;
  /** Link esterno (es. pagina ufficiale, webcam). */
  url?: string;
}

export interface Linea {
  id: string;
  strato: IdStrato;
  tipo: 'ciclabile' | 'ferrovia';
  nome?: string;
  p: number[];
}

export interface DatiStrati {
  generato: string;
  fonti: { nome: string; url: string; licenza: string }[];
  punti: Punto[];
  linee: Linea[];
}

// ---------------------------------------------------------------------------
// Qualità dell'aria (fotografia fatta dallo script): public/data/aria.json
// ---------------------------------------------------------------------------

export interface DatiAria {
  generato: string;
  stazione: string;
  fonte: { nome: string; url: string; licenza: string };
  misure: { inquinante: string; valore: number; unita: string; quando: string }[];
}

// ---------------------------------------------------------------------------
// Storie dei luoghi: content/luoghi/<id>.json
// ---------------------------------------------------------------------------

export interface Fonte {
  titolo: string;
  url: string;
}

export interface Media {
  tipo: 'immagine' | 'video' | 'audio';
  titolo: string;
  /** immagine/audio: URL diretto del file. video: URL di incorporamento. */
  url: string;
  /** Pagina di origine, dove si leggono autore e licenza. */
  pagina: string;
  autore: string;
  licenza: string;
  /** Testo alternativo, obbligatorio per le immagini. */
  alt?: string;
}

export interface Tappa {
  anno: string;
  titolo: string;
  testo: string;
  fonte: Fonte;
  /** Indice dentro Storia.media di un'immagine da mostrare con la tappa. */
  media?: number;
}

/** Riquadro "Adesso" della finestra-racconto. */
export type Live =
  | { tipo: 'brenta'; nota: string }
  | { tipo: 'aria'; nota: string }
  | { tipo: 'link'; etichetta: string; url: string; nota: string };

export interface Storia {
  id: string;
  nome: string;
  sottotitolo: string;
  genere: 'luogo' | 'tema';
  lat?: number;
  lon?: number;
  /** Due o tre frasi che aprono la finestra. */
  intro: string;
  tappe: Tappa[];
  media: Media[];
  live: Live[];
  /** Punti su cui le fonti non concordano: mostrati come "Le fonti non concordano". */
  incertezze: string[];
  /** Id del disegno in public/landmarks/<id>.svg, se esiste. */
  landmark?: string;
}

// ---------------------------------------------------------------------------
// Luoghi simbolo illustrati: public/landmarks/indice.json
// ---------------------------------------------------------------------------

export interface Landmark {
  id: string;
  /** File SVG in public/landmarks/. */
  file: string;
  lat: number;
  lon: number;
  /**
   * Larghezza dell'intero SVG sul piano isometrico, cioè la sua larghezza sullo schermo a
   * zoom 1. NON è la larghezza reale dell'edificio: per un disegno che va dal punto più a
   * ovest (x1, y1) al punto più a est (x2, y2), in metri locali, vale
   * ((x2 - y2) - (x1 - y1)) * 0.7071. Il Ponte Vecchio, lungo 74 m, ha 66.3 (ombra e margini compresi).
   */
  larghezzaMetri: number;
  /**
   * Facoltativo: raggio in metri attorno al punto d'appoggio entro cui gli edifici generici
   * vengono nascosti. Serve ai luoghi piccoli stretti tra le case, che altrimenti restano
   * coperti da chi sta loro davanti. Senza questo campo si nasconde solo ciò che sta nel
   * rombo di terreno del disegno.
   */
  copre?: number;
  /** Punto dell'SVG che poggia sulle coordinate, in frazioni 0..1 di larghezza e altezza. */
  ancora: [number, number];
  /** Storia da aprire al clic. */
  storia: string;
  nome: string;
}
