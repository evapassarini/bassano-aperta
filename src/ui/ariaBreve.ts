// Riquadro piccolo «Aria», in basso a sinistra sulla mappa: il dato principale della
// fotografia ARPAV, con unità e data. Nessun giudizio: nei dati non c'è una soglia ufficiale.

import { leggiAria } from '../live';
import { riassuntoAria } from './aiuti';
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

/** Crea il riquadro e legge subito la fotografia dell'aria. */
export function creaAriaBreve(opzioni: OpzioniAriaBreve = {}): HTMLElement {
  const adesso = opzioni.adesso ?? ((): Date => new Date());
  const corpo = el('span', { class: 'aria-breve-corpo' }, el('span', { class: 'aria-breve-riga' }, 'Aria: leggo il dato…'));

  let nodo: HTMLElement;
  if (opzioni.apri) {
    const apri = opzioni.apri;
    nodo = el(
      'button',
      { type: 'button', class: 'aria-breve' },
      corpo,
      el('span', { class: 'solo-lettori' }, `. ${NOTA_ARIA}. Apri la scheda della stazione con tutte le misure`),
    );
    nodo.addEventListener('click', () => apri());
  } else {
    nodo = el('div', { class: 'aria-breve' }, corpo, el('span', { class: 'solo-lettori' }, `. ${NOTA_ARIA}`));
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
      corpo.replaceChildren(
        el(
          'span',
          { class: 'aria-breve-testa' },
          'Aria · ARPAV',
          r.fotoVecchia ? el('span', { class: 'aria-breve-foto' }, ` · ${r.fotoVecchia}`) : null,
        ),
        // Lo spazio serve a chi ascolta: senza, le due righe si attaccano.
        ' ',
        el(
          'span',
          { class: 'aria-breve-riga' },
          `${r.nome} `,
          el('strong', { class: 'aria-breve-valore' }, r.valore),
          r.unita ? ` ${r.unita}` : null,
          r.quando ? el('span', { class: 'aria-breve-quando' }, ` · ${r.quando}`) : null,
        ),
      );
    },
    () => {
      nodo.removeAttribute('aria-busy');
      mancante(ARIA_NON_DISPONIBILE);
    },
  );

  return nodo;
}
