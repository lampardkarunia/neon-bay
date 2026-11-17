// config.js - Central tuning constants for NEON BAY (HEAT variant)
// All gameplay numbers live here so balancing is easy to audit.

export const WORLD_WIDTH = 2560;
export const WORLD_HEIGHT = 2560;
export const BLOCK_SIZE = 320;
export const ROAD_WIDTH = 88;
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

export const PLAYER_SPEED = 168;
export const PLAYER_RUN_SPEED = 238;
export const PLAYER_RADIUS = 13;
export const PLAYER_MAX_HEALTH = 100;

export const WANTED_MAX = 5;
export const WANTED_DECAY_SECONDS = 8;      // hidden time needed per star drop (tuned in revision: snappier escapes)
export const WANTED_SIGHT_RANGE = 430;      // police vision radius
export const HEAT_FROM_CAR_THEFT = 1;
export const HEAT_FROM_HIT = 1;
export const HEAT_FROM_SHOT = 1;

export const DISTRICTS = [
  { name: "Marina",    color: "#ff7e5f", accent: "#ffd166" },
  { name: "Downtown",  color: "#c77dff", accent: "#48cae4" },
  { name: "Barrio",    color: "#ff9f1c", accent: "#ff5964" },
  { name: "Portside",  color: "#2ec4b6", accent: "#a7c957" },
];

export const VEHICLE_TYPES = {
  sedan: { label: "Sedan",  width: 38, height: 20, accel: 210, maxSpeed: 265, turn: 2.6, grip: 0.92, health: 110, color: "#4cc9f0" },
  sport: { label: "Sport",  width: 40, height: 19, accel: 340, maxSpeed: 390, turn: 3.1, grip: 0.94, health: 85,  color: "#ff2e88" },
  truck: { label: "Truck",  width: 52, height: 24, accel: 145, maxSpeed: 195, turn: 1.9, grip: 0.88, health: 190, color: "#ffd166" },
  police:{ label: "Police", width: 39, height: 20, accel: 285, maxSpeed: 330, turn: 2.9, grip: 0.93, health: 140, color: "#f1fa8c" },
};

export const SAVE_KEY = "neon-bay-save-v1";
export const MUTE_KEY = "neon-bay-muted-v1";

export const COLORS = {
  sky: "#1b1035",
  road: "#2b2d42",
  roadLine: "#ffd166",
  sidewalk: "#3d405b",
  sand: "#e9c46a",
  water: "#118ab2",
  grass: "#2a9d8f",
  buildingRoof: ["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#c77dff", "#ff9f1c", "#f72585", "#4cc9f0"],
  neonPink: "#ff2e88",
  neonCyan: "#00f5d4",
  text: "#ffffff",
};

export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function distanceBetween(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleLerp(a, b, t) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}
