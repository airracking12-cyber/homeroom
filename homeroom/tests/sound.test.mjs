import test from "node:test";
import assert from "node:assert/strict";
import { createSound, BANK } from "../src/lib/sound.js";

// A stand-in for the browser's audio, recording what gets played.
function fakeAudio({ missing = [], failMusic = false } = {}) {
  const log = { sources: [], oscillators: 0, fetched: [] };
  class Param { constructor(v = 0) { this.value = v; } setValueAtTime() {} exponentialRampToValueAtTime() {} setTargetAtTime(v) { this.target = v; } cancelScheduledValues() {} }
  class Node { connect(n) { return n; } disconnect() {} }
  class AC {
    constructor() { this.currentTime = 1; this.sampleRate = 44100; this.state = "running"; this.destination = new Node(); }
    createGain() { const n = new Node(); n.gain = new Param(1); return n; }
    createBiquadFilter() { const n = new Node(); n.frequency = new Param(); return n; }
    createDynamicsCompressor() { const n = new Node(); for (const k of ["threshold", "knee", "ratio", "attack", "release"]) n[k] = new Param(); return n; }
    createOscillator() { log.oscillators++; const n = new Node(); n.frequency = new Param(); n.start = () => {}; n.stop = () => {}; return n; }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() {
      const n = new Node(); n.playbackRate = new Param(1); n.loop = false;
      n.start = () => log.sources.push({ file: n.buffer && n.buffer.file, rate: n.playbackRate.value, loop: n.loop, loopEnd: n.loopEnd, node: n });
      n.stop = () => { n.stopped = true; };
      return n;
    }
    resume() { this.state = "running"; } suspend() { this.state = "suspended"; }
  }
  class OAC { decodeAudioData(bytes, ok) { const file = new TextDecoder().decode(bytes); const b = { file, duration: file === "music.mp3" ? 80 : 1 }; if (ok) ok(b); return Promise.resolve(b); } }
  const fetch = async (url) => {
    log.fetched.push(url);
    const file = url.split("/").pop();
    if (missing.includes(file) || (failMusic && file === "music.mp3")) return { ok: false, status: 404 };
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode(file).buffer };
  };
  return { log, env: { AudioContext: AC, OfflineAudioContext: OAC, fetch, window: { console }, noAutoload: true, base: "/s/" } };
}

test("once loaded, a sound plays its recorded file (no synthesizer)", async () => {
  const { log, env } = fakeAudio();
  const s = createSound(env);
  await s.load();
  assert.equal(s.loaded(), true);
  s.play("add");
  assert.equal(log.sources.length, 1);
  assert.equal(log.sources[0].file, "add.mp3");
  assert.equal(log.oscillators, 0);
});

test("every sound the app uses has files in the bank", () => {
  for (const n of ["tap", "pop", "add", "done", "undo", "send", "err", "bell", "rip", "whoosh", "stamp", "lift", "boxOpen", "schoolbell"]) assert.ok(BANK[n] && BANK[n].length, n);
});

test("before the files arrive the old synthesized sound is used, so nothing is silent", () => {
  const { log, env } = fakeAudio();
  const s = createSound(env);
  s.play("done");
  assert.equal(log.sources.length, 0);
  assert.ok(log.oscillators > 0);
});

test("a file that fails to load: the other variants are still used, and a sound with none falls back to the synthesizer", async (t) => {
  t.mock.method(console, "warn", () => {});
  const { log, env } = fakeAudio({ missing: ["tap1.mp3", "tap2.mp3", "err.mp3"] });
  const s = createSound(env);
  await s.load();
  s.play("tap"); s.play("tap"); s.play("tap");
  assert.ok(log.sources.every((x) => x.file === "tap3.mp3"));
  const before = log.oscillators;
  s.play("err");
  assert.ok(log.oscillators > before);
});

test("variants never repeat back to back, and drift a little in pitch", async () => {
  const { log, env } = fakeAudio();
  const s = createSound(env);
  await s.load();
  for (let i = 0; i < 60; i++) s.play("tap");
  const files = log.sources.map((x) => x.file);
  for (let i = 1; i < files.length; i++) assert.notEqual(files[i], files[i - 1]);
  assert.ok(new Set(files).size === 3);
  for (const x of log.sources) assert.ok(x.rate >= 0.969 && x.rate <= 1.031, `rate ${x.rate}`);
  assert.ok(new Set(log.sources.map((x) => x.rate)).size > 10);
});

test("sound effects off means silence", async () => {
  const { log, env } = fakeAudio();
  const s = createSound(env);
  await s.load();
  s.setSfx(false);
  s.play("add"); s.play("tap");
  assert.equal(log.sources.length, 0);
  assert.equal(log.oscillators, 0);
  s.setSfx(true);
  s.play("add");
  assert.equal(log.sources.length, 1);
});

test("music plays the loop file on repeat, fades, and stops", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const { log, env } = fakeAudio();
  const s = createSound(env);
  await s.load();
  s.startMusic();
  await new Promise((r) => r.call ? setImmediate(r) : r());
  await Promise.resolve(); await Promise.resolve();
  const m = log.sources.find((x) => x.file === "music.mp3");
  assert.ok(m, "music source started");
  assert.equal(m.loop, true);
  assert.equal(m.loopEnd, 80);
  assert.equal(s.isMusic(), true);
  s.stopMusic();
  assert.equal(s.isMusic(), false);
  t.mock.timers.tick(1500);
  assert.equal(m.node.stopped, true);
});

test("if the music file can't load, the old generated music takes over", async (t) => {
  t.mock.method(console, "warn", () => {});
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const { log, env } = fakeAudio({ failMusic: true });
  const s = createSound(env);
  await s.load();
  s.startMusic();
  for (let i = 0; i < 6; i++) await Promise.resolve();
  assert.equal(s.musicFailed(), true);
  assert.ok(log.oscillators > 0);
  s.stopMusic();
  t.mock.timers.tick(2000);
});

test("no audio support at all is fine: nothing throws", () => {
  const s = createSound({ window: null, fetch: null, AudioContext: null, noAutoload: true });
  s.play("tap"); s.startMusic(); s.stopMusic(); s.setVolume(0.3); s.pause(); s.resume();
  assert.equal(s.isMusic(), false);
});
