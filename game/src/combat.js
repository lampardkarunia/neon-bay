// combat.js - Fists, pistol bullets, hit resolution against peds/police/cars.

import {
  PLAYER_PUNCH_RANGE, PLAYER_PUNCH_DAMAGE, PLAYER_PUNCH_COOLDOWN,
  BULLET_SPEED, BULLET_DAMAGE, BULLET_COOLDOWN, BULLET_LIFETIME,
} from "./config.js";
import { damageVehicle } from "./vehicles.js";
import { damagePlayer } from "./player.js";

export function createCombatState() {
  return { bullets: [], effects: [], punchFlash: 0 };
}

export function tryPunch(player, world, police, vehicles, combat, heatApi) {
  if (player.punchTimer > 0 || player.vehicle) return false;
  player.punchTimer = PLAYER_PUNCH_COOLDOWN;
  combat.punchFlash = 0.12;
  const tx = player.x + Math.cos(player.angle) * PLAYER_PUNCH_RANGE;
  const ty = player.y + Math.sin(player.angle) * PLAYER_PUNCH_RANGE;
  let hitSomething = false;

  for (const ped of world.pedestrians) {
    if (ped.down) continue;
    if (Math.hypot(ped.x - tx, ped.y - ty) < 26) {
      ped.health -= PLAYER_PUNCH_DAMAGE;
      ped.fleeing = 1.4;
      if (ped.health <= 0) ped.down = true;
      hitSomething = true;
      heatApi.raise(1, "assault");
    }
  }
  for (const unit of police) {
    if (Math.hypot(unit.x - tx, unit.y - ty) < 34) {
      unit.officerHealth -= PLAYER_PUNCH_DAMAGE;
      if (unit.officerHealth <= 0) unit.officerDown = true;
      hitSomething = true;
      heatApi.raise(1, "assault on officer");
    }
  }
  for (const car of vehicles) {
    if (Math.hypot(car.x - tx, car.y - ty) < 36) {
      damageVehicle(car, 6, combat.effects);
      hitSomething = true;
    }
  }
  combat.effects.push({ type: "punch", x: tx, y: ty, life: 0.12, maxLife: 0.12 });
  return hitSomething;
}

export function tryShoot(player, combat, heatApi) {
  if (player.shootTimer > 0) return false;
  player.shootTimer = BULLET_COOLDOWN;
  const origin = player.vehicle
    ? { x: player.vehicle.x, y: player.vehicle.y, angle: player.vehicle.angle }
    : { x: player.x, y: player.y, angle: player.angle };
  combat.bullets.push({
    x: origin.x + Math.cos(origin.angle) * 22,
    y: origin.y + Math.sin(origin.angle) * 22,
    vx: Math.cos(origin.angle) * BULLET_SPEED,
    vy: Math.sin(origin.angle) * BULLET_SPEED,
    life: BULLET_LIFETIME,
    fromPlayer: true,
  });
  combat.effects.push({ type: "muzzle", x: origin.x, y: origin.y, life: 0.06, maxLife: 0.06 });
  heatApi.raise(1, "shots fired");
  return true;
}

export function updateCombat(combat, world, police, vehicles, player, dt, heatApi) {
  combat.punchFlash = Math.max(0, combat.punchFlash - dt);
  for (const effect of combat.effects) effect.life -= dt;
  combat.effects = combat.effects.filter((e) => e.life > 0);

  const kept = [];
  for (const bullet of combat.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) continue;
    let consumed = false;

    for (const ped of world.pedestrians) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 14) {
        ped.health -= BULLET_DAMAGE;
        if (ped.health <= 0) ped.down = true;
        consumed = true;
        break;
      }
    }
    if (!consumed) {
      for (const unit of police) {
        if (unit.officerDown) continue;
        if (Math.hypot(unit.x - bullet.x, unit.y - bullet.y) < 26) {
          unit.officerHealth -= BULLET_DAMAGE;
          damageVehicle(unit, 8, combat.effects);
          if (unit.officerHealth <= 0) unit.officerDown = true;
          consumed = true;
          break;
        }
      }
    }
    if (!consumed) {
      for (const car of vehicles) {
        if (car.exploded) continue;
        if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < 28) {
          damageVehicle(car, BULLET_DAMAGE * 0.5, combat.effects);
          consumed = true;
          break;
        }
      }
    }
    if (!consumed) kept.push(bullet);
  }
  combat.bullets = kept;

  // Police return pressure: nearby active officers chip the player slowly.
  if (!player.dead) {
    for (const unit of police) {
      if (unit.officerDown || unit.exploded) continue;
      const dist = Math.hypot(unit.x - player.x, unit.y - player.y);
      if (dist < 120 && !player.vehicle) damagePlayer(player, 7 * dt);
      if (dist < 46 && player.vehicle) damagePlayer(player, 4 * dt);
    }
  }
  void heatApi;
}
