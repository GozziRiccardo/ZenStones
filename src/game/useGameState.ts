import * as React from 'react';
import {
  onSnapshot,
  doc,
  runTransaction,
  setDoc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { createInitialState, gameReducer } from './state';
import type { GameState } from './types';

type Mode = 'none' | 'both' | 'W' | 'B';

type SyncError = {
  code?: string;
  message: string;
};

export function useGameController(matchId: string | undefined, _persistenceKey: string) {
  const [state, dispatchLocal] = React.useReducer(gameReducer as any, undefined, () => createInitialState());
  const [ready, setReady] = React.useState(!matchId);
  const [mode] = React.useState<Mode>('none');
  const [updatedAt, setUpdatedAt] = React.useState<number>(Date.now());
  const [syncError, setSyncError] = React.useState<SyncError | null>(null);

  // --- Firestore-safe (de)serialization ---
  const ROWS = 10;
  const COLS = 10;
  const N = ROWS * COLS;

  function flattenBoard(board: (string | null)[][]): string[] {
    const out = Array<string>(N).fill('');
    for (let r = 0; r < ROWS; r++) {
      const row = board[r] || [];
      for (let c = 0; c < COLS; c++) {
        const v = row[c];
        out[r * COLS + c] = v ?? '';
      }
    }
    return out;
  }
  function inflateBoard(flat?: unknown): (string | null)[][] {
    const board: (string | null)[][] = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => null),
    );
    if (!Array.isArray(flat)) return board;
    for (let i = 0; i < Math.min(flat.length, N); i++) {
      const v = typeof flat[i] === 'string' ? (flat[i] as string) : '';
      board[Math.floor(i / COLS)][i % COLS] = v || null;
    }
    return board;
  }
  function flattenLabels(mat?: unknown): number[] {
    const out = Array<number>(N).fill(0);
    if (!Array.isArray(mat)) return out;
    for (let r = 0; r < ROWS; r++) {
      const row = Array.isArray((mat as any)[r]) ? (mat as any)[r] : [];
      for (let c = 0; c < COLS; c++) {
        const v = row[c];
        out[r * COLS + c] = typeof v === 'number' ? v : 0;
      }
    }
    return out;
  }
  function inflateLabels(flat?: unknown): number[][] {
    const grid: number[][] = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => 0),
    );
    if (!Array.isArray(flat)) return grid;
    for (let i = 0; i < Math.min(flat.length, N); i++) {
      const v = typeof flat[i] === 'number' ? (flat[i] as number) : 0;
      grid[Math.floor(i / COLS)][i % COLS] = v;
    }
    return grid;
  }

  function toWire(s: GameState) {
    return {
      boardFlat: flattenBoard(s.board),
      labelsWhiteFlat: flattenLabels(s.labels.whiteHalf),
      labelsBlackFlat: flattenLabels(s.labels.blackHalf),

      turn: s.turn,
      phase: s.phase,
      credits: s.credits,
      clocks: s.clocks,
      scores: s.scores,
      bids: s.bids,
      movement: s.movement,
      stones: s.stones,
      assignments: (s as any).assignments ?? (s as any).assign ?? {},
      assign: (s as any).assign ?? {},
      placementCounts: (s as any).placementCounts ?? { W: 0, B: 0 },
      lastAction: (s as any).lastAction ?? null,

      updatedAt: serverTimestamp(),
    };
  }

  function fromWire(data: any): GameState {
    const base = createInitialState();
    base.board = inflateBoard(data?.boardFlat);
    base.labels.whiteHalf = inflateLabels(data?.labelsWhiteFlat);
    base.labels.blackHalf = inflateLabels(data?.labelsBlackFlat);
    base.turn = data?.turn ?? base.turn;
    base.phase = data?.phase ?? base.phase;
    base.credits = data?.credits ?? base.credits;
    base.clocks = data?.clocks ?? base.clocks;
    base.scores = data?.scores ?? base.scores;
    base.bids = data?.bids ?? base.bids;
    base.movement = data?.movement ?? base.movement;
    base.stones = data?.stones ?? base.stones;
    (base as any).assignments = data?.assignments ?? (base as any).assignments ?? {};
    (base as any).assign = data?.assign ?? (base as any).assign ?? {};
    (base as any).placementCounts = data?.placementCounts ?? (base as any).placementCounts ?? { W: 0, B: 0 };
    (base as any).lastAction = data?.lastAction ?? (base as any).lastAction ?? null;
    return base;
  }

  const pendingWriteRef = React.useRef(false);
  const stateRef = React.useRef(state);
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const reportSyncError = React.useCallback(
    (error: unknown) => {
      if (!matchId) {
        return;
      }
      let code: string | undefined;
      let message = 'Failed to sync the match state.';
      if (error && typeof error === 'object') {
        const maybeCode = (error as { code?: unknown }).code;
        if (typeof maybeCode === 'string') {
          code = maybeCode;
        }
        const maybeMessage = (error as { message?: unknown }).message;
        if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
          message = maybeMessage;
        }
      } else if (typeof error === 'string') {
        message = error;
      }

      setSyncError({ code, message });
      pendingWriteRef.current = false;
    },
    [matchId],
  );

  React.useEffect(() => {
    if (!matchId) return;

    const stateRefDoc = doc(db, 'matches', matchId, 'state', 'current');
    const matchRef = doc(db, 'matches', matchId);

    (async () => {
      try {
        const s = await getDoc(stateRefDoc);
        if (!s.exists()) {
          await runTransaction(db, async (tx) => {
            const again = await tx.get(stateRefDoc);
            if (!again.exists()) {
              tx.set(stateRefDoc, toWire(stateRef.current));
            }
            tx.set(matchRef, { updatedAt: serverTimestamp() }, { merge: true });
          });
        }
        setSyncError(null);
      } catch (e) {
        console.warn('Failed to initialize match state:', e);
        reportSyncError(e);
      }
    })();

    const unsub = onSnapshot(
      stateRefDoc,
      (snap) => {
        if (snap.exists()) {
          const next = fromWire(snap.data());
          pendingWriteRef.current = false;
          dispatchLocal({ type: '__remote_replace__', payload: next } as any);
          setUpdatedAt(Date.now());
        }
        setReady(true);
        setSyncError(null);
      },
      (err) => {
        console.error('Snapshot error:', err);
        setReady(true);
        reportSyncError(err);
      },
    );
    return () => unsub();
  }, [matchId, reportSyncError]);

  const dispatch = React.useCallback((action: any) => {
    pendingWriteRef.current = true;
    dispatchLocal(action);
  }, []);

  React.useEffect(() => {
    if (!matchId) return;
    if (!pendingWriteRef.current) return;
    if (syncError?.code === 'permission-denied') {
      pendingWriteRef.current = false;
      return;
    }

    const stateRefDoc = doc(db, 'matches', matchId, 'state', 'current');
    const matchRef = doc(db, 'matches', matchId);

    (async () => {
      try {
        const wire = toWire(stateRef.current);
        await updateDoc(stateRefDoc, wire).catch(async (error) => {
          if (error && typeof error === 'object' && (error as { code?: string }).code === 'permission-denied') {
            throw error;
          }
          await setDoc(stateRefDoc, wire, { merge: true });
        });
        await updateDoc(matchRef, { updatedAt: serverTimestamp() }).catch((error) => {
          if (error && typeof error === 'object' && (error as { code?: string }).code === 'permission-denied') {
            throw error;
          }
        });
        setSyncError(null);
      } catch (e) {
        console.warn('Failed to apply game action:', e);
        reportSyncError(e);
      } finally {
        pendingWriteRef.current = false;
      }
    })();
  }, [state, matchId, reportSyncError, syncError]);

  return { state, dispatch, ready, mode, updatedAt, syncError };
}
