import { useEffect, useState, type FormEvent } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { byDate, fmtShort, todayISO } from '../../shared/kernel/dates';
import { uid } from '../../shared/kernel/id';
import { num, round, signed } from '../../shared/kernel/numbers';
import { axisProps, COLORS, tooltipStyle } from '../../ui/shared/chart';
import { DateField } from '../../ui/shared/DateField';
import { Stat } from '../../ui/shared/DaySummary';
import { useStore } from '../../ui/state/store';
import { type MeasureKey, MEASURES } from '../domain/measurement';
import { BodyDiagram } from './BodyDiagram';

export default function Body() {
  return (
    <>
      <h1>Poids & mensurations</h1>
      <WeightSection />
      <MeasurementsSection />
    </>
  );
}

function WeightSection() {
  const { data, update } = useStore();
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState('');
  const { heightCm, targetWeight } = data.settings;

  const weights = [...data.weights].sort(byDate);
  const first = weights[0];
  const last = weights[weights.length - 1];
  const bmi = last && heightCm ? last.weight / (heightCm / 100) ** 2 : null;

  const existing = data.weights.find((x) => x.date === date)?.weight;
  // Le champ reflète la pesée enregistrée pour la date choisie.
  useEffect(() => setWeight(existing?.toString() ?? ''), [date, existing]);

  // Enregistrement automatique à la validation du champ (sortie du champ ou Entrée).
  const save = () => {
    const w = num(weight);
    if (!(w > 0) || w === existing) return;
    // Une seule pesée par jour : on remplace celle existante.
    update((d) => ({ ...d, weights: [...d.weights.filter((x) => x.date !== date), { id: uid(), date, weight: w }] }));
  };

  const values = weights.map((w) => w.weight).concat(targetWeight ? [targetWeight] : []);

  return (
    <section className="card">
      <h2>Poids</h2>
      {last && (
        <div className="stats">
          <Stat label="Actuel" value={round(last.weight, 1)} unit="kg" />
          <Stat label="Depuis le début" value={signed(last.weight - first.weight)} unit="kg" tone={last.weight > first.weight ? 'bad' : 'good'} />
          {targetWeight && <Stat label="Reste à perdre" value={round(Math.max(0, last.weight - targetWeight), 1)} unit="kg" />}
          {bmi && <Stat label="IMC" value={round(bmi, 1)} unit="" />}
        </div>
      )}

      <form
        className="picker"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save();
        }}
      >
        <DateField value={date} onChange={setDate} required />
        <input className="qty" inputMode="decimal" placeholder="kg" value={weight} onChange={(e) => setWeight(e.target.value)} onBlur={save} />
        <span className="muted small">Enregistré automatiquement</span>
      </form>

      {weights.length >= 2 && (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={weights.map((w) => ({ name: fmtShort(w.date), Poids: w.weight }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} domain={[Math.floor(Math.min(...values) - 1), Math.ceil(Math.max(...values) + 1)]} />
            <Tooltip {...tooltipStyle} formatter={(v) => [`${v} kg`, 'Poids']} />
            {targetWeight && <ReferenceLine y={targetWeight} stroke={COLORS.goal} strokeDasharray="4 4" label={{ value: 'Objectif', fill: COLORS.goal, fontSize: 12, position: 'insideBottomRight' }} />}
            <Line type="monotone" dataKey="Poids" stroke={COLORS.weight} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {weights.length > 0 && (
        <details>
          <summary>Historique ({weights.length})</summary>
          <ul className="items">
            {[...weights].reverse().map((w) => (
              <li key={w.id}>
                <span>{fmtShort(w.date)}</span>
                <span className="num">{w.weight} kg</span>
                <button className="icon" onClick={() => update((d) => ({ ...d, weights: d.weights.filter((x) => x.id !== w.id) }))} aria-label="Supprimer">
                  ×
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function MeasurementsSection() {
  const { data, update } = useStore();
  const [date, setDate] = useState(todayISO());
  const [values, setValues] = useState<Partial<Record<MeasureKey, string>>>({});
  const [selected, setSelected] = useState<MeasureKey>('waist');
  const [focused, setFocused] = useState<MeasureKey | null>(null);

  const entries = [...data.measurements].sort(byDate);

  const entryForDate = entries.find((e) => e.date === date);
  // Les champs reflètent le relevé enregistré pour la date choisie.
  useEffect(() => {
    const v: Partial<Record<MeasureKey, string>> = {};
    for (const m of MEASURES) if (entryForDate?.values[m.key] != null) v[m.key] = String(entryForDate.values[m.key]);
    setValues(v);
  }, [date, entryForDate]);

  // Enregistrement automatique d'une mesure à la sortie du champ.
  const saveField = (key: MeasureKey) => {
    const v = num(values[key] ?? '');
    if (!(v > 0) || v === entryForDate?.values[key]) return;
    update((d) => {
      const existing = d.measurements.find((x) => x.date === date);
      const merged = { id: existing?.id ?? uid(), date, values: { ...existing?.values, [key]: v } };
      return { ...d, measurements: [...d.measurements.filter((x) => x.date !== date), merged] };
    });
  };

  const firstValue = (k: MeasureKey) => entries.find((e) => e.values[k] != null)?.values[k];
  const lastValue = (k: MeasureKey) => [...entries].reverse().find((e) => e.values[k] != null)?.values[k];
  const series = entries.filter((e) => e.values[selected] != null).map((e) => ({ name: fmtShort(e.date), cm: e.values[selected] }));
  const usedKeys = MEASURES.filter((m) => entries.some((e) => e.values[m.key] != null));

  return (
    <section className="card">
      <h2>Mensurations (cm)</h2>

      {usedKeys.length > 0 && (
        <div className="stats">
          {usedKeys.map((m) => {
            const delta = lastValue(m.key)! - firstValue(m.key)!;
            return <Stat key={m.key} label={m.label} value={lastValue(m.key)!} unit={`cm (${signed(delta)})`} tone={delta > 0 ? 'bad' : delta < 0 ? 'good' : undefined} />;
          })}
        </div>
      )}

      <details className="how-to-measure" open>
        <summary>Où prendre les mesures ?</summary>
        <BodyDiagram active={focused} />
      </details>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur(); // déclenche l'enregistrement du champ
        }}
      >
        <div className="grid-form">
          <label className="span2">
            Date
            <DateField value={date} onChange={setDate} required />
          </label>
          {MEASURES.map((m) => (
            <label key={m.key}>
              {m.label}
              <input
                inputMode="decimal"
                placeholder={lastValue(m.key)?.toString() ?? 'cm'}
                value={values[m.key] ?? ''}
                onChange={(e) => setValues({ ...values, [m.key]: e.target.value })}
                onFocus={() => setFocused(m.key)}
                onBlur={() => {
                  setFocused(null);
                  saveField(m.key);
                }}
              />
            </label>
          ))}
        </div>
        <p className="muted small">Chaque mesure est enregistrée automatiquement en quittant le champ.</p>
      </form>

      {usedKeys.length > 0 && (
        <>
          <div className="row wrap chips">
            {usedKeys.map((m) => (
              <button key={m.key} className={selected === m.key ? '' : 'ghost'} onClick={() => setSelected(m.key)}>
                {m.label}
              </button>
            ))}
          </div>
          {series.length >= 2 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${v} cm`, MEASURES.find((m) => m.key === selected)!.label]} />
                <Line type="monotone" dataKey="cm" stroke={COLORS.intake} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted small">Il faut au moins deux relevés pour afficher la courbe.</p>
          )}

          <details>
            <summary>Historique ({entries.length})</summary>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    {usedKeys.map((m) => (
                      <th key={m.key} className="num">
                        {m.label}
                      </th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...entries].reverse().map((e) => (
                    <tr key={e.id}>
                      <td>{fmtShort(e.date)}</td>
                      {usedKeys.map((m) => (
                        <td key={m.key} className="num">
                          {e.values[m.key] ?? '—'}
                        </td>
                      ))}
                      <td className="actions">
                        <button className="icon" onClick={() => update((d) => ({ ...d, measurements: d.measurements.filter((x) => x.id !== e.id) }))} aria-label="Supprimer">
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
