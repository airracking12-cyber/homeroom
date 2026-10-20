// The study engine, moved unchanged from the v33 App.jsx: the ideas inventory, reviewer writing, quiz building,
// spaced-repetition boxes and the private study data hook. No screens in here.
import { useState, useEffect, useRef, useCallback } from "react";
import { store, notes } from "./services.js";
import { callClaude, parseJSON } from "./ai.js";
import { makeChunks } from "./ingest.js";
import { readOutcome } from "./store.js";
import { createDebouncedSaver } from "./debounce.js";
import { todayISO, diffDays } from "./dates.js";

export const BOX_DAYS = [0, 1, 2, 4, 8, 16]; // spaced repetition: how many days until a card comes back, by box
export const TECHS = [
  { id: "cards", goal: "memorize", name: "Flashcards", tip: "Best for memorizing. Cards you miss come back sooner, ones you know come back later.", time: "5 to 10 min" },
  { id: "cloze", goal: "memorize", name: "Fill the blanks", tip: "Good for exact wording, definitions and formulas.", time: "5 min" },
  { id: "match", goal: "memorize", name: "Match pairs", tip: "A light warm-up that connects each term to its meaning.", time: "3 min" },
  { id: "mnemonic", goal: "memorize", name: "Memory tricks", tip: "For lists and facts that just won't stick. Gets you acronyms and pictures to remember.", time: "5 min" },
  { id: "teach", goal: "understand", name: "Teach it back", tip: "Explain it in your own words (the Feynman technique). If you can't, you don't understand it yet.", time: "10 min" },
  { id: "blurt", goal: "understand", name: "Blurting", tip: "Close your notes, write everything you remember, then see exactly what you missed. Great for finding gaps.", time: "10 min" },
  { id: "quiz", goal: "test", name: "Practice quiz", tip: "Multiple choice with the reason behind each answer. Do it a few days before a test.", time: "5 to 15 min" },
  { id: "exam", goal: "test", name: "Mixed exam", tip: "Everything mixed, timed, no hints, like the real thing. Do this last.", time: "15 to 25 min" },
  { id: "plan", goal: "plan", name: "Weekly plan", tip: "Spreads your review over the week in small sessions, so you never need a last-minute cram.", time: "10 min a day" },
];
export const GOALS = [["memorize", "To memorize it", "Facts, terms and formulas"], ["understand", "To really understand it", "Explain it, find your gaps"], ["test", "To test yourself", "Check you're ready"], ["plan", "To plan ahead", "A little each day"]];
export const PERIODS = [["today", "Today", "Notes from the last two days, and what's due soon"], ["week", "This week", "Notes from the last 7 days, and what's due this week"], ["final", "Final", "Everything in this quarter"]];

export const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const lev = (a, b) => { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; };
export const sameAnswer = (a, b) => { const x = norm(a), y = norm(b); return !!x && (x === y || (y.length >= 5 && lev(x, y) <= 1)); };
export const maskIdea = (d, c) => { const re = new RegExp(escRe(c), "i"); return re.test(d) ? d.replace(re, "_____") : null; };
export const subjectOfMat = (m, tasks) => m.subject || tasks.find((t) => t.id === m.taskId)?.subject || "General";

export function inPeriod(m, t, period, cq) {
  const now = Date.now(), due = t ? diffDays(t.deadline) : null;
  if (period === "final") return !t || (t.quarter || 1) === cq;
  if (period === "today") return m.at >= now - 1.5 * 864e5 || (due !== null && due >= -1 && due <= 2);
  return m.at >= now - 7 * 864e5 || (due !== null && due >= -7 && due <= 7);
}

// the inventory: every distinct idea in a note. The assistant does it properly; if it's busy, a plain sentence-by-sentence version keeps everything usable.
export function localIdeas(text) {
  const parts = String(text || "").replace(/([.!?])\s+/g, "$1\n").split(/\n+/).map((x) => x.trim()).filter((x) => x.length >= 24);
  return parts.slice(0, 120).map((p) => {
    const words = p.replace(/[^\p{L}\p{N}\s-]/gu, "").split(/\s+/).filter(Boolean);
    const num = p.match(/\d[\d.,]+/); // a number with at least two characters, so a lone 2 in x^2 isn't the key word
    const key = [...words].filter((w) => /^\p{L}/u.test(w)).sort((a, b) => b.length - a.length)[0] || words[0] || "";
    return { t: words.slice(0, 5).join(" "), d: p.slice(0, 280), c: num ? num[0].replace(/[.,]$/, "") : key, k: "fact" };
  });
}
export const DIGEST_SYSTEM = `You build a complete study inventory from class notes. List EVERY distinct idea a student could be tested on: each definition, term, rule, formula, step, date, name, cause and effect, and example. Never skip something and never merge two different ideas. Reply with ONLY JSON, no other text: {"ideas":[{"t":"short label, 2 to 6 words","d":"one clear sentence that states the fact","c":"the single most important word or number from d, copied exactly as written in d","k":"term|fact|formula|process|date|example"}]}`;
export async function aiIdeas(text, title, subject) {
  const out = [];
  for (const ch of makeChunks(text).map((c) => c.text)) { // whole sentences only, never cut mid-sentence (lib/ingest.js)
    const raw = await callClaude(DIGEST_SYSTEM, [{ role: "user", content: `Subject: ${subject}\nNote title: ${title}\n\nNOTES:\n${ch}` }]);
    const j = parseJSON(raw);
    if (!j || !Array.isArray(j.ideas)) throw new Error("bad inventory");
    j.ideas.forEach((x) => { if (x && x.t && x.d) out.push({ t: String(x.t).slice(0, 80), d: String(x.d).slice(0, 320), c: String(x.c || "").slice(0, 60), k: String(x.k || "fact").slice(0, 12) }); });
  }
  const seen = new Set();
  return out.filter((x) => { const k = norm(x.t + x.d); if (seen.has(k)) return false; seen.add(k); return true; });
}


// Makes sure every note has its ideas inventory and returns { noteId: { src, ideas } } for all of them.
// Stored inventories come from the database in one request. A note with none yet is read by the assistant once (usually
// right when it is added) and the result is saved for the whole class. If the assistant is busy, a plain
// sentence-by-sentence version keeps everything usable. onSaved(id, entry) lets the screen update its idea counts.
export async function ensureInventory(items, onSaved, onProgress, tried) {
  let cur = {};
  const ids = items.map((x) => x.m.id);
  const have = items.filter((x) => x.m.ic > 0 || x.m.src);
  if (have.length) cur = await notes.ideasFor(have.map((x) => x.m.id));
  const todo = items.filter((x) => {
    const stored = cur[x.m.id]?.ideas?.length > 0;
    if (stored || x.m.ic > 0) return (cur[x.m.id]?.src || x.m.src) === "local" && tried && !tried.has(x.m.id); // a quick inventory is retried once per visit
    return true;
  });
  for (let i = 0; i < todo.length; i++) {
    const x = todo[i];
    if (onProgress) onProgress(`Reading your notes, ${i + 1} of ${todo.length}`);
    if (tried) tried.add(x.m.id);
    const body = (await notes.text([x.m.id]))[x.m.id] || "";
    if (!body.trim()) continue;
    let list, src = "ai";
    try { list = await aiIdeas(body, x.m.title, x.subject); if (!list.length) throw new Error("none"); }
    catch { if (cur[x.m.id]?.ideas?.length) continue; list = localIdeas(body); src = "local"; }
    if (!list.length) continue;
    const count = await notes.saveIdeas(x.m.id, src, list);
    if (count == null) { cur = { ...cur, [x.m.id]: { n: body.length, at: Date.now(), src, ideas: list } }; continue; } // couldn't save; still usable now
    const entry = { n: body.length, at: Date.now(), src, ideas: list };
    cur = { ...cur, [x.m.id]: entry };
    if (onSaved) onSaved(x.m.id, entry);
  }
  // anything the database already held for notes outside the list above is not needed; return just what was asked for
  return Object.fromEntries(ids.filter((id) => cur[id]).map((id) => [id, cur[id]]));
}
export const ideaLines = (ideas) => ideas.map((i) => `- ${i.t}: ${i.d}`).join("\n");
// does a piece of writing mention this idea? (checks its key word, or most of its label)
export const ideaCovered = (text, idea) => {
  const h = norm(text);
  if (idea.c && idea.c.length >= 3 && h.includes(norm(idea.c))) return true;
  const w = norm(idea.t).split(" ").filter((x) => x.length > 3);
  return w.length > 0 && w.filter((x) => h.includes(x)).length / w.length >= 0.6;
};

export const REVIEWER_SYSTEM = `You write clear, well-organized study reviewers for students. Plain text only: no markdown symbols, no bullet characters, no emojis. Line 1 is a short title. Then short sections: each section name goes on its own line, followed by one idea per line written as "Term: one short sentence of meaning". Group the ideas by topic, in the order a student would learn them. Include EVERY idea you are given. Finish with a section named Check yourself that has 3 to 5 short questions, one per line, each ending with a question mark. Never add facts that are not in the list.`;
// Writes a reviewer from a list of ideas, then checks it: anything the first draft left out is added back at the end.
export async function writeReviewer(heading, ideas) {
  if (!ideas.length) throw new Error("no ideas");
  let out = (await callClaude(REVIEWER_SYSTEM, [{ role: "user", content: `Make a reviewer for ${heading}. Cover all ${ideas.length} of these ideas:\n${ideaLines(ideas)}` }])).trim();
  if (!out) throw new Error("empty");
  const missing = ideas.filter((i) => !ideaCovered(out, i));
  if (missing.length) {
    try { out += "\n\n" + (await callClaude(REVIEWER_SYSTEM, [{ role: "user", content: `This reviewer left some ideas out. Write ONLY a short extra section titled Also remember, with one short line for each of these ideas:\n${ideaLines(missing)}` }])).trim(); }
    catch { out += "\n\nAlso remember\n" + missing.map((i) => `${i.t}: ${i.d}`).join("\n"); }
  }
  return out;
}

// personal study data (your flashcard boxes, sessions, weekly plan): private to you
export function useStudy(user, onSaved) {
  const [study, setS] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ref = useRef(null);
  const saver = useRef(null);
  const savedCb = useRef(onSaved);
  useEffect(() => { savedCb.current = onSaved; });
  useEffect(() => {
    let dead = false;
    store.get(`u:${user}:study`, true).then((v) => {
      if (dead) return;
      // Couldn't reach the database: don't start from an empty set (the next answer would save it over the real one).
      const r = readOutcome(v, { cards: {}, log: [], plan: null });
      if (!r.ok) { setFailed(true); return; }
      ref.current = r.value; setS(r.value); setFailed(false);
    });
    return () => { dead = true; };
  }, [user, attempt]);
  // Try again by itself when the connection comes back.
  const retry = useCallback(() => { setFailed(false); setAttempt((n) => n + 1); }, []);
  useEffect(() => {
    if (!failed) return undefined;
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [failed, retry]);
  // Saves wait 0.7s so a burst of answers is one write, but a pending save is sent at once when the page is hidden
  // (tab switch, app switch on a phone, refresh, close) and when this student's data is swapped out.
  useEffect(() => {
    const s = createDebouncedSaver((value) => store.set(`u:${user}:study`, value, true)
      .then((ok) => { if (savedCb.current) savedCb.current(ok, value); })
      .catch(() => { if (savedCb.current) savedCb.current(false, value); }), 700);
    saver.current = s;
    const onHide = () => { if (document.visibilityState === "hidden") s.flush(); };
    const onLeave = () => { s.flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onLeave);
      s.flush();
      saver.current = null;
    };
  }, [user]);
  const update = useCallback((fn) => {
    if (!ref.current) return; // nothing is saved until the real data has loaded
    const next = fn(ref.current);
    ref.current = next; setS(next);
    if (saver.current) saver.current.schedule(next);
  }, []);
  return [study, update, { failed, retry }];
}
export const missCard = (s, id) => ({ ...s, cards: { ...s.cards, [id]: { ...(s.cards[id] || { s: 0, m: 0 }), b: 1, due: todayISO(), s: ((s.cards[id] || {}).s || 0) + 1, m: ((s.cards[id] || {}).m || 0) + 1 } } });
export const logSession = (s, kind, subj, n, ok) => ({ ...s, log: [...(s.log || []).slice(-79), { at: Date.now(), kind, subj, n, ok }] });
export const mcFallback = (idea, pool) => {
  const masked = idea.c && maskIdea(idea.d, idea.c);
  const key = (p) => (masked ? p.c : p.t), right = masked ? idea.c : idea.t;
  const cand = pool.filter((p) => p.id !== idea.id && key(p) && norm(key(p)) !== norm(right));
  const others = [...shuffle(cand.filter((p) => p.subject === idea.subject)), ...shuffle(cand.filter((p) => p.subject !== idea.subject))].map(key).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3); // same-subject look-alikes first
  const c = [right, ...others];
  ["None of these", "All of these", "Not enough information"].forEach((e) => { if (c.length < 4) c.push(e); });
  const a = shuffle(c);
  return { type: "mc", ref: [idea.id], q: masked ? `Fill in the blank: "${masked}"` : `Which term matches this? "${idea.d}"`, c: a, a: a.indexOf(right), w: `${idea.t}: ${idea.d}` };
};
export async function buildQuiz(ideas, onProgress) {
  const items = [], covered = new Set();
  const batchRun = async (batch) => {
    const list = batch.map((x, i) => `${i + 1}. ${x.t}: ${x.d}`).join("\n");
    const raw = await callClaude("You write fair multiple-choice questions for students. Reply with ONLY JSON.", [{ role: "user", content: `Write one question for EACH numbered idea so every idea is covered. Test understanding, not copying. Four choices, exactly one correct, plausible wrong choices from the same topic. Reply ONLY {"q":[{"n":idea number,"q":"question","c":["a","b","c","d"],"a":index of the correct choice 0 to 3,"w":"one-sentence reason"}]}\n\n${list}` }]);
    const j = parseJSON(raw);
    (j?.q || []).forEach((x) => {
      const n = Number(x?.n) - 1, idea = batch[n];
      if (idea && x.q && Array.isArray(x.c) && x.c.length === 4 && Number.isInteger(x.a) && x.a >= 0 && x.a < 4 && !covered.has(idea.id)) {
        covered.add(idea.id);
        items.push({ type: "mc", ref: [idea.id], q: String(x.q), c: x.c.map(String), a: x.a, w: String(x.w || `${idea.t}: ${idea.d}`) });
      }
    });
  };
  const size = 8;
  for (let i = 0; i < ideas.length; i += size) {
    onProgress(`Writing questions ${Math.min(i + size, ideas.length)} of ${ideas.length}`);
    try { await batchRun(ideas.slice(i, i + size)); } catch { /* the plain version below fills in */ }
  }
  const missing = ideas.filter((x) => !covered.has(x.id));
  if (missing.length && missing.length < ideas.length) {
    onProgress(`Covering ${missing.length} ideas that were skipped`);
    for (let i = 0; i < missing.length; i += size) { try { await batchRun(missing.slice(i, i + size)); } catch { /* fall back */ } }
  }
  ideas.filter((x) => !covered.has(x.id)).forEach((x) => { items.push(mcFallback(x, ideas)); covered.add(x.id); });
  return { items, covered: covered.size };
}
export const REC = { today: ["cards", "cloze"], week: ["teach", "quiz"], final: ["blurt", "exam"] };
export const ALL_SCOPE = { period: "final", pick: [], topicPick: [], q: "", focus: null };
export const runLabel = (sc) => (sc.q.trim() ? `\u201c${sc.q.trim()}\u201d` : sc.topicPick.length === 1 ? sc.topicPick[0] : sc.pick.length === 1 ? sc.pick[0] : sc.pick.length ? `${sc.pick.length} subjects` : "Everything");
