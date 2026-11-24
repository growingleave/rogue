// 모든 수치는 첫 초안용 임시값이다.

export type Dir = 'right' | 'left' | 'up' | 'down' | 'cw';
export type PartKind = 'output' | 'effect' | 'boost' | 'relay';

export interface EffectMod {
  damageMul?: number;
  speedMul?: number;
  cooldownMul?: number;
  sizeMul?: number;
  extraCount?: number;
  explodeRadius?: number;
  splitCount?: number;
  burnDps?: number;
}

export interface PartDef {
  id: string;
  name: string;
  kind: PartKind;
  icon: string;
  desc: string;
  dir?: Dir;
  interval?: number;
  mod?: EffectMod;
  boostDamage?: number;
}

export const DIR_ICON: Record<Dir, string> = {
  right: '→',
  left: '←',
  up: '↑',
  down: '↓',
  cw: '↻',
};

const DIR_TEXT: Record<Dir, string> = {
  right: '오른쪽 칸들을 순서대로',
  left: '왼쪽 칸들을 순서대로',
  up: '위쪽 칸들을 순서대로',
  down: '아래쪽 칸들을 순서대로',
  cw: '주변 8칸을 위쪽부터 시계방향 순서로',
};

const output = (dir: Dir): PartDef => ({
  id: `out-${dir}`,
  name: `출력 ${DIR_ICON[dir]}`,
  kind: 'output',
  icon: DIR_ICON[dir],
  dir,
  interval: 1,
  desc: `1초마다 ${DIR_TEXT[dir]} 발동해 가장 가까운 적에게 투사체를 쏜다.`,
});

const relay = (dir: Dir): PartDef => ({
  id: `relay-${dir}`,
  name: `중계 ${DIR_ICON[dir]}`,
  kind: 'relay',
  icon: DIR_ICON[dir],
  dir,
  desc: `신호를 받으면 ${DIR_TEXT[dir]} 발동해 새 공격을 하나 더 쏜다.`,
});

export const PARTS: PartDef[] = [
  output('right'),
  output('left'),
  output('up'),
  output('down'),
  output('cw'),
  {
    id: 'sniper',
    name: '저격',
    kind: 'effect',
    icon: '저',
    desc: '피해와 탄속이 크게 늘고 발사 간격이 길어진다.',
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
    desc: '발사 간격이 크게 줄고 피해가 조금 줄어든다.',
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
    desc: '맞으면 작은 탄 3개로 갈라진다.',
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
    id: 'boost',
    name: '강화',
    kind: 'boost',
    icon: '+',
    boostDamage: 0.3,
    desc: '상하좌우로 붙은 출력·중계·효과 파츠가 만드는 공격의 피해 +30%.',
  },
  relay('right'),
  relay('left'),
  relay('up'),
  relay('down'),
];

export const PART_BY_ID = new Map(PARTS.map((p) => [p.id, p]));
