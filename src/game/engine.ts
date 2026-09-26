import {
  CANNON_Y,
  CELL,
  DRIFT_AMPLITUDE,
  DRIFT_PERIOD_S,
  GRID_BOTTOM,
  GRID_LEFT,
  GRID_RIGHT,
  GRID_SIZE,
  GRID_TOP,
  H,
  W,
  cellCenterX,
  cellCenterY,
  clamp,
  coordKey,
} from './grid';
import { buildLetterGrid } from './letters';
import { REDESIGN } from './ruleset';
import type { Coord, MissReason, Round, ScanResult, ShotRejection } from './types';

export interface EngineHandlers {
  onInput: () => void;
  onFire: () => void;
  onFireBlocked: () => void;
  onCorrectHit: (x: number, y: number) => void;
  onWrongHit: (x: number, y: number, reason: MissReason) => void;
  /** Redesign rules: a shot was refused or deflected without touching a cell. */
  onShotRejected: (rejection: ShotRejection) => void;
  /** Redesign rules: a grid cell was clicked (used for pencil marks). */
  onCellClick: (x: number, y: number) => void;
  onFlakHit: () => void;
  onLinesDrawn: () => void;
  onGuideDrawn: () => void;
  onFinaleHit: () => void;
  /** 'off-column': hit the ship away from the target column. 'passed': it crossed unhit. */
  onFinaleMiss: (kind: 'off-column' | 'passed') => void;
}

interface Bullet {
  x: number;
  y: number;
  row: number;
  /**
   * Redesign rules: the bullet's grid-local x, so it rides the sway and lands in the column it
   * was fired at. Null for classic shots, which resolve against wherever the grid is on arrival.
   */
  gridX: number | null;
  /** Redesign rules: column and row were on the armed cell when SPACE was pressed. */
  locked: boolean;
  aim: Coord | null;
  target: Coord | null;
}

type CellState = 'alive' | 'dead' | 'star';

interface Cell {
  x: number;
  y: number;
  state: CellState;
  spawnAt: number;
  respawnAt: number;
  flashUntil: number;
  starAt: number;
  phase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Guide {
  /** Grid-local coordinates (before drift). */
  from: [number, number];
  to: [number, number];
  dragging: boolean;
}

const ALIEN_FRAMES = [
  ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'],
  ['..X.....X..', 'X..X...X..X', 'X.XXXXXXX.X', 'XXX.XXX.XXX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..X.....X..', '.X.......X.'],
];
/**
 * Nuvi, the Nuevo Foundation mascot, redrawn from the pixel-art Nuvi in the Python Pixel workshop
 * (NuevoFoundation/workshops, content/english/python-pixel/media/pixel-nuvi.png). X is the body in
 * the sector color, D a darker shade, V the visor, E the eyes. Frame 2 raises the arms and rolls the wheel.
 */
const NUVI_FRAMES = [
  [
    '.......XXXXX.......',
    '.....XXXXXXXXX.....',
    '..XXXXXXXXXXXXXXX..',
    '..XVVVVVVVVVVVVVXDD',
    '.XXVVEVVVVVVVEVVXDD',
    '.XXVVEVVVVVVVEVVXDD',
    '..XVVVVVVVVVVVVVXDD',
    '..XXXXXXXXXXXXXXX..',
    '........DDD........',
    '......XXXXXXX......',
    '.....XXXXXXXXX.....',
    'XXDDXXXXXXXXXXXDDXX',
    'XX..XXXXXXXXXXX..XX',
    '.....XXXXXXXXX.....',
    '......DDVDDDD......',
  ],
  [
    '.......XXXXX.......',
    '.....XXXXXXXXX.....',
    '..XXXXXXXXXXXXXXX..',
    '..XVVVVVVVVVVVVVXDD',
    '.XXVVEVVVVVVVEVVXDD',
    '.XXVVEVVVVVVVEVVXDD',
    '..XVVVVVVVVVVVVVXDD',
    '..XXXXXXXXXXXXXXX..',
    '........DDD........',
    'XX....XXXXXXX....XX',
    'XXDDDXXXXXXXXXDDDXX',
    '....XXXXXXXXXXX....',
    '....XXXXXXXXXXX....',
    '.....XXXXXXXXX.....',
    '......DDDDVDD......',
  ],
];
const SHIP_FRAME = ['.....XXXXXX.....', '...XXXXXXXXXX...', '..XXXXXXXXXXXX..', '.XX.XX.XX.XX.XX.', 'XXXXXXXXXXXXXXXX', '..XXX..XX..XXX..', '...X........X...'];
const ALIEN_PX = 5;
const NUVI_PX = 3;
/** Grid sprites: Nuvi under the redesign, the original invaders with ?rules=classic. */
const ENEMY_FRAMES = REDESIGN ? NUVI_FRAMES : ALIEN_FRAMES;
const ENEMY_PX = REDESIGN ? NUVI_PX : ALIEN_PX;
const VISOR_COLOR = '#04070f';
const EYE_COLOR = '#ffc93c';
const SHIP_PX = 5;
const SPRITE_PAD = 14;
const BULLET_SPEED = 1100;
const FLAK_SPEED = 210;
const CANNON_SPEED = 520;
const RESPAWN_S = 3;
const LOCKOUT_S = 2;
/** Redesign rules: cooldown after a shot fired without LOCK is deflected. */
export const DEFLECT_COOLDOWN_S = 1.5;
/** Pointer travel (CSS px) under which a press on the grid counts as a click, not a drag. */
const CLICK_SLOP_PX = 6;
const LINE_DRAW_S = 1.4;
const SHIP_Y = 30;
const SHIP_SPEED = 170;
const SHIP_RESPAWN_S = 5;
const STAR_COLOR = '#e8fbff';
const LINE_COLOR = '#35f0ff';
const GUIDE_COLOR = '#ffd166';
const MARK_COLOR = '#9fe8ff';
const SHIP_COLOR = '#ff5cf0';
const FONT = '"Press Start 2P", monospace';

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

function makeSprite(frame: string[], color: string, px = ALIEN_PX): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = frame[0].length * px + SPRITE_PAD * 2;
  c.height = frame.length * px + SPRITE_PAD * 2;
  const ctx = c.getContext('2d')!;
  // One pass per palette key. Invader and ship frames only use X, so they render exactly as before.
  const paint = (key: string, fill: string, glow: number, alpha = 1) => {
    ctx.shadowColor = fill;
    ctx.shadowBlur = glow;
    ctx.fillStyle = fill;
    ctx.globalAlpha = alpha;
    frame.forEach((row, ry) =>
      [...row].forEach((ch, rx) => {
        if (ch === key) ctx.fillRect(SPRITE_PAD + rx * px, SPRITE_PAD + ry * px, px, px);
      }),
    );
  };
  paint('X', color, 10);
  paint('D', color, 0, 0.5);
  paint('V', VISOR_COLOR, 0);
  paint('E', EYE_COLOR, 6);
  return c;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private handlers: EngineHandlers;
  private resizeObserver: ResizeObserver;
  private raf = 0;
  private lastTs = 0;
  private time = 0;
  private scale = 1;
  private pixelRatio = 1;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private round: Round | null = null;
  private targets = new Set<string>();
  private letters = new Map<string, string>();
  private revealed = new Set<string>();
  private hitCount = 0;
  private cells: Cell[] = [];
  private sprites: HTMLCanvasElement[] = [];
  private redSprites: HTMLCanvasElement[] = [];
  private shipSprite: HTMLCanvasElement;

  /** Horizontal sway of the whole grid, in logical pixels. */
  private drift = 0;
  /** Fraction of DRIFT_AMPLITUDE used this round, and when this round's sway began. */
  private swayAmount = 1;
  private swayStart = 0;
  private roundFlak = true;
  private keys = new Set<string>();
  private cannonX = cellCenterX(1);
  private rangeRow = 1;
  private bullet: Bullet | null = null;
  private flak: { x: number; y: number }[] = [];
  private nextFlakAt = 3;
  private particles: Particle[] = [];

  private inputEnabled = true;
  private flakEnabled = false;
  private lockoutUntil = 0;
  private lockoutLabel = 'WEAPONS OFFLINE';
  private shakeUntil = 0;
  private vignetteUntil = 0;
  private armed: Coord | null = null;
  private armedScan: ScanResult = null;
  private marks: string[] = [];
  private pendingClick: { x: number; y: number; px: number; py: number } | null = null;
  private showTargets = false;
  private banner: string | null = null;
  private linesStart: number | null = null;
  private linesDone = false;
  private guide: Guide | null = null;

  private finaleActive = false;
  private ship: { x: number; active: boolean; nextAt: number } = { x: -100, active: false, nextAt: 0 };

  constructor(canvas: HTMLCanvasElement, handlers: EngineHandlers) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.handlers = handlers;
    this.redSprites = ENEMY_FRAMES.map((f) => makeSprite(f, '#ff2a2a', ENEMY_PX));
    this.shipSprite = makeSprite(SHIP_FRAME, SHIP_COLOR, SHIP_PX);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement!);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onWindowResize);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.resizeTimer);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onWindowResize);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  }

  // The stage is CSS-scaled on window resize, which ResizeObserver does not report.
  private resizeTimer = 0;
  private onWindowResize = () => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.resize(), 120);
  };

  loadRound(round: Round) {
    this.round = round;
    this.targets = new Set(round.targets.map(([x, y]) => coordKey(x, y)));
    this.letters = buildLetterGrid(round);
    this.revealed = new Set();
    this.hitCount = 0;
    this.sprites = ENEMY_FRAMES.map((f) => makeSprite(f, round.alienColor, ENEMY_PX));
    this.cells = [];
    for (let y = 1; y <= GRID_SIZE; y++) {
      for (let x = 1; x <= GRID_SIZE; x++) {
        this.cells.push({
          x,
          y,
          state: 'alive',
          spawnAt: this.time + (GRID_SIZE - y) * 0.06 + x * 0.02,
          respawnAt: 0,
          flashUntil: 0,
          starAt: 0,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
    this.bullet = null;
    this.flak = [];
    this.particles = [];
    this.nextFlakAt = this.time + 3;
    this.linesStart = null;
    this.linesDone = false;
    this.armed = null;
    this.armedScan = null;
    this.rangeRow = 1;
    this.lockoutUntil = 0;
    this.pendingClick = null;
    this.guide = null;
    this.finaleActive = false;
    this.ship = { x: -100, active: false, nextAt: 0 };
    // Classic rules keep the original always-on, full-size sway on the global clock.
    this.swayAmount = REDESIGN ? clamp(round.sway ?? 1, 0, 1) : 1;
    this.swayStart = REDESIGN ? this.time : 0;
    this.roundFlak = !REDESIGN || round.flak !== false;
  }

  setInputEnabled(enabled: boolean) {
    this.inputEnabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.flak = [];
      this.pendingClick = null;
      if (this.guide?.dragging) this.guide = null;
    }
  }

  /** `scan` colors the armed cell: in the constellation plane, not in it, or unscanned. */
  setArmed(coord: Coord | null, scan: ScanResult = null) {
    this.armed = coord;
    this.armedScan = scan;
    // Under the redesign the team sets the row by hand, so arming only highlights the cell.
    if (coord && !REDESIGN) this.rangeRow = coord[1];
  }

  /** Pencil-marked cells ("x,y"), in placement order. */
  setMarks(keys: string[]) {
    this.marks = keys;
  }

  /** Cells whose letters have been revealed by SCAN. */
  setRevealed(keys: string[]) {
    this.revealed = new Set(keys);
  }

  setShowTargets(show: boolean) {
    this.showTargets = show;
  }

  /** Flak only starts once the crew has begun playing. */
  setFlakEnabled(enabled: boolean) {
    if (enabled && !this.flakEnabled) this.nextFlakAt = this.time + 2;
    this.flakEnabled = enabled;
  }

  setBanner(text: string | null) {
    this.banner = text;
  }

  drawLines() {
    this.linesStart = this.time;
    this.linesDone = false;
  }

  /** Show every line immediately (used when returning to the grid after the reveal). */
  showLinesComplete() {
    this.linesStart = this.time - LINE_DRAW_S;
    this.linesDone = true;
  }

  /** Screen shake + red vignette, used when shields are depleted. */
  alarm() {
    this.shakeUntil = this.time + 0.7;
    this.vignetteUntil = this.time + 1.6;
  }

  startFinale() {
    this.finaleActive = true;
    this.bullet = null;
    this.flak = [];
    this.ship = { x: -100, active: false, nextAt: this.time + 1.2 };
  }

  stopFinale() {
    this.finaleActive = false;
    this.ship.active = false;
  }

  // ---------------------------------------------------------------- input

  private onKeyDown = (e: KeyboardEvent) => {
    if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const gameKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', ' '];
    if (!gameKeys.includes(k)) return;
    e.preventDefault();
    if (!this.inputEnabled) return;
    this.handlers.onInput();
    this.keys.add(k);
    if (k === 'ArrowUp' || k === 'w') this.rangeRow = clamp(this.rangeRow + 1, 1, GRID_SIZE);
    if (k === 'ArrowDown' || k === 's') this.rangeRow = clamp(this.rangeRow - 1, 1, GRID_SIZE);
    if (k === ' ' && !e.repeat) this.fire();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    this.keys.delete(k);
  };

  private onBlur = () => this.keys.clear();

  /** Canvas pixel -> grid-local logical coordinates (drift removed). */
  private toGridLocal(e: PointerEvent): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    const lx = ((e.clientX - rect.left) / rect.width) * W;
    const ly = ((e.clientY - rect.top) / rect.height) * H;
    return [lx - this.drift, ly];
  }

  private get guideAvailable() {
    return !!this.round?.guideLine && this.hitCount > 0 && this.inputEnabled && !this.finaleActive;
  }

  /** Grid-local logical coordinates -> [column, row], or null outside the grid. */
  private cellFromGridLocal(gx: number, gy: number): Coord | null {
    const col = Math.floor((gx - GRID_LEFT) / CELL) + 1;
    const row = Math.floor((GRID_BOTTOM - gy) / CELL) + 1;
    return col >= 1 && col <= GRID_SIZE && row >= 1 && row <= GRID_SIZE ? [col, row] : null;
  }

  private onPointerDown = (e: PointerEvent) => {
    const [gx, gy] = this.toGridLocal(e);
    if (this.guideAvailable) {
      const star = this.cells.find(
        (c) => c.state === 'star' && Math.hypot(cellCenterX(c.x) - gx, cellCenterY(c.y) - gy) < CELL * 0.5,
      );
      if (star) {
        e.preventDefault();
        this.guide = { from: [cellCenterX(star.x), cellCenterY(star.y)], to: [gx, gy], dragging: true };
        return;
      }
    }
    if (!REDESIGN || !this.inputEnabled || this.finaleActive) return;
    const cell = this.cellFromGridLocal(gx, gy);
    if (cell) this.pendingClick = { x: cell[0], y: cell[1], px: e.clientX, py: e.clientY };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.guide?.dragging) return;
    this.guide.to = this.toGridLocal(e);
  };

  private onPointerUp = (e: PointerEvent) => {
    const click = this.pendingClick;
    this.pendingClick = null;
    if (click && Math.hypot(e.clientX - click.px, e.clientY - click.py) < CLICK_SLOP_PX) {
      this.handlers.onCellClick(click.x, click.y);
    }
    if (!this.guide?.dragging) return;
    const [fx, fy] = this.guide.from;
    const [tx, ty] = this.guide.to;
    if (Math.hypot(tx - fx, ty - fy) < CELL * 0.4) {
      this.guide = null;
      return;
    }
    this.guide.dragging = false;
    this.handlers.onGuideDrawn();
  };

  /** Column under a world-space x at the current drift, or null when outside the grid. */
  private columnAt(worldX: number) {
    const col = Math.floor((worldX - GRID_LEFT - this.drift) / CELL) + 1;
    return col >= 1 && col <= GRID_SIZE ? col : null;
  }

  /** Cell currently under the cannon at its range row, or null when the cannon is off the grid. */
  private aimCell(): Coord | null {
    const col = this.columnAt(this.cannonX);
    return col === null ? null : [col, this.rangeRow];
  }

  private isLocked() {
    const aim = this.aimCell();
    return !!this.armed && !!aim && aim[0] === this.armed[0] && aim[1] === this.armed[1];
  }

  private fire() {
    if (this.time < this.lockoutUntil) {
      this.handlers.onFireBlocked();
      return;
    }
    if (this.bullet) return;
    const y = CANNON_Y - 30;
    if (REDESIGN && !this.finaleActive) {
      if (!this.armed) {
        this.handlers.onFireBlocked();
        this.handlers.onShotRejected({ kind: 'no-target' });
        return;
      }
      // Lock is judged now, when SPACE is pressed; the bullet then rides the sway to that cell.
      this.bullet = {
        x: this.cannonX,
        y,
        row: this.rangeRow,
        gridX: this.cannonX - this.drift,
        locked: this.isLocked(),
        aim: this.aimCell(),
        target: this.armed,
      };
    } else {
      this.bullet = { x: this.cannonX, y, row: this.rangeRow, gridX: null, locked: false, aim: null, target: null };
    }
    this.handlers.onFire();
  }

  // ---------------------------------------------------------------- loop

  private resize() {
    const parent = this.canvas.parentElement!;
    const cssW = parent.clientWidth;
    const cssH = parent.clientHeight;
    if (!cssW || !cssH) return;
    this.scale = Math.min(cssW / W, cssH / H);
    // Parent may be CSS-transformed (stage scaling); render at the real on-screen resolution.
    const stageScale = parent.getBoundingClientRect().width / cssW || 1;
    this.pixelRatio = (window.devicePixelRatio || 1) * stageScale;
    this.canvas.style.width = `${W * this.scale}px`;
    this.canvas.style.height = `${H * this.scale}px`;
    this.canvas.width = Math.round(W * this.scale * this.pixelRatio);
    this.canvas.height = Math.round(H * this.scale * this.pixelRatio);
  }

  private frame = (ts: number) => {
    const dt = this.lastTs ? Math.min((ts - this.lastTs) / 1000, 0.05) : 0;
    this.lastTs = ts;
    this.time += dt;
    this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private cellAt(x: number, y: number) {
    return this.cells[(y - 1) * GRID_SIZE + (x - 1)];
  }

  private isAlive(c: Cell) {
    return c.state === 'alive' && this.time >= c.spawnAt;
  }

  private update(dt: number) {
    const t = this.time;
    this.drift = DRIFT_AMPLITUDE * this.swayAmount * Math.sin((2 * Math.PI * (t - this.swayStart)) / DRIFT_PERIOD_S);

    if (this.inputEnabled) {
      const left = this.keys.has('ArrowLeft') || this.keys.has('a');
      const right = this.keys.has('ArrowRight') || this.keys.has('d');
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      this.cannonX = clamp(this.cannonX + dir * CANNON_SPEED * dt, 50, W - 50);
    }

    for (const c of this.cells) {
      if (c.state === 'dead' && t >= c.respawnAt) {
        c.state = 'alive';
        c.spawnAt = t;
      }
    }

    if (this.bullet) {
      const b = this.bullet;
      b.y -= BULLET_SPEED * dt;
      if (b.gridX !== null) b.x = b.gridX + this.drift;
      if (this.finaleActive) {
        this.updateFinaleBullet(b);
      } else if (b.y <= cellCenterY(b.row)) {
        this.bullet = null;
        if (b.gridX !== null) {
          this.resolveLockedShot(b);
        } else {
          const col = this.columnAt(b.x);
          if (col === null) this.burst(b.x, b.y, 6, '#8899aa', 120);
          else this.resolveHit(col, b.row);
        }
      }
    }

    if (this.finaleActive) this.updateShip(dt);

    if (
      this.inputEnabled &&
      this.flakEnabled &&
      this.roundFlak &&
      !this.finaleActive &&
      t >= this.nextFlakAt &&
      this.flak.length < 3
    ) {
      const alive = this.cells.filter((c) => this.isAlive(c));
      if (alive.length) {
        const c = alive[Math.floor(Math.random() * alive.length)];
        this.flak.push({ x: cellCenterX(c.x) + this.drift, y: cellCenterY(c.y) + 20 });
      }
      this.nextFlakAt = t + 1.4 + Math.random() * 2.2;
    }
    for (const f of this.flak) f.y += FLAK_SPEED * dt;
    this.flak = this.flak.filter((f) => {
      const hit = Math.abs(f.x - this.cannonX) < 34 && f.y > CANNON_Y - 22 && f.y < CANNON_Y + 22;
      if (hit) this.onCannonHit();
      return !hit && f.y < H;
    });

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.linesStart !== null && !this.linesDone && t - this.linesStart >= LINE_DRAW_S) {
      this.linesDone = true;
      this.handlers.onLinesDrawn();
    }
  }

  /** Generous on purpose: the ship counts once any part of it overlaps the target column. */
  private shipOverTargetColumn() {
    const col = this.round?.finale?.column ?? 1;
    const left = GRID_LEFT + (col - 1) * CELL + this.drift;
    const slack = this.shipSprite.width / 2 - SPRITE_PAD - 12;
    return this.ship.x >= left - slack && this.ship.x <= left + CELL + slack;
  }

  private updateShip(dt: number) {
    const s = this.ship;
    if (!s.active) {
      if (this.time >= s.nextAt) {
        s.active = true;
        s.x = -80;
      }
      return;
    }
    s.x += SHIP_SPEED * dt;
    if (s.x > W + 80) {
      s.active = false;
      s.nextAt = this.time + SHIP_RESPAWN_S;
      this.handlers.onFinaleMiss('passed');
    }
  }

  private updateFinaleBullet(b: { x: number; y: number }) {
    const s = this.ship;
    const halfW = this.shipSprite.width / 2 - SPRITE_PAD;
    if (s.active && b.y <= SHIP_Y + 20 && b.y >= SHIP_Y - 24 && Math.abs(b.x - s.x) < halfW) {
      this.bullet = null;
      if (this.shipOverTargetColumn()) {
        s.active = false;
        this.finaleActive = false;
        this.burst(s.x, SHIP_Y, 60, SHIP_COLOR, 380);
        this.burst(s.x, SHIP_Y, 40, '#ffffff', 300);
        this.shakeUntil = this.time + 0.5;
        this.handlers.onFinaleHit();
      } else {
        this.burst(s.x, SHIP_Y, 16, '#8899aa', 160);
        s.active = false;
        s.nextAt = this.time + SHIP_RESPAWN_S;
        this.handlers.onFinaleMiss('off-column');
      }
      return;
    }
    if (b.y < -20) this.bullet = null;
  }

  /**
   * Redesign rules: a shot fired on LOCK always reaches the armed cell. Anything else is
   * deflected before it touches a cell, so aim errors reveal nothing and cost no shield.
   */
  private resolveLockedShot(b: Bullet) {
    if (!b.locked || !b.target) {
      this.burst(b.x, b.y, 18, '#ffb347', 200);
      this.burst(b.x, b.y, 8, '#ffffff', 120);
      this.lockoutUntil = this.time + DEFLECT_COOLDOWN_S;
      this.lockoutLabel = 'DEFLECTED';
      if (b.target) this.handlers.onShotRejected({ kind: 'deflected', aim: b.aim, target: b.target });
      return;
    }
    const [x, y] = b.target;
    const cell = this.cellAt(x, y);
    if (cell.state === 'dead') {
      this.burst(cellCenterX(x) + this.drift, cellCenterY(y), 6, '#8899aa', 120);
      this.handlers.onShotRejected({ kind: 'respawning', target: b.target });
      return;
    }
    this.resolveHit(x, y);
  }

  private resolveHit(x: number, y: number) {
    const cell = this.cellAt(x, y);
    const cx = cellCenterX(x) + this.drift;
    const cy = cellCenterY(y);
    if (!this.isAlive(cell)) {
      this.burst(cx, cy, 6, '#8899aa', 120);
      return;
    }
    const key = coordKey(x, y);
    const expected = this.round?.requireOrder ? this.round.targets[this.hitCount] : null;
    const inOrder = !expected || coordKey(expected[0], expected[1]) === key;
    if (this.targets.has(key) && inOrder) {
      cell.state = 'star';
      cell.starAt = this.time;
      this.hitCount++;
      this.burst(cx, cy, 28, this.round?.alienColor ?? '#fff', 260);
      this.burst(cx, cy, 16, STAR_COLOR, 180);
      this.handlers.onCorrectHit(x, y);
    } else {
      cell.state = 'dead';
      cell.flashUntil = this.time + 0.35;
      cell.respawnAt = this.time + RESPAWN_S;
      this.burst(cx, cy, 22, '#ff3030', 220);
      this.handlers.onWrongHit(x, y, this.targets.has(key) ? 'order' : 'miss');
    }
  }

  private onCannonHit() {
    this.lockoutUntil = this.time + LOCKOUT_S;
    this.lockoutLabel = 'WEAPONS OFFLINE';
    this.shakeUntil = this.time + 0.5;
    this.vignetteUntil = this.time + 0.9;
    this.burst(this.cannonX, CANNON_Y, 24, '#ff5522', 240);
    this.handlers.onFlakHit();
  }

  private burst(x: number, y: number, n: number, color: string, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const life = 0.4 + Math.random() * 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 60,
        life,
        maxLife: life,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }

  // ---------------------------------------------------------------- draw

  private draw() {
    const { ctx } = this;
    const k = this.scale * this.pixelRatio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    ctx.save();
    if (this.time < this.shakeUntil && !this.reducedMotion) {
      const m = 10 * ((this.shakeUntil - this.time) / 0.5);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    // Everything attached to the grid moves with the drift.
    ctx.save();
    ctx.translate(this.drift, 0);
    this.drawGrid();
    this.drawArmed();
    if (this.finaleActive) this.drawPointers();
    this.renderLines();
    this.drawGuide();
    this.drawCells();
    this.drawMarks();
    if (this.showTargets) this.drawStaffOverlay();
    this.drawRangeGridPart();
    ctx.restore();

    this.drawAimBeam();
    this.drawShip();
    this.drawProjectiles();
    this.drawParticles();
    this.drawCannon();
    ctx.restore();

    if (!this.finaleActive) this.drawLegend();
    if (this.banner) this.drawBanner(this.banner);
    if (this.time < this.vignetteUntil) this.drawVignette();
  }

  private drawGrid() {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(2, 6, 20, 0.55)';
    ctx.fillRect(GRID_LEFT - 12, GRID_TOP - 12, CELL * GRID_SIZE + 24, CELL * GRID_SIZE + 24);

    ctx.strokeStyle = 'rgba(170, 180, 200, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.moveTo(GRID_LEFT + i * CELL, GRID_TOP);
      ctx.lineTo(GRID_LEFT + i * CELL, GRID_BOTTOM);
      ctx.moveTo(GRID_LEFT, GRID_TOP + i * CELL);
      ctx.lineTo(GRID_RIGHT, GRID_TOP + i * CELL);
    }
    ctx.stroke();

    ctx.font = `22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 1; i <= GRID_SIZE; i++) {
      ctx.fillStyle = this.armed?.[0] === i ? '#35f0ff' : '#c8d2e6';
      ctx.fillText(String(i), cellCenterX(i), GRID_BOTTOM + 34);
      ctx.fillStyle = this.armed?.[1] === i ? '#35f0ff' : '#c8d2e6';
      ctx.fillText(String(i), GRID_LEFT - 40, cellCenterY(i));
    }
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = '#8ea0bf';
    ctx.textAlign = 'left';
    ctx.fillText('X', GRID_RIGHT + 18, GRID_BOTTOM + 34);
    this.arrow(GRID_RIGHT + 42, GRID_BOTTOM + 34, 'right');
    ctx.textAlign = 'center';
    ctx.fillText('Y', GRID_LEFT - 40, GRID_TOP - 34);
    this.arrow(GRID_LEFT - 40, GRID_TOP - 12, 'up');
  }

  private arrow(x: number, y: number, dir: 'up' | 'right') {
    const { ctx } = this;
    ctx.beginPath();
    if (dir === 'right') {
      ctx.fillRect(x, y - 2, 14, 4);
      ctx.moveTo(x + 14, y - 7);
      ctx.lineTo(x + 22, y);
      ctx.lineTo(x + 14, y + 7);
    } else {
      ctx.fillRect(x - 2, y - 2, 4, 12);
      ctx.moveTo(x - 7, y - 2);
      ctx.lineTo(x, y - 10);
      ctx.lineTo(x + 7, y - 2);
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawArmed() {
    if (!this.armed) return;
    const { ctx } = this;
    const [ax, ay] = this.armed;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
    const color = this.armedScan === 'in' ? '#35f0ff' : this.armedScan === 'out' ? '#ff5c5c' : '#c8d2e6';
    ctx.fillStyle = 'rgba(53, 240, 255, 0.10)';
    ctx.fillRect(GRID_LEFT + (ax - 1) * CELL, GRID_TOP, CELL, CELL * GRID_SIZE);
    ctx.fillRect(GRID_LEFT, GRID_BOTTOM - ay * CELL, CELL * GRID_SIZE, CELL);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 + pulse * 10;
    ctx.lineWidth = 3;
    ctx.strokeRect(GRID_LEFT + (ax - 1) * CELL + 3, GRID_BOTTOM - ay * CELL + 3, CELL - 6, CELL - 6);
    if (this.armedScan) {
      ctx.fillStyle = color;
      ctx.font = `12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.armedScan === 'in' ? 'IN' : 'OUT', cellCenterX(ax), GRID_BOTTOM - ay * CELL + 14);
    }
    ctx.restore();
  }

  /** Aim beam from the cannon to the range row, in world space (does not drift). */
  private drawAimBeam() {
    if (!this.inputEnabled || this.finaleActive) return;
    const { ctx } = this;
    const y = cellCenterY(this.rangeRow);
    ctx.save();
    ctx.strokeStyle = '#ffb347';
    ctx.globalAlpha = 0.35;
    ctx.setLineDash([4, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.cannonX, CANNON_Y - 32);
    ctx.lineTo(this.cannonX, y);
    ctx.stroke();
    ctx.restore();
  }

  /** Range line, reticle on the cell currently above the cannon, and the AIM readout. */
  private drawRangeGridPart() {
    if (!this.inputEnabled || this.finaleActive) return;
    const { ctx } = this;
    const col = this.columnAt(this.cannonX);
    const y = cellCenterY(this.rangeRow);
    const locked = !!this.armed && this.armed[0] === col && this.armed[1] === this.rangeRow;
    const color = locked ? '#35f0ff' : '#ffb347';

    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(GRID_LEFT, y);
    ctx.lineTo(GRID_RIGHT, y);
    ctx.stroke();
    ctx.restore();

    if (col !== null) {
      const cx = cellCenterX(col);
      const r = 34;
      const g = 12;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        const cy = y + sy * r;
        ctx.moveTo(cx + sx * r, cy);
        ctx.lineTo(cx + sx * (r - g), cy);
        ctx.moveTo(cx + sx * r, cy);
        ctx.lineTo(cx + sx * r, cy - sy * g);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = color;
    ctx.font = `18px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('AIM', GRID_RIGHT + 14, y - 14);
    ctx.fillText(col === null ? `-,${this.rangeRow}` : `${col},${this.rangeRow}`, GRID_RIGHT + 14, y + 12);
    if (locked) ctx.fillText('LOCK', GRID_RIGHT + 14, y + 38);
  }

  private renderLines() {
    if (this.linesStart === null || !this.round) return;
    const { ctx } = this;
    const lines = this.round.lines;
    const p = clamp((this.time - this.linesStart) / LINE_DRAW_S, 0, 1);
    ctx.save();
    ctx.strokeStyle = LINE_COLOR;
    ctx.shadowColor = LINE_COLOR;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    lines.forEach(([i, j], idx) => {
      const segP = clamp(p * lines.length - idx, 0, 1);
      if (segP <= 0) return;
      const [ax, ay] = this.round!.targets[i];
      const [bx, by] = this.round!.targets[j];
      const x1 = cellCenterX(ax);
      const y1 = cellCenterY(ay);
      const x2 = cellCenterX(bx);
      const y2 = cellCenterY(by);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + (x2 - x1) * segP, y1 + (y2 - y1) * segP);
      ctx.stroke();
    });
    ctx.restore();
  }

  /** The Sector 1 ruler: a line through a star and the pointer, clipped to the grid. */
  private drawGuide() {
    const g = this.guide;
    if (!g) return;
    const { ctx } = this;
    const [fx, fy] = g.from;
    const [tx, ty] = g.to;
    const len = Math.hypot(tx - fx, ty - fy);
    if (len < 1) return;
    const dx = (tx - fx) / len;
    const dy = (ty - fy) / len;
    ctx.save();
    ctx.beginPath();
    ctx.rect(GRID_LEFT, GRID_TOP, CELL * GRID_SIZE, CELL * GRID_SIZE);
    ctx.clip();
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.shadowColor = GUIDE_COLOR;
    ctx.shadowBlur = 12;
    ctx.globalAlpha = g.dragging ? 0.9 : 0.7;
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(fx - dx * 2000, fy - dy * 2000);
    ctx.lineTo(fx + dx * 2000, fy + dy * 2000);
    ctx.stroke();
    ctx.restore();
  }

  /** Finale: the Pointer stars glow and an arrow runs from them up to the ship lane. */
  private drawPointers() {
    const f = this.round?.finale;
    if (!f || !this.round) return;
    const { ctx } = this;
    const [from, to] = f.pointers.map((i) => this.round!.targets[i]);
    const x = cellCenterX(to[0]);
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
    ctx.save();
    ctx.fillStyle = `rgba(255, 92, 240, ${0.08 + pulse * 0.06})`;
    ctx.fillRect(GRID_LEFT + (f.column - 1) * CELL, SHIP_Y - 26, CELL, GRID_TOP - SHIP_Y + 26 + CELL * GRID_SIZE);
    ctx.strokeStyle = SHIP_COLOR;
    ctx.shadowColor = SHIP_COLOR;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 4;
    for (const [sx, sy] of [from, to]) {
      ctx.beginPath();
      ctx.arc(cellCenterX(sx), cellCenterY(sy), 30 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -this.time * 40;
    ctx.beginPath();
    ctx.moveTo(x, cellCenterY(from[1]));
    ctx.lineTo(x, SHIP_Y + 34);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = SHIP_COLOR;
    ctx.beginPath();
    ctx.moveTo(x - 14, SHIP_Y + 40);
    ctx.lineTo(x, SHIP_Y + 22);
    ctx.lineTo(x + 14, SHIP_Y + 40);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawShip() {
    if (!this.finaleActive || !this.ship.active) return;
    const { ctx } = this;
    const s = this.shipSprite;
    ctx.drawImage(s, this.ship.x - s.width / 2, SHIP_Y - s.height / 2);
    ctx.save();
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = SHIP_COLOR;
    ctx.shadowBlur = 10;
    ctx.fillText(this.round?.finale?.label ?? '', this.ship.x, SHIP_Y + 30);
    ctx.restore();
  }

  private drawCells() {
    const { ctx } = this;
    const t = this.time;
    const frame = Math.floor(t * 2) % 2;
    for (const c of this.cells) {
      const cx = cellCenterX(c.x);
      const cy = cellCenterY(c.y);
      if (c.state === 'star') {
        this.drawStar(cx, cy, t - c.starAt);
        this.drawLetter(c, cx, cy, 'lit');
        continue;
      }
      if (c.state === 'dead') {
        if (t < c.flashUntil) {
          const sprite = this.redSprites[frame];
          ctx.globalAlpha = (c.flashUntil - t) / 0.35;
          ctx.drawImage(sprite, cx - sprite.width / 2, cy - sprite.height / 2);
          ctx.globalAlpha = 1;
        }
        continue;
      }
      if (t < c.spawnAt) continue;
      const age = t - c.spawnAt;
      const bob = this.reducedMotion ? 0 : Math.sin(t * 2.2 + c.phase) * 3;
      const sprite = this.sprites[frame];
      ctx.globalAlpha = clamp(age / 0.35, 0, 1);
      const drop = (1 - clamp(age / 0.35, 0, 1)) * -20;
      ctx.drawImage(sprite, cx - sprite.width / 2, cy - sprite.height / 2 + bob + drop);
      ctx.globalAlpha = 1;
      if (this.revealed.has(coordKey(c.x, c.y))) this.drawLetter(c, cx, cy, 'scanned');
    }
  }

  /** Letters stay hidden until a cell is hit (lit) or scanned. */
  private drawLetter(c: Cell, cx: number, cy: number, mode: 'lit' | 'scanned') {
    const letter = this.letters.get(coordKey(c.x, c.y));
    if (!letter) return;
    const { ctx } = this;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (mode === 'lit') {
      ctx.font = `20px ${FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = LINE_COLOR;
      ctx.shadowBlur = 14;
    } else {
      ctx.font = `18px ${FONT}`;
      ctx.fillStyle = '#ffd166';
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 8;
    }
    ctx.fillText(letter, cx, cy + 33);
    ctx.restore();
  }

  private drawStar(cx: number, cy: number, age: number) {
    const { ctx } = this;
    const grow = clamp(age / 0.4, 0, 1);
    const pulse = 1 + Math.sin(this.time * 3 + cx) * 0.15;
    const r = 12 * grow * pulse;
    ctx.save();
    ctx.shadowColor = LINE_COLOR;
    ctx.shadowBlur = 30;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.6);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, 'rgba(120,240,255,0.55)');
    g.addColorStop(1, 'rgba(53,240,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = STAR_COLOR;
    ctx.beginPath();
    const spikes = 4;
    for (let i = 0; i < spikes * 2; i++) {
      const rad = i % 2 === 0 ? r * 2.2 : r * 0.45;
      const a = (i / (spikes * 2)) * Math.PI * 2 + this.time * 0.4;
      ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Pencil marks: a faint numbered ring per marked cell, hidden once the cell is a star. */
  private drawMarks() {
    if (!this.marks.length) return;
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = MARK_COLOR;
    ctx.fillStyle = MARK_COLOR;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    this.marks.forEach((key, i) => {
      const [x, y] = key.split(',').map(Number);
      if (this.cellAt(x, y)?.state === 'star') return;
      const cx = cellCenterX(x);
      const cy = cellCenterY(y);
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(String(i + 1), cx + CELL / 2 - 6, cy + CELL / 2 - 6);
    });
    ctx.restore();
  }

  private drawStaffOverlay() {
    if (!this.round) return;
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = '#ff3df2';
    ctx.fillStyle = '#ff3df2';
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    this.round.targets.forEach(([x, y], i) => {
      const l = GRID_LEFT + (x - 1) * CELL + 6;
      const tp = GRID_BOTTOM - y * CELL + 6;
      ctx.strokeRect(l, tp, CELL - 12, CELL - 12);
      ctx.fillText(String(i + 1), l + 5, tp + 18);
    });
    ctx.strokeStyle = '#ff5c5c';
    ctx.fillStyle = '#ff5c5c';
    this.round.decoys?.forEach(({ cell: [x, y] }) => {
      const l = GRID_LEFT + (x - 1) * CELL + 6;
      const tp = GRID_BOTTOM - y * CELL + 6;
      ctx.strokeRect(l, tp, CELL - 12, CELL - 12);
      ctx.fillText('D', l + 5, tp + 18);
    });
    ctx.restore();
  }

  private drawProjectiles() {
    const { ctx } = this;
    if (this.bullet) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#35f0ff';
      ctx.shadowBlur = 14;
      ctx.fillRect(this.bullet.x - 3, this.bullet.y - 14, 6, 22);
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = '#ff6a3d';
    ctx.shadowColor = '#ff3d00';
    ctx.shadowBlur = 10;
    for (const f of this.flak) {
      const zig = Math.sin(f.y * 0.08) * 3;
      ctx.fillRect(f.x - 3 + zig, f.y - 8, 6, 6);
      ctx.fillRect(f.x - 3 - zig, f.y, 6, 6);
    }
    ctx.restore();
  }

  private drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawCannon() {
    const { ctx } = this;
    const x = this.cannonX;
    const y = CANNON_Y;
    const locked = this.time < this.lockoutUntil;
    const flicker = locked && Math.floor(this.time * 12) % 2 === 0;
    const color = locked ? (flicker ? '#ff4040' : '#666c78') : '#5dff9d';
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = locked ? 4 : 14;
    ctx.fillRect(x - 36, y, 72, 16);
    ctx.fillRect(x - 28, y - 8, 56, 8);
    ctx.fillRect(x - 8, y - 22, 16, 14);
    ctx.fillRect(x - 3, y - 30, 6, 8);
    ctx.restore();
    if (locked) {
      ctx.fillStyle = '#ff5c5c';
      ctx.font = `16px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${this.lockoutLabel} ${(this.lockoutUntil - this.time).toFixed(1)}s`, clamp(x, 170, W - 170), y + 36);
    }
  }

  private drawLegend() {
    const { ctx } = this;
    const { text, color } = this.coachLine();
    // The redesign's instructions run longer, so they use a smaller size centered on the grid, clear of the Y axis label.
    ctx.font = `${REDESIGN ? 16 : 18}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    // Redesign: the line rides the sway with the grid so it never collides with the Y axis label.
    ctx.fillText(text, REDESIGN ? (GRID_LEFT + GRID_RIGHT) / 2 + this.drift : W / 2, 24);
  }

  /** The line above the grid. Under the redesign it always names the next thing to do. */
  private coachLine(): { text: string; color: string } {
    const guideTip = this.guideAvailable && !this.guide;
    const yHint = { text: 'Y = 1 IS THE BOTTOM ROW', color: '#ffd166' };
    const guide = { text: 'DRAG FROM A STAR TO LAY A GUIDE LINE', color: GUIDE_COLOR };
    if (!REDESIGN) return guideTip ? guide : yHint;
    if (!this.inputEnabled || this.banner) return yHint;
    if (this.time < this.lockoutUntil) {
      const text = this.lockoutLabel === 'DEFLECTED' ? 'SHOT DEFLECTED. LINE UP LOCK, THEN FIRE' : 'WEAPONS OFFLINE. HOLD FIRE';
      return { text, color: '#ff5c5c' };
    }
    if (!this.armed) {
      return guideTip ? guide : { text: 'TYPE X,Y IN ARM TARGET. Y = 1 IS THE BOTTOM ROW', color: '#ffd166' };
    }
    const [ax, ay] = this.armed;
    if (this.isLocked()) return { text: `LOCKED ON (${ax},${ay}). PRESS SPACE`, color: '#35f0ff' };
    const steps: string[] = [];
    if (this.columnAt(this.cannonX) !== ax) {
      const side = cellCenterX(ax) + this.drift < this.cannonX ? 'LEFT' : 'RIGHT';
      steps.push(`MOVE ${side} TO COLUMN ${ax}`);
    }
    if (this.rangeRow !== ay) {
      steps.push(`${steps.length ? 'ROW' : 'SET ROW'} ${ay > this.rangeRow ? 'UP' : 'DOWN'} TO ${ay}`);
    }
    return { text: steps.join(' · '), color: '#ffb347' };
  }

  private drawBanner(text: string) {
    const { ctx } = this;
    const y = GRID_TOP + CELL * 0.5 + (this.finaleActive ? CELL : 0);
    const pulse = 0.75 + 0.25 * Math.sin(this.time * 4);
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(W / 2 - 400, y - 32, 800, 64);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 16;
    ctx.font = `20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, y);
    ctx.restore();
  }

  private drawVignette() {
    const { ctx } = this;
    const a = clamp((this.vignetteUntil - this.time) / 0.9, 0, 1);
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(255,0,0,0)');
    g.addColorStop(1, `rgba(255,0,0,${0.55 * a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}
