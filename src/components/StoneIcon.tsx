import * as React from 'react';
import type { Player } from '../game/types';
import { DIR } from '../game/types';

type Dist = 1|2|3|4|5;

type StoneIconProps = { d: Dist; color?: string; owner?: Player; persistent?: boolean };

export function StoneIcon({ d, color='currentColor', owner, persistent }: StoneIconProps) {
  const size = 100;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
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
  const highlightStroke = persistent
    ? owner === 'W'
      ? '#ef4444'
      : '#facc15'
    : null;
  const strokeWidth = 8;
  const highlightWidth = strokeWidth + 4;

  const poly = (n: number, rr = r) =>
    Array.from({ length: n }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = cx + rr * Math.cos(a);
      const y = cy + rr * Math.sin(a);
      return `${x},${y}`;
    }).join(' ');

  const renderHighlight = (node: React.ReactElement) => (
    <svg className="stone-icon" width={size} height={size} viewBox={viewBox}>
      {highlightStroke ? React.cloneElement(node, {
        fill: 'none',
        stroke: highlightStroke,
        strokeWidth: highlightWidth,
        strokeLinejoin: 'round',
        strokeLinecap: 'round',
      }) : null}
      {React.cloneElement(node, {
        fill,
        stroke,
        strokeWidth,
        strokeLinejoin: 'round',
        strokeLinecap: 'round',
      })}
    </svg>
  );

  if (d === 1) {
    const circle = <circle cx={cx} cy={cy} r={r} />;
    return renderHighlight(circle);
  }
  if (d === 2) {
    const doubleR = r * 0.5;
    const offset = doubleR;
    const group = (
      <g>
        <circle cx={cx - offset} cy={cy} r={doubleR} />
        <circle cx={cx + offset} cy={cy} r={doubleR} />
      </g>
    );
    return renderHighlight(group);
  }
  if (d === 3) {
    const triangle = <polygon points={poly(3)} />;
    return renderHighlight(triangle);
  }
  if (d === 4) {
    const rectSize = r * 1.6;
    const square = <rect x={cx - rectSize/2} y={cy - rectSize/2} width={rectSize} height={rectSize} rx={8} />;
    return renderHighlight(square);
  }
  const pentagon = <polygon points={poly(5)} />;
  return renderHighlight(pentagon);
}

export function DirArrows({ dirs, color='#facc15', owner }: { dirs:number; color?:string; owner?: Player }){
  const arrowColor = owner === 'W' ? '#ef4444' : color ?? '#facc15';
  const shadowColor = 'rgba(15,23,42,0.78)';
  const baseFontSize = 28;
  const diagonalFontSize = 24;
  const items: { bit: number; label: string; x: number; y: number; fontSize: number }[] = [
    { bit: DIR.R, label: '→', x: 74, y: 50, fontSize: baseFontSize },
    { bit: DIR.L, label: '←', x: 26, y: 50, fontSize: baseFontSize },
    { bit: DIR.U, label: '↑', x: 50, y: 26, fontSize: baseFontSize },
    { bit: DIR.D, label: '↓', x: 50, y: 74, fontSize: baseFontSize },
    { bit: DIR.UR, label: '↗', x: 72, y: 30, fontSize: diagonalFontSize },
    { bit: DIR.UL, label: '↖', x: 28, y: 30, fontSize: diagonalFontSize },
    { bit: DIR.DR, label: '↘', x: 72, y: 70, fontSize: diagonalFontSize },
    { bit: DIR.DL, label: '↙', x: 28, y: 70, fontSize: diagonalFontSize },
  ];
  return (
    <svg className="stone-arrows" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      {items.filter(item => dirs & item.bit).map(item => (
        <text
          key={item.bit}
          x={item.x}
          y={item.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={arrowColor}
          stroke={shadowColor}
          strokeWidth={3.5}
          paintOrder="stroke fill"
          fontSize={item.fontSize}
          fontWeight={700}
        >
          {item.label}
        </text>
      ))}
    </svg>
  );
}
