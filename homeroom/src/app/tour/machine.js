// Move-In Day: the guided tour, as plain data and pure functions (tests/tour.test.mjs).
// Five steps at most, framed as moving into a dorm. Each step points at a REAL element of the app (found by its data-tour
// attribute) and falls back to a nearby one, then to a centered card, so it never points at nothing.
// It can be skipped at any point, remembers where you were, and ends with real notes in the app, not a "done" screen.
import { APP_NAME } from "../../lib/constants.js";

// The credit is fixed text. It names one person and says what he built. It opens the tour; Settings > About and sign-in keep it too.
export const CREDIT = Object.freeze({
  name: "Nathaniel Visaya",
  welcome: `${APP_NAME} is designed, built and maintained by one person, Nathaniel Visaya.`,
  about: "Designed, built and maintained by one person, Nathaniel Visaya, for students and their classmates.",
  signIn: "Made by Nathaniel Visaya",
});

export const MAX_STEPS = 5;
export const STEPS = Object.freeze([
  { id: "welcome", route: null, targets: [], title: `Welcome to ${APP_NAME}`, cta: "Start unpacking",
    body: "Today is move-in day. I'll walk you around your new room in about a minute. You can skip any time, and nothing changes if you do." },
  { id: "corkboard", route: ["room"], targets: ["nav-track", "room-track"], title: "The corkboard", cta: "Next",
    body: "Track is your corkboard. Homework and deadlines get pinned here, and your whole class sees them." },
  { id: "bookshelf", route: ["room"], targets: ["nav-review", "room-review"], title: "The bookshelf", cta: "Next",
    body: "Review is your bookshelf. The class's notes, quizzes and study sheets all live here." },
  { id: "lamp", route: ["room"], targets: ["lamp", "room-lamp"], title: "The desk lamp", cta: "Next",
    body: "Tap the lamp to switch night mode on or off. Ask, right beside it, is your roommate for quick questions." },
  { id: "notes", route: ["review", "notes"], targets: ["add-notes", "nav-review"], title: "Unpack your first notes", cta: "Add my notes", handsOn: true, skipLabel: "Do this later",
    body: "Add one page of notes: paste text, take a photo or pick a PDF. They go on the shelf for your whole class to study." },
]);
export const HANDS_ON = Object.freeze(STEPS.filter((s) => s.handsOn).map((s) => s.id));

const clamp = (n) => (Number.isInteger(n) ? Math.max(0, Math.min(STEPS.length - 1, n)) : 0);
export const start = (saved) => ({ step: clamp(saved && saved.step), open: true, finished: false, skipped: false });
export const isLast = (s) => s.step === STEPS.length - 1;
export const stepOf = (s) => STEPS[s.step];

export function reduce(state, event) {
  if (!state.open) return state;
  switch (event.type) {
    case "NEXT": return isLast(state) ? { ...state, open: false, finished: true } : { ...state, step: state.step + 1 };
    case "BACK": return { ...state, step: clamp(state.step - 1) };
    case "SKIP": return { ...state, open: false, skipped: true };
    case "DONE": return { ...state, open: false, finished: true };   // the hands-on step is complete (notes were saved)
    default: return state;
  }
}

// ── finding what to point at ──
// candidates are data-tour ids in order of preference; isVisible says whether an id is on screen right now.
export const pickTarget = (candidates, isVisible) => (candidates || []).find((id) => isVisible(id)) || null;

// Where the card goes so it never covers what it points at: the opposite half of the screen, or the middle with no target.
export function cardSide(rect, vh) {
  if (!rect) return "center";
  return rect.top + rect.height / 2 > vh / 2 ? "top" : "bottom";
}
// The lit hole around the target: a little padding, kept inside the screen.
export function holeFor(rect, vw, vh, pad = 6) {
  const left = Math.max(0, rect.left - pad), top = Math.max(0, rect.top - pad);
  const right = Math.min(vw, rect.right + pad), bottom = Math.min(vh, rect.bottom + pad);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

// ── remembering ──
const key = (user) => `hr:tour:${user}`;
export function loadSaved(user, storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage.getItem(key(user)) || "null"); return v && Number.isInteger(v.step) ? { step: clamp(v.step) } : null; } catch { return null; }
}
export function save(user, state, storage = globalThis.localStorage) {
  try { if (state.open) storage.setItem(key(user), JSON.stringify({ step: state.step })); else storage.removeItem(key(user)); } catch { /* storage blocked: it just won't resume */ }
}

// Show the tour by itself only to someone who is mid-way (the account flag is false); everyone else is only OFFERED it, once.
export const introNeeded = (flag) => flag === false;
export const offerNeeded = ({ flag, offered, dismissedHere }) => flag !== false && !offered && !dismissedHere;
const offerKey = (user) => `hr:tour-offer:${user}`;
export const offerDismissedHere = (user, storage = globalThis.localStorage) => { try { return storage.getItem(offerKey(user)) === "1"; } catch { return false; } };
export const dismissOfferHere = (user, storage = globalThis.localStorage) => { try { storage.setItem(offerKey(user), "1"); } catch { /* ignore */ } };
