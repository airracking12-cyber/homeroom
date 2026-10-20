// Move-In Day: the tour overlay. It sits on top of the real app, lights up one real element at a time (found by its
// data-tour attribute), moves focus to its card at each step, and ends with real notes on the shelf.
// Never points at nothing: if an element isn't on screen, it tries the next candidate, then shows a centered card.
import { useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../ui.jsx";
import { STEPS, CREDIT, start, reduce, stepOf, loadSaved, save, pickTarget, cardSide, holeFor } from "./machine.js";

const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
const find = (id) => [...document.querySelectorAll(`[data-tour="${id}"]`)].find(visible) || null;
const plain = (r) => (r ? { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null);
const near = (a, b) => ["top", "left", "width", "height"].every((k) => Math.abs(a[k] - b[k]) < 0.5);

export default function Tour({ user, route, go, ownNotes, toast, onClose }) {
  const [st, dispatch] = useReducer(reduce, user, (u) => start(loadSaved(u)));
  const step = stepOf(st);
  const [aim, setAim] = useState({ id: null, rect: null });
  const [covered, setCovered] = useState(false);   // a sheet is open (Add notes): the tour steps aside
  const headRef = useRef(null);
  const baseline = useRef(ownNotes);
  const closed = useRef(false);
  const focusedFor = useRef("");

  // remember the place, and tell the app when the tour ends
  useEffect(() => {
    save(user, st);
    if (!st.open && !closed.current) { closed.current = true; onClose(st.finished ? "finished" : "skipped"); }
  }, [st, user, onClose]);

  // take the student to the right page for this step
  useEffect(() => {
    if (!st.open) return;
    baseline.current = ownNotes;
    const r = step.route;
    if (r && (route.dest !== r[0] || (r[1] && route.parts[0] !== r[1]))) go(...r);
  }, [st.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // the hands-on step is done when this student's own note lands on the shelf (a classmate's note doesn't count)
  useEffect(() => {
    if (st.open && step.handsOn && ownNotes > baseline.current) { toast?.("Your first notes are on the shelf."); dispatch({ type: "DONE" }); }
  }, [ownNotes, st.open, step.handsOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the spotlight on the target: it is looked for again every moment, so a page that is still loading, a rotated phone
  // or a scroll can't leave it pointing at nothing
  useEffect(() => {
    if (!st.open) return undefined;
    let dead = false, scrolledFor = "";
    const tick = () => {
      if (dead) return;
      setCovered(!!document.querySelector("dialog[open]"));
      const id = pickTarget(step.targets, (t) => !!find(t));
      const el = id ? find(id) : null;
      if (el && scrolledFor !== step.id) { scrolledFor = step.id; el.scrollIntoView({ block: "center", inline: "nearest" }); }
      const rect = plain(el && el.getBoundingClientRect());
      setAim((a) => ((a.id === id && ((!a.rect && !rect) || (a.rect && rect && near(a.rect, rect)))) ? a : { id, rect }));
    };
    tick();
    const t = setInterval(tick, 160);
    window.addEventListener("resize", tick); window.addEventListener("scroll", tick, true);
    return () => { dead = true; clearInterval(t); window.removeEventListener("resize", tick); window.removeEventListener("scroll", tick, true); };
  }, [st.open, st.step]); // eslint-disable-line react-hooks/exhaustive-deps

  // while the card is up, the page behind can't be reached by keyboard or screen reader (the hands-on step needs the real button)
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return undefined;
    root.inert = st.open && !covered && !step.handsOn;
    return () => { root.inert = false; };
  }, [st.open, covered, step.handsOn]);

  // Esc skips (unless a sheet is open: then Esc closes the sheet first)
  useEffect(() => {
    if (!st.open) return undefined;
    const onKey = (e) => { if (e.key === "Escape" && !document.querySelector("dialog[open]")) { e.preventDefault(); dispatch({ type: "SKIP" }); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [st.open]);

  // focus moves to the card's heading at every step (and again once the page behind has settled)
  useEffect(() => {
    if (!st.open || covered) return;
    const tag = `${step.id}:${aim.id || "none"}`;
    if (focusedFor.current === tag) return;
    focusedFor.current = tag;
    headRef.current?.focus({ preventScroll: true });
  }, [st.open, covered, step.id, aim.id]);

  if (!st.open) return null;
  const vw = window.innerWidth, vh = window.innerHeight;
  const hole = aim.rect ? holeFor(aim.rect, vw, vh) : null;
  const act = () => {
    if (step.handsOn) { const el = find(aim.id || step.targets[0]); if (el) el.click(); else go(...step.route); return; }
    dispatch({ type: "NEXT" });
  };

  return createPortal(
    <div className="tour" hidden={covered}>
      {hole ? (
        <>
          <div className="tour-scrim" aria-hidden="true" style={{ top: 0, left: 0, right: 0, height: hole.top }} />
          <div className="tour-scrim" aria-hidden="true" style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }} />
          <div className="tour-scrim" aria-hidden="true" style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
          <div className="tour-scrim" aria-hidden="true" style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height }} />
          <div className="tour-ring" aria-hidden="true" style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }} />
        </>
      ) : <div className="tour-scrim" aria-hidden="true" style={{ inset: 0 }} />}
      <div className="tour-layer" data-side={cardSide(aim.rect, vh)}>
        <section key={step.id} className="tour-card pop-in pin" role="dialog" aria-modal={!step.handsOn} aria-labelledby="tour-h" aria-describedby="tour-b">
          <p className="eyebrow">Move-In Day &middot; step {st.step + 1} of {STEPS.length}</p>
          <h2 id="tour-h" ref={headRef} tabIndex={-1}>{step.title}</h2>
          <p id="tour-b">{step.body}</p>
          {step.id === "welcome" && <p className="caption tour-credit">{CREDIT.welcome}</p>}
          <div className="tour-dots" aria-hidden="true">{STEPS.map((s, i) => <i key={s.id} data-on={i <= st.step ? "" : undefined} />)}</div>
          <div className="tour-actions">
            <Button variant="primary" onClick={act}>{step.cta}</Button>
            {st.step > 0 && <Button onClick={() => dispatch({ type: "BACK" })}>Back</Button>}
            <Button variant="ghost" onClick={() => dispatch({ type: "SKIP" })}>{step.skipLabel || "Skip tour"}</Button>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
