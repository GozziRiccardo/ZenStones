import { describe, expect, it } from 'vitest';
import { DIR, Stone } from '../types';
import { legalMoves } from '../utils';
import { createInitialState } from '../state';

describe('legalMoves', () => {
  it('respects distance, blocking, and captures', () => {
    const state = createInitialState();
    const mover: Stone = { id: 'S1', owner: 'W', r: 6, c: 4, d: 2, dirs: DIR.R | DIR.D };
    const ally: Stone = { id: 'S2', owner: 'W', r: 6, c: 5 };
    const enemy: Stone = { id: 'S3', owner: 'B', r: 7, c: 4, d: 1, dirs: DIR.U };
    state.stones = { S1: mover, S2: ally, S3: enemy };
    state.board[mover.r][mover.c] = mover.id;
    state.board[ally.r][ally.c] = ally.id;
    state.board[enemy.r][enemy.c] = enemy.id;

    const moves = legalMoves(state, mover);
    expect(moves).toContainEqual({ r: 7, c: 4 });
    expect(moves).not.toContainEqual({ r: 8, c: 4 });
    expect(moves).not.toContainEqual({ r: 6, c: 5 });
  });

  it('returns empty list when no directions are assigned', () => {
    const state = createInitialState();
    const stone: Stone = { id: 'S4', owner: 'W', r: 5, c: 5 };
    state.stones = { S4: stone };
    state.board[5][5] = 'S4';
    expect(legalMoves(state, stone)).toEqual([]);
  });
});
