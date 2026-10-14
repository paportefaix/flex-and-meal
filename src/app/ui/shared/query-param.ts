import { inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

/** Paramètre d'URL (?nom=…) sous forme de signal, avec une fonction pour le modifier sans empiler l'historique. */
export function queryParam(name: string): { value: Signal<string | null>; set: (v: string) => void } {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const value = toSignal(route.queryParamMap.pipe(map((p) => p.get(name))), { initialValue: route.snapshot.queryParamMap.get(name) });
  return {
    value,
    set: (v) => void router.navigate([], { relativeTo: route, queryParams: { [name]: v }, replaceUrl: true }),
  };
}
