// 모든 수치는 초안용 임시값이다.
import {
  BRANCH_DAMAGE,
  BRANCH_LENGTH,
  BURN_TIME,
  EXPLODE_DAMAGE,
  LASER_TICKS,
  LASER_TICK_DAMAGE,
  LASER_TIME,
  PLAYER_SPEED,
  SPLIT_DAMAGE,
} from './tuning';

export type PartKind = 'input' | 'effect' | 'boost';
export type Trigger = 'timer' | 'move';

export interface EffectMod {
  damageMul?: number;
  speedMul?: number;
  cooldownMul?: number;
  sizeMul?: number;
  extraCount?: number;
  explodeRadius?: number;
  splitCount?: number;
  burnDps?: number;
  pierce?: number;
  homing?: number;
  laser?: boolean;
}

export interface PartDef {
  id: string;
  name: string;
  kind: PartKind;
  icon: string;
  desc: string;
  trigger?: Trigger;
  damage?: number;
  cooldown?: number;
  mod?: EffectMod;
  boostDamage?: number;
  accelMul?: number;
}

export const PARTS: PartDef[] = [
  {
    id: 'in-timer',
    name: '타이머',
    kind: 'input',
    icon: '◷',
    trigger: 'timer',
    damage: 10,
    cooldown: 1,
    desc: '쿨타임마다 와이어를 따라 신호를 보내 가장 가까운 적을 공격한다.',
  },
  {
    id: 'in-move',
    name: '이동할 때',
    kind: 'input',
    icon: '⇝',
    trigger: 'move',
    damage: 8,
    cooldown: 0.5,
    desc: '움직인 거리가 쌓이면 와이어를 따라 신호를 보내 공격한다. 멈춰 있으면 발동하지 않는다.',
  },
  {
    id: 'sniper',
    name: '저격',
    kind: 'effect',
    icon: '저',
    desc: '한 발이 강하고 빠르지만 느리게 쏜다.',
    mod: { damageMul: 2.2, speedMul: 1.6, cooldownMul: 1.5 },
  },
  {
    id: 'shotgun',
    name: '산탄',
    kind: 'effect',
    icon: '산',
    desc: '여러 발을 부채꼴로 쏜다.',
    mod: { extraCount: 2, damageMul: 0.6 },
  },
  {
    id: 'rapid',
    name: '속사',
    kind: 'effect',
    icon: '속',
    desc: '자주 쏜다.',
    mod: { cooldownMul: 0.55, damageMul: 0.8 },
  },
  {
    id: 'giant',
    name: '거대화',
    kind: 'effect',
    icon: '거',
    desc: '탄이 커지고 강해지지만 느려진다.',
    mod: { sizeMul: 1.8, damageMul: 1.3, speedMul: 0.85 },
  },
  {
    id: 'explode',
    name: '폭발',
    kind: 'effect',
    icon: '폭',
    desc: '맞은 곳에서 폭발한다.',
    mod: { explodeRadius: 55 },
  },
  {
    id: 'split',
    name: '분열',
    kind: 'effect',
    icon: '분',
    desc: '맞으면 작은 탄으로 갈라진다. 레이저는 처음 닿은 적에서 갈래로 갈라진다.',
    mod: { splitCount: 3 },
  },
  {
    id: 'burn',
    name: '화상',
    kind: 'effect',
    icon: '화',
    desc: '맞은 적이 불탄다.',
    mod: { burnDps: 6 },
  },
  {
    id: 'pierce',
    name: '관통',
    kind: 'effect',
    icon: '관',
    desc: '탄이 적을 뚫고 지나간다. 레이저에는 효과가 없다.',
    mod: { pierce: 2 },
  },
  {
    id: 'homing',
    name: '유도',
    kind: 'effect',
    icon: '유',
    desc: '탄이 적 쪽으로 휘어 따라간다. 레이저는 적 쪽으로 구부러진다.',
    mod: { homing: 5 },
  },
  {
    id: 'laser',
    name: '레이저',
    kind: 'effect',
    icon: '레',
    desc: '투사체 대신 잠깐 유지되는 레이저를 쏜다. 레이저 위의 모든 적을 맞힌다. 폭발·화상은 적마다 한 번만 터진다.',
    mod: { laser: true, damageMul: 0.8 },
  },
  {
    id: 'boost',
    name: '강화',
    kind: 'boost',
    icon: '+',
    boostDamage: 0.3,
    desc: '와이어에 잇지 않아도 상하좌우로 붙은 입력·효과 파츠의 공격을 강하게 한다.',
  },
  {
    id: 'accel',
    name: '가속',
    kind: 'boost',
    icon: '»',
    accelMul: 0.75,
    desc: '와이어에 잇지 않아도 상하좌우로 붙은 입력 파츠를 더 자주 발동시킨다.',
  },
];

export const PART_BY_ID = new Map(PARTS.map((p) => [p.id, p]));

const num = (v: number) => Number(v.toFixed(2)).toString();
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function statLines(p: PartDef): string[] {
  const out: string[] = [];
  if (p.kind === 'input') {
    out.push(`기본 피해 ${num(p.damage ?? 0)}`, `쿨타임 ${num(p.cooldown ?? 0)}초`);
    if (p.trigger === 'move') {
      const cd = p.cooldown ?? 0;
      out.push(`쿨타임 ${num(cd)}초 × 이동속도 ${PLAYER_SPEED} = ${num(cd * PLAYER_SPEED)}px 움직일 때마다 발동`);
    }
  }
  const m = p.mod ?? {};
  if (m.laser) {
    out.push(`레이저: ${num(LASER_TIME)}초 동안 ${LASER_TICKS}번 연타, 1번에 공격 피해의 ${pct(LASER_TICK_DAMAGE)}`);
  }
  if (m.damageMul !== undefined) out.push(`피해 ×${num(m.damageMul)}`);
  if (m.speedMul !== undefined) out.push(`탄속·레이저 길이 ×${num(m.speedMul)}`);
  if (m.cooldownMul !== undefined) out.push(`쿨타임 ×${num(m.cooldownMul)}`);
  if (m.sizeMul !== undefined) out.push(`탄 크기 ×${num(m.sizeMul)}`);
  if (m.extraCount !== undefined) out.push(`탄 수 +${m.extraCount}`);
  if (m.explodeRadius !== undefined) {
    out.push(`폭발 반경 ${m.explodeRadius}px, 폭발 피해 = 공격 피해의 ${pct(EXPLODE_DAMAGE)}`);
  }
  if (m.splitCount !== undefined) {
    out.push(`투사체: 작은 탄 ${m.splitCount}개, 조각 피해 ${pct(SPLIT_DAMAGE)}`);
    out.push(
      `레이저: ${m.splitCount}갈래, 갈래 길이 ${pct(BRANCH_LENGTH)}, 갈래 피해 ${pct(BRANCH_DAMAGE)}`,
    );
  }
  if (m.burnDps !== undefined) out.push(`화상 초당 ${num(m.burnDps)} 피해, ${BURN_TIME}초`);
  if (m.pierce !== undefined) out.push(`적 ${m.pierce}명 더 관통`);
  if (m.homing !== undefined) out.push(`유도 세기 ${num(m.homing)} (초당 회전 각도, 라디안)`);
  if (p.boostDamage !== undefined) out.push(`붙은 파츠의 공격 피해 +${pct(p.boostDamage)}`);
  if (p.accelMul !== undefined) out.push(`붙은 입력 파츠 쿨타임 ×${num(p.accelMul)}`);
  return out;
}
