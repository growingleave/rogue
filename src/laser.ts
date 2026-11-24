export type Point = [number, number];

export interface Target {
  x: number;
  y: number;
  r: number;
}

const SEGMENTS = 40;

// 레이저 경로. 유도가 있으면 가장 가까운 적 쪽으로 구부러지고,
// 그 적에 닿으면 아직 닿지 않은 다음 적 쪽으로 다시 구부러진다.
export function laserPath(
  from: Point,
  angle: number,
  length: number,
  turnPerPx: number,
  targets: Target[],
): Point[] {
  const step = length / SEGMENTS;
  let [x, y] = from;
  let ang = angle;
  const reached = new Set<Target>();
  const pts: Point[] = [[x, y]];
  for (let i = 0; i < SEGMENTS; i++) {
    if (turnPerPx > 0) {
      for (const t of targets) if (Math.hypot(t.x - x, t.y - y) <= t.r) reached.add(t);
      const next = nearest(x, y, targets, reached);
      if (next) {
        const want = Math.atan2(next.y - y, next.x - x);
        const diff = Math.atan2(Math.sin(want - ang), Math.cos(want - ang));
        const max = turnPerPx * step;
        ang += Math.max(-max, Math.min(max, diff));
      }
    }
    x += Math.cos(ang) * step;
    y += Math.sin(ang) * step;
    pts.push([x, y]);
  }
  return pts;
}

function nearest(x: number, y: number, targets: Target[], skip: Set<Target>): Target | null {
  let best: Target | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    if (skip.has(t)) continue;
    const d = Math.hypot(t.x - x, t.y - y);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

export function distToPath(px: number, py: number, pts: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t)));
  }
  return best;
}
