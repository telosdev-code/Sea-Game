'use strict';

/*
 * Ambient sea life. All peaceful, none interactive — wildlife to discover
 * in the dark. Fish schools drift and turn together, jellyfish pulse and
 * float, sea turtles cruise the length of the trench.
 */

window.Sea = window.Sea || {};

/* Photo prices: rarer wildlife pays better. */
Sea.SPECIES = {
  school0: { name: 'reef school', value: 15 },
  school1: { name: 'garibaldi school', value: 25 },
  school2: { name: 'moonfish school', value: 40 },
  jelly: { name: 'jellyfish', value: 30 },
  turtle: { name: 'sea turtle', value: 80 },
  meg: { name: 'GOLDEN MEGALODON', value: 1200 },
};

/* ------------------------------------------------------------------ */
/* Textures                                                           */
/* ------------------------------------------------------------------ */

Sea.makeCreatureTextures = function (scene) {
  // Small schooling fish, three colorways, two frames (tail flick).
  // Facing right: head/eye on the right, tail on the left.
  const fishFrames = [
    [
      '.T...OOO..',
      'TTOOBBLBO.',
      'TTBBBBBEBO',
      'TTOOBBBBO.',
      '.T...OOO..',
    ],
    [
      'T....OOO..',
      '.TOOBBLBO.',
      'TTBBBBBEBO',
      '.TOOBBBBO.',
      'T....OOO..',
    ],
  ];
  const fishPalettes = [
    { O: '#07141c', B: '#35b3a6', L: '#7fe3d2', T: '#1f7a70', E: '#e8fbff' },
    { O: '#180e06', B: '#d98a4a', L: '#f2b878', T: '#a05c28', E: '#fff2d8' },
    { O: '#0a1018', B: '#7fa3c4', L: '#b8d2e8', T: '#54789a', E: '#f0f8ff' },
  ];
  fishPalettes.forEach((pal, i) => {
    Sea.pixelTexture(scene, 'fish' + i, fishFrames, pal);
    scene.anims.create({
      key: 'fish' + i + '-swim',
      frames: [{ key: 'fish' + i, frame: 0 }, { key: 'fish' + i, frame: 1 }],
      frameRate: 6,
      repeat: -1,
    });
  });

  // Jellyfish: relaxed bell (frame 0) and contracted bell (frame 1).
  const jellyPal = {
    O: '#3a1a52',
    J: '#e0a0f0',
    j: '#a868d8',
    i: '#f4d0ff',
    T: '#9a68c8',
    t: '#6a4494',
  };
  const jellyFrames = [
    [
      '...OOOOOO...',
      '..OJJiiJJO..',
      '.OJJjjjjJJO.',
      '.OJjjjjjjJO.',
      '.OOOOOOOOOO.',
      '..T.t..t.T..',
      '..T.t..t.T..',
      '...T.t.T....',
      '..T...t..T..',
      '...T.t..T...',
      '.....T......',
      '....T.......',
    ],
    [
      '....OOOO....',
      '..OOJiiJOO..',
      '..OJjjjjJO..',
      '..OJjjjjJO..',
      '..OOOOOOOO..',
      '...Tt..tT...',
      '...T.tt.T...',
      '....T..T....',
      '...t.TT.t...',
      '....T..T....',
      '.....T......',
      '............',
    ],
  ];
  Sea.pixelTexture(scene, 'jelly', jellyFrames, jellyPal);

  // Sea turtle: two frames (flipper downstroke / upstroke). Facing right.
  const turtlePal = {
    O: '#081408',
    S: '#2e6246', // shell
    s: '#1d4630', // shell shade / pattern
    R: '#3f7e56', // shell rim highlight
    K: '#5f9e64', // skin
    k: '#3d7047', // skin shade
    E: '#0c130c', // eye
  };
  const turtleFrames = [
    [
      '.........OOOOOOOO...........',
      '.......OORRRRRRRROO.........',
      '......ORSSssSSssSSRO........',
      '.....ORSSSSSSSSSSSSRO.OOO...',
      '....ORSSssSSssSSssSSROKKKO..',
      '....OSSSSSSSSSSSSSSSOKKEKKO.',
      '.OO.OssSSssSSssSSssSOKKKKKO.',
      'OKKOOOsssssssssssssOOOKKKO..',
      '.OKKKOOOOOOOOOOOOOOKKOOO....',
      '..OOKKO...OKKKOO..OKKO......',
      '....OO...OKKKO....OKO.......',
      '.........OKKO......O........',
      '..........OO................',
      '............................',
    ],
    [
      '.........OOOOOOOO...........',
      '.......OORRRRRRRROO.........',
      '......ORSSssSSssSSRO........',
      '.....ORSSSSSSSSSSSSRO.OOO...',
      '.OO.ORSSssSSssSSssSSROKKKO..',
      'OKKOOSSSSSSSSSSSSSSSOKKEKKO.',
      '.OKKKssSSssSSssSSssSOKKKKKO.',
      '..OOOOOssssssssssssOOOKKKO..',
      '......OOOOOOOOOOOOOKKOO.....',
      '......OKKKO....OOKKOO.......',
      '.....OKKKO......OKO.........',
      '......OO.........O..........',
      '............................',
      '............................',
    ],
  ];
  Sea.pixelTexture(scene, 'turtle', turtleFrames, turtlePal);
  scene.anims.create({
    key: 'turtle-swim',
    frames: [{ key: 'turtle', frame: 0 }, { key: 'turtle', frame: 1 }],
    frameRate: 1.6,
    repeat: -1,
  });

  // The golden megalodon: a huge gilded shark that haunts the bedrock
  // trenches. Drawn procedurally (see genMegalodon) so it can be big
  // without hand-maintaining a sprite grid this size.
  Sea.genMegalodon(scene, 'meg');
  scene.anims.create({
    key: 'meg-swim',
    frames: [{ key: 'meg', frame: 0 }, { key: 'meg', frame: 1 }],
    frameRate: 1.4,
    repeat: -1,
  });
};

/*
 * The megalodon is far too large to hand-draw as a character grid, so it
 * is built from geometry instead: a tapered spindle body, triangular
 * fins, and a forked crescent tail, shaded in bands from the gilded back
 * down to a pale belly. Two frames sweep the tail and bend the flank.
 */
Sea.genMegalodon = function (scene, key) {
  const W = 112;
  const H = 60;
  const CY = 30;
  const NOSE_X = 104;
  const TAIL_X = 24;
  const PEAK_X = 62;
  const MAX_T = 11.5;

  const PAL = {
    out: '#2a1c06',
    lit: '#fbe79a', // sheen along the back
    body: '#e8c04a', // gold flank
    shade: '#c08c28', // lower flank shadow
    belly: '#f5e2ad',
    fin: '#a87e22',
    finLit: '#cf9f34',
    eye: '#160e04',
    tooth: '#fffdf0',
  };

  // Half-thickness of the body at x: rounded toward the snout, long
  // taper toward the tail.
  const halfT = (x) => {
    if (x > NOSE_X || x < TAIL_X) return -1;
    if (x >= PEAK_X) {
      // conical snout
      const t = (x - PEAK_X) / (NOSE_X - PEAK_X);
      return MAX_T * Math.pow(Math.max(0, 1 - t), 0.44);
    }
    const t = (PEAK_X - x) / (PEAK_X - TAIL_X);
    return MAX_T * 0.86 * Math.pow(Math.max(0, 1 - t), 0.42) + 2.3;
  };

  // Centreline, bending toward the tail so the sweep reads as motion.
  const centerY = (x, sweep) => {
    const t = Phaser.Math.Clamp((PEAK_X - x) / (PEAK_X - TAIL_X), 0, 1);
    return CY + sweep * 5 * t * t;
  };

  const tex = scene.textures.createCanvas(key, W * 2, H);
  const ctx = tex.getContext();

  for (let f = 0; f < 2; f++) {
    const sweep = f === 0 ? -1 : 1;
    const mask = new Uint8Array(W * H); // 0 empty, 1 body, 2 fin
    const put = (x, y, v) => {
      if (x >= 0 && x < W && y >= 0 && y < H) mask[y * W + x] = v;
    };

    // body spindle
    for (let x = TAIL_X; x <= NOSE_X; x++) {
      const ht = halfT(x);
      if (ht <= 0) continue;
      const c = centerY(x, sweep);
      for (let y = Math.round(c - ht); y <= Math.round(c + ht); y++) {
        put(x, y, 1);
      }
    }

    // filled triangle (fins and tail lobes)
    const tri = (ax, ay, bx, by, cx, cy) => {
      const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
      const maxX = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
      const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
      const maxY = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
      const sign = (px, py, qx, qy, rx, ry) =>
        (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const d1 = sign(x, y, ax, ay, bx, by);
          const d2 = sign(x, y, bx, by, cx, cy);
          const d3 = sign(x, y, cx, cy, ax, ay);
          const neg = d1 < 0 || d2 < 0 || d3 < 0;
          const pos = d1 > 0 || d2 > 0 || d3 > 0;
          if (!(neg && pos) && mask[y * W + x] === 0) mask[y * W + x] = 2;
        }
      }
    };

    // Fins are anchored on the body outline and reach well clear of it,
    // since only the part outside the spindle ends up visible.
    tri(44, 22, 60, 4, 78, 23); // dorsal
    tri(30, 24, 34, 14, 42, 25); // second dorsal
    tri(70, 41, 90, 35, 57, 56); // pectoral scythe
    tri(43, 39, 55, 37, 38, 51); // pelvic
    tri(31, 37, 40, 36, 27, 46); // anal

    // Forked crescent tail: a long upper lobe, shorter lower lobe, with
    // a wide shared base so the fork reads as one fin.
    const tc = centerY(TAIL_X, sweep);
    tri(29, tc - 7, 27, tc + 8, 2, tc - 20 + sweep * 4); // upper lobe
    tri(29, tc - 5, 27, tc + 8, 6, tc + 16 + sweep * 4); // lower lobe
    tri(29, tc - 6, 29, tc + 7, 12, tc - 3 + sweep * 3); // filled notch

    // paint
    const empty = (x, y) =>
      x < 0 || x >= W || y < 0 || y >= H || mask[y * W + x] === 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const m = mask[y * W + x];
        if (!m) continue;
        let color;
        if (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1)) {
          color = PAL.out;
        } else if (m === 2) {
          // solid fins, lit only where they join the body
          color = empty(x, y - 2) || empty(x, y + 2) ? PAL.fin : PAL.finLit;
        } else {
          const c = centerY(x, sweep);
          const ht = halfT(x);
          const rel = (y - (c - ht)) / (2 * ht); // 0 back .. 1 belly
          if (rel < 0.1) color = PAL.lit;
          else if (rel < 0.56) color = PAL.body;
          else if (rel < 0.86) color = PAL.shade;
          else color = PAL.belly;
        }
        ctx.fillStyle = color;
        ctx.fillRect(f * W + x, y, 1, 1);
      }
    }

    const dot = (x, y, w, h, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(f * W + x, y, w, h);
    };

    // gill slits
    for (let i = 0; i < 5; i++) {
      const gx = 73 + i * 4;
      const c = centerY(gx, sweep);
      const ht = halfT(gx);
      dot(gx, Math.round(c - ht * 0.42), 1, Math.round(ht * 0.9), PAL.shade);
    }

    // underslung jaw, hugging the belly line, with a glint of teeth
    for (let x = 90; x <= 102; x++) {
      const y = Math.round(centerY(x, sweep) + halfT(x) * 0.62);
      dot(x, y, 1, 1, PAL.out);
      if (x % 4 === 0) dot(x, y - 1, 1, 1, PAL.tooth);
    }

    // eye
    const ec = Math.round(centerY(92, sweep) - 5);
    dot(90, ec, 5, 4, PAL.out);
    dot(91, ec + 1, 2, 2, PAL.eye);
    dot(93, ec + 1, 1, 1, PAL.tooth);

    // old scars across the flank
    dot(52, Math.round(centerY(52, sweep) - 7), 7, 1, PAL.lit);
    dot(63, Math.round(centerY(63, sweep) + 5), 5, 1, PAL.lit);
  }

  tex.refresh();
  tex.add(0, 0, 0, 0, W, H);
  tex.add(1, 0, W, 0, W, H);
  return tex;
};

/* ------------------------------------------------------------------ */
/* Spawning                                                           */
/* ------------------------------------------------------------------ */

Sea.spawnCreatures = function (scene) {
  const W = Sea.WORLD;
  const rand = Sea.rng(0xf15e5);
  scene.creatures = [];

  // Fish schools: a shared anchor wanders; each fish holds a loose slot
  // around it with its own swim wobble. Schools favour the upper waters
  // and the open galleries between formations.
  for (let s = 0; s < 14; s++) {
    const spot = Sea.openSpot(rand, 30, 620, 70);
    if (!spot) continue;
    const school = {
      type: 'school',
      x: spot.x,
      y: spot.y,
      heading: rand() * Math.PI * 2,
      speed: 16 + rand() * 14,
      wanderPhase: rand() * 100,
      fish: [],
    };
    // weighted rarity: moonfish schools are the scarce ones
    const roll = rand();
    const variant = roll < 0.45 ? 0 : roll < 0.8 ? 1 : 2;
    school.id = 'school' + s;
    school.species = 'school' + variant;
    const count = 5 + Math.floor(rand() * 5);
    for (let i = 0; i < count; i++) {
      const spr = scene.add
        .sprite(school.x, school.y, 'fish' + variant, 0)
        .setDepth(Sea.DEPTH.creature)
        .setAlpha(0.96);
      spr.play({ key: 'fish' + variant + '-swim', startFrame: i % 2 });
      school.fish.push({
        spr,
        ox: (rand() - 0.5) * 52,
        oy: (rand() - 0.5) * 30,
        phase: rand() * Math.PI * 2,
        wob: 1.6 + rand() * 2.2,
      });
    }
    scene.creatures.push(school);
  }

  // Jellyfish: pulse upward, sink between pulses, drift sideways. They
  // haunt every depth, glowing brighter company the deeper you go.
  const jellyTints = [0xffffff, 0xd0b8ff, 0xb8e4ff];
  for (let j = 0; j < 22; j++) {
    const spot = Sea.openSpot(rand, 60, 940, 55);
    if (!spot) continue;
    const x = spot.x;
    const y = spot.y;
    const tint = jellyTints[Math.floor(rand() * 3)];
    const spr = scene.add
      .sprite(x, y, 'jelly', 0)
      .setDepth(Sea.DEPTH.creature)
      .setAlpha(0.92)
      .setTint(tint);
    const glow = scene.add
      .image(x, y, 'orb')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xc084f0)
      .setScale(0.9)
      .setAlpha(0.34);
    scene.creatures.push({
      type: 'jelly',
      id: 'jelly' + j,
      species: 'jelly',
      spr,
      glow,
      baseX: x,
      t: rand() * 10,
      pulseEvery: 1.9 + rand() * 1.5,
      driftPhase: rand() * Math.PI * 2,
      vy: 0,
    });
  }

  // Sea turtles: slow travellers of the sunlit-adjacent waters.
  for (let t = 0; t < 4; t++) {
    const spot = Sea.openSpot(rand, 40, 480, 80);
    if (!spot) continue;
    const dir = t % 2 === 0 ? 1 : -1;
    const spr = scene.add
      .sprite(spot.x, spot.y, 'turtle', 0)
      .setDepth(Sea.DEPTH.creature)
      .play('turtle-swim');
    scene.creatures.push({
      type: 'turtle',
      id: 'turtle' + t,
      species: 'turtle',
      spr,
      vx: (10 + rand() * 5) * dir,
      baseY: spr.y,
      phase: rand() * Math.PI * 2,
    });
  }

  // The golden megalodon: one, at the bottom of the world.
  let megSpot = Sea.openSpot(rand, 880, 975, 80);
  if (!megSpot) megSpot = Sea.openSpot(rand, 860, 980, 60);
  if (!megSpot) megSpot = Sea.openSpot(rand, 840, 985, 42);
  if (megSpot) {
    const spr = scene.add
      .sprite(megSpot.x, megSpot.y, 'meg', 0)
      .setDepth(Sea.DEPTH.creature + 0.2)
      .play('meg-swim');
    const glow = scene.add
      .image(megSpot.x, megSpot.y, 'orb')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffd24a)
      .setScale(5.2)
      .setAlpha(0.22)
      .setDepth(Sea.DEPTH.glow);
    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.16, to: 0.3 },
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.creatures.push({
      type: 'meg',
      id: 'meg',
      species: 'meg',
      spr,
      glow,
      vx: 20,
      phase: rand() * Math.PI * 2,
    });
  }
};

/* ------------------------------------------------------------------ */
/* Behaviour                                                          */
/* ------------------------------------------------------------------ */

Sea.updateCreatures = function (scene, time, deltaMs) {
  const W = Sea.WORLD;
  const dt = Math.min(deltaMs, 50) / 1000;
  const t = time / 1000;

  for (const c of scene.creatures) {
    if (c.type === 'school') {
      // Slow meander: heading drifts on layered sines, then gets steered
      // back when the school nears the world edges.
      c.wanderPhase += dt;
      c.heading +=
        (Math.sin(c.wanderPhase * 0.43) * 0.55 +
          Math.sin(c.wanderPhase * 0.17 + 2.1) * 0.4) *
        dt;
      const steer = (target) => {
        c.heading = Phaser.Math.Angle.RotateTo(c.heading, target, 1.4 * dt);
      };
      if (c.x < 260) steer(0);
      else if (c.x > W.width - 260) steer(Math.PI);
      if (c.y < Sea.SURFACE_Y + 60) steer(Math.PI / 2);
      else if (c.y > W.height - 170) steer(-Math.PI / 2);

      // Turn away from rock ahead rather than swimming into it.
      const aheadX = c.x + Math.cos(c.heading) * 56;
      const aheadY = c.y + Math.sin(c.heading) * 56;
      if (Sea.isSolid(aheadX, aheadY)) {
        c.heading += 2.6 * dt;
      } else {
        c.x += Math.cos(c.heading) * c.speed * dt;
        c.y += Math.sin(c.heading) * c.speed * dt;
      }

      const facingLeft = Math.cos(c.heading) < 0;
      for (const f of c.fish) {
        f.spr.x = c.x + f.ox + Math.sin(t * f.wob + f.phase) * 3;
        f.spr.y = c.y + f.oy + Math.sin(t * 1.7 + f.phase * 2) * 3;
        f.spr.setFlipX(facingLeft);
      }
    } else if (c.type === 'jelly') {
      const prevCycle = c.t % c.pulseEvery;
      c.t += dt;
      const cycle = c.t % c.pulseEvery;
      if (cycle < prevCycle) c.vy -= 26; // bell contraction kick
      c.spr.setFrame(cycle < 0.4 ? 1 : 0);

      c.vy += 9 * dt; // slow sink between pulses
      c.vy = Phaser.Math.Clamp(c.vy, -32, 11);
      c.spr.y += c.vy * dt;
      if (c.spr.y < Sea.SURFACE_Y + 40) c.spr.y = Sea.SURFACE_Y + 40;
      if (c.spr.y > W.height - 130) c.vy = -24;
      // Rock above or below turns the drift around.
      if (c.vy < 0 && Sea.isSolid(c.spr.x, c.spr.y - 26)) c.vy = 6;
      else if (c.vy > 0 && Sea.isSolid(c.spr.x, c.spr.y + 26)) c.vy = -18;
      c.spr.x = c.baseX + Math.sin(c.t * 0.28 + c.driftPhase) * 16;

      c.glow.x = c.spr.x;
      c.glow.y = c.spr.y + 1;
      c.glow.setAlpha(0.26 + (cycle < 0.4 ? 0.18 : 0.06 * Math.sin(c.t * 2)));
    } else if (c.type === 'turtle') {
      c.phase += dt;
      c.spr.x += c.vx * dt;
      if (c.spr.x < 300) c.vx = Math.abs(c.vx);
      else if (c.spr.x > W.width - 300) c.vx = -Math.abs(c.vx);
      // Rock ahead: turn around.
      if (Sea.isSolid(c.spr.x + Math.sign(c.vx) * 60, c.spr.y)) {
        c.vx = -c.vx;
      }
      c.spr.setFlipX(c.vx < 0);
      c.spr.y = c.baseY + Math.sin(c.phase * 0.45) * 9;
      c.spr.rotation = Math.sin(c.phase * 0.45) * 0.06 * (c.vx < 0 ? -1 : 1);
    } else if (c.type === 'meg') {
      c.phase += dt;
      c.spr.x += c.vx * dt;
      if (c.spr.x < 400) c.vx = Math.abs(c.vx);
      else if (c.spr.x > W.width - 400) c.vx = -Math.abs(c.vx);
      if (Sea.isSolid(c.spr.x + Math.sign(c.vx) * 140, c.spr.y)) c.vx = -c.vx;
      c.spr.setFlipX(c.vx < 0);
      // hold to the bedrock band
      const m = Sea.depthAt(c.spr.y);
      let vy = Math.sin(c.phase * 0.35) * 7;
      if (m < 870) vy += 10;
      else if (m > 985) vy -= 10;
      if (vy < 0 && Sea.isSolid(c.spr.x, c.spr.y - 58)) vy = 4;
      else if (vy > 0 && Sea.isSolid(c.spr.x, c.spr.y + 58)) vy = -4;
      c.spr.y += vy * dt;
      c.spr.rotation = Math.sin(c.phase * 0.35) * 0.04 * (c.vx < 0 ? -1 : 1);
      c.glow.x = c.spr.x;
      c.glow.y = c.spr.y;
    }
  }
};
