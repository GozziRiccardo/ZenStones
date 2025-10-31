import * as React from 'react';
import './styles.css';
import type { Assignment, GameState, Player } from './game/types';
import { legalMoves, squareCostForPlayer, restoreIdCounter, hasPlacementOption } from './game/utils';
import { Board } from './components/Board';
import { HUD } from './components/HUD';
import { BiddingPanel } from './panels/BiddingPanel';
import { PlacementPanel } from './panels/PlacementPanel';
import { AssignStatsPanel } from './panels/AssignStatsPanel';
import { ScoresPanel } from './panels/ScoresPanel';
import { MovementBiddingPanel } from './panels/MovementBiddingPanel';
import { createInitialState, gameReducer, getTickingMode } from './game/state';

const TICK_INTERVAL = 100;
const STATE_STORAGE_KEY = 'zenstones-state';

function loadPersistedState(): GameState | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) return null;
  try {
    const raw = window.localStorage.getItem(STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState | null;
    if (!parsed) return null;
    restoreIdCounter(parsed);
    if (!parsed.placementCounts) {
      const counts = { W: 0, B: 0 } as Record<Player, number>;
      for (const stone of Object.values(parsed.stones ?? {})) {
        counts[stone.owner] += 1;
      }
      parsed.placementCounts = counts;
    }
    return parsed;
  } catch (err) {
    console.warn('Failed to load saved game state:', err);
    try {
      window.localStorage.removeItem(STATE_STORAGE_KEY);
    } catch {
      // ignore secondary errors removing corrupted state
    }
    return null;
  }
}

type Toast = { id: number; message: string };

export default function App() {
  const [state, dispatch] = React.useReducer(
    gameReducer,
    undefined,
    () => loadPersistedState() ?? createInitialState(),
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectionSource, setSelectionSource] = React.useState<'movement' | 'assign' | null>(null);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const toastId = React.useRef(0);
  const lastTick = React.useRef<number>(Date.now());
  const toastTimers = React.useRef<Record<number, number>>({});

  const pushToast = React.useCallback((message: string) => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((items) => [...items, { id, message }]);
    const timer = window.setTimeout(() => {
      setToasts((items) => items.filter((t) => t.id !== id));
      delete toastTimers.current[id];
    }, 2200);
    toastTimers.current[id] = timer;
  }, []);

  React.useEffect(() => {
    return () => {
      Object.values(toastTimers.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  React.useEffect(() => {
    lastTick.current = Date.now();
  }, [state.phase, state.turn]);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      const dt = now - lastTick.current;
      lastTick.current = now;
      dispatch({ type: 'tick', dt });
    }, TICK_INTERVAL);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !('localStorage' in window)) return;
    try {
      window.localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to save game state:', err);
    }
  }, [state]);

  const prevPhase = React.useRef(state.phase);
  React.useEffect(() => {
    if (prevPhase.current !== state.phase) {
      if (state.phase === 'PLACEMENT' && prevPhase.current === 'BIDDING') {
        const starter = state.bids.startingPlayer === 'B' ? 'Black' : 'White';
        pushToast(`Bids applied. ${starter} starts placement.`);
      }
      if (state.phase === 'MOVEMENT_BIDDING') {
        pushToast('Movement bidding begins.');
      }
      if (state.phase === 'MOVEMENT' && prevPhase.current !== 'MOVEMENT') {
        const limit = state.movement.moveLimit;
        const summary = limit !== undefined ? `${limit} move${limit === 1 ? '' : 's'}` : 'free movement';
        pushToast(`Movement phase begins — limit: ${summary}.`);
      }
      if (state.phase === 'ENDED' && state.winner) {
        pushToast(`Game over — ${state.winner} wins.`);
      }
      prevPhase.current = state.phase;
    }
  }, [state.phase, state.bids.startingPlayer, state.winner, state.movement.moveLimit, pushToast]);

  const prevRevealed = React.useRef(state.bids.revealed);
  React.useEffect(() => {
    if (!prevRevealed.current && state.bids.revealed) {
      const starter = state.bids.startingPlayer === 'B' ? 'Black' : 'White';
      pushToast(`Bids revealed. ${starter} has initiative.`);
    }
    prevRevealed.current = state.bids.revealed;
  }, [state.bids.revealed, state.bids.startingPlayer, pushToast]);

  const prevMovementReveal = React.useRef(state.movement.bids.revealed);
  React.useEffect(() => {
    if (!prevMovementReveal.current && state.movement.bids.revealed) {
      const chooser = state.movement.bids.winner === 'B' ? 'Black' : 'White';
      pushToast(`Movement bids revealed. ${chooser} will set the plan.`);
    }
    prevMovementReveal.current = state.movement.bids.revealed;
  }, [state.movement.bids.revealed, state.movement.bids.winner, pushToast]);

  React.useEffect(() => {
    if (!selectedId) return;
    const stone = state.stones[selectedId];
    if (!stone) {
      setSelectedId(null);
      setSelectionSource(null);
      return;
    }
    if (selectionSource === 'movement') {
      if (state.phase !== 'MOVEMENT' || stone.owner !== state.turn) {
        setSelectedId(null);
        setSelectionSource(null);
      }
    } else if (selectionSource === 'assign') {
      const expectedPlayer = state.phase === 'ASSIGN_STATS_W' ? 'W'
        : state.phase === 'ASSIGN_STATS_B' ? 'B' : null;
      if (!expectedPlayer || stone.owner !== expectedPlayer) {
        setSelectedId(null);
        setSelectionSource(null);
      }
    }
  }, [state.phase, state.turn, state.stones, selectedId, selectionSource]);

  const selectedMoves = React.useMemo(() => {
    if (!selectedId) return [] as { r: number; c: number }[];
    if (state.phase !== 'MOVEMENT' || !state.turn) return [];
    const stone = state.stones[selectedId];
    if (!stone || stone.owner !== state.turn) return [];
    return legalMoves(state, stone);
  }, [selectedId, state]);

  const handlePlacementSquare = (r: number, c: number) => {
    if (state.phase !== 'PLACEMENT' || !state.turn) return;
    if (state.board[r][c]) return;
    if (state.placementCounts[state.turn] >= 10) {
      pushToast('You have already placed ten stones this phase.');
      return;
    }
    const cost = squareCostForPlayer(state, state.turn, r, c);
    if (cost <= 0) return;
    if (state.credits[state.turn] < cost) {
      pushToast('Not enough credits for that square.');
      return;
    }
    dispatch({ type: 'placementSquare', r, c });
  };

  const handleMovementSquare = (r: number, c: number) => {
    if (state.phase !== 'MOVEMENT' || !state.turn) return;
    const targetId = state.board[r][c];
    if (selectedId) {
      if (!selectedMoves.some((m) => m.r === r && m.c === c)) {
        setSelectedId(null);
        setSelectionSource(null);
        return;
      }
      dispatch({ type: 'movementMove', stoneId: selectedId, r, c });
      setSelectedId(null);
      setSelectionSource(null);
      return;
    }
    if (!targetId) return;
    const stone = state.stones[targetId];
    if (!stone || stone.owner !== state.turn) return;
    const moves = legalMoves(state, stone);
    if (moves.length === 0) {
      pushToast('No legal moves for that stone.');
      return;
    }
    setSelectedId(stone.id);
    setSelectionSource('movement');
  };

  const onSquareClick = (r: number, c: number) => {
    if (state.phase === 'PLACEMENT') {
      handlePlacementSquare(r, c);
    } else if (state.phase === 'MOVEMENT') {
      handleMovementSquare(r, c);
    }
  };

  const handleLockBid = (player: Player, bid: number) => {
    dispatch({ type: 'lockBid', player, bid });
  };

  const handleStartPlacement = () => dispatch({ type: 'startPlacement' });
  const handlePlacementPass = () => {
    if (state.phase !== 'PLACEMENT' || !state.turn) return;
    const player = state.turn;
    const placed = state.placementCounts[player];
    const canPlace = hasPlacementOption(state, player);
    if (placed < 1 && canPlace) {
      pushToast('You must place at least one stone before passing.');
      return;
    }
    dispatch({ type: 'placementPass' });
  };

  const handleAssignCommit = (player: Player, assignments: Record<string, Assignment>) => {
    dispatch({ type: 'assignStats', player, assignments });
    setSelectedId(null);
    setSelectionSource(null);
  };

  const handleMovementBid = (player: Player, bid: number) => {
    dispatch({ type: 'movementBid', player, bid });
  };

  const handleMovementPlan = (player: Player, moveLimit: number, startingPlayer: Player) => {
    dispatch({ type: 'movementPlan', player, moveLimit, startingPlayer });
  };

  const handleAssignFocus = (stoneId: string | null) => {
    setSelectedId(stoneId);
    setSelectionSource(stoneId ? 'assign' : null);
  };

  const handleMovementPass = () => {
    if (state.phase === 'MOVEMENT') {
      dispatch({ type: 'movementPass' });
      setSelectedId(null);
      setSelectionSource(null);
    }
  };

  const handleReset = () => {
    if (window.confirm('Start a new game and reset all progress?')) {
      dispatch({ type: 'reset' });
      setSelectedId(null);
      setSelectionSource(null);
    }
  };

  const mustPass = React.useMemo(() => {
    if (state.phase !== 'MOVEMENT' || !state.turn) return false;
    return !Object.values(state.stones).some((stone) => {
      if (stone.owner !== state.turn) return false;
      return legalMoves(state, stone).length > 0;
    });
  }, [state]);

  const tickingMode = getTickingMode(state);

  return (
    <div className="container">
      <div className="row">
        <div className="h1">ZenStones</div>
        <div className="row gap">
          <button className="btn outline" onClick={handleReset}>New Game</button>
        </div>
      </div>

      <HUD state={state} tickingMode={tickingMode} />
      <ScoresPanel state={state} />

      {state.phase === 'ENDED' ? (
        <div className="card"><b>Game Over.</b> Winner: {state.winner}</div>
      ) : null}

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Board
          state={state}
          onSquareClick={onSquareClick}
          highlights={selectedMoves}
          selectedId={selectedId}
        />
        <div style={{ flex: 1, minWidth: 320 }}>
          {state.phase === 'BIDDING' && (
            <BiddingPanel
              state={state}
              lockBid={handleLockBid}
              startPlacement={handleStartPlacement}
            />
          )}
          {state.phase === 'PLACEMENT' && (
            <PlacementPanel
              state={state}
              onPass={handlePlacementPass}
            />
          )}
          {state.phase === 'ASSIGN_STATS_W' && (
            <AssignStatsPanel
              state={state}
              player="W"
              onCommit={(assignments) => handleAssignCommit('W', assignments)}
              onFocusStone={handleAssignFocus}
              focusedStoneId={selectionSource === 'assign' ? selectedId : null}
            />
          )}
          {state.phase === 'ASSIGN_STATS_B' && (
            <AssignStatsPanel
              state={state}
              player="B"
              onCommit={(assignments) => handleAssignCommit('B', assignments)}
              onFocusStone={handleAssignFocus}
              focusedStoneId={selectionSource === 'assign' ? selectedId : null}
            />
          )}
          {state.phase === 'MOVEMENT_BIDDING' && (
            <MovementBiddingPanel
              state={state}
              lockBid={handleMovementBid}
              submitPlan={handleMovementPlan}
            />
          )}
          {state.phase === 'MOVEMENT' && (
            <div className="card movement-card">
              <b>Movement:</b> Select one of your stones, then click a highlighted square. Captures remove both stones. You may also pass.
              <button className="btn outline" onClick={handleMovementPass} style={{ marginTop: 8 }}>
                {mustPass ? 'Pass (no moves available)' : 'Pass'}
              </button>
              {mustPass ? <div className="small" style={{ marginTop: 4 }}>You have no legal moves available.</div> : null}
            </div>
          )}
        </div>
      </div>

      <ToastStack items={toasts} />
    </div>
  );
}

function ToastStack({ items }: { items: Toast[] }) {
  if (items.length === 0) return null;
  return (
    <div className="toast-stack">
      {items.map((toast) => (
        <div key={toast.id} className="toast">
          {toast.message}
        </div>
      ))}
    </div>
  );
}
