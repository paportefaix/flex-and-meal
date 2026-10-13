import { useEffect, useState } from 'react';
import { round } from '../../shared/kernel/numbers';
import { useStore } from '../../ui/state/store';
import type { Food } from '../domain/food';
import { searchLocal, type LocalResult } from '../infrastructure/localSearch';
import { offToFood, searchOpenFoodFacts, type Level, type OffResult } from '../infrastructure/openFoodFacts';

type Source = 'local' | 'online';

const LEVELS: Record<Level, { label: string; cls: string }> = {
  raw: { label: 'Brut', cls: 'raw' },
  processed: { label: 'Transformé', cls: 'processed' },
  ultra: { label: 'Ultra-transformé', cls: 'ultra' },
  unknown: { label: 'Inconnu', cls: 'unknown' },
};

const macros = (f: Food) => `${round(f.kcal)} kcal · P ${f.protein ?? '–'} / G ${f.carbs ?? '–'} / L ${f.fat ?? '–'} (100 g)`;

/** Sans les champs propres à la table CIQUAL. */
const plain = ({ id, name, unit, kcal, protein, carbs, fat }: Food): Food => ({ id, name, unit, kcal, protein, carbs, fat });

/**
 * Recherche d'aliment pour `query` : dans la base locale (mes aliments + CIQUAL)
 * ou sur Open Food Facts (pastille de transformation, marque, filtre « bruts »).
 */
export function FoodSearch({ query, onPick, minLength = 2 }: { query: string; onPick: (food: Food) => void; minLength?: number }) {
  const { data } = useStore();
  const [source, setSource] = useState<Source>('local');
  const [rawOnly, setRawOnly] = useState(false);
  const [local, setLocal] = useState<LocalResult[]>([]);
  const [online, setOnline] = useState<OffResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const q = query.trim();
  const active = q.length >= minLength;

  useEffect(() => {
    if (!active) {
      setLocal([]);
      setOnline([]);
      setError('');
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError('');
    const t = setTimeout(
      async () => {
        try {
          if (source === 'local') setLocal(await searchLocal(q, data.foods));
          else setOnline(await searchOpenFoodFacts(q, ctrl.signal));
        } catch (e) {
          if ((e as DOMException).name === 'AbortError') return;
          setError(source === 'local' ? 'Base CIQUAL indisponible.' : 'Recherche en ligne indisponible, réessayez plus tard.');
        }
        setLoading(false);
      },
      source === 'local' ? 120 : 400,
    );
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, active, source, data.foods]);

  const shownOnline = rawOnly ? online.filter((r) => r.level === 'raw') : online;

  return (
    <div className="food-search">
      <div className="search-bar">
        <div className="segmented" role="group" aria-label="Source de recherche">
          <button type="button" className={source === 'local' ? 'on' : ''} onClick={() => setSource('local')}>
            Ma base + CIQUAL
          </button>
          <button type="button" className={source === 'online' ? 'on' : ''} onClick={() => setSource('online')}>
            Open Food Facts
          </button>
        </div>
        {source === 'online' && (
          <label className="check small">
            <input type="checkbox" checked={rawOnly} onChange={(e) => setRawOnly(e.target.checked)} /> Bruts uniquement
          </label>
        )}
      </div>

      {active && (
        <ul className="off-results">
          {loading && <li className="muted small">Recherche…</li>}
          {error && <li className="muted small">{error}</li>}

          {!loading && !error && source === 'local' && local.length === 0 && <li className="muted small">Aucun résultat.</li>}
          {source === 'local' &&
            local.map(({ food, origin, group }) => (
              <li key={food.id}>
                <button type="button" className="ghost" onClick={() => onPick(plain(food))}>
                  <span>
                    {food.name} <span className={`badge ${origin}`}>{origin === 'perso' ? 'Mes aliments' : 'CIQUAL'}</span>
                  </span>
                  <span className="muted small">
                    {group ? `${group} · ` : ''}
                    {macros(food)}
                  </span>
                </button>
              </li>
            ))}

          {!loading && !error && source === 'online' && shownOnline.length === 0 && (
            <li className="muted small">{online.length ? 'Aucun produit brut dans les résultats.' : 'Aucun résultat sur Open Food Facts.'}</li>
          )}
          {source === 'online' &&
            shownOnline.map((r) => (
              <li key={r.food.id}>
                <button type="button" className="ghost" onClick={() => onPick(offToFood(r))}>
                  <span>
                    {r.food.name} <span className={`badge ${LEVELS[r.level].cls}`}>{LEVELS[r.level].label}</span>
                  </span>
                  <span className="muted small">
                    {r.brand ? `${r.brand} · ` : ''}
                    {macros(r.food)}
                  </span>
                </button>
              </li>
            ))}

          {!loading && source === 'online' && <li className="muted small">Source : Open Food Facts</li>}
          {!loading && source === 'local' && <li className="muted small">Sources : mes aliments, CIQUAL (ANSES)</li>}
        </ul>
      )}
    </div>
  );
}
