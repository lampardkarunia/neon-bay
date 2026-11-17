// world.js - Procedural city of Neon Bay: road grid, buildings, districts.
// The city is deterministic for a given RNG so screenshots are stable.

import { WORLD_WIDTH, WORLD_HEIGHT, BLOCK_SIZE, ROAD_WIDTH, DISTRICTS, COLORS } from "./config.js";

export function roadCenters() {
  const centers = [];
  for (let c = BLOCK_SIZE / 2; c < WORLD_WIDTH; c += BLOCK_SIZE) centers.push(c);
  return centers;
}

export function isOnRoad(x, y) {
  const half = ROAD_WIDTH / 2;
  const mx = ((x % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE;
  const my = ((y % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE;
  const centre = BLOCK_SIZE / 2;
  const nearVerticalRoad = Math.abs(mx - centre) < half;
  const nearHorizontalRoad = Math.abs(my - centre) < half;
  return nearVerticalRoad || nearHorizontalRoad;
}

export function nearestRoadPoint(x, y) {
  const cx = Math.round((x - BLOCK_SIZE / 2) / BLOCK_SIZE) * BLOCK_SIZE + BLOCK_SIZE / 2;
  const cy = Math.round((y - BLOCK_SIZE / 2) / BLOCK_SIZE) * BLOCK_SIZE + BLOCK_SIZE / 2;
  if (Math.abs(x - cx) < Math.abs(y - cy)) return { x: cx, y };
  return { x, y: cy };
}

export function districtAt(x, y) {
  const east = x >= WORLD_WIDTH / 2;
  const south = y >= WORLD_HEIGHT / 2;
  if (!east && !south) return DISTRICTS[0]; // Marina, north-west
  if (east && !south) return DISTRICTS[1];  // Downtown, north-east
  if (!east && south) return DISTRICTS[2];  // Barrio, south-west
  return DISTRICTS[3];                       // Portside, south-east
}

export function districtIndexAt(x, y) {
  const d = districtAt(x, y);
  return DISTRICTS.findIndex((entry) => entry.name === d.name);
}

export class World {
  constructor(rng) {
    this.width = WORLD_WIDTH;
    this.height = WORLD_HEIGHT;
    this.buildings = [];
    this.trees = [];
    this.lamps = [];
    this.props = [];
    this.buildCity(rng);
  }

  buildCity(rng) {
    const blocksPerSide = Math.floor(WORLD_WIDTH / BLOCK_SIZE);
    for (let bx = 0; bx < blocksPerSide; bx++) {
      for (let by = 0; by < blocksPerSide; by++) {
        const blockX = bx * BLOCK_SIZE;
        const blockY = by * BLOCK_SIZE;
        // Each block holds 2x2 buildings with a small plaza gap.
        for (let i = 0; i < 2; i++) {
          for (let j = 0; j < 2; j++) {
            if (rng.chance(0.12)) continue;
            const w = rng.range(62, 96);
            const h = rng.range(62, 96);
            const x = blockX + 28 + i * 118 + rng.range(-6, 6);
            const y = blockY + 28 + j * 118 + rng.range(-6, 6);
            // Keep the spawn plaza (centre-west) clear.
            if (Math.abs(x + w / 2 - 480) < 120 && Math.abs(y + h / 2 - 480) < 120) continue;
            this.buildings.push({
              x, y, w, h,
              color: rng.pick(COLORS.buildingRoof),
              floors: rng.int(2, 9),
              neon: rng.chance(0.45),
              name: rng.pick(["Cafe", "Hotel", "Garage", "Bar", "Shop", "Gym", "Clinic", "Studio"]),
            });
          }
        }
        if (rng.chance(0.7)) {
          this.trees.push({ x: blockX + rng.range(30, 290), y: blockY + rng.range(30, 290), r: rng.range(9, 15) });
        }
        this.lamps.push({ x: blockX + BLOCK_SIZE / 2 - ROAD_WIDTH / 2 - 8, y: blockY + BLOCK_SIZE / 2 });
        this.lamps.push({ x: blockX + BLOCK_SIZE / 2 + ROAD_WIDTH / 2 + 8, y: blockY + BLOCK_SIZE / 2 });
      }
    }
    // Beach strip along the west edge and a marina pier.
    this.props.push({ kind: "beach", x: 0, y: 0, w: 56, h: WORLD_HEIGHT });
    this.props.push({ kind: "pier", x: 0, y: 900, w: 150, h: 26 });
    this.props.push({ kind: "pier", x: 0, y: 1250, w: 150, h: 26 });
  }

  buildingAt(x, y, radius) {
    for (const b of this.buildings) {
      if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return b;
    }
    return null;
  }

  collides(x, y, radius) {
    if (x < radius || y < radius || x > this.width - radius || y > this.height - radius) return true;
    return this.buildingAt(x, y, radius) !== null;
  }

  // Push a circular entity out of buildings; returns corrected position.
  resolveCollision(x, y, radius) {
    let nx = Math.max(radius, Math.min(this.width - radius, x));
    let ny = Math.max(radius, Math.min(this.height - radius, y));
    const b = this.buildingAt(nx, ny, radius);
    if (b) {
      const left = Math.abs(nx + radius - b.x);
      const right = Math.abs(b.x + b.w - (nx - radius));
      const top = Math.abs(ny + radius - b.y);
      const bottom = Math.abs(b.y + b.h - (ny - radius));
      const smallest = Math.min(left, right, top, bottom);
      if (smallest === left) nx = b.x - radius - 0.5;
      else if (smallest === right) nx = b.x + b.w + radius + 0.5;
      else if (smallest === top) ny = b.y - radius - 0.5;
      else ny = b.y + b.h + radius + 0.5;
    }
    return { x: nx, y: ny };
  }

  randomRoadPoint(rng) {
    const centers = roadCenters();
    const vertical = rng.chance(0.5);
    const lane = rng.pick(centers) + rng.range(-22, 22);
    const along = rng.range(60, WORLD_WIDTH - 60);
    return vertical ? { x: lane, y: along } : { x: along, y: lane };
  }

  randomSidewalkPoint(rng) {
    for (let tries = 0; tries < 30; tries++) {
      const x = rng.range(70, WORLD_WIDTH - 70);
      const y = rng.range(70, WORLD_HEIGHT - 70);
      if (!this.collides(x, y, 14) && !isOnRoad(x, y)) return { x, y };
      if (!this.collides(x, y, 14)) return { x, y };
    }
    return { x: 480, y: 480 };
  }
}

export function createWorld(rng) {
  return new World(rng);
}
