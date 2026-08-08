'use strict';

/*
 * Procedural pixel-art helpers. Every sprite in the game is drawn in code
 * from small text grids — no external image files.
 */

window.Sea = window.Sea || {};

/*
 * World geometry. The water column below SURFACE_Y maps to 0–1000 m of
 * depth at PX_PER_M pixels per meter; the last rows are bedrock.
 */
Sea.WORLD = { width: 7200, height: 2960 };
Sea.SURFACE_Y = 100;
Sea.PX_PER_M = 2.8; // 1000 m of water ends at y = 100 + 2800
Sea.MAX_DEPTH_M = 1000;

Sea.depthAt = (y) => Math.max(0, (y - Sea.SURFACE_Y) / Sea.PX_PER_M);

// Deterministic RNG (mulberry32) so the world lays out the same every visit.
Sea.rng = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/*
 * Draw one or more pixel maps (arrays of strings, one char per pixel) into a
 * single canvas texture, one animation frame per map, laid out side by side.
 * Characters index into `palette`; anything not in the palette is transparent.
 */
Sea.pixelTexture = function (scene, key, frames, palette) {
  let w = 0;
  for (const rows of frames) {
    for (const row of rows) w = Math.max(w, row.length);
  }
  const h = frames[0].length;
  const tex = scene.textures.createCanvas(key, w * frames.length, h);
  const ctx = tex.getContext();
  frames.forEach((rows, f) => {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = palette[row[x]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(f * w + x, y, 1, 1);
      }
    });
  });
  tex.refresh();
  frames.forEach((_, f) => tex.add(f, 0, f * w, 0, w, h));
  return tex;
};

/* ------------------------------------------------------------------ */
/* Submarine                                                          */
/* ------------------------------------------------------------------ */

Sea.makeSubTextures = function (scene) {
  const pal = {
    O: '#0d1120', // outline
    H: '#e0a83c', // hull
    L: '#f8d878', // hull highlight
    S: '#9c6b28', // hull shade
    T: '#c8902e', // conning tower
    t: '#8a5c1c', // tower shade
    W: '#bff5ff', // window glow
    w: '#173a52', // window rim
    N: '#fff6c8', // nose lamp
    P: '#9fb4c8', // propeller blade
    p: '#54627a', // propeller hub
    F: '#7a5a20', // fins
  };

  // Facing right: propeller at the stern (left), lamp at the bow (right).
  const hull = (prop) => [
    '..............OO............',
    '..............OL............',
    '...........OOOOOOOO.........',
    '...........OTTTTTtO.........',
    '..OF....OOOOTTTTTtOOOOO.....',
    '..OFOOOOHHLLLLHHHHHHHHOOO...',
    '..OFHHLLLHHHHHHHHHHHHHHHOO..',
    prop[0] + 'OHHwWWwHHwWWwHHwWWwHHHON.',
    prop[1] + 'OHHwWWwHHwWWwHHwWWwHHHON.',
    prop[2] + 'OHHHHHHHHHHHHHHHHHHHHHOO.',
    '..OFHSSSHHHHHHHHHHHHHHOO....',
    '..OFOOSSSSSSSSSSSSSSOOO.....',
    '..OF..OOOSSSSSSSSOOO........',
    '.......OOOOOOOOOO...........',
  ];
  const frameA = hull(['.P.', 'PpP', '.P.']);
  const frameB = hull(['P.P', '.p.', 'P.P']);
  Sea.pixelTexture(scene, 'sub', [frameA, frameB], pal);
};
