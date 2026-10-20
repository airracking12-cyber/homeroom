// Move-In Day, the guided tour: its steps, rules and wiring, read from the real source.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STEPS, MAX_STEPS, HANDS_ON, CREDIT, start, reduce, stepOf, loadSaved, save, pickTarget, cardSide, holeFor, introNeeded, offerNeeded, offerDismissedHere, dismissOfferHere } from "../src/app/tour/machine.js";
import { APP_NAME } from "../src/lib/constants.js";

const read = (p) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), has: (k) => m.has(k) }; };
const run = (s, ...events) => events.reduce((x, type) => reduce(x, typeof type === "string" ? { type } : type), s);
const TOUR = read("app/tour/Tour.jsx");

test("at most five steps, opening with a welcome that uses the app's own name from the code", () => {
  assert.ok(STEPS.length >= 1 && STEPS.length <= MAX_STEPS && MAX_STEPS === 5);
  assert.equal(STEPS[0].id, "welcome");
  assert.ok(STEPS[0].title.includes(APP_NAME), "the welcome names the app");
  assert.match(read("lib/constants.js"), /export const APP_NAME = "Homeroom"/);
  assert.match(read("app/auth.jsx"), /\{APP_NAME\}<i/, "the wordmark uses the same name");
  assert.ok(/dorm|move-in|unpack|room/i.test(STEPS.map((s) => s.title + s.body).join(" ")), "framed as moving into a dorm");
});

test("Nathaniel's credit is at the beginning: on the welcome card, and still in Settings and sign-in", () => {
  assert.equal(CREDIT.name, "Nathaniel Visaya");
  assert.match(TOUR, /step\.id === "welcome" && <p[^>]*>\{CREDIT\.welcome\}/);
  assert.match(CREDIT.welcome, /Nathaniel Visaya/);
  assert.match(read("app/settings/Settings.jsx"), /Nathaniel Visaya/);
  assert.match(read("app/auth.jsx"), /Made by Nathaniel Visaya/);
});

test("every step after the welcome points at a real element, with a fallback, and the element exists in the app", () => {
  const sources = ["app/shell.jsx", "app/room/Room.jsx", "app/review/notes.jsx"].map(read).join("\n");
  for (const s of STEPS.slice(1)) {
    assert.ok(s.targets.length >= 2, `${s.id} has a nearby fallback target`);
    for (const t of s.targets) {
      const nav = t.startsWith("nav-") && /data-tour=\{`nav-\$\{x\.id\}`\}/.test(sources);
      assert.ok(nav || sources.includes(`data-tour="${t}"`) || sources.includes(`tour="${t}"`), `${s.id}: no element is marked data-tour=${t}`);
    }
  }
  assert.deepEqual(STEPS[0].targets, [], "the welcome is a centered card");
});

test("one step has the student add real notes, it is the last, and there is no 'tutorial complete' screen", () => {
  assert.deepEqual(HANDS_ON, ["notes"]);
  assert.equal(STEPS.at(-1).id, "notes");
  assert.ok(!STEPS.some((s) => /complete|congrat|all done|finished/i.test(s.id + s.title)));
  assert.match(TOUR, /ownNotes > baseline\.current/, "it finishes when the student's own note is saved");
  assert.match(TOUR, /Your first notes are on the shelf/);
  assert.match(TOUR, /document\.querySelector\("dialog\[open\]"\)/, "it steps aside while the Add notes sheet is open");
});

test("it walks forward, can be skipped from every step, and goes back but never before the start", () => {
  let s = start(); const seen = [stepOf(s).id];
  while (s.open) { s = reduce(s, { type: "NEXT" }); if (s.open) seen.push(stepOf(s).id); }
  assert.deepEqual(seen, STEPS.map((x) => x.id)); assert.equal(s.finished, true); assert.equal(s.skipped, false);
  for (let i = 0; i < STEPS.length; i++) { const k = run(start({ step: i }), "SKIP"); assert.equal(k.open, false); assert.equal(k.skipped, true); }
  assert.equal(run(start({ step: 3 }), "BACK").step, 2); assert.equal(run(start(), "BACK", "BACK").step, 0);
  const done = run(start(), "SKIP"); assert.deepEqual(reduce(done, { type: "NEXT" }), done);
  assert.equal(run(start({ step: STEPS.length - 1 }), "DONE").finished, true);
});

test("it resumes where it stopped, and bad saved data starts over", () => {
  const st = memory();
  save("mika", run(start(), "NEXT", "NEXT"), st);
  assert.equal(loadSaved("mika", st).step, 2); assert.equal(loadSaved("someone-else", st), null);
  save("mika", run(start(), "SKIP"), st); assert.equal(loadSaved("mika", st), null, "a closed tour leaves nothing behind");
  st.setItem("hr:tour:x", "{not json"); assert.equal(loadSaved("x", st), null);
  st.setItem("hr:tour:y", JSON.stringify({ step: 99 })); assert.equal(loadSaved("y", st).step, STEPS.length - 1);
});

test("it never points at nothing: first visible candidate, else a centered card", () => {
  assert.equal(pickTarget(["a", "b"], (id) => id === "b"), "b");
  assert.equal(pickTarget(["a", "b"], () => true), "a");
  assert.equal(pickTarget(["a", "b"], () => false), null);
  assert.equal(cardSide(null, 800), "center");
  assert.equal(cardSide({ top: 740, height: 60 }, 800), "top", "a target at the bottom puts the card at the top");
  assert.equal(cardSide({ top: 20, height: 40 }, 800), "bottom");
  assert.deepEqual(holeFor({ left: 2, top: 2, right: 50, bottom: 40 }, 390, 800), { left: 0, top: 0, width: 56, height: 46 }, "kept inside the screen");
  assert.match(TOUR, /pickTarget\(step\.targets/);
});

test("the one-time offer: shown to anyone not mid-tour who has not answered it, never forced", () => {
  assert.equal(introNeeded(false), true); assert.equal(introNeeded(true), false); assert.equal(introNeeded(undefined), false, "older accounts are left alone");
  assert.equal(offerNeeded({ flag: undefined, offered: false, dismissedHere: false }), true);
  assert.equal(offerNeeded({ flag: true, offered: false, dismissedHere: false }), true);
  assert.equal(offerNeeded({ flag: false, offered: false, dismissedHere: false }), false, "mid-tour people just continue the tour");
  assert.equal(offerNeeded({ flag: undefined, offered: true, dismissedHere: false }), false);
  assert.equal(offerNeeded({ flag: undefined, offered: false, dismissedHere: true }), false);
  const st = memory(); assert.equal(offerDismissedHere("mika", st), false); dismissOfferHere("mika", st); assert.equal(offerDismissedHere("mika", st), true); assert.equal(offerDismissedHere("ines", st), false);
  const room = read("app/room/Room.jsx"), app = read("App.jsx");
  assert.match(room, /offer\?\.open/); assert.match(room, /onClose=\{offer\.dismiss\}/); assert.match(room, /Take the tour/);
  assert.match(app, /offerNeeded\(\{ flag, offered, dismissedHere/);
});

test("skipping or finishing never alters anything: the tour only records that it is over", () => {
  for (const f of ["app/tour/Tour.jsx", "app/tour/machine.js"]) assert.ok(!/services\.js|store\.|notes\.(add|remove|update)|addNote|removeNote|addTask|deleteTask/.test(read(f)), `${f} does not touch saved data`);
  const app = read("App.jsx");
  const close = app.match(/const closeIntro = useCallback\(async \(\) => \{([^}]*)\}/)[1];
  assert.match(close, /writeOnboardingFlag\(supabase, true\)/); assert.ok(!/store\.|notes\./.test(close));
});

test("keyboard and screen-reader friendly: focus moves to each step, Esc skips, the page behind is inert, reduced motion is respected", () => {
  assert.match(TOUR, /role="dialog"/); assert.match(TOUR, /aria-labelledby="tour-h"/); assert.match(TOUR, /aria-describedby="tour-b"/);
  assert.match(TOUR, /id="tour-h" ref=\{headRef\} tabIndex=\{-1\}/);
  assert.match(TOUR, /headRef\.current\?\.focus\(/);
  assert.match(TOUR, /e\.key === "Escape"[^}]*dispatch\(\{ type: "SKIP" \}\)/);
  assert.match(TOUR, /root\.inert = st\.open && !covered && !step\.handsOn/);
  assert.match(TOUR, /createPortal/);
  assert.match(TOUR, /className="tour-card pop-in pin"/, "its entrance is the shared pop-in, which becomes a plain fade under reduced motion");
  const room = readFileSync(new URL("../src/styles/room.css", import.meta.url), "utf8");
  assert.match(room, /\.tour-ring::after \{[^}]*animation: glow/);
});

test("it is skippable at any time and replayable from the menu (Settings), and each skip works from every step", () => {
  assert.match(TOUR, /Skip tour/);
  const set = read("app/settings/Settings.jsx"); assert.match(set, /Take the Move-In Day tour/); assert.match(set, /onClick=\{onReplayIntro\}/);
  assert.match(read("App.jsx"), /onReplayIntro=\{\(\) => setIntroOpen\(true\)\}/);
});

test("under 90 seconds: five short steps, a few words each", () => {
  const words = STEPS.reduce((n, s) => n + (s.title + " " + s.body).split(/\s+/).length, 0);
  assert.ok(words <= 150, `${words} words to read in total`);
  for (const s of STEPS) assert.ok(s.body.split(/\s+/).length <= 32, `${s.id} is short`);
});

test("the room is the home screen, with every real section as a piece of furniture", () => {
  const room = read("app/room/Room.jsx");
  for (const where of ["Track", "Review", "Prepare", "Class", "Settings", "Night mode", "Ask"]) assert.ok(room.includes(`where="${where}"`), where);
  assert.match(read("app/shell.jsx"), /href="#\/room"/); assert.match(read("app/shell.jsx"), /aria-label="Night mode lamp"/);
  assert.match(read("app/shell.jsx"), /\[\["g", "h"\], "Go to your room"\]/);
});
