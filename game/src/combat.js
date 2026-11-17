// combat.js — pertarungan jarak dekat dan tembakan.
// Pukulan memakai tombol F atau klik, tembakan memakai Spasi; keduanya bisa
// menaikkan wanted, dan peluru yang beterbangan membuat warga sekitar panik.
import { CFG } from './config.js';
import { addWanted } from './player.js';
import { spawnSparks } from './police.js';

export function tryPunch(state) {
  const p = state.player;
  if (p.punchCooldown > 0 || !p.onFoot) return;
  p.punchCooldown = 0.45;
  state.punchSound = true;
  const px = p.x + Math.cos(p.aimAngle) * 30;
  const py = p.y + Math.sin(p.aimAngle) * 30;
  spawnSparks(state, px, py, 5);
  for (const c of state.police) {
    if (Math.hypot(c.x - p.x, c.y - p.y) < CFG.PUNCH_RANGE + 22) {
      c.health -= CFG.PUNCH_DAMAGE;
      addWanted(p, 1, 'serang polisi');
      state.toast = 'Kau memukul polisi! Wanted naik!';
    }
  }
  for (const ped of state.peds) {
    if (Math.hypot(ped.x - p.x, ped.y - p.y) < CFG.PUNCH_RANGE) {
      ped.panic = 3;
      addWanted(p, 1, 'pukul warga');
    }
  }
}

export function tryShoot(state) {
  const p = state.player;
  if (p.shootCooldown > 0) return;
  p.shootCooldown = 0.32;
  state.shotSound = true;
  state.gunshotTimer = 1.2;
  const angle = p.onFoot ? p.aimAngle : p.angle;
  const ox = p.x + Math.cos(angle) * 26;
  const oy = p.y + Math.sin(angle) * 26;
  state.bullets.push({
    x: ox, y: oy, angle,
    vx: Math.cos(angle) * CFG.BULLET_SPEED,
    vy: Math.sin(angle) * CFG.BULLET_SPEED,
    life: CFG.BULLET_RANGE / CFG.BULLET_SPEED,
  });
  // Suara tembakan sendiri menaikkan wanted, dibatasi sekali tiap dua detik.
  if (!state.lastShotWantedAt || state.time - state.lastShotWantedAt > 2) {
    addWanted(p, 1, 'tembakan');
    state.lastShotWantedAt = state.time;
  }
  for (let i = 0; i < 4; i++) {
    state.particles.push({
      x: ox, y: oy,
      vx: Math.cos(angle) * 200 + state.rng.range(-40, 40),
      vy: Math.sin(angle) * 200 + state.rng.range(-40, 40),
      life: 0.12, maxLife: 0.12,
      color: '#fde047', size: 3,
    });
  }
}

export function updateBullets(state, dt) {
  const p = state.player;
  for (const b of state.bullets) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    for (const c of state.police) {
      if (Math.hypot(c.x - b.x, c.y - b.y) < 24) {
        c.health -= CFG.BULLET_DAMAGE;
        b.life = 0;
        spawnSparks(state, b.x, b.y, 6);
        if (c.health <= 0) {
          c.disabled = true;
          state.toast = 'Mobil polisi dilumpuhkan!';
        }
      }
    }
    for (const c of state.traffic) {
      if (!c.disabled && Math.hypot(c.x - b.x, c.y - b.y) < 24) {
        c.disabled = true;
        b.life = 0;
        spawnSparks(state, b.x, b.y, 6);
      }
    }
    for (const ped of state.peds) {
      if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
        ped.panic = 4;
        b.life = 0;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  const before = state.police.length;
  state.police = state.police.filter((c) => {
    if (c.disabled) {
      spawnSparks(state, c.x, c.y, 10);
      return false;
    }
    return true;
  });
  if (state.police.length < before) state.audioCrash = true;
}

export function updateParticles(state, dt) {
  for (const pt of state.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92; pt.vy *= 0.92;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
}
