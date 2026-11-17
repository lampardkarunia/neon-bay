// player.js - Jax Marlowe: on-foot movement, health, vehicle entry.
// Jax is an original protagonist: an ex-getaway driver starting over in Neon Bay.

import { PLAYER_SPEED, PLAYER_RUN_SPEED, PLAYER_RADIUS, PLAYER_MAX_HEALTH, clamp, distanceBetween } from "./config.js";

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
    punchCooldown: 0,
    shootCooldown: 0,
    hurtFlash: 0,
    walkCycle: 0,
    dead: false,
    hidden: false,
  };
}

export function playerPosition(player) {
  if (player.vehicle) return { x: player.vehicle.x, y: player.vehicle.y };
  return { x: player.x, y: player.y };
}

export function damagePlayer(player, amount) {
  if (player.dead) return;
  player.health = clamp(player.health - amount, 0, player.maxHealth);
  player.hurtFlash = 0.35;
  if (player.health <= 0) player.dead = true;
}

export function healPlayer(player, amount) {
  player.health = clamp(player.health + amount, 0, player.maxHealth);
  if (player.health > 0) player.dead = false;
}

export function nearestVehicle(player, vehicles, maxDistance) {
  let best = null;
  let bestDist = maxDistance;
  for (const vehicle of vehicles) {
    if (vehicle.destroyed) continue;
    const d = distanceBetween(player.x, player.y, vehicle.x, vehicle.y);
    if (d < bestDist) { best = vehicle; bestDist = d; }
  }
  return best;
}

export function enterVehicle(game, vehicle) {
  const player = game.player;
  player.vehicle = vehicle;
  vehicle.driver = "player";
  vehicle.occupied = true;
  player.x = vehicle.x;
  player.y = vehicle.y;
  if (!vehicle.stolen && vehicle.owner !== "player") {
    vehicle.stolen = true;
    game.onCrime("theft", vehicle.x, vehicle.y);
  }
}

export function exitVehicle(game) {
  const player = game.player;
  const vehicle = player.vehicle;
  if (!vehicle) return;
  vehicle.driver = null;
  vehicle.occupied = false;
  vehicle.speed = 0;
  // Step out beside the car, nudged clear of buildings.
  const sideX = vehicle.x + Math.cos(vehicle.angle + Math.PI / 2) * 30;
  const sideY = vehicle.y + Math.sin(vehicle.angle + Math.PI / 2) * 30;
  const resolved = game.world.resolveCollision(sideX, sideY, player.radius);
  player.x = resolved.x;
  player.y = resolved.y;
  player.vehicle = null;
}

export function updatePlayer(game, dt) {
  const player = game.player;
  const input = game.input;
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);

  if (player.vehicle) {
    player.x = player.vehicle.x;
    player.y = player.vehicle.y;
    player.angle = player.vehicle.angle;
    if (input.wasPressed("KeyE", "e")) exitVehicle(game);
    return;
  }

  if (input.wasPressed("KeyE", "e")) {
    const vehicle = nearestVehicle(player, game.vehicles, 46);
    if (vehicle) { enterVehicle(game, vehicle); return; }
  }

  const axis = input.moveAxis();
  const running = input.isDown("ShiftLeft", "ShiftRight", "shift");
  const speed = running ? PLAYER_RUN_SPEED : PLAYER_SPEED;
  player.vx = axis.x * speed;
  player.vy = axis.y * speed;
  if (axis.x !== 0 || axis.y !== 0) {
    player.angle = Math.atan2(axis.y, axis.x);
    player.walkCycle += dt * (running ? 11 : 8);
    const nextX = player.x + player.vx * dt;
    const nextY = player.y + player.vy * dt;
    if (!game.world.collides(nextX, player.y, player.radius)) player.x = nextX;
    if (!game.world.collides(player.x, nextY, player.radius)) player.y = nextY;
    const fixed = game.world.resolveCollision(player.x, player.y, player.radius);
    player.x = fixed.x;
    player.y = fixed.y;
  } else {
    player.walkCycle = 0;
  }

  // Hidden when standing still off-road away from police sight (see police.js).
  player.hidden = (axis.x === 0 && axis.y === 0);
}
