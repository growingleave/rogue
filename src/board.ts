import { PART_BY_ID, type PartDef } from './parts';

export interface Cell {
  r: number;
  c: number;
}

export interface AttackSpec {
  damage: number;
  speed: number;
  count: number;
  size: number;
  lifetime: number;
  explodeRadius: number;
  splitCount: number;
  burnDps: number;
  pierce: number;
  homing: number;
  laser: boolean;
}

export interface Activation {
  cells: Cell[];
  attack: AttackSpec;
}

// 공격 형태 파츠가 없으면 기본 투사체를 쏜다. 수치는 임시값.
export const BASE_ATTACK: AttackSpec = {
  damage: 10,
  speed: 420,
  count: 1,
  size: 5,
  lifetime: 1.6,
  explodeRadius: 0,
  splitCount: 0,
  burnDps: 0,
  pierce: 0,
  homing: 0,
  laser: false,
};

// 와이어 최대 길이(입력 파츠 칸 제외). 임시값.
export const MAX_WIRE = 5;

const NEIGHBORS4: Cell[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
];

export const cellKey = (p: Cell) => `${p.r},${p.c}`;
const sameCell = (a: Cell, b: Cell) => a.r === b.r && a.c === b.c;
const adjacent = (a: Cell, b: Cell) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

export class Board {
  private cells: (string | null)[];
  private wires = new Map<string, Cell[]>();

  constructor(
    readonly rows = 4,
    readonly cols = 4,
  ) {
    this.cells = new Array<string | null>(rows * cols).fill(null);
  }

  inBounds(r: number, c: number): boolean {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  get(r: number, c: number): PartDef | null {
    if (!this.inBounds(r, c)) return null;
    const id = this.cells[r * this.cols + c];
    return id ? (PART_BY_ID.get(id) ?? null) : null;
  }

  set(r: number, c: number, id: string | null): void {
    if (!this.inBounds(r, c)) return;
    const here = { r, c };
    if (this.get(r, c)?.kind === 'input') this.wires.delete(cellKey(here));
    this.cells[r * this.cols + c] = id;
    if (id && PART_BY_ID.get(id)?.kind === 'input') {
      this.cutWiresAt(here);
      this.wires.set(cellKey(here), []);
    }
  }

  clear(): void {
    this.cells.fill(null);
    this.wires.clear();
  }

  entries(): { r: number; c: number; part: PartDef }[] {
    const out: { r: number; c: number; part: PartDef }[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const part = this.get(r, c);
        if (part) out.push({ r, c, part });
      }
    }
    return out;
  }

  inputs(): Cell[] {
    return this.entries()
      .filter((e) => e.part.kind === 'input')
      .map(({ r, c }) => ({ r, c }));
  }

  wire(input: Cell): Cell[] {
    return this.wires.get(cellKey(input)) ?? [];
  }

  // 이 칸을 쓰는 와이어의 입력 파츠 키. 입력 파츠 칸 자체도 그 와이어의 것으로 본다.
  wireOwner(cell: Cell): string | null {
    if (this.get(cell.r, cell.c)?.kind === 'input') return cellKey(cell);
    for (const [k, path] of this.wires) if (path.some((p) => sameCell(p, cell))) return k;
    return null;
  }

  canWire(input: Cell, path: Cell[]): boolean {
    if (this.get(input.r, input.c)?.kind !== 'input' || path.length > MAX_WIRE) return false;
    const me = cellKey(input);
    const seen = new Set<string>([me]);
    let prev = input;
    for (const p of path) {
      if (!this.inBounds(p.r, p.c) || !adjacent(prev, p) || seen.has(cellKey(p))) return false;
      const owner = this.wireOwner(p);
      if (owner !== null && owner !== me) return false;
      seen.add(cellKey(p));
      prev = p;
    }
    return true;
  }

  setWire(input: Cell, path: Cell[]): boolean {
    if (!this.canWire(input, path)) return false;
    this.wires.set(cellKey(input), path.map((p) => ({ ...p })));
    return true;
  }

  private cutWiresAt(cell: Cell): void {
    for (const [k, path] of this.wires) {
      const i = path.findIndex((p) => sameCell(p, cell));
      if (i >= 0) this.wires.set(k, path.slice(0, i));
    }
  }

  private adjacentParts(cells: Cell[]): PartDef[] {
    const seen = new Set<string>();
    const out: PartDef[] = [];
    for (const cell of cells) {
      for (const d of NEIGHBORS4) {
        const p = { r: cell.r + d.r, c: cell.c + d.c };
        const part = this.get(p.r, p.c);
        if (!part || seen.has(cellKey(p))) continue;
        seen.add(cellKey(p));
        out.push(part);
      }
    }
    return out;
  }

  effectsOn(input: Cell): { cell: Cell; part: PartDef }[] {
    return this.wire(input)
      .map((cell) => ({ cell, part: this.get(cell.r, cell.c) }))
      .filter((e): e is { cell: Cell; part: PartDef } => e.part?.kind === 'effect');
  }

  boostBonus(input: Cell): number {
    const cells = [input, ...this.effectsOn(input).map((e) => e.cell)];
    return this.adjacentParts(cells).reduce((s, p) => s + (p.boostDamage ?? 0), 0);
  }
}

export function combine(effects: PartDef[], boostBonus = 0): AttackSpec {
  const a = { ...BASE_ATTACK };
  for (const e of effects) {
    const m = e.mod ?? {};
    a.damage *= m.damageMul ?? 1;
    a.speed *= m.speedMul ?? 1;
    a.size *= m.sizeMul ?? 1;
    a.count += m.extraCount ?? 0;
    a.explodeRadius += m.explodeRadius ?? 0;
    a.splitCount += m.splitCount ?? 0;
    a.burnDps += m.burnDps ?? 0;
    a.pierce += m.pierce ?? 0;
    a.homing += m.homing ?? 0;
    a.laser ||= m.laser ?? false;
  }
  a.damage *= 1 + boostBonus;
  return a;
}

// 입력 파츠 하나가 발동했을 때 와이어를 따라 만들어지는 공격.
export function activate(board: Board, input: Cell): Activation | null {
  if (board.get(input.r, input.c)?.kind !== 'input') return null;
  const effects = board.effectsOn(input);
  return {
    cells: [input, ...board.wire(input)],
    attack: combine(
      effects.map((e) => e.part),
      board.boostBonus(input),
    ),
  };
}

// timer 입력은 초, move 입력은 이동 거리(px).
export function intervalOf(board: Board, input: Cell): number {
  const part = board.get(input.r, input.c);
  if (part?.kind !== 'input') return Infinity;
  let mul = 1;
  for (const { part: e } of board.effectsOn(input)) mul *= e.mod?.cooldownMul ?? 1;
  for (const d of NEIGHBORS4) {
    mul *= board.get(input.r + d.r, input.c + d.c)?.accelMul ?? 1;
  }
  return (part.every ?? 1) * mul;
}
