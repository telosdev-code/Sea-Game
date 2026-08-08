'use strict';

/*
 * Main (and only) scene: a long horizontal stretch of night-time ocean.
 * The world is much wider than the screen; the camera drifts after the sub.
 */

window.Sea = window.Sea || {};

Sea.WORLD = { width: 7200, height: 900 };

Sea.SceneMain = class extends Phaser.Scene {
  constructor() {
    super('sea');
  }

  create() {
    Sea._scene = this; // debug/testing handle
    const W = Sea.WORLD;

    Sea.makeSubTextures(this);

    // Keep the sub inside the water column: below the surface, above the floor.
    this.physics.world.setBounds(24, 30, W.width - 48, W.height - 30 - 70);
    this.cameras.main.setBounds(0, 0, W.width, W.height);

    this.buildPlaceholderWorld();
    this.buildSub(200, W.height * 0.55);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT');

    const cam = this.cameras.main;
    cam.startFollow(this.subBody, false, 0.06, 0.06);
    cam.setDeadzone(36, 24);
  }

  /*
   * Phase-1 scaffolding so camera scroll is visible before the real art
   * lands: a faint dot grid and a floor line.
   */
  buildPlaceholderWorld() {
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x12203a, 1);
    for (let x = 0; x < Sea.WORLD.width; x += 120) {
      for (let y = 60; y < Sea.WORLD.height - 60; y += 90) {
        g.fillRect(x, y, 2, 2);
      }
    }
    g.fillStyle(0x1a2c4a, 1);
    g.fillRect(0, Sea.WORLD.height - 64, Sea.WORLD.width, 3);
  }

  buildSub(x, y) {
    // A physics-enabled container: the sprite rides inside so the idle bob
    // (and later the headlight cone) can move without fighting the body.
    this.subBody = this.add.container(x, y).setDepth(7);
    this.subSprite = this.add.sprite(0, 0, 'sub', 0);
    this.subBody.add(this.subSprite);

    this.physics.add.existing(this.subBody);
    const body = this.subBody.body;
    body.setSize(28, 14);
    body.setOffset(-14, -7);
    body.setCollideWorldBounds(true);
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

  update() {
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
  }
};
