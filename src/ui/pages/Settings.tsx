import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { parseData } from '../../application/appData';
import { markExported } from '../../infrastructure/exportReminder';
import { type Settings as SettingsValues, suggestMacroGoals } from '../../settings/domain/settings';
import { byDate, todayISO } from '../../shared/kernel/dates';
import { num } from '../../shared/kernel/numbers';
import { useStore } from '../state/store';

export default function Settings() {
  const { data, update, replace, reset, backup } = useStore();
  const s = data.settings;
  const [goal, setGoal] = useState(String(s.kcalGoal));
  const [height, setHeight] = useState(s.heightCm?.toString() ?? '');
  const [target, setTarget] = useState(s.targetWeight?.toString() ?? '');
  const [protein, setProtein] = useState(s.proteinGoal?.toString() ?? '');
  const [carbs, setCarbs] = useState(s.carbsGoal?.toString() ?? '');
  const [fat, setFat] = useState(s.fatGoal?.toString() ?? '');
  const [saved, setSaved] = useState(false);
  const lastWeight = [...data.weights].sort(byDate).pop()?.weight;

  // Modification valide en attente d'enregistrement (null si rien à écrire).
  const pending = useRef<SettingsValues | null>(null);

  const commit = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    update((d) => ({ ...d, settings: p }));
    setSaved(true);
  }, [update]);

  // Enregistrement automatique 600 ms après la dernière modification valide.
  useEffect(() => {
    const g = num(goal);
    const opt = (v: string) => (num(v) > 0 ? num(v) : undefined);
    const next: SettingsValues = {
      ...s,
      kcalGoal: g,
      heightCm: opt(height),
      targetWeight: opt(target),
      proteinGoal: opt(protein),
      carbsGoal: opt(carbs),
      fatGoal: opt(fat),
    };
    const unchanged = (Object.keys(next) as (keyof SettingsValues)[]).every((k) => next[k] === s[k]);
    if (!(g > 0) || unchanged) {
      pending.current = null;
      return;
    }
    pending.current = next;
    const timer = setTimeout(commit, 600);
    return () => clearTimeout(timer);
  }, [goal, height, target, protein, carbs, fat, s, commit]);

  // Évite de perdre une modification en attente en quittant la page ou en fermant l'onglet.
  useEffect(() => {
    const flush = () => commit();
    const onHide = () => document.visibilityState === 'hidden' && commit();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      commit();
    };
  }, [commit]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `flex-and-meal-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    markExported();
  };

  const importData = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const imported = parseData(await file.text());
      if (confirm('Remplacer toutes les données actuelles par celles du fichier ?')) replace(imported);
    } catch (err) {
      alert(`Import impossible : ${(err as Error).message}`);
    }
  };

  return (
    <>
      <h1>Réglages</h1>
      <section className="card">
        <h2>Objectifs</h2>
        <form className="grid-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Objectif calorique (kcal / jour)
            <input inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} required />
          </label>
          <label>
            Poids cible (kg)
            <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
          <label>
            Taille (cm) — pour l'IMC
            <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} />
          </label>
          <div className="row span2">
            <span className="muted small">Enregistrement automatique</span>
            {saved && <span className="good">Enregistré ✓</span>}
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Objectifs de macros</h2>
        <form className="grid-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Protéines (g / jour)
            <input inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
          </label>
          <label>
            Glucides (g / jour)
            <input inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
          </label>
          <label>
            Lipides (g / jour)
            <input inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
          </label>
        </form>
        <div className="row wrap">
          <button
            className="ghost"
            disabled={!lastWeight || !(num(goal) > 0)}
            onClick={() => {
              const m = suggestMacroGoals({ ...s, kcalGoal: num(goal) }, lastWeight!);
              setProtein(String(m.protein));
              setCarbs(String(m.carbs));
              setFat(String(m.fat));
            }}
          >
            Proposer des valeurs
          </button>
          <span className="muted small">
            {lastWeight
              ? `1,8 g de protéines par kg (${lastWeight} kg), 28 % de lipides, le reste en glucides. Laissez vide pour ne pas suivre un macro.`
              : 'Enregistrez une pesée pour obtenir une proposition. Laissez vide pour ne pas suivre un macro.'}
          </span>
        </div>
      </section>

      <section className="card">
        <h2>Données</h2>
        <p className="muted small">
          Les données sont stockées dans ce navigateur et enregistrées automatiquement. Pour les protéger d'une perte (nettoyage du navigateur, changement d'appareil), activez la sauvegarde automatique ci-dessous ou exportez-les régulièrement.
        </p>
        {backup.supported ? (
          <div className="row wrap">
            {!backup.folder && <button onClick={backup.choose}>Choisir un dossier de sauvegarde…</button>}
            {backup.folder && (
              <>
                <span className="small">
                  Dossier : <strong>{backup.folder}</strong>
                  {backup.lastBackup && ` — dernière sauvegarde à ${backup.lastBackup.toLocaleTimeString('fr-FR')}`}
                </span>
                {backup.needsPermission && <button onClick={backup.resume}>Réactiver la sauvegarde</button>}
                {backup.error && <span className="danger small">Échec de la sauvegarde</span>}
                <button className="ghost" onClick={backup.choose}>Changer</button>
                <button className="ghost" onClick={backup.disable}>Désactiver</button>
              </>
            )}
          </div>
        ) : (
          <p className="muted small">La sauvegarde automatique dans un dossier n'est pas disponible sur ce navigateur (utilisez Chrome ou Edge). Pensez à exporter régulièrement.</p>
        )}
        <div className="row wrap">
          <button onClick={exportData}>Exporter (JSON)</button>
          <label className="button ghost">
            Importer…
            <input type="file" accept="application/json,.json" onChange={importData} hidden />
          </label>
          <button
            className="ghost danger"
            onClick={() => confirm('Effacer définitivement toutes les données ?') && confirm('Vraiment ? Pensez à exporter avant.') && reset()}
          >
            Tout effacer
          </button>
        </div>
      </section>
    </>
  );
}
