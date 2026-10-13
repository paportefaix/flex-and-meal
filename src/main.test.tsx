import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('main', () => {
  it('monte l’application dans #root', async () => {
    document.body.innerHTML = '<div id="root"></div>';
    await import('./main');
    expect(await screen.findByText('Flex & Meal')).toBeInTheDocument();
    expect(document.getElementById('root')!.querySelector('nav')).not.toBeNull();
  });
});
