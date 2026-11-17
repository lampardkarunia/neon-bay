// missions.js - Rae's mission chain for Jax Marlowe in Neon Bay.
// Four linked jobs: learn the city, repo a car, run a package, escape the finale.

import { distanceBetween } from "./config.js";
import { createVehicle } from "./vehicles.js";
import { spawnHostiles } from "./combat.js";

export const MISSION_DEFS = [
  {
    id: "getaway",
    title: "First Wheels",
    giver: "Rae",
    intro: "Rae: Jax, I left a sedan by the Marina plaza. Get in and bring it to the Downtown garage.",
    objective: "Get in the marked sedan",
    reward: 250,
  },
  {
    id: "repo",
    title: "Repo Run",
    giver: "Rae",
    intro: "Rae: A sport coupe in the Barrio is three payments late. Take it, lose any heat, park it at the Portside lot.",
    objective: "Steal the marked sport coupe in the Barrio",
    reward: 600,
  },
  {
    id: "package",
    title: "Cross-Bay Package",
    giver: "Rae",
    intro: "Rae: Pick up the package at Portside and deliver it across the bay to the Marina dock. Do not wreck the ride.",
    objective: "Pick up the package at Portside",
    reward: 900,
  },
  {
    id: "finale",
    title: "Neon Finale",
    giver: "Rae",
    intro: "Rae: Last job. Grab the truck, survive the heat, and reach the Marina pier. Five stars means the whole bay is watching.",
    objective: "Get in the marked truck",
    reward: 2000,
  },
];

export function createMissionState() {
  return {
    index: 0,
    stage: 0,
    active: false,
    complete: false,
    failed: false,
    objectiveText: "Talk to Rae - start the first job from the HUD prompt",
    marker: null,       // { x, y, label }
    targetVehicle: null,
    message: "",
    messageTimer: 0,
    startedAt: 0,
  };
}

export function currentMission(state) {
  if (state.index >= MISSION_DEFS.length) return null;
  return MISSION_DEFS[state.index];
}

export function startMission(game) {
  const state = game.missions;
  const def = currentMission(state);
  if (!def || state.active) return;
  state.active = true;
  state.failed = false;
  state.stage = 0;
  state.startedAt = game.time;
  showMessage(game, def.intro, 6);
  setupMissionStage(game);
}

export function showMessage(game, text, seconds) {
  game.missions.message = text;
  game.missions.messageTimer = seconds || 4;
}

function setMarker(game, x, y, label) {
  game.missions.marker = { x, y, label };
  game.missions.objectiveText = label;
}

function placeTargetVehicle(game, type, x, y, angle) {
  const vehicle = createVehicle(type, x, y, angle);
  vehicle.owner = "mission";
  vehicle.isMissionTarget = true;
  game.vehicles.push(vehicle);
  game.missions.targetVehicle = vehicle;
  return vehicle;
}

export function setupMissionStage(game) {
  const state = game.missions;
  const def = currentMission(state);
  if (!def) { state.complete = true; state.marker = null; state.objectiveText = "All jobs done - Neon Bay is yours. Free roam!"; return; }
  if (def.id === "getaway") {
    if (state.stage === 0) {
      const car = placeTargetVehicle(game, "sedan", 640, 480, 0);
      setMarker(game, car.x, car.y, "Get in the marked sedan near Marina plaza");
    } else {
      setMarker(game, 1760, 480, "Drive to the Downtown garage");
    }
  } else if (def.id === "repo") {
    if (state.stage === 0) {
      const car = placeTargetVehicle(game, "sport", 560, 1760, Math.PI / 2);
      setMarker(game, car.x, car.y, "Steal the marked sport coupe in the Barrio");
    } else {
      setMarker(game, 1920, 1920, "Park the coupe at the Portside lot - lose the heat first");
    }
  } else if (def.id === "package") {
    if (state.stage === 0) {
      setMarker(game, 1980, 1820, "Pick up the package at Portside");
    } else {
      setMarker(game, 330, 980, "Deliver the package to the Marina dock");
    }
  } else if (def.id === "finale") {
    if (state.stage === 0) {
      const truck = placeTargetVehicle(game, "truck", 1760, 1760, -Math.PI / 2);
      setMarker(game, truck.x, truck.y, "Get in the marked truck in Portside");
    } else {
      setMarker(game, 180, 980, "Escape to the Marina pier - survive the heat!");
    }
  }
}

export function completeMission(game) {
  const state = game.missions;
  const def = currentMission(state);
  if (!def) return;
  game.player.money += def.reward;
  game.moneyEarned += def.reward;
  showMessage(game, `Job done: ${def.title}  +$${def.reward}. Rae: Knew you still had it, Jax.`, 6);
  game.audio.playCash();
  state.active = false;
  state.index += 1;
  state.stage = 0;
  state.targetVehicle = null;
  state.marker = null;
  if (state.index >= MISSION_DEFS.length) {
    state.complete = true;
    state.objectiveText = "All jobs done - Neon Bay is yours. Free roam!";
  } else {
    state.objectiveText = `Next job ready: ${MISSION_DEFS[state.index].title} - press Enter to start`;
  }
}

export function failMission(game, reason) {
  const state = game.missions;
  state.active = false;
  state.failed = true;
  state.marker = null;
  state.targetVehicle = null;
  state.objectiveText = `Job failed: ${reason} - press Enter to retry ${currentMission(state) ? currentMission(state).title : ""}`;
  showMessage(game, `Rae: That went sideways. ${reason}`, 5);
}

function reachedMarker(game, radius) {
  const marker = game.missions.marker;
  if (!marker) return false;
  const pos = game.player.vehicle || game.player;
  return distanceBetween(pos.x, pos.y, marker.x, marker.y) < radius;
}

export function updateMissions(game, dt) {
  const state = game.missions;
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  if (!state.active) {
    if (game.input.wasPressed("Enter", "enter") && !state.complete) startMission(game);
    return;
  }
  const def = currentMission(state);
  if (!def) return;
  const target = state.targetVehicle;

  if (def.id === "getaway") {
    if (state.stage === 0 && game.player.vehicle && target && game.player.vehicle === target) {
      state.stage = 1; setupMissionStage(game); showMessage(game, "Rae: Good. Now the Downtown garage - follow the gold marker.", 4);
    } else if (state.stage === 1 && reachedMarker(game, 78)) {
      completeMission(game);
    }
  } else if (def.id === "repo") {
    if (state.stage === 0 && game.player.vehicle && target && game.player.vehicle === target) {
      state.stage = 1; setupMissionStage(game);
      game.setWantedAtLeast(2);
      showMessage(game, "Rae: That alarm is loud. Lose the heat, then Portside.", 4);
    } else if (state.stage === 1 && reachedMarker(game, 82)) {
      if (game.wanted > 0) {
        state.objectiveText = "Lose the heat before parking at Portside!";
      } else {
        completeMission(game);
      }
    }
    if (target && target.destroyed) failMission(game, "The repo car was destroyed.");
  } else if (def.id === "package") {
    if (state.stage === 0 && reachedMarker(game, 70)) {
      state.stage = 1; setupMissionStage(game);
      spawnHostiles(game, game.player.x + 130, game.player.y + 60, 2);
      showMessage(game, "Rae: Company incoming - get that package to Marina!", 4);
    } else if (state.stage === 1 && reachedMarker(game, 78)) {
      completeMission(game);
    }
  } else if (def.id === "finale") {
    if (state.stage === 0 && game.player.vehicle && target && game.player.vehicle === target) {
      state.stage = 1; setupMissionStage(game);
      game.setWantedAtLeast(5);
      showMessage(game, "Rae: Whole bay is lit up. Drive, Jax. Pier. Now.", 5);
    } else if (state.stage === 1 && reachedMarker(game, 92)) {
      game.setWanted(0);
      completeMission(game);
    }
    if (target && target.destroyed && state.stage === 0) failMission(game, "The finale truck was destroyed.");
  }

  // Generic guard: dying fails the active job.
  if (game.player.dead) failMission(game, "Jax went down.");
}
