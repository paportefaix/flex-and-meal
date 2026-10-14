import { describe, expect, it } from 'vitest';
import { weightOn } from '../../../../app/body/domain/weight';

describe('weightOn', () => {
  it('prend la dernière pesée à la date, sinon la première, sinon 70 kg', () => {
    const weights = [{ id: 'a', date: '2025-06-01', weight: 80 }, { id: 'b', date: '2025-06-20', weight: 78 }];
    expect(weightOn(weights, '2025-06-10')).toBe(80);
    expect(weightOn(weights, '2025-05-01')).toBe(80);
    expect(weightOn([], '2025-06-10')).toBe(70);
  });
});
