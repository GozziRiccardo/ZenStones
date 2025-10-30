import * as React from 'react';
import type { GameState, Player } from '../game/types';

export function BiddingPanel({ state, lockBid, startPlacement }:{ state: GameState; lockBid: (p:Player, bid:number)=>void; startPlacement: ()=>void }){
  const [w,setW]=React.useState<number>(state.bids.W ?? 0);
  const [b,setB]=React.useState<number>(state.bids.B ?? 0);
  React.useEffect(()=>{ if (state.bids.W !== undefined) setW(state.bids.W); }, [state.bids.W]);
  React.useEffect(()=>{ if (state.bids.B !== undefined) setB(state.bids.B); }, [state.bids.B]);
  const lockW = ()=> lockBid('W', Math.max(0, Math.min(w, state.credits.W)));
  const lockB = ()=> lockBid('B', Math.max(0, Math.min(b, state.credits.B)));
  const lockedW = typeof state.bids.W === 'number';
  const lockedB = typeof state.bids.B === 'number';

  return (
    <div className="panel card" style={{width:'100%'}}>
      <div><b>Bidding</b> — enter secret bids (integer ≤ credits), then Lock. Both clocks tick.</div>
      <div className="row gap" style={{alignItems:'flex-end'}}>
        <BidBlock
          label="White"
          value={w}
          lockedValue={state.bids.W}
          credits={state.credits.W}
          onChange={setW}
          onLock={lockW}
          disabled={lockedW}
        />
        <BidBlock
          label="Black"
          value={b}
          lockedValue={state.bids.B}
          credits={state.credits.B}
          onChange={setB}
          onLock={lockB}
          disabled={lockedB}
        />
      </div>
      {(lockedW && lockedB && !state.bids.revealed) ? <div className="small">Both locked — revealing bids…</div> : null}
      {state.bids.revealed ? (
        <div className="reveal">
          <div className="reveal-row">
            <span>Bids revealed:</span>
            <span>White {state.bids.W}</span>
            <span>Black {state.bids.B}</span>
            <span>Starter: <b>{state.bids.startingPlayer === 'B' ? 'Black' : 'White'}</b></span>
          </div>
          <button className="btn" onClick={startPlacement}>Begin placement</button>
        </div>
      ) : null}
    </div>
  );
}

function BidBlock({ label, value, lockedValue, credits, onChange, onLock, disabled }:{
  label: string;
  value: number;
  lockedValue?: number;
  credits: number;
  onChange: (n:number)=>void;
  onLock: ()=>void;
  disabled: boolean;
}){
  return (
    <div className="card" style={{flex:1}}>
      <div><b>{label} bid</b> <span className="small">Credits: {credits}</span></div>
      {lockedValue === undefined ? (
        <input className="input number" type="number" value={value} min={0} max={credits} onChange={e=>onChange(parseInt(e.target.value||'0'))} />
      ) : (
        <div className="locked-value">Locked: {lockedValue}</div>
      )}
      <button className="btn" onClick={onLock} disabled={disabled}>Lock {label[0]}</button>
    </div>
  );
}
