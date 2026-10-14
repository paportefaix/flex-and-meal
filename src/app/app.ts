import { Component, computed, inject } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { exportDue } from './infrastructure/exportReminder';
import { Store } from './ui/state/store';

export const NAV_LINKS = [
  { to: '/', label: 'Accueil' },
  { to: '/journal', label: 'Journal' },
  { to: '/semaine', label: 'Semaine' },
  { to: '/analyses', label: 'Analyses' },
  { to: '/muscu', label: 'Muscu' },
  { to: '/corps', label: 'Poids & mensurations' },
  { to: '/repas', label: 'Repas types' },
  { to: '/aliments', label: 'Aliments' },
  { to: '/reglages', label: 'Réglages' },
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatTabsModule, MatCardModule],
  styles: `
    mat-toolbar { position: sticky; top: 0; z-index: 10; flex-direction: column; align-items: stretch; height: auto; padding: 0 8px; gap: 0; }
    .brand { font-weight: 700; padding: 0.6rem 8px 0; white-space: nowrap; }
    nav[mat-tab-nav-bar] { --mat-tab-nav-bar-background-color: transparent; }
    @media (min-width: 900px) {
      mat-toolbar { flex-direction: row; align-items: center; gap: 1rem; padding: 0 16px; }
      .brand { padding: 0; }
    }
  `,
  templateUrl: './app.html',
})
export class App {
  protected readonly store = inject(Store);
  protected readonly links = NAV_LINKS;
  protected readonly remind = computed(() => !this.store.backup.folder() && this.store.data().log.length > 0 && exportDue());
}
