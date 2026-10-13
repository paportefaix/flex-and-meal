import { describe, expect, it } from 'vitest';
import { mergeSessions } from '../domain/session';
import { workSets } from '../domain/strength';
import { fromSharedWorkout, parseWorkoutRefs } from './hevyApi';
import { parseCsv, parseHevyCsv, parseHevyDate } from './hevyCsv';

const CSV = [
  'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
  '"Séance 1","13 Oct 2026, 18:30","13 Oct 2026, 19:35","",Bench Press (Barbell),,,0,warmup,30,10,,,',
  '"Séance 1","13 Oct 2026, 18:30","13 Oct 2026, 19:35","",Bench Press (Barbell),,,1,normal,60,8,,,8',
  '"Séance 1","13 Oct 2026, 18:30","13 Oct 2026, 19:35","",Bench Press (Barbell),,,2,normal,60,6,,,9',
  '"Séance 1","13 Oct 2026, 18:30","13 Oct 2026, 19:35","","Pull Up, Weighted",,,0,normal,0,10,,,',
].join('\n');

describe('import Hevy', () => {
  it('parseCsv gère les guillemets, virgules et guillemets doublés', () => {
    expect(parseCsv('a,"b,c","d ""e"""\n1,2,3')).toEqual([['a', 'b,c', 'd "e"'], ['1', '2', '3']]);
  });

  it('parseHevyDate lit les dates anglaises et françaises', () => {
    expect(parseHevyDate('13 Oct 2026, 18:30')).toEqual(new Date(2026, 9, 13, 18, 30));
    expect(parseHevyDate('3 févr. 2026, 07:05')).toEqual(new Date(2026, 1, 3, 7, 5));
    expect(parseHevyDate('pas une date')).toBeNull();
  });

  it('regroupe les séries par séance puis par exercice', () => {
    const [s, ...rest] = parseHevyCsv(CSV);
    expect(rest).toHaveLength(0);
    expect(s).toMatchObject({ title: 'Séance 1', date: '2026-10-13', minutes: 65 });
    expect(s.exercises.map((e) => e.name)).toEqual(['Bench Press (Barbell)', 'Pull Up, Weighted']);
    expect(s.exercises[0].sets).toEqual([
      { type: 'warmup', weight: 30, reps: 10 },
      { type: 'normal', weight: 60, reps: 8, rpe: 8 },
      { type: 'normal', weight: 60, reps: 6, rpe: 9 },
    ]);
  });

  it('refuse un fichier qui n’est pas un export Hevy', () => {
    expect(() => parseHevyCsv('a,b\n1,2')).toThrow(/Hevy/);
  });

  it('fusionne sans doublon quand on réimporte le même fichier', () => {
    const first = mergeSessions([], parseHevyCsv(CSV));
    const again = mergeSessions(first.sessions, parseHevyCsv(CSV));
    expect(first.added).toBe(1);
    expect(again.added).toBe(0);
    expect(again.sessions).toHaveLength(1);
  });
});


describe('séance partagée Hevy', () => {
  const start = Math.floor(new Date(2026, 9, 13, 18, 30).getTime() / 1000);
  const shared = {
    name: 'Séance 1',
    start_time: start,
    end_time: start + 65 * 60,
    exercises: [
      { title: 'Bench Press (Barbell)', exercise_type: 'weight_reps', sets: [{ indicator: 'normal', weight_kg: 60, reps: 8, rpe: 8 }, { indicator: 'warmup', weight_kg: null, reps: null }] },
      { title: 'Pull Up (Band)', exercise_type: 'bodyweight_assisted_reps', sets: [{ indicator: 'normal', weight_kg: 30, reps: 5 }] },
      { title: 'Plank', exercise_type: 'duration', sets: [{ indicator: 'normal', weight_kg: null, reps: null, duration_seconds: 34 }] },
    ],
  };

  it('produit le même identifiant que l’import CSV pour la même séance', () => {
    const csv = parseHevyCsv(CSV)[0];
    const api = fromSharedWorkout(shared)!;
    expect(api.id).toBe(csv.id);
    expect(api).toMatchObject({ date: '2026-10-13', minutes: 65, title: 'Séance 1' });
    expect(mergeSessions([csv], [api]).sessions).toHaveLength(1);
  });

  it('convertit séries, charge assistée et séries chronométrées', () => {
    const [bench, pullUp, plank] = fromSharedWorkout(shared)!.exercises;
    expect(bench.sets).toEqual([
      { type: 'normal', weight: 60, reps: 8, rpe: 8 },
      { type: 'warmup', weight: 0, reps: 0 },
    ]);
    expect(pullUp.sets[0].weight).toBe(0);
    expect(plank.sets).toEqual([{ type: 'normal', weight: 0, reps: 0, seconds: 34 }]);
    expect(workSets(plank)).toHaveLength(1);
  });

  it('ignore une séance sans date lisible', () => {
    expect(fromSharedWorkout({ start_time: NaN })).toBeNull();
  });

  it('parseWorkoutRefs extrait les identifiants des liens, sans doublon', () => {
    expect(parseWorkoutRefs('https://hevy.com/workout/YnoLPJ4FIz5'+'\n'+'https://hevy.com/workout/AbCdEfGh123 hevy.com/workout/YnoLPJ4FIz5')).toEqual(['YnoLPJ4FIz5', 'AbCdEfGh123']);
    expect(parseWorkoutRefs('YnoLPJ4FIz5')).toEqual(['YnoLPJ4FIz5']);
    expect(parseWorkoutRefs('bonjour')).toEqual([]);
  });
});

