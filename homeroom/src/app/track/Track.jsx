// Track: the class's shared tasks. One primary action (add a task), one summary, everything else a calm list.
import { useMemo, useState } from "react";
import { Plus, Flame, Sparkles, Timer, ListChecks, SlidersHorizontal, Megaphone, ClipboardCheck, CheckCheck } from "lucide-react";
import { useData } from "../data.jsx";
import { useShell } from "../shell-context.js";
import { useMedia } from "../../lib/hooks.js";
import { subjColor, QUARTERS } from "../../lib/constants.js";
import { todayISO, addDays, diffDays, weekStartOf } from "../../lib/dates.js";
import { Button, Chip, Segmented, Banner, Empty, Skeleton, Sheet, Ring, Bar, cx } from "../ui.jsx";
import { TaskRow, TaskForm, TaskDetail, CalendarView, BoardView, PlanTonight, FocusPanel } from "./parts.jsx";

const PRIO = { High: 0, Medium: 1, Low: 2 };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

export default function Track() {
  const d = useData();
  const { route, go, back, openForm, timer, openReviewFor } = useShell();
  const { user, tasks, progress, completions, ui, setUi, groupById, groups, streak } = d;
  const phone = useMedia("(max-width: 767px)");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [lingering, setLingering] = useState({});
  const [selDay, setSelDay] = useState(todayISO());
  const [month, setMonth] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [hideWk, setHideWk] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);

  const view = ui.view === "done" ? "done" : "open";
  const mode = view === "done" ? "list" : ui.mode === "board" && phone ? "list" : ui.mode;
  const qv = ui.q && ui.q !== "All" ? Number(ui.q) : null;
  const st = (t) => progress[t.id] || "todo";
  const fin = (t) => (completions[t.id] || []).filter((u) => u !== user).length;
  const subjectsInUse = useMemo(() => [...new Set(tasks.map((t) => t.subject))], [tasks]);
  const subj = ui.subj === "All" || subjectsInUse.includes(ui.subj) ? ui.subj : "All";
  const kinds = [...new Set(tasks.map((t) => t.type))];

  const base = tasks.filter((t) => (subj === "All" || t.subject === subj) && (ui.kind === "All" || t.type === ui.kind) && (qv === null || t.quarter === qv))
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || PRIO[a.priority] - PRIO[b.priority] || a.title.localeCompare(b.title));
  const open = base.filter((t) => st(t) !== "done" || lingering[t.id]);
  const doneList = (() => { const q = d.classQuarter; return tasks.filter((t) => (ui.doneAll || (t.quarter || 1) === q) && st(t) === "done" && (subj === "All" || t.subject === subj)).sort((a, b) => b.deadline.localeCompare(a.deadline)); })();

  const toggle = (t) => {
    const to = st(t) === "done" ? "todo" : "done";
    if (to === "done" && view === "open") { setLingering((l) => ({ ...l, [t.id]: true })); setTimeout(() => setLingering((l) => { const n = { ...l }; delete n[t.id]; return n; }), 1400); }
    d.setStatus(t.id, to);
  };
  const setStatusKeep = (id, s) => { const t = tasks.find((x) => x.id === id); if (s === "done" && view === "open" && t) { setLingering((l) => ({ ...l, [id]: true })); setTimeout(() => setLingering((l) => { const n = { ...l }; delete n[id]; return n; }), 1400); } d.setStatus(id, s); };
  const openTask = (id) => go("track", "task", id);

  // today at a glance
  const mine = tasks.filter((t) => st(t) !== "done");
  const overdue = mine.filter((t) => diffDays(t.deadline) < 0).length;
  const today = mine.filter((t) => diffDays(t.deadline) === 0).length;
  const week = mine.filter((t) => { const n = diffDays(t.deadline); return n >= 0 && n <= 7; }).length;
  const ws = weekStartOf(todayISO());
  const wkTasks = tasks.filter((t) => t.deadline >= ws && t.deadline <= addDays(ws, 6));
  const wkDone = wkTasks.filter((t) => st(t) === "done").length;
  const wkPct = wkTasks.length ? wkDone / wkTasks.length : 0;
  const dow = new Date().getDay();
  const wkBanner = tasks.length > 0 && (dow === 0 || dow === 1) ? (() => {
    const w = dow === 0 ? ws : addDays(ws, -7);
    const which = dow === 0 ? "this week\u2019s" : "last week\u2019s";
    const saved = d.weeklies.some((x) => x.weekStart === w);
    return { w, text: saved ? `The reviewer for ${which} tasks is ready to read.` : `Make ${which} reviewer from everything your class added.` };
  })() : null;
  const ann = [...d.announcements].sort((a, b) => b.at - a.at)[0];

  // groups of the open list
  const sections = (() => {
    if (ui.group === "subject") return subjectsInUse.map((s) => ({ key: s, items: open.filter((t) => t.subject === s) })).filter((g) => g.items.length);
    if (ui.group === "group") {
      const gs = [...groups].filter((g) => (qv === null || g.quarter === qv) && (subj === "All" || g.subject === subj)).sort((a, b) => a.quarter - b.quarter || a.subject.localeCompare(b.subject) || a.name.localeCompare(b.name))
        .map((g) => ({ key: g.name, items: open.filter((t) => t.groupId === g.id), sub: `${g.subject}, Q${g.quarter}` })).filter((g) => g.items.length);
      const loose = open.filter((t) => !t.groupId || !groupById[t.groupId]);
      return loose.length ? [...gs, { key: "No group", items: loose }] : gs;
    }
    return [["Overdue", (n) => n < 0], ["Today", (n) => n === 0], ["Tomorrow", (n) => n === 1], ["Later this week", (n) => n > 1 && n <= 7], ["After that", (n) => n > 7]]
      .map(([key, fn]) => ({ key, items: open.filter((t) => fn(diffDays(t.deadline))), tone: key === "Overdue" ? "late" : undefined })).filter((g) => g.items.length);
  })();
  const activeFilters = (qv !== null ? 1 : 0) + (ui.kind !== "All" ? 1 : 0) + (ui.group !== "date" ? 1 : 0);

  // the task sheet is a route, so Back closes it
  const detailId = route.parts[0] === "task" ? route.parts[1] : null;
  const detail = detailId ? tasks.find((t) => t.id === detailId) : null;
  const closeDetail = () => back("track");

  const summary = today + overdue === 0 ? "Nothing urgent right now." : `${today} due today${overdue ? `, ${overdue} overdue` : ""}.`;
  const changeMode = (m) => setUi((u) => ({ ...u, mode: m }));
  const showCal = view === "open" && mode === "calendar";
  const modeOpts = [["list", "List"], ["calendar", "Calendar"], ...(phone ? [] : [["board", "Board"]])];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}{d.classLabel && <span className="only-xs"> &middot; Class {d.classLabel}</span>}</p>
          <h1>{greeting()}, {user}.</h1>
          <p className="lede">{summary}{week > 0 ? ` ${week} due in the next 7 days.` : ""}</p>
        </div>
        <Button variant="primary" size="lg" className="only-wide" onClick={() => openForm()}><Plus size={18} aria-hidden="true" />Add task</Button>
      </header>

      <div className="stack">
        {ann && <Banner tone="accent" icon={Megaphone} onClose={() => d.dismissAnn(ann.id)}><b>From your admin</b><span>{ann.text}</span></Banner>}
        {wkBanner && !hideWk && <Banner icon={ClipboardCheck} onClose={() => setHideWk(true)} action={<Button size="sm" onClick={() => go("review", "reviewers", wkBanner.w)}>Open weekly reviewer</Button>}>{wkBanner.text}</Banner>}

        <section className="card week-card" aria-label="This week">
          <Ring pct={wkPct} size={phone ? 64 : 76}><span className="ring-n">{Math.round(wkPct * 100)}%</span></Ring>
          <div className="week-text">
            <h2>This week</h2>
            <p className="muted">{wkTasks.length === 0 ? "Nothing is due this week yet." : `${wkDone} of ${wkTasks.length} done`}</p>
            <p className={cx("streak", !streak && "quiet")}><Flame size={15} aria-hidden="true" />{streak ? `${streak}-day streak` : "Finish a task to start a streak"}</p>
            <div className="week-links">
              <Button variant="ghost" size="sm" onClick={() => setPlanOpen(true)}><Sparkles size={15} aria-hidden="true" />Plan tonight</Button>
              <Button variant="ghost" size="sm" onClick={() => setFocusOpen(true)}><Timer size={15} aria-hidden="true" />Focus timer{timer.running ? ` · ${String(Math.floor(timer.left / 60)).padStart(2, "0")}:${String(timer.left % 60).padStart(2, "0")}` : ""}</Button>
            </div>
          </div>
        </section>

        <div className="toolbar">
          <Segmented label="Show" value={view} options={[["open", "To do"], ["done", "Done"]]} onChange={(v) => setUi((u) => ({ ...u, view: v }))} />
          {view === "open" && <Segmented label="Layout" value={mode} options={modeOpts} onChange={changeMode} />}
          <Button className="filter-btn" aria-expanded={filtersOpen} aria-controls="filters" onClick={() => setFiltersOpen((v) => !v)}>
            <SlidersHorizontal size={16} aria-hidden="true" /><span className="lbl">Filters</span>{activeFilters > 0 && <span className="badge badge-accent">{activeFilters}</span>}
          </Button>
        </div>

        {subjectsInUse.length > 1 && (
          <div className="chips chips-scroll" role="group" aria-label="Subject">
            <Chip on={subj === "All"} onClick={() => setUi((u) => ({ ...u, subj: "All" }))}>All subjects</Chip>
            {subjectsInUse.map((s) => <Chip key={s} on={subj === s} onClick={() => setUi((u) => ({ ...u, subj: s }))}><i className="dot" style={{ background: subjColor(s) }} />{s}</Chip>)}
          </div>
        )}

        <div id="filters" className="filters" hidden={!filtersOpen}>
          <div className="card stack">
            <div className="field"><span className="label">Quarter</span><Segmented label="Quarter" value={ui.q || "All"} options={[["All", "All"], ...QUARTERS.map((q) => [String(q), `Q${q}`])]} onChange={(v) => setUi((u) => ({ ...u, q: v }))} /></div>
            {kinds.length > 1 && <div className="field"><span className="label">Kind</span><div className="chips" role="group" aria-label="Kind">{["All", ...kinds].map((k) => <Chip key={k} on={ui.kind === k} onClick={() => setUi((u) => ({ ...u, kind: k }))}>{k === "All" ? "Any kind" : k}</Chip>)}</div></div>}
            {view === "open" && mode === "list" && <div className="field"><span className="label">Group the list</span><Segmented label="Group the list" value={ui.group} options={[["date", "By date"], ["subject", "By subject"], ["group", "By group"]]} onChange={(v) => setUi((u) => ({ ...u, group: v }))} /></div>}
            {activeFilters > 0 && <div><Button size="sm" onClick={() => setUi((u) => ({ ...u, q: "All", kind: "All", group: "date" }))}>Clear filters</Button></div>}
          </div>
        </div>

        {d.loading && tasks.length === 0 && <Skeleton rows={5} />}

        {!d.loading && view === "open" && mode === "list" && (
          sections.length === 0 ? (
            tasks.length === 0 ? (
              <Empty icon={ListChecks} title="Nothing on the list yet" action={<Button variant="primary" onClick={() => openForm()}><Plus size={16} aria-hidden="true" />Add the first task</Button>}>Add a homework or deadline and your whole class will see it.</Empty>
            ) : activeFilters > 0 || subj !== "All" ? (
              <Empty icon={SlidersHorizontal} title="Nothing matches these filters" action={<Button onClick={() => setUi((u) => ({ ...u, q: "All", kind: "All", group: "date", subj: "All" }))}>Show everything</Button>}>Try a different subject or clear the filters.</Empty>
            ) : (
              <Empty icon={CheckCheck} title="You\u2019re all caught up" action={<Button onClick={() => openForm()}><Plus size={16} aria-hidden="true" />Add a task</Button>}>Nothing is waiting for you. Enjoy it, or get ahead in Review.</Empty>
            )
          ) : sections.map((g) => (
            <section key={g.key} className="group" aria-label={g.key}>
              <h2 className={cx("group-h", g.tone)}>{g.key}<span className="badge">{g.items.length}</span>{g.sub && <span className="caption">{g.sub}</span>}</h2>
              <div className="card card-flat divided">{g.items.map((t) => <TaskRow key={t.id} t={t} status={st(t)} finished={fin(t)} groupName={ui.group === "group" ? null : groupById[t.groupId]?.name} onOpen={() => openTask(t.id)} onToggle={() => toggle(t)} />)}</div>
            </section>
          ))
        )}

        {!d.loading && view === "open" && mode === "board" && <BoardView items={base} status={st} finished={fin} groupById={groupById} setStatus={setStatusKeep} openTask={openTask} />}
        {!d.loading && showCal && <CalendarView tasks={tasks.filter((t) => subj === "All" || t.subject === subj)} month={month} onMonth={(n) => setMonth(({ y, m }) => { const x = new Date(y, m + n, 1); return { y: x.getFullYear(), m: x.getMonth() }; })} status={st} completions={completions} user={user} selDay={selDay} setSelDay={setSelDay} openTask={openTask} onToggle={toggle} />}

        {!d.loading && view === "done" && (() => {
          const scope = tasks.filter((t) => d.ui.doneAll || (t.quarter || 1) === d.classQuarter);
          const pct = scope.length ? Math.round((doneList.length / Math.max(1, scope.length)) * 100) : 0;
          const subjectsDone = [...new Set(doneList.map((t) => t.subject))].sort((a, b) => a.localeCompare(b));
          return (
            <>
              <section className="card stack" style={{ gap: 12 }} aria-label="Done summary">
                <div className="between"><h2>{doneList.length} of {scope.length} done</h2><Segmented label="Which quarters" value={d.ui.doneAll ? "all" : "q"} options={[["q", `Quarter ${d.classQuarter}`], ["all", "All quarters"]]} onChange={(v) => setUi((u) => ({ ...u, doneAll: v === "all" }))} /></div>
                <Bar value={pct} label="Share of tasks done" />
                <p className="muted small">{scope.length === 0 ? "Nothing has been added yet." : doneList.length === scope.length ? "Every task is done. Nicely finished." : `${scope.length - doneList.length} still to go.`}</p>
              </section>
              {doneList.length === 0 ? <Empty icon={CheckCheck} title="Nothing finished yet">Tick a task off and it will wait for you here.</Empty> : subjectsDone.map((sj) => {
                const list = doneList.filter((t) => t.subject === sj);
                return (
                  <section key={sj} className="group" aria-label={sj}>
                    <h2 className="group-h"><i className="dot" style={{ background: subjColor(sj) }} />{sj}<span className="badge">{list.length}</span></h2>
                    <div className="card card-flat divided">{list.map((t) => <TaskRow key={t.id} t={t} status="done" finished={fin(t)} onOpen={() => openTask(t.id)} onToggle={() => d.setStatus(t.id, "todo")} />)}</div>
                  </section>
                );
              })}
            </>
          );
        })()}
      </div>

      <button type="button" className="fab only-narrow" onClick={() => openForm()}><Plus size={22} aria-hidden="true" /><span className="fab-label">Add task</span></button>

      <Sheet open={!!detail} onClose={closeDetail} title="Task">
        {detail && <TaskDetail t={detail} status={st(detail)} finishedOthers={fin(detail)} groupName={groupById[detail.groupId]?.name} comments={d.comments} user={user} isAdmin={d.isAdmin}
          onStatus={(s) => setStatusKeep(detail.id, s)} onReview={() => { openReviewFor(detail.id); }} onEdit={() => { openForm(detail); }}
          onDelete={() => { d.deleteTask(detail.id); closeDetail(); }} onAddComment={d.addComment} onRemoveComment={d.removeComment} />}
      </Sheet>
      <Sheet open={planOpen} onClose={() => setPlanOpen(false)} title="Plan tonight">{planOpen && <PlanTonight tasks={tasks} progress={progress} />}</Sheet>
      <Sheet open={focusOpen} onClose={() => setFocusOpen(false)} title="Focus timer" modal>{focusOpen && <FocusPanel timer={timer} />}</Sheet>
    </div>
  );
}
export { TaskForm };
