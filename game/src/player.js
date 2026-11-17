// player.js — tokoh utama Jax Marlowe dan semua yang melekat padanya:
// gerak jalan kaki, mengemudi dengan sedikit drift, masuk/keluar serta mencuri mobil,
// kesehatan, uang, dan meter wanted yang meluruh saat ia lepas dari pantauan.
import { CFG } from './config.js';
import { clamp, angleDiff } from './random.js';
import { collidesBuilding, inWater, isOnRoad } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    onFoot: true, car: null,
    health: 100, money: 0,
    wanted: 0, wantedTimer: 0, hiddenTimer: 0,
    aimAngle: -Math.PI / 2,
    punchCooldown: 0, shootCooldown: 0,
    hurtFlash: 0, carHealth: 100,
    moving: false,
  };
}

export function addWanted(player, n, reason) {
  const before = player.wanted;
  player.wanted = clamp(player.wanted + n, 0, CFG.MAX_WANTED);
  player.wantedTimer = 0;
  player.hiddenTimer = 0;
  return { before, after: player.wanted, reason };
}

export function updatePlayer(state, input, dt) {
  const p = state.player;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt * 2);

  if (p.onFoot) updateOnFoot(state, input, dt);
  else updateDriving(state, input, dt);

  // Bintang wanted hanya turun bila tidak ada unit polisi (atau heli) yang cukup dekat.
  if (p.wanted > 0) {
    const near = state.police.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 520)
      || (state.heli && Math.hypot(state.heli.x - p.x, state.heli.y - p.y) < 700);
    if (!near) {
      p.hiddenTimer += dt;
      if (p.hiddenTimer > CFG.WANTED_DECAY_SECONDS) {
        p.hiddenTimer = 0;
        p.wanted = Math.max(0, p.wanted - 1);
      }
    } else {
      p.hiddenTimer = 0;
    }
  }
  if (p.health <= 0 && state.mode === 'play') {
    state.mode = 'busted';
  }
}

function updateOnFoot(state, input, dt) {
  const p = state.player;
  const a = input.axis();
  const len = Math.hypot(a.x, a.y) || 1;
  const running = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const spd = running ? CFG.PLAYER_RUN_SPEED : CFG.PLAYER_WALK_SPEED;
  p.moving = (a.x !== 0 || a.y !== 0);
  if (p.moving) {
    const nx = p.x + (a.x / len) * spd * dt;
    const ny = p.y + (a.y / len) * spd * dt;
    if (!collidesBuilding(state.world, nx, p.y, 12) && !inWater(state.world, nx, p.y)) p.x = nx;
    if (!collidesBuilding(state.world, p.x, ny, 12) && !inWater(state.world, p.x, ny)) p.y = ny;
    p.angle = Math.atan2(a.y, a.x);
  }
  // Bidik mengikuti kursor mouse setelah diterjemahkan ke koordinat dunia.
  const wx = state.camera.x + input.mouseX;
  const wy = state.camera.y + input.mouseY;
  p.aimAngle = Math.atan2(wy - p.y, wx - p.x);
  p.x = clamp(p.x, 24, CFG.WORLD_W - 24);
  p.y = clamp(p.y, 24, CFG.WORLD_H - 24);
}

function updateDriving(state, input, dt) {
  const p = state.player;
  const car = p.car;
  if (!car) { p.onFoot = true; return; }
  const a = input.axis();
  const forward = a.y < 0 ? 1 : a.y > 0 ? -1 : 0;
  const steer = a.x;
  if (forward > 0) car.speed += CFG.CAR_ACCEL * dt;
  else if (forward < 0) car.speed -= (car.speed > 0 ? CFG.CAR_BRAKE : CFG.CAR_ACCEL * 0.6) * dt;
  else car.speed -= car.speed * CFG.CAR_DRAG * dt;
  car.speed = clamp(car.speed, -CFG.CAR_REVERSE_MAX, CFG.CAR_MAX_SPEED);
  if (Math.abs(car.speed) < 4 && forward === 0) car.speed = 0;

  // Kemudi terasa lebih berat di kecepatan rendah; di kecepatan tinggi muncul selip.
  const steerAmt = steer * CFG.CAR_STEER * dt * clamp(Math.abs(car.speed) / 120, 0, 1) * (car.speed >= 0 ? 1 : -1);
  car.angle += steerAmt;
  const drift = Math.abs(car.speed) > 260 && Math.abs(steer) > 0.4 ? 0.12 : 0.02;
  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  car.vx = (car.vx || 0) * (1 - drift) + vx * drift;
  car.vy = (car.vy || 0) * (1 - drift) + vy * drift;
  let nx = car.x + car.vx * dt;
  let ny = car.y + car.vy * dt;
  const hit = collidesBuilding(state.world, nx, ny, 20);
  if (hit) {
    car.speed *= -0.25;
    car.vx *= -0.3; car.vy *= -0.3;
    nx = car.x; ny = car.y;
    if (Math.abs(car.speed) > 120) {
      p.carHealth -= 6;
      state.audioCrash = true;
    }
  }
  if (inWater(state.world, nx, ny)) { nx = car.x; ny = car.y; car.speed *= 0.5; }
  car.x = clamp(nx, 30, CFG.WORLD_W - 30);
  car.y = clamp(ny, 30, CFG.WORLD_H - 30);
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
  p.moving = Math.abs(car.speed) > 10;
  if (p.carHealth <= 0) {
    car.disabled = true;
    exitCar(state);
    p.carHealth = 100;
  }
}

// Tombol E: masuk ke mobil terdekat, atau keluar dari mobil yang sedang dipakai.
// Mengambil mobil traffic yang sedang berjalan dihitung sebagai pencurian.
export function tryEnterExitCar(state) {
  const p = state.player;
  if (!p.onFoot) { exitCar(state); return 'exit'; }
  let best = null, bestD = 92;
  for (const c of state.traffic) {
    if (c.disabled) continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best) return null;
  const stolen = !best.parked;
  state.traffic = state.traffic.filter((c) => c !== best);
  best.parked = false; best.disabled = false;
  p.car = best; p.onFoot = false; p.carHealth = 100;
  p.angle = best.angle;
  if (stolen) {
    addWanted(p, 1, 'curi mobil');
    state.toast = 'Mobil dicuri! Wanted +1';
  } else {
    state.toast = 'Masuk mobil';
  }
  return stolen ? 'steal' : 'enter';
}

export function exitCar(state) {
  const p = state.player;
  if (!p.car) return;
  const car = p.car;
  car.parked = true;
  car.speed = 0; car.vx = 0; car.vy = 0;
  car.x += Math.cos(car.angle + Math.PI / 2) * 26;
  car.y += Math.sin(car.angle + Math.PI / 2) * 26;
  state.traffic.push(car);
  p.car = null; p.onFoot = true;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
}

export function hurtPlayer(state, dmg) {
  const p = state.player;
  p.health = Math.max(0, p.health - dmg);
  p.hurtFlash = 1;
}
