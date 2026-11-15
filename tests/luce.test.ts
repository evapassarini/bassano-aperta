import { describe, expect, it } from 'vitest';
import { altezzaSole, dopoMezzogiornoSolare, luceAdesso } from '../src/luce';

// Fatti noti di Bassano del Grappa (45,77 N, 11,73 E), scritti in ora universale:
// a novembre l'Italia è a UTC+1, a giugno (ora legale) a UTC+2.
const il = (testo: string): Date => new Date(testo);

/** All'alba e al tramonto il centro del sole è poco sotto l'orizzonte (circa -0,8 gradi). */
const ALL_ORIZZONTE = -0.8;
/** Scarto ammesso: la formula è approssimata e gli orari noti sono arrotondati a cinque minuti. */
const SCARTO = 2;

describe('altezza del sole a Bassano', () => {
  it('il 15 novembre tramonta verso le 16:40 e sorge verso le 7:10', () => {
    expect(Math.abs(altezzaSole(il('2026-11-15T15:40:00Z')) - ALL_ORIZZONTE)).toBeLessThan(SCARTO);
    expect(Math.abs(altezzaSole(il('2026-11-15T06:10:00Z')) - ALL_ORIZZONTE)).toBeLessThan(SCARTO);
  });

  it('il 21 giugno sorge verso le 5:25 e tramonta verso le 21:05 (ora legale)', () => {
    expect(Math.abs(altezzaSole(il('2026-06-21T03:25:00Z')) - ALL_ORIZZONTE)).toBeLessThan(SCARTO);
    expect(Math.abs(altezzaSole(il('2026-06-21T19:05:00Z')) - ALL_ORIZZONTE)).toBeLessThan(SCARTO);
  });

  it('a mezzogiorno il sole è alto quanto dice la latitudine', () => {
    // Al solstizio d'estate circa 90 - 45,77 + 23,44 = 67,7 gradi; a quello d'inverno 20,8.
    expect(altezzaSole(il('2026-06-21T11:15:00Z'))).toBeCloseTo(67.7, 0);
    expect(Math.abs(altezzaSole(il('2026-12-21T11:11:00Z')) - 20.8)).toBeLessThan(0.5);
  });

  it('di notte è ben sotto l\'orizzonte', () => {
    expect(altezzaSole(il('2026-11-15T23:00:00Z'))).toBeLessThan(-40);
    expect(altezzaSole(il('2026-06-21T23:00:00Z'))).toBeLessThan(-15);
  });

  it('sa se il sole sta salendo o scendendo', () => {
    expect(dopoMezzogiornoSolare(il('2026-11-15T08:00:00Z'))).toBe(false);
    expect(dopoMezzogiornoSolare(il('2026-11-15T13:00:00Z'))).toBe(true);
    expect(dopoMezzogiornoSolare(il('2026-06-21T09:00:00Z'))).toBe(false);
    expect(dopoMezzogiornoSolare(il('2026-06-21T15:00:00Z'))).toBe(true);
  });
});

describe('luce di questo momento', () => {
  it('mezzogiorno d\'estate è giorno', () => {
    expect(luceAdesso(il('2026-06-21T10:00:00Z'))).toBe('giorno');
    expect(luceAdesso(il('2026-06-21T11:15:00Z'))).toBe('giorno');
  });

  it('la mattina è giorno anche con il sole basso', () => {
    expect(luceAdesso(il('2026-11-15T07:30:00Z'))).toBe('giorno');
    expect(luceAdesso(il('2026-06-21T04:30:00Z'))).toBe('giorno');
  });

  it('le 15 di novembre sono pomeriggio', () => {
    expect(luceAdesso(il('2026-11-15T14:00:00Z'))).toBe('pomeriggio');
  });

  it('a novembre fa notte poco dopo le 17, finito il crepuscolo', () => {
    // Alle 17:00 il sole è a circa -3,7 gradi: è ancora crepuscolo, la soglia è -4.
    expect(luceAdesso(il('2026-11-15T16:00:00Z'))).toBe('pomeriggio');
    expect(luceAdesso(il('2026-11-15T16:10:00Z'))).toBe('notte');
    expect(luceAdesso(il('2026-11-15T16:30:00Z'))).toBe('notte');
    expect(luceAdesso(il('2026-11-15T23:30:00Z'))).toBe('notte');
  });

  it('d\'estate il pomeriggio dura fino a dopo il tramonto, poi è notte', () => {
    expect(luceAdesso(il('2026-06-21T16:00:00Z'))).toBe('giorno');
    expect(luceAdesso(il('2026-06-21T18:00:00Z'))).toBe('pomeriggio');
    expect(luceAdesso(il('2026-06-21T19:05:00Z'))).toBe('pomeriggio');
    expect(luceAdesso(il('2026-06-21T20:00:00Z'))).toBe('notte');
  });

  it('prima dell\'alba è notte, poi giorno, senza passare dal pomeriggio', () => {
    expect(luceAdesso(il('2026-11-15T05:00:00Z'))).toBe('notte');
    expect(luceAdesso(il('2026-11-15T06:10:00Z'))).toBe('giorno');
  });
});
