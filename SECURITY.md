# Sicurezza

## Segnalare una vulnerabilità

Non aprire una issue pubblica per una vulnerabilità non ancora corretta.

Usa il canale privato di GitHub:

<https://github.com/evapassarini/bassano-aperta/security/advisories/new>

Indica che cosa è coinvolto, come riprodurre il problema in pochi passi e che impatto ha,
senza dati personali o credenziali.

## Che cosa conta

Bassano Aperta è un sito statico, senza server, senza account e senza moduli. Contano soprattutto:

- un modo per far eseguire codice nel browser di chi visita (per esempio attraverso i testi dei
  racconti o i dati scaricati dalle fonti);
- un buco nella Content-Security-Policy di `vercel.json`;
- dipendenze compromesse;
- workflow di GitHub Actions con più permessi del necessario.

Un errore in un testo o in un dato, senza effetti sulla sicurezza, si segnala con una
[issue](https://github.com/evapassarini/bassano-aperta/issues) normale.
