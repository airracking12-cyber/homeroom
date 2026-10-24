// Small shared helpers moved unchanged from the v33 App.jsx (email-link notices, ids, clipboard, file reading, assistant context).
import { callClaude } from "./ai.js";
import { parse, todayLong } from "./dates.js";
import { statusLabel } from "./constants.js";

export const LINK_NOTICE = (() => {
  try {
    const q = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const type = q.get("type");
    if (q.get("error") || q.get("error_code")) {
      return { err: /expired|invalid/i.test(q.get("error_description") || q.get("error_code") || "")
        ? "That email link has expired or was already used. Try signing in. If that fails, use \"Forgot your password?\" or create the account again." : "That email link didn't work. Try signing in." };
    }
    if (type === "signup" || type === "email" || type === "invite") return { info: "Email confirmed. Sign in below." };
  } catch (err) { console.warn("[Homeroom] non-fatal:", err); }
  return {};
})();
export const CONFIRMED = (() => {
  try {
    const q = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return !q.get("error") && !q.get("error_code") && ["signup", "email", "invite"].includes(q.get("type"));
  } catch { return false; }
})();


/* ───────────────────────── dates ───────────────────────── */
/* date helpers live in ./lib/dates.js */



export const sha = async (s) => {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
};
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (err) { console.warn("[Homeroom] non-fatal:", err); }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

export const readAsDataURL = (file) =>
  new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

export async function imageToJpegBase64(file) {
  const url = await readAsDataURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

export function buildContext(tasks, materials, progress, user, found) {
  const list = tasks
    .map((t) => `[${t.id}] ${t.title} | subject: ${t.subject} | type: ${t.type} | priority: ${t.priority} | due ${t.deadline} (${parse(t.deadline).toLocaleDateString("en-US", { weekday: "long" })}) | ${user}'s status: ${statusLabel(progress[t.id])} | notes: ${t.notes || "none"} | added by ${t.addedBy}`)
    .join("\n");
  // The assistant is not handed every note. It gets a short catalogue (titles only) plus the ideas the database found
  // for this very question (see notes.findIdeas), so answers stay on topic and fast however many notes the class has.
  const catalogue = materials.slice(0, 150).map((m) => `- "${m.title}" (${m.subject}${m.topic ? `, topic: ${m.topic}` : ""}${m.taskId ? `, for [${m.taskId}]` : ""}, by ${m.by})`).join("\n");
  const hits = (found || []).map((i) => `${i.subject}${i.topic ? ` / ${i.topic}` : ""} (from "${i.mt}"): ${i.t}: ${i.d}`).join("\n").slice(0, 20000);
  const mats = materials.length
    ? `Notes the class has stored (titles only):\n${catalogue}\n\nIdeas from those notes that match this question:\n${hits || "(none matched. Say so, and suggest adding notes in the Data tab.)"}`
    : "";
  return { today: todayLong(), list: list || "(no tasks yet)", mats: mats || "(no review material yet)" };
}

// a name as it is said to the person: usernames are lowercase, a greeting is not ("mika" -> "Mika")
export const nice = (name) => { const n = String(name || "").trim(); return n ? n[0].toUpperCase() + n.slice(1) : n; };
