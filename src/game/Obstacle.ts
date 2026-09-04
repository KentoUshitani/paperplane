import { CANVAS_WIDTH, COLORS } from "./constants";
import type { Hitbox, ObstacleKind } from "./types";

export abstract class Obstacle {
  abstract readonly kind: ObstacleKind;
  /** World Y of the obstacle's reference point (scrolls upward visually) */
  y: number;
  alive = true;
  /** Lethal contact vs soft updraft */
  abstract readonly lethal: boolean;

  constructor(y: number) {
    this.y = y;
  }

  /** Scroll with world (positive scrollSpeed moves obstacle up on screen) */
  scroll(dy: number): void {
    this.y -= dy;
  }

  abstract update(dt: number): void;
  abstract getHitboxes(): Hitbox[];
  abstract draw(ctx: CanvasRenderingContext2D): void;

  isOffscreen(margin = 80): boolean {
    return this.y < -margin;
  }
}

/** Horizontal ledge with a gap the plane must pass through */
export class PlatformObstacle extends Obstacle {
  readonly kind = "platform" as const;
  readonly lethal = true;
  gapX: number;
  gapW: number;
  thickness: number;

  constructor(y: number, gapX: number, gapW: number, thickness = 14) {
    super(y);
    this.gapX = gapX;
    this.gapW = gapW;
    this.thickness = thickness;
  }

  update(_dt: number): void {
    /* static */
  }

  getHitboxes(): Hitbox[] {
    const leftW = Math.max(0, this.gapX);
    const rightX = this.gapX + this.gapW;
    const rightW = Math.max(0, CANVAS_WIDTH - rightX);
    const boxes: Hitbox[] = [];
    if (leftW > 2) {
      boxes.push({ kind: "rect", x: 0, y: this.y, w: leftW, h: this.thickness });
    }
    if (rightW > 2) {
      boxes.push({
        kind: "rect",
        x: rightX,
        y: this.y,
        w: rightW,
        h: this.thickness,
      });
    }
    return boxes;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = COLORS.fg;
    ctx.lineWidth = 1.5;
    const boxes = this.getHitboxes();
    for (const b of boxes) {
      if (b.kind !== "rect") continue;
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      // Hatch fill (wireframe / retro)
      ctx.beginPath();
      for (let x = b.x; x < b.x + b.w; x += 8) {
        ctx.moveTo(x, b.y);
        ctx.lineTo(Math.min(x + 6, b.x + b.w), b.y + b.h);
      }
      ctx.strokeStyle = COLORS.dim;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = COLORS.fg;
      ctx.lineWidth = 1.5;
    }
    ctx.restore();
  }
}

/** Vertical wall pillars leaving a horizontal corridor */
export class WallObstacle extends Obstacle {
  readonly kind = "wall" as const;
  readonly lethal = true;
  leftW: number;
  rightW: number;
  height: number;

  constructor(y: number, leftW: number, rightW: number, height = 90) {
    super(y);
    this.leftW = leftW;
    this.rightW = rightW;
    this.height = height;
  }

  update(_dt: number): void {
    /* static */
  }

  getHitboxes(): Hitbox[] {
    return [
      { kind: "rect", x: 0, y: this.y, w: this.leftW, h: this.height },
      {
        kind: "rect",
        x: CANVAS_WIDTH - this.rightW,
        y: this.y,
        w: this.rightW,
        h: this.height,
      },
    ];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = COLORS.fg;
    ctx.lineWidth = 1.5;
    for (const b of this.getHitboxes()) {
      if (b.kind !== "rect") continue;
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      ctx.beginPath();
      for (let y = b.y; y < b.y + b.h; y += 10) {
        ctx.moveTo(b.x, y);
        ctx.lineTo(b.x + b.w, y);
      }
      ctx.strokeStyle = COLORS.dim;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = COLORS.fg;
      ctx.lineWidth = 1.5;
    }
    ctx.restore();
  }
}

/** Side-to-side moving bar */
export class MoverObstacle extends Obstacle {
  readonly kind = "mover" as const;
  readonly lethal = true;
  x: number;
  w: number;
  h: number;
  vx: number;
  phase: number;

  constructor(y: number, x: number, w: number, vx: number, h = 12) {
    super(y);
    this.x = x;
    this.w = w;
    this.h = h;
    this.vx = vx;
    this.phase = 0;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    if (this.x <= 0) {
      this.x = 0;
      this.vx = Math.abs(this.vx);
    } else if (this.x + this.w >= CANVAS_WIDTH) {
      this.x = CANVAS_WIDTH - this.w;
      this.vx = -Math.abs(this.vx);
    }
    this.phase += dt * 6;
  }

  getHitboxes(): Hitbox[] {
    return [{ kind: "rect", x: this.x, y: this.y, w: this.w, h: this.h }];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = COLORS.danger;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.x + 0.5, this.y + 0.5, this.w - 1, this.h - 1);
    // Motion chevrons
    ctx.beginPath();
    const dir = this.vx >= 0 ? 1 : -1;
    const cy = this.y + this.h / 2;
    for (let i = 0; i < 3; i++) {
      const cx = this.x + this.w / 2 + (i - 1) * 14;
      ctx.moveTo(cx - dir * 5, cy - 4);
      ctx.lineTo(cx + dir * 5, cy);
      ctx.lineTo(cx - dir * 5, cy + 4);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/** Soft zone that lifts / slows descent */
export class UpdraftObstacle extends Obstacle {
  readonly kind = "updraft" as const;
  readonly lethal = false;
  x: number;
  w: number;
  h: number;
  phase = 0;

  constructor(y: number, x: number, w: number, h = 70) {
    super(y);
    this.x = x;
    this.w = w;
    this.h = h;
  }

  update(dt: number): void {
    this.phase += dt * 4;
  }

  getHitboxes(): Hitbox[] {
    return [{ kind: "rect", x: this.x, y: this.y, w: this.w, h: this.h }];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = COLORS.wind;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(this.x + 0.5, this.y + 0.5, this.w - 1, this.h - 1);
    ctx.setLineDash([]);

    // Rising wind lines
    ctx.beginPath();
    const cols = Math.max(3, Math.floor(this.w / 18));
    for (let i = 0; i < cols; i++) {
      const lx = this.x + ((i + 0.5) / cols) * this.w;
      const offset = ((this.phase + i * 0.7) % 1) * this.h;
      ctx.moveTo(lx, this.y + this.h - offset);
      ctx.lineTo(lx - 4, this.y + this.h - offset + 10);
      ctx.moveTo(lx, this.y + this.h - offset);
      ctx.lineTo(lx + 4, this.y + this.h - offset + 10);
    }
    ctx.stroke();
    ctx.restore();
  }
}
