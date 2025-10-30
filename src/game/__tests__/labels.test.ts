import { describe, expect, it } from 'vitest';
import { makeLabels } from '../labels';

describe('makeLabels', () => {
  it('assigns sequential values for each half', () => {
    const labels = makeLabels(10, 10);
    expect(labels.whiteHalf[9][0]).toBe(1);
    expect(labels.whiteHalf[9][9]).toBe(10);
    expect(labels.whiteHalf[5][9]).toBe(50);
    expect(labels.blackHalf[0][0]).toBe(1);
    expect(labels.blackHalf[4][9]).toBe(50);
  });

  it('returns zero outside player halves', () => {
    const labels = makeLabels(10, 10);
    expect(labels.whiteHalf[0][0]).toBe(0);
    expect(labels.blackHalf[9][9]).toBe(0);
  });
});
