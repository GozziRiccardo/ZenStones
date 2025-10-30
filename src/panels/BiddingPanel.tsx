import * as React from 'react';
import type { GameState, Player } from '../game/types';

export function BiddingPanel({ state, lockBid }:{ state: GameState; lockBid: (p:Player, bid:number)=>void }){
  const [w,setW]=React.useState<number>(state.bids.W ?? 0);
  const [b,setB]=React.useState<number>(state.bids.B ?? 0);
  const lockW = ()=> lockBid('W', Math.max(0, Math.min(w, state.credits.W)));
  const lockB = ()=> lockBid('B', Math.max(0, Math.min(b, state.credits.B)));
  const lockedW = typeof state.bids.W === 'number';
  const lockedB = typeof state.bids.B === 'number';

  return (
    <div className="panel card" style={{width:'100%'}}>
      <div><b>Bidding</b> — enter secret bids (integer ≤ credits), then Lock. Both clocks tick.</div>
      <div className="row gap" style={{alignItems:'flex-end'}}>
        <div className="card" style={{flex:1}}>
          <div><b>White bid</b></div>
          <input className="input number" type="number" value={w} onChange={e=>setW(parseInt(e.target.value||'0'))} disabled={lockedW}/>
          <button className="btn" onClick={lockW} disabled={lockedW}>Lock W</button>
        </div>
        <div className="card" style={{flex:1}}>
          <div><b>Black bid</b></div>
          <input className="input number" type="number" value={b} onChange={e=>setB(parseInt(e.target.value||'0'))} disabled={lockedB}/>
          <button className="btn" onClick={lockB} disabled={lockedB}>Lock B</button>
        </div>
      </div>
      {(lockedW && lockedB) ? <div className="small">Both locked — bids will reveal automatically.</div> : null}
    </div>
  );
}
