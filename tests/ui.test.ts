import { describe, expect, it } from 'vitest';
import type { Punto, Storia } from '../src/types';
import {
  chiaveOrdine,
  contaRisultati,
  decidiTappe,
  descriviDurata,
  descriviStrato,
  dividiStorie,
  etichettaTipo,
  filtraPunti,
  filtraStorie,
  fontiUniche,
  formattaData,
  formattaDataOra,
  formattaDataOraLunga,
  formattaDifferenza,
  formattaLivello,
  formattaMisura,
  formattaNumero,
  formattaOra,
  formattaPortata,
  idYouTube,
  immagineDellaTappa,
  mediaResidui,
  normalizza,
  parolaTendenza,
  testoPortata,
  tracciaSerie,
  urlIncorporamento,
  urlMiniatura,
  urlPaginaYouTube,
  urlSicuro,
} from '../src/ui/aiuti';

function storia(parziale: Partial<Storia> & { id: string; nome: string }): Storia {
  return {
    sottotitolo: '',
    genere: 'luogo',
    intro: '',
    tappe: [],
    media: [],
    live: [],
    incertezze: [],
    ...parziale,
  };
}

const STORIE: Storia[] = [
  storia({ id: 'ponte-vecchio', nome: 'Ponte Vecchio', sottotitolo: 'Il ponte degli Alpini, di legno, sul Brenta' }),
  storia({ id: 'brenta', nome: 'Il Brenta', sottotitolo: 'Il fiume delle zattere' }),
  storia({ id: 'grappa', nome: 'La grappa', sottotitolo: 'Dalle vinacce al bicchierino', genere: 'tema' }),
  storia({ id: 'museo-civico', nome: 'Museo Civico', sottotitolo: 'Canova, Jacopo Bassano e la città' }),
  storia({ id: 'mura-porte', nome: 'Mura e porte', sottotitolo: 'La città murata' }),
];

describe('ricerca nei luoghi', () => {
  it('toglie accenti, maiuscole e punteggiatura', () => {
    expect(normalizza('  Calà del Sasso! ')).toBe('cala del sasso');
    expect(normalizza("Ca' Erizzo-Luca")).toBe('ca erizzo luca');
    expect(normalizza('Mobilità')).toBe('mobilita');
  });

  it('ordina senza contare gli articoli', () => {
    expect(chiaveOrdine('Il Brenta')).toBe('brenta');
    expect(chiaveOrdine("L'Ossario")).toBe('ossario');
    expect(chiaveOrdine('La grappa')).toBe('grappa');
    expect(chiaveOrdine('Largo Parolini')).toBe('largo parolini');
    const nomi = ['Palazzo Sturm', 'Il rinoceronte di Palazzo Sturm', 'Palazzo Bonaguro'].map((nome, i) =>
      storia({ id: String(i), nome }),
    );
    expect(filtraStorie(nomi, 'palazzo').map((s) => s.nome)).toEqual([
      'Palazzo Bonaguro',
      'Palazzo Sturm',
      'Il rinoceronte di Palazzo Sturm',
    ]);
  });

  it('senza testo restituisce tutto in ordine alfabetico', () => {
    expect(filtraStorie(STORIE, '   ').map((s) => s.id)).toEqual([
      'brenta',
      'grappa',
      'mura-porte',
      'museo-civico',
      'ponte-vecchio',
    ]);
  });

  it('cerca nel nome e nel sottotitolo, prima chi ha la parola nel nome', () => {
    expect(filtraStorie(STORIE, 'brenta').map((s) => s.id)).toEqual(['brenta', 'ponte-vecchio']);
    expect(filtraStorie(STORIE, 'CITTÀ').map((s) => s.id)).toEqual(['mura-porte', 'museo-civico']);
  });

  it('chiede tutte le parole e accetta pezzi di parola', () => {
    expect(filtraStorie(STORIE, 'ponte alpini').map((s) => s.id)).toEqual(['ponte-vecchio']);
    expect(filtraStorie(STORIE, 'mus').map((s) => s.id)).toEqual(['museo-civico']);
    expect(filtraStorie(STORIE, 'ponte museo')).toEqual([]);
    expect(filtraStorie(STORIE, 'xyz')).toEqual([]);
  });

  it('non modifica la lista di partenza', () => {
    const copia = STORIE.map((s) => s.id);
    filtraStorie(STORIE, '');
    expect(STORIE.map((s) => s.id)).toEqual(copia);
  });

  it('separa i luoghi dai temi', () => {
    const { luoghi, temi } = dividiStorie(STORIE);
    expect(temi.map((s) => s.id)).toEqual(['grappa']);
    expect(luoghi).toHaveLength(4);
  });

  it('conta i risultati a parole', () => {
    expect(contaRisultati(0)).toBe('Nessun risultato');
    expect(contaRisultati(1)).toBe('1 risultato');
    expect(contaRisultati(7)).toBe('7 risultati');
  });
});

describe('numeri in italiano', () => {
  it('usa la virgola per i decimali', () => {
    expect(formattaNumero(0.96, 2)).toBe('0,96');
    expect(formattaNumero(1.5, 2)).toBe('1,50');
    expect(formattaNumero(51.79, 1)).toBe('51,8');
    expect(formattaNumero(12)).toBe('12');
  });

  it('scrive livello e portata con le unità', () => {
    expect(formattaLivello(0.96)).toBe('0,96 m');
    expect(formattaLivello(1)).toBe('1,00 m');
    expect(formattaPortata(51.79)).toBe('51,8 m³/s');
    expect(formattaPortata(312.4)).toBe('312 m³/s');
  });

  it('scrive le differenze in centimetri con il segno', () => {
    expect(formattaDifferenza(0.13)).toBe('+13 cm');
    expect(formattaDifferenza(-0.04)).toBe('−4 cm');
    expect(formattaDifferenza(0.004)).toBe('0 cm');
  });

  it("scrive le misure dell'aria senza zeri inutili", () => {
    expect(formattaMisura(23)).toBe('23');
    expect(formattaMisura(7.46)).toBe('7,5');
  });
});

describe('date in italiano', () => {
  it("mostra tale e quale l'ora senza fuso di ARPAV", () => {
    expect(formattaDataOra('2026-11-14T23:40:00')).toBe('sabato 14 novembre, ore 23:40');
    expect(formattaOra('2026-11-14T00:10:00')).toBe('00:10');
    expect(formattaData('2026-11-14T23:40:00')).toBe('14 novembre 2026');
  });

  it("porta all'ora italiana le date con il fuso", () => {
    expect(formattaDataOra('2026-11-14T22:40:00Z')).toBe('sabato 14 novembre, ore 23:40');
    expect(formattaDataOraLunga('2026-07-01T10:00:00Z')).toBe('1 luglio 2026, ore 12:00');
    expect(formattaDataOraLunga('2026-11-14T23:30:00.000Z')).toBe('15 novembre 2026, ore 00:30');
    expect(formattaOra('2026-11-14T06:00:00+01:00')).toBe('06:00');
  });

  it('accetta le date senza ora', () => {
    expect(formattaData('2026-11-13')).toBe('13 novembre 2026');
    expect(formattaDataOra('2026-11-13')).toBe('venerdì 13 novembre');
    expect(formattaOra('2026-11-13')).toBe('');
    expect(formattaDataOraLunga('2026-11-13')).toBe('13 novembre 2026');
  });

  it('restituisce il testo com’è se non è una data', () => {
    expect(formattaData('ieri')).toBe('ieri');
    expect(formattaDataOra('media delle 24 ore')).toBe('media delle 24 ore');
    expect(formattaDataOra('')).toBe('');
  });

  it('descrive quanto tempo copre una serie', () => {
    expect(descriviDurata(71.5)).toBe('Ultimi 3 giorni');
    expect(descriviDurata(24)).toBe('Ultime 24 ore');
    expect(descriviDurata(40)).toBe('Ultimi 2 giorni');
    expect(descriviDurata(8)).toBe('Ultime 8 ore');
    expect(descriviDurata(0.4)).toBe('Ultima ora');
  });
});

describe('parole per la tendenza del fiume', () => {
  it('dice se sale, scende o è stabile', () => {
    expect(parolaTendenza({ verso: 'sale', differenza: 0.13, ore: 3 })).toBe('In salita: +13 cm rispetto a 3 ore prima');
    expect(parolaTendenza({ verso: 'scende', differenza: -0.04, ore: 3 })).toBe('In calo: −4 cm rispetto a 3 ore prima');
    expect(parolaTendenza({ verso: 'stabile', differenza: 0.01, ore: 3 })).toBe('Stabile rispetto a 3 ore prima');
    expect(parolaTendenza({ verso: 'stabile', differenza: 0, ore: 1 })).toBe("Stabile rispetto a un'ora prima");
  });

  it('tace se non c’è un confronto', () => {
    expect(parolaTendenza(null)).toBe('');
  });
});

describe('grafico piccolo', () => {
  it('disegna la serie dentro il rettangolo, con minimo e massimo veri', () => {
    const t = tracciaSerie([0.7, 0.8, 0.9, 1.0], 280, 56, 5)!;
    expect(t.minimo).toBe(0.7);
    expect(t.massimo).toBe(1);
    expect(t.linea.startsWith('M5 51')).toBe(true);
    expect(t.ultimo).toEqual({ x: 275, y: 5 });
    expect(t.area.endsWith('Z')).toBe(true);
  });

  it('non esagera le piccole oscillazioni e non divide per zero', () => {
    const t = tracciaSerie([0.9, 0.9, 0.9], 280, 56, 5)!;
    expect(t.linea).not.toContain('NaN');
    expect(t.ultimo.y).toBe(28);
  });

  it('riduce le serie lunghe ma tiene sempre l’ultimo punto', () => {
    const valori = Array.from({ length: 430 }, (_, i) => 0.7 + i / 1000);
    const t = tracciaSerie(valori, 280, 56, 5)!;
    expect(t.linea.split('L').length).toBeLessThanOrEqual(162);
    expect(t.ultimo.x).toBe(275);
    expect(t.massimo).toBeCloseTo(1.129, 6);
  });

  it('con meno di due punti non disegna', () => {
    expect(tracciaSerie([1], 280, 56)).toBeNull();
    expect(tracciaSerie([], 280, 56)).toBeNull();
  });
});

describe('indirizzi dei video', () => {
  it('riconosce gli indirizzi di YouTube nelle forme più comuni', () => {
    expect(idYouTube('https://www.youtube-nocookie.com/embed/61rteLifD18')).toBe('61rteLifD18');
    expect(idYouTube('https://www.youtube.com/watch?v=-RP6F2RqYCo&t=10s')).toBe('-RP6F2RqYCo');
    expect(idYouTube('https://youtu.be/bmJv2sGn704?si=abc')).toBe('bmJv2sGn704');
    expect(idYouTube('https://m.youtube.com/shorts/n1AMWOF650s')).toBe('n1AMWOF650s');
    expect(idYouTube('https://www.youtube.com/embed/1jFbsPYYgBo')).toBe('1jFbsPYYgBo');
  });

  it('rifiuta tutto il resto', () => {
    expect(idYouTube('https://vimeo.com/123456789')).toBeNull();
    expect(idYouTube('https://www.youtube.com/watch?v=corto')).toBeNull();
    expect(idYouTube('https://youtube.com.esempio.it/embed/61rteLifD18')).toBeNull();
    expect(idYouTube('javascript:alert(1)')).toBeNull();
    expect(idYouTube('non è un indirizzo')).toBeNull();
    expect(idYouTube('https://www.youtube.com/embed/')).toBeNull();
  });

  it('incorpora sempre e solo da youtube-nocookie', () => {
    expect(urlIncorporamento('https://www.youtube.com/watch?v=61rteLifD18')).toBe(
      'https://www.youtube-nocookie.com/embed/61rteLifD18?rel=0',
    );
    expect(urlIncorporamento('https://www.youtube-nocookie.com/embed/61rteLifD18', true)).toBe(
      'https://www.youtube-nocookie.com/embed/61rteLifD18?autoplay=1&rel=0',
    );
    expect(urlIncorporamento('https://www.youtube-nocookie.com/embed/61rteLifD18?start=42')).toBe(
      'https://www.youtube-nocookie.com/embed/61rteLifD18?start=42&rel=0',
    );
    expect(urlIncorporamento('https://vimeo.com/123456789')).toBeNull();
    expect(urlIncorporamento('https://www.youtube-nocookie.com/embed/"><script>')).toBeNull();
  });

  it('sa indicare la pagina del video', () => {
    expect(urlPaginaYouTube('https://www.youtube-nocookie.com/embed/61rteLifD18')).toBe(
      'https://www.youtube.com/watch?v=61rteLifD18',
    );
    expect(urlPaginaYouTube('https://esempio.it/')).toBeNull();
  });
});

describe('altri indirizzi', () => {
  it('lascia passare solo http e https', () => {
    expect(urlSicuro('https://www.arpa.veneto.it/')).toBe('https://www.arpa.veneto.it/');
    expect(urlSicuro('javascript:alert(1)')).toBeNull();
    expect(urlSicuro('data:text/html,ciao')).toBeNull();
    expect(urlSicuro('')).toBeNull();
    expect(urlSicuro(undefined)).toBeNull();
    expect(urlSicuro('pagina.html')).toBeNull();
  });

  it('chiede a Commons una versione piccola delle immagini', () => {
    expect(urlMiniatura('https://commons.wikimedia.org/wiki/Special:FilePath/Pallarch3-2.jpg?width=960')).toBe(
      'https://commons.wikimedia.org/wiki/Special:FilePath/Pallarch3-2.jpg?width=500',
    );
    expect(urlMiniatura('https://commons.wikimedia.org/wiki/Special:FilePath/Pallarch3-2.jpg')).toBe(
      'https://commons.wikimedia.org/wiki/Special:FilePath/Pallarch3-2.jpg?width=500',
    );
    expect(urlMiniatura('https://esempio.it/foto.jpg?width=960')).toBe('https://esempio.it/foto.jpg?width=960');
  });
});

describe('contenuto di una storia', () => {
  const s = storia({
    id: 'prova',
    nome: 'Prova',
    tappe: [
      { anno: '1209', titolo: 'A', testo: '', fonte: { titolo: 'Fonte uno', url: 'https://uno.it/' }, media: 0 },
      { anno: '1569', titolo: 'B', testo: '', fonte: { titolo: 'Fonte due', url: 'https://due.it/' } },
      { anno: '1748', titolo: 'C', testo: '', fonte: { titolo: 'Fonte uno, di nuovo', url: 'https://uno.it/' }, media: 3 },
      { anno: '1948', titolo: 'D', testo: '', fonte: { titolo: 'Fonte due', url: 'https://due.it/' }, media: 9 },
    ],
    media: [
      { tipo: 'immagine', titolo: 'i0', url: 'u', pagina: 'p', autore: 'a', licenza: 'l', alt: 'x' },
      { tipo: 'immagine', titolo: 'i1', url: 'u', pagina: 'p', autore: 'a', licenza: 'l', alt: 'x' },
      { tipo: 'audio', titolo: 'a2', url: 'u', pagina: 'p', autore: 'a', licenza: 'l' },
      { tipo: 'video', titolo: 'v3', url: 'u', pagina: 'p', autore: 'a', licenza: 'l' },
      { tipo: 'immagine', titolo: 'i4', url: 'u', pagina: 'p', autore: 'a', licenza: 'l', alt: 'x' },
    ],
  });

  it('elenca ogni fonte una volta sola', () => {
    expect(fontiUniche(s)).toEqual([
      { titolo: 'Fonte uno', url: 'https://uno.it/' },
      { titolo: 'Fonte due', url: 'https://due.it/' },
    ]);
  });

  it('lega a una tappa solo immagini che esistono davvero', () => {
    expect(immagineDellaTappa(s, 0)).toBe(0);
    expect(immagineDellaTappa(s, 1)).toBeNull();
    expect(immagineDellaTappa(s, 2)).toBeNull(); // punta a un video
    expect(immagineDellaTappa(s, 3)).toBeNull(); // punta fuori dalla lista
  });

  it('lascia alla galleria le immagini non usate dalle tappe, e tutti gli audio e i video', () => {
    expect(mediaResidui(s, 'immagine')).toEqual([1, 4]);
    expect(mediaResidui(s, 'audio')).toEqual([2]);
    expect(mediaResidui(s, 'video')).toEqual([3]);
  });
});

describe('etichette', () => {
  it('dà un nome leggibile ai tipi di punto', () => {
    expect(etichettaTipo('fermata-bus')).toBe("Fermata dell'autobus");
    expect(etichettaTipo('luogo-storico')).toBe('Luogo storico');
  });

  it('descrive uno strato dai tipi presenti, senza ripetizioni', () => {
    const elementi = [
      { strato: 'cultura' as const, tipo: 'museo' },
      { strato: 'cultura' as const, tipo: 'museo' },
      { strato: 'cultura' as const, tipo: 'chiesa' },
      { strato: 'mobilita' as const, tipo: 'ciclabile' },
    ];
    expect(descriviStrato('cultura', elementi)).toBe('musei, chiese');
    expect(descriviStrato('mobilita', elementi)).toBe('piste ciclabili');
    expect(descriviStrato('ambiente', elementi)).toBe("qualità dell'aria, livello del Brenta");
  });
});

describe('testoPortata', () => {
  it("non aggiunge l'ora se portata e livello sono della stessa lettura", () => {
    expect(testoPortata(51.79, '2026-11-15T00:00:00', '2026-11-15T00:00:00')).toBe('portata 51,8 m³/s');
    expect(testoPortata(51.79, null, '2026-11-15T00:00:00')).toBe('portata 51,8 m³/s');
  });

  it("dice l'ora della portata quando è di una lettura precedente", () => {
    expect(testoPortata(51.79, '2026-11-14T23:50:00', '2026-11-15T00:00:00')).toBe(
      'portata 51,8 m³/s (alle 23:50)',
    );
  });
});

describe('decidiTappe', () => {
  const a = { nome: 'a' };
  const b = { nome: 'b' };

  it('nasconde solo le tappe ancora sotto il bordo', () => {
    const rivelate = new WeakSet<object>();
    expect(
      decidiTappe(
        [
          { bersaglio: a, visibile: true, sottoIlBordo: false },
          { bersaglio: b, visibile: false, sottoIlBordo: true },
        ],
        rivelate,
      ),
    ).toEqual([
      { bersaglio: a, azione: 'mostra' },
      { bersaglio: b, azione: 'nascondi' },
    ]);
    expect(rivelate.has(a)).toBe(true);
    expect(rivelate.has(b)).toBe(false);
  });

  it('non rinasconde una tappa già mostrata, nemmeno nello stesso lotto', () => {
    const rivelate = new WeakSet<object>();
    // Il caso vero: visibile, poi spinta sotto il bordo dal disegno che si carica sopra.
    const azioni = decidiTappe(
      [
        { bersaglio: a, visibile: true, sottoIlBordo: false },
        { bersaglio: a, visibile: false, sottoIlBordo: true },
      ],
      rivelate,
    );
    expect(azioni).toEqual([{ bersaglio: a, azione: 'mostra' }]);
    expect(decidiTappe([{ bersaglio: a, visibile: false, sottoIlBordo: true }], rivelate)).toEqual([]);
  });

  it('mostra una tappa già passata sopra il bordo alto', () => {
    expect(decidiTappe([{ bersaglio: a, visibile: false, sottoIlBordo: false }], new WeakSet())).toEqual([
      { bersaglio: a, azione: 'mostra' },
    ]);
  });
});

describe('filtraPunti', () => {
  const punto = (id: string, tipo: Punto['tipo'], nome: string, altro: Partial<Punto> = {}): Punto => ({
    id,
    strato: tipo === 'fermata-bus' || tipo === 'stazione' ? 'mobilita' : tipo === 'chiesa' ? 'cultura' : 'ambiente',
    tipo,
    nome,
    x: 0,
    y: 0,
    ...altro,
  });
  const punti: Punto[] = [
    punto('aria', 'aria', 'Stazione ARPAV «Bassano»'),
    punto('idro', 'idrometro', 'Idrometro ARPAV', { storia: 'brenta' }),
    punto('cam', 'webcam', 'Webcam di Piazza Libertà'),
    punto('treno', 'stazione', 'Bassano del Grappa'),
    punto('bus1', 'fermata-bus', 'Viale delle Fosse'),
    punto('bus2', 'fermata-bus', 'Via Roma'),
    punto('chiesa', 'chiesa', 'San Donato'),
    punto('duomo', 'chiesa', 'Duomo', { storia: 'castello-ezzelini' }),
  ];

  it('senza ricerca elenca solo dati e servizi: aria, idrometro, webcam, stazione', () => {
    const r = filtraPunti(punti, '');
    expect(r.servizi.map((p) => p.id).sort()).toEqual(['aria', 'cam', 'idro', 'treno']);
    expect(r.altri).toEqual([]);
  });

  it('cercando trova anche gli altri punti senza racconto, per nome o per tipo', () => {
    expect(filtraPunti(punti, 'fermata').altri.map((p) => p.id)).toEqual(['bus2', 'bus1']);
    expect(filtraPunti(punti, 'donato').altri.map((p) => p.id)).toEqual(['chiesa']);
    // Il Duomo ha un racconto: si apre da lì, non compare due volte.
    expect(filtraPunti(punti, 'duomo').altri).toEqual([]);
    expect(filtraPunti(punti, 'aria').servizi.map((p) => p.id)).toEqual(['aria']);
  });

  it('limita gli altri punti e dice quanti sono in tutto', () => {
    const tanti = Array.from({ length: 60 }, (_, i) => punto(`f${i}`, 'fermata-bus', `Fermata ${i}`));
    const r = filtraPunti(tanti, 'fermata');
    expect(r.altri.length).toBeLessThan(60);
    expect(r.altriInTutto).toBe(60);
  });
});
