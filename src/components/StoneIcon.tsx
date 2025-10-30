import * as React from 'react';

type Dist = 1|2|3|4|5;

export function StoneIcon({ d, color='currentColor' }: { d: Dist; color?: string }) {
  const size = 28, cx = 14, cy = 14, r = 9;

  const poly = (n: number, rr = r) =>
    Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = cx + rr * Math.cos(a);
      const y = cy + rr * Math.sin(a);
      return `${x},${y}`;
    }).join(' ');

  if (d === 1) {
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={2}/>
      </svg>
    );
  }
  if (d === 2) {
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={2}/>
        <circle cx={cx} cy={cy} r={r-3} fill="none" stroke={color} strokeWidth={2}/>
      </svg>
    );
  }
  if (d === 3) {
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <polygon points={poly(3)} fill="none" stroke={color} strokeWidth={2}/>
      </svg>
    );
  }
  if (d === 4) {
    return (
      <svg width={size} height={size} viewBox="0 0 28 28">
        <rect x={cx - r} y={cy - r} width={2*r} height={2*r} rx={2} fill="none" stroke={color} strokeWidth={2}/>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 28 28">
      <polygon points={poly(5)} fill="none" stroke={color} strokeWidth={2}/>
    </svg>
  );
}

export function DirArrows({ dirs, color='currentColor' }: { dirs:number; color?:string }){
  const style: React.CSSProperties = { position:'absolute', fontSize:12, color };
  return (
    <>
      {(dirs & 1) ? <span style={{...style, right:4}}>→</span> : null}
      {(dirs & 2) ? <span style={{...style, left:4}}>←</span> : null}
      {(dirs & 4) ? <span style={{...style, top:2}}>↑</span> : null}
      {(dirs & 8) ? <span style={{...style, bottom:2}}>↓</span> : null}
    </>
  );
}
