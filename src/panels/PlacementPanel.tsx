import * as React from 'react';
import type { GameState } from '../game/types';

export function PlacementPanel({ state, onPass }:{ state: GameState; onPass: ()=>void }){
  const active = state.turn ? (state.turn === 'W' ? 'White' : 'Black') : '-';
  return (
    <div className="panel">
      <div className="card">
        <b>Placement:</b> {active} to move. Hover squares to preview the credit cost — you can only play in your half.
        Two consecutive passes end placement.
      </div>
      <button className="btn outline" onClick={onPass}>Pass</button>
      <div className="small">Last placement by: <b>{state.lastPlacementBy ?? '-'}</b> | Passes in a row: {state.passesInARow}</div>
    </div>
  );
}
