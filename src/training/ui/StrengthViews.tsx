import { useMemo, useState, type ReactNode } from 'react';
import { addDays, fmtDate, fmtShort, startOfWeek, toISO } from '../../shared/kernel/dates';
import { round, signed } from '../../shared/kernel/numbers';
import type { StrengthSession, Workout } from '../domain/session';
import { MUSCLE_GROUPS, estimate1RM, muscleOf, records, sessionSets, sessionVolume, setVolume, weeklyVolume, workSets, type MuscleGroup } from '../domain/strength';
import { muscleSummary, weekStreaks, weeklyMuscleLoad } from '../domain/strengthAnalysis';
import { MUSCLE_COLORS } from './StrengthAnalysis';

const fr = (n: number, decimals = 1) => round(n, decimals).toLocaleString('fr-FR');
const tonnes = (kg: number) => fr(kg / 1000, 1);
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtDuration = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${pad2(round(min % 60))}` : `${round(min)} min`);

/** Teinte d'accent proportionnelle à `value / max` (0 = fond neutre). */
const heat = (value: number, max: number) => {
  if (value <= 0) return 'var(--surface-2)';
  const share = Math.min(value / max, 1);
  return `color-mix(in srgb, var(--accent) ${Math.round(15 + share * 85)}%, var(--surface-2))`;
};

// --- Bandeau « Cette semaine » ---

export function WeekBanner({ sessions, today }: { sessions: StrengthSession[]; today: string }) {
  const thisWeek = startOfWeek(today);
  const weekly = useMemo(() => weeklyVolume(sessions, today, 9), [sessions, today]);
  const streaks = useMemo(() => weekStreaks(sessions, today), [sessions, today]);
  const lastPR = useMemo(() => records(sessions).filter((r) => r.best1RM > 0).sort((a, b) => b.best1RMDate.localeCompare(a.best1RMDate))[0], [sessions]);

  const cur = weekly[weekly.length - 1];
  const prev = weekly[weekly.length - 2];
  const usual = weekly.slice(0, -1).filter((w) => w.sessions > 0);
  const target = usual.length ? Math.max(1, Math.round(usual.reduce((n, w) => n + w.sessions, 0) / usual.length)) : null;
  const volumeDelta = prev.volume > 0 ? ((cur.volume - prev.volume) / prev.volume) * 100 : null;
  const dots = Math.max(target ?? 0, cur.sessions);

  return (
    <section className="card" aria-label="Cette semaine">
      <div className="card-head">
        <h2>Cette semaine</h2>
        <span className="muted small">
          {fmtShort(thisWeek)} – {fmtShort(addDays(thisWeek, 6))}
        </span>
      </div>
      <div className="week-kpis">
        <div className="kpi">
          <span className="kpi-label">Séances</span>
          <span className="kpi-value">
            {cur.sessions}
            {target !== null && <small> / {target}</small>}
          </span>
          {dots > 0 && dots <= 7 ? (
            <span className="dots" aria-hidden>
              {Array.from({ length: dots }, (_, i) => (
                <i key={i} className={i < cur.sessions ? 'on' : ''} />
              ))}
            </span>
          ) : null}
          {target !== null && <span className="muted small">habituel : {target} / sem.</span>}
        </div>
        <div className="kpi">
          <span className="kpi-label">Volume</span>
          <span className="kpi-value">
            {tonnes(cur.volume)}
            <small> t</small>
          </span>
          <span className={`small ${volumeDelta === null ? 'muted' : volumeDelta >= 0 ? 'good' : 'bad'}`}>
            {volumeDelta === null ? 'Pas de semaine précédente' : `${volumeDelta >= 0 ? '▲' : '▼'} ${signed(volumeDelta, 0)} % vs sem. dernière`}
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Dernier record</span>
          {lastPR ? (
            <>
              <span className="kpi-value kpi-text">{lastPR.name}</span>
              <span className="small">
                <span className="badge raw" style={{ marginLeft: 0 }}>PR</span> 1RM ≈ {fr(lastPR.best1RM)} kg · {fmtShort(lastPR.best1RMDate)}
              </span>
            </>
          ) : (
            <span className="muted small">Aucun pour l'instant</span>
          )}
        </div>
        <div className="kpi">
          <span className="kpi-label">Régularité</span>
          <span className="kpi-value">
            {streaks.current}
            <small> sem.</small>
          </span>
          <span className="muted small">de suite · record {streaks.best}</span>
        </div>
      </div>
    </section>
  );
}

// --- Heatmap muscle × semaine ---

export function MuscleHeatmap({ sessions, today, weeks = 8 }: { sessions: StrengthSession[]; today: string; weeks?: number }) {
  const load = useMemo(() => weeklyMuscleLoad(sessions, today, weeks), [sessions, today, weeks]);
  const groups = MUSCLE_GROUPS.filter((g) => load.some((w) => w.sets[g] > 0));
  if (!groups.length) return null;
  const max = Math.max(20, ...groups.flatMap((g) => load.map((w) => w.sets[g])));

  return (
    <section className="card">
      <div className="card-head">
        <h2>Séries par muscle et par semaine</h2>
        <span className="muted small">{weeks} dernières semaines</span>
      </div>
      <div className="scroll-x">
        <div className="mheat" style={{ gridTemplateColumns: `5.5rem repeat(${weeks}, minmax(1.6rem, 1fr)) 3rem` }}>
          <span />
          {load.map((w) => (
            <span key={w.week} className="mheat-col">{fmtShort(w.week)}</span>
          ))}
          <span className="mheat-col" style={{ textAlign: 'right' }}>/ sem.</span>
          {groups.map((g) => {
            const total = load.reduce((n, w) => n + w.sets[g], 0);
            return [
              <span key={g} className="small">{g}</span>,
              ...load.map((w) => {
                const v = w.sets[g];
                return (
                  <span
                    key={g + w.week}
                    className="mheat-cell"
                    title={`${g}, semaine du ${fmtShort(w.week)} : ${v} série${v > 1 ? 's' : ''}`}
                    style={{ background: heat(v, max), color: v / max > 0.55 ? 'var(--accent-text)' : undefined }}
                  >
                    {v || ''}
                  </span>
                );
              }),
              <span key={g + 'avg'} className="small muted num" style={{ textAlign: 'right' }}>{fr(total / weeks)}</span>,
            ];
          })}
        </div>
      </div>
      <div className="legend small">
        <span>moins</span>
        {[0.05, 0.3, 0.55, 0.8, 1].map((s) => (
          <i key={s} className="cell" style={{ background: heat(s * max, max), marginRight: 0 }} />
        ))}
        <span>plus de séries</span>
      </div>
    </section>
  );
}

// --- Carte musculaire ---

const FRONT: Partial<Record<MuscleGroup, ReactNode>> = {
  Pectoraux: (
    <>
      <path d="M70 82 Q100 74 100 92 L100 108 Q82 114 66 104 Q62 92 70 82Z" />
      <path d="M130 82 Q100 74 100 92 L100 108 Q118 114 134 104 Q138 92 130 82Z" />
    </>
  ),
  Épaules: (
    <>
      <circle cx="55" cy="78" r="13" />
      <circle cx="145" cy="78" r="13" />
    </>
  ),
  Biceps: (
    <>
      <rect x="36" y="94" width="17" height="42" rx="8" />
      <rect x="147" y="94" width="17" height="42" rx="8" />
    </>
  ),
  Abdos: <rect x="78" y="116" width="44" height="64" rx="10" />,
  Jambes: (
    <>
      <path d="M72 190 L98 190 L96 300 L78 300Z" />
      <path d="M102 190 L128 190 L122 300 L104 300Z" />
    </>
  ),
};

const BACK: Partial<Record<MuscleGroup, ReactNode>> = {
  Dos: <path d="M72 70 Q100 60 128 70 L124 150 Q100 160 76 150Z" />,
  Épaules: FRONT.Épaules,
  Triceps: (
    <>
      <rect x="36" y="94" width="17" height="42" rx="8" />
      <rect x="147" y="94" width="17" height="42" rx="8" />
    </>
  ),
  Jambes: FRONT.Jambes,
};

const SILHOUETTE = (
  <>
    <circle cx="100" cy="30" r="16" />
    <path d="M60 66 Q100 52 140 66 L150 190 L130 320 L70 320 L50 190Z" />
    <rect x="33" y="88" width="22" height="90" rx="10" />
    <rect x="145" y="88" width="22" height="90" rx="10" />
  </>
);

/** Fourchette courante en hypertrophie, en séries par groupe et par semaine. */
const RANGE = [10, 20] as const;

export function MuscleMap({ period, weeks }: { period: StrengthSession[]; weeks: number }) {
  const rows = useMemo(() => muscleSummary(period, weeks), [period, weeks]);
  const perWeek = new Map(rows.map((r) => [r.group, r.setsPerWeek]));
  const max = Math.max(24, ...rows.map((r) => r.setsPerWeek * 1.1));

  const figure = (zones: Partial<Record<MuscleGroup, ReactNode>>, label: string) => (
    <svg className="bodymap-fig" viewBox="0 0 200 330" role="img" aria-label={label}>
      <g className="bodymap-outline">{SILHOUETTE}</g>
      {(Object.keys(zones) as MuscleGroup[]).map((g) => (
        <g key={g} className="bodymap-zone" style={{ fill: heat(perWeek.get(g) ?? 0, 18) }}>
          <title>{`${g} : ${fr(perWeek.get(g) ?? 0)} séries / sem.`}</title>
          {zones[g]}
        </g>
      ))}
    </svg>
  );

  return (
    <section className="card">
      <div className="card-head">
        <h2>Carte musculaire</h2>
        <span className="muted small">séries / semaine</span>
      </div>
      {rows.length ? (
        <div className="bodymap">
          <div className="bodymap-figs">
            <div>
              {figure(FRONT, 'Silhouette de face colorée selon les séries par semaine')}
              <div className="small muted bodymap-cap">Face</div>
            </div>
            <div>
              {figure(BACK, 'Silhouette de dos colorée selon les séries par semaine')}
              <div className="small muted bodymap-cap">Dos</div>
            </div>
          </div>
          <div className="bodymap-rows">
            {rows.map((r) => {
              const v = r.setsPerWeek;
              const state = v < RANGE[0] ? 'sous la fourchette' : v > RANGE[1] ? 'au-dessus' : 'dans la fourchette';
              const tone = v < RANGE[0] ? 'bad' : v > RANGE[1] ? 'muted' : 'good';
              return (
                <div key={r.group} className="mrow">
                  <span className="small">
                    <i className="dot" style={{ background: MUSCLE_COLORS[r.group] }} />
                    {r.group}
                  </span>
                  <div className="track" aria-hidden>
                    <div className="band" style={{ left: `${(RANGE[0] / max) * 100}%`, width: `${((RANGE[1] - RANGE[0]) / max) * 100}%` }} />
                    <div className="fill" style={{ width: `${Math.min(v / max, 1) * 100}%` }} />
                  </div>
                  <span className="small num mrow-val">
                    {fr(v)} <span className={tone}>{state}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="muted small">Aucune série sur la période.</p>
      )}
      <p className="muted small">
        La zone verte sur chaque barre est la fourchette courante de {RANGE[0]} à {RANGE[1]} séries par groupe et par semaine en hypertrophie. Silhouette schématique ; le groupe est déduit du
        nom de l'exercice.
      </p>
    </section>
  );
}

// --- Calendrier et liste des séances ---

interface ExerciseDelta {
  /** Variation du meilleur 1RM estimé (kg) ou des répétitions pour un exercice au poids du corps, par rapport à la dernière séance de cet exercice. */
  delta: number | null;
  unit: 'kg' | 'reps';
}

interface SessionInfo {
  deltas: ExerciseDelta[];
  muscles: MuscleGroup[];
  pr: boolean;
}

/** Pour chaque séance : variation de chaque exercice vs la séance précédente, muscles travaillés, record battu. */
function sessionInfos(sessions: StrengthSession[]): Map<string, SessionInfo> {
  const asc = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const last = new Map<string, number>();
  const best = new Map<string, number>();
  const out = new Map<string, SessionInfo>();
  for (const s of asc) {
    const info: SessionInfo = { deltas: [], muscles: [], pr: false };
    const seen = new Map<string, number>();
    for (const e of s.exercises) {
      const sets = workSets(e);
      if (!sets.length) {
        info.deltas.push({ delta: null, unit: 'kg' });
        continue;
      }
      const group = muscleOf(e.name);
      if (!info.muscles.includes(group)) info.muscles.push(group);
      const weighted = sets.some((x) => x.weight > 0);
      const metric = weighted ? Math.max(...sets.map((x) => estimate1RM(x.weight, x.reps))) : Math.max(...sets.map((x) => x.reps));
      const before = last.get(e.name);
      info.deltas.push({ delta: before === undefined ? null : metric - before, unit: weighted ? 'kg' : 'reps' });
      seen.set(e.name, Math.max(seen.get(e.name) ?? 0, metric));
      if (weighted && best.has(e.name) && metric > best.get(e.name)!) info.pr = true;
    }
    for (const [name, metric] of seen) {
      last.set(name, metric);
      best.set(name, Math.max(best.get(name) ?? 0, metric));
    }
    out.set(s.id, info);
  }
  return out;
}

function DeltaTag({ d }: { d: ExerciseDelta }) {
  if (d.delta === null) return null;
  const v = d.unit === 'kg' ? round(d.delta, 1) : round(d.delta);
  if (v === 0) return <span className="muted small num" title="Comme la séance précédente">=</span>;
  return (
    <span className={`small num ${v > 0 ? 'good' : 'bad'}`} title="Par rapport à la séance précédente de cet exercice">
      {v > 0 ? '▲' : '▼'} {fr(Math.abs(v))} {d.unit === 'kg' ? 'kg' : 'rép.'}
    </span>
  );
}

const PAGE = 10;

export function SessionsPanel({ sessions, workouts, today }: { sessions: StrengthSession[]; workouts: Workout[]; today: string }) {
  const [month, setMonth] = useState(`${today.slice(0, 8)}01`);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<MuscleGroup | null>(null);
  const [shown, setShown] = useState(PAGE);
  const infos = useMemo(() => sessionInfos(sessions), [sessions]);

  const strengthByDate = useMemo(() => {
    const m = new Map<string, StrengthSession[]>();
    for (const s of sessions) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return m;
  }, [sessions]);
  const cardioByDate = useMemo(() => {
    const m = new Map<string, Workout[]>();
    for (const w of workouts) m.set(w.date, [...(m.get(w.date) ?? []), w]);
    return m;
  }, [workouts]);

  const [y, mo] = [Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1];
  const firstDow = (new Date(y, mo, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const shift = (n: number) => {
    setMonth(toISO(new Date(y, mo + n, 1)));
    setSelected(null);
  };
  const monthLabel = new Date(y, mo, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const muscles = useMemo(() => {
    const present = new Set<MuscleGroup>();
    for (const info of infos.values()) info.muscles.forEach((g) => present.add(g));
    return MUSCLE_GROUPS.filter((g) => present.has(g));
  }, [infos]);

  const list = [...sessions]
    .reverse()
    .filter((s) => (selected ? s.date === selected : filter ? infos.get(s.id)?.muscles.includes(filter) : true));
  const selectedCardio = selected ? (cardioByDate.get(selected) ?? []) : [];
  const visible = selected ? list : list.slice(0, shown);

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2 className="capitalize">{monthLabel}</h2>
          <div className="row">
            <button onClick={() => shift(-1)} aria-label="Mois précédent">‹</button>
            <button onClick={() => shift(1)} aria-label="Mois suivant" disabled={month >= `${today.slice(0, 8)}01`}>›</button>
          </div>
        </div>
        <div className="cal">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="cal-dow">{d}</span>
          ))}
          {Array.from({ length: firstDow }, (_, i) => (
            <span key={'e' + i} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = `${month.slice(0, 8)}${pad2(i + 1)}`;
            const lifts = strengthByDate.get(date);
            const cardio = cardioByDate.get(date);
            const kind = lifts ? 'lift' : cardio ? 'cardio' : '';
            const label = lifts?.[0]?.title ?? cardio?.[0]?.activity;
            const inner = (
              <>
                <span>{i + 1}</span>
                {label && <span className="cal-tag">{label}</span>}
              </>
            );
            const cls = `cal-day ${kind} ${date === today ? 'today' : ''} ${date === selected ? 'sel' : ''}`;
            return kind ? (
              <button key={date} className={cls} aria-pressed={date === selected} aria-label={`${fmtDate(date)} : ${label}`} onClick={() => setSelected(date === selected ? null : date)}>
                {inner}
              </button>
            ) : (
              <div key={date} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
        <div className="legend small">
          <span><i className="cell cal-lift" />Musculation</span>
          <span><i className="cell cal-cardio" />Cardio</span>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Séances</h2>
          {selected ? (
            <button onClick={() => setSelected(null)}>{fmtDate(selected, { day: 'numeric', month: 'short' })} · tout afficher</button>
          ) : (
            <span className="muted small">{list.length} séance{list.length > 1 ? 's' : ''}</span>
          )}
        </div>
        {!selected && muscles.length > 1 && (
          <div className="chips" role="group" aria-label="Filtrer par muscle">
            {[null, ...muscles].map((g) => (
              <button key={g ?? 'all'} className={`chip-btn ${filter === g ? 'on' : ''}`} aria-pressed={filter === g} onClick={() => { setFilter(g); setShown(PAGE); }}>
                {g ?? 'Tous'}
              </button>
            ))}
          </div>
        )}
        {selectedCardio.length > 0 && (
          <ul className="items">
            {selectedCardio.map((w) => (
              <li key={w.id}>
                <span>{w.activity} <span className="badge unknown">cardio</span></span>
                <span className="muted">{w.duration} min{w.distanceKm ? ` · ${fr(w.distanceKm)} km` : ''}</span>
                <span className="num">{round(w.kcal)} kcal</span>
              </li>
            ))}
          </ul>
        )}
        {visible.map((s, i) => {
          const info = infos.get(s.id);
          return (
            <details key={s.id} className="sess" open={i === 0 && !filter}>
              <summary>
                <span className="sess-main">
                  <strong>{s.title}</strong>
                  {info?.pr && <span className="badge raw">PR</span>}
                  <span className="muted small capitalize">
                    {fmtDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {sessionSets(s)} séries{s.minutes ? ` · ${fmtDuration(s.minutes)}` : ''}
                  </span>
                  <span className="chips">
                    {info?.muscles.map((g) => (
                      <span key={g} className="chip">{g}</span>
                    ))}
                  </span>
                </span>
                <span className="sess-vol num">
                  <strong>{tonnes(sessionVolume(s))} t</strong>
                  <span className="muted small">volume</span>
                </span>
              </summary>
              {s.exercises.map((e, j) => {
                let n = 0;
                const d = info?.deltas[j];
                return (
                  <div key={j} className="sess-ex">
                    <div className="exrow">
                      <strong className="small">{e.name}</strong>
                      {d && <DeltaTag d={d} />}
                    </div>
                    <div className="scroll-x">
                      <table>
                        <tbody>
                          {e.sets.map((x, k) => {
                            const warm = x.type === 'warmup';
                            if (!warm) n++;
                            return (
                              <tr key={k} className={warm ? 'muted' : ''}>
                                <td style={{ width: '2.5rem' }}>{warm ? 'É' : n}</td>
                                <td className="num">{x.weight ? `${round(x.weight, 1)} kg` : 'PDC'}</td>
                                <td className="num">{x.reps ? `× ${x.reps}` : `${x.seconds ?? 0} s`}</td>
                                <td className="num hide-sm">{x.rpe ? `RPE ${x.rpe}` : ''}</td>
                                <td className="num">{!warm && x.weight ? `1RM ≈ ${round(estimate1RM(x.weight, x.reps))} kg` : ''}</td>
                                <td className="num hide-sm">{!warm ? `${round(setVolume(x))} kg` : ''}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {workSets(e).length === 0 && <span className="muted small">Aucune série de travail</span>}
                  </div>
                );
              })}
            </details>
          );
        })}
        {!visible.length && !selectedCardio.length && <p className="muted small">Aucune séance.</p>}
        {!selected && list.length > shown && <button onClick={() => setShown(shown + PAGE)}>Voir {Math.min(PAGE, list.length - shown)} séances de plus</button>}
        <p className="muted small">▲ ▼ : variation du meilleur 1RM estimé (ou des répétitions au poids du corps) par rapport à la séance précédente du même exercice. PR : record de 1RM estimé battu pendant la séance.</p>
      </section>
    </>
  );
}
