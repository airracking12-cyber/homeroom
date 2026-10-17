// Every text/background pair in the design tokens must pass WCAG AA (4.5:1 for text, 3:1 for large text, icons and
// the borders of controls), in light and in dark. Reads src/styles/tokens.css, so a token that drifts fails here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");

// light = the first :root block; dark = the forced-dark block (the media-query block repeats the same values)
const block = (re) => { const m = css.match(re); assert.ok(m, "block not found: " + re); return m[1]; };
const vars = (b) => Object.fromEntries([...b.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const LIGHT = vars(block(/^:root \{([\s\S]*?)^\}/m));
const DARK = vars(block(/^:root\[data-theme="dark"\] \{([\s\S]*?)^\}/m));
const DARK_MEDIA = vars(block(/:root:not\(\[data-theme="light"\]\) \{([\s\S]*?)\n  \}/));

const lum = (h) => { const n = parseInt(h.slice(1), 16); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground, background, minimum, what it is]
const TEXT = 4.5, LARGE = 3;
const PAIRS = [
  ["ink", "canvas", TEXT, "headings on canvas"], ["ink", "surface", TEXT, "headings on cards"], ["ink", "surface-2", TEXT, "text on wells"],
  ["body", "canvas", TEXT, "body on canvas"], ["body", "surface", TEXT, "body on cards"], ["body", "surface-2", TEXT, "body on wells"],
  ["muted", "canvas", TEXT, "secondary text on canvas"], ["muted", "surface", TEXT, "secondary text on cards"], ["muted", "surface-2", TEXT, "secondary text on wells"], ["muted", "raised", TEXT, "secondary text on sheets"],
  ["ink", "raised", TEXT, "text on sheets"], ["ink", "seg-on", TEXT, "picked option in a segmented control"], ["muted", "surface-2", TEXT, "unpicked option label on its track"], ["body", "raised", TEXT, "body on sheets"],
  ["on-accent", "accent-fill", TEXT, "button label"], ["on-accent", "accent-fill-hover", TEXT, "button label, hover"], ["on-accent", "accent-fill-press", TEXT, "button label, pressed"],
  ["accent-text", "canvas", TEXT, "coral text on canvas"], ["accent-text", "surface", TEXT, "coral text on cards"], ["accent-text", "raised", TEXT, "coral text on sheets"],
  ["on-accent-wash", "accent-wash", TEXT, "text on soft coral"], ["accent-text", "accent-wash", TEXT, "coral text on soft coral"],
  ["ok", "canvas", TEXT, "success text"], ["ok", "surface", TEXT, "success text on cards"], ["ok", "ok-wash", TEXT, "success badge"],
  ["warn", "canvas", TEXT, "warning text"], ["warn", "surface", TEXT, "warning text on cards"], ["warn", "warn-wash", TEXT, "warning badge"],
  ["bad", "canvas", TEXT, "error text"], ["bad", "surface", TEXT, "error text on cards"], ["bad", "bad-wash", TEXT, "error badge"],
  ["info", "canvas", TEXT, "info text"], ["info", "info-wash", TEXT, "info badge"],
  // non-text: control borders, focus ring, large coral shapes
  ["border", "canvas", LARGE, "input border on canvas"], ["border", "surface", LARGE, "input border on cards"], ["border", "raised", LARGE, "input border on sheets"],
  ["focus", "canvas", LARGE, "focus ring on canvas"], ["focus", "surface", LARGE, "focus ring on cards"], ["focus", "raised", LARGE, "focus ring on sheets"],
  ["coral", "canvas", LARGE, "decorative coral on canvas (the wordmark dot, intro art)"],
  // coral is NOT 3:1 on a card, so progress rings, selected icons and bars on cards use the deeper fill instead
  ["accent-fill", "canvas", LARGE, "progress and selected states on canvas"], ["accent-fill", "surface", LARGE, "progress and selected states on cards"], ["accent-fill", "raised", LARGE, "selected states on sheets"],
];

for (const [name, T] of [["light", LIGHT], ["dark", DARK], ["dark (system)", { ...LIGHT, ...DARK_MEDIA }]]) {
  test(`every text and control pair passes WCAG AA in ${name}`, () => {
    const fails = [];
    for (const [fg, bg, min, what] of PAIRS) {
      assert.ok(T[fg] && T[bg], `${name}: token missing for ${fg} or ${bg}`);
      const r = ratio(T[fg], T[bg]);
      if (r < min) fails.push(`${what}: ${fg} ${T[fg]} on ${bg} ${T[bg]} is ${r.toFixed(2)}:1, needs ${min}:1`);
    }
    assert.deepEqual(fails, []);
  });
}

test("the system-dark block and the forced-dark block hold the same colours", () => {
  for (const k of Object.keys(DARK)) assert.equal(DARK_MEDIA[k], DARK[k], `--${k} differs between the two dark blocks`);
});

test("the brief's own accessibility overrides hold", () => {
  assert.ok(ratio("#ffffff", "#cc785c") < 4.5, "white on #cc785c really is too faint, which is why buttons use --accent-fill");
  assert.ok(ratio(LIGHT["on-accent"], LIGHT["accent-fill"]) >= 4.5);
  assert.ok(ratio("#8e8b82", LIGHT.canvas) < 4.5, "#8e8b82 is for decoration only");
  assert.ok(ratio(LIGHT.muted, LIGHT.surface) >= 4.5, "muted text must read on a card");
});

test("no hex colours outside tokens.css in the new styles and screens", () => {
  const { readdirSync } = require_fs();
  const hexes = [];
  for (const dir of ["../src/styles", "../src/app"]) {
    for (const f of readdirSync(new URL(dir + "/", import.meta.url))) {
      if (f === "tokens.css" || !/\.(css|jsx|js)$/.test(f)) continue;
      const t = readFileSync(new URL(`${dir}/${f}`, import.meta.url), "utf8");
      for (const m of t.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/g)) hexes.push(`${f}: ${m[0]}`);
    }
  }
  assert.deepEqual(hexes, []);
});
import * as fs from "node:fs";
function require_fs() { return fs; }
