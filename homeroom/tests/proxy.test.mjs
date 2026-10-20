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

/* ───────────── web search: switched on by the server, never by the browser ───────────── */

// Records what the proxy actually forwards to the model.
async function forwarded({ provider = "gemini", query = "", env = {}, body = { contents: [] } } = {}) {
  let sent = null;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "user-1" }), { status: 200 });
    sent = JSON.parse(new TextDecoder().decode(init.body));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }), { status: 200 });
  };
  const request = new Request(`https://app.test/api/${provider}?mode=generate${query}`, {
    method: "POST", headers: { Authorization: "Bearer t", "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const e = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "k", GEMINI_API_KEY: "g", GROQ_API_KEY: "q", ...env };
  const res = await onRequestPost({ request, env: e, params: { provider } });
  return { res, sent };
}

test("?search=1 gives Gemini the Google Search tool, and nothing else", async () => {
  const { res, sent } = await forwarded({ query: "&search=1" });
  assert.equal(res.status, 200);
  assert.deepEqual(sent.tools, [{ google_search: {} }]);
});

test("without ?search=1 there are no tools, and a browser can never choose its own", async () => {
  const none = await forwarded({ body: { contents: [], tools: [{ code_execution: {} }, { google_search: {} }] } });
  assert.equal(none.sent.tools, undefined, "tools sent by the browser are removed");
  const swapped = await forwarded({ query: "&search=1", body: { contents: [], tools: [{ code_execution: {} }, { url_context: {} }] } });
  assert.deepEqual(swapped.sent.tools, [{ google_search: {} }], "even with search on, only the server's tool is used");
});

test("search can be switched off for everyone with AI_SEARCH=off, and the request still works", async () => {
  const { res, sent } = await forwarded({ query: "&search=1", env: { AI_SEARCH: "off" } });
  assert.equal(res.status, 200);
  assert.equal(sent.tools, undefined);
  assert.deepEqual((await forwarded({ query: "&search=1", env: { AI_SEARCH: "OFF" } })).sent.tools, undefined, "case does not matter");
  assert.deepEqual((await forwarded({ query: "&search=1", env: { AI_SEARCH: "on" } })).sent.tools, [{ google_search: {} }]);
});

test("Groq never gets tools, even if search is asked for", async () => {
  const { sent } = await forwarded({ provider: "groq", query: "&search=1", body: { messages: [], tools: [{ type: "function" }] } });
  assert.equal(sent.tools, undefined);
});

test("an Origin that is not a URL (\"null\") is refused with 403, and nothing is called", async () => {
  const { env, request } = setup();
  const calls = []; const f = globalThis.fetch; globalThis.fetch = async (...a) => { calls.push(String(a[0])); return f(...a); };
  for (const origin of ["null", "not a url"]) {
    const req = new Request(request.url, { method: "POST", headers: { Authorization: "Bearer t", Origin: origin }, body: "{}" });
    const res = await onRequestPost({ request: req, env, params: { provider: "gemini" } });
    assert.equal(res.status, 403, origin);
  }
  assert.deepEqual(calls, []);
});

test("another site's Origin is refused, and the same site's Origin gets through", async () => {
  const { env, request } = setup();
  const mk = (origin) => new Request(request.url, { method: "POST", headers: { Authorization: "Bearer t", Origin: origin }, body: JSON.stringify({ contents: [] }) });
  assert.equal((await onRequestPost({ request: mk("https://evil.test"), env, params: { provider: "gemini" } })).status, 403);
  assert.equal((await onRequestPost({ request: mk("https://app.test"), env, params: { provider: "gemini" } })).status, 200);
});
