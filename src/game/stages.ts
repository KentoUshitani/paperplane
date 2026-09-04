import type { ObstacleKind } from "./types";

export interface StageDef {
  id: number;
  startM: number;
  endM: number;
  name: string;
  scrollSpeed: number;
  spawnGap: number;
  opening: number;
  weights: Record<ObstacleKind, number>;
  updraftPairChance: number;
  moverSpeed: [number, number];
}

/**
 * Tuned so stage 10 is barely clearable for a focused player.
 * Stage 1 is already a bit demanding (not a free tutorial).
 */
export const STAGES: readonly StageDef[] = [
  {
    id: 1,
    startM: 0,
    endM: 45,
    name: "FIRST FOLD",
    scrollSpeed: 125,
    spawnGap: 250,
    opening: 118,
    weights: { platform: 1, wall: 0.2, mover: 0, updraft: 0.12 },
    updraftPairChance: 0.06,
    moverSpeed: [70, 90],
  },
  {
    id: 2,
    startM: 45,
    endM: 95,
    name: "WIDE SKY",
    scrollSpeed: 138,
    spawnGap: 235,
    opening: 108,
    weights: { platform: 1, wall: 0.4, mover: 0, updraft: 0.15 },
    updraftPairChance: 0.08,
    moverSpeed: [80, 100],
  },
  {
    id: 3,
    startM: 95,
    endM: 150,
    name: "THERMAL",
    scrollSpeed: 150,
    spawnGap: 220,
    opening: 100,
    weights: { platform: 0.9, wall: 0.5, mover: 0.1, updraft: 0.28 },
    updraftPairChance: 0.14,
    moverSpeed: [90, 115],
  },
  {
    id: 4,
    startM: 150,
    endM: 210,
    name: "NARROW PASS",
    scrollSpeed: 165,
    spawnGap: 205,
    opening: 92,
    weights: { platform: 0.75, wall: 0.8, mover: 0.2, updraft: 0.18 },
    updraftPairChance: 0.1,
    moverSpeed: [100, 130],
  },
  {
    id: 5,
    startM: 210,
    endM: 275,
    name: "CROSSWIND",
    scrollSpeed: 180,
    spawnGap: 190,
    opening: 86,
    weights: { platform: 0.65, wall: 0.7, mover: 0.55, updraft: 0.16 },
    updraftPairChance: 0.1,
    moverSpeed: [110, 145],
  },
  {
    id: 6,
    startM: 275,
    endM: 345,
    name: "SWITCHBACK",
    scrollSpeed: 195,
    spawnGap: 178,
    opening: 82,
    weights: { platform: 0.55, wall: 0.75, mover: 0.7, updraft: 0.14 },
    updraftPairChance: 0.1,
    moverSpeed: [120, 160],
  },
  {
    id: 7,
    startM: 345,
    endM: 420,
    name: "GALE",
    scrollSpeed: 212,
    spawnGap: 168,
    opening: 78,
    weights: { platform: 0.45, wall: 0.85, mover: 0.85, updraft: 0.12 },
    updraftPairChance: 0.08,
    moverSpeed: [130, 175],
  },
  {
    id: 8,
    startM: 420,
    endM: 500,
    name: "NEEDLE",
    scrollSpeed: 228,
    spawnGap: 158,
    opening: 74,
    weights: { platform: 0.4, wall: 0.9, mover: 0.95, updraft: 0.1 },
    updraftPairChance: 0.08,
    moverSpeed: [140, 185],
  },
  {
    id: 9,
    startM: 500,
    endM: 585,
    name: "FREEFALL",
    scrollSpeed: 245,
    spawnGap: 150,
    opening: 72,
    weights: { platform: 0.35, wall: 0.95, mover: 1, updraft: 0.1 },
    updraftPairChance: 0.07,
    moverSpeed: [150, 195],
  },
  {
    id: 10,
    startM: 585,
    endM: 680,
    name: "PAPER EDGE",
    scrollSpeed: 262,
    spawnGap: 142,
    opening: 70,
    weights: { platform: 0.3, wall: 1, mover: 1.1, updraft: 0.12 },
    updraftPairChance: 0.1,
    moverSpeed: [155, 205],
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
