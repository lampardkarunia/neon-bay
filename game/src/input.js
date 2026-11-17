// input.js — keyboard state, edge-triggered presses
export function createInput() {
  const down = new Set();
  const pressed = new Set();
  const codeMap = (e) => e.code;
  window.addEventListener("keydown", (e) => {
    const c = codeMap(e);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(c)) e.preventDefault();
    if (!down.has(c)) pressed.add(c);
    down.add(c);
  });
  window.addEventListener("keyup", (e) => down.delete(codeMap(e)));
  window.addEventListener("blur", () => { down.clear(); });
  return {
    isDown(...codes) { return codes.some((c) => down.has(c)); },
    wasPressed(...codes) { return codes.some((c) => pressed.has(c)); },
    axisX() {
      let x = 0;
      if (this.isDown("KeyA", "ArrowLeft")) x -= 1;
      if (this.isDown("KeyD", "ArrowRight")) x += 1;
      return x;
    },
    axisY() {
      let y = 0;
      if (this.isDown("KeyW", "ArrowUp")) y -= 1;
      if (this.isDown("KeyS", "ArrowDown")) y += 1;
      return y;
    },
    endFrame() { pressed.clear(); },
  };
}
