import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-ignore: moduli .mjs degli script, senza tipi
import * as avvisi from '../scripts/lib/avvisi.mjs';
// @ts-ignore: moduli .mjs degli script, senza tipi
import * as stazioni from '../scripts/lib/stazioni.mjs';
import type { Avviso, DatiAvvisi } from '../src/types';

const {
  FONTE_CCISS,
  FONTE_VIABILITA,
  controllaVoci,
  decodificaEntita,
  filtraCciss,
  filtraCcissZona,
  filtraViabilita,
  leggiCcissZona,
  leggiRss,
  oraItaliana,
  urlCcissZona,
  ordinanzePrecedenti,
  periodoOrdinanza,
  pulisciTesto,
  stradaViabilita,
  testoSemplice,
  trattoDelBassanese,
  tronca,
  unisciAvvisi,
} = avvisi;
const { campiCsv, nomeLeggibile, stazioniDaStops } = stazioni;

// Le voci qui sotto sono copiate dai feed veri del 15 novembre 2026.

const RSS_CCISS = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
  <channel>
    <title>CCISS News Feed</title>
    <link>https://www.cciss.it</link>
    <description>Notizie di traffico, eventi e informazioni</description>
    <item>
      <title>A26 Genova-Gravellona Toce</title>
      <description>A26 Genova-Gravellona Toce
 perdita di carico dalle 09:45 del 15 novembre 2026  tra Svincolo Masone e Allacciamento A10 Genova-Ventimiglia  in direzione Genova Voltri  &lt;br/&gt; (Fonte: www.cciss.it)</description>
      <pubDate>Sun, 15 Nov 2026 08:47:00 GMT</pubDate>
      <dc:date>2026-11-15T08:47:00Z</dc:date>
    </item>
    <item>
      <title>SS47 Della Valsugana</title>
      <description>SS47 Della Valsugana
 mezzi spargisale in azione  tra 834 m dopo Incrocio Bassano Del Grappa - SS141 Strada Cadorna e Incrocio Martincelli   &lt;br/&gt; (Fonte: www.cciss.it)</description>
      <pubDate>Sun, 15 Nov 2026 05:04:00 GMT</pubDate>
      <dc:date>2026-11-15T05:04:00Z</dc:date>
    </item>
  </channel>
</rss>`;

function voceViabilita(titolo: string, link: string, pubDate: string, corpo: string): string {
  return `
	<item>
		<title>${titolo}</title>
		<link>${link}</link>

		<dc:creator><![CDATA[Redazione]]></dc:creator>
		<pubDate>${pubDate}</pubDate>
				<category><![CDATA[Ordinanze temporanee]]></category>
		<guid isPermaLink="false">https://vi-abilita.it/?p=1</guid>

					<description><![CDATA[<p>${corpo}</p>
<p>L'articolo <a href="${link}">${titolo}</a> proviene da <a href="https://vi-abilita.it">Vi.abilità srl</a>.</p>
]]></description>
	</item>`;
}

const LINK_SP74 =
  'https://vi-abilita.it/servizi/ufficio-concessioni-e-autorizzazioni/ordinanze-temporanee/s-p-74-pedemontana-del-grappa-dal-km-2454-al-km-2567-in-comune-di-romano-dezzelino/';

const RSS_VIABILITA = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"
	xmlns:content="http://purl.org/rss/1.0/modules/content/"
	xmlns:dc="http://purl.org/dc/elements/1.1/"
	>
<channel>
	<title>Vi.abilità srl</title>
	<link>https://vi-abilita.it/</link>
	<description>Gestione strade Vicenza e provincia</description>
${voceViabilita(
  'SI INFORMA L&#8217;UTENZA CHE IL GIORNO LUNEDI&#8217; 07/12/26 I NOSTRI UFFICI SARANNO CHIUSI',
  'https://vi-abilita.it/news/si-informa-lutenza-che-il-giorno-lunedi-07-12-26-i-nostri-uffici-saranno-chiusi/',
  'Fri, 13 Nov 2026 14:06:59 +0000',
  'SI INFORMA L&#8217;UTENZA CHE IL GIORNO LUNEDI&#8217; 07/12/26 I NOSTRI UFFICI SARANNO CHIUSI.',
)}
${voceViabilita(
  'DETERMINA REP. 70/2026 DELL&#8217;11/11/2026 (PROT. 23113) &#8211; OM 29-2026',
  'https://vi-abilita.it/news/determina-rep-70-2026/',
  'Wed, 11 Nov 2026 10:00:00 +0000',
  'Lavori lungo la S.P. 248 in comune di Marostica.',
)}
${voceViabilita(
  'S.P. 52 Bassanese dal km 2+538 al km 3+165 circa nei comuni di Sandrigo, Pozzoleone e Schiavon.',
  'https://vi-abilita.it/servizi/ufficio-concessioni-e-autorizzazioni/ordinanze-temporanee/s-p-52-bassanese/',
  'Thu, 15 Oct 2026 08:00:00 +0000',
  'Prot. 21300 XX/yy Vicenza, 14/10/2026 Pratica C2700-2026 &#8211; rep. ord. 380/2026 Rif. fascicolo 2026-III/2.700 Ordinanza per l&#8217;istituzione di un senso unico alternato della circolazione stradale. [&#8230;]',
)}
${voceViabilita(
  'S.P. 74 Pedemontana del Grappa dal km 2+454 al km 2+567 in comune di Romano d&#8217;Ezzelino.',
  LINK_SP74,
  'Thu, 01 Oct 2026 06:30:55 +0000',
  'Prot. 19994 XX/yy Vicenza, 29/09/2026 Pratica C2461-2026 &#8211; rep. ord. 353/2026 Rif. fascicolo 2024-III/2.331 Ordinanza per l&#8217;istituzione di un senso unico alternato della circolazione stradale. Per &#8220;ripristini dello strato di base e bynder&#8221; dei lavori di «posa rete idrica in attraversamento e parallelismo». Periodo: dal 05/10/2026 al 16/10/2026 dalle ore 8:30 alle ore 17:30 esclusi [&#8230;]',
)}
${voceViabilita(
  'S.P. 111 Nuova Gasparona dal km 0+000 al km 0+340 circa in comune di Thiene,',
  'https://vi-abilita.it/servizi/ufficio-concessioni-e-autorizzazioni/ordinanze-temporanee/s-p-111-nuova-gasparona/',
  'Fri, 11 Sep 2026 07:12:15 +0000',
  'Ordinanza per la sospensione della circolazione stradale di una corsia di marcia per ogni direzione dei veicoli provenienti da Bassano del Grappa con direzione Thiene.',
)}
${voceViabilita(
  'S.P. 97 Sant’Anna al km 3+300 circa in comune di Rosà.',
  'https://vi-abilita.it/servizi/ufficio-concessioni-e-autorizzazioni/ordinanze-temporanee/s-p-97-santanna/',
  'Thu, 14 May 2026 07:55:59 +0000',
  'Ordinanza vecchia di sei mesi.',
)}
</channel>
</rss>`;

const ADESSO = new Date('2026-11-15T09:00:00Z');
/** Un giorno in cui i lavori sulla S.P. 74 (dal 5 al 16 ottobre) sono in corso. */
const A_OTTOBRE = new Date('2026-10-10T09:00:00Z');

describe('pulizia del testo', () => {
  it('decodifica le entità con nome, decimali ed esadecimali', () => {
    expect(decodificaEntita('d&#8217;Ezzelino')).toBe('d’Ezzelino');
    expect(decodificaEntita('d&#x2019;Ezzelino &amp; Ros&agrave; &lt;b&gt;')).toBe('d’Ezzelino & Rosà <b>');
    expect(decodificaEntita('&sconosciuta; &#0; R&D')).toBe('&sconosciuta; &#0; R&D');
  });

  it('toglie HTML e CDATA, decodifica anche il testo codificato due volte, compatta gli spazi', () => {
    expect(testoSemplice('<![CDATA[<p>Senso   unico\n alternato&nbsp;in <a href="x">via</a> Roma</p>]]>')).toBe(
      'Senso unico alternato in via Roma',
    );
    expect(testoSemplice('chiuso &lt;br/&gt; (Fonte) &amp;#8217;')).toBe('chiuso (Fonte) ’');
  });

  it('non lascia trattini lunghi né trattini di sillabazione invisibili', () => {
    expect(testoSemplice('Lavori di ma­nutenzione &#8211; OM 29 &mdash; fine')).toBe('Lavori di manutenzione - OM 29 - fine');
  });

  it('taglia su un confine di parola, con il segno … dentro il limite', () => {
    const lungo = 'parola '.repeat(100).trim();
    const corto = tronca(lungo, 280);
    expect(corto.length).toBeLessThanOrEqual(280);
    expect(corto.endsWith('parola…')).toBe(true);
    expect(tronca('uno due tre', 9)).toBe('uno due…');
    expect(tronca('breve', 280)).toBe('breve');
    expect(pulisciTesto('<p>' + 'x'.repeat(400) + '</p>').length).toBe(280);
  });
});

describe('leggiRss', () => {
  it('legge le voci del CCISS: titolo, descrizione, data in ISO, nessun link', () => {
    const voci = leggiRss(RSS_CCISS);
    expect(voci).toHaveLength(2);
    expect(voci[1].titolo).toBe('SS47 Della Valsugana');
    expect(voci[1].quando).toBe('2026-11-15T05:04:00.000Z');
    expect(voci[1].link).toBe('');
    // Il titolo del canale non è una voce.
    expect(voci.map((v: { titolo: string }) => v.titolo)).not.toContain('CCISS News Feed');
  });

  it('legge le voci di WordPress: entità nel titolo, CDATA nella descrizione, link', () => {
    const voci = leggiRss(RSS_VIABILITA);
    expect(voci).toHaveLength(6);
    expect(voci[3].titolo).toBe('S.P. 74 Pedemontana del Grappa dal km 2+454 al km 2+567 in comune di Romano d’Ezzelino.');
    expect(voci[3].link).toBe(LINK_SP74);
    expect(voci[3].quando).toBe('2026-10-01T06:30:55.000Z');
    expect(voci[3].descrizione).toContain('<p>Prot. 19994');
    expect(voci[3].descrizione).not.toContain('CDATA');
  });

  it('non si rompe con testo che non è un feed', () => {
    expect(leggiRss('')).toEqual([]);
    expect(leggiRss('<html><body>Errore 503</body></html>')).toEqual([]);
    expect(leggiRss('<rss><channel><item><title>Senza data</title></item></channel></rss>')[0].quando).toBeNull();
  });
});

describe('filtraCciss', () => {
  const tenuti: Avviso[] = filtraCciss(leggiRss(RSS_CCISS));

  it('tiene la SS47 a Bassano e scarta la A26', () => {
    expect(tenuti).toHaveLength(1);
    expect(tenuti[0]).toEqual({
      tipo: 'evento',
      strada: 'SS47 della Valsugana',
      testo: 'Mezzi spargisale in azione tra 834 m dopo Incrocio Bassano Del Grappa - SS141 Strada Cadorna e Incrocio Martincelli',
      quando: '2026-11-15T05:04:00.000Z',
      fonte: 'CCISS Viaggiare Informati',
      url: 'https://www.cciss.it/',
    });
  });

  const voce = (titolo: string, testo: string) => ({
    titolo,
    descrizione: `${titolo}\n ${testo} &lt;br/&gt; (Fonte: www.cciss.it)`,
    link: '',
    quando: '2026-11-15T08:00:00.000Z',
  });

  it('applica le regole sulle strade e sui comuni', () => {
    const prove: [string, string, boolean][] = [
      ['SS47 Della Valsugana', 'coda tra Incrocio Pove Del Grappa e Incrocio Solagna', true],
      ['SS47 Della Valsugana', 'incidente a Incrocio Trento Nord', false],
      ['SS47 Della Valsugana', 'nove veicoli coinvolti a Levico Terme', false],
      ['SS248 Schiavonesca-Marosticana', 'lavori a Incrocio Montebelluna', true],
      ['SPV Superstrada Pedemontana Veneta', 'veicolo fermo a Svincolo Bassano Ovest', true],
      ['SPV Superstrada Pedemontana Veneta', 'veicolo fermo a Svincolo Montebelluna Est', false],
      ['A31 Valdastico', 'coda tra Svincolo Dueville e Svincolo Thiene', false],
      ['SS53 Postumia', 'incidente verso Bassano', true],
      ['SS2 Cassia', 'incidente a Incrocio Bassano Romano', false],
      ['SS45bis Gardesana', 'lavori a Bassano Bresciano', false],
    ];
    for (const [titolo, testo, atteso] of prove) {
      expect(filtraCciss([voce(titolo, testo)]).length === 1, `${titolo}: ${testo}`).toBe(atteso);
    }
  });

  it('non ripete lo stesso evento e non tiene voci senza data', () => {
    const v = voce('SS47 Della Valsugana', 'coda a Incrocio Bassano Del Grappa');
    expect(filtraCciss([v, v, { ...v, quando: null }])).toHaveLength(1);
  });
});

describe('CCISS per zona', () => {
  // Risposta vera del 18 novembre 2026, zoom 16 (tests/fixtures/cciss-zona.json).
  const VERA = readFileSync(new URL('./fixtures/cciss-zona.json', import.meta.url), 'utf8');

  it("chiede il riquadro attorno a Bassano all'indirizzo della mappa del CCISS", () => {
    const u = new URL(urlCcissZona());
    expect(u.origin + u.pathname).toBe('https://www.cciss.it/web/cciss/situazione-della-viabilita');
    expect(u.searchParams.get('p_p_id')).toBe('2_WAR_ccissservizimapsportlet');
    const [sLat, sLon] = u.searchParams.get('_2_WAR_ccissservizimapsportlet_so')!.split(',').map(Number);
    const [nLat, nLon] = u.searchParams.get('_2_WAR_ccissservizimapsportlet_ne')!.split(',').map(Number);
    // Sotto lo zoom 16 il CCISS manda solo gli eventi di priorità Alta e Molto Alta.
    expect(Number(u.searchParams.get('_2_WAR_ccissservizimapsportlet_z'))).toBeGreaterThanOrEqual(16);
    // Il centro di Bassano sta dentro il riquadro.
    expect(sLat).toBeLessThan(45.7665);
    expect(nLat).toBeGreaterThan(45.7665);
    expect(sLon).toBeLessThan(11.7345);
    expect(nLon).toBeGreaterThan(11.7345);
  });

  it("legge l'ora italiana, con l'ora legale e quella solare", () => {
    expect(oraItaliana('12/10/2026 10:41')).toBe('2026-10-12T08:41:00.000Z');
    expect(oraItaliana('18/11/2026 01:04')).toBe('2026-11-18T00:04:00.000Z');
    expect(oraItaliana('1/3/2027 9:05')).toBe('2027-03-01T08:05:00.000Z');
    // Il giorno del cambio d'ora (25 ottobre 2026): prima e dopo le 3.
    expect(oraItaliana('25/10/2026 01:30')).toBe('2026-10-24T23:30:00.000Z');
    expect(oraItaliana('25/10/2026 12:00')).toBe('2026-10-25T11:00:00.000Z');
    for (const rotto of ['', 'ieri', '31/11/2026 10:00', '12/13/2026 10:00', '12/10/2026 25:00', null, undefined]) {
      expect(oraItaliana(rotto), String(rotto)).toBeNull();
    }
  });

  it('dalla risposta vera (zoom 16) tiene gli 8 eventi vicini, anche quelli di priorità bassa', () => {
    const lista = leggiCcissZona(VERA);
    expect(lista).toHaveLength(12);
    const tenuti: Avviso[] = filtraCcissZona(lista);
    expect(tenuti.map((a) => a.strada)).toEqual([
      'SS47 della Valsugana',
      'SS245 Castellana',
      'SP70 Via Don Girolamo Carli',
      'SP72 (VI) Fratellanza',
      'SS47 della Valsugana',
      'SP73 (VI) Campesana Valvecchia',
      'SP54 Via Villa',
      'SS47 della Valsugana',
    ]);
    // I lavori sulla SS47 a Bassano sono di priorità Bassa: con lo zoom 11 non arrivavano.
    expect(tenuti[0].testo).toContain('Incrocio Bassano Del Grappa - SS141 Strada Cadorna e Incrocio Solagna');
    for (const a of tenuti) expect(a.attivo).toBe(true);
    const sp73 = tenuti.find((a) => a.strada.startsWith('SP73'));
    expect(sp73).toEqual({
      tipo: 'evento',
      strada: 'SP73 (VI) Campesana Valvecchia',
      testo:
        'Tratto chiuso causa lavori dalle 08:30 del 2 alle 16:30 del 20 novembre 2026 tra Incrocio Bassano del Grappa Localita Contra dei Cani e Incrocio SP76-Cruni-Labental',
      quando: '2026-10-12T08:41:00.000Z',
      fonte: 'CCISS Viaggiare Informati',
      url: 'https://www.cciss.it/web/cciss/situazione-della-viabilita',
      attivo: true,
    });
  });

  const evento = (o: Record<string, unknown> = {}) => ({
    titolo: 'SS47 Della Valsugana',
    evento: 'coda',
    trattoEvento: ' tra Incrocio A e Incrocio B ',
    dettaglio: 'SS47 Della Valsugana\n coda tra Incrocio A e Incrocio B ',
    stato: 'ACTIVE',
    dataPubblicazione: '18/11/2026 07:30',
    percorsoTO: {
      coordinateMappaInizioTO: { coordinateMappaCX: 11.70, coordinateMappaCY: 45.80 },
      coordinateMappaFineTO: { coordinateMappaCX: 11.72, coordinateMappaCY: 45.78 },
    },
    ...o,
  });
  const lontano = {
    coordinateMappaInizioTO: { coordinateMappaCX: 11.91, coordinateMappaCY: 45.62 },
    coordinateMappaFineTO: { coordinateMappaCX: 11.95, coordinateMappaCY: 45.60 },
  };

  it('tiene gli eventi vicini e quelli lontani che nominano Bassano, scarta gli altri', () => {
    expect(filtraCcissZona([evento()])).toHaveLength(1);
    expect(filtraCcissZona([evento({ percorsoTO: lontano })])).toHaveLength(0);
    expect(filtraCcissZona([evento({ percorsoTO: lontano, dettaglio: 'SS47 Della Valsugana\n coda verso Bassano' })])).toHaveLength(1);
    // Senza coordinate decide il testo.
    expect(filtraCcissZona([evento({ percorsoTO: null })])).toHaveLength(0);
    expect(filtraCcissZona([evento({ percorsoTO: null, dettaglio: 'SS47 Della Valsugana\n coda a Incrocio Solagna' })])).toHaveLength(1);
    // Coordinate rotte non contano come vicine.
    expect(filtraCcissZona([evento({ percorsoTO: { coordinateMappaInizioTO: { coordinateMappaCX: null, coordinateMappaCY: null } } })])).toHaveLength(0);
  });

  it('scarta gli eventi non in corso, senza data o senza titolo, e i doppioni', () => {
    expect(filtraCcissZona([evento({ stato: 'CLOSED' })])).toHaveLength(0);
    expect(filtraCcissZona([evento({ dataPubblicazione: 'ieri' })])).toHaveLength(0);
    expect(filtraCcissZona([evento({ titolo: null }), null, 7])).toHaveLength(0);
    expect(filtraCcissZona([evento(), evento()])).toHaveLength(1);
  });

  it('pulisce il testo, ripiega su evento e tratto, e non supera i 15 eventi', () => {
    const [a] = filtraCcissZona([evento({ dettaglio: '<b>SS47 Della Valsugana</b> &amp; coda — lunga' })]);
    expect(a.testo).toBe('& coda - lunga');
    const [b] = filtraCcissZona([evento({ dettaglio: '' })]);
    expect(b.testo).toBe('Coda tra Incrocio A e Incrocio B');
    const molti = Array.from({ length: 20 }, (_, i) => evento({ evento: `coda ${i}`, dettaglio: `coda numero ${i}`, dataPubblicazione: `18/11/2026 ${String(i).padStart(2, '0')}:00` }));
    const tenuti = filtraCcissZona(molti);
    expect(tenuti).toHaveLength(15);
    expect(tenuti[0].testo).toBe('Coda numero 19');
  });

  it('oltre i 15 eventi tiene i più vicini al centro, non i più recenti', () => {
    const vicino = evento({ evento: 'lavori', dettaglio: 'lavori lunghi in centro', dataPubblicazione: '01/09/2026 08:00' });
    const lontani = Array.from({ length: 15 }, (_, i) =>
      evento({
        dettaglio: `coda lontana ${i}`,
        dataPubblicazione: `18/11/2026 ${String(i).padStart(2, '0')}:30`,
        percorsoTO: {
          coordinateMappaInizioTO: { coordinateMappaCX: 11.85, coordinateMappaCY: 45.80 },
          coordinateMappaFineTO: { coordinateMappaCX: 11.86, coordinateMappaCY: 45.80 },
        },
      }),
    );
    const tenuti: Avviso[] = filtraCcissZona([...lontani, vicino]);
    expect(tenuti).toHaveLength(15);
    expect(tenuti.map((a) => a.testo)).toContain('Lavori lunghi in centro');
    // Dopo il taglio l'ordine torna dal più recente.
    expect(tenuti[tenuti.length - 1].testo).toBe('Lavori lunghi in centro');
  });

  it('accetta una zona senza eventi, rifiuta le risposte che non sono quelle attese', () => {
    expect(leggiCcissZona('{"eventiTrafficoList":[],"html":""}')).toEqual([]);
    expect(() => leggiCcissZona('<html>errore</html>')).toThrow(/non è JSON/);
    expect(() => leggiCcissZona('{"altro":[]}')).toThrow(/eventiTrafficoList/);
    expect(() => leggiCcissZona('{"eventiTrafficoList":[{"titolo":"X","dataPubblicazione":"ieri"}]}')).toThrow(/formato cambiato/);
  });
});

describe('filtraViabilita', () => {
  const tenuti: Avviso[] = filtraViabilita(leggiRss(RSS_VIABILITA), A_OTTOBRE);

  it("tiene solo l'ordinanza di Romano d'Ezzelino", () => {
    expect(tenuti).toHaveLength(1);
    const a = tenuti[0];
    expect(a.tipo).toBe('ordinanza');
    expect(a.strada).toBe('S.P. 74 Pedemontana del Grappa');
    expect(a.quando).toBe('2026-10-01T06:30:55.000Z');
    expect(a.fonte).toBe('Vi.abilità (Provincia di Vicenza)');
    expect(a.url).toBe(LINK_SP74);
  });

  it('scrive un testo breve e pulito: niente HTML, protocollo, sigle o coda di WordPress', () => {
    const { testo } = tenuti[0];
    // Dove, poi il periodo intero, poi che cosa: la formula fissa è accorciata.
    expect(testo).toBe(
      'Dal km 2+454 al km 2+567 in comune di Romano d’Ezzelino. Periodo: dal 05/10/2026 al 16/10/2026, dalle ore 8:30 alle ore 17:30. Senso unico alternato. Per “ripristini dello strato di base e bynder” dei lavori di «posa rete idrica in attraversamento e parallelismo».',
    );
    expect(testo.length).toBeLessThanOrEqual(280);
    expect(testo).not.toMatch(/[<>]|&#|&amp;|Prot\.|XX\/yy|Rif\. fascicolo|proviene da|\[|[–—]/);
  });

  it('scarta le ordinanze con il periodo dei lavori già finito', () => {
    // Il 15 novembre i lavori sulla S.P. 74 (fino al 16 ottobre) sono finiti da un mese.
    expect(filtraViabilita(leggiRss(RSS_VIABILITA), ADESSO)).toEqual([]);
    // L'ultimo giorno dei lavori l'ordinanza c'è ancora; il giorno dopo no.
    expect(filtraViabilita(leggiRss(RSS_VIABILITA), new Date('2026-10-16T20:00:00Z'))).toHaveLength(1);
    expect(filtraViabilita(leggiRss(RSS_VIABILITA), new Date('2026-10-17T06:00:00Z'))).toEqual([]);
  });

  // I due casi veri del 15 novembre 2026, con il testo intero di WordPress (<content:encoded>).
  const voceVera = (titolo: string, descrizione: string, contenuto: string) => ({
    titolo,
    descrizione: `<p>${descrizione} [&#8230;]</p>`,
    contenuto,
    link: 'https://vi-abilita.it/servizi/prova/',
    quando: '2026-11-11T08:50:25.000Z',
  });

  it('toglie i riferimenti di protocollo dentro il testo e non taglia mai il periodo (S.P. 75 Volon)', () => {
    const [a]: Avviso[] = filtraViabilita(
      [
        voceVera(
          'S.P. 75 Volon dal km 3+775 al km 4+266 all’esterno dei centri abitati in comune di Mussolente',
          'Prot. 22956 XX/yy Vicenza, 09/11/2026 Pratica C2844 -2026 &#8211; rep. ord. 410/2026 Rif. fascicolo 2026-III/2.001 Istituzione di senso unico alternato della circolazione stradale. Per posa linea elettrica MT in attraversamento e parallelismo &#8211; concessione prot. 7145 del 13/04/2026. Periodo: dal 16/11/2026 al 18/12/2026 dalle ore 8:30 alle ore 16:30, con esclusione dei seguenti giorni: i sabati e',
          '<p align="justify"><span lang="it-IT">Prot. 22956 XX/yy  Vicenza, 09/11/2026</span></p>\n<p align="justify"><span lang="it-IT">Pratica C2844 -2026 &#8211; rep. ord. 410/2026</span></p>\n<p align="justify"><span lang="it-IT">Rif. fascicolo 2026-III/2.001</span></p>\n<p align="justify"><span lang="it-IT">Istituzione di senso unico alternato della circolazione stradale.</span></p>\n<p align="justify"><span lang="it-IT">P</span><span lang="it-IT">er </span>posa linea elettrica MT in attraversamento e parallelismo &#8211; concessione prot. 7145 del 13/04/2026<span lang="it-IT">.</span></p>\n<p align="justify"><span lang="it-IT">Periodo: </span><span lang="it-IT">dal 16/11/2026 al 18/12/2026 dalle ore 8:30 alle ore 16:30, con esclusione dei seguenti giorni: i sabati e le domeniche.</span></p>\n<ul><li><a href="https://vi-abilita.it/wp-content/uploads/2026/11/SP-75-ord_signed.pdf">SP-75-ord_signed.pdf</a></li></ul>',
        ),
      ],
      ADESSO,
    );
    expect(a.strada).toBe('S.P. 75 Volon');
    expect(a.testo).toBe(
      'Dal km 3+775 al km 4+266 all’esterno dei centri abitati in comune di Mussolente. Periodo: dal 16/11/2026 al 18/12/2026, dalle ore 8:30 alle ore 16:30. Senso unico alternato. Per posa linea elettrica MT in attraversamento e parallelismo.',
    );
  });

  it("toglie le sigle d'ufficio OM, AREA, CUP e CIG e legge il periodo dal testo intero (S.P. 72 Fratellanza)", () => {
    const [a]: Avviso[] = filtraViabilita(
      [
        voceVera(
          'S.P. 72 Fratellanza al km 8+650 circa, in comune di Marostica',
          // Il riassunto del feed si ferma a "Periodo: dal": la data sta solo nel testo intero.
          'Prot. 22034 XX/yy Vicenza, 27/10/2026 Pratica C2709-2026 &#8211; rep. ord. 941/2026 Rif. fascicolo 2026-III/2.001 Ordinanza per istituzione di senso unico alternato della circolazione stradale Interventi di consolidamento e messa in sicurezza di scarpate stradali, muri di sostegno e cordoli &#8211; OM 07/2026 &#8211; AREA EST &#8211; SS.PP. Varie &#8211; CUP: G77H26000130003 &#8211; CIG: BB79793833 Periodo: dal',
          '<p>Prot. 22034 XX/yy Vicenza, 27/10/2026</p><p>Pratica C2709-2026 &#8211; rep. ord. 941/2026</p><p>Rif. fascicolo 2026-III/2.001</p><p>Ordinanza per istituzione di senso unico alternato della circolazione stradale</p><p>Interventi di consolidamento e messa in sicurezza di scarpate stradali, muri di sostegno e cordoli &#8211; OM 07/2026 &#8211; AREA EST &#8211; SS.PP. Varie &#8211; CUP: G77H26000130003 &#8211; CIG: BB79793833</p><p>Periodo: dal 09/11/2026 al 27/11/2026 dalle ore 0:00 alle ore 24 (h 24), sabato e domenica compresi.</p>',
        ),
      ],
      ADESSO,
    );
    expect(a.testo).toBe(
      'Al km 8+650 circa, in comune di Marostica. Periodo: dal 09/11/2026 al 27/11/2026, dalle ore 0:00 alle ore 24. Senso unico alternato. Interventi di consolidamento e messa in sicurezza di scarpate stradali, muri di sostegno e cordoli.',
    );
    expect(a.testo).not.toMatch(/prot\.|\bOM\b|AREA EST|CUP|CIG|SS\.PP\. Varie/i);
  });

  it('se ha solo il riassunto tagliato prima della data, non inventa un periodo e tiene la voce', () => {
    const voce = voceVera(
      'S.P. 72 Fratellanza al km 8+650 circa, in comune di Marostica',
      'Ordinanza per istituzione di senso unico alternato della circolazione stradale. Lavori di potatura. Periodo: dal',
      '',
    );
    const [a]: Avviso[] = filtraViabilita([voce], ADESSO);
    expect(a.testo).toBe('Al km 8+650 circa, in comune di Marostica. Senso unico alternato. Lavori di potatura.');
  });

  it('due ordinanze con lo stesso titolo e periodi diversi restano due', () => {
    const titolo = 'SS.PP. 69, 94 e 52 nei comuni di Marostica e Nove.';
    const voce = (giorno: string, quando: string) => ({
      titolo,
      descrizione: `<p>Ordinanza per l’istituzione di un senso unico alternato della circolazione stradale. Periodo: ${giorno} dalle ore 9:00 alle ore 16:30.</p>`,
      link: '',
      quando,
    });
    const esito: Avviso[] = filtraViabilita(
      [voce('sabato 21/11/2026', '2026-11-10T08:00:00.000Z'), voce('martedì 24/11/2026', '2026-11-09T08:00:00.000Z')],
      ADESSO,
    );
    expect(esito.map((a) => a.testo)).toEqual([
      'Nei comuni di Marostica e Nove. Periodo: sabato 21/11/2026 dalle ore 9:00 alle ore 16:30. Senso unico alternato.',
      'Nei comuni di Marostica e Nove. Periodo: martedì 24/11/2026 dalle ore 9:00 alle ore 16:30. Senso unico alternato.',
    ]);
  });

  it('scarta i comuni fuori zona, le notizie degli uffici e le determine', () => {
    const titoli = tenuti.map((a) => a.testo + a.strada).join(' ');
    expect(titoli).not.toMatch(/Sandrigo|UFFICI|DETERMINA|Thiene/);
  });

  it('scarta le ordinanze più vecchie di 120 giorni', () => {
    // La stessa voce di Rosà (14 maggio) rientra se "adesso" è a giugno.
    const aGiugno: Avviso[] = filtraViabilita(leggiRss(RSS_VIABILITA), new Date('2026-06-01T09:00:00Z'));
    expect(aGiugno.map((a) => a.strada)).toEqual(['S.P. 97 Sant’Anna']);
    expect(aGiugno[0].testo).toBe('Al km 3+300 circa in comune di Rosà. Ordinanza vecchia di sei mesi.');
  });

  it('ne tiene al massimo 10, le più recenti, senza doppioni', () => {
    const tante = Array.from({ length: 14 }, (_, i) => ({
      titolo: `S.P. 248 Schiavonesca Marosticana al km ${i + 1}+000 in comune di Marostica`,
      descrizione: '<p>Senso unico alternato.</p>',
      link: `https://vi-abilita.it/ordinanza-${i}/`,
      quando: new Date(Date.UTC(2026, 10, 1 + i, 8)).toISOString(),
    }));
    const esito: Avviso[] = filtraViabilita([...tante, tante[13]], ADESSO);
    expect(esito).toHaveLength(10);
    expect(esito[0].quando).toBe('2026-11-14T08:00:00.000Z');
    expect(esito[9].quando).toBe('2026-11-05T08:00:00.000Z');
    expect(new Set(esito.map((a) => a.url)).size).toBe(10);
  });

  it('riconosce i comuni solo come parole intere ("Nove" non è "Noventa")', () => {
    const voce = (titolo: string) => ({ titolo, descrizione: '', link: '', quando: '2026-11-10T08:00:00.000Z' });
    const tiene = (titolo: string) => filtraViabilita([voce(titolo)], ADESSO).length === 1;
    expect(tiene('S.P. 247 Riviera Berica dal km 32+625 al km 32+680 circa in comune di Noventa Vicentina.')).toBe(false);
    expect(tiene('SS.PP. 69, 94, 95, 71, 248, 60 e 52 nei comuni di Lusiana Conco, Marostica, Nove, Pozzoleone, Schiavon, Sandrigo e Bressanvido.')).toBe(true);
    expect(tiene('S.P. 75 Volon dal km 3+775 al km 4+266 all’esterno dei centri abitati in comune di Mussolente')).toBe(true);
    expect(tiene('S.P. 54 Friola dal km 0+620 al km 0+660 in comune di Tezze sul Brenta.')).toBe(false);
    // Senza link valido resta la pagina della fonte.
    expect(filtraViabilita([voce('S.P. 148 Cadorna dal km 1+309 al km 2+409 in comune di Romano d’Ezzelino')], ADESSO)[0].url).toBe(
      'https://vi-abilita.it/',
    );
  });
});

describe('nome della strada nelle ordinanze', () => {
  it('prende la parte "S.P. NN Nome" del titolo', () => {
    const prove: [string, string][] = [
      ['S.P. 74 Pedemontana del Grappa dal km 2+454 al km 2+567 in comune di Romano d’Ezzelino.', 'S.P. 74 Pedemontana del Grappa'],
      ['S.P. 52 Bassanese al km 5+650 e la S.P. 131 Santa Teresa al km 2+177, nei comuni di Schiavon e Pozzoleone', 'S.P. 52 Bassanese'],
      ['S.P. 72 Fratellanza al km 8+650 circa, in comune di Marostica', 'S.P. 72 Fratellanza'],
      ['S.P. 51 “Viceré” dal km 11+408 al km 12+385 in comune di Pozzoleone.', 'S.P. 51 Viceré'],
      ['S.P. 148 Cadorna dal km 1+309 al km 2+409, all’esterno del centro abitato, in comune di Romano d’Ezzelino', 'S.P. 148 Cadorna'],
      ['S..P. 27 Tesina dal km 1+883 al km 2+500 circa nei comuni Torri di Quartesolo e Longare.', 'S.P. 27 Tesina'],
      ['SS.PP. 69, 94, 95, 71, 248, 60 e 52, nei comuni di Lusiana Conco, Marostica, Nove e Bressanvido.', 'SS.PP. 69, 94, 95, 71, 248, 60 e 52'],
      ['Chiusura notturna Tunnel Schio-Valdagno Novembre 2026', 'Strade provinciali'],
    ];
    for (const [titolo, attesa] of prove) expect(stradaViabilita(titolo), titolo).toBe(attesa);
  });

  it('nei titoli con molte strade sceglie il pezzo che tocca il bassanese', () => {
    const titolo =
      'S.P. 52 Bassanese dal km 2+200 al km 2+700 nei comuni di Pozzoleone e Sandrigo, S.P. 111 Nuova Gasparona dal km 2+600 al km 3+200 in comune di Thiene, S.P. 248 Schiavonesca Marosticana dal km 27+840 al km 29+100 in comune di Marostica, S.P. 119 Chizzalunga dal km 4+150 al km 4+750 in comune di Breganze';
    expect(trattoDelBassanese(titolo)).toBe('S.P. 248 Schiavonesca Marosticana dal km 27+840 al km 29+100 in comune di Marostica');
    // Se il comune vale per tutte le strade, il titolo resta intero.
    const insieme = 'S.P. 58 Ca’ Dolfin dal km 4+110 al km 4+550 e la S.P. 97 dal km 4+853 al km 4+880 circa in comune di Rosà.';
    expect(trattoDelBassanese(insieme)).toBe(insieme);
    const [a]: Avviso[] = filtraViabilita([{ titolo, descrizione: '', link: '', quando: '2026-11-10T08:00:00.000Z' }], ADESSO);
    expect(a.strada).toBe('S.P. 248 Schiavonesca Marosticana');
    expect(a.testo).toBe('Dal km 27+840 al km 29+100 in comune di Marostica');
  });
});

describe('periodoOrdinanza', () => {
  it('separa che cosa e periodo, e dice quando finiscono i lavori', () => {
    expect(periodoOrdinanza('Senso unico alternato. Per lavori. Periodo: dal 16/11/2026 al 18/12/2026 dalle ore 8:30 alle ore 16:30, esclusi i sabati.')).toEqual({
      cosa: 'Senso unico alternato. Per lavori.',
      periodo: 'dal 16/11/2026 al 18/12/2026, dalle ore 8:30 alle ore 16:30',
      fine: Date.UTC(2026, 11, 19),
    });
    // Le ore scritte con il punto non chiudono la frase.
    expect(periodoOrdinanza('Lavori, Periodo: dal 16/09/2026 al 23/09/2026 dalle ore 8.30 alle ore 18.00').periodo).toBe(
      'dal 16/09/2026 al 23/09/2026, dalle ore 8.30 alle ore 18.00',
    );
    // Altre forme: resta la frase com'è, e vale l'ultimo giorno nominato.
    expect(periodoOrdinanza('Transumanza. Periodo: dalle ore 14:00 di sabato 03/10/2026 alle ore 12:00 di domenica 04/10/2026. Allegato')).toEqual({
      cosa: 'Transumanza.',
      periodo: 'dalle ore 14:00 di sabato 03/10/2026 alle ore 12:00 di domenica 04/10/2026',
      fine: Date.UTC(2026, 9, 5),
    });
  });

  it('senza periodo, o con il periodo tagliato, non inventa nulla', () => {
    expect(periodoOrdinanza('Senso unico alternato.')).toEqual({ cosa: 'Senso unico alternato.', periodo: null, fine: null });
    expect(periodoOrdinanza('Lavori. Periodo: dal…')).toEqual({ cosa: 'Lavori.', periodo: null, fine: null });
    // Tagliato dopo la prima data: la fine non si conosce, l'ordinanza non va scartata.
    expect(periodoOrdinanza('Lavori. Periodo: dal 16/11/2026 al…')).toEqual({ cosa: 'Lavori.', periodo: null, fine: null });
  });
});

describe('quando una fonte non risponde', () => {
  const ordinanza = (strada: string, quando: string): Avviso => ({
    tipo: 'ordinanza',
    strada,
    testo: 'Senso unico alternato.',
    quando,
    fonte: FONTE_VIABILITA.nome,
    url: 'https://vi-abilita.it/prova/',
  });
  const vecchia = {
    generato: '2026-11-14T08:00:00.000Z',
    fonti: [FONTE_CCISS, FONTE_VIABILITA],
    avvisi: [
      { ...ordinanza('SS47 della Valsugana', '2026-11-14T05:00:00.000Z'), tipo: 'evento', fonte: FONTE_CCISS.nome },
      ordinanza('S.P. 75 Volon', '2026-11-11T08:50:25.000Z'),
      ordinanza('S.P. 97 Sant’Anna', '2026-07-01T08:00:00.000Z'),
      { tipo: 'ordinanza', quando: '2026-11-12T08:00:00.000Z' },
      null,
    ],
  };

  it('tiene le ordinanze della fotografia precedente ancora dentro i 120 giorni, mai gli eventi', () => {
    const tenute: Avviso[] = ordinanzePrecedenti(vecchia, ADESSO);
    expect(tenute.map((a) => a.strada)).toEqual(['S.P. 75 Volon']);
    expect(ordinanzePrecedenti(null, ADESSO)).toEqual([]);
    expect(ordinanzePrecedenti({ avvisi: 'rotto' }, ADESSO)).toEqual([]);
  });

  it('considera un errore un feed vuoto o senza nessuna data leggibile', () => {
    expect(() => controllaVoci([])).toThrow(/non contiene voci/);
    expect(() => controllaVoci([{ titolo: 'a', quando: null }, { titolo: 'b', quando: null }])).toThrow(/nessuna con una data leggibile/);
    const buone = [{ titolo: 'a', quando: null }, { titolo: 'b', quando: '2026-11-15T08:00:00.000Z' }];
    expect(controllaVoci(buone)).toBe(buone);
  });
});

describe('unisciAvvisi', () => {
  it('mette insieme le due fonti dalla più recente', () => {
    const tutti: Avviso[] = unisciAvvisi(filtraViabilita(leggiRss(RSS_VIABILITA), A_OTTOBRE), filtraCciss(leggiRss(RSS_CCISS)));
    expect(tutti.map((a) => a.tipo)).toEqual(['evento', 'ordinanza']);
  });
});

describe('nomi delle stazioni', () => {
  it('rende leggibili i nomi scritti in maiuscolo', () => {
    const prove: [string, string][] = [
      ['VENEZIA S.LUCIA', 'Venezia S. Lucia'],
      ['BASSANO DEL GRAPPA', 'Bassano del Grappa'],
      ['VENEZIA MESTRE', 'Venezia Mestre'],
      ["S.DONA' DI PIAVE", 'S. Donà di Piave'],
      ["ROSA'", 'Rosà'],
      ["QUARTO D'ALTINO", "Quarto d'Altino"],
      ["STAZIONE PER L'ALPAGO", "Stazione per l'Alpago"],
      ['PONTE NELLE ALPI POLPET', 'Ponte nelle Alpi Polpet'],
      ['S.PIETRO IN GU', 'S. Pietro in Gu'],
      ['EGNA-TERMENO', 'Egna-Termeno'],
      ['CASTELFRANCO  VENETO ', 'Castelfranco Veneto'],
      ['', ''],
    ];
    for (const [grezzo, atteso] of prove) expect(nomeLeggibile(grezzo), grezzo).toBe(atteso);
  });

  it('legge le righe CSV anche con virgole tra virgolette', () => {
    expect(campiCsv('02520,"BASSANO, DEL ""GRAPPA""",45.76,11.74')).toEqual(['02520', 'BASSANO, DEL "GRAPPA"', '45.76', '11.74']);
  });

  it('da stops.txt tiene solo i codici di sole cifre dentro il Nord-Est', () => {
    const stops = [
      '﻿stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station',
      '02593,VENEZIA S.LUCIA,45.441397,12.320685,1,',
      '02520,BASSANO DEL GRAPPA,45.765556,11.742778,1,',
      '02520:platform:1,BASSANO DEL GRAPPA,45.765556,11.742778,0,02520',
      '08409,ROMA TERMINI,41.900636,12.501997,1,',
      '01700,MILANO CENTRALE,45.486347,9.204528,1,',
      '09999,SENZA COORDINATE,,,1,',
      '',
    ].join('\r\n');
    expect(stazioniDaStops(stops)).toEqual({ '02520': 'Bassano del Grappa', '02593': 'Venezia S. Lucia' });
    expect(() => stazioniDaStops('a,b,c\n1,2,3')).toThrow(/stops\.txt/);
  });
});

// I due file prodotti dagli script, così come sono nel progetto.
describe('file prodotti dagli script', () => {
  const leggi = (nome: string) => JSON.parse(readFileSync(new URL(`../public/data/${nome}`, import.meta.url), 'utf8'));

  it('stazioni-treni.json ha Bassano e Venezia con nomi leggibili', () => {
    const dati = leggi('stazioni-treni.json') as { generato: string; fonte: { nome: string; url: string; licenza: string }; stazioni: Record<string, string> };
    expect(Number.isNaN(Date.parse(dati.generato))).toBe(false);
    expect(dati.fonte.nome).toContain('BusOne (busone.app)');
    expect(dati.stazioni['02520']).toBe('Bassano del Grappa');
    expect(dati.stazioni['02593']).toBe('Venezia S. Lucia');
    for (const [codice, nome] of Object.entries(dati.stazioni)) {
      expect(codice).toMatch(/^\d+$/);
      expect(nome.trim()).toBe(nome);
      expect(nome.length).toBeGreaterThan(1);
      // Nessun nome è rimasto tutto in maiuscolo.
      expect(/\p{Lu}{4,}/u.test(nome), nome).toBe(false);
    }
  });

  it('avvisi.json rispetta il contratto DatiAvvisi e le regole editoriali', () => {
    const dati = leggi('avvisi.json') as DatiAvvisi;
    expect(Number.isNaN(Date.parse(dati.generato))).toBe(false);
    expect(dati.fonti.length).toBeGreaterThan(0);
    const nomi = dati.fonti.map((f) => f.nome);
    for (const f of dati.fonti) {
      expect([FONTE_CCISS.nome, FONTE_VIABILITA.nome]).toContain(f.nome);
      expect(f.url).toMatch(/^https:\/\//);
      expect(f.licenza).toBe('Non dichiarata: citazione breve con link alla fonte');
    }
    const tempi = dati.avvisi.map((a) => Date.parse(a.quando));
    expect([...tempi].sort((a, b) => b - a)).toEqual(tempi);
    expect(dati.avvisi.filter((a) => a.tipo === 'ordinanza').length).toBeLessThanOrEqual(10);
    for (const a of dati.avvisi) {
      expect(['evento', 'ordinanza']).toContain(a.tipo);
      expect(nomi).toContain(a.fonte);
      expect(a.strada.length).toBeGreaterThan(0);
      expect(a.testo.length).toBeGreaterThan(0);
      expect(a.testo.length).toBeLessThanOrEqual(280);
      expect(a.testo, a.testo).not.toMatch(/[<>]|&#?\w+;|[–—]|@/);
      expect(a.url).toMatch(/^https:\/\/(www\.cciss\.it|vi-abilita\.it)\//);
      if (a.attivo !== undefined) {
        expect(a.attivo).toBe(true);
        expect(a.tipo).toBe('evento');
      }
      expect(Number.isNaN(Date.parse(a.quando))).toBe(false);
    }
  });
});
