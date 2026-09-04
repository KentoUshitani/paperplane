/**
 * Keyboard + pointer (mouse/touch) input.
 * Screen is split left/right for mobile steering.
 */
export class InputHandler {
  private keyLeft = false;
  private keyRight = false;
  private ptrLeft = false;
  private ptrRight = false;
  private actionPressed = false;
  private actionConsumed = false;
  private pointerTapPending = false;

  private readonly canvas: HTMLCanvasElement;
  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onKeyUp: (e: KeyboardEvent) => void;
  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerUp: (e: PointerEvent) => void;
  private readonly onPointerCancel: (e: PointerEvent) => void;
  private readonly onBlur: () => void;

  private activePointers = new Map<number, "left" | "right">();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.onKeyDown = (e) => {
      if (this.isLeft(e.code)) {
        this.keyLeft = true;
        e.preventDefault();
      } else if (this.isRight(e.code)) {
        this.keyRight = true;
        e.preventDefault();
      } else if (e.code === "Space" || e.code === "Enter") {
        if (!e.repeat) this.actionPressed = true;
        e.preventDefault();
      }
    };

    this.onKeyUp = (e) => {
      if (this.isLeft(e.code)) this.keyLeft = false;
      else if (this.isRight(e.code)) this.keyRight = false;
    };

    this.onPointerDown = (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      const side = this.sideFromClientX(e.clientX);
      this.activePointers.set(e.pointerId, side);
      this.pointerTapPending = true;
      this.syncPointerSteer();
      e.preventDefault();
    };

    this.onPointerUp = (e) => {
      this.activePointers.delete(e.pointerId);
      this.syncPointerSteer();
      e.preventDefault();
    };

    this.onPointerCancel = (e) => {
      this.activePointers.delete(e.pointerId);
      this.syncPointerSteer();
    };

    this.onBlur = () => {
      this.keyLeft = false;
      this.keyRight = false;
      this.ptrLeft = false;
      this.ptrRight = false;
      this.activePointers.clear();
    };

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
  }

  /** -1 left, 0 none, 1 right */
  get steer(): number {
    let s = 0;
    if (this.keyLeft || this.ptrLeft) s -= 1;
    if (this.keyRight || this.ptrRight) s += 1;
    return s;
  }

  /** Edge-triggered action (start / retry). Call once per frame. */
  consumeAction(): boolean {
    if (this.actionPressed && !this.actionConsumed) {
      this.actionConsumed = true;
      this.actionPressed = false;
      return true;
    }
    if (!this.actionPressed) this.actionConsumed = false;
    return false;
  }

  /** Treat any pointer tap as action (for title / game over screens). */
  consumePointerAsAction(): boolean {
    if (this.pointerTapPending) {
      this.pointerTapPending = false;
      return true;
    }
    return false;
  }

  private isLeft(code: string): boolean {
    return code === "ArrowLeft" || code === "KeyA";
  }

  private isRight(code: string): boolean {
    return code === "ArrowRight" || code === "KeyD";
  }

  private sideFromClientX(clientX: number): "left" | "right" {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    return x < rect.width / 2 ? "left" : "right";
  }

  private syncPointerSteer(): void {
    let L = false;
    let R = false;
    for (const side of this.activePointers.values()) {
      if (side === "left") L = true;
      if (side === "right") R = true;
    }
    this.ptrLeft = L;
    this.ptrRight = R;
  }
}
