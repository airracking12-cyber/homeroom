import test from "node:test";
import assert from "node:assert/strict";
import { createStore, LS, readOutcome } from "../src/lib/store.js";
import { readFileSync } from "node:fs";

// A tiny in-memory stand-in for the "kv" table, speaking just enough of Supabase's query chain.
function fakeDb({ onBeforeUpdate, failInsertOnce = false, failUpsert = null } = {}) {
  const rows = new Map();               // key -> { value, version }
  let insertFailed = false, updateAttempts = 0;
  const from = (table) => {
    assert.equal(table, "kv");
    const q = { op: null, payload: null, filters: {}, wantRows: false };
    const run = () => {
      const key = q.filters.key;
      if (q.op === "select") { const r = rows.get(key); return { data: r ? { value: r.value, version: r.version } : null, error: null }; }
      if (q.op === "insert") {
        if (failInsertOnce && !insertFailed) { insertFailed = true; rows.set(q.payload.key, { value: ["someone-else"], version: 1 }); return { error: { message: "duplicate key" } }; }
        if (rows.has(q.payload.key)) return { error: { message: "duplicate key" } };
        rows.set(q.payload.key, { value: q.payload.value, version: q.payload.version }); return { error: null };
      }
      if (q.op === "update") {
        updateAttempts++;
        if (onBeforeUpdate) onBeforeUpdate(rows, updateAttempts);
        const r = rows.get(key);
        if (!r || (q.filters.version !== undefined && r.version !== q.filters.version)) return { data: [], error: null };
        rows.set(key, { value: q.payload.value, version: q.payload.version }); return { data: [{ key }], error: null };
      }
      if (q.op === "upsert") {
        if (failUpsert === "error") return { error: { message: "offline" } };
        if (failUpsert === "throw") throw new Error("network down");
        rows.set(q.payload.key, { value: q.payload.value, version: 1 }); return { error: null };
      }
      if (q.op === "delete") { rows.delete(key); return { error: null }; }
      throw new Error("unexpected op " + q.op);
    };
    const chain = {
      select() { if (!q.op) q.op = "select"; else q.wantRows = true; return chain; },
      insert(p) { q.op = "insert"; q.payload = p; return chain; },
      update(p) { q.op = "update"; q.payload = p; return chain; },
      upsert(p) { q.op = "upsert"; q.payload = p; return chain; },
      delete() { q.op = "delete"; return chain; },
      eq(col, v) { q.filters[col] = v; return chain; },
      maybeSingle() { return Promise.resolve(run()); },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    return chain;
  };
  return { supabase: { from }, rows, attempts: () => updateAttempts };
}
const fakeStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };

test("local values round-trip under the hr: prefix and tolerate a missing or broken storage", async () => {
  const storage = fakeStorage();
  const store = createStore(null, storage);
  assert.equal(await store.set("theme", { dark: true }), true);
  assert.ok(storage._m.has(LS + "theme"));
  assert.deepEqual(await store.get("theme"), { dark: true });
  assert.equal(await store.get("nothing"), null);
  await store.del("theme");
  assert.equal(await store.get("theme"), null);
  storage.setItem(LS + "bad", "{not json");
  assert.equal(await store.get("bad"), null, "corrupt data reads as empty, not a crash");
  const broken = createStore(null, { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } });
  assert.equal(await broken.get("x"), null);
  assert.equal(await broken.set("x", 1), false);
});

test("update creates a missing row, then changes it and bumps the version", async () => {
  const db = fakeDb(); const store = createStore(db.supabase, fakeStorage());
  assert.equal(await store.update("tasks", (c) => [...c, "a"]), true);
  assert.deepEqual(db.rows.get("tasks"), { value: ["a"], version: 1 });
  assert.equal(await store.update("tasks", (c) => [...c, "b"]), true);
  assert.deepEqual(db.rows.get("tasks"), { value: ["a", "b"], version: 2 });
});

test("if someone saves in between, update re-reads and keeps BOTH changes (no lost update)", async () => {
  const db = fakeDb({
    onBeforeUpdate(rows, attempt) { if (attempt === 1) rows.set("tasks", { value: ["a", "friend"], version: 2 }); },
  });
  db.rows.set("tasks", { value: ["a"], version: 1 });
  const store = createStore(db.supabase, fakeStorage());
  assert.equal(await store.update("tasks", (c) => [...c, "mine"]), true);
  assert.deepEqual(db.rows.get("tasks").value, ["a", "friend", "mine"]);
  assert.equal(db.attempts(), 2, "one conflict, one retry");
});

test("if two people create the same row at once, the loser retries as an update", async () => {
  const db = fakeDb({ failInsertOnce: true });
  const store = createStore(db.supabase, fakeStorage());
  assert.equal(await store.update("notes", (c) => [...c, "mine"]), true);
  assert.deepEqual(db.rows.get("notes").value, ["someone-else", "mine"]);
});

test("update gives up cleanly after 6 conflicts instead of looping forever", async () => {
  const db = fakeDb({ onBeforeUpdate(rows) { const r = rows.get("busy"); rows.set("busy", { value: r.value, version: r.version + 1 }); } });
  db.rows.set("busy", { value: [], version: 1 });
  const store = createStore(db.supabase, fakeStorage());
  assert.equal(await store.update("busy", (c) => [...c, 1]), false);
  assert.equal(db.attempts(), 6);
});

test("shared set and delete go to the database", async () => {
  const db = fakeDb(); const store = createStore(db.supabase, fakeStorage());
  assert.equal(await store.set("announce", ["hi"], true), true);
  assert.deepEqual(db.rows.get("announce").value, ["hi"]);
  await store.del("announce", true);
  assert.equal(db.rows.has("announce"), false);
});

test("a failed shared save answers false (never throws), so the app can show its 'may not have saved' banner", async (t) => {
  t.mock.method(console, "error", () => {});
  for (const mode of ["error", "throw"]) {
    const db = fakeDb({ failUpsert: mode });
    const store = createStore(db.supabase, fakeStorage());
    assert.equal(await store.set("u:me:progress", { a: "done" }, true), false, mode);
    assert.equal(db.rows.has("u:me:progress"), false, "nothing was saved");
  }
});

test("getMany reads several shared rows in one request, and says null when the database can't be reached", async () => {
  const seen = [];
  const ok = { from: (t) => ({ select: () => ({ in: async (c, keys) => { seen.push([t, c, keys]); return { data: [{ key: "a", value: 1 }, { key: "c", value: [2] }], error: null }; } }) }) };
  const out = await createStore(ok).getMany(["a", "b", "c"]);
  assert.deepEqual(out, { a: 1, c: [2] }); // "b" was never saved, so it is simply absent
  assert.deepEqual(seen, [["kv", "key", ["a", "b", "c"]]]);
  const bad = { from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: "x" } }) }) }) };
  const orig = console.error; console.error = () => {};
  try { assert.equal(await createStore(bad).getMany(["a"]), null); } finally { console.error = orig; }
});

test("get tells 'nothing saved yet' (null) apart from 'couldn't reach the database' (undefined)", async () => {
  const mk = (res) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => res }) }) }) });
  assert.equal(await createStore(mk({ data: null, error: null })).get("k", true), null);
  assert.deepEqual(await createStore(mk({ data: { value: { a: 1 } }, error: null })).get("k", true), { a: 1 });
  const orig = console.error; console.error = () => {};
  try { assert.equal(await createStore(mk({ data: null, error: { message: "x" } })).get("k", true), undefined); } finally { console.error = orig; }
});

test("the class list asks for 'locked' (v29) and still works on a database that doesn't have it yet", async () => {
  const asked = [];
  const mk = (failFirst) => ({ from: () => ({ select: (cols) => ({ order: async () => { asked.push(cols); const bad = failFirst > 0 && asked.length <= failFirst; return bad ? { data: null, error: { message: "no column" } } : { data: [{ id: "8-16", label: "8-16" }], error: null }; } }) }) });
  assert.equal((await createStore(mk(0)).classes.list()).length, 1);
  assert.match(asked[0], /locked/);
  asked.length = 0;
  assert.equal((await createStore(mk(2)).classes.list()).length, 1); // fell back twice, to the v8 columns
  assert.deepEqual(asked.map((c) => c.includes("locked") ? "locked" : c.includes("quarter") ? "quarter" : "base"), ["locked", "quarter", "base"]);
});

test("a read that could not reach the database is never treated as an empty list", () => {
  assert.deepEqual(readOutcome(undefined, { cards: {} }), { ok: false }, "unreachable is not ok, so nothing may be saved");
  const fresh = readOutcome(null, { cards: {}, log: [] });
  assert.deepEqual(fresh, { ok: true, value: { cards: {}, log: [] } }, "nothing saved yet starts fresh");
  const kept = readOutcome({ cards: { a: 1 }, extra: true }, { cards: {}, log: [] });
  assert.deepEqual(kept.value, { cards: { a: 1 }, log: [], extra: true }, "saved data wins and missing parts are filled in");
  assert.equal(readOutcome("not an object", { n: 1 }).value.n, 1, "junk in the row falls back to the empty shape");
});

test("study progress cannot be overwritten by a failed read: the hook checks the outcome and refuses to save before it has loaded", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const hook = app.slice(app.indexOf("function useStudy("), app.indexOf("const missCard"));
  assert.match(hook, /readOutcome\(v, \{ cards: \{\}, log: \[\], plan: null \}\)/);
  assert.match(hook, /if \(!r\.ok\) \{ setFailed\(true\); return; \}/, "a failed read is a failed state, not an empty one");
  assert.match(hook, /if \(!ref\.current\) return;/, "no change is saved before the real data has loaded");
  assert.ok(!/fn\(ref\.current \|\|/.test(hook), "no fallback to an empty set when updating");
  assert.match(hook, /addEventListener\("online", retry\)/, "it tries again when the connection returns");
});

/* ───────────── the build refuses to produce a blank site ───────────── */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { missingBuildEnv, buildEnvMessage } from "../tools/build-env.js";

test("missing Supabase settings are named in plain words", () => {
  assert.deepEqual(missingBuildEnv({}), ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]);
  assert.deepEqual(missingBuildEnv({ VITE_SUPABASE_URL: "https://x.supabase.co", VITE_SUPABASE_ANON_KEY: "  " }), ["VITE_SUPABASE_ANON_KEY"], "blank counts as missing");
  assert.deepEqual(missingBuildEnv({ VITE_SUPABASE_URL: "https://x.supabase.co", VITE_SUPABASE_ANON_KEY: "k" }), []);
  const msg = buildEnvMessage(["VITE_SUPABASE_URL"]);
  assert.match(msg, /VITE_SUPABASE_URL is not set/);
  assert.match(msg, /blank page/);
  assert.match(msg, /\.env\.local/);
  assert.match(msg, /Build variables/);
});

test("vite build stops with that message when the settings are missing (run from an empty folder so no .env file can supply them)", () => {
  const empty = mkdtempSync(`${tmpdir()}/hr-noenv-`);
  try {
    const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("VITE_")));
    let out = "", failed = false;
    try {
      execFileSync(process.execPath, [new URL("../node_modules/vite/bin/vite.js", import.meta.url).pathname, "build", "--config", new URL("../vite.config.js", import.meta.url).pathname], { cwd: empty, env: clean, stdio: "pipe" });
    } catch (e) { failed = true; out = `${e.stdout || ""}${e.stderr || ""}`; }
    assert.ok(failed, "the build must not succeed without the settings");
    assert.match(out, /The build stopped: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set/);
  } finally { rmSync(empty, { recursive: true, force: true }); }
});
