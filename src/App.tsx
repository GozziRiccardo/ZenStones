import * as React from 'react';
import './styles.css';
import type { GameState, Player, Stone } from './game/types';
import { DIR } from './game/types';
import { emptyBoard, newId, stoneAt, legalMoves, recalcScores } from './game/utils';
import { makeLabels } from './game/labels';
import { HUD } from './components/HUD';
import { Board } from './components/Board';
import { BiddingPanel } from './panels/BiddingPanel';
import { PlacementPanel } from './panels/PlacementPanel';
import { AssignStatsPanel } from './panels/AssignStatsPanel';

function now(){ return Date.now(); }

export default function App(){
  const [state, setState] = React.useState<GameState>(()=>{
    const labels = makeLabels(10,10);
    const st: GameState = {
      seed: String(Date.now()),
      board: emptyBoard(10,10),
      stones: {},
      turn: null,
      phase: 'BIDDING',
      lastPlacementBy: undefined,
      credits: { W:100, B:100 },
      clocks: { W: 10*60*1000, B: 10*60*1000 },
      scores: { W: 0, B: 0 },
      bids: { revealed: false },
      passesInARow: 0,
      labels,
    };
    return st;
  });

  // Timers
  const lastRef = React.useRef<number>(now());
  const tickingModeRef = React.useRef<'none'|'both'|'W'|'B'>('both'); // bidding: both
  React.useEffect(()=>{
    if (state.phase === 'BIDDING') tickingModeRef.current = 'both';
    else if (state.phase === 'PLACEMENT') tickingModeRef.current = state.turn ?? 'none';
    else if (state.phase === 'ASSIGN_STATS_W') tickingModeRef.current = 'W';
    else if (state.phase === 'ASSIGN_STATS_B') tickingModeRef.current = 'B';
    else if (state.phase === 'MOVEMENT') tickingModeRef.current = state.turn ?? 'none';
    else tickingModeRef.current = 'none';
  }, [state.phase, state.turn]);

  React.useEffect(()=>{
    const id = setInterval(()=>{
      const nowTs = now();
      const dt = nowTs - lastRef.current;
      lastRef.current = nowTs;
      setState(s=>{
        const mode = tickingModeRef.current;
        if (mode === 'none') return s;
        const n = {...s, clocks:{...s.clocks}};
        if (mode === 'both'){
          n.clocks.W = Math.max(0, n.clocks.W - dt);
          n.clocks.B = Math.max(0, n.clocks.B - dt);
        } else {
          n.clocks[mode] = Math.max(0, n.clocks[mode] - dt);
        }
        if (n.phase!=='ENDED' && (n.clocks.W===0 || n.clocks.B===0)){
          n.phase = 'ENDED';
          n.winner = (n.clocks.W===0) ? 'B' : 'W';
        }
        return n;
      });
    }, 100);
    return ()=>clearInterval(id);
  }, []);

  // recompute scores once movement starts
  React.useEffect(()=>{
    setState(s=>{
      if (s.phase === 'MOVEMENT' || s.phase === 'ENDED'){
        const n = {...s, scores:{...s.scores}};
        recalcScores(n);
        if (n.phase!=='ENDED'){
          if (n.scores.W>=100 || n.scores.B>=100){
            n.phase='ENDED';
            n.winner = n.scores.W===n.scores.B ? s.turn! : (n.scores.W>n.scores.B ? 'W':'B');
          }
        }
        return n;
      }
      return s;
    })
  }, [state.board, state.stones, state.credits, state.phase]);

  const startPlacementAfterBids = (st:GameState)=>{
    const W = st.bids.W||0, B = st.bids.B||0;
    const n = {...st, credits:{...st.credits}, phase:'PLACEMENT' as const};
    n.credits.W -= W; n.credits.B -= B;
    n.turn = (W===B) ? 'W' : (W>B?'W':'B');
    n.bids.revealed = true as any;
    return n;
  };

  const onLockBid = (p:Player, bid:number)=>{
    setState(s=>{
      if (s.phase!=='BIDDING') return s;
      const n = {...s, bids:{...s.bids}};
      if (typeof n.bids[p] === 'number') return s;
      n.bids[p] = Math.max(0, Math.min(bid, s.credits[p]));
      if (typeof n.bids.W === 'number' && typeof n.bids.B === 'number'){
        return startPlacementAfterBids(n);
      }
      return n;
    });
  };

  const endPlacement = (s:GameState)=>{
    const n = {...s, phase:'ASSIGN_STATS_W' as const, turn:null};
    n.scores.W = n.credits.W;
    n.scores.B = n.credits.B;
    return n;
  };

  const onPassPlacement = ()=>{
    setState(s=>{
      if (s.phase!=='PLACEMENT') return s;
      const passes = s.passesInARow + 1;
      if (passes>=2) return endPlacement({...s, passesInARow: 0});
      const nextTurn = s.turn === 'W' ? 'B' : 'W';
      return { ...s, passesInARow: passes, turn: nextTurn };
    });
  };

  const onSquareClickPlacement = (r:number,c:number)=>{
    setState(s=>{
      if (s.phase!=='PLACEMENT' || !s.turn) return s;
      const rows = s.board.length; const mid = Math.floor(rows/2);
      const inOwnHalf = (s.turn==='W') ? (r>=mid) : (r<mid);
      if (!inOwnHalf) return s;
      if (s.board[r][c]) return s;
      const label = (s.turn==='W') ? s.labels.whiteHalf[r][c] : s.labels.blackHalf[r][c];
      if (!label) return s;
      if (s.credits[s.turn] < label) return s;
      const id = newId();
      const stone: Stone = { id, owner: s.turn, r, c };
      const n = { ...s, stones:{...s.stones}, board: s.board.map(row=>row.slice()), credits:{...s.credits}, passesInARow: 0, lastPlacementBy: s.turn };
      n.stones[id] = stone;
      n.board[r][c] = id;
      n.credits[s.turn] -= label;
      n.turn = s.turn==='W' ? 'B' : 'W';
      return n;
    });
  };

  const [sel, setSel] = React.useState<{id:string; moves:{r:number;c:number}[]}|null>(null);
  const onBoardClickMovement = (r:number,c:number)=>{
    setState(s=>{
      if (s.phase!=='MOVEMENT' || !s.turn) return s;
      const targetId = s.board[r][c];
      if (sel){
        const ok = sel.moves.some(p=>p.r===r && p.c===c);
        if (!ok) { setSel(null); return s; }
        const moving = s.stones[sel.id];
        if (!moving) { setSel(null); return s; }
        const n = { ...s, stones:{...s.stones}, board: s.board.map(row=>row.slice()) };
        const occ = n.board[r][c] ? n.stones[n.board[r][c] as string] : null;
        n.board[moving.r][moving.c] = null;
        if (occ){
          n.board[r][c] = null;
          delete n.stones[occ.id];
          delete n.stones[moving.id];
        } else {
          n.board[r][c] = moving.id;
          n.stones[moving.id] = { ...moving, r, c };
        }
        n.turn = n.turn==='W' ? 'B' : 'W';
        setSel(null);
        const anyW = Object.values(n.stones).some(x=>x.owner==='W');
        const anyB = Object.values(n.stones).some(x=>x.owner==='B');
        if (!anyW || !anyB){
          n.phase='ENDED';
          n.winner = anyW ? 'W' : 'B';
        }
        return n;
      } else {
        if (!targetId) return s;
        const st = s.stones[targetId];
        if (st.owner !== s.turn) return s;
        const moves = legalMoves(s, st);
        if (moves.length===0) return s;
        setSel({ id: st.id, moves });
        return s;
      }
    });
  };

  const onCommitAssign = (player:Player, cost:number)=>{
    setState(s=>{
      if (s.phase!=='ASSIGN_STATS_W' && s.phase!=='ASSIGN_STATS_B') return s;
      const n = { ...s, credits:{...s.credits} };
      n.credits[player] -= cost;
      if (s.phase==='ASSIGN_STATS_W') n.phase = 'ASSIGN_STATS_B';
      else {
        n.phase = 'MOVEMENT';
        n.turn = (s.lastPlacementBy==='W') ? 'B' : 'W';
      }
      return n;
    });
  };

  const reset = ()=>{
    const labels = makeLabels(10,10);
    setState({
      seed: String(Date.now()),
      board: emptyBoard(10,10),
      stones: {},
      turn: null,
      phase: 'BIDDING',
      lastPlacementBy: undefined,
      credits: { W:100, B:100 },
      clocks: { W: 10*60*1000, B: 10*60*1000 },
      scores: { W: 0, B: 0 },
      bids: { revealed: false },
      passesInARow: 0,
      labels,
    });
    setSel(null);
  };

  return (
    <div className="container">
      <div className="row">
        <div className="h1">ZenStones</div>
        <div className="row gap">
          <button className="btn outline" onClick={reset}>New Game</button>
        </div>
      </div>

      <HUD state={state} />

      {state.phase==='ENDED' ? (
        <div className="card"><b>Game Over.</b> Winner: {state.winner}</div>
      ) : null}

      <div className="row" style={{alignItems:'flex-start'}}>
        <Board
          state={state}
          onSquareClick={(r,c)=>{
            if (state.phase==='PLACEMENT') onSquareClickPlacement(r,c);
            else if (state.phase==='MOVEMENT') onBoardClickMovement(r,c);
          }}
          highlights={sel?.moves}
        />
        <div style={{flex:1, minWidth:280}}>
          {state.phase==='BIDDING' && <BiddingPanel state={state} lockBid={onLockBid} />}
          {state.phase==='PLACEMENT' && <PlacementPanel state={state} onPass={onPassPlacement} />}
          {state.phase==='ASSIGN_STATS_W' && <AssignStatsPanel state={state} player="W" onCommit={(cost)=>onCommitAssign('W', cost)} />}
          {state.phase==='ASSIGN_STATS_B' && <AssignStatsPanel state={state} player="B" onCommit={(cost)=>onCommitAssign('B', cost)} />}
          {state.phase==='MOVEMENT' && (
            <div className="card">
              <b>Movement:</b> Select one of your stones, then click a highlighted square. Captures remove both stones.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
