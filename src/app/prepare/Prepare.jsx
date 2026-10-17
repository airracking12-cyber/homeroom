// Prepare: a plan for the whole next grade or a school's entrance exam, spread over the weeks you have.
// The setup asks four things, one at a time. The assistant only maps out what the grade or exam covers; the weekly plan is
// worked out in lib/longterm.js, so it keeps working (and keeps re-planning) without the assistant.
// Logic is the v33 Long term tab's; every screen below is new.
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Plus, X, Check, ArrowRight, BookOpenCheck, Trash2 } from "lucide-react";
import { callClaude, callSearch, parseJSON } from "../../lib/ai.js";
import { Sound } from "../../lib/sound.js";
import { todayISO, addDays, fmtShort, parse } from "../../lib/dates.js";
import { subjColor } from "../../lib/constants.js";
import { createDebouncedSaver } from "../../lib/debounce.js";
import {
  LIMITS, GRADES, HEAVY_MINS, cleanText, addMonths, targetError, timeLeftLabel, fmtMins, planTitle, planShort, CURRICULUM_SYSTEM, curriculumPrompt, parseCurriculum,
  newPlan, normalizeStore, buildSchedule, freezeWeek, toggleDone, setConf, setCap, setTarget, removeTopic, removeSubject, addTopic, addSubject,
  notesFor, itemTitle, HOW, KIND_LABEL, LESSON_SYSTEM, lessonPrompt, parseLesson, saveLesson, setTopicRate, guessGrade,
} from "../../lib/longterm.js";
import { store } from "../../lib/services.js";
import { useData } from "../data.jsx";
import { useShell } from "../shell-context.js";
import { useToast, Button, Chip, Segmented, Field, Banner, Empty, Dots, Bar, Skeleton, cx } from "../ui.jsx";

const longDate = (iso) => parse(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const range = (a, b) => `${fmtShort(a)} to ${fmtShort(b)}`;

/* ───────────── saving: one private row per student, like the Review tab's study data ───────────── */

function useLongTerm(user, store, onSaved) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [attempt, setAttempt] = useState(0);
  const ref = useRef(null);
  const saver = useRef(null);
  const savedCb = useRef(onSaved);
  useEffect(() => { savedCb.current = onSaved; });

  useEffect(() => {
    let dead = false;
    store.get(`u:${user}:longterm`, true).then((v) => {
      if (dead) return;
      // undefined means the database could not be reached. Never treat that as "no plans", or a new plan would overwrite the saved ones.
      if (v === undefined) { setStatus("error"); return; }
      const d = normalizeStore(v);
      ref.current = d; setData(d); setStatus("ready");
    });
    return () => { dead = true; };
  }, [user, store, attempt]);

  useEffect(() => {
    const s = createDebouncedSaver((value) => store.set(`u:${user}:longterm`, value, true)
      .then((ok) => { if (savedCb.current) savedCb.current(ok, value); })
      .catch(() => { if (savedCb.current) savedCb.current(false, value); }), 700);
    saver.current = s;
    const onHide = () => { if (document.visibilityState === "hidden") s.flush(); };
    const onLeave = () => { s.flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onLeave);
      s.flush();
      saver.current = null;
    };
  }, [user, store]);

  const update = useCallback((fn) => {
    if (!ref.current) return;
    const next = fn(ref.current);
    if (next === ref.current) return;
    ref.current = next; setData(next);
    if (saver.current) saver.current.schedule(next);
  }, []);
  return { data, status, update, retry: () => { setStatus("loading"); setAttempt((n) => n + 1); } };
}

/* ───────────── small pieces ───────────── */

/* ── small pieces ── */
function Pills({ name, label, value, options, onChange, grades }) {
  return (
    <div className={grades ? "pills grades" : "pills"} role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <label className="pill" key={String(v)}>
          <input type="radio" name={name} checked={value === v} onChange={() => { Sound.play("tap"); onChange(v); }} />
          <span>{l}</span>
        </label>
      ))}
    </div>
  );
}

function AddLine({ label, placeholder, max, cta, onAdd }) {
  const [v, setV] = useState("");
  return (
    <form className="row-inline" onSubmit={(e) => { e.preventDefault(); if (!cleanText(v, max)) return; onAdd(v); setV(""); }}>
      <input className="input" aria-label={label} placeholder={placeholder} value={v} maxLength={max} onChange={(e) => setV(e.target.value)} autoComplete="off" name="pr-add" />
      <Button type="submit"><Plus size={15} aria-hidden="true" />{cta}</Button>
    </form>
  );
}

/* ── setup: four questions, one at a time ── */
let DRAFT = null; // answers survive a trip to another destination, not a refresh
const QUICK = [[1, "1 month"], [2, "2 months"], [3, "3 months"], [6, "6 months"], [9, "9 months"]];

function Setup({ user, today, defaultGrade, subjects, presetKind, canCancel, onCancel, onDone }) {
  const d0 = DRAFT && DRAFT.user === user ? DRAFT : null;
  const [step, setStep] = useState(d0 ? d0.step : presetKind ? 1 : 0);
  const [kind, setKind] = useState(d0 ? d0.kind : presetKind || null);
  const [grade, setGrade] = useState(d0 ? d0.grade : defaultGrade || null);
  const [school, setSchool] = useState(d0 ? d0.school : "");
  const [skip, setSkip] = useState(d0 ? d0.skip : false);
  const [target, setTargetDate] = useState(d0 ? d0.target : "");
  const [err, setErr] = useState("");
  const [phase, setPhase] = useState("ask"); // ask | building | fail
  const [failMsg, setFailMsg] = useState("");
  const run = useRef(0);
  const head = useRef(null);
  const form = useRef(null);
  const moved = useRef(false);

  useEffect(() => { DRAFT = { user, step, kind, grade, school, skip, target }; }, [user, step, kind, grade, school, skip, target]);
  useEffect(() => () => { run.current++; }, []);
  useEffect(() => { if (moved.current && head.current) head.current.focus(); moved.current = true; }, [step, phase]);

  const g = kind === "grade" && grade === 12 ? null : grade; // Grade 12 has no "next grade"; the answer is cleared, not guessed at
  const cleanSchool = skip ? "" : cleanText(school, LIMITS.school);
  const isExam = kind === "exam";

  const problem = () => {
    if (step === 0 && !kind) return "Pick one to continue.";
    if (step === 1 && !g) return "Pick your grade to continue.";
    if (step === 2 && !skip && cleanSchool.length < 2) return isExam ? "Type the school's name to continue." : "Type your school's name, or choose the national curriculum.";
    if (step === 3) return targetError(today, target);
    return "";
  };

  const build = async () => {
    const token = ++run.current;
    setErr(""); setPhase("building");
    try {
      // With a school named, the assistant looks it up on the web first (and the plan keeps the pages it read). Without one,
      // there is nothing to look up, so the national curriculum is used as it is.
      const looksUp = !!cleanSchool;
      let curriculum = null, sources = [];
      for (let i = 0; i < 2 && !curriculum; i++) {
        const msgs = [{ role: "user", content: curriculumPrompt({ kind, grade: g, school: cleanSchool, subjects, search: looksUp }) }];
        let raw;
        if (looksUp) { const r = await callSearch(CURRICULUM_SYSTEM, msgs); raw = r.text; sources = r.sources; }
        else raw = await callClaude(CURRICULUM_SYSTEM, msgs);
        curriculum = parseCurriculum(parseJSON(raw), subjects, { needsEvidence: looksUp && sources.length === 0 });
      }
      if (token !== run.current) return;
      if (!curriculum) throw new Error("no usable topics");
      DRAFT = null;
      Sound.play("done");
      onDone(newPlan({ kind, grade: g, school: cleanSchool, target, today, curriculum, sources, searched: looksUp }));
    } catch (e) {
      if (token !== run.current) return;
      console.warn("[Homeroom] long term map failed:", e);
      setFailMsg(e && e.limited ? e.message : "");
      setPhase("fail");
    }
  };

  const manual = () => { DRAFT = null; onDone(newPlan({ kind, grade: g, school: cleanSchool, target, today, curriculum: null })); };

  const submit = (e) => {
    e.preventDefault();
    const bad = problem();
    if (bad) {
      setErr(bad); Sound.play("err");
      const el = form.current && form.current.querySelector("input");
      if (el) el.focus();
      return;
    }
    setErr("");
    if (step < 3) { Sound.play("tap"); setStep(step + 1); } else build();
  };
  const back = () => { setErr(""); if (step > 0) { Sound.play("tap"); setStep(step - 1); } else if (canCancel) { DRAFT = null; onCancel(); } };

  if (phase === "building") {
    return (
      <div className="card card-large wiz stack" role="status">
        <h2 className="wiz-q" tabIndex={-1} ref={head}>Building your plan<Dots /></h2>
        <p className="muted">{cleanSchool ? `Looking up ${cleanSchool} and fitting what ${isExam ? "it tests" : "Grade " + (g + 1) + " covers"} into ${timeLeftLabel(today, target)}. This can take up to 30 seconds.` : `Reading what Grade ${g + 1} covers and fitting it into ${timeLeftLabel(today, target)}. This takes about 20 seconds.`} Stay on this screen while it works.</p>
        <div className="bar indeterminate" aria-hidden="true"><i /></div>
      </div>
    );
  }
  if (phase === "fail") {
    return (
      <div className="card card-large wiz stack">
        <h2 className="wiz-q" tabIndex={-1} ref={head}>We couldn&rsquo;t map the topics</h2>
        <p className="muted">{failMsg || "This is usually a connection problem or a busy moment. Try again, or build the topic list yourself."}</p>
        <div className="form-actions"><Button variant="primary" size="lg" onClick={build}>Try again</Button><Button size="lg" onClick={manual}>Build it myself</Button><Button variant="ghost" size="lg" onClick={() => { setPhase("ask"); setStep(3); }}>Change my answers</Button></div>
      </div>
    );
  }

  const questions = [
    { q: "What do you want to prepare for?", help: "Pick one. You can add another plan later." },
    { q: "Which grade are you in now?", help: !g ? "Pick your current grade." : isExam ? `You'll be applying after Grade ${g}.` : `We'll plan for Grade ${g + 1}.` },
    isExam
      ? { q: "Which school are you applying to?", help: "Type the school's name. We'll plan around what its entrance exam usually covers." }
      : { q: "Which school are you from?", help: "Type your school's name. We'll match the curriculum it follows." },
    { q: "How long until you need all of this?", help: isExam ? "Pick how long until the exam, or the date you need to be ready." : "Pick how far away you need to be ready. Your plan fits everything in before then." },
  ][step];
  const tErr = target ? targetError(today, target) : "";

  return (
    <form className="card card-large wiz stack" onSubmit={submit} ref={form} noValidate>
      <div>
        <p className="eyebrow">Step {step + 1} of 4</p>
        <Bar value={(step + 1) * 25} label="Setup progress" />
      </div>
      <div><h2 className="wiz-q" id="pr-q" tabIndex={-1} ref={head}>{questions.q}</h2><p className="muted" style={{ marginTop: 6 }}>{questions.help}</p></div>

      {step === 0 && (
        <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-labelledby="pr-q">
          {[["grade", "The next grade level", "Everything you'll study in the next grade, subject by subject."], ["exam", "A school's entrance exam", "What a school you're applying to usually tests."]].map(([v, t, d]) => (
            <button type="button" key={v} role="radio" aria-checked={kind === v} className="tech" onClick={() => { Sound.play("tap"); setKind(v); setErr(""); }}>
              <span className="grow"><span className="title">{t}</span><span className="small muted">{d}</span></span>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <Pills grades name="pr-grade" label="Your grade" value={g} onChange={(v) => { setGrade(v); setErr(""); }} options={GRADES.filter((n) => isExam || n < 12).map((n) => [n, String(n)])} />
      )}

      {step === 2 && (
        <div className="stack" style={{ gap: 12 }}>
          <input className="input" name="school" aria-labelledby="pr-q" value={school} maxLength={LIMITS.school} autoComplete="off" disabled={skip} placeholder="Rizal National High School" onChange={(e) => { setSchool(e.target.value); setErr(""); }} />
          {!isExam && <div><Button size="sm" aria-pressed={skip} onClick={() => { Sound.play("tap"); const next = !skip; setSkip(next); if (next) setErr(""); }}>{skip ? "Type a school instead" : "I don\u2019t know. Use the national curriculum."}</Button></div>}
        </div>
      )}

      {step === 3 && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="chips" role="group" aria-label="How long from now">
            {QUICK.map(([n, l]) => <Chip key={n} on={target === addMonths(today, n)} onClick={() => { Sound.play("tap"); setTargetDate(addMonths(today, n)); setErr(""); }}>{l}</Chip>)}
          </div>
          <Field label="Or pick the exact date" htmlFor="pr-date">
            <input id="pr-date" className="input" type="date" name="ready-by" value={target} min={addDays(today, LIMITS.minDays)} max={addDays(today, LIMITS.maxDays)} autoComplete="off" onChange={(e) => { setTargetDate(e.target.value); setErr(""); }} />
          </Field>
          <p className={tErr ? "error" : "muted"} aria-live="polite">{target ? (tErr || `That\u2019s ${timeLeftLabel(today, target)} from now, on ${longDate(target)}.`) : ""}</p>
        </div>
      )}

      {err && !(step === 3 && tErr) && <p className="error" role="alert">{err}</p>}

      <div className="form-actions wiz-foot">
        <Button variant="primary" size="lg" type="submit">{step === 3 ? "Build my plan" : "Next"}{step < 3 && <ArrowRight size={16} aria-hidden="true" />}</Button>
        {(step > 0 || canCancel) && <Button variant="ghost" size="lg" onClick={back}>{step === 0 ? "Cancel" : "Back"}</Button>}
      </div>
    </form>
  );
}

/* ── the plan ── */
function LessonBody({ plan, item, busy, onRetry, onRate }) {
  const lesson = plan.lessons && plan.lessons[item.topicId];
  const topic = (plan.subjects.find((x) => x.id === item.subjectId) || { topics: [] }).topics.find((t) => t.id === item.topicId);
  if (busy === "loading") {
    return (
      <div className="lesson stack" role="status">
        <p className="muted">Writing your lesson. This takes about 15 seconds<Dots /></p>
        <div className="bar indeterminate" aria-hidden="true"><i /></div>
      </div>
    );
  }
  if (!lesson) {
    const msg = typeof busy === "string" && busy.startsWith("fail:") ? busy.slice(5) : "";
    return (
      <div className="lesson stack">
        <Banner tone="warn" action={<Button size="sm" onClick={onRetry}>Try again</Button>}>{msg || "The lesson didn't load. Check your connection, then try again."}</Banner>
      </div>
    );
  }
  return (
    <div className="lesson stack">
      <section><h3>In short</h3><p>{lesson.explain}</p></section>
      <section><h3>Key points</h3><ul className="points">{lesson.points.map((x, i) => <li key={i}>{x}</li>)}</ul></section>
      <section className="stack" style={{ gap: 8 }}>
        <h3>Try these</h3>
        {lesson.practice.map((x, i) => (
          <details className="qa" key={i}><summary>{x.q}</summary><p>{x.a}</p></details>
        ))}
      </section>
      <section className="stack" style={{ gap: 8 }}>
        <h3>How did it go?</h3>
        <Pills name={`pr-rate-${item.topicId}`} label="How did it go?" value={(topic && topic.r) || null} onChange={(v) => onRate(item, v)} options={[[1, "Not yet"], [2, "Mostly"], [3, "Got it"]]} />
      </section>
      <p className="caption">Written by the assistant. Check it against your notes or textbook.</p>
    </div>
  );
}

function ThisWeek({ plan, sched, materials, onToggle, onStudy, lesson }) {
  const wk = sched.thisWeek;
  const nextWk = sched.weeks[1];
  const items = wk ? wk.items : [];
  const doneN = items.filter((i) => i.done).length;
  const leftMins = items.filter((i) => !i.done).reduce((a, i) => a + i.mins, 0);
  const kinds = [...new Set(items.map((i) => i.kind))];
  const allDone = items.length > 0 && doneN === items.length;
  return (
    <section aria-labelledby="pr-now-h" className="stack">
      <div className="between wrap">
        <div><h2 id="pr-now-h">This week</h2>{wk && <p className="muted small">{range(wk.start, wk.end)}</p>}</div>
        {items.length > 0 && <p className="small" aria-live="polite"><b>{doneN} of {items.length}</b> done · {allDone ? "all done" : `${fmtMins(leftMins)} left`}</p>}
      </div>

      {items.length > 0 && (
        <div className="card card-flat divided">
          {items.map((it) => {
            const ns = it.kind === "practice" ? [] : notesFor(materials, it.subject, it.topic);
            const open = lesson.openId === it.id;
            const canTeach = it.kind !== "practice" && (!it.done || open);
            return (
              <div className={cx("pr-item", it.done && "task-done")} key={it.id}>
                <div className="task">
                  <button type="button" className="check" role="checkbox" aria-checked={it.done} aria-label={`${it.done ? "Mark as not done" : "Mark as done"}: ${itemTitle(it, plan)}`} onClick={() => onToggle(it.id)}>
                    <span>{it.done && <Check size={14} strokeWidth={3.5} aria-hidden="true" />}</span>
                  </button>
                  <div className="task-main" style={{ cursor: "default" }}>
                    <div className="task-title">{itemTitle(it, plan)}</div>
                    <div className="meta"><span><i className="dot" style={{ background: subjColor(it.subject) }} />{it.subject}</span><span>{fmtMins(it.mins)}</span></div>
                  </div>
                </div>
                {(canTeach || (ns.length > 0 && !it.done)) && (
                  <div className="pr-actions">
                    {canTeach && <Button size="sm" variant={open ? "secondary" : "primary"} aria-expanded={open} aria-controls={`pr-ls-${it.id}`} onClick={() => lesson.toggle(it)}><BookOpenCheck size={15} aria-hidden="true" />{open ? "Hide lesson" : "Teach me this"}</Button>}
                    {ns.length > 0 && !it.done && <Button size="sm" onClick={() => onStudy({ subjects: [it.subject], topics: [ns[0].topic], period: "final" })}>Study with class notes</Button>}
                  </div>
                )}
                {open && <div className="pr-lesson" id={`pr-ls-${it.id}`}><LessonBody plan={plan} item={it} busy={lesson.busy[it.topicId]} onRetry={() => lesson.retry(it)} onRate={lesson.rate} /></div>}
              </div>
            );
          })}
        </div>
      )}

      {allDone && <Banner tone="ok" icon={Check}><b>That&rsquo;s everything for this week.</b><span>{nextWk ? `Your next session opens ${fmtShort(nextWk.start)}.` : `That was the last week before ${fmtShort(plan.target)}.`}</span></Banner>}
      {items.length === 0 && (
        <Empty icon={Check} title={sched.stats.items === 0 ? "Nothing is planned yet" : sched.stats.finished ? "Everything is covered" : "Nothing is due this week"}>
          {sched.stats.items === 0 ? "Add subjects and topics under What this covers, and your weeks fill in." : sched.stats.finished ? `Look over old topics now and then until ${fmtShort(plan.target)}.` : "Your plan is spaced out, so use the time to rest or look over past topics."}
        </Empty>
      )}

      {kinds.length > 0 && (
        <details className="more">
          <summary>How to do each one</summary>
          <dl className="how">
            {kinds.map((k) => <div key={k}><dt>{k === "practice" ? (plan.kind === "exam" ? "Timed practice" : "Check-up") : KIND_LABEL[k]}</dt><dd>{k === "practice" ? HOW.practice(plan) : HOW[k]}</dd></div>)}
          </dl>
        </details>
      )}
    </section>
  );
}

function Weeks({ plan, sched }) {
  const [all, setAll] = useState(false);
  const later = sched.weeks.slice(1);
  if (!later.length) return null;
  const shown = all ? later : later.slice(0, 4);
  return (
    <section aria-labelledby="pr-up-h" className="stack" style={{ gap: 8 }}>
      <div><h2 id="pr-up-h">Weeks ahead</h2><p className="muted small">Each week adjusts to what you finish.</p></div>
      <div className="card card-flat divided">
        {shown.map((w) => {
          const subs = [...new Set(w.items.map((i) => i.subject))];
          return (
            <details className="week" key={w.start}>
              <summary>
                <span className="grow"><b>Week {sched.stats.weekNo + w.index}</b> <span className="muted small">{range(w.start, w.end)}</span><span className="small muted week-subs">{subs.length ? subs.join(", ") : "Free week"}</span></span>
                <span className="small muted">{w.items.length ? fmtMins(w.mins) : ""}</span>
              </summary>
              {w.items.length > 0 && <ul className="plain wk-items">{w.items.map((it) => <li key={it.id}><span><i className="dot" style={{ background: subjColor(it.subject) }} />{itemTitle(it, plan)}</span><span className="muted small">{fmtMins(it.mins)}</span></li>)}</ul>}
            </details>
          );
        })}
      </div>
      {later.length > 4 && <div><Button size="sm" onClick={() => { Sound.play("tap"); setAll(!all); }}>{all ? "Show fewer weeks" : `Show all ${later.length} weeks`}</Button></div>}
    </section>
  );
}

const CAPS = [[null, "Auto"], [60, "1 hr"], [120, "2 hr"], [180, "3 hr"], [300, "5 hr"]];
const CONF_OPTS = [[1, "Shaky"], [2, "Okay"], [3, "Strong"]];

function PlanView({ plan, sched, today, materials, edit, onToggle, onStudy, lesson, onNew, canNew, onDelete }) {
  const [coverOpen, setCoverOpen] = useState(plan.subjects.length === 0);
  const [dateErr, setDateErr] = useState("");
  const st = sched.stats;
  const unsure = plan.confidence === "low" || plan.confidence === "medium";
  const cap = plan.cap;
  const capHint = cap == null
    ? `Auto fits everything before ${fmtShort(plan.target)}: about ${fmtMins(st.needPerWeek)} a week.`
    : st.covered < 100
      ? `At ${fmtMins(cap)} a week you'll cover ${st.covered}% by ${fmtShort(plan.target)}. Choose a longer time, or Auto, to cover everything.`
      : `${fmtMins(cap)} a week covers everything. Auto would use about ${fmtMins(st.needPerWeek)}.`;

  return (
    <div className="stack-lg">
      {plan.about && (
        <Banner tone={unsure ? "warn" : undefined} action={unsure && <Button size="sm" onClick={() => setCoverOpen(true)}>Review the topics</Button>}>
          {unsure && <b>Check this list. </b>}<span>{plan.about}{plan.confidence === "low" && " This school's exact curriculum isn't confirmed, so check the topics with your teacher or the school."}</span>
        </Banner>
      )}
      {plan.sources && plan.sources.length > 0 && (
        <p className="small muted">Sources:{" "}
          {plan.sources.map((x, i) => <span key={x.uri}>{i > 0 && ", "}<a href={x.uri} target="_blank" rel="noopener noreferrer">{x.title}<span className="sr"> (opens in a new tab)</span></a></span>)}
        </p>
      )}
      {plan.searched && (!plan.sources || plan.sources.length === 0) && <p className="small muted">No online sources were found for this school, so check the topics with the school.</p>}

      <section className="card pr-run" aria-label="Progress through your plan">
        <div className="runbar" role="img" aria-label={sched.ended ? "The date has passed" : `Week ${st.weekNo} of ${st.totalWeeks}`}>
          {Array.from({ length: st.totalWeeks }, (_, i) => <i key={i} className={sched.ended || i < st.weekNo - 1 ? "past" : i === st.weekNo - 1 ? "now" : ""} />)}
        </div>
        <div className="between small"><span><b>{sched.ended ? "The date has passed" : `Week ${st.weekNo} of ${st.totalWeeks}`}</b></span><span className="muted">Ready by {fmtShort(plan.target)}</span></div>
        {!sched.ended && !st.finished && st.needPerWeek > 0 && <p className="muted small">About {fmtMins(st.needPerWeek)} a week keeps you on track.{st.needPerWeek > HEAVY_MINS && " That's a lot. A later date, or fewer topics, would make it lighter."}</p>}
      </section>

      {sched.ended ? <Banner tone="warn">The date you picked has passed. Change it under Make it fit you to keep this plan going, or start a new plan.</Banner>
        : <ThisWeek plan={plan} sched={sched} materials={materials} onToggle={onToggle} onStudy={onStudy} lesson={lesson} />}

      {!sched.ended && <Weeks plan={plan} sched={sched} />}

      <section aria-labelledby="pr-fit-h" className="stack" style={{ gap: 12 }}>
        <h2 id="pr-fit-h">Your plan</h2>
        <details className="more">
          <summary>Make it fit you</summary>
          <div className="stack" style={{ marginTop: 12, gap: 20 }}>
            {plan.subjects.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                <div><p className="label">How ready do you feel?</p><p className="help">Shaky subjects come first and get more time.</p></div>
                {plan.subjects.map((s) => (
                  <div className="conf-row" key={s.id}>
                    <span className="conf-name"><i className="dot" style={{ background: subjColor(s.name) }} />{s.name}</span>
                    <Segmented label={`How ready you feel in ${s.name}`} value={s.conf || 2} options={CONF_OPTS} onChange={(v) => edit((p) => setConf(p, s.id, v))} />
                  </div>
                ))}
              </div>
            )}
            <div className="stack" style={{ gap: 8 }}>
              <p className="label">Time each week</p>
              <Segmented label="Time each week" value={cap} options={CAPS} onChange={(v) => edit((p) => setCap(p, v))} />
              <p className={cap != null && st.covered < 100 ? "error" : "help"} aria-live="polite">{capHint}</p>
            </div>
            <Field label="Date you need to be ready" htmlFor="pr-ready" help={dateErr ? undefined : `${timeLeftLabel(today, plan.target)} from now.`} error={dateErr || undefined}>
              <input id="pr-ready" className="input" type="date" name="ready-by" value={plan.target} min={addDays(today, LIMITS.minDays)} max={addDays(today, LIMITS.maxDays)} autoComplete="off"
                onChange={(e) => { const v = e.target.value; const bad = targetError(today, v); setDateErr(bad); if (!bad) edit((p) => setTarget(p, v)); }} />
            </Field>
          </div>
        </details>

        <details className="more" open={coverOpen} onToggle={(e) => setCoverOpen(e.currentTarget.open)}>
          <summary>What this covers</summary>
          <div className="stack" style={{ marginTop: 12 }}>
            <p className="muted small">Remove what you don&rsquo;t need and add what&rsquo;s missing. Your weeks update.</p>
            {plan.subjects.map((s) => (
              <div className="card card-ink stack" style={{ gap: 8 }} key={s.id}>
                <div className="between"><span className="conf-name"><i className="dot" style={{ background: subjColor(s.name) }} />{s.name}</span>
                  <Button variant="ghost" size="sm" icon aria-label={`Remove subject ${s.name}`} onClick={() => { Sound.play("rip"); onDelete({ type: "subject", s }); }}><X size={18} /></Button></div>
                <ul className="plain divided topics">
                  {s.topics.map((t) => (
                    <li key={t.id} className="between"><span>{t.t}{t.p === "f" && <em className="muted small"> from Grade {plan.grade}</em>}</span>
                      <Button variant="ghost" size="sm" icon aria-label={`Remove ${t.t}`} onClick={() => { Sound.play("rip"); edit((p) => removeTopic(p, s.id, t.id)); }}><X size={18} /></Button></li>
                  ))}
                </ul>
                {s.topics.length < LIMITS.topics && <AddLine label={`Add a topic to ${s.name}`} placeholder="Add a topic" max={LIMITS.topic} cta="Add" onAdd={(v) => { Sound.play("add"); edit((p) => addTopic(p, s.id, v)); }} />}
              </div>
            ))}
            {plan.subjects.length < LIMITS.subjects && <AddLine label="Add a subject" placeholder="Add a subject" max={LIMITS.subject} cta="Add subject" onAdd={(v) => { Sound.play("add"); edit((p) => addSubject(p, v)); }} />}
          </div>
        </details>

        <div className="cluster">
          {canNew && <Button onClick={onNew}><Plus size={16} aria-hidden="true" />New plan</Button>}
          <Button variant="danger" onClick={() => onDelete({ type: "plan" })}><Trash2 size={15} aria-hidden="true" />Delete this plan</Button>
        </div>
      </section>
    </div>
  );
}

/* ── the destination ── */
export default function Prepare() {
  const d = useData();
  const toast = useToast();
  const { route, go, startStudy } = useShell();
  const { user, subjects, materials, myClass } = d;
  const defaultGrade = guessGrade(myClass?.year, myClass?.label);
  const onStudy = startStudy;
  const onSaved = (ok, value) => d.reportSave("plan", `u:${user}:longterm`, ok, value);
  const { data, status, update, retry } = useLongTerm(user, store, onSaved);
  const presetKind = route.parts[0] === "new" && ["grade", "exam"].includes(route.parts[1]) ? route.parts[1] : null;
  const [adding, setAdding] = useState(route.parts[0] === "new");
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const f = () => setToday(todayISO());
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);

  const plan = data && data.plans.find((p) => p.id === data.active);
  const sched = useMemo(() => (plan ? buildSchedule(plan, today) : null), [plan, today]);

  // Pin this week's session the first time it is seen, so ticking one thing off never moves the others.
  useEffect(() => {
    if (!plan) return;
    const pinned = freezeWeek(plan, today);
    if (pinned !== plan) update((d) => ({ ...d, plans: d.plans.map((p) => (p.id === plan.id ? pinned : p)) }));
  }, [plan, today, update]);

  const edit = useCallback((fn) => update((d) => ({ ...d, plans: d.plans.map((p) => (p.id === d.active ? fn(p) : p)) })), [update]);

  const addPlan = (p) => { update((d) => ({ ...d, plans: [...d.plans, p].slice(-LIMITS.plans), active: p.id })); setAdding(false); };

  const toggle = (id) => {
    const wasDone = plan.done[id];
    edit((p) => toggleDone(p, id, today));
    if (wasDone) { Sound.play("undo"); return; }
    const week = sched.thisWeek ? sched.thisWeek.items : [];
    const last = week.length > 0 && week.filter((i) => !i.done).every((i) => i.id === id);
    Sound.play(last ? "done" : "tap");
  };

  const remove = (what) => {
    if (what.type === "plan") {
      const before = data;
      update((d) => { const plans = d.plans.filter((p) => p.id !== d.active); return { ...d, plans, active: plans[0] ? plans[0].id : null }; });
      toast(`Deleted ${planTitle(plan)}.`, { undo: () => update(() => before), ms: 7000 });
      return;
    }
    const prev = plan;
    edit((p) => removeSubject(p, what.s.id));
    const n = what.s.topics.length;
    toast(`Removed ${what.s.name}${n ? ` and its ${n} ${n === 1 ? "topic" : "topics"}` : ""}.`, { undo: () => update((d) => ({ ...d, plans: d.plans.map((p) => (p.id === prev.id ? prev : p)) })), ms: 7000 });
  };

  const [openLesson, setOpenLesson] = useState(null);
  const [lessonBusy, setLessonBusy] = useState({});
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const fetchLesson = async (it) => {
    const planId = plan.id, topicId = it.topicId, req = { plan, subject: it.subject, topic: it.topic };
    setLessonBusy((b) => ({ ...b, [topicId]: "loading" }));
    try {
      let made = null;
      for (let i = 0; i < 2 && !made; i++) {
        const raw = await callClaude(LESSON_SYSTEM, [{ role: "user", content: lessonPrompt(req) }]);
        made = parseLesson(parseJSON(raw));
      }
      if (!made) throw new Error("no usable lesson");
      update((d) => ({ ...d, plans: d.plans.map((p) => (p.id === planId ? saveLesson(p, topicId, made, Date.now()) : p)) }));
      if (alive.current) { Sound.play("pop"); setLessonBusy((b) => { const n = { ...b }; delete n[topicId]; return n; }); }
    } catch (e) {
      console.warn("[Homeroom] lesson failed:", e);
      if (alive.current) setLessonBusy((b) => ({ ...b, [topicId]: `fail:${e && e.limited ? e.message : ""}` }));
    }
  };
  const lesson = {
    openId: openLesson, busy: lessonBusy,
    toggle: (it) => {
      Sound.play("tap");
      if (openLesson === it.id) { setOpenLesson(null); return; }
      setOpenLesson(it.id);
      if (!(plan.lessons && plan.lessons[it.topicId]) && lessonBusy[it.topicId] !== "loading") fetchLesson(it);
    },
    retry: (it) => fetchLesson(it),
    rate: (it, r) => { Sound.play("tap"); edit((p) => setTopicRate(p, it.subjectId, it.topicId, r)); },
  };

  const setup = !plan || adding;
  const title = setup ? "Prepare" : planTitle(plan);
  const lede = setup
    ? "Get ready for next year or for a new school's exam, a little each week."
    : sched.ended ? "The date has passed."
      : sched.stats.finished ? "Everything is covered. Keep recalling until the date."
        : `${timeLeftLabel(today, plan.target)} to go.`;

  return (
    <div className={cx("page", setup && "page-narrow")}>
      <header className="page-head"><div><h1>{title}</h1><p className="lede">{lede}</p></div></header>

      {status === "loading" && <Skeleton rows={3} h={72} />}
      {status === "error" && <Banner tone="bad" action={<Button size="sm" onClick={retry}>Try again</Button>}>We couldn&rsquo;t load your plans. Check your connection, then try again. Your saved plans are safe.</Banner>}

      {status === "ready" && setup && (
        <Setup user={user} today={today} defaultGrade={defaultGrade} subjects={subjects} presetKind={presetKind} canCancel={!!plan} onCancel={() => setAdding(false)} onDone={addPlan} />
      )}

      {status === "ready" && !setup && (
        <div className="stack-lg">
          {data.plans.length > 1 && (
            <div className="chips" role="group" aria-label="Your plans">
              {data.plans.map((p) => <Chip key={p.id} on={p.id === data.active} onClick={() => { Sound.play("tap"); update((x) => ({ ...x, active: p.id })); }}>{planShort(p)}</Chip>)}
            </div>
          )}
          <PlanView key={plan.id} plan={plan} sched={sched} today={today} materials={materials} edit={edit} onToggle={toggle} onStudy={onStudy} lesson={lesson}
            onNew={() => { Sound.play("tap"); setAdding(true); }} canNew={data.plans.length < LIMITS.plans} onDelete={remove} />
        </div>
      )}
    </div>
  );
}
