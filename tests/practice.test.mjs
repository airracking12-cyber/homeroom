import { test } from "node:test";
import assert from "node:assert/strict";
import { practiceKey, ideaRef, practicePrompt, parsePractice, mergePractice, missingIdeas, itemFor, checkPoints, keyPointsOf, mcFor, BATCH } from "../src/lib/practice.js";

const batch = [{ t: "Photosynthesis", d: "Plants turn light, water and carbon dioxide into sugar and oxygen.", c: "sugar" }, { t: "Mitochondria", d: "The mitochondria release energy from food.", c: "energy" }];
const good = { n: 1, mc: { q: "What do plants make?", c: ["Sugar", "Salt", "Metal", "Smoke"], a: 0, w: "Plants make sugar." }, why: { q: "Why do plants need light?", a: "Light gives the energy to make sugar.", k: ["light energy", "make sugar"] }, apply: { q: "A plant is kept in a dark cupboard. What happens?", a: "It cannot make sugar, so it weakens.", k: ["no sugar", "weakens"] }, mis: "You may be thinking plants eat soil.", tr: "Sun plus water makes sweet leaves." };

test("keys: practice rows are shared by the class under the note", () => {
  assert.equal(practiceKey("8-16", "n1"), "8-16:practice:n1");
  assert.deepEqual(ideaRef("n1:7"), { noteId: "n1", idx: 7 });
  assert.deepEqual(ideaRef("a:b:12"), { noteId: "a:b", idx: 12 });
});

test("the prompt asks for every kind of question, for every idea, and says what a good answer needs", () => {
  const p = practicePrompt(batch, { subject: "Science", title: "Cells" });
  for (const w of ["mc:", "why:", "apply:", "mis:", "tr:", "key points", "NEW situation", "1. Photosynthesis", "2. Mitochondria"]) assert.ok(p.includes(w), w);
  assert.ok(BATCH >= 4 && BATCH <= 8);
});

test("parsePractice keeps only complete, sensible parts and ignores junk", () => {
  const out = parsePractice({ p: [good, { n: 2, mc: { q: "x", c: ["a", "b"], a: 0 } }, { n: 9, why: good.why }, { n: 1, why: good.why }] }, batch);
  assert.deepEqual(Object.keys(out), ["0"], "idea 2 had nothing usable, idea 9 does not exist, a repeat is ignored");
  assert.equal(out[0].mc.a, 0); assert.equal(out[0].why.k.length, 2); assert.match(out[0].mis, /You may be thinking/);
  const partial = parsePractice({ p: [{ n: 2, why: good.why, mc: { q: "q", c: ["a", "b", "c", "d"], a: 7 } }] }, batch);
  assert.ok(partial[1].why && partial[1].mc === null, "a bad multiple-choice is dropped, the good 'why' stays");
  assert.deepEqual(parsePractice(null, batch), {}); assert.deepEqual(parsePractice({ p: "no" }, batch), {});
});

test("merging never drops what is stored, and missing ideas are listed", () => {
  const a = mergePractice(null, { 0: { why: good.why } });
  const b = mergePractice(a, { 2: { why: good.why } });
  assert.deepEqual(Object.keys(b.items), ["0", "2"]);
  assert.deepEqual(missingIdeas(b, 4), [1, 3]);
  assert.equal(itemFor({ n1: b }, "n1:2").why.q, good.why.q); assert.equal(itemFor({ n1: b }, "n1:1"), null); assert.equal(itemFor({}, "zz:1"), null);
});

test("open answers are checked on the device against the key points", () => {
  const r = checkPoints("Light gives the plant energy so it can make sugar", ["light energy", "make sugar", "chlorophyll"]);
  assert.deepEqual(r.hit, ["light energy", "make sugar"]); assert.deepEqual(r.missed, ["chlorophyll"]); assert.ok(r.ratio > 0.6);
  assert.equal(checkPoints("I don't know", ["light energy"]).ratio, 0);
  assert.equal(checkPoints("anything", []).ratio, 0);
  assert.ok(keyPointsOf({ c: "sugar", d: "Plants turn sunlight into chemical energy stored as sugar." }).includes("sugar"));
});

test("a multiple-choice question is the stored one when there is one, else a plain local one", () => {
  const idea = { id: "n1:0", t: "Photosynthesis", d: batch[0].d, c: "sugar" };
  const local = (i) => ({ type: "mc", ref: [i.id], q: "local", c: ["a", "b", "c", "d"], a: 1, w: "w" });
  assert.equal(mcFor(idea, { n1: mergePractice(null, { 0: out0() }) }, local).q, "What do plants make?");
  assert.equal(mcFor(idea, {}, local).q, "local");
  function out0() { return parsePractice({ p: [good] }, batch)[0]; }
});
