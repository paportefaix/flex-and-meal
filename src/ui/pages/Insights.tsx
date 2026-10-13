import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { computeInsights, WEEKDAYS, type DayStatus } from '../../application/insights';
import { MACROS } from '../../nutrition/domain/nutrients';
import { fmtDate, todayISO } from '../../shared/kernel/dates';
import { round } from '../../shared/kernel/numbers';
import { axisProps, COLORS, tooltipStyle } from '../shared/chart';
import { Stat } from '../shared/DaySummary';
import { useStore } from '../state/store';

const STATUS_LABEL: Record<DayStatus, string> = {
  none: 'Non renseigné',
  under: 'Sous la cible',
  on: 'Dans la cible',
  over: 'Au-dessus',
};

export default function Insights() {
  const { data } = useStore();
  const goal = data.settings.kcalGoal;
  const i = computeInsights(data, todayISO());

  if (!data.log.length) {
    return (
      <>
        <h1>Analyses</h1>
        <p className="muted">Renseignez quelques repas dans le <Link to="/journal">journal</Link> pour voir apparaître vos analyses.</p>
      </>
    );
  }

  return (
    <>
      <h1>Analyses</h1>

      <section className="card">
        <h2>À retenir</h2>
        <ul className="notes">
          {i.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <section className="card stats">
        <Stat label="Série en cours" value={i.streak} unit={i.streak > 1 ? 'jours' : 'jour'} />
        <Stat label="Jours renseignés (28 j)" value={i.loggedLast28} unit="/ 28" />
        <Stat label="Dans la cible (28 j)" value={i.onTarget28} unit={`/ ${i.loggedLast28}`} />
        {i.proteinGoal && <Stat label="Protéines atteintes (28 j)" value={i.proteinHit28 ?? 0} unit={`/ ${i.loggedLast28}`} />}
      </section>

      <section className="card">
        <h2>Répartition des macros (moyenne sur 28 jours)</h2>
        {i.split ? (
          <>
            <div className="split-bar" role="img" aria-label="Répartition des calories entre protéines, glucides et lipides">
              {MACROS.map((m) => (
                <div key={m.key} style={{ width: `${i.split![m.key]}%`, background: m.color }} title={`${m.label} ${round(i.split![m.key])} %`} />
              ))}
            </div>
            <div className="legend small">
              {MACROS.map((m) => (
                <span key={m.key}>
                  <i style={{ background: m.color }} /> {m.label} {round(i.split![m.key])} % · {round(i.avg28[m.key])} g / jour
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">Pas assez de données.</p>
        )}
      </section>

      <section className="card">
        <h2>Moyenne par jour de la semaine</h2>
        <p className="muted small">Calories consommées, sur les 12 dernières semaines.</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={i.byWeekday.map((d) => ({ name: d.label.slice(0, 3), kcal: d.kcal }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} cursor={{ fill: COLORS.grid }} formatter={(v) => [`${v} kcal`, 'Moyenne']} />
            <ReferenceLine y={goal} stroke={COLORS.goal} strokeDasharray="4 4" />
            <Bar dataKey="kcal" fill={COLORS.intake} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <h2>Calendrier</h2>
        <p className="muted small">Net (consommées − sport) par rapport à l'objectif, à ±10 %.</p>
        <div className="heatmap scroll-x">
          <div className="heatmap-days small muted">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d[0]}</span>
            ))}
          </div>
          {i.heatmap.map((week) => (
            <div key={week[0].date} className="heatmap-week">
              {week.map((d) => (
                <Link
                  key={d.date}
                  to={`/journal?d=${d.date}`}
                  className={`cell ${d.future ? 'future' : d.status}`}
                  title={`${fmtDate(d.date)} — ${d.future ? '' : STATUS_LABEL[d.status]}`}
                  aria-label={`${fmtDate(d.date)} — ${STATUS_LABEL[d.status]}`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="legend small">
          {(['under', 'on', 'over', 'none'] as DayStatus[]).map((s) => (
            <span key={s}>
              <i className={`cell ${s}`} /> {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </section>

      {i.waist && (
        <section className="card">
          <h2>Tour de taille</h2>
          <div className="stats">
            <Stat label={`Dernière mesure (${fmtDate(i.waist.date, { day: 'numeric', month: 'short' })})`} value={round(i.waist.value, 1)} unit="cm" />
            {i.waist.change !== null && (
              <Stat label="Depuis la première mesure" value={`${i.waist.change > 0 ? '+' : ''}${round(i.waist.change, 1)}`} unit="cm" tone={i.waist.change > 0 ? 'bad' : 'good'} />
            )}
            {i.waist.ratio && <Stat label="Taille / hauteur" value={i.waist.ratio.toFixed(2)} unit="" tone={i.waist.ratio > 0.5 ? 'bad' : 'good'} />}
          </div>
          {!data.settings.heightCm && <p className="muted small">Renseignez votre taille dans les <Link to="/reglages">réglages</Link> pour obtenir le ratio.</p>}
        </section>
      )}
    </>
  );
}
