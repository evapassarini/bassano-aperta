# Contribuire a Bassano Aperta

Grazie per voler contribuire.

## Segnalare un errore

Apri una [issue](https://github.com/evapassarini/bassano-aperta/issues) e scrivi:

- dove l'hai visto (il racconto, il punto della mappa o l'indirizzo della pagina);
- che cosa non va;
- se puoi, una fonte che lo mostra: un libro, un archivio, la pagina di un ente.

Per un problema di sicurezza non aprire una issue pubblica: segui [SECURITY.md](SECURITY.md).

## Proporre una modifica

1. Per una modifica grande, apri prima una issue e parliamone.
2. Parti dall'ultimo `main` e tieni la modifica piccola e su un tema solo.
3. Installa con `npm ci` e prova con `npm test` e `npm run build`. Il controllo automatico su
   GitHub rifà le stesse prove a ogni pull request.
4. Se cambi qualcosa che si vede, guardalo nel browser con `npm run dev`, anche a larghezza di
   telefono.

La guida tecnica è in [docs/SVILUPPO.md](docs/SVILUPPO.md), la specifica in
[docs/SPEC.md](docs/SPEC.md).

## Testi e fatti

- Ogni fatto nuovo ha una fonte letta, scritta nella tappa del racconto.
- Se le fonti non sono d'accordo, il punto va nelle note `incertezze` del racconto, non nel
  testo mostrato.
- Il fiume si scrive al femminile: «la Brenta». Il titolo si scrive «candidata a Capitale
  italiana della Cultura 2029».
- Italiano semplice, frasi brevi, niente gergo.

## Immagini, audio e video

- Immagini e audio solo da Wikimedia Commons, con licenza libera verificata. Ognuno ha autore,
  licenza, link alla pagina e un testo alternativo.
- Nessuna fotografia della scultura King Kong Rhino: l'artista è vivente e in Italia non c'è
  libertà di panorama.
- Video solo da `youtube-nocookie.com`, caricati dopo un clic.

## Dati e fonti nuove

Per una fonte nuova indica chi la pubblica, l'indirizzo ufficiale, la licenza, ogni quanto si
aggiorna e che cosa non misura. Una fonte esterna nuova va aggiunta anche alla
Content-Security-Policy in `vercel.json`, altrimenti il browser la blocca, e va descritta in
`NOTICE` e nella pagina «Fonti e licenze» (`src/ui/fonti.ts`).

## Licenza dei contributi

Il codice che proponi viene pubblicato con la licenza MIT del progetto. Per testi e
illustrazioni vale quello che è scritto in [NOTICE](NOTICE).
