import { PLAYER } from "./constants";
import type { PolyHitbox, Vec2 } from "./types";

/**
 * Paper plane: auto-descends with world scroll; player steers via tilt.
 */
export class Player {
  x: number;
  y: number;
  /** Radians; negative = left wing down / bank left */
  tilt = 0;
  alive = true;

  /** Temporary vertical velocity from updraft (world space, +down) */
  liftVy = 0;
  updraftTimer = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  reset(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.tilt = 0;
    this.alive = true;
    this.liftVy = 0;
    this.updraftTimer = 0;
  }

  update(dt: number, steer: number, wrapWidth: number): void {
    if (!this.alive) return;

    const target = steer * PLAYER.maxTilt;
    const rate = steer !== 0 ? PLAYER.tiltSpeed : PLAYER.untiltSpeed;
    this.tilt += (target - this.tilt) * Math.min(1, rate * dt);

    // Lateral velocity proportional to bank angle
    this.x += Math.sin(this.tilt) * PLAYER.lateralFactor * dt;

    // Wrap around screen edges
    const pad = PLAYER.wrapPadding;
    if (this.x < -pad) this.x = wrapWidth + pad;
    else if (this.x > wrapWidth + pad) this.x = -pad;

    // Updraft residual lift (negative = upward on screen)
    if (this.updraftTimer > 0) {
      this.updraftTimer -= dt;
      this.y += this.liftVy * dt;
      this.liftVy *= Math.pow(0.15, dt);
      if (this.updraftTimer <= 0) {
        this.updraftTimer = 0;
        this.liftVy = 0;
      }
    }

    // Soft clamp so plane stays in the upper playfield
    const minY = 80;
    const maxY = 360;
    if (this.y < minY) this.y = minY;
    if (this.y > maxY) this.y = maxY;
  }

  applyUpdraft(liftForce: number, duration: number): void {
    this.liftVy = liftForce;
    this.updraftTimer = Math.max(this.updraftTimer, duration);
  }

  /** Tip + wing tips polygon for precise collision */
  getHitbox(): PolyHitbox {
    return { kind: "poly", points: this.getWorldPolygon() };
  }

  getWorldPolygon(): Vec2[] {
    const pts = this.getLocalPolygon();
    const c = Math.cos(this.tilt);
    const s = Math.sin(this.tilt);
    return pts.map((p) => ({
      x: this.x + p.x * c - p.y * s,
      y: this.y + p.x * s + p.y * c,
    }));
  }

  /** Nose-down local coords (nose = +Y) */
  getLocalPolygon(): Vec2[] {
    const L = PLAYER.length;
    const W = PLAYER.wingSpan;
    return [
      { x: 0, y: L * 0.55 }, // nose
      { x: W * 0.5, y: -L * 0.35 }, // right wing
      { x: 0, y: -L * 0.15 }, // tail notch
      { x: -W * 0.5, y: -L * 0.35 }, // left wing
    ];
  }

  draw(ctx: CanvasRenderingContext2D, color: string): void {
    const poly = this.getWorldPolygon();
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i].x, poly[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // Center fold line
    const midTail = {
      x: (poly[1].x + poly[3].x) / 2,
      y: (poly[1].y + poly[3].y) / 2,
    };
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    ctx.lineTo(midTail.x, midTail.y);
    ctx.stroke();
    ctx.restore();
  }
}
