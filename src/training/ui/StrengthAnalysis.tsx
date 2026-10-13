import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AppData } from '../../application/appData';
import { correlation, crossSummary, crossWeekly, describeCorrelation, forceVerdict } from '../../application/crossAnalysis';
import { fmtDate, fmtShort } from '../../shared/kernel/dates';
import { round, signed } from '../../shared/kernel/numbers';
import { axisProps, COLORS, tooltipStyle } from '../../ui/shared/chart';
import { Stat } from '../../ui/shared/DaySummary';
import type { StrengthSession } from '../domain/session';
import { MUSCLE_GROUPS, weeklyVolume, type MuscleGroup } from '../domain/strength';
import { exerciseTrends, muscleSummary, sessionDensity, sessionHeatmap, weekStreaks, weeklyMuscleLoad, type ExerciseTrend, type TrendStatus } from '../domain/strengthAnalysis';

const fr = (n: number, decimals = 1) => round(n, decimals).toLocaleString('fr-FR');
const pct = (n: number | null) => (n === null ? '–' : `${signed(n, 1).replace('.', ',')} %`);
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export const MUSCLE_COLORS: Record<MuscleGroup, string> = {
  Pectoraux: '#4f7cff',
  Dos: '#10b981',
  Épaules: '#f59e0b',
  Biceps: '#a855f7',
  Triceps: '#ec4899',
  Jambes: '#ef4444',
  Abdos: '#14b8a6',
  Autre: '#8a8f98',
};

// --- 1. Tendances par exercice ---

const STATUS: Record<TrendStatus, { label: string; badge: string }> = {
  up: { label: 'En hausse', badge: 'raw' },
  flat: { label: 'Stable', badge: 'unknown' },
  down: { label: 'En baisse', badge: 'ultra' },
  plateau: { label: 'Plateau', badge: 'processed' },
  new: { label: 'Récent', badge: 'unknown' },
  inactive: { label: 'Inactif', badge: 'unknown' },
};

const SPARK_POINTS = 12;

function Sparkline({ trend }: { trend: ExerciseTrend }) {
  const pts = trend.points.slice(-SPARK_POINTS);
  if (pts.length < 2) return <span className="muted">–</span>;
  const [w, h, pad] = [84, 26, 3];
  const values = pts.map((p) => p.value);
  const [min, max] = [Math.min(...values), Math.max(...values)];
  const x = (i: number) => pad + (i / (pts.length - 1)) * (w - 2 * pad);
  const y = (v: number) => (max === min ? h / 2 : h - pad - ((v - min) / (max - min)) * (h - 2 * pad));
  const stroke = trend.status === 'up' ? 'var(--good)' : trend.status === 'down' ? 'var(--bad)' : 'var(--muted)';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Évolution de ${trend.name} sur ${pts.length} séances`}>
      <polyline points={pts.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" style={{ stroke }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1].value)} r={2.5} style={{ fill: stroke }} />
    </svg>
  );
}

const deltaTone = (d: number | null) => (d === null ? '' : d >= 1.5 ? 'good' : d <= -1.5 ? 'bad' : 'muted');

type TrendFilter = 'active' | 'watch' | 'all';
const FILTERS: { key: TrendFilter; label: string }[] = [
  { key: 'active', label: 'Actifs' },
  { key: 'watch', label: 'À surveiller' },
  { key: 'all', label: 'Tous' },
];
const COLLAPSED_ROWS = 12;

export function TrendsCard({ sessions, today, selected, onSelect }: { sessions: StrengthSession[]; today: string; selected?: string; onSelect?: (name: string) => void }) {
  const [filter, setFilter] = useState<TrendFilter>('active');
  const [expanded, setExpanded] = useState(false);
  const trends = useMemo(() => exerciseTrends(sessions, today), [sessions, today]);
  const active = trends.filter((t) => t.status !== 'inactive');
  const count = (s: TrendStatus) => active.filter((t) => t.status === s).length;
  const list = trends.filter((t) => (filter === 'all' ? true : filter === 'active' ? t.status !== 'inactive' : t.status === 'plateau' || t.status === 'down'));
  const shown = expanded ? list : list.slice(0, COLLAPSED_ROWS);

  return (
    <section className="card">
      <div className="card-head">
        <h2>Tendance par exercice</h2>
        {onSelect && <span className="muted small">Touchez une ligne pour voir sa courbe</span>}
        <div className="segmented" role="group" aria-label="Filtre">
          {FILTERS.map((f) => (
            <button key={f.key} className={filter === f.key ? 'on' : ''} aria-pressed={filter === f.key} onClick={() => { setFilter(f.key); setExpanded(false); }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="stats">
        <Stat label="En hausse" value={count('up')} unit="" tone={count('up') ? 'good' : undefined} />
        <Stat label="Stables" value={count('flat') + count('new')} unit="" />
        <Stat label="Plateaux" value={count('plateau')} unit="" />
        <Stat label="En baisse" value={count('down')} unit="" tone={count('down') ? 'bad' : undefined} />
      </div>
      {shown.length ? (
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Exercice</th>
                <th>Courbe</th>
                <th className="num">Actuel</th>
                <th className="num">4 sem.</th>
                <th className="num hide-sm">12 sem.</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr
                  key={t.name}
                  className={onSelect ? `clickable${selected === t.name ? ' selected' : ''}` : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  aria-label={onSelect ? `Voir la progression de ${t.name}` : undefined}
                  onClick={onSelect && (() => onSelect(t.name))}
                  onKeyDown={onSelect && ((e) => e.key === 'Enter' && onSelect(t.name))}
                >
                  <td>
                    {t.name}
                    <div className="muted small">
                      {t.status === 'plateau'
                        ? `Meilleur il y a ${t.sinceBest} séance${t.sinceBest > 1 ? 's' : ''} (${t.daysSinceBest} j)`
                        : `${t.sessions} séance${t.sessions > 1 ? 's' : ''} · dernière ${fmtShort(t.lastDate)}`}
                    </div>
                  </td>
                  <td><Sparkline trend={t} /></td>
                  <td className="num">{t.unit === 'kg' ? `${fr(t.current)} kg` : `${t.current} rép.`}</td>
                  <td className={`num ${deltaTone(t.delta4)}`}>{pct(t.delta4)}</td>
                  <td className={`num hide-sm ${deltaTone(t.delta12)}`}>{pct(t.delta12)}</td>
                  <td><span className={`badge ${STATUS[t.status].badge}`}>{STATUS[t.status].label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted small">{filter === 'watch' ? 'Aucun plateau ni baisse détectés : bon signe.' : 'Aucun exercice à afficher.'}</p>
      )}
      {list.length > COLLAPSED_ROWS && (
        <button onClick={() => setExpanded(!expanded)} style={{ marginTop: '0.5rem' }}>
          {expanded ? 'Réduire' : `Voir les ${list.length - COLLAPSED_ROWS} autres`}
        </button>
      )}
      <p className="muted small">
        Suivi du meilleur 1RM estimé par séance (répétitions pour les exercices au poids du corps), comparé à la séance connue il y a 4 et 12 semaines. Plateau :
        au moins 4 séances et 3 semaines sans battre le meilleur résultat. Inactif : pas refait depuis plus de 5 semaines. Au moins 3 séances sont nécessaires pour juger une tendance.
      </p>
    </section>
  );
}

// --- 3. Charge par muscle ---

type MuscleMetric = 'sets' | 'volume';

export function MuscleLoadCard({ all, period, today, weeks }: { all: StrengthSession[]; period: StrengthSession[]; today: string; weeks: number }) {
  const [metric, setMetric] = useState<MuscleMetric>('sets');
  const load = useMemo(() => weeklyMuscleLoad(all, today, weeks), [all, today, weeks]);
  const rows = useMemo(() => muscleSummary(period, weeks), [period, weeks]);
  const groups = MUSCLE_GROUPS.filter((g) => load.some((w) => w[metric][g] > 0));
  const rated = load.reduce((n, w) => n + w.ratedSets, 0);
  const hard = load.reduce((n, w) => n + w.hardSets, 0);
  const total = load.reduce((n, w) => n + w.totalSets, 0);

  const stacked = load.map((w) => ({ name: fmtShort(w.week), ...Object.fromEntries(groups.map((g) => [g, round(w[metric][g])])) }));
  const hardData = load.map((w) => ({ name: fmtShort(w.week), 'Séries dures': w.hardSets, 'Autres séries': w.totalSets - w.hardSets }));
  const unit = metric === 'sets' ? 'séries' : 'kg';

  return (
    <section className="card">
      <div className="card-head">
        <h2>Charge par muscle</h2>
        <div className="segmented" role="group" aria-label="Unité">
          <button className={metric === 'sets' ? 'on' : ''} aria-pressed={metric === 'sets'} onClick={() => setMetric('sets')}>Séries</button>
          <button className={metric === 'volume' ? 'on' : ''} aria-pressed={metric === 'volume'} onClick={() => setMetric('volume')}>Tonnage</button>
        </div>
      </div>
      {groups.length ? (
        <ResponsiveContainer width="100%" height={230}>
          <ComposedChart data={stacked} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} cursor={{ fill: COLORS.grid }} formatter={(v, n) => [`${v} ${unit}`, n]} labelFormatter={(l) => `Semaine du ${l}`} />
            <Legend />
            {groups.map((g) => (
              <Bar key={g} dataKey={g} stackId="m" fill={MUSCLE_COLORS[g]} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <p className="muted small">Aucune série sur la période.</p>
      )}

      {rows.length > 0 && (
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Muscle</th>
                <th className="num">Séries / sem.</th>
                <th className="num">Dures / sem.</th>
                <th className="num">Fréquence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.group}>
                  <td><i className="cell" style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 6, background: MUSCLE_COLORS[r.group] }} />{r.group}</td>
                  <td className="num">{fr(r.setsPerWeek)}</td>
                  <td className="num">{rated ? fr(r.hardPerWeek) : '–'}</td>
                  <td className="num">{fr(r.perWeek)} × / sem.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">
        Fréquence : nombre de jours distincts où le muscle est travaillé, par semaine (environ 2 est une recommandation courante). Groupe déduit du nom de l'exercice.
      </p>

      <h2 style={{ marginTop: '1rem' }}>Séries dures par semaine</h2>
      {rated > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={hardData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} cursor={{ fill: COLORS.grid }} labelFormatter={(l) => `Semaine du ${l}`} />
              <Legend />
              <Bar dataKey="Séries dures" stackId="h" fill={COLORS.goal} />
              <Bar dataKey="Autres séries" stackId="h" fill={COLORS.grid} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="muted small">
            {hard} série{hard > 1 ? 's' : ''} dure{hard > 1 ? 's' : ''} sur {total} ({total ? round((hard / total) * 100) : 0} %). Une série dure est menée à l'échec ou notée RPE 8 et plus.
            {rated < total * 0.5 && ' Moins de la moitié de tes séries ont un RPE : le chiffre sous-estime probablement la réalité.'}
          </p>
        </>
      ) : (
        <p className="muted small">Aucun RPE ni série à l'échec dans tes séances. Renseigne le RPE dans Hevy pour suivre les séries dures.</p>
      )}
    </section>
  );
}

// --- 4. Régularité ---

const HEATMAP_WEEKS = 26;
const TREND_WEEKS = 12;

export function ConsistencyCard({ sessions, today }: { sessions: StrengthSession[]; today: string }) {
  const streaks = useMemo(() => weekStreaks(sessions, today), [sessions, today]);
  const heat = useMemo(() => sessionHeatmap(sessions, today, HEATMAP_WEEKS), [sessions, today]);
  const weekly = useMemo(() => weeklyVolume(sessions, today, TREND_WEEKS), [sessions, today]);
  const density = useMemo(() => sessionDensity(sessions).slice(-20), [sessions]);
  const total = weekly.reduce((n, w) => n + w.sessions, 0);
  const activeWeeks = weekly.filter((w) => w.sessions > 0).length;

  return (
    <section className="card">
      <h2>Régularité</h2>
      <div className="stats">
        <Stat label="Série en cours" value={streaks.current} unit={`semaine${streaks.current > 1 ? 's' : ''}`} tone={streaks.current >= 2 ? 'good' : undefined} />
        <Stat label="Record" value={streaks.best} unit={`semaine${streaks.best > 1 ? 's' : ''}`} />
        <Stat label="Séances / semaine" value={fr(total / TREND_WEEKS)} unit={`sur ${TREND_WEEKS} sem.`} />
        <Stat label="Semaines actives" value={`${activeWeeks} / ${TREND_WEEKS}`} unit="" />
      </div>

      <div className="heatmap scroll-x">
        <div className="heatmap-days small muted">
          {WEEKDAYS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        {heat.map((week) => (
          <div key={week[0].date} className="heatmap-week">
            {week.map((d) => (
              <Link
                key={d.date}
                to={`/journal?d=${d.date}`}
                className={`cell ${d.future ? 'future' : d.count >= 2 ? 'lvl2' : d.count === 1 ? 'lvl1' : ''}`}
                title={`${fmtDate(d.date)}${d.future ? '' : ` — ${d.count ? `${d.count} séance${d.count > 1 ? 's' : ''}` : 'repos'}`}`}
                aria-label={`${fmtDate(d.date)} : ${d.count} séance${d.count > 1 ? 's' : ''}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="legend small">
        <span><i className="cell" />Repos</span>
        <span><i className="cell lvl1" />1 séance</span>
        <span><i className="cell lvl2" />2 séances ou plus</span>
      </div>

      <h2 style={{ marginTop: '1rem' }}>Séances par semaine</h2>
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={weekly.map((w) => ({ name: fmtShort(w.week), séances: w.sessions }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="name" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <Tooltip {...tooltipStyle} cursor={{ fill: COLORS.grid }} labelFormatter={(l) => `Semaine du ${l}`} />
          <Bar dataKey="séances" fill={COLORS.weight} radius={[4, 4, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>

      <h2 style={{ marginTop: '1rem' }}>Durée et densité</h2>
      {density.length >= 2 ? (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={density.map((d) => ({ name: fmtShort(d.date), Durée: d.minutes, Densité: round(d.density, 1) }))} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis yAxisId="l" {...axisProps} />
              <YAxis yAxisId="r" orientation="right" {...axisProps} domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip {...tooltipStyle} cursor={{ fill: COLORS.grid }} formatter={(v, n) => [n === 'Durée' ? `${v} min` : `${v} kg/min`, n]} />
              <Legend />
              <Bar yAxisId="l" dataKey="Durée" fill={COLORS.grid} radius={[4, 4, 0, 0]} />
              <Line yAxisId="r" type="monotone" dataKey="Densité" stroke={COLORS.burned} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="muted small">Densité = tonnage de la séance ÷ durée (kg par minute) : plus elle monte à durée égale, plus tu fais de travail dans le même temps. {density.length} dernières séances avec durée.</p>
        </>
      ) : (
        <p className="muted small">Il faut au moins deux séances avec une durée enregistrée.</p>
      )}
    </section>
  );
}

// --- 5. Croisements ---

type CrossView = 'weight' | 'nutrition' | 'waist';
const VIEWS: { key: CrossView; label: string }[] = [
  { key: 'weight', label: 'Poids de corps' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'waist', label: 'Tour de taille' },
];
const CROSS_PERIODS = [
  { weeks: 12, label: '12 semaines' },
  { weeks: 26, label: '6 mois' },
] as const;

function Empty({ children }: { children: string }) {
  return <p className="muted small">{children}</p>;
}

export function CrossCard({ data, today }: { data: AppData; today: string }) {
  const [view, setView] = useState<CrossView>('weight');
  const [weeks, setWeeks] = useState<number>(12);
  const [chosen, setChosen] = useState<string | null>(null);
  const [nutrient, setNutrient] = useState<'protein' | 'kcal'>('protein');

  const lifts = useMemo(() => exerciseTrends(data.strength, today).filter((t) => t.unit === 'kg'), [data.strength, today]);
  const exercise = chosen && lifts.some((l) => l.name === chosen) ? chosen : lifts[0]?.name;
  const rows = useMemo(() => crossWeekly(data, today, weeks, exercise ?? ''), [data, today, weeks, exercise]);
  const summary = useMemo(() => crossSummary(rows), [rows]);
  const label = (w: string) => `Semaine du ${fmtShort(w)}`;
  const chart = { margin: { top: 10, right: 0, left: -10, bottom: 0 } };

  const needsExercise = view !== 'nutrition';
  const select = needsExercise && lifts.length > 0 && (
    <select value={exercise} onChange={(e) => setChosen(e.target.value)} aria-label="Exercice" style={{ width: 'auto', maxWidth: '60%' }}>
      {lifts.map((l) => (
        <option key={l.name}>{l.name}</option>
      ))}
    </select>
  );

  let body;
  if (view === 'weight') {
    const points = rows.filter((r) => r.relative !== null).length;
    const verdict = forceVerdict(summary);
    body = !exercise ? (
      <Empty>Aucun exercice avec charge dans tes séances.</Empty>
    ) : !data.weights.length ? (
      <Empty>Ajoute au moins une pesée (page Corps) pour comparer ta force à ton poids.</Empty>
    ) : points < 2 ? (
      <Empty>Il faut au moins deux semaines avec une séance de cet exercice sur la période.</Empty>
    ) : (
      <>
        <div className="stats">
          <Stat label="1RM estimé" value={pct(summary.e1rmPct)} unit="" tone={summary.e1rmPct === null ? undefined : summary.e1rmPct >= 0 ? 'good' : 'bad'} />
          <Stat label="Force relative" value={pct(summary.relativePct)} unit="" tone={summary.relativePct === null ? undefined : summary.relativePct >= 0 ? 'good' : 'bad'} />
          <Stat label="Poids de corps" value={pct(summary.bodyWeightPct)} unit="" />
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <ComposedChart data={rows.map((r) => ({ week: r.week, 'Force relative': r.relative === null ? null : round(r.relative, 2), Poids: r.bodyWeight === null ? null : round(r.bodyWeight, 1) }))} {...chart}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="week" tickFormatter={fmtShort} {...axisProps} />
            <YAxis yAxisId="l" {...axisProps} domain={['auto', 'auto']} />
            <YAxis yAxisId="r" orientation="right" {...axisProps} domain={['auto', 'auto']} />
            <Tooltip {...tooltipStyle} labelFormatter={label} formatter={(v, n) => [n === 'Poids' ? `${v} kg` : `${v} × poids de corps`, n]} />
            <Legend />
            <Line yAxisId="l" type="monotone" dataKey="Force relative" stroke={COLORS.burned} strokeWidth={2} connectNulls />
            <Line yAxisId="r" type="monotone" dataKey="Poids" stroke={COLORS.weight} strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
        {verdict && <p className="small">{verdict}</p>}
        <p className="muted small">Force relative = meilleur 1RM estimé de la semaine ÷ ton poids de corps à cette date. En sèche ou en prise de masse, elle distingue une vraie perte de force d'un simple changement de poids.</p>
      </>
    );
  } else if (view === 'nutrition') {
    const key = nutrient;
    const usable = rows.filter((r) => r[key] !== null && r.volume > 0);
    const r = correlation(usable.map((x) => [x[key]!, x.volume]));
    const unit = key === 'protein' ? 'g/j' : 'kcal/j';
    body = !rows.some((x) => x[key] !== null) ? (
      <Empty>Il faut au moins 3 jours renseignés dans le journal sur une semaine pour calculer une moyenne.</Empty>
    ) : (
      <>
        <div className="segmented" role="group" aria-label="Donnée nutritionnelle" style={{ marginBottom: '0.5rem' }}>
          <button className={key === 'protein' ? 'on' : ''} aria-pressed={key === 'protein'} onClick={() => setNutrient('protein')}>Protéines</button>
          <button className={key === 'kcal' ? 'on' : ''} aria-pressed={key === 'kcal'} onClick={() => setNutrient('kcal')}>Calories</button>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <ComposedChart data={rows.map((x) => ({ week: x.week, Volume: round(x.volume), Apport: x[key] === null ? null : round(x[key]!) }))} {...chart}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="week" tickFormatter={fmtShort} {...axisProps} />
            <YAxis yAxisId="l" {...axisProps} />
            <YAxis yAxisId="r" orientation="right" {...axisProps} domain={['auto', 'auto']} />
            <Tooltip {...tooltipStyle} cursor={{ fill: COLORS.grid }} labelFormatter={label} formatter={(v, n) => [n === 'Volume' ? `${v} kg` : `${v} ${unit}`, n === 'Apport' ? (key === 'protein' ? 'Protéines' : 'Calories') : n]} />
            <Legend formatter={(n) => (n === 'Apport' ? (key === 'protein' ? 'Protéines (moy./jour)' : 'Calories (moy./jour)') : 'Volume hebdo (kg)')} />
            <Bar yAxisId="l" dataKey="Volume" fill={COLORS.intake} radius={[4, 4, 0, 0]} />
            <Line yAxisId="r" type="monotone" dataKey="Apport" stroke={COLORS.burned} strokeWidth={2} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="small">
          {r === null
            ? `Pas encore assez de semaines complètes pour une corrélation (${usable.length} sur 6 minimum, avec séances et au moins 3 jours de journal).`
            : `Sur ${usable.length} semaines, lien ${describeCorrelation(r)} entre ${key === 'protein' ? 'tes protéines' : 'tes calories'} et ton volume (r = ${fr(r, 2)}).`}
        </p>
        <p className="muted small">Une corrélation n'est pas une causalité : une semaine chargée peut aussi te faire manger plus. Moyennes calculées sur les jours renseignés, pour les semaines avec au moins 3 jours de journal.</p>
      </>
    );
  } else {
    const waistPoints = rows.filter((r) => r.waist !== null).length;
    const d = summary.waistDelta;
    const note =
      d === null || summary.e1rmPct === null
        ? null
        : d <= -0.5 && summary.e1rmPct >= 0
          ? 'Le tour de taille baisse pendant que la force se maintient ou progresse : signe de recomposition.'
          : d >= 0.5 && summary.e1rmPct >= 2
            ? 'Taille et force montent ensemble : cohérent avec une prise de masse.'
            : null;
    body = !exercise ? (
      <Empty>Aucun exercice avec charge dans tes séances.</Empty>
    ) : waistPoints < 2 ? (
      <Empty>Il faut au moins deux mensurations de tour de taille (page Corps) sur la période.</Empty>
    ) : (
      <>
        <div className="stats">
          <Stat label="Tour de taille" value={d === null ? '–' : `${signed(d, 1).replace('.', ',')}`} unit="cm" tone={d === null ? undefined : d <= 0 ? 'good' : 'bad'} />
          <Stat label="1RM estimé" value={pct(summary.e1rmPct)} unit="" tone={summary.e1rmPct === null ? undefined : summary.e1rmPct >= 0 ? 'good' : 'bad'} />
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <ComposedChart data={rows.map((r) => ({ week: r.week, '1RM estimé': r.e1rm === null ? null : round(r.e1rm, 1), Taille: r.waist === null ? null : round(r.waist, 1) }))} {...chart}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="week" tickFormatter={fmtShort} {...axisProps} />
            <YAxis yAxisId="l" {...axisProps} domain={['auto', 'auto']} />
            <YAxis yAxisId="r" orientation="right" {...axisProps} domain={['auto', 'auto']} />
            <Tooltip {...tooltipStyle} labelFormatter={label} formatter={(v, n) => [n === 'Taille' ? `${v} cm` : `${v} kg`, n]} />
            <Legend />
            <Line yAxisId="l" type="monotone" dataKey="1RM estimé" stroke={COLORS.burned} strokeWidth={2} connectNulls />
            <Line yAxisId="r" type="monotone" dataKey="Taille" stroke={COLORS.weight} strokeWidth={2} strokeDasharray="4 3" connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
        {note && <p className="small">{note}</p>}
        <p className="muted small">Les mensurations sont ponctuelles : les points sont reliés entre deux relevés.</p>
      </>
    );
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>Croisements</h2>
        {select}
      </div>
      <div className="row wrap">
        <div className="segmented" role="group" aria-label="Croisement">
          {VIEWS.map((v) => (
            <button key={v.key} className={view === v.key ? 'on' : ''} aria-pressed={view === v.key} onClick={() => setView(v.key)}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Période du croisement">
          {CROSS_PERIODS.map((p) => (
            <button key={p.weeks} className={weeks === p.weeks ? 'on' : ''} aria-pressed={weeks === p.weeks} onClick={() => setWeeks(p.weeks)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: '0.75rem' }}>{body}</div>
    </section>
  );
}
