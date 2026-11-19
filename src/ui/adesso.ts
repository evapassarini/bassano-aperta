// Riquadri "Adesso": il livello della Brenta in diretta, i treni alla stazione, la fotografia
// dell'aria, i link alle pagine ufficiali. Se un dato non arriva, il riquadro lo scrive.

import type { DatiAria, LetturaTreni, Live } from '../types';
import { leggiAria, leggiBrenta, leggiTreni } from '../live';
import { giudizioAria, PAGINE_ARPAV_ARIA, RIFERIMENTI_ARIA, SCALA_ARIA } from '../live/giudizioAria';
import type { InquinanteGiudizio } from '../live/giudizioAria';
import type { LetturaBrenta } from '../live';
import { etaInOre, millisDi, tendenza } from '../live/brenta';
import type { RigaTreno } from './aiuti';
import {
  descriviDurata,
  formattaDataOra,
  formattaDataOraLunga,
  formattaLivello,
  formattaMisura,
  formattaNumero,
  formattaOra,
  parolaTendenza,
  tabelloneTreni,
  tempoGiudizio,
  testoPortata,
  tracciaSerie,
} from './aiuti';
import { el, icona, linkEsterno, soli, svg, tieniFuoco } from './dom';

const PAGINA_ARPAV_IDRO =
  'https://www.arpa.veneto.it/dati-ambientali/dati-in-diretta/meteo-idro-nivo/variabili_idro';
const ATTRIBUZIONE = 'Fonte: ARPAV, dati non validati';

export const NOTA_BRENTA_BASE =
  "Il livello è misurato dall'idrometro ARPAV «Brenta a Barzizza», circa 1 km a monte del Ponte Vecchio: non è il livello sotto il ponte. I dati non sono validati.";
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
        ? el('span', { class: 'lettura-portata' }, testoPortata(lettura.portata, lettura.quandoPortata, lettura.quando))
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

/** Riquadro con il livello della Brenta letto adesso da ARPAV. */
export function riquadroBrenta(nota: string): HTMLElement {
  const stato = el('div', { class: 'adesso-stato', 'aria-live': 'polite', tabindex: '-1' });

  const carica = (): void => {
    stato.setAttribute('aria-busy', 'true');
    tieniFuoco(stato);
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
            'In questo momento non riusciamo a leggere il livello della Brenta. Puoi guardarlo sul sito di ARPAV.',
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
    intestazione('Livello della Brenta', 'stazione Brenta a Barzizza'),
    stato,
    nota ? el('p', { class: 'adesso-nota' }, nota) : null,
    el('p', { class: 'adesso-fonte' }, linkEsterno(PAGINA_ARPAV_IDRO, ATTRIBUZIONE)),
  );
}

// ---------------------------------------------------------------------------
// Treni
// ---------------------------------------------------------------------------

const PAGINA_BUSONE = 'https://busone.app';
export const NOTA_TRENI =
  "Ritardi dichiarati dall'operatore, rielaborati da BusOne. Non è un servizio ufficiale: per partire controlla i canali di Trenitalia.";
/** L'ora mostrata è quella dell'orario: va detto, perché nei dati c'è invece l'ora prevista. */
export const NOTA_ORA_TRENI =
  "L'ora a sinistra è quella dell'orario ufficiale. Se c'è un ritardo o un anticipo, a destra trovi anche l'ora prevista.";
/** Il feed non è l'orario completo e le corse soppresse arrivano senza fermate. */
export const NOTA_TRENI_INCOMPLETI =
  "L'elenco può non essere completo: un treno soppresso, o senza dati in diretta, può non comparire.";

function rigaTreno(r: RigaTreno): HTMLElement {
  // Lo stato è scritto a parole: il colore lo accompagna soltanto.
  const stato = el('span', { class: `treno-stato treno-${r.tono}` });
  if (r.stato === r.statoPerEsteso) {
    stato.append(r.stato);
  } else {
    // A vista: "+7 min" e sotto "previsto alle 09:27". Per chi ascolta, la frase intera.
    stato.append(
      ...soli(
        el('span', { 'aria-hidden': 'true' }, r.stato),
        r.previsto ? el('span', { class: 'treno-previsto', 'aria-hidden': 'true' }, r.previsto) : null,
        el('span', { class: 'solo-lettori' }, r.statoPerEsteso),
      ),
    );
  }
  return el(
    'li',
    { class: r.tono === 'soppresso' ? 'treno treno-riga-soppresso' : 'treno' },
    el('span', { class: 'treno-ora' }, r.ora),
    // Lo spazio tra i due pezzi serve a chi ascolta: senza, le parole si attaccano.
    el('span', { class: 'treno-dove' }, el('span', { class: 'treno-direzione' }, r.direzione), ' ', el('span', { class: 'treno-numero' }, r.treno)),
    stato,
  );
}

function gruppoTreni(titolo: string, righe: RigaTreno[]): HTMLElement | null {
  if (righe.length === 0) return null;
  return el(
    'div',
    { class: 'treni-gruppo' },
    el('h3', { class: 'treni-titolo' }, titolo),
    el('ul', { class: 'treni' }, ...righe.map(rigaTreno)),
  );
}

const NESSUN_TRENO = 'Nei dati ricevuti non ci sono treni a Bassano nelle prossime ore.';
const TRENI_VECCHI = 'Attenzione: i dati ricevuti non sono recenti.';

/** Mostra il tabellone e restituisce la frase breve da annunciare a chi ascolta. */
function mostraTreni(stato: HTMLElement, emissione: HTMLElement, lettura: LetturaTreni): string {
  const tabellone = tabelloneTreni(lettura, new Date());
  const ora = formattaOra(lettura.quando);
  emissione.textContent = ora ? `Dati emessi da BusOne alle ${ora}.` : '';
  const quanti = tabellone.partenze.length + tabellone.arrivi.length;
  const nessuno = quanti === 0;
  stato.replaceChildren(...soli(
    tabellone.vecchio
      ? el('p', { class: 'lettura-avviso' }, TRENI_VECCHI)
      : null,
    nessuno
      ? el('p', { class: 'adesso-errore' }, NESSUN_TRENO)
      : null,
    gruppoTreni('Partenze', tabellone.partenze),
    gruppoTreni('Arrivi', tabellone.arrivi),
  ));
  const frase = nessuno ? NESSUN_TRENO : quanti === 1 ? '1 treno nelle prossime ore.' : `${quanti} treni nelle prossime ore.`;
  return tabellone.vecchio ? `${frase} ${TRENI_VECCHI}` : frase;
}

/** Riquadro con i prossimi treni alla stazione di Bassano, letti adesso dal feed di BusOne. */
export function riquadroTreni(): HTMLElement {
  // L'elenco non è una zona "viva": un lettore di schermo leggerebbe tutte le righe di fila.
  // A chi ascolta si annuncia solo una frase breve, nella riga qui sotto.
  const stato = el('div', { class: 'adesso-stato', tabindex: '-1' });
  const annuncio = el('p', { class: 'solo-lettori', role: 'status' });
  const emissione = el('span', { class: 'treni-emissione' });

  const carica = (): void => {
    stato.setAttribute('aria-busy', 'true');
    emissione.textContent = '';
    tieniFuoco(stato);
    // La scritta a vista è nascosta a chi ascolta: la stessa frase arriva dall'annuncio.
    const scritta = attesa('Leggo i prossimi treni…');
    scritta.setAttribute('aria-hidden', 'true');
    stato.replaceChildren(scritta);
    annuncio.textContent = 'Leggo i prossimi treni…';
    leggiTreni().then(
      (lettura) => {
        stato.removeAttribute('aria-busy');
        annuncio.textContent = mostraTreni(stato, emissione, lettura);
      },
      () => {
        stato.removeAttribute('aria-busy');
        annuncio.textContent = 'In questo momento non riusciamo a leggere i treni.';
        const riprova = el('button', { type: 'button', class: 'bottone bottone-piccolo' }, 'Riprova');
        riprova.addEventListener('click', carica);
        stato.replaceChildren(
          el(
            'p',
            { class: 'adesso-errore' },
            'In questo momento non riusciamo a leggere i treni. Puoi controllare orari e ritardi sui canali di Trenitalia.',
          ),
          riprova,
        );
      },
    );
  };
  carica();

  return el(
    'div',
    { class: 'adesso adesso-treni' },
    intestazione('Prossimi treni', 'stazione di Bassano del Grappa'),
    annuncio,
    stato,
    el('p', { class: 'adesso-nota' }, NOTA_ORA_TRENI),
    el('p', { class: 'adesso-nota' }, NOTA_TRENI),
    el('p', { class: 'adesso-nota' }, NOTA_TRENI_INCOMPLETI),
    el(
      'p',
      { class: 'adesso-fonte' },
      linkEsterno(PAGINA_BUSONE, 'Fonte: BusOne (busone.app) e Trenitalia'),
      ' ',
      emissione,
    ),
  );
}

// ---------------------------------------------------------------------------
// Aria
// ---------------------------------------------------------------------------

const maiuscola = (testo: string): string => testo.charAt(0).toUpperCase() + testo.slice(1);

/** Avvertenze fisse sul giudizio: di chi è, cosa guarda, a quale giorno vale, dov'è quello ufficiale. */
export const AVVERTENZE_GIUDIZIO_ARIA = [
  "Giudizio calcolato da questo sito con le fasce dell'indice di qualità dell'aria di ARPAV, su dati ARPAV non validati.",
  "Guarda solo polveri PM10 e ozono. Manca il biossido di azoto, che l'indice ufficiale considera: il giudizio ufficiale può essere peggiore del nostro. Può anche essere diverso perché ARPAV lo calcola su dati controllati.",
  "Per il giudizio i valori si arrotondano all'intero.",
  "Vale per il giorno indicato, non per adesso e non per l'anno.",
] as const;

export const GIUDIZIO_ARIA_MANCA =
  "Giudizio a parole non disponibile: servono le polveri PM10 e l'ozono di uno stesso giorno intero, già finito. Restano i numeri.";

/**
 * Il giudizio a parole nella scheda: la frase, chi decide, i due numeri usati, la scala intera
 * con la classe del giorno segnata, le avvertenze. null se i dati non bastano.
 */
function bloccoGiudizio(dati: DatiAria, adesso: Date): HTMLElement | null {
  const g = giudizioAria(dati);
  const tempo = g ? tempoGiudizio(g.giorno, adesso) : null;
  // Il giorno del giudizio deve essere già finito: non oggi e non un giorno futuro.
  if (!g || !tempo || tempo.giorniFa < 1) return null;

  const segno = (classe: string): HTMLElement => el('span', { class: `aria-segno aria-segno-${classe}`, 'aria-hidden': 'true' });
  const inizio = tempo.vecchio
    ? maiuscola(tempo.ilGiorno)
    : tempo.giorniFa === 1
      ? `Ieri, ${tempo.giorno},`
      : maiuscola(tempo.giorno);
  const frase = el(
    'p',
    { class: 'giudizio-frase', 'data-classe': g.classe },
    segno(g.classe),
    el(
      'span',
      null,
      `${inizio} l'aria alla centralina era `,
      el('strong', { class: 'giudizio-parola' }, g.etichetta),
      ' per polveri PM10 e ozono.',
    ),
  );
  const vecchio = tempo.vecchio
    ? el('p', { class: 'lettura-avviso' }, `Sono passati ${tempo.giorniFa} giorni: questo giudizio non dice com'è l'aria in questi giorni.`)
    : null;
  const senso = el(
    'p',
    { class: 'giudizio-senso' },
    `${g.spiegazione} Il giudizio lo decide il peggiore dei due: ${g.decide === 'ozono' ? "l'ozono" : 'le polveri PM10'}.`,
  );

  const riga = (quale: InquinanteGiudizio): HTMLElement => {
    const rif = RIFERIMENTI_ARIA[quale];
    // Il giudizio usa il valore arrotondato all'intero: se è diverso da quello misurato (che si
    // legge anche tra le ultime misure) lo si dice, così non restano due numeri senza spiegazione.
    const intero = formattaMisura(g[quale].valore);
    const misurato = formattaMisura(g[quale].misurato);
    return el(
      'li',
      { class: quale === g.decide ? 'giudizio-numero giudizio-decide' : 'giudizio-numero' },
      el('strong', null, `${rif.nome}: ${intero} ${g.unita}`),
      misurato === intero ? null : ` (${misurato} arrotondato)`,
      `, ${rif.grandezza} (${rif.cosa} ${rif.soglia})`,
    );
  };
  const numeri = el('ul', { class: 'giudizio-numeri' }, riga('pm10'), riga('ozono'));

  const scala = el('ol', { class: 'scala-aria', 'aria-label': 'La scala, dalla classe migliore alla peggiore' });
  for (const f of SCALA_ARIA) {
    const attuale = f.classe === g.classe;
    const voce = el(
      'li',
      { class: attuale ? 'scala-voce scala-attuale' : 'scala-voce', 'aria-current': attuale ? 'true' : null },
      segno(f.classe),
      el(
        'span',
        null,
        el('strong', null, maiuscola(f.etichetta)),
        `: ${f.significato}`,
        attuale ? el('span', { class: 'scala-qui' }, tempo.giorniFa === 1 && !tempo.vecchio ? ' · ieri' : ` · ${tempo.breve}`) : null,
      ),
    );
    scala.append(voce);
  }

  const avvertenza = el(
    'p',
    { class: 'giudizio-avvertenza' },
    `${AVVERTENZE_GIUDIZIO_ARIA.join(' ')} Non sostituisce il bollettino ufficiale: `,
    linkEsterno(PAGINE_ARPAV_ARIA.ufficiale, 'dati validati di ARPAV'),
    '. La scala: ',
    linkEsterno(PAGINE_ARPAV_ARIA.scala, "indice di qualità dell'aria di ARPAV"),
    ', ',
    linkEsterno(PAGINE_ARPAV_ARIA.calcolo, 'come si calcola'),
    '.',
  );

  return el(
    'div',
    { class: 'giudizio' },
    ...soli(frase, vecchio, senso, numeri, el('p', { class: 'giudizio-titolo' }, 'La scala'), scala, avvertenza),
  );
}

function mostraAria(stato: HTMLElement, dove: HTMLElement, fonte: HTMLElement, dati: DatiAria, adesso: Date): void {
  if (dati.stazione) dove.textContent = `stazione ${dati.stazione}`;
  const quandoFoto = el(
    'p',
    { class: 'lettura-quando' },
    `Fotografia scaricata il ${formattaDataOraLunga(dati.generato)}: non è un dato in diretta. Giorno e ora di ogni misura sono quelli scritti da ARPAV, che non indica il fuso orario.`,
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
    const giudizio = bloccoGiudizio(dati, adesso);
    stato.replaceChildren(
      giudizio ?? el('p', { class: 'giudizio-manca' }, GIUDIZIO_ARIA_MANCA),
      el('p', { class: 'giudizio-titolo' }, 'Ultime misure arrivate'),
      elenco,
      quandoFoto,
    );
  }
  if (dati.fonte?.url) {
    const licenza = dati.fonte.licenza ? ` (${dati.fonte.licenza})` : '';
    fonte.replaceChildren(linkEsterno(dati.fonte.url, ATTRIBUZIONE + licenza));
  }
}

/** Riquadro con la fotografia della qualità dell'aria. `adesso` serve ai test; predefinito: l'ora del dispositivo. */
export function riquadroAria(nota: string, adesso: () => Date = () => new Date()): HTMLElement {
  const stato = el('div', { class: 'adesso-stato', 'aria-live': 'polite', tabindex: '-1' });
  const dove = el('span', { class: 'adesso-dove' });
  const fonte = el('p', { class: 'adesso-fonte' }, ATTRIBUZIONE);

  const carica = (): void => {
    stato.setAttribute('aria-busy', 'true');
    tieniFuoco(stato);
    stato.replaceChildren(attesa("Leggo le misure dell'aria…"));
    leggiAria().then(
      (dati) => {
        stato.removeAttribute('aria-busy');
        mostraAria(stato, dove, fonte, dati, adesso());
      },
      () => {
        stato.removeAttribute('aria-busy');
        const riprova = el('button', { type: 'button', class: 'bottone bottone-piccolo' }, 'Riprova');
        riprova.addEventListener('click', carica);
        stato.replaceChildren(
          el(
            'p',
            { class: 'adesso-errore' },
            "In questo momento la fotografia della qualità dell'aria non è disponibile.",
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
