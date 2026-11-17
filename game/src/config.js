// config.js — konstanta pusat untuk NEON BAY, varian HEAT.
// Seluruh angka tuning tinggal di sini supaya modul lain tetap ringkas.
// Kota dan tokohnya orisinal; tidak ada aset luar dan tidak ada jaringan.
export const CFG = {
  VIEW_W: 1280,
  VIEW_H: 720,
  WORLD_W: 3600,
  WORLD_H: 2600,
  ROAD_W: 96,
  ROAD_STEP: 400,
  ROAD_FIRST: 200,
  PLAYER_WALK_SPEED: 210,
  PLAYER_RUN_SPEED: 300,
  CAR_ACCEL: 340,
  CAR_MAX_SPEED: 430,
  CAR_REVERSE_MAX: 150,
  CAR_BRAKE: 520,
  CAR_DRAG: 0.55,
  CAR_STEER: 2.6,
  TRAFFIC_COUNT: 46,
  PED_COUNT: 60,
  MAX_WANTED: 5,
  WANTED_DECAY_SECONDS: 9,
  BULLET_SPEED: 760,
  BULLET_RANGE: 520,
  BULLET_DAMAGE: 34,
  PUNCH_DAMAGE: 25,
  PUNCH_RANGE: 46,
  SAVE_KEY: 'neon-bay-heat-save-v1',
};

export const DISTRICTS = {
  MARINA: { name: 'Marina', color: '#1d4e5f', building: '#2b6a7d', accent: '#39c2d7' },
  DOWNTOWN: { name: 'Downtown', color: '#232338', building: '#3a3a55', accent: '#ff2e88' },
  BARRIO: { name: 'Barrio', color: '#3a2b1e', building: '#6b4a2f', accent: '#ffb347' },
  PORT: { name: 'Portside', color: '#1e2a24', building: '#33503f', accent: '#7dffb0' },
};

export const CAR_COLORS = [
  '#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#457b9d',
  '#9b5de5', '#f15bb5', '#00bbf9', '#c0c0c8', '#222831',
  '#ff6b35', '#06d6a0', '#ffd166', '#ef476f',
];

export const MISSION_REWARDS = { m1: 300, m2: 600, m3: 1000 };

// Palet neon yang dipakai HUD dan penanda di layar.
export const NEON = {
  pink: '#ff2e88',
  cyan: '#22d3ee',
  yellow: '#ffd166',
  green: '#4ade80',
  red: '#ef4444',
  white: '#f8fafc',
};
