import { supabase } from "./supabaseClient";
import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import {
  Plus, Check, X, ChevronLeft, ChevronRight, ArrowUp, Upload, Sparkles, Trash2,
  BookOpen, ListChecks, MessageCircle, Pencil, ChevronDown, CalendarDays,
  List as ListIcon, Gamepad2, Shield, Copy, Search, Music,
  Camera, FolderPlus, Folder, BadgeCheck, RotateCcw, Flame, Timer, Play, Pause, Columns3, SlidersHorizontal,
  Lightbulb, CircleAlert, LogOut, Sun, Moon, Hourglass, Target, Inbox,
} from "lucide-react";

/* ───────────────────────── tokens (CSS variables, so dark mode just works) ───────────────────────── */

const C = {
  bg: "var(--bg)", paper: "var(--paper)", ink: "var(--ink)", muted: "var(--muted)",
  faint: "var(--faint)", line: "var(--line)", wash: "var(--wash)", accent: "var(--accent)",
  accentInk: "#FFFFFF", danger: "var(--danger)", ok: "var(--ok)", okbg: "var(--okbg)",
  errbg: "var(--errbg)", body: "var(--body)",
};

const SERIF = `"Fraunces","Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif`;
const SANS = `"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif`;

const SUBJ = {
  Mathematics: "#5A7FA8",
  "Values Education": "#B38A2E",
  "Araling Panlipunan": "#8A877A",
  Filipino: "#5F8B6D",
};

const PAL = ["#C4684A", "#8B6B86", "#4F8A8B", "#9A7B4F", "#6E7FA3"];
const subjColor = (s) =>
  SUBJ[s] || PAL[[...(s || "x")].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];

// Accounts sign in with a real email and password. The username is the display name shown to the class.
// When someone lands here from an email link, work out what happened so the sign-in screen can say so.
const LINK_NOTICE = (() => {
  try {
    const q = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const type = q.get("type");
    if (q.get("error") || q.get("error_code")) {
      return { err: /expired|invalid/i.test(q.get("error_description") || q.get("error_code") || "")
        ? "That email link has expired or was already used. Try signing in. If that fails, use \"Forgot your password?\" or create the account again." : "That email link didn't work. Try signing in." };
    }
    if (type === "signup" || type === "email" || type === "invite") return { info: "Email confirmed. Sign in below." };
  } catch {}
  return {};
})();
const CONFIRMED = (() => {
  try {
    const q = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return !q.get("error") && !q.get("error_code") && ["signup", "email", "invite"].includes(q.get("type"));
  } catch { return false; }
})();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const TYPES = ["Homework", "Mini Task", "Quiz", "Study", "Project", "Exam"];
const REVIEW_TYPES = ["Quiz", "Study", "Exam"];
const QUARTERS = [1, 2, 3, 4];
const MAX_PROOF = 6;
// Quizzes, study sessions and exams are things you review for, so they never ask for a photo.
const needsProofType = (t) => !REVIEW_TYPES.includes(t.type);
const wantsProof = (t) => needsProofType(t) && t.proof !== false;
const PRIORITIES = ["High", "Medium", "Low"];
const STATUSES = [["todo", "Not started"], ["progress", "In progress"], ["done", "Done"]];
const DEFAULT_SUBJECTS = Object.keys(SUBJ);

/* ───────────────────────── dates ───────────────────────── */

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (iso, n) => { const d = parse(iso); d.setDate(d.getDate() + n); return toISO(d); };
const diffDays = (iso) => Math.round((parse(iso) - parse(todayISO())) / 864e5);
const fmtDate = (iso) => parse(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const todayLong = () => parse(todayISO()).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const relLabel = (iso) => {
  const n = diffDays(iso);
  if (n === -1) return "Yesterday";
  if (n < -1) return `${-n} days ago`;
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n < 7) return parse(iso).toLocaleDateString(undefined, { weekday: "long" });
  return fmtDate(iso);
};
const fmtShort = (iso) => parse(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const weekStartOf = (iso) => { const d = parse(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return toISO(d); }; // weeks start Monday
const weekLabel = (ws) => `${fmtShort(ws)} to ${fmtShort(addDays(ws, 6))}`;

function weekData(ws, tasks, materials) {
  const we = addDays(ws, 6);
  const ts = tasks.filter((t) => t.deadline >= ws && t.deadline <= we);
  const ids = new Set(ts.map((t) => t.id));
  const from = parse(ws).getTime(), to = parse(addDays(ws, 7)).getTime();
  const ms = materials.filter((m) => ids.has(m.taskId) || (m.at >= from && m.at < to));
  return { ts, ms };
}

const timeAgo = (ts) => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
};

const summarize = (list) =>
  list.slice(0, 3).map((t) => t.title).join(", ") + (list.length > 3 ? `and ${list.length - 3} more` : "");

/* ───────────────────────── storage ───────────────────────── */

const LS = "hr:";
const store = {
  async get(key, shared = false) {
    if (!shared) {
      try { const v = localStorage.getItem(LS + key); return v ? JSON.parse(v) : null; } catch { return null; }
    }
    try {
      const { data, error } = await supabase.from("kv").select("value").eq("key", key).maybeSingle();
      if (error) { console.error("kv get failed", error); return null; }
      return data ? data.value : null;
    } catch { return null; }
  },
  async set(key, val, shared = false) {
    if (!shared) {
      try { localStorage.setItem(LS + key, JSON.stringify(val)); return true; } catch { return false; }
    }
    try {
      const { error } = await supabase
        .from("kv")
        .upsert({ key, value: val, updated_at: new Date().toISOString() });
      if (error) { console.error("kv set failed", error); return false; }
      return true;
    } catch (e) { console.error("kv set failed", e); return false; }
  },
  async del(key, shared = false) {
    if (!shared) { try { localStorage.removeItem(LS + key); } catch {} return; }
    try { await supabase.from("kv").delete().eq("key", key); } catch {}
  },
  // Read, change, write back; if someone else saved in between, try again (so nobody's change is lost).
  async update(key, fn, empty = []) {
    for (let i = 0; i < 6; i++) {
      const { data, error } = await supabase.from("kv").select("value,version").eq("key", key).maybeSingle();
      if (error) { console.error("kv read failed", error); return false; }
      const next = fn(data ? data.value : empty);
      if (!data) {
        const r = await supabase.from("kv").insert({ key, value: next, version: 1 });
        if (!r.error) return true;
        continue;
      }
      const r = await supabase.from("kv").update({ value: next, version: data.version + 1, updated_at: new Date().toISOString() }).eq("key", key).eq("version", data.version).select("key");
      if (r.error) { console.error("kv write failed", r.error); return false; }
      if (r.data && r.data.length) return true;
    }
    return false;
  },
  classes: {
    async list() {
      const { data } = await supabase.from("classes").select("id,year,name,label").order("label");
      return data || [];
    },
    async add(c) {
      await supabase.from("classes").upsert(c, { onConflict: "id", ignoreDuplicates: true });
    },
  },
  async listShared(prefix) {
    try {
      const { data, error } = await supabase.from("kv").select("key,value").like("key", `${prefix}%`);
      if (error) return [];
      return data || [];
    } catch { return []; }
  },
};

async function loadProfile(id) {
  const { data } = await supabase.from("profiles").select("username,class_id,is_admin").eq("id", id).maybeSingle();
  return data || null;
}
async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: "Bearer " + (data?.session?.access_token || "") };
}

const sha = async (s) => {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
};
const randHex = () => [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, "0")).join("");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

/* ───────────────────────── sound: effects and a little generative lo-fi, all synthesized ───────────────────────── */

// A tiny haptic tick on phones when you press the main controls. Silently ignored where unsupported.
if (typeof document !== "undefined" && navigator.vibrate) {
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" && e.target.closest?.(".btn,.check,.chip,.fab,.tab,.nav")) navigator.vibrate(6);
  }, { passive: true });
}

const Sound = (() => {
  let ctx = null, master = null, musicBus = null, noise = null;
  let sfxOn = true, musicOn = false, vol = 0.5, timer = null, step = 0, nextTime = 0;
  const EIGHTH = 60 / 72 / 2;
  const CHORDS = [[130.81, 164.81, 196.0, 246.94], [110.0, 130.81, 164.81, 196.0], [146.83, 174.61, 220.0, 261.63], [98.0, 123.47, 146.83, 174.61]];
  const ROOTS = [65.41, 55.0, 73.42, 49.0];
  const PENT = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
      musicBus.connect(lp); lp.connect(master);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };

  const tone = (f, t, dur, o = {}) => {
    const { type = "sine", vol: v = 0.1, attack = 0.012, dest = master, lp } = o;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    let out = g;
    if (lp) { const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp; g.connect(fl); out = fl; }
    out.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.05);
  };

  const hit = (t, dur, v, hp) => {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(musicBus); s.start(t); s.stop(t + dur + 0.02);
  };

  const kick = (t) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.25);
  };

  const schedule = () => {
    while (nextTime < ctx.currentTime + 1.2) {
      const bar = Math.floor(step / 8) % 4, s = step % 8;
      const t = nextTime + (s % 2 === 1 ? 0.035 : 0);
      if (s === 0) CHORDS[bar].forEach((f) => tone(f, t, EIGHTH * 8 + 0.4, { vol: 0.03, attack: 0.5, dest: musicBus, lp: 900 }));
      if (s === 0 || s === 4) tone(ROOTS[bar], t, EIGHTH * 3, { vol: 0.1, attack: 0.02, dest: musicBus });
      if (s === 0 || s === 5) kick(t);
      if (s === 2 || s === 6) hit(t, 0.12, 0.05, 1800);
      if (s % 2 === 1) hit(t, 0.04, 0.018, 7000);
      if (Math.random() < 0.38) tone(PENT[Math.floor(Math.random() * PENT.length)], t, 0.9, { type: "triangle", vol: 0.045, dest: musicBus, lp: 2000 });
      nextTime += EIGHTH; step++;
    }
  };

  const grain = (t, dur, v, hp, lp) => {
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const h = ctx.createBiquadFilter(); h.type = "highpass"; h.frequency.value = hp;
    const l = ctx.createBiquadFilter(); l.type = "lowpass"; l.frequency.value = lp;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(h); h.connect(l); l.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  };
  const thud = (t, f, v) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.35, t + 0.14);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.24);
  };

  const SFX = {
    tap: (t) => tone(760, t, 0.05, { type: "triangle", vol: 0.035 }),
    done: (t) => { tone(523.25, t, 0.28, { vol: 0.09 }); tone(659.25, t + 0.08, 0.28, { vol: 0.09 }); tone(783.99, t + 0.16, 0.45, { vol: 0.1 }); },
    undo: (t) => tone(392, t, 0.18, { type: "triangle", vol: 0.07 }),
    add: (t) => { tone(587.33, t, 0.2, { vol: 0.08 }); tone(880, t + 0.08, 0.35, { vol: 0.08 }); },
    send: (t) => tone(698.46, t, 0.12, { type: "triangle", vol: 0.06 }),
    pop: (t) => tone(987.77, t, 0.18, { vol: 0.05 }),
    err: (t) => { tone(233, t, 0.16, { type: "triangle", vol: 0.08 }); tone(185, t + 0.12, 0.25, { type: "triangle", vol: 0.08 }); },
    bell: (t) => { tone(1318.5, t, 1.1, { vol: 0.08 }); tone(1975.5, t, 0.7, { vol: 0.03 }); tone(2637, t, 0.4, { vol: 0.015 }); },
    // paper-and-stationery sounds
    rip: (t) => grain(t, 0.09, 0.11, 1800 + Math.random() * 1200, 7500),
    whoosh: (t) => grain(t, 0.26, 0.04, 500, 3200),
    stamp: (t) => { thud(t, 150, 0.22); grain(t, 0.06, 0.07, 900, 4000); },
    boxOpen: (t) => {
      grain(t, 0.4, 0.09, 300, 5000); thud(t + 0.06, 110, 0.2);
      tone(659.25, t + 0.28, 0.4, { vol: 0.07 }); tone(987.77, t + 0.36, 0.55, { vol: 0.07 }); tone(1318.5, t + 0.46, 0.8, { vol: 0.05 });
    },
    schoolbell: (t) => { [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach((d) => { tone(1568, t + d, 0.5, { vol: 0.07 }); tone(2349, t + d, 0.3, { vol: 0.025 }); }); },
  };

  return {
    play(name) { if (!sfxOn || !ensure()) return; try { SFX[name] && SFX[name](ctx.currentTime + 0.001); } catch {} },
    setSfx(v) { sfxOn = v; },
    setVolume(v) { vol = v; if (ctx && musicBus) musicBus.gain.setTargetAtTime(musicOn ? vol * 0.9 : 0, ctx.currentTime, 0.1); },
    startMusic() {
      if (!ensure() || musicOn) return;
      musicOn = true; step = 0; nextTime = ctx.currentTime + 0.1;
      schedule(); timer = setInterval(schedule, 250);
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setTargetAtTime(vol * 0.9, ctx.currentTime, 0.6);
    },
    stopMusic() {
      if (!ctx || !musicOn) return;
      musicOn = false; musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      const tm = timer; timer = null; setTimeout(() => clearInterval(tm), 900);
    },
    isMusic: () => musicOn,
    pause() { if (ctx && musicOn && ctx.state === "running") ctx.suspend(); },
    resume() { if (ctx && musicOn && ctx.state === "suspended") ctx.resume(); },
  };
})();

/* ───────────────────────── files ───────────────────────── */

const readAsDataURL = (file) =>
  new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

async function imageToJpegBase64(file) {
  const url = await readAsDataURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

async function compressImage(file, max = 1400, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/jpeg", quality));
  } finally { URL.revokeObjectURL(url); }
}

const safePart = (x) => String(x).replace(/[^A-Za-z0-9_-]/g, "_");

// Shrinks the photo and uploads it to the PRIVATE task-proofs bucket. Returns the file's path, not a link:
// links are only made on demand (see ProofThumbs) and only for the student who sent it and the admin.
async function uploadProof(file, path) {
  let body = file, type = file.type || "image/jpeg";
  try { body = await compressImage(file); type = "image/jpeg"; } catch { /* unreadable format: upload as is */ }
  const { error } = await supabase.storage.from("task-proofs").upload(path, body, { contentType: type, cacheControl: "3600" });
  if (error) throw error;
  return path;
}
const proofPaths = (rec) => (rec && (rec.paths || rec.urls)) || [];

async function extractFromFile(file) {
  const system = "You turn study material into clean study notes. Plain text only, no markdown symbols, no emojis. Keep headings and lists as plain lines. Describe diagrams or tables briefly in words. Keep the result under 650 words, condensing if the source is long, and keep every important fact, term, formula and date.";
  let block;
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const data = (await readAsDataURL(file)).split(",")[1];
    block = { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  } else {
    block = { type: "image", source: { type: "base64", media_type: "image/jpeg", data: await imageToJpegBase64(file) } };
  }
  return callClaude(system, [{ role: "user", content: [block, { type: "text", text: "Turn this into study notes." }] }]);
}

/* ───────────────────────── AI: Gemini first, Groq as the backup (keys live in src/keys.js) ───────────────────────── */

// The AI keys live on the server (functions/api/[provider].js), never in the browser.
const GEMINI = "/api/gemini";
const GROQ = "/api/groq";
const GROQ_MODEL = "openai/gpt-oss-120b";

function toGemini(system, messages) {
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
const hasMedia = (messages) => messages.some((m) => Array.isArray(m.content) && m.content.some((b) => b.type !== "text"));

function toGroq(system, messages, stream) {
  const msgs = messages.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: Array.isArray(m.content) ? m.content.map((b) => b.text || "").join("\n") : m.content,
  }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return { model: GROQ_MODEL, messages: [{ role: "system", content: system }, ...msgs], max_completion_tokens: 4096, reasoning_effort: "low", stream };
}

const geminiText = (data) => (data?.candidates?.[0]?.content?.parts || []).map((x) => x.text || "").join("");

async function geminiCall(system, messages) {
  const res = await fetch(`${GEMINI}?mode=generate`, {
    method: "POST", headers: await authHeaders(),
    body: JSON.stringify(toGemini(system, messages)),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const text = geminiText(await res.json());
  if (!text) throw new Error("Gemini empty");
  return text;
}

async function groqCall(system, messages) {
  const res = await fetch(GROQ, {
    method: "POST", headers: await authHeaders(),
    body: JSON.stringify(toGroq(system, messages, false)),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const text = (await res.json())?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Groq empty");
  return text;
}

// Reads a server-sent-events stream and calls pick(parsedLine) for each data line.
async function readSSE(res, pick, onText) {
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

const busy = () => new Error("The AI is busy right now. Try again in a minute.");

async function callClaude(system, messages) {
  { try { return await geminiCall(system, messages); } catch (e) { console.warn("Gemini failed, trying Groq", e); } }
  if (!hasMedia(messages)) { try { return await groqCall(system, messages); } catch (e) { console.warn("Groq failed", e); } }
  throw busy();
}

// Streams text as it is written. Gemini first; if it fails or hits its free limit, Groq takes over.
async function streamClaude(system, messages, onText) {
  {
    try {
      const res = await fetch(`${GEMINI}?mode=stream`, {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify(toGemini(system, messages)),
      });
      return await readSSE(res, geminiText, onText);
    } catch (e) { console.warn("Gemini stream failed, trying Groq", e); }
  }
  if (!hasMedia(messages)) {
    try {
      const res = await fetch(GROQ, {
        method: "POST", headers: await authHeaders(),
        body: JSON.stringify(toGroq(system, messages, true)),
      });
      return await readSSE(res, (d) => d?.choices?.[0]?.delta?.content || "", onText);
    } catch (e) { console.warn("Groq stream failed", e); }
  }
  throw busy();
}

function parseJSON(t) {
  const s = (t || "").replace(/```json|```/g, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < 0) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

const statusLabel = (s) => (STATUSES.find((x) => x[0] === (s || "todo")) || STATUSES[0])[1];

function buildContext(tasks, materials, progress, user) {
  const list = tasks
    .map((t) => `[${t.id}] ${t.title} | subject: ${t.subject} | type: ${t.type} | priority: ${t.priority} | due ${t.deadline} (${parse(t.deadline).toLocaleDateString("en-US", { weekday: "long" })}) | ${user}'s status: ${statusLabel(progress[t.id])} | notes: ${t.notes || "none"} | added by ${t.addedBy}`)
    .join("\n");
  const mats = materials
    .map((m) => `--- Review material "${m.title}" for [${m.taskId}], by ${m.by}\n${m.text.slice(0, 2500)}`)
    .join("\n").slice(0, 12000);
  return { today: todayLong(), list: list || "(no tasks yet)", mats: mats || "(no review material yet)" };
}

/* ───────────────────────── styles ───────────────────────── */

const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{-webkit-text-size-adjust:100%}
body{margin:0}
.hr{--bg:#F6F4EE;--paper:#FFFFFF;--ink:#1C1B19;--muted:#6C695F;--faint:#A5A194;--line:#E8E4D8;--wash:#EFEBDF;--accent:#C4694A;--danger:#B4432F;--ok:#4E8A63;--okbg:#EEF6F0;--errbg:#FBEFEB;--body:#3A3935;--accent-soft:color-mix(in srgb,var(--accent) 12%,transparent);--accent-line:color-mix(in srgb,var(--accent) 38%,transparent);--shadow-sm:0 1px 2px rgba(60,45,20,.06),0 0 0 1px rgba(60,45,20,.015);--shadow:0 14px 34px -14px rgba(60,45,20,.28),0 2px 6px rgba(60,45,20,.06);--shadow-lg:0 34px 80px -24px rgba(40,30,10,.45);--glass:rgba(246,244,238,.8);--ease:cubic-bezier(.22,1,.36,1);--spring:cubic-bezier(.34,1.56,.64,1);--maxw:860px;color-scheme:light}
.hr[data-theme="dark"]{--bg:#151412;--paper:#1F1E1B;--ink:#F2EFE7;--muted:#A8A498;--faint:#76736A;--line:#2D2B27;--wash:#262420;--accent:#DB8566;--danger:#E58A74;--ok:#7FB08D;--okbg:#1C2A21;--errbg:#33201C;--body:#D9D6CC;--shadow-sm:0 1px 2px rgba(0,0,0,.4);--shadow:0 14px 34px -14px rgba(0,0,0,.75),0 2px 6px rgba(0,0,0,.3);--shadow-lg:0 34px 80px -24px rgba(0,0,0,.85);--glass:rgba(21,20,18,.8);color-scheme:dark}
.hr{font-family:${SANS};color:var(--ink);background:var(--bg);width:100%;height:100vh;height:100dvh;position:relative;font-size:15px;line-height:1.45;overflow:hidden;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.hr button{font-family:inherit;color:inherit;cursor:pointer}
.hr input,.hr textarea{font-family:inherit;font-size:16px;color:var(--ink)}
.hr ::placeholder{color:var(--faint)}
.hr :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.hr ::selection{background:var(--accent-soft)}
.serif{font-family:${SERIF};letter-spacing:-.012em}
.hr .scroll,.hr .side,.hr .sheet,.hr .msgs,.hr .chips{scrollbar-width:thin;scrollbar-color:var(--line) transparent}

/* ── layout: phone, tablet, desktop ── */
.hr.solo{display:flex}
.hr.solo>*{flex:1;min-width:0;min-height:0;position:relative;z-index:1}
.hr.app{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr);background:var(--bg)}
.main{position:relative;z-index:1;display:flex;flex-direction:column;min-width:0;min-height:0}
.page{flex:1;min-height:0;display:flex;flex-direction:column;animation:pageIn .5s var(--ease) both}
.page>.chat{flex:1;height:auto}
.rail,.side,.searchPill,.newBtn,.classChip,.ico .boardBtn{display:none}
@media (min-width:760px){
  .hr.app{grid-template-columns:92px minmax(0,1fr)}
  .rail{display:flex}
  .tabs,.fab,.phoneOnly{display:none!important}
  .searchPill{display:flex}
  .newBtn{display:inline-flex;align-items:center;gap:7px}
  .classChip{display:inline-flex}
  .searchBtn{display:none!important}
  .ico .boardBtn{display:grid}
}
@media (min-width:1180px){
  .hr.app{grid-template-columns:268px minmax(0,1fr) 410px}
  .side{display:flex}
  .noDesk{display:none!important}
  .hr.app[data-wide="1"]{grid-template-columns:268px minmax(0,1fr)}
  .hr.app[data-wide="1"] .side{display:none}
}
.hr.app[data-wide="1"]{--maxw:100000px}

/* ── rail (tablet + desktop) ── */
.rail{position:relative;flex-direction:column;gap:4px;padding:22px 14px 18px;border-right:1px solid var(--line);background:color-mix(in srgb,var(--paper) 55%,transparent);backdrop-filter:blur(16px);z-index:6}
.railLogo{height:44px;display:flex;align-items:center;justify-content:center;margin-bottom:16px}
.railLogo .logoFull{display:none}
.railLogo .logoMini{font-size:26px;width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:var(--ink);color:var(--bg)}
.nav{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:11px 0;border:0;background:none;border-radius:16px;font-size:11.5px;font-weight:500;color:var(--muted);transition:background .25s var(--ease),color .2s,transform .25s var(--ease)}
.nav svg{transition:transform .3s var(--spring),color .2s}
.nav:active{transform:scale(.96)}
@media (hover:hover){.nav:hover{background:var(--wash);color:var(--ink)}.nav:hover svg{transform:scale(1.08)}}
.nav[aria-current="page"]{color:var(--ink)}
.nav[aria-current="page"] svg{color:var(--accent)}
.nav .badge{top:5px;left:calc(50% + 6px)}
.railSpacer{flex:1}
.nav.acct .avatar{width:34px;height:34px}
.nav.acct span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (min-width:1180px){
  .railLogo{justify-content:flex-start;padding-left:6px}
  .railLogo .logoMini{display:none}
  .railLogo .logoFull{display:block;font-size:26px}
  .nav{flex-direction:row;justify-content:flex-start;gap:13px;padding:12px 16px;font-size:14.5px}
  .nav .badge{top:50%;margin-top:-9px;left:auto;right:14px}
}

/* ── header ── */
.head{position:relative;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px max(20px,calc((100% - var(--maxw))/2)) 10px}
.headL{display:flex;align-items:center;gap:10px;min-width:0}
.mark{font-family:${SERIF};font-size:23px;letter-spacing:-.025em}
.classChip{align-items:center;padding:5px 12px;border-radius:999px;background:var(--wash);color:var(--muted);font-size:13px;font-weight:500}
.avatar{width:36px;height:36px;border-radius:50%;border:1px solid var(--line);background:var(--paper);font-family:${SERIF};font-size:15px;display:grid;place-items:center;box-shadow:var(--shadow-sm);transition:transform .25s var(--spring)}
button.avatar:active{transform:scale(.92)}
.hdrRight{display:flex;gap:8px;align-items:center}
.hdrBtn{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:38px;height:38px;border:1px solid var(--line);background:var(--paper);border-radius:50%;color:var(--muted);padding:0;box-shadow:var(--shadow-sm);transition:background .2s,transform .25s var(--spring),color .2s,border-color .2s}
.hdrBtn:active{transform:scale(.92)}
@media (hover:hover){.hdrBtn:hover{color:var(--ink);background:var(--wash)}}
.hdrBtn span{display:none;font-size:13.5px}
@media (min-width:440px){.hdrBtn.wide{width:auto;padding:0 14px;border-radius:999px}.hdrBtn.wide span{display:inline}}
.searchPill{align-items:center;gap:10px;min-width:280px;padding:9px 14px;border:1px solid var(--line);background:var(--paper);border-radius:13px;color:var(--faint);font-size:14px;box-shadow:var(--shadow-sm);transition:border-color .2s,box-shadow .25s var(--ease)}
@media (hover:hover){.searchPill:hover{border-color:var(--accent-line);box-shadow:var(--shadow)}}
.searchPill span{flex:1;text-align:left}
.kbd{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--muted);background:var(--wash);border-radius:6px;padding:2px 7px}

/* ── phone nav + fab ── */
.tabs{position:absolute;left:14px;right:14px;bottom:calc(10px + env(safe-area-inset-bottom));display:flex;gap:2px;background:var(--glass);backdrop-filter:blur(20px) saturate(1.6);-webkit-backdrop-filter:blur(20px) saturate(1.6);border:1px solid var(--line);border-radius:24px;padding:6px;box-shadow:var(--shadow);z-index:4}
.tab{position:relative;z-index:1;flex:1;background:none;border:0;border-radius:18px;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 0 7px;font-size:11.5px;font-weight:500;color:var(--faint);transition:background .3s var(--ease),color .2s}
.tab svg{transition:transform .35s var(--spring)}
.tab[aria-current="page"]{color:var(--ink)}
.tab[aria-current="page"] svg{color:var(--accent);transform:translateY(-1px) scale(1.08)}
.badge{position:absolute;top:2px;left:calc(50% + 4px);min-width:17px;height:17px;border-radius:9px;background:var(--accent);color:#fff;font-size:11px;font-weight:600;display:grid;place-items:center;padding:0 5px}
.fab{position:absolute;right:20px;bottom:calc(92px + env(safe-area-inset-bottom));width:56px;height:56px;border-radius:20px;border:0;background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 70%,#fff));color:#fff;display:grid;place-items:center;box-shadow:0 14px 28px -8px color-mix(in srgb,var(--accent) 70%,#000),0 2px 6px rgba(0,0,0,.15);z-index:3;transition:transform .3s var(--spring)}
.fab:active{transform:scale(.9) rotate(90deg)}

/* ── scroll area + typography ── */
.scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:0 max(20px,calc((100% - var(--maxw))/2)) 130px;overscroll-behavior-y:contain;scroll-behavior:smooth}
.scroll.wide{--maxw:100000px}
@media (min-width:760px){.scroll{padding-bottom:60px}}
.h1{font-family:${SERIF};font-size:32px;line-height:1.12;letter-spacing:-.025em;margin:8px 0 6px;font-weight:400}
@media (min-width:760px){.h1{font-size:40px}}
.sub{color:var(--muted);margin:0 0 6px}
.sectionTitle{font-family:${SERIF};font-size:20px;font-weight:400;margin:28px 0 10px}
.meta{font-size:13px;color:var(--muted)}
.heroChips{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.streak{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:13px;font-weight:600}
.streak.quiet{background:var(--wash);color:var(--muted);font-weight:500}
.ring{position:relative;flex:none}
.ring svg{display:block;transform:rotate(-90deg)}
.ring circle{fill:none;stroke-linecap:round}
.ring .bg{stroke:var(--line)}
.ring .fg{stroke:var(--accent);transition:stroke-dashoffset 1.1s var(--ease)}
.ring .lbl{position:absolute;inset:0;display:grid;place-content:center;text-align:center;line-height:1.1}
.ring .lbl b{font-family:${SERIF};font-weight:400;font-size:26px;letter-spacing:-.02em}
.ring .lbl span{font-size:11px;color:var(--muted);margin-top:2px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:16px 0 14px;border:0;margin:0}
/* ── controls ── */
.seg{position:relative;display:inline-flex;background:var(--wash);border-radius:13px;padding:3px;gap:2px;flex-wrap:wrap}
.seg button{position:relative;z-index:1;border:0;background:none;padding:7px 13px;border-radius:10px;font-size:14px;font-weight:500;color:var(--muted);transition:background .25s var(--ease),color .2s,box-shadow .25s}
@media (hover:hover){.seg button:hover{color:var(--ink)}}
.seg button[aria-pressed="true"]{color:var(--ink)}
.chips{display:flex;gap:8px;overflow-x:auto;padding:12px 0 6px;scrollbar-width:none}
.chips::-webkit-scrollbar{display:none}
.chip{flex:none;border:1px solid var(--line);background:var(--paper);border-radius:999px;padding:6px 14px;font-size:14px;font-weight:500;color:var(--muted);display:inline-flex;align-items:center;gap:7px;transition:background .25s var(--ease),border-color .2s,color .2s,transform .25s var(--spring)}
.chip:active{transform:scale(.95)}
@media (hover:hover){.chip:hover{border-color:var(--accent-line);color:var(--ink)}}
.chip[aria-pressed="true"]{border-color:var(--ink);color:var(--ink);background:var(--paper);box-shadow:0 0 0 1px var(--ink) inset}
.ico{display:inline-flex;background:var(--wash);border-radius:13px;padding:3px}
.ico button{border:0;background:none;width:36px;height:32px;border-radius:10px;display:grid;place-items:center;color:var(--muted);transition:background .25s var(--ease),color .2s}
.ico button[aria-pressed="true"]{background:var(--paper);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.btn{border:0;border-radius:14px;padding:12px 18px;font-size:15px;font-weight:600;background:var(--ink);color:var(--bg);transition:transform .25s var(--spring),opacity .2s,box-shadow .25s var(--ease),background .2s}
.btn:active{transform:scale(.97)}
@media (hover:hover){.btn:hover{box-shadow:var(--shadow)}.btn.ghost:hover{background:var(--wash);box-shadow:none}}
.btn.accent{background:var(--accent);color:#fff;position:relative;overflow:hidden}
.btn.accent::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.3) 50%,transparent 70%);transform:translateX(-130%);transition:transform .8s var(--ease);pointer-events:none}
@media (hover:hover){.btn.accent:not(:disabled):hover::after{transform:translateX(130%)}}
.btn.ghost{background:none;border:1px solid var(--line);color:var(--ink);font-weight:500}
.btn:disabled{opacity:.45;cursor:default;box-shadow:none;transform:none}
.btn.full{width:100%}
.small{padding:8px 14px;font-size:14px;border-radius:11px}
.field{margin-bottom:18px}
.field label{display:block;font-size:13px;font-weight:500;color:var(--muted);margin-bottom:7px}
.input{width:100%;border:1px solid var(--line);background:var(--paper);border-radius:14px;padding:12px 14px;transition:border-color .2s,box-shadow .25s var(--ease)}
.input:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
textarea.input{resize:vertical;min-height:84px;line-height:1.45}
.iconBtn{background:none;border:0;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:var(--muted);transition:background .2s,transform .25s var(--spring)}
.iconBtn:active{transform:scale(.9)}
@media (hover:hover){.iconBtn:hover{background:var(--wash);color:var(--ink)}}
.back{background:none;border:0;display:inline-flex;align-items:center;gap:2px;color:var(--muted);padding:8px 0;font-size:14px}
.tag{font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:1px 7px;margin-left:8px;font-weight:400}
.swatches{display:flex;gap:10px}
.sw{width:30px;height:30px;border-radius:50%;border:0;padding:0;transition:transform .3s var(--spring),box-shadow .25s}
.sw[aria-pressed="true"]{box-shadow:0 0 0 3px var(--bg),0 0 0 5px currentColor;transform:scale(1.05)}
.sw:active{transform:scale(.88)}

.fpanel{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .5s var(--ease),opacity .35s var(--ease)}
.fpanel[data-open="1"]{grid-template-rows:1fr;opacity:1}
.fpanel>div{overflow:hidden;min-height:0}
.fpanel .fin{padding:12px 0 2px}
.filterBtn .fcount{font-size:11px;min-width:18px;height:18px;border-radius:9px;background:var(--accent);color:#fff;display:inline-grid;place-items:center;padding:0 5px}
@media (max-width:519px){.filterBtn span{display:none}.filterBtn{padding:7px 11px}}
/* ── task cards ── */
.group{margin-top:26px}
.group h3{font-family:${SERIF};font-weight:400;font-size:18px;margin:0 0 4px;display:flex;align-items:baseline;gap:8px}
.group h3 small{font-family:${SANS};font-size:13px;color:var(--faint)}
.swipe{position:relative;touch-action:pan-y;overflow:hidden;border-radius:18px;margin-top:9px;background:var(--wash);box-shadow:var(--shadow-sm);animation:lift .55s var(--ease) both;animation-delay:calc(var(--i,0)*32ms);transition:box-shadow .3s var(--ease)}
@media (hover:hover){.swipe:hover{box-shadow:var(--shadow)}}
.under{position:absolute;inset:0;display:flex;justify-content:space-between;align-items:center;padding:0 20px;background:var(--wash);color:var(--muted);font-size:14px;font-weight:500}
.under span{display:inline-flex;align-items:center;gap:6px;transition:opacity .15s}
.row{display:flex;gap:14px;align-items:flex-start;padding:15px 16px;border:1px solid var(--line);border-radius:18px;cursor:pointer;width:100%;background:var(--paper);text-align:left;position:relative;transition:border-color .25s,background .25s}
@media (hover:hover){.row:hover{border-color:var(--accent-line)}}
.row[data-sel="1"]{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.check{flex:none;width:24px;height:24px;border-radius:50%;border:1.8px solid var(--faint);background:none;display:grid;place-items:center;margin-top:0;padding:0;color:#fff;transition:background .25s var(--ease),border-color .25s,transform .35s var(--spring)}
.check:active{transform:scale(.85)}
@media (hover:hover){.check:hover{border-color:var(--accent)}}
.check svg{animation:pop .45s var(--spring)}
.check[data-s="done"]{background:var(--accent);border-color:var(--accent)}
.check[data-s="progress"]{border-color:var(--accent);background:linear-gradient(90deg,var(--accent) 50%,transparent 50%)}
.rowMain{flex:1;min-width:0}
.rowTitle{font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:color .4s var(--ease),background-size .55s var(--ease);background:linear-gradient(currentColor,currentColor) no-repeat 0 58%/0% 1.5px;width:fit-content;max-width:100%}
.rowTitle[data-done="1"]{color:var(--faint);background-size:100% 1.5px}
.rowMeta{display:flex;flex-wrap:wrap;gap:3px 12px;font-size:13px;color:var(--muted);margin-top:4px;align-items:center}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}
.rowRight{text-align:right;flex:none;font-size:13px;font-weight:500}
.late{color:var(--danger)}
.pri{color:var(--faint);margin-top:2px;font-weight:400}
.pri[data-p="High"]{color:var(--accent)}
.empty::before{content:"";display:block;width:128px;height:98px;margin:0 auto 16px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='98' viewBox='0 0 120 92' fill='none'%3E%3Crect x='18' y='20' width='84' height='56' rx='14' fill='%23C4694A' fill-opacity='.12'/%3E%3Crect x='28' y='12' width='64' height='56' rx='14' fill='%23C4694A' fill-opacity='.07' stroke='%23C4694A' stroke-opacity='.4' stroke-width='1.5'/%3E%3Ccircle cx='60' cy='40' r='13' fill='%23C4694A' fill-opacity='.16'/%3E%3Cpath d='M53 40.5l5 5 9-10' stroke='%23C4694A' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='100' cy='18' r='3' fill='%23C4694A' fill-opacity='.55'/%3E%3Ccircle cx='14' cy='64' r='2.5' fill='%23C4694A' fill-opacity='.45'/%3E%3Cpath d='M104 50l2 5 5 2-5 2-2 5-2-5-5-2 5-2z' fill='%23C4694A' fill-opacity='.4'/%3E%3C/svg%3E") center/contain no-repeat;animation:floaty 5s ease-in-out infinite}
.empty.plain::before{display:none}
.empty{padding:48px 8px;text-align:center;color:var(--muted);animation:lift .5s var(--ease) both}
.empty .serif{font-size:22px;color:var(--ink);margin-bottom:6px}

/* ── board (tablet + desktop) ── */
.board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:16px;align-items:start}
@media (max-width:1000px){.board{grid-template-columns:repeat(3,minmax(250px,1fr));overflow-x:auto}}
.col{background:color-mix(in srgb,var(--wash) 60%,transparent);border:1.5px solid transparent;border-radius:22px;padding:14px;min-height:260px;transition:background .25s var(--ease),border-color .25s}
.col[data-over="1"]{border-color:var(--accent);background:var(--accent-soft)}
.col h4{margin:2px 4px 6px;font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);display:flex;justify-content:space-between}
.col .swipe{margin-top:8px}
.col .pri{display:none}
.col [draggable]{cursor:grab}
.dragHint{font-size:13px;color:var(--faint)}
@media (hover:none){.dragHint{display:none}}
.colEmpty{font-size:13px;color:var(--faint);text-align:center;padding:26px 0}

/* ── side panel (desktop) ── */
.side{flex-direction:column;gap:16px;border-left:1px solid var(--line);background:color-mix(in srgb,var(--paper) 55%,transparent);backdrop-filter:blur(16px);overflow-y:auto;padding:24px 22px 32px;z-index:3}
.card{background:var(--paper);border:1px solid var(--line);border-radius:22px;padding:18px;box-shadow:var(--shadow-sm);animation:lift .55s var(--ease) both}
.card h4{font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin:0 0 14px;font-weight:600}
.timer{display:flex;align-items:center;gap:18px}
.timerBtns{display:flex;flex-direction:column;gap:8px;flex:1}
.mini{display:flex;align-items:center;gap:11px;padding:10px 0;border:0;border-bottom:1px solid var(--line);background:none;width:100%;text-align:left;transition:transform .3s var(--ease)}
.mini:last-child{border-bottom:0;padding-bottom:0}
@media (hover:hover){.mini:hover{transform:translateX(3px)}}
.mini b{font-weight:550;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mini div{min-width:0;flex:1}
.sbar{margin-bottom:12px}
.sbar:last-child{margin-bottom:0}
.sbar>div:first-child{display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px}
.sbar .t{height:6px;border-radius:3px;background:var(--wash);overflow:hidden}
.sbar .t i{display:block;height:100%;border-radius:3px;transition:width 1s var(--ease)}
.inspector{animation:slideIn .5s var(--ease) both}
.inspHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}

/* ── sheets + modals ── */
.overlay{position:fixed;inset:0;z-index:50;display:flex;align-items:flex-end;justify-content:center}
.scrim{position:absolute;inset:0;background:rgba(12,10,8,.42);backdrop-filter:blur(3px);opacity:0;transition:opacity .35s var(--ease)}
.overlay[data-show="1"] .scrim{opacity:1}
.sheet{position:relative;width:100%;max-width:680px;max-height:92%;overflow-y:auto;background:var(--bg);border-radius:28px 28px 0 0;padding:14px 22px calc(30px + env(safe-area-inset-bottom));box-shadow:var(--shadow-lg);transform:translateY(105%);transition:transform .5s var(--ease)}
.overlay[data-show="1"] .sheet{transform:none}
@media (min-width:760px){
  .overlay{align-items:center;padding:24px}
  .sheet{max-width:600px;max-height:88%;border-radius:28px;padding:26px 28px 30px;border:1px solid var(--line);transform:translateY(18px) scale(.965);opacity:0;transition:transform .45s var(--ease),opacity .3s var(--ease)}
  .sheet::before{display:none}
  .overlay[data-show="1"] .sheet{transform:none;opacity:1}
}
.sheetHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}

/* ── lists, notes, chat ── */
.mat{border-bottom:1px solid var(--line)}
.matHead{width:100%;display:flex;justify-content:space-between;gap:10px;align-items:center;background:none;border:0;padding:14px 0;text-align:left}
.matBody{white-space:pre-wrap;color:var(--body);padding:0 0 16px;font-size:14.5px;line-height:1.6}
.chat{display:flex;flex-direction:column;height:100%;min-height:0}
.msgs{flex:1;overflow-y:auto;padding:4px max(20px,calc((100% - 780px)/2)) 12px}
.msg{margin:16px 0;max-width:88%;white-space:pre-wrap;line-height:1.55;animation:lift .4s var(--ease) both}
.msg.me{margin-left:auto;background:var(--accent);color:#fff;padding:10px 15px;border-radius:20px 20px 6px 20px}
.msg.ai{font-family:${SERIF};font-size:17px;line-height:1.6}
.added{margin-top:10px;border-left:2px solid var(--accent);padding:2px 0 2px 12px;font-family:${SANS};font-size:14px;color:var(--muted)}
.added b{display:block;color:var(--ink);font-weight:550}
.composer{display:flex;gap:10px;align-items:flex-end;padding:10px max(16px,calc((100% - 780px)/2)) calc(96px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:var(--glass);backdrop-filter:blur(14px)}
@media (min-width:760px){.composer{padding-bottom:18px}}
.composer textarea{flex:1;border:1px solid var(--line);background:var(--paper);border-radius:22px;padding:11px 18px;resize:none;max-height:140px;line-height:1.4;transition:border-color .2s,box-shadow .25s var(--ease)}
.composer textarea:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
.send{width:44px;height:44px;border-radius:50%;border:0;background:var(--accent);color:#fff;display:grid;place-items:center;flex:none;transition:transform .3s var(--spring),background .2s}
.send:active{transform:scale(.88)}
.send:disabled{background:var(--line);color:var(--faint)}
.suggest{display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin-top:18px}
.suggest button{border:1px solid var(--line);background:var(--paper);border-radius:16px;padding:10px 15px;font-size:14.5px;text-align:left;color:var(--ink);box-shadow:var(--shadow-sm);transition:transform .3s var(--ease),border-color .2s}
@media (hover:hover){.suggest button:hover{transform:translateX(4px);border-color:var(--accent-line)}}
.opt{width:100%;text-align:left;border:1px solid var(--line);background:var(--paper);border-radius:16px;padding:14px 16px;margin-bottom:10px;font-size:15px;display:flex;gap:12px;box-shadow:var(--shadow-sm);transition:border-color .2s,background .25s,transform .25s var(--spring)}
.opt:active{transform:scale(.99)}
@media (hover:hover){.opt:not(:disabled):hover{border-color:var(--accent-line)}}
.opt[data-s="right"]{border-color:var(--ok);background:var(--okbg)}
.opt[data-s="wrong"]{border-color:var(--danger);background:var(--errbg)}
.opt:disabled{cursor:default}
.err{color:var(--danger);font-size:14px;margin:0 0 14px}
.bar{height:5px;background:var(--line);border-radius:3px;overflow:hidden;margin:6px 0 22px}
.bar i{display:block;height:100%;background:var(--accent);border-radius:3px;transition:width .6s var(--ease)}
.note{border:1px solid var(--accent-line);background:var(--accent-soft);border-radius:18px;padding:12px 8px 12px 16px;margin:0 0 14px;display:flex;justify-content:space-between;gap:8px;animation:lift .5s var(--ease) both}
.note p{margin:0 0 6px;color:var(--muted);font-size:14.5px;line-height:1.5}
.note p span{color:var(--ink);font-weight:550}
.ann{background:var(--paper);border:1px solid var(--line);box-shadow:var(--shadow-sm);border-radius:20px;padding:15px 8px 15px 18px;margin-bottom:14px;display:flex;justify-content:space-between;gap:8px;animation:lift .5s var(--ease) both}
.ann small{display:block;font-size:12.5px;color:var(--muted);margin-bottom:4px}
.ann p{margin:0;font-family:${SERIF};font-size:17px;line-height:1.5;white-space:pre-wrap}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:12px}
.calHead{font-size:12px;font-weight:500;color:var(--faint);text-align:center;padding:6px 0}
.day{border:1px solid transparent;background:none;border-radius:16px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px 0 9px;font-size:14px;min-height:56px;transition:background .25s var(--ease),border-color .2s}
@media (min-width:760px){.day{min-height:84px;padding-top:10px}}
@media (hover:hover){.day:hover{background:var(--wash)}}
.day[data-sel="1"]{background:var(--paper);border-color:var(--line);box-shadow:var(--shadow-sm)}
.day .num{width:28px;height:28px;border-radius:50%;display:grid;place-items:center}
.day[data-today="1"] .num{background:var(--accent);color:#fff}
.pips{display:flex;gap:3px;height:6px}
.pips i{width:6px;height:6px;border-radius:50%;display:block}
.fr{display:grid;grid-template-columns:1fr 1fr 36px;gap:8px;margin-bottom:8px;align-items:center}
.item{padding:16px 0;border-bottom:1px solid var(--line)}
.cmd{background:var(--wash);border-radius:12px;padding:11px 13px;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;user-select:all;margin:12px 0 10px}
.cmt{padding:12px 0;border-bottom:1px solid var(--line)}
.cmt b{font-weight:550}
.cmtIn{display:flex;gap:8px;align-items:flex-end;margin-top:14px}
.cmtIn textarea{flex:1;min-height:44px;max-height:110px;resize:none;border:1px solid var(--line);background:var(--paper);border-radius:16px;padding:10px 14px;line-height:1.4}
.fcard{width:100%;min-height:240px;border:1px solid var(--line);background:var(--paper);border-radius:24px;padding:30px 26px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;box-shadow:var(--shadow);transition:transform .4s var(--ease)}
.fcard .t{font-family:${SERIF};font-size:23px;line-height:1.4;animation:fade .35s var(--ease)}
.fcard .k{font-size:13px;color:var(--muted)}

/* ── feedback bits ── */
.toast{position:absolute;left:20px;right:84px;bottom:calc(92px + env(safe-area-inset-bottom));z-index:20;background:var(--ink);color:var(--bg);border-radius:16px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:14.5px;animation:toastIn .5s var(--spring) both;box-shadow:var(--shadow)}
@media (min-width:760px){.toast{left:0;right:0;margin-inline:auto;width:max-content;max-width:calc(100% - 40px);bottom:28px;gap:22px}}
.toast button{background:none;border:0;color:var(--accent);font-weight:700;font-size:14.5px;padding:2px 4px}
.sync{position:fixed;left:0;right:0;top:0;height:2px;z-index:60;background:linear-gradient(90deg,transparent,var(--accent),transparent);background-size:40% 100%;background-repeat:no-repeat;animation:sweep 1.1s ease-in-out infinite;pointer-events:none}
.ptr{display:flex;align-items:center;justify-content:center;overflow:hidden}
.spin{width:20px;height:20px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:rot .7s linear infinite}
.spin.idle{animation:none}
.ell{display:inline-flex;gap:3px;vertical-align:middle;margin-left:4px}
.ell i{width:5px;height:5px;border-radius:50%;background:currentColor;animation:blink 1.2s infinite}
.ell i:nth-child(2){animation-delay:.18s}
.ell i:nth-child(3){animation-delay:.36s}
.splash{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding-bottom:40px}
.splash .mark{font-size:48px;animation:lift .8s var(--ease) both}
.splashLine{font-family:${SERIF};font-style:italic;color:var(--muted);margin-top:12px;animation:lift .5s var(--ease) both;min-height:22px}
.squig path{stroke-dasharray:1;animation:draw 2.2s ease-in-out infinite}
.sk{display:flex;gap:14px;padding:16px;margin-top:9px;border:1px solid var(--line);border-radius:18px;background:var(--paper)}
.sk i{display:block;border-radius:6px;background:linear-gradient(90deg,var(--wash) 0%,var(--line) 50%,var(--wash) 100%);background-size:200% 100%;animation:shim 1.6s linear infinite}
.skC{width:24px;height:24px;border-radius:50%!important;flex:none}
.skL{height:13px;margin-bottom:9px}
.skL.s{height:10px;margin-bottom:0}

/* ── interactive tour ── */
.tour{position:fixed;inset:0;z-index:90;pointer-events:none}
.tourBlock{position:fixed;pointer-events:auto}
.tourHole{position:fixed;pointer-events:none;box-shadow:0 0 0 100vmax rgba(24,16,9,.62);transition:left .6s var(--ease),top .6s var(--ease),width .6s var(--ease),height .6s var(--ease),border-radius .6s var(--ease)}
.tourHole::after{content:"";position:absolute;inset:-5px;border-radius:inherit;border:2px solid var(--accent);animation:tourPulse 1.9s ease-out infinite}
.tourHole[data-none="1"]::after{display:none}
.tourHole[data-ok="1"]::after{border-color:var(--ok);animation:tourOk .85s var(--ease) both}
.tourCard{position:fixed;pointer-events:auto;background:var(--paper);color:var(--ink);border:1px solid var(--line);border-radius:24px;padding:20px 22px 16px;box-shadow:var(--shadow-lg);transition:left .6s var(--ease),top .6s var(--ease)}
.tourCard.center{padding:30px 30px 22px;border-radius:30px}
.tour.settled .tourHole,.tour.settled .tourCard{transition:none}
.tourBody{animation:lift .5s var(--ease) both;position:relative}
.tourH{font-family:${SERIF};font-weight:400;font-size:22px;line-height:1.2;letter-spacing:-.02em;margin:0 28px 8px 0;text-wrap:balance}
.tourCard.center .tourH{font-size:31px;line-height:1.12;letter-spacing:-.028em;margin-right:0}
.tourP{margin:0;color:var(--body);font-size:14.5px;line-height:1.55}
.tourCard.center .tourP{font-family:${SERIF};font-size:17px;line-height:1.6}
.tourCredit{margin:14px 0 0;font-size:13px;color:var(--faint)}
.tourDo{display:flex;align-items:center;gap:9px;margin-top:14px;font-size:13.5px;font-weight:600;color:var(--accent)}
.tourDo.ok{color:var(--ok);animation:pop .45s var(--spring) both}
.tapDot{position:relative;width:10px;height:10px;border-radius:50%;background:var(--accent);flex:none}
.tapDot::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:2px solid var(--accent);animation:tourPulse 1.4s ease-out infinite}
.tourFoot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px}
.tourLink{background:none;border:0;padding:8px 2px;font-size:14px;color:var(--muted);transition:color .2s}
@media (hover:hover){.tourLink:hover{color:var(--ink)}}
.tourDots{display:flex;gap:5px;align-items:center}
.tourDots i{width:6px;height:6px;border-radius:3px;background:var(--line);transition:width .45s var(--ease),background .3s}
.tourDots i.past{background:var(--accent-line)}
.tourDots i.on{width:18px;background:var(--accent)}
.tourX{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:50%;border:0;background:none;color:var(--faint);display:grid;place-items:center;padding:0;transition:background .2s,color .2s}
@media (hover:hover){.tourX:hover{background:var(--wash);color:var(--ink)}}
.tourArrow{position:absolute;width:16px;height:16px;background:var(--paper);border:1px solid var(--line);transform:rotate(45deg)}
.tourArrow[data-side="below"]{top:-9px;border-width:1px 0 0 1px}
.tourArrow[data-side="above"]{bottom:-9px;border-width:0 1px 1px 0}
.tourArrow[data-side="right"]{left:-9px;border-width:0 0 1px 1px}
.introIcon{width:64px;height:64px;border-radius:22px;background:var(--accent-soft);display:grid;place-items:center;color:var(--accent)}
.mono{width:64px;height:64px;border-radius:22px;background:var(--paper);box-shadow:var(--shadow);font-family:${SERIF};font-size:28px;display:grid;place-items:center}
.burst path{stroke-dasharray:1;animation:bdraw .7s ease-out both}
.tourCard.center .introIcon,.tourCard.center .mono{margin-bottom:22px}
.confetti{position:absolute;left:34px;top:34px;width:0;height:0;pointer-events:none}
.confetti i{position:absolute;left:-4px;top:-6px;width:8px;height:12px;border-radius:2px;animation:scrap 1.3s cubic-bezier(.2,.7,.3,1) both}
@keyframes tourPulse{0%{transform:scale(1);opacity:.9}75%,100%{transform:scale(1.12);opacity:0}}
@keyframes tourOk{from{transform:scale(1);opacity:1}to{transform:scale(1.28);opacity:0}}
@media (max-width:519px){.tourCard.center{padding:26px 22px 18px}.tourCard.center .tourH{font-size:27px}}

/* ── photo proof + groups ── */
.pgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 12px}
.pthumb{position:relative;aspect-ratio:1;border-radius:16px;overflow:hidden;background:var(--wash);border:1px solid var(--line);display:block;animation:pop .45s var(--spring) both}
.pthumb img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s var(--ease)}
@media (hover:hover){.pthumb:hover img{transform:scale(1.06)}}
.pthumb .x{position:absolute;top:6px;right:6px;width:28px;height:28px;border-radius:50%;border:0;background:rgba(20,20,18,.7);color:#fff;display:grid;place-items:center;padding:0;backdrop-filter:blur(4px)}
.padd{aspect-ratio:1;border:1.5px dashed var(--faint);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--muted);font-size:13px;cursor:pointer;background:none;text-align:center;padding:6px;transition:background .25s,border-color .2s,color .2s}
@media (hover:hover){.padd:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}}
.pill{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:500;border-radius:999px;padding:4px 11px;border:1px solid var(--line);color:var(--muted)}
.pill[data-s="ok"]{color:var(--ok);border-color:var(--ok);background:var(--okbg)}
.pill[data-s="redo"]{color:var(--danger);border-color:var(--danger);background:var(--errbg)}
.gbar{height:5px;background:var(--line);border-radius:3px;overflow:hidden;margin:8px 0 2px}
.gbar i{display:block;height:100%;background:var(--accent);border-radius:3px;transition:width .8s var(--ease)}
.gcard{border:1px solid var(--line);border-radius:18px;padding:14px 16px;margin-bottom:10px;background:var(--paper);box-shadow:var(--shadow-sm)}


/* ── elegance pass ── */
@media (min-width:760px){.hr{--maxw:1040px}}
@media (min-width:1180px){.hr{--maxw:960px}}
.slider{position:absolute;left:0;top:0;z-index:0;border-radius:18px;background:var(--accent-soft);pointer-events:none;opacity:0;will-change:transform,width,height}
.slider[data-ready="1"]{transition:transform .6s var(--ease),width .6s var(--ease),height .6s var(--ease),opacity .3s}
.seg .slider{background:var(--paper);box-shadow:0 1px 4px rgba(0,0,0,.14);border-radius:10px}
.nav .slider,.rail>.slider{border-radius:16px}
.bgfx{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.bgfx i{position:absolute;border-radius:50%;filter:blur(72px);animation:drift 28s ease-in-out infinite alternate}
.bgfx i:nth-child(1){width:560px;height:560px;right:-140px;top:-190px;background:color-mix(in srgb,var(--accent) 20%,transparent)}
.bgfx i:nth-child(2){width:480px;height:480px;left:22%;bottom:-240px;background:color-mix(in srgb,#6BA3D1 18%,transparent);animation-delay:-9s}
.bgfx i:nth-child(3){width:360px;height:360px;left:-110px;top:34%;background:color-mix(in srgb,#E3AE46 13%,transparent);animation-delay:-17s}
.bgfx::after{content:"";position:absolute;inset:0;background-image:radial-gradient(color-mix(in srgb,var(--ink) 11%,transparent) 1px,transparent 1.2px);background-size:28px 28px;-webkit-mask-image:radial-gradient(ellipse at 78% 0%,#000,transparent 72%);mask-image:radial-gradient(ellipse at 78% 0%,#000,transparent 72%);opacity:.55}
.hr.swap,.hr.swap *{transition:background-color .5s var(--ease),border-color .5s var(--ease),color .35s var(--ease),fill .4s,stroke .4s,box-shadow .5s!important}
.spot{position:relative}
.spot::after{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(300px circle at var(--mx,50%) var(--my,50%),color-mix(in srgb,var(--accent) 15%,transparent),transparent 70%);opacity:0;transition:opacity .45s var(--ease);pointer-events:none}
@media (hover:hover){.spot:hover::after{opacity:1}}

/* hero + stats */
.stat{background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:15px 16px;box-shadow:var(--shadow-sm)}
.stat b{display:block;font-family:${SERIF};font-weight:400;font-size:30px;line-height:1;letter-spacing:-.02em}
.stat div span{display:block;font-size:12.5px;color:var(--muted);margin-top:6px}
.hr.app.adminApp{--maxw:900px}
.bgfx i{opacity:.85}
.heroCard{position:relative;display:flex;align-items:center;justify-content:space-between;gap:20px;margin:10px 0 16px;padding:22px 24px;border-radius:28px;border:1px solid var(--line);background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 10%,var(--paper)),var(--paper) 62%);box-shadow:var(--shadow);overflow:hidden;animation:lift .7s var(--ease) both}
.heroCard::before{content:"";position:absolute;right:-70px;top:-90px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,var(--accent-soft),transparent 70%);pointer-events:none}
.heroBody{position:relative;min-width:0}
.heroBody>*{animation:lift .7s var(--ease) both}
.heroBody>*:nth-child(2){animation-delay:70ms}.heroBody>*:nth-child(3){animation-delay:130ms}.heroBody>*:nth-child(4){animation-delay:190ms}.heroBody>*:nth-child(5){animation-delay:250ms}
.heroCard .h1{margin:2px 0 6px}
.heroDate{font-size:12px;letter-spacing:.09em;text-transform:uppercase;font-weight:600;color:var(--accent)}
.quip{font-family:${SERIF};font-style:italic;color:var(--muted);margin:2px 0 0;font-size:16px}
.heroCard .ring{position:relative;z-index:1}
@media (min-width:760px){.heroCard{padding:28px 34px;margin-top:16px}.quip{font-size:17px}}
.stat{position:relative;display:flex;align-items:center;gap:13px;overflow:hidden;transition:transform .35s var(--ease),box-shadow .35s var(--ease),border-color .25s}
@media (hover:hover){.stat:hover{transform:translateY(-3px);box-shadow:var(--shadow);border-color:var(--accent-line)}}
.stat b{font-size:30px}
.statIcon{flex:none;width:40px;height:40px;border-radius:13px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);transition:transform .4s var(--spring)}
@media (hover:hover){.stat:hover .statIcon{transform:rotate(-8deg) scale(1.1)}}
.stat[data-tone="bad"] .statIcon{background:var(--errbg);color:var(--danger)}
.stat[data-tone="bad"] b{color:var(--danger)}
@media (max-width:519px){.stat{flex-direction:column;align-items:flex-start;gap:10px;padding:13px 14px}}

/* task cards */
.swipe::before{content:"";position:absolute;left:0;top:15px;bottom:15px;width:4px;border-radius:0 4px 4px 0;background:var(--sc,var(--accent));z-index:2;opacity:.85;transition:top .4s var(--ease),bottom .4s var(--ease)}
@media (hover:hover){.swipe:hover::before{top:9px;bottom:9px}.swipe:hover{transform:translateY(-1px)}}
.swipe{transition:box-shadow .3s var(--ease),transform .35s var(--ease)}
.swipe.leaving{animation:leave .6s var(--ease) .45s both;pointer-events:none}
.row{padding-left:20px}
.check{position:relative;overflow:visible}
.burstDots{position:absolute;left:50%;top:50%;pointer-events:none}
.burstDots i{position:absolute;left:-3px;top:-3px;width:6px;height:6px;border-radius:50%;animation:fly .8s var(--ease) both}
.burstDots b{position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:2px solid var(--accent);animation:ripple .7s var(--ease) both}
.group h3{position:relative}
@media (min-width:760px) and (max-width:1179px),(min-width:1580px){
  .group{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px;align-items:start}
  .group>h3,.group>p,.group>.meta,.group>.gbar{grid-column:1/-1}
  .group>.swipe{margin-top:0}
}
.group>h3{margin-bottom:0}

/* sheets: grab handle (phone only) */
.grab{display:grid;place-items:center;height:28px;margin:-10px 0 0;touch-action:none;cursor:grab}
.grab::before{content:"";width:42px;height:5px;border-radius:3px;background:var(--line)}
@media (min-width:760px){.grab{display:none}}

/* admin */
.sug{position:relative;display:flex;gap:14px;padding:16px 18px;border:1px solid var(--line);border-radius:22px;background:var(--paper);box-shadow:var(--shadow-sm);margin-top:10px;animation:lift .55s var(--ease) both;animation-delay:calc(var(--i,0)*45ms);transition:border-color .25s,box-shadow .3s var(--ease),transform .3s var(--ease)}
@media (hover:hover){.sug:hover{box-shadow:var(--shadow);transform:translateY(-2px)}}
.sug[data-unread="1"]{border-color:var(--accent-line)}
.sug[data-unread="1"]::before{content:"";position:absolute;left:-4px;top:22px;width:9px;height:9px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
.sugIcon{flex:none;width:44px;height:44px;border-radius:15px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)}
.sugIcon[data-k="problem"]{background:var(--errbg);color:var(--danger)}
.sugBody{flex:1;min-width:0}
.sugHead{display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap}
.sugText{margin:8px 0 0;white-space:pre-wrap;line-height:1.6;color:var(--body)}
.sugActions{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
.ghostCard{display:flex;gap:14px;align-items:center;margin-top:12px;padding:18px;border:1.5px dashed var(--line);border-radius:22px;opacity:.75;animation:lift .6s var(--ease) both}
.ghostCard i{display:block;border-radius:7px;background:var(--wash);height:12px}
.soonIcon{position:relative;z-index:1;flex:none;width:76px;height:76px;border-radius:24px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);animation:floaty 5s ease-in-out infinite}

/* sign-in + welcome: one layout per screen size */
.auth{position:relative;height:100%;overflow-y:auto;display:flex;flex-direction:column}
.authArt{display:none}
.authForm{position:relative;z-index:1;flex:1;display:flex;align-items:center;justify-content:center;padding:34px 22px}
.authCard{width:100%;max-width:440px;animation:lift .7s var(--ease) both}
.authBody{display:flex;flex-direction:column}
.authBody .btn.accent{margin-top:4px}
@media (min-width:760px) and (max-width:1099px){
  .authForm{padding:56px}
  .authCard{max-width:540px;background:color-mix(in srgb,var(--paper) 88%,transparent);backdrop-filter:blur(18px);border:1px solid var(--line);border-radius:36px;padding:50px 50px 42px;box-shadow:var(--shadow-lg)}
}
@media (min-width:1100px){
  .auth{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);overflow:hidden}
  .authBrand{display:none}
  .authArt{position:relative;z-index:1;display:flex;flex-direction:column;justify-content:space-between;padding:52px 60px;overflow:hidden;color:#fff;background:linear-gradient(155deg,color-mix(in srgb,var(--accent) 92%,#2a1006),color-mix(in srgb,var(--accent) 52%,#120d0a))}
  .authArt::before,.authArt::after{content:"";position:absolute;border-radius:50%;pointer-events:none}
  .authArt::before{width:520px;height:520px;right:-180px;top:-180px;background:radial-gradient(circle,rgba(255,255,255,.2),transparent 68%)}
  .authArt::after{width:420px;height:420px;left:-140px;bottom:-160px;background:radial-gradient(circle,rgba(255,255,255,.13),transparent 70%)}
  .artMark{font-size:30px;position:relative;z-index:1}
  .artMid{position:relative;z-index:1;max-width:480px}
  .artH{font-family:${SERIF};font-weight:400;font-size:46px;line-height:1.1;letter-spacing:-.03em;margin:0 0 18px;animation:lift .9s var(--ease) both}
  .artP{font-size:18px;line-height:1.55;color:rgba(255,255,255,.78);margin:0;animation:lift .9s var(--ease) .12s both}
  .artStack{position:relative;z-index:1;display:flex;flex-direction:column;gap:12px;max-width:400px}
  .artCard{display:flex;align-items:center;gap:14px;padding:15px 18px;border-radius:20px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(14px);animation:floaty 7s ease-in-out infinite,lift .9s var(--ease) both}
  .artCard b{display:block;font-weight:550}
  .artCard small{color:rgba(255,255,255,.7);font-size:13px}
  .artCard.a1{animation-delay:0s,.25s}
  .artCard.a2{animation-delay:-2.3s,.4s;margin-left:34px}
  .artCard.a3{animation-delay:-4.6s,.55s;margin-left:10px}
  .artCheck{flex:none;width:22px;height:22px;border-radius:50%;border:1.8px solid rgba(255,255,255,.6);display:grid;place-items:center}
  .artCheck.done{background:#fff;border-color:#fff;color:var(--accent)}
  .authForm{padding:60px}
}

/* extra motion */
@keyframes drift{from{transform:translate(0,0) scale(1)}to{transform:translate(50px,36px) scale(1.12)}}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes leave{0%{max-height:160px;opacity:1;transform:none}55%{opacity:0;transform:translateX(26px)}100%{max-height:0;margin-top:0;opacity:0;transform:translateX(26px)}}
@keyframes fly{from{transform:rotate(var(--a)) translateX(5px) scale(1);opacity:1}to{transform:rotate(var(--a)) translateX(var(--d)) scale(.1);opacity:0}}
@keyframes ripple{from{transform:scale(.3);opacity:.9}to{transform:scale(2.1);opacity:0}}

/* ── cardboard box login ── */
.boxStage{display:flex;flex-direction:column;align-items:center;gap:20px;padding:6px 0 4px}
.boxBrand{font-size:34px}
.box{position:relative;width:min(300px,78vw);height:210px;margin-top:44px;transform:rotate(calc(var(--p)*-1.4deg)) translateY(calc(var(--p)*2px));transition:transform .2s var(--ease)}
.bFront{position:absolute;inset:0;border-radius:6px;background:repeating-linear-gradient(90deg,rgba(0,0,0,.035) 0 2px,transparent 2px 7px),linear-gradient(#D4A872,#B98650);box-shadow:inset 0 0 0 1px rgba(80,50,20,.28),0 26px 40px -20px rgba(60,40,20,.55)}
.bInside{position:absolute;left:3px;right:3px;top:-30px;height:34px;background:linear-gradient(#4a3320,#6f4d2d);opacity:calc(var(--p)*1.4)}
.bFlap{position:absolute;top:-34px;width:50%;height:36px;background:linear-gradient(#E3BC86,#CFA46C);border:1px solid rgba(80,50,20,.3);transition:transform .7s var(--spring) .12s}
.bFlap.fl{left:0;transform-origin:0 100%;border-radius:6px 0 0 0}
.bFlap.fr{right:0;transform-origin:100% 100%;border-radius:0 6px 0 0}
.bTape{position:absolute;left:0;right:0;top:22px;height:38px;background:rgba(238,220,176,.55);border-top:1.5px dashed rgba(90,60,30,.45);border-bottom:1.5px dashed rgba(90,60,30,.45)}
.tornFill{position:absolute;left:0;top:0;bottom:0;width:calc(var(--p)*100%);background:#4a3320;opacity:.85;box-shadow:inset 0 0 8px #000}
.bTab{position:absolute;top:-6px;left:calc(var(--p)*(100% - 44px));width:44px;height:50px;border:0;padding:0;border-radius:6px 14px 14px 6px;background:var(--accent);color:#fff;display:grid;place-items:center;touch-action:none;cursor:grab;box-shadow:0 8px 14px -6px rgba(0,0,0,.45);animation:tabNudge 2.4s ease-in-out 1.2s infinite}
.bTab:active{cursor:grabbing}
.boxStage[data-pulled="1"] .bTab{animation:none}
.bLabel{position:absolute;left:50%;bottom:24px;width:62%;transform:translateX(-50%) rotate(-1.5deg);background:#FBF8F0;color:#2b2824;border-radius:3px;padding:9px 12px;text-align:center;box-shadow:0 1px 0 rgba(0,0,0,.15)}
.bLabel small{display:block;font-size:11px;color:#7a746a}
.bLabel b{display:block;font-family:"Fraunces",Georgia,serif;font-weight:500;font-size:19px;line-height:1.3}
.boxHint{margin:0;color:var(--muted);font-size:14.5px;transition:opacity .3s}
.boxStage[data-pulled="1"] .boxHint{opacity:0}
.boxStage[data-phase="opening"]{animation:boxAway .35s ease-in .9s forwards}
.boxStage[data-phase="opening"] .box{animation:boxJolt .5s var(--ease)}
.boxStage[data-phase="opening"] .bFlap.fl{transform:rotate(-105deg)}
.boxStage[data-phase="opening"] .bFlap.fr{transform:rotate(105deg)}
.scrap{position:absolute;left:50%;top:-20px;width:9px;height:12px;background:#F3E3BE;border:1px solid rgba(80,50,20,.25);animation:scrap .9s cubic-bezier(.2,.7,.3,1) both}
.boxOut{animation:lift .7s var(--ease) both}
@media (min-width:760px){.authCard:has(.boxStage){background:none;border:0;backdrop-filter:none;box-shadow:none;padding:0}}
@keyframes tabNudge{0%,70%,100%{transform:none}78%{transform:translateX(7px)}86%{transform:translateX(-1px)}93%{transform:translateX(4px)}}
@keyframes boxJolt{0%{transform:translateY(0)}30%{transform:translateY(5px) scale(1.015,.98)}100%{transform:none}}
@keyframes boxAway{to{opacity:0;transform:translateY(16px)}}
@keyframes scrap{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--x),var(--y)) rotate(var(--r));opacity:0}}
@keyframes shake{0%,100%{transform:none}20%{transform:translateX(-6px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
.err[role="alert"]{animation:shake .38s}

/* ── tour motion: unpack, stamp ── */
.ico0{position:relative;overflow:visible;animation:unbox .7s var(--spring) both}
.ico0 .scrap{top:50%;margin-top:-6px}
.ico2{position:relative;animation:stampDown .5s var(--ease) both}
.ico2::after{content:"";position:absolute;inset:-4px;border-radius:26px;border:2px solid var(--accent);animation:ripple .7s .3s ease-out both}
@keyframes unbox{from{transform:scale(.4) rotate(-20deg);opacity:0}60%{transform:scale(1.12) rotate(6deg);opacity:1}to{transform:none;opacity:1}}
@keyframes stampDown{0%{transform:translateY(-26px) scale(1.8) rotate(-12deg);opacity:0}60%{transform:scale(.9) rotate(-3deg);opacity:1}80%{transform:scale(1.04) rotate(-3deg)}100%{transform:rotate(-3deg);opacity:1}}

/* ── motion ── */
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes lift{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes pageIn{from{opacity:0;transform:translateY(12px) scale(.992)}to{opacity:1;transform:none}}
@keyframes slideIn{from{opacity:0;transform:translateX(26px)}to{opacity:1;transform:none}}
@keyframes toastIn{from{opacity:0;transform:translateY(20px) scale(.94)}to{opacity:1;transform:none}}
@keyframes pop{0%{transform:scale(0);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes rot{to{transform:rotate(360deg)}}
@keyframes draw{0%{stroke-dashoffset:1;opacity:1}55%{stroke-dashoffset:0;opacity:1}85%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
@keyframes shim{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes sweep{from{background-position:-40% 0}to{background-position:140% 0}}
@keyframes blink{0%,80%,100%{opacity:.25}40%{opacity:1}}
@keyframes bdraw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
/* ── polish layer: depth, calm hover lift, satisfying press ── */
.hr{--lift:0 10px 28px -12px rgba(60,45,20,.28),0 2px 6px rgba(60,45,20,.05)}
.hr[data-theme="dark"]{--lift:0 12px 30px -12px rgba(0,0,0,.65),0 2px 6px rgba(0,0,0,.3)}
.row,.card,.stat,.btn,.chip,.fab,.tab,.nav,.hdrBtn,.avatar{will-change:transform}
.row{transition:transform .35s var(--spring),box-shadow .3s var(--ease),border-color .25s,background .25s}
.row:active{transform:scale(.988)}
@media (hover:hover){
  .row:hover{transform:translateY(-2px);box-shadow:var(--lift)}
  .card:hover,.stat:hover{transform:translateY(-2px);box-shadow:var(--lift);border-color:var(--accent-line)}
  .fab:hover{transform:translateY(-3px) scale(1.04);box-shadow:0 18px 36px -10px color-mix(in srgb,var(--accent) 70%,transparent)}
}
.card,.stat{transition:transform .4s var(--spring),box-shadow .35s var(--ease),border-color .25s}
.btn.accent{box-shadow:0 8px 20px -8px color-mix(in srgb,var(--accent) 75%,transparent),inset 0 1px 0 rgba(255,255,255,.22)}
.btn.accent:not(:disabled):active{transform:scale(.96);box-shadow:0 3px 8px -4px color-mix(in srgb,var(--accent) 75%,transparent),inset 0 1px 0 rgba(255,255,255,.22)}
.btn:not(:disabled):active,.chip:active,.tab:active,.hdrBtn:active{transition-duration:.12s}
.check[data-s="done"]{box-shadow:0 0 0 5px var(--accent-soft),0 4px 12px -4px color-mix(in srgb,var(--accent) 70%,transparent)}
.check{transition:background .25s var(--ease),border-color .25s,transform .3s var(--spring),box-shadow .35s var(--ease)}
.chip[aria-pressed="true"]{transform:translateY(-1px);box-shadow:0 0 0 1px var(--ink) inset,0 6px 14px -8px rgba(0,0,0,.35)}
.input{transition:border-color .2s,box-shadow .3s var(--ease),transform .3s var(--spring)}
.input:focus{transform:translateY(-1px)}
.tabs{box-shadow:0 18px 40px -16px rgba(40,30,10,.4),0 0 0 1px var(--line)}
.sheet{animation-timing-function:var(--spring)}
.toast{box-shadow:0 18px 40px -14px rgba(0,0,0,.5)}
.h1{background:linear-gradient(180deg,var(--ink) 55%,color-mix(in srgb,var(--ink) 70%,var(--accent)));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.scroll{scroll-padding-top:12px}
/* ── v2 polish: calmer notes, clearer due dates, tighter phone hero ── */
.note{background:var(--paper);border:1px solid var(--line);border-left:3px solid var(--accent);box-shadow:var(--shadow-sm)}
.note p span{color:var(--accent)}
.due{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12.5px;font-weight:550;color:var(--muted);background:var(--wash);transition:background .3s var(--ease),color .3s}
.due[data-tone="late"]{background:var(--errbg);color:var(--danger)}
.due[data-tone="today"]{background:var(--accent-soft);color:var(--accent)}
.due[data-tone="done"]{background:none;color:var(--faint);padding-right:0}
.rowRight{display:flex;flex-direction:column;align-items:flex-end;gap:5px}
.rowRight .pri{margin-top:0}
.group h3 small{background:var(--wash);border-radius:999px;padding:1px 9px;color:var(--muted);font-weight:500}
.group>h3{padding-bottom:2px}
.practice{color:var(--accent);font-weight:600}
@media (max-width:519px){
  .heroCard{padding:18px 18px 18px 20px;gap:10px;border-radius:26px}
  .heroCard .h1{font-size:28px;line-height:1.1}
  .heroDate{font-size:11.5px}
  .stats{gap:8px}
}
/* ── v3: one physical language ──
   Press: whatever you push squeezes in, then springs back.
   Hover: only things that open something rise, and only a little.
   Motion you didn't trigger happens once, on the greeting. The big moment is finishing a task. */
.hr{--shadow-sm:0 1px 2px rgba(60,45,20,.05);--shadow:0 14px 32px -18px rgba(60,45,20,.24),0 1px 3px rgba(60,45,20,.05)}
.h1{background:none;-webkit-background-clip:border-box;background-clip:border-box;-webkit-text-fill-color:currentColor;color:var(--ink)}
.heroDate,.card h4,.col h4{text-transform:none;letter-spacing:0;font-size:13.5px;font-weight:550}
.card h4,.col h4{color:var(--muted)}
.stat b,.ring .lbl b,.due,.rowRight,.kbd,.group h3 small,.fcount{font-variant-numeric:tabular-nums}
.heroCard{background:linear-gradient(150deg,color-mix(in srgb,var(--accent) 8%,var(--paper)),var(--paper) 68%)}
.bgfx i{opacity:.6}
.bgfx::after{opacity:.35}
.group{margin-top:30px}
.page{animation:fade .28s var(--ease) both}
.swipe{animation-duration:.42s}
.input:focus{transform:none}
.row{padding:16px 18px 16px 22px}

/* the three numbers become one calm strip instead of three boxes */
.stats{gap:0;padding:0;margin:4px 0 16px;background:var(--paper);border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow-sm);overflow:hidden}
.stat{background:none;border:0;border-radius:0;box-shadow:none;padding:15px 18px}
.stat+.stat{border-left:1px solid var(--line)}
@media (hover:hover){.stat:hover{transform:none;box-shadow:none;border-color:transparent;background:color-mix(in srgb,var(--accent) 5%,transparent)}.stat+.stat:hover{border-left-color:var(--line)}}
@media (max-width:519px){.stat{padding:13px 14px}}

/* every pressable squeezes the same way */
.seg button:active,.ico button:active,.day:active,.suggest button:active,.padd:active{transform:scale(.95)}

/* finishing a task: the check draws itself, the circle springs, the ring answers */
.check[data-pop="1"]{animation:checkPop .55s var(--spring)}
.check[data-pop="1"] svg{animation:none}
.check[data-pop="1"] svg :is(path,polyline){stroke-dasharray:24;stroke-dashoffset:24;animation:tickDraw .32s .08s var(--ease) forwards}
.ring[data-bump="1"]{animation:ringBump .65s var(--spring)}
.ring[data-bump="1"] .fg{filter:drop-shadow(0 0 7px var(--accent-line))}
.ring .fg{transition:stroke-dashoffset 1.1s var(--ease),filter .6s var(--ease)}
@keyframes checkPop{0%{transform:scale(.78)}55%{transform:scale(1.16)}100%{transform:scale(1)}}
@keyframes tickDraw{to{stroke-dashoffset:0}}
@keyframes ringBump{0%{transform:scale(1)}40%{transform:scale(1.07)}100%{transform:scale(1)}}

/* a task you just added drops in and glows once, so you can see where it landed */
.swipe.fresh{animation:dropIn .65s var(--spring) both}
.swipe.fresh .row{animation:freshGlow 2s var(--ease) both}
@keyframes dropIn{from{opacity:0;transform:translateY(-12px) scale(.97)}to{opacity:1;transform:none}}
@keyframes freshGlow{0%,25%{border-color:var(--accent);box-shadow:0 0 0 5px var(--accent-soft)}100%{border-color:var(--line);box-shadow:none}}

/* undo shows how long it has left */
.toast{overflow:hidden}
.toastBar{position:absolute;left:0;bottom:0;height:3px;width:100%;background:var(--accent);transform-origin:left;animation:drain 5.2s linear forwards}
@keyframes drain{to{transform:scaleX(0)}}

/* the header settles onto the page once you scroll */
.head{transition:box-shadow .3s var(--ease)}
.main[data-scrolled="1"] .head{box-shadow:0 1px 0 var(--line),0 12px 24px -20px rgba(60,45,20,.35)}
@media (prefers-reduced-motion:reduce){
  .hr *,.hr *::before,.hr *::after{animation-duration:.01ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
  .squig path,.burst path{stroke-dashoffset:0}
}
/* ── v4: calm and plain ──
   One neutral surface, one accent, flat controls, no decoration that doesn't carry information. */
.hr{--bg:#F7F7F5;--paper:#FFFFFF;--ink:#191A1C;--muted:#62666D;--faint:#92969D;--line:#E6E7EA;--wash:#F0F1F3;--accent:#3A5BC7;--body:#33363B;--shadow-sm:0 1px 2px rgba(20,22,30,.05);--shadow:0 6px 18px -8px rgba(20,22,30,.18);--shadow-lg:0 24px 60px -20px rgba(20,22,30,.35);--glass:var(--paper)}
.hr[data-theme="dark"]{--bg:#111214;--paper:#18191C;--ink:#F1F2F4;--muted:#A3A7AE;--faint:#70747B;--line:#2A2C30;--wash:#202226;--accent:#8FA6F2;--body:#D6D8DC;--glass:var(--paper)}
.serif,.mark,.h1,.sectionTitle,.group h3,.ring .lbl b,.avatar,.msg.ai,.stat b{font-family:${SANS}}
.stat b{font-weight:600;font-size:26px}
.stat{border-radius:14px;box-shadow:none}
.h1{font-size:28px;font-weight:650;letter-spacing:-.02em;background:none;-webkit-text-fill-color:currentColor;color:var(--ink)}
.sectionTitle{font-size:17px;font-weight:600;margin:28px 0 10px}
.group h3{font-size:15px;font-weight:600}
.mark{font-size:20px;font-weight:650}
.msg.ai{font-size:15.5px;line-height:1.6}
.ring .lbl b{font-weight:600;font-size:24px}
/* remove decoration */
.bgfx,.spot::after,.heroCard::before,.btn.accent::after,.authArt::before,.authArt::after{display:none!important}
.tabs,.rail,.side,.authCard,.artCard{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
.rail,.side{background:var(--paper)}
.tabs{background:var(--paper);border:1px solid var(--line);box-shadow:var(--shadow-sm)}
.heroCard{background:var(--paper);border-radius:16px;box-shadow:none}
.fab{background:var(--accent);border-radius:16px;box-shadow:0 6px 16px -6px color-mix(in srgb,var(--accent) 80%,#000)}
.authArt{background:var(--accent)}
.artCard{background:rgba(255,255,255,.12);border-radius:14px}
.authCard{background:var(--paper);border-radius:20px;box-shadow:var(--shadow)}
/* one radius scale: cards 14, controls 10, pills round */
.row,.card,.col,.stat,.stats{border-radius:14px}
.btn,.input,.chip,.filterBtn,.searchPill{border-radius:10px}
.row,.card,.col{box-shadow:none}
@media (hover:hover){.row:hover,.chip:hover{box-shadow:none}}
/* motion that isn't triggered by you: off */
.heroCard,.h1,.page,.bgfx i{animation:none!important}
@media (prefers-reduced-motion:reduce){.hr *{animation:none!important;transition:none!important}}
/* ── intro, registered screen, delete ── */
.regWrap{text-align:center;padding:8px 4px}
.regMark{width:56px;height:56px;border-radius:50%;background:var(--okbg);color:var(--ok);display:grid;place-items:center;margin:0 auto 18px}
.regH{font-size:24px;font-weight:650;letter-spacing:-.02em;margin:0 0 8px}
.regP{color:var(--muted);margin:0 0 22px;line-height:1.5}
.btn.danger{background:var(--danger);color:#fff;border:0}
.btn:disabled{opacity:.45;cursor:default}
/* ── introduction: a boarding pass ── */
.wel{--w-bg:#F6F3EC;--w-paper:#FFFFFF;--w-ink:#1C1B19;--w-muted:#6C695F;--w-line:#E5E0D2;--w-acc:#C4694A;--w-ok:#4E8A63;position:fixed;inset:0;z-index:120;display:flex;flex-direction:column;align-items:center;padding:20px 22px calc(22px + env(safe-area-inset-bottom));overflow:auto;color:var(--w-ink);background:radial-gradient(900px 500px at 85% -10%,#F1DDD0,transparent 70%),radial-gradient(700px 500px at 0% 100%,#E9EEF0,transparent 70%),var(--w-bg)}
.hr[data-theme="dark"] .wel{--w-bg:#161513;--w-paper:#211F1C;--w-ink:#F2EFE7;--w-muted:#A8A498;--w-line:#34312C;--w-acc:#DB8566;--w-ok:#7FB08D;background:var(--w-bg)}
.welTop{width:100%;max-width:560px;display:flex;justify-content:space-between;align-items:center}
.welMark{font-family:${SERIF};font-size:20px}
.welLink{background:none;border:0;font-size:14px;padding:8px 4px;color:var(--w-ink)}
.welMain{width:100%;max-width:560px;flex:1;display:flex;flex-direction:column;justify-content:center;padding:22px 0;animation:fade .3s ease both}
.welH{font-family:${SERIF};font-weight:400;font-size:clamp(34px,7vw,44px);letter-spacing:-.025em;line-height:1.08;margin:0 0 14px}
.welSub{color:var(--w-muted);font-family:${SERIF};font-size:17px;margin:-4px 0 18px}
.pass{position:relative;background:var(--w-paper);border:1px solid var(--w-line);border-radius:6px 22px 22px 22px;padding:30px 22px 26px;box-shadow:0 18px 40px -22px rgba(60,40,20,.35);transform:rotate(-1deg)}
.tape{position:absolute;left:50%;top:-12px;width:96px;height:24px;margin-left:-48px;background:#E9D9B2;opacity:.85;transform:rotate(-2deg)}
.passRow{display:flex;justify-content:space-between;font-size:13px;color:var(--w-muted);margin-bottom:12px}
.passMade{font-size:14px;color:var(--w-muted)}
.passName{font-family:${SERIF};font-size:32px;letter-spacing:-.02em;margin:2px 0 12px}
.passBody{font-family:${SERIF};font-size:18px;line-height:1.6;margin:0 0 18px;max-width:30em}
.passGrid{display:flex;gap:26px;flex-wrap:wrap;padding-top:14px;border-top:1px dashed var(--w-line)}
.passGrid small{display:block;font-size:12px;color:var(--w-muted);margin-bottom:2px}
.passGrid b{font-weight:600;font-size:15px}
.pass[data-stamped="1"] .passGrid{padding-right:110px}
.stampGhost,.stampMark{position:absolute;right:14px;bottom:-26px;width:108px;height:108px;border-radius:50%}
.stampGhost{border:2px dashed var(--w-line)}
.stampMark{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--w-acc);border:2px solid var(--w-acc);box-shadow:inset 0 0 0 4px var(--w-paper),inset 0 0 0 5px var(--w-acc);background:color-mix(in srgb,var(--w-acc) 6%,transparent);transform:rotate(-12deg);animation:wStamp .5s cubic-bezier(.3,1.5,.5,1) both}
.stampMark span{font-size:10px}.stampMark b{font-family:${SERIF};font-size:19px;font-weight:500;line-height:1.1}
@keyframes wStamp{0%{transform:translateY(-30px) scale(1.9) rotate(-22deg);opacity:0}55%{opacity:1}100%{transform:rotate(-12deg)}}
.bits{position:absolute;right:62px;bottom:20px;pointer-events:none}
.bits i{position:absolute;width:6px;height:6px;border-radius:2px;background:var(--w-acc);opacity:0;animation:wBit .8s ease-out .15s both}
.bits i:nth-child(3n){background:#E3AE46}.bits i:nth-child(3n+1){background:#6BA3D1}
@keyframes wBit{from{transform:rotate(var(--a)) translateX(4px);opacity:1}to{transform:rotate(var(--a)) translateX(var(--d)) scale(.3);opacity:0}}
.stampBtn{align-self:flex-start;margin-top:54px;display:inline-flex;align-items:center;padding:12px 22px;border-radius:12px;border:1px solid var(--w-line);background:var(--w-paper);font-size:15px;font-weight:600;color:var(--w-ink);transition:transform .15s}
.stampBtn:not(:disabled){border-color:var(--w-acc);color:var(--w-acc)}
.stampBtn:active:not(:disabled){transform:scale(.95)}
.feats{display:flex;flex-direction:column;gap:10px}
.feat{background:var(--w-paper);border:1px solid var(--w-line);border-radius:14px;overflow:hidden;transition:border-color .2s}
.feat[data-open="1"]{border-color:color-mix(in srgb,var(--w-acc) 45%,transparent)}
.featHead{width:100%;display:flex;justify-content:space-between;align-items:center;gap:14px;text-align:left;background:none;border:0;padding:14px 16px;color:var(--w-ink)}
.featHead b{display:block;font-size:15px}.featHead small{display:block;font-size:14px;color:var(--w-muted);margin-top:2px}
.featDot{flex:none;width:22px;height:22px;border-radius:50%;border:2px solid var(--w-line);display:grid;place-items:center;color:#fff;transition:background .2s,border-color .2s}
.feat[data-open="1"] .featDot{background:var(--w-acc);border-color:var(--w-acc)}
.featBody{padding:0 16px 16px;animation:fade .25s ease both}
.askChips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.askChips button{padding:7px 12px;border-radius:999px;border:1px solid var(--w-line);background:none;font-size:14px;color:var(--w-ink)}
.askChips button[data-on="1"]{border-color:var(--w-ink)}
.askMe{margin-left:auto;width:fit-content;max-width:85%;background:var(--w-acc);color:#fff;padding:9px 14px;border-radius:16px 16px 4px 16px;font-size:14px;animation:fade .25s ease both}
.askAi{font-family:${SERIF};font-size:16px;line-height:1.55;margin-top:12px;animation:fade .4s ease .25s both}
.ticket{display:flex;background:var(--w-paper);border:1px solid var(--w-line);border-radius:18px;box-shadow:0 18px 40px -22px rgba(60,40,20,.35);position:relative}
.tkMain{flex:1;padding:20px 20px 18px;min-width:0}
.tkRoute{display:flex;align-items:center;gap:12px;margin:2px 0 16px}
.tkRoute b{font-family:${SERIF};font-weight:400;font-size:26px;letter-spacing:-.02em}
.tkRoute svg{width:54px;height:12px;color:var(--w-muted);flex:none}
.tkStub{width:92px;flex:none;border-left:2px dashed var(--w-line);padding:18px 12px;display:flex;flex-direction:column;justify-content:space-between;align-items:center;transform-origin:0 100%}
.tkStub small{font-size:12px;color:var(--w-muted)}
.bars{display:block;width:100%;height:56px;background:repeating-linear-gradient(90deg,var(--w-ink) 0 2px,transparent 2px 4px,var(--w-ink) 4px 5px,transparent 5px 8px)}
.ticket[data-fly="1"] .tkStub{animation:wTear .7s ease-in both}
.ticket[data-fly="1"]{animation:wLift .5s ease .6s both}
@keyframes wTear{0%{transform:none}30%{transform:rotate(7deg) translateY(4px)}100%{transform:rotate(26deg) translate(60px,260px);opacity:0}}
@keyframes wLift{to{transform:translateY(-12px);opacity:.0}}
.plane{position:fixed;left:-80px;top:62%;width:56px;height:56px;color:var(--w-acc);animation:wFly 1.5s cubic-bezier(.5,0,.8,.6) .5s both}
@keyframes wFly{0%{transform:translate(0,0) rotate(-8deg)}100%{transform:translate(calc(100vw + 160px),-52vh) rotate(-24deg)}}
.welFoot{width:100%;max-width:560px;display:flex;flex-direction:column;align-items:stretch;gap:12px;padding-top:6px}
.welStatus{min-height:20px;text-align:center;font-size:14px;font-weight:600;color:var(--w-ok)}
.welDots{display:flex;justify-content:center;gap:6px}
.welDots i{width:7px;height:7px;border-radius:4px;background:var(--w-line);transition:width .3s,background .3s}
.welDots i[data-past="1"]{background:color-mix(in srgb,var(--w-acc) 45%,transparent)}
.welDots i[data-on="1"]{width:24px;background:var(--w-acc)}
.welGo{padding:15px;border-radius:14px;border:0;background:var(--w-acc);color:#fff;font-size:16px;font-weight:600;transition:transform .15s,opacity .2s}
.welGo:active:not(:disabled){transform:scale(.97)}
.welGo:disabled{opacity:.4;cursor:default}
.welFoot .welLink{align-self:center}
/* ── v6: less on screen, tasks first ── */
.stats{display:none}
.heroCard{padding:16px 20px;margin:6px 0 12px;gap:14px}
.heroCard .h1{font-size:24px;margin:0 0 2px}
.heroCard .sub{margin:0}
.heroDate{font-size:13px;font-weight:500;color:var(--muted)}
.heroChips{margin-top:8px}
.note,.ann{padding:9px 6px 9px 14px;margin:0 0 8px;border-radius:12px;box-shadow:none;align-items:center;animation:none}
.note>div{display:flex;flex-wrap:wrap;gap:2px 16px;align-items:center}
.note p{margin:0;font-size:14px;line-height:1.5}
.note .btn.small{padding:4px 10px}
.row{animation:rowIn .42s var(--ease) both}
.row:nth-child(2){animation-delay:40ms}.row:nth-child(3){animation-delay:80ms}.row:nth-child(4){animation-delay:120ms}.row:nth-child(5){animation-delay:160ms}.row:nth-child(n+6){animation-delay:200ms}
@keyframes rowIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.nav,.tab,.chip,.btn,.iconBtn,.avatar{transition:background-color .2s var(--ease),color .2s var(--ease),border-color .2s var(--ease),transform .25s var(--spring)}
/* introduction follows the app's own palette */
.wel{--w-bg:var(--bg);--w-paper:var(--paper);--w-ink:var(--ink);--w-muted:var(--muted);--w-line:var(--line);--w-acc:var(--accent);--w-ok:var(--ok);background:radial-gradient(900px 480px at 85% -10%,color-mix(in srgb,var(--accent) 14%,transparent),transparent 70%),var(--bg)}
.hr[data-theme="dark"] .wel{--w-bg:var(--bg);--w-paper:var(--paper);--w-ink:var(--ink);--w-muted:var(--muted);--w-line:var(--line);--w-acc:var(--accent);--w-ok:var(--ok)}
.tape{background:color-mix(in srgb,var(--accent) 22%,var(--paper))}
.tkRoute{gap:8px}.tkRoute b{font-size:22px}.tkRoute svg{width:34px}.tkStub{width:78px;padding:16px 8px}
@media (min-width:480px){.tkRoute{gap:12px}.tkRoute b{font-size:26px}.tkRoute svg{width:54px}.tkStub{width:92px;padding:18px 12px}}
`;

/* ───────────────────────── small pieces ───────────────────────── */

/* Measures the active button inside a container so one highlight can glide between choices. */
function useSlider(dep) {
  const ref = useRef(null);
  const [box, setBox] = useState(null);
  const [ready, setReady] = useState(false);
  const measure = useCallback(() => {
    const el = ref.current && ref.current.querySelector('[aria-current="page"],[aria-pressed="true"]');
    if (!el) { setBox(null); return; }
    setBox((b) => {
      const n = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      return b && b.x === n.x && b.y === n.y && b.w === n.w && b.h === n.h ? b : n;
    });
  }, []);
  // re-measure after every render: it is cheap, and it catches the moment the menu first appears on screen
  useLayoutEffect(() => { measure(); });
  useEffect(() => {
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 400);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    return () => { window.removeEventListener("resize", measure); clearTimeout(t); };
  }, [measure]);
  useEffect(() => {
    if (!box || ready) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(id);
  }, [box, ready]);
  const node = (
    <span className="slider" aria-hidden="true" data-ready={ready ? 1 : 0}
      style={box ? { transform: `translate(${box.x}px,${box.y}px)`, width: box.w, height: box.h, opacity: 1 } : { opacity: 0 }} />
  );
  return [ref, node];
}

/* A soft light follows the pointer across any card marked "spot". */
function useSpotlight() {
  useEffect(() => {
    const h = (e) => {
      const el = e.target.closest && e.target.closest(".spot");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", h, { passive: true });
    return () => document.removeEventListener("pointermove", h);
  }, []);
}

function useCountUp(n, ms = 750) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    let raf, t0;
    const start = from.current;
    const step = (t) => {
      if (!t0) t0 = t;
      const p = Math.min(1, (t - t0) / ms);
      const val = Math.round(start + (n - start) * (1 - Math.pow(1 - p, 3)));
      from.current = val; setV(val);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [n, ms]);
  return v;
}

function Backdrop() {
  return <div className="bgfx" aria-hidden="true"><i /><i /><i /></div>;
}

function Sheet({ open, onClose, title, children }) {
  const [mounted, setMounted] = useState(open);
  const [show, setShow] = useState(false);
  const [dy, setDy] = useState(0);
  const grab = useRef(null);
  const kept = useRef(children);
  if (open) kept.current = children; // keep the content on screen while the sheet slides away
  useEffect(() => {
    if (open) {
      Sound.play("whoosh");
      setMounted(true);
      let second = 0;
      const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setShow(true)); });
      return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
    }
    setShow(false);
    const t = setTimeout(() => setMounted(false), 460);
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!mounted) return null;
  const gs = (e) => { grab.current = e.touches[0].clientY; };
  const gm = (e) => { if (grab.current != null) setDy(Math.max(0, e.touches[0].clientY - grab.current)); };
  const ge = () => { if (dy > 110) onClose(); grab.current = null; setDy(0); };
  return (
    <div className="overlay" data-show={show ? 1 : 0} role="dialog" aria-modal="true" aria-label={title}>
      <div className="scrim" onClick={onClose} style={dy ? { opacity: Math.max(0.2, 1 - dy / 320) } : undefined} />
      <div className="sheet" style={dy ? { transform: `translateY(${dy}px)`, transition: "none" } : undefined}>
        <div className="grab" onTouchStart={gs} onTouchMove={gm} onTouchEnd={ge} onTouchCancel={ge} />
        <div className="sheetHead">
          <h2 className="serif" style={{ fontSize: 24, fontWeight: 400, margin: 0 }}>{title}</h2>
          <button className="iconBtn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {open ? children : kept.current}
      </div>
    </div>
  );
}

function Segmented({ value, options, onChange, tour }) {
  const [ref, slider] = useSlider(value + "|" + options.map((o) => (Array.isArray(o) ? o[1] : o)).join("|"));
  return (
    <div className="seg" role="group" ref={ref} data-tour={tour}>
      {slider}
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return <button key={v} aria-pressed={value === v} onClick={() => { if (value !== v) Sound.play("tap"); onChange(v); }}>{l}</button>;
      })}
    </div>
  );
}

const Dots = () => <span className="ell" aria-hidden="true"><i /><i /><i /></span>;

function Squiggle({ width = 150 }) {
  return (
    <svg className="squig" width={width} height={14} viewBox="0 0 160 14" fill="none" aria-hidden="true">
      <path d="M2 9 C 30 2, 60 14, 90 7 S 140 5, 158 8" pathLength="1" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Splash() {
  const lines = ["Gathering today's tasks", "Checking deadlines", "Sharpening pencils", "Opening the class list"];
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((x) => (x + 1) % lines.length), 1500); return () => clearInterval(id); }, []);
  return (
    <div className="splash" role="status" aria-label="Loading">
      <div className="mark">Homeroom</div>
      <Squiggle width={170} />
      <div className="splashLine" key={i}>{lines[i]}</div>
    </div>
  );
}

/* NEW — starburst for the welcome tour, in the Claude style */
function Starburst({ size = 44 }) {
  const rays = [
    "M16 3.5v7", "M16 21.5v7", "M3.5 16h7", "M21.5 16h7",
    "M7.2 7.2l4.9 4.9", "M19.9 19.9l4.9 4.9", "M24.8 7.2l-4.9 4.9", "M12.1 19.9l-4.9 4.9",
  ];
  return (
    <svg className="burst" width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {rays.map((d, i) => (
        <path key={i} d={d} pathLength="1" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" style={{ animationDelay: `${i * 0.07}s` }} />
      ))}
    </svg>
  );
}

/* ───────────────────────── interactive tour ─────────────────────────
   A hands-on walk through the real app. Each step lights up a real control and waits for you to use it.
   A practice task (never saved, never shown to the class) is added to the list while the tour runs. */

const DEMO_ID = "tour-demo";
const makeDemoTask = () => ({
  id: DEMO_ID, title: "Practice task: tick the circle", subject: "Mathematics", type: "Quiz", priority: "High",
  deadline: todayISO(), notes: "This one is just for the tour. It isn't saved, and nobody else can see it.",
  addedBy: "sample", quarter: 1, createdAt: 0,
});

// Phone and desktop each draw their own copy of some controls, so pick the one that is on screen.
const findTourTarget = (name) =>
  [...document.querySelectorAll(`[data-tour~="${name}"]`)].find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }) || null;

const tourSteps = (bp, user) => [
  {
    id: "hello", center: true, enter: { demo: "todo" },
    title: `Welcome to Homeroom, ${user}.`,
    body: "This is your class's shared list. Let's try it for real. It takes about a minute, and you'll tap everything yourself.",
  },
  {
    id: "tick", target: "practice-check", enter: { demo: "todo" },
    title: "Check off a task",
    body: "Tap the circle when you finish something. Your classmates see how many people have finished each task.",
    hint: "Tap the circle", done: (c) => c.demo === "done",
  },
  {
    id: "open", target: "practice-row", enter: {},
    title: "Open a task",
    body: "Tap a task to see its notes, comments, and who in your class has already finished it.",
    hint: "Tap the task", done: (c) => c.detail,
  },
  {
    id: "status", target: "detail-status", enter: { detail: true },
    title: "Not started, in progress, done",
    body: "Mark where you are, not just when you're finished. Set this one to In progress.",
    hint: "Tap In progress", done: (c) => c.demo === "progress",
  },
  {
    id: "add", target: "new-task", enter: {},
    title: "Add something for the class",
    body: "Anyone can add a task, and everyone in your class sees it. Open the form.",
    hint: bp === "phone" ? "Tap the plus button" : "Click New task", done: (c) => c.form,
  },
  {
    id: "quick", target: "quick-add", enter: { form: true },
    title: "Type it like a text",
    body: "Write something like \u201Cmath quiz friday, chapter 2\u201D and tap the sparkle. The assistant fills in the subject, type, and date.",
    hint: "Try it, or tap Next",
  },
  {
    id: "views", target: "view-toggle", enter: {},
    title: "See the week your way",
    body: bp === "phone" ? "Switch to the calendar to see everything laid out by day." : "Switch to the calendar to see everything by day. The third button is a board you can drag cards across.",
    hint: "Tap the calendar", done: (c) => c.mode === "calendar",
  },
  {
    id: "review", target: "tab-review", enter: {},
    title: "Study without the stress",
    body: "Review turns shared notes into reviewers, practice quizzes, and flashcards.",
    hint: "Open Review", done: (c) => c.tab === "review",
  },
  {
    id: "ask", target: "tab-ask", enter: { tab: "review" },
    title: "Ask the assistant",
    body: "Ask what's due, get a plan for tonight, or tell it to add a task for you.",
    hint: "Open Ask", done: (c) => c.tab === "ask",
  },
  {
    id: "search", target: "search", enter: {},
    title: "Find anything fast",
    body: bp === "phone" ? "Search every task and note your class has shared." : "Search every task and note your class has shared. Press / or Ctrl K from anywhere.",
    hint: bp === "phone" ? "Tap the magnifier" : "Click the search bar", done: (c) => c.search,
  },
  {
    id: "end", center: true, enter: {},
    title: `You're all set, ${user}.`,
    body: "Tick things off, add what's due, and help your class stay ahead. You can replay this tour from your account menu.",
  },
];

function Tour({ user, bp, ctx, go, onDone }) {
  const steps = useMemo(() => tourSteps(bp, user), [bp, user]);
  const [i, setI] = useState(0);
  const step = steps[i];
  const last = steps.length - 1;
  const [rect, setRect] = useState(null);
  const [ok, setOk] = useState(false);
  const [settled, setSettled] = useState(false); // after the glide to a new target, stick to it with no lag
  const [cardH, setCardH] = useState(230);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const cardRef = useRef(null);
  const armed = useRef(false);
  const timer = useRef(null);
  const ctxRef = useRef(ctx); ctxRef.current = ctx;
  const goRef = useRef(go); goRef.current = go;

  const toStep = (n) => {
    clearTimeout(timer.current);
    setI(Math.max(0, Math.min(last, n)));
  };

  // entering a step puts the app in the state the step needs (so Back and Skip always work)
  useEffect(() => {
    goRef.current(step.enter);
    setOk(false); setSettled(false);
    armed.current = false;
    const t2 = setTimeout(() => setSettled(true), 800);
    Sound.play(step.center ? "pop" : "whoosh");
    if (i === last) { Sound.play("stamp"); setTimeout(() => Sound.play("bell"), 260); }
    // arm once the app has settled, so a step that is already satisfied can't skip itself
    const t = setTimeout(() => { armed.current = !!step.done && !step.done(ctxRef.current); }, 90);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [i]);

  // when the person does the thing, celebrate and move on
  useEffect(() => {
    if (!armed.current || !step.done || !step.done(ctx)) return;
    armed.current = false;
    setOk(true);
    Sound.play("done");
    timer.current = setTimeout(() => toStep(i + 1), 900);
  }, [ctx.tab, ctx.detail, ctx.form, ctx.mode, ctx.search, ctx.demo, i]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // follow the target, even while a sheet slides in or the page scrolls
  useEffect(() => {
    if (!step.target) { setRect(null); return; }
    let raf, key = "", scrolled = false;
    const t0 = performance.now();
    const tick = () => {
      const el = findTourTarget(step.target);
      let next = null;
      if (el) {
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight, vw = window.innerWidth;
        if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) {
          const rad = getComputedStyle(el).borderTopLeftRadius;
          next = { x: r.left, y: r.top, w: r.width, h: r.height, rad: rad.includes("%") ? Math.min(r.width, r.height) / 2 : parseFloat(rad) || 0 };
        }
        if (!scrolled && performance.now() - t0 > 350) {
          scrolled = true;
          if (el.closest(".scroll") && (r.top < 90 || r.bottom > vh - 120)) el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
      const k = next ? [next.x, next.y, next.w, next.h].map(Math.round).join() : "";
      if (k !== key) { key = k; setRect(next); }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [i]);

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    const onKey = (e) => { if (e.key === "Escape") { e.stopImmediatePropagation(); onDone(); } };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("keydown", onKey, true); };
  }, [onDone]);

  useLayoutEffect(() => {
    const h = cardRef.current ? cardRef.current.offsetHeight : 0;
    if (h && Math.abs(h - cardH) > 1) setCardH(h);
  });

  /* ---- where things go ---- */
  const PAD = step.center ? 0 : 8, GAP = 16, M = 14;
  const cw = Math.min(step.center ? 420 : 350, vp.w - M * 2);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hole = rect && !step.center
    ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2, r: Math.max(rect.rad, 10) + PAD * 0.6 }
    : { x: vp.w / 2, y: vp.h * 0.46, w: 0, h: 0, r: 0 };
  let card = { left: (vp.w - cw) / 2, top: Math.max(M, (vp.h - cardH) / 2), side: "none", arrow: 0 };
  if (rect && !step.center) {
    const cx = hole.x + hole.w / 2, cy = hole.y + hole.h / 2;
    const below = vp.h - (hole.y + hole.h) - GAP - M, above = hole.y - GAP - M, right = vp.w - (hole.x + hole.w) - GAP - M;
    if (bp !== "phone" && hole.x < 260 && right >= cw) {
      card = { left: hole.x + hole.w + GAP, top: clamp(cy - cardH / 2, M, vp.h - cardH - M), side: "right", arrow: 0 };
      card.arrow = clamp(cy - card.top, 24, cardH - 24);
    } else if (below >= cardH || below >= above) {
      const left = clamp(cx - cw / 2, M, vp.w - cw - M);
      card = { left, top: Math.min(hole.y + hole.h + GAP, vp.h - cardH - M), side: "below", arrow: clamp(cx - left, 26, cw - 26) };
    } else {
      const left = clamp(cx - cw / 2, M, vp.w - cw - M);
      card = { left, top: Math.max(M, hole.y - GAP - cardH), side: "above", arrow: clamp(cx - left, 26, cw - 26) };
    }
  }
  const blocks = rect && !step.center
    ? [
        { left: 0, top: 0, width: vp.w, height: Math.max(0, hole.y) },
        { left: 0, top: hole.y + hole.h, width: vp.w, height: Math.max(0, vp.h - hole.y - hole.h) },
        { left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h },
        { left: hole.x + hole.w, top: hole.y, width: Math.max(0, vp.w - hole.x - hole.w), height: hole.h },
      ]
    : [{ left: 0, top: 0, width: vp.w, height: vp.h }];

  const interactive = !!step.done;
  const confetti = ["var(--accent)", "#E3AE46", "#6BA3D1", "#8B6B86", "#5F8B6D"];

  return (
    <div className={settled ? "tour settled" : "tour"} role="presentation">
      {blocks.map((b, k) => <div key={k} className="tourBlock" style={b} />)}
      <div className="tourHole" data-ok={ok ? 1 : 0} data-none={!rect || step.center ? 1 : 0}
        style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: hole.r }} />
      <div className={step.center ? "tourCard center" : "tourCard"} ref={cardRef} role="dialog" aria-label="Homeroom tour" aria-live="polite"
        style={{ left: card.left, top: card.top, width: cw }}>
        {card.side !== "none" && <i className="tourArrow" data-side={card.side} style={card.side === "right" ? { top: card.arrow - 8 } : { left: card.arrow - 8 }} />}
        <div className="tourBody" key={i}>
          {i === 0 && (
            <div className="introIcon ico0">
              <Starburst size={42} />
              {Array.from({ length: 8 }, (_, k) => {
                const a = (k * Math.PI) / 4;
                return <i key={k} className="scrap" style={{ "--x": Math.round(Math.cos(a) * 70) + "px", "--y": Math.round(Math.sin(a) * 70) + "px", "--r": (k * 53) % 360 + "deg", animationDelay: "250ms" }} />;
              })}
            </div>
          )}
          {i === last && (
            <>
              <div className="mono ico2">H</div>
              <div className="confetti" aria-hidden="true">
                {Array.from({ length: 22 }, (_, k) => {
                  const a = (k / 22) * Math.PI * 2 + 0.3, d = 90 + ((k * 37) % 70);
                  return <i key={k} style={{ "--x": Math.round(Math.cos(a) * d) + "px", "--y": Math.round(Math.sin(a) * d * 0.8 - 30) + "px", "--r": ((k * 67) % 360) + "deg", background: confetti[k % confetti.length], animationDelay: (k % 5) * 45 + 300 + "ms" }} />;
                })}
              </div>
            </>
          )}
          <h3 className="tourH">{step.title}</h3>
          <p className="tourP">{step.body}</p>
          {step.id === "end" && <p className="tourCredit">Made by Nathaniel Visaya for this class.</p>}
          {interactive && (
            ok
              ? <div className="tourDo ok"><Check size={15} strokeWidth={3} />Nice</div>
              : <div className="tourDo"><i className="tapDot" />{step.hint}</div>
          )}
          {!interactive && step.hint && <div className="tourDo"><i className="tapDot" />{step.hint}</div>}
        </div>
        <div className="tourFoot">
          {step.center ? (
            <>
              {i === 0 ? <button className="tourLink" onClick={onDone}>Skip tour</button> : <button className="tourLink" onClick={() => { Sound.play("tap"); toStep(i - 1); }}>Back</button>}
              <button className="btn accent" autoFocus onClick={() => { Sound.play("tap"); i === last ? onDone() : toStep(i + 1); }}>{i === last ? "Open my list" : "Show me around"}</button>
            </>
          ) : (
            <>
              <button className="tourLink" onClick={() => { Sound.play("tap"); toStep(i - 1); }}>Back</button>
              <div className="tourDots" aria-label={`Step ${i} of ${last - 1}`}>
                {steps.slice(1, last).map((_, k) => <i key={k} className={k + 1 === i ? "on" : k + 1 < i ? "past" : ""} />)}
              </div>
              {interactive
                ? <button className="tourLink" onClick={() => { Sound.play("tap"); toStep(i + 1); }}>Skip step</button>
                : <button className="btn accent small" onClick={() => { Sound.play("tap"); toStep(i + 1); }}>Next</button>}
            </>
          )}
        </div>
        {!step.center && <button className="tourX" onClick={onDone} aria-label="End the tour"><X size={16} /></button>}
      </div>
    </div>
  );
}

function Waiting({ lines }) {
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((x) => (x + 1) % lines.length), 1800); return () => clearInterval(id); }, []);
  return (
    <div className="empty plain" role="status">
      <Squiggle />
      <div className="serif" style={{ marginTop: 10 }} key={i}>{lines[i]}</div>
      <span style={{ fontSize: 14 }}>This takes a few seconds.</span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div className="sk" key={i}>
          <i className="skC" />
          <div style={{ flex: 1 }}>
            <i className="skL" style={{ width: `${55 + ((i * 13) % 30)}%` }} />
            <i className="skL s" style={{ width: `${30 + ((i * 17) % 22)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Scroll({ onRefresh, children, style, wide }) {
  const ref = useRef(null);
  const y0 = useRef(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const edge = (el) => { const m = el && el.closest(".main"); if (m) m.dataset.scrolled = el.scrollTop > 6 ? "1" : "0"; };
  useEffect(() => { edge(ref.current); }, []);
  const start = (e) => { y0.current = ref.current && ref.current.scrollTop <= 0 ? e.touches[0].clientY : null; };
  const move = (e) => {
    if (y0.current == null || busy || !onRefresh) return;
    const dy = e.touches[0].clientY - y0.current;
    setPull(dy > 0 ? Math.min(dy * 0.5, 72) : 0);
  };
  const end = async () => {
    if (pull >= 52 && onRefresh && !busy) {
      setBusy(true); setPull(44); Sound.play("tap");
      try { await onRefresh(); } finally { setBusy(false); }
    }
    setPull(0); y0.current = null;
  };
  const h = busy ? 44 : pull;
  return (
    <div className={wide ? "scroll wide" : "scroll"} ref={ref} onScroll={(e) => edge(e.currentTarget)} onTouchStart={start} onTouchMove={move} onTouchEnd={end} style={style}>
      <div className="ptr" style={{ height: h, transition: pull && !busy ? "none" : "height .2s" }}>
        {h > 14 && <span className={busy ? "spin" : "spin idle"} style={{ opacity: Math.min(1, h / 44), transform: busy ? undefined : `rotate(${h * 5}deg)` }} />}
      </div>
      {children}
    </div>
  );
}

/* NEW: cardboard box login. Pull the tab to tear the tape; the box opens and the sign-in card comes out. */
function BoxGate({ children }) {
  const [p, setP] = useState(0);
  const [phase, setPhase] = useState("closed"); // closed, opening, out
  const strip = useRef(null);
  const drag = useRef(null);
  const lastRip = useRef(0);
  const open = () => {
    if (phase !== "closed") return;
    drag.current = null; setP(1); setPhase("opening"); Sound.play("boxOpen");
    setTimeout(() => setPhase("out"), 1250);
  };
  const down = (e) => {
    if (phase !== "closed") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, p0: p, w: Math.max(1, strip.current.offsetWidth - 44) };
    Sound.play("tap");
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const np = Math.max(0, Math.min(1, d.p0 + (e.clientX - d.x) / d.w));
    if (np > p) {
      setP(np);
      const now = performance.now();
      if (now - lastRip.current > 55) { lastRip.current = now; Sound.play("rip"); }
    }
    if (np >= 0.97) open();
  };
  const up = () => { drag.current = null; };
  if (phase === "out") return <div className="boxOut">{children}</div>;
  return (
    <div className="boxStage" data-phase={phase} data-pulled={p > 0.02 ? 1 : 0} style={{ "--p": p }}>
      <span className="mark boxBrand">Homeroom</span>
      <div className="box">
        <div className="bInside" />
        <div className="bFlap fl" /><div className="bFlap fr" />
        <div className="bFront">
          <div className="bTape" ref={strip}>
            <i className="tornFill" />
            <button className="bTab" aria-label="Pull the tab to open the box"
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") { e.preventDefault(); open(); } }}>
              <ChevronRight size={22} strokeWidth={3} />
            </button>
          </div>
          <div className="bLabel"><small>Deliver to</small><b>Your class</b><small>Handle with care</small></div>
        </div>
        {phase === "opening" && Array.from({ length: 12 }, (_, i) => (
          <i key={i} className="scrap" style={{ "--x": ((i - 5.5) * 24) + "px", "--y": (-100 - ((i * 37) % 80)) + "px", "--r": ((i * 67) % 360) + "deg", animationDelay: ((i % 4) * 40) + "ms" }} />
        ))}
      </div>
      <p className="boxHint">Pull the tab to open</p>
    </div>
  );
}

/* ───────────────────────── auth ───────────────────────── */

function AuthShell({ children }) {
  return (
    <div className="auth">
      <Backdrop />
      <aside className="authArt" aria-hidden="true">
        <span className="mark artMark">Homeroom</span>
        <div className="artMid">
          <h2 className="artH">Everything your class has due, in one calm place.</h2>
          <p className="artP">Shared deadlines, study notes, and a little help whenever you need it.</p>
        </div>
        <div className="artStack">
          <div className="artCard a1"><span className="artCheck done"><Check size={13} strokeWidth={3} /></span><div><b>Linear equations worksheet</b><small>Mathematics · Today</small></div></div>
          <div className="artCard a2"><span className="artCheck" /><div><b>Quiz 2.1: Factoring</b><small>Mathematics · Friday</small></div></div>
          <div className="artCard a3"><span className="artCheck" /><div><b>Sanaysay tungkol sa pamilya</b><small>Filipino · Monday</small></div></div>
        </div>
      </aside>
      <main className="authForm"><div className="authCard">{children}</div></main>
    </div>
  );
}

function ClassPicker({ classes, value, onPick, onCreated }) {
  const [adding, setAdding] = useState(false);
  const [year, setYear] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const create = async () => {
    const y = year.trim(), n = name.trim();
    const id = `${y}-${n}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!y || !n || !id) return setErr("Add both a year and a class.");
    await store.classes.add({ id, year: y, name: n, label: `${y}-${n}` });
    const next = await store.classes.list();
    onCreated(next); onPick(id); Sound.play("add");
    setAdding(false); setYear(""); setName(""); setErr("");
  };
  const sorted = [...classes].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  return (
    <div className="field">
      <label>Your class</label>
      <div className="chips" style={{ flexWrap: "wrap", overflow: "visible", padding: 0 }}>
        {sorted.map((c) => <button key={c.id} className="chip" aria-pressed={value === c.id} onClick={() => onPick(c.id)}>{c.label}</button>)}
        <button className="chip" aria-pressed={adding} onClick={() => setAdding(!adding)}><Plus size={14} />{classes.length ? "My class isn't here" : "Add your class"}</button>
      </div>
      {adding && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" placeholder="Year, like 8" value={year} onChange={(e) => setYear(e.target.value)} />
            <input className="input" placeholder="Class, like 16" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {err && <p className="err" style={{ marginTop: 8, marginBottom: 0 }}>{err}</p>}
          <button className="btn ghost small" style={{ marginTop: 10 }} onClick={create}>Add class</button>
        </div>
      )}
      <p className="meta" style={{ marginTop: 10, lineHeight: 1.5 }}>Everything you add or upload is shared only with people in your class.</p>
    </div>
  );
}

function ClassGate({ classes, setClasses, onChoose }) {
  const [cls, setCls] = useState(null);
  return (
    <div className="authBody">
      <div className="mark authBrand" style={{ fontSize: 30, marginBottom: 18 }}>Homeroom</div>
      <h1 className="h1">Pick your class</h1>
      <p className="sub">Tasks and notes are shared only with the people in your class.</p>
      <ClassPicker classes={classes} value={cls} onPick={setCls} onCreated={setClasses} />
      <button className="btn accent full" disabled={!cls} onClick={() => onChoose(cls)}>Continue</button>
    </div>
  );
}

function Auth({ onAuthed }) {
  const [classes, setClasses] = useState([]);
  const [cls, setCls] = useState(null);
  useEffect(() => { store.classes.list().then(setClasses); }, []);
  const [mode, setMode] = useState("signin"); // signin | signup | forgot
  const [name, setName] = useState("");
  const [mail, setMail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(LINK_NOTICE.err || "");
  const [info, setInfo] = useState(() => { try { const m = sessionStorage.getItem("hr:notice"); sessionStorage.removeItem("hr:notice"); return m || LINK_NOTICE.info || ""; } catch { return LINK_NOTICE.info || ""; } });
  const [busy, setBusy] = useState(false);
  const switchMode = (m) => { setMode(m); setErr(""); setInfo(""); };
  const submit = async () => {
    setErr(""); setInfo("");
    const u = name.trim().toLowerCase();
    const email = mail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return setErr("Enter a valid email address.");
    if (mode === "forgot") {
      setBusy(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) { setErr("Couldn't send the email: " + error.message); Sound.play("err"); return; }
        setInfo("If that email has an account, a reset link is on its way. Check your spam folder too.");
      } finally { setBusy(false); }
      return;
    }
    if (mode === "signup" && !/^[a-z0-9_.]{3,20}$/.test(u)) return setErr("Usernames are 3 to 20 characters: letters, numbers, dots or underscores.");
    if (pw.length < 6) return setErr("Use a password with at least 6 characters.");
    if (mode === "signup" && !cls) { setErr("Choose your class first, or add it if it isn't listed."); Sound.play("err"); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        // The username and class travel with the sign-up; a database trigger (supabase/schema.sql) creates the profile.
        const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { data: { username: u, class_id: cls }, emailRedirectTo: window.location.origin } });
        if (error) {
          setErr(/registered|exists/i.test(error.message) ? "That email already has an account. Sign in instead."
            : /database error/i.test(error.message) ? "That username is taken. Try another."
            : "Couldn't create the account: " + error.message);
          Sound.play("err"); return;
        }
        if (!data.session) { setInfo("Check your email and click the link to confirm your account, then come back and sign in."); return; }
        const prof = await loadProfile(data.user.id);
        if (!prof) { await supabase.auth.signOut(); setErr("Couldn't finish setting up the account."); Sound.play("err"); return; }
        Sound.play("add");
        await onAuthed(prof.username, prof.class_id || null, false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) { setErr(/confirm/i.test(error.message) ? "Confirm your email first. Check your inbox for the link." : "That email or password doesn't match."); Sound.play("err"); return; }
        const prof = await loadProfile(data.user.id);
        if (!prof) { await supabase.auth.signOut(); setErr("This account isn't set up. Create a new one."); Sound.play("err"); return; }
        Sound.play("add");
        await onAuthed(prof.username, prof.class_id || null, !!prof.is_admin);
      }
    } finally {
      setBusy(false);
    }
  };
  const titles = { signin: "Welcome back", signup: "Create your account", forgot: "Reset your password" };
  const subs = { signin: "Sign in to see what's due.", signup: "Join your class in a few seconds.", forgot: "We'll email you a link to choose a new password." };
  return (
    <div className="authBody">
      <div className="mark authBrand" style={{ fontSize: 34, marginBottom: 22 }}>Homeroom</div>
      <h1 className="h1" style={{ marginTop: 0 }}>{titles[mode]}</h1>
      <p className="sub" style={{ marginBottom: 26 }}>{subs[mode]}</p>
      <div className="field">
        <label htmlFor="e">Email</label>
        <input id="e" className="input" type="email" value={mail} onChange={(e) => setMail(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="email" onKeyDown={(e) => e.key === "Enter" && mode === "forgot" && submit()} />
      </div>
      {mode === "signup" && (
        <div className="field">
          <label htmlFor="u">Username <span style={{ color: C.faint }}>(shown to your class)</span></label>
          <input id="u" className="input" value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="username" />
        </div>
      )}
      {mode !== "forgot" && (
        <div className="field">
          <label htmlFor="p">Password</label>
          <input id="p" className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>
      )}
      {mode === "signup" && <ClassPicker classes={classes} value={cls} onPick={setCls} onCreated={setClasses} />}
      {err && <p className="err" role="alert">{err}</p>}
      {info && <p className="meta" role="status" style={{ marginBottom: 14, lineHeight: 1.5 }}>{info}</p>}
      <button className="btn accent full" onClick={submit} disabled={busy || !mail || (mode === "signup" && !name) || (mode !== "forgot" && !pw)}>
        {busy ? <>One moment<Dots /></> : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
      </button>
      {mode === "signin" && (
        <button className="back" style={{ marginTop: 14, alignSelf: "center" }} onClick={() => switchMode("forgot")}>Forgot your password?</button>
      )}
      <button className="back" style={{ marginTop: 10, alignSelf: "center" }} onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "New here? Create an account" : mode === "signup" ? "I already have an account" : "Back to sign in"}
      </button>
      <p style={{ fontSize: 13, color: C.faint, marginTop: 22, lineHeight: 1.5 }}>
        You stay signed in on this device. Use a password you don't use anywhere else, since this app is shared with your class.
      </p>
    </div>
  );
}

function ResetPassword({ onDone }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setErr("");
    if (pw.length < 6) return setErr("Use a password with at least 6 characters.");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) { setErr("Couldn't change it: " + error.message); Sound.play("err"); return; }
      Sound.play("add");
      onDone();
    } finally { setBusy(false); }
  };
  return (
    <div className="authBody">
      <div className="mark authBrand" style={{ fontSize: 34, marginBottom: 22 }}>Homeroom</div>
      <h1 className="h1" style={{ marginTop: 0 }}>Choose a new password</h1>
      <p className="sub" style={{ marginBottom: 26 }}>You'll stay signed in after this.</p>
      <div className="field">
        <label htmlFor="np">New password</label>
        <input id="np" className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" onKeyDown={(e) => e.key === "Enter" && save()} />
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn accent full" onClick={save} disabled={busy || !pw}>{busy ? <>One moment<Dots /></> : "Save password"}</button>
    </div>
  );
}

/* ───────────────────────── task form ───────────────────────── */

function QuickAdd({ subjects, onFill }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    if (!q.trim() || busy) return;
    setBusy(true); setErr("");
    const system = `Turn the student's one-line note into a task. Today is ${todayLong()}. Existing subjects: ${subjects.join(", ")}. Respond ONLY with JSON: {"title":string,"subject":string,"taskType":one of ${TYPES.join(", ")},"priority":"High"|"Medium"|"Low","deadline":"YYYY-MM-DD","notes":string}. Reuse an existing subject name when one fits. Resolve weekdays and words like tomorrow against today. If no date is given use tomorrow. Notes hold extra detail such as pages or topics, otherwise an empty string.`;
    try {
      const out = parseJSON(await callClaude(system, [{ role: "user", content: q }]));
      if (!out?.title) throw new Error("bad");
      onFill(out); Sound.play("pop"); setQ("");
    } catch {
      setErr("Couldn't read that one. You can fill the form below instead."); Sound.play("err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="field" data-tour="quick-add" style={{ paddingBottom: 18, borderBottom: `1px solid ${C.line}` }}>
      <label htmlFor="qa">Quick add</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input id="qa" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="math quiz friday, chapter 2"
          onKeyDown={(e) => e.key === "Enter" && go()} />
        <button className="btn ghost" onClick={go} disabled={!q.trim() || busy} aria-label="Fill the form from this note">
          {busy ? <Dots /> : <Sparkles size={17} />}
        </button>
      </div>
      {err && <p className="err" style={{ marginTop: 8, marginBottom: 0 }}>{err}</p>}
    </div>
  );
}

function TaskForm({ initial, subjects, groups, defQuarter, onSave, onCancel }) {
  const [f, setF] = useState(
    initial
      ? { quarter: defQuarter, proof: true, groupId: null, ...initial }
      : { title: "", subject: "", type: "Homework", priority: "High", deadline: addDays(todayISO(), 1), notes: "", quarter: defQuarter, groupId: null, proof: true }
  );
  const [newGroup, setNewGroup] = useState(null); // null = not creating one, string = name being typed
  const [newSubj, setNewSubj] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v, ...(k === "subject" || k === "quarter" ? { groupId: null } : {}) }));
  const valid = f.title.trim() && f.subject.trim() && f.deadline;
  const groupOptions = (groups || []).filter((g) => g.subject === f.subject.trim() && g.quarter === f.quarter);
  const fill = (o) => {
    setF((p) => ({
      ...p,
      title: o.title || p.title,
      subject: o.subject || p.subject,
      type: TYPES.includes(o.taskType) ? o.taskType : p.type,
      priority: PRIORITIES.includes(o.priority) ? o.priority : p.priority,
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(o.deadline || "") ? o.deadline : p.deadline,
      notes: o.notes || p.notes,
    }));
    setNewSubj(!!o.subject && !subjects.includes(o.subject));
  };
  return (
    <div>
      {!initial && <QuickAdd subjects={subjects} onFill={fill} />}
      <div className="field">
        <label htmlFor="t">What is it?</label>
        <input id="t" className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Math quiz 2.2" />
      </div>
      <div className="field">
        <label>Subject</label>
        <div className="chips" style={{ flexWrap: "wrap", overflow: "visible", padding: 0 }}>
          {subjects.map((s) => (
            <button key={s} className="chip" aria-pressed={f.subject === s && !newSubj} onClick={() => { setNewSubj(false); set("subject", s); }}>
              <span className="dot" style={{ background: subjColor(s), margin: 0 }} />{s}
            </button>
          ))}
          <button className="chip" aria-pressed={newSubj} onClick={() => { setNewSubj(true); set("subject", ""); }}>
            <Plus size={14} /> New subject
          </button>
        </div>
        {newSubj && <input className="input" style={{ marginTop: 10 }} autoFocus value={f.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Subject name" />}
      </div>
      <div className="field">
        <label>Kind</label>
        <div className="chips" style={{ flexWrap: "wrap", overflow: "visible", padding: 0 }}>
          {TYPES.map((k) => <button key={k} className="chip" aria-pressed={f.type === k} onClick={() => set("type", k)}>{k}</button>)}
        </div>
      </div>
      <div className="field">
        <label>Quarter</label>
        <Segmented value={String(f.quarter)} options={QUARTERS.map((q) => [String(q), `Q${q}`])} onChange={(v) => set("quarter", Number(v))} />
      </div>
      {f.subject.trim() && (
        <div className="field">
          <label>Group <span style={{ color: C.faint }}>(optional)</span></label>
          <div className="chips" style={{ flexWrap: "wrap", overflow: "visible", padding: 0 }}>
            <button className="chip" aria-pressed={!f.groupId && newGroup === null} onClick={() => { setNewGroup(null); set("groupId", null); }}>No group</button>
            {groupOptions.map((g) => (
              <button key={g.id} className="chip" aria-pressed={f.groupId === g.id && newGroup === null} onClick={() => { setNewGroup(null); set("groupId", g.id); }}>
                <Folder size={13} />{g.name}
              </button>
            ))}
            <button className="chip" aria-pressed={newGroup !== null} onClick={() => { set("groupId", null); setNewGroup(""); }}>
              <Plus size={14} /> New group
            </button>
          </div>
          {newGroup !== null && <input className="input" style={{ marginTop: 10 }} autoFocus value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder={`${f.subject.trim()}, Q${f.quarter}: Chapter 4`} />}
        </div>
      )}
      <div className="field">
        <label>Priority</label>
        <Segmented value={f.priority} options={PRIORITIES} onChange={(v) => set("priority", v)} />
      </div>
      <div className="field">
        <label htmlFor="d">Due date</label>
        <input id="d" type="date" className="input" value={f.deadline} onChange={(e) => set("deadline", e.target.value)} />
      </div>
      {needsProofType(f) ? (
        <div className="field">
          <label>Photo proof</label>
          <Segmented value={f.proof === false ? "off" : "on"} options={[["on", "Ask for a photo"], ["off", "Not needed"]]} onChange={(v) => set("proof", v === "on")} />
        </div>
      ) : (
        <p className="meta" style={{ margin: "-6px 0 18px" }}>Quizzes, study sessions and exams never ask for a photo.</p>
      )}
      <div className="field">
        <label htmlFor="n">Guidelines or notes</label>
        <textarea id="n" className="input" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Pages, what to bring, how it's graded" />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn accent" style={{ flex: 1 }} disabled={!valid} onClick={() => onSave({ ...f, title: f.title.trim(), subject: f.subject.trim() }, newGroup && newGroup.trim() ? { name: newGroup.trim() } : null)}>
          {initial ? "Save changes" : "Add to class"}
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── tasks tab ───────────────────────── */

function TaskRow({ t, status, finished, groupName, proofState, i, selected, leaving, onOpen, onToggle, onEdit }) {
  const n = diffDays(t.deadline);
  const done = status === "done";
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const g = useRef({ x: 0, y: 0, lock: null, moved: false });
  const dxRef = useRef(0);
  const wasDone = useRef(done);
  const [pop, setPop] = useState(false);
  useEffect(() => {
    const was = wasDone.current; wasDone.current = done;
    if (done && !was) { setPop(true); const id = setTimeout(() => setPop(false), 950); return () => clearTimeout(id); }
  }, [done]);
  const start = (e) => { const p = e.touches[0]; g.current = { x: p.clientX, y: p.clientY, lock: null, moved: false }; };
  const move = (e) => {
    const p = e.touches[0], s = g.current;
    const ddx = p.clientX - s.x, ddy = p.clientY - s.y;
    if (!s.lock && (Math.abs(ddx) > 10 || Math.abs(ddy) > 10)) s.lock = Math.abs(ddx) > Math.abs(ddy) ? "x" : "y";
    if (s.lock === "x") {
      s.moved = true; setDrag(true);
      const v = Math.max(-120, Math.min(120, ddx));
      dxRef.current = v; setDx(v);
    }
  };
  const end = () => {
    const s = g.current, v = dxRef.current;
    if (s.lock === "x") {
      if (v > 80) onToggle();
      else if (v < -80 && onEdit) onEdit();
    }
    dxRef.current = 0; setDrag(false); setDx(0);
  };
  return (
    <div className={`swipe${leaving ? " leaving" : ""}${t.createdAt && Date.now() - t.createdAt < 4000 ? " fresh" : ""}`} style={{ "--i": Math.min(i || 0, 12), "--sc": subjColor(t.subject) }} onTouchStart={start} onTouchMove={move} onTouchEnd={end} onTouchCancel={end}>
      <div className="under" aria-hidden="true">
        <span style={{ opacity: dx > 24 ? 1 : 0 }}><Check size={16} />{done ? "Undo" : "Done"}</span>
        <span style={{ opacity: dx < -24 ? 1 : 0 }}>Edit <Pencil size={16} /></span>
      </div>
      <div className="row" role="button" tabIndex={0} data-sel={selected ? 1 : 0} data-tour={t.id === DEMO_ID ? "practice-row" : undefined}
        style={{ transform: `translateX(${dx}px)`, transition: drag ? "none" : "transform .4s var(--ease), border-color .25s, background .25s" }}
        onClick={() => { if (g.current.moved) return; onOpen(); }}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}>
        <button className="check" data-s={status} data-pop={pop ? 1 : 0} data-tour={t.id === DEMO_ID ? "practice-check" : undefined} aria-label={done ? "Mark as not done" : "Mark as done"} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {done && <Check size={14} strokeWidth={3} />}
          {pop && (
            <span className="burstDots" aria-hidden="true">
              {[...Array(10)].map((_, k) => (
                <i key={k} style={{ "--a": `${k * 36}deg`, "--d": `${k % 2 ? 34 : 24}px`, background: k % 3 === 0 ? "var(--accent)" : k % 3 === 1 ? "#E3AE46" : "#6BA3D1" }} />
              ))}
              <b />
            </span>
          )}
        </button>
        <div className="rowMain">
          <div className="rowTitle" data-done={done ? 1 : 0}>{t.title}</div>
          <div className="rowMeta">
            <span><span className="dot" style={{ background: subjColor(t.subject) }} />{t.subject}</span>
            <span>{t.type}</span>
            {t.id === DEMO_ID && <span className="practice">Practice</span>}
            {t.quarter && <span>Q{t.quarter}</span>}
            {groupName && <span>{groupName}</span>}
            {proofState && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: proofState === "redo" ? C.danger : proofState === "ok" ? C.ok : undefined }}>
                <Camera size={12} />{proofState === "redo" ? "Redo photo" : proofState === "ok" ? "Verified" : "Photo sent"}
              </span>
            )}
            {status === "progress" && <span style={{ color: C.accent }}>In progress</span>}
            {finished > 0 && <span>{finished} finished</span>}
          </div>
        </div>
        <div className="rowRight">
          <div className="due" data-tone={done ? "done" : n < 0 ? "late" : n === 0 ? "today" : ""}>{relLabel(t.deadline)}</div>
          <div className="pri" data-p={t.priority}>{t.priority}</div>
        </div>
      </div>
    </div>
  );
}

function CalendarView({ tasks, month, progress, completions, user, selDay, setSelDay, openTask, editTask, setStatus }) {
  const lead = (new Date(month.y, month.m, 1).getDay() + 6) % 7; // weeks start Monday
  const count = new Date(month.y, month.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(toISO(new Date(month.y, month.m, d)));
  const byDay = {};
  tasks.forEach((t) => { (byDay[t.deadline] = byDay[t.deadline] || []).push(t); });
  const today = todayISO();
  const dayTasks = selDay ? byDay[selDay] || [] : [];
  const st = (t) => progress[t.id] || "todo";
  return (
    <div>
      <div className="cal" role="grid" aria-label="Month">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} className="calHead">{d}</div>)}
        {cells.map((iso, i) =>
          iso ? (
            <button key={iso} className="day" data-sel={selDay === iso ? 1 : 0} data-today={iso === today ? 1 : 0}
              onClick={() => { Sound.play("tap"); setSelDay(iso); }} aria-label={`${fmtDate(iso)}, ${(byDay[iso] || []).length} due`}>
              <span className="num">{parse(iso).getDate()}</span>
              <span className="pips">
                {(byDay[iso] || []).slice(0, 3).map((t) => (
                  <i key={t.id} style={{ background: subjColor(t.subject), opacity: st(t) === "done" ? 0.3 : 1 }} />
                ))}
              </span>
            </button>
          ) : <span key={`b${i}`} />
        )}
      </div>
      {selDay && (
        <section className="group">
          <h3>{relLabel(selDay) === fmtDate(selDay) ? fmtDate(selDay) : `${relLabel(selDay)}, ${fmtDate(selDay)}`} <small>{dayTasks.length}</small></h3>
          {dayTasks.length === 0 && <p style={{ color: C.muted, margin: "10px 0" }}>Nothing due this day.</p>}
          {dayTasks.map((t) => (
            <TaskRow key={t.id} t={t} status={st(t)} finished={(completions[t.id] || []).filter((u) => u !== user).length}
              onOpen={() => openTask(t.id)} onEdit={() => editTask(t.id)}
              onToggle={() => setStatus(t.id, st(t) === "done" ? "todo" : "done")} />
          ))}
        </section>
      )}
    </div>
  );
}

const QUIPS = [
  "Small steps still count.", "One task at a time.", "Start with the smallest one.", "Future you says thanks.",
  "Progress, not perfection.", "Ten calm minutes beat an hour of worry.", "You've got more done than you think.",
  "Begin before you feel ready.", "Done is a lovely feeling.", "Steady wins the week.", "Breathe, then begin.", "Make today's list a little shorter.",
];

function Stat({ icon, n, label, tone }) {
  const v = useCountUp(n);
  return (
    <div className="stat spot" data-tone={tone || ""}>
      <span className="statIcon">{icon}</span>
      <div><b>{v}</b><span>{label}</span></div>
    </div>
  );
}

function TasksTab({ user, tasks, progress, completions, announcements, weeklies, onOpenWeekly, dismissAnn, setStatus, openTask, editTask, ui, setUi, loading, onRefresh, onPlan, classGroups, proofs, openGroups, bp, selectedId, streak, openFocus }) {
  const [hideNote, setHideNote] = useState(false);
  const [fOpen, setFOpen] = useState(false);
  const [leaving, setLeaving] = useState({});
  const change = (id, to) => {
    if (to === "done" && ui.view === "upcoming" && id !== DEMO_ID) {
      setLeaving((l) => ({ ...l, [id]: true }));
      setTimeout(() => setLeaving((l) => { const n = { ...l }; delete n[id]; return n; }), 1150);
    }
    setStatus(id, to);
  };
  const [hideWk, setHideWk] = useState(false);
  const [selDay, setSelDay] = useState(todayISO());
  const [month, setMonth] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const subjects = useMemo(() => [...new Set(tasks.map((t) => t.subject))], [tasks]);
  const { view } = ui;
  const mode = ui.mode === "board" && bp === "phone" ? "list" : ui.mode;
  const qv = ui.q && ui.q !== "All" ? Number(ui.q) : null;
  const groupById = Object.fromEntries((classGroups || []).map((g) => [g.id, g]));
  const subj = ui.subj === "All" || subjects.includes(ui.subj) ? ui.subj : "All";
  const setView = (v) => setUi((u) => ({ ...u, view: v }));
  const setSubj = (v) => setUi((u) => ({ ...u, subj: v }));
  const setMode = (v) => { Sound.play("tap"); setUi((u) => ({ ...u, mode: v })); };
  const shiftMonth = (n) => { Sound.play("tap"); setMonth(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; }); };
  const monthLabel = new Date(month.y, month.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const st = (t) => progress[t.id] || "todo";
  const fin = (t) => (completions[t.id] || []).filter((u) => u !== user).length;
  const prio = { High: 0, Medium: 1, Low: 2 };
  const filtered = tasks
    .filter((t) => subj === "All" || t.subject === subj)
    .filter((t) => ui.kind === "All" || t.type === ui.kind)
    .filter((t) => qv === null || t.quarter === qv)
    .filter((t) => (view === "done" ? st(t) === "done" : view === "upcoming" ? st(t) !== "done" || leaving[t.id] || t.id === DEMO_ID : true))
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || prio[a.priority] - prio[b.priority] || a.title.localeCompare(b.title));
  const boardItems = tasks
    .filter((t) => subj === "All" || t.subject === subj)
    .filter((t) => ui.kind === "All" || t.type === ui.kind)
    .filter((t) => qv === null || t.quarter === qv)
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || prio[a.priority] - prio[b.priority] || a.title.localeCompare(b.title));
  const wkStart = weekStartOf(todayISO());
  const wkTasks = tasks.filter((t) => t.deadline >= wkStart && t.deadline <= addDays(wkStart, 6));
  const wkPct = wkTasks.length ? wkTasks.filter((t) => st(t) === "done").length / wkTasks.length : 0;
  const mine = tasks.filter((t) => st(t) !== "done");
  const overdueList = mine.filter((t) => diffDays(t.deadline) < 0);
  const todayList = mine.filter((t) => diffDays(t.deadline) === 0);
  const tomorrowList = mine.filter((t) => diffDays(t.deadline) === 1);
  const week = mine.filter((t) => { const n = diffDays(t.deadline); return n >= 0 && n <= 7; }).length;
  const overdue = overdueList.length, today = todayList.length;
  const reminders = [["Overdue", overdueList], ["Due today", todayList], ["Due tomorrow", tomorrowList]].filter(([, l]) => l.length);
  const anns = [...announcements].sort((a, b) => b.at - a.at).slice(0, 2);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const kinds = [...new Set(tasks.map((t) => t.type))];
  const activeFilters = (qv !== null ? 1 : 0) + (ui.kind !== "All" ? 1 : 0) + (mode === "list" && ui.group !== "date" ? 1 : 0);
  const dow = new Date().getDay();
  const thisWk = weekStartOf(todayISO());
  const wkBanner = tasks.length > 0 && (dow === 0 || dow === 1)
    ? (() => {
        const ws = dow === 0 ? thisWk : addDays(thisWk, -7);
        const which = dow === 0 ? "this week's" : "last week's";
        const saved = weeklies.some((w) => w.weekStart === ws);
        return { ws, title: dow === 0 ? "This week is wrapping up." : "A new week.", text: saved ? `The reviewer for ${which} is ready to read.` : `Make ${which} reviewer from everything the class added.` };
      })()
    : null;
  const groups = [];
  if (ui.group === "group") {
    [...(classGroups || [])]
      .filter((g) => (qv === null || g.quarter === qv) && (subj === "All" || g.subject === subj))
      .sort((a, b) => a.quarter - b.quarter || a.subject.localeCompare(b.subject) || a.name.localeCompare(b.name))
      .forEach((g) => {
        const all = tasks.filter((t) => t.groupId === g.id);
        const items = filtered.filter((t) => t.groupId === g.id);
        const done = all.filter((t) => st(t) === "done").length;
        if (items.length || all.length === 0) groups.push({ key: g.name, items, meta: { group: g, done, total: all.length } });
      });
    const loose = filtered.filter((t) => !t.groupId || !groupById[t.groupId]);
    if (loose.length) groups.push({ key: "No group", items: loose });
  } else if (ui.group === "subject") {
    subjects.forEach((s) => { const items = filtered.filter((t) => t.subject === s); if (items.length) groups.push({ key: s, items }); });
  } else if (view === "done") {
    groups.push({ key: "Completed", items: filtered });
  } else {
    const defs = [
      ["Overdue", (n) => n < 0], ["Today", (n) => n === 0], ["Tomorrow", (n) => n === 1],
      ["Later this week", (n) => n > 1 && n <= 7], ["After that", (n) => n > 7],
    ];
    defs.forEach(([key, fn]) => {
      const items = filtered.filter((t) => fn(diffDays(t.deadline)) && !(view === "all" && st(t) === "done" && key === "Overdue"));
      if (items.length) groups.push({ key, items });
    });
  }
  return (
    <Scroll onRefresh={onRefresh} wide={mode === "board"}>
      <div className="heroCard spot">
        <div className="heroBody">
          <div className="heroDate">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
          <h1 className="h1">{greet}, {user}.</h1>
          <p className="sub">
            {today + overdue === 0 ? "Nothing urgent right now." : `${today} due today${overdue ? `, ${overdue} overdue` : ""}.`}
          </p>
          <div className="heroChips">
            <span className={streak ? "streak" : "streak quiet"}><Flame size={14} />{streak ? `${streak}-day streak` : "Start a streak today"}</span>
          </div>
        </div>
        <Ring celebrate pct={wkPct} size={bp === "phone" ? 64 : 88} stroke={7}><Pct v={wkPct} /><span>this week</span></Ring>
      </div>
      {anns.map((a) => (
        <div className="ann" key={a.id}>
          <div>
            <small>From your admin, {timeAgo(a.at)}</small>
            <p>{a.text}</p>
          </div>
          <button className="iconBtn" style={{ width: 28, height: 28, flex: "none" }} onClick={() => dismissAnn(a.id)} aria-label="Dismiss announcement"><X size={16} /></button>
        </div>
      ))}
      {!hideNote && reminders.length > 0 && (
        <div className="note" role="status">
          <div>{reminders.map(([label, l]) => <p key={label}><span>{label}: </span>{summarize(l)}</p>)}</div>
          <button className="iconBtn" style={{ width: 28, height: 28, flex: "none" }} onClick={() => setHideNote(true)} aria-label="Dismiss reminder"><X size={16} /></button>
        </div>
      )}
      {wkBanner && !hideWk && (
        <div className="note" role="status">
          <div>
            <p><span>{wkBanner.title}</span> {wkBanner.text}</p>
            <button className="btn ghost small" onClick={() => onOpenWeekly(wkBanner.ws)}>Open the weekly reviewer</button>
          </div>
          <button className="iconBtn" style={{ width: 28, height: 28, flex: "none" }} onClick={() => setHideWk(true)} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      <div className="stats">
        <Stat icon={<Hourglass size={18} />} n={overdue} label="Overdue" tone={overdue ? "bad" : ""} />
        <Stat icon={<Target size={18} />} n={today} label="Due today" />
        <Stat icon={<CalendarDays size={18} />} n={week} label="Next 7 days" />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button className="btn ghost small" onClick={onPlan}>
          <Sparkles size={14} style={{ verticalAlign: -2, marginRight: 7 }} />Plan my evening
        </button>
        <button className="btn ghost small" onClick={openGroups}>
          <FolderPlus size={14} style={{ verticalAlign: -2, marginRight: 7 }} />Groups
        </button>
        <button className="btn ghost small noDesk" onClick={openFocus}>
          <Timer size={14} style={{ verticalAlign: -2, marginRight: 7 }} />Focus timer
        </button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        {mode === "board" ? (
          <span className="dragHint">Drag a card to change its status</span>
        ) : mode === "list" ? (
          <Segmented value={view} onChange={setView} options={[["upcoming", "Upcoming"], ["all", "All"], ["done", "Done"]]} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button className="iconBtn" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={20} /></button>
            <span className="serif" style={{ fontSize: 19, minWidth: 128, textAlign: "center" }}>{monthLabel}</span>
            <button className="iconBtn" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight size={20} /></button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="chip filterBtn" aria-pressed={fOpen} onClick={() => { Sound.play("tap"); setFOpen((v) => !v); }} aria-label="Filters">
          <SlidersHorizontal size={15} /><span>Filters</span>{activeFilters > 0 && <b className="fcount">{activeFilters}</b>}
        </button>
        <div className="ico" role="group" aria-label="View" data-tour="view-toggle">
          <button aria-pressed={mode === "list"} onClick={() => setMode("list")} aria-label="List view"><ListIcon size={17} /></button>
          <button aria-pressed={mode === "calendar"} onClick={() => setMode("calendar")} aria-label="Calendar view"><CalendarDays size={17} /></button>
          <button className="boardBtn" aria-pressed={mode === "board"} onClick={() => setMode("board")} aria-label="Board view"><Columns3 size={17} /></button>
        </div>
        </div>
      </div>
      <div className="chips">
        {["All", ...subjects].map((s) => (
          <button key={s} className="chip" aria-pressed={subj === s} onClick={() => { Sound.play("tap"); setSubj(s); }}>
            {s !== "All" && <span className="dot" style={{ background: subjColor(s), margin: 0 }} />}{s}
          </button>
        ))}
      </div>
      <div className="fpanel" data-open={fOpen ? 1 : 0} aria-hidden={!fOpen}>
        <div>
          <div className="fin">
      <div style={{ margin: "0 0 4px" }}>
        <Segmented value={ui.q || "All"} onChange={(v) => setUi((u) => ({ ...u, q: v }))}
          options={[["All", "All quarters"], ...QUARTERS.map((q) => [String(q), `Q${q}`])]} />
      </div>
      {kinds.length > 1 && (
        <div className="chips" style={{ paddingTop: 0 }}>
          {["All", ...kinds].map((k) => (
            <button key={k} className="chip" aria-pressed={ui.kind === k} onClick={() => { Sound.play("tap"); setUi((u) => ({ ...u, kind: k })); }}>
              {k === "All" ? "Any kind" : k}
            </button>
          ))}
        </div>
      )}
      {mode === "list" && tasks.length > 0 && (
        <div style={{ margin: "6px 0 2px" }}>
          <Segmented value={ui.group} onChange={(v) => setUi((u) => ({ ...u, group: v }))} options={[["date", "By date"], ["subject", "By subject"], ["group", "By group"]]} />
        </div>
      )}
          </div>
        </div>
      </div>
      {loading && tasks.length === 0 && <SkeletonRows />}
      {!loading && mode === "list" && groups.length === 0 && (
        <div className="empty">
          <div className="serif">{view === "done" ? "Nothing finished yet" : "You're all caught up"}</div>
          {view === "done" ? "Tasks you check off will collect here." : "Add something with the plus button, or ask the assistant."}
        </div>
      )}
      {mode === "list" && groups.map((g) => (
        <section className="group" key={g.meta ? g.meta.group.id : g.key}>
          <h3>
            {g.meta && <span className="dot" style={{ background: subjColor(g.meta.group.subject), margin: 0, alignSelf: "center" }} />}
            {g.key}
            <small>{g.meta ? `${g.meta.done} of ${g.meta.total} done` : g.items.length}</small>
          </h3>
          {g.meta && (
            <>
              <div className="meta" style={{ margin: "2px 0 0" }}>{g.meta.group.subject}, Q{g.meta.group.quarter}</div>
              <div className="gbar"><i style={{ width: `${g.meta.total ? Math.round((g.meta.done / g.meta.total) * 100) : 0}%` }} /></div>
            </>
          )}
          {g.items.length === 0 && <p className="meta" style={{ margin: "10px 0 0" }}>No tasks in this group yet.</p>}
          {g.items.map((t, idx) => (
            <TaskRow key={t.id} i={idx} selected={selectedId === t.id} t={t} status={st(t)} finished={fin(t)}
              groupName={ui.group === "group" ? null : groupById[t.groupId]?.name} proofState={proofs?.[t.id]?.[user]?.state}
              onOpen={() => openTask(t.id)} onEdit={() => editTask(t.id)}
              leaving={!!leaving[t.id] && st(t) === "done"}
              onToggle={() => change(t.id, st(t) === "done" ? "todo" : "done")} />
          ))}
        </section>
      ))}
      {mode === "board" && (
        <BoardView items={boardItems} st={st} fin={fin} groupById={groupById} proofs={proofs} user={user}
          setStatus={change} openTask={openTask} editTask={editTask} selectedId={selectedId} />
      )}
      {mode === "calendar" && (
        <CalendarView tasks={tasks.filter((t) => subj === "All" || t.subject === subj)} month={month} progress={progress}
          completions={completions} user={user} selDay={selDay} setSelDay={setSelDay}
          openTask={openTask} editTask={editTask} setStatus={setStatus} />
      )}
    </Scroll>
  );
}

/* ───────────────────────── plan my evening ───────────────────────── */

function PlanPanel({ tasks, progress }) {
  const [mins, setMins] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (m) => {
    setMins(m); setText(""); setBusy(true); setErr("");
    const open = tasks
      .filter((t) => (progress[t.id] || "todo") !== "done")
      .map((t) => `${t.title} | ${t.subject} | ${t.type} | priority ${t.priority} | due ${t.deadline} (${diffDays(t.deadline)} days from today) | ${statusLabel(progress[t.id])} | ${t.notes || ""}`)
      .join("\n") || "(nothing open)";
    const system = `You help a student plan tonight's work. Today is ${todayLong()}. The student has about ${m} minutes. Open tasks:\n${open}\n\nPick what to do tonight and in what order, weighing due date first, then priority, then how long each kind of task usually takes (quizzes and exams need study time, homework less). Give each step as one line: the task, then a rough number of minutes. End with one short line about what can safely wait. Plain text only, no markdown symbols, no emojis, under 160 words. If nothing is open, say so warmly in one sentence.`;
    try {
      await streamClaude(system, [{ role: "user", content: "Plan my evening." }], (t) => setText(t));
      Sound.play("pop");
    } catch {
      setErr("The assistant couldn't plan that just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };
  if (mins === null) {
    return (
      <div>
        <p style={{ margin: "0 0 16px", color: C.muted }}>How much time do you have tonight?</p>
        <div className="chips" style={{ flexWrap: "wrap", overflow: "visible", padding: 0 }}>
          {[[30, "30 minutes"], [60, "1 hour"], [120, "2 hours"], [180, "3 hours"]].map(([m, l]) => (
            <button key={m} className="chip" onClick={() => run(m)}>{l}</button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      {busy && !text && <Waiting lines={["Looking at your deadlines", "Weighing what matters most", "Putting it in order"]} />}
      {text && <div className="serif" style={{ fontSize: 17, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{text}</div>}
      {err && <p className="err">{err}</p>}
      {!busy && <button className="btn ghost small" style={{ marginTop: 20 }} onClick={() => { setMins(null); setText(""); }}>Change the time</button>}
    </div>
  );
}

/* ───────────────────────── search ───────────────────────── */

function SearchPanel({ tasks, materials, onTask, onMaterial }) {
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  const tr = s ? tasks.filter((t) => [t.title, t.subject, t.type, t.notes].join(" ").toLowerCase().includes(s)).slice(0, 20) : [];
  const mr = s ? materials.filter((m) => `${m.title} ${m.text}`.toLowerCase().includes(s)).slice(0, 20) : [];
  const snip = (m) => {
    const i = m.text.toLowerCase().indexOf(s);
    if (i < 0) return "";
    const a = Math.max(0, i - 40);
    return (a > 0 ? "…" : "") + m.text.slice(a, i + 90).replace(/\s+/g, " ") + "…";
  };
  return (
    <div>
      <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks and review material" aria-label="Search" />
      {s && tr.length === 0 && mr.length === 0 && <div className="empty" style={{ padding: "36px 8px" }}>Nothing matches "{q.trim()}".</div>}
      {tr.length > 0 && (
        <section className="group">
          <h3>Tasks <small>{tr.length}</small></h3>
          {tr.map((t) => (
            <button key={t.id} className="row" onClick={() => onTask(t.id)}>
              <div className="rowMain">
                <div className="rowTitle">{t.title}</div>
                <div className="rowMeta"><span><span className="dot" style={{ background: subjColor(t.subject) }} />{t.subject}</span><span>{t.type}</span></div>
              </div>
              <div className="rowRight">{relLabel(t.deadline)}</div>
            </button>
          ))}
        </section>
      )}
      {mr.length > 0 && (
        <section className="group">
          <h3>Review material <small>{mr.length}</small></h3>
          {mr.map((m) => (
            <button key={m.id} className="row" onClick={() => onMaterial(m)}>
              <div className="rowMain">
                <div className="rowTitle">{m.title}</div>
                <div className="rowMeta"><span>{tasks.find((t) => t.id === m.taskId)?.title || "Removed task"}</span></div>
                {snip(m) && <div style={{ fontSize: 13.5, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{snip(m)}</div>}
              </div>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

/* ───────────────────────── review ───────────────────────── */

function PracticeQuiz({ task, materials, onClose }) {
  const [state, setState] = useState("loading");
  const [qs, setQs] = useState([]);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState(null);
  const [score, setScore] = useState(0);
  const mats = materials.filter((m) => m.taskId === task.id);
  const load = async () => {
    setState("loading"); setI(0); setPick(null); setScore(0);
    const system = `You write practice quizzes for students. Respond ONLY with JSON: {"questions":[{"q":string,"choices":[string,string,string,string],"answer":0-3,"why":string}]}. Write exactly 5 multiple-choice questions. Keep every "why" to one sentence. No markdown.`;
    const body = mats.length
      ? `Task: ${task.title} (${task.subject}, ${task.type}).\nBase the questions on this review material:\n${mats.map((m) => m.text.slice(0, 3500)).join("\n---\n").slice(0, 9000)}`
      : `Task: ${task.title} (${task.subject}, ${task.type}). Notes: ${task.notes || "none"}.\nNo material was uploaded, so write questions from general knowledge of the topic the title suggests, at a middle school level.`;
    try {
      const out = parseJSON(await callClaude(system, [{ role: "user", content: body }]));
      const q = (out?.questions || []).filter((x) => x.q && Array.isArray(x.choices) && x.choices.length >= 2);
      if (!q.length) throw new Error("bad");
      setQs(q); setState("ready"); Sound.play("pop");
    } catch {
      setState("error"); Sound.play("err");
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (state === "ready" && qs.length && i >= qs.length) Sound.play("bell"); }, [i, state]);
  if (state === "loading") return <Waiting lines={["Writing your questions", "Checking the answers twice", "Almost ready"]} />;
  if (state === "error") return (
    <div className="empty">
      <div className="serif">Couldn't build the quiz</div>
      <p>Something went wrong reaching the assistant.</p>
      <button className="btn" onClick={load}>Try again</button>
    </div>
  );
  if (i >= qs.length) return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div className="serif" style={{ fontSize: 56, lineHeight: 1 }}>{score}<span style={{ color: C.faint }}> / {qs.length}</span></div>
      <p style={{ color: C.muted, margin: "10px 0 26px" }}>
        {score === qs.length ? "Every one right." : score >= qs.length / 2 ? "A solid start. Run it again to lock it in." : "Worth another pass through the material."}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button className="btn ghost" onClick={onClose}>Done</button>
        <button className="btn accent" onClick={load}>New questions</button>
      </div>
    </div>
  );
  const q = qs[i];
  const answered = pick !== null;
  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted }}>Question {i + 1} of {qs.length}</div>
      <div className="bar"><i style={{ width: `${(i / qs.length) * 100}%` }} /></div>
      {!mats.length && i === 0 && (
        <p style={{ fontSize: 13, color: C.muted, margin: "-8px 0 16px" }}>No material added yet, so these come from general knowledge. Add notes for sharper questions.</p>
      )}
      <p className="serif" style={{ fontSize: 21, lineHeight: 1.4, margin: "0 0 20px" }}>{q.q}</p>
      {q.choices.map((c, k) => {
        const s = !answered ? "" : k === q.answer ? "right" : k === pick ? "wrong" : "";
        return (
          <button key={k} className="opt" data-s={s} disabled={answered}
            onClick={() => { setPick(k); if (k === q.answer) { setScore((x) => x + 1); Sound.play("done"); } else Sound.play("err"); }}>
            <span style={{ color: C.faint, width: 18 }}>{"ABCD"[k]}</span><span>{c}</span>
          </button>
        );
      })}
      {answered && (
        <>
          <p style={{ color: C.muted, margin: "6px 0 18px", lineHeight: 1.5 }}>{q.why}</p>
          <button className="btn accent full" onClick={() => { Sound.play("tap"); setI(i + 1); setPick(null); }}>{i + 1 === qs.length ? "See score" : "Next question"}</button>
        </>
      )}
    </div>
  );
}

function Flashcards({ task, materials, onClose }) {
  const [state, setState] = useState("loading");
  const [deck, setDeck] = useState([]);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [known, setKnown] = useState(0);
  const [missed, setMissed] = useState([]);
  const mats = materials.filter((m) => m.taskId === task.id);
  const load = async () => {
    setState("loading"); setI(0); setFlip(false); setKnown(0); setMissed([]);
    const system = `You make flashcards for students. Respond ONLY with JSON: {"cards":[{"front":string,"back":string}]}. Write 10 cards. Fronts are short questions or terms. Backs are brief answers under 25 words. No markdown.`;
    const body = mats.length
      ? `Task: ${task.title} (${task.subject}). Make cards from this material:\n${mats.map((m) => m.text.slice(0, 3500)).join("\n---\n").slice(0, 9000)}`
      : `Task: ${task.title} (${task.subject}, ${task.type}). Notes: ${task.notes || "none"}. No material was uploaded, so use general knowledge of the topic at a middle school level.`;
    try {
      const out = parseJSON(await callClaude(system, [{ role: "user", content: body }]));
      const cards = (out?.cards || []).filter((c) => c.front && c.back);
      if (!cards.length) throw new Error("bad");
      setDeck(cards); setState("ready"); Sound.play("pop");
    } catch {
      setState("error"); Sound.play("err");
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (state === "ready" && deck.length && i >= deck.length) Sound.play("bell"); }, [i, state]);
  if (state === "loading") return <Waiting lines={["Cutting your flashcards", "Picking the key terms", "Shuffling the deck"]} />;
  if (state === "error") return (
    <div className="empty">
      <div className="serif">Couldn't make the cards</div>
      <p>Something went wrong reaching the assistant.</p>
      <button className="btn" onClick={load}>Try again</button>
    </div>
  );
  if (i >= deck.length) return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div className="serif" style={{ fontSize: 48, lineHeight: 1 }}>{known}<span style={{ color: C.faint }}> / {deck.length}</span></div>
      <p style={{ color: C.muted, margin: "10px 0 26px" }}>{missed.length ? `${missed.length} still need another look.` : "You knew every card."}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="btn ghost" onClick={onClose}>Done</button>
        {missed.length > 0 && <button className="btn accent" onClick={() => { setDeck(missed); setI(0); setKnown(0); setMissed([]); setFlip(false); }}>Practice the {missed.length} missed</button>}
        <button className="btn ghost" onClick={load}>New cards</button>
      </div>
    </div>
  );
  const card = deck[i];
  const answer = (ok) => {
    if (ok) { setKnown((k) => k + 1); Sound.play("pop"); } else { setMissed((m) => [...m, card]); Sound.play("tap"); }
    setFlip(false); setI(i + 1);
  };
  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted }}>Card {i + 1} of {deck.length}</div>
      <div className="bar"><i style={{ width: `${(i / deck.length) * 100}%` }} /></div>
      <button className="fcard" onClick={() => { setFlip((f) => !f); Sound.play("tap"); }} aria-label="Flip card">
        <span className="k" style={flip ? { color: C.accent } : undefined}>{flip ? "Answer" : "Tap to flip"}</span>
        <span className="t" key={flip ? "b" : "f"}>{flip ? card.back : card.front}</span>
      </button>
      <div style={{ display: "flex", gap: 10, marginTop: 18, minHeight: 46 }}>
        {flip && (
          <>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => answer(false)}>Still learning</button>
            <button className="btn accent" style={{ flex: 1 }} onClick={() => answer(true)}>Got it</button>
          </>
        )}
      </div>
    </div>
  );
}

function ReviewDetail({ task, user, materials, addMaterial, removeMaterial, onBack }) {
  const mats = materials.filter((m) => m.taskId === task.id);
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const [quiz, setQuiz] = useState(false);
  const [cards, setCards] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState("");
  const [reading, setReading] = useState("");
  const fileRef = useRef(null);
  const onFile = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setErr("");
    if (!title) setTitle(files[0].name.replace(/\.[^.]+$/, ""));
    const parts = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setReading(files.length > 1 ? `Reading file ${i + 1} of ${files.length}` : "Reading file");
      try {
        if (f.size > 20 * 1024 * 1024) throw new Error("big");
        if (/\.pdf$/i.test(f.name) || f.type === "application/pdf" || f.type.startsWith("image/")) {
          const out = await extractFromFile(f);
          if (!out.trim()) throw new Error("empty");
          parts.push(out.trim());
        } else {
          const t = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(f); });
          parts.push(t.slice(0, 20000));
        }
      } catch {
        setErr(`Couldn't read ${f.name}. Files can be up to 20 MB: PDFs, photos, or text files.`);
        Sound.play("err");
      }
    }
    setReading("");
    if (parts.length) { setText((prev) => [prev.trim(), ...parts].filter(Boolean).join("\n\n")); Sound.play("pop"); }
  };
  const save = async () => {
    await addMaterial({ id: uid(), taskId: task.id, title: title.trim() || "Untitled notes", text: text.trim(), by: user, kind: "upload", at: Date.now(), subject: task.subject, taskTitle: task.title });
    Sound.play("add");
    setAdding(false); setTitle(""); setText(""); setErr("");
  };
  const generate = async () => {
    setGen(true); setErr("");
    const system = `You write concise, well-organized study reviewers for students. Plain text only, no markdown symbols, no emojis. Use short headed sections separated by blank lines. Maximum 450 words.`;
    const body = mats.length
      ? `Make a reviewer for "${task.title}" (${task.subject}). Condense and organize this material:\n${mats.map((m) => m.text.slice(0, 3500)).join("\n---\n").slice(0, 9000)}`
      : `Make a reviewer for "${task.title}" (${task.subject}, ${task.type}). Teacher notes: ${task.notes || "none"}. No material was uploaded, so cover the key ideas a student would likely need for this topic at a middle school level, and say at the top that it is a general reviewer.`;
    try {
      const out = await callClaude(system, [{ role: "user", content: body }]);
      if (!out.trim()) throw new Error("empty");
      await addMaterial({ id: uid(), taskId: task.id, title: `Reviewer for ${task.title}`, text: out.trim(), by: "Assistant", kind: "ai", at: Date.now(), subject: task.subject, taskTitle: task.title });
      Sound.play("bell");
    } catch {
      setErr("The assistant couldn't write a reviewer just now. Try again in a moment.");
      Sound.play("err");
    } finally {
      setGen(false);
    }
  };
  return (
    <div className="scroll">
      <button className="back" onClick={onBack}><ChevronLeft size={18} />Review</button>
      <h1 className="h1" style={{ marginTop: 4 }}>{task.title}</h1>
      <div className="rowMeta" style={{ fontSize: 14 }}>
        <span><span className="dot" style={{ background: subjColor(task.subject) }} />{task.subject}</span>
        <span>{task.type}</span>
        <span className={diffDays(task.deadline) < 0 ? "late" : ""}>Due {relLabel(task.deadline)}</span>
      </div>
      {task.notes && <p style={{ color: C.muted, margin: "16px 0 0", lineHeight: 1.55 }}>{task.notes}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
        <button className="btn accent" onClick={() => setQuiz(true)}>Practice quiz</button>
        <button className="btn ghost" onClick={() => setCards(true)}>Flashcards</button>
        <button className="btn ghost" onClick={generate} disabled={gen}>
          <Sparkles size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{gen ? <>Writing reviewer<Dots /></> : "Ask for a reviewer"}
        </button>
      </div>
      {err && !adding && <p className="err" style={{ marginTop: 14 }}>{err}</p>}
      <h2 className="sectionTitle">Review material</h2>
      {mats.length === 0 && <p style={{ color: C.muted, margin: 0 }}>Nothing here yet. Paste notes, or upload a PDF, photo or text file so classmates can use them too.</p>}
      {mats.map((m) => (
        <div className="mat" key={m.id}>
          <button className="matHead" onClick={() => { Sound.play("tap"); setOpen(open === m.id ? null : m.id); }} aria-expanded={open === m.id}>
            <span>
              <span style={{ fontWeight: 500 }}>{m.title}</span>
              {m.kind === "ai" && <span className="tag">Assistant</span>}
              <span style={{ display: "block", fontSize: 13, color: C.muted }}>Added by {m.by}</span>
            </span>
            <ChevronDown size={18} style={{ stroke: "var(--faint)", transform: open === m.id ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>
          {open === m.id && (
            <>
              <div className="matBody">{m.text}</div>
              {(m.by === user || m.kind === "ai") && (
                <button className="back" style={{ color: C.danger, marginBottom: 12 }} onClick={() => removeMaterial(m.id)}>
                  <Trash2 size={14} style={{ marginRight: 6 }} />Remove
                </button>
              )}
            </>
          )}
        </div>
      ))}
      <button className="btn ghost" style={{ marginTop: 18 }} onClick={() => setAdding(true)}>
        <Plus size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Add material
      </button>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add review material">
        <div className="field">
          <label htmlFor="mt">Title</label>
          <input id="mt" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson 2.1 key points" />
        </div>
        <div className="field">
          <label htmlFor="mx">Notes</label>
          <textarea id="mx" className="input" style={{ minHeight: 160 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste notes here" />
        </div>
        <input ref={fileRef} type="file" multiple accept=".pdf,image/*,.txt,.md,.csv,.json,text/plain" hidden onChange={onFile} />
        <p style={{ fontSize: 13, color: C.muted, margin: "-6px 0 14px", lineHeight: 1.5 }}>
          PDFs and photos are read by the assistant and turned into notes you can edit. Long files are condensed.
        </p>
        {err && <p className="err">{err}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="btn ghost" disabled={!!reading} onClick={() => fileRef.current?.click()}>
            <Upload size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{reading ? <>{reading}<Dots /></> : "Upload PDF, photo or text file"}
          </button>
          <button className="btn accent" disabled={!text.trim() || !!reading} onClick={save}>Share with class</button>
        </div>
      </Sheet>
      <Sheet open={quiz} onClose={() => setQuiz(false)} title="Practice quiz">
        {quiz && <PracticeQuiz task={task} materials={materials} onClose={() => setQuiz(false)} />}
      </Sheet>
      <Sheet open={cards} onClose={() => setCards(false)} title="Flashcards">
        {cards && <Flashcards task={task} materials={materials} onClose={() => setCards(false)} />}
      </Sheet>
    </div>
  );
}

function WeeklyReviewer({ tasks, materials, weeklies, user, saveWeekly, initialWs }) {
  const thisWeek = weekStartOf(todayISO());
  const lastWeek = addDays(thisWeek, -7);
  const [ws, setWs] = useState(initialWs || thisWeek);
  const [live, setLive] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [quiz, setQuiz] = useState(false);
  const [cards, setCards] = useState(false);
  const saved = weeklies.find((w) => w.weekStart === ws);
  const wkTask = { id: `week-${ws}`, title: `Week of ${weekLabel(ws)}`, subject: "All subjects", type: "Study", notes: "" };
  const wkMats = saved ? [{ id: "wk", taskId: wkTask.id, title: wkTask.title, text: saved.text }] : [];
  const shown = busy ? live : saved?.text || "";
  const { ts, ms } = useMemo(() => weekData(ws, tasks, materials), [ws, tasks, materials]);
  const earlier = weeklies.filter((w) => w.weekStart !== thisWeek && w.weekStart !== lastWeek).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  const pick = (w) => { if (busy) return; Sound.play("tap"); setWs(w); setErr(""); };
  const generate = async () => {
    if (!ts.length && !ms.length) { setErr("Nothing was due or added that week yet, so there's nothing to review."); Sound.play("err"); return; }
    setBusy(true); setLive(""); setErr("");
    const by = {};
    const slot = (s) => (by[s] = by[s] || { tasks: [], mats: [] });
    ts.forEach((t) => slot(t.subject).tasks.push(t));
    ms.forEach((m) => slot(m.subject || tasks.find((t) => t.id === m.taskId)?.subject || "Other").mats.push(m));
    const body = Object.entries(by).map(([s, d]) =>
      `SUBJECT: ${s}\nTasks:\n${d.tasks.map((t) => `- ${t.title} (${t.type}, due ${t.deadline})${t.notes ? `, notes: ${t.notes}` : ""}`).join("\n") || "- none"}\nMaterial:\n${d.mats.map((m) => `"${m.title}": ${m.text.slice(0, 1800)}`).join("\n") || "none"}`
    ).join("\n\n").slice(0, 11000);
    const next = tasks.filter((t) => t.deadline >= addDays(ws, 7) && t.deadline <= addDays(ws, 13)).map((t) => `${t.title} (${t.subject}, ${fmtDate(t.deadline)})`).join("; ");
    const system = `You write a weekly reviewer for a class, covering what the class worked on and learned. Plain text only, no markdown symbols, no emojis. Start with one sentence summing up the week. Then, for each subject, put the subject name on its own line, followed by 3 to 5 short lines on what was covered or assigned and the key facts to remember, then one self-check question. Take facts only from the material provided. When a subject has only a task title and notes and no material, say what was assigned and do not invent lesson content. Finish with a short "Coming up" line using the next-week list. Keep it under 550 words.`;
    try {
      const full = await streamClaude(system, [{ role: "user", content: `Week of ${weekLabel(ws)}.\n\n${body}\n\nComing next week: ${next || "nothing listed yet"}` }], (t) => setLive(t));
      if (!full.trim()) throw new Error("empty");
      saveWeekly(ws, full.trim());
      Sound.play("bell");
    } catch {
      setErr("The assistant couldn't write the reviewer just now. Try again in a moment."); Sound.play("err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ marginTop: 14 }}>
      <div className="chips" style={{ padding: "0 0 4px" }}>
        <button className="chip" aria-pressed={ws === thisWeek} onClick={() => pick(thisWeek)}>This week</button>
        <button className="chip" aria-pressed={ws === lastWeek} onClick={() => pick(lastWeek)}>Last week</button>
      </div>
      <h2 className="sectionTitle" style={{ marginTop: 14 }}>{weekLabel(ws)}</h2>
      <p className="meta" style={{ margin: "0 0 18px" }}>
        {ts.length} {ts.length === 1 ? "task" : "tasks"} due, {ms.length} {ms.length === 1 ? "item" : "items"} of material
      </p>
      {busy && !live && <Waiting lines={["Gathering the week", "Pulling out the key points", "Writing it up"]} />}
      {shown && <div className="serif" style={{ fontSize: 17, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{shown}</div>}
      {saved && !busy && <p className="meta" style={{ marginTop: 14 }}>Made by {saved.by}, {timeAgo(saved.at)}. Everyone in the class can read this.</p>}
      {!saved && !busy && !err && <p style={{ color: C.muted, margin: "0 0 4px" }}>No reviewer for this week yet. It pulls together every task and note from the week into one page.</p>}
      {err && <p className="err">{err}</p>}
      {!busy && (
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <button className={saved ? "btn ghost" : "btn accent"} onClick={generate}>{saved ? "Make it again" : "Make the reviewer"}</button>
          {saved && <button className="btn accent" onClick={() => setQuiz(true)}>Quiz me</button>}
          {saved && <button className="btn ghost" onClick={() => setCards(true)}>Flashcards</button>}
          <Sheet open={quiz} onClose={() => setQuiz(false)} title="Quiz me">
            {quiz && <PracticeQuiz task={wkTask} materials={wkMats} onClose={() => setQuiz(false)} />}
          </Sheet>
          <Sheet open={cards} onClose={() => setCards(false)} title="Flashcards">
            {cards && <Flashcards task={wkTask} materials={wkMats} onClose={() => setCards(false)} />}
          </Sheet>
          {saved && (
            <button className="btn ghost" onClick={async () => { const ok = await copyText(saved.text); setCopied(ok); if (ok) Sound.play("pop"); setTimeout(() => setCopied(false), 1800); }}>
              <Copy size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      )}
      {earlier.length > 0 && (
        <section className="group">
          <h3>Earlier weeks <small>{earlier.length}</small></h3>
          {earlier.map((w) => (
            <button key={w.id} className="row" onClick={() => pick(w.weekStart)}>
              <div className="rowMain">
                <div className="rowTitle">{weekLabel(w.weekStart)}</div>
                <div className="rowMeta"><span>Made by {w.by}</span></div>
              </div>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

function Library({ tasks, materials, user, removeMaterial }) {
  const [subj, setSubj] = useState("All");
  const [open, setOpen] = useState(null);
  const all = materials.map((m) => {
    const t = tasks.find((x) => x.id === m.taskId);
    return { ...m, subject: m.subject || t?.subject || "Other", taskTitle: m.taskTitle || t?.title || "Removed task", gone: !t };
  });
  const subjects = [...new Set(all.map((m) => m.subject))];
  const list = all.filter((m) => subj === "All" || m.subject === subj).sort((a, b) => b.at - a.at);
  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ color: C.muted, margin: "0 0 4px", lineHeight: 1.5 }}>
        {all.length} {all.length === 1 ? "item" : "items"} of material and {tasks.length} tasks on record. Everything stays here, even after a task is finished or removed.
      </p>
      {subjects.length > 0 && (
        <div className="chips">
          {["All", ...subjects].map((s) => (
            <button key={s} className="chip" aria-pressed={subj === s} onClick={() => { Sound.play("tap"); setSubj(s); }}>
              {s !== "All" && <span className="dot" style={{ background: subjColor(s), margin: 0 }} />}{s}
            </button>
          ))}
        </div>
      )}
      {list.length === 0 && <div className="empty"><div className="serif">Nothing stored yet</div>Notes, uploads and reviewers collect here as your class adds them.</div>}
      {list.map((m) => (
        <div className="mat" key={m.id}>
          <button className="matHead" onClick={() => { Sound.play("tap"); setOpen(open === m.id ? null : m.id); }} aria-expanded={open === m.id}>
            <span>
              <span style={{ fontWeight: 500 }}>{m.title}</span>
              {m.kind === "ai" && <span className="tag">Assistant</span>}
              <span className="rowMeta" style={{ marginTop: 2 }}>
                <span><span className="dot" style={{ background: subjColor(m.subject) }} />{m.subject}</span>
                <span>{m.taskTitle}{m.gone ? " (task removed)" : ""}</span>
                <span>{fmtDate(toISO(new Date(m.at)))}</span>
              </span>
            </span>
            <ChevronDown size={18} style={{ stroke: "var(--faint)", flex: "none", transform: open === m.id ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>
          {open === m.id && (
            <>
              <div className="matBody">{m.text}</div>
              <p className="meta" style={{ margin: "-6px 0 10px" }}>Added by {m.by}</p>
              {(m.by === user || m.kind === "ai") && (
                <button className="back" style={{ color: C.danger, marginBottom: 12 }} onClick={() => removeMaterial(m.id)}>
                  <Trash2 size={14} style={{ marginRight: 6 }} />Remove
                </button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function ReviewTab({ tasks, progress, materials, weeklies, saveWeekly, user, addMaterial, removeMaterial, focusId, clearFocus, reviewStart, clearStart, onRefresh }) {
  const [sel, setSel] = useState(focusId || null);
  const [all, setAll] = useState(false);
  const [section, setSection] = useState("tasks");
  const [startWs, setStartWs] = useState(null);
  useEffect(() => {
    if (reviewStart) { setSection(reviewStart.section); setStartWs(reviewStart.ws || null); setSel(null); clearStart(); }
  }, [reviewStart]);
  useEffect(() => { if (focusId) { setSel(focusId); clearFocus(); } }, [focusId]);
  const task = tasks.find((t) => t.id === sel);
  if (task) return <ReviewDetail task={task} user={user} materials={materials} addMaterial={addMaterial} removeMaterial={removeMaterial} onBack={() => setSel(null)} />;
  const sorted = [...tasks].sort((a, b) => a.deadline.localeCompare(b.deadline));
  const upcoming = sorted.filter((t) => (progress[t.id] || "todo") !== "done");
  const list = upcoming.filter((t) => all || REVIEW_TYPES.includes(t.type) || materials.some((m) => m.taskId === t.id));
  return (
    <Scroll onRefresh={onRefresh}>
      <h1 className="h1">Review</h1>
      <p className="sub">
        {section === "tasks" ? "Pick a quiz or study task to see shared notes, get a reviewer, practice, or flip flashcards."
          : section === "weekly" ? "One page covering what the class worked on and learned each week."
          : "Every note, upload and reviewer your class has stored."}
      </p>
      <Segmented value={section} onChange={setSection} options={[["tasks", "By task"], ["weekly", "Weekly"], ["library", "Library"]]} />
      {section === "weekly" && <WeeklyReviewer key={startWs || "w"} initialWs={startWs} tasks={tasks} materials={materials} weeklies={weeklies} user={user} saveWeekly={saveWeekly} />}
      {section === "library" && <Library tasks={tasks} materials={materials} user={user} removeMaterial={removeMaterial} />}
      {section === "tasks" && (
        <div style={{ marginTop: 14 }}>
          <Segmented value={all ? "all" : "focus"} onChange={(v) => setAll(v === "all")} options={[["focus", "Quizzes and study"], ["all", "Everything"]]} />
        </div>
      )}
      {section === "tasks" && list.length === 0 && <div className="empty"><div className="serif">No quizzes coming up</div>Switch to Everything to review any task.</div>}
      <div style={{ marginTop: 14, display: section === "tasks" ? "block" : "none" }}>
        {list.map((t) => {
          const n = materials.filter((m) => m.taskId === t.id).length;
          return (
            <button key={t.id} className="row" onClick={() => { Sound.play("tap"); setSel(t.id); }}>
              <div className="rowMain">
                <div className="rowTitle">{t.title}</div>
                <div className="rowMeta">
                  <span><span className="dot" style={{ background: subjColor(t.subject) }} />{t.subject}</span>
                  <span>{t.type}</span>
                  <span>{n === 0 ? "No material yet" : n === 1 ? "1 item of material" : `${n} items of material`}</span>
                </div>
              </div>
              <div className="rowRight"><div className={diffDays(t.deadline) < 0 ? "late" : ""}>{relLabel(t.deadline)}</div></div>
            </button>
          );
        })}
      </div>
    </Scroll>
  );
}/* ───────────────────────── ask ───────────────────────── */

function AskTab({ user, tasks, materials, progress, addTask }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);
  const send = async (override) => {
    const q = (override ?? text).trim();
    if (!q || busy) return;
    setText("");
    Sound.play("send");
    const next = [...msgs, { role: "user", text: q, raw: q }];
    const idx = next.length;
    setMsgs([...next, { role: "ai", text: "", raw: "", added: [] }]);
    setBusy(true);
    const ctx = buildContext(tasks, materials, progress, user);
    const subjects = [...new Set(tasks.map((t) => t.subject))].join(", ") || "none yet";
    const system = `You are the built-in assistant inside Homeroom, a shared class reminders app. Today is ${ctx.today}. You are talking with ${user}.
Everything the class has added so far:
${ctx.list}
Shared review material:
${ctx.mats}
Existing subjects: ${subjects}.
You can answer questions about due dates, what is due today or this week, guidelines, priorities, and help with review using the material above. Be brief and direct. Resolve words like "Friday" or "next Monday" against today's date.
Write your reply as plain conversational text with no markdown and no emojis.
When the person asks you to add an assignment, quiz, or other task, add it. If the subject or due date is missing and cannot be inferred, ask one short question instead and add nothing. Reuse an existing subject name when one fits. taskType must be one of: ${TYPES.join(", ")}. priority must be High, Medium, or Low (default Medium unless they say otherwise). deadline must be YYYY-MM-DD. To add tasks, finish your reply with a new line containing exactly <<ACTIONS>> and straight after it a JSON array like [{"type": "add_task", "title":string, "subject":string, "taskType":string, "priority":string, "deadline":"YYYY-MM-DD", "notes":string}]. Only use the marker when you are actually adding something, and never mention the marker or JSON in your reply.`;
    const apiMsgs = next.slice(-10).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.raw || m.text || "..." }));
    try {
      const full = await streamClaude(system, apiMsgs, (t) => {
        const cut = t.indexOf("<<");
        const shown = (cut >= 0 ? t.slice(0, cut) : t).trimEnd();
        setMsgs((m) => m.map((x, i) => (i === idx ? { ...x, text: shown, raw: t } : x)));
      });
      const mi = full.indexOf("<<ACTIONS>>");
      let actions = [];
      if (mi >= 0) {
        const tail = full.slice(mi + 11);
        try {
          const arr = JSON.parse(tail.slice(tail.indexOf("["), tail.lastIndexOf("]") + 1));
          if (Array.isArray(arr)) actions = arr;
        } catch {}
      }
      const added = [];
      for (const a of actions) {
        if (a?.type === "add_task" && a.title && a.subject && /^\d{4}-\d{2}-\d{2}$/.test(a.deadline || "")) {
          const t = {
            id: uid(), title: String(a.title).slice(0, 120), subject: String(a.subject).slice(0, 40),
            type: TYPES.includes(a.taskType) ? a.taskType : "Homework",
            priority: PRIORITIES.includes(a.priority) ? a.priority : "Medium",
            deadline: a.deadline, notes: String(a.notes || "").slice(0, 600), addedBy: user, createdAt: Date.now(),
          };
          addTask(t);
          added.push(t);
        }
      }
      const reply = (mi >= 0 ? full.slice(0, mi) : full).trim();
      setMsgs((m) => m.map((x, i) => (i === idx ? { ...x, text: reply || "Done.", raw: full, added } : x)));
      Sound.play(added.length ? "add" : "pop");
    } catch {
      setMsgs((m) => m.map((x, i) => (i === idx ? { ...x, text: "I couldn't reach the assistant just now. Check your connection and try again.", raw: "" } : x)));
      Sound.play("err");
    } finally {
      setBusy(false);
    }
  };
  const suggestions = ["What's due today?", "What's due this week?", "Plan my evening. I have about 2 hours.", "Add a math quiz this Friday", "What are the guidelines for Math quiz 2.1?"];
  return (
    <div className="chat">
      <div className="msgs">
        {msgs.length === 0 && (
          <>
            <h1 className="h1">Ask anything about class.</h1>
            <p className="sub" style={{ marginBottom: 0 }}>It knows every task, deadline, and note your class has added, plus the shared review material.</p>
            <div className="suggest">{suggestions.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>
          </>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role === "user" ? "me" : "ai"}`}>
            {m.role === "ai" && !m.text && busy ? <span style={{ color: C.faint }}><Dots /></span> : m.text}
            {m.added?.map((t) => (
              <div className="added" key={t.id}>
                <b>Added to the class list</b>
                {t.title}, {t.subject}, due {fmtDate(t.deadline)}
              </div>
            ))}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="composer" style={{ marginBottom: 62 }}>
        <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask or add a task"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="send" onClick={() => send()} disabled={!text.trim() || busy} aria-label="Send"><ArrowUp size={20} /></button>
      </div>
    </div>
  );
}

/* ───────────────────────── comments ───────────────────────── */

function Comments({ taskId, comments, user, isAdmin, onAdd, onRemove }) {
  const list = comments.filter((c) => c.taskId === taskId).sort((a, b) => a.at - b.at);
  const [text, setText] = useState("");
  const post = () => { if (!text.trim()) return; onAdd(taskId, text.trim()); setText(""); };
  return (
    <div>
      <h2 className="sectionTitle" style={{ marginTop: 28 }}>Comments{list.length ? <small style={{ fontFamily: SANS, fontSize: 13, color: C.faint, marginLeft: 8 }}>{list.length}</small> : null}</h2>
      {list.length === 0 && <p style={{ color: C.muted, margin: 0, fontSize: 14 }}>Questions about this task go here, like which page or what to bring.</p>}
      {list.map((c) => (
        <div className="cmt" key={c.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span><b>{c.by}</b> <span className="meta" style={{ marginLeft: 6 }}>{timeAgo(c.at)}</span></span>
            {(c.by === user || isAdmin) && <button className="back" style={{ padding: 0, fontSize: 13 }} onClick={() => onRemove(c.id)}>Delete</button>}
          </div>
          <p style={{ margin: "4px 0 0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.text}</p>
        </div>
      ))}
      <div className="cmtIn">
        <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment" aria-label="Add a comment"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); post(); } }} />
        <button className="send" onClick={post} disabled={!text.trim()} aria-label="Post comment"><ArrowUp size={20} /></button>
      </div>
    </div>
  );
}

/* ───────────────────────── suggestions ───────────────────────── */

function FeedbackForm({ onSend, onClose }) {
  const [kind, setKind] = useState("request");
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (sent) {
    return (
      <div className="empty">
        <div className="serif">Sent</div>
        Thank you. The admin will read it.
        <div><button className="btn" style={{ marginTop: 18 }} onClick={onClose}>Done</button></div>
      </div>
    );
  }
  return (
    <div>
      <div className="field"><Segmented value={kind} onChange={setKind} options={[["request", "A suggestion"], ["problem", "Something's wrong"]]} /></div>
      <div className="field">
        <label htmlFor="fb">{kind === "problem" ? "What happened?" : "What would make this better?"}</label>
        <textarea id="fb" className="input" style={{ minHeight: 120 }} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <button className="btn accent full" disabled={!text.trim() || busy}
        onClick={async () => { setBusy(true); await onSend(kind, text.trim()); Sound.play("add"); setSent(true); }}>
        Send it
      </button>
    </div>
  );
}

/* ───────────────────────── admin ───────────────────────── */

const INBOX_LABEL = { problem: "Problem", request: "Suggestion" };

function AdminApp({ themeAttr, accentStyle, theme, setTheme, onSignOut }) {
  useSpotlight();
  const [tab, setTab] = useState("suggestions");
  const [inbox, setInbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [navRef, navSlider] = useSlider(tab);
  const [tabsRef, tabsSlider] = useSlider(tab);
  const seen = useRef(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from("feedback").select("*").order("created_at", { ascending: false });
    const inb = (data || []).map((r) => ({ id: r.id, at: Date.parse(r.created_at), read: r.read, type: r.type, from: r.from_user, text: r.text }));
    const unread = inb.filter((i) => !i.read).length;
    if (seen.current !== null && unread > seen.current) Sound.play("bell");
    seen.current = unread;
    setInbox(inb); setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const on = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", on);
    window.addEventListener("focus", on);
    const id = setInterval(on, 30000);
    return () => { document.removeEventListener("visibilitychange", on); window.removeEventListener("focus", on); clearInterval(id); };
  }, [load]);
  const markRead = (id) => {
    setInbox((c) => c.map((i) => (id === "all" || i.id === id ? { ...i, read: true } : i)));
    (id === "all" ? supabase.from("feedback").update({ read: true }).eq("read", false) : supabase.from("feedback").update({ read: true }).eq("id", id)).then(() => {});
  };
  const dismiss = (id) => { Sound.play("undo"); setInbox((c) => c.filter((i) => i.id !== id)); supabase.from("feedback").delete().eq("id", id).then(() => {}); };
  const unread = inbox.filter((i) => !i.read).length;
  const list = [...inbox]
    .sort((a, b) => b.at - a.at)
    .filter((i) => filter === "all" || (filter === "unread" ? !i.read : i.type === filter));
  const count = (f) => inbox.filter((i) => (f === "unread" ? !i.read : i.type === f)).length;
  const tabs = [["suggestions", "Suggestions", Lightbulb], ["minecraft", "Minecraft", Gamepad2]];
  const go = (k) => { if (tab !== k) Sound.play("tap"); setTab(k); };
  const dark = themeAttr === "dark";
  return (
    <div className="hr app adminApp" data-theme={themeAttr} data-wide="1" style={accentStyle}>
      <style>{CSS}</style>
      <Backdrop />
      <nav className="rail" aria-label="Admin" ref={navRef}>
        {navSlider}
        <div className="railLogo"><span className="mark logoFull">Homeroom</span><span className="mark logoMini">H</span></div>
        {tabs.map(([k, l, Icon]) => (
          <button key={k} className="nav" aria-current={tab === k ? "page" : undefined} onClick={() => go(k)}>
            <Icon size={21} /><span>{l}</span>
            {k === "suggestions" && unread > 0 && <span className="badge">{unread}</span>}
          </button>
        ))}
        <div className="railSpacer" />
        <button className="nav" onClick={onSignOut}><LogOut size={21} /><span>Sign out</span></button>
      </nav>
      <div className="main">
        <header className="head">
          <span className="headL"><span className="mark phoneOnly">Homeroom</span><span className="classChip">Admin</span></span>
          <div className="hdrRight">
            <button className="hdrBtn" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => { Sound.play("pop"); setTheme(dark ? "light" : "dark"); }}>
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="hdrBtn phoneOnly" aria-label="Sign out" onClick={onSignOut}><LogOut size={17} /></button>
          </div>
        </header>
        <div className="page" key={tab}>
          <div className="scroll">
            {tab === "suggestions" && (
              <>
                <div className="heroCard spot">
                  <div className="heroBody">
                    <div className="heroDate">Admin</div>
                    <h1 className="h1">Suggestions</h1>
                    <p className="sub">Ideas and problems your class sent in.</p>
                    <div className="heroChips">
                      <span className={unread ? "streak" : "streak quiet"}><Inbox size={14} />{unread ? `${unread} unread` : "All caught up"}</span>
                      {unread > 0 && <button className="btn ghost small" onClick={() => { Sound.play("tap"); markRead("all"); }}>Mark all read</button>}
                    </div>
                  </div>
                </div>
                <div style={{ margin: "16px 0 4px" }}>
                  <Segmented value={filter} onChange={setFilter}
                    options={[["all", `All${inbox.length ? ` (${inbox.length})` : ""}`], ["unread", `Unread${count("unread") ? ` (${count("unread")})` : ""}`], ["request", "Ideas"], ["problem", "Problems"]]} />
                </div>
                {loading && <SkeletonRows />}
                {!loading && list.length === 0 && (
                  <div className="empty">
                    <div className="serif">{inbox.length ? "Nothing in this view" : "No suggestions yet"}</div>
                    {inbox.length ? "Try another filter." : "When someone sends an idea or reports a problem, it shows up here."}
                  </div>
                )}
                {list.map((i, idx) => (
                  <article className="sug" key={i.id} data-unread={i.read ? 0 : 1} style={{ "--i": Math.min(idx, 10) }}>
                    <div className="sugIcon" data-k={i.type}>{i.type === "problem" ? <CircleAlert size={20} /> : <Lightbulb size={20} />}</div>
                    <div className="sugBody">
                      <div className="sugHead">
                        <b style={{ fontWeight: 600 }}>{INBOX_LABEL[i.type] || "Message"} from {i.from}</b>
                        <span className="meta">{timeAgo(i.at)}</span>
                      </div>
                      <p className="sugText">{i.text}</p>
                      <div className="sugActions">
                        {!i.read && <button className="btn ghost small" onClick={() => { Sound.play("tap"); markRead(i.id); }}><Check size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Mark read</button>}
                        <button className="btn ghost small" onClick={() => dismiss(i.id)}><Trash2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Delete</button>
                      </div>
                    </div>
                  </article>
                ))}
              </>
            )}
            {tab === "minecraft" && (
              <>
                <div className="heroCard spot">
                  <div className="heroBody">
                    <div className="heroDate">Admin</div>
                    <h1 className="h1">Minecraft requests</h1>
                    <p className="sub">This space is saved for the server access requests.</p>
                  </div>
                  <div className="soonIcon"><Gamepad2 size={34} /></div>
                </div>
                <div className="empty" style={{ paddingBottom: 18 }}>
                  <div className="serif">Coming soon</div>
                  Requests will appear here once the Minecraft side is built.
                </div>
                {[0, 1, 2].map((n) => (
                  <div className="ghostCard" key={n} style={{ animationDelay: `${n * 80}ms` }}>
                    <i style={{ width: 42, height: 42, borderRadius: 14, flex: "none" }} />
                    <div style={{ flex: 1 }}>
                      <i style={{ width: `${46 + n * 12}%`, marginBottom: 9 }} />
                      <i style={{ width: `${70 - n * 9}%`, height: 9 }} />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        <nav className="tabs" aria-label="Admin" ref={tabsRef}>
          {tabsSlider}
          {tabs.map(([k, l, Icon]) => (
            <button key={k} className="tab" aria-current={tab === k ? "page" : undefined} onClick={() => go(k)}>
              <Icon size={21} />{l}
              {k === "suggestions" && unread > 0 && <span className="badge">{unread}</span>}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

/* ───────────────────────── app ───────────────────────── */

/* ───────────────────────── layout helpers, focus timer, side panel ───────────────────────── */

const ACCENTS = {
  clay: ["#C4694A", "#DB8566"],
  ocean: ["#3F7CAC", "#6BA3D1"],
  forest: ["#4A8A66", "#7DB894"],
  plum: ["#8A5A83", "#B98BB1"],
  sun: ["#B97F12", "#E3AE46"],
};

const calcBreakpoint = () => (window.innerWidth >= 1180 ? "desktop" : window.innerWidth >= 760 ? "tablet" : "phone");
function useBreakpoint() {
  const [bp, setBp] = useState(calcBreakpoint);
  useEffect(() => {
    const on = () => setBp(calcBreakpoint());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return bp;
}

// Days in a row (ending today, or yesterday if nothing is done yet today) with at least one finished task.
function calcStreak(days) {
  const set = new Set(days);
  let d = todayISO();
  if (!set.has(d)) d = addDays(d, -1);
  let n = 0;
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

function Pct({ v }) {
  const n = useCountUp(Math.round(v * 100), 650);
  return <b>{n}%</b>;
}

function Ring({ pct, size = 92, stroke = 8, celebrate, children }) {
  const [on, setOn] = useState(false);
  const [bump, setBump] = useState(false);
  const prev = useRef(null);
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, pct || 0));
  useEffect(() => {
    const was = prev.current; prev.current = v;
    if (!celebrate || was === null || v <= was + 0.004) { setBump(false); return; }
    setBump(true);
    const id = setTimeout(() => setBump(false), 750);
    return () => clearTimeout(id);
  }, [v]);
  return (
    <div className="ring" data-bump={bump ? 1 : 0} style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle className="bg" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle className="fg" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={on ? c * (1 - v) : c} />
      </svg>
      <div className="lbl">{children}</div>
    </div>
  );
}

const FOCUS_MODES = { focus: 25 * 60, break: 5 * 60, long: 15 * 60 };
const mmss = (n) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;

function useFocusTimer() {
  const [mode, setMode] = useState("focus");
  const [left, setLeft] = useState(FOCUS_MODES.focus);
  const [running, setRunning] = useState(false);
  const endRef = useRef(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const rem = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setLeft(rem);
      if (rem <= 0) { setRunning(false); Sound.play("bell"); }
    }, 250);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => {
    document.title = running ? `${mmss(left)} · Homeroom` : "Homeroom";
  }, [running, left]);
  const start = () => { endRef.current = Date.now() + left * 1000; setRunning(true); Sound.play("tap"); };
  const pause = () => setRunning(false);
  const reset = (m) => { const next = typeof m === "string" ? m : mode; setRunning(false); setMode(next); setLeft(FOCUS_MODES[next]); };
  return { mode, left, running, total: FOCUS_MODES[mode], start, pause, reset };
}

function FocusCard({ timer }) {
  const { mode, left, running, total, start, pause, reset } = timer;
  return (
    <div className="card">
      <h4>Focus timer</h4>
      <div style={{ marginBottom: 16 }}>
        <Segmented value={mode} onChange={(m) => reset(m)} options={[["focus", "Focus"], ["break", "Break"], ["long", "Long break"]]} />
      </div>
      <div className="timer">
        <Ring pct={1 - left / total} size={108}><b style={{ fontSize: 24 }}>{mmss(left)}</b></Ring>
        <div className="timerBtns">
          <button className="btn accent small" onClick={running ? pause : start}>
            {running ? <><Pause size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Pause</> : <><Play size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{left < total ? "Resume" : "Start"}</>}
          </button>
          <button className="btn ghost small" disabled={!running && left === total} onClick={() => reset()}>Reset</button>
        </div>
      </div>
    </div>
  );
}

function SideToday({ tasks, progress, openTask, timer }) {
  const open = tasks.filter((t) => (progress[t.id] || "todo") !== "done").sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 4);
  const subs = [...new Set(tasks.map((t) => t.subject))].map((x) => {
    const l = tasks.filter((t) => t.subject === x);
    return { x, done: l.filter((t) => progress[t.id] === "done").length, total: l.length };
  });
  return (
    <>
      <FocusCard timer={timer} />
      <div className="card" style={{ animationDelay: "70ms" }}>
        <h4>Coming up</h4>
        {open.length === 0 && <p className="meta" style={{ margin: 0 }}>You're all caught up.</p>}
        {open.map((t) => (
          <button key={t.id} className="mini" onClick={() => openTask(t.id)}>
            <span className="dot" style={{ background: subjColor(t.subject), margin: 0, flex: "none" }} />
            <div><b>{t.title}</b><span className="meta" style={{ display: "block" }}>{t.subject}</span></div>
            <span className={diffDays(t.deadline) < 0 ? "meta late" : "meta"}>{relLabel(t.deadline)}</span>
          </button>
        ))}
      </div>
      {subs.length > 0 && (
        <div className="card" style={{ animationDelay: "140ms" }}>
          <h4>Progress by subject</h4>
          {subs.map((r) => (
            <div className="sbar" key={r.x}>
              <div><span>{r.x}</span><span className="meta">{r.done} of {r.total}</span></div>
              <div className="t"><i style={{ width: `${r.total ? Math.round((r.done / r.total) * 100) : 0}%`, background: subjColor(r.x) }} /></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function BoardView({ items, st, fin, groupById, proofs, user, setStatus, openTask, editTask, selectedId }) {
  const [over, setOver] = useState(null);
  return (
    <div className="board">
      {STATUSES.map(([k, label]) => {
        const col = items.filter((t) => st(t) === k);
        return (
          <div key={k} className="col" data-over={over === k ? 1 : 0}
            onDragOver={(e) => { e.preventDefault(); if (over !== k) setOver(k); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
            onDrop={(e) => {
              e.preventDefault(); setOver(null);
              const id = e.dataTransfer.getData("text/plain");
              const t = items.find((x) => x.id === id);
              if (t && st(t) !== k) setStatus(id, k);
            }}>
            <h4><span>{label}</span><span>{col.length}</span></h4>
            {col.length === 0 && <div className="colEmpty">Nothing here</div>}
            {col.map((t, idx) => (
              <div key={t.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; }}>
                <TaskRow i={idx} t={t} status={k} finished={fin(t)} selected={selectedId === t.id}
                  groupName={groupById[t.groupId]?.name} proofState={proofs?.[t.id]?.[user]?.state}
                  onOpen={() => openTask(t.id)} onEdit={() => editTask(t.id)}
                  onToggle={() => setStatus(t.id, k === "done" ? "todo" : "done")} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── photo proof + groups ───────────────────────── */

// Only ever rendered for the student who sent the photos and for the admin.
// Each photo gets a temporary link that expires in an hour.
function ProofThumbs({ paths }) {
  const [links, setLinks] = useState({});
  const [failed, setFailed] = useState(false);
  const key = (paths || []).join("|");
  useEffect(() => {
    let alive = true;
    const list = (paths || []).filter((x) => !/^https?:/.test(x));
    if (!list.length) return;
    supabase.storage.from("task-proofs").createSignedUrls(list, 3600).then(({ data, error }) => {
      if (!alive) return;
      if (error || !data) { setFailed(true); return; }
      setLinks(Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl])));
    });
    return () => { alive = false; };
  }, [key]);
  return (
    <>
      {failed && <p className="err">Couldn't load the photos. Pull to refresh and try again.</p>}
      <div className="pgrid">
        {(paths || []).map((x) => {
          const u = /^https?:/.test(x) ? x : links[x];
          return u ? (
            <a key={x} className="pthumb" href={u} target="_blank" rel="noreferrer" aria-label="Open photo">
              <img src={u} alt="Proof of finished work" loading="lazy" />
            </a>
          ) : <div key={x} className="pthumb" style={{ background: "var(--wash)" }} />;
        })}
      </div>
    </>
  );
}

function ProofPanel({ task, existing, userId, classId, onSubmit }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const filesRef = useRef(files); filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);
  const add = (list) => {
    const picked = [...list].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    setFiles((cur) => [...cur, ...picked.map((file) => ({ file, url: URL.createObjectURL(file), id: uid() }))].slice(0, MAX_PROOF));
  };
  const remove = (id) => setFiles((cur) => { const f = cur.find((x) => x.id === id); if (f) URL.revokeObjectURL(f.url); return cur.filter((x) => x.id !== id); });
  const send = async () => {
    setBusy(true); setErr("");
    try {
      const paths = [];
      for (let i = 0; i < files.length; i++) {
        // the random part makes every file name impossible to guess
        paths.push(await uploadProof(files[i].file, `${safePart(classId)}/${safePart(task.id)}/${safePart(userId)}/${randHex()}${randHex()}.jpg`));
      }
      await onSubmit(paths);
    } catch (e) {
      console.error("proof upload failed", e);
      setErr("The upload didn't go through. Check your connection and try again.");
      setBusy(false);
    }
  };
  return (
    <div>
      <h3 className="serif" style={{ fontSize: 22, fontWeight: 400, margin: "0 0 6px", lineHeight: 1.2 }}>{task.title}</h3>
      <p style={{ color: C.muted, margin: "0 0 16px", lineHeight: 1.5 }}>
        {existing ? "Choose new photos to replace the ones you sent." : "Add a photo of your finished work, then it counts as done."}
      </p>
      {existing && files.length === 0 && <ProofThumbs paths={proofPaths(existing)} />}
      <div className="pgrid">
        {files.map((f) => (
          <div className="pthumb" key={f.id}>
            <img src={f.url} alt="Selected photo" />
            <button className="x" aria-label="Remove photo" onClick={() => remove(f.id)} disabled={busy}><X size={14} /></button>
          </div>
        ))}
        {files.length < MAX_PROOF && (
          <label className="padd">
            <Camera size={22} />
            <span>{files.length ? "Add more" : "Take or choose photos"}</span>
            <input type="file" accept="image/*" multiple hidden disabled={busy}
              onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
        )}
      </div>
      {err && <p className="err">{err}</p>}
      <button className="btn accent full" disabled={!files.length || busy} onClick={send}>
        {busy ? "Uploading…" : existing ? "Replace photos" : "Upload and mark done"}
      </button>
      <p className="meta" style={{ margin: "12px 0 0", textAlign: "center" }}>Photos are shrunk before upload. Your admin can see them.</p>
    </div>
  );
}

function GroupsPanel({ groups, tasks, progress, subjects, defQuarter, onSave, onDelete }) {
  const [edit, setEdit] = useState(null); // null = list, {} = new, group = editing
  const [confirm, setConfirm] = useState(null);
  const [f, setF] = useState({ name: "", subject: "", quarter: defQuarter });
  const [newSubj, setNewSubj] = useState(false);
  const open = (g) => {
    setConfirm(null);
    setF(g ? { name: g.name, subject: g.subject, quarter: g.quarter } : { name: "", subject: "", quarter: defQuarter });
    setNewSubj(false);
    setEdit(g || {});
  };
  const save = () => { onSave({ ...(edit.id ? edit : {}), name: f.name.trim(), subject: f.subject.trim(), quarter: f.quarter }, !!edit.id); setEdit(null); };
  if (edit) {
    return (
      <div>
        <button className="back" onClick={() => setEdit(null)}><ChevronLeft size={16} />Back</button>
        <div className="field">
          <label htmlFor="gn">Group name</label>
          <input id="gn" className="input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Chapter 4: Linear equations" />
        </div>
        <div className="field">
          <label>Subject</label>
          <div className="chips" style={{ flexWrap: "wrap", overflow: "visible", padding: 0 }}>
            {subjects.map((x) => (
              <button key={x} className="chip" aria-pressed={f.subject === x && !newSubj} onClick={() => { setNewSubj(false); setF({ ...f, subject: x }); }}>
                <span className="dot" style={{ background: subjColor(x), margin: 0 }} />{x}
              </button>
            ))}
            <button className="chip" aria-pressed={newSubj} onClick={() => { setNewSubj(true); setF({ ...f, subject: "" }); }}><Plus size={14} /> New subject</button>
          </div>
          {newSubj && <input className="input" style={{ marginTop: 10 }} autoFocus value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="Subject name" />}
        </div>
        <div className="field">
          <label>Quarter</label>
          <Segmented value={String(f.quarter)} options={QUARTERS.map((q) => [String(q), `Q${q}`])} onChange={(v) => setF({ ...f, quarter: Number(v) })} />
        </div>
        <button className="btn accent full" disabled={!f.name.trim() || !f.subject.trim()} onClick={save}>{edit.id ? "Save changes" : "Create group"}</button>
      </div>
    );
  }
  const byQ = QUARTERS.map((q) => [q, groups.filter((g) => g.quarter === q).sort((a, b) => a.subject.localeCompare(b.subject) || a.name.localeCompare(b.name))]).filter(([, l]) => l.length);
  return (
    <div>
      <p style={{ color: C.muted, margin: "-6px 0 16px", lineHeight: 1.5 }}>
        A group holds the tasks for one topic in one subject and quarter, like "Math Q2: Chapter 4". Everyone in the class sees them.
      </p>
      <button className="btn accent full" onClick={() => open(null)}><Plus size={15} style={{ verticalAlign: -2, marginRight: 6 }} />New group</button>
      {byQ.length === 0 && <div className="empty"><div className="serif">No groups yet</div>Make one, then pick it when you add a task.</div>}
      {byQ.map(([q, list]) => (
        <section className="group" key={q}>
          <h3>Quarter {q}<small>{list.length}</small></h3>
          {list.map((g) => {
            const all = tasks.filter((t) => t.groupId === g.id);
            const done = all.filter((t) => progress[t.id] === "done").length;
            return (
              <div className="gcard" key={g.id} style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{g.name}</div>
                    <div className="meta"><span className="dot" style={{ background: subjColor(g.subject) }} />{g.subject}, {done} of {all.length} done</div>
                  </div>
                  <div style={{ display: "flex", flex: "none" }}>
                    <button className="iconBtn" aria-label="Edit group" onClick={() => open(g)}><Pencil size={16} /></button>
                    <button className="iconBtn" aria-label="Delete group" style={confirm === g.id ? { color: C.danger, width: "auto", padding: "0 10px", borderRadius: 18, fontSize: 13 } : undefined}
                      onClick={() => { if (confirm === g.id) { onDelete(g.id); setConfirm(null); } else setConfirm(g.id); }}>
                      {confirm === g.id ? "Tap again" : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
                <div className="gbar"><i style={{ width: `${all.length ? Math.round((done / all.length) * 100) : 0}%` }} /></div>
                {confirm === g.id && <p className="meta" style={{ margin: "6px 0 0" }}>Its tasks stay, they just lose the group.</p>}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/* Shown when someone clicks the link in the confirmation email. They sign in themselves afterwards. */
function Registered({ onGo }) {
  useEffect(() => { supabase.auth.signOut().catch(() => {}); }, []);
  return (
    <div className="regWrap">
      <div className="regMark"><Check size={26} strokeWidth={3} /></div>
      <h1 className="regH">Your account has been registered</h1>
      <p className="regP">Please log in with the email and password you registered with.</p>
      <button className="btn accent full" onClick={onGo}>Go to log in</button>
    </div>
  );
}

/* The first-run introduction: who Homeroom is for, what's in it, who made it. Each screen asks you to tap something. */
const WELCOME_FEATURES = [
  ["One list for the whole class", "Everyone adds, everyone sees. Nobody has to ask what's due."],
  ["Calendar and reminders", "Flip to the week view. Overdue and due-today tasks get flagged."],
  ["Share your notes", "Attach photos and files to a task so the class can study from them."],
  ["An assistant that knows what's due", "Ask it anything about your tasks. It's powered by AI, so double-check answers."],
];
const WELCOME_CHAT = {
  "What's due tomorrow?": "Tomorrow you have the quiz review and a reading check. The essay isn't due until Friday.",
  "Plan my evening": "Start with the quiz review, about 20 minutes. Then the reflection, about 15. The essay can wait until Friday.",
};
function Welcome({ user, classLabel, onDone }) {
  const [n, setN] = useState(0);
  const [stamped, setStamped] = useState(false);
  const [open, setOpen] = useState({});
  const [ask, setAsk] = useState(null);
  const [flying, setFlying] = useState(false);
  const timer = useRef(null);
  const where = classLabel || "your class";
  const allOpen = Object.keys(open).length === WELCOME_FEATURES.length;
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape" && !flying) onDone(false); };
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("keydown", k); clearTimeout(timer.current); };
  }, [onDone, flying]);
  const stamp = () => {
    if (stamped) return;
    setStamped(true); Sound.play("done");
    try { navigator.vibrate && navigator.vibrate([18, 40, 10]); } catch {}
  };
  const board = () => {
    setFlying(true); Sound.play("add");
    try { navigator.vibrate && navigator.vibrate(30); } catch {}
    timer.current = setTimeout(() => onDone(true), 2100);
  };
  const status = [stamped ? "Stamped. You're officially in." : "", allOpen ? "That's everything it does." : "", flying ? "" : ""][n];
  return (
    <div className="wel" role="dialog" aria-modal="true" aria-label="Introduction">
      <div className="welTop">
        <span className="welMark">Homeroom</span>
        {!flying && <button className="welLink" onClick={() => onDone(false)}>Skip</button>}
      </div>
      <div className="welMain" key={n}>
        {n === 0 && (<>
          <h1 className="welH">Made for you.</h1>
          <div className="pass" data-stamped={stamped ? 1 : 0}>
            <i className="tape" aria-hidden="true" />
            <div className="passRow"><span>Boarding pass</span><span>Homeroom</span></div>
            <div className="passMade">Homeroom is made by</div>
            <div className="passName">Nathaniel Visaya</div>
            <p className="passBody">Built for {where}, so nobody misses a deadline. Add what's due, share your notes, and look out for each other.</p>
            <div className="passGrid">
              <div><small>Passenger</small><b>{user}</b></div>
              <div><small>Class</small><b>{where}</b></div>
              <div><small>Status</small><b>{stamped ? "Checked in" : "Not checked in"}</b></div>
            </div>
            {stamped
              ? <div className="stampMark" aria-hidden="true"><span>Homeroom</span><b>{where}</b><span>Welcome in</span></div>
              : <div className="stampGhost" aria-hidden="true" />}
            {stamped && <div className="bits" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ "--a": i * 22.5 + "deg", "--d": 70 + (i * 29) % 50 + "px" }} />)}</div>}
          </div>
          <button className="stampBtn" onClick={stamp} disabled={stamped}>{stamped ? "Stamped" : "Stamp my pass"}</button>
        </>)}
        {n === 1 && (<>
          <h1 className="welH">Here's what it does.</h1>
          <p className="welSub">Open each one and give it a try.</p>
          <div className="feats">
            {WELCOME_FEATURES.map(([t, d], i) => (
              <div key={i} className="feat" data-open={open[i] ? 1 : 0}>
                <button className="featHead" aria-expanded={!!open[i]} onClick={() => { setOpen((x) => ({ ...x, [i]: 1 })); Sound.play("pop"); }}>
                  <span><b>{t}</b><small>{d}</small></span>
                  <span className="featDot">{open[i] && <Check size={12} strokeWidth={3} />}</span>
                </button>
                {i === 3 && open[3] && (
                  <div className="featBody">
                    <div className="askChips">
                      {Object.keys(WELCOME_CHAT).map((q) => <button key={q} data-on={ask === q ? 1 : 0} onClick={() => { setAsk(q); Sound.play("pop"); }}>{q}</button>)}
                    </div>
                    {ask && <><div className="askMe">{ask}</div><div className="askAi" key={ask}>{WELCOME_CHAT[ask]}</div></>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>)}
        {n === 2 && (<>
          <h1 className="welH">{flying ? `Welcome aboard, ${user}.` : "Ready for takeoff."}</h1>
          <p className="welSub">{flying ? "Taking you in now." : "Your pass is ready. A quick tour comes next, and you can skip it any time."}</p>
          <div className="ticket" data-fly={flying ? 1 : 0}>
            <div className="tkMain">
              <div className="passRow"><span>Boarding pass</span><span>Gate {where}</span></div>
              <div className="tkRoute"><b>Home</b><svg viewBox="0 0 60 12" aria-hidden="true"><path d="M0 6h54M48 1l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg><b>Homeroom</b></div>
              <div className="passGrid"><div><small>Passenger</small><b>{user}</b></div><div><small>Departs</small><b>Now</b></div></div>
            </div>
            <div className="tkStub"><i className="bars" aria-hidden="true" /><small>Admit one</small></div>
          </div>
          {flying && <svg className="plane" viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M62 32 40 24 26 4h-6l7 20-14 2-6-8H2l4 14-4 14h5l6-8 14 2-7 20h6l14-20 22-8z" /></svg>}
        </>)}
      </div>
      <div className="welFoot">
        <div className="welStatus">{status}</div>
        <div className="welDots" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} data-on={i === n ? 1 : 0} data-past={i < n ? 1 : 0} />)}</div>
        {n === 0 && <button className="welGo" disabled={!stamped} onClick={() => setN(1)}>Show me around</button>}
        {n === 1 && <button className="welGo" onClick={() => setN(2)}>Continue</button>}
        {n === 2 && <button className="welGo" disabled={flying} onClick={board}>{flying ? "Boarding" : "Board now"}</button>}
        {n > 0 && !flying && <button className="welLink" onClick={() => setN(n - 1)}>Back</button>}
      </div>
    </div>
  );
}

function DeleteAccount({ user, onClose, onDeleted }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("delete_my_account");
    if (error) { setBusy(false); setErr("Couldn't delete the account: " + error.message); return; }
    onDeleted();
  };
  return (
    <div>
      <p className="meta" style={{ marginTop: 0 }}>This permanently deletes your account and your saved progress. Tasks you added stay for the class. This can't be undone.</p>
      <div className="field">
        <label>Type your username ({user}) to confirm</label>
        <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </div>
      {err && <p className="meta" style={{ color: "var(--danger)" }}>{err}</p>}
      <button className="btn danger full" disabled={typed.trim() !== user || busy} onClick={go}>{busy ? "Deleting" : "Delete my account"}</button>
      <button className="btn ghost full" style={{ marginTop: 10 }} onClick={onClose}>Cancel</button>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [registered, setRegistered] = useState(CONFIRMED);
  const [welcome, setWelcome] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [recovering, setRecovering] = useState(() => /type=recovery/.test(window.location.hash));
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") setRecovering(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [comments, setComments] = useState([]);
  const [completions, setCompletions] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [weeklies, setWeeklies] = useState([]);
  const [proofs, setProofs] = useState({});
  const [groups, setGroups] = useState([]);
  const [proofFor, setProofFor] = useState(null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [classId, setClassId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [reviewStart, setReviewStart] = useState(null);
  const classRef = useRef(null); classRef.current = classId;
  const [progress, setProgress] = useState({});
  const [tab, setTab] = useState("tasks");
  const [ui, setUi] = useState({ view: "upcoming", subj: "All", mode: "list", kind: "All", group: "date", q: "All" });
  const [dismissedAnn, setDismissedAnn] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState(null);
  const [reviewFocus, setReviewFocus] = useState(null);
  const [menu, setMenu] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [syncErr, setSyncErr] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fbOpen, setFbOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [tour, setTour] = useState(false); // the hands-on welcome tour
  const [demo, setDemo] = useState("todo"); // status of the practice task (lives only in the tour)
  const tourUi = useRef(null); // the person's own list settings, put back when the tour ends
  const [theme, setTheme] = useState("auto");
  const [audio, setAudio] = useState({ sfx: true, music: false, vol: 0.5 });
  const [sysDark, setSysDark] = useState(() => (window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : false));
  const [isAdmin, setIsAdmin] = useState(false);
  const dark = theme === "dark" || (theme === "auto" && sysDark);
  const progressRef = useRef(progress); progressRef.current = progress;
  const tasksRef = useRef(tasks); tasksRef.current = tasks;
  const lastSync = useRef(0);
  const toastTimer = useRef(null);
  const backfilled = useRef(false);
  const bp = useBreakpoint();
  const timer = useFocusTimer();
  useSpotlight();
  const [navRef, navSlider] = useSlider(tab);
  const [tabsRef, tabsSlider] = useSlider(tab);
  const [swap, setSwap] = useState(false);
  const firstTheme = useRef(true);
  const [focusOpen, setFocusOpen] = useState(false);
  const [accent, setAccentState] = useState(() => { try { return localStorage.getItem("hr:accent") || "ocean"; } catch { return "ocean"; } });
  const setAccent = (k) => { setAccentState(k); try { localStorage.setItem("hr:accent", k); } catch { /* storage blocked */ } };
  const [activity, setActivity] = useState([]);
  useEffect(() => {
    if (firstTheme.current) { firstTheme.current = false; return; }
    setSwap(true);
    const id = setTimeout(() => setSwap(false), 600);
    return () => clearTimeout(id);
  }, [dark, accent]);
  useEffect(() => {
    if (!user) return;
    try { setActivity(JSON.parse(localStorage.getItem("hr:act:" + user) || "[]")); } catch { setActivity([]); }
  }, [user]);
  useEffect(() => {
    if (!user || !classId || tour) return;
    const h = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); setSearchOpen(true); }
      else if (e.key === "n" || e.key === "N") { e.preventDefault(); setForm({ mode: "add" }); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [user, classId, tour]);

  /* ----- loading ----- */

  const loadShared = async (u, c) => {
    const cid = c || classRef.current;
    setClasses(await store.classes.list());
    if (!cid) return;
    const k = (x) => `${cid}:${x}`;
    const [t, mats, cm, comp, ann, wk, pr, gr] = await Promise.all([
      store.get(k("tasks"), true), store.get(k("materials"), true), store.get(k("comments"), true),
      store.get(k("completions"), true), store.get(k("announcements"), true), store.get(k("weeklies"), true),
      store.get(k("proofs"), true), store.get(k("groups"), true),
    ]);
    setTasks(t || []); setMaterials(mats || []); setComments(cm || []); setCompletions(comp || {}); setAnnouncements(ann || []); setWeeklies(wk || []);
    setProofs(pr || {}); setGroups(gr || []);
  };

  const refresh = useCallback(async (force = false) => {
    if (!user) return;
    if (!force && Date.now() - lastSync.current < 8000) return;
    lastSync.current = Date.now();
    setSyncing(true);
    try { await loadShared(user); } finally { setSyncing(false); }
  }, [user]);

  useEffect(() => {
    (async () => {
      const [th, au] = await Promise.all([store.get("theme"), store.get("audio")]);
      if (th) setTheme(th);
      if (au) setAudio((a) => ({ ...a, ...au }));
      const { data: { session } } = await supabase.auth.getSession();
      const prof = session && !CONFIRMED ? await loadProfile(session.user.id) : null;
      if (!prof) { setReady(true); return; }
      const u = prof.username;
      setUser(u); setIsAdmin(!!prof.is_admin);
      const [prog, cache, pf] = await Promise.all([store.get(`u:${u}:progress`, true), store.get(`cache:${u}`), store.get(`prefs:${u}`)]);
      const cid = prof.class_id || null;
      classRef.current = cid; setClassId(cid);
      setProgress(prog || {});
      if (pf) {
        if (pf.ui) setUi((x) => ({ ...x, ...pf.ui }));
        if (pf.dismissedAnn) setDismissedAnn(pf.dismissedAnn);
        if (pf.tab && ["tasks", "review", "ask"].includes(pf.tab)) setTab(pf.tab);
      }
      if (cache && cid) {
        // Instant open: show what we had last time, then quietly catch up.
        setTasks(cache.tasks || []); setMaterials(cache.materials || []); setComments(cache.comments || []);
        setCompletions(cache.completions || {}); setAnnouncements(cache.announcements || []); setWeeklies(cache.weeklies || []);
        setProofs(cache.proofs || {}); setGroups(cache.groups || []);
        setReady(true);
        lastSync.current = Date.now(); setSyncing(true);
        try { await loadShared(u); } finally { setSyncing(false); }
      } else {
        await Promise.all([loadShared(u), new Promise((r) => setTimeout(r, 900))]);
        lastSync.current = Date.now();
        setReady(true);
      }
    })();
  }, []);

  // Sync when the app is opened or comes back to the front, not on a timer.
  useEffect(() => {
    if (!user) return;
    const onVis = () => {
      if (document.visibilityState === "visible") { Sound.resume(); refresh(); } else Sound.pause();
    };
    const onFocus = () => refresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onFocus); };
  }, [user, refresh]);

  /* ----- remember things ----- */

  useEffect(() => {
    if (!user || !ready) return;
    store.set(`prefs:${user}`, { tab, ui, dismissedAnn });
  }, [tab, ui, dismissedAnn, user, ready]);

  useEffect(() => {
    if (!user || !ready) return;
    const id = setTimeout(() => store.set(`cache:${user}`, { tasks, materials, comments, completions, announcements, weeklies, proofs, groups }), 900);
    return () => clearTimeout(id);
  }, [tasks, materials, comments, completions, announcements, weeklies, proofs, groups, user, ready]);

  useEffect(() => { store.set("theme", theme); }, [theme]);
  useEffect(() => { store.set("audio", audio); Sound.setSfx(audio.sfx); Sound.setVolume(audio.vol); }, [audio]);

  /* ----- theme + music ----- */

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = (e) => setSysDark(e.matches);
    mq.addEventListener && mq.addEventListener("change", h);
    return () => mq.removeEventListener && mq.removeEventListener("change", h);
  }, []);

  useEffect(() => { document.body.style.background = dark ? "#151412" : "#F6F4EE"; }, [dark]);

  useEffect(() => {
    // Browsers only allow sound after a tap, so a saved "music on" starts on your first touch.
    if (!audio.music || !ready) return;
    const go = () => { if (!Sound.isMusic()) Sound.startMusic(); };
    window.addEventListener("pointerdown", go, { once: true });
    return () => window.removeEventListener("pointerdown", go);
  }, [audio.music, ready]);

  useEffect(() => () => Sound.stopMusic(), []);

  const toggleMusic = () => {
    const on = !audio.music;
    setAudio((a) => ({ ...a, music: on }));
    if (on) Sound.startMusic(); else Sound.stopMusic();
  };

  /* ----- toast ----- */

  const showToast = (msg, undo) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, undo, id: uid() });
    toastTimer.current = setTimeout(() => setToast(null), 5200);
  };

  /* ----- auth ----- */

  const chooseClass = async (cid) => {
    await supabase.from("profiles").update({ class_id: cid }).eq("username", user);
    store.del(`cache:${user}`);
    classRef.current = cid; setClassId(cid);
    setTasks([]); setMaterials([]); setComments([]); setCompletions({}); setAnnouncements([]); setWeeklies([]); setProofs({}); setGroups([]);
    backfilled.current = false;
    setSyncing(true);
    try { await loadShared(user, cid); } finally { setSyncing(false); }
  };

  const onAuthed = async (u, cid, admin) => {
    setReady(false);
    classRef.current = cid || null; setClassId(cid || null);
    setUser(u); setIsAdmin(!!admin);
    setProgress((await store.get(`u:${u}:progress`, true)) || {});
    await Promise.all([loadShared(u), new Promise((r) => setTimeout(r, 900))]);
    lastSync.current = Date.now();
    // show the welcome tour once, only for brand-new accounts
    const seenIntro = await store.get(`intro:${u}`);
    if (!seenIntro && !admin) { setTab("tasks"); setWelcome(true); }
    setReady(true);
  };

  // the tour is marked as seen so it only starts by itself once per account; it can be replayed from the account menu
  const finishWelcome = async (startTour) => {
    setWelcome(false);
    if (user) await store.set(`intro:${user}`, true);
    if (startTour) setTour(true);
  };
  const afterDelete = () => {
    try { Object.keys(localStorage).filter((k) => k.startsWith(LS) && k.includes(`:${user}`)).forEach((k) => localStorage.removeItem(k)); sessionStorage.setItem("hr:notice", "Your account has been deleted."); } catch {}
    supabase.auth.signOut().catch(() => {});
    setDelOpen(false); signOut();
  };
  const finishTour = async () => {
    setTour(false); setDemo("todo");
    setDetailId(null); setForm(null); setSearchOpen(false);
    if (tourUi.current) { setUi(tourUi.current); tourUi.current = null; }
    if (user) await store.set(`intro:${user}`, true);
    Sound.play("add");
  };
  useEffect(() => { if (tour && !tourUi.current) tourUi.current = ui; }, [tour]);
  const tourGo = (s = {}) => {
    setTab(s.tab || "tasks");
    setDetailId(s.detail ? DEMO_ID : null);
    setForm(s.form ? { mode: "add" } : null);
    setSearchOpen(!!s.search);
    setMenu(false); setFocusOpen(false); setPlanOpen(false); setGroupsOpen(false);
    setUi((u) => ({ ...u, view: "upcoming", subj: "All", kind: "All", group: "date", q: "All", mode: s.mode || "list" }));
    if (s.demo) setDemo(s.demo);
  };

  const signOut = async () => {
    await supabase.auth.signOut(); setIsAdmin(false);
    Sound.stopMusic();
    setUser(null); setMenu(false); setTab("tasks"); setTour(false);
    setTasks([]); setMaterials([]); setComments([]); setCompletions({}); setAnnouncements([]); setWeeklies([]); setProofs({}); setGroups([]);
    backfilled.current = false;
  };

  /* ----- data changes: update the screen first, save right after ----- */

  const mutate = async (key, setter, fn, empty = []) => {
    setter((c) => fn(c));
    const fk = ["tasks", "materials", "comments", "completions", "announcements", "weeklies", "proofs", "groups"].includes(key) ? `${classRef.current}:${key}` : key;
    const ok = await store.update(fk, fn, empty);
    setSyncErr(!ok);
  };

  const addGroup = (g) => mutate("groups", setGroups, (c) => [...c, g]);
  const updateGroup = (g) => mutate("groups", setGroups, (c) => c.map((x) => (x.id === g.id ? g : x)));
  const deleteGroup = (id) => {
    mutate("groups", setGroups, (c) => c.filter((x) => x.id !== id));
    mutate("tasks", setTasks, (c) => c.map((t) => (t.groupId === id ? { ...t, groupId: null } : t)));
    Sound.play("rip");
  };
  const saveGroup = (g, isEdit) => {
    if (isEdit) {
      updateGroup(g);
      // keep its tasks in step if the subject or quarter changed
      mutate("tasks", setTasks, (c) => c.map((t) => (t.groupId === g.id ? { ...t, subject: g.subject, quarter: g.quarter } : t)));
    } else addGroup({ ...g, id: uid(), createdBy: user, createdAt: Date.now() });
    Sound.play("add");
  };
  const submitProof = async (task, paths) => {
    const old = proofPaths(proofs[task.id]?.[user]).filter((x) => !/^https?:/.test(x));
    await mutate("proofs", setProofs, (c) => ({ ...c, [task.id]: { ...(c[task.id] || {}), [user]: { paths, at: Date.now(), state: "sent" } } }), {});
    if (old.length) supabase.storage.from("task-proofs").remove(old).catch(() => {}); // best effort: tidy up the replaced photos
    if ((progressRef.current[task.id] || "todo") !== "done") setStatus(task.id, "done");
    setProofFor(null);
    Sound.play("stamp");
    showToast("Photo sent to your admin");
  };
  const reviewProof = (taskId, owner, state) =>
    mutate("proofs", setProofs, (c) => ({ ...c, [taskId]: { ...(c[taskId] || {}), [owner]: { ...((c[taskId] || {})[owner] || {}), state } } }), {});
  const addTask = (t) => mutate("tasks", setTasks, (c) => [...c, t]);
  const updateTask = (t) => mutate("tasks", setTasks, (c) => c.map((x) => (x.id === t.id ? t : x)));
  const deleteTask = (id) => {
    // Notes and uploads stay in the Library even after the task is gone.
    const task = tasks.find((t) => t.id === id);
    mutate("tasks", setTasks, (c) => c.filter((x) => x.id !== id));
    Sound.play("rip");
    if (task) showToast("Task deleted", () => addTask(task));
  };
  const saveWeekly = (weekStart, text) =>
    mutate("weeklies", setWeeklies, (c) => [...c.filter((w) => w.weekStart !== weekStart), { id: uid(), weekStart, text, by: user, at: Date.now() }]);
  const addMaterial = (m) => mutate("materials", setMaterials, (c) => [...c, m]);
  const removeMaterial = (id) => {
    const m = materials.find((x) => x.id === id);
    mutate("materials", setMaterials, (c) => c.filter((x) => x.id !== id));
    Sound.play("rip");
    if (m) showToast("Material removed", () => addMaterial(m));
  };
  const addComment = (taskId, text) => {
    Sound.play("send");
    mutate("comments", setComments, (c) => [...c, { id: uid(), taskId, by: user, text, at: Date.now() }]);
  };
  const removeComment = (id) => mutate("comments", setComments, (c) => c.filter((x) => x.id !== id));
  const postAnn = (text) => { Sound.play("add"); mutate("announcements", setAnnouncements, (c) => [...c, { id: uid(), text, at: Date.now(), by: user }]); };
  const removeAnn = (id) => mutate("announcements", setAnnouncements, (c) => c.filter((x) => x.id !== id));
  const dismissAnn = (id) => { Sound.play("tap"); setDismissedAnn((d) => [...d, id]); };
  const logActivity = () => {
    const d = todayISO();
    setActivity((a) => {
      if (a.includes(d)) return a;
      const n = [...a, d].slice(-120);
      try { localStorage.setItem("hr:act:" + user, JSON.stringify(n)); } catch { /* storage blocked */ }
      return n;
    });
  };
  const markCompletion = (id, done) =>
    mutate("completions", setCompletions, (c) => {
      const set = new Set(c[id] || []);
      if (done) set.add(user); else set.delete(user);
      return { ...c, [id]: [...set] };
    }, {});

  // Make sure tasks finished before this feature existed still count toward "N finished".
  useEffect(() => {
    if (!user || !ready || backfilled.current || !tasks.length) return;
    backfilled.current = true;
    const missing = tasks.filter((t) => progress[t.id] === "done" && !(completions[t.id] || []).includes(user));
    if (missing.length) {
      mutate("completions", setCompletions, (c) => {
        const n = { ...c };
        missing.forEach((t) => { n[t.id] = [...new Set([...(n[t.id] || []), user])]; });
        return n;
      }, {});
    }
  }, [ready, user, tasks.length]);

  /* ----- suggestions ----- */

  const pushInbox = async (item) => {
    await supabase.from("feedback").insert({ type: item.type, from_user: item.from, text: item.text });
  };
  const sendFeedback = (type, text) => pushInbox({ type, from: user, text });

  /* ----- progress ----- */

  const setStatus = (id, s) => {
    if (id === DEMO_ID) { // the tour's practice task is never saved
      if (s !== demo) { setDemo(s); Sound.play(s === "done" ? "done" : s === "progress" ? "pop" : "undo"); }
      return;
    }
    const cur = progressRef.current;
    const prev = cur[id] || "todo";
    if (prev === s) return;
    const next = { ...cur, [id]: s };
    progressRef.current = next;
    setProgress(next);
    Sound.play(s === "done" ? "done" : s === "progress" ? "pop" : "undo");
    if (s === "done" && navigator.vibrate) navigator.vibrate([8, 50, 16]);
    store.set(`u:${user}:progress`, next, true);
    if (s === "done" || prev === "done") markCompletion(id, s === "done");
    if (s === "done") logActivity();
    if (s === "done") {
      const today = tasksRef.current.filter((t) => t.deadline === todayISO());
      const clear = today.length > 1 && today.every((t) => next[t.id] === "done");
      if (clear) setTimeout(() => Sound.play("schoolbell"), 450);
      showToast(clear ? "That's everything due today. School's out!" : "Marked done", () => setStatus(id, prev));
    }
  };

  // Marking something done asks for a photo first, unless it's a quiz, study session or exam.
  const requestStatus = (id, s) => {
    const t = tasksRef.current.find((x) => x.id === id);
    if (s === "done" && t && wantsProof(t) && !proofs[id]?.[user]) { setProofFor(id); return; }
    setStatus(id, s);
  };

  const subjects = useMemo(() => [...new Set([...DEFAULT_SUBJECTS, ...tasks.map((t) => t.subject), ...groups.map((g) => g.subject)])], [tasks, groups]);
  const groupById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])), [groups]);
  const defQuarter = ui.q && ui.q !== "All" ? Number(ui.q) : (tasks.length ? tasks[tasks.length - 1].quarter || 1 : 1);
  const proofTask = tasks.find((t) => t.id === proofFor);
  const demoTask = useMemo(makeDemoTask, []);
  const viewTasks = useMemo(() => (tour ? [demoTask, ...tasks] : tasks), [tour, tasks, demoTask]);
  const viewProgress = tour ? { ...progress, [DEMO_ID]: demo } : progress;
  const tourCtx = { tab, detail: detailId === DEMO_ID, form: !!form, mode: ui.mode, search: searchOpen, demo };
  const detail = viewTasks.find((t) => t.id === detailId);
  const doneCount = tasks.filter((t) => progress[t.id] === "done").length;
  const themeAttr = dark ? "dark" : "light";
  const accentStyle = { "--accent": (ACCENTS[accent] || ACCENTS.ocean)[dark ? 1 : 0] };
  const streak = calcStreak(activity);

  if (registered) {
    const go = () => { window.history.replaceState(null, "", window.location.pathname); setRegistered(false); };
    return <div className="hr solo" data-theme={themeAttr} style={accentStyle}><style>{CSS}</style><AuthShell><Registered onGo={go} /></AuthShell></div>;
  }
  if (!ready) {
    return <div className="hr solo" data-theme={themeAttr} style={accentStyle}><style>{CSS}</style><Backdrop /><Splash /></div>;
  }
  if (recovering) {
    const done = () => { window.history.replaceState(null, "", window.location.pathname); setRecovering(false); };
    return <div className="hr solo" data-theme={themeAttr} style={accentStyle}><style>{CSS}</style><AuthShell><ResetPassword onDone={done} /></AuthShell></div>;
  }
  if (!user) {
    return <div className="hr solo" data-theme={themeAttr} style={accentStyle}><style>{CSS}</style><AuthShell><BoxGate><Auth onAuthed={onAuthed} /></BoxGate></AuthShell></div>;
  }
  if (isAdmin) {
    return <AdminApp themeAttr={themeAttr} accentStyle={accentStyle} theme={theme} setTheme={setTheme} onSignOut={signOut} />;
  }
  if (!classId) {
    return <div className="hr solo" data-theme={themeAttr} style={accentStyle}><style>{CSS}</style><AuthShell><ClassGate classes={classes} setClasses={setClasses} onChoose={chooseClass} /></AuthShell></div>;
  }
  const classLabel = classes.find((c) => c.id === classId)?.label;
  const tabs = [
    ["tasks", "Tasks", ListChecks],
    ["review", "Review", BookOpen],
    ["ask", "Ask", MessageCircle],
  ];
  const isDemo = detail?.id === DEMO_ID;
  const finishedOthers = detail ? (completions[detail.id] || []).filter((u) => u !== user).length : 0;

  const detailBody = detail && (
          <div>
            <h3 className="serif" style={{ fontSize: 26, fontWeight: 400, margin: "0 0 8px", lineHeight: 1.2 }}>{detail.title}</h3>
            <div className="rowMeta" style={{ fontSize: 14 }}>
              <span><span className="dot" style={{ background: subjColor(detail.subject) }} />{detail.subject}</span>
              <span>{detail.type}</span>
              <span style={{ color: detail.priority === "High" ? C.accent : C.muted }}>{detail.priority} priority</span>
            </div>
            <p style={{ margin: "18px 0 4px", fontWeight: 500 }} className={diffDays(detail.deadline) < 0 && progress[detail.id] !== "done" ? "late" : ""}>
              Due {relLabel(detail.deadline)}, {fmtDate(detail.deadline)}
            </p>
            <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
              Added by {detail.addedBy === "sample" ? "your class" : detail.addedBy}
              {finishedOthers > 0 ? `. ${finishedOthers} classmate${finishedOthers > 1 ? "s have" : " has"} finished this.` : ". Nobody else has finished this yet."}
            </p>
            {detail.notes && <p style={{ margin: "18px 0 0", lineHeight: 1.55 }}>{detail.notes}</p>}
            {(detail.quarter || groupById[detail.groupId]) && (
              <p style={{ color: C.muted, fontSize: 13, margin: "6px 0 0" }}>
                {detail.quarter ? `Quarter ${detail.quarter}` : ""}{detail.quarter && groupById[detail.groupId] ? ", " : ""}{groupById[detail.groupId] ? `group: ${groupById[detail.groupId].name}` : ""}
              </p>
            )}
            {wantsProof(detail) && (() => {
              const mine = proofs[detail.id]?.[user];
              return (
                <div style={{ margin: "20px 0 0" }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Photo proof</div>
                  {mine ? (
                    <>
                      <ProofThumbs paths={proofPaths(mine)} />
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span className="pill" data-s={mine.state}>
                          {mine.state === "ok" ? <><BadgeCheck size={13} />Verified by your admin</> : mine.state === "redo" ? <><RotateCcw size={13} />Your admin asked for a new photo</> : "Sent, waiting for review"}
                        </span>
                        <button className="btn ghost small" onClick={() => setProofFor(detail.id)}>Replace photos</button>
                      </div>
                    </>
                  ) : (
                    <p style={{ margin: 0, color: C.muted, fontSize: 14, lineHeight: 1.5 }}>You'll add a photo of your finished work when you mark this done.</p>
                  )}
                </div>
              );
            })()}
            <div style={{ margin: "22px 0 10px", fontSize: 13, color: C.muted }}>Your progress</div>
            <Segmented tour="detail-status" value={viewProgress[detail.id] || "todo"} options={STATUSES} onChange={(s) => requestStatus(detail.id, s)} />
            {isDemo && <p className="meta" style={{ margin: "22px 0 0" }}>This is a practice task. It isn't saved, and only you can see it.</p>}
            {!isDemo && <>
            <div style={{ display: "flex", gap: 10, marginTop: 26, flexWrap: "wrap" }}>
              <button className="btn accent" onClick={() => { setReviewFocus(detail.id); setTab("review"); setDetailId(null); }}>Review this</button>
              <button className="btn ghost" onClick={() => { setForm({ mode: "edit", task: detail }); setDetailId(null); }}><Pencil size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Edit</button>
              <button className="btn ghost" style={{ color: C.danger }} onClick={() => { if (confirmDel) { deleteTask(detail.id); setDetailId(null); } else setConfirmDel(true); }}>
                <Trash2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{confirmDel ? "Tap again to delete" : "Delete"}
              </button>
            </div>
            {confirmDel && <p style={{ fontSize: 13, color: C.muted, marginTop: 12 }}>This removes it for the whole class. Its notes stay in the Library, and you can undo right after.</p>}
            <Comments taskId={detail.id} comments={comments} user={user} isAdmin={isAdmin} onAdd={addComment} onRemove={removeComment} />
            </>}
          </div>
  );

  return (
    <div className={swap ? "hr app swap" : "hr app"} data-theme={themeAttr} data-wide={tab === "tasks" && ui.mode === "board" && !detail ? 1 : 0} style={accentStyle}>
      <style>{CSS}</style>
      <Backdrop />
      {syncing && <div className="sync" aria-hidden="true" />}
      <nav className="rail" aria-label="Main" ref={navRef}>
        {navSlider}
        <div className="railLogo"><span className="mark logoFull">Homeroom</span><span className="mark logoMini">H</span></div>
        {tabs.map(([k, l, Icon]) => (
          <button key={k} className="nav" data-tour={`tab-${k}`} aria-current={tab === k ? "page" : undefined} onClick={() => { if (tab !== k) Sound.play("tap"); setTab(k); }}>
            <Icon size={21} /><span>{l}</span>
          </button>
        ))}
        <div className="railSpacer" />
        <button className="nav acct" onClick={() => { Sound.play("tap"); setMenu(true); }} aria-label="Account">
          <span className="avatar">{user[0].toUpperCase()}</span><span>{user}</span>
        </button>
      </nav>
      <div className="main">
        <header className="head">
          <span className="headL">
            <span className="mark phoneOnly">Homeroom</span>
            {classLabel && <span className="classChip">{classLabel}</span>}
          </span>
          <div className="hdrRight">
            <button className="searchPill" data-tour="search" onClick={() => { Sound.play("tap"); setSearchOpen(true); }}>
              <Search size={16} /><span>Search tasks and notes</span><kbd className="kbd">Ctrl K</kbd>
            </button>
            <button className="hdrBtn searchBtn" data-tour="search" aria-label="Search" onClick={() => { Sound.play("tap"); setSearchOpen(true); }}><Search size={17} /></button>
            <button className="hdrBtn" aria-label={audio.music ? "Turn music off" : "Turn music on"} aria-pressed={audio.music}
              style={audio.music ? { color: "var(--accent)", borderColor: "var(--accent)" } : undefined} onClick={toggleMusic}><Music size={17} /></button>
            <button className="btn accent small newBtn" data-tour="new-task" onClick={() => { Sound.play("tap"); setForm({ mode: "add" }); }}><Plus size={16} />New task</button>
            <button className="avatar phoneOnly" onClick={() => { Sound.play("tap"); setMenu(true); }} aria-label="Account">{user[0].toUpperCase()}</button>
          </div>
        </header>
        {syncErr && <div style={{ background: "var(--errbg)", color: C.danger, fontSize: 13, padding: "8px 20px" }}>Your last change may not have saved. Check your connection.</div>}
        <div className="page" key={tab}>
          {tab === "tasks" && (
            <TasksTab user={user} tasks={viewTasks} progress={viewProgress} completions={completions}
              announcements={announcements.filter((a) => !dismissedAnn.includes(a.id))} dismissAnn={dismissAnn}
              weeklies={weeklies} onOpenWeekly={(ws) => { setReviewStart({ section: "weekly", ws }); setTab("review"); }}
              setStatus={requestStatus} classGroups={groups} proofs={proofs} openGroups={() => setGroupsOpen(true)}
              bp={bp} selectedId={detailId} streak={streak} openFocus={() => setFocusOpen(true)}
              openTask={(id) => { setDetailId(id); setConfirmDel(false); }}
              editTask={(id) => { const t = tasks.find((x) => x.id === id); if (t) setForm({ mode: "edit", task: t }); }}
              ui={ui} setUi={setUi} loading={syncing} onRefresh={() => refresh(true)} onPlan={() => setPlanOpen(true)} />
          )}
          {tab === "review" && (
            <ReviewTab tasks={tasks} progress={progress} materials={materials} weeklies={weeklies} saveWeekly={saveWeekly} reviewStart={reviewStart} clearStart={() => setReviewStart(null)} user={user} addMaterial={addMaterial}
              removeMaterial={removeMaterial} focusId={reviewFocus} clearFocus={() => setReviewFocus(null)} onRefresh={() => refresh(true)} />
          )}
          {tab === "ask" && <AskTab user={user} tasks={tasks} materials={materials} progress={progress} addTask={(t) => { Sound.play("add"); addTask({ quarter: defQuarter, ...t }); }} />}
        </div>
        {tab === "tasks" && (
          <button className="fab" data-tour="new-task" aria-label="Add a task" onClick={() => { Sound.play("tap"); setForm({ mode: "add" }); }}><Plus size={26} /></button>
        )}
        {toast && (
          <div className="toast" role="status" key={toast.id}>
            <span>{toast.msg}</span>
            {toast.undo && <button onClick={() => { const u = toast.undo; setToast(null); u(); }}>Undo</button>}
            {toast.undo && <i className="toastBar" aria-hidden="true" />}
          </div>
        )}
        <nav className="tabs" aria-label="Main" ref={tabsRef}>
          {tabsSlider}
          {tabs.map(([k, l, Icon]) => (
            <button key={k} className="tab" data-tour={`tab-${k}`} aria-current={tab === k ? "page" : undefined} onClick={() => { if (tab !== k) Sound.play("tap"); setTab(k); }}>
              <Icon size={21} />{l}
            </button>
          ))}
        </nav>
      </div>
      <aside className="side" aria-label="Details">
        {detail ? (
          <div className="inspector" key={detail.id}>
            <div className="inspHead">
              <span className="meta">Task details</span>
              <button className="iconBtn" onClick={() => setDetailId(null)} aria-label="Close details"><X size={18} /></button>
            </div>
            {detailBody}
          </div>
        ) : (
          <SideToday tasks={viewTasks} progress={viewProgress} openTask={(id) => { setDetailId(id); setConfirmDel(false); }} timer={timer} />
        )}
      </aside>
      <Sheet open={!!detail && bp !== "desktop"} onClose={() => setDetailId(null)} title="Task">
        {detailBody}
      </Sheet>
      <Sheet open={focusOpen && bp !== "desktop"} onClose={() => setFocusOpen(false)} title="Focus">
        <FocusCard timer={timer} />
      </Sheet>
      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.mode === "edit" ? "Edit task" : "Add to the class"}>
        {form && (
          <>
            {form.mode === "add" && <p style={{ color: C.muted, margin: "-6px 0 18px", fontSize: 14 }}>Everyone in the class will see this.</p>}
            <TaskForm
              initial={form.mode === "edit" ? form.task : null}
              subjects={subjects}
              groups={groups}
              defQuarter={defQuarter}
              onCancel={() => setForm(null)}
              onSave={(f, ng) => {
                let gid = f.groupId || null;
                if (ng) {
                  gid = uid();
                  addGroup({ id: gid, name: ng.name, subject: f.subject, quarter: f.quarter, createdBy: user, createdAt: Date.now() });
                }
                const body = { ...f, groupId: gid };
                if (form.mode === "edit") updateTask({ ...form.task, ...body });
                else addTask({ ...body, id: uid(), addedBy: user, createdAt: Date.now() });
                Sound.play("add");
                setForm(null);
              }}
            />
          </>
        )}
      </Sheet>
      <Sheet open={!!proofTask} onClose={() => setProofFor(null)} title="Show your work">
        {proofTask && <ProofPanel task={proofTask} existing={proofs[proofTask.id]?.[user]} userId={user} classId={classId} onSubmit={(paths) => submitProof(proofTask, paths)} />}
      </Sheet>
      <Sheet open={groupsOpen} onClose={() => setGroupsOpen(false)} title="Groups">
        {groupsOpen && <GroupsPanel groups={groups} tasks={tasks} progress={progress} subjects={subjects} defQuarter={defQuarter} onSave={saveGroup} onDelete={deleteGroup} />}
      </Sheet>
      <Sheet open={planOpen} onClose={() => setPlanOpen(false)} title="Plan my evening">
        {planOpen && <PlanPanel tasks={tasks} progress={progress} />}
      </Sheet>
      <Sheet open={searchOpen} onClose={() => setSearchOpen(false)} title="Search">
        {searchOpen && (
          <SearchPanel tasks={tasks} materials={materials}
            onTask={(id) => { setSearchOpen(false); setConfirmDel(false); setDetailId(id); }}
            onMaterial={(m) => { setSearchOpen(false); setReviewFocus(m.taskId); setTab("review"); }} />
        )}
      </Sheet>
      <Sheet open={menu} onClose={() => setMenu(false)} title="Account">
        <p style={{ margin: "0 0 20px", color: C.muted }}>
          Signed in as <b style={{ color: C.ink }}>{user}</b>{isAdmin && <span className="tag">Admin</span>}
        </p>
        <div className="field">
          <label>Appearance</label>
          <Segmented value={theme} onChange={setTheme} options={[["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]]} />
        </div>
        <div className="field">
          <label>Accent colour</label>
          <div className="swatches">
            {Object.entries(ACCENTS).map(([k, v]) => (
              <button key={k} className="sw" aria-label={k} aria-pressed={accent === k} style={{ background: v[0], color: v[0] }} onClick={() => { Sound.play("pop"); setAccent(k); }} />
            ))}
          </div>
        </div>
        {bp !== "phone" && <p className="meta" style={{ margin: "-4px 0 18px" }}>Shortcuts: <kbd className="kbd">N</kbd> new task, <kbd className="kbd">/</kbd> search.</p>}
        <div className="field">
          <label>Sound effects</label>
          <Segmented value={audio.sfx ? "on" : "off"} onChange={(v) => { setAudio((a) => ({ ...a, sfx: v === "on" })); if (v === "on") { Sound.setSfx(true); Sound.play("pop"); } }} options={[["on", "On"], ["off", "Off"]]} />
        </div>
        <div className="field">
          <label>Music</label>
          <Segmented value={audio.music ? "on" : "off"} onChange={(v) => { if ((v === "on") !== audio.music) toggleMusic(); }} options={[["on", "On"], ["off", "Off"]]} />
          <input type="range" min="0" max="1" step="0.05" value={audio.vol} aria-label="Music volume"
            onChange={(e) => { const v = Number(e.target.value); setAudio((a) => ({ ...a, vol: v })); Sound.setVolume(v); }}
            style={{ width: "100%", marginTop: 14, accentColor: "var(--accent)" }} />
        </div>
        <button className="btn ghost full" style={{ marginBottom: 10 }} onClick={() => { setMenu(false); setWelcome(true); }}>
          Play introduction
        </button>
        <button className="btn ghost full" style={{ marginBottom: 10 }} onClick={() => { setMenu(false); classRef.current = null; setClassId(null); }}>
          Class {classLabel}, change
        </button>
        <button className="btn ghost full" style={{ marginBottom: 10 }} onClick={() => { setMenu(false); setFbOpen(true); }}>
          Send a suggestion or report a problem
        </button>
        <button className="btn ghost full" onClick={signOut}>Sign out</button>
        <button className="btn ghost full" style={{ marginTop: 10, color: "var(--danger)" }} onClick={() => { setMenu(false); setDelOpen(true); }}>Delete account</button>
      </Sheet>
      <Sheet open={delOpen} onClose={() => setDelOpen(false)} title="Delete account">
        {delOpen && <DeleteAccount user={user} onClose={() => setDelOpen(false)} onDeleted={afterDelete} />}
      </Sheet>
      <Sheet open={fbOpen} onClose={() => setFbOpen(false)} title="Send a suggestion">
        {fbOpen && <FeedbackForm onSend={sendFeedback} onClose={() => setFbOpen(false)} />}
      </Sheet>
      {welcome && <Welcome user={user} classLabel={classLabel} onDone={finishWelcome} />}
      {tour && <Tour user={user} bp={bp} ctx={tourCtx} go={tourGo} onDone={finishTour} />}
    </div>
  );
}