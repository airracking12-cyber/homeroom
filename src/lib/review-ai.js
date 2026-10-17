// The AI work behind Review, moved from the v33 App.jsx with every prompt unchanged. No screens in here.
import { notes } from "./services.js";
import { callClaude, streamClaude, parseJSON } from "./ai.js";
import { normTopic } from "./notes.js";
import { weekData, weekLabel, addDays, fmtDate } from "./dates.js";
import { ensureInventory, writeReviewer, ideaLines, ideaCovered, REVIEWER_SYSTEM } from "./study.js";

// A short lesson name for some notes, offered to the student to accept or change.
export async function suggestTopic(text, subject) {
  const raw = await callClaude(
    "You name the lesson a set of class notes is about. Reply with ONLY the lesson name: 2 to 5 words, no quotes, no full stop.",
    [{ role: "user", content: `Subject: ${subject || "General"}\n\nNOTES:\n${String(text).slice(0, 1500)}` }]
  );
  return normTopic(String(raw).split("\n")[0].replace(/["\u201c\u201d.]/g, ""));
}

export const WEEKLY_SYSTEM = `You write a weekly reviewer for a class, covering what the class worked on and learned. Plain text only, no markdown symbols, no emojis. Start with one sentence summing up the week. Then, for each subject, put the subject name on its own line, followed by one line for every key idea listed for that subject, written as "Term: one short sentence of meaning" (group related ideas under small topic labels and merge true duplicates, but never leave an idea out), then one self-check question ending with a question mark. Take facts only from the material provided. When a subject has only a task title and notes and no material, say what was assigned and do not invent lesson content. Finish with a short "Coming up" line using the next-week list.`;

// Write the week's reviewer: every note is read into ideas first so nothing is left out, then anything missed is added back.
export async function makeWeekly({ ws, tasks, materials, onInventory, onLive }) {
  const { ts, ms } = weekData(ws, tasks, materials);
  const by = {};
  const slot = (s) => (by[s] = by[s] || { tasks: [], mats: [] });
  ts.forEach((t) => slot(t.subject).tasks.push(t));
  ms.forEach((m) => slot(m.subject || tasks.find((t) => t.id === m.taskId)?.subject || "Other").mats.push(m));
  const items = Object.entries(by).flatMap(([s, d]) => d.mats.filter((m) => m.kind !== "ai").map((m) => ({ m, subject: s })));
  const inv = await ensureInventory(items, onInventory, (t) => onLive(t), null);
  onLive("");
  const all = [];
  const body = Object.entries(by).map(([s, d]) => {
    const ideas = d.mats.flatMap((m) => inv[m.id]?.ideas || []);
    all.push(...ideas);
    return `SUBJECT: ${s}\nTasks:\n${d.tasks.map((t) => `- ${t.title} (${t.type}, due ${t.deadline})${t.notes ? `, notes: ${t.notes}` : ""}`).join("\n") || "- none"}\nKey ideas from the notes (${ideas.length}):\n${ideas.length ? ideaLines(ideas) : "none"}`;
  }).join("\n\n");
  const next = tasks.filter((t) => t.deadline >= addDays(ws, 7) && t.deadline <= addDays(ws, 13)).map((t) => `${t.title} (${t.subject}, ${fmtDate(t.deadline)})`).join("; ");
  const system = WEEKLY_SYSTEM;
  let full = (await streamClaude(system, [{ role: "user", content: `Week of ${weekLabel(ws)}.\n\n${body}\n\nComing next week: ${next || "nothing listed yet"}` }], (t) => onLive(t))).trim();
  if (!full) throw new Error("empty");
  const missing = all.filter((i) => !ideaCovered(full, i));
  if (missing.length) {
    try { full += "\n\n" + (await callClaude(system, [{ role: "user", content: `This weekly page left some ideas out. Write ONLY a short extra section titled Also remember, with one short line for each of these ideas:\n${ideaLines(missing)}` }])).trim(); }
    catch { full += "\n\nAlso remember\n" + missing.map((i) => `${i.t}: ${i.d}`).join("\n"); }
  }
  return full;
}

// A reviewer for one task, from its notes (or a general one when nobody has added notes yet).
export async function makeTaskReviewer({ task, mats, onInventory }) {
  const source = mats.filter((m) => m.kind !== "ai");
  let out;
  if (source.length) {
    const inv = await ensureInventory(source.map((m) => ({ m, subject: task.subject })), onInventory, null, null);
    out = await writeReviewer(`"${task.title}" (${task.subject})`, source.flatMap((m) => inv[m.id]?.ideas || []));
  } else {
    out = (await callClaude(REVIEWER_SYSTEM, [{ role: "user", content: `Make a reviewer for "${task.title}" (${task.subject}, ${task.type}). Teacher notes: ${task.notes || "none"}. No material was uploaded, so cover the key ideas a student would likely need for this topic at a middle school level, and say at the top that it is a general reviewer.` }])).trim();
    if (!out) throw new Error("empty");
  }
  return { text: out, topic: source[0]?.topic || "" };
}

// A reviewer for a subject (and optionally some topics and a focus word), from the class's notes.
export async function makeSubjectReviewer({ subject, tops, focus, pool, onInventory, onProgress }) {
  if (!pool.length) throw new Error("none");
  await ensureInventory(pool.map((m) => ({ m, subject })), onInventory, onProgress, null);
  onProgress("Collecting the key ideas");
  const word = focus.trim();
  let ideas = word ? await notes.findIdeas({ subjects: [subject], topics: tops, q: word, limit: 250, any: true }) : null;
  if (!ideas || !ideas.length) ideas = await notes.findIdeas({ subjects: [subject], topics: tops, limit: 250 });
  if (!ideas || !ideas.length) throw new Error("no ideas");
  onProgress("Writing the reviewer");
  const label = [subject, tops.join(", "), word && `focus: ${word}`].filter(Boolean).join(", ");
  return { text: await writeReviewer(label, ideas), title: `Reviewer: ${tops.length === 1 ? tops[0] : word || subject}`, topic: tops.length === 1 ? tops[0] : "" };
}

// Memory tricks for a group of ideas: returns { index: trick }.
export async function askTricks(group) {
  const list = group.map((x, i) => `${i + 1}. ${x.t}: ${x.d}`).join("\n");
  const raw = await callClaude("You help students remember facts. Reply with ONLY JSON.", [{ role: "user", content: `For each numbered idea write one short memory trick: a vivid mental picture, a rhyme, or a silly sentence a student can picture. Under 25 words each. Reply ONLY {"m":[{"n":1,"trick":"..."}]}\n\n${list}` }]);
  const j = parseJSON(raw);
  const map = {};
  (j?.m || []).forEach((x) => { if (x && x.trick) map[Number(x.n) - 1] = String(x.trick).slice(0, 220); });
  return map;
}

// Mark a student's own explanation of an idea.
export async function markTeach(it, text) {
  const raw = await callClaude("You are a kind, precise tutor. Reply with ONLY JSON.", [{ role: "user", content: `The correct idea: ${it.t}. ${it.d}\n\nThe student explained it in their own words:\n"""${text.slice(0, 1500)}"""\n\nReply ONLY {"verdict":"solid" or "partly" or "not yet","good":"what they got right, one sentence","missing":"what is missing or wrong, one sentence (empty if nothing)","simpler":"a simple everyday analogy, one sentence"}` }]);
  const j = parseJSON(raw);
  if (j && j.verdict) return { verdict: String(j.verdict), good: String(j.good || ""), missing: String(j.missing || ""), simpler: String(j.simpler || "") };
  return null;
}

// Mark a blurt: which numbered ideas the student remembered.
export async function markBlurt(set, text) {
  const list = set.map((x, i) => `${i + 1}. ${x.t}: ${x.d}`).join("\n");
  const raw = await callClaude("You mark a student's memory test fairly and strictly. Reply with ONLY JSON.", [{ role: "user", content: `These are the ideas the student should know, numbered:\n${list}\n\nThe student wrote this from memory:\n"""${text.slice(0, 4000)}"""\n\nFor each numbered idea decide if the writing shows they remember it ("got"), only partly ("partly"), or not at all ("missed"). Also list statements that are wrong. Reply ONLY {"got":[numbers],"partly":[numbers],"missed":[numbers],"wrong":[{"said":"","fix":""}]}` }]);
  return parseJSON(raw);
}
export { normTopic };
