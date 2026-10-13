import { useState } from 'react';
import type { AppData } from '../../application/appData';
import { uid } from '../../shared/kernel/id';
import { num, round } from '../../shared/kernel/numbers';
import { useStore } from '../../ui/state/store';
import type { MealTemplate, Portion } from '../domain/meal';
import { portionNutrients, sumNutrients } from '../domain/nutrients';
import { FoodPicker } from './FoodPicker';

const templateNutrients = (data: AppData, items: Portion[]) =>
  sumNutrients(
    items.flatMap((p) => {
      const food = data.foods.find((f) => f.id === p.foodId);
      return food ? [portionNutrients(food, p.quantity)] : [];
    }),
  );

export default function Templates() {
  const { data, update } = useStore();
  const [draft, setDraft] = useState<MealTemplate | null>(null);

  const save = () => {
    if (!draft || !draft.name.trim()) return;
    const tpl = { ...draft, name: draft.name.trim() };
    update((d) => ({
      ...d,
      templates: d.templates.some((t) => t.id === tpl.id) ? d.templates.map((t) => (t.id === tpl.id ? tpl : t)) : [...d.templates, tpl],
    }));
    setDraft(null);
  };

  const remove = (t: MealTemplate) => {
    if (confirm(`Supprimer le repas type « ${t.name} » ?`)) update((d) => ({ ...d, templates: d.templates.filter((x) => x.id !== t.id) }));
  };

  const setItems = (items: Portion[]) => draft && setDraft({ ...draft, items });

  return (
    <>
      <h1>Repas types</h1>

      {draft ? (
        <section className="card">
          <h2>{data.templates.some((t) => t.id === draft.id) ? 'Modifier le repas type' : 'Nouveau repas type'}</h2>
          <input placeholder="Nom (ex. Petit-déj classique)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
          <ul className="items">
            {draft.items.map((p, idx) => {
              const food = data.foods.find((f) => f.id === p.foodId);
              if (!food) return null;
              return (
                <li key={`${idx}-${p.foodId}`}>
                  <span>{food.name}</span>
                  <span className="row">
                    <input
                      className="qty"
                      inputMode="decimal"
                      defaultValue={p.quantity}
                      onChange={(e) => {
                        const q = num(e.target.value);
                        if (q > 0) setItems(draft.items.map((x, i) => (i === idx ? { ...x, quantity: q } : x)));
                      }}
                    />
                    <span className="muted">{food.unit}</span>
                  </span>
                  <span className="num">{round(portionNutrients(food, p.quantity).kcal)} kcal</span>
                  <button className="icon" onClick={() => setItems(draft.items.filter((_, i) => i !== idx))} aria-label={`Retirer ${food.name}`}>
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
          <FoodPicker onAdd={(food, quantity) => setItems([...draft.items, { foodId: food.id, quantity }])} />
          <div className="card-head">
            <strong>Total : {round(templateNutrients(data, draft.items).kcal)} kcal</strong>
            <span className="row">
              <button className="ghost" onClick={() => setDraft(null)}>
                Annuler
              </button>
              <button onClick={save} disabled={!draft.name.trim() || draft.items.length === 0}>
                Enregistrer
              </button>
            </span>
          </div>
        </section>
      ) : (
        <button onClick={() => setDraft({ id: uid(), name: '', items: [] })}>+ Nouveau repas type</button>
      )}

      {data.templates.length === 0 && !draft && (
        <p className="muted">
          Aucun repas type pour l'instant. Créez-en un ici, ou enregistrez un repas depuis le journal.
        </p>
      )}

      {data.templates.map((t) => {
        const n = templateNutrients(data, t.items);
        return (
          <section className="card" key={t.id}>
            <div className="card-head">
              <h2>{t.name}</h2>
              <span className="badge">{round(n.kcal)} kcal</span>
            </div>
            <p className="muted small">
              {t.items
                .map((p) => {
                  const f = data.foods.find((x) => x.id === p.foodId);
                  return f ? `${f.name} (${round(p.quantity, 1)} ${f.unit})` : null;
                })
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="muted small">
              P {round(n.protein)} g · G {round(n.carbs)} g · L {round(n.fat)} g
            </p>
            <div className="row">
              <button className="ghost" onClick={() => setDraft(structuredClone(t))}>
                Modifier
              </button>
              <button className="ghost danger" onClick={() => remove(t)}>
                Supprimer
              </button>
            </div>
          </section>
        );
      })}
    </>
  );
}
