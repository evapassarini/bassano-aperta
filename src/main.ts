// Avvio: carica dati e storie, crea mappa e interfaccia e le collega.

import './stile.css';
import { creaMappa } from './map/index';
import { RIQUADRO } from './types';
import type { DatiBase, DatiStrati, Landmark, LonLat, Storia } from './types';
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

    const [base, strati, landmark] = await Promise.all([
      scarica<DatiBase>('data/base.json', 'la mappa di base'),
      scarica<DatiStrati>('data/strati.json', 'gli strati della mappa'),
      scarica<Landmark[]>('landmarks/indice.json', "l'elenco dei luoghi simbolo"),
    ]);

    const conosciute = new Set(storie.map((s) => s.id));

    const mappa = creaMappa({
      canvas,
      base,
      strati,
      landmark,
      alClic: (bersaglio) => {
        if (!bersaglio) return;
        if (bersaglio.storia && conosciute.has(bersaglio.storia)) ui.apriStoria(bersaglio.storia);
        else if (bersaglio.punto) ui.apriPunto(bersaglio.punto);
      },
    });

    // La data della mappa di base e gli indirizzi del progetto servono a "Fonti e licenze".
    radice.dataset.baseGenerato = base.generato;

    const ui = creaUI({
      radice,
      storie,
      strati,
      alCambioStrato: (id, visibile) => mappa.mostraStrato(id, visibile),
      alVaiA: (ll) => mappa.vaiA(dentroIlRiquadro(ll)),
      allaChiusura: () => mappa.evidenzia(null),
    });

    // Ogni volta che si apre una storia (dalla mappa o dall'elenco) il luogo si accende.
    radice.addEventListener('ba:storia', (evento) => {
      const id = (evento as CustomEvent<{ id?: string }>).detail?.id;
      mappa.evidenzia(typeof id === 'string' ? id : null);
    });

    // Stesso stato iniziale degli interruttori dell'interfaccia.
    mappa.mostraStrato('cultura', true);
    mappa.mostraStrato('ambiente', false);
    mappa.mostraStrato('mobilita', false);

    avviso?.remove();
  } catch (errore) {
    mostraErrore(avviso, errore);
  }
}

void avvia();
