import * as React from 'react';
import type { Assignment, GameState, Player } from '../game/types';
import { DIR } from '../game/types';
import { calculateAssignmentCost } from '../game/state';

type AssignMap = Record<string, Assignment>;

type AssignStatsPanelProps = {
  state: GameState;
  player: Player;
  onCommit: (assignments: AssignMap) => void;
  onFocusStone?: (id: string | null) => void;
  focusedStoneId?: string | null;
};

export function AssignStatsPanel({ state, player, onCommit, onFocusStone, focusedStoneId }: AssignStatsPanelProps){
  const stones = React.useMemo(()=>Object.values(state.stones).filter(s=>s.owner===player), [state.stones, player]);
  const initial = React.useMemo<AssignMap>(()=>{
    const map:AssignMap = {};
    for (const s of stones) {
      map[s.id] = {
        d: (s.d ?? 1) as Assignment['d'],
        dirs: s.dirs ?? 0,
        persistent: !!s.persistent,
      };
    }
    return map;
  }, [stones]);

  const [vals,setVals]=React.useState<AssignMap>(initial);
  React.useEffect(()=>{ setVals(initial); }, [initial]);

  const toggleDir=(id:string, bit:number)=> {
    onFocusStone?.(id);
    setVals((v:AssignMap)=>({ ...v, [id]: { ...v[id], dirs: (v[id].dirs ^ bit) }}));
  };
  const togglePersistence=(id:string)=> {
    onFocusStone?.(id);
    setVals((v:AssignMap)=>({ ...v, [id]: { ...v[id], persistent: !v[id].persistent }}));
  };
  const setD=(id:string, d:Assignment['d'])=> {
    onFocusStone?.(id);
    setVals((v:AssignMap)=>({ ...v, [id]: { ...v[id], d }}));
  };
  const cost = calculateAssignmentCost(vals);
  const insufficient = cost > state.credits[player];
  const opponent = player === 'W' ? 'B' : 'W';
  const previousTemplate = state.assignments[opponent];

  const applyToAll = ()=>{
    if (stones.length === 0) return;
    const first = vals[stones[0].id];
    if (!first) return;
    const next:AssignMap = {};
    for (const s of stones) {
      next[s.id] = {
        d: first.d,
        dirs: first.dirs ?? 0,
        persistent: !!first.persistent,
      };
    }
    setVals(next);
  };

  const clonePrevious = ()=>{
    if (!previousTemplate || Object.keys(previousTemplate).length===0) return;
    const entries = Object.values(previousTemplate);
    if (entries.length===0) return;
    const next:AssignMap = {};
    stones.forEach((s, idx)=>{
      const ref = entries[idx % entries.length];
      next[s.id] = {
        d: ref.d,
        dirs: ref.dirs ?? 0,
        persistent: !!ref.persistent,
      };
    });
    setVals(next);
  };

  return (
    <div className="panel card" style={{width:'100%'}}>
      <div className="row gap" style={{alignItems:'center'}}>
        <div>
          <b>Assign stats for {player}</b> — cost = distance × number_of_options (directions + persistence).
          Remaining credits: <b>{state.credits[player]}</b>. Planned spend: <b>{cost}</b>.
        </div>
        <div className="row gap" style={{flexWrap:'wrap'}}>
          <button className="btn outline small-btn" onClick={applyToAll} disabled={stones.length===0}>Apply to all</button>
          <button className="btn outline small-btn" onClick={clonePrevious} disabled={!previousTemplate || Object.keys(previousTemplate).length===0}>Clone previous</button>
        </div>
      </div>
      {insufficient ? <div className="warning">Warning: planned spend exceeds remaining credits.</div> : null}
      <table className="table">
        <thead><tr><th>Square / ID</th><th>Distance</th><th>Options</th><th>Cost</th></tr></thead>
        <tbody>
          {stones.map(s=>{
            const v = vals[s.id];
            const dirs = v?.dirs ?? 0;
            const bits =
              (dirs & DIR.R ? 1:0)+
              (dirs & DIR.L ? 1:0)+
              (dirs & DIR.U ? 1:0)+
              (dirs & DIR.D ? 1:0)+
              (dirs & DIR.UR ? 1:0)+
              (dirs & DIR.UL ? 1:0)+
              (dirs & DIR.DR ? 1:0)+
              (dirs & DIR.DL ? 1:0);
            const rowCost = v ? v.d * (bits + (v.persistent ? 1 : 0)) : 0;
            const labelGrid = player === 'W' ? state.labels.whiteHalf : state.labels.blackHalf;
            const squareNumber = labelGrid[s.r]?.[s.c] ?? '-';
            return (
              <tr key={s.id} className={focusedStoneId === s.id ? 'selected' : undefined}>
                <td>
                  <div className="stone-label">
                    <div className="stone-label-name">Square {squareNumber}</div>
                    <div className="stone-label-id">{s.id}</div>
                  </div>
                </td>
                <td>
                  <select
                    className="input"
                    value={v?.d ?? 1}
                    onChange={e=>setD(s.id, parseInt(e.target.value, 10) as Assignment['d'])}
                    onFocus={()=>onFocusStone?.(s.id)}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                </td>
                <td className="dir-cell">
                  <div className="dir-grid">
                    <DirCheckbox label="↖" checked={!!(dirs & DIR.UL)} onChange={()=>toggleDir(s.id, DIR.UL)} onFocus={()=>onFocusStone?.(s.id)} hideBox />
                    <DirCheckbox label="↑" checked={!!(dirs & DIR.U)} onChange={()=>toggleDir(s.id, DIR.U)} onFocus={()=>onFocusStone?.(s.id)} hideBox />
                    <DirCheckbox label="↗" checked={!!(dirs & DIR.UR)} onChange={()=>toggleDir(s.id, DIR.UR)} onFocus={()=>onFocusStone?.(s.id)} hideBox />
                    <DirCheckbox label="←" checked={!!(dirs & DIR.L)} onChange={()=>toggleDir(s.id, DIR.L)} onFocus={()=>onFocusStone?.(s.id)} hideBox />
                    <div className="dir-center" />
                    <DirCheckbox label="→" checked={!!(dirs & DIR.R)} onChange={()=>toggleDir(s.id, DIR.R)} onFocus={()=>onFocusStone?.(s.id)} hideBox />
                    <DirCheckbox label="↙" checked={!!(dirs & DIR.DL)} onChange={()=>toggleDir(s.id, DIR.DL)} onFocus={()=>onFocusStone?.(s.id)} hideBox />
                    <DirCheckbox label="↓" checked={!!(dirs & DIR.D)} onChange={()=>toggleDir(s.id, DIR.D)} onFocus={()=>onFocusStone?.(s.id)} hideBox />
                    <DirCheckbox label="↘" checked={!!(dirs & DIR.DR)} onChange={()=>toggleDir(s.id, DIR.DR)} onFocus={()=>onFocusStone?.(s.id)} hideBox />
                  </div>
                  <div className="persistence-toggle">
                    <DirCheckbox
                      label="Persistence"
                      checked={!!v?.persistent}
                      onChange={()=>togglePersistence(s.id)}
                      onFocus={()=>onFocusStone?.(s.id)}
                    />
                  </div>
                </td>
                <td>{rowCost}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="row gap" style={{justifyContent:'flex-end'}}>
        <button className="btn" onClick={()=>onCommit(vals)} disabled={insufficient}>Commit ({cost})</button>
      </div>
    </div>
  );
}

function DirCheckbox({ label, checked, onChange, onFocus, hideBox }:{ label:React.ReactNode; checked:boolean; onChange:()=>void; onFocus?:()=>void; hideBox?:boolean }){
  return (
    <label className={`dir-check${hideBox ? ' hide-box' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} onFocus={onFocus} />
      {hideBox ? <span className="dir-symbol">{label}</span> : label}
    </label>
  );
}
