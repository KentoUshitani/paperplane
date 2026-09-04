import type { CrashParticle } from "./types";
import { COLORS } from "./constants";

/** Wireframe shatter burst when the plane crashes */
export class CrashEffect {
  particles: CrashParticle[] = [];
  active = false;
  elapsed = 0;

  trigger(x: number, y: number, tilt: number): void {
    this.particles = [];
    this.active = true;
    this.elapsed = 0;
    const count = 18;
    for (let i = 0; i < count; i++) {
      const a = tilt + (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const sp = 60 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.55,
        maxLife: 0.5 + Math.random() * 0.55,
        len: 4 + Math.random() * 10,
        angle: a,
      });
    }
  }

  update(dt: number): void {
    if (!this.active) return;
    this.elapsed += dt;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      p.life -= dt;
      p.angle += dt * 4;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length === 0 && this.elapsed > 0.3) {
      this.active = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    ctx.save();
    ctx.strokeStyle = COLORS.danger;
    ctx.lineWidth = 1.5;
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      const hx = Math.cos(p.angle) * p.len * 0.5;
      const hy = Math.sin(p.angle) * p.len * 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x - hx, p.y - hy);
      ctx.lineTo(p.x + hx, p.y + hy);
      ctx.stroke();
    }
    ctx.restore();
  }
}
