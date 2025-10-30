import * as React from 'react';
import type { GameState } from '../game/types';

export function HUD({ state }: { state: GameState }){
  const fmt = (ms:number)=>{
    const m = Math.floor(Math.max(0, ms)/60000);
    const s = Math.floor((Math.max(0, ms)%60000)/1000);
    return `${m}:${s.toString().padStart(2,'0')}`;
  };
  return (
    <div className="hud">
      <div className="badge">Phase: {state.phase}</div>
      <div className="stat">Turn: <b>{state.turn??'-'}</b></div>
      <div className="stat">Credits W: <b>{state.credits.W}</b></div>
      <div className="stat">Credits B: <b>{state.credits.B}</b></div>
      <div className="stat">Score W: <b>{state.scores.W}</b></div>
      <div className="stat">Score B: <b>{state.scores.B}</b></div>
      <div className="stat">Clock W: <b>{fmt(state.clocks.W)}</b></div>
      <div className="stat">Clock B: <b>{fmt(state.clocks.B)}</b></div>
    </div>
  );
}
