'use strict';

/*
 * Headless regression tests for Abyssal Drift.
 *
 * These are development-only — the game itself has no dependencies and no
 * build step. To run them:
 *
 *   npm install --no-save playwright-core
 *   node test/regression.js
 *
 * Set CHROME to override the browser binary. Exits non-zero on failure.
 */

const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

async function main() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      });
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/`;

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: [
      '--no-sandbox',
      '--enable-unsafe-swiftshader',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.Sea && Sea.terrain && Sea._scene && Sea._scene.creatures);
  await page.evaluate(() => {
    localStorage.clear();
    Object.assign(Sea.save, Sea.defaultSave());
    Sea.photographedSet = new Set();
  });
  await page.waitForTimeout(600);

  /* -- 10: loadSave handles first run, valid saves and corruption ----- */
  const save = await page.evaluate(() => {
    const out = {};
    localStorage.removeItem(Sea.SAVE_KEY);
    let threw = false;
    const origWarn = console.warn;
    let warned = 0;
    console.warn = () => warned++;
    try {
      out.fresh = Sea.loadSave();
    } catch (e) {
      threw = true;
    }
    out.freshThrew = threw;
    out.freshWarned = warned;

    localStorage.setItem(
      Sea.SAVE_KEY,
      JSON.stringify({ depth: 2, money: 500, photographed: ['a', 'b'], salvaged: [] })
    );
    out.valid = Sea.loadSave();

    warned = 0;
    localStorage.setItem(Sea.SAVE_KEY, '{not json');
    out.corrupt = Sea.loadSave();
    out.corruptWarned = warned;

    warned = 0;
    localStorage.setItem(Sea.SAVE_KEY, '"a string"');
    out.wrongType = Sea.loadSave();
    out.wrongTypeWarned = warned;

    console.warn = origWarn;
    localStorage.clear();
    return out;
  });
  check(
    '10 loadSave: first run returns defaults without throwing or warning',
    !save.freshThrew && save.freshWarned === 0 && save.fresh.money === 0 && save.fresh.depth === 0,
    `threw=${save.freshThrew} warned=${save.freshWarned}`
  );
  check(
    '10 loadSave: reads a valid save',
    save.valid.depth === 2 && save.valid.money === 500 && save.valid.photographed.length === 2,
    `depth=${save.valid.depth} money=${save.valid.money}`
  );
  check(
    '10 loadSave: corrupt JSON falls back to defaults and warns',
    save.corrupt.money === 0 && save.corruptWarned === 1,
    `warned=${save.corruptWarned}`
  );
  check(
    '10 loadSave: non-object JSON falls back without warning',
    save.wrongType.money === 0 && save.wrongTypeWarned === 0,
    `warned=${save.wrongTypeWarned}`
  );

  /* -- 7: build-only terrain scratch is released --------------------- */
  const scratch = await page.evaluate(() => ({
    surfaces: Sea.terrain.surfaces,
    ceilings: Sea.terrain.ceilings,
    gridLen: Sea.terrain.grid.length,
    solidStillWorks: Sea.isSolid(3600, 2900) === true && Sea.isSolid(3600, 150) === false,
  }));
  check(
    '7 terrain scratch released after boot',
    scratch.surfaces === null && scratch.ceilings === null,
    `surfaces=${scratch.surfaces} ceilings=${scratch.ceilings}`
  );
  check(
    '7 collision grid still intact after release',
    scratch.gridLen === 83250 && scratch.solidStillWorks,
    `grid=${scratch.gridLen}`
  );

  /* -- 5: lighting allocates nothing per frame, still prunes --------- */
  const light = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const s = Sea._scene;
        const srcRef = s.lightSources;
        const stencilRef = s.lightStencils;
        const before = s.lightSources.length;
        let frames = 0;
        const tick = () => {
          frames++;
          if (frames < 30) return requestAnimationFrame(tick);
          resolve({
            sourcesSameArray: s.lightSources === srcRef,
            stencilsSameArray: s.lightStencils === stencilRef,
            countStable: s.lightSources.length === before,
            before,
            frames,
          });
        };
        requestAnimationFrame(tick);
      })
  );
  check(
    '5 lighting reuses its arrays across frames (no per-frame alloc)',
    light.sourcesSameArray && light.stencilsSameArray,
    `sources=${light.sourcesSameArray} stencils=${light.stencilsSameArray} over ${light.frames} frames`
  );
  check(
    '5 light count stable while nothing is destroyed',
    light.countStable,
    `${light.before} lights`
  );

  // Destroying a light's object must still drop it from the list. Use a
  // throwaway light rather than an existing one — the last registered
  // light is the submarine's own container.
  const pruned = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const s = Sea._scene;
        const baseline = s.lightSources.length;
        const victim = s.add.image(s.subBody.x, s.subBody.y, 'orb').setVisible(false);
        Sea.addLight(s, victim, 20);
        const registered = s.lightSources.length;
        victim.destroy();
        let n = 0;
        const tick = () => {
          n++;
          if (n < 5) return requestAnimationFrame(tick);
          resolve({ baseline, registered, after: s.lightSources.length });
        };
        requestAnimationFrame(tick);
      })
  );
  check(
    '5 destroyed lights are still pruned',
    pruned.registered === pruned.baseline + 1 && pruned.after === pruned.baseline,
    `${pruned.baseline} +1 = ${pruned.registered} -> ${pruned.after}`
  );

  /* -- 8: salvage list not rebuilt every frame ----------------------- */
  const salv = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const s = Sea._scene;
        const ref = s.salvage;
        let n = 0;
        const tick = () => {
          n++;
          if (n < 30) return requestAnimationFrame(tick);
          resolve({ sameArray: s.salvage === ref, dirty: s.salvageDirty, count: s.salvage.length });
        };
        requestAnimationFrame(tick);
      })
  );
  check(
    '8 salvage array reused while nothing is collected',
    salv.sameArray && salv.dirty === false,
    `same=${salv.sameArray} dirty=${salv.dirty} count=${salv.count}`
  );

  // and it does compact once a pickup completes
  const picked = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const s = Sea._scene;
        Sea.save.salvage = 2;
        const before = s.salvage.length;
        const item = s.salvage.find((i) => !i.collecting);
        s.subBody.body.reset(item.spr.x, item.spr.y - 10);
        setTimeout(
          () => resolve({ before, after: s.salvage.length, money: Sea.save.money }),
          1600
        );
      })
  );
  check(
    '8 salvage list compacts after a completed pickup',
    picked.after === picked.before - 1 && picked.money > 0,
    `${picked.before} -> ${picked.after}, earned $${picked.money}`
  );

  /* -- 6: photographed lookup uses a Set, stays in sync with the save - */
  const photo = await page.evaluate(() => {
    Sea.save.photographed = [];
    Sea.photographedSet = new Set();
    const added = Sea.markPhotographed('test-id');
    const dup = Sea.markPhotographed('test-id');
    return {
      isSet: Sea.photographedSet instanceof Set,
      added,
      dup,
      inSet: Sea.isPhotographed('test-id'),
      inArray: Sea.save.photographed.filter((v) => v === 'test-id').length,
      absent: Sea.isPhotographed('nope'),
    };
  });
  check(
    '6 photographed lookup is a Set and dedupes',
    photo.isSet && photo.added === true && photo.dup === false && photo.inArray === 1,
    `added=${photo.added} dup=${photo.dup} arrayCopies=${photo.inArray}`
  );
  check(
    '6 Set and persisted array agree',
    photo.inSet === true && photo.absent === false,
    `has=${photo.inSet} missing=${photo.absent}`
  );

  // A real capture must update both, and a reload must rebuild the Set.
  // The camera only recomputes worldView on render, so wait for it to
  // actually frame the subject before firing the shutter.
  const roundTrip = await page.evaluate(
    () =>
      new Promise((resolve) => {
        Sea.save.photographed = [];
        Sea.photographedSet = new Set();
        const s = Sea._scene;
        const c = s.creatures.find((x) => Sea.SPECIES[x.species].glows);
        const pos = () => ({
          x: c.type === 'school' ? c.x : c.spr.x,
          y: c.type === 'school' ? c.y : c.spr.y,
        });
        const p = pos();
        s.subBody.body.reset(p.x - 40, p.y);
        let n = 0;
        const tick = () => {
          n++;
          const q = pos();
          const framed = s.cameras.main.worldView.contains(q.x, q.y);
          if (!framed && n < 180) return requestAnimationFrame(tick);
          s.photoCooldown = 0;
          s.takePhoto();
          Sea.storeSave();
          const reloaded = Sea.loadSave();
          resolve({
            framed,
            waitedFrames: n,
            captured: Sea.save.photographed.length,
            setSize: Sea.photographedSet.size,
            persisted: reloaded.photographed.length,
            rebuilt: new Set(reloaded.photographed).size,
          });
        };
        requestAnimationFrame(tick);
      })
  );
  check(
    '6 capture updates Set + array, and survives a reload',
    roundTrip.captured > 0 &&
      roundTrip.setSize === roundTrip.captured &&
      roundTrip.persisted === roundTrip.captured &&
      roundTrip.rebuilt === roundTrip.captured,
    `captured=${roundTrip.captured} set=${roundTrip.setSize} persisted=${roundTrip.persisted} (framed after ${roundTrip.waitedFrames} frames)`
  );

  /* -- 3: audio depth automation is throttled ------------------------ */
  await page.keyboard.press('KeyW'); // gesture that boots the AudioContext
  await page.waitForTimeout(500);
  const audio = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const started = Sea.Audio.isStarted();
        if (!started) return resolve({ started });
        // Pause the sea scene so its own per-frame setDepth calls don't
        // race the probe.
        Sea._scene.scene.pause();
        let writes = 0;
        const orig = AudioParam.prototype.setTargetAtTime;
        AudioParam.prototype.setTargetAtTime = function (...a) {
          writes++;
          return orig.apply(this, a);
        };
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        (async () => {
          // establish a known committed depth
          await wait(400);
          Sea.Audio.setDepth(400);
          await wait(400);

          // same depth, hammered: must not write at all
          let base = writes;
          for (let i = 0; i < 200; i++) Sea.Audio.setDepth(400 + (i % 3) * 0.5);
          const sameDepthWrites = writes - base;

          // a real move, after the interval: exactly one commit (2 params)
          await wait(400);
          base = writes;
          for (let i = 0; i < 200; i++) Sea.Audio.setDepth(900);
          const movedWrites = writes - base;

          AudioParam.prototype.setTargetAtTime = orig;
          Sea._scene.scene.resume();
          resolve({ started, sameDepthWrites, movedWrites });
        })();
      })
  );
  if (!audio.started) {
    check('3 audio: context started (required for the throttle tests)', false, 'AudioContext never started');
  } else {
    check(
      '3 audio: 200 same-depth calls produce zero param writes',
      audio.sameDepthWrites === 0,
      `${audio.sameDepthWrites} writes`
    );
    check(
      '3 audio: 200 calls after a real depth change commit exactly once',
      audio.movedWrites === 2,
      `${audio.movedWrites} writes (2 params = 1 commit)`
    );
  }

  // and over real gameplay it must not be per-frame
  const perFrame = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let writes = 0;
        const orig = AudioParam.prototype.setTargetAtTime;
        AudioParam.prototype.setTargetAtTime = function (...a) {
          writes++;
          return orig.apply(this, a);
        };
        let frames = 0;
        const t0 = performance.now();
        const tick = () => {
          frames++;
          if (performance.now() - t0 < 3000) return requestAnimationFrame(tick);
          AudioParam.prototype.setTargetAtTime = orig;
          resolve({ writes, frames });
        };
        requestAnimationFrame(tick);
      })
  );
  check(
    '3 audio: param writes stay well under one-per-frame while diving',
    perFrame.writes < perFrame.frames / 2,
    `${perFrame.writes} writes over ${perFrame.frames} frames`
  );

  /* -- hull: capacity scales with the hull upgrade -------------------- */
  const hullTiers = await page.evaluate(() => {
    const tiers = Sea.UPGRADES.depth.tiers.map((t) => t.hp);
    const before = { depth: Sea.save.depth, hull: Sea.save.hull };
    Sea.save.depth = 0;
    Sea.save.hull = 10;
    Sea.buyUpgrade('depth'); // upgrading refits the hull
    const afterBuy = { depth: Sea.save.depth, hull: Sea.save.hull, max: Sea.hullMax() };
    Sea.save.depth = before.depth;
    Sea.save.hull = Sea.hullMax();
    return { tiers, afterBuy };
  });
  check(
    'hull: capacity rises with each hull tier',
    hullTiers.tiers.length === 4 &&
      hullTiers.tiers.every((hp, i) => i === 0 || hp > hullTiers.tiers[i - 1]),
    hullTiers.tiers.join(' -> ')
  );
  check(
    'hull: buying a hull upgrade refits to the new full capacity',
    hullTiers.afterBuy.hull === hullTiers.afterBuy.max && hullTiers.afterBuy.depth === 1,
    `hull=${hullTiers.afterBuy.hull}/${hullTiers.afterBuy.max}`
  );

  /* -- hull: damage scales with impact speed -------------------------- */
  const dmg = await page.evaluate(() => {
    const at = (s) => Sea.impactDamage(s);
    return {
      free: [0, 20, 45].map(at),
      curve: [60, 90, 120, 150, 190].map(at),
      clamped: at(400),
      max: at(190),
    };
  });
  check(
    'hull: contact at or below the free speed costs nothing',
    dmg.free.every((d) => d === 0),
    `speeds 0/20/45 -> ${dmg.free.join('/')}`
  );
  check(
    'hull: damage increases monotonically with speed',
    dmg.curve.every((d, i) => i === 0 || d > dmg.curve[i - 1]),
    `60/90/120/150/190 -> ${dmg.curve.join('/')}`
  );
  check(
    'hull: damage is clamped above the top speed',
    dmg.clamped === dmg.max,
    `400 -> ${dmg.clamped}, 190 -> ${dmg.max}`
  );

  /* -- hull: a real collision damages, recoils and repairs ------------ */
  const crash = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const s = Sea._scene;
        Sea.save.depth = 3;
        Sea.save.hull = Sea.hullMax();
        s.subBody.body.reset(3600, Sea.SURFACE_Y + 930 * Sea.PX_PER_M);
        const before = Sea.save.hull;
        let n = 0;
        let sawHit = false;
        let recoiled = false;
        let squashed = false;
        const tick = () => {
          const b = s.subBody.body;
          if (b.blocked.down) {
            sawHit = true;
            if (b.velocity.y < 0) recoiled = true; // kicked back off the floor
          }
          if (Math.abs(s.subSprite.scaleX - 1) > 0.01) squashed = true;
          n++;
          if (n < 400) {
            s.keys.S.isDown = true;
            return requestAnimationFrame(tick);
          }
          s.keys.S.isDown = false;
          resolve({
            before,
            after: Sea.save.hull,
            sawHit,
            recoiled,
            squashed,
            restoredScale: Math.abs(s.subSprite.scaleX - 1) < 0.01,
          });
        };
        requestAnimationFrame(tick);
      })
  );
  check(
    'hull: hitting terrain at speed costs integrity',
    crash.sawHit && crash.after < crash.before,
    `${crash.before} -> ${crash.after}`
  );
  check(
    'hull: the boat recoils off the surface and squashes on impact',
    crash.recoiled && crash.squashed && crash.restoredScale,
    `recoil=${crash.recoiled} squash=${crash.squashed} scaleRestored=${crash.restoredScale}`
  );

  const repaired = await page.evaluate(() => {
    const s = Sea._scene;
    Sea.save.hull = 5;
    const damaged = Sea.save.hull;
    s.subBody.body.reset(Sea.stationDock.x, Sea.stationDock.y);
    s.dock();
    const out = { damaged, afterDock: Sea.save.hull, max: Sea.hullMax() };
    s.scene.get('ui').undock();
    return out;
  });
  check(
    'hull: docking repairs to full',
    repaired.afterDock === repaired.max && repaired.damaged === 5,
    `${repaired.damaged} -> ${repaired.afterDock}/${repaired.max}`
  );

  const persisted = await page.evaluate(() => {
    Sea.save.depth = 2;
    Sea.save.hull = 77;
    Sea.storeSave();
    const back = Sea.loadSave();
    // a hull value above the fitted tier's capacity must clamp down
    Sea.save.hull = 9999;
    Sea.storeSave();
    const clamped = Sea.loadSave();
    return { round: back.hull, clamped: clamped.hull, max: Sea.UPGRADES.depth.tiers[2].hp };
  });
  check(
    'hull: integrity persists and clamps to the fitted capacity',
    persisted.round === 77 && persisted.clamped === persisted.max,
    `roundtrip=${persisted.round}, clamped=${persisted.clamped}/${persisted.max}`
  );

  /* -- smoothness: no camera deadzone, sub-pixel rendering ------------ */
  const smooth = await page.evaluate(() => {
    const cam = Sea._scene.cameras.main;
    const g = Sea._scene.game;
    return {
      deadzone: !!cam.deadzone,
      roundPixels: g.config.roundPixels,
      antialias: g.config.antialias,
      lerp: cam.lerp.x,
    };
  });
  check(
    'motion: camera follows continuously with no deadzone to stall on',
    smooth.deadzone === false && smooth.lerp > 0,
    `deadzone=${smooth.deadzone} lerp=${smooth.lerp}`
  );
  check(
    'motion: sub-pixel positions allowed, textures still nearest-neighbour',
    smooth.roundPixels === false && smooth.antialias === false,
    `roundPixels=${smooth.roundPixels} antialias=${smooth.antialias}`
  );

  // measured: screen offset per unit of world travel should barely vary
  const glide = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const s = Sea._scene;
        Sea.save.hull = Sea.hullMax(); // no emergency buoyancy skewing it
        // Run in the open water above 100 m so nothing is hit mid-measure.
        s.subBody.body.reset(1000, Sea.SURFACE_Y + 60 * Sea.PX_PER_M);
        s.keys.D.isDown = true;
        const cam = s.cameras.main;
        // Let the camera converge and the boat reach terminal speed first:
        // this measures steady-state gliding, not the settle transient.
        let warm = 0;
        const warmUp = () => {
          warm++;
          if (warm < 90) return requestAnimationFrame(warmUp);
          sample();
        };
        const sample = () => {
          const pts = [];
          let n = 0;
          const tick = () => {
            pts.push([s.subBody.x, (s.subBody.x - cam.worldView.x) * cam.zoom]);
            n++;
            if (n < 120) return requestAnimationFrame(tick);
            s.keys.D.isDown = false;
            const rates = [];
            for (let i = 1; i < pts.length; i++) {
              const dw = pts[i][0] - pts[i - 1][0];
              if (dw > 0.5) rates.push((pts[i][1] - pts[i - 1][1]) / dw);
            }
            const m = rates.reduce((a, b) => a + b, 0) / rates.length;
            const sd = Math.sqrt(
              rates.reduce((a, b) => a + (b - m) ** 2, 0) / rates.length
            );
            resolve({ samples: rates.length, sd: +sd.toFixed(2) });
          };
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(warmUp);
      })
  );
  check(
    'motion: screen position tracks world travel smoothly',
    glide.samples > 40 && glide.sd < 4,
    `variation SD ${glide.sd} over ${glide.samples} samples (was ~11.8 with a deadzone)`
  );

  /* -- overall: no runtime errors ------------------------------------ */
  check('no console/page errors during the run', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
