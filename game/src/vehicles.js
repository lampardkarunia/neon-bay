// vehicles.js — traffic cars, player driving, damage and explosions
import { CONFIG, clamp } from "./config.js";

let nextId = 1;
export function createVehicle(type, x, y, angle, rng, isPolice = false) {
  const spec = CONFIG.vehicleTypes[type];
  return {
    id: nextId++, type, spec, x, y, angle: angle || 0,
    speed: 0, health: spec.health, maxHealth: spec.health,
    color: isPolice ? "#101216" : rng.pick(spec.colors),
    isPolice, driver: null, exploded: false, smoke: 0,
    aiTimer: rng.range(0, 2), aiDir: rng.chance(0.5) ? 1 : -1, aiAxis: rng.chance(0.5) ? "x" : "y",
  };
}
export function spawnTraffic(world, rng, count) {
  const cars = [];
  const types = ["sedan", "sedan", "sport", "truck"];
  for (let i = 0; i < count; i++) {
    const onXRoad = rng.chance(0.5);
    const rx = rng.pick(world.roadsX), ry = rng.pick(world.roadsY);
    const x = onXRoad ? rx : rng.range(120, CONFIG.worldWidth - 120);
    const y = onXRoad ? rng.range(120, CONFIG.worldHeight - 120) : ry;
    cars.push(createVehicle(rng.pick(types), x, y, onXRoad ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2), rng));
  }
  return cars;
}
export function updateVehicleDriving(vehicle, input, dt) {
  if (vehicle.exploded) { vehicle.speed = 0; return; }
  const fwd = input.isDown("KeyW", "ArrowUp") ? 1 : input.isDown("KeyS", "ArrowDown") ? -0.55 : 0;
  vehicle.speed += fwd * vehicle.spec.accel * dt;
  if (!fwd) vehicle.speed -= vehicle.speed * Math.min(1, dt * 1.6);
  vehicle.speed = clamp(vehicle.speed, -vehicle.spec.maxSpeed * 0.5, vehicle.spec.maxSpeed);
  if (Math.abs(vehicle.speed) > 4) {
    const steer = (input.isDown("KeyA", "ArrowLeft") ? -1 : 0) + (input.isDown("KeyD", "ArrowRight") ? 1 : 0);
    vehicle.angle += steer * vehicle.spec.turn * dt * Math.sign(vehicle.speed) * Math.min(1, Math.abs(vehicle.speed) / 120);
  }
  vehicle.x += Math.cos(vehicle.angle) * vehicle.speed * dt;
  vehicle.y += Math.sin(vehicle.angle) * vehicle.speed * dt;
}
export function updateTrafficVehicle(vehicle, world, dt) {
  if (vehicle.exploded || vehicle.driver === "player") return;
  vehicle.aiTimer -= dt;
  if (vehicle.aiTimer <= 0) {
    vehicle.aiTimer = 1.6;
    const road = world.nearestRoadPoint(vehicle);
    vehicle.aiAxis = Math.abs(road.x - vehicle.x) < Math.abs(road.y - vehicle.y) ? "x" : "y";
  }
  const cruise = 95;
  const targetAngle = vehicle.aiAxis === "x"
    ? (Math.cos(vehicle.angle) >= 0 ? 0 : Math.PI)
    : (Math.sin(vehicle.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2);
  let diff = targetAngle - vehicle.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  vehicle.angle += clamp(diff, -1.8 * dt, 1.8 * dt);
  vehicle.speed += clamp(cruise - vehicle.speed, -120 * dt, 120 * dt);
  const nx = vehicle.x + Math.cos(vehicle.angle) * vehicle.speed * dt;
  const ny = vehicle.y + Math.sin(vehicle.angle) * vehicle.speed * dt;
  if (!world.collidesBuilding({ x: nx, y: ny }, 20)) { vehicle.x = nx; vehicle.y = ny; }
  else { vehicle.angle += Math.PI / 2; vehicle.speed = 30; }
  world.clampToWorld(vehicle, 26);
}
export function damageVehicle(vehicle, amount, effects) {
  if (vehicle.exploded) return;
  vehicle.health -= amount;
  vehicle.smoke = Math.max(vehicle.smoke, vehicle.health < 35 ? 1 : 0.3);
  if (vehicle.health <= 0) {
    vehicle.exploded = true; vehicle.speed = 0;
    if (effects) effects.push({ x: vehicle.x, y: vehicle.y, r: 8, life: 0.7, maxLife: 0.7, kind: "explosion" });
  }
}
export function drawVehicle(ctx, vehicle) {
  ctx.save(); ctx.translate(vehicle.x, vehicle.y); ctx.rotate(vehicle.angle);
  const { w, h } = vehicle.spec;
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(-w / 2 + 3, -h / 2 + 5, w, h);
  ctx.fillStyle = vehicle.exploded ? "#222" : vehicle.color;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 6); ctx.fill();
  ctx.fillStyle = vehicle.exploded ? "#111" : "#bfefff";
  ctx.fillRect(-6, -h / 2 + 3, 16, h - 6);
  ctx.fillStyle = "#111";
  for (const [wx, wy] of [[-w / 2 + 7, -h / 2 - 2], [w / 2 - 7, -h / 2 - 2], [-w / 2 + 7, h / 2 - 2], [w / 2 - 7, h / 2 - 2]]) ctx.fillRect(wx - 4, wy, 8, 4);
  if (vehicle.isPolice) {
    ctx.fillStyle = "#fff"; ctx.fillRect(-w / 2, -5, w, 10);
    ctx.fillStyle = "#d32f2f"; ctx.fillRect(-4, -h / 2, 8, 5);
    ctx.fillStyle = "#1565c0"; ctx.fillRect(-4, h / 2 - 5, 8, 5);
    ctx.fillStyle = "#111"; ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center"; ctx.fillText("POLICE", 0, 3);
  }
  if (vehicle.smoke > 0 && !vehicle.exploded) { ctx.fillStyle = "rgba(120,120,120,0.6)"; ctx.beginPath(); ctx.arc(-w / 2, 0, 7 + vehicle.smoke * 4, 0, Math.PI * 2); ctx.fill(); }
  if (vehicle.exploded) { ctx.fillStyle = "#ff6d00"; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ffd54f"; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
