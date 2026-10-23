import { screen } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { renderWithStore } from '../../../render';
import { Segmented } from '../../../../app/ui/shared/segmented';

const options = [
  { value: 7, label: '7 j' },
  { value: 30, label: '30 j' },
];

describe('Segmented', () => {
  it('affiche une option par choix et marque la valeur courante', async () => {
    await renderWithStore(Segmented<number>, { inputs: { options, value: 30, label: 'Période' } });
    expect(screen.getByRole('radio', { name: '7 j' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: '30 j' })).toHaveAttribute('aria-checked', 'true');
  });

  it('met à jour la valeur au clic', async () => {
    const { component, settle } = await renderWithStore(Segmented<number>, { inputs: { options, value: 30 } });
    (screen.getByRole('radio', { name: '7 j' }).querySelector('button') ?? screen.getByRole('radio', { name: '7 j' })).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    await settle();
    expect(component.value()).toBe(7);
  });

  it('expose le libellé comme aria-label du groupe', async () => {
    await renderWithStore(Segmented<number>, { inputs: { options, value: 7, label: 'Période' } });
    expect(screen.getByLabelText('Période')).toBeTruthy();
  });
});
