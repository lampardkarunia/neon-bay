// shots.js — pementasan adegan untuk mode screenshot (?shot=<nama>&seed=<n>).
// Setiap adegan dimulai dari dunia segar yang dibangun dari seed yang sama,
// lalu entitasnya ditempatkan secara eksplisit supaya hasil tangkapannya stabil.
import { CFG } from './config.js';
import { spawnTraffic, spawnPeds } from './vehicles.js';
import { startMission } from './missions.js';

function freshState(state, seed) {
  state.seed = seed;
  state.rng = state.rngFactory(seed);
  state.world = state.worldFactory(seed);
  state.traffic = spawnTraffic(state, CFG.TRAFFIC_COUNT);
  state.peds = spawnPeds(state, CFG.PED_COUNT);
  state.police = [];
  state.roadblocks = [];
  state.heli = null;
  state.bullets = [];
  state.particles = [];
  state.toast = null;
  state.toastTimer = 0;
  state.time = 0;
}

export function stageShot(state, name, seed) {
  freshState(state, seed);
  const p = state.player;
  const w = state.world;

  if (name === 'start') {
    state.mode = 'title';
    p.x = 1200; p.y = 1000;
    return;
  }

  state.mode = 'play';

  if (name === 'street') {
    p.x = 1100; p.y = 1000; p.onFoot = true; p.car = null;
    p.wanted = 0;
    state.camera.x = p.x - CFG.VIEW_W / 2;
    state.camera.y = p.y - CFG.VIEW_H / 2;
    return;
  }

  if (name === 'chase') {
    const car = state.traffic[0];
    state.traffic = state.traffic.filter((c) => c !== car);
    car.x = 1500; car.y = 1400; car.angle = 0; car.speed = 380;
    p.car = car; p.onFoot = false; p.carHealth = 100;
    p.x = car.x; p.y = car.y; p.angle = 0; p.speed = 380;
    p.wanted = 5; p.hiddenTimer = 0;
    const spots = [
      [1500, 1000, Math.PI / 2], [1100, 1400, 0], [1900, 1400, Math.PI],
      [1500, 1800, -Math.PI / 2], [1250, 1150, Math.PI / 4], [1750, 1650, -Math.PI * 0.75],
    ];
    for (const [x, y, a] of spots) {
      state.police.push({ x, y, angle: a, speed: 300, health: 60, sirenPhase: state.rng.range(0, 6), ramCooldown: 0, stuck: 0 });
    }
    state.heli = { x: 1400, y: 1200, angle: 0, rotor: 0, spotlight: 150 };
    state.roadblocks.push({
      x: 1900, y: 1400, axis: 'h', ttl: 45,
      cars: [
        { x: 1900, y: 1354, angle: Math.PI / 2, color: '#1e3a8a' },
        { x: 1900, y: 1400, angle: Math.PI / 2, color: '#1e3a8a' },
        { x: 1900, y: 1446, angle: Math.PI / 2, color: '#1e3a8a' },
      ],
    });
    state.camera.x = p.x - CFG.VIEW_W / 2;
    state.camera.y = p.y - CFG.VIEW_H / 2;
    return;
  }

  if (name === 'mission') {
    const car = state.traffic[1];
    state.traffic = state.traffic.filter((c) => c !== car);
    car.x = 900; car.y = 1000; car.angle = Math.PI; car.speed = 320;
    p.car = car; p.onFoot = false; p.carHealth = 100;
    p.x = car.x; p.y = car.y; p.angle = Math.PI; p.speed = 320;
    startMission(state, 1);
    state.mission.dialog = null;
    for (const [x, y, a] of [[900, 700, Math.PI / 2], [600, 1000, 0], [1200, 1000, Math.PI]]) {
      state.police.push({ x, y, angle: a, speed: 280, health: 60, sirenPhase: 1, ramCooldown: 0, stuck: 0 });
    }
    state.camera.x = p.x - CFG.VIEW_W / 2;
    state.camera.y = p.y - CFG.VIEW_H / 2;
    return;
  }

  state.mode = 'title';
}
