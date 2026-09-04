import { HIGH_SCORE_KEY } from "./constants";

export function loadHighScore(): number {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): void {
  try {
    const prev = loadHighScore();
    if (score > prev) {
      localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(score)));
    }
  } catch {
    /* private mode / blocked storage */
  }
}
