'use strict';

/*
 * World building: background water gradient, parallax silhouette layers,
 * the seafloor with its rocks / kelp / bioluminescent plants, and the
 * submarine's light textures. Everything is drawn to canvas textures at
 * boot — no image files.
 */

window.Sea = window.Sea || {};

Sea.DEPTH = {
  water: 0,
  far: 1,
  mid: 2,
  floor: 3,
  flora: 4,
  glow: 5, // additive glows for plants/creatures
  creature: 6,
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

  // Vertical water gradient: faint moonlit blue up top, near-black below.
  {
    const tex = scene.textures.createCanvas('bgWater', 32, 450);
    const ctx = tex.getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, 450);
    grad.addColorStop(0.0, '#122440');
    grad.addColorStop(0.28, '#0a1628');
    grad.addColorStop(0.7, '#050a18');
    grad.addColorStop(1.0, '#03060e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 450);
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

  // Seafloor sand tile.
  {
    const tex = scene.textures.createCanvas('sand', 64, 64);
    const ctx = tex.getContext();
    ctx.fillStyle = '#0d1626';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#1e2e4e';
    ctx.fillRect(0, 0, 64, 2);
    ctx.fillStyle = '#15223c';
    ctx.fillRect(0, 2, 64, 2);
    for (let i = 0; i < 42; i++) {
      ctx.fillStyle = rand() < 0.3 ? '#1c2c4a' : '#111c30';
      ctx.fillRect(Math.floor(rand() * 64), 6 + Math.floor(rand() * 56), 2, 1);
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
  const view = { w: cam.width, h: cam.height };
  const maxScrollY = W.height - view.h;
  const rand = Sea.rng(0xb10b);

  // Water gradient rides the camera; drifts a little with depth.
  const water = scene.add
    .image(0, 0, 'bgWater')
    .setOrigin(0, 0)
    .setDepth(Sea.DEPTH.water)
    .setScrollFactor(0);
  water.setDisplaySize(view.w, 450);
  scene.parallax = [];
  scene.parallax.push({
    obj: water,
    update() {
      water.y = -((450 - view.h) * (cam.scrollY / maxScrollY));
    },
  });

  // Silhouette layers: horizontal scroll via tilePosition, vertical via
  // sliding the sprite so distant ground sinks away near the surface.
  const addSilhouette = (key, depth, fx, baseY, fy) => {
    const layer = scene.add
      .tileSprite(0, 0, view.w, 256, key)
      .setOrigin(0, 0)
      .setDepth(depth)
      .setScrollFactor(0);
    scene.parallax.push({
      obj: layer,
      update() {
        layer.tilePositionX = cam.scrollX * fx;
        layer.y = baseY + (maxScrollY - cam.scrollY) * fy;
      },
    });
    return layer;
  };
  addSilhouette('bgFar', Sea.DEPTH.far, 0.1, 20, 0.1);
  addSilhouette('bgMid', Sea.DEPTH.mid, 0.32, 16, 0.24);

  // Seafloor (true world space).
  scene.add
    .tileSprite(0, W.height - 64, W.width, 64, 'sand')
    .setOrigin(0, 0)
    .setDepth(Sea.DEPTH.floor);

  const floorY = W.height - 62;

  // Rocks: scattered singles and small piles.
  for (let x = 60; x < W.width - 60; x += 90 + rand() * 260) {
    const v = Math.floor(rand() * 3);
    scene.add
      .image(x, floorY + 2 + rand() * 6, 'rock' + v)
      .setOrigin(0.5, 1)
      .setDepth(Sea.DEPTH.floor + (rand() < 0.5 ? -0.1 : 0.1))
      .setFlipX(rand() < 0.5);
    if (rand() < 0.35) {
      scene.add
        .image(x + 8 + rand() * 14, floorY + 6, 'rock' + Math.floor(rand() * 2))
        .setOrigin(0.5, 1)
        .setDepth(Sea.DEPTH.floor + 0.2)
        .setFlipX(rand() < 0.5);
    }
  }

  // Kelp: swaying strands, singly and in beds.
  for (let x = 140; x < W.width - 140; x += 120 + rand() * 420) {
    const count = rand() < 0.4 ? 3 + Math.floor(rand() * 3) : 1;
    for (let i = 0; i < count; i++) {
      const kelp = scene.add
        .image(x + i * (8 + rand() * 10), floorY + 4, 'kelp' + Math.floor(rand() * 2))
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
    }
  }

  // Bioluminescent plants: bulbs plus a tinted additive glow that breathes.
  const glowTints = [0x7dffd8, 0xc08cff, 0x6ab8ff];
  for (let x = 200; x < W.width - 200; x += 260 + rand() * 520) {
    const v = Math.floor(rand() * 3);
    const px = x + rand() * 60;
    scene.add
      .image(px, floorY + 6, 'glowplant' + v)
      .setOrigin(0.5, 1)
      .setDepth(Sea.DEPTH.flora + 0.1);
    const glow = scene.add
      .image(px, floorY - 2, 'orb')
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
  }
};

Sea.updateWorld = function (scene) {
  for (const p of scene.parallax) p.update();
};
