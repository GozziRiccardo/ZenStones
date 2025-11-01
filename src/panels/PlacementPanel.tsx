import * as React from 'react';
import type { GameState } from '../game/types';
import { hasPlacementOption } from '../game/utils';

export function PlacementPanel({ state, onPass }:{ state: GameState; onPass: ()=>void }){
  const active = state.turn ? (state.turn === 'W' ? 'White' : 'Black') : '-';
  const counts = state.placementCounts;
  const activeCount = state.turn ? counts[state.turn] : 0;
  const canPlace = state.turn ? hasPlacementOption(state, state.turn) : false;
  const mustPlace = !!state.turn && activeCount < 1 && canPlace;
  const maxReached = !!state.turn && counts[state.turn] >= 10;
  const infoLine = `White: ${counts.W}/10 • Black: ${counts.B}/10`;
  const passTooltip = mustPlace ? 'You must place at least one stone before passing.' : undefined;
  return (
    <div className="panel">
      <div className="card">
        <b>Placement:</b> {active} to move. Hover squares to preview the credit cost — your half is always available, and the matching square in the opponent half unlocks once they claim its number. Two consecutive passes end placement.
        <div className="small" style={{ marginTop: 4 }}>Stones placed — {infoLine}</div>
        {maxReached ? (
          <div className="small" style={{ marginTop: 4 }}>
            {active} has placed ten stones and must pass.
          </div>
        ) : null}
      </div>
      <button className="btn outline" onClick={onPass} disabled={mustPlace} title={passTooltip}>Pass</button>
      <div className="small">Last placement by: <b>{state.lastPlacementBy ?? '-'}</b> | Passes in a row: {state.passesInARow}</div>
    </div>
  );
}
