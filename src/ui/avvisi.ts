// Scheda «Avvisi sulla viabilità»: la fotografia degli avvisi pubblicati da CCISS e da
// Vi.abilità per le strade attorno a Bassano. Non è il traffico in tempo reale: in cima,
// il riquadro «Traffico adesso» lo dice e porta ai servizi dove vederlo.

import type { Avviso, DatiAvvisi } from '../types';
import { leggiAvvisi } from '../live';
import {
  LINK_TRAFFICO,
  NOME_AVVISI,
  NOME_STRATO,
  TRAFFICO_ADESSO,
  TRAFFICO_PRIVACY,
  formattaDataOra,
  formattaDataOraLunga,
  quadroAvvisi,
  urlSicuro,
} from './aiuti';
import { el, idUnico, linkEsterno, segnoStrato, soli, tieniFuoco } from './dom';
import type { Scheda } from './scheda';

export const NOTA_AVVISI = 'Sono avvisi pubblicati dagli enti, non il traffico in tempo reale.';
export const FOTOGRAFIA_VECCHIA =
  'Attenzione: questa fotografia non è recente. Per la situazione di adesso guarda i siti delle fonti.';

function voceAvviso(a: Avviso): HTMLElement {
  return el(
    'li',
    { class: 'avviso' },
    el('h4', { class: 'avviso-strada' }, a.strada || 'Strada non indicata'),
    el('p', { class: 'avviso-testo' }, a.testo),
    el(
      'p',
      { class: 'avviso-piede' },
      el('span', null, `${formattaDataOra(a.quando)} · ${a.fonte || 'fonte non indicata'}`),
      // Dieci link con lo stesso testo non si distinguono nell'elenco dei link di un lettore
      // di schermo: a chi ascolta si dice anche la strada.
      urlSicuro(a.url) ? linkEsterno(a.url, 'Leggi alla fonte', undefined, a.strada ? `: ${a.strada}` : undefined) : null,
    ),
  );
}

/** Riquadro «Traffico adesso»: dice cosa non mostriamo e dove guardarlo. Non dipende dalla fotografia. */
export function riquadroTraffico(): HTMLElement {
  const idTitolo = idUnico('traffico');
  return el(
    'section',
    { class: 'traffico-adesso', 'aria-labelledby': idTitolo },
    el('h3', { class: 'avvisi-titolo', id: idTitolo }, 'Traffico adesso'),
    el('p', { class: 'avvisi-spiegazione' }, TRAFFICO_ADESSO),
    el(
      'ul',
      { class: 'traffico-link' },
      ...LINK_TRAFFICO.map((l) => el('li', null, linkEsterno(l.url, l.nome), el('span', { class: 'traffico-cosa' }, ` ${l.cosa}`))),
    ),
    el('p', { class: 'traffico-nota' }, TRAFFICO_PRIVACY),
  );
}

function gruppoAvvisi(titolo: string, spiegazione: string, avvisi: Avviso[]): HTMLElement | null {
  if (avvisi.length === 0) return null;
  const idTitolo = idUnico('avvisi');
  return el(
    'section',
    { class: 'avvisi-gruppo', 'aria-labelledby': idTitolo },
    el('h3', { class: 'avvisi-titolo', id: idTitolo }, titolo),
    el('p', { class: 'avvisi-spiegazione' }, spiegazione),
    el('ul', { class: 'avvisi' }, ...avvisi.map(voceAvviso)),
  );
}

/** Mostra la fotografia e restituisce la frase breve da annunciare a chi ascolta. */
function mostraAvvisi(stato: HTMLElement, dati: DatiAvvisi): string {
  const quadro = quadroAvvisi(dati, new Date());
  const { eventi, ordinanze } = quadro;
  const fonti = el('ul', { class: 'avvisi-fonti' });
  for (const f of dati.fonti) {
    fonti.append(
      el(
        'li',
        null,
        urlSicuro(f.url) ? linkEsterno(f.url, f.nome) : f.nome,
        f.licenza ? el('span', { class: 'fonti-licenza' }, ` Licenza: ${f.licenza}`) : null,
      ),
    );
  }
  stato.replaceChildren(...soli(
    el('p', { class: 'avvisi-fotografia' }, `Fotografia del ${formattaDataOraLunga(dati.generato)}.`),
    quadro.vecchia
      ? el(
          'p',
          { class: 'lettura-avviso' },
          `${FOTOGRAFIA_VECCHIA} `,
          linkEsterno('https://www.cciss.it/', 'CCISS Viaggiare Informati'),
          ' ',
          linkEsterno('https://vi-abilita.it/', 'Vi.abilità'),
        )
      : null,
    quadro.nascosti
      ? el('p', { class: 'lettura-avviso' }, `${quadro.nascosti} `, linkEsterno('https://www.cciss.it/web/cciss/situazione-della-viabilita', 'Guarda la mappa del CCISS'))
      : null,
    ...quadro.mancanti.map((f) =>
      el('p', { class: 'lettura-avviso' }, `In questa fotografia mancano ${f.cosa}: non siamo riusciti a leggere ${f.breve}. `, linkEsterno(f.url, `Guarda sul sito di ${f.breve}`)),
    ),
    eventi.length + ordinanze.length === 0 ? el('p', { class: 'avvisi-vuoto' }, quadro.vuoto) : null,
    gruppoAvvisi(
      'Eventi sulle strade',
      eventi.every((a) => a.attivo === true)
        ? 'Eventi che CCISS Viaggiare Informati segnalava nella zona di Bassano quando è stata fatta la fotografia. Alcuni possono essere lavori programmati: il testo dice quando. La data è quella di pubblicazione.'
        : 'Eventi segnalati da CCISS Viaggiare Informati nelle ultime 24 ore.',
      eventi,
    ),
    gruppoAvvisi(
      'Ordinanze degli ultimi mesi',
      'Ordinanze pubblicate da Vi.abilità negli ultimi 120 giorni, fino al giorno della fotografia, per le strade provinciali. La data è quella di pubblicazione: alcuni lavori possono essere già finiti.',
      ordinanze,
    ),
    fonti.childElementCount > 0 ? el('p', { class: 'avvisi-fonti-titolo' }, 'Fonti:') : null,
    fonti.childElementCount > 0 ? fonti : null,
  ));
  return [quadro.riassunto, quadro.vecchia ? FOTOGRAFIA_VECCHIA : '', ...quadro.mancanti.map((f) => `Mancano ${f.cosa}.`)]
    .filter(Boolean)
    .join(' ');
}

/** Costruisce la scheda e avvia la lettura di public/data/avvisi.json. */
export function creaSchedaAvvisi(): Scheda {
  const idTitolo = idUnico('avvisi');
  const titolo = el('h2', { class: 'scheda-nome', id: idTitolo, tabindex: '-1' }, NOME_AVVISI);
  // L'elenco non è una zona "viva": un lettore di schermo leggerebbe tutti gli avvisi di
  // fila. A chi ascolta si annuncia solo una frase breve, nella riga `annuncio`.
  const stato = el('div', { class: 'avvisi-stato', tabindex: '-1' });
  const annuncio = el('p', { class: 'solo-lettori', role: 'status' });

  const carica = (): void => {
    stato.setAttribute('aria-busy', 'true');
    tieniFuoco(stato);
    // La scritta a vista è nascosta a chi ascolta: la stessa frase arriva dall'annuncio.
    stato.replaceChildren(
      el(
        'p',
        { class: 'adesso-attesa', 'aria-hidden': 'true' },
        el('span', { class: 'adesso-puntino', 'aria-hidden': 'true' }),
        'Leggo gli avvisi…',
      ),
    );
    annuncio.textContent = 'Leggo gli avvisi…';
    leggiAvvisi().then(
      (dati) => {
        stato.removeAttribute('aria-busy');
        annuncio.textContent = mostraAvvisi(stato, dati);
      },
      () => {
        stato.removeAttribute('aria-busy');
        annuncio.textContent = 'La fotografia degli avvisi non è disponibile.';
        const riprova = el('button', { type: 'button', class: 'bottone bottone-piccolo' }, 'Riprova');
        riprova.addEventListener('click', carica);
        stato.replaceChildren(
          el(
            'p',
            { class: 'adesso-errore' },
            'La fotografia degli avvisi non è disponibile. Non mostriamo avvisi che non abbiamo: puoi leggerli sui siti di CCISS e di Vi.abilità.',
          ),
          el(
            'p',
            { class: 'avvisi-rimando' },
            linkEsterno('https://www.cciss.it/', 'CCISS Viaggiare Informati'),
            ' ',
            linkEsterno('https://vi-abilita.it/', 'Vi.abilità'),
          ),
          riprova,
        );
      },
    );
  };
  carica();

  const nodo = el(
    'article',
    { class: 'scheda scheda-avvisi', 'aria-labelledby': idTitolo },
    el(
      'p',
      { class: 'scheda-tipo' },
      segnoStrato('mobilita', 14),
      el('span', null, `Dati e servizi · strato ${NOME_STRATO.mobilita}`),
    ),
    titolo,
    el('p', { class: 'scheda-nota' }, NOTA_AVVISI),
    riquadroTraffico(),
    annuncio,
    stato,
  );
  return { nodo, titolo };
}
