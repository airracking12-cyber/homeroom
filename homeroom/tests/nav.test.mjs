// The new navigation: five destinations around Track, Review, Prepare, with everything from v33 given a home.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DESTINATIONS, DEFAULT_DEST, ids, parseRoute, hashFor, shortcutDest, FEATURE_HOME } from "../src/app/nav.js";

const read = (p) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");

test("four or five top-level destinations, each with a label, a title and a unique shortcut", () => {
  assert.ok(DESTINATIONS.length >= 4 && DESTINATIONS.length <= 5, `${DESTINATIONS.length} destinations`);
  assert.equal(new Set(ids()).size, DESTINATIONS.length);
  assert.equal(new Set(DESTINATIONS.map((d) => d.key)).size, DESTINATIONS.length, "shortcut letters are unique");
  for (const d of DESTINATIONS) { assert.ok(d.label && d.title && d.blurb, d.id); assert.ok(d.label.length <= 9, `${d.label} fits under a phone tab`); }
});

test("the three jobs are the first three destinations, and Settings is last", () => {
  assert.deepEqual(ids().slice(0, 3), ["track", "review", "prepare"]);
  assert.equal(ids().at(-1), "settings");
  assert.equal(DEFAULT_DEST, "track");
});

test("routes live in the hash, and anything else is the home screen", () => {
  assert.deepEqual(parseRoute("#/review/notes"), { dest: "review", parts: ["notes"] });
  assert.deepEqual(parseRoute("#/track/task/abc"), { dest: "track", parts: ["task", "abc"] });
  assert.deepEqual(parseRoute("#/prepare/new/exam"), { dest: "prepare", parts: ["new", "exam"] });
  assert.deepEqual(parseRoute(""), { dest: "track", parts: [] });
  assert.deepEqual(parseRoute("#/nonsense/x"), { dest: "track", parts: [] });
  assert.equal(parseRoute("#access_token=abc&type=recovery").dest, "track", "an email sign-in link is not a route");
  assert.deepEqual(parseRoute("#/review/%E2%9C%93"), { dest: "review", parts: ["\u2713"] });
});

test("hashFor and parseRoute are inverses, and empty parts are dropped", () => {
  for (const [d, ...p] of [["track"], ["review", "notes", "n 1"], ["track", "task", "a/b"]]) assert.deepEqual(parseRoute(hashFor(d, ...p)), { dest: d, parts: p });
  assert.equal(hashFor("review", ""), "#/review");
});

test("g then a letter reaches every destination", () => {
  for (const d of DESTINATIONS) assert.equal(shortcutDest(d.key), d.id);
  assert.equal(shortcutDest("T"), "track");
  assert.equal(shortcutDest("z"), null);
});

test("every v33 feature has a home in a real destination", () => {
  const homes = new Set([...ids(), "global", "admin"]);
  for (const [feature, home] of Object.entries(FEATURE_HOME)) assert.ok(homes.has(home), `${feature} -> ${home}`);
  assert.ok(Object.keys(FEATURE_HOME).length >= 30, "the inventory is complete");
});

test("the app renders a screen for every destination, and the shell links to every one", () => {
  const app = read("App.jsx"), shell = read("app/shell.jsx");
  for (const id of ids()) assert.match(app, new RegExp(`\\b${id}: <`), `${id} has a screen`);
  assert.match(shell, /DESTINATIONS\.map/);
  assert.match(shell, /aria-current=\{route\.dest === x\.id \? "page" : undefined\}/, "the current destination is announced");
  assert.match(shell, /aria-label="Main"/);
});

test("one primary action on Track, and a phone gets a button above the tab bar", () => {
  const t = read("app/track/Track.jsx");
  assert.equal((t.match(/variant="primary"/g) || []).filter(Boolean).length >= 1, true);
  assert.match(t, /className="fab only-narrow"/);
  assert.match(t, /className="only-wide" onClick=\{\(\) => openForm\(\)\}/);
});

test("the nav is a tab bar on phones, a rail on tablets and a sidebar on desktops", () => {
  const css = read("styles/layout.css");
  assert.match(css, /\.nav \{[^}]*position: fixed;[^}]*bottom: 0;/s);
  assert.match(css, /@media \(min-width: 768px\)[\s\S]*?\.nav \{[^}]*width: var\(--rail-w\)/);
  assert.match(css, /@media \(min-width: 1024px\)[\s\S]*?\.nav \{[^}]*width: var\(--side-w\)/);
});

test("the task sheet is a route, so Back closes it", () => {
  const t = read("app/track/Track.jsx");
  assert.match(t, /route\.parts\[0\] === "task"/);
  assert.match(t, /back\("track"\)/);
});

test("the old g d (Done) and g a (Ask) shortcuts still work, and the help lists them", () => {
  const shell = read("app/shell.jsx");
  assert.match(shell, /k === "d"\) \{[^}]*view: "done"/);
  assert.match(shell, /k === "a"\) \{[^}]*setAskOpen\(true\)/);
  assert.match(shell, /\[\["g", "d"\], "Show what you have finished"\]/);
  assert.match(shell, /\[\["g", "a"\], "Ask the assistant"\]/);
});
