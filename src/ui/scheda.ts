// Scheda breve per i punti della mappa che non hanno un racconto.

import type { Punto } from '../types';
import { NOTA_ARIA_BASE, NOTA_BRENTA_BASE, riquadroAria, riquadroBrenta, riquadroTreni } from './adesso';
import { NOME_STRATO, etichettaTipo, urlSicuro } from './aiuti';
import { el, idUnico, linkEsterno, segnoStrato } from './dom';

export interface Scheda {
  nodo: HTMLElement;
  titolo: HTMLElement;
}

function etichettaLink(punto: Punto): string {
  if (punto.tipo === 'webcam') return 'Apri la webcam sul sito esterno';
  if (punto.tipo === 'aria' || punto.tipo === 'idrometro') return 'Apri la pagina di ARPAV';
  if (punto.tipo === 'fermata-bus' || punto.tipo === 'stazione') return 'Orari sulla pagina ufficiale';
  if (punto.tipo === 'avviso') return 'Apri la mappa del CCISS';
  return 'Apri la pagina ufficiale';
}

/** Dove sta il cartello di un avviso: detto nella sua scheda. */
export const NOTA_CARTELLO =
  'Il cartello viene dalla fotografia degli avvisi, non è un dato in diretta. Sta su uno dei due incroci che delimitano il tratto indicato dal CCISS: lavori o chiusura possono essere in un punto qualsiasi del tratto.';

/**
 * Costruisce la scheda di un punto. `apriStoria` serve se il punto ha comunque un racconto;
 * `apriAvvisi`, per i cartelli degli avvisi, apre la scheda con tutti gli avvisi.
 */
export function creaScheda(punto: Punto, apriStoria?: () => void, apriAvvisi?: () => void): Scheda {
  const idTitolo = idUnico('punto');
  const titolo = el('h2', { class: 'scheda-nome', id: idTitolo, tabindex: '-1' }, punto.nome);
  const nodo = el(
    'article',
    { class: 'scheda', 'aria-labelledby': idTitolo },
    el(
      'p',
      { class: 'scheda-tipo' },
      segnoStrato(punto.strato, 14),
      el('span', null, `${etichettaTipo(punto.tipo)} · strato ${NOME_STRATO[punto.strato] ?? punto.strato}`),
    ),
    titolo,
    ...(punto.nota ? punto.nota.split('\n').filter(Boolean).map((riga) => el('p', { class: 'scheda-nota' }, riga)) : []),
  );
  if (punto.tipo === 'avviso') nodo.append(el('p', { class: 'scheda-sotto' }, NOTA_CARTELLO));

  // La nota del punto sta già sopra: nel riquadro non si ripete.
  if (punto.tipo === 'aria') nodo.append(riquadroAria(punto.nota ? '' : NOTA_ARIA_BASE));
  if (punto.tipo === 'idrometro') nodo.append(riquadroBrenta(punto.nota ? '' : NOTA_BRENTA_BASE));
  if (punto.tipo === 'stazione') nodo.append(riquadroTreni());

  const azioni = el('p', { class: 'scheda-azioni' });
  if (apriStoria) {
    const bottone = el('button', { type: 'button', class: 'bottone' }, 'Leggi il racconto');
    bottone.addEventListener('click', apriStoria);
    azioni.append(bottone);
  }
  if (punto.tipo === 'avviso' && apriAvvisi) {
    const bottone = el('button', { type: 'button', class: 'bottone' }, 'Tutti gli avvisi');
    bottone.addEventListener('click', apriAvvisi);
    azioni.append(bottone);
  }
  if (urlSicuro(punto.url)) azioni.append(linkEsterno(punto.url!, etichettaLink(punto), 'bottone bottone-link'));
  if (azioni.childElementCount > 0) nodo.append(azioni);

  return { nodo, titolo };
}
