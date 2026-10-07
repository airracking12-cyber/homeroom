import test from "node:test";
import assert from "node:assert/strict";
import { pad, toISO, parse, addDays, diffDays, relLabel, weekStartOf, weekLabel, weekData, timeAgo } from "../src/lib/dates.js";

// Wednesday 7 Oct 2026, mid-afternoon local time
const NOW = new Date(2026, 9, 7, 15, 0, 0);
const withClock = (fn) => async (t) => { t.mock.timers.enable({ apis: ["Date"], now: NOW }); await fn(t); };

test("pad, toISO and parse round-trip without shifting the day", () => {
  assert.equal(pad(5), "05");
  assert.equal(toISO(new Date(2026, 0, 9)), "2026-01-09");
  assert.equal(toISO(parse("2026-03-08")), "2026-03-08");
  assert.equal(toISO(parse("2026-11-01")), "2026-11-01"); // both are US daylight-saving change days
});

test("addDays crosses months, years and leap days, forwards and backwards", () => {
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2025-02-28", 1), "2025-03-01");
  assert.equal(addDays("2025-12-31", 1), "2026-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2026-10-07", 0), "2026-10-07");
});

test("weeks start on Monday", () => {
  assert.equal(weekStartOf("2026-10-05"), "2026-10-05"); // Monday stays
  assert.equal(weekStartOf("2026-10-07"), "2026-10-05"); // Wednesday
  assert.equal(weekStartOf("2026-10-11"), "2026-10-05"); // Sunday belongs to the week that began Monday
  assert.equal(weekStartOf("2026-10-12"), "2026-10-12"); // next Monday
  assert.equal(weekStartOf("2026-01-01"), "2025-12-29"); // across a year boundary
  assert.match(weekLabel("2026-10-05"), / to /);
});

test("diffDays counts whole days from today", withClock(() => {
  assert.equal(diffDays("2026-10-07"), 0);
  assert.equal(diffDays("2026-10-08"), 1);
  assert.equal(diffDays("2026-10-06"), -1);
  assert.equal(diffDays("2026-10-17"), 10);
}));

test("relLabel speaks in plain words near today", withClock(() => {
  assert.equal(relLabel("2026-10-07"), "Today");
  assert.equal(relLabel("2026-10-08"), "Tomorrow");
  assert.equal(relLabel("2026-10-06"), "Yesterday");
  assert.equal(relLabel("2026-10-04"), "3 days ago");
  assert.match(relLabel("2026-10-10"), /^[A-Za-z]+$/); // within a week: a weekday name
  assert.notEqual(relLabel("2026-10-20"), "Today");     // further out: a date
}));

test("timeAgo rounds to the friendliest unit", withClock(() => {
  const now = Date.now();
  assert.equal(timeAgo(now - 20 * 1000), "Just now");
  assert.equal(timeAgo(now - 5 * 60000), "5 min ago");
  assert.equal(timeAgo(now - 3 * 3600000), "3 hr ago");
  assert.equal(timeAgo(now - 24 * 3600000), "Yesterday");
  assert.equal(timeAgo(now - 3 * 86400000), "3 days ago");
}));

test("weekData gathers a week's tasks and the notes linked to them or written in it", () => {
  const tasks = [
    { id: "a", deadline: "2026-10-05" }, { id: "b", deadline: "2026-10-11" },
    { id: "c", deadline: "2026-10-12" }, { id: "d", deadline: "2026-10-04" },
  ];
  const at = (iso, h = 12) => new Date(...iso.split("-").map((x, i) => (i === 1 ? Number(x) - 1 : Number(x))), h).getTime();
  const materials = [
    { id: 1, taskId: "a", at: at("2026-09-01") },   // linked to a task this week
    { id: 2, taskId: "zz", at: at("2026-10-08") },  // written this week
    { id: 3, taskId: "zz", at: at("2026-10-12", 0) }, // exactly next Monday midnight: not this week
    { id: 4, taskId: "zz", at: at("2026-10-04") },  // the Sunday before
  ];
  const { ts, ms } = weekData("2026-10-05", tasks, materials);
  assert.deepEqual(ts.map((t) => t.id), ["a", "b"]);
  assert.deepEqual(ms.map((m) => m.id), [1, 2]);
});
