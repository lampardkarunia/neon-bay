// shots.js — deterministic screenshot scenes via ?shot=<name>&seed=<n>
import { setWanted } from "./police.js";
import { createVehicle } from "./vehicles.js";

export function setupShotScene(name, state) {
  const { player, heat, world, rng } = state;
  state.shotMode = name;
  if (name === "start") {
    state.mode = "title";
    return;
  }
  state.mode = "playing";
  if (name === "street") {
    player.x = 500; player.y = 500; player.vehicle = null;
    player.health = 88; player.money = 275;
    heat.wanted = 0; heat.heat = 0;
  } else if (name === "chase") {
    const car = createVehicle("sport", 900, 900, 0.4, rng);
    car.driver = "player"; player.vehicle = car; player.x = car.x; player.y = car.y;
    state.vehicles.push(car);
    player.health = 72; player.money = 430;
    setWanted(heat, 3);
    // Force real police cars close behind the player for a readable chase frame.
    heat.cops = [];
    const spots = [[790, 830, 0.3], [760, 960, 0.5], [1010, 790, 0.2], [1040, 990, 0.6], [680, 900, 0.4], [1120, 900, 0.3]];
    for (const [x, y, a] of spots) {
      const v = createVehicle("police", x, y, a, rng, true);
      v.driver = "police"; v.speed = 220;
      heat.cops.push({ vehicle: v, ramCooldown: 0 });
    }
    heat.roadblocks = [{ x: 1180, y: 900, angle: Math.PI / 2 }];
  } else if (name === "mission") {
    player.x = 620; player.y = 620; player.vehicle = null;
    player.health = 95; player.money = 180;
    state.missions.index = 2; state.missions.stage = 0;
    state.missions.message = state.missions.list[2].brief; state.missions.messageTimer = 99;
    heat.wanted = 1; heat.heat = 1;
  }
  // Warm the simulation so traffic, peds and cops are visibly mid-action.
  state.shotWarmup = 24;
}
export function isShotMode(state) { return !!state.shotMode; }
