import type { Hitbox, Vec2 } from "./types";

function pointInPoly(px: number, py: number, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Vec2 {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLen2 = abx * abx + aby * aby;
  if (abLen2 === 0) return { x: ax, y: ay };
  let t = (apx * abx + apy * aby) / abLen2;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + abx * t, y: ay + aby * t };
}

function circlePolyOverlap(
  cx: number,
  cy: number,
  r: number,
  poly: Vec2[],
): boolean {
  if (pointInPoly(cx, cy, poly)) return true;
  const r2 = r * r;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const p = closestPointOnSegment(cx, cy, poly[j].x, poly[j].y, poly[i].x, poly[i].y);
    if (dist2(cx, cy, p.x, p.y) <= r2) return true;
  }
  return false;
}

function satAxes(poly: Vec2[]): Vec2[] {
  const axes: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const edgeX = b.x - a.x;
    const edgeY = b.y - a.y;
    const len = Math.hypot(edgeX, edgeY) || 1;
    axes.push({ x: -edgeY / len, y: edgeX / len });
  }
  return axes;
}

function project(poly: Vec2[], axis: Vec2): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = p.x * axis.x + p.y * axis.y;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
}

function polyPolyOverlap(a: Vec2[], b: Vec2[]): boolean {
  const axes = [...satAxes(a), ...satAxes(b)];
  for (const axis of axes) {
    const pa = project(a, axis);
    const pb = project(b, axis);
    if (pa.max < pb.min || pb.max < pa.min) return false;
  }
  return true;
}

function rectToPoly(x: number, y: number, w: number, h: number): Vec2[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

function hitboxToPoly(h: Hitbox): Vec2[] | null {
  if (h.kind === "poly") return h.points;
  if (h.kind === "rect") return rectToPoly(h.x, h.y, h.w, h.h);
  return null;
}

/** Precise collision between two hitboxes (poly / rect / circle). */
export function hitboxesOverlap(a: Hitbox, b: Hitbox): boolean {
  if (a.kind === "circle" && b.kind === "circle") {
    const r = a.r + b.r;
    return dist2(a.x, a.y, b.x, b.y) <= r * r;
  }

  if (a.kind === "circle" || b.kind === "circle") {
    const circle = a.kind === "circle" ? a : (b as Extract<Hitbox, { kind: "circle" }>);
    const other = a.kind === "circle" ? b : a;
    const poly = hitboxToPoly(other);
    if (!poly) return false;
    return circlePolyOverlap(circle.x, circle.y, circle.r, poly);
  }

  const pa = hitboxToPoly(a);
  const pb = hitboxToPoly(b);
  if (!pa || !pb) return false;
  return polyPolyOverlap(pa, pb);
}
