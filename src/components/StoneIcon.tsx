import * as React from 'react';
import type { Player, Dist } from '../game/types';
import { DIR } from '../game/types';
import {
  STONE_CENTER,
  STONE_HIGHLIGHT_WIDTH,
  STONE_OUTER_RADIUS,
  STONE_SIZE,
  STONE_STROKE_WIDTH,
  getRayIntersectionDistance,
  getStoneOutline,
} from './stoneGeometry';

type StoneIconProps = { d: Dist; color?: string; owner?: Player; persistent?: boolean };

export function StoneIcon({ d, color='currentColor', owner, persistent }: StoneIconProps) {
  const size = STONE_SIZE;
  const cx = STONE_CENTER;
  const cy = STONE_CENTER;
  const viewBox = `0 0 ${size} ${size}`;

  const fill = owner === 'B'
    ? 'var(--slate-900)'
    : owner === 'W'
      ? 'var(--white)'
      : 'none';
  const stroke = owner
    ? owner === 'B'
      ? persistent ? '#facc15' : 'var(--rose-50)'
      : persistent ? '#ef4444' : 'var(--slate-700)'
    : color;
  const highlightStroke = persistent
    ? owner === 'W'
      ? '#ef4444'
      : '#facc15'
    : null;
  const strokeWidth = STONE_STROKE_WIDTH;
  const highlightWidth = STONE_HIGHLIGHT_WIDTH;

  const outline = getStoneOutline(d);

  const polygonPoints = (points: [number, number][]) => points.map(([x, y]) => `${x},${y}`).join(' ');

const renderHighlight = (node: React.ReactElement, overlay?: React.ReactNode) => (
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
    {overlay}
  </svg>
);

  if (d === 1) {
    const circle = <circle cx={cx} cy={cy} r={STONE_OUTER_RADIUS} />;
    return renderHighlight(circle);
  }
  if (d === 2) {
    const circle = <circle cx={cx} cy={cy} r={STONE_OUTER_RADIUS} />;
    const innerRadius = STONE_OUTER_RADIUS * 0.28;
    const innerFill = owner === 'B'
      ? (persistent ? '#facc15' : 'var(--white)')
      : owner === 'W'
        ? (persistent ? '#ef4444' : 'var(--slate-900)')
        : color;
    const overlay = (
      <circle
        cx={cx}
        cy={cy}
        r={innerRadius}
        fill={innerFill}
        stroke={owner ? 'rgba(15,23,42,0.08)' : 'none'}
        strokeWidth={owner ? 2 : 0}
      />
    );
    return renderHighlight(circle, overlay);
  }
  if (outline.type === 'rect') {
    const width = outline.halfWidth * 2;
    const height = outline.halfHeight * 2;
    const square = (
      <rect
        x={cx - outline.halfWidth}
        y={cy - outline.halfHeight}
        width={width}
        height={height}
        rx={outline.cornerRadius}
      />
    );
    return renderHighlight(square);
  }
  if (outline.type === 'polygon') {
    const polygon = <polygon points={polygonPoints(outline.points)} />;
    return renderHighlight(polygon);
  }

  const circle = <circle cx={cx} cy={cy} r={STONE_OUTER_RADIUS} />;
  return renderHighlight(circle);
}

export function DirArrows({ d, dirs, color='#facc15', owner }: { d: Dist; dirs:number; color?:string; owner?: Player }){
  const arrowColor = owner === 'W' ? '#ef4444' : color ?? '#facc15';
  const shadowColor = 'rgba(15,23,42,0.78)';
  const cx = STONE_CENTER;
  const cy = STONE_CENTER;
  const startOffset = 8;
  const baseHeadLength = 10;
  const minHeadLength = 6;
  const headWidthBase = 12;
  const headWidthMin = 6;
  const arrowClearance = 0.5;
  const strokeWidth = 6;
  const shadowStrokeWidth = strokeWidth + 3;
  const outline = getStoneOutline(d);
  const arrowDefs: { bit: number; vx: number; vy: number }[] = [
    { bit: DIR.R, vx: 1, vy: 0 },
    { bit: DIR.L, vx: -1, vy: 0 },
    { bit: DIR.U, vx: 0, vy: -1 },
    { bit: DIR.D, vx: 0, vy: 1 },
    { bit: DIR.UR, vx: 1, vy: -1 },
    { bit: DIR.UL, vx: -1, vy: -1 },
    { bit: DIR.DR, vx: 1, vy: 1 },
    { bit: DIR.DL, vx: -1, vy: 1 },
  ];

  const makeArrow = ({ vx, vy }: { vx: number; vy: number }) => {
    const mag = Math.hypot(vx, vy) || 1;
    const dirX = vx / mag;
    const dirY = vy / mag;
    const maxDistance = getRayIntersectionDistance(outline, dirX, dirY);
    const tipDistance = Math.max(startOffset, maxDistance - arrowClearance);
    const available = Math.max(0, tipDistance - startOffset);
    const targetHead = Math.min(baseHeadLength, Math.max(minHeadLength, available * 0.45));
    const headLength = Math.min(available, targetHead);
    const shaftLength = Math.max(0, available - headLength);
    const headWidth = Math.min(headWidthBase, Math.max(headWidthMin, headLength * 1.2));
    const startX = cx + dirX * startOffset;
    const startY = cy + dirY * startOffset;
    const baseX = cx + dirX * (startOffset + shaftLength);
    const baseY = cy + dirY * (startOffset + shaftLength);
    const tipX = cx + dirX * tipDistance;
    const tipY = cy + dirY * tipDistance;
    const perpX = -dirY;
    const perpY = dirX;
    const leftX = baseX + perpX * (headWidth / 2);
    const leftY = baseY + perpY * (headWidth / 2);
    const rightX = baseX - perpX * (headWidth / 2);
    const rightY = baseY - perpY * (headWidth / 2);
    return {
      startX,
      startY,
      baseX,
      baseY,
      tipX,
      tipY,
      leftX,
      leftY,
      rightX,
      rightY,
    };
  };

  return (
    <svg className="stone-arrows" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      {arrowDefs.filter(def => dirs & def.bit).map(def => {
        const { startX, startY, baseX, baseY, tipX, tipY, leftX, leftY, rightX, rightY } = makeArrow(def);
        const headPoints = `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`;
        return (
          <g key={def.bit}>
            <line
              x1={startX}
              y1={startY}
              x2={baseX}
              y2={baseY}
              stroke={shadowColor}
              strokeWidth={shadowStrokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.6}
            />
            <polygon points={headPoints} fill={shadowColor} opacity={0.6} />
            <line
              x1={startX}
              y1={startY}
              x2={baseX}
              y2={baseY}
              stroke={arrowColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polygon points={headPoints} fill={arrowColor} />
          </g>
        );
      })}
    </svg>
  );
}
