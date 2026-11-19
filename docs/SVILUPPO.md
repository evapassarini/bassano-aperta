# Bassano Aperta: guida per chi sviluppa

Come avviare il sito, rigenerare i dati, scrivere un racconto, ridisegnare un luogo simbolo e
pubblicare. La specifica del sito sta in
[`SPEC.md`](SPEC.md); le licenze in [`NOTICE`](../NOTICE).

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

Cinque comandi a parte:

```sh
npm run dati:aria      # rifà solo la fotografia dell'aria
npm run dati:avvisi    # rifà solo la fotografia degli avvisi
npm run dati:lampioni  # rifà solo i lampioni (legge base.json: va lanciato dopo dati-osm)
npm run dati:alberi    # aggiunge a base.json gli alberi dei giardini del centro, senza Overpass
npm run dati:stazioni  # rifà la tabella dei nomi delle stazioni dei treni
```

`dati:alberi` usa la griglia di `scripts/lib/alberi.mjs`, la stessa di `scripts/dati-osm.mjs`:
nei parchi e nei giardini entro 1,2 km da Piazza Libertà gli alberi illustrativi stanno su una
griglia di 13 m invece che di 24. Rifacendo la mappa da capo con `dati-osm` gli alberi del
centro restano fitti, ma non sono proprio gli stessi punti. Gli alberi che ci sono già restano;
quelli nuovi si aggiungono in fondo, lontano almeno 6 m dagli altri, fuori da case e acqua.

`dati:stazioni` scrive `public/data/stazioni-treni.json` a partire dagli orari di Trenitalia
distribuiti da BusOne. Scarica un archivio di circa 25 MB e ha bisogno del comando `unzip`: per
questo non fa parte di `npm run dati` e si rilancia solo quando cambiano le stazioni.

Aria e avvisi non vanno rilanciati a mano: li aggiorna da solo, più volte al giorno, il workflow
`.github/workflows/dati.yml` nel repository su GitHub, e il sito pubblicato legge da lì la
versione più recente (vedi «Pubblicazione del sito»). Gli altri file si rigenerano solo a mano e
arrivano sul sito solo quando lo si ripubblica.

`dati:lampioni` scarica da OpenStreetMap i lampioni rilevati (pochi, a Bassano) e ne aggiunge
altri lungo le strade e sul bordo delle piazze di `base.json`, con regole fisse: a ogni corsa
escono gli stessi punti. Nel file i rilevati stanno per primi e il campo `veri` dice
quanti sono; gli altri sono illustrativi e il sito lo dichiara in «Fonti e licenze». Se Overpass
non risponde lo script tiene i lampioni rilevati del file che c'è già e lo scrive in console;
solo se un file precedente con lampioni rilevati non esiste scrive `veri: 0`.

Da sapere:

- Overpass è spesso sovraccarico: gli script riprovano su più server e possono impiegare alcuni
  minuti. Se non ci riescono si fermano con un errore e lasciano intatti i file esistenti.
- `OSM_CACHE=<cartella> npm run dati` salva le risposte di Overpass e le riusa al giro dopo.
- Il livello della Brenta non passa da qui: lo legge il browser, in diretta, dall'API di ARPAV.
- L'aria invece è una fotografia: resta ferma finché non gira di nuovo lo script. Il sito
  mostra la data e l'ora della misura.
- Accanto ai numeri dell'aria il sito scrive un giudizio a parole (buona, accettabile, mediocre,
  scadente, pessima) per l'ultimo giorno intero, di norma ieri. Lo calcola il sito
  (`src/live/giudizioAria.ts`) con le fasce dell'indice di qualità dell'aria di ARPAV, su
  polveri PM10 e ozono. Non è l'indice ufficiale, che considera anche il biossido di azoto e usa
  dati validati: il sito lo dice e rimanda ai dati validati di ARPAV. Se i dati non bastano il
  giudizio non compare. È aggiornato a ieri solo se lo script gira ogni giorno, come fa
  l'aggiornamento automatico; se ha più di 3 giorni il sito lo mostra con la sua data. Regole e
  cose ancora da verificare: [`SPEC.md`](SPEC.md), «Giudizio a parole sull'aria».
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
Le `incertezze` non compaiono sul sito, ma si leggono nei file del repository e nel JavaScript
pubblicato.

Per un racconto nuovo:

1. crea `content/luoghi/<id>.json` (da 6 a 10 tappe; `genere` è `luogo` oppure `tema`; un luogo
   ha `lat` e `lon`, un tema no);
2. aggiungi l'id all'elenco `I18` in `tests/contenuti.test.ts`;
3. se è un luogo, aggiungi il suo punto in `scripts/dati-strati.mjs` e rilancia lo script: senza
   un punto in `strati.json` il luogo non compare sulla mappa;
4. se esiste un disegno, mettilo in `public/landmarks/<nome>.svg`, aggiungilo a
   `public/landmarks/indice.json` e scrivi `"landmark": "<nome>"` nel racconto.

Eccezione nota: il Monte Grappa è circa 12 km fuori dalla mappa. Il racconto tiene le coordinate
vere della cima; il suo punto sulla mappa cade sotto le nuvole e non si disegna (vedi
[`SPEC.md`](SPEC.md), «Bordo della mappa»): il racconto si apre dall'elenco «Luoghi».

## Come ridisegnare un luogo simbolo

Le dieci illustrazioni non sono disegnate a mano: ognuna esce da un piccolo programma,
`scripts/landmark/luoghi/<id>.mjs`, che scrive `public/landmarks/<id>.svg`.

```sh
npm run illustrazioni                 # rigenera tutti gli SVG
npm run illustrazioni -- porta-dieda  # solo uno (o più id di seguito)
```

Per cambiare un disegno:

1. modifica il suo generatore. Le misure sono in metri locali rispetto al punto d'appoggio
   (x verso est, y verso nord, z in alto) e la proiezione è quella di [`SPEC.md`](SPEC.md); 4 unità
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

## Fonti nel dettaglio

- **Mappa di base e punti**: © OpenStreetMap contributors, licenza ODbL 1.0, scaricati con
  Overpass API. Il credito «© OpenStreetMap contributors», con il link alla pagina del
  copyright, è sempre scritto sulla mappa: su schermo largo in basso a destra sotto lo zoom, su
  telefono in alto a destra sotto gli strati.
- **Alberi**: una parte viene da OpenStreetMap, una parte è aggiunta dal codice dentro boschi e
  parchi a scopo illustrativo; «Fonti e licenze» lo dice. I due numeri compariranno quando
  `base.json` avrà il campo `alberiVeri`.
- **Brenta e aria**: ARPAV, dati non validati. La pagina open data di ARPAV dichiara la licenza
  CC BY 4.0 per i file XML ed elenca lì anche i file JSON dell'aria: che valga anche per quelli
  è una nostra lettura, da confermare. Per i dati dell'idrometro ARPAV non dichiara una licenza
  in modo esplicito: il sito lo dice.
- **Scala del giudizio sull'aria**: le cinque classi e le soglie vengono dalle pagine di ARPAV
  sull'indice di qualità dell'aria. Il giudizio è un calcolo nostro, non un dato ARPAV.
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
- **Audio**: il sito sa mostrarli, ma oggi nessun racconto ne ha (vedi [`SPEC.md`](SPEC.md), «Punti aperti»).
- **Video**: incorporati da YouTube, restano dei rispettivi canali.
- **Webcam**: solo collegamenti a siti esterni.
- **Lampioni**: quelli segnati su OpenStreetMap (ODbL 1.0), più altri disposti dal nostro codice
  lungo le strade e sul bordo delle piazze a scopo illustrativo. Non sono un rilievo
  dell'illuminazione pubblica; i due numeri stanno in «Fonti e licenze» sul sito.
- **Illustrazioni dei luoghi simbolo** (`public/landmarks/`): disegnate per il progetto a partire
  dalle sagome di OpenStreetMap; altezze e dettagli sono in gran parte stime. Il sito lo dice in
  una voce di «Fonti e licenze».
- **Caratteri**: Fraunces e Inter (SIL Open Font License), serviti dal sito stesso.

## Pubblicazione del sito

- **Chi lo cura**: Bassano Aperta è un progetto personale senza scopi commerciali. Questo conta
  per i termini di BusOne, che ammettono solo privati ed enti non profit.
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
- **Indirizzo del sito**: <https://bassano.evapassarini.com>. Nel codice è scritto in un punto solo: in
  `index.html`, nelle tre righe sotto il commento «Indirizzo del sito» (`canonical`, `og:url`,
  `og:image`). Se cambia, va aggiornato anche in README.md, in docs/SPEC.md («Avvio» e «Pubblicazione») e qui. Il primo indirizzo,
  <https://bassano-aperta.vercel.app>, funziona ancora.
- **Aggiornamento automatico dei dati**: `.github/workflows/dati.yml` è programmato ogni 6 ore
  e si può avviare a mano dalla scheda Actions di GitHub. GitHub può ritardare o saltare i lavori
  programmati, quindi i testi del sito dicono «più volte al giorno». Esegue `npm run dati:aria` e
  `npm run dati:avvisi`, poi le prove. Se le prove passano e `public/data/aria.json` o
  `public/data/avvisi.json` sono cambiati, li salva nel ramo `main` del repository. Il sito
  pubblicato non viene ricostruito: legge i due file da lì (vedi il punto dopo). Se una fonte
  non risponde, o per gli avvisi ne risponde una sola (codice di uscita 2), il suo file resta
  quello di prima e il lavoro finisce in rosso nella scheda Actions.
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
  dell'indirizzo `http://localhost:5193/#@-235,100,3.8` con la luce «Giorno». Nell'immagine deve
  restare leggibile il credito «© OpenStreetMap contributors». L'icona per iPhone è
  `public/apple-touch-icon.png` (180x180), ricavata dall'icona di `index.html`.
- **Tasselli dipinti**: spenti. Si accendono solo con la variabile d'ambiente `VITE_TASSELLI=1`
  al momento di costruire il sito o di avviare `npm run dev`. Da spenti il sito non chiede
  nulla alla rete per i tasselli. Su Vercel la variabile non va impostata.
