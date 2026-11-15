// Selettore della luce della mappa: Adesso, Giorno, Pomeriggio, Notte.
// «Adesso» segue l'ora vera di Bassano e si riallinea da sola col passare del tempo.

import { luceAdesso } from '../luce';
import type { Luce, SceltaLuce } from '../types';
import { el } from './dom';

/** Dove il browser ricorda la scelta. */
export const CHIAVE_LUCE = 'ba:luce';
/** Ogni quanto «Adesso» ricontrolla l'ora. */
export const PASSO_LUCE_MS = 60_000;

const SCELTE: SceltaLuce[] = ['adesso', 'giorno', 'pomeriggio', 'notte'];
const NOME_SCELTA: Record<SceltaLuce, string> = {
  adesso: 'Adesso',
  giorno: 'Giorno',
  pomeriggio: 'Pomeriggio',
  notte: 'Notte',
};

export interface OpzioniSelettoreLuce {
  /** Chiamata all'avvio e poi ogni volta che la luce effettiva cambia. */
  alCambio: (luce: Luce) => void;
  /** Che ora è. Serve ai test; predefinito: l'ora del dispositivo. */
  adesso?: () => Date;
}

export interface SelettoreLuce {
  nodo: HTMLElement;
  /** La scelta di chi guarda. */
  scelta(): SceltaLuce;
  /** La luce che la mappa sta mostrando. */
  luce(): Luce;
  /** Ferma il controllo periodico. */
  distruggi(): void;
}

function sceltaValida(valore: unknown): valore is SceltaLuce {
  return typeof valore === 'string' && (SCELTE as string[]).includes(valore);
}

/** La scelta ricordata dal browser. Se manca, o se la memoria non si può leggere: «Adesso». */
export function leggiSceltaLuce(): SceltaLuce {
  // Solo in sviluppo: ?luce=notte nell'indirizzo blocca la mappa su quella luce (vedi
  // src/map/index.ts); il comando mostra la stessa scelta, così le schermate sono coerenti.
  if (import.meta.env?.DEV) {
    try {
      const voluta = new URLSearchParams(globalThis.location?.search ?? '').get('luce');
      if (voluta !== 'adesso' && sceltaValida(voluta)) return voluta;
    } catch {
      // Nessun indirizzo da leggere: si prosegue con la scelta ricordata.
    }
  }
  try {
    const valore = globalThis.localStorage?.getItem(CHIAVE_LUCE);
    return sceltaValida(valore) ? valore : 'adesso';
  } catch {
    return 'adesso';
  }
}

function ricordaSceltaLuce(scelta: SceltaLuce): void {
  try {
    globalThis.localStorage?.setItem(CHIAVE_LUCE, scelta);
  } catch {
    // Memoria piena o vietata (navigazione privata): la pagina funziona lo stesso.
  }
}

/**
 * Gruppo di quattro scelte esclusive. Da tastiera: Tab entra nel gruppo, le frecce cambiano
 * scelta, Inizio e Fine vanno alla prima e all'ultima.
 */
export function creaSelettoreLuce(opzioni: OpzioniSelettoreLuce): SelettoreLuce {
  const adesso = opzioni.adesso ?? ((): Date => new Date());
  const luceDi = (s: SceltaLuce): Luce => (s === 'adesso' ? luceAdesso(adesso()) : s);

  let scelta = leggiSceltaLuce();
  let luce = luceDi(scelta);

  // Sta accanto ad «Adesso» e dice quale luce è in corso: "Adesso · notte".
  const inCorso = el('span', { class: 'luce-in-corso' });
  const bottoni = new Map<SceltaLuce, HTMLButtonElement>();
  const gruppo = el('div', { class: 'luce', role: 'radiogroup', 'aria-label': 'Luce della mappa' });
  for (const s of SCELTE) {
    const bottone = el(
      'button',
      { type: 'button', class: `luce-scelta luce-scelta-${s}`, role: 'radio', 'data-luce': s },
      el('span', { class: 'luce-nome' }, NOME_SCELTA[s]),
      s === 'adesso' ? inCorso : null,
    );
    bottone.addEventListener('click', () => scegli(s));
    bottoni.set(s, bottone);
    gruppo.append(bottone);
  }

  const aggiorna = (): void => {
    for (const [s, bottone] of bottoni) {
      const scelto = s === scelta;
      bottone.setAttribute('aria-checked', String(scelto));
      // Un solo bottone nel giro di Tab: gli altri si raggiungono con le frecce.
      bottone.setAttribute('tabindex', scelto ? '0' : '-1');
    }
    inCorso.replaceChildren(
      ...(scelta === 'adesso' ? [el('span', { class: 'luce-punto' }, ' · '), el('span', { class: 'luce-ora' }, luce)] : []),
    );
  };

  /** Ricalcola la luce e avvisa solo se è cambiata davvero. */
  const applica = (): void => {
    const nuova = luceDi(scelta);
    const cambiata = nuova !== luce;
    luce = nuova;
    aggiorna();
    if (cambiata) opzioni.alCambio(luce);
  };

  function scegli(nuova: SceltaLuce): void {
    if (nuova !== scelta) {
      scelta = nuova;
      ricordaSceltaLuce(scelta);
    }
    applica();
  }

  gruppo.addEventListener('keydown', (evento: KeyboardEvent) => {
    const qui = SCELTE.indexOf(scelta);
    let verso: number;
    if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') verso = (qui + 1) % SCELTE.length;
    else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') verso = (qui + SCELTE.length - 1) % SCELTE.length;
    else if (evento.key === 'Home') verso = 0;
    else if (evento.key === 'End') verso = SCELTE.length - 1;
    else return;
    evento.preventDefault();
    scegli(SCELTE[verso]);
    bottoni.get(SCELTE[verso])?.focus({ preventScroll: true });
  });

  // Con «Adesso» l'ora si ricontrolla ogni minuto, e subito quando la scheda torna visibile
  // (in secondo piano i browser rallentano i timer).
  const controlla = (): void => {
    if (scelta === 'adesso') applica();
  };
  const timer = setInterval(controlla, PASSO_LUCE_MS);
  const alRitorno = (): void => {
    if (document.visibilityState !== 'hidden') controlla();
  };
  const ascoltaPagina = typeof document !== 'undefined' && typeof document.addEventListener === 'function';
  if (ascoltaPagina) document.addEventListener('visibilitychange', alRitorno);

  aggiorna();
  opzioni.alCambio(luce);

  return {
    nodo: gruppo,
    scelta: () => scelta,
    luce: () => luce,
    distruggi: () => {
      clearInterval(timer);
      if (ascoltaPagina) document.removeEventListener('visibilitychange', alRitorno);
    },
  };
}
