// The intro, as plain data and pure functions (tests/intro.test.mjs). Five calm screens:
//   welcome -> track -> review -> prepare -> credits
// It can be skipped at any point, it remembers where you were (so closing the tab resumes it), and Settings can replay it.
export const STEPS = ["welcome", "track", "review", "prepare", "credits"];
export const HANDS_ON = ["track", "review", "prepare"]; // the steps where the student does something real

// The credit is fixed text. It names one person and says what he built. Nothing else is credited.
export const CREDIT = Object.freeze({
  name: "Nathaniel Visaya",
  short: "Nathan",
  headline: "Designed, built and maintained by one person.",
  built: "He built the shared class tracker, the review tools and the long-term exam prep.",
  thanks: "Thank you to the students who use Homeroom. It gets better because you do.",
  about: "Designed, built and maintained by one person, Nathaniel Visaya, for students and their classmates.",
  signIn: "Made by Nathaniel Visaya",
});

const clamp = (n) => (Number.isInteger(n) ? Math.max(0, Math.min(STEPS.length - 1, n)) : 0);
export const start = (saved) => ({ step: clamp(saved && saved.step), open: true, finished: false, skipped: false });
export const isLast = (s) => s.step === STEPS.length - 1;
export const stepName = (s) => STEPS[s.step];

export function reduce(state, event) {
  if (!state.open) return state;
  switch (event.type) {
    case "NEXT": return isLast(state) ? { ...state, open: false, finished: true } : { ...state, step: state.step + 1 };
    case "BACK": return { ...state, step: clamp(state.step - 1) };
    case "SKIP": return { ...state, open: false, skipped: true };
    case "GO": return { ...state, step: clamp(event.step) };
    case "DONE": return { ...state, open: false, finished: true };
    default: return state;
  }
}

// What is stored while the intro is open, so a refresh resumes it.
const key = (user) => `hr:intro:${user}`;
export function loadSaved(user, storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage.getItem(key(user)) || "null"); return v && Number.isInteger(v.step) ? { step: clamp(v.step) } : null; } catch { return null; }
}
export function save(user, state, storage = globalThis.localStorage) {
  try { if (state.open) storage.setItem(key(user), JSON.stringify({ step: state.step })); else storage.removeItem(key(user)); } catch { /* storage blocked: it just won't resume */ }
}
// Show the intro only to someone who is mid-way (the account flag is false), or when Settings asks to replay it.
export const introNeeded = (flag) => flag === false;
