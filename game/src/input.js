// input.js - Keyboard state for NEON BAY.
// Tracks held keys plus one-shot "pressed this frame" edges for actions.

export class InputState {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.enabled = true;
    this._onKeyDown = (event) => this.handleKeyDown(event);
    this._onKeyUp = (event) => this.handleKeyUp(event);
    this._onBlur = () => { this.keys.clear(); this.pressed.clear(); };
  }

  attach() {
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("blur", this._onBlur);
  }

  detach() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
  }

  normalise(code) {
    return String(code || "").toLowerCase();
  }

  handleKeyDown(event) {
    const code = this.normalise(event.code || event.key);
    const key = this.normalise(event.key);
    if (!this.keys.has(code)) this.pressed.add(code);
    this.keys.add(code);
    this.keys.add(key);
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "space", " "].includes(code) ||
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
      if (event.preventDefault) event.preventDefault();
    }
  }

  handleKeyUp(event) {
    const code = this.normalise(event.code || event.key);
    const key = this.normalise(event.key);
    this.keys.delete(code);
    this.keys.delete(key);
  }

  isDown(...names) {
    if (!this.enabled) return false;
    for (const name of names) {
      if (this.keys.has(this.normalise(name))) return true;
    }
    return false;
  }

  wasPressed(...names) {
    for (const name of names) {
      if (this.pressed.has(this.normalise(name))) return true;
    }
    return false;
  }

  // Movement axes: x -1..1, y -1..1 from WASD or arrow keys.
  moveAxis() {
    let x = 0;
    let y = 0;
    if (this.isDown("KeyA", "a", "ArrowLeft")) x -= 1;
    if (this.isDown("KeyD", "d", "ArrowRight")) x += 1;
    if (this.isDown("KeyW", "w", "ArrowUp")) y -= 1;
    if (this.isDown("KeyS", "s", "ArrowDown")) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  endFrame() {
    this.pressed.clear();
  }

  clearAll() {
    this.keys.clear();
    this.pressed.clear();
  }
}

export function createInput() {
  const input = new InputState();
  input.attach();
  return input;
}
