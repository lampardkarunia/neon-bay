// world.js - Neon Bay city generation: road grid, buildings, props, peds.
// The city is fully procedural from the seeded RNG so shots are stable.

import {
  WORLD_WIDTH, WORLD_HEIGHT, BLOCK_SIZE, ROAD_WIDTH, PALETTE, DISTRICTS,
} from "./config.js";
import { getRng } from "./random.js";

export function isRoad(x, y) {
  const mx = ((x % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE;
  const my = ((y % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE;
  const half = ROAD_WIDTH / 2;
  const centre = BLOCK_SIZE / 2;
  return Math.abs(mx - centre) < half || Math.abs(my - centre) < half;
}

export function nearestRoadPoint(x, y) {
  const cx = Math.round((x - BLOCK_SIZE / 2) / BLOCK_SIZE) * BLOCK_SIZE + BLOCK_SIZE / 2;
  const cy = Math.round((y - BLOCK_SIZE / 2) / BLOCK_SIZE) * BLOCK_SIZE + BLOCK_SIZE / 2;
  if (Math.abs(x - cx) < Math.abs(y - cy)) return { x: cx, y };
  return { x, y: cy };
}

export function clampToWorld(entity, margin) {
  const m = margin || 20;
  entity.x = Math.max(m, Math.min(WORLD_WIDTH - m, entity.x));
  entity.y = Math.max(m, Math.min(WORLD_HEIGHT - m, entity.y));
}

export function buildWorld() {
  const rng = getRng();
  const buildings = [];
  const trees = [];
  const lamps = [];

  for (let bx = 0; bx < WORLD_WIDTH / BLOCK_SIZE; bx++) {
    for (let by = 0; by < WORLD_HEIGHT / BLOCK_SIZE; by++) {
      const baseX = bx * BLOCK_SIZE;
      const baseY = by * BLOCK_SIZE;
      // Four building lots per block, tucked between the crossing roads.
      const lots = [
        { x: baseX + 42, y: baseY + 42 },
        { x: baseX + 218, y: baseY + 42 },
        { x: baseX + 42, y: baseY + 218 },
        { x: baseX + 218, y: baseY + 218 },
      ];
      for (const lot of lots) {
        const w = rng.range(92, 138);
        const h = rng.range(92, 138);
        buildings.push({
          x: lot.x, y: lot.y, w, h,
          colour: rng.pick(PALETTE.buildingRoofs),
          trim: rng.pick(["#ffffff", "#ffeaa7", "#81ecec", "#fab1a0"]),
          floors: rng.int(2, 9),
        });
      }
      for (let i = 0; i < 3; i++) {
        trees.push({
          x: baseX + rng.range(30, BLOCK_SIZE - 30),
          y: baseY + rng.range(30, BLOCK_SIZE - 30),
          r: rng.range(9, 16),
          colour: rng.pick(["#00b894", "#00cec9", "#55efc4", "#26de81"]),
        });
      }
      lamps.push({ x: baseX + 200, y: baseY + 168 });
      lamps.push({ x: baseX + 168, y: baseY + 200 });
    }
  }

  const pedestrians = [];
  for (let i = 0; i < 46; i++) {
    const road = nearestRoadPoint(rng.range(80, WORLD_WIDTH - 80), rng.range(80, WORLD_HEIGHT - 80));
    pedestrians.push({
      x: road.x + rng.range(-34, 34),
      y: road.y + rng.range(-34, 34),
      vx: 0, vy: 0,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(34, 62),
      colour: rng.pick(["#ffeaa7", "#fab1a0", "#81ecec", "#a29bfe", "#fd79a8", "#e17055"]),
      shirt: rng.pick(["#d63031", "#0984e3", "#00b894", "#e84393", "#fdcb6e", "#6c5ce7"]),
      wanderTimer: rng.range(0.5, 3),
      health: 60,
      down: false,
      fleeing: 0,
    });
  }

  return {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    buildings,
    trees,
    lamps,
    pedestrians,
    districts: DISTRICTS,
  };
}

export function collidesWithBuilding(world, x, y, radius) {
  for (const b of world.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) {
      return b;
    }
  }
  return null;
}

export function resolveBuildingCollision(world, entity, radius) {
  const hit = collidesWithBuilding(world, entity.x, entity.y, radius);
  if (!hit) return false;
  const left = Math.abs(entity.x + radius - hit.x);
  const right = Math.abs(hit.x + hit.w - (entity.x - radius));
  const top = Math.abs(entity.y + radius - hit.y);
  const bottom = Math.abs(hit.y + hit.h - (entity.y - radius));
  const smallest = Math.min(left, right, top, bottom);
  if (smallest === left) entity.x = hit.x - radius - 0.5;
  else if (smallest === right) entity.x = hit.x + hit.w + radius + 0.5;
  else if (smallest === top) entity.y = hit.y - radius - 0.5;
  else entity.y = hit.y + hit.h + radius + 0.5;
  return true;
}

export function updatePedestrians(world, dt, danger) {
  const rng = getRng();
  for (const ped of world.pedestrians) {
    if (ped.down) continue;
    ped.wanderTimer -= dt;
    if (danger) {
      const dx = ped.x - danger.x;
      const dy = ped.y - danger.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 170 && dist > 0.01) ped.fleeing = 1.2;
    }
    if (ped.fleeing > 0) {
      ped.fleeing -= dt;
      const dx = ped.x - (danger ? danger.x : ped.x);
      const dy = ped.y - (danger ? danger.y : ped.y);
      const len = Math.hypot(dx, dy) || 1;
      ped.x += (dx / len) * ped.speed * 2.1 * dt;
      ped.y += (dy / len) * ped.speed * 2.1 * dt;
      ped.angle = Math.atan2(dy, dx);
    } else {
      if (ped.wanderTimer <= 0) {
        ped.wanderTimer = rng.range(1, 3.4);
        ped.angle = rng.range(0, Math.PI * 2);
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
    clampToWorld(ped, 16);
    resolveBuildingCollision(world, ped, 10);
  }
}

export function districtNameAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return "Marina";
}
