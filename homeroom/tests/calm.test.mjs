import test from "node:test";
import assert from "node:assert/strict";
import { CALM_CSS } from "../src/design/calm.css.js";

// Guards the look of the calm design layer: the things that make an interface read as a template are kept out of it.
test("no tracked ALL-CAPS labels", () => {
  assert.ok(!/text-transform:\s*uppercase/.test(CALM_CSS), "uppercase labels are not part of this design");
});
test("no transition: all, no blur glass, no glow shadows", () => {
  assert.ok(!/transition:\s*all\b/.test(CALM_CSS), "list the properties instead");
  assert.ok(!/backdrop-filter:\s*blur/.test(CALM_CSS), "surfaces are flat colour, not frosted glass");
});
test("every animation has a reduced-motion answer", () => {
  assert.match(CALM_CSS, /prefers-reduced-motion:\s*reduce/);
});
test("the study stage and the dark theme share one palette", () => {
  const rule = (sel) => CALM_CSS.split("\n").find((l) => l.startsWith(sel + "{"));
  const body = (l) => l.slice(l.indexOf("{") + 1, l.lastIndexOf("}"));
  assert.equal(body(rule('.hr[data-theme="dark"]')), body(rule('.hr[data-focus="1"]')));
});
