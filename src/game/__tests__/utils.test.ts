import { describe, expect, test } from 'vitest';
import { newId, resetIdCounter, restoreIdCounter } from '../utils';

describe('restoreIdCounter', () => {
  test('continues incrementing from highest existing stone id', () => {
    resetIdCounter();
    restoreIdCounter({
      stones: {
        S2: {} as any,
        S5: {} as any,
      },
    });
    expect(newId()).toBe('S6');
  });

  test('handles empty state', () => {
    resetIdCounter();
    restoreIdCounter({ stones: {} });
    expect(newId()).toBe('S1');
  });
});
