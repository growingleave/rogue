import { activate, intervalOf, type Board, type Cell } from './board';
import type { Game } from './game';
import { PARTS, PART_BY_ID, statLines, type PartDef } from './parts';
import { MAX_WIRE, PLAYER_SPEED } from './tuning';

const SVG_NS = 'http://www.w3.org/2000/svg';
const UNIT = 100;

const KIND_NAME: Record<PartDef['kind'], string> = {
  input: '입력 파츠',
  effect: '효과 파츠',
  boost: '강화 파츠',
};

type At = [number, number];

interface Preset {
  name: string;
  parts: [number, number, string][];
  wires: [At, At[]][];
}

const PRESETS: Preset[] = [
  { name: '저격총', parts: [[1, 0, 'in-timer'], [1, 1, 'sniper']], wires: [[[1, 0], [[1, 1]]]] },
  { name: '샷건', parts: [[1, 0, 'in-timer'], [1, 1, 'shotgun']], wires: [[[1, 0], [[1, 1]]]] },
  { name: '기관총', parts: [[1, 0, 'in-timer'], [1, 1, 'rapid']], wires: [[[1, 0], [[1, 1]]]] },
  {
    name: '레이저',
    parts: [
      [1, 0, 'in-timer'],
      [1, 1, 'laser'],
      [1, 2, 'burn'],
      [0, 1, 'boost'],
    ],
    wires: [[[1, 0], [[1, 1], [1, 2]]]],
  },
  {
    name: '이동 사격',
    parts: [
      [2, 0, 'in-move'],
      [2, 1, 'shotgun'],
      [2, 2, 'homing'],
      [3, 2, 'pierce'],
      [3, 0, 'accel'],
    ],
    wires: [[[2, 0], [[2, 1], [2, 2], [3, 2]]]],
  },
];

export interface UIRoots {
  board: HTMLElement;
  palette: HTMLElement;
  info: HTMLElement;
  presets: HTMLSelectElement;
  wire: HTMLButtonElement;
  clear: HTMLButtonElement;
}

interface Drag {
  pointerId: number;
  start: Cell;
  last: Cell;
  mode: 'wire' | 'move' | 'tap';
  dragged: boolean;
  path: Cell[];
}

export function mountUI(roots: UIRoots, board: Board, game: Game): void {
  let selected: string | null = null;
  let wiring = false;
  let wireFrom: Cell | null = null;
  let picked: Cell | null = null;
  let drag: Drag | null = null;
  const cellEls: HTMLDivElement[][] = [];
  const tiles = new Map<string, HTMLButtonElement>();

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('wires');
  svg.setAttribute('viewBox', `0 0 ${board.cols * UNIT} ${board.rows * UNIT}`);
  svg.innerHTML = `<defs><marker id="wire-head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0 0L10 5L0 10z" fill="#4fe3ff"/></marker></defs><g class="paths"></g>`;
  const paths = svg.querySelector('.paths')!;

  const grid = document.createElement('div');
  grid.className = 'board';
  grid.style.gridTemplateColumns = `repeat(${board.cols}, minmax(0, 1fr))`;
  grid.style.gridTemplateRows = `repeat(${board.rows}, minmax(0, 1fr))`;
  for (let r = 0; r < board.rows; r++) {
    cellEls.push([]);
    for (let c = 0; c < board.cols; c++) {
      const el = document.createElement('div');
      el.className = 'cell';
      grid.appendChild(el);
      cellEls[r].push(el);
    }
  }
  roots.board.append(svg, grid);

  for (const part of PARTS) {
    const tile = document.createElement('button');
    tile.className = `tile kind-${part.kind}`;
    tile.title = part.name;
    tile.append(span('icon', part.icon), span('name', part.name));
    tile.addEventListener('click', () => {
      selected = selected === part.id ? null : part.id;
      wiring = false;
      wireFrom = null;
      picked = null;
      refresh();
    });
    roots.palette.appendChild(tile);
    tiles.set(part.id, tile);
  }

  roots.presets.append(new Option('준비된 배치 불러오기', ''));
  PRESETS.forEach((p, i) => roots.presets.append(new Option(p.name, String(i))));
  roots.presets.addEventListener('change', () => {
    const preset = PRESETS[Number(roots.presets.value)];
    roots.presets.value = '';
    if (preset) load(preset);
  });

  roots.wire.addEventListener('click', () => {
    wiring = !wiring;
    wireFrom = null;
    selected = null;
    picked = null;
    refresh();
  });

  roots.clear.addEventListener('click', () => {
    board.clear();
    picked = null;
    refresh();
  });

  grid.addEventListener('pointerdown', (e) => {
    const cell = cellAt(e);
    if (!cell || drag) return;
    const part = board.get(cell.r, cell.c);
    let mode: Drag['mode'] = 'tap';
    if (wiring) mode = part?.kind === 'input' ? 'wire' : 'tap';
    else if (!selected && part) mode = 'move';
    drag = { pointerId: e.pointerId, start: cell, last: cell, mode, dragged: false, path: [] };
    grid.setPointerCapture(e.pointerId);
  });

  grid.addEventListener('pointermove', (e) => {
    if (drag?.pointerId !== e.pointerId || drag.mode === 'tap') return;
    const cell = cellAt(e);
    if (!cell || same(cell, drag.last)) return;
    if (drag.mode === 'wire') extendWire(drag, cell);
    else hoverMove(drag, cell);
  });

  grid.addEventListener('pointerup', (e) => {
    if (drag?.pointerId !== e.pointerId) return;
    const d = drag;
    drag = null;
    clearDrop();
    if (!d.dragged) {
      onTap(d.start);
    } else if (d.mode === 'move' && !board.get(d.last.r, d.last.c)) {
      board.move(d.start, d.last);
      picked = d.last;
      refresh();
    } else if (d.mode === 'wire') {
      refresh();
    }
  });

  grid.addEventListener('pointercancel', (e) => {
    if (drag?.pointerId !== e.pointerId) return;
    drag = null;
    clearDrop();
  });

  game.onActivate = (cells) => {
    cells.forEach((p, i) => {
      const el = cellEls[p.r][p.c];
      el.classList.remove('pulse');
      void el.offsetWidth;
      el.style.animationDelay = `${i * 45}ms`;
      el.classList.add('pulse');
    });
  };

  function extendWire(d: Drag, cell: Cell): void {
    const back = d.path.length >= 2 ? d.path[d.path.length - 2] : d.start;
    if (d.path.length > 0 && same(cell, back)) d.path.pop();
    else if (board.canWire(d.start, [...d.path, cell])) d.path.push(cell);
    else return;
    d.last = cell;
    d.dragged = true;
    wireFrom = d.start;
    board.setWire(d.start, d.path);
    drawWires();
    showText(`와이어 ${d.path.length}/${MAX_WIRE}칸. 지나온 칸으로 되돌아가면 와이어가 줄어든다.`);
  }

  // 배선 중 탭: 입력 파츠를 고르고, 와이어 끝에 붙은 칸을 눌러 잇는다. 마지막 칸을 다시 누르면 한 칸 줄어든다.
  function wireTap(cell: Cell): void {
    const part = board.get(cell.r, cell.c);
    if (part?.kind === 'input') {
      if (wireFrom && same(wireFrom, cell)) board.setWire(cell, []);
      else wireFrom = cell;
      return refresh();
    }
    if (!wireFrom) return showText('먼저 와이어를 그릴 입력 파츠를 누른다.');
    const path = board.wire(wireFrom);
    if (path.length > 0 && same(cell, path[path.length - 1])) {
      board.setWire(wireFrom, path.slice(0, -1));
    } else if (!board.setWire(wireFrom, [...path, cell])) {
      refresh();
      return showText('여기는 이을 수 없다. 빛나는 칸만 이을 수 있다.');
    }
    refresh();
  }

  function wireCandidates(): Cell[] {
    if (!wireFrom) return [];
    const path = board.wire(wireFrom);
    const end = path.length > 0 ? path[path.length - 1] : wireFrom;
    return [
      { r: end.r - 1, c: end.c },
      { r: end.r + 1, c: end.c },
      { r: end.r, c: end.c - 1 },
      { r: end.r, c: end.c + 1 },
    ].filter((p) => board.inBounds(p.r, p.c) && board.canWire(wireFrom!, [...path, p]));
  }

  function hoverMove(d: Drag, cell: Cell): void {
    d.last = cell;
    d.dragged = !same(cell, d.start);
    clearDrop();
    if (d.dragged) {
      cellEls[cell.r][cell.c].classList.add(board.get(cell.r, cell.c) ? 'drop-bad' : 'drop');
    }
  }

  function clearDrop(): void {
    for (const row of cellEls) for (const el of row) el.classList.remove('drop', 'drop-bad');
  }

  function onTap(cell: Cell): void {
    if (wiring) return wireTap(cell);
    const part = board.get(cell.r, cell.c);
    if (selected) {
      board.set(cell.r, cell.c, selected);
    } else if (picked && same(picked, cell)) {
      picked = null;
    } else if (picked && !part) {
      board.move(picked, cell);
      picked = cell;
    } else {
      picked = part ? cell : null;
    }
    refresh();
  }

  function removePicked(): void {
    if (!picked) return;
    board.set(picked.r, picked.c, null);
    picked = null;
    refresh();
  }

  function load(preset: Preset): void {
    board.clear();
    for (const [r, c, id] of preset.parts) board.set(r, c, id);
    for (const [[r, c], path] of preset.wires) {
      board.setWire({ r, c }, path.map(([pr, pc]) => ({ r: pr, c: pc })));
    }
    picked = null;
    selected = null;
    wiring = false;
    wireFrom = null;
    refresh();
  }

  function refresh(): void {
    if (picked && !board.get(picked.r, picked.c)) picked = null;
    if (wireFrom && board.get(wireFrom.r, wireFrom.c)?.kind !== 'input') wireFrom = null;
    const candidates = wiring ? wireCandidates() : [];
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const el = cellEls[r][c];
        const part = board.get(r, c);
        const isPicked = !!picked && picked.r === r && picked.c === c;
        const isSource = wiring && !!wireFrom && wireFrom.r === r && wireFrom.c === c;
        const canWire = candidates.some((p) => p.r === r && p.c === c);
        el.className =
          `cell${part ? ` kind-${part.kind}` : ''}${isPicked ? ' picked' : ''}` +
          `${isSource ? ' wire-src' : ''}${canWire ? ' can-wire' : ''}`;
        el.replaceChildren();
        if (part) el.append(span('icon', part.icon), span('name', part.name));
        if (isPicked) {
          const del = document.createElement('button');
          del.className = 'del';
          del.textContent = '✕';
          del.title = '지우기';
          // 파츠를 고른 탭의 뒤늦은 click이 새로 생긴 ✕에 닿아 바로 지워지지 않게, ✕에서 시작한 누름만 받는다.
          let armed = false;
          del.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            armed = true;
          });
          del.addEventListener('click', () => {
            if (armed) removePicked();
          });
          el.appendChild(del);
        }
      }
    }
    for (const [id, tile] of tiles) tile.classList.toggle('selected', id === selected);
    roots.wire.textContent = wiring ? '배선 완료' : '배선';
    roots.wire.classList.toggle('active', wiring);
    roots.board.classList.toggle('wiring', wiring);
    drawWires();
    showInfo();
  }

  function showInfo(): void {
    if (wiring) {
      if (!wireFrom) {
        return showText('배선 중: 와이어를 그릴 입력 파츠를 누른다. 입력 파츠에서 끌어서 그려도 된다. 끝나면 배선 완료를 누른다.');
      }
      const name = board.get(wireFrom.r, wireFrom.c)!.name;
      return showText(
        `배선 중: ${name} 와이어 ${board.wire(wireFrom).length}/${MAX_WIRE}칸. 빛나는 칸을 눌러 잇고, 마지막 칸을 다시 누르면 한 칸 줄어든다. 입력 파츠를 다시 누르면 와이어를 지운다.`,
      );
    }
    if (picked) {
      const part = board.get(picked.r, picked.c)!;
      const extra = part.kind === 'input' ? inputSummary(picked) : [];
      const hint =
        part.kind === 'input'
          ? '끌거나 빈 칸을 눌러 옮긴다(와이어는 새로 그린다). ✕로 지운다. 와이어는 위의 배선 버튼으로 그린다.'
          : '끌거나 빈 칸을 눌러 옮긴다. ✕로 지운다.';
      return showPart(part, extra, hint);
    }
    if (selected) return showPart(PART_BY_ID.get(selected)!, [], '판의 칸을 눌러 놓는다.');
    showText('아래에서 파츠를 고르고 판의 칸을 눌러 놓는다. 놓인 파츠를 누르면 수치를 보고 옮기거나 지울 수 있다.');
  }

  function inputSummary(cell: Cell): string[] {
    const part = board.get(cell.r, cell.c)!;
    const a = activate(board, cell)!.attack;
    const cd = intervalOf(board, cell);
    const every =
      part.trigger === 'move' ? `${Math.round(cd * PLAYER_SPEED)}px 움직일 때마다` : `${cd.toFixed(2)}초마다`;
    const form = a.laser ? '레이저' : '투사체';
    return [
      `지금 이 입력의 공격: ${form} ${a.count}발, 피해 ${a.damage.toFixed(1)}, ${every}`,
      `와이어 ${board.wire(cell).length}/${MAX_WIRE}칸`,
    ];
  }

  function showPart(part: PartDef, extra: string[], hint: string): void {
    const title = document.createElement('div');
    title.className = 'info-title';
    title.append(span('info-name', part.name), span('info-kind', KIND_NAME[part.kind]));
    const list = document.createElement('ul');
    for (const line of [...statLines(part), ...extra]) {
      const li = document.createElement('li');
      li.textContent = line;
      list.appendChild(li);
    }
    const desc = document.createElement('p');
    desc.textContent = `${part.desc} ${hint}`;
    roots.info.replaceChildren(title, list, desc);
  }

  function showText(text: string): void {
    const p = document.createElement('p');
    p.textContent = text;
    roots.info.replaceChildren(p);
  }

  function drawWires(): void {
    paths.replaceChildren();
    for (const input of board.inputs()) {
      const path = board.wire(input);
      if (path.length === 0) continue;
      const line = document.createElementNS(SVG_NS, 'polyline');
      line.setAttribute('points', [input, ...path].map(center).join(' '));
      line.setAttribute('marker-end', 'url(#wire-head)');
      paths.appendChild(line);
    }
  }

  function cellAt(e: PointerEvent): Cell | null {
    const rect = grid.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * board.cols);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * board.rows);
    return board.inBounds(r, c) ? { r, c } : null;
  }

  function center(p: Cell): string {
    return `${p.c * UNIT + UNIT / 2},${p.r * UNIT + UNIT / 2}`;
  }

  function same(a: Cell, b: Cell): boolean {
    return a.r === b.r && a.c === b.c;
  }

  function span(cls: string, text: string): HTMLSpanElement {
    const el = document.createElement('span');
    el.className = cls;
    el.textContent = text;
    return el;
  }

  load(PRESETS[0]);
}
