// Giudizio a parole sulla qualità dell'aria (buona, accettabile, mediocre, scadente, pessima).
//
// Lo calcola questo sito, dalle misure ARPAV non validate della stazione di Bassano, con le
// fasce dell'indice di qualità dell'aria (IQA) di ARPAV. NON è l'indice di ARPAV: quello
// considera anche il biossido di azoto, che nei dati in diretta di Bassano non c'è, e si
// calcola solo su dati validati (la stazione il biossido di azoto lo misura: compare solo nei
// dati validati). Per questo il giudizio ufficiale può essere peggiore del nostro. Può anche
// essere diverso in un senso o nell'altro, perché ARPAV parte da dati controllati e noi no, e
// perché il nostro calcolo dell'ozono non è ancora stato confrontato con il loro: l'interfaccia
// lo dice e non promette che l'ufficiale non sia mai migliore.
//
// Fonti della scala, lette il 15/11/2026:
//   https://www.arpa.veneto.it/temi-ambientali/aria/iqa/indice
//     (significato delle classi; esempio del PM10: mediocre tra 50 e 75, scadente tra 75 e 100,
//     pessima oltre 100 µg/m³)
//   https://www.arpa.veneto.it/temi-ambientali/aria/iqa/indice-qualita-dellaria-approfondimenti
//     (sottoindice = dato del giorno / riferimento x 100; l'indice è il maggiore dei sottoindici;
//     PM10: media giornaliera, riferimento 50; ozono: massimo giornaliero delle medie mobili su
//     8 ore, riferimento 120)
//   https://www.arpa.veneto.it/dati-ambientali/dati-storici/aria/qualita-aria-dati-validati
//     (confini delle classi sull'indice, nel codice della pagina: fino a 50 compreso buona,
//     fino a 100 accettabile, fino a 150 mediocre, fino a 200 scadente, oltre pessima)
//
// Cose che ARPAV non scrive e che qui sono una nostra scelta:
// - la concentrazione si arrotonda all'intero prima del rapporto. Verificato su un solo caso e
//   solo per il PM10 (Bassano, 12/11/2026: 13,4 è diventato 13 e l'indice 26). Che valga anche
//   per l'ozono, e che i mezzi vadano in su (25,5 diventa 26), NON è verificato: sul confine
//   tra due classi il nostro giudizio può differire di una classe da quello ufficiale;
// - una media su 8 ore vale se ha almeno 6 ore su 8, e il massimo del giorno vale se le medie
//   valide sono almeno 18 su 24 (regola della direttiva UE 2024/2881, non di una pagina ARPAV);
// - l'ora scritta da ARPAV è presa come FINE dell'ora di misura: "01" è l'ora da mezzanotte
//   all'una, "00" del giorno dopo è l'ultima ora del giorno. ARPAV non lo dichiara. Indizi letti
//   il 15/11/2026: il file esportato alle 11:40 ha come ultima voce l'ora 11, che a quell'ora
//   non può essere l'ora che comincia alle 11; la tabella validata numera le ore da 1 a 24.
//   Le medie su 8 ore di un giorno sono quindi quelle che finiscono dall'ora 01 del giorno
//   all'ora 00 del giorno dopo. Se la convenzione fosse l'altra, le finestre si spostano di un'ora.
//
// Parole: il 50 del PM10 e il 120 dell'ozono qui si chiamano sempre «valore di riferimento»,
// come nella pagina ARPAV sul calcolo. Non si scrive «limite superato»: per dire che cosa
// prevede la legge serve prima leggere e citare la norma.

import type { DatiAria, PuntoSerieAria } from '../types';

export type ClasseAria = 'buona' | 'accettabile' | 'mediocre' | 'scadente' | 'pessima';
export type InquinanteGiudizio = 'pm10' | 'ozono';

export interface FasciaAria {
  classe: ClasseAria;
  /** Parola da mostrare, minuscola: "buona". */
  etichetta: string;
  /** Il rapporto con il valore di riferimento (in percento) arriva fino a qui, compreso. */
  finoA: number;
  /** Cosa vuol dire, in parole semplici (dal testo di ARPAV). */
  significato: string;
}

/** L'unica tabella delle soglie: dalla classe migliore alla peggiore. Fonti nel commento in testa. */
export const SCALA_ARIA: readonly FasciaAria[] = [
  { classe: 'buona', etichetta: 'buona', finoA: 50, significato: 'fino a metà del valore di riferimento' },
  { classe: 'accettabile', etichetta: 'accettabile', finoA: 100, significato: 'entro il valore di riferimento' },
  { classe: 'mediocre', etichetta: 'mediocre', finoA: 150, significato: 'sopra il riferimento, fino a una volta e mezzo' },
  { classe: 'scadente', etichetta: 'scadente', finoA: 200, significato: 'sopra il riferimento, fino al doppio' },
  { classe: 'pessima', etichetta: 'pessima', finoA: Infinity, significato: 'oltre il doppio del riferimento' },
];

/** Valore di riferimento usato da ARPAV per l'indice, in µg/m³, e la grandezza a cui si applica. */
export const RIFERIMENTI_ARIA: Readonly<Record<InquinanteGiudizio, { nome: string; soglia: number; grandezza: string; cosa: string }>> = {
  pm10: { nome: 'Polveri PM10', soglia: 50, grandezza: 'media del giorno', cosa: 'valore di riferimento' },
  ozono: { nome: 'Ozono', soglia: 120, grandezza: 'media più alta su 8 ore', cosa: 'valore di riferimento' },
};

export const UNITA_ARIA = 'µg/m³';

/** Pagine ARPAV da citare accanto al giudizio: la scala, il calcolo, i dati validati con l'indice ufficiale. */
export const PAGINE_ARPAV_ARIA = {
  scala: 'https://www.arpa.veneto.it/temi-ambientali/aria/iqa/indice',
  calcolo: 'https://www.arpa.veneto.it/temi-ambientali/aria/iqa/indice-qualita-dellaria-approfondimenti',
  ufficiale: 'https://www.arpa.veneto.it/dati-ambientali/dati-storici/aria/qualita-aria-dati-validati',
} as const;

/** Dati minimi per l'ozono: ore in una media su 8, medie valide in un giorno. */
const ORE_FINESTRA = 8;
const ORE_MINIME = 6;
const MEDIE_MINIME = 18;
const ORA_MS = 3600_000;

export interface ValoreGiudizio {
  /** Concentrazione arrotondata all'intero, in µg/m³: è quella su cui si giudica. */
  valore: number;
  /** Concentrazione prima dell'arrotondamento: serve a spiegare perché il numero è diverso da quello delle misure. */
  misurato: number;
  /** Rapporto con il valore di riferimento, in percento (quello che ARPAV chiama sottoindice). */
  rapporto: number;
  classe: ClasseAria;
}

export interface GiudizioAria {
  classe: ClasseAria;
  etichetta: string;
  /**
   * Giorno a cui si riferisce, "2026-11-14". Questa funzione non sa che giorno è oggi: che il
   * giorno sia finito (mai oggi) lo controlla chi mostra il giudizio, con `tempoGiudizio`.
   */
  giorno: string;
  /** L'inquinante più vicino al suo valore di riferimento (o più oltre): è lui che decide. A parità, il PM10. */
  decide: InquinanteGiudizio;
  /** Concentrazione dell'inquinante che decide, arrotondata all'intero. */
  valore: number;
  unita: string;
  /** Una riga in parole semplici su cosa vuol dire il giudizio. */
  spiegazione: string;
  pm10: ValoreGiudizio;
  ozono: ValoreGiudizio;
}

/**
 * La classe per un rapporto con il valore di riferimento (in percento).
 * null se il rapporto non è un numero vero (non finito, o negativo): un dato rotto non diventa
 * mai una parola, tanto meno la peggiore.
 */
export function classeDaRapporto(rapporto: number): FasciaAria | null {
  if (typeof rapporto !== 'number' || !Number.isFinite(rapporto) || rapporto < 0) return null;
  return SCALA_ARIA.find((f) => rapporto <= f.finoA) ?? null;
}

function valuta(concentrazione: number, inquinante: InquinanteGiudizio): ValoreGiudizio | null {
  const valore = Math.round(concentrazione);
  const rapporto = (valore / RIFERIMENTI_ARIA[inquinante].soglia) * 100;
  const fascia = classeDaRapporto(rapporto);
  return fascia ? { valore, misurato: concentrazione, rapporto, classe: fascia.classe } : null;
}

const GIORNO = /^\d{4}-\d{2}-\d{2}$/;
const ORA = /^(\d{4}-\d{2}-\d{2})T(\d{2}):\d{2}/;

function valido(p: PuntoSerieAria | null | undefined): p is PuntoSerieAria {
  return !!p && typeof p.quando === 'string' && typeof p.valore === 'number' && Number.isFinite(p.valore) && p.valore >= 0;
}

/** L'ultima media giornaliera di PM10 con una data leggibile. */
function ultimoPm10(serie: unknown): PuntoSerieAria | null {
  if (!Array.isArray(serie)) return null;
  let ultimo: PuntoSerieAria | null = null;
  for (const p of serie as PuntoSerieAria[]) {
    if (!valido(p) || !GIORNO.test(p.quando) || Number.isNaN(Date.parse(`${p.quando}T00:00:00Z`))) continue;
    if (!ultimo || p.quando > ultimo.quando) ultimo = p;
  }
  return ultimo;
}

/**
 * Ozono: la più alta delle medie mobili su 8 ore del giorno. L'ora scritta è la fine dell'ora
 * di misura: le 24 medie del giorno sono quelle che finiscono dall'ora scritta 01 del giorno
 * all'ora scritta 00 del giorno dopo. Ognuna è la media di quell'ora e delle 7 precedenti: la
 * prima va dalle 17 del giorno prima all'una, l'ultima dalle 16 alle 24. La finestra che
 * finisce all'ora scritta 00 del giorno sta tutta nel giorno prima e non conta.
 * null se i dati non bastano: meno di 18 medie valide, ognuna con almeno 6 ore su 8.
 * Le date sono senza fuso e si confrontano tali e quali.
 */
export function massimaMedia8Ore(serie: unknown, giorno: string): number | null {
  if (!Array.isArray(serie) || !GIORNO.test(giorno)) return null;
  const inizio = Date.parse(`${giorno}T00:00:00Z`);
  if (Number.isNaN(inizio)) return null;
  const perOra = new Map<number, number>();
  for (const p of serie as PuntoSerieAria[]) {
    if (!valido(p)) continue;
    const m = ORA.exec(p.quando);
    if (!m) continue;
    const t = Date.parse(`${m[1]}T${m[2]}:00:00Z`);
    if (!Number.isNaN(t)) perOra.set(t, p.valore);
  }
  let massimo = -Infinity;
  let medieValide = 0;
  for (let h = 1; h <= 24; h++) {
    const fine = inizio + h * ORA_MS;
    let somma = 0;
    let quante = 0;
    for (let k = 0; k < ORE_FINESTRA; k++) {
      const v = perOra.get(fine - k * ORA_MS);
      if (v === undefined) continue;
      somma += v;
      quante++;
    }
    if (quante < ORE_MINIME) continue;
    medieValide++;
    massimo = Math.max(massimo, somma / quante);
  }
  return medieValide >= MEDIE_MINIME ? massimo : null;
}

function spiega(classe: ClasseAria, decide: InquinanteGiudizio): string {
  const chi = decide === 'pm10' ? 'Le polveri PM10 erano' : "L'ozono era";
  switch (classe) {
    case 'buona':
      return 'Polveri PM10 e ozono erano tutti e due entro la metà del loro valore di riferimento.';
    case 'accettabile':
      return "Né le polveri PM10 né l'ozono erano sopra il loro valore di riferimento.";
    case 'mediocre':
      return `${chi} sopra il valore di riferimento, entro una volta e mezzo.`;
    case 'scadente':
      return `${chi} sopra il valore di riferimento, entro il doppio.`;
    case 'pessima':
      return `${chi} oltre il doppio del valore di riferimento.`;
  }
}

/**
 * Il giudizio per l'ultimo giorno intero della fotografia: il giorno dell'ultima media
 * giornaliera di PM10, con l'ozono dello stesso giorno. Vale il peggiore dei due.
 * null quando i dati non bastano (manca il PM10, o l'ozono di quel giorno non è completo):
 * in quel caso non si dà nessuna parola.
 */
export function giudizioAria(dati: Pick<DatiAria, 'serie'> | null | undefined): GiudizioAria | null {
  const serie = dati?.serie;
  if (!serie || typeof serie !== 'object') return null;
  const polveri = ultimoPm10(serie.pm10Giornaliero);
  if (!polveri) return null;
  const mediaOzono = massimaMedia8Ore(serie.ozonoOrario, polveri.quando);
  if (mediaOzono === null) return null;

  const pm10 = valuta(polveri.valore, 'pm10');
  const ozono = valuta(mediaOzono, 'ozono');
  if (!pm10 || !ozono) return null;
  const decide: InquinanteGiudizio = ozono.rapporto > pm10.rapporto ? 'ozono' : 'pm10';
  const peggiore = decide === 'ozono' ? ozono : pm10;
  const fascia = classeDaRapporto(peggiore.rapporto);
  if (!fascia) return null;
  return {
    classe: fascia.classe,
    etichetta: fascia.etichetta,
    giorno: polveri.quando,
    decide,
    valore: peggiore.valore,
    unita: UNITA_ARIA,
    spiegazione: spiega(fascia.classe, decide),
    pm10,
    ozono,
  };
}
