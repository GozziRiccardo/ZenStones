import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { normalize } from './nickname';

export type ChallengeSnapshot = {
  id: string;
  challengerUid: string;
  challengerNickname: string;
  targetUid: string;
  targetNickname: string;
  status: 'pending' | 'accepted' | 'denied';
  matchId?: string;
};

type QuickRequestState = {
  status: 'open' | 'matched';
  matchId?: string;
  opponentNickname?: string;
};

export type MatchDoc = {
  id: string;
  status: 'active' | 'finished';
  playerUids: string[];
};

export function watchUserProfile(uid: string, handler: (data: Record<string, unknown> | null) => void) {
  const ref = doc(db, 'users', uid);
  return onSnapshot(ref, (snap) => {
    handler(snap.exists() ? snap.data() ?? null : null);
  });
}

export async function requestQuickMatch(nickname: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH');
  const requestRef = doc(db, 'quickRequests', user.uid);
  const requests = collection(db, 'quickRequests');
  const openQuery = query(requests, orderBy('createdAt', 'asc'), limit(10));

  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(requestRef);
    if (existing.exists()) {
      const data = existing.data() as QuickRequestState;
      if (data.status === 'open') {
        throw new Error('ALREADY_WAITING');
      }
      if (data.status === 'matched' && data.matchId) {
        return { kind: 'matched' as const, matchId: data.matchId };
      }
    }

    const openSnap = await transaction.get(openQuery);
    const first = openSnap.docs.find((docSnap) => {
      const data = docSnap.data() as { status?: string };
      return data.status === 'open' && docSnap.id !== user.uid;
    });
    if (first) {
      const firstData = first.data() as { uid: string; nickname: string };
      const matchRef = doc(collection(db, 'matches'));
      transaction.update(first.ref, {
        status: 'matched',
        opponentUid: user.uid,
        opponentNickname: nickname,
        matchId: matchRef.id,
        matchedAt: serverTimestamp(),
      });
      transaction.set(doc(db, 'quickRequests', user.uid), {
        uid: user.uid,
        nickname,
        status: 'matched',
        matchId: matchRef.id,
        createdAt: serverTimestamp(),
      });
      transaction.set(matchRef, {
        status: 'active',
        createdAt: serverTimestamp(),
        mode: 'quickplay',
        playerUids: [firstData.uid, user.uid],
        players: {
          [firstData.uid]: {
            nickname: firstData.nickname,
          },
          [user.uid]: {
            nickname,
          },
        },
      });
      return { kind: 'matched' as const, matchId: matchRef.id };
    }

    transaction.set(requestRef, {
      uid: user.uid,
      nickname,
      status: 'open',
      createdAt: serverTimestamp(),
    });
    return { kind: 'waiting' as const };
  });
}

export async function cancelQuickMatch() {
  const user = auth.currentUser;
  if (!user) return;
  const ref = doc(db, 'quickRequests', user.uid);
  await deleteDoc(ref).catch(() => undefined);
}

export function watchQuickMatch(uid: string, handler: (state: QuickRequestState | null) => void) {
  const ref = doc(db, 'quickRequests', uid);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      handler(null);
      return;
    }
    const data = snap.data() as QuickRequestState;
    handler(data);
  });
}

export function watchActiveMatch(uid: string, handler: (match: MatchDoc | null) => void) {
  const matches = collection(db, 'matches');
  const activeQuery = query(matches, where('playerUids', 'array-contains', uid), limit(5));
  return onSnapshot(activeQuery, (snap) => {
    const docSnap = snap.docs.find((item) => (item.data() as { status?: string }).status === 'active');
    if (!docSnap) {
      handler(null);
      return;
    }
    handler({
      id: docSnap.id,
      ...(docSnap.data() as { status: 'active' | 'finished'; playerUids: string[] }),
    });
  });
}

export async function sendChallenge(rawNickname: string, challengerNickname: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH');
  const normalized = normalize(rawNickname);
  if (!normalized) {
    throw new Error('BAD_NICK');
  }
  const handleSnap = await getDoc(doc(db, 'handles', normalized));
  if (!handleSnap.exists()) {
    throw new Error('NOT_FOUND');
  }
  const targetUid = handleSnap.data()?.uid as string | undefined;
  if (!targetUid) {
    throw new Error('NOT_FOUND');
  }
  if (targetUid === user.uid) {
    throw new Error('SELF');
  }
  const targetUserSnap = await getDoc(doc(db, 'users', targetUid));
  const targetNickname = typeof targetUserSnap.data()?.nickname === 'string' ? targetUserSnap.data()!.nickname : normalized;

  const challengeRef = doc(collection(db, 'challenges'));
  await setDoc(challengeRef, {
    status: 'pending',
    createdAt: serverTimestamp(),
    challengerUid: user.uid,
    challengerNickname,
    targetUid,
    targetNickname,
  });
  return challengeRef.id;
}

export function watchIncomingChallenges(uid: string, handler: (items: ChallengeSnapshot[]) => void) {
  const challenges = collection(db, 'challenges');
  const q = query(challenges, where('targetUid', '==', uid));
  return onSnapshot(q, (snap) => {
    const pending = snap.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ChallengeSnapshot, 'id'>),
      }))
      .filter((item) => item.status === 'pending');
    handler(pending);
  });
}

export async function acceptChallenge(challengeId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH');
  const challengeRef = doc(db, 'challenges', challengeId);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(challengeRef);
    if (!snap.exists()) throw new Error('NOT_FOUND');
    const data = snap.data() as ChallengeSnapshot;
    if (data.status !== 'pending') {
      throw new Error('NOT_AVAILABLE');
    }
    if (data.targetUid !== user.uid) {
      throw new Error('NOT_ALLOWED');
    }
    const matchRef = doc(collection(db, 'matches'));
    transaction.update(challengeRef, {
      status: 'accepted',
      matchId: matchRef.id,
      respondedAt: serverTimestamp(),
    });
    transaction.set(matchRef, {
      status: 'active',
      createdAt: serverTimestamp(),
      mode: 'challenge',
      playerUids: [data.challengerUid, data.targetUid],
      players: {
        [data.challengerUid]: {
          nickname: data.challengerNickname,
        },
        [data.targetUid]: {
          nickname: data.targetNickname,
        },
      },
    });
    return matchRef.id;
  });
}

export async function denyChallenge(challengeId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH');
  const ref = doc(db, 'challenges', challengeId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as ChallengeSnapshot;
    if (data.targetUid !== user.uid) return;
    if (data.status !== 'pending') return;
    transaction.update(ref, {
      status: 'denied',
      respondedAt: serverTimestamp(),
    });
  });
}
