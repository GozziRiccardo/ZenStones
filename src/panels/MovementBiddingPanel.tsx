import * as React from 'react';
import type { GameState, Player } from '../game/types';

export function MovementBiddingPanel({
  state,
  lockBid,
  submitPlan,
}: {
  state: GameState;
  lockBid: (player: Player, bid: number) => void;
  submitPlan: (player: Player, startingPlayer: Player) => void;
}) {
  const bids = state.movement.bids;
  const [wBid, setWBid] = React.useState<number>(bids.W ?? 0);
  const [bBid, setBBid] = React.useState<number>(bids.B ?? 0);
  React.useEffect(() => {
    if (bids.W !== undefined) setWBid(bids.W);
  }, [bids.W]);
  React.useEffect(() => {
    if (bids.B !== undefined) setBBid(bids.B);
  }, [bids.B]);

  const lockWhite = () => lockBid('W', Math.max(0, Math.min(wBid, state.credits.W)));
  const lockBlack = () => lockBid('B', Math.max(0, Math.min(bBid, state.credits.B)));
  const whiteLocked = typeof bids.W === 'number';
  const blackLocked = typeof bids.B === 'number';

  const winner = bids.winner;
  const limit = state.movement.moveLimit ?? 0;

  const [starter, setStarter] = React.useState<Player>(winner ?? 'W');
  React.useEffect(() => {
    if (winner) {
      setStarter(winner);
    }
  }, [winner]);

  const onPlan = () => {
    if (!winner) return;
    submitPlan(winner, starter);
  };

  const summaryRows = bids.revealed ? (
    <div className="reveal">
      <div className="reveal-row">
        <span>Bids revealed:</span>
        <span>White {bids.W}</span>
        <span>Black {bids.B}</span>
        <span>Chooser: <b>{winner === 'B' ? 'Black' : 'White'}</b></span>
        <span>Limit: <b>{limit}</b></span>
      </div>
    </div>
  ) : null;

  return (
    <div className="panel card" style={{ width: '100%' }}>
      <div>
        <b>Movement bidding</b> — enter secret bids (integer ≤ credits), then lock. Both clocks tick until reveal.
      </div>
      <div className="row gap" style={{ alignItems: 'flex-end' }}>
        <BidBlock
          label="White"
          value={wBid}
          lockedValue={bids.W}
          credits={state.credits.W}
          onChange={setWBid}
          onLock={lockWhite}
          disabled={whiteLocked}
        />
        <BidBlock
          label="Black"
          value={bBid}
          lockedValue={bids.B}
          credits={state.credits.B}
          onChange={setBBid}
          onLock={lockBlack}
          disabled={blackLocked}
        />
      </div>
      {whiteLocked && blackLocked && !bids.revealed ? (
        <div className="small">Both locked — revealing movement bids…</div>
      ) : null}
      {summaryRows}
      {bids.revealed && winner ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <b>{winner === 'B' ? 'Black' : 'White'}</b> pays their bid and chooses who starts.
          </div>
          <div className="small" style={{ marginBottom: 8 }}>
            Move limit: <b>{limit}</b> — exactly the winning bid.
          </div>
          <div className="row gap" style={{ marginBottom: 8 }}>
            <button
              className={`btn outline${starter === 'W' ? ' active' : ''}`}
              onClick={() => setStarter('W')}
            >
              White starts
            </button>
            <button
              className={`btn outline${starter === 'B' ? ' active' : ''}`}
              onClick={() => setStarter('B')}
            >
              Black starts
            </button>
          </div>
          <button className="btn" onClick={onPlan}>Confirm plan</button>
        </div>
      ) : null}
    </div>
  );
}

function BidBlock({
  label,
  value,
  lockedValue,
  credits,
  onChange,
  onLock,
  disabled,
}: {
  label: string;
  value: number;
  lockedValue?: number;
  credits: number;
  onChange: (n: number) => void;
  onLock: () => void;
  disabled: boolean;
}) {
  return (
    <div className="card" style={{ flex: 1 }}>
      <div>
        <b>{label} bid</b> <span className="small">Credits: {credits}</span>
      </div>
      {lockedValue === undefined ? (
        <input
          className="input number"
          type="number"
          value={value}
          min={0}
          max={credits}
          onChange={(e) => onChange(Number.parseInt(e.target.value || '0', 10))}
        />
      ) : (
        <div className="locked-value">Locked: {lockedValue}</div>
      )}
      <button className="btn" onClick={onLock} disabled={disabled}>
        Lock {label[0]}
      </button>
    </div>
  );
}
