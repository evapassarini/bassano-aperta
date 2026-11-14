// Riquadri "Adesso": il livello del Brenta in diretta, la fotografia dell'aria, i link
// alle pagine ufficiali. Se un dato non arriva lo si dice, senza numeri inventati.

import type { DatiAria, Live } from '../types';
import { leggiAria, leggiBrenta } from '../live';
import type { LetturaBrenta } from '../live';
import { etaInOre, millisDi, tendenza } from '../live/brenta';
import {
  descriviDurata,
  formattaDataOra,
  formattaDataOraLunga,
  formattaLivello,
  formattaMisura,
  formattaNumero,
  formattaPortata,
  parolaTendenza,
  tracciaSerie,
} from './aiuti';
import { el, icona, linkEsterno, soli, svg } from './dom';

const PAGINA_ARPAV_IDRO =
  'https://www.arpa.veneto.it/dati-ambientali/dati-in-diretta/meteo-idro-nivo/variabili_idro';
const ATTRIBUZIONE = 'Fonte: ARPAV, dati non validati';

export const NOTA_BRENTA_BASE =
  "Il livello è misurato dall'idrometro ARPAV di Barzizza, circa 1 km a monte del Ponte Vecchio: non è il livello sotto il ponte. I dati non sono validati.";
export const NOTA_ARIA_BASE =
  "Le misure vengono dalla centralina ARPAV di Bassano. Non sono in diretta: è una fotografia scaricata di tanto in tanto.";

function intestazione(titolo: string, dettaglio?: string): HTMLElement {
  return el(
    'p',
    { class: 'adesso-nome' },
    el('strong', null, titolo),
    dettaglio ? el('span', { class: 'adesso-dove' }, dettaglio) : null,
  );
}

function attesa(testo: string): HTMLElement {
  return el('p', { class: 'adesso-attesa' }, el('span', { class: 'adesso-puntino', 'aria-hidden': 'true' }), testo);
}

// ---------------------------------------------------------------------------
// Brenta
// ---------------------------------------------------------------------------

function grafico(lettura: LetturaBrenta): HTMLElement | null {
  const L = 280;
  const A = 56;
  const traccia = tracciaSerie(lettura.serie.map((p) => p.livello), L, A, 5);
  if (!traccia) return null;
  const primo = lettura.serie[0];
  const ore = (millisDi(lettura.quando) - millisDi(primo.quando)) / 3600_000;
  const durata = descriviDurata(ore);
  const descrizione = `${durata}: minimo ${formattaLivello(traccia.minimo)}, massimo ${formattaLivello(traccia.massimo)}`;
  const disegno = svg(
    'svg',
    {
      class: 'andamento-disegno',
      viewBox: `0 0 ${L} ${A}`,
      preserveAspectRatio: 'none',
      role: 'img',
      'aria-label': `Andamento del livello. ${descrizione}.`,
    },
    svg('path', { class: 'andamento-area', d: traccia.area }),
    svg('path', { class: 'andamento-linea', d: traccia.linea, 'vector-effect': 'non-scaling-stroke' }),
  );
  // Il punto finale sta fuori dall'SVG stirato, così resta tondo a ogni larghezza.
  const punto = el('span', { class: 'andamento-punto', 'aria-hidden': 'true' });
  punto.style.left = `${(traccia.ultimo.x / L) * 100}%`;
  punto.style.top = `${(traccia.ultimo.y / A) * 100}%`;
  return el(
    'figure',
    { class: 'andamento' },
    el('div', { class: 'andamento-cornice' }, disegno, punto),
    el(
      'figcaption',
      null,
      el('span', null, durata),
      el('span', null, `min ${formattaLivello(traccia.minimo)} · max ${formattaLivello(traccia.massimo)}`),
    ),
  );
}

function mostraBrenta(stato: HTMLElement, lettura: LetturaBrenta): void {
  const t = tendenza(lettura.serie);
  const frase = parolaTendenza(t);
  const vecchia = etaInOre(lettura.quando) > 6;
  stato.replaceChildren(...soli(
    el(
      'p',
      { class: 'lettura' },
      el('span', { class: 'lettura-valore' }, formattaNumero(lettura.livello, 2)),
      el('span', { class: 'lettura-unita' }, ' m'),
      lettura.portata !== null
        ? el('span', { class: 'lettura-portata' }, `portata ${formattaPortata(lettura.portata)}`)
        : null,
    ),
    el('p', { class: 'lettura-quando' }, `Lettura di ${formattaDataOra(lettura.quando)}`),
    vecchia
      ? el('p', { class: 'lettura-avviso' }, "Attenzione: l'ultima lettura disponibile non è recente.")
      : null,
    frase && t
      ? el(
          'p',
          { class: `tendenza tendenza-${t.verso}` },
          icona(t.verso === 'sale' ? 'su' : t.verso === 'scende' ? 'giu' : 'pari', 16),
          frase,
        )
      : null,
    grafico(lettura),
  ));
}

/** Riquadro con il livello del Brenta letto adesso da ARPAV. */
export function riquadroBrenta(nota: string): HTMLElement {
  const stato = el('div', { class: 'adesso-stato', 'aria-live': 'polite' });

  const carica = (): void => {
    stato.setAttribute('aria-busy', 'true');
    stato.replaceChildren(attesa('Leggo il livello del fiume…'));
    leggiBrenta().then(
      (lettura) => {
        stato.removeAttribute('aria-busy');
        mostraBrenta(stato, lettura);
      },
      () => {
        stato.removeAttribute('aria-busy');
        const riprova = el('button', { type: 'button', class: 'bottone bottone-piccolo' }, 'Riprova');
        riprova.addEventListener('click', carica);
        stato.replaceChildren(
          el(
            'p',
            { class: 'adesso-errore' },
            'In questo momento non riusciamo a leggere il livello del Brenta. Non mostriamo numeri che non abbiamo: puoi guardarlo sul sito di ARPAV.',
          ),
          riprova,
        );
      },
    );
  };
  carica();

  return el(
    'div',
    { class: 'adesso adesso-brenta' },
    intestazione('Livello del Brenta', 'stazione Brenta a Barzizza'),
    stato,
    nota ? el('p', { class: 'adesso-nota' }, nota) : null,
    el('p', { class: 'adesso-fonte' }, linkEsterno(PAGINA_ARPAV_IDRO, ATTRIBUZIONE)),
  );
}

// ---------------------------------------------------------------------------
// Aria
// ---------------------------------------------------------------------------

function mostraAria(stato: HTMLElement, dove: HTMLElement, fonte: HTMLElement, dati: DatiAria): void {
  if (dati.stazione) dove.textContent = `stazione ${dati.stazione}`;
  const quandoFoto = el(
    'p',
    { class: 'lettura-quando' },
    `Fotografia scaricata il ${formattaDataOraLunga(dati.generato)}: non è un dato in diretta.`,
  );
  if (dati.misure.length === 0) {
    stato.replaceChildren(el('p', { class: 'adesso-errore' }, 'La fotografia non contiene misure.'), quandoFoto);
  } else {
    const elenco = el('dl', { class: 'misure' });
    for (const m of dati.misure) {
      elenco.append(
        el(
          'div',
          { class: 'misura' },
          el('dt', null, m.inquinante),
          el(
            'dd',
            null,
            el('span', { class: 'misura-valore' }, formattaMisura(m.valore)),
            ` ${m.unita}`,
            el('span', { class: 'misura-quando' }, formattaDataOra(m.quando)),
          ),
        ),
      );
    }
    stato.replaceChildren(elenco, quandoFoto);
  }
  if (dati.fonte?.url) {
    const licenza = dati.fonte.licenza ? ` (${dati.fonte.licenza})` : '';
    fonte.replaceChildren(linkEsterno(dati.fonte.url, ATTRIBUZIONE + licenza));
  }
}

/** Riquadro con la fotografia della qualità dell'aria. */
export function riquadroAria(nota: string): HTMLElement {
  const stato = el('div', { class: 'adesso-stato', 'aria-live': 'polite' });
  const dove = el('span', { class: 'adesso-dove' });
  const fonte = el('p', { class: 'adesso-fonte' }, ATTRIBUZIONE);

  const carica = (): void => {
    stato.setAttribute('aria-busy', 'true');
    stato.replaceChildren(attesa("Leggo le misure dell'aria…"));
    leggiAria().then(
      (dati) => {
        stato.removeAttribute('aria-busy');
        mostraAria(stato, dove, fonte, dati);
      },
      () => {
        stato.removeAttribute('aria-busy');
        const riprova = el('button', { type: 'button', class: 'bottone bottone-piccolo' }, 'Riprova');
        riprova.addEventListener('click', carica);
        stato.replaceChildren(
          el(
            'p',
            { class: 'adesso-errore' },
            "La fotografia della qualità dell'aria non è disponibile. Non mostriamo numeri che non abbiamo.",
          ),
          riprova,
        );
      },
    );
  };
  carica();

  return el(
    'div',
    { class: 'adesso adesso-aria' },
    el('p', { class: 'adesso-nome' }, el('strong', null, "Qualità dell'aria"), dove),
    stato,
    nota ? el('p', { class: 'adesso-nota' }, nota) : null,
    fonte,
  );
}

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

function riquadroLink(etichetta: string, url: string, nota: string): HTMLElement {
  return el(
    'div',
    { class: 'adesso adesso-link' },
    el('p', { class: 'adesso-vai' }, linkEsterno(url, etichetta, 'bottone bottone-link')),
    nota ? el('p', { class: 'adesso-nota' }, nota) : null,
  );
}

/** Il riquadro giusto per una voce "live" di una storia. */
export function creaAdesso(live: Live): HTMLElement {
  if (live.tipo === 'brenta') return riquadroBrenta(live.nota);
  if (live.tipo === 'aria') return riquadroAria(live.nota);
  return riquadroLink(live.etichetta, live.url, live.nota);
}
