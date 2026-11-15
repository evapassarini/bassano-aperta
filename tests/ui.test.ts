import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { luceAdesso } from '../src/luce';
import type { Avviso, DatiAria, DatiAvvisi, DatiStrati, LetturaTreni, Luce, Punto, Storia, Treno } from '../src/types';
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
  formattaDataBreve,
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
  quadroAvvisi,
  riassuntoAria,
  tempoGiudizio,
  scegliAvvisi,
  sottoPunto,
  statoTreno,
  tabelloneTreni,
  testoPortata,
  tracciaSerie,
  trovaVoceAvvisi,
  urlIncorporamento,
  urlMiniatura,
  urlPaginaYouTube,
  urlSicuro,
} from '../src/ui/aiuti';
import { creaAriaBreve } from '../src/ui/ariaBreve';
import { creaSchedaAvvisi } from '../src/ui/avvisi';
import { tieniFuoco } from '../src/ui/dom';
import { creaUI } from '../src/ui/index';
import { CHIAVE_LUCE, PASSO_LUCE_MS, creaSelettoreLuce } from '../src/ui/luce';
import { creaScheda } from '../src/ui/scheda';

// Le schede leggono i dati dal modulo live: qui è finto, così nessun test tocca la rete.
const live = vi.hoisted(() => ({
  leggiTreni: vi.fn(),
  leggiAvvisi: vi.fn(),
  leggiAria: vi.fn(),
  leggiBrenta: vi.fn(),
  leggiDataStazioni: vi.fn(),
}));
vi.mock('../src/live/index', () => live);

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

  it('fa trovare la stazione anche cercando i treni, e lo scrive nella voce', () => {
    for (const parola of ['treni', 'treno', 'ritardi', 'partenze', 'arrivi', 'ferrovia', 'stazione', 'Bassano treni']) {
      expect(filtraPunti(punti, parola).servizi.map((p) => p.id), parola).toContain('treno');
    }
    // Le parole dei treni non fanno comparire gli altri punti.
    expect(filtraPunti(punti, 'treni').servizi.map((p) => p.id)).toEqual(['treno']);
    expect(filtraPunti(punti, 'treni').altri).toEqual([]);
    expect(sottoPunto(punti[3])).toBe('Stazione, prossimi treni · strato Mobilità');
    expect(sottoPunto(punti[4])).toBe(`${etichettaTipo('fermata-bus')} · strato Mobilità`);
  });

  it('limita gli altri punti e dice quanti sono in tutto', () => {
    const tanti = Array.from({ length: 60 }, (_, i) => punto(`f${i}`, 'fermata-bus', `Fermata ${i}`));
    const r = filtraPunti(tanti, 'fermata');
    expect(r.altri.length).toBeLessThan(60);
    expect(r.altriInTutto).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// Treni e avvisi: le parti pure
// ---------------------------------------------------------------------------

const ORA = new Date('2026-11-15T08:00:00Z'); // le 09:00 in Italia

function treno(parziale: Partial<Treno> & { numero: string; quando: string }): Treno {
  return { verso: 'partenza', da: 'Bassano del Grappa', a: 'Padova', ritardoMinuti: 0, soppresso: false, ...parziale };
}

describe('tabellone dei treni', () => {
  it('dice lo stato a parole, anche per chi ascolta', () => {
    expect(statoTreno({ ritardoMinuti: 0, soppresso: false })).toEqual({ stato: 'in orario', statoPerEsteso: 'in orario', tono: 'orario' });
    expect(statoTreno({ ritardoMinuti: 7, soppresso: false })).toEqual({ stato: '+7 min', statoPerEsteso: '7 minuti di ritardo', tono: 'ritardo' });
    expect(statoTreno({ ritardoMinuti: 1, soppresso: false }).statoPerEsteso).toBe('1 minuto di ritardo');
    expect(statoTreno({ ritardoMinuti: -2, soppresso: false })).toEqual({ stato: '2 min in anticipo', statoPerEsteso: '2 minuti di anticipo', tono: 'anticipo' });
    // Un treno soppresso è soppresso, qualunque ritardo dichiari.
    expect(statoTreno({ ritardoMinuti: 12, soppresso: true }).stato).toBe('soppresso');
  });

  it("scrive l'ora italiana e divide partenze e arrivi", () => {
    const lettura: LetturaTreni = {
      quando: '2026-11-15T07:59:00Z',
      treni: [
        treno({ numero: '16313', quando: '2026-11-15T08:20:00Z', a: 'Venezia S. Lucia' }),
        treno({ numero: '16320', quando: '2026-11-15T08:27:00Z', verso: 'arrivo', da: 'Venezia S. Lucia', a: 'Bassano del Grappa', ritardoMinuti: 7 }),
        treno({ numero: '5712', quando: '2026-11-15T08:45:00Z', verso: 'transito', da: 'Padova', a: 'Trento', soppresso: true }),
      ],
    };
    const t = tabelloneTreni(lettura, ORA);
    expect(t.vecchio).toBe(false);
    expect(t.partenze).toEqual([
      { ora: '09:20', previsto: '', direzione: 'per Venezia S. Lucia', treno: 'treno 16313', stato: 'in orario', statoPerEsteso: 'in orario', tono: 'orario' },
      { ora: '09:45', previsto: '', direzione: 'per Trento', treno: 'treno 5712', stato: 'soppresso', statoPerEsteso: 'soppresso', tono: 'soppresso' },
    ]);
    // `quando` (09:27) ha già dentro i 7 minuti: l'ora grande è quella dell'orario, 09:20,
    // e l'ora prevista è scritta a parte. Così "09:20 +7 min" non si può leggere come 09:34.
    expect(t.arrivi).toEqual([
      {
        ora: '09:20',
        previsto: 'previsto alle 09:27',
        direzione: 'da Venezia S. Lucia',
        treno: 'treno 16320',
        stato: '+7 min',
        statoPerEsteso: '7 minuti di ritardo, previsto alle 09:27',
        tono: 'ritardo',
      },
    ]);
  });

  it("mostra l'ora dell'orario ufficiale e, a parte, quella prevista", () => {
    const riga = (parziale: Partial<Treno> & { quando: string }) =>
      tabelloneTreni({ quando: ORA.toISOString(), treni: [treno({ numero: '1', ...parziale })] }, ORA).partenze[0];
    // Caso vero: arrivo in orario alle 10:12, previsto alle 10:09 (3 minuti di anticipo).
    expect(riga({ quando: '2026-11-15T09:09:00Z', ritardoMinuti: -3 })).toMatchObject({
      ora: '10:12',
      previsto: 'previsto alle 10:09',
      stato: '3 min in anticipo',
      statoPerEsteso: '3 minuti di anticipo, previsto alle 10:09',
    });
    // Il ritardo nel feed è in secondi: 200 secondi diventano 3 minuti, l'orario resta 09:20.
    expect(riga({ quando: '2026-11-15T08:23:20Z', ritardoMinuti: 3 }).ora).toBe('09:20');
    // In orario e soppresso: nessuna ora prevista. Il soppresso mostra comunque l'orario ufficiale.
    expect(riga({ quando: '2026-11-15T08:20:00Z' }).previsto).toBe('');
    expect(riga({ quando: '2026-11-15T08:32:00Z', ritardoMinuti: 12, soppresso: true })).toMatchObject({ ora: '09:20', previsto: '', statoPerEsteso: 'soppresso' });
    // Un treno di cui non si è letto il numero resta in elenco, e lo si dice.
    expect(riga({ numero: '', quando: '2026-11-15T08:20:00Z' }).treno).toBe('numero non indicato');
  });

  it('mostra al massimo otto treni, i più vicini, e non quelli già passati', () => {
    const treni = Array.from({ length: 12 }, (_, i) =>
      treno({ numero: String(100 + i), quando: new Date(ORA.getTime() + (i - 2) * 20 * 60_000).toISOString(), verso: i % 3 === 0 ? 'arrivo' : 'partenza' }),
    );
    const t = tabelloneTreni({ quando: ORA.toISOString(), treni }, ORA);
    const numeri = [...t.partenze, ...t.arrivi].map((r) => r.treno).sort();
    expect(numeri).toHaveLength(8);
    // I primi due sono di 40 e 20 minuti fa: fuori. Dal terzo (adesso) in poi, otto treni.
    expect(numeri).toEqual(['treno 102', 'treno 103', 'treno 104', 'treno 105', 'treno 106', 'treno 107', 'treno 108', 'treno 109']);
    // Un treno di due minuti fa resta ancora un momento in elenco.
    const appena = tabelloneTreni({ quando: ORA.toISOString(), treni: [treno({ numero: '1', quando: '2026-11-15T07:58:00Z' })] }, ORA);
    expect(appena.partenze).toHaveLength(1);
  });

  it('non scrive mai un nome che non ha e avvisa se i dati sono vecchi', () => {
    const t = tabelloneTreni(
      {
        quando: '2026-11-15T07:30:00Z',
        treni: [
          treno({ numero: '1', quando: '2026-11-15T08:10:00Z', a: null }),
          treno({ numero: '2', quando: '2026-11-15T08:20:00Z', verso: 'arrivo', da: null }),
        ],
      },
      ORA,
    );
    expect(t.partenze[0].direzione).toBe('destinazione non indicata');
    expect(t.arrivi[0].direzione).toBe('provenienza non indicata');
    expect(t.vecchio).toBe(true);
  });
});

const avviso = (tipo: Avviso['tipo'], strada: string, quando: string): Avviso => ({
  tipo,
  strada,
  testo: `Testo finto per ${strada}`,
  quando,
  fonte: tipo === 'evento' ? 'CCISS Viaggiare Informati' : 'Vi.abilità (Provincia di Vicenza)',
  url: tipo === 'evento' ? 'https://www.cciss.it/' : 'https://vi-abilita.it/finta/',
});

describe('scelta degli avvisi', () => {
  const avvisi: Avviso[] = [
    avviso('ordinanza', 'S.P. 52 Bassanese', '2026-10-01T09:00:00Z'),
    avviso('evento', 'SS47 della Valsugana', '2026-11-15T06:00:00Z'),
    avviso('evento', 'SS248 Schiavonesca', '2026-11-14T07:59:59Z'),
    avviso('evento', 'SS47 della Valsugana, ieri', '2026-11-14T08:00:00Z'),
    avviso('ordinanza', 'S.P. 248 Marosticana', '2026-11-10T09:00:00Z'),
  ];

  it('tiene solo gli eventi delle ultime 24 ore, i più recenti prima', () => {
    const { eventi } = scegliAvvisi(avvisi, ORA);
    expect(eventi.map((a) => a.strada)).toEqual(['SS47 della Valsugana', 'SS47 della Valsugana, ieri']);
  });

  it('tiene tutte le ordinanze, anche vecchie, le più recenti prima', () => {
    const { ordinanze } = scegliAvvisi(avvisi, ORA);
    expect(ordinanze.map((a) => a.strada)).toEqual(['S.P. 248 Marosticana', 'S.P. 52 Bassanese']);
  });

  it('scarta gli eventi senza una data leggibile e le voci rotte', () => {
    const rotti = [avviso('evento', 'Senza data', 'ieri'), null, { tipo: 'evento' }] as unknown as Avviso[];
    expect(scegliAvvisi(rotti, ORA)).toEqual({ eventi: [], ordinanze: [] });
    expect(scegliAvvisi([], ORA)).toEqual({ eventi: [], ordinanze: [] });
  });

  it("fa trovare la voce dell'elenco con le parole giuste", () => {
    expect(trovaVoceAvvisi('')).toBe(true);
    expect(trovaVoceAvvisi('avvisi')).toBe(true);
    expect(trovaVoceAvvisi('Viabilità')).toBe(true);
    expect(trovaVoceAvvisi('strade lavori')).toBe(true);
    expect(trovaVoceAvvisi('traffico')).toBe(true);
    for (const parola of ['ordinanza', 'ordinanze', 'code', 'incidenti', 'chiusure', 'cantieri']) {
      expect(trovaVoceAvvisi(parola), parola).toBe(true);
    }
    expect(trovaVoceAvvisi('ponte')).toBe(false);
    expect(trovaVoceAvvisi('treni')).toBe(false);
  });
});

describe('quadro degli avvisi', () => {
  const FONTI = [
    { nome: 'CCISS Viaggiare Informati', url: 'https://www.cciss.it/', licenza: 'x' },
    { nome: 'Vi.abilità (Provincia di Vicenza)', url: 'https://vi-abilita.it/', licenza: 'x' },
  ];
  const avvisi: Avviso[] = [
    avviso('evento', 'SS47 della Valsugana', '2026-11-15T06:00:00Z'),
    avviso('ordinanza', 'S.P. 248 Marosticana', '2026-11-10T09:00:00Z'),
    avviso('ordinanza', 'S.P. 52 Bassanese', '2026-08-01T09:00:00Z'),
  ];

  it('con una fotografia di oggi e tutte e due le fonti non segnala nulla', () => {
    const q = quadroAvvisi({ generato: '2026-11-15T07:30:00Z', fonti: FONTI, avvisi }, ORA);
    expect(q.vecchia).toBe(false);
    expect(q.mancanti).toEqual([]);
    expect(q.eventi).toHaveLength(1);
    expect(q.ordinanze).toHaveLength(2);
    expect(q.riassunto).toBe('3 avvisi nella fotografia del 15 novembre 2026, ore 08:30.');
  });

  it('dice che la fotografia è vecchia, e non mostra ordinanze pubblicate da più di 120 giorni', () => {
    // Due mesi dopo: l'evento è scaduto, l'ordinanza di agosto ha più di 120 giorni.
    const q = quadroAvvisi({ generato: '2026-11-15T07:30:00Z', fonti: FONTI, avvisi }, new Date('2027-01-15T08:00:00Z'));
    expect(q.vecchia).toBe(true);
    expect(q.eventi).toEqual([]);
    expect(q.ordinanze.map((a) => a.strada)).toEqual(['S.P. 248 Marosticana']);
    expect(q.riassunto).toBe('1 avviso nella fotografia del 15 novembre 2026, ore 08:30.');
    // 24 ore esatte non sono ancora "vecchia"; una data illeggibile sì.
    expect(quadroAvvisi({ generato: '2026-11-14T08:00:00Z', fonti: FONTI, avvisi: [] }, ORA).vecchia).toBe(false);
    expect(quadroAvvisi({ generato: 'boh', fonti: FONTI, avvisi: [] }, ORA).vecchia).toBe(true);
  });

  it('senza avvisi parla della fotografia, non di "questo momento"', () => {
    const q = quadroAvvisi({ generato: '2026-11-12T07:30:00Z', fonti: FONTI, avvisi: [avvisi[0]] }, new Date('2026-11-17T08:00:00Z'));
    expect(q.vuoto).toBe('Nella fotografia del 12 novembre 2026, ore 08:30 non ci sono avvisi per la zona di Bassano.');
    expect(q.riassunto).toBe(q.vuoto);
    expect(q.vuoto).not.toMatch(/in questo momento/);
  });

  it('dice quale fonte manca nella fotografia', () => {
    const soloViabilita = quadroAvvisi({ generato: '2026-11-15T07:30:00Z', fonti: [FONTI[1]], avvisi }, ORA);
    expect(soloViabilita.mancanti.map((f) => f.breve)).toEqual(['CCISS']);
    const soloCciss = quadroAvvisi({ generato: '2026-11-15T07:30:00Z', fonti: [FONTI[0]], avvisi }, ORA);
    expect(soloCciss.mancanti.map((f) => f.cosa)).toEqual(['le ordinanze sulle strade provinciali']);
  });
});

// ---------------------------------------------------------------------------
// Schede: stazione e avvisi. Il progetto non ha un DOM per i test: qui ce n'è uno
// finto, piccolo, con il poco che serve a `el`, `svg` e alle schede.
// ---------------------------------------------------------------------------

class Finto {
  figli: (Finto | string)[] = [];
  attributi = new Map<string, string>();
  ascolti = new Map<string, ((evento?: unknown) => void)[]>();
  /** Quanto basta di classList, dataset e proprietà per montare tutta l'interfaccia. */
  dataset: Record<string, string> = {};
  value = '';
  scrollTop = 0;
  open = false;
  classList = {
    add: (...classi: string[]): void => {
      const tutte = new Set([...(this.getAttribute('class') ?? '').split(' ').filter(Boolean), ...classi]);
      this.setAttribute('class', [...tutte].join(' '));
    },
    remove: (...classi: string[]): void => {
      this.setAttribute('class', (this.getAttribute('class') ?? '').split(' ').filter((c) => c && !classi.includes(c)).join(' '));
    },
  };
  constructor(readonly tag: string) {}
  get hidden(): boolean {
    return this.attributi.has('hidden');
  }
  set hidden(nascosto: boolean) {
    if (nascosto) this.attributi.set('hidden', '');
    else this.attributi.delete('hidden');
  }
  /** Gli eventi lanciati sul nodo, in ordine: qui non risalgono e non scendono. */
  lanciati: { type: string; detail?: unknown }[] = [];
  dispatchEvent(evento: { type: string; detail?: unknown }): boolean {
    this.lanciati.push(evento);
    this.emetti(evento.type, evento);
    return true;
  }
  querySelectorAll(tag: string): Finto[] {
    return this.conTag(tag);
  }
  setAttribute(nome: string, valore: string): void {
    this.attributi.set(nome, String(valore));
  }
  getAttribute(nome: string): string | null {
    return this.attributi.get(nome) ?? null;
  }
  removeAttribute(nome: string): void {
    this.attributi.delete(nome);
  }
  get id(): string {
    return this.attributi.get('id') ?? '';
  }
  append(...nodi: (Finto | string)[]): void {
    this.figli.push(...nodi);
  }
  replaceChildren(...nodi: (Finto | string)[]): void {
    this.figli = [...nodi];
  }
  get childElementCount(): number {
    return this.figli.filter((f) => typeof f !== 'string').length;
  }
  addEventListener(tipo: string, ascolto: (evento?: unknown) => void): void {
    this.ascolti.set(tipo, [...(this.ascolti.get(tipo) ?? []), ascolto]);
  }
  emetti(tipo: string, evento?: unknown): void {
    for (const a of this.ascolti.get(tipo) ?? []) a(evento);
  }
  click(): void {
    this.emetti('click');
  }
  /** Un tasto premuto sul nodo. Restituisce l'evento, per vedere se è stato fermato. */
  premi(key: string): { key: string; fermato: boolean } {
    const evento = { key, fermato: false, preventDefault: () => void (evento.fermato = true) };
    this.emetti('keydown', evento);
    return evento;
  }
  /** Come nel browser: il fuoco va al nodo e `document.activeElement` lo segue. */
  focus(): void {
    fuoco.attivo = this;
  }
  contains(altro: Finto | null): boolean {
    return altro === this || (altro !== null && this.trova((n) => n === altro).length > 0);
  }
  get textContent(): string {
    return this.figli.map((f) => (typeof f === 'string' ? f : f.textContent)).join('');
  }
  set textContent(testo: string) {
    this.figli = testo === '' ? [] : [testo];
  }
  /** Tutti i discendenti che passano la prova, in ordine di documento. */
  trova(prova: (n: Finto) => boolean): Finto[] {
    const trovati: Finto[] = [];
    for (const f of this.figli) {
      if (typeof f === 'string') continue;
      if (prova(f)) trovati.push(f);
      trovati.push(...f.trova(prova));
    }
    return trovati;
  }
  conClasse(classe: string): Finto[] {
    return this.trova((n) => (n.getAttribute('class') ?? '').split(' ').includes(classe));
  }
  conTag(tag: string): Finto[] {
    return this.trova((n) => n.tag === tag);
  }
}

/** Il nodo che ha il fuoco nel DOM finto. Togliere dal DOM il nodo attivo lo riporta al "body" (null). */
const fuoco: { attivo: Finto | null } = { attivo: null };

const comeFinto = (nodo: unknown): Finto => nodo as Finto;
/** Lascia finire le promesse in sospeso. */
const respira = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('schede con dati in diretta', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(ORA);
    fuoco.attivo = null;
    vi.stubGlobal('document', {
      createElement: (tag: string) => new Finto(tag),
      createElementNS: (_spazio: string, tag: string) => new Finto(tag),
      get activeElement() {
        return fuoco.attivo;
      },
    });
    for (const finta of Object.values(live)) finta.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const STAZIONE: Punto = {
    id: 'treno',
    strato: 'mobilita',
    tipo: 'stazione',
    nome: 'Bassano del Grappa',
    x: 0,
    y: 0,
    nota: 'Stazione ferroviaria',
  };
  const LETTURA: LetturaTreni = {
    quando: '2026-11-15T07:59:00Z',
    treni: [
      treno({ numero: '16313', quando: '2026-11-15T08:20:00Z', a: 'Venezia S. Lucia' }),
      treno({ numero: '16320', quando: '2026-11-15T08:27:00Z', verso: 'arrivo', da: 'Padova', a: 'Bassano del Grappa', ritardoMinuti: 7 }),
      treno({ numero: '5712', quando: '2026-11-15T08:45:00Z', verso: 'transito', a: 'Trento', soppresso: true }),
    ],
  };

  describe('scheda della stazione', () => {
    it('mentre legge lo dice, e sotto spiega sempre da dove vengono i ritardi', () => {
      live.leggiTreni.mockReturnValue(new Promise(() => {}));
      const scheda = comeFinto(creaScheda(STAZIONE).nodo);
      const [stato] = scheda.conClasse('adesso-stato');
      // L'elenco non è una zona viva: a chi ascolta arriva solo la riga breve dell'annuncio.
      expect(stato.getAttribute('aria-live')).toBeNull();
      expect(stato.getAttribute('aria-busy')).toBe('true');
      expect(stato.textContent).toContain('Leggo i prossimi treni');
      const [annuncio] = comeFinto(scheda.conClasse('adesso-treni')[0]).trova((n) => n.getAttribute('role') === 'status');
      expect(annuncio.textContent).toBe('Leggo i prossimi treni…');
      expect(scheda.conClasse('treno')).toHaveLength(0);
      expect(scheda.textContent).toContain(
        "Ritardi dichiarati dall'operatore, rielaborati da BusOne. Non è un servizio ufficiale: per partire controlla i canali di Trenitalia.",
      );
      // Che ora è quella scritta, e che l'elenco può non essere completo.
      expect(scheda.textContent).toContain("L'ora a sinistra è quella dell'orario ufficiale.");
      expect(scheda.textContent).toContain("L'elenco può non essere completo: un treno soppresso, o senza dati in diretta, può non comparire.");
      const link = scheda.conTag('a').map((a) => a.getAttribute('href'));
      expect(link).toContain('https://busone.app/');
    });

    it('mostra partenze e arrivi con ora, direzione, numero e stato', async () => {
      live.leggiTreni.mockResolvedValue(LETTURA);
      const scheda = comeFinto(creaScheda(STAZIONE).nodo);
      await respira();
      const [stato] = scheda.conClasse('adesso-stato');
      expect(stato.getAttribute('aria-busy')).toBeNull();
      expect(scheda.conClasse('treni-titolo').map((t) => t.textContent)).toEqual(['Partenze', 'Arrivi']);
      const righe = scheda.conClasse('treno').map((r) =>
        ['treno-ora', 'treno-direzione', 'treno-numero', 'treno-stato'].map((classe) => r.conClasse(classe)[0].textContent),
      );
      expect(righe[0]).toEqual(['09:20', 'per Venezia S. Lucia', 'treno 16313', 'in orario']);
      expect(righe[1]).toEqual(['09:45', 'per Trento', 'treno 5712', 'soppresso']);
      // Letta di fila, una riga resta comprensibile.
      expect(scheda.conClasse('treno')[0].textContent).toContain('per Venezia S. Lucia treno 16313');
      // Il ritardo è scritto, e detto per intero a chi ascolta: non è affidato al colore.
      const ritardo = scheda.conClasse('treno-ritardo')[0];
      expect(ritardo.textContent).toContain('+7 min');
      // L'ora grande è quella dell'orario (09:20), quella prevista è scritta a parte.
      expect(scheda.conClasse('treno')[2].conClasse('treno-ora')[0].textContent).toBe('09:20');
      expect(ritardo.conClasse('treno-previsto')[0].textContent).toBe('previsto alle 09:27');
      expect(ritardo.conClasse('solo-lettori')[0].textContent).toBe('7 minuti di ritardo, previsto alle 09:27');
      // A chi ascolta si annuncia una frase, non tutte le righe.
      const [annuncio] = scheda.trova((n) => n.getAttribute('role') === 'status');
      expect(annuncio.textContent).toBe('3 treni nelle prossime ore.');
      expect(scheda.textContent).toContain('da Padova');
      expect(scheda.textContent).toContain('Dati emessi da BusOne alle 08:59.');
      expect(scheda.textContent).not.toContain('non sono recenti');
    });

    it('se non ci sono treni lo dice, senza righe vuote', async () => {
      live.leggiTreni.mockResolvedValue({ quando: '2026-11-15T07:59:00Z', treni: [] });
      const scheda = comeFinto(creaScheda(STAZIONE).nodo);
      await respira();
      expect(scheda.conClasse('treno')).toHaveLength(0);
      expect(scheda.textContent).toContain('non ci sono treni a Bassano nelle prossime ore');
    });

    it('se la rete fallisce lo dice, non mostra numeri e offre «Riprova»', async () => {
      live.leggiTreni.mockRejectedValueOnce(new Error('rete assente')).mockResolvedValueOnce(LETTURA);
      const scheda = comeFinto(creaScheda(STAZIONE).nodo);
      await respira();
      const [stato] = scheda.conClasse('adesso-stato');
      expect(stato.textContent).toContain('non riusciamo a leggere i treni');
      expect(stato.textContent).not.toMatch(/\d/);
      expect(scheda.conClasse('treno')).toHaveLength(0);
      const [riprova] = stato.conTag('button');
      expect(riprova.textContent).toBe('Riprova');

      expect(scheda.trova((n) => n.getAttribute('role') === 'status')[0].textContent).toBe('In questo momento non riusciamo a leggere i treni.');

      // Chi preme «Riprova» da tastiera ha il fuoco sul bottone, che sta per sparire: il
      // fuoco resta nel riquadro invece di cadere sul body.
      riprova.focus();
      riprova.click();
      expect(fuoco.attivo).toBe(stato);
      expect(stato.getAttribute('tabindex')).toBe('-1');
      expect(stato.textContent).toContain('Leggo i prossimi treni');
      await respira();
      expect(live.leggiTreni).toHaveBeenCalledTimes(2);
      expect(scheda.conClasse('treno')).toHaveLength(3);
    });

    it('il fuoco non si sposta se non era dentro il riquadro', () => {
      const dentro = new Finto('div');
      const bottone = new Finto('button');
      const fuori = new Finto('button');
      dentro.append(bottone);
      fuoco.attivo = fuori;
      tieniFuoco(dentro as unknown as HTMLElement);
      expect(fuoco.attivo).toBe(fuori);
      fuoco.attivo = bottone;
      tieniFuoco(dentro as unknown as HTMLElement);
      expect(fuoco.attivo).toBe(dentro);
    });

    it('gli altri punti non hanno il riquadro dei treni', () => {
      const scheda = comeFinto(creaScheda({ ...STAZIONE, id: 'bus', tipo: 'fermata-bus', nome: 'Viale delle Fosse' }).nodo);
      expect(scheda.conClasse('adesso-treni')).toHaveLength(0);
      expect(live.leggiTreni).not.toHaveBeenCalled();
    });
  });

  describe('scheda degli avvisi', () => {
    const DATI: DatiAvvisi = {
      generato: '2026-11-15T07:30:00Z',
      fonti: [
        { nome: 'CCISS Viaggiare Informati', url: 'https://www.cciss.it/', licenza: 'Non dichiarata: citazione breve con link alla fonte' },
        { nome: 'Vi.abilità (Provincia di Vicenza)', url: 'https://vi-abilita.it/', licenza: 'Non dichiarata: citazione breve con link alla fonte' },
      ],
      avvisi: [
        avviso('ordinanza', 'S.P. 52 Bassanese', '2026-10-20T09:00:00Z'),
        avviso('evento', 'SS47 della Valsugana', '2026-11-15T06:00:00Z'),
        avviso('evento', 'SS248 Schiavonesca', '2026-11-13T06:00:00Z'),
      ],
    };

    it('mostra prima gli eventi delle ultime 24 ore, poi le ordinanze, con il link alla fonte', async () => {
      live.leggiAvvisi.mockResolvedValue(DATI);
      const scheda = comeFinto(creaSchedaAvvisi().nodo);
      expect(scheda.textContent).toContain('Sono avvisi pubblicati dagli enti, non il traffico in tempo reale.');
      await respira();
      expect(scheda.textContent).toContain('Fotografia del 15 novembre 2026, ore 08:30.');
      expect(scheda.conClasse('avviso-strada').map((s) => s.textContent)).toEqual(['SS47 della Valsugana', 'S.P. 52 Bassanese']);
      // L'evento di due giorni fa non si mostra.
      expect(scheda.textContent).not.toContain('SS248');
      const [primo] = scheda.conClasse('avviso');
      expect(primo.textContent).toContain('Testo finto per SS47 della Valsugana');
      expect(primo.textContent).toContain('CCISS Viaggiare Informati');
      expect(primo.textContent).toContain('ore 07:00');
      // Fotografia di mezz'ora fa, con tutte e due le fonti: nessun avvertimento.
      expect(scheda.conClasse('lettura-avviso')).toHaveLength(0);
      // La lista non è una zona viva; a chi ascolta arriva una frase breve.
      const [stato] = scheda.conClasse('avvisi-stato');
      expect(stato.getAttribute('aria-live')).toBeNull();
      expect(scheda.trova((n) => n.getAttribute('role') === 'status')[0].textContent).toBe(
        '2 avvisi nella fotografia del 15 novembre 2026, ore 08:30.',
      );
      // I link hanno lo stesso testo a vista, ma a chi ascolta dicono la strada.
      expect(scheda.conClasse('avviso').map((v) => v.conTag('a')[0].textContent)).toEqual([
        'Leggi alla fonte: SS47 della Valsugana (si apre in una nuova scheda)',
        'Leggi alla fonte: S.P. 52 Bassanese (si apre in una nuova scheda)',
      ]);
      for (const voce of scheda.conClasse('avviso')) {
        const [link] = voce.conTag('a');
        expect(link.textContent).toContain('Leggi alla fonte');
        expect(link.conClasse('solo-lettori')[0].textContent).toMatch(/^: /);
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
      }
      expect(scheda.conClasse('avviso')[1].conTag('a')[0].getAttribute('href')).toBe('https://vi-abilita.it/finta/');
    });

    it('senza avvisi validi lo dice, e la data della fotografia resta', async () => {
      live.leggiAvvisi.mockResolvedValue({ ...DATI, avvisi: [avviso('evento', 'SS248 Schiavonesca', '2026-11-13T06:00:00Z')] });
      const scheda = comeFinto(creaSchedaAvvisi().nodo);
      await respira();
      expect(scheda.conClasse('avviso')).toHaveLength(0);
      expect(scheda.conClasse('avvisi-vuoto')[0].textContent).toBe(
        'Nella fotografia del 15 novembre 2026, ore 08:30 non ci sono avvisi per la zona di Bassano.',
      );
      expect(scheda.textContent).not.toContain('in questo momento');
      expect(scheda.textContent).toContain('Fotografia del 15 novembre 2026, ore 08:30.');
    });

    it('se la fotografia ha più di un giorno lo dice e rimanda ai siti delle fonti', async () => {
      // Tre giorni dopo la fotografia.
      vi.setSystemTime(new Date('2026-11-18T08:00:00Z'));
      live.leggiAvvisi.mockResolvedValue(DATI);
      const scheda = comeFinto(creaSchedaAvvisi().nodo);
      await respira();
      const [avvertimento] = scheda.conClasse('lettura-avviso');
      expect(avvertimento.textContent).toContain('Attenzione: questa fotografia non è recente. Per la situazione di adesso guarda i siti delle fonti.');
      expect(avvertimento.conTag('a').map((a) => a.getAttribute('href'))).toEqual(['https://www.cciss.it/', 'https://vi-abilita.it/']);
      // Gli eventi sono tutti scaduti: resta l'ordinanza, e nessuna frase sul presente.
      expect(scheda.conClasse('avviso-strada').map((s) => s.textContent)).toEqual(['S.P. 52 Bassanese']);
      expect(scheda.textContent).toContain('negli ultimi 120 giorni, fino al giorno della fotografia');
      expect(scheda.trova((n) => n.getAttribute('role') === 'status')[0].textContent).toContain('questa fotografia non è recente');
    });

    it('se nella fotografia manca una fonte lo dice, con il link al suo sito', async () => {
      live.leggiAvvisi.mockResolvedValue({ ...DATI, fonti: [DATI.fonti[1]], avvisi: [DATI.avvisi[0]] });
      const scheda = comeFinto(creaSchedaAvvisi().nodo);
      await respira();
      const [avvertimento] = scheda.conClasse('lettura-avviso');
      expect(avvertimento.textContent).toContain('In questa fotografia mancano gli eventi di traffico: non siamo riusciti a leggere CCISS.');
      expect(avvertimento.conTag('a')[0].getAttribute('href')).toBe('https://www.cciss.it/');
      expect(scheda.conClasse('avviso')).toHaveLength(1);
    });

    it('se il file manca lo dice e offre «Riprova»', async () => {
      live.leggiAvvisi.mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce(DATI);
      const scheda = comeFinto(creaSchedaAvvisi().nodo);
      await respira();
      expect(scheda.textContent).toContain('La fotografia degli avvisi non è disponibile');
      expect(scheda.conClasse('avviso')).toHaveLength(0);
      const [stato] = scheda.conClasse('avvisi-stato');
      const [riprova] = scheda.conTag('button');
      riprova.focus();
      riprova.click();
      // Il fuoco non cade sul body quando il bottone sparisce.
      expect(fuoco.attivo).toBe(stato);
      await respira();
      expect(scheda.conClasse('avviso')).toHaveLength(2);
    });
  });
});

// ---------------------------------------------------------------------------
// Luce della mappa e aria in breve: il gruppo in basso a sinistra
// ---------------------------------------------------------------------------

describe('luce della mappa e aria in breve', () => {
  // A Bassano, il 15 novembre: mattina piena, sole basso che scende, notte.
  const MATTINA = new Date('2026-11-15T09:30:00Z');
  const POMERIGGIO = new Date('2026-11-15T14:00:00Z');
  const SERA = new Date('2026-11-15T22:00:00Z');

  const ARIA: DatiAria = {
    generato: '2026-11-14T22:54:54.138Z',
    stazione: 'Bassano (ARPAV, codice 500000106)',
    fonte: { nome: 'ARPAV', url: 'https://www2.arpa.veneto.it/aria-json/exported/aria/data.json', licenza: 'CC BY 4.0' },
    misure: [
      { inquinante: 'Ozono (media oraria)', valore: 36.4, unita: 'µg/m³', quando: '2026-11-14T22:00:00' },
      { inquinante: 'PM10 (media giornaliera)', valore: 13.7, unita: 'µg/m³', quando: '2026-11-13' },
    ],
  };
  const CENTRALINA: Punto = {
    id: 'arpav-aria-bassano',
    strato: 'ambiente',
    tipo: 'aria',
    nome: 'Stazione ARPAV «Bassano»',
    x: 106.4,
    y: -781.6,
    nota: "Centralina ARPAV per la qualità dell'aria.",
  };
  const STRATI: DatiStrati = { generato: '2026-11-14T10:00:00Z', fonti: [], punti: [CENTRALINA], linee: [] };

  let memoria: Map<string, string>;
  let ora: Date;
  const adesso = (): Date => ora;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MATTINA);
    ora = MATTINA;
    fuoco.attivo = null;
    memoria = new Map();
    vi.stubGlobal('document', {
      createElement: (tag: string) => new Finto(tag),
      createElementNS: (_spazio: string, tag: string) => new Finto(tag),
      addEventListener: () => {},
      removeEventListener: () => {},
      visibilityState: 'visible',
      get activeElement() {
        return fuoco.attivo;
      },
    });
    vi.stubGlobal('HTMLElement', Finto);
    vi.stubGlobal('localStorage', {
      getItem: (chiave: string) => memoria.get(chiave) ?? null,
      setItem: (chiave: string, valore: string) => void memoria.set(chiave, valore),
    });
    for (const finta of Object.values(live)) finta.mockReset();
    live.leggiAria.mockResolvedValue(ARIA);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** Monta tutta l'interfaccia su una radice finta. */
  const monta = (strati: DatiStrati = STRATI) => {
    const radice = new Finto('div');
    const alCambioLuce = vi.fn<(luce: Luce) => void>();
    const ui = creaUI({
      radice: radice as unknown as HTMLElement,
      storie: [],
      strati,
      alCambioStrato: () => {},
      alVaiA: () => {},
      allaChiusura: () => {},
      alCambioLuce,
      adesso,
    });
    const [gruppo] = radice.trova((n) => n.getAttribute('role') === 'radiogroup');
    const scelta = (nome: string): Finto => gruppo.trova((n) => n.getAttribute('data-luce') === nome)[0];
    const scelte = (): string[] =>
      gruppo.trova((n) => n.getAttribute('role') === 'radio' && n.getAttribute('aria-checked') === 'true').map((n) => n.getAttribute('data-luce') ?? '');
    return { radice, ui, alCambioLuce, gruppo, scelta, scelte };
  };

  it('le ore di prova danno le tre luci', () => {
    expect([MATTINA, POMERIGGIO, SERA].map(luceAdesso)).toEqual(['giorno', 'pomeriggio', 'notte']);
  });

  describe('selettore della luce', () => {
    it("all'avvio vale «Adesso» e la mappa riceve una volta la luce di quell'ora", () => {
      ora = SERA;
      const { radice, alCambioLuce, gruppo, scelta, scelte } = monta();
      expect(alCambioLuce).toHaveBeenCalledTimes(1);
      expect(alCambioLuce).toHaveBeenCalledWith(luceAdesso(SERA));
      expect(alCambioLuce).toHaveBeenCalledWith('notte');
      expect(radice.dataset.luce).toBe('notte');
      // Quattro scelte esclusive, con il nome per chi ascolta.
      expect(gruppo.getAttribute('aria-label')).toBe('Luce della mappa');
      expect(gruppo.trova((n) => n.getAttribute('role') === 'radio').map((n) => n.conClasse('luce-nome')[0].textContent)).toEqual([
        'Adesso',
        'Giorno',
        'Pomeriggio',
        'Notte',
      ]);
      expect(scelte()).toEqual(['adesso']);
      // Accanto ad «Adesso» c'è la luce in corso.
      expect(scelta('adesso').textContent).toBe('Adesso · notte');
      expect(scelta('notte').textContent).toBe('Notte');
      // Un solo bottone nel giro di Tab.
      expect(gruppo.trova((n) => n.getAttribute('tabindex') === '0').map((n) => n.getAttribute('data-luce'))).toEqual(['adesso']);
    });

    it('scegliendo «Notte» la mappa diventa notturna e la scelta si ricorda', () => {
      const { radice, alCambioLuce, scelta, scelte } = monta();
      expect(alCambioLuce).toHaveBeenLastCalledWith('giorno');
      scelta('notte').click();
      expect(alCambioLuce).toHaveBeenCalledTimes(2);
      expect(alCambioLuce).toHaveBeenLastCalledWith('notte');
      expect(scelte()).toEqual(['notte']);
      expect(radice.dataset.luce).toBe('notte');
      expect(memoria.get(CHIAVE_LUCE)).toBe('notte');
      // Con una luce fissa «Adesso» non dice più nulla accanto.
      expect(scelta('adesso').textContent).toBe('Adesso');
      // Il tempo passa, ma la luce scelta a mano non si muove.
      ora = POMERIGGIO;
      vi.advanceTimersByTime(PASSO_LUCE_MS * 3);
      expect(alCambioLuce).toHaveBeenCalledTimes(2);
    });

    it("tornando ad «Adesso» la mappa riprende la luce dell'ora vera", () => {
      const { alCambioLuce, scelta, scelte } = monta();
      scelta('notte').click();
      ora = POMERIGGIO;
      scelta('adesso').click();
      expect(alCambioLuce).toHaveBeenLastCalledWith('pomeriggio');
      expect(alCambioLuce).toHaveBeenCalledTimes(3);
      expect(scelte()).toEqual(['adesso']);
      expect(scelta('adesso').textContent).toBe('Adesso · pomeriggio');
      expect(memoria.get(CHIAVE_LUCE)).toBe('adesso');
    });

    it('con «Adesso» ricontrolla ogni minuto e avvisa solo quando la luce cambia', () => {
      ora = POMERIGGIO;
      const { alCambioLuce, scelta } = monta();
      expect(alCambioLuce).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(PASSO_LUCE_MS * 5);
      expect(alCambioLuce).toHaveBeenCalledTimes(1);
      ora = SERA;
      vi.advanceTimersByTime(PASSO_LUCE_MS - 1000);
      expect(alCambioLuce).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1000);
      expect(alCambioLuce).toHaveBeenCalledTimes(2);
      expect(alCambioLuce).toHaveBeenLastCalledWith('notte');
      expect(scelta('adesso').textContent).toBe('Adesso · notte');
    });

    it('non avvisa se la scelta nuova dà la stessa luce di prima', () => {
      ora = SERA;
      const { alCambioLuce, scelta, scelte } = monta();
      scelta('notte').click();
      expect(scelte()).toEqual(['notte']);
      expect(alCambioLuce).toHaveBeenCalledTimes(1);
    });

    it('riparte dalla scelta ricordata, e ignora un valore che non conosce', () => {
      memoria.set(CHIAVE_LUCE, 'pomeriggio');
      const prima = monta();
      expect(prima.scelte()).toEqual(['pomeriggio']);
      expect(prima.alCambioLuce).toHaveBeenCalledWith('pomeriggio');
      memoria.set(CHIAVE_LUCE, 'alba');
      const dopo = monta();
      expect(dopo.scelte()).toEqual(['adesso']);
      expect(dopo.alCambioLuce).toHaveBeenCalledWith('giorno');
    });

    it('funziona anche se il browser non lascia usare la memoria', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('vietato');
        },
        setItem: () => {
          throw new Error('vietato');
        },
      });
      const alCambio = vi.fn();
      const selettore = creaSelettoreLuce({ alCambio, adesso });
      expect(selettore.scelta()).toBe('adesso');
      comeFinto(selettore.nodo).trova((n) => n.getAttribute('data-luce') === 'notte')[0].click();
      expect(selettore.scelta()).toBe('notte');
      expect(selettore.luce()).toBe('notte');
      expect(alCambio).toHaveBeenLastCalledWith('notte');
    });

    it('da tastiera le frecce cambiano scelta e portano con sé il fuoco', () => {
      const { alCambioLuce, gruppo, scelta, scelte } = monta();
      const destra = gruppo.premi('ArrowRight');
      expect(destra.fermato).toBe(true);
      expect(scelte()).toEqual(['giorno']);
      expect(fuoco.attivo).toBe(scelta('giorno'));
      gruppo.premi('ArrowLeft');
      gruppo.premi('ArrowLeft');
      expect(scelte()).toEqual(['notte']);
      expect(fuoco.attivo).toBe(scelta('notte'));
      expect(alCambioLuce).toHaveBeenLastCalledWith('notte');
      gruppo.premi('Home');
      expect(scelte()).toEqual(['adesso']);
      // Gli altri tasti restano alla pagina.
      expect(gruppo.premi('a').fermato).toBe(false);
      expect(scelte()).toEqual(['adesso']);
    });

    it('dopo distruggi() l’interfaccia non chiama più la mappa e toglie l’ascolto dei tasti', () => {
      ora = POMERIGGIO;
      const tolti: string[] = [];
      const messi: string[] = [];
      const doc = document as unknown as Record<string, unknown>;
      doc.addEventListener = (tipo: string) => void messi.push(tipo);
      doc.removeEventListener = (tipo: string) => void tolti.push(tipo);
      const { ui, alCambioLuce } = monta();
      expect(alCambioLuce).toHaveBeenCalledTimes(1);
      ui.distruggi();
      ora = SERA;
      vi.advanceTimersByTime(PASSO_LUCE_MS * 3);
      expect(alCambioLuce).toHaveBeenCalledTimes(1);
      expect(messi.sort()).toEqual(['keydown', 'visibilitychange']);
      expect(tolti.sort()).toEqual(['keydown', 'visibilitychange']);
    });

    it('fermato, non ricontrolla più', () => {
      ora = POMERIGGIO;
      const alCambio = vi.fn();
      const selettore = creaSelettoreLuce({ alCambio, adesso });
      selettore.distruggi();
      ora = SERA;
      vi.advanceTimersByTime(PASSO_LUCE_MS * 2);
      expect(alCambio).toHaveBeenCalledTimes(1);
    });
  });

  describe('riquadro «Aria»', () => {
    it('sceglie il PM10, altrimenti la prima misura, e non dà giudizi', () => {
      expect(formattaDataBreve('2026-11-13')).toBe('13 nov');
      expect(riassuntoAria(ARIA, MATTINA)).toEqual({ nome: 'PM10', valore: '13,7', unita: 'µg/m³', quando: '13 nov', fotoVecchia: null });
      expect(riassuntoAria({ ...ARIA, misure: [ARIA.misure[0]] }, MATTINA)).toEqual({
        nome: 'Ozono',
        valore: '36,4',
        unita: 'µg/m³',
        quando: '14 nov, ore 22:00',
        fotoVecchia: null,
      });
      expect(riassuntoAria({ ...ARIA, misure: [] }, MATTINA)).toBeNull();
      // Una misura senza numero non diventa un numero.
      const rotta = { inquinante: 'PM10', valore: Number.NaN, unita: 'µg/m³', quando: '2026-11-13' };
      expect(riassuntoAria({ ...ARIA, misure: [rotta] }, MATTINA)).toBeNull();
      // Tre giorni esatti non bastano; poco dopo sì.
      expect(riassuntoAria(ARIA, new Date('2026-11-17T22:00:00Z'))?.fotoVecchia).toBeNull();
      expect(riassuntoAria(ARIA, new Date('2026-11-18T08:00:00Z'))?.fotoVecchia).toBe('foto del 14 nov');
    });

    it('una fotografia di un altro anno porta l’anno, per la misura e per la foto', () => {
      expect(formattaDataBreve('2026-11-13', MATTINA)).toBe('13 nov');
      expect(formattaDataBreve('2025-11-13', MATTINA)).toBe('13 nov 2025');
      const r = riassuntoAria(ARIA, new Date('2027-11-20T08:00:00Z'));
      expect(r?.quando).toBe('13 nov 2026');
      expect(r?.fotoVecchia).toBe('foto del 14 nov 2026');
    });

    it('una misura senza data prende la data della fotografia, anche se è fresca', () => {
      const senzaData = { inquinante: 'PM10', valore: 13.7, unita: 'µg/m³', quando: '' };
      const r = riassuntoAria({ ...ARIA, misure: [senzaData] }, MATTINA);
      expect(r?.quando).toBe('');
      expect(r?.fotoVecchia).toBe('foto del 14 nov');
    });

    it('dichiara «dati non validati» a chi ascolta e al passaggio del mouse', async () => {
      const { radice } = monta();
      await respira();
      const [riquadro] = radice.conClasse('aria-breve');
      expect(riquadro.conClasse('solo-lettori')[0].textContent).toContain('Fonte: ARPAV, dati non validati');
      expect(riquadro.getAttribute('title')).toBe('Fonte: ARPAV, dati non validati');
    });

    it('mostra numero, unità, data della misura e ARPAV', async () => {
      const { radice } = monta();
      const [riquadro] = radice.conClasse('aria-breve');
      expect(riquadro.tag).toBe('button');
      expect(riquadro.getAttribute('aria-busy')).toBe('true');
      expect(riquadro.textContent).toContain('Aria: leggo il dato…');
      await respira();
      expect(riquadro.getAttribute('aria-busy')).toBeNull();
      expect(riquadro.conClasse('aria-breve-testa')[0].textContent).toBe('Aria · ARPAV');
      expect(riquadro.conClasse('aria-breve-riga')[0].textContent).toBe('PM10 13,7 µg/m³ · 13 nov');
      expect(riquadro.conClasse('aria-breve-valore')[0].textContent).toBe('13,7');
      expect(riquadro.textContent).not.toMatch(/buona|scarsa|discreta|pessima/i);
      expect(riquadro.textContent).not.toContain('foto del');
    });

    it('al clic apre la scheda della stazione dell’aria', async () => {
      const { radice } = monta();
      await respira();
      const [finestra] = radice.conClasse('finestra');
      expect(finestra.hidden).toBe(true);
      radice.conClasse('aria-breve')[0].click();
      expect(finestra.hidden).toBe(false);
      expect(finestra.dataset.tipo).toBe('punto');
      expect(finestra.conClasse('scheda-nome')[0].textContent).toBe(CENTRALINA.nome);
      expect(finestra.conClasse('adesso-aria')).toHaveLength(1);
      expect(radice.lanciati.at(-1)).toMatchObject({ type: 'ba:punto', detail: { id: CENTRALINA.id } });
      // Il fuoco va al titolo della scheda.
      expect(fuoco.attivo).toBe(finestra.conClasse('scheda-nome')[0]);
    });

    it('se la fotografia ha più di tre giorni lo dice, con la data', async () => {
      ora = new Date('2026-11-18T08:00:00Z');
      const { radice } = monta();
      await respira();
      expect(radice.conClasse('aria-breve-testa')[0].textContent).toBe('Aria · ARPAV · foto del 14 nov');
    });

    describe('giudizio a parole', () => {
      const due = (n: number): string => String(n).padStart(2, '0');
      const ore = (giorno: string, valore: number) =>
        [...Array(24).keys()].map((h) => ({ quando: `${giorno}T${due(h)}:00:00`, valore }));
      /** Fotografia del 15 novembre: PM10 di ieri (14) e ozono per il 13 e il 14. */
      const conSerie = (pm10: number, ozono: number): DatiAria => ({
        ...ARIA,
        generato: '2026-11-15T08:00:00.000Z',
        misure: [
          { inquinante: 'Ozono (media oraria)', valore: 31.8, unita: 'µg/m³', quando: '2026-11-15T08:00:00' },
          { inquinante: 'PM10 (media giornaliera)', valore: pm10, unita: 'µg/m³', quando: '2026-11-14' },
        ],
        serie: {
          pm10Giornaliero: [{ quando: '2026-11-13', valore: 13.4 }, { quando: '2026-11-14', valore: pm10 }],
          ozonoOrario: [...ore('2026-11-13', ozono), ...ore('2026-11-14', ozono)],
        },
      });

      it('tempoGiudizio dice ieri, il giorno per esteso e quando è vecchio', () => {
        expect(tempoGiudizio('2026-11-14', MATTINA)).toEqual({
          giorniFa: 1, vecchio: false, giorno: 'sabato 14 novembre', ilGiorno: 'il 14 novembre', breve: '14 nov',
        });
        expect(tempoGiudizio('2026-11-12', MATTINA)).toMatchObject({ giorniFa: 3, vecchio: false });
        expect(tempoGiudizio('2026-11-11', MATTINA)).toMatchObject({ giorniFa: 4, vecchio: true, ilGiorno: "l'11 novembre" });
        // Il giorno è quello italiano: alle 23:30 UTC del 14 in Italia è già il 15.
        expect(tempoGiudizio('2026-11-14', new Date('2026-11-14T23:30:00Z'))?.giorniFa).toBe(1);
        expect(tempoGiudizio('2025-12-30', MATTINA)).toMatchObject({ vecchio: true, ilGiorno: 'il 30 dicembre 2025', breve: '30 dic 2025' });
        expect(tempoGiudizio('boh', MATTINA)).toBeNull();
        expect(tempoGiudizio('2026-11-14T10:00:00', MATTINA)).toBeNull();
      });

      it('nel riquadro la parola viene per prima, poi numero e data; il segno è solo un aiuto', async () => {
        live.leggiAria.mockResolvedValue(conSerie(14.7, 54));
        const { radice } = monta();
        await respira();
        const [riquadro] = radice.conClasse('aria-breve');
        const [corpo] = riquadro.conClasse('aria-breve-corpo');
        const primo = corpo.figli[0] as Finto;
        expect(primo.getAttribute('class')).toBe('aria-breve-giudizio');
        expect(primo.textContent).toBe('Aria buona · ieri');
        expect(primo.getAttribute('data-classe')).toBe('buona');
        const [segno] = riquadro.conClasse('aria-segno');
        expect(segno.getAttribute('aria-hidden')).toBe('true');
        expect(segno.getAttribute('class')).toBe('aria-segno aria-segno-buona');
        expect(segno.textContent).toBe('');
        expect(riquadro.conClasse('aria-breve-riga')[0].textContent).toBe('PM10 14,7 µg/m³ · 14 nov');
        expect(riquadro.conClasse('aria-breve-testa')[0].textContent).toBe('Dati ARPAV · giudizio del sito');
        // Di chi è il giudizio lo sente anche chi ascolta e lo legge chi passa col mouse.
        expect(riquadro.getAttribute('title')).toContain('Fonte: ARPAV, dati non validati');
        expect(riquadro.getAttribute('title')).toContain('Giudizio calcolato da questo sito');
        expect(riquadro.conClasse('solo-lettori')[0].textContent).toContain('Non è il bollettino ufficiale');
        expect(riquadro.conClasse('solo-lettori')[0].textContent).toContain('Apri la scheda della stazione');
      });

      it('scrive la parola giusta per ogni classe', async () => {
        const casi: [number, number, string][] = [
          [40, 54, 'accettabile'], [60, 54, 'mediocre'], [14.7, 200, 'scadente'], [120, 54, 'pessima'],
        ];
        for (const [pm10, ozono, parola] of casi) {
          live.leggiAria.mockResolvedValue(conSerie(pm10, ozono));
          const { radice } = monta();
          await respira();
          expect(radice.conClasse('aria-breve-parola')[0].textContent).toBe(parola);
          expect(radice.conClasse('aria-segno')[0].getAttribute('class')).toBe(`aria-segno aria-segno-${parola}`);
        }
      });

      it('se il giorno ha più di tre giorni la data viene prima della parola', async () => {
        ora = new Date('2026-11-19T08:00:00Z');
        live.leggiAria.mockResolvedValue(conSerie(14.7, 54));
        const { radice } = monta();
        await respira();
        expect(radice.conClasse('aria-breve-giudizio')[0].textContent).toBe('Aria il 14 novembre: buona');
        expect(radice.conClasse('aria-breve-testa')[0].textContent).toBe('Dati ARPAV · foto del 15 nov');
        // Di chi è il giudizio resta detto a chi ascolta e a chi passa col mouse.
        expect(radice.conClasse('aria-breve')[0].getAttribute('title')).toContain('Giudizio calcolato da questo sito');
        expect(radice.conClasse('aria-breve')[0].conClasse('solo-lettori')[0].textContent).toContain('Giudizio calcolato da questo sito');
      });

      it('dopo due o tre giorni non dice «ieri» ma la data', async () => {
        ora = new Date('2026-11-17T08:00:00Z');
        live.leggiAria.mockResolvedValue(conSerie(14.7, 54));
        const { radice } = monta();
        await respira();
        expect(radice.conClasse('aria-breve-giudizio')[0].textContent).toBe('Aria buona · 14 nov');
      });

      it('mai oggi: se il giorno del giudizio non è finito non dà la parola, restano i numeri', async () => {
        // Il dispositivo dice 14 novembre (o la fotografia ha un PM10 con la data di oggi): giorniFa 0.
        vi.setSystemTime(new Date('2026-11-14T20:00:00Z'));
        ora = new Date('2026-11-14T20:00:00Z');
        expect(tempoGiudizio('2026-11-14', ora)?.giorniFa).toBe(0);
        live.leggiAria.mockResolvedValue(conSerie(14.7, 54));
        const { radice } = monta();
        await respira();
        expect(radice.conClasse('aria-breve-giudizio')).toHaveLength(0);
        expect(radice.conClasse('aria-breve')[0].textContent).not.toMatch(/buona|accettabile|mediocre|scadente|pessima/i);
        expect(radice.conClasse('aria-breve-riga')[0].textContent).toContain('PM10 14,7 µg/m³');
        radice.conClasse('aria-breve')[0].click();
        await respira();
        const [finestra] = radice.conClasse('finestra');
        expect(finestra.conClasse('giudizio')).toHaveLength(0);
        expect(finestra.conClasse('giudizio-manca')[0].textContent).toContain('Giudizio a parole non disponibile');
        expect(finestra.conClasse('misura')).toHaveLength(2);
      });

      it('se manca un inquinante non dà la parola: restano i numeri', async () => {
        const senzaOzono = conSerie(14.7, 54);
        senzaOzono.serie = { pm10Giornaliero: senzaOzono.serie!.pm10Giornaliero };
        live.leggiAria.mockResolvedValue(senzaOzono);
        const { radice } = monta();
        await respira();
        expect(radice.conClasse('aria-breve-giudizio')).toHaveLength(0);
        expect(radice.conClasse('aria-breve-testa')[0].textContent).toBe('Aria · ARPAV');
        expect(radice.conClasse('aria-breve')[0].textContent).not.toMatch(/buona|accettabile|mediocre|scadente|pessima/i);
        radice.conClasse('aria-breve')[0].click();
        await respira();
        const [finestra] = radice.conClasse('finestra');
        expect(finestra.conClasse('giudizio')).toHaveLength(0);
        expect(finestra.conClasse('giudizio-manca')[0].textContent).toContain('Giudizio a parole non disponibile');
        expect(finestra.conClasse('misura')).toHaveLength(2);
      });

      it('nella scheda: frase, chi decide, numeri usati, scala intera e avvertenze', async () => {
        live.leggiAria.mockResolvedValue(conSerie(14.7, 54));
        const { radice } = monta();
        await respira();
        radice.conClasse('aria-breve')[0].click();
        await respira();
        const [finestra] = radice.conClasse('finestra');
        expect(finestra.conClasse('giudizio-frase')[0].textContent).toBe(
          "Ieri, sabato 14 novembre, l'aria alla centralina era buona per polveri PM10 e ozono.",
        );
        expect(finestra.conClasse('giudizio-senso')[0].textContent).toContain("Il giudizio lo decide il peggiore dei due: l'ozono.");
        const numeri = finestra.conClasse('giudizio-numero').map((n) => n.textContent);
        expect(numeri).toEqual([
          'Polveri PM10: 15 µg/m³ (14,7 arrotondato), media del giorno (valore di riferimento 50)',
          'Ozono: 54 µg/m³, media più alta su 8 ore (valore di riferimento 120)',
        ]);
        expect(finestra.conClasse('giudizio-decide')[0].textContent).toContain('Ozono');
        // La scala intera, dalla migliore alla peggiore, con quella del giorno segnata anche a parole.
        const voci = finestra.conClasse('scala-voce');
        expect(voci.map((v) => v.textContent.split(':')[0])).toEqual(['Buona', 'Accettabile', 'Mediocre', 'Scadente', 'Pessima']);
        const attuali = voci.filter((v) => v.getAttribute('aria-current') === 'true');
        expect(attuali).toHaveLength(1);
        expect(attuali[0].textContent).toBe('Buona: fino a metà del valore di riferimento · ieri');
        expect(finestra.conClasse('scala-attuale')).toHaveLength(1);
        const [avvertenza] = finestra.conClasse('giudizio-avvertenza');
        expect(avvertenza.textContent).toContain('Giudizio calcolato da questo sito');
        expect(avvertenza.textContent).toContain('su dati ARPAV non validati');
        expect(avvertenza.textContent).toContain('Manca il biossido di azoto');
        expect(avvertenza.textContent).toContain('il giudizio ufficiale può essere peggiore del nostro');
        expect(avvertenza.textContent).toContain("Per il giudizio i valori si arrotondano all'intero.");
        // Nessuna promessa che non possiamo mantenere, nessuna parola di legge.
        expect(finestra.conClasse('giudizio')[0].textContent).not.toMatch(/mai migliore|soglia|limite|di legge|superat/i);
        expect(avvertenza.textContent).toContain('Non sostituisce il bollettino ufficiale');
        const indirizzi = avvertenza.querySelectorAll('a').map((a) => a.getAttribute('href'));
        expect(indirizzi).toContain('https://www.arpa.veneto.it/dati-ambientali/dati-storici/aria/qualita-aria-dati-validati');
        expect(indirizzi).toContain('https://www.arpa.veneto.it/temi-ambientali/aria/iqa/indice');
        // Nessun consiglio sanitario.
        expect(finestra.conClasse('giudizio')[0].textContent).not.toMatch(/salute|evita|consigli|sport|finestre/i);
        // Le ultime misure restano, senza etichetta di giudizio.
        expect(finestra.conClasse('misura')).toHaveLength(2);
      });

      it('nella scheda un giudizio vecchio porta la sua data e lo dice', async () => {
        vi.setSystemTime(new Date('2026-11-19T08:00:00Z'));
        ora = new Date('2026-11-19T08:00:00Z');
        live.leggiAria.mockResolvedValue(conSerie(60, 54));
        const { radice } = monta();
        await respira();
        radice.conClasse('aria-breve')[0].click();
        await respira();
        const [finestra] = radice.conClasse('finestra');
        expect(finestra.conClasse('giudizio-frase')[0].textContent).toBe(
          "Il 14 novembre l'aria alla centralina era mediocre per polveri PM10 e ozono.",
        );
        expect(finestra.conClasse('lettura-avviso')[0].textContent).toContain('Sono passati 5 giorni');
        expect(finestra.conClasse('scala-attuale')[0].textContent).toContain('Mediocre');
        expect(finestra.conClasse('scala-attuale')[0].textContent).toContain('· 14 nov');
        expect(finestra.conClasse('giudizio-senso')[0].textContent).toContain('Le polveri PM10 erano sopra il valore di riferimento, entro una volta e mezzo.');
      });
    });

    it('se il file non si carica lo dice, senza numeri', async () => {
      live.leggiAria.mockRejectedValue(new Error('404'));
      const { radice } = monta();
      await respira();
      const [riquadro] = radice.conClasse('aria-breve');
      expect(riquadro.getAttribute('aria-busy')).toBeNull();
      expect(riquadro.conClasse('aria-breve-corpo')[0].textContent).toBe('Aria: dato non disponibile');
      expect(riquadro.textContent).not.toMatch(/\d/);
      // La scheda si apre lo stesso: lì c'è «Riprova».
      riquadro.click();
      expect(radice.conClasse('finestra')[0].hidden).toBe(false);
    });

    it('se la fotografia non ha misure lo dice', async () => {
      live.leggiAria.mockResolvedValue({ ...ARIA, misure: [] });
      const { radice } = monta();
      await respira();
      expect(radice.conClasse('aria-breve-corpo')[0].textContent).toBe('Aria: nessuna misura nella fotografia');
    });

    it('senza una stazione dell’aria sulla mappa il riquadro non è un bottone', async () => {
      const riquadro = comeFinto(creaAriaBreve({ adesso }));
      await respira();
      expect(riquadro.tag).toBe('div');
      expect(riquadro.textContent).toContain('PM10 13,7 µg/m³');
      expect(monta({ ...STRATI, punti: [] }).radice.conClasse('aria-breve')[0].tag).toBe('div');
    });
  });
});
