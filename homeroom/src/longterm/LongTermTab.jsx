// Long term review: a plan for the whole next grade or for a new school's entrance exam, spread over the weeks you have.
// The setup asks four things, one at a time. The assistant only maps out what the grade or exam covers; the weekly plan is
// worked out in lib/longterm.js, so it keeps working (and keeps re-planning) without the assistant.
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { callClaude, callSearch, parseJSON } from "../lib/ai.js";
import { Sound } from "../lib/sound.js";
import { todayISO, addDays, fmtShort, parse } from "../lib/dates.js";
import { subjColor } from "../lib/constants.js";
import { createDebouncedSaver } from "../lib/debounce.js";
import {
  LIMITS, GRADES, HEAVY_MINS, cleanText, addMonths, targetError, timeLeftLabel, fmtMins, planTitle, planShort, CURRICULUM_SYSTEM, curriculumPrompt, parseCurriculum,
  newPlan, normalizeStore, buildSchedule, freezeWeek, toggleDone, setConf, setCap, setTarget, removeTopic, removeSubject, addTopic, addSubject,
  notesFor, itemTitle, HOW, KIND_LABEL, LESSON_SYSTEM, lessonPrompt, parseLesson, saveLesson, setTopicRate,
} from "../lib/longterm.js";

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
      .then((ok) => { if (savedCb.current) savedCb.current(ok); })
      .catch(() => { if (savedCb.current) savedCb.current(false); }), 700);
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

function Pills({ name, label, value, options, onChange, grades }) {
  return (
    <div className={grades ? "lt-grades" : "lt-pillGroup"} role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <label className="lt-pill" key={String(v)}>
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
    <form className="lt-add" onSubmit={(e) => { e.preventDefault(); if (!cleanText(v, max)) return; onAdd(v); setV(""); }}>
      <input className="input" aria-label={label} placeholder={placeholder} value={v} maxLength={max} onChange={(e) => setV(e.target.value)} autoComplete="off" name="lt-add" />
      <button className="btn ghost small" type="submit">{cta}</button>
    </form>
  );
}

/* ───────────── setup: four questions, one at a time ───────────── */

let DRAFT = null; // answers survive a trip to another tab, not a refresh

const QUICK = [[1, "1 month"], [2, "2 months"], [3, "3 months"], [6, "6 months"], [9, "9 months"]];

function Setup({ user, today, defaultGrade, subjects, canCancel, onCancel, onDone }) {
  const d0 = DRAFT && DRAFT.user === user ? DRAFT : null;
  const [step, setStep] = useState(d0 ? d0.step : 0);
  const [kind, setKind] = useState(d0 ? d0.kind : null);
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
      <div className="lt-wait" role="status">
        <h2 className="lt-q" tabIndex={-1} ref={head}>Building your plan…</h2>
        <p>{cleanSchool ? `Looking up ${cleanSchool} and fitting what ${isExam ? "it tests" : "Grade " + (g + 1) + " covers"} into ${timeLeftLabel(today, target)}. This can take up to 30 seconds.` : `Reading what Grade ${g + 1} covers and fitting it into ${timeLeftLabel(today, target)}. This takes about 20 seconds.`} Stay on this tab while it works.</p>
        <div className="lt-bar" aria-hidden="true" />
      </div>
    );
  }
  if (phase === "fail") {
    return (
      <div className="lt-fail">
        <h2 className="lt-q" tabIndex={-1} ref={head}>The assistant couldn't map the topics</h2>
        <p>{failMsg || "This is usually a connection problem or a busy moment. Try again, or build the topic list yourself."}</p>
        <div className="lt-foot" style={{ marginTop: 0 }}>
          <button className="btn accent" onClick={build}>Try again</button>
          <button className="btn ghost" onClick={manual}>Build it myself</button>
          <button className="lt-skip" onClick={() => { setPhase("ask"); setStep(3); }}>Change my answers</button>
        </div>
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
    <form className="lt-wiz" onSubmit={submit} ref={form} noValidate>
      <div className="lt-prog" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1}><i style={{ "--p": `${(step + 1) * 25}%` }} /></div>
      <h2 className="lt-q" id="lt-q" tabIndex={-1} ref={head}>{questions.q}</h2>
      <p className="lt-help">{questions.help}</p>

      {step === 0 && (
        <div className="lt-choices" role="radiogroup" aria-labelledby="lt-q">
          {[["grade", "The next grade level", "Everything you'll study in the next grade, subject by subject."], ["exam", "A school's entrance exam", "What a school you're applying to usually tests."]].map(([v, t, d]) => (
            <label className="lt-choice" key={v}>
              <input type="radio" name="lt-kind" checked={kind === v} onChange={() => { Sound.play("tap"); setKind(v); setErr(""); }} />
              <span><b>{t}</b><small>{d}</small></span>
            </label>
          ))}
        </div>
      )}

      {step === 1 && (
        <Pills grades name="lt-grade" label="Your grade" value={g} onChange={(v) => { setGrade(v); setErr(""); }}
          options={GRADES.filter((n) => isExam || n < 12).map((n) => [n, String(n)])} />
      )}

      {step === 2 && (
        <>
          <input className="input" name="school" aria-labelledby="lt-q" value={school} maxLength={LIMITS.school} autoComplete="off" disabled={skip}
            placeholder="e.g. Rizal National High School…" onChange={(e) => { setSchool(e.target.value); setErr(""); }} />
          {!isExam && (
            <button type="button" className="lt-skip" onClick={() => { Sound.play("tap"); const next = !skip; setSkip(next); if (next) setErr(""); }} aria-pressed={skip}>
              {skip ? "Type a school instead" : "I don't know. Use the national curriculum."}
            </button>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <div className="lt-quick" role="group" aria-label="How long from now">
            {QUICK.map(([n, l]) => (
              <button type="button" key={n} className="chip" aria-pressed={target === addMonths(today, n)} onClick={() => { Sound.play("tap"); setTargetDate(addMonths(today, n)); setErr(""); }}>{l}</button>
            ))}
          </div>
          <label className="lt-field">
            <span>Or pick the exact date</span>
            <input className="input" type="date" name="ready-by" value={target} min={addDays(today, LIMITS.minDays)} max={addDays(today, LIMITS.maxDays)} autoComplete="off"
              onChange={(e) => { setTargetDate(e.target.value); setErr(""); }} />
          </label>
          <p className={tErr ? "lt-sum bad" : "lt-sum"} aria-live="polite">
            {target ? (tErr || `That's ${timeLeftLabel(today, target)} from now, on ${longDate(target)}.`) : ""}
          </p>
        </>
      )}

      <p className="lt-sum bad" role="alert" style={{ minHeight: 0, marginTop: err ? 14 : 0 }}>{err && !(step === 3 && tErr) ? err : ""}</p>

      <div className="lt-foot">
        {(step > 0 || canCancel) && <button type="button" className="btn ghost" onClick={back}>{step === 0 ? "Cancel" : "Back"}</button>}
        <button type="submit" className="btn accent">{step === 3 ? "Build my plan" : "Next"}</button>
        <span className="lt-count">{step + 1} of 4</span>
      </div>
    </form>
  );
}

/* ───────────── the plan ───────────── */

function LessonBody({ plan, item, busy, onRetry, onRate }) {
  const lesson = plan.lessons && plan.lessons[item.topicId];
  const topic = (plan.subjects.find((x) => x.id === item.subjectId) || { topics: [] }).topics.find((t) => t.id === item.topicId);
  if (busy === "loading") {
    return (
      <div className="lt-ls" role="status">
        <p>Writing your lesson… this takes about 15 seconds.</p>
        <div className="lt-bar" aria-hidden="true" />
      </div>
    );
  }
  if (!lesson) {
    const msg = typeof busy === "string" && busy.startsWith("fail:") ? busy.slice(5) : "";
    return (
      <div className="lt-ls">
        <p>{msg || "The lesson didn't load. Check your connection, then try again."}</p>
        <button type="button" className="lt-lsBtn" onClick={onRetry}>Try again</button>
      </div>
    );
  }
  return (
    <div className="lt-ls">
      <h3>In short</h3>
      <p>{lesson.explain}</p>
      <h3>Key points</h3>
      <ul>{lesson.points.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <h3>Try these</h3>
      {lesson.practice.map((x, i) => (
        <details className="lt-qa" key={i}>
          <summary>{x.q}</summary>
          <p>{x.a}</p>
        </details>
      ))}
      <h3>How did it go?</h3>
      <Pills name={`lt-rate-${item.topicId}`} label="How did it go?" value={(topic && topic.r) || null} onChange={(v) => onRate(item, v)}
        options={[[1, "Not yet"], [2, "Mostly"], [3, "Got it"]]} />
      <p className="lt-lsNote">Written by the assistant. Check it against your notes or textbook.</p>
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
    <section className="lt-now" aria-labelledby="lt-now-h">
      <div className="lt-nowHead">
        <h2 className="lt-h2" id="lt-now-h">This week's session</h2>
        {wk && <p className="lt-nowSub">{range(wk.start, wk.end)}</p>}
      </div>

      {items.length > 0 && (
        <ul className="lt-items">
          {items.map((it) => {
            const notes = it.kind === "practice" ? [] : notesFor(materials, it.subject, it.topic);
            const open = lesson.openId === it.id;
            const canTeach = it.kind !== "practice" && (!it.done || open);
            return (
              <li className={it.done ? "lt-it done" : "lt-it"} key={it.id}>
                <label className="lt-itMain">
                  <input type="checkbox" checked={it.done} onChange={() => onToggle(it.id)} />
                  <span className="lt-itText">
                    <b>{itemTitle(it, plan)}</b>
                    <small><i className="lt-dot" style={{ background: subjColor(it.subject) }} aria-hidden="true" />{it.subject}</small>
                  </span>
                </label>
                <span className="lt-itMins">{fmtMins(it.mins)}</span>
                {(canTeach || (notes.length > 0 && !it.done)) && (
                  <div className="lt-itActions">
                    {canTeach && (
                      <button type="button" aria-expanded={open} aria-controls={`lt-ls-${it.id}`} onClick={() => lesson.toggle(it)}>
                        {open ? "Hide lesson" : "Teach me this"}
                      </button>
                    )}
                    {notes.length > 0 && !it.done && (
                      <button type="button" onClick={() => onStudy({ subjects: [it.subject], topics: [notes[0].topic], period: "final" })}>
                        Study with your class's notes
                      </button>
                    )}
                  </div>
                )}
                {open && (
                  <div className="lt-itLesson" id={`lt-ls-${it.id}`}>
                    <LessonBody plan={plan} item={it} busy={lesson.busy[it.topicId]} onRetry={() => lesson.retry(it)} onRate={lesson.rate} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 && (
        <div className="lt-nowFoot">
          <span aria-live="polite"><b>{doneN} of {items.length}</b> done</span>
          <span>{allDone ? "All done for this week" : `${fmtMins(leftMins)} left`}</span>
        </div>
      )}

      {allDone && (
        <p className="lt-rest">
          That's everything for this week.
          <small>{nextWk ? `Your next session opens ${fmtShort(nextWk.start)}.` : `That was the last week before ${fmtShort(plan.target)}.`}</small>
        </p>
      )}
      {items.length === 0 && (
        <p className="lt-rest">
          {sched.stats.items === 0 ? "Nothing is planned yet." : sched.stats.finished ? "Everything is covered." : "Nothing is due this week."}
          <small>
            {sched.stats.items === 0
              ? "Add subjects and topics under What this covers, and your weeks fill in."
              : sched.stats.finished
                ? `Look over old topics now and then until ${fmtShort(plan.target)}.`
                : "Your plan is spaced out, so use the time to rest or look over past topics."}
          </small>
        </p>
      )}

      {kinds.length > 0 && (
        <details className="lt-how">
          <summary>How to do each one</summary>
          <dl>
            {kinds.map((k) => (
              <div key={k}>
                <dt>{k === "practice" ? (plan.kind === "exam" ? "Timed practice" : "Check-up") : KIND_LABEL[k]}</dt>
                <dd>{k === "practice" ? HOW.practice(plan) : HOW[k]}</dd>
              </div>
            ))}
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
    <section className="lt-sec" aria-labelledby="lt-up-h">
      <h2 className="lt-h2" id="lt-up-h">Weeks ahead</h2>
      <p className="lt-sub">Each week adjusts to what you finish.</p>
      <ul className="lt-weeks">
        {shown.map((w) => {
          const subs = [...new Set(w.items.map((i) => i.subject))];
          return (
            <li key={w.start}>
              <details className="lt-week">
                <summary>
                  <span className="lt-wk">Week {sched.stats.weekNo + w.index}<span className="lt-wkSub">{range(w.start, w.end)}</span></span>
                  <span className="lt-wkSubj">{subs.length ? subs.join(", ") : "Free week"}</span>
                  <span className="lt-wkMins">{w.items.length ? fmtMins(w.mins) : ""}</span>
                </summary>
                {w.items.length > 0 && (
                  <ul className="lt-wkItems">
                    {w.items.map((it) => (
                      <li key={it.id}>
                        <span><i className="lt-dot" style={{ background: subjColor(it.subject) }} aria-hidden="true" />{itemTitle(it, plan)}</span>
                        <em>{fmtMins(it.mins)}</em>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </li>
          );
        })}
      </ul>
      {later.length > 4 && (
        <button className="btn ghost small lt-more" onClick={() => { Sound.play("tap"); setAll(!all); }}>{all ? "Show fewer weeks" : `Show all ${later.length} weeks`}</button>
      )}
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
    <>
      {plan.about && (
        <p className="lt-note">
          {unsure && <b>Check this list. </b>}{plan.about}
          {plan.confidence === "low" && " This school's exact curriculum isn't confirmed, so check the topics with your teacher or the school."}
          {unsure && <> <button type="button" onClick={() => setCoverOpen(true)}>Review the topics</button></>}
        </p>
      )}
      {plan.sources && plan.sources.length > 0 && (
        <p className="lt-src">
          Sources:{" "}
          {plan.sources.map((x, i) => (
            <span key={x.uri}>
              {i > 0 && ", "}
              <a href={x.uri} target="_blank" rel="noopener noreferrer">{x.title}<span className="lt-sr"> (opens in a new tab)</span></a>
            </span>
          ))}
        </p>
      )}
      {plan.searched && (!plan.sources || plan.sources.length === 0) && <p className="lt-src">No online sources were found for this school, so check the topics with the school.</p>}

      <div className="lt-runBox">
        <div className="lt-run" role="img" aria-label={sched.ended ? "The date has passed" : `Week ${st.weekNo} of ${st.totalWeeks}`}>
          {Array.from({ length: st.totalWeeks }, (_, i) => <i key={i} className={sched.ended || i < st.weekNo - 1 ? "past" : i === st.weekNo - 1 ? "now" : ""} />)}
        </div>
        <div className="lt-runCap">
          <span>{sched.ended ? "The date has passed" : `Week ${st.weekNo} of ${st.totalWeeks}`}</span>
          <span>Ready by {fmtShort(plan.target)}</span>
        </div>
        {!sched.ended && !st.finished && st.needPerWeek > 0 && <p className="lt-pace">About {fmtMins(st.needPerWeek)} a week keeps you on track.{st.needPerWeek > HEAVY_MINS && " That's a lot. A later date, or fewer topics, would make it lighter."}</p>}
      </div>

      {sched.ended ? (
        <div className="lt-done">
          <p>The date you picked has passed. Change it under Make it fit you to keep this plan going, or start a new plan.</p>
        </div>
      ) : (
        <ThisWeek plan={plan} sched={sched} materials={materials} onToggle={onToggle} onStudy={onStudy} lesson={lesson} />
      )}

      {!sched.ended && <Weeks plan={plan} sched={sched} />}

      <section className="lt-sec" aria-labelledby="lt-fit-h">
        <h2 className="lt-h2" id="lt-fit-h" style={{ marginBottom: 12 }}>Your plan</h2>
        <details className="lt-panel">
          <summary>Make it fit you</summary>
          <div className="lt-panelBody">
            {plan.subjects.length > 0 && (
              <div>
                <p className="lt-label">How ready do you feel?</p>
                <p className="lt-sub" style={{ marginBottom: 6 }}>Shaky subjects come first and get more time.</p>
                {plan.subjects.map((s) => (
                  <div className="lt-conf" key={s.id}>
                    <span className="lt-rowName"><i className="lt-dot" style={{ background: subjColor(s.name) }} aria-hidden="true" />{s.name}</span>
                    <Pills name={`lt-conf-${s.id}`} label={`How ready you feel in ${s.name}`} value={s.conf || 2} options={CONF_OPTS} onChange={(v) => edit((p) => setConf(p, s.id, v))} />
                  </div>
                ))}
              </div>
            )}
            <div>
              <p className="lt-label" id="lt-cap-l">Time each week</p>
              <Pills name="lt-cap" label="Time each week" value={cap} options={CAPS} onChange={(v) => edit((p) => setCap(p, v))} />
              <p className={cap != null && st.covered < 100 ? "lt-hint warn" : "lt-hint"} aria-live="polite">{capHint}</p>
            </div>
            <div>
              <label className="lt-field">
                <span className="lt-label" style={{ margin: 0 }}>Date you need to be ready</span>
                <input className="input" type="date" name="ready-by" value={plan.target} min={addDays(today, LIMITS.minDays)} max={addDays(today, LIMITS.maxDays)} autoComplete="off"
                  onChange={(e) => { const v = e.target.value; const bad = targetError(today, v); setDateErr(bad); if (!bad) edit((p) => setTarget(p, v)); }} />
              </label>
              <p className={dateErr ? "lt-hint warn" : "lt-hint"} role={dateErr ? "alert" : undefined}>{dateErr || `${timeLeftLabel(today, plan.target)} from now.`}</p>
            </div>
          </div>
        </details>

        <details className="lt-panel" open={coverOpen} onToggle={(e) => setCoverOpen(e.currentTarget.open)}>
          <summary>What this covers</summary>
          <div className="lt-panelBody">
            <p className="lt-sub" style={{ margin: 0 }}>Remove what you don't need and add what's missing. Your weeks update.</p>
            {plan.subjects.map((s) => (
              <div className="lt-subj" key={s.id}>
                <div className="lt-subjHead">
                  <span className="lt-rowName"><i className="lt-dot" style={{ background: subjColor(s.name) }} aria-hidden="true" />{s.name}</span>
                  <button type="button" className="lt-x" aria-label={`Remove subject ${s.name}`} onClick={() => { Sound.play("rip"); onDelete({ type: "subject", s }); }}><X size={18} /></button>
                </div>
                <ul className="lt-topics">
                  {s.topics.map((t) => (
                    <li key={t.id}>
                      <span>{t.t}{t.p === "f" && <em>from Grade {plan.grade}</em>}</span>
                      <button type="button" className="lt-x" aria-label={`Remove ${t.t}`} onClick={() => { Sound.play("rip"); edit((p) => removeTopic(p, s.id, t.id)); }}><X size={18} /></button>
                    </li>
                  ))}
                </ul>
                {s.topics.length < LIMITS.topics && (
                  <AddLine label={`Add a topic to ${s.name}`} placeholder="Add a topic…" max={LIMITS.topic} cta="Add" onAdd={(v) => { Sound.play("add"); edit((p) => addTopic(p, s.id, v)); }} />
                )}
              </div>
            ))}
            {plan.subjects.length < LIMITS.subjects && (
              <AddLine label="Add a subject" placeholder="Add a subject…" max={LIMITS.subject} cta="Add subject" onAdd={(v) => { Sound.play("add"); edit((p) => addSubject(p, v)); }} />
            )}
          </div>
        </details>

        <div className="lt-opts">
          {canNew && <button className="btn ghost small" onClick={onNew}><Plus size={16} />New plan</button>}
          <button className="lt-danger" onClick={() => onDelete({ type: "plan" })}>Delete this plan</button>
        </div>
      </section>
    </>
  );
}

/* ───────────── the tab ───────────── */

export default function LongTermTab({ user, store, subjects, materials, defaultGrade, onStudy, toast, onSaved }) {
  const { data, status, update, retry } = useLongTerm(user, store, onSaved);
  const [adding, setAdding] = useState(false);
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
      if (toast) toast(`Deleted ${planTitle(plan)}.`, () => update(() => before), "Undo", 7000);
      return;
    }
    const prev = plan;
    edit((p) => removeSubject(p, what.s.id));
    const n = what.s.topics.length;
    if (toast) toast(`Removed ${what.s.name}${n ? ` and its ${n} ${n === 1 ? "topic" : "topics"}` : ""}.`, () => update((d) => ({ ...d, plans: d.plans.map((p) => (p.id === prev.id ? prev : p)) })), "Undo", 7000);
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
  const title = setup ? "Long term review" : planTitle(plan);
  const lede = setup
    ? "Get ready for next year or for a new school's exam, a little each week."
    : sched.ended ? "The date has passed."
      : sched.stats.finished ? "Everything is covered. Keep recalling until the date."
        : `${timeLeftLabel(today, plan.target)} to go.`;

  return (
    <div className="lt">
      <div className="v3-head">
        <div>
          <h1 className="h1">{title}</h1>
          <p className="v3-lede">{lede}</p>
        </div>
      </div>

      {status === "loading" && <p className="lt-sub" role="status">Loading your plans…</p>}
      {status === "error" && (
        <div className="lt-fail">
          <p>We couldn't load your plans. Check your connection, then try again. Your saved plans are safe.</p>
          <button className="btn accent" onClick={retry}>Try again</button>
        </div>
      )}

      {status === "ready" && setup && (
        <Setup user={user} today={today} defaultGrade={defaultGrade} subjects={subjects} canCancel={!!plan} onCancel={() => setAdding(false)} onDone={addPlan} />
      )}

      {status === "ready" && !setup && (
        <>
          {data.plans.length > 1 && (
            <div className="lt-plans" role="group" aria-label="Your plans">
              {data.plans.map((p) => (
                <button key={p.id} className="chip" aria-pressed={p.id === data.active} onClick={() => { Sound.play("tap"); update((d) => ({ ...d, active: p.id })); }}><span className="lt-chipText">{planShort(p)}</span></button>
              ))}
            </div>
          )}
          <PlanView key={plan.id} plan={plan} sched={sched} today={today} materials={materials} edit={edit} onToggle={toggle} onStudy={onStudy} lesson={lesson}
            onNew={() => { Sound.play("tap"); setAdding(true); }} canNew={data.plans.length < LIMITS.plans} onDelete={remove} />
        </>
      )}
    </div>
  );
}
