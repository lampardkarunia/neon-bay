// main.js - Entry point and game loop for NEON BAY (HEAT variant).
// Wires every module together: world, player, vehicles, police HEAT,
// combat, missions, audio, rendering, save/load and shot mode.

import { CANVAS_WIDTH, CANVAS_HEIGHT, SAVE_KEY, clamp } from "./config.js";
import { createRandom } from "./random.js";
import { createInput } from "./input.js";
import { createWorld } from "./world.js";
import { createPlayer, updatePlayer, damagePlayer } from "./player.js";
import { spawnTraffic, spawnParkedCars, updateVehicles, damageVehicle } from "./vehicles.js";
import { createPoliceState, updatePolice, addWanted, setWanted, spawnPoliceUnit } from "./police.js";
import { spawnPedestrians, tryPunch, tryShoot, updateBullets, updatePedestrians, createParticle } from "./combat.js";
import { createMissionState, updateMissions } from "./missions.js";
import { createAudio } from "./audio.js";
import { drawWorld, drawHUD, roundRect } from "./render.js";
import { parseShotQuery, applyShotScene, markShotReady } from "./shots.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const shotQuery = parseShotQuery(window.location.search);
const seed = shotQuery.isShot ? shotQuery.seed : (Number(new URLSearchParams(window.location.search).get("seed")) || 2026);

class Game {
  constructor() {
    this.rng = createRandom(seed);
    this.input = createInput();
    this.audio = createAudio();
    this.world = createWorld(this.rng);
    this.player = createPlayer(480, 480);
    this.vehicles = [];
    this.pedestrians = [];
    this.bullets = [];
    this.particles = [];
    this.police = createPoliceState();
    this.missions = createMissionState();
    this.wanted = 0;
    this.moneyEarned = 0;
    this.time = 0;
    this.state = "title"; // title | playing | paused | busted | wasted
    this.camera = { x: this.player.x, y: this.player.y };
    this.bustedTimer = 0;
    this.shotMode = null;
    this.shotPending = false;
    this.overlayTimer = 0;

    spawnTraffic(this, 16);
    spawnParkedCars(this, 10);
    spawnPedestrians(this, 26);

    this.damagePlayer = (amount) => damagePlayer(this.player, amount);
    this.damageVehicle = (vehicle, amount) => damageVehicle(this, vehicle, amount);
  }

  onCrime(kind, x, y) {
    void x; void y;
    if (kind === "theft") addWanted(this, 1);
    else if (kind === "crash") { if (this.rng.chance(0.35)) addWanted(this, 1); }
    else if (kind === "hitPed") addWanted(this, 2);
    else if (kind === "shot") addWanted(this, 1);
    else if (kind === "assault") { if (this.rng.chance(0.4)) addWanted(this, 1); }
  }

  setWanted(level) { setWanted(this, level); }
  setWantedAtLeast(level) { if (this.wanted < level) setWanted(this, level); }

  spawnPoliceForShot(count) {
    for (let i = 0; i < count; i++) spawnPoliceUnit(this, this.player.x, this.player.y);
  }

  spawnExplosion(x, y) {
    this.audio.playExplosion();
    for (let i = 0; i < 26; i++) {
      const colors = ["#ff8500", "#ffd166", "#e63946", "#6c757d"];
      this.particles.push(createParticle(x, y, colors[i % colors.length], 60 + (i * 13) % 160, 0.5 + (i % 5) * 0.14, 5 + (i % 4)));
    }
  }

  spawnSparks(x, y) {
    for (let i = 0; i < 7; i++) this.particles.push(createParticle(x, y, "#ffe66d", 70 + i * 17, 0.3, 3));
  }

  spawnMuzzle(x, y) {
    for (let i = 0; i < 3; i++) this.particles.push(createParticle(x, y, "#ffd166", 40, 0.12, 4));
  }

  onBusted() {
    this.state = "busted";
    this.overlayTimer = 2.6;
    const fine = Math.min(this.player.money, 150 + this.wanted * 60);
    this.player.money -= fine;
    setWanted(this, 0);
    this.player.x = 480; this.player.y = 480;
    this.player.vehicle = null;
    showToast(this, `Busted! Fine $${fine}. Rae bails Jax out at the Marina plaza.`);
  }

  saveGame() {
    const data = {
      money: this.player.money,
      health: this.player.health,
      x: this.player.x, y: this.player.y,
      missionIndex: this.missions.index,
      wanted: 0,
    };
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (err) { void err; }
    showToast(this, "Saved to Neon Bay local storage.");
  }

  loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) { showToast(this, "No save found yet."); return false; }
      const data = JSON.parse(raw);
      this.player.money = data.money ?? this.player.money;
      this.player.health = clamp(data.health ?? 100, 10, 100);
      this.player.x = data.x ?? 480;
      this.player.y = data.y ?? 480;
      this.player.dead = false;
      this.missions.index = data.missionIndex ?? 0;
      this.missions.objectiveText = "Save loaded - press Enter to start the next job";
      this.state = "playing";
      return true;
    } catch (err) { void err; return false; }
  }

  startFromTitle() {
    this.audio.ensureContext();
    this.state = "playing";
  }

  update(dt) {
    this.time += dt;
    if (this.input.wasPressed("KeyM", "m")) this.audio.toggleMute();
    if (this.input.wasPressed("KeyP", "p")) {
      if (this.state === "playing") this.state = "paused";
      else if (this.state === "paused") this.state = "playing";
    }
    if (this.state === "title") {
      if (this.input.wasPressed("Enter", "enter", "Space", " ")) this.startFromTitle();
      this.input.endFrame();
      return;
    }
    if (this.state === "paused") { this.input.endFrame(); return; }
    if (this.state === "busted" || this.state === "wasted") {
      this.overlayTimer -= dt;
      if (this.overlayTimer <= 0) { this.state = "playing"; this.player.dead = false; this.player.health = 70; }
      this.input.endFrame();
      return;
    }

    updatePlayer(this, dt);
    updateVehicles(this, dt);
    updatePolice(this, dt);
    updatePedestrians(this, dt);
    updateBullets(this, dt);
    updateMissions(this, dt);
    // Particles.
    const kept = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life > 0) { p.x += p.vx * dt; p.y += p.vy * dt; kept.push(p); }
    }
    this.particles = kept;

    if (this.input.wasPressed("KeyF", "f")) tryPunch(this);
    if (this.input.isDown("Space", " ") && !this.shotMode) tryShoot(this);
    else if (this.input.wasPressed("Space", " ")) tryShoot(this);

    if (this.player.dead && this.state === "playing") {
      this.state = "wasted";
      this.overlayTimer = 2.6;
      setWanted(this, 0);
    }

    // Smooth camera follows the player (or their car).
    const focus = this.player.vehicle || this.player;
    this.camera.x += (focus.x - this.camera.x) * Math.min(1, dt * 5.2);
    this.camera.y += (focus.y - this.camera.y) * Math.min(1, dt * 5.2);
    this.camera.x = clamp(this.camera.x, CANVAS_WIDTH / 2 - 200, this.world.width - CANVAS_WIDTH / 2 + 200);
    this.camera.y = clamp(this.camera.y, CANVAS_HEIGHT / 2 - 120, this.world.height - CANVAS_HEIGHT / 2 + 120);

    this.audio.updateMusic(dt, this.wanted);
    this.input.endFrame();
  }

  render() {
    drawWorld(ctx, this, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (this.state === "title") { drawTitleScreen(ctx, this); return; }
    drawHUD(ctx, this, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (this.state === "paused") drawPauseScreen(ctx, this);
    if (this.state === "busted") drawCentreBanner(ctx, "BUSTED", "Rae bails Jax out... back at Marina plaza", "#e63946");
    if (this.state === "wasted") drawCentreBanner(ctx, "WASTED", "Jax wakes up patched up at the Marina clinic", "#6c757d");
    if (toast.timer > 0) drawToast(ctx);
  }
}

const toast = { text: "", timer: 0 };
function showToast(game, text) { void game; toast.text = text; toast.timer = 3.2; }
function drawToast(ctxRef) {
  ctxRef.fillStyle = "rgba(10,8,28,0.85)";
  roundRect(ctxRef, CANVAS_WIDTH / 2 - 260, 86, 520, 36, 8); ctxRef.fill();
  ctxRef.fillStyle = "#ffffff";
  ctxRef.font = "14px system-ui, sans-serif";
  ctxRef.textAlign = "center";
  ctxRef.fillText(toast.text, CANVAS_WIDTH / 2, 109);
  ctxRef.textAlign = "left";
}

function drawCentreBanner(ctxRef, title, sub, color) {
  ctxRef.fillStyle = "rgba(5,3,18,0.62)";
  ctxRef.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctxRef.fillStyle = color;
  ctxRef.font = "bold 72px system-ui, sans-serif";
  ctxRef.textAlign = "center";
  ctxRef.fillText(title, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctxRef.fillStyle = "#ffffff";
  ctxRef.font = "18px system-ui, sans-serif";
  ctxRef.fillText(sub, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 38);
  ctxRef.textAlign = "left";
}

function drawTitleScreen(ctxRef, game) {
  const gradient = ctxRef.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  gradient.addColorStop(0, "#3a0ca3");
  gradient.addColorStop(0.55, "#7209b7");
  gradient.addColorStop(0.78, "#f72585");
  gradient.addColorStop(1, "#ff9e5f");
  ctxRef.fillStyle = gradient;
  ctxRef.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  // Sun disc and skyline silhouette.
  ctxRef.fillStyle = "#ffd166";
  ctxRef.beginPath(); ctxRef.arc(CANVAS_WIDTH / 2, 330, 120, 0, Math.PI * 2); ctxRef.fill();
  ctxRef.fillStyle = "#1b1035";
  const skyline = [0, 90, 180, 260, 360, 470, 560, 680, 790, 880, 990, 1090, 1180];
  const heights = [130, 210, 150, 250, 170, 290, 190, 260, 150, 230, 170, 210, 140];
  skyline.forEach((x, i) => ctxRef.fillRect(x, 470 - heights[i] * 0.5, 95, 260));
  ctxRef.fillStyle = "#120826";
  ctxRef.fillRect(0, 470, CANVAS_WIDTH, 250);
  ctxRef.fillStyle = "#00f5d4";
  ctxRef.fillRect(0, 470, CANVAS_WIDTH, 4);
  ctxRef.textAlign = "center";
  ctxRef.fillStyle = "#ffffff";
  ctxRef.font = "bold 96px system-ui, sans-serif";
  ctxRef.shadowColor = "#ff2e88"; ctxRef.shadowBlur = 26;
  ctxRef.fillText("NEON BAY", CANVAS_WIDTH / 2, 170);
  ctxRef.shadowBlur = 0;
  ctxRef.font = "bold 24px system-ui, sans-serif";
  ctxRef.fillStyle = "#ffd166";
  ctxRef.fillText("HEAT  •  Jax Marlowe's last runs on the sunset strip", CANVAS_WIDTH / 2, 212);
  ctxRef.font = "17px system-ui, sans-serif";
  ctxRef.fillStyle = "#ffffff";
  ctxRef.fillText("Steal rides, run Rae's jobs across Marina, Downtown, Barrio and Portside - and outrun the HEAT.", CANVAS_WIDTH / 2, 535);
  ctxRef.fillText("WASD move/drive - E enter car - F punch - Space shoot - P pause - M mute", CANVAS_WIDTH / 2, 562);
  drawButton(ctxRef, CANVAS_WIDTH / 2 - 220, 590, 200, 52, "▶  START GAME", "#ff2e88");
  drawButton(ctxRef, CANVAS_WIDTH / 2 + 20, 590, 200, 52, "LOAD SAVE", "#4361ee");
  ctxRef.font = "13px system-ui, sans-serif";
  ctxRef.fillStyle = "#e0aaff";
  ctxRef.fillText("Press Enter to start - an original mini open-world made with vanilla JS, no assets, works offline", CANVAS_WIDTH / 2, 678);
  ctxRef.textAlign = "left";
  void game;
}

function drawButton(ctxRef, x, y, w, h, label, color) {
  ctxRef.fillStyle = color;
  roundRect(ctxRef, x, y, w, h, 10); ctxRef.fill();
  ctxRef.fillStyle = "#ffffff";
  ctxRef.font = "bold 18px system-ui, sans-serif";
  ctxRef.textAlign = "center";
  ctxRef.fillText(label, x + w / 2, y + 33);
  ctxRef.textAlign = "left";
}

function drawPauseScreen(ctxRef, game) {
  ctxRef.fillStyle = "rgba(5,3,18,0.66)";
  ctxRef.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctxRef.textAlign = "center";
  ctxRef.fillStyle = "#ffffff";
  ctxRef.font = "bold 54px system-ui, sans-serif";
  ctxRef.fillText("PAUSED", CANVAS_WIDTH / 2, 250);
  ctxRef.font = "18px system-ui, sans-serif";
  ctxRef.fillText("P - resume      S - save game      M - mute / unmute", CANVAS_WIDTH / 2, 305);
  ctxRef.fillText(`Money $${game.player.money} - Jobs done ${game.missions.index}/4 - Heat ${game.wanted} stars`, CANVAS_WIDTH / 2, 340);
  drawButton(ctxRef, CANVAS_WIDTH / 2 - 100, 380, 200, 50, "SAVE GAME", "#2a9d8f");
  ctxRef.textAlign = "left";
}

// Buttons (mouse support for title / pause).
canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const sx = CANVAS_WIDTH / rect.width;
  const sy = CANVAS_HEIGHT / rect.height;
  const mx = (event.clientX - rect.left) * sx;
  const my = (event.clientY - rect.top) * sy;
  if (game.state === "title") {
    if (mx >= CANVAS_WIDTH / 2 - 220 && mx <= CANVAS_WIDTH / 2 - 20 && my >= 590 && my <= 642) game.startFromTitle();
    if (mx >= CANVAS_WIDTH / 2 + 20 && mx <= CANVAS_WIDTH / 2 + 220 && my >= 590 && my <= 642) game.loadGame();
  } else if (game.state === "paused") {
    if (mx >= CANVAS_WIDTH / 2 - 100 && mx <= CANVAS_WIDTH / 2 + 100 && my >= 380 && my <= 430) game.saveGame();
  }
});
window.addEventListener("keydown", (event) => {
  if ((event.code === "KeyS" || event.key === "s") && game.state === "paused") game.saveGame();
});

const game = new Game();
window.__game = game;
if (shotQuery.isShot) applyShotScene(game, shotQuery.shot);

// Fixed-step-ish loop with clamped delta so tab hiccups do not teleport cars.
let lastTime = performance.now();
let shotFrames = 0;
function frame(now) {
  const dt = clamp((now - lastTime) / 1000, 0, 0.05);
  lastTime = now;
  toast.timer = Math.max(0, toast.timer - dt);
  if (!game.shotMode) {
    game.update(dt);
  } else if (game.shotMode !== "start") {
    // In shot mode, advance a few deterministic steps then freeze the tableau.
    if (shotFrames < 3) { game.state = game.shotMode === "start" ? "title" : "playing"; shotFrames += 1; }
  }
  game.render();
  if (game.shotPending) {
    markShotReady(game);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
