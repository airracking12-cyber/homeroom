// Cloudflare Worker entry: serves the study-assistant proxy at /api/<provider> and everything else from the built site.
import { onRequestPost } from "./functions/api/[provider].js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/api\/([^/]+)\/?$/);
    if (m) {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      return onRequestPost({ request, env, params: { provider: m[1] } });
    }
    return env.ASSETS.fetch(request);
  },
};
