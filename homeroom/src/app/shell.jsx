// The frame around the signed-in app: top bar, navigation (tab bar, rail or sidebar by screen size), and the sheets every
// destination shares (add a task, search, ask, shortcuts).
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ListChecks, BookOpen, Telescope, Users, Settings as SettingsIcon, Search, MessageCircle, WifiOff, Keyboard, RefreshCw } from "lucide-react";
import { useData } from "./data.jsx";
import { ShellCtx } from "./shell-context.js";
import { DESTINATIONS, shortcutDest } from "./nav.js";
import { useFocusTimer, setTitleBase, useCabin } from "../lib/hooks.js";
import { subjColor } from "../lib/constants.js";
import { relLabel } from "../lib/dates.js";

import { uid } from "../lib/helpers.js";
import { Sound } from "../lib/sound.js";
import { Sheet, Button, Banner, Empty, useToast } from "./ui.jsx";
import Chat from "./class/Chat.jsx";
import { Wordmark } from "./auth.jsx";
import { TaskForm } from "./track/parts.jsx";
import { useSearchHits } from "./track/parts.jsx";
import Assistant from "./Assistant.jsx";

const ICONS = { track: ListChecks, review: BookOpen, prepare: Telescope, class: Users, settings: SettingsIcon };
const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");

export function SearchPanel({ tasks, materials, onTask, onMaterial }) {
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  const hits = useSearchHits(s);
  const tr = s ? tasks.filter((t) => [t.title, t.subject, t.type, t.notes].join(" ").toLowerCase().includes(s)).slice(0, 20) : [];
  const byId = new Map(materials.map((m) => [m.id, m]));
  const found = new Map();
  if (s) {
    hits.forEach((h) => { const m = byId.get(h.id); if (m) found.set(m.id, { m, snip: h.snippet }); });
    materials.filter((m) => `${m.title} ${m.subject} ${m.topic}`.toLowerCase().includes(s)).forEach((m) => { if (!found.has(m.id)) found.set(m.id, { m, snip: "" }); });
  }
  const mr = [...found.values()].slice(0, 20);
  return (
    <div className="stack">
      <input className="input" data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks and notes" aria-label="Search tasks and notes" role="searchbox" inputMode="search" enterKeyHint="search" autoComplete="off" spellCheck={false} />
      {s && tr.length === 0 && mr.length === 0 && <Empty icon={Search} title="Nothing matches">No tasks or notes mention &ldquo;{q.trim()}&rdquo;. Try a shorter word.</Empty>}
      {tr.length > 0 && (
        <section><h3 className="eyebrow" style={{ marginBottom: 4 }}>Tasks · {tr.length}</h3>
          <div className="card card-flat divided">{tr.map((t) => (
            <button key={t.id} className="row-btn" onClick={() => onTask(t.id)}><span className="grow"><span className="title">{t.title}</span><span className="meta"><span><i className="dot" style={{ background: subjColor(t.subject) }} />{t.subject}</span><span>{t.type}</span><span>{relLabel(t.deadline)}</span></span></span></button>
          ))}</div></section>
      )}
      {mr.length > 0 && (
        <section><h3 className="eyebrow" style={{ marginBottom: 4 }}>Notes · {mr.length}</h3>
          <div className="card card-flat divided">{mr.map(({ m, snip }) => (
            <button key={m.id} className="row-btn" onClick={() => onMaterial(m)}><span className="grow"><span className="title">{m.title}</span><span className="meta"><span>{m.subject}</span>{m.topic && <span>{m.topic}</span>}<span>{tasks.find((t) => t.id === m.taskId)?.title || m.taskTitle || "Class notes"}</span></span>{snip && <span className="small muted" style={{ display: "block", marginTop: 4 }}>{snip}</span>}</span></button>
          ))}</div></section>
      )}
    </div>
  );
}

function ShortcutList() {
  const rows = [
    [[mac ? "\u2318" : "Ctrl", "K"], "Search everything"], [["/"], "Search, from anywhere"], [["n"], "Add a task"],
    [["g", "t"], "Go to Track"], [["g", "r"], "Go to Review"], [["g", "p"], "Go to Prepare"], [["g", "c"], "Go to Class"], [["g", "s"], "Go to Settings"], [["g", "d"], "Show what you have finished"], [["g", "a"], "Ask the assistant"],
    [["j"], "Next task in the list"], [["k"], "Previous task in the list"], [["x"], "Mark the focused task done"], [["?"], "Show this list"], [["Esc"], "Close whatever is open"],
  ];
  return (
    <ul className="plain sc-list" aria-label="Keyboard shortcuts">
      {rows.map(([keys, what]) => <li key={what}><span>{what}</span><span className="cluster" style={{ gap: 4 }}>{keys.map((k, i) => <kbd key={i}>{k}</kbd>)}</span></li>)}
    </ul>
  );
}

export default function Shell({ route, go, back, children }) {
  const d = useData();
  const timer = useFocusTimer();
  const toast = useToast();
  const cabin = useCabin(d.user, d.classId, !!d.user && !!d.classId && !d.isAdmin);
  const [chat, setChat] = useState(null);       // the classmate we are chatting with
  const threads = useRef({});                    // temporary: kept only while Homeroom stays open
  const openChat = useCallback((n) => { cabin.clearUnread(n); setChat(n); }, [cabin]);
  useEffect(() => {
    if (!cabin.lastRing) return;
    const from = cabin.lastRing.from;
    Sound.play("bell");
    toast(`${from} wants to chat`, { undo: () => openChat(from), label: "Open" });
  }, [cabin.lastRing]); // eslint-disable-line react-hooks/exhaustive-deps
  const [form, setForm] = useState(null);       // null | { task? }
  const [searchOpen, setSearchOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pendingScope, setPendingScope] = useState(null); // a study request from another destination (Prepare, Track)
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const gPending = useRef(0);
  const current = DESTINATIONS.find((x) => x.id === route.dest) || DESTINATIONS[0];

  useEffect(() => { setTitleBase(`${current.title} \u00b7 Homeroom`); }, [current.title]);
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
  // when you move to another destination, the new page gets focus so a keyboard or screen-reader user starts at its top
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } document.getElementById("main")?.focus({ preventScroll: true }); window.scrollTo?.(0, 0); }, [route.dest]);

  const openForm = useCallback((task) => setForm({ task: task || null }), []);
  const startStudy = useCallback((sc) => { setPendingScope({ ...sc, id: uid() }); go("review"); }, [go]);
  const clearScope = useCallback(() => setPendingScope(null), []);
  const openReviewFor = useCallback((id) => { setForm(null); go("review", "task", id); }, [go]);
  const saveTask = useCallback((f, newGroup) => {
    let groupId = f.groupId || null;
    if (newGroup) { groupId = uid(); d.addGroup({ id: groupId, name: newGroup.name, subject: f.subject, quarter: f.quarter, createdBy: d.user, createdAt: Date.now() }); }
    if (form?.task) { d.updateTask({ ...form.task, ...f, groupId }); Sound.play("pop"); }
    else { d.addTask({ ...f, groupId, id: uid(), addedBy: d.user, createdAt: Date.now() }); Sound.play("add"); }
    setForm(null);
  }, [d, form]);

  // keyboard: n new task, / or Ctrl/Cmd+K search, ? help, "g" then a letter to go somewhere, j/k/x in lists
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.altKey) { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); } return; }
      if (e.ctrlKey && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); return; }
      const el = e.target;
      if (el.closest?.("input,textarea,select,[contenteditable],dialog[open]")) return;
      if (document.querySelector("dialog[open]")) return;
      const k = e.key;
      if (gPending.current && Date.now() - gPending.current < 1200) {
        gPending.current = 0;
        const dest = shortcutDest(k);
        if (dest) { e.preventDefault(); go(dest); }
        // two v33 shortcuts keep working: g d shows what is done, g a opens the assistant
        else if (k === "d") { e.preventDefault(); d.setUi((u) => ({ ...u, view: "done" })); go("track"); }
        else if (k === "a") { e.preventDefault(); setAskOpen(true); }
        return;
      }
      if (k === "g") { gPending.current = Date.now(); return; }
      if (k === "n") { e.preventDefault(); openForm(); }
      else if (k === "/") { e.preventDefault(); setSearchOpen(true); }
      else if (k === "?") { e.preventDefault(); setHelpOpen(true); }
      else if (k === "j" || k === "k" || k === "x") {
        const rows = [...document.querySelectorAll(".task-main")];
        if (!rows.length) return;
        const i = rows.indexOf(document.activeElement?.closest?.(".task-main") || document.activeElement);
        if (k === "x") { const row = document.activeElement?.closest?.(".task"); row?.querySelector(".check")?.click(); return; }
        const next = rows[Math.max(0, Math.min(rows.length - 1, i < 0 ? 0 : i + (k === "j" ? 1 : -1)))];
        next.focus(); next.scrollIntoView({ block: "nearest" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, openForm, d]);

  const ctx = useMemo(() => ({ route, go, back, openForm, openSearch: () => setSearchOpen(true), openAsk: () => setAskOpen(true), openHelp: () => setHelpOpen(true), timer, openReviewFor, startStudy, pendingScope, clearScope, cabin, openChat }), [route, go, back, openForm, timer, openReviewFor, startStudy, pendingScope, clearScope, cabin, openChat]);

  return (
    <ShellCtx.Provider value={ctx}>
      <div className="app">
        <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
        {d.syncing && <div className="sync" role="progressbar" aria-label="Syncing" />}
        <nav className="nav" aria-label="Main">
          <div className="nav-brand"><Wordmark /></div>
          {DESTINATIONS.map((x) => {
            const Icon = ICONS[x.id];
            return (
              <a key={x.id} className="nav-item" href={`#/${x.id}`} aria-current={route.dest === x.id ? "page" : undefined} onClick={(e) => { e.preventDefault(); go(x.id); }}>
                <Icon size={22} strokeWidth={route.dest === x.id ? 2.2 : 1.8} aria-hidden="true" /><span>{x.label}</span>
              </a>
            );
          })}
          <div className="nav-spacer" />
        </nav>
        <div className="main">
          <header className="topbar">
            <div className="topbar-l">
              <Wordmark className="only-narrow" />
              {d.classLabel && <span className="badge class-pill" title="Your class">Class {d.classLabel}</span>}
            </div>
            <div className="topbar-r">
              <button type="button" className="search-pill" onClick={() => setSearchOpen(true)} aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}><Search size={16} aria-hidden="true" />Search<kbd aria-hidden="true">{mac ? "\u2318K" : "Ctrl K"}</kbd></button>
              <Button variant="ghost" icon className="search-icon" onClick={() => setSearchOpen(true)} aria-label="Search tasks and notes"><Search size={20} /></Button>
              <Button variant="secondary" size="sm" onClick={() => setAskOpen(true)}><MessageCircle size={16} aria-hidden="true" /><span>Ask</span></Button>
              <Button variant="ghost" icon className="only-wide help-btn" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts"><Keyboard size={18} /></Button>
            </div>
          </header>
          {!online && <div className="page-pad"><Banner tone="warn" icon={WifiOff}>You&rsquo;re offline. You can read what&rsquo;s already loaded, but changes may not save until you&rsquo;re back online.</Banner></div>}
          {d.syncErr && <div className="page-pad"><Banner tone="warn" icon={RefreshCw} action={<Button size="sm" onClick={d.retryFailed} disabled={d.retrying}>{d.retrying ? "Retrying\u2026" : "Retry"}</Button>}>Some changes haven&rsquo;t saved yet. Check your connection, then retry.</Banner></div>}
          <main id="main" tabIndex={-1} className="main-body">{children}</main>
        </div>

        <Sheet open={!!form} onClose={() => setForm(null)} title={form?.task ? "Edit task" : "Add a task"}>
          {form && <TaskForm key={form.task?.id || "new"} initial={form.task} subjects={d.subjects} groups={d.groups} defQuarter={d.defQuarter} onSave={saveTask} onCancel={() => setForm(null)} onAddSubject={d.setSubject} />}
        </Sheet>
        <Sheet open={searchOpen} onClose={() => setSearchOpen(false)} title="Search">
          {searchOpen && <SearchPanel tasks={d.tasks} materials={d.materials} onTask={(id) => { setSearchOpen(false); go("track", "task", id); }} onMaterial={(m) => { setSearchOpen(false); go("review", "notes", m.id); }} />}
        </Sheet>
        <Sheet open={askOpen} onClose={() => setAskOpen(false)} title="Ask Homeroom" wide>
          {askOpen && <Assistant user={d.user} tasks={d.tasks} materials={d.materials} progress={d.progress} addTask={d.addTask} />}
        </Sheet>
        <Sheet open={!!chat} onClose={() => setChat(null)} title="Chat">
          {chat && <Chat key={chat} peer={chat} me={d.user} classId={d.classId} thread={threads.current[chat]} saveThread={(p, m) => { threads.current[p] = m; }} ring={cabin.ring} peerOnline={cabin.online.has(chat)} />}
        </Sheet>
        <Sheet open={helpOpen} onClose={() => setHelpOpen(false)} title="Keyboard shortcuts" modal>{helpOpen && <ShortcutList />}</Sheet>
      </div>
    </ShellCtx.Provider>
  );
}

