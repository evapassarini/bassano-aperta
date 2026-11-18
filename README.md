# Bassano Aperta

Una mappa isometrica di Bassano del Grappa, illustrata e disegnata dal codice, con il racconto
dei suoi luoghi e alcuni dati utili. È un progetto civico open source nato attorno alla
candidatura di Bassano a **Capitale italiana della Cultura 2029**. Il nome è provvisorio.

È un progetto personale di chi lo cura: non è di uno studio né di un'azienda, e non è un sito
ufficiale del Comune o della candidatura. Il codice è su
<https://github.com/evapassarini/bassano-aperta>; gli errori si segnalano su
<https://github.com/evapassarini/bassano-aperta/issues>.

Cosa trovi nel sito:

- tutta la città in vista isometrica, costruita dai dati di OpenStreetMap: si trascina, si zooma,
  la posizione resta nell'indirizzo (`#@x,y,zoom`);
- ogni edificio dipinto dal codice, senza immagini, come una veduta ad acquerello e china: tetti in cotto a falde, intonaci veneti,
  finestre, persiane e portici che compaiono avvicinandosi (le regole sono in `docs/SPEC.md`,
  «Edifici dipinti dal codice»);
- dieci luoghi simbolo disegnati a parte (Ponte Vecchio, Castello degli Ezzelini, Torre Civica,
  Museo Civico, Palazzo Sturm, King Kong Rhino, Grapperia Nardini, Tempio Ossario, Porta Dieda,
  Bolle di Nardini);
- tre strati accendibili: Cultura, Ambiente, Mobilità;
- diciotto racconti (sedici luoghi e due temi) con linea del tempo, immagini e video, e
  un riquadro «Adesso» con il dato in diretta dove esiste davvero (il livello della Brenta);
- i prossimi treni alla stazione di Bassano, con i ritardi dichiarati;
- gli avvisi sulla viabilità pubblicati dagli enti per le strade attorno a Bassano (non è il
  traffico in tempo reale: il riquadro «Traffico adesso» porta ai siti dove vederlo);
- una pagina «Fonti e licenze», con i link al codice e alle segnalazioni;
- il credito «© OpenStreetMap contributors», sempre scritto sulla mappa.

È un sito statico: Vite e TypeScript, nessun framework, nessun server. Sta su Vercel. Due file
di dati (aria e avvisi) si aggiornano da soli più volte al giorno nel repository su GitHub, e il
sito pubblicato li legge da lì anche senza essere ripubblicato (vedi «Pubblicazione»).

## Come avviarlo

Serve una versione recente di Node.js (provato con la 26).

```sh
npm install
npm run dev      # apre il sito in locale (Vite indica l'indirizzo)
npm run build    # controlla i tipi e costruisce il sito in dist/
npm run preview  # prova il sito costruito
npm test         # prove automatiche, compreso il controllo di dati e contenuti
```

Il sito costruito usa percorsi relativi (`base: './'` in `vite.config.ts`): la cartella `dist/`
funziona da qualunque indirizzo, anche in una sottocartella.

## Come rigenerare i dati

```sh
npm run dati
```

Esegue cinque script, in ordine:

| Script | Scrive | Da dove |
|---|---|---|
| `scripts/dati-osm.mjs` | `public/data/base.json` | Edifici, strade, acqua, verde e alberi da OpenStreetMap (Overpass API) |
| `scripts/dati-strati.mjs` | `public/data/strati.json` | Punti e linee di Cultura, Ambiente, Mobilità (OpenStreetMap e ARPAV) |
| `scripts/dati-aria.mjs` | `public/data/aria.json` | Fotografia della qualità dell'aria (ARPAV, stazione di Bassano): ultime misure di ozono e PM10 e le serie brevi che servono al giudizio a parole |
| `scripts/dati-avvisi.mjs` | `public/data/avvisi.json` | Fotografia degli avvisi sulla viabilità (CCISS Viaggiare Informati e Vi.abilità della Provincia di Vicenza) |
| `scripts/dati-lampioni.mjs` | `public/data/lampioni.json` | Lampioni per la luce della notte: quelli segnati su OpenStreetMap, più altri disposti lungo le strade a scopo illustrativo |

Quattro comandi a parte:

```sh
npm run dati:aria      # rifà solo la fotografia dell'aria
npm run dati:avvisi    # rifà solo la fotografia degli avvisi
npm run dati:lampioni  # rifà solo i lampioni (legge base.json: va lanciato dopo dati-osm)
npm run dati:stazioni  # rifà la tabella dei nomi delle stazioni dei treni
```

`dati:stazioni` scrive `public/data/stazioni-treni.json` a partire dagli orari di Trenitalia
distribuiti da BusOne. Scarica un archivio di circa 25 MB e ha bisogno del comando `unzip`: per
questo non fa parte di `npm run dati` e si rilancia solo quando cambiano le stazioni.

Aria e avvisi non vanno rilanciati a mano: li aggiorna da solo, più volte al giorno, il workflow
`.github/workflows/dati.yml` nel repository su GitHub, e il sito pubblicato legge da lì la
versione più recente (vedi «Pubblicazione»). Gli altri file si rigenerano solo a mano e
arrivano sul sito solo quando lo si ripubblica.

`dati:lampioni` scarica da OpenStreetMap i lampioni rilevati (pochi, a Bassano) e ne aggiunge
altri lungo le strade e sul bordo delle piazze di `base.json`, con regole fisse e senza caso: a
ogni corsa escono gli stessi punti. Nel file i rilevati stanno per primi e il campo `veri` dice
quanti sono; gli altri sono illustrativi e il sito lo dichiara in «Fonti e licenze». Se Overpass
non risponde lo script tiene i lampioni rilevati del file che c'è già e lo scrive in console;
solo se un file precedente con lampioni rilevati non esiste scrive `veri: 0`.

Da sapere:

- Overpass è spesso sovraccarico: gli script riprovano su più server e possono impiegare alcuni
  minuti. Se non ci riescono si fermano con un errore e lasciano intatti i file esistenti.
- `OSM_CACHE=<cartella> npm run dati` salva le risposte di Overpass e le riusa al giro dopo.
- Il livello della Brenta non passa da qui: lo legge il browser, in diretta, dall'API di ARPAV.
- L'aria invece è una fotografia: resta ferma finché non gira di nuovo lo script (per il sito
  pubblicato più volte al giorno, in automatico, su GitHub). Il sito mostra sempre la data e l'ora della misura.
- Accanto ai numeri dell'aria il sito scrive un giudizio a parole (buona, accettabile, mediocre,
  scadente, pessima) per l'ultimo giorno intero, di norma ieri. Lo calcola il sito
  (`src/live/giudizioAria.ts`) con le fasce dell'indice di qualità dell'aria di ARPAV, su
  polveri PM10 e ozono. Non è l'indice ufficiale, che considera anche il biossido di azoto e usa
  dati validati: il sito lo dice e rimanda ai dati validati di ARPAV. Se i dati non bastano non
  scrive nessuna parola. Perché il giudizio resti di ieri lo script deve girare ogni giorno (lo
  fa l'aggiornamento automatico); dopo 3 giorni il sito lo presenta con la sua data. Regole e cose ancora da verificare:
  `docs/SPEC.md`, «Giudizio a parole sull'aria».
- Nemmeno i treni passano da qui: il browser li legge in diretta da BusOne. Dagli script viene
  solo la tabella dei nomi delle stazioni.
- Anche gli avvisi sono una fotografia, e invecchiano in fretta. Gli eventi del CCISS si
  leggono per la zona di Bassano e la fonte li dà come validi (in corso o programmati); se quella lettura non riesce si
  usa l'RSS nazionale, e allora il sito mostra solo gli eventi delle ultime 24 ore. Sul sito pubblicato
  `npm run dati:avvisi` gira in automatico più volte al giorno. Se la fotografia ha più di 24 ore la
  scheda lo dice.
- Se Vi.abilità non risponde lo script tiene le ordinanze della fotografia precedente che
  valgono ancora; se non risponde CCISS (né per zona né con l'RSS) il file esce senza eventi
  e la scheda dice che mancano.
  In tutti e due i casi lo script scrive il file ma esce con codice 2: va rilanciato. Se non
  risponde nessuna delle due esce con codice 1 e lascia intatto il file esistente.
  L'aggiornamento automatico scarta anche la fotografia incompleta (codice 2) e tiene il file
  di prima.
- Le ordinanze di Vi.abilità con il periodo dei lavori già finito non entrano nella fotografia.
  Quando il periodo non è scritto in modo leggibile l'ordinanza resta: alcune possono
  riguardare lavori già finiti.
- L'elenco dei treni può non essere completo: BusOne pubblica solo le corse seguite in diretta
  e le corse soppresse arrivano senza fermate, quindi non si possono attribuire a Bassano.
- `base.json` ha un campo facoltativo nuovo, `alberiVeri`: quanti alberi vengono da
  OpenStreetMap (sono i primi dell'elenco). Nel file di oggi non c'è ancora: comparirà la
  prossima volta che si lancia `scripts/dati-osm.mjs`.
- Le altezze degli edifici sono quasi tutte stimate (OpenStreetMap ne ha solo 76 su circa 19.000):
  sono un'illustrazione, non un dato.
- `ORIGINE` e `RIQUADRO` sono copiati a mano in `scripts/lib/geo.mjs` e in
  `scripts/dati-strati.mjs`: se cambiano in `src/types.ts` vanno cambiati anche lì.

## Come aggiungere o correggere un racconto

Ogni racconto è un file `content/luoghi/<id>.json` che segue il tipo `Storia` di `src/types.ts`.
Per correggere un testo basta modificare quel file. Poi:

```sh
npm test
```

`tests/contenuti.test.ts` controlla che l'`id` sia uguale al nome del file, che ogni tappa abbia
la sua fonte (e così ogni voce di `fontiCuriosita`), che gli indici `tappa.media` puntino a un'immagine esistente, che i media abbiano
autore, licenza e testo alternativo, che le coordinate stiano dentro la mappa, che i disegni
citati esistano, che `curiosita` e `incertezze` siano elenchi di testi, che i testi mostrati
scrivano «la Brenta» al femminile e che nessuno rimandi a «Le fonti non concordano».

Ogni racconto ha `curiosita` (anche vuoto, `[]`) e `incertezze` (nota interna, non mostrata).
Le fonti delle curiosità che non sono già fonti di una tappa vanno in `fontiCuriosita`
(facoltativo, elenco di `{titolo, url}`) e compaiono nell'elenco «Fonti» del racconto.
Le `incertezze` non si vedono sul sito ma non sono segrete: restano leggibili nei file del
repository e nel JavaScript pubblicato.

Per un racconto nuovo:

1. crea `content/luoghi/<id>.json` (da 6 a 10 tappe; `genere` è `luogo` oppure `tema`; un luogo
   ha `lat` e `lon`, un tema no);
2. aggiungi l'id all'elenco `I18` in `tests/contenuti.test.ts`;
3. se è un luogo, aggiungi il suo punto in `scripts/dati-strati.mjs` e rilancia lo script: senza
   un punto in `strati.json` il luogo non compare sulla mappa;
4. se esiste un disegno, mettilo in `public/landmarks/<nome>.svg`, aggiungilo a
   `public/landmarks/indice.json` e scrivi `"landmark": "<nome>"` nel racconto.

Eccezione nota: il Monte Grappa è circa 12 km fuori dalla mappa. Il racconto tiene le coordinate
vere della cima; sulla mappa c'è un segnaposto sul margine nord-est.

## Come ridisegnare un luogo simbolo

Le dieci illustrazioni non sono disegnate a mano: ognuna esce da un piccolo programma,
`scripts/landmark/luoghi/<id>.mjs`, che scrive `public/landmarks/<id>.svg`.

```sh
npm run illustrazioni                 # rigenera tutti gli SVG
npm run illustrazioni -- porta-dieda  # solo uno (o più id di seguito)
```

Per cambiare un disegno:

1. modifica il suo generatore. Le misure sono in metri locali rispetto al punto d'appoggio
   (x verso est, y verso nord, z in alto) e la proiezione è quella di `docs/SPEC.md`; 4 unità
   SVG valgono un metro sul piano isometrico. `scripts/landmark/iso.mjs` è il motore condiviso
   (oggi lo usa il Tempio Ossario; gli altri generatori hanno dentro la parte che serve loro).
   In `scripts/landmark/plan/` ci sono le piante di OpenStreetMap usate come base;
2. rilancia `npm run illustrazioni`: stampa peso e `viewBox` di ogni file;
3. se il `viewBox` è cambiato, aggiorna la voce in `public/landmarks/indice.json`. Con
   `viewBox="x0 y0 L A"` e il punto d'appoggio disegnato in (0, 0): `larghezzaMetri = L / 4`,
   `ancora = [-x0 / L, -y0 / A]`. `lat` e `lon` sono quelli del punto d'appoggio. `copre`
   (facoltativo) è il raggio in metri entro cui spariscono le case generiche: serve ai luoghi
   stretti tra gli edifici, e va tenuto piccolo perché toglie case vere dalla mappa;
4. guarda il risultato nella mappa, non solo il file: `npm run dev` e poi l'indirizzo
   `#@x,y,zoom` del luogo. Dimensione, case davanti e nomi si giudicano solo lì;
5. `npm test`.

Regole del disegno: tinte piatte, una parete in luce e una in ombra, contorni seppia sottili,
sfondo trasparente, niente testo, script, immagini o riferimenti esterni, meno di 30 KB circa.
Le licenze prese rispetto al vero (un portico girato, un edificio non disegnato) si scrivono
nel commento in testa al generatore.

## Regole editoriali, in breve

- Ogni fatto ha una fonte letta davvero. La base è `ricerca/ricerca-verificata-2026-11-14.json`:
  non si aggiunge nulla a memoria.
- Dove le fonti non concordano non si sceglie a memoria: il punto va in `incertezze`, che è una
  nota interna di redazione e non si mostra sul sito (decisione della curatrice del 16 novembre
  2026: la sezione «Le fonti non concordano» non c'è più). Nessun testo mostrato rimanda a
  quella sezione.
- `curiosita` è un elenco di frasi brevi, con la fonte tra quelle delle tappe, tra i media o in
  `fontiCuriosita`, mostrato nella sezione «Curiosità» dopo la linea del tempo. Un fatto
  curioso su cui le fonti non sono del
  tutto coerenti (succede soprattutto sul Ponte Vecchio) si racconta come curiosità, con «si
  racconta» o «secondo ...», non come elenco di discordanze.
- Sulla rappresaglia del febbraio 1945 sul Ponte Vecchio si scrive «nazifascisti».
- Il fiume è femminile: «la Brenta», «della Brenta», «sulla Brenta». Restano come sono i nomi
  propri e le citazioni: «Riviera del Brenta», «Consorzio di Bonifica Brenta», i nomi dei comuni
  («Tezze sul Brenta»), i nomi presi da OpenStreetMap («Ciclopista del Brenta»), i titoli delle
  fonti, i nomi dei file di Commons e gli indirizzi.
- Le affermazioni delle aziende (Nardini, Poli) si attribuiscono: «secondo l'azienda».
- Viale dei Martiri e Tempio Ossario: tono sobrio, nessun dettaglio crudo, nessuna foto delle
  vittime.
- King Kong Rhino: nessuna fotografia della scultura (artista vivente, in Italia non c'è libertà
  di panorama). Nel racconto ci sono solo la nostra illustrazione, stampe e disegni del
  Cinquecento (Dürer, Burgkmair, Enea Vico) e due sale di Palazzo Sturm fotografate senza la
  scultura.
- Niente orari, prezzi o calendari scritti a mano: si rimanda alla pagina ufficiale.
- La dicitura è «candidata a Capitale italiana della Cultura 2029». Mai «Città della cultura»,
  mai «europea».
- Immagini e audio solo da Wikimedia Commons con licenza verificata; sotto ognuno autore, licenza
  e link. Video solo da `youtube-nocookie.com`, caricati dopo un clic. Webcam solo come link.
- Italiano, frasi semplici, niente gergo.

Le regole complete e i contratti tra le parti stanno in `docs/SPEC.md`.

## Licenze

Nel repository non c'è una licenza sola. Il dettaglio è nel file `NOTICE`; in breve:

- **Codice**: licenza MIT, vedi `LICENSE`. Vale solo per il codice.
- **Dati** in `public/data/` e in `scripts/landmark/plan/`: non sono MIT, seguono le licenze
  delle fonti. OpenStreetMap: ODbL 1.0. BusOne: solo uso non commerciale, secondo i suoi
  termini. ARPAV: CC BY 4.0 dichiarata per i file XML, non dichiarata in modo esplicito per
  l'idrometro. CCISS e Vi.abilità: nessuna licenza dichiarata, solo citazioni brevi con link.
- **Testi dei racconti** in `content/`, **illustrazioni** in `public/landmarks/`,
  documentazione (`README.md`, `docs/`) e le due immagini del progetto (`public/anteprima.jpg`,
  `public/apple-touch-icon.png`): non sono MIT e per ora non hanno una licenza aperta. Restano
  di chi cura il sito. La scelta di una licenza è tra i punti da confermare.
- **Foto e video** citati nei racconti: restano dei loro autori, con la licenza scritta
  accanto a ciascuno. Oggi nessun racconto ha registrazioni audio.

## Fonti

- **Mappa di base e punti**: © OpenStreetMap contributors, licenza ODbL 1.0, scaricati con
  Overpass API. Il credito «© OpenStreetMap contributors», con il link alla pagina del
  copyright, è sempre scritto sulla mappa: su schermo largo in basso a destra sotto lo zoom, su
  telefono in alto a destra sotto gli strati.
- **Alberi**: una parte viene da OpenStreetMap, una parte è aggiunta dal codice dentro boschi e
  parchi a scopo illustrativo. Oggi «Fonti e licenze» lo dice a parole. I due numeri
  compariranno dopo aver rilanciato `scripts/dati-osm.mjs`, che ora salva in `base.json` il
  campo `alberiVeri`.
- **Brenta e aria**: ARPAV, dati non validati. La pagina open data di ARPAV dichiara la licenza
  CC BY 4.0 per i file XML ed elenca lì anche i file JSON dell'aria: che valga anche per quelli
  è una nostra lettura, da confermare. Per i dati dell'idrometro ARPAV non dichiara una licenza
  in modo esplicito: il sito lo dice.
- **Scala del giudizio sull'aria**: le cinque classi e le soglie vengono dalle pagine di ARPAV
  sull'indice di qualità dell'aria (lette il 15 novembre 2026). Il giudizio è un calcolo nostro,
  non un dato ARPAV.
- **Treni**: BusOne (busone.app), che rielabora i dati di Trenitalia, la fonte originale. Uso
  gratuito e non commerciale per privati ed enti non profit, con attribuzione; BusOne può
  sospendere il servizio. Sono i ritardi dichiarati dall'operatore, non un servizio ufficiale.
  Le posizioni dei treni, che in quei dati sono stime, non si mostrano. Ogni richiesta a BusOne
  porta l'header `X-BusOne-Client` con il nome del progetto e l'indirizzo del repository, e
  `X-BusOne-Use: personal`.
- **Avvisi sulla viabilità**: CCISS Viaggiare Informati e Vi.abilità (Provincia di Vicenza).
  Nessuna delle due dichiara una licenza di riuso: il sito riporta solo una citazione breve, con
  il nome della fonte e il link alla pagina originale.
- **Immagini**: Wikimedia Commons, ognuna con la propria licenza e il proprio autore, scritti
  nel racconto e mostrati sotto il file. Quando la licenza è CC BY, CC BY-SA o CC0 il suo nome
  è un link alla pagina ufficiale su creativecommons.org. Perché il link compaia la licenza va
  scritta nella forma «CC BY-SA 4.0», «CC BY 2.5», «CC0».
- **Audio**: il sito sa mostrarli, ma oggi nessun racconto ne ha (vedi più sotto, «Media»).
- **Video**: incorporati da YouTube, restano dei rispettivi canali.
- **Webcam**: solo collegamenti a siti esterni.
- **Lampioni**: quelli segnati su OpenStreetMap (ODbL 1.0), più altri disposti dal nostro codice
  lungo le strade e sul bordo delle piazze a scopo illustrativo. Non sono un rilievo
  dell'illuminazione pubblica; i due numeri stanno in «Fonti e licenze» sul sito.
- **Illustrazioni dei luoghi simbolo** (`public/landmarks/`): disegnate per il progetto a partire
  dalle sagome di OpenStreetMap; altezze e dettagli sono in gran parte stime. Il sito lo dice in
  una voce di «Fonti e licenze».
- **Caratteri**: Fraunces e Inter (SIL Open Font License), serviti dal sito stesso.

## Pubblicazione

- **Chi firma**: Bassano Aperta è un progetto personale di chi lo cura. Non è di uno studio né
  di un'azienda, e non ha scopi commerciali. Conta anche per i termini di BusOne, che ammettono
  solo privati ed enti non profit.
- **Codice**: <https://github.com/evapassarini/bassano-aperta>. **Segnalazioni di errori**:
  <https://github.com/evapassarini/bassano-aperta/issues>. I due indirizzi sono scritti in
  `index.html`, negli attributi `data-codice` e `data-segnalazioni` di `<div id="ui">`, e
  compaiono in «Fonti e licenze» come «Vai al codice» e «Segnala un errore».
- **Dove sta il sito**: su Vercel, pubblicato a mano con `vercel deploy --prod --yes` dalla
  cartella del progetto. Vercel non è collegato al repository GitHub: un push, anche quello
  automatico dei dati, non ripubblica il sito. Vercel esegue `npm ci` e `npm run build` e
  pubblica la cartella `dist`. Le impostazioni sono in `vercel.json`. La versione di Node su
  Vercel si sceglie nelle impostazioni del progetto (24 o superiore; il progetto è provato con
  la 26).
- **Indirizzo del sito**: il dominio definitivo non è ancora noto. Oggi c'è un indirizzo
  segnaposto, scritto in un punto solo: in `index.html`, nelle tre righe sotto il commento
  «Indirizzo del sito» (`canonical`, `og:url`, `og:image`). Quando il dominio è deciso si cambia
  lì e in nessun altro file.
- **Aggiornamento automatico dei dati**: `.github/workflows/dati.yml` è programmato ogni 6 ore
  e si può avviare a mano dalla scheda Actions di GitHub. GitHub però ritarda e salta i lavori
  programmati: a novembre 2026 è girato circa due volte al giorno. Per questo i testi del sito
  dicono «più volte al giorno» e non promettono una cadenza. Esegue `npm run dati:aria` e
  `npm run dati:avvisi`, poi le prove. Se le prove passano e `public/data/aria.json` o
  `public/data/avvisi.json` sono cambiati, li salva nel ramo `main` del repository. Il sito
  pubblicato non viene ricostruito: legge i due file da lì (vedi il punto dopo). Se una fonte
  non risponde, il suo file resta quello di prima e il lavoro finisce in
  rosso nella scheda Actions: sul sito non arrivano dati rotti o a metà. Vale anche per gli
  avvisi quando risponde una sola delle due fonti (codice di uscita 2): la fotografia
  incompleta si scarta. La data mostrata dal sito dice sempre quanto è vecchia la fotografia.
- **Come il sito legge aria e avvisi** (`leggiFotografia` in `src/live/index.ts`): il browser
  chiede insieme la copia su GitHub,
  `https://raw.githubusercontent.com/evapassarini/bassano-aperta/main/public/data/aria.json` (e
  `avvisi.json`), e la copia pubblicata con il sito, `data/aria.json` (e `data/avvisi.json`).
  GitHub risponde con `access-control-allow-origin: *` e tiene i file in memoria 5 minuti.
  ARPAV invece non si può leggere dal browser (niente CORS): per questo esistono le fotografie.
  Una copia che non arriva, che va oltre 4 secondi (solo la remota) o che non ha la forma
  attesa si scarta. Se sono valide tutte e due vince quella con `generato` più recente; a
  parità vince la locale. Con `npm run dev` si legge solo la copia locale. L'indirizzo di
  GitHub sta in un punto solo, `URL_FOTOGRAFIE_REMOTE`. Leggendo da GitHub, il browser di chi
  visita manda a GitHub il proprio indirizzo IP, come con ogni server: «Fonti e licenze» lo
  dice. Se il repository cambiasse nome,
  diventasse privato o il ramo non si chiamasse più `main`, il sito userebbe solo la copia
  pubblicata con sé.
- **Se cambia la forma di aria.json o avvisi.json** (script e `src/types.ts`): il sito
  pubblicato legge il file da `main`, che può essere più avanti del codice pubblicato.
  `controllaAria` e `controllaAvvisi` guardano solo `generato` e l'elenco `misure` o `avvisi`:
  un campo rinominato più in profondità passerebbe, e il codice vecchio riceverebbe il formato
  nuovo. Un cambio di forma va quindi pubblicato su Vercel nello stesso giro del push, prima
  del successivo giro di `dati.yml`.
- **Controllo automatico**: `.github/workflows/controllo.yml` esegue tipi, prove e costruzione
  del sito a ogni push e a ogni pull request.
- **Indirizzi esterni permessi**: `vercel.json` contiene una Content-Security-Policy con gli
  unici indirizzi esterni che il sito può usare: `api.arpa.veneto.it`, `proxy.busone.app` e
  `raw.githubusercontent.com` per i dati, `commons.wikimedia.org` e `*.wikimedia.org` per le immagini e gli audio,
  `www.youtube-nocookie.com` per i video. Chi aggiunge una fonte esterna nuova deve aggiungerla
  anche lì, altrimenti il browser la blocca senza avvisare. Il sito non si può incorporare in
  una cornice su altri siti.
- **Anteprima per i social**: `public/anteprima.jpg` (1200x630) è uno scatto del sito costruito,
  non del server di sviluppo. Per rifarla: `npm run build`,
  `npx vite preview --port 5193 --strictPort`, poi uno scatto con Chrome senza interfaccia
  dell'indirizzo `http://localhost:5193/#@-235,100,3.8` con la luce «Giorno». L'icona per
  iPhone è `public/apple-touch-icon.png` (180x180), ricavata dall'icona di `index.html`.
- **Tasselli dipinti**: spenti. Si accendono solo con la variabile d'ambiente `VITE_TASSELLI=1`
  al momento di costruire il sito o di avviare `npm run dev`. Da spenti il sito non chiede
  nulla alla rete per i tasselli. Su Vercel la variabile non va impostata.
- **Prima del primo push**, due cose da fare a mano:
  - `.claude/` ora è tra i file ignorati, ma `.claude/launch.json` era già tracciato. Va tolto
    con `git rm --cached .claude/launch.json`. Il file contiene solo il comando per avviare il
    server di sviluppo;
  - **chi firma i commit**. Tutti i commit fatti finora in locale portano il nome utente e
    l'indirizzo email di un altro account, non di quello personale del repository. La
    configurazione di git di questa cartella usa ancora quei valori, quindi li porterebbe anche
    il prossimo commit. Dopo il primo push su un repository pubblico nome ed email di ogni
    commit sono leggibili da chiunque, e non si torna indietro. Prima di tutto vanno impostati
    in questa cartella il nome e l'indirizzo dell'account personale (meglio l'indirizzo
    «noreply» che GitHub dà a ogni account) con `git config user.name` e
    `git config user.email`. Poi va scelta una delle due strade: pubblicare la storia così
    com'è, oppure pubblicare partendo da un commit nuovo e unico fatto con l'identità
    personale. La seconda cancella la storia vecchia: la decide solo chi cura il sito. Nella
    storia vecchia, in una versione passata di `docs/SPEC.md`, c'è anche un nome di persona,
    tolto solo dal file di oggi. Con la seconda strada sparisce anche `.claude/launch.json`
    dai commit vecchi.

## Da confermare prima di pubblicare

Chi cura il sito ha scelto di pubblicarlo con tutte le fonti accese (treni BusOne, avvisi CCISS
e Vi.abilità, Brenta e aria ARPAV), con attribuzione e link. I punti qui sotto restano aperti:
nessuno è stato chiuso, e sono scritti qui perché si sappia.

Già deciso:

- chi firma: progetto personale (vedi «Pubblicazione»);
- il contatto nell'header `X-BusOne-Client`: è l'indirizzo del repository, uguale in
  `src/live/index.ts` e in `scripts/dati-stazioni.mjs`;
- gli indirizzi del codice e delle segnalazioni in «Fonti e licenze».

Permessi e licenze, ancora aperti:

- ARPAV: manca una conferma scritta per l'uso continuo dell'API della Brenta e per la licenza dei
  dati (idrometro e file JSON dell'aria);
- CCISS e Vi.abilità: nessuna delle due dichiara una licenza di riuso e manca una conferma
  scritta da entrambe. Il sito riporta solo citazioni brevi con link;
- BusOne: i termini e la licenza dei dati di Trenitalia vanno riletti alla fonte. Qui sono
  riportati come ci sono stati riferiti. Se un giorno il progetto passasse a un'azienda o a uno
  studio servirebbe prima il consenso scritto di BusOne;
- webcam: oggi sono solo link. I termini d'uso di Windy non sono stati letti;
- licenza di testi, illustrazioni e documentazione: non è stata scelta. Oggi restano di chi
  cura il sito (vedi `NOTICE`, punto 3). Se si vuole una licenza aperta, per esempio una
  Creative Commons, va scelta da chi cura il sito e scritta in `NOTICE`, qui in «Licenze», in
  `docs/SPEC.md` e nella pagina «Fonti e licenze» (`src/ui/fonti.ts`). Una licenza Creative
  Commons, una volta data, non si ritira;
- il fuso orario delle date ARPAV non è dichiarato: l'ora mostrata potrebbe sbagliare di un'ora.

Aria:

- il giudizio a parole non è ancora stato confrontato con quello ufficiale di ARPAV. Va fatto
  in un giorno feriale, quando un giorno validato cade dentro le 48 ore di ozono: il come è in
  `docs/SPEC.md`, «Giudizio a parole sull'aria», alla voce «Ancora da fare».

Fatti storici (oggi sono nelle note interne `incertezze`, non affermati come certi):

- la distruzione del Ponte Vecchio nel 1945 e chi la compì;
- il ruolo degli Alpini nella ricostruzione del 1948;
- luogo, date e numeri del 26 settembre 1944; la tappa su Karl Franz Tausch poggia su una sola
  fonte (Wikipedia) e non risulta una condanna per quei fatti: da rivedere con ANPI o ISTREVI;
- l'origine del nome «degli Ezzelini»;
- il nome del titolo: il link del logo del sito ufficiale della candidatura riporta una dicitura
  sbagliata («europea»). È un refuso, non un disaccordo tra fonti: nei racconti non lo citiamo e
  scriviamo sempre «candidata a Capitale italiana della Cultura 2029».

Media:

- i 17 video incorporati nei racconti non sono mai stati guardati per intero;
- le due registrazioni di «Sul ponte di Bassano» su Wikimedia Commons non sono mai state
  ascoltate. Esistono due canzoni con questo titolo, un lamento alpino e una canzone d'amore, e
  non si sa quale delle due contengano. Per questo sono state tolte dal racconto del Ponte
  Vecchio. Dopo l'ascolto si possono rimettere nell'elenco `media` di
  `content/luoghi/ponte-vecchio.json` con `"tipo": "audio"`, scrivendo nel titolo quale canzone
  è. I dati, da ricontrollare su Commons:
  - Coro ICAM, etichetta Vedette (fondo ICBSA). Licenza indicata: CC BY-SA 4.0.
    File: `https://commons.wikimedia.org/wiki/Special:FilePath/ICBSA_Coro_ICAM_-_Sul_ponte_di_Bassano.oga`
    Pagina: `https://commons.wikimedia.org/wiki/File:ICBSA_Coro_ICAM_-_Sul_ponte_di_Bassano.oga`
  - Coro ex combattenti, etichetta Columbia (fondo ICBSA). Licenza indicata: CC BY-SA 4.0.
    File: `https://commons.wikimedia.org/wiki/Special:FilePath/ICBSA_Coro_ex_combattenti_-_Sul_ponte_di_Bassano.oga`
    Pagina: `https://commons.wikimedia.org/wiki/File:ICBSA_Coro_ex_combattenti_-_Sul_ponte_di_Bassano.oga`
- l'anno del cinegiornale Luce sul Tempio Ossario;
- per sei file di Commons, tra quelli già presenti prima del 15 novembre 2026, autore e licenza
  vengono solo dalla ricerca, non da un secondo controllo sull'API di Commons;
- le 88 immagini aggiunte il 15 novembre 2026 (in 16 racconti) sono state invece verificate una
  per una con l'API di Commons (autore, licenza, nessuna segnalazione di cancellazione) e
  guardate. Alcune sono al limite e chi cura il sito può toglierle senza perdere nulla: tre
  sono larghe appena 1024 px (`Calà_del_Sasso.jpg` nel racconto della Brenta, `Bassano_z10.JPG` nel Viale dei
  Martiri, `Bassano_Ponte_vecchio_07feb08_05.jpg` in Nardini al Ponte); una del Ponte Vecchio,
  `Bassano_del_Grappa,_dal_Ponte_degli_Alpini_(12292723636).jpg`, ha colori molto elaborati;
  la torre nord-est nel racconto delle mura si vede già dietro Porta delle Grazie; nel racconto
  della grappa due foto non sono di Bassano, e la didascalia lo dice. Nel Viale dei Martiri
  una foto è stata tolta in revisione: `Uno_dei_lecci_di_viale_dei_martiri_(6072742587).jpg`
  (Rino Porrovecchio, CC BY-SA 2.0) mostra la croce con il nome di un caduto, un cappio in
  rilievo e un piccolo ritratto. È in regola con le licenze, ma si rimette solo con un sì
  esplicito di chi cura il sito;
- le cinque foto del Sacrario del Monte Grappa già presenti prima del 15 novembre 2026: il
  Sacrario è del 1935, opera di Giovanni Greppi (morto nel 1960) e Giannino Castiglioni (morto
  nel 1971), e in Italia non c'è libertà di panorama. Chi cura il sito deve decidere se tenerle;
- Garage Nardini e Bolle non hanno immagini libere: i loro racconti sono solo testo. Nardini al
  Ponte ha due foto di contesto: nessuna pagina di Commons dice quale edificio sia la grapperia,
  quindi le didascalie non lo affermano.

Nomi e posizioni sulla mappa:

- «Ciclopista del Brenta»: il nome che il sito mostra sulla ciclabile viene solo da
  OpenStreetMap (relazione 32302). Un'altra relazione di OpenStreetMap, «Ciclovia della
  Valsugana», ha lo stesso nome come nome alternativo. Come si chiama davvero il tratto di
  Bassano va chiesto a chi è del posto;
- «Nardini Basso» e «Nardini Alto» sono nomi d'uso riportati da fonti non ufficiali: è annotato
  nelle note interne `incertezze` dei due racconti;
- le due webcam (Piazza Libertà e Via Matteotti): nessuno ha aperto le pagine per vedere che
  cosa inquadrano davvero. Il punto sulla mappa vuole segnare il luogo inquadrato, non la
  telecamera;
- Brenta (punto scelto da noi), King Kong Rhino (posizione, verso e dimensioni del disegno sono
  una scelta: è volutamente più grande del vero), Garage Nardini (dedotto dal bar «Distilleria
  Bortolo Nardini» su OpenStreetMap, da verificare sul posto);
- Palazzo Bonaguro: le coordinate vengono dall'edificio su OpenStreetMap, che coincide con la
  categoria di Commons.

Testi che scadono:

- nel Museo Civico la frase sul ritorno del Cavallo di Canova va aggiornata dopo il
  12 dicembre 2026;
- «Bassano 2029» va aggiornato dopo il 16 dicembre 2026 (finaliste).

Pubblicazione:

- chi firma i commit e quale storia si pubblica: vedi «Pubblicazione», «Prima del primo push»;
- Vercel non è collegato al repository: i commit automatici dei dati (`dati.yml`, firmati
  `github-actions[bot]`) non ripubblicano il sito, che legge aria e avvisi da
  raw.githubusercontent.com (vedi «Pubblicazione»). Se un giorno si collega Vercel, secondo la
  guida di Vercel letta a novembre 2026 con un repository privato e il piano Hobby i commit di
  chi non è il proprietario dell'account non vengono pubblicati. Se il repository diventasse
  privato, raw.githubusercontent.com smetterebbe comunque di rispondere e aria e avvisi
  resterebbero fermi alla copia pubblicata con il sito;
- il dominio definitivo va scritto al posto del segnaposto in `index.html` (vedi
  «Pubblicazione»);
- i due workflow girano su GitHub dal novembre 2026 e finora sono sempre finiti in verde; al
  primo giro di `dati.yml` CCISS e Vi.abilità hanno risposto tutte e due;
- avvisi: se un giorno CCISS o Vi.abilità cominciano a rifiutare le richieste che partono dai
  server di GitHub, la fotografia degli avvisi non si aggiorna più e il lavoro resta rosso a
  ogni giro. In quel caso si può scegliere di accettare anche la fotografia incompleta
  (codice 2) nel passo degli avvisi di `dati.yml`;
- la Content-Security-Policy è stata provata in locale, non su Vercel; dopo la prossima
  pubblicazione va controllato nel browser che la lettura da raw.githubusercontent.com non sia
  bloccata;
- l'anteprima per i social è uno scatto del sito di metà novembre 2026: va rifatta se l'aspetto
  cambia.

Prove non ancora fatte: un telefono vero, un lettore di schermo, Safari e Firefox,
`prefers-reduced-motion` attivo. Su telefono, con il foglio di un racconto aperto, il credito
OpenStreetMap è coperto quasi del tutto dal foglio, insieme alla mappa, e torna in vista alla
chiusura: provato sul sito costruito a 375x812, non su un telefono vero. Il credito con il link
resta in «Fonti e licenze». Le didascalie con la
licenza a link sono coperte solo dalle prove automatiche.
