import { arrowCells, cooldownOf, type Board, type Cell } from './board';
import type { Game } from './game';
import { PARTS, PART_BY_ID, type PartKind } from './parts';

const ERASE = 'erase';
const SVG_NS = 'http://www.w3.org/2000/svg';
const UNIT = 100;
const EDGE_OFFSET = 42;

const GROUPS: { title: string; kinds: PartKind[] }[] = [
  { title: '출력 파츠', kinds: ['output'] },
  { title: '효과 파츠', kinds: ['effect'] },
  { title: '강화·중계 파츠', kinds: ['boost', 'relay'] },
];

const PRESETS: { name: string; cells: [number, number, string][] }[] = [
  { name: '저격총', cells: [[1, 0, 'out-right'], [1, 1, 'sniper']] },
  { name: '샷건', cells: [[1, 0, 'out-right'], [1, 1, 'shotgun']] },
  { name: '기관총', cells: [[1, 0, 'out-right'], [1, 1, 'rapid']] },
  {
    name: '연쇄 예시',
    cells: [
      [0, 0, 'out-down'],
      [1, 0, 'relay-right'],
      [1, 1, 'shotgun'],
      [1, 2, 'explode'],
      [2, 0, 'split'],
      [0, 1, 'boost'],
    ],
  },
];

export interface UIRoots {
  board: HTMLElement;
  palette: HTMLElement;
  presets: HTMLElement;
  info: HTMLElement;
}

export function mountUI(roots: UIRoots, board: Board, game: Game): void {
  let selected: string | null = null;
  const cellEls: HTMLButtonElement[][] = [];

  const grid = document.createElement('div');
  grid.className = 'board';
  grid.style.gridTemplateColumns = `repeat(${board.cols}, 1fr)`;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('arrows');
  svg.setAttribute('viewBox', `0 0 ${board.cols * UNIT} ${board.rows * UNIT}`);
  svg.innerHTML = `<defs>
    <marker id="head-output" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#4fe3ff"/></marker>
    <marker id="head-relay" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#ffd35c"/></marker>
  </defs><g class="paths"></g>`;
  const paths = svg.querySelector('.paths')!;

  for (let r = 0; r < board.rows; r++) {
    cellEls.push([]);
    for (let c = 0; c < board.cols; c++) {
      const el = document.createElement('button');
      el.className = 'cell';
      el.addEventListener('click', () => onCell(r, c));
      grid.appendChild(el);
      cellEls[r].push(el);
    }
  }
  roots.board.append(grid, svg);

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
        board.clear();
        for (const [r, c, id] of preset.cells) board.set(r, c, id);
        refresh();
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
    for (const p of cells) {
      const el = cellEls[p.r][p.c];
      el.classList.remove('pulse');
      void el.offsetWidth;
      el.classList.add('pulse');
    }
  };

  function chip(id: string, icon: string, name: string, cls: string): HTMLButtonElement {
    const el = button('', () => {
      selected = selected === id ? null : id;
      for (const other of roots.palette.querySelectorAll('.chip')) {
        other.classList.toggle('selected', other === el && selected === id);
      }
      if (!selected) say('파츠를 고르거나, 판의 파츠를 눌러 설명을 본다.');
      else if (selected === ERASE) say('지우개: 판의 칸을 눌러 파츠를 뺀다.');
      else say(`${name}: ${PART_BY_ID.get(id)!.desc} 판의 칸을 눌러 놓는다.`);
    });
    el.classList.add('chip', cls);
    el.innerHTML = `<span class="icon"></span><span class="name"></span>`;
    el.querySelector('.icon')!.textContent = icon;
    el.querySelector('.name')!.textContent = name;
    return el;
  }

  function onCell(r: number, c: number): void {
    if (selected === ERASE) {
      board.set(r, c, null);
    } else if (selected) {
      board.set(r, c, selected);
    } else {
      const part = board.get(r, c);
      if (!part) {
        say('빈 칸이다. 아래에서 파츠를 고른 뒤 눌러 놓는다.');
      } else if (part.kind === 'output') {
        say(`${part.name}: ${part.desc} 현재 발사 간격 ${cooldownOf(board, { r, c }).toFixed(2)}초.`);
      } else {
        say(`${part.name}: ${part.desc}`);
      }
      return;
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
    drawArrows();
  }

  function drawArrows(): void {
    paths.replaceChildren();
    for (const { r, c, part } of board.entries()) {
      if (!part.dir || (part.kind !== 'output' && part.kind !== 'relay')) continue;
      const range = arrowCells(part.dir, { r, c }, board.rows, board.cols);
      if (range.length === 0) continue;
      const pts = part.dir === 'cw' ? range : [{ r, c }, range[range.length - 1]];
      // 직선 화살표는 칸의 가장자리 쪽으로 비켜 그려 파츠 글자를 가리지 않게 한다.
      const horizontal = part.dir === 'left' || part.dir === 'right';
      const ox = part.dir === 'cw' || horizontal ? 0 : EDGE_OFFSET;
      const oy = horizontal ? EDGE_OFFSET : 0;
      const line = document.createElementNS(SVG_NS, 'polyline');
      line.setAttribute('points', pts.map((p) => center(p, ox, oy)).join(' '));
      line.setAttribute('class', `path-${part.kind}`);
      line.setAttribute('marker-end', `url(#head-${part.kind})`);
      paths.appendChild(line);
    }
  }

  function center(p: Cell, ox = 0, oy = 0): string {
    return `${p.c * UNIT + UNIT / 2 + ox},${p.r * UNIT + UNIT / 2 + oy}`;
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

  board.clear();
  for (const [r, c, id] of PRESETS[0].cells) board.set(r, c, id);
  refresh();
  say('파츠를 고르거나, 판의 파츠를 눌러 설명을 본다.');
}
