'use strict';

/*
 * World building: background water gradient, parallax silhouette layers,
 * the seafloor with its rocks / kelp / bioluminescent plants, and the
 * submarine's light textures. Everything is drawn to canvas textures at
 * boot — no image files.
 */

window.Sea = window.Sea || {};

/* Visible world area for a (possibly zoomed) camera, in world units. */
Sea.viewSize = (cam) => ({ w: cam.width / cam.zoom, h: cam.height / cam.zoom });

Sea.DEPTH = {
  water: 0,
  far: 1,
  mid: 2,
  floor: 3, // terrain tiles
  flora: 4,
  creature: 6,
  darkness: 6.8, // depth-darkening overlay; glows and the sub sit above it
  glow: 7.5, // additive glows for plants/creatures
  light: 8, // sub headlight cone
  sub: 9,
  fore: 12,
  vignette: 14,
};

/* ------------------------------------------------------------------ */
/* Textures                                                           */
/* ------------------------------------------------------------------ */

Sea.makeWorldTextures = function (scene) {
  const rand = Sea.rng(0x5ea11fe);

  // Vertical water gradient: faint moonlit blue up top, near-black at
  // 1000 m. Taller than the view; slides with camera depth.
  {
    const tex = scene.textures.createCanvas('bgWater', 32, 600);
    const ctx = tex.getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, 600);
    grad.addColorStop(0.0, '#14284a');
    grad.addColorStop(0.14, '#0b1a30');
    grad.addColorStop(0.45, '#060d1c');
    grad.addColorStop(1.0, '#020409');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 600);
    tex.refresh();
  }

  // Far layer: two ranks of silhouetted rock formations. Frequencies are
  // integer multiples of the tile width so the ridge wraps seamlessly.
  {
    const tex = scene.textures.createCanvas('bgFar', 1024, 256);
    const ctx = tex.getContext();
    const ridge = (baseY, amps, ks, phases, color) => {
      ctx.fillStyle = color;
      for (let x = 0; x < 1024; x += 4) {
        let y = baseY;
        for (let i = 0; i < ks.length; i++) {
          y += amps[i] * Math.sin((Math.PI * 2 * ks[i] * x) / 1024 + phases[i]);
        }
        y = Math.round(y / 2) * 2;
        ctx.fillRect(x, y, 4, 256 - y);
      }
    };
    ridge(120, [34, 20, 9], [2, 5, 11], [rand() * 6, rand() * 6, rand() * 6], '#070f20');
    ridge(160, [40, 24, 11], [3, 7, 13], [rand() * 6, rand() * 6, rand() * 6], '#0b1730');
    tex.refresh();
  }

  // Mid layer: seafloor hummocks with kelp stalks and coral fans.
  {
    const tex = scene.textures.createCanvas('bgMid', 1024, 256);
    const ctx = tex.getContext();
    const base = '#122444';
    ctx.fillStyle = base;
    for (let x = 0; x < 1024; x += 4) {
      let y =
        204 +
        16 * Math.sin((Math.PI * 2 * 4 * x) / 1024 + 1.7) +
        8 * Math.sin((Math.PI * 2 * 9 * x) / 1024 + 4.2);
      y = Math.round(y / 2) * 2;
      ctx.fillRect(x, y, 4, 256 - y);
    }
    // kelp silhouettes
    for (let i = 0; i < 20; i++) {
      const kx = Math.floor(rand() * 1024);
      const height = 50 + rand() * 110;
      const sway = 3 + rand() * 5;
      const phase = rand() * 6;
      ctx.fillStyle = rand() < 0.5 ? '#132a4c' : '#0f2240';
      for (let y = 0; y < height; y += 2) {
        const wob = Math.sin(y * 0.05 + phase) * sway * (y / height);
        ctx.fillRect(Math.round(kx + wob), 226 - y, 2, 2);
        if (y % 8 === 0 && y > 8) {
          ctx.fillRect(Math.round(kx + wob) + (y % 16 === 0 ? -3 : 2), 226 - y, 3, 2);
        }
      }
    }
    // coral fans
    for (let i = 0; i < 8; i++) {
      const cx = Math.floor(rand() * 1024);
      const cy = 214 + rand() * 20;
      const r = 10 + rand() * 14;
      ctx.fillStyle = '#142c50';
      for (let a = -1.25; a <= -0.25; a += 0.16) {
        const ang = a * Math.PI;
        for (let d = 3; d < r; d += 2) {
          ctx.fillRect(
            Math.round(cx + Math.cos(ang) * d),
            Math.round(cy + Math.sin(ang) * d),
            2,
            2
          );
        }
      }
    }
    tex.refresh();
  }

  // Rock variants: blobby shaded lumps.
  for (let v = 0; v < 3; v++) {
    const w = 16 + v * 8;
    const h = 10 + v * 4;
    Sea.genRock(scene, 'rock' + v, w, h, rand);
  }

  // Kelp strand variants (world-scale, animated by tween sway).
  for (let v = 0; v < 2; v++) {
    Sea.genKelp(scene, 'kelp' + v, 14, 44 + v * 14, rand);
  }

  // Bioluminescent plant tufts, one texture per hue.
  const glowHues = ['#7dffd8', '#c08cff', '#6ab8ff'];
  glowHues.forEach((hue, i) => Sea.genGlowPlant(scene, 'glowplant' + i, hue, rand));

  // Soft radial orb used (tinted, additive) for every glow in the game.
  {
    const size = 64;
    const tex = scene.textures.createCanvas('orb', size, size);
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.28)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  // Plankton mote and bubble for the particle systems (the mote doubles
  // as a generic bright dot for glints).
  {
    const tex = scene.textures.createCanvas('mote', 2, 2);
    const ctx = tex.getContext();
    ctx.fillStyle = '#cfe8ff';
    ctx.fillRect(0, 0, 2, 2);
    tex.refresh();
  }
  {
    const tex = scene.textures.createCanvas('blipDot', 3, 3);
    const ctx = tex.getContext();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 1, 3, 1);
    ctx.fillRect(1, 0, 1, 3);
    tex.refresh();
  }
  {
    const tex = scene.textures.createCanvas('bubble', 4, 4);
    const ctx = tex.getContext();
    ctx.fillStyle = '#9fd0e8';
    ctx.fillRect(1, 0, 2, 1);
    ctx.fillRect(1, 3, 2, 1);
    ctx.fillRect(0, 1, 1, 2);
    ctx.fillRect(3, 1, 1, 2);
    ctx.fillStyle = '#e8f6ff';
    ctx.fillRect(1, 1, 1, 1);
    tex.refresh();
  }

  // Foreground drift: sparse dark debris that slides past faster than the
  // world, hinting at water between the camera and the sub.
  {
    const tex = scene.textures.createCanvas('fgDebris', 1024, 256);
    const ctx = tex.getContext();
    for (let i = 0; i < 46; i++) {
      const s = 2 + Math.floor(rand() * 4);
      ctx.fillStyle = rand() < 0.7 ? 'rgba(2,6,16,0.6)' : 'rgba(10,20,40,0.5)';
      ctx.fillRect(
        Math.floor(rand() * 1024),
        Math.floor(rand() * 256),
        s,
        Math.max(1, s - 1 - Math.floor(rand() * 2))
      );
    }
    tex.refresh();
  }

  // Sonar ping ring.
  {
    const s = 96;
    const tex = scene.textures.createCanvas('ring', s, s);
    const ctx = tex.getContext();
    ctx.strokeStyle = 'rgba(159,216,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(159,216,255,0.25)';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2);
    ctx.stroke();
    tex.refresh();
  }

  // Screen-edge vignette.
  {
    const w = 480;
    const h = 270;
    const tex = scene.textures.createCanvas('vignette', w, h);
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, 300);
    grad.addColorStop(0, 'rgba(1,3,8,0)');
    grad.addColorStop(0.55, 'rgba(1,3,8,0.22)');
    grad.addColorStop(1, 'rgba(1,3,8,0.66)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    tex.refresh();
  }

  // Headlight cone: a wedge of light fading with distance.
  {
    const w = 170;
    const h = 120;
    const tex = scene.textures.createCanvas('cone', w, h);
    const ctx = tex.getContext();
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, 4);
    ctx.lineTo(w, h - 4);
    ctx.closePath();
    ctx.clip();
    const grad = ctx.createRadialGradient(0, h / 2, 4, 0, h / 2, w);
    grad.addColorStop(0, 'rgba(190,225,255,0.34)');
    grad.addColorStop(0.45, 'rgba(150,200,255,0.14)');
    grad.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    tex.refresh();
  }
};

Sea.genRock = function (scene, key, w, h, rand) {
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  const cx = w / 2;
  const cy = h * 0.62;
  const jag = [];
  for (let i = 0; i < 12; i++) jag.push(0.78 + rand() * 0.3);
  const radiusAt = (ang) => {
    const t = ((ang + Math.PI) / (Math.PI * 2)) * 12;
    const i = Math.floor(t) % 12;
    const f = t - Math.floor(t);
    return jag[i] * (1 - f) + jag[(i + 1) % 12] * f;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / (w * 0.5);
      const dy = (y - cy) / (h * 0.52);
      const d = Math.sqrt(dx * dx + dy * dy);
      const r = radiusAt(Math.atan2(dy, dx));
      if (d > r) continue;
      let c = '#16223a';
      if (d > r - 0.16) c = '#0a1222';
      else if (y < h * 0.4 && dx < 0.25) c = '#22345a';
      else if (y > h * 0.75) c = '#0e1830';
      if (rand() < 0.06) c = '#1c2c4c';
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  tex.refresh();
};

Sea.genKelp = function (scene, key, w, h, rand) {
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  const phase = rand() * 6;
  for (let y = 0; y < h; y += 2) {
    const t = y / h; // 0 = tip, 1 = root
    const wob = Math.sin(y * 0.09 + phase) * (1 - t) * 3.4;
    const x = Math.round(w / 2 + wob);
    ctx.fillStyle = t > 0.6 ? '#0e2a38' : '#15455a';
    ctx.fillRect(x, y, 2, 2);
    // leaves alternate sides, denser near the top
    if (y % 6 === 0 && y > 4 && y < h - 8) {
      ctx.fillStyle = '#1a5468';
      const side = (y / 6) % 2 === 0 ? -3 : 2;
      ctx.fillRect(x + side, y, 3, 2);
      if (rand() < 0.5) ctx.fillRect(x + (side < 0 ? -4 : 4), y - 1, 2, 2);
    }
  }
  ctx.fillStyle = '#1a6a7a';
  ctx.fillRect(Math.round(w / 2), 0, 2, 2); // bright growing tip
  tex.refresh();
};

Sea.genGlowPlant = function (scene, key, hue, rand) {
  const w = 12;
  const h = 12;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  const stems = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < stems; i++) {
    const x = 2 + Math.floor(rand() * (w - 4));
    const height = 4 + Math.floor(rand() * 6);
    ctx.fillStyle = '#123244';
    ctx.fillRect(x, h - height, 1, height);
    ctx.fillStyle = hue;
    ctx.fillRect(x - 1, h - height - 1, 2, 2); // bulb
  }
  tex.refresh();
};

/* ------------------------------------------------------------------ */
/* Scene assembly                                                     */
/* ------------------------------------------------------------------ */

Sea.buildWorld = function (scene) {
  const W = Sea.WORLD;
  const cam = scene.cameras.main;
  // The camera is zoomed, so the visible world area is smaller than the
  // canvas. Backdrop layers live in world space and are re-anchored to
  // the camera's worldView each frame — that behaves predictably under
  // zoom, where a zero scroll factor would not.
  const view = Sea.viewSize(cam);
  const maxScrollY = W.height - view.h;
  const rand = Sea.rng(0xb10b);

  // Water gradient rides the camera; drifts a little with depth.
  const water = scene.add
    .image(0, 0, 'bgWater')
    .setOrigin(0, 0)
    .setDepth(Sea.DEPTH.water);
  water.setDisplaySize(view.w, 600);
  scene.parallax = [];
  scene.parallax.push({
    obj: water,
    update() {
      const wv = cam.worldView;
      water.x = wv.x;
      water.y = wv.y - (600 - view.h) * (wv.y / maxScrollY);
    },
  });

  // Silhouette layers: horizontal scroll via tilePosition, vertical via
  // sliding the sprite so distant ground sinks away near the surface.
  const addSilhouette = (key, depth, fx, baseY, fy) => {
    const layer = scene.add
      .tileSprite(0, 0, view.w, 256, key)
      .setOrigin(0, 0)
      .setDepth(depth);
    scene.parallax.push({
      obj: layer,
      update() {
        const wv = cam.worldView;
        layer.tilePositionX = cam.scrollX * fx;
        layer.x = wv.x;
        layer.y = wv.y + baseY + (maxScrollY - wv.y) * fy;
      },
    });
    return layer;
  };
  addSilhouette('bgFar', Sea.DEPTH.far, 0.1, 20, 0.1);
  addSilhouette('bgMid', Sea.DEPTH.mid, 0.32, 16, 0.24);

  Sea.decorateTerrain(scene, rand);
};

/*
 * Scatter life over the generated terrain: kelp on shallow ledges, rocks
 * anywhere, bioluminescent plants growing denser with depth (including a
 * few hanging from cave ceilings).
 */
Sea.decorateTerrain = function (scene, rand) {
  const glowTints = [0x7dffd8, 0xc08cff, 0x6ab8ff];
  const surfaces = Sea.terrain.surfaces;
  const ceilings = Sea.terrain.ceilings;

  const addGlowPlant = (x, y, flip) => {
    const v = Math.floor(rand() * 3);
    scene.add
      .image(x, y, 'glowplant' + v)
      .setOrigin(0.5, 1)
      .setDepth(Sea.DEPTH.flora + 0.1)
      .setFlipY(flip);
    const glow = scene.add
      .image(x, y + (flip ? 6 : -6), 'orb')
      .setDepth(Sea.DEPTH.glow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(glowTints[v])
      .setScale(0.7 + rand() * 0.5)
      .setAlpha(0.5);
    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.3, to: 0.75 },
      scale: glow.scale * 1.25,
      duration: 1600 + rand() * 2200,
      delay: rand() * 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    Sea.addLight(scene, glow, 30, true);
  };

  for (const s of surfaces) {
    const roll = rand();
    if (s.m < 480 && roll < 0.055) {
      // kelp holds to the shallower ledges
      const kelp = scene.add
        .image(s.x, s.y + 4, 'kelp' + Math.floor(rand() * 2))
        .setOrigin(0.5, 1)
        .setDepth(Sea.DEPTH.flora)
        .setFlipX(rand() < 0.5);
      scene.tweens.add({
        targets: kelp,
        angle: { from: -3 - rand() * 2, to: 3 + rand() * 2 },
        scaleX: { from: 0.92, to: 1.05 },
        duration: 2400 + rand() * 1600,
        delay: rand() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (roll < 0.1) {
      scene.add
        .image(s.x, s.y + 3, 'rock' + Math.floor(rand() * 3))
        .setOrigin(0.5, 1)
        .setDepth(Sea.DEPTH.floor + 0.1)
        .setFlipX(rand() < 0.5);
    } else if (roll < 0.1 + 0.02 + (s.m / 1000) * 0.075) {
      // bioluminescence thickens with depth
      addGlowPlant(s.x, s.y + 2, false);
    }
  }

  for (const c of ceilings) {
    if (c.m > 420 && rand() < 0.03) addGlowPlant(c.x, c.y - 2, true);
  }
};

/*
 * Atmosphere pass: plankton drift, propeller bubbles, foreground debris,
 * vignette, and the opening control hint. Called after the sub exists.
 */
Sea.buildAtmosphere = function (scene) {
  const cam = scene.cameras.main;
  const view = Sea.viewSize(cam);

  // Plankton: faint additive motes drifting through the water column.
  // The emitter rides the camera; particles live in world space.
  scene.plankton = scene.add.particles(0, 0, 'mote', {
    emitZone: {
      type: 'random',
      source: new Phaser.Geom.Rectangle(-view.w / 2 - 30, -view.h / 2 - 20, view.w + 60, view.h + 40),
    },
    speedX: { min: -6, max: 6 },
    speedY: { min: -5, max: 2 },
    lifespan: { min: 6000, max: 11000 },
    alpha: { start: 0.35, end: 0 },
    scale: { min: 0.5, max: 1 },
    tint: [0xbfe4ff, 0x8fd8d0, 0xffffff],
    quantity: 1,
    frequency: 90,
    blendMode: Phaser.BlendModes.ADD,
  });
  // Below the darkness layer, so motes only show where light reaches
  // them — the headlight beam picks them out of the black.
  scene.plankton.setDepth(Sea.DEPTH.darkness - 0.2);

  // Bubbles from the propeller while thrusting (plus a lazy idle burp).
  scene.bubbles = scene.add.particles(0, 0, 'bubble', {
    speedY: { min: -26, max: -14 },
    speedX: { min: -8, max: 8 },
    lifespan: { min: 1400, max: 2600 },
    alpha: { start: 0.7, end: 0 },
    scale: { min: 0.5, max: 1 },
    frequency: 110,
    emitting: false,
  });
  scene.bubbles.setDepth(Sea.DEPTH.sub - 0.5);
  scene.time.addEvent({
    delay: 3200,
    loop: true,
    callback: () => {
      if (!scene.bubbles.emitting) scene.bubbles.explode(1);
    },
  });

  // Foreground debris layer, drifting faster than the world.
  const fore = scene.add
    .tileSprite(0, 0, view.w, view.h, 'fgDebris')
    .setOrigin(0, 0)
    .setDepth(Sea.DEPTH.fore)
    .setAlpha(0.8);
  scene.parallax.push({
    obj: fore,
    update() {
      const wv = cam.worldView;
      fore.tilePositionX = cam.scrollX * 1.4;
      fore.tilePositionY = cam.scrollY * 1.4;
      fore.x = wv.x;
      fore.y = wv.y;
    },
  });

  // Vignette hugging the screen edges.
  const vignette = scene.add
    .image(0, 0, 'vignette')
    .setOrigin(0, 0)
    .setDepth(Sea.DEPTH.vignette)
    .setDisplaySize(view.w, view.h);

  scene.parallax.push({
    obj: vignette,
    update() {
      const wv = cam.worldView;
      vignette.x = wv.x;
      vignette.y = wv.y;
    },
  });
};

Sea.updateWorld = function (scene) {
  for (const p of scene.parallax) p.update();

  const cam = scene.cameras.main;
  if (scene.plankton) {
    scene.plankton.setPosition(cam.midPoint.x, cam.midPoint.y);
  }
  if (scene.bubbles && scene.subBody) {
    scene.bubbles.setPosition(
      scene.subBody.x - scene.facing * 15,
      scene.subBody.y + 1
    );
  }
  if (scene.waves) scene.waves.tilePositionX += 0.12;
};
