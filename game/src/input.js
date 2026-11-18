// input.js - Keyboard state with edge detection for one-shot actions.

const TRACKED = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "KeyE", "KeyF", "Space", "KeyP", "KeyM", "Enter",
]);

export class Input {
  constructor(target) {
    this.down = new Set();
    this.pressed = new Set();
    this.target = target || window;
    this.onKeyDown = (event) => {
      if (TRACKED.has(event.code)) event.preventDefault();
      if (!this.down.has(event.code)) this.pressed.add(event.code);
      this.down.add(event.code);
    };
    this.onKeyUp = (event) => {
      this.down.delete(event.code);
    };
    this.onBlur = () => {
      this.down.clear();
      this.pressed.clear();
    };
    this.target.addEventListener("keydown", this.onKeyDown);
    this.target.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  isDown(code) {
    return this.down.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  axisX() {
    let x = 0;
    if (this.isDown("KeyA") || this.isDown("ArrowLeft")) x -= 1;
    if (this.isDown("KeyD") || this.isDown("ArrowRight")) x += 1;
    return x;
  }

  axisY() {
    let y = 0;
    if (this.isDown("KeyW") || this.isDown("ArrowUp")) y -= 1;
    if (this.isDown("KeyS") || this.isDown("ArrowDown")) y += 1;
    return y;
  }

  endFrame() {
    this.pressed.clear();
  }

  destroy() {
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }
}

export function anyMovementKey(input) {
  return input.axisX() !== 0 || input.axisY() !== 0;
}
