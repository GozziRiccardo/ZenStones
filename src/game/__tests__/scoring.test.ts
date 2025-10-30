import { describe, expect, it } from 'vitest';
import { computeScoreDetails } from '../utils';
import { createInitialState } from '../state';
import type { Stone } from '../types';

describe('computeScoreDetails', () => {
  it('combines credits with position points', () => {
    const state = createInitialState();
    state.credits.W = 80;
    state.credits.B = 75;
    const whiteStone: Stone = { id: 'SW', owner: 'W', r: 1, c: 1, d: 2, dirs: 1 };
    const blackStone: Stone = { id: 'SB', owner: 'B', r: 8, c: 8, d: 1, dirs: 1 };
    state.stones = { SW: whiteStone, SB: blackStone };
    state.board[whiteStone.r][whiteStone.c] = whiteStone.id;
    state.board[blackStone.r][blackStone.c] = blackStone.id;

    const labelForWhite = state.labels.blackHalf[whiteStone.r][whiteStone.c];
    const labelForBlack = state.labels.whiteHalf[blackStone.r][blackStone.c];
    const expectedWhite = 80 + (labelForWhite ? 51 - labelForWhite : 0);
    const expectedBlack = 75 + (labelForBlack ? 51 - labelForBlack : 0);

    const details = computeScoreDetails(state);
    expect(details.W.total).toBe(expectedWhite);
    expect(details.W.credits).toBe(80);
    expect(details.B.total).toBe(expectedBlack);
    expect(details.B.credits).toBe(75);
  });
});
