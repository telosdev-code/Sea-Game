# Abyssal Drift

A slow, peaceful 2D underwater exploration game. Pilot a small submarine
through a long stretch of night-time ocean — no combat, no fail state, just
dark water, bioluminescence, and wildlife to discover.

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

| Key       | Action          |
| --------- | --------------- |
| `W` / `↑` | Thrust up       |
| `A` / `←` | Thrust left     |
| `S` / `↓` | Thrust down     |
| `D` / `→` | Thrust right    |

The sub has momentum and drag — ease into turns and let it glide.

## Project layout

```
index.html            entry point
vendor/phaser.min.js  Phaser 3.90 (vendored)
src/main.js           game config / boot
src/pixels.js         procedural pixel-art texture helpers + the submarine
src/world.js          water gradient, parallax layers, seafloor, atmosphere
src/creatures.js      fish schools, jellyfish, sea turtles
src/scene.js          the ocean scene tying it all together
```

## What's down there

- Schools of fish (three colorways) drifting and turning together
- Jellyfish that pulse upward, then sink and drift
- Two sea turtles slowly crossing the trench
- Bioluminescent plants, swaying kelp, plankton drifting in the beam

