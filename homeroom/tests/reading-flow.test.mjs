// Reading notes: how the screens and the data layer are wired (the logic itself is in ingest.test.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL("../src/" + p, import.meta.url), "utf8");
const NOTES = read("app/review/notes.jsx"), ING = read("app/ingest.jsx"), DATA = read("app/data.jsx"), LIB = read("lib/notes.js");
const sheet = NOTES.slice(NOTES.indexOf("export function AddNotesSheet"), NOTES.indexOf("export function EditNoteSheet"));

test("simple flow: choose or paste, one confirm, done. No extra options or jargon", () => {
  assert.match(sheet, /Share with class/);
  assert.equal((sheet.match(/type="submit"/g) || []).length, 1, "one confirm button");
  assert.ok(!/Segmented|Suggest a topic|Reading file|extractFromFile|Class notes|inventory|chunk|tokens/i.test(sheet), "no jargon or old extra options");
  assert.match(sheet, /<details className="more">/, "topic and title are optional and tucked away");
  assert.match(sheet, /Left empty, Homeroom names the topic for you/);
});

test("the raw input is saved first and unchanged, before the assistant touches it", () => {
  assert.ok(DATA.indexOf("const saveNote") < DATA.indexOf("startIdeas?.("), "the raw save comes before reading starts");
  assert.ok(!/\.slice\(0, MAX_BODY\)/.test(DATA + LIB), "nothing is cut silently at the note cap");
  assert.match(LIB, /if \(body\.length > MAX_BODY\) return false/);
  assert.ok(!/slice\(0, 20000\)/.test(NOTES + ING), "text files are no longer cut at 20,000 characters");
  assert.match(ING, /notes\.uploadFile\(classRef\.current, id, f\); \/\/ the original is saved FIRST/);
  assert.ok(ING.indexOf("notes.uploadFile") < ING.indexOf("pdfParts(f)"), "the original file is stored before any page is read");
  assert.ok(!/650 words|condens/i.test(read("lib/helpers.js") + read("lib/ingest-ai.js").replace(/Do NOT summarize[^"]*/, "")), "no more condensing of PDFs and photos to a summary");
  assert.match(read("lib/ingest-ai.js"), /Do NOT summarize, shorten or reword/);
});

test("the old all-or-nothing reading is gone: no mid-sentence chunking, no whole-note fallback on one bad chunk in the main path", () => {
  assert.ok(!/chunkText/.test(read("lib/study.js")));
  assert.match(read("lib/study.js"), /makeChunks\(text\)/);
  assert.match(ING, /createNotes/); assert.match(ING, /runIngest/);
});

test("PDFs are split into page groups with pdf-lib, loaded only when a PDF is added", () => {
  const ai = read("lib/ingest-ai.js");
  assert.match(ai, /await import\("pdf-lib"\)/); assert.ok(!/^import .*pdf-lib/m.test(ai));
  assert.match(ai, /PAGES_PER_PART = 3/); assert.match(ai, /copyPages/);
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(pkg.dependencies["pdf-lib"]);
});

test("progress, cancel, retry and the coverage check are on screen", () => {
  assert.match(ING, /<Bar value=\{p\.pct\}/); assert.match(ING, /\{p\.label\}<\/b> &middot; \{p\.pct\}%/);
  assert.match(ING, />Cancel</); assert.match(ING, />Continue</); assert.match(ING, />Try again</);
  assert.match(ING, /Read the missed \{cov\.missed\.length === 1 \? "part" : "parts"\} again/);
  assert.match(ING, /role="status"/);
  assert.match(ING, /These weren&rsquo;t:/);
  assert.match(NOTES, /<IngestList ingest=\{d\.ingest\} \/>/, "unfinished reading shows in the library");
});

test("autosave and resume: every chunk is persisted, and unfinished jobs restart on launch", () => {
  assert.match(ING, /persist: async \(\) => save\(\)/);
  assert.match(ING, /u:\$\{user\}:ingest/); assert.match(ING, /hr:ingest:\$\{user\}/);
  assert.match(ING, /RESUME\.has\(e\.job\.state\)/);
  assert.match(ING, /if \(!text\) continue; \/\/ the note was removed/);
});

test("the assistant is paced under the proxy's limit and says so while it waits", () => {
  assert.match(ING, /makePacer\(\{ onWait/); assert.match(ING, /waiting: !!e\.ctl && waiting\.current/);
  assert.match(read("lib/ingest.js"), /Waiting a moment so the assistant can keep up/);
});

test("long input is split into numbered parts instead of being cut", () => {
  assert.match(ING, /\(part \$\{k \+ 1\} of \$\{parts\.length\}\)/);
  assert.match(ING, /planParts\(text\)/);
});
