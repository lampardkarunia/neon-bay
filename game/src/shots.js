// shots.js - Deterministic screenshot scenes for NEON BAY.
// The screenshot tool loads index.html?shot=<name>&seed=<n>; each scene
// builds a fixed, readable tableau and then flags window.__shotReady.

import { setWanted } from "./police.js";
import { startMission } from "./missions.js";

export function parseShotQuery(search) {
  const params = new URLSearchParams(search || "");
  const shot = params.get("shot");
  const seedRaw = params.get("seed");
  const seed = seedRaw === null ? 1 : Number.parseInt(seedRaw, 10);
  return { shot, seed: Number.isFinite(seed) ? seed : 1, isShot: !!shot };
}

export function applyShotScene(game, shotName) {
  if (!shotName) return;
  game.shotMode = shotName;
  if (shotName === "start") {
    game.state = "title";
  } else if (shotName === "street") {
    game.state = "playing";
    game.player.x = 480;
    game.player.y = 520;
    game.player.angle = 0.4;
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    setWanted(game, 0);
  } else if (shotName === "chase") {
    setupChaseScene(game);
  } else if (shotName === "mission") {
    game.state = "playing";
    startMission(game);
    game.player.x = 520;
    game.player.y = 500;
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
  } else {
    game.state = "playing";
  }
  // Let one render happen in main.js, then it sets __shotReady.
  game.shotPending = true;
}

function setupChaseScene(game) {
  game.state = "playing";
  // Put Jax in a sport car on a wide road in Downtown.
  const car = game.vehicles.find((v) => !v.isPolice && !v.parked) || game.vehicles[0];
  if (car) {
    car.x = 1120;
    car.y = 1120;
    car.angle = 0;
    car.speed = 150;
    car.driver = "player";
    car.occupied = true;
    game.player.vehicle = car;
    game.player.x = car.x;
    game.player.y = car.y;
  }
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  setWanted(game, 3);
  // Spawn real police cars close behind and beside the player car.
  game.spawnPoliceForShot(3);
  const positions = [
    { x: 1015, y: 1085, angle: 0.15 },
    { x: 1005, y: 1165, angle: -0.12 },
    { x: 1225, y: 1185, angle: 2.7 },
  ];
  game.police.units.forEach((unit, i) => {
    const pos = positions[i % positions.length];
    unit.vehicle.x = pos.x;
    unit.vehicle.y = pos.y;
    unit.vehicle.angle = pos.angle;
    unit.vehicle.speed = 140;
    unit.vehicle.isPolice = true;
  });
  game.police.seenNow = true;
  game.police.lastSeenX = game.player.x;
  game.police.lastSeenY = game.player.y;
  // A roadblock ahead makes the HEAT fantasy readable in one frame.
  game.police.roadblocks = [{ x: 1335, y: 1120, angle: Math.PI / 2, id: 99 }];
}

export function markShotReady(game) {
  if (game.shotPending) {
    game.shotPending = false;
    window.__shotReady = true;
  }
}
