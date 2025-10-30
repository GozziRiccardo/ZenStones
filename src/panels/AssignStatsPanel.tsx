import * as React from 'react';
import type { Assignment, GameState, Player } from '../game/types';
import { DIR } from '../game/types';
import { calculateAssignmentCost } from '../game/state';

type AssignMap = Record<string, Assignment>;

export function AssignStatsPanel({ state, player, onCommit }:{ state:GameState; player:Player; onCommit:(assignments:AssignMap)=>void }){
  const stones = React.useMemo(()=>Object.values(state.stones).filter(s=>s.owner===player), [state.stones, player]);
  const initial = React.useMemo<AssignMap>(()=>{
    const map:AssignMap = {};
    for (const s of stones) {
      map[s.id] = {
        d: (s.d ?? 1) as Assignment['d'],
        dirs: s.dirs ?? 0,
      };
    }
    return map;
  }, [stones]);

  const [vals,setVals]=React.useState<AssignMap>(initial);
  React.useEffect(()=>{ setVals(initial); }, [initial]);

  const toggleDir=(id:string, bit:number)=> setVals((v:AssignMap)=>({ ...v, [id]: { ...v[id], dirs: (v[id].dirs ^ bit) }}));
  const setD=(id:string, d:Assignment['d'])=> setVals((v:AssignMap)=>({ ...v, [id]: { ...v[id], d }}));
  const cost = calculateAssignmentCost(vals);
  const insufficient = cost > state.credits[player];
  const opponent = player === 'W' ? 'B' : 'W';
  const previousTemplate = state.assignments[opponent];

  const applyToAll = ()=>{
    if (stones.length === 0) return;
    const first = vals[stones[0].id];
    if (!first) return;
    const next:AssignMap = {};
    for (const s of stones) next[s.id] = { ...first };
    setVals(next);
  };

  const clonePrevious = ()=>{
    if (!previousTemplate || Object.keys(previousTemplate).length===0) return;
    const entries = Object.values(previousTemplate);
    if (entries.length===0) return;
    const next:AssignMap = {};
    stones.forEach((s, idx)=>{
      const ref = entries[idx % entries.length];
      next[s.id] = { ...ref };
    });
    setVals(next);
  };

  return (
    <div className="panel card" style={{width:'100%'}}>
      <div className="row gap" style={{alignItems:'center'}}>
        <div>
          <b>Assign stats for {player}</b> — cost = distance × number_of_directions.
          Remaining credits: <b>{state.credits[player]}</b>. Planned spend: <b>{cost}</b>.
        </div>
        <div className="row gap" style={{flexWrap:'wrap'}}>
          <button className="btn outline small-btn" onClick={applyToAll} disabled={stones.length===0}>Apply to all</button>
          <button className="btn outline small-btn" onClick={clonePrevious} disabled={!previousTemplate || Object.keys(previousTemplate).length===0}>Clone previous</button>
        </div>
      </div>
      {insufficient ? <div className="warning">Warning: planned spend exceeds remaining credits.</div> : null}
      <table className="table">
        <thead><tr><th>Stone</th><th>Pos</th><th>Distance</th><th>Directions</th><th>Cost</th></tr></thead>
        <tbody>
          {stones.map(s=>{
            const v = vals[s.id];
            const dirs = v?.dirs ?? 0;
            const bits = (dirs & DIR.R ? 1:0)+(dirs & DIR.L ? 1:0)+(dirs & DIR.U ? 1:0)+(dirs & DIR.D ? 1:0);
            const rowCost = v ? v.d * bits : 0;
            return (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>({s.r},{s.c})</td>
                <td>
                  <select className="input" value={v?.d ?? 1} onChange={e=>setD(s.id, parseInt(e.target.value, 10) as Assignment['d'])}>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                </td>
                <td className="dir-cell">
                  <DirCheckbox label="→" checked={!!(dirs & DIR.R)} onChange={()=>toggleDir(s.id, DIR.R)} />
                  <DirCheckbox label="←" checked={!!(dirs & DIR.L)} onChange={()=>toggleDir(s.id, DIR.L)} />
                  <DirCheckbox label="↑" checked={!!(dirs & DIR.U)} onChange={()=>toggleDir(s.id, DIR.U)} />
                  <DirCheckbox label="↓" checked={!!(dirs & DIR.D)} onChange={()=>toggleDir(s.id, DIR.D)} />
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

function DirCheckbox({ label, checked, onChange }:{ label:string; checked:boolean; onChange:()=>void }){
  return (
    <label className="dir-check">
      <input type="checkbox" checked={checked} onChange={onChange} /> {label}
    </label>
  );
}
