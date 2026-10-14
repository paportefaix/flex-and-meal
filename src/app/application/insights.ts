import { type Nutrients, macroSplit, sumNutrients } from '../nutrition/domain/nutrients';
import { addDays, byDate, parseISO, startOfWeek } from '../shared/kernel/dates';
import { round } from '../shared/kernel/numbers';
import type { AppData } from './appData';
import { dayTotals } from './dailySummary';

type Day = { date: string } & ReturnType<typeof dayTotals>;

/** Statut d'une journée par rapport à l'objectif calorique (net = consommées − sport). */
export type DayStatus = 'none' | 'under' | 'on' | 'over';

/** Une journée est « dans la cible » à ±10 % de l'objectif. */
export function dayStatus(d: Day, goal: number): DayStatus {
  if (!d.hasEntries) return 'none';
  if (d.net > goal * 1.1) return 'over';
  if (d.net < goal * 0.9) return 'under';
  return 'on';
}

const days = (data: AppData, end: string, count: number): Day[] =>
  Array.from({ length: count }, (_, i) => addDays(end, i - count + 1)).map((date) => ({ date, ...dayTotals(data, date) }));

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const isWeekend = (date: string) => [0, 6].includes(parseISO(date).getDay());

/** Nombre de jours consécutifs renseignés, en comptant depuis aujourd'hui (ou hier si aujourd'hui est vide). */
function streak(data: AppData, today: string) {
  const logged = new Set(data.log.map((i) => i.date));
  let cursor = logged.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (logged.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
/** Index 0 = lundi. */
const weekdayIndex = (date: string) => (parseISO(date).getDay() + 6) % 7;

export const HEATMAP_WEEKS = 12;

export function computeInsights(data: AppData, today: string) {
  const { settings } = data;
  const goal = settings.kcalGoal;
  const last28 = days(data, today, 28);
  const last7 = last28.slice(-7);
  const logged28 = last28.filter((d) => d.hasEntries);
  const logged7 = last7.filter((d) => d.hasEntries);

  const onTarget7 = logged7.filter((d) => dayStatus(d, goal) === 'on').length;
  const onTarget28 = logged28.filter((d) => dayStatus(d, goal) === 'on').length;

  const proteinGoal = settings.proteinGoal;
  const proteinHit = (list: Day[]) => (proteinGoal ? list.filter((d) => d.intake.protein >= proteinGoal * 0.95).length : null);

  const total28 = sumNutrients(logged28.map((d) => d.intake));
  const n28 = logged28.length || 1;
  const avg28: Nutrients = { kcal: total28.kcal / n28, protein: total28.protein / n28, carbs: total28.carbs / n28, fat: total28.fat / n28 };

  // Moyenne par jour de la semaine, sur les 12 dernières semaines.
  const span = days(data, today, HEATMAP_WEEKS * 7).filter((d) => d.hasEntries);
  const byWeekday = WEEKDAYS.map((label, i) => {
    const v = mean(span.filter((d) => weekdayIndex(d.date) === i).map((d) => d.intake.kcal));
    return { label, kcal: v === null ? null : round(v), count: span.filter((d) => weekdayIndex(d.date) === i).length };
  });

  const weekAvg = mean(logged28.filter((d) => !isWeekend(d.date)).map((d) => d.intake.kcal));
  const weekendAvg = mean(logged28.filter((d) => isWeekend(d.date)).map((d) => d.intake.kcal));
  const weekendGap =
    weekAvg !== null && weekendAvg !== null && logged28.filter((d) => isWeekend(d.date)).length >= 2 ? weekendAvg - weekAvg : null;

  // Calendrier : HEATMAP_WEEKS colonnes (semaines, lundi → dimanche), la dernière étant la semaine en cours.
  const firstMonday = addDays(startOfWeek(today), -(HEATMAP_WEEKS - 1) * 7);
  const heatmap = Array.from({ length: HEATMAP_WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(firstMonday, w * 7 + d);
      const future = date > today;
      return { date, future, status: future ? ('none' as const) : dayStatus({ date, ...dayTotals(data, date) }, goal) };
    }),
  );

  // Tour de taille rapporté à la taille (risque accru au-delà de 0,5).
  const waists = [...data.measurements].filter((m) => m.values.waist).sort(byDate);
  const lastWaist = waists[waists.length - 1];
  const waist = lastWaist
    ? {
        value: lastWaist.values.waist!,
        date: lastWaist.date,
        change: waists.length >= 2 ? lastWaist.values.waist! - waists[0].values.waist! : null,
        ratio: settings.heightCm ? lastWaist.values.waist! / settings.heightCm : null,
      }
    : null;

  const streakDays = streak(data, today);
  const split = macroSplit(avg28);

  // Constats rédigés pour la page « Analyses ».
  const notes: string[] = [];
  if (streakDays >= 3) notes.push(`Série en cours : ${streakDays} jours consécutifs renseignés.`);
  if (logged7.length) notes.push(`Objectif calorique tenu (±10 %) ${onTarget7} jour${onTarget7 > 1 ? 's' : ''} sur ${logged7.length} cette semaine.`);
  if (proteinGoal && logged7.length) {
    notes.push(`Objectif de protéines atteint ${proteinHit(logged7)} jour${proteinHit(logged7)! > 1 ? 's' : ''} sur ${logged7.length} cette semaine.`);
  }
  if (weekendGap !== null && Math.abs(weekendGap) >= 100) {
    notes.push(`Le week-end, vous mangez en moyenne ${round(Math.abs(weekendGap))} kcal de ${weekendGap > 0 ? 'plus' : 'moins'} qu'en semaine.`);
  }
  const busiest = byWeekday.filter((d) => d.kcal !== null && d.count >= 3).sort((a, b) => b.kcal! - a.kcal!)[0];
  if (busiest) notes.push(`Jour le plus calorique : ${busiest.label.toLowerCase()} (${busiest.kcal} kcal en moyenne).`);
  if (split) {
    notes.push(`Sur 28 jours, vos calories viennent à ${round(split.carbs)} % des glucides, ${round(split.fat)} % des lipides et ${round(split.protein)} % des protéines.`);
  }
  if (waist?.ratio) {
    notes.push(
      `Tour de taille / taille : ${waist.ratio.toFixed(2).replace('.', ',')} (${waist.ratio > 0.5 ? 'au-dessus' : 'sous'} le repère de 0,5).`,
    );
  }

  return {
    streak: streakDays,
    loggedLast28: logged28.length,
    loggedLast7: logged7.length,
    onTarget7,
    onTarget28,
    proteinGoal,
    proteinHit7: proteinHit(logged7),
    proteinHit28: proteinHit(logged28),
    avg28,
    split,
    byWeekday,
    heatmap,
    waist,
    notes,
  };
}
