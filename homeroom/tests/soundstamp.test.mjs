import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BANK } from "../src/lib/sound.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("every literal sound name the app plays has a file in the bank", () => {
  const code = read("src/App.jsx") + read("src/onboarding/Onboarding.jsx") + read("src/onboarding/PlaneFlight.jsx");
  const names = new Set([...code.matchAll(/(?:Sound\.play|\bplay)\(\s*"([A-Za-z]+)"\s*\)/g)].map((m) => m[1]));
  assert.ok(names.size >= 10, "found the names the app plays");
  for (const n of names) assert.ok(BANK[n] && BANK[n].length, `"${n}" is played but not in BANK`);
});

test("the app uses the shared sound player, not a second synthesizer of its own", () => {
  const app = read("src/App.jsx");
  assert.match(app, /import \{ Sound \} from "\.\/lib\/sound\.js"/);
  assert.doesNotMatch(app, /const Sound = /);
  assert.doesNotMatch(app, /createOscillator|new AudioContext|webkitAudioContext/);
});

test("the ticket uses the new stamp, and its sound and ink are timed from the same moments", () => {
  const ob = read("src/onboarding/Onboarding.jsx");
  assert.match(ob, /from "\.\/Stamp\.jsx"/);
  for (const piece of ["Impression", "StampButton", "StampShadow", "useStampPose", "TIMING"]) assert.ok(ob.includes(piece), piece);
  assert.ok(ob.includes("TIMING.contact * 1000"), "the stamp sound is timed to contact");
  assert.ok(ob.includes("TIMING.lift * 1000"), "the peel sound is timed to the lift");
  assert.doesNotMatch(ob, /obStampTool|function StampTool|function Ink\b/, "the old stamp pieces are gone");
});

test("the Check in button stays: the stamp is a shortcut to it, never the only way and never dead", () => {
  const ob = read("src/onboarding/Onboarding.jsx");
  const st = read("src/onboarding/Stamp.jsx");
  assert.ok(ob.includes('className="obGo"'), "Check in button");
  assert.ok(ob.includes("point(missing)"), "an incomplete form is pointed at, not ignored");
  assert.match(st, /const disabled = busy \|\| inked;/, "the stamp is only disabled while busy or done");
  assert.ok(st.includes("tabIndex={-1}"), "the stamp is out of the tab order (the button is the keyboard route)");
});

test("the stamp and sound folders are cached for a year, and the old rule for /assets is untouched", () => {
  const h = read("public/_headers");
  assert.match(h, /\/sounds\/v2\/\*\s+Cache-Control: public, max-age=31536000, immutable/);
  assert.match(h, /\/stamp\/v2\/\*\s+Cache-Control: public, max-age=31536000, immutable/);
  assert.ok(h.includes("Content-Security-Policy-Report-Only"));
});
