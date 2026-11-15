// Riquadro piccolo «Aria», in basso a sinistra sulla mappa. Per prima cosa il giudizio a
// parole (buona, accettabile, mediocre, scadente, pessima), calcolato da questo sito con le
// fasce di ARPAV (src/live/giudizioAria.ts); poi il dato principale della fotografia ARPAV,
// con unità e data. Se i dati non bastano per il giudizio restano solo i numeri.

import { leggiAria } from '../live';
import { giudizioAria } from '../live/giudizioAria';
import { riassuntoAria, tempoGiudizio } from './aiuti';
import { el } from './dom';

export interface OpzioniAriaBreve {
  /** Apre la scheda della stazione dell'aria. Senza, il riquadro non è un bottone. */
  apri?: () => void;
  /** Che ora è. Serve ai test; predefinito: l'ora del dispositivo. */
  adesso?: () => Date;
}

export const ARIA_NON_DISPONIBILE = 'Aria: dato non disponibile';
/** L'attribuzione per intero: nel riquadro c'è posto solo per «ARPAV», il resto si dice e si legge al passaggio. */
export const NOTA_ARIA = 'Fonte: ARPAV, dati non validati';
/** Quando c'è il giudizio a parole: si dice di chi è. */
export const NOTA_ARIA_GIUDIZIO =
  'Giudizio calcolato da questo sito su polveri PM10 e ozono, con dati ARPAV non validati. Non è il bollettino ufficiale';

/** Crea il riquadro e legge subito la fotografia dell'aria. */
export function creaAriaBreve(opzioni: OpzioniAriaBreve = {}): HTMLElement {
  const adesso = opzioni.adesso ?? ((): Date => new Date());
  const corpo = el('span', { class: 'aria-breve-corpo' }, el('span', { class: 'aria-breve-riga' }, 'Aria: leggo il dato…'));

  let nodo: HTMLElement;
  const coda = opzioni.apri ? '. Apri la scheda della stazione con tutte le misure' : '';
  const perLettori = el('span', { class: 'solo-lettori' }, `. ${NOTA_ARIA}${coda}`);
  if (opzioni.apri) {
    const apri = opzioni.apri;
    nodo = el('button', { type: 'button', class: 'aria-breve' }, corpo, perLettori);
    nodo.addEventListener('click', () => apri());
  } else {
    nodo = el('div', { class: 'aria-breve' }, corpo, perLettori);
  }
  nodo.setAttribute('aria-busy', 'true');
  nodo.setAttribute('title', NOTA_ARIA);

  const mancante = (testo: string): void => {
    corpo.replaceChildren(el('span', { class: 'aria-breve-riga aria-breve-manca' }, testo));
  };

  leggiAria().then(
    (dati) => {
      nodo.removeAttribute('aria-busy');
      const r = riassuntoAria(dati, adesso());
      if (!r) {
        mancante('Aria: nessuna misura nella fotografia');
        return;
      }
      const numero = el(
        'span',
        { class: 'aria-breve-riga' },
        `${r.nome} `,
        el('strong', { class: 'aria-breve-valore' }, r.valore),
        r.unita ? ` ${r.unita}` : null,
        r.quando ? el('span', { class: 'aria-breve-quando' }, ` · ${r.quando}`) : null,
      );
      const foto = r.fotoVecchia ? el('span', { class: 'aria-breve-foto' }, ` · ${r.fotoVecchia}`) : null;
      const g = giudizioAria(dati);
      const tempo = g ? tempoGiudizio(g.giorno, adesso()) : null;
      // Mai oggi: se il giorno del giudizio non è finito (o la data del dispositivo è indietro)
      // i dati non bastano, e restano solo i numeri.
      if (!g || !tempo || tempo.giorniFa < 1) {
        // Lo spazio serve a chi ascolta: senza, le due righe si attaccano.
        corpo.replaceChildren(el('span', { class: 'aria-breve-testa' }, 'Aria · ARPAV', foto), ' ', numero);
        return;
      }
      // Il giudizio è la prima cosa che si legge. La parola c'è sempre: il segno colorato
      // la accompagna, non la sostituisce. Se il giorno è vecchio la data viene prima della parola.
      const parola = el('strong', { class: 'aria-breve-parola' }, g.etichetta);
      const segno = el('span', { class: `aria-segno aria-segno-${g.classe}`, 'aria-hidden': 'true' });
      const scritta = tempo.vecchio
        ? el('span', null, `Aria ${tempo.ilGiorno}: `, parola)
        : el(
            'span',
            null,
            'Aria ',
            parola,
            el('span', { class: 'aria-breve-quando' }, tempo.giorniFa === 1 ? ' · ieri' : ` · ${tempo.breve}`),
          );
      const giudizio = el('span', { class: 'aria-breve-giudizio', 'data-classe': g.classe }, segno, scritta);
      corpo.replaceChildren(
        giudizio,
        ' ',
        numero,
        ' ',
        // Con la data della fotografia la riga andrebbe a capo: «giudizio del sito» resta nel
        // suggerimento al passaggio e nel testo per i lettori di schermo.
        el('span', { class: 'aria-breve-testa' }, foto ? 'Dati ARPAV' : 'Dati ARPAV · giudizio del sito', foto),
      );
      const nota = `${NOTA_ARIA}. ${NOTA_ARIA_GIUDIZIO}`;
      perLettori.textContent = `. ${nota}${coda}`;
      nodo.setAttribute('title', nota);
    },
    () => {
      nodo.removeAttribute('aria-busy');
      mancante(ARIA_NON_DISPONIBILE);
    },
  );

  return nodo;
}
