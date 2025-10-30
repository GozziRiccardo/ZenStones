import * as React from 'react';
import type { GameState, Player } from '../game/types';

type Mode = 'none' | 'both' | Player;

export function HUD({ state, tickingMode }: { state: GameState; tickingMode: Mode }){
  const fmt = (ms:number)=>{
    const m = Math.floor(Math.max(0, ms)/60000);
    const s = Math.floor((Math.max(0, ms)%60000)/1000);
    return `${m}:${s.toString().padStart(2,'0')}`;
  };

  const turnBadge = (()=>{
    if (state.phase === 'ASSIGN_STATS_W') return { label: 'Assigning: White', className: 'turn turn-w' };
    if (state.phase === 'ASSIGN_STATS_B') return { label: 'Assigning: Black', className: 'turn turn-b' };
    if (state.phase === 'BIDDING' && state.bids.revealed) {
      return { label: `Initiative: ${state.bids.startingPlayer === 'B' ? 'Black' : 'White'}`, className: 'turn neutral' };
    }
    if (!state.turn) return { label: 'Turn: -', className: 'turn neutral' };
    return { label: `Turn: ${state.turn === 'B' ? 'Black' : 'White'}`, className: `turn ${state.turn === 'B' ? 'turn-b' : 'turn-w'}` };
  })();

  const timerClass = (player: Player) => {
    const classes = ['stat','timer'];
    const active = tickingMode === 'both' || tickingMode === player;
    if (active) classes.push('active');
    if (active && state.clocks[player] <= 10000) classes.push('critical');
    return classes.join(' ');
  };

  return (
    <div className="hud">
      <div className="badge phase">Phase: {state.phase}</div>
      <div className={`badge ${turnBadge.className}`}>{turnBadge.label}</div>
      <div className="stat">Credits W: <b>{state.credits.W}</b></div>
      <div className="stat">Credits B: <b>{state.credits.B}</b></div>
      <div className="stat">Score W: <b>{state.scores.W}</b></div>
      <div className="stat">Score B: <b>{state.scores.B}</b></div>
      <div className={timerClass('W')}>Clock W: <b>{fmt(state.clocks.W)}</b></div>
      <div className={timerClass('B')}>Clock B: <b>{fmt(state.clocks.B)}</b></div>
    </div>
  );
}
