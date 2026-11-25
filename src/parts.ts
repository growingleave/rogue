// 모든 수치는 초안용 임시값이다.

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
  // timer: 발동 간격(초), move: 발동에 필요한 이동 거리(px)
  every?: number;
  mod?: EffectMod;
  boostDamage?: number;
  accelMul?: number;
}

export const PARTS: PartDef[] = [
  {
    id: 'in-timer',
    name: '1초마다',
    kind: 'input',
    icon: '◷',
    trigger: 'timer',
    every: 1,
    desc: '1초마다 와이어를 따라 신호를 보내 가장 가까운 적을 공격한다.',
  },
  {
    id: 'in-move',
    name: '이동할 때',
    kind: 'input',
    icon: '⇝',
    trigger: 'move',
    every: 120,
    desc: '일정 거리를 움직일 때마다 와이어를 따라 신호를 보내 공격한다. 멈춰 있으면 발동하지 않는다.',
  },
  {
    id: 'sniper',
    name: '저격',
    kind: 'effect',
    icon: '저',
    desc: '피해와 탄속이 크게 늘고 발동 간격이 길어진다.',
    mod: { damageMul: 2.2, speedMul: 1.6, cooldownMul: 1.5 },
  },
  {
    id: 'shotgun',
    name: '산탄',
    kind: 'effect',
    icon: '산',
    desc: '탄이 2발 늘고 탄 하나의 피해가 줄어든다.',
    mod: { extraCount: 2, damageMul: 0.6 },
  },
  {
    id: 'rapid',
    name: '속사',
    kind: 'effect',
    icon: '속',
    desc: '발동 간격이 크게 줄고 피해가 조금 줄어든다.',
    mod: { cooldownMul: 0.55, damageMul: 0.8 },
  },
  {
    id: 'giant',
    name: '거대화',
    kind: 'effect',
    icon: '거',
    desc: '탄이 커지고 피해가 늘지만 느려진다.',
    mod: { sizeMul: 1.8, damageMul: 1.3, speedMul: 0.85 },
  },
  {
    id: 'explode',
    name: '폭발',
    kind: 'effect',
    icon: '폭',
    desc: '맞으면 주변에 절반 피해의 폭발을 일으킨다.',
    mod: { explodeRadius: 55 },
  },
  {
    id: 'split',
    name: '분열',
    kind: 'effect',
    icon: '분',
    desc: '맞으면 작은 탄 3개로 갈라진다. 레이저는 처음 닿은 적에서 3갈래로 갈라진다.',
    mod: { splitCount: 3 },
  },
  {
    id: 'burn',
    name: '화상',
    kind: 'effect',
    icon: '화',
    desc: '맞은 적이 2초 동안 초당 6의 화상 피해를 입는다.',
    mod: { burnDps: 6 },
  },
  {
    id: 'pierce',
    name: '관통',
    kind: 'effect',
    icon: '관',
    desc: '탄이 적을 뚫고 지나가 2명을 더 맞힌다. 레이저에는 효과가 없다.',
    mod: { pierce: 2 },
  },
  {
    id: 'homing',
    name: '유도',
    kind: 'effect',
    icon: '유',
    desc: '탄이 가까운 적 쪽으로 휘어서 따라간다. 레이저는 적 쪽으로 구부러진다.',
    mod: { homing: 5 },
  },
  {
    id: 'laser',
    name: '레이저',
    kind: 'effect',
    icon: '레',
    desc: '공격이 투사체 대신 잠깐 유지되는 레이저가 되어 0.35초 동안 5번 연달아 피해를 준다. 레이저 위의 모든 적을 맞힌다. 폭발·화상은 적마다 한 번만 터진다.',
    mod: { laser: true, damageMul: 0.8 },
  },
  {
    id: 'boost',
    name: '강화',
    kind: 'boost',
    icon: '+',
    boostDamage: 0.3,
    desc: '상하좌우로 붙은 입력·효과 파츠가 만드는 공격의 피해 +30%.',
  },
  {
    id: 'accel',
    name: '가속',
    kind: 'boost',
    icon: '»',
    accelMul: 0.75,
    desc: '상하좌우로 붙은 입력 파츠의 발동 간격(이동할 때는 필요한 거리)이 25% 줄어든다.',
  },
];

export const PART_BY_ID = new Map(PARTS.map((p) => [p.id, p]));
