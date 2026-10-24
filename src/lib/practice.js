// Practice items: the questions behind the coach, built ONCE per note by the assistant when the class's shared database is made
// (never while someone is studying) and stored for the whole class. Studying then needs no live assistant at all.
// Pure logic and prompts only; the saving is in app/ingest.jsx (tests/practice.test.mjs).
import { norm, maskIdea } from "./study-core.js";

export const BATCH = 6; // ideas per assistant call: six full sets of questions fit comfortably in one answer
export const practiceKey = (classId, noteId) => `${classId}:practice:${noteId}`;
export const ideaRef = (ideaId) => { const i = String(ideaId).lastIndexOf(":"); return { noteId: String(ideaId).slice(0, i), idx: Number(String(ideaId).slice(i + 1)) }; };

export const PRACTICE_SYSTEM = `You write practice questions for students from a list of ideas in their class notes. Reply with ONLY JSON, no markdown. Use plain, kind words a student can follow.`;
export function practicePrompt(batch, { subject, title }) {
  const list = batch.map((x, i) => `${i + 1}. ${x.t}: ${x.d}`).join("\n");
  return `Subject: ${subject}. Notes: ${title}.\nFor EACH numbered idea write:\n- mc: one multiple-choice question with exactly 4 choices, one correct (a = its index 0 to 3), plausible wrong choices from the same topic, and w = one sentence saying why the right one is right.\n- why: a "Why does this work / why is this true" question (q), a model answer in 1 to 2 sentences (a), and k = 2 to 4 short key points (1 to 5 words each) a good answer must contain.\n- apply: a question that uses the idea in a NEW situation that is not in the notes (q), a model answer (a), and k = 2 to 4 key points.\n- mis: the most likely misunderstanding, in one sentence that starts "You may be thinking".\n- tr: one short memory trick (a picture, rhyme or silly sentence), under 25 words.\nReply ONLY {"p":[{"n":1,"mc":{"q":"","c":["","","",""],"a":0,"w":""},"why":{"q":"","a":"","k":["",""]},"apply":{"q":"","a":"","k":["",""]},"mis":"","tr":""}]}\n\nIDEAS:\n${list}`;
}

const str = (v, n) => String(v || "").trim().slice(0, n);
const open = (o) => (o && str(o.q, 300) && str(o.a, 500) && Array.isArray(o.k) && o.k.filter((x) => str(x, 60)).length ? { q: str(o.q, 300), a: str(o.a, 500), k: o.k.map((x) => str(x, 60)).filter(Boolean).slice(0, 5) } : null);
const mcOf = (o) => (o && str(o.q, 300) && Array.isArray(o.c) && o.c.length === 4 && o.c.every((x) => str(x, 200)) && Number.isInteger(o.a) && o.a >= 0 && o.a < 4 ? { q: str(o.q, 300), c: o.c.map((x) => str(x, 200)), a: o.a, w: str(o.w, 300) } : null);
// Turns the assistant's JSON into { batchIndex: item }. An idea keeps only the parts that are complete and sensible.
export function parsePractice(json, batch) {
  const out = {};
  for (const x of (json && json.p) || []) {
    const i = Number(x && x.n) - 1;
    if (!(i >= 0 && i < batch.length) || out[i]) continue;
    const item = { mc: mcOf(x.mc), why: open(x.why), apply: open(x.apply), mis: str(x.mis, 300), tr: str(x.tr, 220) };
    if (item.mc || item.why || item.apply) out[i] = item;
  }
  return out;
}

// The stored row for one note: { v, n, items: { [ideaIndex]: item } }. Merging never drops what is already there.
export const emptyPractice = () => ({ v: 1, items: {} });
export const mergePractice = (cur, add) => ({ v: 1, items: { ...((cur && cur.items) || {}), ...add } });
export const hasPractice = (row, idx) => !!(row && row.items && row.items[idx]);
export const missingIdeas = (row, count) => Array.from({ length: count }, (_, i) => i).filter((i) => !hasPractice(row, i));
export const itemFor = (practice, ideaId) => { const r = ideaRef(ideaId); return (practice && practice[r.noteId] && practice[r.noteId].items && practice[r.noteId].items[r.idx]) || null; };

// ── answers to open questions are checked against the stored key points, on the device ──
const stem = (w) => w.slice(0, Math.max(4, Math.min(6, w.length - 1)));
export function checkPoints(answer, points) {
  const text = norm(answer);
  const has = (p) => { const ws = norm(p).split(" ").filter((w) => w.length > 2); return ws.length > 0 && ws.filter((w) => text.includes(stem(w))).length / ws.length >= 0.6; };
  const hit = points.filter(has), missed = points.filter((p) => !has(p));
  return { hit, missed, ratio: points.length ? hit.length / points.length : 0 };
}
// Key points for an idea with no stored ones: its key word, and its two most distinctive words.
export function keyPointsOf(idea) {
  const words = norm(idea.d).split(" ").filter((w) => w.length > 5);
  const rare = [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 2);
  return [...new Set([idea.c, ...rare].map((x) => String(x || "").trim()).filter(Boolean))].slice(0, 3);
}

// A multiple-choice quiz question for an idea: the stored one when there is one, else a plain local one.
export function mcFor(idea, practice, local) {
  const it = itemFor(practice, idea.id);
  return it && it.mc ? { type: "mc", ref: [idea.id], q: it.mc.q, c: it.mc.c, a: it.mc.a, w: it.mc.w || `${idea.t}: ${idea.d}` } : local(idea);
}
export const blankOf = (idea) => (idea.c && maskIdea(idea.d, idea.c)) || null;
