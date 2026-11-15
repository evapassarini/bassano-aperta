// Interfaccia sopra la mappa: testata, strati, elenco dei luoghi, luce della mappa, aria,
// finestra-racconto, scheda dei punti, fonti e licenze. DOM a mano, nessun framework.

import type { DatiStrati, IdStrato, LonLat, Luce, Media, Punto, Storia } from '../types';
import { metriInLonLat } from '../map/proiezione';
import {
  NOME_AVVISI,
  NOME_STRATO,
  SOTTO_AVVISI,
  sottoPunto,
  contaRisultati,
  descriviStrato,
  dividiStorie,
  filtraPunti,
  filtraStorie,
  trovaVoceAvvisi,
  urlSicuro,
} from './aiuti';
import { creaAriaBreve } from './ariaBreve';
import { creaSchedaAvvisi } from './avvisi';
import { el, icona, idUnico, linkEsterno, segnoStrato, soli } from './dom';
import { creaFonti } from './fonti';
import { creaSelettoreLuce } from './luce';
import { creaRacconto } from './racconto';
import type { Racconto } from './racconto';
import { creaScheda } from './scheda';

export interface OpzioniUI {
  radice: HTMLElement;
  storie: Storia[];
  strati: DatiStrati;
  alCambioStrato: (id: IdStrato, visibile: boolean) => void;
  alVaiA: (lonlat: LonLat) => void;
  /** Avvicina (fattore > 1) o allontana (fattore < 1) la mappa. Senza, i bottoni non ci sono. */
  alloZoom?: (fattore: number) => void;
  allaChiusura: () => void;
  /**
   * La luce che la mappa deve mostrare. Chiamata una volta all'avvio e poi solo quando la luce
   * effettiva cambia: per una scelta di chi guarda, oppure da sola se la scelta è «Adesso».
   */
  alCambioLuce?: (luce: Luce) => void;
  /** Che ora è. Serve ai test; predefinito: () => new Date(). */
  adesso?: () => Date;
}

export interface UI {
  apriStoria(id: string): void;
  apriPunto(punto: Punto): void;
  chiudi(): void;
  /**
   * Ferma ciò che l'interfaccia tiene acceso fuori da `radice`: il controllo dell'ora di
   * «Adesso» e l'ascolto dei tasti sulla pagina. Dopo, `alCambioLuce` non viene più chiamata.
   */
  distruggi(): void;
}

const STRATI: IdStrato[] = ['cultura', 'ambiente', 'mobilita'];
const ACCESI_ALL_AVVIO: Record<IdStrato, boolean> = { cultura: true, ambiente: false, mobilita: false };

export function creaUI(opzioni: OpzioniUI): UI {
  const { radice, storie, strati } = opzioni;
  radice.classList.add('ba');

  // =========================================================================
  // Testata
  // =========================================================================
  const testata = el(
    'header',
    { class: 'testata' },
    el('h1', { class: 'testata-nome' }, 'Bassano Aperta'),
    el('p', { class: 'testata-riga' }, 'Bassano del Grappa, candidata a Capitale italiana della Cultura 2029'),
  );

  // =========================================================================
  // Strati
  // =========================================================================
  const elementiStrati = [...strati.punti, ...strati.linee];
  const gruppoStrati = el('div', { class: 'strati', role: 'group', 'aria-label': 'Strati della mappa' });
  const interruttori = new Map<IdStrato, HTMLElement>();
  /** Accende uno strato, se è spento: serve quando si apre un suo punto dall'elenco. */
  const accendiStrato = (id: IdStrato): void => {
    const interruttore = interruttori.get(id);
    if (interruttore && interruttore.getAttribute('aria-checked') !== 'true') interruttore.click();
  };
  for (const id of STRATI) {
    const idDescrizione = idUnico('strato');
    const interruttore = el(
      'button',
      {
        type: 'button',
        class: `strato strato-${id}`,
        role: 'switch',
        'aria-checked': String(ACCESI_ALL_AVVIO[id]),
        'aria-describedby': idDescrizione,
      },
      segnoStrato(id),
      el(
        'span',
        { class: 'strato-testi' },
        el('span', { class: 'strato-nome' }, NOME_STRATO[id]),
        el('span', { class: 'strato-cosa', id: idDescrizione }, descriviStrato(id, elementiStrati)),
      ),
      el('span', { class: 'strato-leva', 'aria-hidden': 'true' }),
    );
    interruttore.addEventListener('click', () => {
      const acceso = interruttore.getAttribute('aria-checked') !== 'true';
      interruttore.setAttribute('aria-checked', String(acceso));
      opzioni.alCambioStrato(id, acceso);
    });
    interruttori.set(id, interruttore);
    gruppoStrati.append(interruttore);
  }

  // =========================================================================
  // Zoom: due bottoni, per chi non ha rotella né due dita
  // =========================================================================
  let gruppoZoom: HTMLElement | null = null;
  if (opzioni.alloZoom) {
    const alloZoom = opzioni.alloZoom;
    const avvicina = el('button', { type: 'button', class: 'bottone bottone-zoom', 'aria-label': 'Avvicina la mappa', title: 'Avvicina' }, icona('piu', 20));
    const allontana = el('button', { type: 'button', class: 'bottone bottone-zoom', 'aria-label': 'Allontana la mappa', title: 'Allontana' }, icona('meno', 20));
    avvicina.addEventListener('click', () => alloZoom(1.5));
    allontana.addEventListener('click', () => alloZoom(1 / 1.5));
    gruppoZoom = el('div', { class: 'zoom', role: 'group', 'aria-label': 'Zoom della mappa' }, avvicina, allontana);
  }
  // Compare solo quando la mappa ha il fuoco da tastiera (lo decide il CSS).
  const aiutoTasti = el(
    'p',
    { class: 'aiuto-tasti', 'aria-hidden': 'true' },
    'La mappa ascolta la tastiera: frecce per muoverti, + e - per lo zoom.',
  );

  // =========================================================================
  // In basso a sinistra: la qualità dell'aria in breve e la luce della mappa
  // =========================================================================
  const puntoAria = strati.punti.find((p) => p.tipo === 'aria');
  const ariaBreve = creaAriaBreve({
    // Apre la stessa scheda che si apre dal segnaposto della stazione.
    apri: puntoAria ? () => apriPunto(puntoAria) : undefined,
    adesso: opzioni.adesso,
  });
  const selettoreLuce = creaSelettoreLuce({
    adesso: opzioni.adesso,
    alCambio: (luce) => {
      // Sulla radice per il CSS e per chi avvia; i pannelli restano chiari in ogni luce.
      radice.dataset.luce = luce;
      opzioni.alCambioLuce?.(luce);
    },
  });
  const inBasso = el('div', { class: 'in-basso' }, ariaBreve, selettoreLuce.nodo);

  // =========================================================================
  // Elenco dei luoghi
  // =========================================================================
  const idElenco = idUnico('elenco');
  const bottoneLuoghi = el(
    'button',
    { type: 'button', class: 'bottone bottone-luoghi', 'aria-expanded': 'false', 'aria-controls': idElenco },
    icona('elenco', 18),
    'Luoghi',
  );
  const bottoneFonti = el('button', { type: 'button', class: 'bottone bottone-fonti' }, 'Fonti e licenze');

  const idCerca = idUnico('cerca');
  const campo = el('input', {
    type: 'search',
    id: idCerca,
    class: 'cerca-campo',
    placeholder: 'Per esempio: ponte',
    autocomplete: 'off',
    spellcheck: 'false',
    enterkeyhint: 'search',
  });
  const conteggio = el('p', { class: 'solo-lettori', role: 'status' });
  const risultati = el('div', { class: 'elenco-risultati' });
  const chiudiElencoBottone = el(
    'button',
    { type: 'button', class: 'bottone-tondo', 'aria-label': "Chiudi l'elenco dei luoghi" },
    icona('chiudi', 20),
  );
  const elenco = el(
    'nav',
    { class: 'elenco', id: idElenco, 'aria-label': 'Luoghi e temi', hidden: true },
    el('div', { class: 'elenco-testata' }, el('h2', null, 'Luoghi'), chiudiElencoBottone),
    el(
      'div',
      { class: 'cerca' },
      el('label', { for: idCerca, class: 'cerca-etichetta' }, 'Cerca un luogo o un punto della mappa'),
      el('div', { class: 'cerca-riga' }, icona('cerca', 18), campo),
    ),
    conteggio,
    risultati,
  );

  const voceElenco = (s: Storia): HTMLElement => {
    const bottone = el(
      'button',
      { type: 'button', class: 'elenco-voce' },
      el('span', { class: 'elenco-voce-nome' }, s.nome),
      s.sottotitolo ? el('span', { class: 'elenco-voce-sotto' }, s.sottotitolo) : null,
    );
    bottone.addEventListener('click', () => {
      chiudiElenco(false);
      if (typeof s.lat === 'number' && typeof s.lon === 'number') {
        opzioni.alVaiA({ lon: s.lon, lat: s.lat });
      }
      apriStoria(s.id);
    });
    return el('li', null, bottone);
  };

  /** Un punto senza racconto: la mappa ci va, lo strato si accende, si apre la scheda. */
  const vocePunto = (p: Punto): HTMLElement => {
    const bottone = el(
      'button',
      { type: 'button', class: 'elenco-voce' },
      el('span', { class: 'elenco-voce-nome' }, p.nome),
      el('span', { class: 'elenco-voce-sotto' }, sottoPunto(p)),
    );
    bottone.addEventListener('click', () => {
      chiudiElenco(false);
      accendiStrato(p.strato);
      opzioni.alVaiA(metriInLonLat({ x: p.x, y: p.y }));
      apriPunto(p);
    });
    return el('li', null, bottone);
  };

  /** Gli avvisi sulla viabilità non sono un punto della mappa: la voce apre solo la scheda. */
  const voceAvvisi = (): HTMLElement => {
    const bottone = el(
      'button',
      { type: 'button', class: 'elenco-voce' },
      el('span', { class: 'elenco-voce-nome' }, NOME_AVVISI),
      el('span', { class: 'elenco-voce-sotto' }, SOTTO_AVVISI),
    );
    bottone.addEventListener('click', () => {
      chiudiElenco(false);
      apriAvvisi();
    });
    return el('li', null, bottone);
  };

  const gruppo = (titolo: string, voci: HTMLElement[], nota?: string): HTMLElement | null => {
    if (voci.length === 0) return null;
    const idTitolo = idUnico('gruppo');
    const lista = el('ul', { class: 'elenco-lista', 'aria-labelledby': idTitolo });
    lista.append(...voci);
    return el(
      'section',
      { class: 'elenco-gruppo' },
      el('h3', { id: idTitolo }, titolo),
      lista,
      nota ? el('p', { class: 'elenco-nota' }, nota) : null,
    );
  };

  const aggiornaElenco = (annuncia: boolean): void => {
    const trovate = filtraStorie(storie, campo.value);
    const { luoghi, temi } = dividiStorie(trovate);
    const punti = filtraPunti(strati.punti, campo.value);
    const avvisi = trovaVoceAvvisi(campo.value);
    const quanti = trovate.length + punti.servizi.length + punti.altri.length + (avvisi ? 1 : 0);
    if (quanti === 0) {
      risultati.replaceChildren(
        el(
          'p',
          { class: 'elenco-vuoto' },
          storie.length === 0
            ? 'I racconti non sono ancora stati caricati.'
            : 'Nessun luogo con queste parole. Prova con una parola sola, per esempio «ponte», «museo» o «fermata».',
        ),
      );
    } else {
      const blocchi = [
        gruppo('Luoghi', luoghi.map(voceElenco)),
        gruppo('Temi', temi.map(voceElenco)),
        gruppo('Dati e servizi', [...punti.servizi.map(vocePunto), ...(avvisi ? [voceAvvisi()] : [])]),
        gruppo(
          'Altri punti sulla mappa',
          punti.altri.map(vocePunto),
          punti.altriInTutto > punti.altri.length
            ? `Ne mostriamo ${punti.altri.length} su ${punti.altriInTutto}: aggiungi una parola per restringere.`
            : undefined,
        ),
      ].filter((b): b is HTMLElement => b !== null);
      risultati.replaceChildren(...blocchi);
    }
    if (annuncia) conteggio.textContent = contaRisultati(quanti);
  };
  campo.addEventListener('input', () => aggiornaElenco(true));
  aggiornaElenco(false);

  const elencoAperto = (): boolean => !elenco.hidden;
  const apriElenco = (): void => {
    elenco.hidden = false;
    bottoneLuoghi.setAttribute('aria-expanded', 'true');
    radice.classList.add('ba-elenco-aperto');
    campo.focus({ preventScroll: true });
  };
  function chiudiElenco(riportaFuoco: boolean): void {
    if (!elencoAperto()) return;
    elenco.hidden = true;
    bottoneLuoghi.setAttribute('aria-expanded', 'false');
    radice.classList.remove('ba-elenco-aperto');
    if (riportaFuoco) bottoneLuoghi.focus({ preventScroll: true });
  }
  bottoneLuoghi.addEventListener('click', () => (elencoAperto() ? chiudiElenco(true) : apriElenco()));
  chiudiElencoBottone.addEventListener('click', () => chiudiElenco(true));

  // =========================================================================
  // Fonti e licenze
  // =========================================================================
  const fonti = creaFonti({
    strati,
    baseGenerato: radice.dataset.baseGenerato,
    lampioniVeri: radice.dataset.lampioniVeri,
    lampioniTutti: radice.dataset.lampioniTutti,
    segnalazioni: radice.dataset.segnalazioni,
    codice: radice.dataset.codice,
  });
  bottoneFonti.addEventListener('click', () => fonti.apri());
  fonti.nodo.addEventListener('close', () => bottoneFonti.focus({ preventScroll: true }));

  // =========================================================================
  // Lente: un'immagine in grande
  // =========================================================================
  const lenteImmagine = el('img', { alt: '' });
  const lenteDidascalia = el('figcaption', null);
  const lenteChiudi = el('button', { type: 'button', class: 'bottone-tondo lente-chiudi', 'aria-label': "Chiudi l'immagine" }, icona('chiudi', 20));
  const lente = el(
    'dialog',
    { class: 'lente', 'aria-label': 'Immagine ingrandita' },
    lenteChiudi,
    el('figure', null, lenteImmagine, lenteDidascalia),
  );
  let origineLente: HTMLElement | null = null;
  lenteChiudi.addEventListener('click', () => lente.close());
  lente.addEventListener('click', (e) => {
    if (e.target === lente) lente.close();
  });
  lente.addEventListener('close', () => {
    lenteImmagine.removeAttribute('src');
    if (origineLente?.isConnected) origineLente.focus({ preventScroll: true });
    origineLente = null;
  });
  lenteImmagine.addEventListener('error', () => {
    if (!lente.open || !lenteImmagine.getAttribute('src')) return;
    lenteDidascalia.prepend(el('span', { class: 'media-errore' }, "L'immagine non si carica. "));
  });
  const apriLente = (m: Media, origine: HTMLElement): void => {
    const url = urlSicuro(m.url);
    if (!url) return;
    origineLente = origine;
    lenteImmagine.src = url;
    lenteImmagine.alt = m.alt ?? m.titolo;
    const crediti = [m.autore, m.licenza].filter(Boolean).join(', ');
    lenteDidascalia.replaceChildren(
      el('span', { class: 'didascalia-titolo' }, m.titolo),
      el(
        'span',
        { class: 'didascalia-crediti' },
        crediti ? `${crediti}. ` : null,
        urlSicuro(m.pagina) ? linkEsterno(m.pagina, 'Pagina del file') : null,
      ),
    );
    if (!lente.open) lente.showModal();
    lenteChiudi.focus();
  };

  // =========================================================================
  // Finestra: racconto di un luogo oppure scheda di un punto
  // =========================================================================
  const finestraChiudi = el('button', { type: 'button', class: 'bottone-tondo finestra-chiudi', 'aria-label': 'Chiudi' }, icona('chiudi', 20));
  const finestraCorpo = el('div', { class: 'finestra-corpo' });
  const finestra = el(
    'section',
    { class: 'finestra', role: 'dialog', 'aria-modal': 'false', hidden: true },
    el('div', { class: 'finestra-barra' }, el('span', { class: 'finestra-maniglia', 'aria-hidden': 'true' }), finestraChiudi),
    finestraCorpo,
  );

  let raccontoAperto: Racconto | null = null;
  let ritorno: HTMLElement | null = null;

  const finestraAperta = (): boolean => !finestra.hidden;

  const svuotaFinestra = (): void => {
    raccontoAperto?.distruggi();
    raccontoAperto = null;
    for (const a of finestraCorpo.querySelectorAll('audio')) a.pause();
    finestraCorpo.replaceChildren();
  };

  const mostraFinestra = (tipo: 'storia' | 'punto', contenuto: HTMLElement, titolo: HTMLElement, etichettaChiudi: string): void => {
    if (!finestraAperta()) {
      const attivo = document.activeElement;
      ritorno = attivo instanceof HTMLElement && attivo !== document.body ? attivo : null;
    }
    svuotaFinestra();
    finestra.dataset.tipo = tipo;
    finestra.setAttribute('aria-labelledby', titolo.id);
    finestraChiudi.setAttribute('aria-label', etichettaChiudi);
    finestraCorpo.append(contenuto);
    finestra.hidden = false;
    radice.classList.add('ba-finestra-aperta');
    radice.dataset.finestra = tipo;
    finestraCorpo.scrollTop = 0;
    titolo.focus({ preventScroll: true });
  };

  function apriStoria(id: string): void {
    const storia = storie.find((s) => s.id === id);
    if (!storia) {
      console.warn(`Bassano Aperta: nessuna storia con id "${id}"`);
      return;
    }
    chiudiElenco(false);
    const racconto = creaRacconto(storia, { apriLente });
    mostraFinestra('storia', racconto.nodo, racconto.titolo, `Chiudi il racconto: ${storia.nome}`);
    raccontoAperto = racconto;
    racconto.collega(finestraCorpo);
    // Chi avvia può ascoltare questo evento per evidenziare il luogo sulla mappa.
    radice.dispatchEvent(new CustomEvent('ba:storia', { detail: { id: storia.id } }));
  }

  function apriPunto(punto: Punto): void {
    const haStoria = punto.storia !== undefined && storie.some((s) => s.id === punto.storia);
    const scheda = creaScheda(punto, haStoria ? () => apriStoria(punto.storia!) : undefined);
    mostraFinestra('punto', scheda.nodo, scheda.titolo, `Chiudi la scheda: ${punto.nome}`);
    // Chi avvia spegne l'evidenza del racconto che c'era prima: ora si guarda un altro punto.
    radice.dispatchEvent(new CustomEvent('ba:punto', { detail: { id: punto.id } }));
  }

  /** Scheda degli avvisi sulla viabilità: si apre dall'elenco, come la scheda di un punto. */
  function apriAvvisi(): void {
    const scheda = creaSchedaAvvisi();
    mostraFinestra('punto', scheda.nodo, scheda.titolo, `Chiudi la scheda: ${NOME_AVVISI}`);
    radice.dispatchEvent(new CustomEvent('ba:punto', { detail: { id: 'avvisi-viabilita' } }));
  }

  function chiudi(): void {
    if (!finestraAperta()) return;
    if (lente.open) lente.close();
    svuotaFinestra();
    finestra.hidden = true;
    radice.classList.remove('ba-finestra-aperta');
    delete radice.dataset.finestra;
    const meta = ritorno;
    ritorno = null;
    if (meta && meta.isConnected && meta.getClientRects().length > 0) meta.focus({ preventScroll: true });
    else bottoneLuoghi.focus({ preventScroll: true });
    opzioni.allaChiusura();
  }
  finestraChiudi.addEventListener('click', chiudi);

  // Esc chiude ciò che sta sopra: prima le finestre di dialogo (ci pensa il browser),
  // poi l'elenco, poi il racconto.
  const alTasto = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (lente.open || fonti.nodo.open) return;
    if (elencoAperto()) {
      e.preventDefault();
      chiudiElenco(true);
    } else if (finestraAperta()) {
      e.preventDefault();
      chiudi();
    }
  };
  document.addEventListener('keydown', alTasto);

  // =========================================================================
  // Montaggio
  // =========================================================================
  const controlli = el(
    'div',
    { class: 'controlli' },
    testata,
    gruppoStrati,
    el('div', { class: 'controlli-azioni' }, bottoneLuoghi, bottoneFonti),
  );
  radice.append(...soli(controlli, inBasso, gruppoZoom, aiutoTasti, elenco, finestra, fonti.nodo, lente));

  const distruggi = (): void => {
    selettoreLuce.distruggi();
    document.removeEventListener('keydown', alTasto);
  };

  return { apriStoria, apriPunto, chiudi, distruggi };
}
