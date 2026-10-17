import test from "node:test";
import assert from "node:assert/strict";
import { createWriteQueue } from "../src/lib/writes.js";

const mk = () => { const seen = []; const q = createWriteQueue((n) => seen.push(n)); return { q, seen }; };

test("a save that works does not hide a save that failed", async () => {
  const { q } = mk();
  await q.attempt({ id: "tasks-1", run: async () => false });
  await q.attempt({ id: "subjects-1", run: async () => true });
  assert.deepEqual(q.ids(), ["tasks-1"]);
});

test("a write that throws counts as failed", async () => {
  const { q } = mk();
  assert.equal(await q.attempt({ id: "a", run: async () => { throw new Error("offline"); } }), false);
  assert.equal(q.count(), 1);
});

test("retry sends the failed writes again, oldest first, and clears them", async () => {
  const { q } = mk();
  const sent = []; let online = false;
  const w = (id) => ({ id, run: async () => { if (online) sent.push(id); return online; } });
  await q.attempt(w("a")); await q.attempt(w("b"));
  assert.equal(await q.retryAll(), false, "still offline");
  assert.deepEqual(q.ids(), ["a", "b"]);
  online = true;
  assert.equal(await q.retryAll(), true);
  assert.deepEqual(sent, ["a", "b"]);
  assert.equal(q.count(), 0);
});

test("a newer save with the same id replaces the old failure, and a success clears it", async () => {
  const { q } = mk();
  await q.attempt({ id: "progress:t1", run: async () => false });
  await q.attempt({ id: "progress:t1", run: async () => false });
  assert.equal(q.count(), 1);
  await q.attempt({ id: "progress:t1", run: async () => true });
  assert.equal(q.count(), 0);
});

test("record() tracks saves that ran elsewhere (study data, plans)", async () => {
  const { q } = mk();
  let sent = null;
  q.record("study", false, async () => { sent = "latest"; return true; });
  assert.deepEqual(q.ids(), ["study"]);
  await q.retryAll();
  assert.equal(sent, "latest");
  q.record("study", true);
  assert.equal(q.count(), 0);
});

test("reapply puts failed changes back after a refresh, but skips one being sent right now", async () => {
  const { q } = mk();
  const applied = [];
  await q.attempt({ id: "a", run: async () => false, reapply: (c) => applied.push(["a", c]) });
  let release; const gate = new Promise((r) => { release = r; });
  const slow = q.attempt({ id: "b", run: () => gate, reapply: () => applied.push(["b"]) });
  q.reapply("c1");
  assert.deepEqual(applied, [["a", "c1"]]);      // "a" failed, so it is put back; "b" is still being sent
  release(false); await slow;
  applied.length = 0;
  q.reapply("c1");
  assert.deepEqual(applied, [["a", "c1"], ["b"]]);
});

test("two retries at once do not send everything twice", async () => {
  const { q } = mk();
  let n = 0; let online = false;
  await q.attempt({ id: "a", run: async () => { if (online) n++; return online; } });
  online = true;
  await Promise.all([q.retryAll(), q.retryAll()]);
  assert.equal(n, 1);
});
