import { describe, expect, it } from 'vitest';
import { BASE_ATTACK, Board, CHAIN_LIMITS, activate, arrowCells, cooldownOf } from './board';

describe('arrowCells', () => {
  it('walks straight to the board edge in arrow order', () => {
    expect(arrowCells('right', { r: 1, c: 1 }, 4, 4)).toEqual([
      { r: 1, c: 2 },
      { r: 1, c: 3 },
    ]);
    expect(arrowCells('up', { r: 2, c: 0 }, 4, 4)).toEqual([
      { r: 1, c: 0 },
      { r: 0, c: 0 },
    ]);
    expect(arrowCells('left', { r: 0, c: 0 }, 4, 4)).toEqual([]);
  });

  it('goes clockwise from the top and drops cells off the board', () => {
    expect(arrowCells('cw', { r: 0, c: 0 }, 4, 4)).toEqual([
      { r: 0, c: 1 },
      { r: 1, c: 1 },
      { r: 1, c: 0 },
    ]);
    expect(arrowCells('cw', { r: 1, c: 1 }, 4, 4)).toHaveLength(8);
  });
});

describe('activate', () => {
  it('fires a plain projectile when the arrow range is empty', () => {
    const b = new Board();
    b.set(0, 0, 'out-right');
    const [a] = activate(b, { r: 0, c: 0 });
    expect(a.attack).toEqual(BASE_ATTACK);
  });

  it('combines every effect in the arrow range', () => {
    const b = new Board();
    b.set(0, 0, 'out-right');
    b.set(0, 1, 'shotgun');
    b.set(0, 3, 'explode');
    b.set(1, 1, 'sniper');
    const acts = activate(b, { r: 0, c: 0 });
    expect(acts).toHaveLength(1);
    expect(acts[0].cells).toEqual([
      { r: 0, c: 1 },
      { r: 0, c: 3 },
    ]);
    expect(acts[0].attack.count).toBe(3);
    expect(acts[0].attack.damage).toBeCloseTo(6);
    expect(acts[0].attack.explodeRadius).toBe(55);
  });

  it('adds boost damage once per adjacent boost part', () => {
    const b = new Board();
    b.set(1, 0, 'out-right');
    b.set(1, 1, 'sniper');
    b.set(0, 1, 'boost');
    b.set(2, 0, 'boost');
    const [a] = activate(b, { r: 1, c: 0 });
    expect(a.attack.damage).toBeCloseTo(10 * 2.2 * 1.6);
  });

  it('relays start a second attack along their own arrow', () => {
    const b = new Board();
    b.set(0, 0, 'out-down');
    b.set(1, 0, 'relay-right');
    b.set(1, 1, 'shotgun');
    const acts = activate(b, { r: 0, c: 0 });
    expect(acts).toHaveLength(2);
    expect(acts[0].attack.count).toBe(1);
    expect(acts[1].source).toEqual({ r: 1, c: 0 });
    expect(acts[1].attack.count).toBe(3);
    expect(acts[1].depth).toBe(1);
  });

  it('terminates a relay loop within the chain caps', () => {
    const b = new Board(3, 3);
    b.set(0, 0, 'relay-right');
    b.set(0, 1, 'relay-down');
    b.set(1, 1, 'relay-left');
    b.set(1, 0, 'relay-up');
    b.set(2, 0, 'out-up');
    const acts = activate(b, { r: 2, c: 0 });
    expect(acts.length).toBeGreaterThan(4);
    expect(acts.length).toBeLessThanOrEqual(1 + 4 * CHAIN_LIMITS.maxSamePart);
    expect(acts.every((a) => a.depth <= CHAIN_LIMITS.maxDepth)).toBe(true);
    for (const r of [0, 1]) {
      for (const c of [0, 1]) {
        const uses = acts.filter((a) => a.source.r === r && a.source.c === c).length;
        expect(uses).toBeLessThanOrEqual(CHAIN_LIMITS.maxSamePart);
      }
    }
  });

  it('never lets one effect join more attacks than the cap within a chain', () => {
    const b = new Board(3, 3);
    b.set(0, 0, 'relay-right');
    b.set(0, 1, 'relay-down');
    b.set(1, 1, 'relay-left');
    b.set(1, 0, 'relay-up');
    b.set(2, 0, 'out-up');
    b.set(0, 2, 'split');
    const acts = activate(b, { r: 2, c: 0 });
    const splitUses = acts.flatMap((a) => a.cells).filter((p) => p.r === 0 && p.c === 2).length;
    expect(splitUses).toBe(CHAIN_LIMITS.maxSamePart);
  });
});

describe('cooldownOf', () => {
  it('multiplies the base interval by effects in range', () => {
    const b = new Board();
    b.set(0, 0, 'out-right');
    b.set(0, 1, 'rapid');
    b.set(0, 2, 'sniper');
    expect(cooldownOf(b, { r: 0, c: 0 })).toBeCloseTo(0.55 * 1.5);
  });

  it('is infinite for parts that are not outputs', () => {
    const b = new Board();
    b.set(0, 0, 'sniper');
    expect(cooldownOf(b, { r: 0, c: 0 })).toBe(Infinity);
  });
});
