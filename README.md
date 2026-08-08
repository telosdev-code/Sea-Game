# Abyssal Drift

A slow, peaceful 2D underwater exploration game. Pilot a small submarine
from a floating surface station down into a night-time ocean trench —
no combat, no fail state, just dark water, bioluminescence, wildlife,
and a kilometer of caves and canyons to chart.

Built with HTML5 Canvas + [Phaser 3](https://phaser.io/) (vendored locally,
no build step, no network needed). All pixel art is drawn procedurally in
code — there are no image files.

## Run it

Open `index.html` in a browser. That's it.

If your browser is strict about `file://` pages, serve the folder instead:

```sh
npx serve .        # or: python3 -m http.server
```

## Controls

| Key       | Action                                  |
| --------- | --------------------------------------- |
| `W` / `↑` | Thrust up                               |
| `A` / `←` | Thrust left                             |
| `S` / `↓` | Thrust down                             |
| `D` / `→` | Thrust right                            |
| `E`       | Dock with the station (when close)      |
| `P`       | Pause / unpause                         |
| `Esc`     | Undock / unpause                        |

The sub has momentum and drag — ease into turns and let it glide.

## The dive

You start beside the floating research station. The water is open for the
first 100 m; below that, rock formations thicken with depth — outcrops,
then pillars and galleries, then trench canyons and caves — bottoming out
on bedrock at 1000 m.

Your hull starts rated to 150 m: at the limit, buoyancy gently wins and
the depth gauge flashes. Dock at the station (`E` near the moon pool, an
amber arrow on the HUD always points the way home) to install upgrades —
free while the boat is in sea trials, click to fit:

- **Hull** — depth rating: 150 → 300 → 600 → 1000 m
- **Lights** — standard lamp → wide beam → long-throw beam → floodlights
- **Sonar** — passive array (wildlife blips on the minimap) → broadband
  (longer range) → active ping (a visible pulse that sweeps the terrain)
- **Minimap** — local chart → regional chart → full survey of the trench

Equipment persists in `localStorage`; there's a "reset save" link in the
station menu.

## Project layout

```
index.html            entry point
vendor/phaser.min.js  Phaser 3.90 (vendored)
src/main.js           game config / boot
src/pixels.js         world constants + pixel-art helpers + the submarine
src/terrain.js        noise-carved rock, caves & trenches, collision, chart
src/world.js          water gradient, parallax layers, flora, atmosphere
src/station.js        night sky, waterline, the floating surface station
src/creatures.js      fish schools, jellyfish, sea turtles
src/ui.js             equipment/save, depth gauge, minimap, menus (HUD scene)
src/scene.js          the ocean scene tying it all together
```

## What's down there

- Schools of fish (three colorways) drifting and turning together
- Jellyfish that pulse upward, then sink and drift
- Two sea turtles slowly crossing the trench
- Bioluminescent plants, swaying kelp, plankton drifting in the beam

