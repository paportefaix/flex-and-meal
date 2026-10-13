import { toISO } from '../../shared/kernel/dates';
import { normalize } from '../../shared/kernel/text';
import { hevySessionId, type SetType, type StrengthExercise, type StrengthSession, type StrengthSet } from '../domain/session';

// Import de l'export CSV de Hevy.

/** Découpe un CSV en lignes de cellules (guillemets, guillemets doublés et retours à la ligne dans les cellules gérés). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const MONTHS: Record<string, number> = {
  jan: 0, janv: 0, feb: 1, fev: 1, fevr: 1, mar: 2, mars: 2, apr: 3, avr: 3, may: 4, mai: 4, jun: 5, juin: 5,
  jul: 6, juil: 6, aug: 7, aout: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/** Date de début Hevy (« 13 Oct 2026, 18:30 », en français ou en anglais, ou ISO) → date locale. */
export function parseHevyDate(s: string): Date | null {
  const m = /^(\d{1,2})\s+([^\s,\d]+?)\.?,?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/.exec(normalize(s.trim()));
  if (m) {
    const month = MONTHS[m[2]];
    if (month !== undefined) return new Date(+m[3], month, +m[1], +(m[4] ?? 0), +(m[5] ?? 0));
  }
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? null : t;
}

const SET_TYPES: Record<string, SetType> = { warmup: 'warmup', failure: 'failure', dropset: 'dropset', normal: 'normal' };

/**
 * Convertit l'export CSV de Hevy (colonnes title, start_time, end_time, exercise_title, set_type, weight_kg, reps, rpe…)
 * en séances. Les séries sont regroupées par séance (date de début + titre) puis par exercice, dans l'ordre du fichier.
 */
export function parseHevyCsv(text: string): StrengthSession[] {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  if (rows.length < 2) throw new Error('Fichier vide');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => head.indexOf(name);
  const [cTitle, cStart, cEnd, cEx, cType, cWeight, cReps, cRpe, cDur] = ['title', 'start_time', 'end_time', 'exercise_title', 'set_type', 'weight_kg', 'reps', 'rpe', 'duration_seconds'].map(col);
  if (cStart < 0 || cEx < 0 || cWeight < 0 || cReps < 0) {
    throw new Error('Ce fichier ne ressemble pas à un export Hevy (colonnes start_time, exercise_title, weight_kg, reps attendues)');
  }

  const sessions = new Map<string, StrengthSession>();
  for (const r of rows.slice(1)) {
    const start = parseHevyDate(r[cStart] ?? '');
    if (!start) continue;
    const title = (r[cTitle] ?? '').trim() || 'Séance';
    const id = hevySessionId(start, title);
    let session = sessions.get(id);
    if (!session) {
      const end = cEnd >= 0 ? parseHevyDate(r[cEnd] ?? '') : null;
      const minutes = end && end > start ? Math.round((end.getTime() - start.getTime()) / 60000) : undefined;
      session = { id, date: toISO(start), title, minutes, exercises: [] };
      sessions.set(id, session);
    }
    const name = (r[cEx] ?? '').trim();
    if (!name) continue;
    let exercise: StrengthExercise | undefined = session.exercises[session.exercises.length - 1];
    if (exercise?.name !== name) {
      exercise = { name, sets: [] };
      session.exercises.push(exercise);
    }
    const set: StrengthSet = {
      type: SET_TYPES[(r[cType] ?? 'normal').trim().toLowerCase()] ?? 'normal',
      weight: parseFloat(r[cWeight]) || 0,
      reps: parseInt(r[cReps], 10) || 0,
    };
    const seconds = cDur >= 0 ? parseInt(r[cDur], 10) : NaN;
    if (seconds > 0) set.seconds = seconds;
    const rpe = cRpe >= 0 ? parseFloat(r[cRpe]) : NaN;
    if (!Number.isNaN(rpe)) set.rpe = rpe;
    exercise.sets.push(set);
  }
  const list = [...sessions.values()];
  if (!list.length) throw new Error('Aucune séance lisible dans ce fichier');
  return list;
}
