// police.js — HEAT system: wanted stars, pursuit AI, roadblocks, helicopter
import { CONFIG, clamp, dist } from "./config.js";
import { createVehicle } from "./vehicles.js";

export function createHeat() {
  return { wanted: 0, heat: 0, decayTimer: 0, seenTimer: 0, cops: [], roadblocks: [], heli: null, bustTimer: 0 };
}
export function addCrime(heat, kind) {
  const gain = CONFIG.wantedPerCrime[kind] ?? 0.5;
  heat.heat = clamp(heat.heat + gain, 0, 5);
  heat.wanted = Math.max(heat.wanted, Math.ceil(heat.heat - 0.001));
  if (heat.wanted < 1 && heat.heat > 0) heat.wanted = 1;
  heat.seenTimer = 3;
}
export function setWanted(heat, stars) {
  heat.wanted = clamp(stars, 0, 5); heat.heat = heat.wanted; heat.seenTimer = 3;
}
export function anyCopSeesPlayer(heat, target) {
  return heat.cops.some((c) => !c.vehicle.exploded && dist(c.vehicle, target) < 430);
}
export function updateHeat(heat, target, world, rng, dt) {
  const seen = anyCopSeesPlayer(heat, target);
  if (seen) { heat.seenTimer = 3; heat.decayTimer = 0; }
  else if (heat.wanted > 0) {
    heat.seenTimer -= dt; heat.decayTimer += dt;
    if (heat.decayTimer >= CONFIG.wantedDecaySeconds) {
      heat.decayTimer = 0; heat.heat = Math.max(0, heat.heat - 1); heat.wanted = Math.ceil(heat.heat - 0.001);
      if (heat.heat <= 0) { heat.wanted = 0; heat.heat = 0; }
    }
  }
  const desired = heat.wanted === 0 ? 0 : Math.min(6, heat.wanted * CONFIG.policePerStar - (heat.wanted >= 4 ? 1 : 0));
  while (heat.cops.length < desired) heat.cops.push(spawnCop(heat, target, world, rng));
  while (heat.cops.length > desired) { const c = heat.cops.pop(); c.vehicle.dead = true; }
  for (const cop of heat.cops) updateCop(cop, target, heat, dt);
  const blockCount = heat.wanted >= 4 ? 3 : 2;
  heat.roadblocks = heat.wanted >= 3 ? ensureRoadblocks(heat, target, world, rng, blockCount) : [];
  if (heat.wanted >= 5) {
    if (!heat.heli) heat.heli = { x: target.x, y: target.y - 200, angle: 0 };
    const h = heat.heli;
    h.angle += dt * 2.2;
    h.x += (target.x + Math.cos(h.angle) * 110 - h.x) * Math.min(1, dt * 1.6);
    h.y += (target.y + Math.sin(h.angle) * 110 - h.y) * Math.min(1, dt * 1.6);
  } else heat.heli = null;
  const nearCop = heat.cops.some((c) => dist(c.vehicle, target) < 34 && Math.abs(c.vehicle.speed) < 40);
  heat.bustTimer = nearCop && !targetInFastCar(target) ? heat.bustTimer + dt : 0;
}
function targetInFastCar() { return false; }
function spawnCop(heat, target, world, rng) {
  const a = rng.range(0, Math.PI * 2), d = rng.range(420, 560);
  const pos = { x: clamp(target.x + Math.cos(a) * d, 60, CONFIG.worldWidth - 60), y: clamp(target.y + Math.sin(a) * d, 60, CONFIG.worldHeight - 60) };
  const road = world.nearestRoadPoint(pos);
  const vehicle = createVehicle("police", road.x, road.y, a + Math.PI, rng, true);
  vehicle.driver = "police";
  return { vehicle, ramCooldown: rng.range(0, 1) };
}
function ensureRoadblocks(heat, target, world, rng, blockCount = 2) {
  if (heat.roadblocks.length >= blockCount) return heat.roadblocks.slice(0, blockCount);
  const blocks = [...heat.roadblocks];
  while (blocks.length < blockCount) {
    const ahead = { x: target.x + rng.range(260, 420) * (rng.chance(0.5) ? 1 : -1), y: target.y + rng.range(-160, 160) };
    const road = world.nearestRoadPoint(ahead);
    blocks.push({ x: clamp(road.x, 60, CONFIG.worldWidth - 60), y: clamp(road.y, 60, CONFIG.worldHeight - 60), angle: rng.chance(0.5) ? 0 : Math.PI / 2 });
  }
  return blocks;
}
export function updateCop(cop, target, heat, dt) {
  const v = cop.vehicle;
  if (v.exploded) return;
  const d = dist(v, target);
  const blockOffset = heat.cops.indexOf(cop) % 3 === 2 ? 130 : 0;
  const goal = blockOffset ? { x: target.x + Math.cos(Math.atan2(target.y - v.y, target.x - v.x)) * blockOffset, y: target.y + Math.sin(Math.atan2(target.y - v.y, target.x - v.x)) * blockOffset } : target;
  const desired = Math.atan2(goal.y - v.y, goal.x - v.x);
  let diff = desired - v.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  v.angle += clamp(diff, -v.spec.turn * dt, v.spec.turn * dt);
  // Rubber-band tuning (revision): distant cops close the gap a little faster,
  // but cops already on top of the player ease off so rams stay readable.
  const catchUp = d > 320 ? 1.0 : d > 60 ? 0.92 : 0.45;
  const wantSpeed = v.spec.maxSpeed * catchUp;
  v.speed += clamp(wantSpeed - v.speed, -300 * dt, v.spec.accel * dt);
  v.x += Math.cos(v.angle) * v.speed * dt;
  v.y += Math.sin(v.angle) * v.speed * dt;
  cop.ramCooldown -= dt;
}
export function drawRoadblock(ctx, block) {
  ctx.save(); ctx.translate(block.x, block.y); ctx.rotate(block.angle);
  ctx.fillStyle = "#ff9800";
  for (let i = -1; i <= 1; i++) ctx.fillRect(i * 26 - 10, -6, 20, 12);
  ctx.fillStyle = "#fff";
  for (let i = -1; i <= 1; i++) ctx.fillRect(i * 26 - 10, -2, 20, 4);
  ctx.restore();
}
export function drawHelicopter(ctx, heli, time) {
  if (!heli) return;
  ctx.save(); ctx.translate(heli.x, heli.y);
  ctx.fillStyle = "rgba(255,255,200,0.14)"; ctx.beginPath(); ctx.arc(0, 60, 90, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(Math.sin(time * 2) * 0.15);
  ctx.fillStyle = "#14181f"; ctx.beginPath(); ctx.ellipse(0, 0, 30, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-52, -3, 26, 6);
  ctx.strokeStyle = "#cfd8dc"; ctx.lineWidth = 3;
  const r = Math.sin(time * 40) * 34;
  ctx.beginPath(); ctx.moveTo(-34 + Math.abs(r) * 0.2, -10); ctx.lineTo(34 - Math.abs(r) * 0.2, -10); ctx.stroke();
  ctx.fillStyle = "#d32f2f"; ctx.beginPath(); ctx.arc(12, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
