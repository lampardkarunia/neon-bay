// vehicles.js - Traffic cars, player driving, damage and explosions.
// Three civilian types with distinct handling plus a police interceptor type.

import { VEHICLE_TYPES, clamp, distanceBetween } from "./config.js";
import { isOnRoad, roadCenters } from "./world.js";

let nextVehicleId = 1;

export function createVehicle(type, x, y, angle, colorOverride) {
  const spec = VEHICLE_TYPES[type] || VEHICLE_TYPES.sedan;
  return {
    id: nextVehicleId++,
    type,
    label: spec.label,
    x, y, angle: angle || 0,
    speed: 0,
    steer: 0,
    width: spec.width,
    height: spec.height,
    spec,
    color: colorOverride || spec.color,
    health: spec.health,
    maxHealth: spec.health,
    driver: null,
    occupied: false,
    stolen: false,
    owner: "civilian",
    destroyed: false,
    burning: 0,
    ai: null,
    honkTimer: 0,
  };
}

export function spawnTraffic(game, count) {
  const rng = game.rng;
  const types = ["sedan", "sedan", "sport", "truck", "sedan", "sport"];
  const palette = ["#4cc9f0", "#ef476f", "#ffd166", "#06d6a0", "#f8f9fa", "#ff9f1c", "#c77dff", "#90e0ef"];
  for (let i = 0; i < count; i++) {
    const point = game.world.randomRoadPoint(rng);
    const horizontal = rng.chance(0.5);
    const vehicle = createVehicle(rng.pick(types), point.x, point.y, horizontal ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2), rng.pick(palette));
    vehicle.ai = createTrafficAI(rng);
    vehicle.speed = rng.range(40, 90);
    game.vehicles.push(vehicle);
  }
}

export function spawnParkedCars(game, count) {
  const rng = game.rng;
  const types = ["sedan", "sport", "truck"];
  for (let i = 0; i < count; i++) {
    const point = game.world.randomRoadPoint(rng);
    const vehicle = createVehicle(rng.pick(types), point.x + rng.range(-14, 14), point.y + rng.range(-14, 14), rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]));
    vehicle.parked = true;
    game.vehicles.push(vehicle);
  }
}

export function createTrafficAI(rng) {
  return {
    mode: "cruise",
    targetSpeed: rng.range(70, 130),
    laneOffset: rng.range(-18, 18),
    decisionTimer: rng.range(0.5, 2.5),
    fleeing: 0,
  };
}

// Keep a car centred on the nearest road axis while cruising.
export function trafficSteering(game, vehicle, dt) {
  const ai = vehicle.ai;
  if (!ai) return;
  ai.decisionTimer -= dt;
  ai.fleeing = Math.max(0, (ai.fleeing || 0) - dt);
  const pos = { x: vehicle.x, y: vehicle.y };
  const playerPos = game.player.vehicle ? game.player.vehicle : game.player;
  const distToPlayer = distanceBetween(pos.x, pos.y, playerPos.x, playerPos.y);
  if (ai.fleeing > 0 || (game.wanted >= 3 && distToPlayer < 120)) {
    ai.mode = "flee";
  } else {
    ai.mode = "cruise";
  }

  // Choose a heading snapped to the road grid.
  const movingHorizontally = Math.abs(Math.cos(vehicle.angle)) > Math.abs(Math.sin(vehicle.angle));
  if (ai.decisionTimer <= 0) {
    ai.decisionTimer = game.rng.range(1.2, 3.2);
    if (game.rng.chance(0.3)) {
      vehicle.angle = game.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    }
  }
  let desired = vehicle.angle;
  if (ai.mode === "flee") {
    desired = Math.atan2(vehicle.y - playerPos.y, vehicle.x - playerPos.x);
    const snapped = Math.round(desired / (Math.PI / 2)) * (Math.PI / 2);
    desired = snapped;
  } else if (!isOnRoad(vehicle.x, vehicle.y)) {
    const target = game.world ? { x: vehicle.x, y: vehicle.y } : pos;
    void target;
    const centres = roadCenters();
    if (movingHorizontally) {
      let bestY = centres[0];
      for (const c of centres) if (Math.abs(c - vehicle.y) < Math.abs(bestY - vehicle.y)) bestY = c;
      desired = vehicle.y > bestY ? -Math.PI / 2 : Math.PI / 2;
      if (Math.abs(vehicle.y - bestY) < 12) desired = Math.cos(vehicle.angle) >= 0 ? 0 : Math.PI;
    } else {
      let bestX = centres[0];
      for (const c of centres) if (Math.abs(c - vehicle.x) < Math.abs(bestX - vehicle.x)) bestX = c;
      desired = vehicle.x > bestX ? Math.PI : 0;
      if (Math.abs(vehicle.x - bestX) < 12) desired = Math.sin(vehicle.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }
  let diff = desired - vehicle.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  vehicle.angle += clamp(diff, -vehicle.spec.turn * dt, vehicle.spec.turn * dt);
  const targetSpeed = ai.mode === "flee" ? vehicle.spec.maxSpeed * 0.62 : ai.targetSpeed;
  vehicle.speed += clamp(targetSpeed - vehicle.speed, -vehicle.spec.accel * dt, vehicle.spec.accel * dt * 0.5);
}

export function driveVehicle(game, vehicle, dt) {
  const input = game.input;
  const spec = vehicle.spec;
  const forward = input.isDown("KeyW", "w", "ArrowUp");
  const back = input.isDown("KeyS", "s", "ArrowDown");
  const left = input.isDown("KeyA", "a", "ArrowLeft");
  const right = input.isDown("KeyD", "d", "ArrowRight");
  if (forward) vehicle.speed += spec.accel * dt;
  if (back) vehicle.speed -= spec.accel * 0.72 * dt;
  if (!forward && !back) vehicle.speed *= Math.pow(spec.grip, dt * 8);
  vehicle.speed = clamp(vehicle.speed, -spec.maxSpeed * 0.38, spec.maxSpeed);
  const steerInput = (left ? -1 : 0) + (right ? 1 : 0);
  if (steerInput !== 0 && Math.abs(vehicle.speed) > 4) {
    const direction = vehicle.speed >= 0 ? 1 : -1;
    vehicle.angle += steerInput * spec.turn * dt * direction * clamp(Math.abs(vehicle.speed) / 120, 0.35, 1);
  }
  moveVehicle(game, vehicle, dt);
}

export function moveVehicle(game, vehicle, dt) {
  const nextX = vehicle.x + Math.cos(vehicle.angle) * vehicle.speed * dt;
  const nextY = vehicle.y + Math.sin(vehicle.angle) * vehicle.speed * dt;
  const radius = vehicle.width / 2;
  if (game.world.collides(nextX, nextY, radius * 0.72)) {
    const impact = Math.abs(vehicle.speed);
    if (impact > 90) {
      damageVehicle(game, vehicle, impact * 0.16);
      if (vehicle.driver === "player") game.onCrime("crash", vehicle.x, vehicle.y);
    }
    vehicle.speed *= -0.22;
    return;
  }
  vehicle.x = clamp(nextX, 24, game.world.width - 24);
  vehicle.y = clamp(nextY, 24, game.world.height - 24);
}

export function damageVehicle(game, vehicle, amount) {
  if (vehicle.destroyed) return;
  vehicle.health -= amount;
  if (vehicle.health <= 0) {
    vehicle.health = 0;
    vehicle.destroyed = true;
    vehicle.burning = 2.4;
    vehicle.speed = 0;
    game.spawnExplosion(vehicle.x, vehicle.y);
    if (vehicle.driver === "player") {
      game.player.vehicle = null;
      vehicle.driver = null;
      vehicle.occupied = false;
      game.damagePlayer(18);
    }
  }
}

export function checkVehicleCollisions(game) {
  const all = game.vehicles;
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      if (a.destroyed || b.destroyed) continue;
      const d = distanceBetween(a.x, a.y, b.x, b.y);
      const minDist = (a.width + b.width) / 2 * 0.82;
      if (d > 0 && d < minDist) {
        const push = (minDist - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const relative = Math.abs(a.speed - b.speed);
        if (relative > 55) {
          damageVehicle(game, a, relative * 0.08);
          damageVehicle(game, b, relative * 0.08);
          if (a.driver === "player" || b.driver === "player") game.onCrime("crash", game.player.x, game.player.y);
        }
        const swap = a.speed; a.speed = b.speed * 0.6; b.speed = swap * 0.6;
      }
    }
    // Cars can run down pedestrians - that is a serious crime in Neon Bay.
    const car = all[i];
    if (Math.abs(car.speed) > 60 && !car.destroyed) {
      for (const ped of game.pedestrians) {
        if (ped.down) continue;
        if (distanceBetween(car.x, car.y, ped.x, ped.y) < car.width / 2 + 8) {
          ped.down = true;
          ped.health = 0;
          if (car.driver === "player") game.onCrime("hitPed", car.x, car.y);
        }
      }
    }
  }
}

export function updateVehicles(game, dt) {
  for (const vehicle of game.vehicles) {
    if (vehicle.destroyed) {
      vehicle.burning = Math.max(0, vehicle.burning - dt);
      continue;
    }
    if (vehicle.driver === "player") {
      driveVehicle(game, vehicle, dt);
    } else if (vehicle.driver === "police") {
      // Police movement is handled in police.js.
    } else if (vehicle.ai && !vehicle.parked) {
      trafficSteering(game, vehicle, dt);
      moveVehicle(game, vehicle, dt);
    }
  }
  checkVehicleCollisions(game);
}
