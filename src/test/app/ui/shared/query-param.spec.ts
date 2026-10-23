import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { queryParam } from '../../../../app/ui/shared/query-param';

@Component({ template: '' })
class Host {
  readonly tab = queryParam('tab');
}

const setup = async (url: string) => {
  TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'page', component: Host }])] });
  const harness = await RouterTestingHarness.create(url);
  return { harness, host: harness.routeDebugElement!.componentInstance as Host, router: TestBed.inject(Router) };
};

describe('queryParam', () => {
  it('lit la valeur initiale de l’URL', async () => {
    const { host } = await setup('/page?tab=b');
    expect(host.tab.value()).toBe('b');
  });

  it('vaut null quand le paramètre est absent', async () => {
    const { host } = await setup('/page');
    expect(host.tab.value()).toBeNull();
  });

  it('set modifie l’URL et le signal', async () => {
    const { host, router, harness } = await setup('/page?tab=a');
    host.tab.set('c');
    await harness.fixture.whenStable();
    expect(router.url).toBe('/page?tab=c');
    expect(host.tab.value()).toBe('c');
  });

  it('set remplace l’entrée d’historique au lieu d’en ajouter une', async () => {
    const { host, harness } = await setup('/page');
    const before = history.length;
    host.tab.set('x');
    await harness.fixture.whenStable();
    expect(history.length).toBe(before);
  });
});
