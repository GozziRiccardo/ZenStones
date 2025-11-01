import { describe, expect, test } from 'vitest';
import { createInitialState, gameReducer } from '../state';

function setupMovementBiddingState() {
  const base = createInitialState();
  return {
    ...base,
    phase: 'MOVEMENT_BIDDING' as const,
    movement: {
      bids: { revealed: false },
      moveCount: 0,
    },
  };
}

describe('movement bidding', () => {
  test('winning bid sets move limit and winner chooses starter', () => {
    let state = setupMovementBiddingState();
    state = gameReducer(state, { type: 'movementBid', player: 'W', bid: 3 });
    state = gameReducer(state, { type: 'movementBid', player: 'B', bid: 5 });

    expect(state.movement.bids.revealed).toBe(true);
    expect(state.movement.bids.winner).toBe('B');
    expect(state.movement.moveLimit).toBe(5);
    expect(state.credits.B).toBe(95);
    expect(state.credits.W).toBe(100);

    state = gameReducer(state, { type: 'movementPlan', player: 'B', startingPlayer: 'B' });
    expect(state.phase).toBe('MOVEMENT');
    expect(state.turn).toBe('B');
    expect(state.movement.moveLimit).toBe(5);
  });

  test('tie bids let White choose starter with tied move count', () => {
    let state = setupMovementBiddingState();
    state = gameReducer(state, { type: 'movementBid', player: 'W', bid: 4 });
    state = gameReducer(state, { type: 'movementBid', player: 'B', bid: 4 });

    expect(state.movement.bids.winner).toBe('W');
    expect(state.movement.moveLimit).toBe(4);
    expect(state.credits.W).toBe(96);
    expect(state.credits.B).toBe(100);

    state = gameReducer(state, { type: 'movementPlan', player: 'W', startingPlayer: 'B' });
    expect(state.phase).toBe('MOVEMENT');
    expect(state.turn).toBe('B');
    expect(state.movement.moveLimit).toBe(4);
  });

  test('zero winning bid ends game immediately after plan', () => {
    let state = setupMovementBiddingState();
    state = gameReducer(state, { type: 'movementBid', player: 'W', bid: 0 });
    state = gameReducer(state, { type: 'movementBid', player: 'B', bid: 0 });

    expect(state.movement.moveLimit).toBe(0);

    state = gameReducer(state, { type: 'movementPlan', player: 'W', startingPlayer: 'W' });
    expect(state.phase).toBe('ENDED');
    expect(state.turn).toBeNull();
    expect(state.winner).toBeDefined();
  });
});
