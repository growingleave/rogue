export type Point = [number, number];

export interface Target {
  x: number;
  y: number;
  r: number;
  id?: number;
}

export interface Fork {
  target: Target;
  branches: Point[][];
}

const BRANCH_SPREAD = 0.6;

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

// 분열이 붙은 레이저는 처음 닿은 적에서 앞쪽으로 여러 갈래로 갈라진다.
// 갈래는 그 적을 다시 노리지 않는다.
export function forkPaths(
  main: Point[],
  targets: Target[],
  width: number,
  count: number,
  length: number,
  turnPerPx: number,
): Fork | null {
  if (count <= 0) return null;
  for (let i = 1; i < main.length; i++) {
    const hit = targets.find((t) => distToSegment(t.x, t.y, main[i - 1], main[i]) <= t.r + width);
    if (!hit) continue;
    const dir = Math.atan2(main[i][1] - main[i - 1][1], main[i][0] - main[i - 1][0]);
    const others = targets.filter((t) => t !== hit);
    const from: Point = [hit.x, hit.y];
    const branches = Array.from({ length: count }, (_, k) =>
      laserPath(from, dir + (k - (count - 1) / 2) * BRANCH_SPREAD, length, turnPerPx, others),
    );
    return { target: hit, branches };
  }
  return null;
}

function distToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len2));
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
}

export function distToPath(px: number, py: number, pts: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) best = Math.min(best, distToSegment(px, py, pts[i - 1], pts[i]));
  return best;
}
