import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import './styles.css';
import type { Assignment, Player } from './game/types';
import { legalMoves, squareCostForPlayer, hasPlacementOption } from './game/utils';
import { Board } from './components/Board';
import { HUD, type PassControl } from './components/HUD';
import { BiddingPanel } from './panels/BiddingPanel';
import { AssignStatsPanel } from './panels/AssignStatsPanel';
import { MovementBiddingPanel } from './panels/MovementBiddingPanel';
import { getTickingMode } from './game/state';
import { useAuth } from './auth/AuthContext';
import { watchUserProfile } from './lib/matchmaking';
import { useGameController } from './game/useGameState';
import { db } from './lib/firebase';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';

const TICK_INTERVAL = 100;
const TICK_FAILOVER_DELAY = 4000;
const STATE_STORAGE_KEY = 'zenstones-state';

type Toast = { id: number; message: string };

type MatchPlayersData = {
  playerUids: string[];
  players: Record<string, { nickname?: string; elo?: number }>;
  colors?: Record<string, Player>;
  status?: string;
};

type AppProps = {
  matchId?: string;
  matchData?: MatchPlayersData;
};

type TemporaryScreen =
  | { type: 'intro'; opponentNickname: string; opponentElo?: number | null; color: Player }
  | { type: 'bid-result'; winner: Player; winningBid: number; bids: { W?: number; B?: number } }
  | { type: 'victory'; color: Player; nickname: string; elo: number | null };

export default function App({ matchId, matchData }: AppProps) {
  const navigate = useNavigate();
  const persistenceKey = React.useMemo(
    () => (matchId ? `${STATE_STORAGE_KEY}-${matchId}` : STATE_STORAGE_KEY),
    [matchId],
  );
  const {
    state,
    dispatch: rawDispatch,
    ready: stateReady,
    mode: gameMode,
    updatedAt: remoteUpdatedAt,
    syncError,
  } = useGameController(matchId, persistenceKey);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [selectionSource, setSelectionSource] = React.useState<'movement' | 'assign' | null>(null);
  const [blockedPreview, setBlockedPreview] = React.useState<{ r: number; c: number } | null>(null);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const { user, nickname } = useAuth();
  const [overlay, setOverlay] = React.useState<TemporaryScreen | null>(null);
  const [overlayCountdown, setOverlayCountdown] = React.useState(0);
  const overlayTimerRef = React.useRef<number | null>(null);
  const introShownRef = React.useRef(false);
  const bidsOverlayShownRef = React.useRef(false);
  const victoryOverlayShownRef = React.useRef(false);
  const finishedWrittenRef = React.useRef(false);
  const playerUids = React.useMemo(() => (matchData ? matchData.playerUids.slice() : []), [matchData]);
  const sortedUids = React.useMemo(() => playerUids.slice().sort(), [playerUids]);
  const colorAssignments = React.useMemo(() => {
    const map: Record<string, Player> = {};
    if (matchData?.colors) {
      for (const [uid, color] of Object.entries(matchData.colors)) {
        if (color === 'W' || color === 'B') {
          map[uid] = color;
        }
      }
    }
    sortedUids.forEach((uid, index) => {
      if (!map[uid]) {
        map[uid] = index % 2 === 0 ? 'W' : 'B';
      }
    });
    return map;
  }, [matchData?.colors, sortedUids]);
  const myColor: Player = colorAssignments[user.uid] ?? 'W';
  const opponentUid = React.useMemo(
    () => sortedUids.find((uid) => uid !== user.uid) ?? null,
    [sortedUids, user.uid],
  );
  const opponentColor: Player | undefined = opponentUid ? colorAssignments[opponentUid] : undefined;
  const safeOpponentColor: Player = opponentColor ?? (myColor === 'W' ? 'B' : 'W');
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
  const visibleOpponentColor = opponentColor ?? safeOpponentColor;
  const myInitialElo = matchData?.players?.[user.uid]?.elo;
  const opponentInitialElo = opponentUid ? matchData?.players?.[opponentUid]?.elo : undefined;
  const myElo = usePlayerElo(user.uid, myInitialElo);
  const opponentElo = usePlayerElo(opponentUid, opponentInitialElo);
  const toastId = React.useRef(0);
  const lastTick = React.useRef<number>(Date.now());
  const toastTimers = React.useRef<Record<number, number>>({});
  const blockedTimer = React.useRef<number | null>(null);
  const isRemoteMatch = gameMode === 'remote';
  const tickingMode = getTickingMode(state);
  const shouldTickClocks = tickingMode !== 'none';
  const isPrimaryTickOwner = React.useMemo(() => {
    if (!isRemoteMatch) return true;
    if (!sortedUids.length) return false;
    return user.uid === sortedUids[0];
  }, [isRemoteMatch, sortedUids, user.uid]);
  const [clockHeartbeat, setClockHeartbeat] = React.useState(() => Date.now());
  const [failoverNow, setFailoverNow] = React.useState(() => Date.now());
  const pendingRemoteActions = React.useRef(0);
  const failoverActiveRef = React.useRef(false);
  const dispatch = React.useCallback<typeof rawDispatch>(
    (action) => {
      if (isRemoteMatch && failoverActiveRef.current) {
        pendingRemoteActions.current += 1;
      }
      rawDispatch(action);
    },
    [isRemoteMatch, rawDispatch],
  );

  React.useEffect(() => {
    setClockHeartbeat(Date.now());
  }, [matchId]);

  React.useEffect(() => {
    finishedWrittenRef.current = false;
  }, [matchId]);

  React.useEffect(() => {
    if (!isRemoteMatch) return;
    setClockHeartbeat(Date.now());
  }, [isPrimaryTickOwner, isRemoteMatch]);

  React.useEffect(() => {
    if (!isRemoteMatch) return;
    if (isPrimaryTickOwner) return;
    setClockHeartbeat(Date.now());
  }, [isPrimaryTickOwner, isRemoteMatch, state.clocks.W, state.clocks.B]);

  React.useEffect(() => {
    if (!isRemoteMatch || isPrimaryTickOwner) {
      setFailoverNow(Date.now());
      return;
    }
    setFailoverNow(Date.now());
    const id = window.setInterval(() => {
      setFailoverNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRemoteMatch, isPrimaryTickOwner]);

  const failoverEligible = React.useMemo(() => {
    if (!isRemoteMatch) return false;
    if (isPrimaryTickOwner) return false;
    if (!shouldTickClocks) return false;
    const baseline =
      typeof remoteUpdatedAt === 'number' ? Math.max(clockHeartbeat, remoteUpdatedAt) : clockHeartbeat;
    return failoverNow - baseline > TICK_FAILOVER_DELAY;
  }, [clockHeartbeat, failoverNow, isPrimaryTickOwner, isRemoteMatch, remoteUpdatedAt, shouldTickClocks]);

  const [failoverActive, setFailoverActive] = React.useState(false);

  React.useEffect(() => {
    failoverActiveRef.current = failoverActive;
    if (!failoverActive) {
      pendingRemoteActions.current = 0;
    }
  }, [failoverActive]);

  React.useEffect(() => {
    if (!isRemoteMatch || isPrimaryTickOwner || !shouldTickClocks) {
      if (failoverActive) {
        setFailoverActive(false);
      }
      return;
    }
    if (!failoverActive && failoverEligible) {
      setFailoverActive(true);
    }
  }, [failoverActive, failoverEligible, isPrimaryTickOwner, isRemoteMatch, shouldTickClocks]);

  React.useEffect(() => {
    if (!isRemoteMatch) {
      pendingRemoteActions.current = 0;
      return;
    }
    if (!failoverActive) {
      return;
    }
    if (remoteUpdatedAt == null) {
      return;
    }
    if (pendingRemoteActions.current > 0) {
      pendingRemoteActions.current = Math.max(0, pendingRemoteActions.current - 1);
      return;
    }
    setFailoverActive(false);
  }, [failoverActive, isRemoteMatch, remoteUpdatedAt]);

  const isTickOwner = React.useMemo(() => {
    if (!isRemoteMatch) return true;
    if (!sortedUids.length) return false;
    if (isPrimaryTickOwner) return true;
    return failoverActive;
  }, [failoverActive, isPrimaryTickOwner, isRemoteMatch, sortedUids]);

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
    if (!isTickOwner) {
      return undefined;
    }
    const id = window.setInterval(() => {
      const now = Date.now();
      const dt = now - lastTick.current;
      lastTick.current = now;
      dispatch({ type: 'tick', dt });
    }, TICK_INTERVAL);
    return () => window.clearInterval(id);
  }, [dispatch, isTickOwner]);

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
      if (screen.type === 'victory') {
        navigate('/play', { replace: true });
      }
    },
    [dispatch, navigate],
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
    victoryOverlayShownRef.current = false;
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

  const displayedOpponentNickname = opponentNickname ?? 'Opponent';

  React.useEffect(() => {
    if (state.phase !== 'ENDED') return;
    if (victoryOverlayShownRef.current) return;
    if (overlay) return;
    if (state.winner !== 'W' && state.winner !== 'B') return;
    const winnerColor = state.winner;
    const fallbackName = winnerColor === 'W' ? 'White' : 'Black';
    let winnerNickname = fallbackName;
    let winnerElo: number | null = null;
    if (winnerColor === myColor) {
      winnerNickname = myDisplayName ?? fallbackName;
      winnerElo = typeof myElo === 'number' ? myElo : null;
    } else if (visibleOpponentColor === winnerColor) {
      winnerNickname = displayedOpponentNickname;
      winnerElo = typeof opponentElo === 'number' ? opponentElo : null;
    }
    victoryOverlayShownRef.current = true;
    setOverlay({
      type: 'victory',
      color: winnerColor,
      nickname: winnerNickname,
      elo: winnerElo,
    });
  }, [
    displayedOpponentNickname,
    myColor,
    myDisplayName,
    myElo,
    visibleOpponentColor,
    opponentElo,
    overlay,
    state.phase,
    state.winner,
  ]);

  React.useEffect(() => {
    if (!matchId) return;
    if (state.phase !== 'ENDED') return;
    if (state.winner !== 'W' && state.winner !== 'B') return;
    if (finishedWrittenRef.current) return;
    finishedWrittenRef.current = true;
    const winnerColor = state.winner;
    const winnerUid = Object.keys(colorAssignments).find((uid) => colorAssignments[uid] === winnerColor) ?? null;
    updateDoc(doc(db, 'matches', matchId), {
      status: 'finished',
      result: {
        winnerUid,
        reason: 'score',
      },
      finishedAt: serverTimestamp(),
    }).catch(() => undefined);
  }, [matchId, state.phase, state.winner, colorAssignments]);

  const prevPhase = React.useRef(state.phase);
  React.useEffect(() => {
    if (prevPhase.current !== state.phase) {
      if (state.phase === 'MOVEMENT_BIDDING') {
        pushToast('Movement bidding begins.');
      }
      if (state.phase === 'MOVEMENT' && prevPhase.current !== 'MOVEMENT') {
        const limit = state.movement.moveLimit;
        const summary = limit !== undefined ? `${limit} move${limit === 1 ? '' : 's'}` : 'free movement';
        pushToast(`Movement phase begins â€” limit: ${summary}.`);
      }
      if (state.phase === 'ENDED' && state.winner) {
        pushToast(`Game over â€” ${state.winner} wins.`);
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
      pushToast(`Movement bids revealed. ${chooser} will choose who starts â€” limit: ${summary}.`);
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
      if (state.phase !== 'ASSIGN_STATS' || stone.owner !== myColor) {
        setSelectedId(null);
        setSelectionSource(null);
      }
    }
  }, [myColor, state.phase, state.turn, state.stones, selectedId, selectionSource]);

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
    if (state.phase !== 'PLACEMENT') return;
    if (state.turn !== myColor) return;
    const player = myColor;
    const placed = state.placementCounts[player];
    const canPlace = hasPlacementOption(state, player);
    if (placed < 1 && canPlace) {
      pushToast('You must place at least one stone before passing.');
      return;
    }
    dispatch({ type: 'placementPass', player });
    setSelectedId(null);
    setSelectionSource(null);
  };

  const handleAssignCommit = (player: Player, assignments: Record<string, Assignment>) => {
    dispatch({ type: 'assignCommit', player, assignments });
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

  const mustPass = React.useMemo(() => {
    if (state.phase !== 'MOVEMENT' || !state.turn) return false;
    return !Object.values(state.stones).some((stone) => {
      if (stone.owner !== state.turn) return false;
      return legalMoves(state, stone).length > 0;
    });
  }, [state]);

  const whiteInfo = React.useMemo(() => {
    if (myColor === 'W') {
      return { nickname: myDisplayName ?? 'You', elo: typeof myElo === 'number' ? myElo : null };
    }
    if (visibleOpponentColor === 'W') {
      return { nickname: displayedOpponentNickname, elo: typeof opponentElo === 'number' ? opponentElo : null };
    }
    return { nickname: 'White', elo: null };
  }, [displayedOpponentNickname, myColor, myDisplayName, myElo, visibleOpponentColor, opponentElo]);

  const blackInfo = React.useMemo(() => {
    if (myColor === 'B') {
      return { nickname: myDisplayName ?? 'You', elo: typeof myElo === 'number' ? myElo : null };
    }
    if (visibleOpponentColor === 'B') {
      return { nickname: displayedOpponentNickname, elo: typeof opponentElo === 'number' ? opponentElo : null };
    }
    return { nickname: 'Black', elo: null };
  }, [displayedOpponentNickname, myColor, myDisplayName, myElo, visibleOpponentColor, opponentElo]);

  let localPassControl: PassControl | null = null;
  if (state.phase === 'PLACEMENT' && state.turn === myColor) {
    const placed = state.placementCounts[myColor] ?? 0;
    const canPlace = hasPlacementOption(state, myColor);
    const mustPlace = placed < 1 && canPlace;
    const limitReached = placed >= 10;
    localPassControl = {
      label: limitReached ? 'Pass (limit reached)' : 'Pass',
      disabled: mustPlace,
      tooltip: mustPlace ? 'You must place at least one stone before passing.' : undefined,
      onClick: handlePlacementPass,
    };
  } else if (state.phase === 'MOVEMENT' && state.turn === myColor) {
    localPassControl = {
      label: mustPass ? 'Pass (no moves available)' : 'Pass',
      disabled: false,
      onClick: handleMovementPass,
    };
  }

  const hudPlayers = React.useMemo(
    () => ({
      W: {
        color: 'W' as Player,
        nickname: whiteInfo.nickname,
        elo: whiteInfo.elo ?? null,
        passControl: myColor === 'W' ? localPassControl : null,
      },
      B: {
        color: 'B' as Player,
        nickname: blackInfo.nickname,
        elo: blackInfo.elo ?? null,
        passControl: myColor === 'B' ? localPassControl : null,
      },
    }),
    [blackInfo.elo, blackInfo.nickname, localPassControl, myColor, whiteInfo.elo, whiteInfo.nickname],
  );

  const sidePanel = React.useMemo(() => {
    if (state.phase === 'BIDDING') {
      return <BiddingPanel state={state} player={myColor} lockBid={handleLockBid} />;
    }
    if (state.phase === 'ASSIGN_STATS') {
      return (
        <AssignStatsPanel
          state={state}
          player={myColor}
          onCommit={(assignments) => handleAssignCommit(myColor, assignments)}
          onFocusStone={handleAssignFocus}
          focusedStoneId={selectionSource === 'assign' ? selectedId : null}
        />
      );
    }
    if (state.phase === 'MOVEMENT_BIDDING') {
      return (
        <MovementBiddingPanel
          state={state}
          lockBid={handleMovementBid}
          submitPlan={handleMovementPlan}
        />
      );
    }
    return null;
  }, [
    handleAssignCommit,
    handleAssignFocus,
    handleLockBid,
    handleMovementBid,
    handleMovementPlan,
    myColor,
    selectedId,
    selectionSource,
    state,
  ]);

  if (matchId && !stateReady) {
    return (
      <div className={'container centered-container'}>
        <div className={'card'} style={{ maxWidth: 360 }}>
          Syncing match state…
        </div>
      </div>
    );
  }

  if (matchId && syncError) {
    const permissionIssue = syncError.code === 'permission-denied';
    return (
      <div className="container centered-container">
        <div className="card" style={{ maxWidth: 420 }}>
          <h2 style={{ marginTop: 0 }}>Connection lost</h2>
          <p>
            {permissionIssue
              ? 'We no longer have permission to update this match. This can happen if the match was closed or your access was revoked.'
              : 'We lost the connection to the match and cannot sync your actions right now.'}
          </p>
          {!permissionIssue ? (
            <p>
              Try refreshing the page or checking your network connection. If the problem persists, you can return to the lobby
              and re-open the match.
            </p>
          ) : null}
          <button className="btn primary" onClick={() => navigate('/play', { replace: true })}>
            Back to lobby
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === 'BIDDING') {
    return (
      <div className="container game-container">
        <div className="bidding-fullpage">
          <BiddingPanel state={state} player={myColor} matchId={matchId} />
        </div>
      </div>
    );
  }
  return (
    <div className="container game-container">
      <div className="game-top-row">
        <HUD state={state} tickingMode={tickingMode} players={hudPlayers} />
        <button className="btn outline resign" onClick={handleResign} disabled={state.phase === 'ENDED'}>
          Resign
        </button>
      </div>
      <div className="game-main">
        <div className="board-container">
          <Board
            state={state}
            onSquareClick={onSquareClick}
            highlights={selectedMoves}
            selectedId={selectedId}
            blockedPreview={blockedPreview}
          />
        </div>
        {sidePanel ? <div className="phase-panel">{sidePanel}</div> : null}
      </div>

      <ToastStack items={toasts} />
      {overlay ? <TemporaryScreenView screen={overlay} countdown={overlayCountdown} /> : null}
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
            You play with <b>{screen.color === 'W' ? 'White' : 'Black'}</b> against <b>{screen.opponentNickname}</b>
            {' '}of Elo <b>{typeof screen.opponentElo === 'number' ? screen.opponentElo : 'â€”'}</b>.
          </div>
          <div className="temporary-line">Get ready â€” the match begins shortly.</div>
        </div>
      </div>
    );
  }
  if (screen.type === 'victory') {
    return (
      <div className="temporary-screen">
        <div className="temporary-card">
          <div className="temporary-countdown">{countdownValue}</div>
          <div className="temporary-line">
            Winner: <b>{screen.nickname}</b> playing <b>{screen.color === 'W' ? 'White' : 'Black'}</b>.
          </div>
          <div className="temporary-line">Elo {typeof screen.elo === 'number' ? screen.elo : 'â€”'} â€” returning to the main menuâ€¦</div>
        </div>
      </div>
    );
  }
  return (
    <div className="temporary-screen">
      <div className="temporary-card">
        <div className="temporary-countdown">{countdownValue}</div>
        <div className="temporary-line">
          Winning bid: <b>{screen.winningBid}</b> points ({screen.winner === 'W' ? 'White' : 'Black'}).
        </div>
        <div className="temporary-line">
          White paid <b>{screen.bids.W ?? 0}</b> points â€” Black paid <b>{screen.bids.B ?? 0}</b> points.
        </div>
        <div className="temporary-line">
          {screen.winner === 'W' ? 'White' : 'Black'} will start placement.
        </div>
      </div>
    </div>
  );
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

