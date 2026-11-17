// input.js — keadaan keyboard dan mouse untuk satu frame permainan.
// `pressed` bersifat edge-triggered: terisi hanya pada frame tombol pertama kali ditekan.
export function createInput() {
  const keys = new Set();
  const pressed = new Set();
  let mouseX = 0, mouseY = 0, mouseDown = false, mouseClicked = false;

  const input = {
    keys, pressed, mouseX: 0, mouseY: 0,
    get mouseDown() { return mouseDown; },
    get mouseClicked() { return mouseClicked; },
    axis() {
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
    wasPressed(code) { return pressed.has(code); },
    consume(code) { pressed.delete(code); },
    attach(canvas) {
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
        if (!keys.has(e.code)) pressed.add(e.code);
        keys.add(e.code);
      });
      window.addEventListener('keyup', (e) => keys.delete(e.code));
      window.addEventListener('blur', () => keys.clear());
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        mouseX = e.clientX - r.left; mouseY = e.clientY - r.top;
        input.mouseX = mouseX; input.mouseY = mouseY;
      });
      canvas.addEventListener('mousedown', (e) => { mouseDown = true; mouseClicked = true; });
      window.addEventListener('mouseup', () => { mouseDown = false; });
    },
    endFrame() { pressed.clear(); mouseClicked = false; },
  };
  return input;
}
