import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { parseData } from '../../application/appData';
import { markExported } from '../../infrastructure/exportReminder';
import { type Settings as SettingsValues, suggestMacroGoals } from '../../settings/domain/settings';
import { byDate, todayISO } from '../../shared/kernel/dates';
import { num } from '../../shared/kernel/numbers';
import { Dialogs } from '../shared/dialogs';
import { Store } from '../state/store';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: './settings.html',
})
export class Settings {
  private readonly store = inject(Store);
  private readonly dialogs = inject(Dialogs);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly backup = this.store.backup;

  protected readonly goal = signal('');
  protected readonly height = signal('');
  protected readonly target = signal('');
  protected readonly protein = signal('');
  protected readonly carbs = signal('');
  protected readonly fat = signal('');
  protected readonly saved = signal(false);

  protected readonly goalValue = computed(() => num(this.goal()));
  protected readonly lastWeight = computed(() => [...this.store.data().weights].sort(byDate).pop()?.weight);

  // Modification valide en attente d'enregistrement (null si rien à écrire).
  private pending: SettingsValues | null = null;
  private savedTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.load(this.store.data().settings);
    // Enregistrement automatique 600 ms après la dernière modification valide.
    effect((onCleanup) => {
      const s = this.store.data().settings;
      const g = num(this.goal());
      const opt = (v: string) => (num(v) > 0 ? num(v) : undefined);
      const next: SettingsValues = {
        ...s,
        kcalGoal: g,
        heightCm: opt(this.height()),
        targetWeight: opt(this.target()),
        proteinGoal: opt(this.protein()),
        carbsGoal: opt(this.carbs()),
        fatGoal: opt(this.fat()),
      };
      const unchanged = (Object.keys(next) as (keyof SettingsValues)[]).every((k) => next[k] === s[k]);
      if (!(g > 0) || unchanged) {
        this.pending = null;
        return;
      }
      this.pending = next;
      const timer = setTimeout(() => this.commit(), 600);
      onCleanup(() => clearTimeout(timer));
    });

    // Évite de perdre une modification en attente en quittant la page ou en fermant l'onglet.
    const flush = () => this.commit();
    const onHide = () => document.visibilityState === 'hidden' && this.commit();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      clearTimeout(this.savedTimer);
      this.commit();
    });
  }

  /** Remplit les champs depuis les réglages enregistrés (au départ, puis après un import ou un effacement). */
  private load(s: SettingsValues) {
    this.pending = null;
    this.goal.set(String(s.kcalGoal));
    this.height.set(s.heightCm?.toString() ?? '');
    this.target.set(s.targetWeight?.toString() ?? '');
    this.protein.set(s.proteinGoal?.toString() ?? '');
    this.carbs.set(s.carbsGoal?.toString() ?? '');
    this.fat.set(s.fatGoal?.toString() ?? '');
  }

  private commit() {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    this.store.update((d) => ({ ...d, settings: p }));
    untracked(() => this.saved.set(true));
    clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => this.saved.set(false), 2000);
  }

  protected suggest() {
    const w = this.lastWeight();
    if (!w) return;
    const m = suggestMacroGoals({ ...this.store.data().settings, kcalGoal: this.goalValue() }, w);
    this.protein.set(String(m.protein));
    this.carbs.set(String(m.carbs));
    this.fat.set(String(m.fat));
  }

  protected exportData() {
    const blob = new Blob([JSON.stringify(this.store.data(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `flex-and-meal-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    markExported();
  }

  protected async importData(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const imported = parseData(await file.text());
      if (await this.dialogs.confirm('Remplacer toutes les données actuelles par celles du fichier ?')) {
        this.store.replace(imported);
        this.load(imported.settings);
      }
    } catch (err) {
      this.snackBar.open(`Import impossible : ${(err as Error).message}`, 'OK', { duration: 8000 });
    }
  }

  protected async eraseAll() {
    if ((await this.dialogs.confirm('Effacer définitivement toutes les données ?')) && (await this.dialogs.confirm('Vraiment ? Pensez à exporter avant.'))) {
      this.store.reset();
      this.load(this.store.data().settings);
    }
  }
}
