// combat.js - Fists, pistol, bullets, pedestrians and particles.
// Enemies here are hostile pedestrians and armed responders during missions.

import { clamp, distanceBetween } from "./config.js";

export function createPedestrian(x, y, rng, hostile) {
  return {
    x, y,
    vx: 0, vy: 0,
    angle: rng ? rng.range(0, Math.PI * 2) : 0,
    radius: 11,
    health: hostile ? 55 : 30,
    maxHealth: hostile ? 55 : 30,
    hostile: !!hostile,
    down: false,
    wanderTimer: rng ? rng.range(0.5, 3) : 1,
    speed: hostile ? 118 : 62,
    color: hostile ? "#ff5964" : (rng ? rng.pick(["#ffe66d", "#f7fff7", "#a7c957", "#f28482", "#84a98c", "#f6bd60"]) : "#ffffff"),
    fleeing: 0,
  };
}

export function spawnPedestrians(game, count) {
  for (let i = 0; i < count; i++) {
    const point = game.world.randomSidewalkPoint(game.rng);
    game.pedestrians.push(createPedestrian(point.x, point.y, game.rng, false));
  }
}

export function spawnHostiles(game, x, y, count) {
  const spawned = [];
  for (let i = 0; i < count; i++) {
    const ped = createPedestrian(x + game.rng.range(-70, 70), y + game.rng.range(-70, 70), game.rng, true);
    game.pedestrians.push(ped);
    spawned.push(ped);
  }
  return spawned;
}

export function tryPunch(game) {
  const player = game.player;
  if (player.vehicle || player.punchCooldown > 0) return;
  player.punchCooldown = 0.32;
  game.audio.playPunch();
  const reach = 34;
  const targetX = player.x + Math.cos(player.angle) * reach;
  const targetY = player.y + Math.sin(player.angle) * reach;
  for (const ped of game.pedestrians) {
    if (ped.down) continue;
    if (distanceBetween(targetX, targetY, ped.x, ped.y) < 24) {
      hurtPedestrian(game, ped, 18, player.angle);
      if (ped.hostile) game.onCrime("assault", ped.x, ped.y);
    }
  }
  for (const vehicle of game.vehicles) {
    if (distanceBetween(targetX, targetY, vehicle.x, vehicle.y) < vehicle.width / 2 + 8) {
      game.damageVehicle(vehicle, 4);
      game.spawnSparks(targetX, targetY);
    }
  }
}

export function tryShoot(game) {
  const player = game.player;
  if (player.shootCooldown > 0) return;
  player.shootCooldown = 0.24;
  game.audio.playShot();
  const origin = player.vehicle || player;
  const angle = origin.angle;
  game.bullets.push({
    x: origin.x + Math.cos(angle) * 22,
    y: origin.y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * 720,
    vy: Math.sin(angle) * 720,
    life: 0.55,
    fromPlayer: true,
    damage: 26,
  });
  game.spawnMuzzle(origin.x + Math.cos(angle) * 24, origin.y + Math.sin(angle) * 24);
  game.onCrime("shot", origin.x, origin.y);
}

export function hurtPedestrian(game, ped, amount, angle) {
  ped.health -= amount;
  ped.x += Math.cos(angle) * 7;
  ped.y += Math.sin(angle) * 7;
  ped.fleeing = 2.2;
  if (ped.health <= 0 && !ped.down) {
    ped.down = true;
    ped.health = 0;
  }
}

export function updateBullets(game, dt) {
  const kept = [];
  for (const bullet of game.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) continue;
    if (game.world.collides(bullet.x, bullet.y, 3)) {
      game.spawnSparks(bullet.x, bullet.y);
      continue;
    }
    let consumed = false;
    if (bullet.fromPlayer) {
      for (const ped of game.pedestrians) {
        if (!ped.down && distanceBetween(bullet.x, bullet.y, ped.x, ped.y) < ped.radius + 4) {
          hurtPedestrian(game, ped, bullet.damage, Math.atan2(bullet.vy, bullet.vx));
          consumed = true;
          break;
        }
      }
      if (!consumed) {
        for (const vehicle of game.vehicles) {
          if (vehicle !== game.player.vehicle && distanceBetween(bullet.x, bullet.y, vehicle.x, vehicle.y) < vehicle.width / 2) {
            game.damageVehicle(vehicle, bullet.damage * 0.5);
            consumed = true;
            break;
          }
        }
      }
    } else {
      const target = game.player.vehicle || game.player;
      const radius = game.player.vehicle ? game.player.vehicle.width / 2 : game.player.radius;
      if (distanceBetween(bullet.x, bullet.y, target.x, target.y) < radius + 3) {
        game.damagePlayer(bullet.damage * 0.55);
        consumed = true;
      }
    }
    if (!consumed) kept.push(bullet);
  }
  game.bullets = kept;
}

export function updatePedestrians(game, dt) {
  const playerPos = game.player.vehicle || game.player;
  for (const ped of game.pedestrians) {
    if (ped.down) continue;
    ped.wanderTimer -= dt;
    ped.fleeing = Math.max(0, ped.fleeing - dt);
    let moveX = 0;
    let moveY = 0;
    const distToPlayer = distanceBetween(ped.x, ped.y, playerPos.x, playerPos.y);

    if (ped.hostile) {
      if (distToPlayer > 150) {
        moveX = Math.cos(Math.atan2(playerPos.y - ped.y, playerPos.x - ped.x));
        moveY = Math.sin(Math.atan2(playerPos.y - ped.y, playerPos.x - ped.x));
      } else if (distToPlayer < 90) {
        moveX = -Math.cos(Math.atan2(playerPos.y - ped.y, playerPos.x - ped.x));
        moveY = -Math.sin(Math.atan2(playerPos.y - ped.y, playerPos.x - ped.x));
      }
      // Hostiles shoot back at range.
      ped.shootTimer = (ped.shootTimer || game.rng.range(0.8, 1.8)) - dt;
      if (ped.shootTimer <= 0 && distToPlayer < 260 && distToPlayer > 60) {
        ped.shootTimer = game.rng.range(0.9, 1.9);
        const aim = Math.atan2(playerPos.y - ped.y, playerPos.x - ped.x) + game.rng.range(-0.09, 0.09);
        game.bullets.push({ x: ped.x, y: ped.y, vx: Math.cos(aim) * 560, vy: Math.sin(aim) * 560, life: 0.6, fromPlayer: false, damage: 14 });
        game.audio.playShotQuiet();
      }
    } else if (ped.fleeing > 0 || (game.wanted > 0 && distToPlayer < 110)) {
      const away = Math.atan2(ped.y - playerPos.y, ped.x - playerPos.x);
      moveX = Math.cos(away);
      moveY = Math.sin(away);
    } else if (ped.wanderTimer <= 0) {
      ped.wanderTimer = game.rng.range(1, 3.4);
      ped.angle = game.rng.range(0, Math.PI * 2);
    }
    if (moveX === 0 && moveY === 0 && ped.fleeing <= 0 && !ped.hostile) {
      moveX = Math.cos(ped.angle) * 0.55;
      moveY = Math.sin(ped.angle) * 0.55;
    }
    const speed = ped.hostile ? ped.speed : (ped.fleeing > 0 ? 132 : ped.speed);
    const nextX = ped.x + moveX * speed * dt;
    const nextY = ped.y + moveY * speed * dt;
    if (!game.world.collides(nextX, ped.y, ped.radius)) ped.x = nextX;
    if (!game.world.collides(ped.x, nextY, ped.radius)) ped.y = nextY;
    ped.x = clamp(ped.x, 16, game.world.width - 16);
    ped.y = clamp(ped.y, 16, game.world.height - 16);
    if (moveX !== 0 || moveY !== 0) ped.angle = Math.atan2(moveY, moveX);
  }
}

export function createParticle(x, y, color, speed, life, size) {
  const angle = Math.random() * Math.PI * 2;
  return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color, life, maxLife: life, size };
}

export function updateParticles(game, dt) {
  const kept = [];
  for (const p of game.particles) {
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    kept.push(p);
  }
  game.particles = kept;
}
