[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/lampardkarunia/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/lampardkarunia/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Bay — HEAT

Neon Bay is a small top-down open-city driving game that runs entirely in the
browser. You play Jax Marlowe, a former getaway driver pulled back into work by
his contact Rae in a sunset-soaked coastal city of four districts: Marina,
Downtown, Barrio, and Portside. Every job pays cash, and almost every shortcut
through the city earns you attention you did not ask for.

This build leans hard into its HEAT system. Steal a car, clip another driver,
or fire a shot and your wanted level climbs from one star to five. Police
cruisers chase, ram, and try to cut you off; at three stars roadblocks appear
on the streets around you, and at five stars a helicopter joins the hunt and
keeps its searchlight on you. The only way back down is to break line of
sight, hide, swap cars, and wait — the stars drain one at a time while nobody
can see you.

Around that pressure sits a four-job story chain: a first getaway in Marina, a
repo run for a sport coupe owed to Rae, a cross-town package delivery from
Barrio back to Marina, and a final Portside getaway with the whole city
watching. Between jobs the city stays alive with traffic, pedestrians, three
classes of car with genuinely different handling (a steady sedan, a twitchy
sport coupe, and a heavy van/truck), vehicle damage that ends in smoke and
fire, and a minimap that tracks you, the police, and your next objective.

Everything is hand-rolled: vanilla JavaScript ES modules, one canvas, a
synthesised WebAudio soundtrack and sirens, no external libraries, no network
requests, and no image or audio assets. Progress saves to localStorage.

## Running it

```sh
node serve.ts
```

Then open http://localhost:8080 in a browser and press Start Game. A saved
game can be resumed with the Load Save button on the title screen.

## Controls

- WASD / arrow keys — walk and drive
- E — enter or exit a car (walk up to any car to steal it)
- F — punch
- Space — shoot
- P — pause
- M — mute

## Screenshots and verification

Deterministic screenshot scenes are available through the shot mode
(`game/index.html?shot=chase&seed=7` and friends), and the whole entry can be
smoke-tested headlessly:

```sh
node tools/shoot.mjs
node main.ts
```

<sub>Entered on [make.fun](https://make.fun/?ref=ncwdmcz4&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
