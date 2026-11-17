// config.js — central tuning constants for NEON BAY (HEAT variant)
export const CONFIG = {
  canvasWidth: 1280,
  canvasHeight: 720,
  worldWidth: 3200,
  worldHeight: 2400,
  tileRoad: 200,
  playerSpeed: 170,
  playerRadius: 13,
  playerMaxHealth: 100,
  interactRange: 52,
  wantedDecaySeconds: 14,
  wantedPerCrime: { steal: 1, hitPed: 1, hitCar: 0.5, shoot: 1, punch: 0.5 },
  policePerStar: 2,
  moneyStart: 120,
  saveKey: "neon-bay-save-v1",
  districts: [
    { name: "Marina", x: 0, y: 0, w: 1600, h: 1200, color: "#123a4d" },
    { name: "Downtown", x: 1600, y: 0, w: 1600, h: 1200, color: "#2b1d3d" },
    { name: "Barrio", x: 0, y: 1200, w: 1600, h: 1200, color: "#3d2417" },
    { name: "Portside", x: 1600, y: 1200, w: 1600, h: 1200, color: "#1c2f22" },
  ],
  vehicleTypes: {
    sedan: { label: "Sedan", accel: 260, maxSpeed: 340, turn: 2.6, health: 100, w: 44, h: 22, colors: ["#c94f6d", "#4f7ec9", "#e0b341", "#7ac74f", "#eeeeee"] },
    sport: { label: "Sport", accel: 420, maxSpeed: 520, turn: 3.4, health: 70, w: 46, h: 21, colors: ["#ff2e88", "#00e5ff", "#ffe600", "#ff6d00"] },
    truck: { label: "Truck", accel: 170, maxSpeed: 240, turn: 1.7, health: 180, w: 58, h: 28, colors: ["#8d6e63", "#607d8b", "#a1887f", "#90a4ae"] },
    police: { label: "Police", accel: 380, maxSpeed: 480, turn: 3.1, health: 130, w: 46, h: 22, colors: ["#111318"] },
  },
};
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.hypot(dx, dy); }
export function angleTo(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
