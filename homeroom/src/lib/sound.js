// Homeroom's sound: soft, real-sounding effects and a calm background loop.
//
// The sounds are audio files in public/sounds/<version>/, rendered by tools/render_sounds.py (modal "mallet and glass"
// synthesis, a small room reverb, stereo spread). Here they are fetched and decoded in the background shortly after the
// page opens, then played through one gentle compressor so many sounds at once never harshly clip.
//   - Frequent sounds (tap, pop, rip) have a few variants, and never play the same one twice in a row, with a tiny random
//     pitch drift, so they don't feel mechanical.
//   - If a file can't be loaded (offline, blocked, old browser), the original synthesized sound plays instead, so the app
//     is never silent by accident.
//
// createSound(env) takes its browser pieces as a parameter so it can be tested; `Sound` at the bottom is the real one.

export const SOUND_BASE = "/sounds/v2/"; // change together with VERSION in tools/render_sounds.py

// what each sound name can play (more than one file = variants)
export const BANK = {
  tap: ["tap1", "tap2", "tap3"], pop: ["pop1", "pop2", "pop3"], rip: ["rip1", "rip2", "rip3"],
  add: ["add"], done: ["done"], undo: ["undo"], send: ["send"], err: ["err"], bell: ["bell"], whoosh: ["whoosh"],
  stamp: ["stamp"], lift: ["lift"], boxOpen: ["boxOpen"], schoolbell: ["schoolbell"],
};
// how much random pitch drift each sound gets (0.03 = up to 3% either way)
const DRIFT = { tap: 0.03, pop: 0.025, rip: 0.05, stamp: 0.015, lift: 0.03, err: 0.01 };
// quick level trims on top of the levels baked into the files (1 = as rendered)
export const TRIM = { tap: 1, pop: 1, add: 1, done: 1, undo: 1, send: 1, err: 1, bell: 1, rip: 1, whoosh: 1, stamp: 1, lift: 1, boxOpen: 1, schoolbell: 1 };

export function createSound(env = {}) {
  const win = env.window || (typeof window !== "undefined" ? window : null);
  const doFetch = env.fetch || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  const AC = env.AudioContext || (win && (win.AudioContext || win.webkitAudioContext));
  const OAC = env.OfflineAudioContext || (win && (win.OfflineAudioContext || win.webkitOfflineAudioContext));
  const base = env.base || SOUND_BASE;
  const random = env.random || Math.random;

  let ctx = null, master = null, sfxBus = null, musicBus = null, noise = null;
  let sfxOn = true, musicOn = false, vol = 0.5;
  const buffers = new Map(); // file name -> decoded audio
  let loading = null, musicLoading = null, musicBuffer = null, musicSrc = null, musicFailed = false;
  const last = {}; // the variant each sound played last
  // the original synthesized music, used only if the music file can't load
  let timer = null, step = 0, nextTime = 0;

  // ───────── loading ─────────
  const decode = (bytes) => {
    const dec = OAC ? new OAC(2, 1, 44100) : ctx;
    return new Promise((res, rej) => { const p = dec.decodeAudioData(bytes, res, rej); if (p && p.then) p.then(res, rej); });
  };
  const fetchBuffer = async (file, ext) => {
    const r = await doFetch(`${base}${file}.${ext}`);
    if (!r.ok) throw new Error(`${file} ${r.status}`);
    return decode(await r.arrayBuffer());
  };
  // all the effects, in the background. Safe to call again.
  const load = () => {
    if (loading) return loading;
    if (!doFetch || (!OAC && !AC)) return (loading = Promise.resolve(false));
    if (!OAC && !ctx) return Promise.resolve(false); // this browser can only decode with a live audio context: wait for the first tap
    const files = [...new Set(Object.values(BANK).flat())];
    loading = Promise.all(files.map((f) => fetchBuffer(f, "mp3").then((b) => buffers.set(f, b), (e) => { if (win && win.console) console.warn("[Homeroom] sound not loaded:", f, e && e.message); })))
      .then(() => true);
    return loading;
  };
  const loadMusic = () => {
    if (musicLoading) return musicLoading;
    musicLoading = fetchBuffer("music", "mp3").then((b) => { musicBuffer = b; return true; }, (e) => { musicFailed = true; if (win && win.console) console.warn("[Homeroom] music not loaded:", e && e.message); return false; });
    return musicLoading;
  };
  if (win && !env.noAutoload) setTimeout(load, 700);

  // ───────── the audio chain ─────────
  const ensure = () => {
    if (!ctx) {
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 1;
      let out = master;
      if (ctx.createDynamicsCompressor) {
        // a light compressor: stacked sounds stay clean, and quiet detail isn't squashed
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.22;
        master.connect(comp); out = comp;
      }
      out.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7000;
      musicBus.connect(lp); lp.connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
    if (!loading) load();
    return ctx;
  };

  // ───────── playing a file ─────────
  const playFile = (name, files) => {
    let i = 0;
    if (files.length > 1) i = (((last[name] ?? -1) + 1 + Math.floor(random() * (files.length - 1))) % files.length); // never the same twice in a row
    last[name] = i;
    const src = ctx.createBufferSource();
    src.buffer = buffers.get(files[i]);
    const d = DRIFT[name] || 0;
    if (d) src.playbackRate.value = 1 + (random() * 2 - 1) * d;
    const g = ctx.createGain(); g.gain.value = TRIM[name] ?? 1;
    src.connect(g); g.connect(sfxBus);
    src.start(ctx.currentTime + 0.001);
  };

  // ───────── the original synthesized sounds (fallback) ─────────
  const getNoise = () => {
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = random() * 2 - 1;
    }
    return noise;
  };
  const tone = (f, t, dur, o = {}) => {
    const { type = "sine", vol: v = 0.1, attack = 0.012, dest = sfxBus, lp } = o;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    let out = g;
    if (lp) { const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp; g.connect(fl); out = fl; }
    out.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.05);
  };
  const grain = (t, dur, v, hp, lp) => {
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
    const h = ctx.createBiquadFilter(); h.type = "highpass"; h.frequency.value = hp;
    const l = ctx.createBiquadFilter(); l.type = "lowpass"; l.frequency.value = lp;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(h); h.connect(l); l.connect(g); g.connect(sfxBus);
    src.start(t, random() * 0.5); src.stop(t + dur + 0.02);
  };
  const thud = (t, f, v) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.35, t + 0.14);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.24);
  };
  const SYNTH = {
    tap: (t) => tone(760, t, 0.05, { type: "triangle", vol: 0.035 }),
    done: (t) => { tone(523.25, t, 0.28, { vol: 0.09 }); tone(659.25, t + 0.08, 0.28, { vol: 0.09 }); tone(783.99, t + 0.16, 0.45, { vol: 0.1 }); },
    undo: (t) => tone(392, t, 0.18, { type: "triangle", vol: 0.07 }),
    add: (t) => { tone(587.33, t, 0.2, { vol: 0.08 }); tone(880, t + 0.08, 0.35, { vol: 0.08 }); },
    send: (t) => tone(698.46, t, 0.12, { type: "triangle", vol: 0.06 }),
    pop: (t) => tone(987.77, t, 0.18, { vol: 0.05 }),
    err: (t) => { tone(233, t, 0.16, { type: "triangle", vol: 0.08 }); tone(185, t + 0.12, 0.25, { type: "triangle", vol: 0.08 }); },
    bell: (t) => { tone(1318.5, t, 1.1, { vol: 0.08 }); tone(1975.5, t, 0.7, { vol: 0.03 }); tone(2637, t, 0.4, { vol: 0.015 }); },
    rip: (t) => grain(t, 0.09, 0.11, 1800 + random() * 1200, 7500),
    whoosh: (t) => grain(t, 0.26, 0.04, 500, 3200),
    stamp: (t) => { thud(t, 150, 0.22); grain(t, 0.06, 0.07, 900, 4000); },
    lift: (t) => grain(t, 0.07, 0.04, 1500, 4500),
    boxOpen: (t) => {
      grain(t, 0.4, 0.09, 300, 5000); thud(t + 0.06, 110, 0.2);
      tone(659.25, t + 0.28, 0.4, { vol: 0.07 }); tone(987.77, t + 0.36, 0.55, { vol: 0.07 }); tone(1318.5, t + 0.46, 0.8, { vol: 0.05 });
    },
    schoolbell: (t) => { [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach((d) => { tone(1568, t + d, 0.5, { vol: 0.07 }); tone(2349, t + d, 0.3, { vol: 0.025 }); }); },
  };
  // the original generative lo-fi, only used when the music file can't be loaded
  const EIGHTH = 60 / 72 / 2;
  const CHORDS = [[130.81, 164.81, 196.0, 246.94], [110.0, 130.81, 164.81, 196.0], [146.83, 174.61, 220.0, 261.63], [98.0, 123.47, 146.83, 174.61]];
  const ROOTS = [65.41, 55.0, 73.42, 49.0];
  const PENT = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
  const synthSchedule = () => {
    while (nextTime < ctx.currentTime + 1.2) {
      const bar = Math.floor(step / 8) % 4, s = step % 8;
      const t = nextTime + (s % 2 === 1 ? 0.035 : 0);
      if (s === 0) CHORDS[bar].forEach((f) => tone(f, t, EIGHTH * 8 + 0.4, { vol: 0.03, attack: 0.5, dest: musicBus, lp: 900 }));
      if (s === 0 || s === 4) tone(ROOTS[bar], t, EIGHTH * 3, { vol: 0.1, attack: 0.02, dest: musicBus });
      if (random() < 0.38) tone(PENT[Math.floor(random() * PENT.length)], t, 0.9, { type: "triangle", vol: 0.045, dest: musicBus, lp: 2000 });
      nextTime += EIGHTH; step++;
    }
  };

  // ───────── music ─────────
  const musicTarget = () => (musicOn ? vol * 0.9 : 0);
  const startLoop = () => {
    if (!musicOn || musicSrc || !ctx || !musicBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = musicBuffer; src.loop = true; src.loopStart = 0; src.loopEnd = musicBuffer.duration;
    src.connect(musicBus); src.start();
    musicSrc = src;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(musicTarget(), ctx.currentTime, 0.7); // a slow, soft fade in
  };
  const startSynth = () => {
    if (!musicOn || timer || !ctx) return;
    step = 0; nextTime = ctx.currentTime + 0.1;
    synthSchedule(); timer = setInterval(synthSchedule, 250);
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(musicTarget(), ctx.currentTime, 0.6);
  };

  return {
    play(name) {
      if (!sfxOn || !ensure()) return;
      try {
        const files = (BANK[name] || []).filter((f) => buffers.has(f)); // whichever variants loaded
        if (files.length) playFile(name, files);
        else if (SYNTH[name]) SYNTH[name](ctx.currentTime + 0.001);
      } catch (err) { if (win && win.console) console.warn("[Homeroom] non-fatal:", err); }
    },
    setSfx(v) { sfxOn = v; },
    setVolume(v) { vol = v; if (ctx && musicBus) musicBus.gain.setTargetAtTime(musicTarget(), ctx.currentTime, 0.1); },
    startMusic() {
      if (!ensure() || musicOn) return;
      musicOn = true;
      if (musicBuffer) { startLoop(); return; }
      loadMusic().then((ok) => { if (!musicOn) return; if (ok) startLoop(); else startSynth(); });
    },
    stopMusic() {
      if (!ctx || !musicOn) return;
      musicOn = false; musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      const src = musicSrc; musicSrc = null;
      if (src) setTimeout(() => { try { src.stop(); } catch { /* already stopped */ } }, 1400);
      const tm = timer; timer = null; if (tm) setTimeout(() => clearInterval(tm), 900);
    },
    isMusic: () => musicOn,
    pause() { if (ctx && musicOn && ctx.state === "running") ctx.suspend(); },
    resume() { if (ctx && musicOn && ctx.state === "suspended") ctx.resume(); },
    // for the app and the tests
    load,
    loaded: () => [...new Set(Object.values(BANK).flat())].every((f) => buffers.has(f)),
    musicFailed: () => musicFailed,
  };
}

export const Sound = createSound();
