// Reading notes, simply and without loss. Pure logic (no network, no screen): tests/ingest.test.mjs.
//   1. The raw input is saved first and never touched by the assistant.
//   2. It is split into chunks on natural boundaries (headings, paragraphs, whole sentences).
//   3. Each chunk is read on its own and its result is saved at once, so a stop (a limit, an error, Cancel, a closed app)
//      resumes from the last finished chunk.
//   4. Progress is real chunks done. 100% only after the last chunk is saved AND the coverage check has run.
//   5. A coverage check lists every part that is not represented, so only those parts can be read again.
export const CHUNK = 3000;        // target characters per chunk
export const MAX_PART = 120000;   // the database cap for one note's text; a longer input becomes numbered parts
export const MAX_IDEAS = 300;     // the database keeps at most this many ideas per note
export const PER_MIN = 15;        // the AI proxy allows 20 calls a minute per student; stay under it
export const SHORT = 40;          // a chunk with fewer letters than this (a lone heading) has nothing to learn

// ── natural boundaries ────────────────────────────────────────────────────────────────────────────────────────────
const seg = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "sentence" }) : null;
// Whole sentences covering the string exactly (their pieces join back to the original).
export function sentences(s) {
  s = String(s || "");
  if (seg) return [...seg.segment(s)].map((x) => x.segment);
  const out = []; const re = /[.!?]+["'\u201d\u2019)\]]*(?:\s+|$)/g; let last = 0, m;
  while ((m = re.exec(s))) { out.push(s.slice(last, m.index + m[0].length)); last = m.index + m[0].length; if (!m[0]) re.lastIndex++; }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
const letters = (s) => (String(s).match(/\p{L}/gu) || []).length;
const KEYWORD = /^(chapter|lesson|unit|topic|section|part|module|week|quarter|module|aralin|kabanata|yunit)\b/i;
export function isHeading(line, alone = true) {
  const t = String(line || "").trim();
  if (!t || t.length > 80 || /[.!?,;:]$/.test(t)) return false;
  if (/^#{1,6}\s+\S/.test(t) || KEYWORD.test(t) || /^\d+(\.\d+)*[.)]?\s+\S/.test(t)) return true;
  if (letters(t) >= 3 && t === t.toUpperCase() && t !== t.toLowerCase()) return true;
  return alone && t.split(/\s+/).length <= 8; // a short line on its own, with no end punctuation
}

// Cut a too-long sentence at its last comma, semicolon, colon or space inside the limit. Only a single sentence longer
// than a whole chunk is ever cut at all, and it is cut at a word, never in the middle of one.
function cutLong(text, start, end, size) {
  const out = []; let at = start;
  while (end - at > size) {
    const win = text.slice(at, at + size);
    let k = Math.max(win.lastIndexOf("; "), win.lastIndexOf(": "), win.lastIndexOf(", "), win.lastIndexOf(" "));
    if (k < size * 0.3) k = win.lastIndexOf(" ");
    const cut = at + (k > 0 ? k + 1 : size);
    out.push({ start: at, end: cut, forced: true }); at = cut;
  }
  out.push({ start: at, end, forced: out.length > 0 });
  return out;
}

// Units: each paragraph (split at blank lines), and any paragraph longer than a chunk is split into whole sentences.
// Units are contiguous: together they cover the text exactly, so nothing can fall between chunks.
function units(text, size) {
  const out = []; const re = /\n[ \t]*\n+/g; let from = 0, m;
  const push = (start, end) => {
    if (end <= start) return;
    const raw = text.slice(start, end);
    const lines = raw.split("\n").filter((l) => l.trim());
    const heading = lines.length === 1 && isHeading(lines[0], true);
    if (raw.length <= size) { out.push({ start, end, heading }); return; }
    let at = start;
    for (const s of sentences(raw)) {
      const e = at + s.length;
      if (s.length > size) cutLong(text, at, e, size).forEach((u) => out.push({ ...u, heading: false }));
      else out.push({ start: at, end: e, heading: false });
      at = e;
    }
  };
  while ((m = re.exec(text))) { push(from, m.index + m[0].length); from = m.index + m[0].length; }
  push(from, text.length);
  return out;
}

// Chunks of about `size` characters that start at headings where they can and never end on a lone heading.
// chunk.text is exactly text.slice(start, end), so the chunks cover the input with no gap and no overlap.
export function makeChunks(text, size = CHUNK) {
  text = String(text || "");
  if (!text.trim()) return [];
  const us = units(text, size);
  const chunks = []; let cur = null; let section = "";
  const label = (u) => text.slice(u.start, u.end).trim().replace(/^#+\s*/, "").slice(0, 60);
  const flush = () => { if (cur) { chunks.push(cur); cur = null; } };
  for (const u of us) {
    if (cur && cur.end - cur.start + (u.end - u.start) > size) {
      const last = cur.units[cur.units.length - 1];
      if (last.heading && cur.units.length > 1) { cur.units.pop(); const keep = last; cur.end = keep.start; flush(); cur = { start: keep.start, end: keep.end, units: [keep], section: cur ? cur.section : section }; }
      else flush();
    }
    if (cur && u.heading && cur.end - cur.start >= size * 0.4) flush();
    if (u.heading) section = label(u);
    if (!cur) cur = { start: u.start, end: u.end, units: [u], section };
    else { cur.end = u.end; cur.units.push(u); }
  }
  flush();
  // a trailing piece of only whitespace or a lone heading joins the chunk before it
  if (chunks.length > 1 && letters(text.slice(chunks.at(-1).start, chunks.at(-1).end)) < SHORT) { const t = chunks.pop(); chunks.at(-1).end = t.end; chunks.at(-1).units.push(...t.units); }
  return chunks.map((c, i) => ({ i, start: c.start, end: c.end, text: text.slice(c.start, c.end), section: c.section || "", forced: c.units.some((u) => u.forced) }));
}
export const chunkLabel = (c) => c.section || c.text.trim().replace(/\s+/g, " ").slice(0, 60);
export const isShort = (s) => letters(s) < SHORT;

// An input over the database cap becomes numbered parts, cut at chunk boundaries (never mid-sentence), each within the cap.
export function planParts(text, max = MAX_PART) {
  text = String(text || "").trim();
  if (text.length <= max) return [text];
  const parts = []; let from = 0, to = 0;
  for (const c of makeChunks(text, CHUNK)) {
    if (c.end - from > max && to > from) { parts.push(text.slice(from, to)); from = to; }
    to = c.end;
  }
  parts.push(text.slice(from));
  return parts.filter((p) => p.trim());
}

// A pasted note with no title is named after its first line, so the library doesn't fill up with "Untitled notes".
export function deriveTitle(text, fallback = "Untitled notes") {
  const line = String(text || "").split("\n").map((l) => l.trim().replace(/^#+\s*/, "")).find((l) => letters(l) >= 3) || "";
  if (!line) return fallback;
  const first = sentences(line)[0].trim();
  return (first.length <= 60 ? first : `${line.slice(0, 57).replace(/\s+\S*$/, "")}...`).replace(/[.:;,]+$/, "");
}

// ── the job: one note being read ─────────────────────────────────────────────────────────────────────────────────
export const keyOf = (x) => `${x.t} ${x.d}`.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export function newJob({ id, noteId, title, chunks, now = Date.now() }) {
  return { v: 1, id, noteId, title, createdAt: now, state: "running", error: null, covered: false, ideas: 0,
    chunks: chunks.map((c) => ({ i: c.i, status: "todo", ideas: 0, label: chunkLabel(c) })) };
}
const FINISHED = new Set(["done", "short"]);
export const finishedCount = (job) => job.chunks.filter((c) => FINISHED.has(c.status)).length;

// Real progress: chunks finished over chunks in total. It never shows 100% until the coverage check has run and found
// every part represented, whatever else is true.
export function progressOf(job) {
  const total = job.chunks.length, done = finishedCount(job);
  let pct = total ? Math.floor((100 * done) / total) : 0;
  if (!job.covered) pct = Math.min(pct, 99);
  const next = job.chunks.find((c) => !FINISHED.has(c.status));
  return { done, total, pct, part: next ? next.i + 1 : total, label: job.covered ? `All ${total} parts` : `Part ${next ? next.i + 1 : total} of ${total}` };
}

export const WHY = { failed: "The assistant couldn't read this part.", empty: "The assistant found nothing in this part.", todo: "This part wasn't read yet.", working: "This part wasn't finished.", full: "This note already holds the most ideas one note can (300)." };
export function coverage(job) {
  const missed = job.chunks.filter((c) => !FINISHED.has(c.status)).map((c) => ({ i: c.i, label: c.label, why: c.status === "failed" && c.err === "empty" ? WHY.empty : WHY[c.status] || WHY.failed }));
  return { complete: missed.length === 0, missed, represented: finishedCount(job), total: job.chunks.length };
}

// Plain-language stage for the screen.
export function stageText(job, waiting = false) {
  if (job.covered) return job.ideas ? `Done. Every part is in your study ideas (${job.ideas}).` : "Done. There was too little text to find study ideas in.";
  switch (job.state) {
    case "cancelled": return "Stopped. What was finished is saved.";
    case "paused": return job.error === "limit" ? "The assistant needs a minute. Nothing is lost." : job.error === "save" ? "Couldn't save just now. Check your connection." : "Paused.";
    case "attention": return "Finished, but some parts need another look.";
    case "full": return "This note is full. Some parts need a new note.";
    default: return waiting ? "Waiting a moment so the assistant can keep up" : job.state === "checking" ? "Checking that nothing was missed" : "Finding the study ideas";
  }
}

// ── pacing: at most `perMin` assistant calls in any 60 seconds ──────────────────────────────────────────────────
const defaultSleep = (ms, signal) => new Promise((res, rej) => {
  if (signal?.aborted) return rej(Object.assign(new Error("cancelled"), { name: "AbortError" }));
  const t = setTimeout(res, ms);
  signal?.addEventListener?.("abort", () => { clearTimeout(t); rej(Object.assign(new Error("cancelled"), { name: "AbortError" })); }, { once: true });
});
export function makePacer({ perMin = PER_MIN, now = Date.now, sleep = defaultSleep, onWait } = {}) {
  const stamps = [];
  return {
    async wait(signal) {
      for (;;) {
        const t = now();
        while (stamps.length && t - stamps[0] >= 60000) stamps.shift();
        if (stamps.length < perMin) { stamps.push(t); onWait?.(0); return; }
        const ms = 60000 - (t - stamps[0]); onWait?.(ms); await sleep(ms, signal);
      }
    },
  };
}

// ── the runner ───────────────────────────────────────────────────────────────────────────────────────────────────
// deps: callChunk(chunk) -> [{t,d,c,k}], loadIdeas() -> list the database already holds for this note, saveIdeas(list) -> count|null,
//       persist(job), onUpdate(job), pacer, signal.
// `only` re-reads just those chunk numbers (the one-tap "read the missed parts again"). Ideas are only ever APPENDED, so an idea's
// place in the list (and so its flashcard id) never changes. If the app stops after a save but before the chunk is marked done,
// the chunk is read again on resume and its repeats are dropped by keyOf.
export async function runIngest({ job, chunks, only, deps }) {
  const { callChunk, loadIdeas, saveIdeas, persist, onUpdate, pacer, signal } = deps;
  const short = deps.short || isShort, cap = deps.max ?? MAX_IDEAS; // reading a PDF page group has no "too short" and no idea cap
  const tick = async () => { await persist(job); onUpdate?.(job); };
  const aborted = () => !!signal?.aborted;
  job.state = "running"; job.error = null;
  const todo = job.chunks.filter((c) => (only ? only.includes(c.i) : !FINISHED.has(c.status)));
  todo.forEach((c) => { if (c.status !== "todo") { c.status = "todo"; delete c.err; } });
  await tick();
  let base = (await loadIdeas()) || [];
  for (const rec of todo) {
    if (aborted()) { job.state = "cancelled"; break; }
    const chunk = chunks[rec.i];
    if (short(chunk.text)) { rec.status = "short"; await tick(); continue; }
    try { await pacer.wait(signal); } catch { job.state = "cancelled"; break; }
    if (aborted()) { job.state = "cancelled"; break; }
    rec.status = "working"; onUpdate?.(job);
    let fresh;
    try { fresh = await callChunk(chunk); }
    catch (e) {
      if (aborted() || e?.name === "AbortError") { rec.status = "todo"; job.state = "cancelled"; break; }
      rec.status = "failed"; rec.err = e?.limited ? "limit" : "read";
      if (e?.limited) { job.state = "paused"; job.error = "limit"; await tick(); break; } // everything after it would hit the same limit
      await tick(); continue;                                                                // one bad part never stops the others
    }
    if (!fresh.length) { rec.status = "failed"; rec.err = "empty"; await tick(); continue; }
    const have = new Set(base.map(keyOf));
    const add = fresh.filter((x) => !have.has(keyOf(x)));
    if (base.length + add.length > cap) {
      job.chunks.filter((c) => !FINISHED.has(c.status) && c.i >= rec.i).forEach((c) => { c.status = "full"; });
      job.state = "full"; await tick(); break;
    }
    const next = base.concat(add);
    const saved = await saveIdeas(next);
    if (saved == null) { rec.status = "failed"; rec.err = "save"; job.state = "paused"; job.error = "save"; await tick(); break; }
    base = next; rec.status = "done"; rec.ideas = add.length; job.ideas = base.length;
    await tick();
  }
  const cov = coverage(job);
  if (job.state === "running") {
    if (cov.complete) { job.covered = true; job.state = "done"; } else job.state = "attention";
  }
  await tick();
  return job;
}
