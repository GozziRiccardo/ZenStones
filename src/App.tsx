import * as React from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useAuth } from './auth/AuthContext';
import { watchUserProfile } from './lib/matchmaking';

const TICK_INTERVAL = 100;
const STATE_STORAGE_KEY = 'zenstones-state';

function loadPersistedState(key: string): GameState | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) return null;
  try {
    const raw = window.localStorage.getItem(key);
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
    if (!parsed.blockedLabels) {
      parsed.blockedLabels = { W: {}, B: {} };
    }
    return parsed;
    } catch (err) {
      console.warn('Failed to load saved game state:', err);
      try {
        window.localStorage.removeItem(key);
    } catch {
      // ignore secondary errors removing corrupted state
    }
    return null;
  }
}

type Toast = { id: number; message: string };

type MatchPlayersData = {
  playerUids: string[];
  players: Record<string, { nickname?: string; elo?: number }>;
};

type AppProps = {
  matchId?: string;
  matchData?: MatchPlayersData;
};

type TemporaryScreen =
  | { type: 'intro'; opponentNickname: string; opponentElo?: number | null; color: Player }
  | { type: 'bid-result'; winner: Player; winningBid: number; bids: { W?: number; B?: number } };

export default function App({ matchId, matchData }: AppProps) {
  const navigate = useNavigate();
  const persistenceKey = React.useMemo(
    () => (matchId ? `${STATE_STORAGE_KEY}-${matchId}` : STATE_STORAGE_KEY),
    [matchId],
  );
  const [state, dispatch] = React.useReducer(
    gameReducer,
    undefined,
    () => loadPersistedState(persistenceKey) ?? createInitialState(),
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectionSource, setSelectionSource] = React.useState<'movement' | 'assign' | null>(null);
  const [blockedPreview, setBlockedPreview] = React.useState<{ r: number; c: number } | null>(null);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const { user, nickname, logout } = useAuth();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [overlay, setOverlay] = React.useState<TemporaryScreen | null>(null);
  const [overlayCountdown, setOverlayCountdown] = React.useState(0);
  const overlayTimerRef = React.useRef<number | null>(null);
  const introShownRef = React.useRef(false);
  const bidsOverlayShownRef = React.useRef(false);
  const playerUids = React.useMemo(() => (matchData ? matchData.playerUids.slice() : []), [matchData]);
  const sortedUids = React.useMemo(() => playerUids.slice().sort(), [playerUids]);
  const colorAssignments = React.useMemo(() => {
    const map: Record<string, Player> = {};
    sortedUids.forEach((uid, index) => {
      if (index === 0) {
        map[uid] = 'W';
      } else if (index === 1) {
        map[uid] = 'B';
      } else {
        map[uid] = index % 2 === 0 ? 'W' : 'B';
      }
    });
    return map;
  }, [sortedUids]);
  const myColor: Player = colorAssignments[user.uid] ?? 'W';
  const opponentUid = React.useMemo(
    () => sortedUids.find((uid) => uid !== user.uid) ?? null,
    [sortedUids, user.uid],
  );
  const myDisplayName = React.useMemo(() => {
    const entry = matchData?.players?.[user.uid];
    if (entry?.nickname && entry.nickname.trim()) {
      return entry.nickname;
    }
    return nickname;
  }, [matchData, user.uid, nickname]);
  const opponentNickname = React.useMemo(() => {
    if (!opponentUid) return null;
    const entry = matchData?.players?.[opponentUid];
    if (entry?.nickname && entry.nickname.trim()) {
      return entry.nickname;
    }
    return 'Opponent';
  }, [matchData, opponentUid]);
  const opponentColor: Player | null = opponentUid
    ? colorAssignments[opponentUid] ?? (myColor === 'W' ? 'B' : 'W')
    : null;
  const myInitialElo = matchData?.players?.[user.uid]?.elo;
  const opponentInitialElo = opponentUid ? matchData?.players?.[opponentUid]?.elo : undefined;
  const myElo = usePlayerElo(user.uid, myInitialElo);
  const opponentElo = usePlayerElo(opponentUid, opponentInitialElo);
  const toastId = React.useRef(0);
  const lastTick = React.useRef<number>(Date.now());
  const toastTimers = React.useRef<Record<number, number>>({});
  const blockedTimer = React.useRef<number | null>(null);

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
      if (blockedTimer.current !== null) {
        window.clearTimeout(blockedTimer.current);
        blockedTimer.current = null;
      }
    };
  }, []);

  const clearBlockedPreview = React.useCallback(() => {
    setBlockedPreview(null);
    if (blockedTimer.current !== null) {
      window.clearTimeout(blockedTimer.current);
      blockedTimer.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (state.phase !== 'PLACEMENT') {
      clearBlockedPreview();
    }
  }, [state.phase, clearBlockedPreview]);

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
      window.localStorage.setItem(persistenceKey, JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to save game state:', err);
    }
  }, [state, persistenceKey]);

  const clearOverlayTimer = React.useCallback(() => {
    if (overlayTimerRef.current !== null) {
      window.clearInterval(overlayTimerRef.current);
      overlayTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      clearOverlayTimer();
    };
  }, [clearOverlayTimer]);

  React.useEffect(() => {
    if (!overlay) {
      clearOverlayTimer();
      return;
    }
    setOverlayCountdown(10);
    clearOverlayTimer();
    overlayTimerRef.current = window.setInterval(() => {
      setOverlayCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      clearOverlayTimer();
    };
  }, [overlay, clearOverlayTimer]);

  const handleOverlayComplete = React.useCallback(
    (screen: TemporaryScreen) => {
      if (screen.type === 'bid-result') {
        dispatch({ type: 'startPlacement' });
      }
    },
    [dispatch],
  );

  React.useEffect(() => {
    if (!overlay) return;
    if (overlayCountdown <= 0) {
      const finished = overlay;
      setOverlay(null);
      handleOverlayComplete(finished);
    }
  }, [overlayCountdown, overlay, handleOverlayComplete]);

  React.useEffect(() => {
    introShownRef.current = false;
    bidsOverlayShownRef.current = false;
  }, [matchId]);

  React.useEffect(() => {
    if (state.phase === 'BIDDING' && !state.bids.revealed) {
      bidsOverlayShownRef.current = false;
    }
  }, [state.phase, state.bids.revealed]);

  React.useEffect(() => {
    if (!matchId) return;
    if (!opponentUid) return;
    if (introShownRef.current) return;
    if (overlay) return;
    introShownRef.current = true;
    setOverlay({
      type: 'intro',
      opponentNickname: opponentNickname ?? 'Opponent',
      opponentElo: opponentElo ?? null,
      color: myColor,
    });
  }, [matchId, opponentUid, opponentNickname, opponentElo, myColor, overlay]);

  React.useEffect(() => {
    if (state.phase !== 'BIDDING') return;
    if (!state.bids.revealed) return;
    if (bidsOverlayShownRef.current) return;
    if (overlay) return;
    const winner = state.bids.startingPlayer ?? 'W';
    const winningBid = winner === 'W' ? state.bids.W ?? 0 : state.bids.B ?? 0;
    bidsOverlayShownRef.current = true;
    setOverlay({
      type: 'bid-result',
      winner,
      winningBid,
      bids: { W: state.bids.W, B: state.bids.B },
    });
  }, [state.phase, state.bids.revealed, state.bids.startingPlayer, state.bids.W, state.bids.B, overlay]);

  const prevPhase = React.useRef(state.phase);
  React.useEffect(() => {
    if (prevPhase.current !== state.phase) {
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

  const prevMovementReveal = React.useRef(state.movement.bids.revealed);
  React.useEffect(() => {
    if (!prevMovementReveal.current && state.movement.bids.revealed) {
      const chooser = state.movement.bids.winner === 'B' ? 'Black' : 'White';
      const limit = state.movement.moveLimit ?? 0;
      const summary = `${limit} move${limit === 1 ? '' : 's'}`;
      pushToast(`Movement bids revealed. ${chooser} will choose who starts — limit: ${summary}.`);
    }
    prevMovementReveal.current = state.movement.bids.revealed;
  }, [state.movement.bids.revealed, state.movement.bids.winner, pushToast, state.movement.moveLimit]);

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
    if (cost <= 0) {
      setBlockedPreview({ r, c });
      if (blockedTimer.current !== null) {
        window.clearTimeout(blockedTimer.current);
      }
      blockedTimer.current = window.setTimeout(() => {
        setBlockedPreview(null);
        blockedTimer.current = null;
      }, 650);
      pushToast('That square is not available.');
      return;
    }
    if (state.credits[state.turn] < cost) {
      pushToast('Not enough credits for that square.');
      return;
    }
    dispatch({ type: 'placementSquare', r, c });
    clearBlockedPreview();
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

  const handleMovementPlan = (player: Player, startingPlayer: Player) => {
    dispatch({ type: 'movementPlan', player, startingPlayer });
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

  const handleResign = React.useCallback(() => {
    if (state.phase === 'ENDED') return;
    dispatch({ type: 'resign', player: myColor });
    setSelectedId(null);
    setSelectionSource(null);
    pushToast('You resigned.');
  }, [dispatch, myColor, pushToast, state.phase]);

  const handleLogout = React.useCallback(async () => {
    try {
      setLoggingOut(true);
      await logout();
      try {
        window.localStorage.removeItem(persistenceKey);
      } catch {
        // ignore storage cleanup errors
      }
      navigate('/login', { replace: true });
    } catch (err) {
      console.warn('Failed to log out:', err);
    } finally {
      setLoggingOut(false);
    }
  }, [logout, navigate, persistenceKey]);

  const mustPass = React.useMemo(() => {
    if (state.phase !== 'MOVEMENT' || !state.turn) return false;
    return !Object.values(state.stones).some((stone) => {
      if (stone.owner !== state.turn) return false;
      return legalMoves(state, stone).length > 0;
    });
  }, [state]);

  const tickingMode = getTickingMode(state);
  const isBiddingPhase = state.phase === 'BIDDING';
  const myClockValue = state.clocks[myColor] ?? state.clocks.W;
  const myClockActive = tickingMode === 'both' || tickingMode === myColor;
  const showOpponentChip = Boolean(opponentUid);
  const displayedOpponentNickname = opponentNickname ?? 'Opponent';

  return (
    <div className="container game-container">
      <header className="game-header">
        <div className="h1">ZenStones</div>
        <div className="game-header-right">
          <PlayerChip label="You" nickname={myDisplayName} elo={myElo} color={myColor} />
          {showOpponentChip ? (
            <PlayerChip
              label="Opponent"
              nickname={displayedOpponentNickname}
              elo={opponentElo}
              color={opponentColor ?? (myColor === 'W' ? 'B' : 'W')}
            />
          ) : null}
          <button className="btn outline" onClick={handleResign} disabled={state.phase === 'ENDED'}>
            Resign
          </button>
          <button className="btn outline" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      {isBiddingPhase ? (
        <div className="bidding-view">
          <ClockCard label="Your clock" ms={myClockValue} active={myClockActive} />
          <BiddingPanel state={state} player={myColor} lockBid={handleLockBid} />
        </div>
      ) : (
        <>
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
              blockedPreview={blockedPreview}
            />
            <div style={{ flex: 1, minWidth: 320 }}>
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
        </>
      )}

      <ToastStack items={toasts} />
      {overlay ? <TemporaryScreenView screen={overlay} countdown={overlayCountdown} /> : null}
    </div>
  );
}

function PlayerChip({ label, nickname, elo, color }: { label: string; nickname: string; elo: number | null; color: Player }) {
  const indicatorClass = `player-indicator ${color === 'W' ? 'player-white' : 'player-black'}`;
  return (
    <div className="player-chip">
      <span className={indicatorClass} aria-hidden />
      <div className="player-chip-text">
        <div className="player-chip-role">{label}</div>
        <div className="player-chip-name">{nickname}</div>
        <div className="player-chip-elo">Elo {typeof elo === 'number' ? elo : '—'}</div>
      </div>
    </div>
  );
}

function ClockCard({ label, ms, active }: { label: string; ms: number; active: boolean }) {
  const classes = ['clock-card'];
  if (active) classes.push('active');
  return (
    <div className={classes.join(' ')}>
      <div className="clock-label">{label}</div>
      <div className="clock-value">{formatClock(ms)}</div>
    </div>
  );
}

function TemporaryScreenView({ screen, countdown }: { screen: TemporaryScreen; countdown: number }) {
  const countdownValue = Math.max(0, countdown);
  if (screen.type === 'intro') {
    return (
      <div className="temporary-screen">
        <div className="temporary-card">
          <div className="temporary-countdown">{countdownValue}</div>
          <div className="temporary-line">
            You are playing <b>{screen.opponentNickname}</b> with strength <b>{typeof screen.opponentElo === 'number' ? screen.opponentElo : '—'}</b>.
          </div>
          <div className="temporary-line">
            You have been assigned <b>{screen.color === 'W' ? 'White' : 'Black'}</b>.
          </div>
          <div className="temporary-line">Good luck!</div>
        </div>
      </div>
    );
  }
  return (
    <div className="temporary-screen">
      <div className="temporary-card">
        <div className="temporary-countdown">{countdownValue}</div>
        <div className="temporary-line">
          Winning bid: <b>{screen.winningBid}</b> ({screen.winner === 'W' ? 'White' : 'Black'}).
        </div>
        <div className="temporary-line">
          White bid <b>{screen.bids.W ?? 0}</b> — Black bid <b>{screen.bids.B ?? 0}</b>.
        </div>
        <div className="temporary-line">
          {screen.winner === 'W' ? 'White' : 'Black'} will start placement.
        </div>
      </div>
    </div>
  );
}

function formatClock(ms: number) {
  const clamped = Math.max(0, ms);
  const minutes = Math.floor(clamped / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function usePlayerElo(uid: string | null, initial?: number) {
  const [value, setValue] = React.useState<number | null>(
    typeof initial === 'number' ? initial : null,
  );

  React.useEffect(() => {
    setValue(typeof initial === 'number' ? initial : null);
  }, [initial]);

  React.useEffect(() => {
    if (!uid) {
      setValue(null);
      return;
    }
    return watchUserProfile(uid, (data) => {
      if (typeof data?.elo === 'number') {
        setValue(data.elo);
      } else {
        setValue(null);
      }
    });
  }, [uid]);

  return value;
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
