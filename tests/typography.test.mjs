import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Keeps the type scale from sprawling back: every pixel font size in the stylesheet and in inline styles must sit on the scale.
const src = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const start = src.indexOf(".hr{");
const css = src.slice(start, start + src.slice(start).indexOf("`;"));

const READING = [11, 12, 13, 14, 15, 16];          // body, labels, captions
const HEADINGS = [18, 20, 22, 24, 28, 32, 40, 48];  // section and page headings
const SCALE = [...READING, ...HEADINGS];
// Boarding-pass / cabin artwork (ticket stamp, aisle letters, seat letters): tiny type is part of the illustration.
const ARTWORK_MICRO = [9, 9.5, 10];

test("every CSS font-size is on the scale", () => {
  const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
  assert.ok(sizes.length > 100, "found the stylesheet");
  const off = [...new Set(sizes.filter((s) => !SCALE.includes(s) && !ARTWORK_MICRO.includes(s)))];
  assert.deepEqual(off, [], `off-scale sizes: ${off.join(", ")}`);
});

test("text below 11px is limited to the three boarding-pass artwork labels", () => {
  const tiny = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1])).filter((s) => s < 11);
  assert.ok(tiny.length <= 3, `${tiny.length} declarations below 11px; only the artwork labels may be this small`);
});

test("inline font sizes in components are on the scale too", () => {
  const sizes = [...src.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)(?![\d.])/g)].map((m) => Number(m[1]));
  const off = [...new Set(sizes.filter((s) => !SCALE.includes(s)))];
  assert.deepEqual(off, [], `off-scale inline sizes: ${off.join(", ")}`);
});
