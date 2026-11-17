// main.js — game bootstrap, loop, interactions, save/load, camera
import { CONFIG, clamp, dist } from "./config.js";
import { createRng, seedFromQuery, shotNameFromQuery } from "./random.js";
import { createInput } from "./input.js";
import { createWorld, drawWorldBase } from "./world.js";
import { createPlayer, updatePlayerOnFoot, playerPosition, drawPlayer, healPlayer } from "./player.js";
import { spawnTraffic, updateVehicleDriving, updateTrafficVehicle, damageVehicle, drawVehicle } from "./vehicles.js";
import { createHeat, addCrime, updateHeat, drawRoadblock, drawHelicopter } from "./police.js";
import { createPedestrians, updatePedestrians, tryPunch, tryShoot, updateBullets, updateEffects, copContactDamage, drawPedestrian, drawEffects, drawBullets } from "./combat.js";
import { createMissionChain, updateMissions, missionToSave, missionFromSave, currentTarget } from "./missions.js";
import { createAudio } from "./audio.js";
import { drawHUD, drawMinimap, drawStartScreen, drawPause, drawBusted, drawObjectiveMarker } from "./render.js";
import { setupShotScene } from "./shots.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const minimap = document.getElementById("minimap");
const rng = createRng(seedFromQuery(window.location.search));
const shotName = shotNameFromQuery(window.location.search);

const world = createWorld(rng);
const player = createPlayer({ x: 500, y: 560 });
const vehicles = spawnTraffic(world, rng, 26);
const peds = createPedestrians(world, rng, 34);
const heat = createHeat();
const missions = createMissionChain();
const audio = createAudio();
const input = createInput();

const state = {
  mode: "title", paused: false, time: 0, camera: { x: 0, y: 0 },
  player, vehicles, peds, heat, missions, world, rng,
  bullets: [], effects: [], toast: "", toastTimer: 0,
  hasSave: !!localStorage.getItem(CONFIG.saveKey),
  shotMode: null, shotWarmup: 0, shotReadySent: false,
  onRepoPickup() { showToast("Car secured — deliver it!"); audio.pickup(); },
  onFinaleStart(stars) { heat.heat = Math.max(heat.heat, stars); heat.wanted = Math.max(heat.wanted, stars); showToast("Finale: the heat is on!"); },
};
function showToast(text) { state.toast = text; state.toastTimer = 3; }
function crime(kind) { addCrime(heat, kind); }

function nearestVehicle(pos, range) {
  let best = null, bestD = range;
  for (const v of vehicles) { if (v.exploded || v.driver === "police") continue; const d = dist(pos, v); if (d < bestD) { bestD = d; best = v; } }
  for (const cop of heat.cops) { const d = dist(pos, cop.vehicle); if (d < bestD) { bestD = d; best = cop.vehicle; } }
  return best;
}
function enterOrExitVehicle() {
  audio.unlock();
  if (player.vehicle) {
    const v = player.vehicle;
    player.x = v.x + Math.cos(v.angle + Math.PI / 2) * 30;
    player.y = v.y + Math.sin(v.angle + Math.PI / 2) * 30;
    v.driver = null; player.vehicle = null; audio.enterCar();
    return;
  }
  const v = nearestVehicle(player, CONFIG.interactRange);
  if (v) {
    const wasParkedTraffic = v.driver !== "player";
    v.driver = "player"; player.vehicle = v; audio.enterCar();
    if (wasParkedTraffic && !v.everStolen) { v.everStolen = true; crime("steal"); showToast("Car stolen — heat rising!"); }
  }
}
function checkVehicleCollisions(dt) {
  const driven = player.vehicle;
  if (driven && Math.abs(driven.speed) > 60) {
    for (const other of vehicles) {
      if (other !== driven && !other.exploded && dist(driven, other) < 42) {
        damageVehicle(other, 14, state.effects); damageVehicle(driven, 7, state.effects);
        other.x += Math.cos(driven.angle) * 14; other.y += Math.sin(driven.angle) * 14;
        crime("hitCar"); audio.crash();
      }
    }
    for (const cop of heat.cops) {
      if (dist(driven, cop.vehicle) < 42) { damageVehicle(cop.vehicle, 10, state.effects); damageVehicle(driven, 8, state.effects); audio.crash(); }
    }
    for (const p of peds) {
      if (!p.down && dist(driven, p) < 30) { p.down = true; p.health = 0; crime("hitPed"); showToast("You hit a pedestrian!"); }
    }
    for (const b of heat.roadblocks) {
      if (dist(driven, b) < 40) { damageVehicle(driven, 12, state.effects); driven.speed *= 0.35; audio.crash(); showToast("Roadblock!"); }
    }
  }
  if (player.vehicle && player.vehicle.exploded) {
    player.health -= 30; const v = player.vehicle;
    player.x = v.x + 34; player.y = v.y; player.vehicle = null; v.driver = null; audio.explosion();
    showToast("Your car exploded!");
  }
}
function saveGame() {
  const data = { money: player.money, health: player.health, x: player.x, y: player.y, missions: missionToSave(missions) };
  localStorage.setItem(CONFIG.saveKey, JSON.stringify(data));
  state.hasSave = true; showToast("Game saved");
}
function loadGame() {
  try {
    const data = JSON.parse(localStorage.getItem(CONFIG.saveKey) || "null");
    if (!data) return false;
    player.money = data.money ?? player.money; player.health = data.health ?? 100; player.alive = player.health > 0;
    player.x = data.x ?? player.x; player.y = data.y ?? player.y;
    missionFromSave(missions, data.missions);
    return true;
  } catch { return false; }
}
function resetRun() {
  player.health = 100; player.alive = true; player.vehicle = null;
  player.money = Math.max(40, player.money - 60);
  player.x = 500; player.y = 560; heat.wanted = 0; heat.heat = 0; heat.cops = [];
  state.mode = "playing";
}

canvas.addEventListener("click", (e) => {
  audio.unlock();
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (canvas.width / r.width);
  const y = (e.clientY - r.top) * (canvas.height / r.height);
  const inBtn = (bx, by, bw, bh) => x >= bx && x <= bx + bw && y >= by && y <= by + bh;
  if (state.mode === "title") {
    if (inBtn(490, 392, 300, 54)) state.mode = "playing";
    else if (state.hasSave && inBtn(490, 458, 300, 46)) { if (loadGame()) state.mode = "playing"; }
  } else if (state.mode === "busted") {
    if (inBtn(490, 392, 300, 54)) resetRun();
  } else if (state.paused) {
    if (inBtn(490, 360, 300, 50)) saveGame();
    if (inBtn(490, 424, 300, 50)) state.paused = false;
  }
});

function update(dt) {
  state.time += dt;
  if (state.toastTimer > 0) { state.toastTimer -= dt; if (state.toastTimer <= 0) state.toast = ""; }
  if (state.mode !== "playing") return;
  if (input.wasPressed("KeyP")) state.paused = !state.paused;
  if (input.wasPressed("KeyM")) { const m = audio.toggleMute(); showToast(m ? "Muted" : "Sound on"); }
  if (state.paused) return;
  if (input.wasPressed("KeyE")) enterOrExitVehicle();
  if (player.vehicle) {
    updateVehicleDriving(player.vehicle, input, dt);
    player.x = player.vehicle.x; player.y = player.vehicle.y;
  } else {
    updatePlayerOnFoot(player, input, world, dt);
    if (input.wasPressed("KeyF")) { if (tryPunch(player, peds, heat, state.effects, crime)) audio.punch(); }
    if (input.wasPressed("Space")) { tryShoot(player, state, state.effects, crime); audio.shoot(); }
  }
  for (const v of vehicles) if (v !== player.vehicle) updateTrafficVehicle(v, world, dt);
  const pos = playerPosition(player);
  updateHeat(heat, pos, world, rng, dt);
  audio.setSiren(heat.wanted >= 2 && state.mode === "playing");
  updatePedestrians(peds, world, dt, (player.vehicle && Math.abs(player.vehicle.speed) > 150) ? pos : null);
  updateBullets(state, dt, state.effects);
  updateEffects(state.effects, dt);
  copContactDamage(state, dt);
  checkVehicleCollisions(dt);
  updateMissions(missions, state, dt);
  if (heat.bustTimer > 2.2) { state.mode = "busted"; showToast("Busted!"); }
  if (!player.alive) state.mode = "busted";
  const targetCamX = clamp(pos.x - CONFIG.canvasWidth / 2, 0, CONFIG.worldWidth - CONFIG.canvasWidth);
  const targetCamY = clamp(pos.y - CONFIG.canvasHeight / 2, 0, CONFIG.worldHeight - CONFIG.canvasHeight);
  state.camera.x += (targetCamX - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (targetCamY - state.camera.y) * Math.min(1, dt * 5);
  if (state.shotWarmup > 0) state.shotWarmup -= 1;
}

function render() {
  if (state.mode === "title") { drawStartScreen(ctx, state); drawMinimap(minimap, state); return; }
  drawWorldBase(ctx, world, state.camera);
  ctx.save(); ctx.translate(-state.camera.x, -state.camera.y);
  drawObjectiveMarker(ctx, currentTarget(missions), state.time);
  for (const b of heat.roadblocks) drawRoadblock(ctx, b);
  for (const p of peds) drawPedestrian(ctx, p);
  for (const v of vehicles) drawVehicle(ctx, v);
  for (const cop of heat.cops) drawVehicle(ctx, cop.vehicle);
  drawPlayer(ctx, player);
  drawBullets(ctx, state.bullets);
  drawEffects(ctx, state.effects);
  drawHelicopter(ctx, heat.heli, state.time);
  ctx.restore();
  drawHUD(ctx, state);
  drawMinimap(minimap, state);
  if (state.paused) drawPause(ctx);
  if (state.mode === "busted") drawBusted(ctx);
}

if (shotName) setupShotScene(shotName, state);
else if (state.hasSave) { /* title offers load */ }

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt);
  render();
  input.endFrame();
  if (shotName && !state.shotReadySent && state.shotWarmup <= 0) {
    state.shotReadySent = true;
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__neonBay = state;
export { state };
