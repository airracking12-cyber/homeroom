import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The welcome tour unwraps the app piece by piece. A piece is a data-rv token in the markup, listed in UNBOX_TOKENS,
// and a tour step brings it out with `show`. These checks stop a piece being listed but never wired up (it would stay
// invisible forever), or a step asking for a piece that doesn't exist.
const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const tokens = [...src.match(/const UNBOX_TOKENS = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

test("every unbox token is in the markup", () => {
  assert.ok(tokens.length > 10, "found the token list");
  // tabs and pages are tagged from a template: t-<tab> on the nav buttons, p-<tab> on the page
  const dynamic = { "t-": { tabs: ["tasks", "done", "review", "data", "ask"], tpl: "`t-${k}`" }, "p-": { tabs: ["done", "review", "data", "ask"], tpl: "`p-${tab}`" } };
  const missing = tokens.filter((t) => {
    if (src.includes(`data-rv="${t}"`)) return false;
    const d = dynamic[t.slice(0, 2)];
    return !(d && d.tabs.includes(t.slice(2)) && src.includes(d.tpl));
  });
  assert.deepEqual(missing, [], `no markup for: ${missing.join(", ")}`);
});

test("every tour step only shows pieces that exist, and every piece is shown by some step", () => {
  const body = src.slice(src.indexOf("const tourSteps = "), src.indexOf("function Tour("));
  const shown = new Set([...body.matchAll(/show: \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])));
  const unknown = [...shown].filter((t) => !tokens.includes(t));
  assert.deepEqual(unknown, [], `unknown pieces: ${unknown.join(", ")}`);
  const never = tokens.filter((t) => !shown.has(t));
  assert.deepEqual(never, [], `never unwrapped: ${never.join(", ")}`);
});

test("pieces are unwrapped once, in order", () => {
  const body = src.slice(src.indexOf("const tourSteps = "), src.indexOf("function Tour("));
  const all = [...body.matchAll(/show: \[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
  assert.equal(new Set(all).size, all.length, "a piece is listed by two steps");
});
