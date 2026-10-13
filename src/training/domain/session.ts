import { toISO } from '../../shared/kernel/dates';

export interface Workout {
  id: string;
  date: string;
  activity: string;
  duration: number;
  kcal: number;
  /** Distance parcourue (cardio), en km. */
  distanceKm?: number;
}

export type SetType = 'normal' | 'warmup' | 'failure' | 'dropset';

export interface StrengthSet {
  type: SetType;
  /** Charge en kg (0 = poids du corps). */
  weight: number;
  reps: number;
  /** Durée en secondes (gainage, exercices chronométrés). */
  seconds?: number;
  rpe?: number;
}

export interface StrengthExercise {
  name: string;
  sets: StrengthSet[];
}

/** Séance de musculation, importée depuis Hevy. */
export interface StrengthSession {
  /** Déterministe (date de début + titre) : réimporter le même entraînement ne crée pas de doublons. */
  id: string;
  date: string;
  title: string;
  minutes?: number;
  exercises: StrengthExercise[];
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Identifiant commun à l'import CSV et à la synchronisation API : le même entraînement ne s'ajoute jamais deux fois. */
export const hevySessionId = (start: Date, title: string) => `hevy:${toISO(start)} ${pad2(start.getHours())}:${pad2(start.getMinutes())}|${title}`;

/** Fusionne des séances importées dans les existantes (même id = remplacement), triées par date. */
export function mergeSessions(existing: StrengthSession[], incoming: StrengthSession[]) {
  const byId = new Map(existing.map((s) => [s.id, s]));
  const added = incoming.filter((s) => !byId.has(s.id)).length;
  for (const s of incoming) byId.set(s.id, s);
  return { sessions: [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)), added };
}
