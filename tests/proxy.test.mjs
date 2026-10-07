import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/[provider].js";

const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });

// Mocks Supabase's /auth/v1/user and Gemini, and records which URLs were called.
function setup({ limiter, signedIn = true } = {}) {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("/auth/v1/user")) {
      return signedIn ? new Response(JSON.stringify({ id: "user-1" }), { status: 200 }) : new Response("no", { status: 401 });
    }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "hi" }] } }] }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  };
  const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "k", GEMINI_API_KEY: "g", AI_LIMITER: limiter };
  const request = new Request("https://app.test/api/gemini?mode=generate", {
    method: "POST", headers: { Authorization: "Bearer t", "Content-Type": "application/json" }, body: JSON.stringify({ contents: [] }),
  });
  const upstream = () => calls.filter((u) => u.includes("generativelanguage"));
  return { env, request, upstream };
}

test("a student under the limit gets through, and is keyed by their user id", async () => {
  const keys = [];
  const { env, request, upstream } = setup({ limiter: { limit: async ({ key }) => { keys.push(key); return { success: true }; } } });
  const res = await onRequestPost({ request, env, params: { provider: "gemini" } });
  assert.equal(res.status, 200);
  assert.deepEqual(keys, ["ai:user-1"]);
  assert.equal(upstream().length, 1);
});

test("a student over the limit gets a 429 with Retry-After, and nothing reaches Gemini", async () => {
  const { env, request, upstream } = setup({ limiter: { limit: async () => ({ success: false }) } });
  const res = await onRequestPost({ request, env, params: { provider: "gemini" } });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Retry-After"), "60");
  assert.equal(res.headers.get("X-Homeroom-Limit"), "1");
  assert.equal(upstream().length, 0);
});

test("if the limiter itself errors, the request is allowed (fail open)", async () => {
  const { env, request, upstream } = setup({ limiter: { limit: async () => { throw new Error("limiter down"); } } });
  const res = await onRequestPost({ request, env, params: { provider: "gemini" } });
  assert.equal(res.status, 200);
  assert.equal(upstream().length, 1);
});

test("without a limiter binding the proxy still works", async () => {
  const { env, request, upstream } = setup({ limiter: undefined });
  const res = await onRequestPost({ request, env, params: { provider: "gemini" } });
  assert.equal(res.status, 200);
  assert.equal(upstream().length, 1);
});

test("signed-out requests are refused before the limiter is ever consulted", async () => {
  let consulted = false;
  const { env, request } = setup({ signedIn: false, limiter: { limit: async () => { consulted = true; return { success: true }; } } });
  const res = await onRequestPost({ request, env, params: { provider: "gemini" } });
  assert.equal(res.status, 401);
  assert.equal(consulted, false);
});
