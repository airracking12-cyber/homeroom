import test from "node:test";
import assert from "node:assert/strict";
import { createDebouncedSaver } from "../src/lib/debounce.js";

const clock = (t) => t.mock.timers.enable({ apis: ["setTimeout"] });

test("a burst of changes becomes one save of the latest value, after the delay", (t) => {
  clock(t);
  const saved = [];
  const s = createDebouncedSaver((v) => saved.push(v), 700);
  s.schedule("a"); t.mock.timers.tick(300);
  s.schedule("b"); t.mock.timers.tick(300);
  s.schedule("c");
  t.mock.timers.tick(699);
  assert.deepEqual(saved, [], "still waiting");
  t.mock.timers.tick(1);
  assert.deepEqual(saved, ["c"]);
  assert.equal(s.pending(), false);
});

test("flush saves the pending value immediately, and the timer does not save it a second time", (t) => {
  clock(t);
  const saved = [];
  const s = createDebouncedSaver((v) => saved.push(v), 700);
  s.schedule("last answer");
  assert.equal(s.pending(), true);
  s.flush();
  assert.deepEqual(saved, ["last answer"]);
  t.mock.timers.tick(5000);
  assert.deepEqual(saved, ["last answer"], "no duplicate");
});

test("flush with nothing pending does nothing", (t) => {
  clock(t);
  const saved = [];
  const s = createDebouncedSaver((v) => saved.push(v), 700);
  assert.equal(s.flush(), undefined);
  s.schedule("x"); t.mock.timers.tick(700); s.flush();
  assert.deepEqual(saved, ["x"], "already saved, so flush adds nothing");
});

test("flush hands back the save's result so a caller can wait for it", async (t) => {
  clock(t);
  const s = createDebouncedSaver(async (v) => `saved ${v}`, 700);
  s.schedule(1);
  assert.equal(await s.flush(), "saved 1");
});

test("cancel drops a pending save, and the saver keeps working afterwards", (t) => {
  clock(t);
  const saved = [];
  const s = createDebouncedSaver((v) => saved.push(v), 700);
  s.schedule("dropped"); s.cancel();
  t.mock.timers.tick(2000);
  assert.deepEqual(saved, []);
  s.schedule("kept"); t.mock.timers.tick(700);
  assert.deepEqual(saved, ["kept"]);
});

test("falsy values like 0 and empty string are real changes and still get saved", (t) => {
  clock(t);
  const saved = [];
  const s = createDebouncedSaver((v) => saved.push(v), 700);
  s.schedule(0); s.flush();
  s.schedule(""); s.flush();
  assert.deepEqual(saved, [0, ""]);
});
