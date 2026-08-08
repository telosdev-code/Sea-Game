'use strict';

/*
 * Main (and only) scene: a long horizontal stretch of night-time ocean.
 * The world is much wider than the screen; the camera drifts after the sub.
 */

window.Sea = window.Sea || {};

Sea.SceneMain = class extends Phaser.Scene {
  constructor() {
    super('sea');
  }

  create() {
    Sea._scene = this; // debug/testing handle
    const W = Sea.WORLD;
    Sea.state = { paused: false, docked: false };

    Sea.makeSubTextures(this);
    Sea.makeWorldTextures(this);
    Sea.makeCreatureTextures(this);
    Sea.makeSurfaceTextures(this);
    Sea.generateTerrain(this);

    // Keep the sub inside the water column: below the surface, above bedrock.
    const top = Sea.SURFACE_Y + 6;
    this.physics.world.setBounds(24, top, W.width - 48, W.height - top - 24);
    this.cameras.main.setBounds(0, 0, W.width, W.height);

    Sea.buildWorld(this);
    Sea.buildSurface(this);
    Sea.spawnCreatures(this);
    Sea.makeSalvageTextures(this);
    Sea.spawnSalvage(this);
    this.buildSub(Sea.STATION_X - 70, Sea.SURFACE_Y + 70);
    Sea.buildAtmosphere(this);
    Sea.applyUpgrades(this);
    Sea.Audio.attach(this);

    this.physics.add.collider(this.subBody, Sea.terrain.layer);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,E,F');
    this.dockCooldown = 0;
    this.canDock = false;
    this.limitHit = false;
    this.photoCooldown = 0;

    // Active sonar ping (top sonar tier only).
    this.time.addEvent({
      delay: 4500,
      loop: true,
      callback: () => {
        if (Sea.tierDef('sonar').ping) this.firePing();
      },
    });

    const cam = this.cameras.main;
    cam.startFollow(this.subBody, false, 0.06, 0.06);
    cam.setDeadzone(36, 24);

    this.scene.launch('ui');
  }

  /*
   * Snap a photo: any un-photographed wildlife close enough to the sub
   * and inside the camera's view is captured and paid out.
   */
  takePhoto() {
    if (this.photoCooldown > 0) return;
    this.photoCooldown = 900;
    this.scene.get('ui').photoFlash();
    Sea.Audio.shutter();

    const cam = this.cameras.main;
    const view = cam.worldView;
    let shots = 0;
    for (const c of this.creatures) {
      if (Sea.save.photographed.includes(c.id)) continue;
      const cx = c.type === 'school' ? c.x : c.spr.x;
      const cy = c.type === 'school' ? c.y : c.spr.y;
      if (!view.contains(cx, cy)) continue;
      const d = Phaser.Math.Distance.Between(this.subBody.x, this.subBody.y, cx, cy);
      if (d > 270) continue;
      const info = Sea.SPECIES[c.species];
      Sea.addMoney(this, info.value, info.name, cx, cy - 16);
      Sea.save.photographed.push(c.id);
      shots++;
    }
    if (shots > 0) {
      Sea.storeSave();
      Sea.Audio.coin();
    }
  }

  firePing() {
    Sea.Audio.ping();
    const ring = this.add
      .image(this.subBody.x, this.subBody.y, 'ring')
      .setDepth(Sea.DEPTH.glow + 0.2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.5)
      .setAlpha(0.75);
    const wash = this.add
      .image(this.subBody.x, this.subBody.y, 'orb')
      .setDepth(Sea.DEPTH.glow + 0.1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x8fd0ff)
      .setScale(1.5)
      .setAlpha(0.3);
    this.tweens.add({
      targets: ring,
      scale: 9.5,
      alpha: 0,
      duration: 2600,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.tweens.add({
      targets: wash,
      scale: 12,
      alpha: 0,
      duration: 2400,
      ease: 'Sine.easeOut',
      onComplete: () => wash.destroy(),
    });
  }

  dock() {
    Sea.state.docked = true;
    const body = this.subBody.body;
    body.setVelocity(0, 0);
    body.setAcceleration(0, 0);
    this.scene.pause();
  }

  buildSub(x, y) {
    // A physics-enabled container: the sprite rides inside so the idle bob
    // and the headlight cone move with the hull without fighting the body.
    this.subBody = this.add.container(x, y).setDepth(Sea.DEPTH.sub);

    // Headlight cone, projected from the bow. Lives in the container so it
    // rotates with the hull; flipped in update() when the sub turns.
    this.subCone = this.add
      .image(11, 1, 'cone')
      .setOrigin(0, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.subBody.add(this.subCone);
    this.tweens.add({
      targets: this.subCone,
      alpha: { from: 0.85, to: 1 },
      duration: 260,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Soft ambient halo around the hull.
    this.subHalo = this.add
      .image(0, 0, 'orb')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x9fd8ff)
      .setScale(2.4)
      .setAlpha(0.16);
    this.subBody.add(this.subHalo);

    this.subSprite = this.add.sprite(0, 0, 'sub', 0);
    this.subBody.add(this.subSprite);

    this.physics.add.existing(this.subBody);
    const body = this.subBody.body;
    body.setSize(28, 14);
    body.setOffset(-14, -7);
    body.setCollideWorldBounds(true);
    body.setBounce(0.16, 0.16); // soft nudge off the rock, never a hard stop
    // Damping drag: fraction of velocity kept per second — floaty glide.
    body.setDamping(true);
    body.setDrag(0.28, 0.28);
    body.setMaxVelocity(150, 120);

    this.anims.create({
      key: 'sub-run',
      frames: [{ key: 'sub', frame: 0 }, { key: 'sub', frame: 1 }],
      frameRate: 12,
      repeat: -1,
    });
    this.subSprite.play('sub-run');

    // Gentle idle bob, independent of physics.
    this.tweens.add({
      targets: this.subSprite,
      y: 1.7,
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.facing = 1;
  }

  update(time, delta) {
    const body = this.subBody.body;
    const k = this.keys;
    const ACCEL = 240;

    let ax = 0;
    let ay = 0;
    if (k.A.isDown || k.LEFT.isDown) ax -= ACCEL;
    if (k.D.isDown || k.RIGHT.isDown) ax += ACCEL;
    if (k.W.isDown || k.UP.isDown) ay -= ACCEL;
    if (k.S.isDown || k.DOWN.isDown) ay += ACCEL;
    body.setAcceleration(ax, ay);

    if (ax > 0) this.facing = 1;
    else if (ax < 0) this.facing = -1;
    this.subSprite.setFlipX(this.facing < 0);
    this.subCone.setScale(this.facing * this.coneScale, this.coneScale);
    this.subCone.x = 11 * this.facing;

    // Soft depth limit: past the hull rating, buoyancy wins.
    const ratingY = Sea.SURFACE_Y + Sea.tierDef('depth').rating * Sea.PX_PER_M;
    const overshoot = this.subBody.y - ratingY;
    this.limitHit = overshoot > -8;
    if (overshoot > 0) {
      body.setVelocityY(
        Math.min(body.velocity.y, -Math.min(overshoot * 2.2, 42))
      );
    }

    // Docking with the station.
    if (this.dockCooldown > 0) this.dockCooldown -= delta;
    const dockDist = Phaser.Math.Distance.Between(
      this.subBody.x,
      this.subBody.y,
      Sea.stationDock.x,
      Sea.stationDock.y
    );
    this.canDock = dockDist < 85 && this.dockCooldown <= 0;
    if (this.canDock && Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      this.dock();
      return;
    }

    // wildlife photography
    if (this.photoCooldown > 0) this.photoCooldown -= delta;
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) this.takePhoto();

    Sea.updateSalvage(this);
    Sea.Audio.setDepth(Sea.depthAt(this.subBody.y));

    // Tilt the nose toward vertical travel; mirrored when facing left.
    const tilt = Phaser.Math.Clamp(body.velocity.y * 0.0032, -0.34, 0.34);
    this.subBody.rotation = Phaser.Math.Linear(
      this.subBody.rotation,
      this.facing === 1 ? tilt : -tilt,
      0.07
    );

    // Propeller spins lazily at idle, faster under thrust.
    const thrusting = ax !== 0 || ay !== 0;
    this.subSprite.anims.timeScale = thrusting ? 1 : 0.3;
    if (this.bubbles) this.bubbles.emitting = thrusting;

    Sea.updateWorld(this);
    Sea.updateCreatures(this, time, delta);
  }
};
