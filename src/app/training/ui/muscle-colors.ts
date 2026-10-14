import { round } from '../../shared/kernel/numbers';
import type { MuscleGroup } from '../domain/strength';

export const MUSCLE_COLORS: Record<MuscleGroup, string> = {
  Pectoraux: '#4f7cff',
  Dos: '#10b981',
  Épaules: '#f59e0b',
  Biceps: '#a855f7',
  Triceps: '#ec4899',
  Jambes: '#ef4444',
  Abdos: '#14b8a6',
  Autre: '#8a8f98',
};

/** Nombre au format français, `decimals` chiffres au plus. */
export const fr = (n: number, decimals = 1) => round(n, decimals).toLocaleString('fr-FR');

/** Teinte d'accent proportionnelle à `value / max` (0 = fond neutre). */
export const heat = (value: number, max: number) => {
  if (value <= 0) return 'var(--surface-2)';
  const share = Math.min(value / max, 1);
  return `color-mix(in srgb, var(--accent) ${Math.round(15 + share * 85)}%, var(--surface-2))`;
};

export const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export const fmtDuration = (min: number) =>
  min >= 60 ? `${Math.floor(min / 60)} h ${String(round(min % 60)).padStart(2, '0')}` : `${round(min)} min`;

export const tonnes = (kg: number) => fr(kg / 1000, 1);
