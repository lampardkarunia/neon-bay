// police.js — respons kepolisian Neon Bay untuk varian HEAT.
// Jumlah patroli mengikuti bintang wanted; patroli mengejar dan menabrak,
// wanted 3+ memunculkan roadblock, dan wanted 5 mendatangkan helikopter.
import { CFG } from './config.js';
import { angleDiff, clamp } from './random.js';
import { nearestRoadPoint, randomRoadPoint } from './world.js';
import { hurtPlayer } from './player.js';

export function createPoliceState() {
  return {
    police: [],
    roadblocks: [],
    heli: null,
    spawnTimer: 0,
    roadblockTimer: 0,
  };
}

function policeTargetCount(wanted) {
  return [0, 2, 3, 4, 6, 8][wanted] || 0;
}

export function updatePolice(state, dt) {
  const p = state.player;
  const wanted = p.wanted;
  const pol = state.police;

  state.spawnTimer -= dt;
  if (wanted > 0 && pol.length < policeTargetCount(wanted) && state.spawnTimer <= 0) {
    state.spawnTimer = wanted >= 4 ? 1.2 : 2.2;
    const pt = randomRoadPoint(state.rng, state.world);
    let sx = pt.x, sy = pt.y;
    if (Math.hypot(sx - p.x, sy - p.y) < 420) { sx = p.x + 500; sy = p.y - 300; }
    pol.push({
      x: clamp(sx, 60, CFG.WORLD_W - 60), y: clamp(sy, 60, CFG.WORLD_H - 60),
      angle: Math.atan2(p.y - sy, p.x - sx),
      speed: 0, health: 60, sirenPhase: state.rng.range(0, 6),
      ramCooldown: 0, stuck: 0,
    });
  }
  if (wanted === 0 && pol.length > 0 && state.spawnTimer <= -4) {
    pol.pop();
    state.spawnTimer = 0;
  }

  for (const c of pol) {
    c.ramCooldown = Math.max(0, c.ramCooldown - dt);
    c.sirenPhase += dt;
    const targetAngle = Math.atan2(p.y - c.y, p.x - c.x);
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    const maxSpeed = 300 + wanted * 18 + (p.onFoot ? -40 : 0);
    const steer = clamp(angleDiff(c.angle, targetAngle), -1, 1);
    c.angle += steer * 2.4 * dt * clamp(Math.abs(c.speed) / 80 + 0.4, 0, 1.6);
    c.speed += clamp(maxSpeed - c.speed, -260 * dt, 200 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (d < 46 && c.ramCooldown <= 0) {
      c.ramCooldown = 1.1;
      c.speed *= 0.4;
      if (p.onFoot) hurtPlayer(state, 14);
      else {
        p.carHealth -= 12;
        state.audioCrash = true;
        if (p.car) { p.car.speed *= 0.55; }
      }
      spawnSparks(state, c.x, c.y, 8);
    }
    for (const o of pol) {
      if (o === c) continue;
      const dd = Math.hypot(o.x - c.x, o.y - c.y);
      if (dd < 40 && dd > 0.01) {
        c.x += (c.x - o.x) / dd * 12 * dt;
        c.y += (c.y - o.y) / dd * 12 * dt;
      }
    }
    c.x = clamp(c.x, 40, CFG.WORLD_W - 40);
    c.y = clamp(c.y, 40, CFG.WORLD_H - 40);
  }

  updateRoadblocks(state, dt);
  updateHeli(state, dt);
}

function updateRoadblocks(state, dt) {
  const p = state.player;
  if (p.wanted >= 3) {
    state.roadblockTimer -= dt;
    if (state.roadblockTimer <= 0 && state.roadblocks.length < (p.wanted >= 4 ? 2 : 1)) {
      state.roadblockTimer = 14;
      const ahead = 620;
      const ax = p.x + Math.cos(p.angle) * ahead;
      const ay = p.y + Math.sin(p.angle) * ahead;
      const rp = nearestRoadPoint(state.world, clamp(ax, 100, CFG.WORLD_W - 100), clamp(ay, 100, CFG.WORLD_H - 100));
      const block = { x: rp.x, y: rp.y, axis: rp.axis, cars: [], ttl: 45 };
      const perp = rp.axis === 'v' ? 0 : Math.PI / 2;
      for (let i = -1; i <= 1; i++) {
        block.cars.push({
          x: rp.x + Math.cos(perp) * i * 46,
          y: rp.y + Math.sin(perp) * i * 46,
          angle: perp + (rp.axis === 'v' ? Math.PI / 2 : 0),
          color: '#1e3a8a',
        });
      }
      state.roadblocks.push(block);
      state.toast = 'ROADBLOCK di depan! Wanted ' + p.wanted;
    }
  }
  for (const b of state.roadblocks) {
    b.ttl -= dt;
    const pl = state.player;
    if (!pl.onFoot && pl.car) {
      for (const bc of b.cars) {
        const d = Math.hypot(bc.x - pl.x, bc.y - pl.y);
        if (d < 42) {
          pl.carHealth -= 18;
          pl.car.speed *= -0.35;
          state.audioCrash = true;
          spawnSparks(state, pl.x, pl.y, 12);
        }
      }
    }
  }
  state.roadblocks = state.roadblocks.filter((b) => b.ttl > 0 && state.player.wanted >= 3);
}

function updateHeli(state, dt) {
  const p = state.player;
  if (p.wanted >= 5) {
    if (!state.heli) {
      state.heli = { x: p.x - 260, y: p.y - 260, angle: 0, rotor: 0, spotlight: 0 };
      state.toast = 'HELIKOPTER polisi di atasmu!';
    }
    const h = state.heli;
    h.rotor += dt * 22;
    h.angle = Math.atan2(p.y - h.y, p.x - h.x);
    const d = Math.hypot(p.x - h.x, p.y - h.y);
    const sp = clamp(d * 0.9, 120, 320);
    h.x += Math.cos(h.angle) * sp * dt;
    h.y += Math.sin(h.angle) * sp * dt;
    h.spotlight = 150;
    // Selama sorotan heli mengunci pemain, timer sembunyi tidak boleh berjalan.
    p.hiddenTimer = 0;
  } else if (state.heli) {
    const h = state.heli;
    h.y -= 260 * dt;
    h.spotlight = Math.max(0, h.spotlight - dt * 200);
    if (h.y < -200) state.heli = null;
  }
}

export function spawnSparks(state, x, y, n) {
  for (let i = 0; i < n; i++) {
    state.particles.push({
      x, y,
      vx: state.rng.range(-160, 160), vy: state.rng.range(-160, 160),
      life: state.rng.range(0.2, 0.6), maxLife: 0.6,
      color: state.rng.pick(['#ffd166', '#ff6b35', '#f8fafc']),
      size: state.rng.range(2, 5),
    });
  }
}
