// Hooks and small rules that carry app logic (streaks, the focus timer, the class roster), moved from the v33 App.jsx.
// The timer and roster behave exactly as before; only the screens that show them are new.
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./services.js";
import { Sound } from "./sound.js";
import { pad, todayISO, addDays, weekStartOf } from "./dates.js";

// The page title follows the active destination, with the focus-timer countdown in front while it runs.
let titleBase = "Homeroom";
let titleTimer = "";
const applyTitle = () => { document.title = titleTimer ? `${titleTimer} \u00b7 ${titleBase}` : titleBase; };
export const setTitleBase = (t) => { titleBase = t || "Homeroom"; applyTitle(); };

// Days in a row (ending today, or yesterday if nothing is done yet today) with at least one finished task.
export function calcStreak(days) {
  const set = new Set(days);
  let d = todayISO();
  if (!set.has(d)) d = addDays(d, -1);
  let n = 0;
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export const FOCUS_MODES = { focus: 25 * 60, break: 5 * 60, long: 15 * 60 };
export const mmss = (n) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;

export function useFocusTimer() {
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
    titleTimer = running ? mmss(left) : "";
    applyTitle();
  }, [running, left]);
  const start = () => { endRef.current = Date.now() + left * 1000; setRunning(true); Sound.play("tap"); };
  const pause = () => setRunning(false);
  const reset = (m) => { const next = typeof m === "string" ? m : mode; setRunning(false); setMode(next); setLeft(FOCUS_MODES[next]); };
  return { mode, left, running, total: FOCUS_MODES[mode], start, pause, reset };
}

export const WEEK_LABEL = { complete: "Complete", almost: "Almost there", starting: "Starting", nothing: "Nothing" };

// How far along someone is with this week's tasks, from the shared "who finished what" list.
export function weekStatus(name, tasks, completions) {
  const ws = weekStartOf(todayISO()), we = addDays(ws, 6);
  const ts = tasks.filter((t) => t.deadline >= ws && t.deadline <= we);
  if (!ts.length) return { key: "complete", done: 0, total: 0 };
  const done = ts.filter((t) => (completions[t.id] || []).includes(name)).length;
  const p = done / ts.length;
  return { key: p >= 1 ? "complete" : p >= 0.6 ? "almost" : p > 0 ? "starting" : "nothing", done, total: ts.length };
}

// Who is in the class, who is online right now (Supabase Realtime presence), and "so-and-so wants to chat" pings.
export function useCabin(user, classId, enabled) {
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

// Watch a media query; used where layout needs to know (the board view is not offered on a phone).
export function useMedia(query) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return m;
}
