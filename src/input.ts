const JOY_RADIUS = 50;

const KEY_DIRS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export interface Joystick {
  pointerId: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

export class Input {
  joy: Joystick | null = null;
  private keys = new Set<string>();

  constructor(private area: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!(e.code in KEY_DIRS)) return;
      this.keys.add(e.code);
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    area.addEventListener('pointerdown', (e) => {
      if (this.joy) return;
      const p = this.local(e);
      this.joy = { pointerId: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
      area.setPointerCapture(e.pointerId);
    });
    area.addEventListener('pointermove', (e) => {
      if (this.joy?.pointerId !== e.pointerId) return;
      const p = this.local(e);
      this.joy.x = p.x;
      this.joy.y = p.y;
    });
    const end = (e: PointerEvent) => {
      if (this.joy?.pointerId === e.pointerId) this.joy = null;
    };
    area.addEventListener('pointerup', end);
    area.addEventListener('pointercancel', end);
  }

  move(): { x: number; y: number } {
    if (this.joy) {
      const dx = this.joy.x - this.joy.ox;
      const dy = this.joy.y - this.joy.oy;
      const len = Math.hypot(dx, dy);
      if (len < 6) return { x: 0, y: 0 };
      const k = Math.min(len, JOY_RADIUS) / JOY_RADIUS / len;
      return { x: dx * k, y: dy * k };
    }
    let x = 0;
    let y = 0;
    for (const code of this.keys) {
      x += KEY_DIRS[code][0];
      y += KEY_DIRS[code][1];
    }
    const len = Math.hypot(x, y);
    return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }

  get joyRadius(): number {
    return JOY_RADIUS;
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const rect = this.area.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
}
