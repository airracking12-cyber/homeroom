import test from "node:test";
import assert from "node:assert/strict";
import { parseReviewer, reviewerCount } from "../src/lib/reviewerDoc.js";
import { groupBySubject, libraryStats, untopiced, fmtBytes, scopeLine, NO_TOPIC } from "../src/lib/library.js";

const REVIEWER = `Quadratic equations

Solving by factoring
Standard form: ax^2 + bx + c = 0, where a is not zero.
Zero product property: if a product is zero, at least one factor is zero.
- Move every term to one side first
- Then factor and set each factor to zero

Also remember
Discriminant: b^2 - 4ac tells how many real roots there are.`;

test("a reviewer becomes headed sections with term rows and points", () => {
  const s = parseReviewer(REVIEWER);
  assert.deepEqual(s.map((x) => x.title), ["Quadratic equations", "Solving by factoring", "Also remember"]);
  const sec = s[1].items;
  assert.equal(sec[0].type, "term");
  assert.equal(sec[0].term, "Standard form");
  assert.match(sec[0].meaning, /^ax\^2/);
  assert.equal(sec[2].type, "point");
  assert.equal(sec[2].text, "Move every term to one side first");
  assert.equal(reviewerCount(s), 5);
});

test("no text is dropped: odd lines become paragraphs", () => {
  const text = "Photosynthesis happens in the chloroplasts of plant cells and needs light.\nIt is how plants make food.";
  const s = parseReviewer(text);
  const all = s.flatMap((x) => x.items).map((x) => x.text || `${x.term}: ${x.meaning}`).join(" ");
  assert.match(all, /chloroplasts/);
  assert.match(all, /make food/);
});

test("markdown the assistant adds anyway is cleaned", () => {
  const s = parseReviewer("## Cells\n**Nucleus**: holds the DNA and runs the cell\n`Membrane`: controls what gets in and out");
  assert.equal(s[0].title, "Cells");
  assert.equal(s[0].items[0].term, "Nucleus");
  assert.equal(s[0].items[1].term, "Membrane");
});

test("empty input is an empty reviewer", () => {
  assert.deepEqual(parseReviewer(""), []);
  assert.deepEqual(parseReviewer(null), []);
});

const M = (id, subject, topic, by, ic, at, kind = "upload") => ({ id, subject, topic, by, ic, at, kind });
const mats = [
  M("1", "Math", "Quadratics", "a", 3, 5), M("2", "Math", "Quadratics", "b", 2, 9), M("3", "Math", "", "a", 0, 1),
  M("4", "Science", "Cells", "c", 4, 2), M("5", "Math", "Linear", "a", 1, 3, "ai"),
];

test("notes group by subject, then topic, with the no-topic bucket last", () => {
  const g = groupBySubject(mats);
  assert.deepEqual(g.map((x) => x.subject), ["Math", "Science"]);
  const math = g[0];
  assert.equal(math.notes, 4);
  assert.equal(math.ideas, 6);
  assert.equal(math.people, 2);
  assert.equal(math.latest, 9);
  assert.deepEqual(math.topics.map((t) => t.topic), ["Quadratics", "Linear", NO_TOPIC]);
  assert.deepEqual(math.topics[0].notes.map((n) => n.id), ["2", "1"]); // newest first
});

test("library numbers", () => {
  assert.deepEqual(libraryStats(mats), { notes: 5, topics: 3, ideas: 10, people: 3, subjects: 2 });
  assert.deepEqual(untopiced(mats).map((m) => m.id), ["3"]);
  assert.deepEqual(libraryStats([]), { notes: 0, topics: 0, ideas: 0, people: 0, subjects: 0 });
});

test("sizes and the scope line read naturally", () => {
  assert.equal(fmtBytes(900), "900 B");
  assert.equal(fmtBytes(2048), "2 KB");
  assert.equal(fmtBytes(5.5 * 1048576), "5.5 MB");
  assert.equal(scopeLine({ period: "week" }).text, "This week \u00b7 Every subject");
  assert.equal(scopeLine({ period: "today", subjects: ["Math"] }).text, "Today \u00b7 Math");
  assert.equal(scopeLine({ period: "final", subjects: ["A", "B"] }).text, "Whole quarter \u00b7 2 subjects");
  assert.equal(scopeLine({ period: "week", topics: ["Cells"], subjects: ["Science"] }).what, "Cells");
  assert.equal(scopeLine({ period: "week", q: " mitosis " }).text, "\u201cmitosis\u201d");
});
