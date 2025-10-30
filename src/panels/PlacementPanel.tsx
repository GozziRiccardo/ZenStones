import * as React from 'react';
import type { GameState } from '../game/types';

export function PlacementPanel({ state, onPass }:{ state: GameState; onPass: ()=>void }){
  return (
    <div className="panel">
      <div className="card"><b>Placement:</b> Click your half to place a stone (pay the square label). Pass is allowed. Two passes end phase.</div>
      <button className="btn outline" onClick={onPass}>Pass</button>
      <div className="small">Last placement by: <b>{state.lastPlacementBy ?? '-'}</b> | Passes in a row: {state.passesInARow}</div>
    </div>
  );
}
