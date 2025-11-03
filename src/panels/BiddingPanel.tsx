import * as React from 'react';
import type { GameState, Player } from '../game/types';

type BiddingPanelProps = {
  state: GameState;
  player: Player;
  lockBid: (player: Player, bid: number) => void;
};

export function BiddingPanel({ state, player, lockBid }: BiddingPanelProps) {
  const [bid, setBid] = React.useState<number>(state.bids[player] ?? 0);
  const opponent: Player = player === 'W' ? 'B' : 'W';
  const locked = typeof state.bids[player] === 'number';
  const opponentLocked = typeof state.bids[opponent] === 'number';

  React.useEffect(() => {
    if (state.bids[player] !== undefined) {
      setBid(state.bids[player]!);
    }
  }, [player, state.bids]);

  const credits = state.credits[player];
  const safeBid = (value: number) => Math.max(0, Math.min(value, credits));
  const handleLock = () => {
    if (locked) return;
    lockBid(player, safeBid(bid));
  };

  const waitingForOpponent = locked && !opponentLocked;

  return (
    <div className="panel card bidding-panel">
      <div className="bidding-heading">Enter your secret bid</div>
      <div className="bidding-subheading">Spend up to your remaining credits to compete for the opening move.</div>
      <div className="bidding-input-group">
        <label className="small" htmlFor="bid-input">Bid amount (0 – {credits})</label>
        {locked ? (
          <div className="locked-value">Locked: {state.bids[player]}</div>
        ) : (
          <input
            id="bid-input"
            className="input number"
            type="number"
            value={bid}
            min={0}
            max={credits}
            onChange={(event) => setBid(safeBid(parseInt(event.target.value || '0', 10)))}
          />
        )}
      </div>
      <button className="btn" onClick={handleLock} disabled={locked}>Lock in</button>
      {waitingForOpponent ? (
        <div className="bidding-waiting">
          <div className="spinner" aria-hidden />
          <span>Waiting for opponent bid…</span>
        </div>
      ) : null}
    </div>
  );
}
