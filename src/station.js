'use strict';

/*
 * The surface: night sky, moon, the animated waterline, and the floating
 * research station the player docks with for upgrades.
 */

window.Sea = window.Sea || {};

Sea.STATION_X = 3600;

Sea.makeSurfaceTextures = function (scene) {
  const rand = Sea.rng(0x5747);

  // Starfield strip for the sky band.
  {
    const tex = scene.textures.createCanvas('sky', 512, 128);
    const ctx = tex.getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#05070f');
    grad.addColorStop(1, '#0d1526');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 90; i++) {
      const b = 0.35 + rand() * 0.65;
      ctx.fillStyle = `rgba(220,232,255,${b.toFixed(2)})`;
      ctx.fillRect(Math.floor(rand() * 512), Math.floor(rand() * 118), 1, 1);
    }
    tex.refresh();
  }

  // Waterline shimmer strip.
  {
    const tex = scene.textures.createCanvas('waves', 128, 6);
    const ctx = tex.getContext();
    for (let x = 0; x < 128; x += 2) {
      const h = rand() < 0.35 ? 2 : 1;
      ctx.fillStyle = rand() < 0.5 ? 'rgba(159,200,232,0.7)' : 'rgba(110,150,190,0.55)';
      ctx.fillRect(x, Math.floor(rand() * 3), 2, h);
    }
    tex.refresh();
  }

  // The station: pontoons, plank deck, lit cabin, mast. ~96x64, the
  // bottom ~14px sits below the waterline.
  {
    const w = 96;
    const h = 64;
    const tex = scene.textures.createCanvas('station', w, h);
    const ctx = tex.getContext();
    const px = (x, y, ww, hh, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, ww, hh);
    };

    // mast + beacon perch
    px(70, 2, 2, 22, '#3a4a5c');
    px(64, 8, 14, 2, '#2e3c4c');
    // cabin
    px(28, 22, 42, 20, '#3c4c60');
    px(28, 22, 42, 3, '#2a3644'); // roof line
    px(26, 20, 46, 3, '#233040'); // roof overhang
    // windows (warm light)
    px(33, 28, 7, 7, '#ffd890');
    px(45, 28, 7, 7, '#ffd890');
    px(57, 28, 7, 7, '#ffce6e');
    px(33, 28, 7, 2, '#fff3c8');
    // door
    px(20, 30, 6, 12, '#2c3a4a');
    // deck
    px(6, 42, 84, 5, '#5a4632');
    px(6, 42, 84, 1, '#7a6044');
    for (let x = 10; x < 88; x += 8) px(x, 43, 1, 4, '#43342a');
    // railing
    px(6, 36, 2, 6, '#4a3c2c');
    px(88, 36, 2, 6, '#4a3c2c');
    px(6, 36, 84, 1, '#4a3c2c');
    // pontoons (bottom half submerged)
    px(8, 47, 30, 12, '#26313f');
    px(58, 47, 30, 12, '#26313f');
    px(8, 47, 30, 2, '#39485c');
    px(58, 47, 30, 2, '#39485c');
    px(8, 55, 30, 4, '#1a222e');
    px(58, 55, 30, 4, '#1a222e');
    // moon-pool frame between pontoons
    px(40, 47, 16, 3, '#33414f');
    px(44, 50, 2, 12, '#33414f');
    px(50, 50, 2, 12, '#33414f');
    tex.refresh();
  }
};

Sea.buildSurface = function (scene) {
  const W = Sea.WORLD;

  // Sky band above the waterline.
  scene.add
    .tileSprite(0, 0, W.width, Sea.SURFACE_Y, 'sky')
    .setOrigin(0, 0)
    .setDepth(Sea.DEPTH.water + 0.1);

  // Moon, hanging over the station.
  const moonX = Sea.STATION_X - 260;
  scene.add
    .image(moonX, 34, 'orb')
    .setDepth(Sea.DEPTH.water + 0.2)
    .setScale(1.6)
    .setTint(0xfff8e0)
    .setAlpha(0.95);
  scene.add
    .image(moonX, 34, 'orb')
    .setDepth(Sea.DEPTH.water + 0.2)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setScale(3.4)
    .setAlpha(0.2)
    .setTint(0xfff2c8);

  // Waterline.
  scene.waves = scene.add
    .tileSprite(0, Sea.SURFACE_Y - 3, W.width, 6, 'waves')
    .setOrigin(0, 0)
    .setDepth(Sea.DEPTH.fore - 0.5)
    .setAlpha(0.8);

  // The station itself. Texture bottom sits 14px under the waterline.
  const station = scene.add
    .image(Sea.STATION_X, Sea.SURFACE_Y + 14, 'station')
    .setOrigin(0.5, 1)
    .setDepth(Sea.DEPTH.creature + 0.5);

  // Blinking mast beacon.
  const beacon = scene.add
    .image(Sea.STATION_X + 23, Sea.SURFACE_Y + 14 - 62, 'orb')
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(0xff5a4a)
    .setScale(0.35)
    .setAlpha(0.9)
    .setDepth(Sea.DEPTH.creature + 0.6);
  scene.tweens.add({
    targets: beacon,
    alpha: { from: 0.9, to: 0.05 },
    duration: 900,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  // Cabin light spill on the water.
  const spill = scene.add
    .image(Sea.STATION_X + 2, Sea.SURFACE_Y + 4, 'orb')
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(0xffce6e)
    .setScale(1.6, 0.5)
    .setAlpha(0.22)
    .setDepth(Sea.DEPTH.creature + 0.4);
  scene.tweens.add({
    targets: spill,
    alpha: { from: 0.16, to: 0.28 },
    duration: 2200,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  Sea.addLight(scene, spill, 120);
  Sea.addLight(scene, beacon, 40, true);

  // Underwater docking beacons: two green guide lights under the moon pool.
  const dock = { x: Sea.STATION_X, y: Sea.SURFACE_Y + 46 };
  for (const off of [-10, 10]) {
    const g = scene.add
      .image(dock.x + off, dock.y - 14, 'orb')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x54e88a)
      .setScale(0.4)
      .setAlpha(0.6)
      .setDepth(Sea.DEPTH.glow);
    scene.tweens.add({
      targets: g,
      alpha: { from: 0.3, to: 0.75 },
      duration: 1300,
      yoyo: true,
      repeat: -1,
      delay: off > 0 ? 650 : 0,
      ease: 'Sine.easeInOut',
    });
    Sea.addLight(scene, g, 54, true);
  }

  // Station bob on the swell.
  scene.tweens.add({
    targets: [station],
    y: '+=2',
    duration: 2600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  scene.station = station;
  Sea.stationDock = dock;
};
