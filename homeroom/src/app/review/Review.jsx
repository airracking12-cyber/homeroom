// Review: get ready for what is coming. Three quiet sections: Study, Notes (the class library) and Reviewers.
// One primary action per section. The study rules, prompts and saved progress are the v33 ones (lib/study.js, lib/review-ai.js).
import { useState, useEffect, useMemo, useRef } from "react";
import { ArrowRight, Layers, TextCursorInput, Shuffle, Lightbulb, GraduationCap, Brain, ListChecks, Timer, CalendarDays, Sparkles, ChevronLeft, ChevronRight, Copy, Trash2, Plus, Download } from "lucide-react";
import { useData } from "../data.jsx";
import { useShell } from "../shell-context.js";
import { notes, store } from "../../lib/services.js";
import { subjColor, REVIEW_TYPES } from "../../lib/constants.js";
import { todayISO, addDays, diffDays, relLabel, weekStartOf, weekLabel, weekData, timeAgo } from "../../lib/dates.js";
import { copyText, uid } from "../../lib/helpers.js";
import { topicList } from "../../lib/notes.js";
import { scopeLine } from "../../lib/library.js";
import { useStudy, ensureInventory, inPeriod, subjectOfMat, TECHS, GOALS, PERIODS, REC, ALL_SCOPE, runLabel } from "../../lib/study.js";
import { makeWeekly, makeTaskReviewer, makeSubjectReviewer } from "../../lib/review-ai.js";
import { Sound } from "../../lib/sound.js";
import { loadSession, saveSession } from "../../lib/coach.js";
import { claim, release, whoHas } from "../../lib/claims.js";
import { loadPractice, noteIdsOf } from "../../lib/practice-store.js";
import { Button, Chip, Segmented, Field, Banner, Empty, Sheet, Dots, Skeleton, useToast, cx } from "../ui.jsx";
import { CardsRun, ClozeRun, MatchRun, MnemonicRun, TeachRun, BlurtRun, QuizRun, PlanRun } from "./runs.jsx";
import { CoachRun } from "./coach.jsx";
import { Library, ReviewerDoc, NoteBody, AddNotesSheet, kindMeta } from "./notes.jsx";

const TECH_ICON = { coach: Sparkles, cards: Layers, cloze: TextCursorInput, match: Shuffle, mnemonic: Lightbulb, teach: GraduationCap, blurt: Brain, quiz: ListChecks, exam: Timer, plan: CalendarDays };
const GOAL_SHORT = { memorize: "Memorize", understand: "Understand", test: "Test myself", plan: "Plan ahead" };

/* ───────────── Study ───────────── */
function StudyHub({ study, update, load, scope, goNotes, openTask }) {
  const toast = useToast();
  const d = useData();
  const { tasks, progress, materials, subjects, user, classQuarter } = d;
  const saved = (() => { try { return JSON.parse(localStorage.getItem("hr:study") || "{}"); } catch { return {}; } })();
  const [period, setPeriod] = useState(PERIODS.some((p) => p[0] === saved.period) ? saved.period : "week");
  const [pick, setPick] = useState(Array.isArray(saved.pick) ? saved.pick : []);
  const [focus, setFocus] = useState(null);
  const [topicPick, setTopicPick] = useState([]);
  const [q, setQ] = useState("");
  const [tech, setTech] = useState(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [run, setRun] = useState(null);
  const [prep, setPrep] = useState("");
  const [note, setNote] = useState("");
  const tried = useRef(new Set());
  useEffect(() => { try { localStorage.setItem("hr:study", JSON.stringify({ period, pick })); } catch { /* storage blocked */ } }, [period, pick]);
  useEffect(() => {
    if (!scope) return;
    setFocus(scope.taskId || null);
    if (scope.period) setPeriod(scope.period);
    if (scope.taskId) setPick([]); else if (scope.subjects) setPick(scope.subjects);
    setTopicPick(scope.taskId ? [] : scope.topics || []);
    setQ(scope.taskId ? "" : scope.q || "");
    setTech(null);
    setNote("");
  }, [scope && scope.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const withSubj = useMemo(() => materials.map((m) => ({ m, t: tasks.find((x) => x.id === m.taskId), subject: subjectOfMat(m, tasks) })), [materials, tasks]);
  const subsWithNotes = useMemo(() => [...new Set(withSubj.map((x) => x.subject))], [withSubj]);
  const poolFor = (sc) => withSubj.filter((x) => x.m.kind !== "ai" && (sc.focus ? x.m.taskId === sc.focus : inPeriod(x.m, x.t, sc.period, classQuarter) && (sc.pick.length === 0 || sc.pick.includes(x.subject)) && (sc.topicPick.length === 0 || sc.topicPick.includes(x.m.topic))));
  const cur = { period, pick, topicPick, q, focus };
  const pool = poolFor(cur);
  const topics = useMemo(() => topicList(materials.filter((m) => m.kind !== "ai"), pick), [materials, pick]);
  const focusTitle = focus ? tasks.find((t) => t.id === focus)?.title : null;
  const ideaCount = pool.reduce((n, x) => n + (x.m.ic || 0), 0);
  const dueCards = useMemo(() => { if (!study) return 0; const t = todayISO(); return Object.values(study.cards).filter((c) => c.due <= t).length; }, [study]);
  const weekSessions = study ? (study.log || []).filter((l) => l.at >= Date.now() - 7 * 864e5).length : 0;
  const hasNotes = materials.some((m) => m.kind !== "ai");

  const prepare = (p) => ensureInventory(p, d.markInventory, setPrep, tried.current);
  // A Coach session needs the class's stored practice questions. What is missing is prepared in the background (the shared
  // database is built once, by whoever gets there first) and the session simply uses plain questions for those notes meanwhile.
  const launch = async (kind, ideas, label) => {
    if (!["coach", "mnemonic", "quiz", "exam"].includes(kind)) { setRun({ kind, ideas, label }); return; }
    const ids = noteIdsOf(ideas), practice = await loadPractice(d.classId, ids), missing = ids.filter((id) => !practice[id]);
    if (missing.length) d.ingest.ensurePractice(missing);
    setRun({ kind, ideas, label, practice });
    if (missing.length && kind === "coach") toast(`Preparing practice questions for ${missing.length} ${missing.length === 1 ? "note" : "notes"}. They get richer in a minute.`);
  };
  const [resumable, setResumable] = useState(null);
  useEffect(() => { let dead = false; loadSession(d.user, { store }).then((s) => { if (!dead) setResumable(s); }); return () => { dead = true; }; }, [d.user, run]);
  const saveSess = (s) => saveSession(d.user, s, { store });
  const continueSession = async () => {
    const practice = await loadPractice(d.classId, [...new Set(resumable.qs.map((q) => q.mid))]);
    setRun({ kind: "coach", ideas: [], label: resumable.label, resume: resumable, practice });
  };
  const discardSession = async () => { await saveSess(null); setResumable(null); };
  const start = async (kind, over = {}) => {
    setNote("");
    const sc = { ...cur, ...over };
    if (kind === "plan") { setRun({ kind, ideas: [], label: "plan" }); return; }
    const word = sc.q.trim();
    if (word && !sc.focus) {
      setPrep("Finding the lessons");
      const found = await notes.findIdeas({ subjects: sc.pick, topics: sc.topicPick, q: word, limit: 120 });
      setPrep("");
      if (found === null) { setNote("We couldn't search just now. Check your connection and try again."); Sound.play("err"); return; }
      if (found.length === 0) { setNote(`No lessons matched \u201c${word}\u201d. Try fewer words, or check the spelling.`); Sound.play("err"); return; }
      await launch(kind, found, runLabel(sc));
      return;
    }
    const p = poolFor(sc);
    if (p.length === 0) { setNote("There are no notes in this selection yet. Try a longer period, or add some notes first."); Sound.play("err"); return; }
    setPrep("Getting your notes ready");
    const inv = await prepare(p);
    const ideas = p.flatMap((x) => (inv[x.m.id]?.ideas || []).map((id, i) => ({ ...id, id: `${x.m.id}:${i}`, mid: x.m.id, mt: x.m.title, subject: x.subject })));
    setPrep("");
    if (ideas.length === 0) { setNote("We couldn't find anything to study in those notes. Try adding clearer notes."); return; }
    await launch(kind, ideas, sc.focus ? (tasks.find((t) => t.id === sc.focus)?.title || "this task") : runLabel(sc));
  };
  const exit = () => setRun(null);

  const rec = focus ? ["coach", "quiz"] : ["coach", ...(REC[period] || [])];
  const techId = tech || rec[0] || "cards";
  const T = TECHS.find((x) => x.id === techId) || TECHS[0];
  const upcoming = useMemo(() => tasks.filter((t) => REVIEW_TYPES.includes(t.type) && (progress[t.id] || "todo") !== "done" && diffDays(t.deadline) >= -1)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .map((t) => { const ms = materials.filter((m) => m.taskId === t.id && m.kind !== "ai"); return { t, n: ms.length, ic: ms.reduce((s, m) => s + (m.ic || 0), 0) }; }), [tasks, progress, materials]);
  const next = upcoming[0];

  if (!study && load.failed) return <Banner tone="warn" action={<Button size="sm" onClick={load.retry}>Try again</Button>}>We couldn&rsquo;t load your study progress. Your saved progress is safe. Check your connection, then try again.</Banner>;
  if (!study) return <Skeleton rows={3} h={72} />;
  if (run) {
    const p = { ideas: run.ideas, study, update, onExit: exit, label: run.label, practice: run.practice };
    return (
      <>
        {run.kind === "coach" && <CoachRun {...p} practice={run.practice} resume={run.resume} onSave={saveSess} onAgain={() => { setRun(null); setTimeout(() => start("coach"), 0); }} />}
        {run.kind === "cards" && <CardsRun {...p} />}
        {run.kind === "cloze" && <ClozeRun {...p} />}
        {run.kind === "match" && <MatchRun {...p} />}
        {run.kind === "mnemonic" && <MnemonicRun {...p} />}
        {run.kind === "teach" && <TeachRun {...p} />}
        {run.kind === "blurt" && <BlurtRun {...p} />}
        {(run.kind === "quiz" || run.kind === "exam") && <QuizRun {...p} kind={run.kind} />}
        {run.kind === "plan" && <PlanRun subjects={pick.length ? pick : subsWithNotes} study={study} update={update} onExit={exit} onStart={(k, s) => { setRun(null); if (s.length) setPick(s); setTimeout(() => start(k, s.length ? { pick: s } : {}), 0); }} />}
      </>
    );
  }

  // the one card at the top: whatever matters most right now
  let hero;
  const soon = next && diffDays(next.t.deadline) <= 3;
  if (!hasNotes) hero = { kicker: "Start here", title: "Add your first notes", body: "Everything you review is built from the notes your class adds.", cta: "Add notes", act: goNotes };
  else if (soon || (!dueCards && next)) hero = { kicker: `${next.t.type} ${relLabel(next.t.deadline).toLowerCase()}`, urgent: soon, title: next.t.title,
    body: next.n ? `${next.n} ${next.n === 1 ? "note" : "notes"}, ${next.ic} key ideas ready.` : "No notes for this yet. Add some and you can study them here.",
    cta: next.n ? "Study this" : "Add notes", act: () => (next.n ? start(diffDays(next.t.deadline) <= 3 ? "quiz" : "cards", { focus: next.t.id }) : openTask(next.t.id)), more: () => openTask(next.t.id) };
  else if (dueCards > 0) hero = { kicker: "Today", title: `${dueCards} flashcard${dueCards > 1 ? "s" : ""} due`, body: "A few minutes of repetition now means less cramming later.", cta: "Review cards", act: () => start("cards", ALL_SCOPE) };
  else hero = { kicker: "Ready when you are", title: "Nothing urgent, so go deeper", body: "Pick a technique below and keep your notes fresh. Ten minutes beats a long night.", cta: null };

  const sc = scopeLine({ period, subjects: pick, topics: topicPick, q });
  const scopeWhat = /^every (subject|topic)$/i.test(sc.what) ? sc.what.toLowerCase() : sc.what;
  const scopeText = focus ? `Only ${focusTitle || "this task"}` : q.trim() ? `Lessons matching ${sc.what}` : `${sc.when}: ${scopeWhat}`;
  const scopeCount = q.trim() && !focus ? "Searches all notes" : pool.length === 0 ? "No notes yet" : `${pool.length} ${pool.length === 1 ? "note" : "notes"}${ideaCount ? `, ${ideaCount} ideas` : ""}`;
  const goalId = T.goal;
  const goalTechs = TECHS.filter((x) => x.goal === goalId);
  const pickGoal = (g) => { const inGoal = TECHS.filter((x) => x.goal === g); setTech((inGoal.find((x) => rec.includes(x.id)) || inGoal[0]).id); };
  const TIcon = TECH_ICON[T.id];

  return (
    <div className="stack-lg">
      {resumable && !prep && (
        <Banner tone="accent" icon={Sparkles} action={<><Button size="sm" variant="primary" onClick={continueSession}>Continue</Button><Button size="sm" variant="ghost" onClick={discardSession}>Start over</Button></>}>
          <b>You have a Coach session in progress.</b>
          <span>{resumable.results.length} of {resumable.qs.length} questions answered in {resumable.label}. Your answers are saved.</span>
        </Banner>
      )}
      <section className={cx("card next-card", hero.urgent && "urgent")} aria-label="Next up">
        <span className={cx("badge", hero.urgent ? "badge-accent" : "")}>{hero.kicker}</span>
        <h2>{hero.title}</h2>
        <p className="muted">{hero.body}</p>
        {(dueCards > 0 || weekSessions > 0) && hasNotes && <p className="small"><span><b>{dueCards}</b> cards due</span>{weekSessions > 0 && <span> · <b>{weekSessions}</b> {weekSessions > 1 ? "sessions" : "session"} this week</span>}</p>}
        {hero.cta && <div className="form-actions"><Button variant="primary" size="lg" disabled={!!prep} onClick={hero.act}>{hero.cta}<ArrowRight size={16} aria-hidden="true" /></Button>{hero.more && <Button size="lg" onClick={hero.more}>Details</Button>}</div>}
      </section>

      <section className="stack" aria-label="Choose how to study">
        <button type="button" className="card scope-row" onClick={() => setScopeOpen(true)} aria-haspopup="dialog">
          <span className="grow"><span className="eyebrow">Reviewing</span><span className="scope-text">{scopeText}</span><span className="muted small">{scopeCount}</span></span>
          <span className="link" aria-hidden="true">Change</span>
        </button>

        <div className="stack" style={{ gap: 12 }}>
          <div className="chips" role="group" aria-label="What do you want from this session">{GOALS.map(([g]) => <Chip key={g} on={goalId === g} onClick={() => pickGoal(g)}>{GOAL_SHORT[g]}</Chip>)}</div>
          <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Technique">
            {goalTechs.map((x) => {
              const Icon = TECH_ICON[x.id];
              return (
                <button key={x.id} type="button" role="radio" aria-checked={techId === x.id} className="tech" onClick={() => setTech(x.id)}>
                  <span className="glyph"><Icon size={20} aria-hidden="true" /></span>
                  <span className="grow"><span className="title">{x.name}{rec.includes(x.id) && <span className="badge badge-accent" style={{ marginLeft: 8 }}>Suggested</span>}</span><span className="small muted">{x.tip}</span><span className="caption">{x.time}</span></span>
                </button>
              );
            })}
          </div>
        </div>
        {note && <Banner tone="warn">{note}</Banner>}
        {prep && <p className="muted" role="status">{prep}<Dots /></p>}
        <div><Button variant="primary" size="lg" disabled={!!prep} onClick={() => start(techId)}><TIcon size={18} aria-hidden="true" />Start {T.name.toLowerCase()}</Button></div>
      </section>

      {upcoming.length > (hero.more ? 1 : 0) && (
        <section aria-label="Coming up">
          <h2 className="eyebrow" style={{ marginBottom: 8 }}>Coming up</h2>
          <div className="card card-flat divided">
            {upcoming.filter((u) => !(hero.more && u.t.id === next.t.id)).slice(0, 4).map(({ t, n, ic }) => (
              <button key={t.id} type="button" className="row-btn" onClick={() => (n ? start(diffDays(t.deadline) <= 3 ? "quiz" : "cards", { focus: t.id }) : openTask(t.id))}>
                <span className="grow"><span className="title">{t.title}</span><span className="meta"><span><i className="dot" style={{ background: subjColor(t.subject) }} />{t.subject}</span><span>{t.type}, {relLabel(t.deadline).toLowerCase()}</span><span>{n ? `${ic} ideas` : "no notes yet"}</span></span></span>
                <ChevronRight size={18} className="muted" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      )}

      <Sheet open={scopeOpen} onClose={() => setScopeOpen(false)} title="What to review">
        {scopeOpen && (
          <div className="stack">
            {focus && <Banner action={<Button size="sm" onClick={() => setFocus(null)}>Review more</Button>}>Reviewing only <b>{focusTitle}</b>.</Banner>}
            <Field label="How far back"><div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="How far back">{PERIODS.map(([id, name, tip]) => <button key={id} type="button" role="radio" aria-checked={period === id} className="tech" onClick={() => { setPeriod(id); setFocus(null); }}><span className="grow"><span className="title">{name}</span><span className="small muted">{tip}</span></span></button>)}</div></Field>
            {subsWithNotes.length > 0 && <Field label="Subjects" optional><div className="chips" role="group" aria-label="Subjects">{subsWithNotes.map((s) => <Chip key={s} on={pick.includes(s)} onClick={() => { setFocus(null); setTopicPick([]); setPick((c) => (c.includes(s) ? c.filter((x) => x !== s) : [...c, s])); }}><i className="dot" style={{ background: subjColor(s) }} />{s}</Chip>)}</div></Field>}
            {topics.length > 0 && <Field label="Topics" optional><div className="chips" role="group" aria-label="Topics">{topics.slice(0, 24).map((x) => <Chip key={x.topic} on={topicPick.includes(x.topic)} onClick={() => { setFocus(null); setTopicPick((c) => (c.includes(x.topic) ? c.filter((t) => t !== x.topic) : [...c, x.topic])); }}>{x.topic}</Chip>)}</div></Field>}
            <Field label="Or find lessons by a word" optional htmlFor="sc-q" help="Homeroom picks the matching ideas from every note."><input id="sc-q" className="input" value={q} onChange={(e) => { setFocus(null); setQ(e.target.value); }} placeholder="photosynthesis" /></Field>
            <Button variant="primary" size="lg" block onClick={() => setScopeOpen(false)}>Done</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/* ───────────── Reviewers ───────────── */
// Reviewers are made ONCE for the whole class, first come first served. While a classmate is writing one, this looks for it every few
// seconds (for as long as a claim lasts) and calls onFound when it appears.
function useWaitFor(active, find, refresh, onFound) {
  const f = useRef({ find, refresh, onFound }); f.current = { find, refresh, onFound };
  useEffect(() => {
    if (!active) return undefined;
    let n = 0;
    const t = setInterval(() => { n++; const hit = f.current.find(); if (hit) { clearInterval(t); f.current.onFound(hit); } else if (n > 32) clearInterval(t); else f.current.refresh?.(); }, 6000);
    return () => clearInterval(t);
  }, [active]);
}
const holderLine = (by) => `${by} is writing this reviewer right now. It will appear here in a minute, and you won't need to make your own.`;

function ReviewerBuilder({ open, onClose, preset, onMade }) {
  const d = useData();
  const { materials, subjects } = d;
  const used = useMemo(() => [...new Set(materials.filter((m) => m.kind !== "ai").map((m) => m.subject))], [materials]);
  const [subject, setSubject] = useState("");
  const [tops, setTops] = useState([]);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setSubject(preset?.subject || ""); setTops(preset?.topics || []); setFocus(""); setErr(""); } }, [open, preset?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const topicChoices = useMemo(() => topicList(materials.filter((m) => m.kind !== "ai"), subject ? [subject] : []), [materials, subject]);
  const pool = materials.filter((m) => m.kind !== "ai" && m.subject === subject && (!tops.length || tops.includes(m.topic)));
  const ready = pool.reduce((n, m) => n + (m.ic || 0), 0);
  const title = `Reviewer: ${subject}${tops.length ? ` \u00b7 ${[...tops].sort().join(", ")}` : ""}${focus.trim() ? ` (${focus.trim().slice(0, 40)})` : ""}`.slice(0, 120);
  const existing = () => d.materials.find((m) => m.kind === "ai" && !m.taskId && m.subject === subject && m.title.toLowerCase() === title.toLowerCase());
  const claimKey = `${d.classId}:claim:subject:${title.toLowerCase()}`;
  const [holder, setHolder] = useState(null);
  useWaitFor(!!holder && open, () => existing(), d.refresh, (m) => { setHolder(null); onClose(); onMade(m.id); });
  const build = async () => {
    setErr(""); setHolder(null);
    const have = existing(); // the whole class shares one: if it is already there, just open it
    if (have) { Sound.play("pop"); onClose(); onMade(have.id); return; }
    const c = await claim(store, claimKey, d.user);
    if (c.error) { setErr("We couldn't reach your class just now. Check your connection and try again."); Sound.play("err"); return; }
    if (!c.won) { setHolder(c.by); return; }
    setBusy("Finding your notes");
    try {
      const r = await makeSubjectReviewer({ subject, tops, focus, pool, onInventory: d.markInventory, onProgress: setBusy });
      const id = uid();
      const ok = await d.addNote({ id, title, text: r.text, kind: "ai", subject, topic: r.topic });
      if (!ok) throw new Error("save");
      Sound.play("bell"); setBusy(""); onClose(); onMade(id);
    } catch (e) {
      setBusy("");
      setErr(e && e.message === "none" ? "There are no notes for that yet. Add some in the Notes section first." : "The assistant couldn't write a reviewer just now. Try again in a moment.");
      Sound.play("err");
    } finally { release(store, claimKey, d.user); }
  };
  return (
    <Sheet open={open} onClose={() => { if (!busy) onClose(); }} title="Write a reviewer">
      <div className="stack">
        <p className="muted">Pick a subject. Homeroom reads the class&rsquo;s notes for it, then writes one page that covers every key idea.</p>
        <Field label="Subject"><div className="chips" role="group" aria-label="Subject">{(used.length ? used : subjects).map((s) => <Chip key={s} on={subject === s} onClick={() => { setSubject(s); setTops([]); }}><i className="dot" style={{ background: subjColor(s) }} />{s}</Chip>)}</div></Field>
        {subject && topicChoices.length > 0 && <Field label="Topics" optional help="Leave empty for the whole subject."><div className="chips" role="group" aria-label="Topics">{topicChoices.slice(0, 24).map((x) => <Chip key={x.topic} on={tops.includes(x.topic)} onClick={() => setTops((c) => (c.includes(x.topic) ? c.filter((t) => t !== x.topic) : [...c, x.topic]))}>{x.topic}</Chip>)}</div></Field>}
        {subject && <Field label="Focus on" optional htmlFor="rb-focus"><input id="rb-focus" className="input" value={focus} maxLength={80} onChange={(e) => setFocus(e.target.value)} placeholder="a word or lesson the quiz will cover" /></Field>}
        {subject && <p className="muted small">{pool.length === 0 ? "No notes match yet." : `${pool.length} ${pool.length === 1 ? "note" : "notes"} will be read${ready ? `, ${ready} ideas ready` : ""}.`}</p>}
        {err && <Banner tone="bad">{err}</Banner>}
        {holder && <Banner icon={Sparkles}>{holderLine(holder)}</Banner>}
        <Button variant="primary" size="lg" block disabled={!subject || pool.length === 0 || !!busy || !!holder} onClick={build}>{busy ? <>{busy}<Dots /></> : <><Sparkles size={16} aria-hidden="true" />Write my reviewer</>}</Button>
      </div>
    </Sheet>
  );
}

function ReviewerReader({ m, onBack, onStudy, removeMaterial }) {
  const [copied, setCopied] = useState(false);
  const { label } = kindMeta(m);
  const copy = async () => { const t = (await notes.text([m.id]))[m.id] || ""; const ok = await copyText(t); setCopied(ok); if (ok) Sound.play("pop"); setTimeout(() => setCopied(false), 1800); };
  return (
    <div className="stack">
      <div><Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft size={16} aria-hidden="true" />Reviewers</Button></div>
      <div className="cluster"><span className="badge"><i className="dot" style={{ background: subjColor(m.subject) }} />{m.subject}</span>{m.topic && <span className="badge">{m.topic}</span>}<span className="badge">{label}</span></div>
      <h2 className="reader-h">{m.title}</h2>
      <p className="muted small">By {m.mine ? "you" : m.by}, {timeAgo(m.at)}. Everyone in your class can read this.</p>
      <div className="form-actions"><Button variant="primary" onClick={() => onStudy({ subjects: [m.subject], topics: m.topic ? [m.topic] : [], period: "final" })}>Study this</Button><Button onClick={copy}><Copy size={14} aria-hidden="true" />{copied ? "Copied" : "Copy"}</Button>{(m.mine || m.orphan) && <Button variant="ghost" style={{ color: "var(--bad)" }} onClick={() => { removeMaterial(m.id); onBack(); }}><Trash2 size={14} aria-hidden="true" />Remove</Button>}</div>
      <NoteBody id={m.id} doc />
    </div>
  );
}

function WeeklyReviewer({ initialWs, onStudy, onBack }) {
  const d = useData();
  const { tasks, materials, weeklies } = d;
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
  const claimKey = `${d.classId}:claim:weekly:${ws}`;
  const [holder, setHolder] = useState(null);
  useEffect(() => { let dead = false; whoHas(store, claimKey).then((h) => { if (!dead) setHolder(h && h !== d.user && !saved ? h : null); }); return () => { dead = true; }; }, [claimKey, saved && saved.at]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekliesRef = useRef(weeklies); weekliesRef.current = weeklies;
  useWaitFor(!!holder && !saved, () => weekliesRef.current.find((w) => w.weekStart === ws), d.refresh, () => setHolder(null));
  const stale = !!saved && ms.some((m) => (m.at || 0) > (saved.at || 0)); // only worth updating when newer notes have arrived
  const generate = async () => {
    if (!ts.length && !ms.length) { setErr("Nothing was due or added that week yet, so there\u2019s nothing to review."); Sound.play("err"); return; }
    setErr("");
    const c = await claim(store, claimKey, d.user);   // first come, first served: one reviewer per week for the whole class
    if (c.error) { setErr("We couldn't reach your class just now. Check your connection and try again."); Sound.play("err"); return; }
    if (!c.won) { setHolder(c.by); return; }
    setBusy(true); setLive("Reading the week\u2019s notes");
    try { const full = await makeWeekly({ ws, tasks, materials, onInventory: d.markInventory, onLive: setLive }); d.saveWeekly(ws, full); Sound.play("bell"); }
    catch { setErr("The assistant couldn't write the reviewer just now. Try again in a moment."); Sound.play("err"); } finally { setBusy(false); release(store, claimKey, d.user); }
  };
  return (
    <div className="stack">
      <div><Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft size={16} aria-hidden="true" />Reviewers</Button></div>
      <div><h2 className="reader-h">Weekly reviewer</h2><p className="muted small">{weekLabel(ws)}. {ts.length} {ts.length === 1 ? "task" : "tasks"} due, {ms.length} {ms.length === 1 ? "item" : "items"} of material.</p></div>
      <Segmented label="Which week" value={ws === thisWeek || ws === lastWeek ? ws : "other"} onChange={(v) => { if (v !== "other" && !busy) { setWs(v); setErr(""); } }} options={[[thisWeek, "This week"], [lastWeek, "Last week"], ...(ws !== thisWeek && ws !== lastWeek ? [["other", "Earlier"]] : [])]} />
      {busy && !live && <p className="muted" role="status">Gathering the week<Dots /></p>}
      {shown && <ReviewerDoc text={shown} live={busy} />}
      {saved && !busy && <p className="caption">Made by {saved.by}, {timeAgo(saved.at)}. Everyone in your class can read this.</p>}
      {!saved && !busy && !err && <Empty icon={CalendarDays} title="This week\u2019s binder isn\u2019t made yet">It pulls every task and note from the week into one page, once, for the whole class.</Empty>}
      {err && <Banner tone="bad">{err}</Banner>}
      {!busy && <div className="form-actions">{holder && !saved && <Banner icon={Sparkles}>{holderLine(holder)}</Banner>}{(!saved || stale) && !holder && <Button variant={saved ? "secondary" : "primary"} onClick={generate}>{saved ? "Update with new notes" : "Make the reviewer"}</Button>}{saved && <Button variant="primary" onClick={() => onStudy({ period: "week" })}>Study this week</Button>}{saved && <Button onClick={async () => { const ok = await copyText(saved.text); setCopied(ok); if (ok) Sound.play("pop"); setTimeout(() => setCopied(false), 1800); }}><Copy size={14} aria-hidden="true" />{copied ? "Copied" : "Copy"}</Button>}</div>}
      {earlier.length > 0 && <section><h3 className="eyebrow" style={{ marginBottom: 8 }}>Earlier weeks · {earlier.length}</h3><div className="card card-flat divided">{earlier.map((w) => <button key={w.weekStart} type="button" className="row-btn" onClick={() => { if (!busy) { setWs(w.weekStart); setErr(""); } }}><span className="grow"><span className="title">{weekLabel(w.weekStart)}</span><span className="meta"><span>By {w.by}</span></span></span><ChevronRight size={18} className="muted" aria-hidden="true" /></button>)}</div></section>}
    </div>
  );
}

function Reviewers({ parts, go, onStudy, builderPreset }) {
  const d = useData();
  const { materials, weeklies } = d;
  const thisWeek = weekStartOf(todayISO());
  const [building, setBuilding] = useState(!!builderPreset);
  const [preset, setPreset] = useState(builderPreset || null);
  useEffect(() => { if (builderPreset) { setPreset(builderPreset); setBuilding(true); } }, [builderPreset?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const made = materials.filter((m) => m.kind === "ai" || m.kind === "reviewer").sort((a, b) => b.at - a.at);
  const wk = weeklies.find((w) => w.weekStart === thisWeek);
  const bySubject = useMemo(() => { const g = new Map(); for (const m of made) { const k = m.subject || "Other"; g.set(k, [...(g.get(k) || []), m]); } return [...g.entries()]; }, [made]);
  const first = parts[0];
  if (first && /^\d{4}-\d{2}-\d{2}$/.test(first)) return <WeeklyReviewer key={first} initialWs={first} onStudy={onStudy} onBack={() => go("review", "reviewers")} />;
  if (first === "weekly") return <WeeklyReviewer key="wk" initialWs={thisWeek} onStudy={onStudy} onBack={() => go("review", "reviewers")} />;
  const mine = first ? made.find((m) => m.id === first) : null;
  if (mine) return <ReviewerReader m={mine} onBack={() => go("review", "reviewers")} onStudy={onStudy} removeMaterial={d.removeMaterial} />;
  return (
    <div className="stack-lg">
      <div className="between wrap">
        <p className="muted small" style={{ maxWidth: "52ch" }}>One-page summaries built from your class&rsquo;s notes. Everyone in the class can read them.</p>
        <Button variant="primary" onClick={() => { setPreset(null); setBuilding(true); }}><Sparkles size={16} aria-hidden="true" />Write a reviewer</Button>
      </div>
      <button type="button" className="card scope-row" onClick={() => go("review", "reviewers", "weekly")}>
        <CalendarDays size={22} aria-hidden="true" className="muted" />
        <span className="grow"><span className="scope-text">This week&rsquo;s reviewer</span><span className="muted small">{wk ? `Ready, made by ${wk.by} ${timeAgo(wk.at)}` : "One page covering everything the class did this week."}</span></span>
        <ChevronRight size={18} className="muted" aria-hidden="true" />
      </button>
      {made.length === 0 ? <Empty icon={Sparkles} title="No binders on the shelf yet">Write one from your class&rsquo;s notes, or share one you made from the Notes section.</Empty> : bySubject.map(([subj, list]) => (
        <section key={subj} aria-label={subj}>
          <h2 className="group-h"><i className="dot" style={{ background: subjColor(subj) }} />{subj}<span className="badge">{list.length}</span></h2>
          <div className="card card-flat divided">{list.map((m) => { const { label, Icon } = kindMeta(m); return (
            <button key={m.id} type="button" className="row-btn" onClick={() => go("review", "reviewers", m.id)}><span className="note-ic" data-kind={m.kind}><Icon size={18} aria-hidden="true" /></span><span className="grow"><span className="title">{m.title}</span><span className="meta">{m.topic && <span>{m.topic}</span>}<span>{label}</span><span>{timeAgo(m.at)}</span></span></span><ChevronRight size={18} className="muted" aria-hidden="true" /></button>
          ); })}</div>
        </section>
      ))}
      <ReviewerBuilder open={building} onClose={() => setBuilding(false)} preset={preset} onMade={(id) => go("review", "reviewers", id)} />
    </div>
  );
}

/* ───────────── one task's review page ───────────── */
function TaskReview({ task, onBack, onStudy }) {
  const d = useData();
  const { materials, subjects } = d;
  const mats = materials.filter((m) => m.taskId === task.id);
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState("");
  const aiNote = () => mats.find((m) => m.kind === "ai");
  const claimKey = `${d.classId}:claim:task:${task.id}`;
  const [holder, setHolder] = useState(null);
  const matsRef = useRef(mats); matsRef.current = mats;
  useWaitFor(!!holder, () => matsRef.current.find((m) => m.kind === "ai"), d.refresh, (m) => { setHolder(null); setOpen(m.id); });
  const generate = async () => {
    setErr(""); setHolder(null);
    const have = aiNote(); // one reviewer per task for the whole class: if it is there already, open it
    if (have) { Sound.play("pop"); setOpen(have.id); return; }
    const c = await claim(store, claimKey, d.user);
    if (c.error) { setErr("We couldn't reach your class just now. Check your connection and try again."); Sound.play("err"); return; }
    if (!c.won) { setHolder(c.by); return; }
    setGen(true);
    try {
      const r = await makeTaskReviewer({ task, mats, onInventory: d.markInventory });
      const ok = await d.addNote({ title: `Reviewer for ${task.title}`, text: r.text, kind: "ai", subject: task.subject, topic: r.topic, taskId: task.id, taskTitle: task.title });
      if (!ok) throw new Error("save");
      Sound.play("bell");
    } catch { setErr("The assistant couldn't write a reviewer just now. Try again in a moment."); Sound.play("err"); } finally { setGen(false); release(store, claimKey, d.user); }
  };
  const source = mats.filter((m) => m.kind !== "ai");
  const ideas = source.reduce((n, m) => n + (m.ic || 0), 0);
  const late = diffDays(task.deadline) < 0;
  const download = async (m) => { const url = m.file && await notes.fileUrl(m.file.path); if (url) window.open(url, "_blank", "noopener"); else Sound.play("err"); };
  return (
    <div className="stack">
      <div><Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft size={16} aria-hidden="true" />Review</Button></div>
      <div className="cluster"><span className="badge"><i className="dot" style={{ background: subjColor(task.subject) }} />{task.subject}</span><span className="badge">{task.type}</span><span className={cx("badge", late && "badge-bad")}>Due {relLabel(task.deadline).toLowerCase()}</span></div>
      <h2 className="reader-h">{task.title}</h2>
      {task.notes && <p className="muted">{task.notes}</p>}
      <p className="small muted">{source.length} {source.length === 1 ? "note" : "notes"} · {ideas} key ideas · {mats.length - source.length} {mats.length - source.length === 1 ? "reviewer" : "reviewers"}</p>
      <div className="form-actions"><Button variant="primary" size="lg" onClick={() => onStudy({ taskId: task.id })}>Study this<ArrowRight size={16} aria-hidden="true" /></Button><Button size="lg" onClick={generate} disabled={gen || !!holder}><Sparkles size={15} aria-hidden="true" />{gen ? <>Writing reviewer<Dots /></> : mats.some((m) => m.kind === "ai") ? "Open the class reviewer" : "Ask for a reviewer"}</Button></div>
      {holder && <Banner icon={Sparkles}>{holderLine(holder)}</Banner>}
      {err && <Banner tone="bad" action={<Button size="sm" onClick={generate}>Try again</Button>}>{err}</Banner>}
      <h3 className="eyebrow" style={{ marginTop: 8 }}>Material for this task</h3>
      {mats.length === 0 ? <Empty icon={Plus} title="Nothing here yet" action={<Button variant="primary" onClick={() => setAdding(true)}>Add material</Button>}>Paste notes, or upload a PDF, photo or text file so classmates can use them too.</Empty> : (
        <div className="card card-flat divided">
          {mats.map((m) => { const { label, Icon } = kindMeta(m); const isOpen = open === m.id; return (
            <div key={m.id}>
              <button type="button" className="row-btn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.id)}><span className="note-ic" data-kind={m.kind}><Icon size={18} aria-hidden="true" /></span><span className="grow"><span className="title">{m.title}</span><span className="meta">{m.topic && <span>{m.topic}</span>}<span>{label}</span><span>{m.mine ? "You" : m.by}</span>{m.ic > 0 && <span>{m.ic} ideas</span>}</span></span><ChevronRight size={18} className="muted" aria-hidden="true" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform var(--dur-1) var(--ease)" }} /></button>
              {isOpen && <div className="note-open stack"><NoteBody id={m.id} doc={m.kind === "ai" || m.kind === "reviewer"} /><div className="cluster">{m.file && <Button size="sm" onClick={() => download(m)}><Download size={14} aria-hidden="true" />Original</Button>}{(m.mine || m.orphan) && <Button size="sm" variant="ghost" style={{ color: "var(--bad)" }} onClick={() => d.removeMaterial(m.id)}><Trash2 size={14} aria-hidden="true" />Remove</Button>}</div></div>}
            </div>
          ); })}
        </div>
      )}
      {mats.length > 0 && <div><Button onClick={() => setAdding(true)}><Plus size={15} aria-hidden="true" />Add material</Button></div>}
      <AddNotesSheet open={adding} onClose={() => setAdding(false)} materials={materials} subjects={subjects} onAddSubject={d.setSubject} fixedSubject={task.subject} heading="Add review material" taskId={task.id} taskTitle={task.title} />
    </div>
  );
}

/* ───────────── the destination ───────────── */
export default function Review() {
  const d = useData();
  const { route, go, pendingScope, clearScope } = useShell();
  const [study, update, load] = useStudy(d.user, (ok, value) => d.reportSave("study", `u:${d.user}:study`, ok, value));
  const [scope, setScope] = useState(null);
  const [focusRun, setFocusRun] = useState(false);
  const [builder, setBuilder] = useState(null);
  useEffect(() => { if (pendingScope) { setScope(pendingScope); clearScope(); } }, [pendingScope]); // eslint-disable-line react-hooks/exhaustive-deps
  const sec = route.parts[0] || "study";
  const parts = route.parts.slice(1);
  const startStudy = (sc) => { setScope({ ...sc, id: uid() }); go("review"); };
  const taskPage = sec === "task" ? d.tasks.find((t) => t.id === parts[0]) : null;

  // while a study run is on screen the section tabs step aside
  useEffect(() => { const el = document.documentElement; const on = () => setFocusRun(el.hasAttribute("data-focus")); const mo = new MutationObserver(on); mo.observe(el, { attributes: true, attributeFilter: ["data-focus"] }); on(); return () => mo.disconnect(); }, []);

  if (sec === "task" && taskPage) return <div className="page page-narrow"><TaskReview task={taskPage} onBack={() => go("track", "task", taskPage.id)} onStudy={startStudy} /></div>;
  const active = sec === "notes" || sec === "reviewers" ? sec : "study";
  const noteId = sec === "notes" ? parts[0] || null : null;
  return (
    <div className={cx("page", focusRun && "page-run")}>
      {!focusRun && (
        <header className="page-head">
          <div><h1>Review</h1><p className="lede">Get ready for a quiz or test, and keep the class&rsquo;s notes in one place.</p></div>
        </header>
      )}
      {!focusRun && <div className="subnav"><Segmented label="Review sections" value={active} full options={[["study", "Study"], ["notes", "Notes"], ["reviewers", "Reviewers"]]} onChange={(v) => go("review", v === "study" ? "" : v)} /></div>}
      {d.loading ? <Skeleton rows={3} h={72} /> : active === "study" ? (
        <StudyHub study={study} update={update} load={load} scope={scope} goNotes={() => go("review", "notes")} openTask={(id) => go("track", "task", id)} />
      ) : active === "notes" ? (
        <Library tasks={d.tasks} materials={d.materials} subjects={d.subjects} onAddSubject={d.setSubject} removeMaterial={d.removeMaterial} relabelMaterial={d.relabelMaterial}
          onStudy={startStudy} onReviewer={(p) => { setBuilder({ ...p, id: uid() }); go("review", "reviewers"); }} openId={noteId} setOpenId={(id) => go("review", "notes", id || "")} />
      ) : <Reviewers parts={parts} go={go} onStudy={startStudy} builderPreset={builder} />}
    </div>
  );
}
