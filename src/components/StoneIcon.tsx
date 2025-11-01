import * as React from 'react';
import type { Player } from '../game/types';
import { DIR } from '../game/types';

type Dist = 1|2|3|4|5;

type StoneIconProps = { d: Dist; color?: string; owner?: Player };

export function StoneIcon({ d, color='currentColor', owner }: StoneIconProps) {
  const size = 42, cx = size / 2, cy = size / 2, r = 14;
  const viewBox = `0 0 ${size} ${size}`;

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
  const strokeWidth = 3;

  const poly = (n: number, rr = r) =>
    Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = cx + rr * Math.cos(a);
      const y = cy + rr * Math.sin(a);
      return `${x},${y}`;
    }).join(' ');

  if (d === 1) {
    return (
      <svg width={size} height={size} viewBox={viewBox}>
        <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
      </svg>
    );
  }
  if (d === 2) {
    return (
      <svg width={size} height={size} viewBox={viewBox}>
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
      <svg width={size} height={size} viewBox={viewBox}>
        <polygon points={poly(3)} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
      </svg>
    );
  }
  if (d === 4) {
    return (
      <svg width={size} height={size} viewBox={viewBox}>
        <rect x={cx - r} y={cy - r} width={2*r} height={2*r} rx={3} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox={viewBox}>
      <polygon points={poly(5)} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
    </svg>
  );
}

export function DirArrows({ dirs, color='#facc15', owner }: { dirs:number; color?:string; owner?: Player }){
  const arrowColor = owner === 'W' ? '#ef4444' : color ?? '#facc15';
  const base: React.CSSProperties = {
    position:'absolute',
    fontSize:16,
    fontWeight:700,
    color: arrowColor,
    textShadow: '0 0 5px rgba(15,23,42,0.85)'
  };
  const items: { bit: number; label: string; style: React.CSSProperties }[] = [
    { bit: DIR.R, label: '→', style: { right:4, top:'50%', transform:'translateY(-50%)' } },
    { bit: DIR.L, label: '←', style: { left:4, top:'50%', transform:'translateY(-50%)' } },
    { bit: DIR.U, label: '↑', style: { top:2, left:'50%', transform:'translateX(-50%)' } },
    { bit: DIR.D, label: '↓', style: { bottom:2, left:'50%', transform:'translateX(-50%)' } },
    { bit: DIR.UR, label: '↗', style: { top:4, right:6 } },
    { bit: DIR.UL, label: '↖', style: { top:4, left:6 } },
    { bit: DIR.DR, label: '↘', style: { bottom:4, right:6 } },
    { bit: DIR.DL, label: '↙', style: { bottom:4, left:6 } },
  ];
  return (
    <>
      {items.map(item =>
        dirs & item.bit ? (
          <span key={item.bit} style={{ ...base, ...item.style }}>{item.label}</span>
        ) : null
      )}
    </>
  );
}
