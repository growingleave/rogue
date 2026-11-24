import { PART_BY_ID, type Dir, type PartDef } from './parts';

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
}

export interface Activation {
  source: Cell;
  cells: Cell[];
  attack: AttackSpec;
  depth: number;
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
};

// GAME_DESIGN.md 8장의 임시 상한.
export const CHAIN_LIMITS = { maxDepth: 10, maxSamePart: 3 };

const CW_ORDER: Cell[] = [
  { r: -1, c: 0 },
  { r: -1, c: 1 },
  { r: 0, c: 1 },
  { r: 1, c: 1 },
  { r: 1, c: 0 },
  { r: 1, c: -1 },
  { r: 0, c: -1 },
  { r: -1, c: -1 },
];

const STEP: Record<Exclude<Dir, 'cw'>, Cell> = {
  right: { r: 0, c: 1 },
  left: { r: 0, c: -1 },
  up: { r: -1, c: 0 },
  down: { r: 1, c: 0 },
};

const NEIGHBORS4: Cell[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
];

const key = (p: Cell) => `${p.r},${p.c}`;

export class Board {
  private cells: (string | null)[];

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
    if (this.inBounds(r, c)) this.cells[r * this.cols + c] = id;
  }

  clear(): void {
    this.cells.fill(null);
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
}

export function arrowCells(dir: Dir, from: Cell, rows: number, cols: number): Cell[] {
  const inside = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols;
  if (dir === 'cw') {
    return CW_ORDER.map((d) => ({ r: from.r + d.r, c: from.c + d.c })).filter((p) => inside(p.r, p.c));
  }
  const s = STEP[dir];
  const out: Cell[] = [];
  for (let r = from.r + s.r, c = from.c + s.c; inside(r, c); r += s.r, c += s.c) out.push({ r, c });
  return out;
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
  }
  a.damage *= 1 + boostBonus;
  return a;
}

function boostAround(board: Board, cells: Cell[]): number {
  const seen = new Set<string>();
  let bonus = 0;
  for (const cell of cells) {
    for (const d of NEIGHBORS4) {
      const p = { r: cell.r + d.r, c: cell.c + d.c };
      const part = board.get(p.r, p.c);
      if (part?.kind !== 'boost' || seen.has(key(p))) continue;
      seen.add(key(p));
      bonus += part.boostDamage ?? 0;
    }
  }
  return bonus;
}

// 출력 파츠 하나가 발동했을 때 일어나는 모든 공격(중계로 이어진 연쇄 포함)을 계산한다.
export function activate(board: Board, start: Cell): Activation[] {
  const startPart = board.get(start.r, start.c);
  if (!startPart?.dir) return [];

  const counts = new Map<string, number>();
  const take = (p: Cell): boolean => {
    const n = counts.get(key(p)) ?? 0;
    if (n >= CHAIN_LIMITS.maxSamePart) return false;
    counts.set(key(p), n + 1);
    return true;
  };

  const result: Activation[] = [];
  const queue: { cell: Cell; depth: number }[] = [{ cell: start, depth: 0 }];
  take(start);

  while (queue.length > 0) {
    const { cell, depth } = queue.shift()!;
    const part = board.get(cell.r, cell.c)!;
    const effects: PartDef[] = [];
    const effectCells: Cell[] = [];
    const used: Cell[] = [];

    for (const p of arrowCells(part.dir!, cell, board.rows, board.cols)) {
      const target = board.get(p.r, p.c);
      if (!target) continue;
      if (target.kind === 'effect' && take(p)) {
        effects.push(target);
        effectCells.push(p);
        used.push(p);
      } else if (target.kind === 'relay' && depth < CHAIN_LIMITS.maxDepth && take(p)) {
        used.push(p);
        queue.push({ cell: p, depth: depth + 1 });
      }
    }

    const bonus = boostAround(board, [cell, ...effectCells]);
    result.push({ source: cell, cells: used, attack: combine(effects, bonus), depth });
  }
  return result;
}

export function cooldownOf(board: Board, cell: Cell): number {
  const part = board.get(cell.r, cell.c);
  if (part?.kind !== 'output' || !part.dir) return Infinity;
  let mul = 1;
  for (const p of arrowCells(part.dir, cell, board.rows, board.cols)) {
    const target = board.get(p.r, p.c);
    if (target?.kind === 'effect') mul *= target.mod?.cooldownMul ?? 1;
  }
  return (part.interval ?? 1) * mul;
}
