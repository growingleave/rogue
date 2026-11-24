import './style.css';
import { Board } from './board';
import { Game } from './game';
import { Input } from './input';
import { mountUI } from './ui';

const $ = (id: string) => document.getElementById(id)!;

const canvas = $('arena') as HTMLCanvasElement;
const board = new Board(4, 4);
const game = new Game(canvas, new Input(canvas), board);

mountUI(
  { board: $('board'), palette: $('palette'), presets: $('presets'), info: $('info') },
  board,
  game,
);

new ResizeObserver(() => game.resize()).observe(canvas);

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
