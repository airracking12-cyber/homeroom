import test from "node:test";
import assert from "node:assert/strict";
import { SUBJ, SUBJ_REG, subjColor, TYPES, REVIEW_TYPES, STATUSES, PRIORITIES, DEFAULT_SUBJECTS, needsProofType, wantsProof, statusLabel, EMAIL_RE, MAX_PROOF } from "../src/lib/constants.js";

test("quizzes, study sessions and exams never ask for a photo; other tasks do unless switched off", () => {
  for (const type of REVIEW_TYPES) {
    assert.equal(needsProofType({ type }), false, type);
    assert.equal(wantsProof({ type }), false, type);
  }
  assert.equal(wantsProof({ type: "Homework" }), true);
  assert.equal(wantsProof({ type: "Homework", proof: false }), false);
  assert.equal(wantsProof({ type: "Project", proof: true }), true);
});

test("every review type is a real task type, and the lists have no duplicates", () => {
  for (const t of REVIEW_TYPES) assert.ok(TYPES.includes(t), `${t} missing from TYPES`);
  for (const list of [TYPES, PRIORITIES, DEFAULT_SUBJECTS]) assert.equal(new Set(list).size, list.length);
  assert.deepEqual(DEFAULT_SUBJECTS, Object.keys(SUBJ));
  assert.ok(MAX_PROOF >= 1);
});

test("statusLabel reads well and tolerates missing values", () => {
  assert.equal(statusLabel("todo"), "Not started");
  assert.equal(statusLabel("progress"), "In progress");
  assert.equal(statusLabel("done"), "Done");
  assert.equal(statusLabel(undefined), "Not started");
  assert.equal(statusLabel("something-else"), "Not started");
  assert.deepEqual(STATUSES.map((s) => s[0]), ["todo", "progress", "done"]);
});

test("subject colours: known subjects keep theirs, new ones get a stable colour, and the class registry wins", () => {
  assert.equal(subjColor("Mathematics"), SUBJ.Mathematics);
  const first = subjColor("Science"), second = subjColor("Science");
  assert.match(first, /^#[0-9A-Fa-f]{6}$/);
  assert.equal(first, second, "same name, same colour, every time");
  assert.match(subjColor(undefined), /^#[0-9A-Fa-f]{6}$/);
  SUBJ_REG["Robotics"] = "#123456";            // how App registers a subject the class added
  assert.equal(subjColor("Robotics"), "#123456");
  delete SUBJ_REG["Robotics"];
});

test("email check accepts normal addresses and refuses obvious mistakes", () => {
  for (const ok of ["a@b.co", "first.last@school.edu.ph", "x+tag@mail.com"]) assert.ok(EMAIL_RE.test(ok), ok);
  for (const bad of ["", "no-at-sign", "a@b", "a b@c.com", "@c.com", "a@.com", "a@b.c"]) assert.equal(EMAIL_RE.test(bad), false, bad);
});
