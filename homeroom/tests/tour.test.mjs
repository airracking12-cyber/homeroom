// Move-In Day, the film: its steps, rules and wiring, read from the real source.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { STEPS, MAX_STEPS, HANDS_ON, CREDIT, PHASES, PROP_COUNT, OPENING, nextPhase, landsAt, placingLength, sceneLabel, unpackedDuring, start, reduce, stepOf, ctaFor, unpackedCount, slotStates, loadSaved, save, pickTarget, cardSide, holeFor, tourNeeded, offerNeeded, offerDismissedHere, dismissOfferHere } from "../src/app/tour/machine.js";
import { APP_NAME } from "../src/lib/constants.js";

const read = (p) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");
const css = (f) => readFileSync(new URL("../src/styles/" + f, import.meta.url), "utf8");
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), has: (k) => m.has(k) }; };
const run = (s, ...events) => events.reduce((x, type) => reduce(x, typeof type === "string" ? { type } : type), s);
const TOUR = read("app/tour/Tour.jsx"), ART = read("app/tour/art.jsx"), ROOMCSS = css("room.css");
const OPEN = read("app/tour/Opening.jsx"), STAGE = read("app/tour/stage.jsx"), CINEMA = css("cinema.css");

test("at most five steps, opening with a welcome that uses the app's own name from the code", () => {
  assert.ok(STEPS.length >= 1 && STEPS.length <= MAX_STEPS && MAX_STEPS === 5);
  assert.equal(STEPS[0].id, "welcome");
  assert.ok(STEPS[0].title.includes(APP_NAME), "the welcome names the app");
  assert.match(read("lib/constants.js"), /export const APP_NAME = "Homeroom"/);
  assert.match(read("app/auth.jsx"), /\{APP_NAME\}<i/, "the wordmark uses the same name");
});

test("it is an unboxing: a moving box, a bare room, and one piece of furniture unpacked per step", () => {
  const words = STEPS.map((s) => s.title + " " + s.body + " " + (s.afterOpen || "")).join(" ").toLowerCase();
  for (const w of ["move-in", "box", "unpack", "corkboard", "bookshelf", "lamp", "shelf"]) assert.ok(words.includes(w), `mentions ${w}`);
  assert.deepEqual(STEPS.map((s) => s.item), ["box", "corkboard", "bookshelf", "lamp", "books"]);
  for (const s of STEPS) assert.ok(s.slot, `${s.id} has a slot name`);
  assert.match(STAGE, /function BoxArt\(\)/); assert.match(STAGE, /className="flap flap-l"/); assert.match(STAGE, /className="flap flap-r"/);
  assert.deepEqual([...STAGE.matchAll(/<Prop name="(\w+)"/g)].map((m) => m[1]).concat("lights").sort(), ["bookshelf", "corkboard", "lamp", "lights", "plant"], "five things come out of the box");
  assert.equal(PROP_COUNT, 5);
  assert.match(STAGE, /export const PROPS = Object\.freeze\(\["lights", "corkboard", "bookshelf", "lamp", "plant"\]\)/);
});

test("the opening is a film with a timeline: title card, bare room, tape, light, montage, then the real room", () => {
  assert.deepEqual(PHASES, ["title", "scene", "ripping", "open", "placing", "ready", "exit"]);
  assert.deepEqual(["title", "ripping", "open", "placing"].map(nextPhase), ["scene", "open", "placing", "ready"], "the timers hand over by themselves");
  for (const held of ["scene", "ready", "exit"]) assert.equal(nextPhase(held), held, `${held} waits for the person, or is the end`);
  assert.ok(landsAt(PROP_COUNT - 1) > landsAt(0) && placingLength() > landsAt(PROP_COUNT - 1), "every piece lands before the room is ready");
  assert.ok(OPENING.title >= 2500 && OPENING.title <= 5000, "the title card is a beat, not a wait");
  const total = (OPENING.rip + OPENING.open + placingLength() + OPENING.exit) / 1000;
  assert.ok(total <= 9, `opening the box to the real room takes ${total}s: it stays short`);
  assert.deepEqual([0, 1, 3, 5].map((placed) => unpackedDuring(placed, true)), [1, 2, 4, 5]); assert.equal(unpackedDuring(3, false), 0);
  assert.equal(sceneLabel(0), "Scene 1"); assert.equal(sceneLabel(4), "Scene 5");
  // every phase has something to play in the CSS, and the camera only ever moves with transform
  for (const ph of ["ripping", "open", "placing", "ready", "exit"]) assert.ok(CINEMA.includes(`data-phase="${ph}"`), `${ph} is styled`);
  assert.match(CINEMA, /\.cine-cam \{[^}]*transition: transform[^}]*opacity/s);
  assert.match(OPEN, /nextPhase\("title"\)/); assert.match(OPEN, /for \(let i = 0; i < PROP_COUNT; i\+\+\) later\(\(\) => \{ setPlaced\(i \+ 1\); Sound\.play\("pop"\)/, "every landing is a sound and a count");
});

test("the box opens with transforms only, and the pieces fly out of it with transform and opacity", () => {
  assert.match(CINEMA, /\.cine:is\([^)]*\) \.flap-l \{ transform: rotate\(-74deg\)/);
  assert.match(CINEMA, /\.flap \{[^}]*transition: transform/);
  assert.match(CINEMA, /@keyframes prop-fly \{[\s\S]*?\}\n/); assert.match(CINEMA, /\.prop \{ opacity: 0;/);
  assert.match(CINEMA, /\.cine\[data-phase="ripping"\] \.st-box \{ animation: shake/, "the box shakes as the tape tears (the shared shake)");
  assert.match(ROOMCSS + CINEMA, /\.tag-art \{[^}]*animation: unpack/);
  assert.match(CINEMA, /\.tag-note/); assert.match(TOUR, /className="tag-note stick"/, "the sticky note peels onto the corkboard");
  assert.match(CINEMA, /\.cine\[data-phase="exit"\] \{[^}]*animation: cine-out/, "the film dissolves into the real room");
  const tk = css("tokens.css"); assert.equal((tk.match(/--kraft:/g) || []).length, 3, "kraft paper exists in light, system-dark and forced-dark");
});

test("the film's colours are tokens, its text is readable on black, and the letterbox is a token", () => {
  const tk = css("tokens.css");
  const get = (n) => { const m = tk.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`)); assert.ok(m, `--${n} exists`); return m[1]; };
  const lum = (h) => { const n = parseInt(h.slice(1), 16); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const [fg, bg, min, what] of [["cine-text", "cine-0", 4.5, "subtitles"], ["cine-text-2", "cine-0", 4.5, "the credit"], ["cine-warm", "cine-0", 4.5, "the title's second line"], ["cine-text", "cine-wall", 4.5, "text over the wall"]]) assert.ok(ratio(get(fg), get(bg)) >= min, `${what} reads on the film`);
  assert.match(tk, /--cine-bar: clamp\(/, "the 2.39:1 letterbox is one token"); assert.match(tk, /max-aspect-ratio: 1\/1\) \{\s*:root \{ --cine-bar/, "phones held upright get slim bars");
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(CINEMA + STAGE + OPEN), "no raw colours in the film");
});

test("both compositions of the stage exist, so the box and every piece are in frame on any screen", () => {
  assert.match(STAGE, /export const LAYOUTS = Object\.freeze\(\{\s*wide:/); assert.match(STAGE, /\btall:/);
  assert.match(STAGE, /preserveAspectRatio="xMidYMid meet"/);
  assert.match(OPEN, /<Stage layout="wide" \/><Stage layout="tall" \/>/);
  assert.match(CINEMA, /@media \(max-aspect-ratio: 4\/5\) \{ \.stage-wide \{ display: none; \} \.stage-tall \{ display: block; \} \}/);
  assert.match(CINEMA, /\.cine \{[^}]*display: grid; grid-template-rows: minmax\(0, 1fr\) auto/, "the stage and the subtitles never overlap");
  for (const prop of ["corkboard", "bookshelf", "lamp", "plant"]) for (const name of ["wide", "tall"]) assert.ok(new RegExp(`${name}: \\{[\\s\\S]*?${prop}: \\{ c: \\[`).test(STAGE), `${prop} has a place in ${name}`);
});

test("the room is bare behind the wall and furnishes itself as the wall comes down", () => {
  assert.match(TOUR, /el\.dataset\.tourBare = "1"/);
  assert.match(ROOMCSS, /html\[data-tour-bare\] #root \.pop-in, html\[data-tour-bare\] #root \.room-obj[^{]*\{ animation-play-state: paused; \}/);
});

test("Nathaniel's credit is at the very beginning: on the title card, on the box and under it, and still in Settings and sign-in", () => {
  assert.equal(CREDIT.name, "Nathaniel Visaya");
  assert.match(CREDIT.welcome, /Nathaniel Visaya/);
  assert.match(OPEN, /<p className="caption tour-credit cine-credit">\{CREDIT\.welcome\}<\/p>/);
  assert.match(OPEN, /\{CREDIT\.name\} presents/, "the title card opens with his name");
  assert.match(STAGE, /From: Nathaniel Visaya/);
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
  assert.deepEqual(STEPS[0].targets, [], "the welcome is the box on a bare wall, nothing to point at yet");
});

test("the welcome has two beats (open the box, then start unpacking) and the count follows the unpacking", () => {
  assert.equal(ctaFor(STEPS[0], false), "Open the box"); assert.equal(ctaFor(STEPS[0], true), "Start unpacking"); assert.equal(ctaFor(STEPS[1], false), "Next");
  assert.match(OPEN, /if \(phase === "scene"\) setPhase\("ripping"\)/, "the first press opens the box");
  assert.match(OPEN, /boxOpen && phase !== "exit"\) setPhase\("exit"\)/, "the second press starts unpacking");
  assert.match(OPEN, /const label = phase === "scene" \? step\.cta : step\.ctaOpen/);
  assert.ok(STEPS[0].afterOpen && STEPS[0].afterOpen.split(/\s+/).length <= 20, "what is said once the box is open");
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => unpackedCount(i, false)), [0, 2, 3, 4, 5]);
  assert.equal(unpackedCount(0, true), 1);
  assert.deepEqual(slotStates(2, true).map((s) => s.done), [true, true, true, false, false]);
  assert.match(TOUR, /Unpacked \{unpackedCount\(st\.step, true\)\} of \{STEPS\.length\}/);
  assert.match(OPEN, /Unpacked \{count\} of \{PROP_COUNT\}/);
});

test("the last step has the student add real notes, and it ends with them on the shelf, not a 'done' screen", () => {
  assert.deepEqual(HANDS_ON, ["notes"]); assert.equal(STEPS.at(-1).id, "notes");
  assert.ok(!STEPS.some((s) => /complete|congrat|all done|finished/i.test(s.id + s.title)));
  assert.match(TOUR, /ownNotes > baseline\.current/, "it finishes when the student's own note is saved");
  assert.match(TOUR, /Welcome home, \$\{user\}\. Your first notes are on the shelf\./);
  assert.match(TOUR, /document\.querySelector\("dialog\[open\]"\)/, "it steps aside while the Add notes sheet is open");
  assert.match(TOUR, /el\.dataset\.movedIn = "1"/); assert.match(ROOMCSS, /html\[data-moved-in\] \.topbar::after \{ animation: glow/);
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
  assert.equal(pickTarget(["a", "b"], (id) => id === "b"), "b"); assert.equal(pickTarget(["a", "b"], () => true), "a"); assert.equal(pickTarget(["a", "b"], () => false), null);
  assert.equal(cardSide(null, 800), "center");
  assert.equal(cardSide({ top: 740, height: 60 }, 800), "top", "a target at the bottom puts the card at the top"); assert.equal(cardSide({ top: 20, height: 40 }, 800), "bottom");
  assert.deepEqual(holeFor({ left: 2, top: 2, right: 50, bottom: 40 }, 390, 800), { left: 0, top: 0, width: 56, height: 46 }, "kept inside the screen");
  assert.match(TOUR, /pickTarget\(step\.targets/);
});

test("the one-time offer: shown to anyone not mid-tour who has not answered it, never forced", () => {
  assert.equal(tourNeeded(false), true); assert.equal(tourNeeded(true), false); assert.equal(tourNeeded(undefined), false, "older accounts are left alone");
  assert.equal(offerNeeded({ flag: undefined, offered: false, dismissedHere: false }), true);
  assert.equal(offerNeeded({ flag: true, offered: false, dismissedHere: false }), true);
  assert.equal(offerNeeded({ flag: false, offered: false, dismissedHere: false }), false, "mid-tour people just continue the tour");
  assert.equal(offerNeeded({ flag: undefined, offered: true, dismissedHere: false }), false);
  assert.equal(offerNeeded({ flag: undefined, offered: false, dismissedHere: true }), false);
  const st = memory(); assert.equal(offerDismissedHere("mika", st), false); dismissOfferHere("mika", st); assert.equal(offerDismissedHere("mika", st), true); assert.equal(offerDismissedHere("ines", st), false);
  const room = read("app/room/Room.jsx"), app = read("App.jsx");
  assert.match(room, /offer\?\.open/); assert.match(room, /onClose=\{offer\.dismiss\}/); assert.match(room, /Want to unbox your room\?/); assert.match(room, /Start unpacking/);
  assert.match(app, /offerNeeded\(\{ flag, offered, dismissedHere/);
});

test("skipping or finishing never alters anything: the tour only records that it is over", () => {
  for (const f of ["app/tour/Tour.jsx", "app/tour/machine.js", "app/tour/art.jsx"]) assert.ok(!/services\.js|store\.|notes\.(add|remove|update)|addNote|removeNote|addTask|deleteTask/.test(read(f)), `${f} does not touch saved data`);
  const close = read("App.jsx").match(/const closeTour = useCallback\(async \(\) => \{([^}]*)\}/)[1];
  assert.match(close, /writeOnboardingFlag\(supabase, true\)/); assert.ok(!/store\.|notes\./.test(close));
});

test("keyboard and screen-reader friendly: focus moves to each step, Esc skips, the page behind is inert, reduced motion is respected", () => {
  assert.match(TOUR, /role="dialog"/); assert.match(TOUR, /aria-labelledby="tour-h"/); assert.match(TOUR, /aria-describedby="tour-b"/);
  assert.match(OPEN, /role="dialog" aria-modal="true" aria-labelledby="tour-h" aria-describedby="tour-b"/, "the opening is a dialog too");
  assert.match(TOUR, /id="tour-h" ref=\{headRef\} tabIndex=\{-1\}/); assert.match(OPEN, /id="tour-h" ref=\{headRef\} tabIndex=\{-1\}/); assert.match(TOUR, /headRef\.current\?\.focus\(/);
  assert.match(TOUR, /e\.key === "Escape"[^}]*dispatch\(\{ type: "SKIP" \}\)/);
  assert.match(TOUR, /root\.inert = st\.open && !covered && !step\.handsOn/); assert.match(TOUR, /createPortal/);
  assert.match(OPEN, /role="status">\{announce\}/); assert.match(OPEN, /"The box is open\."/, "opening the box is announced");
  for (const a of ['className="cine-cam" aria-hidden="true"', 'className="cine-vignette" aria-hidden="true"', 'tag-art" ref={artRef} aria-hidden="true"', 'className="tour-cut" aria-hidden="true"', 'className="tour-fly" aria-hidden="true"']) assert.ok((OPEN + TOUR).includes(a.replace("className=", "").replace(/^"/, "")) || (OPEN + TOUR).includes(a), `${a} is decoration`);
  assert.match(STAGE, /aria-hidden="true" focusable="false"/);
  assert.match(TOUR, /className=\{cx\("tour-card pop-in"\)\}/, "the entrance is the shared pop-in, which becomes a plain fade under reduced motion");
  assert.match(CINEMA, /\.tour-ring::after \{[^}]*animation: glow/);
  assert.match(OPEN, /useMedia\("\(prefers-reduced-motion: reduce\)"\)/, "with reduced motion the film skips its title card and runs in a fifth of the time");
  assert.match(OPEN, /Skip tour/, "the film can be skipped from its first frame");
  assert.match(CINEMA, /\.cine :focus-visible \{ outline-color: var\(--cine-warm\)/, "focus is visible on black");
});

test("it is skippable at any time and replayable from the menu (Settings), and each skip works from every step", () => {
  assert.match(TOUR, /Skip tour/);
  const set = read("app/settings/Settings.jsx"); assert.match(set, /Replay Move-In Day/); assert.match(set, /Unbox your room again/); assert.match(set, /onClick=\{onReplayTour\}/);
  assert.match(read("App.jsx"), /onReplayTour=\{\(\) => setTourOpen\(true\)\}/);
});

test("under 90 seconds: five short steps, a few words each", () => {
  const words = STEPS.reduce((n, s) => n + (s.title + " " + s.body).split(/\s+/).length, 0);
  assert.ok(words <= 190, `${words} words to read in total`);
  for (const s of STEPS) assert.ok(s.body.split(/\s+/).length <= 32, `${s.id} is short`);
});

test("nothing of the old introduction is left behind", () => {
  assert.ok(!existsSync(new URL("../src/app/intro", import.meta.url)), "the old intro folder is gone");
  const all = [];
  const walk = (d) => { for (const e of readdirSync(new URL(d, import.meta.url), { withFileTypes: true })) { const p = `${d}${e.name}`; if (e.isDirectory()) walk(p + "/"); else if (/\.(jsx?|css|mjs)$/.test(e.name)) all.push(p); } };
  walk("../src/");
  for (const f of all) { const t = readFileSync(new URL(f, import.meta.url), "utf8"); assert.ok(!/Skip intro|Play introduction|closeIntro|introOpen|setIntroOpen|onReplayIntro|introNeeded|introChecked|\.dots-nav|\.intro-/.test(t), `${f} still mentions the old introduction`); }
  assert.ok(!/Skip intro/.test(readFileSync(new URL("../README.md", import.meta.url), "utf8")));
});

test("the room is the home screen, with every real section as a piece of furniture", () => {
  const room = read("app/room/Room.jsx");
  for (const where of ["Track", "Review", "Prepare", "Class", "Settings", "Night mode", "Ask"]) assert.ok(room.includes(`where="${where}"`), where);
  assert.match(read("app/shell.jsx"), /href="#\/room"/); assert.match(read("app/shell.jsx"), /aria-label="Night mode lamp"/);
  assert.match(read("app/shell.jsx"), /\[\["g", "h"\], "Go to your room"\]/);
});
