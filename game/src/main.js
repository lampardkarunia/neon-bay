// main.js - Game bootstrap, main loop, interaction glue and save/load.
// Keeps the other modules honest: they own data/logic, this file owns time.

import { SAVE_KEY, VIEW_WIDTH, VIEW_HEIGHT } from "./config.js";
import { setSeed } from "./random.js";
import { Input } from "./input.js";
import { buildWorld, updatePedestrians } from "./world.js";
import { createPlayer, updatePlayerOnFoot, playerPosition, respawnPlayer } from "./player.js";
import {
  spawnTraffic, nearestVehicle, updatePlayerVehicle, updateTrafficVehicle,
  checkVehicleCollisions, damageVehicle, createVehicle,
} from "./vehicles.js";
import {
  createHeat, raiseWanted, clearWanted, spawnPoliceNear, buildRoadblocks,
  createHelicopter, updateHelicopter, updatePolice, updateHeat,
} from "./police.js";
import { createCombatState, tryPunch, tryShoot, updateCombat } from "./combat.js";
import { createMissionState, updateMissions, currentMission } from "./missions.js";
import { GameAudio } from "./audio.js";
import { createCamera, updateCamera, renderGame, drawMinimap, drawHud } from "./render.js";
import { parseShotQuery, setupShotScene, applyShotPoliceLayout, markShotReadyWhenRendered } from "./shots.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const miniCanvas = document.getElementById("minimap");
const miniCtx = miniCanvas.getContext("2d");

const dom = {
  healthFill: document.getElementById("health-fill"),
  money: document.getElementById("money"),
  stars: document.getElementById("stars"),
  objective: document.getElementById("objective"),
  missionLabel: document.getElementById("mission-label"),
  district: document.getElementById("district"),
  message: document.getElementById("message"),
  vehicleLabel: document.getElementById("vehicle-label"),
  titleScreen: document.getElementById("title-screen"),
  pauseMenu: document.getElementById("pause-menu"),
  deadBanner: document.getElementById("dead-banner"),
};

const shot = parseShotQuery(window.location.search);
const seed = shot ? shot.seed : Math.floor(Math.random() * 99999) + 1;
setSeed(seed);

const audio = new GameAudio();
const input = new Input(window);
const world = buildWorld();

const game = {
  state: "title",
  paused: false,
  shotMode: false,
  world,
  player: createPlayer(600, 640),
  vehicles: [],
  police: [],
  roadblocks: [],
  heat: createHeat(),
  combat: createCombatState(),
  missions: createMissionState(),
  camera: createCamera(),
  heli: createHelicopter(),
  audio,
  time: 0,
  frames: 0,
  needsPoliceSpawn: false,
  shotPoliceLayout: null,
  changedVehicleRecently: 0,
  muted: false,
};

game.vehicles = spawnTraffic(world, 26);
// A guaranteed sport coupe for the repo mission, parked in Downtown.
const repoCar = createVehicle("sport", 2400, 600, Math.PI / 2, "#ff2e88");
game.vehicles.push(repoCar);

const heatApi = {
  raise(amount, reason) {
    const grew = raiseWanted(game.heat, amount, reason);
    if (grew) game.needsPoliceSpawn = true;
  },
};

function saveGame() {
  try {
    const pos = playerPosition(game.player);
    const data = {
      money: game.player.money,
      health: game.player.health,
      x: pos.x, y: pos.y,
      missionIndex: game.missions.index,
      totalEarned: game.missions.totalEarned,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    game.missions.message = "Saved. Rae will remember that.";
    game.missions.messageTimer = 3;
  } catch { /* storage may be unavailable; saving is best-effort */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    game.player.money = Number(data.money) || 0;
    game.player.health = Math.max(20, Number(data.health) || 100);
    game.player.x = Number(data.x) || 600;
    game.player.y = Number(data.y) || 640;
    game.missions.index = Math.min(4, Number(data.missionIndex) || 0);
    game.missions.totalEarned = Number(data.totalEarned) || 0;
    return true;
  } catch {
    return false;
  }
}

function startGame(load) {
  if (load) loadGame();
  game.state = "playing";
  game.paused = false;
  dom.titleScreen.style.display = "none";
  dom.pauseMenu.style.display = "none";
  audio.ensure();
  audio.startMusic();
}

function togglePause() {
  if (game.state !== "playing") return;
  game.paused = !game.paused;
  dom.pauseMenu.style.display = game.paused ? "flex" : "none";
}

function enterOrExitVehicle() {
  const player = game.player;
  if (player.vehicle) {
    const car = player.vehicle;
    car.isPlayerVehicle = false;
    player.vehicle = null;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    audio.playEnterCar();
    return;
  }
  const car = nearestVehicle([...game.vehicles, ...game.police], player.x, player.y, 58);
  if (!car) return;
  if (car.isPolice) {
    heatApi.raise(1, "stealing a police cruiser");
  } else if (!car.stolen && car.ai) {
    car.stolen = true;
    heatApi.raise(1, "grand theft auto");
  }
  car.ai = null;
  car.isPlayerVehicle = true;
  player.vehicle = car;
  game.changedVehicleRecently = 4;
  audio.playEnterCar();
  // Finale trigger helper: entering a car during finale raises heat.
  const mission = currentMission(game.missions);
  if (mission && mission.id === "finale" && game.heat.wanted === 0) {
    heatApi.raise(2, "finale getaway");
  }
}

function handleInteractions() {
  const player = game.player;
  if (input.wasPressed("KeyE")) enterOrExitVehicle();
  if (input.wasPressed("KeyF")) {
    if (tryPunch(player, world, game.police, game.vehicles, game.combat, heatApi)) audio.playPunch();
    else if (!player.vehicle) audio.playPunch();
  }
  if (input.wasPressed("Space")) {
    if (tryShoot(player, game.combat, heatApi)) audio.playShot();
  }
  if (input.wasPressed("KeyP")) togglePause();
  if (input.wasPressed("KeyM")) {
    game.muted = !game.muted;
    audio.setMuted(game.muted);
  }
}

function update(dt) {
  if (game.state !== "playing" || game.paused) return;
  game.time += dt;
  game.changedVehicleRecently = Math.max(0, game.changedVehicleRecently - dt);
  const player = game.player;
  const posBefore = playerPosition(player);

  handleInteractions();

  if (player.vehicle) {
    updatePlayerVehicle(player.vehicle, input, world, dt);
    player.x = player.vehicle.x;
    player.y = player.vehicle.y;
    player.punchTimer = Math.max(0, player.punchTimer - dt);
    player.shootTimer = Math.max(0, player.shootTimer - dt);
    player.hurtFlash = Math.max(0, player.hurtFlash - dt);
  } else {
    updatePlayerOnFoot(player, input, world, dt);
  }

  for (const car of game.vehicles) updateTrafficVehicle(car, world, dt);

  const pos = playerPosition(player);
  const danger = game.heat.wanted > 0 || (player.vehicle && Math.abs(player.vehicle.speed) > 200)
    ? pos : null;
  updatePedestrians(world, dt, danger);

  // Traffic hitting pedestrians / player consequences.
  for (const car of [...game.vehicles, ...game.police]) {
    if (Math.abs(car.speed) < 70) continue;
    for (const ped of world.pedestrians) {
      if (!ped.down && Math.hypot(ped.x - car.x, ped.y - car.y) < 26) {
        ped.down = true;
        if (car.isPlayerVehicle) heatApi.raise(1, "hit and run");
      }
    }
  }

  // Police spawning follows wanted level.
  if (game.needsPoliceSpawn || (game.heat.wanted > 0 && game.police.length === 0)) {
    spawnPoliceNear(game.heat, game.police, pos, world);
    game.needsPoliceSpawn = false;
    applyShotPoliceLayout(game);
    game.roadblocks = buildRoadblocks(game.heat, pos);
  }
  if (game.heat.wanted === 0 && game.police.length) {
    game.police = [];
    game.roadblocks = [];
  }

  updatePolice(game.heat, game.police, pos, world, dt);
  game.heli.active = game.heat.wanted >= 5;
  if (game.heli.active) {
    if (game.heli.x === 0 && game.heli.y === 0) { game.heli.x = pos.x; game.heli.y = pos.y - 200; }
    updateHelicopter(game.heli, pos, dt);
  }
  audio.setSiren(game.police.length > 0 && game.state === "playing" && !game.shotMode);

  const events = [];
  const allCars = [...game.vehicles, ...game.police];
  if (player.vehicle && !allCars.includes(player.vehicle)) allCars.push(player.vehicle);
  checkVehicleCollisions(allCars, events, (a, b) => {
    if (a.isPlayerVehicle || b.isPlayerVehicle) heatApi.raise(1, "vehicle collision");
  });
  for (const event of events) {
    if (event.type === "explosion") {
      audio.playExplosion();
      game.combat.effects.push({ type: "explosion", x: event.x, y: event.y, life: 0.5, maxLife: 0.5 });
      if (Math.hypot(pos.x - event.x, pos.y - event.y) < 90) {
        // Explosion splash.
        player.health = Math.max(1, player.health - 18);
      }
    }
  }
  for (const effect of game.combat.effects) {
    if (effect.type === "explosion") damageVehicle(player.vehicle || { health: 999 }, 0, null);
  }

  updateCombat(game.combat, world, game.police, game.vehicles, player, dt, heatApi);
  updateHeat(game.heat, game.police, pos, dt, game.changedVehicleRecently > 0);
  updateMissions(game.missions, player, pos, game.heat, dt, { audio });

  if (player.dead) {
    dom.deadBanner.style.display = "flex";
    setTimeout(() => {
      if (!player.dead) return;
      respawnPlayer(player, 600, 640);
      clearWanted(game.heat);
      game.police = [];
      dom.deadBanner.style.display = "none";
      player.money = Math.max(0, player.money - 50);
    }, game.shotMode ? 999999 : 1600);
  }

  updateCamera(game.camera, pos, world, dt);
  void posBefore;
}

function frame(timestamp) {
  requestAnimationFrame(frame);
  const now = timestamp / 1000;
  if (!frame.last) frame.last = now;
  const dt = Math.min(0.05, now - frame.last);
  frame.last = now;

  update(dt);
  renderGame(ctx, game, now);
  drawMinimap(miniCtx, game);
  drawHud(dom, game);
  game.frames += 1;
  markShotReadyWhenRendered(game, game.frames);
  input.endFrame();
}

document.getElementById("start-btn").addEventListener("click", () => startGame(false));
document.getElementById("load-btn").addEventListener("click", () => startGame(true));
document.getElementById("resume-btn").addEventListener("click", () => togglePause());
document.getElementById("save-btn").addEventListener("click", () => { saveGame(); togglePause(); });
document.getElementById("save-btn-hud").addEventListener("click", () => saveGame());

if (shot) {
  setupShotScene(game, shot.name);
  if (game.state === "playing") {
    dom.titleScreen.style.display = "none";
    if (game.needsPoliceSpawn) {
      const pos = playerPosition(game.player);
      spawnPoliceNear(game.heat, game.police, pos, world);
      game.needsPoliceSpawn = false;
      applyShotPoliceLayout(game);
      game.roadblocks = buildRoadblocks(game.heat, pos);
    }
    // Settle camera and render a few frames before readiness is flagged.
    updateCamera(game.camera, playerPosition(game.player), world, 1);
  } else {
    dom.titleScreen.style.display = "flex";
  }
}

canvas.width = VIEW_WIDTH;
canvas.height = VIEW_HEIGHT;
requestAnimationFrame(frame);

// Expose a tiny debug handle for tooling (not used by gameplay).
window.__neonBay = game;
