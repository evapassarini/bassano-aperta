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
5. Nello strato Mobilità, la scheda della stazione mostra i **prossimi treni** con i ritardi
   dichiarati, letti in diretta.
6. Dall'elenco «Luoghi» si apre la scheda **Avvisi sulla viabilità**: gli avvisi pubblicati
   dagli enti per le strade attorno a Bassano, come fotografia con data e ora.
7. Una pagina **Fonti e licenze** elenca ogni fonte, con data.
8. La mappa si guarda in tre luci: **giorno**, **pomeriggio**, **notte**. Un comando in basso a
   sinistra offre quattro scelte: Adesso, Giorno, Pomeriggio, Notte. Di notte la mappa diventa
   scura e si accendono i lampioni lungo le strade.
9. Sempre in basso a sinistra, un riquadro **Aria** mostra in breve l'ultima misura della
   qualità dell'aria, con la data.

Fuori dalla v1: bilancio del Comune (SIOPE), quartieri e servizi, traffico in tempo reale
strada per strada (code, tempi di percorrenza, strade colorate sulla mappa), posizione dei treni
lungo la linea, rilievo, tasselli dipinti con AI. Gli avvisi sulla viabilità non
sono il traffico: sono testi pubblicati dagli enti, e il sito lo dice.

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
  Mostrare sempre data e ora della fotografia nella scheda della stazione. Nel riquadro breve
  sulla mappa vale la regola scritta più sotto (data della misura; data della fotografia se è
  vecchia o se la misura non ha una data).
- Attribuzione: "Fonte: ARPAV, dati non validati".
- **Treni alla stazione di Bassano** (dal browser, CORS aperto, senza chiave):
  `https://proxy.busone.app/trenitalia/gtfs-rt/trip-updates.json`, il feed GTFS-Realtime di
  BusOne in JSON (circa 1 MB, tutte le corse nazionali). Si tengono le corse che fermano al
  codice `02520` (e figlie `02520:...`), da un'ora fa a sei ore avanti.
  - Ogni richiesta manda gli header `X-BusOne-Client: bassano-aperta (progetto civico open
    source)` e `X-BusOne-Use: personal`. Solo verso BusOne, mai verso altri indirizzi.
  - Condizioni di BusOne: gratuito per usi non commerciali di privati ed enti non profit;
    attribuzione obbligatoria "BusOne (busone.app) e fonte originale" (Trenitalia); BusOne può
    revocare il servizio.
  - Limiti: si mostrano solo i ritardi. Dire sempre che sono quelli dichiarati dall'operatore,
    rielaborati da BusOne, non ufficiali. Le posizioni dei treni in quel feed sono stime: non
    si leggono e non si mostrano mai.
  - Il feed non è l'orario completo: contiene solo le corse seguite in diretta. Le corse
    soppresse arrivano di solito senza elenco delle fermate, quindi non si può sapere se
    passavano da Bassano e non compaiono. Il riquadro lo dice sempre: «L'elenco può non essere
    completo: un treno soppresso, o senza dati in diretta, può non comparire». Per mostrarle
    servirebbe una tabella delle corse che fermano a Bassano, ricavata da `stop_times.txt`
    dello stesso `gtfs.zip`: non c'è ancora.
  - Nel feed l'ora è quella prevista, con il ritardo già dentro. Sulla riga si mostra l'ora
    dell'orario ufficiale (ora prevista meno ritardo), come sui tabelloni di stazione, con il
    ritardo accanto e, quando non è zero, anche «previsto alle HH:MM». Il riquadro spiega quale
    ora è scritta.
  - Mostrare sempre l'ora di emissione del feed. Il risultato resta in memoria 2 minuti; il
    riquadro non si aggiorna da solo, rilegge quando si riapre la scheda.
  - Se la chiamata fallisce o il feed è malformato: messaggio chiaro con «Riprova», nessun
    numero finto.
  - I nomi delle stazioni di origine e destinazione vengono da `public/data/stazioni-treni.json`
    (`{ generato, fonte: { nome, url, licenza }, stazioni: { "02520": "Bassano del Grappa" } }`),
    che uno script ricava da `stops.txt` dentro `https://proxy.busone.app/trenitalia/gtfs.zip`
    (25 MB: si scarica solo quando si rigenera la tabella, mai a ogni visita). Solo il Nord-Est.
    Se un nome manca non si mostra il codice: si tace. Se la tabella non arriva i treni si
    mostrano senza nomi. La data della tabella (`generato`) si legge in «Fonti e licenze».
- **Avvisi sulla viabilità** (nessun CORS: li scarica uno script e salva
  `public/data/avvisi.json`, tipo `DatiAvvisi`). È una fotografia, non il traffico in tempo
  reale: mostrare sempre data e ora di `generato`. Due fonti:
  - CCISS Viaggiare Informati, `https://www.cciss.it/rss`: eventi sulla SS47 Valsugana, sulla
    SS248 e sulla Pedemontana Veneta vicino a Bassano (`tipo: 'evento'`). Durano poche ore: la
    scheda mostra solo quelli delle ultime 24 ore. Non hanno una pagina propria: il link porta a
    `https://www.cciss.it/`.
  - Vi.abilità (Provincia di Vicenza), `https://vi-abilita.it/feed/`: ordinanze sulle strade
    provinciali nei comuni del bassanese (`tipo: 'ordinanza'`), ultimi 120 giorni, al massimo
    dieci. `quando` è la data di pubblicazione, non il periodo dei lavori: vanno presentate come
    ordinanze pubblicate, non come lavori in corso. Il testo si legge da `<content:encoded>`
    (il riassunto in `<description>` si ferma spesso prima della data di fine lavori) ed è
    composto così: dove, poi «Periodo: dal ... al ...» per intero, poi che cosa; il taglio a 280
    caratteri non toglie mai il periodo. Le ordinanze che dichiarano un periodo già finito
    quando gira lo script non entrano nella fotografia.
  - Nessuna delle due fonti dichiara una licenza di riuso. Per questo: solo una citazione breve
    (al massimo 280 caratteri, senza HTML), sempre con il nome della fonte e il link alla pagina
    originale; nel campo `licenza` si scrive "Non dichiarata: citazione breve con link alla
    fonte".
  - In `fonti` ci sono solo le fonti di cui la fotografia contiene i dati: l'interfaccia non
    dà per scontato che siano due, e se ne manca una lo dice («In questa fotografia mancano
    ...») con il link al sito. Se il file manca: messaggio chiaro e link ai due siti.
  - Se Vi.abilità non risponde lo script tiene le ordinanze della fotografia precedente ancora
    dentro i 120 giorni; se non risponde CCISS gli eventi vecchi non si conservano. In tutti e
    due i casi scrive il file ed esce con codice 2. Un feed senza voci, o senza nessuna data
    leggibile, vale come fonte che non risponde. Se mancano tutte e due esce con codice 1 e non
    tocca il file.
  - La scheda non dice mai nulla su «questo momento»: se non ci sono avvisi scrive «Nella
    fotografia del ... non ci sono avvisi per la zona di Bassano». Se la fotografia ha più di 24
    ore lo dice e rimanda ai siti delle fonti. Le ordinanze pubblicate da più di 120 giorni
    rispetto al momento della lettura non si mostrano.
  - Dai testi si tolgono l'intestazione di protocollo, le sigle e i nomi di chi ha scritto
    l'atto, i nomi dei file allegati e i riferimenti d'ufficio dentro il testo (concessione
    prot., OM, AREA EST, CUP, CIG); la formula fissa diventa «Senso unico alternato». Nessun
    dato di persone nei file.
  - Accessibilità di treni e avvisi: gli elenchi non sono zone `aria-live`; a chi usa un lettore
    di schermo si annuncia una sola frase breve (`role="status"`), per esempio «6 treni nelle
    prossime ore». Dopo «Riprova» il fuoco resta nel riquadro. Ogni link «Leggi alla fonte» dice
    anche la strada a chi ascolta.

## Luce della mappa e lampioni

- Tre luci (`Luce` in `src/types.ts`): `giorno`, `pomeriggio`, `notte`. Quattro scelte per chi
  guarda (`SceltaLuce`): **Adesso**, **Giorno**, **Pomeriggio**, **Notte**.
- **Adesso** segue l'ora vera di Bassano con `luceAdesso(quando)` di `src/luce.ts`, che calcola
  l'altezza del sole sull'orizzonte (`altezzaSole`, formula approssimata, errore sotto un grado,
  nessuna rete). Regole: `notte` se il sole è più di 4 gradi sotto l'orizzonte; `pomeriggio` se
  il sole sta scendendo ed è sotto i 14 gradi (le ultime due ore circa di luce); altrimenti
  `giorno`. La mattina presto è quindi `giorno`. Esempio: il 15 novembre alle 17:00 è ancora `pomeriggio`, alle
  17:10 è `notte`.
- Con «Adesso» scelto l'interfaccia ricontrolla l'ora ogni minuto e quando la scheda del browser
  torna in primo piano, e cambia luce da sola. Il bottone dice quale luce è in corso («Adesso»
  e sotto «notte»).
- La scelta si ricorda nel browser (`localStorage`, chiave `ba:luce`, dentro try/catch: senza
  memoria la pagina funziona lo stesso). Alla prima visita, o con un valore sconosciuto, vale
  «Adesso».
- **Giorno** è l'aspetto di sempre. **Pomeriggio**: luce calda e bassa, toni dorati, pareti in
  ombra più marcate, ombre degli alberi più lunghe, Brenta più caldo. **Notte**: carta blu
  scuro, case e strade ancora distinguibili, Brenta scuro, lampioni accesi con un alone caldo,
  qualche finestra illuminata, nomi chiari con alone scuro. I luoghi simbolo si scuriscono
  insieme alla mappa e prendono una luce calda dal basso. Segnaposto ed evidenza non cambiano.
- I pannelli dell'interfaccia restano di carta crema in ogni luce.
- Le tre tavolozze stanno in `src/map/palette.ts` (`PALETTE_PER_LUCE`) e hanno le stesse chiavi.
  Il passaggio tra due luci è una dissolvenza breve, che non parte con
  `prefers-reduced-motion`.
- **Lampioni** (`public/data/lampioni.json`, tipo `DatiLampioni`): punti in metri locali
  `[x0, y0, ...]`. I primi `veri` vengono da OpenStreetMap (`highway=street_lamp`); a Bassano
  sono pochi. Gli altri li dispone `scripts/dati-lampioni.mjs` lungo le strade di `base.json`
  e sul bordo delle aree di tipo `piazza` (rientrati di 2,5 m, dopo le strade principali e
  secondarie e prima di vie e vicoli; stessa distanza minima di 24 m), con regole fisse (nessun
  caso: a ogni corsa gli stessi punti), **a scopo illustrativo**. Il
  sito lo dichiara in «Fonti e licenze» con i due numeri: non è un rilievo dell'illuminazione
  pubblica e non va presentato come tale.
- Se Overpass non risponde lo script tiene i lampioni rilevati del `lampioni.json` che c'è già
  (i primi `veri` punti) e lo scrive in console; scrive `veri: 0` solo se un file precedente con
  lampioni rilevati non esiste.
- Disegno dei lampioni: di giorno e al pomeriggio un piccolo palo, solo da vicino (zoom 3 in
  su). Di notte, a zoom basso, solo gli aloni; da vicino anche palo e lampada accesa. L'alone è
  un'immagine sola disegnata una volta e riusata; si disegnano solo i lampioni in vista.
- Da molto lontano non si accendono tutti gli aloni: sotto zoom 0,2 la metà, da zoom 0,5 in su
  tutti, in mezzo la quota cresce un poco alla volta (`quotaAloni`). Quali lampioni restano
  accesi lo decide un numero fisso per lampione (`rangoLampioni`), non ciò che è in vista:
  trascinando la mappa le luci non cambiano e non ci sono scatti di luminosità.
- Luoghi simbolo nelle luci diverse dal giorno (`src/map/immagini.ts`): il velo si moltiplica
  sul disegno steso su fondo nero, così le ombre a terra degli SVG restano ombre; la luce calda
  della notte cade solo sulle parti piene. Un elemento dell'SVG con `fill` uguale al colore
  dell'acqua di giorno (`#7fb8ad`, oggi solo il Brenta sotto il Ponte Vecchio) è una pezza
  d'acqua: prende il colore dell'acqua della luce in corso (`illustrazioni.acqua` nella
  tavolozza). Le pezze vanno scritte come elementi chiusi in se stessi, fuori da gruppi con
  trasformazioni.
- Se `lampioni.json` manca la mappa parte lo stesso: la notte è buia ma funziona.
- Solo in sviluppo (`npm run dev`): `?luce=notte` (o `pomeriggio`, `giorno`) nell'indirizzo
  blocca la mappa su quella luce, qualunque cosa dica il comando. Serve per prove e schermate;
  nel sito pubblicato non esiste.

## Architettura

Sito statico: Vite + TypeScript, nessun framework, nessun server. I contratti tra le parti
stanno in `src/types.ts`.

| Parte | File | Cosa fa |
|---|---|---|
| Dati di base | `scripts/dati-osm.mjs` → `public/data/base.json` | Scarica edifici, strade, acqua, verde da Overpass e li converte in metri locali |
| Dati strati | `scripts/dati-strati.mjs` → `public/data/strati.json` | Punti e linee di Cultura, Ambiente, Mobilità |
| Dati lampioni | `scripts/dati-lampioni.mjs` (+ `scripts/lib/lampioni.mjs`) → `public/data/lampioni.json` | Lampioni rilevati da OpenStreetMap, più quelli illustrativi disposti lungo le strade |
| Dati aria | `scripts/dati-aria.mjs` → `public/data/aria.json` | Fotografia della qualità dell'aria |
| Dati avvisi | `scripts/dati-avvisi.mjs` (+ `scripts/lib/avvisi.mjs`) → `public/data/avvisi.json` | Fotografia degli avvisi sulla viabilità (CCISS, Vi.abilità) |
| Dati stazioni | `scripts/dati-stazioni.mjs` (+ `scripts/lib/stazioni.mjs`) → `public/data/stazioni-treni.json` | Tabella codice → nome delle stazioni dei treni. Fuori da `npm run dati`: si rilancia a mano |
| Proiezione | `src/map/proiezione.ts` | Gradi ↔ metri locali ↔ schermo. Funzioni pure, con test |
| Luce | `src/luce.ts` | Altezza del sole a Bassano e luce di un dato momento. Funzioni pure, con test |
| Mappa | `src/map/*.ts` | Camera, disegno su canvas nelle tre luci, lampioni, ordinamento, clic sugli oggetti |
| Storie | `content/luoghi/*.json` | Un file per luogo, tipo `Storia` |
| Luoghi simbolo | `public/landmarks/*.svg` + `indice.json` | Illustrazioni isometriche |
| Interfaccia | `src/ui/*.ts`, `src/stile.css` | Strati, luce della mappa, aria in breve, finestra-racconto, scheda avvisi, fonti |
| Live | `src/live/*.ts` | Brenta, aria, treni, avvisi |
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
  lampioni?: number[];            // DatiLampioni.p; senza, la notte è buia ma funziona
}
export interface Mappa {
  mostraStrato(id: IdStrato, visibile: boolean): void;
  vaiA(lonlat: LonLat, zoom?: number): void;
  zooma(fattore: number): void;   // > 1 avvicina, < 1 allontana, attorno al centro
  evidenzia(storia: string | null): void;
  impostaLuce(luce: Luce): void;  // all'avvio vale 'giorno'; con la luce già attiva non fa nulla
  distruggi(): void;
}
export function creaMappa(opzioni: OpzioniMappa): Mappa;
```

Sul canvas resta scritto l'attributo `data-luce` con la luce in corso.

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
  alCambioLuce?: (luce: Luce) => void;   // una volta all'avvio, dentro creaUI, poi solo quando la luce effettiva cambia
  adesso?: () => Date;                   // per i test; predefinito () => new Date()
}
export interface UI {
  apriStoria(id: string): void;
  apriPunto(punto: Punto): void;
  chiudi(): void;
  distruggi(): void;   // ferma il controllo dell'ora di «Adesso» e l'ascolto dei tasti sulla pagina
}
export function creaUI(opzioni: OpzioniUI): UI;
```

`creaUI` scrive la luce in corso anche su `radice`, nell'attributo `data-luce`. Passare da
«Adesso» di notte a «Notte» non richiama `alCambioLuce`: la luce effettiva è la stessa.

Dove stanno i comandi. Da 720 px di larghezza in su: in alto a sinistra testata, strati,
«Luoghi» e «Fonti e licenze»; **in basso a sinistra** il riquadro Aria e, sotto, le quattro
scelte della luce, larghi come la colonna di sinistra; lo zoom in basso a destra (accanto alla
finestra quando un racconto o una scheda è aperta). Su telefono: in basso a sinistra, dal basso
verso l'alto, «Luoghi» e «Fonti e licenze», le scelte della luce, il riquadro Aria; lo zoom in
basso a destra; con il foglio dal basso aperto, luce, Aria e zoom si nascondono. Le scelte della
luce sono un gruppo di scelte esclusive (`role="radiogroup"`, «Luce della mappa»): Tab entra, le
frecce cambiano scelta. Ogni scelta è alta almeno 44 px, come gli altri comandi sulla mappa; su
telefono il gruppo prende tutta la larghezza che resta accanto allo zoom. Se la finestra è larga
ma bassa (sotto 36em di altezza: la soglia cresce con il testo) Aria e luce si spostano accanto
alla colonna di sinistra; sopra quella soglia la colonna in alto non scende mai sopra Aria e
luce e, se manca il posto, scorre.

Il riquadro **Aria** legge `leggiAria()` e mostra una misura sola, senza giudizi: «Aria ·
ARPAV» e sotto il valore con la data della misura (PM10 se c'è, altrimenti la prima misura
valida). La data della fotografia («foto del ...») compare se la fotografia ha più di 3 giorni
oppure se la misura non ha una data propria: il numero non resta mai senza una data. Una data
di un altro anno porta anche l'anno. L'attribuzione per intero («Fonte: ARPAV, dati non
validati») sta nel testo per i lettori di schermo e nel suggerimento al passaggio del mouse;
la scheda che si apre la mostra scritta. Se il file non arriva scrive «Aria: dato non
disponibile». Nessun numero finto. Al clic apre la scheda della stazione dell'aria (il punto di
tipo `aria` degli strati), senza spostare la mappa e senza accendere lo strato.

Treni e avvisi non cambiano questa interfaccia. Il riquadro «Prossimi treni» sta nella scheda
del punto di tipo `stazione` (al massimo 8 treni, divisi in Partenze, transiti compresi, e
Arrivi). La scheda «Avvisi sulla viabilità» si apre dalla voce omonima del gruppo «Dati e
servizi» dell'elenco «Luoghi»: non è un punto della mappa, non sposta la mappa e non accende
strati.

### Interfaccia del modulo live (`src/live/index.ts`)

```ts
export interface LetturaBrenta { livello: number; portata: number | null;
  quandoPortata: string | null; // spesso un passo prima del livello: se è diversa si mostra
  quando: string; serie: { quando: string; livello: number }[] }
export function leggiBrenta(): Promise<LetturaBrenta>;   // rifiuta se la rete fallisce
export function leggiAria(): Promise<DatiAria>;           // legge public/data/aria.json
export function leggiTreni(): Promise<LetturaTreni>;     // feed BusOne + tabella stazioni; in memoria 2 minuti; rifiuta se la rete fallisce o il feed è malformato
export function leggiAvvisi(): Promise<DatiAvvisi>;       // legge public/data/avvisi.json
export function leggiDataStazioni(): Promise<string>;    // `generato` di public/data/stazioni-treni.json, per «Fonti e licenze»
```

`src/live/treni.ts` contiene la parte pura, con test:
`interpretaTreni(feed, stazioni, adesso): LetturaTreni`. Accetta chiavi in camelCase e in
snake_case. Il numero del treno è il gruppo di cifre dopo `_v_N-` o `_p_N-` nel `tripId` (N
segue la linea: `_v_1-`, `_v_5-`, `_v_62-` ...); se non si riconosce il treno resta in elenco
con `numero` vuoto e la riga dice «numero non indicato».
`quando` è `departure.time` (o `arrival.time` se la corsa termina a Bassano), che contiene già
il ritardo. Una corsa è soppressa se è `CANCELED` o se la fermata di Bassano è `SKIPPED`, ma
solo quando porta ancora con sé la fermata di Bassano e il suo orario: nel feed vero le corse
`CANCELED` arrivano quasi sempre senza fermate e non si possono attribuire a Bassano.

### Avvio (`index.html`, `src/main.ts`)

- La pagina contiene `<canvas id="mappa">`, `<div id="ui">` e un avviso di caricamento
  (`#avvio`, classe `.avviso-pagina`) che `main.ts` toglie quando tutto è pronto o trasforma in
  un messaggio di errore con il tasto «Riprova».
- `main.ts` scarica `data/base.json`, `data/strati.json` e `landmarks/indice.json` da
  `import.meta.env.BASE_URL` e importa le storie con `import.meta.glob`. Vite usa `base: './'`.
- Scarica anche `data/lampioni.json`, ma senza pretenderlo: se manca o è rovinato la mappa parte
  lo stesso. Passa `lampioni` a `creaMappa` e collega `alCambioLuce` a `mappa.impostaLuce`. La
  mappa va creata prima dell'interfaccia, perché la prima chiamata arriva dentro `creaUI`.
- Clic sulla mappa: `{storia}` apre il racconto, `{punto}` la scheda, `null` non fa nulla.
- Fuori dall'interfaccia `UI`: a ogni `apriStoria` l'interfaccia lancia su `radice` l'evento
  `ba:storia` (`detail: { id }`); `main.ts` lo usa per chiamare `mappa.evidenzia(id)`, così il
  luogo si accende anche quando lo si sceglie dall'elenco. A ogni `apriPunto` lancia `ba:punto`
  (`detail: { id }`) e l'evidenza si spegne subito. Dopo `allaChiusura` l'evidenza resta accesa
  ancora qualche secondo, o fino al primo gesto sulla mappa, così si riconosce il luogo appena
  letto.
- Tutto ciò che si apre con un clic sulla mappa si apre anche dall'elenco «Luoghi»: i racconti,
  il gruppo «Dati e servizi» (aria, idrometro, webcam, stazione) e, cercando, ogni altro punto
  degli strati. Nello stesso gruppo c'è la voce «Avvisi sulla viabilità», che non ha un punto
  sulla mappa: quando si apre, l'interfaccia lancia `ba:punto` con
  `detail: { id: 'avvisi-viabilita' }`, così l'evidenza si spegne come per gli altri punti. Lo zoom ha due bottoni e il doppio clic o doppio tocco, oltre a rotella, due
  dita e tasti + e -.
- Attributi facoltativi su `radice`, letti da `creaUI` per «Fonti e licenze»:
  `data-base-generato` (lo imposta `main.ts` da `base.generato`), `data-lampioni-veri` e
  `data-lampioni-tutti` (li imposta `main.ts` da `lampioni.json`: quanti lampioni vengono da
  OpenStreetMap e quanti sono in tutto), `data-codice`, `data-segnalazioni`.
- `alVaiA` riporta le coordinate dentro `RIQUADRO`. Unica eccezione documentata al riquadro:
  la storia `monte-grappa` tiene le coordinate vere della cima (fuori mappa) e sulla mappa ha
  un segnaposto sul margine nord-est.
- Una storia con un disegno ha `landmark` uguale all'`id` in `public/landmarks/indice.json`.
- In `indice.json`, `larghezzaMetri` è la larghezza dell'SVG sul piano isometrico (la larghezza
  sullo schermo a zoom 1), non quella reale dell'edificio: `((x2 - y2) - (x1 - y1)) * 0.7071`
  tra il punto più a ovest e quello più a est del disegno. `copre` (facoltativo) è il raggio in
  metri entro cui le case generiche attorno al luogo vengono nascoste. `davanti` (facoltativo) è
  la profondità in metri della fascia verso chi guarda in cui le case che stanno davanti al
  disegno, dentro la sua larghezza, restano sulla mappa ma si disegnano basse (un piano).
- Dove un luogo simbolo è disegnato, il segnaposto della sua storia non si disegna: al suo
  posto c'è il nome del luogo, sempre visibile.
- `tests/contenuti.test.ts` controlla storie, strati, luoghi simbolo, base, lampioni, aria, avvisi e
  tabella delle stazioni contro `src/types.ts`.

## Aspetto

Una cartolina illustrata, non una dashboard. Carta color crema, tetti in cotto, intonaci
ocra e rosa veneziani, Brenta verde-azzurro, verde dei colli morbido. Contorni sottili color
seppia. Titoli in Fraunces, testi in Inter (pacchetti `@fontsource`, niente font da server
esterni). Niente gradienti viola, niente vetro sfocato, niente emoji. Deve funzionare su
telefono (la finestra-racconto diventa un foglio dal basso) e da tastiera; rispettare
`prefers-reduced-motion`. Di notte la cartolina resta una cartolina: blu notte e luci calde,
non uno schermo nero. I pannelli restano di carta crema.

## Prestazioni

Gli edifici sono migliaia: disegnare solo ciò che è nel riquadro visibile, ordinare una volta
sola, a zoom basso disegnare sagome semplificate. I lampioni sono migliaia: solo quelli in
vista, un'immagine sola per l'alone, nessun gradiente creato a ogni fotogramma. Obiettivo:
trascinamento fluido su un portatile normale.

## Licenze

Codice MIT. Dati OpenStreetMap ODbL ("© OpenStreetMap contributors"). Dati ARPAV con
attribuzione. Treni: BusOne (busone.app) e Trenitalia, uso non commerciale di privati ed enti
non profit. Avvisi CCISS e Vi.abilità: licenza non dichiarata, solo citazioni brevi con link.
Media: licenza di ciascun file.

## Da confermare prima della pubblicazione

L'elenco completo delle domande aperte sta nella ricerca (`open_questions`). Le principali:
distruzione del ponte nel 1945; ruolo degli Alpini nel 1948; numeri del 26 settembre 1944;
conferma scritta ARPAV per l'uso continuo dell'API; permessi per le webcam; chi firma il
progetto rispetto alle condizioni di BusOne (solo privati ed enti non profit) e il contatto
da mettere nell'header `X-BusOne-Client`; conferma scritta di CCISS e Vi.abilità per il riuso
degli avvisi. L'elenco completo è nel README.
