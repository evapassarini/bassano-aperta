# Bassano Aperta

Una mappa isometrica di Bassano del Grappa, illustrata e disegnata dal codice, con il racconto
dei suoi luoghi e alcuni dati utili. È un progetto civico open source nato attorno alla
candidatura di Bassano a **Capitale italiana della Cultura 2029**. Il nome è provvisorio.

Cosa trovi nel sito:

- tutta la città in vista isometrica, costruita dai dati di OpenStreetMap: si trascina, si zooma,
  la posizione resta nell'indirizzo (`#@x,y,zoom`);
- dieci luoghi simbolo disegnati a parte (Ponte Vecchio, Castello degli Ezzelini, Torre Civica,
  Museo Civico, Palazzo Sturm, King Kong Rhino, Grapperia Nardini, Tempio Ossario, Porta Dieda,
  Bolle di Nardini);
- tre strati accendibili: Cultura, Ambiente, Mobilità;
- diciotto racconti (sedici luoghi e due temi) con linea del tempo, immagini, video e audio, e
  un riquadro «Adesso» con il dato in diretta dove esiste davvero (il livello del Brenta);
- i prossimi treni alla stazione di Bassano, con i ritardi dichiarati;
- gli avvisi sulla viabilità pubblicati dagli enti per le strade attorno a Bassano (non è il
  traffico in tempo reale);
- una pagina «Fonti e licenze».

È un sito statico: Vite e TypeScript, nessun framework, nessun server.

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

Esegue quattro script, in ordine:

| Script | Scrive | Da dove |
|---|---|---|
| `scripts/dati-osm.mjs` | `public/data/base.json` | Edifici, strade, acqua, verde e alberi da OpenStreetMap (Overpass API) |
| `scripts/dati-strati.mjs` | `public/data/strati.json` | Punti e linee di Cultura, Ambiente, Mobilità (OpenStreetMap e ARPAV) |
| `scripts/dati-aria.mjs` | `public/data/aria.json` | Fotografia della qualità dell'aria (ARPAV, stazione di Bassano) |
| `scripts/dati-avvisi.mjs` | `public/data/avvisi.json` | Fotografia degli avvisi sulla viabilità (CCISS Viaggiare Informati e Vi.abilità della Provincia di Vicenza) |

Due comandi a parte:

```sh
npm run dati:avvisi    # rifà solo la fotografia degli avvisi
npm run dati:stazioni  # rifà la tabella dei nomi delle stazioni dei treni
```

`dati:stazioni` scrive `public/data/stazioni-treni.json` a partire dagli orari di Trenitalia
distribuiti da BusOne. Scarica un archivio di circa 25 MB e ha bisogno del comando `unzip`: per
questo non fa parte di `npm run dati` e si rilancia solo quando cambiano le stazioni.

Da sapere:

- Overpass è spesso sovraccarico: gli script riprovano su più server e possono impiegare alcuni
  minuti. Se non ci riescono si fermano con un errore e lasciano intatti i file esistenti.
- `OSM_CACHE=<cartella> npm run dati` salva le risposte di Overpass e le riusa al giro dopo.
- Il livello del Brenta non passa da qui: lo legge il browser, in diretta, dall'API di ARPAV.
- L'aria invece è una fotografia: resta ferma finché non si rilancia lo script. Il sito mostra
  sempre la data e l'ora della misura.
- Nemmeno i treni passano da qui: il browser li legge in diretta da BusOne. Dagli script viene
  solo la tabella dei nomi delle stazioni.
- Anche gli avvisi sono una fotografia, e invecchiano in fretta: gli eventi del CCISS durano
  poche ore (il sito mostra solo quelli delle ultime 24 ore). `npm run dati:avvisi` va rilanciato
  spesso; ogni quanto è ancora da decidere. Se la fotografia ha più di 24 ore la scheda lo dice.
- Se Vi.abilità non risponde lo script tiene le ordinanze della fotografia precedente che
  valgono ancora; se non risponde CCISS il file esce senza eventi e la scheda dice che mancano.
  In tutti e due i casi lo script scrive il file ma esce con codice 2: va rilanciato. Se non
  risponde nessuna delle due esce con codice 1 e lascia intatto il file esistente.
- Le ordinanze di Vi.abilità con il periodo dei lavori già finito non entrano nella fotografia.
  Quando il periodo non è scritto in modo leggibile l'ordinanza resta: alcune possono
  riguardare lavori già finiti.
- L'elenco dei treni può non essere completo: BusOne pubblica solo le corse seguite in diretta
  e le corse soppresse arrivano senza fermate, quindi non si possono attribuire a Bassano.
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
la sua fonte, che gli indici `tappa.media` puntino a un'immagine esistente, che i media abbiano
autore, licenza e testo alternativo, che le coordinate stiano dentro la mappa e che i disegni
citati esistano.

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
- Dove le fonti non concordano non si sceglie: il punto va in `incertezze` e il sito lo mostra
  come «Le fonti non concordano».
- Le affermazioni delle aziende (Nardini, Poli) si attribuiscono: «secondo l'azienda».
- Viale dei Martiri e Tempio Ossario: tono sobrio, nessun dettaglio crudo, nessuna foto delle
  vittime.
- King Kong Rhino: nessuna fotografia della scultura (artista vivente, in Italia non c'è libertà
  di panorama). Solo la nostra illustrazione e la xilografia di Dürer.
- Niente orari, prezzi o calendari scritti a mano: si rimanda alla pagina ufficiale.
- La dicitura è «candidata a Capitale italiana della Cultura 2029». Mai «Città della cultura»,
  mai «europea».
- Immagini e audio solo da Wikimedia Commons con licenza verificata; sotto ognuno autore, licenza
  e link. Video solo da `youtube-nocookie.com`, caricati dopo un clic. Webcam solo come link.
- Italiano, frasi semplici, niente gergo.

Le regole complete e i contratti tra le parti stanno in `docs/SPEC.md`.

## Fonti e licenze

- **Codice**: licenza MIT, vedi `LICENSE`.
- **Mappa di base e punti**: © OpenStreetMap contributors, licenza ODbL 1.0, scaricati con
  Overpass API.
- **Brenta e aria**: ARPAV, dati non validati. La pagina open data di ARPAV dichiara la licenza
  CC BY 4.0 per i file XML ed elenca lì anche i file JSON dell'aria: che valga anche per quelli
  è una nostra lettura, da confermare. Per i dati dell'idrometro ARPAV non dichiara una licenza
  in modo esplicito: il sito lo dice e aspettiamo una conferma scritta.
- **Treni**: BusOne (busone.app), che rielabora i dati di Trenitalia, la fonte originale. Uso
  gratuito e non commerciale per privati ed enti non profit, con attribuzione; BusOne può
  sospendere il servizio. Sono i ritardi dichiarati dall'operatore, non un servizio ufficiale.
  Le posizioni dei treni, che in quei dati sono stime, non si mostrano.
- **Avvisi sulla viabilità**: CCISS Viaggiare Informati e Vi.abilità (Provincia di Vicenza).
  Nessuna delle due dichiara una licenza di riuso: il sito riporta solo una citazione breve, con
  il nome della fonte e il link alla pagina originale.
- **Immagini e audio**: Wikimedia Commons, ognuno con la propria licenza e il proprio autore,
  scritti nel racconto e mostrati sotto il file.
- **Video**: incorporati da YouTube, restano dei rispettivi canali.
- **Webcam**: solo collegamenti a siti esterni.
- **Illustrazioni dei luoghi simbolo** (`public/landmarks/`): disegnate per il progetto a partire
  dalle sagome di OpenStreetMap; altezze e dettagli sono in gran parte stime.
- **Caratteri**: Fraunces e Inter (SIL Open Font License), serviti dal sito stesso.

## Da confermare prima di pubblicare

Fatti storici (oggi sono tra le incertezze, non affermati):

- la distruzione del Ponte Vecchio nel 1945 e chi la compì;
- il ruolo degli Alpini nella ricostruzione del 1948;
- luogo, date e numeri del 26 settembre 1944; la tappa su Karl Franz Tausch poggia su una sola
  fonte: da rivedere con ANPI o ISTREVI;
- l'origine del nome «degli Ezzelini»;
- il nome del titolo: il link del logo del sito ufficiale della candidatura riporta una dicitura
  sbagliata («europea»). È un refuso, non un disaccordo tra fonti: nei racconti non lo citiamo e
  scriviamo sempre «candidata a Capitale italiana della Cultura 2029».

Permessi e licenze:

- conferma scritta di ARPAV per l'uso continuo dell'API del Brenta e per la licenza dei dati;
- permessi per le webcam (oggi solo link);
- il fuso orario delle date ARPAV non è dichiarato: l'ora mostrata potrebbe sbagliare di un'ora;
- BusOne ammette solo privati ed enti non profit, per usi non commerciali: conta chi firma il
  progetto. Se lo pubblica un'azienda o uno studio, serve prima il consenso scritto di BusOne;
- BusOne chiede un contatto nell'header `X-BusOne-Client`. Oggi non c'è: va aggiunto in
  `src/live/index.ts` e in `scripts/dati-stazioni.mjs` quando il progetto avrà un indirizzo per
  le segnalazioni;
- i termini di BusOne e la licenza dei dati di Trenitalia vanno riletti alla fonte: qui sono
  riportati come ci sono stati riferiti;
- CCISS e Vi.abilità non dichiarano una licenza di riuso: chiedere a entrambi una conferma
  scritta. Fino ad allora solo citazioni brevi con link.

Media:

- nessuno ha ancora guardato per intero i video incorporati né ascoltato le due registrazioni di
  «Sul ponte di Bassano»;
- l'anno del cinegiornale Luce sul Tempio Ossario;
- per sei file di Commons autore e licenza vengono solo dalla ricerca, non da un secondo
  controllo sull'API di Commons;
- Nardini al Ponte, Garage Nardini e Bolle non hanno immagini libere: i loro racconti sono solo
  testo.

Posizioni sulla mappa:

- Brenta (punto scelto da noi), King Kong Rhino (posizione, verso e dimensioni del disegno sono
  una scelta: è volutamente più grande del vero), Garage Nardini (dedotto dal bar «Distilleria
  Bortolo Nardini» su OpenStreetMap, da verificare sul posto);
- Palazzo Bonaguro: le coordinate vengono dall'edificio su OpenStreetMap, che coincide con la
  categoria di Commons;
- le due webcam segnano il luogo inquadrato, non la telecamera.

Scadenze:

- «Bassano 2029» va aggiornato dopo il 16 dicembre 2026 (finaliste);
- nel Museo Civico la frase sul ritorno del Cavallo di Canova va aggiornata dopo il
  12 dicembre 2026.

Prove non ancora fatte: un telefono vero, un lettore di schermo, Safari e Firefox,
`prefers-reduced-motion` attivo. In «Fonti e licenze» mancano ancora l'indirizzo del codice e
quello per le segnalazioni: si impostano con gli attributi `data-codice` e `data-segnalazioni`
su `<div id="ui">` in `index.html`.
