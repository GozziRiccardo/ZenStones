import * as React from 'react';
import type { GameState } from '../game/types';
import { squareCostForPlayer } from '../game/utils';
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
  return (
    <div
      className={classes.join(' ')}
      style={{gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`}}
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
          const label = r < mid ? blackLabel : whiteLabel;
          sqClasses.push(r < mid ? 'half-black' : 'half-white');
          if (state.phase === 'PLACEMENT') {
            const active = state.turn ? squareCostForPlayer(state, state.turn, r, c) > 0 : false;
            sqClasses.push(active ? 'active-half' : 'inactive-half');
            const owner = r < mid ? 'B' : 'W';
            const ownerBlocked = state.blockedLabels?.[owner] ?? {};
            if (label && ownerBlocked[label]) {
              sqClasses.push('blocked-half');
            }
          }
          if (selectedId && id === selectedId) {
            sqClasses.push('selected');
          }
          const costForWhite = squareCostForPlayer(state, 'W', r, c);
          const costForBlack = squareCostForPlayer(state, 'B', r, c);
          const tooltipCost = state.phase === 'PLACEMENT'
            ? state.turn === 'W'
              ? costForWhite
              : costForBlack
            : label;
          const showCost = tooltipCost > 0;
          const isNew = id && state.lastPlacementId === id;
          return (
            <div
              key={`${r}-${c}`}
              className={sqClasses.join(' ')}
              onClick={()=>onSquareClick(r,c)}
              data-cost={showCost ? tooltipCost : undefined}
            >
              {stone && (
                <div
                  className={`stone-wrapper ${stone.owner === 'B' ? 'stone-black' : 'stone-white'}${isNew ? ' drop' : ''}`}
                >
                  <StoneIcon d={(stone.d||1) as any} owner={stone.owner} persistent={stone.persistent} />
                  {stone.dirs ? <DirArrows dirs={stone.dirs} owner={stone.owner} /> : null}
                </div>
              )}
              <div className="label">{label?label:''}</div>
            </div>
          )
        })
      ))}
    </div>
  );
}
