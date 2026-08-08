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
    Sea.makeWorldTextures(this);

    // Keep the sub inside the water column: below the surface, above the floor.
    this.physics.world.setBounds(24, 30, W.width - 48, W.height - 30 - 70);
    this.cameras.main.setBounds(0, 0, W.width, W.height);

    Sea.buildWorld(this);
    this.buildSub(200, W.height * 0.55);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT');

    const cam = this.cameras.main;
    cam.startFollow(this.subBody, false, 0.06, 0.06);
    cam.setDeadzone(36, 24);
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
    this.subCone.setScale(this.facing, 1);
    this.subCone.x = 11 * this.facing;

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

    Sea.updateWorld(this);
  }
};
