import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateField } from './DateField';

describe('DateField', () => {
  it('affiche la date en jj/mm/aaaa', () => {
    render(<DateField value="2025-03-07" onChange={() => {}} />);
    expect(screen.getByText('07/03/2025')).toBeInTheDocument();
  });

  it('affiche un gabarit quand la valeur est vide', () => {
    render(<DateField value="" onChange={() => {}} />);
    expect(screen.getByText('jj/mm/aaaa')).toBeInTheDocument();
  });

  it('transmet la nouvelle date', () => {
    const onChange = vi.fn();
    const { container } = render(<DateField value="2025-03-07" onChange={onChange} />);
    fireEvent.change(container.querySelector('input')!, { target: { value: '2025-04-01' } });
    expect(onChange).toHaveBeenCalledWith('2025-04-01');
  });

  it('ouvre le sélecteur au clic, sans planter s’il n’est pas supporté', () => {
    const { container } = render(<DateField value="2025-03-07" onChange={() => {}} />);
    const input = container.querySelector('input')!;
    expect(() => fireEvent.click(input)).not.toThrow();
    const showPicker = vi.fn();
    input.showPicker = showPicker;
    fireEvent.click(input);
    expect(showPicker).toHaveBeenCalled();
  });
});
