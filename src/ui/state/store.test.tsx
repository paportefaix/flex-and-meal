import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { loadFromDb } from '../../infrastructure/db';
import { makeData, seed } from '../../test/render';
import { StoreProvider, useStore } from './store';

function Probe() {
  const { data, update, reset, saveError } = useStore();
  return (
    <div>
      <span data-testid="goal">{data.settings.kcalGoal}</span>
      <span data-testid="err">{String(saveError)}</span>
      <button onClick={() => update((d) => ({ ...d, settings: { ...d.settings, kcalGoal: 1234 } }))}>set</button>
      <button onClick={reset}>reset</button>
    </div>
  );
}

describe('StoreProvider', () => {
  it('charge les données de la base locale', async () => {
    await seed(makeData({ settings: { kcalGoal: 1800 } }));
    render(<StoreProvider><Probe /></StoreProvider>);
    expect(await screen.findByTestId('goal')).toHaveTextContent('1800');
  });

  it('enregistre les modifications dans la base', async () => {
    await seed(makeData());
    render(<StoreProvider><Probe /></StoreProvider>);
    await userEvent.click(await screen.findByText('set'));
    await waitFor(async () => expect((await loadFromDb())?.settings.kcalGoal).toBe(1234));
    expect(screen.getByTestId('err')).toHaveTextContent('false');
  });

  it('remet les données à zéro', async () => {
    await seed(makeData({ settings: { kcalGoal: 1800 } }));
    render(<StoreProvider><Probe /></StoreProvider>);
    await userEvent.click(await screen.findByText('reset'));
    expect(screen.getByTestId('goal')).toHaveTextContent('2000');
  });

  it('refuse un usage hors du provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/StoreProvider/);
  });
});
