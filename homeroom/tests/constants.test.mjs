import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { SUBJ, SUBJ_REG, subjColor, TYPES, REVIEW_TYPES, STATUSES, PRIORITIES, DEFAULT_SUBJECTS, statusLabel, EMAIL_RE } from "../src/lib/constants.js";

test("photo proof is gone: nothing asks for, uploads, shows or stores a task photo", () => {
  const dir = (d) => readdirSync(new URL(d, import.meta.url), { recursive: true }).filter((f) => /\.jsx?$/.test(f)).map((f) => readFileSync(new URL(d + f, import.meta.url), "utf8"));
  const app = [readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8"), ...dir("../src/app/"), ...dir("../src/lib/")].join("\n");
  const track = readFileSync(new URL("../src/app/track/Track.jsx", import.meta.url), "utf8");
  for (const gone of ["requestStatus", "ProofPanel", "ProofThumbs", "uploadProof", "submitProof", "task-proofs", "proofs", "Show your work", "Ask for a photo", "Photo sent", "compressImage", "sniffFile"]) {
    assert.ok(!app.includes(gone), `"${gone}" is gone from the app`);
  }
  assert.ok(!/MAX_PROOF/.test(readFileSync(new URL("../src/lib/constants.js", import.meta.url), "utf8")));
  assert.match(track, /onStatus=\{\(s\) => setStatusKeep\(detail\.id, s\)\}/, "marking done in the task sheet goes straight through");
});

test("every review type is a real task type, and the lists have no duplicates", () => {
  for (const t of REVIEW_TYPES) assert.ok(TYPES.includes(t), `${t} missing from TYPES`);
  for (const list of [TYPES, PRIORITIES, DEFAULT_SUBJECTS]) assert.equal(new Set(list).size, list.length);
  assert.deepEqual(DEFAULT_SUBJECTS, Object.keys(SUBJ));
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
