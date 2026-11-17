// vehicles.js — lalu lintas dan pejalan kaki yang menghidupkan jalanan Neon Bay.
// Mobil traffic melaju mengikuti arah jalannya dan berhenti bila jalurnya terhalang;
// pejalan kaki berkeliaran pelan, lalu panik dan kabur saat ada bahaya di dekatnya.
import { CFG, CAR_COLORS } from './config.js';
import { randomRoadPoint, collidesBuilding } from './world.js';
import { clamp } from './random.js';

export function makeCar(rng, x, y, angle, color) {
  return {
    x, y, angle, speed: 0, vx: 0, vy: 0,
    color: color || rng.pick(CAR_COLORS),
    w: 44, h: 22,
    parked: false, disabled: false,
    axis: null, road: 0, dir: 1, cruise: 90,
  };
}

export function spawnTraffic(state, count) {
  const rng = state.rng;
  const cars = [];
  for (let i = 0; i < count; i++) {
    const pt = randomRoadPoint(rng, state.world);
    const angle = pt.axis === 'v' ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2)
      : (rng.chance(0.5) ? 0 : Math.PI);
    const car = makeCar(rng, pt.x, pt.y, angle);
    car.axis = pt.axis;
    car.road = pt.axis === 'v' ? pt.x : pt.y;
    car.dir = angle === 0 || angle === Math.PI / 2 ? 1 : -1;
    car.cruise = rng.range(65, 115);
    car.speed = car.cruise;
    // Geser ke lajur yang sesuai dengan arah hadapnya.
    const off = 22;
    if (pt.axis === 'v') car.x += (angle === Math.PI / 2 ? -off : off);
    else car.y += (angle === 0 ? off : -off);
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(state, dt) {
  const p = state.player;
  for (const c of state.traffic) {
    if (c.disabled) continue;
    if (c.parked) continue;
    let target = c.cruise;
    for (const o of state.traffic) {
      if (o === c || o.parked || o.disabled) continue;
      const dx = o.x - c.x, dy = o.y - c.y;
      const ahead = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
      const side = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
      if (ahead > 0 && ahead < 78 && side < 20) { target = 0; break; }
    }
    for (const ped of state.peds) {
      const dx = ped.x - c.x, dy = ped.y - c.y;
      const ahead = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
      const side = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
      if (ahead > 0 && ahead < 60 && side < 18) { target = 0; break; }
    }
    c.speed += clamp(target - c.speed, -160 * dt, 120 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    // Kadang belok di persimpangan terdekat supaya sebaran traffic tidak menumpuk.
    if (state.rng.chance(0.0015) && c.speed > 20) {
      const nr = nearestRoadCross(state, c);
      if (nr) {
        c.angle = nr.angle;
        c.axis = nr.axis;
      }
    }
    // Keluar di satu tepi, masuk lagi dari tepi berlawanan.
    if (c.x < 60) { c.x = CFG.WORLD_W - 70; }
    if (c.x > CFG.WORLD_W - 60) { c.x = 70; }
    if (c.y < 60) { c.y = CFG.WORLD_H - 70; }
    if (c.y > CFG.WORLD_H - 60) { c.y = 70; }
    // Menabrak Jax yang sedang jalan kaki mendorongnya dan melukainya.
    if (p.onFoot) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < 26 && Math.abs(c.speed) > 40) {
        p.health = Math.max(0, p.health - 12);
        p.hurtFlash = 1;
        p.x += (p.x - c.x) * 0.4; p.y += (p.y - c.y) * 0.4;
      }
    }
  }
  // Isi ulang armada bila jumlah mobil aktif turun terlalu jauh.
  if (state.traffic.filter((c) => !c.parked && !c.disabled).length < CFG.TRAFFIC_COUNT - 8) {
    const pt = randomRoadPoint(state.rng, state.world);
    const car = makeCar(state.rng, pt.x, pt.y, state.rng.chance(0.5) ? 0 : Math.PI / 2);
    car.axis = pt.axis; car.cruise = state.rng.range(65, 115); car.speed = car.cruise;
    state.traffic.push(car);
  }
}

function nearestRoadCross(state, c) {
  const w = state.world;
  let best = null, bestD = 60;
  for (const rx of w.xs) for (const ry of w.ys) {
    const d = Math.hypot(c.x - rx, c.y - ry);
    if (d < bestD) {
      bestD = d;
      best = state.rng.chance(0.5)
        ? { axis: 'v', angle: state.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 }
        : { axis: 'h', angle: state.rng.chance(0.5) ? 0 : Math.PI };
    }
  }
  return best;
}

export function spawnPeds(state, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const pt = randomRoadPoint(state.rng, state.world);
    peds.push({
      x: pt.x + state.rng.range(-60, 60),
      y: pt.y + state.rng.range(-60, 60),
      angle: state.rng.range(0, Math.PI * 2),
      speed: state.rng.range(28, 55),
      color: state.rng.pick(['#f8fafc', '#fbbf24', '#34d399', '#f472b6', '#93c5fd', '#fb923c']),
      flee: 0, panic: 0,
    });
  }
  return peds;
}

export function updatePeds(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    const dp = Math.hypot(ped.x - p.x, ped.y - p.y);
    const danger = state.gunshotTimer > 0 || (!p.onFoot && Math.abs(p.speed || 0) > 200 && dp < 160);
    if (danger && dp < 220) ped.panic = 2.5;
    if (ped.panic > 0) {
      ped.panic -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = away;
      ped.x += Math.cos(away) * 130 * dt;
      ped.y += Math.sin(away) * 130 * dt;
    } else {
      if (state.rng.chance(0.004)) ped.angle = state.rng.range(0, Math.PI * 2);
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (!collidesBuilding(state.world, nx, ny, 10)) { ped.x = nx; ped.y = ny; }
      else ped.angle += Math.PI / 2;
    }
    ped.x = clamp(ped.x, 30, CFG.WORLD_W - 30);
    ped.y = clamp(ped.y, 30, CFG.WORLD_H - 30);
  }
}
