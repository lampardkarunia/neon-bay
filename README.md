[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/lampardkarunia/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/lampardkarunia/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# NEON BAY — HEAT

An original 2D top-down open-world driving and action game that runs
entirely in the browser. No libraries, no assets, no network requests —
vanilla JavaScript ES modules, a canvas renderer, synthesised WebAudio
sound, and a `localStorage` save.

Welcome to **Neon Bay**, a sunset-and-neon beach city split into four
districts: **Marina**, **Downtown**, **Barrio**, and **Portside**.
You are **Jax Marlowe**, an ex-getaway driver trying to go straight.
Your old contact **Rae** has four last jobs — and every job raises the
**HEAT**.

## The HEAT system

- Wanted level from 1 to 5 stars. Stealing cars, crashing, hitting
  pedestrians, assaults and gunfire all raise your heat.
- Police interceptors chase, ram, and — at higher heat — move to block
  the road ahead of you.
- Roadblocks appear at 3 stars and above. A police helicopter joins
  the pursuit at 5 stars and keeps eyes on you from above.
- Break line of sight to cool down: hide, ditch the hot car, or swap
  into a clean ride and your stars fall one by one.
- Get cornered on foot for too long and you are busted — Rae bails
  you out at the Marina plaza, minus a fine.

## Gameplay

- Walk and drive a full road-grid city with traffic AI and pedestrians.
- Steal any car: sedans, sport coupes, and trucks/vans, each with its
  own acceleration, top speed, turning, grip, and health.
- Cars take damage, smoke, burn, and explode.
- Punch and pistol combat; hostile crews shoot back during jobs.
- A four-mission chain from Rae: **First Wheels** (tutorial getaway),
  **Repo Run**, **Cross-Bay Package**, and the five-star
  **Neon Finale**, with world markers, a minimap, and cash rewards.
- HUD with health, wanted stars, money, mission objective text, a
  live minimap (city, player, police, objective), start screen,
  pause menu, and save/load.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a browser.

## Controls

- **WASD / arrow keys** — walk / drive
- **E** — enter / exit a car (stand next to one to steal it)
- **F** — punch
- **Space** — shoot
- **Enter** — start the next mission
- **P** — pause
- **M** — mute

## Screenshots

Deterministic screenshot scenes are defined in `shots.json` and can be
regenerated with:

```sh
node tools/shoot.mjs
```

Scenes: `start` (title screen), `street` (on foot with HUD and
minimap), `chase` (in a car at 3+ stars with real police cars in
pursuit), and `mission` (active mission objective on the HUD).

<sub>Entered on [make.fun](https://make.fun/?ref=ncwdmcz4&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
