// The onboarding state machine. Pure functions only, so it is easy to test (tests/onboarding.test.mjs).
//
//   BLANK ──ARRIVED──▶ STAMP ──STAMPED──▶ TEAR ──TORN──▶ PLANE_ANIMATION ──PLANE_MIDPOINT──▶ WALKTHROUGH ──FINISHED──▶ COMPLETE
//
// BLANK            a plain white screen, no chrome at all. A short beat, then the ticket arrives.
// STAMP            "Stamp the ticket". The passenger name and class are filled in on the ticket first (STAMP also covers that).
// TEAR             "Tear off the stub". A drag along the perforation.
// PLANE_ANIMATION  the plane crosses the screen and wipes the white away.
// WALKTHROUGH      starts while the plane is still in the air (PLANE_MIDPOINT), so the first card arrives as the plane leaves.
// COMPLETE         hasCompletedOnboarding = true is saved, and the app is simply the app.
//
// There is deliberately no event that goes backwards and none that skips: the only way out of the first run is through it
// (RESET exists for signing out, and the saved flag still brings the person back to finish).

export const PHASE = Object.freeze({
  BLANK: "BLANK",
  STAMP: "STAMP",
  TEAR: "TEAR",
  PLANE_ANIMATION: "PLANE_ANIMATION",
  WALKTHROUGH: "WALKTHROUGH",
  COMPLETE: "COMPLETE",
});

export const EVENT = Object.freeze({
  ARRIVED: "ARRIVED",
  STAMPED: "STAMPED",
  TORN: "TORN",
  PLANE_MIDPOINT: "PLANE_MIDPOINT",
  FINISHED: "FINISHED",
  RESUME: "RESUME", // an interrupted first run is picked up again at the walkthrough
  RESET: "RESET", // signing out: whatever was in progress is dropped (the saved flag still says "not finished")
});

const TRANSITIONS = {
  [PHASE.BLANK]: { [EVENT.ARRIVED]: PHASE.STAMP },
  [PHASE.STAMP]: { [EVENT.STAMPED]: PHASE.TEAR },
  [PHASE.TEAR]: { [EVENT.TORN]: PHASE.PLANE_ANIMATION },
  [PHASE.PLANE_ANIMATION]: { [EVENT.PLANE_MIDPOINT]: PHASE.WALKTHROUGH },
  [PHASE.WALKTHROUGH]: { [EVENT.FINISHED]: PHASE.COMPLETE },
  // COMPLETE is also "not in onboarding right now". From there a new run starts at the ticket (its TORN event is the take-off),
  // and an interrupted first run resumes at the walkthrough.
  [PHASE.COMPLETE]: { [EVENT.TORN]: PHASE.PLANE_ANIMATION, [EVENT.RESUME]: PHASE.WALKTHROUGH },
};

// An event that doesn't apply to the current phase is ignored (a double tap can't skip a step).
export function reduce(phase, event) {
  if (event === EVENT.RESET) return PHASE.COMPLETE;
  const next = TRANSITIONS[phase] && TRANSITIONS[phase][event];
  return next || phase;
}

// The stub tear counts as finished when it has gone far enough along the seam, or has been flicked hard enough.
// `progress` is 0 to 1 along the seam, `velocity` is px/s in the direction of the tear.
export const TEAR_DISTANCE = 0.4;
export const TEAR_FLICK = 700;
export function tearCompletes(progress, velocity = 0) {
  if (progress >= TEAR_DISTANCE) return true;
  return progress >= 0.22 && velocity >= TEAR_FLICK;
}

// Where is this person in onboarding? `flag` is the saved hasCompletedOnboarding value:
//   false      they started and haven't finished: send them back in (this is what makes it mandatory)
//   true       done
//   undefined  an account from before onboarding existed: left alone
export function onboardingNeeded(flag) {
  return flag === false;
}
