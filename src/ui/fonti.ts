// Finestra "Fonti e licenze": da dove viene ogni cosa, con che licenza e di quando è.

import type { DatiStrati } from '../types';
import { leggiAria, leggiAvvisi, leggiDataStazioni } from '../live';
import { formattaDataOraLunga, urlSicuro } from './aiuti';
import { el, icona, idUnico, linkEsterno, soli } from './dom';

export interface OpzioniFonti {
  strati: DatiStrati;
  /** Data di generazione della mappa di base (base.json), se chi avvia la conosce. */
  baseGenerato?: string;
  /** Dove segnalare un errore (pagina delle segnalazioni del progetto), se esiste. */
  segnalazioni?: string;
  /** Pagina del codice sorgente, se esiste. */
  codice?: string;
}

export interface FinestraFonti {
  nodo: HTMLDialogElement;
  apri(): void;
}

function voce(titolo: string, ...corpo: (Node | string | null)[]): HTMLElement {
  const sezione = el('section', { class: 'fonti-voce' }, el('h3', null, titolo));
  for (const c of corpo) {
    if (c === null) continue;
    sezione.append(typeof c === 'string' ? el('p', null, c) : c);
  }
  return sezione;
}

/** Crea la finestra di dialogo. Le date di aria, avvisi e tabella delle stazioni si leggono solo alla prima apertura. */
export function creaFonti(opzioni: OpzioniFonti): FinestraFonti {
  const { strati } = opzioni;
  const idTitolo = idUnico('fonti');
  const chiudi = el('button', { type: 'button', class: 'bottone-tondo', 'aria-label': 'Chiudi Fonti e licenze' }, icona('chiudi', 20));

  // --- OpenStreetMap -------------------------------------------------------
  const date = el('ul', { class: 'fonti-date' });
  if (opzioni.baseGenerato) {
    date.append(el('li', null, `Mappa di base scaricata il ${formattaDataOraLunga(opzioni.baseGenerato)}.`));
  }
  if (strati.generato) {
    date.append(el('li', null, `Strati Cultura, Ambiente e Mobilità preparati il ${formattaDataOraLunga(strati.generato)}.`));
  }
  const osm = voce(
    'La mappa: OpenStreetMap',
    el(
      'p',
      null,
      'Edifici, strade, acqua, verde e i punti degli strati vengono da OpenStreetMap e sono ridisegnati dal nostro codice. ',
      linkEsterno('https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors'),
      ', licenza ODbL.',
    ),
    date.childElementCount > 0 ? date : null,
  );
  if (strati.fonti.length > 0) {
    const elenco = el('ul', { class: 'fonti-elenco' });
    for (const f of strati.fonti) {
      elenco.append(
        el(
          'li',
          null,
          urlSicuro(f.url) ? linkEsterno(f.url, f.nome) : f.nome,
          f.licenza ? el('span', { class: 'fonti-licenza' }, ` ${f.licenza}`) : null,
        ),
      );
    }
    osm.append(el('p', { class: 'fonti-sotto' }, 'Fonti degli strati:'), elenco);
  }

  // --- ARPAV ---------------------------------------------------------------
  const ariaQuando = el('li', null, "Qualità dell'aria: leggo la data della fotografia…");
  const arpav = voce(
    'I dati ambientali: ARPAV',
    el(
      'p',
      null,
      "Il livello e la portata del Brenta e le misure della qualità dell'aria sono di ARPAV, l'agenzia per l'ambiente del Veneto. ",
      el('strong', null, 'Fonte: ARPAV, dati non validati.'),
    ),
    el(
      'ul',
      { class: 'fonti-date' },
      el(
        'li',
        null,
        'Brenta: letto in diretta dal tuo browser ogni volta che apri il riquadro, stazione Brenta a Barzizza, circa 1 km a monte del Ponte Vecchio. ',
        linkEsterno(
          'https://www.arpa.veneto.it/dati-ambientali/dati-in-diretta/meteo-idro-nivo/variabili_idro',
          'Pagina ARPAV dei dati idrometrici',
        ),
        '.',
      ),
      ariaQuando,
    ),
  );

  // --- Treni ---------------------------------------------------------------
  const stazioniQuando = el('li', null, 'I nomi delle stazioni vengono dagli orari di Trenitalia distribuiti da BusOne: leggo la data della tabella…');
  const treni = voce(
    'I treni: BusOne e Trenitalia',
    el(
      'p',
      null,
      'I prossimi treni alla stazione di Bassano sono letti in diretta dal tuo browser, ogni volta che apri la scheda della stazione, dal servizio ',
      linkEsterno('https://busone.app', 'BusOne (busone.app)'),
      ', che rielabora i dati di Trenitalia, la fonte originale.',
    ),
    el(
      'ul',
      { class: 'fonti-date' },
      el('li', null, "Sono i ritardi dichiarati dall'operatore, rielaborati da BusOne: non è un servizio ufficiale. Per partire controlla i canali di Trenitalia."),
      el('li', null, "Condizioni di BusOne: uso gratuito e non commerciale, per privati ed enti non profit, con l'obbligo di citare BusOne e la fonte originale. BusOne può sospendere il servizio."),
      el('li', null, 'Le posizioni dei treni lungo la linea, che in quei dati sono stime, qui non si mostrano.'),
      el('li', null, "L'elenco può non essere completo: i dati contengono solo i treni seguiti in diretta, e un treno soppresso può non comparire."),
      el('li', null, "L'ora scritta accanto a ogni treno è quella dell'orario ufficiale; con un ritardo o un anticipo c'è anche l'ora prevista."),
      stazioniQuando,
    ),
  );

  // --- Avvisi sulla viabilità ----------------------------------------------
  const avvisiQuando = el('li', null, 'Leggo la data della fotografia…');
  const viabilita = voce(
    'Gli avvisi sulla viabilità: CCISS e Vi.abilità',
    el(
      'p',
      null,
      'Gli eventi di traffico vengono da ',
      linkEsterno('https://www.cciss.it/', 'CCISS Viaggiare Informati'),
      ', le ordinanze sulle strade provinciali da ',
      linkEsterno('https://vi-abilita.it/', 'Vi.abilità (Provincia di Vicenza)'),
      '.',
    ),
    el(
      'ul',
      { class: 'fonti-date' },
      el('li', null, 'Nessuna delle due fonti dichiara una licenza: riportiamo solo citazioni brevi, ognuna con il link alla pagina della fonte.'),
      el('li', null, 'Non è il traffico in tempo reale: è una fotografia scaricata di tanto in tanto.'),
      avvisiQuando,
    ),
  );

  // --- Media ---------------------------------------------------------------
  const commons = voce(
    'Immagini e audio: Wikimedia Commons',
    el(
      'p',
      null,
      'Fotografie, stampe e registrazioni vengono da ',
      linkEsterno('https://commons.wikimedia.org/', 'Wikimedia Commons'),
      '. Ogni file ha la sua licenza: la trovi scritta sotto ciascuna immagine o registrazione, con autore e link alla pagina del file.',
    ),
  );
  const youtube = voce(
    'Video: YouTube',
    'I video restano su YouTube e appartengono a chi li ha pubblicati. Li incorporiamo dal dominio youtube-nocookie.com e solo dopo il tuo clic su «Carica il video da YouTube»: prima di quel clic YouTube non riceve nulla.',
  );

  // --- Codice e caratteri ---------------------------------------------------
  const codice = voce(
    'Il codice: licenza MIT',
    el(
      'p',
      null,
      'Bassano Aperta è un progetto civico a codice aperto, con licenza MIT: chiunque può leggerlo, copiarlo e migliorarlo. ',
      opzioni.codice && urlSicuro(opzioni.codice) ? linkEsterno(opzioni.codice, 'Vai al codice') : null,
    ),
    'I caratteri sono Fraunces e Inter, con licenza SIL Open Font License, serviti da questo sito e non da server esterni.',
  );

  // --- Testi ---------------------------------------------------------------
  const testi = voce(
    'I testi: fatti con cura, ma possono sbagliare',
    'I racconti storici sono stati compilati nel novembre 2026 a partire da fonti pubbliche, indicate tappa per tappa. Non sono il lavoro di uno storico e possono contenere errori. Dove le fonti non concordano non abbiamo scelto: lo diciamo.',
    el(
      'p',
      null,
      'Se trovi un errore o conosci una fonte migliore, segnalacelo: correggere è parte del progetto. ',
      opzioni.segnalazioni && urlSicuro(opzioni.segnalazioni)
        ? linkEsterno(opzioni.segnalazioni, 'Segnala un errore')
        : null,
    ),
    'Bassano del Grappa è candidata a Capitale italiana della Cultura 2029. Questo sito non è un sito ufficiale del Comune né della candidatura.',
  );

  const nodo = el(
    'dialog',
    { class: 'fonti', 'aria-labelledby': idTitolo },
    el('div', { class: 'fonti-testata' }, el('h2', { id: idTitolo, tabindex: '-1' }, 'Fonti e licenze'), chiudi),
    el('div', { class: 'fonti-corpo' }, osm, arpav, treni, viabilita, commons, youtube, codice, testi),
  );

  chiudi.addEventListener('click', () => nodo.close());
  // Clic sullo sfondo scuro: chiude.
  nodo.addEventListener('click', (e) => {
    if (e.target === nodo) nodo.close();
  });

  let avvisiChiesti = false;
  const chiediAvvisi = (): void => {
    if (avvisiChiesti) return;
    avvisiChiesti = true;
    leggiAvvisi().then(
      (dati) => {
        avvisiQuando.textContent = `Fotografia del ${formattaDataOraLunga(dati.generato)}.`;
      },
      () => {
        avvisiChiesti = false;
        avvisiQuando.textContent = 'La fotografia degli avvisi non è disponibile in questo momento.';
      },
    );
  };

  const NOMI_STAZIONI = 'I nomi delle stazioni vengono dagli orari di Trenitalia distribuiti da BusOne';
  let stazioniChieste = false;
  const chiediStazioni = (): void => {
    if (stazioniChieste) return;
    stazioniChieste = true;
    leggiDataStazioni().then(
      (generato) => {
        stazioniQuando.textContent = `${NOMI_STAZIONI}: tabella del ${formattaDataOraLunga(generato)}.`;
      },
      () => {
        stazioniChieste = false;
        stazioniQuando.textContent = `${NOMI_STAZIONI}. La data della tabella non è disponibile in questo momento.`;
      },
    );
  };

  let ariaChiesta = false;
  const apri = (): void => {
    if (!nodo.open) nodo.showModal();
    nodo.querySelector<HTMLElement>('h2')?.focus();
    chiediAvvisi();
    chiediStazioni();
    if (ariaChiesta) return;
    ariaChiesta = true;
    leggiAria().then(
      (dati) => {
        ariaQuando.replaceChildren(...soli(
          `Qualità dell'aria: fotografia del ${formattaDataOraLunga(dati.generato)}`,
          dati.stazione ? `, stazione ${dati.stazione}. ` : '. ',
          dati.fonte?.url ? linkEsterno(dati.fonte.url, dati.fonte.nome || 'ARPAV') : null,
          dati.fonte?.licenza ? el('span', { class: 'fonti-licenza' }, ` ${dati.fonte.licenza}`) : null,
        ));
      },
      () => {
        ariaChiesta = false;
        ariaQuando.textContent = "Qualità dell'aria: la fotografia non è disponibile in questo momento.";
      },
    );
  };

  return { nodo, apri };
}
