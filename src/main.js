'use strict';

/*
 * Abyssal Drift — boot config.
 *
 * The canvas is 960x540 real pixels. The sea camera runs at zoom 2, so
 * the world still shows a 480x270 window of 16-bit-era pixel art, while
 * the HUD scene draws at zoom 1 and gets the full 960x540 to render
 * crisp text into. Sea.UI_SCALE is that factor, shared by both.
 */

Sea.UI_SCALE = 2;

new Phaser.Game({
  type: Phaser.AUTO,
  width: 480 * Sea.UI_SCALE,
  height: 270 * Sea.UI_SCALE,
  backgroundColor: '#04060f',
  // Spelled out rather than using `pixelArt: true`, which would force
  // roundPixels on. Nearest-neighbour sampling keeps the art crisp, but
  // snapping every draw to a whole pixel makes slow drift visibly step —
  // and this game is played at a drift.
  pixelArt: false,
  antialias: false,
  antialiasGL: false,
  roundPixels: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 } },
  },
  scene: [Sea.SceneMain, Sea.SceneUI],
});
