import test from "node:test";
import assert from "node:assert/strict";
import { PHASE, EVENT, reduce, tearCompletes, onboardingNeeded } from "../src/onboarding/machine.js";

const run = (start, ...events) => events.reduce(reduce, start);

test("the happy path goes BLANK > STAMP > TEAR > PLANE_ANIMATION > WALKTHROUGH > COMPLETE", () => {
  const seen = [PHASE.BLANK];
  for (const e of [EVENT.ARRIVED, EVENT.STAMPED, EVENT.TORN, EVENT.PLANE_MIDPOINT, EVENT.FINISHED]) seen.push(reduce(seen.at(-1), e));
  assert.deepEqual(seen, [PHASE.BLANK, PHASE.STAMP, PHASE.TEAR, PHASE.PLANE_ANIMATION, PHASE.WALKTHROUGH, PHASE.COMPLETE]);
});

test("steps cannot be skipped: an event for a later step does nothing", () => {
  assert.equal(reduce(PHASE.BLANK, EVENT.TORN), PHASE.BLANK);
  assert.equal(reduce(PHASE.STAMP, EVENT.TORN), PHASE.STAMP);
  assert.equal(reduce(PHASE.TEAR, EVENT.PLANE_MIDPOINT), PHASE.TEAR);
  assert.equal(reduce(PHASE.PLANE_ANIMATION, EVENT.FINISHED), PHASE.PLANE_ANIMATION);
  assert.equal(reduce(PHASE.WALKTHROUGH, EVENT.ARRIVED), PHASE.WALKTHROUGH);
});

test("a repeated event (a double tap) does not advance twice", () => {
  assert.equal(run(PHASE.STAMP, EVENT.STAMPED, EVENT.STAMPED), PHASE.TEAR);
});

test("nothing goes backwards, and unknown events are ignored", () => {
  assert.equal(reduce(PHASE.TEAR, EVENT.ARRIVED), PHASE.TEAR);
  assert.equal(reduce(PHASE.STAMP, "NOPE"), PHASE.STAMP);
  assert.equal(reduce("???", EVENT.ARRIVED), "???");
});

test("outside onboarding, a new run starts at take-off and an interrupted one resumes the walkthrough", () => {
  assert.equal(reduce(PHASE.COMPLETE, EVENT.TORN), PHASE.PLANE_ANIMATION);
  assert.equal(reduce(PHASE.COMPLETE, EVENT.RESUME), PHASE.WALKTHROUGH);
  assert.equal(reduce(PHASE.COMPLETE, EVENT.FINISHED), PHASE.COMPLETE);
});

test("signing out resets from anywhere", () => {
  for (const p of Object.values(PHASE)) assert.equal(reduce(p, EVENT.RESET), PHASE.COMPLETE);
});

test("a tear needs distance, or a real flick", () => {
  assert.equal(tearCompletes(0.1, 0), false);
  assert.equal(tearCompletes(0.3, 100), false);
  assert.equal(tearCompletes(0.3, 1200), true);
  assert.equal(tearCompletes(0.1, 5000), false); // a twitch isn't a tear
  assert.equal(tearCompletes(0.56, 0), true);
});

test("only an account that started onboarding and didn't finish is sent back in", () => {
  assert.equal(onboardingNeeded(false), true);
  assert.equal(onboardingNeeded(true), false);
  assert.equal(onboardingNeeded(undefined), false); // from before onboarding existed
  assert.equal(onboardingNeeded(null), false);
});
