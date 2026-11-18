// shots.js - Deterministic screenshot scenes for ?shot=<name>&seed=<n>.
// Each scene arranges the world into a readable, colourful frame and then
// main.js flips window.__shotReady once that frame has been rendered.

import { raiseWanted } from "./police.js";

export function parseShotQuery(search) {
  const params = new URLSearchParams(search || "");
  const shot = params.get("shot");
  if (!shot) return null;
  const seedRaw = params.get("seed");
  const seed = seedRaw === null ? 1 : Number(seedRaw);
  return { name: shot, seed: Number.isFinite(seed) ? seed : 1 };
}

export function setupShotScene(game, shotName) {
  const { player, vehicles } = game;
  game.shotMode = true;

  if (shotName === "start") {
    game.state = "title";
    return;
  }

  game.state = "playing";

  if (shotName === "street") {
    player.x = 600;
    player.y = 620;
    player.angle = 0.4;
    player.vehicle = null;
    // A couple of nearby cars make the street read as a living city.
    if (vehicles[0]) { vehicles[0].x = 690; vehicles[0].y = 585; }
    if (vehicles[1]) { vehicles[1].x = 505; vehicles[1].y = 665; }
  } else if (shotName === "chase") {
    // Player inside a sport car, wanted 3, real police cruisers behind.
    const car = vehicles.find((v) => v.type === "sport") || vehicles[0];
    if (car) {
      car.x = 1500;
      car.y = 1000;
      car.angle = 0;
      car.speed = 230;
      car.stolen = true;
      player.vehicle = car;
      car.isPlayerVehicle = true;
      player.x = car.x;
      player.y = car.y;
    }
    raiseWanted(game.heat, 3, "grand theft auto");
    game.needsPoliceSpawn = true;
    // Position police deterministically once spawned in main.js.
    game.shotPoliceLayout = [
      { dx: -120, dy: -55, angle: 0.15 },
      { dx: -190, dy: 70, angle: -0.12 },
      { dx: -70, dy: 130, angle: 0.4 },
    ];
  } else if (shotName === "mission") {
    player.x = 560;
    player.y = 560;
    player.vehicle = null;
    game.missions.index = 0;
    game.missions.phase = "goto";
    game.missions.message = game.missions.message || "Rae: Grab any car near the Marina.";
    game.missions.messageTimer = 999;
  } else {
    // Unknown shot names fall back to a street scene so tooling still works.
    player.x = 600;
    player.y = 600;
  }

  // Camera snaps straight to the player for a deterministic first frame.
  const pos = player.vehicle || player;
  game.camera.x = Math.max(0, Math.min(game.world.width - 1280, pos.x - 640));
  game.camera.y = Math.max(0, Math.min(game.world.height - 720, pos.y - 360));
}

export function applyShotPoliceLayout(game) {
  if (!game.shotPoliceLayout) return;
  const pos = game.player.vehicle || game.player;
  game.police.forEach((unit, i) => {
    const layout = game.shotPoliceLayout[i % game.shotPoliceLayout.length];
    unit.x = pos.x + layout.dx;
    unit.y = pos.y + layout.dy;
    unit.angle = layout.angle;
    unit.speed = 210;
  });
  game.shotPoliceLayout = null;
}

export function markShotReadyWhenRendered(game, framesRendered) {
  if (!game.shotMode) return;
  if (framesRendered >= 3) {
    window.__shotReady = true;
  }
}
