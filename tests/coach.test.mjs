import { test } from "node:test";
import assert from "node:assert/strict";
import { SESSION_LEN, CONF, priority, makeQuestion, interleave, buildSession, startSession, currentQuestion, isDone, flagOf, recordAnswer, applyOutcome, coachSummary, saveSession, loadSession, sessionKey } from "../src/lib/coach.js";
import { BOX_DAYS, mcFallback } from "../src/lib/study-core.js";
import { addDays, todayISO } from "../src/lib/dates.js";

const TODAY = todayISO();
const ideas = Array.from({ length: 30 }, (_, i) => ({ id: `n${i % 3}:${Math.floor(i / 3)}`, mid: `n${i % 3}`, mt: ["Cells", "Energy", "Genes"][i % 3], subject: "Science", t: `Idea ${i}`, d: `Idea ${i} explains the important concept number ${i} in careful detail.`, c: `concept` }));
const local = (idea) => mcFallback(idea, ideas);
const why = { q: "Why?", a: "Because.", k: ["because"] }, apply = { q: "Apply it.", a: "Like so.", k: ["like"] };
const practice = Object.fromEntries(["n0", "n1", "n2"].map((n) => [n, { items: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, { why, apply, mis: "You may be thinking it is the same as another idea.", tr: "trick", mc: { q: "MC?", c: ["a", "b", "c", "d"], a: 2, w: "because" } }])) }]));
const fresh = () => ({ cards: {}, log: [], plan: null });
const seeded = (n = 0) => () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };

test("all existing review history is kept: old cards (b, due, s, m) are read and extended, never replaced", () => {
  const study = { cards: { "n0:0": { b: 3, due: TODAY, s: 7, m: 2 } }, log: [{ at: 1, kind: "cards", subj: "x", n: 3, ok: 2 }], plan: { a: 1 } };
  const q = makeQuestion(ideas[0], { it: practice.n0.items[0], card: study.cards["n0:0"], local });
  const next = applyOutcome(study, q, { score: 1, conf: 2 });
  assert.deepEqual([next.cards["n0:0"].s, next.cards["n0:0"].m, next.cards["n0:0"].b], [8, 2, 4]);
  assert.deepEqual(next.log, study.log); assert.deepEqual(next.plan, study.plan);
});

test("weak-first: due, low-box, often-missed and confident-but-wrong ideas rank above comfortable ones", () => {
  const calm = priority({ b: 5, due: addDays(TODAY, 16), s: 6, m: 0 }, TODAY), due = priority({ b: 2, due: TODAY, s: 4, m: 2 }, TODAY), sureWrong = priority({ b: 2, due: addDays(TODAY, 1), s: 4, m: 2, w: 2 }, TODAY);
  assert.ok(due > calm && sureWrong > calm); assert.ok(priority(null, TODAY) > calm, "new ideas outrank mastered ones");
  const study = fresh(); study.cards["n0:0"] = { b: 5, due: addDays(TODAY, 16), s: 6, m: 0 }; study.cards["n1:0"] = { b: 1, due: TODAY, s: 3, m: 3 };
  const s = buildSession(ideas.slice(0, 6), study, practice, { n: 3, local, rand: () => 0 });
  assert.ok(s.map((q) => q.ideaId).includes("n1:0")); assert.ok(!s.map((q) => q.ideaId).includes("n0:0"));
});

test("a session is 10 questions, interleaved: no two in a row from one topic while another waits", () => {
  const s = buildSession(ideas, fresh(), practice, { local, rand: seeded(3) });
  assert.equal(s.length, SESSION_LEN);
  for (let i = 1; i < s.length; i++) assert.notEqual(s[i].mid, s[i - 1].mid, `question ${i} repeats a topic`);
  const sameBlock = interleave(ideas.slice(0, 9).filter((x) => x.mid === "n0").map((x) => makeQuestion(x, { it: null, card: null, local })).concat(ideas.filter((x) => x.mid === "n1").slice(0, 3).map((x) => makeQuestion(x, { it: null, card: null, local }))));
  assert.notEqual(sameBlock[0].mid, sameBlock[1].mid);
});

test("question types mix: recall, explain-in-your-own-words, why, apply (and pick-the-answer), growing with how well it is known", () => {
  const kinds = (b) => new Set(Array.from({ length: 6 }, (_, k) => makeQuestion(ideas[0], { it: practice.n0.items[0], card: { b }, local, shift: k }).kind));
  assert.ok(kinds(0).has("mc") && kinds(0).has("recall")); assert.ok(!kinds(0).has("apply"), "new ideas are not asked to apply yet");
  assert.ok(kinds(2).has("explain") && kinds(2).has("why")); assert.ok(kinds(5).has("apply") && kinds(5).has("why"));
  const s = buildSession(ideas, { cards: Object.fromEntries(ideas.map((x, i) => [x.id, { b: [1, 2, 4][i % 3], due: TODAY, s: 3, m: 1 }])), log: [] }, practice, { local, rand: seeded(5) });
  const seen = new Set(s.map((q) => q.kind)); assert.ok(seen.size >= 4, `kinds in one session: ${[...seen]}`);
  const noItems = makeQuestion(ideas[0], { it: null, card: { b: 5 }, local });
  assert.ok(["explain", "mc", "recall"].includes(noItems.kind), "without stored questions it falls back and never breaks");
  for (const k of ["why", "apply", "explain"]) { const q = makeQuestion(ideas[0], { it: practice.n0.items[0], card: { b: 3 }, local, force: k }); assert.ok(q.q && q.model && q.points.length, k); }
});

test("confidence: three steps, and both kinds of mismatch are flagged", () => {
  assert.deepEqual(CONF.map((c) => c.v), [0, 1, 2]);
  assert.equal(flagOf(2, 0), "confident-wrong"); assert.equal(flagOf(2, 0.5), "confident-wrong");
  assert.equal(flagOf(0, 1), "unsure-right");
  assert.equal(flagOf(1, 1), null); assert.equal(flagOf(2, 1), null); assert.equal(flagOf(0, 0), null);
});

test("Leitner update: right and sure moves up, right but unsure stays, partly is back tomorrow, wrong is box 1 and due today", () => {
  const q = { ideaId: "n0:0" }, base = { cards: { "n0:0": { b: 2, due: TODAY, s: 4, m: 1 } } };
  const up = applyOutcome(base, q, { score: 1, conf: 2 }, TODAY).cards["n0:0"]; assert.deepEqual([up.b, up.due], [3, addDays(TODAY, BOX_DAYS[3])]);
  const stay = applyOutcome(base, q, { score: 1, conf: 0 }, TODAY).cards["n0:0"]; assert.deepEqual([stay.b, stay.due, stay.u], [2, addDays(TODAY, BOX_DAYS[2]), 1]);
  const part = applyOutcome(base, q, { score: 0.5, conf: 1 }, TODAY).cards["n0:0"]; assert.deepEqual([part.b, part.due], [2, addDays(TODAY, 1)]);
  const wrong = applyOutcome(base, q, { score: 0, conf: 2 }, TODAY).cards["n0:0"]; assert.deepEqual([wrong.b, wrong.due, wrong.w, wrong.m], [1, TODAY, 1, 2]);
  assert.equal(applyOutcome({ cards: {} }, q, { score: 1, conf: 2 }, TODAY).cards["n0:0"].b, 2, "a new idea answered right and sure goes to box 2, exactly as a Good flashcard always did");
  assert.equal(applyOutcome({ cards: { "n0:0": { b: 5, due: TODAY, s: 1, m: 0 } } }, q, { score: 1, conf: 2 }, TODAY).cards["n0:0"].b, 5, "box 5 is the top");
});

test("a wrong answer is asked again later in a different form, once, and the misunderstanding is on hand", () => {
  let s = startSession(buildSession(ideas.slice(0, 12), fresh(), practice, { n: 6, local, rand: seeded(7) }), "test");
  const first = currentQuestion(s), n0 = s.qs.length;
  s = recordAnswer(s, { score: 0, conf: 2, answer: "x" }, { it: practice[first.mid].items[Number(first.ideaId.split(":")[1])], card: null, local });
  assert.equal(s.qs.length, n0 + 1); assert.equal(s.results[0].flag, "confident-wrong");
  const again = s.qs.find((q) => q.retest); assert.ok(again && again.ideaId === first.ideaId && again.kind !== first.kind, "same idea, different form");
  assert.ok(s.qs.indexOf(again) >= 1 && s.qs.indexOf(again) <= 5, "a few questions later");
  assert.match(first.mis, /You may be thinking/);
  // answering the re-test wrong does not loop forever
  while (!isDone(s)) { const q = currentQuestion(s); s = recordAnswer(s, { score: 0, conf: 1 }, { it: null, card: null, local }); if (s.qs.length > 20) assert.fail("loops"); }
  assert.equal(s.qs.filter((q) => q.ideaId === first.ideaId).length, 2, "asked twice at most");
});

test("the summary: what went well, what to work on, exactly one concrete tip", () => {
  const R = (t, topic, kind, score, conf) => ({ t, topic, kind, score, conf, flag: flagOf(conf, score) });
  const a = coachSummary([R("A", "Cells", "mc", 1, 2), R("B", "Cells", "explain", 1, 2), R("C", "Energy", "why", 0, 2), R("D", "Energy", "apply", 0, 2), R("E", "Genes", "recall", 1, 0)]);
  assert.equal(a.total, 5); assert.equal(a.right, 3); assert.equal(a.pct, 60);
  assert.ok(a.well.some((l) => /3 of 5/.test(l)) && a.well.some((l) => /Cells is in good shape/.test(l)));
  assert.ok(a.work.some((l) => /Energy needs another pass/.test(l)) && a.work.some((l) => /felt sure but missed: C, D/.test(l)) && a.work.some((l) => /weren't sure: E/.test(l)));
  assert.match(a.tip, /say it out loud/); assert.equal(typeof a.tip, "string");
  assert.deepEqual(a.flags, { confidentWrong: ["C", "D"], unsureRight: ["E"] }); assert.deepEqual(a.comeBack, ["C", "D"]);
  const perfect = coachSummary([R("A", "Cells", "mc", 1, 2), R("B", "Cells", "mc", 1, 1)]);
  assert.ok(perfect.work.length >= 1 && perfect.tip && perfect.pct === 100);
  assert.ok(coachSummary([]).well.length && coachSummary([]).tip);
});

test("autosave: a session is saved after every answer on the device and in the database, and picked up again, never lost", async () => {
  const mem = new Map(); const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const remote = new Map(); const store = { set: async (k, v) => { remote.set(k, v); return true; }, get: async (k) => remote.get(k) };
  let s = startSession(buildSession(ideas.slice(0, 12), fresh(), practice, { n: 5, local, rand: seeded(2) }), "Cells");
  s = recordAnswer(s, { score: 1, conf: 2 }); s = recordAnswer(s, { score: 0.5, conf: 1 });
  await saveSession("mika", s, { store, storage });
  assert.equal(remote.get(sessionKey("mika")).results.length, 2);
  const back = await loadSession("mika", { store: { get: async () => undefined }, storage }); // the database is out of reach: the device copy still has it
  assert.equal(back.results.length, 2); assert.equal(back.i, 2); assert.equal(back.label, "Cells");
  const viaDb = await loadSession("mika", { store, storage: { getItem: () => null } }); assert.equal(viaDb.i, 2);
  let done = s; while (!isDone(done)) done = recordAnswer(done, { score: 1, conf: 2 });
  await saveSession("mika", done, { store, storage }); assert.equal(await loadSession("mika", { store, storage }), null, "a finished session is not offered again");
  await saveSession("mika", null, { store, storage }); assert.equal(storage.getItem("hr:session:mika"), null);
});
