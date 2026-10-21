// The coach: how a study session is chosen, asked, scored and summed up. Pure logic (tests/coach.test.mjs).
//   Active recall (answer BEFORE you see it), spaced repetition (the existing Leitner boxes, all history kept),
//   interleaving (topics are mixed, never one block after another), question types that grow with how well you know an idea,
//   a confidence rating before every reveal, and a re-test of anything you got wrong.
import { addDays, todayISO } from "./dates.js";
import { BOX_DAYS } from "./study-core.js";
import { itemFor, keyPointsOf, blankOf } from "./practice.js";

export const SESSION_LEN = 10;
export const CONF = [{ v: 0, label: "Not sure" }, { v: 1, label: "Think so" }, { v: 2, label: "Sure" }];
export const KIND_NAME = { recall: "Recall", mc: "Pick the answer", explain: "In your own words", why: "Why does it work?", apply: "A new situation" };

// ── choosing and mixing ───────────────────────────────────────────────────────────────────────────────────────
// How much an idea needs attention right now: new, due, low box, often missed, and confident-but-wrong ideas come first.
export function priority(card, today = todayISO()) {
  if (!card) return 1.2;
  const seen = Math.max(1, card.s || 0);
  return (card.due <= today ? 2 : 0) + (5 - (card.b || 0)) * 0.4 + ((card.m || 0) / seen) * 2 + (card.w || 0) * 1.5 + (card.u || 0) * 0.3;
}
const KINDS_BY_BOX = (b) => (b <= 1 ? ["mc", "recall", "explain"] : b <= 3 ? ["explain", "why", "mc", "recall"] : ["apply", "why", "explain", "mc"]);

function available(kind, idea, it) {
  if (kind === "mc") return true; // a stored question, or a plain one made on the device
  if (kind === "recall" || kind === "explain") return true;
  if (kind === "why") return !!(it && it.why);
  if (kind === "apply") return !!(it && it.apply);
  return false;
}
// One question for an idea. `shift` rotates through the kinds so a session mixes them and a re-test differs from the first try.
export function makeQuestion(idea, { it, card, local, shift = 0, retest = false, force }) {
  const b = card ? card.b || 0 : 0, pref = KINDS_BY_BOX(b).filter((k) => available(k, idea, it));
  const kind = force && available(force, idea, it) ? force : pref[shift % pref.length];
  const base = { id: `${idea.id}${retest ? "~r" : ""}`, ideaId: idea.id, mid: idea.mid, topic: idea.mt || "", subject: idea.subject || "", t: idea.t, kind, box: b, mis: (it && it.mis) || "", trick: (it && it.tr) || "", retest, src: { d: idea.d, c: idea.c || "" } };
  if (kind === "mc") { const m = it && it.mc ? { c: it.mc.c, a: it.mc.a, q: it.mc.q, w: it.mc.w } : local(idea); return { ...base, q: m.q, model: m.c[m.a], mc: { c: m.c, a: m.a }, why: m.w || `${idea.t}: ${idea.d}`, points: [] }; }
  if (kind === "why") return { ...base, q: it.why.q, model: it.why.a, points: it.why.k };
  if (kind === "apply") return { ...base, q: it.apply.q, model: it.apply.a, points: it.apply.k };
  if (kind === "explain") return { ...base, q: `Explain "${idea.t}" in your own words, as if you were teaching a friend.`, model: idea.d, points: keyPointsOf(idea) };
  const blank = blankOf(idea);
  return { ...base, kind: "recall", q: blank ? `Fill in the blank: ${blank}` : `What do you remember about "${idea.t}"?`, model: blank ? idea.c : idea.d, blank: !!blank, points: blank ? [] : keyPointsOf(idea) };
}

// Weak-first, then interleaved: no two questions in a row from the same topic while another topic is waiting.
export function interleave(qs) {
  const groups = new Map();
  qs.forEach((q) => { const k = q.mid || q.topic; (groups.get(k) || groups.set(k, []).get(k)).push(q); });
  const lists = [...groups.values()], out = [];
  let last = null;
  while (out.length < qs.length) {
    let picked = false;
    for (const l of lists.sort((a, b) => b.length - a.length)) {
      if (l.length && (l[0].mid || l[0].topic) !== last) { const q = l.shift(); out.push(q); last = q.mid || q.topic; picked = true; break; }
    }
    if (!picked) { const l = lists.find((x) => x.length); const q = l.shift(); out.push(q); last = q.mid || q.topic; }
  }
  return out;
}
export function buildSession(ideas, study, practice, { n = SESSION_LEN, local, today = todayISO(), rand = Math.random } = {}) {
  const ranked = ideas.map((idea) => ({ idea, p: priority(study.cards[idea.id], today) + rand() * 0.5 })).sort((a, b) => b.p - a.p).slice(0, n);
  const qs = ranked.map(({ idea }, i) => makeQuestion(idea, { it: itemFor(practice, idea.id), card: study.cards[idea.id], local, shift: i }));
  return interleave(qs);
}

// ── a session as data: it can be saved after every answer and picked up again ────────────────────────────────────
export const startSession = (questions, label, now = Date.now()) => ({ v: 1, id: String(now), at: now, label, qs: questions, i: 0, results: [], retried: [] });
export const currentQuestion = (s) => s.qs[s.i] || null;
export const isDone = (s) => s.i >= s.qs.length;
export const flagOf = (conf, score) => (conf === 2 && score < 1 ? "confident-wrong" : conf === 0 && score === 1 ? "unsure-right" : null);

// Records an answer. A wrong answer is asked again a few questions later, in a different form, once.
export function recordAnswer(s, { score, conf, answer = "" }, { it, card, local } = {}) {
  const q = s.qs[s.i];
  const flag = flagOf(conf, score);
  const results = [...s.results, { qid: q.id, ideaId: q.ideaId, topic: q.topic, subject: q.subject, t: q.t, kind: q.kind, score, conf, flag, retest: !!q.retest, answer: String(answer).slice(0, 400) }];
  let qs = s.qs, retried = s.retried;
  if (score < 1 && !q.retest && !retried.includes(q.ideaId) && it !== undefined) {
    const idea = { id: q.ideaId, mid: q.mid, mt: q.topic, subject: q.subject, t: q.t, d: q.src.d, c: q.src.c };
    const again = makeQuestion(idea, { it, card: { b: 1 }, local, retest: true, force: ["recall", "mc", "explain"].find((k) => k !== q.kind) }); // a different form of the same idea
    const at = Math.min(qs.length, s.i + 4);
    qs = [...qs.slice(0, at), again, ...qs.slice(at)]; retried = [...retried, q.ideaId];
  }
  return { ...s, qs, retried, results, i: s.i + 1 };
}

// The Leitner update. Right and sure: up a box. Right but unsure: it stays in its box (it comes back after the same wait).
// Partly: stays, back tomorrow. Wrong: box 1 and due today. Everything already stored is kept; the new fields are optional.
export function applyOutcome(study, q, { score, conf }, today = todayISO()) {
  const c = study.cards[q.ideaId] || { b: 0, due: today, s: 0, m: 0 };
  const flag = flagOf(conf, score);
  let b = c.b || 0, due;
  if (score === 1) { b = conf === 0 ? Math.max(1, b) : Math.min(5, Math.max(1, b) + 1); due = addDays(today, BOX_DAYS[b]); }
  else if (score === 0.5) { b = Math.max(1, b); due = addDays(today, 1); }
  else { b = 1; due = today; }
  const next = { ...c, b, due, s: (c.s || 0) + 1, m: (c.m || 0) + (score < 1 ? 1 : 0), x: conf, l: score };
  if (flag === "confident-wrong") next.w = (c.w || 0) + 1;
  if (flag === "unsure-right") next.u = (c.u || 0) + 1;
  return { ...study, cards: { ...study.cards, [q.ideaId]: next } };
}

// ── the coaching summary: what went well, what to work on, one tip. All worked out on the device ─────────────────
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const names = (xs) => [...new Set(xs)].slice(0, 3).join(", ");
export function coachSummary(results) {
  const total = results.length, right = results.filter((r) => r.score === 1).length, partly = results.filter((r) => r.score === 0.5).length, wrong = total - right - partly;
  const cw = results.filter((r) => r.flag === "confident-wrong"), ur = results.filter((r) => r.flag === "unsure-right");
  const by = (key) => { const m = {}; results.forEach((r) => { const k = r[key] || "General"; (m[k] = m[k] || { right: 0, total: 0 }); m[k].total++; if (r.score === 1) m[k].right++; }); return Object.entries(m).map(([name, v]) => ({ name, ...v, pct: v.right / v.total })); };
  const topics = by("topic"), kinds = by("kind").filter((k) => k.total >= 2);
  const best = [...topics].sort((a, b) => b.pct - a.pct || b.total - a.total)[0], worst = [...topics].sort((a, b) => a.pct - b.pct || b.total - a.total)[0];
  const sureRight = results.filter((r) => r.conf === 2 && r.score === 1).length;
  const well = [];
  if (total) well.push(`You got ${right} of ${total} right.`);
  if (best && best.pct >= 0.75 && best.total >= 2) well.push(`${best.name} is in good shape (${best.right} of ${best.total}).`);
  if (sureRight >= 2) well.push(`You felt sure and were right ${plural(sureRight, "time", "times")}. Your judgement is working.`);
  const goodKind = kinds.find((k) => k.pct >= 0.75 && ["explain", "why", "apply"].includes(k.name));
  if (goodKind) well.push(`${KIND_NAME[goodKind.name]} questions went well.`);
  if (!well.length) well.push("You finished the session, and that is how it sticks.");
  const work = [];
  if (worst && worst.pct < 0.6 && worst.total >= 1 && wrong + partly > 0) work.push(`${worst.name} needs another pass (${worst.right} of ${worst.total}).`);
  if (cw.length) work.push(`You felt sure but missed: ${names(cw.map((r) => r.t))}.`);
  if (ur.length) work.push(`You knew these but weren't sure: ${names(ur.map((r) => r.t))}.`);
  const hardest = [...kinds].sort((a, b) => a.pct - b.pct)[0];
  if (hardest && hardest.pct < 0.6) work.push(`${KIND_NAME[hardest.name]} questions were the hardest.`);
  if (!work.length) work.push("Nothing stood out. Keep the spacing going.");
  let tip;
  if (cw.length >= 2) tip = "Before you check an answer, say it out loud. If you can't say it, you don't know it yet.";
  else if (cw.length === 1) tip = `When you feel sure, check one detail: could it be the idea next to ${cw[0].t}?`;
  else if (ur.length >= 2) tip = "You know more than you think. Next time, answer first, then rate how sure you are.";
  else if (hardest && hardest.pct < 0.6 && hardest.name === "apply") tip = "For a new situation, name the idea first, then ask what changes and what stays the same.";
  else if (hardest && hardest.pct < 0.6 && hardest.name === "why") tip = "Answer \"why\" with the word because. If you can't finish the sentence, reread that part once.";
  else if (hardest && hardest.pct < 0.6 && hardest.name === "explain") tip = "Explain it with one example from your own life. If the example is hard, the idea isn't clear yet.";
  else if (worst && worst.pct < 0.6 && wrong + partly > 0) tip = `Spend five minutes on ${worst.name} tomorrow. That is when the missed ones come back.`;
  else tip = "Come back tomorrow for a few minutes. Short, spaced sessions beat one long night.";
  return { total, right, partly, wrong, pct: total ? Math.round((100 * right) / total) : 0, well, work, tip,
    flags: { confidentWrong: cw.map((r) => r.t), unsureRight: ur.map((r) => r.t) }, comeBack: [...new Set(results.filter((r) => r.score < 1).map((r) => r.t))] };
}

// ── saving a session after every answer, on this device and in the database ────────────────────────────────────
export const sessionKey = (user) => `u:${user}:session`;
export async function saveSession(user, s, { store, storage = globalThis.localStorage }) {
  try { if (s) storage.setItem(`hr:session:${user}`, JSON.stringify(s)); else storage.removeItem(`hr:session:${user}`); } catch { /* storage blocked */ }
  try { await store.set(sessionKey(user), s, true); } catch { /* the device copy still holds it */ }
}
export async function loadSession(user, { store, storage = globalThis.localStorage }) {
  let s = null;
  try { s = await store.get(sessionKey(user), true); } catch { s = null; }
  if (!s || !s.qs) { try { s = JSON.parse(storage.getItem(`hr:session:${user}`) || "null"); } catch { s = null; } }
  return s && s.v === 1 && Array.isArray(s.qs) && !isDone(s) && s.results.length < s.qs.length ? s : null;
}
