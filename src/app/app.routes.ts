import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', title: 'Flex & Meal', loadComponent: () => import('./ui/pages/dashboard').then((m) => m.Dashboard) },
  { path: 'journal', title: 'Journal', loadComponent: () => import('./ui/pages/journal').then((m) => m.Journal) },
  { path: 'semaine', title: 'Semaine', loadComponent: () => import('./ui/pages/week').then((m) => m.Week) },
  { path: 'analyses', title: 'Analyses', loadComponent: () => import('./ui/pages/insights').then((m) => m.Insights) },
  { path: 'muscu', title: 'Muscu', loadComponent: () => import('./training/ui/strength').then((m) => m.Strength) },
  { path: 'corps', title: 'Poids & mensurations', loadComponent: () => import('./body/ui/body').then((m) => m.Body) },
  { path: 'repas', title: 'Repas types', loadComponent: () => import('./nutrition/ui/templates').then((m) => m.Templates) },
  { path: 'aliments', title: 'Aliments', loadComponent: () => import('./nutrition/ui/foods').then((m) => m.Foods) },
  { path: 'reglages', title: 'Réglages', loadComponent: () => import('./ui/pages/settings').then((m) => m.Settings) },
  { path: '**', redirectTo: '' },
];
