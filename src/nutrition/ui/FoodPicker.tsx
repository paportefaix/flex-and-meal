import { useState, type FormEvent } from 'react';
import { num, round } from '../../shared/kernel/numbers';
import { useStore } from '../../ui/state/store';
import type { Food } from '../domain/food';
import { portionNutrients } from '../domain/nutrients';
import { FoodSearch } from './FoodSearch';

/** Sélection d'un aliment (base perso ou Open Food Facts) + quantité. */
export function FoodPicker({ onAdd }: { onAdd: (food: Food, quantity: number) => void }) {
  const { data, update } = useStore();
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [picked, setPicked] = useState<Food | null>(null);

  const food = picked ?? data.foods.find((f) => f.name.toLowerCase() === name.trim().toLowerCase());
  const q = num(qty);
  const valid = !!food && q > 0;

  const choose = (f: Food) => {
    // Enregistré dans la base perso pour pouvoir être référencé (repas types) et réutilisé.
    if (!data.foods.some((x) => x.id === f.id)) update((d) => ({ ...d, foods: [...d.foods, f] }));
    setPicked(f);
    setName(f.name);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onAdd(food, q);
    setName('');
    setQty('');
    setPicked(null);
  };

  return (
    <>
      <form className="picker" onSubmit={submit}>
        <input
          placeholder="Rechercher un aliment…"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setPicked(null);
          }}
        />
        <input
          className="qty"
          inputMode="decimal"
          placeholder={food?.unit ?? 'qté'}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <span className="muted preview">{valid ? `${round(portionNutrients(food, q).kcal)} kcal` : food?.unit ?? ''}</span>
        <button disabled={!valid}>Ajouter</button>
      </form>
      {!picked && <FoodSearch query={name} onPick={choose} />}
    </>
  );
}
