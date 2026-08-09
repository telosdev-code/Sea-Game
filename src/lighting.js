'use strict';

/*
 * Lighting.
 *
 * The water is genuinely dark: a black layer is drawn over the world and
 * every light source erases a soft hole in it, so terrain and creatures
 * are only visible where something is actually lighting them. The layer
 * thickens with depth and reaches pure black in the abyss, which makes
 * the submarine's lamp equipment rather than decoration.
 *
 * Lights are registered as {obj, radius} pairs — any game object with a
 * world position works, so glowing plants, jellyfish, salvage glints,
 * anglerfish lures and the station's lamps all carve visibility.
 */

window.Sea = window.Sea || {};

/* Opacity of the darkness layer at a given depth in metres. */
Sea.darknessAt = function (m) {
  if (m < 30) return 0.34 + (m / 30) * 0.12; // moonlit surface
  return Phaser.Math.Clamp(0.46 + ((m - 30) / 810) * 0.54, 0, 1);
};

Sea.MASK_SIZE = 128;

Sea.makeLightTextures = function (scene) {
  const S = Sea.MASK_SIZE;

  // Radial falloff used to erase darkness around point lights. Opaque
  // core so a light truly reveals what it touches, feathered edge.
  {
    const tex = scene.textures.createCanvas('lightMask', S, S);
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.34, 'rgba(255,255,255,0.92)');
    g.addColorStop(0.62, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    tex.refresh();
  }

  // Headlight wedge, matching the visible cone's shape so the lit region
  // lines up with the beam the player sees.
  {
    const w = 170;
    const h = 120;
    const tex = scene.textures.createCanvas('coneMask', w, h);
    const ctx = tex.getContext();
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.clip();
    const g = ctx.createRadialGradient(0, h / 2, 4, 0, h / 2, w);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.78, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    tex.refresh();
  }
};

Sea.buildLighting = function (scene) {
  const cam = scene.cameras.main;
  const view = Sea.viewSize(cam);

  // Oversized by a margin so the one-frame lag between scene update and
  // camera render never exposes an unlit sliver at the screen edge.
  scene.darkMargin = 40;
  scene.darkRT = scene.add
    .renderTexture(0, 0, view.w + scene.darkMargin * 2, view.h + scene.darkMargin * 2)
    .setOrigin(0, 0)
    .setDepth(Sea.DEPTH.darkness);

  scene.lightSources = [];
  scene.lightPool = [];
  // Reused across frames so the light pass allocates nothing per frame.
  scene.lightStencils = [];
  scene.lightMatrix = new Phaser.GameObjects.Components.TransformMatrix();
  scene.lightParentMatrix = new Phaser.GameObjects.Components.TransformMatrix();
};

/*
 * Register a light. `obj` supplies the world position each frame (it may
 * move or be destroyed); `radius` is the lit radius in world pixels.
 * `follow` optionally reads radius/alpha from the object's own tweened
 * scale so breathing glows breathe their light too.
 */
Sea.addLight = function (scene, obj, radius, follow) {
  const entry = { obj, radius, follow: !!follow };
  scene.lightSources.push(entry);
  return entry;
};

Sea.updateLighting = function (scene) {
  const rt = scene.darkRT;
  if (!rt) return;
  const cam = scene.cameras.main;
  const wv = cam.worldView;
  const M = scene.darkMargin;
  const originX = wv.x - M;
  const originY = wv.y - M;
  rt.x = originX;
  rt.y = originY;

  const dark = Sea.darknessAt(Sea.depthAt(scene.subBody.y));
  rt.clear();
  if (dark <= 0.001) return;
  rt.fill(0x000000, dark);

  // Position pooled stencils, then erase them all in one pass.
  const stencils = scene.lightStencils;
  stencils.length = 0;
  let n = 0;
  const take = (key, ox, oy) => {
    let s = scene.lightPool[n];
    if (!s) {
      s = scene.make.image({ key, add: false });
      scene.lightPool[n] = s;
    } else if (s.texture.key !== key) {
      s.setTexture(key);
    }
    n++;
    s.setOrigin(ox, oy).setRotation(0).setAlpha(1);
    stencils.push(s);
    return s;
  };

  const wide = rt.width;
  const high = rt.height;

  // --- the submarine's headlight -----------------------------------
  if (scene.subCone && scene.subCone.visible) {
    const mt = scene.subCone.getWorldTransformMatrix(
      scene.lightMatrix,
      scene.lightParentMatrix
    );
    const d = mt.decomposeMatrix();
    const s = take('coneMask', 0, 0.5);
    s.setPosition(d.translateX - originX, d.translateY - originY);
    s.setRotation(d.rotation);
    s.setScale(d.scaleX, d.scaleY);
  }

  // --- point lights -------------------------------------------------
  // Walked by index and compacted in place: lights are only destroyed
  // when salvage is recovered, so rebuilding the whole array every frame
  // just to prune would allocate for nothing.
  const lights = scene.lightSources;
  for (let i = lights.length - 1; i >= 0; i--) {
    const L = lights[i];
    const o = L.obj;
    if (!o || !o.scene) {
      lights.splice(i, 1); // destroyed — drop it
      continue;
    }
    const r = L.follow ? L.radius * (o.scaleX || 1) : L.radius;
    const x = o.x - originX;
    const y = o.y - originY;
    if (x < -r || x > wide + r || y < -r || y > high + r) continue;
    const s = take('lightMask', 0.5, 0.5);
    s.setPosition(x, y);
    s.setScale((r * 2) / Sea.MASK_SIZE);
    if (L.follow && o.alpha !== undefined) {
      s.setAlpha(Phaser.Math.Clamp(0.45 + o.alpha, 0.3, 1));
    }
  }

  if (stencils.length) rt.erase(stencils);
};
