import type { Labels } from './types';

export function makeLabels(rows=10, cols=10): Labels {
  const mid = Math.floor(rows/2); // split horizontally
  const whiteHalf:number[][] = Array.from({length: rows},()=>Array(cols).fill(0));
  const blackHalf:number[][] = Array.from({length: rows},()=>Array(cols).fill(0));

  // White half labeling (bottom rows), 1..50 from bottom-left, row-major upward
  let w = 1;
  for (let r = rows-1; r >= mid; r--) {
    for (let c = 0; c < cols; c++) {
      whiteHalf[r][c] = w++;
    }
  }
  // Black half labeling (top rows), 1..50 from top-left, row-major downward
  let b = 1;
  for (let r = 0; r < mid; r++) {
    for (let c = 0; c < cols; c++) {
      blackHalf[r][c] = b++;
    }
  }
  return { whiteHalf, blackHalf };
}

export function labelForOpponentHalf(r:number,c:number, owner:'W'|'B', labels:Labels): number {
  if (owner === 'W') {
    return labels.blackHalf[r][c] || 0;
  } else {
    return labels.whiteHalf[r][c] || 0;
  }
}
