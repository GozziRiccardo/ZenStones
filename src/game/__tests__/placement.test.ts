import { describe, expect, test } from 'vitest';
import { createInitialState, gameReducer } from '../state';
import { squareCostForPlayer } from '../utils';

describe('placement blocking', () => {
  test('blocking mirrored square for opponent', () => {
    const state = createInitialState();
    state.phase = 'PLACEMENT';
    state.turn = 'W';

    for (let r = 0; r < state.labels.whiteHalf.length; r += 1) {
      state.labels.whiteHalf[r] = state.labels.whiteHalf[r].map(() => 0);
      state.labels.blackHalf[r] = state.labels.blackHalf[r].map(() => 0);
    }
    state.labels.whiteHalf[9][0] = 5;
    state.labels.blackHalf[0][0] = 5;

    expect(squareCostForPlayer(state, 'B', 0, 0)).toBe(5);

    const next = gameReducer(state, { type: 'placementSquare', r: 9, c: 0 });
    expect(next.board[9][0]).not.toBeNull();
    expect(next.blockedLabels.B[5]).toBe(true);
    expect(squareCostForPlayer(next, 'B', 0, 0)).toBe(0);
  });
});
