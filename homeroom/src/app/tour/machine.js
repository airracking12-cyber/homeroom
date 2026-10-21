// Move-In Day: the first-run introduction, as plain data and pure functions (tests/tour.test.mjs).
// It is an unboxing. Your room is bare; a moving box holds everything. You open it and put one piece in its place at a time,
// and each piece lights up the REAL part of the app it stands for. Five steps at most. It can be skipped at any point,
// remembers where you were, and ends with your first real notes on the shelf, not a "done" screen.
import { APP_NAME } from "../../lib/constants.js";

// The credit is fixed text. It names one person and says what he built. It opens the introduction; Settings > About and sign-in keep it too.
export const CREDIT = Object.freeze({
  name: "Nathaniel Visaya",
  welcome: `${APP_NAME} was designed, built and packed up for you by one person, Nathaniel Visaya.`,
  about: "Designed, built and maintained by one person, Nathaniel Visaya, for students and their classmates.",
  signIn: "Made by Nathaniel Visaya",
});

export const MAX_STEPS = 5;
// `item` is the piece of furniture unpacked at that step; `targets` are the real elements (data-tour ids) it points at, best first.
export const STEPS = Object.freeze([
  { id: "welcome", slot: "The box", item: "box", route: null, targets: [], cta: "Open the box", ctaOpen: "Start unpacking",
    title: `Welcome to ${APP_NAME}`,
    body: "Today is move-in day. Your room is bare, and everything you need is packed in this box. Let's unpack it together, one piece at a time." },
  { id: "corkboard", slot: "Corkboard", item: "corkboard", route: ["room"], targets: ["nav-track", "room-track"], cta: "Next",
    title: "Hang the corkboard",
    body: "Track is your corkboard. Pin homework and deadlines here, and your whole class sees them too." },
  { id: "bookshelf", slot: "Bookshelf", item: "bookshelf", route: ["room"], targets: ["nav-review", "room-review"], cta: "Next",
    title: "Set up the bookshelf",
    body: "Review is your bookshelf. Your class's notes, quizzes and study sheets all live here." },
  { id: "lamp", slot: "Desk lamp", item: "lamp", route: ["room"], targets: ["lamp", "room-lamp"], cta: "Next",
    title: "Plug in the desk lamp",
    body: "Tap the lamp to switch night mode on or off. Ask, right beside it, is your roommate for quick questions." },
  { id: "notes", slot: "First notes", item: "books", route: ["review", "notes"], targets: ["add-notes", "nav-review"], cta: "Add my notes", handsOn: true, skipLabel: "Do this later",
    title: "Fill the shelf with your first notes",
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

// The welcome has two beats: the box is closed (tap to open it), then open (tap to start unpacking).
export const ctaFor = (step, opened) => (step.id === "welcome" && opened ? step.ctaOpen : step.cta);
// "Unpacked N of 5": the box counts once it is open, then each piece as you reach it.
export const unpackedCount = (stepIndex, opened) => (stepIndex === 0 ? (opened ? 1 : 0) : Math.min(STEPS.length, stepIndex + 1));
export const slotStates = (stepIndex, opened) => STEPS.map((s, i) => ({ id: s.id, label: s.slot, done: i < unpackedCount(stepIndex, opened) }));

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

// Show it by itself only to someone who is mid-way (the account flag is false); everyone else is only OFFERED it, once.
export const tourNeeded = (flag) => flag === false;
export const offerNeeded = ({ flag, offered, dismissedHere }) => flag !== false && !offered && !dismissedHere;
const offerKey = (user) => `hr:tour-offer:${user}`;
export const offerDismissedHere = (user, storage = globalThis.localStorage) => { try { return storage.getItem(offerKey(user)) === "1"; } catch { return false; } };
export const dismissOfferHere = (user, storage = globalThis.localStorage) => { try { storage.setItem(offerKey(user), "1"); } catch { /* ignore */ } };
