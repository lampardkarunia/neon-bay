// config.js - Central tuning and world constants for Neon Bay (HEAT variant).
// All gameplay numbers live here so other modules stay logic-only.

export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 2400;
export const BLOCK_SIZE = 400;
export const ROAD_WIDTH = 92;
export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;

export const PLAYER_SPEED = 178;
export const PLAYER_RADIUS = 13;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_PUNCH_RANGE = 42;
export const PLAYER_PUNCH_DAMAGE = 34;
export const PLAYER_PUNCH_COOLDOWN = 0.32;
export const BULLET_SPEED = 640;
export const BULLET_DAMAGE = 38;
export const BULLET_COOLDOWN = 0.24;
export const BULLET_LIFETIME = 0.7;

export const WANTED_MAX = 5;
export const WANTED_DECAY_SECONDS = 9;
export const HEAT_FOR_CAR_THEFT = 1;
export const HEAT_FOR_HIT = 1;
export const HEAT_FOR_SHOT = 1;

export const SAVE_KEY = "neon-bay-save-v1";

export const DISTRICTS = [
  { name: "Marina", x: 0, y: 0, w: 1600, h: 1200, tint: "#ff9a5c" },
  { name: "Downtown", x: 1600, y: 0, w: 1600, h: 1200, tint: "#ff5c8a" },
  { name: "Barrio", x: 0, y: 1200, w: 1600, h: 1200, tint: "#c86bff" },
  { name: "Portside", x: 1600, y: 1200, w: 1600, h: 1200, tint: "#3ec6e0" },
];

export const VEHICLE_TYPES = {
  sedan: {
    label: "Sedan",
    width: 44,
    height: 22,
    maxSpeed: 300,
    accel: 210,
    brake: 320,
    turnRate: 2.6,
    health: 120,
    colours: ["#e74c3c", "#3498db", "#f1c40f", "#ecf0f1", "#9b59b6", "#1abc9c"],
  },
  sport: {
    label: "Sport Coupe",
    width: 46,
    height: 21,
    maxSpeed: 430,
    accel: 330,
    brake: 360,
    turnRate: 3.1,
    health: 90,
    colours: ["#ff2e88", "#ff8c1a", "#ffe600", "#00e5ff", "#b6ff00"],
  },
  truck: {
    label: "Van / Truck",
    width: 56,
    height: 26,
    maxSpeed: 225,
    accel: 150,
    brake: 260,
    turnRate: 2.0,
    health: 210,
    colours: ["#95a5a6", "#f39c12", "#2ecc71", "#e67e22", "#dfe6e9"],
  },
  police: {
    label: "Police Cruiser",
    width: 45,
    height: 22,
    maxSpeed: 390,
    accel: 300,
    brake: 380,
    turnRate: 3.0,
    health: 160,
    colours: ["#101828"],
  },
};

export const PALETTE = {
  sky: "#2b1055",
  groundMarina: "#f7b267",
  groundDowntown: "#8d6e9f",
  groundBarrio: "#7fb069",
  groundPortside: "#4a7c8c",
  sidewalk: "#d9c7a7",
  road: "#2f3542",
  roadLine: "#ffd32a",
  water: "#118ab2",
  sand: "#ffd166",
  buildingRoofs: [
    "#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#9b5de5",
    "#f15bb5", "#00bbf9", "#fee440", "#e07a5f", "#3d405b",
    "#81b29a", "#f2cc8f", "#e63946", "#457b9d", "#a8dadc",
  ],
};

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}
