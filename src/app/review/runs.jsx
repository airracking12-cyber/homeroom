// The nine ways to study. Same grading and spaced-repetition rules as v33 (see lib/study.js); new screens.
// A run is a focus zone: the navigation steps aside until it ends, so nothing competes with the question.
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { subjColor } from "../../lib/constants.js";
import { todayISO, addDays, relLabel, parse, weekStartOf } from "../../lib/dates.js";
import { Sound } from "../../lib/sound.js";
import { shuffle, norm, sameAnswer, maskIdea, missCard, logSession, BOX_DAYS, TECHS, buildQuiz } from "../../lib/study.js";
import { askTricks, markTeach, markBlurt } from "../../lib/review-ai.js";
import { Button, Chip, Dots, Bar, cx } from "../ui.jsx";

export function RunShell({ title, sub, step, total, onExit, children, exitLabel = "Back to study" }) {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-focus", "1");
    return () => document.documentElement.removeAttribute("data-focus");
  }, []);
  return (
    <div className="run">
      <div className="run-top">
        <Button variant="ghost" size="sm" onClick={onExit}><ChevronLeft size={16} aria-hidden="true" />{exitLabel}</Button>
        {total > 0 && <span className="caption" aria-live="polite">{Math.min(step, total)} of {total}</span>}
      </div>
      {total > 0 && <Bar value={(Math.min(step, total) / total) * 100} label="Progress" />}
      <h1 className="run-title">{title}</h1>
      {sub && <p className="muted">{sub}</p>}
      <div className="run-body">{children}</div>
    </div>
  );
}
export const Finish = ({ title, lines, onExit, again }) => (
  <div className="finish">
    <span className="glyph-ok"><Check size={26} strokeWidth={3} aria-hidden="true" /></span>
    <h2>{title}</h2>
    {lines.map((l, i) => <p key={i} className="muted">{l}</p>)}
    <div className="cluster" style={{ justifyContent: "center", marginTop: 12 }}>
      {again && <Button variant="primary" onClick={again}>Go again</Button>}
      <Button variant={again ? "secondary" : "primary"} onClick={onExit}>Done</Button>
    </div>
  </div>
);
const Sub = ({ it }) => `${it.subject}, ${it.mt}`;
const Result = ({ big, of, bar, children }) => (
  <div className="card result"><p><b className="display result-n">{big}</b><span className="muted"> {of}</span></p><Bar value={bar} label="Score" />{children}</div>
);
const Fix = ({ title, text }) => <div className="fix"><b>{title}</b><span>{text}</span></div>;

/* Flashcards with spaced repetition (Leitner boxes). */
export function CardsRun({ ideas, study, update, onExit, label }) {
  const today = todayISO();
  const build = (ahead) => {
    const due = [], fresh = [], rest = [];
    ideas.forEach((i) => { const c = study.cards[i.id]; if (!c) fresh.push(i); else if (c.due <= today) due.push(i); else rest.push(i); });
    due.sort((a, b) => study.cards[a.id].due.localeCompare(study.cards[b.id].due));
    return [...due, ...shuffle(fresh), ...(ahead ? shuffle(rest) : [])].slice(0, ahead && !due.length && !fresh.length ? 10 : 24);
  };
  const [q, setQ] = useState(() => build(false));
  const [total, setTotal] = useState(q.length);
  const [flip, setFlip] = useState(false);
  const [rev, setRev] = useState(false);
  const [st, setSt] = useState({ again: 0, good: 0, easy: 0 });
  const card = q[0];
  const rate = (g) => {
    update((s) => {
      const c = s.cards[card.id] || { b: 0, s: 0, m: 0 };
      const b = g === 0 ? 1 : Math.min(5, Math.max(1, c.b) + g);
      return { ...s, cards: { ...s.cards, [card.id]: { b, due: g === 0 ? today : addDays(today, BOX_DAYS[b]), s: c.s + 1, m: c.m + (g === 0 ? 1 : 0) } } };
    });
    setSt((x) => ({ ...x, [["again", "good", "easy"][g]]: x[["again", "good", "easy"][g]] + 1 }));
    Sound.play(g === 0 ? "tap" : "pop");
    setFlip(false);
    setQ((c) => (g === 0 ? [...c.slice(1), card] : c.slice(1)));
  };
  useEffect(() => { if (total > 0 && q.length === 0) update((s) => logSession(s, "cards", label, total, st.good + st.easy)); }, [q.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // space or enter flips; 1, 2, 3 rate
    const k = (e) => {
      if (!card || e.target.closest("input,textarea,button") || e.metaKey || e.ctrlKey) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlip((f) => !f); }
      else if (flip && "123".includes(e.key) && e.key) rate(Number(e.key) - 1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  if (total === 0) {
    const next = ideas.map((i) => study.cards[i.id]?.due).filter(Boolean).sort()[0];
    return <RunShell title="Flashcards" onExit={onExit}><Finish title="Nothing is due" lines={[`Every card in this set is on schedule${next ? `, and the next one is due ${relLabel(next).toLowerCase()}` : ""}.`, "Come back then, or study a few early."]} onExit={onExit} again={() => { const n = build(true); setQ(n); setTotal(n.length); }} /></RunShell>;
  }
  if (!card) {
    const tomorrow = ideas.filter((i) => study.cards[i.id]?.due === addDays(today, 1)).length;
    return <RunShell title="Flashcards" onExit={onExit}><Finish title="Session complete" lines={[`${st.good + st.easy} of ${total} went well${st.again ? `, and ${st.again} will come back sooner` : ""}.`, tomorrow ? `${tomorrow} card${tomorrow > 1 ? "s" : ""} will be waiting tomorrow.` : "Cards you know come back later and later."]} onExit={onExit} /></RunShell>;
  }
  const front = rev ? card.d : card.t, back = rev ? card.t : card.d;
  const box = study.cards[card.id]?.b || 0;
  return (
    <RunShell title="Flashcards" sub={<Sub it={card} />} step={total - q.length} total={total} onExit={onExit}>
      <button type="button" className="flashcard" aria-pressed={flip} onClick={() => setFlip(!flip)}>
        <span className="eyebrow">{flip ? (rev ? "Term" : "Answer") : (rev ? "Meaning" : "Term")}{box ? ` · box ${box}` : " · new"}</span>
        <span className="display flashcard-text" aria-live="polite">{flip ? back : front}</span>
        {!flip && <span className="caption">Tap to flip, or press space</span>}
      </button>
      {flip ? (
        <div className="rate-row" role="group" aria-label="How well did you know it?">
          <Button size="lg" onClick={() => rate(0)}>Again<small>soon</small></Button>
          <Button variant="primary" size="lg" onClick={() => rate(1)}>Good<small>later</small></Button>
          <Button size="lg" onClick={() => rate(2)}>Easy<small>much later</small></Button>
        </div>
      ) : <div style={{ textAlign: "center", marginTop: 12 }}><Button variant="ghost" size="sm" onClick={() => setRev(!rev)}>{rev ? "Show the term first" : "Show the meaning first"}</Button></div>}
    </RunShell>
  );
}

/* Fill in the blank: the key word is hidden, type it. */
export function ClozeRun({ ideas, update, onExit, label }) {
  const [items] = useState(() => shuffle(ideas.filter((i) => i.c && i.c.length >= 2 && maskIdea(i.d, i.c))).slice(0, 15));
  const [idx, setIdx] = useState(0);
  const [val, setVal] = useState("");
  const [res, setRes] = useState(null);
  const [score, setScore] = useState(0);
  if (items.length === 0) return <RunShell title="Fill the blanks" onExit={onExit}><Finish title="Nothing to blank out" lines={["These notes don\u2019t have sentences with a clear key word. Try flashcards or blurting for them."]} onExit={onExit} /></RunShell>;
  if (idx >= items.length) return <RunShell title="Fill the blanks" onExit={onExit}><Finish title={`${score} of ${items.length}`} lines={[score === items.length ? "Every blank right." : "The ones you missed are now at the front of your flashcards."]} onExit={onExit} /></RunShell>;
  const it = items[idx];
  const check = () => {
    const ok = sameAnswer(val, it.c);
    setRes(ok); Sound.play(ok ? "done" : "err");
    if (ok) setScore((x) => x + 1); else update((s) => missCard(s, it.id));
    if (idx === items.length - 1) update((s) => logSession(s, "cloze", label, items.length, score + (ok ? 1 : 0)));
  };
  const next = () => { setIdx(idx + 1); setVal(""); setRes(null); };
  return (
    <RunShell title="Fill the blanks" sub={<Sub it={it} />} step={idx} total={items.length} onExit={onExit}>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); if (res === null) { if (val.trim()) check(); } else next(); }}>
        <p className="display q-text">{maskIdea(it.d, it.c)}</p>
        <input className="input" aria-label="Type the missing word" autoFocus value={val} disabled={res !== null} placeholder="Type the missing word" autoComplete="off" onChange={(e) => setVal(e.target.value)} />
        {res !== null && <p className={res ? "fb-ok" : "fb-bad"} role="status">{res ? "Correct." : <>The answer is <b>{it.c}</b>.</>}</p>}
        {res === null ? <Button variant="primary" size="lg" block type="submit" disabled={!val.trim()}>Check</Button> : <Button variant="primary" size="lg" block type="submit">{idx === items.length - 1 ? "Finish" : "Next"}</Button>}
        {res === null && <Button variant="ghost" size="sm" onClick={() => { setRes(false); update((s) => missCard(s, it.id)); }}>Show me the answer</Button>}
      </form>
    </RunShell>
  );
}

/* Match each term with its meaning. */
export function MatchRun({ ideas, update, onExit, label }) {
  const clip = (s) => (s.length > 96 ? s.slice(0, 94).trimEnd() + "..." : s);
  const [rounds] = useState(() => { const sh = shuffle(ideas); const r = []; for (let i = 0; i < sh.length && r.length < 4; i += 5) r.push(sh.slice(i, i + 5)); return r.filter((x) => x.length >= 2); });
  const [ri, setRi] = useState(0);
  const [right] = useState(() => rounds.map((r) => shuffle(r)));
  const [pickL, setPickL] = useState(null);
  const [got, setGot] = useState({});
  const [bad, setBad] = useState(null);
  const [slips, setSlips] = useState(0);
  if (rounds.length === 0) return <RunShell title="Match pairs" onExit={onExit}><Finish title="Not enough to match" lines={["Add a little more material, then try again."]} onExit={onExit} /></RunShell>;
  if (ri >= rounds.length) return <RunShell title="Match pairs" onExit={onExit}><Finish title="All matched" lines={[slips === 0 ? "Not a single slip." : `${slips} slip${slips > 1 ? "s" : ""} on the way.`]} onExit={onExit} /></RunShell>;
  const cur = rounds[ri], rr = right[ri];
  const pickR = (id) => {
    if (pickL === null || got[id]) return;
    if (pickL === id) {
      Sound.play("pop"); const g = { ...got, [id]: true }; setGot(g); setPickL(null);
      if (cur.every((x) => g[x.id])) { setTimeout(() => { setRi((n) => n + 1); setGot({}); if (ri === rounds.length - 1) update((s) => logSession(s, "match", label, rounds.flat().length, rounds.flat().length)); }, 650); }
    } else { Sound.play("err"); setSlips((n) => n + 1); update((s) => missCard(s, pickL)); setBad(id); setPickL(null); setTimeout(() => setBad(null), 500); }
  };
  return (
    <RunShell title="Match pairs" sub="Pick a term, then its meaning." step={ri} total={rounds.length} onExit={onExit}>
      <div className="match">
        <div className="stack" style={{ gap: 8 }} role="group" aria-label="Terms">{cur.map((x) => <button key={x.id} type="button" className="m-btn" aria-pressed={pickL === x.id} data-done={got[x.id] ? 1 : undefined} disabled={!!got[x.id]} onClick={() => { Sound.play("tap"); setPickL(x.id); }}>{x.t}</button>)}</div>
        <div className="stack" style={{ gap: 8 }} role="group" aria-label="Meanings">{rr.map((x) => <button key={x.id} type="button" className="m-btn m-small" data-bad={bad === x.id ? 1 : undefined} data-done={got[x.id] ? 1 : undefined} disabled={!!got[x.id]} onClick={() => pickR(x.id)}>{clip(x.d)}</button>)}</div>
      </div>
    </RunShell>
  );
}

/* Memory tricks: an image, rhyme or acronym for each idea. */
export function MnemonicRun({ ideas, onExit }) {
  const groups = useMemo(() => { const sh = ideas.slice(0, 40); const g = []; for (let i = 0; i < sh.length; i += 5) g.push(sh.slice(i, i + 5)); return g; }, [ideas]);
  const [shown, setShown] = useState(1);
  const [res, setRes] = useState({});
  useEffect(() => {
    const gi = shown - 1;
    if (res[gi] || !groups[gi]) return undefined;
    let dead = false;
    (async () => {
      try { const map = await askTricks(groups[gi]); if (!dead) setRes((r) => ({ ...r, [gi]: { tricks: map, ai: Object.keys(map).length > 0 } })); }
      catch { if (!dead) setRes((r) => ({ ...r, [gi]: { tricks: {}, ai: false } })); }
    })();
    return () => { dead = true; };
  }, [shown, groups]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <RunShell title="Memory tricks" sub="Say each one out loud, and picture it." onExit={onExit}>
      <div className="stack">
        {groups.slice(0, shown).map((g, gi) => (
          <div className="card stack" key={gi} style={{ gap: 12 }}>
            <p className="eyebrow">{g[0].subject}, {g[0].mt}</p>
            {!res[gi] && <p className="muted" role="status">Thinking up tricks<Dots /></p>}
            {res[gi] && !res[gi].ai && <p className="trick"><b>{g.map((x) => (x.t || "?")[0].toUpperCase()).join("")}</b> Make a sentence where each word starts with these letters, in this order: {g.map((x) => x.t).join(", ")}.</p>}
            {g.map((x, i) => <div className="fix" key={x.id}><b>{x.t}</b><span>{x.d}</span>{res[gi]?.tricks[i] && <p className="trick">{res[gi].tricks[i]}</p>}</div>)}
          </div>
        ))}
        {shown < groups.length && <Button block onClick={() => setShown(shown + 1)}>Show more ({ideas.slice(0, 40).length - shown * 5} left)</Button>}
      </div>
    </RunShell>
  );
}

/* Teach it back (Feynman): explain an idea in your own words, then get honest feedback. */
export function TeachRun({ ideas, study, update, onExit, label }) {
  const [items] = useState(() => [...ideas].sort((a, b) => ((study.cards[b.id]?.m || 0) - (study.cards[a.id]?.m || 0)) || Math.random() - 0.5).slice(0, 5));
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [fb, setFb] = useState(null);
  const [busy, setBusy] = useState(false);
  const [solid, setSolid] = useState(0);
  if (items.length === 0) return <RunShell title="Teach it back" onExit={onExit}><Finish title="Nothing to teach yet" lines={["Add some notes first."]} onExit={onExit} /></RunShell>;
  if (idx >= items.length) return <RunShell title="Teach it back" onExit={onExit}><Finish title="Well explained" lines={[`${solid} of ${items.length} came out solid.`, "Anything shaky is now at the front of your flashcards."]} onExit={onExit} /></RunShell>;
  const it = items[idx];
  const check = async () => {
    setBusy(true);
    let r = null;
    try { r = await markTeach(it, text); } catch { /* fall through to the plain check */ }
    if (!r) {
      const hit = it.c && norm(text).includes(norm(it.c));
      const words = norm(it.d).split(" ").filter((w) => w.length > 4), have = words.filter((w) => norm(text).includes(w)).length;
      const v = hit && have / Math.max(1, words.length) > 0.4 ? "solid" : hit || have > 1 ? "partly" : "not yet";
      r = { verdict: v, good: hit ? `You used the key word, ${it.c}.` : "", missing: v === "solid" ? "" : "Compare with the notes below.", simpler: "" };
    }
    setFb(r); setBusy(false);
    if (r.verdict === "solid") { setSolid((n) => n + 1); Sound.play("done"); } else { update((s) => missCard(s, it.id)); Sound.play("pop"); }
    if (idx === items.length - 1) update((s) => logSession(s, "teach", label, items.length, solid + (r.verdict === "solid" ? 1 : 0)));
  };
  return (
    <RunShell title="Teach it back" sub={<Sub it={it} />} step={idx} total={items.length} onExit={onExit}>
      <div className="card stack">
        <p className="display q-text">Explain <b>{it.t}</b> as if you&rsquo;re teaching a younger student.</p>
        <textarea className="textarea" rows={5} autoFocus aria-label="Your explanation" value={text} disabled={!!fb} placeholder="In your own words, no peeking at the notes..." onChange={(e) => setText(e.target.value)} />
        {!fb && <Button variant="primary" size="lg" block disabled={text.trim().length < 12 || busy} onClick={check}>{busy ? <>Reading your explanation<Dots /></> : "Check my explanation"}</Button>}
        {fb && (
          <div className={cx("feedback", fb.verdict === "solid" ? "ok" : "no")} role="status">
            <b>{fb.verdict === "solid" ? "Solid." : fb.verdict === "partly" ? "Partly there." : "Not yet."}</b>
            {fb.good && <p>{fb.good}</p>}{fb.missing && <p>{fb.missing}</p>}{fb.simpler && <p className="caption">Try this picture: {fb.simpler}</p>}
            <p className="caption">From the notes: {it.d}</p>
            <Button variant="primary" size="lg" block onClick={() => { setIdx(idx + 1); setText(""); setFb(null); }}>{idx === items.length - 1 ? "Finish" : "Next idea"}</Button>
          </div>
        )}
      </div>
    </RunShell>
  );
}

/* Blurting: write everything you remember with the notes closed, then see what you missed. */
export function BlurtRun({ ideas, update, onExit, label }) {
  const topics = useMemo(() => { const m = new Map(); ideas.forEach((i) => { if (!m.has(i.mid)) m.set(i.mid, { mid: i.mid, title: i.mt, subject: i.subject, list: [] }); m.get(i.mid).list.push(i); }); return [...m.values()]; }, [ideas]);
  const [topic, setTopic] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);
  const mixRef = useRef(null);
  if (topic === "mix" && !mixRef.current) mixRef.current = shuffle(ideas).slice(0, 20);
  const set = topic === "mix" ? mixRef.current || [] : topic ? topics.find((t) => t.mid === topic)?.list.slice(0, 40) || [] : [];
  const grade = async () => {
    setBusy(true);
    let res = null;
    try {
      const j = await markBlurt(set, text);
      if (j && (Array.isArray(j.got) || Array.isArray(j.missed))) {
        const ok = (a) => (Array.isArray(a) ? a.map(Number).filter((n) => n >= 1 && n <= set.length) : []);
        const got = new Set(ok(j.got)), partly = new Set(ok(j.partly).filter((n) => !got.has(n)));
        const missed = set.map((_, i) => i + 1).filter((n) => !got.has(n) && !partly.has(n)); // anything not marked counts as missed, so nothing slips through
        res = { got: [...got], partly: [...partly], missed, wrong: Array.isArray(j.wrong) ? j.wrong.filter((w) => w && w.said).slice(0, 6) : [] };
      }
    } catch { /* fall through to the plain check */ }
    if (!res) {
      const t = norm(text), got = [], missed = [];
      set.forEach((x, i) => { const hit = (x.c && x.c.length >= 3 && t.includes(norm(x.c))) || norm(x.t).split(" ").filter((w) => w.length > 3).some((w) => t.includes(w)); (hit ? got : missed).push(i + 1); });
      res = { got, partly: [], missed, wrong: [], plain: true };
    }
    setOut(res); setBusy(false); Sound.play("done");
    update((s) => logSession(s, "blurt", label, set.length, res.got.length));
  };
  if (!topic) {
    return (
      <RunShell title="Blurting" sub="Pick what to blurt about. Then close your notes." onExit={onExit}>
        <div className="card card-flat divided">
          {topics.length > 1 && <button type="button" className="row-btn" onClick={() => { Sound.play("tap"); setTopic("mix"); }}><span className="grow"><span className="title">A mix of everything</span><span className="meta"><span>Up to 20 ideas picked at random</span></span></span></button>}
          {topics.map((t) => <button key={t.mid} type="button" className="row-btn" onClick={() => { Sound.play("tap"); setTopic(t.mid); }}><span className="grow"><span className="title">{t.title}</span><span className="meta"><span><i className="dot" style={{ background: subjColor(t.subject) }} />{t.subject}</span><span>{t.list.length} ideas</span></span></span></button>)}
        </div>
      </RunShell>
    );
  }
  if (out) {
    const gotN = out.got.length + out.partly.length * 0.5;
    return (
      <RunShell title="What you remembered" onExit={onExit}>
        <div className="stack">
          <Result big={Math.round(gotN)} of={`of ${set.length} ideas`} bar={(gotN / set.length) * 100}>{out.plain && <p className="caption">The assistant was busy, so this was a quick keyword check. Treat it as a guide.</p>}</Result>
          {out.missed.length > 0 && <section className="stack" style={{ gap: 8 }}><h2 className="eyebrow">You missed</h2>{out.missed.map((n) => <Fix key={n} title={set[n - 1].t} text={set[n - 1].d} />)}</section>}
          {out.partly.length > 0 && <section className="stack" style={{ gap: 8 }}><h2 className="eyebrow">Only partly</h2>{out.partly.map((n) => <Fix key={n} title={set[n - 1].t} text={set[n - 1].d} />)}</section>}
          {out.wrong.length > 0 && <section className="stack" style={{ gap: 8 }}><h2 className="eyebrow">Not quite right</h2>{out.wrong.map((w, i) => <Fix key={i} title={`You wrote: ${w.said}`} text={w.fix} />)}</section>}
          <div className="form-actions">
            {(out.missed.length + out.partly.length) > 0 && <Button variant="primary" onClick={() => { [...out.missed, ...out.partly].forEach((n) => update((s) => missCard(s, set[n - 1].id))); Sound.play("add"); onExit(); }}>Add these to my flashcards</Button>}
            <Button onClick={() => { setTopic(null); setOut(null); setText(""); }}>Blurt another</Button>
          </div>
        </div>
      </RunShell>
    );
  }
  return (
    <RunShell title="Blurting" sub={`${set.length} ideas in this one. Notes closed, write all you remember.`} onExit={() => { setTopic(null); setText(""); }} exitLabel="Pick another">
      <div className="stack">
        <textarea className="textarea blurt" rows={12} autoFocus aria-label="Everything you remember" value={text} placeholder="Everything you can remember. Don't worry about order or neatness." onChange={(e) => setText(e.target.value)} />
        <Button variant="primary" size="lg" block disabled={text.trim().length < 20 || busy} onClick={grade}>{busy ? <>Checking what you missed<Dots /></> : "Check what I missed"}</Button>
      </div>
    </RunShell>
  );
}

/* Practice quiz and mixed exam. */
export function QuizRun({ ideas, kind, update, onExit, label }) {
  const exam = kind === "exam";
  const [len, setLen] = useState(null);
  const [prog, setProg] = useState("");
  const [items, setItems] = useState(null);
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState(null);
  const [ans, setAns] = useState([]);
  const [t0] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const keyRef = useRef(null);
  useEffect(() => { const k = (e) => keyRef.current && keyRef.current(e); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  const lens = [[10, "Quick, 10"], [20, "Standard, 20"], [ideas.length, `Everything, ${ideas.length}`]].filter((x, i, a) => x[0] > 0 && a.findIndex((y) => y[0] === x[0]) === i);
  useEffect(() => { if (!exam || !items) return undefined; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [exam, items]);
  const go = async (n) => {
    setLen(n);
    const weak = shuffle(ideas).slice(0, Math.min(n, ideas.length));
    const { items: made } = await buildQuiz(weak, setProg);
    let list = made;
    if (exam) {
      const cl = shuffle(ideas.filter((i) => i.c && maskIdea(i.d, i.c))).slice(0, Math.max(3, Math.round(n / 3))).map((i) => ({ type: "cloze", ref: [i.id], q: maskIdea(i.d, i.c), a: i.c, w: `${i.t}: ${i.d}` }));
      list = [...made, ...cl];
    }
    setItems(shuffle(list));
  };
  const title = exam ? "Mixed exam" : "Practice quiz";
  if (!len) {
    return (
      <RunShell title={title} sub={exam ? "Timed, mixed questions, no hints until the end." : "How long do you want it?"} onExit={onExit}>
        <div className="chips">{lens.map(([n, l]) => <Chip key={n} onClick={() => go(n)}>{l}</Chip>)}</div>
        <p className="caption" style={{ marginTop: 12 }}>&ldquo;Everything&rdquo; asks about every idea in your notes, so nothing is skipped.</p>
      </RunShell>
    );
  }
  if (!items) return <RunShell title={title} onExit={onExit}><p className="muted" role="status" style={{ marginTop: 16 }}>{prog || "Getting ready"}<Dots /></p></RunShell>;
  if (idx >= items.length) {
    const right = ans.filter((a) => a.ok).length;
    const wrong = ans.filter((a) => !a.ok);
    return (
      <RunShell title={exam ? "Exam finished" : "Quiz finished"} onExit={onExit}>
        <div className="stack">
          <Result big={right} of={`of ${items.length} right${exam ? `, in ${Math.max(1, Math.round((now - t0) / 60000))} min` : ""}`} bar={(right / items.length) * 100}><p className="caption">{wrong.length ? "What you missed, with the reason:" : "A perfect score."}</p></Result>
          {wrong.map((a, i) => <Fix key={i} title={a.item.q} text={`Answer: ${a.item.type === "mc" ? a.item.c[a.item.a] : a.item.a}. ${a.item.w}`} />)}
          <div><Button variant="primary" onClick={onExit}>Done</Button></div>
        </div>
      </RunShell>
    );
  }
  const it = items[idx];
  const answered = pick !== null;
  const submit = (ok, chosen) => {
    setAns((a) => [...a, { item: it, ok, chosen }]);
    if (!ok) update((s) => missCard(s, it.ref[0]));
    if (idx === items.length - 1) update((s) => logSession(s, kind, label, items.length, ans.filter((a) => a.ok).length + (ok ? 1 : 0)));
  };
  const advance = () => { setIdx(idx + 1); setPick(null); };
  keyRef.current = (e) => { // 1 to 4 pick an answer
    if (it.type !== "mc" || e.target.closest("input,textarea") || e.metaKey || e.ctrlKey) return;
    const n = Number(e.key) - 1;
    if (n >= 0 && n < it.c.length && (!answered || exam)) { setPick(n); Sound.play("tap"); if (!exam) submit(n === it.a, n); }
  };
  const last = ans[ans.length - 1];
  const clock = `${Math.floor((now - t0) / 60000)}:${String(Math.floor(((now - t0) / 1000) % 60)).padStart(2, "0")}`;
  return (
    <RunShell title={title} sub={exam ? `Time: ${clock}` : undefined} step={idx} total={items.length} onExit={onExit}>
      <div className="card stack">
        <p className="display q-text">{it.q}</p>
        {it.type === "mc" ? (
          <div className="choices" role="group" aria-label="Answers">
            {it.c.map((c, i) => (
              <button key={i} type="button" className="choice" data-state={answered && !exam ? (i === it.a ? "right" : i === pick ? "wrong" : "") : pick === i ? "picked" : ""} disabled={answered && !exam}
                onClick={() => { if (answered && !exam) return; setPick(i); Sound.play("tap"); if (!exam) submit(i === it.a, i); }}><span className="choice-key" aria-hidden="true">{i + 1}</span><span>{c}</span></button>
            ))}
          </div>
        ) : <ClozeAnswer key={idx} item={it} onSubmit={(ok, v) => { setPick(0); submit(ok, v); if (exam) setTimeout(advance, 150); }} locked={answered && !exam} />}
        {!exam && answered && <><p className={last?.ok ? "fb-ok" : "fb-bad"} role="status">{last?.ok ? "Correct." : "Not quite."} {it.w}</p><Button variant="primary" size="lg" block onClick={advance}>{idx === items.length - 1 ? "Finish" : "Next"}</Button></>}
        {exam && it.type === "mc" && <Button variant="primary" size="lg" block disabled={pick === null} onClick={() => { submit(pick === it.a, pick); advance(); }}>{idx === items.length - 1 ? "Finish exam" : "Next"}</Button>}
      </div>
    </RunShell>
  );
}
function ClozeAnswer({ item, onSubmit, locked }) {
  const [v, setV] = useState("");
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); if (v.trim() && !locked) onSubmit(sameAnswer(v, item.a), v); }}>
      <input className="input" aria-label="Type the missing word" autoFocus value={v} disabled={locked} placeholder="Type the missing word" autoComplete="off" onChange={(e) => setV(e.target.value)} />
      {!locked && <Button variant="primary" size="lg" block type="submit" disabled={!v.trim()}>Check</Button>}
    </form>
  );
}

/* A week of small sessions, spread out, so it never turns into a one-night cram. */
const PLAN_PATTERN = ["teach", "cards", "cloze", "quiz", "blurt", "match", "exam"];
export function PlanRun({ subjects, study, update, onStart, onExit }) {
  const ws = weekStartOf(todayISO());
  const subs = subjects.length ? subjects : ["Everything"];
  const days = Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i));
  const plan = days.map((d, i) => {
    const sessions = [{ tech: PLAN_PATTERN[i % PLAN_PATTERN.length], subj: subs[i % subs.length] }];
    if (subs.length > 1) sessions.push({ tech: "cards", subj: subs[(i + 1) % subs.length] });
    return { d, sessions };
  });
  const done = (study.plan && study.plan.ws === ws && study.plan.done) || {};
  const key = (d, s) => `${d}:${s.tech}:${s.subj}`;
  const toggle = (k) => update((s) => ({ ...s, plan: { ws, done: { ...((s.plan && s.plan.ws === ws && s.plan.done) || {}), [k]: !((s.plan && s.plan.ws === ws && s.plan.done) || {})[k] } } }));
  const total = plan.reduce((n, p) => n + p.sessions.length, 0), got = Object.values(done).filter(Boolean).length;
  return (
    <RunShell title="Weekly plan" sub="About 10 minutes a day. Little and often beats one long night." onExit={onExit}>
      <div className="stack">
        <Result big={got} of={`of ${total} sessions done`} bar={(got / total) * 100} />
        {plan.map((p, i) => (
          <section key={p.d} className="stack" style={{ gap: 4 }} aria-label={i === 0 ? "Today" : i === 1 ? "Tomorrow" : parse(p.d).toLocaleDateString(undefined, { weekday: "long" })}>
            <h2 className="eyebrow">{i === 0 ? "Today" : i === 1 ? "Tomorrow" : parse(p.d).toLocaleDateString(undefined, { weekday: "long" })}</h2>
            <div className="card card-flat divided">
              {p.sessions.map((s) => {
                const t = TECHS.find((x) => x.id === s.tech), k = key(p.d, s);
                return (
                  <div className="task" key={k}>
                    <button type="button" className="check" role="checkbox" aria-checked={!!done[k]} aria-label={`Mark done: ${t.name}, ${s.subj}`} onClick={() => { Sound.play(done[k] ? "tap" : "done"); toggle(k); }}><span>{done[k] && <Check size={14} strokeWidth={3.5} aria-hidden="true" />}</span></button>
                    <div className="task-main" style={{ cursor: "default" }}><div className="task-title">{t.name}</div><div className="meta"><span><i className="dot" style={{ background: subjColor(s.subj) }} />{s.subj}</span><span>{t.time}</span></div></div>
                    <Button size="sm" onClick={() => onStart(s.tech, s.subj === "Everything" ? [] : [s.subj])}>Start</Button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </RunShell>
  );
}
