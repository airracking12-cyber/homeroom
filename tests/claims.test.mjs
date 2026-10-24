import { test } from "node:test";
import assert from "node:assert/strict";
import { claim, release, whoHas, STALE_MS } from "../src/lib/claims.js";

const fakeStore = () => { const rows = new Map(); return { rows,
  update: async (k, fn, empty) => { rows.set(k, fn(rows.has(k) ? rows.get(k) : empty)); return true; },
  get: async (k) => rows.get(k) }; };

test("the first student to ask wins; the second sees who is on it", async () => {
  const s = fakeStore(), key = "c1:claim:practice:n1";
  assert.deepEqual(await claim(s, key, "ana", { now: 1000 }), { won: true, by: "ana" });
  assert.deepEqual(await claim(s, key, "ben", { now: 2000 }), { won: false, by: "ana" });
  assert.deepEqual(await claim(s, key, "ana", { now: 3000 }), { won: true, by: "ana" }, "the holder can carry on");
  assert.equal(await whoHas(s, key, { now: 4000 }), "ana");
});

test("a claim nobody finishes goes stale, so someone else can take over", async () => {
  const s = fakeStore(), key = "k";
  await claim(s, key, "ana", { now: 0 });
  assert.equal((await claim(s, key, "ben", { now: STALE_MS - 1 })).won, false);
  assert.equal((await claim(s, key, "ben", { now: STALE_MS + 1 })).won, true);
  assert.equal(await whoHas(s, key, { now: STALE_MS * 3 }), null, "an old claim is no claim");
});

test("releasing only frees your own claim", async () => {
  const s = fakeStore(), key = "k";
  await claim(s, key, "ana", { now: 0 });
  await release(s, key, "ben"); assert.equal(await whoHas(s, key, { now: 1 }), "ana");
  await release(s, key, "ana"); assert.equal(await whoHas(s, key, { now: 1 }), null);
});

test("a claim that could not be saved is reported, never assumed won", async () => {
  const bad = { update: async () => false, get: async () => null };
  const r = await claim(bad, "k", "ana"); assert.equal(r.won, false); assert.equal(r.error, true);
});
