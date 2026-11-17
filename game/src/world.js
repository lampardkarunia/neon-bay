// world.js — pembangunan kota Neon Bay secara prosedural dari sebuah seed.
// Isinya: grid jalan reguler, empat distrik, gedung, taman, pohon, dan dua area air.
// Modul ini juga menyediakan query yang dipakai gameplay: jalan, tabrakan, dan air.
import { CFG, DISTRICTS } from './config.js';
import { makeRng, clamp } from './random.js';

export function roadXs() {
  const xs = [];
  for (let x = CFG.ROAD_FIRST; x < CFG.WORLD_W; x += CFG.ROAD_STEP) xs.push(x);
  return xs;
}
export function roadYs() {
  const ys = [];
  for (let y = CFG.ROAD_FIRST; y < CFG.WORLD_H; y += CFG.ROAD_STEP) ys.push(y);
  return ys;
}

// Pembagian distrik murni berdasarkan posisi di peta.
export function districtAt(x, y) {
  if (x < 700) return DISTRICTS.MARINA;
  if (x > CFG.WORLD_W - 700) return DISTRICTS.PORT;
  if (y > CFG.WORLD_H - 700) return DISTRICTS.BARRIO;
  return DISTRICTS.DOWNTOWN;
}

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const xs = roadXs();
  const ys = roadYs();
  const buildings = [];
  const trees = [];
  const parks = [];

  // Teluk di sisi barat dan pelabuhan di sudut timur-selatan.
  const water = [
    { x: 0, y: 0, w: 120, h: 900, label: 'Teluk Neon' },
    { x: CFG.WORLD_W - 110, y: CFG.WORLD_H - 800, w: 110, h: 800, label: 'Pelabuhan' },
  ];

  for (let ix = 0; ix < xs.length - 1; ix++) {
    for (let iy = 0; iy < ys.length - 1; iy++) {
      const bx0 = xs[ix] + CFG.ROAD_W / 2 + 14;
      const by0 = ys[iy] + CFG.ROAD_W / 2 + 14;
      const bx1 = xs[ix + 1] - CFG.ROAD_W / 2 - 14;
      const by1 = ys[iy + 1] - CFG.ROAD_W / 2 - 14;
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      const d = districtAt(cx, cy);
      // Sebagian blok dibiarkan kosong sebagai taman berpohon.
      if (rng.chance(0.12)) {
        parks.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 });
        for (let t = 0; t < 7; t++) {
          trees.push({ x: rng.range(bx0 + 20, bx1 - 20), y: rng.range(by0 + 20, by1 - 20), r: rng.range(7, 12) });
        }
        continue;
      }
      const tall = d === DISTRICTS.DOWNTOWN;
      const n = tall ? rng.int(2, 3) : rng.int(1, 2);
      const bw = (bx1 - bx0) / n;
      for (let k = 0; k < n; k++) {
        const w = bw - 18;
        const h = rng.range((by1 - by0) * 0.45, by1 - by0 - 16);
        const x = bx0 + k * bw + 9;
        const y = by0 + rng.range(6, Math.max(7, (by1 - by0) - h - 6));
        buildings.push({
          x, y, w, h,
          district: d.name,
          color: shade(d.building, rng.range(-14, 18)),
          roof: shade(d.accent, rng.range(-30, 10)),
          tall,
          hgt: tall ? rng.range(26, 60) : rng.range(8, 18),
        });
      }
      for (let t = 0; t < 3; t++) {
        trees.push({ x: rng.range(bx0, bx1), y: rng.range(by0, by1), r: rng.range(6, 10) });
      }
    }
  }

  return { seed, xs, ys, buildings, trees, parks, water };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255);
  const g = clamp(((n >> 8) & 0xff) + amt, 0, 255);
  const b = clamp((n & 0xff) + amt, 0, 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

export function isOnRoad(world, x, y) {
  const half = CFG.ROAD_W / 2;
  for (const rx of world.xs) if (Math.abs(x - rx) < half) return true;
  for (const ry of world.ys) if (Math.abs(y - ry) < half) return true;
  return false;
}

export function nearestRoadPoint(world, x, y) {
  let best = null, bestD = Infinity;
  for (const rx of world.xs) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y: clamp(y, 80, CFG.WORLD_H - 80), axis: 'v' }; }
  }
  for (const ry of world.ys) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x: clamp(x, 80, CFG.WORLD_W - 80), y: ry, axis: 'h' }; }
  }
  return best;
}

export function collidesBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export function inWater(world, x, y) {
  for (const w of world.water) {
    if (x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) return true;
  }
  return false;
}

export function randomRoadPoint(rng, world) {
  if (rng.chance(0.5)) {
    const rx = rng.pick(world.xs);
    return { x: rx + rng.range(-20, 20), y: rng.range(120, CFG.WORLD_H - 120), axis: 'v' };
  }
  const ry = rng.pick(world.ys);
  return { x: rng.range(160, CFG.WORLD_W - 160), y: ry + rng.range(-20, 20), axis: 'h' };
}
