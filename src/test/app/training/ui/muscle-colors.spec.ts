import { describe, expect, it } from 'vitest';
import { MUSCLE_COLORS, fmtDuration, fr, heat, tonnes } from '../../../../app/training/ui/muscle-colors';

describe('muscle-colors', () => {
  it('définit une couleur par groupe musculaire', () => {
    expect(Object.keys(MUSCLE_COLORS)).toEqual(['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Jambes', 'Abdos', 'Autre']);
  });

  it('fr formate à la française avec au plus N décimales', () => {
    expect(fr(1234.56).replace(/\s/g, ' ')).toBe('1 234,6');
    expect(fr(2, 2)).toBe('2');
    expect(fr(2.5)).toBe('2,5');
  });

  it('heat renvoie le fond neutre pour une valeur nulle ou négative', () => {
    expect(heat(0, 10)).toBe('var(--surface-2)');
    expect(heat(-3, 10)).toBe('var(--surface-2)');
  });

  it('heat est proportionnel et plafonné à 100 %', () => {
    expect(heat(5, 10)).toContain('58%');
    expect(heat(10, 10)).toContain('100%');
    expect(heat(50, 10)).toContain('100%');
  });

  it('fmtDuration formate minutes et heures', () => {
    expect(fmtDuration(45)).toBe('45 min');
    expect(fmtDuration(60)).toBe('1 h 00');
    expect(fmtDuration(125)).toBe('2 h 05');
  });

  it('tonnes convertit des kg en tonnes', () => {
    expect(tonnes(12500)).toBe('12,5');
  });
});
