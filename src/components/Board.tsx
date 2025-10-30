import * as React from 'react';
import type { GameState, Player } from '../game/types';
import { labelForOpponentHalf, labelForPlayerHalf } from '../game/labels';
import { StoneIcon, DirArrows } from './StoneIcon';

type BoardProps = {
  state: GameState;
  onSquareClick: (r:number,c:number)=>void;
  highlights?: {r:number;c:number}[];
  selectedId?: string | null;
};

export function Board({ state, onSquareClick, highlights = [], selectedId }: BoardProps){
  const rows = state.board.length;
  const cols = state.board[0].length;
  const isHighlight = (r:number,c:number) => highlights.some(p=>p.r===r && p.c===c);
  const mid = Math.floor(rows/2);
  const classes = ['board','grid'];
  if (state.phase === 'PLACEMENT') {
    classes.push('placement');
    classes.push(state.turn === 'B' ? 'turn-b' : 'turn-w');
  }
  const columnLabels = React.useMemo(
    () => Array.from({ length: cols }, (_, i) => String.fromCharCode(65 + i)),
    [cols],
  );
  const rowLabels = React.useMemo(
    () => Array.from({ length: rows }, (_, i) => `${i + 1}`),
    [rows],
  );
  const shellStyle = React.useMemo(
    () => ({ '--board-cols': cols, '--board-rows': rows } as React.CSSProperties),
    [cols, rows],
  );
  const activePlayer: Player = React.useMemo(() => {
    if (state.turn) return state.turn;
    if (state.phase === 'ASSIGN_STATS_B') return 'B';
    return 'W';
  }, [state.turn, state.phase]);
  const opponent: Player = activePlayer === 'W' ? 'B' : 'W';
  const boardStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
  };
  return (
    <div className="board-shell" style={shellStyle}>
      <div className="board-axis horizontal top">
        {columnLabels.map((label) => (
          <div key={`top-${label}`} className="axis-cell">{label}</div>
        ))}
      </div>
      <div className="board-axis horizontal bottom">
        {columnLabels.map((label) => (
          <div key={`bottom-${label}`} className="axis-cell">{label}</div>
        ))}
      </div>
      <div className="board-axis vertical left">
        {rowLabels.map((label) => (
          <div key={`left-${label}`} className="axis-cell">{label}</div>
        ))}
      </div>
      <div className="board-axis vertical right">
        {rowLabels.map((label) => (
          <div key={`right-${label}`} className="axis-cell">{label}</div>
        ))}
      </div>
      <div
        className={classes.join(' ')}
        style={boardStyle}
      >
        {Array.from({length: rows}).map((_, r)=>(
          Array.from({length: cols}).map((__, c)=>{
            const dark = (r+c)%2===1;
            const sqClasses = ['square', dark ? 'dark':'light'];
            if (isHighlight(r,c)) sqClasses.push('reach');
            const id = state.board[r][c];
            const stone = id ? state.stones[id] : null;
            const whiteLabel = state.labels.whiteHalf[r][c];
            const blackLabel = state.labels.blackHalf[r][c];
            sqClasses.push(r < mid ? 'half-black' : 'half-white');
            if (state.phase === 'PLACEMENT') {
              const activeHalf = state.turn === 'W' ? r >= mid : r < mid;
              sqClasses.push(activeHalf ? 'active-half' : 'inactive-half');
            }
            if (selectedId && id === selectedId) {
              sqClasses.push('selected');
            }
            const isActiveHalf = activePlayer === 'W' ? r >= mid : r < mid;
            let displayLabel = '';
            let labelTone = 'neutral';
            if (state.phase === 'PLACEMENT' && state.turn) {
              if (isActiveHalf) {
                const cost = labelForPlayerHalf(r, c, state.turn, state.labels);
                if (cost > 0) {
                  displayLabel = `-${cost}`;
                  labelTone = 'negative';
                }
              } else {
                const reward = labelForOpponentHalf(r, c, state.turn, state.labels);
                if (reward > 0) {
                  displayLabel = `+${reward}`;
                  labelTone = 'positive';
                }
              }
            } else if (state.phase === 'MOVEMENT' && state.turn) {
              if (isActiveHalf) {
                const oppGain = labelForOpponentHalf(r, c, opponent, state.labels);
                if (oppGain > 0) {
                  displayLabel = `-${oppGain}`;
                  labelTone = 'negative';
                }
              } else {
                const reward = labelForOpponentHalf(r, c, state.turn, state.labels);
                if (reward > 0) {
                  displayLabel = `+${reward}`;
                  labelTone = 'positive';
                }
              }
            } else {
              const base = r < mid ? blackLabel : whiteLabel;
              if (base > 0) {
                displayLabel = `+${base}`;
                labelTone = 'positive';
              }
            }
            const isNew = id && state.lastPlacementId === id;
            return (
              <div
                key={`${r}-${c}`}
                className={sqClasses.join(' ')}
                onClick={()=>onSquareClick(r,c)}
                data-cost={displayLabel || undefined}
              >
                {stone && (
                  <div className={`stone-wrapper${isNew ? ' drop' : ''}`}>
                    <StoneIcon d={(stone.d||1) as any} />
                    {stone.dirs ? <DirArrows dirs={stone.dirs} /> : null}
                  </div>
                )}
                <div className={`label ${labelTone}`}>{displayLabel}</div>
              </div>
            )
          })
        ))}
      </div>
    </div>
  );
}
