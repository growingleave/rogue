import { describe, expect, it } from 'vitest';
import { BASE_ATTACK, Board, activate, intervalOf } from './board';
import { PART_BY_ID, statLines } from './parts';
import { PLAYER_SPEED } from './tuning';

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

  it('is limited by the capacity of its input', () => {
    const b = new Board(2, 8);
    b.set(0, 0, 'in-timer');
    b.set(1, 0, 'in-damage');
    const row = (r: number, n: number) => Array.from({ length: n }, (_, i) => at(r, i + 1));
    expect(b.capacity(at(0, 0))).toBe(4);
    expect(b.setWire(at(0, 0), row(0, 4))).toBe(true);
    expect(b.setWire(at(0, 0), row(0, 5))).toBe(false);
    expect(b.capacity(at(1, 0))).toBe(6);
    expect(b.setWire(at(1, 0), row(1, 6))).toBe(true);
  });

  it('counts heavy parts by their weight', () => {
    const b = new Board(1, 6);
    b.set(0, 0, 'in-timer');
    b.set(0, 1, 'laser');
    b.set(0, 2, 'split');
    expect(b.cost([at(0, 1), at(0, 2)])).toBe(4);
    expect(b.setWire(at(0, 0), [at(0, 1), at(0, 2)])).toBe(true);
    expect(b.setWire(at(0, 0), [at(0, 1), at(0, 2), at(0, 3)])).toBe(false);
  });

  it('cuts a wire where a heavy part makes it overflow', () => {
    const b = new Board(1, 6);
    b.set(0, 0, 'in-timer');
    b.setWire(at(0, 0), [at(0, 1), at(0, 2), at(0, 3), at(0, 4)]);
    b.set(0, 2, 'laser');
    expect(b.wire(at(0, 0))).toEqual([at(0, 1), at(0, 2), at(0, 3)]);
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

describe('move', () => {
  it('moves a part to an empty cell and keeps wires passing through', () => {
    const b = new Board();
    b.set(0, 0, 'in-timer');
    b.set(0, 1, 'sniper');
    b.setWire(at(0, 0), [at(0, 1), at(0, 2)]);
    expect(b.move(at(0, 1), at(2, 2))).toBe(true);
    expect(b.get(0, 1)).toBeNull();
    expect(b.get(2, 2)?.id).toBe('sniper');
    expect(b.wire(at(0, 0))).toEqual([at(0, 1), at(0, 2)]);
  });

  it('refuses occupied targets and empty sources', () => {
    const b = new Board();
    b.set(0, 0, 'sniper');
    b.set(0, 1, 'shotgun');
    expect(b.move(at(0, 0), at(0, 1))).toBe(false);
    expect(b.move(at(3, 3), at(2, 2))).toBe(false);
  });

  it('resets the wire of a moved input', () => {
    const b = new Board();
    b.set(0, 0, 'in-timer');
    b.setWire(at(0, 0), [at(0, 1)]);
    b.move(at(0, 0), at(3, 3));
    expect(b.wire(at(3, 3))).toEqual([]);
    expect(b.wireOwner(at(0, 1))).toBeNull();
  });
});

describe('statLines', () => {
  it('shows base damage and cooldown for inputs, and the move distance', () => {
    const lines = statLines(PART_BY_ID.get('in-move')!);
    expect(lines).toContain('기본 피해 8');
    expect(lines).toContain('쿨타임 0.5초');
    expect(lines.join(' ')).toContain(`${0.5 * PLAYER_SPEED}px`);
  });

  it('expresses count-based inputs as cooldown times a factor', () => {
    expect(statLines(PART_BY_ID.get('in-hits')!)).toContain('쿨타임 1초 × 10 = 적중 10번마다 발동');
    expect(statLines(PART_BY_ID.get('in-damage')!)).toContain('쿨타임 1초 × 100 = 피해 100마다 발동');
    expect(statLines(PART_BY_ID.get('laser')!)).toContain('무게 2: 와이어 2칸을 차지');
  });

  it('lists every modifier of an effect', () => {
    expect(statLines(PART_BY_ID.get('sniper')!)).toEqual(['피해 ×2.2', '탄속·레이저 길이 ×1.6', '쿨타임 ×1.5']);
  });
});

describe('activate', () => {
  it('fires a plain projectile with the input base damage when the wire has no effects', () => {
    const b = new Board();
    b.set(0, 0, 'in-timer');
    b.set(2, 0, 'in-move');
    b.setWire(at(0, 0), [at(0, 1)]);
    expect(activate(b, at(0, 0))!.attack).toEqual({ ...BASE_ATTACK, damage: 10 });
    expect(activate(b, at(2, 0))!.attack.damage).toBe(8);
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

  it('gives move inputs a cooldown in seconds like timers', () => {
    const b = new Board();
    b.set(0, 0, 'in-move');
    expect(intervalOf(b, at(0, 0))).toBe(0.5);
  });

  it('is infinite for parts that are not inputs', () => {
    const b = new Board();
    b.set(0, 0, 'sniper');
    expect(intervalOf(b, at(0, 0))).toBe(Infinity);
  });
});
