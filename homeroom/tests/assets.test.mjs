import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BANK, SOUND_BASE } from "../src/lib/sound.js";

const root = path.resolve(import.meta.dirname, "..");
const pub = (p) => path.join(root, "public", p);

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
