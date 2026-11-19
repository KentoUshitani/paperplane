import type { ObstacleKind } from "./types";

export interface StageDef {
  /** 1-based stage number */
  id: number;
  /** Inclusive start depth (meters) */
  startM: number;
  /** Exclusive end depth (meters); stage 10 end clears the run */
  endM: number;
  name: string;
  /** Scroll speed for this stage (px/s) */
  scrollSpeed: number;
  /** Vertical distance between obstacle spawns */
  spawnGap: number;
  /** Minimum opening width for platforms / corridors */
  opening: number;
  /** Relative spawn weights (0 = disabled) */
  weights: Record<ObstacleKind, number>;
  /** Chance to attach a bonus updraft after a spawn */
  updraftPairChance: number;
  /** Mover horizontal speed range */
  moverSpeed: [number, number];
}

/**
 * Difficulty curve (casual Paper Plane style):
 * 1–3  learn controls / read gaps
 * 4–6  introduce walls & movers one at a time
 * 7–9  denser mix, tighter openings
 * 10   peak challenge, then CLEAR
 *
 * ~50–70m per stage → full clear around 580m.
 */
export const STAGES: readonly StageDef[] = [
  {
    id: 1,
    startM: 0,
    endM: 50,
    name: "FIRST FOLD",
    scrollSpeed: 105,
    spawnGap: 300,
    opening: 150,
    weights: { platform: 1, wall: 0, mover: 0, updraft: 0.15 },
    updraftPairChance: 0.05,
    moverSpeed: [60, 80],
  },
  {
    id: 2,
    startM: 50,
    endM: 105,
    name: "WIDE SKY",
    scrollSpeed: 118,
    spawnGap: 280,
    opening: 135,
    weights: { platform: 1, wall: 0.25, mover: 0, updraft: 0.18 },
    updraftPairChance: 0.08,
    moverSpeed: [70, 90],
  },
  {
    id: 3,
    startM: 105,
    endM: 165,
    name: "THERMAL",
    scrollSpeed: 130,
    spawnGap: 260,
    opening: 125,
    weights: { platform: 1, wall: 0.35, mover: 0, updraft: 0.35 },
    updraftPairChance: 0.18,
    moverSpeed: [70, 90],
  },
  {
    id: 4,
    startM: 165,
    endM: 230,
    name: "NARROW PASS",
    scrollSpeed: 145,
    spawnGap: 240,
    opening: 112,
    weights: { platform: 0.85, wall: 0.7, mover: 0, updraft: 0.22 },
    updraftPairChance: 0.12,
    moverSpeed: [80, 100],
  },
  {
    id: 5,
    startM: 230,
    endM: 300,
    name: "CROSSWIND",
    scrollSpeed: 158,
    spawnGap: 220,
    opening: 102,
    weights: { platform: 0.8, wall: 0.55, mover: 0.35, updraft: 0.2 },
    updraftPairChance: 0.12,
    moverSpeed: [90, 120],
  },
  {
    id: 6,
    startM: 300,
    endM: 375,
    name: "SWITCHBACK",
    scrollSpeed: 172,
    spawnGap: 205,
    opening: 95,
    weights: { platform: 0.7, wall: 0.65, mover: 0.5, updraft: 0.22 },
    updraftPairChance: 0.14,
    moverSpeed: [100, 140],
  },
  {
    id: 7,
    startM: 375,
    endM: 455,
    name: "GALE",
    scrollSpeed: 190,
    spawnGap: 190,
    opening: 88,
    weights: { platform: 0.6, wall: 0.7, mover: 0.65, updraft: 0.18 },
    updraftPairChance: 0.1,
    moverSpeed: [110, 155],
  },
  {
    id: 8,
    startM: 455,
    endM: 540,
    name: "NEEDLE",
    scrollSpeed: 210,
    spawnGap: 175,
    opening: 80,
    weights: { platform: 0.55, wall: 0.8, mover: 0.75, updraft: 0.15 },
    updraftPairChance: 0.1,
    moverSpeed: [120, 170],
  },
  {
    id: 9,
    startM: 540,
    endM: 630,
    name: "FREEFALL",
    scrollSpeed: 235,
    spawnGap: 160,
    opening: 74,
    weights: { platform: 0.45, wall: 0.85, mover: 0.9, updraft: 0.12 },
    updraftPairChance: 0.08,
    moverSpeed: [130, 185],
  },
  {
    id: 10,
    startM: 630,
    endM: 730,
    name: "PAPER EDGE",
    scrollSpeed: 260,
    spawnGap: 148,
    opening: 68,
    weights: { platform: 0.4, wall: 0.9, mover: 1, updraft: 0.1 },
    updraftPairChance: 0.08,
    moverSpeed: [140, 200],
  },
] as const;

export const TOTAL_STAGES = STAGES.length;
export const CLEAR_DEPTH_M = STAGES[STAGES.length - 1].endM;

export function getStageForDepth(meters: number): StageDef {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (meters >= STAGES[i].startM) return STAGES[i];
  }
  return STAGES[0];
}

export function stageProgress(meters: number, stage: StageDef): number {
  const span = stage.endM - stage.startM;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (meters - stage.startM) / span));
}
