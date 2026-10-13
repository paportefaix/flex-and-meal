import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dayTotals } from '../../application/dailySummary';
import { addDays, byDate, fmtDate, fmtDay, fmtShort, todayISO } from '../../shared/kernel/dates';
import { round, signed } from '../../shared/kernel/numbers';
import { sessionSets, sessionVolume, weeklyVolume } from '../../training/domain/strength';
import { axisProps, COLORS, tooltipStyle } from '../shared/chart';
import { DaySummary, Stat } from '../shared/DaySummary';
import { useStore } from '../state/store';

export default function Dashboard() {
  const { data } = useStore();
  const today = todayISO();
  const goal = data.settings.kcalGoal;
  const totals = dayTotals(data, today);

  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((date) => ({ date, ...dayTotals(data, date) }));
  const logged = last7.filter((d) => d.hasEntries);
  const avg7 = logged.length ? logged.reduce((s, d) => s + d.intake.kcal, 0) / logged.length : 0;

  const lastSession = [...data.strength].sort((a, b) => b.date.localeCompare(a.date))[0];
  const thisWeek = weeklyVolume(data.strength, today, 1)[0];

  const weights = [...data.weights].sort(byDate);
  const recentWeights = weights.filter((w) => w.date >= addDays(today, -90));
  const last = weights[weights.length - 1];
  const monthAgo = [...weights].reverse().find((w) => w.date <= addDays(today, -30));

  return (
    <>
      <h1 className="capitalize">{fmtDate(today)}</h1>

      <section className="card">
        <div className="card-head">
          <h2>Aujourd'hui</h2>
          <Link to="/journal">Ouvrir le journal →</Link>
        </div>
        <DaySummary intake={totals.intake} burned={totals.burned} goal={goal} settings={data.settings} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>7 derniers jours</h2>
          <Link to="/semaine">Détail →</Link>
        </div>
        <div className="stats">
          <Stat label="Moyenne / jour" value={round(avg7)} />
          <Stat label="Séances de sport" value={last7.reduce((s, d) => s + d.sessions, 0)} unit="" />
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={last7.map((d) => ({ name: fmtDay(d.date), kcal: round(d.intake.kcal) }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} cursor={{ fill: COLORS.grid }} formatter={(v) => [`${v} kcal`, 'Consommées']} />
            <ReferenceLine y={goal} stroke={COLORS.goal} strokeDasharray="4 4" />
            <Bar dataKey="kcal" fill={COLORS.intake} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Musculation</h2>
          <Link to="/muscu">Détail →</Link>
        </div>
        {lastSession ? (
          <div className="stats">
            <Stat label="Séances cette semaine" value={thisWeek.sessions} unit="" />
            <Stat label="Volume cette semaine" value={round(thisWeek.volume / 1000, 1)} unit="t" />
            <Stat
              label={`Dernière séance (${fmtShort(lastSession.date)})`}
              value={round(sessionVolume(lastSession)).toLocaleString('fr-FR')}
              unit={`kg · ${sessionSets(lastSession)} séries`}
            />
          </div>
        ) : (
          <p className="muted">
            Aucune séance importée. <Link to="/muscu">Importer l'export Hevy</Link>
          </p>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Poids</h2>
          <Link to="/corps">Saisir →</Link>
        </div>
        {last ? (
          <>
            <div className="stats">
              <Stat label={`Dernière pesée (${fmtShort(last.date)})`} value={round(last.weight, 1)} unit="kg" />
              {monthAgo && (
                <Stat label="Sur 30 jours" value={signed(last.weight - monthAgo.weight)} unit="kg" tone={last.weight > monthAgo.weight ? 'bad' : 'good'} />
              )}
              {data.settings.targetWeight && <Stat label="Objectif" value={data.settings.targetWeight} unit="kg" />}
            </div>
            {recentWeights.length >= 2 && (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={recentWeights.map((w) => ({ name: fmtShort(w.date), kg: w.weight }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke={COLORS.grid} vertical={false} />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis {...axisProps} domain={['dataMin - 1', 'dataMax + 1']} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [`${v} kg`, 'Poids']} />
                  <Line type="monotone" dataKey="kg" stroke={COLORS.weight} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </>
        ) : (
          <p className="muted">Aucune pesée enregistrée.</p>
        )}
      </section>
    </>
  );
}
