// The study-assistant client: Gemini first, Groq as the backup. API keys never live in the browser: both providers are
// reached through our own proxy (functions/api/[provider].js), which checks the signed-in user and rate-limits them.
// Moved out of App.jsx; the only change is that the auth headers are now supplied by App through setAuthHeaders().

let getHeaders = async () => ({ "Content-Type": "application/json" });
export function setAuthHeaders(fn) { getHeaders = fn; }

export const GEMINI = "/api/gemini";
export const GROQ = "/api/groq";
export const GROQ_MODEL = "openai/gpt-oss-120b";

export function toGemini(system, messages) {
  const contents = messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: (Array.isArray(m.content) ? m.content : [{ type: "text", text: m.content }]).map((b) =>
      b.type === "image" || b.type === "document"
        ? { inline_data: { mime_type: b.source.media_type, data: b.source.data } }
        : { text: b.text }
    ),
  }));
  while (contents.length && contents[0].role !== "user") contents.shift(); // Gemini wants the chat to start with the student
  return { system_instruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: 4096 } };
}

// Groq can't read photos or PDFs here, so those requests only ever go to Gemini.
export const hasMedia = (messages) => messages.some((m) => Array.isArray(m.content) && m.content.some((b) => b.type !== "text"));

export function toGroq(system, messages, stream) {
  const msgs = messages.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: Array.isArray(m.content) ? m.content.map((b) => b.text || "").join("\n") : m.content,
  }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return { model: GROQ_MODEL, messages: [{ role: "system", content: system }, ...msgs], max_completion_tokens: 4096, reasoning_effort: "low", stream };
}

// Our own proxy answers 429 with this header when a student is going very fast. Gemini's free-limit 429 has no header, so it still falls back to Groq.
export const ownLimit = (res) => res.status === 429 && res.headers.get("X-Homeroom-Limit") === "1";
export const slowDown = () => Object.assign(new Error("You're going quickly. Give the assistant a minute, then try again."), { limited: true });

export const geminiText = (data) => (data?.candidates?.[0]?.content?.parts || []).map((x) => x.text || "").join("");

export async function geminiCall(system, messages) {
  const res = await fetch(`${GEMINI}?mode=generate`, {
    method: "POST", headers: await getHeaders(),
    body: JSON.stringify(toGemini(system, messages)),
  });
  if (ownLimit(res)) throw slowDown();
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const text = geminiText(await res.json());
  if (!text) throw new Error("Gemini empty");
  return text;
}

export async function groqCall(system, messages) {
  const res = await fetch(GROQ, {
    method: "POST", headers: await getHeaders(),
    body: JSON.stringify(toGroq(system, messages, false)),
  });
  if (ownLimit(res)) throw slowDown();
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const text = (await res.json())?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Groq empty");
  return text;
}

// Reads a server-sent-events stream and calls pick(parsedLine) for each data line.
export async function readSSE(res, pick, onText) {
  if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try { full += pick(JSON.parse(d)); onText(full); } catch { /* partial line */ }
    }
  }
  if (!full) throw new Error("empty stream");
  return full;
}

export const busy = () => new Error("The AI is busy right now. Try again in a minute.");

export async function callClaude(system, messages) {
  { try { return await geminiCall(system, messages); } catch (e) { if (e.limited) throw e; console.warn("Gemini failed, trying Groq", e); } }
  if (!hasMedia(messages)) { try { return await groqCall(system, messages); } catch (e) { if (e.limited) throw e; console.warn("Groq failed", e); } }
  throw busy();
}

// Streams text as it is written. Gemini first; if it fails or hits its free limit, Groq takes over.
export async function streamClaude(system, messages, onText) {
  {
    try {
      const res = await fetch(`${GEMINI}?mode=stream`, {
        method: "POST", headers: await getHeaders(),
        body: JSON.stringify(toGemini(system, messages)),
      });
      if (ownLimit(res)) throw slowDown();
      return await readSSE(res, geminiText, onText);
    } catch (e) { if (e.limited) throw e; console.warn("Gemini stream failed, trying Groq", e); }
  }
  if (!hasMedia(messages)) {
    try {
      const res = await fetch(GROQ, {
        method: "POST", headers: await getHeaders(),
        body: JSON.stringify(toGroq(system, messages, true)),
      });
      if (ownLimit(res)) throw slowDown();
      return await readSSE(res, (d) => d?.choices?.[0]?.delta?.content || "", onText);
    } catch (e) { if (e.limited) throw e; console.warn("Groq stream failed", e); }
  }
  throw busy();
}

export function parseJSON(t) {
  const s = (t || "").replace(/```json|```/g, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < 0) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}
