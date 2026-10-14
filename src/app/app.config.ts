import { registerLocaleData } from '@angular/common';
import fr from '@angular/common/locales/fr';
import { ApplicationConfig, LOCALE_ID, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { routes } from './app.routes';
import { provideFrDateAdapter } from './ui/shared/fr-date-adapter';
import { Store } from './ui/state/store';

registerLocaleData(fr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideFrDateAdapter(),
    provideCharts(withDefaultRegisterables()),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    // Charge les données locales avant l'affichage de l'application.
    provideAppInitializer(() => inject(Store).init()),
  ],
};
