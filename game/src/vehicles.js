// vehicles.js - Traffic cars, drivable vehicles, damage and explosions.

import { VEHICLE_TYPES } from "./config.js";
import { getRng } from "./random.js";
import { clampToWorld, nearestRoadPoint, resolveBuildingCollision } from "./world.js";

let nextVehicleId = 1;

export function createVehicle(type, x, y, angle, colour) {
  const spec = VEHICLE_TYPES[type] || VEHICLE_TYPES.sedan;
  const rng = getRng();
  return {
    id: nextVehicleId++,
    type,
    spec,
    x, y,
    angle: angle || 0,
    speed: 0,
    width: spec.width,
    height: spec.height,
    colour: colour || rng.pick(spec.colours),
    health: spec.health,
    maxHealth: spec.health,
    driver: null,
    isPlayerVehicle: false,
    isPolice: type === "police",
    stolen: false,
    exploded: false,
    smokeTimer: 0,
    ai: null,
  };
}

export function spawnTraffic(world, count) {
  const rng = getRng();
  const cars = [];
  const types = ["sedan", "sedan", "sport", "truck"];
  for (let i = 0; i < count; i++) {
    const road = nearestRoadPoint(rng.range(120, world.width - 120), rng.range(120, world.height - 120));
    const horizontal = rng.chance(0.5);
    const car = createVehicle(rng.pick(types), road.x, road.y, horizontal ? 0 : Math.PI / 2);
    car.ai = {
      mode: "traffic",
      horizontal,
      direction: rng.sign(),
      speedTarget: rng.range(90, 150),
      laneOffset: rng.pick([-20, 20]),
    };
    if (!horizontal) car.angle = car.ai.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    else car.angle = car.ai.direction > 0 ? 0 : Math.PI;
    cars.push(car);
  }
  return cars;
}

export function nearestVehicle(vehicles, x, y, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of vehicles) {
    if (car.exploded) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

export function damageVehicle(car, amount, events) {
  if (car.exploded) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.exploded = true;
    car.speed = 0;
    if (events) events.push({ type: "explosion", x: car.x, y: car.y });
  }
}

export function vehicleDamageLevel(car) {
  const ratio = car.health / car.maxHealth;
  if (car.exploded) return 3;
  if (ratio < 0.3) return 2;
  if (ratio < 0.65) return 1;
  return 0;
}

export function updatePlayerVehicle(car, input, world, dt) {
  const forward = (input.isDown("KeyW") || input.isDown("ArrowUp")) ? 1 : 0;
  const back = (input.isDown("KeyS") || input.isDown("ArrowDown")) ? 1 : 0;
  const left = (input.isDown("KeyA") || input.isDown("ArrowLeft")) ? 1 : 0;
  const right = (input.isDown("KeyD") || input.isDown("ArrowRight")) ? 1 : 0;

  if (forward) car.speed += car.spec.accel * dt;
  if (back) {
    if (car.speed > 12) car.speed -= car.spec.brake * dt;
    else car.speed -= car.spec.accel * 0.55 * dt;
  }
  if (!forward && !back) {
    car.speed -= car.speed * 1.4 * dt;
    if (Math.abs(car.speed) < 2) car.speed = 0;
  }
  car.speed = Math.max(-car.spec.maxSpeed * 0.42, Math.min(car.spec.maxSpeed, car.speed));

  const steer = (right - left) * car.spec.turnRate * (car.speed / Math.max(60, car.spec.maxSpeed));
  if (Math.abs(car.speed) > 4) car.angle += steer * dt * Math.sign(car.speed);

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  clampToWorld(car, 30);
  if (resolveBuildingCollision(world, car, 20)) {
    damageVehicle(car, Math.abs(car.speed) * 0.05, null);
    car.speed *= -0.25;
  }
}

export function updateTrafficVehicle(car, world, dt) {
  if (car.exploded || car.isPlayerVehicle || !car.ai || car.ai.mode !== "traffic") return;
  const ai = car.ai;
  // Ease toward the cruising speed, then advance exactly once along heading.
  car.speed += (ai.speedTarget * ai.direction - car.speed) * Math.min(1, dt * 1.6);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // Near an intersection centre a driver may turn onto the crossing road,
  // which keeps traffic circulating instead of bouncing at the world edge.
  ai.turnCooldown = Math.max(0, (ai.turnCooldown || 0) - dt);
  const rng = getRng();
  const nearCrossX = Math.abs(((car.x % 400) + 400) % 400 - 200) < 14;
  const nearCrossY = Math.abs(((car.y % 400) + 400) % 400 - 200) < 14;
  if (nearCrossX && nearCrossY && ai.turnCooldown <= 0 && rng.chance(0.35)) {
    car.angle += rng.sign() * (Math.PI / 2);
    ai.turnCooldown = 2.5;
    const snapped = nearestRoadPoint(car.x, car.y);
    car.x = snapped.x;
    car.y = snapped.y;
  }

  if (car.x < 60 || car.x > world.width - 60 || car.y < 60 || car.y > world.height - 60) {
    car.angle += Math.PI;
    ai.turnCooldown = 2.5;
    clampToWorld(car, 50);
  }
  if (resolveBuildingCollision(world, car, 18)) {
    car.angle += Math.PI / 2;
    ai.turnCooldown = 1.2;
  }
}

export function checkVehicleCollisions(vehicles, events, onHit) {
  for (let i = 0; i < vehicles.length; i++) {
    for (let j = i + 1; j < vehicles.length; j++) {
      const a = vehicles[i];
      const b = vehicles[j];
      if (a.exploded && b.exploded) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = 38;
      if (dist > 0.01 && dist < minDist) {
        const push = (minDist - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 60) {
          damageVehicle(a, impact * 0.08, events);
          damageVehicle(b, impact * 0.08, events);
          if (onHit) onHit(a, b, impact);
        }
        a.speed *= 0.72;
        b.speed *= 0.72;
      }
    }
  }
}
