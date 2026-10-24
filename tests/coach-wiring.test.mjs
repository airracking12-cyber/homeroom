// The coach and the AI rule, as wired in the real source: the assistant is used only to build the shared database (notes ideas and
// practice questions) and to write reviewers; studying itself never calls it. Reviewers are one per scope for the whole class.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const read = (p) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");
const REVIEW = read("app/review/Review.jsx"), RUNS = read("app/review/runs.jsx"), COACH = read("app/review/coach.jsx"), ING = read("app/ingest.jsx"), STUDY = read("lib/study.js");

test("AI rule: nothing you do while studying calls the assistant", () => {
  for (const f of readdirSync(new URL("../src/app/review/", import.meta.url)).filter((x) => /\.jsx?$/.test(x))) {
    const t = read("app/review/" + f);
    for (const bad of ["callClaude", "askTricks", "markTeach", "markBlurt", "buildQuiz", "callSearch", "streamClaude"]) assert.ok(!t.includes(bad), `${f} uses ${bad}`);
  }
  // the only things in Review that reach the assistant are the three reviewer writers
  const used = [...REVIEW.matchAll(/\b(make(?:Weekly|TaskReviewer|SubjectReviewer))\(/g)].map((m) => m[1]).sort();
  assert.deepEqual([...new Set(used)], ["makeSubjectReviewer", "makeTaskReviewer", "makeWeekly"]);
  assert.match(RUNS, /itemFor\(practice, x\.id\)\?\.tr/, "memory tricks come from the stored practice items");
  assert.match(RUNS, /mcFor\(i, practice,/, "quiz questions come from the stored practice items");
  assert.match(RUNS, /checkPoints\(text, keyPointsOf\(x\)\)/, "blurting is checked on the device");
  assert.match(RUNS, /How did your explanation compare\?/, "teach it back is rated by the student against key points");
});

test("practice questions are written once per note for the whole class, by whoever claims it first, and stored", () => {
  assert.match(ING, /startPractice/); assert.match(ING, /PRACTICE_SYSTEM/);
  assert.match(ING, /claim\(store, `\$\{classRef\.current\}:claim:practice:\$\{noteId\}`, user\)/);
  assert.match(ING, /if \(!c\.won\) return; \/\/ a classmate is already on it/);
  assert.match(ING, /mergePractice\(cur, add\)/, "what is stored is merged, never replaced");
  assert.match(ING, /fns\.current\.startPractice\?\.\(\{ noteId: e\.noteId/, "it starts right after a note's ideas are covered");
  assert.match(ING, /ensurePractice/);
  assert.match(REVIEW, /d\.ingest\.ensurePractice\(missing\)/, "an older note gets its questions prepared when you start studying it");
});

test("Coach me: first in the list, suggested first, and it keeps every other technique", () => {
  const ids = [...STUDY.matchAll(/\{ id: "([a-z]+)", goal:/g)].map((m) => m[1]);
  assert.equal(ids[0], "coach");
  for (const id of ["cards", "cloze", "match", "mnemonic", "teach", "blurt", "quiz", "exam", "plan"]) assert.ok(ids.includes(id), `${id} is still there`);
  assert.match(REVIEW, /const rec = focus \? \["coach", "quiz"\] : \["coach", \.\.\.\(REC\[period\] \|\| \[\]\)\]/);
  assert.match(REVIEW, /run\.kind === "coach" && <CoachRun/);
});

test("active recall with a confidence rating BEFORE the answer is revealed, and both mismatches are flagged in the moment", () => {
  assert.match(COACH, /const \[stage, setStage\] = useState\("conf"\)/, "every question starts by asking how sure you are");
  assert.match(COACH, /First, how sure are you that you can answer this\?/);
  const at = (k) => COACH.indexOf(`{stage === "${k}" &&`);
  assert.ok(at("conf") > 0 && at("conf") < at("answer") && at("answer") < at("rate") && at("rate") < at("feedback"), "rate confidence, then answer, then see the answer");
  assert.ok(!/q\.model|q\.mc\.a/.test(COACH.slice(at("conf"), at("answer"))), "the answer is not shown while you rate your confidence");
  assert.ok(!/q\.model/.test(COACH.slice(at("answer"), at("rate"))), "nor while you are answering");
  assert.match(COACH, /"confident-wrong": "You felt sure, but this one slipped/); assert.match(COACH, /"unsure-right": "You weren't sure, but you got it/);
});

test("each answer is saved before its feedback shows, so quitting mid-session loses nothing; a finished session is cleared", () => {
  const fin = COACH.slice(COACH.indexOf("const finalize"), COACH.indexOf("const submit"));
  assert.ok(fin.indexOf("onSave?.(next)") > -1 && fin.indexOf("onSave?.(next)") < fin.indexOf('setStage("feedback")'));
  assert.match(fin, /update\(\(st\) => applyOutcome\(st, cur, \{ score, conf \}\)\)/, "the spaced-repetition box moves at once too");
  assert.match(COACH, /onSave\?\.\(null\)/);
  assert.match(REVIEW, /You have a Coach session in progress/); assert.match(REVIEW, /loadSession\(d\.user, \{ store \}\)/);
});

test("the session ends with a coaching summary and one celebration", () => {
  for (const w of ["What went well", "What to work on", "One tip", "Coming back tomorrow"]) assert.ok(COACH.includes(w), w);
  assert.match(COACH, /<Celebrate \/>/); assert.equal((COACH.match(/<Celebrate \/>/g) || []).length, 1);
  assert.match(COACH, /className="celebrate" aria-hidden="true"/);
});

test("reviewers are made once for the whole class, first come first served: open the existing one, else claim, else wait", () => {
  assert.equal((REVIEW.match(/await claim\(store, claimKey, d\.user\)/g) || []).length, 3, "weekly, task and subject reviewers all claim first");
  assert.equal((REVIEW.match(/release\(store, claimKey, d\.user\)/g) || []).length, 3, "and release the claim when they finish or fail");
  assert.match(REVIEW, /const have = existing\(\); \/\/ the whole class shares one/); assert.match(REVIEW, /const have = aiNote\(\); \/\/ one reviewer per task/);
  assert.match(REVIEW, /holderLine/); assert.match(REVIEW, /function useWaitFor/);
  assert.match(REVIEW, /Open the class reviewer/);
  assert.ok(!/Make it again/.test(REVIEW), "no second copy of the same weekly reviewer");
});
