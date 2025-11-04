import * as React from 'react';
import type { GameState, Player } from '../game/types';
import { lockBidTx } from '../lib/matchStateActions';

type Props = {
  state: GameState;
  player: Player;
  lockBid?: (player: Player, bid: number) => void | Promise<void>;
  matchId?: string;
};

export function BiddingPanel({ state, player, lockBid, matchId }: Props) {
  // Keep a string so mobile can clear the field fully
  const [text, setText] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const myBid = state.bids[player];
  const opp: Player = player === 'W' ? 'B' : 'W';
  const oppBid = state.bids[opp];
  const revealed = !!state.bids.revealed;

  const myCredits = state.credits[player] ?? 0;
  const parsed = text.trim() === '' ? null : Math.max(0, Math.min(myCredits, parseInt(text, 10) || 0));
  const canLock = typeof myBid !== 'number' && parsed !== null && !submitting;

  const onLock = async () => {
    if (!canLock || parsed == null) return;
    try {
      setSubmitting(true);
      if (matchId) {
        await lockBidTx(matchId, player, parsed);
      } else if (typeof lockBid === 'function') {
        await Promise.resolve(lockBid(player, parsed));
      } else {
        console.warn('No lockBid or matchId provided.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ width: 420, maxWidth: '90vw' }}>
      <div className="bidding-heading">Opening bid</div>
      <div className="bidding-subheading">
        Pick how many points you pay to win the initiative. Higher bid wins. Ties favor White.
      </div>

      <div style={{ height: 8 }} />

      <div className="bidding-input-group">
        <label htmlFor="my-bid">Your bid (0 to {myCredits})</label>
        <input
          id="my-bid"
          className="input number"
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min={0}
          max={myCredits}
          placeholder="Enter a number"
          value={typeof myBid === 'number' ? String(myBid) : text}
          onChange={(e) => {
            if (typeof myBid === 'number') return; // locked
            setText(e.currentTarget.value);
          }}
          disabled={typeof myBid === 'number' || submitting}
        />
        {typeof myBid !== 'number' ? (
          <button className="btn" onClick={onLock} disabled={!canLock}>
            {submitting ? 'Locking...' : 'Lock bid'}
          </button>
        ) : (
          <div className="bidding-waiting">Bid locked: {myBid}</div>
        )}
      </div>

      <div style={{ height: 12 }} />

      <div className="bidding-subheading">Opponent status</div>
      <div className="bidding-waiting">
        {!revealed
          ? (typeof oppBid === 'number' ? 'Opponent: locked' : 'Opponent: waiting...')
          : `Revealed: White ${state.bids.W ?? 0} vs Black ${state.bids.B ?? 0}`}
      </div>

      {revealed ? (
        <>
          <div style={{ height: 8 }} />
          <div className="bidding-waiting">
            Initiative: {(state.bids.startingPlayer ?? 'W') === 'W' ? 'White' : 'Black'}
          </div>
        </>
      ) : null}
    </div>
  );
}
