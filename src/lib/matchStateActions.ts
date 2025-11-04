import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Player } from '../game/types';
import { db } from './firebase';

type Bids = {
  W?: number;
  B?: number;
  revealed?: boolean;
  startingPlayer?: Player;
};

export async function lockBidTx(matchId: string, player: Player, rawBid: number) {
  const ref = doc(db, 'matches', matchId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('MATCH_NOT_FOUND');

    const data = snap.data() || {};
    const credits = (data.credits ?? { W: 0, B: 0 }) as { W: number; B: number };
    const bids = (data.bids ?? {}) as Bids;

    // Already locked by this player? no-op.
    if (typeof bids[player] === 'number') return;

    // Clamp to available credits server-side
    const myCredits = credits[player] ?? 0;
    const bid = Math.max(0, Math.min(myCredits, Math.floor(rawBid || 0)));

    const update: Record<string, unknown> = {
      [`bids.${player}`]: bid,
      updatedAt: serverTimestamp(),
    };

    const w = typeof bids.W === 'number' ? bids.W : player === 'W' ? bid : undefined;
    const b = typeof bids.B === 'number' ? bids.B : player === 'B' ? bid : undefined;

    // If both bids exist and not revealed yet, reveal now and deduct once.
    if (!bids.revealed && typeof w === 'number' && typeof b === 'number') {
      const startingPlayer: Player = w === b ? 'W' : (w > b ? 'W' : 'B');
      update['bids.revealed'] = true;
      update['bids.startingPlayer'] = startingPlayer;
      update['credits.W'] = Math.max(0, (credits.W ?? 0) - w);
      update['credits.B'] = Math.max(0, (credits.B ?? 0) - b);
    }

    tx.update(ref, update);
  });
}
