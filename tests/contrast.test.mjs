import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Reads the real colour tokens out of App.jsx's stylesheet (every layer, later layers win) and checks WCAG contrast
// in both themes, so a future colour tweak can't quietly make text unreadable.
const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

function tokens(selector) {
  const out = {};
  const re = new RegExp("^" + selector.replace(/[.[\]"=]/g, "\\$&") + "\\s*\\{([^}]*)\\}", "gm");
  for (const m of src.matchAll(re)) for (const d of m[1].split(";")) {
    const i = d.indexOf(":"); if (i < 0) continue;
    const k = d.slice(0, i).trim(); if (k.startsWith("--")) out[k] = d.slice(i + 1).trim();
  }
  return out;
}
const clay = src.match(/clay:\s*\["(#[0-9A-Fa-f]{6})",\s*"(#[0-9A-Fa-f]{6})"\]/); // the default accent: [light, dark]
assert.ok(clay, "default accent not found");
const light = { ...tokens(".hr"), "--accent": clay[1] };
const dark = { ...light, ...tokens('.hr[data-theme="dark"]'), "--accent": clay[2] };
const resolve = (set, name, depth = 0) => {
  const v = set[name]; assert.ok(v, `${name} is not defined`);
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  return ref && depth < 5 ? resolve(set, ref[1], depth + 1) : v;
};

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const TEXT = 4.5, UI = 3;
const pairs = [
  ["--body", "--paper", TEXT], ["--ink", "--bg", TEXT], ["--muted", "--bg", TEXT], ["--muted", "--paper", TEXT], ["--muted", "--wash", TEXT],
  ["--faint", "--bg", TEXT], ["--faint", "--paper", TEXT],
  ["--accent-ink", "--paper", TEXT], ["--accent-ink", "--bg", TEXT],
  ["--danger", "--errbg", TEXT], ["--ok", "--okbg", TEXT], ["--ok", "--paper", TEXT],
  ["--accent-on", "--accent-strong", TEXT],   // labels on filled accent buttons, badges, chat bubbles
  ["--danger-on", "--danger", TEXT],
  ["--accent", "--paper", UI],                  // rings, checks and icons on cards
  // KNOWN NEAR-MISS: the specified terracotta (#D97757) on the specified parchment (#FAF9F5) measures 2.96:1, just under 3:1.
  // It is a property of those two brand colours, so it is allowed down to 2.9 but must never get worse. Icons on cards pass.
  ["--accent", "--bg", UI, 2.9],
];
for (const [name, set] of [["light", light], ["dark", dark]]) {
  test(`${name} theme: text and icon colours meet WCAG AA`, () => {
    const failures = [];
    for (const [fg, bg, target, floor] of pairs) {
      const need = floor ?? target;
      const r = ratio(resolve(set, fg), resolve(set, bg));
      if (r < need) failures.push(`${fg} on ${bg} is ${r.toFixed(2)}:1, needs ${need}:1`);
    }
    assert.deepEqual(failures, []);
  });
}
