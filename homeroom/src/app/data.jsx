// The data layer for the signed-in app: loading, the on-device cache, saving, progress, notes, groups, comments.
// Ported from the body of the v33 App() so behaviour is the same: update the screen first, save right after, never let a
// failed read overwrite saved data, and merge each tick into whatever is saved so a phone can't erase a laptop's tick.
import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase, store, notes } from "../lib/services.js";
import { todayISO, toISO, diffDays, addDays } from "../lib/dates.js";
import { uid } from "../lib/helpers.js";
import { SUBJ, SUBJ_REG, subjColor, DEFAULT_SUBJECTS } from "../lib/constants.js";
import { normTopic, topicList, MAX_BODY } from "../lib/notes.js";
import { useIngest } from "./ingest.jsx";
import { createWriteQueue } from "../lib/writes.js";
import { calcStreak } from "../lib/hooks.js";
import { Sound } from "../lib/sound.js";
import { useToast } from "./ui.jsx";

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);
export const SHARED = ["tasks", "comments", "completions", "announcements", "weeklies", "groups", "subjects"];

export function DataProvider({ user, classId, setClassId, classes, setClasses, isAdmin, children }) {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [comments, setComments] = useState([]);
  const [completions, setCompletions] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [weeklies, setWeeklies] = useState([]);
  const [groups, setGroups] = useState([]);
  const [subjectDefs, setSubjectDefs] = useState([]);
  const [progress, setProgress] = useState({});
  const [prefs, setPrefsState] = useState({ ui: { view: "open", subj: "All", mode: "list", kind: "All", group: "date", q: "All" }, dismissedAnn: [] });
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);   // nothing to show yet (first ever open)
  const [syncing, setSyncing] = useState(false);
  const [failedCount, setFailedCount] = useState(0);   // saves that did not go through (see lib/writes.js)
  const [retrying, setRetrying] = useState(false);

  const classRef = useRef(classId); classRef.current = classId;
  const progressRef = useRef(progress); progressRef.current = progress;
  const tasksRef = useRef(tasks); tasksRef.current = tasks;
  const lastSync = useRef(0);
  const progressQ = useRef(Promise.resolve());
  const progressBusy = useRef(0);
  const progressStamp = useRef(0);
  const backfilled = useRef(false);
  const ready = useRef(false);
  const writes = useRef(null);
  if (!writes.current) writes.current = createWriteQueue(setFailedCount);

  /* ----- loading ----- */
  const loadShared = useCallback(async (cid) => {
    const c = cid || classRef.current;
    if (!c) { setClasses(await store.classes.list()); return; }
    const k = (x) => `${c}:${x}`;
    const stamp = progressStamp.current;
    // One request for the small shared rows plus this student's progress, one for the note summaries, one for classes.
    // If one fails, that part keeps what the screen already shows instead of going blank.
    const [kv, mats, cls] = await Promise.all([store.getMany([...SHARED.map(k), `u:${user}:progress`]), notes.list(c), store.classes.list()]);
    if (cls) setClasses(cls);
    if (mats) setMaterials(mats);
    if (kv) {
      const g = (x) => kv[k(x)];
      setTasks(g("tasks") || []); setComments(g("comments") || []); setCompletions(g("completions") || {}); setAnnouncements(g("announcements") || []);
      setWeeklies(g("weeklies") || []); setGroups(g("groups") || []); setSubjectDefs(g("subjects") || []);
      const prog = kv[`u:${user}:progress`];
      if (prog && typeof prog === "object" && !progressBusy.current && progressStamp.current === stamp && JSON.stringify(prog) !== JSON.stringify(progressRef.current)) {
        progressRef.current = prog; setProgress(prog);
      }
      writes.current.reapply(c);   // a change that failed to save is still on screen after a refresh
    }
  }, [user, setClasses]);

  const refresh = useCallback(async (force = false) => {
    if (!force && Date.now() - lastSync.current < 8000) return;
    lastSync.current = Date.now();
    setSyncing(true);
    try { await loadShared(); } finally { setSyncing(false); }
  }, [loadShared]);

  // first load: show what we had last time right away, then catch up
  useEffect(() => {
    let dead = false;
    (async () => {
      const [prog, cache, pf] = await Promise.all([store.get(`u:${user}:progress`, true), store.get(`cache:${user}`), store.get(`prefs:${user}`)]);
      if (dead) return;
      setProgress(prog || {});
      if (pf) setPrefsState((p) => ({ ui: { ...p.ui, ...(pf.ui || {}), view: pf.ui?.view === "upcoming" ? "open" : pf.ui?.view === "done" ? "open" : (pf.ui?.view || p.ui.view) }, dismissedAnn: pf.dismissedAnn || [] }));
      try { setActivity(JSON.parse(localStorage.getItem("hr:act:" + user) || "[]")); } catch { setActivity([]); }
      if (cache && classId) {
        setTasks(cache.tasks || []); setMaterials(cache.v === 28 ? cache.materials || [] : []); setComments(cache.comments || []);
        setCompletions(cache.completions || {}); setAnnouncements(cache.announcements || []); setWeeklies(cache.weeklies || []);
        setGroups(cache.groups || []); setSubjectDefs(cache.subjects || []);
        setLoading(false); ready.current = true;
        lastSync.current = Date.now(); setSyncing(true);
        try { await loadShared(classId); } finally { if (!dead) setSyncing(false); }
      } else {
        setSyncing(true);
        try { await loadShared(classId); } finally { if (!dead) setSyncing(false); }
        lastSync.current = Date.now();
        if (!dead) { setLoading(false); ready.current = true; }
      }
    })();
    return () => { dead = true; };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // sync when the app comes back to the front, not on a timer
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") { Sound.resume(); refresh(); } else Sound.pause(); };
    const onFocus = () => refresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onFocus); };
  }, [refresh]);

  /* ----- remember things ----- */
  useEffect(() => { if (!ready.current) return; store.set(`prefs:${user}`, prefs); }, [prefs, user]);
  useEffect(() => {
    if (!ready.current) return undefined;
    const id = setTimeout(() => store.set(`cache:${user}`, { v: 28, tasks, materials, comments, completions, announcements, weeklies, groups, subjects: subjectDefs }), 900);
    return () => clearTimeout(id);
  }, [tasks, materials, comments, completions, announcements, weeklies, groups, subjectDefs, user]);
  const setUi = useCallback((fn) => setPrefsState((p) => ({ ...p, ui: typeof fn === "function" ? fn(p.ui) : { ...p.ui, ...fn } })), []);
  const dismissAnn = useCallback((id) => setPrefsState((p) => ({ ...p, dismissedAnn: [...p.dismissedAnn, id] })), []);

  /* ----- saving ----- */
  const mutate = useCallback((key, setter, fn, empty = []) => {
    setter((c) => fn(c));
    const cid = classRef.current;
    const shared = SHARED.includes(key);
    const fk = shared ? `${cid}:${key}` : key;
    return writes.current.attempt({ id: uid(), run: () => store.update(fk, fn, empty), reapply: (c) => { if (!shared || c === cid) setter((x) => fn(x)); } });
  }, []);
  // Send every failed save again (not a re-download, which would throw the change away), then refresh.
  const retryFailed = useCallback(async () => {
    setRetrying(true);
    try { await writes.current.retryAll(); await refresh(true); } finally { setRetrying(false); }
  }, [refresh]);
  // Study data and plans save themselves; they report here so the banner knows.
  const reportSave = useCallback((slot, key, ok, value) => writes.current.record(slot, ok, () => store.set(key, value, true)), []);

  const setSubject = useCallback((d) => {
    SUBJ_REG[d.name] = d.color;
    mutate("subjects", setSubjectDefs, (c) => [...c.filter((x) => x.name !== d.name), { name: d.name, color: d.color }]);
  }, [mutate]);
  const subjectDefsRef = useRef(subjectDefs); subjectDefsRef.current = subjectDefs;
  const ensureSubject = useCallback((name) => {
    const n = (name || "").trim();
    if (n && !subjectDefsRef.current.some((x) => x.name === n) && !SUBJ[n]) setSubject({ name: n, color: subjColor(n) });
  }, [setSubject]);
  useMemo(() => { subjectDefs.forEach((d) => { SUBJ_REG[d.name] = d.color; }); }, [subjectDefs]);

  const addTask = useCallback((t) => { ensureSubject(t.subject); return mutate("tasks", setTasks, (c) => [...c, t]); }, [ensureSubject, mutate]);
  const updateTask = useCallback((t) => { ensureSubject(t.subject); return mutate("tasks", setTasks, (c) => c.map((x) => (x.id === t.id ? t : x))); }, [ensureSubject, mutate]);
  const deleteTask = useCallback((id) => {
    const task = tasksRef.current.find((t) => t.id === id);
    mutate("tasks", setTasks, (c) => c.filter((x) => x.id !== id));
    Sound.play("rip");
    if (task) toast("Task taken down", { undo: () => addTask(task) });
  }, [mutate, toast, addTask]);

  const addGroup = useCallback((g) => mutate("groups", setGroups, (c) => [...c, g]), [mutate]);
  const deleteGroup = useCallback((id) => {
    mutate("groups", setGroups, (c) => c.filter((x) => x.id !== id));
    mutate("tasks", setTasks, (c) => c.map((t) => (t.groupId === id ? { ...t, groupId: null } : t)));
    Sound.play("rip");
  }, [mutate]);
  const saveGroup = useCallback((g, isEdit) => {
    ensureSubject(g.subject);
    if (isEdit) {
      mutate("groups", setGroups, (c) => c.map((x) => (x.id === g.id ? g : x)));
      mutate("tasks", setTasks, (c) => c.map((t) => (t.groupId === g.id ? { ...t, subject: g.subject, quarter: g.quarter } : t)));
    } else addGroup({ ...g, id: uid(), createdBy: user, createdAt: Date.now() });
    Sound.play("add");
  }, [ensureSubject, mutate, addGroup, user]);
  const joinGroup = useCallback((id, join) => mutate("groups", setGroups, (c) => c.map((x) => {
    if (x.id !== id) return x;
    const m = (x.members || []).filter((n) => n !== user);
    return { ...x, members: join ? [...m, user] : m };
  })), [mutate, user]);

  const saveWeekly = useCallback((weekStart, text) =>
    mutate("weeklies", setWeeklies, (c) => [...c.filter((w) => w.weekStart !== weekStart), { id: uid(), weekStart, text, by: user, at: Date.now() }]), [mutate, user]);
  const addComment = useCallback((taskId, text) => { Sound.play("send"); mutate("comments", setComments, (c) => [...c, { id: uid(), taskId, by: user, text, at: Date.now() }]); }, [mutate, user]);
  const removeComment = useCallback((id) => mutate("comments", setComments, (c) => c.filter((x) => x.id !== id)), [mutate]);
  const postAnn = useCallback((text) => { Sound.play("add"); return mutate("announcements", setAnnouncements, (c) => [...c, { id: uid(), text, at: Date.now(), by: user }]); }, [mutate, user]);
  const removeAnn = useCallback((id) => mutate("announcements", setAnnouncements, (c) => c.filter((x) => x.id !== id)), [mutate]);

  /* ----- notes (their own tables, see lib/notes.js) ----- */
  const markInventory = useCallback((id, entry) => setMaterials((c) => c.map((m) => (m.id === id ? { ...m, ic: entry.ideas.length, src: entry.src } : m))), []);
  const ingestRef = useRef(null); // the notes reader (app/ingest.jsx), set below
  // The RAW save: the note exactly as given, before anything reads it. Text longer than one note can hold is never cut here
  // (the reader splits it into numbered parts first), so this refuses it instead of losing the end.
  const saveNote = useCallback(async (n) => {
    const id = n.id || uid();
    const subject = (n.subject || "").trim() || "General";
    const topic = normTopic(n.topic);
    const text = String(n.text || "");
    if (text.length > MAX_BODY) return false;
    let file = n.file || null;
    if (!file && n.fileObj) { if (n.onProgress) n.onProgress("Keeping the original"); file = await notes.uploadFile(classRef.current, id, n.fileObj); }
    const ok = await notes.add({ id, classId: classRef.current, author: user, subject, topic, title: n.title, text, kind: n.kind || "upload", taskId: n.taskId, taskTitle: n.taskTitle, file });
    if (!ok) { if (file && !n.file) notes.removeFile(file.path); return false; }
    ensureSubject(subject);
    const meta = { id, file, taskId: n.taskId || null, title: String(n.title || "Untitled notes").slice(0, 120), by: user, kind: n.kind || "upload", at: Date.now(), subject, topic, taskTitle: n.taskTitle || "", n: text.length, ic: 0, src: null, mine: true, orphan: false };
    setMaterials((c) => [meta, ...c.filter((x) => x.id !== id)]);
    Sound.play("add");
    return true;
  }, [user, ensureSubject]);
  // Saves a note, then reads it into the class's shared study ideas in the background (chunk by chunk, resumable).
  const addNote = useCallback(async (n) => {
    const id = n.id || uid();
    const ok = await saveNote({ ...n, id });
    if (ok && (n.kind || "upload") !== "ai") ingestRef.current?.startIdeas?.({ noteId: id, title: String(n.title || "Untitled notes").slice(0, 120), subject: (n.subject || "").trim() || "General", topic: normTopic(n.topic), text: String(n.text || ""), noteKind: n.kind || "upload", taskId: n.taskId, taskTitle: n.taskTitle });
    return ok;
  }, [saveNote]);
  const relabelMaterial = useCallback(async (id, patch) => {
    const ok = await notes.relabel(id, patch);
    if (ok) { ensureSubject(patch.subject); setMaterials((c) => c.map((m) => (m.id === id ? { ...m, ...patch, topic: normTopic(patch.topic) } : m))); }
    return ok;
  }, [ensureSubject]);
  const materialsRef = useRef(materials); materialsRef.current = materials;
  const topicNames = useCallback((subject) => topicList(materialsRef.current, subject ? [subject] : []).map((x) => x.topic), []);
  const noteInfo = useCallback((id) => materialsRef.current.find((m) => m.id === id), []);
  const ingest = useIngest({ user, classRef, saveNote, markInventory, relabel: relabelMaterial, topicNames, noteInfo, toast });
  ingestRef.current = ingest;
  const removeMaterial = useCallback(async (id) => {
    const m = materialsRef.current.find((x) => x.id === id);
    if (!m) return;
    const body = (await notes.text([id]))[id] || "";
    const ok = await notes.remove(id);
    if (!ok) { toast("We couldn't remove that just now. Only the person who added it can remove it."); return; }
    setMaterials((c) => c.filter((x) => x.id !== id));
    Sound.play("rip");
    let undone = false;
    if (m.file) setTimeout(() => { if (!undone) notes.removeFile(m.file.path); }, 15000);
    toast("Notes removed", { undo: () => { undone = true; return addNote({ id, title: m.title, text: body, subject: m.subject, topic: m.topic, kind: m.kind, taskId: m.taskId, taskTitle: m.taskTitle, file: m.file }); } });
  }, [toast, addNote]);

  /* ----- progress ----- */
  const markCompletion = useCallback((id, done) =>
    mutate("completions", setCompletions, (c) => {
      const set = new Set(c[id] || []);
      if (done) set.add(user); else set.delete(user);
      return { ...c, [id]: [...set] };
    }, {}), [mutate, user]);
  const logActivity = useCallback(() => {
    const d = todayISO();
    setActivity((a) => {
      if (a.includes(d)) return a;
      const n = [...a, d].slice(-120);
      try { localStorage.setItem("hr:act:" + user, JSON.stringify(n)); } catch { /* storage blocked */ }
      return n;
    });
  }, [user]);
  const setStatus = useCallback((id, s) => {
    const cur = progressRef.current;
    const prev = cur[id] || "todo";
    if (prev === s) return;
    const next = { ...cur, [id]: s };
    progressRef.current = next; setProgress(next);
    Sound.play(s === "done" ? "done" : s === "progress" ? "pop" : "undo");
    if (s === "done" && navigator.vibrate) navigator.vibrate([8, 50, 16]);
    // Only this one task's status is written, merged into whatever is saved.
    progressStamp.current++; progressBusy.current++;
    progressQ.current = progressQ.current
      .then(() => writes.current.attempt({
        id: `progress:${id}`,
        run: () => store.update(`u:${user}:progress`, (c) => ({ ...(c && typeof c === "object" ? c : {}), [id]: s }), {}),
        reapply: () => { const n = { ...progressRef.current, [id]: s }; progressRef.current = n; setProgress(n); },
      }))
      .finally(() => { progressBusy.current--; });
    if (s === "done" || prev === "done") markCompletion(id, s === "done");
    if (s === "done") logActivity();
    if (s === "done") {
      const today = tasksRef.current.filter((t) => t.deadline === todayISO());
      const clear = today.length > 1 && today.every((t) => next[t.id] === "done");
      if (clear) setTimeout(() => Sound.play("schoolbell"), 450);
      toast(clear ? "That\u2019s everything due today. Nicely done." : "Marked done", { undo: () => setStatus(id, prev), ms: clear ? 5200 : 4200 });
    }
  }, [user, markCompletion, logActivity, toast]);

  // tasks finished before "N finished" existed still count
  useEffect(() => {
    if (loading || backfilled.current || !tasks.length) return;
    backfilled.current = true;
    const missing = tasks.filter((t) => progress[t.id] === "done" && !(completions[t.id] || []).includes(user));
    if (missing.length) mutate("completions", setCompletions, (c) => {
      const n = { ...c };
      missing.forEach((t) => { n[t.id] = [...new Set([...(n[t.id] || []), user])]; });
      return n;
    }, {});
  }, [loading, user, tasks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendFeedback = useCallback(async (type, text) => { await supabase.from("feedback").insert({ type, from_user: user, text }); }, [user]);

  const subjects = useMemo(() => [...new Set([...DEFAULT_SUBJECTS, ...subjectDefs.map((d) => d.name), ...tasks.map((t) => t.subject), ...groups.map((g) => g.subject)])], [subjectDefs, tasks, groups]);
  const myClass = classes.find((c) => c.id === classId);
  const classQuarter = myClass?.quarter || 1;
  const defQuarter = prefs.ui.q && prefs.ui.q !== "All" ? Number(prefs.ui.q) : classQuarter;
  const groupById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])), [groups]);
  const streak = calcStreak(activity);

  // a clean slate when someone switches class
  const resetShared = useCallback(() => {
    setTasks([]); setMaterials([]); setComments([]); setCompletions({}); setAnnouncements([]); setWeeklies([]); setGroups([]); setSubjectDefs([]); notes.clear();
    backfilled.current = false;
  }, []);

  const value = {
    user, classId, setClassId, classes, setClasses, isAdmin, myClass, classLabel: myClass?.label, classQuarter, defQuarter,
    tasks, materials, comments, completions, announcements: announcements.filter((a) => !prefs.dismissedAnn.includes(a.id)), allAnnouncements: announcements,
    weeklies, groups, groupById, subjects, progress, activity, streak,
    ui: prefs.ui, setUi, dismissAnn, loading, syncing, syncErr: failedCount > 0, retrying, retryFailed, reportSave, refresh, loadShared, resetShared,
    addTask, updateTask, deleteTask, setStatus, addGroup, saveGroup, deleteGroup, joinGroup, setSubject, ensureSubject,
    saveWeekly, addComment, removeComment, postAnn, removeAnn,
    addNote, relabelMaterial, removeMaterial, markInventory, sendFeedback, ingest,
    toDays: diffDays, today: todayISO, toISO, addDays,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
