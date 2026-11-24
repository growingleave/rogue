import { describe, expect, it } from 'vitest';
import { distToPath, laserPath } from './laser';

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
