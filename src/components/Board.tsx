import * as React from 'react';
import type { GameState } from '../game/types';
import { StoneIcon, DirArrows } from './StoneIcon';

type BoardProps = {
  state: GameState;
  onSquareClick: (r:number,c:number)=>void;
  highlights?: {r:number;c:number}[];
};

export function Board({ state, onSquareClick, highlights=[] }: BoardProps){
  const rows = state.board.length;
  const cols = state.board[0].length;
  const isHighlight = (r:number,c:number) => highlights.some(p=>p.r===r && p.c===c);
  const mid = Math.floor(rows/2);
  return (
    <div className="board grid" style={{gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`}}>
      {Array.from({length: rows}).map((_, r)=>(
        Array.from({length: cols}).map((__, c)=>{
          const dark = (r+c)%2===1;
          const sqClasses = ['square', dark ? 'dark':'light'];
          if (isHighlight(r,c)) sqClasses.push('reach');
          const id = state.board[r][c];
          const stone = id ? state.stones[id] : null;
          const label = (r<mid) ? state.labels.blackHalf[r][c] : state.labels.whiteHalf[r][c];
          return (
            <div key={`${r}-${c}`} className={sqClasses.join(' ')} onClick={()=>onSquareClick(r,c)}>
              {stone && (
                <div style={{position:'relative'}}>
                  <StoneIcon d={(stone.d||1) as any} />
                  {stone.dirs ? <DirArrows dirs={stone.dirs} /> : null}
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
