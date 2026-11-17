// combat.js — punches, pistol shots, pedestrians, hit effects
import { dist } from "./config.js";
import { damagePlayer } from "./player.js";
import { damageVehicle } from "./vehicles.js";

export function createPedestrians(world, rng, count) {
  const peds = [];
  const names = ["Mia", "Leo", "Sofia", "Diego", "Luna", "Marco", "Ana", "Rio"];
  for (let i = 0; i < count; i++) {
    const road = world.nearestRoadPoint({ x: rng.range(80, 3100), y: rng.range(80, 2300) });
    peds.push({
      x: road.x + rng.range(-22, 22), y: road.y + rng.range(-22, 22),
      angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 55),
      health: 30, down: false, name: rng.pick(names),
      color: rng.pick(["#ffcc80", "#90caf9", "#a5d6a7", "#f48fb1", "#fff59d", "#ce93d8"]),
      timer: rng.range(0, 3), flee: 0,
    });
  }
  return peds;
}
export function updatePedestrians(peds, world, dt, danger) {
  for (const p of peds) {
    if (p.down) continue;
    p.timer -= dt;
    if (danger && dist(p, danger) < 130) p.flee = 1.2;
    if (p.flee > 0) {
      p.flee -= dt;
      p.angle = Math.atan2(p.y - danger.y, p.x - danger.x);
      p.x += Math.cos(p.angle) * 120 * dt; p.y += Math.sin(p.angle) * 120 * dt;
    } else {
      if (p.timer <= 0) { p.timer = 2.4; p.angle += (Math.random() - 0.5) * 1.4; }
      p.x += Math.cos(p.angle) * p.speed * dt; p.y += Math.sin(p.angle) * p.speed * dt;
    }
    if (world.collidesBuilding(p, 9)) { p.angle += Math.PI; p.x += Math.cos(p.angle) * 8; p.y += Math.sin(p.angle) * 8; }
    world.clampToWorld(p, 10);
  }
}
export function tryPunch(player, peds, heat, effects, onCrime) {
  let hit = false;
  for (const p of peds) {
    if (!p.down && dist(player, p) < 42) {
      p.health -= 18; p.flee = 1.5; hit = true;
      effects.push({ x: p.x, y: p.y - 14, r: 5, life: 0.25, maxLife: 0.25, kind: "hit" });
      if (p.health <= 0) p.down = true;
    }
  }
  if (hit && onCrime) onCrime("punch");
  return hit;
}
export function tryShoot(player, state, effects, onCrime) {
  const origin = { x: player.x, y: player.y };
  const dir = player.angle;
  const bullet = { x: origin.x + Math.cos(dir) * 18, y: origin.y + Math.sin(dir) * 18, angle: dir, life: 0.45, speed: 900 };
  state.bullets.push(bullet);
  effects.push({ x: bullet.x, y: bullet.y, r: 6, life: 0.08, maxLife: 0.08, kind: "muzzle" });
  if (onCrime) onCrime("shoot");
  return bullet;
}
export function updateBullets(state, dt, effects) {
  for (const b of state.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt; b.y += Math.sin(b.angle) * b.speed * dt; b.life -= dt;
    for (const p of state.peds) {
      if (!p.down && dist(b, p) < 13) { p.health -= 30; if (p.health <= 0) p.down = true; b.life = 0; effects.push({ x: p.x, y: p.y, r: 7, life: 0.3, maxLife: 0.3, kind: "hit" }); }
    }
    for (const v of [...state.vehicles, ...state.heat.cops.map((c) => c.vehicle)]) {
      if (!v.exploded && dist(b, v) < 26) { damageVehicle(v, 16, effects); b.life = 0; }
    }
    if (state.player.vehicle == null && dist(b, state.player) < 2) { /* own bullet spawn guard */ }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}
export function updateEffects(effects, dt) {
  for (const e of effects) { e.life -= dt; e.r += dt * (e.kind === "explosion" ? 90 : 24); }
  for (let i = effects.length - 1; i >= 0; i--) if (effects[i].life <= 0) effects.splice(i, 1);
}
export function copContactDamage(state, dt) {
  const p = state.player;
  if (p.vehicle) return;
  for (const cop of state.heat.cops) {
    if (Math.abs(cop.vehicle.speed) > 120 && dist(cop.vehicle, p) < 30) damagePlayer(p, 12 * dt * 4);
  }
}
export function drawPedestrian(ctx, ped) {
  ctx.save(); ctx.translate(ped.x, ped.y);
  if (ped.down) { ctx.rotate(Math.PI / 2); }
  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, 4, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.color; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffd9a0"; ctx.beginPath(); ctx.arc(0, -2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
export function drawEffects(ctx, effects) {
  for (const e of effects) {
    const a = Math.max(0, e.life / e.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = e.kind === "explosion" ? "#ff6d00" : e.kind === "muzzle" ? "#fff176" : "#ef5350";
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
export function drawBullets(ctx, bullets) {
  ctx.fillStyle = "#fff59d";
  for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); }
}
