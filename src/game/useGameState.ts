import * as React from 'react';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { GameState, Player } from './types';
import type { GameAction } from './state';
import { createInitialState, gameReducer } from './state';
import { restoreIdCounter } from './utils';
import { db } from '../lib/firebase';

function normalizeState(input?: GameState | null): GameState {
  const base = input ? (JSON.parse(JSON.stringify(input)) as GameState) : createInitialState();
  if (!base.placementCounts) {
    const counts = { W: 0, B: 0 } as Record<Player, number>;
    for (const stone of Object.values(base.stones ?? {})) {
      counts[stone.owner] += 1;
    }
    base.placementCounts = counts;
  }
  if (!base.blockedLabels) {
    base.blockedLabels = { W: {}, B: {} };
  }
  restoreIdCounter(base);
  return base;
}

function loadPersistedState(key: string): GameState | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState | null;
    if (!parsed) return null;
    return normalizeState(parsed);
  } catch (err) {
    console.warn('Failed to load saved game state:', err);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore follow-up errors removing corrupted state
    }
    return null;
  }
}

type GameControllerMode = 'local' | 'remote';

type GameController = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  ready: boolean;
  mode: GameControllerMode;
};

export function useGameController(matchId: string | undefined, persistenceKey: string): GameController {
  const initializer = React.useCallback(() => {
    if (matchId) {
      return createInitialState();
    }
    return loadPersistedState(persistenceKey) ?? createInitialState();
  }, [matchId, persistenceKey]);

  const [localState, localDispatch] = React.useReducer(gameReducer, undefined, initializer);

  React.useEffect(() => {
    if (matchId) return;
    if (typeof window === 'undefined' || !('localStorage' in window)) return;
    try {
      window.localStorage.setItem(persistenceKey, JSON.stringify(localState));
    } catch (err) {
      console.warn('Failed to save game state:', err);
    }
  }, [localState, matchId, persistenceKey]);

  const [remoteState, setRemoteState] = React.useState<GameState | null>(null);
  const [ready, setReady] = React.useState<boolean>(!matchId);

  React.useEffect(() => {
    if (!matchId) {
      setRemoteState(null);
      setReady(true);
      return;
    }
    let isMounted = true;
    setReady(false);
    const ref = doc(db, 'matches', matchId);
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        if (isMounted) {
          setReady(false);
        }
        return;
      }
      const data = snap.data() as { state?: GameState };
      const incoming = data.state;
      if (!incoming) {
        if (isMounted) {
          setReady(false);
        }
        return;
      }
      const normalized = normalizeState(incoming);
      if (isMounted) {
        setRemoteState(normalized);
        setReady(true);
      }
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [matchId]);

  React.useEffect(() => {
    if (!matchId) return;
    const ensureState = async () => {
      try {
        await runTransaction(db, async (transaction) => {
          const ref = doc(db, 'matches', matchId);
          const snap = await transaction.get(ref);
          if (!snap.exists()) {
            return;
          }
          const data = snap.data() as { state?: GameState };
          if (data.state) {
            return;
          }
          const initial = createInitialState();
          transaction.set(ref, { state: initial, updatedAt: serverTimestamp() }, { merge: true });
        });
      } catch (err) {
        console.warn('Failed to initialize match state:', err);
      }
    };
    void ensureState();
  }, [matchId]);

  const remoteDispatch = React.useCallback<React.Dispatch<GameAction>>(
    (action) => {
      if (!matchId) return;
      const ref = doc(db, 'matches', matchId);
      runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists()) {
          return;
        }
        const data = snap.data() as { state?: GameState };
        const current = normalizeState(data.state);
        const next = gameReducer(current, action);
        transaction.set(ref, { state: next, updatedAt: serverTimestamp() }, { merge: true });
      }).catch((err) => {
        console.warn('Failed to apply game action:', err);
      });
    },
    [matchId],
  );

  if (!matchId) {
    return { state: localState, dispatch: localDispatch, ready: true, mode: 'local' };
  }

  return {
    state: remoteState ?? localState,
    dispatch: remoteDispatch,
    ready,
    mode: 'remote',
  };
}
