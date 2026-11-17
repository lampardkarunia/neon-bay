// main.js — titik masuk permainan: membuat state, menjalankan loop, menggambar,
// menangani tombol global, menyimpan ke localStorage, dan memasang hook window.__nb.
// NEON BAY — HEAT (Varian B), dengan kota dan tokoh yang sepenuhnya orisinal.
import { CFG } from './config.js';
import { makeRng, clamp, lerp } from './random.js';
import { buildWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer, updatePlayer, tryEnterExitCar, addWanted } from './player.js';
import { spawnTraffic, spawnPeds, updateTraffic, updatePeds } from './vehicles.js';
import { updatePolice, createPoliceState } from './police.js';
import { createMissionState, startMission, advanceDialog, updateMission, nextMissionAvailable } from './missions.js';
import { tryPunch, tryShoot, updateBullets, updateParticles } from './combat.js';
import {
  drawWorld, drawEntities, drawHUD, drawMinimap,
  drawTitle, drawPause, drawBusted, drawWin,
} from './render.js';
import {
  initAudio, toggleMute, updateSiren, updateEngine,
  playShot, playPunch, playBlip, playCash, playCrash,
} from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = parseInt(params.get('seed') || '1', 10) || 1;

function newState(seedValue) {
  const rng = makeRng(seedValue);
  const world = buildWorld(seedValue);
  const st = {
    seed: seedValue,
    rng, world,
    rngFactory: (s) => makeRng(s),
    worldFactory: (s) => buildWorld(s),
    mode: 'title',
    time: 0,
    player: createPlayer(1200, 1000),
    camera: { x: 1200 - CFG.VIEW_W / 2, y: 1000 - CFG.VIEW_H / 2 },
    traffic: [],
    peds: [],
    bullets: [],
    particles: [],
    mission: createMissionState(),
    toast: null,
    toastTimer: 0,
    gunshotTimer: 0,
    shotSound: false, punchSound: false, cashSound: false, audioCrash: false,
    lastShotWantedAt: 0,
    hasSave: false,
    winText: '',
    ...createPoliceState(),
  };
  st.traffic = spawnTraffic(st, CFG.TRAFFIC_COUNT);
  st.peds = spawnPeds(st, CFG.PED_COUNT);
  return st;
}

let state = newState(seed);
let input = createInput();
input.attach(canvas);

function saveGame() {
  try {
    const p = state.player;
    const data = {
      money: p.money, x: p.x, y: p.y,
      missionsDone: state.mission.completed,
      missionIndex: state.mission.index,
      wanted: p.wanted, health: p.health,
    };
    localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(data));
    state.toast = 'Permainan disimpan!';
    state.toastTimer = 2;
    return true;
  } catch (e) { return false; }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(CFG.SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function applySave(data) {
  if (!data) return;
  const p = state.player;
  p.money = data.money || 0;
  p.x = data.x || 1200; p.y = data.y || 1000;
  p.health = data.health || 100;
  p.wanted = data.wanted || 0;
  state.mission.completed = data.missionsDone || [];
  state.mission.index = typeof data.missionIndex === 'number' ? data.missionIndex : -1;
  state.mission.pendingNext = state.mission.index >= 0 && state.mission.index < 3;
  state.camera.x = p.x - CFG.VIEW_W / 2;
  state.camera.y = p.y - CFG.VIEW_H / 2;
  state.toast = 'Save dimuat — selamat datang kembali, Jax.';
  state.toastTimer = 3;
}

state.hasSave = !!loadSave();

// Hook baca/tulis kecil yang dipakai pengujian otomatis untuk memeriksa state permainan.
window.__nb = {
  get mode() { return state.mode; },
  get wanted() { return state.player.wanted; },
  get playerX() { return state.player.x; },
  get playerY() { return state.player.y; },
  get inCar() { return !state.player.onFoot; },
  get health() { return state.player.health; },
  get money() { return state.player.money; },
  get policeCount() { return state.police.length; },
  get heliActive() { return !!state.heli; },
  get roadblockCount() { return state.roadblocks.length; },
  get trafficCount() { return state.traffic.length; },
  get missionIndex() { return state.mission.index; },
  get missionActive() { return !!state.mission.active; },
  get missionTitle() { return state.mission.active ? state.mission.active.title : null; },
  get bullets() { return state.bullets.length; },
  debugSetWanted(n) { state.player.wanted = clamp(n, 0, CFG.MAX_WANTED); state.player.hiddenTimer = 0; },
  debugTeleport(x, y) {
    state.player.x = x; state.player.y = y;
    if (state.player.car) { state.player.car.x = x; state.player.car.y = y; }
  },
  debugReset() {
    state.player.health = 100;
    state.player.carHealth = 100;
    if (state.mode === 'busted') state.mode = 'play';
  },
  debugStartMission(i) { return startMission(state, i); },
  debugNearestCar() {
    let best = null, bestD = Infinity;
    for (const c of state.traffic) {
      if (c.disabled) continue;
      const d = Math.hypot(c.x - state.player.x, c.y - state.player.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best ? { x: best.x, y: best.y, dist: bestD } : null;
  },
};

function resetWorld() {
  const keepMoney = state.player.money;
  const keepMissions = state.mission.completed.slice();
  state = newState(seed);
  state.player.money = keepMoney;
  state.mission.completed = keepMissions;
  window.__nb = window.__nb;
}

function step(dt) {
  state.time += dt;
  state.toastTimer = Math.max(0, state.toastTimer - dt);
  state.gunshotTimer = Math.max(0, state.gunshotTimer - dt);

  if (state.mode === 'play') {
    if (input.wasPressed('KeyE')) tryEnterExitCar(state);
    if (input.wasPressed('KeyF') || input.mouseClicked) tryPunch(state);
    if (input.wasPressed('Space')) tryShoot(state);
    if (input.wasPressed('Enter')) {
      if (state.mission.dialog) advanceDialog(state);
      else if (!state.mission.active && state.mission.index < 3) {
        const idx = state.mission.index < 0 ? 0 : state.mission.index;
        startMission(state, idx);
        state.mission.pendingNext = false;
        playBlip(880);
      }
    }

    updatePlayer(state, input, dt);
    updateTraffic(state, dt);
    updatePeds(state, dt);
    updatePolice(state, dt);
    updateBullets(state, dt);
    updateParticles(state, dt);
    updateMission(state, dt);

    const tx = clamp(state.player.x - CFG.VIEW_W / 2, 0, CFG.WORLD_W - CFG.VIEW_W);
    const ty = clamp(state.player.y - CFG.VIEW_H / 2, 0, CFG.WORLD_H - CFG.VIEW_H);
    state.camera.x = lerp(state.camera.x, tx, 1 - Math.pow(0.001, dt));
    state.camera.y = lerp(state.camera.y, ty, 1 - Math.pow(0.001, dt));

    updateSiren(state.player.wanted, dt);
    updateEngine(state.player.onFoot ? 0 : Math.abs(state.player.speed || 0) / CFG.CAR_MAX_SPEED, !state.player.onFoot);
    if (state.shotSound) { playShot(); state.shotSound = false; }
    if (state.punchSound) { playPunch(); state.punchSound = false; }
    if (state.cashSound) { playCash(); state.cashSound = false; }
    if (state.audioCrash) { playCrash(); state.audioCrash = false; }
  }
}

function render() {
  ctx.clearRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
  if (state.mode === 'title') {
    drawTitle(ctx, state);
    return;
  }
  ctx.save();
  ctx.translate(-Math.round(state.camera.x), -Math.round(state.camera.y));
  drawWorld(ctx, state);
  drawEntities(ctx, state);
  ctx.restore();
  drawHUD(ctx, state);
  drawMinimap(ctx, state);
  if (state.mode === 'pause') drawPause(ctx, state);
  if (state.mode === 'busted') drawBusted(ctx, state);
  if (state.mode === 'win') drawWin(ctx, state);
}

function handleGlobalKeys() {
  if (input.wasPressed('KeyM')) {
    const m = toggleMute();
    state.toast = m ? 'Suara mati' : 'Suara hidup';
    state.toastTimer = 1.5;
  }
  if (input.wasPressed('KeyP')) {
    if (state.mode === 'play') { state.mode = 'pause'; playBlip(440); }
    else if (state.mode === 'pause') { state.mode = 'play'; playBlip(660); }
  }
  if (input.wasPressed('KeyS') && state.mode === 'pause') saveGame();
  if (input.wasPressed('KeyR') && state.mode === 'pause') {
    state = newState(seed);
    state.mode = 'play';
  }
  if (input.wasPressed('Enter')) {
    if (state.mode === 'title') {
      initAudio();
      state.mode = 'play';
      playBlip(880);
      input.consume('Enter');
    } else if (state.mode === 'busted') {
      const money = Math.floor(state.player.money / 2);
      state = newState(seed);
      state.player.money = money;
      state.mode = 'play';
      input.consume('Enter');
    } else if (state.mode === 'win') {
      state.mode = 'play';
      state.mission.index = 3;
      input.consume('Enter');
    }
  }
  if (input.wasPressed('KeyC') && state.mode === 'title' && state.hasSave) {
    initAudio();
    applySave(loadSave());
    state.mode = 'play';
  }
  if (input.mouseClicked) initAudio();
}

let last = performance.now();
let shotReady = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  handleGlobalKeys();
  step(dt);
  render();
  input.endFrame();

  if (shotName && !shotReady) {
    shotReady = true;
    window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

function boot() {
  if (shotName) {
    const hint = document.getElementById('hint');
    if (hint) hint.style.display = 'none';
    canvas.width = CFG.VIEW_W * 2;
    canvas.height = CFG.VIEW_H * 2;
    canvas.style.width = CFG.VIEW_W + 'px';
    canvas.style.height = CFG.VIEW_H + 'px';
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    stageShot(state, shotName, seed);
    for (let i = 0; i < 5; i++) step(1 / 60);
    render();
    window.__shotReady = true;
    shotReady = true;
    requestAnimationFrame(frame);
  } else {
    canvas.width = CFG.VIEW_W;
    canvas.height = CFG.VIEW_H;
    requestAnimationFrame(frame);
  }
}

boot();
