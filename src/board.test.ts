import { describe, expect, it } from 'vitest';
import { BASE_ATTACK, Board, MAX_WIRE, activate, intervalOf } from './board';

const at = (r: number, c: number) => ({ r, c });

describe('wires', () => {
  it('connects only orthogonally adjacent cells, starting next to the input', () => {
    const b = new Board();
    b.set(1, 0, 'in-timer');
    expect(b.setWire(at(1, 0), [at(1, 1), at(2, 1)])).toBe(true);
    expect(b.setWire(at(1, 0), [at(2, 1)])).toBe(false);
    expect(b.setWire(at(1, 0), [at(1, 1), at(2, 2)])).toBe(false);
  });

  it('may pass through empty cells but never revisit a cell or its own input', () => {
    const b = new Board();
    b.set(1, 1, 'in-timer');
    expect(b.setWire(at(1, 1), [at(1, 2), at(1, 3)])).toBe(true);
    expect(b.setWire(at(1, 1), [at(1, 2), at(1, 1)])).toBe(false);
    expect(b.setWire(at(1, 1), [at(1, 2), at(2, 2), at(2, 1), at(2, 2)])).toBe(false);
  });

  it('cannot share cells with another wire or cross another input', () => {
    const b = new Board();
    b.set(0, 0, 'in-timer');
    b.set(2, 0, 'in-move');
    expect(b.setWire(at(0, 0), [at(0, 1), at(1, 1)])).toBe(true);
    expect(b.setWire(at(2, 0), [at(2, 1), at(1, 1)])).toBe(false);
    expect(b.setWire(at(2, 0), [at(1, 0), at(0, 0)])).toBe(false);
    expect(b.setWire(at(2, 0), [at(2, 1), at(2, 2)])).toBe(true);
  });

  it('is limited to the max length', () => {
    const b = new Board(1, MAX_WIRE + 2);
    b.set(0, 0, 'in-timer');
    const path = Array.from({ length: MAX_WIRE + 1 }, (_, i) => at(0, i + 1));
    expect(b.setWire(at(0, 0), path.slice(0, MAX_WIRE))).toBe(true);
    expect(b.setWire(at(0, 0), path)).toBe(false);
  });

  it('drops the wire when its input is removed or replaced', () => {
    const b = new Board();
    b.set(0, 0, 'in-timer');
    b.setWire(at(0, 0), [at(0, 1)]);
    b.set(0, 0, 'sniper');
    expect(b.wire(at(0, 0))).toEqual([]);
    expect(b.wireOwner(at(0, 1))).toBeNull();
  });

  it('cuts another wire where a new input is placed on it', () => {
    const b = new Board();
    b.set(0, 0, 'in-timer');
    b.setWire(at(0, 0), [at(0, 1), at(0, 2), at(0, 3)]);
    b.set(0, 2, 'in-move');
    expect(b.wire(at(0, 0))).toEqual([at(0, 1)]);
  });
});

describe('activate', () => {
  it('fires a plain projectile when the wire has no effects', () => {
    const b = new Board();
    b.set(0, 0, 'in-timer');
    b.setWire(at(0, 0), [at(0, 1)]);
    expect(activate(b, at(0, 0))!.attack).toEqual(BASE_ATTACK);
  });

  it('combines effects along the wire and ignores parts off the wire', () => {
    const b = new Board();
    b.set(0, 0, 'in-timer');
    b.set(0, 1, 'shotgun');
    b.set(1, 1, 'pierce');
    b.set(2, 1, 'laser');
    b.set(0, 2, 'explode');
    b.setWire(at(0, 0), [at(0, 1), at(1, 1), at(2, 1)]);
    const a = activate(b, at(0, 0))!;
    expect(a.cells).toEqual([at(0, 0), at(0, 1), at(1, 1), at(2, 1)]);
    expect(a.attack.count).toBe(3);
    expect(a.attack.pierce).toBe(2);
    expect(a.attack.laser).toBe(true);
    expect(a.attack.explodeRadius).toBe(0);
    expect(a.attack.damage).toBeCloseTo(10 * 0.6 * 0.8);
  });

  it('adds boost damage once per boost next to the input or a wired effect', () => {
    const b = new Board();
    b.set(1, 0, 'in-timer');
    b.set(1, 1, 'sniper');
    b.set(0, 1, 'boost');
    b.set(2, 0, 'boost');
    b.set(3, 3, 'boost');
    b.setWire(at(1, 0), [at(1, 1)]);
    expect(activate(b, at(1, 0))!.attack.damage).toBeCloseTo(10 * 2.2 * 1.6);
  });
});

describe('intervalOf', () => {
  it('scales the timer by wired effects and adjacent accel parts', () => {
    const b = new Board();
    b.set(0, 0, 'in-timer');
    b.set(0, 1, 'rapid');
    b.set(1, 0, 'accel');
    b.set(1, 1, 'sniper');
    b.setWire(at(0, 0), [at(0, 1)]);
    expect(intervalOf(b, at(0, 0))).toBeCloseTo(0.55 * 0.75);
  });

  it('uses distance for move inputs', () => {
    const b = new Board();
    b.set(0, 0, 'in-move');
    expect(intervalOf(b, at(0, 0))).toBe(120);
  });

  it('is infinite for parts that are not inputs', () => {
    const b = new Board();
    b.set(0, 0, 'sniper');
    expect(intervalOf(b, at(0, 0))).toBe(Infinity);
  });
});
