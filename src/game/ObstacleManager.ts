import { CANVAS_HEIGHT, CANVAS_WIDTH, SPAWN } from "./constants";
import {
  MoverObstacle,
  Obstacle,
  PlatformObstacle,
  UpdraftObstacle,
  WallObstacle,
} from "./Obstacle";
import { getStageForDepth, type StageDef } from "./stages";
import type { ObstacleKind } from "./types";

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted(weights: Record<ObstacleKind, number>): ObstacleKind {
  const entries = Object.entries(weights) as [ObstacleKind, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return "platform";
  let r = Math.random() * total;
  for (const [kind, w] of entries) {
    r -= w;
    if (r <= 0) return kind;
  }
  return entries[entries.length - 1][0];
}

/**
 * Spawns obstacles according to the active stage definition.
 */
export class ObstacleManager {
  obstacles: Obstacle[] = [];
  private nextSpawnY = CANVAS_HEIGHT + 40;
  private stage: StageDef = getStageForDepth(0);

  reset(stage: StageDef): void {
    this.stage = stage;
    this.obstacles = [];
    const gap = stage.spawnGap;
    for (let i = 0; i < 4; i++) {
      this.spawnOne(CANVAS_HEIGHT * 0.55 + i * gap);
    }
    this.nextSpawnY = CANVAS_HEIGHT * 0.55 + 4 * gap;
  }

  setStage(stage: StageDef): void {
    this.stage = stage;
  }

  update(dt: number, scrollSpeed: number): void {
    const dy = scrollSpeed * dt;

    for (const o of this.obstacles) {
      o.scroll(dy);
      o.update(dt);
    }

    this.nextSpawnY -= dy;

    const gap = this.stage.spawnGap;
    while (this.nextSpawnY < CANVAS_HEIGHT + 120) {
      this.spawnOne(this.nextSpawnY);
      this.nextSpawnY += gap + rand(-18, 28);
    }

    this.obstacles = this.obstacles.filter((o) => !o.isOffscreen());
  }

  private spawnOne(y: number): void {
    const kind = pickWeighted(this.stage.weights);
    switch (kind) {
      case "updraft":
        this.obstacles.push(this.makeUpdraft(y));
        break;
      case "mover":
        this.obstacles.push(this.makeMover(y));
        break;
      case "wall":
        this.obstacles.push(this.makeWall(y));
        break;
      default:
        this.obstacles.push(this.makePlatform(y));
        break;
    }

    if (Math.random() < this.stage.updraftPairChance) {
      this.obstacles.push(this.makeUpdraft(y + rand(70, 110)));
    }
  }

  private makePlatform(y: number): PlatformObstacle {
    const opening = this.stage.opening;
    const gapW = rand(opening, opening + 36);
    const gapX = rand(SPAWN.lanePadding, CANVAS_WIDTH - SPAWN.lanePadding - gapW);
    return new PlatformObstacle(y, gapX, gapW, rand(12, 18));
  }

  private makeWall(y: number): WallObstacle {
    const corridor = this.stage.opening + 8;
    const leftMax = CANVAS_WIDTH - corridor - SPAWN.lanePadding;
    const leftW = rand(SPAWN.lanePadding, Math.max(SPAWN.lanePadding + 10, leftMax));
    const rightW = CANVAS_WIDTH - leftW - corridor;
    return new WallObstacle(y, leftW, Math.max(20, rightW), rand(70, 110));
  }

  private makeMover(y: number): MoverObstacle {
    const w = rand(70, 120);
    const x = rand(0, CANVAS_WIDTH - w);
    const [lo, hi] = this.stage.moverSpeed;
    const vx = pick([-1, 1]) * rand(lo, hi);
    return new MoverObstacle(y, x, w, vx);
  }

  private makeUpdraft(y: number): UpdraftObstacle {
    const w = rand(70, 140);
    const x = rand(SPAWN.lanePadding, CANVAS_WIDTH - SPAWN.lanePadding - w);
    return new UpdraftObstacle(y, x, w, rand(55, 85));
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const o of this.obstacles) {
      if (o.kind === "updraft") o.draw(ctx);
    }
    for (const o of this.obstacles) {
      if (o.kind !== "updraft") o.draw(ctx);
    }
  }
}
