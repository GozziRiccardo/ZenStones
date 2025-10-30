import * as React from 'react';
import type { GameState, Player } from '../game/types';
import { computeScoreDetails } from '../game/utils';

const players: Player[] = ['W', 'B'];

export function ScoresPanel({ state }: { state: GameState }) {
  const details = React.useMemo(() => computeScoreDetails(state), [state]);
  return (
    <div className="card scores">
      <div className="scores-header">Score breakdown</div>
      <div className="scores-grid">
        {players.map((p) => {
          const entry = details[p];
          return (
            <div key={p} className={`scores-col ${p === 'W' ? 'white' : 'black'}`}>
              <div className="scores-title">{p === 'W' ? 'White' : 'Black'}</div>
              <div className="scores-line"><span>Credits</span><span>{entry.credits}</span></div>
              <div className="scores-line"><span>Position pts</span><span>{entry.position}</span></div>
              <div className="scores-total"><span>Total</span><span>{entry.total}</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
