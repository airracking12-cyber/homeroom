import test from "node:test";
import assert from "node:assert/strict";
import { createNotes, toMaterial, normTopic, matchTopic, topicList, chunk, readAll, ideaId, MAX_BODY } from "../src/lib/notes.js";

// A tiny stand-in for the database client: tables in memory, a query builder that works like the real one, and rpc().
function fakeDb({ tables = {}, rpc = {}, fail = {}, session = { user: { id: "me" } } } = {}) {
  const calls = [];
  const from = (name) => {
    const q = { name, filters: [], orders: [], range: null, op: "select", payload: null };
    const run = async () => {
      calls.push({ name, op: q.op, filters: q.filters.map((f) => f.t + ":" + f.c), range: q.range });
      if (fail[name]) return { data: null, error: { message: "boom" } };
      let rows = (tables[name] || []).slice();
      for (const f of q.filters) rows = rows.filter((r) => (f.t === "eq" ? r[f.c] === f.v : f.v.includes(r[f.c])));
      if (q.op === "insert") { tables[name] = [...(tables[name] || []), q.payload]; return { data: null, error: null }; }
      if (q.op === "delete") { tables[name] = (tables[name] || []).filter((r) => !rows.includes(r)); return { data: null, error: null }; }
      if (q.op === "update") { rows.forEach((r) => Object.assign(r, q.payload)); return { data: rows.map((r) => ({ id: r.id })), error: null }; }
      rows.sort((a, b) => { for (const o of q.orders) { if (a[o.c] < b[o.c]) return o.asc ? -1 : 1; if (a[o.c] > b[o.c]) return o.asc ? 1 : -1; } return 0; });
      if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1);
      return { data: rows, error: null };
    };
    const b = {
      select: () => b, eq: (c, v) => (q.filters.push({ t: "eq", c, v }), b), in: (c, v) => (q.filters.push({ t: "in", c, v }), b),
      order: (c, o) => (q.orders.push({ c, asc: !o || o.ascending !== false }), b), range: (a, z) => ((q.range = [a, z]), b),
      insert: (p) => ((q.op = "insert"), (q.payload = p), b), delete: () => ((q.op = "delete"), b), update: (p) => ((q.op = "update"), (q.payload = p), b),
      then: (res, rej) => run().then(res, rej),
    };
    return b;
  };
  const rpcFn = async (name, args) => { calls.push({ rpc: name, args }); const f = rpc[name]; return f ? f(args) : { data: null, error: { message: "no such function" } }; };
  return { client: { from, rpc: rpcFn, auth: { getSession: async () => ({ data: { session } }) } }, calls, tables };
}
const row = (i, extra = {}) => ({ id: `n${String(i).padStart(5, "0")}`, class_id: "c1", owner: "me", author: "ana", subject: "Science", topic: null, title: `Note ${i}`, kind: "upload", task_id: null, task_title: null, n: 100, ideas_n: 0, ideas_src: null, created_at: "2026-10-01T00:00:00Z", ...extra });

test("a database row becomes the summary the screens use, without its text", () => {
  const m = toMaterial(row(1, { topic: "Cells", ideas_n: 7, ideas_src: "ai", task_id: "t1", task_title: "Quiz" }), "me");
  assert.deepEqual({ id: m.id, topic: m.topic, ic: m.ic, src: m.src, taskId: m.taskId, by: m.by, mine: m.mine, orphan: m.orphan, text: m.text }, { id: "n00001", topic: "Cells", ic: 7, src: "ai", taskId: "t1", by: "ana", mine: true, orphan: false, text: undefined });
  assert.equal(toMaterial(row(2, { owner: "other" }), "me").mine, false);
  assert.equal(toMaterial(row(3, { owner: null }), "me").orphan, true);
});

test("topics: spacing and case are tidied, and a known spelling is reused", () => {
  assert.equal(normTopic("  Cell   Division "), "Cell Division");
  assert.equal(normTopic("x".repeat(100)).length, 60);
  assert.equal(matchTopic("cell division", ["Cell Division", "Mitosis"]), "Cell Division");
  assert.equal(matchTopic("Meiosis", ["Cell Division"]), "Meiosis");
  assert.equal(matchTopic("   ", ["Cell Division"]), "");
});

test("topic list: most used first, and only for the chosen subjects", () => {
  const ms = [{ subject: "Sci", topic: "Cells" }, { subject: "Sci", topic: "Cells" }, { subject: "Sci", topic: "Atoms" }, { subject: "Math", topic: "Algebra" }, { subject: "Math", topic: "" }];
  assert.deepEqual(topicList(ms, []).map((x) => x.topic), ["Cells", "Algebra", "Atoms"]);
  assert.deepEqual(topicList(ms, ["Sci"]), [{ topic: "Cells", n: 2 }, { topic: "Atoms", n: 1 }]);
});

test("chunk and ideaId", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(ideaId("n1", 3), "n1:3");
});

test("list reads every note even past the 1000-row page limit, and stops cleanly", async () => {
  const db = fakeDb({ tables: { notes: Array.from({ length: 2300 }, (_, i) => row(i)) } });
  const out = await createNotes(db.client).list("c1");
  assert.equal(out.length, 2300);
  assert.equal(new Set(out.map((m) => m.id)).size, 2300);
  assert.equal(db.calls.filter((c) => c.name === "notes").length, 3);
});

test("list returns null (not an empty library) when the database can't be reached", async () => {
  const db = fakeDb({ fail: { notes: true } });
  const orig = console.error; console.error = () => {};
  try { assert.equal(await createNotes(db.client).list("c1"), null); } finally { console.error = orig; }
});

test("a note's text is fetched when asked for, once, in small groups", async () => {
  const rows = Array.from({ length: 95 }, (_, i) => ({ ...row(i), body: `text ${i}` }));
  const db = fakeDb({ tables: { notes: rows } });
  const notes = createNotes(db.client);
  const ids = rows.map((r) => r.id);
  const first = await notes.text(ids);
  assert.equal(first.n00094, "text 94");
  assert.equal(db.calls.filter((c) => c.op === "select").length, 3); // 40 + 40 + 15
  await notes.text(ids);
  assert.equal(db.calls.filter((c) => c.op === "select").length, 3); // held now, nothing more to fetch
});

test("add stores the note (capped, as the signed-in person) and remembers its text", async () => {
  const db = fakeDb();
  const notes = createNotes(db.client);
  assert.equal(await notes.add({ id: "x1", classId: "c1", author: "ana", subject: "Science", topic: "  Cells ", title: "T", text: "a".repeat(MAX_BODY + 50), kind: "upload", taskId: "t9" }), true);
  const saved = db.tables.notes[0];
  assert.equal(saved.body.length, MAX_BODY);
  assert.equal(saved.topic, "Cells");
  assert.equal(saved.task_id, "t9");
  assert.equal("owner" in saved, false); // the database fills in who the owner is
  assert.equal((await notes.text(["x1"])).x1.length, MAX_BODY);
});

test("add reports failure instead of pretending", async () => {
  const db = fakeDb({ fail: { notes: true } });
  const orig = console.error; console.error = () => {};
  try { assert.equal(await createNotes(db.client).add({ id: "x", classId: "c", author: "a", subject: "S", title: "t", text: "b" }), false); } finally { console.error = orig; }
});

test("relabel says whether anything was actually changed", async () => {
  const db = fakeDb({ tables: { notes: [row(1)] } });
  const notes = createNotes(db.client);
  assert.equal(await notes.relabel("n00001", { topic: " Cells ", subject: "Science" }), true);
  assert.equal(db.tables.notes[0].topic, "Cells");
  assert.equal(await notes.relabel("missing", { topic: "x" }), false); // not yours / not there
});

test("ideas: saved through the database function, then served from memory in order", async () => {
  const db = fakeDb({ rpc: { save_note_ideas: ({ p_ideas }) => ({ data: p_ideas.length, error: null }) } });
  const notes = createNotes(db.client);
  const n = await notes.saveIdeas("n1", "ai", [{ t: "A", d: "a", c: "k" }, { t: "B", d: "b" }]);
  assert.equal(n, 2);
  const call = db.calls.find((c) => c.rpc === "save_note_ideas");
  assert.deepEqual(call.args.p_ideas[1], { t: "B", d: "b", c: "", k: "fact" });
  const got = await notes.ideasFor(["n1"]);
  assert.deepEqual(got.n1.ideas.map((i) => i.t), ["A", "B"]);
  assert.equal(db.calls.filter((c) => c.name === "note_ideas").length, 0);
});

test("ideasFor reads stored ideas in their saved order, across pages", async () => {
  const ideas = [];
  for (let i = 0; i < 1500; i++) ideas.push({ note_id: "n1", idx: i, title: `T${i}`, detail: "d", keyword: "", kind: "fact" });
  const db = fakeDb({ tables: { note_ideas: ideas.slice().reverse() } });
  const got = await createNotes(db.client).ideasFor(["n1"]);
  assert.equal(got.n1.ideas.length, 1500);
  assert.equal(got.n1.ideas[0].t, "T0");
  assert.equal(got.n1.ideas[1499].t, "T1499");
});

test("find ideas: matches carry the same id the study screens use; a few words fall back to any word", async () => {
  let n = 0;
  const hit = { note_id: "n9", idx: 4, title: "Mitosis", detail: "cell division", keyword: "mitosis", kind: "fact", subject: "Science", topic: "Cells", note_title: "Cells" };
  const db = fakeDb({ rpc: { find_ideas: (a) => { n++; return { data: a.p_any ? [hit] : [], error: null }; } } });
  const out = await createNotes(db.client).findIdeas({ subjects: ["Science"], q: "how cells divide" });
  assert.equal(n, 2);
  assert.equal(out[0].id, "n9:4");
  assert.equal(out[0].mt, "Cells");
  const first = db.calls.find((c) => c.rpc === "find_ideas");
  assert.deepEqual([first.args.p_subjects, first.args.p_topics, first.args.p_any], [["Science"], null, false]);
});

test("find ideas: one word that matches nothing is not retried, and an error is null", async () => {
  let n = 0;
  const db = fakeDb({ rpc: { find_ideas: () => { n++; return { data: [], error: null }; } } });
  assert.deepEqual(await createNotes(db.client).findIdeas({ q: "photosynthesis" }), []);
  assert.equal(n, 1);
  const bad = fakeDb({ rpc: { find_ideas: () => ({ data: null, error: { message: "x" } }) } });
  const orig = console.error; console.error = () => {};
  try { assert.equal(await createNotes(bad.client).findIdeas({ q: "x" }), null); } finally { console.error = orig; }
});

test("search returns note ids with plain snippets", async () => {
  const db = fakeDb({ rpc: { search_notes: () => ({ data: [{ id: "n1", rank: 1, snippet: "the [[cell]] wall\nis rigid" }], error: null }) } });
  assert.deepEqual(await createNotes(db.client).search("cell"), [{ id: "n1", snippet: "the cell wall is rigid" }]);
});

test("readAll gives the error back instead of partial data", async () => {
  const db = fakeDb({ fail: { notes: true } });
  const r = await readAll(() => db.client.from("notes").select("*"));
  assert.equal(r.data, null);
  assert.ok(r.error);
});
