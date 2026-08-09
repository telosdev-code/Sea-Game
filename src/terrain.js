'use strict';

/*
 * Terrain: a tile grid over the whole world, generated from layered value
 * noise whose density grows with depth. Open water above 100 m, scattered
 * outcrops below that, then pillars, canyon walls and caves, bottoming out
 * on bedrock at 1000 m. Wandering "worm" carvers guarantee that trenches
 * and cave systems stay connected and navigable.
 */

window.Sea = window.Sea || {};

Sea.TILE = 16;

/* How much of the water column is rock at a given depth (meters). */
Sea.rockDensity = function (m) {
  if (m < 100) return 0;
  const lerp = Phaser.Math.Linear;
  if (m < 250) return lerp(0.03, 0.14, (m - 100) / 150);
  if (m < 450) return lerp(0.14, 0.26, (m - 250) / 200);
  if (m < 700) return lerp(0.26, 0.38, (m - 450) / 250);
  if (m < 950) return lerp(0.38, 0.52, (m - 700) / 250);
  return lerp(0.52, 1.0, (m - 950) / 50);
};

Sea.generateTerrain = function (scene) {
  const T = Sea.TILE;
  const cols = Sea.WORLD.width / T;
  const rows = Sea.WORLD.height / T;
  const grid = new Uint8Array(cols * rows);
  const rand = Sea.rng(0xca7e5);
  const at = (c, r) => grid[r * cols + c];
  const set = (c, r, v) => {
    grid[r * cols + c] = v;
  };
  const depthOfRow = (r) => Sea.depthAt(r * T + T / 2);
  const rowOfDepth = (m) => Math.floor((Sea.SURFACE_Y + m * Sea.PX_PER_M) / T);

  // --- layered value noise -----------------------------------------
  const lattice = (step) => {
    const lc = Math.ceil(cols / step) + 2;
    const lr = Math.ceil(rows / step) + 2;
    const vals = new Float32Array(lc * lr);
    for (let i = 0; i < vals.length; i++) vals[i] = rand();
    return (c, r) => {
      const x = c / step;
      const y = r / step;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const v = (cc, rr) => vals[rr * lc + cc];
      return (
        v(x0, y0) * (1 - sx) * (1 - sy) +
        v(x0 + 1, y0) * sx * (1 - sy) +
        v(x0, y0 + 1) * (1 - sx) * sy +
        v(x0 + 1, y0 + 1) * sx * sy
      );
    };
  };
  const n1 = lattice(9);
  const n2 = lattice(4);
  const n3 = lattice(2);
  const noise = (c, r) => n1(c, r) * 0.58 + n2(c, r) * 0.28 + n3(c, r) * 0.14;

  // The octave sum clusters around 0.5, so remap the target rock fraction
  // through a gentle S-curve to land near the right coverage.
  const threshold = (f) => 0.5 + (f - 0.5) * 0.62;

  const bedrockRow = rowOfDepth(992);
  for (let r = 0; r < rows; r++) {
    const m = depthOfRow(r);
    const density = Sea.rockDensity(m);
    for (let c = 0; c < cols; c++) {
      if (r >= bedrockRow) set(c, r, 1);
      else if (density > 0 && noise(c, r) < threshold(density)) set(c, r, 1);
    }
  }

  // --- carve guaranteed passages -----------------------------------
  const carve = (cc, cr, rad) => {
    for (let r = cr - rad; r <= cr + rad; r++) {
      for (let c = cc - rad; c <= cc + rad; c++) {
        if (c < 1 || c >= cols - 1 || r < 1 || r >= rows - 2) continue;
        if ((c - cc) * (c - cc) + (r - cr) * (r - cr) > rad * rad + 1) continue;
        set(c, r, 0);
      }
    }
  };

  // Vertical worms: winding shafts from the featureless zone down to the
  // bottom, becoming the trenches of the deep.
  const topRow = rowOfDepth(100);
  const floorRow = rowOfDepth(985);
  for (let w = 0; w < 13; w++) {
    let c = Math.floor(20 + rand() * (cols - 40));
    let r = topRow;
    while (r < floorRow) {
      carve(c, r, rand() < 0.2 ? 3 : 2);
      r += 1;
      c += Math.round((rand() - 0.5) * 2.6);
      c = Phaser.Math.Clamp(c, 4, cols - 5);
      // occasional sideways gallery
      if (rand() < 0.05) {
        const dir = rand() < 0.5 ? -1 : 1;
        const len = 4 + Math.floor(rand() * 10);
        for (let i = 0; i < len; i++) {
          carve(c, r, 2);
          c = Phaser.Math.Clamp(c + dir, 4, cols - 5);
        }
      }
    }
  }

  // Horizontal worms: connecting galleries at various depths.
  for (let w = 0; w < 11; w++) {
    const startM = 220 + rand() * 720;
    let r = rowOfDepth(startM);
    let c = Math.floor(rand() * cols);
    const dir = rand() < 0.5 ? -1 : 1;
    const len = 45 + Math.floor(rand() * 110);
    for (let i = 0; i < len; i++) {
      carve(c, r, rand() < 0.15 ? 3 : 2);
      c += dir;
      if (c < 4 || c > cols - 5) break;
      r += Math.round((rand() - 0.5) * 1.6);
      r = Phaser.Math.Clamp(r, topRow, floorRow);
    }
  }

  // --- cleanup: drop lonely specks, fill pinholes -------------------
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const n = at(c, r - 1) + at(c, r + 1) + at(c - 1, r) + at(c + 1, r);
      if (at(c, r) === 1 && n === 0) set(c, r, 0);
      else if (at(c, r) === 0 && n === 4 && r < bedrockRow) set(c, r, 1);
    }
  }

  // --- surface / ceiling anchor lists for decoration ----------------
  const surfaces = [];
  const ceilings = [];
  for (let r = topRow; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (at(c, r) !== 1) continue;
      if (r > 0 && at(c, r - 1) === 0) {
        surfaces.push({ x: c * T + T / 2, y: r * T, m: depthOfRow(r) });
      }
      if (at(c, r + 1) === 0) {
        ceilings.push({ x: c * T + T / 2, y: r * T + T, m: depthOfRow(r) });
      }
    }
  }

  Sea.terrain = { grid, cols, rows, surfaces, ceilings };

  Sea.makeTileset(scene, rand);
  Sea.buildTilemap(scene);
  Sea.makeMinimapTexture(scene);
};

/*
 * The surface/ceiling anchor lists exist only to place decoration and
 * salvage at build time; a few thousand objects that would otherwise stay
 * pinned for the whole session.
 */
Sea.releaseTerrainScratch = function () {
  if (!Sea.terrain) return;
  Sea.terrain.surfaces = null;
  Sea.terrain.ceilings = null;
};

/* Solid-rock query in world coordinates (used by creatures and spawns). */
Sea.isSolid = function (wx, wy) {
  const t = Sea.terrain;
  if (!t) return false;
  const c = Math.floor(wx / Sea.TILE);
  const r = Math.floor(wy / Sea.TILE);
  if (c < 0 || c >= t.cols || r < 0) return true;
  if (r >= t.rows) return true;
  return t.grid[r * t.cols + c] === 1;
};

/* Is a circle of open water centered here? */
Sea.isOpenArea = function (wx, wy, radius) {
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    if (Sea.isSolid(wx + Math.cos(ang) * radius, wy + Math.sin(ang) * radius)) {
      return false;
    }
  }
  return !Sea.isSolid(wx, wy);
};

/* Rejection-sample an open spot within a depth band (meters). */
Sea.openSpot = function (rand, minM, maxM, clearance) {
  for (let i = 0; i < 60; i++) {
    const x = 200 + rand() * (Sea.WORLD.width - 400);
    const m = minM + rand() * (maxM - minM);
    const y = Sea.SURFACE_Y + m * Sea.PX_PER_M;
    if (Sea.isOpenArea(x, y, clearance)) return { x, y };
  }
  return null;
};

/*
 * Tileset: marching-square rims. Tile index = 4-bit mask of OPEN
 * neighbours (1 up, 2 right, 4 down, 8 left); 16/17 are interior fills.
 */
Sea.makeTileset = function (scene, rand) {
  const T = Sea.TILE;
  const count = 18;
  const tex = scene.textures.createCanvas('tiles', T * count, T);
  const ctx = tex.getContext();
  for (let i = 0; i < count; i++) {
    const ox = i * T;
    ctx.fillStyle = '#131e33';
    ctx.fillRect(ox, 0, T, T);
    // speckle
    for (let s = 0; s < 7; s++) {
      ctx.fillStyle = ['#0e1728', '#182642', '#1b2a48'][Math.floor(rand() * 3)];
      ctx.fillRect(ox + Math.floor(rand() * T), Math.floor(rand() * T), 2, 1);
    }
    if (i < 16) {
      // rims on open edges: pale top light, dimmer elsewhere
      if (i & 1) {
        ctx.fillStyle = '#33496f';
        ctx.fillRect(ox, 0, T, 2);
        ctx.fillStyle = '#22345480';
        ctx.fillRect(ox, 2, T, 1);
      }
      if (i & 4) {
        ctx.fillStyle = '#0a1220';
        ctx.fillRect(ox, T - 2, T, 2);
      }
      if (i & 2) {
        ctx.fillStyle = '#243a5c';
        ctx.fillRect(ox + T - 2, 0, 2, T);
      }
      if (i & 8) {
        ctx.fillStyle = '#243a5c';
        ctx.fillRect(ox, 0, 2, T);
      }
    } else if (i === 17) {
      // darker interior patch variant
      ctx.fillStyle = '#0f1830';
      ctx.fillRect(ox + 3, 4, 9, 7);
    }
  }
  tex.refresh();
};

Sea.buildTilemap = function (scene) {
  const { grid, cols, rows } = Sea.terrain;
  const at = (c, r) =>
    c < 0 || c >= cols || r < 0 || r >= rows ? 1 : grid[r * cols + c];

  const data = [];
  for (let r = 0; r < rows; r++) {
    const row = new Array(cols);
    for (let c = 0; c < cols; c++) {
      if (at(c, r) !== 1) {
        row[c] = -1;
        continue;
      }
      let mask = 0;
      if (at(c, r - 1) === 0) mask |= 1;
      if (at(c + 1, r) === 0) mask |= 2;
      if (at(c, r + 1) === 0) mask |= 4;
      if (at(c - 1, r) === 0) mask |= 8;
      row[c] = mask === 0 ? 16 + ((c * 31 + r * 17) % 2) : mask;
    }
    data.push(row);
  }

  const map = scene.make.tilemap({
    data,
    tileWidth: Sea.TILE,
    tileHeight: Sea.TILE,
  });
  const tiles = map.addTilesetImage('tiles', 'tiles', Sea.TILE, Sea.TILE, 0, 0);
  const layer = map.createLayer(0, tiles, 0, 0).setDepth(Sea.DEPTH.floor);
  map.setCollisionBetween(0, 17);

  // Fade the rock slightly with depth so the deep reads heavier.
  layer.forEachTile((tile) => {
    if (tile.index < 0) return;
    const f = Phaser.Math.Clamp(Sea.depthAt(tile.pixelY) / 1000, 0, 1);
    const shade = Math.round(255 - f * 90);
    tile.tint = Phaser.Display.Color.GetColor(
      Math.round(shade * 0.82),
      Math.round(shade * 0.88),
      shade
    );
  });

  Sea.terrain.layer = layer;
  Sea.terrain.map = map;
};

/* One pixel per tile: the chart the minimap displays. */
Sea.makeMinimapTexture = function (scene) {
  const { grid, cols, rows } = Sea.terrain;
  const tex = scene.textures.createCanvas('minimapTex', cols, rows);
  const ctx = tex.getContext();
  const surfaceRow = Math.floor(Sea.SURFACE_Y / Sea.TILE);
  for (let r = 0; r < rows; r++) {
    const f = Phaser.Math.Clamp(Sea.depthAt(r * Sea.TILE) / 1000, 0, 1);
    for (let c = 0; c < cols; c++) {
      if (r < surfaceRow) ctx.fillStyle = '#0a1020';
      else if (grid[r * cols + c] === 1) ctx.fillStyle = '#31456a';
      else {
        const b = Math.round(26 - f * 16);
        ctx.fillStyle = `rgb(${Math.round(b * 0.5)},${Math.round(b * 0.75)},${b + 6})`;
      }
      ctx.fillRect(c, r, 1, 1);
    }
  }
  ctx.fillStyle = '#3f5c80';
  ctx.fillRect(0, surfaceRow, cols, 1);
  tex.refresh();
};
