import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseActions, MAX_PROPOSED } from "../src/lib/assistant-actions.js";
import { isRealDate } from "../src/lib/dates.js";

const reply = (arr) => `Sure.\n<<ACTIONS>>${JSON.stringify(arr)}`;
const ok = { type: "add_task", title: "Quiz", subject: "Math", taskType: "Quiz", priority: "High", deadline: "2026-11-03", notes: "Chapter 4" };

test("isRealDate rejects days that do not exist", () => {
  for (const d of ["2026-02-31", "2026-13-01", "2026-00-10", "2026-04-31", "2025-02-29", "2026-1-5", "tomorrow", "", null, undefined, 20261103]) assert.equal(isRealDate(d), false, String(d));
  for (const d of ["2026-11-03", "2028-02-29", "2026-12-31"]) assert.equal(isRealDate(d), true, d);
});

test("a well-formed action becomes a proposal, nothing more", () => {
  assert.deepEqual(parseActions(reply([ok])), [{ title: "Quiz", subject: "Math", deadline: "2026-11-03", type: "Quiz", priority: "High", notes: "Chapter 4" }]);
});

test("an impossible date, a missing subject or an unknown action type is dropped", () => {
  assert.deepEqual(parseActions(reply([{ ...ok, deadline: "2026-02-31" }, { ...ok, subject: "  " }, { ...ok, type: "delete_task" }, null, "x"])), []);
});

test("unknown task types and priorities fall back, text is bounded, non-strings are refused", () => {
  const [t] = parseActions(reply([{ ...ok, taskType: "Party", priority: "Urgent", title: "x".repeat(500), notes: "n".repeat(5000) }]));
  assert.equal(t.type, "Homework"); assert.equal(t.priority, "Medium"); assert.equal(t.title.length, 120); assert.equal(t.notes.length, 600);
  assert.deepEqual(parseActions(reply([{ ...ok, title: { a: 1 } }, { ...ok, subject: 5 }])), []);
});

test("a flood of tasks is capped, and broken JSON or no marker gives nothing", () => {
  assert.equal(parseActions(reply(Array.from({ length: 40 }, () => ok))).length, MAX_PROPOSED);
  assert.deepEqual(parseActions("<<ACTIONS>>[{oops"), []);
  assert.deepEqual(parseActions("Just an answer."), []);
});

test("the assistant screen only writes a task from the confirm step", () => {
  const src = readFileSync(new URL("../src/app/Assistant.jsx", import.meta.url), "utf8");
  const calls = src.match(/addTask\(/g) || [];
  assert.equal(calls.length, 1, "one addTask call");
  assert.ok(src.indexOf("addTask(") > src.indexOf("const decide"), "and it is inside decide()");
  assert.match(src, /Add \{m\.proposed\.length === 1/);
});
