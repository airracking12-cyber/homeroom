// The intro, built from scratch: what Homeroom is, three small things to actually do, then the closing credits.
// Calm: serif headlines on cream, things appear one after another, nothing bounces. Skippable on every screen.
import { useState, useEffect, useRef, useReducer } from "react";
import { ListChecks, BookOpen, Telescope, ArrowRight, Check, X } from "lucide-react";
import { notes } from "../../lib/services.js";
import { subjColor } from "../../lib/constants.js";
import { todayISO, addDays } from "../../lib/dates.js";
import { uid } from "../../lib/helpers.js";
import { Sound } from "../../lib/sound.js";
import { useData } from "../data.jsx";
import { useShell } from "../shell-context.js";
import { Button, Chip, Field, Banner, Dots, cx } from "../ui.jsx";
import { Wordmark } from "../auth.jsx";
import { STEPS, CREDIT, start, reduce, save, loadSaved, stepName, isLast } from "./machine.js";

const Reveal = ({ children, i = 0, as: Tag = "div", className }) => <Tag className={cx("reveal", className)} style={{ "--i": i }}>{children}</Tag>;

function Welcome({ onNext }) {
  return (
    <div className="intro-col">
      <Reveal i={0}><Wordmark /></Reveal>
      <Reveal i={1} as="h1" className="intro-h">Track it. Review it. Prepare for what&rsquo;s next.</Reveal>
      <Reveal i={2} as="p" className="intro-lede">Homeroom is a shared class tracker, plus review tools for upcoming tasks, the next grade level or an entrance exam.</Reveal>
      <ul className="plain intro-three">
        <Reveal i={3} as="li"><ListChecks size={20} aria-hidden="true" /><span><b>Track</b> what your class has to do.</span></Reveal>
        <Reveal i={4} as="li"><BookOpen size={20} aria-hidden="true" /><span><b>Review</b> before a quiz or test.</span></Reveal>
        <Reveal i={5} as="li"><Telescope size={20} aria-hidden="true" /><span><b>Prepare</b> for the year ahead, or an exam.</span></Reveal>
      </ul>
      <Reveal i={6}><Button variant="primary" size="lg" onClick={onNext}>Try it, in three quick steps<ArrowRight size={18} aria-hidden="true" /></Button></Reveal>
    </div>
  );
}

// Step 1: add a real task. Everyone in the class will see it.
function TrackStep({ onNext }) {
  const d = useData();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [due, setDue] = useState(addDays(todayISO(), 1));
  const [added, setAdded] = useState(null);
  const t0 = todayISO();
  const subjects = d.subjects.slice(0, 8);
  const ok = title.trim() && subject;
  const add = (e) => {
    e.preventDefault();
    if (!ok) return;
    const t = { id: uid(), title: title.trim(), subject, type: "Homework", priority: "Medium", deadline: due, notes: "", quarter: d.defQuarter, groupId: null, addedBy: d.user, createdAt: Date.now() };
    d.addTask(t); Sound.play("add"); setAdded(t);
  };
  if (added) return (
    <div className="intro-col">
      <Reveal i={0}><span className="glyph-ok"><Check size={26} strokeWidth={3} aria-hidden="true" /></span></Reveal>
      <Reveal i={1} as="h1" className="intro-h2">That&rsquo;s on the class list.</Reveal>
      <Reveal i={2} as="p" className="intro-lede">Your classmates can see <b>{added.title}</b> now, and tick it off when they&rsquo;re done. You can edit or delete it any time in Track.</Reveal>
      <Reveal i={3}><Button variant="primary" size="lg" onClick={onNext}>Next: review<ArrowRight size={18} aria-hidden="true" /></Button></Reveal>
    </div>
  );
  return (
    <form className="intro-col" onSubmit={add}>
      <Reveal i={0} as="p" className="eyebrow">1 of 3 &middot; Track</Reveal>
      <Reveal i={1} as="h1" className="intro-h2">Add something your class needs to do.</Reveal>
      <Reveal i={2} as="p" className="intro-lede">A homework, a quiz, a deadline. Everyone in your class sees it.</Reveal>
      <Reveal i={3}><Field label="What is it?" htmlFor="in-title"><input id="in-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Math quiz 2.2" autoComplete="off" /></Field></Reveal>
      <Reveal i={4}><Field label="Subject"><div className="chips" role="group" aria-label="Subject">{subjects.map((s) => <Chip key={s} on={subject === s} onClick={() => setSubject(s)}><i className="dot" style={{ background: subjColor(s) }} />{s}</Chip>)}</div></Field></Reveal>
      <Reveal i={5}><Field label="Due"><div className="chips" role="group" aria-label="Due">{[[t0, "Today"], [addDays(t0, 1), "Tomorrow"], [addDays(t0, 7), "Next week"]].map(([v, l]) => <Chip key={l} on={due === v} onClick={() => setDue(v)}>{l}</Chip>)}</div></Field></Reveal>
      <Reveal i={6} className="form-actions"><Button variant="primary" size="lg" type="submit" disabled={!ok}>Add to class</Button><Button variant="ghost" size="lg" onClick={onNext}>Skip this step</Button></Reveal>
    </form>
  );
}

// Step 2: paste a few lines of notes and get real flashcards back.
function ReviewStep({ onNext }) {
  const d = useData();
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState("");
  const [cards, setCards] = useState(null);
  const [flip, setFlip] = useState({});
  const [err, setErr] = useState("");
  const subjects = d.subjects.slice(0, 8);
  const ok = text.trim().length >= 20 && subject;
  const make = async (e) => {
    e.preventDefault();
    if (!ok || busy) return;
    setErr(""); setBusy("Saving your notes");
    const noteId = uid();
    const good = await d.addNote({ id: noteId, title: "My first notes", text: text.trim(), subject, topic: "", kind: "upload", onProgress: setBusy });
    if (!good) { setBusy(""); setErr("We couldn't save those notes just now. Check your connection and try again, or skip this step."); Sound.play("err"); return; }
    setBusy("Making flashcards");
    let ideas = null;
    try { const got = await notes.ideasFor([noteId]); ideas = got[noteId]?.ideas || []; } catch { /* shown as "saved" below */ }
    setBusy(""); Sound.play("pop");
    setCards((ideas || []).slice(0, 3));
  };
  if (cards) return (
    <div className="intro-col">
      <Reveal i={0} as="p" className="eyebrow">2 of 3 &middot; Review</Reveal>
      <Reveal i={1} as="h1" className="intro-h2">{cards.length ? "Here are your first flashcards." : "Your notes are saved."}</Reveal>
      <Reveal i={2} as="p" className="intro-lede">{cards.length ? "Tap a card to see the answer. In Review you can also fill in blanks, take quizzes and more." : "Homeroom is still reading them. You can study them from Review in a moment."}</Reveal>
      {cards.length > 0 && <div className="mini-cards">{cards.map((c, i) => <Reveal i={3 + i} key={i}><button type="button" className="mini-card" aria-pressed={!!flip[i]} onClick={() => setFlip((f) => ({ ...f, [i]: !f[i] }))}><span className="eyebrow">{flip[i] ? "Answer" : "Term"}</span><span className="display">{flip[i] ? c.d : c.t}</span></button></Reveal>)}</div>}
      <Reveal i={6}><Button variant="primary" size="lg" onClick={onNext}>Next: prepare<ArrowRight size={18} aria-hidden="true" /></Button></Reveal>
    </div>
  );
  return (
    <form className="intro-col" onSubmit={make}>
      <Reveal i={0} as="p" className="eyebrow">2 of 3 &middot; Review</Reveal>
      <Reveal i={1} as="h1" className="intro-h2">Turn notes into something to review.</Reveal>
      <Reveal i={2} as="p" className="intro-lede">Paste a few lines from a lesson. Homeroom picks out the key ideas and makes flashcards. Your class can study from them too.</Reveal>
      <Reveal i={3}><Field label="A few lines of notes" htmlFor="in-notes" help="At least a sentence or two."><textarea id="in-notes" className="textarea" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Photosynthesis is how plants make food from sunlight, water and carbon dioxide..." /></Field></Reveal>
      <Reveal i={4}><Field label="Subject"><div className="chips" role="group" aria-label="Subject">{subjects.map((s) => <Chip key={s} on={subject === s} onClick={() => setSubject(s)}><i className="dot" style={{ background: subjColor(s) }} />{s}</Chip>)}</div></Field></Reveal>
      {err && <Banner tone="bad">{err}</Banner>}
      {busy && <p className="muted" role="status">{busy}<Dots /></p>}
      <Reveal i={5} className="form-actions"><Button variant="primary" size="lg" type="submit" disabled={!ok || !!busy}>Make flashcards</Button><Button variant="ghost" size="lg" onClick={onNext} disabled={!!busy}>Skip this step</Button></Reveal>
    </form>
  );
}

// Step 3: choose what to prepare for. The real setup opens next, with the first questions already answered.
function PrepareStep({ onNext, onPlan }) {
  const [kind, setKind] = useState(null);
  return (
    <div className="intro-col">
      <Reveal i={0} as="p" className="eyebrow">3 of 3 &middot; Prepare</Reveal>
      <Reveal i={1} as="h1" className="intro-h2">Look further ahead.</Reveal>
      <Reveal i={2} as="p" className="intro-lede">Prepare plans a little each week for the whole next grade level, or for a school&rsquo;s entrance exam, with short lessons and practice.</Reveal>
      <Reveal i={3}>
        <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="What do you want to prepare for">
          {[["grade", "The next grade level", "Everything you'll study next year, subject by subject."], ["exam", "A school's entrance exam", "What the school you're applying to usually tests."]].map(([v, t, s]) => (
            <button key={v} type="button" role="radio" aria-checked={kind === v} className="tech" onClick={() => setKind(v)}><span className="grow"><span className="title">{t}</span><span className="small muted">{s}</span></span></button>
          ))}
        </div>
      </Reveal>
      <Reveal i={4} className="form-actions"><Button variant="primary" size="lg" disabled={!kind} onClick={() => onPlan(kind)}>Set up my plan<ArrowRight size={18} aria-hidden="true" /></Button><Button variant="ghost" size="lg" onClick={onNext}>Maybe later</Button></Reveal>
    </div>
  );
}

// The closing credits: one person, what he built, a thank-you.
function Credits({ onDone }) {
  return (
    <div className="intro-col credits">
      <Reveal i={0} as="p" className="eyebrow">Closing credits</Reveal>
      <Reveal i={1} as="h1" className="intro-h">{CREDIT.headline}</Reveal>
      <Reveal i={2} as="p" className="credit-name display" aria-label={CREDIT.name}><span className="name-long" aria-hidden="true">{CREDIT.name}</span><span className="name-short" aria-hidden="true">{CREDIT.short}</span></Reveal>
      <Reveal i={3} as="p" className="intro-lede">{CREDIT.built}</Reveal>
      <Reveal i={4} as="p" className="intro-lede">{CREDIT.thanks}</Reveal>
      <Reveal i={5}><Button variant="primary" size="lg" onClick={onDone}>Start using Homeroom<ArrowRight size={18} aria-hidden="true" /></Button></Reveal>
    </div>
  );
}

export default function Intro({ user, onClose }) {
  const { go } = useShell();
  const [s, dispatch] = useReducer(reduce, user, (u) => start(loadSaved(u)));
  const head = useRef(null);
  const first = useRef(true);
  useEffect(() => { save(user, s); }, [user, s]);
  useEffect(() => { if (!s.open) onClose(s.skipped ? "skipped" : "finished"); }, [s.open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (first.current) { first.current = false; return; } head.current?.focus(); window.scrollTo?.(0, 0); }, [s.step]);
  useEffect(() => { document.documentElement.setAttribute("data-focus", "1"); return () => document.documentElement.removeAttribute("data-focus"); }, []);
  const name = stepName(s);
  const next = () => { Sound.play("tap"); dispatch({ type: "NEXT" }); };
  const plan = (kind) => { dispatch({ type: "DONE" }); setTimeout(() => go("prepare", "new", kind), 0); };
  return (
    <div className="intro">
      <header className="intro-top">
        <div className="dots-nav" role="img" aria-label={`Step ${s.step + 1} of ${STEPS.length}`}>{STEPS.map((x, i) => <i key={x} data-on={i === s.step ? 1 : undefined} data-past={i < s.step ? 1 : undefined} />)}</div>
        <div className="cluster">
          {s.step > 0 && !isLast(s) && <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "BACK" })}>Back</Button>}
          {!isLast(s) && <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "SKIP" })}><X size={15} aria-hidden="true" />Skip intro</Button>}
        </div>
      </header>
      <main className="intro-stage" id="main" key={name} ref={head} tabIndex={-1}>
        {name === "welcome" && <Welcome onNext={next} />}
        {name === "track" && <TrackStep onNext={next} />}
        {name === "review" && <ReviewStep onNext={next} />}
        {name === "prepare" && <PrepareStep onNext={next} onPlan={plan} />}
        {name === "credits" && <Credits onDone={() => dispatch({ type: "DONE" })} />}
      </main>
    </div>
  );
}
