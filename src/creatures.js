'use strict';

/*
 * Ambient sea life. All peaceful, none interactive — wildlife to discover
 * in the dark. Fish schools drift and turn together, jellyfish pulse and
 * float, sea turtles cruise the length of the trench.
 */

window.Sea = window.Sea || {};

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
    const variant = Math.floor(rand() * 3);
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
      spr,
      vx: (10 + rand() * 5) * dir,
      baseY: spr.y,
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
    }
  }
};
