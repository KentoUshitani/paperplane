export type Vec2 = { x: number; y: number };

export type GameState = "title" | "playing" | "gameover" | "clear";

export type ObstacleKind = "platform" | "wall" | "mover" | "updraft";

export interface CircleHitbox {
  kind: "circle";
  x: number;
  y: number;
  r: number;
}

export interface RectHitbox {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PolyHitbox {
  kind: "poly";
  points: Vec2[];
}

export type Hitbox = CircleHitbox | RectHitbox | PolyHitbox;

export interface CrashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  len: number;
  angle: number;
}
