import { toISO } from '../../shared/kernel/dates';
import { hevySessionId, type SetType, type StrengthSession } from '../domain/session';

// Import d'une séance depuis son lien de partage Hevy (https://hevy.com/workout/…).
// La page publique de Hevy lit la séance avec un appel non documenté (GET /workout/<id>) et la clé publique de son site web :
// on fait le même appel. Il n'envoie pas d'en-têtes CORS, d'où le proxy local « /hevy-api » (voir vite.config.ts).

const ENDPOINT = '/hevy-api/workout';
const WEB_KEY = 'shelobs_hevy_web';

interface SharedSet {
  indicator?: string | null;
  weight_kg?: number | null;
  reps?: number | null;
  duration_seconds?: number | null;
  rpe?: number | null;
}

/** Séance telle que la renvoie Hevy (dates en secondes depuis 1970). */
export interface SharedWorkout {
  name?: string | null;
  start_time: number;
  end_time?: number | null;
  exercises?: { title?: string | null; exercise_type?: string | null; sets?: SharedSet[] | null }[] | null;
}

/** Identifiants de séance trouvés dans un texte : liens hevy.com/workout/… ou identifiants seuls, séparés par des espaces ou des retours à la ligne. */
export function parseWorkoutRefs(text: string): string[] {
  const ids = [...text.matchAll(/workout\/([A-Za-z0-9]+)/g)].map((m) => m[1]);
  if (!ids.length) ids.push(...text.split(/[\s,;]+/).filter((t) => /^[A-Za-z0-9]{8,}$/.test(t)));
  return [...new Set(ids)];
}

const SET_TYPES: Record<string, SetType> = { warmup: 'warmup', failure: 'failure', dropset: 'dropset', normal: 'normal' };

/** Convertit une séance Hevy en séance de l'application (ou null si la date est illisible). */
export function fromSharedWorkout(w: SharedWorkout): StrengthSession | null {
  const start = new Date(w.start_time * 1000);
  if (Number.isNaN(start.getTime())) return null;
  const title = (w.name ?? '').trim() || 'Séance';
  return {
    id: hevySessionId(start, title),
    date: toISO(start),
    title,
    minutes: w.end_time && w.end_time > w.start_time ? Math.round((w.end_time - w.start_time) / 60) : undefined,
    exercises: (w.exercises ?? [])
      .filter((e) => e.title)
      .map((e) => {
        // « Assisté » (élastique, machine) : la charge est une aide, pas une charge soulevée.
        const assisted = e.exercise_type === 'bodyweight_assisted_reps';
        return {
          name: e.title as string,
          sets: (e.sets ?? []).map((x) => ({
            type: SET_TYPES[(x.indicator ?? 'normal').toLowerCase()] ?? 'normal',
            weight: assisted ? 0 : (x.weight_kg ?? 0),
            reps: x.reps ?? 0,
            ...(x.duration_seconds ? { seconds: x.duration_seconds } : {}),
            ...(x.rpe != null ? { rpe: x.rpe } : {}),
          })),
        };
      }),
  };
}

/** Télécharge une séance partagée à partir de son identifiant court. */
export async function fetchSharedWorkout(id: string): Promise<StrengthSession> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${encodeURIComponent(id)}`, { headers: { 'x-api-key': WEB_KEY, accept: 'application/json' } });
  } catch {
    throw new Error('Hevy est injoignable. Vérifiez la connexion, et que l’application est lancée avec « npm start » ou « npm run dev » (proxy local).');
  }
  if (res.status === 404) throw new Error(`Séance ${id} introuvable : vérifiez le lien.`);
  if (!res.ok) throw new Error(`Séance ${id} : Hevy a répondu avec l’erreur ${res.status}. Elle est peut-être privée.`);
  const session = fromSharedWorkout((await res.json()) as SharedWorkout);
  if (!session?.exercises.length) throw new Error(`Séance ${id} : aucune donnée lisible (séance privée ?).`);
  return session;
}
