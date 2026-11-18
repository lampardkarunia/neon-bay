// player.js - Jax Marlowe: on-foot movement, health, money and state.

import { PLAYER_SPEED, PLAYER_RADIUS, PLAYER_MAX_HEALTH } from "./config.js";
import { clampToWorld, resolveBuildingCollision } from "./world.js";

export function createPlayer(x, y) {
  return {
    name: "Jax Marlowe",
    x, y,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER_RADIUS,
    health: PLAYER_MAX_HEALTH,
    maxHealth: PLAYER_MAX_HEALTH,
    money: 120,
    vehicle: null,
    punchTimer: 0,
    shootTimer: 0,
    hurtFlash: 0,
    dead: false,
    steps: 0,
  };
}

export function playerPosition(player) {
  if (player.vehicle) return { x: player.vehicle.x, y: player.vehicle.y };
  return { x: player.x, y: player.y };
}

export function damagePlayer(player, amount) {
  if (player.dead) return;
  player.health -= amount;
  player.hurtFlash = 0.25;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
  }
}

export function healPlayer(player, amount) {
  player.health = Math.min(player.maxHealth, player.health + amount);
}

export function addMoney(player, amount) {
  player.money += amount;
  return player.money;
}

export function updatePlayerOnFoot(player, input, world, dt) {
  if (player.dead || player.vehicle) return;
  player.punchTimer = Math.max(0, player.punchTimer - dt);
  player.shootTimer = Math.max(0, player.shootTimer - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);

  const ax = input.axisX();
  const ay = input.axisY();
  const len = Math.hypot(ax, ay) || 1;
  const moving = ax !== 0 || ay !== 0;
  if (moving) {
    player.x += (ax / len) * PLAYER_SPEED * dt;
    player.y += (ay / len) * PLAYER_SPEED * dt;
    player.angle = Math.atan2(ay, ax);
    player.steps += dt * 7;
  }
  clampToWorld(player, player.radius + 2);
  resolveBuildingCollision(world, player, player.radius);
}

export function respawnPlayer(player, x, y) {
  player.x = x;
  player.y = y;
  player.health = player.maxHealth;
  player.dead = false;
  player.vehicle = null;
  player.hurtFlash = 0;
}
