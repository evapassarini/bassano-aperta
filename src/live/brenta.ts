// Lettura del Brenta: interpreta la risposta dell'API ARPAV. Funzioni pure, con test.
//
// Forma reale della risposta (verificata il 14 novembre 2026):
//   { success: true,
//     data: [ { codice: 283, nome_stazione: "Brenta a Barzizza",
//               nome_sensore: "Livello idrometrico 1", dataora: "2026-11-12T00:10:00",
//               valore: "0.83", unitnm: "m", tipo: "LIDRO", aggiornamento: "...",
//               precisionefalda: null }, ...
//             { ..., nome_sensore: "Portata", valore: "51.79", unitnm: "m3/s", tipo: "PORT" } ],
//     meta: { total: 859, filters: [["codseqst"]] } }
// Le date non hanno fuso orario: sono l'ora della stazione così come la pubblica ARPAV.
// Qui restano tali e quali, senza conversioni.

export interface LetturaBrenta {
  /** Ultimo livello, in metri. */
  livello: number;
  /** Ultima portata in m³/s, se la stazione la pubblica vicino all'ultima lettura. */
  portata: number | null;
  /** Data e ora dell'ultimo livello, come le scrive ARPAV (senza fuso orario). */
  quando: string;
  /** Tutti i livelli ricevuti, dal più vecchio al più recente. */
  serie: { quando: string; livello: number }[];
}

export type Verso = 'sale' | 'scende' | 'stabile';

export interface Tendenza {
  verso: Verso;
  /** Differenza in metri tra l'ultima lettura e quella di confronto. */
  differenza: number;
  /** Ore che separano davvero le due letture. */
  ore: number;
}

const TIPO_LIVELLO = 'LIDRO';
const TIPO_PORTATA = 'PORT';
/** La portata vale solo se è vicina all'ultimo livello. */
const MASSIMO_SCARTO_PORTATA_MS = 60 * 60 * 1000;

/**
 * Millisecondi di una data senza fuso ("2026-11-14T23:40:00"), letta come se fosse UTC.
 * Serve solo per ordinare e fare differenze tra letture della stessa stazione.
 */
export function millisDi(dataora: string): number {
  const haFuso = /(?:Z|[+-]\d{2}:?\d{2})$/.test(dataora);
  return Date.parse(haFuso ? dataora : dataora + 'Z');
}

function comeNumero(valore: unknown): number | null {
  if (typeof valore === 'number') return Number.isFinite(valore) ? valore : null;
  if (typeof valore !== 'string' || valore.trim() === '') return null;
  const n = Number(valore.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

interface Riga {
  quando: string;
  ms: number;
  valore: number;
}

function righeDi(dati: unknown[], tipo: string): Riga[] {
  const righe: Riga[] = [];
  for (const grezza of dati) {
    if (typeof grezza !== 'object' || grezza === null) continue;
    const r = grezza as Record<string, unknown>;
    if (r.tipo !== tipo || typeof r.dataora !== 'string') continue;
    const valore = comeNumero(r.valore);
    const ms = millisDi(r.dataora);
    if (valore === null || Number.isNaN(ms)) continue;
    righe.push({ quando: r.dataora, ms, valore });
  }
  righe.sort((a, b) => a.ms - b.ms);
  return righe;
}

/**
 * Trasforma la risposta dell'API in una lettura. Lancia un errore se la risposta non ha
 * la forma attesa o non contiene nessun livello: meglio nessun numero che un numero finto.
 */
export function interpretaBrenta(risposta: unknown): LetturaBrenta {
  if (typeof risposta !== 'object' || risposta === null) {
    throw new Error('Risposta ARPAV non valida');
  }
  const r = risposta as { success?: unknown; data?: unknown };
  if (r.success === false || !Array.isArray(r.data)) {
    throw new Error('Risposta ARPAV senza dati');
  }
  const livelli = righeDi(r.data, TIPO_LIVELLO);
  if (livelli.length === 0) {
    throw new Error('Risposta ARPAV senza letture di livello');
  }
  const ultimo = livelli[livelli.length - 1];
  const portate = righeDi(r.data, TIPO_PORTATA);

  let portata: number | null = null;
  for (let i = portate.length - 1; i >= 0; i--) {
    const p = portate[i];
    if (p.ms > ultimo.ms) continue;
    if (ultimo.ms - p.ms <= MASSIMO_SCARTO_PORTATA_MS) portata = p.valore;
    break;
  }

  return {
    livello: ultimo.valore,
    portata,
    quando: ultimo.quando,
    serie: livelli.map((l) => ({ quando: l.quando, livello: l.valore })),
  };
}

/**
 * Confronta l'ultima lettura con quella di circa `ore` ore prima.
 * Sotto la soglia (2 cm) il fiume è considerato stabile. Restituisce null se la serie
 * non arriva abbastanza indietro per un confronto onesto.
 */
export function tendenza(
  serie: { quando: string; livello: number }[],
  ore = 3,
  soglia = 0.02,
): Tendenza | null {
  if (serie.length < 2) return null;
  const ultimo = serie[serie.length - 1];
  const msUltimo = millisDi(ultimo.quando);
  const bersaglio = msUltimo - ore * 3600_000;

  let confronto: { quando: string; livello: number } | null = null;
  let scartoMigliore = Infinity;
  for (let i = 0; i < serie.length - 1; i++) {
    const scarto = Math.abs(millisDi(serie[i].quando) - bersaglio);
    if (scarto < scartoMigliore) {
      scartoMigliore = scarto;
      confronto = serie[i];
    }
  }
  if (!confronto) return null;
  const oreVere = (msUltimo - millisDi(confronto.quando)) / 3600_000;
  // Il confronto deve stare tra metà e una volta e mezza l'intervallo chiesto.
  if (!(oreVere >= ore * 0.5 && oreVere <= ore * 1.5)) return null;

  const differenza = Math.round((ultimo.livello - confronto.livello) * 1000) / 1000;
  const verso: Verso = differenza >= soglia ? 'sale' : differenza <= -soglia ? 'scende' : 'stabile';
  return { verso, differenza, ore: Math.round(oreVere * 10) / 10 };
}

/**
 * Ore passate dall'ultima lettura. ARPAV pubblica l'ora senza fuso: qui si assume l'ora
 * solare italiana (UTC+1), quindi il risultato può sbagliare di un'ora. Va usato solo per
 * avvisare quando la lettura è chiaramente vecchia.
 */
export function etaInOre(quando: string, adesso: Date = new Date()): number {
  const ms = millisDi(quando) - 3600_000;
  return (adesso.getTime() - ms) / 3600_000;
}
