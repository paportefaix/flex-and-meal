import { Link, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dayTotals } from '../../application/dailySummary';
import { MACROS } from '../../nutrition/domain/nutrients';
import { addDays, byDate, fmtDate, fmtDay, startOfWeek, todayISO, weekDays } from '../../shared/kernel/dates';
import { round, signed } from '../../shared/kernel/numbers';
import { sessionVolume } from '../../training/domain/strength';
import { axisProps, COLORS, tooltipStyle } from '../shared/chart';
import { Stat } from '../shared/DaySummary';
import { useStore } from '../state/store';

export default function Week() {
  const { data } = useStore();
  const [params, setParams] = useSearchParams();
  const start = startOfWeek(params.get('w') ?? todayISO());
  const setStart = (w: string) => setParams({ w }, { replace: true });
  const goal = data.settings.kcalGoal;

  const days = weekDays(start).map((date) => ({ date, ...dayTotals(data, date) }));
  const logged = days.filter((d) => d.hasEntries);
  const avg = (f: (d: (typeof days)[number]) => number) => (logged.length ? logged.reduce((s, d) => s + f(d), 0) / logged.length : 0);
  const avgIntake = avg((d) => d.intake.kcal);
  const avgNet = avg((d) => d.net);
  // Écart cumulé à l'objectif sur les jours saisis (négatif = déficit).
  const balance = logged.reduce((s, d) => s + d.net - goal, 0);
  const minutes = days.reduce((s, d) => s + d.minutes, 0);
  const sessions = days.reduce((s, d) => s + d.sessions, 0);
  const strengthSessions = days.flatMap((d) => d.strength);
  const strengthVolume = strengthSessions.reduce((v, x) => v + sessionVolume(x), 0);
  const strengthBurned = days.reduce((v, d) => v + d.strengthBurned, 0);

  const end = addDays(start, 6);
  const weights = data.weights.filter((w) => w.date >= start && w.date <= end).sort(byDate);
  const weightDelta = weights.length >= 2 ? weights[weights.length - 1].weight - weights[0].weight : null;

  const chartData = days.map((d) => ({ name: fmtDay(d.date), Consommées: round(d.intake.kcal), Sport: round(d.burned) }));

  return (
    <>
      <div className="date-nav">
        <button className="ghost" onClick={() => setStart(addDays(start, -7))} aria-label="Semaine précédente">
          ←
        </button>
        <span>
          {fmtDate(start, { day: 'numeric', month: 'short' })} – {fmtDate(end, { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <button className="ghost" onClick={() => setStart(addDays(start, 7))} aria-label="Semaine suivante">
          →
        </button>
        {start !== startOfWeek(todayISO()) && (
          <button className="ghost" onClick={() => setStart(todayISO())}>
            Cette semaine
          </button>
        )}
      </div>
      <h1>Semaine</h1>

      <section className="card stats">
        <Stat label="Moyenne / jour" value={round(avgIntake)} />
        <Stat label="Net moyen / jour" value={round(avgNet)} />
        <Stat label="Bilan vs objectif" value={signed(balance, 0)} tone={balance > 0 ? 'bad' : 'good'} />
        <Stat label="Sport" value={`${sessions} séance${sessions > 1 ? 's' : ''}`} unit={`${minutes} min`} />
        {strengthSessions.length > 0 && (
          <Stat label="Muscu" value={`${strengthSessions.length} séance${strengthSessions.length > 1 ? 's' : ''}`} unit={`${round(strengthVolume / 1000, 1).toLocaleString('fr-FR')} t · ~${round(strengthBurned)} kcal`} />
        )}
        {weightDelta !== null && <Stat label="Poids" value={signed(weightDelta)} unit="kg" tone={weightDelta > 0 ? 'bad' : 'good'} />}
      </section>
      <section className="card">
        <h2>Macros moyens / jour</h2>
        <div className="stats">
          {MACROS.map((m) => {
            const target = data.settings[m.goalKey];
            const value = avg((d) => d.intake[m.key]);
            return (
              <Stat
                key={m.key}
                label={target ? `${m.label} (objectif ${target} g)` : m.label}
                value={round(value)}
                unit="g"
                tone={target && logged.length ? (value >= target * 0.95 && value <= target * 1.1 ? 'good' : 'bad') : undefined}
              />
            );
          })}
        </div>
      </section>
      <p className="muted small">Moyennes calculées sur les {logged.length} jour(s) renseigné(s).</p>

      <section className="card">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} cursor={{ fill: COLORS.grid }} />
            <Legend />
            <ReferenceLine y={goal} stroke={COLORS.goal} strokeDasharray="4 4" label={{ value: 'Objectif', fill: COLORS.goal, fontSize: 12, position: 'insideTopRight' }} />
            <Bar dataKey="Consommées" fill={COLORS.intake} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Sport" fill={COLORS.burned} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <table>
          <thead>
            <tr>
              <th>Jour</th>
              <th className="num">Consommées</th>
              <th className="num">Prot.</th>
              <th className="num">Sport</th>
              <th className="num">Net</th>
              <th className="num">Écart</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <td className="capitalize">
                  <Link to={`/journal?d=${d.date}`}>{fmtDay(d.date)}</Link>
                </td>
                <td className="num">{d.hasEntries ? round(d.intake.kcal) : '—'}</td>
                <td className="num">{d.hasEntries ? `${round(d.intake.protein)} g` : '—'}</td>
                <td className="num">{d.burned ? round(d.burned) : '—'}</td>
                <td className="num">{d.hasEntries ? round(d.net) : '—'}</td>
                <td className={`num ${d.net > goal ? 'bad' : 'good'}`}>{d.hasEntries ? signed(d.net - goal, 0) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
