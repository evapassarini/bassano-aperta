# Bassano Aperta: specifica della versione 1

Nome provvisorio. Progetto civico open source: una mappa isometrica di Bassano del Grappa
con dati utili e il racconto dei luoghi. Nasce attorno alla candidatura di Bassano a
**Capitale italiana della Cultura 2029** (dicitura corretta: "candidata a", mai "Città della
cultura 2029", mai "europea").

## Cosa fa

1. Mostra tutta la città in vista isometrica, disegnata dal codice a partire da OpenStreetMap,
   in stile illustrato. Si trascina, si zooma, la posizione sta nell'indirizzo (`#@x,y,zoom`).
2. Sopra la base ci sono i luoghi simbolo, disegnati a parte come SVG.
3. Tre strati accendibili: **Cultura**, **Ambiente**, **Mobilità**.
4. Clic su un luogo: si apre la **finestra-racconto** con una linea del tempo a tappe, immagini,
   video e audio, e un riquadro **Adesso** con il dato live dove esiste davvero.
5. Una pagina **Fonti e licenze** elenca ogni fonte, con data.

Fuori dalla v1: bilancio del Comune (SIOPE), quartieri e servizi, traffico, giorno/notte,
rilievo, tasselli dipinti con AI.

## Regole editoriali (valgono per ogni testo del sito)

- Ogni fatto ha una fonte letta davvero. La base è `ricerca/ricerca-verificata-2026-11-14.json`:
  non si aggiunge nulla a memoria.
- Dove le fonti non concordano non si sceglie: il punto va in `incertezze` e la finestra lo
  mostra come "Le fonti non concordano". Esempi: distruzione del ponte nel 1945, "ricostruito
  dagli Alpini", numeri del 26 settembre 1944, origine del nome "degli Ezzelini".
- Le affermazioni aziendali (Nardini, Poli) si attribuiscono: "secondo l'azienda".
- Viale dei Martiri e Tempio Ossario: tono sobrio, nessun dettaglio crudo, nessuna foto delle
  vittime.
- King Kong Rhino (Li-Jen Shih, Palazzo Sturm): la scultura c'è ancora (confermato di persona da chi cura il sito,
  novembre 2026). Niente fotografie della scultura (artista vivente, in Italia non c'è libertà
  di panorama): solo la nostra illustrazione e la xilografia di Dürer.
- Niente orari, prezzi o calendari scritti a mano: si rimanda alla pagina ufficiale.
- Lingua: italiano, frasi semplici, niente gergo.

## Media

- Immagini e audio: solo da Wikimedia Commons con licenza verificata, caricati con
  `https://commons.wikimedia.org/wiki/Special:FilePath/<NomeFile>?width=960`. Sotto ogni
  immagine: autore, licenza, link alla pagina.
- Video: solo incorporati da `https://www.youtube-nocookie.com/embed/<id>`, e solo dopo un
  clic dell'utente ("Carica il video da YouTube"), per non tracciare chi apre la finestra.
- Webcam: solo link esterni (i termini d'uso per l'incorporamento non sono stati verificati).
  Sul Ponte Vecchio non esiste una webcam funzionante: non fingerla.

## Dati live

- **Brenta** (dal browser, CORS aperto, senza chiave):
  `https://api.arpa.veneto.it/REST/v1/meteo_meteogrammi_tabella?codseqst=300001722`
  restituisce circa tre giorni di livello (m) e portata (m³/s) ogni 10 minuti per la stazione
  "Brenta a Barzizza". Dire sempre che la stazione è circa 1 km a monte del ponte e che i dati
  non sono validati. Se la chiamata fallisce: messaggio chiaro, nessun numero finto.
- **Aria** (nessun CORS: la scarica uno script e salva `public/data/aria.json`):
  `https://www2.arpa.veneto.it/aria-json/exported/aria/data.json`, stazione `codseqst 500000106`.
  Mostrare sempre data e ora della fotografia.
- Attribuzione: "Fonte: ARPAV, dati non validati".

## Architettura

Sito statico: Vite + TypeScript, nessun framework, nessun server. I contratti tra le parti
stanno in `src/types.ts`.

| Parte | File | Cosa fa |
|---|---|---|
| Dati di base | `scripts/dati-osm.mjs` → `public/data/base.json` | Scarica edifici, strade, acqua, verde da Overpass e li converte in metri locali |
| Dati strati | `scripts/dati-strati.mjs` → `public/data/strati.json` | Punti e linee di Cultura, Ambiente, Mobilità |
| Dati aria | `scripts/dati-aria.mjs` → `public/data/aria.json` | Fotografia della qualità dell'aria |
| Proiezione | `src/map/proiezione.ts` | Gradi ↔ metri locali ↔ schermo. Funzioni pure, con test |
| Mappa | `src/map/*.ts` | Camera, disegno su canvas, ordinamento, clic sugli oggetti |
| Storie | `content/luoghi/*.json` | Un file per luogo, tipo `Storia` |
| Luoghi simbolo | `public/landmarks/*.svg` + `indice.json` | Illustrazioni isometriche |
| Interfaccia | `src/ui/*.ts`, `src/stile.css` | Strati, finestra-racconto, fonti |
| Live | `src/live/*.ts` | Brenta e aria |
| Avvio | `index.html`, `src/main.ts` | Collega tutto |

### Proiezione (vincolante per mappa e illustrazioni)

- Metri locali: `x = (lon - lon0) * 111320 * cos(lat0)`, `y = (lat - lat0) * 110574`, con
  origine in `ORIGINE`.
- Isometria 2:1 con il nord in alto a sinistra e l'est in alto a destra. Si guarda la città
  da sud-ovest: ciò che è più a nord-est è più lontano e va disegnato per primo.
  `sx = (x - y) * 0.7071`, `sy = -(x + y) * 0.35355 - z * 0.8165`.
- Gli SVG dei luoghi simbolo sono disegnati nella stessa proiezione: le linee orizzontali del
  terreno salgono o scendono con pendenza 1:2, le verticali restano verticali.

### Interfaccia del modulo mappa (`src/map/index.ts`)

```ts
export interface OpzioniMappa {
  canvas: HTMLCanvasElement;
  base: DatiBase;
  strati: DatiStrati;
  landmark: Landmark[];
  alClic: (bersaglio: { storia?: string; punto?: Punto } | null) => void;
}
export interface Mappa {
  mostraStrato(id: IdStrato, visibile: boolean): void;
  vaiA(lonlat: LonLat, zoom?: number): void;
  zooma(fattore: number): void;   // > 1 avvicina, < 1 allontana, attorno al centro
  evidenzia(storia: string | null): void;
  distruggi(): void;
}
export function creaMappa(opzioni: OpzioniMappa): Mappa;
```

### Interfaccia del modulo interfaccia (`src/ui/index.ts`)

```ts
export interface OpzioniUI {
  radice: HTMLElement;
  storie: Storia[];
  strati: DatiStrati;
  alCambioStrato: (id: IdStrato, visibile: boolean) => void;
  alVaiA: (lonlat: LonLat) => void;
  alloZoom?: (fattore: number) => void;  // bottoni «Avvicina» e «Allontana»
  allaChiusura: () => void;
}
export interface UI {
  apriStoria(id: string): void;
  apriPunto(punto: Punto): void;
  chiudi(): void;
}
export function creaUI(opzioni: OpzioniUI): UI;
```

### Interfaccia del modulo live (`src/live/index.ts`)

```ts
export interface LetturaBrenta { livello: number; portata: number | null;
  quandoPortata: string | null; // spesso un passo prima del livello: se è diversa si mostra
  quando: string; serie: { quando: string; livello: number }[] }
export function leggiBrenta(): Promise<LetturaBrenta>;   // rifiuta se la rete fallisce
export function leggiAria(): Promise<DatiAria>;           // legge public/data/aria.json
```

### Avvio (`index.html`, `src/main.ts`)

- La pagina contiene `<canvas id="mappa">`, `<div id="ui">` e un avviso di caricamento
  (`#avvio`, classe `.avviso-pagina`) che `main.ts` toglie quando tutto è pronto o trasforma in
  un messaggio di errore con il tasto «Riprova».
- `main.ts` scarica `data/base.json`, `data/strati.json` e `landmarks/indice.json` da
  `import.meta.env.BASE_URL` e importa le storie con `import.meta.glob`. Vite usa `base: './'`.
- Clic sulla mappa: `{storia}` apre il racconto, `{punto}` la scheda, `null` non fa nulla.
- Fuori dall'interfaccia `UI`: a ogni `apriStoria` l'interfaccia lancia su `radice` l'evento
  `ba:storia` (`detail: { id }`); `main.ts` lo usa per chiamare `mappa.evidenzia(id)`, così il
  luogo si accende anche quando lo si sceglie dall'elenco. A ogni `apriPunto` lancia `ba:punto`
  (`detail: { id }`) e l'evidenza si spegne subito. Dopo `allaChiusura` l'evidenza resta accesa
  ancora qualche secondo, o fino al primo gesto sulla mappa, così si riconosce il luogo appena
  letto.
- Tutto ciò che si apre con un clic sulla mappa si apre anche dall'elenco «Luoghi»: i racconti,
  il gruppo «Dati e servizi» (aria, idrometro, webcam, stazione) e, cercando, ogni altro punto
  degli strati. Lo zoom ha due bottoni e il doppio clic o doppio tocco, oltre a rotella, due
  dita e tasti + e -.
- Attributi facoltativi su `radice`, letti da `creaUI` per «Fonti e licenze»:
  `data-base-generato` (lo imposta `main.ts` da `base.generato`), `data-codice`,
  `data-segnalazioni`.
- `alVaiA` riporta le coordinate dentro `RIQUADRO`. Unica eccezione documentata al riquadro:
  la storia `monte-grappa` tiene le coordinate vere della cima (fuori mappa) e sulla mappa ha
  un segnaposto sul margine nord-est.
- Una storia con un disegno ha `landmark` uguale all'`id` in `public/landmarks/indice.json`.
- In `indice.json`, `larghezzaMetri` è la larghezza dell'SVG sul piano isometrico (la larghezza
  sullo schermo a zoom 1), non quella reale dell'edificio: `((x2 - y2) - (x1 - y1)) * 0.7071`
  tra il punto più a ovest e quello più a est del disegno. `copre` (facoltativo) è il raggio in
  metri entro cui le case generiche attorno al luogo vengono nascoste. `davanti` (facoltativo) è
  la profondità in metri della fascia verso chi guarda in cui si nascondono solo le case che
  stanno davanti al disegno, dentro la sua larghezza.
- Dove un luogo simbolo è disegnato, il segnaposto della sua storia non si disegna: al suo
  posto c'è il nome del luogo, sempre visibile.
- `tests/contenuti.test.ts` controlla storie, strati, luoghi simbolo, base e aria contro
  `src/types.ts`.

## Aspetto

Una cartolina illustrata, non una dashboard. Carta color crema, tetti in cotto, intonaci
ocra e rosa veneziani, Brenta verde-azzurro, verde dei colli morbido. Contorni sottili color
seppia. Titoli in Fraunces, testi in Inter (pacchetti `@fontsource`, niente font da server
esterni). Niente gradienti viola, niente vetro sfocato, niente emoji. Deve funzionare su
telefono (la finestra-racconto diventa un foglio dal basso) e da tastiera; rispettare
`prefers-reduced-motion`.

## Prestazioni

Gli edifici sono migliaia: disegnare solo ciò che è nel riquadro visibile, ordinare una volta
sola, a zoom basso disegnare sagome semplificate. Obiettivo: trascinamento fluido su un
portatile normale.

## Licenze

Codice MIT. Dati OpenStreetMap ODbL ("© OpenStreetMap contributors"). Dati ARPAV con
attribuzione. Media: licenza di ciascun file.

## Da confermare prima della pubblicazione

L'elenco completo delle domande aperte sta nella ricerca (`open_questions`). Le principali:
distruzione del ponte nel 1945; ruolo degli Alpini nel 1948; numeri del 26 settembre 1944;
conferma scritta ARPAV per l'uso continuo dell'API; permessi per le webcam.
