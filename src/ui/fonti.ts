// Finestra "Fonti e licenze": da dove viene ogni cosa, con che licenza e di quando è.

import type { DatiStrati } from '../types';
import { leggiAria, leggiAvvisi, leggiDataStazioni } from '../live';
import { PAGINE_ARPAV_ARIA } from '../live/giudizioAria';
import { formattaDataOraLunga, formattaNumero, urlSicuro } from './aiuti';
import { el, icona, idUnico, linkEsterno, soli } from './dom';

export interface OpzioniFonti {
  strati: DatiStrati;
  /** Data di generazione della mappa di base (base.json), se chi avvia la conosce. */
  baseGenerato?: string;
  /** Quanti lampioni vengono da OpenStreetMap e quanti sono in tutto (numeri scritti come testo). */
  lampioniVeri?: string;
  lampioniTutti?: string;
  /** Quanti alberi vengono da OpenStreetMap e quanti sono in tutto (numeri scritti come testo). */
  alberiVeri?: string;
  alberiTutti?: string;
  /** Dove segnalare un errore (pagina delle segnalazioni del progetto), se esiste. */
  segnalazioni?: string;
  /** Pagina del codice sorgente, se esiste. */
  codice?: string;
}

export interface FinestraFonti {
  nodo: HTMLDialogElement;
  apri(): void;
}

/**
 * Come arrivano le due fotografie (aria e avvisi): uno script le rifà più volte al giorno nel
 * repository pubblico; il browser chiede la copia su GitHub e quella pubblicata con il sito e
 * tiene la più recente. `quando` dice in quale momento parte la richiesta.
 */
function comeArrivaLaFotografia(quando: string): string {
  return `Più volte al giorno uno script prova a rifare questa fotografia e la salva nel repository pubblico del progetto su GitHub (GitHub a volte ritarda o salta un giro). ${quando} il tuo browser chiede questa fotografia a GitHub (raw.githubusercontent.com) e alla copia pubblicata con il sito, e mostra la più recente delle due. Come qualunque server, GitHub riceve l'indirizzo IP di chi visita. Se GitHub non risponde entro pochi secondi, si usa la copia del sito, che può essere più vecchia.`;
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
  const veri = Number(opzioni.lampioniVeri);
  const tutti = Number(opzioni.lampioniTutti);
  if (opzioni.lampioniVeri && opzioni.lampioniTutti && Number.isInteger(veri) && Number.isInteger(tutti) && veri >= 0 && tutti > veri) {
    osm.append(
      el(
        'p',
        null,
        veri === 0
          ? `I lampioni che si accendono di notte: i ${formattaNumero(tutti)} sulla mappa sono disposti dal nostro codice lungo le strade e sul bordo delle piazze, a scopo illustrativo. Non sono un rilievo dell'illuminazione pubblica.`
          : `I lampioni che si accendono di notte: ${formattaNumero(veri)} sono segnati su OpenStreetMap. Gli altri ${formattaNumero(tutti - veri)} sono disposti dal nostro codice lungo le strade e sul bordo delle piazze, a scopo illustrativo: non sono un rilievo dell'illuminazione pubblica.`,
      ),
    );
  }
  // Alberi: il numero si scrive solo se la mappa di base lo porta con sé.
  const alberiVeri = Number(opzioni.alberiVeri);
  const alberiTutti = Number(opzioni.alberiTutti);
  const contoAlberi =
    Boolean(opzioni.alberiVeri && opzioni.alberiTutti) &&
    Number.isInteger(alberiVeri) &&
    Number.isInteger(alberiTutti) &&
    alberiVeri > 0 &&
    alberiTutti > alberiVeri;
  osm.append(
    el(
      'p',
      null,
      contoAlberi
        ? `Gli alberi: ${formattaNumero(alberiVeri)} sono segnati su OpenStreetMap. Gli altri ${formattaNumero(alberiTutti - alberiVeri)} sono aggiunti dal nostro codice dentro boschi e parchi, a scopo illustrativo: non sono un rilievo degli alberi della città.`
        : 'Gli alberi: una parte è segnata su OpenStreetMap, una parte è aggiunta dal nostro codice dentro boschi e parchi, a scopo illustrativo. Non sono un rilievo degli alberi della città.',
    ),
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

  // --- Illustrazioni dei luoghi simbolo ---------------------------------------
  const illustrazioni = voce(
    'Le illustrazioni dei luoghi simbolo',
    'I disegni dei luoghi simbolo, come il Ponte Vecchio, sono fatti per questo progetto a partire dalle sagome degli edifici su OpenStreetMap. Altezze e dettagli sono in gran parte stime: sono illustrazioni, non rilievi.',
  );

  // --- ARPAV ---------------------------------------------------------------
  const ariaQuando = el('li', null, "Qualità dell'aria: leggo la data della fotografia…");
  const arpav = voce(
    'I dati ambientali: ARPAV',
    el(
      'p',
      null,
      "Il livello e la portata della Brenta e le misure della qualità dell'aria sono di ARPAV, l'agenzia per l'ambiente del Veneto. ",
      el('strong', null, 'Fonte: ARPAV, dati non validati.'),
    ),
    el(
      'ul',
      { class: 'fonti-date' },
      el(
        'li',
        null,
        'Livello della Brenta: letto in diretta dal tuo browser ogni volta che apri il riquadro, stazione Brenta a Barzizza, circa 1 km a monte del Ponte Vecchio. ',
        linkEsterno(
          'https://www.arpa.veneto.it/dati-ambientali/dati-in-diretta/meteo-idro-nivo/variabili_idro',
          'Pagina ARPAV dei dati idrometrici',
        ),
        '.',
      ),
      ariaQuando,
      el('li', null, comeArrivaLaFotografia('Appena apri il sito')),
      el(
        'li',
        null,
        "Il giudizio a parole sull'aria (buona, accettabile, mediocre, scadente, pessima) non è di ARPAV: lo calcola questo sito sulle polveri PM10 e sull'ozono dell'ultimo giorno intero, con le fasce dell'indice di qualità dell'aria di ARPAV. L'indice ufficiale considera anche il biossido di azoto e usa dati validati. ",
        linkEsterno(PAGINE_ARPAV_ARIA.scala, 'La scala di ARPAV'),
        ', ',
        linkEsterno(PAGINE_ARPAV_ARIA.calcolo, 'come si calcola'),
        ', ',
        linkEsterno(PAGINE_ARPAV_ARIA.ufficiale, "i dati validati con l'indice ufficiale"),
        '. Pagine lette il 15 novembre 2026.',
      ),
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
      el('li', null, comeArrivaLaFotografia('Quando apri gli avvisi o questa pagina')),
      avvisiQuando,
    ),
  );

  // --- Media ---------------------------------------------------------------
  const commons = voce(
    'Immagini: Wikimedia Commons',
    el(
      'p',
      null,
      'Fotografie e stampe vengono da ',
      linkEsterno('https://commons.wikimedia.org/', 'Wikimedia Commons'),
      '. Ogni file ha la sua licenza: la trovi scritta sotto ciascuna immagine, con autore e link alla pagina del file. Il nome di una licenza Creative Commons porta al testo della licenza.',
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
    'La licenza MIT vale solo per il codice. I testi dei racconti e le illustrazioni restano di chi cura il sito; i dati seguono le licenze delle fonti scritte qui sopra.',
    'I caratteri sono Fraunces e Inter, con licenza SIL Open Font License, serviti da questo sito e non da server esterni.',
  );

  // --- Testi ---------------------------------------------------------------
  const testi = voce(
    'I testi: fatti con cura, ma possono sbagliare',
    'I racconti storici sono stati compilati nel novembre 2026 a partire da fonti pubbliche, indicate tappa per tappa. Non sono il lavoro di uno storico e possono contenere errori. Quando un fatto viene da una sola fonte, o le fonti lo raccontano in modo diverso, lo scriviamo con «secondo ...».',
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
    el('div', { class: 'fonti-corpo' }, osm, illustrazioni, arpav, treni, viabilita, commons, youtube, codice, testi),
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
