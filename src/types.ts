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
  fonte: string; // attribuzione da mostrare
  edifici: Edificio[];
  strade: Strada[];
  aree: Area[];
  /** Alberi singoli o punti campionati nelle aree verdi: [x0, y0, x1, y1, ...]. */
  alberi: number[];
  /**
   * Quanti alberi vengono da OpenStreetMap: sono i primi di `alberi`. Gli altri sono aggiunti
   * in modo illustrativo dentro boschi e parchi. Manca nei file preparati prima che lo script
   * lo salvasse: in quel caso il sito lo dice a parole, senza numero.
   */
  alberiVeri?: number;
}

// ---------------------------------------------------------------------------
// Luce della mappa e lampioni: public/data/lampioni.json
// ---------------------------------------------------------------------------

/** Come è illuminata la mappa. */
export type Luce = 'giorno' | 'pomeriggio' | 'notte';

/** Scelta dell'utente: 'adesso' segue l'ora vera di Bassano (vedi src/luce.ts). */
export type SceltaLuce = 'adesso' | Luce;

export interface DatiLampioni {
  fonte: string;
  /** Quanti dei punti vengono da OpenStreetMap (highway=street_lamp). */
  veri: number;
  /**
   * Lampioni in metri locali: [x0, y0, x1, y1, ...]. Prima i `veri` da OpenStreetMap, poi quelli
   * disposti dallo script lungo le strade dove OpenStreetMap non ne ha: sono illustrativi.
   */
  p: number[];
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
  | 'bici'
  /** Un avviso sulla viabilità con la sua posizione: non sta in strati.json, arriva da avvisi.json. */
  | 'avviso';

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
  /**
   * Serie brevi, come le dà ARPAV, dalla più vecchia alla più recente. Servono al giudizio a
   * parole (src/live/giudizioAria.ts). Facoltative: senza, il sito mostra solo i numeri.
   */
  serie?: {
    /** Ozono, medie orarie (µg/m³), una per ora: `quando` è "2026-11-14T22:00:00", senza fuso. */
    ozonoOrario?: PuntoSerieAria[];
    /** PM10, medie giornaliere (µg/m³), una per giorno: `quando` è "2026-11-14". */
    pm10Giornaliero?: PuntoSerieAria[];
  };
}

export interface PuntoSerieAria {
  quando: string;
  valore: number;
}

// ---------------------------------------------------------------------------
// Treni alla stazione di Bassano: letti in diretta dal browser (src/live/treni.ts)
// dal feed GTFS-Realtime di BusOne. Solo ritardi dichiarati: le posizioni dei treni
// in quel feed sono stime, non si usano.
// ---------------------------------------------------------------------------

export interface Treno {
  /** Numero del treno, es. "16313". */
  numero: string;
  /** 'partenza' se Bassano è la prima fermata, 'arrivo' se è l'ultima, 'transito' altrimenti. */
  verso: 'partenza' | 'arrivo' | 'transito';
  /** Stazione di origine e di destinazione (nomi leggibili, es. "Venezia S. Lucia"), se noti. */
  da: string | null;
  a: string | null;
  /** Ora prevista a Bassano con il ritardo già dentro (ISO 8601): partenza, o arrivo se termina qui. */
  quando: string;
  /** Ritardo a Bassano in minuti (0 = in orario, negativo = in anticipo). */
  ritardoMinuti: number;
  /** true se la corsa è soppressa. */
  soppresso: boolean;
}

export interface LetturaTreni {
  /** Momento dell'emissione del feed (ISO 8601). */
  quando: string;
  /** Treni che passano da Bassano, ordinati per `quando`, da un'ora fa in avanti. */
  treni: Treno[];
}

// ---------------------------------------------------------------------------
// Avvisi sulla viabilità (fotografia fatta dallo script): public/data/avvisi.json
// ---------------------------------------------------------------------------

export interface Avviso {
  /** 'evento' = evento di traffico in corso (CCISS); 'ordinanza' = lavori o limitazioni (Vi.abilità). */
  tipo: 'evento' | 'ordinanza';
  /** Strada, es. "SS47 della Valsugana" o "S.P. 52 Bassanese". */
  strada: string;
  /** Testo breve, senza HTML, al massimo 280 caratteri. */
  testo: string;
  /** Data di pubblicazione (ISO 8601). */
  quando: string;
  /** Nome breve della fonte, uguale a un `nome` in DatiAvvisi.fonti. */
  fonte: string;
  /** Pagina dove leggere l'avviso completo. */
  url: string;
  /**
   * Solo per gli eventi del CCISS letti per zona: true se la fonte li dava come validi (in
   * corso o programmati) quando è stata fatta la fotografia. Allora contano anche se
   * pubblicati da tempo (un tratto chiuso per settimane), finché la fotografia ha meno di 24 ore.
   */
  attivo?: boolean;
  /**
   * Solo per gli eventi del CCISS letti per zona: i due incroci che delimitano il tratto,
   * come li dà la fonte. Il punto esatto dei lavori può essere ovunque tra i due.
   */
  inizio?: LonLat;
  fine?: LonLat;
}

export interface DatiAvvisi {
  generato: string;
  fonti: { nome: string; url: string; licenza: string }[];
  avvisi: Avviso[];
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
  /** Fatti curiosi del luogo, mostrati nella sezione "Curiosità". Può essere vuoto. */
  curiosita: string[];
  /**
   * Fonti delle curiosità che non sono già tra le fonti delle tappe. Compaiono nell'elenco
   * "Fonti" del racconto insieme a quelle delle tappe.
   */
  fontiCuriosita?: Fonte[];
  /**
   * Nota interna di redazione: punti su cui le fonti non concordano. Non è mostrata sul sito;
   * serve a chi scrive e rivede i testi.
   */
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
   * zoom 1. Non è la larghezza reale dell'edificio: per un disegno che va dal punto più a
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
  /**
   * Facoltativo: profondità in metri della fascia davanti al disegno (verso sud-ovest, cioè
   * verso chi guarda) in cui gli edifici generici si disegnano bassi (un piano), se il loro
   * centro cade nella larghezza dell'illustrazione. A differenza di `copre` non toglie nulla
   * dalla mappa: serve ai luoghi alti che le case davanti tagliano a metà.
   */
  davanti?: number;
  /** Punto dell'SVG che poggia sulle coordinate, in frazioni 0..1 di larghezza e altezza. */
  ancora: [number, number];
  /** Storia da aprire al clic. */
  storia: string;
  nome: string;
}
