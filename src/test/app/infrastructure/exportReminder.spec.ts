import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportDue, markExported } from '../../../app/infrastructure/exportReminder';

describe('rappel d’export', () => {
  afterEach(() => vi.useRealTimers());

  it('est dû quand aucun export n’a jamais été fait', () => {
    expect(exportDue()).toBe(true);
  });

  it('n’est plus dû juste après un export', () => {
    markExported();
    expect(exportDue()).toBe(false);
  });

  it('redevient dû après plus de 14 jours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00'));
    markExported();
    vi.setSystemTime(new Date('2025-01-14T12:00:00'));
    expect(exportDue()).toBe(false);
    vi.setSystemTime(new Date('2025-01-16T12:00:00'));
    expect(exportDue()).toBe(true);
  });

  it('ne plante pas et ne rappelle rien si le stockage est indisponible', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('indisponible');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('indisponible');
    });
    expect(() => markExported()).not.toThrow();
    expect(exportDue()).toBe(false);
    get.mockRestore();
    set.mockRestore();
  });
});
