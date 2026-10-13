import { describe, expect, it } from 'vitest';
import { addDays, parseISO, startOfWeek, toISO, weekDays } from './dates';
import { num, round, signed } from './numbers';
import { normalize } from './text';

describe('texte et nombres', () => {
  it('normalize retire accents et casse', () => {
    expect(normalize('Épinards Crûs')).toBe('epinards crus');
  });

  it('num accepte la virgule décimale', () => {
    expect(num('1,5')).toBe(1.5);
    expect(num('2.25')).toBe(2.25);
  });

  it('round arrondit au nombre de décimales demandé', () => {
    expect(round(1.005 * 1000, 0)).toBe(1005);
    expect(round(2.345, 1)).toBe(2.3);
    expect(round(2.5)).toBe(3);
  });

  it('signed préfixe les valeurs positives uniquement', () => {
    expect(signed(1.26)).toBe('+1.3');
    expect(signed(-1.26)).toBe('-1.3');
    expect(signed(0)).toBe('0');
  });
});

describe('dates', () => {
  it('toISO / parseISO font l’aller-retour sans décalage de fuseau', () => {
    expect(toISO(parseISO('2025-03-09'))).toBe('2025-03-09');
    expect(toISO(parseISO('2024-12-31'))).toBe('2024-12-31');
  });

  it('addDays passe les fins de mois, d’année et années bissextiles', () => {
    expect(addDays('2025-01-31', 1)).toBe('2025-02-01');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-03-01', -1)).toBe('2025-02-28');
  });

  it('addDays traverse les changements d’heure', () => {
    expect(addDays('2025-03-29', 2)).toBe('2025-03-31');
    expect(addDays('2025-10-25', 2)).toBe('2025-10-27');
  });

  it('startOfWeek renvoie le lundi (dimanche inclus)', () => {
    expect(startOfWeek('2025-06-11')).toBe('2025-06-09'); // mercredi
    expect(startOfWeek('2025-06-09')).toBe('2025-06-09'); // lundi
    expect(startOfWeek('2025-06-15')).toBe('2025-06-09'); // dimanche
  });

  it('weekDays donne 7 jours consécutifs', () => {
    const w = weekDays('2025-06-09');
    expect(w).toHaveLength(7);
    expect(w[0]).toBe('2025-06-09');
    expect(w[6]).toBe('2025-06-15');
  });
});

