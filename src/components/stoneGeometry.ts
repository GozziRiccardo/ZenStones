import { Dist } from '../game/types';

export const STONE_SIZE = 100;
export const STONE_CENTER = STONE_SIZE / 2;
export const STONE_STROKE_WIDTH = 8;
export const STONE_HIGHLIGHT_WIDTH = STONE_STROKE_WIDTH + 4;
export const STONE_PADDING = 0.5;
export const STONE_OUTER_RADIUS = STONE_CENTER - STONE_PADDING - STONE_HIGHLIGHT_WIDTH / 2;

export type CircleOutline = { type: 'circle'; radius: number };
export type RectOutline = { type: 'rect'; halfWidth: number; halfHeight: number; cornerRadius: number };
export type PolygonOutline = { type: 'polygon'; points: [number, number][] };

export type StoneOutline = CircleOutline | RectOutline | PolygonOutline;

export function regularPolygonPoints(sides: number, radius: number): [number, number][] {
  const angleOffset = -Math.PI / 2;
  return Array.from({ length: sides }, (_, i) => {
    const angle = angleOffset + (i * 2 * Math.PI) / sides;
    const x = STONE_CENTER + radius * Math.cos(angle);
    const y = STONE_CENTER + radius * Math.sin(angle);
    return [x, y];
  });
}

export function getStoneOutline(d: Dist): StoneOutline {
  if (d === 1 || d === 2) {
    return { type: 'circle', radius: STONE_OUTER_RADIUS };
  }
  if (d === 3) {
    return { type: 'polygon', points: regularPolygonPoints(3, STONE_OUTER_RADIUS) };
  }
  if (d === 4) {
    return {
      type: 'rect',
      halfWidth: STONE_OUTER_RADIUS,
      halfHeight: STONE_OUTER_RADIUS,
      cornerRadius: 8,
    };
  }
  return { type: 'polygon', points: regularPolygonPoints(5, STONE_OUTER_RADIUS) };
}

export function getRayIntersectionDistance(outline: StoneOutline, dirX: number, dirY: number): number {
  const magnitude = Math.hypot(dirX, dirY) || 1;
  const nx = dirX / magnitude;
  const ny = dirY / magnitude;

  if (outline.type === 'circle') {
    return outline.radius;
  }

  if (outline.type === 'rect') {
    const { halfWidth, halfHeight } = outline;
    const tx = Math.abs(nx) < 1e-6 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(nx);
    const ty = Math.abs(ny) < 1e-6 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(ny);
    return Math.min(tx, ty);
  }

  let minT = Number.POSITIVE_INFINITY;
  const points = outline.points;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const edgeX = x2 - x1;
    const edgeY = y2 - y1;
    const det = edgeX * ny - nx * edgeY;
    if (Math.abs(det) < 1e-6) continue;
    const t = (edgeX * (y1 - STONE_CENTER) - edgeY * (x1 - STONE_CENTER)) / det;
    const u = (nx * (y1 - STONE_CENTER) - ny * (x1 - STONE_CENTER)) / det;
    if (t >= 0 && u >= -1e-6 && u <= 1 + 1e-6) {
      minT = Math.min(minT, t);
    }
  }

  return Number.isFinite(minT) ? minT : STONE_OUTER_RADIUS;
}
