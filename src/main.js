'use strict';

/*
 * Abyssal Drift — boot config.
 * Renders at 480x270 (16-bit-era proportions) and scales up with crisp
 * pixels to whatever window it's given.
 */

new Phaser.Game({
  type: Phaser.AUTO,
  width: 480,
  height: 270,
  backgroundColor: '#04060f',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: 2,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 } },
  },
  scene: [Sea.SceneMain, Sea.SceneUI],
});
