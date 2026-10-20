// Reading notes without loss: chunking on natural boundaries, real progress, resume, cancel, retry, coverage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHUNK, MAX_PART, MAX_IDEAS, PER_MIN, makeChunks, planParts, sentences, isHeading, newJob, progressOf, coverage, stageText, makePacer, runIngest, keyOf } from "../src/lib/ingest.js";

const sent = (n, w = 9) => `Sentence number ${n} explains one clear idea about topic ${n % 7} in plain words, step ${w}.`;
const para = (n0, k) => Array.from({ length: k }, (_, i) => sent(n0 + i)).join(" ");
const doc = (paras, k = 6) => Array.from({ length: paras }, (_, i) => para(i * k, k)).join("\n\n");
const joined = (cs) => cs.map((c) => c.text).join("");

test("chunks cover the input exactly: no gap, no overlap, nothing lost", () => {
  const text = doc(40);
  const cs = makeChunks(text, 1200);
  assert.ok(cs.length > 5);
  assert.equal(joined(cs), text);
  cs.forEach((c, i) => { assert.equal(c.i, i); assert.equal(c.text, text.slice(c.start, c.end)); if (i) assert.equal(c.start, cs[i - 1].end); });
  assert.equal(cs[0].start, 0); assert.equal(cs.at(-1).end, text.length);
});

test("chunks stay near the size and break between paragraphs or sentences, never mid-sentence", () => {
  const text = doc(60);
  const cs = makeChunks(text, 1500);
  for (const c of cs) {
    assert.ok(c.text.length <= 1500 + 100, `a chunk of ${c.text.length}`);
    if (c.end < text.length) assert.match(c.text, /[.!?]\s*$/, "ends at a sentence end");
    assert.ok(!c.forced);
  }
});

test("a long paragraph with no blank lines is split into whole sentences", () => {
  const text = para(0, 120);
  const cs = makeChunks(text, 1000);
  assert.ok(cs.length > 4); assert.equal(joined(cs), text);
  for (const c of cs.slice(0, -1)) assert.match(c.text, /[.!?]\s*$/);
});

test("a single sentence longer than a chunk is cut at a word, never inside a word, and is flagged", () => {
  const text = Array.from({ length: 1500 }, (_, i) => `word${i}`).join(" ") + ".";
  const cs = makeChunks(text, 1000);
  assert.ok(cs.length > 5); assert.equal(joined(cs), text);
  assert.ok(cs.some((c) => c.forced));
  for (const c of cs.slice(0, -1)) assert.match(c.text, /\s$/, "cut after a space");
});

test("headings start a chunk and are never left alone at the end of one", () => {
  const body = (n) => para(n * 10, 7);
  const text = ["Photosynthesis", body(0), body(1), "Cellular Respiration", body(2), "Chapter 3: Genetics", body(3)].join("\n\n");
  const cs = makeChunks(text, 900);
  assert.equal(joined(cs), text);
  for (const c of cs.slice(0, -1)) { const last = c.text.trim().split("\n").filter(Boolean).at(-1); assert.ok(!isHeading(last, true) || last.length > 80 || /[.!?]$/.test(last), `chunk ends on heading: ${last}`); }
  assert.ok(cs.some((c) => c.section === "Cellular Respiration"));
  assert.ok(cs.some((c) => c.text.trimStart().startsWith("Cellular Respiration") || c.text.includes("Cellular Respiration")));
});

test("heading detection", () => {
  for (const h of ["# Photosynthesis", "Chapter 4", "1.2 Cell structure", "THE WATER CYCLE", "Newton's laws"]) assert.equal(isHeading(h, true), true, h);
  for (const t of ["This is a normal sentence about cells.", "It was the best of times, it was the worst", "", "a".repeat(120)]) assert.equal(isHeading(t, true), false, t);
});

test("sentences() pieces join back to the original", () => {
  const t = "Dr. Cruz said so. Is it true? Yes! It costs 3.5 pesos. Done";
  assert.equal(sentences(t).join(""), t);
});

test("empty or blank input gives no chunks", () => { assert.deepEqual(makeChunks(""), []); assert.deepEqual(makeChunks("  \n\n "), []); });

test("an input over the database cap becomes numbered parts that join back, each within the cap, cut at sentence ends", () => {
  const text = doc(1500, 6);
  assert.ok(text.length > MAX_PART);
  const parts = planParts(text);
  assert.ok(parts.length >= 2);
  parts.forEach((p) => assert.ok(p.length <= MAX_PART, `part of ${p.length}`));
  parts.slice(0, -1).forEach((p) => assert.match(p, /[.!?]\s*$/));
  assert.equal(parts.join("").replace(/\s+/g, ""), text.replace(/\s+/g, ""), "nothing dropped");
  assert.deepEqual(planParts("short note"), ["short note"]);
});

const fakeJob = (n) => newJob({ id: "j", noteId: "n", title: "T", chunks: Array.from({ length: n }, (_, i) => ({ i, section: `Section ${i + 1}`, text: "" })) });

test("progress is real chunks done, and never 100% until the coverage check has passed", () => {
  const job = fakeJob(8);
  assert.deepEqual([progressOf(job).pct, progressOf(job).label], [0, "Part 1 of 8"]);
  for (let i = 0; i < 2; i++) job.chunks[i].status = "done";
  assert.deepEqual([progressOf(job).pct, progressOf(job).label], [25, "Part 3 of 8"]);
  job.chunks.forEach((c) => { c.status = "done"; });
  assert.equal(progressOf(job).pct, 99, "every chunk is saved but the check hasn't run");
  job.covered = true;
  assert.equal(progressOf(job).pct, 100); assert.match(progressOf(job).label, /All 8 parts/);
});

test("coverage lists every part that isn't represented, with a plain reason", () => {
  const job = fakeJob(4);
  job.chunks[0].status = "done"; job.chunks[1].status = "failed"; job.chunks[2].status = "short"; job.chunks[3].status = "full";
  const cov = coverage(job);
  assert.equal(cov.complete, false); assert.deepEqual(cov.missed.map((m) => m.i), [1, 3]);
  assert.match(cov.missed[0].why, /couldn't read/); assert.match(cov.missed[1].why, /300/);
  assert.equal(cov.represented, 2);
});

// ── the runner, with fakes ─────────────────────────────────────────────────────────────────────────────────────
const textOf = (n) => Array.from({ length: n }, (_, i) => `${para(i * 20, 6)}`).join("\n\n");
function harness({ fail = {}, limitAt = -1, perChunk = 2, existing = [], saveFail = false, abortAfter = Infinity } = {}) {
  const text = textOf(8); const chunks = makeChunks(text, 900); const ctl = new AbortController();
  const db = { list: existing.slice(), saves: [] }; const persisted = []; const calls = [];
  const deps = {
    signal: ctl.signal, pacer: { wait: async () => {} },
    callChunk: async (c) => { calls.push(c.i); if (calls.length > abortAfter) ctl.abort(); if (c.i === limitAt) throw Object.assign(new Error("slow"), { limited: true }); if (fail[c.i] && fail[c.i]--) throw new Error("bad json");
      return Array.from({ length: perChunk }, (_, k) => ({ t: `c${c.i} idea ${k}`, d: `Fact ${c.i}-${k} from this part.`, c: "fact", k: "fact" })); },
    loadIdeas: async () => db.list.slice(), saveIdeas: async (l) => { if (saveFail) return null; db.list = l.slice(); db.saves.push(l.length); return l.length; },
    persist: async (j) => { persisted.push(JSON.stringify(j)); }, onUpdate: () => {},
  };
  return { chunks, deps, db, persisted, calls, ctl, job: newJob({ id: "j", noteId: "n", title: "T", chunks }) };
}

test("it reads every chunk on its own and saves after EACH one; 100% only after the check", async () => {
  const h = harness(); const seen = [];
  h.deps.onUpdate = (j) => seen.push(progressOf(j).pct);
  const job = await runIngest({ job: h.job, chunks: h.chunks, deps: h.deps });
  assert.equal(h.db.saves.length, h.chunks.length, "one save per chunk");
  assert.deepEqual(h.db.saves, h.chunks.map((_, i) => (i + 1) * 2), "results are appended, growing one chunk at a time");
  assert.equal(job.state, "done"); assert.equal(job.covered, true); assert.equal(progressOf(job).pct, 100);
  assert.equal(seen.at(-1), 100); assert.ok(seen.slice(0, -1).every((p) => p <= 99), "no fake 100% along the way");
  assert.ok(h.persisted.length >= h.chunks.length + 1, "autosaved after every chunk");
});

test("one failed chunk never stops the rest; coverage lists it; retry reads ONLY that chunk", async () => {
  const h = harness({ fail: { 2: 1 } });
  let job = await runIngest({ job: h.job, chunks: h.chunks, deps: h.deps });
  assert.equal(job.state, "attention"); assert.equal(job.covered, false); assert.ok(progressOf(job).pct <= 99);
  const cov = coverage(job); assert.deepEqual(cov.missed.map((m) => m.i), [2]);
  assert.equal(h.calls.length, h.chunks.length, "every other chunk was still read");
  h.calls.length = 0;
  job = await runIngest({ job, chunks: h.chunks, only: cov.missed.map((m) => m.i), deps: h.deps });
  assert.deepEqual(h.calls, [2], "only the failed chunk was read again");
  assert.equal(job.covered, true); assert.equal(h.db.list.length, h.chunks.length * 2);
});

test("hitting the assistant's limit pauses safely: finished chunks are kept, the rest wait, resume continues from there", async () => {
  const h = harness({ limitAt: 3 });
  let job = await runIngest({ job: h.job, chunks: h.chunks, deps: h.deps });
  assert.equal(job.state, "paused"); assert.equal(job.error, "limit");
  assert.deepEqual(job.chunks.slice(0, 3).map((c) => c.status), ["done", "done", "done"]);
  assert.equal(h.db.list.length, 6, "the three finished chunks are saved");
  assert.match(stageText(job), /needs a minute/);
  h.calls.length = 0; h.deps.callChunk = (orig => async (c) => { h.calls.push(c.i); return [{ t: `c${c.i} idea`, d: `Fact for ${c.i}.`, c: "x", k: "fact" }]; })();
  job = await runIngest({ job, chunks: h.chunks, deps: h.deps });
  assert.deepEqual(h.calls, h.chunks.map((_, i) => i).slice(3), "resumed at the first unfinished chunk");
  assert.equal(job.covered, true);
});

test("cancel keeps every finished chunk and leaves the job resumable", async () => {
  const h = harness({ abortAfter: 2 });
  const job = await runIngest({ job: h.job, chunks: h.chunks, deps: h.deps });
  assert.equal(job.state, "cancelled"); assert.equal(job.covered, false);
  const done = job.chunks.filter((c) => c.status === "done").length;
  assert.ok(done >= 2 && done < h.chunks.length); assert.equal(h.db.list.length, done * 2);
  assert.ok(job.chunks.every((c) => c.status !== "working"));
});

test("a closed app resumes from its saved job: finished chunks are not read again, and repeated ideas are not doubled", async () => {
  const h = harness({ limitAt: 4 });
  await runIngest({ job: h.job, chunks: h.chunks, deps: h.deps });
  const saved = JSON.parse(h.persisted.at(-1)); // what was in storage when the app closed
  const again = harness(); again.db.list = h.db.list.slice(); again.chunks = h.chunks;
  again.deps.callChunk = async (c) => { again.calls.push(c.i); return [{ t: `c${c.i} idea 0`, d: `Fact ${c.i}-0 from this part.`, c: "x", k: "fact" }, { t: `c${c.i} idea 1`, d: `Fact ${c.i}-1 from this part.`, c: "x", k: "fact" }]; };
  const job = await runIngest({ job: saved, chunks: h.chunks, deps: again.deps });
  assert.ok(again.calls.every((i) => i >= 4), "chunks 0 to 3 were not read again");
  assert.equal(job.covered, true); assert.equal(again.db.list.length, h.chunks.length * 2);
  const re = harness(); re.db.list = h.db.list.slice(0, 2); const dup = await runIngest({ job: newJob({ id: "j", noteId: "n", title: "T", chunks: h.chunks.slice(0, 1) }), chunks: h.chunks.slice(0, 1), deps: { ...re.deps, loadIdeas: async () => re.db.list.slice(), callChunk: async () => [{ t: "c0 idea 0", d: "Fact 0-0 from this part.", c: "x", k: "fact" }] } });
  assert.equal(re.db.list.length, 2, "the repeat was dropped");
  assert.equal(keyOf({ t: "A b", d: "C." }), keyOf({ t: "a  B", d: "c" }));
});

test("nothing is silently cut: past the 300-idea limit the leftover parts are marked 'full' and listed", async () => {
  const h = harness({ perChunk: 100 });
  const job = await runIngest({ job: h.job, chunks: h.chunks, deps: h.deps });
  assert.equal(job.state, "full"); assert.equal(h.db.list.length, MAX_IDEAS);
  const cov = coverage(job); assert.equal(cov.complete, false);
  assert.ok(cov.missed.length >= 1 && cov.missed.every((m) => /300/.test(m.why)));
  assert.equal(job.chunks.filter((c) => c.status === "done").length + cov.missed.length, h.chunks.length);
  assert.ok(progressOf(job).pct <= 99);
});

test("a save that fails pauses the job instead of pretending it worked", async () => {
  const h = harness({ saveFail: true });
  const job = await runIngest({ job: h.job, chunks: h.chunks, deps: h.deps });
  assert.equal(job.state, "paused"); assert.equal(job.error, "save"); assert.equal(job.chunks[0].status, "failed");
  assert.match(stageText(job), /Check your connection/);
});

test("a chunk that gives back nothing is a missed part, not a success", async () => {
  const h = harness(); h.deps.callChunk = async (c) => (c.i === 1 ? [] : [{ t: `c${c.i}`, d: `Fact ${c.i} here.`, c: "x", k: "fact" }]);
  const job = await runIngest({ job: h.job, chunks: h.chunks, deps: h.deps });
  assert.equal(job.state, "attention"); assert.deepEqual(coverage(job).missed.map((m) => [m.i, /nothing/.test(m.why)]), [[1, true]]);
});

test("pacing: at most 15 calls in any 60 seconds, then it waits for the oldest to age out", async () => {
  let t = 0; const slept = [];
  const pacer = makePacer({ now: () => t, sleep: async (ms) => { slept.push(ms); t += ms; } });
  for (let i = 0; i < PER_MIN; i++) await pacer.wait();
  assert.deepEqual(slept, [], "the first 15 go straight through");
  await pacer.wait();
  assert.equal(slept.length, 1); assert.equal(slept[0], 60000);
  assert.equal(PER_MIN < 20, true, "stays under the proxy's 20 a minute");
});

test("a chunk is the unit: the default size matches what was used before", () => { assert.equal(CHUNK, 3000); });

test("an untitled paste is named after its first line, never silently 'Untitled notes' when there is text", async () => {
  const { deriveTitle } = await import("../src/lib/ingest.js");
  assert.equal(deriveTitle("# Photosynthesis\n\nPlants make food."), "Photosynthesis");
  assert.equal(deriveTitle("\n\nChapter 3: The Water Cycle\nRain falls."), "Chapter 3: The Water Cycle");
  assert.ok(deriveTitle("a ".repeat(100) + "end").length <= 62);
  assert.equal(deriveTitle("  \n "), "Untitled notes");
});
