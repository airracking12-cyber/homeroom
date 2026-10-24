// Coach me: a short session that makes you answer BEFORE you see the answer, mixes recall, explaining, "why" and "apply it",
// asks how sure you are first, and ends with coaching. It runs entirely from stored questions on this device: no live assistant.
// The logic is in lib/coach.js (tested). Everything saved so far survives quitting: each answer is saved at once.
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Sound } from "../../lib/sound.js";
import { mcFallback, sameAnswer, logSession } from "../../lib/study.js";
import { itemFor, checkPoints } from "../../lib/practice.js";
import { CONF, KIND_NAME, buildSession, startSession, currentQuestion, isDone, recordAnswer, applyOutcome, coachSummary } from "../../lib/coach.js";
import { Button, Bar, cx } from "../ui.jsx";
import { RunShell } from "./runs.jsx";

const MOMENT = {
  "confident-wrong": "You felt sure, but this one slipped. That is the most useful kind of mistake: it shows you exactly where to look.",
  "unsure-right": "You weren't sure, but you got it. Trust yourself a little more.",
};
const RATE = [{ v: 1, label: "Got it" }, { v: 0.5, label: "Partly" }, { v: 0, label: "Not yet" }];

// One burst, drawn inside a decorative band above the summary's text, never over it. Each piece flies on its own path.
function Celebrate() {
  const bits = useMemo(() => Array.from({ length: 28 }, (_, i) => ({ x: `${Math.round((i % 2 ? 1 : -1) * (20 + ((i * 37) % 150)))}px`, y: `${70 + ((i * 53) % 70)}px`, r: `${(i * 97) % 540 - 270}deg`, d: `${((i * 13) % 40) / 100}s` })), []);
  return <div className="celebrate" aria-hidden="true">{bits.map((b, i) => <i key={i} style={{ "--x": b.x, "--y": b.y, "--r": b.r, "--d": b.d }} />)}</div>;
}

function Summary({ s, onExit, again }) {
  const sum = useMemo(() => coachSummary(s.results), [s.results]);
  return (
    <div className="stack summary">
      <Celebrate />
      <div className="card result pop-in" style={{ "--i": 0 }}>
        <h2>Session done</h2>
        <p><b className="display result-n">{sum.right}</b><span className="muted"> of {sum.total} right{sum.partly ? `, ${sum.partly} partly` : ""}</span></p>
        <Bar value={sum.pct} label="Score" />
      </div>
      <section className="card stack pop-in" style={{ "--i": 1 }} aria-label="What went well"><h3>What went well</h3><ul className="plain">{sum.well.map((l) => <li key={l}>{l}</li>)}</ul></section>
      <section className="card stack pop-in" style={{ "--i": 2 }} aria-label="What to work on"><h3>What to work on</h3><ul className="plain">{sum.work.map((l) => <li key={l}>{l}</li>)}</ul></section>
      <section className="note pin stick coach-tip stack" style={{ "--tilt": "-1.2deg", "--i": 4 }} aria-label="One tip"><h3>One tip</h3><p>{sum.tip}</p></section>
      {sum.comeBack.length > 0 && <p className="caption">Coming back tomorrow: {sum.comeBack.slice(0, 5).join(", ")}{sum.comeBack.length > 5 ? ` and ${sum.comeBack.length - 5} more` : ""}.</p>}
      <div className="cluster"><Button variant="primary" onClick={again}>Another session</Button><Button onClick={onExit}>Done</Button></div>
    </div>
  );
}

export function CoachRun({ ideas, study, update, practice, label, resume, onSave, onExit, onAgain }) {
  const local = useCallback((idea) => mcFallback(idea, ideas), [ideas]);
  const [s, setS] = useState(() => resume || startSession(buildSession(ideas, study, practice || {}, { local }), label || "your notes"));
  const [stage, setStage] = useState("conf");   // conf: how sure are you? -> answer -> (rate yourself, open questions) -> feedback
  const [conf, setConf] = useState(null);
  const [val, setVal] = useState("");
  const [shown, setShown] = useState(null);     // the question just answered, while its feedback is on screen
  const [fb, setFb] = useState(null);
  const [check, setCheck] = useState(null);     // the key-point checklist for an open answer
  const bodyRef = useRef(null);
  const logged = useRef(false);
  const done = isDone(s) && stage !== "feedback";
  const q = stage === "feedback" || stage === "rate" ? shown || currentQuestion(s) : currentQuestion(s);

  useEffect(() => { if (stage !== "feedback") bodyRef.current?.querySelector("button:not(:disabled), textarea, input")?.focus({ preventScroll: true }); }, [stage, s.i]);
  useEffect(() => {
    if (!done || logged.current) return;
    logged.current = true;
    const right = s.results.filter((r) => r.score === 1).length;
    update((st) => logSession(st, "coach", s.label, s.results.length, right));
    onSave?.(null); // a finished session is not offered again
    Sound.play("bell");
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s.qs.length) return <RunShell title="Coach me" onExit={onExit}><div className="finish"><h2>Nothing to practise yet</h2><p className="muted">Add some notes first, then come back.</p><Button variant="primary" onClick={onExit}>Done</Button></div></RunShell>;
  if (done) return <RunShell title="Coach me" sub={s.label} onExit={onExit} exitLabel="Back to study"><Summary s={s} onExit={onExit} again={onAgain || onExit} /></RunShell>;

  // Records the answer at once: the session is saved before the feedback even shows, so quitting here loses nothing.
  const finalize = (score, answer) => {
    const cur = currentQuestion(s), idea = cur.ideaId;
    const next = recordAnswer(s, { score, conf, answer }, { it: itemFor(practice, idea), card: study.cards[idea], local });
    update((st) => applyOutcome(st, cur, { score, conf }));
    setShown(cur); setS(next); onSave?.(next);
    setFb({ score, flag: next.results[next.results.length - 1].flag, again: score < 1 && !cur.retest });
    setStage("feedback");
    Sound.play(score === 1 ? "done" : "pop");
  };
  const submit = (answer) => {
    const cur = currentQuestion(s);
    if (cur.kind === "mc") { setShown(cur); finalize(Number(answer) === cur.mc.a ? 1 : 0, cur.mc.c[Number(answer)]); return; }
    if (cur.kind === "recall" && cur.blank) { finalize(sameAnswer(answer, cur.model) ? 1 : 0, answer); return; }
    setShown(cur); setCheck(cur.points.length ? checkPoints(answer, cur.points) : null); setStage("rate");
  };
  const next = () => { setStage("conf"); setConf(null); setVal(""); setShown(null); setFb(null); setCheck(null); };
  const open = q.kind !== "mc" && !(q.kind === "recall" && q.blank);
  const answered = s.results.length;

  return (
    <RunShell title="Coach me" sub={`${KIND_NAME[q.kind]}${q.retest ? ", a second try" : ""} · ${q.subject}, ${q.topic}`} step={Math.min(answered, s.qs.length - 1)} total={s.qs.length} onExit={onExit}>
      <div className="card stack" ref={bodyRef}>
        <p className="display q-text">{q.q}</p>

        {stage === "conf" && (
          <div className="stack">
            <p className="small muted" id="conf-h">First, how sure are you that you can answer this?</p>
            <div className="conf-row" role="group" aria-labelledby="conf-h">
              {CONF.map((c) => <button key={c.v} type="button" className="conf-btn" onClick={() => { setConf(c.v); setStage("answer"); Sound.play("tap"); }}><span className="choice-key" aria-hidden="true">{c.v + 1}</span>{c.label}</button>)}
            </div>
          </div>
        )}

        {stage === "answer" && (
          <div className="stack">
            {q.kind === "mc" ? (
              <div className="choices" role="group" aria-label="Answers">
                {q.mc.c.map((c, i) => <button key={i} type="button" className="choice" onClick={() => submit(i)}><span className="choice-key" aria-hidden="true">{i + 1}</span><span>{c}</span></button>)}
              </div>
            ) : (
              <>
                {q.kind === "recall" && q.blank
                  ? <input className="input" autoComplete="off" autoCapitalize="none" aria-label="Your answer" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) submit(val); }} placeholder="Type the missing word" />
                  : <textarea className="textarea" rows={4} aria-label="Your answer" value={val} onChange={(e) => setVal(e.target.value)} placeholder={q.kind === "recall" ? "Write what you remember, notes closed" : "In your own words"} />}
                <Button variant="primary" size="lg" block disabled={!val.trim()} onClick={() => submit(val)}>{open ? "Show me the answer" : "Check"}</Button>
                <Button variant="ghost" size="sm" onClick={() => submit("")}>I don&rsquo;t know</Button>
              </>
            )}
          </div>
        )}

        {stage === "rate" && (
          <div className="stack">
            <div className="fix"><b>A good answer</b><span>{q.model}</span></div>
            {check && <ul className="checklist" aria-label="Key points">{q.points.map((p) => <li key={p} data-hit={check.hit.includes(p) ? "1" : "0"}><span className="sr-only">{check.hit.includes(p) ? "You mentioned: " : "You didn't mention: "}</span>{p}</li>)}</ul>}
            <p className="small muted" id="rate-h">How did your answer compare?</p>
            <div className="conf-row" role="group" aria-labelledby="rate-h">{RATE.map((r) => <button key={r.v} type="button" className="conf-btn" onClick={() => finalize(r.v, val)}>{r.label}</button>)}</div>
          </div>
        )}

        {stage === "feedback" && fb && (
          <div className={cx("feedback", fb.score === 1 ? "ok" : "no")} role="status">
            <b>{fb.score === 1 ? "Right." : fb.score === 0.5 ? "Partly there." : "Not quite."}</b>
            {fb.flag && <p className="mismatch" data-flag={fb.flag}>{MOMENT[fb.flag]}</p>}
            {fb.score < 1 && <p>{q.mis || `Compare your answer with the note: ${q.src.d}`}</p>}
            {q.kind === "mc" && <p>The answer: <b>{q.mc.c[q.mc.a]}</b>. {q.why}</p>}
            {q.kind === "recall" && q.blank && fb.score < 1 && <p>The missing word: <b>{q.model}</b></p>}
            {fb.score < 1 && q.trick && <p className="trick">{q.trick}</p>}
            {fb.again && <p className="caption">I&rsquo;ll ask this again in a few questions, in a different way.</p>}
            <Button variant="primary" size="lg" block onClick={next}>{isDone(s) ? "See how it went" : "Next"}</Button>
          </div>
        )}
      </div>
    </RunShell>
  );
}
