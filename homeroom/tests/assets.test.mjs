import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BANK, SOUND_BASE } from "../src/lib/sound.js";

const root = path.resolve(import.meta.dirname, "..");
const pub = (p) => path.join(root, "public", p);
const png = (p) => { const b = fs.readFileSync(pub(p)); assert.equal(b.subarray(1, 4).toString(), "PNG", p + " is a PNG"); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

test("every sound the player can ask for exists as a real audio file", () => {
  const dir = pub(SOUND_BASE.replace(/^\//, ""));
  const files = [...new Set(Object.values(BANK).flat()), "music"];
  for (const f of files) {
    const p = path.join(dir, f + ".mp3");
    assert.ok(fs.existsSync(p), `${f}.mp3 is missing from ${SOUND_BASE}`);
    const b = fs.readFileSync(p);
    assert.ok(b.length > 1500, `${f}.mp3 looks empty`);
    assert.ok((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || b[0] === 0xff, `${f}.mp3 does not start like an mp3`);
  }
});

test("the sound folder version in the player matches the renderer", () => {
  const py = fs.readFileSync(path.join(root, "tools", "render_sounds.py"), "utf8");
  const v = /^VERSION = "([^"]+)"/m.exec(py)[1];
  assert.equal(SOUND_BASE, `/sounds/${v}/`);
});

test("the stamp pictures exist at every density, with the right proportions", () => {
  const sizes = { 1: 120, 2: 240, 3: 360, 4: 480 };
  for (const [k, w] of Object.entries(sizes)) {
    const { w: pw, h: ph } = png(`stamp/v2/stamp-tool@${k}x.png`);
    assert.equal(pw, w);
    assert.equal(ph, Math.round(w * 220 / 200));
  }
  assert.deepEqual(png("stamp/v2/ink-wear.png"), { w: 1024, h: 1024 });
  assert.deepEqual(png("stamp/v2/paper-fiber.png"), { w: 1024, h: 1024 });
});

test("the stamp code and styles only point at files that exist", () => {
  const code = fs.readFileSync(path.join(root, "src/onboarding/Stamp.jsx"), "utf8") + fs.readFileSync(path.join(root, "src/onboarding/onboarding.css.js"), "utf8");
  assert.ok(code.includes("/stamp/v2/"));
  for (const m of code.matchAll(/\/stamp\/v2\/([A-Za-z0-9@._-]+\.png)/g)) assert.ok(fs.existsSync(pub("stamp/v2/" + m[1])), m[1] + " is referenced but missing");
});

test("the stamp's moments happen in order (contact, then lift, then gone)", () => {
  const src = fs.readFileSync(path.join(root, "src/onboarding/Stamp.jsx"), "utf8");
  const t = /TIMING = \{ contact: ([\d.]+), lift: ([\d.]+), total: ([\d.]+) \}/.exec(src);
  assert.ok(t, "TIMING found");
  const [c, l, total] = t.slice(1).map(Number);
  assert.ok(c > 0 && c < l && l < total, `${c} < ${l} < ${total}`);
  // the keyframe times must line up with the contact and lift moments
  const times = /STAMPED_TIMES = \[([^\]]+)\]/.exec(src)[1].split(",").map(Number);
  assert.ok(Math.abs(times[1] * total - c) < 0.02, "contact keyframe matches TIMING.contact");
  assert.ok(Math.abs(times[3] * total - l) < 0.03, "lift keyframe matches TIMING.lift");
});
