import { makeLabels } from './labels';
import type { Assignment, GameState, Player, Stone } from './types';
import { DIR } from './types';
import { emptyBoard, hasAnyLegalMove, legalMoves, newId, recalcScores, resetIdCounter, squareCostForPlayer } from './utils';

export type GameAction =
  | { type: 'reset' }
  | { type: 'tick'; dt: number }
  | { type: 'lockBid'; player: Player; bid: number }
  | { type: 'startPlacement' }
  | { type: 'placementSquare'; r: number; c: number }
  | { type: 'placementPass' }
  | { type: 'assignStats'; player: Player; assignments: Record<string, Assignment> }
  | { type: 'movementMove'; stoneId: string; r: number; c: number }
  | { type: 'movementSkip' };

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
    pendingScoreVictory: null,
  };
  recalcScores(base);
  return base;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
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
    case 'movementMove':
      return handleMovementMove(state, action.stoneId, action.r, action.c);
    case 'movementSkip':
      return handleMovementSkip(state);
    default:
      return state;
  }
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
  const next: GameState = {
    ...state,
    stones,
    board,
    credits,
    turn: nextTurn,
    lastPlacementBy: state.turn,
    lastPlacementId: id,
    passesInARow: 0,
  };
  recalcScores(next);
  return next;
}

function handlePlacementPass(state: GameState): GameState {
  if (state.phase !== 'PLACEMENT' || !state.turn) return state;
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
    stones[id] = { ...stone, ...assignments[id] };
  }
  const credits = { ...state.credits };
  credits[player] -= cost;
  const assignmentsState = {
    ...state.assignments,
    [player]: { ...assignments },
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
  base.phase = 'MOVEMENT';
  base.turn = state.lastPlacementBy === 'W' ? 'B' : 'W';
  recalcScores(base);
  return base;
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
    delete stones[stone.id];
    board[r][c] = null;
    lastPlacementId = undefined;
  } else {
    stones[stone.id] = { ...stone, r, c };
    board[r][c] = stone.id;
    lastPlacementId = undefined;
  }
  const player = state.turn;
  const opponent = player === 'W' ? 'B' : 'W';
  const nextTurn = opponent;
  const next: GameState = {
    ...state,
    stones,
    board,
    turn: nextTurn,
    lastPlacementId,
  };
  recalcScores(next);

  const anyW = Object.values(stones).some(s => s.owner === 'W');
  const anyB = Object.values(stones).some(s => s.owner === 'B');
  if (!anyW || !anyB) {
    next.phase = 'ENDED';
    next.winner = anyW ? 'W' : 'B';
    next.pendingScoreVictory = null;
    return next;
  }

  const hasMoveW = hasAnyLegalMove(next, 'W');
  const hasMoveB = hasAnyLegalMove(next, 'B');
  if (!hasMoveW && hasMoveB) {
    next.phase = 'ENDED';
    next.winner = 'B';
    next.pendingScoreVictory = null;
    return next;
  }
  if (!hasMoveB && hasMoveW) {
    next.phase = 'ENDED';
    next.winner = 'W';
    next.pendingScoreVictory = null;
    return next;
  }
  if (!hasMoveW && !hasMoveB) {
    next.phase = 'ENDED';
    next.winner = next.scores.W === next.scores.B ? player : next.scores.W > next.scores.B ? 'W' : 'B';
    next.pendingScoreVictory = null;
    return next;
  }

  let pending = state.pendingScoreVictory;
  if (pending && next.scores[pending] < 100) {
    pending = null;
  }
  if (!pending && next.scores[player] >= 100) {
    pending = player;
  }

  if (pending && player !== pending) {
    if (next.scores[player] > next.scores[pending]) {
      next.phase = 'ENDED';
      next.winner = player;
      next.pendingScoreVictory = null;
      return next;
    }
    if (next.scores[pending] >= 100) {
      next.phase = 'ENDED';
      next.winner = pending;
      next.pendingScoreVictory = null;
      return next;
    }
  }

  next.pendingScoreVictory = pending ?? null;
  return next;
}

function handleMovementSkip(state: GameState): GameState {
  if (state.phase !== 'MOVEMENT' || !state.turn) return state;
  const player = state.turn;
  if (hasAnyLegalMove(state, player)) return state;
  const opponent = player === 'W' ? 'B' : 'W';
  const opponentHasMove = hasAnyLegalMove(state, opponent);
  const next: GameState = {
    ...state,
    pendingScoreVictory: null,
  };
  if (opponentHasMove) {
    next.phase = 'ENDED';
    next.winner = opponent;
    return next;
  }
  next.phase = 'ENDED';
  next.winner = state.scores.W === state.scores.B ? player : state.scores.W > state.scores.B ? 'W' : 'B';
  return next;
}

export function calculateAssignmentCost(assignments: Record<string, Assignment>): number {
  let total = 0;
  for (const id of Object.keys(assignments)) {
    const { d, dirs } = assignments[id];
    const bits =
      (dirs & DIR.R ? 1 : 0) +
      (dirs & DIR.L ? 1 : 0) +
      (dirs & DIR.U ? 1 : 0) +
      (dirs & DIR.D ? 1 : 0);
    total += d * bits;
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
    case 'BIDDING':
      return state.bids.revealed ? 'none' : 'both';
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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
