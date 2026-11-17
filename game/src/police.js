// police.js - The HEAT system: wanted stars, pursuit AI, roadblocks, helicopter.
// This is the signature system of the HEAT variant of NEON BAY.

import { WANTED_MAX, WANTED_DECAY_SECONDS, WANTED_SIGHT_RANGE, clamp, distanceBetween } from "./config.js";
import { createVehicle } from "./vehicles.js";

export function createPoliceState() {
  return {
    units: [],          // { vehicle, mode, ramTimer, blockTarget }
    helicopter: null,   // { x, y, angle, spotlight }
    roadblocks: [],     // { x, y, angle, vehicleA, vehicleB }
    hiddenTimer: 0,
    spawnTimer: 0,
    lastSeenX: 0,
    lastSeenY: 0,
    seenNow: false,
  };
}

export function addWanted(game, amount) {
  const before = game.wanted;
  game.wanted = clamp(game.wanted + amount, 0, WANTED_MAX);
  if (game.wanted > before) {
    game.police.hiddenTimer = 0;
    game.audio.playSirenBlip();
  }
}

export function setWanted(game, level) {
  game.wanted = clamp(level, 0, WANTED_MAX);
  game.police.hiddenTimer = 0;
}

export function policeCountForWanted(wanted) {
  return [0, 2, 3, 4, 6, 7][clamp(wanted, 0, 5)];
}

export function spawnPoliceUnit(game, nearX, nearY) {
  const rng = game.rng;
  const angle = rng.range(0, Math.PI * 2);
  const distance = rng.range(430, 560);
  let x = clamp(nearX + Math.cos(angle) * distance, 60, game.world.width - 60);
  let y = clamp(nearY + Math.sin(angle) * distance, 60, game.world.height - 60);
  const road = game.world.randomRoadPoint ? { x, y } : { x, y };
  void road;
  const fixed = game.world.resolveCollision(x, y, 20);
  x = fixed.x; y = fixed.y;
  const vehicle = createVehicle("police", x, y, angle + Math.PI, "#ffffff");
  vehicle.driver = "police";
  vehicle.occupied = true;
  vehicle.owner = "police";
  vehicle.isPolice = true;
  game.vehicles.push(vehicle);
  const unit = { vehicle, mode: "chase", ramTimer: rng.range(0.4, 1.4), searchTimer: 0 };
  game.police.units.push(unit);
  return unit;
}

export function removePoliceUnit(game, unit) {
  game.police.units = game.police.units.filter((u) => u !== unit);
  game.vehicles = game.vehicles.filter((v) => v !== unit.vehicle);
}

export function spawnRoadblocks(game) {
  const wanted = game.wanted;
  if (wanted < 3) return;
  const desired = wanted - 2;
  const police = game.police;
  while (police.roadblocks.length < desired) {
    const aheadAngle = game.player.vehicle ? game.player.vehicle.angle : game.player.angle;
    const baseX = game.player.x + Math.cos(aheadAngle) * 520;
    const baseY = game.player.y + Math.sin(aheadAngle) * 520;
    const block = {
      x: clamp(baseX, 80, game.world.width - 80),
      y: clamp(baseY, 80, game.world.height - 80),
      angle: aheadAngle + Math.PI / 2,
      id: police.roadblocks.length + 1,
    };
    police.roadblocks.push(block);
    game.audio.playSirenBlip();
  }
}

export function updateHelicopter(game, dt) {
  const police = game.police;
  if (game.wanted >= 5) {
    if (!police.helicopter) {
      police.helicopter = { x: game.player.x + 300, y: game.player.y - 260, angle: 0, rotor: 0 };
    }
    const heli = police.helicopter;
    const targetAngle = Math.atan2(game.player.y - heli.y, game.player.x - heli.x);
    heli.angle = targetAngle;
    const dist = distanceBetween(heli.x, heli.y, game.player.x, game.player.y);
    if (dist > 130) {
      heli.x += Math.cos(targetAngle) * 235 * dt;
      heli.y += Math.sin(targetAngle) * 235 * dt;
    }
    heli.rotor += dt * 28;
    // The helicopter keeps eyes on Jax: hiding is much harder at five stars.
    if (dist < 360) police.hiddenTimer = 0;
  } else {
    police.helicopter = null;
  }
}

export function canPoliceSeePlayer(game) {
  const playerPos = game.player.vehicle || game.player;
  for (const unit of game.police.units) {
    if (unit.vehicle.destroyed) continue;
    if (distanceBetween(unit.vehicle.x, unit.vehicle.y, playerPos.x, playerPos.y) < WANTED_SIGHT_RANGE) return true;
  }
  if (game.police.helicopter) {
    if (distanceBetween(game.police.helicopter.x, game.police.helicopter.y, playerPos.x, playerPos.y) < 360) return true;
  }
  return false;
}

export function updatePolice(game, dt) {
  const police = game.police;
  const playerPos = game.player.vehicle || game.player;

  if (game.wanted <= 0) {
    // Stand down: clear units gradually.
    police.units = [];
    police.roadblocks = [];
    police.helicopter = null;
    game.vehicles = game.vehicles.filter((v) => !v.isPolice);
    return;
  }

  police.seenNow = canPoliceSeePlayer(game);
  if (police.seenNow) {
    police.hiddenTimer = 0;
    police.lastSeenX = playerPos.x;
    police.lastSeenY = playerPos.y;
  } else {
    // Switching cars or breaking line of sight speeds up the decay.
    // Revision tuning: a car the police never saw Jax steal (not flagged
    // stolen and not a police car) is the strongest disguise, standing
    // still in shadow is next, and simply being unseen is the baseline.
    const inFreshCar = game.player.vehicle && game.player.vehicle.stolen === false && !game.player.vehicle.isPolice;
    const multiplier = inFreshCar ? 2.1 : (game.player.hidden ? 1.7 : 1);
    police.hiddenTimer += dt * multiplier;
    if (police.hiddenTimer >= WANTED_DECAY_SECONDS) {
      police.hiddenTimer = 0;
      setWantedSilent(game, game.wanted - 1);
      if (game.wanted <= 0) return;
    }
  }

  // Maintain the desired number of pursuers.
  police.spawnTimer -= dt;
  const desired = policeCountForWanted(game.wanted);
  const alive = police.units.filter((u) => !u.vehicle.destroyed);
  if (alive.length < desired && police.spawnTimer <= 0) {
    police.spawnTimer = 1.1;
    spawnPoliceUnit(game, playerPos.x, playerPos.y);
  }
  // Clean destroyed units after a short burn.
  for (const unit of [...police.units]) {
    if (unit.vehicle.destroyed && unit.vehicle.burning <= 0) removePoliceUnit(game, unit);
  }

  spawnRoadblocks(game);
  if (game.wanted < 3) police.roadblocks = [];
  updateHelicopter(game, dt);

  for (const unit of police.units) {
    updatePoliceUnit(game, unit, dt);
  }
  checkRoadblockCollisions(game);
  checkBust(game);
}

function setWantedSilent(game, level) {
  game.wanted = clamp(level, 0, WANTED_MAX);
}

export function updatePoliceUnit(game, unit, dt) {
  const vehicle = unit.vehicle;
  if (vehicle.destroyed) return;
  const playerPos = game.player.vehicle || game.player;
  const seen = game.police.seenNow;
  const targetX = seen ? playerPos.x : game.police.lastSeenX;
  const targetY = seen ? playerPos.y : game.police.lastSeenY;
  const dist = distanceBetween(vehicle.x, vehicle.y, targetX, targetY);

  unit.mode = seen ? "chase" : "search";
  unit.ramTimer -= dt;

  // Blocking behaviour at higher heat: aim ahead of the player.
  let aimX = targetX;
  let aimY = targetY;
  if (game.wanted >= 3 && unit.vehicle.id % 2 === 0 && game.player.vehicle) {
    aimX = targetX + Math.cos(game.player.vehicle.angle) * 120;
    aimY = targetY + Math.sin(game.player.vehicle.angle) * 120;
  }

  const desired = Math.atan2(aimY - vehicle.y, aimX - vehicle.x);
  let diff = desired - vehicle.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  vehicle.angle += clamp(diff, -vehicle.spec.turn * dt, vehicle.spec.turn * dt);

  let targetSpeed = vehicle.spec.maxSpeed * (unit.mode === "chase" ? 0.94 : 0.55);
  if (dist < 70) targetSpeed = vehicle.spec.maxSpeed * 0.45;
  if (unit.ramTimer <= 0 && dist < 150 && dist > 34 && seen) {
    targetSpeed = vehicle.spec.maxSpeed; // ram surge
    if (dist < 44) unit.ramTimer = 1.6;
  }
  vehicle.speed += clamp(targetSpeed - vehicle.speed, -vehicle.spec.accel * dt, vehicle.spec.accel * dt);

  const nextX = vehicle.x + Math.cos(vehicle.angle) * vehicle.speed * dt;
  const nextY = vehicle.y + Math.sin(vehicle.angle) * vehicle.speed * dt;
  if (game.world.collides(nextX, nextY, vehicle.width * 0.36)) {
    vehicle.speed *= -0.3;
    vehicle.angle += 0.6 * dt * 3;
  } else {
    vehicle.x = clamp(nextX, 24, game.world.width - 24);
    vehicle.y = clamp(nextY, 24, game.world.height - 24);
  }
}

export function checkRoadblockCollisions(game) {
  const playerVehicle = game.player.vehicle;
  if (!playerVehicle) return;
  for (const block of game.police.roadblocks) {
    if (distanceBetween(playerVehicle.x, playerVehicle.y, block.x, block.y) < 52 && Math.abs(playerVehicle.speed) > 40) {
      playerVehicle.speed *= 0.35;
      game.damageVehicle(playerVehicle, 9);
      game.spawnSparks(playerVehicle.x, playerVehicle.y);
    }
  }
}

export function checkBust(game) {
  if (game.player.vehicle) return; // cannot bust a moving driver directly
  for (const unit of game.police.units) {
    if (unit.vehicle.destroyed) continue;
    const d = distanceBetween(unit.vehicle.x, unit.vehicle.y, game.player.x, game.player.y);
    if (d < 64 && game.wanted >= 1) {
      game.bustedTimer = (game.bustedTimer || 0) + 0.016;
      if (game.bustedTimer > 1.6) {
        game.onBusted();
        game.bustedTimer = 0;
      }
      return;
    }
  }
  game.bustedTimer = Math.max(0, (game.bustedTimer || 0) - 0.03);
}
