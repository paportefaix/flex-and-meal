import { type Nutrients, MACROS } from '../../nutrition/domain/nutrients';
import type { Settings } from '../../settings/domain/settings';
import { round } from '../../shared/kernel/numbers';

interface Props {
  intake: Nutrients;
  burned: number;
  goal: number;
  /** Réglages, pour afficher la progression vers les objectifs de macros. */
  settings?: Settings;
}

/** Bilan calorique d'une journée. L'objectif est augmenté des calories brûlées en sport. */
export function DaySummary({ intake, burned, goal, settings }: Props) {
  const budget = goal + burned;
  const remaining = budget - intake.kcal;
  const pct = budget > 0 ? Math.min(100, (intake.kcal / budget) * 100) : 0;
  const over = remaining < 0;

  return (
    <div className="summary">
      <div className="stats">
        <Stat label="Consommées" value={round(intake.kcal)} />
        <Stat label="Sport" value={burned ? `−${round(burned)}` : 0} />
        <Stat label="Objectif" value={goal} />
        <Stat label={over ? 'Dépassement' : 'Restantes'} value={round(Math.abs(remaining))} tone={over ? 'bad' : 'good'} />
      </div>
      <div className="bar" aria-label={`${round(pct)} % du budget`}>
        <div className={over ? 'fill over' : 'fill'} style={{ width: `${pct}%` }} />
      </div>
      {settings && MACROS.some((m) => settings[m.goalKey]) ? (
        <div className="macro-bars">
          {MACROS.map((m) => {
            const target = settings[m.goalKey];
            const value = intake[m.key];
            const pct = target ? Math.min(100, (value / target) * 100) : 0;
            return (
              <div key={m.key} className="macro-bar">
                <div className="macro-bar-head small">
                  <span>{m.label}</span>
                  <span className="muted">
                    {round(value)}
                    {target ? ` / ${target}` : ''} g
                  </span>
                </div>
                <div className="bar" aria-label={`${m.label} : ${round(pct)} % de l'objectif`}>
                  <div className="fill" style={{ width: `${pct}%`, background: m.color }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="macros muted">
          Protéines {round(intake.protein)} g · Glucides {round(intake.carbs)} g · Lipides {round(intake.fat)} g
        </div>
      )}
    </div>
  );
}

export function Stat({ label, value, unit = 'kcal', tone }: { label: string; value: number | string; unit?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value} <small>{unit}</small>
      </div>
    </div>
  );
}
