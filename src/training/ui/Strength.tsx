import { useRef, useState, type FormEvent } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { addDays, fmtShort, startOfWeek, todayISO } from '../../shared/kernel/dates';
import { round, signed } from '../../shared/kernel/numbers';
import { axisProps, COLORS, tooltipStyle } from '../../ui/shared/chart';
import { DateField } from '../../ui/shared/DateField';
import { Stat } from '../../ui/shared/DaySummary';
import { useStore } from '../../ui/state/store';
import { mergeSessions, type StrengthSession } from '../domain/session';
import { exerciseHistory, exerciseNames, MUSCLE_GROUPS, records, repZones, sessionReps, sessionSets, sessionVolume, weeklyVolume } from '../domain/strength';
import { weeklyMuscleLoad } from '../domain/strengthAnalysis';
import { fetchSharedWorkout, parseWorkoutRefs } from '../infrastructure/hevyApi';
import { parseHevyCsv } from '../infrastructure/hevyCsv';
import { CardioForm } from './CardioForm';
import { ConsistencyCard, CrossCard, MUSCLE_COLORS, MuscleLoadCard, TrendsCard } from './StrengthAnalysis';
import { MuscleHeatmap, MuscleMap, SessionsPanel, WeekBanner } from './StrengthViews';

const PERIODS = [
  { weeks: 4, label: '4 semaines' },
  { weeks: 8, label: '8 semaines' },
  { weeks: 26, label: '6 mois' },
] as const;

const tonnes = (kg: number) => `${round(kg / 1000, 1).toLocaleString('fr-FR')}`;
const fmtDuration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(round(min % 60)).padStart(2, '0')}` : `${round(min)} min`);

/** Ajout de séances à partir de leurs liens de partage Hevy (« Partager » → copier le lien). */
function LinkCard() {
  const { data, update } = useStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<{ text: string; error: boolean }[]>([]);
  const ids = parseWorkoutRefs(text);

  async function sync(e: FormEvent) {
    e.preventDefault();
    if (!ids.length || busy) return;
    setBusy(true);
    const out: { text: string; error: boolean }[] = [];
    const fetched: StrengthSession[] = [];
    for (const id of ids) {
      try {
        fetched.push(await fetchSharedWorkout(id));
      } catch (err) {
        out.push({ text: err instanceof Error ? err.message : `Séance ${id} : import impossible`, error: true });
      }
    }
    if (fetched.length) {
      const { sessions, added } = mergeSessions(data.strength, fetched);
      update((d) => ({ ...d, strength: mergeSessions(d.strength, fetched).sessions }));
      out.unshift({
        text: added ? `${added} nouvelle${added > 1 ? 's' : ''} séance${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''} (${sessions.length} au total).` : 'Séance déjà présente : mise à jour effectuée.',
        error: false,
      });
      if (!out.some((m) => m.error)) setText('');
    }
    setMessages(out);
    setBusy(false);
  }

  return (
    <section className="card">
      <h2>Ajouter une séance Hevy</h2>
      <form onSubmit={sync}>
        <textarea
          rows={2}
          placeholder="https://hevy.com/workout/…  (un lien par ligne)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Liens de séances Hevy"
        />
        <div className="row wrap">
          <button disabled={busy || !ids.length}>
            {busy ? 'Synchronisation…' : ids.length > 1 ? `Synchroniser ${ids.length} séances` : 'Synchroniser la séance'}
          </button>
        </div>
      </form>
      {messages.map((m, i) => (
        <p key={i} className={`small ${m.error ? 'bad' : 'good'}`}>
          {m.text}
        </p>
      ))}
      <p className="muted small">Dans Hevy, ouvrez la séance, touchez Partager et copiez le lien. Recoller une séance déjà présente la met à jour sans la dupliquer.</p>
    </section>
  );
}

/** Saisie manuelle du cardio et liste des dernières sorties de la période. */
function CardioCard({ from }: { from: string }) {
  const { data, update } = useStore();
  const [date, setDate] = useState(todayISO());
  const list = data.workouts.filter((w) => w.date >= from).sort((a, b) => b.date.localeCompare(a.date));
  const km = list.reduce((n, w) => n + (w.distanceKm ?? 0), 0);
  const minutes = list.reduce((n, w) => n + w.duration, 0);

  return (
    <section className="card">
      <div className="card-head">
        <h2>Cardio</h2>
        <span className="muted small">
          {list.length} sortie{list.length > 1 ? 's' : ''} · {fmtDuration(minutes)}
          {km > 0 ? ` · ${round(km, 1).toLocaleString('fr-FR')} km` : ''}
        </span>
      </div>
      <div className="row">
        <span className="muted small">Date</span>
        <div style={{ width: '9.5rem' }}>
          <DateField value={date} onChange={setDate} />
        </div>
      </div>
      <CardioForm date={date || todayISO()} />
      <p className="muted small">Calories laissées vides : estimation automatique (MET × poids × durée) pour les activités de la liste.</p>
      {list.length > 0 && (
        <ul className="items">
          {list.slice(0, 10).map((w) => (
            <li key={w.id}>
              <span>
                {w.activity} <span className="muted small">{fmtShort(w.date)}</span>
              </span>
              <span className="muted">
                {w.duration} min{w.distanceKm ? ` · ${round(w.distanceKm, 1).toLocaleString('fr-FR')} km` : ''}
              </span>
              <span className="num">{round(w.kcal)} kcal</span>
              <button className="icon" onClick={() => update((d) => ({ ...d, workouts: d.workouts.filter((x) => x.id !== w.id) }))} aria-label={`Retirer ${w.activity}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Tab = 'overview' | 'progress' | 'muscles' | 'sessions' | 'more';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Aperçu' },
  { key: 'progress', label: 'Progression' },
  { key: 'muscles', label: 'Muscles' },
  { key: 'sessions', label: 'Séances' },
  { key: 'more', label: 'Import & cardio' },
];

function loadTab(): Tab {
  try {
    const saved = sessionStorage.getItem('strength-tab');
    return TABS.some((t) => t.key === saved) ? (saved as Tab) : 'overview';
  } catch {
    return 'overview';
  }
}

/** Point de la courbe de progression : une étoile marque un nouveau record de 1RM estimé. */
function RecordDot(props: { cx?: number; cy?: number; payload?: { record?: boolean } }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined) return <g />;
  return payload?.record ? (
    <text x={cx} y={cy + 5} textAnchor="middle" fontSize={15} style={{ fill: 'var(--pr, #e0a400)' }}>★</text>
  ) : (
    <circle cx={cx} cy={cy} r={3} style={{ fill: COLORS.burned }} />
  );
}

export default function Strength() {
  const { data, update } = useStore();
  const [tab, setTabState] = useState<Tab>(loadTab);
  const [weeks, setWeeks] = useState<number>(8);
  const [exercise, setExercise] = useState<string | null>(null);
  const [volumeBy, setVolumeBy] = useState<'muscle' | 'total'>('muscle');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLElement>(null);

  const setTab = (t: Tab) => {
    setTabState(t);
    try {
      sessionStorage.setItem('strength-tab', t);
    } catch {
      /* stockage indisponible : l'onglet n'est simplement pas mémorisé */
    }
  };

  const today = todayISO();
  const all = [...data.strength].sort((a, b) => a.date.localeCompare(b.date));
  const from = addDays(startOfWeek(today), -7 * (weeks - 1));
  const period = all.filter((s) => s.date >= from);
  const previous = all.filter((s) => s.date >= addDays(from, -7 * weeks) && s.date < from);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const { sessions, added } = mergeSessions(data.strength, parseHevyCsv(await file.text()));
      update((d) => ({ ...d, strength: sessions }));
      setMessage({ text: `${added} nouvelle${added > 1 ? 's' : ''} séance${added > 1 ? 's' : ''} importée${added > 1 ? 's' : ''} (${sessions.length} au total).`, error: false });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Import impossible', error: true });
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  const importer = (
    <>
      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <button onClick={() => fileRef.current?.click()}>Importer le CSV Hevy</button>
    </>
  );

  if (!all.length) {
    return (
      <>
        <h1>Musculation</h1>
        <section className="card">
          <h2>Importer vos séances Hevy</h2>
          <p className="small muted">
            Dans Hevy : Profil → Réglages → Exporter les données, puis choisissez le fichier .csv ici. Vous pouvez réimporter un nouvel export à tout
            moment : les séances déjà présentes ne sont pas dupliquées.
          </p>
          <div className="row">{importer}</div>
          {message && <p className={`small ${message.error ? 'bad' : 'good'}`}>{message.text}</p>}
        </section>
        <LinkCard />
      </>
    );
  }

  const names = exerciseNames(all);
  const selected = exercise && names.includes(exercise) ? exercise : names[0];
  const history = exerciseHistory(all, selected);
  const first = history[0];
  const last = history[history.length - 1];
  const gain = first && last && first.e1rm > 0 ? ((last.e1rm - first.e1rm) / first.e1rm) * 100 : null;
  const bodyweightOnly = history.every((p) => p.maxWeight === 0);
  let bestSoFar = 0;
  const chartData = history.map((p, i) => {
    const record = i > 0 && p.e1rm > bestSoFar;
    bestSoFar = Math.max(bestSoFar, p.e1rm);
    return { name: fmtShort(p.date), '1RM estimé': round(p.e1rm, 1), 'Charge max': p.maxWeight, Volume: round(p.volume), record };
  });

  const sum = (list: StrengthSession[], f: (s: StrengthSession) => number) => list.reduce((n, s) => n + f(s), 0);
  const volume = sum(period, sessionVolume);
  const prevVolume = sum(previous, sessionVolume);
  const sets = sum(period, sessionSets);
  const reps = sum(period, sessionReps);
  const timed = period.filter((s) => s.minutes);
  const minutes = sum(timed, (s) => s.minutes ?? 0);
  const volumeDelta = prevVolume > 0 ? ((volume - prevVolume) / prevVolume) * 100 : null;

  const weekly = weeklyVolume(all, today, weeks);
  const muscleWeeks = weeklyMuscleLoad(all, today, weeks);
  const volumeGroups = MUSCLE_GROUPS.filter((g) => muscleWeeks.some((w) => w.volume[g] > 0));
  const volumeData = weekly.map((w, i) => ({
    name: fmtShort(w.week),
    Volume: round(w.volume),
    ...Object.fromEntries(volumeGroups.map((g) => [g, round(muscleWeeks[i].volume[g])])),
  }));
  const zones = repZones(period);
  const zonesTotal = zones.strength + zones.hypertrophy + zones.endurance;
  const recs = records(all);
  const newRecordSince = addDays(today, -14);

  const showPeriod = tab === 'overview' || tab === 'muscles';

  function selectExercise(name: string) {
    setExercise(name);
    detailRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  return (
    <>
      <div className="card-head">
        <h1>Musculation</h1>
        <div className="row">{importer}</div>
      </div>
      {message && <p className={`small ${message.error ? 'bad' : 'good'}`}>{message.text}</p>}

      <WeekBanner sessions={all} today={today} />

      <div className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.key} role="tab" id={`tab-${t.key}`} aria-selected={tab === t.key} aria-controls="strength-panel" className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {showPeriod && (
        <div className="segmented" role="group" aria-label="Période" style={{ marginBottom: '1rem' }}>
          {PERIODS.map((p) => (
            <button key={p.weeks} className={weeks === p.weeks ? 'on' : ''} aria-pressed={weeks === p.weeks} onClick={() => setWeeks(p.weeks)}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div id="strength-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'overview' && (
          <>
            <section className="card">
              <div className="stats">
                <Stat label="Séances" value={period.length} unit={`${round(period.length / weeks, 1).toLocaleString('fr-FR')} / sem.`} />
                <Stat label="Volume total" value={tonnes(volume)} unit="t" />
                {volumeDelta !== null && <Stat label="Vs période précédente" value={signed(volumeDelta, 0)} unit="%" tone={volumeDelta >= 0 ? 'good' : 'bad'} />}
                <Stat label="Séries de travail" value={sets} unit="" />
                <Stat label="Reps / série" value={sets ? round(reps / sets, 1).toLocaleString('fr-FR') : 0} unit="" />
                <Stat label="Charge moyenne" value={reps ? round(volume / reps, 1).toLocaleString('fr-FR') : 0} unit="kg / rep" />
                {timed.length > 0 && <Stat label="Durée moyenne" value={fmtDuration(minutes / timed.length)} unit="" />}
                {minutes > 0 && <Stat label="Densité" value={round(sum(timed, sessionVolume) / minutes)} unit="kg / min" />}
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <h2>Volume par semaine</h2>
                <div className="segmented" role="group" aria-label="Détail du volume">
                  <button className={volumeBy === 'muscle' ? 'on' : ''} aria-pressed={volumeBy === 'muscle'} onClick={() => setVolumeBy('muscle')}>Par muscle</button>
                  <button className={volumeBy === 'total' ? 'on' : ''} aria-pressed={volumeBy === 'total'} onClick={() => setVolumeBy('total')}>Total</button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={volumeBy === 'muscle' ? 230 : 200}>
                <BarChart data={volumeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke={COLORS.grid} vertical={false} />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip {...tooltipStyle} cursor={{ fill: COLORS.grid }} formatter={(v, n) => [`${v} kg`, n]} labelFormatter={(l) => `Semaine du ${l}`} />
                  {volumeBy === 'muscle' ? (
                    <>
                      <Legend />
                      {volumeGroups.map((g) => (
                        <Bar key={g} dataKey={g} stackId="m" fill={MUSCLE_COLORS[g]} />
                      ))}
                    </>
                  ) : (
                    <Bar dataKey="Volume" fill={COLORS.intake} radius={[4, 4, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </section>

            <MuscleHeatmap sessions={all} today={today} />

            <ConsistencyCard sessions={all} today={today} />
          </>
        )}

        {tab === 'progress' && (
          <>
            <section className="card" ref={detailRef}>
              <div className="card-head">
                <h2>Progression</h2>
                <select value={selected} onChange={(e) => setExercise(e.target.value)} aria-label="Exercice" style={{ width: 'auto', maxWidth: '60%' }}>
                  {names.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
              {last && (
                <div className="stats">
                  {!bodyweightOnly && <Stat label="1RM estimé actuel" value={round(last.e1rm, 1)} unit="kg" />}
                  {!bodyweightOnly && <Stat label="Charge max" value={round(last.maxWeight, 1)} unit="kg" />}
                  {gain !== null && history.length > 1 && <Stat label="Évolution du 1RM" value={signed(gain)} unit="%" tone={gain >= 0 ? 'good' : 'bad'} />}
                  <Stat label="Séances" value={history.length} unit="" />
                </div>
              )}
              {history.length >= 2 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke={COLORS.grid} vertical={false} />
                      <XAxis dataKey="name" {...axisProps} />
                      <YAxis {...axisProps} domain={['dataMin - 5', 'dataMax + 5']} />
                      <Tooltip {...tooltipStyle} />
                      <Legend />
                      {bodyweightOnly ? (
                        <Line type="monotone" dataKey="Volume" stroke={COLORS.burned} strokeWidth={2} />
                      ) : (
                        <>
                          <Line type="monotone" dataKey="1RM estimé" stroke={COLORS.burned} strokeWidth={2} dot={RecordDot} />
                          <Line type="monotone" dataKey="Charge max" stroke={COLORS.weight} strokeWidth={2} dot={false} />
                        </>
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                  {!bodyweightOnly && <p className="muted small">★ : nouveau record de 1RM estimé.</p>}
                </>
              ) : (
                <p className="muted small">Au moins deux séances sont nécessaires pour tracer une courbe.</p>
              )}
            </section>

            <TrendsCard sessions={all} today={today} selected={selected} onSelect={selectExercise} />

            <section className="card">
              <h2>Records personnels</h2>
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Exercice</th>
                      <th className="num">Charge max</th>
                      <th className="num">1RM estimé</th>
                      <th className="num hide-sm">Meilleure série</th>
                      <th className="num hide-sm">Séries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recs.map((r) => (
                      <tr
                        key={r.name}
                        className={`clickable${selected === r.name ? ' selected' : ''}`}
                        tabIndex={0}
                        aria-label={`Voir la progression de ${r.name}`}
                        onClick={() => selectExercise(r.name)}
                        onKeyDown={(e) => e.key === 'Enter' && selectExercise(r.name)}
                      >
                        <td>
                          {r.name}
                          {r.best1RMDate >= newRecordSince && <span className="badge raw">PR</span>}
                        </td>
                        <td className="num">{r.maxWeight ? `${round(r.maxWeight, 1)} kg` : 'PDC'}</td>
                        <td className="num">{r.best1RM ? `${round(r.best1RM, 1)} kg` : '–'}</td>
                        <td className="num hide-sm">{round(r.bestSet)} kg</td>
                        <td className="num hide-sm">{r.sets}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted small">PR : nouveau record de 1RM estimé ces 14 derniers jours. PDC : poids du corps. 1RM estimé = charge × (1 + reps / 30).</p>
            </section>

            <CrossCard data={data} today={today} />
          </>
        )}

        {tab === 'muscles' && (
          <>
            <MuscleMap period={period} weeks={weeks} />

            {zonesTotal > 0 && (
              <section className="card">
                <h2>Plages de répétitions</h2>
                <div className="split-bar" aria-hidden>
                  <span style={{ width: `${(zones.strength / zonesTotal) * 100}%`, background: COLORS.goal }} />
                  <span style={{ width: `${(zones.hypertrophy / zonesTotal) * 100}%`, background: COLORS.intake }} />
                  <span style={{ width: `${(zones.endurance / zonesTotal) * 100}%`, background: COLORS.burned }} />
                </div>
                <div className="legend small">
                  <span><i style={{ background: COLORS.goal }} />Force 1-5 : {round((zones.strength / zonesTotal) * 100)} %</span>
                  <span><i style={{ background: COLORS.intake }} />Hypertrophie 6-12 : {round((zones.hypertrophy / zonesTotal) * 100)} %</span>
                  <span><i style={{ background: COLORS.burned }} />Endurance 13+ : {round((zones.endurance / zonesTotal) * 100)} %</span>
                </div>
              </section>
            )}

            <MuscleLoadCard all={all} period={period} today={today} weeks={weeks} />
          </>
        )}

        {tab === 'sessions' && <SessionsPanel sessions={all} workouts={data.workouts} today={today} />}

        {tab === 'more' && (
          <>
            <LinkCard />
            <CardioCard from={from} />
          </>
        )}
      </div>
    </>
  );
}
