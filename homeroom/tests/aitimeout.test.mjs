import test from "node:test";
import assert from "node:assert/strict";
import { setAuthHeaders, callClaude, limits } from "../src/lib/ai.js";

const realFetch = globalThis.fetch;
setAuthHeaders(async () => ({ "Content-Type": "application/json" }));
test.afterEach(() => { globalThis.fetch = realFetch; });

test("a request that never answers is given up on, and the backup provider answers instead", async (t) => {
  t.mock.method(console, "warn", () => {});
  const old = limits.call; limits.call = 40;
  const seen = [];
  globalThis.fetch = (url, init) => {
    seen.push(String(url));
    if (String(url).startsWith("/api/gemini")) return new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));
    return Promise.resolve(new Response(JSON.stringify({ choices: [{ message: { content: "from groq" } }] }), { status: 200 }));
  };
  try { assert.equal(await callClaude("s", [{ role: "user", content: "hi" }]), "from groq"); } finally { limits.call = old; }
  assert.equal(seen.length, 2);
});

test("if nobody answers at all, the caller gets an error (not an endless spinner)", async (t) => {
  t.mock.method(console, "warn", () => {});
  const old = limits.call; limits.call = 30;
  globalThis.fetch = (url, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));
  try { await assert.rejects(callClaude("s", [{ role: "user", content: "hi" }])); } finally { limits.call = old; }
});
