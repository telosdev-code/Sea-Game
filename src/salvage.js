'use strict';

/*
 * Salvage: lost cargo scattered on the terrain, worth money — but only a
 * sub fitted with a salvage winch can recover it. Deeper finds pay more:
 * crates in the shallows, amphorae mid-water, chests in the caves, gold
 * ingots down by the bedrock.
 */

window.Sea = window.Sea || {};

Sea.SALVAGE_TYPES = {
  crate: { name: 'cargo crate', value: 25, minM: 100, maxM: 360 },
  amphora: { name: 'amphora', value: 60, minM: 300, maxM: 620 },
  chest: { name: 'sea chest', value: 150, minM: 560, maxM: 860 },
  ingot: { name: 'gold ingots', value: 300, minM: 830, maxM: 1000 },
};

Sea.makeSalvageTextures = function (scene) {
  Sea.pixelTexture(
    scene,
    'crate',
    [
      [
        'OOOOOOOOOOOO',
        'OWwwWWwwWWwO',
        'OwOOwwOOwwOO',
        'OWwwWWwwWWwO',
        'OwwOOwwOOwwO',
        'OWwwWWwwWWwO',
        'OwOOwwOOwwOO',
        'OWwwWWwwWWwO',
        'OOOOOOOOOOOO',
      ],
    ],
    { O: '#241a10', W: '#6a5136', w: '#54402a' }
  );
  Sea.pixelTexture(
    scene,
    'amphora',
    [
      [
        '..OOOO..',
        '.OcCCcO.',
        '..OCCO..',
        '.OCCCCO.',
        'OCCcCCCO',
        'OCCCCCcO',
        'OcCCCCCO',
        'OCCcCCCO',
        '.OCCCCO.',
        '..OCCO..',
        '..OOOO..',
      ],
    ],
    { O: '#1e130c', C: '#8a5a38', c: '#a8744c' }
  );
  Sea.pixelTexture(
    scene,
    'chest',
    [
      [
        '.OOOOOOOOOOOO.',
        'OBBBBBBBBBBBBO',
        'OBbbGGGGGGbbBO',
        'OOOOOOOOOOOOOO',
        'OBbbbbGGbbbbBO',
        'OBBBBBGGBBBBBO',
        'OBbbbbGGbbbbBO',
        'OBBBBBBBBBBBBO',
        '.OOOOOOOOOOOO.',
      ],
    ],
    { O: '#160e08', B: '#4a3420', b: '#38281a', G: '#e8c04a' }
  );
  Sea.pixelTexture(
    scene,
    'ingot',
    [
      [
        '..OOOOOO..',
        '.OGGGGggO.',
        'OOOOOOOOOO',
        'OGGGGGGggO',
        'OOOOOOOOOO',
        'OGGGGGGggO',
        'OOOOOOOOOO',
      ],
    ],
    { O: '#4a3408', G: '#f0cc58', g: '#c89c30' }
  );
};

Sea.spawnSalvage = function (scene) {
  const rand = Sea.rng(0x5a17a6e);
  scene.salvage = [];
  const surfaces = Sea.terrain.surfaces;
  let id = 0;

  const counts = { crate: 9, amphora: 8, chest: 7, ingot: 6 };
  for (const type of Object.keys(counts)) {
    const def = Sea.SALVAGE_TYPES[type];
    let placed = 0;
    let guard = 0;
    while (placed < counts[type] && guard++ < 4000) {
      const s = surfaces[Math.floor(rand() * surfaces.length)];
      if (s.m < def.minM || s.m > def.maxM) continue;
      const itemId = 'sv' + id++;
      placed++;
      if (Sea.save.salvaged.includes(itemId)) continue; // already recovered
      const spr = scene.add
        .image(s.x, s.y + 2, type)
        .setOrigin(0.5, 1)
        .setDepth(Sea.DEPTH.flora + 0.2);
      // spottable glint so treasure winks in the dark
      const glint = scene.add
        .image(s.x + 2, s.y - 6, 'blipDot')
        .setDepth(Sea.DEPTH.glow)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(type === 'ingot' || type === 'chest' ? 0xffe08a : 0xbfe4ff)
        .setScale(0.8)
        .setAlpha(0);
      scene.tweens.add({
        targets: glint,
        alpha: { from: 0, to: 0.9 },
        duration: 260,
        delay: rand() * 4000,
        hold: 90,
        yoyo: true,
        repeat: -1,
        repeatDelay: 2400 + rand() * 3200,
      });
      scene.salvage.push({ id: itemId, type, spr, glint, collecting: false });
    }
  }
};

Sea.updateSalvage = function (scene) {
  const tier = Sea.tierDef('salvage');
  const sub = scene.subBody;
  scene.salvageHint = false;
  for (const item of scene.salvage) {
    if (item.collecting) continue;
    const d = Phaser.Math.Distance.Between(sub.x, sub.y, item.spr.x, item.spr.y);
    if (d > 110) continue;
    if (!tier.radius) {
      if (d < 70) scene.salvageHint = true;
      continue;
    }
    if (d > tier.radius) continue;
    item.collecting = true;
    const def = Sea.SALVAGE_TYPES[item.type];
    item.glint.destroy();
    scene.tweens.add({
      targets: item.spr,
      x: sub.x,
      y: sub.y,
      scale: 0.2,
      alpha: 0.4,
      duration: 420,
      ease: 'Sine.easeIn',
      onComplete: () => {
        item.spr.destroy();
        Sea.addMoney(scene, def.value, def.name, sub.x, sub.y - 14);
        Sea.Audio.chime();
        Sea.save.salvaged.push(item.id);
        Sea.storeSave();
      },
    });
  }
  scene.salvage = scene.salvage.filter((i) => !i.collecting || i.spr.active);
};
