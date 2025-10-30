import * as React from 'react';
import type { GameState, Player } from '../game/types';
import { DIR } from '../game/types';

export function AssignStatsPanel({ state, player, onCommit }:{ state:GameState; player:'W'|'B'; onCommit:(cost:number)=>void }){
  const stones = Object.values(state.stones).filter(s=>s.owner===player);
  const [vals,setVals]=React.useState<Record<string,{d:1|2|3|4|5,dirs:number}>>(()=>{
    const m:Record<string,{d:1|2|3|4|5,dirs:number}> = {};
    for (const s of stones) m[s.id] = { d: (s.d??1) as any, dirs: (s.dirs??0) };
    return m;
  });
  const toggleDir=(id:string, bit:number)=> setVals(v=>({ ...v, [id]: { ...v[id], dirs: (v[id].dirs ^ bit) }}));
  const setD=(id:string, d:1|2|3|4|5)=> setVals(v=>({ ...v, [id]: { ...v[id], d }}));
  const countBits=(n:number)=>((n&1)+(n>>1&1)+(n>>2&1)+(n>>3&1));
  const cost = stones.reduce((sum,s)=>{ const v=vals[s.id]; if(!v) return sum; const k = v.d * (countBits(v.dirs)); return sum + k; },0);

  return (
    <div className="panel card" style={{width:'100%'}}>
      <div><b>Assign stats for {player}</b> — cost = d × number_of_directions. Remaining credits: <b>{state.credits[player]}</b>. This commit will cost <b>{cost}</b>.</div>
      <table className="table">
        <thead><tr><th>Stone</th><th>Pos</th><th>Distance</th><th>Directions</th></tr></thead>
        <tbody>
          {stones.map(s=>{
            const v = vals[s.id];
            return (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>({s.r},{s.c})</td>
                <td>
                  <select className="input" value={v.d} onChange={e=>setD(s.id, parseInt(e.target.value) as any)}>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                </td>
                <td>
                  <label><input type="checkbox" checked={!!(v.dirs & DIR.R)} onChange={()=>toggleDir(s.id, DIR.R)}/> →</label>{' '}
                  <label><input type="checkbox" checked={!!(v.dirs & DIR.L)} onChange={()=>toggleDir(s.id, DIR.L)}/> ←</label>{' '}
                  <label><input type="checkbox" checked={!!(v.dirs & DIR.U)} onChange={()=>toggleDir(s.id, DIR.U)}/> ↑</label>{' '}
                  <label><input type="checkbox" checked={!!(v.dirs & DIR.D)} onChange={()=>toggleDir(s.id, DIR.D)}/> ↓</label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="row gap" style={{justifyContent:'flex-end'}}>
        <button className="btn" onClick={()=>onCommit(cost)} disabled={cost>state.credits[player]}>Commit ({cost})</button>
      </div>
    </div>
  );
}
