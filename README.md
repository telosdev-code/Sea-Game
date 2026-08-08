# Abyssal Drift

A slow, peaceful 2D underwater exploration game. Pilot a small submarine
from a floating surface station down into a night-time ocean trench —
no combat, no fail state, just dark water, bioluminescence, wildlife,
and a kilometer of caves and canyons to chart.

Built with HTML5 Canvas + [Phaser 3](https://phaser.io/) (vendored locally,
no build step, no network needed). All pixel art is drawn procedurally in
code — there are no image files.

The canvas is 960×540. The sea camera runs at 2× zoom so the world still
shows a 480×270 window of 16-bit-era pixel art, while the HUD scene draws
unzoomed and gets the full resolution for crisp text.

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
| `F`       | Photograph wildlife in view             |
| `E`       | Dock with the station (when close)      |
| `P`       | Pause / unpause                         |
| `M`       | Mute / unmute the ambience              |
| `Esc`     | Undock / unpause                        |

The sub has momentum and drag — ease into turns and let it glide. A
procedural lofi ambience (gliding seventh-chord pad, deep-water wash,
vinyl crackle, sparse plinks) starts on your first key press and darkens
as you dive — all synthesized in WebAudio, no audio files.

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

- **Salvage** — winch (recover salvage) → mag-grapple (longer reach)

Equipment, money, photos and recovered salvage persist in `localStorage`;
there's a "reset save" link in the station menu.

## Earning money

The running total lives in the top-right of the HUD (the minimap sits
bottom-left). Two trades:

**Wildlife photography** (`F`) — snaps anything in view within ~270px.
Each animal pays once; rarer subjects pay more:

| Subject            | Fee    |
| ------------------ | ------ |
| Reef school        | $15    |
| Garibaldi school   | $25    |
| Moonfish school    | $40    |
| Jellyfish          | $30    |
| Sea turtle         | $80    |
| ???                | $1,200 |

Something huge and golden patrols the bedrock trenches below 900 m. You'll
need the full hull rating to reach it.

**Salvage** — lost cargo winks in the dark on ledges all the way down:
cargo crates ($25) in the shallows, amphorae ($60) mid-water, sea chests
($150) in the caves, gold ingots ($300) by the bedrock. You'll need the
salvage winch fitted at the station to recover any of it.

## Project layout

```
index.html            entry point
vendor/phaser.min.js  Phaser 3.90 (vendored)
src/main.js           game config / boot
src/pixels.js         world constants + pixel-art helpers + the submarine
src/terrain.js        noise-carved rock, caves & trenches, collision, chart
src/world.js          water gradient, parallax layers, flora, atmosphere
src/station.js        night sky, waterline, the floating surface station
src/creatures.js      fish schools, jellyfish, sea turtles, the megalodon
src/salvage.js        recoverable cargo scattered over the terrain
src/audio.js          procedural lofi ambience + SFX (pure WebAudio)
src/ui.js             equipment/save, money, depth gauge, minimap, menus
src/scene.js          the ocean scene tying it all together
```

## What's down there

- Schools of fish (three colorways) drifting and turning together
- Jellyfish that pulse upward, then sink and drift
- Two sea turtles slowly crossing the trench
- Bioluminescent plants, swaying kelp, plankton drifting in the beam

