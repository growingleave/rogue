import { activate, cellKey, intervalOf, BASE_ATTACK, type AttackSpec, type Board, type Cell } from './board';
import type { Input } from './input';
import { distToPath, forkPaths, laserPath, type Point } from './laser';
import {
  BRANCH_DAMAGE,
  BRANCH_LENGTH,
  BURN_TIME,
  EXPLODE_DAMAGE,
  LASER_LENGTH,
  LASER_TICKS,
  LASER_TICK_DAMAGE,
  LASER_TIME,
  MAX_PROJECTILES,
  PLAYER_SPEED,
  SPLIT_DAMAGE,
} from './tuning';

const PLAYER_RADIUS = 12;
const DUMMY_RADIUS = 20;
const SPREAD = 0.2;
const DPS_WINDOW = 5;

interface Dummy {
  id: number;
  fx: number;
  fy: number;
  x: number;
  y: number;
  burnDps: number;
  burnUntil: number;
  burnShown: number;
  burnSource: string;
  flash: number;
}

// source: 이 공격을 만든 입력 파츠의 칸 키. 적중 누적·피해 누적이 자기 와이어를 빼고 세는 데 쓴다.
interface Projectile {
  source: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  damage: number;
  life: number;
  explodeRadius: number;
  splitCount: number;
  burnDps: number;
  pierce: number;
  homing: number;
  hit: number[];
  child: boolean;
}

interface Beam {
  source: string;
  attack: AttackSpec;
  offset: number;
  life: number;
  ticksLeft: number;
  nextTick: number;
  path: Point[];
  branches: Point[][];
  forkFrom: number | null;
  effectsDone: Set<number>;
}

interface Blast {
  x: number;
  y: number;
  radius: number;
  life: number;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export class Game {
  onActivate: (cells: Cell[]) => void = () => {};

  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private time = 0;
  private player = { x: 0, y: 0 };
  private placed = false;
  private dummies: Dummy[];
  private projectiles: Projectile[] = [];
  private spawned: Projectile[] = [];
  private beams: Beam[] = [];
  private blasts: Blast[] = [];
  private floaters: Floater[] = [];
  private progress = new Map<string, number>();
  private events: { source: string; hits: number; damage: number }[] = [];
  private damageLog: { t: number; amount: number }[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private input: Input,
    private board: Board,
  ) {
    this.ctx = canvas.getContext('2d')!;
    const spots = [
      [0.72, 0.28],
      [0.78, 0.72],
      [0.5, 0.52],
    ];
    this.dummies = spots.map(([fx, fy], id) => ({
      id,
      fx,
      fy,
      x: 0,
      y: 0,
      burnDps: 0,
      burnUntil: 0,
      burnShown: 0,
      burnSource: '',
      flash: 0,
    }));
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const d of this.dummies) {
      d.x = d.fx * this.w;
      d.y = d.fy * this.h;
    }
    if (!this.placed) {
      this.player.x = this.w * 0.2;
      this.player.y = this.h * 0.5;
      this.placed = true;
    }
    this.clampPlayer();
  }

  update(dt: number): void {
    this.time += dt;
    const moved = this.movePlayer(dt);
    this.runInputs(dt, moved);
    this.updateBeams(dt);
    this.moveProjectiles(dt);
    this.tickBurns(dt);
    this.tickVisuals(dt);
  }

  private movePlayer(dt: number): number {
    const m = this.input.move();
    const x0 = this.player.x;
    const y0 = this.player.y;
    this.player.x += m.x * PLAYER_SPEED * dt;
    this.player.y += m.y * PLAYER_SPEED * dt;
    this.clampPlayer();
    return Math.hypot(this.player.x - x0, this.player.y - y0);
  }

  private clampPlayer(): void {
    this.player.x = Math.min(Math.max(this.player.x, PLAYER_RADIUS), this.w - PLAYER_RADIUS);
    this.player.y = Math.min(Math.max(this.player.y, PLAYER_RADIUS), this.h - PLAYER_RADIUS);
  }

  // 모든 입력의 발동 기준은 쿨타임에서 나온다. 그래서 속사·가속 같은 쿨타임 파츠가 모든 입력에 똑같이 듣는다.
  // 한 프레임에 한 번만 발동하고, 남는 진행도는 한 번 분량까지만 남겨 연쇄가 폭주하지 않게 한다.
  private runInputs(dt: number, moved: number): void {
    const live = new Set<string>();
    const events = this.events;
    this.events = [];
    for (const cell of this.board.inputs()) {
      const part = this.board.get(cell.r, cell.c)!;
      const me = cellKey(cell);
      const k = `${me}:${part.id}`;
      live.add(k);
      const cd = intervalOf(this.board, cell);
      let need = cd;
      let gain = dt;
      if (part.trigger === 'move') {
        need = cd * PLAYER_SPEED;
        gain = moved;
      } else if (part.trigger === 'still') {
        gain = moved > 0 ? 0 : dt;
      } else if (part.trigger === 'hits' || part.trigger === 'damage') {
        need = cd * (part.per ?? 1);
        gain = events
          .filter((e) => e.source !== me)
          .reduce((s, e) => s + (part.trigger === 'hits' ? e.hits : e.damage), 0);
      }
      let p = (this.progress.get(k) ?? 0) + gain;
      if (p >= need) {
        p = Math.min(p - need, need);
        this.fire(cell);
      }
      this.progress.set(k, p);
    }
    for (const k of [...this.progress.keys()]) if (!live.has(k)) this.progress.delete(k);
  }

  private fire(cell: Cell): void {
    const target = this.nearestDummy(this.player.x, this.player.y, []);
    const act = activate(this.board, cell);
    if (!target || !act) return;
    const source = cellKey(cell);
    if (act.attack.laser) this.fireLaser(act.attack, source);
    else this.shoot(act.attack, target, source);
    this.onActivate(act.cells);
  }

  private nearestDummy(x: number, y: number, skip: number[]): Dummy | null {
    let best: Dummy | null = null;
    let bestD = Infinity;
    for (const d of this.dummies) {
      if (skip.includes(d.id)) continue;
      const dist = Math.hypot(d.x - x, d.y - y);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best;
  }

  private offsets(count: number): number[] {
    return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * SPREAD);
  }

  private shoot(a: AttackSpec, target: Dummy, source: string): void {
    const base = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    for (const ang of this.offsets(a.count).map((o) => base + o)) {
      this.addProjectile({
        source,
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(ang) * a.speed,
        vy: Math.sin(ang) * a.speed,
        size: a.size,
        damage: a.damage,
        life: a.lifetime,
        explodeRadius: a.explodeRadius,
        splitCount: a.splitCount,
        burnDps: a.burnDps,
        pierce: a.pierce,
        homing: a.homing,
        hit: [],
        child: false,
      });
    }
  }

  // 레이저는 잠깐 유지되며 여러 번 연달아 피해를 준다.
  // 유도: 적 쪽으로 구부러짐. 관통: 효과 없음. 분열: 처음 닿은 적에서 갈래로 갈라짐.
  private fireLaser(a: AttackSpec, source: string): void {
    for (const offset of this.offsets(a.count)) {
      this.beams.push({
        source,
        attack: a,
        offset,
        life: LASER_TIME,
        ticksLeft: LASER_TICKS,
        nextTick: 0,
        path: [],
        branches: [],
        forkFrom: null,
        effectsDone: new Set(),
      });
    }
  }

  private updateBeams(dt: number): void {
    const target = this.nearestDummy(this.player.x, this.player.y, []);
    const base = target ? Math.atan2(target.y - this.player.y, target.x - this.player.x) : 0;
    const targets = this.dummies.map((d) => ({ x: d.x, y: d.y, r: DUMMY_RADIUS, id: d.id }));
    for (const b of this.beams) {
      const a = b.attack;
      const length = LASER_LENGTH * (a.speed / BASE_ATTACK.speed);
      const turn = a.homing / a.speed;
      b.life -= dt;
      b.path = laserPath([this.player.x, this.player.y], base + b.offset, length, turn, targets);
      const fork = forkPaths(b.path, targets, a.size * 1.2, a.splitCount, length * BRANCH_LENGTH, turn);
      b.branches = fork?.branches ?? [];
      b.forkFrom = fork?.target.id ?? null;
      b.nextTick -= dt;
      while (b.ticksLeft > 0 && b.nextTick <= 0) {
        this.laserTick(b);
        b.ticksLeft--;
        b.nextTick += LASER_TIME / LASER_TICKS;
      }
    }
    this.beams = this.beams.filter((b) => b.life > 0 || b.ticksLeft > 0);
  }

  private laserTick(b: Beam): void {
    const reach = DUMMY_RADIUS + b.attack.size * 1.2;
    for (const d of this.dummies) {
      if (distToPath(d.x, d.y, b.path) <= reach) this.laserHit(b, d, 1);
      for (const branch of b.branches) {
        if (d.id !== b.forkFrom && distToPath(d.x, d.y, branch) <= reach) this.laserHit(b, d, BRANCH_DAMAGE);
      }
    }
  }

  // 틱마다 피해를 주지만, 폭발·화상 같은 명중 효과는 레이저 한 번에 적마다 한 번만 터진다.
  private laserHit(b: Beam, d: Dummy, mul: number): void {
    const a = b.attack;
    this.countHit(b.source);
    this.damage(d, a.damage * LASER_TICK_DAMAGE * mul, '#e8f4ff', b.source);
    if (b.effectsDone.has(d.id)) return;
    b.effectsDone.add(d.id);
    this.burn(d, a.burnDps, b.source);
    this.explode(d.x, d.y, a.explodeRadius, a.damage * mul * EXPLODE_DAMAGE, b.source);
  }

  private burn(d: Dummy, dps: number, source: string): void {
    if (dps <= 0) return;
    d.burnDps = Math.max(d.burnUntil > this.time ? d.burnDps : 0, dps);
    d.burnUntil = this.time + BURN_TIME;
    d.burnSource = source;
  }

  private explode(x: number, y: number, radius: number, damage: number, source: string): void {
    if (radius <= 0) return;
    this.blasts.push({ x, y, radius, life: 0.25 });
    for (const o of this.dummies) {
      if (Math.hypot(o.x - x, o.y - y) <= radius + DUMMY_RADIUS) this.damage(o, damage, '#ffb35c', source);
    }
  }

  // 적중은 공격이 적에게 직접 닿은 횟수다. 폭발 범위 피해와 지속 피해는 적중이 아니다.
  private countHit(source: string): void {
    this.events.push({ source, hits: 1, damage: 0 });
  }

  private addProjectile(p: Projectile): void {
    if (this.projectiles.length >= MAX_PROJECTILES) this.projectiles.shift();
    this.projectiles.push(p);
  }

  private moveProjectiles(dt: number): void {
    const margin = 40;
    this.projectiles = this.projectiles.filter((p) => {
      if (p.homing > 0) this.steer(p, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      const hit = this.dummies.find(
        (d) => !p.hit.includes(d.id) && Math.hypot(d.x - p.x, d.y - p.y) <= DUMMY_RADIUS + p.size,
      );
      if (hit) {
        this.onHit(p, hit);
        p.hit.push(hit.id);
        if (p.pierce <= 0) return false;
        p.pierce--;
      }
      return (
        p.life > 0 && p.x > -margin && p.x < this.w + margin && p.y > -margin && p.y < this.h + margin
      );
    });
    for (const p of this.spawned) this.addProjectile(p);
    this.spawned = [];
  }

  private steer(p: Projectile, dt: number): void {
    const target = this.nearestDummy(p.x, p.y, p.hit);
    if (!target) return;
    const speed = Math.hypot(p.vx, p.vy);
    const cur = Math.atan2(p.vy, p.vx);
    const want = Math.atan2(target.y - p.y, target.x - p.x);
    const diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
    const turn = Math.max(-p.homing * dt, Math.min(p.homing * dt, diff));
    p.vx = Math.cos(cur + turn) * speed;
    p.vy = Math.sin(cur + turn) * speed;
  }

  private onHit(p: Projectile, d: Dummy): void {
    this.countHit(p.source);
    this.damage(d, p.damage, '#e8f4ff', p.source);
    this.burn(d, p.burnDps, p.source);
    this.explode(p.x, p.y, p.explodeRadius, p.damage * EXPLODE_DAMAGE, p.source);
    if (p.splitCount > 0 && !p.child) {
      const base = Math.atan2(p.vy, p.vx) + Math.PI / 2;
      const speed = Math.hypot(p.vx, p.vy) * 0.8;
      for (let i = 0; i < p.splitCount; i++) {
        const ang = base + (i * Math.PI * 2) / p.splitCount;
        this.spawned.push({
          ...p,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          size: p.size * 0.7,
          damage: p.damage * SPLIT_DAMAGE,
          life: 0.6,
          explodeRadius: p.explodeRadius * 0.6,
          splitCount: 0,
          pierce: 0,
          hit: [d.id],
          child: true,
        });
      }
    }
  }

  private damage(d: Dummy, amount: number, color: string, source: string): void {
    this.damageLog.push({ t: this.time, amount });
    this.events.push({ source, hits: 0, damage: amount });
    d.flash = 0.1;
    this.floaters.push({
      x: d.x + (Math.random() - 0.5) * 40,
      y: d.y - DUMMY_RADIUS - 6 - Math.random() * 16,
      text: amount >= 10 ? Math.round(amount).toString() : amount.toFixed(1),
      color,
      life: 0.7,
    });
  }

  private tickBurns(dt: number): void {
    for (const d of this.dummies) {
      if (d.burnUntil <= this.time) continue;
      const amount = d.burnDps * dt;
      this.damageLog.push({ t: this.time, amount });
      this.events.push({ source: d.burnSource, hits: 0, damage: amount });
      d.burnShown += amount;
      if (d.burnShown >= 3) {
        this.floaters.push({
          x: d.x + (Math.random() - 0.5) * 24,
          y: d.y - DUMMY_RADIUS - 6,
          text: d.burnShown.toFixed(1),
          color: '#ff6b4a',
          life: 0.6,
        });
        d.burnShown = 0;
      }
    }
  }

  private tickVisuals(dt: number): void {
    for (const d of this.dummies) d.flash = Math.max(0, d.flash - dt);
    this.blasts = this.blasts.filter((b) => (b.life -= dt) > 0);
    this.floaters = this.floaters.filter((f) => {
      f.y -= 40 * dt;
      return (f.life -= dt) > 0;
    });
    const cutoff = this.time - DPS_WINDOW;
    while (this.damageLog.length > 0 && this.damageLog[0].t < cutoff) this.damageLog.shift();
  }

  dps(): number {
    const total = this.damageLog.reduce((s, e) => s + e.amount, 0);
    return total / Math.max(1, Math.min(DPS_WINDOW, this.time));
  }

  render(): void {
    const g = this.ctx;
    g.fillStyle = '#0a1628';
    g.fillRect(0, 0, this.w, this.h);

    g.strokeStyle = 'rgba(80, 200, 230, 0.07)';
    g.lineWidth = 1;
    for (let x = 0; x < this.w; x += 40) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, this.h);
      g.stroke();
    }
    for (let y = 0; y < this.h; y += 40) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(this.w, y);
      g.stroke();
    }

    for (const d of this.dummies) this.drawDummy(d);

    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = '#9ff6ff';
    const line = (pts: Point[]) => {
      if (pts.length < 2) return;
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
      g.stroke();
    };
    for (const b of this.beams) {
      g.globalAlpha = Math.max(0.3, b.life / LASER_TIME);
      g.lineWidth = b.attack.size * 2.4;
      line(b.path);
      g.lineWidth = b.attack.size * 1.6;
      for (const branch of b.branches) line(branch);
    }
    g.globalAlpha = 1;
    g.lineCap = 'butt';
    g.lineJoin = 'miter';

    for (const b of this.blasts) {
      g.strokeStyle = `rgba(255, 170, 80, ${b.life / 0.25})`;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      g.stroke();
    }

    for (const p of this.projectiles) {
      g.fillStyle = p.explodeRadius > 0 ? '#ffb35c' : p.burnDps > 0 ? '#ff6b4a' : '#bff3ff';
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
    }

    g.fillStyle = '#4fe3ff';
    g.beginPath();
    g.arc(this.player.x, this.player.y, PLAYER_RADIUS, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#e8fbff';
    g.lineWidth = 2;
    g.stroke();

    g.textAlign = 'center';
    g.font = 'bold 14px system-ui, sans-serif';
    for (const f of this.floaters) {
      g.globalAlpha = Math.min(1, f.life / 0.3);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, f.y);
    }
    g.globalAlpha = 1;

    const joy = this.input.joy;
    if (joy) {
      g.strokeStyle = 'rgba(232, 251, 255, 0.35)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(joy.ox, joy.oy, this.input.joyRadius, 0, Math.PI * 2);
      g.stroke();
      const dx = joy.x - joy.ox;
      const dy = joy.y - joy.oy;
      const len = Math.hypot(dx, dy);
      const k = len > this.input.joyRadius ? this.input.joyRadius / len : 1;
      g.fillStyle = 'rgba(232, 251, 255, 0.45)';
      g.beginPath();
      g.arc(joy.ox + dx * k, joy.oy + dy * k, 18, 0, Math.PI * 2);
      g.fill();
    }

    g.textAlign = 'left';
    g.font = '13px system-ui, sans-serif';
    g.fillStyle = '#e8f4ff';
    g.fillText(`DPS ${this.dps().toFixed(1)} (최근 ${DPS_WINDOW}초)`, 12, 22);
    g.fillStyle = '#8fb3c9';
    g.fillText(`투사체 ${this.projectiles.length}/${MAX_PROJECTILES}`, 12, 40);
  }

  private drawDummy(d: Dummy): void {
    const g = this.ctx;
    g.strokeStyle = '#8a6a43';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(d.x, d.y + 4);
    g.lineTo(d.x, d.y + DUMMY_RADIUS + 14);
    g.moveTo(d.x - DUMMY_RADIUS - 8, d.y + 6);
    g.lineTo(d.x + DUMMY_RADIUS + 8, d.y + 6);
    g.stroke();

    g.fillStyle = d.flash > 0 ? '#ffffff' : '#c9a46a';
    g.beginPath();
    g.arc(d.x, d.y - 4, DUMMY_RADIUS - 4, 0, Math.PI * 2);
    g.fill();

    if (d.burnUntil > this.time) {
      g.strokeStyle = '#ff6b4a';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(d.x, d.y - 4, DUMMY_RADIUS, 0, Math.PI * 2);
      g.stroke();
    }
  }
}
