import { useState, type FormEvent } from 'react';
import { uid } from '../../shared/kernel/id';
import { num, round } from '../../shared/kernel/numbers';
import { useStore } from '../../ui/state/store';
import { type Food, type Unit, unitBasis, UNITS } from '../domain/food';
import { FoodSearch } from './FoodSearch';

type Draft = { name: string; unit: Unit; kcal: string; protein: string; carbs: string; fat: string };
const EMPTY: Draft = { name: '', unit: 'g', kcal: '', protein: '', carbs: '', fat: '' };
const toDraft = (f: Food): Draft => ({
  name: f.name,
  unit: f.unit,
  kcal: String(f.kcal),
  protein: f.protein?.toString() ?? '',
  carbs: f.carbs?.toString() ?? '',
  fat: f.fat?.toString() ?? '',
});
const optional = (s: string) => (s.trim() === '' || isNaN(num(s)) ? undefined : num(s));

export default function Foods() {
  const { data, update } = useStore();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // La recherche est coupée après sélection d'un résultat, et reprend dès que le nom est modifié.
  const [suppressed, setSuppressed] = useState(false);

  const pick = (f: Food) => {
    setSuppressed(true);
    setDraft(toDraft(f));
  };

  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setDraft({ ...draft, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const kcal = num(draft.kcal);
    if (!draft.name.trim() || !(kcal >= 0)) return;
    const food: Food = {
      id: editingId ?? uid(),
      name: draft.name.trim(),
      unit: draft.unit,
      kcal,
      protein: optional(draft.protein),
      carbs: optional(draft.carbs),
      fat: optional(draft.fat),
    };
    update((d) => ({ ...d, foods: editingId ? d.foods.map((f) => (f.id === editingId ? food : f)) : [...d.foods, food] }));
    setDraft(EMPTY);
    setEditingId(null);
  };

  const remove = (food: Food) => {
    const used = data.templates.filter((t) => t.items.some((i) => i.foodId === food.id));
    const msg = used.length
      ? `« ${food.name} » est utilisé dans ${used.length} repas type(s), il en sera retiré. Supprimer ?`
      : `Supprimer « ${food.name} » ?`;
    if (!confirm(msg)) return;
    update((d) => ({
      ...d,
      foods: d.foods.filter((f) => f.id !== food.id),
      templates: d.templates.map((t) => ({ ...t, items: t.items.filter((i) => i.foodId !== food.id) })),
    }));
  };

  const q = search.trim().toLowerCase();
  const foods = data.foods.filter((f) => f.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  return (
    <>
      <h1>Aliments</h1>
      <section className="card">
        <h2>{editingId ? 'Modifier l’aliment' : 'Nouvel aliment'}</h2>
        <form className="grid-form" onSubmit={submit}>
          <label className="span2">
            Nom
            <input
              value={draft.name}
              onChange={(e) => {
                setSuppressed(false);
                set('name')(e);
              }}
              required
              autoComplete="off"
            />
            {!editingId && !suppressed && <FoodSearch query={draft.name} onPick={pick} minLength={3} />}
          </label>
          <label>
            Unité
            <select value={draft.unit} onChange={set('unit')}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {unitBasis(u)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Calories (kcal)
            <input inputMode="decimal" value={draft.kcal} onChange={set('kcal')} required />
          </label>
          <label>
            Protéines (g)
            <input inputMode="decimal" value={draft.protein} onChange={set('protein')} placeholder="optionnel" />
          </label>
          <label>
            Glucides (g)
            <input inputMode="decimal" value={draft.carbs} onChange={set('carbs')} placeholder="optionnel" />
          </label>
          <label>
            Lipides (g)
            <input inputMode="decimal" value={draft.fat} onChange={set('fat')} placeholder="optionnel" />
          </label>
          <div className="row span2">
            <button>{editingId ? 'Enregistrer' : 'Ajouter'}</button>
            {editingId && (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setEditingId(null);
                  setDraft(EMPTY);
                }}
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <input type="search" placeholder="Filtrer…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <table>
          <thead>
            <tr>
              <th>Aliment</th>
              <th className="num">kcal</th>
              <th className="num hide-sm">P / G / L</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {foods.map((f) => (
              <tr key={f.id}>
                <td>
                  {f.name} <span className="muted small">{unitBasis(f.unit)}</span>
                </td>
                <td className="num">{round(f.kcal)}</td>
                <td className="num hide-sm muted">
                  {f.protein ?? '–'} / {f.carbs ?? '–'} / {f.fat ?? '–'}
                </td>
                <td className="actions">
                  <button
                    className="ghost"
                    onClick={() => {
                      setEditingId(f.id);
                      setDraft(toDraft(f));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Modifier
                  </button>
                  <button className="icon" onClick={() => remove(f)} aria-label={`Supprimer ${f.name}`}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
