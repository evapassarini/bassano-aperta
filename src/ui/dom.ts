// Piccoli attrezzi per costruire il DOM a mano, senza framework.

import { urlSicuro } from './aiuti';

type Figlio = Node | string | null | undefined | false;
type Attributi = Record<string, string | boolean | undefined | null>;

/** Crea un elemento. `class` è la classe; i valori true diventano attributi vuoti. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributi?: Attributi | null,
  ...figli: Figlio[]
): HTMLElementTagNameMap[K] {
  const nodo = document.createElement(tag);
  if (attributi) {
    for (const [nome, valore] of Object.entries(attributi)) {
      if (valore === undefined || valore === null || valore === false) continue;
      nodo.setAttribute(nome, valore === true ? '' : valore);
    }
  }
  for (const f of figli) {
    if (f === null || f === undefined || f === false) continue;
    nodo.append(f);
  }
  return nodo;
}

const SVG = 'http://www.w3.org/2000/svg';

/** Crea un elemento SVG. */
export function svg(tag: string, attributi: Record<string, string | number> = {}, ...figli: Node[]): SVGElement {
  const nodo = document.createElementNS(SVG, tag);
  for (const [nome, valore] of Object.entries(attributi)) nodo.setAttribute(nome, String(valore));
  for (const f of figli) nodo.append(f);
  return nodo;
}

const DISEGNI: Record<string, string> = {
  chiudi: 'M5 5l14 14M19 5L5 19',
  esterno: 'M9 5H5v14h14v-4M13 5h6v6M19 5l-9 9',
  cerca: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13zM15.5 15.5L20 20',
  avvia: 'M8 5.5v13l11-6.5z',
  elenco: 'M4 7h16M4 12h16M4 17h10',
  su: 'M12 19V6M6 12l6-6l6 6',
  giu: 'M12 5v13M6 12l6 6l6-6',
  pari: 'M5 9h14M5 15h14',
  piu: 'M12 5v14M5 12h14',
  meno: 'M5 12h14',
};

/** Icona al tratto, decorativa (nascosta ai lettori di schermo). */
export function icona(nome: keyof typeof DISEGNI | string, lato = 18): SVGElement {
  return svg(
    'svg',
    {
      class: `icona icona-${nome}`,
      viewBox: '0 0 24 24',
      width: lato,
      height: lato,
      fill: nome === 'avvia' ? 'currentColor' : 'none',
      stroke: 'currentColor',
      'stroke-width': nome === 'avvia' ? 0 : 1.8,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    svg('path', { d: DISEGNI[nome] ?? '' }),
  );
}

/** Segno di uno strato: cerchio per Cultura, rombo per Ambiente, quadrato per Mobilità. */
export function segnoStrato(id: 'cultura' | 'ambiente' | 'mobilita', lato = 16): SVGElement {
  const forma =
    id === 'cultura'
      ? svg('circle', { cx: 8, cy: 8, r: 6 })
      : id === 'ambiente'
        ? svg('path', { d: 'M8 1.2L14.8 8L8 14.8L1.2 8z' })
        : svg('rect', { x: 2.2, y: 2.2, width: 11.6, height: 11.6, rx: 1.6 });
  return svg(
    'svg',
    { class: `segno segno-${id}`, viewBox: '0 0 16 16', width: lato, height: lato, 'aria-hidden': 'true', focusable: 'false' },
    forma,
  );
}

/** Link verso un altro sito: scheda nuova, senza referrer, con l'avviso per chi non vede. */
export function linkEsterno(url: string, testo: string, classe?: string, perLettori?: string): HTMLElement {
  const sicuro = urlSicuro(url);
  if (!sicuro) return el('span', { class: classe }, testo);
  return el(
    'a',
    { class: classe ? `esterno ${classe}` : 'esterno', href: sicuro, target: '_blank', rel: 'noopener noreferrer' },
    el('span', null, testo),
    // Per chi ascolta: distingue tra loro i link che a vista hanno lo stesso testo.
    perLettori ? el('span', { class: 'solo-lettori' }, perLettori) : null,
    icona('esterno', 14),
    el('span', { class: 'solo-lettori' }, ' (si apre in una nuova scheda)'),
  );
}

/**
 * Da chiamare prima di sostituire i figli di `contenitore` (che deve avere tabindex="-1").
 * Se il fuoco sta su uno dei figli, per esempio sul bottone «Riprova» appena premuto, lo
 * sposta sul contenitore: altrimenti finirebbe sul body e chi usa la tastiera dovrebbe
 * riattraversare tutta la pagina.
 */
export function tieniFuoco(contenitore: HTMLElement): void {
  const attivo = typeof document === 'undefined' ? null : document.activeElement;
  if (!attivo || attivo === contenitore || !contenitore.contains(attivo)) return;
  contenitore.focus({ preventScroll: true });
}

/** true se chi guarda ha chiesto meno movimento. */
export function menoMovimento(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let contatore = 0;
/** Identificativo unico per collegare etichette e controlli. */
export function idUnico(prefisso: string): string {
  contatore += 1;
  return `ba-${prefisso}-${contatore}`;
}

/** Toglie i figli mancanti, per usare append e replaceChildren con pezzi facoltativi. */
export function soli(...figli: Figlio[]): (Node | string)[] {
  return figli.filter((f): f is Node | string => f !== null && f !== undefined && f !== false);
}
