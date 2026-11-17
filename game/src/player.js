// player.js — Jax Marlowe: on-foot movement, health, driving link
import { CONFIG, clamp } from "./config.js";

export function createPlayer(start) {
  return {
    name: "Jax Marlowe",
    x: start.x, y: start.y, vx: 0, vy: 0,
    angle: 0, radius: CONFIG.playerRadius,
    health: CONFIG.playerMaxHealth, maxHealth: CONFIG.playerMaxHealth,
    money: CONFIG.moneyStart, vehicle: null, alive: true,
    walkPhase: 0, hurtTimer: 0,
  };
}
export function updatePlayerOnFoot(player, input, world, dt) {
  if (player.vehicle || !player.alive) return;
  const ax = input.axisX(), ay = input.axisY();
  const len = Math.hypot(ax, ay) || 1;
  const speed = CONFIG.playerSpeed;
  const nx = player.x + (ax / len) * speed * dt * (ax || ay ? 1 : 0);
  const ny = player.y + (ay / len) * speed * dt * (ax || ay ? 1 : 0);
  if (ax || ay) { player.angle = Math.atan2(ay, ax); player.walkPhase += dt * 10; }
  const probeX = { x: nx, y: player.y };
  if (!world.collidesBuilding(probeX, player.radius)) player.x = nx;
  const probeY = { x: player.x, y: ny };
  if (!world.collidesBuilding(probeY, player.radius)) player.y = ny;
  world.clampToWorld(player, player.radius);
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
}
export function damagePlayer(player, amount) {
  if (!player.alive) return;
  player.health = clamp(player.health - amount, 0, player.maxHealth);
  player.hurtTimer = 0.35;
  if (player.health <= 0) player.alive = false;
}
export function healPlayer(player, amount) {
  player.health = clamp(player.health + amount, 0, player.maxHealth);
  if (player.health > 0) player.alive = true;
}
export function playerPosition(player) {
  if (player.vehicle) return { x: player.vehicle.x, y: player.vehicle.y };
  return { x: player.x, y: player.y };
}
export function drawPlayer(ctx, player) {
  if (player.vehicle) return;
  ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(player.angle);
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(0, 5, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = player.hurtTimer > 0 ? "#ff5252" : "#ff2e88";
  ctx.beginPath(); ctx.arc(0, 0, player.radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ffd9a0"; ctx.beginPath(); ctx.arc(3, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#111"; ctx.fillRect(8, -3, 9, 6);
  ctx.restore();
  ctx.fillStyle = "#fff"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("JAX", player.x, player.y - 22);
}
