// Free serverless proxy for the study assistant. It keeps the Gemini and Groq keys off the browser.
// Add GEMINI_API_KEY and GROQ_API_KEY as secrets in Cloudflare (see README). GEMINI_MODEL is optional.
export async function onRequestPost({ request, env, params }) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && new URL(origin).host !== url.host) return new Response("Forbidden", { status: 403 });
  // Only signed-in students can use the assistant (checked with Supabase).
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return new Response("Server not set up", { status: 503 });
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer /, "");
  const who = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!who.ok) return new Response("Sign in first", { status: 401 });
  // Per-student rate limit (Cloudflare Workers Rate Limiting binding, see wrangler.jsonc). Keyed on the signed-in user, not the IP,
  // because classmates share a school network. It is approximate and per Cloudflare location, so it guards against runaway use,
  // not determined abuse. If the binding is missing or errors, let the request through rather than lock students out.
  const me = await who.json().catch(() => null);
  if (env.AI_LIMITER && me && me.id) {
    try {
      const { success } = await env.AI_LIMITER.limit({ key: `ai:${me.id}` });
      if (!success) {
        return new Response("Slow down a moment", { status: 429, headers: { "Retry-After": "60", "X-Homeroom-Limit": "1", "Cache-Control": "no-store" } });
      }
    } catch (err) { console.warn("[ai] rate limiter unavailable, allowing the request:", err); }
  }
  let body = await request.arrayBuffer();
  if (body.byteLength > 30 * 1024 * 1024) return new Response("Too large", { status: 413 });
  // Only the app's own settings are allowed through: the model is chosen here, and output length is capped.
  try {
    const j = JSON.parse(new TextDecoder().decode(body));
    if (params.provider === "groq") {
      j.model = env.GROQ_MODEL || "openai/gpt-oss-120b";
      j.max_completion_tokens = Math.min(Number(j.max_completion_tokens) || 4096, 4096);
      delete j.tools;
    } else if (params.provider === "gemini") {
      j.generationConfig = { ...(j.generationConfig || {}), maxOutputTokens: Math.min(Number(j.generationConfig?.maxOutputTokens) || 4096, 4096) };
      delete j.tools;
    }
    body = new TextEncoder().encode(JSON.stringify(j));
  } catch { return new Response("Bad request", { status: 400 }); }

  let upstream;
  const headers = { "Content-Type": "application/json" };
  if (params.provider === "gemini") {
    if (!env.GEMINI_API_KEY) return new Response("Gemini key not set", { status: 503 });
    const model = env.GEMINI_MODEL || "gemini-flash-latest";
    const mode = url.searchParams.get("mode") === "stream" ? "streamGenerateContent?alt=sse" : "generateContent";
    upstream = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${mode}`;
    headers["x-goog-api-key"] = env.GEMINI_API_KEY;
  } else if (params.provider === "groq") {
    if (!env.GROQ_API_KEY) return new Response("Groq key not set", { status: 503 });
    upstream = "https://api.groq.com/openai/v1/chat/completions";
    headers.Authorization = `Bearer ${env.GROQ_API_KEY}`;
  } else {
    return new Response("Not found", { status: 404 });
  }

  const res = await fetch(upstream, { method: "POST", headers, body });
  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/json", "Cache-Control": "no-store" },
  });
}
