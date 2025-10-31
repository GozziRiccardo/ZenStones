import type { Labels } from './types';

export function makeLabels(rows=10, cols=10): Labels {
  const mid = Math.floor(rows/2);
  const whiteHalf:number[][] = Array.from({length: rows},()=>Array(cols).fill(0));
  const blackHalf:number[][] = Array.from({length: rows},()=>Array(cols).fill(0));

  const halfRows = mid;
  const total = halfRows * cols;
  const values = Array.from({ length: total }, (_, i) => i + 1);
  shuffle(values);

  for (let index = 0; index < total; index++) {
    const rowInHalf = Math.floor(index / cols);
    const col = index % cols;
    const value = values[index];

    const whiteRow = rows - 1 - rowInHalf;
    const blackRow = rowInHalf;

    whiteHalf[whiteRow][col] = value;
    blackHalf[blackRow][col] = value;
  }

  return { whiteHalf, blackHalf };
}

function shuffle(values: number[]): void {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
}

export function labelForOpponentHalf(r:number,c:number, owner:'W'|'B', labels:Labels): number {
  if (owner === 'W') {
    return labels.blackHalf[r][c] || 0;
  } else {
    return labels.whiteHalf[r][c] || 0;
  }
}

export function labelForPlayerHalf(r:number,c:number, player:'W'|'B', labels:Labels): number {
  if (player === 'W') {
    return labels.whiteHalf[r][c] || 0;
  }
  return labels.blackHalf[r][c] || 0;
}
