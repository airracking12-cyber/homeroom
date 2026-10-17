// The new intro: five screens, skippable at any point, resumable, and ending in the credits.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STEPS, HANDS_ON, CREDIT, start, reduce, stepName, loadSaved, save, introNeeded } from "../src/app/intro/machine.js";

const read = (p) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), size: () => m.size }; };
const run = (s, ...events) => events.reduce((x, type) => reduce(x, typeof type === "string" ? { type } : type), s);

test("welcome, three hands-on steps, then the credits last", () => {
  assert.deepEqual(STEPS, ["welcome", "track", "review", "prepare", "credits"]);
  assert.deepEqual(HANDS_ON, ["track", "review", "prepare"]);
  assert.equal(STEPS.at(-1), "credits");
});

test("it walks forward one screen at a time and finishes after the credits", () => {
  let s = start();
  const seen = [stepName(s)];
  while (s.open) { s = reduce(s, { type: "NEXT" }); if (s.open) seen.push(stepName(s)); }
  assert.deepEqual(seen, STEPS);
  assert.equal(s.finished, true);
  assert.equal(s.skipped, false);
});

test("it can be skipped from every screen", () => {
  for (let i = 0; i < STEPS.length; i++) {
    const s = run(start({ step: i }), "SKIP");
    assert.equal(s.open, false, `skipped at ${STEPS[i]}`);
    assert.equal(s.skipped, true);
  }
});

test("back goes back, but never before the start", () => {
  assert.equal(run(start({ step: 3 }), "BACK").step, 2);
  assert.equal(run(start(), "BACK", "BACK").step, 0);
});

test("a closed intro ignores everything, and unknown events do nothing", () => {
  const done = run(start(), "SKIP");
  assert.deepEqual(reduce(done, { type: "NEXT" }), done);
  assert.deepEqual(reduce(start(), { type: "WHAT" }), start());
});

test("the 'set up my plan' hand-off finishes the intro", () => {
  const s = run(start({ step: 3 }), "DONE");
  assert.equal(s.open, false); assert.equal(s.finished, true);
});

test("it resumes where it stopped, and bad saved data starts over", () => {
  const st = memory();
  save("mika", run(start(), "NEXT", "NEXT"), st);
  assert.equal(loadSaved("mika", st).step, 2);
  assert.equal(start(loadSaved("mika", st)).step, 2);
  assert.equal(loadSaved("someone-else", st), null, "one person's place is not another's");
  st.setItem("hr:intro:x", "{not json"); assert.equal(loadSaved("x", st), null);
  st.setItem("hr:intro:y", JSON.stringify({ step: 99 })); assert.equal(loadSaved("y", st).step, STEPS.length - 1);
  assert.equal(start({ step: -4 }).step, 0);
});

test("finishing or skipping clears the saved place", () => {
  const st = memory();
  save("mika", start({ step: 2 }), st); assert.equal(st.size(), 1);
  save("mika", run(start({ step: 2 }), "SKIP"), st); assert.equal(st.size(), 0);
});

test("only an account that began the intro and did not finish it is sent back in", () => {
  assert.equal(introNeeded(false), true);
  for (const f of [true, null, undefined]) assert.equal(introNeeded(f), false);
});

test("the credits say exactly what was asked for, and credit nobody else", () => {
  assert.equal(CREDIT.name, "Nathaniel Visaya");
  assert.equal(CREDIT.short, "Nathan");
  assert.match(CREDIT.headline, /designed, built and maintained by one person/i);
  for (const piece of ["shared class tracker", "review tools", "long-term exam prep"]) assert.ok(CREDIT.built.includes(piece), piece);
  assert.match(CREDIT.thanks, /thank you/i);
  assert.match(CREDIT.thanks, /students/i);
  // any capitalised word that is not the start of a sentence must be the name or the app's name
  for (const v of Object.values(CREDIT)) {
    const mid = v.replace(/(^|[.!?]\s+)[A-Z][a-z]*/g, "$1");
    for (const w of mid.match(/\b[A-Z][a-z]+\b/g) || []) assert.ok(["Nathaniel", "Visaya", "Nathan", "Homeroom"].includes(w), `unexpected name-like word "${w}" in: ${v}`);
  }
});

test("the credit shows in all three places: the intro's last screen, Settings > About, and the sign-in screen", () => {
  const intro = read("app/intro/Intro.jsx"), settings = read("app/settings/Settings.jsx"), auth = read("app/auth.jsx");
  assert.match(intro, /name === "credits" && <Credits/);
  assert.match(intro, /CREDIT\.name/); assert.match(intro, /CREDIT\.short/); assert.match(intro, /CREDIT\.built/); assert.match(intro, /CREDIT\.thanks/);
  assert.match(settings, /Nathaniel Visaya/); assert.match(settings, /aria-label="About Homeroom"/);
  assert.match(auth, /Made by Nathaniel Visaya/);
});

test("the intro's name switches to 'Nathan' where space is tight", () => {
  const css = read("styles/screens-settings.css");
  assert.match(css, /\.name-short \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 339px\) \{ \.name-long \{ display: none; \} \.name-short \{ display: inline; \} \}/);
});

test("every screen has a skip, the hands-on steps do real things, and the old plane intro is gone", () => {
  const intro = read("app/intro/Intro.jsx");
  assert.match(intro, /Skip intro/);
  assert.match(intro, /\{!isLast\(s\) && /, "skip is shown on every screen before the credits (which end with a button)");
  assert.match(intro, /d\.addTask\(t\)/, "step one adds a real task");
  assert.match(intro, /d\.addNote\(/, "step two saves real notes");
  assert.match(intro, /go\("prepare", "new", kind\)/, "step three opens the real plan setup");
  for (const gone of ["PlaneFlight", "Stamp", "BoxGate", "unbox", "boarding"]) assert.ok(!intro.includes(gone), gone);
});

test("settings can replay it, and the account flag is still written when it ends", () => {
  assert.match(read("app/settings/Settings.jsx"), /Play the introduction/);
  const app = read("App.jsx");
  assert.match(app, /onReplayIntro=\{\(\) => setIntroOpen\(true\)\}/);
  assert.match(app, /writeOnboardingFlag\(supabase, true\)/);
  assert.match(app, /writeOnboardingFlag\(supabase, false\)/);
});

test("reduced motion shows every line at once, with no staggered wait", () => {
  const base = read("styles/base.css");
  assert.match(base, /prefers-reduced-motion: reduce[\s\S]*animation-delay: 0s !important/);
});
