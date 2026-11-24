import { MAX_WIRE, intervalOf, type Board, type Cell } from './board';
import type { Game } from './game';
import { PARTS, PART_BY_ID, type PartDef, type PartKind } from './parts';

const ERASE = 'erase';
const SVG_NS = 'http://www.w3.org/2000/svg';
const UNIT = 100;
const IDLE_TEXT = '파츠를 고르고 칸을 눌러 놓는다. 입력 파츠를 누른 채 옆 칸으로 끌면 와이어가 이어진다.';

const GROUPS: { title: string; kinds: PartKind[] }[] = [
  { title: '입력 파츠', kinds: ['input'] },
  { title: '효과 파츠', kinds: ['effect'] },
  { title: '강화 파츠', kinds: ['boost'] },
];

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
  presets: HTMLElement;
  info: HTMLElement;
}

interface Drag {
  pointerId: number;
  start: Cell;
  last: Cell;
  wiring: boolean;
  dragged: boolean;
  path: Cell[];
}

export function mountUI(roots: UIRoots, board: Board, game: Game): void {
  let selected: string | null = null;
  let drag: Drag | null = null;
  const cellEls: HTMLDivElement[][] = [];

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

  grid.addEventListener('pointerdown', (e) => {
    const cell = cellAt(e);
    if (!cell || drag) return;
    const wiring = board.get(cell.r, cell.c)?.kind === 'input';
    drag = { pointerId: e.pointerId, start: cell, last: cell, wiring, dragged: false, path: [] };
    grid.setPointerCapture(e.pointerId);
  });

  grid.addEventListener('pointermove', (e) => {
    if (drag?.pointerId !== e.pointerId || !drag.wiring) return;
    const cell = cellAt(e);
    if (!cell || same(cell, drag.last)) return;
    const back = drag.path.length >= 2 ? drag.path[drag.path.length - 2] : drag.start;
    if (drag.path.length > 0 && same(cell, back)) {
      drag.path.pop();
    } else if (board.canWire(drag.start, [...drag.path, cell])) {
      drag.path.push(cell);
    } else {
      return;
    }
    drag.last = cell;
    drag.dragged = true;
    board.setWire(drag.start, drag.path);
    drawWires();
    say(`와이어 ${drag.path.length}/${MAX_WIRE}칸. 지나온 칸으로 되돌아가면 와이어가 줄어든다.`);
  });

  const endDrag = (e: PointerEvent) => {
    if (drag?.pointerId !== e.pointerId) return;
    const { start, dragged } = drag;
    drag = null;
    if (!dragged) onTap(start);
  };
  grid.addEventListener('pointerup', endDrag);
  grid.addEventListener('pointercancel', (e) => {
    if (drag?.pointerId === e.pointerId) drag = null;
  });

  for (const group of GROUPS) {
    const title = document.createElement('h3');
    title.textContent = group.title;
    const row = document.createElement('div');
    row.className = 'chips';
    for (const part of PARTS.filter((p) => group.kinds.includes(p.kind))) {
      row.appendChild(chip(part.id, part.icon, part.name, `kind-${part.kind}`));
    }
    roots.palette.append(title, row);
  }
  const tools = document.createElement('div');
  tools.className = 'chips';
  tools.appendChild(chip(ERASE, '✕', '지우개', 'kind-erase'));
  roots.palette.appendChild(tools);

  for (const preset of PRESETS) {
    roots.presets.appendChild(
      button(preset.name, () => {
        load(preset);
        say(`'${preset.name}' 배치를 불러왔다.`);
      }),
    );
  }
  roots.presets.appendChild(
    button('비우기', () => {
      board.clear();
      refresh();
      say('판을 비웠다.');
    }),
  );

  game.onActivate = (cells) => {
    cells.forEach((p, i) => {
      const el = cellEls[p.r][p.c];
      el.classList.remove('pulse');
      void el.offsetWidth;
      el.style.animationDelay = `${i * 45}ms`;
      el.classList.add('pulse');
    });
  };

  function cellAt(e: PointerEvent): Cell | null {
    const rect = grid.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * board.cols);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * board.rows);
    return board.inBounds(r, c) ? { r, c } : null;
  }

  function onTap(cell: Cell): void {
    const { r, c } = cell;
    if (selected === ERASE) {
      board.set(r, c, null);
      refresh();
      return;
    }
    if (selected) {
      board.set(r, c, selected);
      refresh();
      return;
    }
    const part = board.get(r, c);
    if (!part) say('빈 칸이다. 아래에서 파츠를 고른 뒤 눌러 놓는다.');
    else if (part.kind === 'input') say(inputInfo(part, cell));
    else say(`${part.name}: ${part.desc}`);
  }

  function inputInfo(part: PartDef, cell: Cell): string {
    const v = intervalOf(board, cell);
    const every = part.trigger === 'move' ? `${Math.round(v)}px 이동마다` : `${v.toFixed(2)}초마다`;
    return `${part.name}: ${part.desc} 지금은 ${every} 발동. 와이어 ${board.wire(cell).length}/${MAX_WIRE}칸.`;
  }

  function chip(id: string, icon: string, name: string, cls: string): HTMLButtonElement {
    const el = button('', () => {
      selected = selected === id ? null : id;
      for (const other of roots.palette.querySelectorAll('.chip')) {
        other.classList.toggle('selected', other === el && selected === id);
      }
      if (!selected) say(IDLE_TEXT);
      else if (selected === ERASE) say('지우개: 판의 칸을 눌러 파츠를 뺀다. 입력 파츠를 빼면 그 와이어도 사라진다.');
      else say(`${name}: ${PART_BY_ID.get(id)!.desc} 판의 칸을 눌러 놓는다.`);
    });
    el.classList.add('chip', cls);
    el.innerHTML = `<span class="icon"></span><span class="name"></span>`;
    el.querySelector('.icon')!.textContent = icon;
    el.querySelector('.name')!.textContent = name;
    return el;
  }

  function load(preset: Preset): void {
    board.clear();
    for (const [r, c, id] of preset.parts) board.set(r, c, id);
    for (const [[r, c], path] of preset.wires) {
      board.setWire({ r, c }, path.map(([pr, pc]) => ({ r: pr, c: pc })));
    }
    refresh();
  }

  function refresh(): void {
    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const el = cellEls[r][c];
        const part = board.get(r, c);
        el.className = `cell${part ? ` kind-${part.kind}` : ''}`;
        el.innerHTML = part ? `<span class="icon"></span><span class="name"></span>` : '';
        if (part) {
          el.querySelector('.icon')!.textContent = part.icon;
          el.querySelector('.name')!.textContent = part.name;
        }
      }
    }
    drawWires();
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

  function center(p: Cell): string {
    return `${p.c * UNIT + UNIT / 2},${p.r * UNIT + UNIT / 2}`;
  }

  function same(a: Cell, b: Cell): boolean {
    return a.r === b.r && a.c === b.c;
  }

  function say(text: string): void {
    roots.info.textContent = text;
  }

  function button(label: string, onClick: () => void): HTMLButtonElement {
    const el = document.createElement('button');
    el.textContent = label;
    el.addEventListener('click', onClick);
    return el;
  }

  load(PRESETS[0]);
  say(IDLE_TEXT);
}
