import test from "node:test";
import assert from "node:assert/strict";
import { createStore, LS } from "../src/lib/store.js";

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
