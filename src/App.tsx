import * as React from 'react';
import './styles.css';
import type { Player } from './game/types';
import { legalMoves, squareCostForPlayer } from './game/utils';
import { Board } from './components/Board';
import { HUD } from './components/HUD';
import { BiddingPanel } from './panels/BiddingPanel';
import { PlacementPanel } from './panels/PlacementPanel';
import { AssignStatsPanel } from './panels/AssignStatsPanel';
import { ScoresPanel } from './panels/ScoresPanel';
import { createInitialState, gameReducer, getTickingMode, hasAnyLegalMove } from './game/state';
import type { Assignment } from './game/types';

const TICK_INTERVAL = 100;

type Toast = { id: number; message: string };

export default function App() {
  const [state, dispatch] = React.useReducer(gameReducer, undefined, createInitialState);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
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

  const prevPhase = React.useRef(state.phase);
  React.useEffect(() => {
    if (prevPhase.current !== state.phase) {
      if (state.phase === 'PLACEMENT' && prevPhase.current === 'BIDDING') {
        const starter = state.bids.startingPlayer === 'B' ? 'Black' : 'White';
        pushToast(`Bids applied. ${starter} starts placement.`);
      }
      if (state.phase === 'MOVEMENT' && prevPhase.current !== 'MOVEMENT') {
        pushToast('Movement phase begins.');
      }
      if (state.phase === 'ENDED' && state.winner) {
        pushToast(`Game over — ${state.winner} wins.`);
      }
      prevPhase.current = state.phase;
    }
  }, [state.phase, state.bids.startingPlayer, state.winner, pushToast]);

  const prevRevealed = React.useRef(state.bids.revealed);
  React.useEffect(() => {
    if (!prevRevealed.current && state.bids.revealed) {
      const starter = state.bids.startingPlayer === 'B' ? 'Black' : 'White';
      pushToast(`Bids revealed. ${starter} has initiative.`);
    }
    prevRevealed.current = state.bids.revealed;
  }, [state.bids.revealed, state.bids.startingPlayer, pushToast]);

  React.useEffect(() => {
    if (!selectedId) return;
    const stone = state.stones[selectedId];
    if (!stone || state.phase !== 'MOVEMENT' || stone.owner !== state.turn) {
      setSelectedId(null);
    }
  }, [state.phase, state.turn, state.stones, selectedId]);

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
        return;
      }
      dispatch({ type: 'movementMove', stoneId: selectedId, r, c });
      setSelectedId(null);
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
  const handlePlacementPass = () => dispatch({ type: 'placementPass' });

  const handleAssignCommit = (player: Player, assignments: Record<string, Assignment>) => {
    dispatch({ type: 'assignStats', player, assignments });
  };

  const handleMovementSkip = () => {
    if (state.phase === 'MOVEMENT') {
      dispatch({ type: 'movementSkip' });
      setSelectedId(null);
    }
  };

  const handleReset = () => {
    if (window.confirm('Start a new game and reset all progress?')) {
      dispatch({ type: 'reset' });
      setSelectedId(null);
    }
  };

  const canSkip = React.useMemo(() => {
    if (state.phase !== 'MOVEMENT' || !state.turn) return false;
    return !hasAnyLegalMove(state, state.turn);
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
            />
          )}
          {state.phase === 'ASSIGN_STATS_B' && (
            <AssignStatsPanel
              state={state}
              player="B"
              onCommit={(assignments) => handleAssignCommit('B', assignments)}
            />
          )}
          {state.phase === 'MOVEMENT' && (
            <div className="card movement-card">
              <b>Movement:</b> Select one of your stones, then click a highlighted square. Captures remove both stones.
              {canSkip ? (
                <button className="btn outline" onClick={handleMovementSkip} style={{ marginTop: 8 }}>
                  No legal moves — skip
                </button>
              ) : null}
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
