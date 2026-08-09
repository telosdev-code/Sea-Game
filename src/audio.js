'use strict';

/*
 * Procedural ambient audio: meditative lofi built from raw WebAudio — a
 * slow gliding seventh-chord pad through a warm lowpass, a deep water
 * wash, vinyl crackle, and sparse pentatonic plinks through a feedback
 * delay. No audio files. The pad darkens as you dive.
 *
 * Browsers require a user gesture before audio starts; attach() arms
 * one-time listeners for that.
 */

window.Sea = window.Sea || {};

Sea.Audio = (function () {
  let ctx = null;
  let master = null;
  let padFilter = null;
  let padOscs = [];
  let bassOsc = null;
  let waterGain = null;
  let delayNode = null;
  let started = false;
  let muted = false;
  let chordIndex = 0;
  let chordTimer = null;
  let melodyTimer = null;

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // Fmaj7 → Am7 → Dm7 → Cmaj7, low and slow.
  const CHORDS = [
    [53, 57, 60, 64],
    [57, 60, 64, 67],
    [50, 53, 57, 60],
    [48, 52, 55, 59],
  ];

  const noiseBuffer = (seconds, fill) => {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    fill(buf.getChannelData(0));
    return buf;
  };

  const A = {};

  A.attach = function (scene) {
    muted = !!(Sea.save && Sea.save.muted);
    const kick = () => A.start();
    scene.input.keyboard.once('keydown', kick);
    scene.input.once('pointerdown', kick);
  };

  A.start = function () {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      started = false;
      return;
    }
    if (ctx.state === 'suspended') ctx.resume();

    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    // --- chord pad: four detuned triangles gliding between chords ----
    padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 820;
    padFilter.Q.value = 0.4;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.16;
    padFilter.connect(padGain);
    padGain.connect(master);

    const chord = CHORDS[0];
    for (let i = 0; i < 4; i++) {
      for (const detune of [-4, 4]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = midi(chord[i]);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 0.09;
        osc.connect(g);
        g.connect(padFilter);
        osc.start();
        padOscs.push(osc);
      }
    }

    // slow breathing on the pad
    const breathe = ctx.createOscillator();
    breathe.frequency.value = 0.05;
    const breatheGain = ctx.createGain();
    breatheGain.gain.value = 0.045;
    breathe.connect(breatheGain);
    breatheGain.connect(padGain.gain);
    breathe.start();

    // --- bass root, two octaves down ---------------------------------
    bassOsc = ctx.createOscillator();
    bassOsc.type = 'sine';
    bassOsc.frequency.value = midi(chord[0] - 24);
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.09;
    bassOsc.connect(bassGain);
    bassGain.connect(master);
    bassOsc.start();

    // --- deep water wash: brown noise through a low lowpass ----------
    const water = ctx.createBufferSource();
    water.buffer = noiseBuffer(6, (data) => {
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + (Math.random() * 2 - 1) * 0.02) * 0.995;
        data[i] = last * 3;
      }
    });
    water.loop = true;
    const waterFilter = ctx.createBiquadFilter();
    waterFilter.type = 'lowpass';
    waterFilter.frequency.value = 210;
    waterGain = ctx.createGain();
    waterGain.gain.value = 0.1;
    water.connect(waterFilter);
    waterFilter.connect(waterGain);
    waterGain.connect(master);
    water.start();

    // --- vinyl crackle ----------------------------------------------
    const crackle = ctx.createBufferSource();
    crackle.buffer = noiseBuffer(5, (data) => {
      for (let i = 0; i < data.length; i++) {
        if (Math.random() < 0.0012) {
          const amp = (Math.random() * 2 - 1) * 0.6;
          data[i] = amp;
          if (i + 1 < data.length) data[i + 1] = amp * 0.4;
        }
      }
    });
    crackle.loop = true;
    const crackleFilter = ctx.createBiquadFilter();
    crackleFilter.type = 'highpass';
    crackleFilter.frequency.value = 1600;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.16;
    crackle.connect(crackleFilter);
    crackleFilter.connect(crackleGain);
    crackleGain.connect(master);
    crackle.start();

    // --- feedback delay bus for the plinks ---------------------------
    delayNode = ctx.createDelay(1.5);
    delayNode.delayTime.value = 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.34;
    const delayOut = ctx.createGain();
    delayOut.gain.value = 0.5;
    delayNode.connect(feedback);
    feedback.connect(delayNode);
    delayNode.connect(delayOut);
    delayOut.connect(master);

    // --- schedulers --------------------------------------------------
    chordTimer = setInterval(() => {
      chordIndex = (chordIndex + 1) % CHORDS.length;
      const next = CHORDS[chordIndex];
      const t = ctx.currentTime;
      padOscs.forEach((osc, i) => {
        osc.frequency.setTargetAtTime(midi(next[i >> 1]), t, 2.8);
      });
      bassOsc.frequency.setTargetAtTime(midi(next[0] - 24), t, 3.2);
    }, 9500);

    const plink = () => {
      if (!muted) {
        const tones = CHORDS[chordIndex];
        const note = tones[Math.floor(Math.random() * tones.length)] + 12 * (Math.random() < 0.4 ? 2 : 1);
        A._pluck(midi(note), 0.05, 1.9);
      }
      melodyTimer = setTimeout(plink, 3500 + Math.random() * 6500);
    };
    melodyTimer = setTimeout(plink, 2500);
  };

  /* Soft plucked tone into the delay bus. */
  A._pluck = function (freq, vol, decay) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0004, t + decay);
    osc.connect(g);
    g.connect(master);
    g.connect(delayNode);
    osc.start(t);
    osc.stop(t + decay + 0.1);
  };

  /*
   * The pad darkens and the water thickens with depth (meters).
   *
   * Called every frame, but each write appends to the AudioParam's
   * automation timeline and the filter glides over ~1.5 s anyway — so
   * only commit when the depth has actually moved, and no more than a
   * few times a second.
   */
  let lastDepthM = null;
  let lastDepthAt = 0;
  A.DEPTH_INTERVAL = 0.25; // seconds
  A.DEPTH_EPSILON = 3; // metres

  A.setDepth = function (m) {
    if (!ctx) return;
    const t = ctx.currentTime;
    // Drift smaller than the epsilon still accumulates against the last
    // committed depth, so a slow descent does eventually update.
    const settled =
      lastDepthM !== null &&
      (Math.abs(m - lastDepthM) < A.DEPTH_EPSILON ||
        t - lastDepthAt < A.DEPTH_INTERVAL);
    if (settled) return;
    lastDepthM = m;
    lastDepthAt = t;
    const f = Phaser.Math.Clamp(m / 1000, 0, 1);
    padFilter.frequency.setTargetAtTime(850 - f * 560, t, 1.5);
    waterGain.gain.setTargetAtTime(0.1 + f * 0.08, t, 1.5);
  };

  A.toggleMute = function () {
    muted = !muted;
    Sea.save.muted = muted;
    Sea.storeSave();
    if (!started) {
      A.start(); // M itself is a gesture — let it boot the audio
      return muted;
    }
    if (master) {
      master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.15);
    }
    return muted;
  };

  A.isMuted = () => muted;

  /* True once the AudioContext exists and is producing sound. */
  A.isStarted = () => started && !!ctx;

  /* ------------------------- SFX ------------------------------------ */

  const sfxGain = (vol, t, decay) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + decay);
    g.connect(master);
    return g;
  };

  A.shutter = function () {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.06, (d) => {
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    });
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    src.connect(bp);
    bp.connect(sfxGain(0.22, t, 0.09));
    src.start(t);
  };

  A.coin = function () {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    [[1046, 0], [1568, 0.07]].forEach(([f, dt]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.connect(sfxGain(0.1, t + dt, 0.18));
      osc.start(t + dt);
      osc.stop(t + dt + 0.2);
    });
  };

  A.chime = function () {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    [523, 659, 784].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      osc.connect(sfxGain(0.09, t + i * 0.09, 0.5));
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.55);
    });
  };

  A.ping = function () {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    [0, 0.34].forEach((dt, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 760;
      osc.connect(sfxGain(i === 0 ? 0.12 : 0.05, t + dt, 0.7));
      osc.start(t + dt);
      osc.stop(t + dt + 0.75);
    });
  };

  A.install = function () {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.09);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    osc.connect(lp);
    lp.connect(sfxGain(0.14, t, 0.14));
    osc.start(t);
    osc.stop(t + 0.16);
  };

  return A;
})();
