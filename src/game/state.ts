import { makeLabels } from './labels';
import type { Assignment, GameState, Player, Stone } from './types';
import { DIR } from './types';
import { emptyBoard, hasPlacementOption, legalMoves, newId, recalcScores, resetIdCounter, squareCostForPlayer } from './utils';

export type GameAction =
  | { type: 'reset' }
  | { type: 'tick'; dt: number }
  | { type: 'lockBid'; player: Player; bid: number }
  | { type: 'startPlacement' }
  | { type: 'placementSquare'; r: number; c: number }
  | { type: 'placementPass' }
  | { type: 'assignStats'; player: Player; assignments: Record<string, Assignment> }
  | { type: 'movementBid'; player: Player; bid: number }
  | { type: 'movementPlan'; player: Player; startingPlayer: Player }
  | { type: 'movementMove'; stoneId: string; r: number; c: number }
  | { type: 'movementPass' }
  | { type: 'resign'; player: Player };

export function createInitialState(): GameState {
  resetIdCounter();
  const labels = makeLabels(10, 10);
  const credits = { W: 100, B: 100 } as const;
  const base: GameState = {
    seed: String(Date.now()),
    board: emptyBoard(10, 10),
    stones: {},
    turn: null,
    phase: 'BIDDING',
    credits: { ...credits },
    clocks: { W: 10 * 60 * 1000, B: 10 * 60 * 1000 },
    scores: { W: 0, B: 0 },
    scoreDetails: {
      W: { credits: credits.W, position: 0, total: credits.W },
      B: { credits: credits.B, position: 0, total: credits.B },
    },
    bids: { revealed: false },
    passesInARow: 0,
    labels,
    assignments: { W: {}, B: {} },
    movement: {
      bids: { revealed: false },
      moveCount: 0,
    },
    placementCounts: { W: 0, B: 0 },
    blockedLabels: { W: {}, B: {} },
  };
  recalcScores(base);
  return base;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (!state.placementCounts) {
    const counts = { W: 0, B: 0 } as Record<Player, number>;
    for (const stone of Object.values(state.stones)) {
      counts[stone.owner] += 1;
    }
    state = { ...state, placementCounts: counts };
  }
  if (!state.blockedLabels) {
    state = { ...state, blockedLabels: { W: {}, B: {} } };
  }
  switch (action.type) {
    case 'reset':
      return createInitialState();
    case 'tick':
      return handleTick(state, action.dt);
    case 'lockBid':
      return handleLockBid(state, action.player, action.bid);
    case 'startPlacement':
      return handleStartPlacement(state);
    case 'placementSquare':
      return handlePlacement(state, action.r, action.c);
    case 'placementPass':
      return handlePlacementPass(state);
    case 'assignStats':
      return handleAssignStats(state, action.player, action.assignments);
    case 'movementBid':
      return handleMovementBid(state, action.player, action.bid);
    case 'movementPlan':
      return handleMovementPlan(state, action.player, action.startingPlayer);
    case 'movementMove':
      return handleMovementMove(state, action.stoneId, action.r, action.c);
    case 'movementPass':
      return handleMovementPass(state);
    case 'resign':
      return handleResign(state, action.player);
    default:
      return state;
  }
}

function handleResign(state: GameState, player: Player): GameState {
  if (state.phase === 'ENDED') return state;
  const winner = player === 'W' ? 'B' : 'W';
  return {
    ...state,
    phase: 'ENDED',
    winner,
    turn: null,
  };
}

function handleTick(state: GameState, dt: number): GameState {
  if (state.phase === 'ENDED') return state;
  const mode = getTickingMode(state);
  if (mode === 'none' || dt <= 0) return state;
  const clocks = { ...state.clocks };
  if (mode === 'both') {
    clocks.W = Math.max(0, clocks.W - dt);
    clocks.B = Math.max(0, clocks.B - dt);
  } else {
    clocks[mode] = Math.max(0, clocks[mode] - dt);
  }
  const next: GameState = { ...state, clocks };
  if (next.phase !== 'ENDED' && (clocks.W === 0 || clocks.B === 0)) {
    next.phase = 'ENDED';
    next.winner = clocks.W === 0 ? 'B' : 'W';
  }
  return next;
}

function handleLockBid(state: GameState, player: Player, bid: number): GameState {
  if (state.phase !== 'BIDDING') return state;
  if (state.bids[player] !== undefined) return state;
  const value = clamp(bid, 0, state.credits[player]);
  const bids = { ...state.bids, [player]: value };
  const next: GameState = { ...state, bids };
  if (typeof bids.W === 'number' && typeof bids.B === 'number' && !bids.revealed) {
    const startingPlayer = bids.W === bids.B ? 'W' : bids.W! > bids.B! ? 'W' : 'B';
    const credits = { ...next.credits };
    credits.W -= bids.W!;
    credits.B -= bids.B!;
    next.credits = credits;
    next.bids = { ...bids, revealed: true, startingPlayer };
    recalcScores(next);
  }
  return next;
}

function handleStartPlacement(state: GameState): GameState {
  if (state.phase !== 'BIDDING') return state;
  if (!state.bids.revealed) return state;
  const turn = state.bids.startingPlayer ?? 'W';
  return { ...state, phase: 'PLACEMENT', turn, passesInARow: 0 };
}

function handlePlacement(state: GameState, r: number, c: number): GameState {
  if (state.phase !== 'PLACEMENT' || !state.turn) return state;
  if (state.board[r][c]) return state;
  if (state.placementCounts[state.turn] >= 10) return state;
  const cost = squareCostForPlayer(state, state.turn, r, c);
  if (cost <= 0) return state;
  if (state.credits[state.turn] < cost) return state;
  const id = newId();
  const stones = { ...state.stones };
  const board = state.board.map(row => row.slice());
  const credits = { ...state.credits };
  const stone: Stone = { id, owner: state.turn, r, c };
  stones[id] = stone;
  board[r][c] = id;
  credits[state.turn] -= cost;
  const nextTurn = state.turn === 'W' ? 'B' : 'W';
  const placementCounts = { ...state.placementCounts, [state.turn]: state.placementCounts[state.turn] + 1 };
  const blockedLabels = {
    W: { ...state.blockedLabels.W },
    B: { ...state.blockedLabels.B },
  };
  if (cost > 0) {
    blockedLabels[nextTurn] = {
      ...blockedLabels[nextTurn],
      [cost]: true,
    };
  }
  const next: GameState = {
    ...state,
    stones,
    board,
    credits,
    turn: nextTurn,
    lastPlacementBy: state.turn,
    lastPlacementId: id,
    passesInARow: 0,
    placementCounts,
    blockedLabels,
  };
  recalcScores(next);
  return next;
}

function handlePlacementPass(state: GameState): GameState {
  if (state.phase !== 'PLACEMENT' || !state.turn) return state;
  const player = state.turn;
  const placed = state.placementCounts[player];
  if (placed < 1 && hasPlacementOption(state, player)) {
    return state;
  }
  const passes = state.passesInARow + 1;
  if (passes >= 2) {
    return endPlacement(state);
  }
  return {
    ...state,
    passesInARow: passes,
    turn: state.turn === 'W' ? 'B' : 'W',
  };
}

function endPlacement(state: GameState): GameState {
  return {
    ...state,
    phase: 'ASSIGN_STATS_W',
    turn: 'W',
    passesInARow: 0,
  };
}

function handleAssignStats(state: GameState, player: Player, assignments: Record<string, Assignment>): GameState {
  if (state.phase !== 'ASSIGN_STATS_W' && state.phase !== 'ASSIGN_STATS_B') return state;
  if ((state.phase === 'ASSIGN_STATS_W' && player !== 'W') || (state.phase === 'ASSIGN_STATS_B' && player !== 'B')) {
    return state;
  }
  const cost = calculateAssignmentCost(assignments);
  if (cost > state.credits[player]) return state;
  const stones = { ...state.stones };
  for (const id of Object.keys(assignments)) {
    const stone = stones[id];
    if (!stone || stone.owner !== player) continue;
    const update = assignments[id];
    stones[id] = {
      ...stone,
      d: update.d,
      dirs: update.dirs,
      persistent: !!update.persistent,
    };
  }
  const credits = { ...state.credits };
  credits[player] -= cost;
  const normalizedAssignments = Object.keys(assignments).reduce<Record<string, Assignment>>((acc, key) => {
    const value = assignments[key];
    acc[key] = { ...value, persistent: !!value.persistent };
    return acc;
  }, {});
  const assignmentsState = {
    ...state.assignments,
    [player]: normalizedAssignments,
  };
  const base: GameState = {
    ...state,
    stones,
    credits,
    assignments: assignmentsState,
  };
  if (player === 'W') {
    base.phase = 'ASSIGN_STATS_B';
    base.turn = 'B';
    recalcScores(base);
    return base;
  }
  base.phase = 'MOVEMENT_BIDDING';
  base.turn = null;
  base.passesInARow = 0;
  base.movement = {
    bids: { revealed: false },
    moveCount: 0,
  };
  recalcScores(base);
  return base;
}

function handleMovementBid(state: GameState, player: Player, bid: number): GameState {
  if (state.phase !== 'MOVEMENT_BIDDING') return state;
  if (state.movement.bids[player] !== undefined) return state;
  const max = state.credits[player];
  const value = clamp(bid, 0, max);
  const bids = { ...state.movement.bids, [player]: value };
  const next: GameState = {
    ...state,
    movement: {
      ...state.movement,
      bids,
    },
  };
  const wBid = bids.W;
  const bBid = bids.B;
  if (typeof wBid === 'number' && typeof bBid === 'number' && !bids.revealed) {
    const winner = wBid === bBid ? 'W' : wBid > bBid ? 'W' : 'B';
    const winningBid = winner === 'W' ? wBid : bBid;
    const credits = { ...state.credits };
    credits[winner] = Math.max(0, credits[winner] - winningBid);
    const updatedBids = { ...bids, revealed: true, winner };
    const movement = {
      ...state.movement,
      bids: updatedBids,
      moveLimit: winningBid,
      moveCount: 0,
      decider: winner,
      startingPlayer: undefined,
    };
    const result: GameState = {
      ...state,
      credits,
      movement,
    };
    recalcScores(result);
    return result;
  }
  return next;
}

function handleMovementPlan(
  state: GameState,
  player: Player,
  startingPlayer: Player,
): GameState {
  if (state.phase !== 'MOVEMENT_BIDDING') return state;
  if (!state.movement.bids.revealed) return state;
  if (state.movement.bids.winner !== player) return state;
  const limit = state.movement.moveLimit ?? 0;
  const movement = {
    ...state.movement,
    moveCount: 0,
    startingPlayer,
    decider: player,
  };
  const base: GameState = {
    ...state,
    movement,
    passesInARow: 0,
  };
  if (limit <= 0) {
    const ended: GameState = {
      ...base,
      phase: 'ENDED',
      turn: null,
    };
    recalcScores(ended);
    ended.winner = determineScoreWinner(ended);
    return ended;
  }
  return {
    ...base,
    phase: 'MOVEMENT',
    turn: startingPlayer,
  };
}

function handleMovementMove(state: GameState, stoneId: string, r: number, c: number): GameState {
  if (state.phase !== 'MOVEMENT' || !state.turn) return state;
  const stone = state.stones[stoneId];
  if (!stone || stone.owner !== state.turn) return state;
  const moves = legalMoves(state, stone);
  if (!moves.some(m => m.r === r && m.c === c)) return state;
  const stones = { ...state.stones };
  const board = state.board.map(row => row.slice());
  board[stone.r][stone.c] = null;
  const occupantId = board[r][c];
  let lastPlacementId = state.lastPlacementId;
  if (occupantId) {
    const occ = stones[occupantId];
    if (occ) delete stones[occ.id];
    if (stone.persistent) {
      stones[stone.id] = { ...stone, r, c };
      board[r][c] = stone.id;
    } else {
      delete stones[stone.id];
      board[r][c] = null;
    }
    lastPlacementId = undefined;
  } else {
    stones[stone.id] = { ...stone, r, c };
    board[r][c] = stone.id;
    lastPlacementId = undefined;
  }
  const player = state.turn;
  const opponent = player === 'W' ? 'B' : 'W';
  const nextTurn = opponent;
  const moveCount = state.movement.moveCount + 1;
  const nextMovement = {
    ...state.movement,
    moveCount,
  };
  const next: GameState = {
    ...state,
    stones,
    board,
    turn: nextTurn,
    lastPlacementId,
    passesInARow: 0,
    movement: nextMovement,
  };
  recalcScores(next);

  const limit = state.movement.moveLimit;
  if (limit !== undefined && moveCount >= limit) {
    next.phase = 'ENDED';
    next.turn = null;
    const winner = determineScoreWinner(next);
    next.winner = winner;
  }
  return next;
}

function handleMovementPass(state: GameState): GameState {
  if (state.phase !== 'MOVEMENT' || !state.turn) return state;
  const player = state.turn;
  const opponent = player === 'W' ? 'B' : 'W';
  const passes = state.passesInARow + 1;
  const next: GameState = {
    ...state,
    turn: opponent,
    passesInARow: passes >= 2 ? 0 : passes,
  };
  if (passes >= 2) {
    recalcScores(next);
    next.phase = 'ENDED';
    next.turn = null;
    next.winner = determineScoreWinner(next);
  }
  return next;
}

export function calculateAssignmentCost(assignments: Record<string, Assignment>): number {
  let total = 0;
  for (const id of Object.keys(assignments)) {
    const { d, dirs, persistent } = assignments[id];
    const bits =
      (dirs & DIR.R ? 1 : 0) +
      (dirs & DIR.L ? 1 : 0) +
      (dirs & DIR.U ? 1 : 0) +
      (dirs & DIR.D ? 1 : 0) +
      (dirs & DIR.UR ? 1 : 0) +
      (dirs & DIR.UL ? 1 : 0) +
      (dirs & DIR.DR ? 1 : 0) +
      (dirs & DIR.DL ? 1 : 0);
    const extras = persistent ? 1 : 0;
    total += d * (bits + extras);
  }
  return total;
}

export function hasAnyLegalMove(state: GameState, player: Player): boolean {
  return Object.values(state.stones).some(stone => {
    if (stone.owner !== player) return false;
    return legalMoves(state, stone).length > 0;
  });
}

export function getTickingMode(state: GameState): 'none' | 'both' | Player {
  switch (state.phase) {
    case 'BIDDING': {
      if (state.bids.revealed) return 'none';
      const wLocked = typeof state.bids.W === 'number';
      const bLocked = typeof state.bids.B === 'number';
      if (wLocked && bLocked) return 'none';
      if (wLocked) return 'B';
      if (bLocked) return 'W';
      return 'both';
    }
    case 'MOVEMENT_BIDDING': {
      if (state.movement.bids.revealed) return 'none';
      const wLocked = typeof state.movement.bids.W === 'number';
      const bLocked = typeof state.movement.bids.B === 'number';
      if (wLocked && bLocked) return 'none';
      if (wLocked) return 'B';
      if (bLocked) return 'W';
      return 'both';
    }
    case 'PLACEMENT':
      return state.turn ?? 'none';
    case 'ASSIGN_STATS_W':
      return 'W';
    case 'ASSIGN_STATS_B':
      return 'B';
    case 'MOVEMENT':
      return state.turn ?? 'none';
    default:
      return 'none';
  }
}

export function determineScoreWinner(state: GameState): Player {
  if (state.scores.W === state.scores.B) {
    return 'B';
  }
  return state.scores.W > state.scores.B ? 'W' : 'B';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
