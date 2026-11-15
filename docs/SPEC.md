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
9. Sempre in basso a sinistra, un riquadro **Aria** dice a parole com'era l'aria nell'ultimo
   giorno misurato (buona, accettabile, mediocre, scadente, pessima) e sotto mostra l'ultima
   misura, con la data.

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
  Lo script salva anche le serie brevi che ARPAV pubblica per la stazione (`serie`, facoltativo):
  ozono, circa 48 medie orarie; PM10, circa 7 medie giornaliere. Nel file in diretta la stazione
  ha solo ozono e PM10. Il biossido di azoto la stazione lo misura, ma compare solo nei dati
  validati (`https://api.arpa.veneto.it/REST/v1/aria_tabella_cop?codseqst=500000106`, letto il
  15/11/2026: biossido di azoto 35 µg/m³ il 12/11). Non scrivere mai che a Bassano il biossido
  di azoto non si misura. Il PM2.5 nel file in diretta non c'è.
  Il giorno delle medie di PM10 non è una data di misura scritta da ARPAV: le voci hanno tutte
  l'ora dell'esportazione (il 15/11/2026 alle 11:40: da «2026-11-08 11:40:01» a «2026-11-14
  11:40:01»). Che sia il giorno misurato è verificato su un solo giorno e a metà giornata (12/11:
  in diretta 13,4, validato 13). Per questo lo script scarta le medie giornaliere di un giorno
  non ancora finito e confronta il PM10 in diretta, arrotondato all'intero, con quello validato
  dello stesso giorno: se sono diversi non salva `serie` e il sito non scrive nessun giudizio. Se
  la tabella validata non risponde o il suo giorno non è nella serie, il controllo non si fa e lo
  script lo scrive. Dalla tabella validata non si copia nessun numero.
- Attribuzione: "Fonte: ARPAV, dati non validati".

### Giudizio a parole sull'aria

Il solo numero dice poco a chi non è del mestiere: accanto ai numeri il sito scrive una parola.
La calcola `giudizioAria()` in `src/live/giudizioAria.ts`, dove sta l'unica tabella delle
soglie, con le fonti nel commento.

- **Scala**: le cinque classi dell'indice di qualità dell'aria (IQA) di ARPAV: buona,
  accettabile, mediocre, scadente, pessima. Fonti, lette il 15/11/2026:
  [la scala](https://www.arpa.veneto.it/temi-ambientali/aria/iqa/indice),
  [il calcolo](https://www.arpa.veneto.it/temi-ambientali/aria/iqa/indice-qualita-dellaria-approfondimenti),
  [i dati validati](https://www.arpa.veneto.it/dati-ambientali/dati-storici/aria/qualita-aria-dati-validati)
  (i confini delle classi sono nel codice di questa pagina).
- **Non è l'indice ARPAV** e non si chiama né «indice ARPAV» né «IQA»: ARPAV lo calcola solo su
  dati validati e solo con tutti e tre gli inquinanti (PM10, ozono, biossido di azoto). Noi
  abbiamo PM10 e ozono, non validati. Manca il biossido di azoto: il giudizio ufficiale può
  essere peggiore del nostro, e il sito lo dice. Non si scrive che l'ufficiale non può essere
  migliore: ARPAV parte da dati controllati e il nostro calcolo dell'ozono non è ancora stato
  confrontato con il suo, quindi i due giudizi possono differire in tutti e due i sensi.
- **Giorno**: quello dell'ultima media giornaliera di PM10 nella fotografia (di norma ieri).
  Mai oggi: il giorno deve essere finito. Lo controllano lo script (scarta le medie di un giorno
  non finito) e l'interfaccia: se il giorno del giudizio è oggi o dopo, per l'orologio del
  dispositivo, niente parola, solo i numeri e «Giudizio a parole non disponibile».
- **Grandezze e valori di riferimento** (µg/m³): PM10, media del giorno, riferimento 50; ozono,
  la più alta delle medie mobili su 8 ore del giorno (non l'ultima ora, non l'ora più alta),
  riferimento 120. Ogni valore si arrotonda all'intero e si divide per il suo riferimento; vale
  il peggiore dei due. Fino a metà del riferimento compresa: buona. Fino al riferimento:
  accettabile. Fino a una volta e mezzo: mediocre. Fino al doppio: scadente. Oltre: pessima. In
  concentrazioni: PM10 25, 50, 75, 100; ozono 60, 120, 180, 240.
- **Una parola sola**: il 50 e il 120 nel sito si chiamano sempre «valore di riferimento», come
  nella pagina ARPAV sul calcolo. Non «soglia di legge», non «limite», non «ha superato»: per
  dire che cosa prevede la legge (per esempio se un giorno sopra 50 è già una violazione) serve
  prima leggere e citare la norma. Non è stato fatto.
- **Ore dell'ozono**: l'ora scritta nel file è presa come fine dell'ora di misura («01» è l'ora
  da mezzanotte all'una; «00» del giorno dopo è l'ultima ora del giorno). Le 24 medie su 8 ore
  di un giorno sono quelle che finiscono dall'ora scritta 01 del giorno all'ora scritta 00 del
  giorno dopo: la prima va dalle 17 del giorno prima all'una, l'ultima dalle 16 alle 24. ARPAV
  non lo dichiara. Indizi letti il 15/11/2026: il file esportato alle 11:40 ha come ultima voce
  l'ora 11; la tabella validata numera le ore da 1 a 24.
- **Due numeri per lo stesso valore**: il giudizio usa il valore arrotondato all'intero, le
  misure hanno un decimale. Nella scheda la riga dei valori usati lo dice («15 µg/m³ (14,7
  arrotondato)») e le avvertenze scrivono «Per il giudizio i valori si arrotondano all'intero».
- **Dati che non bastano**: una media su 8 ore vale con almeno 6 ore su 8, e servono almeno 18
  medie valide nel giorno. Se manca il PM10 o l'ozono di quel giorno, nessuna parola: restano
  solo i numeri e la scheda scrive «Giudizio a parole non disponibile». Mai una parola
  inventata, mai un giudizio su un inquinante solo.
- **Giudizio vecchio**: se il giorno ha più di 3 giorni il giudizio si presenta con la sua data
  («Aria il 10 novembre: buona»), non come attuale, e la scheda dice quanti giorni sono passati.
- **Avvertenze, sempre scritte nella scheda**: giudizio calcolato da questo sito con le fasce di
  ARPAV, su dati ARPAV non validati; guarda solo PM10 e ozono, manca il biossido di azoto e il
  giudizio ufficiale può essere peggiore o comunque diverso; i valori si arrotondano all'intero;
  vale per il giorno indicato, non per adesso e non per l'anno; non sostituisce il bollettino
  ufficiale, con il link ai dati validati di ARPAV. Nessun consiglio sanitario.
- **Colore**: accanto alla parola c'è un tondo colorato con il bordo scuro. La parola è sempre
  scritta: il colore non è mai l'unico modo di capire.
- **Scelte nostre, non scritte da ARPAV**: l'arrotondamento all'intero prima del rapporto,
  verificato su un solo caso e solo per il PM10 (Bassano, 12/11/2026: 13,4 è diventato 13 e
  l'indice 26); che valga anche per l'ozono e che i mezzi vadano in su (25,5 diventa 26) non è
  verificato, quindi sul confine tra due classi il nostro giudizio può differire di una classe
  da quello ufficiale; la regola dei dati minimi (direttiva UE 2024/2881); l'ora scritta nel
  file presa come fine dell'ora di misura (vedi «Ore dell'ozono»: se fosse l'inizio, le finestre
  si spostano di un'ora); i confini dell'ozono in concentrazione e il 25 del PM10, che sono
  aritmetica dai riferimenti ARPAV.
- **Da fare prima di pubblicare**: in un giorno feriale, quando un giorno validato cade dentro
  le 48 ore di ozono, confrontare la nostra media mobile con `CONC_MM_O3` e il nostro giudizio
  con `IQA` della tabella validata (`aria_tabella_cop`). Il 15/11/2026 il confronto per l'ozono
  non era possibile (validato fermo al 12, orari dal 13). Guardare a mano anche un'esportazione
  del file in diretta tra le 00:00 e le 02:00, per vedere che giorno portano le voci del PM10
  subito dopo mezzanotte, e scrivere qui l'esito.
- **Alternativa aperta**: l'API ARPAV (`api.arpa.veneto.it/REST/v1/aria_tabella_cop`) dà
  l'indice ufficiale già calcolato per Bassano, con il biossido di azoto, ma in ritardo di
  alcuni giorni e senza licenza né documentazione dichiarate. Se la licenza si chiarisce,
  conviene mostrare quello come giudizio principale e tenere il nostro come riserva.
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
  ombra più marcate e più fredde, ombre degli alberi e delle case più lunghe, Brenta più caldo. **Notte**: carta blu
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
| Dati aria | `scripts/dati-aria.mjs` → `public/data/aria.json` | Fotografia della qualità dell'aria: ultime misure e serie brevi per il giudizio |
| Dati avvisi | `scripts/dati-avvisi.mjs` (+ `scripts/lib/avvisi.mjs`) → `public/data/avvisi.json` | Fotografia degli avvisi sulla viabilità (CCISS, Vi.abilità) |
| Dati stazioni | `scripts/dati-stazioni.mjs` (+ `scripts/lib/stazioni.mjs`) → `public/data/stazioni-treni.json` | Tabella codice → nome delle stazioni dei treni. Fuori da `npm run dati`: si rilancia a mano |
| Proiezione | `src/map/proiezione.ts` | Gradi ↔ metri locali ↔ schermo. Funzioni pure, con test |
| Luce | `src/luce.ts` | Altezza del sole a Bassano e luce di un dato momento. Funzioni pure, con test |
| Mappa | `src/map/*.ts` | Camera, disegno su canvas nelle tre luci, edifici dipinti (tetti in `tetti.ts`), lampioni, ordinamento, clic sugli oggetti |
| Storie | `content/luoghi/*.json` | Un file per luogo, tipo `Storia` |
| Luoghi simbolo | `public/landmarks/*.svg` + `indice.json` | Illustrazioni isometriche |
| Interfaccia | `src/ui/*.ts`, `src/stile.css` | Strati, luce della mappa, aria in breve, finestra-racconto, scheda avvisi, fonti |
| Live | `src/live/*.ts` | Brenta, aria e giudizio a parole sull'aria, treni, avvisi |
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

Il riquadro **Aria** legge `leggiAria()`. Per prima cosa scrive il giudizio a parole, con il
tondo colorato: «Aria buona · ieri» (dopo due o tre giorni la data al posto di «ieri»; oltre i
3 giorni «Aria il 10 novembre: buona»). Sotto, una misura sola: il valore con la data della
misura (PM10 se c'è, altrimenti la prima misura valida). In fondo, piccolo, «Dati ARPAV ·
giudizio del sito»; quando c'è anche la data della fotografia la riga si accorcia in «Dati ARPAV
· foto del 15 nov», per stare su una riga sola (di chi è il giudizio resta nel suggerimento e
nel testo per i lettori di schermo). Con il giudizio il riquadro ha tre righe ed è alto circa
66 px; con la luce il gruppo in basso è alto circa 126 px. Lo spazio riservato al gruppo è una
sola variabile CSS, `--gruppo-basso` (8.5rem): la usano la colonna in alto, lo zoom quando va
sopra il gruppo e l'aiuto dei tasti. Non scrivere altre altezze fisse. Se i dati non bastano per il giudizio il riquadro resta com'era: «Aria ·
ARPAV» e sotto il valore. La data della fotografia («foto del ...») compare se la fotografia ha
più di 3 giorni oppure se la misura non ha una data propria: il numero non resta mai senza una
data. Una data di un altro anno porta anche l'anno. L'attribuzione per intero («Fonte: ARPAV,
dati non validati», e con il giudizio anche «Giudizio calcolato da questo sito ... Non è il
bollettino ufficiale») sta nel testo per i lettori di schermo e nel suggerimento al passaggio
del mouse; la scheda che si apre la mostra scritta. Nella scheda della stazione il riquadro
«Qualità dell'aria» mostra: la frase con il giudizio e il giorno, quale inquinante decide, i due
valori usati con il loro valore di riferimento, la scala intera dalla classe migliore alla peggiore con quella
del giorno segnata (riquadro e data, non solo colore), le avvertenze con i link ad ARPAV e poi
le ultime misure arrivate, senza etichetta. Se il file non arriva scrive «Aria: dato non
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
// in src/live/giudizioAria.ts: funzione pura, null se i dati non bastano
export function giudizioAria(dati: Pick<DatiAria, 'serie'> | null | undefined): GiudizioAria | null;
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

Una cartolina illustrata, non una dashboard: una veduta dipinta ad acquerello e china. Carta
crema calda, tetti in cotto profondo, intonaci ocra, gialli e crema (poco rosa, niente bianco
freddo), Brenta verde-azzurro, verde dei colli morbido. Contorni a china color seppia scuro. Titoli in Fraunces, testi in Inter (pacchetti `@fontsource`, niente font da server
esterni). Niente gradienti viola, niente vetro sfocato, niente emoji. Deve funzionare su
telefono (la finestra-racconto diventa un foglio dal basso) e da tastiera; rispettare
`prefers-reduced-motion`. Di notte la cartolina resta una cartolina: blu notte e luci calde,
non uno schermo nero. I pannelli restano di carta crema.

### Edifici dipinti dal codice

Tutti gli edifici sono dipinti dal codice, senza immagini: tetti a falde, finestre, persiane,
porte, portici. Nessuna dipendenza in più. I dieci luoghi simbolo restano SVG a parte.

- **Tutto deciso dal seme.** Ogni edificio ha un numero stabile ricavato dalla sua impronta
  (`semeDi`). Forma del tetto, pendenza, tinte, passo delle finestre, persiane, porta, portico,
  comignoli, finestre accese di notte: tutto viene da lì e dalla posizione. Stesso edificio,
  stesso aspetto a ogni fotogramma e a ogni avvio. Nessun numero a caso.
- **Tetti** (`src/map/tetti.ts`, funzioni pure con test in `tests/edifici.test.ts`). La forma
  segue il tipo: capannoni piani e grigi con le fasce dei lucernari; condomini grandi e alti
  fuori dal centro con il tetto piano e il parapetto; torri a punta; tutto il resto in cotto, a
  falde. Una casa con più di 1500 m² di impronta a più di 700 m dal centro (supermercati,
  magazzini, fabbriche senza etichetta nei dati) si dipinge da capannone, tetto e muri: non un
  padiglione di cotto lungo cento metri. Sui rettangoli due falde con il colmo lungo il lato lungo e i timpani sui lati corti,
  oppure padiglione. Sulle impronte senza rientranze il padiglione è esatto (ogni lato ha la
  sua falda). Sulle impronte con rientranze il tetto sale a gradoni: l'impronta si rientra
  finché regge, le strozzature si tagliano, ciò che resta senza rientranze si chiude a
  padiglione; dove non si può più salire resta un piano in cima. Un piano in cotto non resta
  mai una lastra liscia: si divide in due lungo il suo asse più lungo e le due metà si
  dipingono come due falde molto basse, con il colmo in mezzo, i due toni e i coppi che
  scendono dal colmo («colmo finto»: le facce restano piane, quindi dentro i muri). Se le falde
  coprono meno del 90% dell'impronta si buttano e tutto il tetto diventa un piano con il colmo
  finto. Regola che vale sempre: nessuna falda esce dai muri (tolleranza 25 cm) e sotto le
  falde c'è sempre l'impronta alzata alla gronda, quindi il tetto non ha buchi.
- **Altezze.** Il tetto a falde prende una parte dell'altezza del dato: la gronda scende di
  metà del rialzo, il colmo sale dell'altra metà. Gli edifici davanti a un luogo simbolo
  restano a 3,5 m colmo compreso, anche quelli che nei dati sono già più bassi (il loro colmo
  non supera l'altezza del dato). Sotto i 3 m di altezza (tettoie, garage) il tetto non sale
  più di 0,6 volte l'altezza.
- **Luce sui tetti.** Come sui muri: chiare le falde a ovest, scure quelle a sud e a est, a
  mezza tinta quelle a nord. I toni di cotto cambiano da casa a casa (dieci toni, dal bruno
  all'arancio) e un poco anche da falda a falda: una falda in luce su quattro resta a mezza
  tinta e una a mezza tinta su quattro prende la luce, lo decide il seme (sono gli stessi
  riempimenti: costo zero). Le falde in ombra non cambiano, perché da lontano sono stese a
  tessere. Le parti in ombra (muri e falde) non ingrigiscono: di giorno e nel pomeriggio il
  rosso scende meno e il blu di più (`inOmbra`, chiave `ombraCalda`), così l'ombra di un
  giallo è ocra bruciata e non oliva; poi virano appena verso `ombraTinta` (terra calda di
  giorno, viola nel pomeriggio).
- **Ombre a terra.** Di giorno e nel pomeriggio ogni casa stende un'ombra sul terreno, verso
  sud-est (sullo schermo: a destra), lunga in proporzione all'altezza e più lunga nel
  pomeriggio. Si disegna prima di tutto ciò che sta in piedi, una forma sola per tessera, e
  compare sfumando da zoom 1,5. Di notte non c'è.
- **Facciate.** Finestre allineate per piano (un piano ogni 3 metri circa), con il passo tra
  le finestre scelto dal seme; persiane verdi o marroni su parte delle case, di più in centro,
  qualcuna chiusa; una porta al piano terra sul muro più lungo e una su ogni altra facciata
  lunga, portone ad arco nei palazzi del centro e negli edifici pubblici; portico ad archi su
  alcuni edifici lunghi del centro storico; zoccolo, marcapiano e ombra sotto la gronda. Tra
  un piano e l'altro le finestre cambiano: finestrelle di sottotetto all'ultimo piano, più
  alte al piano nobile, vetrine con la tenda al piano terra in alcune case del centro; da
  molto vicino il telaio a croce. I lati consecutivi quasi allineati (meno di 18 gradi)
  contano come una facciata sola e le finestre si distribuiscono sulla sua lunghezza con un
  passo solo: un muro curvo non si riempie di finestre strette, una finestra può stare a
  cavallo del giunto tra due lati e lo spigolo verticale tra loro non si traccia. Un muro di
  scorcio (nel centro storico una strada su due è vista così) ha finestre più rade, senza
  persiane, porte né vetrine; visto proprio di taglio, stretto o con un piano troppo basso
  resta liscio. Dove un'ala dello stesso edificio
  nasconde il piede di un muro (un cortile visto da sopra), le finestre stanno solo sui piani
  che si vedono. Chiese con intonaco chiaro e caldo, lesene, monofore ad arco grandi in
  proporzione, portale ad arco sul lato corto e rosone sopra se la facciata è alta. Capannoni
  con una fascia di vetri e un portone.
- **Intonaci.** Nel centro storico tinte calde e cariche (ocra, giallo, terracotta, crema,
  qualche pietra); nella prima cintura (fino a 950 m) intonaci caldi con qualche tinta chiara;
  oltre, tinte chiare e moderne con qualche casa colorata.
- **Centro storico: due fuochi.** «In centro» vuol dire entro 480 m dal centro della città
  oppure entro 310 m dal borgo di Angarano, sulla riva ovest subito oltre il Ponte Vecchio
  (`FUOCHI_CENTRO`, `lontananzaDalCentro` in `src/map/disegno.ts`). Vale per intonaci, finestre
  (in centro più piccole, scure e fitte), persiane, portici, vetrine, abbaini, e per il terreno:
  dentro la sagoma dei due fuochi la carta prende una mano di sabbia calda.
- **Stile dipinto, uno solo per tutta la città** (`src/map/trame.ts`). Nessuna immagine: poche
  tele piccole create dal codice una volta per luce, da un seme fisso, e riusate come motivo.
  - *Mano d'acquerello*: un velo leggero di macchie e grana (rumore che si ripete ai bordi,
    21 m di lato): tela trasparente a due colori per luce (`macchieTinta`: bruno e crema di
    giorno, blu di notte), stesa con la fusione normale su tutto il foglio in una passata
    sola, dopo case e luoghi simbolo e prima di nuvole, nomi e segnaposto. È grana, non
    colore: la variazione vera sta nelle tinte di tetti e muri. Sta attaccata alla mappa. La
    tela esiste in quattro misure, ognuna la media della precedente (`livelloTrama`): da
    lontano si usa quella ridotta, così la grana non frigge muovendo la mappa. Passa anche su
    luoghi simbolo, linee tematiche e alone dell'evidenza (stanno in mezzo alle case, non si
    possono disegnare dopo): con questo peso i loro colori cambiano di poco. Entra sfumando
    tra zoom 1,3 e 3,4.
  - *Selciato*: lastre in isometria (giunti a mano, uno su quattro manca, qualche lastra più
    scura o più chiara; la tessera ripete ogni 7 lastre) su piazze e strade dentro la sagoma
    del centro; entra tra zoom 2,6 e 4,2. Non si stende sul resto del terreno del centro: era
    un riempimento a tutto schermo quasi tutto nascosto dalle case.
  - *Acqua*: un bordo di pietra chiara (l'argine) tracciato prima dell'acqua, che ne copre la
    metà interna: resta fuori dalla riva e un canale stretto non si svuota. Sotto le rive due
    passate più scure, il filo scuro dell'acqua, increspature lungo la corrente da vicino. La
    fascia chiara di corrente pesa secondo la luce (`corrente`).
  - *China*: i contorni di case e tetti usano `china`, seppia scura; peso e spessore crescono
    piano tra zoom 1,8 e 5, senza scatti. Le file dei coppi scartano un poco, sempre allo
    stesso modo (dal seme).
  - *Alberi*: da vicino tre toni (ombra in basso a destra, tinta, tocco di luce) e contorno.
  - *Luoghi simbolo*: i file SVG non si toccano; in ogni luce il disegno viene moltiplicato per
    un velo (`illustrazioni.velo`: caldo e leggero di giorno, dorato nel pomeriggio, blu di
    notte) e le pezze d'acqua prendono il colore del fiume della mappa. Il colore dell'acqua
    scritto nei file è una costante a parte (`ACQUA_NEI_DISEGNI`), non la tavolozza.
  - Dove non c'è un documento (nelle prove) le tele non si creano e la mappa resta a tinte
    piatte; il disegno a motivo è provato con trame finte in `tests/mappa.test.ts`.
- **Livelli di dettaglio** (`DETTAGLI` in `src/map/disegno.ts`). Da molto lontano sagome
  unite; poi tetti stesi a tessere, con le falde in ombra; da zoom 1 circa muri e tetti a
  falde edificio per edificio. Avvicinandosi compaiono, in quest'ordine: la mano d'acquerello
  (da 1,3 a 3,4), il terzo tono delle falde (1,45), le ombre a terra (1,5), colmi e displuvi a
  penna (da 1,7 a 3), una fascia tenue
  per ogni fila di finestre (da 1,9 a 2,8: sta al posto delle finestre finché sarebbero puntini, e se
  ne va tra 2,9 e 3,6; pesa meno sugli intonaci scuri, dove rigava la facciata), finestre,
  porte e archi (2,6; in centro le case hanno solo il davanzale chiaro, non la cornice), righe dei coppi una sì e una no (2,8), persiane, zoccolo e marcapiano
  (3,3), le altre righe dei coppi e le cornici (3,5), comignoli e abbaini (3,9), coppi più
  fitti e telai delle finestre (5,5); a terra il selciato (2,6). Ogni strato entra sfumando tra
  due valori di zoom: mai uno scatto.
- **Luci.** Le tre tavolozze hanno le stesse chiavi anche per gli edifici (intonaci carichi e
  chiari, tetti piani, toni delle falde, coppi, vetro, cornice, telaio, persiane, porte, ombra
  di facciata, portico, tinta delle ombre, ombra a terra delle case, china, peso e tinte della
  mano d'acquerello, calore delle ombre, selciato, terreno del centro, argine, fascia di
  corrente, velo dei luoghi simbolo). Di giorno l'ombra propria vira a una terra calda, nel
  pomeriggio appena al viola. Fuori dal centro le strade sono più chiare della carta e hanno
  il bordo scuro: la trama delle vie deve leggersi anche in periferia. Di notte le finestre accese sono un sottoinsieme fisso delle finestre
  dipinte, le altre restano scure; compaiono sfumando tra zoom 1,9 e 2,3 (più da lontano
  restano le luci dei lampioni: servirebbe la facciata di migliaia di case per dei puntini). I
  portici hanno una luce calda. I luoghi simbolo di notte prendono un velo blu-viola chiaro,
  vicino a quello dei muri.

### Bordo della mappa

La città non finisce con un bordo dritto: `src/map/nuvole.ts` la fa sfumare in un banco di
nuvole. Il contorno delle nuvole sta in media 240 m dentro il bordo dei dati, ha gli angoli
tondi e ondeggia, così nemmeno da lontano si legge la forma del riquadro. Un velo di sbuffi
piccoli copre le ultime case, poi nuvole piene coprono tutto ciò che sta oltre (posizioni da
una griglia e da un seme, sempre uguali; colori per ogni luce in `palette.nuvole`).
`limitaCamera`, con la vista, tiene il centro della camera lontano dal bordo: oltre le nuvole
non ci si può trascinare. Lo zoom minimo non lascia rimpicciolire la città fino a farne
un'isola in mezzo alle nuvole.

### Tasselli dipinti (prova)

Facoltativi: se esiste `public/tasselli/indice.json`, `src/map/tasselli.ts` stende sopra gli
edifici, sotto etichette e segnaposto, le immagini elencate (centro in metri locali, lati sul
piano isometrico, zoom da cui compaiono), con i bordi sfumati. Sono versioni dipinte dello
stesso scorcio disegnato dal codice e si mostrano solo con la luce di giorno. Oggi non ce n'è
nessuno: la prova sul centro è stata tolta perché accanto alle case disegnate dal codice la
differenza di stile si vedeva troppo (o tutta la città dipinta, o niente). La cartella è
fuori da git finché non è chiarita la licenza delle immagini generate: senza tasselli la mappa
è quella disegnata dal codice.

## Prestazioni

Gli edifici sono migliaia: disegnare solo ciò che è nel riquadro visibile, ordinare una volta
sola, a zoom basso disegnare sagome semplificate. I lampioni sono migliaia: solo quelli in
vista, un'immagine sola per l'alone, nessun gradiente creato a ogni fotogramma. Obiettivo:
trascinamento fluido su un portatile normale.

Edifici dipinti: la geometria dei tetti si calcola una volta sola, quando si costruisce la
scena (`preparaEdificio`); costa qualche decimo di secondo all'avvio. Le forme da riempire
(muri, falde, finestre, coppi) si preparano la prima volta che un edificio entra in vista a
quel livello di dettaglio e poi si riusano: nel fotogramma restano solo riempimenti e tratti
di forme già pronte, senza calcoli. La preparazione ha un bilancio di tempo, non un numero
fisso: circa 5 millisecondi per fotogramma (più un minimo di 48 forme, perché il disegno
arrivi sempre in fondo), e vale per tutto, volumi compresi. Chi resta senza forme si vede lo
stesso, come volume semplice (muri piatti nelle due tinte e tetto piano alla gronda, tracciati
direttamente, senza forme da tenere); il disegno lo dice (`incompleto`) e la mappa chiede un
altro fotogramma. Oltre 9000 dettagli pronti (facciate e tetti fini), oppure oltre 9000 volumi
pronti, si dimenticano le forme degli edifici che non sono stati dipinti nell'ultimo
fotogramma: quelli in vista restano, quindi niente sparisce mentre si guarda. I dettagli si disegnano solo per
gli edifici in vista e solo sopra la loro soglia di zoom. Dove i tetti si stendono a tessere
(da lontano) le falde in ombra sono un solo velo per tessera.

Poche chiamate per edificio: se nessun muro ne copre un altro (tutte le impronte senza
rientranze e molte delle altre) i muri sono due riempimenti, uno per lato, e tutti i tratti a
penna (muri, gronda, colmi, timpano) un solo tratto; il terzo tono delle falde entra
mescolando i colori, senza trasparenze. I tratti degli edifici hanno capi e giunti semplici
(`butt`, `bevel`): a quello spessore non si distinguono da quelli tondi e costano molto meno,
soprattutto sulle righe dei coppi.

Stile dipinto: nessun lavoro in più per edificio. La mano d'acquerello è un solo riempimento a
tutto schermo per fotogramma, qualunque sia il numero di case, con la fusione normale e senza
ammorbidire (la tela scelta ha già i pixel grandi quasi come quelli dello schermo). Si è
provato a riempire ogni tetto e ogni muro con un motivo (dal 40 all'80% in più su processore)
e a fondere il velo con `overlay` (fino al 35% in più): no a tutti e due. Selciato, argini e
increspature sono pochi riempimenti e tratti sulle forme del terreno che c'erano già; i toni
diversi delle falde riusano i riempimenti che c'erano.
Misura (Chrome senza interfaccia, 1400 x 900 a densità 2, la camera si sposta a ogni
fotogramma; «prima» è la versione senza stile dipinto). Disegno su processore
(`--disable-gpu`), intervallo medio tra fotogrammi: zoom 2,4 da 144 a 151 ms (+5%); zoom 6 da
144 a 162 ms (+13%); zoom 3,5 da 195 a 219 ms (+12%). Con la scheda grafica i fotogrammi
restano a 60 al secondo prima e dopo e il tempo di disegno nel codice non cambia (zoom 2,4:
5,6 e 5,4 ms; zoom 6: 3,1 e 2,9 ms). Sono numeri di una macchina sola: contano i rapporti.

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
