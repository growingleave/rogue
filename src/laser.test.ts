import { describe, expect, it } from 'vitest';
import { distToPath, forkPaths, laserPath } from './laser';

const TURN = 5 / 420;

describe('laserPath', () => {
  it('goes straight without homing', () => {
    const pts = laserPath([0, 0], 0, 320, 0, [{ x: 100, y: 200, r: 20 }]);
    const [x, y] = pts[pts.length - 1];
    expect(x).toBeCloseTo(320);
    expect(y).toBeCloseTo(0);
  });

  it('bends toward a target off to the side when homing', () => {
    const target = { x: 200, y: 150, r: 20 };
    const straight = laserPath([0, 0], 0, 400, 0, [target]);
    const bent = laserPath([0, 0], 0, 400, TURN, [target]);
    expect(distToPath(target.x, target.y, straight)).toBeGreaterThan(100);
    expect(distToPath(target.x, target.y, bent)).toBeLessThanOrEqual(target.r);
  });

  it('curves on to the next target after reaching one', () => {
    const first = { x: 150, y: 0, r: 20 };
    const second = { x: 250, y: 150, r: 20 };
    const straight = laserPath([0, 0], 0, 450, 0, [first, second]);
    const bent = laserPath([0, 0], 0, 450, TURN, [first, second]);
    expect(distToPath(second.x, second.y, straight)).toBeGreaterThan(100);
    expect(distToPath(first.x, first.y, bent)).toBeLessThanOrEqual(first.r);
    expect(distToPath(second.x, second.y, bent)).toBeLessThanOrEqual(second.r);
  });

  it('keeps its length', () => {
    const pts = laserPath([0, 0], 0, 400, TURN, [{ x: 50, y: 300, r: 20 }]);
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    expect(total).toBeCloseTo(400);
  });
});

describe('forkPaths', () => {
  it('splits into branches at the first target the beam touches', () => {
    const first = { x: 150, y: 0, r: 20, id: 1 };
    const far = { x: 400, y: 0, r: 20, id: 2 };
    const main = laserPath([0, 0], 0, 500, 0, [first, far]);
    const fork = forkPaths(main, [far, first], 6, 3, 200, 0)!;
    expect(fork.target.id).toBe(1);
    expect(fork.branches).toHaveLength(3);
    for (const b of fork.branches) expect(b[0]).toEqual([150, 0]);
  });

  it('fans the branches out around the beam direction', () => {
    const t = { x: 150, y: 0, r: 20 };
    const main = laserPath([0, 0], 0, 500, 0, [t]);
    const ends = forkPaths(main, [t], 6, 3, 200, 0)!.branches.map((b) => b[b.length - 1]);
    expect(ends[0][1]).toBeLessThan(-50);
    expect(ends[1][1]).toBeCloseTo(0);
    expect(ends[2][1]).toBeGreaterThan(50);
  });

  it('does not fork without split or without touching a target', () => {
    const t = { x: 150, y: 300, r: 20 };
    const main = laserPath([0, 0], 0, 500, 0, [t]);
    expect(forkPaths(main, [t], 6, 3, 200, 0)).toBeNull();
    expect(forkPaths(main, [{ x: 150, y: 0, r: 20 }], 6, 0, 200, 0)).toBeNull();
  });

  it('lets homing branches bend toward other targets but not the forked one', () => {
    const first = { x: 150, y: 0, r: 20 };
    const side = { x: 300, y: 120, r: 20 };
    const main = laserPath([0, 0], 0, 500, 0, [first, side]);
    const fork = forkPaths(main, [first, side], 6, 1, 300, 5 / 420)!;
    expect(distToPath(side.x, side.y, fork.branches[0])).toBeLessThanOrEqual(side.r);
  });
});

describe('distToPath', () => {
  it('measures the distance to the nearest segment', () => {
    const pts: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 100],
    ];
    expect(distToPath(50, 10, pts)).toBeCloseTo(10);
    expect(distToPath(130, 50, pts)).toBeCloseTo(30);
  });
});
