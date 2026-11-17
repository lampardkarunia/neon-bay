[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/lampardkarunia/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/lampardkarunia/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# NEON BAY — HEAT

An original 2D top-down getaway game in vanilla JavaScript and HTML5 canvas.
No external libraries, no network requests, no asset files — even the music
and sound effects are synthesised live with WebAudio. Progress saves to
localStorage.

Welcome to **Neon Bay**, a sunset coastal city of neon streets split into four
districts: **Marina**, **Downtown**, **Barrio** and **Portside**. You are
**Jax Marlowe**, an ex-getaway driver pulled back in by your contact **Rae**
for one chain of jobs: a first getaway, a repo job, a cross-town package run,
and a finale chase to the escape boat.

## The HEAT system

This is the HEAT variant, built around its wanted system:

- Crimes raise your wanted level from 1 to 5 stars: stealing cars, hitting
  pedestrians or traffic, punching and shooting.
- Police pursue with real pursuit AI — chasing, ramming and trying to block
  your path. Their cars are proper police cars, on the road and on the minimap.
- Roadblocks appear at 3 stars and above. A police helicopter joins at 5 stars.
- Wanted level decays slowly when you break line of sight. Hiding — or
  swapping into a different car — helps you lose the heat.

## Features

- On-foot and driving gameplay; any parked or traffic car can be stolen.
- Three civilian vehicle types with distinct handling — sedan, sport and
  truck/van — plus police interceptors. Vehicles take damage, smoke and explode.
- Traffic AI and wandering pedestrians who flee from danger.
- Punch and pistol combat, player health, busted/wasted flow.
- A four-mission story chain with HUD objectives, world markers and a minimap.
- HUD with health bar, wanted stars, cash and mission text; a live minimap
  canvas showing the city, player, police and the current objective.
- Smooth follow camera, start screen with load-save, pause menu and save button.
- Deterministic screenshot mode via `?shot=<name>&seed=<n>` for testing.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a browser.

You can also open `game/index.html` through any static file server.

## Controls

- **WASD / arrow keys** — walk or drive
- **E** — enter / exit a car (stand next to one to steal it)
- **F** — punch
- **Space** — shoot pistol
- **P** — pause / resume
- **M** — mute / unmute

## Screenshots

Run the deterministic smoke test and screenshot capture (Node built-ins plus
a local headless Chrome):

```sh
node tools/shoot.mjs
```

<sub>Entered on [make.fun](https://make.fun/?ref=ncwdmcz4&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
