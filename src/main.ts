// Avvio: carica dati e storie, crea mappa e interfaccia e le collega.

import './stile.css';
import { creaMappa } from './map/index';
import { lonLatInMetri } from './map/proiezione';
import { RIQUADRO } from './types';
import type { DatiBase, DatiLampioni, DatiStrati, Landmark, LonLat, Punto, Storia } from './types';
import { creaUI } from './ui/index';

const BASE = import.meta.env.BASE_URL;

/** Le storie entrano nel pacchetto: un file per luogo in content/luoghi/. */
const moduliStorie = import.meta.glob<Storia>('../content/luoghi/*.json', { eager: true, import: 'default' });
const storie: Storia[] = Object.values(moduliStorie);

async function scarica<T>(percorso: string, cosa: string): Promise<T> {
  let risposta: Response;
  try {
    risposta = await fetch(BASE + percorso);
  } catch {
    throw new Error(`Non riesco a scaricare ${cosa}. Controlla la connessione.`);
  }
  if (!risposta.ok) throw new Error(`Non trovo ${cosa} (${percorso}, errore ${risposta.status}).`);
  try {
    return (await risposta.json()) as T;
  } catch {
    throw new Error(`Il file con ${cosa} (${percorso}) è rovinato.`);
  }
}

/** Tiene un punto dentro il riquadro della mappa (il Monte Grappa, per esempio, è fuori). */
function dentroIlRiquadro(ll: LonLat): LonLat {
  const margine = 0.0008;
  return {
    lon: Math.min(RIQUADRO.est - margine, Math.max(RIQUADRO.ovest + margine, ll.lon)),
    lat: Math.min(RIQUADRO.nord - margine, Math.max(RIQUADRO.sud + margine, ll.lat)),
  };
}

/**
 * Segnaposto personali, solo in locale: stanno in personale.local.json nella cartella del
 * progetto, che git ignora e che la build non copia. Non finiscono mai nel sito pubblicato.
 */
async function puntiPersonali(): Promise<Punto[]> {
  if (!import.meta.env.DEV) return [];
  try {
    const risposta = await fetch('/personale.local.json');
    if (!risposta.ok) return [];
    const voci = (await risposta.json()) as { nome: string; lat: number; lon: number; nota?: string }[];
    return voci.map((v, i) => ({
      id: `personale-${i}`,
      strato: 'cultura',
      tipo: 'luogo-storico',
      nome: v.nome,
      nota: v.nota ?? 'Segnaposto personale, visibile solo su questo computer.',
      ...lonLatInMetri({ lon: v.lon, lat: v.lat }),
    }));
  } catch {
    return [];
  }
}

/**
 * I lampioni servono solo alla luce della notte: se il file manca o è rovinato la mappa parte
 * lo stesso, con la notte buia.
 */
async function lampioni(): Promise<DatiLampioni | undefined> {
  try {
    const risposta = await fetch(BASE + 'data/lampioni.json');
    if (!risposta.ok) return undefined;
    const dati = (await risposta.json()) as DatiLampioni;
    return Array.isArray(dati.p) && dati.p.length % 2 === 0 ? dati : undefined;
  } catch {
    return undefined;
  }
}

/** Per quanto il luogo resta evidenziato dopo la chiusura del suo racconto. */
const DURATA_EVIDENZA_MS = 8000;

function mostraErrore(avviso: HTMLElement | null, errore: unknown): void {
  console.error(errore);
  const testo = errore instanceof Error ? errore.message : 'Errore sconosciuto.';
  const contenitore = avviso ?? document.body.appendChild(document.createElement('div'));
  contenitore.className = 'avviso-pagina';
  contenitore.setAttribute('role', 'alert');
  contenitore.replaceChildren();
  const titolo = document.createElement('p');
  titolo.textContent = 'La mappa non si è caricata.';
  const dettaglio = document.createElement('p');
  dettaglio.style.fontSize = '1rem';
  dettaglio.textContent = testo;
  const riprova = document.createElement('button');
  riprova.type = 'button';
  riprova.className = 'bottone';
  riprova.style.justifySelf = 'center';
  riprova.textContent = 'Riprova';
  riprova.addEventListener('click', () => location.reload());
  contenitore.append(titolo, dettaglio, riprova);
}

async function avvia(): Promise<void> {
  const avviso = document.getElementById('avvio');
  try {
    const canvas = document.getElementById('mappa');
    const radice = document.getElementById('ui');
    if (!(canvas instanceof HTMLCanvasElement) || !radice) throw new Error('La pagina è incompleta.');

    const [base, strati, landmark, datiLampioni] = await Promise.all([
      scarica<DatiBase>('data/base.json', 'la mappa di base'),
      scarica<DatiStrati>('data/strati.json', 'gli strati della mappa'),
      scarica<Landmark[]>('landmarks/indice.json', "l'elenco dei luoghi simbolo"),
      lampioni(),
    ]);

    strati.punti.push(...(await puntiPersonali()));

    const conosciute = new Set(storie.map((s) => s.id));

    let timerEvidenza = 0;
    let evidenzaInUscita = false;
    const spegniEvidenza = (): void => {
      window.clearTimeout(timerEvidenza);
      evidenzaInUscita = false;
      mappa.evidenzia(null);
    };

    const mappa = creaMappa({
      canvas,
      base,
      strati,
      landmark,
      lampioni: datiLampioni?.p,
      alClic: (bersaglio) => {
        if (!bersaglio) return;
        if (bersaglio.storia && conosciute.has(bersaglio.storia)) ui.apriStoria(bersaglio.storia);
        else if (bersaglio.punto) ui.apriPunto(bersaglio.punto);
      },
    });

    // La data della mappa di base e gli indirizzi del progetto servono a "Fonti e licenze".
    radice.dataset.baseGenerato = base.generato;
    // Quanti lampioni sono rilevati e quanti illustrativi: lo dice «Fonti e licenze».
    if (datiLampioni && Number.isInteger(datiLampioni.veri)) {
      radice.dataset.lampioniVeri = String(datiLampioni.veri);
      radice.dataset.lampioniTutti = String(datiLampioni.p.length / 2);
    }

    // Quanti alberi vengono da OpenStreetMap e quanti sono in tutto. Se il numero manca
    // «Fonti e licenze» lo dice a parole.
    if (typeof base.alberiVeri === 'number' && Number.isInteger(base.alberiVeri)) {
      radice.dataset.alberiVeri = String(base.alberiVeri);
      radice.dataset.alberiTutti = String(base.alberi.length / 2);
    }

    const ui = creaUI({
      radice,
      storie,
      strati,
      alCambioStrato: (id, visibile) => mappa.mostraStrato(id, visibile),
      alVaiA: (ll) => mappa.vaiA(dentroIlRiquadro(ll)),
      alloZoom: (fattore) => mappa.zooma(fattore),
      // La prima chiamata arriva subito, dentro creaUI: la mappa esiste già.
      alCambioLuce: (luce) => mappa.impostaLuce(luce),
      // Chiuso il racconto, il luogo resta acceso ancora un po': su telefono la finestra
      // copriva la mappa, e così si capisce quale luogo si è appena letto.
      allaChiusura: () => {
        window.clearTimeout(timerEvidenza);
        evidenzaInUscita = true;
        timerEvidenza = window.setTimeout(spegniEvidenza, DURATA_EVIDENZA_MS);
      },
    });

    // Ogni volta che si apre una storia (dalla mappa o dall'elenco) il luogo si accende.
    radice.addEventListener('ba:storia', (evento) => {
      const id = (evento as CustomEvent<{ id?: string }>).detail?.id;
      window.clearTimeout(timerEvidenza);
      evidenzaInUscita = false;
      mappa.evidenzia(typeof id === 'string' ? id : null);
    });
    // La scheda di un punto senza racconto prende il posto del racconto: l'alone si spegne.
    radice.addEventListener('ba:punto', spegniEvidenza);
    // Dopo la chiusura, il primo gesto sulla mappa spegne l'alone.
    const alGesto = (): void => {
      if (evidenzaInUscita) spegniEvidenza();
    };
    canvas.addEventListener('pointerdown', alGesto);
    canvas.addEventListener('wheel', alGesto, { passive: true });
    canvas.addEventListener('keydown', alGesto);

    // Stesso stato iniziale degli interruttori dell'interfaccia.
    mappa.mostraStrato('cultura', true);
    mappa.mostraStrato('ambiente', false);
    mappa.mostraStrato('mobilita', false);

    avviso?.remove();

    // In sviluppo, quando Vite ricarica questo modulo, mappa e interfaccia vecchie si fermano:
    // senza, resterebbero accesi i loro timer e i loro ascoltatori.
    import.meta.hot?.dispose(() => {
      ui.distruggi();
      mappa.distruggi();
    });
  } catch (errore) {
    mostraErrore(avviso, errore);
  }
}

void avvia();
