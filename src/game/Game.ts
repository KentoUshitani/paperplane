import {
  BASE_SCROLL_SPEED,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLORS,
  MAX_SCROLL_SPEED,
  PIXELS_PER_METER,
  PLAYER,
  UPDRAFT,
} from "./constants";
import { AudioManager } from "./AudioManager";
import { hitboxesOverlap } from "./Collision";
import { CrashEffect } from "./CrashEffect";
import { GameLoop } from "./GameLoop";
import { loadHighScore, saveHighScore } from "./HighScore";
import { InputHandler } from "./InputHandler";
import { ObstacleManager } from "./ObstacleManager";
import { Player } from "./Player";
import {
  CLEAR_DEPTH_M,
  getStageForDepth,
  stageProgress,
  STAGES,
  TOTAL_STAGES,
  type StageDef,
} from "./stages";
import type { GameState } from "./types";

/**
 * Top-level game orchestrator: stages, scroll, collision, HUD, screens.
 */
export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly input: InputHandler;
  private readonly loop: GameLoop;
  private readonly player: Player;
  private readonly obstacles: ObstacleManager;
  private readonly crash: CrashEffect;
  readonly audio: AudioManager;

  private state: GameState = "title";
  private depthPx = 0;
  private elapsed = 0;
  private highScore = 0;
  private flash = 0;
  private bgOffset = 0;
  private titleBlink = 0;
  private stage: StageDef = STAGES[0];
  private stageBanner = 0;
  private stageBannerText = "";
  private uiBlocked = false;
  private prevSteer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;

    this.input = new InputHandler(canvas);
    this.player = new Player(PLAYER.startX, PLAYER.startY);
    this.obstacles = new ObstacleManager();
    this.crash = new CrashEffect();
    this.audio = new AudioManager();
    this.highScore = loadHighScore();

    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render(),
      60,
    );
  }

  /** Pause start/retry input while auth/ranking overlays are open. */
  setUiBlocked(blocked: boolean): void {
    this.uiBlocked = blocked;
    document.body.classList.toggle("modal-open", blocked);
  }

  /** Hook for cloud score sync (Supabase). */
  onScoreCommit: ((depth: number, stage: number) => void) | null = null;

  start(): void {
    this.fitCanvas();
    window.addEventListener("resize", this.fitCanvas);
    const unlock = () => {
      void this.audio.unlock().then(() => this.audio.startMusic(0.22));
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.audio.dispose();
    window.removeEventListener("resize", this.fitCanvas);
  }

  private fitCanvas = (): void => {
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
  };

  private beginRun(): void {
    this.state = "playing";
    this.depthPx = 0;
    this.elapsed = 0;
    this.flash = 0;
    this.stage = STAGES[0];
    this.stageBanner = 2.2;
    this.stageBannerText = `STAGE ${this.stage.id}  ${this.stage.name}`;
    this.player.reset(PLAYER.startX, PLAYER.startY);
    this.obstacles.reset(this.stage);
    this.crash.active = false;
    this.crash.particles = [];
    this.input.consumePointerAsAction();
    this.input.consumeAction();
    this.prevSteer = 0;
    void this.audio.startMusic(0.28);
    this.audio.playUi();
  }

  private gameOver(): void {
    if (this.state !== "playing") return;
    this.state = "gameover";
    this.player.alive = false;
    saveHighScore(this.score);
    this.highScore = loadHighScore();
    this.crash.trigger(this.player.x, this.player.y, this.player.tilt);
    this.flash = 0.35;
    this.audio.playCrash();
    void this.audio.startMusic(0.18);
    this.onScoreCommit?.(this.score, this.stage.id);
  }

  private clearRun(): void {
    if (this.state !== "playing") return;
    this.state = "clear";
    this.player.alive = true;
    saveHighScore(this.score);
    this.highScore = loadHighScore();
    this.audio.playClear();
    void this.audio.startMusic(0.2);
    this.onScoreCommit?.(this.score, this.stage.id);
  }

  private get score(): number {
    return Math.floor(this.depthPx / PIXELS_PER_METER);
  }

  private get scrollSpeed(): number {
    let s = this.stage.scrollSpeed;
    if (this.player.updraftTimer > 0) {
      s *= UPDRAFT.speedMul;
    }
    return s;
  }

  private syncStage(): void {
    const next = getStageForDepth(this.score);
    if (next.id !== this.stage.id) {
      this.stage = next;
      this.obstacles.setStage(next);
      this.stageBanner = 2.0;
      this.stageBannerText = `STAGE ${next.id}  ${next.name}`;
      this.audio.playStage();
      this.audio.setIntensity(0.2 + (next.id / TOTAL_STAGES) * 0.25);
    }
  }

  private update(dt: number): void {
    this.titleBlink += dt;
    this.bgOffset = (this.bgOffset + dt * 18) % 40;
    if (this.flash > 0) this.flash -= dt;
    if (this.stageBanner > 0) this.stageBanner -= dt;

    if (this.state === "title") {
      if (
        !this.uiBlocked &&
        (this.input.consumeAction() || this.input.consumePointerAsAction())
      ) {
        this.beginRun();
      }
      this.player.tilt = Math.sin(this.titleBlink * 1.2) * 0.25;
      return;
    }

    if (this.state === "gameover" || this.state === "clear") {
      this.crash.update(dt);
      if (
        !this.uiBlocked &&
        (this.input.consumeAction() || this.input.consumePointerAsAction())
      ) {
        this.beginRun();
      }
      return;
    }

    // playing
    this.elapsed += dt;
    this.input.consumePointerAsAction();
    this.input.consumeAction();
    const steer = this.input.steer;
    if (steer !== 0 && steer !== this.prevSteer) {
      this.audio.playBank(steer);
    }
    this.prevSteer = steer;
    this.player.update(dt, steer, CANVAS_WIDTH);

    const speed = this.scrollSpeed;
    this.depthPx += speed * dt;

    if (this.score >= CLEAR_DEPTH_M) {
      this.depthPx = CLEAR_DEPTH_M * PIXELS_PER_METER;
      this.clearRun();
      return;
    }

    this.syncStage();
    this.obstacles.setStage(this.stage);
    this.obstacles.update(dt, speed);
    this.resolveCollisions();
  }

  private resolveCollisions(): void {
    const planeBox = this.player.getHitbox();

    for (const o of this.obstacles.obstacles) {
      const boxes = o.getHitboxes();
      for (const box of boxes) {
        if (!hitboxesOverlap(planeBox, box)) continue;

        if (o.lethal) {
          this.gameOver();
          return;
        }

        if (o.kind === "updraft") {
          this.player.applyUpdraft(UPDRAFT.liftForce, UPDRAFT.boostDuration);
        }
      }
    }
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.drawBackground(ctx);

    if (this.state === "title") {
      this.drawTitle(ctx);
    } else {
      this.obstacles.draw(ctx);
      if (this.player.alive || this.state === "clear") {
        const color =
          this.player.updraftTimer > 0 ? COLORS.wind : COLORS.fg;
        this.player.draw(ctx, color);
      }
      this.crash.draw(ctx);
      this.drawHud(ctx);
      this.drawStageBanner(ctx);
      if (this.state === "gameover") this.drawGameOver(ctx);
      if (this.state === "clear") this.drawClear(ctx);
    }

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(224, 112, 112, ${this.flash * 0.7})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    ctx.strokeStyle = COLORS.dim;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, CANVAS_WIDTH - 2, CANVAS_HEIGHT - 2);

    ctx.restore();
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = COLORS.dim;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;

    for (const x of [40, CANVAS_WIDTH / 2, CANVAS_WIDTH - 40]) {
      ctx.setLineDash([2, 10]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const step = 40;
    const off = this.state === "playing" ? (this.depthPx % step) : this.bgOffset;
    for (let y = -step + off; y < CANVAS_HEIGHT + step; y += step) {
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(20, y);
      ctx.moveTo(CANVAS_WIDTH - 8, y);
      ctx.lineTo(CANVAS_WIDTH - 20, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = COLORS.fg;
    ctx.font = "12px 'Courier New', Courier, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`STAGE  ${this.stage.id}/${TOTAL_STAGES}`, 16, 28);
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(`DEPTH  ${this.score}m`, 16, 46);

    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(`BEST  ${this.highScore}m`, CANVAS_WIDTH - 16, 28);

    // Stage progress bar
    const p = stageProgress(this.score, this.stage);
    ctx.strokeStyle = COLORS.dim;
    ctx.lineWidth = 1;
    ctx.strokeRect(16.5, 56.5, 100, 5);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(17, 57, 98 * p, 4);

    // Speed reference
    const t = Math.min(
      1,
      (this.stage.scrollSpeed - BASE_SCROLL_SPEED) /
        (MAX_SCROLL_SPEED - BASE_SCROLL_SPEED),
    );
    ctx.strokeStyle = COLORS.fg;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH - 96, 46);
    ctx.lineTo(CANVAS_WIDTH - 96 + t * 80, 46);
    ctx.stroke();
    ctx.restore();
  }

  private drawStageBanner(ctx: CanvasRenderingContext2D): void {
    if (this.stageBanner <= 0 || this.state !== "playing") return;
    const alpha = Math.min(1, this.stageBanner);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.fg;
    ctx.font = "bold 18px 'Courier New', Courier, monospace";
    ctx.fillText(this.stageBannerText, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.2);
    ctx.restore();
  }

  private drawTitle(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    this.player.x = CANVAS_WIDTH / 2;
    this.player.y = CANVAS_HEIGHT * 0.38;
    this.player.draw(ctx, COLORS.fg);

    ctx.fillStyle = COLORS.fg;
    ctx.textAlign = "center";
    ctx.font = "bold 28px 'Courier New', Courier, monospace";
    ctx.fillText("PAPER PLANE", CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.22);

    ctx.font = "11px 'Courier New', Courier, monospace";
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(`${TOTAL_STAGES} STAGES · DESCEND · SURVIVE`, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.27);

    const show = Math.floor(this.titleBlink * 2) % 2 === 0;
    if (show) {
      ctx.fillStyle = COLORS.accent;
      ctx.font = "13px 'Courier New', Courier, monospace";
      ctx.fillText("PRESS SPACE / TAP TO START", CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.62);
    }

    ctx.fillStyle = COLORS.dim;
    ctx.font = "11px 'Courier New', Courier, monospace";
    ctx.fillText(`BEST  ${this.highScore}m`, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.72);
    ctx.fillText("← →  or  A D   ·   TAP L / R", CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.78);
    ctx.restore();
  }

  private drawGameOver(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = "rgba(10, 10, 10, 0.55)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.danger;
    ctx.font = "bold 26px 'Courier New', Courier, monospace";
    ctx.fillText("CRASHED", CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.36);

    ctx.fillStyle = COLORS.fg;
    ctx.font = "15px 'Courier New', Courier, monospace";
    ctx.fillText(`STAGE  ${this.stage.id}/${TOTAL_STAGES}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.44);
    ctx.fillText(`DEPTH  ${this.score}m`, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.5);
    ctx.fillStyle = COLORS.dim;
    ctx.font = "13px 'Courier New', Courier, monospace";
    ctx.fillText(`BEST  ${this.highScore}m`, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.56);

    const show = Math.floor(this.titleBlink * 2) % 2 === 0;
    if (show) {
      ctx.fillStyle = COLORS.accent;
      ctx.font = "13px 'Courier New', Courier, monospace";
      ctx.fillText("SPACE / TAP TO RETRY", CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.66);
    }
    ctx.restore();
  }

  private drawClear(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = "rgba(10, 10, 10, 0.55)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.accent;
    ctx.font = "bold 26px 'Courier New', Courier, monospace";
    ctx.fillText("CLEAR", CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.36);

    ctx.fillStyle = COLORS.fg;
    ctx.font = "14px 'Courier New', Courier, monospace";
    ctx.fillText("ALL 10 STAGES", CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.44);
    ctx.fillText(`DEPTH  ${this.score}m`, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.5);
    ctx.fillStyle = COLORS.dim;
    ctx.font = "12px 'Courier New', Courier, monospace";
    ctx.fillText(STAGES[TOTAL_STAGES - 1].name, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.56);

    const show = Math.floor(this.titleBlink * 2) % 2 === 0;
    if (show) {
      ctx.fillStyle = COLORS.accent;
      ctx.font = "13px 'Courier New', Courier, monospace";
      ctx.fillText("SPACE / TAP TO REPLAY", CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.66);
    }
    ctx.restore();
  }
}
