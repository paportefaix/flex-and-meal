import { normalize } from '../../shared/kernel/text';
import type { StrengthSession } from './session';

// Dépense énergétique (MET × poids × durée).

/** Musculation : effort modéré à soutenu, repos entre les séries compris. */
export const MET_STRENGTH = 4;
/** Durée estimée d'une série (effort + repos) quand la séance n'a pas de durée enregistrée. */
const MINUTES_PER_SET = 2.5;

/** Activités de cardio proposées, avec leur MET (Compendium of Physical Activities, allure moyenne). */
export const CARDIO_ACTIVITIES: { name: string; met: number }[] = [
  { name: 'Course à pied', met: 9.8 },
  { name: 'Marche', met: 3.5 },
  { name: 'Marche rapide', met: 4.5 },
  { name: 'Vélo', met: 7.5 },
  { name: 'Vélo d’appartement', met: 7 },
  { name: 'Natation', met: 7 },
  { name: 'Rameur', met: 7 },
  { name: 'Elliptique', met: 5 },
  { name: 'Corde à sauter', met: 11 },
  { name: 'HIIT', met: 8 },
];

export const metKcal = (met: number, weightKg: number, minutes: number) => (met * weightKg * minutes) / 60;

export function strengthMinutes(s: StrengthSession): number {
  if (s.minutes) return s.minutes;
  const sets = s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.reps > 0 || (x.seconds ?? 0) > 0).length, 0);
  return sets * MINUTES_PER_SET;
}

export const strengthKcal = (s: StrengthSession, weightKg: number) => metKcal(MET_STRENGTH, weightKg, strengthMinutes(s));

/** Calories estimées d'une activité de cardio connue, ou null si l'activité n'est pas dans la liste. */
export function cardioKcal(activity: string, minutes: number, weightKg: number): number | null {
  const a = CARDIO_ACTIVITIES.find((x) => normalize(x.name) === normalize(activity.trim()));
  return a ? Math.round(metKcal(a.met, weightKg, minutes)) : null;
}
