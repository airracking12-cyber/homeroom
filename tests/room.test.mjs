// The Room (home screen): what it says about your day, which tasks it pins, and that it stays the hub of the app.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { daySummary, pinnedTasks, corkStatus, greeting, plural, PINNED } from "../src/app/room/model.js";
import { addDays, todayISO } from "../src/lib/dates.js";
import { nice } from "../src/lib/helpers.js";

const read = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const ROOM = read("app/room/Room.jsx"), CSS = read("styles/room.css");
const due = (n, title = `t${n}`) => ({ id: title, title, deadline: addDays(todayISO(), n) });

test("the day summary says what is really due, and is calm when nothing is", () => {
  assert.equal(daySummary([]), "Nothing is due. Nice and calm.");
  assert.equal(daySummary([due(0)]), "1 due today.");
  assert.equal(daySummary([due(0), due(-3), due(2), due(5), due(30)]), "1 due today, 1 overdue, 2 more in the next 7 days.");
  assert.equal(daySummary([due(-1), due(-9)]), "2 overdue.");
  assert.equal(daySummary([due(40)]), "Nothing is due. Nice and calm.", "far-off tasks are not today's news");
});

test("the corkboard pins what is due first, overdue included, and never more than fit", () => {
  const open = [due(5, "c"), due(-2, "a"), due(0, "b"), due(9, "d"), due(1, "e"), due(20, "f")];
  assert.deepEqual(pinnedTasks(open).map((t) => t.title), ["a", "b", "e", "c"]);
  assert.equal(pinnedTasks(open).length, PINNED); assert.equal(pinnedTasks(open, 2).length, 2);
  assert.deepEqual(pinnedTasks([]), []);
  assert.equal(open[0].title, "c", "the tasks themselves are not reordered");
});

test("the corkboard's plate speaks in the singular and the plural", () => {
  assert.equal(corkStatus([due(0)]), "1 sticky note needs you today");
  assert.equal(corkStatus([due(0), due(-1)]), "2 sticky notes need you today");
  assert.equal(corkStatus([due(3)]), "1 task is due this week"); assert.equal(corkStatus([due(3), due(4)]), "2 tasks are due this week");
  assert.equal(corkStatus([due(30)]), "Nothing pinned is due");
  assert.equal(plural(1, "set of notes", "sets of notes"), "1 set of notes");
});

test("the greeting follows the hour, and names are said properly", () => {
  assert.deepEqual([5, 11, 12, 17, 18, 23].map(greeting), ["Good morning", "Good morning", "Good afternoon", "Good afternoon", "Good evening", "Good evening"]);
  assert.equal(nice("mika"), "Mika"); assert.equal(nice(" owen "), "Owen"); assert.equal(nice(""), ""); assert.equal(nice(undefined), "");
});

test("the Room is built from real data and every piece still leads somewhere", () => {
  for (const where of ["Track", "Review", "Prepare", "Class", "Settings", "Night mode", "Ask"]) assert.ok(ROOM.includes(`where="${where}"`), `${where} has its furniture`);
  for (const tour of ["room-track", "room-review", "room-ask", "room-prepare", "room-class", "room-lamp", "room-settings"]) assert.ok(ROOM.includes(`"${tour}"`) || ROOM.includes(`"${tour}"`), `${tour} is a spotlight target`);
  assert.match(ROOM, /go\("track", "task", t\.id\)/, "a sticky note opens its task");
  assert.match(ROOM, /openForm\(\)/, "the corkboard can add a task"); assert.match(ROOM, /offer\?\.open/); assert.match(ROOM, /Start unpacking/);
  assert.match(ROOM, /subjColor\(m\.subject\)/, "the shelf's spines wear their subject's colour");
  assert.match(ROOM, /greeting\(\)/); assert.match(ROOM, /nice\(d\.user\)/);
});

test("on a phone the small tiles are two across and their long sentence is read aloud, not shown", () => {
  assert.match(CSS, /\.room-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(CSS, /@media \(min-width: 1024px\) \{ \.room-grid \{ grid-template-columns: repeat\(4/);
  assert.match(CSS, /\.room-grid \.room-status \{ position: absolute; width: 1px/, "visually hidden, still in the accessibility tree");
  assert.match(CSS, /\.cork-notes > li:nth-child\(n\+4\) \{ display: none; \}/, "three notes on a phone, four from a tablet up");
  assert.match(CSS, /\.room-note:active/); assert.match(CSS, /@media \(hover: hover\) \{ \.room-note:hover/);
});
