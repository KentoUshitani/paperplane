export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 720;

export const COLORS = {
  bg: "#0a0a0a",
  fg: "#e8e8e8",
  dim: "#6a6a6a",
  accent: "#9cdc9c",
  danger: "#e07070",
  wind: "#70a0e0",
} as const;

/** Fallback / HUD reference speeds (actual speed comes from stage defs) */
export const BASE_SCROLL_SPEED = 105;
export const MAX_SCROLL_SPEED = 260;

export const PLAYER = {
  startX: CANVAS_WIDTH / 2,
  startY: CANVAS_HEIGHT * 0.28,
  length: 28,
  wingSpan: 22,
  maxTilt: Math.PI / 3,
  tiltSpeed: 4.6,
  untiltSpeed: 3.0,
  /** Slightly snappier lateral move */
  lateralFactor: 320,
  wrapPadding: 16,
} as const;

export const UPDRAFT = {
  boostDuration: 0.85,
  liftForce: -90,
  speedMul: 0.35,
} as const;

export const SPAWN = {
  initialGap: 280,
  minGap: 140,
  gapShrinkPerMeter: 0.25,
  lanePadding: 40,
} as const;

export const HIGH_SCORE_KEY = "paperplane_highscore";

/** Pixels per in-game meter (depth unit) */
export const PIXELS_PER_METER = 40;
