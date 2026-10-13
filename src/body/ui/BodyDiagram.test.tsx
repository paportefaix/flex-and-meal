import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BodyDiagram } from './BodyDiagram';

describe('BodyDiagram', () => {
  it('liste les six mensurations avec leur explication', () => {
    render(<BodyDiagram />);
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText('Taille')).toBeInTheDocument();
  });

  it('met en avant la mesure active', () => {
    const { container } = render(<BodyDiagram active="waist" />);
    expect(container.querySelector('li.on')).toHaveTextContent('Taille');
    expect(container.querySelectorAll('li.on')).toHaveLength(1);
  });
});
