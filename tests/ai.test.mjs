import test from "node:test";
import assert from "node:assert/strict";
import { setAuthHeaders, callClaude, streamClaude, parseJSON, toGemini, toGroq } from "../src/lib/ai.js";

const realFetch = globalThis.fetch;
setAuthHeaders(async () => ({ "Content-Type": "application/json", Authorization: "Bearer test-token" }));

const geminiOk = (text) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
const groqOk = (text) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
const ours429 = () => new Response("slow", { status: 429, headers: { "X-Homeroom-Limit": "1" } });
const sse = (...chunks) => new Response(chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n", { status: 200 });
const gChunk = (text) => ({ candidates: [{ content: { parts: [{ text }] } }] });
const qChunk = (text) => ({ choices: [{ delta: { content: text } }] });

// routes each call by URL, in order, and records what was called
function route(t, handlers) {
  t.mock.method(console, "warn", () => {});
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const key = String(url).startsWith("/api/gemini") ? "gemini" : "groq";
    calls.push({ key, url: String(url), init });
    return handlers[key]();
  };
  return calls;
}
test.afterEach(() => { globalThis.fetch = realFetch; });

const ask = [{ role: "user", content: "hi" }];
const withPhoto = [{ role: "user", content: [{ type: "image", source: { media_type: "image/jpeg", data: "AAA" } }, { type: "text", text: "read this" }] }];

test("Gemini answers: one call, signed in, in Gemini's format", async (t) => {
  const calls = route(t, { gemini: () => geminiOk("hello") });
  assert.equal(await callClaude("be kind", ask), "hello");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/gemini?mode=generate");
  assert.equal(calls[0].init.headers.Authorization, "Bearer test-token");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.system_instruction.parts[0].text, "be kind");
  assert.equal(body.contents[0].parts[0].text, "hi");
});

test("when Gemini fails, Groq takes over", async (t) => {
  const calls = route(t, { gemini: () => new Response("x", { status: 500 }), groq: () => groqOk("from groq") });
  assert.equal(await callClaude("s", ask), "from groq");
  assert.deepEqual(calls.map((c) => c.key), ["gemini", "groq"]);
});

test("Gemini's own free-limit 429 (no header) still falls back to Groq", async (t) => {
  const calls = route(t, { gemini: () => new Response("quota", { status: 429 }), groq: () => groqOk("ok") });
  assert.equal(await callClaude("s", ask), "ok");
  assert.equal(calls.length, 2);
});

test("our rate limit stops right there: a gentle error and NO second request", async (t) => {
  const calls = route(t, { gemini: ours429, groq: () => groqOk("should not happen") });
  await assert.rejects(callClaude("s", ask), (e) => e.limited === true && /going quickly/.test(e.message));
  assert.deepEqual(calls.map((c) => c.key), ["gemini"]);
});

test("our rate limit on the backup is reported the same way", async (t) => {
  route(t, { gemini: () => new Response("x", { status: 500 }), groq: ours429 });
  await assert.rejects(callClaude("s", ask), (e) => e.limited === true);
});

test("photos and PDFs never go to Groq; if Gemini fails the student sees the busy message", async (t) => {
  const calls = route(t, { gemini: () => new Response("x", { status: 500 }), groq: () => groqOk("nope") });
  await assert.rejects(callClaude("s", withPhoto), /busy/i);
  assert.deepEqual(calls.map((c) => c.key), ["gemini"]);
});

test("when both providers fail, the student sees the busy message", async (t) => {
  route(t, { gemini: () => new Response("x", { status: 500 }), groq: () => new Response("x", { status: 500 }) });
  await assert.rejects(callClaude("s", ask), /busy/i);
});

test("an empty Gemini answer counts as a failure and falls back", async (t) => {
  route(t, { gemini: () => geminiOk(""), groq: () => groqOk("rescued") });
  assert.equal(await callClaude("s", ask), "rescued");
});

test("streaming builds the answer up and reports progress", async (t) => {
  route(t, { gemini: () => sse(gChunk("Hel"), gChunk("lo")) });
  const seen = [];
  assert.equal(await streamClaude("s", ask, (txt) => seen.push(txt)), "Hello");
  assert.deepEqual(seen, ["Hel", "Hello"]);
});

test("a failed Gemini stream falls back to a Groq stream", async (t) => {
  const calls = route(t, { gemini: () => new Response("x", { status: 500 }), groq: () => sse(qChunk("Hi "), qChunk("there")) });
  assert.equal(await streamClaude("s", ask, () => {}), "Hi there");
  assert.deepEqual(calls.map((c) => c.key), ["gemini", "groq"]);
});

test("our rate limit during a stream stops without trying the backup", async (t) => {
  const calls = route(t, { gemini: ours429, groq: () => sse(qChunk("x")) });
  await assert.rejects(streamClaude("s", ask, () => {}), (e) => e.limited === true);
  assert.deepEqual(calls.map((c) => c.key), ["gemini"]);
});

test("message conversion: chats must start with the student; photos become inline data", () => {
  const g = toGemini("sys", [{ role: "assistant", content: "stray" }, ...withPhoto]);
  assert.equal(g.contents[0].role, "user");
  assert.equal(g.contents.length, 1);
  assert.deepEqual(g.contents[0].parts[0], { inline_data: { mime_type: "image/jpeg", data: "AAA" } });
  const q = toGroq("sys", [{ role: "assistant", content: "stray" }, { role: "user", content: "q" }], true);
  assert.equal(q.messages[0].role, "system");
  assert.equal(q.messages[1].role, "user");
  assert.equal(q.stream, true);
});

test("parseJSON copes with code fences, chatter around the JSON, and garbage", () => {
  assert.deepEqual(parseJSON('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJSON('Sure! Here you go: {"cards":[1,2]} Hope that helps.'), { cards: [1, 2] });
  assert.equal(parseJSON("no json here"), null);
  assert.equal(parseJSON("{broken"), null);
  assert.equal(parseJSON(undefined), null);
});
