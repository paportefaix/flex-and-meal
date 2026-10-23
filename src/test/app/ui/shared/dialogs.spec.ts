import { TestBed } from '@angular/core/testing';
import { screen } from '@testing-library/dom';
import { afterEach, describe, expect, it } from 'vitest';
import { Dialogs } from '../../../../app/ui/shared/dialogs';

const click = (name: string) => (screen.getByRole('button', { name }) as HTMLButtonElement).click();
const flush = async () => {
  TestBed.tick();
  await new Promise((r) => setTimeout(r));
  TestBed.tick();
};

describe('Dialogs', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((e) => (e.innerHTML = ''));
  });

  it('confirm affiche le message et renvoie true sur « Confirmer »', async () => {
    const dialogs = TestBed.inject(Dialogs);
    const result = dialogs.confirm('Supprimer ?');
    await flush();
    expect(screen.getByText('Supprimer ?')).toBeTruthy();
    click('Confirmer');
    expect(await result).toBe(true);
  });

  it('confirm renvoie false sur « Annuler »', async () => {
    const dialogs = TestBed.inject(Dialogs);
    const result = dialogs.confirm('Supprimer ?');
    await flush();
    click('Annuler');
    expect(await result).toBe(false);
  });

  it('prompt renvoie le texte saisi', async () => {
    const dialogs = TestBed.inject(Dialogs);
    const result = dialogs.prompt('Nom du repas');
    await flush();
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.value = 'Petit-déj';
    input.dispatchEvent(new Event('input'));
    await flush();
    click('OK');
    expect(await result).toBe('Petit-déj');
  });

  it('prompt renvoie null si on annule', async () => {
    const dialogs = TestBed.inject(Dialogs);
    const result = dialogs.prompt('Nom du repas');
    await flush();
    click('Annuler');
    expect(await result).toBeNull();
  });
});
