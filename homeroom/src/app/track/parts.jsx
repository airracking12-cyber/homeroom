// Pieces of the Track destination, written fresh for the new design. The task rules (statuses, drafts, quick-add, plan prompt)
// are the v33 ones; only the screens are new.
import { useState, useEffect } from "react";
import { Plus, Sparkles, Pencil, Trash2, ChevronLeft, ChevronRight, Play, Pause, RotateCcw, ArrowUp } from "lucide-react";
import { notes } from "../../lib/services.js";
import { subjColor, SWATCHES, TYPES, PRIORITIES, QUARTERS, STATUSES } from "../../lib/constants.js";
import { todayISO, isRealDate, addDays, diffDays, fmtDate, relLabel, toISO, parse, todayLong, timeAgo } from "../../lib/dates.js";
import { callClaude, streamClaude, parseJSON } from "../../lib/ai.js";
import { statusLabel } from "../../lib/constants.js";
import { mmss } from "../../lib/hooks.js";
import { Sound } from "../../lib/sound.js";
import { Button, Chip, Segmented, Field, Banner, Dots, Spinner, cx } from "../ui.jsx";

/* ── one task ── */
export function TaskRow({ t, status, finished, groupName, onOpen, onToggle, selected }) {
  const n = diffDays(t.deadline);
  const done = status === "done";
  return (
    <div className={cx("task", done && "task-done")} data-selected={selected ? 1 : undefined}>
      <button type="button" className="check" role="checkbox" aria-checked={done} data-s={status} aria-label={`${done ? "Mark as not done" : "Mark as done"}: ${t.title}`} onClick={onToggle}>
        <span>{done && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}</span>
      </button>
      <button type="button" className="task-main" onClick={onOpen}>
        <div className="task-title">{t.title}</div>
        <div className="meta">
          <span><i className="dot" style={{ background: subjColor(t.subject) }} />{t.subject}</span>
          <span>{t.type}</span>
          <span className={!done && n < 0 ? "late" : undefined}>{done ? `Due ${relLabel(t.deadline).toLowerCase()}` : n < 0 ? `Overdue, ${relLabel(t.deadline).toLowerCase()}` : relLabel(t.deadline)}</span>
          {t.priority === "High" && !done && <span>High priority</span>}
          {status === "progress" && <span className="badge badge-accent">In progress</span>}
          {groupName && <span>{groupName}</span>}
          {finished > 0 && <span>{finished} finished</span>}
        </div>
      </button>
    </div>
  );
}

/* ── subject picker: choose, or add one with its colour (shared with the class) ── */
export function SubjectPicker({ subjects, value, onChange, onAdd }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const n = name.trim().slice(0, 40);
  const taken = subjects.some((x) => x.toLowerCase() === n.toLowerCase());
  const add = () => { if (!n || taken) return; onAdd({ name: n, color }); onChange(n); setAdding(false); setName(""); Sound.play("add"); };
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="chips" role="group" aria-label="Subject">
        {subjects.map((x) => <Chip key={x} on={value === x && !adding} onClick={() => { setAdding(false); onChange(x); }}><i className="dot" style={{ background: subjColor(x) }} />{x}</Chip>)}
        <Chip on={adding} onClick={() => setAdding(!adding)}><Plus size={14} aria-hidden="true" />New subject</Chip>
      </div>
      {adding && (
        <div className="card card-ink stack" style={{ gap: 12 }}>
          <Field label="Subject name" htmlFor="ns-name" error={taken ? "That subject is already on the list." : undefined}>
            <input id="ns-name" className="input" value={name} maxLength={40} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          </Field>
          <ColorPicker value={color} onChange={setColor} />
          <Button size="sm" variant="primary" disabled={!n || taken} onClick={add}>Add subject</Button>
        </div>
      )}
    </div>
  );
}
export function ColorPicker({ value, onChange }) {
  return (
    <div className="swatches" role="radiogroup" aria-label="Subject colour">
      {SWATCHES.map((c, i) => (
        <button key={c} type="button" className="sw" role="radio" aria-checked={value === c} aria-label={`Colour ${i + 1}`} style={{ "--sw": c }} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

/* ── a half-written new task survives an accidental close or refresh (this browser only) ── */
const DRAFT_KEY = "hr:draft:task";
const readDraft = () => {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (!d || typeof d !== "object") return null;
    const title = String(d.title || "").slice(0, 200), nt = String(d.notes || "").slice(0, 2000);
    if (!title.trim() && !nt.trim()) return null;
    return { title, notes: nt, subject: String(d.subject || "").slice(0, 40), type: TYPES.includes(d.type) ? d.type : "Homework", priority: PRIORITIES.includes(d.priority) ? d.priority : "High",
      deadline: isRealDate(d.deadline) && d.deadline >= todayISO() ? d.deadline : addDays(todayISO(), 1) };
  } catch { return null; }
};
const writeDraft = (f) => {
  try { if (f.title.trim() || f.notes.trim()) localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: f.title, subject: f.subject, type: f.type, priority: f.priority, deadline: f.deadline, notes: f.notes })); else localStorage.removeItem(DRAFT_KEY); } catch { /* storage blocked: the draft just isn't kept */ }
};
export const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* storage blocked */ } };

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
    } catch { setErr("We couldn't read that one. Fill in the fields below instead."); Sound.play("err"); } finally { setBusy(false); }
  };
  return (
    <details className="quick">
      <summary><Sparkles size={16} aria-hidden="true" />Fill it in from one sentence</summary>
      <div className="quick-body">
        <div className="row-inline">
          <input className="input" aria-label="Describe the task in one sentence" value={q} onChange={(e) => setQ(e.target.value)} placeholder="math quiz friday, chapter 2" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }} />
          <Button onClick={go} disabled={!q.trim() || busy} aria-label="Fill the form from this sentence">{busy ? <Spinner /> : "Fill in"}</Button>
        </div>
        {err && <p className="error" role="alert">{err}</p>}
      </div>
    </details>
  );
}

export function TaskForm({ initial, subjects, groups, defQuarter, onSave, onCancel, onAddSubject }) {
  const [draft0] = useState(() => (initial ? null : readDraft()));
  const [restored, setRestored] = useState(!!draft0);
  const blank = () => ({ title: "", subject: "", type: "Homework", priority: "High", deadline: addDays(todayISO(), 1), notes: "", quarter: defQuarter, groupId: null });
  const [f, setF] = useState(initial ? { quarter: defQuarter, groupId: null, ...initial } : { ...blank(), ...(draft0 || {}) });
  const [newGroup, setNewGroup] = useState(null);
  useEffect(() => { if (initial) return undefined; const t = setTimeout(() => writeDraft(f), 400); return () => clearTimeout(t); }, [f, initial]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v, ...(k === "subject" || k === "quarter" ? { groupId: null } : {}) }));
  const valid = f.title.trim() && f.subject.trim() && f.deadline;
  const groupOptions = (groups || []).filter((g) => g.subject === f.subject.trim() && g.quarter === f.quarter);
  const fill = (o) => {
    setF((p) => ({ ...p, title: o.title || p.title, subject: o.subject || p.subject, type: TYPES.includes(o.taskType) ? o.taskType : p.type, priority: PRIORITIES.includes(o.priority) ? o.priority : p.priority,
      deadline: isRealDate(o.deadline) ? o.deadline : p.deadline, notes: o.notes || p.notes }));
    if (o.subject && !subjects.includes(o.subject)) onAddSubject({ name: String(o.subject).slice(0, 40), color: subjColor(o.subject) });
  };
  const submit = (e) => { e.preventDefault(); if (!valid) return; clearDraft(); onSave({ ...f, title: f.title.trim(), subject: f.subject.trim() }, newGroup && newGroup.trim() ? { name: newGroup.trim() } : null); };
  const quick = (d) => <Chip key={d[1]} on={f.deadline === d[0]} onClick={() => set("deadline", d[0])}>{d[1]}</Chip>;
  const t0 = todayISO();
  return (
    <form onSubmit={submit} className="stack" noValidate>
      {!initial && <p className="muted small">Everyone in your class will see this.</p>}
      {!initial && <QuickAdd subjects={subjects} onFill={fill} />}
      {restored && <Banner action={<Button variant="ghost" size="sm" onClick={() => { clearDraft(); setF(blank()); setRestored(false); }}>Start fresh</Button>}>Picked up where you left off.</Banner>}
      <Field label="What is it?" htmlFor="tf-title"><input id="tf-title" className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Math quiz 2.2" autoComplete="off" /></Field>
      <Field label="Subject"><SubjectPicker subjects={subjects} value={f.subject} onChange={(v) => set("subject", v)} onAdd={onAddSubject} /></Field>
      <Field label="Due" htmlFor="tf-date">
        <div className="chips" style={{ marginBottom: 4 }}>{[[t0, "Today"], [addDays(t0, 1), "Tomorrow"], [addDays(t0, 7), "Next week"]].map(quick)}</div>
        <input id="tf-date" className="input" type="date" value={f.deadline} onChange={(e) => set("deadline", e.target.value)} />
      </Field>
      <Field label="Kind"><div className="chips" role="group" aria-label="Kind">{TYPES.map((k) => <Chip key={k} on={f.type === k} onClick={() => set("type", k)}>{k}</Chip>)}</div></Field>
      <Field label="Priority"><Segmented label="Priority" value={f.priority} options={PRIORITIES.map((p) => [p, p])} onChange={(v) => set("priority", v)} /></Field>
      <Field label="Guidelines or notes" optional htmlFor="tf-notes"><textarea id="tf-notes" className="textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Pages, what to bring, how it's graded" /></Field>
      <details className="more">
        <summary>Quarter and group</summary>
        <div className="stack" style={{ marginTop: 12 }}>
          <Field label="Quarter"><Segmented label="Quarter" value={String(f.quarter)} options={QUARTERS.map((q) => [String(q), `Q${q}`])} onChange={(v) => set("quarter", Number(v))} /></Field>
          {f.subject.trim() && (
            <Field label="Group" optional>
              <div className="chips" role="group" aria-label="Group">
                <Chip on={!f.groupId && newGroup === null} onClick={() => { setNewGroup(null); set("groupId", null); }}>No group</Chip>
                {groupOptions.map((g) => <Chip key={g.id} on={f.groupId === g.id && newGroup === null} onClick={() => { setNewGroup(null); set("groupId", g.id); }}>{g.name}</Chip>)}
                <Chip on={newGroup !== null} onClick={() => { set("groupId", null); setNewGroup(""); }}><Plus size={14} aria-hidden="true" />New group</Chip>
              </div>
              {newGroup !== null && <input className="input" style={{ marginTop: 10 }} aria-label="New group name" autoFocus value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="Chapter 4: Linear equations" />}
            </Field>
          )}
        </div>
      </details>
      <div className="form-actions">
        <Button variant="primary" size="lg" type="submit" disabled={!valid}>{initial ? "Save changes" : "Add to class"}</Button>
        <Button variant="ghost" size="lg" onClick={onCancel}>Cancel</Button>
      </div>
      {!valid && <p className="help">Add a name and a subject to continue.</p>}
    </form>
  );
}

/* ── task details, with comments ── */
export function Comments({ taskId, comments, user, isAdmin, onAdd, onRemove }) {
  const list = comments.filter((c) => c.taskId === taskId).sort((a, b) => a.at - b.at);
  const [text, setText] = useState("");
  const post = (e) => { e?.preventDefault(); if (!text.trim()) return; onAdd(taskId, text.trim()); setText(""); };
  return (
    <section aria-labelledby="cm-h" className="stack" style={{ gap: 12 }}>
      <h3 id="cm-h">Comments{list.length > 0 && <span className="caption"> · {list.length}</span>}</h3>
      {list.length === 0 && <p className="muted small">Questions go here: which page, what to bring.</p>}
      {list.map((c) => (
        <div className="comment" key={c.id}>
          <div className="between"><span><b>{c.by}</b> <span className="caption">{timeAgo(c.at)}</span></span>{(c.by === user || isAdmin) && <Button variant="ghost" size="sm" onClick={() => onRemove(c.id)}>Delete</Button>}</div>
          <p style={{ whiteSpace: "pre-wrap" }}>{c.text}</p>
        </div>
      ))}
      <form className="row-inline" onSubmit={post}>
        <textarea className="textarea compact" rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment" aria-label="Add a comment" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); post(); } }} />
        <Button variant="primary" icon type="submit" disabled={!text.trim()} aria-label="Post comment"><ArrowUp size={18} /></Button>
      </form>
    </section>
  );
}

export function TaskDetail({ t, status, finishedOthers, groupName, comments, user, isAdmin, onStatus, onReview, onEdit, onDelete, onAddComment, onRemoveComment }) {
  const [confirm, setConfirm] = useState(false);
  const late = diffDays(t.deadline) < 0 && status !== "done";
  return (
    <div className="stack">
      <div>
        <h3 className="display detail-title">{t.title}</h3>
        <div className="meta" style={{ fontSize: "var(--fs-small)", marginTop: 8 }}>
          <span><i className="dot" style={{ background: subjColor(t.subject) }} />{t.subject}</span><span>{t.type}</span><span>{t.priority} priority</span>
          {t.quarter && <span>Quarter {t.quarter}</span>}{groupName && <span>Group: {groupName}</span>}
        </div>
      </div>
      <p className={cx("detail-due", late && "late")}>Due {relLabel(t.deadline).toLowerCase()}, {fmtDate(t.deadline)}{late ? ". This one is overdue." : ""}</p>
      {t.notes && <p style={{ whiteSpace: "pre-wrap" }}>{t.notes}</p>}
      <p className="caption">Added by {t.addedBy === "sample" ? "your class" : t.addedBy}. {finishedOthers > 0 ? `${finishedOthers} classmate${finishedOthers > 1 ? "s have" : " has"} finished this.` : "Nobody else has finished this yet."}</p>
      <Field label="Your progress"><Segmented label="Your progress" full value={status} options={STATUSES} onChange={onStatus} /></Field>
      <div className="form-actions">
        <Button variant="primary" onClick={onReview}>Review for this</Button>
        <Button onClick={onEdit}><Pencil size={15} aria-hidden="true" />Edit</Button>
        <Button variant="ghost" onClick={() => { if (confirm) onDelete(); else setConfirm(true); }} style={{ color: "var(--bad)" }}><Trash2 size={15} aria-hidden="true" />{confirm ? "Tap again to delete" : "Delete"}</Button>
      </div>
      {confirm && <p className="caption" role="status">This removes it for the whole class. Its notes stay in Review, and you can undo right after.</p>}
      <hr style={{ margin: 0 }} />
      <Comments taskId={t.id} comments={comments} user={user} isAdmin={isAdmin} onAdd={onAddComment} onRemove={onRemoveComment} />
    </div>
  );
}

/* ── calendar: weeks start on Monday ── */
export function CalendarView({ tasks, month, onMonth, status, completions, user, selDay, setSelDay, openTask, onToggle }) {
  const lead = (new Date(month.y, month.m, 1).getDay() + 6) % 7;
  const count = new Date(month.y, month.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(toISO(new Date(month.y, month.m, d)));
  const byDay = {};
  tasks.forEach((t) => { (byDay[t.deadline] = byDay[t.deadline] || []).push(t); });
  const today = todayISO();
  const dayTasks = selDay ? byDay[selDay] || [] : [];
  const label = new Date(month.y, month.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return (
    <div className="stack">
      <div className="between">
        <h2 className="cal-title" aria-live="polite">{label}</h2>
        <div className="cluster" style={{ gap: 0 }}>
          <Button variant="ghost" icon onClick={() => onMonth(-1)} aria-label="Previous month"><ChevronLeft size={20} /></Button>
          <Button variant="ghost" icon onClick={() => onMonth(1)} aria-label="Next month"><ChevronRight size={20} /></Button>
        </div>
      </div>
      <div className="cal" role="group" aria-label={label}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="cal-head" aria-hidden="true">{d.slice(0, 1)}</div>)}
        {cells.map((iso, i) => iso ? (
          <button key={iso} type="button" className="day" aria-pressed={selDay === iso} data-today={iso === today ? 1 : undefined} onClick={() => setSelDay(iso)} aria-label={`${fmtDate(iso)}, ${(byDay[iso] || []).length} due`}>
            <span>{parse(iso).getDate()}</span>
            <span className="pips" aria-hidden="true">{(byDay[iso] || []).slice(0, 3).map((t) => <i key={t.id} style={{ background: subjColor(t.subject), opacity: status(t) === "done" ? 0.35 : 1 }} />)}</span>
          </button>
        ) : <span key={`b${i}`} />)}
      </div>
      {selDay && (
        <section aria-label={`Due ${fmtDate(selDay)}`}>
          <h3 className="eyebrow" style={{ marginBottom: 4 }}>{fmtDate(selDay)} · {dayTasks.length} due</h3>
          {dayTasks.length === 0 ? <p className="muted small" style={{ padding: "8px 0" }}>Nothing due this day.</p> : (
            <div className="divided">{dayTasks.map((t) => <TaskRow key={t.id} t={t} status={status(t)} finished={(completions[t.id] || []).filter((u) => u !== user).length} onOpen={() => openTask(t.id)} onToggle={() => onToggle(t)} />)}</div>
          )}
        </section>
      )}
    </div>
  );
}

/* ── board: drag with a mouse, or use the "Move to" menu with touch and keyboard ── */
export function BoardView({ items, status, finished, groupById, setStatus, openTask }) {
  const [over, setOver] = useState(null);
  return (
    <div className="board">
      {STATUSES.map(([k, label]) => {
        const col = items.filter((t) => status(t) === k);
        return (
          <section key={k} className="col" data-over={over === k ? 1 : undefined} aria-label={`${label}, ${col.length}`}
            onDragOver={(e) => { e.preventDefault(); if (over !== k) setOver(k); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); }}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); const t = items.find((x) => x.id === id); if (t && status(t) !== k) setStatus(id, k); }}>
            <h3 className="between"><span>{label}</span><span className="badge">{col.length}</span></h3>
            {col.length === 0 && <p className="caption" style={{ padding: "8px 0" }}>Nothing here</p>}
            {col.map((t) => (
              <article key={t.id} className="card board-card" draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; }}>
                <TaskRow t={t} status={k} finished={finished(t)} groupName={groupById[t.groupId]?.name} onOpen={() => openTask(t.id)} onToggle={() => setStatus(t.id, k === "done" ? "todo" : "done")} />
                <label className="move"><span className="sr">Move {t.title} to</span>
                  <select className="select" value={k} onChange={(e) => setStatus(t.id, e.target.value)}>{STATUSES.map(([v, l]) => <option key={v} value={v}>Move to: {l}</option>)}</select>
                </label>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

/* ── plan tonight (the assistant) ── */
export function PlanTonight({ tasks, progress }) {
  const [mins, setMins] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (m) => {
    setMins(m); setText(""); setBusy(true); setErr("");
    const open = tasks.filter((t) => (progress[t.id] || "todo") !== "done")
      .map((t) => `${t.title} | ${t.subject} | ${t.type} | priority ${t.priority} | due ${t.deadline} (${diffDays(t.deadline)} days from today) | ${statusLabel(progress[t.id])} | ${t.notes || ""}`).join("\n") || "(nothing open)";
    const system = `You help a student plan tonight's work. Today is ${todayLong()}. The student has about ${m} minutes. Open tasks:\n${open}\n\nPick what to do tonight and in what order, weighing due date first, then priority, then how long each kind of task usually takes (quizzes and exams need study time, homework less). Give each step as one line: the task, then a rough number of minutes. End with one short line about what can safely wait. Plain text only, no markdown symbols, no emojis, under 160 words. If nothing is open, say so warmly in one sentence.`;
    try { await streamClaude(system, [{ role: "user", content: "Plan my evening." }], (t) => setText(t)); Sound.play("pop"); }
    catch { setErr("We couldn't plan that just now. Check your connection and try again."); } finally { setBusy(false); }
  };
  if (mins === null) {
    return (
      <div className="stack">
        <p className="muted">How much time do you have tonight?</p>
        <div className="chips">{[[30, "30 minutes"], [60, "1 hour"], [120, "2 hours"], [180, "3 hours"]].map(([m, l]) => <Chip key={m} onClick={() => run(m)}>{l}</Chip>)}</div>
      </div>
    );
  }
  return (
    <div className="stack">
      {busy && !text && <p className="muted" role="status">Looking at your deadlines<Dots /></p>}
      {text && <div className="plan-text" aria-live="polite">{text}</div>}
      {err && <Banner tone="bad" action={<Button size="sm" onClick={() => run(mins)}>Try again</Button>}>{err}</Banner>}
      {!busy && <div><Button size="sm" onClick={() => { setMins(null); setText(""); }}>Change the time</Button></div>}
    </div>
  );
}

/* ── focus timer ── */
export function FocusPanel({ timer }) {
  const modes = [["focus", "Focus 25"], ["break", "Break 5"], ["long", "Long break 15"]];
  const pct = 1 - timer.left / timer.total;
  return (
    <div className="stack" style={{ justifyItems: "center", textAlign: "center" }}>
      <Segmented label="Timer length" value={timer.mode} options={modes} onChange={(m) => timer.reset(m)} />
      <p className="timer-readout display" role="timer" aria-label={`${mmss(timer.left)} left`}>{mmss(timer.left)}</p>
      <div className="bar" style={{ width: "100%", maxWidth: 320 }} aria-hidden="true"><i style={{ transform: `scaleX(${Math.round(pct * 100) / 100})` }} /></div>
      <div className="cluster" style={{ justifyContent: "center" }}>
        {timer.running ? <Button variant="primary" size="lg" onClick={timer.pause}><Pause size={18} aria-hidden="true" />Pause</Button> : <Button variant="primary" size="lg" onClick={timer.start}><Play size={18} aria-hidden="true" />{timer.left < timer.total ? "Resume" : "Start"}</Button>}
        <Button size="lg" onClick={() => timer.reset()}><RotateCcw size={16} aria-hidden="true" />Reset</Button>
      </div>
      <p className="caption">The countdown also shows in this tab&rsquo;s title, so you can switch away.</p>
    </div>
  );
}

export const useSearchHits = (s) => {
  const [hits, setHits] = useState([]);
  useEffect(() => {
    if (s.length < 2) { setHits([]); return undefined; }
    let dead = false;
    const id = setTimeout(async () => { const r = await notes.search(s, 20); if (!dead && r) setHits(r); }, 300);
    return () => { dead = true; clearTimeout(id); };
  }, [s]);
  return hits;
};
