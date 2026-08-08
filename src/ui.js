'use strict';

/*
 * Persistent equipment + the HUD/UI scene: depth gauge, minimap, station
 * guide arrow, pause overlay, and the station equipment menu. Runs in
 * parallel with the sea scene so it stays interactive while the sea is
 * paused (docked or paused).
 */

window.Sea = window.Sea || {};

/* ------------------------------------------------------------------ */
/* Equipment & persistence                                            */
/* ------------------------------------------------------------------ */

Sea.UPGRADES = {
  depth: {
    name: 'HULL',
    tiers: [
      { label: 'Rated 150 m', rating: 150 },
      { label: 'Rated 300 m', rating: 300 },
      { label: 'Rated 600 m', rating: 600 },
      { label: 'Rated 1000 m', rating: 1000 },
    ],
  },
  lights: {
    name: 'LIGHTS',
    tiers: [
      { label: 'Standard lamp', cone: 1, haloA: 0.16, haloS: 2.4 },
      { label: 'Wide beam', cone: 1.45, haloA: 0.2, haloS: 3.0 },
      { label: 'Long-throw beam', cone: 1.95, haloA: 0.25, haloS: 3.8 },
      { label: 'Floodlights', cone: 2.5, haloA: 0.32, haloS: 4.8 },
    ],
  },
  sonar: {
    name: 'SONAR',
    tiers: [
      { label: 'Not fitted', range: 0 },
      { label: 'Passive array', range: 800 },
      { label: 'Broadband array', range: 1700 },
      { label: 'Active ping', range: 2600, ping: true },
    ],
  },
  minimap: {
    name: 'MINIMAP',
    tiers: [
      { label: 'Local chart', window: 1700 },
      { label: 'Regional chart', window: 4000 },
      { label: 'Full survey', window: 0 },
    ],
  },
  salvage: {
    name: 'SALVAGE',
    tiers: [
      { label: 'Not fitted', radius: 0 },
      { label: 'Salvage winch', radius: 48 },
      { label: 'Mag-grapple', radius: 95 },
    ],
  },
};

Sea.SAVE_KEY = 'abyssal-drift-save-v1';

Sea.defaultSave = () => ({
  depth: 0,
  lights: 0,
  sonar: 0,
  minimap: 0,
  salvage: 0,
  money: 0,
  muted: false,
  photographed: [],
  salvaged: [],
});

Sea.loadSave = function () {
  const save = Sea.defaultSave();
  try {
    const raw = JSON.parse(localStorage.getItem(Sea.SAVE_KEY));
    for (const key of Object.keys(Sea.UPGRADES)) {
      const max = Sea.UPGRADES[key].tiers.length - 1;
      if (Number.isInteger(raw[key])) {
        save[key] = Phaser.Math.Clamp(raw[key], 0, max);
      }
    }
    if (Number.isFinite(raw.money) && raw.money >= 0) {
      save.money = Math.floor(raw.money);
    }
    save.muted = !!raw.muted;
    for (const listKey of ['photographed', 'salvaged']) {
      if (Array.isArray(raw[listKey])) {
        save[listKey] = raw[listKey].filter((v) => typeof v === 'string');
      }
    }
  } catch (e) {
    /* fresh save */
  }
  return save;
};

/*
 * Award money: bump the persistent total and float a "+$n label" popup in
 * the world at (x, y).
 */
Sea.addMoney = function (scene, value, label, x, y) {
  Sea.save.money += value;
  Sea.storeSave();
  const big = value >= 1000;
  const popup = scene.add
    .text(x, y, '+$' + value + '  ' + label, {
      fontFamily: 'monospace',
      fontSize: big ? '12px' : '8px',
      color: big ? '#ffd24a' : '#ffe8a0',
    })
    .setOrigin(0.5, 1)
    .setDepth(Sea.DEPTH.fore + 1);
  scene.tweens.add({
    targets: popup,
    y: y - 22,
    alpha: { from: 1, to: 0 },
    duration: big ? 2600 : 1500,
    ease: 'Sine.easeOut',
    onComplete: () => popup.destroy(),
  });
};

Sea.storeSave = function () {
  try {
    localStorage.setItem(Sea.SAVE_KEY, JSON.stringify(Sea.save));
  } catch (e) {
    /* private mode etc. — play on without persistence */
  }
};

Sea.tierDef = (key) => Sea.UPGRADES[key].tiers[Sea.save[key]];

Sea.save = Sea.loadSave();

Sea.applyUpgrades = function (sea) {
  const lights = Sea.tierDef('lights');
  sea.coneScale = lights.cone;
  sea.subHalo.setAlpha(lights.haloA).setScale(lights.haloS);
};

Sea.buyUpgrade = function (key) {
  const max = Sea.UPGRADES[key].tiers.length - 1;
  if (Sea.save[key] >= max) return false;
  Sea.save[key] += 1;
  Sea.storeSave();
  if (Sea._scene) Sea.applyUpgrades(Sea._scene);
  Sea.Audio.install();
  return true;
};

/* ------------------------------------------------------------------ */
/* HUD / UI scene                                                     */
/* ------------------------------------------------------------------ */

Sea.SceneUI = class extends Phaser.Scene {
  constructor() {
    super('ui');
  }

  create() {
    this.sea = this.scene.get('sea');
    const W = this.scale.gameSize.width; // 480
    const H = this.scale.gameSize.height; // 270

    Sea.pixelTexture(
      this,
      'hudArrow',
      [
        [
          '..O........',
          '..OO.......',
          '..OAO......',
          '..OAAO.....',
          '..OAAAO....',
          '..OAAAAO...',
          '..OAAAO....',
          '..OAAO.....',
          '..OAO......',
          '..OO.......',
          '..O........',
        ],
      ],
      { O: '#0d1120', A: '#ffd878' }
    );
    Sea.pixelTexture(this, 'blip', [['XX', 'XX']], { X: '#ffffff' });

    this.buildGauge(W, H);
    this.buildMinimap(W, H);
    this.buildMoney(W);
    this.buildArrow();
    this.buildPrompt(W, H);
    this.buildPauseOverlay(W, H);
    this.buildMenu(W, H);

    // photo flash overlay
    this.flash = this.add
      .rectangle(0, 0, W, H, 0xffffff)
      .setOrigin(0)
      .setAlpha(0)
      .setDepth(9);

    this.keys = this.input.keyboard.addKeys('P,ESC,M');
    this.menuOpen = false;
  }

  photoFlash() {
    this.flash.setAlpha(0.55);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 220 });
  }

  buildMoney(W) {
    this.shownMoney = Sea.save.money;
    this.moneyText = this.add
      .text(W - 8, 9, '$ 0', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffd24a',
      })
      .setOrigin(1, 0)
      .setDepth(6);
    this.moneyLabel = this.add
      .text(W - 8, 22, 'earned', {
        fontFamily: 'monospace',
        fontSize: '6px',
        color: '#8a7434',
      })
      .setOrigin(1, 0)
      .setDepth(6);
  }

  /* ---------------- depth gauge ---------------- */

  buildGauge(W, H) {
    const x = 464;
    this.gaugeTop = 80;
    this.gaugeH = 150;
    this.add
      .rectangle(x, this.gaugeTop, 3, this.gaugeH, 0x1c2f4e)
      .setOrigin(0, 0)
      .setAlpha(0.9);
    for (let m = 0; m <= 1000; m += 100) {
      const y = this.gaugeTop + (m / 1000) * this.gaugeH;
      const major = m % 500 === 0;
      this.add
        .rectangle(x - (major ? 4 : 2), y, major ? 7 : 5, 1, 0x2a4266)
        .setOrigin(0, 0.5);
      if (major) {
        this.add
          .text(x - 6, y, String(m), {
            fontFamily: 'monospace',
            fontSize: '7px',
            color: '#5f7fa8',
          })
          .setOrigin(1, 0.5);
      }
    }
    this.ratingMark = this.add
      .rectangle(x - 3, this.gaugeTop, 9, 2, 0xd86a5a)
      .setOrigin(0, 0.5);
    this.depthMark = this.add
      .rectangle(x - 3, this.gaugeTop, 9, 3, 0xffd878)
      .setOrigin(0, 0.5);
    this.depthText = this.add
      .text(470, this.gaugeTop + this.gaugeH + 10, '0 m', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#ffd878',
      })
      .setOrigin(1, 0.5);
  }

  /* ---------------- minimap ---------------- */

  buildMinimap(W, H) {
    this.mapBox = { x: 8, y: H - 58 - 8, w: 124, h: 58 };
    const b = this.mapBox;
    this.add
      .rectangle(b.x - 2, b.y - 2, b.w + 4, b.h + 4, 0x050b16, 0.88)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x2a4a6a);
    this.mapImg = this.add.image(b.x, b.y, 'minimapTex').setOrigin(0, 0);
    const maskG = this.make.graphics();
    maskG.fillRect(b.x, b.y, b.w, b.h);
    this.mapImg.setMask(maskG.createGeometryMask());

    // blip pool: 0 = sub, 1 = station, rest = sonar contacts
    this.blips = [];
    for (let i = 0; i < 44; i++) {
      this.blips.push(
        this.add.image(0, 0, 'blip').setVisible(false).setDepth(5)
      );
    }
  }

  updateMinimap(time) {
    const sea = this.sea;
    const b = this.mapBox;
    const t = Sea.terrain;
    const tier = Sea.tierDef('minimap');
    const toMap = 1 / Sea.TILE;

    let s;
    let cropX;
    let cropY;
    let cropW;
    let cropH;
    if (tier.window === 0) {
      s = Math.min(b.w / t.cols, b.h / t.rows);
      cropX = 0;
      cropY = 0;
      cropW = t.cols;
      cropH = t.rows;
    } else {
      cropW = (tier.window * toMap) | 0;
      cropH = Math.round((b.h / b.w) * cropW);
      s = b.w / cropW;
      cropX = Phaser.Math.Clamp(
        sea.subBody.x * toMap - cropW / 2,
        0,
        t.cols - cropW
      );
      cropY = Phaser.Math.Clamp(
        sea.subBody.y * toMap - cropH / 2,
        0,
        t.rows - cropH
      );
    }
    this.mapImg.setScale(s);
    this.mapImg.setCrop(cropX, cropY, cropW, cropH);
    this.mapImg.x = b.x - cropX * s + (tier.window === 0 ? (b.w - t.cols * s) / 2 : 0);
    this.mapImg.y = b.y - cropY * s + (tier.window === 0 ? (b.h - t.rows * s) / 2 : 0);

    const place = (blip, wx, wy, tint, scale, alpha) => {
      blip
        .setVisible(true)
        .setTint(tint)
        .setScale(scale)
        .setAlpha(alpha === undefined ? 1 : alpha)
        .setPosition(
          Phaser.Math.Clamp(this.mapImg.x + wx * toMap * s, b.x + 1, b.x + b.w - 1),
          Phaser.Math.Clamp(this.mapImg.y + wy * toMap * s, b.y + 1, b.y + b.h - 1)
        );
    };

    let used = 0;
    const subBlink = Math.sin(time / 160) > -0.4;
    if (subBlink) {
      place(this.blips[used], sea.subBody.x, sea.subBody.y, 0xffffff, 1);
    } else {
      this.blips[used].setVisible(false);
    }
    used++;
    place(this.blips[used++], Sea.stationDock.x, Sea.stationDock.y - 30, 0xffb84a, 1.4);

    // sonar contacts — photographed wildlife shows dimmer
    const range = Sea.tierDef('sonar').range;
    if (range > 0 && sea.creatures) {
      const tints = {
        school: 0x66e0d0,
        jelly: 0xc890f0,
        turtle: 0x7ad86a,
        meg: 0xffd24a,
      };
      for (const c of sea.creatures) {
        if (used >= this.blips.length) break;
        const cx = c.type === 'school' ? c.x : c.spr.x;
        const cy = c.type === 'school' ? c.y : c.spr.y;
        const d = Phaser.Math.Distance.Between(sea.subBody.x, sea.subBody.y, cx, cy);
        if (d > range) continue;
        const shot = Sea.save.photographed.includes(c.id);
        place(
          this.blips[used++],
          cx,
          cy,
          tints[c.type],
          c.type === 'meg' ? 1.5 : 0.8,
          shot ? 0.4 : 1
        );
      }
    }
    for (let i = used; i < this.blips.length; i++) this.blips[i].setVisible(false);
  }

  /* ---------------- station arrow / prompt / pause ---------------- */

  buildArrow() {
    this.arrow = this.add.image(0, 0, 'hudArrow').setVisible(false).setDepth(6);
  }

  buildPrompt(W, H) {
    this.prompt = this.add
      .text(W / 2, H - 34, '[E]  dock with station', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#aef4ff',
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.pauseHint = this.add
      .text(140, H - 12, 'F photo · P pause · M sound', {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#44608a',
      })
      .setOrigin(0, 0.5);
    this.salvageHintText = this.add
      .text(W / 2, H - 48, 'salvage winch required — fit one at the station', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#d8a86a',
      })
      .setOrigin(0.5)
      .setVisible(false);
  }

  buildPauseOverlay(W, H) {
    this.pauseOverlay = this.add.container(0, 0).setVisible(false).setDepth(10);
    const dim = this.add.rectangle(0, 0, W, H, 0x02040a, 0.55).setOrigin(0);
    const label = this.add
      .text(W / 2, H / 2 - 8, 'PAUSED', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#cfe8ff',
      })
      .setOrigin(0.5);
    const hint = this.add
      .text(W / 2, H / 2 + 12, 'P — resume', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#6a88a8',
      })
      .setOrigin(0.5);
    this.pauseOverlay.add([dim, label, hint]);
  }

  togglePause() {
    if (Sea.state.docked) return;
    Sea.state.paused = !Sea.state.paused;
    if (Sea.state.paused) this.scene.pause('sea');
    else this.scene.resume('sea');
    this.pauseOverlay.setVisible(Sea.state.paused);
  }

  /* ---------------- station menu ---------------- */

  buildMenu(W, H) {
    this.menu = this.add.container(0, 0).setVisible(false).setDepth(20);
    const dim = this.add.rectangle(0, 0, W, H, 0x02040a, 0.6).setOrigin(0);
    const panel = this.add
      .rectangle(W / 2, H / 2, 424, 244, 0x081226, 0.97)
      .setStrokeStyle(1, 0x2a4a6a);
    const title = this.add
      .text(W / 2, 28, 'SURFACE STATION — EQUIPMENT', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#cfe8ff',
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(W / 2, 40, 'sea trials: all upgrades free — click to install', {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#5f7fa8',
      })
      .setOrigin(0.5);
    this.menu.add([dim, panel, title, sub]);

    this.menuBalance = this.add
      .text(W / 2 + 200, 28, '', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#ffd24a',
      })
      .setOrigin(1, 0.5);
    this.menu.add(this.menuBalance);

    this.menuRows = {};
    const keys = ['depth', 'lights', 'sonar', 'minimap', 'salvage'];
    keys.forEach((key, i) => {
      const y = 54 + i * 31;
      const def = Sea.UPGRADES[key];
      const name = this.add.text(44, y, def.name, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffd878',
      });
      const fitted = this.add.text(44, y + 12, '', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#9fc0d8',
      });
      const pips = def.tiers.map((_, ti) =>
        this.add
          .rectangle(150 + ti * 10, y + 5, 6, 6, 0x1c3048)
          .setStrokeStyle(1, 0x2a4a6a)
      );
      const btnBg = this.add
        .rectangle(364, y + 9, 144, 24, 0x14304a)
        .setStrokeStyle(1, 0x2a6a8a);
      const btnText = this.add
        .text(364, y + 9, '', {
          fontFamily: 'monospace',
          fontSize: '7px',
          color: '#aef4ff',
        })
        .setOrigin(0.5);
      btnBg.on('pointerover', () => btnBg.setFillStyle(0x1d425f));
      btnBg.on('pointerout', () => btnBg.setFillStyle(0x14304a));
      btnBg.on('pointerdown', () => {
        if (Sea.buyUpgrade(key)) this.refreshMenu();
      });
      this.menu.add([name, fitted, ...pips, btnBg, btnText]);
      this.menuRows[key] = { fitted, pips, btnBg, btnText };
    });

    // undock button
    const undockBg = this.add
      .rectangle(W / 2, H - 32, 190, 22, 0x1a3a2c)
      .setStrokeStyle(1, 0x2a8a5a)
      .setInteractive({ useHandCursor: true });
    const undockText = this.add
      .text(W / 2, H - 32, 'UNDOCK & DIVE  [ESC]', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#7dffd8',
      })
      .setOrigin(0.5);
    undockBg.on('pointerover', () => undockBg.setFillStyle(0x225040));
    undockBg.on('pointerout', () => undockBg.setFillStyle(0x1a3a2c));
    undockBg.on('pointerdown', () => this.undock());

    // reset save
    const resetText = this.add
      .text(48, H - 32, 'reset save', {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#7a5050',
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    resetText.on('pointerdown', () => {
      Sea.save = Sea.defaultSave();
      Sea.storeSave();
      if (Sea._scene) Sea.applyUpgrades(Sea._scene);
      this.refreshMenu();
    });
    resetText.on('pointerover', () => resetText.setColor('#c07070'));
    resetText.on('pointerout', () => resetText.setColor('#7a5050'));

    this.menu.add([undockBg, undockText, resetText]);
  }

  refreshMenu() {
    this.menuBalance.setText('$ ' + Sea.save.money.toLocaleString());
    for (const key of Object.keys(this.menuRows)) {
      const row = this.menuRows[key];
      const def = Sea.UPGRADES[key];
      const level = Sea.save[key];
      row.fitted.setText('fitted: ' + def.tiers[level].label);
      row.pips.forEach((pip, ti) =>
        pip.setFillStyle(ti <= level ? 0x7dffd8 : 0x1c3048)
      );
      if (level >= def.tiers.length - 1) {
        row.btnText.setText('FULLY UPGRADED').setColor('#44608a');
        row.btnBg.setFillStyle(0x0c1c30).disableInteractive();
      } else {
        row.btnText
          .setText('INSTALL: ' + def.tiers[level + 1].label)
          .setColor('#aef4ff');
        row.btnBg.setFillStyle(0x14304a).setInteractive({ useHandCursor: true });
      }
    }
  }

  openMenu() {
    this.menuOpen = true;
    this.refreshMenu();
    this.menu.setVisible(true);
    this.prompt.setVisible(false);
  }

  closeMenu() {
    this.menuOpen = false;
    this.menu.setVisible(false);
  }

  undock() {
    if (!Sea.state.docked) return;
    Sea.state.docked = false;
    this.closeMenu();
    this.sea.dockCooldown = 1600;
    this.scene.resume('sea');
    this.sea.subBody.body.setVelocity(0, 42);
  }

  /* ---------------- frame update ---------------- */

  update(time) {
    const sea = this.sea;
    if (!sea.subBody || !Sea.terrain) return;

    if (Phaser.Input.Keyboard.JustDown(this.keys.P)) this.togglePause();
    if (Phaser.Input.Keyboard.JustDown(this.keys.M)) {
      const nowMuted = Sea.Audio.toggleMute();
      this.pauseHint.setText(
        'F photo · P pause · M sound' + (nowMuted ? ' (off)' : '')
      );
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      if (Sea.state.docked) this.undock();
      else if (Sea.state.paused) this.togglePause();
    }

    // running money total, counting up smoothly
    this.shownMoney += (Sea.save.money - this.shownMoney) * 0.12;
    if (Math.abs(Sea.save.money - this.shownMoney) < 1) {
      this.shownMoney = Sea.save.money;
    }
    this.moneyText.setText('$ ' + Math.round(this.shownMoney).toLocaleString());

    this.salvageHintText.setVisible(!!sea.salvageHint && !Sea.state.docked);

    // dock menu follows the docked state set by the sea scene
    if (Sea.state.docked && !this.menuOpen) this.openMenu();

    // depth gauge
    const m = Sea.depthAt(sea.subBody.y);
    this.depthMark.y = this.gaugeTop + Math.min(m / 1000, 1) * this.gaugeH;
    const rating = Sea.tierDef('depth').rating;
    this.ratingMark.y = this.gaugeTop + (rating / 1000) * this.gaugeH;
    this.depthText.setText(Math.round(m) + ' m');
    if (sea.limitHit && !Sea.state.docked) {
      const flash = Math.sin(time / 90) > 0;
      this.depthText.setColor(flash ? '#ff8a6a' : '#ffd878');
      this.ratingMark.setFillStyle(flash ? 0xff8a6a : 0xd86a5a);
    } else {
      this.depthText.setColor('#ffd878');
      this.ratingMark.setFillStyle(0xd86a5a);
    }

    this.updateMinimap(time);

    // guide arrow back to the station
    const dock = Sea.stationDock;
    const dist = Phaser.Math.Distance.Between(
      sea.subBody.x,
      sea.subBody.y,
      dock.x,
      dock.y
    );
    if (!Sea.state.docked && dist > 420) {
      const cam = sea.cameras.main;
      const sx = sea.subBody.x - cam.scrollX;
      const sy = sea.subBody.y - cam.scrollY;
      const ang = Phaser.Math.Angle.Between(
        sea.subBody.x,
        sea.subBody.y,
        dock.x,
        dock.y
      );
      this.arrow
        .setVisible(true)
        .setPosition(sx + Math.cos(ang) * 40, sy + Math.sin(ang) * 40)
        .setRotation(ang)
        .setAlpha(0.5 + 0.3 * Math.sin(time / 300));
    } else {
      this.arrow.setVisible(false);
    }

    // dock prompt
    const showPrompt = sea.canDock && !Sea.state.docked && !Sea.state.paused;
    this.prompt.setVisible(showPrompt);
    if (showPrompt) this.prompt.setAlpha(0.7 + 0.3 * Math.sin(time / 250));
  }
};
