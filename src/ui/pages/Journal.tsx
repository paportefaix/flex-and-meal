import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dayTotals } from '../../application/dailySummary';
import { weightOn } from '../../body/domain/weight';
import type { Food } from '../../nutrition/domain/food';
import { type LogItem, type MealType, MEALS } from '../../nutrition/domain/meal';
import { portionNutrients, sumNutrients } from '../../nutrition/domain/nutrients';
import { FoodPicker } from '../../nutrition/ui/FoodPicker';
import { addDays, fmtDate, todayISO } from '../../shared/kernel/dates';
import { uid } from '../../shared/kernel/id';
import { num, round } from '../../shared/kernel/numbers';
import { strengthKcal, strengthMinutes } from '../../training/domain/energy';
import { sessionSets, sessionVolume } from '../../training/domain/strength';
import { CardioForm } from '../../training/ui/CardioForm';
import { DateField } from '../shared/DateField';
import { DaySummary } from '../shared/DaySummary';
import { useStore } from '../state/store';

export default function Journal() {
  const { data, update } = useStore();
  const [params, setParams] = useSearchParams();
  const date = params.get('d') ?? todayISO();
  const setDate = (d: string) => setParams({ d }, { replace: true });
  const totals = dayTotals(data, date);

  const addItems = (items: Omit<LogItem, 'id' | 'date'>[]) =>
    update((d) => ({ ...d, log: [...d.log, ...items.map((i) => ({ ...i, id: uid(), date }))] }));

  const fromFood = (meal: MealType, food: Food, quantity: number): Omit<LogItem, 'id' | 'date'> => ({
    meal,
    foodId: food.id,
    name: food.name,
    quantity,
    unit: food.unit,
    ...portionNutrients(food, quantity),
  });

  const addTemplate = (meal: MealType, templateId: string) => {
    const tpl = data.templates.find((t) => t.id === templateId);
    if (!tpl) return;
    addItems(
      tpl.items.flatMap((p) => {
        const food = data.foods.find((f) => f.id === p.foodId);
        return food ? [fromFood(meal, food, p.quantity)] : [];
      }),
    );
  };

  const saveAsTemplate = (items: LogItem[]) => {
    const name = prompt('Nom du repas type :');
    if (!name?.trim()) return;
    const portions = items.filter((i) => i.foodId).map((i) => ({ foodId: i.foodId!, quantity: i.quantity }));
    update((d) => ({ ...d, templates: [...d.templates, { id: uid(), name: name.trim(), items: portions }] }));
  };

  const remove = (id: string) => update((d) => ({ ...d, log: d.log.filter((i) => i.id !== id) }));

  return (
    <>
      <div className="date-nav">
        <button className="ghost" onClick={() => setDate(addDays(date, -1))} aria-label="Jour précédent">
          ←
        </button>
        <DateField value={date} onChange={(v) => v && setDate(v)} />
        <button className="ghost" onClick={() => setDate(addDays(date, 1))} aria-label="Jour suivant">
          →
        </button>
        {date !== todayISO() && (
          <button className="ghost" onClick={() => setDate(todayISO())}>
            Aujourd'hui
          </button>
        )}
      </div>
      <h1 className="capitalize">{fmtDate(date)}</h1>

      <section className="card">
        <DaySummary intake={totals.intake} burned={totals.burned} goal={data.settings.kcalGoal} settings={data.settings} />
      </section>

      {MEALS.map((m) => {
        const items = totals.items.filter((i) => i.meal === m.key);
        const kcal = sumNutrients(items).kcal;
        return (
          <section className="card" key={m.key}>
            <div className="card-head">
              <h2>{m.label}</h2>
              <span className="badge">{round(kcal)} kcal</span>
            </div>
            {items.length > 0 && (
              <ul className="items">
                {items.map((i) => (
                  <li key={i.id}>
                    <span>{i.name}</span>
                    <span className="muted">
                      {round(i.quantity, 1)} {i.unit}
                    </span>
                    <span className="num">{round(i.kcal)} kcal</span>
                    <button className="icon" onClick={() => remove(i.id)} aria-label={`Retirer ${i.name}`}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <FoodPicker onAdd={(food, q) => addItems([fromFood(m.key, food, q)])} />
            <div className="row wrap">
              {data.templates.length > 0 && (
                <select value="" onChange={(e) => addTemplate(m.key, e.target.value)}>
                  <option value="">+ Repas type…</option>
                  {data.templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              <QuickAdd onAdd={(name, kcal) => addItems([{ meal: m.key, name, quantity: 1, unit: 'unité', kcal, protein: 0, carbs: 0, fat: 0 }])} />
              {items.some((i) => i.foodId) && (
                <button className="ghost" onClick={() => saveAsTemplate(items)}>
                  Enregistrer comme repas type
                </button>
              )}
            </div>
          </section>
        );
      })}

      <Workouts date={date} />
    </>
  );
}

/** Saisie libre d'un plat dont on ne connaît que les calories (restaurant, etc.). */
function QuickAdd({ onAdd }: { onAdd: (name: string, kcal: number) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');

  if (!open)
    return (
      <button className="ghost" onClick={() => setOpen(true)}>
        + Saisie libre
      </button>
    );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const k = num(kcal);
    if (!name.trim() || !(k >= 0)) return;
    onAdd(name.trim(), k);
    setName('');
    setKcal('');
    setOpen(false);
  };

  return (
    <form className="row" onSubmit={submit}>
      <input autoFocus placeholder="Plat" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="qty" inputMode="decimal" placeholder="kcal" value={kcal} onChange={(e) => setKcal(e.target.value)} />
      <button>OK</button>
      <button type="button" className="ghost" onClick={() => setOpen(false)}>
        Annuler
      </button>
    </form>
  );
}

function Workouts({ date }: { date: string }) {
  const { data, update } = useStore();
  const totals = dayTotals(data, date);
  const { workouts, strength } = totals;

  return (
    <section className="card">
      <div className="card-head">
        <h2>Sport</h2>
        <span className="badge">{round(totals.burned)} kcal brûlées</span>
      </div>
      {(workouts.length > 0 || strength.length > 0) && (
        <ul className="items">
          {strength.map((s) => (
            <li key={s.id}>
              <span>
                Muscu · {s.title} <span className="muted small">({sessionSets(s)} séries, {round(sessionVolume(s)).toLocaleString('fr-FR')} kg)</span>
              </span>
              <span className="muted">{round(strengthMinutes(s))} min</span>
              <span className="num" title="Estimation : MET × poids × durée">~{round(strengthKcal(s, weightOn(data.weights, date)))} kcal</span>
              <span />
            </li>
          ))}
          {workouts.map((w) => (
            <li key={w.id}>
              <span>
                {w.activity}
                {w.distanceKm ? <span className="muted small"> · {round(w.distanceKm, 1).toLocaleString('fr-FR')} km</span> : null}
              </span>
              <span className="muted">{w.duration} min</span>
              <span className="num">{round(w.kcal)} kcal</span>
              <button
                className="icon"
                onClick={() => update((s) => ({ ...s, workouts: s.workouts.filter((x) => x.id !== w.id) }))}
                aria-label={`Retirer ${w.activity}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <CardioForm date={date} />
    </section>
  );
}
