/**
 * Fixed-timestep friendly game loop with accurate deltaTime.
 * Caps large frame gaps (tab blur) so physics stay stable.
 */
export class GameLoop {
  private readonly updateFn: (dt: number) => void;
  private readonly renderFn: (alpha: number) => void;
  private readonly fixedDt: number;
  private readonly maxAccum: number;

  private lastTime = 0;
  private accum = 0;
  private rafId = 0;
  private running = false;

  constructor(
    updateFn: (dt: number) => void,
    renderFn: (alpha: number) => void,
    fps = 60,
  ) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.fixedDt = 1 / fps;
    this.maxAccum = this.fixedDt * 5;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accum = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== 0) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private tick = (now: number): void => {
    if (!this.running) return;

    let frameDt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Guard against huge stalls (background tab, debugger pause)
    if (frameDt > 0.25) frameDt = 0.25;

    this.accum += frameDt;
    if (this.accum > this.maxAccum) this.accum = this.maxAccum;

    while (this.accum >= this.fixedDt) {
      this.updateFn(this.fixedDt);
      this.accum -= this.fixedDt;
    }

    const alpha = this.accum / this.fixedDt;
    this.renderFn(alpha);

    this.rafId = requestAnimationFrame(this.tick);
  };
}
