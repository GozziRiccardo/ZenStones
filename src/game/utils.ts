import type { GameState, Player, Stone, ScoreDetail } from './types';
import { DIR } from './types';
import { labelForOpponentHalf, labelForPlayerHalf } from './labels';

export function emptyBoard(rows=10, cols=10): (string|null)[][] {
  return Array.from({length: rows},()=>Array(cols).fill(null));
}

export function stoneAt(state:GameState, r:number, c:number): Stone | null {
  const id = state.board[r][c];
  return id ? state.stones[id] : null;
}

export function legalMoves(state:GameState, s:Stone): {r:number;c:number}[] {
  if (!s.d || !s.dirs) return [];
  const deltas: [number,number,number][] = [
    [0, 1, DIR.R],
    [0,-1, DIR.L],
    [-1,0, DIR.U],
    [1, 0, DIR.D],
  ];
  const out: {r:number;c:number}[] = [];
  for (const [dr, dc, bit] of deltas) {
    if (!(s.dirs & bit)) continue;
    let r = s.r, c = s.c;
    for (let step=1; step<=s.d; step++) {
      r += dr; c += dc;
      if (r<0 || c<0 || r>=state.board.length || c>=state.board[0].length) break;
      const occ = stoneAt(state, r, c);
      if (!occ) {
        out.push({r,c});
      } else {
        if (occ.owner !== s.owner) out.push({r,c});
        break;
      }
    }
  }
  return out;
}

export function recalcScores(state:GameState) {
  const details = computeScoreDetails(state);
  state.scores.W = details.W.total;
  state.scores.B = details.B.total;
  state.scoreDetails = details;
}

export function computeScoreDetails(state: GameState): Record<Player, ScoreDetail> {
  const baseW = state.credits.W;
  const baseB = state.credits.B;
  let bonusW = 0, bonusB = 0;
  for (const id in state.stones) {
    const s = state.stones[id];
    const label = labelForOpponentHalf(s.r, s.c, s.owner, state.labels);
    if (label>0) {
      const pts = label;
      if (s.owner === 'W') bonusW += pts; else bonusB += pts;
    }
  }
  return {
    W: { credits: baseW, position: bonusW, total: baseW + bonusW },
    B: { credits: baseB, position: bonusB, total: baseB + bonusB },
  };
}

export function squareCostForPlayer(state: GameState, player: Player, r: number, c: number): number {
  const base = labelForPlayerHalf(r, c, player, state.labels);
  if (base > 0) {
    return base;
  }
  const opponent = player === 'W' ? 'B' : 'W';
  const opponentLabel = labelForPlayerHalf(r, c, opponent, state.labels);
  if (opponentLabel > 0 && state.unlockedLabels[player]?.[opponentLabel]) {
    return opponentLabel;
  }
  return 0;
}

export function hasPlacementOption(state: GameState, player: Player): boolean {
  if (state.placementCounts[player] >= 10) return false;
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < state.board[r].length; c++) {
      if (state.board[r][c]) continue;
      const cost = squareCostForPlayer(state, player, r, c);
      if (cost > 0 && state.credits[player] >= cost) {
        return true;
      }
    }
  }
  return false;
}

let uid = 0;
export function newId(){ uid += 1; return 'S'+uid; }
export function resetIdCounter(){ uid = 0; }

export function restoreIdCounter(state: Pick<GameState, 'stones'>) {
  let max = 0;
  for (const id of Object.keys(state.stones)) {
    const numeric = Number(id.replace(/^S/, ''));
    if (!Number.isNaN(numeric)) {
      max = Math.max(max, numeric);
    }
  }
  uid = max;
}
