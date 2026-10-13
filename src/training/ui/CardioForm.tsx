import { useState, type FormEvent } from 'react';
import { weightOn } from '../../body/domain/weight';
import { uid } from '../../shared/kernel/id';
import { num } from '../../shared/kernel/numbers';
import { useStore } from '../../ui/state/store';
import { CARDIO_ACTIVITIES, cardioKcal } from '../domain/energy';

/**
 * Saisie d'une séance de cardio (ou de toute activité) : durée, distance facultative et calories.
 * Les calories laissées vides sont estimées (MET × poids × durée) pour les activités de la liste.
 */
export function CardioForm({ date }: { date: string }) {
  const { data, update } = useStore();
  const [activity, setActivity] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [kcal, setKcal] = useState('');
  const activities = [...new Set([...CARDIO_ACTIVITIES.map((a) => a.name), ...data.workouts.map((w) => w.activity)])];

  const minutes = num(duration);
  const estimate = minutes > 0 ? cardioKcal(activity, minutes, weightOn(data.weights, date)) : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!activity.trim() || !(minutes > 0)) return;
    const km = num(distance);
    const burned = num(kcal) || estimate || 0;
    update((s) => ({
      ...s,
      workouts: [...s.workouts, { id: uid(), date, activity: activity.trim(), duration: minutes, kcal: burned, ...(km > 0 ? { distanceKm: km } : {}) }],
    }));
    setActivity('');
    setDuration('');
    setDistance('');
    setKcal('');
  };

  return (
    <form className="picker" onSubmit={submit}>
      <input list="activities" placeholder="Activité (course, vélo…)" value={activity} onChange={(e) => setActivity(e.target.value)} aria-label="Activité" />
      <datalist id="activities">
        {activities.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>
      <input className="qty" inputMode="decimal" placeholder="min" value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Durée en minutes" />
      <input className="qty" inputMode="decimal" placeholder="km" value={distance} onChange={(e) => setDistance(e.target.value)} aria-label="Distance en kilomètres" />
      <input
        className="qty"
        inputMode="decimal"
        placeholder={estimate ? `~${estimate}` : 'kcal'}
        value={kcal}
        onChange={(e) => setKcal(e.target.value)}
        aria-label="Calories brûlées"
        title={estimate ? 'Estimation automatique si vous laissez vide' : undefined}
      />
      <button>Ajouter</button>
    </form>
  );
}
