import { supabase } from "./supabaseClient";
import { MINECRAFT } from "./minecraft.config.js";
import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import {
  Plus, Check, X, ChevronLeft, ChevronRight, ArrowUp, Upload, Sparkles, Trash2,
  BookOpen, ListChecks, MessageCircle, Pencil, ChevronDown, CalendarDays,
  List as ListIcon, Gamepad2, Copy, Search, Music,
  Camera, FolderPlus, Folder, BadgeCheck, RotateCcw, Flame, Timer, Play, Pause, Columns3, SlidersHorizontal,
  Lightbulb, CircleAlert, LogOut, Sun, Moon, Hourglass, Target, Inbox, Plane,
  CheckCheck, GraduationCap,
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
// Subjects your class adds (with the colour they picked) are copied in here, so subjColor() works everywhere.
const SUBJ_REG = { ...SUBJ };
const subjColor = (s) =>
  SUBJ_REG[s] || PAL[[...(s || "x")].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];
const SWATCHES = ["#5A7FA8", "#5F8B6D", "#B38A2E", "#C4623F", "#8B6B86", "#4F8A8B", "#B5586B", "#7A8F3E", "#6E7FA3", "#8A877A", "#3F6E8C", "#9A7B4F"];

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
  list.slice(0, 3).map((t) => t.title).join(", ") + (list.length > 3 ? ` and ${list.length - 3} more` : "");

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
      let r = await supabase.from("classes").select("id,year,name,label,quarter").order("label");
      if (r.error) r = await supabase.from("classes").select("id,year,name,label").order("label"); // database not upgraded to v8 yet: still show the classes
      return r.data || [];
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

/* ───────────────────────── AI: Gemini first, Groq as the backup (keys live on the server) ───────────────────────── */

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

function buildContext(tasks, materials, progress, user, kb) {
  const list = tasks
    .map((t) => `[${t.id}] ${t.title} | subject: ${t.subject} | type: ${t.type} | priority: ${t.priority} | due ${t.deadline} (${parse(t.deadline).toLocaleDateString("en-US", { weekday: "long" })}) | ${user}'s status: ${statusLabel(progress[t.id])} | notes: ${t.notes || "none"} | added by ${t.addedBy}`)
    .join("\n");
  const mats = materials
    .map((m) => {
      const ideas = kb && kb[m.id] && kb[m.id].n === (m.text || "").length ? kb[m.id].ideas : null; // the full ideas list when we have it, so nothing gets cut off
      return `--- Review material "${m.title}" for [${m.taskId}], by ${m.by}\n${ideas && ideas.length ? ideas.map((i) => `${i.t}: ${i.d}`).join("\n") : (m.text || "").slice(0, 2500)}`;
    })
    .join("\n").slice(0, 40000);
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
@media (prefers-reduced-motion:reduce){.hr *{animation:none!important;transition:none!important}}
/* ── intro, registered screen, delete ── */
.regWrap{text-align:center;padding:8px 4px}
.regMark{width:56px;height:56px;border-radius:50%;background:var(--okbg);color:var(--ok);display:grid;place-items:center;margin:0 auto 18px}
.regH{font-size:24px;font-weight:650;letter-spacing:-.02em;margin:0 0 8px}
.regP{color:var(--muted);margin:0 0 22px;line-height:1.5}
.btn.danger{background:var(--danger);color:#fff;border:0}
.btn:disabled{opacity:.45;cursor:default}
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
/* ── v8: warm, elegant, calm ──
   Ivory paper, ink, one terracotta accent. Serif for the moments that matter, sans for everything you tap.
   (Replaces the flat v4 look.) */
.hr{--bg:#F5F1E8;--paper:#FFFDF8;--ink:#201C17;--muted:#716958;--faint:#A59C8A;--line:#E7DFCE;--wash:#EFE8D9;--body:#3C362D;--glass:rgba(245,241,232,.84);--okbg:#EDF4EC;--errbg:#FBEEE8;--shadow-sm:0 1px 2px rgba(70,50,20,.05);--shadow:0 20px 44px -24px rgba(70,50,20,.34),0 2px 6px rgba(70,50,20,.05);--shadow-lg:0 40px 90px -30px rgba(50,35,10,.5)}
.hr[data-theme="dark"]{--bg:#1A1714;--paper:#23201C;--ink:#F3EDE2;--muted:#ABA396;--faint:#7B7467;--line:#35302A;--wash:#2B2723;--body:#DDD6C9;--glass:rgba(26,23,20,.84);--okbg:#1E2A21;--errbg:#33211C;--shadow-sm:0 1px 2px rgba(0,0,0,.4);--shadow:0 20px 44px -24px rgba(0,0,0,.8),0 2px 6px rgba(0,0,0,.3);--shadow-lg:0 40px 90px -30px rgba(0,0,0,.9)}
.h1{font-size:34px;font-weight:400;letter-spacing:-.03em}
.heroCard{padding:20px 24px;margin:6px 0 14px;border-radius:26px}
.heroCard .h1{font-size:30px;margin:0 0 4px}
.heroCard .sub{margin:0}
.mark{font-weight:500;letter-spacing:-.03em}
.btn.accent{background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 90%,#fff),var(--accent))}
.row{border-radius:18px}
@media (hover:hover){.row:hover{border-color:var(--accent-line)}}
.railLogo .logoFull{font-size:28px}
.rail{background:color-mix(in srgb,var(--paper) 60%,transparent)}

/* ── boarding pass ── */
.bp{position:relative;z-index:1;flex:1;min-width:0;min-height:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:22px 20px calc(30px + env(safe-area-inset-bottom));background:radial-gradient(900px 520px at 88% -10%,color-mix(in srgb,var(--accent) 10%,transparent),transparent 70%),radial-gradient(700px 420px at 0% 105%,color-mix(in srgb,#C9A24D 9%,transparent),transparent 70%),var(--bg)}
.bp.over{position:fixed;inset:0;z-index:150;flex:none}
.bpTop{width:100%;max-width:660px;display:flex;justify-content:space-between;align-items:center}
.bpTop .mark{font-size:24px}
.bp .bpLink{background:none;border:0;padding:8px 4px;font-size:14px;color:var(--muted)}
.bpMain{width:100%;max-width:660px;flex:1;display:flex;flex-direction:column;justify-content:center;padding:18px 0}
.bpH{font-family:${SERIF};font-weight:400;font-size:clamp(32px,6vw,46px);letter-spacing:-.03em;line-height:1.06;margin:0 0 10px;text-align:center}
.bpSub{text-align:center;color:var(--muted);font-family:${SERIF};font-size:17px;margin:0 0 28px}
.bpTicket{position:relative;display:flex;filter:drop-shadow(0 26px 28px rgba(70,45,15,.2));transform:rotate(-.5deg)}
.bpBody{position:relative;flex:1;min-width:0;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 5%,var(--paper)),var(--paper) 45%);border:1px solid var(--line);border-right:0;border-radius:20px 0 0 20px;padding:22px 22px 22px}
.bpStub{position:relative;width:96px;flex:none;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 5%,var(--paper)),var(--paper) 45%);border:1px solid var(--line);border-left:2px dashed var(--line);border-radius:0 20px 20px 0;padding:18px 12px;display:flex;flex-direction:column;justify-content:space-between;align-items:center;gap:12px;transform-origin:0 100%}
.bpStub::before,.bpStub::after{content:"";position:absolute;left:-11px;width:20px;height:20px;border-radius:50%;background:var(--bg)}
.bpStub::before{top:-10px}.bpStub::after{bottom:-10px}
.bpBars{display:block;width:100%;height:64px;background:repeating-linear-gradient(90deg,var(--ink) 0 2px,transparent 2px 4px,var(--ink) 4px 5px,transparent 5px 8px);opacity:.85}
.bpStub small{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.bpTicket[data-phase="stamped"] .bpStub{cursor:pointer}
.bpHead{display:flex;justify-content:space-between;gap:10px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);padding-bottom:12px;border-bottom:1px solid var(--line);margin-bottom:16px}
.bpLab{display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin-bottom:2px}
.bp .bpName{width:100%;border:0;border-bottom:1.5px solid var(--line);background:none;border-radius:0;font-family:${SERIF};font-size:34px;letter-spacing:-.02em;padding:2px 0 6px;color:var(--ink);transition:border-color .2s}
.bp .bpName:focus{outline:0;border-color:var(--accent)}
.bp .bpName::placeholder{color:var(--faint)}
.bpHint{font-size:12.5px;color:var(--faint);margin:6px 0 0}
.bpHint.bad{color:var(--danger)}
.bpClass{margin-top:16px}
.bpClass .field{margin-bottom:0}
.bpClass .field>label{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);font-weight:500}
.bpGate{font-family:${SERIF};font-size:28px;letter-spacing:-.02em}
.bpGrid{display:flex;gap:10px 24px;flex-wrap:wrap;margin-top:18px;padding:14px 112px 0 0;border-top:1px dashed var(--line);min-height:76px}
.bpGrid small{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin-bottom:2px}
.bpGrid b{font-weight:600;font-size:14.5px}
.bpGhost,.bpStamp{position:absolute;right:16px;bottom:14px;width:104px;height:104px;border-radius:50%}
.bpGhost{border:2px dashed var(--line)}
.bpStamp{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--accent);border:2.5px solid var(--accent);box-shadow:inset 0 0 0 4px var(--paper),inset 0 0 0 5.5px var(--accent);background:color-mix(in srgb,var(--accent) 7%,transparent);transform:rotate(-12deg);animation:bpStamp .5s var(--spring) both}
.bpStamp span{font-size:9px;letter-spacing:.2em;text-transform:uppercase}
.bpStamp b{font-family:${SERIF};font-size:20px;font-weight:500;line-height:1.1;max-width:78px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@keyframes bpStamp{0%{transform:translateY(-50px) scale(2.1) rotate(-28deg);opacity:0}55%{opacity:1}100%{transform:rotate(-12deg)}}
.bpBits{position:absolute;right:64px;bottom:58px;pointer-events:none}
.bpBits i{position:absolute;width:6px;height:6px;border-radius:2px;background:var(--accent);opacity:0;animation:bpBit .8s ease-out .12s both}
.bpBits i:nth-child(3n){background:#C9A24D}.bpBits i:nth-child(3n+1){background:#6BA3D1}
@keyframes bpBit{from{transform:rotate(var(--a)) translateX(4px);opacity:1}to{transform:rotate(var(--a)) translateX(var(--d)) scale(.3);opacity:0}}
.bp[data-phase="stamping"] .bpTicket{animation:bpThud .5s .18s ease-out}
@keyframes bpThud{0%{transform:rotate(-.5deg)}30%{transform:translateY(6px) rotate(-.2deg) scale(.992)}100%{transform:rotate(-.5deg)}}
.bpTicket[data-phase="tearing"] .bpStub{animation:bpStubGo .95s cubic-bezier(.5,0,.9,.4) both}
@keyframes bpStubGo{0%{transform:none}22%{transform:rotate(5deg) translate(4px,4px)}100%{transform:rotate(34deg) translate(130px,460px);opacity:0}}
.bpTicket[data-phase="tearing"] .bpBody{animation:bpBodyGo 1s .55s ease-in both}
@keyframes bpBodyGo{from{transform:none;opacity:1}to{transform:translate(-26px,-70px) rotate(-5deg);opacity:0}}
.bpAct{display:flex;justify-content:center;margin-top:28px;min-height:54px;transition:opacity .3s}
.bp[data-phase="tearing"] .bpAct{opacity:0}
.bp .bpGo{padding:15px 36px;border-radius:999px;border:0;background:var(--ink);color:var(--bg);font-size:16px;font-weight:600;letter-spacing:.01em;box-shadow:var(--shadow);transition:transform .25s var(--spring),opacity .2s,background .25s}
.bp .bpGo:active:not(:disabled){transform:scale(.96)}
.bp .bpGo:disabled{opacity:.4;cursor:default}
.bp .bpGo[data-pulse="1"]{background:var(--accent);color:#fff;animation:bpPulse 1.7s ease-in-out infinite}
@keyframes bpPulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 45%,transparent),var(--shadow)}50%{box-shadow:0 0 0 12px transparent,var(--shadow)}}
@media (max-width:520px){.bpBody{padding:18px 16px}.bpStub{width:76px;padding:16px 8px}.bp .bpName{font-size:28px}.bpGrid{padding-right:0;padding-bottom:104px}.bpGhost,.bpStamp{width:92px;height:92px;right:12px;bottom:10px}}

/* ── the plane ── */
.curtain{position:fixed;inset:0;z-index:300;overflow:hidden}
.curtain[data-go="1"]{pointer-events:none}
.curtainSky{position:absolute;inset:0;background:radial-gradient(900px 520px at 88% -10%,color-mix(in srgb,var(--accent) 10%,transparent),transparent 70%),var(--bg);clip-path:inset(0 0 0 calc(var(--x) * 100%))}
.trail{position:absolute;left:0;top:calc(46% + 2px);height:3px;width:calc(var(--x) * 100%);border-radius:3px;background:repeating-linear-gradient(90deg,var(--accent) 0 12px,transparent 12px 22px);-webkit-mask-image:linear-gradient(90deg,transparent,#000 70%);mask-image:linear-gradient(90deg,transparent,#000 70%);opacity:var(--tf)}
.jet{position:absolute;left:0;top:46%;width:clamp(120px,22vw,190px);height:auto;transform:translate(calc(var(--x) * 100vw - 62%),-50%) rotate(-3deg);filter:drop-shadow(0 14px 14px rgba(40,25,10,.25))}

/* ── tour invite ── */
.invite{position:absolute;left:0;right:0;margin:0 auto;width:max-content;max-width:calc(100% - 28px);bottom:26px;z-index:30;display:flex;align-items:center;gap:14px;padding:12px 12px 12px 18px;border-radius:18px;background:var(--paper);border:1px solid var(--line);box-shadow:var(--shadow);animation:lift .6s var(--spring) both}
.invite b{display:block;font-size:14.5px}
.invite small{display:block;color:var(--muted);font-size:13px}

/* ── the cabin: seat map of your class ── */
.railCabin{display:none}
@media (min-width:1180px){.railSpacer{display:none}.railCabin{display:flex;flex:1;min-height:0;margin:8px 0 12px;padding-top:14px;border-top:1px solid var(--line)}}
@media (max-height:760px){.cabinHint{display:none}}
.cabin{--cols:1fr 1fr 18px 1fr 1fr;display:flex;flex-direction:column;gap:10px;min-height:0;width:100%}
.cabin[data-side="3"]{--cols:repeat(3,1fr) 12px repeat(3,1fr)}
.cabin[data-in="rail"]{flex:1}
.cabin[data-in="sheet"] .fuselage{max-height:46vh}
.cabinHead{display:flex;flex-direction:column;gap:8px}
.cabinTitle{display:flex;align-items:center;justify-content:space-between}
.cabinTitle b{font-family:${SERIF};font-weight:400;font-size:19px;letter-spacing:-.01em}
.cabinLive{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);display:inline-flex;align-items:center;gap:6px}
.cabinLive::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--faint)}
.cabinLive[data-live="1"]{color:var(--ok)}
.cabinLive[data-live="1"]::before{background:var(--ok);animation:livePulse 2.2s infinite}
@keyframes livePulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--ok) 55%,transparent)}70%,100%{box-shadow:0 0 0 7px transparent}}
.cabinTools{display:flex;gap:8px;align-items:center;justify-content:space-between}
.seg2{display:inline-flex;padding:2px;border-radius:999px;background:var(--wash)}
.seg2 button{border:0;background:none;padding:4px 10px;border-radius:999px;font-size:11.5px;font-weight:600;color:var(--muted);transition:background .2s,color .2s}
.seg2 button[aria-pressed="true"]{background:var(--paper);color:var(--ink);box-shadow:var(--shadow-sm)}
.cabinFilter{position:relative;min-width:0}
.filterPill{display:inline-flex;align-items:center;gap:6px;max-width:132px;padding:5px 11px;border-radius:999px;border:1px solid var(--line);background:var(--paper);font-size:12px;font-weight:600;color:var(--muted);transition:border-color .2s,color .2s,background .2s}
.filterPill span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.filterPill[data-on="1"]{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
.filterMenu{position:absolute;right:0;top:calc(100% + 6px);z-index:20;width:214px;padding:6px;border-radius:14px;background:var(--paper);border:1px solid var(--line);box-shadow:var(--shadow);animation:lift .25s var(--ease) both}
.filterMenu button{display:flex;width:100%;align-items:center;gap:0;border:0;background:none;padding:8px 10px;border-radius:9px;font-size:13.5px;text-align:left;transition:background .15s}
.filterMenu button small{margin-left:auto;color:var(--faint)}
.filterMenu button[aria-checked="true"]{background:var(--wash);font-weight:600}
@media (hover:hover){.filterMenu button:hover{background:var(--wash)}}
.filterMenu p{margin:6px 10px;font-size:12px;color:var(--muted);line-height:1.4}
.cabinLegend{display:flex;justify-content:space-between;gap:6px;font-size:10.5px;color:var(--muted)}
.cabinLegend span{display:inline-flex;align-items:center;gap:4px}
.cabinLegend i{width:10px;height:4px;border-radius:2px;background:var(--faint)}
.cabinLegend [data-st="complete"] i,.cChip[data-st="complete"] i{background:var(--ok)}
.cabinLegend [data-st="almost"] i,.cChip[data-st="almost"] i{background:var(--accent)}
.cabinLegend [data-st="starting"] i,.cChip[data-st="starting"] i{background:#D6A23E}
.cabinLegend [data-st="nothing"] i,.cChip[data-st="nothing"] i{background:var(--faint)}
.fuselage{position:relative;flex:1;min-height:130px;overflow-y:auto;overflow-x:hidden;padding:0 8px 16px;border-radius:72px 72px 26px 26px / 62px 62px 26px 26px;border:1.5px solid var(--line);background:linear-gradient(180deg,color-mix(in srgb,var(--wash) 75%,var(--paper)),var(--paper) 150px);scrollbar-width:thin;scrollbar-color:var(--line) transparent}
.nose{height:44px;display:grid;place-items:end center;padding-bottom:8px}
.nose i{width:52px;height:18px;border-radius:30px 30px 8px 8px;background:color-mix(in srgb,var(--ink) 12%,var(--paper));border:1px solid var(--line)}
.letters{display:grid;grid-template-columns:var(--cols);gap:5px;margin-bottom:6px;font-size:10px;font-weight:600;letter-spacing:.06em;color:var(--faint);text-align:center}
.seatRow{display:grid;grid-template-columns:var(--cols);gap:5px;margin-bottom:6px;align-items:start}
.aisle{display:grid;place-items:center;height:36px;font-size:9.5px;color:var(--faint)}
.seat{position:relative;display:block;min-width:0;padding:0;border:0;background:none;text-align:center;transition:transform .25s var(--spring),opacity .25s,filter .25s}
.seatBack{display:flex;align-items:center;justify-content:center;height:34px;padding:0 2px;border-radius:11px 11px 6px 6px;background:var(--paper);border:1.5px solid var(--line);box-shadow:var(--shadow-sm),inset 0 -3px 0 color-mix(in srgb,var(--ink) 5%,transparent);overflow:hidden;transition:border-color .2s,background .2s,box-shadow .2s}
.seatBack b{font-size:11px;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cabin[data-side="3"] .seatBack b{text-transform:uppercase;letter-spacing:.02em}
.seatBelt{display:block;height:4px;width:16%;margin:4px auto 0;border-radius:3px;background:var(--faint);transition:width .5s var(--ease),background .3s}
.seat[data-st="complete"] .seatBelt{width:100%;background:var(--ok)}
.seat[data-st="almost"] .seatBelt{width:76%;background:var(--accent)}
.seat[data-st="starting"] .seatBelt{width:46%;background:#D6A23E}
.seat[data-on="0"]{opacity:.55}
.seat[data-on="0"] .seatBack{background:var(--wash)}
.seat[data-on="1"][data-me="0"]{cursor:pointer}
@media (hover:hover){.seat[data-on="1"][data-me="0"]:hover{transform:translateY(-2px)}}
.seat:active{transform:scale(.95)}
.seat[data-me="1"] .seatBack{border-color:var(--ink)}
.seat[data-hit="1"] .seatBack{border-color:var(--sc);background:color-mix(in srgb,var(--sc) 17%,var(--paper));box-shadow:0 0 0 2px color-mix(in srgb,var(--sc) 28%,transparent)}
.seat[data-dim="1"]{opacity:.26;filter:grayscale(1)}
.seat[data-ping="1"] .seatBack{animation:seatPing 1.4s ease-in-out infinite}
@keyframes seatPing{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 60%,transparent)}50%{box-shadow:0 0 0 6px transparent}}
.seatDot{position:absolute;top:-3px;right:-3px;width:10px;height:10px;border-radius:50%;background:var(--ok);border:2px solid var(--paper);text-decoration:none}
.seatSubj{position:absolute;left:2px;top:-4px;display:flex;gap:2px}
.seatSubj i{width:8px;height:8px;border-radius:50%;border:1.5px solid var(--paper)}
.seat.vacant{display:block;height:34px;border-radius:11px 11px 6px 6px;border:1.5px dashed var(--line);opacity:.55}
.tail{height:20px;margin:8px auto 0;width:58%;border-radius:0 0 18px 18px;background:color-mix(in srgb,var(--ink) 8%,transparent)}
.cabinCard{padding:12px 14px;border-radius:16px;border:1px solid var(--line);background:var(--paper);box-shadow:var(--shadow-sm)}
.cabinWho{display:flex;align-items:baseline;gap:8px}
.cabinWho b{font-family:${SERIF};font-size:18px;font-weight:500;overflow:hidden;text-overflow:ellipsis}
.cabinWho small{color:var(--faint);font-size:12px}
.cabinChips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.cChip{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:600;background:var(--wash);color:var(--muted)}
.cChip i{width:7px;height:7px;border-radius:50%;background:var(--faint)}
.cChip[data-on="1"]{color:var(--ok);background:var(--okbg)}
.cChip[data-on="1"] i{background:var(--ok)}
.cabinFoot{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:30px}
.cabinFoot small{color:var(--muted);font-size:12.5px}
.cabinHint{font-size:12px;line-height:1.45;color:var(--muted);margin:0}
.cabinBtn{position:relative}
.cabinBtn[data-ping="1"]::after{content:"";position:absolute;top:1px;right:1px;width:10px;height:10px;border-radius:50%;background:var(--accent);border:2px solid var(--paper)}
.gMembers{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px}
.gMembers .btn.small[aria-pressed="true"]{border-color:var(--accent);color:var(--accent)}

/* ── subjects, done tab, class chip ── */
.newSubj{margin-top:12px;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--wash);display:flex;flex-direction:column;gap:12px;animation:lift .3s var(--ease) both}
.newSubj .swatches{margin:0}
.dot.big{width:14px;height:14px;margin-right:12px}
.subjRow{border-bottom:1px solid var(--line)}
.subjHead{display:flex;align-items:center;width:100%;border:0;background:none;padding:14px 2px;text-align:left;font-size:15.5px}
.subjHead b{font-weight:500;flex:1}
.subjHead svg{color:var(--faint)}
.doneHero{margin:6px 0 18px;padding:18px 20px;border-radius:20px;border:1px solid var(--line);background:linear-gradient(135deg,color-mix(in srgb,var(--ok) 9%,var(--paper)),var(--paper) 70%)}
.doneHero b{font-family:${SERIF};font-weight:400;font-size:38px;letter-spacing:-.03em}
.doneHero span{color:var(--muted);font-size:15px}
.doneHero .gbar{margin:10px 0 8px}
.doneHero small{color:var(--muted);font-size:13px}
.classChip i{font-style:normal;margin-left:8px;padding-left:8px;border-left:1px solid var(--line);color:var(--accent);font-weight:600}
.cabin[data-in="sheet"] .cabinTitle b{display:none}
.cabin[data-in="sheet"] .cabinTitle{justify-content:flex-end}
.seatBack b{font-size:10.5px;letter-spacing:-.01em}

/* ── class plane: isolated and calmer (nothing from the page can show through or pile up inside it) ── */
.rail{background:var(--paper)}
.railCabin,.cabin{isolation:isolate}
.fuselage{contain:paint;overflow-x:clip;border-color:color-mix(in srgb,var(--line) 70%,transparent);padding:0 10px 18px}
.seatRow{gap:6px;margin-bottom:8px}
.seatBack{height:32px;box-shadow:none;border-color:transparent;background:color-mix(in srgb,var(--ink) 6%,var(--paper))}
.seat[data-me="1"] .seatBack{background:var(--paper);border-color:var(--ink)}
.seat[data-on="0"]{opacity:.5}
.seat[data-on="0"] .seatBelt{opacity:0}
.seat.vacant{height:32px;border:1px dashed var(--line);opacity:.6;background:none}
.seatBelt{height:3px;margin-top:5px}
.cabinLegend{opacity:.8}
.letters{opacity:.7}

/* ── minecraft ── */
.mcIcon{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;margin-bottom:14px;background:var(--wash);color:var(--muted)}
.mcIcon[data-on="1"]{background:var(--okbg);color:var(--ok)}
.mcBox{margin-top:22px;padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--wash)}
.mcAddr{margin-bottom:12px}
.mcRow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:4px}
.mcRow code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;word-break:break-all;color:var(--ink)}
.mcPill{display:inline-flex;align-items:center;gap:7px;margin:0 0 10px;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:var(--paper);font-size:13px;font-weight:500;color:var(--muted)}
.mcPill[data-on="1"]{color:var(--ok);border-color:var(--ok);background:var(--okbg)}

/* ── study hub ── */
.study{display:block}
.studyStats{display:flex;gap:18px;flex-wrap:wrap;margin:0 0 6px;font-size:13.5px;color:var(--muted)}
.studyStats b{color:var(--accent);font-weight:600}
.stepLabel{display:flex;align-items:center;gap:10px;margin:22px 0 12px;font-family:${SERIF};font-weight:400;font-size:21px;letter-spacing:-.01em}
.stepLabel i{font-style:normal;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font-family:${SANS};font-size:13px;font-weight:600}
.scopeLine{margin:14px 0 0;padding:11px 14px;border-radius:14px;background:var(--wash);color:var(--muted);font-size:13.5px;line-height:1.5}
.scopeLine b{color:var(--ink);font-weight:600}
.goal{margin-bottom:18px}
.goalHead{display:flex;align-items:baseline;gap:10px;margin:0 0 8px;flex-wrap:wrap}
.goalHead b{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}
.goalHead span{font-size:13px;color:var(--faint)}
.techGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.tech{display:flex;flex-direction:column;align-items:flex-start;gap:5px;text-align:left;padding:15px 16px;border-radius:18px;border:1px solid var(--line);background:var(--paper);box-shadow:var(--shadow-sm);transition:transform .25s var(--spring),border-color .2s,box-shadow .2s}
.tech b{font-family:${SERIF};font-weight:500;font-size:18px;letter-spacing:-.01em}
.tech span{font-size:13.5px;line-height:1.45;color:var(--muted)}
.tech em{font-style:normal;margin-top:auto;padding-top:6px;font-size:12px;color:var(--accent);font-weight:600}
@media (hover:hover){.tech:hover:not(:disabled){transform:translateY(-2px);border-color:var(--accent-line);box-shadow:var(--shadow)}}
.tech:active:not(:disabled){transform:scale(.98)}
.tech:disabled{opacity:.55}
.prepBar{position:sticky;bottom:14px;margin-top:16px;display:flex;align-items:center;gap:10px;padding:13px 16px;border-radius:16px;background:var(--ink);color:var(--bg);font-size:14px;box-shadow:var(--shadow)}
.prepBar i{width:14px;height:14px;border-radius:50%;border:2px solid color-mix(in srgb,var(--bg) 35%,transparent);border-top-color:var(--bg);animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.run{max-width:640px}
.runBar{margin:6px 0 18px}
.runCard{padding:20px}
.runDone{text-align:center;padding:30px 10px}
.runDone .mcIcon{margin:0 auto 14px}
.fc{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;width:100%;min-height:250px;padding:26px 22px;border-radius:26px;border:1px solid var(--line);background:linear-gradient(180deg,var(--paper),color-mix(in srgb,var(--wash) 60%,var(--paper)));box-shadow:var(--shadow);text-align:center;transition:transform .35s var(--spring),border-color .2s}
.fc[data-flip="1"]{border-color:var(--accent-line);background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 6%,var(--paper)),var(--paper))}
.fc small{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
.fc span{font-size:clamp(22px,4.5vw,30px);line-height:1.25;letter-spacing:-.01em}
.fc[data-flip="1"] span{font-size:clamp(18px,3.6vw,23px);line-height:1.45}
.fc em{font-style:normal;font-size:13px;color:var(--faint)}
.fc:active{transform:scale(.99)}
.rateRow{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
.rateRow .btn{display:flex;flex-direction:column;align-items:center;gap:1px;padding:12px 8px}
.rateRow small{font-size:11px;opacity:.7;font-weight:400}
.clozeText{font-size:21px;line-height:1.45;margin:0 0 16px;letter-spacing:-.01em}
.fbOk,.fbBad{margin:12px 0;padding:10px 14px;border-radius:12px;font-size:14.5px;line-height:1.5}
.fbOk{background:var(--okbg);color:var(--ok)}
.fbBad{background:var(--errbg);color:var(--danger)}
.fbBox{margin-top:14px;padding:14px 16px;border-radius:16px;line-height:1.5;font-size:14.5px}
.fbBox[data-v="ok"]{background:var(--okbg)}
.fbBox[data-v="no"]{background:var(--wash)}
.fbBox b{font-family:${SERIF};font-size:19px;font-weight:500}
.fbBox p{margin:6px 0 0}
.matchGrid{display:grid;grid-template-columns:1fr 1.5fr;gap:12px;align-items:start}
.matchGrid>div{display:flex;flex-direction:column;gap:9px}
.mBtn{padding:13px 14px;border-radius:14px;border:1.5px solid var(--line);background:var(--paper);text-align:left;font-size:15px;font-weight:500;transition:transform .2s var(--spring),border-color .2s,background .2s,opacity .3s}
.mBtn.small{font-weight:400;font-size:13.5px;line-height:1.4}
.mBtn[data-on="1"]{border-color:var(--accent);background:var(--accent-soft)}
.mBtn[data-done="1"]{opacity:.35;border-color:var(--ok);background:var(--okbg)}
.mBtn[data-bad="1"]{animation:shake .4s;border-color:var(--danger)}
@keyframes shake{20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}
.trickRow{padding:13px 0;border-bottom:1px solid var(--line)}
.trickRow b{display:block;font-weight:600;font-size:14.5px}
.trickRow span{display:block;color:var(--muted);font-size:14px;line-height:1.5;margin-top:2px}
.trick{margin:8px 0 0;padding:9px 12px;border-radius:12px;background:var(--accent-soft);font-family:${SERIF};font-size:15.5px;line-height:1.45;color:var(--ink)}
.choices{display:flex;flex-direction:column;gap:9px}
.choice{padding:13px 15px;border-radius:14px;border:1.5px solid var(--line);background:var(--paper);text-align:left;font-size:15px;line-height:1.4;transition:border-color .2s,background .2s,transform .2s var(--spring)}
.choice:active:not(:disabled){transform:scale(.99)}
.choice[data-state="picked"]{border-color:var(--accent);background:var(--accent-soft)}
.choice[data-state="right"]{border-color:var(--ok);background:var(--okbg)}
.choice[data-state="wrong"]{border-color:var(--danger);background:var(--errbg)}
.blurtBox{font-size:16px;line-height:1.6;min-height:240px}
.topicList .row{margin-bottom:10px}
.planDay{margin:0 0 14px;padding:14px 16px;border-radius:18px;border:1px solid var(--line);background:var(--paper)}
.planDay[data-today="1"]{border-color:var(--accent-line);background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 5%,var(--paper)),var(--paper))}
.planWhen{font-family:${SERIF};font-size:18px;margin-bottom:6px}
.planRow{display:flex;align-items:center;gap:12px;padding:8px 0}
.planRow .rowMain{flex:1;min-width:0}

@media (min-width:1180px) and (max-height:860px){.cabinLegend{display:none}.cabinCard{padding:9px 12px}.cabinChips{margin:6px 0}.cabinFoot{min-height:0}}

.focusPill{display:inline-flex;align-items:center;gap:8px;margin:0 0 12px;padding:6px 8px 6px 14px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:13.5px}
.focusPill b{font-weight:600}
.focusPill button{display:grid;place-items:center;width:22px;height:22px;border:0;border-radius:50%;background:color-mix(in srgb,var(--accent) 16%,transparent)}
.tech{position:relative}
.tech[data-rec="1"]{border-color:var(--accent-line);background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 5%,var(--paper)),var(--paper))}
.recTag{display:block;margin:-2px 0 2px;font-style:normal;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;font-weight:600;color:var(--accent)}
@media (max-width:759px){.invite{bottom:calc(92px + env(safe-area-inset-bottom))}}
@media (max-width:520px){.bpAct{position:sticky;bottom:calc(10px + env(safe-area-inset-bottom));z-index:2}.bpSub{margin-bottom:18px}.bp{padding-top:16px}.bpMain{padding:10px 0}}

/* ── temporary chat ── */
.dm{display:flex;flex-direction:column;height:min(60vh,520px)}
.dmHead{display:flex;align-items:center;gap:12px;padding:2px 0 14px;border-bottom:1px solid var(--line)}
.dmAvatar{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);font-family:${SERIF};font-size:18px}
.dmHead b{display:block;font-family:${SERIF};font-weight:500;font-size:19px}
.dmHead small{display:block;font-size:12.5px;color:var(--muted)}
.dmHead small[data-on="1"]{color:var(--ok)}
.dmMsgs{flex:1;min-height:0;overflow-y:auto;padding:12px 2px;display:flex;flex-direction:column;gap:8px}
.dmMsg{max-width:82%;padding:9px 14px;border-radius:18px 18px 18px 6px;background:var(--wash);white-space:pre-wrap;word-break:break-word;line-height:1.45;animation:lift .3s var(--ease) both}
.dmMsg[data-me="1"]{align-self:flex-end;background:var(--accent);color:#fff;border-radius:18px 18px 6px 18px}
.dmBar{display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--line)}

/* ── v11: calmer, flatter, roomier. No glow blobs, no hover gradients, no glass; one soft line instead of heavy cards ── */
.bgfx{display:none}
.spot::after,.heroCard::before{display:none}
.rail,.side{backdrop-filter:none;-webkit-backdrop-filter:none;background:var(--bg)}
.heroCard{background:none;border:0;border-bottom:1px solid var(--line);border-radius:0;box-shadow:none;padding:6px 0 22px;margin:2px 0 24px}
.heroCard .h1{font-size:clamp(27px,3vw,36px);letter-spacing:-.02em}
.heroCard .sub{color:var(--muted);max-width:34ch;line-height:1.5}
.card,.ann,.note,.row{box-shadow:none}
.row{border-radius:14px;padding:18px 20px 18px 24px}
.group{margin-top:38px}
.group h3{font-size:20px}
.group h3 small{background:none;padding:0;color:var(--faint)}
.ann{background:var(--wash);border:0;border-radius:14px;padding:12px 8px 12px 16px;margin-bottom:20px}
.chip{border-radius:10px}
.quickRow{display:flex;gap:2px;flex-wrap:wrap;margin:-8px 0 20px -10px}
.quickRow .btn{background:none;border-color:transparent;color:var(--muted);padding-left:10px;padding-right:12px}
.quickRow .btn:hover{color:var(--ink);background:var(--wash)}
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
    id: "done", target: "tab-done", enter: {},
    title: "Finished tasks wait in Done",
    body: "Tick something off and it moves here, grouped by subject. Tap its circle to put it back.",
    hint: "Open Done", done: (c) => c.tab === "done",
  },
  {
    id: "review", target: "tab-review", enter: {},
    title: "Study without the stress",
    body: "Review has nine ways to study your class's notes: flashcards, quizzes, blurting and more.",
    hint: "Open Review", done: (c) => c.tab === "review",
  },
  {
    id: "study", target: "study-sections", enter: { tab: "review" },
    title: "Choose what, then how",
    body: "Pick Today, This week or Final, tap the subjects you want (or every subject), then a technique. Each card says what it is best for, so you don't have to guess.",
    hint: "Try it, or tap Next",
  },
  {
    id: "ask", target: "tab-ask", enter: { tab: "review" },
    title: "Ask the assistant",
    body: "Ask what's due, get a plan for tonight, or tell it to add a task for you.",
    hint: "Open Ask", done: (c) => c.tab === "ask",
  },
  {
    id: "cabin", target: bp === "desktop" ? "cabin" : "cabin-btn", enter: {},
    title: "Your class, as a plane",
    body: bp === "desktop"
      ? "Everyone has a seat. A green dot means online, and the bar under a seat shows how far along they are this week. Tap someone who's online to message them. Pick a subject at the top to light up your groupmates."
      : "Tap the plane to see everyone in your class. A green dot means online. Tap someone who's online to message them, and pick a subject to light up your groupmates.",
    hint: "Take a look, then tap Next",
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

function Auth({ onAuthed, onNeedPass }) {
  const [mode, setMode] = useState("signin"); // signin | signup | forgot
  const [mail, setMail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(LINK_NOTICE.err || "");
  const [info, setInfo] = useState(() => { try { const m = sessionStorage.getItem("hr:notice"); sessionStorage.removeItem("hr:notice"); return m || LINK_NOTICE.info || ""; } catch { return LINK_NOTICE.info || ""; } });
  const [busy, setBusy] = useState(false);
  const switchMode = (m) => { setMode(m); setErr(""); setInfo(""); };
  const submit = async () => {
    setErr(""); setInfo("");
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
    if (pw.length < 6) return setErr("Use a password with at least 6 characters.");
    setBusy(true);
    try {
      if (mode === "signup") {
        // Only an email and password. A database trigger (supabase/schema.sql) creates an empty profile;
        // the username and class are filled in on the boarding pass the first time they sign in.
        const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: window.location.origin } });
        if (error) {
          setErr(/registered|exists/i.test(error.message) ? "That email already has an account. Sign in instead."
            : "Couldn't create the account: " + error.message);
          Sound.play("err"); return;
        }
        if (!data.session) { setInfo("Check your email and click the link to confirm your account, then come back and sign in."); return; }
        const prof = await loadProfile(data.user.id);
        if (!prof) { await supabase.auth.signOut(); setErr("Couldn't finish setting up the account."); Sound.play("err"); return; }
        Sound.play("add");
        if (!prof.username) { onNeedPass(); return; }
        await onAuthed(prof.username, prof.class_id || null, false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) { setErr(/confirm/i.test(error.message) ? "Confirm your email first. Check your inbox for the link." : "That email or password doesn't match."); Sound.play("err"); return; }
        const prof = await loadProfile(data.user.id);
        if (!prof) { await supabase.auth.signOut(); setErr("This account isn't set up. Create a new one."); Sound.play("err"); return; }
        Sound.play("add");
        if (!prof.username && !prof.is_admin) { onNeedPass(); return; }
        await onAuthed(prof.username, prof.class_id || null, !!prof.is_admin);
      }
    } finally {
      setBusy(false);
    }
  };
  const titles = { signin: "Welcome back", signup: "Create your account", forgot: "Reset your password" };
  const subs = { signin: "Sign in to see what's due.", signup: "Just an email and a password. Your boarding pass comes next.", forgot: "We'll email you a link to choose a new password." };
  return (
    <div className="authBody">
      <div className="mark authBrand" style={{ fontSize: 34, marginBottom: 22 }}>Homeroom</div>
      <h1 className="h1" style={{ marginTop: 0 }}>{titles[mode]}</h1>
      <p className="sub" style={{ marginBottom: 26 }}>{subs[mode]}</p>
      <div className="field">
        <label htmlFor="e">Email</label>
        <input id="e" className="input" type="email" value={mail} onChange={(e) => setMail(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="email" onKeyDown={(e) => e.key === "Enter" && mode === "forgot" && submit()} />
      </div>
      {mode !== "forgot" && (
        <div className="field">
          <label htmlFor="p">Password</label>
          <input id="p" className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      {info && <p className="meta" role="status" style={{ marginBottom: 14, lineHeight: 1.5 }}>{info}</p>}
      <button className="btn accent full" onClick={submit} disabled={busy || !mail || (mode !== "forgot" && !pw)}>
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

/* Pick a subject, or add a new one with its own colour. Added subjects are shared with the whole class. */
function SubjectPicker({ subjects, value, onChange, onAdd }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const n = name.trim().slice(0, 40);
  const taken = subjects.some((x) => x.toLowerCase() === n.toLowerCase());
  const add = () => { if (!n || taken) return; onAdd({ name: n, color }); onChange(n); setAdding(false); setName(""); Sound.play("add"); };
  return (
    <div>
      <div className="chips" style={{ flexWrap: "wrap", overflow: "visible", padding: 0 }}>
        {subjects.map((x) => (
          <button key={x} className="chip" aria-pressed={value === x && !adding} onClick={() => { setAdding(false); onChange(x); }}>
            <span className="dot" style={{ background: subjColor(x), margin: 0 }} />{x}
          </button>
        ))}
        <button className="chip" aria-pressed={adding} onClick={() => setAdding(!adding)}><Plus size={14} /> New subject</button>
      </div>
      {adding && (
        <div className="newSubj">
          <input className="input" autoFocus value={name} maxLength={40} placeholder="Subject name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <div className="swatches" role="radiogroup" aria-label="Subject colour">
            {SWATCHES.map((c) => <button key={c} className="sw" role="radio" aria-checked={color === c} aria-pressed={color === c} aria-label={`Colour ${c}`} style={{ background: c, color: c }} onClick={() => { Sound.play("tap"); setColor(c); }} />)}
          </div>
          {taken && <p className="meta" style={{ margin: "0 0 8px" }}>That subject is already on the list.</p>}
          <button className="btn accent small" disabled={!n || taken} onClick={add}>Add subject</button>
        </div>
      )}
    </div>
  );
}

/* Every subject your class uses, with its colour. Tap a subject to recolour it. */
function SubjectsPanel({ subjects, onSet }) {
  const [open, setOpen] = useState(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[1]);
  const n = name.trim().slice(0, 40);
  const taken = subjects.some((x) => x.toLowerCase() === n.toLowerCase());
  return (
    <div>
      <p style={{ color: C.muted, margin: "-6px 0 16px", lineHeight: 1.5 }}>Subjects and their colours are shared with your class. Anything you add to a task shows up here by itself.</p>
      {subjects.map((x) => (
        <div className="subjRow" key={x}>
          <button className="subjHead" aria-expanded={open === x} onClick={() => setOpen(open === x ? null : x)}>
            <span className="dot big" style={{ background: subjColor(x) }} /><b>{x}</b><ChevronDown size={16} />
          </button>
          {open === x && (
            <div className="swatches" style={{ padding: "4px 0 10px" }}>
              {SWATCHES.map((c) => <button key={c} className="sw" aria-label={`Colour ${c}`} aria-pressed={subjColor(x) === c} style={{ background: c, color: c }} onClick={() => { Sound.play("pop"); onSet({ name: x, color: c }); }} />)}
            </div>
          )}
        </div>
      ))}
      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="ns">Add a subject</label>
        <input id="ns" className="input" value={name} maxLength={40} placeholder="Science" onChange={(e) => setName(e.target.value)} />
        <div className="swatches" style={{ margin: "12px 0" }}>
          {SWATCHES.map((c) => <button key={c} className="sw" aria-label={`Colour ${c}`} aria-pressed={color === c} style={{ background: c, color: c }} onClick={() => setColor(c)} />)}
        </div>
        <button className="btn accent small" disabled={!n || taken} onClick={() => { onSet({ name: n, color }); setName(""); Sound.play("add"); }}>Add subject</button>
      </div>
    </div>
  );
}

/* ───────────────────────── Minecraft server access (switched off until minecraft.config.js says on: true) ───────────────────────── */

function CopyLine({ label, value, note }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="mcAddr">
      <div className="meta">{label}</div>
      <div className="mcRow">
        <code>{value}</code>
        <button className="btn ghost small" onClick={async () => { if (await copyText(value)) { setOk(true); Sound.play("pop"); setTimeout(() => setOk(false), 1600); } }}>
          {ok ? <><Check size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Copied</> : <><Copy size={14} style={{ verticalAlign: -2, marginRight: 4 }} />Copy</>}
        </button>
      </div>
      {note && <div className="meta" style={{ marginTop: 4 }}>{note}</div>}
    </div>
  );
}

function MinecraftPanel({ done, total, linked, onLink, onUnlink }) {
  const allDone = total > 0 && done === total;
  const [name, setName] = useState(linked || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = /^[A-Za-z0-9_]{3,16}$/.test(name.trim());
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true); setErr("");
    const e = await onLink(name.trim());
    setBusy(false);
    if (e) { setErr(e); Sound.play("err"); } else Sound.play("add");
  };
  if (!allDone) {
    return (
      <div className="mc">
        <div className="mcIcon"><Gamepad2 size={26} /></div>
        <h3 className="serif" style={{ fontSize: 26, fontWeight: 400, margin: "0 0 8px" }}>{linked ? "Access is paused" : "Almost there"}</h3>
        <p style={{ color: C.muted, lineHeight: 1.55, margin: 0 }}>
          {total === 0 ? "There are no tasks yet." : `${total - done} of ${total} tasks are still open.`} Finish every task in your class's quarter and you can join the Minecraft server{linked ? ` as ${linked}` : ""}.
        </p>
      </div>
    );
  }
  return (
    <div className="mc">
      <div className="mcIcon" data-on="1"><Gamepad2 size={26} /></div>
      <h3 className="serif" style={{ fontSize: 26, fontWeight: 400, margin: "0 0 8px", lineHeight: 1.2 }}>Congratulations on completing every task!</h3>
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="mcn">{linked ? "Your Minecraft username" : "Enter your username to be able to join the Minecraft server"}</label>
        <input id="mcn" className="input" value={name} maxLength={16} placeholder="Your Minecraft username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
        {name && !valid && <p className="meta" style={{ margin: "6px 0 0" }}>3 to 16 letters, numbers or underscores.</p>}
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn accent full" disabled={!valid || busy || (linked && name.trim() === linked)} onClick={save}>
        {busy ? <>Saving<Dots /></> : linked ? "Change username" : "Unlock server access"}
      </button>
      {linked && <p className="meta" style={{ margin: "12px 0 0" }}>You're in, <b style={{ color: C.ink }}>{linked}</b>. Join with the address below.</p>}
      <div className="mcBox">
        <div className="meta" style={{ marginBottom: 10 }}>{MINECRAFT.version}</div>
        <CopyLine label="Java address, for IPv6" value={MINECRAFT.ipv6} />
        <CopyLine label="If that doesn't work" value={MINECRAFT.host} />
        <p className="meta" style={{ margin: "4px 0 0", lineHeight: 1.5 }}>
          If none work, change your IPv4 DNS settings: main <b>{MINECRAFT.dns.main}</b>, alt <b>{MINECRAFT.dns.alt}</b>.
        </p>
      </div>
      {linked && <button className="back" style={{ marginTop: 12 }} onClick={onUnlink}>Unlink this username</button>}
    </div>
  );
}

/* The Done tab: everything you've finished, by subject. Tap the circle to put one back. */
function DoneTab({ tasks, progress, completions, user, quarter, setStatus, openTask, editTask, onRefresh, mc }) {
  const [all, setAll] = useState(false);
  const inScope = tasks.filter((t) => all || (t.quarter || 1) === quarter);
  const done = inScope.filter((t) => progress[t.id] === "done").sort((a, b) => b.deadline.localeCompare(a.deadline));
  const pct = inScope.length ? Math.round((done.length / inScope.length) * 100) : 0;
  const bySubj = [...new Set(done.map((t) => t.subject))].sort((a, b) => a.localeCompare(b));
  return (
    <Scroll onRefresh={onRefresh}>
      <h1 className="h1">Completed</h1>
      <p className="sub">Everything you've finished{all ? "" : `, quarter ${quarter}`}.</p>
      <div className="doneHero">
        <div><b>{done.length}</b><span> of {inScope.length} done</span></div>
        <div className="gbar"><i style={{ width: `${pct}%` }} /></div>
        {mc && <button className="mcPill" data-on={mc.allDone ? 1 : 0} onClick={mc.open}><Gamepad2 size={14} />{mc.allDone ? (mc.linked ? "Minecraft: you're in" : "Minecraft unlocked, tap to join") : "Finish everything to unlock Minecraft"}</button>}
        <small>{inScope.length === 0 ? "Nothing has been added yet." : done.length === inScope.length ? "Every task is done. Nicely finished." : `${inScope.length - done.length} still to go.`}</small>
      </div>
      <Segmented value={all ? "all" : "q"} onChange={(v) => setAll(v === "all")} options={[["q", `Quarter ${quarter}`], ["all", "All quarters"]]} />
      {done.length === 0 && <div className="empty"><div className="serif">Nothing finished yet</div>Tick a task off and it will wait for you here.</div>}
      {bySubj.map((sj) => {
        const list = done.filter((t) => t.subject === sj);
        return (
          <section className="group" key={sj}>
            <h3><span className="dot" style={{ background: subjColor(sj) }} />{sj}<small>{list.length}</small></h3>
            {list.map((t) => (
              <TaskRow key={t.id} t={t} status="done" finished={(completions[t.id] || []).filter((u) => u !== user).length}
                onOpen={() => openTask(t.id)} onEdit={() => editTask(t.id)} onToggle={() => setStatus(t.id, "todo")} />
            ))}
          </section>
        );
      })}
    </Scroll>
  );
}

function TaskForm({ initial, subjects, groups, defQuarter, onSave, onCancel, onAddSubject }) {
  const [f, setF] = useState(
    initial
      ? { quarter: defQuarter, proof: true, groupId: null, ...initial }
      : { title: "", subject: "", type: "Homework", priority: "High", deadline: addDays(todayISO(), 1), notes: "", quarter: defQuarter, groupId: null, proof: true }
  );
  const [newGroup, setNewGroup] = useState(null); // null = not creating one, string = name being typed
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
    if (o.subject && !subjects.includes(o.subject)) onAddSubject({ name: String(o.subject).slice(0, 40), color: subjColor(o.subject) });
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
        <SubjectPicker subjects={subjects} value={f.subject} onChange={(v) => set("subject", v)} onAdd={onAddSubject} />
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
  const view = ui.view === "done" ? "upcoming" : ui.view; // finished tasks live in the Done tab now
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
  const anns = [...announcements].sort((a, b) => b.at - a.at).slice(0, 1);
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
            {today + overdue === 0 ? "Nothing urgent right now." : `${today} due today${overdue ? `, ${overdue} overdue` : ""}.`}{week > 0 ? ` ${week} due in the next 7 days.` : ""}
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
      {wkBanner && !hideWk && (
        <div className="note" role="status">
          <div>
            <p><span>{wkBanner.title}</span> {wkBanner.text}</p>
            <button className="btn ghost small" onClick={() => onOpenWeekly(wkBanner.ws)}>Open the weekly reviewer</button>
          </div>
          <button className="iconBtn" style={{ width: 28, height: 28, flex: "none" }} onClick={() => setHideWk(true)} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      <div className="quickRow">\1
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
          <Segmented value={view} onChange={setView} options={[["upcoming", "Upcoming"], ["all", "All"]]} />
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

function ReviewDetail({ task, user, materials, addMaterial, removeMaterial, onBack, onStudy, kb, saveKb }) {
  const mats = materials.filter((m) => m.taskId === task.id);
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
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
  // The reviewer is built from the full ideas inventory of the notes, then checked: anything it left out gets added back.
  const generate = async () => {
    setGen(true); setErr("");
    const system = `You write clear, well-organized study reviewers for students. Plain text only, no markdown symbols, no emojis. Use short headed sections separated by blank lines. Include EVERY idea you are given, grouped by topic, one or two short lines each. Never add facts that are not in the list.`;
    try {
      let body, ideas = [];
      if (mats.length) {
        const inv = await ensureInventory(mats.map((m) => ({ m, subject: task.subject })), kb, saveKb, null, null);
        ideas = mats.flatMap((m) => inv[m.id]?.ideas || []);
        body = `Make a reviewer for "${task.title}" (${task.subject}). Cover all ${ideas.length} of these ideas:\n${ideaLines(ideas)}`;
      } else {
        body = `Make a reviewer for "${task.title}" (${task.subject}, ${task.type}). Teacher notes: ${task.notes || "none"}. No material was uploaded, so cover the key ideas a student would likely need for this topic at a middle school level, and say at the top that it is a general reviewer.`;
      }
      let out = (await callClaude(system, [{ role: "user", content: body }])).trim();
      if (!out) throw new Error("empty");
      const missing = ideas.filter((i) => !ideaCovered(out, i));
      if (missing.length) {
        try { out += "\n\n" + (await callClaude(system, [{ role: "user", content: `This reviewer left some ideas out. Write ONLY a short extra section titled Also remember, with one short line for each of these ideas:\n${ideaLines(missing)}` }])).trim(); }
        catch { out += "\n\nAlso remember\n" + missing.map((i) => `${i.t}: ${i.d}`).join("\n"); }
      }
      await addMaterial({ id: uid(), taskId: task.id, title: `Reviewer for ${task.title}`, text: out, by: "Assistant", kind: "ai", at: Date.now(), subject: task.subject, taskTitle: task.title });
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
        <button className="btn accent" onClick={() => onStudy({ taskId: task.id })}>Study this</button>
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
    </div>
  );
}

function WeeklyReviewer({ tasks, materials, weeklies, user, saveWeekly, initialWs, kb, saveKb, onStudy }) {
  const thisWeek = weekStartOf(todayISO());
  const lastWeek = addDays(thisWeek, -7);
  const [ws, setWs] = useState(initialWs || thisWeek);
  const [live, setLive] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const saved = weeklies.find((w) => w.weekStart === ws);
  const shown = busy ? live : saved?.text || "";
  const { ts, ms } = useMemo(() => weekData(ws, tasks, materials), [ws, tasks, materials]);
  const earlier = weeklies.filter((w) => w.weekStart !== thisWeek && w.weekStart !== lastWeek).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  const pick = (w) => { if (busy) return; Sound.play("tap"); setWs(w); setErr(""); };
  const generate = async () => {
    if (!ts.length && !ms.length) { setErr("Nothing was due or added that week yet, so there's nothing to review."); Sound.play("err"); return; }
    setBusy(true); setLive("Reading the week's notes"); setErr("");
    try {
      const by = {};
      const slot = (s) => (by[s] = by[s] || { tasks: [], mats: [] });
      ts.forEach((t) => slot(t.subject).tasks.push(t));
      ms.forEach((m) => slot(m.subject || tasks.find((t) => t.id === m.taskId)?.subject || "Other").mats.push(m));
      // every note is read into a full list of ideas first, so the page can't leave anything out
      const items = Object.entries(by).flatMap(([s, d]) => d.mats.map((m) => ({ m, subject: s })));
      const inv = await ensureInventory(items, kb, saveKb, (t) => setLive(t), null);
      setLive("");
      const all = [];
      const body = Object.entries(by).map(([s, d]) => {
        const ideas = d.mats.flatMap((m) => inv[m.id]?.ideas || []);
        all.push(...ideas);
        return `SUBJECT: ${s}\nTasks:\n${d.tasks.map((t) => `- ${t.title} (${t.type}, due ${t.deadline})${t.notes ? `, notes: ${t.notes}` : ""}`).join("\n") || "- none"}\nKey ideas from the notes (${ideas.length}):\n${ideas.length ? ideaLines(ideas) : "none"}`;
      }).join("\n\n");
      const next = tasks.filter((t) => t.deadline >= addDays(ws, 7) && t.deadline <= addDays(ws, 13)).map((t) => `${t.title} (${t.subject}, ${fmtDate(t.deadline)})`).join("; ");
      const system = `You write a weekly reviewer for a class, covering what the class worked on and learned. Plain text only, no markdown symbols, no emojis. Start with one sentence summing up the week. Then, for each subject, put the subject name on its own line, followed by one short line for every key idea listed for that subject (group related ideas under small topic labels and merge true duplicates, but never leave an idea out), then one self-check question. Take facts only from the material provided. When a subject has only a task title and notes and no material, say what was assigned and do not invent lesson content. Finish with a short "Coming up" line using the next-week list.`;
      let full = (await streamClaude(system, [{ role: "user", content: `Week of ${weekLabel(ws)}.\n\n${body}\n\nComing next week: ${next || "nothing listed yet"}` }], (t) => setLive(t))).trim();
      if (!full) throw new Error("empty");
      const missing = all.filter((i) => !ideaCovered(full, i));
      if (missing.length) {
        try { full += "\n\n" + (await callClaude(system, [{ role: "user", content: `This weekly page left some ideas out. Write ONLY a short extra section titled Also remember, with one short line for each of these ideas:\n${ideaLines(missing)}` }])).trim(); }
        catch { full += "\n\nAlso remember\n" + missing.map((i) => `${i.t}: ${i.d}`).join("\n"); }
      }
      saveWeekly(ws, full);
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
          {saved && <button className="btn accent" onClick={() => onStudy({ period: "week" })}>Study this week</button>}
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

function Library({ tasks, materials, user, removeMaterial, kb, onStudy }) {
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
      {subj !== "All" && list.length > 0 && <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => onStudy({ subjects: [subj], period: "final" })}>Study all of {subj}</button>}
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
                {kb && kb[m.id] && kb[m.id].ideas.length > 0 && <span>{kb[m.id].ideas.length} key ideas</span>}
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

/* ───────────────────────── study hub ─────────────────────────
   Pick what to review (which subjects, today / this week / the whole quarter), then pick a technique.
   Every note is first turned into an inventory of "ideas" (a term and a one-line fact). Every technique is built from that
   inventory, so nothing in the notes gets skipped, and the inventory is saved once and shared with the class. */

const BOX_DAYS = [0, 1, 2, 4, 8, 16]; // spaced repetition: how many days until a card comes back, by box
const TECHS = [
  { id: "cards", goal: "memorize", name: "Flashcards", tip: "Best for memorizing. Cards you miss come back sooner, ones you know come back later.", time: "5 to 10 min" },
  { id: "cloze", goal: "memorize", name: "Fill the blanks", tip: "Good for exact wording, definitions and formulas.", time: "5 min" },
  { id: "match", goal: "memorize", name: "Match pairs", tip: "A light warm-up that connects each term to its meaning.", time: "3 min" },
  { id: "mnemonic", goal: "memorize", name: "Memory tricks", tip: "For lists and facts that just won't stick. Gets you acronyms and pictures to remember.", time: "5 min" },
  { id: "teach", goal: "understand", name: "Teach it back", tip: "Explain it in your own words (the Feynman technique). If you can't, you don't understand it yet.", time: "10 min" },
  { id: "blurt", goal: "understand", name: "Blurting", tip: "Close your notes, write everything you remember, then see exactly what you missed. Great for finding gaps.", time: "10 min" },
  { id: "quiz", goal: "test", name: "Practice quiz", tip: "Multiple choice with the reason behind each answer. Do it a few days before a test.", time: "5 to 15 min" },
  { id: "exam", goal: "test", name: "Mixed exam", tip: "Everything mixed, timed, no hints, like the real thing. Do this last.", time: "15 to 25 min" },
  { id: "plan", goal: "plan", name: "Weekly plan", tip: "Spreads your review over the week in small sessions, so you never need a last-minute cram.", time: "10 min a day" },
];
const GOALS = [["memorize", "To memorize it", "Facts, terms and formulas"], ["understand", "To really understand it", "Explain it, find your gaps"], ["test", "To test yourself", "Check you're ready"], ["plan", "To plan ahead", "A little each day"]];
const PERIODS = [["today", "Today", "Notes from the last two days, and what's due soon"], ["week", "This week", "Notes from the last 7 days, and what's due this week"], ["final", "Final", "Everything in this quarter"]];

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lev = (a, b) => { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; };
const sameAnswer = (a, b) => { const x = norm(a), y = norm(b); return !!x && (x === y || (y.length >= 5 && lev(x, y) <= 1)); };
const maskIdea = (d, c) => { const re = new RegExp(escRe(c), "i"); return re.test(d) ? d.replace(re, "_____") : null; };
const chunkText = (text, size) => { const out = []; let cur = ""; String(text || "").split("\n").forEach((l) => { if (cur.length + l.length > size && cur) { out.push(cur); cur = ""; } cur += l + "\n"; }); if (cur.trim()) out.push(cur); return out; };
const subjectOfMat = (m, tasks) => m.subject || tasks.find((t) => t.id === m.taskId)?.subject || "General";

function inPeriod(m, t, period, cq) {
  const now = Date.now(), due = t ? diffDays(t.deadline) : null;
  if (period === "final") return !t || (t.quarter || 1) === cq;
  if (period === "today") return m.at >= now - 1.5 * 864e5 || (due !== null && due >= -1 && due <= 2);
  return m.at >= now - 7 * 864e5 || (due !== null && due >= -7 && due <= 7);
}

// the inventory: every distinct idea in a note. The assistant does it properly; if it's busy, a plain sentence-by-sentence version keeps everything usable.
function localIdeas(text) {
  const parts = String(text || "").replace(/([.!?])\s+/g, "$1\n").split(/\n+/).map((x) => x.trim()).filter((x) => x.length >= 24);
  return parts.slice(0, 120).map((p) => {
    const words = p.replace(/[^\p{L}\p{N}\s-]/gu, "").split(/\s+/).filter(Boolean);
    const num = p.match(/\d[\d.,]+/); // a number with at least two characters, so a lone 2 in x^2 isn't the key word
    const key = [...words].filter((w) => /^\p{L}/u.test(w)).sort((a, b) => b.length - a.length)[0] || words[0] || "";
    return { t: words.slice(0, 5).join(" "), d: p.slice(0, 280), c: num ? num[0].replace(/[.,]$/, "") : key, k: "fact" };
  });
}
const DIGEST_SYSTEM = `You build a complete study inventory from class notes. List EVERY distinct idea a student could be tested on: each definition, term, rule, formula, step, date, name, cause and effect, and example. Never skip something and never merge two different ideas. Reply with ONLY JSON, no other text: {"ideas":[{"t":"short label, 2 to 6 words","d":"one clear sentence that states the fact","c":"the single most important word or number from d, copied exactly as written in d","k":"term|fact|formula|process|date|example"}]}`;
async function aiIdeas(text, title, subject) {
  const out = [];
  for (const ch of chunkText(text, 3000)) {
    const raw = await callClaude(DIGEST_SYSTEM, [{ role: "user", content: `Subject: ${subject}\nNote title: ${title}\n\nNOTES:\n${ch}` }]);
    const j = parseJSON(raw);
    if (!j || !Array.isArray(j.ideas)) throw new Error("bad inventory");
    j.ideas.forEach((x) => { if (x && x.t && x.d) out.push({ t: String(x.t).slice(0, 80), d: String(x.d).slice(0, 320), c: String(x.c || "").slice(0, 60), k: String(x.k || "fact").slice(0, 12) }); });
  }
  const seen = new Set();
  return out.filter((x) => { const k = norm(x.t + x.d); if (seen.has(k)) return false; seen.add(k); return true; });
}


// Reads every note that has no inventory yet (or whose text changed) and saves it for the whole class.
async function ensureInventory(items, kb, saveKb, onProgress, tried) {
  let cur = { ...kb };
  const stale = (x) => !cur[x.m.id] || cur[x.m.id].n !== (x.m.text || "").length;
  const todo = items.filter((x) => stale(x) || (cur[x.m.id]?.src === "local" && tried && !tried.has(x.m.id)));
  for (let i = 0; i < todo.length; i++) {
    const x = todo[i];
    if (onProgress) onProgress(`Reading your notes, ${i + 1} of ${todo.length}`);
    if (tried) tried.add(x.m.id);
    let ideas, src = "ai";
    try { ideas = await aiIdeas(x.m.text || "", x.m.title, x.subject); if (!ideas.length) throw new Error("none"); }
    catch { if (cur[x.m.id] && cur[x.m.id].n === (x.m.text || "").length) continue; ideas = localIdeas(x.m.text); src = "local"; }
    const entry = { n: (x.m.text || "").length, at: Date.now(), src, ideas };
    cur = { ...cur, [x.m.id]: entry };
    saveKb(x.m.id, entry);
  }
  return cur;
}
const ideaLines = (ideas) => ideas.map((i) => `- ${i.t}: ${i.d}`).join("\n");
// does a piece of writing mention this idea? (checks its key word, or most of its label)
const ideaCovered = (text, idea) => {
  const h = norm(text);
  if (idea.c && idea.c.length >= 3 && h.includes(norm(idea.c))) return true;
  const w = norm(idea.t).split(" ").filter((x) => x.length > 3);
  return w.length > 0 && w.filter((x) => h.includes(x)).length / w.length >= 0.6;
};

// personal study data (your flashcard boxes, sessions, weekly plan): private to you
function useStudy(user) {
  const [study, setS] = useState(null);
  const ref = useRef(null);
  const timer = useRef(null);
  useEffect(() => {
    let dead = false;
    store.get(`u:${user}:study`, true).then((v) => { if (dead) return; const s = { cards: {}, log: [], plan: null, ...(v && typeof v === "object" ? v : {}) }; ref.current = s; setS(s); });
    return () => { dead = true; };
  }, [user]);
  const update = useCallback((fn) => {
    const next = fn(ref.current || { cards: {}, log: [], plan: null });
    ref.current = next; setS(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => store.set(`u:${user}:study`, next, true), 700);
  }, [user]);
  return [study, update];
}
const missCard = (s, id) => ({ ...s, cards: { ...s.cards, [id]: { ...(s.cards[id] || { s: 0, m: 0 }), b: 1, due: todayISO(), s: ((s.cards[id] || {}).s || 0) + 1, m: ((s.cards[id] || {}).m || 0) + 1 } } });
const logSession = (s, kind, subj, n, ok) => ({ ...s, log: [...(s.log || []).slice(-79), { at: Date.now(), kind, subj, n, ok }] });

function RunShell({ title, sub, step, total, onExit, children }) {
  return (
    <div className="run">
      <button className="back" onClick={onExit}><ChevronLeft size={16} />Back to study</button>
      <h1 className="h1" style={{ marginBottom: 2 }}>{title}</h1>
      {sub && <p className="sub" style={{ marginBottom: 12 }}>{sub}</p>}
      {total > 0 && <div className="gbar runBar" aria-label={`${step} of ${total}`}><i style={{ width: `${Math.min(100, (step / total) * 100)}%` }} /></div>}
      {children}
    </div>
  );
}
const Finish = ({ title, lines, onExit, again }) => (
  <div className="runDone">
    <div className="mcIcon" data-on="1"><Check size={26} /></div>
    <h2 className="serif" style={{ fontSize: 28, fontWeight: 400, margin: "0 0 8px" }}>{title}</h2>
    {lines.map((l, i) => <p key={i} style={{ margin: "0 0 6px", color: C.muted, lineHeight: 1.5 }}>{l}</p>)}
    <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
      {again && <button className="btn accent" onClick={again}>Go again</button>}
      <button className="btn ghost" onClick={onExit}>Done</button>
    </div>
  </div>
);

/* Flashcards with spaced repetition (Leitner boxes). */
function CardsRun({ ideas, study, update, onExit, label }) {
  const today = todayISO();
  const build = (ahead) => {
    const due = [], fresh = [], rest = [];
    ideas.forEach((i) => { const c = study.cards[i.id]; if (!c) fresh.push(i); else if (c.due <= today) due.push(i); else rest.push(i); });
    due.sort((a, b) => study.cards[a.id].due.localeCompare(study.cards[b.id].due));
    return [...due, ...shuffle(fresh), ...(ahead ? shuffle(rest) : [])].slice(0, ahead && !due.length && !fresh.length ? 10 : 24);
  };
  const [q, setQ] = useState(() => build(false));
  const [total, setTotal] = useState(q.length);
  const [flip, setFlip] = useState(false);
  const [rev, setRev] = useState(false);
  const [st, setSt] = useState({ again: 0, good: 0, easy: 0 });
  const card = q[0];
  const rate = (g) => {
    update((s) => {
      const c = s.cards[card.id] || { b: 0, s: 0, m: 0 };
      const b = g === 0 ? 1 : Math.min(5, Math.max(1, c.b) + g);
      return { ...s, cards: { ...s.cards, [card.id]: { b, due: g === 0 ? today : addDays(today, BOX_DAYS[b]), s: c.s + 1, m: c.m + (g === 0 ? 1 : 0) } } };
    });
    setSt((x) => ({ ...x, [["again", "good", "easy"][g]]: x[["again", "good", "easy"][g]] + 1 }));
    Sound.play(g === 0 ? "tap" : "pop");
    setFlip(false);
    setQ((c) => (g === 0 ? [...c.slice(1), card] : c.slice(1)));
  };
  useEffect(() => { if (total > 0 && q.length === 0) update((s) => logSession(s, "cards", label, total, st.good + st.easy)); }, [q.length]);
  useEffect(() => { // space flips, 1 / 2 / 3 rate
    const k = (e) => {
      if (!card || e.target.closest("input,textarea") || e.metaKey || e.ctrlKey) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlip((f) => !f); }
      else if (flip && "123".includes(e.key) && e.key) rate(Number(e.key) - 1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  if (total === 0) {
    const next = ideas.map((i) => study.cards[i.id]?.due).filter(Boolean).sort()[0];
    return (
      <RunShell title="Flashcards" onExit={onExit}>
        <Finish title="Nothing is due" lines={[`Every card in this set is on schedule${next ? `, the next one is due ${relLabel(next).toLowerCase()}` : ""}.`, "Come back then, or study a few early."]} onExit={onExit}
          again={() => { const n = build(true); setQ(n); setTotal(n.length); }} />
      </RunShell>
    );
  }
  if (!card) {
    const tomorrow = ideas.filter((i) => study.cards[i.id]?.due === addDays(today, 1)).length;
    return (
      <RunShell title="Flashcards" onExit={onExit}>
        <Finish title="Session complete" lines={[`${st.good + st.easy} of ${total} went well${st.again ? `, ${st.again} will come back sooner` : ""}.`, tomorrow ? `${tomorrow} card${tomorrow > 1 ? "s" : ""} will be waiting tomorrow.` : "Cards you know come back later and later."]} onExit={onExit} />
      </RunShell>
    );
  }
  const front = rev ? card.d : card.t, back = rev ? card.t : card.d;
  const box = (study.cards[card.id]?.b || 0);
  return (
    <RunShell title="Flashcards" sub={`${card.subject}, ${card.mt}`} step={total - q.length} total={total} onExit={onExit}>
      <button className="fc" data-flip={flip ? 1 : 0} onClick={() => { Sound.play("tap"); setFlip(!flip); }} aria-label={flip ? "Hide the answer" : "Show the answer"}>
        <small>{flip ? (rev ? "Term" : "Answer") : (rev ? "Meaning" : "Term")}{box ? `, box ${box}` : ", new"}</small>
        <span className="serif">{flip ? back : front}</span>
        {!flip && <em>Tap to flip</em>}
      </button>
      {flip ? (
        <div className="rateRow">
          <button className="btn ghost" onClick={() => rate(0)}>Again<small>soon</small></button>
          <button className="btn accent" onClick={() => rate(1)}>Good<small>later</small></button>
          <button className="btn ghost" onClick={() => rate(2)}>Easy<small>much later</small></button>
        </div>
      ) : <button className="back" style={{ margin: "14px auto 0" }} onClick={() => setRev(!rev)}>{rev ? "Show the term first" : "Show the meaning first"}</button>}
    </RunShell>
  );
}

/* Fill in the blank: the key word is hidden, type it. */
function ClozeRun({ ideas, update, onExit, label }) {
  const [items] = useState(() => shuffle(ideas.filter((i) => i.c && i.c.length >= 2 && maskIdea(i.d, i.c))).slice(0, 15));
  const [idx, setIdx] = useState(0);
  const [val, setVal] = useState("");
  const [res, setRes] = useState(null);
  const [score, setScore] = useState(0);
  if (items.length === 0) return <RunShell title="Fill the blanks" onExit={onExit}><Finish title="Nothing to blank out" lines={["These notes don't have sentences with a clear key word. Try flashcards or blurting for them."]} onExit={onExit} /></RunShell>;
  if (idx >= items.length) return <RunShell title="Fill the blanks" onExit={onExit}><Finish title={`${score} of ${items.length}`} lines={[score === items.length ? "Every blank right." : "The ones you missed are now at the front of your flashcards."]} onExit={onExit} /></RunShell>;
  const it = items[idx];
  const check = () => {
    const ok = sameAnswer(val, it.c);
    setRes(ok); Sound.play(ok ? "done" : "err");
    if (ok) setScore((x) => x + 1); else update((s) => missCard(s, it.id));
    if (idx === items.length - 1) update((s) => logSession(s, "cloze", label, items.length, score + (ok ? 1 : 0)));
  };
  const next = () => { setIdx(idx + 1); setVal(""); setRes(null); };
  return (
    <RunShell title="Fill the blanks" sub={`${it.subject}, ${it.mt}`} step={idx} total={items.length} onExit={onExit}>
      <div className="card runCard">
        <p className="serif clozeText">{maskIdea(it.d, it.c)}</p>
        <input className="input" autoFocus value={val} disabled={res !== null} placeholder="Type the missing word" onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (res === null ? val.trim() && check() : next())} />
        {res !== null && <p className={res ? "fbOk" : "fbBad"}>{res ? "Correct." : <>The answer is <b>{it.c}</b>.</>}</p>}
        {res === null ? <button className="btn accent full" disabled={!val.trim()} onClick={check}>Check</button> : <button className="btn accent full" onClick={next}>{idx === items.length - 1 ? "Finish" : "Next"}</button>}
        {res === null && <button className="back" style={{ margin: "10px auto 0" }} onClick={() => { setRes(false); update((s) => missCard(s, it.id)); }}>Show me</button>}
      </div>
    </RunShell>
  );
}

/* Match each term with its meaning. */
function MatchRun({ ideas, update, onExit, label }) {
  const clip = (s) => (s.length > 96 ? s.slice(0, 94).trimEnd() + "..." : s);
  const [rounds] = useState(() => { const sh = shuffle(ideas); const r = []; for (let i = 0; i < sh.length && r.length < 4; i += 5) r.push(sh.slice(i, i + 5)); return r.filter((x) => x.length >= 2); });
  const [ri, setRi] = useState(0);
  const [right] = useState(() => rounds.map((r) => shuffle(r)));
  const [pickL, setPickL] = useState(null);
  const [got, setGot] = useState({});
  const [bad, setBad] = useState(null);
  const [slips, setSlips] = useState(0);
  if (rounds.length === 0) return <RunShell title="Match pairs" onExit={onExit}><Finish title="Not enough to match" lines={["Add a little more material, then try again."]} onExit={onExit} /></RunShell>;
  if (ri >= rounds.length) return <RunShell title="Match pairs" onExit={onExit}><Finish title="All matched" lines={[slips === 0 ? "Not a single slip." : `${slips} slip${slips > 1 ? "s" : ""} on the way.`]} onExit={onExit} /></RunShell>;
  const cur = rounds[ri], rr = right[ri];
  const pickR = (id) => {
    if (pickL === null || got[id]) return;
    if (pickL === id) {
      Sound.play("pop"); const g = { ...got, [id]: true }; setGot(g); setPickL(null);
      if (cur.every((x) => g[x.id])) { setTimeout(() => { setRi((n) => n + 1); setGot({}); if (ri === rounds.length - 1) update((s) => logSession(s, "match", label, rounds.flat().length, rounds.flat().length)); }, 650); }
    } else { Sound.play("err"); setSlips((n) => n + 1); update((s) => missCard(s, pickL)); setBad(id); setPickL(null); setTimeout(() => setBad(null), 500); }
  };
  return (
    <RunShell title="Match pairs" sub="Tap a term, then its meaning." step={ri} total={rounds.length} onExit={onExit}>
      <div className="matchGrid">
        <div>{cur.map((x) => <button key={x.id} className="mBtn" data-on={pickL === x.id ? 1 : 0} data-done={got[x.id] ? 1 : 0} disabled={!!got[x.id]} onClick={() => { Sound.play("tap"); setPickL(x.id); }}>{x.t}</button>)}</div>
        <div>{rr.map((x) => <button key={x.id} className="mBtn small" data-bad={bad === x.id ? 1 : 0} data-done={got[x.id] ? 1 : 0} disabled={!!got[x.id]} onClick={() => pickR(x.id)}>{clip(x.d)}</button>)}</div>
      </div>
    </RunShell>
  );
}

/* Memory tricks: an image, rhyme or acronym for each idea. */
function MnemonicRun({ ideas, onExit }) {
  const groups = useMemo(() => { const sh = ideas.slice(0, 40); const g = []; for (let i = 0; i < sh.length; i += 5) g.push(sh.slice(i, i + 5)); return g; }, [ideas]);
  const [shown, setShown] = useState(1);
  const [res, setRes] = useState({});
  useEffect(() => {
    const gi = shown - 1;
    if (res[gi] || !groups[gi]) return;
    let dead = false;
    (async () => {
      const list = groups[gi].map((x, i) => `${i + 1}. ${x.t}: ${x.d}`).join("\n");
      try {
        const raw = await callClaude("You help students remember facts. Reply with ONLY JSON.", [{ role: "user", content: `For each numbered idea write one short memory trick: a vivid mental picture, a rhyme, or a silly sentence a student can picture. Under 25 words each. Reply ONLY {"m":[{"n":1,"trick":"..."}]}\n\n${list}` }]);
        const j = parseJSON(raw);
        const map = {}; (j?.m || []).forEach((x) => { if (x && x.trick) map[Number(x.n) - 1] = String(x.trick).slice(0, 220); });
        if (!dead) setRes((r) => ({ ...r, [gi]: { tricks: map, ai: Object.keys(map).length > 0 } }));
      } catch { if (!dead) setRes((r) => ({ ...r, [gi]: { tricks: {}, ai: false } })); }
    })();
    return () => { dead = true; };
  }, [shown, groups]);
  return (
    <RunShell title="Memory tricks" sub="Say each one out loud, and picture it." onExit={onExit}>
      {groups.slice(0, shown).map((g, gi) => (
        <div className="card runCard" key={gi} style={{ marginBottom: 12 }}>
          <div className="meta" style={{ marginBottom: 10 }}>{g[0].subject}, {g[0].mt}</div>
          {!res[gi] && <p className="meta">Thinking up tricks<Dots /></p>}
          {res[gi] && !res[gi].ai && <p className="trick"><b>{g.map((x) => (x.t || "?")[0].toUpperCase()).join("")}</b> Make a sentence where each word starts with these letters, in this order: {g.map((x) => x.t).join(", ")}.</p>}
          {g.map((x, i) => (
            <div className="trickRow" key={x.id}>
              <b>{x.t}</b><span>{x.d}</span>
              {res[gi]?.tricks[i] && <p className="trick">{res[gi].tricks[i]}</p>}
            </div>
          ))}
        </div>
      ))}
      {shown < groups.length && <button className="btn ghost full" onClick={() => setShown(shown + 1)}>Show more ({ideas.slice(0, 40).length - shown * 5} left)</button>}
    </RunShell>
  );
}

/* Teach it back (Feynman): explain an idea in your own words, then get honest feedback. */
function TeachRun({ ideas, study, update, onExit, label }) {
  const [items] = useState(() => [...ideas].sort((a, b) => ((study.cards[b.id]?.m || 0) - (study.cards[a.id]?.m || 0)) || Math.random() - 0.5).slice(0, 5));
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [fb, setFb] = useState(null);
  const [busy, setBusy] = useState(false);
  const [solid, setSolid] = useState(0);
  if (items.length === 0) return <RunShell title="Teach it back" onExit={onExit}><Finish title="Nothing to teach yet" lines={["Add some notes first."]} onExit={onExit} /></RunShell>;
  if (idx >= items.length) return <RunShell title="Teach it back" onExit={onExit}><Finish title="Well explained" lines={[`${solid} of ${items.length} came out solid.`, "Anything shaky is now at the front of your flashcards."]} onExit={onExit} /></RunShell>;
  const it = items[idx];
  const check = async () => {
    setBusy(true);
    let r = null;
    try {
      const raw = await callClaude("You are a kind, precise tutor. Reply with ONLY JSON.", [{ role: "user", content: `The correct idea: ${it.t}. ${it.d}\n\nThe student explained it in their own words:\n"""${text.slice(0, 1500)}"""\n\nReply ONLY {"verdict":"solid" or "partly" or "not yet","good":"what they got right, one sentence","missing":"what is missing or wrong, one sentence (empty if nothing)","simpler":"a simple everyday analogy, one sentence"}` }]);
      const j = parseJSON(raw);
      if (j && j.verdict) r = { verdict: String(j.verdict), good: String(j.good || ""), missing: String(j.missing || ""), simpler: String(j.simpler || "") };
    } catch { /* fall through to the plain check */ }
    if (!r) {
      const hit = it.c && norm(text).includes(norm(it.c));
      const words = norm(it.d).split(" ").filter((w) => w.length > 4), have = words.filter((w) => norm(text).includes(w)).length;
      const v = hit && have / Math.max(1, words.length) > 0.4 ? "solid" : hit || have > 1 ? "partly" : "not yet";
      r = { verdict: v, good: hit ? `You used the key word, ${it.c}.` : "", missing: v === "solid" ? "" : "Compare with the notes below.", simpler: "" };
    }
    setFb(r); setBusy(false);
    if (r.verdict === "solid") { setSolid((n) => n + 1); Sound.play("done"); } else { update((s) => missCard(s, it.id)); Sound.play("pop"); }
    if (idx === items.length - 1) update((s) => logSession(s, "teach", label, items.length, solid + (r.verdict === "solid" ? 1 : 0)));
  };
  return (
    <RunShell title="Teach it back" sub={`${it.subject}, ${it.mt}`} step={idx} total={items.length} onExit={onExit}>
      <div className="card runCard">
        <p className="serif clozeText">Explain <b>{it.t}</b> as if you're teaching a younger student.</p>
        <textarea className="input" rows={5} autoFocus value={text} disabled={!!fb} placeholder="In your own words, no peeking at the notes..." onChange={(e) => setText(e.target.value)} />
        {!fb && <button className="btn accent full" style={{ marginTop: 12 }} disabled={text.trim().length < 12 || busy} onClick={check}>{busy ? <>Reading your explanation<Dots /></> : "Check my explanation"}</button>}
        {fb && (
          <div className="fbBox" data-v={fb.verdict === "solid" ? "ok" : "no"}>
            <b>{fb.verdict === "solid" ? "Solid." : fb.verdict === "partly" ? "Partly there." : "Not yet."}</b>
            {fb.good && <p>{fb.good}</p>}
            {fb.missing && <p>{fb.missing}</p>}
            {fb.simpler && <p className="meta">Try this picture: {fb.simpler}</p>}
            <p className="meta" style={{ marginTop: 8 }}>From the notes: {it.d}</p>
            <button className="btn accent full" style={{ marginTop: 12 }} onClick={() => { setIdx(idx + 1); setText(""); setFb(null); }}>{idx === items.length - 1 ? "Finish" : "Next idea"}</button>
          </div>
        )}
      </div>
    </RunShell>
  );
}

/* Blurting: write everything you remember with the notes closed, then see what you missed. */
function BlurtRun({ ideas, update, onExit, label }) {
  const topics = useMemo(() => { const m = new Map(); ideas.forEach((i) => { if (!m.has(i.mid)) m.set(i.mid, { mid: i.mid, title: i.mt, subject: i.subject, list: [] }); m.get(i.mid).list.push(i); }); return [...m.values()]; }, [ideas]);
  const [topic, setTopic] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);
  const set = topic === "mix" ? shuffle(ideas).slice(0, 20) : topic ? topics.find((t) => t.mid === topic)?.list.slice(0, 40) || [] : [];
  const grade = async () => {
    setBusy(true);
    let res = null;
    try {
      const list = set.map((x, i) => `${i + 1}. ${x.t}: ${x.d}`).join("\n");
      const raw = await callClaude("You mark a student's memory test fairly and strictly. Reply with ONLY JSON.", [{ role: "user", content: `These are the ideas the student should know, numbered:\n${list}\n\nThe student wrote this from memory:\n"""${text.slice(0, 4000)}"""\n\nFor each numbered idea decide if the writing shows they remember it ("got"), only partly ("partly"), or not at all ("missed"). Also list statements that are wrong. Reply ONLY {"got":[numbers],"partly":[numbers],"missed":[numbers],"wrong":[{"said":"","fix":""}]}` }]);
      const j = parseJSON(raw);
      if (j && (Array.isArray(j.got) || Array.isArray(j.missed))) {
        const ok = (a) => (Array.isArray(a) ? a.map(Number).filter((n) => n >= 1 && n <= set.length) : []);
        const got = new Set(ok(j.got)), partly = new Set(ok(j.partly).filter((n) => !got.has(n)));
        const missed = set.map((_, i) => i + 1).filter((n) => !got.has(n) && !partly.has(n)); // anything not marked counts as missed, so nothing slips through
        res = { got: [...got], partly: [...partly], missed, wrong: Array.isArray(j.wrong) ? j.wrong.filter((w) => w && w.said).slice(0, 6) : [] };
      }
    } catch { /* fall through to the plain check */ }
    if (!res) {
      const t = norm(text), got = [], missed = [];
      set.forEach((x, i) => { const hit = (x.c && x.c.length >= 3 && t.includes(norm(x.c))) || norm(x.t).split(" ").filter((w) => w.length > 3).some((w) => t.includes(w)); (hit ? got : missed).push(i + 1); });
      res = { got, partly: [], missed, wrong: [], plain: true };
    }
    setOut(res); setBusy(false); Sound.play("done");
    update((s) => logSession(s, "blurt", label, set.length, res.got.length));
  };
  if (!topic) {
    return (
      <RunShell title="Blurting" sub="Pick what to blurt about. Then close your notes." onExit={onExit}>
        <div className="topicList">
          {topics.length > 1 && <button className="row" onClick={() => { Sound.play("tap"); setTopic("mix"); }}><div className="rowMain"><div className="rowTitle">A mix of everything</div><div className="rowMeta"><span>Up to 20 ideas picked at random</span></div></div></button>}
          {topics.map((t) => (
            <button key={t.mid} className="row" onClick={() => { Sound.play("tap"); setTopic(t.mid); }}>
              <div className="rowMain"><div className="rowTitle">{t.title}</div><div className="rowMeta"><span><span className="dot" style={{ background: subjColor(t.subject) }} />{t.subject}</span><span>{t.list.length} ideas</span></div></div>
            </button>
          ))}
        </div>
      </RunShell>
    );
  }
  if (out) {
    const gotN = out.got.length + out.partly.length * 0.5;
    return (
      <RunShell title="What you remembered" onExit={onExit}>
        <div className="doneHero"><div><b>{Math.round(gotN)}</b><span> of {set.length} ideas</span></div><div className="gbar"><i style={{ width: `${(gotN / set.length) * 100}%` }} /></div>
          {out.plain && <small>The assistant was busy, so this was a quick keyword check. Treat it as a guide.</small>}</div>
        {out.missed.length > 0 && <h3 className="sectionTitle" style={{ marginTop: 6 }}>You missed</h3>}
        {out.missed.map((n) => <div className="trickRow" key={n}><b>{set[n - 1].t}</b><span>{set[n - 1].d}</span></div>)}
        {out.partly.length > 0 && <h3 className="sectionTitle">Only partly</h3>}
        {out.partly.map((n) => <div className="trickRow" key={n}><b>{set[n - 1].t}</b><span>{set[n - 1].d}</span></div>)}
        {out.wrong.length > 0 && <h3 className="sectionTitle">Not quite right</h3>}
        {out.wrong.map((w, i) => <div className="trickRow" key={i}><b>You wrote: {w.said}</b><span>{w.fix}</span></div>)}
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          {(out.missed.length + out.partly.length) > 0 && <button className="btn accent" onClick={() => { [...out.missed, ...out.partly].forEach((n) => update((s) => missCard(s, set[n - 1].id))); Sound.play("add"); onExit(); }}>Add these to my flashcards</button>}
          <button className="btn ghost" onClick={() => { setTopic(null); setOut(null); setText(""); }}>Blurt another</button>
        </div>
      </RunShell>
    );
  }
  return (
    <RunShell title="Blurting" sub={`${set.length} ideas in this one. Notes closed, write all you remember.`} onExit={() => { setTopic(null); setText(""); }}>
      <textarea className="input blurtBox" rows={12} autoFocus value={text} placeholder="Everything you can remember. Don't worry about order or neatness." onChange={(e) => setText(e.target.value)} />
      <button className="btn accent full" style={{ marginTop: 12 }} disabled={text.trim().length < 20 || busy} onClick={grade}>{busy ? <>Checking what you missed<Dots /></> : "Check what I missed"}</button>
    </RunShell>
  );
}

/* Practice quiz and mixed exam. The assistant writes a question for every idea in the batch, then anything it skipped is asked for again. */
const mcFallback = (idea, pool) => {
  const masked = idea.c && maskIdea(idea.d, idea.c);
  const key = (p) => (masked ? p.c : p.t), right = masked ? idea.c : idea.t;
  const cand = pool.filter((p) => p.id !== idea.id && key(p) && norm(key(p)) !== norm(right));
  const others = [...shuffle(cand.filter((p) => p.subject === idea.subject)), ...shuffle(cand.filter((p) => p.subject !== idea.subject))].map(key).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3); // same-subject look-alikes first
  const c = [right, ...others];
  ["None of these", "All of these", "Not enough information"].forEach((e) => { if (c.length < 4) c.push(e); });
  const a = shuffle(c);
  return { type: "mc", ref: [idea.id], q: masked ? `Fill in the blank: "${masked}"` : `Which term matches this? "${idea.d}"`, c: a, a: a.indexOf(right), w: `${idea.t}: ${idea.d}` };
};
async function buildQuiz(ideas, onProgress) {
  const items = [], covered = new Set();
  const batchRun = async (batch) => {
    const list = batch.map((x, i) => `${i + 1}. ${x.t}: ${x.d}`).join("\n");
    const raw = await callClaude("You write fair multiple-choice questions for students. Reply with ONLY JSON.", [{ role: "user", content: `Write one question for EACH numbered idea so every idea is covered. Test understanding, not copying. Four choices, exactly one correct, plausible wrong choices from the same topic. Reply ONLY {"q":[{"n":idea number,"q":"question","c":["a","b","c","d"],"a":index of the correct choice 0 to 3,"w":"one-sentence reason"}]}\n\n${list}` }]);
    const j = parseJSON(raw);
    (j?.q || []).forEach((x) => {
      const n = Number(x?.n) - 1, idea = batch[n];
      if (idea && x.q && Array.isArray(x.c) && x.c.length === 4 && Number.isInteger(x.a) && x.a >= 0 && x.a < 4 && !covered.has(idea.id)) {
        covered.add(idea.id);
        items.push({ type: "mc", ref: [idea.id], q: String(x.q), c: x.c.map(String), a: x.a, w: String(x.w || `${idea.t}: ${idea.d}`) });
      }
    });
  };
  const size = 8;
  for (let i = 0; i < ideas.length; i += size) {
    onProgress(`Writing questions ${Math.min(i + size, ideas.length)} of ${ideas.length}`);
    try { await batchRun(ideas.slice(i, i + size)); } catch { /* the plain version below fills in */ }
  }
  const missing = ideas.filter((x) => !covered.has(x.id));
  if (missing.length && missing.length < ideas.length) {
    onProgress(`Covering ${missing.length} ideas that were skipped`);
    for (let i = 0; i < missing.length; i += size) { try { await batchRun(missing.slice(i, i + size)); } catch { /* fall back */ } }
  }
  ideas.filter((x) => !covered.has(x.id)).forEach((x) => { items.push(mcFallback(x, ideas)); covered.add(x.id); });
  return { items, covered: covered.size };
}
function QuizRun({ ideas, kind, update, onExit, label }) {
  const exam = kind === "exam";
  const [len, setLen] = useState(null);
  const [prog, setProg] = useState("");
  const [items, setItems] = useState(null);
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState(null);
  const [ans, setAns] = useState([]);
  const [t0] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const keyRef = useRef(null);
  useEffect(() => { const k = (e) => keyRef.current && keyRef.current(e); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  const lens = [[10, "Quick, 10"], [20, "Standard, 20"], [ideas.length, `Everything, ${ideas.length}`]].filter((x, i, a) => x[0] > 0 && a.findIndex((y) => y[0] === x[0]) === i);
  useEffect(() => { if (!exam || !items) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [exam, items]);
  const go = async (n) => {
    setLen(n);
    const weak = shuffle(ideas).slice(0, Math.min(n, ideas.length));
    const { items: made } = await buildQuiz(weak, setProg);
    let list = made;
    if (exam) {
      const cl = shuffle(ideas.filter((i) => i.c && maskIdea(i.d, i.c))).slice(0, Math.max(3, Math.round(n / 3))).map((i) => ({ type: "cloze", ref: [i.id], q: maskIdea(i.d, i.c), a: i.c, w: `${i.t}: ${i.d}` }));
      list = [...made, ...cl];
    }
    setItems(shuffle(list));
  };
  if (!len) {
    return (
      <RunShell title={exam ? "Mixed exam" : "Practice quiz"} sub={exam ? "Timed, mixed questions, no hints until the end." : "How long do you want it?"} onExit={onExit}>
        <div className="chips" style={{ flexWrap: "wrap", overflow: "visible", padding: 0 }}>{lens.map(([n, l]) => <button key={n} className="chip" onClick={() => go(n)}>{l}</button>)}</div>
        <p className="meta" style={{ marginTop: 14 }}>"Everything" asks about every idea in your notes, so nothing is skipped.</p>
      </RunShell>
    );
  }
  if (!items) return <RunShell title={exam ? "Mixed exam" : "Practice quiz"} onExit={onExit}><p className="meta" style={{ marginTop: 20 }}>{prog || "Getting ready"}<Dots /></p></RunShell>;
  if (idx >= items.length) {
    const right = ans.filter((a) => a.ok).length;
    const wrong = ans.filter((a) => !a.ok);
    return (
      <RunShell title={exam ? "Exam finished" : "Quiz finished"} onExit={onExit}>
        <div className="doneHero"><div><b>{right}</b><span> of {items.length} right{exam ? `, in ${Math.max(1, Math.round((now - t0) / 60000))} min` : ""}</span></div><div className="gbar"><i style={{ width: `${(right / items.length) * 100}%` }} /></div><small>{wrong.length ? "What you missed, with the reason:" : "A perfect score."}</small></div>
        {wrong.map((a, i) => <div className="trickRow" key={i}><b>{a.item.q}</b><span>Answer: {a.item.type === "mc" ? a.item.c[a.item.a] : a.item.a}. {a.item.w}</span></div>)}
        <button className="btn ghost" style={{ marginTop: 16 }} onClick={onExit}>Done</button>
      </RunShell>
    );
  }
  const it = items[idx];
  const answered = pick !== null;
  const submit = (ok, chosen) => {
    setAns((a) => [...a, { item: it, ok, chosen }]);
    if (!ok) update((s) => missCard(s, it.ref[0]));
    if (idx === items.length - 1) update((s) => logSession(s, kind, label, items.length, ans.filter((a) => a.ok).length + (ok ? 1 : 0)));
  };
  const advance = () => { setIdx(idx + 1); setPick(null); };
  keyRef.current = (e) => { // 1 to 4 pick an answer
    if (it.type !== "mc" || e.target.closest("input,textarea") || e.metaKey || e.ctrlKey) return;
    const n = Number(e.key) - 1;
    if (n >= 0 && n < it.c.length && (!answered || exam)) { setPick(n); Sound.play("tap"); if (!exam) submit(n === it.a, n); }
  };
  return (
    <RunShell title={exam ? "Mixed exam" : "Practice quiz"} sub={exam ? `${Math.floor((now - t0) / 60000)}:${String(Math.floor(((now - t0) / 1000) % 60)).padStart(2, "0")}` : undefined} step={idx} total={items.length} onExit={onExit}>
      <div className="card runCard">
        <p className="serif clozeText">{it.type === "cloze" ? it.q : it.q}</p>
        {it.type === "mc" ? (
          <div className="choices">
            {it.c.map((c, i) => (
              <button key={i} className="choice" data-state={answered && !exam ? (i === it.a ? "right" : i === pick ? "wrong" : "") : pick === i ? "picked" : ""} disabled={answered && !exam}
                onClick={() => { if (answered && !exam) return; setPick(i); Sound.play("tap"); if (!exam) submit(i === it.a, i); }}>{c}</button>
            ))}
          </div>
        ) : <ClozeAnswer key={idx} item={it} onSubmit={(ok, v) => { setPick(0); submit(ok, v); if (exam) setTimeout(advance, 150); }} locked={answered && !exam} />}
        {!exam && answered && <><p className={ans[ans.length - 1]?.ok ? "fbOk" : "fbBad"}>{ans[ans.length - 1]?.ok ? "Correct." : "Not quite."} {it.w}</p><button className="btn accent full" onClick={advance}>{idx === items.length - 1 ? "Finish" : "Next"}</button></>}
        {exam && it.type === "mc" && <button className="btn accent full" style={{ marginTop: 14 }} disabled={pick === null} onClick={() => { submit(pick === it.a, pick); advance(); }}>{idx === items.length - 1 ? "Finish exam" : "Next"}</button>}
      </div>
    </RunShell>
  );
}
function ClozeAnswer({ item, onSubmit, locked }) {
  const [v, setV] = useState("");
  return (
    <div>
      <input className="input" autoFocus value={v} disabled={locked} placeholder="Type the missing word" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && v.trim() && onSubmit(sameAnswer(v, item.a), v)} />
      {!locked && <button className="btn accent full" style={{ marginTop: 12 }} disabled={!v.trim()} onClick={() => onSubmit(sameAnswer(v, item.a), v)}>Check</button>}
    </div>
  );
}

/* A week of small sessions, spread out, so it never turns into a one-night cram. */
const PLAN_PATTERN = ["teach", "cards", "cloze", "quiz", "blurt", "match", "exam"];
function PlanRun({ subjects, study, update, onStart, onExit }) {
  const ws = weekStartOf(todayISO());
  const subs = subjects.length ? subjects : ["Everything"];
  const days = Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i));
  const plan = days.map((d, i) => {
    const sessions = [{ tech: PLAN_PATTERN[i % PLAN_PATTERN.length], subj: subs[i % subs.length] }];
    if (subs.length > 1) sessions.push({ tech: "cards", subj: subs[(i + 1) % subs.length] });
    return { d, sessions };
  });
  const done = (study.plan && study.plan.ws === ws && study.plan.done) || {};
  const key = (d, s) => `${d}:${s.tech}:${s.subj}`;
  const toggle = (k) => update((s) => ({ ...s, plan: { ws, done: { ...((s.plan && s.plan.ws === ws && s.plan.done) || {}), [k]: !((s.plan && s.plan.ws === ws && s.plan.done) || {})[k] } } }));
  const total = plan.reduce((n, p) => n + p.sessions.length, 0), got = Object.values(done).filter(Boolean).length;
  return (
    <RunShell title="Weekly plan" sub="About 10 minutes a day. Little and often beats one long night." onExit={onExit}>
      <div className="doneHero"><div><b>{got}</b><span> of {total} sessions done</span></div><div className="gbar"><i style={{ width: `${(got / total) * 100}%` }} /></div></div>
      {plan.map((p, i) => (
        <div className="planDay" key={p.d} data-today={i === 0 ? 1 : 0}>
          <div className="planWhen">{i === 0 ? "Today" : i === 1 ? "Tomorrow" : parse(p.d).toLocaleDateString(undefined, { weekday: "long" })}</div>
          {p.sessions.map((s) => {
            const t = TECHS.find((x) => x.id === s.tech), k = key(p.d, s);
            return (
              <div className="planRow" key={k}>
                <button className="check" data-s={done[k] ? "done" : "todo"} aria-label="Mark this session done" onClick={() => { Sound.play(done[k] ? "tap" : "done"); toggle(k); }}>{done[k] && <Check size={15} strokeWidth={3} />}</button>
                <div className="rowMain"><div className="rowTitle">{t.name}</div><div className="rowMeta"><span><span className="dot" style={{ background: subjColor(s.subj) }} />{s.subj}</span><span>{t.time}</span></div></div>
                <button className="btn ghost small" onClick={() => onStart(s.tech, s.subj === "Everything" ? [] : [s.subj])}>Start</button>
              </div>
            );
          })}
        </div>
      ))}
    </RunShell>
  );
}

const REC = { today: ["cards", "cloze"], week: ["teach", "quiz"], final: ["blurt", "exam"] };
function StudyHub({ tasks, materials, subjects, kb, saveKb, user, classQuarter, scope }) {
  const saved = (() => { try { return JSON.parse(localStorage.getItem("hr:study") || "{}"); } catch { return {}; } })();
  const [period, setPeriod] = useState(PERIODS.some((p) => p[0] === saved.period) ? saved.period : "week");
  const [pick, setPick] = useState(Array.isArray(saved.pick) ? saved.pick : []);
  const [focus, setFocus] = useState(null); // study just one task's notes
  useEffect(() => { try { localStorage.setItem("hr:study", JSON.stringify({ period, pick })); } catch { /* storage blocked */ } }, [period, pick]);
  useEffect(() => { if (!scope) return; setFocus(scope.taskId || null); if (scope.period) setPeriod(scope.period); if (scope.taskId) setPick([]); else if (scope.subjects) setPick(scope.subjects); }, [scope?.id]);
  const [study, update] = useStudy(user);
  const [run, setRun] = useState(null);
  const [prep, setPrep] = useState("");
  const [note, setNote] = useState("");
  const tried = useRef(new Set());
  const withSubj = useMemo(() => materials.map((m) => ({ m, t: tasks.find((x) => x.id === m.taskId), subject: subjectOfMat(m, tasks) })), [materials, tasks]);
  const subsWithNotes = useMemo(() => [...new Set(withSubj.map((x) => x.subject))], [withSubj]);
  const pool = withSubj.filter((x) => (focus ? x.m.taskId === focus : inPeriod(x.m, x.t, period, classQuarter) && (pick.length === 0 || pick.includes(x.subject))));
  const focusTitle = focus ? tasks.find((t) => t.id === focus)?.title : null;
  const stale = (x) => !kb[x.m.id] || kb[x.m.id].n !== (x.m.text || "").length;
  const ideaCount = pool.reduce((n, x) => n + (stale(x) ? 0 : kb[x.m.id].ideas.length), 0);
  const unread = pool.filter(stale).length;
  const dueCards = useMemo(() => {
    if (!study) return 0;
    const t = todayISO();
    return Object.values(study.cards).filter((c) => c.due <= t).length;
  }, [study]);
  const weekSessions = study ? (study.log || []).filter((l) => l.at >= Date.now() - 7 * 864e5).length : 0;

  const prepare = () => ensureInventory(pool, kb, saveKb, setPrep, tried.current);
  const start = async (kind, subsOverride) => {
    setNote("");
    if (kind === "plan") { setRun({ kind, ideas: [], label: "plan" }); return; }
    if (subsOverride) setPick(subsOverride);
    if (pool.length === 0) { setNote("There are no notes in this selection yet. Try a longer period, or add some notes under By task."); Sound.play("err"); return; }
    setPrep("Getting your notes ready");
    const cur = await prepare();
    const ideas = pool.flatMap((x) => (cur[x.m.id]?.ideas || []).map((id, i) => ({ ...id, id: `${x.m.id}:${i}`, mid: x.m.id, mt: x.m.title, subject: x.subject })));
    setPrep("");
    if (ideas.length === 0) { setNote("Couldn't find anything to study in those notes."); return; }
    setRun({ kind, ideas, label: pick.length === 1 ? pick[0] : pick.length ? `${pick.length} subjects` : "Everything" });
  };
  const exit = () => setRun(null);
  if (!study) return <p className="meta" style={{ marginTop: 20 }}>Loading<Dots /></p>;
  if (run) {
    const p = { ideas: run.ideas, study, update, onExit: exit, label: run.label };
    return (
      <div>
        {run.kind === "cards" && <CardsRun {...p} />}
        {run.kind === "cloze" && <ClozeRun {...p} />}
        {run.kind === "match" && <MatchRun {...p} />}
        {run.kind === "mnemonic" && <MnemonicRun {...p} />}
        {run.kind === "teach" && <TeachRun {...p} />}
        {run.kind === "blurt" && <BlurtRun {...p} />}
        {(run.kind === "quiz" || run.kind === "exam") && <QuizRun {...p} kind={run.kind} />}
        {run.kind === "plan" && <PlanRun subjects={pick.length ? pick : subsWithNotes} study={study} update={update} onExit={exit} onStart={(k, s) => { setRun(null); setTimeout(() => start(k, s), 0); }} />}
      </div>
    );
  }
  return (
    <div className="study">
      {(dueCards > 0 || weekSessions > 0) && (
        <div className="studyStats">
          {dueCards > 0 && <span><b>{dueCards}</b> flashcard{dueCards > 1 ? "s" : ""} due today</span>}
          {weekSessions > 0 && <span><b>{weekSessions}</b> session{weekSessions > 1 ? "s" : ""} this week</span>}
        </div>
      )}
      <h3 className="stepLabel"><i>1</i>What do you want to review?</h3>
      {focus && <div className="focusPill"><span>Only <b>{focusTitle || "this task"}</b></span><button aria-label="Review everything again" onClick={() => { Sound.play("tap"); setFocus(null); }}><X size={14} /></button></div>}
      {!focus && <>
      <Segmented value={period} onChange={(v) => { Sound.play("tap"); setPeriod(v); }} options={PERIODS.map(([k, l]) => [k, l])} />
      <p className="meta" style={{ margin: "8px 0 10px" }}>{PERIODS.find((p) => p[0] === period)[2]}.</p>
      <div className="chips" style={{ flexWrap: "wrap", overflow: "visible", padding: 0 }}>
        <button className="chip" aria-pressed={pick.length === 0} onClick={() => { Sound.play("tap"); setPick([]); }}>Every subject</button>
        {(subsWithNotes.length ? subsWithNotes : subjects).map((s) => (
          <button key={s} className="chip" aria-pressed={pick.includes(s)} onClick={() => { Sound.play("tap"); setPick((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s])); }}>
            <span className="dot" style={{ background: subjColor(s), margin: 0 }} />{s}
          </button>
        ))}
      </div>
      </>}
      <div className="scopeLine">
        {pool.length === 0 ? "No notes in this selection yet." : <><b>{pool.length}</b> note{pool.length > 1 ? "s" : ""}{ideaCount > 0 && <>, <b>{ideaCount}</b> key ideas</>}{unread > 0 && <>, {unread} still to be read</>}. Every technique below uses all of them.</>}
      </div>
      <h3 className="stepLabel"><i>2</i>How do you want to review it?</h3>
      {GOALS.map(([g, title, sub]) => (
        <section key={g} className="goal">
          <div className="goalHead"><b>{title}</b><span>{sub}</span></div>
          <div className="techGrid">
            {TECHS.filter((t) => t.goal === g).map((t) => (
              <button key={t.id} className="tech" data-rec={!focus && (REC[period] || []).includes(t.id) ? 1 : 0} disabled={!!prep} onClick={() => { Sound.play("tap"); start(t.id); }}>
                {!focus && (REC[period] || []).includes(t.id) && <i className="recTag">Suggested {period === "today" ? "for today" : period === "week" ? "this week" : "for the final"}</i>}
                <b>{t.name}</b><span>{t.tip}</span><em>{t.time}</em>
              </button>
            ))}
          </div>
        </section>
      ))}
      {prep && <div className="prepBar" role="status"><i /> {prep}<Dots /></div>}
      {note && <p className="err" role="alert" style={{ marginTop: 14 }}>{note}</p>}
    </div>
  );
}

function ReviewTab({ tasks, progress, materials, weeklies, saveWeekly, user, addMaterial, removeMaterial, focusId, clearFocus, reviewStart, clearStart, onRefresh, subjects, kb, saveKb, classQuarter }) {
  const [sel, setSel] = useState(focusId || null);
  const [all, setAll] = useState(false);
  const [section, setSection] = useState("study");
  const [scope, setScope] = useState(null);
  const goStudy = (o) => { Sound.play("tap"); setSel(null); setSection("study"); setScope({ ...o, id: uid() }); };
  const [startWs, setStartWs] = useState(null);
  useEffect(() => {
    if (reviewStart) { setSection(reviewStart.section); setStartWs(reviewStart.ws || null); setSel(null); clearStart(); }
  }, [reviewStart]);
  useEffect(() => { if (focusId) { setSel(focusId); clearFocus(); } }, [focusId]);
  const task = tasks.find((t) => t.id === sel);
  if (task) return <ReviewDetail task={task} user={user} materials={materials} addMaterial={addMaterial} removeMaterial={removeMaterial} onBack={() => setSel(null)} onStudy={goStudy} kb={kb} saveKb={saveKb} />;
  const sorted = [...tasks].sort((a, b) => a.deadline.localeCompare(b.deadline));
  const upcoming = sorted.filter((t) => (progress[t.id] || "todo") !== "done");
  const list = upcoming.filter((t) => all || REVIEW_TYPES.includes(t.type) || materials.some((m) => m.taskId === t.id));
  return (
    <Scroll onRefresh={onRefresh}>
      <h1 className="h1">Review</h1>
      <p className="sub">
        {section === "study" ? "Choose what to review, then how. A little each day beats one long night."
          : section === "tasks" ? "Pick a quiz or study task to see shared notes, get a reviewer, practice, or flip flashcards."
          : section === "weekly" ? "One page covering what the class worked on and learned each week."
          : "Every note, upload and reviewer your class has stored."}
      </p>
      <Segmented value={section} onChange={setSection} tour="study-sections" options={[["study", "Study"], ["tasks", "By task"], ["weekly", "Weekly"], ["library", "Library"]]} />
      {section === "study" && <div style={{ marginTop: 18 }}><StudyHub tasks={tasks} materials={materials} subjects={subjects} kb={kb} saveKb={saveKb} user={user} classQuarter={classQuarter} scope={scope} /></div>}
      {section === "weekly" && <WeeklyReviewer key={startWs || "w"} initialWs={startWs} tasks={tasks} materials={materials} weeklies={weeklies} user={user} saveWeekly={saveWeekly} kb={kb} saveKb={saveKb} onStudy={goStudy} />}
      {section === "library" && <Library tasks={tasks} materials={materials} user={user} removeMaterial={removeMaterial} kb={kb} onStudy={goStudy} />}
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

function AskTab({ user, tasks, materials, progress, addTask, kb }) {
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
    const ctx = buildContext(tasks, materials, progress, user, kb);
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
  const [adminClasses, setAdminClasses] = useState([]);
  const [qErr, setQErr] = useState("");
  useEffect(() => { store.classes.list().then(setAdminClasses); }, []);
  const [mcLinks, setMcLinks] = useState(null);
  const loadMc = useCallback(async () => { const { data, error } = await supabase.rpc("mc_links_admin"); setMcLinks(error ? [] : data || []); }, []);
  useEffect(() => { if (MINECRAFT.on && tab === "minecraft") loadMc(); }, [tab, loadMc]);
  const unlinkAdmin = async (n) => { Sound.play("undo"); setMcLinks((c) => (c || []).filter((x) => x.mc_display !== n)); await supabase.rpc("mc_admin_unlink", { p_name: n }); };
  const setQuarter = async (id, q) => {
    setQErr(""); Sound.play("pop");
    setAdminClasses((c) => c.map((x) => (x.id === id ? { ...x, quarter: q } : x)));
    const { error } = await supabase.from("classes").update({ quarter: q }).eq("id", id);
    if (error) { setQErr("Couldn't change the quarter: " + error.message); store.classes.list().then(setAdminClasses); }
  };
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
  const tabs = [["suggestions", "Suggestions", Lightbulb], ["classes", "Classes", GraduationCap], ["minecraft", "Minecraft", Gamepad2]];
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
            {tab === "classes" && (
              <>
                <div className="heroCard spot">
                  <div className="heroBody">
                    <div className="heroDate">Admin</div>
                    <h1 className="h1">Classes</h1>
                    <p className="sub">Choose which quarter each class is in. New tasks start in that quarter, and the Done tab and Minecraft access look at it.</p>
                  </div>
                </div>
                {qErr && <p className="err" role="alert" style={{ marginTop: 14 }}>{qErr}</p>}
                {adminClasses.length === 0 && <div className="empty"><div className="serif">No classes yet</div>Classes appear here when students create them.</div>}
                {[...adminClasses].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })).map((c) => (
                  <div className="gcard" key={c.id} style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div><div className="serif" style={{ fontSize: 22 }}>{c.label}</div><div className="meta">Currently in quarter {c.quarter || 1}</div></div>
                      <Segmented value={String(c.quarter || 1)} options={QUARTERS.map((q) => [String(q), `Q${q}`])} onChange={(v) => setQuarter(c.id, Number(v))} />
                    </div>
                  </div>
                ))}
              </>
            )}
            {tab === "minecraft" && (
              <>
                <div className="heroCard spot">
                  <div className="heroBody">
                    <div className="heroDate">Admin</div>
                    <h1 className="h1">Minecraft</h1>
                    <p className="sub">{MINECRAFT.on ? "Students who linked a Minecraft name. Access follows their tasks by itself." : "Built and switched off. Turn it on in src/minecraft.config.js (steps in /minecraft/README.md)."}</p>
                  </div>
                  <div className="soonIcon"><Gamepad2 size={34} /></div>
                </div>
                {!MINECRAFT.on && <div className="empty"><div className="serif">Switched off</div>Nothing is shown to students until you turn it on.</div>}
                {MINECRAFT.on && mcLinks === null && <SkeletonRows />}
                {MINECRAFT.on && mcLinks && mcLinks.length === 0 && <div className="empty"><div className="serif">Nobody has linked a name yet</div>Names appear here once students finish their tasks and enter their username.</div>}
                {MINECRAFT.on && (mcLinks || []).map((l) => (
                  <div className="gcard" key={l.mc_display} style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div><div style={{ fontWeight: 500 }}>{l.mc_display}</div><div className="meta">{l.username}, class {l.class_id}</div></div>
                    <button className="btn ghost small" onClick={() => unlinkAdmin(l.mc_display)}>Unlink</button>
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
  clay: ["#C4623F", "#E08A66"],
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

function GroupsPanel({ groups, tasks, progress, subjects, defQuarter, onSave, onDelete, user, onJoin, onAddSubject }) {
  const [edit, setEdit] = useState(null); // null = list, {} = new, group = editing
  const [confirm, setConfirm] = useState(null);
  const [f, setF] = useState({ name: "", subject: "", quarter: defQuarter });
  const open = (g) => {
    setConfirm(null);
    setF(g ? { name: g.name, subject: g.subject, quarter: g.quarter } : { name: "", subject: "", quarter: defQuarter });
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
          <SubjectPicker subjects={subjects} value={f.subject} onChange={(v) => setF({ ...f, subject: v })} onAdd={onAddSubject} />
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
                {(() => {
                  const mem = g.members || [], mine = mem.includes(user);
                  return (
                    <div className="gMembers">
                      <span className="meta">{mem.length ? `${mem.length} in this group: ${mem.slice(0, 4).join(", ")}${mem.length > 4 ? ` and ${mem.length - 4} more` : ""}` : "Nobody has joined yet"}</span>
                      <button className="btn ghost small" aria-pressed={mine} onClick={() => { Sound.play(mine ? "undo" : "pop"); onJoin(g.id, !mine); }}>{mine ? "Leave" : "Join"}</button>
                    </div>
                  );
                })()}
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

/* ───────────────────────── boarding pass ─────────────────────────
   First sign-in: fill out the pass (username and class), get it stamped, tear off the stub,
   then a plane crosses the screen and the interface is underneath. */

// A zigzag edge, for the side of the pass that gets torn.
const TEAR = `polygon(0 0,100% 0,${Array.from({ length: 13 }, (_, i) => `${i % 2 ? 100 : 96.5}% ${((i + 1) * 100) / 14}%`).join(",")},100% 100%,0 100%)`;

function BoardingPass({ classes, setClasses, replay, name, classLabel, onSubmit, onTakeoff, onSignOut, onSkip }) {
  const [uname, setUname] = useState(replay ? name : "");
  const [cls, setCls] = useState(null);
  const [phase, setPhase] = useState("fill"); // fill, stamping, stamped, tearing
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const timers = useRef([]);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!replay) return undefined;
    const k = (e) => { if (e.key === "Escape" && phase === "fill") onSkip(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [replay, phase, onSkip]);
  const u = uname.trim().toLowerCase();
  const nameOk = /^[a-z0-9_.]{3,20}$/.test(u);
  const gate = replay ? classLabel : classes.find((c) => c.id === cls)?.label;
  const ready = replay || (nameOk && !!cls);
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* not supported */ } };
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const stamp = async () => {
    if (!ready || busy || phase !== "fill") return;
    setErr("");
    if (!replay) {
      setBusy(true);
      const e = await onSubmit(u, cls);
      setBusy(false);
      if (e) { setErr(e); Sound.play("err"); return; }
    }
    setPhase("stamping"); Sound.play("stamp"); buzz([14, 30, 10]);
    later(() => setPhase("stamped"), 950);
  };
  const tear = () => {
    if (phase !== "stamped") return;
    setPhase("tearing"); buzz(30);
    Sound.play("rip"); later(() => Sound.play("rip"), 80); later(() => Sound.play("rip"), 170);
    later(() => Sound.play("whoosh"), 800);
    later(() => onTakeoff(u, cls), 1550);
  };

  return (
    <div className={replay ? "bp over" : "bp"} data-phase={phase} role={replay ? "dialog" : undefined} aria-modal={replay ? "true" : undefined} aria-label="Boarding pass">
      <div className="bpTop">
        <span className="mark">Homeroom</span>
        {phase === "fill" && (replay
          ? <button className="bpLink" onClick={onSkip}>Skip</button>
          : <button className="bpLink" onClick={onSignOut}>Sign out</button>)}
      </div>
      <div className="bpMain">
        <h1 className="bpH">{phase === "fill" ? (replay ? "Your boarding pass" : "Fill out your boarding pass") : phase === "stamping" || phase === "stamped" ? "You're checked in." : "Safe travels."}</h1>
        <p className="bpSub">
          {phase === "fill" ? (replay ? "Here's the pass you filled out on your first day." : "Choose the name your class will see, pick your class, then get it stamped.")
            : phase === "stamped" ? "Tear along the dotted line to board." : phase === "stamping" ? "One moment." : "Boarding now."}
        </p>
        <div className="bpTicket" data-phase={phase}>
          <div className="bpBody" style={phase === "tearing" ? { clipPath: TEAR } : undefined}>
            <div className="bpHead"><span>Boarding pass</span><span>Homeroom Air</span></div>
            <label className="bpLab" htmlFor="bpn">Passenger</label>
            <input id="bpn" className="bpName" value={uname} placeholder="your name" maxLength={20}
              readOnly={replay || phase !== "fill"} autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
              onChange={(e) => setUname(e.target.value)} onKeyDown={(e) => e.key === "Enter" && stamp()} />
            {!replay && phase === "fill" && <p className={`bpHint${uname && !nameOk ? " bad" : ""}`}>3 to 20 characters: letters, numbers, dots or underscores.</p>}
            {replay || phase !== "fill"
              ? <><div className="bpLab" style={{ marginTop: 16 }}>Gate, your class</div><div className="bpGate">{gate || "Not chosen"}</div></>
              : <div className="bpClass"><ClassPicker classes={classes} value={cls} onPick={setCls} onCreated={setClasses} /></div>}
            <div className="bpGrid">
              <div><small>Date</small><b>{today}</b></div>
              <div><small>Departs</small><b>Now</b></div>
              <div><small>Status</small><b>{phase === "fill" ? "Not checked in" : "Checked in"}</b></div>
            </div>
            {phase !== "fill"
              ? <div className="bpStamp" aria-hidden="true"><span>Homeroom</span><b>{gate}</b><span>Checked in</span></div>
              : <div className="bpGhost" aria-hidden="true" />}
            {(phase === "stamping" || phase === "stamped") && (
              <div className="bpBits" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ "--a": `${i * 22.5}deg`, "--d": `${64 + ((i * 29) % 48)}px` }} />)}</div>
            )}
          </div>
          <div className="bpStub" role={phase === "stamped" ? "button" : undefined} tabIndex={phase === "stamped" ? 0 : undefined}
            aria-label={phase === "stamped" ? "Tear off the stub" : undefined}
            onClick={tear} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tear(); } }}>
            <i className="bpBars" aria-hidden="true" />
            <small>Admit one</small>
          </div>
        </div>
        {err && <p className="err" role="alert" style={{ marginTop: 14, textAlign: "center" }}>{err}</p>}
        <div className="bpAct">
          {phase === "fill" && <button className="bpGo" disabled={!ready || busy} onClick={stamp}>{busy ? <>Checking in<Dots /></> : "Stamp my pass"}</button>}
          {phase === "stamping" && <button className="bpGo" disabled>Stamping</button>}
          {phase === "stamped" && <button className="bpGo" data-pulse="1" onClick={tear}>Tear off the stub</button>}
        </div>
      </div>
    </div>
  );
}

/* The plane that flies across the screen, wiping the cream away so the app is underneath. */
function PlaneCurtain({ go, onDone }) {
  const ref = useRef(null);
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => {
    if (!go) return undefined;
    const el = ref.current;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = reduce ? 450 : 2100;
    const t0 = performance.now();
    let raf = 0, rang = false;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    if (!reduce) Sound.play("whoosh");
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const x = -0.14 + ease(t) * 1.34;
      el.style.setProperty("--x", x.toFixed(4));
      el.style.setProperty("--tf", String(Math.max(0, Math.min(1, (1.16 - x) / 0.34))));
      if (!rang && x > 0.5 && !reduce) { rang = true; Sound.play("bell"); }
      if (t < 1) raf = requestAnimationFrame(tick); else done.current();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [go]);
  return (
    <div className="curtain" ref={ref} style={{ "--x": -0.14, "--tf": 1 }} data-go={go ? 1 : 0} aria-hidden="true">
      <div className="curtainSky" />
      <i className="trail" />
      <svg className="jet" viewBox="0 0 170 64" fill="none">
        <path d="M20 30 8 6h15l24 24Z" fill="var(--accent)" />
        <path d="M72 38 50 62h17l36-24Z" fill="var(--accent)" opacity=".85" />
        <path d="M8 34c0-8 14-11 36-11h82c22 0 36 6 36 11s-14 11-36 11H44C22 45 8 42 8 34Z" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
        <g fill="var(--ink)" opacity=".72">{[34, 48, 62, 76, 90, 104].map((cx) => <circle key={cx} cx={cx} cy="33" r="2.5" />)}</g>
        <path d="M130 27h12c6 0 12 3 13 7h-25Z" fill="var(--ink)" opacity=".8" />
        <path d="M70 38 56 54h14l22-16Z" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/* ───────────────────────── the cabin: your class as a seat map ───────────────────────── */

const WEEK_LABEL = { complete: "Complete", almost: "Almost there", starting: "Starting", nothing: "Nothing" };

// How far along someone is with this week's tasks, from the shared "who finished what" list.
function weekStatus(name, tasks, completions) {
  const ws = weekStartOf(todayISO()), we = addDays(ws, 6);
  const ts = tasks.filter((t) => t.deadline >= ws && t.deadline <= we);
  if (!ts.length) return { key: "complete", done: 0, total: 0 };
  const done = ts.filter((t) => (completions[t.id] || []).includes(name)).length;
  const p = done / ts.length;
  return { key: p >= 1 ? "complete" : p >= 0.6 ? "almost" : p > 0 ? "starting" : "nothing", done, total: ts.length };
}

// Who is in the class, who is online right now (Supabase Realtime presence), and "so-and-so wants to chat" pings.
function useCabin(user, classId, enabled) {
  const [roster, setRoster] = useState([]);
  const [online, setOnline] = useState(() => new Set());
  const [live, setLive] = useState(false);
  const [unread, setUnread] = useState({});
  const [lastRing, setLastRing] = useState(null);
  const ch = useRef(null);
  const known = useRef(new Set());
  useEffect(() => {
    if (!enabled || !user || !classId) return undefined;
    let dead = false;
    const loadRoster = () => supabase.rpc("class_roster").then(({ data, error }) => {
      if (dead || error || !data) return;
      const list = data.map((r) => r.username);
      known.current = new Set(list);
      setRoster(list);
    });
    loadRoster();
    const channel = supabase.channel(`class:${classId}`, { config: { private: true, presence: { key: user } } });
    channel
      .on("presence", { event: "sync" }, () => {
        const keys = Object.keys(channel.presenceState());
        setOnline(new Set(keys));
        if (keys.some((k) => !known.current.has(k))) loadRoster(); // someone new joined the class
      })
      .on("broadcast", { event: "ring" }, ({ payload }) => {
        if (payload && payload.to === user && typeof payload.from === "string") {
          setUnread((u) => ({ ...u, [payload.from]: true }));
          setLastRing({ from: payload.from, at: Date.now() });
        }
      });
    (async () => {
      try { await supabase.realtime.setAuth(); } catch { /* the client already has the session */ }
      if (dead) return;
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") { setLive(true); try { await channel.track({ at: Date.now() }); } catch { /* ignore */ } }
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setLive(false);
      });
    })();
    ch.current = channel;
    return () => { dead = true; setLive(false); setOnline(new Set()); ch.current = null; supabase.removeChannel(channel); };
  }, [user, classId, enabled]);
  const ring = useCallback((to) => {
    try { ch.current && ch.current.send({ type: "broadcast", event: "ring", payload: { from: user, to } }); } catch { /* not connected yet */ }
  }, [user]);
  const clearUnread = useCallback((n) => setUnread((u) => { if (!u[n]) return u; const c = { ...u }; delete c[n]; return c; }), []);
  return { roster, online, live, unread, lastRing, ring, clearUnread };
}

function Cabin({ me, cabin, tasks, completions, groups, subjects, onChat, inSheet }) {
  const [layout, setLayout] = useState(() => { try { return localStorage.getItem("hr:cabin") === "3" ? 3 : 2; } catch { return 2; } });
  const [filter, setFilter] = useState("all");
  const [pick, setPick] = useState(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menu) return undefined;
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [menu]);
  const setLay = (n) => { setLayout(n); Sound.play("tap"); try { localStorage.setItem("hr:cabin", String(n)); } catch { /* storage blocked */ } };

  const names = useMemo(() => [me, ...cabin.roster.filter((n) => n !== me)], [me, cabin.roster]);
  // groupmates: people who are in at least one group with me, and the subjects of those groups
  const shared = useMemo(() => {
    const out = {};
    groups.filter((g) => (g.members || []).includes(me)).forEach((g) => (g.members || []).forEach((m) => {
      if (m !== me) (out[m] = out[m] || new Set()).add(g.subject);
    }));
    return out;
  }, [groups, me]);
  const mateCount = (s) => Object.values(shared).filter((set) => set.has(s)).length;
  const myGroups = groups.filter((g) => (g.members || []).includes(me)).length;

  const isOn = (n) => n === me || cabin.online.has(n);
  const side = layout;
  const perRow = side * 2;
  const rows = Math.max(4, Math.ceil(names.length / perRow));
  const letters = "ABCDEF".slice(0, perRow).split("");
  const who = pick && names.includes(pick) ? pick : me;
  const whoSt = weekStatus(who, tasks, completions);
  const whoShared = shared[who];

  const seat = (n) => {
    const on = isOn(n);
    const st = weekStatus(n, tasks, completions);
    const sh = shared[n];
    const hit = !!sh && (filter === "all" || sh.has(filter));
    const dim = n !== me && filter !== "all" && !hit;
    const color = hit ? subjColor(filter === "all" ? [...sh][0] : filter) : null;
    return (
      <button key={n} className="seat" data-on={on ? 1 : 0} data-me={n === me ? 1 : 0} data-hit={hit ? 1 : 0} data-dim={dim ? 1 : 0} data-st={st.key} data-ping={cabin.unread[n] ? 1 : 0}
        style={color ? { "--sc": color } : undefined}
        aria-label={`${n}${n === me ? " (you)" : ""}, ${on ? "online" : "offline"}, ${WEEK_LABEL[st.key]}${n !== me && on ? ". Open a chat" : ""}`}
        onMouseEnter={() => setPick(n)} onFocus={() => setPick(n)}
        onClick={() => { setPick(n); if (n !== me && on) { Sound.play("pop"); onChat(n); } else Sound.play("tap"); }}>
        <span className="seatBack"><b>{side === 3 ? n.slice(0, 2) : n}</b></span>
        <i className="seatBelt" />
        {on && <u className="seatDot" />}
        {sh && <span className="seatSubj">{[...sh].slice(0, 3).map((s) => <i key={s} style={{ background: subjColor(s) }} />)}</span>}
      </button>
    );
  };

  const rowEls = [];
  for (let r = 0; r < rows; r++) {
    const cells = [];
    for (let c = 0; c < perRow; c++) {
      if (c === side) cells.push(<span key="aisle" className="aisle">{r + 1}</span>);
      const n = names[r * perRow + c];
      cells.push(n ? seat(n) : <span key={`e${c}`} className="seat vacant" aria-hidden="true" />);
    }
    rowEls.push(<div className="seatRow" key={r} data-wing={r === 2 || r === 3 ? 1 : 0}>{cells}</div>);
  }

  return (
    <div className="cabin" data-in={inSheet ? "sheet" : "rail"} data-side={side}>
      <div className="cabinHead">
        <div className="cabinTitle">
          <b>Your class</b>
          <span className="cabinLive" data-live={cabin.live ? 1 : 0}>{cabin.live ? "Live" : "Offline"}</span>
        </div>
        <div className="cabinTools">
          <div className="seg2" role="group" aria-label="Seat layout">
            <button aria-pressed={layout === 2} onClick={() => setLay(2)}>2 + 2</button>
            <button aria-pressed={layout === 3} onClick={() => setLay(3)}>3 + 3</button>
          </div>
          <div className="cabinFilter" ref={menuRef}>
            <button className="filterPill" data-on={filter !== "all" ? 1 : 0} aria-expanded={menu} onClick={() => { setMenu(!menu); Sound.play("tap"); }}>
              <SlidersHorizontal size={13} />
              <span>{filter === "all" ? "Everyone" : filter}</span>
            </button>
            {menu && (
              <div className="filterMenu" role="menu">
                <button role="menuitemradio" aria-checked={filter === "all"} onClick={() => { setFilter("all"); setMenu(false); Sound.play("pop"); }}>
                  <span className="dot" style={{ background: "var(--faint)" }} />Everyone<small>{names.length}</small>
                </button>
                {subjects.map((s) => (
                  <button key={s} role="menuitemradio" aria-checked={filter === s} onClick={() => { setFilter(s); setMenu(false); Sound.play("pop"); }}>
                    <span className="dot" style={{ background: subjColor(s) }} />{s}<small>{mateCount(s)}</small>
                  </button>
                ))}
                <p>Pick a subject to gray out everyone who isn't in a group with you for it.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="cabinLegend" aria-hidden="true">
        {Object.entries({ complete: "Complete", almost: "Almost", starting: "Starting", nothing: "Nothing" }).map(([k, l]) => <span key={k} data-st={k}><i />{l}</span>)}
      </div>
      <div className="fuselage" role="group" aria-label="Seat map of your class">
        <div className="nose" aria-hidden="true"><i /></div>
        <div className="letters" aria-hidden="true">
          {letters.map((l, i) => <span key={l} style={{ gridColumn: i < side ? i + 1 : i + 2 }}>{l}</span>)}
        </div>
        {rowEls}
        <div className="tail" aria-hidden="true" />
      </div>
      <div className="cabinCard" key={who}>
        <div className="cabinWho"><b>{who}</b>{who === me && <small>you</small>}</div>
        <div className="cabinChips">
          <span className="cChip" data-on={isOn(who) ? 1 : 0}><i />{isOn(who) ? "Online" : "Offline"}</span>
          <span className="cChip" data-st={whoSt.key}><i />{WEEK_LABEL[whoSt.key]}</span>
          {whoShared && [...whoShared].map((s) => <span key={s} className="cChip sub"><i style={{ background: subjColor(s) }} />{s}</span>)}
        </div>
        <div className="cabinFoot">
          <small>{whoSt.total ? `${whoSt.done} of ${whoSt.total} done this week` : "No tasks due this week"}</small>
          {who !== me && isOn(who) && <button className="btn accent small" onClick={() => { Sound.play("pop"); onChat(who); }}>Message</button>}
        </div>
      </div>
      {myGroups === 0 && <p className="cabinHint">Join a group (Tasks, then Groups) and your groupmates light up here in the subject's colour.</p>}
    </div>
  );
}

/* A temporary chat with one classmate, over a private Realtime channel. Nothing is stored anywhere. */
function ChatSheet({ peer, me, classId, thread, saveThread, ring, peerOnline }) {
  const [msgs, setMsgs] = useState(thread || []);
  const [text, setText] = useState("");
  const [here, setHere] = useState(false);
  const hereRef = useRef(false);
  const chan = useRef(null);
  const queue = useRef([]);
  const end = useRef(null);
  const save = useRef(saveThread); save.current = saveThread;
  const ringRef = useRef(ring); ringRef.current = ring;
  const add = useCallback((m) => setMsgs((c) => (c.some((x) => x.id === m.id) ? c : [...c, m])), []);
  useEffect(() => { save.current(peer, msgs); end.current && end.current.scrollIntoView({ block: "end" }); }, [peer, msgs]);
  useEffect(() => {
    const c = supabase.channel(`dm:${classId}:${[me, peer].sort().join(":")}`, { config: { private: true, presence: { key: me }, broadcast: { self: false } } });
    chan.current = c;
    let dead = false;
    c.on("presence", { event: "sync" }, () => {
      const present = Object.keys(c.presenceState()).includes(peer);
      hereRef.current = present; setHere(present);
      if (present && queue.current.length) {
        queue.current.forEach((m) => c.send({ type: "broadcast", event: "msg", payload: m }));
        queue.current = [];
      }
    }).on("broadcast", { event: "msg" }, ({ payload }) => {
      if (payload && payload.from === peer && typeof payload.text === "string" && payload.id) {
        add({ id: String(payload.id), from: peer, text: payload.text.slice(0, 500), at: Date.now() });
        Sound.play("pop");
      }
    });
    (async () => {
      try { await supabase.realtime.setAuth(); } catch { /* the client already has the session */ }
      if (dead) return;
      c.subscribe(async (s) => { if (s === "SUBSCRIBED") { try { await c.track({ at: Date.now() }); } catch { /* ignore */ } } });
    })();
    ringRef.current(peer);
    const again = setInterval(() => { if (!hereRef.current) ringRef.current(peer); }, 9000);
    return () => { dead = true; clearInterval(again); chan.current = null; supabase.removeChannel(c); };
  }, [peer, me, classId, add]);
  const send = () => {
    const t = text.trim().slice(0, 500);
    if (!t) return;
    const m = { id: uid(), from: me, text: t, at: Date.now() };
    add(m); setText(""); Sound.play("send");
    if (hereRef.current && chan.current) chan.current.send({ type: "broadcast", event: "msg", payload: m });
    else queue.current.push(m);
  };
  return (
    <div className="dm">
      <div className="dmHead">
        <span className="dmAvatar">{peer[0].toUpperCase()}</span>
        <div>
          <b>{peer}</b>
          <small data-on={peerOnline ? 1 : 0}>{peerOnline ? (here ? "Online, in this chat" : "Online, waiting for them to open it") : "Went offline. Messages won't be delivered."}</small>
        </div>
      </div>
      <div className="dmMsgs">
        {msgs.length === 0 && <p className="meta" style={{ textAlign: "center", margin: "18px 0" }}>Say hi. This chat is temporary: nothing is saved, and it clears when you close Homeroom.</p>}
        {msgs.map((m) => <div key={m.id} className="dmMsg" data-me={m.from === me ? 1 : 0}>{m.text}</div>)}
        <div ref={end} />
      </div>
      <div className="dmBar">
        <input className="input" value={text} maxLength={500} placeholder={`Message ${peer}`} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="btn accent" onClick={send} disabled={!text.trim()}>Send</button>
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
  const [welcome, setWelcome] = useState(false); // replay of the boarding pass from the account menu
  const [needPass, setNeedPass] = useState(false); // signed in, but the boarding pass hasn't been filled out yet
  const [curtain, setCurtain] = useState(null); // null, wait, fly: the plane crossing the screen
  const [invite, setInvite] = useState(false); // offer the hands-on tour once, right after the first flight
  const [chat, setChat] = useState(null); // classmate we're chatting with
  const [cabinOpen, setCabinOpen] = useState(false);
  const threads = useRef({});
  const firstFlight = useRef(false);
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
  const [subjectDefs, setSubjectDefs] = useState([]);
  const [kb, setKb] = useState({}); // the ideas inventory of every note, shared with the class (see StudyHub)
  const [subjOpen, setSubjOpen] = useState(false);
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
  const cabin = useCabin(user, classId, !!user && !!classId && !isAdmin);
  const [navRef, navSlider] = useSlider(tab);
  const [tabsRef, tabsSlider] = useSlider(tab);
  const [swap, setSwap] = useState(false);
  const firstTheme = useRef(true);
  const [focusOpen, setFocusOpen] = useState(false);
  const [accent, setAccentState] = useState(() => { try { return localStorage.getItem("hr:accent") || "clay"; } catch { return "clay"; } });
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
    const [t, mats, cm, comp, ann, wk, pr, gr, sj, kbv] = await Promise.all([
      store.get(k("tasks"), true), store.get(k("materials"), true), store.get(k("comments"), true),
      store.get(k("completions"), true), store.get(k("announcements"), true), store.get(k("weeklies"), true),
      store.get(k("proofs"), true), store.get(k("groups"), true), store.get(k("subjects"), true), store.get(k("kb"), true),
    ]);
    setTasks(t || []); setMaterials(mats || []); setComments(cm || []); setCompletions(comp || {}); setAnnouncements(ann || []); setWeeklies(wk || []);
    setProofs(pr || {}); setGroups(gr || []); setSubjectDefs(sj || []); setKb(kbv || {});
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
      if (!prof.username && !prof.is_admin) { setClasses(await store.classes.list()); setNeedPass(true); setReady(true); return; }
      const u = prof.username;
      setUser(u); setIsAdmin(!!prof.is_admin);
      const [prog, cache, pf] = await Promise.all([store.get(`u:${u}:progress`, true), store.get(`cache:${u}`), store.get(`prefs:${u}`)]);
      const cid = prof.class_id || null;
      classRef.current = cid; setClassId(cid);
      setProgress(prog || {});
      if (pf) {
        if (pf.ui) setUi((x) => ({ ...x, ...pf.ui }));
        if (pf.dismissedAnn) setDismissedAnn(pf.dismissedAnn);
        if (pf.tab && ["tasks", "done", "review", "ask"].includes(pf.tab)) setTab(pf.tab);
      }
      if (cache && cid) {
        // Instant open: show what we had last time, then quietly catch up.
        setTasks(cache.tasks || []); setMaterials(cache.materials || []); setComments(cache.comments || []);
        setCompletions(cache.completions || {}); setAnnouncements(cache.announcements || []); setWeeklies(cache.weeklies || []);
        setProofs(cache.proofs || {}); setGroups(cache.groups || []); setSubjectDefs(cache.subjects || []);
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
    const id = setTimeout(() => store.set(`cache:${user}`, { tasks, materials, comments, completions, announcements, weeklies, proofs, groups, subjects: subjectDefs }), 900);
    return () => clearTimeout(id);
  }, [tasks, materials, comments, completions, announcements, weeklies, proofs, groups, subjectDefs, user, ready]);

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

  useEffect(() => { document.body.style.background = dark ? "#1A1714" : "#F5F1E8"; }, [dark]);

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

  const showToast = (msg, undo, label) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, undo, label, id: uid() });
    toastTimer.current = setTimeout(() => setToast(null), 5200);
  };

  /* ----- auth ----- */

  const chooseClass = async (cid) => {
    await supabase.from("profiles").update({ class_id: cid }).eq("username", user);
    store.del(`cache:${user}`);
    classRef.current = cid; setClassId(cid);
    setTasks([]); setMaterials([]); setComments([]); setCompletions({}); setAnnouncements([]); setWeeklies([]); setProofs({}); setGroups([]); setSubjectDefs([]); setKb({});
    backfilled.current = false;
    setSyncing(true);
    try { await loadShared(user, cid); } finally { setSyncing(false); }
  };

  // quiet: the plane is covering the screen, so skip the loading splash and the artificial wait
  const onAuthed = async (u, cid, admin, quiet = false) => {
    if (!quiet) setReady(false);
    classRef.current = cid || null; setClassId(cid || null);
    setUser(u); setIsAdmin(!!admin);
    setProgress((await store.get(`u:${u}:progress`, true)) || {});
    await Promise.all([loadShared(u, cid || null), quiet ? Promise.resolve() : new Promise((r) => setTimeout(r, 900))]);
    lastSync.current = Date.now();
    setTab("tasks");
    setReady(true);
  };

  // The boarding pass: save the username and class, then (after the stamp and the tear) take off.
  const submitPass = async (u, cid) => {
    const { error } = await supabase.rpc("complete_profile", { uname: u, cls: cid });
    if (!error) return null;
    if (/duplicate|unique/i.test(error.message)) return "Someone already has that name. Try another.";
    if (/already set up/i.test(error.message)) return "This account already has a boarding pass. Sign out and sign back in.";
    return "Couldn't save your pass: " + error.message;
  };
  const takeoff = async (u, cid) => {
    firstFlight.current = true;
    setNeedPass(false); setCurtain("wait");
    await onAuthed(u, cid, false, true);
    setCurtain("fly");
  };
  const replayTakeoff = () => { setWelcome(false); setCurtain("fly"); };
  const landed = () => { setCurtain(null); if (firstFlight.current) { firstFlight.current = false; setInvite(true); } };
  const openChat = (n) => { cabin.clearUnread(n); setChat(n); setCabinOpen(false); };
  const joinGroup = (id, join) => mutate("groups", setGroups, (c) => c.map((x) => {
    if (x.id !== id) return x;
    const m = (x.members || []).filter((n) => n !== user);
    return { ...x, members: join ? [...m, user] : m };
  }));
  // subjects the class has added, with their colours (shared, so nobody has to touch the code to add one)
  const setSubject = (d) => {
    SUBJ_REG[d.name] = d.color;
    mutate("subjects", setSubjectDefs, (c) => [...c.filter((x) => x.name !== d.name), { name: d.name, color: d.color }]);
  };
  const ensureSubject = (name) => { const n = (name || "").trim(); if (n && !subjectDefs.some((x) => x.name === n) && !SUBJ[n]) setSubject({ name: n, color: subjColor(n) }); };
  useEffect(() => {
    if (!cabin.lastRing) return;
    const from = cabin.lastRing.from;
    Sound.play("bell");
    showToast(`${from} wants to chat`, () => openChat(from), "Open");
  }, [cabin.lastRing]);
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
    setTasks([]); setMaterials([]); setComments([]); setCompletions({}); setAnnouncements([]); setWeeklies([]); setProofs({}); setGroups([]); setSubjectDefs([]); setKb({});
    backfilled.current = false;
  };

  /* ----- data changes: update the screen first, save right after ----- */

  const mutate = async (key, setter, fn, empty = []) => {
    setter((c) => fn(c));
    const fk = ["tasks", "materials", "comments", "completions", "announcements", "weeklies", "proofs", "groups", "subjects", "kb"].includes(key) ? `${classRef.current}:${key}` : key;
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
    ensureSubject(g.subject);
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
  const addTask = (t) => { ensureSubject(t.subject); return mutate("tasks", setTasks, (c) => [...c, t]); };
  const updateTask = (t) => { ensureSubject(t.subject); return mutate("tasks", setTasks, (c) => c.map((x) => (x.id === t.id ? t : x))); };
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
  const saveKb = (id, entry) => mutate("kb", setKb, (c) => ({ ...c, [id]: entry }), {});
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

  useMemo(() => { subjectDefs.forEach((d) => { SUBJ_REG[d.name] = d.color; }); }, [subjectDefs]);
  const subjects = useMemo(() => [...new Set([...DEFAULT_SUBJECTS, ...subjectDefs.map((d) => d.name), ...tasks.map((t) => t.subject), ...groups.map((g) => g.subject)])], [subjectDefs, tasks, groups]);
  const classQuarter = classes.find((c) => c.id === classId)?.quarter || 1;
  // Minecraft: unlocked when every task of the class's current quarter is done (the server double-checks this itself)
  const mcTasks = tasks.filter((t) => (t.quarter || 1) === classQuarter);
  const mcDone = mcTasks.filter((t) => progress[t.id] === "done").length;
  const mcAllDone = mcTasks.length > 0 && mcDone === mcTasks.length;
  const [mcOpen, setMcOpen] = useState(false);
  const [mcName, setMcName] = useState(null);
  const mcPrev = useRef(null);
  useEffect(() => {
    if (!MINECRAFT.on || !user || !classId || isAdmin) return;
    supabase.rpc("my_minecraft").then(({ data }) => setMcName(data || null));
  }, [user, classId, isAdmin]);
  useEffect(() => {
    if (!MINECRAFT.on || !ready || !user || !classId || isAdmin || tour) return;
    const flag = `hr:mcShown:${user}`;
    const seen = (() => { try { return localStorage.getItem(flag); } catch { return "1"; } })();
    if (mcPrev.current === null) { mcPrev.current = mcAllDone; if (mcAllDone && !mcName && !seen) setMcOpen(true); }
    else if (mcAllDone && !mcPrev.current) setMcOpen(true); // just ticked the last one
    mcPrev.current = mcAllDone;
    if (mcAllDone) { try { localStorage.setItem(flag, "1"); } catch { /* storage blocked */ } }
  }, [mcAllDone, ready, user, classId, isAdmin, tour]);
  const linkMc = async (n) => {
    const { error } = await supabase.rpc("link_minecraft", { p_name: n });
    if (error) return /duplicate|unique/i.test(error.message) ? "That Minecraft name is already linked to another student." : /bad minecraft/i.test(error.message) ? "Minecraft names are 3 to 16 letters, numbers or underscores." : "Couldn't save it: " + error.message;
    setMcName(n); return null;
  };
  const unlinkMc = async () => { await supabase.rpc("unlink_minecraft"); setMcName(null); };
  const groupById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])), [groups]);
  const defQuarter = ui.q && ui.q !== "All" ? Number(ui.q) : classQuarter;
  const proofTask = tasks.find((t) => t.id === proofFor);
  const demoTask = useMemo(makeDemoTask, []);
  const viewTasks = useMemo(() => (tour ? [demoTask, ...tasks] : tasks), [tour, tasks, demoTask]);
  const viewProgress = tour ? { ...progress, [DEMO_ID]: demo } : progress;
  const tourCtx = { tab, detail: detailId === DEMO_ID, form: !!form, mode: ui.mode, search: searchOpen, demo };
  const detail = viewTasks.find((t) => t.id === detailId);
  const doneCount = tasks.filter((t) => progress[t.id] === "done").length;
  const themeAttr = dark ? "dark" : "light";
  const accentStyle = { "--accent": (ACCENTS[accent] || ACCENTS.clay)[dark ? 1 : 0] };
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
  if (needPass && !curtain) {
    const signOutPass = async () => { await supabase.auth.signOut(); setNeedPass(false); };
    return (
      <div className="hr solo" data-theme={themeAttr} style={accentStyle}><style>{CSS}</style>
        <BoardingPass classes={classes} setClasses={setClasses} onSubmit={submitPass} onTakeoff={takeoff} onSignOut={signOutPass} />
      </div>
    );
  }
  if (!user && !curtain) {
    return <div className="hr solo" data-theme={themeAttr} style={accentStyle}><style>{CSS}</style><AuthShell><BoxGate><Auth onAuthed={onAuthed} onNeedPass={async () => { setClasses(await store.classes.list()); setNeedPass(true); }} /></BoxGate></AuthShell></div>;
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
    ["done", "Done", CheckCheck],
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
        <div className="railCabin" data-tour="cabin"><Cabin me={user} cabin={cabin} tasks={tasks} completions={completions} groups={groups} subjects={subjects} onChat={openChat} /></div>
        <button className="nav acct" onClick={() => { Sound.play("tap"); setMenu(true); }} aria-label="Account">
          <span className="avatar">{user[0].toUpperCase()}</span><span>{user}</span>
        </button>
      </nav>
      <div className="main">
        <header className="head">
          <span className="headL">
            <span className="mark phoneOnly">Homeroom</span>
            {classLabel && <span className="classChip">{classLabel}<i>Q{classQuarter}</i></span>}
          </span>
          <div className="hdrRight">
            <button className="searchPill" data-tour="search" onClick={() => { Sound.play("tap"); setSearchOpen(true); }}>
              <Search size={16} /><span>Search tasks and notes</span><kbd className="kbd">Ctrl K</kbd>
            </button>
            <button className="hdrBtn searchBtn" data-tour="search" aria-label="Search" onClick={() => { Sound.play("tap"); setSearchOpen(true); }}><Search size={17} /></button>
            <button className="hdrBtn noDesk cabinBtn" data-tour="cabin-btn" aria-label="Your class, seat map" data-ping={Object.keys(cabin.unread).length ? 1 : 0} onClick={() => { Sound.play("tap"); setCabinOpen(true); }}><Plane size={17} /></button>
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
          {tab === "done" && (
            <DoneTab tasks={tasks} progress={progress} completions={completions} user={user} quarter={classQuarter} setStatus={requestStatus}
              mc={MINECRAFT.on ? { allDone: mcAllDone, linked: mcName, open: () => setMcOpen(true) } : null}
              openTask={(id) => { setDetailId(id); setConfirmDel(false); }}
              editTask={(id) => { const t = tasks.find((x) => x.id === id); if (t) setForm({ mode: "edit", task: t }); }} onRefresh={() => refresh(true)} />
          )}
          {tab === "review" && (
            <ReviewTab tasks={tasks} progress={progress} materials={materials} weeklies={weeklies} saveWeekly={saveWeekly} reviewStart={reviewStart} clearStart={() => setReviewStart(null)} user={user} addMaterial={addMaterial}
              removeMaterial={removeMaterial} focusId={reviewFocus} clearFocus={() => setReviewFocus(null)} onRefresh={() => refresh(true)} subjects={subjects} kb={kb} saveKb={saveKb} classQuarter={classQuarter} />
          )}
          {tab === "ask" && <AskTab user={user} tasks={tasks} materials={materials} progress={progress} kb={kb} addTask={(t) => { Sound.play("add"); addTask({ quarter: defQuarter, ...t }); }} />}
        </div>
        {tab === "tasks" && (
          <button className="fab" data-tour="new-task" aria-label="Add a task" onClick={() => { Sound.play("tap"); setForm({ mode: "add" }); }}><Plus size={26} /></button>
        )}
        {toast && (
          <div className="toast" role="status" key={toast.id}>
            <span>{toast.msg}</span>
            {toast.undo && <button onClick={() => { const u = toast.undo; setToast(null); u(); }}>{toast.label || "Undo"}</button>}
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
              onAddSubject={setSubject}
              onCancel={() => setForm(null)}
              onSave={(f, ng) => {
                let gid = f.groupId || null;
                if (ng) {
                  gid = uid();
                  addGroup({ id: gid, name: ng.name, subject: f.subject, quarter: f.quarter, createdBy: user, createdAt: Date.now() });
                }
                ensureSubject(f.subject);
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
        {groupsOpen && <GroupsPanel groups={groups} tasks={tasks} progress={progress} subjects={subjects} defQuarter={defQuarter} onSave={saveGroup} onDelete={deleteGroup} user={user} onJoin={joinGroup} onAddSubject={setSubject} />}
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
        {MINECRAFT.on && (
          <button className="btn ghost full" style={{ marginBottom: 10 }} onClick={() => { setMenu(false); setMcOpen(true); }}>Minecraft server</button>
        )}
        <button className="btn ghost full" style={{ marginBottom: 10 }} onClick={() => { setMenu(false); setSubjOpen(true); }}>
          Subjects and colours
        </button>
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
      {MINECRAFT.on && (
        <Sheet open={mcOpen} onClose={() => setMcOpen(false)} title="Minecraft server">
          {mcOpen && <MinecraftPanel done={mcDone} total={mcTasks.length} linked={mcName} onLink={linkMc} onUnlink={unlinkMc} />}
        </Sheet>
      )}
      <Sheet open={subjOpen} onClose={() => setSubjOpen(false)} title="Subjects">
        {subjOpen && <SubjectsPanel subjects={subjects} onSet={setSubject} />}
      </Sheet>
      <Sheet open={delOpen} onClose={() => setDelOpen(false)} title="Delete account">
        {delOpen && <DeleteAccount user={user} onClose={() => setDelOpen(false)} onDeleted={afterDelete} />}
      </Sheet>
      <Sheet open={fbOpen} onClose={() => setFbOpen(false)} title="Send a suggestion">
        {fbOpen && <FeedbackForm onSend={sendFeedback} onClose={() => setFbOpen(false)} />}
      </Sheet>
      {welcome && <BoardingPass replay name={user} classLabel={classLabel} onTakeoff={replayTakeoff} onSkip={() => setWelcome(false)} />}
      {curtain && <PlaneCurtain go={curtain === "fly"} onDone={landed} />}
      {invite && !tour && !curtain && (
        <div className="invite" role="status">
          <div><b>Want a one-minute tour?</b><small>You'll tap through the real app.</small></div>
          <button className="btn accent small" onClick={() => { Sound.play("pop"); setInvite(false); setTour(true); }}>Take the tour</button>
          <button className="iconBtn" aria-label="Not now" onClick={() => setInvite(false)}><X size={16} /></button>
        </div>
      )}
      <Sheet open={!!chat} onClose={() => setChat(null)} title="Chat">
        {chat && <ChatSheet key={chat} peer={chat} me={user} classId={classId} thread={threads.current[chat]} saveThread={(p, m) => { threads.current[p] = m; }} ring={cabin.ring} peerOnline={cabin.online.has(chat)} />}
      </Sheet>
      <Sheet open={cabinOpen && bp !== "desktop"} onClose={() => setCabinOpen(false)} title="Your class">
        <Cabin inSheet me={user} cabin={cabin} tasks={tasks} completions={completions} groups={groups} subjects={subjects} onChat={openChat} />
      </Sheet>
      {tour && <Tour user={user} bp={bp} ctx={tourCtx} go={tourGo} onDone={finishTour} />}
    </div>
  );
}