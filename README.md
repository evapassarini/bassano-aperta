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

Esegue tre script, in ordine:

| Script | Scrive | Da dove |
|---|---|---|
| `scripts/dati-osm.mjs` | `public/data/base.json` | Edifici, strade, acqua, verde e alberi da OpenStreetMap (Overpass API) |
| `scripts/dati-strati.mjs` | `public/data/strati.json` | Punti e linee di Cultura, Ambiente, Mobilità (OpenStreetMap e ARPAV) |
| `scripts/dati-aria.mjs` | `public/data/aria.json` | Fotografia della qualità dell'aria (ARPAV, stazione di Bassano) |

Da sapere:

- Overpass è spesso sovraccarico: gli script riprovano su più server e possono impiegare alcuni
  minuti. Se non ci riescono si fermano con un errore e lasciano intatti i file esistenti.
- `OSM_CACHE=<cartella> npm run dati` salva le risposte di Overpass e le riusa al giro dopo.
- Il livello del Brenta non passa da qui: lo legge il browser, in diretta, dall'API di ARPAV.
- L'aria invece è una fotografia: resta ferma finché non si rilancia lo script. Il sito mostra
  sempre la data e l'ora della misura.
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
- **Brenta e aria**: ARPAV, dati non validati. La licenza CC BY 4.0 è quella indicata nella
  pagina open data di ARPAV per i file XML; che valga anche per l'API in diretta e per i file
  dell'aria è una nostra lettura, da confermare.
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
- l'origine del nome «degli Ezzelini».

Permessi e licenze:

- conferma scritta di ARPAV per l'uso continuo dell'API del Brenta e per la licenza dei dati;
- permessi per le webcam (oggi solo link);
- il fuso orario delle date ARPAV non è dichiarato: l'ora mostrata potrebbe sbagliare di un'ora.

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
