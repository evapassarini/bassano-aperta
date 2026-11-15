// Il contenuto della finestra-racconto: apertura, riquadro "Adesso", linea del tempo a
// tappe, immagini, audio e video, punti incerti, fonti.

import type { Media, Storia } from '../types';
import { creaAdesso } from './adesso';
import {
  decidiTappe,
  fontiUniche,
  immagineDellaTappa,
  mediaResidui,
  urlIncorporamento,
  urlLicenza,
  urlMiniatura,
  urlPaginaYouTube,
  urlSicuro,
} from './aiuti';
import { el, icona, idUnico, linkEsterno, menoMovimento, soli } from './dom';

export interface Racconto {
  nodo: HTMLElement;
  /** Titolo a cui spostare il fuoco quando la finestra si apre. */
  titolo: HTMLElement;
  /** Da chiamare quando il contenuto è dentro il contenitore che scorre. */
  collega(scorrevole: HTMLElement): void;
  /** Ferma osservatori, ascoltatori e media in riproduzione. */
  distruggi(): void;
}

export interface OpzioniRacconto {
  /** Apre un'immagine in grande. */
  apriLente: (media: Media, origine: HTMLElement) => void;
}

function paragrafi(testo: string, classe: string): HTMLElement[] {
  return testo
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => el('p', { class: classe }, p));
}

/**
 * Riga dei crediti di un file: autore, licenza e link alla pagina di origine. Se la licenza è
 * una Creative Commons, il suo nome porta al testo ufficiale della licenza.
 */
export function creditiMedia(m: Media, pagina: string | null, etichettaPagina: string): HTMLElement {
  const riga = el('span', { class: 'didascalia-crediti' });
  if (m.autore) riga.append(m.autore);
  if (m.licenza) {
    if (m.autore) riga.append(', ');
    const testoLicenza = urlLicenza(m.licenza);
    riga.append(testoLicenza ? linkEsterno(testoLicenza, m.licenza, 'licenza', ': testo della licenza') : m.licenza);
  }
  if (m.autore || m.licenza) riga.append('. ');
  if (pagina) riga.append(linkEsterno(pagina, etichettaPagina));
  return riga;
}

/** Didascalia: titolo, autore, licenza e link alla pagina di origine. */
function didascalia(m: Media, etichettaPagina = 'Pagina del file'): HTMLElement {
  return el(
    'figcaption',
    null,
    el('span', { class: 'didascalia-titolo' }, m.titolo),
    creditiMedia(m, urlSicuro(m.pagina), etichettaPagina),
  );
}

/** Immagine pigra che, se non si carica, toglie di mezzo `daTogliere` senza lasciare buchi. */
function immagine(m: Media, url: string, daTogliere: () => HTMLElement): HTMLImageElement {
  const img = el('img', {
    src: url,
    alt: m.alt ?? m.titolo,
    loading: 'lazy',
    decoding: 'async',
    referrerpolicy: 'no-referrer',
  });
  img.addEventListener('load', () => img.classList.add('caricata'), { once: true });
  img.addEventListener('error', () => daTogliere().remove(), { once: true });
  return img;
}

function figuraImmagine(m: Media): HTMLElement | null {
  const url = urlSicuro(m.url);
  if (!url) return null;
  const figura: HTMLElement = el('figure', { class: 'figura' });
  figura.append(immagine(m, url, () => figura), didascalia(m));
  return figura;
}

function figuraAudio(m: Media): HTMLElement | null {
  const url = urlSicuro(m.url);
  if (!url) return null;
  const figura: HTMLElement = el('figure', { class: 'audio' });
  const audio = el('audio', { controls: true, preload: 'none', src: url });
  audio.setAttribute('aria-label', m.titolo);
  audio.addEventListener('error', () => {
    audio.replaceWith(
      el('p', { class: 'media-errore' }, 'La registrazione non si carica. Puoi ascoltarla dalla pagina del file.'),
    );
  });
  figura.append(audio, didascalia(m));
  return figura;
}

function figuraVideo(m: Media): HTMLElement | null {
  const incorporato = urlIncorporamento(m.url, true);
  const pagina = urlSicuro(m.pagina) ?? urlPaginaYouTube(m.url);
  if (!incorporato) {
    // Non è un video di YouTube: non si incorpora nulla, resta solo il link.
    if (!pagina) return null;
    return el('p', { class: 'video-solo-link' }, linkEsterno(pagina, m.titolo));
  }
  const cornice = el('div', { class: 'video-cornice' });
  const bottone = el(
    'button',
    { type: 'button', class: 'video-carica' },
    el('span', { class: 'video-segno' }, icona('avvia', 22)),
    el('span', { class: 'video-invito' }, 'Carica il video da YouTube'),
    el('span', { class: 'video-titolo' }, m.titolo),
  );
  bottone.addEventListener('click', () => {
    const iframe = el('iframe', {
      src: incorporato,
      title: m.titolo,
      allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
      allowfullscreen: true,
      referrerpolicy: 'strict-origin-when-cross-origin',
    });
    iframe.tabIndex = 0;
    cornice.replaceChildren(iframe);
    iframe.focus();
  });
  cornice.append(bottone);
  const figura = el('figure', { class: 'video' }, cornice);
  figura.append(
    el(
      'figcaption',
      null,
      el('span', { class: 'didascalia-titolo' }, m.titolo),
      creditiMedia(m, pagina, 'Guardalo su YouTube'),
    ),
  );
  return figura;
}

/** Costruisce il racconto di una storia. */
export function creaRacconto(storia: Storia, opzioni: OpzioniRacconto): Racconto {
  const pulizie: (() => void)[] = [];
  const idTitolo = idUnico('titolo');
  const titolo = el('h2', { class: 'racconto-nome', id: idTitolo, tabindex: '-1' }, storia.nome);

  // --- Apertura ------------------------------------------------------------
  const apertura = el('header', { class: 'racconto-apertura' });
  if (storia.landmark) {
    const disegno = el('img', {
      class: 'racconto-disegno',
      src: `${import.meta.env.BASE_URL}landmarks/${encodeURIComponent(storia.landmark)}.svg`,
      alt: '',
      decoding: 'async',
    });
    disegno.addEventListener('error', () => disegno.remove(), { once: true });
    apertura.append(disegno);
  }
  apertura.append(...soli(
    storia.genere === 'tema' ? el('p', { class: 'racconto-genere' }, 'Un tema della città') : null,
    titolo,
    storia.sottotitolo ? el('p', { class: 'racconto-sottotitolo' }, storia.sottotitolo) : null,
    ...paragrafi(storia.intro ?? '', 'racconto-intro'),
  ));

  const nodo = el('article', { class: 'racconto', 'aria-labelledby': idTitolo }, apertura);

  // --- Adesso --------------------------------------------------------------
  if (storia.live.length > 0) {
    const sezione = el('section', { class: 'sezione sezione-adesso' }, el('h3', null, 'Adesso'));
    for (const voce of storia.live) sezione.append(creaAdesso(voce));
    nodo.append(sezione);
  }

  // --- Linea del tempo -----------------------------------------------------
  const tappe: HTMLElement[] = [];
  let lista: HTMLElement | null = null;
  let avanzamento: HTMLElement | null = null;
  if (storia.tappe.length > 0) {
    lista = el('ol', { class: 'tappe' });
    avanzamento = el('span', { class: 'tappe-avanzamento', 'aria-hidden': 'true' });
    lista.append(el('span', { class: 'tappe-filo', 'aria-hidden': 'true' }, avanzamento));
    storia.tappe.forEach((t, i) => {
      const voce = el(
        'li',
        { class: 'tappa' },
        el('p', { class: 'tappa-anno' }, t.anno),
        el('h4', { class: 'tappa-titolo' }, t.titolo),
        ...paragrafi(t.testo, 'tappa-testo'),
      );
      const indice = immagineDellaTappa(storia, i);
      if (indice !== null) {
        const figura = figuraImmagine(storia.media[indice]);
        if (figura) voce.append(figura);
      }
      if (t.fonte?.url) {
        voce.append(el('p', { class: 'tappa-fonte' }, 'Fonte: ', linkEsterno(t.fonte.url, t.fonte.titolo || t.fonte.url)));
      }
      tappe.push(voce);
      lista!.append(voce);
    });
    nodo.append(
      el('section', { class: 'sezione sezione-tappe' }, el('h3', null, 'La storia, una tappa alla volta'), lista),
    );
  }

  // --- Immagini, audio, video ---------------------------------------------
  const immagini = mediaResidui(storia, 'immagine');
  const audio = mediaResidui(storia, 'audio');
  const video = mediaResidui(storia, 'video');
  if (immagini.length + audio.length + video.length > 0) {
    const sezione = el('section', { class: 'sezione sezione-media' }, el('h3', null, 'Da vedere e da ascoltare'));

    if (immagini.length > 0) {
      const griglia = el('ul', { class: 'galleria' });
      for (const i of immagini) {
        const m = storia.media[i];
        const url = urlSicuro(m.url);
        if (!url) continue;
        const voce: HTMLElement = el('li', { class: 'galleria-elemento' });
        const bottone = el('button', { type: 'button', class: 'galleria-voce' });
        bottone.setAttribute('aria-label', `Ingrandisci: ${m.titolo}`);
        bottone.append(immagine(m, urlMiniatura(url), () => voce));
        bottone.addEventListener('click', () => opzioni.apriLente(m, bottone));
        // Autore, licenza e link stanno sotto la miniatura, non solo dentro la lente.
        voce.append(el('figure', { class: 'galleria-figura' }, bottone, didascalia(m)));
        griglia.append(voce);
      }
      sezione.append(griglia);
    }

    for (const i of audio) {
      const figura = figuraAudio(storia.media[i]);
      if (figura) sezione.append(figura);
    }

    if (video.length > 0) {
      sezione.append(
        el(
          'p',
          { class: 'video-avviso' },
          'I video stanno su YouTube. Si caricano solo quando lo chiedi tu: prima del clic YouTube non riceve nulla.',
        ),
      );
      for (const i of video) {
        const figura = figuraVideo(storia.media[i]);
        if (figura) sezione.append(figura);
      }
    }
    nodo.append(sezione);
  }

  // --- Le fonti non concordano --------------------------------------------
  if (storia.incertezze.length > 0) {
    const elenco = el('ul', null);
    for (const punto of storia.incertezze) elenco.append(el('li', null, punto));
    nodo.append(
      el(
        'section',
        { class: 'sezione sezione-incertezze' },
        el('h3', null, 'Le fonti non concordano'),
        el(
          'p',
          { class: 'incertezze-premessa' },
          'Su questi punti le fonti che abbiamo letto dicono cose diverse, o non dicono abbastanza. Non abbiamo scelto una versione: le riportiamo come sono.',
        ),
        elenco,
      ),
    );
  }

  // --- Fonti ---------------------------------------------------------------
  const fonti = fontiUniche(storia);
  if (fonti.length > 0) {
    const elenco = el('ul', null);
    for (const f of fonti) elenco.append(el('li', null, linkEsterno(f.url, f.titolo || f.url)));
    nodo.append(el('footer', { class: 'sezione sezione-fonti' }, el('h3', null, 'Fonti di questo racconto'), elenco));
  }

  // --- Movimento: tappe che compaiono e filo che avanza ---------------------
  const collega = (scorrevole: HTMLElement): void => {
    if (lista && avanzamento) {
      const elencoTappe = lista;
      const barra = avanzamento;
      let inAttesa = false;
      const aggiorna = (): void => {
        inAttesa = false;
        const cornice = scorrevole.getBoundingClientRect();
        const r = elencoTappe.getBoundingClientRect();
        if (r.height <= 0) return;
        // Il filo si riempie fino a due terzi dell'altezza visibile.
        const traguardo = cornice.top + cornice.height * 0.66;
        const quota = Math.max(0, Math.min(1, (traguardo - r.top) / r.height));
        barra.style.transform = `scaleY(${quota.toFixed(4)})`;
        // Rete di sicurezza: una tappa ormai ben dentro l'area visibile non resta mai
        // nascosta, anche se l'osservatore qui sotto ha perso il passaggio.
        const dentro = cornice.top + cornice.height * 0.85;
        for (const t of tappe) {
          const alto = t.getBoundingClientRect().top;
          t.classList.toggle('raggiunta', alto <= traguardo);
          if (alto <= dentro) t.classList.remove('in-arrivo');
        }
      };
      const alloScorrere = (): void => {
        if (inAttesa) return;
        inAttesa = true;
        requestAnimationFrame(aggiorna);
      };
      scorrevole.addEventListener('scroll', alloScorrere, { passive: true });
      window.addEventListener('resize', alloScorrere);
      pulizie.push(() => {
        scorrevole.removeEventListener('scroll', alloScorrere);
        window.removeEventListener('resize', alloScorrere);
      });
      aggiorna();
    }

    if (tappe.length > 0 && !menoMovimento() && typeof IntersectionObserver === 'function') {
      // Le tappe sono visibili in partenza. È l'osservatore stesso, al primo giro, a
      // nascondere quelle ancora sotto il bordo: se non parte, non sparisce niente.
      // Una tappa già mostrata non si nasconde più: nello stesso lotto possono arrivare
      // due voci per la stessa tappa (visibile, poi di nuovo sotto il bordo perché il
      // contenuto sopra è cresciuto) e la seconda la lascerebbe invisibile per sempre.
      const rivelate = new WeakSet<Element>();
      const osservatore = new IntersectionObserver(
        (voci) => {
          const azioni = decidiTappe(
            voci.map((v) => ({
              bersaglio: v.target,
              visibile: v.isIntersecting,
              sottoIlBordo: v.rootBounds !== null && v.boundingClientRect.top >= v.rootBounds.bottom,
            })),
            rivelate,
          );
          for (const a of azioni) {
            const tappa = a.bersaglio as HTMLElement;
            if (a.azione === 'nascondi') {
              tappa.classList.add('in-arrivo');
            } else {
              tappa.classList.remove('in-arrivo');
              osservatore.unobserve(tappa);
            }
          }
        },
        { root: scorrevole, rootMargin: '0px 0px -6% 0px', threshold: 0.05 },
      );
      for (const t of tappe) osservatore.observe(t);
      pulizie.push(() => osservatore.disconnect());
    }
  };

  const distruggi = (): void => {
    for (const p of pulizie.splice(0)) p();
    // Ferma audio e video: togliere l'iframe è l'unico modo sicuro per zittirlo.
    for (const a of nodo.querySelectorAll('audio')) a.pause();
    for (const f of nodo.querySelectorAll('iframe')) f.remove();
  };

  return { nodo, titolo, collega, distruggi };
}
