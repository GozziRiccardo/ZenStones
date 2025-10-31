import * as React from 'react';
import type { Player } from '../game/types';

type Dist = 1|2|3|4|5;

type StoneIconProps = { d: Dist; color?: string; owner?: Player };

export function StoneIcon({ d, color='currentColor', owner }: StoneIconProps) {
  const size = 36, cx = 18, cy = 18, r = 12;

  const fill = owner === 'B'
    ? 'var(--slate-900)'
    : owner === 'W'
      ? 'var(--white)'
      : 'none';
  const stroke = owner
    ? owner === 'B'
      ? 'var(--rose-50)'
      : 'var(--slate-700)'
    : color;
  const strokeWidth = 2.5;

  const poly = (n: number, rr = r) =>
    Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = cx + rr * Math.cos(a);
      const y = cy + rr * Math.sin(a);
      return `${x},${y}`;
    }).join(' ');

  if (d === 1) {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36">
        <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
      </svg>
    );
  }
  if (d === 2) {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36">
        {(() => {
          const doubleR = r - 3;
          const offset = doubleR;
          return (
            <>
              <circle cx={cx - offset} cy={cy} r={doubleR} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
              <circle cx={cx + offset} cy={cy} r={doubleR} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
            </>
          );
        })()}
      </svg>
    );
  }
  if (d === 3) {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36">
        <polygon points={poly(3)} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
      </svg>
    );
  }
  if (d === 4) {
    return (
      <svg width={size} height={size} viewBox="0 0 36 36">
        <rect x={cx - r} y={cy - r} width={2*r} height={2*r} rx={3} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <polygon points={poly(5)} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
    </svg>
  );
}

export function DirArrows({ dirs, color='#facc15' }: { dirs:number; color?:string }){
  const style: React.CSSProperties = {
    position:'absolute',
    fontSize:14,
    color,
    textShadow: '0 0 2px rgba(15,23,42,0.65)'
  };
  return (
    <>
      {(dirs & 1) ? <span style={{...style, right:4}}>→</span> : null}
      {(dirs & 2) ? <span style={{...style, left:4}}>←</span> : null}
      {(dirs & 4) ? <span style={{...style, top:2}}>↑</span> : null}
      {(dirs & 8) ? <span style={{...style, bottom:2}}>↓</span> : null}
    </>
  );
}
