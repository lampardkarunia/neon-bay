// police.js - HEAT system: wanted stars, police pursuit, roadblocks, heli.
// This is the emphasis of the HEAT variant: pressure scales with stars.

import { WANTED_MAX, WANTED_DECAY_SECONDS } from "./config.js";
import { createVehicle } from "./vehicles.js";
import { getRng } from "./random.js";
import { clampToWorld, resolveBuildingCollision } from "./world.js";

export function createHeat() {
  return {
    wanted: 0,
    hiddenTimer: 0,
    seenTimer: 0,
    lastCrime: "",
    decayClock: 0,
  };
}

export function raiseWanted(heat, amount, reason) {
  const before = heat.wanted;
  heat.wanted = Math.min(WANTED_MAX, heat.wanted + amount);
  heat.lastCrime = reason || heat.lastCrime;
  heat.hiddenTimer = 0;
  heat.decayClock = 0;
  return heat.wanted > before;
}

export function clearWanted(heat) {
  heat.wanted = 0;
  heat.hiddenTimer = 0;
  heat.decayClock = 0;
}

export function policeCountForWanted(wanted) {
  if (wanted <= 0) return 0;
  if (wanted === 1) return 1;
  if (wanted === 2) return 2;
  if (wanted === 3) return 3;
  if (wanted === 4) return 4;
  return 5;
}

export function createPoliceUnit(x, y) {
  const car = createVehicle("police", x, y, 0, "#101828");
  car.isPolice = true;
  car.officerHealth = 80;
  car.officerDown = false;
  return car;
}

export function spawnPoliceNear(heat, police, target, world) {
  const wantedCount = policeCountForWanted(heat.wanted);
  const rng = getRng();
  while (police.length < wantedCount) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(420, 560);
    const x = Math.max(50, Math.min(world.width - 50, target.x + Math.cos(angle) * dist));
    const y = Math.max(50, Math.min(world.height - 50, target.y + Math.sin(angle) * dist));
    police.push(createPoliceUnit(x, y));
  }
  while (police.length > wantedCount && wantedCount > 0) police.pop();
  if (wantedCount === 0) police.length = 0;
}

export function buildRoadblocks(heat, target) {
  if (heat.wanted < 3) return [];
  const blocks = [];
  const offsets = [
    { x: 260, y: 0 }, { x: -260, y: 0 }, { x: 0, y: 260 },
  ];
  const count = heat.wanted >= 4 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    blocks.push({
      x: target.x + offsets[i].x,
      y: target.y + offsets[i].y,
      angle: i * 1.1,
      health: 140,
    });
  }
  return blocks;
}

export function createHelicopter() {
  return { x: 0, y: 0, angle: 0, active: false, rotor: 0, searchlight: 0 };
}

export function updateHelicopter(heli, target, dt) {
  if (!heli.active) return;
  heli.rotor += dt * 28;
  heli.searchlight += dt * 2;
  const dx = target.x - heli.x;
  const dy = target.y - heli.y;
  const dist = Math.hypot(dx, dy) || 1;
  const orbit = 120;
  const desiredX = target.x + Math.cos(heli.searchlight) * orbit;
  const desiredY = target.y + Math.sin(heli.searchlight) * orbit;
  heli.x += (desiredX - heli.x) * Math.min(1, dt * 1.8);
  heli.y += (desiredY - heli.y) * Math.min(1, dt * 1.8);
  heli.angle = Math.atan2(dy, dx);
  void dist;
}

export function anyPoliceSeesTarget(police, target) {
  for (const unit of police) {
    if (unit.exploded || unit.officerDown) continue;
    if (Math.hypot(unit.x - target.x, unit.y - target.y) < 430) return true;
  }
  return false;
}

export function updateHeat(heat, police, target, dt, playerChangedVehicle) {
  if (heat.wanted <= 0) return;
  const seen = anyPoliceSeesTarget(police, target);
  if (seen) {
    heat.hiddenTimer = 0;
    heat.seenTimer += dt;
    heat.decayClock = 0;
  } else {
    heat.hiddenTimer += dt;
    heat.decayClock += dt * (playerChangedVehicle ? 1.7 : 1);
    const needed = WANTED_DECAY_SECONDS - Math.min(3, heat.wanted);
    if (heat.decayClock >= needed) {
      heat.wanted -= 1;
      heat.decayClock = 0;
      if (heat.wanted < 0) heat.wanted = 0;
    }
  }
}

export function updatePoliceUnit(unit, target, world, dt, roadblocks) {
  if (unit.exploded || unit.officerDown) return;
  const dx = target.x - unit.x;
  const dy = target.y - unit.y;
  const dist = Math.hypot(dx, dy) || 1;

  // Predict a blocking point ahead of the target when close, else chase.
  let aimX = target.x;
  let aimY = target.y;
  if (roadblocks && roadblocks.length && dist < 360) {
    aimX = target.x + Math.cos(unit.angle) * 40;
    aimY = target.y;
  }
  const desired = Math.atan2(aimY - unit.y, aimX - unit.x);
  let diff = desired - unit.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  unit.angle += Math.max(-unit.spec.turnRate * dt, Math.min(unit.spec.turnRate * dt, diff));

  const targetSpeed = dist > 90 ? unit.spec.maxSpeed : unit.spec.maxSpeed * 0.45;
  unit.speed += (targetSpeed - unit.speed) * Math.min(1, dt * 2.2);
  unit.x += Math.cos(unit.angle) * unit.speed * dt;
  unit.y += Math.sin(unit.angle) * unit.speed * dt;
  clampToWorld(unit, 30);
  if (resolveBuildingCollision(world, unit, 20)) unit.speed *= 0.4;

  // Ram damage is handled by vehicle collision checks in main.
  void dx; void dy;
}

export function updatePolice(heat, police, target, world, dt) {
  for (const unit of police) updatePoliceUnit(unit, target, world, dt, null);
}
